// La Seu, Palma: the sandstone Gothic cathedral high on the old sea wall. A tall nave over lower aisles and
// chapels, a long row of buttress pinnacles with flying arches, two slender turrets on the west front,
// the great rose window over the royal chapel, the square bell tower, and the pool of the Parc de la Mar
// below the wall. The red accent is the sea-side door.
import { group } from '../lib/mesh.mjs';
import { box, block, cyl, spire, gable, bar, rect2, circle2 } from '../lib/parts.mjs';
import { plinth, arch2, onFace } from './_l4.mjs';

export const meta = { name: 'palma', kind: 'landmark', place: 'Palma', lng: 2.6484, lat: 39.5675, label: 'Palma Cathedral', px: 108 };

const B = 0.8, Z = 9;                                     // the sea wall's top: the cathedral's floor
const X0 = -45, X1 = 50;                                  // nave from the royal chapel (east, -x) to the west front (+x)
const oct = (r, cx, cy) => Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) * Math.PI / 4; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

export default () => {
  const L = X1 - X0, MX = (X0 + X1) / 2, parts = [
    plinth(142, 92, { h: B, cx: -5, cy: -9 }),
    box(134, 13, B, B + 0.25, 'glass', { cx: -5, cy: -44 }),                  // the pool below the wall
    box(134, 64, B, Z, 'sand', { cx: -5, cy: -2, top: 'stone', bevel: 0.3 }),  // the sea wall and its terrace
    // Chapels, aisles, nave: three steps up.
    box(L - 6, 46, Z, Z + 17, 'sand', { cx: MX, bevel: 0.2 }),
    box(L, 38, Z, Z + 27, 'sand', { cx: MX, bevel: 0.2 }),
    box(L, 20, Z, Z + 38, 'sand', { cx: MX, bevel: 0.2 }),
    gable(L, 20, Z + 38, Z + 42, 'stone', { end: 'sand' }).move(MX, 0, 0),
    // Royal chapel and the Trinity chapel behind it, lower, at the east end.
    box(13, 18, Z, Z + 28, 'sand', { cx: X0 - 6.5, bevel: 0.2 }),
    gable(13, 18, Z + 28, Z + 31, 'stone', { end: 'sand' }).move(X0 - 6.5, 0, 0),
    box(7, 10, Z, Z + 18, 'sand', { cx: X0 - 16.5, bevel: 0.2 }),
    // The rose window high on the nave's east wall, and a pointed window under it.
    onFace(circle2(4.5, 16).map(([u, v]) => [u, v + Z + 34]), '-x', -X0, 0.15, 'ink2'),
    // The west front: a tall portal and a smaller rose.
    onFace(arch2(6, Z, Z + 9, { pointed: true, k: 8 }), '+x', X1, 0.2, 'ink2'),
    onFace(circle2(3, 12).map(([u, v]) => [u, v + Z + 27]), '+x', X1, 0.15, 'ink2'),
    // The bell tower on the north side, near the east end.
    box(9, 9, Z, Z + 46, 'sand', { cx: -30, cy: 25.5, bevel: 0.2 }),
    box(9.8, 9.8, Z + 45, Z + 46.5, 'stone', { cx: -30, cy: 25.5 }),
    onFace(arch2(2.4, Z + 36, Z + 42, { pointed: true, k: 6 }), '+x', 4.5, 0.12, 'ink2').move(-30, 25.5, 0),
    onFace(arch2(2.4, Z + 36, Z + 42, { pointed: true, k: 6 }), '+y', 4.5, 0.12, 'ink2').move(-30, 25.5, 0),
    // The door in the south (sea) side, the Portal del Mirador.
    onFace(arch2(3.6, Z, Z + 6, { pointed: true, k: 6 }), '-y', 23, 0.2, 'red').move(8, 0, 0),
  ];
  // West-front turrets: octagonal shafts with spires.
  for (const s of [1, -1]) parts.push(
    cyl(2.3, 2.3, Z, Z + 46, 'sand', { n: 8, cx: X1, cy: s * 10.5, phase: Math.PI / 8 }),
    spire(oct(2.5, X1, s * 10.5), Z + 46, Z + 53, 'sand', { cx: X1, cy: s * 10.5 }));
  // Buttress pinnacles along both sides, each with a flying arch to the nave wall.
  for (const s of [1, -1]) for (let i = 0; i < 9; i++) {
    const x = X0 + 5 + i * ((L - 10) / 8), y = s * 21;
    parts.push(box(2.6, 4.4, Z, Z + 33, 'sand', { cx: x, cy: y }),
      spire(rect2(2.6, 4.4, x, y), Z + 33, Z + 40, 'sand', { cx: x, cy: y }),
      bar([x, s * 19, Z + 30], [x, s * 10, Z + 35.5], 1.1, 'sand'));
    if (i < 8) parts.push(onFace(arch2(2.6, Z + 6, Z + 13, { pointed: true, k: 6, cu: x + (L - 10) / 16 }), s > 0 ? '+y' : '-y', 23, 0.12, 'ink2'),
      onFace(arch2(3, Z + 28.5, Z + 34, { pointed: true, k: 6, cu: x + (L - 10) / 16 }), s > 0 ? '+y' : '-y', 10, 0.12, 'ink2'));
  }
  return group(parts);
};
