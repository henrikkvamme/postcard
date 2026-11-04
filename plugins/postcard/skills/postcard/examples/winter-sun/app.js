// Winter sun: a week somewhere warm, with flexible dates and three places to choose from.
// The question is "where and which week", so the HUD is a grid of destinations by start date,
// and the chosen week's flights on a day-scale timeline. The kit draws the chart and the checkout.
import { loadTrip, openTrip, ACCEPT } from '/kit/trip.js';
import { fmtDur } from '/kit/time.js';
import { createChart } from '/kit/chart.js';
import { timeline } from '/kit/timeline.js';
import { checkout, BUSY_TEXT } from '/kit/checkout.js';
import { esc, store, tooltip, chipsHTML, wireChips, stampSVG, postmarkSVG } from '/kit/parts.js';

const T = await openTrip(await loadTrip());
const X = T.raw.context, money = T.money, NIGHTS = X.nights ?? 7;
document.title = T.raw.title;
document.getElementById('t-h1').textContent = T.raw.title;
document.getElementById('t-sub').textContent = T.raw.subtitle || '';
const db = store(T.raw.id), tip = tooltip();
const DESTS = X.destinations, HOME = X.home.places[0];

// ---------- Model ----------
// A holiday is one flight out and one flight back to the same place, exactly NIGHTS nights apart.
// Its cost is the price with the chosen bags, plus the time it costs you: travel and the way to the airport.
const state = { accept: db.get('accept', 'operator'), bags: db.get('bags', 'small', ['small', 'cabin', 'checked']), airports: db.get('airports', 'both', ['zrh', 'both']), pick: db.get('pick', null), view: db.get('view', 'weeks', ['weeks', 'flights']) };
if (!ACCEPT[state.accept]) state.accept = 'operator';
const BAGS = { small: { label: 'Small bag only', need: null }, cabin: { label: 'Cabin bag', need: { cabin: true } }, checked: { label: 'Checked bag', need: { checked: 1 } } };
const AIRPORTS = { zrh: { label: 'Zürich only', ok: (id) => id === 'ZRH' }, both: { label: '+ Basel', ok: (id) => X.home.places.includes(id) } };
const HOUR = 20; // what an hour of travel is worth, in CHF, when two holidays are compared
const access = (id) => X.home.access?.[id]?.h ?? 0;
const destOf = (j) => j.group === 'out' ? j.to : j.from, homeEnd = (j) => j.group === 'out' ? j.from : j.to;

function holidays() {
  const opts = { accept: state.accept, bags: BAGS[state.bags].need };
  const out = [];
  for (const o of T.groups.out) { if (!AIRPORTS[state.airports].ok(o.from)) continue;
    for (const r of T.groups.back) {
      if (r.from !== o.to || !AIRPORTS[state.airports].ok(r.to) || T.nights(o, r) !== NIGHTS) continue;
      const p = T.price([o, r], opts); if (!p) continue;
      const travel = o.arr - o.dep + r.arr - r.dep + access(o.from) + access(r.to);
      const bagsKnown = p.bagsKnown;
      // Leaving or landing between midnight and 05:00 costs a night's sleep; count it as three hours.
      const night = [o.depL.h, o.arrL.h, r.depL.h, r.arrL.h].filter((h) => h < 5).length ? 3 : 0;
      out.push({ id: o.id + '+' + r.id, o, r, p, price: p.total, travel, bagsKnown, night, dest: o.to, start: o.depL.date, score: p.total + HOUR * (travel + night) });
    }
  }
  return out.sort((a, b) => a.score - b.score);
}
const D = (id) => DESTS.find((d) => d.place === id);
let all = [], sel = null;
// The grid: for each destination and start date, the best holiday that starts that day.
const STARTS = [...new Set(T.groups.out.map((o) => o.depL.date))].sort();
const cellBest = (dest, date) => all.find((h) => h.dest === dest && h.start === date) || null;

