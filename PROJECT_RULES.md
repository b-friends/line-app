# プロジェクトルール

## リビジョン管理

- コードを大きく変更する際は、変更前のコードを `revisions/` フォルダに保存する
- フォルダ名は `v{番号}_{説明}` の形式（例: `v1_webapp`, `v2_api_ghpages`）
- 現在の作業コードは常に `src/`（バックエンド）と `docs/`（フロント）に置く
- 変更理由は `トラブルシュート.md` または `CHANGELOG.md` に記録する

## リビジョン履歴

| バージョン | 日付 | 説明 |
|---|---|---|
| v1_webapp | 2025-01 | Apps Script HTML Service でフロント＋バックエンド一体型。LIFF SDK が iframe 制約で動作せず断念 |
| v2_api_ghpages | 2025-01 | フロントを GitHub Pages に分離、Apps Script は API のみ。LIFF 正常動作 |

## ファイル構成

```
liff_circle_app/
├── src/                    # バックエンド（Apps Script）— 現在のバージョン
├── docs/                   # フロント（GitHub Pages）— 現在のバージョン
├── revisions/              # 過去バージョンのアーカイブ
│   ├── v1_webapp/
│   └── ...
├── README.md               # セットアップ手順
├── トラブルシュート.md      # 問題と解決策の記録
└── PROJECT_RULES.md        # このファイル（プロジェクトルール）
```

## スプレッドシート構成

- `ROSTER_SPREADSHEET_ID` (18AIz1vywa9Ph8_Mtzy1rSRL1eA91OhtzRxaCvHwQUPI) — Bフレンズ名簿
- `SPREADSHEET_ID` (1cLbqZ5OqyqSwPFA2gJdkcBaNKFdUREzKp_OJeKVUgWg) — 運用シート

## LINE 設定

- LINE 公式アカウント: @883bhbbr
- LIFF ID: 2009966306-JOCQOOvS
- LINE Login チャネル ID: 2009966306
- GitHub Pages URL: https://tkoda88.github.io/bfriends/ (予定)

## 命名規則

- Apps Script 関数: camelCase（公開APIはそのまま、内部ヘルパーは末尾 `_`）
- スプレッドシートのヘッダー: 名簿は日本語そのまま、運用シートは英語 camelCase
- 名簿カラム参照: `MC.XXX` 定数を使用
