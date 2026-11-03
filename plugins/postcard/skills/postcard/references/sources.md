# Where to read flights and prices

Use any browser tool you have. Search as a normal visitor. Do not solve captchas, rotate
identities or work around a bot check. When a site blocks you, go to the next source and name the
blocked site in `sources_note`.

Write down the source and the date for each price as you read it. Prices change by the hour.

## Order of work

1. **Schedules: Google Flights.** Search each direction as one-way, one day at a time, over the
   whole window. This gives every flight with its times, stops and layovers, and often the airline's
   own price. A search URL works without clicking through the form:

   ```
   https://www.google.com/travel/flights?q=Flights%20from%20ZRH%20to%20HEL%20on%202026-11-12%20one%20way
   ```

   Read the full list ("Other flights"), not only the top results. Note the flight numbers.

2. **Sellers: Skyscanner.** Open each flight you kept. The booking page lists every seller, with a
   price and a star rating from a number of reviews. Record each one as an offer with `stars` and
   `reviews`. Skyscanner sometimes shows a "press and hold" check. Do not try to pass it. Try again
   later or skip it.

3. **Self-transfer tickets: Kiwi.com.** Kiwi sells combinations of separate tickets that the other
   sites do not show. Record them with `kind: "self"` and `self_transfer: true` on the flight. Check
   whether the connection changes airports.

4. **Round-trip deals: airline sites.** Some airlines sell a round trip for less than two one-way
   tickets. Check the airline's own fare calendar for the main pairs. Record a deal only for a
   pair you saw priced together.

5. **Bags and fare rules.** The cheapest fare often has no cabin bag. When you did not check the
   bag price, add a `warning` that says so.

## What to keep

- Keep every flight that a reasonable person could take, also the bad ones. The page shows why a
  flight is bad.
- Drop a flight only when it breaks a hard limit from the brief.
- Keep the agencies with a low rating. The "Any seller" choice shows them, and the sellers view
  explains why the page did not use them.

## Sites that blocked agents before

Kayak and Momondo blocked automated searches in November 2026. Try them, but do not count on them.

## Downloads

Do not open a link that starts a download, such as an e-ticket PDF, in the person's own browser.
Fetch the file with a tool instead, so the person gets no save dialog.
