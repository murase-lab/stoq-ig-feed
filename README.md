# stoq-ig-feed

stoq.jp トップページ「Follow Us」セクション用の Instagram フィード（@stoq_kitchen）を
毎朝自動取得して配信する公開リポジトリ。

- **公開リポジトリ**である理由: jsDelivr（無料CDN）が公開リポジトリのみ配信できるため。
  内容は公開済みの Instagram 投稿画像とリンクのみで、機密情報は含まない。
- 毎朝 07:00 JST に GitHub Actions が最新6投稿を取得し `feed/` を更新 → jsDelivr が配信。
- stoq.jp 側は `feed/instagram-feed.json` を読んで描画する（Shopifyへの書き込みは不要）。

## 配信URL（stoq.jp が参照）

```
https://cdn.jsdelivr.net/gh/murase-lab/stoq-ig-feed@master/feed/instagram-feed.json
```

## 必要な Secrets

| 名前 | 用途 | 必須 |
|---|---|---|
| `META_ACCESS_TOKEN` | Instagram Graph API トークン（IGA…・60日） | ✅ |
| `GH_PAT` | トークンを毎朝自動更新して恒久化（Secrets: Read and write 権限） | 任意（無いと約60日ごとに手動更新） |

## 手動実行

Actions タブ → "Instagram フィード自動更新" → Run workflow

## 仕組み

`scripts/refresh-instagram-token.mjs`（トークン延長）→ `scripts/fetch-instagram-feed.mjs`
（取得・`feed/` 生成）→ commit/push → jsDelivr purge。
