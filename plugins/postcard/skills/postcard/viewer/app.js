'use strict';
// ---------- Trip data ----------
// index.html loads trip.json into window.TRIP before this file runs. The schema is in references/trip-schema.md.
// Internally, a time is a number of hours from 00:00 of the first day, in the trip's clock zone.
const TRIP = window.TRIP;
const CLOCK = TRIP.clock;
const CUR = TRIP.currency || 'EUR';
const money = (n) => `${CUR} ${n}`;
const PLACES = TRIP.places;
const AIRPORTS = Object.fromEntries(Object.entries(PLACES).map(([k, p]) => [k, p.coord]));
const CITY = Object.fromEntries(Object.entries(PLACES).map(([k, p]) => [k, p.city || p.name]));
const AIRLINE = TRIP.carriers || {};
const HOMEP = TRIP.home.place, DESTP = TRIP.destination.place;
const HOME_NAME = TRIP.home.name || CITY[HOMEP], DEST_TOWN = TRIP.destination.town || CITY[DESTP];
const EVENT_NAME = TRIP.event?.name || DEST_TOWN;

// Wall time in a zone -> epoch ms. Two passes settle the zone offset, also across a DST change.
const PARTS = {};
const parts = (ms, tz) => { const f = PARTS[tz] ||= new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return Object.fromEntries(f.formatToParts(ms).map((p) => [p.type, p.value])); };
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const offsetMin = (ms, tz) => { const p = parts(ms, tz); return (Date.UTC(+p.year, MON[p.month], +p.day, +p.hour, +p.minute) - Math.floor(ms / 60000) * 60000) / 60000; };
function wallMs(iso, tz) {
  const [d, tm = '00:00'] = iso.split('T'), [y, mo, da] = d.split('-').map(Number), [h, mi] = tm.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi);
  const first = guess - offsetMin(guess, tz) * 60000;
  return guess - offsetMin(first, tz) * 60000;
}
const EPOCH0 = wallMs(TRIP.window.start.slice(0, 10), CLOCK);
const H = (iso, tz = CLOCK) => (wallMs(iso, tz) - EPOCH0) / 3600000;
// Hours -> what a clock in that zone shows: { wd: 'Thu', day: 12, mon: 'Nov', hm: '19:05' }.
const local = (T, tz = CLOCK) => { const p = parts(EPOCH0 + T * 3600000, tz); return { wd: p.weekday, day: +p.day, mon: p.month, hm: `${p.hour}:${p.minute}` }; };
const tzAbbr = (tz) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' }).formatToParts(EPOCH0).find((p) => p.type === 'timeZoneName').value;

// The days on the timeline, from the window start to its end, in the clock zone.
const T0 = H(TRIP.window.start), T1 = H(TRIP.window.end);
const DAYS = [];
for (let i = 0; ; i++) { const ms = EPOCH0 + i * 86400000 + 43200000, p = parts(ms, CLOCK);
  const iso = `${p.year}-${String(MON[p.month] + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`, s = H(iso);
  if (s >= T1) break; DAYS.push({ s, e: H(iso + 'T23:59') + 1 / 60, label: `${p.weekday} ${+p.day}`.toUpperCase() }); }

// A flight. dep and arr are local times at the airports. A stop 'LTN>STN' means: land at Luton, get yourself to Stansted, fly on.
function mkFlight(x) {
  const dir = x.dir === 'out' ? 'out' : 'ret';
  const from = x.from || (dir === 'out' ? HOMEP : DESTP), to = x.to || (dir === 'out' ? DESTP : HOMEP);
  const via = x.via || [], lays = x.layovers_min || [];
  const dep = H(x.dep, PLACES[from].tz), arr = H(x.arr, PLACES[to].tz), dl = local(dep, PLACES[from].tz), al = local(arr, PLACES[to].tz);
  return { get price() { return priceOf(this); }, get offer() { return bestOffer(this); },
    id: x.id, dir, from, to, al: x.carrier, via, lays, hub: via[0]?.split('>')[0] || null, lay: d3.sum(lays), self: !!x.self_transfer,
    nums: x.numbers, warn: x.warning, dep, arr, depD: dl.wd, depT: dl.hm, depN: dl.day, depMon: dl.mon, depDate: x.dep.slice(0, 10), arrD: al.wd, arrT: al.hm };
}
const OUT = TRIP.flights.filter((f) => f.dir === 'out').map(mkFlight);
const RET = TRIP.flights.filter((f) => f.dir !== 'out').map(mkFlight);
const ALL = [...OUT, ...RET];

// Every seller seen for each flight. kind: airline (its own site), agency (an online travel agency), self (a self-transfer ticket).
const mkOffer = (s) => ({ who: s.seller, kind: s.kind, price: s.price, src: s.source, stars: s.stars, n: s.reviews, url: s.url });
const OFFERS = Object.fromEntries(Object.entries(TRIP.offers || {}).map(([k, v]) => [k, v.map(mkOffer)]));
// A deal sells both directions together for less than two one-way tickets.
const DEALS = (TRIP.deals || []).map((d) => ({ o: d.out, r: d.back, price: d.price, who: d.seller, kind: d.kind, what: d.what, src: d.source, stars: d.stars, n: d.reviews }));
// Which sellers you accept. The ranking, the prices and the checkout all follow this choice.
const BUY = {
  airline: { label: 'Airlines', ok: (s) => s.kind === 'airline', help: 'Only the airline\'s own site. Changes, refunds and disruption go straight through the airline.' },
  rated: { label: '+ Good agencies', ok: (s) => s.kind === 'airline' || (s.kind === 'agency' && (s.stars ?? 0) >= 4 && (s.n ?? 0) >= 100),
    help: 'Airlines, plus travel agencies rated 4+ from 100+ reviews. Cheaper, but a change or refund goes through the agency.' },
  any: { label: 'Any seller', ok: () => true, help: 'Every seller, also low-rated agencies and self-transfer tickets. A missed self-transfer connection is your problem.' },
};
const ok = (s) => BUY[state.buy].ok(s);
const bestOffer = (f) => d3.least((OFFERS[f.id] || []).filter(ok), (s) => s.price);
const bestDeal = (o, r) => d3.least(DEALS.filter((d) => d.o === o.id && d.r === r.id && ok(d)), (d) => d.price);
const priceOf = (f) => bestOffer(f)?.price ?? null;

// The reason for the trip, in the clock zone. Without an event, the stay is the whole window.
const EVENT = TRIP.event ? { start: H(TRIP.event.start), end: H(TRIP.event.end) } : { start: T0, end: T1 };
const MOMENTS = (TRIP.event?.moments || []).map((m) => ({ at: H(m.at), name: m.name, w: m.weight ?? 1, label: m.label }));
// Office hours you would rather not lose, in the work zone.
const WK = TRIP.work;
const WORK = (WK?.days || []).map((d) => ({ day: d, s: H(`${d}T${WK.start || '09:00'}`, WK.tz || PLACES[HOMEP].tz), e: H(`${d}T${WK.end || '17:00'}`, WK.tz || PLACES[HOMEP].tz) }));
const TO_VENUE = TRIP.destination.transfer_h ?? 1, BEFORE_DEP = TRIP.buffers?.before_departure_h ?? 2, AFTER_ARR = TRIP.buffers?.after_arrival_h ?? 1;

// ---------- Model ----------
const overlap = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
function evaluate(o, r, remote) {
  const leave = o.dep - BEFORE_DEP, arriveVenue = o.arr + TO_VENUE, leaveVenue = r.dep - BEFORE_DEP, home = r.arr + AFTER_ARR;
  const spans = remote ? [[leave, arriveVenue], [leaveVenue, home]] : [[leave, home]];
  const lostByDay = WORK.map((w) => d3.sum(spans, ([a, b]) => overlap(w.s, w.e, a, b)));
  const moments = MOMENTS.map((m) => m.at >= arriveVenue && m.at <= leaveVenue);
  const split = o.price + r.price, deal = bestDeal(o, r), useDeal = deal && deal.price < split;
  return { o, r, spans, split, deal: useDeal ? deal : null, price: useDeal ? deal.price : split, travel: (o.arr - o.dep) + (r.arr - r.dep), lostByDay, lost: d3.sum(lostByDay),
    moments, missedW: d3.sum(MOMENTS, (m, i) => moments[i] ? 0 : m.w), arriveVenue, leaveVenue };
}
const PRESETS = {
  balanced: { label: 'Balanced', w: { price: 35, time: 20, work: 25, event: 20 } },
  cheap: { label: 'Cheapest', w: { price: 90, time: 5, work: 0, event: 5 } },
  work: { label: 'Work first', w: { price: 15, time: 5, work: 80, event: 0 } },
  event: { label: 'Full event', w: { price: 15, time: 5, work: 5, event: 75 } },
};
const KEY = 'postcard:' + (TRIP.id || TRIP.title) + ':';
const store = { get(k, d) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
                set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch {} } };
const state = { preset: PRESETS[store.get('preset', 'balanced')] ? store.get('preset', 'balanced') : 'balanced', remote: store.get('remote', false), out: store.get('out', null), ret: store.get('ret', null),
  buy: BUY[store.get('buy', 'airline')] ? store.get('buy', 'airline') : 'airline' };
const totalW = d3.sum(MOMENTS, (m) => m.w) || 1;
const buyable = (f) => f.price != null;
function ranked() {
  const combos = OUT.filter(buyable).flatMap((o) => RET.filter(buyable).map((r) => evaluate(o, r, state.remote)));
  const pE = d3.extent(combos, (c) => c.price), tE = d3.extent(combos, (c) => c.travel), lMax = d3.max(combos, (c) => c.lost) || 1;
  const W = PRESETS[state.preset].w, sum = d3.sum(Object.values(W));
  for (const c of combos) c.score = (W.price * (c.price - pE[0]) / (pE[1] - pE[0]) + W.time * (c.travel - tE[0]) / (tE[1] - tE[0])
    + W.work * c.lost / lMax + W.event * c.missedW / totalW) / sum;
  return combos.sort((a, b) => a.score - b.score || a.price - b.price);
}

// ---------- Helpers ----------
const fmtDur = (h) => { const m = Math.round(h * 60); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
const hhmm = (h) => { const l = local(Math.round(h * 60) / 60); return `${l.wd} ${l.hm}`; };
const tip = document.getElementById('tip');
function showTip(e, html) { tip.innerHTML = html; tip.style.opacity = 1;
  tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 10) + 'px'; tip.style.top = Math.max(8, e.clientY - tip.offsetHeight - 10) + 'px'; }
const hideTip = () => { tip.style.opacity = 0; };
const carrier = (f) => AIRLINE[f.al] || f.al;
const flightTip = (f) => `<b>${carrier(f)}</b> · ${f.from} → ${f.to}<br>${f.depD} ${f.depT} → ${f.arrD} ${f.arrT} local<br>` +
  `${fmtDur(f.arr - f.dep)} · ${f.via.length ? `via ${viaText(f)}, ${fmtDur(f.lay / 60)} on the ground` : 'nonstop'}<br>` +
  (f.price == null ? `<span style="opacity:.75">No seller you accept. Choose "${BUY.any.label}" to see it.</span>`
    : `<b>${money(f.price)}</b> from ${f.offer.who}${(OFFERS[f.id] || []).length > 1 ? ` · ${OFFERS[f.id].length} sellers, ${CUR} ${d3.min(OFFERS[f.id], (s) => s.price)}–${d3.max(OFFERS[f.id], (s) => s.price)}` : ''}`) +
  (f.self ? `<br>⚠ Self-transfer: separate tickets${f.via.some((v) => v.includes('>')) ? `, change airports in ${CITY[f.via.find((v) => v.includes('>')).split('>')[0]]}` : ''}` : '') + (f.warn ? `<br>⚠ ${f.warn.text}` : '');
