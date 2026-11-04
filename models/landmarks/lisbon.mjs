// Belém Tower: a white limestone Manueline tower on the river, with a six-sided bastion as its prow.
// Battlements run round the bastion and the tower top, domed sentry turrets sit at the corners, and an
// open loggia hangs on the river face. One red accent: the flag on the top terrace.
import { group } from '../lib/mesh.mjs';
import { box, block, rect2, cyl, dome, bar } from '../lib/parts.mjs';
import { plinth, slab, wallPts, bays, archPts, crenel, facePlate } from './_l2.mjs';

export const meta = { name: 'lisbon', kind: 'landmark', place: 'Lisbon', lng: -9.2160, lat: 38.6916, label: 'Belém Tower', px: 86 };

const P = 1, BH = P + 8, TH = P + 29;               // plinth, bastion top, tower top
const TX = 6, T0 = 0, T1 = 12;                       // tower half width, south and north faces

// A sentry turret: a round box on a corbel, with a ribbed dome and a knob.
const turret = (x, y, z) => group(
  cyl(0.5, 1.15, z - 1.6, z, 'paper', { n: 8, cx: x, cy: y }),
  cyl(1.15, 1.15, z, z + 2.6, 'paper', { n: 8, cx: x, cy: y }),
  dome(1.25, z + 2.6, 'stone', { n: 8, k: 3, cx: x, cy: y, squash: 1.2 }),
  cyl(0.2, 0.05, z + 4.0, z + 4.8, 'stone', { n: 6, cx: x, cy: y }),
);

export default () => {
  const parts = [plinth(30, 36, P).move(0, -2, 0)];
  // The bastion: a six-sided prow pointing into the river, battlements and turrets on its corners.
  const prow = [[-11, -8], [-6, -16], [6, -16], [11, -8], [11, 2], [-11, 2]];
  parts.push(block(prow, P, BH, 'paper', { top: 'cream' }));
  parts.push(crenel([[-TX, 2], [-11, 2], [-11, -8], [-6, -16], [6, -16], [11, -8], [11, 2], [TX, 2]], BH, { step: 2.2, w: 1.1, d: 0.7, h: 1.3 }));
  for (const [x, y] of prow.slice(0, 4)) parts.push(turret(x * 0.97, y * 0.97 - 0.2, BH));
  // The bastion's line of gun ports, low on the water.
  for (const [a, b] of [[prow[0], prow[1]], [prow[1], prow[2]], [prow[2], prow[3]]]) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    for (const t of [0.3, 0.7]) parts.push(facePlate(archPts(L * t - 0.6, L * t + 0.6, P + 2.2, P + 3.2, { k: 3 }), a[0], a[1], dx, dy, 'ink2'));
  }
  // The tower, in storeys.
  parts.push(box(2 * TX, T1 - T0, P, TH, 'paper', { cy: (T0 + T1) / 2 }));
  for (const z of [P + 16.4, P + 22.6]) parts.push(block(rect2(2 * TX + 0.6, T1 - T0 + 0.6, 0, (T0 + T1) / 2), z, z + 0.5, 'paper'));
  // The loggia on the river face: a balcony with five arches, dark behind.
  parts.push(box(10, 2.2, P + 10.2, P + 10.9, 'paper', { cy: T0 - 1.1 }));
  parts.push(slab(wallPts(-5, 5, P + 10.9, P + 15.4, bays(-5, 5, 5, 0.5, P + 13.4, { ends: 0.5, k: 4 })), T0 - 2.2, T0 - 1.8, 'paper'));
  parts.push(box(10.4, 2.6, P + 15.4, P + 15.9, 'paper', { cy: T0 - 1.2 }));
  parts.push(box(9.6, 0.1, P + 10.9, P + 15.4, 'ink2', { cy: T0 - 0.05 }));
  for (const sx of [-1, 1]) parts.push(box(0.5, 2.2, P + 10.9, P + 15.4, 'paper', { cx: sx * 4.75, cy: T0 - 1.1 }));
  // Windows: a pair above the loggia, and one on each side face.
  for (const x of [-2.2, 2.2]) parts.push(slab(archPts(x - 0.9, x + 0.9, P + 18, P + 20.4, { k: 4 }), T0 - 0.15, T0 + 0.2, 'ink2'));
  const side = archPts(5.1, 6.9, P + 18, P + 20.4, { k: 4 });
  parts.push(facePlate(side, TX, T0, 0, 1, 'ink2'), facePlate(side, -TX, T1, 0, -1, 'ink2'));
  // The tower top: battlements, corner turrets, the upper terrace block with its own battlements, and the flag.
  parts.push(crenel([[-TX, T0], [TX, T0], [TX, T1], [-TX, T1]], TH, { step: 2.1, w: 1, d: 0.6, h: 1.2, closed: true }));
  for (const [x, y] of [[-TX, T0], [TX, T0], [TX, T1], [-TX, T1]]) parts.push(turret(x, y, TH));
  parts.push(box(7, 7, TH, TH + 4.2, 'paper', { cy: 7 }));
  parts.push(crenel([[-3.5, 3.5], [3.5, 3.5], [3.5, 10.5], [-3.5, 10.5]], TH + 4.2, { step: 1.9, w: 0.9, d: 0.5, h: 1, closed: true }));
  parts.push(bar([0, 7, TH + 4.2], [0, 7, TH + 11], 0.25, 'ink'), box(3.4, 0.12, TH + 8.6, TH + 10.8, 'red', { cx: 1.85, cy: 7 }));
  return group(parts);
};
