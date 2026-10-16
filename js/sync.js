/* sync.js — Google 登入 + Firebase Firestore 雲端同步（選用，需先設定 js/sync-config.js）
   進度以「合併」而不是「覆蓋」的方式同步：兩台裝置各自學的進度會取聯集／較大值，不會互相蓋掉。 */
(function () {
  'use strict';
  const JP = window.JP;
  const S = JP.S;
  const cfg = window.JP_SYNC_CONFIG || null;
  const FB_VER = '10.12.2';
  const FB_SCRIPTS = ['app', 'auth', 'firestore'].map((n) => `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-${n}-compat.js`);

  /* ───── 合併規則（純函式，方便測試） ───── */
  const num = (x) => (typeof x === 'number' && isFinite(x) ? x : 0);
  function mergeState(a, b) {
    // 「清除進度」會記下 resetAt：重置時間較晚的一方整份勝出，避免另一台裝置的舊進度把清除的結果還原
    const ra = num(a.resetAt), rb = num(b.resetAt);
    if (ra !== rb) return JSON.parse(JSON.stringify(ra > rb ? a : b));
    const newer = num(a.mt) >= num(b.mt) ? a : b;
    const out = JSON.parse(JSON.stringify(newer));
    out.xp = Math.max(num(a.xp), num(b.xp));
    out.bestStreak = Math.max(num(a.bestStreak), num(b.bestStreak));
    out.unlocked = Math.max(num(a.unlocked), num(b.unlocked));
    out.onboarded = !!(a.onboarded || b.onboarded);
    // 連勝：採用「最近一次學習日較晚」的那邊
    const la = a.lastDay || '', lb = b.lastDay || '';
    const s = la > lb || (la === lb && num(a.streak) >= num(b.streak)) ? a : b;
    out.streak = s.streak || 0; out.lastDay = s.lastDay || null; out.freezes = s.freezes == null ? 1 : s.freezes;
    out.frozen = Array.from(new Set([].concat(a.frozen || [], b.frozen || []))).sort().slice(-30);
    out.days = {};
    [a.days, b.days].forEach((d) => Object.keys(d || {}).forEach((k) => { out.days[k] = Math.max(out.days[k] || 0, num(d[k])); }));
    out.nodes = {};
    [a.nodes, b.nodes].forEach((ns) => Object.keys(ns || {}).forEach((id) => {
      const x = ns[id], y = out.nodes[id];
      if (!y) { out.nodes[id] = Object.assign({}, x); return; }
      y.stars = Math.max(num(y.stars), num(x.stars));
      y.plays = Math.max(num(y.plays), num(x.plays));
      if (y.stars > 0 || !(x.skipped && y.skipped)) delete y.skipped;
    }));
    out.cards = {};
    [a.cards, b.cards].forEach((cs) => Object.keys(cs || {}).forEach((id) => {
      const x = cs[id], y = out.cards[id];
      if (!y || num(x.seen) > num(y.seen) || (num(x.seen) === num(y.seen) && String(x.due) > String(y.due))) out.cards[id] = Object.assign({}, x);
    }));
    out.stats = {};
    [a.stats, b.stats].forEach((st) => Object.keys(st || {}).forEach((k) => { out.stats[k] = Math.max(out.stats[k] || 0, num(st[k])); }));
    out.ach = Object.assign({}, b.ach || {}, a.ach || {});
    Object.keys(out.ach).forEach((k) => { const x = (a.ach || {})[k], y = (b.ach || {})[k]; if (x && y) out.ach[k] = x < y ? x : y; });
    out.stamps = Object.assign({}, b.stamps || {}, a.stamps || {});
    out.cv = Math.max(num(a.cv), num(b.cv));
    out.resetAt = ra;
    out.uid = a.uid || b.uid || undefined;
    if (out.uid === undefined) delete out.uid;
    return out;
  }

  /* ───── 狀態 ───── */
  const sync = {
    enabled: !!(cfg && cfg.apiKey && cfg.projectId),
    user: null, status: 'off', last: 0, error: '', ready: false,
    mergeState,
  };
  JP.sync = sync;
  const set = (status, error) => { sync.status = status; sync.error = error || ''; JP.emit('sync'); };
  if (!sync.enabled) return;

  let auth = null, db = null, pushTimer = 0, pushing = false, pendingPush = false, lastPull = 0;

  const loadScript = (src) => new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = src; el.onload = res; el.onerror = () => rej(new Error('load ' + src));
    document.head.appendChild(el);
  });
  // 登入過的人才會在開頁時載入 Firebase SDK（數百 KB）；沒登入過的人按「登入」時才載入
  const FLAG = 'jpl.signedIn';
  const flag = (v) => { try { if (v) localStorage.setItem(FLAG, '1'); else localStorage.removeItem(FLAG); } catch (e) { /* 略過 */ } };
  const hasFlag = () => { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } };
  let initP = null;
  function init() {
    if (initP) return initP;
    set('loading');
    initP = (async () => {
      try {
        if (!window.firebase) for (const src of FB_SCRIPTS) await loadScript(src);
        window.firebase.initializeApp(cfg);
        auth = window.firebase.auth();
        db = window.firebase.firestore();
        auth.onAuthStateChanged(async (u) => {
          sync.user = u ? { uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || '' } : null;
          sync.ready = true;
          if (u) {
            flag(true);
            // 這台裝置上的進度屬於別的帳號：不合併，避免兩個人的進度混在一起
            if (S.uid && S.uid !== u.uid) { JP.replaceState(JP.defaults()); JP.save({ noSync: true }); if (JP.views) { JP.views.applyTheme(); JP.views.refresh(); } }
            S.uid = u.uid;
            set('syncing'); await pull(true);
          } else { flag(false); set('signedout'); }
        });
      } catch (e) {
        initP = null;
        set('error', navigator.onLine ? '無法載入雲端同步（請稍後再試）' : '目前離線，恢復連線後會再同步');
      }
    })();
    return initP;
  }

  const docRef = () => db.collection('users').doc(sync.user.uid);
  const friendly = (e) => {
    const c = (e && e.code) || '';
    if (c === 'auth/unauthorized-domain') return '這個網址還沒加入 Firebase 的「授權網域」，請看設定教學';
    if (c === 'auth/popup-blocked') return '瀏覽器擋住了登入視窗，請允許彈出視窗後再試一次';
    if (c === 'permission-denied' || c === 'firestore/permission-denied') return 'Firestore 規則尚未設定好，請看設定教學';
    if (c === 'unavailable' || !navigator.onLine) return '目前連不上雲端，稍後會自動重試';
    return '同步失敗：' + (c || (e && e.message) || '未知錯誤');
  };

  function applyToLocal(merged) {
    const voice = S.set && S.set.voice;
    JP.replaceState(merged);
    if (voice !== undefined) S.set.voice = voice; // 語音是裝置專屬設定
    if (sync.user) S.uid = sync.user.uid;
  }

  // 從雲端取回並合併
  async function pull(andPush) {
    if (!sync.user) return;
    lastPull = Date.now();
    try {
      const snap = await docRef().get();
      if (snap.exists) {
        const remote = JP.sanitizeState(JSON.parse(snap.data().state || '{}'));
        if (remote && typeof remote === 'object' && remote.cards) {
          const merged = mergeState(JSON.parse(JSON.stringify(S)), remote);
          applyToLocal(merged);
          JP.save({ noSync: true });
          if (JP.views) { JP.views.applyTheme(); JP.views.refresh(); }
        }
      }
      sync.last = Date.now();
      set('idle');
      if (andPush) await push();
    } catch (e) { set('error', friendly(e)); }
  }

  const MAX_STATE = 850000; // Firestore 單一文件上限約 1MB，留一點空間
  async function push() {
    pushTimer = 0;
    if (!sync.user) return;
    if (pushing) { pendingPush = true; return; }
    pushing = true;
    try {
      if (JSON.stringify(S).length > MAX_STATE) throw Object.assign(new Error('too big'), { code: 'state-too-big' });
      // 先讀雲端、合併、再寫回：兩台裝置同時使用時，不會用舊進度蓋掉另一台的進度
      let merged = null;
      await db.runTransaction(async (tx) => {
        const ref = docRef();
        const snap = await tx.get(ref);
        const local = JSON.parse(JSON.stringify(S));
        const remote = snap.exists ? JP.sanitizeState(JSON.parse(snap.data().state || '{}')) : null;
        merged = remote && remote.cards ? mergeState(local, remote) : local;
        merged.uid = sync.user.uid;
        tx.set(ref, { state: JSON.stringify(merged), mt: merged.mt || Date.now(), v: 1, updated: Date.now() });
      });
      if (merged) { applyToLocal(merged); JP.save({ noSync: true }); }
      sync.last = Date.now();
      set('idle');
    } catch (e) { set('error', e && e.code === 'state-too-big' ? '進度資料太大，無法同步到雲端，請先匯出備份並回報問題' : friendly(e)); }
    pushing = false;
    if (pendingPush) { pendingPush = false; schedulePush(); }
  }
  function schedulePush() {
    if (!sync.user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 2500);
  }

  // 瀏覽器只允許在「按下去的當下」開登入視窗，所以不能等載入完才開：
  // 開啟「我的」頁、歡迎頁或滑鼠移到登入按鈕時就先在背景載入；還沒載入完就按了，提示再按一次
  sync.preload = () => { if (!auth) init(); };
  sync.signIn = async () => {
    if (!auth) {
      init();
      if (JP.ui && JP.ui.toast) JP.ui.toast('正在載入登入功能，請稍等一下再按一次');
      return;
    }
    try {
      set('syncing');
      await auth.signInWithPopup(new window.firebase.auth.GoogleAuthProvider());
    } catch (e) {
      if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) return set('signedout');
      set('error', friendly(e));
    }
  };
  sync.signOut = async () => { if (auth) { await auth.signOut(); } flag(false); };
  sync.flush = () => push();
  sync.now = async () => { if (!sync.user) return; set('syncing'); await pull(true); };
  // 清除進度時一併清掉雲端，避免被舊資料還原
  // 寫入「已重置」的空進度（帶 resetAt），其他裝置同步時會整份採用它，不會把舊進度推回來；回傳是否成功
  sync.wipe = async (ts) => {
    if (!sync.user) return true;
    try {
      const fresh = JP.defaults(); fresh.resetAt = ts || Date.now(); fresh.mt = fresh.resetAt; fresh.uid = sync.user.uid;
      await docRef().set({ state: JSON.stringify(fresh), mt: fresh.mt, v: 1, updated: Date.now() });
      return true;
    } catch (e) { set('error', friendly(e)); return false; }
  };

  JP.on('saved', (opt) => { if (!(opt && opt.noSync)) schedulePush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (sync.user && pushTimer) { clearTimeout(pushTimer); push(); } }
    else if (sync.user && Date.now() - lastPull > 60000 && !document.querySelector('.overlay.open')) pull(false);
  });
  window.addEventListener('online', () => { if (sync.user) pull(true); });

  if (hasFlag()) init(); else { sync.ready = true; set('signedout'); }
})();
