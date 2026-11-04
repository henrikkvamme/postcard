// House of the Blackheads, Riga: the red brick front with its tall gable of four stepped tiers, white
// cornices between the tiers and a slim spire, beside the plainer white Schwab House.
import { group } from '../lib/mesh.mjs';
import { box, spire, cyl } from '../lib/parts.mjs';
import { slabY, gableY, plinth, onFront, rectXZ, facade, arch2 } from './_l1.mjs';
import { circle2 } from '../lib/parts.mjs';

export const meta = { name: 'riga', kind: 'landmark', place: 'Riga', lng: 24.1069, lat: 56.9474, label: 'House of the Blackheads', px: 88 };

const D = 12, YF = -D / 2, Z0 = 0.6;

// The Blackheads gable: tiers that step in with a curled shoulder and a cornice lip at each level.
const TIERS = [[13, 12.6], [10.2, 16.0], [7.6, 19.0], [5.0, 21.6], [2.6, 23.8]];
function blackheadsR() {
  const R = [];
  for (let i = 0; i + 1 < TIERS.length; i++) {
    const [w, z] = TIERS[i], [w1, z1] = TIERS[i + 1], a = w / 2, b = w1 / 2;
    R.push([a, z], [a + 0.3, z], [a + 0.3, z + 0.45], [a - 0.1, z + 0.45],
      [b + (a - b) * 0.55, z + 0.45 + (z1 - z - 0.45) * 0.35], [b + 0.15, z + 0.45 + (z1 - z - 0.45) * 0.75], [b, z1]);
  }
  const [wT, zT] = TIERS[TIERS.length - 1];
  R.push([wT / 2, zT], [wT / 2 + 0.25, zT], [wT / 2 + 0.25, zT + 0.4], [0, zT + 0.4]);
  return R;
}

function blackheads(x) {
  const W = 13, top = TIERS[TIERS.length - 1][1] + 0.4, parts = [
    slabY(facade(W, blackheadsR()).map(([u, z]) => [x + u, z]), YF, YF + 0.6, 'red'),
    box(W - 0.1, D - 0.6, 0, 12.6, 'red', { cx: x, cy: YF + 0.6 + (D - 0.6) / 2 }),
    gableY(W - 0.1, D - 0.6, 12.6, 20.6, 'ink2', { cx: x, cy: YF + 0.6 + (D - 0.6) / 2, end: 'red' }),
    // The slim spire on the top tier.
    cyl(0.9, 0.9, top, top + 1.6, 'paper', { n: 8, cx: x, cy: YF + 0.3 }),
    spire(circle2(0.9, 8, x, YF + 0.3), top + 1.6, top + 7.5, 'ink2', { cx: x, cy: YF + 0.3 }),
    cyl(0.32, 0.32, top + 7.5, top + 8.1, 'brass', { n: 6, cx: x, cy: YF + 0.3 }),
  ];
  for (const [w, z] of TIERS.slice(1, -1)) parts.push(box(w * 0.55, 0.16, z - 0.25, z + 0.05, 'paper', { cx: x, cy: YF - 0.08 })); // white bands
  parts.push(box(W + 0.4, 0.3, 12.3, 12.9, 'paper', { cx: x, cy: YF - 0.1 }));                    // the main cornice
  for (const z of [4.6, 8.4]) for (const dx of [-4.6, -1.55, 1.55, 4.6]) parts.push(onFront(rectXZ(x + dx, z, 1.5, 2.6), YF));
  parts.push(onFront(arch2(2.4, 3.4, { x }), YF, 'ink2'));                                   // the portal
  for (const dx of [-3.4, 3.4]) parts.push(onFront(rectXZ(x + dx, 0.9, 1.6, 2.2), YF));
  for (const dx of [-2.5, 0, 2.5]) parts.push(onFront(rectXZ(x + dx, 13.6, 1.0, 1.6), YF));
  for (const dx of [-1.3, 1.3]) parts.push(onFront(rectXZ(x + dx, 16.8, 0.9, 1.4), YF));
  parts.push(onFront(rectXZ(x, 19.7, 0.9, 1.3), YF));
  return group(parts);
}

// The Schwab House: a narrower white front with a plain three-step gable.
function schwab(x) {
  const W = 8, R = [[4, 12.6], [4, 14.8], [2.8, 14.8], [2.8, 17.0], [1.6, 17.0], [1.6, 19.0], [0, 19.0]];
  const parts = [
    slabY(facade(W, R).map(([u, z]) => [x + u, z]), YF, YF + 0.5, 'paper'),
    box(W - 0.1, D - 0.5, 0, 12.6, 'paper', { cx: x, cy: YF + 0.5 + (D - 0.5) / 2 }),
    gableY(W - 0.1, D - 0.5, 12.6, 17.4, 'ink2', { cx: x, cy: YF + 0.5 + (D - 0.5) / 2 }),
  ];
  for (const z of [4.6, 8.4]) for (const dx of [-2, 0, 2]) parts.push(onFront(rectXZ(x + dx, z, 1.2, 2.4), YF));
  parts.push(onFront(arch2(1.8, 3.0, { x }), YF, 'ink2'));
  for (const dx of [-1.1, 1.1]) parts.push(onFront(rectXZ(x + dx, 13.4, 0.9, 1.4), YF));
  return group(parts);
}

export default () => group(
  blackheads(-4).move(0, 0, Z0),
  schwab(6.5).move(0, 0, Z0),
  plinth(25, D + 8, { h: Z0, cy: -3 }),                                   // Town Hall Square
);
