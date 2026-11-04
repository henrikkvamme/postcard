// Shared parts for the l3 landmark set (venice, florence, milan, munich, brussels, stockholm, dublin,
// edinburgh, athens, istanbul, dubrovnik). A leading underscore: build.mjs does not build this file.
import { Mesh, group } from '../lib/mesh.mjs';
import { loft, block, box, cyl, lathe, plate, spire, bar, ringAt, rect2, chamfer2, circle2, hull, dome, gable, inset, round2 } from '../lib/parts.mjs';

const TAU = Math.PI * 2;

// The base every landmark stands on: a low bevelled plate, stone sides and a cream top.
export const plinth = (plan, h = 1.5, { tone = 'stone', top = 'cream', bevel = 0.4 } = {}) =>
  block(plan, -h, 0, tone, { bevel: Math.min(bevel, h / 2), top });

// An arched opening as a plan polygon [u, z], counter-clockwise: w wide, h tall to the crown, k points on the arch.
export function arch2(w, h, { cu = 0, z0 = 0, k = 5, pointed = 0 } = {}) {
  const r = w / 2, rz = r * (1 + pointed), spring = Math.max(0, h - rz), pts = [[cu - r, z0], [cu + r, z0]];
  for (let i = 0; i <= k; i++) { const a = (i / k) * Math.PI; pts.push([cu + r * Math.cos(a), z0 + spring + rz * Math.sin(a)]); }
  return pts.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-6)
    .filter((p, i, a) => i < a.length - 1 || Math.hypot(p[0] - a[0][0], p[1] - a[0][1]) > 1e-6);
}
export const rectUZ = (w, h, cu = 0, z0 = 0) => [[cu - w / 2, z0], [cu + w / 2, z0], [cu + w / 2, z0 + h], [cu - w / 2, z0 + h]];

// A thin plate laid on the outside of a vertical wall. pts are [u, z] counter-clockwise seen from outside.
// side: '+y' (u runs along +x), '-y' (u along +x), '+x' (u along -y), '-x' (u along +y). at: the wall's distance
// from the axis; t: how far the plate stands proud. c: the wall's centre along the other axis.
export function onFace(pts, side, at, t, tone, c = 0) {
  const p = plate(pts, at + t, t, tone);
  if (side === '+y') return p.move(c, 0, 0);
  if (side === '-y') return p.mirrorY().move(c, 0, 0);
  if (side === '+x') return p.turn('z', -90).move(0, c, 0);
  return p.turn('z', 90).move(0, c, 0);
}
// The same plate on all four sides of a w x d block centred on (cx, cy).
export const onFour = (pts, w, d, t, tone, { cx = 0, cy = 0, ends = pts } = {}) => group(
  onFace(pts, '+y', d / 2, t, tone).move(cx, cy, 0), onFace(pts, '-y', d / 2, t, tone).move(cx, cy, 0),
  onFace(ends, '+x', w / 2, t, tone).move(cx, cy, 0), onFace(ends, '-x', w / 2, t, tone).move(cx, cy, 0));

// A rib along a path of points, a square-ish section w wide and h proud of the surface, outward along out(p).
export function rib(path, out, w, h, tone) {
  const rings = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const t = norm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), o = norm3(out(p));
    const s = norm3(cross3(t, o));
    const q = (u, v) => [p[0] + s[0] * u + o[0] * v, p[1] + s[1] * u + o[1] * v, p[2] + s[2] * u + o[2] * v];
    return [q(-w / 2, -0.01), q(w / 2, -0.01), q(w / 2, h), q(-w / 2, h)];
  });
  const m = loft(rings, tone);
  return signedVolume(m) < 0 ? m.flip() : m;
}

// A sphere of radius r centred at c: k rings, n sides.
export function sphere(r, c, tone, { n = 14, k = 8 } = {}) {
  const prof = Array.from({ length: k + 1 }, (_, i) => { const a = -Math.PI / 2 + (i / k) * Math.PI; return [r * Math.cos(a), c[2] + r * Math.sin(a)]; });
  return lathe(prof, tone, { n, cx: c[0], cy: c[1] });
}

