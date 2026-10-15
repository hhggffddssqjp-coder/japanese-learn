// 產生 js/data-word-levels.js：比對各 JLPT 單字表（open-anki-jlpt-decks 的 n5.csv~n1.csv），替既有單字標上 JLPT 級別
// 用法：node tools/build-word-levels.mjs <放有 n1.csv~n5.csv 的資料夾>
// CSV 欄位：expression,reading,meaning,tags,guid（可由 https://github.com/jamsinclair/open-anki-jlpt-decks/tree/main/src 下載）
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2];
if (!dir) { console.error('用法：node tools/build-word-levels.mjs <csv 資料夾>'); process.exit(1); }

const parseCsv = (text) => {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.slice(1);
};

const level = new Map(); // expression → 最簡單的級別
const levelByReading = new Map();
for (const lv of [5, 4, 3, 2, 1]) {
  for (const [expr, reading] of parseCsv(fs.readFileSync(path.join(dir, `n${lv}.csv`), 'utf8'))) {
    if (!level.has(expr)) level.set(expr, `N${lv}`);
    if (!levelByReading.has(reading)) levelByReading.set(reading, `N${lv}`);
  }
}

const sb = { window: {}, console }; sb.window.window = sb.window; vm.createContext(sb);
const jsDir = path.join(ROOT, 'js');
const names = ['data-kana', 'data-words', 'data-words-extra', ...fs.readdirSync(jsDir).filter((f) => /^data-words-(?!extra)/.test(f)).map((f) => f.replace(/\.js$/, '')).sort()];
for (const n of names) vm.runInContext(fs.readFileSync(path.join(jsDir, n + '.js'), 'utf8'), sb);

const out = {};
sb.window.JP.LESSONS.forEach((l) => l.words.forEach(([jp, rd]) => {
  const lv = level.get(jp) || (!rd || rd === jp ? levelByReading.get(jp) : null);
  if (lv) out[jp] = lv;
}));
const lines = Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
fs.writeFileSync(path.join(ROOT, 'js', 'data-word-levels.js'), `/* 既有單字的 JLPT 級別（由 tools/build-word-levels.mjs 比對 JLPT 單字表產生；JLPT 無官方單字表，級別為社群整理，僅供參考）
   沒有出現在這裡的單字，會依所屬世界推定級別。 */
window.JP = window.JP || {};
window.JP.WORD_LV = {
${lines.join(',\n')}
};
`);
const total = sb.window.JP.LESSONS.reduce((a, l) => a + l.words.length, 0);
console.log(`標上級別 ${Object.keys(out).length} / ${total} 個單字`);
