// A bicycle with a rider: two thin hoops, a diamond frame, the rider leaning to the bars with one pedal forward.
// The frame is the red accent; wheels are ink hoops so the two circles read at map size.
import { group } from '../lib/mesh.mjs';
import { bar, box } from '../lib/parts.mjs';
import { hoop, person } from './_road.mjs';

export const meta = { name: 'bike', kind: 'vehicle', modes: ['bike'], label: 'Bike', px: 36 };

const R = 0.34, RA = [-0.52, 0, R], FA = [0.56, 0, R], BB = [-0.08, 0, 0.3];
const ST = [-0.24, 0, 0.84], HT = [0.4, 0, 0.88], HB = [0.45, 0, 0.7];
const F = 0.06; // frame tube

export default () => {
  const p = [];
  // Wheels: ink hoops with a small hub.
  for (const a of [RA, FA]) p.push(hoop(R - 0.03, 0.06, 0.05, a[0], 0, a[2], 'ink', 18), box(0.08, 0.12, a[2] - 0.04, a[2] + 0.04, 'ink2', { cx: a[0] }));
  // Frame: top, down and seat tubes; stays and fork in pairs.
  p.push(bar(ST, HT, F, 'red'), bar(BB, HB, F, 'red'), bar(BB, [ST[0] - 0.02, 0, ST[2] + 0.06], F, 'red'), bar(HB, HT, F, 'red'));
  for (const s of [1, -1]) {
    const ra = [RA[0], s * 0.06, RA[2]], fa = [FA[0], s * 0.06, FA[2]];
    p.push(bar([BB[0], s * 0.04, BB[2]], ra, 0.045, 'red'), bar([ST[0], s * 0.03, ST[2]], ra, 0.045, 'red'), bar([HB[0], s * 0.04, HB[2]], fa, 0.045, 'red'));
  }
  // Saddle, stem and bars, cranks and pedals.
  p.push(box(0.26, 0.12, ST[2] + 0.06, ST[2] + 0.11, 'ink', { cx: ST[0] - 0.03 }));
  p.push(bar(HT, [0.42, 0, 0.98], 0.05, 'ink'), box(0.06, 0.5, 0.95, 1.0, 'ink', { cx: 0.44 }));
  p.push(bar([BB[0], 0.08, BB[2]], [BB[0] + 0.15, 0.08, BB[2] + 0.05], 0.04, 'ink'), bar([BB[0], -0.08, BB[2]], [BB[0] - 0.15, -0.08, BB[2] - 0.05], 0.04, 'ink'));
  // Rider: seated, leaning forward, hands on the bars, left foot forward on its pedal.
  p.push(person({
    legs: [
      [[-0.25, 0.12, 0.98], [0.12, 0.13, 0.76], [BB[0] + 0.15, 0.13, BB[2] + 0.08]],
      [[-0.25, -0.12, 0.98], [0.0, -0.13, 0.66], [BB[0] - 0.15, -0.13, BB[2] + 0.0]],
    ],
    arms: [
      [[0.12, 0.2, 1.36], [0.3, 0.22, 1.16], [0.44, 0.22, 1.0]],
      [[0.12, -0.2, 1.36], [0.3, -0.22, 1.16], [0.44, -0.22, 1.0]],
    ],
    torso: { at: [-0.25, 0, 0.94], w: 0.34, d: 0.2, h: 0.54, lean: 50 },
    head: [0.24, 0, 1.52], headR: 0.14,
  }, { hair: 'ink', limbW: 0.13 }));
  return group(p);
};
