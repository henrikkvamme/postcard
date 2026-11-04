// Write a baked mesh as a binary glTF (.glb), with no dependencies.
// The world frame (x forward, y left, z up) becomes glTF's (x forward, y up, z right): (x, z, -y).
// Faces carry their baked tones as unlit material colours, one primitive per colour, so the look does
// not depend on the renderer's lights. Ink lines are a second primitive in LINES mode.
import { writeFileSync } from 'node:fs';
import { bake } from './mesh.mjs';

const linear = (c) => c.map((v, i) => i === 3 ? v : v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const INK = linear([0.114, 0.165, 0.290, 1]);

export function toGlb(mesh, { lines = true, crease } = {}) {
  const b = bake(mesh, { crease });
  const conv = (a) => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i += 3) { o[i] = a[i]; o[i + 1] = a[i + 2]; o[i + 2] = -a[i + 1]; } return o; };
  const lin = conv(b.lines);
  const views = [], accessors = [], chunks = [];
  let off = 0;
  const push = (arr, type, target) => {
    const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const pad = (4 - (bytes.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: off, byteLength: bytes.length, target });
    chunks.push(bytes, Buffer.alloc(pad)); off += bytes.length + pad;
    const n = type === 'VEC3' ? 3 : 4, count = arr.length / n;
    const acc = { bufferView: views.length - 1, componentType: 5126, count, type };
    if (type === 'VEC3' && count) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], arr[i + k]); hi[k] = Math.max(hi[k], arr[i + k]); }
      acc.min = lo; acc.max = hi;
    }
    accessors.push(acc); return accessors.length - 1;
  };
  const prims = [], materials = [];
  for (const g of b.groups) {
    const P = push(conv(g.pos), 'VEC3', 34962), N = push(conv(g.nor), 'VEC3', 34962);
    prims.push({ attributes: { POSITION: P, NORMAL: N }, material: materials.length, mode: 4 });
    // glTF colour factors are linear; the renderer encodes to sRGB on output.
    materials.push({ pbrMetallicRoughness: { baseColorFactor: linear(g.color), metallicFactor: 0, roughnessFactor: 1 }, extensions: { KHR_materials_unlit: {} } });
  }
  let tris = 0; for (const g of b.groups) tris += g.pos.length / 9;
  if (lines && lin.length) {
    const LP = push(lin, 'VEC3', 34962);
    prims.push({ attributes: { POSITION: LP }, material: materials.length, mode: 1 });
    materials.push({ name: 'ink', pbrMetallicRoughness: { baseColorFactor: INK, metallicFactor: 0, roughnessFactor: 1 }, extensions: { KHR_materials_unlit: {} } });
  }
  const json = {
    asset: { version: '2.0', generator: 'postcard models' },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'model' }],
    meshes: [{ primitives: prims }], materials, accessors, bufferViews: views,
    buffers: [{ byteLength: off }],
  };
  const bin = Buffer.concat(chunks);
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return { glb: Buffer.concat([head, jh, js, bh, bin]), tris, lines: b.lines.length / 6 };
}

export function writeGlb(path, mesh, opts) { const r = toGlb(mesh, opts); writeFileSync(path, r.glb); return r; }
