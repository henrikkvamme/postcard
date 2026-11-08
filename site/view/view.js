// The hosted viewer: any trip.json on the postcard map, with one generic HUD. It draws on the device and
// stores nothing on the server. Booking needs the person's own agent (a public page cannot reach their
// localhost), so Book opens a sheet with the request to copy to the agent.
//
// Embedding (a later MCP App): this page is the unit. In an iframe it posts { type: 'postcard:ready' } to
// its parent and accepts { type: 'postcard:trip', trip } (an object or the JSON text) from it.
import { openTrip, ACCEPT, geo } from '/kit/trip.js';
import { fmtDur } from '/kit/time.js';
import { createChart } from '/kit/chart.js';
import { bill, fare } from '/kit/bill.js';
import { esc, store, sheet, chipsHTML, wireChips } from '/kit/parts.js';
import { prepare, fetchText, decodeData, encodeData, selfContained, filesFromDrop, filesFromInput, TripError } from './load.js';

const SITE = 'https://postcard.henrikkvamme.no';
const $ = (id) => document.getElementById(id);
const phone = () => innerWidth < 760;
const PENDING = 'postcard:view:pending', LASTMSG = 'postcard:view:last-message';

// ---------- Sources ----------
const status = (text, err = false) => { const s = $('status'); s.textContent = text; s.classList.toggle('err', err); };

async function fromHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.has('trip')) {
    const u = new URL(h.get('trip'), location.href);
    if (!/^https?:$/.test(u.protocol)) throw new TripError('The link must start with https:// or http://.');
    status('Reading the trip…');
    return prepare(await fetchText(u.href), { base: u.href });
  }
  if (h.has('data')) { status('Reading the trip…'); return prepare(await decodeData(h.get('data'))); }
  return null;
}

// A trip read after the first one opens on a fresh page: the link carries it when it fits, else this tab's storage.
async function openFresh(prepared, { link = null } = {}) {
  const text = link ? null : selfContained(prepared);
  const hash = new URLSearchParams(link ? { trip: link } : { data: await encodeData(text) }).toString();
  if (!T && hash.length < 1.9e6) { history.replaceState(null, '', '#' + hash); return show(prepared); }
  if (!T) return show(prepared);
  if (hash.length < 1.9e6) { location.hash = hash; return location.reload(); }
  try { sessionStorage.setItem(PENDING, text); history.replaceState(null, '', location.pathname); location.reload(); }
  catch { status('This trip is too large to open after another one. Reload the page, then drop it.', true); }
}

async function guard(fn) {
  try { await fn(); }
  catch (e) { console.warn('postcard viewer:', e); status(e instanceof TripError ? e.message : `The trip could not be shown: ${e.message}`, true); $('open').hidden = false; $('card').hidden = true; }
}

// Another source replaces what the embedding page sent, so its next message is new again.
const forgetMessage = () => { try { sessionStorage.removeItem(LASTMSG); } catch {} };

const fromFiles = (picked) => guard(async () => {
  forgetMessage();
  status('Reading the trip…');
  const { trip, files } = picked;
  await openFresh(await prepare(await trip.text(), { files }));
});

$('file').onchange = (e) => e.target.files.length && guard(async () => fromFiles(filesFromInput(e.target.files)));
$('folder').onchange = (e) => e.target.files.length && guard(async () => fromFiles(filesFromInput(e.target.files)));
$('urlform').onsubmit = (e) => { e.preventDefault(); const v = $('url').value.trim(); if (!v) return;
  guard(async () => { const u = new URL(v, location.href); if (!/^https?:$/.test(u.protocol)) throw new TripError('The link must start with https:// or http://.');
    forgetMessage(); status('Reading the trip…'); await openFresh(await prepare(await fetchText(u.href), { base: u.href }), { link: u.href }); }); };
addEventListener('hashchange', () => { forgetMessage(); location.reload(); });

// Drag and drop, anywhere on the page.
let depth = 0;
addEventListener('dragenter', (e) => { if (![...e.dataTransfer.types].includes('Files')) return; e.preventDefault(); depth++; $('dropzone').hidden = false; });
addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; $('dropzone').hidden = true; } });
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => { e.preventDefault(); depth = 0; $('dropzone').hidden = true;
  const dt = e.dataTransfer; guard(async () => fromFiles(await filesFromDrop(dt))); });

