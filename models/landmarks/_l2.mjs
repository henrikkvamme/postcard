// Shared parts for the l2 landmark set: plinths, arch outlines, ribbons along a path, palms, jittered
// lathes for mountains. A leading underscore keeps this file out of the build.
import { Mesh, group, cross, norm, sub, add, mul, dot } from '../lib/mesh.mjs';
import { loft, block, chamfer2, circle2, plate, box, cyl, bar, ringAt, base } from '../lib/parts.mjs';

const TAU = Math.PI * 2;

// A low base with a folded top edge, as a paper model stands on its card.
export const plinth = (w, d, h = 1, { tone = 'stone', top = 'cream', c } = {}) =>
  base(block(chamfer2(w, d, c ?? Math.min(w, d) * 0.08), 0, h, tone, { bevel: h * 0.45, top }));
export const disc = (rx, h = 1, { ry = rx, tone = 'stone', top = 'cream', n = 28 } = {}) =>
  block(circle2(1, n).map(([x, y]) => [x * rx, y * ry]), 0, h, tone, { bevel: h * 0.45, top });

const dedupe = (pts) => pts.filter((p, i) => { const q = pts[(i + pts.length - 1) % pts.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });

// The arc over an opening from x0 to x1 springing at zs, rise h (a semicircle when h is half the span),
// from left to right over the top.
const arcOver = (x0, x1, zs, h, k) => Array.from({ length: k + 1 }, (_, i) => {
  const a = Math.PI * (1 - i / k); return [(x0 + x1) / 2 + (x1 - x0) / 2 * Math.cos(a), zs + h * Math.sin(a)]; });

// A solid arch-headed opening shape [x, z], counter-clockwise: a dark plate for a window or a doorway.
export const archPts = (x0, x1, z0, zs, { k = 6, rise } = {}) => dedupe([[x0, z0], [x1, z0], ...arcOver(x0, x1, zs, rise ?? (x1 - x0) / 2, k).reverse()]);

// A wall outline [x, z] from x0 to x1 and z0 to z1 with openings cut up from the bottom edge.
// openings: [{ x0, x1, zs, rise, k }] left to right; rise 0 makes a square-headed opening at zs.
export function wallPts(x0, x1, z0, z1, openings) {
  const pts = [[x0, z0]];
  for (const o of openings) {
    pts.push([o.x0, z0]);
    if (!o.rise) pts.push([o.x0, o.zs], [o.x1, o.zs]);
    else pts.push(...arcOver(o.x0, o.x1, o.zs, o.rise, o.k ?? 6));
    pts.push([o.x1, z0]);
  }
  pts.push([x1, z0], [x1, z1], [x0, z1]);
  return dedupe(pts);
}
// n equal openings with piers between and ends at each side.
export const bays = (x0, x1, n, pier, zs, { rise, ends = pier, k } = {}) => {
  const w = (x1 - x0 - 2 * ends - (n - 1) * pier) / n;
  return Array.from({ length: n }, (_, i) => { const a = x0 + ends + i * (w + pier); return { x0: a, x1: a + w, zs, rise: rise ?? w / 2, k }; });
};

// A wall slab: an [x, z] outline extruded through y from y0 to y1 (y0 < y1).
export const slab = (pts, y0, y1, tone, opts) => plate(pts, y1, y1 - y0, tone, opts);

// A flat face in a vertical plane: pts [u, z] along the direction (dx, dy) from origin (ox, oy), pushed
// out along the face normal by off. Seen from the right of the direction. No thickness, no ink by default.
export function facePlate(pts, ox, oy, dx, dy, tone, { off = 0.05, ink = false } = {}) {
  const l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = uy, ny = -ux; // outward = right-hand side
  return new Mesh().face(pts.map(([u, z]) => [ox + ux * u + nx * off, oy + uy * u + ny * off, z]), tone, { ink });
}

// A ribbon along a path of points with a flat cross-section w wide and t thick, kept level across.
// Fronds, leaves, cables seen as straps.
export function ribbon(path, w, t, tone, { taper = (s) => 1 } = {}) {
  const rings = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const d = norm(sub(b, a));
    let u = sub([0, 0, 1], mul(d, d[2])); u = Math.hypot(...u) < 1e-6 ? [1, 0, 0] : norm(u);
    const s = cross(u, d), k = taper(i / (path.length - 1)), hw = Math.max(1e-3, w * k / 2), ht = t / 2;
    return [add(add(p, mul(s, hw)), mul(u, -ht)), add(add(p, mul(s, hw)), mul(u, ht)), add(add(p, mul(s, -hw)), mul(u, ht)), add(add(p, mul(s, -hw)), mul(u, -ht))];
  });
  return loft(rings, tone);
}

