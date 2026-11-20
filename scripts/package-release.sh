#!/usr/bin/env bash
# Usage: package-release.sh <version> <dist-dir> <third-party-licenses> <out-dir>
#
# Packs a release's static archive, jobworkerp-conductor-ui-v<version>.tar.gz:
# the built screens (web/), the runtime config generator, and the licenses.
# It serves from any static server and is what conductor's all-in-one image
# bundles. <version> must be package.json's, so the archive matches its tag.
#
# Entries are sorted, owned by root and dated SOURCE_DATE_EPOCH (else the
# last commit), so the same inputs always give the same bytes. Needs GNU tar.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

[[ $# -eq 4 ]] || die "usage: $0 <version> <dist-dir> <third-party-licenses> <out-dir>"
version=$1 dist=$2 licenses=$3 out=$4

expected=$(ui_version)
[[ "${version}" == "${expected}" ]] || die "version ${version} is not package.json's ${expected}"
[[ -f "${dist}/index.html" ]] || die "${dist} has no index.html; run pnpm build first"
[[ -f "${licenses}" ]] || die "no license listing at ${licenses}"

name="jobworkerp-conductor-ui-v${version}"
epoch=${SOURCE_DATE_EPOCH:-$(git -C "${ROOT_DIR}" log -1 --format=%ct)}

work=$(mktemp -d)
trap 'rm -rf "${work}"' EXIT
stage="${work}/${name}"
mkdir -p "${stage}"
cp -R "${dist}" "${stage}/web"
install -m 0755 "${ROOT_DIR}/docker/generate-config.sh" "${stage}/generate-config.sh"
install -m 0644 "${ROOT_DIR}/LICENSE" "${ROOT_DIR}/README.md" "${ROOT_DIR}/README_ja.md" "${stage}/"
install -m 0644 "${licenses}" "${stage}/THIRD-PARTY-LICENSES.txt"

tar -C "${work}" --sort=name --owner=0 --group=0 --numeric-owner \
  --mtime="@${epoch}" --mode='u+rwX,go+rX,go-w' -cf - "${name}" | gzip -n -9 >"${work}/${name}.tar.gz"
mkdir -p "${out}"
mv "${work}/${name}.tar.gz" "${out}/"
echo "${out}/${name}.tar.gz"
