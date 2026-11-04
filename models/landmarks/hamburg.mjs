// Elbphilharmonie, Hamburg: the glass crown is the subject. Its white roof rises in curved waves with
// sharp crests, from the low east end to the highest peak over the pointed west end. It stands on a dark
// band (the plaza) on top of the low brick warehouse. The brick is the red accent.
import { Mesh, group } from '../lib/mesh.mjs';
import { loft, ringAt, block, inset } from '../lib/parts.mjs';
import { plinth } from './_l1.mjs';

export const meta = { name: 'hamburg', kind: 'landmark', place: 'Hamburg', lng: 9.9842, lat: 53.5413, label: 'Elbphilharmonie', px: 104 };

const Z0 = 0.8, BASE = 24, PLAZA = 27;
// The roof crests along the building (x, west is +x) and their heights: each wave rises higher to the west.
const CRESTS = [[-55, 70], [-30, 80], [-4, 88], [24, 97], [52, 108]];
// Between two crests the roof sags in a curve; the crests stay sharp.
const wave = (x) => {
  if (x >= CRESTS[4][0]) return CRESTS[4][1] - (x - CRESTS[4][0]) * 0.9;
  const i = CRESTS.findIndex((c, k) => x >= c[0] && x <= CRESTS[k + 1][0]), [x0, z0] = CRESTS[i], [x1, z1] = CRESTS[i + 1];
  const t = (x - x0) / (x1 - x0); return z0 + (z1 - z0) * t - 15 * Math.sin(Math.PI * t) ** 1.4;
};
const ST = [...new Set([...Array.from({ length: 38 }, (_, i) => -55 + i * 3), ...CRESTS.map((c) => c[0]), 38, 58])]
  .filter((x) => x <= 58).sort((a, b) => a - b).map((x) => [x, wave(x)]);
// Half width: full along the warehouse, drawing in to the blunt west point.
const half = (x) => (x <= 38 ? 18 : 18 - 12 * (x - 38) / 20);

// Plan ring: the south side going west, the west end, the north side coming back.
const plan = () => [...ST.map(([x]) => [x, -half(x)]), ...[...ST].reverse().map(([x]) => [x, half(x)])];
const zAt = (x) => ST.find((s) => s[0] === x)[1];

function crown() {
  const p = plan(), top = p.map(([x, y]) => [x, y, zAt(x)]);
  const m = loft([ringAt(p, PLAZA), top], 'mist', { caps: [true, false] });
  // The roof: strips between stations, each flat across the building, so every strip is planar.
  const roof = new Mesh(), n = ST.length;
  for (let i = 0; i + 1 < n; i++) {
    const a = top[i], b = top[i + 1], c = top[2 * n - 2 - i], d = top[2 * n - 1 - i];
    roof.face([a, b, c, d], 'paper');
  }
  // Two floor lines on the glass: the crown reads as a stack of storeys, not a blank block.
  for (const z of [PLAZA + 13, PLAZA + 26]) for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length]; roof.line([a[0], a[1], z], [b[0], b[1], z]); }
  return group(m, roof);
}

export default () => {
  const p = plan();
  return group(
    plinth(132, 48, { h: Z0, cx: 1.5 }),
    group(
      block(p, 0, BASE, 'red'),                                            // the brick warehouse
      block(inset(p, 1.4), BASE, PLAZA, 'ink'),                            // the plaza between brick and glass
      crown(),
    ).move(0, 0, Z0),
  );
};
