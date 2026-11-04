// Frankfurt Römer: three tall stepped gables side by side over a sandstone arcade, steep slate roofs behind,
// the middle house a little taller with the red balcony.
import { group } from '../lib/mesh.mjs';
import { box } from '../lib/parts.mjs';
import { slabY, gableY, plinth, onFront, rectXZ, arch2, stepsR, facade } from './_l1.mjs';

export const meta = { name: 'frankfurt', kind: 'landmark', place: 'Frankfurt', lng: 8.6822, lat: 50.1107, label: 'Römer', px: 84 };

const W = 8.4, D = 13, YF = -D / 2, ZE = 11.2, Z0 = 0.6;

function house(x, zT) {
  const parts = [
    slabY(facade(W, stepsR(W, 1.2, ZE, zT, 5)).map(([u, z]) => [x + u, z]), YF, YF + 0.5, 'paper'),
    box(W - 0.1, D - 0.5, 0, ZE, 'paper', { cx: x, cy: YF + 0.5 + (D - 0.5) / 2 }),
    gableY(W - 0.1, D - 0.5, ZE, zT - 0.8, 'ink2', { cx: x, cy: YF + 0.5 + (D - 0.5) / 2 }),
    box(W, 0.12, 0, 3.9, 'sand', { cx: x, cy: YF - 0.06 }),                 // the sandstone ground floor
  ];
  for (const dx of [-2.6, 0, 2.6]) parts.push(onFront(arch2(1.9, 3.1, { x: x + dx, z: 0, pointed: true }), YF - 0.12, 'ink2'));
  for (const z of [5.0, 8.0]) for (const dx of [-2.7, -0.9, 0.9, 2.7]) parts.push(onFront(rectXZ(x + dx, z, 1.1, 1.8), YF));
  for (const dx of [-1.6, 1.6]) parts.push(onFront(rectXZ(x + dx, ZE + 0.9, 1.0, 1.6), YF));
  parts.push(onFront(rectXZ(x, ZE + 3.6, 0.9, 1.5), YF));
  return group(parts);
}

export default () => group(
  house(-W, 20.4).move(0, 0, Z0),
  house(0, 21.6).move(0, 0, Z0),
  house(W, 20.4).move(0, 0, Z0),
  // The Kaiser balcony on the middle house.
  box(5.6, 1.2, Z0 + 4.2, Z0 + 4.5, 'red', { cy: YF - 0.6 }),
  box(5.6, 0.12, Z0 + 4.5, Z0 + 5.4, 'red', { cy: YF - 1.15 }),
  plinth(3 * W + 3, D + 8, { h: Z0, cy: -2 }),                              // the Römerberg square
);
