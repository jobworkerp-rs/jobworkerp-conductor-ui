# shellcheck shell=bash
# Minimal assertion helpers for the scripts/test-*.sh suites. Kept compatible
# with the bash 3.2 shipped with macOS.

failures=0

pass() {
  printf 'ok   %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  failures=$((failures + 1))
}

# check <name> <command...>: pass or fail by the command's exit status.
check() {
  local name=$1
  shift
  if "$@"; then pass "${name}"; else fail "${name}"; fi
}

# check_not <name> <command...>: pass when the command fails.
check_not() {
  local name=$1
  shift
  if "$@"; then fail "${name}"; else pass "${name}"; fi
}

# finish <suite>: report and exit non-zero if any check failed.
finish() {
  if ((failures > 0)); then
    printf '%d test(s) failed\n' "${failures}" >&2
    exit 1
  fi
  echo "all $1 tests passed"
}
