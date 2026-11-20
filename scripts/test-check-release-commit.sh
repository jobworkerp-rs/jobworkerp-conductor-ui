#!/usr/bin/env bash
# Tests for scripts/check-release-commit.sh: only a commit already merged into
# the release branch may be published, so a tag placed on a work branch stops
# before anything is synced.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
sut="${SCRIPT_DIR}/check-release-commit.sh"
# shellcheck source=lib/test-harness.sh
source "${SCRIPT_DIR}/lib/test-harness.sh"
work=$(mktemp -d)
trap 'rm -rf "${work}"' EXIT

repo="${work}/repo"

expect_status() {
  local expected=$1 desc=$2 status=0
  shift 2
  (cd "${repo}" && bash "${sut}" "$@") >/dev/null 2>&1 || status=$?
  check "${desc} (exit ${expected})" [ "${status}" -eq "${expected}" ]
}

git init --quiet --initial-branch=main "${repo}"
# CI runners have no git identity; annotated tags need one as much as commits.
git -C "${repo}" config user.name fixture
git -C "${repo}" config user.email fixture@example.invalid
commit() {
  git -C "${repo}" commit --quiet --allow-empty -m "$1"
}
commit first
first=$(git -C "${repo}" rev-parse HEAD)
commit second
git -C "${repo}" tag -a v1.0.0 -m "Release v1.0.0"
git -C "${repo}" switch --quiet -c work
commit unmerged
git -C "${repo}" tag v1.0.1
git -C "${repo}" switch --quiet main

expect_status 0 "tip of the release branch" HEAD main
expect_status 0 "earlier commit of the release branch" "${first}" main
expect_status 0 "annotated tag on the release branch" v1.0.0 main
expect_status 2 "tag on an unmerged work branch" v1.0.1 main
expect_status 2 "unknown commit" 0000000000000000000000000000000000000000 main
expect_status 2 "missing release branch" HEAD origin/main
expect_status 2 "missing arguments" HEAD

finish check-release-commit
