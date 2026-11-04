// A bill: every part one option needs, door to door, with what is known about each part.
// Build one bill per option in the model. The row, the postcard, the book band, the checkout and the
// prompt all read it, so they can never disagree, and an unread fee can never turn into 0.
//
//   import { bill, fare } from '/kit/bill.js';
//   const b = bill(T, [
//     ...fare(T, j, offer, { cabin: 1 }, { ticket: 'out' }),                  // the fare and its bag fees
//     { what: 'Train Zürich HB → Basel SBB', amount: 40, state: 'estimate', basis: 'SBB list price', who: 'person' },
//     { what: 'Transfer to the hotel', amount: null, basis: 'not read', who: 'none' },
//   ]);
//   b.text()       -> "≈ CHF 234 + cabin bag fee not read"
//   b.book.text()  -> "≈ CHF 187 + cabin bag fee not read"   (only what the agent books)
//   b.tickets      -> one entry per ticket the agent buys, for the checkout and the prompt
//
// A part: {
//   what     plain words with place names, never ids ("easyJet U2 1025, Basel → Tenerife South")
//   amount   in the trip currency, for all passengers; null when it was not read
//   state    'read' | 'estimate' | 'unknown'. Default: 'read' with an amount, 'unknown' without one.
//   basis    where the amount comes from, or why it is unknown
//   limit    a condition on a read price that must travel with it ("from price; cabin type not read")
//   kind     what sort of part it is ('fare', 'cabin', 'checked', 'skis', ...); unread parts of one kind
//            are named together in the tail ("+ 2 cabin bag fees not read")
//   ticket   parts with the same ticket are one purchase (a fare and its bag fee)
//   seller, shop   who sells it ("easyJet", "easyjet.com")
//   who      'agent' (the agent books it; the default), 'person' (bought at the station, on the day),
//            'none' (paid on the way: fuel, tolls), or 'out' (named but not counted: hotels on a loop)
//   when     the local date and time, as the ticket shows it ("Tue 12 Jan 12:30")
//   bags     the bag terms for the prompt ("cabin bag included, 7 kg")
//   legs     each vehicle with its number, stops, date with year and times (fare() fills it)
// }
// An 'out' part is never in a total; it is listed beside it ("+ 8 hotel nights not counted").

const STATE = (p) => p.state || (p.amount == null ? 'unknown' : 'read');
const KIND = { fare: ['fare', 'fares'], berth: ['night class', 'night classes'], cabin: ['cabin bag fee', 'cabin bag fees'], checked: ['checked bag fee', 'checked bag fees'], small: ['small bag fee', 'small bag fees'] };
const kindName = (k, n) => (KIND[k] || [`${k} fee`, `${k} fees`])[n > 1 ? 1 : 0];
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
const stop = (s) => String(s || '').trim().replace(/[.\s]+$/, '');

