#!/usr/bin/env bash
# Usage: install-protoc.sh <dest-dir>
#
# Installs a pinned protoc release into <dest-dir> after verifying its
# SHA-256, without sudo or a package manager. The generated TypeScript records
# the protoc version, so local and CI generation must use the same compiler for
# the regeneration check to be meaningful. Under Actions it also exports PROTOC
# for scripts/gen-proto.sh.
#
# Kept compatible with the bash 3.2 shipped with macOS.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=scripts/lib/fetch-pinned.sh
source "${SCRIPT_DIR}/lib/fetch-pinned.sh"
# shellcheck source=scripts/lib/protoc-release.sh
source "${SCRIPT_DIR}/lib/protoc-release.sh"

dest=${1-}
base_url=${PROTOC_BASE_URL:-${PROTOC_RELEASE_URL}}
platform=${PROTOC_PLATFORM:-$(uname -s)-$(uname -m)}

[[ -n "${dest}" ]] || die "usage: $0 <dest-dir>"

protoc_release "${platform}" || die "no pinned protoc for platform ${platform}"

work=$(mktemp -d)
trap 'rm -rf "${work}"' EXIT

fetch_pinned "${base_url}/${protoc_asset}" "${protoc_sha256}" "${work}/${protoc_asset}"

mkdir -p "${dest}"
unzip -q -o "${work}/${protoc_asset}" -d "${dest}"
"${dest}/bin/protoc" --version

export_github_env PROTOC "${dest}/bin/protoc"
