# Craft

The map is fixed. The HUD is yours: you design it for the one question this person asked. These
rules make the difference between a page that answers that question in five seconds and a
dashboard of everything you found.

## 1. Start from the question

Write the question in one line before you write code. The question decides the main view.

| The question | The main view | Example |
| --- | --- | --- |
| "Which flights for this event?" | Ranked choices against the event and work hours on an hour-scale timeline | `junction-2026` |
| "Where and which week?" | A grid of places by start date, with the best price in each cell | `winter-sun` |
| "Train or plane?" | Door-to-door side by side: one row per option, time split into access, wait, ride and transfer | |
| "In what order, on what days?" | The loop as stations in order, each leg's choices under it, and nights at each stop | |
| "Can the family make it?" | Each person's or each day's plan, with the hard limits (nap time, check-in, lift opening) as bands | |

Pick the one view that answers the question. Add a second view only when the person must check
something the first cannot show (the exact times of the chosen week, the sellers of one flight).
Two or three views is the most; Junction has four because it trades price, work, event and seller.

## 2. Model first, then pixels

Write the decision as pure functions at the top of `app.js`: what an option is, what it costs, how
options rank. Every number on the page comes from one of these functions and from `trip.json`. Then
the views only draw.

- An option is what the person buys and takes: one journey per group (`T.combos`), a holiday of
  out plus back exactly N nights apart, a loop of legs in order.
- Rank by one score in the trip currency when you can: price, plus a price per hour of travel, plus
  costs the person named (a lost work hour, a night flight, a 1 h 20 m train to another airport).
  Say the weights on the page in one line.
- Priorities as chips (Balanced, Cheapest, Fastest) are fine when the person has more than one
  goal. Show a priority chip only when the data can change its result: hide "Work first" without
  work hours, "Full event" without event moments.
- Show what you did not check. An offer without a bag price is "+ bag?", not a guess.

## 3. Every control changes something visible

Before you add a chip, a switch or a tab, name what it changes on screen. When a control can change
nothing for this data (one seller kind, one airport, one bag option), leave it out or show the fact
as text. Test each control: click it and see the price, the pick or the map change.

Good controls for travel: bags (small, cabin, checked), sellers (operators, good agencies, any),
airports (home airport only, plus the other one), the stay length, the start date, priorities.

## 4. The map tells where; the HUD tells which and why

- `chart.show({ chosen, others })` on every pick. The chosen option is red; others are quiet.
- `chart.where()` from a timeline hover: the vehicle moves to that hour, and the status line says
  "On the train, SJ · over Lake Vänern".
- Keep the routes clear of the HUD: set the chart padding from the card's real size, and call
  `setPad` again when the card changes size. Check that the route's two ends are on screen at
  desktop and at phone width.
- Big labels for the ends of the chosen option only (`ends`). Other places keep small labels.
- Drawings: a city drawing only for its own city. Decorations (ship, whale, compass) on open sea or
  ground, away from the route.

## 5. Calm

- One accent: the stamp red (`--red`) marks the chosen option, the one main action and the one
  failing fact on an option. Everything else is navy ink on paper.
- Few text styles: Fraunces for names and prices, Inter for the rest, Caveat once for the hand on
  the postcard.
- Show state by position, colour and shape, not by sentences. A fact appears once.
- Numbers right-aligned in tabular digits. A missing value is a dash; a real zero is 0.
- Nothing moves when you hover, pick or switch a view, except what that action changes.
- When you add something, remove something.

## 6. The postcard and the book band

Every page has a postcard for the current pick: where, when, the price, the journeys in two or
three lines, and the one fact that matters most for this question (the January high, the work hours
lost, the nights). The red band at the bottom books exactly what the postcard shows, with the price.

## 7. Phone

At 390 px wide, the map keeps the top third and shows both ends of the route. The card takes the
rest: the main view scrolls inside its own box (sideways for a timeline, down for a list), and the
postcard and the book band stay visible. No lowercase text under 10 px; capital labels 9 px or more.
Chips wrap.

## 8. Motion

The intro flies in once. Picks reframe the map smoothly. With `prefers-reduced-motion`, nothing
flies; the kit handles the chart, and the page must not add its own animation without the same
check.

## 9. Words

Short sentences, plain words, the same word for the same thing. Times as the booking site shows them
("Sat 23 Jan 07:30"). Durations as "12h 16m". Places by city name, and the airport code only where
two airports share a city.

## 10. When the best option looks wrong

Check the data before the model:

1. A wrong place zone moves times by hours. `check_trip.py` catches a journey that lands before it
   leaves, not a plausible wrong zone.
2. A missing offer or a missing bag price can make an option look cheap.
3. Buffers that are too short make early or late departures look free.

Then check the weights. Tell the person in one line what the ranking values.
