// Jet d'Eau, Geneva: a thin column of water that widens as it rises and breaks into spray at its top. The
// wind bends the top a little and carries the spray off to the lee side, where it falls as a broken curtain.
// The jet rises from a white splash off the end of a short stone jetty with its small lighthouse, in the
// lake. The red is the row of flags along the jetty.
import { group } from '../lib/mesh.mjs';
import { box, cyl, loft, ringAt, circle2 } from '../lib/parts.mjs';
import { plinth, flag } from './_l1.mjs';

export const meta = { name: 'geneva', kind: 'landmark', place: 'Geneva', lng: 6.1557, lat: 46.2074, label: "Jet d'Eau", px: 104 };

const W = 0.5, JX = 16, JY = -1;   // water surface, foot of the jet
// An upright body of elliptic rings [z, rx, ry, drift toward +x], bottom to top.
const body = (rings, tone, n = 10) => loft(rings.map(([z, rx, ry, dx]) =>
  ringAt(circle2(1, n).map(([x, y]) => [JX + dx + x * rx, JY + y * ry]), z)), tone);

// The column: thin at the foot, widening as it rises, and flaring into a broad crown of spray at the top,
// leaning a little with the wind (+x).
const COLUMN = [[W, 2.0, 2.0, 0], [8, 1.3, 1.3, 0], [40, 1.7, 1.7, 0.4], [75, 2.4, 2.4, 1.2], [100, 3.4, 3.6, 2.4],
  [116, 5.0, 5.6, 3.8], [128, 7.0, 7.8, 5.4], [135, 7.6, 8.4, 6.6], [139.5, 5.6, 6.2, 7.4], [141.5, 2.0, 2.2, 7.8]];
// The broken top: puffs of spray round the crown. [z0, z1, r, dx, dy]
const PUFFS = [[130, 139, 3.0, 13.4, 3.6], [131, 140, 2.6, 4.0, -6.6], [126, 134, 2.4, 14.6, -3.4], [133, 141, 2.4, 1.4, 4.6]];
// The spray curtain the wind carries off the crown and lets fall on the lee side, in three broken pieces:
// each is full at its top and thins out as it falls.
const CURTAIN = [
  [[110, 0.8, 1.2, 15.4], [123, 3.8, 4.8, 12.8], [133, 4.4, 5.4, 10.8], [137, 3.2, 4.2, 9.8]],
  [[86, 0.6, 1.0, 18.6], [99, 3.0, 4.0, 17.2], [107, 3.4, 4.4, 16.4], [109.5, 2.4, 3.2, 16.0]],
  [[64, 0.4, 0.8, 20.2], [75, 2.2, 3.0, 19.6], [82, 2.4, 3.2, 19.2], [84.5, 1.6, 2.2, 19.0]],
];

export default () => {
  const puff = ([z0, z1, r, dx, dy]) => cyl(r, r * 0.7, z0, z1, 'paper', { n: 7, cx: JX + dx, cy: JY + dy, phase: dx });
  return group(
    plinth(84, 32, { h: W, tone: 'mist', cx: 2, bevel: 0.2 }),           // the lake
    box(6, 32, W, 1.8, 'stone', { cx: -37, bevel: 0.3 }),                 // the shore
    box(36, 4, W, 1.6, 'stone', { cx: -16, cy: 3, bevel: 0.3 }),          // the jetty
    cyl(1.3, 1.1, 1.6, 6.5, 'paper', { n: 8, cx: 3.5, cy: 3 }),           // the lighthouse
    cyl(1.4, 1.4, 6.5, 7.3, 'green', { n: 8, cx: 3.5, cy: 3 }),
    cyl(0.9, 0.2, 7.3, 9.0, 'green', { n: 8, cx: 3.5, cy: 3 }),
    ...[-28, -19, -10].map((x) => flag(x, 1.6, 1.6, 8, { w: 2.2, h: 1.6, s: 0.22 })),
    cyl(7.5, 3.2, W - 0.1, 3.4, 'paper', { n: 10, cx: JX, cy: JY }),       // the splash at the foot
    body(COLUMN, 'paper'), ...PUFFS.map(puff),
    ...CURTAIN.map((c) => body(c, 'paper', 9)),
  );
};
