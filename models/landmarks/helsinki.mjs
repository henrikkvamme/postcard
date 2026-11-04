// Helsinki Cathedral: a white Greek cross on a high terrace with the wide stair in front, a portico with a
// pediment on each arm, the big green dome on its colonnaded drum and four small green domes at the corners.
// The red is the main door under the front portico.
import { group } from '../lib/mesh.mjs';
import { box, cyl, dome, bar } from '../lib/parts.mjs';
import { plinth, gableY } from './_l1.mjs';
import { gable } from '../lib/parts.mjs';

export const meta = { name: 'helsinki', kind: 'landmark', place: 'Helsinki', lng: 24.9522, lat: 60.1704, label: 'Helsinki Cathedral', px: 104 };

const T = 3.4;                    // terrace top
const AW = 16, AL = 23, EAVE = T + 15.5, RIDGE = T + 19.4, PD = 4.6;

// A portico at the end of the arm along -y: six columns, entablature; the roof comes from the arm.
function portico(door) {
  const y = -AL - PD + 0.9, out = [];
  for (let i = 0; i < 6; i++) out.push(cyl(0.62, 0.55, T, EAVE - 1.4, 'paper', { n: 10, cx: -6.5 + i * 2.6, cy: y }));
  out.push(box(AW, PD + 0.2, EAVE - 1.4, EAVE, 'paper', { cy: -AL - PD / 2 + 0.1 }));
  if (door) out.push(box(3.0, 0.2, T, T + 6.5, 'red', { cy: -AL - 0.1 })); // the main door, toward the stair
  return group(out);
}

const lantern = (x, y, z, r, top) => group(
  cyl(r, r, z, z + r * 2, 'paper', { n: 10, cx: x, cy: y }),
  dome(r * 1.1, z + r * 2, 'green', { n: 10, k: 3, cx: x, cy: y, squash: 1.2 }),
  bar([x, y, z + r * 3.2], [x, y, top], Math.max(0.2, r * 0.18), 'brass'),
);

export default () => {
  const parts = [
    plinth(60, 60, { h: T, tone: 'stone', bevel: 0.4 }),                  // the terrace
    plinth(66, 80, { h: 0.4, tone: 'cream', cy: -9 }),                     // the ground plate
  ];
  for (let i = 0; i < 6; i++) parts.push(box(34, 2.2, 0, T * (1 - (i + 1) / 7), 'stone', { cy: -30 - 1.1 - i * 2.2 })); // the great stair
  // The cross: two arms, each with a low gabled roof running out over its two porticoes.
  parts.push(box(AW, 2 * AL, T, EAVE, 'paper'), box(2 * AL, AW, T, EAVE, 'paper'));
  parts.push(gableY(AW, 2 * (AL + PD), EAVE, RIDGE, 'mist', { o: 0.3 }));
  parts.push(gable(2 * (AL + PD), AW, EAVE, RIDGE, 'mist', { o: 0.3 }));
  for (const a of [0, 90, 180, 270]) parts.push(portico(a === 0).turn('z', a));
  parts.push(box(26, 26, T, T + 21, 'paper', { bevel: 0.3 }));               // the crossing
  // Drum, colonnade, cornice, dome, lantern.
  const zd = T + 21;
  parts.push(cyl(9.6, 9.6, zd, zd + 9, 'paper', { n: 20 }));
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2;
    parts.push(cyl(0.42, 0.36, zd, zd + 8.2, 'paper', { n: 10, cx: 10.6 * Math.cos(a), cy: 10.6 * Math.sin(a) })); }
  parts.push(cyl(11.3, 11.3, zd + 8.2, zd + 9.4, 'paper', { n: 20 }));
  parts.push(dome(10.0, zd + 9.4, 'green', { n: 20, k: 6, squash: 1.25 }));
  parts.push(lantern(0, 0, zd + 9.4 + 12.3, 1.9, zd + 9.4 + 12.3 + 12));
  // Four small domes on the corners of the crossing.
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = sx * 10.6, y = sy * 10.6, z = T + 21;
    parts.push(cyl(2.7, 2.7, z, z + 4.2, 'paper', { n: 12, cx: x, cy: y }));
    parts.push(dome(2.9, z + 4.2, 'green', { n: 12, k: 4, cx: x, cy: y, squash: 1.3 }));
    parts.push(lantern(x, y, z + 4.2 + 3.6, 0.6, z + 4.2 + 3.6 + 4.2));
  }
  return group(parts);
};
