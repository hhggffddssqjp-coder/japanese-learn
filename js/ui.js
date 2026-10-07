/* ui.js — 圖示、提示訊息、對話框、櫻花紙吹雪 */
(function () {
  'use strict';
  const JP = window.JP;

  const svg = (body, cls = '', vb = '0 0 24 24') => `<svg class="ic ${cls}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
  const stroke = (d, cls = '') => svg(`<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</g>`, cls);
  const ICON = {
    flame: (cls = '') => svg('<path d="M12.6 1.8c.5 3-.7 4.7-2.2 6.5C8.8 10.2 7 12 7 15a5.4 5.4 0 0 0 5.5 5.4c3.1 0 5.5-2.3 5.5-5.7 0-2.5-1.2-4.1-2.3-5.4.1 1.2-.2 2.2-1 2.9.3-3.5-.9-7.6-2.1-10.4z" fill="currentColor"/><path d="M12.4 20.4c-1.8 0-3-1.2-3-2.9 0-1.6 1-2.4 2-3.6.4 1 1 1.5 1.7 1.7.5-.5.7-1.2.7-1.9 1 1 1.6 1.9 1.6 3.2 0 2-1.4 3.5-3 3.5z" fill="#fff" opacity=".55"/>', 'ic-flame'),
    heart: (cls = '') => svg('<path d="M12 20.6C5 15.7 2.4 12.1 2.4 8.7 2.4 6 4.4 4 7 4c1.9 0 3.7 1 5 2.8C13.3 5 15.1 4 17 4c2.6 0 4.6 2 4.6 4.7 0 3.4-2.6 7-9.6 11.9z" fill="currentColor"/>', cls),
    star: (cls = '') => svg('<path d="M12 2.4l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17.3l-5.9 3.2 1.2-6.6L2.5 9.3l6.6-.9z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>', cls),
    lock: (cls = '') => stroke('<rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" fill-opacity=".15"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', cls),
    check: (cls = '') => stroke('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3"/>', cls),
    close: (cls = '') => stroke('<path d="M6 6l12 12M18 6L6 18" stroke-width="2.6"/>', cls),
    speaker: (cls = '') => stroke('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="currentColor" fill-opacity=".2"/><path d="M15.5 8.8a4.4 4.4 0 0 1 0 6.4M18.2 6.2a8 8 0 0 1 0 11.6"/>', cls),
    learn: (cls = '') => stroke('<path d="M12 21s7-6 7-11.2A7 7 0 0 0 5 9.8C5 15 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.6"/>', cls),
    dex: (cls = '') => stroke('<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7.5h6M9 11h4"/>', cls),
    practice: (cls = '') => stroke('<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z" fill="currentColor" fill-opacity=".15"/>', cls),
    me: (cls = '') => stroke('<circle cx="12" cy="8" r="4"/><path d="M4 20.5c.6-4 3.8-6.5 8-6.5s7.4 2.5 8 6.5"/>', cls),
    chevron: (cls = '') => stroke('<path d="M9 5l7 7-7 7"/>', cls),
    back: (cls = '') => stroke('<path d="M15 5l-7 7 7 7"/>', cls),
    bolt: (cls = '') => svg('<path d="M13 2L4.5 13.5H11l-1 8L19 10h-6.5z" fill="currentColor"/>', cls),
    ear: (cls = '') => stroke('<path d="M7 9a5 5 0 0 1 10 0c0 2.5-2 3.2-3 4.7-.8 1.2-.5 3.3-2.5 3.8-1.6.4-2.7-.5-3-1.5"/><path d="M10 9.5a2 2 0 0 1 4 0"/>', cls),
    gear: (cls = '') => stroke('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>', cls),
    flag: (cls = '') => stroke('<path d="M5 21V4M5 4.5h11l-2 3.5 2 3.5H5" fill="currentColor" fill-opacity=".15"/>', cls),
  };

  /* ───── 提示訊息 ───── */
  let toastTimer = 0;
  function toast(msg, ms = 2400) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.innerHTML = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  /* ───── 對話框 / 底部面板 ───── */
  const modals = [];
  function modal(html, opts = {}) {
    const root = document.createElement('div');
    root.className = 'modal' + (opts.sheet ? ' sheet' : '') + (opts.cls ? ' ' + opts.cls : '');
    root.innerHTML = `<div class="modal-bg"></div><div class="modal-box" role="dialog" aria-modal="true">${opts.noClose ? '' : `<button class="modal-x" aria-label="關閉">${ICON.close()}</button>`}${html}</div>`;
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add('in'));
    let closed = false;
    const api = {
      el: root,
      close() {
        if (closed) return;
        closed = true;
        root.classList.remove('in');
        const i = modals.indexOf(api);
        if (i >= 0) modals.splice(i, 1);
        setTimeout(() => root.remove(), 220);
        if (opts.onClose) opts.onClose();
      },
    };
    root.querySelector('.modal-bg').addEventListener('click', () => { if (!opts.noClose) api.close(); });
    const x = root.querySelector('.modal-x');
    if (x) x.addEventListener('click', api.close);
    root.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
    modals.push(api);
    const first = root.querySelector('[autofocus], .btn');
    if (first && !opts.noFocus) setTimeout(() => first.focus({ preventScroll: true }), 60);
    return api;
  }
  const closeTop = () => { const m = modals[modals.length - 1]; if (m) { m.close(); return true; } return false; };

  /* ───── 櫻花紙吹雪 ───── */
  let fxRaf = 0;
  function confetti(opts = {}) {
    const cv = document.getElementById('fx');
    if (!cv || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr);
    const g = cv.getContext('2d');
    const cols = opts.cols || ['#f7a8b8', '#fbc9d3', '#e8566d', '#ffd98a', '#ffffff', '#9fc5a0'];
    const n = opts.n || 90;
    const ps = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: -Math.random() * H * 0.6 - 20, r: (6 + Math.random() * 9) * dpr,
      vx: (Math.random() - 0.5) * 2.2 * dpr, vy: (2 + Math.random() * 3.2) * dpr, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.14,
      sw: Math.random() * 6.28, c: cols[Math.floor(Math.random() * cols.length)], petal: Math.random() < 0.7,
    }));
    const t0 = performance.now();
    cancelAnimationFrame(fxRaf);
    (function tick(t) {
      const el = t - t0;
      g.clearRect(0, 0, W, H);
      let alive = 0;
      ps.forEach((p) => {
        p.sw += 0.04; p.x += p.vx + Math.sin(p.sw) * 1.2 * dpr; p.y += p.vy; p.rot += p.vr;
        if (p.y < H + 30) alive++;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c; g.globalAlpha = el > 2600 ? Math.max(0, 1 - (el - 2600) / 900) : 1;
        if (p.petal) {
          g.beginPath(); g.moveTo(0, -p.r); g.bezierCurveTo(p.r * 0.9, -p.r * 0.6, p.r * 0.7, p.r * 0.8, 0, p.r); g.bezierCurveTo(-p.r * 0.7, p.r * 0.8, -p.r * 0.9, -p.r * 0.6, 0, -p.r); g.fill();
        } else g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        g.restore();
      });
      if (alive && el < 3600) fxRaf = requestAnimationFrame(tick);
      else g.clearRect(0, 0, W, H);
    })(t0);
  }

  const stopConfetti = () => { cancelAnimationFrame(fxRaf); const cv = document.getElementById('fx'); if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); };

  const speakBtn = (text, cls = '', slow = false) =>
    `<button type="button" class="spk ${cls}" data-say="${JP.esc(text)}"${slow ? ' data-slow="1"' : ''} aria-label="${slow ? '慢速播放' : '播放發音'}">${slow ? '<span class="turtle">🐢</span>' : ICON.speaker()}</button>`;

  JP.ui = { ICON, toast, modal, closeTop, confetti, stopConfetti, speakBtn };
})();
