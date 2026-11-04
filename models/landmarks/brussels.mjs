// The Atomium, Brussels: nine steel spheres at the corners and centre of a cube that stands on one corner,
// joined by tubes along the cube's edges and diagonals, on three bipod legs and the central column.
// Red: a small flag on the top sphere.
import { group, cyl, circle2, plinth, sphere, flag } from './_l3.mjs';

export const meta = { name: 'brussels', kind: 'landmark', place: 'Brussels', lng: 4.3415, lat: 50.8949, label: 'Atomium', px: 95 };

const A = 44, RS = 9.2, RT = 1.7, ZC = 55;   // cube edge, sphere and tube radius, height of the centre

// Rotate a point so that the cube's body diagonal (1, 1, 1) points straight up.
function up(p) {
  const s = 1 / Math.sqrt(3), k = [s, -s, 0], kl = Math.hypot(...k), u = k.map((v) => v / kl);
  const c = s, sn = Math.sqrt(1 - c * c), d = u[0] * p[0] + u[1] * p[1] + u[2] * p[2];
  const x = [u[1] * p[2] - u[2] * p[1], u[2] * p[0] - u[0] * p[2], u[0] * p[1] - u[1] * p[0]];
  return [0, 1, 2].map((i) => p[i] * c + x[i] * sn + u[i] * d * (1 - c));
}
// A tube between two points: a round bar (10 sides, so no ink runs along it) along the segment.
function tube(a, b, r, tone = 'mist') {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d);
  const pitch = Math.acos(Math.max(-1, Math.min(1, d[2] / L))) * 180 / Math.PI, yaw = Math.atan2(d[1], d[0]) * 180 / Math.PI;
  return cyl(r, r, 0, L, tone, { n: 10 }).turn('y', pitch).turn('z', yaw).move(...a);
}

export default () => {
  const corners = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push({ c: [x, y, z], p: up([x * A / 2, y * A / 2, z * A / 2]).map((v, i) => v + (i === 2 ? ZC : 0)) });
  const centre = [0, 0, ZC], parts = [plinth(circle2(48, 24), 1.2)];
  // Spheres, edge tubes (corners one step apart) and diagonal tubes to the centre.
  for (const k of corners) parts.push(sphere(RS, k.p, 'paper', { n: 16, k: 8 }));
  parts.push(sphere(RS, centre, 'paper', { n: 16, k: 8 }));
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const diff = corners[i].c.reduce((s, v, n) => s + (v !== corners[j].c[n] ? 1 : 0), 0);
    if (diff === 1) parts.push(tube(corners[i].p, corners[j].p, RT));
  }
  for (const k of corners) parts.push(tube(centre, k.p, RT));
  // Supports: the central column under the lowest sphere, and a bipod under each of the three lower spheres.
  const low = corners.reduce((a, b) => (b.p[2] < a.p[2] ? b : a));
  parts.push(tube([0, 0, 0], low.p, 2.4, 'stone'));
  const ring = corners.filter((k) => k !== low && k.p[2] < ZC);
  for (const k of ring) {
    const [x, y] = k.p, r = Math.hypot(x, y), ux = x / r, uy = y / r, tx = -uy, ty = ux;
    for (const s of [-1, 1]) parts.push(tube([x * 0.9 + tx * s * 7, y * 0.9 + ty * s * 7, 0], [x, y, k.p[2] - RS * 0.8], 1.1, 'stone'));
  }
  const top = corners.reduce((a, b) => (b.p[2] > a.p[2] ? b : a));
  parts.push(flag(top.p[0], top.p[1], top.p[2] + RS - 0.3, 11, { w: 6, fh: 3.6, s: 0.45 }));
  return group(parts);
};
