/* questions.js — 題型產生器與出題規劃 */
(function () {
  'use strict';
  const JP = window.JP;
  const S = JP.S;
  const { esc, shuffle, sample, pick, clamp, ruby, plain, tokensOf } = JP;

  const wordsAll = JP.itemList('word');
  const kanaAll = JP.itemList('kana');
  const lessonWorld = {};
  JP.WORLDS.forEach((w) => w.nodes.forEach((n) => { if (n.lesson) lessonWorld[n.lesson] = w.id; }));
  const canListen = () => JP.tts.ok && JP.tts.hasJa;

  /* ───── 顯示輔助 ───── */
  function jpHtml(it) {
    if (it.kind === 'word' && it.hasKanji && S.set.furi) return `<ruby>${esc(it.jp)}<rt>${esc(it.rd)}</rt></ruby>`;
    return esc(it.jp);
  }
  // 假名例字：把該假名標色
  function exampleHtml(it) {
    if (!it.word) return '';
    const w = it.word, i = it.hi, n = it.jp.length;
    return `${esc(w.slice(0, i))}<b class="hl">${esc(w.substr(i, n))}</b>${esc(w.slice(i + n))}`;
  }
  const sayOf = (it) => (it.kind === 'kana' ? it.jp : it.rd);

  /* ───── 干擾選項 ───── */
  const LOOK = ['さちき', 'はほま', 'るろ', 'ぬめね', 'ねれわ', 'いりこ', 'あおす', 'うらち', 'つてし', 'のめぬ', 'くへ', 'たなに', 'ふへ', 'ソシツンン', 'クケタ', 'ウワフ', 'チテラ', 'ノメ', 'ヌスマ', 'コユ', 'アマ', 'ナメ', 'ミニ', 'ヒヒ'];
  const lookalikes = (ch) => LOOK.filter((g) => g.includes(ch)).join('').split('').filter((c) => c !== ch);

  function pickDistinct(cands, n, keyFn, seed) {
    const seen = new Set(seed);
    const out = [];
    for (const c of cands) {
      const k = keyFn(c);
      if (seen.has(k)) continue;
      seen.add(k); out.push(c);
      if (out.length >= n) break;
    }
    return out;
  }
  function wordDistractors(it, n, keyFn) {
    const ok = (c) => c.id !== it.id && c.zh !== it.zh && c.jp !== it.jp && c.em !== it.em;
    const w = lessonWorld[it.lesson];
    const same = shuffle(wordsAll.filter((c) => c.lesson === it.lesson && ok(c)));
    const near = shuffle(wordsAll.filter((c) => c.lesson !== it.lesson && lessonWorld[c.lesson] === w && ok(c)));
    const rest = shuffle(wordsAll.filter((c) => lessonWorld[c.lesson] !== w && ok(c)));
    // 優先使用同課、同世界的單字；若是 N5 的題目，別混入太難的 N4 單字
    return pickDistinct(same.concat(near, rest), n, keyFn, [keyFn(it)]);
  }
  function kanaDistractors(it, n, keyFn, needEm) {
    const base = kanaAll.filter((c) => c.script === it.script && !!c.yoon === !!it.yoon && c.id !== it.id && !c.rare && (!needEm || c.em));
    const look = base.filter((c) => lookalikes(it.jp).includes(c.jp));
    const learned = base.filter((c) => S.cards[c.id] && !look.includes(c));
    const rest = base.filter((c) => !look.includes(c) && !learned.includes(c));
    const cands = shuffle(look).slice(0, 2).concat(shuffle(learned), shuffle(rest));
    return pickDistinct(cands, n, keyFn, [keyFn(it)]);
  }

  /* ───── 單一題目 ───── */
  const mk = (it, sub, d, o) => Object.assign({ type: 'choice', sub, itemId: it.id, d, layout: 'list', choices: [] }, o);
  const opts = (it, others, htmlFn) => shuffle([it].concat(others).map((o) => ({ html: htmlFn(o), correct: o.id === it.id, key: o.id })));

  const B = {};
  // 看圖選字
  B.pic2jp = (it) => {
    const ds = wordDistractors(it, 3, (c) => c.jp); if (ds.length < 3) return null;
    return mk(it, 'pic2jp', 0, { title: '這張圖是什麼？選出日文', prompt: { em: it.em }, layout: 'list', choices: opts(it, ds, jpHtml) });
  };
  // 看字選圖
  B.jp2pic = (it) => {
    const ds = wordDistractors(it, 3, (c) => c.em); if (ds.length < 3) return null;
    return mk(it, 'jp2pic', 0, { title: '選出符合的圖', prompt: { jp: jpHtml(it), say: sayOf(it) }, layout: 'pics', choices: opts(it, ds, (o) => `<span class="pic">${o.em}</span>`) });
  };
  // 聽音選圖
  B.listen2pic = (it) => {
    if (!canListen()) return null;
    const ds = wordDistractors(it, 3, (c) => c.em); if (ds.length < 3) return null;
    return mk(it, 'listen2pic', 0, { title: '聽聽看，選出正確的圖', listening: true, prompt: { say: sayOf(it), listen: true, auto: true }, layout: 'pics', choices: opts(it, ds, (o) => `<span class="pic">${o.em}</span>`) });
  };
  // 日 → 中
  B.jp2zh = (it) => {
    const ds = wordDistractors(it, 3, (c) => c.zh); if (ds.length < 3) return null;
    return mk(it, 'jp2zh', 1, { title: '這個字是什麼意思？', prompt: { jp: jpHtml(it), say: sayOf(it) }, choices: opts(it, ds, (o) => esc(o.zh)) });
  };
  // 中 → 日
  B.zh2jp = (it) => {
    const ds = wordDistractors(it, 3, (c) => c.jp); if (ds.length < 3) return null;
    return mk(it, 'zh2jp', 1, { title: '「' + it.zh + '」的日文是？', prompt: { zh: it.zh, em: it.em }, choices: opts(it, ds, jpHtml) });
  };
  // 聽音選字
  B.listen2jp = (it) => {
    if (!canListen()) return null;
    const ds = wordDistractors(it, 3, (c) => c.jp); if (ds.length < 3) return null;
    return mk(it, 'listen2jp', 1, { title: '聽聽看，選出你聽到的字', listening: true, prompt: { say: sayOf(it), listen: true, auto: true }, choices: opts(it, ds, jpHtml) });
  };
  // 例句填空
  B.fill = (it) => {
    if (it.kind !== 'word' || !it.ex) return null;
    const toks = it.ex.split('|');
    const ti = toks.findIndex((t) => { const p = plain(t); return p === it.jp || (p.startsWith(it.jp) && p.length - it.jp.length <= 2 && it.jp.length >= 1 && !/^[ぁ-ん]$/.test(it.jp)); });
    if (ti < 0) return null;
    const rest = plain(toks[ti]).slice(it.jp.length);
    const html = toks.map((t, i) => (i === ti ? `<span class="blank"></span>${esc(rest)}` : ruby(t))).join('');
    const same = wordsAll.filter((c) => c.lesson === it.lesson && c.id !== it.id && c.jp !== it.jp);
    const pool = shuffle(same).concat(wordDistractors(it, 6, (c) => c.jp));
    const ds = pickDistinct(pool, 3, (c) => c.jp, [it.jp]);
    if (ds.length < 3) return null;
    return mk(it, 'fill', 1, { title: '選出適合填入空格的字', prompt: { html, zh: it.exZh }, layout: 'list', choices: opts(it, ds, jpHtml), reveal: { html: `<div class="rv-sent">${ruby(it.ex)}</div><div class="rv-zh">${esc(it.exZh)}</div>`, itemId: it.id } });
  };
  // 排列句子
  function orderQ(sentence, zh, it, d) {
    const toks = tokensOf(sentence);
    if (toks.length < 3 || toks.length > 9) return null;
    const bankToks = toks.slice();
    if (toks.length >= 4 && d >= 1) {
      const extra = shuffle(['は', 'が', 'を', 'に', 'で', 'へ', 'の', 'も', 'と']).find((p) => !toks.some((t) => plain(t) === p));
      if (extra) bankToks.push(extra);
    }
    const tiles = shuffle(bankToks.map((t, i) => ({ t, i, html: ruby(t) })));
    return {
      type: 'order', sub: 'order', itemId: it ? it.id : null, d, title: '把句子排列起來', prompt: { zh, say: plain(sentence), small: true },
      tiles, answer: toks.map(plain), reveal: { html: `<div class="rv-sent">${ruby(sentence)}</div><div class="rv-zh">${esc(zh)}</div>`, itemId: it ? it.id : null },
    };
  }
  B.order = (it) => (it.kind === 'word' && it.ex && !it.noOrder ? orderQ(it.ex, it.exZh, it, 2) : null);
  // 輸入羅馬拼音
  B.type = (it) => {
    if (it.kind === 'kana') {
      if (it.rare) return null;
      return mk(it, 'type', 2, { type: 'type', title: '輸入羅馬拼音', prompt: { jp: esc(it.jp), say: it.jp }, accept: it.ro, placeholder: '例：ka' });
    }
    return mk(it, 'type', 2, { type: 'type', title: '輸入這個單字的羅馬拼音', prompt: { em: it.em, zh: it.zh, say: sayOf(it) }, accept: it.ro, placeholder: '羅馬拼音，例：' + (it.ro.length > 6 ? it.ro.slice(0, 4) + '…' : 'neko') });
  };

  /* 假名題型 */
  B.kana2ro = (it) => {
    const ds = kanaDistractors(it, 3, (c) => c.ro); if (ds.length < 3) return null;
    return mk(it, 'kana2ro', 0, { title: '這個假名怎麼唸？', prompt: { jp: esc(it.jp), say: it.jp }, layout: 'grid', choices: opts(it, ds, (o) => esc(o.ro)) });
  };
  B.ro2kana = (it) => {
    if (it.rare) return null;
    const ds = kanaDistractors(it, 3, (c) => c.jp); if (ds.length < 3) return null;
    return mk(it, 'ro2kana', 1, { title: '哪一個是「' + it.ro + '」？', prompt: { ro: it.ro, say: it.jp }, layout: 'grid', choices: opts(it, ds, (o) => `<span class="kc">${esc(o.jp)}</span>`) });
  };
  B.listen2kana = (it) => {
    if (!canListen() || it.rare) return null;
    const ds = kanaDistractors(it, 3, (c) => c.jp); if (ds.length < 3) return null;
    return mk(it, 'listen2kana', 1, { title: '聽聽看，選出你聽到的假名', listening: true, prompt: { say: it.jp, listen: true, auto: true }, layout: 'grid', choices: opts(it, ds, (o) => `<span class="kc">${esc(o.jp)}</span>`) });
  };
  // 假名 → 圖例（用圖像聯想記憶）
  B.kana2pic = (it) => {
    if (!it.em) return null;
    const ds = kanaDistractors(it, 3, (c) => c.em, true); if (ds.length < 3) return null;
    return mk(it, 'kana2pic', 0, { title: '哪個圖例的字是以「' + it.jp + '」為記憶點？', prompt: { jp: esc(it.jp), say: it.jp }, layout: 'pics', choices: opts(it, ds, (o) => `<span class="pic">${o.em}</span>`) });
  };
  // 看圖補假名
  B.pic2kana = (it) => {
    if (!it.em || it.rare) return null;
    const ds = kanaDistractors(it, 3, (c) => c.jp); if (ds.length < 3) return null;
    const w = it.word, i = it.hi;
    const html = `${esc(w.slice(0, i))}<span class="blank"></span>${esc(w.slice(i + it.jp.length))}`;
    return mk(it, 'pic2kana', 1, { title: '補上缺少的假名', prompt: { em: it.em, html, zh: it.wordZh }, layout: 'grid', choices: opts(it, ds, (o) => `<span class="kc">${esc(o.jp)}</span>`) });
  };

  /* ───── 更多題型（讓每次練習都不太一樣） ───── */
  // 中文 → 選圖
  B.zh2pic = (it) => {
    const ds = wordDistractors(it, 3, (c) => c.em); if (ds.length < 3) return null;
    return mk(it, 'zh2pic', 0, { title: '「' + it.zh + '」是哪一張圖？', prompt: { zh: it.zh }, layout: 'pics', choices: opts(it, ds, (o) => `<span class="pic">${o.em}</span>`) });
  };
  // 看圖 → 選中文
  B.pic2zh = (it) => {
    const ds = wordDistractors(it, 3, (c) => c.zh); if (ds.length < 3) return null;
    return mk(it, 'pic2zh', 0, { title: '這張圖是什麼意思？', prompt: { em: it.em }, choices: opts(it, ds, (o) => esc(o.zh)) });
  };
  // 聽音 → 選中文
  B.listen2zh = (it) => {
    if (!canListen() || it.kind !== 'word') return null;
    const ds = wordDistractors(it, 3, (c) => c.zh); if (ds.length < 3) return null;
    return mk(it, 'listen2zh', 1, { title: '聽聽看，這是什麼意思？', listening: true, prompt: { say: sayOf(it), listen: true, auto: true }, choices: opts(it, ds, (o) => esc(o.zh)) });
  };
  // 日文 → 選羅馬拼音
  B.jp2ro = (it) => {
    if (it.kind !== 'word') return null;
    const ds = wordDistractors(it, 3, (c) => c.ro); if (ds.length < 3) return null;
    return mk(it, 'jp2ro', 1, { title: '這個字怎麼唸？', prompt: { jp: jpHtml(it), say: sayOf(it) }, choices: opts(it, ds, (o) => esc(o.ro)) });
  };
  // 羅馬拼音 → 選日文
  B.ro2jp = (it) => {
    if (it.kind !== 'word') return null;
    const ds = wordDistractors(it, 3, (c) => c.jp); if (ds.length < 3) return null;
    return mk(it, 'ro2jp', 1, { title: '哪一個是「' + it.ro + '」？', prompt: { ro: it.ro }, choices: opts(it, ds, jpHtml) });
  };
  // 聽音 → 選羅馬拼音（單字與假名都適用）
  B.listen2ro = (it) => {
    if (!canListen()) return null;
    const ds = it.kind === 'word' ? wordDistractors(it, 3, (c) => c.ro) : kanaDistractors(it, 3, (c) => c.ro);
    if (ds.length < 3) return null;
    return mk(it, 'listen2ro', 1, { title: '聽聽看，這個音是？', listening: true, prompt: { say: sayOf(it), listen: true, auto: true }, layout: it.kind === 'kana' ? 'grid' : 'list', choices: opts(it, ds, (o) => esc(o.ro)) });
  };
  // 例句 → 選中文翻譯
  B.sent2zh = (it) => {
    if (it.kind !== 'word' || !it.ex) return null;
    const near = wordsAll.filter((c) => c.ex && c.id !== it.id && c.exZh !== it.exZh && lessonWorld[c.lesson] === lessonWorld[it.lesson]);
    const ds = pickDistinct(shuffle(near).concat(shuffle(wordsAll.filter((c) => c.ex && c.id !== it.id && c.exZh !== it.exZh))), 3, (c) => c.exZh, [it.exZh]);
    if (ds.length < 3) return null;
    return mk(it, 'sent2zh', 1, { title: '這句話是什麼意思？', prompt: { html: ruby(it.ex), say: plain(it.ex), sentence: true }, choices: shuffle([it].concat(ds)).map((o) => ({ html: esc(o.exZh), correct: o.id === it.id, key: o.id })), reveal: { html: `<div class="rv-sent">${ruby(it.ex)}</div><div class="rv-zh">${esc(it.exZh)}</div>`, itemId: it.id } });
  };
  // 中文 → 選日文例句
  B.zh2sent = (it) => {
    if (it.kind !== 'word' || !it.ex) return null;
    const near = wordsAll.filter((c) => c.ex && c.id !== it.id && plain(c.ex) !== plain(it.ex) && lessonWorld[c.lesson] === lessonWorld[it.lesson]);
    const ds = pickDistinct(shuffle(near), 3, (c) => plain(c.ex), [plain(it.ex)]);
    if (ds.length < 3) return null;
    return mk(it, 'zh2sent', 2, { title: '哪一句日文的意思是這個？', prompt: { zh: it.exZh }, layout: 'list', choices: shuffle([it].concat(ds)).map((o) => ({ html: ruby(o.ex), correct: o.id === it.id, key: o.id })), reveal: { html: `<div class="rv-sent">${ruby(it.ex)}</div><div class="rv-zh">${esc(it.exZh)}</div>`, itemId: it.id } });
  };
  // 聽句子 → 排列
  B.listenOrder = (it) => {
    if (!canListen() || it.kind !== 'word' || !it.ex || it.noOrder) return null;
    const q = orderQ(it.ex, it.exZh, it, 2);
    if (!q) return null;
    q.sub = 'listenOrder'; q.listening = true; q.title = '聽句子，排出正確的順序';
    q.prompt = { say: plain(it.ex), listen: true, auto: true, zh: it.exZh };
    return q;
  };
  // 假名 → 選出含有這個假名的字
  B.kana2word = (it) => {
    if (it.kind !== 'kana' || !it.word || it.rare) return null;
    const pool = kanaAll.filter((c) => c.script === it.script && c.word && !c.rare && c.id !== it.id && !c.word.includes(it.jp));
    const ds = pickDistinct(shuffle(pool), 3, (c) => c.word, [it.word]);
    if (ds.length < 3) return null;
    return mk(it, 'kana2word', 1, { title: '哪一個字裡面有「' + it.jp + '」？', prompt: { jp: esc(it.jp), say: it.jp }, choices: shuffle([it].concat(ds)).map((o) => ({ html: esc(o.word), correct: o.id === it.id, key: o.id })) });
  };

  const TIERS = {
    word: {
      easy: ['pic2jp', 'jp2pic', 'zh2pic', 'pic2zh', 'listen2pic'],
      mid: ['jp2zh', 'zh2jp', 'listen2jp', 'listen2zh', 'fill', 'jp2ro', 'ro2jp', 'sent2zh'],
      hard: ['listen2jp', 'listen2zh', 'zh2jp', 'order', 'listenOrder', 'fill', 'type', 'zh2sent', 'sent2zh', 'listen2ro'],
    },
    kana: {
      easy: ['kana2pic', 'kana2ro', 'listen2kana'],
      mid: ['ro2kana', 'pic2kana', 'listen2kana', 'kana2ro', 'kana2word', 'listen2ro'],
      hard: ['type', 'listen2kana', 'ro2kana', 'pic2kana', 'kana2word', 'listen2ro'],
    },
    yoon: { easy: ['kana2ro', 'listen2kana'], mid: ['ro2kana', 'listen2kana', 'kana2ro', 'listen2ro'], hard: ['type', 'listen2kana', 'ro2kana', 'listen2ro'] },
  };
  const kindKey = (it) => (it.kind === 'word' ? 'word' : it.yoon ? 'yoon' : 'kana');

  function build(it, sub) { const f = B[sub]; return f ? f(it) : null; }
  // 記住每個項目最近用過的題型，下次盡量換不同的（同一關重玩也會有變化）
  const recent = {};
  const recentOf = (id) => recent[id] || [];
  function makeQ(it, tier, avoid = []) {
    const ks = kindKey(it);
    const ok = (s) => canListen() || !/^listen/.test(s);
    const tryList = (list, av) => { for (const s of shuffle(list).filter((x) => ok(x) && !av.includes(x))) { const q = build(it, s); if (q) return q; } return null; };
    const rec = recentOf(it.id);
    const q = tryList(TIERS[ks][tier], avoid.concat(rec)) || tryList(TIERS[ks][tier], avoid) || tryList(TIERS[ks][tier], []) || tryList(TIERS[ks].easy, []) || tryList(TIERS[ks].mid, []) || tryList(TIERS[ks].hard, []);
    if (q && q.sub) { recent[it.id] = rec.concat(q.sub).slice(-5); }
    return q;
  }

  /* 配對題 */
  function matchQ(its, hint) {
    const isKana = its[0].kind === 'kana';
    const mode = isKana ? (its.every((i) => i.em) && Math.random() < 0.5 ? 'pic' : 'ro') : (Math.random() < 0.5 ? 'pic' : 'zh');
    const pairs = its.map((it) => ({
      id: it.id,
      left: isKana ? `<span class="kc">${esc(it.jp)}</span>` : jpHtml(it),
      right: mode === 'pic' ? `<span class="pic">${it.em}</span>` : mode === 'ro' ? esc(it.ro) : esc(it.zh),
      say: sayOf(it),
    }));
    return { type: 'match', sub: 'match', itemId: null, itemIds: its.map((i) => i.id), d: 1, title: '配對：把相同的組合在一起', pairs, mode, hint };
  }

  /* ───── 文法題 ───── */
  function grammarQs(g, n) {
    const qs = [];
    const all = JP.GRAMMAR;
    g.quiz.forEach(([stem, ans, ...wrong]) => {
      const m = stem.match(/（(.*?)）\s*$/);
      const body = stem.replace(/（.*?）\s*$/, '');
      const html = esc(body).replace(/＿+/g, '<span class="blank wide"></span>');
      const choices = shuffle([ans].concat(shuffle(wrong).slice(0, 3))).map((c) => ({ html: esc(c), correct: c === ans, key: c }));
      qs.push({
        type: 'choice', sub: 'cloze', itemId: null, d: 1, layout: 'list2', title: '選出正確的說法', prompt: { html, zh: m ? m[1] : '', say: body.replace(/＿+/g, ans) },
        choices, reveal: { html: `<div class="rv-sent">${esc(body.replace(/＿+/g, ans))}</div>${m ? `<div class="rv-zh">${esc(m[1])}</div>` : ''}` },
      });
    });
    const exs = shuffle(g.examples);
    exs.slice(0, 3).forEach(([s, zh]) => { const q = orderQ(s, zh, null, 1); if (q) qs.push(q); });
    exs.slice(0, 2).forEach(([s, zh]) => {
      const others = shuffle(all.flatMap((x) => x.examples).filter((e) => e[1] !== zh)).slice(0, 3);
      qs.push({
        type: 'choice', sub: 'sent2zh', itemId: null, d: 0, layout: 'list', title: '這句話是什麼意思？', prompt: { html: ruby(s), say: plain(s), sentence: true },
        choices: shuffle([[s, zh]].concat(others)).map((e) => ({ html: esc(e[1]), correct: e[1] === zh, key: e[1] })),
        reveal: { html: `<div class="rv-sent">${ruby(s)}</div><div class="rv-zh">${esc(zh)}</div>` },
      });
    });
    if (canListen()) {
      const [s, zh] = exs[exs.length - 1];
      const others = shuffle(all.flatMap((x) => x.examples).filter((e) => e[1] !== zh)).slice(0, 3);
      qs.push({
        type: 'choice', sub: 'listen2zh', itemId: null, d: 1, listening: true, layout: 'list', title: '聽聽看，這句話是什麼意思？', prompt: { say: plain(s), listen: true, auto: true },
        choices: shuffle([[s, zh]].concat(others)).map((e) => ({ html: esc(e[1]), correct: e[1] === zh, key: e[1] })),
        reveal: { html: `<div class="rv-sent">${ruby(s)}</div><div class="rv-zh">${esc(zh)}</div>` },
      });
    }
    const sorted = qs.sort((a, b) => a.d - b.d + (Math.random() - 0.5) * 1.5);
    return sorted.slice(0, n || sorted.length);
  }

  /* ───── 出題規劃 ───── */
  function spread(qs) {
    // 避免同一單字連續出現
    for (let i = 1; i < qs.length; i++) {
      if (qs[i].itemId && qs[i].itemId === qs[i - 1].itemId) {
        const j = qs.findIndex((q, k) => k > i && q.itemId !== qs[i - 1].itemId);
        if (j > 0) [qs[i], qs[j]] = [qs[j], qs[i]];
      }
    }
    return qs;
  }

  // level：0 第一次、1 重玩過、2 已拿三星（題目更難）；extra：混入前面學過的項目複習
  function planLesson(ids, opts = {}) {
    const its = ids.map(JP.item).filter(Boolean);
    const n = its.length;
    const level = opts.level || 0;
    const extras = (opts.extra || []).map(JP.item).filter(Boolean);
    const tiers = opts.easy ? [['easy'], ['easy', 'mid'], ['mid']][Math.min(level, 2)] : [['easy'], ['mid'], ['mid', 'hard']][Math.min(level, 2)];
    const base = opts.easy ? clamp(n * 2 + 2, 6, 12) : clamp(n * 2 + 2, 10, 16);
    const count = base + (level > 0 ? Math.min(3, extras.length) : 0);
    const qs = [];
    const used = {};
    const push = (it, tier) => {
      const q = makeQ(it, tier, used[it.id] || []);
      if (q) { qs.push(q); (used[it.id] = used[it.id] || []).push(q.sub); }
    };
    const withMatch = n >= 4;
    its.forEach((it) => push(it, tiers[0]));
    shuffle(its).forEach((it, i) => { if (qs.length < base - (withMatch ? 1 : 0)) push(it, tiers[(i + 1) % tiers.length]); });
    let guard = 0;
    while (qs.length < base - (withMatch ? 1 : 0) && guard++ < 30) push(pick(its), pick(tiers));
    if (level > 0) sample(extras, Math.min(3, extras.length)).forEach((it) => push(it, 'mid'));
    qs.sort((a, b) => a.d - b.d + (Math.random() - 0.5) * 1.4);
    spread(qs);
    if (withMatch) qs.splice(Math.floor(qs.length / 2), 0, matchQ(sample(its, Math.min(5, n))));
    void count;
    return qs;
  }

  const tierOfCard = (id) => { const c = S.cards[id]; const b = c ? c.box : 0; return b <= 1 ? 'easy' : b <= 3 ? 'mid' : 'hard'; };
  function planReview(ids, max = 12) {
    const its = ids.slice(0, max).map(JP.item).filter(Boolean);
    const qs = [];
    its.forEach((it) => { const q = makeQ(it, tierOfCard(it.id)); if (q) qs.push(q); });
    shuffle(qs);
    spread(qs);
    // 若同種類夠多，加入一題配對
    const words = its.filter((i) => i.kind === 'word' && i.em);
    if (words.length >= 4) qs.splice(Math.floor(qs.length / 2), 0, matchQ(sample(words, 5)));
    return qs;
  }

  function planBoss(node, count = 14) {
    const its = node.items.map(JP.item).filter(Boolean);
    const qs = [];
    const gq = [];
    (node.gids || []).forEach((gid) => gq.push(...grammarQs(JP.gmap.get(gid), 3)));
    const gTake = gq.length ? Math.min(4, gq.length) : 0;
    const pool = shuffle(its);
    for (let i = 0; qs.length < count - gTake && i < pool.length * 2; i++) {
      const it = pool[i % pool.length];
      const q = makeQ(it, Math.random() < 0.6 ? 'hard' : 'mid', []);
      if (q) qs.push(q);
    }
    qs.push(...shuffle(gq).slice(0, gTake));
    shuffle(qs);
    spread(qs);
    return qs;
  }

  // 閃電挑戰與無限出題：從已學過的項目中抽題
  function endless(ids) {
    const its = ids.map(JP.item).filter(Boolean);
    let last = null;
    return () => {
      for (let i = 0; i < 10; i++) {
        const it = pick(its);
        if (its.length > 1 && it.id === last) continue;
        const q = makeQ(it, pick(['easy', 'mid', 'mid']));
        if (q && q.type !== 'match') { last = it.id; return q; }
      }
      return null;
    };
  }

  // 程度測驗：由易到難，每個階段 3 題
  function planPlacement() {
    const grab = (filter, n, tier) => sample(JP.itemList().filter(filter), n * 3).map((it) => makeQ(it, tier)).filter(Boolean).slice(0, n);
    const hira = grab((i) => i.id[0] === 'h' && !i.yoon && !i.rare && i.id !== 'h:を', 3, 'mid');
    const kata = grab((i) => i.id[0] === 'k' && !i.yoon && !i.rare, 3, 'mid');
    const n5 = sample(wordsAll.filter((w) => ['n5a', 'n5b'].includes(lessonWorld[w.lesson])), 20).map((it) => makeQ(it, Math.random() < 0.5 ? 'mid' : 'hard')).filter((q) => q && q.type !== 'type').slice(0, 3);
    const n4 = sample(wordsAll.filter((w) => lessonWorld[w.lesson] === 'n4'), 20).map((it) => makeQ(it, 'mid')).filter((q) => q && q.type !== 'type').slice(0, 3);
    [hira, kata, n5, n4].forEach((arr, t) => arr.forEach((q) => { q.tierIdx = t; }));
    return hira.concat(kata, n5, n4);
  }

  // 「認識日語文字」關卡的小測驗
  function infoQuiz() {
    const mk2 = (title, ans, wrong, why) => ({
      type: 'choice', sub: 'info', itemId: null, d: 0, layout: 'list', title, prompt: {},
      choices: shuffle([ans].concat(wrong)).map((c) => ({ html: esc(c), correct: c === ans, key: c })), reveal: { html: `<div class="rv-zh">${esc(why)}</div>` },
    });
    return shuffle([
      mk2('寫外來語（例如 コーヒー）通常用哪種文字？', 'カタカナ', ['ひらがな', '漢字', '注音符號'], 'カタカナ 直直的，專門用來寫外來語。'),
      mk2('五十音圖裡有幾個「母音」？', '5 個', ['3 個', '10 個', '46 個'], '母音是 あ い う え お，共 5 個。'),
      mk2('ひらがな 的特色是？', '圓圓的，用來寫日語本身的字', ['直直的，用來寫外來語', '和中文一模一樣', '只用在課本裡'], 'ひらがな 是最先要學的文字。'),
      mk2('「か」是由哪兩個部分組成？', 'k ＋ a', ['s ＋ a', 'k ＋ i', 't ＋ a'], '子音 k ＋ 母音 a ＝ か（ka）。'),
      mk2('哪一個是平假名？', 'あ', ['ア', '日', 'ㄚ'], 'あ 是平假名，ア 是片假名，日 是漢字。'),
    ]);
  }

  JP.Q = { infoQuiz, jpHtml, exampleHtml, sayOf, makeQ, planLesson, planReview, planBoss, planPlacement, endless, grammarQs, matchQ, canListen, build };
})();
