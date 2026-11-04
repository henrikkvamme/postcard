// High-speed train: a power car with a long sloped nose and half a coach. A toy length on purpose: on the
// map it is about 80 px long, and a real five-car set at that size is a thin line.
// Paper upper body, navy skirt, one red stripe, a continuous dark window ribbon, a pantograph.
import { group } from '../lib/mesh.mjs';
import { box } from '../lib/parts.mjs';
import { carBody, nose, stripe, bogie, pantograph, gangway, lamp } from '../lib/rail.mjs';

export const meta = { name: 'train-hs', kind: 'vehicle', modes: ['train'], label: 'High-speed train', px: 84 };

const W = 2.9, H = 3.0, Z0 = 0.9, TOP = Z0 + H, SIDE = W / 2 + 0.01;
const LEN = 15, HALF = 8, GAP = 0.6, NOSE = 7;

function sides(x0, x1, win = [x0 + 0.8, x1 - 0.8]) {
  const out = [];
  for (const s of [SIDE, -SIDE]) {
    out.push(box(x1 - x0, 0.03, Z0, Z0 + 0.75, 'ink', { cx: (x0 + x1) / 2, cy: s }));        // navy skirt
    out.push(stripe(x0, x1, { side: s, z: Z0 + 0.92, h: 0.2 }));                              // red stripe
    out.push(box(win[1] - win[0], 0.035, 2.35, 3.05, 'glass', { cx: (win[0] + win[1]) / 2, cy: s })); // window ribbon
  }
  return group(out);
}

export default () => {
  const a0 = -HALF - GAP / 2, a1 = -GAP / 2, b0 = GAP / 2, b1 = LEN + GAP / 2;
  const parts = [
    carBody(a0, a1, { w: W, h: H, z0: Z0 }), sides(a0, a1, [a0 + 0.8, a1 - 0.8]), bogie(a0 + 3),
    carBody(b0, b1, { w: W, h: H, z0: Z0 }), sides(b0, b1, [b0 + 3.5, b1 - 1.2]), bogie(b0 + 3), bogie(b1 - 3),
    gangway(0),
    nose(b1, NOSE, { w: W, h: H, z0: Z0, tip: 0.6 }),
    nose(a0, 2.5, { w: W, h: H, z0: Z0, tip: 2.2, dir: -1 }),
    bogie(b1 + 2.4),
    pantograph(b0 + 6, TOP),
  ];
  // Cab windscreen: a dark plate on each flank of the nose, where the slope begins.
  for (const s of [1, -1]) parts.push(box(2.2, 0.03, 2.9, 3.4, 'glass', { cx: b1 + 1.3, cy: s * (W / 2 - 0.06) }));
  for (const s of [1, -1]) parts.push(lamp(b1 + NOSE - 0.5, s * 0.5, Z0 + 0.4));
  return group(parts);
};
