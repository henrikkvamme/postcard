// The Hungarian Parliament: a long white Neo-Gothic front on the Danube, steep red roofs, projecting
// pavilions with pyramid roofs, a ribbed central dome on a tall drum with its lantern spire, and rows of
// small white pinnacles along the eaves. One red accent: the roofs and the dome.
import { Mesh, group } from '../lib/mesh.mjs';
import { box, block, rect2, spire, lathe, cyl, loft, ringAt } from '../lib/parts.mjs';
import { plinth, facePlate } from './_l2.mjs';

export const meta = { name: 'budapest', kind: 'landmark', place: 'Budapest', lng: 19.0457, lat: 47.5070, label: 'Parliament', px: 110 };

const P = 2, L = 134, D = 20, EAVE = P + 22;      // plinth, half length, half depth, wing eave
const PAV = [50, 92, 128];                       // pavilion centres (both sides)

// A hipped roof over a w x d plan from z0 to a ridge at z1, ridge along x.
const hip = (w, d, z0, z1, cx = 0) => loft([ringAt(rect2(w, d, cx, 0), z0), ringAt(rect2(Math.max(0.4, w - d), 0.4, cx, 0), z1)], 'red');
const pinnacle = (x, y, z0, h = 6, s = 1.3) => group(box(s, s, z0, z0 + h, 'paper', { cx: x, cy: y }), spire(rect2(s, s, x, y), z0 + h, z0 + h + 4.5, 'paper', { cx: x, cy: y }));

export default () => {
  const parts = [plinth(2 * L + 12, 2 * D + 18, P)], lines = new Mesh();
  // Wings: the long white body with its steep roof, between the centre block and the end pavilions.
  for (const sx of [-1, 1]) {
    const x0 = 26, x1 = L - 4, cx = sx * (x0 + x1) / 2;
    parts.push(box(x1 - x0, 2 * D, P, EAVE, 'paper', { cx }));
    parts.push(hip(x1 - x0, 2 * D, EAVE, EAVE + 13, cx));
    // Pinnacles along the front and back eaves, and tall windows between them on the river front.
    for (let x = x0 + 4; x < x1 - 2; x += 7) {
      if (PAV.some((p) => Math.abs(x - p) < 10)) continue;
      parts.push(pinnacle(sx * x, -D + 0.6, EAVE - 2), pinnacle(sx * x, D - 0.6, EAVE - 2));
      parts.push(facePlate([[sx * x + 1.2, P + 6], [sx * x + 5.8, P + 6], [sx * x + 5.8, P + 17], [sx * x + 1.2, P + 17]].map(([u, z]) => [u + L, z]), -L, -D, 1, 0, 'glass'));
    }
  }
  // Pavilions: taller blocks stepping forward, each with a pyramid roof and two corner turrets.
  for (const sx of [-1, 1]) for (const [i, xp] of PAV.entries()) {
    const x = sx * xp, w = i === 2 ? 12 : 14, h = i === 2 ? P + 26 : P + 28;
    parts.push(box(w, 2 * D + 6, P, h, 'paper', { cx: x }));
    parts.push(spire(rect2(w, 2 * D + 6, x, 0), h, h + 18, 'red', { cx: x, cy: 0 }));
    for (const sy of [-1, 1]) for (const ex of [-1, 1]) parts.push(pinnacle(x + ex * (w / 2 - 0.8), sy * (D + 2.2), h - 3, 9, 1.8));
  }
  // The centre block under the dome, with a steep roof each side of the drum.
  parts.push(box(52, 2 * D + 8, P, P + 28, 'paper'));
  parts.push(hip(52, 2 * D + 8, P + 28, P + 38));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) parts.push(pinnacle(sx * 25, sy * (D + 3.2), P + 24, 10, 2));
  // The drum: sixteen sides with a tall window in each, ringed by pinnacles.
  const N = 16, RD = 14, ZD = P + 30, ZT = P + 54;
  parts.push(cyl(RD, RD, ZD, ZT, 'paper', { n: N, phase: Math.PI / N }));
  for (let i = 0; i < N; i++) {
    const a = (i + 0.5) / N * Math.PI * 2, b = (i + 1.5) / N * Math.PI * 2;
    const p = [RD * Math.cos(a), RD * Math.sin(a)], q = [RD * Math.cos(b), RD * Math.sin(b)], s = Math.hypot(q[0] - p[0], q[1] - p[1]);
    parts.push(facePlate([[s * 0.3, ZD + 8], [s * 0.7, ZD + 8], [s * 0.7, ZT - 4], [s * 0.3, ZT - 4]], p[0], p[1], q[0] - p[0], q[1] - p[1], 'glass'));
    if (i % 2 === 0) parts.push(pinnacle((RD + 0.4) * Math.cos(a), (RD + 0.4) * Math.sin(a), ZT - 2, 4, 1.2));
  }
  // The dome: a pointed ribbed dome, its ribs drawn as ink, then the lantern and spire.
  const prof = [[RD + 0.6, ZT], [RD, ZT + 6.5], [12, ZT + 13], [8.6, ZT + 18.5], [4.6, ZT + 22.5], [2, ZT + 24]];
  parts.push(lathe(prof, 'red', { n: N, phase: Math.PI / N }));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / N;
    for (let k = 0; k + 1 < prof.length; k++) lines.line([prof[k][0] * Math.cos(a), prof[k][0] * Math.sin(a), prof[k][1]], [prof[k + 1][0] * Math.cos(a), prof[k + 1][0] * Math.sin(a), prof[k + 1][1]]); }
  parts.push(cyl(2.2, 2.2, ZT + 24, ZT + 28, 'paper', { n: 8 }), spire(rect2(3.2, 3.2), ZT + 28, ZT + 40, 'paper'));
  return group(parts, lines);
};
