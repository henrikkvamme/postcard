// Small HUD parts in the postcard look. Each returns HTML or wires an element; the page decides the layout.

export const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

// Saved choices per trip, so a reload keeps them. Storage can be missing; the page still works.
export function store(id) {
  const KEY = 'postcard:' + id + ':';
  return { get(k, d) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch {} }, key: KEY };
}

// One tooltip for the page. show(event, html) puts it beside the pointer and inside the window.
export function tooltip() {
  let el = document.getElementById('tip');
  if (!el) { el = document.createElement('div'); el.id = 'tip'; el.className = 'pc-tip'; document.body.append(el); }
  return {
    show(e, html) { el.innerHTML = html; el.style.opacity = 1;
      el.style.left = Math.max(8, Math.min(e.clientX + 14, innerWidth - el.offsetWidth - 10)) + 'px'; el.style.top = Math.max(8, e.clientY - el.offsetHeight - 10) + 'px'; },
    hide() { el.style.opacity = 0; },
  };
}

// A row of chips for one choice. items: [[key, label, help?]]. Returns HTML; wire it with wireChips.
export const chipsHTML = (name, items, value) => `<div class="pc-chips" data-chips="${name}">${items.map(([k, label, help]) =>
  `<button class="pc-chip" data-k="${esc(k)}" aria-pressed="${k === value}" ${help ? `title="${esc(help)}"` : ''}>${label}</button>`).join('')}</div>`;
export const switchHTML = (name, label, on, help) => `<button class="pc-chip" data-switch="${name}" role="switch" aria-checked="${!!on}" ${help ? `title="${esc(help)}"` : ''}><span class="box"></span>${label}</button>`;
export function wireChips(root, handlers) {
  root.querySelectorAll('[data-chips]').forEach((g) => g.querySelectorAll('button').forEach((b) => b.onclick = () => handlers[g.dataset.chips]?.(b.dataset.k)));
  root.querySelectorAll('[data-switch]').forEach((b) => b.onclick = () => handlers[b.dataset.switch]?.(b.getAttribute('aria-checked') !== 'true'));
}

// The stamp: a perforated stamp with a drawing (img) or a short code, and a value line.
export function stampSVG({ img, code, value, x = 96, y = 8, rot = 3 }) {
  const perf = [...Array(11)].map((_, k) => `<circle cx="${k * 6 + 3}" cy="0" r="2.2"/><circle cx="${k * 6 + 3}" cy="76" r="2.2"/>`).join('') +
    [...Array(13)].map((_, k) => `<circle cx="0" cy="${k * 6 + 3}" r="2.2"/><circle cx="66" cy="${k * 6 + 3}" r="2.2"/>`).join('');
  return `<g transform="translate(${x},${y}) rotate(${rot})"><rect width="66" height="76" fill="#fff"/><g fill="var(--card)">${perf}</g>
    <rect x="6" y="6" width="54" height="64" fill="#e9ecf2"/>
    ${img ? `<image href="${esc(img)}" x="8" y="8" width="50" height="50" onerror="this.remove()"/>` : `<text x="33" y="44" text-anchor="middle" style="font:700 19px var(--serif)" fill="var(--ink)">${esc(code)}</text>`}
    ${value ? `<text x="33" y="67" text-anchor="middle" style="font:700 8px var(--sans);letter-spacing:.08em" fill="var(--ink)">${esc(value)}</text>` : ''}</g>`;
}
// A round postmark: two rings, a small top line and a big middle line, with wavy cancel lines.
export function postmarkSVG({ top, mid, x, y, rot = 0, ink = 'var(--ink)' }) {
  return `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="${ink}" stroke-width="1.3" opacity=".85">
    <circle r="27"/><circle r="21"/><text y="-5" text-anchor="middle" fill="${ink}" stroke="none" style="font:600 8px var(--sans);letter-spacing:.16em">${esc(top)}</text>
    <text y="9" text-anchor="middle" fill="${ink}" stroke="none" style="font:600 13px var(--serif)">${esc(mid)}</text>
    <path d="M30 -9 q8 -5 16 0 t16 0 t16 0 M30 0 q8 -5 16 0 t16 0 t16 0 M30 9 q8 -5 16 0 t16 0 t16 0" stroke-width="1"/></g>`;
}

// A modal sheet in the paper style. open(html) shows it; Esc or a click outside closes it.
export function sheet(label = 'Details') {
  let bg = document.getElementById('pc-sheetbg');
  if (!bg) { bg = document.createElement('div'); bg.id = 'pc-sheetbg'; bg.className = 'pc-sheetbg'; bg.hidden = true;
    bg.innerHTML = `<div class="pc-card pc-sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"></div>`; document.body.append(bg); }
  const box = bg.firstElementChild, api = {
    el: box, get open() { return !bg.hidden; },
    show(html) { box.innerHTML = html; bg.hidden = false; box.querySelector('button, a')?.focus(); },
    close() { bg.hidden = true; api.onclose?.(); },
  };
  bg.onclick = (e) => { if (e.target === bg) api.close(); };
  addEventListener('keydown', (e) => { if (!bg.hidden && e.key === 'Escape') { api.close(); e.stopImmediatePropagation(); } }, true);
  return api;
}

// Meters: a small row of cells, some lit. lit/total for hours lost, moments seen, nights, and so on.
export const cellsHTML = (n, lit, { cls = '' } = {}) => `<span class="pc-cells ${cls}">${[...Array(Math.max(0, n))].map((_, i) => `<i class="${i < lit ? 'on' : ''}"></i>`).join('')}</span>`;
