// A person walking with a small backpack, mid-stride toward +x: legs apart, arms swinging opposite.
// Toy proportions: a big head and thick limbs, so the stride reads at 30 px. The backpack is the red accent.
import { group } from '../lib/mesh.mjs';
import { block, chamfer2, box } from '../lib/parts.mjs';
import { person } from './_road.mjs';

export const meta = { name: 'walker', kind: 'vehicle', modes: ['walk'], label: 'Walk', px: 30 };

export default () => group(
  person({
    legs: [
      [[0.02, 0.11, 0.92], [0.2, 0.11, 0.52], [0.32, 0.11, 0.08]],     // front leg (left)
      [[-0.02, -0.11, 0.92], [-0.12, -0.11, 0.5], [-0.34, -0.11, 0.14]], // back leg (right), heel lifting
    ],
    arms: [
      [[-0.01, 0.25, 1.42], [-0.12, 0.27, 1.16], [-0.2, 0.27, 0.94]],    // left arm back
      [[0.01, -0.25, 1.42], [0.12, -0.27, 1.17], [0.24, -0.27, 0.98]],   // right arm forward
    ],
    torso: { at: [0, 0, 0.86], w: 0.42, d: 0.26, h: 0.62 },
    head: [0.02, 0, 1.66], headR: 0.15,
  }),
  // Backpack: a rounded block on the back, with a darker flap on top.
  block(chamfer2(0.18, 0.34, 0.05, -0.22, 0), 0.98, 1.42, 'red', { bevel: 0.04 }),
  box(0.06, 0.3, 1.0, 1.4, 'red', { cx: -0.13 }),
);
