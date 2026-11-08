// Mix: Stories is the structure, Editorial is the cover, Poster sets the numerals. The first card is the
// cover: the whole loop full-bleed, the red title and a strip with the legs, nights, total and Book; a part
// of the strip jumps to its card. Then one card per leg and per stay, each on the full-bleed map: the camera
// frames the leg or the city, and the headline, facts and controls sit over a paper fade at the bottom left
// (centred at the bottom on a phone). A stay's nights are a big grotesk numeral that rolls. After the last
// leg the story closes on the cover again. The cover is home: a part of its strip, or a part of the route on
// the map, opens that part's card, where the way or the nights change. No vehicle rides the map: a leg card
// draws its line from start to end, and a way tile shows its vehicle as a small live 3D model on hover.
// The model (ways per leg, hours lost, nights, the bill) and the store are the ones in v-editorial.js.
// Everything about the trip comes from trip.json: the legs, the stays, the people, the dates and the names
// (references/trip-schema.md, "Keys of a trip of several legs"). It works for N legs with N - 1 stays.
import { loadTrip, openTrip, geo } from '/kit/trip.js';
import { fmtDur } from '/kit/time.js';
import { createChart, INK, PAPER, LAND, RED } from '/kit/chart.js';
import { checkout, BUSY_TEXT } from '/kit/checkout.js';
import { esc, store } from '/kit/parts.js';
import { bill, fare } from '/kit/bill.js';

const T = await openTrip(await loadTrip());
document.title = T.raw.title || document.title;
const X = T.raw.context || {}, EST = X.estimates || {}, P = T.places;
// The weights of the hours lost; the defaults hold when trip.json leaves one out.
const WT = { change_h: 1, night_seat_h: 3, bed_night: ['23:00', '07:00'], ...X.weights };
// The trip is read from trip.json, so this page works for any trip of N legs with N - 1 stays between them.
// The legs: context.order (a list of group ids), else the journey groups by their first departure.
const firstDep = (g) => d3.min(T.groups[g], (j) => j.dep);
const GROUPS = (X.order || Object.keys(T.groups).sort((a, b) => firstDep(a) - firstDep(b))).filter((g) => T.groups[g]?.length);
const N = GROUPS.length;
// The stays: the cities in context.stays, else the city each leg ends in.
const STAYS = X.stays?.length === N - 1 ? X.stays.map((s) => s.city) : GROUPS.slice(0, -1).map((g) => P[T.groups[g][0].to].label);
const pax = T.raw.passengers || {}, PAX = (pax.adults || 1) + (pax.children || 0);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const PAX_TXT = [plural(pax.adults || 1, 'adult'), pax.children ? plural(pax.children, 'child', 'children') : ''].filter(Boolean).join(', ');
// The weight of an hour for the break-even fares. Without it the page shows no break-even.
const HOUR = EST.hour_value?.value ?? null;
const CUR = T.currency, SIGN = { EUR: '€', GBP: '£', USD: '$' }[CUR] ?? CUR + ' ';
const phone = () => innerWidth < 760;
const db = store(T.raw.id);
// The map names a place by its city (Oslo, not Oslo ferry terminal (Akershusstranda)). The chart reads
// place.name, so this page sets it to the city and keeps the full names for its own words.
const FULL = Object.fromEntries(Object.entries(T.places).map(([id, p]) => [id, p.name]));
for (const p of Object.values(T.places)) p.name = p.label;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('reduced') === '1';
const EASE = 'cubic-bezier(.22, 1, .36, 1)';

// ---------- Model (from v-editorial.js) ----------
const dayIso = (iso, n) => { const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)); return d.toISOString().slice(0, 10); };
const [N0, N1] = WT.bed_night;
function nightHours(j) {
  let h = 0;
  for (let d = dayIso(j.depL.date, -1); d <= j.arrL.date; d = dayIso(d, 1)) {
    const a = T.clock.H(`${d}T${N0}`), b = T.clock.H(`${dayIso(d, 1)}T${N1}`);
    h += Math.max(0, Math.min(b, j.arr) - Math.max(a, j.dep));
  }
  return h;
}
const rides = (j) => j.segments.filter((s) => s.mode !== 'walk');
const changes = (j) => j.raw.transfers ?? Math.max(0, rides(j).length - 1);
const offerOf = (j) => T.best(j);
const bed = (j) => (j.mode === 'ferry' && /cabin included/i.test(offerOf(j)?.fare || '')) || ['sleeper', 'couchette'].includes(j.raw.berth);
const overnight = (j) => !!j.raw.overnight || nightHours(j) > 2;
const nightTrainUnknown = (j) => overnight(j) && !bed(j) && j.raw.berth === 'unknown' && rides(j).some((s) => s.mode === 'train' && s.b - s.a > 5);
function lostOf(j, withBed = bed(j)) {
  const night = nightHours(j);
  return (j.arr - j.dep) - (withBed ? night : 0) + changes(j) * WT.change_h + (overnight(j) && !withBed ? WT.night_seat_h : 0);
}
function wayOf(j) {
  const o = offerOf(j);
  return { j, id: j.base || j.id, lost: lostOf(j), price: o ? o.total : null, offer: o, read: !!o, moved: !!j.shifted };
}
function breakEven(w, ways) {
  if (w.read || HOUR == null) return null;
  const ref = ways.filter((x) => x.read).sort((a, b) => (a.price + HOUR * a.lost) - (b.price + HOUR * b.lost))[0];
  if (!ref || w.lost >= ref.lost) return null;
  return { fare: Math.floor(ref.price + HOUR * (ref.lost - w.lost)), ref, approx: ref.moved };
}
const nightsAt = (legs) => legs.slice(0, -1).map((j, i) => T.nights(j, legs[i + 1]));
function valid(legs) {
  for (let i = 0; i < N - 1; i++) if (legs[i].arr > legs[i + 1].dep || T.nights(legs[i], legs[i + 1]) < 1) return false;
  return legs[N - 1].arr < T.T1;
}
// Days count from the first departure (the first leg never moves) to the last arrival.
const dayOf = (legs, date) => Math.round((Date.parse(date) - Date.parse(legs[0].depL.date)) / 864e5) + 1;
const daysOf = (legs) => dayOf(legs, legs[N - 1].arrL.date);

// The seller's shop domain for the checkout (context.shops: { seller: domain }).
const SHOP = X.shops || {};
const fdate = (iso) => { const l = T.clock.local(T.clock.H(iso)); return `${l.wd} ${l.day} ${l.mon}`; };
function billOf(legs) {
  const parts = [];
  legs.forEach((j, i) => {
    const o = offerOf(j), ticket = 'leg' + (i + 1);
    if (o) {
      const off = j.shifted ? { ...o, limit: [o.limit, `price and times read for ${fdate(o.read_for)}`].filter(Boolean).join('; ') } : o;
      parts.push(...fare(T, j, off, { checked: PAX }, { ticket, shop: SHOP[o.seller] }));
    } else parts.push(...fare(T, j, { seller: j.carrierName }, {}, { ticket }));
  });
  if (EST.train_luggage && legs.some((j) => rides(j).some((s) => s.mode === 'train')))
    parts.push({ what: 'luggage on the trains', kind: 'luggage', amount: EST.train_luggage.value ?? 0, state: 'estimate', basis: EST.train_luggage.basis, who: 'none' });
  const n = nightsAt(legs).reduce((a, b) => a + b, 0);
  if (n) parts.push({ what: plural(n, 'hotel night'), kind: 'hotel', amount: null, basis: 'hotels not searched', who: 'out' });
  return bill(T, parts);
}

