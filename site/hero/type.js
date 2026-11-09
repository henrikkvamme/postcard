// Type: the type leads, and the globe is calm. The hero sets ANYWHERE over ANYWHERE in the red condensed serif,
// printed over a large globe that turns very slowly. As each part of the world comes round, one real route draws
// softly, holds and fades; at most two are lit at once. Below, two still stages: four example trips around the
// world (pick one; point at its route and the kit's 3D vehicle and card ride it), then the trip's bill. The camera
// moves from the globe to the trip as you scroll, and once more for each pick. The finale goes back to the turning
// globe. One chart, one requestAnimationFrame loop.
import { SITE, REDUCED, phone, esc, world, headline, copyButton } from '/hero/common.js';
import { createChart } from '/kit/chart.js';
import { createPeek } from '/hero/peek.js';
import { libs } from '/hero/libs.js';
import { pager } from '/hero/pager.js';
import { fmtDur } from '/kit/time.js';
import { bill, fare } from '/kit/bill.js';
import { MODES, along, geo } from '/kit/trip.js';

const REDA = [184, 50, 42], INKA = [29, 42, 74], LANDA = [248, 246, 239];
const rad = Math.PI / 180;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const soft = (t) => t * t * (3 - 2 * t);
const span = (a, b, x) => clamp01((x - a) / (b - a));
const wrap = (d) => ((d % 360) + 540) % 360 - 180;

// The globe turns east at TURN degrees a second. A route lives DRAW + HOLD + FADE ms; a new one may start
// every GAP ms when one is coming round, so no more than two are ever lit.
const TURN = 1.6, DRAW = 4000, HOLD = 3000, FADE = 3000, GAP = 6000, LAT = 28;
const LIFE = DRAW + HOLD + FADE;

const svg = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true">${d}</svg>`;
const ICON = {
  train: svg('<path d="M5 2.5h6a2 2 0 0 1 2 2V10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2zM3 7.5h10M5.5 14.5l1-2.5M10.5 14.5l-1-2.5"/>'),
  bus: svg('<rect x="2.5" y="2.5" width="11" height="9.5" rx="1.8"/><path d="M2.5 7.5h11M4.8 12v2M11.2 12v2"/>'),
  ferry: svg('<path d="M1.8 9.8h12.4l-2.1 3.7H3.9zM4.6 9.8V6.8h6.8v3M7 6.8V4.3h2.2v2.5"/>'),
  plane: svg('<path d="M14 8.6 9 6.6V3a1 1 0 0 0-2 0v3.6L2 8.6v1.5l5-1.2v2.8l-1.6 1.2v1.1L8 13.3l2.6.7v-1.1L9 11.7V8.9l5 1.2z"/>'),
};

// A big line. Strings are lines of capitals; { s } is a script word on a line of its own.
const bigType = (parts, cls = '') => `<h2 class="ty-t ${cls}" aria-label="${esc(parts.map((x) => typeof x === 'object' ? x.s : x).join(' '))}">${parts
  .map((x) => typeof x === 'object' ? `<em class="ty-sc">${esc(x.s)}</em>` : `<span class="ty-ln">${esc(x)}</span>`).join('')}</h2>`;

