// The chart: an engraved navy sea chart on a MapLibre globe, with terrain, cut-out drawings, place labels,
// a route line drawn the way each mode travels, and a vehicle that rides the chosen route.
// Needs the globals maplibregl, deck, d3 and topojson (index.html loads them).
import { geo, MODES } from './trip.js';
import { vehicleIcon } from './vehicles.js';

export const INK = '#1d2a4a', PAPER = '#f4f2ea', LAND = '#f8f6ef', RED = '#b8322a';
const INKA = [29, 42, 74], REDA = [184, 50, 42], LANDA = [248, 246, 239];
const rad = Math.PI / 180;
const KIT = new URL('.', import.meta.url).href;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  const col = ['case', ['get', 'chosen'], RED, INK], op = ['case', ['get', 'chosen'], 1, .5];
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
      routeLine('r-rail', mode('train'), { 'line-color': col, 'line-opacity': op, 'line-width': ['case', ['get', 'chosen'], 2, 1.2] }),
      routeLine('r-ties', mode('train'), { 'line-color': col, 'line-opacity': op, 'line-width': ['case', ['get', 'chosen'], 7, 5], 'line-dasharray': [.25, 2.2] }, { 'line-cap': 'butt' }),
      // Road: a double line for car and taxi, a single one for bus and coach.
      routeLine('r-road', mode('car', 'taxi', 'bus', 'coach', 'mixed'), { 'line-color': col, 'line-opacity': op, 'line-width': ['case', ['get', 'chosen'], 2.2, 1.3] }),
      routeLine('r-road-gap', ['all', mode('car', 'taxi'), chosen], { 'line-color': LAND, 'line-width': .8 }),
      // Sea: long dashes. Walk: dots.
      routeLine('r-sea', mode('ferry'), { 'line-color': col, 'line-opacity': op, 'line-width': ['case', ['get', 'chosen'], 2.2, 1.3], 'line-dasharray': [4, 2.5] }, { 'line-cap': 'butt' }),
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
  const pins = [];
  const pin = (html, cls, lnglat, { anchor = 'center', offset = [0, 0], prio = 0 } = {}) => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html;
    const m = new maplibregl.Marker({ element: e, anchor, offset }).setLngLat(lnglat).addTo(map); const p = { m, e, prio }; pins.push(p); return p; };
  for (const [n, lo, la] of M.labels || []) pin(n, 'pc-lbl', [lo, la], { prio: 1 });
  for (const [n, lo, la] of M.seas || []) pin(n, 'pc-lbl sea', [lo, la], { prio: 2 });
  const placePins = {};
  function placeMarks() {
    for (const p of Object.values(placePins)) { p.dot.m.remove(); p.lbl.m.remove(); pins.splice(pins.indexOf(p.dot), 1); pins.splice(pins.indexOf(p.lbl), 1); }
    for (const k of Object.keys(placePins)) delete placePins[k];
    const used = new Set([...S.chosen, ...S.others].flatMap((j) => j.stops)), on = touched();
    for (const id of used) { const P = T.places[id], end = S.ends.includes(id);
      const east = P.coord[0] >= d3.mean(S.ends.map((e) => T.places[e].coord[0])) ;
      const dot = pin('', end ? 'pc-dot' : 'pc-hub' + (on.has(id) ? ' on' : ''), P.coord, { prio: end ? 10 : 6 });
      const lbl = end ? pin(P.label, 'pc-lbl city', P.coord, { anchor: east ? 'left' : 'right', offset: east ? [12, -12] : [-12, -12], prio: 9 })
        : pin(P.code || id, 'pc-lbl hub' + (on.has(id) ? ' on' : ''), P.coord, { anchor: 'left', offset: [7, 0], prio: on.has(id) ? 5 : 3 });
      placePins[id] = { dot, lbl }; }
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
      for (const p of [...pins].sort((a, b) => b.prio - a.prio)) {
        if (p.e.classList.contains('pc-dot') || p.e.classList.contains('pc-hub')) continue;
        p.e.style.visibility = ''; let r = p.e.getBoundingClientRect();
        // An end label points away from the route; when that runs off the screen, put it on the other side of its dot.
        if (p.e.classList.contains('city')) { p.e.style.translate = ''; r = p.e.getBoundingClientRect(); const W = el.clientWidth;
          if (r.width && (r.left < 8 || r.right > W - 8)) { p.e.style.translate = `${r.left < 8 ? r.width + 24 : -(r.width + 24)}px 0`; r = p.e.getBoundingClientRect(); } }
        const hit = r.width && kept.slice(p.prio >= 9 ? hud.length : 0).some((q) => r.left < q.right + 4 && r.right > q.left - 4 && r.top < q.bottom + 2 && r.bottom > q.top - 2);
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
  const arc = (seg) => seg.path.map((p, i, a) => [...p, Math.sin(Math.PI * i / (a.length - 1)) * peak(seg)]);
  const routesFC = () => ({ type: 'FeatureCollection', features: [...segs(S.others).map((x) => [x, false]), ...segs(S.chosen).map((x) => [x, true])].filter(([x]) => !air(x))
    .map(([x, chosen]) => ({ type: 'Feature', properties: { mode: x.seg.mode, chosen, guessed: x.seg.guessed, key: x.j.id + ':' + x.i },
      geometry: { type: 'LineString', coordinates: x.seg.path } })) });
  const chosenKeys = () => new Set(segs(S.chosen).map((x) => x.j.id + ':' + x.i));

  function vehicle() {
    const w = S.where, mpp = 156543 * Math.cos(map.getCenter().lat * rad) / Math.pow(2, map.getZoom());
    if (!w) { // At rest the vehicle sits halfway along the longest chosen segment.
      const all = segs(S.chosen); if (!all.length) return [];
      const x = all.reduce((a, b) => (b.seg.km > a.seg.km ? b : a));
      return vehicleAt(x.seg, .5, mpp);
    }
    if (w.moving) return vehicleAt(w.seg, w.s, mpp);
    return [new deck.ScatterplotLayer({ id: 'you', data: [w], getPosition: (d) => [...d.pt, (map.queryTerrainElevation?.(d.pt) || 0) + 30], getRadius: 8, radiusUnits: 'pixels',
      getFillColor: [...REDA, 255], getLineColor: [...LANDA, 255], lineWidthUnits: 'pixels', getLineWidth: 2.5, stroked: true })];
  }
  function vehicleAt(seg, s, mpp) {
    if (MODES[seg.mode]?.air) {
      const pts = arc(seg), f = s * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), t = f - i;
      const pt = pts[i].map((v, k) => v + (pts[i + 1][k] - v) * t), head = geo.heading(pts[i], pts[i + 1]);
      return [new deck.ScenegraphLayer({ id: 'plane', data: [{ pt, head }], scenegraph: KIT + 'art/airplane.glb', getPosition: (d) => d.pt, sizeScale: mpp * .45, _lighting: 'pbr',
        visible: map.getZoom() >= FAR, getOrientation: (d) => [0, 180 - d.head, 90], getColor: [250, 246, 236, 255] })];
    }
    // Ground vehicles are engraved cut-outs that face the way they travel on screen.
    const { pt } = alongPath(seg.path, s), ahead = alongPath(seg.path, Math.min(1, s + .01)).pt;
    const a = map.project(pt), b = map.project(ahead), left = b.x < a.x - .01;
    const icon = vehicleIcon(seg.mode, left);
    return [new deck.IconLayer({ id: 'vehicle', data: [{ pt }], getPosition: (d) => [...d.pt, (map.queryTerrainElevation?.(d.pt) || 0) + 20],
      getIcon: () => icon, getSize: 34, sizeUnits: 'pixels', billboard: true, visible: map.getZoom() >= FAR })];
  }
  const alongPath = (path, s) => { const n = path.length - 1; if (n < 1) return { pt: path[0] };
    let tot = 0; const d = path.slice(1).map((p, i) => { const k = geo.km(path[i], p); tot += k; return k; });
    let want = s * tot; for (let i = 0; i < n; i++) { if (want <= d[i] || i === n - 1) { const f = d[i] ? Math.min(1, want / d[i]) : 0; return { pt: geo.slerp(path[i], path[i + 1], f) }; } want -= d[i]; }
    return { pt: path[n] }; };

  function deckLayers() {
    const ch = segs(S.chosen).filter(air).map((x) => ({ ...x, path: arc(x.seg) }));
    const keys = chosenKeys();
    // Other flights share their arcs, so one dashed arc per pair of places.
    const seen = new Set(), others = segs(S.others).filter(air).filter((x) => !keys.has(x.j.id + ':' + x.i)).filter((x) => {
      const k = [x.seg.from, x.seg.to].sort().join('-'); if (seen.has(k)) return false; seen.add(k); return true; }).map((x) => arc(x.seg));
    return [
      new deck.PathLayer({ id: 'shadows', data: ch, getPath: (d) => d.path.map(([x, y]) => [x, y, 0]), getColor: [...INKA, 40], getWidth: 1.5, widthUnits: 'pixels' }),
      new deck.PathLayer({ id: 'others', data: others, getPath: (d) => d, getColor: [...INKA, 120], getWidth: 1.2, widthUnits: 'pixels',
        extensions: [new deck.PathStyleExtension({ dash: true })], getDashArray: [1, 4], dashJustified: true }),
      new deck.PathLayer({ id: 'halo', data: ch, getPath: (d) => d.path, getColor: [...LANDA, 235], getWidth: 6, widthUnits: 'pixels', capRounded: true }),
      new deck.PathLayer({ id: 'sel', data: ch, getPath: (d) => d.path, getColor: [...REDA, 255], getWidth: 2.4, widthUnits: 'pixels', capRounded: true }),
      new deck.PathLayer({ id: 'hit', data: ch, getPath: (d) => d.path, getColor: [0, 0, 0, 0], getWidth: 18, widthUnits: 'pixels', pickable: true,
        onHover: (info) => hoverAt(info.object, info.object?.path, info.x, info.y, info.srcEvent, (p) => info.viewport.project(p)) }),
      ...vehicle(),
    ];
  }
  const overlay = new deck.MapboxOverlay({ interleaved: false, layers: [], getCursor: ({ isHovering, isDragging }) => isHovering ? 'crosshair' : isDragging ? 'grabbing' : 'grab' });
  map.addControl(overlay);
  const refresh = () => overlay.setProps({ layers: deckLayers() });
  map.on('zoom', refresh); map.on('rotate', refresh);

  // Hover on a chosen route: the nearest point gives the time there.
  function hoverAt(x, path, px, py, ev, project) {
    if (!x) { opts.onRouteHover?.(null); return; }
    let best = 0, bd = Infinity;
    path.forEach((p, i) => { const [sx, sy] = project(p); const d = (sx - px) ** 2 + (sy - py) ** 2; if (d < bd) { bd = d; best = i; } });
    const s = best / (path.length - 1);
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
  C.frame = (what, { duration = 900 } = {}) => { const pts = Array.isArray(what) && what[0]?.segments ? pointsOf(what) : what; if (!pts?.length) return;
    map.flyTo({ ...C.viewOf(pts), padding: { ...PAD }, duration: REDUCED ? 0 : duration, curve: 1.2, essential: true }); };
  // A view fixed in trip.json is made for a desktop window; a small screen fits the route instead.
  C.home = () => (el.clientWidth >= 760 && M.view) || C.viewOf(pointsOf(S.chosen.length ? S.chosen : T.journeys));
  C.reset = () => map.flyTo({ ...C.home(), padding: { ...PAD }, duration: REDUCED ? 0 : 900 });
  C.setPad = (p, { duration = 520, refit = true } = {}) => { Object.assign(PAD, p);
    if (!S.introDone) return;
    map.easeTo({ ...(refit && S.chosen.length && map.getZoom() >= FAR ? C.viewOf(pointsOf(S.chosen)) : {}), padding: { ...PAD }, duration: REDUCED ? 0 : duration, easing: (t) => 1 - Math.pow(1 - t, 3) }); };
  map.on('click', () => { if (map.getZoom() < FAR && S.chosen.length) C.frame(S.chosen, { duration: 1800 }); });

  // ---- State from the page ----
  // chosen: the journeys of the picked option, in time order. others: the rest worth seeing. ends: big labelled places.
  let lastKey = null;
  C.show = ({ chosen = [], others = [], ends, refit = true } = {}) => {
    S.chosen = chosen; S.others = others.filter((j) => !chosen.includes(j)); if (ends) S.ends = ends;
    const key = chosen.map((j) => j.id).join('|');
    if (S.introDone && refit && lastKey && key !== lastKey) C.frame(chosen);
    lastKey = key;
    if (map.getSource('routes')) map.getSource('routes').setData(routesFC());
    map.getSource('art')?.setData(artFC());
    placeMarks(); refresh();
  };
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
