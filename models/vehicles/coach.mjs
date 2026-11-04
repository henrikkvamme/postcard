// Long-distance coach: a tall high-deck body, a continuous dark window ribbon, a big near-upright windscreen,
// rabbit-ear mirrors, a tandem rear axle in one long arch. The red accent is the livery sweep that rises to the rear.
import { group } from '../lib/mesh.mjs';
import { box, block, chamfer2, hull, section, plate, bar } from '../lib/parts.mjs';
import { lamp } from '../lib/rail.mjs';
import { tyre, arch } from './_road.mjs';

export const meta = { name: 'coach', kind: 'vehicle', modes: ['bus', 'coach'], label: 'Coach', px: 64 };

const W = 2.5, Z0 = 0.45, TOP = 3.75, H = TOP - Z0, SIDE = W / 2, R = 0.52;
const REAR = -5.0, FRONT = 5.0;

export default () => {
  const parts = [];
  // Body: rounded box, the front top raked back to the roof.
  parts.push(hull([
    [REAR, section(W - 0.08, H - 0.1, 0.4, Z0 + 0.04)],
    [REAR + 0.15, section(W, H, 0.42, Z0)],
    [FRONT - 0.75, section(W, H, 0.42, Z0)],
    [FRONT, section(W - 0.08, H - 0.32, 0.32, Z0)],
  ], 'paper'));
  // Windscreen on the front face and the lamps under it.
  parts.push(box(0.04, W - 0.42, 1.6, TOP - 0.42, 'glass', { cx: FRONT + 0.01 }));
  for (const s of [1, -1]) parts.push(lamp(FRONT + 0.01, s * 0.82, 0.95));
  parts.push(box(0.05, W - 0.5, Z0 + 0.05, Z0 + 0.25, 'ink', { cx: FRONT + 0.02 }));
  // Per side: window ribbon, livery sweep, wheel arches.
  const left = [];
  left.push(box(FRONT - 0.45 - (REAR + 0.5), 0.035, 2.25, TOP - 0.45, 'glass', { cx: (FRONT - 0.45 + REAR + 0.5) / 2, cy: SIDE + 0.005 }));
  // Sweep: low at the front, rising behind the rear wheels to under the window line.
  left.push(plate([[FRONT - 0.05, 1.3], [FRONT - 0.05, 1.55], [-0.6, 1.55], [REAR + 0.15, 2.1], [REAR + 0.15, 1.8], [-0.9, 1.3]], SIDE + 0.03, 0.03, 'red'));
  left.push(arch(3.3, 3.3, R, 0.66, Z0, SIDE));
  left.push(arch(-3.75, -2.65, R, 0.66, Z0, SIDE));
  const L = group(left);
  parts.push(L, L.mirrorY());
  // Entrance door at the front, on the right (kerb) side: a dark panel through the ribbon.
  parts.push(box(0.7, 0.04, Z0 + 0.25, TOP - 0.45, 'glass', { cx: FRONT - 1.05, cy: -SIDE - 0.02 }));
  // Wheels: one front axle, a tandem at the rear.
  for (const x of [3.3, -2.65, -3.75]) for (const s of [1, -1]) parts.push(tyre(R, 0.3, x, s * (SIDE - 0.12), R, { n: 12 }));
  // Rabbit-ear mirrors reaching forward from the roof corners.
  for (const s of [1, -1]) {
    const a = [FRONT - 0.2, s * (SIDE - 0.1), TOP - 0.4], b = [FRONT + 0.45, s * (SIDE + 0.12), TOP - 0.55], c = [FRONT + 0.5, s * (SIDE + 0.12), TOP - 1.05];
    parts.push(bar(a, b, 0.07, 'ink'), bar(b, c, 0.07, 'ink'), box(0.08, 0.12, TOP - 1.35, TOP - 0.85, 'ink', { cx: c[0], cy: c[1] }));
  }
  // Roof air-conditioning pod.
  parts.push(block(chamfer2(2.6, 1.5, 0.35, -0.8), TOP - 0.02, TOP + 0.26, 'stone', { bevel: 0.08 }));
  return group(parts);
};