// ---------- Chart ----------
const card = document.getElementById('card');
// The map keeps its routes above the card, so the padding comes from the card's real height.
const padFor = () => { const top = document.getElementById('card').getBoundingClientRect().top || innerHeight * .45;
  return innerWidth < 760 ? { left: 20, right: 20, top: 96, bottom: innerHeight - top + 10 } : { left: 60, right: 60, top: 110, bottom: innerHeight - top + 30 }; };
const chart = createChart({ el: '#map', trip: T, pad: padFor(), far: innerWidth < 760 ? 1.6 : innerHeight < 800 ? 2 : 2.6,
  onRouteHover(h) { if (!h) { tip.hide(); chart.where(null); tl?.cursor(null); return; }
    tip.show(h.event, `<b>${esc(h.j.carrierName)}</b> ${h.seg.from} → ${h.seg.to}<br>${fmtDur(h.T - h.seg.a)} flown, ${fmtDur(h.seg.b - h.T)} to go<br><span style="opacity:.7">${esc(chart.over(h.pt))}</span>`); } });

// ---------- Render ----------
let tl = null;
function render() {
  all = holidays();
  sel = all.find((h) => h.id === state.pick) || all[0] || null;
  if (sel) state.pick = sel.id;
  save();
  drawPostcard(); drawControls(); renderView();
  if (sel) chart.show({ chosen: [sel.o, sel.r], others: DESTS.map((d) => all.find((h) => h.dest === d.place)).filter(Boolean).flatMap((h) => [h.o]), ends: [homeEnd(sel.o), sel.dest] });
}
const save = () => { for (const k of ['accept', 'bags', 'airports', 'pick', 'view']) db.set(k, state[k]); };
const fdate = (l) => `${l.wd} ${l.day} ${l.mon}`;
const route = (j) => j.segments.length > 1 ? 'via ' + j.transfers.map((t) => t.ground ? `${t.at}→${t.next}` : t.at).join(', ') : 'nonstop';

function drawPostcard() {
  const el = document.getElementById('postcard');
  if (!sel) { el.innerHTML = `<div class="empty"><span class="pc-eyebrow">No holiday</span><p>No ${NIGHTS}-night trip fits these choices. Allow Basel or more sellers.</p></div>`; return; }
  const d = D(sel.dest), rank = all.indexOf(sel) + 1;
  const via = (j) => homeEnd(j) !== HOME ? ` · from ${T.places[homeEnd(j)].label}, ${esc(X.home.access[homeEnd(j)]?.text || '')}` : '';
  el.innerHTML = `
    <div class="info">
      <span class="pc-eyebrow">${rank === 1 ? 'Best value' : `Option ${rank} of ${all.length}`}</span>
      <h2>${esc(d.name)}<span>${d.jan_high_c}°</span></h2>
      <div class="pc-price">${money(sel.price)}${sel.bagsKnown ? '' : '<sup title="Bag fee not checked">+ bag?</sup>'}<small>${sel.p.deal ? esc(sel.p.deal.what) : sel.p.each.map((e) => esc(e.seller)).join(' + ')} · ${NIGHTS} nights</small></div>
      <div class="leg"><b>Out</b><span><em>${fdate(sel.o.depL)} ${sel.o.depL.hm}</em> · ${esc(sel.o.carrierName)}, ${route(sel.o)}${via(sel.o)}</span></div>
      <div class="leg"><b>Back</b><span><em>${fdate(sel.r.depL)} ${sel.r.depL.hm}</em> · ${esc(sel.r.carrierName)}, ${route(sel.r)}</span></div>
      <div class="facts"><span>Travel <b>${fmtDur(sel.travel)}</b></span><span>January high <b>${d.jan_high_c} °C</b></span>${sel.night ? '<span class="red">Leaves or lands at night</span>' : ''}</div>
    </div>
    <div class="addr"><svg width="150" height="96" style="overflow:visible">${stampSVG({ code: sel.dest, value: `${d.jan_high_c}°C`, x: 80 })}
      ${postmarkSVG({ top: `${sel.o.depL.wd.toUpperCase()} ${sel.o.depL.day}`, mid: sel.o.depL.hm, x: 30, y: 32, rot: -8, ink: 'var(--red)' })}${postmarkSVG({ top: `${sel.r.depL.wd.toUpperCase()} ${sel.r.depL.day}`, mid: sel.r.depL.hm, x: 60, y: 72, rot: 6 })}</svg>
      <div class="lines pc-hand"><div>${esc(d.where)}</div></div></div>
    <button class="pc-book" id="book"><span></span><b></b></button>`;
  document.getElementById('book').onclick = openCheckout; bookState();
}
function drawControls() {
  document.getElementById('ctl').innerHTML =
    chipsHTML('bags', Object.entries(BAGS).map(([k, b]) => [k, b.label]), state.bags) +
    chipsHTML('airports', Object.entries(AIRPORTS).map(([k, a]) => [k, a.label, k === 'both' ? X.home.access.BSL.text : '']), state.airports) +
    chipsHTML('accept', Object.entries(ACCEPT).map(([k, a]) => [k, a.label, a.help]), state.accept);
  wireChips(document.getElementById('ctl'), { bags: (k) => { state.bags = k; render(); }, airports: (k) => { state.airports = k; render(); }, accept: (k) => { state.accept = k; render(); } });
}

