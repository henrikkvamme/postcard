// Dom Luís I bridge, Porto: one wrought-iron arch across the Douro gorge carrying two decks. The upper deck
// rides on the crown of the arch and on iron piers up the granite banks; the lower deck hangs from the
// arch just above the river. Shortened approaches, true arch proportions. The red accent is a metro car.
import { group } from '../lib/mesh.mjs';
import { box, plate, bar } from '../lib/parts.mjs';
import { plinth } from './_l4.mjs';

export const meta = { name: 'porto', kind: 'landmark', place: 'Porto', lng: -8.6094, lat: 41.1400, label: 'Dom Luís I Bridge', px: 112 };

const B = 0.8, Z0 = 3, A = 72, Bo = 75, HL = 38, HU = 42;  // springing height, inner/outer half span, rises
const UP = Z0 + HU, LOW = 10, RY = 4.2, END = 112;          // upper deck underside, lower deck, rib offset
const zl = (x) => Z0 + HL * (1 - (x / A) ** 2);            // lower chord
const zu = (x) => Z0 + HU * (1 - (x / Bo) ** 2);            // upper chord
// The bank: [x, z] from the river edge up to the cliff top where the upper deck lands.
const BANK = [[70, B], [END + 6, B], [END + 6, UP - 8], [END, UP + 2.5], [104, UP + 2.5], [94, 36], [86, 22], [79, 11], [74, 5]];
const zb = (x) => { for (let i = 4; i < BANK.length - 1; i++) { const [x0, z0] = BANK[i], [x1, z1] = BANK[i + 1]; if (x <= x0 && x >= x1) return z1 + (z0 - z1) * (x - x1) / (x0 - x1); } return B; };

export default () => {
  const K = 24, rib = [];
  for (let i = 0; i <= K; i++) { const x = -A + (2 * A * i) / K; rib.push([x, zl(x)]); }
  for (let i = 0; i <= K; i++) { const x = Bo - (2 * Bo * i) / K; rib.push([x, zu(x)]); }
  const parts = [
    plinth(2 * END + 16, 26, { h: B }),
    box(2 * 70, 24, B, B + 0.2, 'glass'),                                        // the Douro
    ...[1, -1].map((s) => plate(BANK, 11, 22, 'stone').scale(s, 1, 1)),           // granite banks
    ...[1, -1].map((s) => box(8, 13, B, Z0 + 0.6, 'stone', { cx: s * 73.5 })),      // abutments at the springings
    // The two arch ribs: crescents, deepest at the crown, closing to hinges at the springings.
    ...[RY, -RY].map((y) => plate(rib, y + 0.6, 1.2, 'ink2')),
    // Upper deck, and the lower deck between the banks.
    box(2 * END, 9, UP, UP + 2.4, 'ink2', { top: 'mist' }),
    box(2 * 80, 8, LOW, LOW + 1.6, 'ink2', { top: 'mist' }),
    // The metro car on top.
    box(15, 2.6, UP + 2.4, UP + 5.4, 'red', { cx: 22, bevel: 0.3 }),
  ];
  for (const s of [1, -1]) for (const y of [RY, -RY]) {
    // Posts from the arch up to the upper deck.
    for (const x of [16, 28, 40, 52, 63]) parts.push(bar([s * x, y, zu(x) - 0.5], [s * x, y, UP], 0.7, 'ink2'));
    // Hangers from the arch down to the lower deck.
    for (const x of [0, 10, 20, 30, 40, 50].filter((x) => s > 0 || x > 0)) parts.push(bar([s * x, y, LOW + 1.6], [s * x, y, zl(x) + 0.2], 0.35, 'ink2'));
    // Iron piers up the banks: splayed legs to the upper deck.
    for (const x of [84, 96]) parts.push(bar([s * x, y * 1.5, zb(x) - 0.5], [s * x, y, UP], 1.3, 'ink2'));
  }
  for (const s of [1, -1]) {
    for (const x of [84, 96]) parts.push(box(1.2, 2 * RY + 1, UP - 3, UP - 1.8, 'ink2', { cx: s * x }));
    // Granite pylons where the lower deck meets the bank.
    for (const y of [5.4, -5.4]) parts.push(box(3.6, 2.6, zb(77) - 0.5, LOW + 8, 'stone', { cx: s * 77, cy: y, bevel: 0.3 }));
    // Bracing between the ribs, under the arch.
    for (const x of [0, 18, 36, 54]) parts.push(bar([s * x, RY, zl(x) + 0.4], [s * x, -RY, zl(x) + 0.4], 0.5, 'ink2'));
  }
  return group(parts);
};
