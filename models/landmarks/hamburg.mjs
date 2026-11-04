// Elbphilharmonie, Hamburg: the brick warehouse base, the dark band of the plaza, and the glass crown whose
// roof rises in waves to its highest peak over the pointed west end. The brick is the red accent.
import { Mesh, group } from '../lib/mesh.mjs';
import { loft, ringAt, block, inset } from '../lib/parts.mjs';
import { plinth } from './_l1.mjs';

export const meta = { name: 'hamburg', kind: 'landmark', place: 'Hamburg', lng: 9.9842, lat: 53.5413, label: 'Elbphilharmonie', px: 104 };

const Z0 = 0.8, BASE = 37, PLAZA = 40;
// Stations along the building (x, west is +x) with the roof height there: low in the east, rising in four
// waves with sharp crests and round troughs to the highest crest near the west end.
const wave = (x) => { const t = (x + 55) / 113; return 84 + 26 * t - 10 * Math.abs(Math.sin(Math.PI * (t * 3.6 + 0.1))); };
const ST = [...Array.from({ length: 29 }, (_, i) => -55 + i * 4), 38, 58].sort((a, b) => a - b).map((x) => [x, wave(x)]);
// Half width: full along the warehouse, drawing in to the blunt west point.
const half = (x) => (x <= 38 ? 18 : 18 - 12 * (x - 38) / 20);

// Plan ring: the south side going west, the west end, the north side coming back.
const plan = () => [...ST.map(([x]) => [x, -half(x)]), ...[...ST].reverse().map(([x]) => [x, half(x)])];
const zAt = (x) => ST.find((s) => s[0] === x)[1];

function crown() {
  const p = plan(), top = p.map(([x, y]) => [x, y, PLAZA + zAt(x) - BASE]);
  const m = loft([ringAt(p, PLAZA), top], 'mist', { caps: [true, false] });
  // The roof: strips between stations, each flat across the building, so every strip is planar.
  const roof = new Mesh(), n = ST.length;
  for (let i = 0; i + 1 < n; i++) {
    const a = top[i], b = top[i + 1], c = top[2 * n - 2 - i], d = top[2 * n - 1 - i];
    roof.face([a, b, c, d], 'paper');
  }
  // Three floor lines on the glass: the crown reads as a stack of storeys, not a blank block.
  for (const z of [PLAZA + 12, PLAZA + 24, PLAZA + 36]) for (let i = 0; i < p.length; i++) {
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
