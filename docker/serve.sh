#!/bin/sh
# Serves the UI with Caddy: writes config.js from CONDUCTOR_UI_* into a
# writable directory, then runs Caddy with the Caddyfile beside this script.
# The image runs it as its entrypoint; the release archive ships it next to
# web/ and the Caddyfile, so the UI also runs without a container wherever
# Caddy is installed (on macOS, `brew install caddy`).
#
#   CONDUCTOR_UI_PORT        port to listen on (default 8080)
#   CONDUCTOR_UI_WEB_ROOT    the built screens (default: web/ beside this script)
#   CONDUCTOR_UI_CONFIG_DIR  where config.js is written (default: a new private
#                            directory under $TMPDIR, made at every start)
#   CONDUCTOR_UI_CADDYFILE   the Caddyfile (default: beside this script)
set -eu

here=$(cd "$(dirname "$0")" && pwd)
: "${CONDUCTOR_UI_WEB_ROOT:=${here}/web}"
: "${CONDUCTOR_UI_CADDYFILE:=${here}/Caddyfile}"
export CONDUCTOR_UI_WEB_ROOT

if ! command -v caddy >/dev/null 2>&1; then
  echo "ERROR: caddy is not installed (https://caddyserver.com/docs/install; macOS: brew install caddy)" >&2
  exit 1
fi

# A fixed name under a shared /tmp could be created first by another user,
# who could then swap config.js and point the screens at another API.
if [ -n "${CONDUCTOR_UI_CONFIG_DIR:-}" ]; then
  mkdir -p "${CONDUCTOR_UI_CONFIG_DIR}"
else
  CONDUCTOR_UI_CONFIG_DIR=$(mktemp -d "${TMPDIR:-/tmp}/conductor-ui.XXXXXX")
fi
export CONDUCTOR_UI_CONFIG_DIR
"${here}/generate-config.sh" "${CONDUCTOR_UI_CONFIG_DIR}/config.js"
exec caddy run --config "${CONDUCTOR_UI_CADDYFILE}" --adapter caddyfile
