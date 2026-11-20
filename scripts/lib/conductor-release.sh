# shellcheck shell=bash
# The jobworkerp-conductor release the UI is built and tested against: its
# proto (sync-protos.sh) and its all-in-one image (test-env.sh). CI's service
# containers cannot read this file, so they repeat the image, and
# test-conductor-release.sh checks that every copy agrees.
export CONDUCTOR_RELEASE=v0.1.2
# The multi-platform index, so arm64 machines get their own image.
export CONDUCTOR_AIO_IMAGE_PINNED="ghcr.io/jobworkerp-rs/jobworkerp-conductor-all-in-one:${CONDUCTOR_RELEASE}@sha256:f707d6917628695c5fd575410e4d7d1a9ea49cf964737ee3133f6f720fdece80"
