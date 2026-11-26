#!/usr/bin/env python3
"""Guards the public GitHub release workflow (.github/workflows/*.yml) and the
container image it builds (Dockerfile).

The workflows are published to a public repository, so the rules that keep
untrusted code off privileged tokens and keep every fetched build input
pinned are checked here on every change instead of being left to review. The
READMEs must name the archive and the image the workflow publishes.
`--self-test` proves each rule still fires by mutating the real release.yml,
Dockerfile and READMEs in memory.
"""

import pathlib
import re
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
WORKFLOW_DIR = ROOT / ".github" / "workflows"
RELEASE = WORKFLOW_DIR / "release.yml"
DOCKERFILE = ROOT / "Dockerfile"
READMES = [ROOT / "README.md", ROOT / "README_ja.md"]
GITHUB_ONLY = "github.server_url == 'https://github.com'"
PINNED_USES = re.compile(r"^[\w.-]+/[\w./-]+@[0-9a-f]{40}$")
PINNED_IMAGE = re.compile(r"^[\w./-]+(:[\w.-]+)?@sha256:[0-9a-f]{64}$")
BUILD_SCRIPT = "scripts/build-release.sh"
TAG_SCRIPT = "scripts/check-release-tag.sh"
IMAGE_TEST = "scripts/test-image.sh"
SERVE_TEST = "scripts/test-serve.sh"
UNPACK_SCRIPT = "scripts/unpack-release.sh"
ARCHIVE = "jobworkerp-conductor-ui-vX.Y.Z.tar.gz"
IMAGE = "ghcr.io/jobworkerp-rs/jobworkerp-conductor-ui"
PLATFORMS = "linux/amd64,linux/arm64"

# Only GitHub-hosted images: a self-hosted runner must never pick up a job of
# this repository.
GITHUB_HOSTED = {"ubuntu-24.04", "ubuntu-24.04-arm"}

# Jobs in the order they must run, and the only write scopes each may hold.
# The image is checked before anything is published, and pushed only once
# the release exists.
JOB_NEEDS = {
    "build": None,
    "image-verify": "build",
    "publish": "image-verify",
    "image": "publish",
}
WRITE_SCOPES = {
    "publish": {"contents", "id-token", "attestations"},
    "image": {"packages", "id-token", "attestations"},
}
IMAGE_JOBS = ("image-verify", "image")
# The license listing needs the pinned cargo-about, installed by the shared
# action pinned like any other.
CARGO_ABOUT_ACTION = "sutr-app/portable-binary-release/install-cargo-about"


def load(path):
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    # PyYAML parses the bare `on:` key as boolean True.
    if True in data:
        data["on"] = data.pop(True)
    return data


def steps(job):
    return job.get("steps") or []


def runs(job):
    return [step.get("run") or "" for step in steps(job)]


def uses_of(job, action):
    return [s for s in steps(job) if (s.get("uses") or "").startswith(f"{action}@")]


def labels(runs_on):
    return {runs_on} if isinstance(runs_on, str) else set(runs_on or [])


def write_scopes(job):
    return {scope for scope, level in (job.get("permissions") or {}).items() if level == "write"}


def check_common(wf_name, wf):
    failures = []
    fail = failures.append
    triggers = wf.get("on")
    if not isinstance(triggers, dict) or set(triggers) != {"push"} \
            or set(triggers["push"] or {}) != {"tags"}:
        fail(f"{wf_name}: only `push: tags` may trigger public workflows, got {triggers}")
    if wf.get("permissions") != {"contents": "read"}:
        fail(f"{wf_name}: workflow permissions must be exactly contents: read")
    for name, job in (wf.get("jobs") or {}).items():
        if job.get("if") != GITHUB_ONLY:
            fail(f"{wf_name}:{name}: missing `if: {GITHUB_ONLY}` (only GitHub may run it)")
        unexpected = labels(job.get("runs-on")) - GITHUB_HOSTED
        if unexpected:
            fail(f"{wf_name}:{name}: runs on non GitHub-hosted runners {sorted(unexpected)}")
        for step in steps(job):
            uses = step.get("uses")
            if uses and not PINNED_USES.match(uses):
                fail(f"{wf_name}:{name}: action not pinned to a commit SHA: {uses}")
        # upload-artifact skips dot paths unless told otherwise, and then
        # finds "no files" for the release archive under .release/.
        for upload in uses_of(job, "actions/upload-artifact"):
            options = upload.get("with") or {}
            hidden = any(part.startswith(".") and part not in {".", ".."}
                         for line in str(options.get("path", "")).splitlines()
                         for part in line.strip().split("/"))
            if hidden and options.get("include-hidden-files") is not True:
                fail(f"{wf_name}:{name}: uploading a dot path needs include-hidden-files: true")
        for checkout in uses_of(job, "actions/checkout"):
            if (checkout.get("with") or {}).get("persist-credentials") is not False:
                fail(f"{wf_name}:{name}: checkout must set persist-credentials: false")
        for run in runs(job):
            if re.search(r"\bpnpm install\b", run) and "--frozen-lockfile" not in run:
                fail(f"{wf_name}:{name}: pnpm install must use --frozen-lockfile")
            # A template expanded into a script runs whatever the value holds
            # (a tag name, say); pass values through env instead.
            if "${{" in run:
                fail(f"{wf_name}:{name}: no ${{{{ }}}} in run:, pass it through env: {run.strip()}")
    return failures


