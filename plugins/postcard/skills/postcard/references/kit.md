# The kit

The kit is the fixed part of every page: the chart, the trip model, time, the timeline, small HUD
parts and the checkout. Plain ES modules, no build step. `serve.py` serves them at `/kit/...` from
the skill, so a trip folder holds only `trip.json`, `index.html`, `app.js` and its own art or paths.

Do not edit the kit for one trip. When the kit cannot do what a page needs, write the part in the
page's `app.js`. When you find a kit bug, fix it in the skill and say so.

## index.html

Load the libraries as globals, then the kit CSS, then the page module. Copy the head from an
example:

```html
<script src="https://unpkg.com/d3@7.9.0/dist/d3.min.js"></script>
<script src="https://unpkg.com/topojson-client@3.1.0/dist/topojson-client.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/deck.gl@9.4.0/dist.min.js"></script>
<link rel="stylesheet" href="/kit/kit.css">
...
<script type="module" src="app.js"></script>
```

## trip.js: the model

```js
import { loadTrip, openTrip, MODES, ACCEPT, geo, along } from '/kit/trip.js';
const T = await openTrip(await loadTrip());       // ?trip=other.json loads another file
```

`T` holds:

| Field | What it is |
| --- | --- |
| `clock`, `T0`, `T1` | The clock (see time.js) and the window in hours. |
| `places[id]` | The place, plus `id` and `label` (city, else name). |
| `journeys`, `byId`, `groups[name]` | Normalized journeys, by id, and by group. |
| `deals` | Deals, each with `journeys: [ids]`. |
| `best(j, { accept, bags })` | The cheapest accepted offer, with `total` (bags priced in) and `bagsKnown`; null when nothing is accepted or the fare cannot carry the bags. |
| `bagExtra(offer, { cabin, checked })` | The bag cost: a number, `undefined` when not checked, `null` when not possible. |
| `price(journeys, opts)` | `{ total, split, deal, each }` for buying them together, or null. Uses a deal when cheaper. |
| `dealFor(ids, opts)` | The cheapest accepted deal for exactly these journeys. |
| `combos(groupNames, keep)` | Every chain of one journey per group in time order, kept when `keep(js)` is true. |
| `nights(out, back)` | Nights at the place, by local dates. |
| `whereAt(chain, T)` | Where the traveller is at hour T: `{ pt, head, moving, mode, seg, s, j, status }` or `{ pt, place, status }`. `status` is a short sentence like "On the train, SJ". |
| `money(n)` | "CHF 1,240". |

A normalized journey `j` has `dep`, `arr` (hours), `depL`, `arrL` (local `{ wd, day, mon, hm, date }`),
`segments` (each with `a`, `b`, `path`, `guessed`, `km`, `mode`), `transfers` (`{ at, next, a, b,
ground }`), `stops`, `moving` (hours in a vehicle), `offers`, `carrierName`, `warning`, `self` and
`raw` (the source object).

`ACCEPT` has `operator`, `rated` and `any`, each with `label`, `help` and `ok(offer)`.

## time.js

`makeClock(tz, start)` returns `H(iso, zone)` (wall time to hours), `local(T, zone)`, `abbr(zone, T)`,
`ms(T)`, `days(T0, T1)` and `shift(zoneA, zoneB, T)`. `fmtDur(h, { days })` gives "1h 35m" or
"2d 2h". All page arithmetic is in hours from `T0`; convert only to display.

## chart.js: the map

```js
import { createChart, INK, RED } from '/kit/chart.js';
const chart = createChart({ el: '#map', trip: T, pad: { left, right, top, bottom }, far: 2.6,
  onFar: (far) => {}, onReady: () => {}, onRouteHover: (hit) => {} });
chart.show({ chosen: [j1, j2], others: [...], ends: ['ZRH', 'HEL'] });
chart.where(T.whereAt([j1, j2], hour));   // put the vehicle on the route; null puts it back
```

