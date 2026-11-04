# Where to read journeys and prices

This file gives the order of work and the rules. Each mode has its own file in `sources/`.
The helpers are in `scripts/scrape/`. Run them with `python3` (standard library only).

## Rules

- Search as a normal visitor in an isolated browser profile. Do not log in.
- Do not solve captchas, rotate identities, spoof a browser or work around a bot check. When a
  site blocks you, record the site and the date in `notes`, and go to the next source.
- Never book or pay. Stop at the payment page.
- Give every offer a `source` (the site where you read the price) and `seen` (the date).
- Record the bag rules for every offer. When you did not read them, say so in a `warning`.
- Keep every journey that a reasonable person could take, also the bad ones. Drop a journey only
  when it breaks a hard limit from the brief.
- When a site blocks the price, keep the journey without an offer and add a `warning` that names
  the blocked site and where the person can read the price.
- Close the tabs you opened and stop the browser when you finish.

## Order of work

1. **Places.** Find the airports, stations, stops and ports near the start and the end.
   `places.py near ZRH --km 120` lists the airports nearby. Search the alternate airports too
   (see `sources/flights.md`).
2. **Schedules.** For each mode, get every journey in the window. Use the per-mode file.
   Search each direction one way, one day at a time.
3. **Prices.** Read the price for each journey you kept. Read the sellers and the bag rules.
4. **Deals.** Search the round trips. Record a deal only for a pair you saw priced together.
5. **Route lines.** Every segment that is not a plane needs a `path`. Most helpers write it.
   `sources/geometry.md` covers the rest.
6. **Ratings.** Run `ratings.py annotate trip.json` to add seller ratings.
7. **Extras.** Add the event, the weather and the stays (`sources/extras.md`).
8. **Join.** Run `merge.py` to build `trip.json` from the parts. Then run `check_trip.py`.

## Per-mode files

| File | Use it for | Main helpers |
| --- | --- | --- |
| [flights.md](sources/flights.md) | Planes: Google Flights list, sellers, bags, alternate airports | `gflights.py`, `gflights_list.js`, `gflights_booking.js`, `places.py` |
| [trains.md](sources/trains.md) | Rail and night trains: schedules, which sites give prices | `transitous.py`, `flixbus.py` |
| [buses.md](sources/buses.md) | Long-distance coaches and transfer buses | `flixbus.py`, `transitous.py` |
| [ferries.md](sources/ferries.md) | Ferries and overnight ships | `transitous.py`, `geometry.py ferry` |
| [roads.md](sources/roads.md) | Car and taxi: distance, time, fuel, tolls, vignettes | `geometry.py road` |
| [geometry.md](sources/geometry.md) | Route lines for the map | `geometry.py`, `transitous.py` |
| [ratings.md](sources/ratings.md) | Seller ratings | `ratings.py` |
| [extras.md](sources/extras.md) | Bags, weather and climate, events | `climate.py` |
| [holidays.md](sources/holidays.md) | Flexible dates, stay length, several destinations | `gflights.py dates`, `gflights_dates.js` |

## Shared settings

- Cache: the helpers keep HTTP answers in `~/.cache/postcard`. Set `POSTCARD_CACHE` to move it.
  Set `POSTCARD_OFFLINE=1` to use only the cache.
- Browser output: the JS files return a JSON string. Save the browser tool's output to a file and
  give the file to the Python helper. The helpers read plain JSON and the `chrome-devtools-axi`
  `result: "..."` form.

## Downloads

Do not open a link that starts a download, such as an e-ticket PDF, in the person's own browser.
Fetch the file with a tool instead, so the person gets no save dialog.
