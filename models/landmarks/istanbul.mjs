// Hagia Sophia, Istanbul: the great shallow dome on its ring of windows, the half domes stepping down east
// and west, the heavy square mass with its buttresses, and a slender minaret with a pointed cap at each
// corner. Walls in the building's ochre plaster (sand), lead domes. Red: the red-brick south-east minaret.
import { group, box, block, cyl, lathe, rect2, chamfer2, circle2, dome, plinth, onFace, arch2, halfDome } from './_l3.mjs';

export const meta = { name: 'istanbul', kind: 'landmark', place: 'Istanbul', lng: 28.9802, lat: 41.0086, label: 'Hagia Sophia', px: 100 };

const DR = 17, DZ = 42;   // dome radius and the top of its base

// A minaret: a square foot, a tall shaft, two balconies, a pointed lead cap and a gilt finial.
function minaret(x, y, h, tone, r = 2.0) {
  return group(
    box(r * 2.6, r * 2.6, 0, 9, tone, { cx: x, cy: y, top: 'stone' }),
    cyl(r * 1.05, r, 9, h * 0.62, tone, { n: 12, cx: x, cy: y }),
    cyl(r * 1.7, r * 1.7, h * 0.62, h * 0.62 + 1.2, 'paper', { n: 12, cx: x, cy: y }),
    cyl(r * 0.9, r * 0.9, h * 0.62 + 1.2, h * 0.8, tone, { n: 12, cx: x, cy: y }),
    cyl(r * 1.5, r * 1.5, h * 0.8, h * 0.8 + 1, 'paper', { n: 12, cx: x, cy: y }),
    cyl(r * 0.8, r * 0.8, h * 0.8 + 1, h * 0.84, tone, { n: 12, cx: x, cy: y }),
    cyl(r * 1.0, 0.05, h * 0.84, h, 'slate', { n: 12, cx: x, cy: y }),
    cyl(0.25, 0.1, h, h + 2.5, 'brass', { n: 4, cx: x, cy: y }),
  );
}

export default () => {
  const parts = [plinth(chamfer2(114, 98, 6), 1.4)];
  // The lower mass: aisles and galleries, the narthex on the west, the apse on the east.
  parts.push(box(74, 72, 0, 24, 'sand', { top: 'stone' }));
  parts.push(box(10, 64, 0, 18, 'sand', { cx: -42, top: 'stone' }));
  parts.push(block(Array.from({ length: 7 }, (_, i) => { const t = -Math.PI / 2 + (i / 6) * Math.PI; return [37 + 9 * Math.cos(t), 9 * Math.sin(t)]; }), 0, 22, 'sand', { top: 'stone' }));
  // The central square tower under the dome, with the big arched tympanum walls north and south.
  parts.push(box(36, 40, 24, DZ, 'sand', { top: 'stone' }));
  for (const side of ['+y', '-y']) {
    parts.push(onFace(arch2(30, 16, { z0: 24, k: 8 }), side, 20, 0.15, 'cream'));
    for (const u of [-9, -4.5, 0, 4.5, 9]) parts.push(onFace(arch2(2.4, 5.6, { cu: u, z0: 30 }), side, 20.2, 0.12, 'ink2'));
  }
  // Four great buttress towers on the north and south.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) parts.push(box(9, 10, 0, 37, 'sand', { cx: sx * 13, cy: sy * 35, top: 'stone' }));
  // The dome: a ring of windows at its base and a shallow lead dome.
  parts.push(cyl(DR + 0.6, DR + 0.6, DZ, DZ + 4, 'sand', { n: 24 }));
  for (let i = 0; i < 12; i++) parts.push(onFace(arch2(2.0, 3.0), '+x', (DR + 0.6) * Math.cos(Math.PI / 24), 0.1, 'ink2').turn('z', 7.5 + i * 30).move(0, 0, DZ + 0.4));
  parts.push(dome(DR + 0.6, DZ + 4, 'slate', { n: 24, k: 6, squash: 0.5 }));
  parts.push(cyl(0.8, 0.2, DZ + 4 + DR * 0.5, DZ + 7 + DR * 0.5, 'brass', { n: 4 }));
  // Half domes east and west, and the small half domes of the exedrae at their sides.
  for (const [deg, cx] of [[0, 18], [180, -18]]) {
    parts.push(halfDome(DR, 30, 'slate', { n: 8, k: 4, squash: 0.62, deg, cx }));
    parts.push(block(Array.from({ length: 9 }, (_, i) => { const t = (deg - 90 + (i / 8) * 180) * Math.PI / 180; return [cx + DR * Math.cos(t), DR * Math.sin(t)]; }), 24, 30, 'sand', { top: 'stone' }));
    for (const sy of [-1, 1]) parts.push(halfDome(7, 24, 'slate', { n: 6, k: 3, squash: 0.7, deg: deg + sy * (deg ? -45 : 45), cx: cx + (deg ? -6 : 6), cy: sy * 10 }));
  }
  // Minarets at the four corners; the south-east one is the red-brick one, stouter and shorter.
  parts.push(minaret(-49, 42, 62, 'paper'), minaret(-49, -42, 62, 'paper'), minaret(49, 42, 60, 'paper'), minaret(47, -41, 52, 'red', 2.4));
  return group(parts);
};