def check_release(wf):
    failures = []
    fail = failures.append
    jobs = wf.get("jobs") or {}
    if set(jobs) != set(JOB_NEEDS):
        fail(f"release.yml: jobs {sorted(jobs)} != {sorted(JOB_NEEDS)}")
        return failures
    for name, needs in JOB_NEEDS.items():
        if jobs[name].get("needs") != needs:
            fail(f"release.yml: {name} must need {needs!r}, got {jobs[name].get('needs')!r}")
        actual, allowed = write_scopes(jobs[name]), WRITE_SCOPES.get(name, set())
        if actual != allowed:
            fail(f"release.yml: {name} write scopes {sorted(actual)} != {sorted(allowed)}")
    build = jobs["build"]
    for script in (TAG_SCRIPT, BUILD_SCRIPT):
        if not any(script in run for run in runs(build)):
            fail(f"release.yml: build must run {script}")
    if not uses_of(build, CARGO_ABOUT_ACTION):
        fail(f"release.yml: build must install cargo-about with {CARGO_ABOUT_ACTION}")
    if (wf.get("env") or {}).get("IMAGE") != IMAGE:
        fail(f"release.yml: IMAGE must be {IMAGE}")
    for name in IMAGE_JOBS:
        failures += check_image_job(name, jobs[name], wf.get("env") or {})
    verify, publish = jobs["image-verify"], jobs["image"]
    for test in (IMAGE_TEST, SERVE_TEST):
        if not any(test in run for run in runs(verify)):
            fail(f"release.yml: image-verify must run {test}")
    if any((b.get("with") or {}).get("push") for b in uses_of(verify, "docker/build-push-action")):
        fail("release.yml: image-verify must not push")
    pushes = uses_of(publish, "docker/build-push-action")
    if not pushes or (pushes[0].get("with") or {}).get("platforms") != PLATFORMS:
        fail(f"release.yml: image must push {PLATFORMS}")
    attest = uses_of(publish, "actions/attest-build-provenance")
    if not attest or (attest[0].get("with") or {}).get("push-to-registry") is not True:
        fail("release.yml: image must attest the pushed image (push-to-registry)")
    return failures


def check_image_job(name, job, env):
    """An image ships the attested archive's files; it never builds its own,
    and needs no emulation."""
    failures = []
    if any(re.search(r"\b(pnpm|cargo)\b", run) for run in runs(job)):
        failures.append(f"release.yml: {name} must reuse the release archive, not build")
    if not any(UNPACK_SCRIPT in run for run in runs(job)):
        failures.append(f"release.yml: {name} must unpack the release archive with {UNPACK_SCRIPT}")
    if uses_of(job, "docker/setup-qemu-action"):
        failures.append(f"release.yml: {name} must not use QEMU")
    buildx = uses_of(job, "docker/setup-buildx-action")
    driver_opts = str(((buildx or [{}])[0].get("with") or {}).get("driver-opts", ""))
    # The pin may live in the workflow env, named once for both image jobs.
    driver_opts = re.sub(r"\$\{\{\s*env\.(\w+)\s*\}\}", lambda m: str(env.get(m.group(1), "")), driver_opts)
    buildkit = re.search(r"image=(\S+)", driver_opts)
    if not buildkit or not PINNED_IMAGE.match(buildkit.group(1)):
        failures.append(f"release.yml: {name} must pin the buildkit image by digest in driver-opts")
    builds = uses_of(job, "docker/build-push-action")
    if not builds or any((b.get("with") or {}).get("file") != "Dockerfile" for b in builds):
        failures.append(f"release.yml: {name} must build the Dockerfile")
    return failures


