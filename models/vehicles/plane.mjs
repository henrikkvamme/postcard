// Narrow-body airliner, nose +x: a round fuselage with a dark cockpit band, low swept wings with slight
// dihedral, two engines slung forward under the wings, a swept tailplane, and a tall fin as the red accent.
// Chunkier than the real thing, so the cross of wings and fuselage reads at map size.
import { group } from '../lib/mesh.mjs';
import { loft, hull, circle2, box } from '../lib/parts.mjs';
import { skin } from './_road.mjs';

export const meta = { name: 'plane', kind: 'vehicle', modes: ['plane'], label: 'Plane', px: 96 };

const N = 12;
// Fuselage stations: x, radius, centre height. The tail cone keeps a straight top and sweeps its belly up.
const FUS = [
  [-16, 0.3, 4.7], [-14, 1.0, 4.15], [-11, 1.75, 3.5], [-8, 2.2, 3.1],
  [12, 2.2, 3.1], [13.6, 1.95, 3.0], [14.5, 1.62, 2.92], [15.4, 1.0, 2.75], [16, 0.3, 2.62],
];
const ring = ([, r, zc]) => circle2(r, N, 0, zc); // vertices every 30 degrees from the side

// An airfoil ring in the x-z plane at y, counter-clockwise seen from +y.
const foilXZ = (xLE, c, y, zc, t) => [[xLE, y, zc], [xLE - 0.25 * c, y, zc - 0.35 * t], [xLE - 0.7 * c, y, zc - 0.2 * t],
  [xLE - c, y, zc + 0.02], [xLE - 0.7 * c, y, zc + 0.45 * t], [xLE - 0.25 * c, y, zc + 0.65 * t]];
// An airfoil ring in the x-y plane at z, counter-clockwise seen from above.
const foilXY = (xLE, c, z, t) => [[xLE, 0, z], [xLE - 0.25 * c, 0.5 * t, z], [xLE - 0.7 * c, 0.3 * t, z],
  [xLE - c, 0, z], [xLE - 0.7 * c, -0.3 * t, z], [xLE - 0.25 * c, -0.5 * t, z]];

function nacelle(y) {
  const zc = 0.95, s = (x, r) => [x, circle2(r, 12, y, zc)];
  return group(
    hull([s(0.9, 0.55), s(1.8, 0.86), s(5.0, 0.98), s(6.4, 0.95)], 'paper', { capTone: 'ink' }),
    box(3.0, 0.3, 1.75, 2.3, 'paper', { cx: 3.4, cy: y }), // pylon
  );
}

export default () => {
  const p = [];
  const fus = FUS.map((s) => [s[0], ring(s)]);
  p.push(hull(fus, 'paper'));
  // Cockpit band: dark panels on the upper faces of the nose between two stations.
  const A = fus[5][1], B = fus[6][1], x0 = fus[5][0], x1 = fus[6][0];
  for (let i = 1; i <= 4; i++) {
    const j = i + 1;
    p.push(skin([[x0, ...A[i]], [x0, ...A[j]], [x1, ...B[j]], [x1, ...B[i]]], 'glass', 0.03));
  }
  // Wings: low, swept 27 degrees, 5 degrees of dihedral.
  const wing = loft([foilXZ(4.6, 8.2, 1.4, 1.75, 0.95), foilXZ(-2.4, 2.2, 15.2, 2.95, 0.26)], 'paper');
  p.push(wing, wing.mirrorY());
  const eng = nacelle(5.6);
  p.push(eng, eng.mirrorY());
  // Tailplane.
  const stab = loft([foilXZ(-10.6, 3.8, 0.6, 4.45, 0.4), foilXZ(-13.9, 1.5, 6.2, 4.95, 0.14)], 'paper');
  p.push(stab, stab.mirrorY());
  // Fin: the red accent.
  p.push(loft([foilXY(-8.6, 6.6, 4.8, 0.55), foilXY(-14.1, 2.5, 11.0, 0.22)], 'red'));
  return group(p);
};
