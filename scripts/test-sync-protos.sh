#!/usr/bin/env bash
# Tests scripts/sync-protos.sh with local proto trees as sources. Set
# SYNC_PROTOS_TEST_ONLINE=1 to also fetch the pinned public tags.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SUT="${SCRIPT_DIR}/sync-protos.sh"

work=$(mktemp -d)
trap 'rm -rf "${work}"' EXIT

# shellcheck source=lib/test-harness.sh
source "${SCRIPT_DIR}/lib/test-harness.sh"

make_sources() {
  mkdir -p "${work}/conductor/jobworkerp_conductor/data" "${work}/conductor/jobworkerp_conductor/service"
  echo 'syntax = "proto3";' >"${work}/conductor/jobworkerp_conductor/data/common.proto"
  echo 'syntax = "proto3";' >"${work}/conductor/jobworkerp_conductor/service/cron.proto"
  mkdir -p "${work}/jobworkerp/jobworkerp/data" "${work}/jobworkerp/jobworkerp/service"
  echo 'syntax = "proto3";' >"${work}/jobworkerp/jobworkerp/data/worker.proto"
  echo 'syntax = "proto3";' >"${work}/jobworkerp/jobworkerp/service/worker.proto"
  # Files outside the package directory must not be copied.
  echo 'not a proto' >"${work}/jobworkerp/README.md"
}

run_local() {
  CONDUCTOR_PROTO_DIR="${work}/conductor" \
    JOBWORKERP_PROTO_DIR="${work}/jobworkerp" \
    PROTO_OUT="$1" \
    bash "${SUT}"
}

# --- copies both package trees and records their origin -------------------
make_sources
out="${work}/out1"
if run_local "${out}" >/dev/null; then
  if [[ -f "${out}/jobworkerp_conductor/data/common.proto" && -f "${out}/jobworkerp_conductor/service/cron.proto" ]]; then pass "copies the conductor package"; else fail "copies the conductor package"; fi
  if [[ -f "${out}/jobworkerp/data/worker.proto" && -f "${out}/jobworkerp/service/worker.proto" ]]; then pass "copies the jobworkerp package"; else fail "copies the jobworkerp package"; fi
  if [[ ! -e "${out}/README.md" ]]; then pass "copies only package directories"; else fail "copies only package directories"; fi
  if grep -q "^jobworkerp_conductor local ${work}/conductor -$" "${out}/VERSIONS"; then pass "records the conductor origin"; else fail "records the conductor origin"; fi
  if grep -q "^jobworkerp local ${work}/jobworkerp -$" "${out}/VERSIONS"; then pass "records the jobworkerp origin"; else fail "records the jobworkerp origin"; fi
else
  fail "sync from local directories succeeds"
fi

# --- removes files that disappeared upstream ------------------------------
out="${work}/out2"
mkdir -p "${out}/jobworkerp/data"
echo stale >"${out}/jobworkerp/data/removed.proto"
run_local "${out}" >/dev/null
if [[ ! -e "${out}/jobworkerp/data/removed.proto" ]]; then pass "removes stale files"; else fail "removes stale files"; fi

# --- rejects a source without the package directory -----------------------
out="${work}/out3"
if CONDUCTOR_PROTO_DIR="${work}/jobworkerp" JOBWORKERP_PROTO_DIR="${work}/jobworkerp" \
  PROTO_OUT="${out}" bash "${SUT}" >/dev/null 2>&1; then
  fail "rejects a source lacking jobworkerp_conductor/"
else
  pass "rejects a source lacking jobworkerp_conductor/"
fi
if [[ ! -e "${out}/VERSIONS" ]]; then pass "writes nothing on failure"; else fail "writes nothing on failure"; fi

# --- online: pinned public tags -------------------------------------------
if [[ "${SYNC_PROTOS_TEST_ONLINE-}" == 1 ]]; then
  out="${work}/online"
  if PROTO_OUT="${out}" bash "${SUT}" >/dev/null; then
    if [[ -f "${out}/jobworkerp_conductor/service/execution_status.proto" && -f "${out}/jobworkerp/service/worker.proto" ]]; then pass "fetches the pinned tags"; else fail "fetches the pinned tags"; fi
    if grep -Eq '^jobworkerp_conductor https://github.com/jobworkerp-rs/jobworkerp-conductor.git v[0-9.]+ [0-9a-f]{40}$' "${out}/VERSIONS"; then pass "records tag and commit"; else fail "records tag and commit"; fi
  else
    fail "fetches the pinned tags"
  fi
fi

finish sync-protos
