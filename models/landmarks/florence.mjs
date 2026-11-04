// Florence Cathedral: Brunelleschi's red ribbed dome on its octagonal drum with the lantern, the long nave
// with the three apse tribunes, and Giotto's square campanile at the front corner. Red: the dome's tiles,
// split by its eight white marble ribs.
import { group, box, block, spire, cyl, lathe, rect2, circle2, gable, plinth, onFace, rib, arch2, halfDome } from './_l3.mjs';

export const meta = { name: 'florence', kind: 'landmark', place: 'Florence', lng: 11.2560, lat: 43.7731, label: 'Florence Cathedral', px: 105 };

const DX = 32;                       // the crossing (dome centre) on x; the facade is at x = -72
const R = 22, DRUM0 = 46, DRUM1 = 58; // dome radius at its springing, drum heights
const oct = (r, cx = 0, cy = 0) => circle2(r, 8, cx, cy, Math.PI / 8);

// The dome's outline: a pointed arch ("quinto acuto"), radius 1.6 R about a centre 0.6 R past the axis.
function profile(r0, z0, rTop) {
  const rho = 1.6 * r0, c = r0 - rho, pts = [];
  const tEnd = Math.acos((rTop - c) / rho), k = 6;
  for (let i = 0; i <= k; i++) { const t = (i / k) * tEnd; pts.push([c + rho * Math.cos(t), z0 + rho * Math.sin(t)]); }
  return pts;
}

export default () => {
  const parts = [plinth(rect2(170, 104, -2, 0), 1.6)];
  // Nave: aisles, a raised clerestory with its roof, the facade at the west end.
  parts.push(box(96, 38, 0, 24, 'paper', { cx: -24, top: 'stone' }));
  parts.push(box(96, 18, 24, 34, 'paper', { cx: -24 }));
  parts.push(gable(96, 18, 34, 41, 'stone', { o: 0.3 }).move(-24, 0, 0));
  // Facade: a tall marble front with three doors and a round window.
  parts.push(box(3, 40, 0, 36, 'paper', { cx: -73.5 }));
  parts.push(gable(3, 20, 36, 45, 'paper', { end: 'paper' }).move(-73.5, 0, 0));
  parts.push(onFace(arch2(6, 11), '-x', 75, 0.15, 'ink2'));
  for (const s of [-1, 1]) parts.push(onFace(arch2(4, 8, { cu: s * 12 }), '-x', 75, 0.15, 'ink2'));
  parts.push(onFace(circle2(3.4, 10).map(([u, v]) => [u, v + 27]), '-x', 75, 0.15, 'ink2'));

  // The crossing: an octagonal core, three apse tribunes (east, north, south) with their small domes.
  parts.push(block(oct(27, DX), 0, DRUM0, 'paper'));
  for (const deg of [0, 90, -90]) {
    const a = deg * Math.PI / 180, cx = DX + 27 * Math.cos(a), cy = 27 * Math.sin(a);
    const half = Array.from({ length: 5 }, (_, i) => { const t = a - Math.PI / 2 + (i / 4) * Math.PI; return [cx + 15 * Math.cos(t), cy + 15 * Math.sin(t)]; });
    parts.push(block(half, 0, 28, 'paper'));
    parts.push(halfDome(14, 28, 'stone', { n: 4, k: 3, squash: 0.5, deg, cx, cy }));
    parts.push(cyl(4, 2.5, 28 + 7, 28 + 12, 'paper', { n: 8, cx: DX + 33 * Math.cos(a), cy: 33 * Math.sin(a) }));
  }
  // Drum with its round windows, the dome, its eight white ribs, the lantern.
  parts.push(block(oct(R + 1.5, DX), DRUM0, DRUM1, 'paper', { bevel: 0.6, top: 'cream' }));
  for (let i = 0; i < 8; i++) {
    const deg = i * 45, ri = (R + 1.5) * Math.cos(Math.PI / 8);
    parts.push(onFace(circle2(2.6, 10).map(([u, v]) => [u, v + 52]), '+x', ri, 0.15, 'ink2').turn('z', deg).move(DX, 0, 0));
  }
  const prof = profile(R, DRUM1, 4.6);
  parts.push(lathe([[R, DRUM1 - 0.01], ...prof.slice(1)], 'red', { n: 8, cx: DX, phase: Math.PI / 8 }));
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const path = prof.map(([r, z]) => [DX + r * c, r * s, z]);
    parts.push(rib(path, (p) => { const t = (p[2] - DRUM1) / (prof[prof.length - 1][1] - DRUM1); return [c * (1 - t * 0.6), s * (1 - t * 0.6), t * 0.9]; }, 2.0, 0.9, 'paper'));
  }
  const zl = prof[prof.length - 1][1];
  parts.push(cyl(5.2, 5.2, zl, zl + 1.2, 'cream', { n: 8, cx: DX, phase: Math.PI / 8 }));
  parts.push(cyl(4, 3.6, zl + 1.2, zl + 9, 'paper', { n: 8, cx: DX, phase: Math.PI / 8 }));
  parts.push(lathe([[4.6, zl + 9], [3.2, zl + 12], [0.9, zl + 15.5], [0.6, zl + 17]], 'cream', { n: 8, cx: DX, phase: Math.PI / 8 }));
  parts.push(cyl(1.1, 1.1, zl + 17, zl + 19, 'brass', { n: 8, cx: DX }), box(0.5, 0.5, zl + 19, zl + 22, 'brass', { cx: DX }));

  // Giotto's campanile: a square tower with corner buttresses, tall paired windows high up, a crowning cornice.
  const cx = -63, cy = -31, CW = 14.5, CT = 78;
  parts.push(box(CW, CW, 0, CT, 'paper', { cx, cy }));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) parts.push(cyl(1.6, 1.6, 0, CT, 'cream', { n: 8, cx: cx + sx * CW / 2, cy: cy + sy * CW / 2 }));
  for (const [z0, h, w] of [[34, 10, 3], [47, 10, 3], [60, 15, 5]]) {
    for (const side of ['+x', '-x']) parts.push(onFace(arch2(w, h, { z0, cu: 0, pointed: 0.3 }), side, CW / 2, 0.15, 'ink2').move(cx, cy, 0));
    for (const side of ['+y', '-y']) parts.push(onFace(arch2(w, h, { z0, cu: 0, pointed: 0.3 }), side, CW / 2, 0.15, 'ink2').move(cx, cy, 0));
  }
  for (const z of [20, 33, 46, 59]) parts.push(box(CW + 0.5, CW + 0.5, z - 0.7, z, 'cream', { cx, cy }));
  parts.push(box(CW + 3.5, CW + 3.5, CT, CT + 3, 'cream', { cx, cy, bevel: 0.6, top: 'paper' }));
  parts.push(box(CW + 2.2, CW + 2.2, CT + 3, CT + 4.5, 'paper', { cx, cy }));
  return group(parts);
};
