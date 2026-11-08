// Booking: the page asks the agent to book, follows its progress, and wakes it again after the person pays.
// serve.py keeps the queue; references/booking.md is the agent's side. The agent always stops at payment.
import { esc, sheet } from './parts.js';

const STATUS_TEXT = { pending: 'Waiting for your agent', claimed: 'Picked up', working: 'Working', 'at-payment': 'At the payment page', booked: 'Paid', done: 'Done', failed: 'Stopped' };
// Short text for a book button while a booking is open.
export const BUSY_TEXT = { pending: 'Waiting for your agent', claimed: 'Your agent is booking', working: 'Your agent is working', 'at-payment': "At the payment page: I've paid", booked: 'Paid: your agent is doing the rest' };

// checkout({ id, onJob }) -> { open(request), job }.
// request: { title, sub, items: [{ label, main, meta, price }], total, note, prompt, trip }.
//   An item from bill().items() also has trip (mode, from, to, dep, arr, by), figure, tail and fine: the sheet
//   then shows one clean line per ticket with its fine print folded. aside: true lists it under "Not in this booking".
//   prompt is the plain-words booking request for the agent; trip is the chosen option as data.
// onJob(job|null) runs when the newest booking changes, so the page can show it on its book button.
const svg = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true">${d}</svg>`;
const ICON = {
  train: svg('<path d="M5 2.5h6a2 2 0 0 1 2 2V10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2zM3 7.5h10M5.5 14.5l1-2.5M10.5 14.5l-1-2.5"/>'),
  bus: svg('<rect x="2.5" y="2.5" width="11" height="9.5" rx="1.8"/><path d="M2.5 7.5h11M4.8 12v2M11.2 12v2"/>'),
  ferry: svg('<path d="M1.8 9.8h12.4l-2.1 3.7H3.9zM4.6 9.8V6.8h6.8v3M7 6.8V4.3h2.2v2.5"/>'),
  plane: svg('<path d="M14 8.6 9 6.6V3a1 1 0 0 0-2 0v3.6L2 8.6v1.5l5-1.2v2.8l-1.6 1.2v1.1L8 13.3l2.6.7v-1.1L9 11.7V8.9l5 1.2z"/>'),
  x: svg('<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>'),
  chev: svg('<path d="M6 4l4 4-4 4"/>'),
};
const days = (a, b) => Math.round((Date.parse(b.date) - Date.parse(a.date)) / 86400000);
// One ticket: a clean line (mode, day, times and ends, price), with its fine print one click away.
// An item with trip data gets the full layout; an item with only main and meta keeps a plain one.
function row(it) {
  const t = it.trip, price = it.figure !== undefined ? (it.figure == null ? '<span class="pc-co-dash" title="Fare not read">–</span>' : esc(it.figure)) : (it.price ?? '');
  const fine = [t && it.fine !== undefined ? it.fine : it.meta, ...(it.tail || []).map(esc)].filter(Boolean).join(' · ').replace(/; /g, '<br>');
  const head = t
    ? `<span class="pc-co-ic">${ICON[t.mode] || ICON.train}</span><span class="pc-co-day">${esc(`${t.dep.wd} ${t.dep.day} ${t.dep.mon}`)}</span>
       <span class="pc-co-tm"><b>${esc(t.dep.hm)}</b> ${esc(t.from)}<i>→</i><b>${esc(t.arr.hm)}${days(t.dep, t.arr) > 0 ? `<sup>+${days(t.dep, t.arr)}</sup>` : ''}</b> ${esc(t.to)}</span>
       <span class="pc-co-pr">${price}</span><span class="pc-co-by">${esc(t.by + (it.seller && !t.by.includes(it.seller.split(' ')[0]) ? ` · sold by ${it.seller}` : ''))}</span>`
    : `<span class="pc-co-ic"></span><span class="pc-co-day">${esc(it.label || '')}</span><span class="pc-co-tm">${it.main}</span><span class="pc-co-pr">${price}</span>`;
  return fine ? `<li><details><summary>${head}<span class="pc-co-chev">${ICON.chev}</span></summary><div class="pc-co-fine">${fine}</div></details></li>` : `<li><div class="pc-co-sum">${head}</div></li>`;
}

