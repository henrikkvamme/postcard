// Paper models: small parts built from rings, flat-shaded, with the tones baked into vertex colours.
// World frame: x forward, y left, z up, in metres. glb.mjs turns it into glTF (y up).
//
// The look follows the anatomy repo's craft rules (MIT, github.com/wheresryan22/anatomy):
// many small precise parts, each with a job; volume from a few tones with lighter tops;
// paper and navy ink, one red accent; no texture, no text.

// Palette: the kit's paper, ink and red (kit.css), plus the steps between them.
export const TONES = {
  paper: [0.984, 0.980, 0.961], // --card
  cream: [0.957, 0.949, 0.918], // --paper
  stone: [0.85, 0.84, 0.81],
  mist: [0.74, 0.76, 0.80],
  slate: [0.49, 0.53, 0.60],
  ink2: [0.31, 0.35, 0.45], // --ink2
  ink: [0.114, 0.165, 0.290], // --ink
  red: [0.722, 0.196, 0.165], // --red
  glass: [0.36, 0.42, 0.53],
  green: [0.30, 0.45, 0.36],
  sand: [0.88, 0.83, 0.72],
  brass: [0.74, 0.62, 0.38],
};

const STYLE = process.env.MODEL_STYLE || 'shaded';
// The palette is paper, navy and red (MODEL_PALETTE=strict, the default). Stone, sand, brass and cream
// become paper; green copper becomes the second navy. MODEL_PALETTE=subject keeps each subject's tones.
const STRICT = { cream: 'paper', stone: 'paper', sand: 'paper', brass: 'paper', green: 'ink2' };
const toneOf = (t) => (process.env.MODEL_PALETTE || 'strict') === 'strict' && STRICT[t] ? STRICT[t] : t;

// One light, from the north-west and high, as on a printed chart. Tops are lightest.
const L = norm([-0.45, 0.55, 0.70]);
const shade = (n) => {
  const d = Math.max(0, dot(n, L));
  const up = Math.max(0, n[2]);
  const k = 0.60 + 0.30 * d + 0.12 * up - (n[2] < -0.5 ? 0.12 : 0);
  // Four steps, as in anatomy's four tones: top, lit side, side, shade.
  // MODEL_STYLE (workshop): 'ink' is two steps (top, sides) with more ink; 'flat' is one tone, ink only.
  if (process.env.NOSHADE || STYLE === 'flat') return 1;
  if (STYLE === 'ink') return n[2] > 0.7 ? 1.0 : 0.88;
  return n[2] > 0.7 ? 1.0 : k > 0.86 ? 0.95 : k > 0.72 ? 0.88 : 0.80;
};

export function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
export function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
export function norm(a) { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

// A mesh is a list of polygons (each a list of 3D points, counter-clockwise seen from outside) with a tone,
// and a list of ink lines (pairs of points). Polygons are convex or are fanned from their first point
// only when convex; concave caps go through earcut().
export class Mesh {
  constructor() { this.faces = []; this.lines = []; }
  face(pts, tone, opts = {}) {
    pts = pts.filter((p, i, a) => { const q = a[(i + a.length - 1) % a.length]; return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) > 1e-9; });
    if (pts.length < 3) return this;
    const n = newell(pts); if (Math.hypot(...n) < 1e-12) return this;
    this.faces.push({ pts, tone, ink: opts.ink ?? true, flat: opts.flat ?? true }); return this; }
  line(a, b) { this.lines.push([a, b]); return this; }
  merge(m) { this.faces.push(...m.faces); this.lines.push(...m.lines); return this; }
  map(f) { const m = new Mesh(); m.faces = this.faces.map((x) => ({ ...x, pts: x.pts.map(f) })); m.lines = this.lines.map((l) => l.map(f)); return m; }
  move(x = 0, y = 0, z = 0) { return this.map((p) => [p[0] + x, p[1] + y, p[2] + z]); }
  scale(sx, sy = sx, sz = sx) {
    const m = this.map((p) => [p[0] * sx, p[1] * sy, p[2] * sz]);
    return sx * sy * sz < 0 ? m.flip() : m;
  }
  // Rotate about an axis through the origin: 'x', 'y' or 'z', in degrees.
  turn(axis, deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const f = { x: (p) => [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]],
      y: (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
      z: (p) => [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]] }[axis];
    return this.map(f);
  }
  flip() { const m = new Mesh(); m.faces = this.faces.map((x) => ({ ...x, pts: [...x.pts].reverse() })); m.lines = this.lines; return m; }
  tone(t) { const m = new Mesh(); m.faces = this.faces.map((x) => ({ ...x, tone: t })); m.lines = this.lines; return m; }
  mirrorY() { return this.scale(1, -1, 1); }
  bounds() {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const f of this.faces) for (const p of f.pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    return { lo, hi };
  }
}

