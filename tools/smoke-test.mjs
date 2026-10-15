// 出題冒煙測試（不需瀏覽器）：node tools/smoke-test.mjs
// 載入全部資料與出題程式，對每個關卡、每個單字的每種題型反覆出題，檢查：
//  1. 不會丟例外、關卡一定出得到題目
//  2. 選擇題剛好一個正確答案、選項不重複、讀音相同的字不會同時當選項
//  3. 排列句子的字塊含有完整答案；輸入題有可接受的答案；配對題的 id 不重複
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
globalThis.window = { addEventListener() {} };
globalThis.localStorage = { getItem() { return null; }, setItem() {} };
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
globalThis.document = { addEventListener() {}, getElementById() { return null; }, createElement() { return {}; } };

const jsDir = path.join(ROOT, 'js');
const load = (f) => require(path.join(jsDir, f + '.js'));
const extra = (re) => fs.readdirSync(jsDir).filter((f) => re.test(f)).map((f) => f.replace(/\.js$/, '')).sort();
['data-kana', 'data-words', 'data-words-extra', ...extra(/^data-words-(?!extra)/), 'data-word-levels', 'data-grammar', ...extra(/^data-grammar-/), 'core', 'curriculum', 'achievements'].forEach(load);
const JP = window.JP;
let listening = true;
JP.tts = { ok: true, hasJa: true, can: () => listening, list: () => [], current: () => null, cancel() {}, speak() {} };
JP.ui = { speakBtn: () => '', ICON: {} };
load('questions');
load('bank');
const bankLevels = fs.readdirSync(jsDir).filter((f) => /^bank-.+\.js$/.test(f)).map((f) => f.replace(/^bank-|\.js$/g, ''));
bankLevels.forEach((id) => { load('bank-' + id); JP.bank.register(id); });
const Q = JP.Q;

const problems = [];
const seen = new Set();
const bad = (m) => { if (!seen.has(m)) { seen.add(m); problems.push(m); } };
const plain = (s) => String(s).replace(/<[^>]*>/g, '');

function check(q, where) {
  if (!q) return bad(`${where}: 題目為空`);
  if (q.type === 'choice') {
    const cs = q.choices || [];
    if (cs.length < 2) bad(`${where}/${q.sub}: 選項少於 2 個`);
    if (cs.filter((c) => c.correct).length !== 1) bad(`${where}/${q.sub}: 正確答案不是剛好一個（${q.stem || q.itemId || ''}）`);
    const keys = cs.map((c) => c.key);
    if (new Set(keys).size !== keys.length) bad(`${where}/${q.sub}: 選項 key 重複 ${q.itemId || q.stem || ''}`);
    const texts = cs.map((c) => plain(c.html));
    if (new Set(texts).size !== texts.length) bad(`${where}/${q.sub}: 選項文字重複 ${texts.join(' / ')}`);
    // 聽音、讀音、羅馬拼音題：正確答案的讀音不能和任何干擾選項相同（否則會有兩個答案）
    if (/^(listen2jp|listen2zh|listen2pic|jp2ro|ro2jp|jp2rd|listen2ro)$/.test(q.sub)) {
      const right = cs.find((c) => c.correct);
      const ri = right && JP.item(right.key);
      if (ri && ri.kind === 'word') {
        cs.filter((c) => !c.correct).forEach((c) => { const o = JP.item(c.key); if (o && o.kind === 'word' && o.rd === ri.rd) bad(`${where}/${q.sub}: 干擾選項與答案同音 ${ri.jp}/${o.jp}`); });
      }
    }
  } else if (q.type === 'order') {
    const have = (q.tiles || []).map((t) => JP.plain(t.t));
    const need = {};
    q.answer.forEach((a) => { need[a] = (need[a] || 0) + 1; });
    have.forEach((h) => { if (need[h]) need[h]--; });
    if (Object.values(need).some((n) => n > 0)) bad(`${where}/${q.sub}: 字塊不足以排出答案 ${q.answer.join('')}`);
  } else if (q.type === 'type') {
    if (!q.accept) bad(`${where}/${q.sub}: 沒有可接受的答案`);
  } else if (q.type === 'match') {
    const ids = (q.pairs || []).map((p) => p.id);
    if (ids.length < 3 || new Set(ids).size !== ids.length) bad(`${where}/match: 配對 id 不足或重複`);
  }
}

for (const mode of [true, false]) {
  listening = mode;
  const tag = mode ? '有聽力' : '無聽力';
  const bankGroups = bankLevels.flatMap((id) => JP.bank.get(id).groups).filter((_, i) => i % 6 === 0); // 單字庫組數多，抽樣檢查
  for (const n of JP.NODES.concat(bankGroups)) {
    if (n.type === 'info') continue;
    for (let k = 0; k < 4; k++) {
      let qs;
      try {
        if (n.type === 'boss') qs = Q.planBoss(n);
        else if (n.type === 'grammar') qs = Q.grammarQs(JP.gmap.get(n.gid), 10, k % 2);
        else qs = Q.planLesson(n.items, { level: k % 3, easy: !!n.easy });
      } catch (e) { bad(`${n.id} (${tag}): 丟出例外 ${e.message}`); continue; }
      if (!qs || !qs.length) { bad(`${n.id} (${tag}): 沒有題目`); continue; }
      qs.forEach((q) => check(q, `${n.id} (${tag})`));
    }
  }
  // 每個項目 × 每種題型
  const subs = Object.keys(Q.B || {});
  const rdCount = {};
  JP.itemList('word').forEach((it) => { rdCount[it.rd] = (rdCount[it.rd] || 0) + 1; });
  JP.itemList().forEach((it) => {
    const rounds = it.bank ? 1 : it.kind === 'word' && rdCount[it.rd] > 1 ? 40 : 3; // 有同音字的單字多抽幾次；單字庫字數多，每字只抽一次
    for (let k = 0; k < rounds; k++) {
      for (const s of (subs.length ? subs : [])) {
        let q;
        try { q = Q.build(it, s); } catch (e) { bad(`${it.id}/${s} (${tag}): 丟出例外 ${e.message}`); continue; }
        if (q) check(q, `${it.id} (${tag})`);
      }
    }
  });
}

const nWords = JP.itemList('word').length;
console.log(`世界 ${JP.WORLDS.length}、關卡 ${JP.NODES.length}、單字 ${nWords}（含單字庫 ${JP.itemList('word').filter((w) => w.bank).length}）、文法 ${JP.GRAMMAR.length}`);
if (problems.length) { console.log(`發現 ${problems.length} 個問題：`); problems.slice(0, 60).forEach((p) => console.log(' -', p)); process.exit(1); }
console.log('冒煙測試通過 ✓');
