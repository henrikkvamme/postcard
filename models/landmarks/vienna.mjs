// The Riesenrad in the Prater: a giant wheel with a double rim and a few thin spokes, red cabins hanging
// between the two rims, and a slim trestle each side carrying the axle. The steel is light (slate, ink2)
// and drawn without ink, so the wheel reads as an open ring with the red cabins on it.
// One red accent: the cabins.
import { group } from '../lib/mesh.mjs';
import { box, cyl, bar, gable } from '../lib/parts.mjs';
import { plinth } from './_l2.mjs';

export const meta = { name: 'vienna', kind: 'landmark', place: 'Vienna', lng: 16.3958, lat: 48.2166, label: 'Riesenrad', px: 96 };

const P = 1, R = 30.5, HUB = P + 34, RY = 2.1, N = 30, SPOKES = 10, CABINS = 15;
const at = (a, r, y) => [r * Math.cos(a), y, HUB + r * Math.sin(a)];
// Steel without ink lines: at map size an inked lattice turns into a dark mass.
const steel = (...ms) => { const g = group(...ms); for (const f of g.faces) f.ink = false; return g; };

export default () => {
  const parts = [plinth(50, 26, P)], frame = [];
  // The wheel: an outer and an inner rim each side, a tie at every other node, and thin spokes.
  for (const sy of [-1, 1]) {
    const y = sy * RY;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, b = ((i + 1) / N) * Math.PI * 2;
      frame.push(bar(at(a, R, y), at(b, R, y), 0.7, 'ink2'), bar(at(a, R - 2.6, y), at(b, R - 2.6, y), 0.35, 'slate'));
      if (i % 2 === 0) frame.push(bar(at(a, R - 2.6, y), at(a, R, y), 0.3, 'slate'));
    }
    for (let i = 0; i < SPOKES; i++) { const a = (i / SPOKES) * Math.PI * 2 + 0.1; frame.push(bar(at(a, 1.4, y), at(a, R - 2.6, y), 0.22, 'slate')); }
  }
  // The axle and hub.
  frame.push(cyl(1.6, 1.6, -RY - 1.2, RY + 1.2, 'ink2', { n: 10 }).turn('x', 90).move(0, 0, HUB));
  // Trestles: two legs each side spreading to the ground, with cross bracing.
  for (const sy of [-1, 1]) {
    const top = [0, sy * (RY + 1.4), HUB];
    for (const sx of [-1, 1]) {
      const foot = [sx * 15, sy * 6.5, P];
      frame.push(bar(foot, top, 0.8, 'ink2'));
      for (const t of [0.3, 0.6]) {
        const p = foot.map((v, k) => v + (top[k] - v) * t), q = [-p[0], p[1], p[2]];
        if (sx > 0) frame.push(bar(p, q, 0.35, 'slate'));
      }
    }
  }
  parts.push(steel(frame));
  // The cabins: red wagons with a window band and a low roof, hanging under the rim between the rims.
  for (let i = 0; i < CABINS; i++) {
    const a = (i / CABINS) * Math.PI * 2 + Math.PI / 2, [x, , z] = at(a, R, 0), z0 = z - 3.6;
    parts.push(steel(bar([x, -RY, z], [x, RY, z], 0.3, 'ink2')));
    parts.push(box(4.4, 2.6, z0, z0 + 2.6, 'red', { cx: x }));
    for (const s of [-1, 1]) parts.push(box(3.6, 0.06, z0 + 1.1, z0 + 2.1, 'glass', { cx: x, cy: s * 1.32 }));
    parts.push(gable(4.6, 2.8, z0 + 2.6, z0 + 3.2, 'red', { end: 'red' }).move(x, 0, 0));
  }
  // The station at the foot, between the trestles.
  parts.push(box(12, 8, P, P + 3.6, 'paper', { cy: -9 }), gable(12, 8, P + 3.6, P + 5.6, 'slate', { o: 0.5 }).move(0, -9, 0));
  return group(parts);
};
