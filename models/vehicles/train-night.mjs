// Night train: an electric loco and a sleeper car. The loco is paper with a raked cab; the sleeper car
// carries a broad ink band with small lit berth windows in pairs, which is what reads as night.
// One red stripe runs along both.
import { group } from '../lib/mesh.mjs';
import { bogie, pantograph, gangway, lamp } from '../lib/rail.mjs';
import { plan, stack, wrap, plates } from './_rail.mjs';

export const meta = { name: 'train-night', kind: 'vehicle', modes: ['train'], label: 'Night train', px: 84 };

const W = 2.9, Z0 = 0.9, TOP = 4.0, HALF = W / 2, NOSE = 0.9;
const LOCO = [0, 9.5], CAR = [-15.4, -0.8];
const rake = (z) => Math.max(0, z - 2.6) * 0.55;
const locoPlan = (z, d = 0) => plan(LOCO[0] + d, LOCO[1] - d - rake(z), W - 2 * d, { front: NOSE, rear: 0.25, n: 3.4, nr: 4 });
const carPlan = (z, d = 0) => plan(CAR[0] + d, CAR[1] - d, W - 2 * d, { front: 0.25, rear: 0.4, n: 4 });

function loco() {
  const out = [
    stack(locoPlan, [[Z0, 'ink'], [1.5, 'red'], [1.72, 'paper'], [TOP]], { rr: 0.4 }),
    wrap(locoPlan, 2.7, 3.4, 1, 7, 'glass'),                                // windscreen
    plates(LOCO[1] - 1.5, LOCO[1] - 0.75, 2.7, 3.3, HALF, 'glass'),         // cab side windows
    plates(LOCO[0] + 0.6, LOCO[0] + 1.3, 2.7, 3.3, HALF, 'glass'),
    bogie(LOCO[0] + 2.2), bogie(LOCO[1] - 2.2), pantograph(LOCO[0] + 3, TOP),
  ];
  for (const s of [1, -1]) out.push(lamp(LOCO[1] + NOSE - 0.12, s * 0.8, 1.2));
  return group(out);
}

function sleeper() {
  const out = [
    stack(carPlan, [[Z0, 'ink'], [1.5, 'red'], [1.72, 'paper'], [2.1, 'ink'], [3.35, 'paper'], [TOP]], { rr: 0.4 }),
    bogie(CAR[0] + 2.3), bogie(CAR[1] - 2.3),
  ];
  // Berth windows: small lit pairs on the ink band, one pair to a compartment.
  for (let x = CAR[0] + 1.6; x + 1.3 < CAR[1] - 0.8; x += 2.05)
    for (const dx of [0, 0.66]) out.push(plates(x + dx, x + dx + 0.5, 2.42, 2.98, HALF, 'brass'));
  return group(out);
}

export default () => group(loco(), sleeper(), gangway(-0.4, { w: 1.9, h: 2.5, z0: 1.2 }));