// The page that embeds this one can hand it a trip.
const embedded = window.parent !== window;
addEventListener('message', (e) => {
  if (!embedded || e.source !== window.parent || e.data?.type !== 'postcard:trip') return;
  const t = e.data.trip, text = typeof t === 'string' ? t : JSON.stringify(t);
  // A parent that answers every 'postcard:ready' with its trip must not reload this page in a loop.
  let last = null; try { last = sessionStorage.getItem(LASTMSG); } catch {}
  if (T && text === last) return;
  try { sessionStorage.setItem(LASTMSG, text); } catch {}
  guard(async () => openFresh(await prepare(text)));
});

// ---------- The trip ----------
let T = null, chart = null, db = null, FULL = {};
const S = { accept: 'any', pick: {} };

const city = (id) => T.places[id]?.city || T.places[id]?.label || id;
// Two ends meet when they are one place, in one city, or within 40 km (an airport and its city station).
const meet = (a, b) => a === b || (T.places[a].city && T.places[a].city === T.places[b].city) || geo.km(T.places[a].coord, T.places[b].coord) < 40;
const fits = (a, b) => b.dep >= a.arr && meet(a.to, b.from);
const priceOf = (j) => T.best(j, { accept: S.accept });

let ORDER = [];   // groups by first departure
const chainOf = (pick) => ORDER.map((g) => T.byId[pick[g]]).filter(Boolean).sort((a, b) => a.dep - b.dep);
const chainOk = (js) => js.every((j, i) => !i || fits(js[i - 1], j));

const SEARCH = 2e5;   // most chains to try in full
const sizeOf = () => ORDER.reduce((n, g) => n * Math.max(1, T.groups[g].length), 1);
let WHOLE = false;    // the trip has at least one chain with a journey in every group

// After the person picks j: the whole chain through j that keeps most of their other picks, then the cheapest.
// Without a whole chain (or with too many to try), the greedy fill below.
function settle(pick, fixed) {
  const fj = T.byId[pick[fixed]];
  if (WHOLE && sizeOf() <= SEARCH) {
    const total = (js) => T.price(js, { accept: S.accept })?.total ?? Infinity;
    const kept = (js) => js.filter((j) => pick[j.group] === j.id).length;
    const best = T.combos(ORDER, (js) => js.includes(fj) && chainOk(js)).map((js) => [kept(js), total(js), js])
      .sort((a, b) => b[0] - a[0] || a[1] - b[1])[0];
    if (best) return Object.fromEntries(best[2].map((j) => [j.group, j.id]));
  }
  return fill(pick, fixed);
}

// The cheapest journey in each group that fits the ones before and after it, keeping a pick that still fits.
function fill(pick, fixed) {
  const out = { ...pick }, start = Math.max(0, ORDER.indexOf(fixed));
  const cost = (j) => priceOf(j)?.total ?? Infinity;
  const choose = (g, ok) => { const keep = T.byId[out[g]]; if (keep && ok(keep)) return keep.id;
    const c = (T.groups[g] || []).filter(ok).sort((a, b) => cost(a) - cost(b) || a.dep - b.dep)[0]; return c ? c.id : undefined; };
  const prevPick = (i) => { for (let k = i - 1; k >= 0; k--) if (T.byId[out[ORDER[k]]]) return T.byId[out[ORDER[k]]]; return null; };
  const nextPick = (i) => { for (let k = i + 1; k < ORDER.length; k++) if (T.byId[out[ORDER[k]]]) return T.byId[out[ORDER[k]]]; return null; };
  for (let i = start + 1; i < ORDER.length; i++) { const p = prevPick(i); out[ORDER[i]] = choose(ORDER[i], (j) => !p || fits(p, j)); }
  for (let i = start - 1; i >= 0; i--) { const n = nextPick(i), p = prevPick(i); out[ORDER[i]] = choose(ORDER[i], (j) => (!n || fits(j, n)) && (!p || fits(p, j))); }
  for (const g of Object.keys(out)) if (out[g] === undefined) delete out[g];
  return out;
}