export function checkout({ id, onJob } = {}) {
  const sh = sheet('Checkout'), LAST = 'postcard:' + id + ':checkout-id';
  const C = { job: null };
  let timer = null;
  const save = (v) => { try { v ? localStorage.setItem(LAST, v) : localStorage.removeItem(LAST); } catch {} };
  const saved = () => { try { return localStorage.getItem(LAST); } catch { return null; } };

  // The newest booking on the server, polled. 204 means there is none.
  async function poll() {
    try { const r = await fetch('/api/checkout/latest', { cache: 'no-store' }); C.job = r.status === 200 ? await r.json() : null; } catch { C.job = null; }
    onJob?.(C.job); setTimeout(poll, 5000);
  }
  poll();
  C.busy = () => C.job && BUSY_TEXT[C.job.status] ? C.job : null;

  C.open = (req) => {
    const tickets = req.items.filter((it) => !it.aside), aside = req.items.filter((it) => it.aside);
    // The total splits into its figure and its tail: "from EUR 80 + 3 fares not read" -> "from EUR 80" and "3 fares not read".
    const [fig, ...tail] = String(req.total ?? '').split(' + ');
    sh.show(`<div class="pc-co">
      <button class="pc-co-x" id="pc-cx" aria-label="Close">${ICON.x}</button>
      <div class="pc-eyebrow">${tickets.length === 1 ? 'Book 1 ticket' : `Book ${tickets.length} tickets`}</div>
      <h2>${esc(req.title)}</h2>${req.sub ? `<div class="sub">${esc(req.sub)}</div>` : ''}
      <ol class="pc-co-list">${tickets.map(row).join('')}</ol>
      ${aside.length ? `<div class="pc-co-aside"><span>Not in this booking</span>${aside.map((it) => `<div><span class="cap">${it.main}</span><span>${esc(it.figure ?? '')}</span></div>`).join('')}</div>` : ''}
      <div class="pc-co-total"><span>${esc(req.totalLabel || 'Total')}</span><b>${esc(fig)}</b>${tail.length ? `<small>${tail.map(esc).join(' · ')}</small>` : ''}</div>
      <div class="pc-agent" id="pc-agentlog" hidden></div>
      <button class="pc-co-go" id="pc-go">Check out with my agent</button>
      <p class="pc-co-how">Your agent fills in the booking and stops at the payment page. You pay.</p>
      ${req.note ? `<details class="pc-co-more"><summary>About these prices</summary><p>${req.note}</p></details>` : ''}
    </div>`);
    const open = C.busy()?.id || saved(); if (open) follow(open);
    sh.el.querySelector('#pc-cx').onclick = () => sh.close();
    sh.el.querySelector('#pc-go').onclick = async (e) => {
      const b = e.currentTarget; let rid = null;
      try { const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trip: req.trip, prompt: req.prompt }) });
        if (r.ok) rid = (await r.json()).id; } catch {}
      if (!rid) { try { await navigator.clipboard.writeText(req.prompt); } catch {} b.textContent = 'No agent server. Copied the request instead'; return; }
      b.disabled = true; b.textContent = 'Sent to your agent'; save(rid); follow(rid);
    };
  };
  sh.onclose = () => clearTimeout(timer);

  async function follow(rid) {
    const el = sh.el.querySelector('#pc-agentlog'); if (!el) return; el.hidden = false;
    let job = null;
    try { const r = await fetch('/api/checkout/' + rid, { cache: 'no-store' }); if (r.ok) job = await r.json(); } catch {}
    if (!job) { save(null); el.hidden = true; return; }
    // While a booking runs, its progress replaces the button that started it.
    // A failed booking gives the button back, so the person can try again.
    sh.el.querySelector('.pc-co')?.classList.toggle('busy', job.status !== 'done' && job.status !== 'failed');
    if (job.status === 'failed') { const g = sh.el.querySelector('#pc-go'); if (g) { g.disabled = false; g.textContent = 'Try again with my agent'; } }
    el.innerHTML = job.log.map((l) => `<div class="${l.status}"><b>${STATUS_TEXT[l.status] || l.status}</b><span>${esc(l.note)}</span>` +
      `<i>${new Date(l.at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</i></div>`).join('');
    // Only the person can pay. This button wakes the agent for the work after booking.
    if (job.status === 'at-payment' || job.status === 'failed') {
      el.insertAdjacentHTML('beforeend', `<button class="go paid" id="pc-paid">I've paid. Do the rest</button>
        <p class="paidnote">Your agent adds the trip to your calendar, checks that the tickets are issued, and reminds you to check in.</p>`);
      el.querySelector('#pc-paid').onclick = async (e) => { e.currentTarget.disabled = true; e.currentTarget.textContent = 'Telling your agent';
        try { await fetch('/api/checkout/' + rid + '/booked', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); } catch {}
        clearTimeout(timer); follow(rid); };
    }
    if (job.status === 'done') { save(null); return; }
    if (job.status === 'failed') return;
    clearTimeout(timer); timer = setTimeout(() => sh.open && follow(rid), job.status === 'at-payment' ? 4000 : 1500);
  }
  return C;
}
