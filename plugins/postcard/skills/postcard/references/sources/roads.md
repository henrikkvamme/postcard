# Car and taxi

A car journey has no seller. Give it a cost estimate that the person can check: distance, fuel,
tolls and fixed costs, each with a source. Checked on 2026-11-04.

## 1. Distance, time and line

Run `python3 geometry.py road "Zürich HB" "45.2992,6.5758" --out <trip>/paths/car.geojson`.

- Places are a name or "lat,lng" (the order Google Maps shows).
- `--via` adds a stop on the way. Use it to force a route, such as a tunnel or a ferry port.
- The output has `km`, `minutes` (without traffic or breaks) and the source (OSRM). Add about
  15 minutes for each 2 hours of driving, and say so in the warning.
- Check where the route goes. Compare the line with known towns before you look up tolls.

## 2. Cost

1. Fuel: read the national average price on the motoring club page (TCS for Switzerland, ADAC
   for Germany, the French government prix-carburants site). Note the date.
2. Tolls: read the class 1 price for each toll section on the operator's tariff (ASFINAG, ATMB,
   ADELAC, AREA/APRR, autostrade.it). The French PDFs are compressed; a web search often quotes
   the section price. When you cannot read a section, say so in the warning.
3. Fixed costs: vignettes (Switzerland CHF 40 a year, Austria, Slovenia), tunnels (Mont Blanc,
   Fréjus, Great St Bernard), parking at the destination, a car-train or ferry.
   A Swiss car already has the Swiss vignette. Do not count it twice.
4. Run with the numbers:
   `geometry.py road A B --l100 7.5 --fuel-price 2.11 --tolls 7.70 --fixed 0`.
   The output adds `fuel_l`, `fuel_cost`, `cost` and `cost_note`.
5. Make one journey for each direction. Use `mode: "car"`, one car segment with the path, and
   one offer: `seller: "Own car"`, `kind: "self"`, `price` = the cost for one direction,
   `basis: "estimate"`, `source` = the sources of the numbers, and the `cost_note`.
6. The cost is for the car, not per person. Say so in `price_note`.

## 3. Taxi

Use the same route line. Read the fare on the taxi company's site or a fixed-price transfer
site. When there is no fixed price, give an estimate from the local tariff and say so in a
warning.

## Site status (2026-11-04)

| Source | Result |
| --- | --- |
| OSRM (router.project-osrm.org) | Works, no key. Falls back to routing.openstreetmap.de. |
| Nominatim | Works for place names. Use "lat,lng" when you know the point. |
| TCS fuel prices | Readable through a web search. |
| French toll PDFs (AREA/APRR) | Compressed. The text is not readable through a web fetch. |
