// Lanzarote: a black volcanic cone with the red scoria of the Fire Mountains in its crater, a whitewashed
// cube house with its island chimney and green door, and one palm.
// One red accent: the crater.
import { group } from '../lib/mesh.mjs';
import { box, block, rect2 } from '../lib/parts.mjs';
import { disc, rock, palm } from './_l2.mjs';

export const meta = { name: 'lanzarote', kind: 'landmark', place: 'Lanzarote', lng: -13.7500, lat: 29.0167, label: 'Timanfaya', px: 80 };

const P = 1.2;

// A flat-roofed white cube with a low parapet round the roof.
const cube = (w, d, h, cx, cy) => group(box(w, d, P, P + h, 'paper', { cx, cy }),
  block(rect2(w + 0.2, d + 0.2, cx, cy), P + h, P + h + 0.5, 'paper', { bevel: 0.15 }));

export default () => {
  const parts = [disc(26, P, { ry: 21, n: 28 })];
  const cone = [[15, P], [10.6, P + 6], [6.6, P + 11.6], [5.4, P + 11.5], [4.2, P + 10.2], [2, P + 8.6], [0, P + 8.3]];
  parts.push(rock(cone, (r, i) => r >= 3 ? 'red' : r === 1 && i % 4 === 0 ? 'ink2' : 'ink', { n: 14, seed: 5, jitter: 0.1, cx: -7, cy: 3 }));
  // The house: a main cube and a lower one beside it, a chimney, a green door and small windows.
  const X = 11, Y = -6;
  parts.push(cube(7, 5.5, 3.6, X, Y), cube(4, 4, 2.6, X + 5.2, Y + 0.6));
  parts.push(box(1.1, 1.1, P + 4.1, P + 5.9, 'paper', { cx: X - 2.2, cy: Y + 1.4 }), block(rect2(1.6, 1.6, X - 2.2, Y + 1.4), P + 5.9, P + 6.3, 'paper'));
  parts.push(box(1.3, 0.12, P, P + 2.4, 'green', { cx: X + 1, cy: Y - 2.8 }));
  for (const x of [-2.1, 2.8]) parts.push(box(1.0, 0.12, P + 1.5, P + 2.5, 'glass', { cx: X + x + (x > 0 ? 0 : 0), cy: Y - 2.8 }));
  parts.push(palm(X + 2, Y + 8, 9, { lean: [0.12, 0.08] }));
  return group(parts);
};
