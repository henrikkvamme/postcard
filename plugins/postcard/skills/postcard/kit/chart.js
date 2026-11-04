// The chart: an engraved navy sea chart on a MapLibre globe, with terrain, cut-out drawings, place labels,
// a route line drawn the way each mode travels, and a vehicle that rides the chosen route.
// Needs the globals maplibregl, deck, d3 and topojson (index.html loads them).
import { geo, MODES, along } from './trip.js';
import { vehicleIcon } from './vehicles.js';

export const INK = '#1d2a4a', PAPER = '#f4f2ea', LAND = '#f8f6ef', RED = '#b8322a';
const INKA = [29, 42, 74], REDA = [184, 50, 42], LANDA = [248, 246, 239];
const rad = Math.PI / 180;
const KIT = new URL('.', import.meta.url).href;
// ?reduced=1 in the URL acts as prefers-reduced-motion, for checks in a browser that cannot emulate it.
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('reduced') === '1';
if (REDUCED) document.documentElement.classList.add('reduced');

function tile(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); paint(g);
  return { width: w, height: h, data: new Uint8Array(g.getImageData(0, 0, w, h).data.buffer) }; }
const DEM = { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 13 };
const lowZoom = (o) => ['interpolate', ['linear'], ['zoom'], 6.5, o, 7.5, 0];
const EMPTY = { type: 'FeatureCollection', features: [] };

