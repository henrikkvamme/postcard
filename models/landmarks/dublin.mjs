// The Ha'penny Bridge, Dublin: one shallow white cast-iron arch over the Liffey between two stone quays,
// white railings along the humped deck, and three lamps on curved iron brackets over the walkway.
// Red: the three lamp lanterns.
import { group, box, Mesh, block, rect2, plinth, bar, cyl } from './_l3.mjs';

export const meta = { name: 'dublin', kind: 'landmark', place: 'Dublin', lng: -6.2632, lat: 53.3464, label: "Ha'penny Bridge", px: 90 };

const SPAN = 43, HALF = SPAN / 2, BW = 3.6;   // span and deck width
const Q = 2.6, RISE_D = 2.0;                  // quay height (deck at the ends) and the deck's rise to the crown
const SPRING = -0.6, RISE_A = 4.4;             // the arch's springing height and rise

const deckZ = (x) => Q + RISE_D * (1 - (x / HALF) ** 2);
const archZ = (x) => SPRING + RISE_A * (1 - (x / HALF) ** 2);
const N = 14, xs = Array.from({ length: N + 1 }, (_, i) => -HALF + (i / N) * SPAN);

// One side rib: a curved plate from the arch line up to the deck line, t thick, outer face at y.
function rib(y, t) {
  const m = new Mesh(), s = Math.sign(y), yo = y, yi = y - s * t;
  const out = xs.map((x) => [x, yo, archZ(x)]).concat([...xs].reverse().map((x) => [x, yo, deckZ(x) + 0.35]));
  const inn = xs.map((x) => [x, yi, archZ(x)]).concat([...xs].reverse().map((x) => [x, yi, deckZ(x) + 0.35]));
  const n = out.length;
  m.face(s > 0 ? [...out].reverse() : out, 'paper');
  m.face(s > 0 ? inn : [...inn].reverse(), 'paper');
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, q = [out[i], out[j], inn[j], inn[i]];
    m.face(s > 0 ? q : [...q].reverse(), 'paper');
  }
  return m;
}

export default () => {
  const parts = [];
  // Ground: two stone quays and the river between them.
  parts.push(block(rect2(SPAN + 2, 12), -2.6, -1.8, 'mist', { top: 'mist' }));
  for (const s of [-1, 1]) parts.push(plinth(rect2(7, 12, s * (HALF + 3.1), 0), 1.0).move(0, 0, Q), box(7, 12, -2.6, Q - 1.0, 'stone', { cx: s * (HALF + 3.1) }));
  // The deck: a humped walkway between the two ribs.
  const deck = new Mesh();
  for (let i = 0; i < N; i++) {
    const a = xs[i], b = xs[i + 1], za = deckZ(a), zb = deckZ(b);
    deck.face([[a, -BW / 2, za], [b, -BW / 2, zb], [b, BW / 2, zb], [a, BW / 2, za]], 'stone');
    deck.face([[a, BW / 2, za - 0.3], [b, BW / 2, zb - 0.3], [b, -BW / 2, zb - 0.3], [a, -BW / 2, za - 0.3]], 'paper');
  }
  parts.push(deck);
  for (const s of [-1, 1]) parts.push(rib(s * BW / 2, 0.35));
  // Railings: a thin white parapet along each side, a newel post at each end. The real lattice is too fine
  // to read at map size, so the parapet is one clean plane.
  for (const s of [-1, 1]) {
    const y = s * (BW / 2 - 0.12), m = new Mesh(), top = xs.map((x) => [x, y, deckZ(x) + 1.25]), bot = xs.map((x) => [x, y, deckZ(x) + 0.3]);
    for (const [yy, f] of [[y + s * 0.1, 1], [y - s * 0.1, -1]]) {
      const ring = bot.map((p) => [p[0], yy, p[2]]).concat([...top].reverse().map((p) => [p[0], yy, p[2]]));
      m.face(f * s > 0 ? [...ring].reverse() : ring, 'paper');
    }
    for (let i = 0; i < N; i++) {
      const q = [[xs[i + 1], y - 0.1, top[i + 1][2]], [xs[i], y - 0.1, top[i][2]], [xs[i], y + 0.1, top[i][2]], [xs[i + 1], y + 0.1, top[i + 1][2]]];
      m.face(q.reverse(), 'paper');
    }
    parts.push(m);
    for (const x of [-HALF, HALF]) parts.push(box(0.5, 0.5, deckZ(x), deckZ(x) + 1.6, 'paper', { cx: x, cy: y }));
  }
  // Three lamp brackets: a round iron arch over the walkway with a red lantern hung at its crown.
  for (const x of [-HALF + 3, 0, HALF - 3]) {
    const z0 = deckZ(x) + 1.25, r = BW / 2 - 0.15, pts = [];
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI; pts.push([x, r * Math.cos(a), z0 + 1.4 + r * Math.sin(a)]); }
    for (const s of [-1, 1]) parts.push(bar([x, s * r, z0 - 0.1], [x, s * r, z0 + 1.4], 0.22, 'paper'));
    for (let i = 0; i < 6; i++) parts.push(bar(pts[i], pts[i + 1], 0.22, 'paper'));
    parts.push(cyl(0.4, 0.55, z0 + 1.3 + r - 1.6, z0 + 1.4 + r - 0.5, 'red', { n: 6, cx: x }));
  }
  return group(parts);
};
