// Stockholm City Hall: a long hall on the water with its open arcade and green copper roof, and at its end
// the tall square brick tower with a gallery, a green copper lantern and spire, and the three gilt crowns.
// Red: the tower's brick shaft.
import { group, box, block, cyl, lathe, rect2, circle2, plinth, onFace, arch2, rectUZ, hip } from './_l3.mjs';

export const meta = { name: 'stockholm', kind: 'landmark', place: 'Stockholm', lng: 18.0543, lat: 59.3275, label: 'Stockholm City Hall', px: 100 };

const HL = 104, HD = 34, HH = 24;          // hall length, depth, wall height
const TW = 16, TX = HL / 2 + 2, TY = -HD / 2 + 7, SH = 74; // tower side, centre, shaft height

// A crown: a flared gilt cup with a small ball on top.
const crown = (x, y, z) => group(
  lathe([[0.45, z], [0.95, z + 0.9], [0.8, z + 1.2]], 'brass', { n: 6, cx: x, cy: y }),
  cyl(0.25, 0.25, z + 1.2, z + 1.6, 'brass', { n: 4, cx: x, cy: y }),
);

export default () => {
  const parts = [plinth(rect2(HL + 34, HD + 18, 8, -2), 1.4)];
  // The hall: walls, a low hipped copper roof, the waterfront arcade and a row of tall windows.
  parts.push(box(HL, HD, 0, HH, 'paper', { cx: -2 }));
  parts.push(hip(HL, HD, HH, HH + 9, 'green', { cx: -2, o: 0.6 }));
  parts.push(box(HL + 0.8, HD + 0.8, HH - 1, HH, 'cream', { cx: -2 }));
  for (let i = 0; i < 9; i++) {
    const x = -2 - HL / 2 + 10 + i * 9.5;
    parts.push(onFace(arch2(6, 7.5), '-y', HD / 2, 0.15, 'ink2', x));
    parts.push(onFace(rectUZ(2.6, 8, 0, 11), '-y', HD / 2, 0.12, 'ink2', x));
    parts.push(onFace(rectUZ(2.6, 8, 0, 11), '+y', HD / 2, 0.12, 'ink2', x));
  }
  for (const side of ['+x', '-x']) for (const u of [-8, 0, 8]) parts.push(onFace(rectUZ(2.6, 8, u, 11), side, HL / 2, 0.12, 'ink2').move(-2, 0, 0));
  // The tower: red brick shaft with slit windows, a stone gallery, the copper lantern, spire and crowns.
  parts.push(box(TW, TW, 0, SH, 'red', { cx: TX, cy: TY }));
  for (const side of ['+x', '-x', '+y', '-y']) for (const z0 of [36, 52, 64])
    parts.push(onFace(arch2(2.2, 7), side, TW / 2, 0.12, 'ink2').move(TX, TY, z0 - 0));
  for (const side of ['+x', '-x', '+y', '-y'])
    parts.push(onFace(rectUZ(TW - 4, 6, 0, SH - 8), side, TW / 2, 0.12, 'ink2').move(TX, TY, 0));
  parts.push(box(TW + 2.4, TW + 2.4, SH, SH + 1.4, 'cream', { cx: TX, cy: TY, bevel: 0.4, top: 'paper' }));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) parts.push(cyl(1.4, 1.4, SH + 1.4, SH + 4.6, 'paper', { n: 6, cx: TX + sx * (TW / 2 - 0.4), cy: TY + sy * (TW / 2 - 0.4) }));
  parts.push(box(TW - 3, TW - 3, SH + 1.4, SH + 7, 'red', { cx: TX, cy: TY }));
  const oct = (r) => circle2(r, 8, TX, TY, Math.PI / 8);
  parts.push(block(oct(5), SH + 7, SH + 15, 'green'));
  for (let i = 0; i < 8; i += 2) parts.push(onFace(arch2(1.8, 5.6), '+x', 5 * Math.cos(Math.PI / 8), 0.1, 'ink2').turn('z', i * 45).move(TX, TY, SH + 8.2));
  parts.push(lathe([[5.7, SH + 15], [4.6, SH + 16.4], [2.3, SH + 18.2], [2.7, SH + 20], [1.1, SH + 22.6], [0.6, SH + 26], [0.01, SH + 29]], 'green', { n: 8, cx: TX, cy: TY, phase: Math.PI / 8 }));
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.3; parts.push(crown(TX + 1.2 * Math.cos(a), TY + 1.2 * Math.sin(a), SH + 29)); }
  parts.push(cyl(0.2, 0.2, SH + 26, SH + 31.6, 'brass', { n: 4, cx: TX, cy: TY }));
  return group(parts);
};