// ---------- Words (from v-editorial.js) ----------
const MODE = (j) => {
  const ms = [...new Set(rides(j).map((s) => s.mode))];
  if (j.mode === 'ferry') return 'Ferry';
  if (ms.length > 1) return ms.join(' + ').replace(/^./, (c) => c.toUpperCase());
  const night = overnight(j) ? 'Night ' : '';
  return night ? night + ms[0] : ms[0][0].toUpperCase() + ms[0].slice(1);
};
// A carrier's name in a tight space: context.carriers_short, else the trip's carriers, else the raw name.
const SHORT = X.carriers_short || {};
const shortName = (c) => SHORT[c] || T.carriers[c] || c;
function who(j) {
  const cs = [...new Set(rides(j).map((s) => s.number?.startsWith('ICE') ? 'DB ICE' : shortName(s.carrier)))];
  return cs.length > 1 ? `${cs[0]} +${cs.length - 1}` : cs[0];
}
const plusN = (j) => Math.round((Date.parse(j.arrL.date) - Date.parse(j.depL.date)) / 864e5);
// A schedule read for another date ("transitous, proxy date 2026-12-08"): the times come from that date.
const proxyOf = (j) => j.raw.schedule_source?.match(/proxy date (\d{4}-\d\d-\d\d)/)?.[1];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthOf = (iso, short) => { const m = MONTHS[+iso.slice(5, 7) - 1]; return `${short ? m.slice(0, 3) : m} ${iso.slice(0, 4)}`; };
// "December 2026" for the proxy dates of these legs, and "May 2027" for the days they stand for.
const proxyMonths = (legs, short) => [...new Set(legs.filter(proxyOf).map((j) => monthOf(proxyOf(j), short)))].join(' and ');
const tripMonths = (legs) => [...new Set(legs.filter(proxyOf).map((j) => monthOf(j.depL.date)))].join(' and ');
const via = (j) => { const rs = rides(j); return rs.length > 1 ? 'Via ' + [...new Set(rs.slice(1).map((s) => P[s.from].label))].join(', ') : 'Direct'; };
// The main station of a city (context.main_stations: { city: place id }), to say how far another stop is.
const MAIN = X.main_stations || {};
const far = (id) => { const m = MAIN[P[id].label]; if (!m || m === id || !P[m]) return ''; const k = geo.km(P[id].coord, P[m].coord); return k >= 2 ? `${P[id].code || FULL[id]}, ${Math.round(k)} km from ${FULL[m]}` : ''; };
const fareTxt = (w) => `${w.moved ? '≈ ' : ''}${/from/.test(w.offer.limit || '') ? 'from ' : ''}${Math.round(w.price)}`;
// Who a fare is for: "for both" for two people.
const FOR_ALL = PAX === 1 ? '' : PAX === 2 ? ' for both' : ` for all ${PAX}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// The longer facts of a way: the facts line's tooltip and its screen-reader text.
function detail(w, ways) {
  const j = w.j, be = breakEven(w, ways), xs = [];
  // A ferry has no changes to name; its fare's limit says more.
  if (j.mode === 'ferry' && w.offer?.limit) xs.push(cap(w.offer.limit) + '.');
  else xs.push(via(j) + '.');
  if (nightTrainUnknown(j)) xs.push(`Seat or bed not read; with a bed, ${fmtDur(lostOf(j, true))} lost.`);
  else if (overnight(j) && !bed(j)) xs.push('A night sitting up.');
  for (const id of [j.from, j.to]) { const f = far(id); if (f) xs.push(f + '.'); }
  if (proxyOf(j)) xs.push(`Times from ${monthOf(proxyOf(j), true)}.`);
  if (j.shifted) xs.push(`Read for ${fdate(T.byId[j.base].raw.dep.slice(0, 10))}.`);
  if (!w.read) xs.push(be ? `Fare not read; better below ${be.approx ? '≈ ' : ''}${CUR} ${be.fare}${FOR_ALL}.` : 'Fare not read.');
  return xs.join(' ');
}

// ---------- Icons ----------
const svg = (d, vb = 16) => `<svg viewBox="0 0 ${vb} ${vb}" aria-hidden="true">${d}</svg>`;
const ICON = {
  train: svg('<path d="M5 2.5h6a2 2 0 0 1 2 2V10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2zM3 7.5h10M5.5 14.5l1-2.5M10.5 14.5l-1-2.5"/>'),
  bus: svg('<rect x="2.5" y="2.5" width="11" height="9.5" rx="1.8"/><path d="M2.5 7.5h11M4.8 12v2M11.2 12v2"/>'),
  ferry: svg('<path d="M1.8 9.8h12.4l-2.1 3.7H3.9zM4.6 9.8V6.8h6.8v3M7 6.8V4.3h2.2v2.5"/>'),
  plane: svg('<path d="M8 1.8c.7 0 1.1.8 1.1 1.8v3.2l4.6 2.6v1.5L9.1 9.6v2.6l1.6 1.2v1.2L8 13.8l-2.7.8v-1.2l1.6-1.2V9.6L2.3 10.9V9.4l4.6-2.6V3.6c0-1 .4-1.8 1.1-1.8z"/>'),
  car: svg('<path d="M2.5 10.5V8.2l1.4-3.4c.2-.5.7-.8 1.2-.8h5.8c.5 0 1 .3 1.2.8l1.4 3.4v2.3zM2.5 8.2h11M4.5 10.5v1.8M11.5 10.5v1.8"/>'),
  x: svg('<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>'),
  grid: svg('<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>'),
  pause: svg('<path d="M5.5 3v10M10.5 3v10"/>'),
  play: svg('<path d="M5 2.8v10.4L13 8z"/>'),
  prev: svg('<path d="M10 3 5 8l5 5"/>'),
  next: svg('<path d="M6 3l5 5-5 5"/>'),
  moon: svg('<path d="M12.6 10.4A5.4 5.4 0 0 1 5.6 3.4a5.4 5.4 0 1 0 7 7z"/>'),
};
// The icon of a way: its longest ride's mode.
const modeOf = (j) => { if (j.mode === 'ferry') return 'ferry'; const m = d3.greatest(rides(j), (s) => s.b - s.a)?.mode;
  return m === 'plane' ? 'plane' : m === 'bus' || m === 'coach' ? 'bus' : m === 'car' || m === 'taxi' ? 'car' : 'train'; };
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];

// ---------- State (the store of v-editorial.js) ----------
// The first pick of a leg: the way the person asked for (context.default_picks: { group: journey id }),
// else the way that loses the fewest hours.
const ASKED = X.default_picks || {};
const ranked = (ways) => [...ways].sort((a, b) => a.lost - b.lost || a.j.dep - b.j.dep);
let TOP = GROUPS.map((g) => T.byId[ASKED[g]]?.group === g ? ASKED[g] : ranked(T.groups[g].map(wayOf))[0].id);
// When those ways do not fit together (a leg leaves before the one before arrives), take the chain that fits
// and loses the fewest hours.
if (!valid(TOP.map((id) => T.byId[id]))) {
  const fit = d3.least(T.combos(GROUPS, valid), (js) => d3.sum(js, lostOf));
  if (fit) TOP = fit.map((j) => j.id);
}
const ZERO = Array(N - 1).fill(0);
const okPicks = (v) => Array.isArray(v) && v.length === N && v.every((id, i) => T.byId[id]?.group === GROUPS[i]);
const okDelta = (v) => Array.isArray(v) && v.length === N - 1 && v.every((n) => Number.isInteger(n) && Math.abs(n) <= 6);
const state = { picks: db.get('picks', TOP, okPicks), delta: db.get('delta', [...ZERO], okDelta) };
const save = () => { db.set('picks', state.picks); db.set('delta', state.delta); };
const shiftOf = (i) => state.delta.slice(0, i).reduce((a, b) => a + b, 0);
const cache = new Map();
const moved = (j, d) => { if (!d) return Promise.resolve(j); const k = j.id + '@' + d; if (!cache.has(k)) cache.set(k, T.shift(j, d)); return cache.get(k); };

let M = null, seq = 0;
async function model() {
  const legsJ = await Promise.all(GROUPS.map((g, i) => Promise.all(T.groups[g].map((j) => moved(j, shiftOf(i))))));
  const ways = legsJ.map((js) => ranked(js.map(wayOf)));
  const picks = ways.map((ws, i) => ws.find((w) => w.id === state.picks[i]) || ws.find((w) => w.id === TOP[i]));
  const legs = picks.map((w) => w.j);
  if (!valid(legs)) { state.picks = [...TOP]; state.delta = [...ZERO]; save(); return model(); }
  const can = ways.map((ws, i) => new Map(ws.map((w) => { const l = [...legs]; l[i] = w.j; return [w.id, valid(l)]; })));
  return { ways, picks, legs, can, b: billOf(legs), nights: nightsAt(legs), days: daysOf(legs) };
}
// The total is true: the read fares, "from" and "≈" as the bill says, and how many fares it leaves out.
// With no fare read it shows a dash, never 0.
function totals() {
  const bk = M.b.book, read = bk.parts.some((p) => p.kind === 'fare' && p.amount != null), miss = bk.missing();
  const fig = read ? bk.figure() : '–';
  // The strip says how many fares are not read; their names are in its title and in the checkout.
  const nm = bk.unknown.length || miss.length;
  const tail = !miss.length ? '' : (read ? '+ ' : '') + (read ? `${nm} fare${nm === 1 ? '' : 's'} not read` : `${nm} not read`);
  return { fig, tail, read, text: read ? bk.text({ max: 3 }) : miss.join(' + ') };
}

// ---------- Cards ----------
// Cover, then leg, stay, leg, stay, ... leg. After the last leg the story closes on the cover.
const CARDS = [{ k: 'cover' }].concat(GROUPS.flatMap((_, i) => i < N - 1 ? [{ k: 'leg', i }, { k: 'stay', i }] : [{ k: 'leg', i }]));
const LAST = CARDS.length - 1;
const legCard = (i) => 1 + 2 * i, stayCard = (i) => 2 + 2 * i;
// How long a card plays: the cover holds a moment, a leg holds while its line draws and a little after, a stay is a pause between legs.
const PLAY = { cover: 5200, leg: 6500, stay: 5200 };
const hoursOf = (c) => c.k === 'leg' ? M.legs[c.i].arr - M.legs[c.i].dep : c.k === 'stay' ? M.legs[c.i + 1].dep - M.legs[c.i].arr : 8;
const stayAt = (i) => M.legs[i].to;
// The stops of the trip in order: the start and each stay, then the end when it is not back at the start.
function stops(legs) {
  const s = [legs[0].from, ...legs.slice(0, -1).map((j) => j.to)], end = legs[N - 1].to;
  return P[end].label === P[s[0]].label ? s : [...s, end];
}
// The places the map labels big: the stops, one per city.
const endsOf = (legs) => stops(legs).filter((id, n, a) => a.findIndex((x) => P[x].label === P[id].label) === n);
const isLoop = (legs) => N > 1 && P[legs[N - 1].to].label === P[legs[0].from].label;

const $ = (id) => document.getElementById(id);
const win = $('win'), head = $('head'), body = $('body'), top = $('top'), segs = $('segs'), stamp = $('stamp');
const story = { cur: 0, playing: false, held: new Set(), t: 0, ride: 0, started: false };

// The camera: each card frames its part of the trip, and the person can drag the map and zoom it (wheel,
// pinch, double click, keys) to look around; the bearing and the pitch stay the camera's. The next card
// flies to its own frame again. The route stays clear of the title and strip on the cover, of the top bar,
// and of the overlay: beside it on a wide screen, above it on a phone.
const padFor = () => {
  const c = CARDS[story.cur].k;
  if (c === 'cover') {
    const side = phone() ? 18 : 80, top0 = Math.round(head.offsetTop + head.offsetHeight + (phone() ? 18 : 28)), bottom = Math.round(body.offsetHeight + 16);
    return { left: side, right: side, top: top0, bottom };
  }
  const tb = Math.round(top.offsetHeight - 8);
  if (phone()) return { left: 22, right: 22, top: tb, bottom: Math.round(body.offsetHeight + 62) };
  return { left: Math.round(body.offsetLeft + body.offsetWidth + 48), right: 96, top: tb + 16, bottom: Math.round(innerHeight - top.offsetHeight > 640 ? 64 : 40) };
};
const chart = createChart({ el: '#map', trip: T, pad: { left: 80, right: 80, top: 220, bottom: 120 }, far: phone() ? 1.6 : 2.6, routeCard: false, onReady: () => ready() });
const map = chart.map;
// The page draws no vehicle on the map: the line draws itself instead.
chart.where(null);
for (const h of ['boxZoom', 'dragRotate', 'touchPitch']) map[h]?.disable();
for (const h of ['dragPan', 'scrollZoom', 'keyboard', 'doubleClickZoom', 'touchZoomRotate']) map[h]?.enable();
map.touchZoomRotate.disableRotation(); map.keyboard.disableRotation?.();
// A hand on the map (drag, wheel, pinch, keys) takes the camera: the card's fit check and drift stop, so
// the camera never pulls against it. A new card flies to its frame again.
const byHand = () => { camTok++; };
map.on('dragstart', byHand); map.on('wheel', byHand); map.on('touchstart', byHand);
map.on('movestart', (e) => { if (e.originalEvent) byHand(); });
// A drag is not a click: the press that started it does not open a card.
let dragged = false;
map.on('dragstart', () => { dragged = true; });

const pointsOf = (js) => js.flatMap((j) => j.segments.flatMap((s) => [s.path[0], s.path[Math.floor(s.path.length / 2)], s.path[s.path.length - 1]]));
// The camera keeps one bearing on every card and a low pitch that rises a little from the cover to a leg
// to a city, so it never turns and never tilts much. It flies slowly (2.6 s, a low arc), and while a card
// holds it drifts in a very little (0.08 zoom and 1.5 degrees of pitch over the card's time).
const PITCH = { cover: 30, leg: 36, stay: 44 }, PITCH_PHONE = { cover: 12, leg: 18, stay: 30 };
const FLY = 2600;
const easeIO3 = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function viewFor(c, extra = []) {
  const pitch = (phone() ? PITCH_PHONE : PITCH)[c.k];
  if (c.k === 'leg') { const pts = pointsOf([M.legs[c.i]]).concat(extra); return { pts, view: { ...chart.viewOf(pts), pitch } }; }
  if (c.k === 'stay') {
    // The city and the near ends of its two legs (the station in and the station out), at a city view.
    const a = M.legs[c.i].segments.at(-1).path, b = M.legs[c.i + 1].segments[0].path, pts = [P[stayAt(c.i)].coord, a.at(-1), b[0]];
    return { pts, view: { ...chart.viewOf(pts, { maxZoom: 8.6 }), pitch } };
  }
  const pts = pointsOf(M.legs); return { pts, view: { ...chart.viewOf(pts), pitch } };
}
// chart.frame checks the fit on the next moveend, which an interrupted flight also fires. Cards change
// fast, so each flight here has a token, and only the last one checks its fit and then drifts.
let camTok = 0;
// ease: a short glide with no arc (for a frame that changes on the same card); extra: more points to hold.
function aim(dur = FLY, { ease = false, extra = [], drift = true } = {}) {
  const pad = padFor(); Object.assign(chart.PAD, pad);
  const c = CARDS[story.cur], { pts, view } = viewFor(c, extra), tok = ++camTok, d = REDUCED ? 0 : dur;
  const still = () => {
    if (tok !== camTok || REDUCED || !drift || CARDS[story.cur] !== c) return;
    map.easeTo({ zoom: map.getZoom() + .08, pitch: Math.min(60, map.getPitch() + 1.5), padding: { ...pad }, duration: PLAY[c.k] * 1.3, easing: (t) => t });
  };
  const check = () => {
    if (tok !== camTok || map.isMoving()) return;
    const W = innerWidth, H = innerHeight, cx = pad.left + (W - pad.left - pad.right) / 2, cy = pad.top + (H - pad.top - pad.bottom) / 2;
    const hw = Math.max(40, (W - pad.left - pad.right) / 2 - 10), hh = Math.max(40, (H - pad.top - pad.bottom) / 2 - 10);
    const need = d3.max(pts, (p) => { const s = map.project(p); return Math.max(Math.abs(s.x - cx) / hw, Math.abs(s.y - cy) / hh); });
    const settled = () => { if (tok !== camTok) return; still(); };
    if (need > 1) { map.easeTo({ zoom: map.getZoom() - Math.log2(need) - .05, padding: { ...pad }, duration: d ? 600 : 0, easing: easeIO3 }); if (d) map.once('moveend', () => setTimeout(settled, 0)); else settled(); }
    else settled();
  };
  if (ease) map.easeTo({ ...view, padding: { ...pad }, duration: d, easing: easeIO3, essential: true });
  else map.flyTo({ ...view, padding: { ...pad }, duration: d, curve: 1.1, essential: true, easing: easeIO3 });
  if (d) map.once('moveend', check); else requestAnimationFrame(check);
}

// What the map shows for a card: a leg alone with its other ways dashed; a stay with the legs in and out;
// the cover with the whole loop.
function showMap() {
  const c = CARDS[story.cur];
  // While a leg draws itself, the chart leaves its line out; the chart's line comes back when the draw ends.
  if (c.k === 'leg') { const j = M.legs[c.i]; chart.show({ chosen: draw.id === j.id ? [] : [j], others: M.ways[c.i].filter((w) => w !== M.picks[c.i]).map((w) => w.j), ends: [j.from, j.to], refit: false }); }
  else if (c.k === 'stay') chart.show({ chosen: [M.legs[c.i], M.legs[c.i + 1]], others: [], ends: [stayAt(c.i)], refit: false, legNumbers: false });
  else chart.show({ chosen: M.legs, others: [], ends: endsOf(M.legs), refit: false });
  scr = null;
}

// ---------- Drawing ----------
// The script word sits across the two lines when it is short ("to", "in"); a longer one ("home to") takes a line of its own.
const hl = (a, mid, b, one) => `<h2 class="hl${one || mid.length > 3 ? ' one' : ''}">${a ? `<span data-a>${esc(a)}</span>` : ''}<em data-a>${esc(mid)}</em><span data-a>${esc(b)}</span></h2>`;
// The last leg of a loop goes "home to" the start.
const legTitle = (i) => { const j = M.legs[i]; return [j.mode === 'ferry' && overnight(j) ? 'Night ferry' : MODE(j), i === N - 1 && isLoop(M.legs) ? 'home to' : 'to', P[j.to].label]; };
// A fare on a tile: the bill's "from" and "≈", with the currency sign. An unread fare is a grey dash.
const euro = (w) => `${w.moved ? '≈ ' : ''}${/from/.test(w.offer.limit || '') ? 'from ' : ''}${SIGN}${Math.round(w.price)}`;
const timeTxt = (j) => { const n = plusN(j); return `${j.depL.hm} → ${j.arrL.hm}${n ? `<sup>+${n}</sup>` : ''}`; };
const legFacts = (j) => `${esc(who(j))} · ${timeTxt(j)} · ${fmtDur(j.arr - j.dep)}`;
// "15–24 May", "30 Apr – 3 May", or "28 Dec 2026 – 2 Jan"; the caller adds the last year.
const span = (a, b) => a.date === b.date ? `${b.day} ${b.mon}` : a.mon === b.mon && a.year === b.year ? `${a.day}–${b.day} ${b.mon}`
  : `${a.day} ${a.mon}${a.year === b.year ? '' : ' ' + a.year} – ${b.day} ${b.mon}`;
// The same with weekdays, for the checkout: "Sat 15 → Mon 24 May 2027".
const wdSpan = (a, b, to = '→') => a.date === b.date ? `${a.wd} ${a.day} ${a.mon} ${a.year}` : a.mon === b.mon && a.year === b.year ? `${a.wd} ${a.day} ${to} ${b.wd} ${b.day} ${b.mon} ${b.year}`
  : `${a.wd} ${a.day} ${a.mon}${a.year === b.year ? '' : ' ' + a.year} ${to} ${b.wd} ${b.day} ${b.mon} ${b.year}`;
const dates = () => span(M.legs[0].depL, M.legs[N - 1].arrL);
// The route in words: "Oslo → Copenhagen → Hamburg → Berlin → Oslo".
const route = (legs) => [legs[0].from, ...legs.map((j) => j.to)].map((id) => P[id].label).join(' → ');
// A night count in the strip is as big as its number of nights.
const nightFs = (n) => `${Math.min(30, 12 + n * 3.5)}px`;
// The cover headline, in three parts around a script word: context.headline ([a, word, b] or one line), else
// "Four cities in ten days" from the data. A single leg reads "Oslo to Copenhagen".
const numWord = (n) => NUM[n] || String(n);
function headline() {
  const h = X.headline;
  if (Array.isArray(h) && h.length === 3) return h;
  if (typeof h === 'string' && h) return [h, '', ''];
  if (N === 1) return [P[M.legs[0].from].label, 'to', P[M.legs[0].to].label];
  const cities = new Set(stops(M.legs).map((id) => P[id].label)).size;
  return [cap(numWord(cities)) + ' cities', 'in', `${numWord(M.days)} ${M.days === 1 ? 'day' : 'days'}`];
}
const headHTML = ([a, mid, b], tag) => { const t = (x) => !x ? '' : tag ? `<${tag}>${esc(x)}</${tag}>` : esc(x); return `${t(a)}${mid ? `<em>${esc(mid)}</em>` : ''}${t(b)}`; };

function drawHead() {
  $('title').innerHTML = headHTML(headline(), 'span');
  $('dek').textContent = `${dates()} ${M.legs[N - 1].arrL.year} · ${PAX_TXT}`;
}

// A night numeral and its count, read before a redraw, so the new one can roll from it.
const numOf = (root) => { const e = root.querySelector('.num'); return e && { i: +e.dataset.i, n: +e.dataset.n }; };
// The numeral rolls like a counter: up for more nights, down for fewer (Poster).
function roll(root, was) {
  const out = root.querySelector('.num'); if (!out || !was || REDUCED) return;
  const n = +out.dataset.n; if (was.i !== +out.dataset.i || was.n === n) return;
  const s = Math.sign(n - was.n), old = document.createElement('span');
  old.textContent = was.n; old.setAttribute('aria-hidden', 'true'); out.prepend(old);
  const o = { duration: 420, easing: EASE };
  old.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${-s * 105}%)`, opacity: 0 }], { ...o, fill: 'forwards' }).onfinish = () => old.remove();
  out.lastElementChild.animate([{ transform: `translateY(${s * 105}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], o);
}
const stepsHTML = (i, n) => { const canDown = n > 1, canUp = M.legs[N - 1].arr + 24 < T.T1;
  return `<button class="step" data-key="s-" data-d="-1" ${canDown ? '' : 'aria-disabled="true"'} aria-label="One night less in ${STAYS[i]}">−</button>
    <output class="num" data-i="${i}" data-n="${n}" aria-live="polite" aria-label="${n} night${n === 1 ? '' : 's'} in ${STAYS[i]}"><span>${n}</span></output>
    <button class="step" data-key="s+" data-d="1" ${canUp ? '' : 'aria-disabled="true" title="No day left: take a night from another city first"'} aria-label="One night more in ${STAYS[i]}">+</button>`; };

// No landmarks for now: this call turns the chart's own zoom-based landmarks off too.
chart.landmark(null);
// An old link may still carry ?lm= or ?bar=.
{ const u = new URL(location.href); if (u.searchParams.has('lm') || u.searchParams.has('bar')) { u.searchParams.delete('lm'); u.searchParams.delete('bar'); history.replaceState(null, '', u); } }

function drawBody(dir = 0) {
  const c = CARDS[story.cur];
  win.dataset.k = c.k;
  // The map hides its labels under the cover title only while the title shows.
  head.classList.toggle('pc-title', c.k === 'cover');
  head.inert = c.k !== 'cover'; head.setAttribute('aria-hidden', c.k !== 'cover');
  const focusKey = document.activeElement?.dataset?.key;
  const was = numOf(body);
  if (c.k === 'leg') {
    const i = c.i, ways = M.ways[i], pick = M.picks[i], [a, mid, b] = legTitle(i);
    // The tiles stand in time order, as a departures board does.
    const tiles = [...ways].sort((x, y) => x.j.dep - y.j.dep).map((w) => {
      const j = w.j, sel = w === pick, ok = M.can[i].get(w.id);
      return `<button class="way" data-key="w:${i}:${w.id}" data-id="${w.id}" aria-pressed="${sel}" ${ok ? '' : 'aria-disabled="true"'}
        aria-label="${esc(`${MODE(j)}, ${who(j)}, ${j.depL.hm} to ${j.arrL.hm}${plusN(j) ? ' next day' : ''}, ${fmtDur(w.lost)} lost, ${w.read ? CUR + ' ' + fareTxt(w) : 'fare not read'}${ok ? '' : ', does not fit the plan'}`)}">
        ${ICON[modeOf(j)]}<b>${j.depL.hm}</b><span class="${w.read ? '' : 'no'}">${w.read ? euro(w) : '–'}</span></button>`;
    }).join('');
    body.innerHTML = `${hl(a, mid, b)}<p class="facts" id="facts" data-a title="${esc(detail(pick, ways))}">${legFacts(pick.j)}</p>
      <div class="ways" role="group" aria-label="Ways" data-a>${tiles}</div>`;
    const facts = $('facts');
    body.querySelectorAll('.way').forEach((el) => {
      const w = ways.find((x) => x.id === el.dataset.id);
      el.onclick = () => { if (el.getAttribute('aria-disabled') === 'true') return; stopPlay(); choose(i, w.id); };
      el.onmouseenter = el.onfocus = (e) => {
        const key = e.type === 'focus' && el.matches(':focus-visible');
        if (e.type === 'focus' && !key && !el.matches(':hover')) return;
        facts.innerHTML = legFacts(w.j); facts.title = detail(w, ways); showPreview(el, w, key); if (HOVER.matches || key) showAlt(w);
      };
      el.onmouseleave = el.onblur = () => { facts.innerHTML = legFacts(pick.j); facts.title = detail(pick, ways); hidePreview(); hideAlt(); };
    });
    warm(ways); keepPreview();
  } else if (c.k === 'stay') {
    const i = c.i, n = M.nights[i], a = M.legs[i].arrL, d = M.legs[i + 1].depL;
    body.innerHTML = `<div class="nights" data-a>${stepsHTML(i, n)}</div>${hl('', n === 1 ? 'night in' : 'nights in', STAYS[i], true)}
      <p class="facts" data-a>${a.wd} ${a.day} → ${d.wd} ${d.day} ${d.mon}</p>`;
    body.querySelectorAll('.step').forEach((el) => el.onclick = () => nights(i, +el.dataset.d));
    roll(body, was);
  } else {
    const t = totals();
    const parts = [];
    M.legs.forEach((j, i) => {
      const l = j.depL;
      parts.push(`<button class="it leg" data-key="l:${i}" data-leg="${i}" style="--w:${(j.arr - j.dep).toFixed(1)}"
        aria-label="${esc(`${P[j.from].label} to ${P[j.to].label}: ${MODE(j).toLowerCase()} ${l.wd} ${l.day} ${l.mon} at ${l.hm}`)}">${ICON[modeOf(j)]}<span class="d">${l.wd} ${l.day}</span><b>${l.hm}</b></button>`);
      if (i < N - 1) { const n = M.nights[i];
        parts.push(`<button class="it stay" data-key="s:${i}" data-stay="${i}" style="--w:${(M.legs[i + 1].dep - j.arr).toFixed(1)}" aria-label="${n} night${n === 1 ? '' : 's'} in ${STAYS[i]}">${ICON.moon}<b style="--n-fs:${nightFs(n)}">${n}</b><i class="c" aria-hidden="true">${STAYS[i]}</i></button>`); }
    });
    body.innerHTML = `<nav class="strip" aria-label="Your trip" data-a><div class="legs">${parts.join('')}</div>
      <div class="pay"><div class="sum${t.read ? '' : ' no'}" id="sum" title="${esc(M.b.all().join('; '))}"><b>${esc(t.fig)}</b><span>${esc(t.tail)}</span></div>
      <button class="book" id="book" data-key="book"></button></div></nav>`;
    // A part of the strip opens its card.
    body.querySelectorAll('.it').forEach((b) => b.onclick = () => go(b.dataset.leg != null ? legCard(+b.dataset.leg) : stayCard(+b.dataset.stay)));
    // The total opens the checkout too, for a pointer; Book is the control for the keyboard.
    $('book').onclick = $('sum').onclick = openCheckout;
    bookState();
  }
  if (focusKey) body.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
  // A new card sets its lines in one after another; going back sets them in from the other side.
  if (dir && !REDUCED) [...body.querySelectorAll('[data-a]')].forEach((el, k) =>
    el.animate([{ opacity: 0, transform: `translate(${dir * 22}px, 6px)` }, { opacity: 1, transform: 'none' }], { duration: 420, delay: k * 50, easing: EASE, fill: 'backwards' }));
}

function drawSegs() {
  segs.innerHTML = CARDS.map((c, n) => `<i class="${c.k === 'leg' ? 'lg' : ''}" data-n="${n}" style="flex-grow:${Math.pow(Math.max(1.5, hoursOf(c)), .6).toFixed(2)}"><b></b></i>`).join('');
  segs.querySelectorAll('i').forEach((el) => el.onclick = (e) => { e.stopPropagation(); stopPlay(); go(+el.dataset.n); });
  fill();
}
// Past cards are full, the next ones empty; the card in view fills while it plays.
function fill() {
  const bs = segs.querySelectorAll('b'), c = CARDS[story.cur];
  const p = story.playing ? Math.min(1, story.t / PLAY[c.k]) : 1;
  bs.forEach((b, n) => { b.style.transform = `scaleX(${n < story.cur ? 1 : n > story.cur ? 0 : p})`; });
}
const drawPlay = () => { const b = $('play'); b.innerHTML = story.playing ? ICON.pause : ICON.play; b.setAttribute('aria-label', story.playing ? 'Pause' : 'Play'); };
const drawNav = () => { $('prev').setAttribute('aria-disabled', story.cur === 0); $('next').setAttribute('aria-disabled', false); };

// The clock in the corner: on a leg it runs with the line as it draws, from the departure to the arrival.
function drawStamp() {
  const c = CARDS[story.cur]; let s = '';
  if (c.k === 'leg') { const j = M.legs[c.i], r = Math.max(0, story.ride), l = T.clock.local(j.dep + r * (j.arr - j.dep), P[r < .5 ? j.from : j.to].tz || T.clock.tz);
    s = `${l.wd} ${l.day} ${l.mon} · ${l.hm}`; }
  else if (c.k === 'stay') s = `Day ${dayOf(M.legs, M.legs[c.i].arrL.date)} of ${M.days}`;
  if (stamp.textContent !== s) stamp.textContent = s;
}

function bookState() {
  const book = $('book'); if (!book || !M) return;
  const job = co.busy(), t = totals();
  book.classList.toggle('pay', job?.status === 'at-payment');
  book.textContent = job ? BUSY_TEXT[job.status] : 'Book';
  book.setAttribute('aria-label', job ? BUSY_TEXT[job.status] : `Book ${M.b.tickets.length === 1 ? 'the ticket' : `the ${M.b.tickets.length} tickets`}, ${t.fig} ${t.tail}`);
}

async function render() {
  const my = ++seq, m = await model(); if (my !== seq) return;
  const before = M && CARDS[story.cur].k === 'leg' ? M.legs[CARDS[story.cur].i].id : null;
  const was = M ? M.legs.map((j) => j.id).join() : '';
  M = m; save();
  const rp = replay; replay = null;
  const c = CARDS[story.cur];
  // A new way draws its line again, and the card plays again from its start.
  const redraw = c.k === 'leg' && (rp === c.i || M.legs[c.i].id !== before);
  if (redraw) { story.t = 0; startDraw(M.legs[c.i], 500); }
  // A picked way is no longer a preview: its own line draws now.
  if (alt.id && (c.k !== 'leg' || M.picks[c.i].id === alt.id)) hideAlt(true);
  drawHead(); drawBody(); drawSegs(); drawStamp(); showMap(); if (grid.open) drawGrid();
  // A new way or a moved day changes what the card frames. A night more or less does not, so the camera
  // stays where the person may have moved it.
  if (story.started && M.legs.map((j) => j.id).join() !== was) aim(1600, { ease: true });
}

// ---------- Moving between cards ----------
function go(n, dir) {
  n = Math.max(0, Math.min(LAST, n));
  if (!M) return;
  const d = dir ?? Math.sign(n - story.cur);
  story.cur = n; story.t = 0;
  if (n === 0) story.playing = false;
  setHover(null); hidePreview(true); hideAlt(true);
  // A leg card draws its line as the camera comes in.
  if (CARDS[n].k === 'leg') startDraw(M.legs[CARDS[n].i], FLY * .5); else stopDraw();
  drawBody(d || 1); drawStamp(); showMap(); fill(); drawNav(); drawPlay();
  aim();
}
// Back to the cover from anywhere in the story: the ×, the first segment, or Esc.
function home() { stopPlay(); if (story.cur !== 0) go(0, -1); }
// After the last leg the loop closes: back on the cover, with the total and Book.
const next = () => { if (story.cur < LAST) go(story.cur + 1, 1); else go(0, 1); };
const prev = () => { if (story.cur > 0) go(story.cur - 1, -1); else story.t = 0; };
// A new way for a leg plays again: its card starts over and its line draws again.
let replay = null;
function choose(i, id) { if (state.picks[i] === id) return; state.picks[i] = id; replay = i; render(); }
function stopPlay() { if (!story.playing) return; story.playing = false; drawPlay(); fill(); }
function nights(i, d) {
  const el = body.querySelector(`.step[data-d="${d}"]`);
  if (!el || el.getAttribute('aria-disabled') === 'true') return;
  stopPlay(); state.delta[i] += d;
  render();
}
// The way before or after on a leg card's row (k / j and the up and down arrows).
function nudge(d) {
  const c = CARDS[story.cur]; if (c.k !== 'leg') return;
  const ws = [...M.ways[c.i]].sort((x, y) => x.j.dep - y.j.dep), at = ws.indexOf(M.picks[c.i]);
  for (let k = at + d; k >= 0 && k < ws.length; k += d) if (M.can[c.i].get(ws[k].id)) { stopPlay(); choose(c.i, ws[k].id); return; }
}

// The clock of the story. A card plays while nothing holds it: a pointer on the window, a press, the
// contact sheet, the checkout or a hidden tab.
let last = performance.now();
function tick(now) {
  const dt = Math.min(100, now - last); last = now;
  if (story.started && M) {
    const c = CARDS[story.cur], held = story.held.size > 0 || grid.open || document.getElementById('pc-sheetbg')?.hidden === false;
    if (!held) story.t += dt;
    if (story.playing) { fill(); if (story.t >= PLAY[c.k]) next(); }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ---------- The line draws itself ----------
// A leg card, and a new way on it, draws the chosen line from its start to its end in about 1.6 s, with a
// small soft glowing head and a faint dotted guide of the way ahead. Then the chart's own line (ties, dashes)
// comes back and the drawn line fades into it. With reduced motion the chart's line is there at once.
const DRAW_MS = 1600;
const rgba = (c, a) => { const q = d3.rgb(c); return `rgba(${q.r}, ${q.g}, ${q.b}, ${a})`; };
const easeIO = (u) => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
// line-progress is a share of the length in Mercator units, so the head is placed with the same measure.
const merc = ([lo, la]) => [(lo + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + la * Math.PI / 360)) / Math.PI) / 2];
const draw = { id: null, pts: null, len: null, p: 0, t0: 0, raf: 0, timer: 0 };
// A colour up to p along the line and clear after it, with a short soft edge at p.
function grad(p, on, off) {
  if (p <= 0) return ['interpolate', ['linear'], ['line-progress'], 0, off, 1, off];
  if (p >= 1) return ['interpolate', ['linear'], ['line-progress'], 0, on, 1, on];
  const e = Math.min(.004, (1 - p) / 2);
  return ['interpolate', ['linear'], ['line-progress'], 0, on, p, on, p + e, off, 1, off];
}
// The glow: clear behind, brighter toward the head.
function glow(p) {
  const off = rgba(RED, 0);
  if (p <= 0 || p >= 1) return ['interpolate', ['linear'], ['line-progress'], 0, off, 1, off];
  const a = Math.max(p - .07, p * .5), e = Math.min(.004, (1 - p) / 2);
  return ['interpolate', ['linear'], ['line-progress'], 0, off, a, off, p, rgba(RED, .6), p + e, off, 1, off];
}
function addDraw() {
  if (!map.getSource('routes') || map.getSource('mix-draw')) return;
  const fade = { duration: REDUCED ? 0 : 450, delay: 0 }, round = { 'line-join': 'round', 'line-cap': 'round' };
  const before = map.getLayer('mix-veil') ? 'mix-veil' : undefined;
  map.addSource('mix-draw', { type: 'geojson', data: EMPTY, lineMetrics: true });
  map.addSource('mix-head', { type: 'geojson', data: EMPTY });
  map.addLayer({ id: 'mix-guide', type: 'line', source: 'mix-draw', layout: round, paint: { 'line-color': INK, 'line-width': 1.3, 'line-dasharray': [.6, 2.4], 'line-opacity': 0, 'line-opacity-transition': fade } }, before);
  map.addLayer({ id: 'mix-draw-glow', type: 'line', source: 'mix-draw', layout: round, paint: { 'line-width': 16, 'line-blur': 8, 'line-gradient': glow(0) } }, before);
  map.addLayer({ id: 'mix-draw-halo', type: 'line', source: 'mix-draw', layout: round, paint: { 'line-width': 7, 'line-gradient': grad(0, rgba(LAND, .92), rgba(LAND, 0)), 'line-opacity': 0, 'line-opacity-transition': fade } }, before);
  map.addLayer({ id: 'mix-draw', type: 'line', source: 'mix-draw', layout: round, paint: { 'line-width': 3, 'line-gradient': grad(0, RED, rgba(RED, 0)), 'line-opacity': 0, 'line-opacity-transition': fade } }, before);
  map.addLayer({ id: 'mix-head-glow', type: 'circle', source: 'mix-head', paint: { 'circle-radius': 18, 'circle-color': RED, 'circle-blur': 1, 'circle-opacity': 0, 'circle-opacity-transition': fade, 'circle-pitch-alignment': 'viewport' } }, before);
  map.addLayer({ id: 'mix-head', type: 'circle', source: 'mix-head', paint: { 'circle-radius': 4, 'circle-color': RED, 'circle-stroke-color': LAND, 'circle-stroke-width': 1.8, 'circle-opacity': 0, 'circle-stroke-opacity': 0,
    'circle-opacity-transition': fade, 'circle-stroke-opacity-transition': fade, 'circle-pitch-alignment': 'viewport' } }, before);
  if (draw.id) { map.getSource('mix-draw').setData(lineOf()); drawOn(true); paintDraw(draw.p); }
}
map.on('style.load', addDraw); map.on('styledata', addDraw);
const lineOf = () => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: draw.pts } });
function drawOn(on) {
  if (!map.getLayer('mix-draw')) return;
  for (const id of ['mix-draw', 'mix-draw-halo']) map.setPaintProperty(id, 'line-opacity', on ? 1 : 0);
  map.setPaintProperty('mix-guide', 'line-opacity', on ? .38 : 0);
  headOn(on);
}
function headOn(on) {
  if (!map.getLayer('mix-head')) return;
  map.setPaintProperty('mix-head-glow', 'circle-opacity', on ? .38 : 0);
  map.setPaintProperty('mix-head', 'circle-opacity', on ? 1 : 0); map.setPaintProperty('mix-head', 'circle-stroke-opacity', on ? 1 : 0);
}
// The point at a share p of the line's length.
function headAt(p) {
  const { pts, len } = draw, L = len[len.length - 1] * p, n = Math.max(1, Math.min(len.length - 1, d3.bisectLeft(len, L)));
  const t = len[n] > len[n - 1] ? (L - len[n - 1]) / (len[n] - len[n - 1]) : 0, a = pts[n - 1], b = pts[n];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function paintDraw(p) {
  draw.p = p;
  if (!map.getLayer('mix-draw')) return;
  map.setPaintProperty('mix-draw', 'line-gradient', grad(p, RED, rgba(RED, 0)));
  map.setPaintProperty('mix-draw-halo', 'line-gradient', grad(p, rgba(LAND, .92), rgba(LAND, 0)));
  map.setPaintProperty('mix-draw-glow', 'line-gradient', glow(p));
  map.getSource('mix-head').setData(p > 0 && p < 1 ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: headAt(p) } } : EMPTY);
}
function startDraw(j, delay = 0) {
  stopDraw();
  story.ride = 0;
  if (REDUCED) return;
  const pts = j.segments.flatMap((s) => s.path).filter((q, n, a) => !n || q[0] !== a[n - 1][0] || q[1] !== a[n - 1][1]);
  if (pts.length < 2) return;
  const m = pts.map(merc), len = [0];
  for (let n = 1; n < m.length; n++) len.push(len[n - 1] + Math.hypot(m[n][0] - m[n - 1][0], m[n][1] - m[n - 1][1]));
  Object.assign(draw, { id: j.id, pts, len, p: 0 });
  map.getSource('mix-draw')?.setData(lineOf());
  paintDraw(0); drawOn(true);
  draw.timer = setTimeout(() => { draw.t0 = performance.now(); draw.raf = requestAnimationFrame(stepDraw); }, delay);
}
function stepDraw(now) {
  const u = Math.min(1, (now - draw.t0) / DRAW_MS), p = easeIO(u);
  paintDraw(p); story.ride = p; drawStamp();
  if (u < 1) { draw.raf = requestAnimationFrame(stepDraw); return; }
  // Done: the chart's line comes back under the drawn one, which fades into it.
  draw.raf = 0; draw.id = null; showMap(); drawOn(false);
}
function stopDraw() {
  clearTimeout(draw.timer); cancelAnimationFrame(draw.raf); draw.raf = 0;
  if (draw.id) { draw.id = null; drawOn(false); }
}

// ---------- Parts on the map ----------
// A part is a leg (its whole line) or a stay city. A mouse within reach of a part shows it:
// its line heavier and red over a slightly dimmed map, and a small label at a fixed spot beside it. A click
// goes to its card. The part of the card on screen is not offered: the person is already there.
const REACH = 60, TOUCH = 44, CITY = 24;
const cardOf = (p) => p.k === 'leg' ? legCard(p.i) : stayCard(p.i);
const EMPTY = { type: 'FeatureCollection', features: [] };
const HI = ['mix-veil', 'mix-area', 'mix-halo', 'mix-line', 'mix-sea', 'mix-ring'];
function addHi() {
  if (!map.getSource('routes') || map.getSource('mix-hi')) return;
  const t = { duration: REDUCED ? 0 : 220, delay: 0 }, kind = (k) => ['==', ['get', 'kind'], k], round = { 'line-join': 'round', 'line-cap': 'round' };
  map.addSource('mix-veil', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } } });
  map.addSource('mix-hi', { type: 'geojson', data: EMPTY });
  map.addLayer({ id: 'mix-veil', type: 'fill', source: 'mix-veil', paint: { 'fill-color': PAPER, 'fill-opacity': 0, 'fill-opacity-transition': t } });
  map.addLayer({ id: 'mix-area', type: 'circle', source: 'mix-hi', filter: kind('area'), paint: { 'circle-radius': ['get', 'r'], 'circle-color': RED, 'circle-opacity': .09, 'circle-blur': .5, 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'mix-halo', type: 'line', source: 'mix-hi', filter: kind('line'), layout: round, paint: { 'line-color': LAND, 'line-width': 12, 'line-opacity': .95 } });
  map.addLayer({ id: 'mix-line', type: 'line', source: 'mix-hi', filter: ['all', kind('line'), ['!', ['get', 'sea']]], layout: round, paint: { 'line-color': RED, 'line-width': 5 } });
  map.addLayer({ id: 'mix-sea', type: 'line', source: 'mix-hi', filter: ['all', kind('line'), ['get', 'sea']], layout: { 'line-join': 'round', 'line-cap': 'butt' }, paint: { 'line-color': RED, 'line-width': 5, 'line-dasharray': [2, 1] } });
  map.addLayer({ id: 'mix-ring', type: 'circle', source: 'mix-hi', filter: kind('ring'), paint: { 'circle-radius': 12, 'circle-color': RED, 'circle-opacity': .12, 'circle-stroke-color': RED, 'circle-stroke-width': 2 } });
  if (hov) setHover(hov, true);
}
// The chart sets its full style when its land loads, which drops page layers: add them again then.
map.on('style.load', addHi); map.on('styledata', addHi);

// The parts on screen, projected once per camera position. A long path is thinned for the distance test.
let paths = null, pathsFor = '', scr = null;
function screenParts() {
  if (scr) return scr;
  const key = M.legs.map((j) => j.id).join();
  if (key !== pathsFor) { pathsFor = key; paths = M.legs.map((j) => j.segments.map((s) => { const k = Math.max(1, Math.floor(s.path.length / 150)); return s.path.filter((_, n, a) => n % k === 0 || n === a.length - 1); })); }
  const xy = (ll) => { const q = map.project(ll); return [q.x, q.y]; };
  const legs = paths.map((segs, i) => ({ k: 'leg', i, segs: segs.map((s) => s.map(xy)) }));
  const stays = STAYS.map((_, i) => ({ k: 'stay', i, city: xy(P[stayAt(i)].coord) }));
  return (scr = { legs, stays, ends: stops(M.legs).map((id) => xy(P[id].coord)) });
}
const toSeg = (s, x, y) => {
  let d = Infinity;
  for (let n = 1; n < s.length; n++) {
    const [ax, ay] = s[n - 1], [bx, by] = s[n], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
    d = Math.min(d, Math.hypot(ax + t * dx - x, ay + t * dy - y));
  }
  return d;
};
// The nearest part within reach. Near a city the city wins over the legs that end there.
function partAt(x, y, reach = REACH) {
  const { legs, stays } = screenParts(); let best = null;
  const take = (p, d, score) => { if (d <= reach && (!best || score < best.score)) best = { k: p.k, i: p.i, score }; };
  // Where lines share a track, a leg the card draws wins over one it does not.
  const c = CARDS[story.cur], drawn = (i) => c.k === 'cover' || (c.k === 'leg' ? c.i === i : i === c.i || i === c.i + 1);
  for (const L of legs) { const d = d3.min(L.segs, (s) => toSeg(s, x, y)); take(L, d, d + (drawn(L.i) ? 0 : 12)); }
  for (const S of stays) {
    { const d = Math.hypot(S.city[0] - x, S.city[1] - y); take(S, d, d - CITY); }
    // The city's name on the map is part of the city.
    const r = nameOf(S.i)?.getBoundingClientRect();
    if (r?.width) { const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom)); take(S, d, d - CITY); }
  }
  return best;
}
// The chart's label for a stay city (a marker with the city's name).
const nameOf = (i) => [...document.querySelectorAll('.pc-lbl.city')].find((e) => e.textContent.trim() === P[stayAt(i)].label);

const hint = document.createElement('div');
hint.className = 'hint'; hint.setAttribute('aria-hidden', 'true'); $('stage').append(hint);
let hov = null, ptr = null;
function hiData(p) {
  if (p.k === 'leg') return { type: 'FeatureCollection', features: M.legs[p.i].segments.map((s) => ({ type: 'Feature', properties: { kind: 'line', sea: s.mode === 'ferry' }, geometry: { type: 'LineString', coordinates: s.path } })) };
  const id = stayAt(p.i), pt = (c, props) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: c } });
  return { type: 'FeatureCollection', features: [pt(P[id].coord, { kind: 'area', r: 46 }),
    pt(P[id].coord, { kind: 'ring' })] };
}
function setHover(p, force = false) {
  if (!force && (p?.k === hov?.k && p?.i === hov?.i)) return;
  hov = p ? { k: p.k, i: p.i } : null;
  $('map').classList.toggle('on-part', !!hov);
  document.querySelectorAll('.pc-lbl.city.mix-on').forEach((e) => e.classList.remove('mix-on'));
  if (hov?.k === 'stay') nameOf(hov.i)?.classList.add('mix-on');
  hov ? story.held.add('part') : story.held.delete('part');
  if (map.getSource('mix-hi')) { map.getSource('mix-hi').setData(hov ? hiData(hov) : EMPTY); map.setPaintProperty('mix-veil', 'fill-opacity', hov ? .42 : 0); }
  if (!hov) { hint.classList.remove('on'); return; }
  if (hov.k === 'leg') { const j = M.legs[hov.i];
    hint.innerHTML = `<b>${ICON[modeOf(j)]}${esc(P[j.from].label)} → ${esc(P[j.to].label)}</b><span>${j.depL.wd} ${j.depL.day} ${j.depL.mon} · ${timeTxt(j)}</span>`; }
  else { const n = M.nights[hov.i], a = M.legs[hov.i].arrL, d = M.legs[hov.i + 1].depL;
    hint.innerHTML = `<b>${n} night${n === 1 ? '' : 's'} in ${STAYS[hov.i]}</b><span>${a.wd} ${a.day} → ${d.wd} ${d.day} ${d.mon}</span>`; }
  placeHint(); hint.classList.add('on');
}
// The label keeps one spot beside its part, not on the pointer: beside a leg's middle (of the stretch on
// screen), or beside the city, on the side away from the rest of the loop and clear of the overlay.
function placeHint() {
  if (!hov) return;
  const s = screenParts(), W = innerWidth, H = innerHeight, y0 = top.offsetHeight;
  const mid = (pts) => [d3.mean(pts, (p) => p[0]), d3.mean(pts, (p) => p[1])];
  const loop = mid(s.ends);
  let A, u, gap;
  if (hov.k === 'leg') {
    const all = s.legs[hov.i].segs.flat(), seen = all.filter(([x, y]) => x > 0 && x < W && y > y0 && y < H), pts = seen.length > 1 ? seen : all;
    const len = [0]; for (let n = 1; n < pts.length; n++) len.push(len[n - 1] + Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]));
    const half = len[len.length - 1] / 2, n = Math.max(1, d3.bisectLeft(len, half)), a = pts[Math.min(n, pts.length - 1) - 1], b = pts[Math.min(n, pts.length - 1)];
    const t = len[n] > len[n - 1] ? (half - len[n - 1]) / (len[n] - len[n - 1]) : 0;
    A = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const k = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; u = [-(b[1] - a[1]) / k, (b[0] - a[0]) / k];
    if ((A[0] - loop[0]) * u[0] + (A[1] - loop[1]) * u[1] < 0) u = [-u[0], -u[1]];
    gap = 20;
  } else {
    const st = s.stays[hov.i]; A = st.city;
    const v = [A[0] - loop[0], A[1] - loop[1]]; 
    const k = Math.hypot(...v) || 1; u = k > 1 ? [v[0] / k, v[1] / k] : [0, -1];
    gap = 30;
  }
  // The label keeps clear of the overlay and the city names.
  const w = hint.offsetWidth, h = hint.offsetHeight, block = [...blocks(), ...[...document.querySelectorAll('.pc-lbl.city')].filter((e) => e.offsetParent && e.offsetHeight).map((e) => e.getBoundingClientRect())];
  const box = (d) => { const r = gap + Math.abs(d[0]) * w / 2 + Math.abs(d[1]) * h / 2, x = A[0] + d[0] * r - w / 2, y = A[1] + d[1] * r - h / 2; return { x, y }; };
  const ok = ({ x, y }) => x > 12 && x + w < W - 12 && y > y0 && y + h < H - 12 && !block.some((r) => x < r.right && x + w > r.left && y < r.bottom && y + h > r.top);
  const turn = (d, a) => [d[0] * Math.cos(a) - d[1] * Math.sin(a), d[0] * Math.sin(a) + d[1] * Math.cos(a)];
  const tries = [u, turn(u, .6), turn(u, -.6), [-u[0], -u[1]], [0, -1], [0, 1]].map(box), at = tries.find(ok) || tries[0];
  hint.style.transform = `translate(${Math.round(Math.max(12, Math.min(W - w - 12, at.x)))}px, ${Math.round(Math.max(y0, Math.min(H - h - 12, at.y)))}px)`;
}
let placeFrame = 0;
map.on('move', () => { scr = null; if (hov && !placeFrame) placeFrame = requestAnimationFrame(() => { placeFrame = 0; placeHint(); }); });
// When the camera stops, the part under a still pointer may have changed.
map.on('moveend', () => hoverAt(ptr));
const inside = (el, x, y) => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
// The overlay is its own blocks (headline, facts, ways, nights, strip), not the box around them.
const blocks = () => [...(body.querySelector('.strip')?.children || body.children)].map((el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); });
const onOverlay = (x, y) => blocks().some((r) => x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8);
const onMap = (e) => !!e.target.closest?.('#map') && !onOverlay(e.clientX, e.clientY);
function hoverAt(p) {
  if (!p || !story.started || !M || grid.open || document.getElementById('pc-sheetbg')?.hidden === false) { setHover(null); return; }
  const part = partAt(p.x, p.y);
  setHover(part && cardOf(part) !== story.cur ? part : null);
}

// A click (or tap) on the map: within reach of another part, go to its card. On the cover a click anywhere
// goes to the nearest part.
// Elsewhere in the story, the right half is the next card and the left half the one before; a press holds the card.
let press = null;
// The stage lets the pointer through to the map, so these listen on the document and act on the map only.
document.addEventListener('pointerdown', (e) => {
  if (!story.started || e.button > 0 || !e.isPrimary || !e.target.closest?.('#map')) return;
  dragged = false;
  press = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
  if (CARDS[story.cur].k !== 'cover') story.held.add('press');
});
const release = (e, tap) => {
  if (!press || e.pointerId !== press.id) return;
  const p = press; press = null; story.held.delete('press');
  // The event times, not the handler times: a busy frame must not turn a tap into a hold.
  if (!tap || dragged || e.timeStamp - p.t > 450 || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12) return;
  const cover = CARDS[story.cur].k === 'cover', reach = e.pointerType === 'mouse' ? REACH : TOUCH;
  const part = onMap(e) ? partAt(e.clientX, e.clientY, cover ? Infinity : reach) : null;
  if (part && cardOf(part) !== story.cur) { stopPlay(); go(cardOf(part)); return; }
  if (cover) return;
  stopPlay(); e.clientX < innerWidth / 2 ? prev() : next();
};
document.addEventListener('pointerup', (e) => release(e, true));
document.addEventListener('pointercancel', (e) => release(e, false));
// A mouse on the overlay (headline, facts, controls) or the top bar holds the card; on the map it looks for a part.
document.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  // While a button is down the hand moves the map: no part lights up.
  if (e.buttons) { ptr = null; setHover(null); return; }
  const ui = onOverlay(e.clientX, e.clientY) || inside(top, e.clientX, e.clientY);
  ui ? story.held.add('hover') : story.held.delete('hover');
  ptr = ui || !onMap(e) ? null : { x: e.clientX, y: e.clientY };
  hoverAt(ptr);
});
document.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && !e.relatedTarget) { story.held.delete('hover'); ptr = null; setHover(null); } });
document.addEventListener('visibilitychange', () => document.hidden ? story.held.add('tab') : story.held.delete('tab'));

// ---------- A way's vehicle, in 3D ----------
// A mouse on a way tile (or the keyboard's focus) shows a small floating card above it: the way's vehicle as
// a live paper model at a three-quarter view that sways a little, over a track that slides under it, and the
// way's carrier, times, length, changes and fare. A phone has no hover, and the card would cover the map
// that the leg card shows, so a phone does not show it. The models are the kit's (art/3d).
const HOVER = matchMedia('(hover: hover) and (pointer: fine)');
const ART = '/kit/art/3d/';
const BY_MODE = { train: 'train-hs', bus: 'coach', coach: 'coach', car: 'car', taxi: 'taxi', ferry: 'ferry', plane: 'plane' };
let MODELS = {};
const modelsP = fetch(ART + 'index.json').then((r) => r.ok ? r.json() : []).then((l) => { MODELS = Object.fromEntries(l.map((m) => [m.name, m])); }).catch(() => {});
const mainRide = (j) => d3.greatest(rides(j), (s) => s.b - s.a);
// As the kit picks: the segment's own vehicle, else a night train for a train through the night, else by mode.
function vehicleOf(j) {
  const s = mainRide(j), night = s.mode === 'train' && s.b - s.a >= 4 && overnight(j);
  return [s.vehicle, night && 'train-night', BY_MODE[s.mode]].find((n) => n && MODELS[n]) || BY_MODE[s.mode] || 'train-hs';
}
const kindOf = (name) => name.startsWith('train') ? 'rail' : name === 'ferry' ? 'sea' : 'road';
// The carriers, and the number of a single ride: "DB ICE 507", "Snälltåget 300", "Vy + SJ +1".
function carrierNo(j) {
  const rs = rides(j), cs = [...new Set(rs.map((s) => SHORT[s.carrier] || T.carriers[s.carrier] || s.carrier))];
  if (cs.length > 1) return cs.slice(0, 2).join(' + ') + (cs.length > 2 ? ` +${cs.length - 2}` : '');
  const c = who(j), num = rs.length === 1 ? rs[0].number || '' : '', word = num.split(' ')[0];
  if (!num || num.length > 10) return c;
  return /^\d+$/.test(num) ? `${c} ${num}` : c.includes(word) ? `${c.replace(word, '').trim()} ${num}`.trim() : `${c} ${num}`;
}
let three = null;
const loadThree = () => three ??= Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')]).then(([T3, { GLTFLoader }]) => ({ T3, loader: new GLTFLoader() }));
const glbs = new Map();
const loadModel = (name) => { if (!glbs.has(name)) glbs.set(name, loadThree().then(({ loader }) => loader.loadAsync(ART + name + '.glb')).then((g) => g.scene)); return glbs.get(name); };
// Load three.js, the viewer and the models of the tiles on this card, so a hover shows at once.
async function warm(ways) {
  if (!HOVER.matches) return;
  await modelsP;
  makeView().catch(() => {});
  for (const w of ways) loadModel(vehicleOf(w.j)).catch(() => {});
}

const pv = document.createElement('div');
pv.className = 'pv'; pv.setAttribute('aria-hidden', 'true');
pv.innerHTML = '<div class="pv-in"><div class="pv-3d"><span class="pv-k"></span></div><div class="pv-t"></div></div>';
$('stage').append(pv);
const PV_W = 260, PV_H = 140;
let view = null, viewP = null;
function makeView() {
  return viewP ??= loadThree().then(({ T3 }) => {
    const renderer = new T3.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(PV_W, PV_H);
    renderer.outputColorSpace = T3.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T3.PCFShadowMap;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    pv.querySelector('.pv-3d').prepend(renderer.domElement);
    const scene = new T3.Scene(), camera = new T3.PerspectiveCamera(24, PV_W / PV_H, .1, 100);
    const sun = new T3.DirectionalLight(0xffffff, 1.2);
    sun.position.set(1.2, 9, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 6; sun.shadow.bias = -.0004;
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 }); sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun);
    const rig = new T3.Group(); scene.add(rig);
    // The paper takes the model's shadow, and a soft round shade sits right under it.
    const floor = new T3.Mesh(new T3.PlaneGeometry(16, 16), new T3.ShadowMaterial({ color: new T3.Color(INK), opacity: .13 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; rig.add(floor);
    const tex = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return new T3.CanvasTexture(c); };
    const shade = tex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(29, 42, 74, .30)'); r.addColorStop(.55, 'rgba(29, 42, 74, .12)'); r.addColorStop(1, 'rgba(29, 42, 74, 0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
    const blob = new T3.Mesh(new T3.PlaneGeometry(1, 1), new T3.MeshBasicMaterial({ map: shade, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = .003; rig.add(blob);
    // A long line is clear at both ends (an alpha map runs along its length).
    const ramp = tex(256, 1, (g) => { const r = g.createLinearGradient(0, 0, 256, 0); r.addColorStop(0, '#000'); r.addColorStop(.3, '#fff'); r.addColorStop(.7, '#fff'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, 256, 1); });
    const ground = new T3.Group(), holder = new T3.Group(), bob = new T3.Group();
    holder.add(bob); rig.add(ground, holder);
    view = { T3, renderer, scene, camera, rig, blob, ramp, ground, bob, name: null, kind: null, movers: [], speed: 1, t0: 0, raf: 0 };
    return view;
  });
}
// The ground that slides under the vehicle: rails and ties, a road with its dashes, or the strokes of a calm sea.
function buildGround(kind, w) {
  const v = view, { T3 } = v;
  if (v.kind === kind && Math.abs(v.w - w) < 1e-3) return;
  v.ground.clear(); v.movers = []; v.kind = kind; v.w = w;
  const flat = (lx, lz, o, long) => {
    const m = new T3.Mesh(new T3.PlaneGeometry(lx, lz), new T3.MeshBasicMaterial({ color: new T3.Color(INK), transparent: true, opacity: o, depthWrite: false, alphaMap: long ? v.ramp : null }));
    m.rotation.x = -Math.PI / 2; m.position.y = .005; v.ground.add(m); return m;
  };
  const move = (m, o) => v.movers.push({ m, o, x0: m.position.x });
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (kind === 'rail') {
    for (const f of [-.3, .3]) flat(8, .03, .6, true).position.z = f * w;
    for (let x = -5; x < 5; x += .3) { const t = flat(.06, w * .9, .45); t.position.x = x; move(t, .45); }
    v.speed = 1.9;
  } else if (kind === 'road') {
    for (const f of [-.85, .85]) flat(8, .025, .45, true).position.z = f * w;
    for (let x = -5; x < 5; x += .75) { const d = flat(.36, .04, .55); d.position.x = x; move(d, .55); }
    v.speed = 1.5;
  } else {
    for (let n = 0; n < 40; n++) { const d = flat(.14 + rnd() * .4, .02, .4); d.position.set(-5 + rnd() * 10, .005, (rnd() * 2 - 1) * 2.6); move(d, .2 + rnd() * .3); }
    v.speed = .55;
  }
}
function setModel(name, src) {
  const v = view, { T3 } = v;
  if (v.name === name) return;
  v.bob.clear(); v.name = name;
  const m = src.clone(true);
  m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // The nose is +x. The model stands on the paper with its middle at the centre. Its length follows its real
  // length, compressed (a 33 m train is 4 units, a 10 m coach about 2.4, a 46 m ferry about 4.6), so a coach
  // reads as a coach next to a train and not as a train-sized bus.
  let box = new T3.Box3().setFromObject(m); const s0 = box.getSize(new T3.Vector3()), L = Math.max(s0.x, s0.z);
  m.scale.setScalar(4 * Math.pow(L / 33, .45) / L);
  box = new T3.Box3().setFromObject(m); const c = box.getCenter(new T3.Vector3()), size = box.getSize(new T3.Vector3());
  m.position.set(-c.x, -box.min.y, -c.z);
  v.bob.add(m);
  v.blob.scale.set(size.x * 1.25, size.z * 2.6, 1);
  buildGround(kindOf(name), size.z);
  // One camera for every model: the room a ferry needs, or more for a bigger one. A small vehicle is not zoomed in on.
  fitCamera(size.x > REF.x || size.y > REF.y || size.z > REF.z ? size : REF);
}
const REF = { x: 4.7, y: 1.7, z: 1.4 };
// The camera looks down 21 degrees at the middle of a box and steps back until the box's corners fit with about
// 18 per cent room, at every angle of the sway. setModel passes one shared box, so all models share one camera.
function fitCamera(size) {
  const v = view, { T3 } = v, el = 21 * Math.PI / 180, aimAt = new T3.Vector3(0, size.y / 2, 0), dir = new T3.Vector3(0, Math.sin(el), Math.cos(el));
  const hx = size.x / 2, hz = size.z / 2, corners = [];
  for (const a of [SWAY0 - SWAY, SWAY0, SWAY0 + SWAY]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, size.y + .04]) {
    const x = sx * hx, z = sz * hz;
    corners.push(new T3.Vector3(x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)));
  }
  const fits = (d) => {
    v.camera.position.copy(aimAt).addScaledVector(dir, d); v.camera.lookAt(aimAt); v.camera.updateMatrixWorld();
    return corners.every((q) => { const p = q.clone().project(v.camera); return Math.abs(p.x) <= .82 && Math.abs(p.y) <= .82 && p.z < 1; });
  };
  let lo = .5, hi = 60;
  for (let n = 0; n < 24; n++) { const mid = (lo + hi) / 2; fits(mid) ? hi = mid : lo = mid; }
  fits(hi);
}
// The sway: a three-quarter view, turning 12 degrees each way and back in 7 s.
const SWAY0 = -.62, SWAY = 12 * Math.PI / 180, SWAY_S = 7;
const fadeEnds = (x) => { const a = Math.abs(x); return a < 2.2 ? 1 : a > 4 ? 0 : 1 - (a - 2.2) / 1.8; };
function frameView(now) {
  const v = view; if (!v) return;
  const t = (now - v.t0) / 1000, still = REDUCED;
  v.rig.rotation.y = SWAY0 + (still ? 0 : SWAY * Math.sin(t * Math.PI * 2 / SWAY_S));
  for (const mv of v.movers) {
    const x = still ? mv.x0 : ((mv.x0 - t * v.speed + 5) % 10 + 10) % 10 - 5;
    mv.m.position.x = x; mv.m.material.opacity = mv.o * fadeEnds(x);
  }
  // A ferry rocks on the swell; a coach or a car hums a little on the road.
  if (!still && v.kind === 'sea') { v.bob.position.y = Math.sin(t * 1.6) * .03; v.bob.rotation.x = Math.sin(t * 1.1) * .035; v.bob.rotation.z = Math.sin(t * .8 + 1) * .02; }
  else if (!still && v.kind === 'road') { v.bob.position.y = (Math.sin(t * 9) + 1) * .004; v.bob.rotation.set(0, 0, 0); }
  else { v.bob.position.y = 0; v.bob.rotation.set(0, 0, 0); }
  v.renderer.render(v.scene, v.camera);
  v.raf = pvLive && !still ? requestAnimationFrame(frameView) : 0;
}
let pvFor = null, pvLive = false, pvHide = 0, pvStop = 0;
function pvText(w) {
  const j = w.j, n = changes(j);
  return `<b>${esc(carrierNo(j))}</b><span>${timeTxt(j)} · ${fmtDur(j.arr - j.dep)}</span>
    <span>${n ? `${n} change${n === 1 ? '' : 's'}` : 'Direct'} · ${w.read ? euro(w) : '<i class="no">–</i>'}</span>`;
}
// The card stands above its tile, centred on it and inside the window.
function placePreview(el, jump) {
  const r = el.getBoundingClientRect(), x = Math.round(Math.max(12, Math.min(innerWidth - PV_W - 12, r.left + r.width / 2 - PV_W / 2)));
  const y = Math.round(Math.max(top.offsetHeight, r.top - 12 - pv.offsetHeight));
  if (jump) pv.classList.add('jump');
  pv.style.setProperty('--x', x + 'px'); pv.style.setProperty('--y', y + 'px');
  if (jump) { pv.offsetWidth; pv.classList.remove('jump'); }
}
async function showPreview(el, w, keyboard = false) {
  if (!HOVER.matches && !keyboard) return;
  clearTimeout(pvHide); clearTimeout(pvStop);
  const fresh = !pv.classList.contains('on');
  pvFor = w.id;
  pv.querySelector('.pv-k').textContent = MODE(w.j);
  pv.querySelector('.pv-t').innerHTML = pvText(w);
  placePreview(el, fresh);
  if (fresh) pv.classList.remove('ready');
  pv.classList.add('on');
  await modelsP;
  const name = vehicleOf(w.j);
  const [src] = await Promise.all([loadModel(name), makeView()]).catch(() => []);
  if (pvFor !== w.id || !src) return;
  if (fresh || !pvLive) view.t0 = performance.now();
  setModel(name, src);
  pv.classList.add('ready');
  pvLive = true;
  if (!view.raf) view.raf = requestAnimationFrame(frameView);
}
// A short wait before the card goes, so moving from one tile to the next does not flash it.
function hidePreview(now = false) {
  pvFor = null; clearTimeout(pvHide);
  const off = () => { pv.classList.remove('on'); clearTimeout(pvStop); pvStop = setTimeout(() => { if (!pv.classList.contains('on')) pvLive = false; }, 260); };
  if (now) off(); else pvHide = setTimeout(off, 90);
}
// A redraw of the card makes new tiles: the card keeps to the hovered one, or goes.
function keepPreview() {
  if (!pvFor) return;
  const el = body.querySelector(`.way[data-id="${CSS.escape(pvFor)}"]`);
  if (el && (el.matches(':hover') || el.matches(':focus-visible'))) placePreview(el, false); else hidePreview(true);
}

// ---------- A hovered way on the map ----------
// A way tile under the mouse (or the keyboard's focus) draws its way on the map in about half a second: a
// solid ink line on a paper halo, with rings at its two ends, over the chosen red line, and the map dims a
// little under it. Where the two run together the ink covers the red; where they part (another station,
// another town, a road and not a rail line) both show. The camera stays, unless the way leaves the frame:
// then it glides out to hold both, and back when the mouse leaves. A click picks the way, and its line draws.
const ALT_MS = 500;
const alt = { id: null, pts: null, len: null, p: 0, t0: 0, raf: 0, back: 0, wide: false };
function addAlt() {
  if (!map.getSource('routes') || !map.getLayer('mix-veil') || map.getSource('mix-alt')) return;
  const fade = { duration: REDUCED ? 0 : 180, delay: 0 };
  map.addSource('mix-alt', { type: 'geojson', data: EMPTY });
  map.addSource('mix-alt-ends', { type: 'geojson', data: EMPTY });
  map.addLayer({ id: 'mix-alt-halo', type: 'line', source: 'mix-alt', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': LAND, 'line-width': 7, 'line-opacity': 0, 'line-opacity-transition': fade } });
  map.addLayer({ id: 'mix-alt', type: 'line', source: 'mix-alt', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': INK, 'line-width': 2.6, 'line-opacity': 0, 'line-opacity-transition': fade } });
  map.addLayer({ id: 'mix-alt-ends', type: 'circle', source: 'mix-alt-ends', paint: { 'circle-radius': 4.5, 'circle-color': LAND, 'circle-stroke-color': INK, 'circle-stroke-width': 2,
    'circle-opacity': 0, 'circle-stroke-opacity': 0, 'circle-opacity-transition': fade, 'circle-stroke-opacity-transition': fade, 'circle-pitch-alignment': 'viewport' } });
  if (alt.id) { altOn(true); paintAlt(alt.p); }
}
map.on('style.load', addAlt); map.on('styledata', addAlt);
function altOn(on) {
  if (!map.getLayer('mix-alt')) return;
  map.setPaintProperty('mix-alt-halo', 'line-opacity', on ? .95 : 0); map.setPaintProperty('mix-alt', 'line-opacity', on ? 1 : 0);
  map.setPaintProperty('mix-alt-ends', 'circle-opacity', on ? 1 : 0); map.setPaintProperty('mix-alt-ends', 'circle-stroke-opacity', on ? 1 : 0);
  // The veil of the map parts dims the map and the chosen line a little.
  if (!hov) map.setPaintProperty('mix-veil', 'fill-opacity', on ? .3 : 0);
}
// The line up to a share p of its length.
function paintAlt(p) {
  alt.p = p;
  if (!map.getSource('mix-alt')) return;
  const { pts, len } = alt, L = len[len.length - 1] * p, n = Math.max(1, Math.min(len.length - 1, d3.bisectLeft(len, L)));
  const t = len[n] > len[n - 1] ? (L - len[n - 1]) / (len[n] - len[n - 1]) : 0, a = pts[n - 1], b = pts[n];
  const line = p >= 1 ? pts : [...pts.slice(0, n), [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]];
  map.getSource('mix-alt').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } });
  const pt = (c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } });
  map.getSource('mix-alt-ends').setData({ type: 'FeatureCollection', features: p >= 1 ? [pt(pts[0]), pt(pts[pts.length - 1])] : [pt(pts[0])] });
}
function stepAlt(now) {
  const u = Math.max(0, Math.min(1, (now - alt.t0) / ALT_MS)), p = 1 - Math.pow(1 - u, 3);
  paintAlt(p);
  alt.raf = u < 1 ? requestAnimationFrame(stepAlt) : 0;
}
// The thinned path of a way, for the frame test.
const pathPts = (j) => j.segments.flatMap((s) => { const k = Math.max(1, Math.floor(s.path.length / 40)); return s.path.filter((_, n, a) => n % k === 0 || n === a.length - 1); });
function showAlt(w) {
  const c = CARDS[story.cur];
  if (c.k !== 'leg' || !M || w === M.picks[c.i] || w.id === M.picks[c.i].id) { hideAlt(); return; }
  clearTimeout(alt.back);
  if (alt.id === w.id) return;
  cancelAnimationFrame(alt.raf);
  const pts = w.j.segments.flatMap((s) => s.path).filter((q, n, a) => !n || q[0] !== a[n - 1][0] || q[1] !== a[n - 1][1]);
  if (pts.length < 2) return;
  const m = pts.map(merc), len = [0];
  for (let n = 1; n < m.length; n++) len.push(len[n - 1] + Math.hypot(m[n][0] - m[n - 1][0], m[n][1] - m[n - 1][1]));
  Object.assign(alt, { id: w.id, pts, len });
  altOn(true);
  if (REDUCED) paintAlt(1); else { paintAlt(0); alt.t0 = performance.now(); alt.raf = requestAnimationFrame(stepAlt); }
  // The camera moves only when the way leaves the frame.
  const pad = padFor(), W = innerWidth, H = innerHeight;
  const out = pathPts(w.j).some((ll) => { const q = map.project(ll); return q.x < pad.left || q.x > W - pad.right || q.y < pad.top || q.y > H - pad.bottom; });
  if (out) { alt.wide = true; aim(900, { ease: true, extra: pathPts(w.j), drift: false }); }
}
// A short wait, so moving from one tile to the next keeps the camera still.
function hideAlt(now = false) {
  cancelAnimationFrame(alt.raf); alt.raf = 0;
  if (alt.id) { alt.id = null; altOn(false); }
  clearTimeout(alt.back);
  const back = () => { if (alt.wide && !alt.id) { alt.wide = false; if (CARDS[story.cur].k === 'leg') aim(900, { ease: true }); } };
  if (now) alt.wide = false; else alt.back = setTimeout(back, 160);
}

$('prev').innerHTML = ICON.prev; $('next').innerHTML = ICON.next; $('gridBtn').innerHTML = ICON.grid; $('gridX').innerHTML = ICON.x; $('home').innerHTML = ICON.x;
$('prev').onclick = () => { stopPlay(); prev(); };
$('next').onclick = () => { stopPlay(); next(); };
$('home').onclick = () => { home(); $('gridBtn').focus({ preventScroll: true }); };
// Play on the cover starts the story at its first leg.
$('play').onclick = () => {
  if (!story.playing && story.cur === 0) { story.playing = true; go(1, 1); return; }
  story.playing = !story.playing;
  if (story.playing && story.t >= PLAY[CARDS[story.cur].k]) story.t = 0;
  drawPlay(); fill();
};

// ---------- The contact sheet ----------
const gridEl = $('grid'), sheetEl = $('sheet');
const grid = { open: false, anim: null };
// A small drawing of the loop, in one frame for every card: this card's leg or city in red.
function sketch(c) {
  const all = M.legs.map((j) => j.segments.map((s) => s.path.filter((_, k, a) => k % Math.max(1, Math.floor(a.length / 60)) === 0 || k === a.length - 1)));
  const cs = Math.cos(56 * Math.PI / 180), pr = ([x, y]) => [x * cs, -y];
  const pts = all.flat(2).map(pr), x0 = d3.min(pts, (p) => p[0]), x1 = d3.max(pts, (p) => p[0]), y0 = d3.min(pts, (p) => p[1]), y1 = d3.max(pts, (p) => p[1]);
  const m = (y1 - y0) * .14, vb = [x0 - m * 1.4, y0 - m, x1 - x0 + m * 2.8, y1 - y0 + m * 2].map((v) => v.toFixed(3)).join(' ');
  const line = (segs) => segs.map((p) => 'M' + p.map((q) => pr(q).map((v) => v.toFixed(3)).join(',')).join('L')).join('');
  const k = (y1 - y0) / 100;
  const legs = all.map((segs, i) => {
    const on = c.k === 'cover' || (c.k === 'leg' && c.i === i);
    return `<path d="${line(segs)}" fill="none" stroke="${on ? 'var(--red)' : 'var(--ink)'}" stroke-opacity="${on ? 1 : .28}" stroke-width="${(on ? 2.2 : 1.1) * k}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  const cities = stops(M.legs).map((id, n) => {
    const [x, y] = pr(P[id].coord), on = c.k === 'stay' && c.i === n - 1;
    return on ? `<circle cx="${x}" cy="${y}" r="${6 * k}" fill="none" stroke="var(--red)" stroke-width="${1.2 * k}"/><circle cx="${x}" cy="${y}" r="${2.6 * k}" fill="var(--red)"/>`
      : `<circle cx="${x}" cy="${y}" r="${1.8 * k}" fill="var(--land)" stroke="var(--ink)" stroke-width="${.9 * k}"/>`;
  }).join('');
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${legs}${cities}</svg>`;
}
function drawGrid() {
  sheetEl.innerHTML = CARDS.map((c, n) => {
    let text, label;
    if (c.k === 'leg') { const j = M.legs[c.i], [a, mid, b] = legTitle(c.i); text = `<div class="th">${esc(a)}<em>${esc(mid)}</em>${esc(b)}</div><div class="tm">${j.depL.wd} ${j.depL.day} · ${j.depL.hm}</div>`; label = `${a} ${mid} ${b}, ${j.depL.wd} ${j.depL.day} ${j.depL.mon} at ${j.depL.hm}`; }
    else if (c.k === 'stay') { const nn = M.nights[c.i]; text = `<span class="tn">${nn}</span><div class="th"><em>${nn === 1 ? 'night in' : 'nights in'}</em>${STAYS[c.i]}</div>`; label = `${nn} night${nn === 1 ? '' : 's'} in ${STAYS[c.i]}`; }
    else { const t = totals(); text = `<div class="th">${headHTML(headline())}</div><div class="tm">${esc(t.fig)}</div>`; label = `The whole trip, ${t.fig}`; }
    return `<button class="thumb" data-n="${n}" aria-current="${n === story.cur}" aria-label="${esc(label)}">${sketch(c)}<div class="tt">${text}</div></button>`;
  }).join('');
  sheetEl.querySelectorAll('.thumb').forEach((b) => b.onclick = () => { const n = +b.dataset.n; closeGrid(false); go(n); });
}
function openGrid() {
  if (grid.open || !story.started) return;
  stopPlay(); hidePreview(true); hideAlt(); grid.open = true; drawGrid(); grid.anim?.cancel();
  gridEl.hidden = false; $('gridBtn').setAttribute('aria-expanded', 'true');
  if (!REDUCED) {
    gridEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    sheetEl.querySelectorAll('.thumb').forEach((t, k) => t.animate([{ opacity: 0, transform: 'translateY(14px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 30 + k * 28, easing: EASE, fill: 'backwards' }));
  }
  sheetEl.querySelector(`[data-n="${story.cur}"]`)?.focus({ preventScroll: true });
}
function closeGrid(focusBack = true) {
  if (!grid.open) return;
  grid.open = false; $('gridBtn').setAttribute('aria-expanded', 'false');
  const done = () => { if (!grid.open) gridEl.hidden = true; };
  if (REDUCED) done(); else { grid.anim = gridEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in' }); grid.anim.onfinish = done; }
  if (focusBack) $('gridBtn').focus({ preventScroll: true });
}
$('gridBtn').onclick = () => grid.open ? closeGrid() : openGrid();
$('gridX').onclick = () => closeGrid();
gridEl.addEventListener('click', (e) => { if (e.target === gridEl || e.target === sheetEl) closeGrid(); });

// ---------- Book (as v-editorial.js) ----------
const co = checkout({ id: T.raw.id, onJob: () => bookState() });
function openCheckout() {
  if (!M) return;
  stopPlay(); hidePreview(true); hideAlt();
  const { b, legs, nights, days } = M, when = wdSpan(legs[0].depL, legs[N - 1].arrL), nTickets = b.tickets.length;
  const ifCost = PAX === 1 ? 'If the ticket costs' : PAX === 2 ? 'If both tickets cost' : `If the ${PAX} tickets cost`;
  const extra = legs.map((j, i) => { const w = M.picks[i], be = breakEven(w, M.ways[i]);
    return be ? `Leg ${i + 1} was chosen because it loses fewer hours. ${ifCost} ${be.approx ? 'about ' : ''}${CUR} ${be.fare} or more${nightTrainUnknown(j) ? ' with the night class' : ''}, stop and tell me: ${be.ref.j.carrierName} ${be.ref.j.depL.hm} at ${CUR} ${Math.round(be.ref.price)} is then the better way.` : ''; }).filter(Boolean);
  const movedLegs = legs.filter((j) => j.shifted);
  // The hotel line: "2 nights in Copenhagen, 3 in Hamburg and 3 in Berlin".
  const stays = STAYS.map((s, i) => i ? `${nights[i]} in ${s}` : `${plural(nights[i], 'night')} in ${s}`);
  const hotels = stays.length > 1 ? `${stays.slice(0, -1).join(', ')} and ${stays.at(-1)}` : stays[0];
  const allNights = d3.sum(nights);
  const prompt = [
    `Book our trip: ${route(legs)}, ${wdSpan(legs[0].depL, legs[N - 1].arrL, 'to')}, ${PAX_TXT}, normal luggage (one suitcase each). Use my browser.`,
    ...b.promptLines(),
    ...extra,
    legs.some(proxyOf) ? `The train times come from the same trains in ${proxyMonths(legs)}, because the ${tripMonths(legs)} timetable is not published. Check each train on the seller site and report any change before you fill.` : '',
    movedLegs.length ? `These legs were moved to another day on the page, and their times (and price, where read) were read for the searched day: ${movedLegs.map((j) => `${MODE(j).toLowerCase()} ${j.depL.wd} ${j.depL.day} ${j.depL.mon} (searched for ${fdate(T.byId[j.base].raw.dep.slice(0, 10))})`).join('; ')}. Read the real times and price for the new day and report them before you fill.` : '',
    stays.length ? `Hotels are not part of this booking: ${hotels}. Do not book them.` : '',
    'If a price is more than 15% above the expected price, stop and tell me.',
    'Stop on each payment page. Do not pay.'].filter(Boolean).join('\n');
  co.open({ title: route(legs), sub: `${when} · ${PAX_TXT} · ${plural(days, 'day')} · ${plural(nTickets, 'ticket')}`,
    items: b.items(), totalLabel: `This booking, ${PAX_TXT}`, total: totals().text,
    note: `${legs.some(proxyOf) ? `Train times are from ${proxyMonths(legs)} timetables; your agent checks each one. ` : ''}${movedLegs.length ? `Moved legs (${movedLegs.map((j) => `${P[j.from].label} → ${P[j.to].label}`).join(', ')}): times${movedLegs.some((j) => wayOf(j).read) ? ' and prices' : ''} were read for another day. ` : ''}${stays.length ? `Hotels (${plural(allNights, 'night')}) are not part of this booking. ` : ''}Prices seen ${esc(T.raw.sources?.seen || '')}.`,
    prompt,
    trip: { title: T.raw.title, currency: T.currency, passengers: T.raw.passengers, legs: legs.map((j) => ({ ...j.raw, moved_days: j.shifted || 0 })), nights: Object.fromEntries(STAYS.map((s, i) => [s, nights[i]])), total: totals().text } });
}

// ---------- Keys ----------
// Esc backs out one level: the contact sheet, then the story to the cover.
addEventListener('keydown', (e) => {
  if (document.getElementById('pc-sheetbg')?.hidden === false || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key, onBtn = document.activeElement?.closest?.('button'), c = CARDS[story.cur];
  if (k === 'Escape') {
    if (grid.open) closeGrid();
    else if (c.k !== 'cover') home();
    else return;
    e.preventDefault(); return;
  }
  if (!story.started) return;
  if (k === 'g') { grid.open ? closeGrid() : openGrid(); return; }
  if (grid.open) return;
  // With the map focused, its keys pan and zoom it.
  if (document.activeElement === map.getCanvas()) return;
  if (k === 'ArrowRight' || k === 'l' || (k === ' ' && !onBtn)) { e.preventDefault(); stopPlay(); next(); }
  else if (k === 'ArrowLeft' || k === 'h') { e.preventDefault(); stopPlay(); prev(); }
  else if (k === 'ArrowDown' || k === 'j' || k === 'ArrowUp' || k === 'k') {
    const up = k === 'ArrowUp' || k === 'k';
    if (c.k === 'leg') { e.preventDefault(); nudge(up ? -1 : 1); }
    else if (c.k === 'stay') { e.preventDefault(); nights(c.i, up ? 1 : -1); }
  }
  else if (k === '+' || k === '=' || k === '-') { if (c.k === 'stay') nights(c.i, k === '-' ? -1 : 1); }
});
addEventListener('resize', () => { hidePreview(true); if (story.started) aim(0); });

// ---------- Opening ----------
// The title stands large over the globe while it turns to the north, then rises to the top of the cover
// and the strip comes up. The cover stays until the person plays the story or takes the arrow.
function ready() {
  if (story.started) return;
  const begin = () => {
    if (story.started) return; story.started = true;
    document.body.classList.remove('intro');
    last = performance.now(); story.t = 0;
    drawNav(); drawPlay(); fill();
    aim(1800);
  };
  if (map.isMoving()) { map.once('moveend', () => setTimeout(begin, 0)); setTimeout(begin, 2600); } else begin();
}
await render();
drawNav(); drawPlay();
// The chart flies its opening to the cover's frame.
Object.assign(chart.PAD, padFor());
