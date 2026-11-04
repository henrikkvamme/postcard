# Flexible dates and several destinations

Use this when the brief gives a range ("any 7 nights in January") or several places ("somewhere
warm"). Checked on 2026-11-04.

## 1. Pick the destinations

1. List the places that fit the brief. For "somewhere warm" in winter, check the climate first:
   `python3 climate.py <lat,lng> --name <Name> --from 01-10 --to 01-17` for each candidate.
2. Find which airports fly there from the home airport and the alternate airports
   (`places.py near`, then a Google Flights search).
3. Keep 3 destinations unless the brief says more.

## 2. Find the cheap dates (date grid)

1. Open a round-trip search with the stay length: `gflights.py url BSL HRG 2027-01-09 --back
   2027-01-16 --curr CHF --gl CH`.
2. Run `gflights_dates.js`. It opens "Date grid" and reads 7 departure days by 7 return days
   around the dates in the URL. Each cell is a round-trip price. Save the output.
3. Move the search by 7 days and repeat, to cover the whole range. Four searches cover a month.
   Each grid costs one search against the Google limit (about 20 in a row). With 3 places,
   cover the most likely weeks first and say in the notes which days you did not check.
4. Run `python3 gflights.py dates grid1.txt grid2.txt ... --nights 7 --top 5`. It prints the
   cheapest departure and return pairs, with the price.
5. When the output has `loading` above 0, the prices did not load. Wait 30 minutes or more and
   try again. Do not reload in a loop. The "Price graph" view did not load prices in the
   automated browser.

## 3. Read the journeys

1. For the 2 or 3 cheapest pairs for each destination, search each direction one way
   (`flights.md`). This gives the times, the sellers and the bags.
2. Compare the grid price with the sum of the two one-way prices. Record a `deal` only when the
   round trip is cheaper. easyJet sold no cheaper round trips in January 2027.
3. Use one `group` for each destination and direction, such as `hrg-out` and `hrg-back`.
4. Put the destinations and their climate in `context.weather`, and the dates in each journey.
5. Put the cheapest date pairs for each place in `context.dates`
   (`{from, to, nights, cheapest: [{dep, ret, nights, price}], source, seen}`).

## 4. Stay length

When the brief allows several stay lengths, use `--nights 6-8`. Show the person the price
difference in the notes; the page lists the journeys.
