# The kit

The kit is the fixed part of every page: the chart, the trip model, time, the timeline, the bill,
small HUD parts and the checkout. Plain ES modules, no build step. `serve.py` serves them at `/kit/...` from
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
| `clock`, `T0`, `T1` | The clock (see time.js) and the window in hours. `T1` is the exclusive end; a date alone ends at the end of that day. |
| `places[id]` | The place, plus `id` and `label` (city, else name). |
| `journeys`, `byId`, `groups[name]` | Normalized journeys, by id, and by group. |
| `deals` | Deals, each with `journeys: [ids]`. |
| `best(j, { accept, bags })` | The cheapest accepted offer, with `total` (bags priced in) and `bagsKnown`; null when nothing is accepted or the fare cannot carry the bags. |
| `bagExtra(offer, { cabin, checked })` | The bag cost: a number, `undefined` when not checked, `null` when not possible. |
| `price(journeys, opts)` | `{ total, split, deal, each }` for buying them together, or null. Uses a deal when cheaper. |
| `dealFor(ids, opts)` | The cheapest accepted deal for exactly these journeys. |
| `combos(groupNames, keep)` | Every chain of one journey per group in time order, kept when `keep(js)` is true. |
| `nights(out, back)` | Nights at the place: the local date you leave minus the local date you arrive. A night train out and back gives 0; a flight landing at 00:30 starts the stay that day. |
| `shift(j, days)` | The same journey whole days later (negative: earlier). Wall times move; `shifted` and `base` mark it; each offer gets `basis: "other-date"` and `read_for`. Async. |
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
  onFar: (far) => {}, onReady: () => {}, onRouteHover: (hit) => {}, routeCard: true });
chart.show({ chosen: [j1, j2], others: [...], ends: ['ZRH', 'HEL'] });
chart.where(T.whereAt([j1, j2], hour));   // put the vehicle on the route; null puts it back
```

Route hover belongs to the kit. Pointing at a chosen route puts the vehicle at that point and shows
the route card beside it: the time there, the mode and carrier, the leg's ends with their times, and
a bar of the time gone and to go (plus "over France" for a flight). `onRouteHover(hit)` still fires
with `{ j, seg, s, T, pt, event }`, so the page can move its timeline cursor; it must not draw its own
tip for the same hover. `routeCard: false` turns the card and the hover vehicle off.

| Call | Does |
| --- | --- |
| `show({ chosen, others, ends, refit })` | Chosen journeys in red with their vehicle; others thin and quiet; `ends` get big labels. Reframes when the chosen set changes. |
| `where(w)` | Moves the vehicle (a 3D paper model) to `w` from `whereAt`; null hides it. At rest the map shows no vehicle. |
| `frame(journeys or points)` | Flies to fit them inside the padding. |
| `setPad(pad, { duration, refit })` | The part of the map that the HUD does not cover. Call it whenever the HUD changes size; a ResizeObserver on the card is the simple way. |
| `reset()`, `home()` | Back to the start view. |
| `over([lng, lat])` | "over France" or "over the Baltic Sea", for a status line. |
| `map` | The MapLibre map, for anything else. |

How it draws each mode: a plane on a great-circle arc with the 3D plane model; a train as a line
with ties; a car or taxi as a double line; a bus as a single line; a ferry as long dashes; a walk as
dots. Ground lines lie on the terrain. A ground segment without a path is a faint straight dash.
Labels are pins that hide by priority when they collide, and a country or sea name on the chosen route hides. A stop is labelled with its `code`, else its city; a stop next to a labelled place of the same name gets no label. Flights bow a little to the left of their direction, so out and back do not overlap. After each move the chart zooms out until the whole chosen route is inside the padding. `?reduced=1` in the URL acts as reduced motion. Below zoom `far` the HUD steps aside
(`body.far`) and the globe shows; a click flies back to the route.

## timeline.js

```js
import { timeline } from '/kit/timeline.js';
const tl = timeline(svg, T, { rows: [{ label: 'Out', journeys }, ...], bands: [{ label: 'Event', spans: [{ a, b, kind: 'event' }], marks }],
  lead: (j) => `${j.carrierName} ${j.depL.hm}`, side: (j) => money, onPick, onHover, onTime, from, to, scale: 'auto' });
