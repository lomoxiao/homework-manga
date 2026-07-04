# Homework Manga MVP

算数の誤答を、正確な数式とSVG図解を含む6コマ学習漫画へ変換するWebアプリです。宿題写真の選択、内容確認、シナリオ編集、漫画プレビューまでを4ステップで操作できます。
従量課金AI API、Firebase Storage、画像生成AIは使用しません。リモートジョブではFirebase AuthenticationとRealtime Databaseの無料枠を利用します。

## 起動

Node.js 20以降を使用してください。

```powershell
npm install
npm run dev
```

ブラウザで `http://localhost:4174` を開きます。

```powershell
npm run typecheck
npm test
npm run build
```

## 操作

- 宿題写真を選び、問題文・誤答・正答を入力します。
- 内容確認画面でつまずきの原因を修正し、6コマシナリオを生成します。
- 各コマの学習目的、場面、セリフ、式、キャラクター、横棒図を編集できます。
- 吹き出しをクリックすると、プレビュー上でもセリフを直接編集できます。
- ローカル手入力モードの文章とシナリオは `localStorage` に保存され、宿題写真は外部送信されません。Slackジョブモードは下記のDrive保存方針に従います。
- 「最初から」で端末内の作業データを消去できます。
- 「PDF / 印刷」でブラウザの印刷画面を開きます。保存先に「PDFとして保存」を選択してください。
- 印刷設定では、背景グラフィックを有効にすると画面と同じ配色になります。

## データ

- `samples/manga_plan.json`: 問題、誤答、正答、6コマの教材計画
- `samples/final_render_config.json`: A4ページとテーマ設定
- `schemas/`: 外部ツールでも利用できるJSON Schema Draft 2020-12
- `src/schema.ts`: 実行時検証に使用するZodスキーマ

アプリは起動時に両方のサンプルJSONを検証します。不正なデータは描画しません。

## 設計判断

### HTML/CSS/SVGで合成する

完成漫画を生成画像として扱わず、背景、キャラクター、吹き出し、式、図解を別レイヤーにしています。数値やセリフを修正しても全画像を作り直す必要がなく、式と図の正確性をテストできます。

### 横棒図を決定論的に生成する

横棒図は `total`、`groups`、`perGroup` からSVGを生成します。MVPの題材では24個を3等分し、各区画を8個と表示します。生成AIによる文字化けや不正確な分割は発生しません。

### 編集データと元JSONを分ける

ブラウザでのセリフ編集は元の教材計画を書き換えず、`localStorage` に保存します。将来は編集差分を中間JSONへ書き戻すローカルバックエンドへ置き換えられます。

### A4印刷をCSSで固定する

画面上のページは794×1123px、印刷時は210×297mmです。`@page` と印刷用CSSにより、ブラウザのPDF保存で1ページに収まります。

## プライバシー

`private/`、`uploads/`、`jobs/` はGit管理対象外です。氏名、学校名、顔が写った画像をリポジトリへ追加しないでください。SlackジョブのDrive画像は「リンクを知っている全員」が閲覧できるため、不要な個人情報を撮影せず、確認後は削除操作を行ってください。

## 現在のMVP範囲

- 小学算数の等分除
- ローカル手入力モードとSlack／Codex解析ジョブモード
- ルール式6コマ生成
- シナリオ編集と端末内保存
- 1ページ6コマ固定
- ダミーキャラクター
- 横棒図
- HTML吹き出しと編集
- 数式・重要語句の強調
- ブラウザ印刷によるPDF出力

Codex CLI解析は `article-to-slides-automation` の既存Socket Mode Runnerから実行します。最終PNGの自動出力は次段階です。

## Slack / Drive / Firebase ジョブモード

URLに `?job=<jobId>` がある場合、Firebase AuthenticationでGoogleログインし、Realtime Databaseの解析結果とGoogle Driveの宿題写真を表示します。設定値は `.env.example` を参照してください。

- 宿題写真は専用Google Driveフォルダに保存し、検索対象外の限定公開リンクを作成します。
- 解析結果を承認すると6コマシナリオへ変換し、Firebaseにも保存します。
- 承認時にDrive画像は削除せず、自動保持期限も設けません。
- 「この宿題を削除」は削除要求を登録し、常駐BotがDrive画像を先に削除してからジョブ一式を削除します。Bot停止中の要求は次回起動時に処理します。
- Slackへ投稿した元の添付写真は削除しません。

既存Databaseを共用する場合は、`multimodal-article-viewer/database.rules.json` の統合ルールをデプロイしてください。このディレクトリの `database.rules.json` は宿題機能だけの参照用で、単独デプロイすると既存Viewerのルールを上書きします。Firebase AuthenticationではGoogleプロバイダを有効化し、GitHub Pagesドメインを承認済みドメインへ追加します。Firebase StorageとBlazeプランは不要です。

## 素材ライブラリ

公開素材は `public/assets/`、カタログは `public/assets/metadata.json` に置きます。素材選択はキャラクター、感情、行動、story beat、向き、配置をスコアリングし、同点ではassetId順に決定します。素材原本・生成候補・宿題写真はGitHubへ保存しません。

GitHub Pagesへのデプロイはルートの `.github/workflows/homework-manga-pages.yml` を使用します。Firebase Web設定はGitHub Actions secretsへ登録してください。
