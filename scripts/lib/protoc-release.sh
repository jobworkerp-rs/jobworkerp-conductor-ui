# shellcheck shell=bash disable=SC2034 # the variable is read by gen-proto.sh
# The protoc version the generated code is made with. The CI installs protoc
# with the portable-binary-release install-protoc action and regenerates the
# code, which fails unless that action installs this version: update both
# together.
PROTOC_VERSION=36.2
