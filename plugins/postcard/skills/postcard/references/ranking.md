# How the page ranks trips

The page pairs every buyable outbound flight with every buyable return flight. It scores each pair,
and the lowest score is the best match. The code is `evaluate()` and `ranked()` in `viewer/app.js`.

## What a pair costs

- **Price.** The two cheapest accepted one-way offers, or a cheaper accepted deal.
- **Travel time.** Door to door is not known, so this is the time in the air and on the ground
  between take-off and landing, both ways.
- **Work lost.** The office hours that overlap the time away. Away starts `before_departure_h`
  before take-off and ends `after_arrival_h` after landing at home. With the Remote chip on, only
  the travel itself counts: from leaving home to arriving at the venue, and back.
- **Event missed.** The weights of the moments that fall outside the time at the venue. The time at
  the venue starts `transfer_h` after landing and ends `before_departure_h` before the return
  take-off.

## Priorities

Each priority chip is a set of weights. The page scales each cost to 0-1 over all pairs, then adds
them with the weights.

| Chip | Price | Time | Work | Event |
| --- | --- | --- | --- | --- |
| Balanced | 35 | 20 | 25 | 20 |
| Cheapest | 90 | 5 | 0 | 5 |
| Work first | 15 | 5 | 80 | 0 |
| Full event | 15 | 5 | 5 | 75 |

The page hides "Work first" when the trip has no work hours, and "Full event" when the event has no
moments.

## Sellers

The "Buy from" chips decide which offers count: Airlines (the airlines' own sites), + Good agencies
(agencies rated 4+ from 100+ reviews) or Any seller (also low-rated agencies and self-transfer
tickets). A flight with no accepted offer is greyed out and cannot be picked.

## When the best match looks wrong

Check the data first, then the model:

1. A wrong time zone on a place moves a flight by hours. `check_trip.py` catches flights that
   arrive before they depart, but not a plausible wrong zone.
2. Moment weights decide what "Full event" means. Give the moments the person cares about the
   highest weight.
3. Buffers that are too short make early or late flights look free.

When the model does not fit the trip, change it. Copy `app.js` into the trip folder and edit
`evaluate()` or `PRESETS`. Tell the person what you changed.
