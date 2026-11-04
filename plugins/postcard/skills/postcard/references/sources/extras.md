# Bags, weather and events

## Bags

Record the bag rules for every offer, as `bags: {"cabin": ..., "checked": ...}`. Each value is
`"included"`, a price in the trip currency, `"fee"` (costs extra, price not shown) or `"none"`
(not allowed).

1. Google Flights booking options list the bags for fare families (`gflights.py booking`).
2. For low-cost airlines, the list shows a "no carry-on" icon (`flags`). Read the bag price on
   the airline's site. Prices change with the route and the date.
3. Trains, FlixBus and ferries include bags. Write the limits in `bags_note`.
4. Special bags (skis, bikes, prams): read the rule and the price on the seller's site, and add
   them to `bags_note`. Ski bags on a plane are often a fixed fee for each direction.
5. When you did not read a bag price, add a warning. Do not leave `bags` out silently.

## Weather and climate

1. For a trip more than 16 days ahead, use climate data:
   `python3 climate.py "27.26,33.81" --name Hurghada --from 01-10 --to 01-17`.
   It averages the same days over 2016 to 2025 (Open-Meteo ERA5 archive) and adds the sea
   temperature for coasts (Open-Meteo marine). Output: `day_max_c`, `night_min_c`, `sun_h`,
   `rain_days`, `of_days`, `wind_kmh`, `sea_c`, `source`.
2. For a trip within 16 days, add `--forecast START END` for the forecast.
3. Put the result in `context.weather`, one entry for each place, with the source and the years.
4. Open-Meteo needs no key. The archive is slow for many years; the helper caches it for good.

## Events and work

1. Put the event in `context.event`: name, venue (a place key with `kind: "venue"`), start and
   end in local time, and the source URL.
2. Put the working hours or the meeting in `context.work`. The page uses them to show which
   journeys arrive in time.
3. Read the event times on the organiser's own page. Note the date you read them.
