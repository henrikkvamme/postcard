// St Mary's Basilica, Kraków: a Gothic brick church whose west front has two unequal towers. The tall north
// tower ends in a spire ringed by eight turrets with a gilded crown; the shorter south tower wears a
// Renaissance helmet of stacked cupolas. A long steep-roofed nave and a narrower chancel stand behind.
// The red accent is the west door.
import { group } from '../lib/mesh.mjs';
import { box, cyl, dome, spire, gable, block, lathe, bar } from '../lib/parts.mjs';
import { plinth, arch2, onFace, ball } from './_l4.mjs';

export const meta = { name: 'krakow', kind: 'landmark', place: 'Kraków', lng: 19.9394, lat: 50.0616, label: "St Mary's Basilica", px: 104 };

const B = 0.8, TW = 10, TX = 30, TY = 8.5;      // towers: side, centre x, centre |y|
const APSE = [[-59, -7.5], [-59, 7.5], [-63.5, 4.4], [-63.5, -4.4]];   // counter-clockwise from above
const oct = (r, cx = 0, cy = 0) => Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) * Math.PI / 4; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

function tower(cy, top) {
  const h = TW / 2, out = [box(TW, TW, B, top, 'cream', { cx: TX, cy, bevel: 0.15 })];
  // Tall lancet windows in the upper storeys.
  for (const side of ['+x', '-x', '+y', '-y'])
    for (const [z0, z1] of [[top - 13, top - 4], [top - 25, top - 17]])
      out.push(onFace(arch2(2.2, z0, z1, { pointed: true, k: 6 }), side, h, 0.12, 'ink2').move(TX, cy, 0));
  out.push(box(TW + 0.5, TW + 0.5, top - 0.8, top, 'stone', { cx: TX, cy }));      // cornice
  return group(out);
}

export default () => {
  const N = 55, S = 52;                                  // shaft tops: north and south towers
  const parts = [
    plinth(106, 36, { h: B }).move(-15, 0, 0),
    tower(TY, N), tower(-TY, S),
    // Nave: long and tall, a steep slate roof.
    box(62, 22, B, 26, 'cream', { cx: 2, bevel: 0.15 }),
    gable(62, 22, 26, 40, 'slate', { o: 0.6, end: 'cream' }).move(2, 0, 0),
    // The west gable between the towers, with its great window and the door.
    onFace(arch2(4.2, 12, 22, { pointed: true, k: 8 }), '+x', 33, 0.12, 'ink2'),
    onFace(arch2(3.0, B, 5.5, { pointed: true, k: 6 }), '+x', 33, 0.2, 'red'),
    // Chancel: narrower and lower, with a three-sided apse.
    box(30, 15, B, 23, 'cream', { cx: -44, bevel: 0.15 }),
    gable(30, 15, 23, 33, 'slate', { o: 0.5, end: 'cream' }).move(-44, 0, 0),
    block(APSE, B, 23, 'cream'),
    spire(APSE, 23, 33, 'slate', { cx: -59, cy: 0 }),
  ];
  // Nave and chancel windows, both sides.
  for (const s of ['+y', '-y']) {
    for (let x = -24; x <= 18; x += 7) parts.push(onFace(arch2(2.4, 7, 19, { pointed: true, k: 6, cu: x }), s, 11, 0.12, 'ink2'));
    for (let x = -54; x <= -34; x += 6.5) parts.push(onFace(arch2(2.0, 7, 17, { pointed: true, k: 6, cu: x }), s, 7.5, 0.12, 'ink2'));
  }

  // North tower: an octagonal drum, eight turrets around a tall spire, a gilded crown, a ball.
  parts.push(cyl(3.6, 3.6, N, N + 4, 'cream', { n: 8, cx: TX, cy: TY, phase: Math.PI / 8 }));
  for (let i = 0; i < 4; i++) {           // corner turrets: taller
    const x = TX + (i & 1 ? 4 : -4), y = TY + (i & 2 ? 4 : -4);
    parts.push(cyl(0.9, 0.9, N, N + 3, 'cream', { n: 6, cx: x, cy: y }), spire(oct(1.1, x, y), N + 3, N + 10, 'green', { cx: x, cy: y }));
  }
  for (let i = 0; i < 4; i++) {           // mid-face turrets: smaller
    const a = i * Math.PI / 2, x = TX + 4.3 * Math.cos(a), y = TY + 4.3 * Math.sin(a);
    parts.push(spire(oct(0.8, x, y), N, N + 6.5, 'green', { cx: x, cy: y }));
  }
  parts.push(
    spire(oct(3.8, TX, TY), N + 4, N + 22, 'green', { cx: TX, cy: TY }),
    cyl(1.9, 2.1, N + 13, N + 14.4, 'brass', { n: 8, cx: TX, cy: TY }),      // the gilded crown
    bar([TX, TY, N + 21], [TX, TY, N + 26.5], 0.25, 'ink'),
    ball(0.6, TX, TY, N + 24.6, 'brass', { n: 8, k: 4 }),
  );

  // South tower: a lower helmet of stacked cupolas and lanterns.
  parts.push(
    cyl(4.4, 4.4, S, S + 1.6, 'cream', { n: 8, cx: TX, cy: -TY, phase: Math.PI / 8 }),
    lathe([[4.4, S + 1.6], [4.2, S + 3.6], [3.1, S + 5.6], [1.6, S + 6.6], [1.6, S + 6.6]], 'green', { n: 8, cx: TX, cy: -TY, phase: Math.PI / 8 }),
    cyl(1.6, 1.6, S + 6.6, S + 8.8, 'cream', { n: 8, cx: TX, cy: -TY, phase: Math.PI / 8 }),
    lathe([[2.0, S + 8.8], [1.8, S + 10.2], [0.8, S + 11.2], [0.5, S + 11.6]], 'green', { n: 8, cx: TX, cy: -TY, phase: Math.PI / 8 }),
    spire(oct(0.5, TX, -TY), S + 11.6, S + 16.5, 'green', { cx: TX, cy: -TY }),
    ball(0.45, TX, -TY, S + 14.2, 'brass', { n: 8, k: 4 }),
  );
  return group(parts);
};
