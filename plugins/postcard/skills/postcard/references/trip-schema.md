# trip.json

One file describes one trip. `examples/junction-2026/trip.json` is a complete example. Run
`scripts/check_trip.py` after each edit.

## Times

- A time is a local wall time, written `YYYY-MM-DDTHH:MM`, with no zone suffix.
- A flight's `dep` is local at its departure airport, and `arr` is local at its arrival airport,
  as the booking sites show them. The page converts them with each place's `tz`.
- `window`, `event` and `event.moments` are in the `clock` zone.
- `work` times are in `work.tz`.
- Zones are IANA names, such as `Europe/Zurich`.

## Top level

| Field | Required | Meaning |
| --- | --- | --- |
| `version` | yes | `1`. |
| `id` | no | A short slug. It keeps one trip's saved choices apart from another's in the browser. |
| `title` | yes | The big heading, such as `Zürich → Helsinki`. |
| `subtitle` | no | The line under the heading. |
| `currency` | no | The code for every price, such as `CHF`. Default `EUR`. All prices use one currency. |
| `passengers` | no | Number of adults. Default 1. Prices are for the whole group. |
| `clock` | yes | The zone of the timeline. Use the destination's zone. |
| `clock_label` | no | The timeline's zone label. Default `<destination city> time`. |
| `window` | yes | `{start, end}`: the span of the timeline. Start at the first useful departure and end after the last useful arrival. |
| `home` | yes | Where the person starts and ends. See below. |
| `destination` | yes | Where they go. See below. |
| `buffers` | no | `{before_departure_h, after_arrival_h}`: time from leaving home to take-off, and from landing to being back at the desk. Defaults 2 and 1. |
| `event` | no | The reason for the trip. See below. Without it, the page counts the whole window. |
| `work` | no | Office hours the trip can cost. See below. Without it, the page hides the work meter and uses travel time in the trade-off chart. |
| `places` | yes | Every airport the flights touch, by code. See below. |
| `carriers` | no | Code to name, such as `{"AY": "Finnair"}`. A code without a name shows as the code. |
| `flights` | yes | See below. At least one `out` and one `back`. |
| `offers` | yes | Flight id to a list of sellers. See below. A flight with no offer cannot be priced. |
| `deals` | no | Tickets that sell both directions together. See below. |
| `sources_note` | no | One line over the sellers view: where and when you read the prices, and which sites blocked you. |
| `prices_seen` | no | When you read the prices, such as `1-3 Nov 2026`. The checkout shows it. |
| `booking_note` | no | Added to each line of the booking request, such as `with a cabin bag`. |
| `map` | no | Labels, art and the opening view. See below. |

## home and destination

```json
"home": { "place": "ZRH", "name": "Zürich", "to_airport": "Train to ZRH", "from_airport": "Train to the office" },
"destination": { "place": "HEL", "town": "Espoo", "venue": "Hype Areena", "address": "Espoo, Finland",
  "transfer": "Train or taxi to Espoo", "transfer_h": 1.5, "to_airport": "Train to the airport",
  "early": { "before": "06:00", "text": "Taxi, no trains this early" }, "stamp": "art/helsinki.png" }
```

- `place` is a code in `places`. It is the default end of every flight.
- `home.name` and `destination.town` are the words the page uses for "In Zürich" and
  "On the way to Espoo".
- `transfer_h` is the time from landing to arriving at the venue.
- `early` changes the way-to-the-airport line when the person must leave before that local time.
- `stamp` is the drawing on the postcard stamp. Without it, the stamp shows the destination code.
- `venue` and `address` are the two handwritten lines on the postcard.

## event

```json
"event": { "name": "Junction", "start": "2026-11-13T16:00", "end": "2026-11-15T17:00",
  "moments": [ { "at": "2026-11-13T18:00", "name": "Opening ceremony", "weight": 3, "label": "Opening" } ] }
```

Moments are the parts of the event worth being there for. `weight` says how much each one matters.
A trip that misses a moment loses its weight in the "Full event" priority. `label` puts a short
word over the moment on the timeline. Take the times from the event's own schedule.

## work

```json
"work": { "days": ["2026-11-12", "2026-11-13", "2026-11-16"], "start": "09:00", "end": "17:00",
  "tz": "Europe/Zurich", "remote_days": "Fri and Mon" }
```

`days` are the work days inside the window. When the Remote chip is on, only the time spent
travelling counts as lost. When it is off, every office hour away from home counts as lost.

## places

```json
"places": { "ZRH": { "name": "Zürich", "city": "Zürich", "coord": [8.5492, 47.4582], "tz": "Europe/Zurich" } }
```

`coord` is `[longitude, latitude]`. Longitude comes first. `city` is the word in sentences such as
"Changing planes in Copenhagen". Add every stop, also the two airports of a self-transfer.

## flights

```json
{ "id": "o12", "dir": "out", "carrier": "U2+FR", "dep": "2026-11-12T21:00", "arr": "2026-11-13T23:05",
  "via": ["LTN>STN"], "layovers_min": [1225], "self_transfer": true, "numbers": "U2 1234 + FR 5678",
  "warning": { "short": "bag?", "text": "The cheapest fare has a personal item only." } }
```

- `dir` is `out` or `back`.
- `from` and `to` are optional. They default to home and destination. Set them when a flight uses
  another airport, such as BSL instead of ZRH.
- `via` lists the stops in order. `LTN>STN` means: land at Luton, go to Stansted yourself, fly on.
- `layovers_min` has one entry per stop: the minutes on the ground.
- `self_transfer` marks separate tickets. The page warns about it.
- `warning.short` shows on the timeline. `warning.text` shows in the tooltips, the sellers view and
  the checkout.

## offers

```json
"offers": { "o1": [ { "seller": "Finnair", "kind": "airline", "price": 167, "source": "Skyscanner, 3 Nov",
  "stars": 4.9, "reviews": 22, "url": "https://..." } ] }
```

- `kind` is `airline` (the airline's own site), `agency` (an online travel agency) or `self` (a
  self-transfer ticket).
- `stars` and `reviews` are the seller's rating where you saw it. The "+ Good agencies" filter
  takes agencies rated 4 or more from 100 or more reviews.
- `price` is one-way for all passengers, in `currency`.

## deals

```json
"deals": [ { "out": "o1", "back": "r6", "price": 387, "seller": "Finnair", "kind": "airline",
  "what": "Finnair round trip", "source": "finnair.com" } ]
```

A deal replaces the two one-way prices when it is cheaper and the person accepts its seller.

## map

```json
"map": { "view": { "center": [15.4, 53.4], "zoom": 3.95, "pitch": 26, "bearing": -6 },
  "labels": [["FINLAND", 27.2, 62.3]], "seas": [["Baltic Sea", 19.0, 58.2]],
  "art": [ { "img": "art/helsinki.png", "lng": 25.9, "lat": 60.55, "km": 330, "place": "HEL" } ] }
```

- `view` is the opening camera. Without it, the page frames home and destination.
- `labels` are country names, `[text, lng, lat]`. `seas` are sea names. The page also uses the
  nearest sea name in "over the Baltic Sea".
- `art` places drawings that stand up on the map. `km` is the drawing's height on the ground.
  `place` links a drawing to an airport, so it fades when no chosen flight touches that airport.
  `references/design.md` lists the drawings in the viewer and says how to add your own.
