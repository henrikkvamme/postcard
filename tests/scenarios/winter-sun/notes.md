# winter-sun

One adult from Zürich, any 7 nights in January 2027, somewhere warm. BSL and MUC allowed. Data
read on 2026-11-04. 15 journeys in 6 groups (`hrg-out`, `hrg-back`, `tfs-out`, `tfs-back`,
`ace-out`, `ace-back`). Currency CHF. No deals: see "Round trips".

## Destinations and climate

Climate for 5 to 26 January, mean of 2016 to 2025 (Open-Meteo ERA5 archive and marine,
`climate.py`). It is in `context.weather`.

| Place | Day | Night | Sun | Rain days of 22 | Sea |
| --- | --- | --- | --- | --- | --- |
| Hurghada (HRG) | 21.1 °C | 13.7 °C | 9.8 h | 0.2 | 22.5 °C |
| Tenerife south (TFS) | 20.8 °C | 15.2 °C | 9.8 h | 1.0 | 21.0 °C |
| Lanzarote (ACE) | 20.6 °C | 15.1 °C | 9.5 h | 1.1 | 20.0 °C |

## Flexible dates

Google Flights date grids for BSL to each place (`gflights_dates.js`, then `gflights.py dates
--nights 7`). Two grids for each place, around 9 and 23 January. They cover departures from 6 to
12 January and from 20 to 26 January. Departures from 1 to 5 and from 13 to 19 January are not
covered. The cheapest 7-night stays with both nights in January (round trip, 1 adult):

| Place | Dates | Price |
| --- | --- | --- |
| Lanzarote | 12 to 19 Jan | CHF 75 |
| Hurghada | 20 to 27 Jan | CHF 85 |
| Tenerife | 12 to 19 Jan | CHF 108 |

The trip uses these dates. `context.dates` holds the 4 cheapest pairs for each place. With 6 or 8
nights, the lowest prices were HRG 89 / 108, TFS 136 / 115 and ACE 153 / 115.

## Sources

| Part | Source | Result |
| --- | --- | --- |
| Date grids | Google Flights | Works. 6 grids, no throttle this time. |
| Flight lists and booking pages | Google Flights (`gflights.py parse`, `booking`) | Works. 10 lists and 5 booking pages. |
| Transfers Zürich HB to and from BSL | Transitous (`transitous.py plan --paths`) | Works. Chained with `chain.py`. Not in the price. |
| easyJet bag prices | easyjet.com | Not read. Google shows "1 carry-on bag available for a fee" and "1st checked bag available for a fee" (`bags: fee`). A third-party guide (gvaairport.com) gives about CHF 25 for a 23 kg bag online. |
| Seller ratings | Trustpilot | Pegasus 1.4, AJet 1.5 and Iberia 1.2 added to the table. Tripado unrated. |
| MUC | Not searched | ZRH and BSL gave enough choice. |

## Findings

- easyJet from BSL is the cheapest to all 3 places: CHF 35 to 56 each way. The fare includes only a
  small bag under the seat. The list says "This price does not include overhead bin access";
  the parser now sets the `No overhead bin` flag and `bags.cabin: "fee"`.
- The easyJet flights to HRG (06:45) and ACE (07:25) leave too early for public transport. The
  first train and bus from Zürich HB arrive at the airport at 06:38. These journeys start at BSL
  and carry a warning.
- The TFS return lands at BSL at 22:15. The first train that leaves 60 min later arrives at Zürich
  HB at 01:24.
- From ZRH, Edelweiss flies nonstop to HRG (CHF 616) and TFS (CHF 255), with cabin and checked
  bags included. There was no Edelweiss nonstop back from TFS on Tue 19 Jan, or from HRG on
  Wed 27 Jan.
- The ZRH flights start at the airport. No journey includes the train from Zürich HB to ZRH.

## Round trips

The date-grid prices are easyJet round trips. They equal the sum of the two one-way prices
(HRG 41 + 45 = 86 against 85, TFS 56 + 52 = 108, ACE 40 + 35 = 75). easyJet gives no round-trip
discount, so the trip has no deals.
