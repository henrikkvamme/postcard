// Hotel Negresco, Nice: a white Belle Époque front on the Promenade des Anglais, a slate mansard with
// dormers, and the round corner tower under its pink dome and lantern. One palm on the promenade.
// The red accent is the dome.
import { group } from '../lib/mesh.mjs';
import { box, cyl, dome, loft, ringAt, rect2, gable, lathe } from '../lib/parts.mjs';
import { plinth, onFace, palm, ball } from './_l4.mjs';

export const meta = { name: 'nice', kind: 'landmark', place: 'Nice', lng: 7.2580, lat: 43.6947, label: 'Hotel Negresco', px: 88 };

const B = 0.8, DX = 16, WY = 56, CORN = 26, MANS = 31.5;   // block depth (x), width (y), cornice, mansard top
const RX = 1, RY = WY / 2 - 1, R = 7.2;                    // corner rotunda

export default () => {
  const fx = DX / 2, parts = [
    plinth(DX + 22, WY + 12, { h: B, cx: 6, cy: 2 }),
    box(DX, WY, B, CORN, 'paper', { bevel: 0.1 }),
    box(DX + 0.6, WY + 0.6, CORN - 0.9, CORN, 'cream'),            // cornice
    // Mansard: a sloped band of slate, flat on top.
    loft([ringAt(rect2(DX, WY), CORN), ringAt(rect2(DX - 5, WY - 5), MANS)], 'slate', { caps: [false, true], capTone: 'slate' }),
    // Balcony band on the first floor and the ground-floor arcade line.
    box(0.8, WY - 2, 7.5, 8.1, 'ink2', { cx: fx + 0.4 }),
    box(0.3, WY, B, 4.6, 'cream', { cx: fx + 0.15 }),
    // Rotunda and dome.
    cyl(R, R, B, CORN + 2, 'paper', { n: 16, cx: RX, cy: RY }),
    cyl(R + 0.4, R + 0.4, CORN + 1.1, CORN + 2, 'cream', { n: 16, cx: RX, cy: RY }),
    lathe([[R, CORN + 2], [R - 0.2, CORN + 5.5], [R - 1.6, CORN + 9], [R - 3.6, CORN + 11.6], [1.4, CORN + 12.6]], 'red', { n: 16, cx: RX, cy: RY }),
    cyl(1.4, 1.4, CORN + 12.6, CORN + 15, 'paper', { n: 8, cx: RX, cy: RY }),
    dome(1.6, CORN + 15, 'red', { n: 8, k: 3, cx: RX, cy: RY }),
    ball(0.4, RX, RY, CORN + 17, 'brass', { n: 6, k: 3 }),
    palm(fx + 9, -12, 13),
  ];
  // Tall window bays on the front and the far side: one dark strip per bay.
  for (const side of ['+x', '-x']) for (let u = -WY / 2 + 3.5; u <= RY - R - 1.5; u += 4.6) {
    const bay = onFace([[u - 0.8, 9.2], [u + 0.8, 9.2], [u + 0.8, CORN - 2.2], [u - 0.8, CORN - 2.2]], side, fx, 0.08, 'glass');
    parts.push(side === '+x' ? bay.mirrorY() : bay);
  }
  for (const u of [-4.5, 0, 4.5]) parts.push(onFace([[u - 0.8, 9.2], [u + 0.8, 9.2], [u + 0.8, CORN - 2.2], [u - 0.8, CORN - 2.2]], '-y', WY / 2, 0.08, 'glass'));
  // Rotunda windows: strips around the drum.
  for (let i = 0; i < 16; i += 2) {
    const a = (i + 0.5) * Math.PI / 8;
    parts.push(box(0.12, 1.4, 9.2, CORN - 2.2, 'glass').turn('z', a * 180 / Math.PI).move(RX + (R + 0.02) * Math.cos(a), RY + (R + 0.02) * Math.sin(a), 0));
  }
  // Dormers on the front slope.
  for (const s of [1, -1]) for (let u = -WY / 2 + 4; u <= RY - R - 2; u += 6) parts.push(
    box(1.6, 2.0, CORN + 1.2, CORN + 3.6, 'paper', { cx: s * (fx - 1.4), cy: u }),
    gable(1.6, 2.0, CORN + 3.6, CORN + 4.6, 'slate', { end: 'paper' }).move(s * (fx - 1.4), u, 0));
  return group(parts);
};
