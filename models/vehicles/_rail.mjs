// Helpers for the rail set (train-regional, train-night, tram, metro, funicular, gondola). Not a model.
// A body here is a stack of horizontal plan rings: each band of height gets its own tone, so a window
// ribbon, a stripe or a skirt runs round the body and round the cab front without a seam.
import { Mesh, group } from '../lib/mesh.mjs';
import { loft, ringAt } from '../lib/parts.mjs';

// build.mjs imports every .mjs file in this folder; kind 'test' keeps this helper out of the build and index.
export const meta = { kind: 'test' };

const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

// Plan of a car from xr to xf, w wide, counter-clockwise seen from above. Each end is a superellipse cap
// `front` (or `rear`) long, 0 for a square end; n is its squareness (2 is an ellipse, higher is boxier).
// Points 0..k are the front cap, k+1..2k+1 the rear cap.
export function plan(xr, xf, w, { front = 0, rear = 0, n = 2.5, nr = n, k = 8 } = {}) {
  const pts = [];
  for (let i = 0; i <= k; i++) { const a = -Math.PI / 2 + Math.PI * i / k;
    pts.push([xf + front * sp(Math.cos(a), 2 / n), (w / 2) * sp(Math.sin(a), 2 / n)]); }
  for (let i = 0; i <= k; i++) { const a = Math.PI / 2 + Math.PI * i / k;
    pts.push([xr + rear * sp(Math.cos(a), 2 / nr), (w / 2) * sp(Math.sin(a), 2 / nr)]); }
  return pts;
}

// A body as a stack of rings. planAt(z, d) gives the plan at height z, shrunk by d on every side for the
// roof rounding (the same point count at every z). A shrunk plan, not an inset: an inset folds a short end cap.
// levels: [[z, tone], ...] bottom to top; each tone fills the band up to the next z; the last z is the roof.
// rr rounds the roof edge over `steps` rings. inkCaps: [bottom, top] cap outlines inked or not, so a body
// that sits on another one has no line where they meet.
export function stack(planAt, levels, { rr = 0, steps = 3, roof = 'paper', bottom = 'ink2', inkCaps = [true, true] } = {}) {
  const top = levels[levels.length - 1][0];
  const zs = levels.map(([z, t]) => ({ z, t }));
  if (rr) {
    const z0 = top - rr, last = zs.pop();
    const tone = zs.filter((l) => l.z <= z0).pop()?.t ?? roof;
    for (let i = 0; i < steps; i++) zs.push({ z: z0 + rr * Math.sin((i / steps) * Math.PI / 2), t: tone, d: rr - rr * Math.cos((i / steps) * Math.PI / 2) });
    zs.push({ ...last, d: rr });
    zs.sort((a, b) => a.z - b.z);
  }
  const ring = (l) => ringAt(planAt(l.z, l.d || 0), l.z);
  const rings = zs.map(ring), m = new Mesh();
  for (let i = 0; i + 1 < rings.length; i++) {
    const t = zs[i].t ?? zs.filter((l, j) => j < i && l.t).pop()?.t;
    m.merge(loft([rings[i], rings[i + 1]], t, { caps: [false, false] }));
  }
  m.face([...rings[0]].reverse(), bottom, { ink: inkCaps[0] });
  m.face([...rings[rings.length - 1]], roof, { ink: inkCaps[1] });
  return m;
}

// An overlay on a stacked body: plan points i0..i1 between heights za and zb, standing off by `off`.
// A wrap-round windscreen, a painted cab front. planAt must be the body's own plan (below any roof rounding).
export function wrap(planAt, za, zb, i0, i1, tone, { off = 0.03, steps = 1 } = {}) {
  const m = new Mesh(), zs = Array.from({ length: steps + 1 }, (_, s) => za + (zb - za) * s / steps);
  const rings = zs.map((z) => {
    const p = planAt(z), n = p.length;
    const en = (i) => { const a = p[(i + n) % n], b = p[(i + 1 + n) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; };
    const out = [];
    for (let i = i0; i <= i1; i++) { const u = en(i - 1), v = en(i), q = [u[0] + v[0], u[1] + v[1]], l = Math.hypot(...q) || 1;
      out.push([p[i % n][0] + off * q[0] / l, p[i % n][1] + off * q[1] / l, z]); }
    return out;
  });
  for (let s = 0; s < steps; s++) for (let i = 0; i < i1 - i0; i++) {
    const A = rings[s], B = rings[s + 1];
    m.face([A[i], A[i + 1], B[i + 1], B[i]], tone);
  }
  return m;
}

// A flat plate on the side of a body at y = side (both sides when mirror): x0..x1, z0..z1.
export const sidePlate = (x0, x1, z0, z1, side, tone, d = 0.03) => {
  const m = new Mesh(), y = side, s = Math.sign(side) || 1, yo = y + s * d;
  const pts = [[x0, yo, z0], [x1, yo, z0], [x1, yo, z1], [x0, yo, z1]];
  m.face(s > 0 ? [...pts].reverse() : pts, tone);
  return m;
};
export const plates = (x0, x1, z0, z1, half, tone, d) => group(sidePlate(x0, x1, z0, z1, half, tone, d), sidePlate(x0, x1, z0, z1, -half, tone, d));
