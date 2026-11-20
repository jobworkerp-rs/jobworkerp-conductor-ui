#!/usr/bin/env bash
# Tests docker/generate-config.sh: the generated config.js must evaluate to
# exactly the configured strings, whatever characters they contain, and must
# never let a value break out of its string literal.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SUT="${SCRIPT_DIR}/../docker/generate-config.sh"

work=$(mktemp -d)
trap 'rm -rf "${work}"' EXIT

# shellcheck source=lib/test-harness.sh
source "${SCRIPT_DIR}/lib/test-harness.sh"

# eval_config <file>: print the config object as JSON (sorted keys), as the
# browser would see it after loading the script.
eval_config() {
  node -e '
    const fs = require("fs"); const vm = require("vm");
    const window = {};
    vm.runInNewContext(fs.readFileSync(process.argv[1], "utf8"), { window });
    const c = window.__CONDUCTOR_UI_CONFIG__;
    process.stdout.write(JSON.stringify(c, Object.keys(c).sort()));
  ' "$1"
}

# --- plain values ---------------------------------------------------------
out="${work}/plain.js"
env -i PATH="${PATH}" \
  CONDUCTOR_UI_CONDUCTOR_URL="http://localhost:9090" \
  CONDUCTOR_UI_CRON_TIMEZONE="Asia/Tokyo" \
  CONDUCTOR_UI_DEFAULT_LANGUAGE="ja" \
  CONDUCTOR_UI_DEFAULT_THEME="dark" \
  CONDUCTOR_UI_JOBWORKERP_SERVERS='[{"name":"local","grpcWebUrl":"http://localhost:9000"}]' \
  sh "${SUT}" "${out}"
expected='{"conductorUrl":"http://localhost:9090","cronTimezone":"Asia/Tokyo","defaultLanguage":"ja","defaultTheme":"dark","jobworkerpServers":"[{\"name\":\"local\",\"grpcWebUrl\":\"http://localhost:9000\"}]"}'
if [[ "$(eval_config "${out}")" == "${expected}" ]]; then pass "plain values round-trip"; else fail "plain values round-trip"; fi

# --- hostile characters ---------------------------------------------------
tricky=$'a"b\\c\nd\te</script><!--\x01 日本語'
out="${work}/tricky.js"
env -i PATH="${PATH}" CONDUCTOR_UI_CONDUCTOR_URL="${tricky}" sh "${SUT}" "${out}"
actual=$(eval_config "${out}")
expected=$(TRICKY="${tricky}" node -e 'process.stdout.write(JSON.stringify({conductorUrl: process.env.TRICKY}))')
if [[ "${actual}" == "${expected}" ]]; then pass "escapes quotes, backslashes and control characters"; else fail "escapes quotes, backslashes and control characters (got ${actual})"; fi
if grep -q '<' "${out}"; then fail "no raw '<' in the output"; else pass "no raw '<' in the output"; fi
if [[ $(wc -l <"${out}") -le 3 ]]; then pass "newlines stay inside the literal"; else fail "newlines stay inside the literal"; fi

# --- unset and empty variables are omitted --------------------------------
out="${work}/empty.js"
env -i PATH="${PATH}" CONDUCTOR_UI_CRON_TIMEZONE="" sh "${SUT}" "${out}"
if [[ "$(eval_config "${out}")" == "{}" ]]; then pass "omits unset and empty variables"; else fail "omits unset and empty variables"; fi

# --- usage ----------------------------------------------------------------
if sh "${SUT}" >/dev/null 2>&1; then
  fail "requires an output path"
else
  pass "requires an output path"
fi

finish generate-config