def check_dockerfile(text):
    """One stage on a base image pinned by digest that runs nothing, so a
    multi-platform build needs no emulation; files come only from the build
    context (never ADD or another image)."""
    failures = []
    froms = 0
    for line in re.sub(r"\\\n", " ", text).splitlines():
        words = line.split()
        if not words:
            continue
        instruction = words[0].upper()
        if instruction == "ADD":
            failures.append(f"Dockerfile: ADD fetches or unpacks implicitly; use COPY: {line.strip()}")
        elif instruction == "RUN":
            failures.append(f"Dockerfile: the image must run nothing at build time: {line.strip()}")
        elif instruction == "COPY" and any(w.startswith("--from=") for w in words):
            failures.append(f"Dockerfile: COPY only from the build context: {line.strip()}")
        elif instruction == "FROM":
            froms += 1
            image = next(w for w in words[1:] if not w.startswith("--"))
            if not PINNED_IMAGE.match(image):
                failures.append(f"Dockerfile: base image not pinned by digest: {image}")
    if froms != 1:
        failures.append(f"Dockerfile: expected one stage, got {froms}")
    return failures


def check_readmes(readmes):
    """The READMEs name what the release publishes."""
    failures = []
    for name, text in readmes.items():
        for needle in (f"`{ARCHIVE}`", IMAGE):
            if needle not in text:
                failures.append(f"{name}: must name {needle}")
    return failures


def check_workflow(wf_name, wf):
    failures = check_common(wf_name, wf)
    if wf_name == RELEASE.name:
        failures += check_release(wf)
    return failures


def check_all(readmes, dockerfile):
    failures = []
    for path in sorted(WORKFLOW_DIR.glob("*.y*ml")):
        failures += check_workflow(path.name, load(path))
    return failures + check_dockerfile(dockerfile) + check_readmes(readmes)


def step_running(wf, job, needle):
    return next(s for s in steps(wf["jobs"][job]) if needle in (s.get("run") or ""))


def step_using(wf, job, action):
    return uses_of(wf["jobs"][job], action)[0]


# Each mutation breaks one rule of the real release.yml; the checks must
# report every one of them, otherwise a guard has silently stopped working.
MUTATIONS = {
    "pull_request trigger": lambda wf: wf["on"].update({"pull_request": None}),
    "branch push trigger": lambda wf: wf["on"]["push"].update({"branches": ["main"]}),
    "missing github-only guard": lambda wf: wf["jobs"]["build"].pop("if"),
    "write token on build job": lambda wf: wf["jobs"]["build"].update(
        {"permissions": {"contents": "write"}}
    ),
    "workflow-wide write token": lambda wf: wf.update({"permissions": {"contents": "write"}}),
    "unpinned action": lambda wf: step_using(wf, "build", "actions/checkout").update(
        {"uses": "actions/checkout@v4"}
    ),
    "persisted checkout credentials": lambda wf: step_using(wf, "publish", "actions/checkout")[
        "with"
    ].update({"persist-credentials": True}),
    "template expansion in a script": lambda wf: step_running(wf, "build", BUILD_SCRIPT).update(
        {"run": "bash scripts/build-release.sh ${{ github.ref_name }}"}
    ),
    "hidden archive not uploaded": lambda wf: step_using(wf, "build", "actions/upload-artifact")[
        "with"
    ].pop("include-hidden-files"),
    "unlocked install": lambda wf: step_running(wf, "build", "pnpm install").update(
        {"run": "pnpm install"}
    ),
    "tag check dropped": lambda wf: step_running(wf, "build", TAG_SCRIPT).update({"run": "true"}),
    "cargo-about installed by a script": lambda wf: wf["jobs"]["build"]["steps"].remove(
        step_using(wf, "build", CARGO_ABOUT_ACTION)
    ),
    "release build elsewhere": lambda wf: step_running(wf, "build", BUILD_SCRIPT).update(
        {"run": "pnpm build"}
    ),
    "self-hosted runner": lambda wf: wf["jobs"]["publish"].update({"runs-on": "self-hosted"}),
    "publish skipping the image check": lambda wf: wf["jobs"]["publish"].update({"needs": "build"}),
    "image pushed before the release": lambda wf: wf["jobs"]["image"].update(
        {"needs": "image-verify"}
    ),
    "write token on image verify": lambda wf: wf["jobs"]["image-verify"].update(
        {"permissions": {"packages": "write"}}
    ),
    "package write token on publish": lambda wf: wf["jobs"]["publish"]["permissions"].update(
        {"packages": "write"}
    ),
    "contents write token on image": lambda wf: wf["jobs"]["image"]["permissions"].update(
        {"contents": "write"}
    ),
    "serve check dropped": lambda wf: step_running(wf, "image-verify", SERVE_TEST).update(
        {"run": "true"}
    ),
    "image check dropped": lambda wf: step_running(wf, "image-verify", IMAGE_TEST).update(
        {"run": "true"}
    ),
    "image verify pushes": lambda wf: step_using(wf, "image-verify", "docker/build-push-action")[
        "with"
    ].update({"push": True}),
    "image without arm64": lambda wf: step_using(wf, "image", "docker/build-push-action")[
        "with"
    ].update({"platforms": "linux/amd64"}),
    "image without attestation": lambda wf: step_using(
        wf, "image", "actions/attest-build-provenance"
    )["with"].pop("push-to-registry"),
    "image builds the app": lambda wf: wf["jobs"]["image"]["steps"].append({"run": "pnpm build"}),
    "image with QEMU": lambda wf: wf["jobs"]["image"]["steps"].insert(
        0, {"uses": "docker/setup-qemu-action@" + "0" * 40}
    ),
    "unpinned buildkit": lambda wf: step_using(wf, "image-verify", "docker/setup-buildx-action")[
        "with"
    ].update({"driver-opts": "image=moby/buildkit:latest"}),
    "buildkit pinned by tag in env": lambda wf: wf["env"].update({"BUILDKIT": "moby/buildkit:v0.35.0"}),
    "image staged by hand": lambda wf: step_running(wf, "image", UNPACK_SCRIPT).update(
        {"run": "tar -xzf dist/x.tar.gz"}
    ),
    "another Dockerfile": lambda wf: step_using(wf, "image", "docker/build-push-action")[
        "with"
    ].update({"file": "docker/Dockerfile.dev"}),
    "another image name": lambda wf: wf["env"].update({"IMAGE": "ghcr.io/someone/else"}),
}

