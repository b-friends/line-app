# リッチメニュー設定情報

## 画像
- `richmenu.jpg` — LINE Official Account Managerにアップロード済みの画像（2500×1686px）
- `shutterstock_1212419833.jpg` — 背景素材

## 画像の再生成方法
```bash
# 仮想環境を作成（初回のみ）
python3 -m venv /tmp/richvenv
/tmp/richvenv/bin/pip install Pillow

# 生成実行
/tmp/richvenv/bin/python3 make_richmenu.py
# → デスクトップに richmenu.jpg が出力される
```

## ボタン構成（6分割、右下は空欄）

| 位置 | ラベル | アクション | URL |
|------|--------|-----------|-----|
| 上左 | スケジュール | リンク | `https://line.me/R/app/2009966306-JOCQOOvS?page=schedule` |
| 上中 | チーム編成   | リンク | `https://line.me/R/app/2009966306-JOCQOOvS?page=teams` |
| 上右 | 新規登録     | リンク | `https://line.me/R/app/2009966306-JOCQOOvS?page=register` |
| 下左 | マイページ   | リンク | `https://line.me/R/app/2009966306-JOCQOOvS?page=mypage` |
| 下中 | 共有資料     | リンク | `https://line.me/R/app/2009966306-JOCQOOvS?page=docs` |
| 下右 | （空欄）     | なし   | —  |

## LINE設定
- 公式アカウント: @883bhbbr
- LIFF ID: 2009966306-JOCQOOvS
- 管理画面: https://manager.line.biz/
