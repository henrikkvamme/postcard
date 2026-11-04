// Grossmünster, Zurich: the twin square towers with their belfries, octagonal top stages and dark domed
// helmets, the west gable between them, and the long nave with its steep roof behind. The red is the west door.
import { group } from '../lib/mesh.mjs';
import { box, cyl, lathe } from '../lib/parts.mjs';
import { slabY, gableY, plinth, onFront, arch2 } from './_l1.mjs';

export const meta = { name: 'zurich', kind: 'landmark', place: 'Zurich', lng: 8.5440, lat: 47.3700, label: 'Grossmünster', px: 96 };

const Z0 = 0.6, TW = 9, TX = 7.2, YF = -TW / 2;

function tower(x) {
  const parts = [
    box(TW, TW, 0, 26, 'sand', { cx: x }),
    box(TW + 0.6, TW + 0.6, 26, 26.8, 'paper', { cx: x }),                   // string course
    box(TW - 0.4, TW - 0.4, 26.8, 37.5, 'sand', { cx: x }),                  // belfry
    box(TW + 0.2, TW + 0.2, 37.5, 38.3, 'paper', { cx: x }),
    cyl(4.1, 4.1, 38.3, 45.5, 'sand', { n: 8, cx: x, phase: Math.PI / 8 }),   // octagonal stage
    cyl(4.5, 4.5, 45.5, 46.2, 'paper', { n: 8, cx: x, phase: Math.PI / 8 }),
    // The helmet: a tall dome that swells, then draws in to the finial.
    lathe([[4.3, 46.2], [4.5, 47.6], [4.1, 50.2], [3.1, 52.8], [1.7, 55], [0.5, 56.6], [0.32, 58], [0.32, 61], [0, 61.6]], 'ink2', { n: 8, cx: x, phase: Math.PI / 8 }),
  ];
  // Belfry openings: two round-arched windows on the front and on the outer side.
  for (const dx of [-1.9, 1.9]) parts.push(onFront(arch2(1.9, 6.2, { x: x + dx, z: 29.4 }), YF + 0.2, 'ink2'));
  for (const dx of [-1.2, 1.2]) parts.push(onFront(arch2(1.0, 3.2, { x: x + dx, z: 40.4 }), -4.1 * Math.cos(Math.PI / 8), 'ink2'));
  parts.push(onFront(arch2(1.4, 3.6, { x, z: 15 }), YF, 'ink2'));
  return group(parts);
}

export default () => {
  const NW = 19, NL = 36, cy = YF + 1 + NL / 2;
  return group(
    plinth(30, 58, { h: Z0, cy: 15 }),
    group(
      tower(-TX), tower(TX),
      box(NW, NL, 0, 19, 'sand', { cy }),                                    // nave
      gableY(NW + 0.6, NL, 19, 29.5, 'slate', { cy, end: 'sand' }),
      box(13, 10, 0, 16.5, 'sand', { cy: YF + NL + 5 }),                     // choir
      gableY(13.4, 10, 16.5, 23.5, 'slate', { cy: YF + NL + 5, end: 'sand' }),
      // The west front between the towers: a gable wall with the portal and a round window above.
      slabY([[-TX + TW / 2, 0], [TX - TW / 2, 0], [TX - TW / 2, 26], [0, 29.5], [-TX + TW / 2, 26]], YF + 0.6, YF + 1, 'sand'),
      onFront(arch2(2.4, 5.2, {}), YF + 0.6, 'red'),
      onFront(arch2(1.8, 4.0, { z: 14 }), YF + 0.6, 'ink2'),
    ).move(0, 0, Z0),
  );
};
