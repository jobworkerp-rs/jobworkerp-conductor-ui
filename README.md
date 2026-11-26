# jobworkerp-conductor-ui

Web admin UI for [jobworkerp-conductor](https://github.com/jobworkerp-rs/jobworkerp-conductor):
manage Slack event handlers, cron schedules, job-result handlers and the jobworkerp
servers they run on, follow their executions, and back up or restore every setting.
It is designed to be used next to the [jobworkerp-rs admin-ui](https://github.com/jobworkerp-rs/admin-ui)
and shares its look. Japanese and English.

[日本語](README_ja.md)

## Compatibility

| UI     | jobworkerp-conductor | jobworkerp-rs |
| ------ | -------------------- | ------------- |
| v0.1.2 | v0.1.2               | v0.25.0       |

The UI talks to the gRPC APIs of these versions; it is built and tested against them.

## Requirements

- conductor's admin API with gRPC-Web enabled (`USE_GRPC_WEB=true`). No proxy is needed.
- Optionally, jobworkerp servers with gRPC-Web enabled (`JW_USE_GRPC_WEB=true`), reachable
  from the browser, for worker search, job results and the admin-ui links.

> [!WARNING]
> The conductor admin API has **no authentication**, and while gRPC-Web is enabled conductor
> and jobworkerp currently accept requests from **any origin** (CORS). Any web page a user
> opens could then call them through that user's browser. Until conductor and jobworkerp can
> restrict the allowed origins, keep the APIs reachable only from a trusted network, and
> preferably serve the UI and both APIs from one origin behind a reverse proxy that only you
> can reach. Once origins can be restricted, allow only the UI's origin.

## Running

### Container image

```bash
docker run -d --name conductor-ui -p 8080:8080 \
  -e CONDUCTOR_UI_CONDUCTOR_URL=http://conductor.internal:9090 \
  -e CONDUCTOR_UI_JOBWORKERP_SERVERS='[{"name":"local","grpcWebUrl":"http://jobworkerp.internal:9000","adminUiUrl":"http://jobworkerp.internal:3000"}]' \
  ghcr.io/jobworkerp-rs/jobworkerp-conductor-ui:latest
```

Open <http://localhost:8080>. The image runs [Caddy](https://caddyserver.com) as an
unprivileged user on port 8080 and writes `config.js` from the variables below at every
start. It also runs with a read-only root filesystem if `/tmp` is writable
(`--read-only --tmpfs /tmp`). Images are published for `linux/amd64` and `linux/arm64`;
verify one with:

```bash
gh attestation verify oci://ghcr.io/jobworkerp-rs/jobworkerp-conductor-ui:latest \
  --repo jobworkerp-rs/jobworkerp-conductor-ui
```

### Static files

Each [release](https://github.com/jobworkerp-rs/jobworkerp-conductor-ui/releases) has
`jobworkerp-conductor-ui-vX.Y.Z.tar.gz` (with `SHA256SUMS`), which runs without a container
on any OS, macOS included. With [Caddy](https://caddyserver.com/docs/install) installed
(`brew install caddy` on macOS), its `serve.sh` serves the UI just like the image does:

```bash
tar -xzf jobworkerp-conductor-ui-vX.Y.Z.tar.gz
cd jobworkerp-conductor-ui-vX.Y.Z
CONDUCTOR_UI_CONDUCTOR_URL=http://localhost:9090 ./serve.sh   # http://localhost:8080
```

`serve.sh` writes `config.js` from the variables below into a temporary directory and
runs Caddy with the bundled `Caddyfile`; `CONDUCTOR_UI_PORT` changes the port.

To use another static server instead, serve the `web/` directory, answering unknown paths
with `web/index.html` (the UI routes in the browser), and write `web/config.js` from the
variables below with `./generate-config.sh web/config.js`. Serve `config.js` and
`index.html` without caching; files under `web/assets/` have hashed names and can be
cached for good.

## Runtime configuration

The UI reads its settings from `config.js`, which `generate-config.sh` writes from these
variables, so one build serves any deployment. Empty variables count as unset.

| Variable                          | Description                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CONDUCTOR_UI_CONDUCTOR_URL`      | conductor admin API (gRPC-Web). Relative URLs resolve against the page; unset means the page's own origin                                                                                                    |
| `CONDUCTOR_UI_JOBWORKERP_SERVERS` | JSON array of `{"name", "grpcWebUrl"?, "adminUiUrl"?}`, matched with conductor's JobworkerpServer by name                                                                                                    |
| `CONDUCTOR_UI_CRON_TIMEZONE`      | IANA time zone conductor interprets cron expressions in (`CONDUCTOR_CRON_TIMEZONE`); unset means UTC, and so does a name conductor cannot read (chrono-tz names are case-sensitive); the screens note either |
| `CONDUCTOR_UI_DEFAULT_LANGUAGE`   | `ja` or `en` (default: the browser's language)                                                                                                                                                               |
| `CONDUCTOR_UI_DEFAULT_THEME`      | `light`, `dark` or `system`                                                                                                                                                                                  |

The image also reads `CONDUCTOR_UI_PORT` (default `8080`).

## Development

```bash
pnpm install
cp dot.env.example .env.local   # points the dev server at the test environment below
pnpm dev
```

Integration and end-to-end tests run against a real conductor and jobworkerp, in
containers of the conductor all-in-one image:

```bash
bash scripts/test-env.sh up
pnpm test:integration
pnpm test:destructive   # clears every setting, on a conductor of its own
pnpm test:e2e
bash scripts/test-env.sh down
```

## License

[MIT](LICENSE). The release archive and the image include `THIRD-PARTY-LICENSES.txt`, the
licenses of the JavaScript packages and Rust crates (compiled to WebAssembly) the build
bundles; the image keeps it in `/usr/share/doc/jobworkerp-conductor-ui/`. The image is
built on Caddy's official image (Apache-2.0).
