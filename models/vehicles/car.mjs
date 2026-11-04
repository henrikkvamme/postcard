// Small family car: a five-door hatchback at toy length. Paper body, a dark glass cabin with paper pillars,
// wheels in dark arches. The roof is the red accent, so the car reads from above as well as from the side.
import { smallCar } from './_road.mjs';

export const meta = { name: 'car', kind: 'vehicle', modes: ['car'], label: 'Car', px: 48 };

export default () => smallCar({ roof: 'red' });
