#!/usr/bin/env bash
# Tests scripts/generate-third-party-licenses.ts: the real listing, and that
# a package outside the accepted licenses fails it. The real listing needs
# cargo-about (CARGO_ABOUT, or the pinned copy in .tools/cargo-about).
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
# shellcheck source=lib/test-harness.sh
source "${SCRIPT_DIR}/lib/test-harness.sh"

work=$(mktemp -d)
trap 'rm -rf "${work}"' EXIT

generate() {
  (cd "${ROOT_DIR}" && pnpm exec tsx scripts/generate-third-party-licenses.ts "$@")
}

# --- a fixture package list stands in for pnpm's -------------------------
fixture() {
  local license=$1 dir="${work}/pkg-${2}"
  mkdir -p "${dir}"
  printf 'The %s license text\n' "${license}" >"${dir}/LICENSE"
  printf '{"%s":[{"name":"fixture-%s","versions":["1.0.0"],"paths":["%s"],"license":"%s"}]}\n' \
    "${license}" "${2}" "${dir}" "${license}" >"${work}/pnpm-${2}.json"
}

fixture MIT ok
if THIRD_PARTY_LICENSES_PNPM_JSON="${work}/pnpm-ok.json" THIRD_PARTY_LICENSES_WASM=skip \
  generate "${work}/ok.txt" >/dev/null 2>&1; then
  if grep -q "fixture-ok 1.0.0" "${work}/ok.txt" && grep -q "The MIT license text" "${work}/ok.txt"; then
    pass "lists an accepted package with its license text"
  else
    fail "lists an accepted package with its license text"
  fi
else
  fail "accepts an MIT package"
fi

for license in GPL-3.0-only LGPL-2.1-or-later UNLICENSED; do
  fixture "${license}" bad
  if THIRD_PARTY_LICENSES_PNPM_JSON="${work}/pnpm-bad.json" THIRD_PARTY_LICENSES_WASM=skip \
    generate "${work}/bad.txt" 2>"${work}/bad.err" >/dev/null; then
    fail "rejects ${license}"
  elif grep -q "fixture-bad" "${work}/bad.err" && [[ ! -e "${work}/bad.txt" ]]; then
    pass "rejects ${license}, names the package, and writes nothing"
  else
    fail "rejects ${license}, names the package, and writes nothing"
  fi
done

if generate >/dev/null 2>&1; then fail "needs an output file"; else pass "needs an output file"; fi

# --- the real listing --------------------------------------------------------
if [[ -n "${CARGO_ABOUT-}" || -x "${ROOT_DIR}/.tools/cargo-about/cargo-about" ]] ||
  command -v cargo-about >/dev/null; then
  if generate "${work}/real.txt" >/dev/null; then
    for name in "react " "@tanstack/react-query" "zod " "tailwindcss" "regex 1.13.1" "croner " "chrono-tz "; do
      if grep -q -- "${name}" "${work}/real.txt"; then pass "lists ${name% }"; else fail "lists ${name% }"; fi
    done
    if grep -Eq "^License: .*GPL|GNU (LESSER|AFFERO|GENERAL) PUBLIC LICENSE" "${work}/real.txt"; then
      fail "contains no GPL-family license"
    else
      pass "contains no GPL-family license"
    fi
    if grep -Eq "^- (wasm-abi|slack-regex|cron|wasm-unbind) " "${work}/real.txt"; then
      fail "leaves out this project's own crates"
    else
      pass "leaves out this project's own crates"
    fi
  else
    fail "generates the real listing"
  fi
else
  echo "SKIP the real listing: cargo-about is not installed"
fi

finish generate-third-party-licenses
