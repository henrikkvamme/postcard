# Ferries

Few ferries are in the open feeds. Read the schedule and the price on the operator's booking page,
and draw the line from OpenStreetMap. Checked on 2026-11-04.

## 1. Find the operator

1. Search the route on the web. Check who runs it now. Example: DFDS sold Oslo-Copenhagen.
   Gotlandsbolaget runs it as Go Nordic Cruiseline since November 2024. The old DFDS pages show
   an empty booking page for it.
2. Try `transitous.py plan ... --modes FERRY` too. It finds the ferries that are in the feeds
   (mostly local and Norwegian ones).

## 2. Read the schedule and the price

1. Open the operator's booking page in the browser. Reject the cookies.
2. Choose one way, the date and the number of people. Read the departure, the arrival and the
   "from" price. Stop before you choose a cabin or enter any personal data.
3. Write the journey by hand:
   - `mode: "ferry"`, one ferry segment, `overnight: true` for a night ship.
   - Places of `kind: "port"` at the terminal, not the city centre.
   - An offer with `fare` (such as "One way, from price, cabin included"), the fees in
     `price_note`, and `basis: "list"`.
4. When the site sells in another currency, convert with `python3 common.py fx 823 NOK EUR`.
   Put the converted price in `price` and the original in `original`.

## 3. Route line

Run `python3 geometry.py ferry "59.9045,10.7400" "55.7030,12.5970" --out <trip>/paths/ferry.geojson`.
It finds the OSM ferry route whose ends lie near both ports. Use `--name` to pick one route of
several, and `--radius` when the terminal is far from the route end. When nothing matches, use
`geometry.py line` and say so in a warning.

## Site status (2026-11-04)

| Site | Result |
| --- | --- |
| gonordiccruiseline.no (Oslo-Copenhagen) | Works. Sells up to about 20 May 2027. |
| dfds.com | Loads. The booking page stays empty for routes DFDS no longer runs. |
| Overpass (OSM ferry routes) | Works. Needs a User-Agent. |
