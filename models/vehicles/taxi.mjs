// Taxi: the small car with a roof sign. The sign is the red accent: a short wedge across the roof, narrower
// than a light bar, with sloped faces front and back. The roof stays paper so the sign stands out.
import { group } from '../lib/mesh.mjs';
import { block, chamfer2, loft } from '../lib/parts.mjs';
import { smallCar } from './_road.mjs';

export const meta = { name: 'taxi', kind: 'vehicle', modes: ['taxi'], label: 'Taxi', px: 48 };

// Side profile of the sign in x-z, listed counter-clockwise seen from +y.
const X = -0.86, Z0 = 1.64, Z1 = 1.98;
const prof = (y) => [[X + 0.24, Z0], [X - 0.24, Z0], [X - 0.12, Z1], [X + 0.12, Z1]].map(([x, z]) => [x, y, z]);

export default () => group(
  smallCar(),
  block(chamfer2(0.24, 0.5, 0.06, X), 1.56, Z0, 'ink2'), // sign foot
  loft([prof(-0.34), prof(0.34)], 'red'),                 // lit sign
);
