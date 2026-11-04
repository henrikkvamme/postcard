// Dubrovnik's city walls: thick stone walls with a battered foot and crenellated walk, meeting at the
// great round Minčeta Tower with its smaller round crown, and a few houses inside. Red: the terracotta
// roofs of the houses.
import { group, box, lathe, cyl, loft, ringAt, rect2, chamfer2, gable, plinth, merlons, merlonRing, onFace, arch2, rectUZ, signedVolume } from './_l3.mjs';

export const meta = { name: 'dubrovnik', kind: 'landmark', place: 'Dubrovnik', lng: 18.1086, lat: 42.6420, label: 'Walls of Dubrovnik', px: 90 };

const WH = 18, WT = 6, BATTER = 2.2;   // wall height, thickness, how far the foot spreads
const TX = -26, TY = -20;              // the tower's centre

// A wall from a to b (plan points), WT thick, sloping out at the foot; merlons on the outer edge (right of a->b).
function cityWall(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = uy, ny = -ux;
  const ring = (z, o) => {
    const h = WT / 2 + o, p = (s, t) => [a[0] + ux * s + nx * t, a[1] + uy * s + ny * t, z];
    return [p(0, -WT / 2), p(L, -WT / 2), p(L, h), p(0, h)];
  };
  const m = loft([ring(0, BATTER), ring(6, 0), ring(WH, 0)], 'stone', { capTone: 'cream' });
  const outA = [a[0] + nx * (WT / 2 - 0.4), a[1] + ny * (WT / 2 - 0.4)], outB = [b[0] + nx * (WT / 2 - 0.4), b[1] + ny * (WT / 2 - 0.4)];
  return group(signedVolume(m) < 0 ? m.flip() : m, merlons(outA, outB, WH, { w: 1.6, h: 1.6, gap: 1.4, t: 0.8, tone: 'stone' }));
}

// A house: plastered walls, a red gable roof, a dark window or two on the long side.
const house = (x, y, w, d, h, turn = 0, z0 = GROUND) => group(
  box(w, d, 0, h, 'paper'),
  gable(w, d, h, h + d * 0.36, 'red', { o: 0.5, end: 'paper' }),
  onFace(rectUZ(1.4, 2.2, -w / 4, h - 4.5), '-y', d / 2, 0.1, 'ink2'), onFace(rectUZ(1.4, 2.2, w / 4, h - 4.5), '-y', d / 2, 0.1, 'ink2'),
).turn('z', turn).move(x, y, z0);
const GROUND = 7;   // the town stands on a terrace inside the walls

export default () => {
  const parts = [plinth(chamfer2(100, 78, 8, 2, 0), 1.5)];
  // Walls: the sea front running east from the tower and the land wall running north.
  parts.push(cityWall([TX + 8, TY], [44, TY]));
  parts.push(cityWall([TX, 32], [TX, TY + 8]));
  // Minčeta: a battered round tower, a corbelled crenellated top, and the smaller round crown.
  parts.push(lathe([[15, 0], [13, 9], [13, 29], [14, 30.5], [14, 32]], 'stone', { n: 20, cx: TX, cy: TY }));
  parts.push(merlonRing(14, 32, { count: 14, h: 1.8, frac: 0.55, t: 1.2, cx: TX, cy: TY }));
  parts.push(cyl(7.5, 7.5, 32, 45, 'stone', { n: 16, cx: TX, cy: TY }), cyl(8.3, 8.3, 45, 46.2, 'cream', { n: 16, cx: TX, cy: TY }));
  parts.push(merlonRing(8.3, 46.2, { count: 9, h: 1.7, frac: 0.55, t: 1, cx: TX, cy: TY }));
  for (const a of [200, 250, 300]) parts.push(onFace(arch2(1.3, 2.8), '+x', 7.5, 0.1, 'ink2').turn('z', a).move(TX, TY, 38));
  // Houses inside the walls, roofs packed close and stepping up.
  parts.push(box(70, 54, 0, GROUND, 'stone', { cx: 9, cy: 10, top: 'cream' }));
  parts.push(house(-10, -7, 13, 9, 13), house(7, -8, 11, 9, 15), house(24, -7, 14, 10, 13));
  parts.push(house(-6, 10, 12, 9, 16, 0, GROUND + 3), house(14, 9, 14, 10, 15, 8, GROUND + 3), house(31, 11, 11, 9, 14, 0, GROUND + 3));
  return group(parts);
};
