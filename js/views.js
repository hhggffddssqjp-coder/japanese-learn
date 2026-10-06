/* views.js — 學習地圖、圖鑑、練習、個人頁、歡迎頁 */
(function () {
  'use strict';
  const JP = window.JP;
  const S = JP.S;
  const { esc, shuffle, sample, ruby, plain } = JP;
  const { ICON, modal, toast, speakBtn } = JP.ui;
  const Q = JP.Q;
  const main = () => document.getElementById('main');

  const WEEK = ['一', '二', '三', '四', '五', '六', '日'];
  const mmin = (n) => `約 ${Math.max(1, Math.round(n))} 分鐘`;

  /* ───────────── 共用片段 ───────────── */
  function ring(pct, label, sub, size = 64) {
    const r = 26, c = 2 * Math.PI * r;
    return `<div class="ring" style="--s:${size}px"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="ring-bg"/><circle cx="32" cy="32" r="${r}" class="ring-fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - Math.min(1, pct))).toFixed(1)}" transform="rotate(-90 32 32)"/></svg><div class="ring-c"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
  }
  function weekRow() {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const today = JP.dayKey();
    return `<div class="week">${WEEK.map((w, i) => {
      const k = JP.addDays(today, i - dow);
      const done = (S.days[k] || 0) > 0, frozen = S.frozen.includes(k) && !done;
      const cls = done ? 'done' : frozen ? 'frozen' : k === today ? 'today' : k > today ? 'future' : 'miss';
      return `<div class="wd ${cls}"><span>${w}</span><i>${done ? ICON.flame() : frozen ? '❄️' : ''}</i></div>`;
    }).join('')}</div>`;
  }
  const levelCard = () => {
    const L = JP.levelInfo(), rk = JP.rankOf(L.level);
    return `<div class="card lvcard"><div class="lv-badge"><b>${L.level}</b><small>Lv</small></div><div class="lv-main"><div class="lv-rank"><b lang="ja">${rk[1]}</b><span lang="ja">${rk[2]}</span></div><div class="xpbar"><i style="width:${L.pct}%"></i></div><small>${L.cur} / ${L.need} XP・再 ${L.need - L.cur} XP 升級</small></div></div>`;
  };
  const goalCard = () => {
    const x = JP.dailyXP(), p = x / S.goal;
    return `<div class="card goalcard">${ring(p, Math.min(x, S.goal), '/ ' + S.goal)}<div><h3>今日目標</h3><p>${p >= 1 ? '達成了！明天繼續保持 🎯' : `再賺 ${S.goal - x} XP 就達標`}</p></div></div>`;
  };
  const streakCard = () => {
    const n = JP.streakDisplay();
    return `<div class="card streakcard"><div class="sk-top"><span class="sk-flame ${JP.doneToday() ? 'lit' : ''}">${ICON.flame()}</span><div><b>${n}</b> 天連勝<small>${JP.doneToday() ? '今天已完成 ✔' : n ? '今天還沒學，快來維持連勝！' : '開始你的第一天吧'}</small></div></div>${weekRow()}</div>`;
  };

  /* ───────────── 學習地圖 ───────────── */
  const ROW = 130, TOP = 50, AMP = 74;
  function pathHtml(w) {
    const ns = w.nodes;
    const H = TOP + (ns.length - 1) * ROW + 90;
    const pos = ns.map((n, i) => ({ x: 180 + Math.round(Math.sin(i * 1.15 + (w.id.length)) * AMP), y: TOP + i * ROW }));
    let segs = '', segsDone = '';
    for (let i = 0; i < ns.length - 1; i++) {
      const a = pos[i], b = pos[i + 1], my = (a.y + b.y) / 2;
      const d = `M${a.x} ${a.y} C${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
      if (JP.stateOf(ns[i + 1]).locked) segs += `<path d="${d}" class="seg"/>`; else segsDone += `<path d="${d}" class="seg done"/>`;
    }
    const cur = JP.currentNode();
    const nodes = ns.map((n, i) => {
      const s = JP.stateOf(n);
      const cls = ['node', n.type, s.locked ? 'locked' : s.current ? 'current' : s.done ? 'done' : 'open', s.skipped ? 'skipped' : ''].join(' ');
      const face = s.locked ? ICON.lock() : n.type === 'grammar' ? '<span class="nf-g" lang="ja">文</span>' : `<span class="nf-i" lang="ja">${esc(n.icon)}</span>`;
      const st = n.type === 'boss' || s.locked ? '' : `<span class="node-stars">${[0, 1, 2].map((k) => `<span class="${k < s.stars ? 'on' : ''}">${ICON.star()}</span>`).join('')}</span>`;
      const bossStars = n.type === 'boss' && !s.locked ? `<span class="node-stars">${[0, 1, 2].map((k) => `<span class="${k < s.stars ? 'on' : ''}">${ICON.star()}</span>`).join('')}</span>` : '';
      return `<button type="button" class="${cls}" style="left:${(pos[i].x / 360 * 100).toFixed(2)}%;top:${pos[i].y}px" data-node="${esc(n.id)}" aria-label="${esc(n.title)}${s.locked ? '（尚未解鎖）' : ''}">
        ${s.current ? `<span class="start-pop">開始！</span>` : ''}
        <span class="node-face">${face}${s.done && !s.skipped && n.type !== 'boss' ? `<span class="node-check">${ICON.check()}</span>` : ''}${s.skipped ? `<span class="node-check sk">${ICON.check()}</span>` : ''}</span>
        ${st}${bossStars}
        <span class="node-label">${esc(n.title)}</span>
        ${s.current ? '<span class="you" aria-hidden="true">🐱</span>' : ''}
      </button>`;
    }).join('');
    void cur;
    return `<div class="path" style="height:${H}px"><svg viewBox="0 0 360 ${H}" preserveAspectRatio="none" aria-hidden="true">${segs}${segsDone}</svg>${nodes}</div>`;
  }

  function worldHtml(w, wi) {
    const stars = JP.worldStars(w);
    const first = w.nodes[0];
    const locked = JP.stateOf(first).locked;
    const cleared = JP.worldCleared(w);
    const learned = w.nodes.filter((n) => JP.stateOf(n).done).length;
    return `<section class="world w-${w.theme}${locked ? ' is-locked' : ''}" id="world-${w.id}">
      <header class="world-head">
        <div class="wh-em" aria-hidden="true">${w.em}</div>
        <div class="wh-txt"><span class="wh-level">${w.level}・第 ${wi + 1} 章</span><h2 lang="ja">${w.title}</h2><p>${esc(w.zh)}・${esc(w.sub)}</p></div>
        <div class="wh-prog" title="星星數"><span>${ICON.star()}</span>${stars.got}<small>/${stars.max}</small></div>
        ${cleared ? `<div class="wh-stamp" title="已獲得朱印"><div class="hanko sm">${esc(w.zh.slice(0, 2))}</div></div>` : ''}
      </header>
      ${!cleared ? `<button type="button" class="skip-link" data-testout="${w.id}">已經會了嗎？挑戰跳級 <span>›</span></button>` : ''}
      ${pathHtml(w)}
      <div class="world-foot"><small>${learned} / ${w.nodes.length} 關完成</small></div>
    </section>`;
  }

  function reviewBanner() {
    const due = JP.dueIds().length, learned = JP.learnedIds().length;
    if (!learned) return '';
    if (due) return `<button type="button" class="card banner review" data-go="review"><span class="bn-ico">🔁</span><div><b>今日複習・${due} 個待複習</b><small>${mmin(due * 0.3)}，記得牢才不會忘</small></div><span class="bn-cta">開始</span></button>`;
    return `<div class="card banner done"><span class="bn-ico">✅</span><div><b>今天的複習都完成了</b><small>到「練習」頁還有更多玩法</small></div></div>`;
  }
  function voiceBanner() {
    if (!JP.tts.ok) return `<div class="card banner warn"><span class="bn-ico">🔇</span><div><b>這個瀏覽器不支援語音播放</b><small>建議改用 Chrome、Edge 或 Safari，聽力題會自動略過</small></div></div>`;
    if (!JP.tts.hasJa) return `<button type="button" class="card banner warn" data-go="me" data-voice-help="1"><span class="bn-ico">🔇</span><div><b>找不到日語語音</b><small>聽力題會暫時略過，點這裡看如何安裝</small></div><span class="bn-cta">設定</span></button>`;
    return '';
  }

  function viewLearn() {
    const rail = `<aside class="rail">${levelCard()}${goalCard()}${streakCard()}</aside>`;
    main().innerHTML = `<div class="learn">${rail}<div class="map-col">${voiceBanner()}${reviewBanner()}${JP.WORLDS.map(worldHtml).join('')}<div class="map-end"><p>🗻 更多關卡正在路上…</p></div></div></div>`;
    const cur = main().querySelector('.node.current');
    if (cur && !viewLearn.shown) setTimeout(() => cur.scrollIntoView({ block: 'center', behavior: 'instant' }), 30);
    viewLearn.shown = true;
  }
  viewLearn.shown = false;

  /* ───────────── 啟動關卡 ───────────── */
  async function launch(factory) {
    for (;;) {
      const cfg = factory();
      if (!cfg) return;
      if (!Q.canListen() && !launch.warned) { launch.warned = true; if (JP.tts.ok && !JP.tts.hasJa) toast('找不到日語語音，聽力題先略過囉'); }
      const res = await JP.play(cfg);
      const r = res && (res.result || (res.kind ? res : null));
      if (r && r.kind === 'placement' && typeof r.startWorld === 'number' && r.startWorld > 0) JP.startAtWorld(r.startWorld);
      refresh();
      if (r && r.lv && r.lv.leveledUp) await levelUp(r.lv.level);
      if (res && res.again) continue;
      break;
    }
  }
  function levelUp(lv) {
    return new Promise((resolve) => {
      const rk = JP.rankOf(lv);
      JP.sfx.level(); JP.ui.confetti({ n: 120 });
      modal(`<div class="lvup"><div class="hanko lg">Lv<br><b>${lv}</b></div><h2>升級了！</h2><p>你現在是「<b lang="ja">${rk[1]}</b>」（${rk[2]}）</p><button type="button" class="btn btn-big" data-close autofocus>太棒了</button></div>`, { onClose: resolve, cls: 'modal-center' });
    });
  }

  function nodeConfig(node) {
    if (node.type === 'boss') return { kind: 'boss', title: node.title, node, hearts: 3, questions: Q.planBoss(node) };
    if (node.type === 'grammar') { const g = JP.gmap.get(node.gid); return { kind: 'grammar', title: node.title, node, teachGrammar: g, questions: Q.grammarQs(g, 8) }; }
    return { kind: 'lesson', title: node.title, node, teachIds: node.items, questions: Q.planLesson(node.items) };
  }
  const runNode = (node) => launch(() => nodeConfig(node));

  function openNode(id) {
    const n = JP.nodeById.get(id);
    const s = JP.stateOf(n);
    if (s.locked) { toast('🔒 先完成前面的關卡，或使用「跳級挑戰」'); return; }
    const w = JP.worldOf(n.world);
    const its = n.items.map(JP.item);
    const done = s.done;
    const desc = n.type === 'boss' ? '鬼關有 14 題，只有 <b>3 顆心</b>，答錯會扣心。打倒鬼就能獲得世界朱印！' : n.type === 'grammar' ? '先看文法重點，再用填空與排列句子練習。' : its[0] && its[0].kind === 'kana' ? '先認識新的假名與記憶圖，再用聽音、選擇、輸入練習。' : '先認識新單字的圖片、發音和例句，再開始闖關。';
    const m = modal(`<div class="nsheet w-${w.theme}">
      <div class="ns-icon ${n.type}">${n.type === 'grammar' ? '文' : esc(n.icon)}</div>
      <h3 lang="ja">${esc(n.title)}</h3><p class="ns-sub">${esc(n.sub)}</p>
      ${its.length ? `<div class="ns-items" lang="ja">${its.slice(0, 14).map((i) => `<span title="${esc(i.zh)}">${i.em || esc(i.jp)}</span>`).join('')}${its.length > 14 ? `<span class="more">+${its.length - 14}</span>` : ''}</div>` : ''}
      <p class="ns-desc">${desc}</p>
      <div class="ns-meta"><span>${[0, 1, 2].map((k) => `<i class="${k < s.stars ? 'on' : ''}">${ICON.star()}</i>`).join('')}</span><span>${n.type === 'boss' ? '通關 +35 XP' : `完成 +${25} XP 起`}</span><span>${mmin(n.type === 'boss' ? 4 : n.type === 'grammar' ? 3 : 4)}</span></div>
      <button type="button" class="btn btn-big" data-run="${esc(n.id)}" autofocus>${done ? '再玩一次' : n.type === 'boss' ? '挑戰鬼關！' : '開始'}</button>
    </div>`, { sheet: true });
    m.el.querySelector('[data-run]').addEventListener('click', () => { m.close(); setTimeout(() => runNode(n), 120); });
  }

  function testOut(wid) {
    const w = JP.worldOf(wid);
    const boss = w.nodes[w.nodes.length - 1];
    const m = modal(`<div class="confirm"><div class="big-em">${w.em}</div><h3>跳級挑戰：${esc(w.title)}</h3><p>通過這場鬼關測驗（14 題、<b>3 顆心</b>）就能一次解鎖整個「${esc(w.zh)}」世界。已經會的內容不用再重複闖關！</p><div class="btn-row"><button type="button" class="btn btn-big" data-act="go" autofocus>接受挑戰</button><button type="button" class="btn btn-ghost" data-close>先不要</button></div></div>`);
    m.el.querySelector('[data-act="go"]').addEventListener('click', () => {
      m.close();
      setTimeout(() => launch(() => ({ kind: 'testout', title: '跳級挑戰', node: boss, hearts: 3, questions: Q.planBoss(boss, 14) })), 120);
    });
  }

  /* ───────────── 圖鑑 ───────────── */
  const dexState = { tab: 'word', filter: 'all', script: 'hira', q: '' };
  const lessonNode = {};
  JP.NODES.forEach((n) => { if (n.lesson) lessonNode[n.lesson] = n; });

  function boxDots(box) { return `<span class="mastery" title="熟練度">${Array.from({ length: 5 }, (_, i) => `<i class="${i < Math.ceil((box / JP.MAX_BOX) * 5) ? 'on' : ''}"></i>`).join('')}</span>`; }

  function viewDex() {
    const words = JP.itemList('word');
    const got = words.filter((w) => S.cards[w.id]).length;
    const kana = JP.itemList('kana');
    const gotK = kana.filter((k) => S.cards[k.id]).length;
    const tabs = `<div class="seg-tabs" role="tablist"><button type="button" role="tab" class="${dexState.tab === 'word' ? 'on' : ''}" data-dtab="word">單字圖鑑 <small>${got}/${words.length}</small></button><button type="button" role="tab" class="${dexState.tab === 'kana' ? 'on' : ''}" data-dtab="kana">假名表 <small>${gotK}/${kana.length}</small></button></div>`;
    main().innerHTML = `<div class="page dex"><header class="page-h"><h1>圖鑑</h1><p>每學會一個單字，就會點亮一張圖卡。</p></header>${tabs}<div id="dex-body"></div></div>`;
    renderDexBody();
  }

  function renderDexBody() {
    const el = document.getElementById('dex-body');
    if (!el) return;
    if (dexState.tab === 'kana') { el.innerHTML = kanaTables(); return; }
    const q = dexState.q.trim().toLowerCase();
    const filters = [['all', '全部'], ['got', '已收集'], ['todo', '未收集'], ['weak', '需加強']];
    let html = `<div class="dex-tools"><input id="dex-q" class="search" type="search" placeholder="搜尋日文、中文或羅馬拼音" value="${esc(dexState.q)}" aria-label="搜尋單字"><div class="chips-f">${filters.map(([k, l]) => `<button type="button" class="fchip ${dexState.filter === k ? 'on' : ''}" data-dfilter="${k}">${l}</button>`).join('')}</div></div>`;
    let any = false;
    JP.WORLDS.filter((w) => w.nodes.some((n) => n.lesson)).forEach((w) => {
      const blocks = w.nodes.filter((n) => n.lesson).map((n) => {
        const l = JP.lessonMap.get(n.lesson);
        let ws = l.words.map((x) => JP.item('w:' + x[0]));
        ws = ws.filter((it) => {
          const c = S.cards[it.id];
          if (dexState.filter === 'got' && !c) return false;
          if (dexState.filter === 'todo' && c) return false;
          if (dexState.filter === 'weak' && !(c && (c.ng > c.ok || c.box <= 1))) return false;
          if (q) return c && (it.jp.includes(q) || it.rd.includes(q) || it.zh.toLowerCase().includes(q) || it.ro.includes(q));
          return true;
        });
        if (!ws.length) return '';
        any = true;
        const gotN = l.words.filter((x) => S.cards['w:' + x[0]]).length;
        return `<div class="dex-lesson"><h3><span>${l.em}</span>${esc(l.title)}<small>${esc(l.zh)}・${gotN}/${l.words.length}</small></h3><div class="dex-grid">${ws.map((it) => {
          const c = S.cards[it.id];
          return c ? `<button type="button" class="dtile got" data-word="${esc(it.id)}"><span class="dt-pic">${it.em}</span><b lang="ja">${esc(it.jp)}</b><small>${esc(it.zh)}</small>${boxDots(c.box)}</button>`
            : `<button type="button" class="dtile locked" data-lock="${esc(n.id)}" aria-label="未收集"><span class="dt-pic">${it.em}</span><b>？？？</b><small>${esc(l.title)}</small></button>`;
        }).join('')}</div></div>`;
      }).join('');
      if (blocks) html += `<section class="dex-world w-${w.theme}"><h2><span>${w.em}</span>${esc(w.title)} <small>${esc(w.zh)}</small></h2>${blocks}</section>`;
    });
    if (!any) html += `<div class="empty"><div>🔍</div><p>${q ? '找不到符合的單字' : '這裡還是空的，去闖關收集吧！'}</p></div>`;
    el.innerHTML = html;
    const inp = document.getElementById('dex-q');
    if (inp && document.activeElement && document.activeElement.id === 'dex-q') inp.setSelectionRange(inp.value.length, inp.value.length);
  }

  const KANA_GRID = {
    basic: ['あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの', 'はひふへほ', 'まみむめも', 'や_ゆ_よ', 'らりるれろ', 'わ___を', 'ん____'],
    dakuten: ['がぎぐげご', 'ざじずぜぞ', 'だぢづでど', 'ばびぶべぼ', 'ぱぴぷぺぽ'],
  };
  function kanaTables() {
    const sc = dexState.script;
    const conv = (c) => (sc === 'hira' ? c : JP.KANA.toKata(c));
    const cell = (c) => {
      if (c === '_') return '<div class="kcell empty"></div>';
      const id = (sc === 'hira' ? 'h:' : 'k:') + conv(c);
      const it = JP.item(id);
      if (!it) return '<div class="kcell empty"></div>';
      const card = S.cards[id];
      const lvl = !card ? 'new' : card.box >= 4 ? 'master' : card.box >= 2 ? 'good' : 'learn';
      return `<button type="button" class="kcell ${lvl}" data-kana="${esc(id)}" lang="ja"><b>${esc(it.jp)}</b><small>${esc(it.ro)}</small></button>`;
    };
    const sec = (title, rows, cols) => `<h3 class="ktitle">${title}</h3><div class="kgrid c${cols}">${rows.map((r) => Array.from(r).map(cell).join('')).join('')}</div>`;
    const yoon = JP.KANA.yoonRows.filter((_, i) => i % 3 === 0).map((r, i) => [0, 1, 2].map((k) => JP.KANA.yoonRows[i * 3 + k][0]).join(''));
    const yoonCells = yoon.map((r) => Array.from(r.match(/.[ゃゅょ]/g)).map((c) => {
      const id = (sc === 'hira' ? 'h:' : 'k:') + conv(c);
      const it = JP.item(id); if (!it) return '';
      const card = S.cards[id];
      const lvl = !card ? 'new' : card.box >= 4 ? 'master' : card.box >= 2 ? 'good' : 'learn';
      return `<button type="button" class="kcell ${lvl}" data-kana="${esc(id)}" lang="ja"><b>${esc(it.jp)}</b><small>${esc(it.ro)}</small></button>`;
    }).join('')).join('');
    return `<div class="kana-tools"><div class="seg-tabs small"><button type="button" class="${sc === 'hira' ? 'on' : ''}" data-script="hira">ひらがな</button><button type="button" class="${sc === 'kata' ? 'on' : ''}" data-script="kata">カタカナ</button></div><div class="legend"><i class="new"></i>未學 <i class="learn"></i>學習中 <i class="good"></i>熟悉 <i class="master"></i>精通</div></div>
      ${sec('清音', KANA_GRID.basic, 5)}${sec('濁音・半濁音', KANA_GRID.dakuten, 5)}<h3 class="ktitle">拗音</h3><div class="kgrid c3">${yoonCells}</div>`;
  }

  function openWordSheet(id) {
    const it = JP.item(id);
    const c = S.cards[id];
    let status = '尚未學習';
    if (c) {
      const t = JP.dayKey();
      const days = JP.daysBetween(t, c.due);
      status = `熟練度 ${boxDots(c.box)}　答對 ${c.ok} 次・答錯 ${c.ng} 次<br>${days <= 0 ? '現在可以複習' : `下次複習：${days} 天後`}`;
    }
    const m = modal(`<div class="dsheet">${JP.cardOf(it)}<div class="ds-status">${status}</div></div>`, { sheet: true });
    if (S.set.auto && JP.tts.hasJa) setTimeout(() => JP.tts.speak(Q.sayOf(it)), 300);
    return m;
  }

  /* ───────────── 練習 ───────────── */
  function reviewConfig(kind) {
    let ids;
    if (kind === 'weak') ids = shuffle(JP.weakIds()).slice(0, 12);
    else if (kind === 'review') {
      ids = JP.dueIds().sort((a, b) => S.cards[a].due.localeCompare(S.cards[b].due) || S.cards[a].box - S.cards[b].box).slice(0, 12);
      if (!ids.length) ids = shuffle(JP.learnedIds()).slice(0, 10);
    } else ids = shuffle(JP.learnedIds());
    if (!ids.length) { toast('先完成一個關卡，才有東西可以練習喔'); return null; }
    if (kind === 'listen') {
      if (!Q.canListen()) { toast('這個裝置找不到日語語音，無法進行聽力特訓'); return null; }
      const qs = [];
      ids.forEach((id) => {
        const it = JP.item(id);
        const subs = it.kind === 'kana' ? ['listen2kana'] : ['listen2jp', 'listen2pic'];
        const q = Q.build(it, JP.pick(subs)) || Q.build(it, subs[0]);
        if (q) qs.push(q);
      });
      if (qs.length < 3) { toast('已學項目還不夠，先去闖關吧'); return null; }
      return { kind: 'listen', title: '聽力特訓', questions: qs.slice(0, 12) };
    }
    return { kind, title: kind === 'weak' ? '弱點加強' : '每日複習', questions: Q.planReview(ids, 12) };
  }
  function blitzConfig() {
    const ids = JP.learnedIds();
    if (ids.length < 6) { toast('至少要學過 6 個項目才能挑戰喔'); return null; }
    return { kind: 'blitz', title: '閃電挑戰', timer: 60, gen: Q.endless(ids), questions: [] };
  }
  function placementConfig() {
    const qs = Q.planPlacement();
    return { kind: 'placement', title: '程度測驗', questions: qs, teachIds: [] };
  }

  function viewPractice() {
    const due = JP.dueIds().length, weak = JP.weakIds().length, learned = JP.learnedIds().length;
    const listenOk = Q.canListen();
    const card = (cls, ico, title, desc, stat, go, disabled) => `<button type="button" class="card pcard ${cls}" data-go="${go}"${disabled ? ' data-disabled="1"' : ''}><span class="pc-ico">${ico}</span><div><h3>${title}</h3><p>${desc}</p></div><span class="pc-stat">${stat}</span></button>`;
    main().innerHTML = `<div class="page"><header class="page-h"><h1>練習</h1><p>用不同玩法，把學過的單字記得更牢。</p></header>
      <div class="pgrid">
        ${card('p-review', '🔁', '每日複習', '根據遺忘曲線，在快忘記時再複習一次', due ? `<b>${due}</b>待複習` : '<b>0</b>已完成', 'review', !learned)}
        ${card('p-weak', '🎯', '弱點加強', '集中練習常常答錯的項目', weak ? `<b>${weak}</b>個弱點` : '<b>0</b>太強了', 'weak', !weak)}
        ${card('p-listen', '👂', '聽力特訓', listenOk ? '只聽聲音選答案，訓練耳朵' : '需要裝置有日語語音', `<b>${S.stats.listening}</b>累計答對`, 'listen', !learned || !listenOk)}
        ${card('p-blitz', '⚡', '閃電挑戰', '60 秒內盡量多答對，挑戰個人紀錄', `<b>${S.stats.blitz}</b>最佳紀錄`, 'blitz', learned < 6)}
        ${card('p-place', '🧭', '程度測驗', '12 題判斷你的程度，並調整起點', '2 分鐘', 'placement', false)}
      </div>
      ${!learned ? '<p class="hint-p">先去「學習」完成第一個關卡，就能解鎖練習。</p>' : ''}</div>`;
  }

  /* ───────────── 我的 ───────────── */
  function viewMe() {
    const L = JP.levelInfo(), rk = JP.rankOf(L.level);
    const learnedW = JP.learnedIds().filter((i) => i[0] === 'w').length, learnedK = JP.learnedIds().filter((i) => i[0] !== 'w').length;
    const acc = S.stats.answered ? Math.round((S.stats.correct / S.stats.answered) * 100) : 0;
    const stamps = JP.WORLDS.map((w) => {
      const got = S.stamps[w.id];
      return `<div class="stamp ${got ? 'got' : ''}" title="${esc(w.title)}"><div class="hanko ${got ? '' : 'ghost'}">${esc(w.zh.slice(0, 2))}</div><small>${esc(w.title)}</small></div>`;
    }).join('');
    const ach = JP.ACH.map((a) => `<div class="ach ${S.ach[a.id] ? 'got' : ''}" title="${esc(a.desc)}"><span>${a.em}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div>`).join('');
    const voices = JP.tts.list();
    const voiceSel = voices.length ? `<select id="set-voice" aria-label="選擇語音">${voices.map((v) => `<option value="${esc(v.name)}"${(JP.tts.current() && JP.tts.current().name === v.name) ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select>` : `<span class="muted">未偵測到</span>`;
    const sw = (key, label, desc) => `<label class="setrow"><div><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</div><input type="checkbox" class="switch" data-set="${key}" ${S.set[key] ? 'checked' : ''}></label>`;
    main().innerHTML = `<div class="page me">
      <section class="card profile">
        <div class="hanko lg">Lv<br><b>${L.level}</b></div>
        <div class="pf-main"><h1 lang="ja">${rk[1]}<small>${rk[2]}</small></h1><div class="xpbar"><i style="width:${L.pct}%"></i></div><small>總經驗值 ${S.xp} XP・距離下一級還差 ${L.need - L.cur} XP</small></div>
      </section>
      <div class="two"><div>${streakCard()}</div><div>${goalCard()}</div></div>
      <p class="freeze">❄️ 連勝凍結 ×${S.freezes}：漏學一天時會自動使用，連續 7 天可獲得 1 個（最多 2 個）</p>
      <section class="card"><h3>學習統計</h3><div class="stat-grid">
        <div><b>${learnedW}</b><span>已收集單字</span></div><div><b>${learnedK}</b><span>已學假名</span></div>
        <div><b>${S.stats.lessons}</b><span>通過關卡</span></div><div><b>${acc}%</b><span>整體正確率</span></div>
        <div><b>${S.bestStreak}</b><span>最長連勝（天）</span></div><div><b>${S.stats.bestCombo}</b><span>最高連擊</span></div></div></section>
      <section class="card"><h3>朱印帳 <small class="muted">通關每個世界的鬼關，蓋下一枚朱印</small></h3><div class="stamps">${stamps}</div></section>
      <section class="card"><h3>成就 <small class="muted">${Object.keys(S.ach).length} / ${JP.ACH.length}</small></h3><div class="achs">${ach}</div></section>
      <section class="card settings" id="settings"><h3>設定</h3>
        <div class="setrow col"><div><b>每日目標</b><small>每天賺到的經驗值（XP）</small></div><div class="seg-tabs small" id="goal-seg">${[[30, '輕鬆 30'], [50, '一般 50'], [100, '認真 100']].map(([n, l]) => `<button type="button" class="${S.goal === n ? 'on' : ''}" data-goal="${n}">${l}</button>`).join('')}</div></div>
        <div class="setrow col"><div><b>外觀</b></div><div class="seg-tabs small">${[['auto', '跟隨系統'], ['light', '淺色'], ['dark', '深色']].map(([k, l]) => `<button type="button" class="${S.set.theme === k ? 'on' : ''}" data-theme="${k}">${l}</button>`).join('')}</div></div>
        ${sw('auto', '自動播放發音', '答對後與教學卡會自動唸出日語')}
        ${sw('slow', '慢速發音', '播放時使用較慢的語速')}
        ${sw('sound', '音效', '答對、答錯、通關的聲音')}
        ${sw('haptic', '震動回饋', '手機上答題時震動')}
        ${sw('romaji', '顯示羅馬拼音', '在單字下方顯示 Romaji')}
        ${sw('furi', '顯示振假名', '在漢字上方顯示假名讀音')}
        <div class="setrow"><div><b>日語語音</b><small id="voice-note">${JP.tts.hasJa ? `偵測到 ${voices.length} 個日語語音` : JP.tts.ok ? '尚未偵測到日語語音' : '此瀏覽器不支援語音'}</small></div><div class="voice-box">${voiceSel}<button type="button" class="btn btn-sm" data-act="testvoice">試聽</button></div></div>
        <details class="voice-help" ${JP.tts.hasJa ? '' : 'open'}><summary>沒有聲音？如何安裝日語語音</summary><ul>
          <li><b>iPhone / iPad</b>：設定 → 輔助使用 → 語音內容 → 聲音 → 日文，下載一個聲音。</li>
          <li><b>Android</b>：設定 → 系統 → 語言 → 文字轉語音輸出，安裝「日文」語音資料。</li>
          <li><b>Windows</b>：設定 → 時間與語言 → 語音，新增「日本語」語音套件；建議使用 Edge 瀏覽器。</li>
          <li><b>macOS</b>：系統設定 → 輔助使用 → 語音內容 → 系統語音，新增日文語音（如 Kyoko）。</li>
          <li>語音由瀏覽器／系統提供，完全離線可用，不會上傳任何資料。</li></ul></details>
      </section>
      <section class="card"><h3>資料</h3><p class="muted small">進度只儲存在這個瀏覽器裡，換裝置前請先匯出備份。</p>
        <div class="btn-row wrap"><button type="button" class="btn btn-sm" data-act="export">匯出備份</button><button type="button" class="btn btn-sm" data-act="import">匯入備份</button><button type="button" class="btn btn-sm" data-act="replace">重新選擇程度</button><button type="button" class="btn btn-sm danger" data-act="reset">清除所有進度</button></div>
        <input type="file" id="import-file" accept="application/json" hidden></section>
    </div>`;
  }

  function testVoice() {
    if (!JP.tts.ok) return toast('此瀏覽器不支援語音');
    if (!JP.tts.hasJa) toast('找不到日語語音，聲音可能不是日語');
    JP.tts.speak('こんにちは。にほんごを べんきょう しましょう。');
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nihongo-progress-${JP.dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importData(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const o = JSON.parse(fr.result);
        if (typeof o.xp !== 'number' || typeof o.cards !== 'object') throw new Error('bad');
        Object.keys(S).forEach((k) => delete S[k]);
        Object.assign(S, JP.defaults(), o);
        S.set = Object.assign(JP.defaults().set, o.set || {});
        S.stats = Object.assign(JP.defaults().stats, o.stats || {});
        JP.save(); applyTheme(); toast('匯入完成'); refresh(); updateChips();
      } catch (e) { toast('檔案格式不正確'); }
    };
    fr.readAsText(file);
  }
  function resetData() {
    const m = modal(`<div class="confirm"><h3>清除所有進度？</h3><p>經驗值、連勝、單字收集與成就都會消失，無法復原。建議先匯出備份。</p><div class="btn-row"><button type="button" class="btn btn-big" data-close autofocus>取消</button><button type="button" class="btn btn-ghost danger" data-act="yes">確定清除</button></div></div>`);
    m.el.querySelector('[data-act="yes"]').addEventListener('click', () => {
      try { localStorage.removeItem('jpl.v2'); localStorage.removeItem('jpl.v1'); } catch (e) { /* 略過 */ }
      location.reload();
    });
  }

  function applyTheme() {
    const t = S.set.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (meta) meta.content = dark ? '#17151c' : '#f6efe2';
  }

  /* ───────────── 歡迎頁 / 程度選擇 ───────────── */
  function showWelcome(opts = {}) {
    const root = document.getElementById('overlay');
    const levels = [
      [0, '🌱', '完全沒學過', '從平假名開始，一步一步來'],
      [3, '🌸', '會五十音', '直接學單字與基本句子'],
      [4, '🍵', '學過一些 N5', '已認識基礎單字，想練日常用語'],
      [5, '🗻', '已有 N5 程度', '準備挑戰 N4 的單字與文法'],
    ];
    let lvl = 0, goal = S.goal || 50;
    root.className = 'overlay open k-welcome';
    document.body.classList.add('noscroll');
    root.innerHTML = `<div class="welcome"><div class="wel-in">
      <div class="wel-mascot" aria-hidden="true">🐱</div>
      <h1 lang="ja">にほんご<span>冒險</span></h1>
      <p class="wel-lead">闖關、收集圖鑑、聽發音，<br>每天 5 分鐘，連勝不中斷。</p>
      <h3>你的日語程度？</h3>
      <div class="lvl-list" role="radiogroup">${levels.map(([w, e, t, d], i) => `<button type="button" class="lvl-opt ${i === 0 ? 'on' : ''}" role="radio" aria-checked="${i === 0}" data-lvl="${w}"><span>${e}</span><div><b>${t}</b><small>${d}</small></div></button>`).join('')}</div>
      <button type="button" class="link-btn" data-act="placement">不確定？做個 2 分鐘的程度測驗 ›</button>
      <h3>每日目標</h3>
      <div class="seg-tabs" id="wel-goal">${[[30, '輕鬆', '30 XP'], [50, '一般', '50 XP'], [100, '認真', '100 XP']].map(([n, l, x]) => `<button type="button" class="${n === goal ? 'on' : ''}" data-goal="${n}">${l}<small>${x}</small></button>`).join('')}</div>
      <button type="button" class="btn btn-big" data-act="begin">開始冒險</button>
      ${opts.cancel ? '<button type="button" class="link-btn" data-act="cancel">取消</button>' : ''}
    </div></div>`;
    const close = () => { root.classList.remove('open'); document.body.classList.remove('noscroll'); setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 250); };
    root.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.lvl !== undefined) { lvl = +b.dataset.lvl; root.querySelectorAll('.lvl-opt').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); }
      else if (b.dataset.goal) { goal = +b.dataset.goal; root.querySelectorAll('#wel-goal button').forEach((x) => x.classList.toggle('on', x === b)); }
      else if (b.dataset.act === 'cancel') close();
      else if (b.dataset.act === 'begin') {
        S.goal = goal; S.onboarded = true;
        if (lvl > 0) JP.startAtWorld(lvl);
        JP.save(); close(); viewLearn.shown = false; refresh(); updateChips();
        if (lvl > 0) toast('已為你解鎖前面的世界，隨時都能回去複習');
      } else if (b.dataset.act === 'placement') {
        S.goal = goal; S.onboarded = true; JP.save();
        close();
        const res = await JP.play(placementConfig());
        const r = res && (res.result || res);
        if (r && typeof r.startWorld === 'number' && r.startWorld > 0) JP.startAtWorld(r.startWorld);
        viewLearn.shown = false; refresh(); updateChips();
      }
    };
  }

  /* ───────────── 路由與重繪 ───────────── */
  const ROUTES = { learn: viewLearn, dex: viewDex, practice: viewPractice, me: viewMe };
  let currentRoute = 'learn';
  function route() {
    const name = (location.hash.replace(/^#\/?/, '').split('/')[0] || 'learn');
    currentRoute = ROUTES[name] ? name : 'learn';
    document.querySelectorAll('[data-tab]').forEach((a) => { a.classList.toggle('on', a.dataset.tab === currentRoute); if (a.dataset.tab === currentRoute) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    ROUTES[currentRoute]();
    if (currentRoute !== 'learn') window.scrollTo({ top: 0, behavior: 'instant' });
    updateChips();
  }
  function refresh() {
    const y = window.scrollY;
    ROUTES[currentRoute]();
    window.scrollTo({ top: y, behavior: 'instant' });
    updateChips();
  }
  function updateChips() {
    const L = JP.levelInfo();
    document.querySelectorAll('[data-chip="streak"]').forEach((e) => { e.textContent = JP.streakDisplay(); e.closest('.chip').classList.toggle('lit', JP.doneToday()); });
    document.querySelectorAll('[data-chip="level"]').forEach((e) => { e.textContent = L.level; });
    document.querySelectorAll('[data-chip="xp"]').forEach((e) => { e.style.width = L.pct + '%'; });
  }

  /* ───────────── 事件 ───────────── */
  function bind() {
    main().addEventListener('click', (e) => {
      const t = e.target;
      let el;
      if ((el = t.closest('[data-node]'))) return openNode(el.dataset.node);
      if ((el = t.closest('[data-testout]'))) return testOut(el.dataset.testout);
      if ((el = t.closest('[data-go]'))) {
        if (el.dataset.disabled) { toast('先去闖幾個關卡再來吧'); return; }
        const g = el.dataset.go;
        if (g === 'me') { location.hash = '#/me'; setTimeout(() => { const s = document.getElementById('settings'); if (s) s.scrollIntoView({ behavior: 'smooth' }); }, 80); return; }
        if (g === 'review' || g === 'weak' || g === 'listen') return launch(() => reviewConfig(g));
        if (g === 'blitz') return launch(blitzConfig);
        if (g === 'placement') return launch(placementConfig);
        return;
      }
      if ((el = t.closest('[data-dtab]'))) { dexState.tab = el.dataset.dtab; return viewDex(); }
      if ((el = t.closest('[data-dfilter]'))) { dexState.filter = el.dataset.dfilter; return renderDexBody(); }
      if ((el = t.closest('[data-script]'))) { dexState.script = el.dataset.script; return viewDex(); }
      if ((el = t.closest('[data-word]'))) return openWordSheet(el.dataset.word);
      if ((el = t.closest('[data-kana]'))) return openWordSheet(el.dataset.kana);
      if ((el = t.closest('[data-lock]'))) { const n = JP.nodeById.get(el.dataset.lock); return toast(`🔒 完成「${esc(n.title)}」就會解鎖`); }
      if ((el = t.closest('[data-goal]'))) { S.goal = +el.dataset.goal; JP.save(); return refresh(); }
      if ((el = t.closest('[data-theme]'))) { S.set.theme = el.dataset.theme; JP.save(); applyTheme(); return refresh(); }
      if ((el = t.closest('[data-act]'))) {
        const a = el.dataset.act;
        if (a === 'testvoice') return testVoice();
        if (a === 'export') return exportData();
        if (a === 'import') return document.getElementById('import-file').click();
        if (a === 'reset') return resetData();
        if (a === 'replace') return showWelcome({ cancel: true });
      }
    });
    main().addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset && t.dataset.set) { S.set[t.dataset.set] = t.checked; JP.save(); if (t.dataset.set === 'sound' && t.checked) JP.sfx.correct(); return; }
      if (t.id === 'set-voice') { S.set.voice = t.value; JP.save(); testVoice(); return; }
      if (t.id === 'import-file' && t.files[0]) importData(t.files[0]);
    });
    main().addEventListener('input', (e) => { if (e.target.id === 'dex-q') { dexState.q = e.target.value; renderDexBody(); } });
    JP.on('voices', () => { if (currentRoute === 'me' || currentRoute === 'practice') { if (!document.querySelector('.overlay.open')) refresh(); } else if (currentRoute === 'learn' && !document.querySelector('.overlay.open')) { const b = main().querySelector('.map-col'); if (b) { const old = b.querySelector('.banner.warn'); const nb = voiceBanner(); if (old && !nb) old.remove(); else if (!old && nb) b.insertAdjacentHTML('afterbegin', nb); } } });
  }

  JP.views = { route, refresh, updateChips, applyTheme, showWelcome, bind, launch };
})();
