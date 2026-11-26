#!/usr/bin/env bash
# Usage: build-release.sh
#
# Builds what a release publishes, into .release/: the license listing, the
# static archive (package-release.sh), and its contents unpacked into
# .release/image/, the input the Dockerfile copies. The public release
# workflow and CI run this, so a release is built the same way everywhere.
# cargo-about is found as generate-third-party-licenses.ts describes.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
out="${ROOT_DIR}/.release"
version=$(ui_version)

cd "${ROOT_DIR}"
# Neither .env files nor VITE_* from this shell may reach the bundle.
while read -r name; do unset "${name}"; done < <(compgen -e | grep '^VITE_' || true)
CONDUCTOR_UI_RELEASE_BUILD=1 pnpm build
bash scripts/check-bundle-env.sh dist
mkdir -p "${out}"
pnpm exec tsx scripts/generate-third-party-licenses.ts "${out}/THIRD-PARTY-LICENSES.txt"
archive=$(bash scripts/package-release.sh "${version}" dist "${out}/THIRD-PARTY-LICENSES.txt" "${out}")
bash scripts/unpack-release.sh "${archive}"
echo "${archive}"
