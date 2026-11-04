// Oslo Opera House: a low angular iceberg of white marble. Two broad roof planes slope down into the fjord
// at an angle, one from the west and one from the south-east. Between them the tall glass wall of the foyer
// stands in a notch under the edge of the flat roof top. The stage tower rises from the roof, reached by a
// tilted plane. The red is a small flag on the roof.
import { Mesh, group } from '../lib/mesh.mjs';
import { box, block, rect2 } from '../lib/parts.mjs';
import { plinth, flag } from './_l1.mjs';

export const meta = { name: 'oslo', kind: 'landmark', place: 'Oslo', lng: 10.7531, lat: 59.9075, label: 'Oslo Opera House', px: 108 };

const P = 0.6, H = P + 14;        // water surface, roof top

// The roof as a solid of planar facets over a plan: each facet is a list of vertex names, counter-clockwise
// seen from above. Every outer edge gets a wall down to the water; `walls` gives a wall its tone.
const V = {
  w1: [-66, -14, P], w2: [-62, 30, P],                 // the west ramp meets the fjord
  s1: [-36, -42, P],                                   // the south-west plane meets it at an angle
  p1: [-20, -10, H], p2: [26, -18, H], p3: [58, -12, H], p4: [58, 30, H], p5: [-20, 30, H], // the roof top
  s2: [34, -44, P], s3: [62, -36, P],                  // the south-east plane in the water
};
const FACETS = [
  ['p1', 'p2', 'p3', 'p4', 'p5'],                      // the flat roof top
  ['w1', 'p1', 'p5'], ['w1', 'p5', 'w2'],              // the west ramp
  ['s1', 'p1', 'w1'],                                  // the south-west plane
  ['s2', 's3', 'p3'], ['s2', 'p3', 'p2'],              // the south-east plane
];
// The foyer: glass in the notch between the two sloping planes.
const GLASS = new Set(['s1>p1', 'p1>p2', 'p2>s2']);

// The foyer glass leans in at its foot, under the overhang of the roof edge.
const LEAN = (() => { const [x0, y0] = V.p1, [x1, y1] = V.p2, l = Math.hypot(x1 - x0, y1 - y0); return [-(y1 - y0) / l * 3.5, (x1 - x0) / l * 3.5]; })();
const foot = (n, glass) => { const [x, y] = V[n], d = glass && (n === 'p1' || n === 'p2') ? LEAN : [0, 0]; return [x + d[0], y + d[1], 0]; };

function roof() {
  const m = new Mesh(), count = new Map();
  for (const f of FACETS) for (let i = 0; i < f.length; i++) {
    const k = [f[i], f[(i + 1) % f.length]].sort().join('|'); count.set(k, (count.get(k) || 0) + 1); }
  for (const f of FACETS) {
    m.face(f.map((n) => V[n]), 'paper');
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length];
      if (count.get([a, b].sort().join('|')) > 1) continue;
      const A = V[a], B = V[b], glass = GLASS.has(`${a}>${b}`);
      m.face([foot(a, glass), foot(b, glass), B, A], glass ? 'glass' : 'paper');
    }
  }
  // The folds between the planes are shallow, so the bake draws no ink there; draw it.
  for (const [a, b] of [['w1', 'p1'], ['p1', 'p5'], ['p2', 'p3'], ['s2', 'p3']]) m.line(V[a], V[b]);
  // Mullions on the foyer glass.
  for (const t of [0.2, 0.4, 0.6, 0.8]) {
    const x = V.p1[0] + (V.p2[0] - V.p1[0]) * t, y = V.p1[1] + (V.p2[1] - V.p1[1]) * t - 0.05;
    m.line([x + LEAN[0], y + LEAN[1], P], [x, y, H - 0.2]);
  }
  return m;
}

// The stage tower: a long block on the roof, reached from the west by a tilted plane.
const TX0 = 8, TX1 = 38, TY0 = 4, TY1 = 20, TH = H + 24;
function tower() {
  const m = new Mesh(), z = H + 8;
  const a = [-10, TY0, H], b = [TX0, TY0, z], c = [TX0, TY1, z], d = [-10, TY1, H];
  m.face([a, b, c, d], 'paper');
  m.face([a, [TX0, TY0, H], b], 'paper');
  m.face([d, c, [TX0, TY1, H]], 'paper');
  return group(m, block(rect2(TX1 - TX0, TY1 - TY0, (TX0 + TX1) / 2, (TY0 + TY1) / 2), H, TH, 'stone', { bevel: 0.5, top: 'paper' }),
    box(14, 12, H, H + 7, 'mist', { cx: 49, cy: 20, bevel: 0.3, top: 'paper' }));   // the workshop block behind
}

export default () => group(
  plinth(150, 104, { h: P, tone: 'mist', cx: -2, cy: -4, bevel: 0.2 }),           // the fjord
  box(150, 22, P, 1.4, 'stone', { cx: -2, cy: 37, bevel: 0.3 }),                   // the quay behind
  roof(), tower(),
  flag(-6, -4, H, H + 10, { w: 5, h: 3.2, s: 0.4 }),
);
