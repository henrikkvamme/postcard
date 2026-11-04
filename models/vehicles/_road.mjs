// Shared parts for the road, water and air set: wheels in arches, a bicycle hoop, a small car body,
// a toy person, and skin patches that sit on a part's face. Not built (leading underscore).
import { Mesh, group, faceNormal } from '../lib/mesh.mjs';
import { loft, wheel, bar, block, box, chamfer2, hull, section, rect2, ringAt, plate } from '../lib/parts.mjs';
import { lamp } from '../lib/rail.mjs';

// build.mjs imports every .mjs and indexes it; kind 'test' keeps this helper file out of index.json.
export const meta = { kind: 'test' };

const TAU = Math.PI * 2;

// A road wheel: a dark tyre with a light hub on the outer face. y is the wheel's centre; the hub faces away from y = 0.
export const tyre = (r, w, x, y, z, { hub = 'stone', n = 12 } = {}) => group(
  wheel(r, w, x, y, z, 'ink', n),
  wheel(r * 0.48, 0.03, x, y + Math.sign(y) * (w / 2 + 0.012), z, hub, n),
);

// A wheel arch on the side of a body: a dark plate from the body's floor z0 around one or more axles (xa to xb)
// with radius r about the axle height zc. On the left side; mirrorY() for the right.
export function arch(xa, xb, zc, r, z0, y, { t = 0.02, tone = 'ink', k = 5 } = {}) {
  const pts = [[xb + r, z0]];
  for (let i = 0; i <= k; i++) { const a = (i / k) * Math.PI / 2; pts.push([xb + r * Math.cos(a), zc + r * Math.sin(a)]); }
  for (let i = 0; i <= k; i++) { const a = Math.PI / 2 + (i / k) * Math.PI / 2; pts.push([xa + r * Math.cos(a), zc + r * Math.sin(a)]); }
  pts.push([xa - r, z0]);
  return plate(pts.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-6), y + t, t, tone);
}

// A bicycle hoop: a square section swept round a circle of radius R in the x-z plane.
export function hoop(R, t, w, x, y, z, tone = 'ink', n = 18) {
  const rings = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, c = Math.cos(a), s = Math.sin(a);
    rings.push([[R - t / 2, -w / 2], [R + t / 2, -w / 2], [R + t / 2, w / 2], [R - t / 2, w / 2]].map(([r, yy]) => [x + r * c, y + yy, z + r * s]));
  }
  rings.push(rings[0]);
  return loft(rings, tone, { caps: [false, false] });
}

// One polygon, listed counter-clockwise seen from outside, pushed out along its normal by d: a decal on a face.
export function skin(pts, tone, d = 0.01) {
  const n = faceNormal(pts);
  return new Mesh().face(pts.map((p) => [p[0] + n[0] * d, p[1] + n[1] * d, p[2] + n[2] * d]), tone);
}

// Retone the faces of a mesh whose normal passes a test (for example, the tops of a hull become deck).
export function retone(m, test, tone) {
  const out = new Mesh(); out.lines = m.lines;
  out.faces = m.faces.map((f) => (test(faceNormal(f.pts)) ? { ...f, tone } : f));
  return out;
}

// A limb or a body block between two points with a rectangular section (sx across the motion, sy sideways).
export const limb = (a, b, s, tone) => bar(a, b, s, tone);

