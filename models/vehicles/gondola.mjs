// Gondola: a cable car cabin with a glass band all round, hung from a hanger arm and grip on a short,
// slightly climbing length of haul rope. The red accent is a band at the cabin's waist.
import { group } from '../lib/mesh.mjs';
import { box, bar } from '../lib/parts.mjs';
import { plan, stack } from './_rail.mjs';

export const meta = { name: 'gondola', kind: 'vehicle', modes: ['gondola'], label: 'Gondola', px: 50 };

const TOP = 2.25, ROPE = 5.25, TILT = 8, S = Math.tan(TILT * Math.PI / 180);
// The cabin narrows to its floor, like a rounded bucket.
const taper = (z) => (z < 0.85 ? 0.8 + 0.2 * (z / 0.85) : 1 - 0.03 * (z - 0.85));
const cabin = (z, d = 0) => { const f = taper(z);
  return plan(-0.45 * f + d, 0.45 * f - d, 1.9 * f - 2 * d, { front: 0.55 * f, rear: 0.55 * f, n: 3, k: 6 }); };

export default () => group(
  stack(cabin, [[0, 'paper'], [0.2, 'red'], [0.45, 'paper'], [0.85, 'glass'], [1.85, 'paper'], [TOP]], { rr: 0.32, bottom: 'stone' }),
  box(0.3, 1.2, TOP - 0.05, TOP + 0.15, 'ink2'),                           // roof yoke
  bar([0, 0, TOP + 0.1], [0, 0, 3.6], 0.13, 'ink'),                          // hanger arm, with a dogleg
  bar([0, 0, 3.6], [0, 0.42, 4.15], 0.13, 'ink'),
  bar([0, 0.42, 4.15], [0, 0, ROPE - 0.2], 0.13, 'ink'),
  box(1.0, 0.34, -0.2, 0.22, 'ink2').turn('y', -TILT).move(0, 0, ROPE),      // grip
  bar([-2.9, 0, ROPE - 2.9 * S], [2.9, 0, ROPE + 2.9 * S], 0.1, 'ink'),     // haul rope
);
