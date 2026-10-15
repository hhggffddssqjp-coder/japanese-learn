/* practice.js — 自訂測驗、單字卡、五十音練習（從「練習」頁進入的自由練習） */
(function () {
  'use strict';
  const JP = window.JP;
  const S = JP.S;
  const { esc, shuffle, ruby, plain } = JP;
  const { toast, speakBtn, ICON } = JP.ui;
  const Q = JP.Q;
  const V = JP.views;
  const main = () => document.getElementById('main');
  const route = () => (location.hash.replace(/^#\/?/, '').split('/')[0] || 'learn');

  // 每個人的偏好設定（記在這個瀏覽器；讀寫失敗不影響使用）
  const store = {
    get(k, d) { try { const v = localStorage.getItem('jpl.' + k); return v ? Object.assign({}, d, JSON.parse(v)) : Object.assign({}, d); } catch (e) { return Object.assign({}, d); } },
    set(k, v) { try { localStorage.setItem('jpl.' + k, JSON.stringify(v)); } catch (e) { /* 忽略 */ } },
  };

  const head = (title, desc) => `<header class="page-h"><a class="back-link" href="#/practice">‹ 練習</a><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</header>`;
  const chip = (on, attr, label, extra = '') => `<button type="button" class="fchip ${on ? 'on' : ''}" ${attr}${extra}>${label}</button>`;
  const section = (title) => `<h3 class="set-h"><span>${title}</span></h3>`;

  /* ───── 單字範圍（等級、詞性、來源） ───── */
  let bankState = 0; // 0 未載入、1 載入中、2 完成
  function ensureBank() {
    if (bankState === 2) return Promise.resolve(true);
    bankState = 1;
    return Promise.all(JP.bank.LEVELS.map((l) => JP.bank.load(l.id))).then(() => { bankState = 2; return true; }).catch(() => { bankState = 0; toast('單字庫載入失敗，請確認網路後再試'); return false; });
  }
  const POS = [['all', '全部詞性'], ['名詞', '名詞'], ['動詞', '動詞'], ['形容詞', '形容詞'], ['副詞', '副詞']];
  const wordsAll = () => JP.itemList('word');
  const inScope = (it, f) => (!f.levels.length || f.levels.includes(it.lv)) && (f.pos === 'all' || it.pos.includes(f.pos)) && (f.source === 'all' || (f.source === 'learned') === !!S.cards[it.id]);
  const levelCounts = () => { const c = {}; wordsAll().forEach((w) => { if (w.lv) c[w.lv] = (c[w.lv] || 0) + 1; }); return c; };
  const levelChips = (selected, attr) => {
    const c = levelCounts();
    return chip(!selected.length, `${attr}="lv:all"`, '全部隨機') + ['N5', 'N4', 'N3', 'N2', 'N1'].map((l) => chip(selected.includes(l), `${attr}="lv:${l}"`, `${l}<small>${c[l] || 0}</small>`, c[l] ? '' : ' disabled')).join('');
  };
  const toggleLevel = (arr, v) => { if (v === 'all') return []; return arr.includes(v) ? arr.filter((x) => x !== v) : arr.concat(v); };

  /* ═════════════ 自訂測驗 ═════════════ */
  const QZ_DEFAULT = { levels: [], pos: 'all', source: 'all', types: [], count: 10, lives: 0, total: 0, per: 0, kanji: 'auto', sound: 'show' };
  const QTYPES = [['jp2zh', '看日文選中文', '看單字，選出正確意思'], ['zh2jp', '看中文選日文', '看意思，選出正確單字'], ['fill', '例句填空', '日文例句挖空，選出單字'], ['listen2jp', '聽音選字', '聽發音，選出單字'], ['type', '輸入羅馬字', '看意思，打出羅馬拼音']];
  let qz = store.get('quiz', QZ_DEFAULT);
  let advOpen = false;

  function viewQuiz() {
    const n = wordsAll().filter((w) => inScope(w, qz)).length;
    const opt = (key, vals, fmt) => vals.map((v) => chip(qz[key] === v, `data-qz="${key}:${v}"`, fmt(v))).join('');
    const typeBtns = QTYPES.map(([id, t, d]) => {
      const dis = id === 'listen2jp' && !Q.canListen();
      return `<button type="button" class="opt-card ${qz.types.includes(id) ? 'on' : ''}" data-qz="type:${id}"${dis ? ' disabled' : ''}><b>${t}</b><small>${dis ? '需要裝置有日語語音' : d}</small></button>`;
    }).join('');
    main().innerHTML = `<div class="page qset">${head('自訂測驗', '自己決定考哪些字、怎麼考。不會把沒學過的字加進圖鑑，只有已收集的字會更新熟練度。')}
      ${section('出題範圍')}
      <div class="chips-wrap">${levelChips(qz.levels, 'data-qz')}</div>
      <button type="button" class="adv-toggle" data-qz="adv:x">進階篩選 <span>${advOpen ? '▴' : '▾'}</span></button>
      ${advOpen ? `<div class="adv"><div class="chips-f">${POS.map(([k, l]) => chip(qz.pos === k, `data-qz="pos:${k}"`, l)).join('')}</div>
        <div class="chips-f">${[['all', '所有單字'], ['learned', '只考學過的'], ['new', '只考沒學過的']].map(([k, l]) => chip(qz.source === k, `data-qz="source:${k}"`, l)).join('')}</div></div>` : ''}
      <p class="set-note">符合條件的單字：<b>${n}</b> 個${bankState === 1 ? '（載入單字庫中…）' : ''}</p>
      ${section('題型（可複選，不選＝隨機）')}
      <div class="opt-grid">${typeBtns}</div>
      ${section('規則')}
      <div class="rules">
        <div><span>題數</span>${opt('count', [10, 20, 30, 50], (v) => v + ' 題')}</div>
        <div><span>生命</span>${opt('lives', [0, 3, 5], (v) => (v ? v + ' 顆' : '不限'))}</div>
        <div><span>總時間</span>${opt('total', [0, 3, 5, 10], (v) => (v ? v + ' 分' : '不限'))}</div>
        <div><span>單題時間</span>${opt('per', [0, 10, 20, 30], (v) => (v ? v + ' 秒' : '不限'))}</div>
      </div>
      ${section('漢字顯示')}
      <div class="chips-f">${[['auto', '自動'], ['kanji', '漢字'], ['kana', '假名']].map(([k, l]) => chip(qz.kanji === k, `data-qz="kanji:${k}"`, l)).join('')}</div>
      <p class="set-note">自動＝依「我的」設定顯示振假名；漢字＝只顯示漢字；假名＝只顯示讀音。</p>
      ${section('語音按鈕')}
      <div class="chips-f">${[['hide', '隱藏'], ['show', '顯示'], ['after', '答題後顯示']].map(([k, l]) => chip(qz.sound === k, `data-qz="sound:${k}"`, l)).join('')}</div>
      <p class="set-note">題目裡的發音按鈕。選「答題後顯示」就不會被發音提示答案；聽音題一定看得到。</p>
      <div class="set-go"><button type="button" class="btn btn-ghost" data-qz="rand:x">隨機玩</button><button type="button" class="btn btn-big" data-qz="start:x">開始測驗</button></div>
    </div>`;
    if (bankState === 0) ensureBank().then((ok) => { if (ok && route() === 'quiz') viewQuiz(); });
  }

  function quizConfig(random) {
    const f = random ? Object.assign({}, QZ_DEFAULT) : qz;
    const items = shuffle(wordsAll().filter((w) => inScope(w, f)));
    if (items.length < 4) { toast('符合條件的單字太少（至少 4 個），請放寬範圍'); return null; }
    let types = (f.types.length ? f.types : QTYPES.map((t) => t[0])).filter((t) => t !== 'listen2jp' || Q.canListen());
    if (!types.length) { toast('這個裝置找不到日語語音，請改選其他題型'); return null; }
    const qs = [];
    Q.display = f.kanji; // 題目的 HTML 在建立時就決定，建完立刻還原
    try {
      for (let i = 0; qs.length < f.count && i < items.length * 2; i++) {
        const it = items[i % items.length];
        for (const t of shuffle(types.slice())) { const q = Q.build(it, t); if (q) { qs.push(q); break; } }
      }
    } finally { Q.display = 'auto'; }
    if (qs.length < 3) { toast('這個範圍出不了題目，請換一種題型或範圍'); return null; }
    return { kind: 'quiz', title: '自訂測驗', questions: qs, hearts: f.lives || 0, timer: f.total ? f.total * 60 : 0, qtime: f.per || 0, display: f.kanji, sound: f.sound };
  }

  function quizClick(el) {
    const [k, v] = el.dataset.qz.split(':');
    if (k === 'start' || k === 'rand') {
      const random = k === 'rand';
      ensureBank().then((ok) => {
        if (!ok) return;
        if (!random) store.set('quiz', qz);
        V.launch(() => quizConfig(random));
      });
      return;
    }
    if (k === 'adv') advOpen = !advOpen;
    else if (k === 'lv') qz.levels = toggleLevel(qz.levels, v);
    else if (k === 'type') qz.types = qz.types.includes(v) ? qz.types.filter((x) => x !== v) : qz.types.concat(v);
    else if (['count', 'lives', 'total', 'per'].includes(k)) qz[k] = +v;
    else qz[k] = v;
    store.set('quiz', qz);
    viewQuiz();
  }

  /* ═════════════ 單字卡 ═════════════ */
  const cd = Object.assign({ levels: [], pos: 'all', deck: [], pos2: -1, hist: [], cur: null }, { show: store.get('cardshow', { rd: true, zh: false, ro: false }) });
  cd.filter = store.get('cardfilter', { levels: [], pos: 'all', source: 'all' });

  const deckOf = () => shuffle(wordsAll().filter((w) => inScope(w, cd.filter)));
  function nextCard() {
    if (cd.cur) cd.hist.push(cd.cur.id);
    if (cd.hist.length > 50) cd.hist.shift();
    if (!cd.deck.length) cd.deck = deckOf();
    cd.cur = cd.deck.pop() || null;
  }
  function prevCard() {
    const id = cd.hist.pop();
    if (id) cd.cur = JP.item(id);
  }

  function viewCards() {
    if (!cd.cur || !inScope(cd.cur, cd.filter)) { cd.deck = deckOf(); cd.hist = []; cd.cur = null; nextCard(); }
    const it = cd.cur;
    const f = cd.filter, sh = cd.show;
    const filters = `<div class="chips-wrap">${levelChips(f.levels, 'data-cd')}</div>
      <div class="chips-f">${POS.map(([k, l]) => chip(f.pos === k, `data-cd="pos:${k}"`, l)).join('')}</div>`;
    if (!it) {
      main().innerHTML = `<div class="page cards">${head('單字卡')}${filters}<div class="empty"><div>🃏</div><p>${bankState === 1 ? '載入單字庫中…' : '這個範圍沒有單字'}</p></div></div>`;
    } else {
      const jpHtml = it.hasKanji && sh.rd && S.set.furi ? `<ruby>${esc(it.jp)}<rt>${esc(it.rd)}</rt></ruby>` : esc(it.jp);
      const exs = (it.exs || []).map(([ex, zh]) => `<div class="cex"><div class="ex-jp" lang="ja">${ruby(ex)}${speakBtn(plain(ex), 'inline')}</div>${S.set.romaji && sh.ro ? `<div class="ex-ro">${esc(JP.sentRo(ex))}</div>` : ''}<div class="ex-zh">${sh.zh ? esc(zh) : '<span class="hid">中文已隱藏</span>'}</div></div>`).join('');
      main().innerHTML = `<div class="page cards">${head('單字卡')}${filters}
        <article class="wcard">
          <div class="wc-top"><span class="wc-badge">${esc(it.lv || '—')}</span>${it.pos ? `<span class="wc-badge soft">${esc(it.pos)}</span>` : ''}<span class="wc-say">${speakBtn(it.rd, 'big')}</span></div>
          ${it.em ? `<div class="wc-pic" aria-hidden="true">${it.em}</div>` : ''}
          <div class="wc-jp" lang="ja">${jpHtml}</div>
          ${it.hasKanji && sh.rd && !S.set.furi ? `<div class="wc-rd" lang="ja">${esc(it.rd)}</div>` : ''}
          ${sh.ro ? `<div class="wc-ro">${esc(it.ro)}</div>` : ''}
          <hr>
          <div class="wc-zh">${sh.zh ? esc(it.zh) : '<span class="hid">點下面的「中文」顯示意思</span>'}</div>
          <div class="wc-nav"><button type="button" class="icon-btn" data-cd="prev:x" aria-label="上一張"${cd.hist.length ? '' : ' disabled'}>${ICON.back()}</button><button type="button" class="icon-btn flip" data-cd="next:x" aria-label="下一張">${ICON.back()}</button></div>
        </article>
        <div class="chips-f center">${[['rd', '讀音'], ['zh', '中文'], ['ro', '羅馬字']].map(([k, l]) => chip(sh[k], `data-cd="show:${k}"`, l)).join('')}</div>
        <div class="cexs"><h4>例句</h4>${exs || '<p class="muted">這個單字沒有例句</p>'}</div>
        ${V.routes && JP.relatedHtml ? JP.relatedHtml(it).replace('同主題單字', '同主題單字（點一下跳過去）') : ''}
        <div class="set-go"><button type="button" class="btn btn-big" data-cd="next:x">下一張（隨機）</button></div>
      </div>`;
      if (S.set.auto && JP.tts.can() && cd.autoSay) { cd.autoSay = false; setTimeout(() => { if (route() === 'cards' && cd.cur === it) JP.tts.speak(it.rd); }, 250); }
    }
    if (bankState === 0) ensureBank().then((ok) => { if (ok && route() === 'cards') { cd.deck = deckOf(); viewCards(); } });
  }

  function cardsClick(el) {
    const [k, v] = el.dataset.cd.split(':');
    if (k === 'next') { nextCard(); cd.autoSay = true; }
    else if (k === 'prev') { prevCard(); cd.autoSay = true; }
    else if (k === 'show') { cd.show[v] = !cd.show[v]; store.set('cardshow', cd.show); }
    else {
      if (k === 'lv') cd.filter.levels = toggleLevel(cd.filter.levels, v);
      else if (k === 'pos') cd.filter.pos = v;
      store.set('cardfilter', cd.filter);
      cd.cur = null; cd.deck = []; cd.hist = [];
    }
    viewCards();
  }

  /* ═════════════ 五十音練習 ═════════════ */
  const KD_DEFAULT = { script: 'hira', range: 'basic', type: 'kana2ro', count: 20 };
  let kd = store.get('kana', KD_DEFAULT);
  const KTYPES = [['kana2ro', '看假名選羅馬字'], ['ro2kana', '看羅馬字選假名'], ['listen2kana', '聽音選假名'], ['type', '輸入羅馬字']];

  function kanaPool() {
    const K = JP.KANA;
    const dak = new Set([].concat(K.hiraDakuten, K.kataDakuten).map((r) => r[0]));
    return JP.itemList('kana').filter((it) => it.script === kd.script && !it.rare && (kd.range === 'yoon' ? it.yoon : kd.range === 'dakuten' ? !it.yoon && dak.has(it.jp) : !it.yoon && !dak.has(it.jp)));
  }
  function viewKana() {
    const n = kanaPool().length;
    main().innerHTML = `<div class="page qset">${head('五十音練習', '不用先解鎖關卡，選好範圍就能無限刷題。')}
      <div class="seg-tabs small"><button type="button" class="${kd.script === 'hira' ? 'on' : ''}" data-kd="script:hira">あ 平假名</button><button type="button" class="${kd.script === 'kata' ? 'on' : ''}" data-kd="script:kata">ア 片假名</button></div>
      ${section('範圍')}
      <div class="chips-f">${[['basic', '清音'], ['dakuten', '濁音・半濁音'], ['yoon', '拗音']].map(([k, l]) => chip(kd.range === k, `data-kd="range:${k}"`, l)).join('')}</div>
      <p class="set-note">這個範圍有 <b>${n}</b> 個假名。</p>
      ${section('題型')}
      <div class="opt-grid">${KTYPES.map(([id, t]) => { const dis = id === 'listen2kana' && !Q.canListen(); return `<button type="button" class="opt-card ${kd.type === id ? 'on' : ''}" data-kd="type:${id}"${dis ? ' disabled' : ''}><b>${t}</b>${dis ? '<small>需要裝置有日語語音</small>' : ''}</button>`; }).join('')}</div>
      ${section('題數')}
      <div class="chips-f">${[10, 20, 30, 50].map((v) => chip(kd.count === v, `data-kd="count:${v}"`, v + ' 題')).join('')}</div>
      <div class="set-go"><button type="button" class="btn btn-big" data-kd="start:x">開始練習</button></div>
    </div>`;
  }
  function kanaConfig() {
    const items = shuffle(kanaPool());
    if (items.length < 4) { toast('這個範圍的假名太少'); return null; }
    const qs = [];
    for (let i = 0; qs.length < kd.count && i < items.length * 3; i++) { const q = Q.build(items[i % items.length], kd.type); if (q) qs.push(q); }
    if (qs.length < 3) { toast('這個題型出不了題目，請換一種'); return null; }
    return { kind: 'quiz', title: '五十音練習', questions: qs, display: 'auto', sound: 'show' };
  }
  function kanaClick(el) {
    const [k, v] = el.dataset.kd.split(':');
    if (k === 'start') { store.set('kana', kd); V.launch(kanaConfig); return; }
    kd[k] = k === 'count' ? +v : v;
    store.set('kana', kd);
    viewKana();
  }

  /* ═════════════ 情境會話（日常會話、旅遊常用） ═════════════ */
  const PH_GROUPS = [['daily', '日常會話', '選一個情境，看看平常聊天會用到的日文。'], ['travel', '旅遊常用', '看看旅行時會說、會聽到的日文。']];
  const phShow = store.get('phraseshow', { rd: true, zh: true, ro: false });
  const phId = () => location.hash.replace(/^#\/?/, '').split('/')[1] || '';

  function viewPhrases() {
    const sc = (JP.PHRASES || []).find((x) => x.id === phId());
    if (!sc) {
      main().innerHTML = `<div class="page">${head('情境會話', '把實用的句子一句一句學起來，每個情境 15 句，都有發音。')}${PH_GROUPS.map(([g, t, d]) => `<h3 class="set-h"><span>${t}</span></h3><p class="set-note">${d}</p><div class="plist">${(JP.PHRASES || []).filter((x) => x.group === g).map((x) => `<a class="prow" href="#/phrases/${esc(x.id)}"><span class="pr-ico">${x.em}</span><div><b>${esc(x.title)}</b><small>${esc(x.zh)}・${x.phrases.length} 句</small></div><span class="pr-go">›</span></a>`).join('')}</div>`).join('')}
        <p class="bank-credit">例句與中文由 AI 撰寫，可能有誤，建議搭配其他資料確認。</p></div>`;
      return;
    }
    const sib = JP.PHRASES.filter((x) => x.group === sc.group);
    const sh = phShow;
    main().innerHTML = `<div class="page phr"><header class="page-h"><a class="back-link" href="#/phrases">‹ ${sc.group === 'daily' ? '日常會話' : '旅遊常用'}</a><h1><span class="h1-em">${sc.em}</span>${esc(sc.title)}</h1><p>${esc(sc.zh)}</p></header>
      <div class="chips-f ph-tabs">${sib.map((x) => `<a class="fchip ${x.id === sc.id ? 'on' : ''}" href="#/phrases/${esc(x.id)}">${esc(x.title)}</a>`).join('')}</div>
      <div class="chips-f center">${[['rd', '讀音'], ['zh', '中文'], ['ro', '羅馬字']].map(([k, l]) => chip(sh[k], `data-ph="show:${k}"`, l)).join('')}</div>
      <div class="plines">${sc.phrases.map(([s, zh, note]) => `<div class="pline"><div class="pl-main"><div class="ex-jp" lang="ja">${sh.rd ? ruby(s) : esc(plain(s))}</div>${sh.ro ? `<div class="ex-ro">${esc(JP.sentRo(s))}</div>` : ''}<div class="ex-zh">${sh.zh ? esc(zh) : '<span class="hid">中文已隱藏</span>'}</div>${note && sh.zh ? `<div class="pl-note">${esc(note)}</div>` : ''}</div><div class="pl-say">${speakBtn(plain(s), 'inline')}</div></div>`).join('')}</div>
      <div class="set-go"><button type="button" class="btn btn-big" data-ph="drill:${esc(sc.id)}">練習這一組（10 題）</button></div></div>`;
  }
  function phrasesClick(el) {
    const [k, v] = el.dataset.ph.split(':');
    if (k === 'show') { phShow[v] = !phShow[v]; store.set('phraseshow', phShow); return viewPhrases(); }
    if (k === 'drill') {
      const sc = JP.PHRASES.find((x) => x.id === v);
      V.launch(() => ({ kind: 'quiz', title: sc.title, questions: Q.phraseQs(sc, 10), display: 'auto', sound: 'show' }));
    }
  }

  /* ───── 事件與路由 ───── */
  main().addEventListener('click', (e) => {
    let el;
    if ((el = e.target.closest('[data-qz]'))) return quizClick(el);
    if ((el = e.target.closest('[data-cd]'))) return cardsClick(el);
    if ((el = e.target.closest('[data-kd]'))) return kanaClick(el);
    if ((el = e.target.closest('[data-ph]'))) return phrasesClick(el);
    if (route() === 'cards' && (el = e.target.closest('[data-rel]'))) { cd.cur = JP.item(el.dataset.rel); cd.autoSay = true; viewCards(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  document.addEventListener('keydown', (e) => {
    if (route() !== 'cards' || document.querySelector('.overlay.open, .modal.in') || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if (e.key === 'ArrowRight') { nextCard(); cd.autoSay = true; viewCards(); }
    else if (e.key === 'ArrowLeft') { prevCard(); cd.autoSay = true; viewCards(); }
  });

  Object.assign(V.routes, { quiz: viewQuiz, cards: viewCards, kana: viewKana, phrases: viewPhrases });
})();
