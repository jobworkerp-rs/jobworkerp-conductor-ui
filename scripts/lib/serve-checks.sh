# shellcheck shell=bash
# The HTTP checks every way of serving the UI must pass (the image, and the
# release archive's serve.sh): the screens, a config.js generated from
# CONDUCTOR_UI_* with its values escaped, the SPA fallback, caching and
# security headers. Needs lib/test-harness.sh sourced first.

# The environment the checks expect config.js to come from (passed to the
# server by the sourcing script).
# shellcheck disable=SC2034
SERVE_CHECK_ENV=(
  'CONDUCTOR_UI_CONDUCTOR_URL=https://conductor.example/"</script>'
  'CONDUCTOR_UI_DEFAULT_LANGUAGE=ja'
)

# check_served <base-url> <work-dir> <wasm-path>: <wasm-path> is the URL path
# of one of the WebAssembly modules (their names carry a content hash).
check_served() {
  local base=$1 work=$2 wasm=$3 script
  get() {
    curl -sS -o "${work}/$2" -D "${work}/$2.h" -w '%{http_code}' "${base}$1"
  }
  header() {
    grep -i "^$2:" "${work}/$1.h" | head -n1 | cut -d: -f2- | tr -d '\r' | sed 's/^ //'
  }

  if [[ "$(get / index)" == 200 ]] && grep -q 'id="root"' "${work}/index"; then
    pass "serves the screens at /"
  else
    fail "serves the screens at /"
  fi
  check "revalidates index.html" [ "$(header index cache-control)" = no-cache ]
  check "sends nosniff" [ "$(header index x-content-type-options)" = nosniff ]
  check "forbids framing" [ "$(header index x-frame-options)" = DENY ]

  if [[ "$(get /schedules/1/edit deep)" == 200 ]] && cmp -s "${work}/index" "${work}/deep"; then
    pass "answers a screen's path with index.html"
  else
    fail "answers a screen's path with index.html"
  fi

  get /config.js config >/dev/null
  if grep -Fq 'https://conductor.example/\"\u003c/script\u003e' "${work}/config"; then
    pass "writes config.js from the environment, escaped"
  else
    fail "writes config.js from the environment, escaped: $(cat "${work}/config")"
  fi
  check "passes every variable" grep -Fq '"defaultLanguage": "ja"' "${work}/config"
  check "never caches config.js" [ "$(header config cache-control)" = no-store ]

  script=$(grep -o '/assets/[^"]*\.js' "${work}/index" | head -n1)
  if [[ -n "${script}" && "$(get "${script}" script)" == 200 ]]; then
    check "caches hashed assets" grep -q immutable <<<"$(header script cache-control)"
  else
    fail "serves the bundle ${script}"
  fi
  if [[ "$(get "${wasm}" wasm)" == 200 && "$(header wasm content-type)" == application/wasm ]]; then
    pass "serves WebAssembly as application/wasm"
  else
    fail "serves WebAssembly as application/wasm"
  fi
  check "does not hide a missing asset" [ "$(get /assets/missing.js missing)" = 404 ]
}
