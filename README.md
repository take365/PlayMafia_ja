# PlayMafia
PlayMafia はブラウザで動作する人狼系パーティーゲームです。NodeJS・SockJS・Redis で実装され、StarCraft II の Mafia Mod をベースにしています。

サーバー管理者はコードを起動するだけで、複数のユーザーがゲームを作成して参加できます。
日本語化はいったんしていますがAI追加は挫折中断です。
## 特長
##### 機能一覧
* 新規プレイヤー向け説明を備えたフロントエンド Web サイト。ゲームクライアントのインストールは不要で、ブラウザだけで遊べます。
* ユーザー登録、ログイン、フレンド追加、プライベートメッセージ機能。
* ロビー作成・参加、ゲーム設定変更、プレゲームチャット。
* 管理者がゲームのスキンやルール、テキスト、画像、役職を容易に変更できるモジュラー構造。
* 市民、医者、シェリフ、マフィアなど **19 種類の役職** がプレイ可能。
* 公開チャット、個人チャット、グループチャット。
* マフィアまたはタウンが勝利条件を満たすまで昼夜のサイクルが続きます。
* 役職説明や遊び方を備えた詳細なゲーム内ヘルプ。
* 試合後の画面では達成目標やプレイヤー同士の会話が確認できます。
* ブラウザを閉じたり接続が切断されても、再接続してゲームに復帰可能。
* サーバーが落ちても再起動時にゲームが再開され、プレイヤーは戻って続行できます。

##### スクリーンショット

## サーバーのセットアップ
##### 必要条件
* Linux または Windows
* [NodeJS](http://nodejs.org/)
* [Redis](http://redis.io/)
* 任意: npm モジュール [hiredis](https://www.npmjs.com/package/hiredis) — サーバー速度を大幅に向上させます。Windows では追加のインストールが必要です。インストールされていれば自動的に使用されます。

##### インストール
* このリポジトリをローカルにチェックアウト
* CMD で `trunk\\game\\` に移動し `npm install` を実行して必要な NodeJS モジュールをインストール
* Redis を起動
* `node index.js` を実行してサーバースクリプトを開始

##### 設定
* 設定オプションは `[trunk\\game\\server\\mafia.constants.js](https://github.com/Jezternz/PlayMafia/blob/master/trunk/game/server/mafia.constants.js)` を参照。変更後はサーバーを再起動してください。

## コードベースと本番運用に関するメモ
##### 管理者向けメモ
* ウェブサイトで運用する場合は HTTPS が必須です。HTTP のままだと一部ブラウザから接続できません。

##### 技術
* [NodeJS](http://nodejs.org/) — サーバーサイドの JavaScript 実行環境。
* [Redis](http://redis.io/) — ゲーム状態の保存やクライアント間のメッセージ伝達に使用。
* [SockJS](https://github.com/sockjs/sockjs-node) — サーバーとブラウザ間のリアルタイム通信を実現。

##### ゲームの改造
ゲームはモジュール化されており、UI スキン追加や役職の拡張が容易です。
* 役職ステータス (JSON) は `[trunk\\game\\server\\mafia.config.raw.js](https://github.com/Jezternz/PlayMafia/blob/master/trunk/game/server/mafia.config.raw.js)` にあります。
* 役職名 (JSON) は `[trunk\\game\\server\\mafia.names.raw.js](https://github.com/Jezternz/PlayMafia/blob/master/trunk/game/server/mafia.names.raw.js)` にあります。
* アクションフェーズのロジックは `[trunk\\game\\server\\mafia.gamelogic.js](https://github.com/Jezternz/PlayMafia/blob/master/trunk/game/server/mafia.gamelogic.js)` にあります。

##### 改善できる点
* Promise を使った非同期処理への対応。
* エラーハンドリングと失敗時のコールバック。
* ファイル分割によるコードの整理。

## クライアント
* Google Chrome を想定。Firefox や IE10+ では軽微な UI バグがあります。
* 初回のみユーザー名とパスワードを登録し、その後はログインするだけです。
* 新規登録にはベータキーが必要です。設定の `BETA_REG_KEY` で変更できます。
* 管理者は `PLAYMAFIA_DEBUG` を true にすることでボットを追加して動作確認できます。ロビーのチャットで `+b` (1 体) または `+bb` (10 体) と入力してください。

## デバッグ
* すべての動作を詳細にログ出力します。出力量は設定ファイルで調整できます。

## ライセンス
MIT License — 改良や修正のプルリクエストを歓迎します。

