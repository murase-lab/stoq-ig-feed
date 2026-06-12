/* ============================================================
   STOQ — Instagram 長期トークンの自動更新（60日期限を切らさない）
   ============================================================
   Instagram Login系（IGA…）の長期トークンは graph.instagram.com の
   refresh_access_token で「いつでも+60日」延長できる（発行から24h以上経過が条件）。
   毎朝のワークフローで本スクリプトを先に走らせ、延長したトークンを
   ① 同じ run の後続ステップへ（GITHUB_OUTPUT: token）
   ② GH_PAT がある場合はリポジトリ Secret META_ACCESS_TOKEN を上書き（恒久化）
   ③ ローカル実行時は recipe-pipeline/.env を書き換え
   へ反映する。GH_PAT が無くても当日runは延長トークンで動く（恒久化のみスキップ）。

   使い方:
     node scripts/refresh-instagram-token.mjs        … 更新して結果を出力
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_ENV_PATH = path.resolve(
  __dirname, '..', '..', 'marketing', 'instagram', 'stoq-recipe-pipeline', '.env'
);

function readLocalEnv() {
  const e = {};
  if (fs.existsSync(LOCAL_ENV_PATH)) {
    for (const line of fs.readFileSync(LOCAL_ENV_PATH, 'utf8').split(/\r?\n/)) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const i = line.indexOf('=');
      e[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return e;
}

async function main() {
  const fileEnv = readLocalEnv();
  const env = { ...fileEnv, ...process.env };
  const current = env.META_ACCESS_TOKEN;
  if (!current) throw new Error('META_ACCESS_TOKEN が未設定');

  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.error) {
    // 更新失敗（期限切れ等）。当日は既存トークンで続行できるよう非致命で返す。
    console.error(`⚠ トークン更新失敗 ${json.error.code}: ${json.error.message}`);
    console.error('  → 既存トークンで続行します（期限切れの場合は .env / Secret を手動更新）');
    emitToken(current, null);
    return;
  }

  const newTok = json.access_token;
  const days = Math.round((json.expires_in || 0) / 86400);
  console.log(`✅ トークン更新成功（あと約${days}日有効）`);

  // ローカル: .env を書き換え
  if (fs.existsSync(LOCAL_ENV_PATH) && !process.env.GITHUB_ACTIONS) {
    const raw = fs.readFileSync(LOCAL_ENV_PATH, 'utf8');
    const next = raw.replace(/^META_ACCESS_TOKEN=.*$/m, 'META_ACCESS_TOKEN=' + newTok);
    fs.writeFileSync(LOCAL_ENV_PATH, next);
    console.log('  → recipe-pipeline/.env を更新しました');
  }

  emitToken(newTok, days);
}

/** GITHUB_OUTPUT に token を出力（後続ステップ・secret更新で使用）。ログにはマスク。 */
function emitToken(token, days) {
  if (process.env.GITHUB_OUTPUT) {
    // ログ上はマスク（::add-mask::）
    console.log('::add-mask::' + token);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `token=${token}\n`);
    if (days != null) fs.appendFileSync(process.env.GITHUB_OUTPUT, `days=${days}\n`);
  }
}

main().catch((e) => {
  console.error('✖ 失敗:', e.message);
  process.exit(1);
});
