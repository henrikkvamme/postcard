// St Mark's Campanile, Venice: a tall square brick shaft striped by pale pilasters, the open belfry with
// its arches, the attic, the green pyramid spire with four corner pinnacles and the gilt angel. One gondola
// lies at a small quay beside it. Red: the brick panels between the pilasters.
import { group, box, block, spire, cyl, rect2, hull, plinth, onFour, arch2 } from './_l3.mjs';

export const meta = { name: 'venice', kind: 'landmark', place: 'Venice', lng: 12.3390, lat: 45.4340, label: "St Mark's Campanile", px: 110 };

const W = 12, SHAFT = 50;

// The gondola: a long, thin black hull whose ends sweep up, the prow higher, with the steel ferro.
function gondola(x, y, z) {
  const secs = [], L = 15, k = 10;
  for (let i = 0; i <= k; i++) {
    const t = i / k, u = 2 * t - 1;                         // -1 stern .. +1 prow
    const lift = (u > 0 ? 2.0 : 1.2) * Math.pow(Math.abs(u), 3); // ends sweep up
    const hw = 0.75 * Math.max(0.08, 1 - u * u) + 0.03, d = 0.55 * Math.max(0.25, 1 - u * u);
    const z0 = z + lift, zt = z0 + d + 0.15;
    secs.push([x + (u * L) / 2, [[-hw * 0.6, z0], [hw * 0.6, z0], [hw, zt], [-hw, zt]].map(([yy, zz]) => [y + yy, zz])]);
  }
  return group(
    hull(secs, 'ink'),
    box(0.15, 0.5, z + 2.0, z + 2.9, 'mist', { cx: x + L / 2 + 0.05, cy: y }), // ferro
  );
}

export default () => {
  const parts = [];
  // Ground: the stone quay, and the lagoon water a step lower on one side with the gondola.
  parts.push(plinth(rect2(26, 22, 0, 2), 1.2));
  parts.push(block(rect2(26, 9, 0, -12.5), -1.2, -0.7, 'mist', { top: 'mist' }));
  parts.push(gondola(0, -12.5, -0.7));
  parts.push(box(1.2, 1.2, -0.7, 1.6, 'stone', { cx: 7.5, cy: -9.6 }), box(1.2, 1.2, -0.7, 1.6, 'stone', { cx: -7.5, cy: -9.6 })); // mooring posts

  // Shaft: red brick core, pale corner and middle pilasters standing proud.
  parts.push(box(W - 0.6, W - 0.6, 0, SHAFT, 'red'));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) parts.push(box(1.6, 1.6, 0, SHAFT, 'cream', { cx: sx * (W / 2 - 0.8), cy: sy * (W / 2 - 0.8) }));
  for (const s of [-1, 1]) {
    parts.push(box(1.4, 0.4, 0, SHAFT, 'cream', { cy: s * (W / 2 - 0.2) }));
    parts.push(box(0.4, 1.4, 0, SHAFT, 'cream', { cx: s * (W / 2 - 0.2) }));
  }
  parts.push(box(W - 1, W - 1, 0, 2.5, 'cream')); // stone foot
  parts.push(box(W, W, 0, 2.5, 'cream'));
  // Cornice, belfry with four arches a side, balustrade.
  parts.push(box(W + 1.2, W + 1.2, SHAFT, SHAFT + 1.2, 'cream', { bevel: 0.3, top: 'paper' }));
  parts.push(box(W, W, SHAFT + 1.2, SHAFT + 10, 'paper'));
  const bay = W / 4;
  for (let i = 0; i < 4; i++) {
    const cu = -W / 2 + bay * (i + 0.5);
    parts.push(onFour(arch2(bay * 0.62, 6.6, { cu, z0: SHAFT + 2.2 }), W, W, 0.12, 'ink2'));
  }
  parts.push(box(W + 1.2, W + 1.2, SHAFT + 10, SHAFT + 11.2, 'cream', { bevel: 0.3, top: 'paper' }));
  // Attic, cornice.
  parts.push(box(W - 0.6, W - 0.6, SHAFT + 11.2, SHAFT + 22, 'paper'));
  parts.push(box(W + 0.6, W + 0.6, SHAFT + 22, SHAFT + 23, 'cream', { bevel: 0.25, top: 'paper' }));
  // Spire: the green pyramid, four pinnacles, the angel.
  const top = SHAFT + 23;
  parts.push(spire(rect2(W - 2, W - 2), top, top + 23, 'green'));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const cx = sx * (W / 2 - 0.5), cy = sy * (W / 2 - 0.5);
    parts.push(box(1.4, 1.4, top, top + 1.2, 'paper', { cx, cy }), spire(rect2(1.2, 1.2, cx, cy), top + 1.2, top + 4.5, 'green', { cx, cy }));
  }
  parts.push(cyl(0.45, 0.3, top + 23 - 1, top + 25.5, 'brass', { n: 6 }), box(0.25, 2.2, top + 24.2, top + 24.9, 'brass'));
  return group(parts);
};
