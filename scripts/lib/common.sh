# shellcheck shell=bash
# Helpers shared by the repository scripts. Kept compatible with the bash 3.2
# shipped with macOS.

# die <message>: exits with DIE_STATUS (default 1); the release checks use 2,
# so a refused release is told apart from a broken script.
die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit "${DIE_STATUS:-1}"
}

# package_version <package.json>: the version a manifest declares ("" if none).
package_version() {
  node -e 'process.stdout.write(String(require(process.argv[1]).version ?? ""))' "$1"
}

# ui_version: this UI's version, the one its release tag names.
ui_version() {
  package_version "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/package.json"
}
