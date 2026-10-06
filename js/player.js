/* player.js — 關卡播放器：教學卡 → 題目 → 回饋 → 結算 */
(function () {
  'use strict';
  const JP = window.JP;
  const S = JP.S;
  const { esc, shuffle, ruby, plain, normRo } = JP;
  const { ICON, speakBtn } = JP.ui;
  const Q = JP.Q;

  const KIND_LABEL = { lesson: '關卡', grammar: '文法', boss: '鬼關', testout: '跳級挑戰', review: '每日複習', weak: '弱點加強', listen: '聽力特訓', blitz: '閃電挑戰', placement: '程度測驗' };

  /* ───── 項目卡片（回饋與教學共用） ───── */
  function itemReveal(it) {
    const romaji = S.set.romaji;
    if (it.kind === 'kana') {
      return `<div class="rv"><span class="rv-pic">${it.em || ''}</span><div class="rv-main"><div class="rv-jp" lang="ja">${esc(it.jp)} <small>${esc(it.ro)}</small></div>${it.word ? `<div class="rv-sub" lang="ja">${Q.exampleHtml(it)}　${esc(it.wordZh)}</div>` : ''}</div>${speakBtn(it.jp, 'inline')}</div>`;
    }
    return `<div class="rv"><span class="rv-pic">${it.em}</span><div class="rv-main"><div class="rv-jp" lang="ja">${Q.jpHtml(it)}</div><div class="rv-sub">${romaji ? esc(it.ro) + '　' : ''}${esc(it.zh)}</div></div>${speakBtn(it.rd, 'inline')}</div>`;
  }

  function kanaCard(it) {
    const tip = JP.KANA.tips[it.jp];
    return `<article class="tcard kana">
      <div class="tc-kana" lang="ja">${esc(it.jp)}</div>
      <div class="tc-ro">${esc(it.ro)}</div>
      <div class="tc-say">${speakBtn(it.jp, 'big')}${speakBtn(it.jp, 'slow', true)}</div>
      ${it.word ? `<div class="tc-mn"><span class="mn-pic">${it.em}</span><div><div class="mn-word" lang="ja">${Q.exampleHtml(it)}</div><div class="mn-zh">${esc(it.wordZh)}</div></div>${speakBtn(it.word, 'inline')}</div>` : '<p class="tc-hint">拗音是「兩個假名合成一個音」，小字的ゃ／ゅ／ょ要和前面的字連在一起唸。</p>'}
      ${tip ? `<div class="tc-tip"><span>💡</span>${esc(tip)}</div>` : ''}
    </article>`;
  }
  function wordCard(it) {
    return `<article class="tcard">
      <div class="tc-pic" aria-hidden="true">${it.em}</div>
      <div class="tc-jp" lang="ja">${Q.jpHtml(it)}</div>
      ${S.set.romaji ? `<div class="tc-ro">${esc(it.ro)}</div>` : ''}
      <div class="tc-zh">${esc(it.zh)}</div>
      <div class="tc-say">${speakBtn(it.rd, 'big')}${speakBtn(it.rd, 'slow', true)}</div>
      ${it.ex ? `<div class="tc-ex"><div class="ex-jp" lang="ja">${ruby(it.ex)}${speakBtn(plain(it.ex), 'inline')}</div><div class="ex-zh">${esc(it.exZh)}</div></div>` : ''}
      ${it.tip ? `<div class="tc-tip"><span>💡</span>${esc(it.tip)}</div>` : ''}
    </article>`;
  }
  const cardOf = (it) => (it.kind === 'kana' ? kanaCard(it) : wordCard(it));

  function grammarTeach(g) {
    return `<article class="tcard gteach">
      <div class="g-level">${esc(g.level)} 文法</div>
      <h2 class="g-title" lang="ja">${esc(g.title)}</h2>
      <div class="g-pat" lang="ja">${esc(g.pattern)}</div>
      <div class="g-body">${g.body}</div>
      <h4>例句</h4>
      <ul class="g-ex">${g.examples.map(([s, zh]) => `<li><div class="ex-jp" lang="ja">${ruby(s)}${speakBtn(plain(s), 'inline')}</div><div class="ex-zh">${esc(zh)}</div></li>`).join('')}</ul>
    </article>`;
  }

  /* ───── 題目畫面 ───── */
  function promptHtml(q) {
    const p = q.prompt || {};
    if (q.type === 'order') {
      return `<div class="bubble-row"><span class="mascot" aria-hidden="true">🐱</span><div class="bubble">${esc(p.zh)}${p.say ? speakBtn(p.say, 'inline') : ''}</div></div>`;
    }
    let h = '';
    if (p.listen) h += `<div class="q-listen">${speakBtn(p.say, 'big')}${speakBtn(p.say, 'slow', true)}</div>`;
    if (p.em) h += `<div class="q-em" aria-hidden="true">${p.em}</div>`;
    if (p.jp) h += `<div class="q-jp" lang="ja">${p.jp}${p.say ? speakBtn(p.say, 'inline') : ''}</div>`;
    if (p.ro) h += `<div class="q-ro">${esc(p.ro)}${p.say ? speakBtn(p.say, 'inline') : ''}</div>`;
    if (p.html) h += `<div class="q-sent" lang="ja">${p.html}${p.sentence && p.say ? speakBtn(p.say, 'inline') : ''}</div>`;
    if (p.zh) h += `<div class="q-zh">${esc(p.zh)}</div>`;
    return `<div class="q-prompt${p.em && !p.jp && !p.html ? ' pic-only' : ''}">${h}</div>`;
  }

  function questionHtml(q) {
    let body = '';
    if (q.type === 'choice') {
      body = `<div class="choices ${q.layout}">${q.choices.map((c, i) => `<button type="button" class="choice" data-i="${i}"><kbd>${i + 1}</kbd><span class="cv" lang="ja">${c.html}</span></button>`).join('')}</div>`;
    } else if (q.type === 'order') {
      body = `<div class="ans-line" id="ans" aria-label="你的答案"></div><div class="bank" id="bank"></div>`;
    } else if (q.type === 'type') {
      body = `<div class="type-wrap"><input id="tin" class="tin" type="text" inputmode="latin" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="${esc(q.placeholder || '')}" aria-label="輸入羅馬拼音"></div>`;
    } else if (q.type === 'match') {
      const rights = shuffle(q.pairs.map((p) => p));
      body = `<div class="match"><div class="mcol" data-side="l">${q.pairs.map((p) => `<button type="button" class="mt" data-side="l" data-id="${esc(p.id)}"><span lang="ja">${p.left}</span></button>`).join('')}</div><div class="mcol" data-side="r">${rights.map((p) => `<button type="button" class="mt" data-side="r" data-id="${esc(p.id)}"><span>${p.right}</span></button>`).join('')}</div></div>`;
    }
    return `<h2 class="q-title">${esc(q.title)}</h2>${promptHtml(q)}${body}`;
  }

  /* ───── 主程式 ───── */
  function play(cfg) {
    return new Promise((resolve) => {
      const root = document.getElementById('overlay');
      const world = cfg.node ? JP.worldOf(cfg.node.world) : null;
      const st = {
        queue: [], planned: 0, answeredN: 0, firstTotal: 0, firstCorrect: 0, mistakes: 0, combo: 0, bestCombo: 0,
        hearts: cfg.hearts || 0, xpLive: 0, srsDone: new Set(), touched: new Set(), startKnown: new Set(JP.learnedIds()), t0: Date.now(),
        retried: new Set(), tierRes: {}, timeLeft: cfg.timer || 0, score: 0, over: false,
      };
      let phase = 'teach'; // teach | ask | checked | result
      let cur = null; // 目前題目狀態
      let ti = 0; // 教學卡索引
      let timer = 0;
      let nextTimer = 0;
      const teachIds = cfg.teachIds || [];
      const gen = cfg.gen || null;

      st.queue = (cfg.questions || []).slice();
      st.planned = st.queue.length;
      if (gen) { for (let i = 0; i < 3; i++) { const q = gen(); if (q) st.queue.push(q); } st.planned = 0; }

      const hasTeach = teachIds.length > 0 || !!cfg.teachGrammar;
      phase = hasTeach ? 'teach' : 'ask';

      /* ----- 外框 ----- */
      root.className = `overlay open k-${cfg.kind}${world ? ' w-' + world.theme : ''}`;
      document.body.classList.add('noscroll');
      root.innerHTML = `<div class="play">
        <header class="play-top">
          <button type="button" class="icon-btn" data-act="quit" aria-label="離開">${ICON.close()}</button>
          <div class="pbar" aria-hidden="true"><i id="pfill"></i></div>
          <div class="hud" id="hud"></div>
        </header>
        <div class="play-scroll"><div class="play-body" id="pb"></div></div>
        <footer class="play-foot" id="pf"></footer>
      </div>`;
      const $ = (id) => root.querySelector('#' + id);
      const pb = $('pb'), pf = $('pf');

      function hud() {
        let h = '';
        if (cfg.timer) h += `<span class="hud-time">${Math.max(0, Math.ceil(st.timeLeft))}</span>`;
        if (cfg.hearts) h += `<span class="hud-hearts">${Array.from({ length: cfg.hearts }, (_, i) => `<span class="${i < st.hearts ? 'on' : 'off'}">${ICON.heart()}</span>`).join('')}</span>`;
        if (cfg.timer || cfg.kind === 'blitz') h += `<span class="hud-score">${st.score}</span>`;
        if (st.combo >= 2) h += `<span class="hud-combo" title="連續答對">${ICON.flame()}<b>${st.combo}</b></span>`;
        $('hud').innerHTML = h;
      }
      function progress() {
        let pct;
        if (cfg.timer) pct = (st.timeLeft / cfg.timer) * 100;
        else if (phase === 'teach') pct = 0;
        else pct = st.planned ? (Math.min(st.answeredN, st.planned) / st.planned) * 100 : 0;
        $('pfill').style.width = pct + '%';
      }

      /* ----- 教學階段 ----- */
      const items = teachIds.map(JP.item).filter(Boolean);
      const useGrid = items.length >= 8;
      function renderTeach() {
        phase = 'teach';
        if (cfg.teachGrammar) {
          pb.innerHTML = grammarTeach(cfg.teachGrammar);
          pf.innerHTML = `<button type="button" class="btn btn-big" data-act="start" autofocus>我學會了，開始挑戰</button>`;
        } else if (useGrid) {
          pb.innerHTML = `<h2 class="q-title">新的字，先點一點聽聽看</h2><div class="tgrid">${items.map((it) => `<button type="button" class="tg" data-say="${esc(it.kind === 'kana' ? it.jp : it.rd)}" lang="ja"><span class="tg-c">${esc(it.jp)}</span><span class="tg-r">${esc(it.ro)}</span>${it.em ? `<span class="tg-e">${it.em}</span>` : ''}</button>`).join('')}</div>${items.some((i) => i.yoon) ? '<p class="tc-hint">拗音是「兩個假名合成一個音」，例如 き＋ゃ → きゃ（kya）。</p>' : '<p class="tc-hint">每個字右下角的圖是「記憶點」，把圖和聲音連在一起記。</p>'}`;
          pf.innerHTML = `<button type="button" class="btn btn-big" data-act="start" autofocus>開始挑戰</button>`;
        } else {
          const it = items[ti];
          pb.innerHTML = `<div class="tdots">${items.map((_, i) => `<i class="${i === ti ? 'on' : i < ti ? 'done' : ''}"></i>`).join('')}</div><div class="tcard-wrap" key="${ti}">${cardOf(it)}</div>`;
          const last = ti === items.length - 1;
          pf.innerHTML = `${ti > 0 ? `<button type="button" class="btn btn-ghost" data-act="tprev" aria-label="上一個">${ICON.back()}</button>` : ''}<button type="button" class="btn btn-big" data-act="${last ? 'start' : 'tnext'}" autofocus>${last ? '開始挑戰' : '下一個'}</button>`;
          if (S.set.auto && JP.tts.hasJa) setTimeout(() => { if (phase === 'teach') JP.tts.speak(Q.sayOf(it)); }, 350);
        }
        progress(); hud();
        root.querySelector('.play-scroll').scrollTop = 0;
        const f = pf.querySelector('[autofocus]'); if (f) f.focus({ preventScroll: true });
      }

      /* ----- 出題 ----- */
      function nextQuestion() {
        clearTimeout(nextTimer);
        if (st.over) return;
        if (gen && st.queue.length < 3) { const q = gen(); if (q) st.queue.push(q); }
        if (!st.queue.length) return finish(true);
        const q = st.queue.shift();
        cur = { q, sel: null, placed: [], bank: q.tiles ? q.tiles.slice() : [], matched: new Set(), pick: null, wrongPairs: new Set(), mistakes: 0, done: false };
        phase = 'ask';
        JP.curQ = cur;
        pb.innerHTML = `<div class="qwrap">${questionHtml(q)}</div>`;
        const skip = cfg.kind === 'placement' ? `<button type="button" class="btn btn-ghost" data-act="skip">我不知道</button>` : '';
        pf.className = 'play-foot';
        pf.innerHTML = q.type === 'match' ? `<p class="foot-hint">點左邊，再點右邊的對應項目</p>` : `${skip}<button type="button" class="btn btn-big" data-act="check" id="go" disabled>確認</button>`;
        if (q.type === 'order') renderOrder();
        if (q.type === 'type') setTimeout(() => { const i = $('tin'); if (i) i.focus({ preventScroll: true }); }, 80);
        progress(); hud();
        root.querySelector('.play-scroll').scrollTop = 0;
        if (q.prompt && q.prompt.auto && Q.canListen()) setTimeout(() => { if (cur && cur.q === q && phase === 'ask') JP.tts.speak(q.prompt.say); }, 300);
      }

      function renderOrder() {
        const ans = $('ans'), bank = $('bank');
        ans.innerHTML = cur.placed.map((t, i) => `<button type="button" class="tile" data-from="ans" data-k="${i}" lang="ja">${t.html}</button>`).join('');
        bank.innerHTML = cur.bank.map((t, i) => `<button type="button" class="tile" data-from="bank" data-k="${i}" lang="ja">${t.html}</button>`).join('') + cur.placed.map(() => '').join('');
        const g = $('go'); if (g) g.disabled = cur.placed.length === 0;
      }

      function grade() {
        const q = cur.q;
        if (q.type === 'choice') return cur.sel != null && !!q.choices[cur.sel].correct;
        if (q.type === 'order') return cur.placed.map((t) => plain(t.t)).join('|') === q.answer.join('|');
        if (q.type === 'type') { const v = ($('tin').value || '').trim(); return v !== '' && normRo(v) === normRo(q.accept); }
        return false;
      }

      function record(ok, q, skipped) {
        const first = !(q.retry);
        st.answeredN++;
        S.stats.answered++;
        if (ok) { S.stats.correct++; if (q.listening) S.stats.listening++; }
        if (first) {
          st.firstTotal++; if (ok) st.firstCorrect++; else st.mistakes++;
          if (q.tierIdx !== undefined) { const t = (st.tierRes[q.tierIdx] = st.tierRes[q.tierIdx] || { c: 0, n: 0 }); t.n++; if (ok) t.c++; }
        }
        // 間隔重複（程度測驗不計）
        if (cfg.kind !== 'placement') {
          const ids = q.type === 'match' ? q.itemIds : q.itemId ? [q.itemId] : [];
          ids.forEach((id) => {
            st.touched.add(id);
            if (q.type === 'match') { if (!st.srsDone.has(id)) { JP.review(id, !cur.wrongPairs.has(id)); st.srsDone.add(id); } }
            else if (!st.srsDone.has(id)) { JP.review(id, ok); st.srsDone.add(id); }
            else if (ok) { const c = JP.card(id); if (c) { c.ok++; } }
          });
        }
        if (ok) {
          st.combo++; st.bestCombo = Math.max(st.bestCombo, st.combo); S.stats.bestCombo = Math.max(S.stats.bestCombo, st.bestCombo);
          st.xpLive += 2 + (st.combo >= 5 ? 1 : 0);
          st.score++;
        } else {
          st.combo = 0;
          if (cfg.hearts) st.hearts--;
        }
        JP.saveSoon();
      }

      function requeue(q, ok) {
        if (ok || q.retry || q.type === 'match' || cfg.kind === 'boss' || cfg.kind === 'testout' || cfg.kind === 'placement' || cfg.kind === 'blitz') return;
        let again = null;
        if (q.itemId) { const it = JP.item(q.itemId); again = Q.makeQ(it, 'easy', [q.sub]); }
        else { again = Object.assign({}, q, { choices: q.choices ? shuffle(q.choices) : q.choices, tiles: q.tiles ? shuffle(q.tiles) : q.tiles }); }
        if (!again) return;
        again.retry = true;
        st.queue.push(again);
        st.planned++;
      }

      function revealFor(q) {
        if (q.reveal && q.reveal.html) return { html: q.reveal.html + (q.reveal.itemId ? itemReveal(JP.item(q.reveal.itemId)) : ''), say: q.prompt && q.prompt.say };
        if (q.type === 'match') return { html: '', say: '' };
        const it = q.itemId ? JP.item(q.itemId) : null;
        return { html: it ? itemReveal(it) : '', say: it ? Q.sayOf(it) : '' };
      }

      function feedback(ok, q, skipped) {
        phase = 'checked';
        const rv = revealFor(q);
        const praise = ['太棒了！', '答對了！', '漂亮！', '正確！', 'すごい！'];
        const cheer = st.combo >= 3 ? `<span class="combo-pop">${ICON.flame()}連擊 ×${st.combo}</span>` : '';
        pf.className = 'play-foot fb-' + (ok ? 'ok' : 'ng');
        const needAnswer = q.type === 'order' || q.type === 'type' || q.type === 'choice';
        const ansLine = !ok && q.type === 'type' ? `<div class="rv-ans">正確答案：<b>${esc(q.accept)}</b></div>` : '';
        const head = ok ? `<b>${praise[Math.floor(Math.random() * praise.length)]}</b>${cheer}` : `<b>${skipped ? '沒關係，記住它！' : q.type === 'match' ? '再多看一次！' : '正確答案是…'}</b>`;
        pf.innerHTML = `<div class="fb"><div class="fb-head"><span class="fb-ico">${ok ? ICON.check() : ICON.close()}</span>${head}</div>${needAnswer || rv.html ? `<div class="fb-body">${ansLine}${rv.html}</div>` : ''}</div><button type="button" class="btn btn-big ${ok ? 'btn-ok' : 'btn-ng'}" data-act="next" autofocus>${cfg.hearts && st.hearts <= 0 ? '看結果' : '繼續'}</button>`;
        JP.sfx[ok ? 'correct' : 'wrong'](); JP.buzz(ok ? 12 : [30, 40, 30]);
        if (ok && st.combo >= 3 && [3, 5, 8, 10, 15, 20].includes(st.combo)) setTimeout(() => JP.sfx.combo(st.combo), 260);
        const btn = pf.querySelector('[data-act="next"]'); if (btn) btn.focus({ preventScroll: true });
        // 答對後讀出答案（聽力題已經聽過，略過）
        if (ok && S.set.auto && rv.say && !q.listening && JP.tts.hasJa) setTimeout(() => JP.tts.speak(rv.say), 220);
        if (!ok && S.set.auto && rv.say && JP.tts.hasJa) setTimeout(() => JP.tts.speak(rv.say), 220);
        hud(); progress();
        if (cfg.kind === 'blitz') nextTimer = setTimeout(afterFeedback, ok ? 650 : 1700);
      }

      function afterFeedback() {
        clearTimeout(nextTimer);
        if (st.over) return;
        if (cfg.hearts && st.hearts <= 0) return finish(false);
        nextQuestion();
      }

      function check(skipped) {
        const q = cur.q;
        if (phase !== 'ask' || cur.done) return;
        cur.done = true;
        const ok = skipped ? false : grade();
        // 標示選項
        if (q.type === 'choice') {
          root.querySelectorAll('.choice').forEach((b, i) => {
            b.disabled = true;
            if (q.choices[i].correct) b.classList.add('right');
            else if (i === cur.sel) b.classList.add('wrong');
          });
        } else if (q.type === 'order') {
          $('ans').classList.add(ok ? 'right' : 'wrong');
          root.querySelectorAll('.tile').forEach((b) => (b.disabled = true));
        } else if (q.type === 'type') {
          const i = $('tin'); i.disabled = true; i.classList.add(ok ? 'right' : 'wrong');
        }
        record(ok, q, skipped);
        requeue(q, ok);
        if (cfg.kind === 'placement') { setTimeout(nextQuestion, 120); return; }
        feedback(ok, q, skipped);
      }

      /* ----- 配對題 ----- */
      function matchTap(btn) {
        if (phase !== 'ask' || cur.done || btn.classList.contains('ok')) return;
        const side = btn.dataset.side, id = btn.dataset.id;
        if (cur.pick && cur.pick.side === side) { cur.pick.btn.classList.remove('sel'); cur.pick = btn.classList.contains('sel') ? null : { side, id, btn }; if (cur.pick) btn.classList.add('sel'); return; }
        if (!cur.pick) { cur.pick = { side, id, btn }; btn.classList.add('sel'); const p = cur.q.pairs.find((x) => x.id === id); if (side === 'l' && JP.tts.hasJa && S.set.auto) JP.tts.speak(p.say); return; }
        const a = cur.pick; cur.pick = null; a.btn.classList.remove('sel');
        if (a.id === id) {
          [a.btn, btn].forEach((b) => { b.classList.add('ok'); b.disabled = true; });
          cur.matched.add(id); JP.sfx.tap(); JP.buzz(8);
          const p = cur.q.pairs.find((x) => x.id === id); if (JP.tts.hasJa && S.set.auto) JP.tts.speak(p.say);
          if (cur.matched.size === cur.q.pairs.length) {
            cur.done = true;
            const ok = cur.wrongPairs.size === 0;
            record(ok, cur.q);
            feedback(ok, cur.q);
          }
        } else {
          cur.wrongPairs.add(a.id); cur.wrongPairs.add(id);
          [a.btn, btn].forEach((b) => { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 450); });
          JP.sfx.wrong(); JP.buzz(30);
          if (cfg.hearts) { st.hearts--; hud(); if (st.hearts <= 0) { cur.done = true; record(false, cur.q); feedback(false, cur.q); } }
        }
      }

      /* ----- 結算 ----- */
      function finish(natural) {
        if (st.over) return;
        st.over = true;
        clearInterval(timer); clearTimeout(nextTimer);
        JP.tts.cancel();
        phase = 'result';
        const r = settle(st, cfg, natural);
        renderResult(r);
      }

      function settle(st, cfg, natural) {
        const total = st.firstTotal;
        const acc = total ? st.firstCorrect / total : 0;
        const r = { kind: cfg.kind, title: cfg.title, acc, correct: st.firstCorrect, total, bestCombo: st.bestCombo, time: Date.now() - st.t0, xp: 0, stars: 0, pass: true, node: cfg.node, hearts: st.hearts, score: st.score, world };
        const goalBefore = JP.dailyXP();
        const finishNode = () => { r.stars = cfg.kind === 'boss' || cfg.kind === 'testout' ? Math.max(1, st.hearts) : acc >= 0.9 ? 3 : acc >= 0.75 ? 2 : 1; };
        switch (cfg.kind) {
          case 'lesson': case 'grammar': {
            finishNode();
            r.xp = st.xpLive + 10 + r.stars * 5;
            if (cfg.node.items) cfg.node.items.forEach((id) => { if (!S.cards[id]) JP.review(id, true); st.touched.add(id); });
            const first = !JP.stateOf(cfg.node).done;
            r.firstClear = first;
            JP.completeNode(cfg.node, r.stars);
            S.stats.lessons++;
            if (r.stars === 3 && st.mistakes === 0) { S.stats.perfects++; r.perfect = true; }
            break;
          }
          case 'boss': case 'testout': {
            if (st.hearts > 0 && natural) {
              finishNode();
              r.xp = st.xpLive + 30 + r.stars * 5;
              if (cfg.kind === 'testout') JP.skipWorld(cfg.node.world);
              JP.completeNode(cfg.node, r.stars);
              S.stats.bossWins++;
              if (!S.stamps[cfg.node.world]) { S.stamps[cfg.node.world] = JP.dayKey(); r.stamp = world; }
              S.stats.lessons++;
            } else { r.pass = false; r.xp = Math.floor(st.xpLive / 2); }
            break;
          }
          case 'review': case 'weak': case 'listen': {
            r.xp = st.xpLive + (total >= 5 ? 5 : 0);
            S.stats.reviews += total;
            break;
          }
          case 'blitz': {
            r.xp = Math.min(60, st.score * 2);
            r.best = Math.max(S.stats.blitz, st.score);
            r.newBest = st.score > S.stats.blitz;
            S.stats.blitz = r.best;
            break;
          }
          case 'placement': {
            let passes = 0;
            for (let t = 0; t < 4; t++) { const x = st.tierRes[t]; if (x && x.c >= 2) passes++; else break; }
            r.placed = passes;
            r.startWorld = [0, 1, 3, 4, 5][passes];
            r.xp = 0;
            break;
          }
          default: break;
        }
        r.newItems = Array.from(st.touched).filter((id) => !st.startKnown.has(id) && JP.card(id)).map(JP.item).filter(Boolean);
        if (r.xp > 0) {
          const g = JP.addXP(r.xp);
          r.lv = g;
          r.goalHit = goalBefore < S.goal && JP.dailyXP() >= S.goal;
          r.streakUp = g.firstToday;
          r.froze = g.froze;
        }
        r.ach = JP.checkAch();
        JP.save();
        return r;
      }

      function stars(n, max = 3) { return `<div class="stars">${Array.from({ length: max }, (_, i) => `<span class="${i < n ? 'on' : ''}" style="--i:${i}">${ICON.star()}</span>`).join('')}</div>`; }
      const mmss = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

      function renderResult(r) {
        let hero = '', sub = '';
        const win = r.pass;
        if (r.kind === 'boss' || r.kind === 'testout') {
          hero = win ? '🎉' : '👹';
          sub = win ? (r.kind === 'testout' ? '跳級成功！這個世界全部解鎖了' : '鬼關突破！') : '鬼還沒被打倒，再試一次吧';
        } else if (r.kind === 'blitz') { hero = '⚡'; sub = r.newBest ? '新紀錄！' : `個人最佳 ${r.best} 題`; }
        else if (r.kind === 'placement') { hero = '🧭'; sub = '程度測驗完成'; }
        else { hero = r.stars === 3 ? '🏆' : r.stars === 2 ? '🎊' : '👍'; sub = r.stars === 3 ? '完美表現！' : r.stars === 2 ? '做得很好！' : '完成了！再練幾次會更穩'; }
        const title = r.kind === 'blitz' ? `${r.score} 題` : r.kind === 'placement' ? '' : win ? '關卡完成' : '挑戰失敗';
        const placeInfo = r.kind === 'placement' ? placementText(r) : '';
        const tiles = [];
        if (r.kind === 'blitz') tiles.push(['答對', r.score]);
        else if (r.kind !== 'placement') tiles.push(['正確率', Math.round(r.acc * 100) + '%']);
        if (r.xp) tiles.push(['經驗值', '+' + r.xp + ' XP']);
        if (r.kind !== 'blitz') tiles.push(['最高連擊', r.bestCombo]);
        tiles.push(['時間', mmss(r.time)]);
        const lvl = r.lv && r.lv.leveledUp ? `<div class="res-banner lv"><b>升級！</b> Lv ${r.lv.level}・${esc(JP.rankOf(r.lv.level)[1])}</div>` : '';
        const streak = r.streakUp ? `<div class="res-banner streak">${ICON.flame()}<span>連勝 <b>${JP.streakDisplay()}</b> 天${r.froze ? '（已使用連勝凍結 ❄️）' : ''}</span></div>` : '';
        const goal = r.goalHit ? `<div class="res-banner goal">🎯 今日目標達成！</div>` : '';
        const stamp = r.stamp ? `<div class="res-stamp"><div class="hanko">${esc(r.stamp.zh.slice(0, 2))}<small>${esc(r.stamp.title)}</small></div><p>獲得「${esc(r.stamp.title)}」朱印！</p></div>` : '';
        const nw = r.newItems.length ? `<div class="res-new"><h4>新收集 ${r.newItems.length} 個${r.newItems[0].kind === 'kana' ? '假名' : '單字'}</h4><div class="chips-row">${r.newItems.slice(0, 18).map((i) => `<span class="mini" title="${esc(i.zh)}"><i>${i.em || ''}</i><b lang="ja">${esc(i.jp)}</b></span>`).join('')}</div></div>` : '';
        const ach = r.ach.length ? `<div class="res-ach"><h4>解鎖成就</h4>${r.ach.map((a) => `<div class="ach-row"><span>${a.em}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div></div>`).join('')}</div>` : '';
        pb.innerHTML = `<div class="result ${win ? 'win' : 'lose'}">
          <div class="res-hero"><div class="res-em">${hero}</div>${title ? `<h1>${title}</h1>` : ''}<p>${sub}</p>${r.stars ? stars(r.stars) : r.kind === 'boss' || r.kind === 'testout' ? stars(0) : ''}</div>
          ${placeInfo}
          <div class="res-tiles">${tiles.map(([k, v]) => `<div class="res-tile"><b>${v}</b><span>${k}</span></div>`).join('')}</div>
          ${lvl}${streak}${goal}${stamp}${nw}${ach}
        </div>`;
        const again = (r.kind === 'blitz' || r.kind === 'review' || r.kind === 'weak' || r.kind === 'listen') ? `<button type="button" class="btn btn-ghost" data-act="again">再來一次</button>` : !win ? `<button type="button" class="btn btn-ghost" data-act="again">再挑戰</button>` : '';
        pf.className = 'play-foot';
        pf.innerHTML = `${again}<button type="button" class="btn btn-big" data-act="exit" autofocus>${r.kind === 'placement' ? '開始冒險' : '繼續'}</button>`;
        $('pfill').style.width = '100%'; hud();
        root.querySelector('.play-scroll').scrollTop = 0;
        if (win) { JP.sfx.done(); JP.ui.confetti({ n: r.stars === 3 ? 140 : 90 }); } else JP.sfx.fail();
        if (r.lv && r.lv.leveledUp) setTimeout(() => JP.sfx.level(), 700);
        result = r;
      }
      let result = null;

      function placementText(r) {
        const names = ['從「ひらがな」開始', '從「カタカナ」開始', '從「N5・基礎單字」開始', '從「N5・日常生活」開始', '從「N4・進階表達」開始'];
        const label = [`零基礎起步`, `已熟悉平假名`, `假名與基礎單字都不錯`, `已有 N5 實力`, `已有 N4 實力`][r.placed];
        return `<div class="res-place"><b>${label}</b><p>我們為你${names[r.placed]}。前面的世界仍然保持開放，隨時都可以回去複習。</p></div>`;
      }

      /* ----- 關閉 ----- */
      function close(res) {
        clearInterval(timer); clearTimeout(nextTimer);
        document.removeEventListener('keydown', onKey, true);
        JP.tts.cancel(); JP.ui.stopConfetti();
        root.classList.remove('open');
        document.body.classList.remove('noscroll');
        setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 250);
        resolve(res);
      }
      function quit() {
        if (phase === 'result') return close(result);
        if (phase === 'teach' && !st.answeredN) return close(null);
        const m = JP.ui.modal(`<div class="confirm"><h3>要離開嗎？</h3><p>這次的進度不會被保存喔。</p><div class="btn-row"><button type="button" class="btn btn-big" data-close>繼續學習</button><button type="button" class="btn btn-ghost danger" data-act="reallyquit">離開</button></div></div>`, { noClose: false });
        m.el.querySelector('[data-act="reallyquit"]').addEventListener('click', () => { m.close(); close(null); });
      }

      /* ----- 事件 ----- */
      root.onclick = (e) => {
        const t = e.target;
        const act = t.closest('[data-act]');
        if (act) {
          const a = act.dataset.act;
          if (a === 'quit') return quit();
          if (a === 'exit') return close(result);
          if (a === 'again') { close({ again: true, result }); return; }
          if (a === 'tnext') { ti++; return renderTeach(); }
          if (a === 'tprev') { ti = Math.max(0, ti - 1); return renderTeach(); }
          if (a === 'start') { JP.sfx.tap(); return nextQuestion(); }
          if (a === 'check') return check(false);
          if (a === 'skip') return check(true);
          if (a === 'next') return afterFeedback();
        }
        const ch = t.closest('.choice');
        if (ch && phase === 'ask' && !ch.disabled) {
          root.querySelectorAll('.choice').forEach((b) => b.classList.remove('sel'));
          ch.classList.add('sel'); cur.sel = +ch.dataset.i; $('go').disabled = false; JP.sfx.tap();
          return;
        }
        const tile = t.closest('.tile');
        if (tile && phase === 'ask' && !tile.disabled) {
          const k = +tile.dataset.k;
          if (tile.dataset.from === 'bank') cur.placed.push(cur.bank.splice(k, 1)[0]);
          else cur.bank.push(cur.placed.splice(k, 1)[0]);
          JP.sfx.tap(); return renderOrder();
        }
        const mt = t.closest('.mt');
        if (mt) return matchTap(mt);
      };
      root.oninput = (e) => { if (e.target.id === 'tin') { const g = $('go'); if (g) g.disabled = !e.target.value.trim(); } };

      function onKey(e) {
        if (!root.classList.contains('open')) return;
        if (document.querySelector('.modal.in')) return;
        const inInput = e.target && e.target.tagName === 'INPUT';
        if (e.key === 'Escape') { e.preventDefault(); return quit(); }
        if (e.key === 'Enter') {
          const btn = pf.querySelector('[data-act="check"],[data-act="next"],[data-act="start"],[data-act="tnext"],[data-act="exit"]');
          if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
          return;
        }
        if (!inInput && phase === 'ask' && cur && cur.q.type === 'choice' && /^[1-4]$/.test(e.key)) {
          const b = root.querySelectorAll('.choice')[+e.key - 1]; if (b) b.click();
        }
        if (!inInput && phase === 'teach' && e.key === 'ArrowRight') { const b = pf.querySelector('[data-act="tnext"],[data-act="start"]'); if (b) b.click(); }
        if (!inInput && phase === 'teach' && e.key === 'ArrowLeft') { const b = pf.querySelector('[data-act="tprev"]'); if (b) b.click(); }
      }
      document.addEventListener('keydown', onKey, true);

      /* ----- 啟動 ----- */
      JP.sfx.unlock();
      if (cfg.timer) {
        timer = setInterval(() => {
          if (phase === 'teach') return;
          st.timeLeft -= 0.25; progress();
          const t = root.querySelector('.hud-time'); if (t) t.textContent = Math.max(0, Math.ceil(st.timeLeft));
          if (st.timeLeft <= 0) finish(true);
        }, 250);
      }
      if (hasTeach) renderTeach(); else nextQuestion();
    });
  }

  JP.play = play;
  JP.itemReveal = itemReveal;
  JP.cardOf = cardOf;
  JP.KIND_LABEL = KIND_LABEL;
})();
