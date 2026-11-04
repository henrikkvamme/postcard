// Koutoubia minaret, Marrakech: a plain square sandstone shaft, a green tile frieze and merlons at the top,
// a small square lantern with its own frieze, a ribbed cupola and three gilded globes on a spike.
// The red accent is the flag on the lantern's mast.
import { group } from '../lib/mesh.mjs';
import { box, cyl, dome, bar, rect2 } from '../lib/parts.mjs';
import { plinth, arch2, onFour, onFace, merlons, ball } from './_l4.mjs';

export const meta = { name: 'marrakech', kind: 'landmark', place: 'Marrakech', lng: -7.9937, lat: 31.6237, label: 'Koutoubia Mosque', px: 96 };

const B = 0.8, W = 12.8, TOP = 60, LW = 6.4, LTOP = 70.5;

export default () => {
  const h = W / 2, lh = LW / 2, parts = [
    plinth(20, 20, { h: B }),
    box(W, W, B, TOP, 'sand', { bevel: 0.15 }),
    box(W + 0.4, W + 0.4, TOP - 5.2, TOP - 1.4, 'green'),            // tile frieze under the parapet
    box(W + 0.5, W + 0.5, TOP - 1.4, TOP, 'sand'),                    // cornice
    merlons(rect2(W - 0.6, W - 0.6), TOP, { s: 1.3, h: 1.6, w: 0.6, tone: 'sand' }),
    // Lantern: a smaller tower on the roof terrace.
    box(LW, LW, TOP, LTOP, 'sand', { bevel: 0.1 }),
    box(LW + 0.3, LW + 0.3, LTOP - 3.2, LTOP - 1, 'green'),
    box(LW + 0.4, LW + 0.4, LTOP - 1, LTOP, 'sand'),
    merlons(rect2(LW - 0.4, LW - 0.4), LTOP, { s: 0.9, h: 1.0, w: 0.4, tone: 'sand' }),
    cyl(2.2, 2.2, LTOP, LTOP + 0.8, 'sand', { n: 8, phase: Math.PI / 8 }),
    dome(2.2, LTOP + 0.8, 'green', { n: 8, k: 3, squash: 0.9 }),
    bar([0, 0, LTOP + 2.6], [0, 0, LTOP + 8], 0.25, 'brass'),
    ball(0.85, 0, 0, LTOP + 3.9, 'brass'), ball(0.65, 0, 0, LTOP + 5.6, 'brass'), ball(0.45, 0, 0, LTOP + 6.9, 'brass'),
    // The mast for the flag, on the lantern's terrace, and its flag.
    bar([lh + 0.9, lh + 0.9, TOP], [lh + 0.9, lh + 0.9, TOP + 13], 0.22, 'ink'),
    box(0.12, 3.2, TOP + 10.6, TOP + 12.8, 'red', { cx: lh + 0.9, cy: lh + 0.9 + 1.6 }),
    // Arched windows up the shaft, and one on each lantern face.
    ...[10, 22, 34].map((z) => onFour(arch2(1.6, z, z + 2.6), h, 0.12, 'ink2')),
    onFour(arch2(3.6, 44, 47, { pointed: true, k: 6 }), h, 0.12, 'ink2'),
    onFour(arch2(1.6, TOP + 3, TOP + 5), lh, 0.1, 'ink2'),
  ];
  // The door at the foot of the shaft, on the court side.
  parts.push(onFace(arch2(2.2, B, B + 3.2), '-x', h, 0.1, 'ink2'));
  return group(parts);
};
