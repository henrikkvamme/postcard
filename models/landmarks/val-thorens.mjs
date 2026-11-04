// Val Thorens: a snow peak above the ski resort, with a timber chalet under a snowy roof and a cable car
// running from a valley station over a lattice pylon to a station on the flank.
// One red accent: the cable car cabin.
import { Mesh, group } from '../lib/mesh.mjs';
import { box, gable, bar, rect2, block } from '../lib/parts.mjs';
import { plinth, rock } from './_l2.mjs';

export const meta = { name: 'val-thorens', kind: 'landmark', place: 'Val Thorens', lng: 6.5800, lat: 45.2980, label: 'Val Thorens', px: 84 };

const P = 1.2;
const C = [-8, 4];                               // the peak's centre
const dir = [0.857, -0.514];                     // down the line of the cable
const along = (t, z) => [C[0] + dir[0] * t, C[1] + dir[1] * t, z];

export default () => {
  const parts = [plinth(58, 48, P, { top: 'paper' }).move(-1, 1, 0)], lines = new Mesh();
  // The peak: rock below, snow above, a few rock ribs running up through the snow.
  const peak = [[18, P], [14, P + 9], [9.5, P + 19], [5, P + 28], [2, P + 34], [0, P + 37]];
  parts.push(rock(peak, (r, i) => r <= 0 ? (i % 4 === 2 ? 'mist' : 'slate') : (r === 1 && i % 3 === 1) || (r === 2 && i % 5 === 1) ? 'slate' : 'paper', { n: 9, seed: 7, jitter: 0.22, cx: C[0], cy: C[1], skew: [-2, 2] }));
  parts.push(rock([[11, P], [7, P + 9], [3, P + 16], [0, P + 21]], (r, i) => r <= 0 ? (i % 3 ? 'slate' : 'mist') : 'paper', { n: 7, seed: 3, jitter: 0.25, cx: -20, cy: 12, skew: [-1, 1] }));
  // The cable car: valley station, pylon and top station, with the cable drawn in ink.
  const lo = along(28, P + 4.6), top = along(19, P + 15.6), hi = along(10.4, P + 17.4);
  parts.push(box(3.6, 3.4, P, P + 4.2, 'stone', { cx: lo[0] + 0.8, cy: lo[1] }), gable(3.6, 3.4, P + 4.2, P + 5.4, 'ink2').move(lo[0] + 0.8, lo[1], 0));
  parts.push(box(3.4, 3.2, P + 13.8, P + 17.8, 'stone', { cx: hi[0] - 0.6, cy: hi[1] }), block(rect2(3.8, 3.6, hi[0] - 0.6, hi[1]), P + 17.8, P + 18.4, 'ink2'));
  const base = 2.4, head = 0.6;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    parts.push(bar([top[0] + sx * base, top[1] + sy * base, P], [top[0] + sx * head, top[1] + sy * head, top[2] - 0.6], 0.32, 'ink'));
  }
  for (const z of [P + 5, P + 10]) { const k = 1 - (z - P) / (top[2] - P), s = head + (base - head) * k;
    for (const [a, b] of [[[-s, -s], [s, s]], [[s, -s], [-s, s]]]) parts.push(bar([top[0] + a[0], top[1] + a[1], z], [top[0] + b[0], top[1] + b[1], z + 4], 0.18, 'ink')); }
  parts.push(box(1.0, 4.4, top[2] - 0.6, top[2], 'ink', { cx: top[0], cy: top[1] }).turn('z', 0));
  for (const s of [-0.9, 0.9]) { const o = [-dir[1] * s, dir[0] * s, 0];
    const a = lo.map((v, k) => v + o[k]), b = top.map((v, k) => v + o[k]), c = hi.map((v, k) => v + o[k]);
    lines.line(a, b).line(b, c); }
  // The cabin, hanging from its hanger halfway up the upper span.
  const m = top.map((v, k) => (v + hi[k]) / 2);
  parts.push(bar(m, [m[0], m[1], m[2] - 1.6], 0.16, 'ink'), box(2.4, 2.0, m[2] - 3.8, m[2] - 1.6, 'red', { cx: m[0], cy: m[1] }));
  parts.push(box(2.5, 1.6, m[2] - 3.0, m[2] - 2.2, 'glass', { cx: m[0], cy: m[1] }));
  // The chalet: a stone base, timber walls, a deep snowy roof, windows and a balcony on the front.
  const X = 6, Y = -14;
  parts.push(box(9, 7.5, P, P + 1.2, 'stone', { cx: X, cy: Y }), box(9, 7.5, P + 1.2, P + 5, 'sand', { cx: X, cy: Y }));
  parts.push(gable(7.5, 9, P + 5, P + 8.4, 'paper', { o: 0.9, end: 'sand' }).turn('z', 90).move(X, Y, 0));
  for (const x of [-2.4, 0, 2.4]) parts.push(box(1.3, 0.1, P + 2.2, P + 3.6, 'glass', { cx: X + x, cy: Y - 3.76 }));
  parts.push(box(9.4, 1.2, P + 3.9, P + 4.2, 'ink2', { cx: X, cy: Y - 4.3 }), box(9.4, 0.12, P + 4.2, P + 4.9, 'ink2', { cx: X, cy: Y - 4.85 }));
  return group(parts, lines);
};
