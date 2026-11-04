# rail-vs-air

One adult, Zürich to Amsterdam for a meeting on Fri 4 Dec 2026, 10:00 to 16:00. Back by Sun
6 Dec. Data read on 2026-11-04. 18 journeys in 2 groups (`out`, `back`) and 1 deal. Currency CHF.

## Sources

| Part | Source | Result |
| --- | --- | --- |
| Train schedules and route lines | Transitous (`transitous.py plan --paths`) | Works. December 2026 is in the feeds. |
| Train prices | bahn.de, nightjet.com, sbb.ch, Omio, Trainline, NS International | Not read. bahn.de gave error 753 (bot check), Omio showed Cloudflare, sbb.ch stayed blank, Trainline autocomplete did not answer, NS International gave empty results. Each train journey has a "No price" warning. |
| FlixBus schedule, price, stops, route line | FlixBus API and OSRM (`flixbus.py`) | Works. fx5 costs CHF 44. |
| Flights ZRH and BSL | Google Flights list and booking pages (`gflights.py`) | Works. Throttled after about 20 searches; recovered after 30 to 40 minutes. |
| Round-trip price | Google Flights round-trip list | Works. Recorded as a deal. |
| Seller ratings | Trustpilot table (`ratings.py annotate`) | 10 offers rated. |

## Findings

- The Nightjet is in the DB feed as "IC 60402", operator "DB Fernverkehr (Codesharing)". The
  build renames it to "ÖBB Nightjet", NJ 402 (out) and NJ 403 (back), as the person sees it.
- Basel EuroAirport: Google Flights writes MLH in the itinerary. `gflights.py` maps MLH and EAP
  to BSL. fq12 chains the IC3 to Basel SBB and bus 50 to the airport with KL 1948
  (`chain.py`). The train and bus are not in the price, and the tickets are separate.
- Round trip: SWISS LX 734 (Thu 3 Dec) plus LX 725 (Sat 5 Dec) costs CHF 235 on one ticket. The
  two one-way tickets cost CHF 227 + 153 = CHF 380. The other SWISS returns on Sat 5 Dec also
  cost CHF 235; LX 735 costs CHF 249.
- The flights leave from the airport. No journey includes the train from Zürich HB to ZRH
  (about 12 minutes).
- The overnight FlixBus fx5 arrives at 07:30 on Fri 4 Dec. That is in time for the meeting.
