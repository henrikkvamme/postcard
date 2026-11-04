// Sagrada Família: a cluster of tall spindle spires. Four sandstone bell towers on each transept facade,
// and the newer pale central towers: Jesus (the tallest, with its cross), Mary behind it with a star,
// and the four Evangelists round them. The nave and apse stay low under the spires.
// One red accent: the mosaic finials on the bell towers.
import { group } from '../lib/mesh.mjs';
import { box, block, rect2, gable, lathe, cyl, dome } from '../lib/parts.mjs';
import { plinth, slab, archPts } from './_l2.mjs';

export const meta = { name: 'barcelona', kind: 'landmark', place: 'Barcelona', lng: 2.1744, lat: 41.4036, label: 'Sagrada Família', px: 110 };

const P = 2;

// A Gaudí spindle: straight lower shaft, then a parabolic taper to a narrow neck at height h.
function spindle(x, y, r, h, tone, { n = 10, neck = 0.16 } = {}) {
  const prof = [[r, P], [r, P + h * 0.42], [r * 0.93, P + h * 0.58], [r * 0.78, P + h * 0.72], [r * 0.55, P + h * 0.84], [r * 0.32, P + h * 0.93], [r * neck, P + h]];
  return lathe(prof, tone, { n, cx: x, cy: y, phase: Math.PI / n });
}
// A bell tower with its mosaic finial: a short bulb and a point.
const bell = (x, y, h) => group(
  spindle(x, y, 3.6, h, 'sand'),
  lathe([[0.7, P + h], [1.5, P + h + 1.6], [1.4, P + h + 3.6], [0.6, P + h + 5.4], [0.01, P + h + 7.4]], 'red', { n: 8, cx: x, cy: y }),
);
// A cross of four arms on top of the Jesus tower.
const cross = (z) => group(box(1.2, 1.2, z, z + 11, 'paper'), box(7.5, 1.2, z + 5.4, z + 6.6, 'paper'), box(1.2, 7.5, z + 5.4, z + 6.6, 'paper'));

export default () => {
  const parts = [plinth(116, 86, P)];
  // Body: the nave along x with the crossing and transept, gabled; a rounded apse at +x.
  parts.push(box(78, 34, P, 34, 'sand', { cx: -10 }), gable(78, 34, 34, 52, 'sand', { end: 'sand' }).move(-10, 0, 0));
  parts.push(box(26, 66, P, 42, 'sand'), gable(66, 26, 42, 58, 'sand', { end: 'sand' }).turn('z', 90));
  parts.push(block(rect2(14, 34, 29, 0), P, 34, 'sand'), cyl(17, 17, P, 34, 'sand', { n: 14, cx: 36, cy: 0 }), dome(17, 34, 'sand', { n: 14, k: 3, cx: 36, squash: 0.7 }));
  // Tall windows down the nave, and three portals in each transept facade between its towers.
  for (const sy of [-1, 1]) for (const x of [-40, -28, -16]) parts.push(slab(archPts(x - 2.6, x + 2.6, P + 8, P + 22, { rise: 4, k: 4 }), sy * 17 - 0.3, sy * 17 + 0.3, 'glass'));
  for (const sy of [-1, 1]) for (const [x, w, h] of [[0, 5.5, 20], [-10, 3.6, 13], [10, 3.6, 13]]) parts.push(slab(archPts(x - w / 2, x + w / 2, P, P + h, { rise: w * 0.9, k: 4 }), sy * 33 - 0.3, sy * 33 + 0.3, 'ink2'));
  // Bell towers: four on each transept facade, the middle two taller.
  for (const sy of [-1, 1]) for (const [x, h] of [[-15, 92], [-5.2, 102], [5.2, 102], [15, 92]]) parts.push(bell(x, sy * 33, h));
  // Central towers: the Evangelists, Mary, and Jesus in the middle.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) parts.push(spindle(sx * 11, sy * 11, 5, 126, 'paper'), dome(1.6, P + 126, 'paper', { n: 8, k: 2 }).move(sx * 11, sy * 11, 0));
  parts.push(spindle(23, 0, 5.4, 128, 'paper'), lathe([[1.5, P + 128], [2.6, P + 131], [0.01, P + 135]], 'brass', { n: 6, cx: 23 }));
  parts.push(spindle(0, 0, 8.5, 158, 'paper', { n: 12, neck: 0.14 }), cross(P + 158));
  return group(parts);
};
