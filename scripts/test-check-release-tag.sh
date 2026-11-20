#!/usr/bin/env bash
# Tests for scripts/check-release-tag.sh: the release tag must be
# vMAJOR.MINOR.PATCH (what public-sync-action accepts) and match
# package.json's version, otherwise publishing stops before anything is synced.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
check="${SCRIPT_DIR}/check-release-tag.sh"
# shellcheck source=lib/test-harness.sh
source "${SCRIPT_DIR}/lib/test-harness.sh"
work=$(mktemp -d)
trap 'rm -rf "${work}"' EXIT

write_manifest() {
  printf '{ "name": "jobworkerp-conductor-ui", "version": "%s" }\n' "$1" >"${work}/package.json"
}

status_of() {
  local status=0
  bash "${check}" "$@" >/dev/null 2>&1 || status=$?
  echo "${status}"
}

expect_ok() {
  check "accepts ${1}" [ "$(status_of "$1" "${work}/package.json")" = 0 ]
}

expect_rejected() {
  local tag=$1 manifest=${2:-${work}/package.json}
  check "rejects '${tag}' (${manifest##*/})" [ "$(status_of "${tag}" "${manifest}")" = 2 ]
}

write_manifest 0.1.0
expect_ok v0.1.0
expect_rejected v0.1.1
expect_rejected v0.1
expect_rejected 0.1.0
expect_rejected v0.1.0-rc.1
expect_rejected v01.0.0
expect_rejected ''

write_manifest 10.20.30
expect_ok v10.20.30
expect_rejected v10.20.3

# A missing manifest, or one without a version, is a configuration error.
expect_rejected v10.20.30 "${work}/missing.json"
echo '{ "name": "x" }' >"${work}/noversion.json"
expect_rejected v10.20.30 "${work}/noversion.json"

finish check-release-tag
