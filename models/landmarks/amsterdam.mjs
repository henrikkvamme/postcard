// Amsterdam canal houses: four narrow houses on a quay above a canal, each with its own gable:
// a step gable, a neck gable, a bell gable and a spout gable. One brick-red house is the accent.
import { group } from '../lib/mesh.mjs';
import { box } from '../lib/parts.mjs';
import { slabY, gableY, plinth, onFront, rectXZ, stepsR, facade } from './_l1.mjs';

export const meta = { name: 'amsterdam', kind: 'landmark', place: 'Amsterdam', lng: 4.8916, lat: 52.3664, label: 'Canal houses', px: 84 };

const D = 6.5, YF = -D / 2; // house depth (shallow: the side wall is blank); front plane

// The right half of each gable, from the eave up.
const GABLES = {
  step: (w, zE, zT) => stepsR(w, 1.3, zE, zT, 3),
  neck: (w, zE, zT) => { const n = w * 0.32; // shoulders, a tall neck and a small pediment
    return [[w / 2, zE], [w / 2, zE + 0.5], [n + 0.7, zE + 1.3], [n, zE + 2.2], [n, zT - 1.5], [n + 0.35, zT - 1.5], [n + 0.35, zT - 1.2], [0, zT]]; },
  bell: (w, zE, zT) => { const h = zT - zE;
    return [[w / 2, zE], [w * 0.47, zE + 0.2 * h], [w * 0.36, zE + 0.42 * h], [w * 0.3, zE + 0.62 * h], [w * 0.27, zE + 0.8 * h], [w * 0.18, zE + 0.95 * h], [0, zT]]; },
  spout: (w, zE, zT) => [[w / 2, zE], [w / 2 + 0.25, zE], [w / 2 + 0.25, zE + 0.35], [0.5, zT - 0.3], [0.5, zT], [0, zT]],
};

const HOUSES = [
  { w: 5.0, zE: 12.5, zT: 17.6, g: 'step', tone: 'cream' },
  { w: 5.8, zE: 14.0, zT: 19.6, g: 'neck', tone: 'red' },
  { w: 4.6, zE: 11.5, zT: 16.4, g: 'bell', tone: 'paper' },
  { w: 5.4, zE: 13.0, zT: 17.0, g: 'spout', tone: 'stone' },
];

function house({ w, zE, zT, g, tone }, x) {
  const parts = [
    slabY(facade(w, GABLES[g](w, zE, zT)).map(([u, z]) => [x + u, z]), YF, YF + 0.5, tone),
    box(w - 0.1, D - 0.5, 0, zE, tone, { cx: x, cy: YF + 0.5 + (D - 0.5) / 2 }),
    gableY(w - 0.1, D - 0.5, zE, zT - 1, 'slate', { cx: x, cy: YF + 0.5 + (D - 0.5) / 2, end: tone }),
  ];
  // Tall windows, two or three a floor, and a door with a window beside it.
  const cols = w > 5.2 ? 3 : 2, step = (w - 1.4) / cols;
  for (let f = 0; f * 3 + 4 < zE - 1.5; f++)
    for (let c = 0; c < cols; c++) parts.push(onFront(rectXZ(x - (w - 1.4) / 2 + step * (c + 0.5), 4 + f * 3, step * 0.62, 1.9), YF));
  parts.push(onFront(rectXZ(x - w * 0.22, 0.4, 1.1, 2.4), YF, 'ink2'), onFront(rectXZ(x + w * 0.2, 1.0, 1.4, 1.8), YF));
  parts.push(onFront(rectXZ(x, zE + 0.6, 1.0, 1.4), YF));                     // the window in the gable
  return group(parts);
}

export default () => {
  const W = HOUSES.reduce((s, h) => s + h.w, 0), parts = [];
  let x = -W / 2;
  for (const h of HOUSES) { parts.push(house(h, x + h.w / 2).move(0, 0, 0.8)); x += h.w; }
  return group(
    parts,
    plinth(W + 3, D + 4, { h: 0.8, cy: 0.5 }),                                // the quay
    box(W + 3, 5, 0, 0.35, 'mist', { cy: YF - 1.5 - 2.5 }),                   // the canal
  );
};
