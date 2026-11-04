// Junction 2026: flights to a hackathon, weighed against the event's schedule and the office hours lost.
// The kit draws the chart, the timeline and the checkout. This file is the trip's own model and HUD.
import { loadTrip, openTrip, ACCEPT } from '/kit/trip.js';
import { fmtDur } from '/kit/time.js';
import { createChart } from '/kit/chart.js';
import { timeline } from '/kit/timeline.js';
import { checkout, BUSY_TEXT } from '/kit/checkout.js';
import { esc, store, tooltip, chipsHTML, switchHTML, wireChips, stampSVG, postmarkSVG, cellsHTML } from '/kit/parts.js';

const T = await openTrip(await loadTrip());
const X = T.raw.context, money = T.money, CUR = T.currency;
document.title = T.raw.title;
document.getElementById('t-h1').textContent = T.raw.title;
document.getElementById('t-sub').textContent = T.raw.subtitle || '';
const HOME = X.home.place, DEST = X.destination.place, TOWN = X.destination.town || T.places[DEST].label, EVENT_NAME = X.event?.name || TOWN;
const OUT = T.groups.out, RET = T.groups.back;
const db = store(T.raw.id), tip = tooltip();

// ---------- Model ----------
const H = T.clock.H;
const EVENT = X.event ? { start: H(X.event.start), end: H(X.event.end) } : { start: T.T0, end: T.T1 };
const MOMENTS = (X.event?.moments || []).map((m) => ({ at: H(m.at), name: m.name, w: m.weight ?? 1, label: m.label }));
const WK = X.work, WTZ = WK?.tz || T.places[HOME].tz;
const WORK = (WK?.days || []).map((d) => ({ day: d, s: H(`${d}T${WK.start || '09:00'}`, WTZ), e: H(`${d}T${WK.end || '17:00'}`, WTZ) }));
const TO_VENUE = X.destination.transfer_h ?? 1, BEFORE = X.buffers?.before_departure_h ?? 2, AFTER = X.buffers?.after_arrival_h ?? 1;
const overlap = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
const state = { preset: db.get('preset', 'balanced'), remote: db.get('remote', false), buy: db.get('buy', 'operator', (v) => v in ACCEPT), out: db.get('out', null), ret: db.get('ret', null), view: db.get('view', 'timeline', ['timeline', 'trade', 'sellers', 'story']) };
if (!ACCEPT[state.buy]) state.buy = 'operator';
const priceOf = (j) => T.best(j, { accept: state.buy })?.total ?? null;

function evaluate(o, r) {
  const leave = o.dep - BEFORE, atVenue = o.arr + TO_VENUE, leaveVenue = r.dep - BEFORE, home = r.arr + AFTER;
  const spans = state.remote ? [[leave, atVenue], [leaveVenue, home]] : [[leave, home]];
  const lostByDay = WORK.map((w) => d3.sum(spans, ([a, b]) => overlap(w.s, w.e, a, b)));
  const seen = MOMENTS.map((m) => m.at >= atVenue && m.at <= leaveVenue);
  const p = T.price([o, r], { accept: state.buy });
  return { o, r, spans, p, price: p?.total ?? Infinity, travel: (o.arr - o.dep) + (r.arr - r.dep), lostByDay, lost: d3.sum(lostByDay),
    seen, missedW: d3.sum(MOMENTS, (m, i) => seen[i] ? 0 : m.w), atVenue, leaveVenue };
}
const PRESETS = {
  balanced: { label: 'Balanced', help: 'A fair mix of price, travel time, lost work and event time.', w: { price: 35, time: 20, work: 25, event: 20 } },
  cheap: { label: 'Cheapest', help: 'The lowest price, almost no matter what.', w: { price: 90, time: 5, work: 0, event: 5 } },
  work: { label: 'Work first', help: 'Lose the fewest office hours.', w: { price: 15, time: 5, work: 80, event: 0 }, needs: () => WORK.length },
  event: { label: 'Full event', help: `Be there for every part of ${EVENT_NAME}.`, w: { price: 15, time: 5, work: 5, event: 75 }, needs: () => MOMENTS.length },
};
if (!PRESETS[state.preset]) state.preset = 'balanced';
const totalW = d3.sum(MOMENTS, (m) => m.w) || 1;
function ranked() {
  const list = OUT.filter((o) => priceOf(o) != null).flatMap((o) => RET.filter((r) => priceOf(r) != null).map((r) => evaluate(o, r))).filter((c) => c.p);
  const pE = d3.extent(list, (c) => c.price), tE = d3.extent(list, (c) => c.travel), lMax = d3.max(list, (c) => c.lost) || 1;
  const W = PRESETS[state.preset].w, sum = d3.sum(Object.values(W)), n = (v, [a, b]) => b > a ? (v - a) / (b - a) : 0;
  for (const c of list) c.score = (W.price * n(c.price, pE) + W.time * n(c.travel, tE) + W.work * c.lost / lMax + W.event * c.missedW / totalW) / sum;
  return list.sort((a, b) => a.score - b.score || a.price - b.price);
}

