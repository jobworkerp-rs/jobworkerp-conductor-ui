#!/bin/sh
# Writes config.js from CONDUCTOR_UI_* where the Caddyfile serves it (a
# writable directory, so the root filesystem may be read-only), then runs Caddy.
set -eu

mkdir -p "${CONDUCTOR_UI_CONFIG_DIR}"
generate-config.sh "${CONDUCTOR_UI_CONFIG_DIR}/config.js"
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
