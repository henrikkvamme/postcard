// A Santorini chapel: a whitewashed cube with a blue dome and a white bell wall, on the edge of a sheer
// volcanic cliff above the sea. The red accent is the small door.
import { group } from '../lib/mesh.mjs';
import { box, block, cyl, dome, bar, loft, ringAt } from '../lib/parts.mjs';
import { plinth, arch2, onFace } from './_l4.mjs';

export const meta = { name: 'santorini', kind: 'landmark', place: 'Santorini', lng: 25.3753, lat: 36.4618, label: 'Oia blue-domed chapel', px: 78 };

const B = 0.6, TOP = 8;                                    // cliff top
// The cliff's plan, counter-clockwise from above; its ragged +x side is the drop to the sea.
const CLIFF = [[-10.4, -10.4], [4.4, -10.4], [6.2, -6], [5, -1.5], [6.6, 3], [5.4, 7], [6.2, 10.4], [-10.4, 10.4]];
const XMAX = 6.6;
// Rings up the cliff: each shrinks toward the land side, so the sea face stays sheer.
const level = (k, z) => ringAt(CLIFF.map(([x, y]) => [x * k + (1 - k) * XMAX * 0.9, y * k]), z);
const CX = 0.6, CY = 0.4, HW = 3;                         // chapel centre and half width

export default () => {
  const top = TOP + 0.35, parts = [
    plinth(22, 22, { h: B, tone: 'stone' }),
    box(6.4, 20.8, B, B + 0.15, 'glass', { cx: 7.2 }),                      // the sea at the foot
    loft([level(1, B), level(0.94, 3), level(0.8, 5.5), level(0.66, TOP)], 'sand', { capTone: 'sand' }),
    block(CLIFF.map(([x, y]) => [x * 0.62 + 0.38 * XMAX * 0.9 - 0.3, y * 0.6]), TOP, top, 'paper', { bevel: 0.12 }),   // whitewashed terrace
    // Chapel: cube, drum, blue dome, cross.
    box(2 * HW, 2 * HW, top, top + 4.2, 'paper', { cx: CX, cy: CY, bevel: 0.15 }),
    cyl(2.3, 2.3, top + 4.2, top + 5.2, 'paper', { n: 16, cx: CX, cy: CY }),
    dome(2.3, top + 5.2, 'glass', { n: 16, k: 5, cx: CX, cy: CY }),
    bar([CX, CY, top + 7.4], [CX, CY, top + 9.2], 0.18, 'ink2'),
    box(0.18, 1.0, top + 8.4, top + 8.6, 'ink2', { cx: CX, cy: CY }),
    // The door on the terrace side.
    onFace(arch2(1.1, top, top + 1.7), '-x', 0, 0.08, 'red').move(CX - HW, CY, 0),
    onFace(arch2(0.8, top + 2.2, top + 2.8), '+x', 0, 0.06, 'ink2').move(CX + HW, CY, 0),
  ];
  // Bell wall: a thin white slab with an arched top and two openings, beside the chapel.
  const BX = CX - 1.5, BY = CY - HW - 1.6, wall = arch2(3.4, top, top + 6.2, { k: 8 });
  parts.push(onFace(wall, '+x', 0, 0.7, 'paper').move(BX, BY, 0));
  for (const u of [-0.8, 0.8]) for (const side of ['+x', '-x']) {
    const at = side === '+x' ? 0.7 : 0.04;
    parts.push(onFace(arch2(1.0, top + 4.2, top + 5.4, { cu: side === '+x' ? -u : u }), side, at, 0.05, 'ink2').move(BX, BY, 0));
  }
  for (const u of [-0.8, 0.8]) parts.push(dome(0.32, top + 4.5, 'brass', { n: 8, k: 2, cx: BX + 0.75, cy: BY + u, squash: 1.4 }));
  // A low white parapet along the cliff edge.
  parts.push(box(0.35, 2.6, top, top + 0.7, 'paper', { cx: 5.2, cy: 4.6 }), box(0.35, 2.4, top, top + 0.7, 'paper', { cx: 5.2, cy: -4.6 }));
  return group(parts);
};