// ---------- Words ----------
const viaText = (j) => j.segments.length > 1 ? j.transfers.map((t) => t.ground ? `${t.at}→${t.next}` : t.at).join(', ') : '';
const route = (j) => viaText(j) ? `via ${viaText(j)}` : 'nonstop';
const jTip = (j) => { const b = T.best(j, { accept: state.buy }), all = j.offers.map((o) => o.price);
  return `<b>${esc(j.carrierName)}</b> · ${j.from} → ${j.to}<br>${j.depL.wd} ${j.depL.hm} → ${j.arrL.wd} ${j.arrL.hm} local<br>${fmtDur(j.arr - j.dep)} · ${route(j)}<br>` +
    (b ? `<b>${money(b.total)}</b> from ${esc(b.seller)}${all.length > 1 ? ` · ${all.length} sellers, ${CUR} ${d3.min(all)}–${d3.max(all)}` : ''}` : `<span style="opacity:.75">No seller you accept. Choose "${ACCEPT.any.label}" to see it.</span>`) +
    (j.self ? `<br>⚠ Self-transfer: separate tickets` : '') + (j.warning ? `<br>⚠ ${esc(j.warning.text)}` : ''); };
const hhmm = (t) => { const l = T.clock.local(Math.round(t * 60) / 60); return `${l.wd} ${l.hm}`; };
function whereText(t, sel) {
  const w = T.whereAt([sel.o, sel.r], t);
  if (w.moving) return { w, text: `${w.j.carrierName}, ${chart.over(w.pt)}` };
  if (t < sel.o.dep && t >= sel.o.dep - BEFORE) return { w, text: `At ${T.places[sel.o.from].label} airport` };
  if (t > sel.r.arr && t <= sel.r.arr + AFTER) return { w, text: `Landed in ${T.places[sel.r.to].label}` };
  if (t > sel.o.arr && t < sel.r.dep) return { w, text: t < sel.atVenue ? `On the way to ${TOWN}` : t >= sel.r.dep - BEFORE ? `At ${T.places[sel.r.from].label} airport` : X.event && t >= EVENT.start && t <= EVENT.end ? `At ${EVENT_NAME}` : `In ${TOWN}` };
  return { w, text: w.status.replace(T.places[HOME].label, X.home.name || T.places[HOME].label) };
}

// ---------- Chart ----------
const hc = document.getElementById('hc');
let drawer = db.get('drawer', false);
// On a phone the card is at the bottom, so the map's free part ends at the card's top edge.
const padFor = () => innerWidth < 760 ? { left: 20, right: 20, top: 110, bottom: innerHeight - (document.getElementById('hc')?.getBoundingClientRect().top || innerHeight * .4) + 10 } : { left: 60, right: drawer ? 60 : 500, top: 110, bottom: drawer ? 470 : 60 };
const chart = createChart({ el: '#map', trip: T, pad: padFor(), far: innerWidth < 760 ? 1.6 : 2.6,
  onRouteHover(h) {
    if (!h) { tip.hide(); tl?.cursor(null); chart.where(null); return; }
    const { text } = whereText(h.T, sel);
    tl?.cursor(h.T, `${hhmm(h.T)} · ${text}`);
    tip.show(h.event, `<b>${h.j.group === 'out' ? 'Out' : 'Back'} · ${hhmm(h.T)}</b> ${esc(T.raw.clock_label || '').toLowerCase()}<br>${esc(h.j.carrierName)} ${h.seg.from} → ${h.seg.to} · ${fmtDur(h.T - h.seg.a)} flown, ${fmtDur(h.seg.b - h.T)} to go<br><span style="opacity:.7">${esc(chart.over(h.pt))}</span>`);
  } });

// ---------- Timeline ----------
let tl = null, sel = null, list = [];
const views = document.querySelector('.views');
function initTimeline() {
  tl = timeline(document.getElementById('v-timeline'), T, {
    tip, clockLabel: T.raw.clock_label,
    bands: [{ label: EVENT_NAME, spans: [{ a: EVENT.start, b: EVENT.end, kind: 'event' }], marks: MOMENTS }, ...(WORK.length ? [{ label: 'Office', spans: WORK.map((w) => ({ a: w.s, b: w.e, kind: 'work' })) }] : [])],
    rows: d3.range(Math.max(OUT.length, RET.length)).map((i) => ({ label: i === 0 ? 'Flights' : '', journeys: [OUT[i], RET[i]].filter(Boolean) })),
    lead: (j) => `${j.carrierName} ${j.depL.hm}`,
    side: (j) => { const p = priceOf(j); return `${j.arrL.hm}  ${p ?? '–'}${j.self ? ' · self-transfer' : j.warning ? ' · ' + (j.warning.short || 'check') : ''}`; },
    onPick: (j) => { state[j.group === 'out' ? 'out' : 'ret'] = j.id; save(); render(); },
    onHover: (j, e) => j ? tip.show(e, jTip(j)) : tip.hide(),
    onTime: (t) => { if (t == null) { tl.cursor(null); chart.where(null); return; } const { w, text } = whereText(t, sel); tl.cursor(t, `${hhmm(t)} · ${text}`); chart.where(w); },
  });
}
const save = () => { for (const k of ['preset', 'remote', 'buy', 'out', 'ret', 'view']) db.set(k, state[k]); };

