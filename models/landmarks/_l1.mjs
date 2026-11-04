// Helpers for the landmark set l1: facades, gables, arches, plinths, flags.
import { group } from '../lib/mesh.mjs';
import { block, box, gable, loft, ringAt, bar, base } from '../lib/parts.mjs';

// build.mjs reads every .mjs file, underscore or not; kind 'test' keeps this one out of the build and the index.
export const meta = { name: '_l1', kind: 'test' };

// Signed area of a 2D polygon; ccw() turns any 2D polygon counter-clockwise.
export const area2 = (p) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
export const ccw = (p) => (area2(p) < 0 ? [...p].reverse() : p);

// A profile in the x-z plane extruded along y from y0 to y1 (a facade, a gable, a pediment).
// A bevel folds the front (-y) edge.
export const slabY = (pts, y0, y1, tone, o = {}) => block(ccw(pts), -y1, -y0, tone, o).turn('x', 90);
// A profile in the y-z plane ([y, z] points) extruded along x from x0 to x1.
export const slabX = (pts, x0, x1, tone, o = {}) => block(ccw(pts.map(([u, z]) => [-u, z])), -x1, -x0, tone, o).turn('x', 90).turn('z', -90);

// A gabled roof with its ridge along y: w across x, d along y.
export const gableY = (w, d, z0, z1, tone, { o = 0, end = 'paper', cx = 0, cy = 0 } = {}) =>
  gable(d, w, z0, z1, tone, { o, end }).turn('z', 90).move(cx, cy, 0);

// The low base every landmark stands on, like a paper model on its card.
export const plinth = (w, d, { h = 0.6, tone = 'stone', cx = 0, cy = 0, bevel } = {}) =>
  base(box(w, d, 0, h, tone, { cx, cy, bevel: bevel ?? h * 0.45 }));

// A solid over a plan polygon whose top follows z = f(x, y). f must be planar over the plan
// (a ramp or a flat top); where f is 0 the wall folds away.
export const wedge = (plan, f, tone, o = {}) => {
  const p = ccw(plan);
  return loft([ringAt(p, 0), p.map(([x, y]) => [x, y, f(x, y)])], tone, o);
};

// An opening outline in x-z: w wide, h tall, from (x, z); round or pointed top.
export function arch2(w, h, { x = 0, z = 0, pointed = false, k = 4 } = {}) {
  const r = w / 2, spring = z + h - (pointed ? w * 0.75 : r), top = z + h, R = [];
  for (let i = 1; i < k; i++) {
    const t = i / k;
    if (pointed) { // quadratic curve from the spring to the apex: the apex stays sharp
      const a = [r, spring], c = [r, spring + (top - spring) * 0.55], b = [0, top];
      R.push([(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]]);
    } else { const a = (t * Math.PI) / 2; R.push([r * Math.cos(a), spring + r * Math.sin(a)]); }
  }
  const right = [[r, z], [r, spring], ...R];
  const left = right.map(([u, v]) => [-u, v]).reverse();
  return [...right, [0, top], ...left].map(([u, v]) => [x + u, v]);
}

// A thin plate on a facade whose front face is the plane y = yf (facing -y): windows, doors, arches.
export const onFront = (pts, yf, tone = 'glass', { d = 0.08, ink = false } = {}) => slabY(pts, yf - d, yf + 0.02, tone, { ink });
export const rectXZ = (x, z, w, h) => [[x - w / 2, z], [x + w / 2, z], [x + w / 2, z + h], [x - w / 2, z + h]];

// The right half of a stepped gable from the eave (w wide, at zE) up to a top tw wide at zT, n steps.
export function stepsR(w, tw, zE, zT, n) {
  const dz = (zT - zE) / n, dx = (w - tw) / 2 / n, R = [[w / 2, zE]];
  for (let i = 0; i < n; i++) { const x = w / 2 - i * dx, z = zE + (i + 1) * dz; R.push([x, z], [x - dx, z]); }
  return R;
}
// A full facade outline from a right half (from the eave up): the body from z0 and the mirrored left half.
export function facade(w, R, z0 = 0) {
  const L = R.filter(([u]) => u > 1e-6).map(([u, v]) => [-u, v]).reverse();
  return [[-w / 2, z0], [w / 2, z0], ...R, ...L];
}

// A flag on a pole: the pole from (x, y, z0) to z1, the cloth (red) to +x of the pole.
export const flag = (x, y, z0, z1, { w = 2, h = 1.3, s = 0.15, tone = 'red', pole = 'ink' } = {}) => group(
  bar([x, y, z0], [x, y, z1], s, pole),
  box(w, s * 0.8, z1 - h, z1 - 0.05, tone, { cx: x + w / 2 + s / 2, cy: y }),
);