export function bill(T, parts) {
  const all = parts.filter(Boolean).map((p) => ({ who: 'agent', ...p, state: STATE(p) }));
  const sum = (ps) => {
    const counted = ps.filter((p) => p.who !== 'out');
    const known = counted.filter((p) => p.amount != null);
    const missing = counted.filter((p) => p.amount == null);
    const r = {
      parts: ps,
      total: known.reduce((s, p) => s + p.amount, 0),
      // An estimate of 0 (a bag assumed included) adds nothing to the sum, so it does not make it ≈;
      // it is named in the limits instead.
      approx: known.some((p) => p.state === 'estimate' && p.amount !== 0),
      unknown: missing.map((p) => p.what),
      left: ps.filter((p) => p.who === 'out').map((p) => p.what),
      limits: [...new Set([...ps.map((p) => p.limit), ...ps.filter((p) => p.state === 'estimate' && p.amount === 0).map((p) => `${p.what} assumed 0`)].filter(Boolean))],
      // Nothing in it was read: the figure says so instead of a 0.
      none: !known.length && missing.length > 0,
    };
    r.known = !r.unknown.length;
    // Unread parts of one kind are one phrase: "2 cabin bag fees not read". A part without a kind is named.
    const groups = () => {
      const g = new Map();
      for (const p of missing) { const k = p.kind && p.kind !== 'other' ? p.kind : '#' + p.what; g.set(k, [...(g.get(k) || []), p]); }
      return [...g.entries()].flatMap(([k, xs]) => !k.startsWith('#') && xs.length > 1 ? [`${xs.length} ${kindName(k, xs.length)} not read`] : xs.map((p) => `${p.what} not read`));
    };
    r.missing = () => groups();
    // The figure: "≈ CHF 234", or "not read" when no part of it was read. Its tail lists what it leaves
    // out, next to it, never in a footer.
    // A part read as a "from" price (its limit says "from") makes the whole figure "from EUR 80".
    r.from = known.some((p) => /\bfrom\b/i.test(p.limit || ''));
    r.figure = () => r.none ? 'not read' : `${r.from ? 'from ' : ''}${r.approx ? '≈ ' : ''}${T.money(r.total)}`;
    // A 'from' the figure already says is not said again in the tail: "from EUR 289 + cabin type not read".
    const lim = () => r.limits.map((l) => r.from ? l.replace(/^from price[;,]?\s*/i, '') : l).filter(Boolean);
    r.all = () => [...groups(), ...lim(), ...r.left.map((w) => `${w} not counted`)];
    r.tail = ({ max = 2 } = {}) => {
      const xs = r.none ? [...lim(), ...r.left.map((w) => `${w} not counted`)] : r.all();
      if (xs.length <= max) return xs.map((x) => '+ ' + x).join(' ');
      return [...xs.slice(0, max - 1).map((x) => '+ ' + x), `+ ${xs.length - max + 1} more`].join(' ');
    };
    r.text = (o) => [r.figure(), r.tail(o)].filter(Boolean).join(' ');
    return r;
  };
  const b = sum(all);
  b.book = sum(all.filter((p) => p.who === 'agent'));
  // One entry per purchase the agent makes. A part without a ticket is its own purchase.
  const byTicket = new Map();
  all.filter((p) => p.who === 'agent').forEach((p, i) => {
    const k = p.ticket ?? '#' + i;
    if (!byTicket.has(k)) byTicket.set(k, []);
    byTicket.get(k).push(p);
  });
  b.tickets = [...byTicket.entries()].map(([ticket, ps]) => {
    const s = sum(ps), head = ps[0];
    return { ticket, seller: head.seller, shop: head.shop, when: head.when, what: head.what, legs: head.legs, fareRead: head.amount != null,
      bags: [...new Set(ps.map((p) => p.bags).filter(Boolean))].join('; '), ...s };
  });
  // The rest: what the person buys and what is paid on the way, for the checkout and the prompt.
  b.others = all.filter((p) => p.who === 'person' || p.who === 'none');
  const amt = (p) => p.amount == null ? 'not read' : `${p.state === 'estimate' ? '≈ ' : ''}${T.money(p.amount)}`;
  // Checkout items (checkout.js request.items), one per ticket, then the person's own purchases.
  // A seller's bag terms show once, on its first ticket.
  b.items = () => {
    const told = new Set();
    return [
      ...b.tickets.map((t) => {
        const bags = t.bags && !told.has(t.seller + t.bags) ? t.bags : '';
        if (bags) told.add(t.seller + t.bags);
        return { label: t.seller || 'Ticket', main: esc(t.what),
          price: esc(!t.fareRead ? 'fare not read' : t.figure() + (t.known ? '' : ' + ' + t.missing().join(' + '))),
          // A ticket of more than one vehicle shows each leg (the connection and the arrival), not only the start.
          meta: esc([t.legs?.includes('; ') ? t.legs : t.when, ...t.parts.slice(1).map((p) => `${p.what} ${amt(p)}`), ...t.limits, bags].filter(Boolean).join(' · ')) };
      }),
      ...b.others.map((p) => ({ label: p.who === 'person' ? 'You buy' : 'On the way', main: esc(p.what),
        price: esc(amt(p)), meta: esc(['Not in this booking', p.basis].filter(Boolean).join(' · ')) })),
    ];
  };
  // Prompt lines, one per ticket: what, when, seller, expected price, bags, limits and unknowns.
  b.promptLines = () => b.tickets.map((t, i) => {
    const steps = [];
    if (!t.fareRead) steps.push('The fare was not read: read it and report it before you fill anything');
    for (const p of t.parts.slice(1)) if (p.amount == null) steps.push(`${cap(p.what)} was not read: read it before you fill anything, and report it`);
    const price = !t.fareRead ? 'not known' : `${t.figure()}${t.approx ? ' (includes an estimate)' : ''}${t.known ? '' : ' plus the fees below'}`;
    return [`${i + 1}. ${stop(t.what)}${t.when ? `, ${t.when}` : ''}.`,
      t.legs ? `Legs: ${t.legs}.` : '',
      `Seller: ${t.seller || 'not known'}${t.shop ? ` (${t.shop})` : ''}.`,
      `Expected price: ${price}.`,
      t.bags ? `Bags: ${stop(t.bags)}.` : '',
      t.limits.length ? `Note: ${t.limits.map(stop).join('; ')}.` : '',
      ...steps.map((x) => x + '.')].filter(Boolean).join(' ');
  });
  return b;
}

