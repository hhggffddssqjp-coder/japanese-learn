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
    if (!JP.tts.ok) return JP.ui.toast('這個瀏覽器不支援語音播放');
    if (!JP.tts.hasJa) JP.ui.toast('找不到日語語音，聲音可能不準確');
    b.classList.add('playing');
    JP.sfx.unlock();
    JP.tts.speak(b.dataset.say, { slow: b.dataset.slow ? true : undefined }).then(() => b.classList.remove('playing'));
    setTimeout(() => b.classList.remove('playing'), 2500);
  });

  // 第一次互動後解鎖音效（瀏覽器的自動播放限制）
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => JP.sfx.unlock(), { once: true, capture: true }));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && JP.ui.closeTop()) e.stopPropagation();
  });

  JP.views.applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener && window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', JP.views.applyTheme);
  JP.views.bind();
  window.addEventListener('hashchange', JP.views.route);
  JP.views.route();
  if (!S.onboarded) JP.views.showWelcome();

  // 跨日時自動更新連勝顯示
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !document.querySelector('.overlay.open')) JP.views.refresh(); });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* 離線快取失敗不影響使用 */ }));
  }
})();
