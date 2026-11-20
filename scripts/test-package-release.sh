#!/usr/bin/env bash
# Tests scripts/package-release.sh with a stand-in build output.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SUT="${SCRIPT_DIR}/package-release.sh"
# shellcheck source=lib/test-harness.sh
source "${SCRIPT_DIR}/lib/test-harness.sh"

work=$(mktemp -d)
trap 'rm -rf "${work}"' EXIT

# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
version=$(ui_version)
mkdir -p "${work}/dist/assets"
echo '<!doctype html>' >"${work}/dist/index.html"
echo 'console.log(1)' >"${work}/dist/assets/index-abc.js"
echo 'THIRD-PARTY' >"${work}/licenses.txt"
archive="jobworkerp-conductor-ui-v${version}.tar.gz"

# --- builds the archive with a fixed layout ---------------------------------
if bash "${SUT}" "${version}" "${work}/dist" "${work}/licenses.txt" "${work}/out1" >/dev/null; then
  listing=$(tar -tzf "${work}/out1/${archive}" | sort | tr '\n' ' ')
  top="jobworkerp-conductor-ui-v${version}"
  expected="${top}/ ${top}/LICENSE ${top}/README.md ${top}/README_ja.md ${top}/THIRD-PARTY-LICENSES.txt ${top}/generate-config.sh ${top}/web/ ${top}/web/assets/ ${top}/web/assets/index-abc.js ${top}/web/index.html "
  if [[ "${listing}" == "${expected}" ]]; then pass "lays out the archive"; else fail "lays out the archive: ${listing}"; fi
  if tar -tvzf "${work}/out1/${archive}" | grep "generate-config.sh" | grep -q '^-rwxr-xr-x'; then
    pass "keeps generate-config.sh executable"
  else
    fail "keeps generate-config.sh executable"
  fi
else
  fail "builds the archive"
fi

# --- the same inputs give the same bytes -------------------------------------
sleep 1
touch "${work}/dist/index.html"
bash "${SUT}" "${version}" "${work}/dist" "${work}/licenses.txt" "${work}/out2" >/dev/null
if cmp -s "${work}/out1/${archive}" "${work}/out2/${archive}"; then
  pass "is reproducible"
else
  fail "is reproducible"
fi

# --- refuses what does not match the release ---------------------------------
if bash "${SUT}" "9.9.9" "${work}/dist" "${work}/licenses.txt" "${work}/out3" >/dev/null 2>&1; then
  fail "rejects a version other than package.json's"
else
  pass "rejects a version other than package.json's"
fi
mkdir -p "${work}/empty"
if bash "${SUT}" "${version}" "${work}/empty" "${work}/licenses.txt" "${work}/out4" >/dev/null 2>&1; then
  fail "rejects a build without index.html"
else
  pass "rejects a build without index.html"
fi
if bash "${SUT}" "${version}" "${work}/dist" "${work}/missing.txt" "${work}/out5" >/dev/null 2>&1; then
  fail "rejects a missing license listing"
else
  pass "rejects a missing license listing"
fi
if [[ ! -e "${work}/out3" && ! -e "${work}/out4" && ! -e "${work}/out5" ]]; then
  pass "writes nothing on failure"
else
  fail "writes nothing on failure"
fi

finish package-release