// The first pick: the cheapest whole chain when the groups are few enough to try them all, else settle().
function firstPick() {
  if (sizeOf() <= SEARCH) {
    const total = (js) => T.price(js, { accept: S.accept })?.total ?? Infinity;
    const best = T.combos(ORDER, (js) => chainOk(js)).map((js) => [total(js), js]).sort((a, b) => a[0] - b[0])[0];
    WHOLE = !!best;
    if (best) return Object.fromEntries(best[1].map((j) => [j.group, j.id]));
  } else WHOLE = true;  // too many to try: assume whole chains exist, so a gap blocks Book
  const g0 = ORDER[0], first = [...T.groups[g0]].sort((a, b) => (priceOf(a)?.total ?? Infinity) - (priceOf(b)?.total ?? Infinity))[0];
  return fill({ [g0]: first.id }, g0);
}

// ---------- The bill of the pick ----------
// One ticket per journey, or one for a deal that covers the whole chain when it is cheaper.
function billOf(js) {
  const p = T.price(js, { accept: S.accept });
  if (p?.deal) {
    const d = p.deal, heads = js.map((j) => fare(T, j, { ...d, price: null })[0]);
    return bill(T, [{ ticket: 'deal', kind: 'fare', who: 'agent', seller: d.seller, amount: d.price,
      state: d.basis === 'estimate' ? 'estimate' : 'read', basis: [d.source || d.seller, d.seen && `seen ${d.seen}`].filter(Boolean).join(', '),
      what: [d.what, heads.map((h) => h.what).join(' + ')].filter(Boolean).join(': '), when: heads[0].when,
      legs: heads.map((h) => h.legs).filter(Boolean).join('; '), trip: heads[0].trip, limit: d.limit, bags: d.bags_note }]);
  }
  return bill(T, js.flatMap((j) => { const o = priceOf(j); return fare(T, j, o || { seller: j.carrierName }, {}, { ticket: j.id }); }));
}

function promptOf(js, b) {
  const R = T.raw, px = R.passengers || {}, kids = px.children ? `, ${px.children} ${px.children === 1 ? 'child' : 'children'}${px.children_ages?.length ? ` (age ${px.children_ages.join(', ')})` : ''}` : '';
  const warn = js.flatMap((j) => warningsOf(j).map((w) => `${j.carrierName || ''} ${j.depL.wd} ${j.depL.day} ${j.depL.mon}: ${w}`.trim()));
  return [
    `Book this trip with the postcard skill (${SITE}/llms.txt). Use my browser. Fill each booking and stop at the payment page. Do not pay, and do not type card details.`,
    '',
    `Trip: ${R.title || 'Trip'}${R.subtitle ? `. ${R.subtitle}` : ''}.`,
    `Passengers: ${px.adults ?? 1} ${px.adults === 1 ? 'adult' : 'adults'}${kids}. Prices are for all passengers together, in ${T.currency}.`,
    'Tickets:',
    ...b.promptLines(),
    ...(warn.length ? ['', 'Warnings:', ...warn.map((w) => `- ${w}`)] : []),
    '',
    `The prices were read${R.sources?.seen ? ` on ${R.sources.seen}` : ''}. Read each price again on the seller's page. When it is higher than above, or a bag fee applies, ask me before you go on.`,
  ].join('\n');
}

// What the person must know before buying: the trip's own warning, a self-transfer, a change of airport or station.
function warningsOf(j) {
  const out = [];
  if (j.warning) out.push(j.warning.text || j.warning.short);
  if (j.self && !/self.?transfer/i.test(j.warning?.text || j.warning?.short || '')) out.push('Self-transfer: separate tickets, so a missed connection is your risk.');
  for (const t of j.transfers || []) if (t.ground) out.push(`Change of place in ${city(t.at)}: ${T.places[t.at].code || FULL[t.at]} to ${T.places[t.next].code || FULL[t.next]}, ${fmtDur(t.b - t.a)} between.`);
  return out;
}
const chipOf = (j) => j.warning?.short || (j.self ? 'self-transfer' : (j.transfers || []).some((t) => t.ground) ? 'change of airport' : '');