export const group = (...ms) => ms.flat().reduce((a, m) => a.merge(m), new Mesh());

// Faces to triangles with baked tones; ink lines at creases sharper than `crease` degrees and at part
// outlines. Returns typed arrays for glb.mjs.
export function bake(mesh, { crease = STYLE === 'shaded' ? 40 : 25, minEdge = STYLE === 'shaded' ? 0.025 : 0.012 } = {}) {
  // One group of triangles per baked colour: deck.gl's glTF shader reads material colours, not COLOR_0.
  const groups = new Map();
  for (const f of mesh.faces) {
    const tris = triangulate(f.pts);
    const n = faceNormal(f.pts);
    const base = TONES[toneOf(f.tone)] || f.tone;
    const c = base.map((v) => Math.min(1, v * shade(n)));
    const key = c.map((v) => v.toFixed(4)).join(',');
    const g = groups.get(key) || { color: [...c, 1], pos: [], nor: [] }; groups.set(key, g);
    for (const t of tris) for (const p of t) { g.pos.push(...p); g.nor.push(...n); }
  }
  // Creases: an edge shared by two faces whose normals differ by more than `crease`, or an edge on
  // one face only. Edges are keyed by rounded endpoints.
  const key = (p) => p.map((v) => Math.round(v * 1e4)).join(',');
  const edges = new Map();
  for (const f of mesh.faces) {
    if (!f.ink) continue;
    const n = faceNormal(f.pts);
    for (let i = 0; i < f.pts.length; i++) {
      const a = f.pts[i], b = f.pts[(i + 1) % f.pts.length];
      const k = [key(a), key(b)].sort().join('|');
      const e = edges.get(k) || { a, b, ns: [] }; e.ns.push(n); edges.set(k, e);
    }
  }
  // Ink only what reads at map size: an edge shorter than minEdge of the model's longest side stays clean,
  // or a train's windows and bolts turn into dark noise at 80 px.
  const { lo, hi } = mesh.bounds(), short = minEdge * Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const cosC = Math.cos(crease * Math.PI / 180), lines = [];
  for (const e of edges.values()) {
    if (Math.hypot(e.a[0] - e.b[0], e.a[1] - e.b[1], e.a[2] - e.b[2]) < short) continue;
    const sharp = e.ns.length === 1 || e.ns.some((n, i) => e.ns.some((m, j) => j > i && dot(n, m) < cosC));
    if (sharp) lines.push(e.a, e.b);
  }
  for (const [a, b] of mesh.lines) lines.push(a, b);
  return { groups: [...groups.values()].map((g) => ({ color: g.color, pos: new Float32Array(g.pos), nor: new Float32Array(g.nor) })),
    lines: new Float32Array(lines.flat()) };
}

export function faceNormal(pts) { return norm(newell(pts)); }
// Newell's method: robust for any planar polygon; the length is twice the area.
function newell(pts) {
  let n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
  }
  return n;
}

const convex = (q) => q.every((a, i) => { const b = q[(i + 1) % q.length], c = q[(i + 2) % q.length]; return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) >= -1e-12; });
function triangulate(pts) {
  if (pts.length === 3) return [pts];
  const n = faceNormal(pts);
  // Project to the face plane and ear-clip, so concave caps (a station's roof outline) work too.
  const u = norm(Math.abs(n[2]) < 0.9 ? cross([0, 0, 1], n) : cross([1, 0, 0], n)), v = cross(n, u);
  const p2 = pts.map((p) => [dot(p, u), dot(p, v)]);
  const idx = pts.map((_, i) => i), out = [];
  const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p, a, b, c) => area(a, b, p) >= 0 && area(b, c, p) >= 0 && area(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
      const a = p2[ia], b = p2[ib], c = p2[ic];
      if (area(a, b, c) <= 1e-12) continue;
      if (idx.some((j) => j !== ia && j !== ib && j !== ic && inside(p2[j], a, b, c))) continue;
      out.push([pts[ia], pts[ib], pts[ic]]); idx.splice(i, 1); cut = true; break;
    }
    if (!cut) { if (idx.length > 3 && !convex(idx.map((i) => p2[i]))) throw new Error(`triangulate: cannot cut a ${idx.length}-point face`); break; }
  }
  for (let i = 1; i + 1 < idx.length; i++) out.push([pts[idx[0]], pts[idx[i]], pts[idx[i + 1]]]);
  return out;
}