const viaText = (f) => f.via.map((v) => v.includes('>') ? v.replace('>', '→') : v).join(', ');
const hoursHTML = (c) => `<div class="hours">${WORK.map((w, i) => `<div class="day">${d3.range(Math.round(w.e - w.s)).map((h) => `<i class="${h < Math.round(c.lostByDay[i]) ? 'lost' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
const momentsHTML = (c) => `<div class="moments">${MOMENTS.map((m, i) => `<i class="${c.moments[i] ? '' : 'off'}"></i>`).join('')}</div>`;
const ends = (f) => [f.from, f.to];
// Every airport you touch, in order. 'LTN>STN' gives both.
const stops = (f) => [ends(f)[0], ...f.via.flatMap((v) => v.split('>')), ends(f)[1]];
// The flown pairs. A ground transfer (LTN → STN) is not flown.
const flightPairs = (f) => { const [a, b] = ends(f), out = []; let from = a;
  for (const v of f.via) { const n = v.split('>'); out.push([from, n[0]]); from = n[n.length - 1]; } out.push([from, b]); return out; };
const touches = (f, code) => stops(f).includes(code);

// ---------- Map: engraved navy chart in 3D (MapLibre terrain + deck.gl arcs and standing drawings) ----------
const INK = '#1d2a4a', PAPER = '#f4f2ea', LAND = '#f8f6ef', RED = '#b8322a';
const INKA = [29, 42, 74], REDA = [184, 50, 42], LANDA = [248, 246, 239];
const MAPC = TRIP.map || {};
const LABELS = MAPC.labels || [], SEAS = MAPC.seas || [];
// Engraved drawings stand upright on the chart like paper cut-outs. Size is in km, so they grow as you zoom in.
const ART = (MAPC.art || []).map((a) => [a.img, a.lng, a.lat, a.km, a.place]).sort((a, b) => b[2] - a[2]);
const rad = Math.PI / 180;
const vec = ([lo, la]) => [Math.cos(la * rad) * Math.cos(lo * rad), Math.cos(la * rad) * Math.sin(lo * rad), Math.sin(la * rad)];
const ang = (p, q) => { const a = vec(p), b = vec(q); return Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])); };
function slerp(p, q, s) {
  const a = vec(p), b = vec(q), w = ang(p, q); if (w < 1e-9) return p;
  const k1 = Math.sin((1 - s) * w) / Math.sin(w), k2 = Math.sin(s * w) / Math.sin(w), v = [0, 1, 2].map((i) => k1 * a[i] + k2 * b[i]);
  return [Math.atan2(v[1], v[0]) / rad, Math.asin(v[2]) / rad];
}
const heading = (p, q) => { const [l1, f1] = p.map((x) => x * rad), [l2, f2] = q.map((x) => x * rad);
  return Math.atan2(Math.sin(l2 - l1) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(l2 - l1)) / rad; };
// A leg is a 3D arc; the altitude grows with distance so long legs rise higher.
const peak = (a, b) => Math.min(220000, 30000 + ang(AIRPORTS[a], AIRPORTS[b]) * 6371000 * .1);
const arcAt = (a, b, s) => [...slerp(AIRPORTS[a], AIRPORTS[b], s), Math.sin(Math.PI * s) * peak(a, b)];
const arcPath = (a, b, n = 80) => Array.from({ length: n + 1 }, (_, i) => arcAt(a, b, i / n));
const legKey = (p, q) => [p, q].sort().join('-');
const P = (c) => [...AIRPORTS[c], 0];

// Flight legs with times. The time in the air is split between the legs by distance.
function flightLegs(f) {
  const pairs = flightPairs(f), L = pairs.map(([p, q]) => d3.geoDistance(AIRPORTS[p], AIRPORTS[q]));
  const fly = f.arr - f.dep - f.lay / 60, sumL = d3.sum(L);
  let T = f.dep;
  return pairs.map(([p, q], i) => { const a = T, b = a + fly * L[i] / sumL; T = b + (f.lays[i] || 0) / 60; return { f, p, q, a, b }; });
}
let COUNTRIES = [];
function overWhat(ll) {
  const hit = COUNTRIES.find(({ f, b }) => (b[0][0] > b[1][0] || (ll[0] >= b[0][0] && ll[0] <= b[1][0] && ll[1] >= b[0][1] && ll[1] <= b[1][1])) && d3.geoContains(f, ll));
  if (hit) return 'over ' + hit.f.properties.name;
  // At sea: name the nearest sea label, if one is close.
  const sea = d3.least(SEAS, ([, lo, la]) => d3.geoDistance([lo, la], ll));
  return sea && d3.geoDistance([sea[1], sea[2]], ll) < 8 * rad ? 'over the ' + sea[0] : 'over the sea';
}
// Where the selected trip puts you at time T (hours, clock zone). pt is [lng, lat, metres].
function whereAt(T, sel) {
  const { o, r } = sel;
  for (const f of [o, r]) {
    const lg = flightLegs(f);
    for (const l of lg) if (T >= l.a && T <= l.b) { const s = (T - l.a) / (l.b - l.a), pt = arcAt(l.p, l.q, s);
      return { pt, head: heading(pt, arcAt(l.p, l.q, Math.min(1, s + .01))), flying: true, status: `${carrier(f)}, ${overWhat(pt)}` }; }
    for (let i = 0; i < lg.length - 1; i++) if (T > lg[i].b && T < lg[i + 1].a) {
      const at = lg[i].q, next = lg[i + 1].p;
      return { pt: P(at), status: at === next ? `Changing planes in ${CITY[at]}` : `Self-transfer in ${CITY[at]}: ${at} → ${next}, own your connection` };
    }
  }
  if (T < o.dep) return { pt: P(o.from), status: T >= o.dep - BEFORE_DEP ? `At ${CITY[o.from]} airport` : `In ${HOME_NAME}` };
  if (T > r.arr) return { pt: P(r.to), status: T <= r.arr + AFTER_ARR ? `Landed in ${CITY[r.to]}` : `Home in ${HOME_NAME}` };
  if (T >= r.dep - BEFORE_DEP) return { pt: P(r.from), status: `At ${CITY[r.from]} airport` };
  if (T < sel.arriveVenue) return { pt: P(o.to), status: `On the way to ${DEST_TOWN}` };
  return { pt: P(o.to), status: TRIP.event && T >= EVENT.start && T <= EVENT.end ? `At ${EVENT_NAME}` : `In ${DEST_TOWN}` };
}

// ---------- Map style ----------
function tile(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); paint(g);
  return { width: w, height: h, data: new Uint8Array(g.getImageData(0, 0, w, h).data.buffer) }; }
const DEM = { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 13 };
const lowZoom = (o) => ['interpolate', ['linear'], ['zoom'], 6.5, o, 7.5, 0];
function chartStyle(land, borders) {
  const polys = { type: 'FeatureCollection', features: land.features.filter((f) => f.geometry).flatMap((f) => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((c) => {
    let a = 0; const r = c[0]; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]) * Math.cos(r[i][1] * rad);
    return { type: 'Feature', properties: { area: Math.abs(a / 2) }, geometry: { type: 'Polygon', coordinates: c } }; }) };
  const grat = { type: 'FeatureCollection', features: [
    ...d3.range(36).map((i) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: d3.range(31).map((j) => [-180 + i * 10, -75 + j * 5]) } })),
    ...d3.range(15).map((i) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: d3.range(73).map((j) => [-180 + j * 5, -70 + i * 10]) } })) ] };
  return {
    version: 8, projection: { type: 'globe' }, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sky: { 'sky-color': '#e9e5d8', 'horizon-color': PAPER, 'fog-color': PAPER, 'sky-horizon-blend': .7, 'horizon-fog-blend': .8, 'fog-ground-blend': .7,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 1, .6, 5, .15, 8, 0] },
    sources: {
      ocean: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } } },
      land: { type: 'geojson', data: polys }, borders: { type: 'geojson', data: borders }, grat: { type: 'geojson', data: grat },
      omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' }, dem: DEM, demShade: { ...DEM },
    },
    layers: [
      { id: 'paper', type: 'background', paint: { 'background-color': PAPER } },
      { id: 'sea', type: 'fill', source: 'ocean', paint: { 'fill-pattern': 'sea', 'fill-opacity': lowZoom(1) } },
      ...[[3, .55, .02], [6, .4, 1], [9.5, .3, 4], [13, .2, 10]].map(([k, o, minArea], i) => ({ id: 'ring' + i, type: 'line', source: 'land', maxzoom: 7.5,
        filter: ['>', ['get', 'area'], minArea], layout: { 'line-join': 'round' },
        paint: { 'line-color': INK, 'line-width': 1, 'line-gap-width': ['interpolate', ['linear'], ['zoom'], 1, k * .5, 3.5, 2 * k, 6, 2.6 * k],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 1.6, 0, 2.6, o, 6.5, o, 7.5, 0] } })),
      // The land lifts off the page a little: a soft ink shadow under the coast.
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
    ],
    terrain: { source: 'dem', exaggeration: 2 },
  };
}

// ---------- Map ----------
const PAD = { left: 60, right: 500, top: 110, bottom: 60 };
// Below this zoom the page shows the whole globe and the HUD steps aside.
const FAR = 2.6;
// The opening view. Without one in trip.json, frame the home and destination airports.
const HOME = MAPC.view || viewOf([AIRPORTS[HOMEP], AIRPORTS[DESTP]]);
// The page opens on the whole globe, turned a little west of Europe, and zooms in to the route once the chart has drawn.
const START = { center: [-28, 34], zoom: 1.1, pitch: 0, bearing: 0 };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const map = new maplibregl.Map({ container: 'map', style: { version: 8, sources: {}, layers: [{ id: 'paper', type: 'background', paint: { 'background-color': PAPER } }] },
  ...(REDUCED ? HOME : START), maxPitch: 70, minZoom: 1, attributionControl: { compact: true }, fadeDuration: 0, canvasContextAttributes: { antialias: true } });
// The globe starts centred; the zoom-in eases the padding in, so the route ends up framed between the HUD cards.
if (REDUCED) map.setPadding(PAD); window.__map = map;

const resetMap = () => map.flyTo({ ...HOME, padding: PAD, duration: 900 });

let exag = 0;
function fitTerrain() { const z = map.getZoom(), e = Math.round((z <= 6 ? 2 : z >= 11 ? 1 : 2 - (z - 6) / 5) * 10) / 10;
  if (e !== exag && map.getTerrain()) { exag = e; map.setTerrain({ source: 'dem', exaggeration: e }); } }
map.on('zoom', fitTerrain);

function addPatterns() {
  const sea = tile(8, 4, (g) => { g.fillStyle = PAPER; g.fillRect(0, 0, 8, 4); g.fillStyle = 'rgba(29,42,74,.24)'; g.fillRect(0, 0, 8, 1); });
  const stip = tile(14, 14, (g) => { g.fillStyle = LAND; g.fillRect(0, 0, 14, 14); g.fillStyle = 'rgba(29,42,74,.3)';
    g.beginPath(); g.arc(3, 3, 1.1, 0, 7); g.fill(); g.fillStyle = 'rgba(29,42,74,.2)'; g.beginPath(); g.arc(10, 10, .9, 0, 7); g.fill(); });
  for (const [id, img, pr] of [['sea', sea, 1], ['stip', stip, 2]]) if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: pr });
}
// The engraved drawings are map symbols that face the camera, so they stand up like paper cut-outs when the map tilts.
const artFC = (sel) => ({ type: 'FeatureCollection', features: ART.map(([f, lo, la, km, code]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lo, la] },
  properties: { icon: 'art-' + f, km, op: code ? (code === HOMEP || code === DESTP || (sel && (touches(sel.o, code) || touches(sel.r, code))) ? 1 : .45) : .9 } })) });
async function addArt() {
  await Promise.all(ART.map(async ([f]) => { if (map.hasImage('art-' + f)) return; const img = await map.loadImage(f); if (!map.hasImage('art-' + f)) map.addImage('art-' + f, img.data); }));
  if (map.getSource('art')) return;
  map.addSource('art', { type: 'geojson', data: artFC(MS.sel) });
  // Icon size follows the drawing's size in km: 360 px art, scaled by metres per pixel at each zoom (about 2^zoom).
  const k = (z) => ['/', ['*', ['get', 'km'], 1900 * Math.pow(2, z) / 156543 / Math.cos(54 * rad)], 360];
  map.addLayer({ id: 'art', type: 'symbol', source: 'art', layout: { 'icon-image': ['get', 'icon'], 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
    'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport', 'symbol-z-order': 'viewport-y',
    'icon-size': ['interpolate', ['exponential', 2], ['zoom'], 2, k(2), 4, k(4), 6, ['min', 1.4, k(6)], 9, 1.4] },
    paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], 2.2, 0, 3, ['get', 'op'], 8, ['get', 'op'], 9, 0] } });
}
map.on('style.load', () => { addPatterns(); exag = 0; fitTerrain(); if (map.getSource('land')) { addArt(); map.once('idle', intro); } });
let introDone = false;
function intro() {
  if (introDone) return; introDone = true;
  const showHud = () => document.body.classList.remove('intro');
  if (REDUCED) { map.jumpTo(HOME); showHud(); return; }
  // Slow at both ends, with a gentle arc. The HUD starts to come in as the camera nears the route.
  map.flyTo({ ...HOME, padding: PAD, duration: 3400, curve: 1.1, essential: true, easing: (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 });
  setTimeout(showHud, 1900);
}
setTimeout(intro, 7000); // If the chart never loads, still show the page.

const pin = (html, cls, lnglat, anchor = 'center', offset = [0, 0]) => { const el = document.createElement('div'); el.className = cls; el.innerHTML = html;
  return new maplibregl.Marker({ element: el, anchor, offset }).setLngLat(lnglat).addTo(map); };
for (const [n, lo, la] of LABELS) pin(n, 'lbl', [lo, la]);
for (const [n, lo, la] of SEAS) pin(n, 'lbl sea', [lo, la]);
// The two ends get a big dot and the city name; the side of the name comes from which end lies further east.
const eastIsDest = AIRPORTS[DESTP][0] >= AIRPORTS[HOMEP][0];
pin('', 'dot', AIRPORTS[DESTP]); pin('', 'dot', AIRPORTS[HOMEP]);
pin(CITY[DESTP], 'lbl city', AIRPORTS[DESTP], eastIsDest ? 'right' : 'left', eastIsDest ? [-12, -12] : [12, -12]);
pin(CITY[HOMEP], 'lbl city', AIRPORTS[HOMEP], eastIsDest ? 'left' : 'right', eastIsDest ? [12, 18] : [-12, 18]);
const hubDots = {};
for (const c of Object.keys(PLACES).filter((c) => c !== HOMEP && c !== DESTP)) { hubDots[c] = pin('', 'hubdot', AIRPORTS[c]); pin(c, 'lbl hub', AIRPORTS[c], 'left', [7, 0]); }
const zoomClass = () => { const z = map.getZoom(), c = map.getContainer().classList; c.toggle('z-far', z < 2.4); c.toggle('z-mid', z >= 2.4 && z < 3.3); c.toggle('z-city', z >= 9);
  document.getElementById('stripes').classList.toggle('bare', z < FAR); document.body.classList.toggle('far', z < FAR); };
map.on('zoom', zoomClass); zoomClass();

// ---------- deck.gl layers ----------
const PLANE = 'art/airplane.glb';
const MS = { sel: null, marker: null };
const ALL_KEYS = [...new Map(ALL.flatMap((f) => flightPairs(f).map(([p, q]) => [legKey(p, q), [p, q]]))).values()];
function deckLayers() {
  const sel = MS.sel; if (!sel) return [];
  const legs = [sel.o, sel.r].flatMap(flightLegs);
  const selKeys = new Set(legs.map((l) => legKey(l.p, l.q)));
  const selected = legs.map((l) => ({ l, path: arcPath(l.p, l.q) }));
  const mpp = 156543 * Math.cos(map.getCenter().lat * rad) / Math.pow(2, map.getZoom());
  const ol = flightLegs(sel.o).reduce((a, b) => (ang(AIRPORTS[b.p], AIRPORTS[b.q]) > ang(AIRPORTS[a.p], AIRPORTS[a.q]) ? b : a));
  const plane = MS.marker?.flying ? MS.marker : { pt: arcAt(ol.p, ol.q, .5), head: heading(AIRPORTS[ol.p], AIRPORTS[ol.q]) };
  return [
    new deck.PathLayer({ id: 'shadows', data: selected, getPath: (d) => d.path.map(([x, y]) => [x, y, 0]), getColor: [...INKA, 40], getWidth: 1.5, widthUnits: 'pixels' }),
    new deck.PathLayer({ id: 'others', data: ALL_KEYS.filter(([p, q]) => !selKeys.has(legKey(p, q))), getPath: ([p, q]) => arcPath(p, q),
      getColor: [...INKA, 120], getWidth: 1.2, widthUnits: 'pixels', extensions: [new deck.PathStyleExtension({ dash: true })], getDashArray: [1, 4], dashJustified: true }),
    new deck.PathLayer({ id: 'halo', data: selected, getPath: (d) => d.path, getColor: [...LANDA, 235], getWidth: 6, widthUnits: 'pixels', capRounded: true }),
    new deck.PathLayer({ id: 'sel', data: selected, getPath: (d) => d.path, getColor: [...REDA, 255], getWidth: 2.4, widthUnits: 'pixels', capRounded: true }),
    new deck.PathLayer({ id: 'hit', data: selected, getPath: (d) => d.path, getColor: [0, 0, 0, 0], getWidth: 18, widthUnits: 'pixels', pickable: true, onHover: routeHover }),
    new deck.ScenegraphLayer({ id: 'plane', data: [plane], scenegraph: PLANE, getPosition: (d) => d.pt, sizeScale: mpp * .45, _lighting: 'pbr', visible: map.getZoom() >= 2.6,
      getOrientation: (d) => [0, 180 - d.head, 90], getColor: [250, 246, 236, 255] }),
    MS.marker && !MS.marker.flying && new deck.ScatterplotLayer({ id: 'you', data: [MS.marker], getPosition: (d) => d.pt, getRadius: 8, radiusUnits: 'pixels',
      getFillColor: [...REDA, 255], getLineColor: [...LANDA, 255], lineWidthUnits: 'pixels', getLineWidth: 2.5, stroked: true }),
  ].filter(Boolean);
}
const overlay = window.__ov = new deck.MapboxOverlay({ interleaved: false, layers: [], getCursor: ({ isHovering, isDragging }) => isHovering ? 'crosshair' : isDragging ? 'grabbing' : 'grab' });
map.addControl(overlay);
const refreshDeck = () => overlay.setProps({ layers: deckLayers() });
map.on('zoom', refreshDeck);

function routeHover(info) {
  if (!info.object) { clearHover(); return; }
  const { l, path } = info.object;
  let best = 0, bd = Infinity;
  path.forEach((p, i) => { const [x, y] = info.viewport.project(p); const d = (x - info.x) ** 2 + (y - info.y) ** 2; if (d < bd) { bd = d; best = i; } });
  const s = best / (path.length - 1), T = l.a + s * (l.b - l.a), over = overWhat(path[best]);
  setCursor([{ T, label: hhmm(T) }]);
  showTip(info.srcEvent, `<b>${l.f.dir === 'out' ? 'Out' : 'Back'} · ${hhmm(T)}</b> ${CLOCK_LABEL.toLowerCase()}<br>${carrier(l.f)} ${l.p} → ${l.q} · ${fmtDur(T - l.a)} flown, ${fmtDur(l.b - T)} to go` +
    `<br><span style="opacity:.7">${over[0].toUpperCase() + over.slice(1)}</span>`);
}
function clearHover() { hideTip(); setCursor([]); mapMarker(null); }
// The map gets no hover-out when the pointer leaves the route straight onto the HUD, so clear the route tooltip on the way out.
map.getCanvas().addEventListener('pointerleave', clearHover);
document.getElementById('hc').addEventListener('pointerenter', hideTip);
// The time cursor on the ledger moves the plane (or a dot on the ground) to where you are.
function mapMarker(w) { MS.marker = w && w.pt ? w : null; refreshDeck(); }
let lastKey = null;
function drawRoutes(sel) {
  const key = sel.o.id + sel.r.id;
  if (lastKey && key !== lastKey) frameRoute(sel, 900);
  lastKey = key;
  MS.sel = sel;
  for (const [c, m] of Object.entries(hubDots)) m.getElement().classList.toggle('on', touches(sel.o, c) || touches(sel.r, c));
  map.getSource('art')?.setData(artFC(sel));
  refreshDeck();
}
// Frame the chosen route in the space the HUD leaves free.
function frameRoute(sel, duration) {
  {
    map.flyTo({ ...viewOf([...stops(sel.o), ...stops(sel.r)].map((c) => AIRPORTS[c])), padding: { ...PAD }, duration, curve: 1.2, essential: true });
  }
}
// The centre and zoom that fit these points in the space the HUD leaves free.
function viewOf(pts) {
  {
    // fitBounds fails on the globe in MapLibre 5.24, so frame the route by hand: centre of the stops, zoom from their Mercator extent.
    const merc = ([lo, la]) => [(lo + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + la * rad / 2)) / Math.PI) / 2];
    const xs = pts.map((p) => merc(p)[0]), ys = pts.map((p) => merc(p)[1]), c = document.getElementById('map');
    // A short or narrow window leaves little room between the panels; never let the frame size go below 120 px.
    const w = Math.max(120, c.clientWidth - PAD.left - PAD.right - 80), h = Math.max(120, (c.clientHeight - PAD.top - PAD.bottom - 100) * 1.25);
    // Never so far out that the page turns into the globe view (FAR).
    const zoom = Math.max(FAR + .5, Math.min(4.6, Math.log2(Math.min(w / ((d3.max(xs) - d3.min(xs)) * 512), h / ((d3.max(ys) - d3.min(ys)) * 512)))));
    const lng = (d3.min(pts, (p) => p[0]) + d3.max(pts, (p) => p[0])) / 2, la = (d3.min(pts, (p) => p[1]) + d3.max(pts, (p) => p[1])) / 2;
    return { center: [lng, la], zoom, pitch: MAPC.view?.pitch ?? 26, bearing: MAPC.view?.bearing ?? -6 };
  }
}
map.on('click', () => { if (map.getZoom() < FAR && MS.sel) frameRoute(MS.sel, 1800); });

async function drawMap() {
  try {
    const NE = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/';
    const [land, borders, c] = await Promise.all([fetch(NE + 'ne_50m_land.geojson').then((r) => r.json()), fetch(NE + 'ne_50m_admin_0_boundary_lines_land.geojson').then((r) => r.json()),
      fetch('https://unpkg.com/world-atlas@2.0.2/countries-50m.json').then((r) => r.json())]);
    COUNTRIES = topojson.feature(c, c.objects.countries).features.map((f) => ({ f, b: d3.geoBounds(f) }));
    map.setStyle(chartStyle(land, borders), { diff: false });
  } catch (e) {
    pin('The chart could not load. Check the connection and reload.', 'lbl sea', [15, 54]);
  }
}

// ---------- Ledger ----------
const LE = { el: document.getElementById('ledger') };
const CLOCK_LABEL = TRIP.clock_label || `${CITY[DESTP]} time`;
function initLedger() {
  // Measure the views box: the timeline fills it, and it has a size also while another view shows.
  const { width, height } = document.querySelector('.views').getBoundingClientRect();
  const g = d3.select(LE.el), left = 118, right = width - 92;
  const x = d3.scaleLinear().domain([T0, T1]).range([left, right]);
  const top = 38, bottom = height - 20;
  // Outbound flights (Thu-Fri) and return flights (Sun-Mon) never overlap in time, so they share rows.
  const rows = { event: top + 16, work: top + 34, fH: top + 58 };
  rows.f0 = rows.fH + 14;
  // The flight rows fill the height the panel has, up to a comfortable 19 px.
  const rowH = Math.max(12.5, Math.min(19, (bottom - rows.f0) / Math.max(OUT.length, RET.length)));
  Object.assign(LE, { g, x, rows, rowH, width, height, left, right, bottom });

  g.append('defs').html(`<pattern id="l-night" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".6" height="4" fill="${INK}" opacity=".07"/></pattern>
    <pattern id="l-hatch" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".7" height="3.2" fill="${INK}" opacity=".5"/></pattern>
    <pattern id="l-hatch-red" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".8" height="3.2" fill="#b8322a"/></pattern>`);

  // Time axis on top: day names, then an hour scale with a tick every hour and a label every 3 hours.
  g.append('text').attr('x', 0).attr('y', 29).style('font', '600 8.5px var(--sans)').style('letter-spacing', '.16em').attr('fill', 'var(--muted)').text(CLOCK_LABEL.toUpperCase());
  for (const D of DAYS) { const d0 = D.s;
    for (const [a, b] of [[d0, d0 + 6.5], [D.e - 1.5, D.e]]) { const aa = Math.max(T0, a), bb = Math.min(T1, b);
      if (bb > aa) g.append('rect').attr('x', x(aa)).attr('y', top - 4).attr('width', x(bb) - x(aa)).attr('height', bottom - top + 4).attr('fill', 'url(#l-night)'); }
    if (d0 > T0) { g.append('line').attr('x1', x(d0)).attr('x2', x(d0)).attr('y1', 0).attr('y2', bottom).attr('stroke', 'var(--rule)');
      g.append('line').attr('x1', x(d0) + 2.5).attr('x2', x(d0) + 2.5).attr('y1', 0).attr('y2', bottom).attr('stroke', 'var(--rule2)'); }
    const a = Math.max(T0, d0), b = Math.min(T1, D.e);
    g.append('text').attr('x', x((a + b) / 2)).attr('y', 11).attr('text-anchor', 'middle').style('font', '600 10.5px var(--sans)').style('letter-spacing', '.22em')
      .attr('fill', 'var(--ink)').text(x(b) - x(a) > 60 ? D.label : '');
    for (let h = 1; h < Math.round(D.e - d0); h++) { const hh = d0 + h; if (hh <= T0 || hh >= T1) continue;
      const major = h % 3 === 0;
      g.append('line').attr('x1', x(hh)).attr('x2', x(hh)).attr('y1', major ? 31 : 33).attr('y2', 36).attr('stroke', 'var(--ink)').attr('opacity', major ? .5 : .22);
      if (major) g.append('text').attr('x', x(hh)).attr('y', 28).attr('text-anchor', 'middle').style('font', `${h % 6 ? 400 : 600} 9.5px var(--sans)`)
        .attr('fill', h % 6 ? 'var(--muted)' : 'var(--ink2)').text(String(h).padStart(2, '0'));
      if (h % 6 === 0) g.append('line').attr('x1', x(hh)).attr('x2', x(hh)).attr('y1', top).attr('y2', bottom).attr('stroke', 'var(--rule2)').attr('stroke-dasharray', '2 3'); }
  }
  g.append('line').attr('x1', left).attr('x2', right).attr('y1', 36).attr('y2', 36).attr('stroke', 'var(--rule)');
  const lbl = (y, s) => g.append('text').attr('x', 0).attr('y', y + 3.5).style('font', '600 9.5px var(--sans)').style('letter-spacing', '.16em').attr('fill', 'var(--ink)').text(s);
  lbl(rows.event, EVENT_NAME.toUpperCase()); if (WORK.length) lbl(rows.work, 'OFFICE'); lbl(rows.f0, 'FLIGHTS');
  const groupLbl = (list, s) => g.append('text').attr('x', x(d3.min(list, (f) => f.dep))).attr('y', rows.fH).style('font', '600 9px var(--sans)').style('letter-spacing', '.16em').attr('fill', 'var(--muted)').text(s);
  if (OUT.length) groupLbl(OUT, `${OUT[0].from} → ${OUT[0].to}`); if (RET.length) groupLbl(RET, `${RET[0].from} → ${RET[0].to}`);
  g.append('line').attr('x1', 0).attr('x2', width - 36).attr('y1', rows.fH - 12).attr('y2', rows.fH - 12).attr('stroke', 'var(--rule2)');

  // Event ribbon: hatched for the whole event; solid ink for the hours you are there.
  g.append('rect').attr('x', x(EVENT.start)).attr('y', rows.event - 4.5).attr('width', x(EVENT.end) - x(EVENT.start)).attr('height', 9).attr('fill', 'url(#l-hatch-red)').attr('stroke', 'var(--red)').attr('stroke-width', .6);
  g.append('rect').attr('class', 'present').attr('y', rows.event - 4.5).attr('height', 9).attr('fill', INK);
  g.append('g').attr('class', 'mom').selectAll('g').data(MOMENTS).join('g').attr('transform', (m) => `translate(${x(m.at)},${rows.event})`).call((s) => {
    s.append('rect').attr('x', -3).attr('y', -3).attr('width', 6).attr('height', 6).attr('transform', 'rotate(45)').attr('stroke', 'var(--card)').attr('stroke-width', 1.2);
    s.filter((m) => m.label).append('text').attr('y', -8).attr('text-anchor', 'middle').style('font', 'italic 400 10.5px var(--serif)').attr('fill', 'var(--ink)').text((m) => m.label);
    s.append('circle').attr('r', 9).attr('fill', 'transparent').on('mousemove', (e, m) => showTip(e, `<b>${m.name}</b> · ${hhmm(m.at)}`)).on('mouseleave', hideTip);
  });
  g.append('g').attr('class', 'work').selectAll('g').data(WORK).join('g').call((s) => {
    s.append('rect').attr('x', (w) => x(w.s)).attr('y', rows.work - 4.5).attr('width', (w) => x(w.e) - x(w.s)).attr('height', 9).attr('fill', 'none').attr('stroke', INK).attr('stroke-width', .7);
    s.append('g').attr('class', 'lost');
  });

  const data = [...OUT.map((f, i) => ({ f, y: rows.f0 + i * rowH })), ...RET.map((f, i) => ({ f, y: rows.f0 + i * rowH }))];
  const fl = g.append('g').selectAll('g').data(data).join('g').attr('class', 'lrow')
    .on('mousemove', (e, d) => { showTip(e, flightTip(d.f)); if (LE.hover !== d.f.id) { LE.hover = d.f.id; paintLedger(); } })
    .on('mouseleave', () => { hideTip(); LE.hover = null; paintLedger(); }).on('click', (e, d) => pick(d.f));
  fl.each(function (d) {
    const r = d3.select(this), f = d.f, lg = flightLegs(f);
    for (let i = 0; i < lg.length - 1; i++) { const a = lg[i].b, b = lg[i + 1].a, ground = lg[i].q !== lg[i + 1].p;
      r.append('line').attr('x1', x(a) + 1.5).attr('x2', x(b) - 1.5).attr('y1', d.y).attr('y2', d.y).attr('stroke', ground ? RED : INK).attr('stroke-dasharray', ground ? '3 2' : '1 2.5').attr('opacity', ground ? .8 : .55);
      if (x(b) - x(a) > 26) r.append('text').attr('x', (x(a) + x(b)) / 2).attr('y', d.y - 2.5).attr('text-anchor', 'middle').style('font', '600 7px var(--sans)').style('letter-spacing', '.1em')
        .attr('fill', ground ? RED : 'var(--muted)').text(ground ? `SELF-TRANSFER ${lg[i].q} → ${lg[i + 1].p}` : lg[i].q); }
    // Hit area spans label, bar and price so the whole flight is easy to point at.
    r.append('rect').attr('x', x(f.dep) - 90).attr('y', d.y - rowH / 2).attr('width', x(f.arr) - x(f.dep) + 150).attr('height', rowH).attr('fill', 'transparent');
    r.append('text').attr('class', 'al').attr('x', x(f.dep) - 6).attr('y', d.y + 3.8).attr('text-anchor', 'end').style('font', '400 11px var(--sans)');
    for (const l of lg) r.append('rect').attr('class', 'leg').attr('x', x(l.a)).attr('y', d.y - 4).attr('width', Math.max(2, x(l.b) - x(l.a))).attr('height', 8).attr('rx', 1.5);
    r.append('text').attr('class', 'pl').attr('x', x(f.arr) + 6).attr('y', d.y + 3.8).style('font', '400 11px var(--sans)');
  });
  LE.fl = fl;

  // Time cursor: hover anywhere on the ledger to see where the selected trip puts you at that moment.
  LE.cur = g.append('g').attr('pointer-events', 'none');
  g.on('pointermove', (e) => {
    const [px] = d3.pointer(e);
    if (px < left || px > right) { setCursor([]); mapMarker(null); return; }
    const T = Math.round(x.invert(px) * 12) / 12, w = whereAt(T, LE.sel);
    setCursor([{ T, label: `${hhmm(T)} · ${w.status}` }]);
    mapMarker(w);
  }).on('pointerleave', () => { setCursor([]); mapMarker(null); });
}
function setCursor(items) {
  if (!LE.cur) return;
  const { x, height, bottom } = LE;
  const c = LE.cur.selectAll('g').data(items).join((en) => { const s = en.append('g'); s.append('line'); s.append('rect'); s.append('text'); return s; });
  c.select('line').attr('y1', 16).attr('y2', bottom).attr('stroke', 'var(--red)').attr('stroke-width', 1);
  c.select('text').attr('y', height - 5).attr('text-anchor', 'middle').style('font', '600 10.5px var(--sans)').attr('fill', 'var(--card)').text((d) => d.label);
  c.each(function (d) {
    const s = d3.select(this), w = s.select('text').node().getComputedTextLength() + 16;
    const xt = x(d.T), dx = Math.min(LE.width - 36 - (xt + w / 2), Math.max(0, w / 2 - xt)); // keep the pill inside the card
    s.attr('transform', `translate(${x(d.T)},0)`);
    s.select('rect').attr('x', -w / 2 + dx).attr('y', height - 18).attr('width', w).attr('height', 17).attr('rx', 2).attr('fill', 'var(--red)');
    s.select('text').attr('x', dx);
  });
}

// ---------- Controls ----------
const toggleRemote = () => { state.remote = !state.remote; store.set('remote', state.remote); state.out = state.ret = null; render(); };

// ---------- Render ----------
let list = [];
function pick(f) { state[f.dir] = f.id; store.set('out', state.out); store.set('ret', state.ret); render(); }
function pickCombo(c) { state.out = c.o.id; state.ret = c.r.id; store.set('out', state.out); store.set('ret', state.ret); render(); }
function render() {
  list = ranked();
  const cheapAny = (f) => d3.min(OFFERS[f.id] || [], (s) => s.price);
  // Keep the chosen flights. Only a flight that no accepted seller sells is replaced, by its best partner in the ranking.
  if (!list.some((c) => c.o.id === state.out && c.r.id === state.ret)) {
    const c = list.find((c) => c.o.id === state.out) || list.find((c) => c.r.id === state.ret) || list[0];
    state.out = c.o.id; state.ret = c.r.id; store.set('out', state.out); store.set('ret', state.ret);
  }
  const sel = evaluate(OUT.find((f) => f.id === state.out), RET.find((f) => f.id === state.ret), state.remote);
  const rank = list.findIndex((c) => c.o.id === sel.o.id && c.r.id === sel.r.id) + 1;

  const pmark = (f, ink, x, y, rot) => `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="${ink}" stroke-width="1.3" opacity=".85">
    <circle r="27"/><circle r="21"/><text y="-5" text-anchor="middle" fill="${ink}" stroke="none" style="font:600 8px var(--sans);letter-spacing:.16em">${f.depD.toUpperCase()} ${f.depN}</text>
    <text y="9" text-anchor="middle" fill="${ink}" stroke="none" style="font:600 13px var(--serif)">${f.depT}</text>
    <path d="M30 -9 q8 -5 16 0 t16 0 t16 0 M30 0 q8 -5 16 0 t16 0 t16 0 M30 9 q8 -5 16 0 t16 0 t16 0" stroke-width="1"/></g>`;
  const perf = d3.range(0, 64, 6).map((i) => `<circle cx="${i + 3}" cy="0" r="2.2"/><circle cx="${i + 3}" cy="76" r="2.2"/>`).join('') +
               d3.range(0, 76, 6).map((i) => `<circle cx="0" cy="${i + 3}" r="2.2"/><circle cx="66" cy="${i + 3}" r="2.2"/>`).join('');
  const top5 = list.slice(0, 5), at = top5.findIndex((c) => c.o.id === sel.o.id && c.r.id === sel.r.id);
  document.getElementById('postcard').innerHTML = `
    <div class="pick">
      <nav class="steps" aria-label="Steps"><button class="stp" data-step="1" ${drawerOpen ? '' : 'aria-current="step"'}><i>${drawerOpen ? '<svg viewBox="0 0 10 10" width="8" height="8"><path d="M2 5.2 4.2 7.4 8 3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' : 1}</i>Preview</button><span class="ln"></span><button class="stp" data-step="2" ${drawerOpen ? 'aria-current="step"' : ''}><i>2</i>Choose tickets</button></nav>
      <span class="dots">${top5.map((c, i) => `<button data-i="${i}" aria-pressed="${i === at}" title="${c.o.depD} ${c.o.depT} → ${c.r.depD} ${c.r.depT} · ${money(c.price)}"></button>`).join('')}</span>
      <button class="step" data-d="-1" aria-label="Previous trip" ${rank <= 1 ? 'disabled' : ''}><svg viewBox="0 0 10 10"><path d="M6.5 1.5 3 5l3.5 3.5"/></svg></button>
      <button class="step" data-d="1" aria-label="Next trip" ${rank >= list.length ? 'disabled' : ''}><svg viewBox="0 0 10 10"><path d="M3.5 1.5 7 5 3.5 8.5"/></svg></button>
    </div>
    <div class="info">
      <span class="eyebrow">${rank === 1 ? 'Best match' : at >= 0 ? `Option ${rank}` : 'Your pick'}</span>
      <div class="price">${money(sel.price)}<small>${sel.deal ? `${sel.deal.what}, saves ${sel.split - sel.price}` : sellerLine(sel)}</small></div>
      <div class="leg"><b>Out</b><span><em>${sel.o.depD} ${sel.o.depT}</em> · ${carrier(sel.o)}${sel.o.via.length ? ' via ' + viaText(sel.o) : ', nonstop'}</span></div>
      <div class="leg"><b>Back</b><span><em>${sel.r.depD} ${sel.r.depT}</em> · ${carrier(sel.r)}${sel.r.via.length ? ' via ' + viaText(sel.r) : ', nonstop'}</span></div>
      <div class="meters big">
        ${WORK.length ? `<div class="meter"><span>Work lost</span>${hoursHTML(sel)}<span>${fmtDur(sel.lost)}</span></div>` : ''}
        ${MOMENTS.length ? `<div class="meter"><span>${EVENT_NAME}</span>${momentsHTML(sel)}<span>${sel.moments.filter(Boolean).length} of ${MOMENTS.length}</span></div>` : ''}
      </div>
    </div>
    <div class="rule"></div>
    <div class="addr">
      <div class="stampbox"><svg width="168" height="96" style="overflow:visible">
        <g transform="translate(96,8) rotate(3)">
          <rect width="66" height="76" fill="#fff"/><g fill="var(--card)">${perf}</g>
          <rect x="6" y="6" width="54" height="64" fill="#e9ecf2"/>
          ${TRIP.destination.stamp ? `<image href="${TRIP.destination.stamp}" x="8" y="8" width="50" height="50" onerror="this.remove()"/>` : `<text x="33" y="44" text-anchor="middle" style="font:700 19px var(--serif)" fill="${INK}">${DESTP}</text>`}
          <text x="33" y="67" text-anchor="middle" style="font:700 8px var(--sans);letter-spacing:.08em" fill="${INK}">${money(sel.price)}</text>
        </g>
        ${pmark(sel.o, 'var(--red)', 34, 30, -8)}${pmark(sel.r, INK, 66, 70, 6)}
      </svg></div>
      <div class="lines"><div>${TRIP.destination.venue || DEST_TOWN}</div><div>${TRIP.destination.address || ''}</div></div>
    </div>
    <div class="ctl">${controlsHTML()}</div>
    <button class="book" id="book"><span></span><b id="bookp"></b></button>`;
  const pc = document.getElementById('postcard');
  pc.querySelectorAll('.dots button').forEach((b) => b.onclick = () => pickCombo(top5[+b.dataset.i]));
  pc.querySelectorAll('.step').forEach((b) => b.onclick = () => pickCombo(list[Math.max(0, Math.min(list.length - 1, rank - 1 + +b.dataset.d))]));
  pc.querySelectorAll('.stp').forEach((b) => b.onclick = () => setDrawer(b.dataset.step === '2'));
  wireControls(pc);
  // Step 1 goes on to step 2; step 2 books. A booking already under way always opens its checkout.
  document.getElementById('book').onclick = () => !drawerOpen && !(OPEN_JOB && BOOK_TEXT[OPEN_JOB.status]) ? setDrawer(true) : openCheckout();
  drawRoutes(sel);
  LE.sel = sel;
  bookState();
  if (!LE.g) { if (drawerOpen) renderView(); return; }
  const { x, g, rows } = LE;
  const p0 = Math.max(EVENT.start, sel.arriveVenue), p1 = Math.min(EVENT.end, sel.leaveVenue);
  g.select('.present').transition().duration(220).attr('x', x(p0)).attr('width', Math.max(0, x(p1) - x(p0)));
  g.selectAll('.mom g').select('rect').attr('fill', (m, i) => sel.moments[i] ? 'var(--card)' : 'var(--red)');
  g.selectAll('.work g').select('.lost').each(function (w) {
    const parts = sel.spans.map(([a, b]) => [Math.max(w.s, a), Math.min(w.e, b)]).filter(([a, b]) => b > a);
    d3.select(this).selectAll('rect').data(parts).join('rect').attr('y', rows.work - 4.5).attr('height', 9).attr('fill', 'var(--red)')
      .attr('x', (p) => x(p[0])).attr('width', (p) => x(p[1]) - x(p[0]));
  });
  paintLedger();
  if (drawerOpen) renderView();
}
// Who sells the two tickets, in a few words.
const sellerLine = (sel) => { const w = [sel.o.offer, sel.r.offer];
  return w.every((s) => s.kind === 'airline') ? 'two one-ways, airline sites' : w.map((s) => s.who === AIRLINE[sel.o.al] || s.who === AIRLINE[sel.r.al] ? s.who : s.who).join(' + '); };
function paintLedger() {
  const isSel = (f) => f.id === state.out || f.id === state.ret, hot = (f) => f.id === LE.hover;
  LE.fl.selectAll('.leg').attr('fill', (d) => isSel(d.f) ? 'var(--red)' : INK).attr('opacity', (d) => isSel(d.f) ? 1 : hot(d.f) ? .7 : .3);
  // The chosen and hovered flights show their local departure and arrival times beside the bar.
  const on = (d) => isSel(d.f) || hot(d.f);
  LE.fl.attr('opacity', (d) => d.f.price == null ? .32 : 1);
  LE.fl.select('.pl').attr('fill', (d) => on(d) ? 'var(--ink)' : 'var(--muted)').style('font-weight', (d) => isSel(d.f) ? 600 : 400)
    .html((d) => { const p = d.f.price ?? '—', w = d.f.self ? ' · self-transfer' : d.f.warn ? ` · ${d.f.warn.short || 'check'}` : '';
      return `${d.f.arrT}<tspan dx="7" style="font:600 11.5px var(--serif)" fill="${isSel(d.f) ? 'var(--red)' : 'currentColor'}">${p}</tspan>${w ? `<tspan fill="var(--muted)">${w}</tspan>` : ''}`; });
  LE.fl.select('.al').attr('fill', (d) => on(d) ? 'var(--ink)' : 'var(--muted)').style('font-weight', (d) => isSel(d.f) ? 600 : 400)
    .html((d) => `${carrier(d.f)}<tspan dx="6" style="font-variant-numeric:tabular-nums">${d.f.depT}</tspan>`);
}
// ---------- Bottom panel: four ways to read the same choice ----------
const VIEWS = { timeline: 'Timeline', trade: 'Trade-off', sellers: 'Where to buy', story: 'Itinerary' };
state.view = VIEWS[store.get('view', 'timeline')] ? store.get('view', 'timeline') : 'timeline';
const tabsEl = document.getElementById('tabs');
function initTabs() {
  for (const [k, label] of Object.entries(VIEWS)) { const b = document.createElement('button'); b.innerHTML = label; b.dataset.k = k; b.onclick = () => setView(k); tabsEl.append(b); }
}
function setView(k) { if (!drawerOpen) setDrawer(true); state.view = k; store.set('view', k); hideTip(); setCursor([]); mapMarker(null); renderView(); }
function renderView() {
  [...tabsEl.children].forEach((b) => b.dataset.k && b.setAttribute('aria-pressed', b.dataset.k === state.view));
  document.querySelectorAll('#panel .view').forEach((v) => v.classList.toggle('off', v.dataset.v !== state.view));
  if (!LE.sel) return;
  if (state.view === 'trade') drawTrade(LE.sel);
  if (state.view === 'sellers') drawSellers(LE.sel);
  if (state.view === 'story') drawStory(LE.sel);
}
const capsLbl = (g, x, y, s, anchor = 'start', fill = 'var(--ink)') => g.append('text').attr('x', x).attr('y', y).attr('text-anchor', anchor)
  .style('font', '600 9.5px var(--sans)').style('letter-spacing', '.16em').attr('fill', fill).text(s);
const comboTip = (c) => `${flightTip(c.o)}<br><br>${flightTip(c.r)}<br><br>${c.deal ? `<b>${c.deal.what}: ${money(c.price)}</b> (two one-ways: ${c.split})<br>` : ''}` +
  `Work lost <b>${fmtDur(c.lost)}</b> · Missed: ${MOMENTS.filter((m, j) => !c.moments[j]).map((m) => m.name).join(', ') || 'nothing'}`;

// Trade-off: every pairing as a dot. Left is cheaper, down is less work lost. The dashed line joins the trips nothing beats on both.
function drawTrade(sel) {
  // The up axis is work lost; a trip without office hours uses the time in transit instead.
  const YV = WORK.length ? (c) => c.lost : (c) => c.travel, YL = WORK.length ? 'work lost' : 'travel time';
  const svg = d3.select('#v-trade'); svg.selectAll('*').remove();
  const { width: W, height: H } = svg.node().getBoundingClientRect();
  const m = { l: 118, r: 290, t: 16, b: 30 };
  const x = d3.scaleLinear().domain(d3.extent(list, (c) => c.price)).nice().range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(list, YV))]).nice().range([H - m.b, m.t]);
  const g = svg.append('g');
  for (const v of x.ticks(10)) { g.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', 'var(--rule2)');
    g.append('text').attr('x', x(v)).attr('y', H - m.b + 14).attr('text-anchor', 'middle').style('font', '400 9.5px var(--sans)').attr('fill', 'var(--muted)').text(v); }
  for (const v of y.ticks(5)) { g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', 'var(--rule2)').attr('stroke-dasharray', v ? '2 3' : null);
    g.append('text').attr('x', m.l - 8).attr('y', y(v) + 3).attr('text-anchor', 'end').style('font', '400 9.5px var(--sans)').attr('fill', 'var(--muted)').text(v ? v + 'h' : '0'); }
  capsLbl(g, 0, m.t + 4, YL.toUpperCase()); capsLbl(g, 0, H - m.b + 14, `PRICE, ${CUR}`);
  capsLbl(g, 0, m.t + 18, 'up is worse', 'start', 'var(--muted)').style('font', 'italic 400 11px var(--serif)').style('letter-spacing', 0);
  // Pareto front: sorted by price, keep each trip that loses less work than every cheaper trip.
  const front = []; let best = Infinity;
  for (const c of [...list].sort((a, b) => a.price - b.price || YV(a) - YV(b))) if (YV(c) < best - 1e-6) { front.push(c); best = YV(c); }
  g.append('path').attr('d', d3.line().curve(d3.curveStepAfter).x((c) => x(c.price)).y((c) => y(YV(c)))(front)).attr('fill', 'none').attr('stroke', INK).attr('stroke-dasharray', '4 3').attr('opacity', .55);
  const r = (c) => 2.5 + c.moments.filter(Boolean).length * .75, full = (c) => c.moments.every(Boolean);
  const isSel = (c) => c.o.id === sel.o.id && c.r.id === sel.r.id, top5 = new Set(list.slice(0, 5));
  const dots = [...list].sort((a, b) => isSel(a) - isSel(b));
  g.append('g').selectAll('circle').data(dots).join('circle').attr('cx', (c) => x(c.price)).attr('cy', (c) => y(YV(c))).attr('r', (c) => isSel(c) ? r(c) + 2 : r(c))
    .attr('fill', (c) => isSel(c) ? RED : full(c) ? INK : 'var(--card)').attr('fill-opacity', (c) => isSel(c) ? 1 : full(c) ? .75 : 1)
    .attr('stroke', (c) => isSel(c) ? 'var(--card)' : full(c) ? 'none' : RED).attr('stroke-width', (c) => isSel(c) ? 2 : 1).style('cursor', 'pointer')
    .on('mousemove', (e, c) => showTip(e, comboTip(c))).on('mouseleave', hideTip).on('click', (e, c) => pickCombo(c));
  // Ranks 1-5 of the current priority get a number beside them.
  g.append('g').selectAll('text').data(list.slice(0, 5)).join('text').attr('x', (c) => x(c.price) + r(c) + 4).attr('y', (c) => y(YV(c)) - r(c) - 1)
    .style('font', '600 9px var(--sans)').attr('fill', 'var(--ink2)').attr('pointer-events', 'none').text((c, i) => i + 1);
  const sx = x(sel.price), sy = y(YV(sel));
  g.append('text').attr('x', sx + 10).attr('y', sy + 16).style('font', 'italic 600 12px var(--serif)').attr('fill', RED).attr('pointer-events', 'none')
    .text(`${sel.o.depD} ${sel.o.depT} → ${sel.r.depD} ${sel.r.depT} · ${money(sel.price)}`);
  // Key and reading notes on the right.
  const k = svg.append('g').attr('transform', `translate(${W - m.r + 34},${m.t + 4})`);
  capsLbl(k, 0, 0, 'HOW TO READ');
  const note = (yy, html) => k.append('foreignObject').attr('x', 0).attr('y', yy).attr('width', m.r - 50).attr('height', 60)
    .html(`<div style="font:11.5px/1.45 var(--sans);color:var(--ink2)">${html}</div>`);
  if (MOMENTS.length) k.append('circle').attr('cx', 6).attr('cy', 22).attr('r', 6).attr('fill', INK).attr('fill-opacity', .75);
  if (MOMENTS.length) k.append('circle').attr('cx', 24).attr('cy', 22).attr('r', 4).attr('fill', 'var(--card)').attr('stroke', RED);
  if (MOMENTS.length) k.append('text').attr('x', 36).attr('y', 26).style('font', '11.5px var(--sans)').attr('fill', 'var(--ink2)').text(`full ${EVENT_NAME} · misses moments`);
  note(36, `Each dot pairs one flight out with one flight back: <b>${list.length}</b> pairings you can buy from <b>${BUY[state.buy].label.replace('+ ', '')}</b>. ${MOMENTS.length ? `Bigger dots see more of ${EVENT_NAME}.` : ''}`);
  note(100, `The dashed line joins the trips that nothing beats on both price and ${YL}. A trip above it costs you twice.`);
  note(152, front.some(isSel) ? `<b style="color:${RED}">Your trip is on the line.</b> Saving more money costs ${WORK.length ? 'work' : 'time'}, and the reverse.` :
    `<b style="color:${RED}">Your trip is above the line.</b> Another trip is cheaper and ${WORK.length ? 'loses no more work' : 'is no slower'}, but it may miss ${EVENT_NAME} moments.`);
}

// Where to buy: each seller of the chosen flights on one price scale, and why the tool picked the one it did.
function drawSellers(sel) {
  const el = document.getElementById('v-sellers');
  const rows = [{ k: 'OUT', f: sel.o }, { k: 'BACK', f: sel.r }];
  const deals = DEALS.filter((d) => d.o === sel.o.id && d.r === sel.r.id);
  const all = [...rows.flatMap((r) => OFFERS[r.f.id] || [])];
  el.innerHTML = `<div class="head"><span>${TRIP.sources_note || 'Every seller we saw for your two flights.'}</span>
    <span>■ airline &nbsp; ○ agency (size = rating) &nbsp; <span style="color:${RED}">▲ self-transfer</span></span></div><div class="rows"></div>`;
  const box = el.querySelector('.rows');
  for (const { k, f } of rows) {
    const offers = (OFFERS[f.id] || []).slice().sort((a, b) => a.price - b.price), used = f.offer, cheapest = offers[0];
    const row = document.createElement('div'); row.className = 'srow';
    row.innerHTML = `<div class="who"><b>${k}</b><em>${f.depD} ${f.depT} → ${f.arrT}</em><span>${carrier(f)}${f.nums ? ' ' + f.nums : ''}<br>${f.via.length ? 'via ' + viaText(f) : 'nonstop'}</span></div><svg></svg><div class="why"></div>`;
    box.append(row);
    const svg = d3.select(row.querySelector('svg')), Wd = row.querySelector('svg').getBoundingClientRect().width;
    const lo = d3.min(offers, (s) => s.price), hi = d3.max(offers, (s) => s.price), pad = Math.max(8, (hi - lo) * .12);
    const x = d3.scaleLinear().domain([lo - pad, hi + pad]).range([10, Wd - 10]);
    svg.append('line').attr('x1', 0).attr('x2', Wd).attr('y1', 34).attr('y2', 34).attr('stroke', 'var(--rule)');
    for (const v of x.ticks(6)) { svg.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', 31).attr('y2', 37).attr('stroke', 'var(--rule)');
      svg.append('text').attr('x', x(v)).attr('y', 50).attr('dy', 0).attr('opacity', .8).attr('display', 'none').attr('text-anchor', 'middle').style('font', '9.5px var(--sans)').attr('fill', 'var(--muted)').text(v); }
    // Sellers at the same price share one mark and one label.
    const groups = d3.groups(offers, (s) => s.price);
    groups.forEach(([price, ss], i) => {
      const gx = x(price), up = i % 2 === 0, isUsed = ss.includes(used), okAll = ss.some(ok);
      const gg = svg.append('g').attr('transform', `translate(${gx},34)`).attr('opacity', okAll ? 1 : .38).style('cursor', 'default')
        .on('mousemove', (e) => showTip(e, ss.map((s) => `<b>${s.who}</b> · ${money(s.price)} · ${s.kind === 'airline' ? 'airline site' : s.kind === 'self' ? 'self-transfer ticket' : 'travel agency'}` +
          `${s.stars ? ` · ★ ${s.stars} (${s.n.toLocaleString('en')} reviews)` : s.kind !== 'airline' ? ' · rating not checked' : ''}<br><span style="opacity:.7">seen on ${s.src}${ok(s) ? '' : ' · not in "' + BUY[state.buy].label + '"'}</span>`).join('<br>')))
        .on('mouseleave', hideTip);
      const s0 = ss[0];
      if (isUsed) gg.append('circle').attr('r', 10).attr('fill', 'none').attr('stroke', RED).attr('stroke-width', 1.6);
      if (s0.kind === 'airline') gg.append('rect').attr('x', -5).attr('y', -5).attr('width', 10).attr('height', 10).attr('fill', INK);
      else if (s0.kind === 'self') gg.append('path').attr('d', 'M0 -6 L6 5 L-6 5 Z').attr('fill', RED);
      else gg.append('circle').attr('r', 2.5 + (s0.stars || 2) * .9).attr('fill', 'var(--card)').attr('stroke', INK).attr('stroke-width', 1.2);
      gg.append('text').attr('class', 'sl').attr('text-anchor', 'middle').style('font', `${isUsed ? 600 : 400} 10px var(--sans)`).attr('fill', isUsed ? RED : 'var(--ink2)')
        .text(`${ss.map((s) => s.who).join(', ')} ${price}`).datum({ gx, isUsed });
    });
    // Labels: the one in use goes first, above its mark. The others take the first lane where they do not collide.
    const lanes = [-14, 26, -27, 39], placed = lanes.map(() => []);
    const labels = svg.selectAll('text.sl').nodes().sort((a, b) => d3.select(b).datum().isUsed - d3.select(a).datum().isUsed);
    for (const n of labels) { const { gx } = d3.select(n).datum(), w = n.getComputedTextLength() + 10, a = gx - w / 2, b = gx + w / 2;
      const li = Math.max(0, lanes.findIndex((_, i) => placed[i].every(([p, q]) => b < p || a > q)));
      placed[li].push([a, b]); d3.select(n).attr('y', lanes[li]); }
    const why = row.querySelector('.why');
    const reason = (s) => s.kind === 'self' ? 'it is a self-transfer ticket' : s.kind === 'agency' && !s.stars ? 'its rating was not checked' :
      s.kind === 'agency' && (s.stars < 4 || s.n < 100) ? `it is rated ${s.stars} from ${s.n} reviews` : 'it is a travel agency';
    let txt = used ? `Using <b>${used.who}</b>, ${money(used.price)}${used.kind === 'airline' ? ', the airline\'s own site.' : '.'}` : `<b>No seller you accept.</b>`;
    if (used && cheapest.price < used.price) {
      const better = offers.filter((s) => s.price < used.price);
      txt += ` ${better.map((s) => s.who).slice(0, 2).join(' and ')} sell${better.length === 1 ? 's' : ''} it for ${money(cheapest.price)}, <b>${money(used.price - cheapest.price)} less</b>, but ${reason(cheapest)}.`;
    } else if (used) txt += ' It is the cheapest seller we saw.';
    if (used && used.kind !== 'airline') txt += ` A change or refund goes through ${used.who}, not ${carrier(f)}.`;
    if (f.warn) txt += ` <b>Note:</b> ${f.warn.text}`;
    if (f.self) txt += ' <b>Self-transfer:</b> if the first flight is late, the second airline owes you nothing.';
    why.innerHTML = txt;
  }
  if (deals.length) {
    const d = d3.least(deals, (z) => z.price), row = document.createElement('div'); row.className = 'srow';
    row.innerHTML = `<div class="who"><b>BOTH</b><em>Bought together</em><span>${deals.length} offer${deals.length > 1 ? 's' : ''} for this pair</span></div>
      <div style="font:italic 400 14px var(--serif)">${deals.map((z) => `${z.what}: <b>${money(z.price)}</b>${ok(z) ? '' : ` <span style="color:var(--muted)">(not in "${BUY[state.buy].label}")</span>`}`).join(' &nbsp;·&nbsp; ')}</div>
      <div class="why">${sel.deal ? `<b>Using the deal.</b> It is ${money(sel.split - sel.price)} less than two one-way tickets.` : `Two one-way tickets cost <b>${money(sel.split)}</b> here${d.price < sel.split ? `, so the deal would save ${money(sel.split - d.price)}, but ${d.kind === 'agency' ? `${d.who} is rated ${d.stars}` : 'it is not allowed'}` : `, which beats the deal`}.`}</div>`;
    box.append(row);
  }
}

// Before this local time, the way to the airport is different (no trains this early, say).
const earlyText = (T, code) => { const e = TRIP.destination.early; return e && local(T, PLACES[code].tz).hm < e.before ? e.text : null; };
// How the destination clock differs from home, in words.
const tzNote = () => { const d = (offsetMin(EPOCH0, PLACES[DESTP].tz) - offsetMin(EPOCH0, PLACES[HOMEP].tz)) / 60, n = Math.abs(d);
  return d === 0 ? `${CITY[DESTP]} and ${CITY[HOMEP]} share a clock.` : `${CITY[DESTP]} is ${n} hour${n === 1 ? '' : 's'} ${d > 0 ? 'ahead of' : 'behind'} ${CITY[HOMEP]}.`; };
// Itinerary: the chosen trip as a line of stations, in local time, from leaving home to sitting back at your desk.
function drawStory(sel) {
  const el = document.getElementById('v-story'), { o, r } = sel;
  const at = (T, code) => { const l = local(Math.round(T * 60) / 60, PLACES[code].tz); return { day: `${l.wd.toUpperCase()} ${l.day}`, tm: l.hm, tz: tzAbbr(PLACES[code].tz) }; };
  const st = [];
  const legsOf = (f) => { const lg = flightLegs(f); const out = [];
    out.push({ T: f.dep, code: lg[0].p, ti: `${carrier(f)} departs`, sb: `${CITY[lg[0].p]}${f.nums ? ' · ' + f.nums : ''}`, cls: 'fly', gap: `flight ${fmtDur(lg[0].b - lg[0].a)}` });
    for (let i = 0; i < lg.length - 1; i++) { const ground = lg[i].q !== lg[i + 1].p;
      out.push({ T: lg[i].b, code: lg[i].q, ti: ground ? `Self-transfer` : `Change in ${CITY[lg[i].q]}`, sb: ground ? `${lg[i].q} → ${lg[i + 1].p}, ${fmtDur(lg[i + 1].a - lg[i].b)} to make it` : `${fmtDur(lg[i + 1].a - lg[i].b)} between flights`,
        cls: ground || lg[i + 1].a - lg[i].b < .75 ? 'warn' : '', gap: `flight ${fmtDur(lg[i + 1].b - lg[i + 1].a)}` }); }
    return out; };
  st.push({ T: o.dep - BEFORE_DEP, code: o.from, ti: 'Leave for the airport', sb: TRIP.home.to_airport || `To ${o.from}`, gap: fmtDur(BEFORE_DEP) });
  st.push(...legsOf(o));
  st.push({ T: o.arr, code: o.to, ti: `Land in ${CITY[o.to]}`, sb: TRIP.destination.transfer || `To ${DEST_TOWN}`, gap: fmtDur(TO_VENUE) });
  const n = sel.moments.filter(Boolean).length, missed = MOMENTS.filter((m, j) => !sel.moments[j]).map((m) => m.name);
  st.push({ T: sel.arriveVenue, code: o.to, ti: `At ${TRIP.event ? EVENT_NAME : DEST_TOWN}`, sb: MOMENTS.length ? `${n} of ${MOMENTS.length} moments${missed.length ? ' · misses ' + missed.join(', ') : ', the full event'}` : (TRIP.destination.venue || ''), cls: 'event', gap: `${fmtDur(sel.leaveVenue - sel.arriveVenue)} in ${DEST_TOWN}` });
  st.push({ T: sel.leaveVenue, code: r.from, ti: `Leave for ${r.from}`, sb: earlyText(sel.leaveVenue, r.from) || TRIP.destination.to_airport || 'To the airport', gap: fmtDur(BEFORE_DEP) });
  st.push(...legsOf(r));
  st.push({ T: r.arr, code: r.to, ti: `Land in ${CITY[r.to]}`, sb: TRIP.home.from_airport || 'Home', gap: fmtDur(AFTER_ARR) });
  const back = r.arr + AFTER_ARR, wd = WORK.find((w) => back < w.e && back > w.s - 2);
  st.push({ T: back, code: r.to, ti: wd ? 'At your desk' : 'Home', sb: wd ? `${fmtDur(Math.max(0, back - wd.s))} after the day starts` : 'No work day lost on arrival' });
  el.innerHTML = `<div class="stations">${st.map((s, i) => { const a = at(s.T, s.code);
    return `<div class="st ${s.cls || ''}">${i < st.length - 1 && s.gap ? `<span class="gap">${s.gap} →</span>` : ''}<div class="day">${a.day}</div>
      <div class="tm">${a.tm}<span class="tz">${a.tz}</span></div><div class="ti">${s.ti}</div><div class="sb">${s.sb}</div></div>`; }).join('')}</div>
    <div class="foot"><span>Price <b>${money(sel.price)}</b> ${sel.deal ? `(${sel.deal.what})` : `(${sellerLine(sel)})`}</span>${WORK.length ? `<span>Work lost <b>${fmtDur(sel.lost)}</b>${state.remote ? ' with remote travel days' : ''}</span>` : ''}
      ${MOMENTS.length ? `<span>${EVENT_NAME} <b>${n} of ${MOMENTS.length}</b> moments</span>` : ''}<span>In the air <b>${fmtDur(d3.sum([...flightLegs(o), ...flightLegs(r)], (l) => l.b - l.a))}</b></span><span style="margin-left:auto;color:var(--muted)">Local times. ${tzNote()}</span></div>`;
}

// ---------- Order ----------
// Each direction is a separate one-way ticket bought from the airline. The agent opens your own browser, fills the trip and
// your saved details, and stops on the payment page so you confirm the purchase yourself.
const gfLink = (f) => 'https://www.google.com/travel/flights?q=' + encodeURIComponent(`Flights from ${f.from} to ${f.to} on ${f.depDate} one way ${carrier(f)} ${f.depT}${f.hub ? '' : ' nonstop'}`);
const PAX = TRIP.passengers || 1, paxText = `${PAX} adult${PAX > 1 ? 's' : ''}`;
const agentPrompt = (sel) => `Book my trip: ${TRIP.title}${TRIP.event ? ` (${EVENT_NAME})` : ''}, ${paxText}. Use my browser and stop on the payment page; do not pay.\n` +
  [sel.o, sel.r].map((f) => `- ${f.dir === 'out' ? 'Out' : 'Back'}: ${carrier(f)}${f.nums ? ' ' + f.nums : ''}, ${f.from} → ${f.to}, ${f.depDate} dep ${f.depT} local, arr ${f.arrD} ${f.arrT}${f.hub ? `, via ${f.hub}` : ', nonstop'}. Expected about ${money(f.price)} from ${f.offer.who}, one-way, economy${TRIP.booking_note ? `, ${TRIP.booking_note}` : ''}.`).join('\n') +
  (sel.deal ? `\nBook both directions together as: ${sel.deal.what}, expected ${money(sel.deal.price)}.` : '') +
  `\nBuy from the seller named above. Fill passenger details from my saved profile. If a price is more than 15% above the expected price, stop and tell me.`;
const sheetbg = document.getElementById('sheetbg'), checkoutEl = document.getElementById('checkout');
function openCheckout() {
  const sel = LE.sel;
  const ticket = (f) => `<div class="ticket"><div class="dir">${f.dir === 'out' ? 'OUT' : 'BACK'}</div>
    <div class="main">${f.depD} ${f.depN} ${f.depMon} · ${f.depT} → ${f.arrT}</div><div class="price">${sel.deal ? '<span style="font-size:12px;color:var(--muted)">in deal</span>' : money(f.price)}</div>
    <div class="meta">${carrier(f)}${f.nums ? ` ${f.nums}` : ''} · ${f.via.length ? `via ${f.via.map((v) => v.split('>').map((c) => CITY[c]).join(' → ')).join(', ')}` : 'nonstop'} · sold by <b>${sel.deal ? sel.deal.who : f.offer.who}</b> · <a href="${gfLink(f)}" target="_blank" rel="noopener">Google Flights</a></div></div>`;
  const kinds = sel.deal ? [sel.deal] : [sel.o.offer, sel.r.offer];
  const how = sel.deal ? `One booking: ${sel.deal.what}, ${money(sel.split - sel.price)} less than two one-way tickets.`
    : kinds.every((s) => s.kind === 'airline') ? `Two one-way tickets, bought on ${[...new Set([sel.o.al, sel.r.al])].map((k) => (AIRLINE[k] || k) + "'s").join(' and ')} own site${sel.o.al === sel.r.al ? '' : 's'}.`
    : `Two one-way tickets: ${kinds.map((s) => `${s.who} (${s.kind === 'airline' ? 'airline' : s.kind === 'self' ? 'self-transfer ticket' : 'travel agency'})`).join(' and ')}. A change or refund goes through the seller.`;
  checkoutEl.innerHTML = `<div class="eyebrow">Checkout</div><h2>${sel.o.depD} ${sel.o.depT} → ${sel.r.depD} ${sel.r.depT}</h2>
    <div class="sub">${[TRIP.event ? EVENT_NAME : TRIP.title, WORK.length ? `${fmtDur(sel.lost)} of work lost` : '', MOMENTS.length ? `${sel.moments.filter(Boolean).length} of ${MOMENTS.length} event moments` : ''].filter(Boolean).join(' · ')}</div>
    ${ticket(sel.o)}${ticket(sel.r)}
    <div class="total"><span>Total, ${paxText}</span><span>${money(sel.price)}</span></div>
    <div class="note">${how}${[sel.o, sel.r].filter((f) => f.warn).map((f) => ' ' + f.warn.text).join('')} Your agent opens your browser, fills the flights and your saved details, and stops on the payment page. You check the price and pay yourself. ${TRIP.prices_seen ? `Prices are from ${TRIP.prices_seen} and can change.` : 'Prices can change.'}</div>
    <div class="agent" id="agentlog" hidden></div>
    <div class="acts"><button class="ghost" id="cx">Cancel <kbd>Esc</kbd></button><button class="go" id="go">Check out with my agent</button></div>`;
  sheetbg.hidden = false; document.getElementById('go').focus();
  // A booking that is still open shows its progress again, also after a reload.
  const open = (OPEN_JOB && BOOK_TEXT[OPEN_JOB.status] && OPEN_JOB.id) || savedJob(); if (open) followCheckout(open);
  document.getElementById('cx').onclick = closeCheckout;
  document.getElementById('go').onclick = async (e) => {
    const b = e.currentTarget, text = agentPrompt(sel);
    // serve.py queues the request; an agent waiting on the queue wakes up and works it. With no server, copy the request instead.
    let id = null;
    const trip = { title: TRIP.title, currency: CUR, passengers: PAX, out: sel.o, back: sel.r, deal: sel.deal, price: sel.price, buy: state.buy };
    try { const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trip, prompt: text }) });
      if (r.ok) id = (await r.json()).id; } catch {}
    if (!id) { try { await navigator.clipboard.writeText(text); } catch {} b.textContent = 'No agent server. Copied the request instead'; return; }
    b.disabled = true; b.textContent = 'Sent to your agent'; saveJob(id); followCheckout(id);
  };
}
function closeCheckout() { sheetbg.hidden = true; clearTimeout(followTimer); }
// Show the agent's progress: each status it reports becomes a line, newest last.
let followTimer = null;
const STATUS_TEXT = { pending: 'Waiting for your agent', claimed: 'Picked up', working: 'Working', 'at-payment': 'At the payment page', booked: 'Paid', done: 'Done', failed: 'Stopped' };
const LAST_JOB = KEY + 'checkout-id';
// The newest booking on the server. While it waits on you or your agent, the postcard button says so.
let OPEN_JOB = null;
const BOOK_TEXT = { pending: 'Waiting for your agent', claimed: 'Your agent is booking', working: 'Your agent is working', 'at-payment': "At the payment page: I've paid", booked: 'Paid: your agent is doing the rest' };
function bookState() {
  const b = document.getElementById('book'); if (!b) return;
  const t = OPEN_JOB && BOOK_TEXT[OPEN_JOB.status];
  b.classList.toggle('busy', !!t); b.classList.toggle('pay', OPEN_JOB?.status === 'at-payment');
  b.querySelector('span').textContent = t || (drawerOpen ? 'Book these flights' : 'Next: choose your tickets');
  b.querySelector('b').innerHTML = drawerOpen ? money(LE.sel?.price ?? '') : '<svg class="arr" viewBox="0 0 14 14"><path d="M2 7h10M8 3l4 4-4 4"/></svg>';
}
async function pollJob() {
  try { const r = await fetch('/api/checkout/latest', { cache: 'no-store' }); OPEN_JOB = r.ok ? await r.json() : null; } catch { OPEN_JOB = null; }
  bookState(); setTimeout(pollJob, 5000);
}
pollJob();
const saveJob = (id) => { try { id ? localStorage.setItem(LAST_JOB, id) : localStorage.removeItem(LAST_JOB); } catch {} };
const savedJob = () => { try { return localStorage.getItem(LAST_JOB); } catch { return null; } };
async function followCheckout(id) {
  const el = document.getElementById('agentlog'); if (!el) return;
  el.hidden = false;
  let job = null;
  try { const r = await fetch('/api/checkout/' + id, { cache: 'no-store' }); if (r.ok) job = await r.json(); } catch {}
  if (job) el.innerHTML = job.log.map((l) => `<div class="${l.status}"><b>${STATUS_TEXT[l.status] || l.status}</b><span>${l.note.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</span>` +
    `<i>${new Date(l.at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</i></div>`).join('');
  // On the payment page only you can pay. When you have, this button wakes the agent for the after-booking work.
  if (job && (job.status === 'at-payment' || job.status === 'failed')) {
    el.insertAdjacentHTML('beforeend', `<button class="go paid" id="paid">I've paid. Do the rest</button>
      <p class="paidnote">Your agent adds the flights to your calendar, checks that the tickets are issued, and reminds you to check in.</p>`);
    document.getElementById('paid').onclick = async (e) => {
      e.currentTarget.disabled = true; e.currentTarget.textContent = 'Telling your agent';
      try { await fetch('/api/checkout/' + id + '/booked', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); } catch {}
      clearTimeout(followTimer); followCheckout(id);
    };
  }
  if (job && job.status === 'done') { saveJob(null); return; }
  if (job && job.status === 'failed') return;
  clearTimeout(followTimer); followTimer = setTimeout(() => followCheckout(id), job && job.status === 'at-payment' ? 4000 : 1500);
}
sheetbg.onclick = (e) => { if (e.target === sheetbg) closeCheckout(); };

addEventListener('keydown', (e) => {
  if (!sheetbg.hidden) { if (e.key === 'Escape') closeCheckout(); return; }
  if (e.key === 'b' || e.key === 'B') { openCheckout(); return; }
  const i = list.findIndex((c) => c.o.id === state.out && c.r.id === state.ret);
  if (e.key === 'j' || e.key === 'k') pickCombo(list[Math.max(0, Math.min(list.length - 1, (i < 0 ? 0 : i) + (e.key === 'j' ? 1 : -1)))]);
  if (e.key === 'Escape') pickCombo(list[0]);
  if (e.key === '0') resetMap();
  if (e.key === 'v' || e.key === 'V') setView(Object.keys(VIEWS)[(Object.keys(VIEWS).indexOf(state.view) + 1) % Object.keys(VIEWS).length]);
});

initTabs();

// ---------- One card: step 1 previews, step 2 chooses the tickets ----------
const hc = document.getElementById('hc');
let drawerOpen = store.get('drawer', false);
const setPad = () => { PAD.bottom = drawerOpen ? 470 : 60; PAD.right = drawerOpen ? 60 : 500; };
function setDrawer(on) {
  if (on === drawerOpen) return;
  const w1 = hc.offsetWidth, h1 = hc.offsetHeight;
  drawerOpen = on; store.set('drawer', on); hc.classList.toggle('open', on);
  // The timeline measures its box, so it draws the first time the card opens.
  if (on && !LE.g) initLedger();
  // The timeline measures its box, so it draws the first time the card opens.
  render(); if (on) renderView();
  const intro = document.body.classList.contains('intro');
  if (!REDUCED && !intro) {
    const ease = 'cubic-bezier(.22, 1, .36, 1)';
    hc.animate([{ width: w1 + 'px', height: h1 + 'px' }, { width: hc.offsetWidth + 'px', height: hc.offsetHeight + 'px' }], { duration: 520, easing: ease });
    if (on) document.getElementById('panel').animate([{ opacity: 0, translate: '-10px 0' }, { opacity: 1, translate: '0 0' }], { duration: 360, delay: 260, easing: ease, fill: 'backwards' });
    if (on) hc.querySelector('.ctl').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 200, fill: 'backwards' });
  }
  setPad();
  if (!intro) map.easeTo({ ...(MS.sel && map.getZoom() >= FAR ? viewOf([...stops(MS.sel.o), ...stops(MS.sel.r)].map((c) => AIRPORTS[c])) : {}), padding: { ...PAD }, duration: REDUCED ? 0 : 520, easing: (t) => 1 - Math.pow(1 - t, 3) });
}
document.getElementById('close2').onclick = () => setDrawer(false);
// The timeline draws to the size of its box. When the box settles at another size (fonts, the card's layout, a window resize), draw it again.
// The other views redraw too, so a view opened while the card grows ends at the right size.
const VS = { w: 0, h: 0 };
new ResizeObserver(() => {
  if (!drawerOpen) return;
  const r = document.querySelector('.views').getBoundingClientRect();
  if (Math.abs(r.height - VS.h) < 1 && Math.abs(r.width - VS.w) < 1) return;
  VS.w = r.width; VS.h = r.height;
  if (LE.g) { LE.g.selectAll('*').remove(); LE.g.on('pointermove', null).on('pointerleave', null); LE.g = null; initLedger(); }
  render();
}).observe(document.querySelector('.views'));
addEventListener('keydown', (e) => { if (e.key !== 'Escape' || !sheetbg.hidden || !drawerOpen) return; setDrawer(false); e.stopImmediatePropagation(); }, true);
addEventListener('keydown', (e) => { if ((e.key === 't' || e.key === 'T') && sheetbg.hidden && !e.metaKey && !e.ctrlKey) setDrawer(!drawerOpen); });
// The choices, as chips: what to optimise for, who may sell the tickets, and whether the travel days can be remote.
function controlsHTML() {
  const chip = (attr, k, label, on, help) => `<button class="chip2" ${attr}="${k}" aria-pressed="${on}" title="${help}">${label}</button>`;
  return `<div class="chips">${Object.entries(PRESETS).filter(([k]) => (k !== 'work' || WORK.length) && (k !== 'event' || MOMENTS.length)).map(([k, p]) => chip('data-priority', k, p.label, k === state.preset, PRESET_HELP[k])).join('')}</div>` +
    `<div class="chips">${[['airline', 'Airlines'], ['rated', '+ Good agencies'], ['any', 'Any seller']].map(([k, l]) => chip('data-buyfrom', k, l, k === state.buy, BUY[k].help)).join('')}` +
    `${WORK.length ? '<span class="sep"></span>' : ''}${WORK.length ? `<button class="chip2" data-remote2 role="switch" aria-checked="${state.remote}" title="${WK.remote_days ? `I can work remotely on ${WK.remote_days}` : 'I can work remotely on travel days'}"><span class="box"></span>Remote</button>` : ''}</div>`;
}
const PRESET_HELP = { balanced: 'A fair mix of price, travel time, lost work and event time.', cheap: 'The lowest price, almost no matter what.',
  work: 'Lose the fewest office hours.', event: `Be there for every part of ${EVENT_NAME}.` };
function wireControls(root) {
  root.querySelectorAll('[data-priority]').forEach((b) => b.onclick = () => { state.preset = b.dataset.priority; store.set('preset', state.preset); state.out = state.ret = null; render(); });
  root.querySelectorAll('[data-buyfrom]').forEach((b) => b.onclick = () => { state.buy = b.dataset.buyfrom; store.set('buy', state.buy); render(); });
  root.querySelectorAll('[data-remote2]').forEach((b) => b.onclick = (e) => { e.preventDefault(); toggleRemote(); });
}
hc.classList.toggle('open', drawerOpen); setPad();
if (drawerOpen) initLedger();
render(); if (drawerOpen) renderView();
drawMap();
