#!/usr/bin/env bash
# Usage: check-release-tag.sh <tag> [path/to/package.json]
#
# Fails (exit 2) unless <tag> is vMAJOR.MINOR.PATCH and equals "v" plus
# package.json's version. public-sync-action only understands that tag form,
# and tying the tag to package.json keeps the published version and the
# released archive and image in step.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
DIE_STATUS=2

tag=${1-}
manifest=${2:-${SCRIPT_DIR}/../package.json}

[[ "${tag}" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] \
  || die "release tag '${tag}' is not vMAJOR.MINOR.PATCH"
[[ -f "${manifest}" ]] || die "manifest not found: ${manifest}"

version=$(package_version "${manifest}")
[[ -n "${version}" ]] || die "no version in ${manifest}"
[[ "${tag}" == "v${version}" ]] \
  || die "release tag '${tag}' does not match package.json version '${version}'"

echo "release tag ${tag} matches package.json version ${version}"
