# Trains

Transitous gives the schedules and the route lines. It has no prices. Train prices are the hard
part: most rail shops block automated browsers. Checked on 2026-11-04.

## 1. Schedules

1. Run `python3 transitous.py plan "Zürich HB" "Amsterdam Centraal" --date 2026-12-03
   --after 05:00 --until 23:30 --prefix t --paths <trip>/paths --out trains-out.json`.
   - FROM and TO are stop names, stop ids from `transitous.py geocode`, or "lat,lng".
   - The helper pages through the whole window and keeps the journeys that are not worse in every
     way. It also drops journeys slower than 1.6 times the fastest (`--slack`), except night
     trains. Use `--all` to keep everything.
   - `--modes RAIL,HIGHSPEED_RAIL,LONG_DISTANCE,NIGHT_RAIL` leaves out buses.
2. Each ride gets one route line file in `paths/`. Stops within 600 m of each other become one
   place.
3. Night trains have `overnight: true`. Check that the sleeper arrives in time for the brief.

## 2. Check the timetable horizon

The feeds cover only the published timetable. The European timetable changes in mid-December
(13 December 2026). Before the new timetable is published, a later date gives few or very slow
journeys. Example: on 2026-11-04, Hamburg to Berlin on 21 May 2027 took 13 hours.

1. Compare the result with the same weekday in the current timetable. If the later date has far
   fewer or slower journeys, the timetable is not published yet.
2. Search the same weekday in the published timetable and move the times:
   `transitous.py plan ... --date 2027-05-21 --proxy-date 2026-12-11`.
3. Each moved journey gets `schedule_source: "transitous, proxy date ..."` and a warning. Keep
   the warning. Engineering work on the proxy date (such as replacement buses) can show up.

Some feeds publish early. On 2026-11-04, SBB and SNCF already had February 2027.

## 3. Prices

| Site | Result on 2026-11-04 |
| --- | --- |
| bahn.de | Flagged the browser as a bot (error 753) after one search. Do not retry. |
| Omio | Cloudflare bot check. |
| sbb.ch | The page stayed blank in the automated browser. |
| Trainline | Loads. The station autocomplete did not react, and results through a URL failed. |
| NS International | Loads. The station search stayed empty. |
| Rail Europe | Empty page. |
| SNCF Connect | Not proven. |
| Nightjet (ÖBB), SJ, DSB, Vy | Load. Prices not tried yet. Try these first for their own trains. |
| FlixTrain | Works through `flixbus.py` (same API as FlixBus). |
| Google Flights train box | Sometimes shows a train price for the same route. Not reliable. |

What to do:

1. Try the operator's shop once in the browser. When it blocks you, stop and record it.
2. Keep the train without an offer. Give it a warning that names the blocked site and tells the
   person where to read the price. `merge.py --unpriced "<text>"` adds this to every journey
   without an offer.
3. Do not guess a price. A typical fare from a web search is not an offer.

## 4. Bags

Trains carry bags at no cost. Set `bags: {"cabin": "included", "checked": "included"}` and add a
`bags_note` for limits (such as bikes or skis on TGV).
