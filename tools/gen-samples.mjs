// 產生「語音試聽樣本」：用同一組句子錄好幾種日語語音，放進 audio-samples/ 並產生 voice-samples.html，
// 打開網站上的 /voice-samples.html 就能用耳朵比較，再決定要用哪個語音重錄全部音檔。
// 用法：GOOGLE_TTS_KEY=... node tools/gen-samples.mjs        （自動挑選 Chirp 3 HD、Neural2 等日語語音）
//       VOICES=ja-JP-Chirp3-HD-Aoede,ja-JP-Neural2-B GOOGLE_TTS_KEY=... node tools/gen-samples.mjs
//       MOCK=1 node tools/gen-samples.mjs                      （不呼叫 Google，只產生靜音檔測試流程）
// 樣本很少（8 句 × 約 12 種語音，約 3,000 字元），遠低於每月免費額度。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'audio-samples');
const KEY = process.env.GOOGLE_TTS_KEY || '';
const MOCK = /^(1|true)$/i.test(process.env.MOCK || '');
const MAX_VOICES = Number(process.env.MAX_VOICES || 12);

const SENTENCES = [
  'こんにちは。にほんごを べんきょう しましょう。',
  '私は学生です。',
  '今日はとてもいい天気ですね。散歩に行きませんか。',
  '駅で待ち合わせをしましょう。',
  'すみません、トイレはどこですか。',
  '昨日の夜、友達と一緒に映画を見に行きました。',
  '一、二、三、四、五、六、七、八、九、十。',
  '会議が長引いたので、約束の時間に間に合いませんでした。',
];

async function listVoices() {
  const r = await fetch(`https://texttospeech.googleapis.com/v1/voices?languageCode=ja-JP&key=${KEY}`);
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 300));
  return (j.voices || []).map((v) => ({ name: v.name, gender: v.ssmlGender }));
}
// 越新的語音越前面：Chirp 3 HD → Studio → Neural2 → 其他
const rank = (n) => (/Chirp3-HD/.test(n) ? 0 : /Studio/.test(n) ? 1 : /Neural2/.test(n) ? 2 : /Wavenet/i.test(n) ? 3 : 4);

async function synth(text, voice) {
  if (MOCK) return Buffer.alloc(0);
  const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: { text }, voice: { languageCode: 'ja-JP', name: voice }, audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 24000 } }),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
  return Buffer.from((await r.json()).audioContent, 'base64');
}

async function main() {
  if (!MOCK && !KEY) throw new Error('請設定環境變數 GOOGLE_TTS_KEY');
  let voices;
  if (process.env.VOICES) voices = process.env.VOICES.split(',').map((s) => ({ name: s.trim(), gender: '' })).filter((v) => v.name);
  else if (MOCK) voices = [{ name: 'ja-JP-Mock-A', gender: 'FEMALE' }];
  else {
    const all = await listVoices();
    // 每種語音系列各取幾個，避免全是同一系列
    const per = {};
    voices = all.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)).filter((v) => { const k = rank(v.name); per[k] = (per[k] || 0) + 1; return per[k] <= (k === 0 ? 8 : 4); }).slice(0, MAX_VOICES);
  }
  console.log('試聽語音：', voices.map((v) => v.name).join(', '));
  fs.rmSync(OUT, { recursive: true, force: true });
  const done = [];
  for (const v of voices) {
    const dir = path.join(OUT, v.name);
    fs.mkdirSync(dir, { recursive: true });
    try {
      for (let i = 0; i < SENTENCES.length; i++) fs.writeFileSync(path.join(dir, `${i + 1}.mp3`), await synth(SENTENCES[i], v.name));
      done.push(v);
      console.log('  完成', v.name);
    } catch (e) { fs.rmSync(dir, { recursive: true, force: true }); console.log('  略過', v.name, '：', e.message); }
  }
  if (!done.length) throw new Error('沒有任何語音成功產生');
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>日語語音試聽</title>
<style>body{font-family:system-ui,"Noto Sans TC",sans-serif;background:#f6efe2;color:#2b2420;margin:0;padding:16px 16px 60px}main{max-width:820px;margin:0 auto}h1{margin:.4em 0}p.n{color:#6b5f55}
.v{background:#fffaf1;border:2px solid #e3d6bf;border-radius:16px;padding:12px 16px;margin:14px 0}.v h2{font-size:1.05rem;margin:.2em 0 .6em}.v small{color:#6b5f55;font-weight:600;margin-left:8px}
.s{display:grid;grid-template-columns:1fr minmax(180px,260px);gap:10px;align-items:center;padding:6px 0;border-top:1px solid #e3d6bf}.s span{font-size:.95rem}audio{width:100%;height:34px}
@media (max-width:560px){.s{grid-template-columns:1fr}}</style></head><body><main>
<h1>日語語音試聽</h1><p class="n">同樣的 ${SENTENCES.length} 句話，用不同語音念。每個語音依序聽，挑一個最像真人、最自然的，把語音名稱（粗體字）告訴我。</p>
${done.map((v) => `<section class="v"><h2>${esc(v.name)}<small>${esc(v.gender)}</small></h2>${SENTENCES.map((t, i) => `<div class="s"><span lang="ja">${esc(t)}</span><audio controls preload="none" src="audio-samples/${encodeURIComponent(v.name)}/${i + 1}.mp3"></audio></div>`).join('')}</section>`).join('\n')}
</main></body></html>
`;
  fs.writeFileSync(path.join(ROOT, 'voice-samples.html'), html);
  console.log(`已產生 voice-samples.html 與 audio-samples/（${done.length} 種語音）`);
}
main().catch((e) => { console.error('錯誤：' + e.message); process.exit(1); });
