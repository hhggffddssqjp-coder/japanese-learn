// 檢查預錄語音是否涵蓋全部會被播放的文字：node tools/check-audio.mjs
// 改了單字、例句、情境句或文法題之後，缺的文字會退回裝置語音；列出缺口，提醒到 GitHub Actions 重跑「產生語音檔」。
// 只輸出警告，不會讓 CI 失敗。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectTexts } from './gen-audio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mpath = path.join(ROOT, 'audio', 'manifest.json');
if (!fs.existsSync(mpath)) { console.log('沒有 audio/manifest.json（尚未產生預錄語音），略過。'); process.exit(0); }
const manifest = JSON.parse(fs.readFileSync(mpath, 'utf8'));
const texts = collectTexts();
const missing = [];
let chars = 0;
for (const t of texts) {
  const f = manifest.normal && manifest.normal[t];
  if (!f || !fs.existsSync(path.join(ROOT, 'audio', f))) { missing.push(t); chars += t.length; }
}
console.log(`需要語音的文字 ${texts.length} 句；預錄語音缺 ${missing.length} 句（約 ${chars} 字元，一般＋慢速約 ${chars * 2} 字元）。`);
if (missing.length) {
  console.log('缺少的例子：'); missing.slice(0, 15).forEach((t) => console.log('  -', t));
  console.log('這些文字目前會退回裝置語音；要補齊請到 GitHub Actions 重跑「產生語音檔」（先勾 DRY_RUN 看用量）。');
  if (process.env.GITHUB_ACTIONS) console.log(`::warning::預錄語音缺 ${missing.length} 句，請重跑「產生語音檔」`);
}
