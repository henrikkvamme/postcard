// Step scroll for the home page: one wheel flick, swipe or key moves to the next stop (the hero, each trip, the bill,
// the end). The stops are the .ty-snap-at marks that type.js puts in the sections. CSS scroll snap cannot do this
// here: the stops are up to two screens apart, so a short swipe snaps back to where it started.
// Scrolling inside a part that scrolls itself (the trip tabs on a phone) and pinch zoom stay with the browser.
const EASE = (t) => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function pager({ reduced = false } = {}) {
  const stops = () => [...document.querySelectorAll('.ty-snap-at')]
    .map((e) => Math.round(e.getBoundingClientRect().top + scrollY)).sort((a, b) => a - b);
  let anim = 0, locked = false, lastWheel = 0;

  // The next stop from where the page is now, or null at either end.
  const next = (dir) => {
    const s = stops(), y = scrollY;
    return (dir > 0 ? s.find((v) => v > y + 4) : s.findLast((v) => v < y - 4)) ?? null;
  };
  const to = (top) => {
    cancelAnimationFrame(anim);
    const y0 = scrollY, d = top - y0;
    if (reduced || Math.abs(d) < 2) { scrollTo(0, top); anim = 0; return; }
    const ms = Math.min(1100, Math.max(550, Math.abs(d) / innerHeight * 420)), t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      scrollTo(0, y0 + d * EASE(t));
      anim = t < 1 ? requestAnimationFrame(step) : 0;
    };
    anim = requestAnimationFrame(step);
  };
  const go = (dir) => { const top = next(dir); if (top == null) return false; to(top); return true; };

  // True when the event's target sits in a part that can still scroll that way itself.
  const inner = (target, dx, dy) => {
    for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (Math.abs(dx) > Math.abs(dy) && /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth) return true;
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight
        && (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0)) return true;
    }
    return false;
  };

  // A trackpad flick sends wheel events for a second or more; one flick is one step. A new flick starts after
  // 220 ms without wheel events, or when the step has ended and the events grow again.
  addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.defaultPrevented || inner(e.target, e.deltaX, e.deltaY) || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    const now = performance.now(), quiet = now - lastWheel > 220; lastWheel = now;
    if (quiet) locked = false;
    const dir = Math.sign(e.deltaY);
    if (!dir || next(dir) == null) return;
    e.preventDefault();
    if (anim || locked) return;
    locked = true; go(dir);
  }, { passive: false });

  let t0 = null;
  addEventListener('touchstart', (e) => { t0 = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, target: e.target } : null; }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (!t0 || e.touches.length !== 1) { t0 = null; return; }
    const dx = t0.x - e.touches[0].clientX, dy = t0.y - e.touches[0].clientY;
    if (inner(t0.target, dx, dy)) { t0 = null; return; }
    if (Math.abs(dy) >= Math.abs(dx) && next(Math.sign(dy) || 1) != null) e.preventDefault();
  }, { passive: false });
  addEventListener('touchend', (e) => {
    if (!t0) return;
    const dx = t0.x - e.changedTouches[0].clientX, dy = t0.y - e.changedTouches[0].clientY; t0 = null;
    if (Math.abs(dy) > 36 && Math.abs(dy) > Math.abs(dx)) go(Math.sign(dy));
  });

  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, textarea, select, [contenteditable], [role=tablist]')) return;
    const dir = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1, ' ': e.shiftKey ? -1 : 1 }[e.key];
    if (e.key === 'Home' || e.key === 'End') { const s = stops(); e.preventDefault(); to(e.key === 'Home' ? s[0] : s.at(-1)); return; }
    if (dir && go(dir)) e.preventDefault();
  });

  // After a resize the stops move (they are in svh); stay on the stop the page was on.
  let idle = 0, at = null;
  addEventListener('scroll', () => { if (!anim) { const s = stops(); at = s.findIndex((v) => Math.abs(v - scrollY) < 4); } }, { passive: true });
  addEventListener('resize', () => { clearTimeout(idle); idle = setTimeout(() => { const s = stops(); if (at >= 0 && at != null && s[at] != null) to(s[at]); }, 250); });
  return { to, go };
}
