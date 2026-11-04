// Basel Minster: red sandstone, the two west towers of slightly different height with octagonal belfries
// and pointed spires, the gabled west front between them, and the long nave and choir under a steep green
// tiled roof. The red sandstone is the accent.
import { group } from '../lib/mesh.mjs';
import { box, cyl, spire, circle2 } from '../lib/parts.mjs';
import { slabY, gableY, plinth, onFront, arch2 } from './_l1.mjs';

export const meta = { name: 'basel', kind: 'landmark', place: 'Basel', lng: 7.5925, lat: 47.5565, label: 'Basel Minster', px: 98 };

const Z0 = 0.6, TW = 7.6, TX = 8.2, YF = -TW / 2;

function tower(x, top) {
  const r = 3.6, ph = Math.PI / 8, parts = [
    box(TW, TW, 0, 37, 'red', { cx: x }),
    box(TW + 0.6, TW + 0.6, 37, 37.8, 'stone', { cx: x }),                 // the gallery
    cyl(r, r, 37.8, 47, 'red', { n: 8, cx: x, phase: ph }),                // octagonal belfry
    cyl(r + 0.3, r + 0.3, 47, 47.6, 'stone', { n: 8, cx: x, phase: ph }),
    spire(circle2(r, 8, x, 0, ph), 47.6, top, 'red', { cx: x }),
  ];
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]])            // corner pinnacles
    parts.push(spire(circle2(0.55, 4, x + sx * (TW / 2 - 0.4), sy * (TW / 2 - 0.4), Math.PI / 4), 37.8, 43, 'red', { cx: x + sx * (TW / 2 - 0.4), cy: sy * (TW / 2 - 0.4) }));
  parts.push(onFront(arch2(1.6, 6.0, { x, z: 26, pointed: true }), YF, 'ink2'));
  for (const dx of [-1.1, 1.1]) parts.push(onFront(arch2(0.9, 4.2, { x: x + dx, z: 40.6, pointed: true }), -r * Math.cos(ph), 'ink2'));
  return group(parts);
}

export default () => {
  const NW = 17, NL = 44, cy = YF + 1 + NL / 2, gx = TX - TW / 2;
  return group(
    plinth(30, 70, { h: Z0, cy: 21 }),
    group(
      tower(-TX, 67), tower(TX, 65),
      box(NW, NL, 0, 22, 'red', { cy }),                                     // nave
      gableY(NW + 0.8, NL, 22, 35, 'green', { cy, end: 'red' }),
      box(13, 12, 0, 20, 'red', { cy: YF + 1 + NL + 6, bevel: 0 }),          // choir
      gableY(13.6, 12, 20, 30, 'green', { cy: YF + 1 + NL + 6, end: 'red' }),
      // The west front between the towers: a gable wall with the portal and the rose window.
      slabY([[-gx, 0], [gx, 0], [gx, 24], [0, 34], [-gx, 24]], YF + 0.4, YF + 1, 'red'),
      onFront(arch2(3.0, 7.0, { pointed: true }), YF + 0.4, 'ink2'),
      onFront(circle2(1.8, 10, 0, 17), YF + 0.4, 'ink2'),
    ).move(0, 0, Z0),
  );
};
