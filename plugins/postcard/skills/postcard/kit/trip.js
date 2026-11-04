// The trip model: trip.json in, plain objects with times in hours out.
// The schema is in references/trip-schema.md. Everything a page shows should come from here or from
// a pure model the page writes on top of it, so each number on the page has one source.
import { makeClock, fmtDur } from './time.js';

const rad = Math.PI / 180;
export const geo = {
  vec: ([lo, la]) => [Math.cos(la * rad) * Math.cos(lo * rad), Math.cos(la * rad) * Math.sin(lo * rad), Math.sin(la * rad)],
  // Great-circle angle in radians, and distance in km.
  ang(p, q) { const a = geo.vec(p), b = geo.vec(q); return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))); },
  km: (p, q) => geo.ang(p, q) * 6371,
  slerp(p, q, s) { const a = geo.vec(p), b = geo.vec(q), w = geo.ang(p, q); if (w < 1e-9) return [p[0], p[1]];
    const k1 = Math.sin((1 - s) * w) / Math.sin(w), k2 = Math.sin(s * w) / Math.sin(w), v = [0, 1, 2].map((i) => k1 * a[i] + k2 * b[i]);
    return [Math.atan2(v[1], v[0]) / rad, Math.asin(v[2]) / rad]; },
  heading(p, q) { const [l1, f1] = p.map((x) => x * rad), [l2, f2] = q.map((x) => x * rad);
    return Math.atan2(Math.sin(l2 - l1) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(l2 - l1)) / rad; },
  greatCircle(p, q, n = 64) { return Array.from({ length: n + 1 }, (_, i) => geo.slerp(p, q, i / n)); },
};

export const MODES = {
  plane: { verb: 'Flying', noun: 'flight', air: true },
  train: { verb: 'On the train', noun: 'train' },
  bus: { verb: 'On the bus', noun: 'bus' },
  coach: { verb: 'On the coach', noun: 'coach' },
  ferry: { verb: 'On the ferry', noun: 'ferry' },
  car: { verb: 'Driving', noun: 'drive' },
  taxi: { verb: 'In a taxi', noun: 'taxi' },
  walk: { verb: 'Walking', noun: 'walk' },
  mixed: { verb: 'Travelling', noun: 'journey' },
};

// Which sellers a person accepts. Pages show these as chips, or pick one and say so.
export const ACCEPT = {
  operator: { label: 'Operators', help: 'Only the airline, rail or ferry company itself. Changes and refunds go straight to them.',
    ok: (s) => s.kind === 'operator' },
  rated: { label: '+ Good agencies', help: 'Operators, plus agencies rated 4+ from 100+ reviews.',
    ok: (s) => s.kind === 'operator' || (s.kind === 'agency' && (s.stars ?? 0) >= 4 && (s.reviews ?? 0) >= 100) },
  any: { label: 'Any seller', help: 'Every seller, also low-rated agencies and self-transfer tickets.', ok: () => true },
};

