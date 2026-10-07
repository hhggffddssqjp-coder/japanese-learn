/* curriculum.js — 把資料組成「學習項目」與「闖關地圖」 */
(function () {
  'use strict';
  const JP = window.JP;
  const S = JP.S;
  const K = JP.KANA;

  /* ───────────── 學習項目 ───────────── */
  const ITEMS = new Map();
  JP.ITEMS = ITEMS;
  JP.item = (id) => ITEMS.get(id);

  const RARE = new Set(['ぢ', 'づ', 'ヂ', 'ヅ', 'ヲ']);
  function addKana(list, script) {
    list.forEach(([ch, ro, word, zh, em]) => {
      ITEMS.set(`${script === 'hira' ? 'h' : 'k'}:${ch}`, {
        id: `${script === 'hira' ? 'h' : 'k'}:${ch}`, kind: 'kana', script, jp: ch, rd: ch, ro, zh: ro,
        word, wordZh: zh, em, rare: RARE.has(ch), hi: Math.max(0, word.indexOf(ch)),
      });
    });
  }
  addKana(K.hiraBasic, 'hira'); addKana(K.hiraDakuten, 'hira');
  addKana(K.kataBasic, 'kata'); addKana(K.kataDakuten, 'kata');
  K.yoonRows.forEach(([ch, ro]) => {
    ITEMS.set(`h:${ch}`, { id: `h:${ch}`, kind: 'kana', script: 'hira', jp: ch, rd: ch, ro, zh: ro, em: '', yoon: true });
    const kk = K.toKata(ch);
    ITEMS.set(`k:${kk}`, { id: `k:${kk}`, kind: 'kana', script: 'kata', jp: kk, rd: kk, ro, zh: ro, em: '', yoon: true });
  });

  const RO_FIX = { こんにちは: 'konnichiwa', こんばんは: 'konbanwa' }; // は 作助詞時讀 wa
  JP.LESSONS.forEach((l) => {
    l.words.forEach(([jp, rd, zh, em, ex, exZh, tip]) => {
      const id = `w:${jp}`;
      ITEMS.set(id, {
        id, kind: 'word', jp, rd: rd || jp, hasKanji: !!rd && rd !== jp, ro: RO_FIX[jp] || JP.toRomaji(rd || jp), zh, em,
        ex, exZh, tip, lesson: l.id, noOrder: !!l.noOrder,
      });
    });
  });

  /* ───────────── 世界與關卡 ───────────── */
  const WORLDS = [
    { id: 'intro', title: 'はじめまして', zh: '零基礎入門', sub: '連五十音都不會也 OK：先認識文字，再學第一組母音', em: '🌱', theme: 'peach', level: '入門' },
    { id: 'hira', title: 'ひらがな', zh: '平假名', sub: '日語文字的第一步', em: '🌸', theme: 'sakura', level: '入門' },
    { id: 'kata', title: 'カタカナ', zh: '片假名', sub: '外來語與擬聲詞的專用字', em: '🍙', theme: 'sea', level: '入門' },
    { id: 'dakuon', title: '濁音・拗音', zh: '濁音與拗音', sub: '加上點點圈圈，聲音變豐富', em: '🎏', theme: 'matcha', level: '入門' },
    { id: 'n5a', title: 'はじめの一歩', zh: 'N5・基礎單字', sub: '問候、數字、食物、動物、顏色', em: '⛩️', theme: 'vermilion', level: 'N5' },
    { id: 'n5b', title: '毎日の生活', zh: 'N5・日常生活', sub: '動詞、形容詞與基本句型', em: '🏯', theme: 'indigo', level: 'N5' },
    { id: 'n4', title: 'ひろがる世界', zh: 'N4・進階表達', sub: '家人、旅行、心情與更多句型', em: '🗻', theme: 'gold', level: 'N4' },
  ];

  const NODES = [];
  const nodeById = new Map();
  const worldNodes = {};
  const add = (n) => {
    n.idx = NODES.length;
    NODES.push(n); nodeById.set(n.id, n);
    (worldNodes[n.world] = worldNodes[n.world] || []).push(n);
    return n;
  };
  const kid = (script, ch) => `${script === 'hira' ? 'h' : 'k'}:${ch}`;
  const chars = (s) => Array.from(s);

  // 假名關卡
  function kanaNodes(world, script, specs) {
    specs.forEach(([key, title, list]) => {
      const items = chars(list).map((c) => kid(script, c)).filter((id) => ITEMS.has(id));
      add({ id: `${world}:${key}`, world, type: 'kana', title, sub: chars(list).slice(0, 12).join(' '), icon: chars(list)[0], items });
    });
  }
  const basicRows = [
    ['a', 'あ行', 'あいうえお'], ['ka', 'か行', 'かきくけこ'], ['sa', 'さ行', 'さしすせそ'], ['ta', 'た行', 'たちつてと'],
    ['na', 'な行', 'なにぬねの'], ['ha', 'は行', 'はひふへほ'], ['ma', 'ま行', 'まみむめも'], ['ya', 'や行・わ行・ん', 'やゆよわをん'], ['ra', 'ら行', 'らりるれろ'],
  ];
  const bossOf = (world, title) => add({ id: `${world}:boss`, world, type: 'boss', title, sub: '鬼之關・守住 3 顆心', icon: '👹', items: [], gids: [] });

  // 零基礎入門：文字簡介 → 母音（每關只學 2~3 個字）→ 母音複習 → 鬼關
  add({
    id: 'intro:script', world: 'intro', type: 'info', title: '認識日語文字', sub: '三種文字與五十音圖', icon: '🗾', items: [],
    pages: [
      `<h2 class="g-title">日語有三種文字</h2><div class="info-rows">
        <div class="info-row"><span class="ir-em">🌸</span><div><b lang="ja">ひらがな</b><p>圓圓的，用來寫日語本身的字，例如 <span lang="ja">さくら</span>（櫻花）。<b>最先學這個。</b></p></div></div>
        <div class="info-row"><span class="ir-em">🍙</span><div><b lang="ja">カタカナ</b><p>直直的，用來寫外來語，例如 <span lang="ja">コーヒー</span>（咖啡）。</p></div></div>
        <div class="info-row"><span class="ir-em">🈶</span><div><b lang="ja">漢字</b><p>和中文很像，例如 <span lang="ja">日本、学生</span>，你已經先贏一半了！</p></div></div></div>`,
      `<h2 class="g-title">五十音圖是什麼？</h2><p>日語的基本發音表，一共約 50 個音。<b>橫排叫「行」，直排叫「段」。</b></p>
        <p>最上面的 <b lang="ja">あ い う え お</b> 是 5 個「母音」，其他每個音都是「子音＋母音」：</p>
        <table class="gt"><tr><th></th><th lang="ja">あ</th><th lang="ja">い</th><th lang="ja">う</th><th lang="ja">え</th><th lang="ja">お</th></tr>
        <tr><th>母音</th><td>a</td><td>i</td><td>u</td><td>e</td><td>o</td></tr>
        <tr><th lang="ja">か行</th><td lang="ja">か<br><small>k+a</small></td><td lang="ja">き<br><small>k+i</small></td><td lang="ja">く<br><small>k+u</small></td><td lang="ja">け<br><small>k+e</small></td><td lang="ja">こ<br><small>k+o</small></td></tr></table>
        <p>所以只要把 5 個母音學好，後面就很好學了！</p>`,
      `<h2 class="g-title">一個假名＝一個固定發音</h2><p>就像注音符號，看到就唸，不會像英文一樣變來變去。</p>
        <div class="info-vowels" lang="ja"><div><b>あ</b><small>ㄚ</small></div><div><b>い</b><small>ㄧ</small></div><div><b>う</b><small>ㄨ</small></div><div><b>え</b><small>ㄝ</small></div><div><b>お</b><small>ㄛ</small></div></div>
        <p class="small muted">注音只是近似：日語的「う」嘴唇放鬆、不用嘟圓。實際發音請多按 🔊 聽幾遍。</p>`,
      `<h2 class="g-title">這樣學最有效</h2><ul class="info-list"><li>🖼️ <b>每個假名都配一張圖</b>，把「形狀＋聲音＋圖片」連在一起記。</li><li>🔊 <b>多聽、跟著唸</b>：每個字都能聽到發音，也有慢速 🐢。</li><li>🧩 <b>每關只學 2～5 個字</b>，不用急，答錯的題目會再出現。</li><li>🔁 <b>每天 5～10 分鐘</b>，保持連勝，比一次學很久有效。</li></ul>`,
    ],
  });
  add({ id: 'intro:v1', world: 'intro', type: 'kana', easy: true, title: 'あ・い・う', sub: '第一組母音 a i u', icon: 'あ', items: ['h:あ', 'h:い', 'h:う'] });
  add({ id: 'intro:v2', world: 'intro', type: 'kana', easy: true, title: 'え・お', sub: '第二組母音 e o', icon: 'え', items: ['h:え', 'h:お'] });
  add({ id: 'intro:v3', world: 'intro', type: 'kana', noTeach: true, title: '母音總複習', sub: 'あいうえお 聽力＋配對', icon: '🔁', items: ['h:あ', 'h:い', 'h:う', 'h:え', 'h:お'] });
  bossOf('intro', '母音・鬼關');
  kanaNodes('hira', 'hira', basicRows.slice(1));
  bossOf('hira', '平假名・鬼關');
  kanaNodes('kata', 'kata', basicRows.map(([k, t, l]) => [k, t.replace(/[あ-ん]/g, (c) => K.toKata(c)), K.toKata(l)]));
  bossOf('kata', '片假名・鬼關');
  kanaNodes('dakuon', 'hira', [
    ['hg', 'が行・ざ行', 'がぎぐげござじずぜぞ'], ['hd', 'だ行・ば行', 'だぢづでどばびぶべぼ'], ['hp', 'ぱ行', 'ぱぴぷぺぽ'],
  ]);
  kanaNodes('dakuon', 'kata', [
    ['kg', 'ガ行・ザ行', 'ガギグゲゴザジズゼゾ'], ['kd', 'ダ行・バ行', 'ダデドバビブベボ'], ['kp', 'パ行', 'パピプペポ'],
  ]);
  const yoonNode = (key, title, script, bases) => {
    const items = bases.flatMap((c) => ['ゃ', 'ゅ', 'ょ'].map((s) => kid(script, script === 'hira' ? c + s : K.toKata(c + s)))).filter((id) => ITEMS.has(id));
    add({ id: `dakuon:${key}`, world: 'dakuon', type: 'kana', title, sub: items.map((i) => i.slice(2)).slice(0, 9).join(' '), icon: items[0].slice(2), items });
  };
  yoonNode('y1', '拗音 ① き・し・ち・に', 'hira', ['き', 'し', 'ち', 'に']);
  yoonNode('y2', '拗音 ② ひ・み・り', 'hira', ['ひ', 'み', 'り']);
  yoonNode('y3', '拗音 ③ ぎ・じ・び・ぴ', 'hira', ['ぎ', 'じ', 'び', 'ぴ']);
  yoonNode('y4', 'カタカナ拗音 ①', 'kata', ['き', 'し', 'ち', 'に', 'ひ']);
  yoonNode('y5', 'カタカナ拗音 ②', 'kata', ['み', 'り', 'ぎ', 'じ', 'び', 'ぴ']);
  bossOf('dakuon', '濁音・拗音・鬼關');

  // 單字／文法關卡
  const lessonMap = new Map(JP.LESSONS.map((l) => [l.id, l]));
  const gmap = new Map(JP.GRAMMAR.map((g) => [g.id, g]));
  function wordNode(world, lid) {
    const l = lessonMap.get(lid);
    add({ id: `${world}:${lid}`, world, type: 'lesson', lesson: lid, title: l.title, sub: l.zh, icon: l.em, items: l.words.map((w) => `w:${w[0]}`) });
  }
  function grammarNode(world, gid) {
    const g = gmap.get(gid);
    add({ id: `${world}:g-${gid}`, world, type: 'grammar', gid, title: g.title, sub: g.sub, icon: '文', items: [] });
  }
  const seq = (world, list) => list.forEach((x) => (x.startsWith('g:') ? grammarNode(world, x.slice(2)) : wordNode(world, x)));
  seq('n5a', ['greet', 'intro', 'g:desu', 'num1', 'num2', 'g:ka', 'food', 'drink', 'animal', 'color', 'g:no', 'body', 'place', 'vehicle', 'nature', 'time']);
  bossOf('n5a', 'N5 基礎・鬼關');
  seq('n5b', ['things', 'house', 'verb1', 'g:wo', 'verb2', 'g:masu', 'verb3', 'g:ni-de', 'adj1', 'adj2', 'g:adj', 'adjna', 'g:aru-iru', 'ques', 'g:tai', 'g:te']);
  bossOf('n5b', 'N5 日常・鬼關');
  seq('n4', ['family', 'clothes', 'school', 'shopping', 'town', 'restaurant', 'health', 'g:nai', 'verb4', 'verb5', 'g:ta-koto', 'feeling', 'g:dekiru', 'travel', 'g:kara', 'adj3', 'g:naru', 'g:hou']);
  bossOf('n4', 'N4 魔王・鬼關');

  // 鬼關題庫：該世界所有項目
  WORLDS.forEach((w) => {
    const ns = worldNodes[w.id];
    const boss = ns[ns.length - 1];
    boss.items = Array.from(new Set(ns.filter((n) => n.type !== 'boss').flatMap((n) => n.items)));
    boss.gids = ns.filter((n) => n.type === 'grammar').map((n) => n.gid);
    w.nodes = ns;
  });

  /* ───────────── 進度與解鎖 ───────────── */
  const stateOf = (n) => {
    const p = S.nodes[n.id];
    return { stars: (p && p.stars) || 0, done: !!(p && (p.stars > 0 || p.skipped)), skipped: !!(p && p.skipped && !p.stars), locked: n.idx > S.unlocked, current: n.idx === S.unlocked };
  };
  function completeNode(n, stars) {
    const p = S.nodes[n.id] || (S.nodes[n.id] = { stars: 0, plays: 0 });
    p.stars = Math.max(p.stars || 0, stars);
    p.plays = (p.plays || 0) + 1;
    delete p.skipped;
    if (n.idx >= S.unlocked) S.unlocked = Math.min(NODES.length - 1, n.idx + 1);
    JP.save();
  }
  // 跳級：把世界內尚未完成的關卡標示為「已跳過」並把項目視為已學過
  function skipWorld(worldId) {
    const ns = worldNodes[worldId];
    ns.forEach((n) => {
      const p = S.nodes[n.id];
      if (!p || !p.stars) S.nodes[n.id] = Object.assign(p || { plays: 0 }, { stars: 0, skipped: true });
      n.items.forEach((id) => JP.seed(id, 2));
    });
    const last = ns[ns.length - 1];
    S.unlocked = Math.max(S.unlocked, Math.min(NODES.length - 1, last.idx + 1));
    JP.save();
  }
  // 依程度直接開始於某個世界（之前的世界全部標示為已跳過）
  function startAtWorld(w) {
    const i = typeof w === 'number' ? w : WORLDS.findIndex((x) => x.id === w);
    if (i < 0) return;
    for (let w = 0; w < i; w++) skipWorld(WORLDS[w].id);
    S.unlocked = Math.max(S.unlocked, worldNodes[WORLDS[i].id][0].idx);
    JP.save();
  }
  const worldOf = (id) => WORLDS.find((w) => w.id === id);
  const worldStars = (w) => {
    const ns = w.nodes;
    let got = 0;
    ns.forEach((n) => { got += stateOf(n).stars; });
    return { got, max: ns.length * 3 };
  };
  const worldCleared = (w) => stateOf(w.nodes[w.nodes.length - 1]).stars > 0;
  const currentNode = () => NODES[Math.min(S.unlocked, NODES.length - 1)];

  // 課程版本升級（新增關卡會改變索引）：依已完成的關卡重新計算解鎖進度
  if (S.cv !== 3) {
    let m = -1;
    NODES.forEach((n) => { const q = S.nodes[n.id]; if (q && (q.stars > 0 || q.skipped)) m = Math.max(m, n.idx); });
    S.unlocked = Math.max(0, Math.min(NODES.length - 1, m + 1));
    S.cv = 3; JP.save();
  }

  Object.assign(JP, { WORLDS, NODES, nodeById, worldNodes, stateOf, completeNode, skipWorld, startAtWorld, worldOf, worldStars, worldCleared, currentNode, gmap, lessonMap });

  JP.itemList = (kind) => Array.from(ITEMS.values()).filter((i) => !kind || i.kind === kind);
})();
