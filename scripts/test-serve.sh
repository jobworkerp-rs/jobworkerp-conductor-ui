#!/usr/bin/env bash
# Usage: test-serve.sh <archive>
#
# Serves a release archive with its own serve.sh, the way it runs without a
# container (macOS with `brew install caddy`, say), and checks what it serves
# (lib/serve-checks.sh). Caddy comes from the image the Dockerfile pins, with
# the unpacked archive mounted read-only, so the test needs only docker.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/test-harness.sh
source "${SCRIPT_DIR}/lib/test-harness.sh"
# shellcheck source=lib/serve-checks.sh
source "${SCRIPT_DIR}/lib/serve-checks.sh"

archive=${1-}
[[ -f "${archive}" ]] || die "usage: $0 <archive>"
caddy_image=$(awk '$1 == "FROM" { print $2; exit }' "${ROOT_DIR}/Dockerfile")
name="conductor-ui-serve-test-$$"
work=$(mktemp -d)
cleanup() {
  docker rm -f "${name}" >/dev/null 2>&1 || true
  rm -rf "${work}"
}
trap cleanup EXIT
mkdir -p "${work}/ui" "${work}/out"
tar -xzf "${archive}" -C "${work}/ui" --strip-components=1
# The container's user must be able to read the mounted files.
chmod -R a+rX "${work}/ui"

# Without Caddy on PATH (busybox only), it says what is missing.
if docker run --rm -e PATH=/bin -v "${work}/ui:/opt/ui:ro" --entrypoint /opt/ui/serve.sh \
  "${caddy_image}" >"${work}/no-caddy.log" 2>&1; then
  fail "fails without Caddy"
else
  check "names Caddy when it is missing" grep -qi caddy "${work}/no-caddy.log"
fi

env_args=()
for pair in "${SERVE_CHECK_ENV[@]}"; do env_args+=(-e "${pair}"); done
docker run -d --name "${name}" --user 65534:65534 --read-only --tmpfs /tmp \
  -p 127.0.0.1::8080 -v "${work}/ui:/opt/ui:ro" --entrypoint /opt/ui/serve.sh \
  "${env_args[@]}" "${caddy_image}" >/dev/null
port=$(docker port "${name}" 8080/tcp | head -n1 | sed 's/.*://')
base="http://127.0.0.1:${port}"
for _ in $(seq 1 30); do
  curl -fs -o /dev/null "${base}/config.js" && break
  [[ "$(docker inspect -f '{{.State.Running}}' "${name}")" == true ]] || break
  sleep 1
done
if curl -fs -o /dev/null "${base}/config.js"; then
  pass "starts with serve.sh"
else
  docker logs "${name}" 2>&1 | tail -n 20 >&2
  fail "starts with serve.sh"
  finish serve
fi

# A predictable directory under a shared /tmp could be planted by another
# user, letting them swap config.js (and with it the API the screens call).
dirs=$(docker exec "${name}" sh -c 'stat -c "%a %n" /tmp/conductor-ui.* 2>/dev/null' || true)
check "writes config.js into a fresh directory only its owner can enter (${dirs})" \
  grep -Eq '^700 /tmp/conductor-ui\.[A-Za-z0-9]+$' <<<"${dirs}"

modules=("${work}"/ui/web/assets/*.wasm)
check_served "${base}" "${work}/out" "${modules[0]#"${work}/ui/web"}"

finish serve
