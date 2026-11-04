// Elizabeth Tower (Big Ben): a tall square sandstone shaft, a wider clock stage with a white dial on each
// face, an arcaded belfry, and a steep dark iron roof that runs up into a slender spire.
// One red accent: the door at the foot.
import { group } from '../lib/mesh.mjs';
import { box, block, chamfer2, rect2, cyl, spire, bar, loft, ringAt } from '../lib/parts.mjs';
import { plinth, slab, archPts, facePlate } from './_l2.mjs';

export const meta = { name: 'london', kind: 'landmark', place: 'London', lng: -0.1246, lat: 51.5007, label: 'Big Ben', px: 104 };

const W = 12, B = 1.2; // shaft width, plinth height

// Something built on the -y face, turned to each of the four sides.
const round4 = (f) => group([0, 90, 180, 270].map((a) => f().turn('z', a)));
const frustum = (w0, w1, z0, z1, tone) => loft([ringAt(rect2(w0, w0), z0), ringAt(rect2(w1, w1), z1)], tone);

export default () => {
  const parts = [plinth(22, 22, B)];
  // Shaft on a stepped base, with corner buttresses.
  parts.push(block(chamfer2(W + 2, W + 2, 0.6), B, B + 4, 'sand', { bevel: 0.5 }));
  parts.push(box(W, W, B + 4, 52, 'sand'));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) parts.push(box(1.6, 1.6, B + 4, 53, 'sand', { cx: sx * (W / 2 - 0.4), cy: sy * (W / 2 - 0.4) }));
  // Clock stage: wider, with a white dial, its gilt surround and two hands on each face.
  parts.push(block(rect2(W + 2.4, W + 2.4), 52, 53.2, 'sand', { bevel: 0.4 }));
  parts.push(box(W + 1.6, W + 1.6, 53.2, 65, 'sand'));
  parts.push(block(rect2(W + 2.6, W + 2.6), 65, 66.4, 'sand', { bevel: 0.5 }));
  const Y = -(W + 1.6) / 2, ZC = 59.2;
  parts.push(round4(() => group(
    box(9.4, 0.25, ZC - 4.7, ZC + 4.7, 'brass', { cy: Y - 0.1 }),
    cyl(3.9, 3.9, 0, 0.35, 'paper', { n: 20 }).turn('x', 90).move(0, Y - 0.2, ZC),
    bar([0, Y - 0.6, ZC], [-1.6, Y - 0.6, ZC + 1.3], 0.32, 'ink'),
    bar([0, Y - 0.6, ZC], [0.4, Y - 0.6, ZC + 3.2], 0.24, 'ink'),
  )));
  // Belfry: three pointed openings a side, with corner pinnacles.
  const WB = W - 0.6;
  parts.push(box(WB, WB, 66.4, 73, 'sand'));
  parts.push(round4(() => group([-3.3, 0, 3.3].map((x) => facePlate(archPts(x - 1.2, x + 1.2, 67.2, 70.6, { rise: 1.8, k: 4 }), 0, -WB / 2, 1, 0, 'ink2')))));
  parts.push(block(rect2(W + 0.4, W + 0.4), 73, 74, 'sand', { bevel: 0.3 }));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const cx = sx * (W / 2 + 0.3), cy = sy * (W / 2 + 0.3);
    parts.push(box(1.4, 1.4, 66.4, 74.5, 'sand', { cx, cy }), spire(rect2(1.4, 1.4, cx, cy), 74.5, 79, 'sand', { cx, cy }));
  }
  // The iron roof: a steep frustum, a small lantern with gilt lights, and the spire with a gilt tip.
  parts.push(frustum(W - 0.4, 6.2, 74, 84.5, 'ink2'));
  parts.push(box(5, 5, 84.5, 87.6, 'ink2'));
  parts.push(round4(() => facePlate([[-1.6, 85.1], [1.6, 85.1], [1.6, 86.9], [-1.6, 86.9]], 0, -2.5, 1, 0, 'brass')));
  parts.push(block(rect2(5.8, 5.8), 87.6, 88.2, 'ink2'));
  parts.push(spire(rect2(4.4, 4.4), 88.2, 96, 'ink2'));
  parts.push(cyl(0.35, 0.2, 95, 97.6, 'brass', { n: 6 }));
  // One red accent: the door at the foot of the shaft.
  parts.push(slab(archPts(-1.5, 1.5, B + 0.01, B + 2.4, { rise: 1.2, k: 4 }), -W / 2 - 1.15, -W / 2 - 0.9, 'red'));
  return group(parts);
};