// ---------- Render ----------
function render() {
  list = ranked();
  if (!list.length) { document.getElementById('postcard').innerHTML = `<div class="info"><span class="pc-eyebrow">No trip</span><p>No pair of flights has a seller you accept. Choose "${ACCEPT.any.label}".</p></div>`; return; }
  if (!list.some((c) => c.o.id === state.out && c.r.id === state.ret)) {
    const c = list.find((c) => c.o.id === state.out) || list.find((c) => c.r.id === state.ret) || list[0]; state.out = c.o.id; state.ret = c.r.id; save(); }
  sel = list.find((c) => c.o.id === state.out && c.r.id === state.ret);
  const rank = list.indexOf(sel) + 1, top5 = list.slice(0, 5), at = top5.indexOf(sel);
  const seenN = sel.seen.filter(Boolean).length;
  document.getElementById('postcard').innerHTML = `
    <div class="pick">
      <nav class="steps"><button class="stp" data-step="1" ${drawer ? '' : 'aria-current="step"'}><i>${drawer ? '✓' : 1}</i>Preview</button><span class="ln"></span><button class="stp" data-step="2" ${drawer ? 'aria-current="step"' : ''}><i>2</i>Choose tickets</button></nav>
      <span class="dots">${top5.map((c, i) => `<button data-i="${i}" aria-pressed="${i === at}" aria-label="Option ${i + 1}"></button>`).join('')}</span>
      <button class="step" data-d="-1" aria-label="Previous trip" ${rank <= 1 ? 'disabled' : ''}>‹</button><button class="step" data-d="1" aria-label="Next trip" ${rank >= list.length ? 'disabled' : ''}>›</button>
    </div>
    <div class="info">
      <span class="pc-eyebrow">${rank === 1 ? 'Best match' : `Option ${rank}`}</span>
      <div class="pc-price">${money(sel.price)}<small>${sel.p.deal ? `${esc(sel.p.deal.what)}, saves ${sel.p.split - sel.price}` : sellerLine(sel)}</small></div>
      <div class="leg"><b>Out</b><span><em>${sel.o.depL.wd} ${sel.o.depL.hm}</em> · ${esc(sel.o.carrierName)}, ${route(sel.o)}</span></div>
      <div class="leg"><b>Back</b><span><em>${sel.r.depL.wd} ${sel.r.depL.hm}</em> · ${esc(sel.r.carrierName)}, ${route(sel.r)}</span></div>
      <div class="meters">
        ${WORK.length ? `<div class="meter"><span>Work lost</span><span class="hours">${WORK.map((w, i) => cellsHTML(Math.round(w.e - w.s), Math.round(sel.lostByDay[i]))).join('')}</span><span>${fmtDur(sel.lost)}</span></div>` : ''}
        ${MOMENTS.length ? `<div class="meter"><span>${esc(EVENT_NAME)}</span><span class="moments">${sel.seen.map((s) => `<i class="${s ? '' : 'off'}"></i>`).join('')}</span><span>${seenN} of ${MOMENTS.length}</span></div>` : ''}
      </div>
    </div>
    <div class="rule"></div>
    <div class="addr">
      <svg width="168" height="96" style="overflow:visible">${stampSVG({ img: X.destination.stamp?.replace(/^kit\//, '/kit/'), code: DEST, value: money(sel.price) })}
        ${postmarkSVG({ top: `${sel.o.depL.wd.toUpperCase()} ${sel.o.depL.day}`, mid: sel.o.depL.hm, x: 34, y: 30, rot: -8, ink: 'var(--red)' })}${postmarkSVG({ top: `${sel.r.depL.wd.toUpperCase()} ${sel.r.depL.day}`, mid: sel.r.depL.hm, x: 66, y: 70, rot: 6 })}</svg>
      <div class="lines pc-hand"><div>${esc(X.destination.venue || TOWN)}</div><div>${esc(X.destination.address || '')}</div></div>
    </div>
    <div class="ctl">
      ${chipsHTML('preset', Object.entries(PRESETS).filter(([, p]) => !p.needs || p.needs()).map(([k, p]) => [k, p.label, p.help]), state.preset)}
      <div class="pc-chips" data-chips="buy">${Object.entries(ACCEPT).map(([k, a]) => `<button class="pc-chip" data-k="${k}" aria-pressed="${k === state.buy}" title="${esc(a.help)}">${a.label}</button>`).join('')}
        ${WORK.length ? `<span class="sep"></span>${switchHTML('remote', 'Remote', state.remote, WK.remote_days ? `I can work remotely on ${WK.remote_days}` : 'I can work remotely on travel days')}` : ''}</div>
    </div>
    <button class="pc-book" id="book"><span></span><b></b></button>`;
  const pc = document.getElementById('postcard');
  pc.querySelectorAll('.dots button').forEach((b) => b.onclick = () => pick(top5[+b.dataset.i]));
  pc.querySelectorAll('.step').forEach((b) => b.onclick = () => pick(list[Math.max(0, Math.min(list.length - 1, rank - 1 + +b.dataset.d))]));
  pc.querySelectorAll('.stp').forEach((b) => b.onclick = () => setDrawer(b.dataset.step === '2'));
  wireChips(pc, { buy: (k) => { state.buy = k; save(); render(); }, preset: (k) => { state.preset = k; state.out = state.ret = null; save(); render(); }, remote: (on) => { state.remote = on; state.out = state.ret = null; save(); render(); } });
  document.getElementById('book').onclick = () => !drawer && !co.busy() ? setDrawer(true) : openCheckout();
  bookState();
  chart.show({ chosen: [sel.o, sel.r], others: [...OUT, ...RET], ends: [HOME, DEST] });
  if (tl) {
    tl.paint({ chosen: new Set([sel.o.id, sel.r.id]), dim: (j) => priceOf(j) == null });
    const p0 = Math.max(EVENT.start, sel.atVenue), p1 = Math.min(EVENT.end, sel.leaveVenue);
    tl.overlay(0, p1 > p0 ? [[p0, p1]] : [], 'present'); tl.marks(0, sel.seen);
    if (WORK.length) tl.overlay(1, WORK.flatMap((w) => sel.spans.map(([a, b]) => [Math.max(w.s, a), Math.min(w.e, b)]).filter(([a, b]) => b > a)), 'lost');
  }
  if (drawer) renderView();
}
const pick = (c) => { state.out = c.o.id; state.ret = c.r.id; save(); render(); };
const sellerLine = (c) => { const e = c.p.each; return e.every((s) => s.kind === 'operator') ? 'two one-ways, airline sites' : e.map((s) => esc(s.seller)).join(' + '); };

