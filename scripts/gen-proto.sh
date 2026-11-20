#!/usr/bin/env bash
# Usage: gen-proto.sh
#
# Generates TypeScript (ts-proto, same options as jobworkerp-rs admin-ui) from
# proto/ into src/lib/grpc. The output records the protoc version, so only the
# pinned protoc is accepted: install it with
#   bash scripts/install-protoc.sh .tools/protoc
# (picked up automatically) or point PROTOC at it.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
ROOT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
# shellcheck source=lib/protoc-release.sh
source "${SCRIPT_DIR}/lib/protoc-release.sh"

if [[ -z "${PROTOC-}" && -x "${ROOT_DIR}/.tools/protoc/bin/protoc" ]]; then
  PROTOC="${ROOT_DIR}/.tools/protoc/bin/protoc"
fi
PROTOC=${PROTOC:-protoc}
version=$("${PROTOC}" --version 2>/dev/null) || die "protoc not found (run scripts/install-protoc.sh .tools/protoc)"
[[ "${version}" == "libprotoc ${PROTOC_VERSION}" ]] \
  || die "protoc ${PROTOC_VERSION} required, found '${version}' (run scripts/install-protoc.sh .tools/protoc)"

plugin="${ROOT_DIR}/node_modules/.bin/protoc-gen-ts_proto"
[[ -x "${plugin}" ]] || die "ts-proto is not installed (run pnpm install)"

out="${ROOT_DIR}/src/lib/grpc"
rm -rf "${out}"
mkdir -p "${out}"

cd "${ROOT_DIR}/proto"
# shellcheck disable=SC2046 # one argument per proto file
"${PROTOC}" \
  --plugin="protoc-gen-ts_proto=${plugin}" \
  --ts_proto_out="${out}" \
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=forceLong=string \
  --ts_proto_opt=outputServices=generic-definitions \
  --ts_proto_opt=outputClientImpl=false \
  --ts_proto_opt=outputJsonMethods=false \
  --ts_proto_opt=useExactTypes=false \
  --proto_path=. \
  $(find . -name '*.proto' | sed 's|^\./||' | sort)

echo "generated $(find "${out}" -name '*.ts' | wc -l | tr -d ' ') files into src/lib/grpc"
