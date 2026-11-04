# Flights

Google Flights gives the schedules, a list price and the sellers with bag rules. Use the helpers
in `scripts/scrape/`. Checked on 2026-11-04.

## 1. Find the airports

1. Run `python3 places.py near <CITY-AIRPORT> --km 250`. It lists the airports with scheduled
   flights and the distance.
2. Search the main airport and each alternate airport that a person could reach in about 2 hours
   by train or car. Example for Zürich: ZRH, BSL (Basel-Mulhouse), and MUC when the brief allows
   it. Low-cost airlines often fly only from the alternate airport.
3. For an alternate airport, add the transfer as its own segment in a `mixed` journey
   (`chain.py`). Check the first train of the day: no train or bus from Zürich HB reaches BSL
   before 06:38. A flight before about 08:00 needs a warning instead of a transfer. Get it
   from `transitous.py plan` (for BSL: train to Basel SBB, then bus 50 to the airport). Add the
   transfer price to the offer, or say in a warning that it is not included.
4. EuroAirport Basel-Mulhouse has a Swiss and a French side. Times are in `Europe/Zurich` for both.

## 2. Read the list

1. Make the URL: `python3 gflights.py url ZRH AMS 2026-12-04 --curr CHF --gl CH`.
   - The URL holds the search in words: `?q=Flights from ZRH to AMS on 2026-12-04 one way`.
     Add `through <date>` for a round trip.
   - Do not put the passengers in the words. "for 2 adults and 2 children" gave empty lists on
     2026-11-04. Search for 1 adult. Then edit the numbers at the top of `gflights_pax.js` and
     run it in the page. It sets the passengers in the dialog and waits for the new prices.
     The list then shows the total for the whole group.
   - `hl=en` keeps the text in English, so the parser can read it. `curr` sets the currency and
     `gl` the country. Prices depend on `gl`.
2. Open the URL. The first visit shows a consent page: click "Reject all".
3. Wait until the list has rows. Then run `gflights_list.js` in the page (any browser tool's eval;
   the file is one async function). It clicks "View more flights" and every "Flight details"
   button, then returns all rows with the segment text. Save the output to a file.
4. Run `python3 gflights.py parse list.txt --group out --prefix o --pareto --out out.json`.
   - `--pareto` keeps the journeys that are not worse in every way (time, price, stops).
   - `--max-stops 1` and `--max-hours 12` apply hard limits from the brief.
   - Each offer has `basis: "list"`: the lowest price Google showed, with the first carrier as
     the seller.
5. Search each direction one way, one day at a time, over the whole window.

### Quirks

- "Oops, something went wrong" or an empty list comes and goes. Open the URL again after a
  minute. After many searches in a row, Google can stop loading prices (the date grid stays at
  "Loading prices", the price graph at "Getting prices", and lists stay empty). Then stop for
  30 minutes or more. Do not reload in a loop.
- The URL changes to a `tfs=` form after load. Keep the `q=` form in `url`; it works again later.
- A round-trip list shows the total for the round trip, not the outbound price. Use
  `parse --deal-with <outbound id>` on the return list to turn these into `deals`.
- "+1" after a time means the next day. The parser handles it.
- Some rows say "Price unavailable". The parser drops them unless you give `--keep-unpriced`.
- Flags in the row ("Self transfer", "Separate tickets", "Change of airport", "Overnight") go
  into `flags`. An airport change and a layover of 6 hours or more get a `warning`.
- Sometimes the page shows a train box ("See more train options"). It is not part of the list.

## 3. Read the sellers and bags

1. Click the journey in the list. On one-way searches, this opens "Booking options".
2. Run `gflights_booking.js`. Save the output.
3. Run `python3 gflights.py booking booking.txt --journey o3`. It prints one offer per seller and
   fare: `kind` is `operator` for "Book with <Airline> Airline" or "Official site", else `agency`.
   Each offer has `fare`, `bags.cabin`, `bags.checked` (`included`, a price, `fee` or `none`)
   and `basis: "booking"`.
4. Airlines with fare families (such as BA, SWISS, KLM) list the bags per fare. Without fare
   families, the parser reads the bags from the itinerary summary ("1 free carry-on", "1st
   checked bag ... available for a fee") and gives them to every offer, with a `bags_note`.
   `fee` means a bag costs extra but Google does not show the price.
5. For a low-cost airline, the list row says "This price does not include overhead bin access".
   The parser then adds the flag `No overhead bin` and sets `bags.cabin` to `fee`. Then read the bag price on the
   airline's own site and add it to the offer, or add a warning.
6. Replace the list offer with the booking offers for each journey you keep.

## 4. Round trips

Search the main pairs as round trips too (`--back`). Some airlines sell a round trip for less than
two one-way tickets. Record a `deal` only for a pair you saw priced together.

## Other sites (2026-11-04)

| Site | Result |
| --- | --- |
| Google Flights | Works. Soft rate limit after about 20 searches in a short time. |
| Skyscanner | "Press and hold" bot check. Not used. |
| Kayak, Momondo | Blocked automated searches in November 2026. |
| Kiwi.com | Loads. Use it for self-transfer combinations Google does not show. |
| Airline sites | Use them for the bag prices of low-cost airlines. |
