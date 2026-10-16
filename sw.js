/* 離線快取：優先連線，失敗時使用快取（只處理本站與字型；音檔另外快取，Firebase／Google API 一律不攔） */
const CACHE = 'nihongo-v10';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/data-kana.js', 'js/data-words.js', 'js/data-words-extra.js', 'js/data-words-n4a.js', 'js/data-words-n4b.js', 'js/data-word-levels.js', 'js/data-grammar.js', 'js/data-grammar-n4.js', 'js/data-phrases-daily.js', 'js/data-phrases-travel.js', 'js/core.js', 'js/curriculum.js', 'js/achievements.js',
  'js/ui.js', 'js/questions.js', 'js/player.js', 'js/bank.js', 'js/views.js', 'js/practice.js', 'js/sync-config.js', 'js/sync.js', 'js/app.js',
];

const AUDIO_CACHE = 'nihongo-audio'; // 預錄語音：播過的才會存，離線時仍可播放
const AUDIO_MAX = 3000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== AUDIO_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// 音檔：manifest 優先連線（失敗用快取）；mp3 優先用快取，沒有才下載並存起來（超過上限就刪最舊的）
async function audioFetch(req, url) {
  const cache = await caches.open(AUDIO_CACHE);
  if (url.pathname.endsWith('manifest.json')) {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req);
      if (hit) return hit;
      throw err;
    }
  }
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.status === 200) {
    await cache.put(req, res.clone());
    const keys = await cache.keys();
    if (keys.length > AUDIO_MAX) await Promise.all(keys.slice(0, keys.length - AUDIO_MAX).filter((k) => !k.url.endsWith('manifest.json')).map((k) => cache.delete(k)));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const font = /^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return; // Firebase、Google API 等跨網域請求不攔，也不存進快取
  if (same && url.pathname.includes('/audio/')) {
    // 帶 Range 的請求（舊版用 <audio src> 直接播）交給瀏覽器；現在改用 fetch 取得完整檔案
    if (req.headers.has('range')) return;
    e.respondWith(audioFetch(req, url));
    return;
  }
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: same }).then((r) => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
