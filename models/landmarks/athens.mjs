// The Parthenon, Athens: a Doric temple of 8 by 17 columns on its three-stepped base, the entablature
// round the top and a pediment at each end, open to the sky as it stands today. A low rock plate stands for
// the Acropolis. Red: the recessed field of each pediment, as the ancient painters left it.
import { group, box, cyl, Mesh, rect2, chamfer2, plinth, signedVolume } from './_l3.mjs';

export const meta = { name: 'athens', kind: 'landmark', place: 'Athens', lng: 23.7267, lat: 37.9715, label: 'Parthenon', px: 100 };

const L = 69.5, W = 30.9;                     // the stylobate (top step)
const STEP = 0.55, Z = 3 * STEP;              // three steps
const COL = 10.4, CR = 0.95;                  // column height and foot radius
const ARCH = Z + COL, FRIEZE = ARCH + 1.35, CORN = FRIEZE + 1.35, TOPE = CORN + 0.6;
const PED = 3.6;                              // pediment rise

// A pediment at the end x = sx * L/2: a triangular block of the raking cornice with a red recessed field.
function pediment(sx) {
  const m = new Mesh(), x0 = sx * (L / 2 + 0.4), x1 = sx * (L / 2 - 1.8), hw = W / 2 + 0.4;
  const tri = (x, h, w) => [[x, -w, TOPE], [x, w, TOPE], [x, 0, TOPE + h]];
  const a = tri(x0, PED, hw), b = tri(x1, PED, hw);
  const solid = new Mesh();
  solid.face(sx > 0 ? a : [...a].reverse(), 'paper');
  solid.face(sx > 0 ? [...b].reverse() : b, 'paper');
  for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; const q = [a[i], b[i], b[j], a[j]]; solid.face(sx > 0 ? q : [...q].reverse(), 'paper'); }
  m.merge(signedVolume(solid) < 0 ? solid.flip() : solid);
  // The tympanum: a red triangle set just inside the frame, standing a hair proud of the front.
  const f = sx * (L / 2 + 0.45), inner = [[f, -hw + 3.2, TOPE + 0.5], [f, hw - 3.2, TOPE + 0.5], [f, 0, TOPE + PED - 0.75]];
  m.face(sx > 0 ? inner : [...inner].reverse(), 'red', { ink: false });
  return m;
}

export default () => {
  const parts = [plinth(chamfer2(L + 22, W + 18, 4), 2.2, { tone: 'stone', top: 'sand', bevel: 0.6 })];
  // Three steps.
  for (let i = 0; i < 3; i++) parts.push(box(L + (3 - i) * 1.4, W + (3 - i) * 1.4, i * STEP, (i + 1) * STEP, 'paper', { top: 'cream' }));
  // Columns: 8 across each end, 17 along each side, with a flared capital and a square abacus.
  const xs = Array.from({ length: 17 }, (_, i) => -L / 2 + 1.1 + (i * (L - 2.2)) / 16);
  const ys = Array.from({ length: 8 }, (_, i) => -W / 2 + 1.1 + (i * (W - 2.2)) / 7);
  const spots = [];
  for (const x of xs) for (const y of [ys[0], ys[7]]) spots.push([x, y]);
  for (const y of ys.slice(1, 7)) for (const x of [xs[0], xs[16]]) spots.push([x, y]);
  for (const [x, y] of spots) {
    parts.push(cyl(CR, CR * 0.78, Z, ARCH - 0.9, 'paper', { n: 10, cx: x, cy: y, caps: [false, false] })); // ends hidden: no caps
    parts.push(cyl(CR * 0.8, CR * 1.25, ARCH - 0.9, ARCH - 0.4, 'paper', { n: 10, cx: x, cy: y, caps: [true, false] }));
    parts.push(box(2.3, 2.3, ARCH - 0.4, ARCH, 'cream', { cx: x, cy: y }));
  }
  // The entablature: architrave, frieze and cornice as a frame round the top (no roof).
  const frame = (w, z0, z1, tone, o = 0) => [
    box(L + o, w, z0, z1, tone, { cy: W / 2 - w / 2 + o / 2 }), box(L + o, w, z0, z1, tone, { cy: -W / 2 + w / 2 - o / 2 }),
    box(w, W - 2 * w + o, z0, z1, tone, { cx: L / 2 - w / 2 + o / 2 }), box(w, W - 2 * w + o, z0, z1, tone, { cx: -L / 2 + w / 2 - o / 2 })];
  parts.push(...frame(2.2, ARCH, FRIEZE, 'paper'), ...frame(2.2, FRIEZE, CORN, 'cream'), ...frame(2.8, CORN, TOPE, 'paper', 0.8));
  parts.push(pediment(1), pediment(-1));
  // The cella: low ruined walls inside the colonnade.
  for (const s of [-1, 1]) parts.push(box(48, 1.4, Z, Z + 5, 'stone', { cy: s * 8.5, top: 'cream' }));
  parts.push(box(1.4, 18.4, Z, Z + 5, 'stone', { cx: -9, top: 'cream' }));
  return group(parts);
};
