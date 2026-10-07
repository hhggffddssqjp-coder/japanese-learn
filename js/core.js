/* core.js — 工具、進度儲存、等級／連勝、間隔重複、語音與音效 */
(function () {
  'use strict';
  const JP = (window.JP = window.JP || {});

  /* ───────────── 小工具 ───────────── */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const sample = (a, n) => shuffle(a).slice(0, n);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDay = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (key, n) => { const d = parseDay(key); d.setDate(d.getDate() + n); return dayKey(d); };
  const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5);

  /* ───────────── 文字處理 ───────────── */
  // 「漢字{よみ}」→ <ruby>
  function ruby(s, furi) {
    if (furi === undefined) furi = JP.S.set.furi;
    let h = esc(s).replace(/\|/g, '');
    h = h.replace(/([㐀-鿿々〆]+)\{([^}]+)\}/g, furi ? '<ruby>$1<rt>$2</rt></ruby>' : '$1');
    return h.replace(/[{}]/g, '');
  }
  const plain = (s) => String(s).replace(/\|/g, '').replace(/\{[^}]*\}/g, '');
  const reading = (s) => String(s).replace(/\|/g, '').replace(/[㐀-鿿々〆]+\{([^}]+)\}/g, '$1');
  const PUNCT = /^[。、？！，．・]+$/;
  const tokensOf = (s) => String(s).split('|').filter((t) => t && !PUNCT.test(t));

  /* 羅馬拼音轉換（平文式） */
  const R = {};
  const addR = (rows) => rows.forEach(([k, r]) => { R[k] = r; });
  (function buildRomaji() {
    const K = JP.KANA;
    addR(K.hiraBasic.map(([k, r]) => [k, r]));
    addR(K.hiraDakuten.map(([k, r]) => [k, r]));
    addR([['ぁ', 'a'], ['ぃ', 'i'], ['ぅ', 'u'], ['ぇ', 'e'], ['ぉ', 'o'], ['ゃ', 'ya'], ['ゅ', 'yu'], ['ょ', 'yo'], ['ゔ', 'vu'], ['ゐ', 'i'], ['ゑ', 'e']]);
    addR(K.yoonRows.map(([k, r]) => [k, r]));
    addR([['ふぁ', 'fa'], ['ふぃ', 'fi'], ['ふぇ', 'fe'], ['ふぉ', 'fo'], ['てぃ', 'ti'], ['でぃ', 'di'], ['うぃ', 'wi'], ['うぇ', 'we'], ['うぉ', 'wo'], ['しぇ', 'she'], ['じぇ', 'je'], ['ちぇ', 'che'], ['ゔぁ', 'va'], ['ゔぃ', 'vi'], ['ゔぇ', 've'], ['ゔぉ', 'vo']]);
  })();
  const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  function toRomaji(str) {
    const k = toHira(str);
    let out = '', i = 0, sok = false, last = '';
    while (i < k.length) {
      const c = k[i];
      if (c === 'っ') { sok = true; i++; continue; }
      if (c === 'ー') { out += last; i++; continue; }
      let r, w;
      if (R[k.slice(i, i + 2)] && k.length > i + 1) { r = R[k.slice(i, i + 2)]; w = 2; }
      else if (R[c]) { r = R[c]; w = 1; }
      else { out += c; i++; continue; }
      if (sok) { r = r.startsWith('ch') ? 't' + r : r[0] + r; sok = false; }
      if (c === 'ん' && /[あいうえおやゆよ]/.test(k[i + 1] || '')) r = "n'";
      out += r; last = r.slice(-1); i += w;
    }
    return out;
  }
  // 輸入比對：忽略大小寫、空白、長音差異與訓令式寫法
  function normRo(s) {
    s = String(s).toLowerCase().replace(/[\s'’\-·・]/g, '');
    s = s.replace(/ā/g, 'a').replace(/ī/g, 'i').replace(/ū/g, 'u').replace(/ē/g, 'e').replace(/ō/g, 'o');
    const map = [['sya', 'sha'], ['syu', 'shu'], ['syo', 'sho'], ['tya', 'cha'], ['tyu', 'chu'], ['tyo', 'cho'], ['zya', 'ja'], ['zyu', 'ju'], ['zyo', 'jo'], ['dya', 'ja'], ['dyu', 'ju'], ['dyo', 'jo'], ['jya', 'ja'], ['jyu', 'ju'], ['jyo', 'jo'], ['si', 'shi'], ['ti', 'chi'], ['tu', 'tsu'], ['hu', 'fu'], ['zi', 'ji'], ['di', 'ji'], ['du', 'zu']];
    map.forEach(([a, b]) => { s = s.split(a).join(b); });
    s = s.replace(/ou/g, 'o').replace(/([aeiou])\1+/g, '$1');
    return s;
  }

  /* ───────────── 進度儲存 ───────────── */
  const KEY = 'jpl.v2';
  const defaults = () => ({
    v: 2, onboarded: false,
    xp: 0, streak: 0, bestStreak: 0, lastDay: null, freezes: 1, frozen: [], days: {}, goal: 50,
    nodes: {}, unlocked: 0,
    cards: {},
    stats: { answered: 0, correct: 0, listening: 0, bestCombo: 0, lessons: 0, perfects: 0, blitz: 0, reviews: 0, bossWins: 0 },
    ach: {}, stamps: {},
    set: { sound: true, haptic: true, voice: '', slow: false, auto: true, romaji: true, furi: true, theme: 'auto' },
  });
  function loadState() {
    const d = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const o = JSON.parse(raw);
        Object.assign(d, o);
        d.set = Object.assign(defaults().set, o.set || {});
        d.stats = Object.assign(defaults().stats, o.stats || {});
      } else {
        // 從舊版（v1）帶入經驗值與連續天數
        const old = JSON.parse(localStorage.getItem('jpl.v1') || 'null');
        if (old && typeof old.xp === 'number') {
          d.xp = old.xp; d.streak = old.streak || 0; d.lastDay = old.lastDay || null;
          d.goal = [30, 50, 100].includes(old.goal) ? old.goal : 50;
          if (old.theme) d.set.theme = old.theme;
        }
      }
    } catch (e) { /* 壞掉的資料就用預設值 */ }
    return d;
  }
  const S = loadState();
  JP.S = S;
  let saveTimer = 0;
  function save(opt) {
    S.mt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 隱私模式略過 */ }
    JP.emit && JP.emit('saved', opt);
  }
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 250); }
  window.addEventListener('pagehide', () => save({ noSync: true }));

  /* ───────────── 等級、經驗值、連勝 ───────────── */
  const needFor = (lv) => 100 + 25 * (lv - 1);
  const xpAt = (lv) => 100 * (lv - 1) + (25 * (lv - 1) * (lv - 2)) / 2;
  function levelInfo(xp = S.xp) {
    let lv = 1;
    while (xp >= xpAt(lv + 1)) lv++;
    const cur = xp - xpAt(lv), need = needFor(lv);
    return { level: lv, cur, need, pct: Math.round((cur / need) * 100) };
  }
  const RANKS = [
    [1, '初心者', 'しょしんしゃ'], [3, '見習い', 'みならい'], [5, '旅人', 'たびびと'], [8, '勉強家', 'べんきょうか'],
    [12, '達人', 'たつじん'], [16, '先輩', 'せんぱい'], [20, '師範', 'しはん'], [25, '日本通', 'にほんつう'],
    [30, '先生', 'せんせい'], [40, '名人', 'めいじん'], [50, '仙人', 'せんにん'],
  ];
  const rankOf = (lv) => RANKS.filter((r) => lv >= r[0]).pop();

  const dailyXP = () => S.days[dayKey()] || 0;
  const streakAlive = () => {
    if (!S.lastDay) return false;
    const gap = daysBetween(S.lastDay, dayKey());
    return gap <= 1 + S.freezes;
  };
  const streakDisplay = () => (streakAlive() ? S.streak : 0);
  const doneToday = () => S.lastDay === dayKey();

  function touchDay() {
    const today = dayKey();
    if (S.lastDay === today) return { first: false, froze: 0 };
    let froze = 0;
    if (!S.lastDay) S.streak = 1;
    else {
      const gap = daysBetween(S.lastDay, today);
      if (gap === 1) S.streak++;
      else {
        const missed = gap - 1;
        if (missed <= S.freezes) {
          S.freezes -= missed; froze = missed;
          for (let i = 1; i <= missed; i++) S.frozen.push(addDays(S.lastDay, i));
          S.frozen = S.frozen.slice(-30);
          S.streak++;
        } else S.streak = 1;
      }
    }
    S.lastDay = today;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
    if (S.streak > 0 && S.streak % 7 === 0 && S.freezes < 2) S.freezes++;
    return { first: true, froze };
  }

  // 加經驗值；回傳 {leveledUp, level, firstToday, froze}
  function addXP(n) {
    const before = levelInfo().level;
    const day = touchDay();
    const today = dayKey();
    S.days[today] = (S.days[today] || 0) + n;
    // 只保留近 120 天
    const keys = Object.keys(S.days).sort();
    if (keys.length > 120) keys.slice(0, keys.length - 120).forEach((k) => delete S.days[k]);
    S.xp += n;
    save();
    const after = levelInfo().level;
    JP.emit && JP.emit('xp');
    return { leveledUp: after > before, level: after, firstToday: day.first, froze: day.froze };
  }

  /* ───────────── 間隔重複（SRS） ───────────── */
  const INTERVALS = [0, 1, 2, 4, 8, 16, 32, 64];
  const MAX_BOX = INTERVALS.length - 1;
  const card = (id) => S.cards[id];
  function review(id, ok) {
    const today = dayKey();
    let c = S.cards[id];
    if (!c) c = S.cards[id] = { box: 0, due: today, seen: 0, ok: 0, ng: 0, lapses: 0, first: today };
    c.seen++;
    if (ok) {
      c.ok++;
      c.box = Math.min(MAX_BOX, c.box + 1);
      c.due = addDays(today, INTERVALS[c.box]);
    } else {
      c.ng++; c.lapses++;
      c.box = Math.max(0, c.box - 2);
      c.due = today;
    }
    saveSoon();
    return c;
  }
  function seed(id, box = 2) {
    if (S.cards[id]) return;
    const today = dayKey();
    S.cards[id] = { box, due: addDays(today, 1 + Math.floor(Math.random() * 4)), seen: 1, ok: 1, ng: 0, lapses: 0, first: today };
  }
  const dueIds = () => { const t = dayKey(); return Object.keys(S.cards).filter((id) => S.cards[id].due <= t && JP.ITEMS.has(id)); };
  const weakIds = () => Object.keys(S.cards).filter((id) => { const c = S.cards[id]; return JP.ITEMS.has(id) && (c.ng > c.ok || (c.lapses >= 2 && c.box <= 3)); });
  const learnedIds = () => Object.keys(S.cards).filter((id) => JP.ITEMS.has(id));

  /* ───────────── 事件 ───────────── */
  const listeners = {};
  JP.on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
  JP.emit = (ev, data) => (listeners[ev] || []).forEach((f) => f(data));

  /* ───────────── 語音（Web Speech API） ───────────── */
  const hasTTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let voices = [];
  const tts = {
    ok: hasTTS, hasJa: false,
    refresh() {
      if (!hasTTS) return;
      voices = speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang));
      // 偏好品質較好的語音
      const rank = (v) => (/Kyoko|Nanami|Haruka|Ayumi|O-Ren|Siri|Premium|Enhanced|Google/i.test(v.name) ? 0 : 1) + (v.localService ? 0.5 : 0);
      voices.sort((a, b) => rank(a) - rank(b));
      tts.hasJa = voices.length > 0;
      JP.emit('voices');
    },
    list() { return voices; },
    current() { return voices.find((v) => v.name === S.set.voice) || voices[0] || null; },
    cancel() { if (hasTTS) speechSynthesis.cancel(); },
    speak(text, opts = {}) {
      return new Promise((resolve) => {
        if (!hasTTS || !text) return resolve(false);
        try {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'ja-JP';
          const v = tts.current();
          if (v) u.voice = v;
          const slow = opts.slow !== undefined ? opts.slow : S.set.slow;
          u.rate = slow ? 0.6 : 0.95;
          u.pitch = 1.05;
          let done = false;
          const fin = (r) => { if (!done) { done = true; resolve(r); } };
          u.onend = () => fin(true);
          u.onerror = () => fin(false);
          setTimeout(() => fin(false), 8000);
          speechSynthesis.speak(u);
        } catch (e) { resolve(false); }
      });
    },
  };
  if (hasTTS) {
    tts.refresh();
    try { speechSynthesis.addEventListener('voiceschanged', tts.refresh); } catch (e) { speechSynthesis.onvoiceschanged = tts.refresh; }
  }
  JP.tts = tts;

  /* ───────────── 音效（WebAudio 合成，不需音檔） ───────────── */
  let actx = null;
  function ctx() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { actx = new AC(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, t0, dur, type = 'sine', vol = 0.12) {
    const c = ctx();
    if (!c || !S.set.sound) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    const t = c.currentTime + t0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, A4: 440, E4: 329.63, G4: 392 };
  const sfx = {
    unlock() { ctx(); },
    tap() { tone(520, 0, 0.05, 'triangle', 0.05); },
    correct() { tone(N.E5, 0, 0.12, 'triangle', 0.14); tone(N.A5, 0.09, 0.2, 'triangle', 0.14); },
    wrong() { tone(196, 0, 0.18, 'sawtooth', 0.07); tone(146.8, 0.12, 0.28, 'sawtooth', 0.07); },
    combo(n) { const base = Math.min(n, 8) * 40; tone(N.C5 + base, 0, 0.08, 'square', 0.05); tone(N.E5 + base, 0.07, 0.08, 'square', 0.05); tone(N.G5 + base, 0.14, 0.16, 'square', 0.05); },
    done() { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.13)); tone(N.E6, 0.5, 0.5, 'triangle', 0.1); },
    fail() { [N.G4, N.E4, 261.6].forEach((f, i) => tone(f, i * 0.16, 0.3, 'sine', 0.12)); },
    level() { [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6].forEach((f, i) => tone(f, i * 0.07, 0.25, 'square', 0.06)); tone(N.E6, 0.5, 0.6, 'triangle', 0.1); },
  };
  JP.sfx = sfx;
  const buzz = (ms) => { if (S.set.haptic && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* 略過 */ } };
  JP.buzz = buzz;

  Object.assign(JP, {
    esc, shuffle, sample, pick, clamp, dayKey, addDays, daysBetween, parseDay,
    ruby, plain, reading, tokensOf, toRomaji, normRo, toHira,
    save, saveSoon, defaults, levelInfo, xpAt, needFor, rankOf, RANKS,
    dailyXP, streakAlive, streakDisplay, doneToday, addXP,
    review, seed, card, dueIds, weakIds, learnedIds, INTERVALS, MAX_BOX,
  });
})();
