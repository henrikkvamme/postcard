// Metro or S-Bahn unit: a short boxy cab car and half a second car. A flat, barely raked front with a
// wrap windscreen, a red lower body all round, many dark doors with windows between, no pantograph.
import { group } from '../lib/mesh.mjs';
import { bogie, gangway, lamp } from '../lib/rail.mjs';
import { plan, stack, wrap, plates } from './_rail.mjs';

export const meta = { name: 'metro', kind: 'vehicle', modes: ['train'], label: 'Metro', px: 66 };

const W = 2.9, Z0 = 0.95, TOP = 3.85, HALF = W / 2, NOSE = 0.35;
const A = [0, 11.5], B = [-7.4, -0.6];
const LEVELS = [[Z0, 'ink'], [1.32, 'red'], [2.05, 'paper'], [TOP]];
const rake = (z) => Math.max(0, z - 2.1) * 0.22;
const pa = (z, d = 0) => plan(A[0] + d, A[1] - d - rake(z), W - 2 * d, { front: NOSE, rear: 0.2, n: 6 });
const pb = (z, d = 0) => plan(B[0] + d, B[1] - d, W - 2 * d, { front: 0.2, rear: 0.25, n: 6 });

// Doors at xs (1.3 wide, dark) and a window between each pair of doors and at the ends.
function side(x0, x1, xs) {
  const out = [], edges = [x0 + 0.5, ...xs.flatMap((x) => [x - 0.65, x + 0.65]), x1 - 0.5];
  for (const x of xs) out.push(plates(x - 0.65, x + 0.65, Z0 + 0.12, 3.25, HALF, 'ink2'));
  for (let i = 0; i < edges.length; i += 2) if (edges[i + 1] - edges[i] > 0.9) out.push(plates(edges[i] + 0.3, edges[i + 1] - 0.3, 2.25, 3.15, HALF, 'glass'));
  return group(out);
}

export default () => group(
  stack(pa, LEVELS, { rr: 0.22 }), stack(pb, LEVELS, { rr: 0.22 }),
  wrap(pa, 2.3, 3.3, 1, 7, 'glass'),
  side(A[0], A[1] - 0.4, [1.9, 5.7, 9.5]), side(B[0], B[1], [-5.7, -2.2]),
  bogie(A[0] + 2.0, { base: 2.2 }), bogie(A[1] - 2.0, { base: 2.2 }), bogie(B[0] + 2.0, { base: 2.2 }), bogie(B[1] - 1.9, { base: 2.2 }),
  gangway(-0.3, { w: 1.9, h: 2.3, z0: 1.2 }),
  ...[1, -1].map((s) => lamp(A[1] + NOSE - 0.05, s * 0.95, 1.7)),
);