// A palm: a leaning trunk in three bends and a crown of drooping fronds.
export function palm(x, y, h, { lean = [0.18, 0.06], fronds = 7, len = h * 0.42, z0 = 0, trunk = 'sand', leaf = 'green', phase = 0.4 } = {}) {
  const out = [];
  const pt = (t) => [x + lean[0] * h * t * t, y + lean[1] * h * t * t, z0 + h * t];
  const path = [0, 0.35, 0.7, 1].map(pt);
  for (let i = 0; i + 1 < path.length; i++) out.push(bar(path[i], path[i + 1], h * (0.075 - i * 0.012), trunk));
  const top = path[3];
  for (let i = 0; i < fronds; i++) {
    const a = phase + (i / fronds) * TAU, c = Math.cos(a), s = Math.sin(a), L = len * (0.85 + 0.15 * ((i * 7) % 3) / 2);
    const fp = [0, 0.35, 0.7, 1].map((t) => [top[0] + c * L * t, top[1] + s * L * t, top[2] + L * (0.28 * t - 0.75 * t * t)]);
    out.push(ribbon(fp, L * 0.28, L * 0.03, leaf, { taper: (t) => (t < 0.4 ? 0.55 + t : 1.35 - t * 1.25) }));
  }
  out.push(cyl(h * 0.06, h * 0.03, top[2] - h * 0.04, top[2] + h * 0.03, trunk, { n: 6, cx: top[0], cy: top[1] }));
  return group(out);
}

// A mountain or a cone from a profile [[r, z], ...] with r jittered per angle (seeded), so it reads as
// rock folded from paper, not a turned part. tone(ring, sector) picks the tone of each face band.
export function rock(profile, tone, { n = 12, seed = 1, jitter = 0.12, cx = 0, cy = 0, skew = [0, 0] } = {}) {
  let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const jr = Array.from({ length: n }, () => 1 + jitter * (rnd() * 2 - 1));
  const z1 = profile[profile.length - 1][1], z0 = profile[0][1];
  const rings = profile.map(([r, z], k) => {
    const lift = (z - z0) / ((z1 - z0) || 1);
    return Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU, rr = Math.max(r, 1e-4) * (k === 0 ? jr[i] : jr[i] * 0.6 + jr[(i + 1) % n] * 0.4);
      return [cx + skew[0] * lift + rr * Math.cos(a), cy + skew[1] * lift + rr * Math.sin(a), z]; });
  });
  const m = new Mesh(), tf = typeof tone === 'function' ? tone : () => tone;
  for (let r = 0; r + 1 < rings.length; r++) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, A = rings[r], B = rings[r + 1];
    const top = profile[r + 1][0] < 1e-3;
    if (top) m.face([A[i], A[j], B[i]], tf(r, i));
    else { m.face([A[i], A[j], B[j]], tf(r, i)); m.face([A[i], B[j], B[i]], tf(r, i)); }
  }
  m.face([...rings[0]].reverse(), tf(-1, 0));
  return m;
}

// Merlons along a path [x, y] (counter-clockwise round a roof, so the inside is on the left), standing
// on z: blocks w long, d deep and h high, every step metres, set in from the edge so they sit on it.
export function crenel(path, z, { step = 2, w = 1, d = 0.6, h = 1, tone = 'paper', closed = false } = {}) {
  const out = [], n = closed ? path.length : path.length - 1;
  for (let i = 0; i < n; i++) {
    const a = path[i], b = path[(i + 1) % path.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    const k = Math.max(1, Math.round(L / step)), deg = Math.atan2(dy, dx) * 180 / Math.PI, nx = -dy / L, ny = dx / L;
    for (let j = 0; j < k; j++) { const t = (j + 0.5) / k;
      out.push(box(w, d, z, z + h, tone).turn('z', deg).move(a[0] + dx * t + nx * d / 2, a[1] + dy * t + ny * d / 2, 0)); }
  }
  return group(out);
}

// Signed volume of a closed mesh: positive when every face points out.
export const volume = (m) => m.faces.reduce((v, f) => { for (let i = 1; i + 1 < f.pts.length; i++) {
  const a = f.pts[0], b = f.pts[i], c = f.pts[i + 1]; v += dot(a, cross(b, c)) / 6; } return v; }, 0);

export { TAU };
