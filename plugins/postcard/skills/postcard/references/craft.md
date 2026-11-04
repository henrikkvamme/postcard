# Craft

The map is fixed. The HUD is yours: you design it for the one question this person asked. These
rules make the difference between a page that answers that question in five seconds and a
dashboard of everything you found. Judges of real pages found the same faults again and again; the
rules below name them.

## 1. Start from the question

Write the question in one line before you write code. The question decides the main view.

| The question | The main view | Example |
| --- | --- | --- |
| "Which flights for this event?" | Ranked choices against the event and work hours on an hour-scale timeline | `junction-2026` |
| "Where and which week?" | One row per place, ranked, with its weeks, its climate and its door-to-door cost | `winter-sun` (a grid by start week) |
| "Train or plane?" | Door-to-door bars side by side, one row per journey, aligned on the meeting or the start | |
| "In what order, on what days?" | The loop as stations in order, each leg's choices under it, and nights at each stop | |
| "Which way for the family?" | One row per way (train, car, fly), both days at one hour scale, with changes, waits and hours at the wheel | |

The `winter-sun` example groups journeys as `out` and `back`. When your data has one out and one
back group per place (`tfs-out`, `tfs-back`), keep its layout and change its model, not the data.

Pick the one view that answers the question. Add a second view only when the person must check
something the first cannot show (the exact times of the chosen week, the sellers of one flight).
Two or three views is the most.

Every "must" in the request gets an answer on the page. When you could not check something the
person named (Munich, the bag fee, the train fare), say so next to the answer, not only in a
footer.

## 2. Model first, then pixels

Write the decision as pure functions at the top of `app.js`: what an option is, what it costs, how
options rank. Every number on the page comes from one of these functions and from `trip.json`. Then
the views only draw.

- An option is what the person buys and takes: one journey per group (`T.combos`), a holiday of
  out plus back for one place, a loop of legs in order. For a loop where nights move a leg to
  another day, use `T.shift(j, days)`: it moves the times by whole days and marks every price as
  read for another date.
- Rank by one score in the trip currency when you can: price, plus a price per hour of travel, plus
  costs the person named (a lost work hour, a night flight, a 1 h 20 m train to another airport).
  Say the weights on the page in one line.
- Priorities as chips (Balanced, Cheapest, Fastest) are fine when the person has more than one
  goal. Show a priority chip only when the data can change its result.
- A fixed limit (a 10:00 meeting, the last lift) is a risk, not only a yes or no. Give an option
  with little spare time a cost, or flag it, and show the spare time for every option.

## 3. Say what is known

The person acts on the page. A number that looks more certain than it is will cost them money.

- **Estimates.** When you add a value you did not read (a train fare, parking, a hotel night, the
  time to the airport), put it in `context.estimates` with its basis (see `trip-schema.md`) and mark
  it on the page with ≈. An estimate stays an estimate in every sum: a total with an estimate in it
  is ≈ too.
- **Unknowns next to the figure.** A total lists what it leaves out, beside the total: "+ bag fee
  not read", "+ 3 train fares not read", "transfers at the resort not counted". A fee that is not
  read is never 0, and a deal does not hide the bag fees of its fares.