// ---------- Views ----------
const VIEWS = { timeline: 'Timeline', trade: 'Trade-off', sellers: 'Where to buy', story: 'Itinerary' };
if (!VIEWS[state.view]) state.view = 'timeline';
const tabs = document.getElementById('tabs');
tabs.innerHTML = Object.entries(VIEWS).map(([k, l]) => `<button data-k="${k}">${l}</button>`).join('');
tabs.querySelectorAll('button').forEach((b) => b.onclick = () => { state.view = b.dataset.k; save(); tip.hide(); renderView(); });
function renderView() {
  tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === state.view));
  document.querySelectorAll('.views .view').forEach((v) => v.classList.toggle('off', v.dataset.v !== state.view));
  if (state.view === 'trade') drawTrade(); if (state.view === 'sellers') drawSellers(); if (state.view === 'story') drawStory();
}
function drawTrade() {
  const YV = WORK.length ? (c) => c.lost : (c) => c.travel, YL = WORK.length ? 'work lost' : 'travel time';
  const svg = d3.select('#v-trade'); svg.selectAll('*').remove();
  const { width: W, height: Hh } = svg.node().getBoundingClientRect(); const m = { l: 118, r: Math.min(290, W * .3), t: 16, b: 30 };
  const x = d3.scaleLinear().domain(d3.extent(list, (c) => c.price)).nice().range([m.l, W - m.r]), y = d3.scaleLinear().domain([0, Math.max(1, d3.max(list, YV))]).nice().range([Hh - m.b, m.t]);
  const g = svg.append('g');
  for (const v of x.ticks(8)) { g.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', m.t).attr('y2', Hh - m.b).attr('stroke', 'var(--rule2)'); g.append('text').attr('x', x(v)).attr('y', Hh - m.b + 14).attr('text-anchor', 'middle').attr('class', 'pc-tick').text(v); }
  for (const v of y.ticks(5)) { g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', 'var(--rule2)').attr('stroke-dasharray', v ? '2 3' : null); g.append('text').attr('x', m.l - 8).attr('y', y(v) + 3).attr('text-anchor', 'end').attr('class', 'pc-tick').text(v ? v + 'h' : '0'); }
  g.append('text').attr('x', 0).attr('y', m.t + 4).attr('class', 'pc-caps').text(YL.toUpperCase()); g.append('text').attr('x', 0).attr('y', Hh - m.b + 14).attr('class', 'pc-caps').text(`PRICE, ${CUR}`);
  g.append('text').attr('x', 0).attr('y', m.t + 20).attr('class', 'pc-note').attr('fill', 'var(--muted)').text('up is worse');
  const front = []; let best = Infinity;
  for (const c of [...list].sort((a, b) => a.price - b.price || YV(a) - YV(b))) if (YV(c) < best - 1e-6) { front.push(c); best = YV(c); }
  g.append('path').attr('d', d3.line().curve(d3.curveStepAfter).x((c) => x(c.price)).y((c) => y(YV(c)))(front)).attr('fill', 'none').attr('stroke', 'var(--ink)').attr('stroke-dasharray', '4 3').attr('opacity', .55);
  const r = (c) => 2.5 + c.seen.filter(Boolean).length * .75, full = (c) => c.seen.every(Boolean), isSel = (c) => c === sel;
  g.append('g').selectAll('circle').data([...list].sort((a, b) => isSel(a) - isSel(b))).join('circle').attr('cx', (c) => x(c.price)).attr('cy', (c) => y(YV(c))).attr('r', (c) => isSel(c) ? r(c) + 2 : r(c))
    .attr('fill', (c) => isSel(c) ? 'var(--red)' : full(c) ? 'var(--ink)' : 'var(--card)').attr('fill-opacity', (c) => isSel(c) ? 1 : full(c) ? .75 : 1)
    .attr('stroke', (c) => isSel(c) ? 'var(--card)' : full(c) ? 'none' : 'var(--red)').attr('stroke-width', (c) => isSel(c) ? 2 : 1).style('cursor', 'pointer')
    .on('mousemove', (e, c) => tip.show(e, `${jTip(c.o)}<br><br>${jTip(c.r)}<br><br>Work lost <b>${fmtDur(c.lost)}</b> · Missed: ${MOMENTS.filter((_, i) => !c.seen[i]).map((m) => m.name).join(', ') || 'nothing'}`))
    .on('mouseleave', tip.hide).on('click', (e, c) => pick(c));
  g.append('g').selectAll('text').data(list.slice(0, 5)).join('text').attr('x', (c) => x(c.price) + r(c) + 4).attr('y', (c) => y(YV(c)) - r(c) - 1).attr('class', 'pc-caps').attr('pointer-events', 'none').text((c, i) => i + 1);
  const k = svg.append('foreignObject').attr('x', W - m.r + 34).attr('y', m.t).attr('width', m.r - 40).attr('height', Hh - m.t);
  k.html(`<div class="readnote"><div class="pc-caps-h">How to read</div><p>Each dot pairs one flight out with one flight back: <b>${list.length}</b> pairings from <b>${ACCEPT[state.buy].label.replace('+ ', '')}</b>.${MOMENTS.length ? ` Bigger dots see more of ${esc(EVENT_NAME)}; filled dots see all of it.` : ''}</p>
    <p>The dashed line joins the trips that nothing beats on both price and ${YL}.</p><p>${front.includes(sel) ? `<b class="red">Your trip is on the line.</b> Saving more money costs ${WORK.length ? 'work' : 'time'}.` : `<b class="red">Your trip is above the line.</b> Another trip is cheaper and ${WORK.length ? 'loses no more work' : 'is no slower'}, but it may miss ${esc(EVENT_NAME)} moments.`}</p></div>`);
}
function drawSellers() {
  const el = document.getElementById('v-sellers');
  el.innerHTML = `<div class="head"><span>${esc(T.raw.sources?.note || 'Every seller we saw for your two journeys.')}</span><span>■ operator &nbsp; ○ agency (size = rating) &nbsp; <span class="red">▲ self-transfer</span></span></div><div class="rows"></div>`;
  const box = el.querySelector('.rows');
  for (const [k, j] of [['OUT', sel.o], ['BACK', sel.r]]) {
    const offers = [...j.offers].sort((a, b) => a.price - b.price), used = T.best(j, { accept: state.buy }), cheapest = offers[0];
    const row = document.createElement('div'); row.className = 'srow';
    row.innerHTML = `<div class="who"><b>${k}</b><em>${j.depL.wd} ${j.depL.hm} → ${j.arrL.hm}</em><span>${esc(j.carrierName)}${j.numbers ? ' ' + esc(j.numbers) : ''}<br>${route(j)}</span></div><svg></svg><div class="why"></div>`;
    box.append(row);
    const svg = d3.select(row.querySelector('svg')), Wd = row.querySelector('svg').getBoundingClientRect().width;
    const lo = d3.min(offers, (s) => s.price), hi = d3.max(offers, (s) => s.price), pad = Math.max(8, (hi - lo) * .12);
    const x = d3.scaleLinear().domain([lo - pad, hi + pad]).range([10, Wd - 10]);
    svg.append('line').attr('x1', 0).attr('x2', Wd).attr('y1', 34).attr('y2', 34).attr('stroke', 'var(--rule)');
    const lanes = [-14, 26, -27, 39], placed = lanes.map(() => []);
    const groups = d3.groups(offers, (s) => s.price).sort((a, b) => (b[1].includes(used) ? 1 : 0) - (a[1].includes(used) ? 1 : 0));
    for (const [price, ss] of groups) {
      const gx = x(price), isUsed = used && ss.some((s) => s.seller === used.seller && s.price === used.price), okAny = ss.some(ACCEPT[state.buy].ok), s0 = ss[0];
      const gg = svg.append('g').attr('transform', `translate(${gx},34)`).attr('opacity', okAny ? 1 : .38)
        .on('mousemove', (e) => tip.show(e, ss.map((s) => `<b>${esc(s.seller)}</b> · ${money(s.price)} · ${s.kind === 'operator' ? 'own site' : s.kind === 'self' ? 'self-transfer ticket' : 'agency'}${s.stars ? ` · ★ ${s.stars} (${(s.reviews || 0).toLocaleString('en')} reviews)` : s.kind !== 'operator' ? ' · rating not checked' : ''}<br><span style="opacity:.7">seen on ${esc(s.source)}, ${esc(s.seen)}</span>`).join('<br>'))).on('mouseleave', tip.hide);
      if (isUsed) gg.append('circle').attr('r', 10).attr('fill', 'none').attr('stroke', 'var(--red)').attr('stroke-width', 1.6);
      if (s0.kind === 'operator') gg.append('rect').attr('x', -5).attr('y', -5).attr('width', 10).attr('height', 10).attr('fill', 'var(--ink)');
      else if (s0.kind === 'self') gg.append('path').attr('d', 'M0 -6 L6 5 L-6 5 Z').attr('fill', 'var(--red)');
      else gg.append('circle').attr('r', 2.5 + (s0.stars || 2) * .9).attr('fill', 'var(--card)').attr('stroke', 'var(--ink)').attr('stroke-width', 1.2);
      const t = gg.append('text').attr('text-anchor', 'middle').style('font', `${isUsed ? 600 : 400} 10px var(--sans)`).attr('fill', isUsed ? 'var(--red)' : 'var(--ink2)').text(`${ss.map((s) => s.seller).join(', ')} ${price}`);
      const w = t.node().getComputedTextLength() + 10, a = gx - w / 2, b = gx + w / 2, li = Math.max(0, lanes.findIndex((_, i) => placed[i].every(([p, q]) => b < p || a > q)));
      placed[li].push([a, b]); t.attr('y', lanes[li]);
    }
    const reason = (s) => s.kind === 'self' ? 'it is a self-transfer ticket' : s.kind === 'agency' && !s.stars ? 'its rating was not checked' : s.kind === 'agency' && (s.stars < 4 || (s.reviews || 0) < 100) ? `it is rated ${s.stars} from ${s.reviews} reviews` : 'it is an agency';
    let txt = used ? `Using <b>${esc(used.seller)}</b>, ${money(used.total)}${used.kind === 'operator' ? ', the airline\'s own site.' : '.'}` : '<b>No seller you accept.</b>';
    if (used && cheapest.price < used.price) txt += ` ${esc(cheapest.seller)} sells it for ${money(cheapest.price)}, <b>${money(used.price - cheapest.price)} less</b>, but ${reason(cheapest)}.`;
    else if (used) txt += ' It is the cheapest seller we saw.';
    if (used && used.kind !== 'operator') txt += ` A change or refund goes through ${esc(used.seller)}, not ${esc(j.carrierName)}.`;
    if (j.warning) txt += ` <b>Note:</b> ${esc(j.warning.text)}`;
    if (j.self) txt += ' <b>Self-transfer:</b> if the first flight is late, the second airline owes you nothing.';
    row.querySelector('.why').innerHTML = txt;
  }
  const deals = T.deals.filter((d) => d.journeys.includes(sel.o.id) && d.journeys.includes(sel.r.id));
  if (deals.length) { const row = document.createElement('div'); row.className = 'srow';
    row.innerHTML = `<div class="who"><b>BOTH</b><em>Bought together</em></div><div style="font:italic 400 15px var(--serif)">${deals.map((z) => `${esc(z.what)}: <b>${money(z.price)}</b>`).join(' · ')}</div>
      <div class="why">${sel.p.deal ? `<b>Using the deal.</b> It is ${money(sel.p.split - sel.price)} less than two one-way tickets.` : `Two one-way tickets cost <b>${money(sel.p.split)}</b> here, which beats the deal or the deal's seller is not allowed.`}</div>`;
    box.append(row); }
}
function drawStory() {
  const el = document.getElementById('v-story'), { o, r } = sel;
  const at = (t, id) => { const l = T.clock.local(Math.round(t * 60) / 60, T.places[id].tz); return { day: `${l.wd.toUpperCase()} ${l.day}`, tm: l.hm, tz: T.clock.abbr(T.places[id].tz) }; };
  const early = (t, id) => { const e = X.destination.early; return e && T.clock.local(t, T.places[id].tz).hm < e.before ? e.text : null; };
  const legs = (j) => [{ t: j.dep, id: j.from, ti: `${j.carrierName} departs`, sb: `${T.places[j.from].label}${j.numbers ? ' · ' + j.numbers : ''}`, cls: 'fly', gap: `flight ${fmtDur(j.segments[0].b - j.segments[0].a)}` },
    ...j.transfers.map((t, i) => ({ t: t.a, id: t.at, ti: t.ground ? 'Self-transfer' : `Change in ${T.places[t.at].label}`, sb: t.ground ? `${t.at} → ${t.next}, ${fmtDur(t.b - t.a)} to make it` : `${fmtDur(t.b - t.a)} between flights`,
      cls: t.ground || t.b - t.a < .75 ? 'warn' : '', gap: `flight ${fmtDur(j.segments[i + 1].b - j.segments[i + 1].a)}` }))];
  const missed = MOMENTS.filter((_, i) => !sel.seen[i]).map((m) => m.name), n = sel.seen.filter(Boolean).length;
  const back = r.arr + AFTER, wd = WORK.find((w) => back < w.e && back > w.s - 2);
  const st = [{ t: o.dep - BEFORE, id: o.from, ti: 'Leave for the airport', sb: X.home.to_airport || `To ${o.from}`, gap: fmtDur(BEFORE) }, ...legs(o),
    { t: o.arr, id: o.to, ti: `Land in ${T.places[o.to].label}`, sb: X.destination.transfer || `To ${TOWN}`, gap: fmtDur(TO_VENUE) },
    { t: sel.atVenue, id: o.to, ti: `At ${X.event ? EVENT_NAME : TOWN}`, sb: MOMENTS.length ? `${n} of ${MOMENTS.length} moments${missed.length ? ' · misses ' + missed.join(', ') : ', the full event'}` : '', cls: 'event', gap: `${fmtDur(sel.leaveVenue - sel.atVenue)} in ${TOWN}` },
    { t: sel.leaveVenue, id: r.from, ti: `Leave for ${r.from}`, sb: early(sel.leaveVenue, r.from) || X.destination.to_airport || 'To the airport', gap: fmtDur(BEFORE) }, ...legs(r),
    { t: r.arr, id: r.to, ti: `Land in ${T.places[r.to].label}`, sb: X.home.from_airport || 'Home', gap: fmtDur(AFTER) },
    { t: back, id: r.to, ti: wd ? 'At your desk' : 'Home', sb: wd ? `${fmtDur(Math.max(0, back - wd.s))} after the day starts` : 'No work day lost on arrival' }];
  const shift = T.clock.shift(T.places[DEST].tz, T.places[HOME].tz), n2 = Math.abs(shift);
  el.innerHTML = `<div class="stations">${st.map((s, i) => { const a = at(s.t, s.id); return `<div class="st ${s.cls || ''}">${i < st.length - 1 && s.gap ? `<span class="gap">${s.gap} →</span>` : ''}<div class="day">${a.day}</div><div class="tm">${a.tm}<span class="tz">${a.tz}</span></div><div class="ti">${esc(s.ti)}</div><div class="sb">${esc(s.sb)}</div></div>`; }).join('')}</div>
    <div class="foot"><span>Price <b>${money(sel.price)}</b></span>${WORK.length ? `<span>Work lost <b>${fmtDur(sel.lost)}</b>${state.remote ? ' with remote travel days' : ''}</span>` : ''}${MOMENTS.length ? `<span>${esc(EVENT_NAME)} <b>${n} of ${MOMENTS.length}</b> moments</span>` : ''}
    <span style="margin-left:auto;color:var(--muted)">Local times. ${shift === 0 ? `${T.places[DEST].label} and ${T.places[HOME].label} share a clock.` : `${T.places[DEST].label} is ${n2} hour${n2 === 1 ? '' : 's'} ${shift > 0 ? 'ahead of' : 'behind'} ${T.places[HOME].label}.`}</span></div>`;
}

// ---------- Book ----------
const co = checkout({ id: T.raw.id, onJob: () => bookState() });
function bookState() {
  const b = document.getElementById('book'); if (!b) return; const job = co.busy();
  b.classList.toggle('busy', !!job); b.classList.toggle('pay', job?.status === 'at-payment');
  b.querySelector('span').textContent = job ? BUSY_TEXT[job.status] : drawer ? 'Book these flights' : 'Next: choose your tickets';
  b.querySelector('b').textContent = drawer && !job ? money(sel?.price) : '→';
}
function openCheckout() {
  const pax = T.raw.passengers?.adults || 1, paxText = `${pax} adult${pax > 1 ? 's' : ''}`;
  const item = (label, j, o) => ({ label, main: `${j.depL.wd} ${j.depL.day} ${j.depL.mon} · ${j.depL.hm} → ${j.arrL.hm}`, price: sel.p.deal ? '' : money(o.total),
    meta: `${esc(j.carrierName)}${j.numbers ? ' ' + esc(j.numbers) : ''} · ${route(j)} · sold by <b>${esc(sel.p.deal?.seller || o.seller)}</b>${o.url ? ` · <a href="${esc(o.url)}" target="_blank" rel="noopener">seller</a>` : ''}` });
  const line = (j, o) => `- ${j.group === 'out' ? 'Out' : 'Back'}: ${j.carrierName}${j.numbers ? ' ' + j.numbers : ''}, ${j.from} → ${j.to}, ${j.depL.date} dep ${j.depL.hm} local, arr ${j.arrL.wd} ${j.arrL.hm}, ${route(j)}. Expected about ${money(o.total)} from ${o.seller}, one-way${X.booking_note ? ', ' + X.booking_note : ''}.`;
  co.open({ title: `${sel.o.depL.wd} ${sel.o.depL.hm} → ${sel.r.depL.wd} ${sel.r.depL.hm}`,
    sub: [EVENT_NAME, WORK.length ? `${fmtDur(sel.lost)} of work lost` : '', MOMENTS.length ? `${sel.seen.filter(Boolean).length} of ${MOMENTS.length} event moments` : ''].filter(Boolean).join(' · '),
    items: [item('Out', sel.o, sel.p.each[0]), item('Back', sel.r, sel.p.each[1])], totalLabel: `Total, ${paxText}`, total: money(sel.price),
    note: `${sel.p.deal ? `One booking: ${esc(sel.p.deal.what)}.` : 'Two one-way tickets.'} ${[sel.o, sel.r].filter((j) => j.warning).map((j) => esc(j.warning.text)).join(' ')} Prices are from ${esc(T.raw.sources?.seen || 'the dates shown')} and can change.`,
    prompt: `Book my trip: ${T.raw.title} (${EVENT_NAME}), ${paxText}. Use my browser and stop on the payment page; do not pay.\n${line(sel.o, sel.p.each[0])}\n${line(sel.r, sel.p.each[1])}` +
      (sel.p.deal ? `\nBook both together as: ${sel.p.deal.what}, expected ${money(sel.p.deal.total)}.` : '') + `\nIf a price is more than 15% above the expected price, stop and tell me.`,
    trip: { title: T.raw.title, currency: CUR, journeys: [sel.o.raw, sel.r.raw], offers: sel.p.each, deal: sel.p.deal, price: sel.price, accept: state.buy } });
}

// ---------- Step 2 ----------
function setDrawer(on) {
  if (on === drawer) return;
  const w1 = hc.offsetWidth, h1 = hc.offsetHeight;
  drawer = on; db.set('drawer', on); hc.classList.toggle('open', on);
  if (on && !tl) initTimeline();
  render();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) hc.animate([{ width: w1 + 'px', height: h1 + 'px' }, { width: hc.offsetWidth + 'px', height: hc.offsetHeight + 'px' }], { duration: 520, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  chart.setPad(padFor());
}
document.getElementById('close2').onclick = () => setDrawer(false);
// The views draw to their box; draw again when it settles at another size.
const VS = { w: 0, h: 0 };
new ResizeObserver(() => { const r = views.getBoundingClientRect(); if (!drawer || (Math.abs(r.width - VS.w) < 1 && Math.abs(r.height - VS.h) < 1)) return;
  VS.w = r.width; VS.h = r.height; if (tl) tl.draw(); else initTimeline(); render(); }).observe(views);
addEventListener('resize', () => chart.setPad(padFor(), { duration: 0 }));
new ResizeObserver(() => { if (innerWidth < 760) chart.setPad(padFor(), { duration: 0 }); }).observe(document.getElementById('hc'));
addEventListener('keydown', (e) => {
  if (document.getElementById('pc-sheetbg') && !document.getElementById('pc-sheetbg').hidden) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const i = list.indexOf(sel);
  if (e.key === 'j' || e.key === 'k') pick(list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'j' ? 1 : -1)))]);
  if (e.key === 'Escape') drawer ? setDrawer(false) : pick(list[0]);
  if (e.key === 't') setDrawer(!drawer);
  if (e.key === 'b') openCheckout();
  if (e.key === '0') chart.reset();
  if (e.key === 'v') { const k = Object.keys(VIEWS); state.view = k[(k.indexOf(state.view) + 1) % k.length]; save(); if (!drawer) setDrawer(true); renderView(); }
});

hc.classList.toggle('open', drawer);
if (drawer) initTimeline();
render();
