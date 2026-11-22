# カード検索サイト 改修版 v12（2026-11-22）フォルダ整理

## 新しい構成
```
index.html                  TOP（変更なしの場所）
css/
  top.css                   TOP用
  eternal_return.css        旧 style.css（改名）
  blue_archive.css
  stellar_blade.css         旧 stella_blade.css（綴りを統一）
js/
  script.js                 共通スクリプト
titles/
  eternal_return/index.html
  blue_archive/index.html
  stellar_blade/index.html
data/  images/              今まで通り（変更不要）
```

## 反映手順
1. このフォルダの中身をリポジトリ直下にそのままアップロード（index.html / css / js / titles）
2. ルートに残っている旧ファイルを削除：
   eternal_return.html, blue_archive.html, stella_blade.html,
   style.css, blue_archive.css, stella_blade.css, top.css, script.js
3. data/ と images/ は触らなくてOK。JSONの画像パス表記（images/... と ../images/...）は
   script.js 側で自動でそろえるので、今のJSONがそのまま動く

## URLの変化
- 旧: uramiya.github.io/blue_archive.html
- 新: uramiya.github.io/titles/blue_archive/ （ほか2タイトルも同様）
ブックマーク等は新しいURLになる

## 検証済み
- 3タイトルとも新しい場所から data/*.json を読み込み、全件表示・画像パス解決を確認
- TOPのリンク（タイトルカード／フッター）は新URLに付け替え済み
