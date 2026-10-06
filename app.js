/* にほんご — 日語學習 App 主程式（無需建置，純前端） */
(function () {
  'use strict';

  const D = window.DATA;
  const app = document.getElementById('app');

  /* ---------- 小工具 ---------- */
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
  // 單字圖例貼紙（資料在 illust.js）
  const ILL = window.ILLUST || {};
  const pic = (v, size) => {
    const g = ILL[v.id] || '🌸';
    return `<span class="sticker ${size || 'm'}${/^\d+$/.test(g) ? ' txt' : ''}" data-cat="${v.cat}" aria-hidden="true">${g}</span>`;
  };
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (key, n) => {
    const [y, m, d] = key.split('-').map(Number);
    return dayKey(new Date(y, m - 1, d + n));
  };

  /* ---------- 進度儲存 ---------- */
  const KEY = 'jpl.v1';
  const defaults = () => ({
    xp: 0, streak: 0, lastDay: null,
    daily: { day: null, xp: 0 }, goal: 50, newPerDay: 10,
    cards: {}, newToday: { day: null, count: 0 },
    kana: {}, lessons: {}, theme: 'auto', romaji: true,
  });
  const load = () => {
    try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return defaults(); }
  };
  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 隱私模式等情況略過 */ } };

  const level = () => Math.floor(S.xp / 100) + 1;
  const dailyXP = () => (S.daily.day === dayKey() ? S.daily.xp : 0);
  const newToday = () => (S.newToday.day === dayKey() ? S.newToday.count : 0);

  function addXP(n) {
    const today = dayKey();
    if (S.daily.day !== today) S.daily = { day: today, xp: 0 };
    S.daily.xp += n;
    S.xp += n;
    if (S.lastDay !== today) {
      S.streak = S.lastDay === addDays(today, -1) ? S.streak + 1 : 1;
      S.lastDay = today;
    }
    save();
    updateHeader();
  }

  function updateHeader() {
    // 超過一天沒學習時，顯示的連續天數歸零（實際在下次學習時重算）
    const alive = S.lastDay === dayKey() || S.lastDay === addDays(dayKey(), -1);
    document.getElementById('h-streak').textContent = alive ? S.streak : 0;
    document.getElementById('h-level').textContent = level();
  }

  function applyTheme() {
    if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', S.theme);
  }

  /* ---------- 語音與提示 ---------- */
  const hasTTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let jaVoice = null;
  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    jaVoice = vs.find((v) => /^ja[-_]JP$/i.test(v.lang)) || vs.find((v) => /^ja/i.test(v.lang)) || null;
  }
  if (hasTTS) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function speak(text) {
    if (!hasTTS) return toast('這個瀏覽器不支援語音播放');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    if (jaVoice) u.voice = jaVoice;
    u.rate = 0.85;
    speechSynthesis.speak(u);
    if (!jaVoice) toast('找不到日語語音，發音可能不準確');
  }

  /* ---------- 單字與間隔重複 ---------- */
  const INTERVALS = [0, 1, 2, 4, 8, 16, 32]; // 各階段的複習間隔（天）
  const vocabById = new Map(D.vocab.map((v) => [v.id, v]));

  const dueCards = () => {
    const t = dayKey();
    return D.vocab.filter((v) => S.cards[v.id] && S.cards[v.id].due <= t);
  };
  const freshCards = (limit) => D.vocab.filter((v) => !S.cards[v.id]).slice(0, limit);
  const newRemaining = () => Math.max(0, S.newPerDay - newToday());

  function rateCard(v, r) {
    const today = dayKey();
    let c = S.cards[v.id];
    if (!c) {
      c = S.cards[v.id] = { box: 0, due: today, seen: 0, lapses: 0 };
      S.newToday = { day: today, count: newToday() + 1 };
    }
    c.seen++;
    if (r === 0) {
      c.box = 0; c.lapses++; c.due = today;
    } else {
      c.box = Math.min(INTERVALS.length - 1, c.box + (r === 2 ? 2 : 1));
      c.due = addDays(today, INTERVALS[c.box]);
    }
    save();
  }

  /* ---------- 五十音資料整理 ---------- */
  const ALL_SETS = ['basic', 'dakuten', 'yoon'];
  function kanaPool(sets, scripts) {
    const out = [];
    scripts.forEach((script) => sets.forEach((s) => D.kana[s].forEach((r) => r.forEach((c) => {
      if (c) out.push({ ch: script === 'hira' ? c[0] : D.toKata(c[0]), ro: c[1], script });
    }))));
    return out;
  }
  const kanaStat = (ch) => S.kana[ch] || { c: 0, w: 0 };
  const kanaMastered = (ch) => { const k = kanaStat(ch); return k.c >= 3 && k.c / (k.c + k.w) >= 0.8; };

  /* ---------- 路由 ---------- */
  let cleanup = null; // 切換頁面時要執行的清理（例如移除鍵盤監聽）

  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    if (hasTTS) speechSynthesis.cancel();
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const [name = 'home', sub, arg] = parts;
    const views = {
      home: () => viewHome(),
      kana: () => (sub === 'quiz' ? viewKanaSetup() : viewKana()),
      vocab: () => (sub === 'study' ? viewStudy(false) : sub === 'more' ? viewStudy(true) : sub === 'quiz' ? viewVocabSetup() : viewVocab()),
      grammar: () => (sub ? viewLesson(decodeURIComponent(sub)) : viewGrammar()),
      me: () => viewMe(),
    };
    (views[name] || views.home)();
    document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (views[name] ? name : 'home')));
    window.scrollTo(0, 0);
    void arg;
  }

  /* ---------- 首頁 ---------- */
  function greeting() {
    const h = new Date().getHours();
    if (h < 11) return 'おはようございます — 早安！';
    if (h < 18) return 'こんにちは — 午安！';
    return 'こんばんは — 晚安！';
  }

  function viewHome() {
    const due = dueCards().length;
    const fresh = Math.min(newRemaining(), freshCards(99).length);
    const pct = Math.min(100, Math.round((dailyXP() / S.goal) * 100));
    const nextLesson = D.grammar.find((g) => !S.lessons[g.id]);
    const weak = Object.entries(S.kana).filter(([, k]) => k.w > k.c).length;
    app.innerHTML = `
      <section class="card hero">
        <img class="mascot" src="icon.svg" alt="" width="84" height="84">
        <div class="hero-t">
          <p class="muted" style="margin-bottom:2px">${greeting()}</p>
          <h1>今天也學一點日語吧</h1>
        </div>
        <div class="goal"><div class="bar"><i style="width:${pct}%"></i></div><span>${dailyXP()} / ${S.goal} XP</span></div>
        ${pct >= 100 ? '<p class="small" style="margin:8px 0 0;color:var(--ok)">✔ 今日目標達成！太棒了 🎉</p>' : ''}
      </section>
      <section class="grid2">
        <a class="card action primary" href="#/vocab/study"><span class="big-ico">🍙</span><h3>單字複習</h3><p>待複習 ${due} ・ 新單字 ${fresh}</p></a>
        <a class="card action" href="#/kana/quiz"><span class="big-ico">🌸</span><h3>五十音練習</h3><p>${weak ? `有 ${weak} 個弱點假名` : '選擇、輸入、聽力'}</p></a>
        <a class="card action" href="#/vocab/quiz"><span class="big-ico">🍡</span><h3>單字測驗</h3><p>看字選義、聽音選義</p></a>
        <a class="card action" href="#/grammar/${nextLesson ? nextLesson.id : ''}"><span class="big-ico">🎀</span><h3>${nextLesson ? '繼續文法課' : '文法複習'}</h3><p>${nextLesson ? esc(nextLesson.title) : '全部課程已完成 🎉'}</p></a>
      </section>
      <section class="card">
        <h3>學習概況</h3>
        <div class="stats" style="margin:10px 0 0">
          ${statTile(Object.keys(S.cards).length + '/' + D.vocab.length, '已學單字')}
          ${statTile(kanaPoolMasteredCount() + '/' + kanaPool(ALL_SETS, ['hira', 'kata']).length, '已掌握假名')}
          ${statTile(Object.keys(S.lessons).length + '/' + D.grammar.length, '完成課程')}
        </div>
      </section>`;
  }
  const statTile = (n, label) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`;
  const kanaPoolMasteredCount = () => kanaPool(ALL_SETS, ['hira', 'kata']).filter((k) => kanaMastered(k.ch)).length;

  /* ---------- 五十音表 ---------- */
  let kanaScript = 'hira';
  function viewKana() {
    const render = () => {
      const sections = ALL_SETS.map((s) => {
        const cols = s === 'yoon' ? 'c3' : 'c5';
        const cells = D.kana[s].map((r) => r.map((c) => {
          if (!c) return '<div class="kcell empty"></div>';
          const ch = kanaScript === 'hira' ? c[0] : D.toKata(c[0]);
          const st = kanaStat(ch);
          const cls = kanaMastered(ch) ? 'good' : st.w > st.c ? 'weak' : '';
          return `<button class="kcell ${cls}" data-speak="${ch}"><b>${ch}</b><small>${c[1]}</small></button>`;
        }).join('')).join('');
        return `<h3 style="margin:16px 0 8px">${D.kanaSetNames[s]}</h3><div class="kana-grid ${cols}">${cells}</div>`;
      }).join('');
      app.innerHTML = `
        <div class="section-title"><h2>五十音</h2><a class="link" href="#/kana/quiz">開始練習 →</a></div>
        <div class="filters">
          <button class="pill ${kanaScript === 'hira' ? 'on' : ''}" data-script="hira">平假名 あ</button>
          <button class="pill ${kanaScript === 'kata' ? 'on' : ''}" data-script="kata">片假名 ア</button>
          <button class="pill ${S.romaji ? 'on' : ''}" id="toggle-romaji">顯示羅馬拼音</button>
        </div>
        <p class="muted small">點擊任一格可聽發音。綠框＝已掌握，紅底＝常答錯。</p>
        <div class="${S.romaji ? '' : 'hide-romaji'}">${sections}</div>`;
      app.querySelectorAll('[data-script]').forEach((b) => b.onclick = () => { kanaScript = b.dataset.script; render(); });
      document.getElementById('toggle-romaji').onclick = () => { S.romaji = !S.romaji; save(); render(); };
    };
    render();
  }

  /* ---------- 通用測驗引擎 ---------- */
  const ROMAJI_ALIAS = [['sya', 'sha'], ['syu', 'shu'], ['syo', 'sho'], ['tya', 'cha'], ['tyu', 'chu'], ['tyo', 'cho'],
    ['zya', 'ja'], ['zyu', 'ju'], ['zyo', 'jo'], ['jya', 'ja'], ['jyu', 'ju'], ['jyo', 'jo'],
    ['si', 'shi'], ['ti', 'chi'], ['tu', 'tsu'], ['hu', 'fu'], ['zi', 'ji'], ['di', 'ji'], ['du', 'zu'], ['nn', 'n']];
  function normRomaji(s) {
    s = s.trim().toLowerCase();
    ROMAJI_ALIAS.forEach(([a, b]) => { if (s === a) s = b; });
    return s;
  }

  /**
   * 題目格式：{ kind:'choice'|'input', prompt, label?, sub?, big?, speak?, autoSpeak?, say?,
   *            options?, answer(string) | answers(array), show?, note?, onAnswer?(ok) }
   */
  function runQuiz({ build, back, xpEach = 5, title = '' }) {
    const qs = build();
    let i = 0, right = 0, answered = false;
    const wrong = [];

    const keyHandler = (e) => {
      if (answered || !qs[i] || qs[i].kind !== 'choice') return;
      if (/^(INPUT|BUTTON|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= qs[i].options.length) respond(qs[i].options[n - 1]);
    };
    document.addEventListener('keydown', keyHandler);
    cleanup = () => document.removeEventListener('keydown', keyHandler);

    function render() {
      if (i >= qs.length) return finish();
      const q = qs[i];
      answered = false;
      const body = q.kind === 'input'
        ? `<form class="answer-row" id="ans-form" autocomplete="off">
             <input type="text" id="ans" placeholder="輸入羅馬拼音，例如 ka" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="答案">
             <button class="btn primary" type="submit">確認</button>
           </form>`
        : `<div class="opts">${q.options.map((o, n) => `<button class="opt" data-i="${n}"><kbd>${n + 1}</kbd>${esc(o)}</button>`).join('')}</div>`;
      app.innerHTML = `
        <div class="quiz-top"><a class="link" href="${back}">✕ 結束</a><div class="bar"><i style="width:${(i / qs.length) * 100}%"></i></div><span>${i + 1}/${qs.length}</span></div>
        <div class="card q-card">
          ${q.label ? `<p class="q-label">${esc(q.label)}</p>` : ''}
          <div class="q-prompt ${q.big ? 'big' : ''}">${esc(q.prompt)}</div>
          ${q.sub ? `<p class="q-sub">${esc(q.sub)}</p>` : ''}
          ${q.speak ? `<button class="icon-btn" data-speak="${esc(q.speak)}" aria-label="播放發音">🔊</button>` : ''}
        </div>
        ${body}<div id="fb" aria-live="polite"></div>`;
      if (q.kind === 'input') {
        const input = document.getElementById('ans');
        input.focus();
        document.getElementById('ans-form').onsubmit = (e) => { e.preventDefault(); if (input.value.trim()) respond(input.value); };
      } else {
        app.querySelectorAll('.opt').forEach((b) => b.onclick = () => respond(q.options[Number(b.dataset.i)]));
      }
      if (q.autoSpeak) speak(q.autoSpeak);
    }

    function respond(value) {
      if (answered) return;
      answered = true;
      const q = qs[i];
      const ok = q.kind === 'input'
        ? q.answers.map(normRomaji).includes(normRomaji(value))
        : value === q.answer;
      if (ok) { right++; addXP(xpEach); } else wrong.push(q);
      if (q.onAnswer) q.onAnswer(ok);
      if (q.kind === 'input') {
        const input = document.getElementById('ans');
        input.disabled = true;
        app.querySelector('#ans-form button').disabled = true;
      } else {
        app.querySelectorAll('.opt').forEach((b, n) => {
          b.disabled = true;
          if (q.options[n] === q.answer) b.classList.add('right');
          else if (q.options[n] === value) b.classList.add('wrong');
        });
      }
      const shown = q.show || q.answer || q.answers[0];
      document.getElementById('fb').innerHTML = `
        <div class="fb ${ok ? 'right' : 'wrong'}">
          ${q.pic || ''}
          <div class="fb-t"><b>${ok ? '✔ 答對了！' : '✘ 正確答案：' + esc(shown)}</b>
          ${q.note ? `<p>${esc(q.note)}</p>` : ''}</div>
        </div>
        <div class="btn-row"><button class="btn primary block" id="next">${i + 1 >= qs.length ? '查看結果' : '下一題'}</button></div>`;
      const next = document.getElementById('next');
      next.onclick = () => { i++; render(); };
      next.focus();
      if (q.say) speak(q.say);
    }

    function finish() {
      const ratio = right / qs.length;
      const bonus = right === qs.length ? 10 : 0;
      if (bonus) addXP(bonus);
      const msg = ratio === 1 ? '完美！すばらしい！' : ratio >= 0.8 ? '很棒，繼續保持！' : ratio >= 0.5 ? '不錯，再練習一下就更穩了' : '沒關係，多練習幾次會進步的';
      app.innerHTML = `
        <div class="card score">
          <p class="muted">${esc(title)}測驗完成</p>
          <div class="num">${right} / ${qs.length}</div>
          <p>${msg}</p>
          <p class="small muted">獲得 ${right * xpEach + bonus} XP${bonus ? '（含全對獎勵）' : ''}</p>
          ${wrong.length ? `<h3 style="text-align:left;margin-top:16px">需要複習</h3><ul class="wrong-list">${wrong.map((q) => `<li><b>${esc(q.prompt)}</b>${q.sub ? ' <span class="muted">' + esc(q.sub) + '</span>' : ''} → ${esc(q.show || q.answer || q.answers[0])}</li>`).join('')}</ul>` : ''}
          <div class="btn-row" style="justify-content:center"><button class="btn primary" id="again">再來一次</button><a class="btn" href="${back}">返回</a></div>
        </div>`;
      document.getElementById('again').onclick = () => runQuiz({ build, back, xpEach, title });
    }

    render();
  }

  /* ---------- 五十音測驗 ---------- */
  const kanaOpts = { sets: ['basic'], scripts: ['hira'], mode: 'mix', count: 10 };

  function viewKanaSetup() {
    const weakCount = Object.entries(S.kana).filter(([, k]) => k.w > k.c).length;
    const group = (label, name, items) => `
      <div class="setting col"><b>${label}</b><div class="opt-group">${items.map(([val, text, on]) =>
        `<button class="pill ${on ? 'on' : ''}" data-g="${name}" data-v="${val}">${text}</button>`).join('')}</div></div>`;
    const draw = () => {
      const o = kanaOpts;
      app.innerHTML = `
        <div class="section-title"><h2>五十音練習</h2><a class="link" href="#/kana">← 五十音表</a></div>
        <section class="card">
          ${group('文字', 'script', [['hira', '平假名', o.scripts.length === 1 && o.scripts[0] === 'hira'], ['kata', '片假名', o.scripts.length === 1 && o.scripts[0] === 'kata'], ['both', '兩者', o.scripts.length === 2]])}
          ${group('範圍', 'set', [['basic', '清音', o.sets.join() === 'basic'], ['dakuten', '濁音・半濁音', o.sets.join() === 'dakuten'], ['yoon', '拗音', o.sets.join() === 'yoon'], ['all', '全部', o.sets.length === 3], ['weak', `弱點（${weakCount}）`, o.sets === 'weak']])}
          ${group('題型', 'mode', [['mix', '混合', o.mode === 'mix'], ['read', '看假名選拼音', o.mode === 'read'], ['pick', '看拼音選假名', o.mode === 'pick'], ['type', '輸入拼音', o.mode === 'type']])}
          ${group('題數', 'count', [[10, '10 題', o.count === 10], [20, '20 題', o.count === 20], [40, '40 題', o.count === 40]])}
          <button class="btn primary block" id="go" style="margin-top:14px">開始</button>
        </section>`;
      app.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => {
        const v = b.dataset.v;
        switch (b.dataset.g) {
          case 'script': o.scripts = v === 'both' ? ['hira', 'kata'] : [v]; break;
          case 'set': o.sets = v === 'all' ? ALL_SETS.slice() : v === 'weak' ? 'weak' : [v]; break;
          case 'mode': o.mode = v; break;
          case 'count': o.count = Number(v); break;
        }
        draw();
      });
      document.getElementById('go').onclick = () => {
        if (o.sets === 'weak' && !weakCount) return toast('目前沒有弱點假名，先去練習吧！');
        runQuiz({ build: buildKanaQuiz, back: '#/kana/quiz', title: '五十音' });
      };
    };
    draw();
  }

  function buildKanaQuiz() {
    const o = kanaOpts;
    const full = kanaPool(ALL_SETS, o.scripts);
    let pool;
    if (o.sets === 'weak') {
      const weakSet = new Set(Object.entries(S.kana).filter(([, k]) => k.w > k.c).map(([ch]) => ch));
      pool = full.filter((k) => weakSet.has(k.ch));
    } else {
      pool = kanaPool(o.sets, o.scripts);
    }
    let picks = [];
    while (picks.length < o.count) picks = picks.concat(sample(pool, Math.min(pool.length, o.count - picks.length)));
    return shuffle(picks).map((k) => {
      const mode = o.mode === 'mix' ? pick(['read', 'pick', 'type']) : o.mode;
      const record = (ok) => {
        const st = S.kana[k.ch] || (S.kana[k.ch] = { c: 0, w: 0 });
        if (ok) st.c++; else st.w++;
        save();
      };
      const answers = k.ro === 'wo' ? ['wo', 'o'] : [k.ro];
      const base = { speak: k.ch, onAnswer: record, note: `${k.ch}（${k.script === 'hira' ? '平假名' : '片假名'}）讀作 ${k.ro}` };
      if (mode === 'type') return { ...base, kind: 'input', label: '輸入羅馬拼音', prompt: k.ch, big: true, answers, show: k.ro };
      if (mode === 'pick') {
        const others = sample(full.filter((x) => x.script === k.script && x.ro !== k.ro), 3).map((x) => x.ch);
        return { ...base, kind: 'choice', label: '選出對應的假名', prompt: k.ro, big: true, speak: null, options: shuffle([k.ch, ...others]), answer: k.ch };
      }
      const others = sample([...new Set(full.filter((x) => x.ro !== k.ro).map((x) => x.ro))], 3);
      return { ...base, kind: 'choice', label: '這個假名怎麼唸？', prompt: k.ch, big: true, options: shuffle([k.ro, ...others]), answer: k.ro };
    });
  }

  /* ---------- 單字清單 ---------- */
  let vocabCat = 'all';
  let vocabMode = 'grid';
  function viewVocab() {
    const due = dueCards().length;
    app.innerHTML = `
      <div class="section-title"><h2>單字</h2><a class="link" href="#/vocab/quiz">單字測驗 →</a></div>
      <a class="card action primary" href="#/vocab/study" style="margin-bottom:14px"><h3>今日複習</h3><p>待複習 ${due} ・ 今日還可學 ${Math.min(newRemaining(), freshCards(99).length)} 個新單字</p></a>
      <input type="search" id="q" placeholder="搜尋日文、讀音或中文" aria-label="搜尋單字" style="margin-bottom:12px">
      <div class="filters" id="cats"></div>
      <div class="mode-switch" role="group" aria-label="顯示方式"><button data-m="grid">🖼️ 圖鑑</button><button data-m="list">📋 清單</button></div>
      <div id="vbox"></div>`;
    const box$ = document.getElementById('vbox');
    const cats = document.getElementById('cats');
    const q = document.getElementById('q');
    const drawCats = () => {
      cats.innerHTML = [['all', '全部'], ...Object.entries(D.catNames)].map(([k, n]) => `<button class="pill ${vocabCat === k ? 'on' : ''}" data-c="${k}">${n}</button>`).join('');
      cats.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { vocabCat = b.dataset.c; drawCats(); drawList(); });
    };
    const drawList = () => {
      const t = q.value.trim().toLowerCase();
      const rows = D.vocab.filter((v) => (vocabCat === 'all' || v.cat === vocabCat) && (!t || (v.jp + v.kana + v.zh).toLowerCase().includes(t)));
      app.querySelectorAll('.mode-switch button').forEach((b) => b.classList.toggle('on', b.dataset.m === vocabMode));
      const dots = (v) => {
        const box = S.cards[v.id] ? S.cards[v.id].box : -1;
        return `<span class="dots" title="熟練度">${[1, 2, 3, 4].map((n) => `<i class="${box >= n ? 'on' : ''}"></i>`).join('')}</span>`;
      };
      if (!rows.length) { box$.innerHTML = '<div class="card muted">找不到符合的單字</div>'; return; }
      box$.innerHTML = vocabMode === 'grid'
        ? `<div class="vgrid">${rows.map((v) => `
            <button class="vtile" data-speak="${esc(v.kana)}" aria-label="${esc(v.jp)} ${esc(v.zh)}，點擊播放">
              ${pic(v, 'l')}
              <b class="jp">${esc(v.jp)}</b>
              ${v.kana !== v.jp ? `<span class="rd">${esc(v.kana)}</span>` : '<span class="rd">&nbsp;</span>'}
              <span class="zh">${esc(v.zh)}</span>
              ${dots(v)}
            </button>`).join('')}</div>`
        : `<div class="card" style="padding:6px 14px"><ul class="wlist">${rows.map((v) => `
            <li>${pic(v, 's')}
              <span class="jp">${esc(v.jp)}${v.kana !== v.jp ? `<span class="rd">${esc(v.kana)}</span>` : ''}</span>
              <span class="zh">${esc(v.zh)}</span>${dots(v)}
              <button class="icon-btn" data-speak="${esc(v.kana)}" aria-label="播放 ${esc(v.jp)}">🔊</button></li>`).join('')}</ul></div>`;
    };
    app.querySelectorAll('.mode-switch button').forEach((b) => b.onclick = () => { vocabMode = b.dataset.m; drawList(); });
    q.oninput = drawList;
    drawCats(); drawList();
  }

  /* ---------- 單字學習（間隔重複） ---------- */
  function viewStudy(extra) {
    const today = dayKey();
    let fresh = freshCards(newRemaining() + (extra ? 10 : 0));
    if (extra) fresh = freshCards(10);
    const queue = shuffle(dueCards()).concat(fresh).map((v) => ({ v }));
    const total = queue.length;
    let done = 0, flipped = false;

    if (!total) {
      app.innerHTML = `
        <div class="card score"><div class="num">🎉</div><h2>目前沒有要複習的單字</h2>
          <p class="muted">今天的任務已完成，或已學完全部單字。</p>
          <div class="btn-row" style="justify-content:center">
            ${freshCards(1).length ? '<a class="btn primary" href="#/vocab/more">再學 10 個新單字</a>' : ''}
            <a class="btn" href="#/vocab/quiz">來個測驗</a><a class="btn" href="#/home">回首頁</a></div></div>`;
      return;
    }

    const render = () => {
      if (!queue.length) return finish();
      const { v } = queue[0];
      const isNew = !S.cards[v.id];
      flipped = false;
      app.innerHTML = `
        <div class="quiz-top"><a class="link" href="#/vocab">✕ 結束</a><div class="bar"><i style="width:${(done / total) * 100}%"></i></div><span>${done}/${total}</span></div>
        <div class="card flash" id="card" role="button" tabindex="0" aria-label="點擊翻面">
          <span class="tag">${isNew ? '新單字 ・ ' : ''}${D.catNames[v.cat]}</span>
          <div class="jp">${esc(v.jp)}</div>
          <div id="back" hidden>
            ${pic(v, 'xl')}
            ${v.kana !== v.jp ? `<div class="reading">${esc(v.kana)}</div>` : ''}
            <div class="zh">${esc(v.zh)}</div>
          </div>
          <button class="icon-btn" data-speak="${esc(v.kana)}" aria-label="播放發音">🔊</button>
          <p class="muted small" id="hint">點擊卡片或按空白鍵顯示答案</p>
        </div>
        <div id="controls"><button class="btn primary block" id="flip">顯示答案</button></div>`;
      const flip = () => {
        if (flipped) return;
        flipped = true;
        document.getElementById('back').hidden = false;
        document.getElementById('hint').hidden = true;
        speak(v.kana);
        const c = S.cards[v.id];
        const nextBox = (n) => Math.min(INTERVALS.length - 1, (c ? c.box : 0) + n);
        const label = (n) => { const d = INTERVALS[nextBox(n)]; return d === 0 ? '稍後' : d + ' 天後'; };
        document.getElementById('controls').innerHTML = `
          <div class="rate">
            <button class="btn again" data-r="0">忘了<small>稍後再問</small></button>
            <button class="btn" data-r="1">記得<small>${label(1)}</small></button>
            <button class="btn easy" data-r="2">簡單<small>${label(2)}</small></button>
          </div>`;
        app.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => rate(Number(b.dataset.r)));
      };
      const card = document.getElementById('card');
      card.onclick = (e) => { if (!e.target.closest('[data-speak]')) flip(); };
      card.onkeydown = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } };
      document.getElementById('flip').onclick = flip;
      document.getElementById('flip').focus();
    };

    const rate = (r) => {
      const item = queue.shift();
      rateCard(item.v, r);
      if (r === 0) {
        queue.splice(Math.min(3, queue.length), 0, item);
      } else {
        done++;
        addXP(r === 2 ? 4 : 3);
      }
      render();
    };

    const keys = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (!flipped) return;
      if (e.key === '1' || e.key === '2' || e.key === '3') rate(Number(e.key) - 1);
    };
    document.addEventListener('keydown', keys);
    cleanup = () => document.removeEventListener('keydown', keys);

    function finish() {
      addXP(5);
      app.innerHTML = `
        <div class="card score"><div class="num">🎉</div><h2>複習完成！</h2>
          <p class="muted">本次共複習 ${total} 個單字，獲得額外 5 XP。</p>
          <div class="btn-row" style="justify-content:center">
            ${freshCards(1).length ? '<a class="btn primary" href="#/vocab/more">再學 10 個新單字</a>' : ''}
            <a class="btn" href="#/vocab/quiz">來個測驗</a><a class="btn" href="#/home">回首頁</a></div></div>`;
    }
    void today;
    render();
  }

  /* ---------- 單字測驗 ---------- */
  const vocabOpts = { cat: 'all', count: 10, learned: false };

  function viewVocabSetup() {
    const draw = () => {
      const o = vocabOpts;
      const learnedCount = Object.keys(S.cards).length;
      app.innerHTML = `
        <div class="section-title"><h2>單字測驗</h2><a class="link" href="#/vocab">← 單字</a></div>
        <section class="card">
          <div class="setting col"><b>分類</b><div class="opt-group">${[['all', '全部'], ...Object.entries(D.catNames)].map(([k, n]) => `<button class="pill ${o.cat === k ? 'on' : ''}" data-cat="${k}">${n}</button>`).join('')}</div></div>
          <div class="setting col"><b>範圍</b><div class="opt-group">
            <button class="pill ${!o.learned ? 'on' : ''}" data-learned="0">所有單字</button>
            <button class="pill ${o.learned ? 'on' : ''}" data-learned="1">已學過的（${learnedCount}）</button></div></div>
          <div class="setting col"><b>題數</b><div class="opt-group">${[10, 20].map((n) => `<button class="pill ${o.count === n ? 'on' : ''}" data-count="${n}">${n} 題</button>`).join('')}</div></div>
          <button class="btn primary block" id="go" style="margin-top:14px">開始</button>
        </section>`;
      app.querySelectorAll('[data-cat]').forEach((b) => b.onclick = () => { o.cat = b.dataset.cat; draw(); });
      app.querySelectorAll('[data-learned]').forEach((b) => b.onclick = () => { o.learned = b.dataset.learned === '1'; draw(); });
      app.querySelectorAll('[data-count]').forEach((b) => b.onclick = () => { o.count = Number(b.dataset.count); draw(); });
      document.getElementById('go').onclick = () => {
        if (vocabQuizPool().length < 4) return toast('可出題的單字太少（至少 4 個），請調整範圍');
        runQuiz({ build: buildVocabQuiz, back: '#/vocab/quiz', title: '單字' });
      };
    };
    draw();
  }

  const vocabQuizPool = () => D.vocab.filter((v) => (vocabOpts.cat === 'all' || v.cat === vocabOpts.cat) && (!vocabOpts.learned || S.cards[v.id]));

  function buildVocabQuiz() {
    const pool = vocabQuizPool();
    const types = hasTTS ? ['jp2zh', 'zh2jp', 'listen'] : ['jp2zh', 'zh2jp'];
    let picks = [];
    while (picks.length < vocabOpts.count) picks = picks.concat(sample(pool, Math.min(pool.length, vocabOpts.count - picks.length)));
    const label = (v) => (v.kana !== v.jp ? `${v.jp}（${v.kana}）` : v.jp);
    const distract = (v, key) => {
      const same = D.vocab.filter((x) => x.cat === v.cat && x.id !== v.id);
      const rest = D.vocab.filter((x) => x.cat !== v.cat);
      return sample(same, 3).concat(sample(rest, 3)).slice(0, 3).map(key);
    };
    return shuffle(picks).map((v) => {
      const type = pick(types);
      const onAnswer = (ok) => {
        if (!ok) {
          const c = S.cards[v.id];
          if (c) { c.box = 0; c.due = dayKey(); c.lapses++; save(); }
        }
      };
      const common = { onAnswer, say: v.kana, note: `${label(v)} ＝ ${v.zh}`, pic: pic(v, 'm') };
      if (type === 'zh2jp') {
        return { ...common, kind: 'choice', label: '哪一個是日文？', prompt: v.zh, options: shuffle([label(v), ...distract(v, label)]), answer: label(v) };
      }
      if (type === 'listen') {
        return { ...common, kind: 'choice', label: '聽發音，選出意思', prompt: '🔊 聽發音', speak: v.kana, autoSpeak: v.kana, say: null, options: shuffle([v.zh, ...distract(v, (x) => x.zh)]), answer: v.zh };
      }
      return { ...common, kind: 'choice', label: '這個單字的意思是？', prompt: v.jp, sub: v.kana !== v.jp ? v.kana : '', speak: v.kana, say: null, options: shuffle([v.zh, ...distract(v, (x) => x.zh)]), answer: v.zh };
    });
  }

  /* ---------- 文法 ---------- */
  function viewGrammar() {
    app.innerHTML = `
      <div class="section-title"><h2>文法課</h2><span class="muted small">${Object.keys(S.lessons).length}/${D.grammar.length} 完成</span></div>
      <div class="lesson-list">${D.grammar.map((g, n) => `
        <a class="card lesson ${S.lessons[g.id] ? 'done' : ''}" href="#/grammar/${g.id}" style="margin:0">
          <span class="no">${S.lessons[g.id] ? '✔' : n + 1}</span>
          <div><h3 style="margin:0">${esc(g.title)}</h3><p>${esc(g.sub)}</p></div>
        </a>`).join('')}</div>`;
  }

  function viewLesson(id) {
    const idx = D.grammar.findIndex((g) => g.id === id);
    if (idx < 0) return viewGrammar();
    const g = D.grammar[idx];
    const next = D.grammar[idx + 1];
    const best = S.lessons[g.id];
    app.innerHTML = `
      <div class="section-title"><a class="link" href="#/grammar">← 全部課程</a><span class="muted small">第 ${idx + 1} / ${D.grammar.length} 課</span></div>
      <section class="card">
        <h2>${esc(g.title)}</h2>
        <div class="pattern">${esc(g.pattern)}</div>
        ${g.body}
        <h3 style="margin-top:14px">例句</h3>
        ${g.examples.map(([jp, zh]) => `
          <div class="ex"><button class="icon-btn" data-speak="${esc(jp)}" aria-label="播放例句">🔊</button>
          <div class="t"><b>${esc(jp)}</b><span class="muted">${esc(zh)}</span></div></div>`).join('')}
      </section>
      <div class="btn-row">
        <button class="btn primary" id="quiz">${best ? '再測驗一次' : '小測驗'}${best ? `（最佳 ${best.best}/${best.total}）` : ''}</button>
        ${next ? `<a class="btn" href="#/grammar/${next.id}">下一課 →</a>` : ''}
      </div>`;
    document.getElementById('quiz').onclick = () => {
      let rightCount = 0;
      runQuiz({
        build: () => {
          rightCount = 0;
          return shuffle(g.quiz).map(([q, a, ...wrongs]) => ({
            kind: 'choice', label: '選出正確的填空', prompt: q, options: shuffle([a, ...wrongs]), answer: a,
            note: g.title,
            onAnswer: (ok) => {
              if (ok) rightCount++;
              const prev = S.lessons[g.id];
              if (!prev || rightCount > prev.best) S.lessons[g.id] = { best: rightCount, total: g.quiz.length };
              else if (prev.total !== g.quiz.length) prev.total = g.quiz.length;
              save();
            },
          }));
        },
        back: `#/grammar/${g.id}`,
        xpEach: 8,
        title: g.title,
      });
    };
  }

  /* ---------- 我的 ---------- */
  function viewMe() {
    const mastered = Object.values(S.cards).filter((c) => c.box >= 4).length;
    const kanaTotal = Object.values(S.kana).reduce((a, k) => ({ c: a.c + k.c, w: a.w + k.w }), { c: 0, w: 0 });
    const acc = kanaTotal.c + kanaTotal.w ? Math.round((kanaTotal.c / (kanaTotal.c + kanaTotal.w)) * 100) + '%' : '—';
    const opts = (name, items, cur) => `<div class="opt-group">${items.map(([v, t]) => `<button class="pill ${String(cur) === String(v) ? 'on' : ''}" data-s="${name}" data-v="${v}">${t}</button>`).join('')}</div>`;
    app.innerHTML = `
      <h2>我的進度</h2>
      <div class="stats">
        ${statTile(S.xp, '總經驗值 XP')}${statTile('Lv ' + level(), '等級')}${statTile(S.streak, '連續天數')}
        ${statTile(Object.keys(S.cards).length, '已學單字')}${statTile(mastered, '已熟練單字')}${statTile(acc, '假名正確率')}
      </div>
      <section class="card">
        <h3>設定</h3>
        <div class="setting col"><span>每日目標</span>${opts('goal', [[30, '30 XP'], [50, '50 XP'], [100, '100 XP'], [200, '200 XP']], S.goal)}</div>
        <div class="setting col"><span>每日新單字數</span>${opts('newPerDay', [[5, '5'], [10, '10'], [20, '20']], S.newPerDay)}</div>
        <div class="setting col"><span>外觀</span>${opts('theme', [['auto', '自動'], ['light', '淺色'], ['dark', '深色']], S.theme)}</div>
      </section>
      <section class="card">
        <h3>資料</h3>
        <p class="muted small">進度只儲存在這台裝置的瀏覽器中。換裝置前請先匯出。</p>
        <div class="btn-row" style="margin-top:0">
          <button class="btn" id="export">匯出進度</button>
          <label class="btn" for="import">匯入進度</label><input type="file" id="import" accept="application/json" hidden>
          <button class="btn" id="reset" style="color:var(--bad)">清除全部進度</button>
        </div>
      </section>`;
    app.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => {
      const k = b.dataset.s, raw = b.dataset.v;
      S[k] = k === 'theme' ? raw : Number(raw);
      save(); applyTheme(); viewMe();
    });
    document.getElementById('export').onclick = () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `nihongo-progress-${dayKey()}.json` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    document.getElementById('import').onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (typeof data !== 'object' || data === null || typeof data.xp !== 'number') throw new Error('格式不符');
          S = Object.assign(defaults(), data);
          save(); applyTheme(); updateHeader(); viewMe(); toast('匯入完成');
        } catch (err) { toast('匯入失敗：檔案格式不正確'); }
      };
      reader.readAsText(file);
    };
    document.getElementById('reset').onclick = () => {
      if (confirm('確定要清除所有學習進度嗎？此動作無法復原。')) {
        S = defaults(); save(); applyTheme(); updateHeader(); viewMe(); toast('已清除');
      }
    };
  }

  /* ---------- 全域事件 ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-speak]');
    if (t) { e.preventDefault(); speak(t.dataset.speak); return; }
    // 連結指向目前所在的同一個網址時不會觸發 hashchange（例如測驗結果頁的「返回」），手動重新渲染
    const a = e.target.closest('a[href^="#/"]');
    if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); route(); }
  });
  window.addEventListener('hashchange', route);

  applyTheme();
  updateHeader();
  route();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  void vocabById;
})();
