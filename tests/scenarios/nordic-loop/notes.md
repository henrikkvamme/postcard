# nordic-loop

Two adults, 15 to 25 May 2027: Oslo, Copenhagen, Hamburg, Berlin, then back to Oslo.
Data read on 2026-11-04. 19 journeys in 4 legs (groups `oslo-copenhagen`, `copenhagen-hamburg`,
`hamburg-berlin`, `berlin-oslo`). Currency EUR.

## Sources

| Part | Source | Result |
| --- | --- | --- |
| Train and bus schedules | Transitous (`transitous.py plan --proxy-date`) | Works. See "Proxy dates" below. |
| Route lines for trains | Transitous leg geometry | Works for every ride. |
| FlixBus schedules, prices, bags | FlixBus search API (`flixbus.py`) | Works. May 2027 is already on sale. Prices are for 2 adults with the platform fee. |
| FlixBus stop positions | FlixBus station search API | Works. Matched by station id. |
| Bus route lines | OSRM (`geometry.py road`, called by `flixbus.py`) | Works. |
| Ferry schedule and price | gonordiccruiseline.no booking page, in the browser | Works: 16:30 to 10:00, NOK 753 for 2 adults plus NOK 70 online fee. |
| Ferry route line | OSM relation 949772 "København - Oslo" through Overpass (`geometry.py ferry`) | Works. |
| NOK to EUR | ECB rate through Frankfurter (`common.py fx`) | Works. Rate of 2026-11-03. |
| Train prices | bahn.de, DSB, SJ, Vy | Not read. bahn.de flagged the browser as a bot earlier the same day. The others were not tried. Each train has a warning. |
| Seller ratings | Trustpilot table (`ratings.py annotate`) | FlixBus rated. Go Nordic Cruiseline is not in the table. |

## Findings

- DFDS no longer sails Oslo to Copenhagen. Gotlandsbolaget runs the route as Go Nordic Cruiseline
  since November 2024. The old DFDS booking pages show an empty skeleton for this route.
- Go Nordic sells up to about 20 May 2027 on 2026-11-04. Later days are greyed out.
- The ferry price is the lowest "from" price. The page did not show the cabin type for that price.

## Proxy dates

The European timetable changes on 13 December 2026. The 2027 timetable was not in the Transitous
feeds yet. A search on 21 May 2027 gave Hamburg to Berlin in 13 hours. The rail journeys were
searched on the same weekday before the change, and the times moved to May:

| Leg date | Proxy date |
| --- | --- |
| Sat 15 May 2027 | Sat 12 Dec 2026 |
| Tue 18 May 2027 | Tue 8 Dec 2026 |
| Fri 21 May 2027 | Fri 11 Dec 2026 |
| Mon 24 May 2027 | Mon 7 Dec 2026 |

Each such journey has `schedule_source: "transitous, proxy date ..."` and a "Times not final"
warning. On the proxy Saturday, Vy ran buses ("Vy bus4you") between Oslo and Gothenburg in place
of some trains. May can differ.
