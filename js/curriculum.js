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

  kanaNodes('hira', 'hira', basicRows);
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
    boss.items = ns.filter((n) => n.type !== 'boss').flatMap((n) => n.items);
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
  function startAtWorld(i) {
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

  Object.assign(JP, { WORLDS, NODES, nodeById, worldNodes, stateOf, completeNode, skipWorld, startAtWorld, worldOf, worldStars, worldCleared, currentNode, gmap, lessonMap });

  JP.itemList = (kind) => Array.from(ITEMS.values()).filter((i) => !kind || i.kind === kind);
})();
