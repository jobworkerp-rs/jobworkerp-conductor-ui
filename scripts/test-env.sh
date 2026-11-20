#!/usr/bin/env bash
# Usage: test-env.sh up|down
#
# Runs conductor all-in-one containers (conductor + jobworkerp) with gRPC-Web
# enabled for the integration and E2E tests, and prints the endpoints. The
# tests share the first one; the second provides another jobworkerp, for
# moving a managed workflow worker between servers; the third ("clear") is for
# the tests that clear or overwrite every setting, which would wipe what the
# others create in the shared one. The image is conductor's published
# all-in-one release pinned in lib/conductor-release.sh; CONDUCTOR_AIO_IMAGE
# runs another, such as one built locally (jobworkerp-conductor README,
# "All-in-one image").
#
#   CONDUCTOR_AIO_IMAGE    image to run (default: the pinned release)
#   TEST_ENV_NAME          container name prefix (default conductor-ui-test)
#   TEST_CONDUCTOR_PORT    host port for the conductor admin API (default 19090)
#   TEST_JOBWORKERP_PORT   host port for jobworkerp gRPC-Web (default 19000)
#   TEST_JOBWORKERP2_PORT  host port for the second jobworkerp (default 19001)
#   TEST_CLEAR_CONDUCTOR_PORT   the clear environment's conductor (default 19190)
#   TEST_CLEAR_JOBWORKERP_PORT  the clear environment's jobworkerp (default 19100)
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/conductor-release.sh
source "${SCRIPT_DIR}/lib/conductor-release.sh"

IMAGE=${CONDUCTOR_AIO_IMAGE:-${CONDUCTOR_AIO_IMAGE_PINNED}}
NAME=${TEST_ENV_NAME:-conductor-ui-test}
CONDUCTOR_PORT=${TEST_CONDUCTOR_PORT:-19090}
JOBWORKERP_PORT=${TEST_JOBWORKERP_PORT:-19000}
JOBWORKERP2_PORT=${TEST_JOBWORKERP2_PORT:-19001}
CLEAR_CONDUCTOR_PORT=${TEST_CLEAR_CONDUCTOR_PORT:-19190}
CLEAR_JOBWORKERP_PORT=${TEST_CLEAR_JOBWORKERP_PORT:-19100}
HEALTHY_TIMEOUT_SEC=120
# A job channel besides the default one, so tests can store a worker's channel.
# jobworkerp ignores the channel settings unless the default concurrency is
# set as well.
EXTRA_CHANNEL="batch"

# start <name> <publish options...>
start() {
  local name=$1
  shift
  docker rm -f "${name}" >/dev/null 2>&1 || true
  docker run -d --name "${name}" "$@" \
    -e USE_GRPC_WEB=true \
    -e JW_USE_GRPC_WEB=true \
    -e JW_GRPC_ADDR=0.0.0.0:9000 \
    -e JW_WORKER_DEFAULT_CONCURRENCY=4 \
    -e JW_WORKER_CHANNELS="${EXTRA_CHANNEL}" \
    -e JW_WORKER_CHANNEL_CONCURRENCIES=1 \
    "${IMAGE}" >/dev/null
}

wait_healthy() {
  local name=$1
  local deadline=$((SECONDS + HEALTHY_TIMEOUT_SEC))
  until [[ "$(docker inspect -f '{{ .State.Health.Status }}' "${name}")" == healthy ]]; do
    if ((SECONDS >= deadline)) || [[ "$(docker inspect -f '{{ .State.Running }}' "${name}")" != true ]]; then
      docker logs "${name}" 2>&1 | tail -n 40 >&2
      die "${name} did not become healthy within ${HEALTHY_TIMEOUT_SEC}s"
    fi
    sleep 1
  done
}

up() {
  start "${NAME}" -p "127.0.0.1:${CONDUCTOR_PORT}:9090" -p "127.0.0.1:${JOBWORKERP_PORT}:9000"
  start "${NAME}-2" -p "127.0.0.1:${JOBWORKERP2_PORT}:9000"
  start "${NAME}-clear" -p "127.0.0.1:${CLEAR_CONDUCTOR_PORT}:9090" \
    -p "127.0.0.1:${CLEAR_JOBWORKERP_PORT}:9000"
  wait_healthy "${NAME}"
  wait_healthy "${NAME}-2"
  wait_healthy "${NAME}-clear"
  echo "CONDUCTOR_URL=http://127.0.0.1:${CONDUCTOR_PORT}"
  echo "JOBWORKERP_URL=http://127.0.0.1:${JOBWORKERP_PORT}"
  echo "JOBWORKERP2_URL=http://127.0.0.1:${JOBWORKERP2_PORT}"
  echo "CLEAR_CONDUCTOR_URL=http://127.0.0.1:${CLEAR_CONDUCTOR_PORT}"
  echo "CLEAR_JOBWORKERP_URL=http://127.0.0.1:${CLEAR_JOBWORKERP_PORT}"
}

down() {
  docker rm -f "${NAME}" "${NAME}-2" "${NAME}-clear" >/dev/null 2>&1 || true
}

case "${1-}" in
  up) up ;;
  down) down ;;
  *) die "usage: $0 up|down" ;;
esac
