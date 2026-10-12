#!/usr/bin/env node
/* 預錄日語語音檔（一次性）
   讀取網站的單字／假名／例句，用 Google Cloud Text-to-Speech 產生 mp3 放到 audio/，
   並寫出 audio/manifest.json（文字 → 檔名）。網站載入後會優先播放這些音檔，找不到才用裝置語音。

   用法：
     GOOGLE_TTS_KEY=xxxx node tools/gen-audio.mjs          產生（只補還沒有的檔案）
     DRY_RUN=1 node tools/gen-audio.mjs                     只計算字數與費用估計，不呼叫 Google
     LIST_VOICES=1 GOOGLE_TTS_KEY=xxxx node tools/gen-audio.mjs   列出可用的日語語音
     MOCK=1 node tools/gen-audio.mjs                         測試用：產生靜音檔，不呼叫 Google
   環境變數：VOICE（預設 ja-JP-Neural2-B）、MAX_CHARS（字元上限，預設 60000，超過就中止）、SLOW=0 可不產生慢速版 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'audio');
const KEY = process.env.GOOGLE_TTS_KEY || '';
const VOICE = process.env.VOICE || 'ja-JP-Neural2-B';
const DRY = /^(1|true)$/i.test(process.env.DRY_RUN || '');
const MOCK = /^(1|true)$/i.test(process.env.MOCK || '');
const WITH_SLOW = process.env.SLOW !== '0';
const MAX_CHARS = Number(process.env.MAX_CHARS || 60000);
const RATE = { normal: 0.95, slow: 0.65 };

async function listVoices() {
  const r = await fetch(`https://texttospeech.googleapis.com/v1/voices?languageCode=ja-JP&key=${KEY}`);
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  (j.voices || []).forEach((v) => console.log(v.name, v.ssmlGender));
}

/* ───── 從網站資料取出所有會被播放的文字 ───── */
function loadData() {
  const sandbox = { window: {}, console };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  for (const f of ['data-kana', 'data-words', 'data-grammar']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), sandbox, { filename: f });
  }
  return sandbox.window.JP;
}
const plain = (s) => String(s).replace(/\|/g, '').replace(/\{[^}]*\}/g, '');

function collectTexts() {
  const JP = loadData();
  const set = new Set();
  const K = JP.KANA;
  [K.hiraBasic, K.hiraDakuten, K.kataBasic, K.kataDakuten].forEach((list) => list.forEach(([ch, , word]) => { set.add(ch); set.add(word); }));
  K.yoonRows.forEach(([ch]) => { set.add(ch); set.add(K.toKata(ch)); });
  JP.LESSONS.forEach((l) => l.words.forEach(([jp, rd, , , ex]) => { set.add(rd || jp); if (ex) set.add(plain(ex)); }));
  JP.GRAMMAR.forEach((g) => {
    g.examples.forEach(([s]) => set.add(plain(s)));
    g.quiz.forEach(([stem, ans]) => set.add(stem.replace(/（.*?）\s*$/, '').replace(/＿+/g, ans)));
  });
  set.add('こんにちは。にほんごを べんきょう しましょう。');
  return Array.from(set).filter(Boolean).sort();
}

/* ───── 合成 ───── */
// 最小的靜音 mp3（測試模式用）
const SILENT_MP3 = Buffer.from('SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//OEwAAAAAAAAAAAAEluZm8AAAAPAAAAEQAAA/AAPDw8PDxJSUlJSUlVVVVVVVVhYWFhYWFtbW1tbW15eXl5eXmGhoaGhoaSkpKSkpKenp6enqqqqqqqqra2tra2tsPDw8PDw8/Pz8/Pz9vb29vb2+fn5+fn5/Pz8/Pz8///////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQDMAAAAAAAAAPwXIBFZwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//MkxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//MkxCMAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//MkxEYAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//MkxGkAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//MkxIwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//MkxK8AAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//MkxNIAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//MkxNwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//MkxNwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//MkxNwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBV//MkxNwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MkxNwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MkxNwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MkxNwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MkxNwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MkxNwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MkxNwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV', 'base64');

