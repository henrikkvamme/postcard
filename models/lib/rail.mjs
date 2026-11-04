// Shared rail parts: car bodies, noses, bogies, pantographs, window bands. Metres, x forward.
import { group } from './mesh.mjs';
import { hull, section, box, wheel, bar, cyl } from './parts.mjs';

// A car body from x0 to x1: width w, height h above floor z0, roof radius r.
export const carBody = (x0, x1, { w = 2.9, h = 3.0, r = 0.7, z0 = 0.9, tone = 'paper' } = {}) =>
  hull([[x0, section(w, h, r, z0)], [x1, section(w, h, r, z0)]], tone);

// A nose from x0 (full section) to x0 + len, sloping down to a low point: k sections along a curve.
export function nose(x0, len, { w = 2.9, h = 3.0, r = 0.7, z0 = 0.9, tip = 0.35, k = 6, tone = 'paper', dir = 1 } = {}) {
  const secs = [];
  for (let i = 0; i <= k; i++) {
    const t = i / k, e = 1 - Math.pow(t, 1.7);            // height falls off fast at the end
    const ww = w * (1 - 0.55 * t * t), hh = Math.max(tip, h * e);
    secs.push([x0 + dir * len * t, section(ww, hh, Math.min(r, hh / 2 - 0.01, ww / 2 - 0.01), z0)]);
  }
  return dir > 0 ? hull(secs, tone) : hull(secs.reverse(), tone);
}

// A band of windows along one side (y = side), as thin dark plates proud of the body.
export function windows(x0, x1, { side, z = 2.4, h = 0.8, w = 1.1, gap = 0.5, tone = 'glass', d = 0.04 } = {}) {
  const out = [], n = Math.floor((x1 - x0 + gap) / (w + gap)), pad = (x1 - x0 - (n * w + (n - 1) * gap)) / 2;
  for (let i = 0; i < n; i++) { const x = x0 + pad + i * (w + gap) + w / 2;
    out.push(box(w, d, z - h / 2, z + h / 2, tone, { cx: x, cy: side })); }
  return group(out);
}

// A stripe along the side, as a thin plate.
export const stripe = (x0, x1, { side, z = 1.3, h = 0.22, tone = 'red', d = 0.03 } = {}) =>
  box(x1 - x0, d, z - h / 2, z + h / 2, tone, { cx: (x0 + x1) / 2, cy: side });

// A two-axle bogie centred at x: frame and four wheels.
export const bogie = (x, { gauge = 1.435, r = 0.46, base = 2.6 } = {}) => group(
  box(base + 0.6, gauge + 0.3, 0.45, 0.85, 'ink2', { cx: x }),
  ...[-1, 1].flatMap((sx) => [-1, 1].map((sy) => wheel(r, 0.14, x + sx * base / 2, sy * (gauge / 2 + 0.12), r, 'ink', 10))),
);

// A pantograph on the roof at x: a base, a folded arm and a bow.
export const pantograph = (x, zRoof) => group(
  box(1.2, 1.0, zRoof, zRoof + 0.18, 'ink2', { cx: x }),
  bar([x - 0.5, 0, zRoof + 0.18], [x + 0.4, 0, zRoof + 0.9], 0.07, 'ink'),
  bar([x + 0.4, 0, zRoof + 0.9], [x - 0.1, 0, zRoof + 1.5], 0.06, 'ink'),
  box(0.12, 1.7, zRoof + 1.5, zRoof + 1.58, 'ink', { cx: x - 0.1 }),
);

// Rails under a train from x0 to x1, with sleepers: the vehicle reads as rail at a glance.
export const track = (x0, x1, { gauge = 1.435 } = {}) => {
  const out = [];
  for (const sy of [-1, 1]) out.push(box(x1 - x0, 0.08, 0, 0.12, 'slate', { cx: (x0 + x1) / 2, cy: sy * gauge / 2 }));
  for (let x = x0 + 0.4; x < x1; x += 1.6) out.push(box(0.25, gauge + 0.7, -0.02, 0.04, 'stone', { cx: x }));
  return group(out);
};

// A gangway between two cars: a short dark bellows.
export const gangway = (x, { w = 2.3, h = 2.6, z0 = 1.0 } = {}) => box(0.6, w, z0, z0 + h, 'ink2', { cx: x });

export const lamp = (x, y, z) => cyl(0.12, 0.12, -0.03, 0.03, 'cream', { n: 8 }).turn('y', 90).move(x, y, z);
