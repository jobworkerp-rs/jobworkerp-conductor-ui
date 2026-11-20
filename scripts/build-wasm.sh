#!/usr/bin/env bash
# Tests and builds the WebAssembly workspace (wasm/) and copies the modules
# the screens load into src/: the Slack regex rules and the cron expression
# rules, both built from the same crates and versions conductor uses. wasm-unbind then
# drops wasm-bindgen's leftovers, so the modules need no imports.
#
# The build runs in a Rust container so the host toolchain is left alone. Set
# WASM_BUILD=local to build with rustup on this machine instead, as the CI
# rebuild does. Both use the version pinned in wasm/rust-toolchain.toml and
# remap paths, so they produce the same bytes.
#
# `build-wasm.sh --print-toolchain` prints that version (for CI).
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

WORKSPACE=wasm
TOOLCHAIN=$(sed -n 's/^channel = "\(.*\)"$/\1/p' "${ROOT}/${WORKSPACE}/rust-toolchain.toml")
[[ -n "${TOOLCHAIN}" ]] || die "no channel in ${WORKSPACE}/rust-toolchain.toml"
if [[ "${1-}" == --print-toolchain ]]; then
  echo "${TOOLCHAIN}"
  exit 0
fi
RUST_IMAGE=${RUST_IMAGE:-rust:${TOOLCHAIN}-slim-trixie}
TARGET=wasm32-unknown-unknown
# Built artifacts and the committed modules they become, pairwise.
ARTIFACTS=(slack_regex.wasm cron.wasm)
OUTPUTS=(src/lib/slack/slack-regex.wasm src/lib/schedules/cron.wasm)

build() {
  rustup target add --toolchain "${TOOLCHAIN}" "${TARGET}" >/dev/null
  cargo "+${TOOLCHAIN}" test --manifest-path "${WORKSPACE}/Cargo.toml" --workspace --locked
  # Paths can end up in the module (panic locations); map them to fixed names
  # so the output does not depend on where the build ran.
  local cargo_home=${CARGO_HOME:-${HOME}/.cargo}
  RUSTFLAGS="--remap-path-prefix=${cargo_home}=/cargo --remap-path-prefix=${ROOT}=/src" \
    cargo "+${TOOLCHAIN}" build --manifest-path "${WORKSPACE}/Cargo.toml" --release --locked --target "${TARGET}"
  cargo "+${TOOLCHAIN}" build --manifest-path "${WORKSPACE}/Cargo.toml" --profile tool --locked -p wasm-unbind
}

# Inside the container, hand the files back to the calling user even when the
# build fails, so a failed run leaves nothing root-owned behind.
hand_back() {
  [[ -n "${OWNER-}" ]] || return 0
  local path
  for path in "${WORKSPACE}/target" "${WORKSPACE}/Cargo.lock" "${OUTPUTS[@]}"; do
    if [[ -e "${path}" ]]; then chown -R "${OWNER}" "${path}"; fi
  done
}

cd "${ROOT}"
case "${WASM_BUILD:-docker}" in
  local)
    trap hand_back EXIT
    build
    ;;
  docker)
    command -v docker >/dev/null || die "docker is required (or set WASM_BUILD=local)"
    # Root inside the container may add the target to the image's toolchain;
    # the files it writes are handed back to the calling user.
    docker run --rm \
      -e WASM_BUILD=local \
      -e OWNER="$(id -u):$(id -g)" \
      -v "${ROOT}:/work" -w /work \
      "${RUST_IMAGE}" bash scripts/build-wasm.sh
    exit 0
    ;;
  *) die "WASM_BUILD must be docker or local" ;;
esac

for i in "${!ARTIFACTS[@]}"; do
  "${WORKSPACE}/target/tool/wasm-unbind" "${WORKSPACE}/target/${TARGET}/release/${ARTIFACTS[i]}" "${OUTPUTS[i]}"
  echo "built ${OUTPUTS[i]} ($(wc -c <"${OUTPUTS[i]}") bytes)"
done
