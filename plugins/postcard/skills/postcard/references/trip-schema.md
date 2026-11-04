# trip.json, version 2

One file holds the facts of a trip: places, journeys, offers and deals. The page reads it through
`kit/trip.js`. `scripts/check_trip.py` checks it. Facts go here; decisions (what is best, what to
show) go in the page's `app.js`.

## The whole shape

```jsonc
{
  "id": "winter-sun-2027",                 // short slug; the page keys saved choices on it
  "title": "Somewhere warm",
  "subtitle": "Seven nights in January 2027 · from Zürich or Basel",
  "currency": "CHF",                        // every price is in this currency, for all passengers together
  "passengers": { "adults": 1, "children": 0 },
  "clock": "Europe/Zurich",                 // the zone of the page's timeline
  "clock_label": "Zürich time",
  "window": { "start": "2027-01-08T00:00", "end": "2027-02-01T00:00" },   // in the clock zone
  "places": { "ZRH": { ... } },
  "journeys": [ { ... } ],
  "deals": [ { ... } ],
  "carriers": { "LX": "Swiss", "SBB": "SBB" },
  "map": { "labels": [...], "seas": [...], "art": [...], "view": null },
  "sources": { "note": "Read 2-3 Nov 2026 on Google Flights and SBB. Kayak blocked the search.", "seen": "3 Nov 2026" },
  "context": { }                             // anything else this page needs: event, work hours, climate, home
}
```

## places

The key is the id that journeys use: an IATA code for an airport, any short id for the rest.

```json
"ZRH":   { "name": "Zürich Airport", "city": "Zürich", "kind": "airport", "coord": [8.5492, 47.4582], "tz": "Europe/Zurich", "code": "ZRH" },
"ZUE_HB": { "name": "Zürich HB", "city": "Zürich", "kind": "station", "coord": [8.5402, 47.3779], "tz": "Europe/Zurich" }
```

- `coord` is `[lng, lat]`, longitude first.
- `tz` is an IANA zone. A wrong zone moves every time at that place by hours.
- `kind`: `airport`, `station`, `stop`, `port`, `city`, `venue` or `home`. The chart uses it for the
  label weight.

## journeys

A journey is one thing a person can buy and take from A to B: a flight with its stops, a train
with its changes, a ferry, or a drive. Each journey belongs to a `group`, the leg it is one choice
for: `out` and `back` for a return trip, or names like `zrh-cph`, `cph-sto` for a loop.

```jsonc
{
  "id": "o3", "mode": "plane", "group": "out",
  "from": "ZRH", "to": "HEL",
  "dep": "2026-11-12T19:05",          // local wall time at "from", as the booking site shows it
  "arr": "2026-11-12T23:10",          // local wall time at "to"
  "carrier": "AY", "numbers": "AY 1514",
  "segments": [ ... ],                // optional for a direct journey; required for "mixed"
  "self_transfer": false,             // true when a missed connection is the traveller's loss
  "warning": { "short": "self-transfer", "text": "Two tickets. A delay on the first leg is your risk." },
  "offers": [ ... ]
}
```

- `mode`: `plane`, `train`, `bus`, `coach`, `ferry`, `car`, `taxi`, `walk`, or `mixed` when the
  segments use different modes.
- Times are local wall times. Never convert them yourself; the kit does it with the place's zone.
- `warning` is for a fact the person must see before buying: a self-transfer, a short change, a
  fare without a cabin bag, an overnight wait. `short` is a few words for a chip; `text` is one
  sentence.

### segments

One per vehicle. The first starts at the journey's `from`, the last ends at its `to`, and each
departs after the one before arrives.

```json
{ "mode": "train", "from": "CPH_H", "to": "STO_C", "dep": "2027-05-14T10:12", "arr": "2027-05-14T15:31",
  "carrier": "SJ", "number": "SJ 535", "path": "paths/cph-sto.geojson" }
```

- A change where the next segment starts at another place (LTN to STN, airport to station) is a
  ground transfer. The check warns about it, and the page must show it.
- `path` is the line the vehicle follows: an inline `[[lng, lat], ...]` list, or a GeoJSON file in
  the trip folder (LineString, MultiLineString, Feature or FeatureCollection; parts are joined end to
  end). Planes need no path: the kit draws a great circle. A ground segment without a path is drawn
  as a faint straight dash, so the person sees that the line is a guess.
- Where to get a path: OpenStreetMap through the Overpass API (rail routes are relations with
  `route=train`), or a router such as OSRM for roads and BRouter for rail. Cut the line to the two
  stations. Keep files under a few hundred kB; thin long lines to a point every 1-2 km.

### offers

Each place you saw the journey for sale.

```jsonc
{
  "seller": "Finnair", "kind": "operator",     // operator | agency | self
  "price": 189,                                 // total for all passengers, in the trip currency
  "fare": "Light",
  "bags": { "cabin": "included", "checked": 35 },  // "included", "none", or the extra price
  "source": "Google Flights", "seen": "2026-11-03",
  "url": "https://...",                         // only a stable link, never one with a session token
  "stars": 4.4, "reviews": 914, "rating_source": "Trustpilot"
}
```

- `operator` is the airline, rail or ferry company itself. `agency` is any reseller. `self` is a
  ticket you build from parts (two one-ways on different carriers).
- `bags` keys: `small` (under the seat), `cabin` (overhead bin) and `checked`. Leave a key out when
  you did not check it; the page says "bag fee not checked" instead of guessing.
- Give every offer a `source` and a `seen` date. Give an agency a rating when you can find one, and
  say where it comes from. Without a rating, the "good agencies" filter drops it.

## deals

A price for several journeys bought together that is cheaper than the parts: a return fare, a rail
pass, a package.

```json
{ "journeys": ["o3", "r2"], "price": 298, "seller": "Finnair", "kind": "operator", "what": "Return fare, Light",
  "source": "Finnair.com", "seen": "2026-11-03" }
```

One journey per group. The kit's `price()` uses a deal when it is cheaper than the sum of the parts.

## map

```jsonc
"map": {
  "view": null,                                     // or { "center": [lng, lat], "zoom": 4, "pitch": 26, "bearing": -6 } to fix the opening view on a desktop; phones always fit the route
  "labels": [["GERMANY", 10.4, 51.1]],               // [text, lng, lat]: countries and regions, in capitals
  "seas": [["Baltic Sea", 19.5, 57.5]],              // [text, lng, lat]; also used for "over the Baltic Sea"
  "art": [{ "img": "kit/art/helsinki.png", "lng": 24.95, "lat": 60.17, "km": 120, "place": "HEL" }]
}
```

- `art.img` starting with `kit/` is a drawing in the skill's `kit/art/`. Any other path is in the
  trip folder. `km` is the drawing's height on the ground. `place` ties a city drawing to its place,
  so the label and the drawing do not collide.

## context

Free-form data for this page only: the event schedule, work hours, the climate of each
destination, how long it takes to get to each airport. The kit does not read it; the page's
`app.js` does. Say where each fact comes from, as for prices.

## From v1

A v1 file has `flights` instead of `journeys`. Move each flight to a journey with `mode: "plane"`,
`group` = its old `dir`, `from` and `to` from `home` and `destination` when they were left out, and
`via` plus `layovers_min` as segments. Move `offers[id]` into the journey. Rename kind `airline` to
`operator`. Move `home`, `destination`, `event`, `work` and `buffers` into `context`.
