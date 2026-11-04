// Timanfaya, Lanzarote: a light volcanic landscape of low cinder cones in sand and ochre, each with its
// crater. The largest crater glows with the red scoria of the Fire Mountains; the smaller ones are dark.
// The cones rise from a plain of pale sand-coloured ash, and a whitewashed cube house with its chimney and
// green door gives the scale. One red accent: the big crater.
import { group } from '../lib/mesh.mjs';
import { box, block, rect2 } from '../lib/parts.mjs';
import { disc, rock } from './_l2.mjs';

export const meta = { name: 'lanzarote', kind: 'landmark', place: 'Lanzarote', lng: -13.7500, lat: 29.0167, label: 'Timanfaya', px: 80 };

const P = 1.2;

// A cinder cone: base radius r, rim height h, crater radius c and depth d. Profile from the foot up over
// the rim and down to the crater floor. tones: [lower slope, upper slope, rim, crater].
function cone(cx, cy, r, h, c, d, tones, seed) {
  const prof = [[r, P], [r * 0.68, P + h * 0.55], [c * 1.25, P + h * 0.94], [c, P + h], [c * 0.62, P + h - d * 0.7], [0, P + h - d]];
  const band = (k) => (k < 0 ? 'stone' : tones[Math.min(k, 3)]);
  return rock(prof, (k) => band(k), { n: 14, seed, jitter: 0.12, cx, cy });
}

// A flat-roofed white cube with a low parapet round the roof.
const cube = (w, d, h, cx, cy) => group(box(w, d, P, P + h, 'paper', { cx, cy }),
  block(rect2(w + 0.2, d + 0.2, cx, cy), P + h, P + h + 0.4, 'paper', { bevel: 0.12 }));

export default () => {
  const parts = [disc(26, P, { ry: 21, n: 28, top: 'sand' })];
  parts.push(cone(-8, 3, 13, 7.5, 5.2, 3, ['sand', 'brass', 'stone', 'red'], 5));      // the Fire Mountain
  parts.push(cone(11, 9, 8.5, 4.2, 3.4, 2, ['sand', 'sand', 'stone', 'ink2'], 11));
  parts.push(cone(-5, -12, 6.5, 3.0, 2.6, 1.5, ['stone', 'sand', 'stone', 'ink2'], 23));
  parts.push(cone(19, -3, 4.5, 2.0, 1.7, 1.0, ['stone', 'sand', 'stone', 'slate'], 31));
  // The house: a main cube and a lower one beside it, a chimney, a green door and small windows.
  const X = 13, Y = -12;
  parts.push(cube(5.6, 4.4, 3, X, Y), cube(3.4, 3.4, 2.2, X + 4.4, Y + 0.5));
  parts.push(box(1, 1, P + 3.4, P + 4.9, 'paper', { cx: X - 1.8, cy: Y + 1.1 }), block(rect2(1.4, 1.4, X - 1.8, Y + 1.1), P + 4.9, P + 5.2, 'paper'));
  parts.push(box(1.1, 0.12, P, P + 2.1, 'green', { cx: X + 0.8, cy: Y - 2.2 }));
  parts.push(box(0.9, 0.12, P + 1.2, P + 2.1, 'glass', { cx: X - 1.6, cy: Y - 2.2 }));
  return group(parts);
};