// ---------- Paint ----------
const svg = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true">${d}</svg>`;
const ICON = {
  train: svg('<path d="M5 2.5h6a2 2 0 0 1 2 2V10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2zM3 7.5h10M5.5 14.5l1-2.5M10.5 14.5l-1-2.5"/>'),
  bus: svg('<rect x="2.5" y="2.5" width="11" height="9.5" rx="1.8"/><path d="M2.5 7.5h11M4.8 12v2M11.2 12v2"/>'),
  ferry: svg('<path d="M1.8 9.8h12.4l-2.1 3.7H3.9zM4.6 9.8V6.8h6.8v3M7 6.8V4.3h2.2v2.5"/>'),
  plane: svg('<path d="M14 8.6 9 6.6V3a1 1 0 0 0-2 0v3.6L2 8.6v1.5l5-1.2v2.8l-1.6 1.2v1.1L8 13.3l2.6.7v-1.1L9 11.7V8.9l5 1.2z"/>'),
  car: svg('<path d="M2.5 10.5V8.2l1.6-3.4h7.8l1.6 3.4v2.3zM2.5 10.5v2M13.5 10.5v2M2.5 8.2h11"/>'),
  x: svg('<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>'),
};
ICON.coach = ICON.bus; ICON.taxi = ICON.car; ICON.mixed = ICON.train; ICON.walk = ICON.car;
const days = (a, b) => Math.round((Date.parse(b.date) - Date.parse(a.date)) / 86400000);
const changes = (j) => { const n = Math.max(0, (j.segments?.length || 1) - 1); return n ? `${n} ${n === 1 ? 'change' : 'changes'}` : 'direct'; };
const groupName = (g) => { const js = T.groups[g], a = new Set(js.map((j) => city(j.from))), b = new Set(js.map((j) => city(j.to)));
  if (a.size === 1 && b.size === 1) return `${[...a][0]} → ${[...b][0]}`;
  return g.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase()); };
const oneDay = (g) => new Set(T.groups[g].map((j) => j.depL.date)).size === 1;
const groupDays = (g) => { const ds = [...new Set(T.groups[g].map((j) => `${j.depL.wd} ${j.depL.day} ${j.depL.mon}`))];
  return ds.length === 1 ? ds[0] : `${ds.length} days`; };

function rowHTML(j, on, off) {
  const o = priceOf(j), b = o && bill(T, fare(T, j, o));
  const price = b ? esc(b.figure()) : '<span class="dash" title="No price read">–</span>', tail = b ? b.tail({ max: 2 }) : '';
  const plus = days(j.depL, j.arrL);
  return `<button type="button" class="row${on ? ' on' : ''}${off ? ' off' : ''}" data-j="${esc(j.id)}" aria-pressed="${on}"${off ? ' title="Does not fit your other picks. Pick it to change them."' : ''}>
    <span class="ic">${ICON[j.mode] || ICON.train}</span>
    <span class="tm"><b>${esc(j.depL.hm)}</b><i>→</i><b>${esc(j.arrL.hm)}${plus > 0 ? `<sup>+${plus}</sup>` : ''}</b>${ORDER.length && groupName(j.group).includes('→') ? '' : `<em>${esc(city(j.from))} → ${esc(city(j.to))}</em>`}</span>
    <span class="pr">${price}</span>
    <span class="by">${esc([j.carrierName, oneDay(j.group) ? '' : `${j.depL.wd} ${j.depL.day} ${j.depL.mon}`, fmtDur(j.arr - j.dep), changes(j)].filter(Boolean).join(' · '))}${chipOf(j) ? ` · <span class="warn">${esc(chipOf(j))}</span>` : ''}</span>${tail ? `
    <span class="lim">${esc(tail)}</span>` : ''}
  </button>`;
}

