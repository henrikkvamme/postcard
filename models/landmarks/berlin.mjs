// Brandenburg Gate: twelve Doric columns in two rows with the walls between them, the entablature and the
// stepped attic, the low side wings, and the copper-green quadriga on top. The red is the small emblem
// on Victoria's standard.
import { group } from '../lib/mesh.mjs';
import { box, cyl, bar } from '../lib/parts.mjs';
import { plinth } from './_l1.mjs';

export const meta = { name: 'berlin', kind: 'landmark', place: 'Berlin', lng: 13.3777, lat: 52.5163, label: 'Brandenburg Gate', px: 100 };

const Z = 1.6;                                       // top of the steps the columns stand on
const XS = [-14.8, -9.2, -3.7, 3.7, 9.2, 14.8];      // the central passage is the widest
const YS = [-4.6, 4.6];

function quadriga(z0) {
  const g = 'green', out = [];
  for (const x of [-2.5, -0.85, 0.85, 2.5]) {       // four horses abreast, rearing toward the front (-y)
    out.push(box(0.9, 2.8, z0 + 1.5, z0 + 2.6, g, { cx: x, cy: -1.2 }));
    out.push(bar([x, -2.4, z0 + 2.3], [x, -3.3, z0 + 3.7], 0.7, g));       // neck
    out.push(box(0.6, 1.1, z0 + 3.4, z0 + 4.0, g, { cx: x, cy: -3.6 }));   // head
    out.push(bar([x, -2.3, z0 + 1.8], [x, -3.4, z0 + 1.1], 0.4, g));       // raised forelegs
    out.push(box(0.7, 0.6, z0, z0 + 1.7, g, { cx: x, cy: 0 }));            // hind legs
  }
  out.push(box(3.6, 1.6, z0, z0 + 1.9, g, { cy: 1.3 }));                   // chariot
  out.push(cyl(0.55, 0.42, z0 + 1.9, z0 + 4.6, g, { n: 8, cy: 1.3 }));     // Victoria
  out.push(box(0.6, 0.6, z0 + 4.6, z0 + 5.2, g, { cy: 1.3 }));
  for (const s of [-1, 1]) out.push(bar([0, 1.6, z0 + 4.0], [s * 1.7, 1.9, z0 + 5.8], 0.45, g)); // wings
  out.push(bar([0.6, 1.0, z0 + 2.4], [0.6, 0.6, z0 + 7.6], 0.2, 'ink'));    // standard
  out.push(box(1.1, 0.25, z0 + 6.2, z0 + 7.2, 'red', { cx: 0.6, cy: 0.6 })); // its emblem
  return group(out);
}

function wing(s) {                                   // a low temple-fronted side building
  const cx = s * 23.6;
  return group(
    box(8.4, 9, 0.6, 9.2, 'cream', { cx }),
    box(9.0, 9.6, 9.2, 10.0, 'paper', { cx, bevel: 0.2 }),
    ...[-2.6, 2.6].map((dx) => cyl(0.55, 0.48, 0.6, 9.2, 'paper', { n: 8, cx: cx + dx, cy: -5.0 })),
    box(8.4, 1.2, 8.6, 9.2, 'paper', { cx, cy: -5.0 }),
  );
}

export default () => {
  const parts = [
    plinth(60, 18, { h: 0.6 }),
    box(40, 13, 0.6, Z, 'stone', { bevel: 0.25 }),
  ];
  for (const x of XS) {
    for (const y of YS) {
      parts.push(box(2.1, 2.1, Z, Z + 0.5, 'cream', { cx: x, cy: y }));    // base
      parts.push(cyl(0.88, 0.76, Z + 0.5, 14.0, 'paper', { n: 10, cx: x, cy: y }));
      parts.push(box(2.1, 2.1, 14.0, 14.5, 'cream', { cx: x, cy: y }));    // capital
    }
    parts.push(box(1.2, 7.6, Z, 14.5, 'cream', { cx: x }));                 // the wall between the rows
  }
  for (const s of [-1, 1]) parts.push(box(2.4, 11.4, Z, 14.5, 'cream', { cx: s * 17.3 })); // end piers
  parts.push(
    box(37.8, 11.6, 14.5, 16.4, 'paper'),                                  // architrave and frieze
    box(38.6, 12.4, 16.4, 17.1, 'cream', { bevel: 0.2 }),                  // cornice
    box(36.0, 10.6, 17.1, 19.6, 'paper', { bevel: 0.2 }),                  // attic
    box(14.0, 9.0, 19.6, 21.2, 'cream', { bevel: 0.2 }),                   // the stepped centre of the attic
    quadriga(21.2),
    wing(-1), wing(1),
  );
  return group(parts);
};
