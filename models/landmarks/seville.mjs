// La Giralda, Seville: the tall square Almohad brick shaft with raised lattice panels and a column of
// windows, then the white Renaissance belfry stages, a small cupola and the bronze Giraldillo on top.
// The red accent is the bells hanging in the belfry arches.
import { group } from '../lib/mesh.mjs';
import { box, cyl, dome, bar, rect2 } from '../lib/parts.mjs';
import { plinth, arch2, onFour, ball, merlons } from './_l4.mjs';

export const meta = { name: 'seville', kind: 'landmark', place: 'Seville', lng: -5.9926, lat: 37.3862, label: 'La Giralda', px: 104 };

const B = 0.8, W = 13.6, SHAFT = 70, BELL = 84;

export default () => {
  const h = W / 2, parts = [
    plinth(21, 21, { h: B }),
    box(W, W, B, SHAFT, 'sand', { bevel: 0.15 }),
    // Lattice panels (sebka) on the upper shaft, two per face, slightly proud.
    ...[-1, 1].map((s) => onFour([[s * 3.4 - 1.6, 40], [s * 3.4 + 1.6, 40], [s * 3.4 + 1.6, 64], [s * 3.4 - 1.6, 64]], h, 0.18, 'sand')),
    // The central column of windows.
    ...[10, 21, 32, 44, 56].map((z) => onFour(arch2(1.4, z, z + 2.6), h, 0.12, 'ink2')),
    box(W + 0.5, W + 0.5, SHAFT - 1, SHAFT, 'cream'),                 // cornice
    // Belfry: white, with three arches a side.
    box(W - 0.6, W - 0.6, SHAFT, BELL, 'paper', { bevel: 0.12 }),
    onFour(arch2(3.8, SHAFT + 2, SHAFT + 8.5), h - 0.3, 0.1, 'ink'),
    ...[-1, 1].map((s) => onFour(arch2(1.6, SHAFT + 3, SHAFT + 8.5, { cu: s * 4.4 }), h - 0.3, 0.1, 'ink')),
    box(W + 0.2, W + 0.2, BELL - 0.8, BELL, 'cream'),
    merlons(rect2(W - 0.4, W - 0.4), BELL, { s: 0.8, h: 1.2, w: 0.4, tone: 'paper' }),
    // Upper stages, each a step narrower.
    box(9.2, 9.2, BELL, BELL + 6.5, 'paper', { bevel: 0.1 }),
    onFour(arch2(2.6, BELL + 1.2, BELL + 4.2), 4.6, 0.1, 'ink'),
    box(9.8, 9.8, BELL + 6.5, BELL + 7.2, 'cream'),
    box(6.6, 6.6, BELL + 7.2, BELL + 12, 'paper', { bevel: 0.1 }),
    onFour(arch2(1.6, BELL + 8, BELL + 10.2), 3.3, 0.08, 'ink'),
    cyl(2.9, 2.9, BELL + 12, BELL + 14.5, 'paper', { n: 8, phase: Math.PI / 8 }),
    dome(2.9, BELL + 14.5, 'paper', { n: 8, k: 3, squash: 0.9 }),
    ball(0.8, 0, 0, BELL + 17.6, 'brass', { n: 8, k: 4 }),
    // The Giraldillo: a figure holding a shield that turns with the wind.
    bar([0, 0, BELL + 18], [0, 0, BELL + 21.5], 0.5, 'brass'),
    box(0.15, 2.0, BELL + 19.3, BELL + 21.6, 'brass', { cy: 1.1 }),
  ];
  // A red bell in each of the big belfry arches.
  // They sit on the dark arch plates, half proud of the wall, so they read against the dark.
  const e = h - 0.2;
  for (const [x, y] of [[e, 0], [-e, 0], [0, e], [0, -e]])
    parts.push(dome(1.0, SHAFT + 4.6, 'red', { n: 8, k: 3, cx: x, cy: y, squash: 1.8 }));
  return group(parts);
};
