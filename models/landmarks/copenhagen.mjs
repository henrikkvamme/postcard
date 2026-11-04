// Nyhavn, Copenhagen: a row of narrow gabled town houses in different paper tones along the quay, steep
// roofs with their ridges along the street, one cross gable, the canal and one old sailing boat.
// One red house is the accent.
import { group } from '../lib/mesh.mjs';
import { box, gable, hull, bar } from '../lib/parts.mjs';
import { plinth, onFront, rectXZ, slabY } from './_l1.mjs';

export const meta = { name: 'copenhagen', kind: 'landmark', place: 'Copenhagen', lng: 12.5911, lat: 55.6798, label: 'Nyhavn', px: 88 };

const D = 9, YF = -D / 2, Z0 = 0.8;
const HOUSES = [
  { w: 6.0, h: 12.5, tone: 'paper' },
  { w: 5.2, h: 11.0, tone: 'sand' },
  { w: 6.6, h: 14.0, tone: 'red' },
  { w: 5.0, h: 10.5, tone: 'cream' },
  { w: 7.0, h: 13.0, tone: 'brass', cross: true },
  { w: 5.4, h: 11.5, tone: 'mist' },
  { w: 6.0, h: 12.0, tone: 'stone' },
];

function house({ w, h, tone, cross }, x) {
  const parts = [
    box(w, D, 0, h, tone, { cx: x }),
    gable(w + 0.1, D, h, h + 4.2, 'slate', { o: 0.25, end: tone }).move(x, 0, 0),
  ];
  if (cross) parts.push(slabY([[x - 2.2, h], [x + 2.2, h], [x + 2.2, h + 1.6], [x, h + 3.6], [x - 2.2, h + 1.6]], YF - 0.1, 0, tone)); // a front gable
  const cols = Math.max(2, Math.round((w - 1) / 1.7)), step = (w - 1) / cols;
  for (let f = 0; 3.6 + f * 2.9 < h - 1; f++)
    for (let c = 0; c < cols; c++) parts.push(onFront(rectXZ(x - (w - 1) / 2 + step * (c + 0.5), 3.6 + f * 2.9, 0.95, 1.6), YF));
  parts.push(onFront(rectXZ(x, 0, 1.2, 2.4), YF, 'ink2'));
  return group(parts);
}

// An old wooden sailing boat moored in the canal: a dark hull with sheer, a cabin, one mast and its yard.
function boat(x, y) {
  const sec = (w, z0, z1) => [[-w * 0.32, z0], [w * 0.32, z0], [w / 2, z1], [-w / 2, z1]];
  return group(
    hull([[-7, sec(1.6, 0.9, 2.6)], [-5.2, sec(3.4, 0.2, 2.1)], [3, sec(3.6, 0.2, 2.1)], [6.2, sec(1.8, 0.7, 2.5)], [7.6, sec(0.2, 1.4, 2.8)]], 'ink2'),
    box(3.2, 2.2, 2.1, 3.3, 'paper', { cx: -3.2 }),
    bar([0.6, 0, 2.1], [0.6, 0, 15], 0.28, 'ink'),
    bar([0.6, -2.6, 12.2], [0.6, 2.6, 12.2], 0.2, 'ink'),
    bar([0.6, 0, 15], [7.6, 0, 2.8], 0.1, 'ink'),          // the forestay
  ).move(x, y, 0.2);
}

export default () => {
  const W = HOUSES.reduce((s, h) => s + h.w, 0), parts = [];
  let x = -W / 2;
  for (const h of HOUSES) { parts.push(house(h, x + h.w / 2).move(0, 0, Z0)); x += h.w; }
  return group(
    parts,
    plinth(W + 2, D + 7, { h: Z0, cy: -2 }),                                // the quay
    box(W + 2, 9, 0, 0.35, 'mist', { cy: YF - 5.5 - 4.5 }),                  // the canal
    boat(4, YF - 5.5 - 4.4),
  );
};
