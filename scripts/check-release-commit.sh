#!/usr/bin/env bash
# Usage: check-release-commit.sh <commit-ish> <release-branch-ref>
#
# Fails (exit 2) unless <commit-ish> is reachable from <release-branch-ref>
# (e.g. origin/main), run in the repository being released. Publishing is
# irreversible, so a release tag placed on a work branch must stop here
# instead of publishing code that never went through review and CI on main.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
DIE_STATUS=2

commit=${1-}
branch=${2-}

[[ -n "${commit}" && -n "${branch}" ]] || die "usage: $0 <commit-ish> <release-branch-ref>"
resolved=$(git rev-parse --verify --quiet "${commit}^{commit}") || die "unknown commit: ${commit}"
git rev-parse --verify --quiet "${branch}^{commit}" >/dev/null || die "unknown release branch: ${branch}"
git merge-base --is-ancestor "${resolved}" "${branch}" \
  || die "release commit ${resolved} is not on ${branch}; tag a commit merged into it"

echo "release commit ${resolved} is on ${branch}"
