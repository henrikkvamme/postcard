// A Santorini chapel: a whitewashed cube with a tall drum and a blue dome, and a white bell wall beside it,
// on a whitewashed terrace at the edge of a low, pale volcanic cliff above the sea. The chapel is the
// subject; the cliff is only its stand. The red accent is the small door.
import { group } from '../lib/mesh.mjs';
import { box, block, cyl, dome, bar, loft, ringAt } from '../lib/parts.mjs';
import { plinth, arch2, onFace } from './_l4.mjs';

export const meta = { name: 'santorini', kind: 'landmark', place: 'Santorini', lng: 25.3753, lat: 36.4618, label: 'Oia blue-domed chapel', px: 78 };

const B = 0.5, TOP = 4.2;                                  // cliff top
// The cliff's plan, counter-clockwise from above; its ragged +x side is the drop to the sea.
const CLIFF = [[-8.6, -8], [3.4, -8], [5, -4.6], [4.2, -1.2], [5.6, 2.6], [4.6, 5.6], [5.2, 8], [-8.6, 8]];
const XMAX = 5.6;
// Rings up the cliff: each shrinks toward the land side, so the sea face stays steep.
const level = (k, z) => ringAt(CLIFF.map(([x, y]) => [x * k + (1 - k) * XMAX * 0.9, y * k]), z);
const CX = -0.6, CY = 0.2, HW = 3.1;                       // chapel centre and half width

export default () => {
  const top = TOP + 0.3, H = 4.6, D = top + H, parts = [
    plinth(18, 18, { h: B, tone: 'stone' }),
    box(4.2, 17, B, B + 0.12, 'mist', { cx: 6.6 }),                        // the sea at the foot
    loft([level(1, B), level(0.95, 1.8), level(0.86, 3.2), level(0.8, TOP)], 'sand', { capTone: 'stone' }),
    block(CLIFF.map(([x, y]) => [x * 0.78 + 0.22 * XMAX * 0.9 - 0.3, y * 0.76]), TOP, top, 'paper', { bevel: 0.1 }),   // whitewashed terrace
    // Chapel: cube, tall drum, blue dome, cross.
    box(2 * HW, 2 * HW, top, D, 'paper', { cx: CX, cy: CY, bevel: 0.15 }),
    cyl(2.5, 2.5, D, D + 1.6, 'paper', { n: 16, cx: CX, cy: CY }),
    dome(2.6, D + 1.6, 'glass', { n: 16, k: 5, cx: CX, cy: CY, squash: 1.1 }),
    bar([CX, CY, D + 4.2], [CX, CY, D + 5.8], 0.2, 'ink2'),
    box(0.2, 1.1, D + 5.0, D + 5.25, 'ink2', { cx: CX, cy: CY }),
    // The door on the terrace side, a window on the sea side.
    onFace(arch2(1.3, top, top + 2.0), '-x', 0, 0.08, 'red').move(CX - HW, CY, 0),
    onFace(arch2(0.9, top + 2.5, top + 3.2), '+x', 0, 0.06, 'glass').move(CX + HW, CY, 0),
  ];
  // Bell wall: a thin white slab with an arched top and two openings, beside the chapel.
  const BX = CX - 1.2, BY = CY - HW - 1.5, wall = arch2(3.4, top, top + 6.4, { k: 8 });
  parts.push(onFace(wall, '+x', 0, 0.7, 'paper').move(BX, BY, 0));
  for (const u of [-0.8, 0.8]) for (const side of ['+x', '-x']) {
    const at = side === '+x' ? 0.7 : 0.04;
    parts.push(onFace(arch2(1.0, top + 4.4, top + 5.6, { cu: side === '+x' ? -u : u }), side, at, 0.05, 'ink2').move(BX, BY, 0));
  }
  for (const u of [-0.8, 0.8]) parts.push(dome(0.32, top + 4.7, 'brass', { n: 8, k: 2, cx: BX + 0.75, cy: BY + u, squash: 1.4 }));
  // A low white parapet along the cliff edge.
  parts.push(box(0.35, 2.4, top, top + 0.7, 'paper', { cx: 4.0, cy: 4.4 }), box(0.35, 2.2, top, top + 0.7, 'paper', { cx: 4.0, cy: -4.6 }));
  return group(parts);
};
