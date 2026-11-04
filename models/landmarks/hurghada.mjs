// Hurghada: a white Red Sea dive boat moored on a short timber jetty off a sand beach, a palm and a
// parasol on the sand, the reef lagoon round them.
// One red accent: the parasol.
import { group } from '../lib/mesh.mjs';
import { box, block, rect2, hull, section, bar, spire, circle2 } from '../lib/parts.mjs';
import { plinth, palm } from './_l2.mjs';

export const meta = { name: 'hurghada', kind: 'landmark', place: 'Hurghada', lng: 33.8116, lat: 27.2579, label: 'Red Sea diving', px: 80 };

const P = 0.8, BEACH = P + 0.7, DECK = P + 1.9;

// The dive boat along x, bow to +x, standing on the water at z = P.
function boat() {
  const sec = (x, w, h, z0) => [x, section(w, h, Math.min(0.5, w / 2 - 0.02), z0)];
  const out = [hull([sec(0, 5, 2.2, P), sec(10, 5, 2.3, P), sec(13.8, 4.4, 2.6, P + 0.2), sec(16.4, 2.6, 2.6, P + 0.8), sec(18, 0.5, 2.3, P + 1.5)], 'paper')];
  for (const s of [-1, 1]) out.push(box(13, 0.06, P, P + 0.7, 'ink', { cx: 6.5, cy: s * 2.51 }));
  const D0 = P + 2.2;
  // Main deck house, upper deck and the sun deck canopy on posts, each with a window band.
  out.push(box(10, 3.8, D0, D0 + 2.2, 'paper', { cx: 6 }), block(rect2(10.4, 4.4, 6, 0), D0 + 2.2, D0 + 2.5, 'paper'));
  out.push(box(7, 3.4, D0 + 2.5, D0 + 4.3, 'paper', { cx: 5.5 }), block(rect2(9, 4.6, 5.2, 0), D0 + 4.3, D0 + 4.55, 'paper'));
  for (const s of [-1, 1]) {
    out.push(box(8.4, 0.06, D0 + 0.8, D0 + 1.7, 'glass', { cx: 6.4, cy: s * 1.92 }), box(5.6, 0.06, D0 + 3.1, D0 + 3.9, 'glass', { cx: 5.8, cy: s * 1.72 }));
    for (const x of [1.2, 9.2]) out.push(bar([x, s * 2.1, D0 + 4.55], [x, s * 2.1, D0 + 6.2], 0.14, 'ink'));
  }
  out.push(box(9, 4.8, D0 + 6.2, D0 + 6.45, 'paper', { cx: 5.2 }));
  out.push(bar([11.5, 0, D0], [11.5, 0, D0 + 7.6], 0.18, 'ink'));
  out.push(box(1.4, 4.4, P + 0.6, P + 0.85, 'ink2', { cx: -0.7 }));
  return group(out);
}

export default () => {
  const parts = [plinth(40, 22, P, { top: 'mist' })];
  // The beach at the west end.
  parts.push(block(rect2(11, 22, -14.5, 0), P, BEACH, 'sand', { bevel: 0.3 }));
  // The jetty: a plank deck on posts from the beach out to the boat.
  parts.push(box(17, 3, DECK - 0.3, DECK, 'sand', { cx: -1.5 }));
  for (let x = -7; x <= 6; x += 3.25) for (const s of [-1, 1]) parts.push(box(0.4, 0.4, P, DECK - 0.3, 'ink2', { cx: x, cy: s * 1.3 }));
  parts.push(boat().move(-1.5, 4.2, 0));
  // On the sand: a palm and the red parasol.
  parts.push(palm(-15, -6, 8.5, { z0: BEACH, lean: [0.14, -0.06] }));
  parts.push(bar([-14, 5.5, BEACH], [-14, 5.5, BEACH + 3.2], 0.14, 'ink2'), spire(circle2(2.4, 8, -14, 5.5), BEACH + 2.6, BEACH + 3.6, 'red', { cx: -14, cy: 5.5 }));
  return group(parts);
};