// ---------- Views ----------
const VIEWS = { weeks: 'Where and when', flights: 'Flights that week' };
const tabs = document.getElementById('tabs');
tabs.innerHTML = Object.entries(VIEWS).map(([k, l]) => `<button data-k="${k}">${l}</button>`).join('');
tabs.querySelectorAll('button').forEach((b) => b.onclick = () => { state.view = b.dataset.k; save(); renderView(); });
function renderView() {
  if (!VIEWS[state.view]) state.view = 'weeks';
  tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === state.view));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('off', v.dataset.v !== state.view));
  if (state.view === 'weeks') drawWeeks(); else drawFlights();
}
// Destinations down, start dates across. Each cell is the best holiday that starts that day.
function drawWeeks() {
  const el = document.getElementById('v-weeks');
  const prices = all.map((h) => h.price), lo = Math.min(...prices), hi = Math.max(...prices);
  const shade = (p) => hi > lo ? (p - lo) / (hi - lo) : 0;
  const head = STARTS.map((s) => { const l = T.clock.local(T.clock.H(s)); const e = T.clock.local(T.clock.H(s) + NIGHTS * 24); return `<th><b>${l.wd} ${l.day}</b> → ${e.day} ${e.mon}</th>`; }).join('');
  const foot = `Best value per cell: the price, plus CHF ${HOUR} for each hour of travel or a night flight. ${esc(X.bags_note || '')} Climate: ${DESTS.map((d) => `${esc(d.name)} ${esc(d.climate_source)}`).join('; ')}. Prices seen ${esc(T.raw.sources.seen)}.`;
  el.innerHTML = `<table class="grid"><colgroup><col class="name"><col class="t">${STARTS.map(() => '<col>').join('')}</colgroup><thead><tr><th></th><th class="num">Jan high</th>${head}</tr></thead><tbody>${DESTS.map((d) => `<tr><th><b>${esc(d.name)}</b><span>${esc(d.where)}</span></th><td class="num temp">${d.jan_high_c}°</td>${STARTS.map((s) => {
    const h = cellBest(d.place, s);
    if (!h) return `<td class="none">–</td>`;
    return `<td><button class="cell" data-id="${h.id}" aria-pressed="${h === sel}" style="--w:${Math.round((1 - shade(h.price)) * 100)}"><b>${money(h.price)}</b>${h.bagsKnown ? '' : '<i>+ bag?</i>'}<span title="${fmtDur(h.travel)} travel${homeEnd(h.o) !== HOME ? ', from ' + esc(T.places[homeEnd(h.o)].label) : ''}">${fmtDur(h.travel)}${homeEnd(h.o) !== HOME ? '<small class="ap"> · ' + homeEnd(h.o) + '</small>' : ''}</span></button></td>`; }).join('')}</tr>`).join('')}</tbody></table>
    <p class="foot" title="${foot}">${foot}</p>`;
  el.querySelectorAll('.cell').forEach((b) => { b.onclick = () => { state.pick = b.dataset.id; render(); };
    if (tip.canHover) b.onmouseenter = () => { const h = all.find((x) => x.id === b.dataset.id); tip.beside(b, `<b>${esc(D(h.dest).name)}</b>, ${fdate(h.o.depL)} → ${fdate(h.r.depL)}<br>Out ${h.o.depL.hm} ${esc(h.o.carrierName)}, ${route(h.o)}<br>Back ${h.r.depL.hm} ${esc(h.r.carrierName)}, ${route(h.r)}<br><b>${money(h.price)}</b>, travel ${fmtDur(h.travel)}`, { avoid: document.getElementById('card') }); };
    b.onmouseleave = tip.hide; });
}
// The chosen place and week: every flight out and back, on a day scale, so you can swap one.
function drawFlights() {
  const svg = document.getElementById('v-flights'); if (!sel) return;
  const outs = T.groups.out.filter((o) => o.to === sel.dest && o.depL.date === sel.o.depL.date && AIRPORTS[state.airports].ok(o.from));
  const backs = T.groups.back.filter((r) => r.from === sel.dest && r.depL.date === sel.r.depL.date && AIRPORTS[state.airports].ok(r.to));
  const from = Math.min(...outs.map((j) => j.dep)) - 3, to = Math.max(...backs.map((j) => j.arr)) + 3;
  const stay = { a: sel.o.arr, b: sel.r.dep, kind: 'stay', label: `${NIGHTS} nights in ${D(sel.dest).name}` };
  const n = Math.max(outs.length, backs.length);
  const price = (j) => T.best(j, { accept: state.accept, bags: BAGS[state.bags].need });
  tl = timeline(svg, T, { tip, from, to, scale: 'days', left: 130, rightPad: 120, clockLabel: 'Zürich time',
    bands: [{ label: 'Stay', spans: [stay] }],
    rows: [...Array(n)].map((_, i) => ({ label: i === 0 ? 'Flights' : '', journeys: [outs[i], backs[i]].filter(Boolean) })),
    lead: (j) => `${j.carrierName} ${j.depL.hm}`, side: (j) => { const p = price(j); return `${j.arrL.hm} · ${p ? money(p.total) : 'no seller'}`; },
    onHover: (j, e) => j ? tip.show(e, `<b>${esc(j.carrierName)}</b> ${j.from} → ${j.to}<br>${fdate(j.depL)} ${j.depL.hm} → ${j.arrL.hm} local · ${fmtDur(j.arr - j.dep)}, ${route(j)}${j.warning ? '<br>⚠ ' + esc(j.warning.text) : ''}`) : tip.hide(),
    onPick: (j) => { const o = j.group === 'out' ? j : sel.o, r = j.group === 'back' ? j : sel.r; const h = all.find((x) => x.o === o && x.r === r); if (h) { state.pick = h.id; render(); } },
    onTime: (t) => { if (t == null) { tl.cursor(null); chart.where(null); return; } const w = T.whereAt([sel.o, sel.r], t); tl.cursor(t, `${fdate(T.clock.local(t))} ${T.clock.local(t).hm} · ${w.moving ? w.status : w.status}`); chart.where(w); } });
  tl.paint({ chosen: new Set([sel.o.id, sel.r.id]), dim: (j) => !price(j) });
}

