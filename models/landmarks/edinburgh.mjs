// Edinburgh Castle on Castle Rock: a steep, broken volcanic crag with the castle along its top. The curved
// Half Moon Battery fronts the east end over the esplanade ramp; behind it the Palace with its tower and the
// long Great Hall stand round Crown Square, the tall barracks block on the south-west; curtain walls follow
// the cliff edge. Red: the flag over the Palace tower.
import { group, box, block, loft, ringAt, rect2, circle2, gable, hip, plinth, onFace, rectUZ, wall, merlons, flag, rnd, signedVolume } from './_l3.mjs';

export const meta = { name: 'edinburgh', kind: 'landmark', place: 'Edinburgh', lng: -3.1999, lat: 55.9486, label: 'Edinburgh Castle', px: 105 };

const TOP = 50;   // the summit plateau

// The crag: the summit outline, and two rings below it pushed outward with some noise, so the cliffs are
// steep and broken. The east end runs down to the esplanade ramp.
const PLATEAU = [[44, -14], [47, 6], [40, 22], [24, 30], [4, 33], [-20, 32], [-44, 30], [-64, 26], [-80, 14], [-85, -4],
  [-76, -20], [-58, -30], [-34, -34], [-8, -33], [16, -30], [34, -24]];
function crag() {
  const r = rnd(11), cx = -18;
  const push = (d, j) => PLATEAU.map(([x, y]) => {
    const dx = x - cx, l = Math.hypot(dx, y), k = d * (0.55 + r() * j);
    return [x + (dx / l) * k * 1.25 + (r() - 0.5) * 4, y + (y / l) * k + (r() - 0.5) * 3];
  });
  const rings = [ringAt(push(18, 0.9), 0), ringAt(push(12, 1.1), 12), ringAt(push(6, 1.3), 28), ringAt(push(3, 1.2), TOP - 7), ringAt(PLATEAU, TOP)];
  const m = loft(rings, 'mist', { capTone: 'stone' });
  return { mesh: signedVolume(m) < 0 ? m.flip() : m, top: PLATEAU };
}

export default () => {
  const parts = [plinth(chamfer(206, 112).map(([x, y]) => [x - 2, y]), 1.4)];
  const { mesh, top } = crag();
  parts.push(mesh);
  // The esplanade: a long ramp from the town up to the gate on the east.
  parts.push(ramp());

  // Curtain walls along the plateau edge, with merlons.
  for (let i = 0; i < top.length; i++) {
    const a = top[i], b = top[(i + 1) % top.length];
    if (a[0] > 30 && b[0] > 30) continue; // the Half Moon Battery holds the east end
    parts.push(wall(inward(a), inward(b), TOP - 0.5, TOP + 4, 2.2, 'stone'));
  }
  // The Half Moon Battery: a tall curved wall over the east end, the gatehouse below it.
  const hm = Array.from({ length: 9 }, (_, i) => { const t = -Math.PI / 2 + (i / 8) * Math.PI; return [34 + 15 * Math.cos(t), 4 + 22 * Math.sin(t)]; });
  parts.push(block(hm, TOP - 14, TOP + 12, 'stone', { top: 'cream' }));
  for (let i = 0; i < 8; i++) parts.push(merlons(hm[i], hm[i + 1], TOP + 12, { w: 1.6, h: 1.4, gap: 1.6, t: 1 }));
  parts.push(box(10, 18, TOP - 14, TOP - 2, 'paper', { cx: 50, cy: 0, top: 'stone' }));
  parts.push(gable(10, 18, TOP - 2, TOP + 3, 'slate').move(50, 0, 0));
  parts.push(onFace(rectUZ(4, 6, 0, TOP - 14), '+x', 55, 0.15, 'ink2'));

  // Crown Square: the Palace with its tower, the Great Hall, the War Memorial.
  parts.push(box(16, 28, TOP, TOP + 21, 'paper', { cx: 14, cy: 8 }), hip(16, 28, TOP + 21, TOP + 27, 'slate', { cx: 14, cy: 8 }));
  parts.push(box(8, 8, TOP, TOP + 34, 'paper', { cx: 18, cy: -8 }), box(9, 9, TOP + 34, TOP + 35.5, 'stone', { cx: 18, cy: -8 }));
  parts.push(merlons([13.5, -12.5], [22.5, -12.5], TOP + 35.5, { w: 1.4, h: 1.2, gap: 1.4, t: 0.8 }), merlons([22.5, -3.5], [13.5, -3.5], TOP + 35.5, { w: 1.4, h: 1.2, gap: 1.4, t: 0.8 }));
  parts.push(flag(18, -8, TOP + 35.5, 9, { w: 5, fh: 3, s: 0.45 }));
  parts.push(box(36, 12, TOP, TOP + 18, 'paper', { cx: -6, cy: -22 }), gable(36, 12, TOP + 18, TOP + 26, 'slate').move(-6, -22, 0));
  parts.push(box(30, 12, TOP, TOP + 17, 'paper', { cx: -8, cy: 22 }), gable(30, 12, TOP + 17, TOP + 24, 'slate').move(-8, 22, 0));
  for (const x of [-18, -10, -2, 6]) parts.push(onFace(rectUZ(2.4, 7, 0, TOP + 6), '-y', 28, 0.12, 'ink2', x));
  // The barracks: a long, tall block on the south-west.
  parts.push(box(16, 44, TOP - 8, TOP + 24, 'paper', { cx: -40, cy: -6, top: 'stone' }));
  for (const z of [TOP + 4, TOP + 14]) for (const y of [-22, -14, -6, 2, 10]) parts.push(onFace(rectUZ(2.4, 4.5, y, z), '+x', 8, 0.12, 'ink2').move(-40, -6, 0));
  // St Margaret's Chapel and the old buildings at the summit's west end.
  parts.push(box(14, 8, TOP, TOP + 7, 'paper', { cx: -64, cy: 6 }), gable(14, 8, TOP + 7, TOP + 11, 'slate').move(-64, 6, 0));
  return group(parts);
};

const inward = ([x, y]) => [x * 0.97, y * 0.95];
const chamfer = (w, d) => { const c = 22; return [[-w / 2 + c, -d / 2], [w / 2 - c, -d / 2], [w / 2, -d / 2 + c], [w / 2, d / 2 - c], [w / 2 - c, d / 2], [-w / 2 + c, d / 2], [-w / 2, d / 2 - c], [-w / 2, -d / 2 + c]]; };
// The ramp up to the gate: a wedge from the ground at the far east to the gatehouse.
function ramp() {
  const z1 = TOP - 14, x0 = 98, x1 = 55, w = 11;
  const ring = (y) => [[x0, y, 0], [x1, y, 0], [x1, y, z1]];
  const m = loft([ring(-w), ring(w)], 'stone');
  return signedVolume(m) < 0 ? m.flip() : m;
}
