/* ============================================================
   STOQ — Instagram フィード取得（公開リポジトリ版・jsDelivr配信用）
   ============================================================
   @stoq_kitchen の最新投稿を Instagram Graph API（graph.instagram.com）で
   取得し、画像を feed/ig-feed-1..6.jpg に保存、feed/instagram-feed.json に
   jsDelivr の配信URL（+ permalink/alt）を書き出す。
   このリポジトリは公開で、jsDelivr が feed/ をCDN配信する。
   stoq.jp のトップ「Follow Us」セクションはこのJSONを読んで描画する。

   設定（process.env）:
     META_ACCESS_TOKEN       … IGトークン（IGA始まり / 60日）
     META_GRAPH_API_VERSION  … 省略時 v23.0

   使い方:  node scripts/fetch-instagram-feed.mjs
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const FEED_DIR = path.join(REPO_ROOT, 'feed');
const COUNT = 6;
const REPO_SLUG = 'murase-lab/stoq-ig-feed';
const CDN_BASE = `https://cdn.jsdelivr.net/gh/${REPO_SLUG}@master/feed`;

function cleanCaption(c) {
  if (!c) return 'STOQ Kitchen';
  const oneLine = c.replace(/\s+/g, ' ').trim();
  return (oneLine.length > 60 ? oneLine.slice(0, 60) + '…' : oneLine) || 'STOQ Kitchen';
}

async function main() {
  const tok = process.env.META_ACCESS_TOKEN;
  const ver = process.env.META_GRAPH_API_VERSION || 'v23.0';
  if (!tok) throw new Error('META_ACCESS_TOKEN が未設定');

  fs.mkdirSync(FEED_DIR, { recursive: true });
  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
  const url = `https://graph.instagram.com/${ver}/me/media?fields=${fields}&limit=25&access_token=${encodeURIComponent(tok)}`;
  const json = await (await fetch(url)).json();
  if (json.error) throw new Error(`IG API error ${json.error.code}: ${json.error.message}`);

  const usable = (json.data || [])
    .map((m) => ({
      permalink: m.permalink,
      src: m.media_type === 'VIDEO' ? (m.thumbnail_url || m.media_url) : m.media_url,
      alt: cleanCaption(m.caption),
    }))
    .filter((m) => m.src && m.permalink)
    .slice(0, COUNT);
  if (usable.length < COUNT) throw new Error(`表示可能な投稿が ${usable.length} 件（${COUNT} 件必要）`);

  const date = new Date().toISOString().slice(0, 10);
  const items = [];
  for (let i = 0; i < usable.length; i++) {
    const r = await fetch(usable[i].src);
    if (!r.ok) throw new Error(`画像取得失敗 ${i + 1}: HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const file = `ig-feed-${i + 1}.jpg`;
    fs.writeFileSync(path.join(FEED_DIR, file), buf);
    items.push({
      img: `${CDN_BASE}/${file}?v=${date}`,   // ?v=日付 でブラウザキャッシュをbusting
      permalink: usable[i].permalink,
      alt: usable[i].alt,
    });
    console.log(`  saved feed/${file} (${(buf.length / 1024).toFixed(0)}KB) ← ${usable[i].permalink}`);
  }

  fs.writeFileSync(
    path.join(FEED_DIR, 'instagram-feed.json'),
    JSON.stringify({ updated: date, source: '@stoq_kitchen', items }, null, 2) + '\n'
  );
  console.log(`\n✅ feed/ を更新（${date}・${items.length}枚）`);
}

main().catch((e) => { console.error('✖ 失敗:', e.message); process.exit(1); });
