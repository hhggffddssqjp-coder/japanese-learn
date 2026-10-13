// 題庫資料檢查：node tools/validate-data.mjs
// 檢查單字格式、例句分詞與標音、重複的單字／emoji、文法課的例句與填空題。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
const jsDir = path.join(ROOT, 'js');
const files = ['data-kana', 'data-words', 'data-words-extra']
  .concat(fs.readdirSync(jsDir).filter((f) => /^data-words-.+\.js$/.test(f) && f !== 'data-words-extra.js').map((f) => f.replace(/\.js$/, '')).sort())
  .concat(['data-grammar'])
  .concat(fs.readdirSync(jsDir).filter((f) => /^data-grammar-.+\.js$/.test(f)).map((f) => f.replace(/\.js$/, '')).sort());
for (const f of files) vm.runInContext(fs.readFileSync(path.join(jsDir, f + '.js'), 'utf8'), sandbox, { filename: f });
const JP = sandbox.window.JP;

const problems = [];
const bad = (m) => problems.push(m);
const plain = (s) => String(s).replace(/\|/g, '').replace(/\{[^}]*\}/g, '');
const kanaOnly = (s) => /^[ぁ-んァ-ヶー・、。！？ 　　]+$/.test(s);

const sentCheck = (where, s, zh, { minTok = 1, maxTok = 99 } = {}) => {
  if (!s || !zh) return bad(`${where}: 缺例句或中文`);
  const open = (s.match(/\{/g) || []).length, close = (s.match(/\}/g) || []).length;
  if (open !== close) bad(`${where}: {} 不成對 ${s}`);
  const toks = s.split('|');
  if (toks.some((t) => !t)) bad(`${where}: 有空的分詞 ${s}`);
  if (toks.length < minTok || toks.length > maxTok) bad(`${where}: 分詞數 ${toks.length}（需 ${minTok}~${maxTok}）${s}`);
  if (/[a-zA-Z]/.test(plain(s)) ) bad(`${where}: 含英文字母 ${s}`);
  // 帶 {讀音} 的詞：括號前必須是漢字（振假名只能標漢字），讀音必須是平假名
  for (const m of s.matchAll(/([^|{}]*)\{([^}]*)\}/g)) {
    if (!/^[ぁ-んァ-ヶー]+$/.test(m[2])) bad(`${where}: 讀音需為假名「${m[2]}」 ${s}`);
    if (!/[一-鿿々]$/.test(m[1])) bad(`${where}: 振假名前應為漢字「${m[1]}」 ${s}`);
  }
};

// ── 單字
const seenJp = new Map(), seenEm = new Map(), seenLesson = new Set();
JP.LESSONS.forEach((l) => {
  if (seenLesson.has(l.id)) bad(`課程 id 重複：${l.id}`);
  seenLesson.add(l.id);
  if (!l.title || !l.zh || !l.em) bad(`${l.id}: 缺 title/zh/em`);
  if (l.words.length < 4 || l.words.length > 9) bad(`${l.id}: 單字數 ${l.words.length}（建議 5~8）`);
  l.words.forEach((w) => {
    const [jp, rd, zh, em, ex, exZh, tip, ex2, ex2Zh] = w;
    const where = `${l.id}/${jp}`;
    if (!jp || !zh || !em) return bad(`${where}: 缺欄位`);
    if (seenJp.has(jp)) bad(`${where}: 單字重複（也在 ${seenJp.get(jp)}）`);
    seenJp.set(jp, l.id);
    if (seenEm.has(em)) bad(`${where}: emoji ${em} 重複（也用在 ${seenEm.get(em)}）`);
    seenEm.set(em, jp);
    if (rd && !/^[ぁ-んァ-ヶー]+$/.test(rd)) bad(`${where}: 讀音需全為假名「${rd}」`);
    if (!rd && !kanaOnly(jp)) bad(`${where}: 含漢字卻沒有讀音`);
    const checkEx = (s, z, n) => {
      sentCheck(`${where} 例句${n}`, s, z, { minTok: 3, maxTok: 9 });
      if (!s) return;
      // 動詞／形容詞會變化，只檢查語幹（去掉最後一個假名）出現在句子裡
      const stem = jp.endsWith('する') && jp.length > 2 ? jp.slice(0, -2) : /[ぁ-ん]$/.test(jp) && jp.length > 1 ? jp.slice(0, -1) : jp;
      const ok = plain(s).includes(stem);
      if (!ok) bad(`${where}: 例句${n}沒有出現單字本身 ${s}`);
    };
    checkEx(ex, exZh, 1); checkEx(ex2, ex2Zh, 2);
    if (ex && ex2 && plain(ex) === plain(ex2)) bad(`${where}: 兩個例句相同`);
  });
});

// ── 文法
const seenG = new Set();
JP.GRAMMAR.forEach((g) => {
  if (seenG.has(g.id)) bad(`文法 id 重複：${g.id}`);
  seenG.add(g.id);
  ['title', 'sub', 'pattern', 'body', 'level'].forEach((k) => { if (!g[k]) bad(`文法 ${g.id}: 缺 ${k}`); });
  if (g.examples.length < 6) bad(`文法 ${g.id}: 例句 ${g.examples.length} < 6`);
  g.examples.forEach(([s, zh], i) => sentCheck(`文法 ${g.id} 例句${i + 1}`, s, zh, { minTok: 3, maxTok: 9 }));
  if (g.quiz.length < 10) bad(`文法 ${g.id}: 填空題 ${g.quiz.length} < 10`);
  const stems = new Set();
  g.quiz.forEach(([stem, ans, ...wrong], i) => {
    const where = `文法 ${g.id} 填空${i + 1}`;
    if (!/＿/.test(stem)) bad(`${where}: 沒有空格 ＿`);
    if (!/（[^）]+）\s*$/.test(stem)) bad(`${where}: 結尾需有（中文翻譯）`);
    if ((stem.match(/＿+/g) || []).length !== 1) bad(`${where}: 需剛好一個空格`);
    if (wrong.length < 3) bad(`${where}: 干擾選項不足 3 個`);
    if (new Set([ans, ...wrong]).size !== wrong.length + 1) bad(`${where}: 選項重複或答案混入干擾 ${stem}`);
    if (stems.has(stem)) bad(`${where}: 題目重複`);
    stems.add(stem);
  });
});

const nW = JP.LESSONS.reduce((a, l) => a + l.words.length, 0);
console.log(`課程 ${JP.LESSONS.length}、單字 ${nW}、文法 ${JP.GRAMMAR.length}`);
if (problems.length) { console.log(`發現 ${problems.length} 個問題：`); problems.forEach((p) => console.log(' -', p)); process.exit(1); }
console.log('檢查通過 ✓');
