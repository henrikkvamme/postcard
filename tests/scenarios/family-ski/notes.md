# family-ski

Two adults and two children (8 and 11), Zürich to Val Thorens, Sat 13 to Sat 20 Feb 2027, with
4 pairs of skis. Data read on 2026-11-04. 10 journeys in 2 groups (`out`, `back`). Currency CHF.

## Sources

| Part | Source | Result |
| --- | --- | --- |
| Train and bus schedules, route lines | Transitous (`transitous.py plan --paths`) | Works. SBB and SNCF feeds already hold February 2027. |
| Train prices | sbb.ch, sncf-connect.com | Not read. sbb.ch stayed blank and SNCF Connect was not proven in the automated browser. Each train journey has a "No price" warning. |
| Car route and line | OSRM (`geometry.py road`) | Works. 428 km, 5 h 34 min without traffic, via Geneva, Annecy and Albertville. |
| Fuel price | TCS, Bleifrei 95 | CHF 2.11 per litre on 2026-10-31. The estimate uses 7.5 l/100 km. |
| Tolls | ADELAC 2026 tariff, A41 Saint-Julien to Villy-le-Pelloux, class 1 | EUR 8.40, CHF 7.70 at the ECB rate of 2026-11-03. The AREA tariff PDF could not be read, so the short section to Annecy is not counted. |
| Flights ZRH-GVA and GVA-ZRH | Google Flights, 4 passengers set in the dialog (`gflights_pax.js`) | Works. CHF 493 out (SWISS; Booking.com 749, Gotogate 811, Tripado 870) and CHF 519 back. |
| Airport transfer | Transitous, Geneva airport to Val Thorens | Works. Chained to the flight with `chain.py` (a1, b1). Not in the price. |
| Ski bags on SWISS | skiingunlocked.com, transferbnb.com | CHF 90 per ski bag per flight on Economy Light. swiss.com did not show the number. 4 bags cost CHF 360 each way, not in the price. |
| Seller ratings | Trustpilot table | 6 offers rated. Tripado has no Trustpilot page that loaded (404). |

## Findings

- Google Flights gives empty lists when the URL text says "for 2 adults and 2 children".
  Search for 1 adult, then set the passengers with `gflights_pax.js`. The list then shows the
  price for all 4.
- The booking page shows no fare families for this route. The bags come from the itinerary
  summary: 1 free carry-on, checked bag for a fee (`checked: "fee"`).
- The return chain b1 leaves Val Thorens at 07:54 and reaches Geneva Airport at 13:38. The
  flight leaves at 20:15, a wait of 6 h 37 min. b1 is the only ground chain from Val Thorens to the
  airport that was searched. A later bus likely exists, but it was not searched, and no later
  chain is in the saved data. The journey has a warning that says so.
- The window ends Sun 21 Feb 00:00 (exclusive), so the Saturday evening arrival is inside.
- a1 and b1 start and end at the airport. No journey includes the train from Zürich HB to ZRH.
- The car cost is fuel and tolls for one car, not per person. Parking in Val Thorens is extra.
  Saturdays in February are the busiest days on the roads to the Tarentaise valley.
