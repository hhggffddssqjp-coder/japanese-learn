// 單字庫資料處理：node tools/build-bank.mjs <level> [check|build] [檔號...]
//   check：檢查 tools/bank-src/<level>/out-XX.json（翻譯結果）是否符合格式
//   build：把全部 out-XX.json 合併成 js/bank-<level>.js（單字庫，學習頁面會延遲載入）
// 輸入 in-XX.json 來自 open-anki-jlpt-decks（JLPT 單字表，來源見 README 的資料來源）；
// 中文釋義、詞性與例句由 AI 撰寫，建議搭配辭典確認。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [level = 'n3', mode = 'check', ...only] = process.argv.slice(2);
const dir = path.join(ROOT, 'tools', 'bank-src', level);
const POS = ['名詞', '動詞', 'い形容詞', 'な形容詞', '副詞', '接續詞', '連體詞', '感嘆詞', '助數詞', '其他'];

const plain = (s) => String(s).replace(/\|/g, '').replace(/\{[^}]*\}/g, '');
const isKanji = (c) => /[一-鿿々]/.test(c);
const problems = [];
const bad = (f, m) => problems.push(`${f}: ${m}`);

const files = fs.readdirSync(dir).filter((f) => /^in-\d+\.json$/.test(f)).sort()
  .filter((f) => !only.length || only.some((o) => f.includes(o.padStart(2, '0'))));
// 既有單字（避免重複）
const existing = new Set();
{
  const vm = await import('node:vm');
  const sb = { window: {}, console }; sb.window.window = sb.window; vm.createContext(sb);
  const jsDir = path.join(ROOT, 'js');
  const names = ['data-kana', 'data-words', 'data-words-extra', ...fs.readdirSync(jsDir).filter((f) => /^data-words-(?!extra)/.test(f)).map((f) => f.replace(/\.js$/, '')).sort()];
  for (const n of names) vm.runInContext(fs.readFileSync(path.join(jsDir, n + '.js'), 'utf8'), sb);
  sb.window.JP.LESSONS.forEach((l) => l.words.forEach((w) => existing.add(w[0])));
}

