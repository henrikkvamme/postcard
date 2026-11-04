// Eiffel Tower: four curved legs on stone piers, the arches between them, the first and second platforms,
// the long tapering shaft, the top with its antenna. The red is the flag at the top.
import { group } from '../lib/mesh.mjs';
import { box, loft, ringAt, rect2, bar } from '../lib/parts.mjs';
import { plinth, slabY, flag } from './_l1.mjs';

export const meta = { name: 'paris', kind: 'landmark', place: 'Paris', lng: 2.2945, lat: 48.8584, label: 'Eiffel Tower', px: 112 };

const P = 3;                                   // plinth top
const Z2 = 116;                                // the legs meet under the second platform
// Leg centre (on each axis) and half width at height z: the legs bow inward fast, then rise steeply.
const legC = (z) => 15 + 34.5 * Math.pow(1 - z / Z2, 1.6);
const legH = (z) => 13 - 8 * (z / Z2);
// The shaft's half width above the second platform.
const shaftH = (z) => 5 + 14 * Math.pow(1 - (z - Z2) / (276 - Z2), 1.7);

function leg(sx, sy) {
  const zs = [0, 12, 26, 40, 54, 70, 86, 101, Z2];
  return loft(zs.map((z) => ringAt(rect2(2 * legH(z), 2 * legH(z), sx * legC(z), sy * legC(z)), P + z)), 'paper');
}

// The decorative arch in the face at y = -Y, from leg to leg under the first platform.
function arch(Y) {
  const k = 10, outer = [], inner = [];
  for (let i = 0; i <= k; i++) {
    const a = Math.PI * (i / k);
    outer.push([32 * Math.cos(a), P + 18 + 37 * Math.sin(a)]);
    inner.push([29 * Math.cos(a), P + 18 + 33 * Math.sin(a)]);
  }
  return slabY([...outer, ...inner.reverse()], -Y - 1, -Y + 1, 'paper');
}

export default () => {
  const parts = [plinth(142, 142, { h: P, tone: 'cream', bevel: 1 })];
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    parts.push(leg(sx, sy));
    parts.push(box(30, 30, 0, P + 3, 'stone', { cx: sx * legC(0), cy: sy * legC(0), bevel: 1 })); // stone pier
  }
  const Y = 38;
  for (const a of [0, 90, 180, 270]) parts.push(arch(Y).turn('z', a));
  // First platform, second platform.
  parts.push(box(78, 78, P + 52, P + 59, 'cream', { bevel: 1.2 }));
  parts.push(box(46, 46, P + 112, P + 119, 'cream', { bevel: 1 }));
  // The shaft: one tapering square tube from the second platform to the third.
  const zs = [Z2, 140, 165, 190, 215, 240, 262, 276];
  parts.push(loft(zs.map((z) => ringAt(rect2(2 * shaftH(z), 2 * shaftH(z)), P + z)), 'paper'));
  // The top: third platform, the lantern and the antenna with its flag.
  parts.push(box(20, 20, P + 274, P + 281, 'cream', { bevel: 0.8 }));
  parts.push(box(10, 10, P + 281, P + 292, 'paper', { bevel: 0.8 }));
  parts.push(bar([0, 0, P + 292], [0, 0, P + 328], 2.2, 'ink'));
  parts.push(flag(1.1, 0, P + 300, P + 320, { w: 12, h: 8, s: 1.2 }));
  return group(parts);
};