function chartStyle(land, borders) {
  const polys = { type: 'FeatureCollection', features: land.features.filter((f) => f.geometry).flatMap((f) => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((c) => {
    let a = 0; const r = c[0]; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]) * Math.cos(r[i][1] * rad);
    return { type: 'Feature', properties: { area: Math.abs(a / 2) }, geometry: { type: 'Polygon', coordinates: c } }; }) };
  const grat = { type: 'FeatureCollection', features: [
    ...d3.range(36).map((i) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: d3.range(31).map((j) => [-180 + i * 10, -75 + j * 5]) } })),
    ...d3.range(15).map((i) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: d3.range(73).map((j) => [-180 + j * 5, -70 + i * 10]) } })) ] };
  const routeLine = (id, filter, paint, layout = {}) => ({ id, type: 'line', source: 'routes', filter, layout: { 'line-join': 'round', 'line-cap': 'round', ...layout }, paint });
  const chosen = ['==', ['get', 'chosen'], true], other = ['==', ['get', 'chosen'], false], mode = (...m) => ['in', ['get', 'mode'], ['literal', m]];
  const col = ['case', ['get', 'chosen'], RED, INK], op = ['case', ['get', 'chosen'], 1, .38];
  return {
    version: 8, projection: { type: 'globe' }, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sky: { 'sky-color': '#e9e5d8', 'horizon-color': PAPER, 'fog-color': PAPER, 'sky-horizon-blend': .7, 'horizon-fog-blend': .8, 'fog-ground-blend': .7,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 1, .6, 5, .15, 8, 0] },
    sources: {
      ocean: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } } },
      land: { type: 'geojson', data: polys }, borders: { type: 'geojson', data: borders }, grat: { type: 'geojson', data: grat },
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' }, dem: DEM, demShade: { ...DEM },
      routes: { type: 'geojson', data: EMPTY },
    },
    layers: [
      { id: 'paper', type: 'background', paint: { 'background-color': PAPER } },
      { id: 'sea', type: 'fill', source: 'ocean', paint: { 'fill-pattern': 'sea', 'fill-opacity': lowZoom(1) } },
      ...[[3, .55, .02], [6, .4, 1], [9.5, .3, 4], [13, .2, 10]].map(([k, o, minArea], i) => ({ id: 'ring' + i, type: 'line', source: 'land', maxzoom: 7.5,
        filter: ['>', ['get', 'area'], minArea], layout: { 'line-join': 'round' },
        paint: { 'line-color': INK, 'line-width': 1, 'line-gap-width': ['interpolate', ['linear'], ['zoom'], 1, k * .5, 3.5, 2 * k, 6, 2.6 * k],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 1.6, 0, 2.6, o, 6.5, o, 7.5, 0] } })),
      ...[[2, 3, .1], [5, 7, .06]].map(([x, y, o], i) => ({ id: 'lift' + i, type: 'fill', source: 'land',
        paint: { 'fill-color': `rgba(29,42,74,${o})`, 'fill-translate': [x, y], 'fill-translate-anchor': 'viewport', 'fill-antialias': false, 'fill-opacity': lowZoom(1) } })),
      { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': LAND, 'fill-opacity': lowZoom(1) } },
      { id: 'stip', type: 'fill', source: 'land', paint: { 'fill-pattern': 'stip', 'fill-opacity': lowZoom(1) } },
      { id: 't-water', type: 'fill', source: 'omt', 'source-layer': 'water', minzoom: 6.5, paint: { 'fill-pattern': 'sea', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0, 7.5, 1] } },
      { id: 't-shore', type: 'line', source: 'omt', 'source-layer': 'water', minzoom: 6.5, paint: { 'line-color': INK, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, .6, 14, 1.4], 'line-opacity': .8 } },
      { id: 'shade', type: 'hillshade', source: 'demShade', paint: { 'hillshade-method': 'igor', 'hillshade-illumination-direction': 315,
        'hillshade-shadow-color': 'rgba(29,42,74,.55)', 'hillshade-highlight-color': 'rgba(255,255,255,0)', 'hillshade-exaggeration': .5 } },
      { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': INK, 'line-width': 1.1, 'line-opacity': lowZoom(1) } },
      { id: 'borders', type: 'line', source: 'borders', paint: { 'line-color': INK, 'line-width': .7, 'line-opacity': .5, 'line-dasharray': [6, 2, 1.5, 2] } },
      { id: 'grat', type: 'line', source: 'grat', paint: { 'line-color': INK, 'line-width': .5, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, .3, 7, 0] } },
      { id: 't-roads', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 8, filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'rail']]],
        paint: { 'line-color': INK, 'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, .25, 14, .45],
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 8, ['match', ['get', 'class'], ['motorway', 'trunk'], 1, .4], 16, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 6, 2.5]],
          'line-dasharray': ['match', ['get', 'class'], 'rail', ['literal', [3, 2]], ['literal', [1, 0]]] } },
      { id: 't-buildings', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 13,
        paint: { 'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#f6f3ea', 45, '#e9e4d6'],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, ['coalesce', ['get', 'render_height'], 8]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': .96, 'fill-extrusion-vertical-gradient': true } },
      // Ground routes lie on the terrain. Each mode has its own line, as on an old map.
      routeLine('r-halo', chosen, { 'line-color': LAND, 'line-width': 7, 'line-opacity': .92 }),
      // Rail: a thin line with cross ties.
      routeLine('r-rail', mode('train'), { 'line-color': col, 'line-opacity': op, 'line-width': ['case', ['get', 'chosen'], 2.4, 1.1] }),
      routeLine('r-ties', mode('train'), { 'line-color': col, 'line-opacity': op, 'line-width': ['case', ['get', 'chosen'], 7, 5], 'line-dasharray': [.25, 2.2] }, { 'line-cap': 'butt' }),
      // Road: a double line for car and taxi, a single one for bus and coach.
      // The chosen road is always heavier than any quiet route beside it: 3.6 px with a 1 px gap for a car.
      routeLine('r-road', mode('car', 'taxi', 'bus', 'coach', 'mixed'), { 'line-color': col, 'line-opacity': op, 'line-width': ['case', ['get', 'chosen'], ['case', ['in', ['get', 'mode'], ['literal', ['car', 'taxi']]], 3.6, 2.6], 1.1] }),
      routeLine('r-road-gap', ['all', mode('car', 'taxi'), chosen], { 'line-color': LAND, 'line-width': 1 }),
      // Sea: long dashes. Walk: dots.
      routeLine('r-sea', mode('ferry'), { 'line-color': col, 'line-opacity': op, 'line-width': ['case', ['get', 'chosen'], 2.6, 1.1], 'line-dasharray': [4, 2.5] }, { 'line-cap': 'butt' }),
      routeLine('r-walk', mode('walk'), { 'line-color': col, 'line-opacity': op, 'line-width': 2.2, 'line-dasharray': [.1, 2] }),
      // A route the agent could not trace is a faint straight dash, so it never looks like a real line.
      routeLine('r-guess', ['==', ['get', 'guessed'], true], { 'line-color': col, 'line-opacity': .45, 'line-width': 1, 'line-dasharray': [1, 3] }),
      routeLine('r-hit', chosen, { 'line-color': '#000', 'line-opacity': 0, 'line-width': 18 }),
    ],
    terrain: { source: 'dem', exaggeration: 2 },
  };
}

