// The Old Town Bridge Tower with the first arches of Charles Bridge: a Gothic gate tower over the bridge
// end, its steep dark roof between four corner pinnacles, and stone arches on cutwater piers with dark
// Baroque statues on the parapets. One red accent: the pennant on the roof spike.
import { group, faceNormal } from '../lib/mesh.mjs';
import { box, block, rect2, spire, lathe, bar, loft, ringAt, chamfer2 } from '../lib/parts.mjs';
import { plinth, slab, wallPts, bays, archPts, facePlate } from './_l2.mjs';

export const meta = { name: 'prague', kind: 'landmark', place: 'Prague', lng: 14.4135, lat: 50.0863, label: 'Charles Bridge', px: 96 };

const P = 1, DECK = P + 10, BY = 5;                  // plinth, deck height, bridge half width
const X0 = -40, X1 = 20, TX0 = 21, TX1 = 32, TY = 7; // bridge ends, tower x range and half width
const TOP = DECK + 26;

// A statue on its pedestal, as a dark silhouette.
const statue = (x, y) => group(box(1.6, 1.2, DECK + 1.2, DECK + 2.6, 'stone', { cx: x, cy: y }),
  lathe([[0.55, DECK + 2.6], [0.7, DECK + 4.0], [0.45, DECK + 5.2], [0.5, DECK + 5.6], [0.01, DECK + 6.4]], 'ink2', { n: 6, cx: x, cy: y }));

export default () => {
  const parts = [plinth(TX1 - X0 + 6, 2 * TY + 8, P, { top: 'mist' }).move((X0 + TX1) / 2 - 1, 0, 0)];
  // The bridge: three arches through one wall, the arch reveals in shade.
  const open = bays(X0, X1, 3, 6.5, P + 4.2, { ends: 2.5, rise: 5.2, k: 6 });
  const wall = slab(wallPts(X0, X1, P, DECK, open), -BY, BY, 'stone');
  wall.faces = wall.faces.map((f) => { const n = faceNormal(f.pts), cx = f.pts.reduce((a, p) => a + p[0], 0) / f.pts.length;
    return Math.abs(n[1]) < 0.5 && open.some((o) => cx > o.x0 - 0.01 && cx < o.x1 + 0.01) ? { ...f, tone: 'slate' } : f; });
  parts.push(wall, block(rect2(X1 - X0, 2 * BY + 0.6, (X0 + X1) / 2, 0), DECK, DECK + 0.4, 'stone'));
  for (const sy of [-1, 1]) parts.push(box(X1 - X0, 0.7, DECK + 0.4, DECK + 1.4, 'stone', { cx: (X0 + X1) / 2, cy: sy * (BY - 0.05) }));
  // Cutwaters on both sides of each pier, and a statue above each.
  for (let i = 0; i + 1 < open.length; i++) {
    const xc = (open[i].x1 + open[i + 1].x0) / 2, h = 3.2;
    for (const sy of [-1, 1]) {
      const tri = sy < 0 ? [[xc - h, -BY], [xc, -BY - 3.8], [xc + h, -BY]] : [[xc + h, BY], [xc, BY + 3.8], [xc - h, BY]];
      parts.push(block(tri, P, P + 6, 'stone'), spire(tri, P + 6, P + 8.2, 'stone', { cx: xc, cy: sy * (BY + 0.4) }));
      parts.push(statue(xc, sy * (BY - 0.05)));
    }
  }
  // The bank under the tower, and the tower: a gate passage through it along the bridge.
  parts.push(block(rect2(TX1 - X1 + 4, 2 * TY + 4, (X1 + TX1) / 2 + 2, 0), P, DECK, 'stone', { top: 'cream' }));
  parts.push(box(TX1 - TX0, 2 * TY, DECK, TOP, 'stone', { cx: (TX0 + TX1) / 2 }));
  for (const z of [DECK + 9, DECK + 17]) parts.push(block(rect2(TX1 - TX0 + 0.6, 2 * TY + 0.6, (TX0 + TX1) / 2, 0), z, z + 0.5, 'stone'));
  const gate = archPts(-3, 3, DECK, DECK + 5.2, { rise: 3, k: 5 });
  parts.push(facePlate(gate, TX0, TY, 0, -1, 'ink2'), facePlate(gate, TX1, -TY, 0, 1, 'ink2'));
  // Tall Gothic windows: a pair on the long faces and the end face, in the upper storeys.
  const lancet = (u) => archPts(u - 0.9, u + 0.9, DECK + 18.5, DECK + 22.5, { rise: 1.6, k: 3 });
  for (const u of [4.4, 9.6]) parts.push(facePlate(lancet(u), TX0 - 1.5, -TY, 1, 0, 'ink2'), facePlate(lancet(u), TX1 + 1.5, TY, -1, 0, 'ink2'));
  for (const u of [4.8, 9.2]) parts.push(facePlate(lancet(u), TX1, -TY, 0, 1, 'ink2'));
  // Roof: a gallery parapet, the steep hipped roof, four corner pinnacles, and the spike with its pennant.
  const cx = (TX0 + TX1) / 2;
  parts.push(block(rect2(TX1 - TX0 + 1.2, 2 * TY + 1.2, cx, 0), TOP, TOP + 1.4, 'stone'));
  parts.push(loft([ringAt(rect2(TX1 - TX0 - 0.8, 2 * TY - 0.8, cx, 0), TOP + 1.4), ringAt(rect2(1.2, 4.4, cx, 0), TOP + 19)], 'ink2'));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const px = cx + sx * (TX1 - TX0) / 2, py = sy * TY, oct = chamfer2(2.4, 2.4, 0.7, px, py);
    parts.push(block(oct, TOP - 2, TOP + 5, 'stone'), spire(oct, TOP + 5, TOP + 11.5, 'ink2', { cx: px, cy: py }));
  }
  parts.push(bar([cx, 0, TOP + 19], [cx, 0, TOP + 24], 0.3, 'ink'), box(0.12, 3.2, TOP + 22.2, TOP + 23.8, 'red', { cx, cy: 1.75 }));
  return group(parts);
};
