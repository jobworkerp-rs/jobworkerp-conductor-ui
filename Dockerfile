# The UI's container image: Caddy serving the built screens, with config.js
# written from CONDUCTOR_UI_* at start. Nothing is compiled here; the release
# workflow unpacks the static archive (scripts/package-release.sh) into
# .release/image/ first, so the image holds exactly what the archive does.
#
# Caddy's official multi-platform image, pinned by digest.
FROM caddy:2.11.9-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0

ARG VERSION=0.0.0
LABEL org.opencontainers.image.source="https://github.com/jobworkerp-rs/jobworkerp-conductor-ui" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.title="jobworkerp-conductor-ui"

COPY .release/image/web/ /srv/
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --chmod=0755 .release/image/generate-config.sh docker/entrypoint.sh /usr/local/bin/
COPY .release/image/LICENSE .release/image/THIRD-PARTY-LICENSES.txt /usr/share/doc/jobworkerp-conductor-ui/

# Caddy's own state goes to /tmp too, so the root filesystem can be read-only.
ENV CONDUCTOR_UI_PORT=8080 \
    CONDUCTOR_UI_CONFIG_DIR=/tmp/conductor-ui \
    XDG_CONFIG_HOME=/tmp/caddy/config \
    XDG_DATA_HOME=/tmp/caddy/data

USER 65534:65534
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --start-interval=1s \
  CMD wget -q -O /dev/null "http://127.0.0.1:${CONDUCTOR_UI_PORT}/config.js" || exit 1
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
