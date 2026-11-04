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
//   ticket   parts with the same ticket are one purchase (a fare and its bag fee)
//   seller, shop   who sells it ("easyJet", "easyjet.com")
//   who      'agent' (the agent books it; the default), 'person' (bought at the station, on the day),
//            'none' (paid on the way: fuel, tolls), or 'out' (named but not counted: hotels on a loop)
//   when     the local date and time, as the ticket shows it ("Tue 12 Jan 12:30")
//   bags     the bag terms for the prompt ("cabin bag included, 7 kg")
// }
// An 'out' part is never in a total; it is listed beside it ("+ 8 hotel nights not counted").

const STATE = (p) => p.state || (p.amount == null ? 'unknown' : 'read');

export function bill(T, parts) {
  const all = parts.filter(Boolean).map((p) => ({ who: 'agent', ...p, state: STATE(p) }));
  const sum = (ps) => {
    const counted = ps.filter((p) => p.who !== 'out');
    const known = counted.filter((p) => p.amount != null);
    const r = {
      parts: ps,
      total: known.reduce((s, p) => s + p.amount, 0),
      approx: known.some((p) => p.state === 'estimate'),
      unknown: counted.filter((p) => p.amount == null).map((p) => p.what),
      left: ps.filter((p) => p.who === 'out').map((p) => p.what),
      limits: [...new Set(ps.map((p) => p.limit).filter(Boolean))],
    };
    r.known = !r.unknown.length;
    // The figure: "≈ CHF 234". Its tail lists what it leaves out, next to it, never in a footer.
    r.figure = () => `${r.approx ? '≈ ' : ''}${T.money(r.total)}`;
    r.tail = ({ max = 2 } = {}) => {
      const xs = [...r.unknown.map((w) => `${w} not read`), ...r.limits, ...r.left.map((w) => `${w} not counted`)];
      return xs.length <= max ? xs.map((x) => '+ ' + x).join(' ') : `+ ${xs.length} not known`;
    };
    r.text = (o) => [r.figure(), r.tail(o)].filter(Boolean).join(' ');
    r.all = () => [...r.unknown.map((w) => `${w} not read`), ...r.limits, ...r.left.map((w) => `${w} not counted`)];
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
    return { ticket, seller: head.seller, shop: head.shop, when: head.when, what: head.what, bags: ps.map((p) => p.bags).filter(Boolean).join('; '), ...s };
  });
  // The rest: what the person buys and what is paid on the way, for the checkout and the prompt.
  b.others = all.filter((p) => p.who === 'person' || p.who === 'none');
  // Checkout items (checkout.js request.items), one per ticket, then the person's own purchases.
  b.items = () => [
    ...b.tickets.map((t) => ({ label: t.seller || 'Ticket', main: esc(t.what), price: esc(t.figure() + (t.known ? '' : ' + ?')),
      meta: esc([t.when, ...t.parts.slice(1).map((p) => p.amount == null ? `${p.what}: not read` : `${p.what} ${p.state === 'estimate' ? '≈ ' : ''}${T.money(p.amount)}`), ...t.limits, t.bags].filter(Boolean).join(' · ')) })),
    ...b.others.map((p) => ({ label: p.who === 'person' ? 'You buy' : 'On the way', main: esc(p.what),
      price: p.amount == null ? 'not read' : esc((p.state === 'estimate' ? '≈ ' : '') + T.money(p.amount)), meta: esc(['Not in this booking', p.basis].filter(Boolean).join(' · ')) })),
  ];
  // Prompt lines, one per ticket: what, when, seller, expected price, bags, limits and unknowns.
  b.promptLines = () => b.tickets.map((t, i) => {
    const fee = t.parts.filter((p) => p.amount == null).map((p) => `${p.what} was not read: read it before you fill anything, and report it`);
    return `${i + 1}. ${t.what}${t.when ? `, ${t.when}` : ''}. Seller: ${t.seller || 'not known'}${t.shop ? ` (${t.shop})` : ''}. ` +
      `Expected price: ${t.figure()}${t.approx ? ' (includes an estimate)' : ''}.${t.bags ? ` Bags: ${t.bags}.` : ''}` +
      `${t.limits.length ? ` Note: ${t.limits.join('; ')}.` : ''}${fee.length ? ' ' + fee.join('. ') + '.' : ''}`;
  });
  return b;
}

// The parts of one journey bought from one offer: the fare, and one part per bag the person needs.
// need: { cabin: 1, checked: 4, skis: 4 } counts per journey. A fee the offer does not list, or lists as
// "fee", is a part with no amount; "none" (the fare cannot take it) is a part with no amount and a limit.
// opts: { ticket, who, when, label, shop, guess } (label replaces the default "carrier numbers, from → to").
// guess: { cabin: { value: 30, basis: 'easyJet list, Jan 2026' } } prices an unread fee as an estimate,
// per bag on this journey. For a journey of two flights that charge each, pass the value for both.
export function fare(T, j, offer, need = {}, opts = {}) {
  const P = T.places, name = (id) => P[id]?.label || id;
  const label = opts.label || `${[j.carrierName, j.numbers].filter(Boolean).join(' ')}, ${name(j.from)} → ${name(j.to)}`;
  const ticket = opts.ticket ?? j.id, base = { ticket, who: opts.who || 'agent', seller: offer?.seller, shop: opts.shop };
  const when = opts.when || (j.depL ? `${j.depL.wd} ${j.depL.day} ${j.depL.mon} ${j.depL.hm}` : undefined);
  const parts = [{ ...base, what: label, when, amount: offer?.price ?? null, state: offer ? (offer.basis === 'estimate' || offer.basis === 'other-date' ? 'estimate' : 'read') : 'unknown',
    basis: offer ? `${offer.source || offer.seller}, seen ${offer.seen || '?'}` : 'fare not read', limit: offer?.price_note, bags: offer?.bags_note }];
  const bags = offer?.bags || {};
  for (const [k, n] of Object.entries(need)) {
    if (!n) continue;
    const v = bags[k], what = `${n > 1 ? n + ' x ' : ''}${k === 'cabin' ? 'cabin bag' : k === 'checked' ? 'checked bag' : k} fee, ${name(j.from)} → ${name(j.to)}`;
    if (v === 'included') continue;
    const g = opts.guess?.[k];
    if (typeof v === 'number') parts.push({ ...base, what, amount: v * n, basis: offer.source });
    else if (g && v !== 'none') parts.push({ ...base, what, amount: g.value * n, state: 'estimate', basis: g.basis });
    else parts.push({ ...base, what, amount: null, basis: v === 'none' ? 'this fare cannot take it' : 'not read', limit: v === 'none' ? `this fare takes no ${k} bag` : undefined });
  }
  return parts;
}

const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
