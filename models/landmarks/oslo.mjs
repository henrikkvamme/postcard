// Oslo Opera House: white roof planes that slope down into the fjord, the flat roof top, the tall glass
// wall of the foyer facing the water under the roof edge, and the stage tower. The red is a small flag on
// the roof.
import { group } from '../lib/mesh.mjs';
import { box } from '../lib/parts.mjs';
import { plinth, wedge, slabY, flag } from './_l1.mjs';

export const meta = { name: 'oslo', kind: 'landmark', place: 'Oslo', lng: 10.7531, lat: 59.9075, label: 'Oslo Opera House', px: 108 };

const H = 15;                     // roof top

export default () => group(
  plinth(148, 104, { h: 0.6, tone: 'mist', cx: 2, cy: -4, bevel: 0.2 }),             // the fjord
  box(148, 34, 0.6, 1.4, 'stone', { cx: 2, cy: 31, bevel: 0.3 }),                     // the land behind
  // The great ramp out of the water at the front, and a lower one down the east side.
  wedge([[-48, -46], [12, -46], [40, 0], [-56, 0]], (x, y) => H * (y + 46) / 46, 'paper'),
  wedge([[46, -4], [66, -4], [66, 36], [46, 36]], (x) => H * (66 - x) / 20, 'paper'),
  box(102, 36, 0, H, 'paper', { cx: -5, cy: 18 }),                                       // the roof top
  // The foyer: a tall glass wall at the west end, leaning out under the roof's thin overhang.
  slabY([[-56, 0], [-57, 0], [-63, H - 0.6], [-56, H - 0.6]], -2, 34, 'glass'),
  box(9, 40, H - 0.6, H + 0.3, 'paper', { cx: -60, cy: 16 }),
  // The stage tower and the lower workshop block behind it.
  box(26, 22, H, H + 21, 'stone', { cx: 10, cy: 20, bevel: 0.5 }),
  box(30, 12, H, H + 6, 'mist', { cx: -26, cy: 28, bevel: 0.4 }),
  flag(-30, 8, H, H + 9, { w: 3.6, h: 2.4, s: 0.35 }),
);
