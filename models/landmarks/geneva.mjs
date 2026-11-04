// Jet d'Eau, Geneva: the tall thin plume of water, leaning a little with the wind and tapering to its top,
// rising from a spray ring off the end of a short stone jetty with its small lighthouse. The red is the
// row of flags along the jetty.
import { group } from '../lib/mesh.mjs';
import { box, cyl, loft, ringAt, circle2 } from '../lib/parts.mjs';
import { plinth, flag } from './_l1.mjs';

export const meta = { name: 'geneva', kind: 'landmark', place: 'Geneva', lng: 6.1557, lat: 46.2074, label: "Jet d'Eau", px: 104 };

const W = 0.5; // water surface
// [height, radius, lean toward +x]
const PLUME = [[W, 5.4, 0], [3, 3.4, 0], [12, 3.2, 0], [40, 3.6, 0.6], [75, 4.2, 2.0], [105, 4.4, 4.0], [122, 3.8, 5.8], [133, 2.6, 7.0], [139, 1.2, 7.8], [141.5, 0.05, 8.2]];
// The spray the wind carries off the top and lets fall on the lee side: [height, radius, drift].
const VEIL = [[136, 0.05, 8.6], [134, 2.0, 10.2], [128, 2.8, 13.0], [118, 2.9, 15.6], [106, 2.4, 17.4], [96, 1.4, 18.4], [90, 0.05, 18.8]];

export default () => {
  const JX = 14;
  const plume = loft(PLUME.map(([z, r, dx]) => ringAt(circle2(r, 10, JX + dx, -1), z)), 'paper');
  const veil = loft(VEIL.map(([z, r, dx]) => ringAt(circle2(r, 10, JX + dx, -1), z)), 'paper').flip();
  return group(
    plinth(70, 24, { h: W, tone: 'mist', cx: 1, bevel: 0.2 }),          // the lake
    box(40, 4, W, 1.6, 'stone', { cx: -13, cy: 2.5, bevel: 0.3 }),         // the jetty
    cyl(1.3, 1.1, 1.6, 6.5, 'paper', { n: 8, cx: 5.5, cy: 2.5 }),          // the lighthouse
    cyl(1.4, 1.4, 6.5, 7.3, 'green', { n: 8, cx: 5.5, cy: 2.5 }),
    cyl(0.9, 0.2, 7.3, 9.0, 'green', { n: 8, cx: 5.5, cy: 2.5 }),
    ...[-26, -16, -6].map((x) => flag(x, 1.2, 1.6, 8, { w: 2.2, h: 1.6, s: 0.22 })),
    cyl(7.0, 3.8, W - 0.1, 3.0, 'paper', { n: 10, cx: JX, cy: -1 }),        // the spray ring at the foot
    plume, veil,
  );
};
