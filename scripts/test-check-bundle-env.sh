#!/usr/bin/env bash
# Tests scripts/check-bundle-env.sh with stand-in build outputs.
# The stand-ins are minified JavaScript, backticks included, not shell.
# shellcheck disable=SC2016
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SUT="${SCRIPT_DIR}/check-bundle-env.sh"
# shellcheck source=lib/test-harness.sh
source "${SCRIPT_DIR}/lib/test-harness.sh"
work=$(mktemp -d)
trap 'rm -rf "${work}"' EXIT

bundle() {
  mkdir -p "${work}/$1/assets"
  printf '%s\n' "$2" >"${work}/$1/assets/index-x.js"
}

# What a release build embeds: Vite's own keys, and the variable names the UI
# reads (as strings, not keys).
bundle clean 'f(window.c,{BASE_URL:`/`,DEV:!1,MODE:`production`,PROD:!0,SSR:!1});const k={conductorUrl:`VITE_CONDUCTOR_URL`}'
check "passes a build without build-time values" bash "${SUT}" "${work}/clean"

bundle leaked 'f(window.c,{BASE_URL:`/`,DEV:!1,MODE:`production`,PROD:!0,SSR:!1,VITE_CONDUCTOR_URL:`http://127.0.0.1:9020`})'
check_not "rejects a build with a value from .env" bash "${SUT}" "${work}/leaked"
check "names the leaked variable" \
  grep -q VITE_CONDUCTOR_URL <<<"$(bash "${SUT}" "${work}/leaked" 2>&1 || true)"

check_not "needs a build directory" bash "${SUT}" "${work}/missing"

finish check-bundle-env
