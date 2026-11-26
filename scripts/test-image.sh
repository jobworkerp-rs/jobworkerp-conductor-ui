#!/usr/bin/env bash
# Usage: test-image.sh <image>
#
# Starts the UI image the way a hardened deployment would (read-only root,
# tmpfs /tmp) and checks what it serves (lib/serve-checks.sh), that it runs
# unprivileged, reports healthy, and ships the license listing.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/test-harness.sh
source "${SCRIPT_DIR}/lib/test-harness.sh"
# shellcheck source=lib/serve-checks.sh
source "${SCRIPT_DIR}/lib/serve-checks.sh"

image=${1-}
[[ -n "${image}" ]] || die "usage: $0 <image>"
name="conductor-ui-image-test-$$"
work=$(mktemp -d)
cleanup() {
  docker rm -f "${name}" >/dev/null 2>&1 || true
  rm -rf "${work}"
}
trap cleanup EXIT

env_args=()
for pair in "${SERVE_CHECK_ENV[@]}"; do env_args+=(-e "${pair}"); done
docker run -d --name "${name}" --read-only --tmpfs /tmp -p 127.0.0.1::8080 \
  "${env_args[@]}" "${image}" >/dev/null
port=$(docker port "${name}" 8080/tcp | head -n1 | sed 's/.*://')
base="http://127.0.0.1:${port}"

for _ in $(seq 1 60); do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "${name}")" == healthy ]] && break
  [[ "$(docker inspect -f '{{.State.Running}}' "${name}")" == true ]] || break
  sleep 1
done
if [[ "$(docker inspect -f '{{.State.Health.Status}}' "${name}")" == healthy ]]; then
  pass "reports healthy"
else
  docker logs "${name}" 2>&1 | tail -n 20 >&2
  fail "reports healthy"
  finish image
fi

wasm=$(docker exec "${name}" sh -c 'ls /srv/assets/*.wasm | head -n1')
check_served "${base}" "${work}" "${wasm#/srv}"

check "runs unprivileged" [ "$(docker exec "${name}" id -u)" != 0 ]
check "ships the license listing" \
  docker exec "${name}" test -s /usr/share/doc/jobworkerp-conductor-ui/THIRD-PARTY-LICENSES.txt

finish image
