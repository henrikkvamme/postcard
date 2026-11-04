// Low-floor city tram: two short modules on an articulation, a body that sits low over small hidden wheels,
// a deep window band that wraps round both rounded cab fronts, a pantograph and a roof pod.
// The red accent is the doors.
import { group } from '../lib/mesh.mjs';
import { box, wheel } from '../lib/parts.mjs';
import { pantograph } from '../lib/rail.mjs';
import { plan, stack, plates } from './_rail.mjs';

export const meta = { name: 'tram', kind: 'vehicle', modes: ['train'], label: 'Tram', px: 62 };

const W = 2.4, Z0 = 0.32, TOP = 3.4, HALF = W / 2, NOSE = 1.5;
const A = [0, 7.6], B = [-7.8, -0.4];
const LEVELS = [[Z0, 'ink'], [0.6, 'paper'], [1.3, 'glass'], [2.55, 'paper'], [TOP]];
const rake = (z) => Math.max(0, z - 1.0) * 0.22;

const front = (z, d = 0) => plan(A[0] + d, A[1] - d - rake(z), W - 2 * d, { front: NOSE, rear: 0.1, n: 2.4, nr: 4 });
const rear = (z, d = 0) => plan(B[0] + d + rake(z), B[1] - d, W - 2 * d, { front: 0.1, rear: NOSE, n: 4, nr: 2.4 });
const doors = (xs) => group(xs.map((x) => plates(x - 0.65, x + 0.65, Z0 + 0.1, 2.62, HALF, 'red')));
const wheels = (x) => group([-0.9, 0.9].flatMap((dx) => [1, -1].map((s) => wheel(0.34, 0.12, x + dx, s * 0.78, 0.34))));

export default () => group(
  stack(front, LEVELS, { rr: 0.32 }), stack(rear, LEVELS, { rr: 0.32 }),
  box(0.4, 2.0, 0.5, 3.15, 'ink2', { cx: -0.2 }),                         // articulation
  doors([2.2, 5.6]), doors([-5.0]),
  wheels(4.2), wheels(-4.6),
  pantograph(2.8, TOP),
  box(2.6, 1.5, TOP - 0.05, TOP + 0.38, 'stone', { cx: -3.6, bevel: 0.1 }),  // roof pod
);
