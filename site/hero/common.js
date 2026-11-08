// Shared parts for the home page (hero/type.js). The copy button must be on the first screen.
import { loadTrip, openTrip } from '/kit/trip.js';

export const SITE = 'https://postcard.henrikkvamme.no';
export const PROMPT = `Read ${SITE}/llms.txt and install the postcard skill. Then find the best way from Oslo to Berlin in May, show it on a postcard map, and stop at the payment page when I book.`;
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('reduced') === '1';
export const phone = () => innerWidth < 760;
export const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

// The headline in the Mix style: two red condensed serif lines with a script word between them.
// headline('Oslo', 'to', 'Berlin') -> <h1 class="hl"><span>Oslo</span><em>to</em><span>Berlin</span></h1>
export const headline = (a, mid, b, tag = 'h1') => `<${tag} class="hl"><span>${esc(a)}</span><em>${esc(mid)}</em><span>${esc(b)}</span></${tag}>`;

// The copy button: one button that copies the prompt. The prompt text is not shown.
// Returns an element (.cpb). Style it under the variant's scope when the default does not suit.
const CPI = '<svg viewBox="0 0 18 18" aria-hidden="true"><g class="cpb-cp"><rect x="6" y="6" width="9" height="9" rx="2"/><path d="M12 3.6V3.5A1.5 1.5 0 0 0 10.5 2h-6A1.5 1.5 0 0 0 3 3.5v6A1.5 1.5 0 0 0 4.5 11h.1"/></g><path class="cpb-ok" d="M3.5 9.5l3.6 3.4 7.4-8"/></svg>';
// The copy button: outlined, an icon and two words. A copy fills it from the left in red, the icon turns to a
// check that draws itself, and the button gives a small pop; after a moment it empties to the right.
export function copyButton({ label = 'Copy prompt', prompt = () => PROMPT } = {}) {
  const el = document.createElement('div'); el.className = 'cpb';
  el.innerHTML = `<button class="cpb-b" type="button"><span class="cpb-ic">${CPI}</span><span class="cpb-t"><span>${esc(label)}</span><span aria-hidden="true">Copied</span></span></button><span class="cpb-s" role="status"></span>`;
  const b = el.querySelector('.cpb-b'), st = el.querySelector('.cpb-s');
  b.addEventListener('pointerenter', () => { b.title = prompt(); });
  b.addEventListener('click', async () => {
    const text = prompt(); let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      // The Clipboard API is blocked: copy through a hidden text area.
      const ta = Object.assign(document.createElement('textarea'), { value: text }); ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta); ta.select(); try { ok = document.execCommand('copy'); } catch {} ta.remove();
    }
    b.classList.remove('done', 'fail'); void b.offsetWidth; b.classList.add(ok ? 'done' : 'fail');
    st.textContent = ok ? 'Prompt copied. Paste it to your agent.' : 'Copy failed. Try again';
    clearTimeout(b.t); b.t = setTimeout(() => { b.classList.remove('done', 'fail'); st.textContent = ''; }, ok ? 2000 : 2600);
  });
  return el;
}

// The world routes (hero/world/trip.json): flights, trains, a night train and a ferry, with ground paths
// inline. context.hero lists the globe's routes, context.stage the stage trips (example fares), context.captions names each route.
let worldP = null;
export function world() {
  worldP ??= loadTrip('/hero/world/trip.json').then(openTrip).then((T) => {
    for (const p of Object.values(T.places)) p.name = p.label;
    return T;
  });
  return worldP;
}
