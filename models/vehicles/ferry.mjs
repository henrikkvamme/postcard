// Car and passenger ferry: a navy hull with a paper car deck above it, stepped passenger decks with wrap-around
// window bands, a bridge with wings across the full beam, lifeboats along the upper deck, a stern ramp,
// and one raked funnel with the red band under a navy top.
import { group } from '../lib/mesh.mjs';
import { loft, block, box, chamfer2, hull, section, bar, inset, ringAt } from '../lib/parts.mjs';
import { retone } from './_road.mjs';

export const meta = { name: 'ferry', kind: 'vehicle', modes: ['ferry'], label: 'Ferry', px: 92 };

const ZW = 3.0, ZD = 6.4; // boot top (navy below) and main deck

// Hull stations: x, bottom half-width, waterline half-width, deck half-width, keel z, deck z.
const ST = [
  [-23, 3.6, 5.1, 5.2, 1.4, ZD],
  [-21.5, 4.2, 5.5, 5.5, 0.4, ZD],
  [-18, 4.4, 5.5, 5.5, 0, ZD],
  [11, 4.4, 5.5, 5.5, 0, ZD],
  [15.5, 3.8, 5.2, 5.4, 0.15, ZD + 0.15],
  [19.5, 2.2, 3.8, 4.4, 0.8, ZD + 0.4],
  [22, 0.6, 1.8, 2.6, 1.8, ZD + 0.65],
  [23.4, 0.1, 0.25, 0.7, 2.6, ZD + 0.8],
];

function shipHull() {
  const lower = ST.map(([x, b, bw, , z0]) => [x, [[-Math.min(b, bw), z0], [Math.min(b, bw), z0], [bw, ZW], [-bw, ZW]]]);
  const upper = ST.map(([x, , bw, bd, , zd]) => [x, [[-bw, ZW], [bw, ZW], [bd, zd], [-bd, zd]]]);
  // The deck (upward faces of the upper hull) is stone, like planking seen from above.
  return group(hull(lower, 'ink'), retone(hull(upper, 'paper'), (n) => n[2] > 0.8, 'stone'));
}

// A deck tier: a paper wall, a glass band set in a little, and a paper cap that overhangs.
function tier(plan, z0, zg0, zg1, z1) {
  return group(
    block(plan, z0, zg0, 'paper'),
    block(inset(plan, 0.12), zg0, zg1, 'glass'),
    block(plan, zg1, z1, 'paper', { bevel: 0.12 }),
  );
}

// A lifeboat: a short rounded hull with a paper canopy.
function lifeboat(x, y, z) {
  const s = (w, h, r, z0, xx) => [xx, section(w, h, r, z0)];
  return group(
    hull([s(0.5, 0.5, 0.2, z + 0.3, x - 2.2), s(1.5, 0.9, 0.35, z, x - 1.6), s(1.5, 0.9, 0.35, z, x + 1.6), s(0.5, 0.5, 0.2, z + 0.3, x + 2.2)], 'brass').move(0, y, 0),
    hull([s(1.0, 0.5, 0.24, z + 0.8, x - 1.5), s(1.2, 0.55, 0.26, z + 0.8, x + 1.5)], 'paper').move(0, y, 0),
  );
}

// Funnel: a chamfered stack raked aft, built in bands.
function funnel(cx, z0) {
  const ring = (z) => ringAt(chamfer2(4.6, 3.3, 1.0, cx - (z - z0) * 0.28, 0), z);
  const band = (a, b, tone) => loft([ring(a), ring(b)], tone);
  return group(band(z0, z0 + 3.6, 'paper'), band(z0 + 3.6, z0 + 4.7, 'red'), band(z0 + 4.7, z0 + 5.6, 'ink'));
}

export default () => {
  const p = [shipHull()];
  // Stern ramp, folded up against the transom.
  p.push(box(0.1, 6.5, 2.4, 6.0, 'slate', { cx: -23.05 }));
  // Passenger decks, stepped back at the front.
  p.push(tier(chamfer2(36, 10.6, 1.6, -2.5), ZD, ZD + 1.1, ZD + 2.1, ZD + 2.7));
  const T2 = ZD + 2.7;
  p.push(tier(chamfer2(28, 8.8, 1.8, -3.5), T2, T2 + 0.5, T2 + 1.5, T2 + 2.1));
  const T3 = T2 + 2.1;
  // Bridge: a narrower house forward, with wings across the full beam, and a mast.
  p.push(tier(chamfer2(8, 7.6, 1.4, 6.2), T3, T3 + 0.4, T3 + 1.5, T3 + 2.0));
  p.push(block(chamfer2(2.2, 12.4, 0.3, 8.6), T3 + 0.5, T3 + 1.7, 'paper', { bevel: 0.1 }));
  p.push(box(0.04, 11.8, T3 + 0.9, T3 + 1.45, 'glass', { cx: 9.71 }));
  p.push(bar([5, 0, T3 + 2.0], [4.4, 0, T3 + 4.6], 0.24, 'ink'));
  // Lifeboats along both sides of the upper deck.
  for (const x of [-12.5, -7.5, -2.5]) for (const s of [1, -1]) p.push(lifeboat(x, s * 4.9, T2 + 0.15));
  p.push(funnel(-11.5, T3));
  return group(p);
};