// A half dome against a wall: radius r on z0, open toward -dir (the side that meets the wall), dir along +x by
// default; squash flattens it. The flat back is a wall face. Turned by deg about z, then moved to (cx, cy).
export function halfDome(r, z0, tone, { n = 8, k = 4, squash = 1, deg = 0, cx = 0, cy = 0, back = tone } = {}) {
  const rings = [];
  for (let j = 0; j <= k; j++) {
    const a = (j / k) * Math.PI / 2, rr = Math.max(r * Math.cos(a), 1e-4), z = z0 + r * squash * Math.sin(a);
    // Half ring from -90 deg to +90 deg about +x, listed counter-clockwise seen from above.
    rings.push(Array.from({ length: n + 1 }, (_, i) => { const t = -Math.PI / 2 + (i / n) * Math.PI; return [rr * Math.cos(t), rr * Math.sin(t), z]; }));
  }
  const m = new Mesh();
  for (let j = 0; j < k; j++) for (let i = 0; i < n; i++) {
    const A = rings[j], B = rings[j + 1];
    const q = [A[i], A[i + 1], B[i + 1], B[i]];
    if (j === k - 1) m.face([A[i], A[i + 1], B[0]], tone); else m.face(q, tone);
  }
  // Bottom (half disc) and back (quarter ellipse in the y-z plane at x = 0).
  m.face([...rings[0]].reverse(), tone);
  const backPts = [];
  for (let j = 0; j <= k; j++) backPts.push(rings[j][0]);
  for (let j = k; j >= 0; j--) backPts.push(rings[j][n]);
  m.face(dedupe(backPts).reverse(), back);
  const out = signedVolume(m) < 0 ? m.flip() : m;
  return out.turn('z', deg).move(cx, cy, 0);
}

// A straight wall from plan point a to b, t thick, from z0 to z1.
export function wall(a, b, z0, z1, t, tone, opts = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), deg = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  return box(L, t, z0, z1, tone, opts).turn('z', deg).move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
}

// Merlons along a wall from a to b at height z: blocks w wide and h tall, spaced by gap, t thick.
export function merlons(a, b, z, { w = 1.2, h = 1.2, gap = 1.0, t = 0.8, tone = 'stone' } = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.floor((L + gap) / (w + gap)));
  const pad = (L - (n * w + (n - 1) * gap)) / 2, out = [];
  for (let i = 0; i < n; i++) {
    const s = (pad + i * (w + gap) + w / 2) / L;
    out.push(wall([a[0] + (b[0] - a[0]) * (s - w / 2 / L), a[1] + (b[1] - a[1]) * (s - w / 2 / L)],
      [a[0] + (b[0] - a[0]) * (s + w / 2 / L), a[1] + (b[1] - a[1]) * (s + w / 2 / L)], z, z + h, t, tone));
  }
  return group(out);
}
// Merlons around a circle of radius r centred on (cx, cy).
export function merlonRing(r, z, { count = 12, h = 1.2, frac = 0.5, t = 0.8, tone = 'stone', cx = 0, cy = 0 } = {}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a0 = (i / count) * TAU, a1 = a0 + (frac * TAU) / count;
    const P = (a, rr) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    const plan = [P(a0, r - t), P(a1, r - t), P(a1, r), P(a0, r)].reverse();
    out.push(ccw(plan) ? block(plan, z, z + h, tone) : block([...plan].reverse(), z, z + h, tone));
  }
  return group(out);
}

// A flag on a pole standing at (x, y, z): pole h tall, a red flag w x fh at the top, flying toward +x.
export const flag = (x, y, z, h, { w = h * 0.4, fh = h * 0.25, s = h * 0.025 } = {}) => group(
  box(s, s, z, z + h, 'ink2', { cx: x, cy: y }),
  box(w, s * 0.6, z + h - fh, z + h, 'red', { cx: x + s / 2 + w / 2, cy: y }),
);

// A hipped roof over a w x d rectangle centred on (cx, cy): eaves at z0, ridge along x at z1, overhang o.
export function hip(w, d, z0, z1, tone, { cx = 0, cy = 0, o = 0 } = {}) {
  const m = new Mesh(), x0 = cx - w / 2 - o, x1 = cx + w / 2 + o, y0 = cy - d / 2 - o, y1 = cy + d / 2 + o;
  const h = Math.min(d / 2 + o, (w + 2 * o) / 2), r0 = [x0 + h, cy, z1], r1 = [x1 - h, cy, z1];
  m.face([[x0, y0, z0], [x1, y0, z0], r1, r0], tone);
  m.face([[x1, y1, z0], [x0, y1, z0], r0, r1], tone);
  m.face([[x1, y0, z0], [x1, y1, z0], r1], tone);
  m.face([[x0, y1, z0], [x0, y0, z0], r0], tone);
  m.face([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], tone);
  return m;
}

// Rings for a loft of polygons, each ring a plan at a height: [[plan2, z], ...].
export const stack = (levels, tone, opts) => loft(levels.map(([p, z]) => ringAt(p, z)), tone, opts);

export function signedVolume(m) {
  let v = 0;
  for (const f of m.faces) for (let i = 1; i + 1 < f.pts.length; i++) {
    const a = f.pts[0], b = f.pts[i], c = f.pts[i + 1];
    v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return v;
}
export const ccw = (plan) => plan.reduce((s, p, i) => { const q = plan[(i + 1) % plan.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) > 0;
const norm3 = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dedupe = (pts) => pts.filter((p, i, a) => { const q = a[(i + a.length - 1) % a.length]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 1e-6; });

// Deterministic noise for rock outlines.
export const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

export { Mesh, group, box, cyl, lathe, block, spire, bar, loft, ringAt, rect2, chamfer2, circle2, hull, dome, gable, inset, round2, plate, TAU };
