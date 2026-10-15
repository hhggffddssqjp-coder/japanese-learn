/* bank.js — 單字庫：以開放 JLPT 單字表整理的大量單字（沒有圖片），資料在 js/bank-<級別>.js，使用時才載入 */
(function () {
  'use strict';
  const JP = window.JP;
  const S = JP.S;

  const SIZE = 10; // 每組單字數
  const LEVELS = [{ id: 'n3', label: 'N3', file: 'js/bank-n3.js' }];
  const BANK_WORLD = { id: 'bank', title: '單字庫', zh: '單字庫', em: '📚', theme: 'teal', level: 'N3', nodes: [] };
  const worldOf0 = JP.worldOf;
  JP.worldOf = (id) => (id === 'bank' ? BANK_WORLD : worldOf0(id));

  const lv = {}; // 級別 → { items, groups, promise }

  // 由原始資料建立項目與分組（資料檔載入後呼叫；測試也直接用它）
  function register(id) {
    if (lv[id] && lv[id].items) return lv[id];
    const rows = (JP.BANK && JP.BANK[id]) || [];
    const label = id.toUpperCase();
    const items = rows.map(([jp, rd, zh, pos, ex, exZh], i) => ({
      id: 'w:' + jp, kind: 'word', jp, rd, hasKanji: /[一-鿿々]/.test(jp), ro: JP.toRomaji(rd), zh, em: '',
      ex, exZh, exs: [[ex, exZh]], tip: '', pos, lv: label, bank: id, noOrder: false, lesson: `bank:${id}:${Math.floor(i / SIZE) + 1}`,
    }));
    const fresh = items.filter((it) => !JP.ITEMS.has(it.id));
    fresh.forEach((it) => JP.ITEMS.set(it.id, it));
    JP.Q.register(fresh);
    const groups = [];
    for (let g = 0; g * SIZE < items.length; g++) {
      const part = items.slice(g * SIZE, g * SIZE + SIZE);
      const node = { id: `bank:${id}:${g + 1}`, world: 'bank', type: 'lesson', lesson: `bank:${id}:${g + 1}`, title: `${label} 單字庫 #${g + 1}`, sub: `第 ${g + 1} 組・${part.length} 字`, icon: '📚', items: part.map((x) => x.id), idx: -1, bank: id };
      JP.nodeById.set(node.id, node);
      groups.push(node);
    }
    lv[id] = Object.assign(lv[id] || {}, { items, groups });
    return lv[id];
  }

  function load(id) {
    const cfg = LEVELS.find((l) => l.id === id);
    const cur = lv[id] || (lv[id] = {});
    if (cur.items) return Promise.resolve(cur);
    if (cur.promise) return cur.promise;
    cur.promise = new Promise((resolve, reject) => {
      const done = () => resolve(register(id));
      if (JP.BANK && JP.BANK[id]) return done();
      const el = document.createElement('script');
      el.src = cfg.file; el.onload = done;
      el.onerror = () => { cur.promise = null; el.remove(); reject(new Error('load ' + cfg.file)); };
      document.head.appendChild(el);
    });
    return cur.promise;
  }

  // 已經學過單字庫的人，開啟時要先載入（否則複習清單看不到這些單字）
  const hasProgress = (id) => Object.keys(S.nodes).some((k) => k.startsWith(`bank:${id}:`));

  JP.bank = { LEVELS, SIZE, load, register, hasProgress, get: (id) => lv[id] };
})();
