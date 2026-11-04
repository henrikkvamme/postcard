// Hohensalzburg Fortress, Salzburg: a long white castle along the crest of a wooded hill. Curtain walls and
// round bastions, the tall palace block (Hoher Stock), a long wing, the square watchtower with its steep
// roof and the bell tower. The red accent is the palace roof.
import { group } from '../lib/mesh.mjs';
import { box, gable, spire, cyl, rect2, block } from '../lib/parts.mjs';
import { plinth, hill, onFace } from './_l4.mjs';

export const meta = { name: 'salzburg', kind: 'landmark', place: 'Salzburg', lng: 13.0476, lat: 47.7949, label: 'Hohensalzburg Fortress', px: 104 };

const B = 0.8, CREST = 32, W = 41;                       // hill crest, top of the curtain wall
// The hill's footprint, counter-clockwise from above: long along y.
const FOOT = [[26, -60], [32, -30], [30, 18], [24, 56], [-20, 62], [-30, 28], [-31, -26], [-22, -58]];
// The fortress's walled plan on the crest.
const KEEP = [[12, -32], [15, -6], [13, 22], [7, 32], [-9, 33], [-14, 12], [-14, -18], [-8, -32]];

const ridge = (len, wid, z0, z1, tone, cx, cy, end = 'paper') => gable(len, wid, z0, z1, tone, { o: 0.6, end }).turn('z', 90).move(cx, cy, 0);

export default () => {
  const parts = [
    plinth(72, 132, { h: B, tone: 'stone' }),
    hill(FOOT, [[1, B], [0.86, 10], [0.72, 20], [0.62, 27], [0.56, CREST]], 'green'),
    // Curtain wall: one white mass on the crest.
    block(KEEP, CREST - 3, W, 'paper', { bevel: 0.3 }),
    // Round bastions at both ends.
    cyl(5.5, 5.5, CREST - 8, W + 1, 'paper', { n: 12, cx: 3, cy: 32 }),
    cyl(5, 5, CREST - 8, W + 1, 'paper', { n: 12, cx: 2, cy: -32 }),
    // Hoher Stock: the tall palace block, with the red roof.
    box(17, 24, W, W + 15, 'paper', { cx: 2, cy: 4, bevel: 0.2 }),
    ridge(24, 17, W + 15, W + 22, 'red', 2, 4),
    // The long wing along the west wall.
    box(10, 34, W, W + 9, 'paper', { cx: -9, cy: -12, bevel: 0.15 }),
    ridge(34, 10, W + 9, W + 14, 'slate', -9, -12),
    // A lower wing to the east.
    box(9, 20, W, W + 6, 'paper', { cx: 8, cy: -19, bevel: 0.15 }),
    ridge(20, 9, W + 6, W + 10, 'slate', 8, -19),
    // Watchtower: square, tall, steep pyramid roof.
    box(7, 7, W, W + 25, 'paper', { cx: 9.5, cy: 21, bevel: 0.15 }),
    spire(rect2(7.6, 7.6, 9.5, 21), W + 25, W + 32, 'slate', { cx: 9.5, cy: 21 }),
    // Bell tower: slimmer, with a spire.
    box(5, 5, W, W + 20, 'paper', { cx: -7, cy: 16, bevel: 0.12 }),
    spire(rect2(5.4, 5.4, -7, 16), W + 20, W + 28, 'slate', { cx: -7, cy: 16 }),
  ];
  // Rows of small windows on the palace's long faces.
  for (const s of ['+x', '-x']) for (const z of [W + 4, W + 9]) for (const u of [-7.5, -2.5, 2.5, 7.5]) {
    const w = onFace([[u - 0.8, z], [u + 0.8, z], [u + 0.8, z + 2], [u - 0.8, z + 2]], s, 8.5, 0.08, 'ink2');
    parts.push((s === '+x' ? w.mirrorY() : w).move(2, 4, 0));
  }
  return group(parts);
};