DOCKERFILE_MUTATIONS = {
    "a build step": lambda t: t + "\nRUN apk add curl\n",
    "base image by tag": lambda t: re.sub(r"@sha256:[0-9a-f]{64}", "", t, count=1),
    "ADD from a URL": lambda t: t + "\nADD https://example.com/tool /usr/local/bin/tool\n",
    "COPY from another image": lambda t: t + "\nCOPY --from=busybox:latest /bin/sh /bin/sh\n",
    "a second stage": lambda t: t + "\nFROM " + re.search(r"^FROM (\S+)", t, re.M).group(1) + "\n",
}

README_MUTATIONS = {
    "README without the archive": lambda t: t.replace(ARCHIVE, "jobworkerp-conductor-ui.zip"),
    "README without the image": lambda t: t.replace(IMAGE, "ghcr.io/someone/else"),
}


def report(failures, pass_msg):
    for msg in failures:
        print(f"FAIL: {msg}", file=sys.stderr)
    if failures:
        return 1
    print(f"PASS: {pass_msg}")
    return 0


def self_test(readmes, dockerfile):
    # The real files must pass first; their failures are reported as is.
    problems = check_all(readmes, dockerfile)
    for desc, mutate in MUTATIONS.items():
        wf = load(RELEASE)
        mutate(wf)
        if not check_workflow(RELEASE.name, wf):
            problems.append(f"mutation not detected: {desc}")
    for desc, mutate in DOCKERFILE_MUTATIONS.items():
        if not check_dockerfile(mutate(dockerfile)):
            problems.append(f"mutation not detected: Dockerfile: {desc}")
    for desc, mutate in README_MUTATIONS.items():
        if not check_readmes({name: mutate(text) for name, text in readmes.items()}):
            problems.append(f"mutation not detected: {desc}")
    count = len(MUTATIONS) + len(DOCKERFILE_MUTATIONS) + len(README_MUTATIONS)
    return report(problems, f"public release workflow self-test ({count} mutations detected)")


def main():
    for path in (RELEASE, DOCKERFILE, *READMES):
        if not path.is_file():
            print(f"FAIL: missing {path}", file=sys.stderr)
            return 1
    readmes = {path.name: path.read_text(encoding="utf-8") for path in READMES}
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")
    if sys.argv[1:] == ["--self-test"]:
        return self_test(readmes, dockerfile)
    return report(check_all(readmes, dockerfile), "public release workflow")


if __name__ == "__main__":
    sys.exit(main())
