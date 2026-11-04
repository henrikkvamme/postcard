// The parts vocabulary. Each part returns a Mesh in the world frame (x forward, y left, z up).
import { Mesh, group } from './mesh.mjs';

const TAU = Math.PI * 2;

// Loft: stitch closed rings of equal length, with caps on the ends. Each ring is a list of [x, y, z].
// The caps are flat polygons (concave allowed). This one part makes boxes, bevels, cylinders, cones,
// noses and roofs.
export function loft(rings, tone, { caps = [true, true], capTone = tone, ink = true } = {}) {
  const m = new Mesh(), n = rings[0].length;
  for (let r = 0; r + 1 < rings.length; r++) {
    const A = rings[r], B = rings[r + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const q = [A[i], A[j], B[j], B[i]].filter((p, k, a) => k === 0 || !same(p, a[k - 1])).filter((p, k, a) => k < a.length - 1 || !same(p, a[0]));
      if (q.length >= 3) m.face(q, tone, { ink });
    }
  }
  if (caps[0]) m.face([...rings[0]].reverse(), capTone, { ink });
  if (caps[1]) m.face([...rings[rings.length - 1]], capTone, { ink });
  return m;
}
const same = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 1e-9;

// Rings in a horizontal plane at height z. A ring is listed counter-clockwise seen from above.
export const ringAt = (pts2, z) => pts2.map(([x, y]) => [x, y, z]);
export const rect2 = (w, d, cx = 0, cy = 0) => [[cx - w / 2, cy - d / 2], [cx + w / 2, cy - d / 2], [cx + w / 2, cy + d / 2], [cx - w / 2, cy + d / 2]];
// A rectangle with its corners cut by c (an octagon): the chamfer of a paper box.
export const chamfer2 = (w, d, c, cx = 0, cy = 0) => {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2;
  return [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]];
};
export const circle2 = (r, n = 12, cx = 0, cy = 0, phase = 0) => Array.from({ length: n }, (_, i) => {
  const a = phase + (i / n) * TAU; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
// A rectangle with rounded corners, k points per corner.
export const round2 = (w, d, r, k = 3, cx = 0, cy = 0) => {
  const out = [], q = [[w / 2 - r, -d / 2 + r, -90], [w / 2 - r, d / 2 - r, 0], [-w / 2 + r, d / 2 - r, 90], [-w / 2 + r, -d / 2 + r, 180]];
  for (const [x, y, a0] of q) for (let i = 0; i <= k; i++) {
    const a = (a0 + (90 * i) / k) * Math.PI / 180; out.push([cx + x + r * Math.cos(a), cy + y + r * Math.sin(a)]); }
  return out;
};

// An upright block from z0 to z1 with a plan polygon; bevel b insets the top edge (a paper fold).
export function block(plan, z0, z1, tone, { bevel = 0, top = tone, ink = true } = {}) {
  if (!bevel) return loft([ringAt(plan, z0), ringAt(plan, z1)], tone, { capTone: top, ink });
  const inner = inset(plan, bevel);
  return group(loft([ringAt(plan, z0), ringAt(plan, z1 - bevel)], tone, { caps: [true, false], ink }),
    loft([ringAt(plan, z1 - bevel), ringAt(inner, z1)], top, { caps: [false, true], capTone: top, ink }));
}

// Move each edge of a counter-clockwise plan polygon inward by d (mitred corners).
export function inset(plan, d) {
  const n = plan.length;
  const edge = (i) => { const a = plan[i], b = plan[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l; return [[a[0] + nx * d, a[1] + ny * d], [dx, dy]]; };
  return plan.map((_, i) => {
    const [p, u] = edge((i + n - 1) % n), [q, v] = edge(i);
    const den = u[0] * v[1] - u[1] * v[0];
    if (Math.abs(den) < 1e-12) return q;
    const t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den;
    return [p[0] + u[0] * t, p[1] + u[1] * t];
  });
}

// A box centred on (cx, cy) in plan, from z0 to z1.
export const box = (w, d, z0, z1, tone, o = {}) => block(rect2(w, d, o.cx || 0, o.cy || 0), z0, z1, tone, o);

// A cylinder or cone frustum along z, radius r0 at z0 and r1 at z1, n sides.
export function cyl(r0, r1, z0, z1, tone, { n = 12, cx = 0, cy = 0, phase = 0, top = tone, caps = [true, true] } = {}) {
  return loft([ringAt(circle2(r0, n, cx, cy, phase), z0), ringAt(circle2(r1, n, cx, cy, phase), z1)], tone, { capTone: top, caps });
}

// A lathe: profile [[r, z], ...] turned about z. r = 0 closes to a point.
export function lathe(profile, tone, { n = 12, cx = 0, cy = 0, phase = 0 } = {}) {
  const rings = profile.map(([r, z]) => ringAt(circle2(Math.max(r, 1e-6), n, cx, cy, phase), z));
  return loft(rings, tone, { caps: [profile[0][0] > 1e-4, profile[profile.length - 1][0] > 1e-4] });
}

// A plate in the side of a body: a polygon in the x-z plane at y, with thickness t toward -y.
// Windows, doors, stripes. Points are [x, z].
export function plate(pts, y, t, tone, opts) {
  const a = pts.map(([x, z]) => [x, y, z]), b = pts.map(([x, z]) => [x, y - t, z]);
  return loft([b, a], tone, { ...opts }).flip();
}

// A gabled roof over a w x d plan (ridge along x), from eave height z0, ridge height z1, with overhang o.
export function gable(w, d, z0, z1, tone, { o = 0, end = 'paper' } = {}) {
  const x0 = -w / 2 - o, x1 = w / 2 + o, y0 = -d / 2 - o, y1 = d / 2 + o;
  const m = new Mesh();
  m.face([[x0, y0, z0], [x1, y0, z0], [x1, 0, z1], [x0, 0, z1]], tone);
  m.face([[x1, y1, z0], [x0, y1, z0], [x0, 0, z1], [x1, 0, z1]], tone);
  m.face([[x1, y0, z0], [x1, y1, z0], [x1, 0, z1]], end);
  m.face([[x0, y1, z0], [x0, y0, z0], [x0, 0, z1]], end);
  m.face([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], tone);
  return m;
}

// A pyramid or spire over a polygon at z0, apex at height z1.
export function spire(plan, z0, z1, tone, { cx = 0, cy = 0 } = {}) {
  const m = new Mesh(), ring = ringAt(plan, z0), apex = [cx, cy, z1];
  for (let i = 0; i < ring.length; i++) m.face([ring[i], ring[(i + 1) % ring.length], apex], tone);
  m.face([...ring].reverse(), tone);
  return m;
}

// A dome: a half lathe of radius r on z0, k rings, n sides.
export function dome(r, z0, tone, { n = 16, k = 5, cx = 0, cy = 0, squash = 1 } = {}) {
  const prof = Array.from({ length: k + 1 }, (_, i) => { const a = (i / k) * Math.PI / 2; return [r * Math.cos(a), z0 + r * squash * Math.sin(a)]; });
  return lathe(prof, tone, { n, cx, cy });
}

// A bar between two points with a square section of side s (rails, struts, cables, masts).
export function bar(a, b, s, tone) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d);
  const m = box(s, s, 0, L, tone);
  // Align z with d: rotate about y by pitch, then about z by yaw.
  const pitch = Math.acos(Math.max(-1, Math.min(1, d[2] / L))) * 180 / Math.PI, yaw = Math.atan2(d[1], d[0]) * 180 / Math.PI;
  return m.turn('y', pitch).turn('z', yaw).move(...a);
}

// A wheel standing in the x-z plane: radius r, width w, centred at (x, y, z).
export const wheel = (r, w, x, y, z, tone = 'ink', n = 10) => cyl(r, r, -w / 2, w / 2, tone, { n }).turn('x', 90).move(x, y, z);

// A lofted body along x from cross-sections: sections are [x, ring2] where ring2 is [[y, z], ...]
// counter-clockwise seen from +x. Train cars, noses, hulls, coaches.
export function hull(sections, tone, opts = {}) {
  const rings = sections.map(([x, r]) => r.map(([y, z]) => [x, y, z]));
  return loft(rings, tone, opts);
}
// A cross-section: a rounded rectangle w wide and h tall, sitting on z0, with roof radius r, in the y-z plane.
export const section = (w, h, r, z0 = 0, k = 3) => round2(w, h, r, k).map(([y, z]) => [y, z + z0 + h / 2]);
