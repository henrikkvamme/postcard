// Double-deck regional train: a cab car and half a second car. A tall body whose middle drops low between
// the bogies (the lower deck), two window ribbons, one red band between the decks, and a flat raked cab.
// The upper ribbon wraps round the cab front as the windscreen.
import { group } from '../lib/mesh.mjs';
import { bogie, pantograph, gangway, lamp } from '../lib/rail.mjs';
import { plan, stack, plates } from './_rail.mjs';

export const meta = { name: 'train-regional', kind: 'vehicle', modes: ['train'], label: 'Regional train', px: 80 };

const W = 2.8, TOP = 4.7, ZE = 1.05, ZM = 0.42, HALF = W / 2;
// Bands up the body, the same on both cars and round the cab.
const LEVELS = [[ZE, 'ink'], [1.3, 'paper'], [2.3, 'red'], [2.5, 'paper'], [2.85, 'glass'], [3.75, 'paper'], [TOP]];
const NOSE = 1.25;
const rake = (z) => Math.max(0, z - 2.55) * 0.62;

// One car: an upper body over its full length and a lower deck between the bogie ends.
function car(xr, xf, { front = 0, rear = 0.3, end = 3.1 }) {
  const body = stack((z, d = 0) => plan(xr + d, xf - d - (front ? rake(z) : 0), W - 2 * d, { front, rear, n: 3.2, nr: 4 }), LEVELS, { rr: 0.45, inkCaps: [true, true] });
  const lo0 = xr + end, lo1 = xf - end;
  const deck = stack(() => plan(lo0, lo1, W, {}), [[ZM, 'ink'], [ZM + 0.3, 'paper'], [ZE]], { inkCaps: [true, false] });
  return group(body, deck,
    plates(lo0 + 1.5, lo1 - 1.5, 1.0, 1.32, HALF, 'paper'),           // the lower deck is paper, not skirt
    plates(lo0 + 1.6, lo1 - 1.6, 1.12, 2.0, HALF, 'glass'),           // lower deck windows
    plates(lo0 + 0.15, lo0 + 1.25, ZM + 0.1, 2.2, HALF, 'ink2'),       // doors at the low floor
    plates(lo1 - 1.25, lo1 - 0.15, ZM + 0.1, 2.2, HALF, 'ink2'),
    bogie(xr + end / 2 + 0.1), bogie(xf - end / 2 - 0.1));
}

export default () => group(
  car(0, 15, { front: NOSE }),
  car(-10.6, -0.6, { rear: 0.4, end: 3.0 }),
  gangway(-0.3, { w: 1.9, h: 2.6, z0: 1.3 }),
  pantograph(2.2, TOP),
  ...[1, -1].map((s) => lamp(15 + NOSE - 0.1, s * 0.85, 1.19)),
);
