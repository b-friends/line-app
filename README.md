# Bフレンズ ソフトバレー 参加管理アプリ

LIFF（LINE内ブラウザ）から出欠登録 → スプレッドシートで名簿管理・チーム編成・参加者リスト出力を行うアプリです。

## 機能

- **名簿管理**: 既存のBフレンズ名簿をMembersシートにインポート。LINEから初回アクセス時に名前を選択するだけでLINE IDと自動紐付け
- **出欠管理**: LIFFから参加/不参加/未定を回答。スプレッドシートに自動集約
- **チーム編成**: 参加者を年齢・性別バランスで自動振り分け。複数ゲームでローテーション（なるべく多くの人と組める）
- **当日参加チェック**: 管理者が実際の出席を記録
- **提出用リスト**: ExportTemplateシートに参加者リストを自動出力（フォーマットは後日差し替え可能）

## スプレッドシート構成

### 「Bフレンズ名簿」スプレッドシート（ROSTER_SPREADSHEET_ID）

| シート | 用途 |
|--------|------|
| Members | 名簿マスタ（既存のBフレンズ名簿をそのまま使用） |

### 運用スプレッドシート（SPREADSHEET_ID）

| シート | 用途 |
|--------|------|
| Schedule | 開催予定 |
| Responses | 出欠回答 |
| GameSets | チーム編成結果 |
| GameResults | 試合結果（スコア・勝敗） |
| ExportTemplate | 提出用リストテンプレート |

### Members シートのカラム

| カラム | 元の名簿 | 説明 |
|--------|----------|------|
| status | 入会（新規追加） | 入会/退会/休会（プルダウン） |
| no | Ｎｏ | 会員番号 |
| fullName | 氏 名 | 氏名 |
| furigana | ふりがな | ふりがな |
| address | 住 所 | 住所 |
| homePhone | 自宅電話 | 自宅電話 |
| mobilePhone | 携帯電話 | 携帯電話 |
| gender | 性別 | 男/女 |
| birthDate | 生年月日 | 生年月日 |
| ageApril1 | 4/1年齢 | 4月1日時点の年齢 |
| insurance | R７保険 | 保険加入状況 |
| contactMethod | 連絡方法 | LINE等 |
| lineId | LINE ID | LIFF認証でuserIdを自動書き込み |
| lineDisplayName | LINE表示名 | LINE表示名 |
| note | メモ | メモ |

## チーム編成ロジック

- 参加人数 13名以下 → 2チーム、14名以上 → 4チーム（2コート）
- 基本4人/チーム、最低3人/チーム
- 年齢層（若手〜35歳/中堅36〜50歳/シニア51歳〜）×性別でバランス分散
- 過去の勝率を考慮してチーム力を均等化（スネークドラフト）
- 複数ゲームでローテーション（同チーム回数が少ないペアを優先配置）
- 4チーム時は対戦組合せもゲームごとにローテーション

## 試合結果・勝率

- 管理者が各ゲームのスコアを入力 → GameResults シートに保存
- GameSets + GameResults から個人別勝率を自動集計
- 次回のチーム編成時に勝率を考慮（強い人が偏らないように）

## セットアップ

1. **「Bフレンズ名簿」スプレッドシート**はそのまま使用（1列目に「入会」プルダウン列があること）
2. 運用用の Google スプレッドシートを別途作成
3. Apps Script プロジェクトを作成し `src/` 配下の5ファイルを貼り付け
4. スクリプトプロパティを設定:
   - `ROSTER_SPREADSHEET_ID`: 「Bフレンズ名簿」スプレッドシートID
   - `SPREADSHEET_ID`: 運用用スプレッドシートID
   - `LIFF_ID`: LINE Developers の LIFF ID
   - `LINE_LOGIN_CHANNEL_ID`: LINE Login チャネルID
   - `APP_TITLE`: 任意（例: Bフレンズ 参加管理）
   - `ADMIN_LINE_USER_IDS`: 管理者のLINE userIdをカンマ区切り
5. `setupSheets()` を1回実行（運用スプレッドシートにSchedule等が自動作成）
6. デプロイ → ウェブアプリ（実行ユーザー: 自分、アクセス: 全員）
7. Web アプリ URL を LIFF の Endpoint URL に設定

## ファイル構成

```
src/
├── appsscript.json   # Apps Script マニフェスト
├── Code.gs           # メインロジック（認証・名簿・出欠・管理者API）
├── TeamMaker.gs      # チーム編成ロジック
├── Index.html        # LIFF画面
└── Styles.html       # CSS
```