- **A mode with no prices.** Do not rank on a missing price, and do not call an unpriced option
  "Best" without saying what it may cost. Rank by a stated measure that is known (time lost, changes)
  and show the price question as a number the person can test: the break-even fare ("the night train
  wins if both tickets cost under CHF 410"). Name what the break-even leaves out.
- **Assumptions.** Do not assume a fact that the ranking depends on. A night train is a bed only
  when the berth is known (`berth`); otherwise it is unknown, and the page says "couchette or seat?".
  Say which driver: "one adult drives" is an assumption.
- **Other dates.** A price read for one day is an estimate on another day. When a pick moves a
  journey (`T.shift`), mark its price in the row, on the postcard and in the checkout.
- **Labels match the measure.** "Door to door" means from the door to the door, at both ends. When
  you measure less (from the station, without the resort transfer), say what the ends are.
- **Nights.** Count nights at the place from the real arrival to the real departure (`T.nights`). A
  flight that lands at 00:30 starts the stay that day. Show "+1" on a time that is the next day.
- **Sums over days.** A fact summed over several days says so ("6h 34m at the wheel each Saturday"),
  or shows each day.

## 4. Every control changes something visible

Before you add a chip, a switch or a tab, name what it changes on screen. When a control can change
nothing for this data (one seller kind, one airport, one bag option), leave it out or show the fact
as text. Test each control: click it and see the price, the pick or the map change. A control whose
range stops before the answer changes (a queue guess up to 2 h when the break-even is 2 h 47 m) is
too short.

Good controls for travel: bags (small, cabin, checked), sellers (operators, good agencies, any),
airports (home airport only, plus the other one), the stay length, the start date, priorities.

## 5. The map tells where; the HUD tells which and why

- `chart.show({ chosen, others })` on every pick. The chosen option is red; others are quiet.
- `chart.where()` from a timeline or row hover: the vehicle moves to that hour, and the status line
  says "On the train, SJ · over Lake Vänern". At rest the map shows no vehicle.
- Keep the routes clear of the HUD: set the chart padding from the card's real size, and call
  `setPad` again when the card changes size. Check that the route's two ends are on screen at
  desktop and at phone width.
- Big labels for the ends of the chosen option only (`ends`). A station gets a short `code`
  ("Basel SBB") when its city name would repeat a nearby label; the chart drops a stop label that
  repeats a nearby one.
- Drawings: a city drawing only for its own city. Decorations (ship, whale, compass) on open sea or
  ground, away from the route.

## 6. Calm

- **Red has one meaning per page: "this one".** It marks the pick (its row, its route, its price) and
  the book band. A failing fact on any option is ink with a small mark (▲, a hatch, an outline). On
  the postcard, one failing fact may be red, once. Eyebrows, leg labels (OUT, BACK), headings,
  temperatures, tab underlines and hover pills are ink.
- **Five text sizes at most** in the HUD, for example 10 px capitals, 12 px text, 15 px names,
  19 px headings and 26-30 px for the price; the probe fails a HUD with more than six. No lowercase
  text under 10 px, and running text 11 px or more. Fraunces for
  names and prices, Inter for the rest, Caveat once for the hand on the postcard.
- Show state by position, colour and shape, not by sentences. A fact appears once: the postcard does
  not repeat the row, and the subtitle does not repeat the title.
- Numbers right-aligned in tabular digits (the kit sets them). A missing value is a dash; a real zero
  is 0. A column of numbers has a grey header in sentence case.
- The weights line and the "not checked" line are one line each. Explanations of a value are on its
  hover and its tap, not in a paragraph.
- When you add something, remove something.

## 7. Still

Nothing moves when you hover, pick or switch a view, except what that action changes.

- A card anchored to the bottom keeps one height across picks: give lines that come and go (a red
  fact, a "times as on Tue" note) a fixed height, and clamp long lines to one line with a tooltip.
- A tooltip sits beside what it describes and does not cover the next row's figures.
- A control that redraws keeps keyboard focus (update it in place, or focus the new node).

## 8. The postcard and the book band

Every page has a postcard for the current pick: where, when, the price, the journeys in two or
three lines, and the one fact that matters most for this question (the January high, the work hours
lost, the nights). The red band at the bottom books exactly what the postcard shows.

- Show one price scope and name it. When the trip costs more than what the agent can book (trains
  to the airport, a hotel night, the resort bus), show both: "Trip ≈ CHF 249 · book now CHF 202".
- The checkout lists one line per ticket: its seller, its segments, its price, and its bag terms.
  A mixed journey is several tickets. See `booking.md`.

## 9. Phone

At 390 px wide, the map keeps the top third and shows both ends of the route. The card takes the
rest, and the postcard and the book band stay visible.

- The main view shows every option without a sideways scroll: make each option one compact row
  (name, one thin bar, the price). Three to six options fit without scrolling inside the card.
- A timeline may scroll sideways inside its box; a list of options may not.
- Anything on hover is also on tap and on keyboard focus: the basis of a price, the spare time.
- The key (what a hatch or a ring means) is shown on a phone too, in one line.
- Chips wrap.

## 10. Motion

The intro flies in once. Picks reframe the map smoothly. With `prefers-reduced-motion`, nothing
flies; the kit handles the chart, and the page must not add its own animation without the same
check. `?reduced=1` in the URL does the same, for checks.

## 11. Words

Short sentences, plain words, the same word for the same thing. Times as the booking site shows them
("Sat 23 Jan 07:30"). Durations as "12h 16m". Places by city name, and the airport code only where
two airports share a city. Never show a raw id (`ZUERICH-HB`); use the place name. A label like
"best priced" must mean what it says; "top pick" is safer when the rank is not the price.

## 12. When the best option looks wrong

Check the data before the model:

1. A wrong place zone moves times by hours. `check_trip.py` catches a journey that lands before it
   leaves, not a plausible wrong zone.
2. A missing offer or a missing bag price can make an option look cheap.
3. Buffers that are too short make early or late departures look free.
4. One searched chain is not every chain: a 6-hour wait at the airport may be a gap in the search.
   Say "only chain searched".

Then check the weights. Tell the person in one line what the ranking values.
