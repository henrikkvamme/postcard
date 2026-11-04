// node models/tests.mjs: every face of every model points outward from its own part, and models stay in budget.
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from './lib/parts.mjs';
import { faceNormal } from './lib/mesh.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let fail = 0;
const out = (m) => { const { lo, hi } = m.bounds(), c = lo.map((v, k) => (v + hi[k]) / 2);
  return m.faces.filter((f) => { const n = faceNormal(f.pts), p = f.pts.reduce((a, q) => a.map((v, k) => v + q[k] / f.pts.length), [0, 0, 0]);
    return (p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1] + (p[2] - c[2]) * n[2] < -1e-9; }).length; };
const parts = { box: P.box(2, 1, 0, 1, 'paper'), bevel: P.block(P.chamfer2(3, 2, .3), 0, 2, 'paper', { bevel: .2 }), cyl: P.cyl(1, .5, 0, 2, 'paper'),
  hull: P.hull([[0, P.section(2, 2, .5)], [5, P.section(2, 2, .5)]], 'paper'), lathe: P.lathe([[1, 0], [1, 1], [0, 2]], 'paper'), wheel: P.wheel(1, .2, 0, 0, 0),
  gable: P.gable(4, 2, 0, 1, 'paper'), spire: P.spire(P.rect2(2, 2), 0, 2, 'paper'), dome: P.dome(1, 0, 'paper'), bar: P.bar([0, 0, 0], [3, 1, 2], .2, 'ink'),
  mirrored: P.box(2, 1, 0, 1, 'paper').scale(1, -1, 1) };
for (const [k, m] of Object.entries(parts)) { const n = out(m); if (n) { fail++; console.log('FAIL', k, n, 'faces point inward'); } }
const dir = join(here, '../plugins/postcard/skills/postcard/kit/art/3d');
for (const f of readdirSync(dir).filter((f) => f.endsWith('.glb'))) {
  const kb = statSync(join(dir, f)).size / 1024, max = f.startsWith('airplane') ? 1400 : 300;
  if (kb > max) { fail++; console.log('FAIL', f, kb.toFixed(0), 'KB over', max); }
}
console.log(fail ? `${fail} failed` : 'ok');
process.exit(fail ? 1 : 0);
