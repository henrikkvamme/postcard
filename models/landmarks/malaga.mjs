// The Alcazaba, Málaga: a Moorish fortress of two walled rings stepping up a pine-covered hill, square
// towers on the corners, and a tall keep with a small lookout on top. The red accent is its flag.
import { group } from '../lib/mesh.mjs';
import { box, bar } from '../lib/parts.mjs';
import { plinth, hill, merlons } from './_l4.mjs';

export const meta = { name: 'malaga', kind: 'landmark', place: 'Málaga', lng: -4.4157, lat: 36.7212, label: 'Alcazaba of Málaga', px: 92 };

const B = 0.8, T1 = 13, T2 = 22;                       // terrace heights of the outer and inner rings
const FOOT = [[34, -24], [38, 6], [26, 30], [-6, 34], [-34, 22], [-38, -8], [-22, -30], [8, -34]];
const OUTER = [[22, -15], [25, 4], [16, 20], [-4, 22], [-22, 14], [-25, -5], [-14, -19], [5, -22]];
const INNER = [[15, -6], [15, 8], [6, 15], [-6, 12], [-9, 0], [-2, -9]];

// A curtain wall along a ring: one box per edge, a square tower on each corner, merlons on top.
function ring(plan, z0, h, th, tw) {
  const out = [], n = plan.length;
  for (let i = 0; i < n; i++) {
    const a = plan[i], b = plan[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    out.push(box(L, th, z0 - 3, z0 + h, 'sand').turn('z', yaw).move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0));
    out.push(box(tw, tw, z0 - 3, z0 + h + 2.5, 'sand', { cx: a[0], cy: a[1], bevel: 0.15 }));
    out.push(merlons(tower(tw - 0.6, a), z0 + h + 2.5, { s: 0.9, h: 0.9, w: 0.5, tone: 'sand' }));
  }
  out.push(merlons(plan, z0 + h, { s: 1, h: 1, w: th * 0.6, tone: 'sand' }));
  return group(out);
}
const tower = (w, [cx, cy]) => [[cx - w / 2, cy - w / 2], [cx + w / 2, cy - w / 2], [cx + w / 2, cy + w / 2], [cx - w / 2, cy + w / 2]];

export default () => {
  const KX = 6, KY = 15;                                 // the keep, on the inner ring's north corner
  const parts = [
    plinth(84, 76, { h: B }),
    hill(FOOT, [[1, B], [0.9, 5], [0.78, 10], [0.7, T1]], 'green'),
    hill(INNER.map(([x, y]) => [x * 1.35 + 1, y * 1.35 + 1]), [[1, T1], [0.9, T2 - 2], [0.85, T2]], 'green'),
    ring(OUTER, T1, 4.5, 1.4, 4),
    ring(INNER, T2, 4.5, 1.4, 4),
    // The keep and its lookout.
    box(7, 7, T2 - 3, T2 + 15, 'sand', { cx: KX, cy: KY, bevel: 0.2 }),
    merlons(tower(6.4, [KX, KY]), T2 + 15, { s: 1, h: 1.1, w: 0.6, tone: 'sand' }),
    box(3.2, 3.2, T2 + 15, T2 + 19, 'sand', { cx: KX, cy: KY, bevel: 0.15 }),
    box(3.8, 3.8, T2 + 19, T2 + 19.6, 'stone', { cx: KX, cy: KY }),
    bar([KX, KY, T2 + 19.6], [KX, KY, T2 + 25], 0.2, 'ink'),
    box(0.12, 2.6, T2 + 23.2, T2 + 24.9, 'red', { cx: KX, cy: KY + 1.3 }),
  ];
  return group(parts);
};
