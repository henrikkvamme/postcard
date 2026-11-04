// The Frauenkirche, Munich: two square towers that turn octagonal near the top and end in round green
// copper caps, and behind them the huge steep roof over the long hall church with its tall narrow windows.
// Red: the great tiled roof.
import { group, box, block, spire, cyl, lathe, rect2, circle2, Mesh, plinth, onFace, arch2 } from './_l3.mjs';

export const meta = { name: 'munich', kind: 'landmark', place: 'Munich', lng: 11.5736, lat: 48.1386, label: 'Frauenkirche', px: 100 };

const HW = 20, EAVE = 34, RIDGE = 62;      // half width of the hall, eaves and ridge heights
const XW = -40, XE = 36;                   // the hall's west end and where the east apse begins
const TS = 15, TX = -46, TY = 12.5;        // tower side, tower centre x and |y|
const SQ = 64, OCT = 84;                   // where the tower turns octagonal, and where the cap starts

// The roof: two long slopes, a hipped end over the five-sided apse, a gable at the west.
function roof() {
  const m = new Mesh(), r0 = [XE, 0, RIDGE], w0 = [XW, 0, RIDGE];
  const apse = Array.from({ length: 5 }, (_, i) => { const t = -Math.PI / 2 + (i / 4) * Math.PI; return [XE + HW * Math.cos(t), HW * Math.sin(t), EAVE]; });
  m.face([[XW, -HW, EAVE], [XE, -HW, EAVE], r0, w0], 'red');
  m.face([[XE, HW, EAVE], [XW, HW, EAVE], w0, r0], 'red');
  for (let i = 0; i < 4; i++) m.face([apse[i], apse[i + 1], r0], 'red');
  m.face([[XW, HW, EAVE], [XW, -HW, EAVE], w0], 'paper');
  return m;
}

function tower(cy) {
  const parts = [], oct = (r) => circle2(r, 8, TX, cy, Math.PI / 8);
  parts.push(box(TS, TS, 0, SQ, 'paper', { cx: TX, cy }));
  for (const z of [EAVE, 50]) parts.push(box(TS + 0.6, TS + 0.6, z - 0.8, z, 'cream', { cx: TX, cy }));
  parts.push(box(TS + 0.8, TS + 0.8, SQ - 1, SQ, 'cream', { cx: TX, cy, top: 'cream' }));
  // Slit windows up the shaft, belfry windows in the octagon.
  for (const z0 of [40, 53]) for (const side of ['+x', '-x', '+y', '-y'])
    parts.push(onFace(arch2(2.4, 8, { z0, pointed: 0.4 }), side, TS / 2, 0.12, 'ink2').move(TX, cy, 0));
  const r = TS / 2 / Math.cos(Math.PI / 8) * 0.88;
  parts.push(block(oct(r), SQ, OCT, 'paper'));
  for (let i = 0; i < 8; i += 2) parts.push(onFace(arch2(2.2, 9, { z0: SQ + 5, pointed: 0.4 }), '+x', r * Math.cos(Math.PI / 8), 0.12, 'ink2').turn('z', i * 45).move(TX, cy, 0));
  parts.push(cyl(r + 0.5, r + 0.5, OCT - 0.8, OCT, 'cream', { n: 8, cx: TX, cy, phase: Math.PI / 8 }));
  // The Welsche Haube: a round copper cap with a small lantern and a gilt ball.
  parts.push(lathe([[r + 0.3, OCT], [r + 1.0, OCT + 2.2], [r + 0.6, OCT + 4.5], [r - 1.2, OCT + 7], [3.6, OCT + 9], [1.9, OCT + 10.3], [1.6, OCT + 10.4]], 'green', { n: 8, cx: TX, cy, phase: Math.PI / 8 }));
  parts.push(cyl(1.6, 1.6, OCT + 10.4, OCT + 12.4, 'paper', { n: 8, cx: TX, cy }));
  parts.push(lathe([[1.9, OCT + 12.4], [0.6, OCT + 14.2], [0.01, OCT + 14.6]], 'green', { n: 8, cx: TX, cy }));
  parts.push(cyl(0.18, 0.18, OCT + 14.4, OCT + 15.4, 'brass', { n: 4, cx: TX, cy }));
  return group(parts);
}

export default () => {
  const plan = [[XW, -HW], ...Array.from({ length: 5 }, (_, i) => { const t = -Math.PI / 2 + (i / 4) * Math.PI; return [XE + HW * Math.cos(t), HW * Math.sin(t)]; }), [XW, HW]];
  const parts = [plinth(rect2(126, 56, -6, 0), 1.4)];
  parts.push(block(plan, 0, EAVE, 'paper'), roof());
  // Tall narrow windows along both long walls and round the apse.
  for (let x = XW + 9; x < XE; x += 9.5) for (const side of ['+y', '-y']) parts.push(onFace(arch2(2.6, 21, { z0: 7, pointed: 0.4 }), side, HW, 0.12, 'ink2', x));
  for (const a of [-45, 0, 45]) parts.push(onFace(arch2(2.6, 21, { z0: 7, pointed: 0.4 }), '+x', HW * Math.cos(Math.PI / 8), 0.12, 'ink2').turn('z', a).move(XE, 0, 0));
  // The two towers and the recessed bay between them with the west door.
  parts.push(tower(TY), tower(-TY));
  parts.push(box(TS - 3, 2 * TY - TS + 0.2, 0, EAVE + 4, 'paper', { cx: TX + 1.5 }));
  parts.push(onFace(arch2(4.4, 10, { pointed: 0.4 }), '-x', -(TX + 1.5 - (TS - 3) / 2), 0.15, 'ink2'));
  parts.push(onFace(arch2(4, 14, { z0: 15, pointed: 0.4 }), '-x', -(TX + 1.5 - (TS - 3) / 2), 0.15, 'ink2'));
  return group(parts);
};
