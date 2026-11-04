// Small HUD parts in the postcard look. Each returns HTML or wires an element; the page decides the layout.

export const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

// Saved choices per trip, so a reload keeps them. Storage can be missing; the page still works.
// get(key, default, ok): ok is a list of allowed values or a test; a saved value that fails it (an
// older page, another build of the same trip) gives the default.
export function store(id) {
  const KEY = 'postcard:' + id + ':';
  const fits = (v, ok) => !ok || (Array.isArray(ok) ? ok.includes(v) : ok(v));
  return { get(k, d, ok) { try { const s = localStorage.getItem(KEY + k), v = s == null ? d : JSON.parse(s); return fits(v, ok) ? v : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch {} }, key: KEY };
}

// One tooltip for the page. show(event, html) puts it beside the pointer and inside the window.
export function tooltip() {
  let el = document.getElementById('tip');
  if (!el) { el = document.createElement('div'); el.id = 'tip'; el.className = 'pc-tip'; el.setAttribute('role', 'tooltip'); document.body.append(el); }
  const put = (x, y) => { el.style.left = Math.max(8, Math.min(x, innerWidth - el.offsetWidth - 8)) + 'px'; el.style.top = Math.max(8, Math.min(y, innerHeight - el.offsetHeight - 8)) + 'px'; };
  const hits = (a, b) => a.x < b.right && a.x + a.w > b.left && a.y < b.bottom && a.y + a.h > b.top;
  return {
    // True on a device with a mouse. On a touch screen a tap that picks must not also open a tip.
    canHover: matchMedia('(hover: hover)').matches,
    // At the pointer, below and to the right, for a point on the map or a bar.
    show(e, html) { el.innerHTML = html; el.style.opacity = 1; put(e.clientX + 14, e.clientY + 16); },
    // Beside an element (a row, a cell): outside the box `avoid` (usually the card), so the tip never
    // covers the next row's figures. Tries left of avoid, above it, then right and left of el.
    beside(target, html, { avoid } = {}) {
      el.innerHTML = html; el.style.opacity = 1;
      const r = target.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, A = avoid?.getBoundingClientRect?.() || avoid;
      const tries = [];
      if (A) tries.push({ x: A.left - w - 12, y: r.top }, { x: r.left, y: A.top - h - 12 }, { x: A.right + 12, y: r.top });
      tries.push({ x: r.right + 10, y: r.top }, { x: r.left - w - 10, y: r.top }, { x: r.left, y: r.bottom + 8 });
      const fits = (t) => t.x >= 8 && t.y >= 8 && t.x + w <= innerWidth - 8 && t.y + h <= innerHeight - 8 && !(A && hits({ ...t, w, h }, A));
      const t = tries.find(fits) || tries[tries.length - 1]; put(t.x, t.y);
    },
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
    ${value ? `<text x="33" y="67" text-anchor="middle" style="font:700 9.5px var(--sans);letter-spacing:.06em" fill="var(--ink)">${esc(value)}</text>` : ''}</g>`;
}
// A round postmark: two rings, a small top line and a big middle line, with wavy cancel lines.
export function postmarkSVG({ top, mid, x, y, rot = 0, ink = 'var(--ink)' }) {
  return `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="${ink}" stroke-width="1.3" opacity=".85">
    <circle r="27"/><circle r="21"/><text y="-5" text-anchor="middle" fill="${ink}" stroke="none" style="font:600 8px var(--sans);letter-spacing:.16em"${String(top).length > 7 ? ' textLength="32" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(top)}</text>
    <text y="9" text-anchor="middle" fill="${ink}" stroke="none" style="font:600 13px var(--serif)"${String(mid).length > 6 ? ' textLength="38" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(mid)}</text>
    <path d="M30 -9 q8 -5 16 0 t16 0 t16 0 M30 0 q8 -5 16 0 t16 0 t16 0 M30 9 q8 -5 16 0 t16 0 t16 0" stroke-width="1"/></g>`;
}

// A modal sheet in the paper style. open(html) shows it; Esc or a click outside closes it.
// Every sheet() shares one element and one key handler; the sheet shown last owns close and focus.
let SHEET = null;
export function sheet(label = 'Details') {
  let bg = document.getElementById('pc-sheetbg');
  if (!bg) { bg = document.createElement('div'); bg.id = 'pc-sheetbg'; bg.className = 'pc-sheetbg'; bg.hidden = true;
    bg.innerHTML = '<div class="pc-card pc-sheet" role="dialog" aria-modal="true"></div>'; document.body.append(bg);
    bg.onclick = (e) => { if (e.target === bg) SHEET?.close(); };
    addEventListener('keydown', (e) => {
      if (bg.hidden || !SHEET) return;
      if (e.key === 'Escape') { SHEET.close(); e.stopImmediatePropagation(); e.preventDefault(); return; }
      if (e.key !== 'Tab') return;
      const box = bg.firstElementChild;
      const f = [...box.querySelectorAll('button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!box.contains(document.activeElement)) { first.focus(); e.preventDefault(); }
      else if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); } }, true); }
  const box = bg.firstElementChild;
  let opener = null;
  const api = {
    el: box, get open() { return !bg.hidden && SHEET === api; },
    // Focus moves into the sheet, stays there on Tab, and goes back to the opener on close.
    show(html) { if (SHEET && SHEET !== api && !bg.hidden) SHEET.close(); SHEET = api; opener = document.activeElement;
      box.setAttribute('aria-label', label); box.innerHTML = html; bg.hidden = false;
      // A long sheet opens on its title: focus without scrolling to the first control (often Cancel at the bottom).
      box.querySelector('button, a, input, textarea, select')?.focus({ preventScroll: true }); box.scrollTop = 0; bg.scrollTop = 0; },
    close() { if (SHEET !== api || bg.hidden) return; bg.hidden = true; SHEET = null; api.onclose?.(); if (opener?.isConnected) opener.focus(); opener = null; },
  };
  return api;
}

// Meters: a small row of cells, some lit. lit/total for hours lost, moments seen, nights, and so on.
// tone 'ink' for a neutral count (hotel nights); the default red is for a cost (hours lost).
export const cellsHTML = (n, lit, { cls = '', tone = '' } = {}) => `<span class="pc-cells ${tone === 'ink' ? 'ink ' : ''}${cls}">${[...Array(Math.max(0, n))].map((_, i) => `<i class="${i < lit ? 'on' : ''}"></i>`).join('')}</span>`;