export async function loadTrip(src = new URLSearchParams(location.search).get('trip') || 'trip.json') {
  const r = await fetch(src, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${src}: HTTP ${r.status}`);
  return { raw: await r.json(), base: new URL(src, location.href) };
}

// A segment path is inline [[lng, lat], ...] or a GeoJSON file relative to the trip.
async function readPath(p, base) {
  if (!p) return null;
  if (Array.isArray(p)) return p.map(([x, y]) => [x, y]);
  const gj = await fetch(new URL(p, base)).then((r) => r.json());
  const lines = [];
  const walk = (g) => { if (!g) return; if (g.type === 'FeatureCollection') g.features.forEach((f) => walk(f.geometry));
    else if (g.type === 'Feature') walk(g.geometry); else if (g.type === 'LineString') lines.push(g.coordinates);
    else if (g.type === 'MultiLineString') lines.push(...g.coordinates); };
  walk(gj);
  // Join the parts end to end; flip a part when its far end is the nearer one.
  const out = [];
  for (const l of lines) { if (!out.length) { out.push(...l); continue; }
    const last = out[out.length - 1], d0 = geo.km(last, l[0]), d1 = geo.km(last, l[l.length - 1]);
    out.push(...(d1 < d0 ? [...l].reverse() : l)); }
  return out.map(([x, y]) => [x, y]);
}

const pathKm = (path) => { let k = 0; for (let i = 1; i < path.length; i++) k += geo.km(path[i - 1], path[i]); return k; };

// Point and heading at fraction s (0-1) of the distance along a path.
export function along(path, s) {
  const total = pathKm(path); let want = Math.max(0, Math.min(1, s)) * total;
  for (let i = 1; i < path.length; i++) { const d = geo.km(path[i - 1], path[i]);
    if (want <= d || i === path.length - 1) { const f = d ? Math.min(1, want / d) : 0, pt = geo.slerp(path[i - 1], path[i], f);
      return { pt, head: geo.heading(path[i - 1], path[i]) }; }
    want -= d; }
  return { pt: path[0], head: 0 };
}

export async function openTrip({ raw, base }) {
  const clock = makeClock(raw.clock, raw.window.start);
  const T0 = clock.H(raw.window.start), T1 = clock.H(raw.window.end);
  const places = Object.fromEntries(Object.entries(raw.places).map(([id, p]) => [id, { ...p, id, label: p.city || p.name || id }]));
  const carriers = raw.carriers || {};
  const tzOf = (id) => places[id].tz;
  const offerOf = (s) => ({ ...s, kind: s.kind === 'airline' ? 'operator' : s.kind });

  const journeys = await Promise.all(raw.journeys.map(async (x) => {
    const segsRaw = x.segments?.length ? x.segments : [{ mode: x.mode, from: x.from, to: x.to, dep: x.dep, arr: x.arr, carrier: x.carrier, number: x.numbers, path: x.path }];
    const segments = await Promise.all(segsRaw.map(async (s) => {
      const mode = s.mode || x.mode, a = clock.H(s.dep, tzOf(s.from)), b = clock.H(s.arr, tzOf(s.to));
      let path = await readPath(s.path, base), guessed = false;
      const ends = [places[s.from].coord, places[s.to].coord];
      if (!path) { path = MODES[mode]?.air ? geo.greatCircle(...ends) : ends; guessed = !MODES[mode]?.air; }
      return { mode, from: s.from, to: s.to, a, b, carrier: s.carrier || x.carrier, number: s.number, path, guessed, km: pathKm(path), self: !!s.self_transfer };
    }));
    const dep = clock.H(x.dep, tzOf(x.from)), arr = clock.H(x.arr, tzOf(x.to));
    const j = { id: x.id, mode: x.mode, group: x.group, from: x.from, to: x.to, dep, arr,
      depL: clock.local(dep, tzOf(x.from)), arrL: clock.local(arr, tzOf(x.to)),
      carrier: x.carrier, carrierName: carriers[x.carrier] || x.carrier, numbers: x.numbers,
      self: !!x.self_transfer, warning: x.warning, bags: x.bags, notes: x.notes, raw: x,
      segments, offers: (x.offers || []).map(offerOf) };
    // Transfers between segments: time on the ground, and a change of place when the next one starts elsewhere.
    j.transfers = segments.slice(1).map((s, i) => ({ at: segments[i].to, next: s.from, a: segments[i].b, b: s.a, ground: segments[i].to !== s.from }));
    j.stops = [...new Set(segments.flatMap((s) => [s.from, s.to]))];
    j.moving = segments.reduce((h, s) => h + s.b - s.a, 0);
    return j;
  }));
  const byId = Object.fromEntries(journeys.map((j) => [j.id, j]));
  const groups = {};
  for (const j of journeys) (groups[j.group] ||= []).push(j);
  const deals = (raw.deals || []).map((d) => ({ ...offerOf(d), journeys: d.journeys || [d.out, d.back].filter(Boolean) }));

  // Offers --------------------------------------------------------------
  // The extra a fare costs for the bags you bring: { cabin: true, checked: 1 }. null when that fare cannot carry them.
  const bagExtra = (o, need) => {
    if (!need) return 0;
    const b = o.bags || {}; let extra = 0;
    const one = (v, n) => { if (!n) return 0; if (v === 'included') return 0; if (typeof v === 'number') return v * n; return v === 'none' ? null : undefined; };
    for (const [k, n] of [['cabin', need.cabin ? 1 : 0], ['checked', need.checked || 0]]) {
      const c = one(b[k], n); if (c === null) return null; if (c === undefined) return undefined; extra += c; }
    return extra;
  };
  // The cheapest accepted offer for a journey, with bags priced in when they are known.
  const best = (j, { accept = 'any', bags = null } = {}) => {
    let pick = null;
    for (const o of j.offers) { if (!ACCEPT[accept].ok(o)) continue;
      const extra = bagExtra(o, bags); if (extra === null) continue;
      const total = o.price + (extra || 0);
      if (!pick || total < pick.total) pick = { ...o, total, bagsKnown: extra !== undefined }; }
    return pick;
  };
  const dealFor = (ids, { accept = 'any' } = {}) => {
    const key = [...ids].sort().join('|');
    return deals.filter((d) => [...d.journeys].sort().join('|') === key && ACCEPT[accept].ok(d)).sort((a, b) => a.price - b.price)[0] || null;
  };
  // A set of journeys bought together: one per group, in order. A deal wins when it is cheaper.
  const price = (js, opts = {}) => {
    const each = js.map((j) => best(j, opts));
    if (each.some((o) => !o)) return null;
    const split = each.reduce((s, o) => s + o.total, 0), deal = dealFor(js.map((j) => j.id), opts);
    return deal && deal.price < split ? { total: deal.price, split, deal, each } : { total: split, split, deal: null, each };
  };
  // Every combination of one journey per listed group, kept when keep(js) is true.
  const combos = (groupNames, keep = () => true) => {
    let out = [[]];
    for (const g of groupNames) out = out.flatMap((c) => (groups[g] || []).filter((j) => !c.length || j.dep >= c[c.length - 1].arr).map((j) => [...c, j]));
    return out.filter(keep);
  };
  // Nights between arriving and leaving, by the local dates at the place you stay.
  const nights = (o, r) => Math.round((Date.parse(r.depL.date) - Date.parse(o.arrL.date)) / 86400000);

  // Where am I at T? -----------------------------------------------------
  // For a chain of journeys in time order. pt is [lng, lat]; seg and s say where on which segment.
  const whereAt = (chain, T) => {
    const name = (id) => places[id].label;
    for (const j of chain) {
      for (const seg of j.segments) if (T >= seg.a && T <= seg.b) {
        const s = seg.b > seg.a ? (T - seg.a) / (seg.b - seg.a) : 0, { pt, head } = along(seg.path, s);
        return { pt, head, moving: true, mode: seg.mode, seg, s, j, status: `${MODES[seg.mode]?.verb || 'Travelling'}${seg.carrier ? ', ' + (carriers[seg.carrier] || seg.carrier) : ''}` };
      }
      for (const t of j.transfers) if (T > t.a && T < t.b)
        return { pt: places[t.at].coord, place: t.at, j, status: t.ground ? `Change in ${name(t.at)}: ${t.at} → ${t.next}` : `Change in ${name(t.at)}, ${fmtDur(t.b - t.a)}` };
    }
    const first = chain[0], last = chain[chain.length - 1];
    if (T < first.dep) return { pt: places[first.from].coord, place: first.from, status: `In ${name(first.from)}` };
    if (T > last.arr) return { pt: places[last.to].coord, place: last.to, status: `In ${name(last.to)}` };
    const prev = [...chain].reverse().find((j) => j.arr <= T);
    return { pt: places[prev.to].coord, place: prev.to, status: `In ${name(prev.to)}` };
  };

  return { raw, base, clock, T0, T1, places, carriers, journeys, byId, groups, deals, best, bagExtra, dealFor, price, combos, nights, whereAt,
    currency: raw.currency || 'EUR', money: (n) => n == null ? '–' : `${raw.currency || 'EUR'} ${Math.round(n).toLocaleString('en')}` };
}
