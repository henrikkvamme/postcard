// Funicular: one car of four compartments stepped like stairs, each with a level floor. The sides run down
// to a sloped chassis with wheels on the incline. A window band runs round each compartment, so the risers
// of the stairs are glass; a red band at each floor is the accent. The car climbs toward +x.
import { group } from '../lib/mesh.mjs';
import { plate, wheel } from '../lib/parts.mjs';
import { plan, stack } from './_rail.mjs';

export const meta = { name: 'funicular', kind: 'vehicle', modes: ['train'], label: 'Funicular', px: 58 };

const N = 4, L = 2.5, W = 2.3, H = 2.35, SLOPE = Math.tan(28 * Math.PI / 180), RISE = L * SLOPE, F0 = 0.62 + RISE;
const floor = (i) => F0 + i * RISE;

function compartment(i) {
  const x0 = i * L, z = floor(i);
  return stack((_, d = 0) => plan(x0 + d, x0 + L - d, W - 2 * d, {}), [[z, 'red'], [z + 0.32, 'paper'], [z + 0.8, 'glass'], [z + 1.8, 'paper'], [z + H]], { rr: 0.16 });
}

// Under the floors: the car side runs down to the slope as paper wedges (a stepped top, a sloped bottom),
// on a thin sloped chassis beam.
const BEAM = 0.32;
function under() {
  const prof = [[0, BEAM], [N * L, N * L * SLOPE + BEAM]];
  for (let i = N - 1; i >= 0; i--) prof.push([(i + 1) * L, floor(i)], [i * L, floor(i)]);
  const beam = [[0, 0], [N * L, N * L * SLOPE], [N * L, N * L * SLOPE + BEAM], [0, BEAM]];
  return group(plate(prof, W / 2, W, 'paper'), plate(beam, W / 2 - 0.2, W - 0.4, 'ink2'));
}

export default () => group(
  under(),
  ...Array.from({ length: N }, (_, i) => compartment(i)),
  ...[0.7, N * L - 0.7].flatMap((x) => [1, -1].map((s) => wheel(0.4, 0.14, x, s * 0.72, x * SLOPE + 0.05, 'ink'))),
);