tl.paint({ chosen: new Set(ids), hover: id, dim: (j) => bool });
tl.cursor(hour, 'Over the Baltic Sea');
tl.wall(j, 'dep');   // '06:25', or '06:25 WET' when the place's zone is not the axis zone
```
On a phone the clock label left of the axis has about `left - 14` px. Pass a short `clockLabel` there
("CET", or `title` left out), or a smaller `left` with a short one; a long label is cut with an ellipsis.

The scale picks itself: hours for up to 5 days, days for longer. Band kinds: `event` (red hatch),
`work`, `stay`, `plain`. All journeys of a row share one line, so they must not overlap in time:
give each journey its own row when they do. Every bar sits at its true time and length. The default lead and side labels are ticket times (`wall`). `title: 'Out'` names a timeline when you stack two; a clock label too long for the left margin is
cut, with the whole text on hover. With `onPick`, rows are buttons: Tab reaches them, Enter picks,
and focus survives the redraw. `disabled: (j) => bool` marks a journey that cannot make a valid
option: it is dim, not a Tab stop, and a click does nothing. Each segment is a `rect.seg.<mode>`, so
the page can style modes in CSS. A change of place between segments is a heavier ink dash; a wait in
one place is a dotted line. The hover cursor and its pill are ink.

A timeline that is wider than a phone scrolls sideways inside a box with the class `pc-scroll-x`
(the probe allows that box to scroll). Put the class on the box that scrolls (the one with
`overflow-x: auto`), not on its child or parent. Start it scrolled to the chosen journey, and keep the box tall
enough for every row, or the rows below are hidden.

## parts.js

`esc`, `store(id)` (saved choices; works without storage; `get(key, default, ok)` drops a saved value not in the list `ok` or failing the test `ok`), `tooltip()`, `chipsHTML(name, items,
value)`, `switchHTML(name, label, on, help)`, `wireChips(root, { name: (value) => {} })`,
`stampSVG({ img, code, value })`, `postmarkSVG({ top, mid, x, y, rot })`, `sheet(label)` and
`cellsHTML(n, lit, { tone })` (red cells for a cost; `tone: 'ink'` for a neutral count such as hotel nights). `sheet` keeps Tab inside and gives focus back to the opener on close; several
`sheet()` calls share one element, and the one shown last owns Esc and focus.

`tooltip()` has three calls:

- `tip.beside(el, html, { avoid: card })` for a row, a cell or a chip. It puts the tip outside the
  card (left of it, over the map, or above it), so it never covers the next row's figures
  (craft.md, rule 7). Use it on hover and on keyboard focus.
- `tip.show(event, html)` for a point on the map or a bar: below and right of the pointer.
- `chart.routeBox()` is the screen box of the chosen route: pass `{ avoid: [card, chart.routeBox()] }`
  to `tip.beside` so a row's tip does not cover the route where the vehicle moves.
- A pick of three or more legs gets numbered legs on the map (`chart.show({ legNumbers })` forces it on or off).
- `tip.hide()`. `tip.canHover` is false on a touch screen: there a tap picks and opens no tip. Put
  what a tip says on the postcard or behind a small "i" button instead (craft.md, rule 9).

## bill.js: every cost, once

```js
import { bill, fare } from '/kit/bill.js';
const b = bill(T, [
  ...fare(T, out, offer, { cabin: 1 }, { ticket: 'out', guess: { cabin: { value: 30, basis: 'easyJet list' } } }),
  ...fare(T, back, offer2, { cabin: 1 }, { ticket: 'back' }),
  { what: 'Train Zürich HB → Basel SBB', amount: 40, state: 'estimate', basis: 'SBB list price', who: 'person' },
  { what: 'Fuel and tolls', amount: 151, state: 'estimate', basis: '...', who: 'none' },
  { what: 'Transfer to the resort', amount: null, basis: 'not searched', who: 'none' },
  { what: '8 hotel nights', amount: null, who: 'out' },
]);
b.text();        // '≈ CHF 234 + Transfer to the resort not read + 8 hotel nights not counted'
b.figure(); b.tail({ max: 2 }); b.all();   // the figure ('not read' when nothing was read), its short tail, every unknown for a tip
b.book.text();   // what the agent books: '≈ CHF 187'
b.tickets;       // one per purchase: { seller, shop, what, when, bags, total, approx, known, limits, parts }
b.items();       // checkout items, one per ticket, then what the person buys
b.promptLines(); // one line per ticket for the prompt
```

Make one bill per option in the model (craft.md, rule 3). A part is one thing the trip needs: a
fare, each bag fee, a train to the airport, fuel, a toll, parking, a hotel night, a transfer. Its
`amount` is null when it was not read; it is never 0 for an unread fee. `state: 'estimate'` makes
every sum with it ≈. `limit` is a condition on a read price ("from price; cabin type not read") that
must show wherever the price shows. Parts with the same `ticket` are one purchase; a mixed journey
bought from three sellers is three tickets. `who`: `agent` books it, `person` buys it, `none` is paid
on the way, `out` is named but not counted.

`fare(T, j, offer, need, opts)` makes the parts of one journey from one offer: the fare, and a part
for each bag in `need` (`{ cabin: 1, checked: 4, skis: 4 }`) that is not included. A bag fee the offer
does not list is a part with no amount, or an estimate from `opts.guess` (per bag on this journey; a
journey of two flights that each charge needs the value for both). Any key works in `need`: `skis: 4`
is a "skis fee" part, priced by `offer.bags.skis` or `opts.guess.skis`. A bag fee is named by the
flights it is paid on. `offer.limit` becomes the fare's limit, `offer.price_note` goes to its basis,
and `offer.bags_note` is its bag terms (shown once per seller in the checkout).

A fare that was not read is never a 0: its ticket's figure is "not read", the checkout says "fare not
read", and the prompt says "Expected price: not known" and asks the agent to read and report it. Unread
parts of one `kind` are named together in the tail ("+ 2 cabin bag fees not read"); past `max` the
tail ends with "+ 2 more", and `b.all()` has the full list for a tip.

Show `b.text()` (or `b.figure()` and `b.tail()`) wherever the option's total shows: the row, the
postcard. Show `b.book.text()` on the book band, with the trip total beside it when they differ.
Build the checkout from `b.items()` and the prompt from `b.promptLines()`, so the band, the sheet and
the prompt can never disagree.

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

## 3D models

`kit/art/3d/` has paper models as glTF (`*.glb`) with `index.json` listing each one: `name`, `kind`
(`vehicle` or `landmark`), `size` in metres, `px` (its size on screen), and for a landmark `place`,
`label`, `lng`, `lat`. Vehicles ride the route by segment mode or `segment.vehicle` (trip-schema.md). A train leg of four hours or more that runs through 03:00 gets `train-night` by itself.
Landmarks go in `map.models`. Place a landmark only at its own city, for the places on the trip and at
most two or three famous ones the route passes near; more makes the chart busy. A place without a
model gets none; do not use another city's model. Give each one `lng` and `lat` beside its place, as for
`map.art`: about 40 to 80 km off at a country view, on the side away from the route and from the place's
label (labels sit to the right of the dot). A model on the dot covers the route end. Map labels and the
route card draw above the models.

The models are generated, not drawn: `models/` at the repository root has the generator, the parts
and a gallery (`models/gallery/`). A new model is a new file there, built with `node models/build.mjs`.

## art

`kit/art/` has engraved drawings in navy ink on transparent ground, about 360 px tall, standing on
their bottom edge: `alps`, `amsterdam`, `berlin`, `cartouche`, `compass`, `fjords`, `frankfurt`,
`helsinki`, `lighthouse`, `paris`, `pines`, `riga`, `ship`, `whale`, `zurich`. Prefer a 3D landmark
in `map.models` to a city drawing when both exist. Use a city drawing only for its own city. Use ship, whale, compass, lighthouse and
pines on open ground or sea, away from the route. For other places, make new drawings in the same
style when you can make images, and put them in the trip's `art/`. Without one, leave the place
without a drawing; do not use another city's drawing.
