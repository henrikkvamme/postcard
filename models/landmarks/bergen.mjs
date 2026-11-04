// Bryggen, Bergen: a row of four steep-gabled wooden wharf houses with their gables to the harbour, each
// painted a different colour, a stack of loft doors up the middle and a hoist beam at the peak.
// The red accent is the red house.
import { group } from '../lib/mesh.mjs';
import { box, gable, bar } from '../lib/parts.mjs';
import { plinth, onFace } from './_l4.mjs';

export const meta = { name: 'bergen', kind: 'landmark', place: 'Bergen', lng: 5.3245, lat: 60.3975, label: 'Bryggen', px: 80 };

const B = 0.8, D = 18, FX = D / 2;                       // house depth along x; gables face +x
// [width, eave height, ridge height, wall tone]
const HOUSES = [[7.4, 9.5, 16.5, 'sand'], [6.6, 10.5, 17.5, 'paper'], [7.2, 10, 17.5, 'red'], [6.8, 9, 15.5, 'stone']];

function house(w, ze, zr, tone, cy) {
  const parts = [
    box(D, w, B, ze, tone, { cy }),
    gable(D, w, ze, zr, 'slate', { o: 0.25, end: tone }).move(0, cy, 0),
    // Loft doors stacked up the middle of the gable, a darker strip.
    onFace([[-0.8, B + 0.3], [0.8, B + 0.3], [0.8, zr - 3.2], [-0.8, zr - 3.2]], '+x', FX + 0.25, 0.08, 'ink2').move(0, cy, 0),
    // The hoist beam that sticks out under the peak.
    bar([FX + 0.2, cy, zr - 1.6], [FX + 1.6, cy, zr - 1.6], 0.35, 'ink'),
  ];
  // A pair of windows on each floor, either side of the doors.
  for (const z of [3, 6.2, 9.4].filter((z) => z + 1.4 < ze + (zr - ze) * 0.45))
    for (const u of [-w * 0.3, w * 0.3]) parts.push(onFace([[u - 0.55, z], [u + 0.55, z], [u + 0.55, z + 1.4], [u - 0.55, z + 1.4]], '+x', FX + 0.25, 0.06, 'glass').move(0, cy, 0));
  return group(parts);
}

export default () => {
  const total = HOUSES.reduce((a, [w]) => a + w + 0.3, -0.3), parts = [plinth(D + 10, total + 6, { h: B, cx: 3 })];
  // The quay edge in front of the gables: a dark timber strip.
  parts.push(box(1.2, total + 6, B, B + 0.25, 'ink2', { cx: FX + 6.8 }));
  let y = -total / 2;
  for (const [w, ze, zr, tone] of HOUSES) { parts.push(house(w, ze, zr, tone, y + w / 2)); y += w + 0.3; }
  return group(parts);
};
