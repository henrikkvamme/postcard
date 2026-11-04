// Build every model in models/vehicles and models/landmarks into the kit's art/3d folder.
// node models/build.mjs [name ...]
import { readdirSync, mkdirSync, writeFileSync, readFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGlb } from './lib/glb.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../plugins/postcard/skills/postcard/kit/art/3d');
mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);
// With names, only those are built and their entries merged into the index; parallel builders each build their own.
let old = []; try { old = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8')); } catch {}
const index = [];
for (const dir of ['vehicles', 'landmarks']) {
  for (const f of readdirSync(join(here, dir)).filter((f) => f.endsWith('.mjs')).sort()) {
    const mod = await import(join(here, dir, f));
    const meta = { ...mod.meta, name: mod.meta?.name || f.replace('.mjs', '') };
    if (meta.kind === 'test' && !only.includes(meta.name)) continue;
    if (only.length && !only.includes(meta.name)) { index.push(old.find((m) => m.name === meta.name) || meta); continue; }
    // Every model stands on z = 0, centred on its footprint, so the map anchor is its middle.
    const raw = mod.default(), b0 = raw.bounds();
    const mesh = raw.move(-(b0.lo[0] + b0.hi[0]) / 2, -(b0.lo[1] + b0.hi[1]) / 2, -b0.lo[2]);
    const { lo, hi } = mesh.bounds();
    const r = writeGlb(join(out, meta.name + '.glb'), mesh);
    Object.assign(meta, { size: hi.map((v, k) => +(v - lo[k]).toFixed(2)), tris: r.tris });
    index.push(meta);
    console.log(meta.name.padEnd(18), String(r.tris).padStart(6), 'tris', String(r.lines).padStart(5), 'lines', meta.size.join(' x '), 'm');
  }
}
const tmp = join(out, `.index.${process.pid}.json`);
writeFileSync(tmp, JSON.stringify(index.filter((m) => m.kind !== 'test'), null, 1) + '\n'); renameSync(tmp, join(out, 'index.json'));
