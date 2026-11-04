// Puerta de Alcalá: a wide granite gate of five openings, three round arches between two square-headed
// side passages, columns on the face, a heavy cornice, a raised central attic and the crowning group of
// figures round the royal arms. It stands in a round plaza.
// One red accent: the royal shield on the crown of the attic.
import { group, faceNormal } from '../lib/mesh.mjs';
import { box, block, rect2, cyl, lathe } from '../lib/parts.mjs';
import { disc, slab, wallPts } from './_l2.mjs';

export const meta = { name: 'madrid', kind: 'landmark', place: 'Madrid', lng: -3.6889, lat: 40.4200, label: 'Puerta de Alcalá', px: 88 };

const P = 1, W = 41, D = 9, TOP = P + 14, Y0 = -D / 2, Y1 = D / 2;

export default () => {
  const parts = [disc(28, P, { ry: 19, n: 32 })];
  // The body: one wall with the five openings cut through it.
  const open = [
    { x0: -17.6, x1: -14.2, zs: P + 7.6, rise: 0 },
    { x0: -10.4, x1: -5.6, zs: P + 6.6, rise: 2.4 },
    { x0: -2.6, x1: 2.6, zs: P + 7.2, rise: 2.6 },
    { x0: 5.6, x1: 10.4, zs: P + 6.6, rise: 2.4 },
    { x0: 14.2, x1: 17.6, zs: P + 7.6, rise: 0 },
  ];
  // The reveals and soffits inside the openings are in shade, so the five openings read as openings.
  const wall = slab(wallPts(-W / 2, W / 2, P, TOP - 1.4, open), Y0, Y1, 'paper');
  wall.faces = wall.faces.map((f) => {
    const n = faceNormal(f.pts), cx = f.pts.reduce((a, p) => a + p[0], 0) / f.pts.length;
    return Math.abs(n[1]) < 0.5 && open.some((o) => cx > o.x0 - 0.01 && cx < o.x1 + 0.01) ? { ...f, tone: 'slate' } : f;
  });
  parts.push(wall);
  for (const o of open) parts.push(box(o.x1 - o.x0, D + 1.6, P, P + 0.05, 'ink2', { cx: (o.x0 + o.x1) / 2 }));
  // Plinth course at the foot.
  for (const [a, b] of [[-W / 2 - 0.4, -17.6], [-14.2, -10.4], [-5.6, -2.6], [2.6, 5.6], [10.4, 14.2], [17.6, W / 2 + 0.4]])
    parts.push(box(b - a, D + 0.8, P, P + 1.6, 'stone', { cx: (a + b) / 2 }));
  // Columns on both faces: paired between the arches, single at the ends, on a base, with a capital block.
  const cols = [-19.6, -12.3, -4.1, 4.1, 12.3, 19.6];
  for (const sy of [-1, 1]) for (const x of cols) {
    const y = sy * (D / 2 + 0.55);
    parts.push(cyl(0.6, 0.52, P + 1.6, TOP - 2.6, 'paper', { n: 8, cx: x, cy: y }), box(1.6, 1.4, TOP - 2.6, TOP - 1.9, 'paper', { cx: x, cy: y }));
  }
  // Entablature and cornice, the full width.
  parts.push(box(W + 0.6, D + 1.6, TOP - 1.9, TOP - 0.7, 'paper'));
  parts.push(block(rect2(W + 1.6, D + 2.4), TOP - 0.7, TOP + 0.3, 'paper', { bevel: 0.4 }));
  // The attic over the three arches, with its own cornice; figure groups at the corners of the main cornice.
  parts.push(box(22, D - 1, TOP + 0.3, TOP + 4.6, 'paper'), block(rect2(23.2, D + 0.2), TOP + 4.6, TOP + 5.4, 'paper', { bevel: 0.35 }));
  for (const sx of [-1, 1]) {
    parts.push(box(3, 3, TOP + 0.3, TOP + 1.4, 'stone', { cx: sx * 18.6 }));
    parts.push(lathe([[1.1, TOP + 1.4], [0.9, TOP + 3.0], [0.55, TOP + 3.6], [0.01, TOP + 4.2]], 'stone', { n: 6, cx: sx * 18.6 }));
  }
  // The crowning group: a stepped base, the shield, and a reclining figure each side.
  parts.push(box(9, 3.2, TOP + 5.4, TOP + 6.6, 'paper'));
  const z = TOP + 6.6;
  parts.push(slab([[0, z], [1.2, z + 0.5], [1.7, z + 1.4], [1.7, z + 3.2], [-1.7, z + 3.2], [-1.7, z + 1.4], [-1.2, z + 0.5]], -0.6, 0.6, 'red'));
  for (const sx of [-1, 1]) parts.push(block(rect2(3.2, 1.8, sx * 3.2, 0), TOP + 6.6, TOP + 8, 'stone'), lathe([[0.8, TOP + 8], [0.6, TOP + 9.2], [0.01, TOP + 9.8]], 'stone', { n: 6, cx: sx * 2.8 }));
  return group(parts);
};