// opts: el, trip (from openTrip), pad {left,right,top,bottom}, far (zoom where the HUD steps aside), view, intro (true),
// onFar(bool), onReady(), onRouteHover({ j, seg, s, T, event } | null).
export function createChart(opts) {
  const T = opts.trip, M = T.raw.map || {};
  const PAD = { left: 60, right: 60, top: 110, bottom: 60, ...opts.pad };
  const FAR = opts.far ?? 2.6;
  const el = typeof opts.el === 'string' ? document.querySelector(opts.el) : opts.el;
  const START = { center: [-28, 34], zoom: 1.1, pitch: 0, bearing: 0 };
  const map = new maplibregl.Map({ container: el, style: { version: 8, sources: {}, layers: [{ id: 'paper', type: 'background', paint: { 'background-color': PAPER } }] },
    ...START, maxPitch: 70, minZoom: 1, attributionControl: { compact: true }, fadeDuration: 0, canvasContextAttributes: { antialias: true } });
  const S = { chosen: [], others: [], where: null, ready: false, countries: [], ends: [] };
  const C = { map, PAD, FAR };

  // Terrain grows flatter as you zoom in.
  let exag = 0;
  const fitTerrain = () => { const z = map.getZoom(), e = Math.round((z <= 6 ? 2 : z >= 11 ? 1 : 2 - (z - 6) / 5) * 10) / 10;
    if (e !== exag && map.getTerrain()) { exag = e; map.setTerrain({ source: 'dem', exaggeration: e }); } };
  map.on('zoom', fitTerrain);

  const addPatterns = () => {
    const sea = tile(8, 4, (g) => { g.fillStyle = PAPER; g.fillRect(0, 0, 8, 4); g.fillStyle = 'rgba(29,42,74,.24)'; g.fillRect(0, 0, 8, 1); });
    const stip = tile(14, 14, (g) => { g.fillStyle = LAND; g.fillRect(0, 0, 14, 14); g.fillStyle = 'rgba(29,42,74,.3)';
      g.beginPath(); g.arc(3, 3, 1.1, 0, 7); g.fill(); g.fillStyle = 'rgba(29,42,74,.2)'; g.beginPath(); g.arc(10, 10, .9, 0, 7); g.fill(); });
    for (const [id, img, pr] of [['sea', sea, 1], ['stip', stip, 2]]) if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: pr });
  };

  // ---- Drawings: engraved cut-outs that stand up when the map tilts. Size is in km on the ground. ----
  const ART = (M.art || []).map((a) => ({ ...a, img: a.img.startsWith('kit/') ? new URL(a.img.slice(4), KIT).href : new URL(a.img, T.base).href }));
  const touched = () => new Set(S.chosen.flatMap((j) => j.stops));
  const artFC = () => { const t = touched();
    return { type: 'FeatureCollection', features: ART.map((a, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: { icon: 'art-' + i, km: a.km, lat: a.lat, op: a.place ? (t.has(a.place) || S.ends.includes(a.place) ? 1 : .45) : .9 } })).sort((p, q) => q.properties.lat - p.properties.lat) }; };
  async function addArt() {
    await Promise.all(ART.map(async (a, i) => { if (map.hasImage('art-' + i)) return;
      try { const img = await map.loadImage(a.img); if (!map.hasImage('art-' + i)) map.addImage('art-' + i, img.data); } catch { console.warn('postcard: no drawing at', a.img); } }));
    if (map.getSource('art')) return;
    map.addSource('art', { type: 'geojson', data: artFC() });
    const k = (z) => ['/', ['*', ['get', 'km'], 1900 * Math.pow(2, z) / 156543 / Math.cos(54 * rad)], 360];
    map.addLayer({ id: 'art', type: 'symbol', source: 'art', layout: { 'icon-image': ['get', 'icon'], 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
      'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport', 'symbol-z-order': 'viewport-y',
      'icon-size': ['interpolate', ['exponential', 2], ['zoom'], 2, k(2), 4, k(4), 6, ['min', 1.4, k(6)], 9, 1.4] },
      paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], 2.2, 0, 3, ['get', 'op'], 8, ['get', 'op'], 9, 0] } }, 'r-halo');
  }

  // ---- Labels: DOM pins in the engraved type. Lower-priority labels hide when they would overlap. ----
  // MapLibre makes every marker a "Map marker" button. Pins are text, not controls: a dot is hidden from
  // screen readers, a label is read as its text.
  const quiet = (e, decorative) => { for (const a of ['role', 'tabindex', 'aria-label']) e.removeAttribute(a); if (decorative) e.setAttribute('aria-hidden', 'true'); };
  const pins = [];
  const pin = (html, cls, lnglat, { anchor = 'center', offset = [0, 0], prio = 0 } = {}) => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html;
    const m = new maplibregl.Marker({ element: e, anchor, offset }).setLngLat(lnglat).addTo(map); quiet(e, !html); const p = { m, e, prio }; pins.push(p); return p; };
  for (const [n, lo, la] of M.labels || []) pin(n, 'pc-lbl', [lo, la], { prio: 1 });
  for (const [n, lo, la] of M.seas || []) pin(n, 'pc-lbl sea', [lo, la], { prio: 2 });
  const placePins = {}, legPins = [];
  function placeMarks() {
    for (const p of Object.values(placePins)) { p.dot.m.remove(); p.lbl.m.remove(); pins.splice(pins.indexOf(p.dot), 1); pins.splice(pins.indexOf(p.lbl), 1); }
    for (const k of Object.keys(placePins)) delete placePins[k];
    const used = new Set([...S.chosen, ...S.others].flatMap((j) => j.stops)), on = touched();
    // A stop next to a labelled place of the same name (Copenhagen H beside Copenhagen) adds no label of its own.
    const named = [];
    const near = (id, text) => named.some((n) => n.text === text && geo.km(n.ll, T.places[id].coord) < 4);
    // The big end labels name the picked option's own places: when the page's end is Amsterdam Centraal
    // and the pick leaves from Schiphol, the label says Schiphol. A stop of another option next to an end
    // (a bus stop beside the station) gets a dot and no label, so it never reads as the chosen end.
    const mine = new Set(S.chosen.flatMap((j) => j.stops)), km = (a, b) => geo.km(T.places[a].coord, T.places[b].coord);
    const ends = S.ends.map((e) => { if (!mine.size || mine.has(e)) return e;
      const c = d3.least([...mine], (m) => km(m, e)); return c && km(c, e) < 80 ? c : e; });
    const byEnd = (id) => !mine.has(id) && ends.some((e) => km(id, e) < 30);
    const ids = [...used].sort((a, b) => (ends.includes(b) - ends.includes(a)) || (on.has(b) - on.has(a)));
    for (const id of ids) { const P = T.places[id], end = ends.includes(id);
      const east = P.coord[0] >= d3.mean(ends.map((e) => T.places[e].coord[0])) ;
      const text = end ? P.name || P.label : P.code || P.label, same = !end && (near(id, text) || near(id, P.label) || byEnd(id) || mine.size > 0 && !mine.has(id) && !on.has(id));
      const dot = pin('', end ? 'pc-dot' : 'pc-hub' + (on.has(id) ? ' on' : ''), P.coord, { prio: end ? 10 : 6 });
      const lbl = end ? pin(text, 'pc-lbl city', P.coord, { anchor: east ? 'left' : 'right', offset: east ? [12, -12] : [-12, -12], prio: 9 })
        : pin(same ? '' : text, 'pc-lbl hub' + (on.has(id) ? ' on' : ''), P.coord, { anchor: 'left', offset: [7, 0], prio: on.has(id) ? 5 : 3 });
      if (!same) named.push({ text, ll: P.coord }, { text: P.label, ll: P.coord });
      placePins[id] = { dot, lbl }; }
    // A trip of three or more legs (a loop) numbers each chosen leg at its middle, so legs that share a
    // corridor still read in order.
    for (const p of legPins.splice(0)) { p.m.remove(); pins.splice(pins.indexOf(p), 1); }
    if (S.legNumbers ?? S.chosen.length >= 3) S.chosen.forEach((j, i) => {
      const sg = d3.greatest(j.segments, (x) => x.km || 0); if (!sg?.path?.length) return;
      legPins.push(pin(String(i + 1), 'pc-leg', sg.path[Math.floor(sg.path.length / 2)], { prio: 8 })); });
    cull();
  }
  // Hide the labels that collide, keeping the higher priority one. Dots of places always stay.
  let cullQueued = false;
  function cull() {
    if (cullQueued) return; cullQueued = true;
    requestAnimationFrame(() => { cullQueued = false;
      // The title and the cards are taken space: a map label under them is hidden. Dots and end labels still show.
      const hud = [...document.querySelectorAll('.pc-title, .pc-card')].map((h) => h.getBoundingClientRect()).filter((r) => r.width);
      const kept = [...hud];
      // A country or sea name that lies on the chosen route hides, so the route reads as one clean line.
      const box = el.getBoundingClientRect(), line = [];
      for (const x of segs(S.chosen)) { const pts = (air(x) ? arc(x.seg) : x.seg.path).map((q) => { const s = map.project([q[0], q[1]]); return [s.x + box.left, s.y + box.top]; });
        pts.forEach((q, i) => { const r = pts[i - 1]; if (r) { const n = Math.ceil(Math.hypot(q[0] - r[0], q[1] - r[1]) / 8); for (let k = 1; k < n; k++) line.push([r[0] + (q[0] - r[0]) * k / n, r[1] + (q[1] - r[1]) * k / n]); } line.push(q); }); }
      const onRoute = (r) => line.some(([x, y]) => x > r.left - 3 && x < r.right + 3 && y > r.top - 3 && y < r.bottom + 3);
      for (const p of [...pins].sort((a, b) => b.prio - a.prio)) {
        if (p.e.classList.contains('pc-dot') || p.e.classList.contains('pc-hub')) continue;
        p.e.style.visibility = ''; let r = p.e.getBoundingClientRect();
        // An end label points away from the route; when that runs off the screen, put it on the other side of its dot.
        if (p.e.classList.contains('city')) { p.e.style.translate = ''; r = p.e.getBoundingClientRect(); const W = el.clientWidth;
          if (r.width && (r.left < 8 || r.right > W - 8)) { p.e.style.translate = `${r.left < 8 ? r.width + 24 : -(r.width + 24)}px 0`; r = p.e.getBoundingClientRect(); } }
        const hit = r.width && (kept.slice(p.prio >= 9 ? hud.length : 0).some((q) => r.left < q.right + 4 && r.right > q.left - 4 && r.top < q.bottom + 2 && r.bottom > q.top - 2)
          || p.prio <= 2 && onRoute(r));
        if (hit) p.e.style.visibility = 'hidden'; else if (r.width) kept.push(r); } });
  }
  map.on('move', cull);
  const zoomClass = () => { const z = map.getZoom(), c = el.classList; c.toggle('z-far', z < FAR - .2); c.toggle('z-mid', z >= FAR - .2 && z < FAR + .7); c.toggle('z-city', z >= 9);
    const far = z < FAR; document.getElementById('stripes')?.classList.toggle('bare', far);
    if (far !== S.far) { S.far = far; document.body.classList.toggle('far', far); opts.onFar?.(far); } };
  map.on('zoom', zoomClass); zoomClass();

  // ---- Routes ----
  const segs = (js) => js.flatMap((j) => j.segments.map((seg, i) => ({ j, seg, i })));
  const air = (x) => MODES[x.seg.mode]?.air;
  // A flight is an arc whose height grows with its length.
  const peak = (seg) => Math.min(220000, 30000 + geo.ang(seg.path[0], seg.path[seg.path.length - 1]) * 6371000 * .1);
  // It also bows a little to the left of its direction, so it reads as an arc from straight above (a phone
  // has little pitch), and an out and a back flight between the same places do not lie on one line.
  const arc = (seg) => { const p = seg.path, n = p.length - 1, a = p[0], b = p[n], c = Math.cos((a[1] + b[1]) / 2 * rad) || 1;
    const dx = (b[0] - a[0]) * c, dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, k = .07 * L, h = peak(seg);
    return p.map((q, i) => { const t = Math.sin(Math.PI * i / n); return [q[0] - dy / L * k * t / c, q[1] + dx / L * k * t, t * h]; }); };
  const routesFC = () => ({ type: 'FeatureCollection', features: [...segs(S.others).map((x) => [x, false]), ...segs(S.chosen).map((x) => [x, true])].filter(([x]) => !air(x))
    .map(([x, chosen]) => ({ type: 'Feature', properties: { mode: x.seg.mode, chosen, guessed: x.seg.guessed, key: x.j.id + ':' + x.i },
      geometry: { type: 'LineString', coordinates: x.seg.path } })) });
  const chosenKeys = () => new Set(segs(S.chosen).map((x) => x.j.id + ':' + x.i));

  // The vehicle shows only while the person points at a time (timeline or route hover). At rest the map
  // shows the route alone, so no vehicle hides a stop.
  // Planes are a 3D model in deck.gl. Ground vehicles are an engraved cut-out in a MapLibre marker,
  // which sits on the terrain. (A deck.gl IconLayer drew nothing in this overlay, deck.gl 9.4.)
  const ground = (() => { const e = document.createElement('img'); e.className = 'pc-vehicle'; e.alt = ''; e.setAttribute('aria-hidden', 'true');
    const m = new maplibregl.Marker({ element: e, anchor: 'bottom', offset: [0, 4] }); quiet(e, true); return { e, m, on: false }; })();
  function vehicle() {
    const w = S.where, mpp = 156543 * Math.cos(map.getCenter().lat * rad) / Math.pow(2, map.getZoom());
    const groundAt = w?.moving && !MODES[w.seg.mode]?.air && map.getZoom() >= FAR;
    if (groundAt) {
      const { pt } = along(w.seg.path, w.s), ahead = along(w.seg.path, Math.min(1, w.s + .01)).pt;
      const a = map.project(pt), b = map.project(ahead), icon = vehicleIcon(w.seg.mode, b.x < a.x - .01);
      if (ground.e.src !== icon.url) ground.e.src = icon.url;
      ground.m.setLngLat(pt); if (!ground.on) { ground.m.addTo(map); quiet(ground.e, true); ground.on = true; }
    } else if (ground.on) { ground.m.remove(); ground.on = false; }
    if (!w) return [];
    if (w.moving && MODES[w.seg.mode]?.air) {
      const pts = arc(w.seg), f = w.s * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), t = f - i;
      const pt = pts[i].map((v, k) => v + (pts[i + 1][k] - v) * t), head = geo.heading(pts[i], pts[i + 1]);
      return [new deck.ScenegraphLayer({ id: 'plane', data: [{ pt, head }], scenegraph: KIT + 'art/airplane.glb', getPosition: (d) => d.pt, sizeScale: mpp * .45, _lighting: 'pbr',
        visible: map.getZoom() >= FAR, getOrientation: (d) => [0, 180 - d.head, 90], getColor: [250, 246, 236, 255] })];
    }
    if (w.moving) return [];
    return [new deck.ScatterplotLayer({ id: 'you', data: [w], getPosition: (d) => [...d.pt, (map.queryTerrainElevation?.(d.pt) || 0) + 30], getRadius: 8, radiusUnits: 'pixels',
      getFillColor: [...REDA, 255], getLineColor: [...LANDA, 255], lineWidthUnits: 'pixels', getLineWidth: 2.5, stroked: true })];
  }

  function deckLayers() {
    const ch = segs(S.chosen).filter(air).map((x) => ({ ...x, path: arc(x.seg) }));
    const keys = chosenKeys();
    // Other flights share their arcs, so one dashed arc per pair of places.
    const seen = new Set(), others = segs(S.others).filter(air).filter((x) => !keys.has(x.j.id + ':' + x.i)).filter((x) => {
      const k = [x.seg.from, x.seg.to].sort().join('-'); if (seen.has(k)) return false; seen.add(k); return true; }).map((x) => arc(x.seg));
    return [
      new deck.PathLayer({ id: 'shadows', data: ch, getPath: (d) => d.path.map(([x, y]) => [x, y, 0]), getColor: [...INKA, 40], getWidth: 1.5, widthUnits: 'pixels' }),
      // Quiet, but visible on the engraved sea: a light halo under a short ink dash.
      new deck.PathLayer({ id: 'others-halo', data: others, getPath: (d) => d, getColor: [...LANDA, 170], getWidth: 3.6, widthUnits: 'pixels', capRounded: true }),
      new deck.PathLayer({ id: 'others', data: others, getPath: (d) => d, getColor: [...INKA, 190], getWidth: 1.5, widthUnits: 'pixels',
        extensions: [new deck.PathStyleExtension({ dash: true })], getDashArray: [3, 3], dashJustified: true }),
      new deck.PathLayer({ id: 'halo', data: ch, getPath: (d) => d.path, getColor: [...LANDA, 235], getWidth: 6, widthUnits: 'pixels', capRounded: true }),
      new deck.PathLayer({ id: 'sel', data: ch, getPath: (d) => d.path, getColor: [...REDA, 255], getWidth: 2.4, widthUnits: 'pixels', capRounded: true }),
      new deck.PathLayer({ id: 'hit', data: ch, getPath: (d) => d.path, getColor: [0, 0, 0, 0], getWidth: 18, widthUnits: 'pixels', pickable: true,
        onHover: (info) => hoverAt(info.object, info.object?.path, info.x, info.y, info.srcEvent, (p) => info.viewport.project(p)) }),
      ...vehicle(),
    ];
  }
  const overlay = new deck.MapboxOverlay({ interleaved: false, layers: [], getCursor: ({ isHovering, isDragging }) => isHovering ? 'crosshair' : isDragging ? 'grabbing' : 'grab' });
  map.addControl(overlay);
  // deck.gl's canvas takes a Tab stop with no name; the map canvas already has one.
  const deckQuiet = () => document.querySelectorAll('#deckgl-overlay, .deckgl-overlay').forEach((c) => { c.removeAttribute('tabindex'); c.setAttribute('aria-hidden', 'true'); c.tabIndex = -1; });
  deckQuiet(); map.once('idle', deckQuiet);
  const refresh = () => overlay.setProps({ layers: deckLayers() });
  map.on('zoom', refresh); map.on('rotate', refresh);

  // Hover on a chosen route: the nearest point gives the time there.
  function hoverAt(x, path, px, py, ev, project) {
    if (!x) { opts.onRouteHover?.(null); return; }
    let best = 0, bd = Infinity;
    path.forEach((p, i) => { const [sx, sy] = project(p); const d = (sx - px) ** 2 + (sy - py) ** 2; if (d < bd) { bd = d; best = i; } });
    // s is a share of the distance, as along() and whereAt() read it. Path points are not evenly spaced.
    let done = 0, total = 0;
    for (let i = 1; i < path.length; i++) { const k = geo.km(path[i - 1], path[i]); total += k; if (i <= best) done += k; }
    const s = total ? done / total : 0;
    opts.onRouteHover?.({ j: x.j, seg: x.seg, s, T: x.seg.a + s * (x.seg.b - x.seg.a), pt: path[best], event: ev });
  }
  map.on('mousemove', 'r-hit', (e) => { const f = e.features[0]; if (!f) return; const x = segs(S.chosen).find((y) => y.j.id + ':' + y.i === f.properties.key); if (!x) return;
    hoverAt(x, x.seg.path, e.point.x, e.point.y, e.originalEvent, (p) => { const q = map.project(p); return [q.x, q.y]; }); });
  map.on('mouseleave', 'r-hit', () => opts.onRouteHover?.(null));
  map.getCanvas().addEventListener('pointerleave', () => opts.onRouteHover?.(null));

  // ---- Camera ----
  // fitBounds fails on the globe in MapLibre 5.24, so frame by hand: centre of the points, zoom from their Mercator extent.
  C.viewOf = (pts, { maxZoom = 7.5 } = {}) => {
    const merc = ([lo, la]) => [(lo + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + la * rad / 2)) / Math.PI) / 2];
    const xs = pts.map((p) => merc(p)[0]), ys = pts.map((p) => merc(p)[1]);
    const small = el.clientWidth < 760, w = Math.max(100, el.clientWidth - PAD.left - PAD.right - (small ? 110 : 80)), h = Math.max(100, small ? el.clientHeight - PAD.top - PAD.bottom - 70 : (el.clientHeight - PAD.top - PAD.bottom - 100) * 1.25);
    const zoom = Math.max(FAR + .1, Math.min(maxZoom, Math.log2(Math.min(w / (Math.max(1e-6, d3.max(xs) - d3.min(xs)) * 512), h / (Math.max(1e-6, d3.max(ys) - d3.min(ys)) * 512)))));
    return { center: [(d3.min(pts, (p) => p[0]) + d3.max(pts, (p) => p[0])) / 2, (d3.min(pts, (p) => p[1]) + d3.max(pts, (p) => p[1])) / 2], zoom,
      // Pitch makes the near (lower) part bigger than the fit assumes; a small screen has no room for that.
      pitch: Math.min(small ? 12 : 70, M.view?.pitch ?? 26), bearing: M.view?.bearing ?? -6 };
  };
  const pointsOf = (js) => js.flatMap((j) => j.segments.flatMap((s) => [s.path[0], s.path[Math.floor(s.path.length / 2)], s.path[s.path.length - 1]]));
  // viewOf() guesses; pitch and terrain make the guess miss. After a move, zoom out until every point of the
  // chosen route is inside the padded area.
  const fitCheck = (pts) => map.once('moveend', () => {
    if (!pts?.length || map.getZoom() < FAR) return;
    const W = el.clientWidth, H = el.clientHeight, cx = PAD.left + (W - PAD.left - PAD.right) / 2, cy = PAD.top + (H - PAD.top - PAD.bottom) / 2;
    const hw = Math.max(40, (W - PAD.left - PAD.right) / 2 - 16), hh = Math.max(40, (H - PAD.top - PAD.bottom) / 2 - 16);
    const need = d3.max(pts, (p) => { const s = map.project(p); return Math.max(Math.abs(s.x - cx) / hw, Math.abs(s.y - cy) / hh); });
    if (need > 1) map.easeTo({ zoom: Math.max(FAR + .1, map.getZoom() - Math.log2(need) - .05), padding: { ...PAD }, duration: REDUCED ? 0 : 300 }); });
  C.frame = (what, { duration = 900 } = {}) => { const pts = Array.isArray(what) && what[0]?.segments ? pointsOf(what) : what; if (!pts?.length) return;
    fitCheck(pts); map.flyTo({ ...C.viewOf(pts), padding: { ...PAD }, duration: REDUCED ? 0 : duration, curve: 1.2, essential: true }); };
  // A view in trip.json is made for a desktop window, and may set only some fields (a pitch, a bearing).
  // A small screen always fits the route.
  const homePts = () => pointsOf(S.chosen.length ? S.chosen : T.journeys);
  C.home = () => ({ ...C.viewOf(homePts()), ...(el.clientWidth >= 760 ? M.view || {} : {}) });
  C.reset = () => { fitCheck(homePts()); map.flyTo({ ...C.home(), padding: { ...PAD }, duration: REDUCED ? 0 : 900 }); };
  C.setPad = (p, { duration = 520, refit = true } = {}) => { Object.assign(PAD, p);
    if (!S.introDone) return;
    const fit = refit && S.chosen.length && map.getZoom() >= FAR; if (fit) fitCheck(pointsOf(S.chosen));
    map.easeTo({ ...(fit ? C.viewOf(pointsOf(S.chosen)) : {}), padding: { ...PAD }, duration: REDUCED ? 0 : duration, easing: (t) => 1 - Math.pow(1 - t, 3) }); };
  map.on('click', () => { if (map.getZoom() < FAR && S.chosen.length) C.frame(S.chosen, { duration: 1800 }); });

  // ---- State from the page ----
  // chosen: the journeys of the picked option, in time order. others: the rest worth seeing. ends: big labelled places.
  let lastKey = null;
  // legNumbers: true or false to force the numbered legs; by default a pick of three or more legs has them.
  C.show = ({ chosen = [], others = [], ends, refit = true, legNumbers } = {}) => {
    S.chosen = chosen; S.others = others.filter((j) => !chosen.includes(j)); if (ends) S.ends = ends; S.legNumbers = legNumbers;
    const key = chosen.map((j) => j.id).join('|');
    if (S.introDone && refit && lastKey && key !== lastKey) C.frame(chosen);
    lastKey = key;
    if (map.getSource('routes')) map.getSource('routes').setData(routesFC());
    map.getSource('art')?.setData(artFC());
    placeMarks(); refresh();
  };
  // The screen box of the chosen route, for tip.beside(..., { avoid: [card, chart.routeBox()] }).
  C.routeBox = () => { const pts = pointsOf(S.chosen); if (!pts.length) return null; const o = el.getBoundingClientRect();
    const xy = pts.map((p) => map.project(p)); const xs = xy.map((q) => q.x + o.left), ys = xy.map((q) => q.y + o.top);
    return { left: d3.min(xs) - 12, right: d3.max(xs) + 12, top: d3.min(ys) - 12, bottom: d3.max(ys) + 12 }; };
  // Put the vehicle where whereAt() says, or back at rest with null.
  C.where = (w) => { S.where = w; refresh(); };
  // 'over France', 'over the North Sea', or 'over the sea'.
  C.over = (ll) => {
    const hit = S.countries.find(({ f, b }) => (b[0][0] > b[1][0] || (ll[0] >= b[0][0] && ll[0] <= b[1][0] && ll[1] >= b[0][1] && ll[1] <= b[1][1])) && d3.geoContains(f, ll));
    if (hit) return 'over ' + hit.f.properties.name;
    const sea = d3.least(M.seas || [], ([, lo, la]) => d3.geoDistance([lo, la], ll));
    return sea && d3.geoDistance([sea[1], sea[2]], ll) < 8 * rad ? 'over the ' + sea[0] : 'over the sea';
  };

  // ---- Load ----
  function intro() {
    if (S.introDone) return; S.introDone = true;
    const done = () => { document.body.classList.remove('intro'); opts.onReady?.(); };
    if (!M.view?.center) fitCheck(homePts());
    if (REDUCED || opts.intro === false) { map.jumpTo({ ...C.home(), padding: { ...PAD } }); done(); return; }
    map.flyTo({ ...C.home(), padding: { ...PAD }, duration: 3400, curve: 1.1, essential: true, easing: (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 });
    setTimeout(done, 1900);
  }
  map.on('style.load', () => { addPatterns(); exag = 0; fitTerrain();
    if (map.getSource('land')) { map.getSource('routes').setData(routesFC()); addArt(); map.once('idle', intro); } });
  setTimeout(intro, 7000); // If the chart never loads, still show the page.
  (async () => {
    try {
      const NE = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/';
      const [land, borders, c] = await Promise.all([fetch(NE + 'ne_50m_land.geojson').then((r) => r.json()), fetch(NE + 'ne_50m_admin_0_boundary_lines_land.geojson').then((r) => r.json()),
        fetch('https://unpkg.com/world-atlas@2.0.2/countries-50m.json').then((r) => r.json())]);
      S.countries = topojson.feature(c, c.objects.countries).features.map((f) => ({ f, b: d3.geoBounds(f) }));
      map.setStyle(chartStyle(land, borders), { diff: false });
    } catch (e) {
      pin('The chart could not load. Check the connection and reload.', 'pc-lbl sea', map.getCenter().toArray(), { prio: 99 });
    }
  })();
  // For probes and checks: what the chart shows now.
  C.state = () => ({ chosen: S.chosen.map((j) => j.id), ends: [...(S.ends || [])], pad: { ...PAD }, far: map.getZoom() < FAR, intro: !S.introDone,
    points: S.chosen.flatMap((j) => j.segments.flatMap((s) => [{ id: s.from, ll: s.path[0] }, { id: s.to, ll: s.path[s.path.length - 1] }])) });
  window.__chart = C;
  return C;
}
