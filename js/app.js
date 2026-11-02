/* app.js — 啟動、全域事件、離線快取 */
(function () {
  'use strict';
  const JP = window.JP;
  const S = JP.S;

  // 發音按鈕：全站共用
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-say]');
    if (!b) return;
    e.preventDefault();
    if (!JP.tts.ok && !JP.tts.hq()) return JP.ui.toast('這個瀏覽器不支援語音播放');
    if (!JP.tts.can()) JP.ui.toast('找不到日語語音，聲音可能不準確');
    b.classList.add('playing');
    JP.sfx.unlock();
    JP.tts.speak(b.dataset.say, { slow: b.dataset.slow ? true : undefined }).then(() => b.classList.remove('playing'));
    setTimeout(() => b.classList.remove('playing'), 2500);
  });

  // 第一次互動後解鎖音效（瀏覽器的自動播放限制）
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { JP.sfx.unlock(); JP.tts.unlock(); }, { once: true, capture: true }));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented && JP.ui.closeTop()) e.stopPropagation();
  });

  // 滑鼠移到或點到登入按鈕時，先開始載入登入功能
  ['pointerover', 'focusin', 'touchstart'].forEach((ev) => document.addEventListener(ev, (e) => {
    if (JP.sync && JP.sync.preload && e.target.closest && e.target.closest('[data-act="signin"]')) JP.sync.preload();
  }, { passive: true }));

  // 全螢幕畫面（闖關、歡迎）開關時，同步背景頁面的 inert 狀態，並把 Tab 限制在畫面內
  const ovEl = document.getElementById('overlay');
  new MutationObserver(() => JP.ui.syncInert()).observe(ovEl, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !ovEl.classList.contains('open') || document.querySelector('.modal.in')) return;
    const f = Array.from(ovEl.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!ovEl.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  JP.views.applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener && window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', JP.views.applyTheme);
  JP.views.bind();
  window.addEventListener('hashchange', JP.views.route);
  JP.views.route();
  // 學過單字庫的人：先把單字庫載入，複習清單才看得到這些單字
  JP.bank.LEVELS.forEach((l) => { if (JP.bank.hasProgress(l.id)) JP.bank.load(l.id).then(() => JP.views.refresh()).catch(() => {}); });
  if (!S.onboarded) JP.views.showWelcome();

  // 跨日時自動更新連勝顯示
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !document.querySelector('.overlay.open')) JP.views.refresh(); });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* 離線快取失敗不影響使用 */ }));
  }
})();
