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
  async function init() {
    set('loading');
    try {
      if (!window.firebase) for (const src of FB_SCRIPTS) await loadScript(src);
      window.firebase.initializeApp(cfg);
      auth = window.firebase.auth();
      db = window.firebase.firestore();
      auth.onAuthStateChanged(async (u) => {
        sync.user = u ? { uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || '' } : null;
        sync.ready = true;
        if (u) { set('syncing'); await pull(true); } else set('signedout');
      });
    } catch (e) {
      set('error', navigator.onLine ? '無法載入雲端同步（請稍後再試）' : '目前離線，恢復連線後會再同步');
    }
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
    Object.keys(S).forEach((k) => delete S[k]);
    Object.assign(S, JP.defaults(), merged);
    S.set = Object.assign(JP.defaults().set, merged.set || {});
    S.stats = Object.assign(JP.defaults().stats, merged.stats || {});
    if (voice !== undefined) S.set.voice = voice; // 語音是裝置專屬設定
  }

  // 從雲端取回並合併
  async function pull(andPush) {
    if (!sync.user) return;
    lastPull = Date.now();
    try {
      const snap = await docRef().get();
      if (snap.exists) {
        const remote = JSON.parse(snap.data().state || '{}');
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

  async function push() {
    if (!sync.user) return;
    if (pushing) { pendingPush = true; return; }
    pushing = true;
    try {
      await docRef().set({ state: JSON.stringify(S), mt: S.mt || Date.now(), v: 1, updated: Date.now() });
      sync.last = Date.now();
      set('idle');
    } catch (e) { set('error', friendly(e)); }
    pushing = false;
    if (pendingPush) { pendingPush = false; schedulePush(); }
  }
  function schedulePush() {
    if (!sync.user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 2500);
  }

  sync.signIn = async () => {
    if (!auth) return;
    try {
      set('syncing');
      await auth.signInWithPopup(new window.firebase.auth.GoogleAuthProvider());
    } catch (e) {
      if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) return set('signedout');
      set('error', friendly(e));
    }
  };
  sync.signOut = async () => { if (auth) { await auth.signOut(); } };
  sync.now = async () => { if (!sync.user) return; set('syncing'); await pull(true); };
  // 清除進度時一併清掉雲端，避免被舊資料還原
  sync.wipe = async () => { if (!sync.user) return; try { await docRef().delete(); } catch (e) { /* 忽略 */ } };

  JP.on('saved', (opt) => { if (!(opt && opt.noSync)) schedulePush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (sync.user && pushTimer) { clearTimeout(pushTimer); push(); } }
    else if (sync.user && Date.now() - lastPull > 60000 && !document.querySelector('.overlay.open')) pull(false);
  });
  window.addEventListener('online', () => { if (sync.user) pull(true); });

  init();
})();
