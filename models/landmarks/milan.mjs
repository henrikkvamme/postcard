// Milan Cathedral: the wide stepped marble front with its six buttresses, each carrying a tall pinnacle,
// the five-aisled body whose roof edges bristle with rows of spires, the transept, and the crossing
// spire with the gilt Madonnina. Red: the great central door.
import { group, box, block, spire, cyl, lathe, rect2, circle2, loft, plinth, onFace, arch2, signedVolume } from './_l3.mjs';

export const meta = { name: 'milan', kind: 'landmark', place: 'Milan', lng: 9.1916, lat: 45.4642, label: 'Milan Cathedral', px: 105 };

const X0 = -70, X1 = 50, TX = 30;   // facade, apse start, transept centre

// A pinnacle: a slim square shaft and a needle spire, footed at (x, y, z), h tall.
const pinnacle = (x, y, z, h, s = 2) => group(
  box(s, s, z, z + h * 0.45, 'paper', { cx: x, cy: y }),
  spire(rect2(s * 0.9, s * 0.9, x, y), z + h * 0.45, z + h, 'paper', { cx: x, cy: y }),
);

// The facade's stepped outline in the y-z plane: low at the sides, rising to the central gable.
const front = [[-33, 0], [33, 0], [33, 31], [22, 36], [11, 44], [0, 56], [-11, 44], [-22, 36], [-33, 31]];

export default () => {
  const parts = [plinth(rect2(140, 104, -10, 0), 1.6)];
  // Body: the outer aisles, inner aisles and nave stepping up, flat marble roofs.
  parts.push(box(X1 - X0 - 4, 58, 0, 30, 'paper', { cx: (X0 + 4 + X1) / 2, top: 'stone' }));
  parts.push(box(X1 - X0 - 4, 36, 30, 37, 'paper', { cx: (X0 + 4 + X1) / 2, top: 'stone' }));
  parts.push(box(X1 - X0 - 4, 16, 37, 44, 'paper', { cx: (X0 + 4 + X1) / 2, top: 'stone' }));
  // Transept and the polygonal apse.
  parts.push(box(30, 90, 0, 37, 'paper', { cx: TX, top: 'stone' }));
  const apse = Array.from({ length: 5 }, (_, i) => { const t = -Math.PI / 2 + (i / 4) * Math.PI; return [X1 + 29 * Math.cos(t), 29 * Math.sin(t)]; });
  parts.push(block(apse, 0, 30, 'paper', { top: 'stone' }), block(apse.map(([x, y]) => [X1 + (x - X1) * 0.6, y * 0.6]), 30, 37, 'paper', { top: 'stone' }));

  // The facade: a thick marble wall with the stepped outline, five doors (the middle one red).
  const wall = loft([front.map(([y, z]) => [X0 + 4, -y, z]), front.map(([y, z]) => [X0, -y, z])], 'paper');
  parts.push(signedVolume(wall) < 0 ? wall.flip() : wall);
  parts.push(onFace(arch2(7, 14), '-x', -X0, 0.2, 'red'));
  for (const s of [-1, 1]) for (const u of [16.5, 27.5]) parts.push(onFace(arch2(4, 9), '-x', -X0, 0.2, 'ink2').move(0, s * u, 0));
  for (const u of [-16.5, 16.5]) parts.push(onFace(arch2(3.4, 9, { z0: 20, pointed: 0.4 }), '-x', -X0, 0.2, 'ink2').move(0, u, 0));
  parts.push(onFace(arch2(6, 12, { z0: 22, pointed: 0.4 }), '-x', -X0, 0.2, 'ink2'));
  // Six buttresses up the front, each crowned by a pinnacle.
  for (const [y, z] of [[33, 31], [22, 36], [11, 44]]) for (const s of [-1, 1]) {
    parts.push(box(4, 3, 0, z + 5, 'paper', { cx: X0 - 1, cy: s * y, top: 'cream' }));
    parts.push(pinnacle(X0 - 1, s * y, z + 5, 15, 2.4));
  }
  parts.push(pinnacle(X0 + 2, 0, 56, 9, 1.6));

  // Tall pointed windows in every bay of the outer aisles, a great window in each transept end.
  for (let x = X0 + 9; x <= X1 - 4; x += 10) {
    if (Math.abs(x - TX) < 17) continue;
    for (const side of ['+y', '-y']) parts.push(onFace(arch2(3.6, 17, { z0: 7, pointed: 0.4 }), side, 29, 0.15, 'ink2', x));
  }
  for (const side of ['+y', '-y']) parts.push(onFace(arch2(8, 22, { z0: 8, pointed: 0.4 }), side, 45, 0.15, 'ink2', TX));
  // Spires along the roof edges: every bay along the outer and inner aisle walls, and round the transept.
  for (let x = X0 + 14; x <= X1 - 4; x += 10) {
    if (Math.abs(x - TX) < 17) continue;
    for (const s of [-1, 1]) { parts.push(pinnacle(x, s * 29, 30, 13, 1.6)); parts.push(pinnacle(x, s * 18, 37, 13, 1.6)); }
  }
  for (const s of [-1, 1]) for (const x of [TX - 15, TX, TX + 15]) parts.push(pinnacle(x, s * 45, 37, 13, 1.6));
  for (let i = 0; i < 5; i++) { const t = -Math.PI / 2 + (i / 4) * Math.PI; parts.push(pinnacle(X1 + 28 * Math.cos(t), 28 * Math.sin(t), 30, 12, 1.6)); }

  // The crossing: an octagonal tiburio with four corner spires, the tall needle spire and the Madonnina.
  const oct = (r) => circle2(r, 8, TX, 0, Math.PI / 8);
  parts.push(block(oct(11), 44, 60, 'paper', { top: 'stone' }));
  for (const a of [45, 135, 225, 315]) { const r = a * Math.PI / 180; parts.push(pinnacle(TX + 12 * Math.cos(r), 12 * Math.sin(r), 44, 24, 2)); }
  parts.push(block(oct(5), 60, 72, 'paper'));
  parts.push(spire(oct(4.2), 72, 103, 'paper', { cx: TX }));
  parts.push(lathe([[0.9, 101], [0.7, 103.5], [0.9, 105], [0.5, 107], [0.01, 108]], 'brass', { n: 6, cx: TX }));
  return group(parts);
};
