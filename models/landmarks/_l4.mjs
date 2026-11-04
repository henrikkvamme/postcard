// Shared helpers for the l4 landmark set: plinths, arched openings on a wall face, merlons, hills, palms.
// A leading underscore keeps this file out of the build.
import { group } from '../lib/mesh.mjs';
import { block, box, rect2, plate, loft, ringAt, bar, cyl, chamfer2, lathe, base } from '../lib/parts.mjs';

// A low base under a landmark, like the card a paper model stands on.
export const plinth = (w, d, { h = 0.8, tone = 'stone', cx = 0, cy = 0, bevel } = {}) =>
  base(block(chamfer2(w, d, Math.min(w, d) * 0.04, cx, cy), 0, h, tone, { bevel: bevel ?? h * 0.4 }));

// An arch outline in a plane, as [u, z] points (counter-clockwise): width w, springing at z1, sill at z0.
export function arch2(w, z0, z1, { cu = 0, k = 6, pointed = false } = {}) {
  const r = w / 2, pts = [[cu - r, z0], [cu + r, z0], [cu + r, z1]];
  if (pointed) { // a gothic arch: two arcs of radius w meeting at the apex
    const h = Math.max(1, Math.floor(k / 2)), A = Math.PI / 3;
    for (let i = 1; i <= h; i++) { const a = (i / h) * A; pts.push([cu - r + w * Math.cos(a), z1 + w * Math.sin(a)]); }
    for (let i = h - 1; i >= 1; i--) { const a = (i / h) * A; pts.push([cu + r - w * Math.cos(a), z1 + w * Math.sin(a)]); }
  } else for (let i = 1; i < k; i++) { const a = (i / k) * Math.PI; pts.push([cu + r * Math.cos(a), z1 + r * Math.sin(a)]); }
  pts.push([cu - r, z1]);
  return pts;
}

// A plate (window, door, panel) proud of a wall face by t. side: '+x', '-x', '+y', '-y'; at: the wall's
// coordinate on that axis. Points are [u, z], where u runs along the wall.
export function onFace(pts, side, at, t, tone) {
  const m = plate(pts, at + t, t + 0.04, tone); // 4 cm sunk into the wall
  if (side === '+y') return m;
  if (side === '-y') return m.mirrorY();
  if (side === '+x') return m.turn('z', -90);
  return m.turn('z', 90);
}
// The same plate on all four faces of a square tower of half-width h.
export const onFour = (pts, h, t, tone) => group(['+x', '-x', '+y', '-y'].map((s) => onFace(pts, s, h, t, tone)));

// Merlons along a closed plan polygon's edges: blocks of size s, every 2s, on top of a wall at z.
export function merlons(plan, z, { s = 1, h = s, w = s, tone = 'paper', closed = true } = {}) {
  const out = [], n = plan.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = plan[i], b = plan[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.floor(L / (2 * s)));
    const yaw = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    for (let j = 0; j < k; j++) {
      const t = (j + 0.5) / k;
      out.push(box(s, w, z, z + h, tone).turn('z', yaw).move(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0));
    }
  }
  return group(out);
}

// A hill: plan rings shrinking upward. levels: [[scale, z], ...] applied to a base plan polygon.
export const hill = (plan, levels, tone, { cx = 0, cy = 0 } = {}) =>
  loft(levels.map(([s, z, dx = 0, dy = 0]) => ringAt(plan.map(([x, y]) => [cx + dx + (x - cx) * s, cy + dy + (y - cy) * s]), z)), tone);

// A palm: a leaning trunk and a crown of fronds.
export function palm(x, y, h, { lean = 0.06, fronds = 7, len = 0.38 } = {}) {
  const top = [x + h * lean, y, h], out = [bar([x, y, 0], top, h * 0.045, 'ink2')];
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + 0.3, L = h * len;
    const mid = [top[0] + Math.cos(a) * L * 0.55, top[1] + Math.sin(a) * L * 0.55, h + L * 0.12];
    const tip = [top[0] + Math.cos(a) * L, top[1] + Math.sin(a) * L, h - L * 0.35];
    out.push(bar(top, mid, h * 0.05, 'green'), bar(mid, tip, h * 0.04, 'green'));
  }
  return group(out);
}

export { rect2, cyl, box };

// A ball (a finial, a gilded globe): a lathe of a circle.
export function ball(r, x, y, z, tone, { n = 10, k = 5 } = {}) {
  const prof = Array.from({ length: k + 1 }, (_, i) => { const a = -Math.PI / 2 + (i / k) * Math.PI; return [r * Math.cos(a), z + r * Math.sin(a)]; });
  prof[0][0] = 0; prof[k][0] = 0;
  return lathe(prof, tone, { n, cx: x, cy: y });
}
