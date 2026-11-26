#!/usr/bin/env bash
# Usage: check-bundle-env.sh <dist-dir>
#
# Fails when the built bundle carries build-time values (VITE_*), which would
# come from a developer's .env or shell and ship to everyone; a release takes
# its settings from config.js only. Vite embeds them as keys of the object it
# substitutes for import.meta.env, next to its own (BASE_URL, MODE, ...).
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

dist=${1-}
[[ -d "${dist}/assets" ]] || die "usage: $0 <dist-dir> (with assets/)"
leaked=$(grep -ohE '[{,]VITE_[A-Z0-9_]+:' "${dist}"/assets/*.js | tr -d '{,:' | sort -u || true)
[[ -z "${leaked}" ]] || die "the bundle embeds build-time values: $(paste -sd' ' - <<<"${leaked}")"
echo "the bundle embeds no build-time values"