const all = [];
const seenJp = new Set();
const dupJp = [];
for (const f of files) {
  const num = f.match(/\d+/)[0];
  const input = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const outPath = path.join(dir, `out-${num}.json`);
  if (!fs.existsSync(outPath)) { bad(f, `找不到 out-${num}.json`); continue; }
  let out;
  try { out = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch (e) { bad(`out-${num}.json`, `JSON 格式錯誤：${e.message}`); continue; }
  const byJp = new Map();
  out.forEach((o) => { if (byJp.has(o.jp)) bad(`out-${num}`, `單字重複：${o.jp}`); byJp.set(o.jp, o); });
  for (const it of input) {
    const o = byJp.get(it.jp);
    const where = `out-${num}/${it.jp}`;
    if (!o) { bad(where, '沒有對應的輸出（要翻譯或標記 skip）'); continue; }
    if (o.skip) { if (!o.reason) bad(where, 'skip 需要 reason'); continue; }
    if (existing.has(it.jp)) { bad(where, '與既有單字重複，請 skip'); continue; }
    // 同一個寫法有多種讀音（例：冷ます さます／ひやます）時，只收第一筆（項目 id 以寫法為準）
    if (seenJp.has(it.jp)) { dupJp.push(it.jp); continue; }
    seenJp.add(it.jp);
    if (!o.zh || /[a-zA-Z]/.test(o.zh) || o.zh.length > 24) bad(where, `zh 需為 24 字內的繁體中文釋義（不含英文）：${o.zh}`);
    if (!POS.includes(o.pos)) bad(where, `pos 需為 ${POS.join('／')} 之一：${o.pos}`);
    if (!o.ex || !o.exZh) { bad(where, '缺例句或例句中文'); continue; }
    const toks = o.ex.split('|');
    if (toks.length < 3 || toks.length > 9 || toks.some((t) => !t)) bad(where, `例句分詞數 ${toks.length}（需 3~9、不可有空分詞）：${o.ex}`);
    if ((o.ex.match(/\{/g) || []).length !== (o.ex.match(/\}/g) || []).length) bad(where, `{} 不成對：${o.ex}`);
    if (/[a-zA-Z]/.test(plain(o.ex))) bad(where, `例句含英文字母：${o.ex}`);
    for (const m of o.ex.matchAll(/([^|{}]*)\{([^}]*)\}/g)) {
      if (!/^[ぁ-んァ-ヶー]+$/.test(m[2])) bad(where, `讀音需為假名「${m[2]}」：${o.ex}`);
      if (!isKanji(m[1].slice(-1))) bad(where, `振假名前應為漢字「${m[1]}」：${o.ex}`);
    }
    // 例句要含有單字本身（動詞／形容詞可變化：比對語幹）
    const stem = it.jp.endsWith('する') && it.jp.length > 2 ? it.jp.slice(0, -2) : /[ぁ-ん]$/.test(it.jp) && it.jp.length > 1 && !/^[ぁ-んァ-ヶー]+$/.test(it.jp) ? it.jp.slice(0, -1) : it.jp;
    const kanaOnly = /^[ぁ-んァ-ヶー〜]+$/.test(it.jp);
    if (!plain(o.ex).includes(kanaOnly && it.jp.length > 2 && /[ぁ-ん]$/.test(it.jp) && /(る|う|く|ぐ|す|つ|ぬ|ぶ|む|い)$/.test(it.jp) ? it.jp.slice(0, -1) : stem)) bad(where, `例句沒有出現單字「${it.jp}」：${plain(o.ex)}`);
    // 例句中漢字詞的振假名要和單字讀音一致（只檢查「純漢字」與「漢字＋送假名」的單字）
    const mm = it.jp.match(/^([一-鿿々]+)([ぁ-ん]*)$/);
    if (mm && toks.length) {
      const [, kj, tail] = mm;
      const expect = tail && it.rd.endsWith(tail) ? it.rd.slice(0, -tail.length) : it.rd;
      const tokRuby = [...o.ex.matchAll(/([^|{}]*?)([一-鿿々]+)\{([^}]*)\}/g)].filter((x) => x[2] === kj);
      if (tokRuby.length && !tokRuby.some((x) => x[3] === expect || (kj.length === 1 && x[3] !== expect && false))) {
        bad(where, `例句的讀音「${tokRuby[0][3]}」和單字讀音「${expect}」不同（連濁等特殊讀音請改寫例句）：${o.ex}`);
      }
    }
    all.push([it.jp, it.rd, o.zh, o.pos, o.ex, o.exZh]);
  }
  const extra = out.filter((o) => !input.some((i) => i.jp === o.jp));
  extra.forEach((o) => bad(`out-${num}`, `多出的單字：${o.jp}`));
}

if (dupJp.length) console.log(`略過 ${dupJp.length} 個寫法重複的單字：${dupJp.join('、')}`);
console.log(`${level.toUpperCase()}：通過 ${all.length} 個單字` + (problems.length ? `，問題 ${problems.length} 個` : ''));
if (problems.length) { problems.slice(0, 80).forEach((p) => console.log(' -', p)); if (problems.length > 80) console.log(` …還有 ${problems.length - 80} 個`); process.exit(1); }

if (mode === 'build') {
  const target = path.join(ROOT, 'js', `bank-${level}.js`);
  const lines = all.map((r) => '  ' + JSON.stringify(r));
  fs.writeFileSync(target, `/* 單字庫 ${level.toUpperCase()}（由 tools/build-bank.mjs 產生，請勿手動修改）
   格式：[單字, 讀音, 中文, 詞性, 例句, 例句中文]。JLPT 級別為社群整理、非官方；中文與例句由 AI 撰寫，可能有誤。 */
window.JP = window.JP || {};
(window.JP.BANK = window.JP.BANK || {}).${level} = [
${lines.join(',\n')}
];
`);
  console.log(`已寫入 ${path.relative(ROOT, target)}（${all.length} 字，${(fs.statSync(target).size / 1024).toFixed(0)}KB）`);
}
