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
    // A line clamped on purpose (one line, an ellipsis, and the whole text in its title) is fine (craft.md, rule 7).
    const clamp = cs.textOverflow === 'ellipsis' && (el.title || el.closest('[title]'));
    if (!clamp && el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'visible' && !['auto', 'scroll'].includes(cs.overflowX))
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

  // 4b. Inside the HUD: a part that hangs out of its card (spill), a part cut off by a box that hides its
  // overflow (cutOff), and a list that scrolls sideways (sideScroll; a timeline in .pc-scroll-x may).
  out.spill = []; out.cutOff = []; out.sideScroll = [];
  const clips = (el) => { const o = getComputedStyle(el); return o.overflowX !== 'visible' || o.overflowY !== 'visible'; };
  for (const { el: root, r: R } of hud.filter((h) => !hud.some((o) => o !== h && o.el.contains(h.el)))) {
    for (const el of root.querySelectorAll('*')) {
      if (!visible(el) || el.closest('svg') && el.tagName !== 'svg') continue;
      const o = getComputedStyle(el);
      if (['auto', 'scroll'].includes(o.overflowX) && el.scrollWidth > el.clientWidth + 2 && !el.closest('.pc-scroll-x'))
        out.sideScroll.push(`${name(el)} scrolls ${el.scrollWidth - el.clientWidth}px sideways`);
      const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!text && !el.matches('button, [role=button], input, select, svg, .pc-book')) continue;
      let a = el.parentElement; while (a && a !== root && !clips(a)) a = a.parentElement;
      const r = el.getBoundingClientRect(), box = a ? a.getBoundingClientRect() : R;
      const out2 = r.bottom > box.bottom + 2 || r.top < box.top - 2 || r.right > box.right + 2 || r.left < box.left - 2;
      if (!out2) continue;
      const lbl = `${name(el)} "${(el.textContent || '').trim().slice(0, 24)}"`;
      if (a && a !== root) { const ao = getComputedStyle(a); if (['hidden', 'clip'].includes(ao.overflowY) || ['hidden', 'clip'].includes(ao.overflowX)) out.cutOff.push(`${lbl} cut by ${name(a)}`); }
      else if (clips(root)) out.cutOff.push(`${lbl} cut by ${name(root)}`);
      else out.spill.push(`${lbl} hangs ${Math.round(Math.max(r.bottom - R.bottom, R.top - r.top, r.right - R.right, R.left - r.left))}px out of ${name(root)}`);
      if (out.spill.length + out.cutOff.length > 12) break;
    }
  }

  // 5. Calm: the text sizes in the HUD, the title included (craft.md: six at most) and the text in red
  // outside the book band (craft.md: red means "this one"; read the list and ask if each is the pick).
  const RED = 'rgb(184, 50, 42)', sizes = new Set(); out.redText = [];
  for (const { el: root } of tops) for (const el of [root, ...root.querySelectorAll('*')]) {
    if (!visible(el) || el.closest('svg, .pc-book, .pc-sheetbg')) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el); sizes.add(Math.round(parseFloat(cs.fontSize) * 2) / 2);
    if (cs.color === RED && out.redText.length < 16) out.redText.push(`${name(el)} "${el.textContent.trim().slice(0, 24)}"`); }
  out.textSizes = [...sizes].sort((a, b) => a - b);
  out.manySizes = sizes.size > 6 ? [`${sizes.size} text sizes in the HUD: ${out.textSizes.join(', ')} px`] : [];

  // 6. Buttons without a name, and the controls on the page.
  const buttons = [...document.querySelectorAll('button, [role=button], [role=switch]')].filter(visible);
  out.unnamed = buttons.filter((b) => !(b.textContent.trim() || b.getAttribute('aria-label') || b.title)).map(name);
  out.controls = buttons.length;
  out.labels = [...document.querySelectorAll('.pc-lbl, .pc-hub')].filter(visible).length;
  out.ok = ['hiddenEnds', 'pageOverflow', 'smallText', 'clipped', 'hudOverlap', 'hudOff', 'spill', 'cutOff', 'sideScroll', 'unnamed', 'manySizes'].every((k) => !out[k].length);
  return out;
}