function paint() {
  const js = chainOf(S.pick);
  $('legs').innerHTML = ORDER.map((g) => {
    const picked = T.byId[S.pick[g]], idx = ORDER.indexOf(g);
    const before = chainOf(Object.fromEntries(ORDER.slice(0, idx).map((k) => [k, S.pick[k]]))).at(-1);
    const after = chainOf(Object.fromEntries(ORDER.slice(idx + 1).map((k) => [k, S.pick[k]])))[0];
    const rows = [...T.groups[g]].sort((a, b) => a.dep - b.dep)
      .map((j) => rowHTML(j, picked?.id === j.id, (before && !fits(before, j)) || (after && !fits(j, after)))).join('');
    return `<section class="leg"><h2><span>${esc(groupName(g))}</span><small>${esc(groupDays(g))}</small></h2>${picked ? '' : '<p class="none">No way here fits your other picks.</p>'}${rows}</section>`;
  }).join('');
  const b = billOf(js), gaps = WHOLE ? ORDER.filter((g) => !S.pick[g]).length : 0, ok = js.length && !gaps;
  $('book-l').innerHTML = !js.length ? 'Pick a way' : gaps ? esc(`${gaps} ${gaps === 1 ? 'leg has' : 'legs have'} no way that fits`)
    : `${esc(`Book ${b.tickets.length} ${b.tickets.length === 1 ? 'ticket' : 'tickets'}`)}${b.book.tail({ max: 2 }) ? `<small>${esc(b.book.tail({ max: 2 }))}</small>` : ''}`;
  $('book-p').textContent = ok ? b.book.figure() : '';
  $('book').title = ok ? b.book.text({ max: 99 }) : '';
  $('book').disabled = !ok;
  if (chart) {
    const chosen = new Set(js.map((j) => j.id)), ends = [...new Set(js.flatMap((j) => [j.from, j.to]))];
    chart.show({ chosen: js, others: T.journeys.filter((j) => !chosen.has(j.id)).slice(0, 80), ends });
  }
}

$('legs').addEventListener('click', (e) => {
  const r = e.target.closest('.row'); if (!r) return;
  const j = T.byId[r.dataset.j];
  S.pick = settle({ ...S.pick, [j.group]: j.id }, j.group); db.set('pick', S.pick);
  const top = $('legs').scrollTop; paint(); $('legs').scrollTop = top;
  $('legs').querySelector(`.row[data-j="${CSS.escape(j.id)}"]`)?.focus({ preventScroll: true });
});

// ---------- Book: the request for the person's agent ----------
const co = sheet('Book with your agent');
$('book').onclick = () => {
  const js = chainOf(S.pick); if ($('book').disabled || !js.length) return;
  const b = billOf(js), prompt = promptOf(js, b), fig = b.book.figure();
  const rows = b.tickets.map((t) => { const tr = t.trip;
    return `<li><div class="pc-co-sum"><span class="pc-co-ic">${ICON[tr?.mode] || ICON.train}</span>
      <span class="pc-co-day">${tr ? esc(`${tr.dep.wd} ${tr.dep.day} ${tr.dep.mon}`) : ''}</span>
      <span class="pc-co-tm">${tr ? `<b>${esc(tr.dep.hm)}</b> ${esc(tr.from)}<i>→</i><b>${esc(tr.arr.hm)}</b> ${esc(tr.to)}` : esc(t.what)}</span>
      <span class="pc-co-pr">${t.fareRead ? esc(t.figure()) : '<span class="pc-co-dash">fare not read</span>'}</span>
      <span class="pc-co-by">${esc([tr?.by, t.seller && `sold by ${t.seller}`, ...t.limits].filter(Boolean).join(' · '))}</span></div></li>`; }).join('');
  co.show(`<div class="pc-co vco">
    <button class="pc-co-x" id="vco-x" aria-label="Close">${ICON.x}</button>
    <div class="pc-eyebrow">${b.tickets.length === 1 ? 'Book 1 ticket' : `Book ${b.tickets.length} tickets`}</div>
    <h2>${esc(T.raw.title || 'Your trip')}</h2>
    <ol class="pc-co-list">${rows}</ol>
    <div class="pc-co-total"><span>Total</span><b>${esc(fig)}</b>${b.book.tail({ max: 3 }) ? `<small>${esc(b.book.tail({ max: 3 }).replace(/^\+ /, '').split(' + ').join(' · '))}</small>` : ''}</div>
    <p class="vco-how">This page runs only in your browser, so it cannot reach your agent. Copy the request and paste it to your agent. It fills the booking in your browser and stops at the payment page. You pay.</p>
    <details class="vco-prompt"><summary>Show the request</summary><pre>${esc(prompt)}</pre></details>
    <button class="pc-co-go" id="vco-copy" type="button">Copy for my agent</button>
    <p class="vco-fine">No postcard skill yet? Your agent installs it from <a href="${SITE}/llms.txt" target="_blank" rel="noopener">llms.txt</a>.</p>
  </div>`);
  co.el.querySelector('#vco-x').onclick = () => co.close();
  co.el.querySelector('#vco-copy').onclick = async (e) => { const btn = e.currentTarget;
    try { await navigator.clipboard.writeText(prompt); btn.textContent = 'Copied. Paste it to your agent'; }
    catch { const d = co.el.querySelector('.vco-prompt'); d.open = true; getSelection().selectAllChildren(d.querySelector('pre')); btn.textContent = 'Press ⌘C to copy'; } };
};

