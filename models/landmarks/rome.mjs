// The Colosseum: an elliptical travertine ring of three arcaded storeys and an attic, intact on one side and
// broken in steps on the other, where the lower inner ring and its arches show. Inside: the sloped cavea
// and the arena. One red accent: the brick hypogeum floor of the arena.
import { Mesh, group } from '../lib/mesh.mjs';
import { block, loft } from '../lib/parts.mjs';
import { disc, archPts } from './_l2.mjs';

export const meta = { name: 'rome', kind: 'landmark', place: 'Rome', lng: 12.4922, lat: 41.8902, label: 'Colosseum', px: 108 };

const A = 94, B = 78, N = 80, P = 2;       // outer half-axes, segments, plinth height
const T = 5.5, IN = 12;                    // outer ring depth, inner ring depth
const TOP = 48, INNER = 31;                // outer wall and inner ring heights
const TIERS = [[P + 0.6, P + 6.8], [P + 11.4, P + 17.6], [P + 22.2, P + 28.4]]; // arch bottom, spring
const CORNICE = [P + 10.4, P + 21.2, P + 32, P + 36.5];

const pt = (i, d = 0, n = N) => { const a = (i / n) * Math.PI * 2; return [(A - d) * Math.cos(a), (B - d) * Math.sin(a)]; };
// The outer wall stands from segment I0 to I1 (counter-clockwise), stepping down at both broken ends.
const I0 = -30, I1 = 33;
const height = (i) => {
  const e = Math.min(i - I0, I1 - i);
  return e < 1 ? INNER + 4 : e < 2 ? TOP - 10 : e < 3 ? TOP - 4 : TOP;
};

// A ring piece between depths d0 and d1 over segments i0..i1, from z0 to z1.
function arcPiece(i0, i1, d0, d1, z0, z1, tone, top = tone) {
  const out = [], inn = [];
  for (let i = i0; i <= i1; i++) { out.push(pt(i, d0)); inn.push(pt(i, d1)); }
  return block([...out, ...inn.reverse()], z0, z1, tone, { top });
}
// A full closed ring band: outer wall, top, inner wall (open below, it stands on the plinth).
const ringBand = (d0, d1, z0, z1, tone, n = N) => {
  const r = (d, z) => Array.from({ length: n }, (_, i) => [...pt(i, d, n), z]);
  return loft([r(d0, z0), r(d0, z1), r(d1, z1), r(d1, z0)], tone, { caps: [false, false] });
};

// Dark arched openings on the outer face of segment i at depth d, one per tier listed.
function arches(i, d, tiers, m) {
  const a = pt(i, d), b = pt(i + 1, d), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  // Walking the ring counter-clockwise, outward is on the right.
  for (const [z0, zs] of tiers) {
    const w = L * 0.56, u0 = (L - w) / 2;
    const pts = archPts(u0, u0 + w, z0, zs, { k: 4 });
    m.face(pts.map(([u, z]) => [a[0] + dx / L * u + dy / L * 0.08, a[1] + dy / L * u - dx / L * 0.08, z]), 'ink2', { ink: false });
  }
}
const lineRing = (d, z, i0, i1, m, h = () => 99) => { for (let i = i0; i < i1; i++) { if (h(i) <= z + 0.5) continue; const a = pt(i, d - 0.06), b = pt(i + 1, d - 0.06); m.line([...a, z], [...b, z]); } };

export default () => {
  const parts = [disc(A + 7, P, { ry: B + 7, n: 40 })];
  const det = new Mesh();
  // Outer wall: pieces of equal height between the broken ends.
  let s = I0;
  for (let i = I0 + 1; i <= I1; i++) if (i === I1 || height(i) !== height(s)) { parts.push(arcPiece(s, i, -0.01, T, P, height(s), 'sand', 'stone')); s = i; }
  for (let i = I0; i < I1; i++) {
    const h = height(i), tiers = TIERS.filter(([, zs]) => zs + 3.5 < h);
    arches(i, 0, tiers, det);
    if (h >= TOP - 4 && i % 2 === 0) { // small square windows in the attic
      const a = pt(i, 0), b = pt(i + 1, 0), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), u = L / 2;
      det.face([[u - 1, CORNICE[2] + 4.5], [u + 1, CORNICE[2] + 4.5], [u + 1, CORNICE[2] + 7.5], [u - 1, CORNICE[2] + 7.5]]
        .map(([uu, z]) => [a[0] + dx / L * uu + dy / L * 0.08, a[1] + dy / L * uu - dx / L * 0.08, z]), 'ink2', { ink: false });
    }
  }
  for (const z of CORNICE) lineRing(0, z, I0, I1, det, height);
  // Inner ring, all the way round: two arcaded storeys show where the outer wall has fallen.
  parts.push(ringBand(T, T + IN, P, INNER, 'sand'));
  for (let i = I1; i < I0 + N; i++) arches(i, T, TIERS.slice(0, 2), det);
  for (const z of CORNICE.slice(0, 2)) lineRing(T, z, I1, I0 + N, det);
  // Cavea: the seating slopes from the inner ring down to the podium round the arena.
  const ring = (ax, by, z, n = N) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [ax * Math.cos(a), by * Math.sin(a), z]; });
  const ca = A - T - IN, cb = B - T - IN, ea = 46, eb = 30;
  parts.push(loft([ring(ca, cb, INNER), ring(ea + 2, eb + 2, P + 6), ring(ea, eb, P + 6), ring(ea, eb, P + 1)], 'stone', { caps: [false, false] }));
  for (const t of [0.33, 0.66]) { const r = ring(ca + (ea + 2 - ca) * t, cb + (eb + 2 - cb) * t, INNER + (P + 6 - INNER) * t); for (let i = 0; i < N; i++) det.line(r[i], r[(i + 1) % N]); }
  // Arena: the brick hypogeum, its walls drawn as lines.
  parts.push(block(ring(ea, eb, 0, 32).map(([x, y]) => [x, y]), P, P + 1, 'red'));
  for (const y of [-18, -9, 0, 9, 18]) { const x = ea * Math.sqrt(1 - (y / eb) ** 2) - 1; det.line([-x, y, P + 1.02], [x, y, P + 1.02]); }
  return group(parts, det);
};
