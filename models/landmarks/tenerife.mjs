// Mount Teide: the broad shield of Tenerife rising to a small steep summit cone with a crater, lava flows
// streaking the flanks and snow on the top. A cable car climbs the summit cone.
// One red accent: the cable car cabin.
import { Mesh, group } from '../lib/mesh.mjs';
import { box, bar } from '../lib/parts.mjs';
import { disc, rock } from './_l2.mjs';

export const meta = { name: 'tenerife', kind: 'landmark', place: 'Tenerife', lng: -16.6425, lat: 28.2724, label: 'Mount Teide', px: 84 };

const P = 1.5;

export default () => {
  const parts = [disc(37, P, { n: 32 })], lines = new Mesh();
  const prof = [[32, P], [24, P + 5], [16.5, P + 11], [11, P + 16.5], [8.4, P + 19], [7, P + 19.6],
    [5.6, P + 20.4], [2.8, P + 29], [1.8, P + 30.6], [0.9, P + 30], [0, P + 29.8]];
  // Lower flanks in sand with dark lava flows; the cone in stone, its top under snow.
  // Each lava flow: the sector it runs down and the rings it covers, so the flows end at different lengths.
  const flows = { 1: [1, 3], 6: [2, 3], 10: [1, 2], 14: [2, 2] };
  const tone = (r, i) => r < 0 ? 'sand' : r <= 3 ? (flows[i] && r >= flows[i][0] && r <= flows[i][1] ? 'slate' : 'sand') : r <= 5 ? 'stone' : r === 6 ? (i % 3 === 2 ? 'stone' : 'paper') : 'paper';
  parts.push(rock(prof, tone, { n: 18, seed: 11, jitter: 0.12 }));
  // The cable car from a station at the foot of the cone to one high on its flank.
  const a = 0.35 * Math.PI * -1, c = Math.cos(a), s = Math.sin(a);
  const lo = [9.4 * c, 9.4 * s, P + 18.4], hi = [4.2 * c, 4.2 * s, P + 25.4];
  parts.push(box(2.4, 2.4, lo[2] - 1.4, lo[2] + 0.8, 'stone', { cx: lo[0] + 0.6 * c, cy: lo[1] + 0.6 * s }));
  parts.push(box(2.0, 2.0, hi[2] - 1.4, hi[2] + 0.7, 'stone', { cx: hi[0] + 0.5 * c, cy: hi[1] + 0.5 * s }));
  const up = [lo[0], lo[1], lo[2] + 0.8], dn = [hi[0], hi[1], hi[2] + 0.7];
  lines.line(up, dn);
  const m = up.map((v, k) => v * 0.45 + dn[k] * 0.55);
  parts.push(bar(m, [m[0], m[1], m[2] - 0.7], 0.1, 'ink'), box(1.3, 1.3, m[2] - 1.9, m[2] - 0.7, 'red', { cx: m[0], cy: m[1] }));
  return group(parts, lines);
};