// ---------- Book ----------
const co = checkout({ id: T.raw.id, onJob: () => bookState() });
function bookState() { const b = document.getElementById('book'); if (!b) return; const job = co.busy();
  b.classList.toggle('busy', !!job); b.classList.toggle('pay', job?.status === 'at-payment');
  b.querySelector('span').textContent = job ? BUSY_TEXT[job.status] : `Book ${D(sel.dest).name}, ${sel.o.depL.day}-${sel.r.depL.day} ${sel.r.depL.mon}`;
  b.querySelector('b').textContent = job ? '' : money(sel.price); }
function openCheckout() {
  if (!sel) return; const d = D(sel.dest), bag = BAGS[state.bags];
  const item = (label, j, o) => ({ label, main: `${fdate(j.depL)} · ${j.depL.hm} → ${j.arrL.hm}`, price: sel.p.deal ? '' : money(o.total),
    meta: `${esc(j.carrierName)}${j.numbers ? ' ' + esc(j.numbers) : ''} · ${j.from} → ${j.to}, ${route(j)} · sold by <b>${esc(sel.p.deal?.seller || o.seller)}</b>` });
  const line = (j, o) => `- ${j.group === 'out' ? 'Out' : 'Back'}: ${j.carrierName}${j.numbers ? ' ' + j.numbers : ''}, ${j.from} → ${j.to}, ${j.depL.date} dep ${j.depL.hm} local, ${route(j)}. Expected about ${money(o.total)} from ${o.seller}.`;
  co.open({ title: `${d.name}, ${fdate(sel.o.depL)} → ${fdate(sel.r.depL)}`, sub: `${NIGHTS} nights · ${bag.label} · January high ${d.jan_high_c} °C`,
    items: [item('Out', sel.o, sel.p.each[0]), item('Back', sel.r, sel.p.each[1])], total: money(sel.price) + (sel.bagsKnown ? '' : ' + bag'),
    note: `${sel.bagsKnown ? '' : 'The bag fee was not checked; your agent adds it at booking and stops if the total is more than 15% above. '}Prices seen ${esc(T.raw.sources.seen)}.`,
    prompt: `Book my holiday: ${d.name}, ${NIGHTS} nights, 1 adult, ${bag.label.toLowerCase()}. Use my browser and stop on the payment page; do not pay.\n${line(sel.o, sel.p.each[0])}\n${line(sel.r, sel.p.each[1])}` +
      (sel.p.deal ? `\nBook both as: ${sel.p.deal.what}, expected ${money(sel.p.deal.total)}.` : '') + `\nIf the total with bags is more than 15% above ${money(sel.price)}, stop and tell me.`,
    trip: { title: T.raw.title, destination: d.name, journeys: [sel.o.raw, sel.r.raw], offers: sel.p.each, deal: sel.p.deal, price: sel.price, bags: state.bags } });
}

new ResizeObserver(() => renderView()).observe(document.querySelector('.views'));
new ResizeObserver(() => chart.setPad(padFor(), { duration: 0 })).observe(document.getElementById('card'));
addEventListener('resize', () => chart.setPad(padFor(), { duration: 0 }));
addEventListener('keydown', (e) => {
  if (document.getElementById('pc-sheetbg') && !document.getElementById('pc-sheetbg').hidden) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const i = all.indexOf(sel);
  if ((e.key === 'j' || e.key === 'k') && all.length) { state.pick = all[Math.max(0, Math.min(all.length - 1, i + (e.key === 'j' ? 1 : -1)))].id; render(); }
  if (e.key === 'Escape') tip.hide();   // Esc backs out one level; it never resets the pick (craft.md, rule 7)
  if (e.key === 'v') { state.view = state.view === 'weeks' ? 'flights' : 'weeks'; save(); renderView(); }
  if (e.key === 'b') openCheckout();
  if (e.key === '0') chart.reset();
});
render();
