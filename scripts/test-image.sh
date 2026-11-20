#!/usr/bin/env bash
# Usage: test-image.sh <image>
#
# Starts the UI image the way a hardened deployment would (read-only root,
# tmpfs /tmp) and checks what it serves: the screens, a config.js generated
# from CONDUCTOR_UI_* with its values escaped, the SPA fallback, caching and
# security headers, and that it runs unprivileged and reports healthy.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/test-harness.sh
source "${SCRIPT_DIR}/lib/test-harness.sh"

image=${1-}
[[ -n "${image}" ]] || die "usage: $0 <image>"
name="conductor-ui-image-test-$$"
work=$(mktemp -d)
cleanup() {
  docker rm -f "${name}" >/dev/null 2>&1 || true
  rm -rf "${work}"
}
trap cleanup EXIT

docker run -d --name "${name}" --read-only --tmpfs /tmp -p 127.0.0.1::8080 \
  -e 'CONDUCTOR_UI_CONDUCTOR_URL=https://conductor.example/"</script>' \
  -e 'CONDUCTOR_UI_DEFAULT_LANGUAGE=ja' \
  "${image}" >/dev/null
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

# get <path> <name>: body into ${work}/<name>, headers into ${work}/<name>.h
get() {
  curl -sS -o "${work}/$2" -D "${work}/$2.h" -w '%{http_code}' "${base}$1"
}
header() {
  grep -i "^$2:" "${work}/$1.h" | head -n1 | cut -d: -f2- | tr -d '\r' | sed 's/^ //'
}

if [[ "$(get / index)" == 200 ]] && grep -q 'id="root"' "${work}/index"; then
  pass "serves the screens at /"
else
  fail "serves the screens at /"
fi
check "revalidates index.html" [ "$(header index cache-control)" = no-cache ]
check "sends nosniff" [ "$(header index x-content-type-options)" = nosniff ]
check "forbids framing" [ "$(header index x-frame-options)" = DENY ]

if [[ "$(get /schedules/1/edit deep)" == 200 ]] && cmp -s "${work}/index" "${work}/deep"; then
  pass "answers a screen's path with index.html"
else
  fail "answers a screen's path with index.html"
fi

get /config.js config >/dev/null
if grep -Fq 'https://conductor.example/\"\u003c/script\u003e' "${work}/config"; then
  pass "writes config.js from the environment, escaped"
else
  fail "writes config.js from the environment, escaped: $(cat "${work}/config")"
fi
check "passes every variable" grep -Fq '"defaultLanguage": "ja"' "${work}/config"
check "never caches config.js" [ "$(header config cache-control)" = no-store ]

script=$(grep -o '/assets/[^"]*\.js' "${work}/index" | head -n1)
if [[ -n "${script}" && "$(get "${script}" script)" == 200 ]]; then
  check "caches hashed assets" grep -q immutable <<<"$(header script cache-control)"
else
  fail "serves the bundle ${script}"
fi
wasm=$(docker exec "${name}" sh -c 'ls /srv/assets/*.wasm | head -n1')
if [[ "$(get "${wasm#/srv}" wasm)" == 200 && "$(header wasm content-type)" == application/wasm ]]; then
  pass "serves WebAssembly as application/wasm"
else
  fail "serves WebAssembly as application/wasm"
fi
check "does not hide a missing asset" [ "$(get /assets/missing.js missing)" = 404 ]

check "runs unprivileged" [ "$(docker exec "${name}" id -u)" != 0 ]
check "ships the license listing" \
  docker exec "${name}" test -s /usr/share/doc/jobworkerp-conductor-ui/THIRD-PARTY-LICENSES.txt

finish image