// ---------- Show ----------
const padFor = () => {
  const c = $('card').getBoundingClientRect();
  return phone() ? { left: 24, right: 24, top: 40, bottom: Math.round(innerHeight - c.top + 16) }
    : { left: Math.round(c.right + 48), right: 64, top: 64, bottom: 64 };
};

async function show(prepared) {
  T = await openTrip({ raw: prepared.raw, base: new URL(prepared.base || location.href) });
  // The chart labels a place by its name; a city reads better on the map than "Oslo ferry terminal (Akershusstranda)".
  FULL = Object.fromEntries(Object.entries(T.places).map(([id, p]) => [id, p.name]));
  for (const p of Object.values(T.places)) p.name = p.label;
  db = store('view:' + (T.raw.id || 'trip'));  // apart from the trip's own page on this site
  ORDER = Object.keys(T.groups).sort((a, b) => Math.min(...T.groups[a].map((j) => j.dep)) - Math.min(...T.groups[b].map((j) => j.dep)));
  const kinds = new Set(T.journeys.flatMap((j) => j.offers.map((o) => o.kind)));
  S.accept = db.get('accept', 'any', Object.keys(ACCEPT));
  const saved = db.get('pick', null, (p) => p && typeof p === 'object' && Object.entries(p).every(([g, id]) => T.byId[id]?.group === g));
  const first = firstPick();   // also learns whether whole chains exist
  S.pick = saved && chainOk(chainOf(saved)) && (!WHOLE || ORDER.every((g) => saved[g])) ? saved : first;

  document.title = `${T.raw.title || 'Trip'} · Postcard`;
  $('title').textContent = T.raw.title || 'Your trip';
  $('sub').textContent = T.raw.subtitle || '';
  const seen = T.raw.sources?.seen;
  $('seen').textContent = seen ? `Prices read ${seen}` : 'Prices';
  $('seen').title = T.raw.sources?.note || '';
  $('ctl').innerHTML = kinds.size > 1 ? chipsHTML('accept', Object.entries(ACCEPT).map(([k, a]) => [k, esc(a.label), a.help]), S.accept) : '';
  wireChips($('ctl'), { accept: (k) => { S.accept = k; db.set('accept', k); $('ctl').querySelectorAll('[data-k]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k))); paint(); } });
  $('open').hidden = true; $('card').hidden = false; status('');
  if (prepared.missing.length) console.warn('postcard viewer: paths not read, drawn as straight dashes:', prepared.missing);

  chart = createChart({ el: '#map', trip: T, pad: padFor(), far: phone() ? 1.6 : 2.6 });
  paint();
  new ResizeObserver(() => chart.setPad(padFor(), { duration: 0 })).observe($('card'));
  addEventListener('resize', () => chart.setPad(padFor(), { duration: 0 }));
  if (embedded) window.parent.postMessage({ type: 'postcard:shown', id: T.raw.id }, '*');
}

// ---------- Start ----------
guard(async () => {
  let pending = null; try { pending = sessionStorage.getItem(PENDING); sessionStorage.removeItem(PENDING); } catch {}
  const prepared = pending ? await prepare(pending) : await fromHash();
  if (prepared) await show(prepared);
  else { document.body.classList.remove('intro'); status(''); }
  if (embedded) window.parent.postMessage({ type: 'postcard:ready' }, '*');
});