// The parts of one journey bought from one offer: the fare, and one part per bag the person needs.
// need: { cabin: 1, checked: 4, skis: 4 } counts per journey. A fee the offer does not list, or lists as
// "fee", is a part with no amount; "none" (the fare cannot take it) is a part with no amount and a limit.
// opts: { ticket, who, when, label, shop, guess } (label replaces the default "carrier numbers, from → to").
// guess: { cabin: { value: 30, basis: 'easyJet list, Jan 2026' } } prices an unread fee as an estimate,
// per bag on this journey. For a journey of two flights that charge each, pass the value for both.
// A bag fee is named by the flights it is paid on, not by the journey's ends: on a train-and-flight
// journey, "cabin bag fee, Basel → Lanzarote".
// offer.limit is a condition that travels with the price ("from price"). offer.price_note is a note on
// the price (how it adds up); it goes to the basis, not to the limits.
export function fare(T, j, offer, need = {}, opts = {}) {
  const P = T.places, name = (id) => P[id]?.label || id;
  const label = opts.label || `${[j.carrierName, j.numbers].filter(Boolean).join(' ')}, ${name(j.from)} → ${name(j.to)}`;
  const ticket = opts.ticket ?? j.id, base = { ticket, who: opts.who || 'agent', seller: offer?.seller, shop: opts.shop };
  // The ticket's time is its own vehicle's: on a train-then-flight journey bought as a flight, the flight's departure.
  const fl = j.mode === 'mixed' && offer?.kind !== 'self' ? (j.segments || []).find((sg) => sg.mode === 'plane') : null;
  const dl = fl ? T.clock.local(fl.a, P[fl.from]?.tz) : j.depL;
  const when = opts.when || (dl ? `${dl.wd} ${dl.day} ${dl.mon} ${dl.hm}` : undefined);
  // Each vehicle of the journey, with its number, stops, full local date and times, for the prompt.
  const stopName = (id) => P[id]?.code || name(id);
  // A flight ticket on a train-then-flight journey lists only the flights; the trains are their own purchase.
  const legs = (j.segments || []).filter((sg) => !['walk', 'taxi'].includes(sg.mode) && (!fl || sg.mode === 'plane')).map((sg) => {
    const d = T.clock.local(sg.a, P[sg.from]?.tz), a = T.clock.local(sg.b, P[sg.to]?.tz);
    return `${sg.number || sg.carrier || sg.mode} ${stopName(sg.from)} ${d.wd} ${d.day} ${d.mon} ${d.year} ${d.hm} → ${stopName(sg.to)} ${a.hm}${a.date !== d.date ? ` (${a.wd} ${a.day} ${a.mon})` : ''}`;
  }).join('; ');
  const parts = [{ ...base, kind: 'fare', what: label, when, legs, amount: offer?.price ?? null,
    state: offer?.price == null ? 'unknown' : offer.basis === 'estimate' || offer.basis === 'other-date' ? 'estimate' : 'read',
    basis: offer?.price != null ? [`${offer.source || offer.seller}${offer.seen ? `, seen ${offer.seen}` : ''}`, offer.price_note].filter(Boolean).join('; ') : 'fare not read',
    limit: offer?.limit, bags: offer?.bags_note }];
  // A night train whose class was not read: the price may buy a seat or a bed. Say so wherever it goes.
  // (A ferry's cabin is the offer's limit: "cabin type not read".)
  const nightTrain = (j.segments || []).some((sg) => sg.mode === 'train' && sg.b - sg.a > 5 && T.clock.local(sg.a).h >= 18);
  if (j.raw?.overnight && (!j.raw.berth || j.raw.berth === 'unknown') && nightTrain)
    parts.push({ ...base, kind: 'berth', what: 'night class (seat or bed)', amount: null, basis: `class not read on ${[j.carrierName, j.numbers].filter(Boolean).join(' ')}` });
  const flights = (j.segments || []).filter((s) => s.mode === 'plane');
  const ends = flights.length ? `${name(flights[0].from)} → ${name(flights[flights.length - 1].to)}` : `${name(j.from)} → ${name(j.to)}`;
  const bags = offer?.bags || {};
  for (const [k, n] of Object.entries(need)) {
    if (!n) continue;
    const v = bags[k], what = `${n > 1 ? n + ' x ' : ''}${kindName(k, 1)}, ${ends}`;
    if (v === 'included') continue;
    const g = opts.guess?.[k], part = { ...base, kind: k, what };
    if (typeof v === 'number') parts.push({ ...part, amount: v * n, basis: offer.source });
    else if (g && v !== 'none') parts.push({ ...part, amount: g.value * n, state: 'estimate', basis: g.basis });
    else parts.push({ ...part, amount: null, basis: v === 'none' ? 'this fare cannot take it' : 'not read', limit: v === 'none' ? `this fare takes no ${kindName(k, 1).replace(/ fee$/, '')}` : undefined });
  }
  return parts;
}

const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