| Call | Does |
| --- | --- |
| `show({ chosen, others, ends, refit })` | Chosen journeys in red with their vehicle; others thin and quiet; `ends` get big labels. Reframes when the chosen set changes. |
| `where(w)` | Moves the plane, train, bus, car, ferry or walker to `w` from `whereAt`. |
| `frame(journeys or points)` | Flies to fit them inside the padding. |
| `setPad(pad, { duration, refit })` | The part of the map that the HUD does not cover. Call it whenever the HUD changes size; a ResizeObserver on the card is the simple way. |
| `reset()`, `home()` | Back to the start view. |
| `over([lng, lat])` | "over France" or "over the Baltic Sea", for a status line. |
| `map` | The MapLibre map, for anything else. |

How it draws each mode: a plane on a great-circle arc with the 3D plane model; a train as a line
with ties; a car or taxi as a double line; a bus as a single line; a ferry as long dashes; a walk as
dots. Ground lines lie on the terrain. A ground segment without a path is a faint straight dash.
Labels are pins that hide by priority when they collide. Below zoom `far` the HUD steps aside
(`body.far`) and the globe shows; a click flies back to the route.

## timeline.js

```js
import { timeline } from '/kit/timeline.js';
const tl = timeline(svg, T, { rows: [{ label: 'Out', journeys }, ...], bands: [{ label: 'Event', spans: [{ a, b, kind: 'event' }], marks }],
  lead: (j) => `${j.carrierName} ${j.depL.hm}`, side: (j) => money, onPick, onHover, onTime, from, to, scale: 'auto' });
tl.paint({ chosen: new Set(ids), hover: id, dim: (j) => bool });
tl.cursor(hour, 'Over the Baltic Sea');
```

The scale picks itself: hours for up to 5 days, days for longer. Band kinds: `event` (red hatch),
`work`, `stay`, `plain`. All journeys of a row share one line, so they must not overlap in time:
give each journey its own row when they do, as winter-sun does. Every bar sits at its true time and
length. Each segment is a `rect.seg.<mode>`, so the page can style modes in CSS. A change of place
between segments is a red dashed line; a wait in one place is a dotted line.

## parts.js

`esc`, `store(id)` (saved choices; works without storage), `tooltip()`, `chipsHTML(name, items,
value)`, `switchHTML(name, label, on, help)`, `wireChips(root, { name: (value) => {} })`,
`stampSVG({ img, code, value })`, `postmarkSVG({ top, mid, x, y, rot })`, `sheet(label)` and
`cellsHTML(n, lit)`.

## checkout.js

```js
import { checkout, BUSY_TEXT } from '/kit/checkout.js';
const co = checkout({ id: T.raw.id, onJob: (job) => paintBookButton(job) });
co.open({ title, sub, items: [{ label, main, meta, price }], total, note, prompt, trip });
```

`prompt` is the booking request in plain words for the agent; `trip` is the choice as data. Without
a server, the sheet copies the prompt to the clipboard. `references/booking.md` is the agent's side.

## kit.css

Tokens: `--ink`, `--ink2`, `--muted`, `--red`, `--paper`, `--card`, `--rule`, `--rule2`, `--r`,
`--serif` (Fraunces), `--sans` (Inter), `--hand` (Caveat).

Classes: `pc-map`, `pc-stripes` (airmail border), `pc-title` and `pc-halo`, `pc-card`, `pc-hud`
(fades in after the intro and out at the globe; `--d` sets its delay), `pc-eyebrow`, `pc-price`,
`pc-hand`, `pc-chips` and `pc-chip`, `pc-book` (the red band), `pc-tip`, `pc-cells`, the sheet
classes, and SVG text classes `pc-caps`, `pc-tick`, `pc-note`, `pc-pill`, `pc-trow`.

## art

`kit/art/` has engraved drawings in navy ink on transparent ground, about 360 px tall, standing on
their bottom edge: `alps`, `amsterdam`, `berlin`, `cartouche`, `compass`, `fjords`, `frankfurt`,
`helsinki`, `lighthouse`, `paris`, `pines`, `riga`, `ship`, `whale`, `zurich`, and the 3D plane
`airplane.glb`. Use a city drawing only for its own city. Use ship, whale, compass, lighthouse and
pines on open ground or sea, away from the route. For other places, make new drawings in the same
style when you can make images, and put them in the trip's `art/`. Without one, leave the place
without a drawing; do not use another city's drawing.
