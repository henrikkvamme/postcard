// Booking: the page asks the agent to book, follows its progress, and wakes it again after the person pays.
// serve.py keeps the queue; references/booking.md is the agent's side. The agent always stops at payment.
import { esc, sheet } from './parts.js';

const STATUS_TEXT = { pending: 'Waiting for your agent', claimed: 'Picked up', working: 'Working', 'at-payment': 'At the payment page', booked: 'Paid', done: 'Done', failed: 'Stopped' };
// Short text for a book button while a booking is open.
export const BUSY_TEXT = { pending: 'Waiting for your agent', claimed: 'Your agent is booking', working: 'Your agent is working', 'at-payment': "At the payment page: I've paid", booked: 'Paid: your agent is doing the rest' };

// checkout({ id, onJob }) -> { open(request), job }.
// request: { title, sub, items: [{ label, main, meta, price }], total, note, prompt, trip }.
//   prompt is the plain-words booking request for the agent; trip is the chosen option as data.
// onJob(job|null) runs when the newest booking changes, so the page can show it on its book button.
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
    sh.show(`<div class="pc-eyebrow">Checkout</div><h2>${esc(req.title)}</h2>${req.sub ? `<div class="sub">${esc(req.sub)}</div>` : ''}
      ${req.items.map((it) => `<div class="pc-ticket"><div class="dir">${esc(it.label)}</div><div class="main">${it.main}</div><div class="price">${it.price ?? ''}</div><div class="meta">${it.meta || ''}</div></div>`).join('')}
      <div class="pc-total"><span>${esc(req.totalLabel || 'Total')}</span><span>${esc(req.total)}</span></div>
      <div class="note">${req.note || ''} Your agent opens your browser, fills the booking and your saved details, and stops on the payment page. You check the price and pay yourself.</div>
      <div class="pc-agent" id="pc-agentlog" hidden></div>
      <div class="acts"><button class="ghost" id="pc-cx">Cancel</button><button class="go" id="pc-go">Check out with my agent</button></div>`);
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