// A small family car (a five-door hatchback) at toy length. The cabin is a dark glass frustum with paper
// pillars and a roof slab on top, so it reads as a car from above and from the side.
export function smallCar({ roof = 'paper', body = 'paper' } = {}) {
  const W = 1.76, Z0 = 0.28, BELT = 0.95, TOP = 1.5;
  const parts = [];
  // Lower body: a rounded box with a short hood that falls to the nose.
  parts.push(hull([
    [-1.86, section(W - 0.1, 0.6, 0.14, Z0 + 0.04)],
    [-1.76, section(W, BELT - Z0, 0.16, Z0)],
    [0.8, section(W, BELT - Z0, 0.16, Z0)],
    [1.62, section(W - 0.06, 0.52, 0.16, Z0)],
    [1.9, section(W - 0.24, 0.4, 0.14, Z0 + 0.04)],
  ], body));
  // Cabin: glass frustum from the belt line to the roof. Windscreen raked, hatch nearly upright.
  const gb = { x0: -1.72, x1: 0.86, y: 0.8, z: BELT - 0.01 }, gt = { x0: -1.6, x1: -0.14, y: 0.64, z: TOP };
  parts.push(loft([ringAt(rect2(gb.x1 - gb.x0, gb.y * 2, (gb.x0 + gb.x1) / 2), gb.z), ringAt(rect2(gt.x1 - gt.x0, gt.y * 2, (gt.x0 + gt.x1) / 2), gt.z)], 'glass'));
  parts.push(block(chamfer2(gt.x1 - gt.x0 + 0.1, gt.y * 2 + 0.1, 0.14, (gt.x0 + gt.x1) / 2), TOP - 0.01, TOP + 0.08, roof, { bevel: 0.04 }));
  // Pillars as paper patches on the slanted cabin side: [x at belt, x at roof] pairs for each edge.
  const yAt = (z) => gb.y + (gt.y - gb.y) * (z - gb.z) / (gt.z - gb.z) + 0.004;
  const P = (x, z) => [x, yAt(z), z];
  const pillar = (b0, b1, t1, t0) => skin([P(b0, gb.z), P(b1, gb.z), P(t1, gt.z), P(t0, gt.z)], body, 0.006);
  const left = group(
    pillar(0.86, 0.66, -0.26, -0.14),    // A pillar
    pillar(-0.36, -0.5, -0.6, -0.48),    // B pillar
    pillar(-1.14, -1.72, -1.6, -1.34),   // C pillar, wide, as on a hatchback
  );
  parts.push(left, left.mirrorY());
  // Wheels in dark arches.
  for (const x of [-1.2, 1.2]) {
    const a = arch(x, x, 0.31, 0.4, Z0, W / 2);
    parts.push(a, a.mirrorY());
    for (const s of [1, -1]) parts.push(tyre(0.31, 0.2, x, s * (W / 2 - 0.09), 0.31));
  }
  // Headlamps and a dark bumper line at the nose.
  for (const s of [1, -1]) parts.push(lamp(1.86, s * 0.56, 0.62));
  parts.push(box(0.06, W - 0.4, Z0 + 0.04, Z0 + 0.16, 'ink', { cx: 1.89 }));
  return group(parts);
}

// A toy person facing +x, built from a pose of joints. Trousers ink2, coat paper, head cream with ink2 hair.
export function person(p, { coat = 'paper', legs = 'ink2', hair = 'ink2', head = 'cream', limbW = 0.14, armW = 0.1 } = {}) {
  const parts = [];
  for (const [hip, knee, foot] of p.legs) {
    parts.push(limb(hip, knee, limbW, legs), limb(knee, foot, limbW * 0.9, legs));
    if (p.shoes !== false) parts.push(box(0.24, 0.11, foot[2] - 0.06, foot[2] + 0.04, 'ink', { cx: foot[0] + 0.05, cy: foot[1] }));
  }
  for (const [sh, el, hand] of p.arms) parts.push(limb(sh, el, armW, coat), limb(el, hand, armW * 0.9, coat));
  // Torso: a chamfered block, tilted forward by p.lean degrees about its hip.
  const t = p.torso;
  parts.push(block(chamfer2(t.d, t.w, 0.05), 0, t.h, coat, { bevel: 0.03 }).turn('y', t.lean || 0).move(...t.at));
  // Head: a faceted ball, with hair over the top and back.
  const [hx, hy, hz] = p.head, r = p.headR || 0.13;
  const ball = [];
  for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + (i / 4) * Math.PI; ball.push([Math.max(r * Math.cos(a), 1e-4), r * Math.sin(a)]); }
  const rings = ball.map(([rr, z]) => Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * TAU; return [hx + rr * Math.cos(a), hy + rr * Math.sin(a), hz + z]; }));
  parts.push(loft(rings, head, { caps: [false, false] }));
  if (hair) {
    const cap = ball.slice(2).map(([rr, z]) => Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * TAU; return [hx - 0.012 + (rr + 0.012) * Math.cos(a), hy + (rr + 0.012) * Math.sin(a), hz + z + 0.012]; }));
    parts.push(loft(cap, hair, { caps: [true, false] }));
  }
  return group(parts);
}
