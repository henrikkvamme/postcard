// A layout probe for a postcard page. In a browser tool, run:
//   import('/kit/probe.js').then((m) => m.probe())
// It returns small facts instead of a picture. Each list is empty when the page is fine.
export function probe() {
  const W = innerWidth, H = innerHeight, out = { size: `${W}x${H}` };
  const C = window.__chart, st = C?.state?.();
  const visible = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && !el.closest('.off,[hidden]'); };
  const name = (el) => el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
  // The HUD: cards and titles that lie over the map.
  const hud = [...document.querySelectorAll('.pc-card, .pc-title, .pc-hud')].filter(visible).map((el) => ({ el, r: el.getBoundingClientRect() }));
  const inside = (p, r, m = 0) => p.x >= r.left - m && p.x <= r.right + m && p.y >= r.top - m && p.y <= r.bottom + m;

  // 1. Each end of the chosen route is on screen and not under the HUD.
  out.chosen = st?.chosen || [];
  out.hiddenEnds = [];
  if (C && st && !st.far) {
    const seen = new Set();
    for (const { id, ll } of st.points) { if (seen.has(id)) continue; seen.add(id);
      const p = C.map.project(ll), off = p.x < 8 || p.y < 8 || p.x > W - 8 || p.y > H - 8;
      const under = hud.find((h) => inside(p, h.r, 4));
      if (off || under) out.hiddenEnds.push(`${id} ${off ? 'off screen' : 'under ' + name(under.el)} at ${Math.round(p.x)},${Math.round(p.y)}`); }
  } else if (!C) out.hiddenEnds.push('no chart: window.__chart is missing');

  // 2. The page itself does not scroll sideways.
  out.pageOverflow = document.documentElement.scrollWidth > W + 1 ? [`page is ${document.documentElement.scrollWidth}px wide`] : [];

  // 3. Text that is too small to read, and text cut off by its box.
  out.smallText = []; out.clipped = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.closest('.maplibregl-ctrl, .pc-map canvas')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize), caps = cs.textTransform === 'uppercase' || /^[^a-z]*$/.test(el.textContent.trim());
    if ((fs < 9 || (fs < 10 && !caps)) && !el.closest('svg')) out.smallText.push(`${name(el)} ${fs}px "${el.textContent.trim().slice(0, 30)}"`);
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible' && !['auto', 'scroll'].includes(getComputedStyle(el).overflowX))
      out.clipped.push(`${name(el)} "${el.textContent.trim().slice(0, 30)}"`);
  }
  // SVG text under 9px rendered size.
  for (const t of document.querySelectorAll('svg text')) { if (!visible(t)) continue; const h = t.getBoundingClientRect().height;
    if (h && h < 8) out.smallText.push(`svg text ${h.toFixed(1)}px "${t.textContent.trim().slice(0, 30)}"`); }

  // 4. HUD parts that cover each other, and HUD parts that leave the window.
  out.hudOverlap = []; out.hudOff = [];
  const tops = hud.filter((h) => !hud.some((o) => o !== h && o.el.contains(h.el)));
  for (let i = 0; i < tops.length; i++) { const a = tops[i].r;
    if (a.left < -1 || a.top < -1 || a.right > W + 1 || a.bottom > H + 1) out.hudOff.push(name(tops[i].el));
    for (let k = i + 1; k < tops.length; k++) { const b = tops[k].r;
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (x > 4 && y > 4) out.hudOverlap.push(`${name(tops[i].el)} and ${name(tops[k].el)} (${Math.round(x)}x${Math.round(y)})`); } }

  // 5. Buttons without a name, and the controls on the page.
  const buttons = [...document.querySelectorAll('button, [role=button], [role=switch]')].filter(visible);
  out.unnamed = buttons.filter((b) => !(b.textContent.trim() || b.getAttribute('aria-label') || b.title)).map(name);
  out.controls = buttons.length;
  out.labels = [...document.querySelectorAll('.pc-lbl, .pc-hub')].filter(visible).length;
  out.ok = ['hiddenEnds', 'pageOverflow', 'smallText', 'clipped', 'hudOverlap', 'hudOff', 'unnamed'].every((k) => !out[k].length);
  return out;
}
