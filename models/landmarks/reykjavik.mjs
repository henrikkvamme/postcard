// Hallgrímskirkja, Reykjavík: a tall concrete tower flanked by wings of stepped columns that fall away like
// basalt, a belfry of narrow slits and clock faces, a sharp steeple. A plain steep-roofed nave and a round
// apse stand behind. The red accent is the front door.
import { group } from '../lib/mesh.mjs';
import { box, block, spire, gable, cyl, bar, rect2, chamfer2, circle2 } from '../lib/parts.mjs';
import { plinth, arch2, onFace, onFour } from './_l4.mjs';

export const meta = { name: 'reykjavik', kind: 'landmark', place: 'Reykjavík', lng: -21.9266, lat: 64.1417, label: 'Hallgrímskirkja', px: 100 };

const B = 0.8, TW = 9, SHAFT = 58, BELL = 64;
// The wing columns, from the tower outward: each one a step lower, the steps flattening toward the ends.
const STEPS = [50, 42.5, 36, 30.5, 25.5, 21, 17, 13.5], CW = 2.7;

export default () => {
  const h = TW / 2, parts = [
    plinth(80, 60, { h: B }).move(-15, 0, 0),
    // Tower: the shaft, a belfry a step narrower, and the steeple.
    box(TW, TW, B, SHAFT, 'paper', { bevel: 0.15 }),
    box(TW - 1, TW - 1, SHAFT, BELL, 'paper'),
    onFour([[-2.2, SHAFT + 1], [-1.4, SHAFT + 1], [-1.4, BELL - 0.8], [-2.2, BELL - 0.8]], h - 0.5, 0.1, 'ink2'),
    onFour([[1.4, SHAFT + 1], [2.2, SHAFT + 1], [2.2, BELL - 0.8], [1.4, BELL - 0.8]], h - 0.5, 0.1, 'ink2'),
    onFour(circle2(1.25, 12).map(([u, v]) => [u, v + SHAFT - 4]), h, 0.1, 'ink2'),        // clock faces
    spire(rect2(TW - 1, TW - 1), BELL, BELL + 9.5, 'stone'),
    bar([0, 0, BELL + 9], [0, 0, BELL + 11], 0.3, 'ink'),
    box(0.25, 1.4, BELL + 10.1, BELL + 10.4, 'ink'),
    // Tall slot windows up the tower front, and the door at its foot.
    onFace([[-0.6, 14], [0.6, 14], [0.6, 44], [-0.6, 44]], '+x', h, 0.1, 'ink2'),
    onFace(arch2(3.2, B, 6, { pointed: true, k: 6 }), '+x', h, 0.2, 'red'),
    // Nave: a long plain hall with a steep roof, and the round apse at its east end.
    box(40, 20, B, 16, 'paper', { cx: -24, bevel: 0.12 }),
    gable(40, 20, 16, 31, 'slate', { o: 0.4, end: 'paper' }).move(-24, 0, 0),
    cyl(9.2, 9.2, B, 15, 'paper', { n: 16, cx: -44 }),
    cyl(9.6, 0.6, 15, 26, 'slate', { n: 16, cx: -44 }),
  ];
  // The wings: columns with chamfered fronts, so each reads as a basalt prism.
  for (const s of [1, -1]) STEPS.forEach((z, i) => {
    const cy = s * (h + CW * (i + 0.5)), depth = 8 - i * 0.35;
    parts.push(block(chamfer2(depth, CW, 0.7, -0.3, cy), B, z, 'paper', { bevel: 0.25 }));
  });
  // Nave windows: tall slits.
  for (const s of ['+y', '-y']) for (let x = -40; x <= -10; x += 6) parts.push(onFace([[x - 0.5, 4], [x + 0.5, 4], [x + 0.5, 13], [x - 0.5, 13]], s, 10, 0.1, 'ink2'));
  return group(parts);
};