async function synth(text, rate) {
  if (MOCK) return SILENT_MP3;
  const body = {
    input: { text },
    voice: { languageCode: 'ja-JP', name: VOICE },
    audioConfig: { audioEncoding: 'MP3', speakingRate: rate, sampleRateHertz: 24000 },
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (r.ok) return Buffer.from((await r.json()).audioContent, 'base64');
    const msg = await r.text();
    if (r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 1000 * attempt)); continue; }
    throw new Error(`Google TTS ${r.status}: ${msg.slice(0, 300)}`);
  }
  throw new Error('Google TTS 重試多次仍失敗');
}

const fileFor = (text, kind) => crypto.createHash('sha1').update(`${VOICE}|${RATE[kind]}|${text}`).digest('hex').slice(0, 16) + (kind === 'slow' ? '-s' : '') + '.mp3';

async function main() {
  if (process.env.LIST_VOICES) { if (!KEY) throw new Error('請設定 GOOGLE_TTS_KEY'); return listVoices(); }
  const texts = collectTexts();
  const kinds = WITH_SLOW ? ['normal', 'slow'] : ['normal'];
  fs.mkdirSync(OUT, { recursive: true });
  const mpath = path.join(OUT, 'manifest.json');
  const old = fs.existsSync(mpath) ? JSON.parse(fs.readFileSync(mpath, 'utf8')) : { normal: {}, slow: {} };
  const manifest = { version: 1, voice: VOICE, normal: {}, slow: {} };
  const todo = [];
  let totalChars = 0, newChars = 0;
  for (const kind of kinds) {
    for (const t of texts) {
      const f = fileFor(t, kind);
      manifest[kind][t] = f;
      totalChars += t.length;
      if (!fs.existsSync(path.join(OUT, f))) { todo.push({ t, kind, f }); newChars += t.length; }
    }
  }
  console.log(`文字 ${texts.length} 句 × ${kinds.length} 種速度；總字元 ${totalChars}，需新產生 ${todo.length} 個檔案（${newChars} 字元）。語音：${VOICE}`);
  console.log(`（Neural2／WaveNet 語音每月免費額度約 100 萬字元，請以 Google 官方價目為準；本次約佔 ${(newChars / 10000).toFixed(1)}%）`);
  if (DRY) { console.log('DRY_RUN：不呼叫 Google，結束。'); return; }
  if (newChars > MAX_CHARS) throw new Error(`新字元數 ${newChars} 超過上限 MAX_CHARS=${MAX_CHARS}，已中止以避免意外費用`);
  if (!MOCK && !KEY) throw new Error('請設定環境變數 GOOGLE_TTS_KEY');
  let n = 0;
  for (const { t, kind, f } of todo) {
    fs.writeFileSync(path.join(OUT, f), await synth(t, RATE[kind]));
    n++;
    if (n % 25 === 0) console.log(`  已完成 ${n}/${todo.length}`);
    if (!MOCK) await new Promise((res) => setTimeout(res, 60));
  }
  void old;
  fs.writeFileSync(mpath, JSON.stringify(manifest));
  // 清掉不再被 manifest 引用的舊檔
  const used = new Set([...Object.values(manifest.normal), ...Object.values(manifest.slow)]);
  let removed = 0;
  fs.readdirSync(OUT).filter((x) => x.endsWith('.mp3') && !used.has(x)).forEach((x) => { fs.unlinkSync(path.join(OUT, x)); removed++; });
  const bytes = fs.readdirSync(OUT).reduce((s, x) => s + fs.statSync(path.join(OUT, x)).size, 0);
  console.log(`完成：新增 ${todo.length} 個、移除 ${removed} 個舊檔，audio/ 共 ${(bytes / 1048576).toFixed(1)} MB`);
}
main().catch((e) => { console.error('錯誤：' + e.message); process.exit(1); });