export async function mount(el) {
  el.classList.add('ty');
  el.innerHTML = `
    <div class="ty-map pc-map" id="ty-map" aria-hidden="true"></div>
    <section class="ty-hero" id="ty-hero"><div class="ty-hero-in">
      <div class="ty-hero-type">${headline('Anywhere', 'to', 'anywhere')}</div>
      <div class="ty-hero-foot"><p class="ty-cap" id="ty-cap"><span class="ty-cap-ic"></span><span class="ty-cap-t"></span></p></div>
    <button class="ty-down" id="ty-down" type="button" aria-label="Scroll to the trips"><span>Scroll</span><i></i></button>
    </div></section>
    <section class="ty-s" id="ty-s1" data-s="trip"><div class="ty-pin">
      ${bigType(['See it', { s: 'before' }, 'you go.'])}
      <div class="ty-ui ty-trip">
        <div class="ty-tabs" id="ty-tabs" role="tablist" aria-label="Example trips"></div>
        <div class="ty-itin" id="ty-itin"></div>
      </div>
    </div></section>
    <section class="ty-s" id="ty-s2" data-s="book"><div class="ty-pin">
      ${bigType(['Booked.', { s: 'You only pay.' }])}
      <div class="ty-ui ty-bill" id="ty-bill"></div>
    </div></section>
    <section class="ty-fin" id="ty-fin">
      <div class="ty-fin-type">${headline('Ask', 'your', 'agent.', 'h2')}</div>
    </section>`;
  const $ = (id) => document.getElementById(id);
  const heroEl = $('ty-hero'), finEl = $('ty-fin'), mapEl = $('ty-map');
  heroEl.querySelector('.ty-hero-foot').append(copyButton());
  finEl.append(copyButton());
  for (const h of el.querySelectorAll('.hl')) h.classList.add('ty-hl');
  // Size the headlines before the first paint, so they do not grow when the chart starts.
  fitType();

  // The chart waits for the map libraries and the routes. They start after the hero has painted (rAF, then a
  // task), so a cached script cannot run before that paint; the timeout keeps a hidden tab going.
  await new Promise((ok) => { requestAnimationFrame(() => setTimeout(ok, 0)); setTimeout(ok, 200); });
  const [W] = await Promise.all([world(), libs()]);
  const CAP = W.raw.context?.captions || {};
  // Keep each path's longitudes continuous across the date line, for the hero's own arcs below.
  for (const j of W.journeys) for (const sg of j.segments) for (let i = 1; i < sg.path.length; i++) {
    const d = sg.path[i][0] - sg.path[i - 1][0]; if (Math.abs(d) > 180) sg.path[i] = [sg.path[i][0] - 360 * Math.sign(d), sg.path[i][1]]; }
  // One chart for the world trip. A hover on the trip stage's route tells the page, so the scroll ride steps aside.
  let hov = false;
  const chart = createChart({ el: mapEl, trip: W, pad: { left: 40, right: 40, top: 40, bottom: 40 }, far: 1, intro: false,
    onRouteHover: (h) => { hov = !!h; }, onReady: () => ready() });
  const map = chart.map;
  for (const h of ['dragPan', 'scrollZoom', 'boxZoom', 'dragRotate', 'keyboard', 'doubleClickZoom', 'touchZoomRotate', 'touchPitch']) map[h]?.disable();
  chart.where(null); chart.landmark(null);

  // ---------- Geometry ----------
  const air = (seg) => !!MODES[seg.mode]?.air;
  // A flight's arc as the kit draws it: it bows a little left of its way and rises with its length.
  const peak = (seg) => Math.min(220000, 30000 + geo.ang(seg.path[0], seg.path[seg.path.length - 1]) * 6371000 * .1);
  const arcOf = (seg) => { const p = seg.path, n = p.length - 1, a = p[0], b = p[n], c = Math.cos((a[1] + b[1]) / 2 * rad) || 1;
    const dx = (b[0] - a[0]) * c, dy = b[1] - a[1], Ln = Math.hypot(dx, dy) || 1, k = .07 * Ln, h = peak(seg);
    return p.map((q, i) => { const t = Math.sin(Math.PI * i / n); return [q[0] - dy / Ln * k * t / c, q[1] + dx / Ln * k * t, t * h]; }); };
  const cutArc = (pts, s) => { const f = s * (pts.length - 1), i = Math.floor(f), t = f - i, out = pts.slice(0, i + 1);
    if (i < pts.length - 1 && t > 0) out.push(pts[i].map((v, k) => v + (pts[i + 1][k] - v) * t)); return out; };
  const kmOf = (path) => { let k = 0; for (let i = 1; i < path.length; i++) k += geo.km(path[i - 1], path[i]); return k; };
  const cutPath = (path, s) => { const want = s * kmOf(path); let d = 0; const out = [path[0]];
    for (let i = 1; i < path.length; i++) { const k = geo.km(path[i - 1], path[i]); if (d + k >= want) break; d += k; out.push(path[i]); }
    out.push(along(path, s).pt); return out; };
  const ptsOf = (js) => js.flatMap((j) => j.segments.flatMap((s) => air(s) ? arcOf(s).map((q) => [q[0], q[1]]) : s.path));
  const midOf = (pts) => { let x = 0, y = 0, z = 0;
    for (const [lo, la] of pts) { const a = lo * rad, b = la * rad; x += Math.cos(b) * Math.cos(a); y += Math.cos(b) * Math.sin(a); z += Math.sin(b); }
    return [Math.atan2(y, x) / rad, Math.atan2(z, Math.hypot(x, y)) / rad]; };

  // ---------- Camera ----------
  const camNow = () => ({ center: map.getCenter().toArray(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), padding: map.getPadding() });
  // The view that fits points inside the padding, measured on the globe (two quick jumps, no frame drawn).
  function fitView(pts, pad, { pitch = 0, bearing = 0, maxZoom = 7 } = {}) {
    const c = midOf(pts), save = camNow(), w = mapEl.clientWidth, h = mapEl.clientHeight;
    const cx = pad.left + (w - pad.left - pad.right) / 2, cy = pad.top + (h - pad.top - pad.bottom) / 2;
    const hw = Math.max(30, (w - pad.left - pad.right) / 2 * .9), hh = Math.max(30, (h - pad.top - pad.bottom) / 2 * .9);
    let z = 3;
    for (let n = 0; n < 2; n++) {
      map.jumpTo({ center: c, zoom: z, pitch: 0, bearing, padding: pad });
      let need = 1e-6; for (const p of pts) { const q = map.project(p); need = Math.max(need, Math.abs(q.x - cx) / hw, Math.abs(q.y - cy) / hh); }
      z = Math.max(1, Math.min(maxZoom, z - Math.log2(need)));
    }
    map.jumpTo(save);
    return { center: c, zoom: z - pitch / 90 * .3, pitch, bearing, padding: { ...pad } };
  }
  // Between two views along the great circle; the zoom dips a little when they lie far apart.
  function lerpCam(a, b, t) {
    const d = d3.geoDistance(a.center, b.center), gi = d3.geoInterpolate(a.center, b.center);
    const dip = Math.min(.8, d) * Math.sin(Math.PI * t) * .6;
    const P = {}; for (const k of ['left', 'right', 'top', 'bottom']) P[k] = lerp(a.padding[k], b.padding[k], t);
    return { center: d ? gi(t) : a.center, zoom: lerp(a.zoom, b.zoom, t) - dip, pitch: lerp(a.pitch, b.pitch, t),
      bearing: a.bearing + wrap(b.bearing - a.bearing) * t, padding: P };
  }
  let lastCam = null;
  function setCam(v) {
    const k = [v.center[0].toFixed(4), v.center[1].toFixed(4), v.zoom.toFixed(4), v.pitch.toFixed(2), v.bearing.toFixed(2),
      Math.round(v.padding.left), Math.round(v.padding.top), Math.round(v.padding.right), Math.round(v.padding.bottom)].join();
    if (k === lastCam) return; lastCam = k; map.jumpTo(v);
  }

  // ---------- The turning globe and its routes ----------
  // context.hero lists the globe's routes (the Bernina line is too short to see on the whole globe).
  const HERO = new Set(W.raw.context?.hero || W.journeys.map((j) => j.id));
  const HJ = W.journeys.filter((j) => HERO.has(j.id)).map((j) => ({ j, mid: midOf(ptsOf([j])) }));
  let lon0 = REDUCED ? 20 : -30, spin = 0, lastNow = null;           // spin: degrees turned while the globe shows
  const lit = [];                                                    // { j, t0 }: routes drawing, holding or fading
  const done = new Map();                                            // route id -> turn when it last showed
  let nextAt = 0;
  const globeView = () => ({ center: [wrap(lon0 + spin), LAT], zoom: V.gz, pitch: 0, bearing: 0, padding: { left: 0, right: 0, top: 0, bottom: 0 } });
  // The next route coming round: its middle a little east of the centre, in view, not shown in this turn.
  function pickRoute(c) {
    let best = null;
    for (const h of HJ) {
      const d = wrap(h.mid[0] - c), seen = done.get(h.j.id);
      if (d < -6 || d > 42 || Math.abs(h.mid[1] - LAT) > 52 || lit.some((x) => x.j === h.j)) continue;
      if (seen != null && spin - seen < 300) continue;
      if (!best || d < best.d) best = { h, d };
    }
    return best?.h.j || null;
  }
  function tickGlobe(now) {
    if (REDUCED) return;
    const dt = lastNow == null ? 0 : Math.min(100, now - lastNow); lastNow = now;
    spin += TURN * dt / 1000;
    for (let i = lit.length - 1; i >= 0; i--) if (now - lit[i].t0 > LIFE) lit.splice(i, 1);
    if (now >= nextAt && lit.length < 2) {
      const j = pickRoute(wrap(lon0 + spin));
      if (j) { lit.push({ j, t0: now }); done.set(j.id, spin); nextAt = now + GAP; } else nextAt = now + 500;
    }
  }
  // The state of a lit route: share drawn and opacity.
  const stateOf = (x, now) => { const u = now - x.t0; return { s: soft(span(0, DRAW, u)), o: 1 - soft(span(DRAW + HOLD, LIFE, u)) }; };

  // The routes draw on the hero's own deck.gl canvas, lifted above the headline, so the red line crosses the letters.
  const top = document.createElement('div'); top.className = 'ty-top'; top.setAttribute('aria-hidden', 'true'); heroEl.after(top);
  let ov = null, runKey = '';
  function overlay() {
    const had = new Set(mapEl.querySelectorAll('.deck-widget-container'));
    ov = new deck.MapboxOverlay({ interleaved: false, layers: [] }); map.addControl(ov);
    const mine = [...mapEl.querySelectorAll('.deck-widget-container')].find((e) => !had.has(e));
    if (mine) top.append(mine);
    const quiet = () => top.querySelectorAll('canvas').forEach((c) => { c.setAttribute('aria-hidden', 'true'); c.tabIndex = -1; }); quiet(); setTimeout(quiet, 500);
  }
  const lift = (path) => path.map((q) => [q[0], q[1], (map.queryTerrainElevation?.(q) || 0) + 30]);
  // routes: [{ j, s, o, ink }]. k (0 to 1) fades them all, for the move away from the globe. An ink route is a
  // preview: navy, not red. A route still drawing carries a light at its tip.
  function paintRoutes(routes, k = 1) {
    const key = routes.map((r) => `${r.j.id}:${r.s.toFixed(3)}:${(r.o * k).toFixed(3)}:${r.ink ? 1 : 0}`).join('|');
    if (key === runKey) return; runKey = key;
    if (!ov) overlay();
    const arcs = [], rails = [], seas = [], tips = [];
    for (const { j, s, o: o0, ink } of routes) { const o = o0 * k; if (o <= .002 || s <= 0) continue;
      const rgb = ink ? INKA : REDA; let end = null;
      for (const seg of j.segments) { if (air(seg)) { const path = cutArc(arcOf(seg), s); arcs.push({ path, o, rgb }); end = path.at(-1); continue; }
        const path = lift(s >= 1 ? seg.path : cutPath(seg.path, s)); (seg.mode === 'ferry' ? seas : rails).push({ path, o, rgb }); end = path.at(-1); }
      if (s < 1 && end) tips.push({ p: end, o }); }
    const ground = [...rails, ...seas], c = (rgb, a) => (d) => [...rgb, a * d.o], own = (a) => (d) => [...d.rgb, a * d.o], ut = { getColor: key, getFillColor: key, getPosition: key };
    const dot = (id, r, rgb, a) => new deck.ScatterplotLayer({ id, data: tips, getPosition: (d) => d.p, getRadius: r, radiusUnits: 'pixels', getFillColor: c(rgb, a),
      stroked: false, billboard: true, parameters: { depthTest: false }, updateTriggers: ut });
    ov.setProps({ layers: [
      new deck.PathLayer({ id: 'ty-shadow', data: arcs, getPath: (d) => d.path.map(([x, y]) => [x, y, 0]), getColor: c(INKA, 40), getWidth: 1.5, widthUnits: 'pixels', updateTriggers: ut }),
      new deck.PathLayer({ id: 'ty-halo', data: arcs, getPath: (d) => d.path, getColor: c(LANDA, 240), getWidth: 9, widthUnits: 'pixels', capRounded: true, jointRounded: true, updateTriggers: ut }),
      new deck.PathLayer({ id: 'ty-ghalo', data: ground, getPath: (d) => d.path, getColor: c(LANDA, 240), getWidth: 11, widthUnits: 'pixels', capRounded: true, jointRounded: true, updateTriggers: ut }),
      new deck.PathLayer({ id: 'ty-sel', data: [...arcs, ...rails], getPath: (d) => d.path, getColor: own(255), getWidth: 3.2, widthUnits: 'pixels', capRounded: true, jointRounded: true, updateTriggers: ut }),
      new deck.PathLayer({ id: 'ty-ties', data: rails, getPath: (d) => d.path, getColor: own(255), getWidth: 9, widthUnits: 'pixels',
        extensions: [new deck.PathStyleExtension({ dash: true })], getDashArray: [.25, 2.2], updateTriggers: ut }),
      new deck.PathLayer({ id: 'ty-sea', data: seas, getPath: (d) => d.path, getColor: own(255), getWidth: 3.4, widthUnits: 'pixels',
        extensions: [new deck.PathStyleExtension({ dash: true })], getDashArray: [4, 2.5], updateTriggers: ut }),
      // The light: a soft warm halo, a red dot and a white core.
      dot('ty-glow', 16, [255, 214, 170], 70), dot('ty-glow2', 8, LANDA, 230), dot('ty-tip', 5, REDA, 255), dot('ty-core', 2, [255, 255, 255], 255),
    ] });
  }

  // The caption names the newest route while it shows, and fades with it.
  const capOf = (j) => `${CAP[j.id] || `${W.places[j.from].label} to ${W.places[j.to].label}`} · ${fmtDur(j.arr - j.dep)}`;
  const iconOf = (j) => j.segments.some(air) ? ICON.plane : j.mode === 'ferry' || j.segments.some((s) => s.mode === 'ferry') ? ICON.ferry
    : d3.greatest(j.segments.filter((s) => s.mode !== 'walk'), (s) => s.b - s.a)?.mode === 'bus' ? ICON.bus : ICON.train;
  const capEl = $('ty-cap');
  // A new name waits until the old one has faded out, so the centred line never changes width while it shows.
  let capHidden = 0;
  function caption(j, on) {
    const now = performance.now(), shown = capEl.classList.contains('on');
    if (j && capEl.dataset.j !== j.id) {
      if (shown) { capEl.classList.remove('on'); capHidden = now; return; }
      if (now - capHidden < 1500) return;
      capEl.dataset.j = j.id; capEl.querySelector('.ty-cap-ic').innerHTML = iconOf(j); capEl.querySelector('.ty-cap-t').textContent = capOf(j);
    }
    const want = !!(j && on);
    if (want !== shown) { capEl.classList.toggle('on', want); if (!want) capHidden = now; }
  }

  // ---------- The stages: five trips around the world; each leg has its ways to choose from ----------
  const secs = ['ty-s1', 'ty-s2'].map((id) => ({ el: $(id), pin: $(id).querySelector('.ty-pin') }));
  // The default snaps one trip per step and plays it by itself; ?ride=scroll lets the scroll drive the ride instead.
  const RIDE = new URLSearchParams(location.search).get('ride') === 'scroll' ? 'scroll' : 'auto';
  const TRIPS = (W.raw.context?.stage || []).map((t) => ({ ...t, night: null,
    legs: t.legs.map((ids) => ({ ways: ids.map((id) => W.byId[id]).filter(Boolean), pick: 0 })).filter((l) => l.ways.length) })).filter((t) => t.legs.length);
  const chosen = (t) => t.legs.map((l) => l.ways[l.pick]);
  const city = (id) => W.places[id]?.city || W.places[id]?.label || id;
  const plusN = (j) => Math.round((Date.parse(j.arrL.date) - Date.parse(j.depL.date)) / 864e5);
  const overnight = (j) => plusN(j) > 0 && j.arr - j.dep > 5;
  const fdate = (l) => `${l.wd} ${l.day} ${l.mon}`;
  const CAR = svg('<path d="M2.5 10.5V8.2l1.4-3.4a1.4 1.4 0 0 1 1.3-.9h5.6a1.4 1.4 0 0 1 1.3.9l1.4 3.4v2.3zM2.5 8.2h11M4.6 10.5v1.6M11.4 10.5v1.6"/>');
  const MOON = svg('<path d="M12.6 10.2A5.4 5.4 0 0 1 5.8 3.4a5.4 5.4 0 1 0 6.8 6.8z"/>');
  const legIcon = (j) => air(j.segments[0]) ? ICON.plane : j.mode === 'ferry' ? ICON.ferry : j.mode === 'bus' ? ICON.bus : j.mode === 'car' ? CAR : ICON.train;
  const kind = (j) => { const k = { plane: 'Flight', ferry: 'Ferry', bus: 'Bus', car: 'Car' }[j.mode] || 'Train';
    return overnight(j) && j.mode !== 'plane' ? 'Night ' + k.toLowerCase() : j.mode === 'ferry' && j.arr - j.dep < 6 ? 'Fast ferry' : k; };
  const priceOf = (j) => W.best(j)?.total ?? 0;
  const money = (x) => `EUR ${Math.round(x)}`;
  const nightsAt = (t, l) => { const c = chosen(t); return W.nights(c[l], c[l + 1]); };
  const NUM = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];

  // The card: the trip's ends, each leg with its ways as tiles, the nights between, and the total.
  const tabs = $('ty-tabs'), itinEl = $('ty-itin');
  tabs.innerHTML = TRIPS.map((t, i) => `<button type="button" role="tab" data-i="${i}" aria-selected="${i ? 'false' : 'true'}"><span>${esc(t.name)}</span></button>`).join('');
  const tabEls = [...tabs.querySelectorAll('button')];
  const tile = (j, l, w, on) => `<button type="button" class="ty-way" role="radio" aria-checked="${on}" data-l="${l}" data-w="${w}">`
    + `<span class="ic">${legIcon(j)}</span><span class="pr">${money(priceOf(j))}</span><span class="k">${esc(kind(j))}</span>`
    + `<span class="d">${fmtDur(j.arr - j.dep)}${overnight(j) ? `<i title="Overnight">${MOON}</i>` : ''}</span></button>`;
  const nightText = (t, l) => { const n = nightsAt(t, l); return `<b>${NUM[n] || n} night${n === 1 ? '' : 's'}</b> in ${esc(t.stops?.[l + 1] || city(chosen(t)[l].to))}`; };
  let totShown = 0, totT = 0;
  function renderTrip(t) {
    const st = t.stops || [];
    itinEl.innerHTML = `<h3 class="ty-ih">${esc(st[0])}<em>to</em>${esc(st.at(-1))}</h3><ol class="ty-legs">${t.legs.map((L, l) =>
      (l ? `<li class="ty-night" data-n="${l - 1}"><span class="ic">${MOON}</span><span class="tx">${nightText(t, l - 1)}</span></li>` : '')
      + `<li class="ty-leg"><div class="ty-lh"><b>${esc(st[l] || '')}<i>→</i>${esc(st[l + 1] || '')}</b><span class="dt">${esc(fdate(L.ways[L.pick].depL))}</span></div>`
      + `<div class="ty-ways" role="radiogroup" aria-label="${esc(`${st[l]} to ${st[l + 1]}`)}" style="--n:${L.ways.length}">${L.ways.map((j, w) => tile(j, l, w, w === L.pick)).join('')}</div></li>`).join('')}</ol>`
      + `<div class="ty-foot"><span class="ty-hint">Point at a way to see it</span><span class="ty-tot"><small>Total</small><b>${money(d3.sum(chosen(t), priceOf))}</b></span></div>`;
    totShown = d3.sum(chosen(t), priceOf);
    peek.warm(t.legs.flatMap((L) => L.ways), overnight);
  }
  // A pick changes only what it must: the tiles' state, the leg's date, the nights and the total.
  function updateTrip(t) {
    t.legs.forEach((L, l) => { itinEl.querySelectorAll(`.ty-way[data-l="${l}"]`).forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.w === L.pick)));
      const dt = itinEl.querySelectorAll('.ty-lh .dt')[l]; if (dt) dt.textContent = fdate(L.ways[L.pick].depL); });
    itinEl.querySelectorAll('.ty-night').forEach((e) => { e.querySelector('.tx').innerHTML = nightText(t, +e.dataset.n); });
    // The total counts to its new figure.
    const to = d3.sum(chosen(t), priceOf), from = totShown, b = itinEl.querySelector('.ty-tot b'), t0 = performance.now(); totShown = to; cancelAnimationFrame(totT);
    const step = (now) => { const k = REDUCED ? 1 : ease(clamp01((now - t0) / 500)); b.textContent = money(from + (to - from) * k); if (k < 1) totT = requestAnimationFrame(step); };
    totT = requestAnimationFrame(step);
  }

  // The bill for the ways on show, one row per ticket (the kit's checkout rows, with their fine print), and the copy button.
  const fareParts = (j, i) => { const o = W.best(j); return o ? fare(W, j, o, {}, { ticket: 'leg' + i }) : fare(W, j, { seller: j.carrierName }, {}, { ticket: 'leg' + i }); };
  const days2 = (x, y) => Math.round((Date.parse(y.date) - Date.parse(x.date)) / 864e5);
  const CHEV = svg('<path d="M6 4l4 4-4 4"/>');
  const billEl = $('ty-bill'), billIn = document.createElement('div'); billEl.append(billIn);
  function setBill(t) {
    const c = chosen(t), B = bill(W, c.flatMap((j, i) => fareParts(j, i))), items = B.items().filter((it) => !it.aside);
    const fig = B.book.figure(), tail = B.book.all?.() || B.book.text().split(' + ').slice(1);
    billIn.innerHTML = `<div class="ty-eb">${esc(t.name)} · ${items.length} tickets</div><ol class="pc-co-list">${items.map((it, i) => { const x = it.trip;
      const price = it.figure == null ? '<span class="pc-co-dash" title="Fare not read">–</span>' : esc(it.figure);
      const fine = [it.fine, ...(it.tail || []).map(esc)].filter(Boolean).join(' · ') || esc(c[i]?.offers?.[0]?.fare || '');
      return `<li><details><summary><span class="pc-co-ic">${legIcon(c[i] || c[0])}</span><span class="pc-co-day">${esc(`${x.dep.wd} ${x.dep.day} ${x.dep.mon}`)}</span>`
        + `<span class="pc-co-tm"><b>${esc(x.dep.hm)}</b> ${esc(x.from)}<i>→</i><b>${esc(x.arr.hm)}${days2(x.dep, x.arr) > 0 ? `<sup>+${days2(x.dep, x.arr)}</sup>` : ''}</b> ${esc(x.to)}</span>`
        + `<span class="pc-co-pr">${price}</span><span class="pc-co-by">${esc(x.by)}</span><span class="pc-co-chev">${CHEV}</span></summary><div class="pc-co-fine">${fine}</div></details></li>`; }).join('')}</ol>`
      + `<div class="pc-co-total"><span>Total</span><b>${esc(fig)}</b>${tail.length ? `<small>${tail.map(esc).join(' · ')}</small>` : ''}</div>`;
  }
  // The prompt for the trip on show: the agent plans one like it, with the ways you picked.
  const tripPrompt = () => { const t = TRIPS[sel], c = chosen(t), st = t.stops || [];
    const legs = c.map((j, l) => `${st[l]} to ${st[l + 1]} by ${kind(j).toLowerCase()}`).join(', then ');
    return `Read ${SITE}/llms.txt and install the postcard skill. Then plan a trip like this one: ${legs}, with ${nightsAt(t, 0)} nights in ${st[1]}. Compare every way to go for each leg, show it on a postcard map, and stop at the payment page when I book.`; };
  const cta = document.createElement('div'); cta.className = 'ty-cta'; cta.append(copyButton({ prompt: tripPrompt })); billEl.append(cta);

  // ---------- Views ----------
  let V = null;
  function measure() {
    const ph = phone(), g = ph ? 14 : 48, w = innerWidth, h = innerHeight;
    // One padding for both stages, so the camera stands still between them: the map keeps clear of every
    // line and part (left of them on a wide screen; between the type above and the part below on a phone).
    const pad = { left: g, right: g, top: g, bottom: g };
    for (const s of secs) for (const e of s.pin.querySelectorAll('.ty-t, .ty-ui')) {
      const r = e.getBoundingClientRect(), pr = s.pin.getBoundingClientRect(), top = r.top - pr.top, bottom = r.bottom - pr.top;
      if (ph) { if (e.classList.contains('ty-t')) pad.top = Math.max(pad.top, bottom + 8); else if (!e.classList.contains('ty-bill')) pad.bottom = Math.max(pad.bottom, h - top + 8); }
      else pad.left = Math.max(pad.left, r.right - pr.left + g);
    }
    const gz = Math.log2(1.25 * Math.max(h, w * .7) * Math.PI / 512);
    // Each trip is framed on all its ways, so a pick never moves the camera.
    const endsOf = (js) => js.flatMap((j) => j.segments.flatMap((sg) => air(sg) ? arcOf(sg).map((q) => [q[0], q[1]]) : [sg.path[0], sg.path[sg.path.length >> 1], sg.path.at(-1)]));
    V = { gz, pad, trips: TRIPS.map((t) => fitView(endsOf(t.legs.flatMap((L) => L.ways)), pad, { pitch: ph ? 16 : 30, bearing: -8, maxZoom: 7 })) };
  }

  // ---------- The play: each trip tells itself ----------
  // Beats: a leg draws (its line runs out with a light at its tip), then the night comes and the landmark of the
  // city rises; then the next leg. A new pick plays only its own leg. The vehicle shows only on a way under the pointer.
  const DRAWT = 1600, NIGHTT = 2200;
  let play = null, preview = null;
  function beatsFor(t, only = null) {
    const out = []; let a = 0;
    (only == null ? t.legs.map((_, l) => l) : [only]).forEach((l, n) => {
      if (n) out.push({ k: 'night', l: l - 1, a, b: a += NIGHTT });
      out.push({ k: 'draw', l, a, b: a += DRAWT }); });
    return { beats: out, total: a, only };
  }
  function playState(now, u, here) {
    const t = TRIPS[sel], n = t.legs.length;
    if (REDUCED) return { drawn: t.legs.map(() => 1), nightOn: -1, night: n > 1 ? 0 : -1, p: 1 };
    if (!play && here && !tw) play = { t0: now, ...beatsFor(t) };
    if (!play) return { drawn: t.legs.map(() => 0), nightOn: -1, night: t.night ?? -1, p: 0 };
    const T = Math.min(play.total, play.only == null && RIDE === 'scroll' ? span(.06, .94, u) * play.total : now - play.t0);
    const drawn = t.legs.map((_, l) => play.only != null && play.only !== l ? 1 : 0);
    let nightOn = -1;
    for (const b of play.beats) { const x = clamp01((T - b.a) / (b.b - b.a));
      if (b.k === 'draw') drawn[b.l] = soft(x);
      else if (b.k === 'night' && x > 0) { t.night = b.l; if (x < 1) nightOn = b.l; } }
    return { drawn, nightOn, night: t.night ?? -1, p: play.only == null ? T / play.total : 1 };
  }

  // The trip on show. A new trip moves the camera once, like a flight: out until both places fit, across, and in.
  let sel = 0, tw = null;
  function flyCam(a, b, t) {
    const d = d3.geoDistance(a.center, b.center) / rad, gi = d3.geoInterpolate(a.center, b.center), u = ease(t);
    const zm = Math.min(a.zoom, b.zoom, Math.log2(innerWidth * 360 / (512 * Math.max(1, d) * 1.6)));
    const zl = lerp(a.zoom, b.zoom, u), dip = Math.max(0, lerp(a.zoom, b.zoom, .5) - zm) * Math.sin(Math.PI * u);
    return { ...lerpCam(a, b, u), center: d ? gi(u) : a.center, zoom: zl - dip };
  }
  const tripCam = (now) => {
    if (!tw) return V.trips[sel];
    const t = clamp01((now - tw.t0) / tw.ms); if (t >= 1) { tw = null; return V.trips[sel]; }
    return flyCam(tw.from, V.trips[sel], t);
  };
  function pick(i) {
    if (i === sel || !TRIPS[i]) return;
    const now = performance.now(), from = tw ? tripCam(now) : V.trips[sel];
    tabEls[sel].style.setProperty('--p', 0);
    sel = i; play = null; preview = null; peek.hide(true); tabEls.forEach((b, n) => b.setAttribute('aria-selected', String(n === i)));
    const d = d3.geoDistance(from.center, V.trips[i].center) / rad;
    tw = REDUCED ? null : { from, t0: now, ms: d > 20 ? 3000 : 1600 };
    itinEl.classList.add('out'); clearTimeout(itinEl.t);
    itinEl.t = setTimeout(() => { renderTrip(TRIPS[sel]); itinEl.classList.remove('out'); }, REDUCED ? 0 : 260);
    setBill(TRIPS[sel]); scene = '';
  }
  // A way: the leg takes it, and its line draws again.
  function choose(l, w) {
    const t = TRIPS[sel], L = t.legs[l]; if (!L || L.pick === w) return;
    L.pick = w; preview = null; play = { t0: performance.now(), ...beatsFor(t, l) };
    updateTrip(t); setBill(t); scene = '';
  }
  itinEl.addEventListener('click', (e) => { const b = e.target.closest('.ty-way'); if (b) choose(+b.dataset.l, +b.dataset.w); });
  // A way under the mouse (or the keyboard's focus): its route shows on the map in ink, and a card above the
  // tile shows its vehicle in 3D with the carrier, the times and the fare.
  const peek = createPeek();
  const wayOf = (b) => TRIPS[sel].legs[+b.dataset.l]?.ways[+b.dataset.w];
  const peekInfo = (j) => { const rs = j.segments.filter((sg) => sg.mode !== 'walk'), sg = rs.reduce((a, b) => (b.b - b.a > a.b - a.a ? b : a));
    const who = W.carriers?.[sg.carrier] || sg.carrier || '', no = sg.number || '', n = plusN(j), ch = rs.length - 1;
    const title = !no ? who : no.startsWith(who.split(' ')[0]) ? no : `${who} ${no}`;
    return { key: j.id, kind: kind(j), night: overnight(j), title: esc(title),
      lines: [`${esc(j.depL.hm)} → ${esc(j.arrL.hm)}${n > 0 ? `<sup>+${n}</sup>` : ''} · ${fmtDur(j.arr - j.dep)}`,
        [ch ? `${ch} change${ch === 1 ? '' : 's'}` : 'Direct', j.offers?.[0]?.fare, money(priceOf(j))].filter(Boolean).map(esc).join(' · ')] }; };
  const peekAt = (b, kb = false) => { const j = b && wayOf(b); preview = j || null; if (j) peek.show(b, j, peekInfo(j), kb); else peek.hide(); };
  itinEl.addEventListener('pointerover', (e) => peekAt(e.target.closest('.ty-way')));
  itinEl.addEventListener('pointerleave', () => peekAt(null));
  itinEl.addEventListener('focusin', (e) => { const b = e.target.closest('.ty-way'); if (b?.matches(':focus-visible')) peekAt(b, true); });
  itinEl.addEventListener('focusout', () => peekAt(null));
  itinEl.addEventListener('keydown', (e) => { const b = e.target.closest('.ty-way'), k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!b || !k) return;
    e.preventDefault(); const l = +b.dataset.l, n = TRIPS[sel].legs[l].ways.length, w = (+b.dataset.w + k + n) % n; choose(l, w); itinEl.querySelector(`.ty-way[data-l="${l}"][data-w="${w}"]`)?.focus(); });
  // A tab jumps to its trip's step, so the scroll and the pick agree.
  const stepY = (i) => tops[0].top + (i + .5) / TRIPS.length * (tops[0].h - innerHeight);
  const goTrip = (i) => { pick(i); window.scrollTo({ top: stepY(i), behavior: 'instant' }); };
  tabs.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) goTrip(+b.dataset.i); });
  tabs.addEventListener('keydown', (e) => { const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!k) return; e.preventDefault();
    const i = (sel + k + TRIPS.length) % TRIPS.length; goTrip(i); tabEls[i].focus(); });
  let pg = null;
  $('ty-down').addEventListener('click', () => pg ? pg.to(stepY(0)) : window.scrollTo({ top: stepY(0), behavior: REDUCED ? 'instant' : 'smooth' }));
  renderTrip(TRIPS[0]); setBill(TRIPS[0]);
  // One step of scroll for each trip; with the default ride each step is a snap point, in its middle.
  $('ty-s1').style.height = `calc(100svh + ${TRIPS.length * (RIDE === 'auto' ? 100 : 130)}svh)`;
  if (RIDE === 'auto') {
    $('ty-s1').insertAdjacentHTML('afterbegin', TRIPS.map((_, i) => `<i class="ty-snap-at" style="top:${(i + .5) * 100}svh"></i>`).join(''));
    $('ty-s2').insertAdjacentHTML('afterbegin', '<i class="ty-snap-at" style="top:50svh"></i>');
    for (const id of ['ty-hero', 'ty-fin']) $(id).insertAdjacentHTML('afterbegin', '<i class="ty-snap-at" style="top:0"></i>');
    pg = pager({ reduced: REDUCED });
  }

  // ---------- The loop ----------
  let ok = false, tops = [];
  const layout = () => { tops = secs.map((s) => ({ top: s.el.offsetTop, h: s.el.offsetHeight })); };
  function ready() { measure(); layout(); ok = true; mapEl.classList.add('on'); requestAnimationFrame(frame); }
  const setP = (elx, name, v) => { const s = v.toFixed(3); if (elx.dataset[name] !== s) { elx.dataset[name] = s; elx.style.setProperty('--' + name, s); } };
  let scene = '';
  const setScene = (k, fn) => { if (k === scene) return; scene = k; fn(); };
  let whereKey = '';
  const where = (w, key) => { if (hov) return; if (key === whereKey && !w?.moving) return; whereKey = key; chart.where(w); };
  let lmKey = '';
  const landmark = (place) => { const k = String(place); if (k === lmKey) return; lmKey = k; chart.landmark(place); };
  const MODELS = W.raw.map?.models || [];
  const modelAt = (id) => MODELS.find((m) => city(m.place) === city(id))?.place ?? null;
  let lastW = innerWidth, lastH = innerHeight, nightKey = '';

  function frame(now) {
    requestAnimationFrame(frame);
    if (innerWidth !== lastW || innerHeight !== lastH) { lastW = innerWidth; lastH = innerHeight; fitType(); measure(); layout(); }
    const y = scrollY, H = innerHeight, fin = finEl.offsetTop, s0 = tops[0].top, last = tops.at(-1), endS = last.top + last.h - H;
    // g: how much the globe shows (1 on the hero and the finale, 0 on the trips), from the scroll alone. The move
    // ends before the first trip's step, and starts again in the middle of the bill's stage.
    const inEnd = s0 + H * .35, outStart = endS - (last.h - H) * .5;
    const g = y <= inEnd ? 1 - span(0, inEnd, y) : y >= outStart ? span(outStart, fin, y) : 0;
    const gs = REDUCED ? (g > .5 ? 1 : 0) : soft(g);
    if (g >= 1) tickGlobe(now); else lastNow = null;
    const tc = tripCam(now);
    setCam(gs >= 1 ? globeView() : gs <= 0 ? tc : lerpCam(tc, globeView(), gs));
    const onGlobe = g > .5;
    mapEl.dataset.scene = onGlobe ? 'globe' : 'trip';
    // The routes' canvas sits over the hero's type, and under the cards on the trips.
    top.classList.toggle('low', !onGlobe);

    const heroR = REDUCED ? [{ j: W.byId['london-singapore'], s: 1, o: 1 }, { j: W.byId['piraeus-santorini'], s: 1, o: 1 }].filter((r) => r.j)
      : lit.map((x) => ({ j: x.j, ...stateOf(x, now) }));
    const newest = REDUCED ? heroR[0] : lit.at(-1) && { j: lit.at(-1).j, ...stateOf(lit.at(-1), now) };
    caption(newest?.j, g >= 1 && !!newest && newest.s > .25 && newest.o > .35 && y < H * .5);
    setP(finEl, 'f', span(endS, fin, y));
    setP(heroEl, 'h', REDUCED ? 0 : span(0, heroEl.offsetHeight - H, y));
    const sp = tops.map((t) => clamp01((y - t.top) / Math.max(1, t.h - H)));
    secs.forEach((s, i) => { const end = tops[i].top + tops[i].h - H;
      setP(s.el, 'a', sp[i]); setP(s.el, 'e', span(tops[i].top - H * .6, tops[i].top, y)); setP(s.el, 'x', span(end - H * .2, end, y)); });
    // The map takes the pointer on the trips, at rest: hover a chosen route and the kit's vehicle and card ride it.
    const live = !onGlobe && g === 0;
    if (mapEl.classList.contains('live') !== live) { mapEl.classList.toggle('live', live); if (!live) hov = false; }
    if (onGlobe && peek.key) peek.hide(true);
    if (onGlobe) { paintRoutes(heroR, soft(span(.6, 1, g))); setScene('globe', () => chart.show({ chosen: [], others: [], ends: [], refit: false })); where(null, 'none'); landmark(null); return; }

    // Each trip has one step of the first stage. Entering a step picks its trip.
    const n = TRIPS.length, inTrips = y >= s0 - H * .5 && y < tops[1].top, f = Math.min(n - .001, sp[0] * n), slice = Math.floor(f), u = f - slice;
    if (inTrips && slice !== sel) pick(slice);
    const t = TRIPS[sel], c = chosen(t), st = playState(now, u, g === 0 && inTrips && slice === sel);
    tabEls[sel].style.setProperty('--p', st.p.toFixed(3));
    // The kit draws the legs that have drawn, red, with the hover; every other way is a quiet ink line.
    const done = c.filter((_, l) => st.drawn[l] >= 1), ways = t.legs.flatMap((L) => L.ways);
    const seen = new Set(), ends = [c[0].from, ...c.map((j) => j.to)].filter((id) => !seen.has(city(id)) && seen.add(city(id)));
    setScene(`trip:${sel}:${done.map((j) => j.id).join(',')}`, () => chart.show({ chosen: done, others: ways.filter((j) => !done.includes(j)), ends, refit: false, legNumbers: false }));
    // The leg drawing now, and the way under the pointer, on the routes' canvas.
    const draws = c.map((j, l) => st.drawn[l] > 0 && st.drawn[l] < 1 ? { j, s: st.drawn[l], o: 1 } : null).filter(Boolean);
    if (preview && !done.includes(preview)) draws.push({ j: preview, s: 1, o: .9, ink: true });
    paintRoutes(draws, g === 0 ? 1 : 0);
    where(null, 'none');
    // The night: its row lights while it passes, and the city's landmark rises and stays.
    const nk = String(st.nightOn); if (nk !== nightKey) { nightKey = nk; itinEl.querySelectorAll('.ty-night').forEach((e) => e.classList.toggle('on', +e.dataset.n === st.nightOn)); }
    landmark(g === 0 && !tw && st.night >= 0 ? modelAt(c[st.night].to) : null);
  }

  // The hero headline fills the width; its size comes from the type's measured width (ANYWHERE is 5.12 em).
  function fitType() {
    const ph = phone(), g = ph ? 16 : 28;
    const byW = (innerWidth - 2 * g) / 5.12, byH = (innerHeight - (ph ? 330 : 250)) / 1.72;
    heroEl.style.setProperty('--hs', Math.max(44, Math.min(byW, ph ? byW : byH)).toFixed(1) + 'px');
    const fw = (innerWidth - 2 * g) / 3.25, fh = (innerHeight - (ph ? 330 : 360)) / 2.4;
    finEl.style.setProperty('--hs', Math.max(44, Math.min(fw, fh)).toFixed(1) + 'px');
  }
  // Before the chart is ready the map stays hidden, so it never shows the wrong place.
  map.jumpTo({ center: [lon0, LAT], zoom: 1.6 });
}
