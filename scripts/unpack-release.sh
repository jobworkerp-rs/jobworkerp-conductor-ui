#!/usr/bin/env bash
# Usage: unpack-release.sh <archive>
#
# Unpacks a static archive (package-release.sh) into .release/image/, the
# input the Dockerfile copies, replacing what was there. build-release.sh and
# the public release workflow's image jobs both stage the image this way.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

archive=${1-}
[[ -f "${archive}" ]] || die "usage: $0 <archive>"
stage="${ROOT_DIR}/.release/image"
rm -rf -- "${stage}"
mkdir -p "${stage}"
tar -xzf "${archive}" -C "${stage}" --strip-components=1
