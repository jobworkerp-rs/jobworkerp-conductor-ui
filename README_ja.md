# jobworkerp-conductor-ui

[jobworkerp-conductor](https://github.com/jobworkerp-rs/jobworkerp-conductor) の Web 管理画面です。Slack イベントハンドラー、定期実行スケジュール、ジョブ結果ハンドラーと、それらを実行する jobworkerp サーバーを管理し、実行状況の確認と、全設定のバックアップ・復元ができます。[jobworkerp-rs の admin-ui](https://github.com/jobworkerp-rs/admin-ui) と並べて使う前提で、見た目を揃えています。日本語と英語に対応しています。

[English](README.md)

## 対応する版

| 画面   | jobworkerp-conductor | jobworkerp-rs |
| ------ | -------------------- | ------------- |
| v0.1.0 | v0.1.2               | v0.25.0       |

画面はこれらの版の gRPC API を使い、これらの版でビルド・テストしています。

## 前提

- gRPC-Web を有効にした conductor 管理 API（`USE_GRPC_WEB=true`）。プロキシは不要です。
- 任意で、gRPC-Web を有効にし（`JW_USE_GRPC_WEB=true`）、ブラウザから届く jobworkerp サーバー。ワーカーの検索、ジョブ結果、admin-ui へのリンクに使います。

> [!WARNING]
> conductor 管理 API には**認証がありません**。また現在の conductor と jobworkerp は、gRPC-Web を有効にすると**すべてのオリジン**からの要求を受け付けます（CORS）。利用者が開いた任意の Web ページが、その利用者のブラウザを通じて両 API を呼べてしまいます。conductor と jobworkerp で許可するオリジンを絞れるようになるまでは、両 API を信頼できるネットワークからだけ届くようにしてください。できれば、画面と両 API を、利用者だけが届くリバースプロキシで同じオリジンから出してください。オリジンを絞れるようになったら、画面のオリジンだけを許可してください。

## 実行

### コンテナイメージ

```bash
docker run -d --name conductor-ui -p 8080:8080 \
  -e CONDUCTOR_UI_CONDUCTOR_URL=http://conductor.internal:9090 \
  -e CONDUCTOR_UI_JOBWORKERP_SERVERS='[{"name":"local","grpcWebUrl":"http://jobworkerp.internal:9000","adminUiUrl":"http://jobworkerp.internal:3000"}]' \
  ghcr.io/jobworkerp-rs/jobworkerp-conductor-ui:latest
```

<http://localhost:8080> を開きます。イメージは [Caddy](https://caddyserver.com) を特権のないユーザーで 8080 番ポートで動かし、起動のたびに下記の環境変数から `config.js` を作ります。`/tmp` が書き込めれば、ルートファイルシステムを読み取り専用にしても動きます（`--read-only --tmpfs /tmp`）。イメージは `linux/amd64` と `linux/arm64` を公開しています。次のコマンドで検証できます。

```bash
gh attestation verify oci://ghcr.io/jobworkerp-rs/jobworkerp-conductor-ui:latest \
  --repo jobworkerp-rs/jobworkerp-conductor-ui
```

### 静的ファイル

各[リリース](https://github.com/jobworkerp-rs/jobworkerp-conductor-ui/releases)には `jobworkerp-conductor-ui-vX.Y.Z.tar.gz`（と `SHA256SUMS`）があります。その中の `web/` を任意の静的サーバーで配信し、存在しないパスには `web/index.html` を返してください（画面はブラウザ内でページを切り替えます）。`web/config.js` は下記の環境変数から作ります。

```bash
CONDUCTOR_UI_CONDUCTOR_URL=http://conductor.internal:9090 \
  ./generate-config.sh web/config.js
```

`config.js` と `index.html` はキャッシュさせずに配信してください。`web/assets/` のファイルは名前にハッシュが入るので、長期間キャッシュできます。

## ランタイム設定

画面は `config.js` から設定を読みます。`generate-config.sh` が次の環境変数からこれを作るので、再ビルドなしで接続先を変えられます。空の変数は未設定として扱います。

| 変数                              | 内容                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONDUCTOR_UI_CONDUCTOR_URL`      | conductor 管理 API（gRPC-Web）。相対 URL は画面の URL を基準に解決し、未設定なら画面と同じオリジン                                                                                                                                    |
| `CONDUCTOR_UI_JOBWORKERP_SERVERS` | `{"name", "grpcWebUrl"?, "adminUiUrl"?}` の JSON 配列。conductor の JobworkerpServer と名前で対応付ける                                                                                                                               |
| `CONDUCTOR_UI_CRON_TIMEZONE`      | conductor が Cron 式を解釈する IANA タイムゾーン（`CONDUCTOR_CRON_TIMEZONE` と同じ値）。未設定のときと、conductor が解釈できない名前（chrono-tz は大文字小文字を区別する）のときは、conductor と同じく UTC で計算し、その旨を表示する |
| `CONDUCTOR_UI_DEFAULT_LANGUAGE`   | `ja` または `en`（既定はブラウザの言語）                                                                                                                                                                                              |
| `CONDUCTOR_UI_DEFAULT_THEME`      | `light`、`dark`、`system`                                                                                                                                                                                                             |

イメージは `CONDUCTOR_UI_PORT`（既定 `8080`）も読みます。

## 開発

```bash
pnpm install
cp dot.env.example .env.local   # 開発サーバーの接続先を下記のテスト環境にする
pnpm dev
```

結合テストと E2E テストは、conductor の all-in-one イメージのコンテナで、実際の conductor と jobworkerp に対して実行します。

```bash
bash scripts/test-env.sh up
pnpm test:integration
pnpm test:destructive   # 全設定を消すテスト。専用の conductor で行う
pnpm test:e2e
bash scripts/test-env.sh down
```

## ライセンス

[MIT](LICENSE) です。リリースのアーカイブとイメージには、ビルドに含まれる JavaScript パッケージと、WebAssembly にした Rust クレートのライセンスをまとめた `THIRD-PARTY-LICENSES.txt` が入っています。イメージでは `/usr/share/doc/jobworkerp-conductor-ui/` にあります。イメージは Caddy の公式イメージ（Apache-2.0）を土台にしています。
