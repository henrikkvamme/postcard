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
| "Where and which week?" | One row per place, ranked, with its climate and its source as a visible caption; columns are shared weeks, each cell the place's best start in that week | `winter-sun` |
| "Train or plane?" | One row per way (fly both ways, night train, mixed), door-to-door bars on one window per direction (at least 4 px per hour), with the door-to-door hours and the spare time as figures. Each time comes from its own vehicle's segment (a flight shows the flight's time, not the feeder train's). Limits sit on their own line under the price, never inside it. Mark estimated access times with ≈. The map labels each end with the picked way's own station or airport. | |
| "In what order, on what days?" | The legs in order, each leg's ways under it, and the nights at each stop, set on the stay ("Copenhagen ‹ 2 ›"); say in one line why the default nights are what they are. A stepper stops at the last day and says why ("home by Mon 24"). A leg moved to another day keeps its train with `T.shift`, marked "times as on Tue" and its price as read for another day; a night train that ends after the last day is not offered. The map numbers the legs | |
| "Which way for the family?" | One row per way (train, car, fly), both days at one hour scale, with changes, waits, hours at the wheel and the stress the person named | |

An example shows a layout, not a model to reuse: its `app.js` reads `context` keys of its own. Write
the model for your data, and copy only the layout that fits your question.

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
  Say the weights on the page in one line. A value used only to rank (an unread bag fee counted as
  CHF 25, a hotel night not read) lives in `context.rank` and in that line; it never shows as a price.
  When the top pick is not the lowest figure in the main view, say why in one line next to the pick,
  in the person's terms ("no night in Basel first"), not only in the weights line.
- Priorities as chips (Balanced, Cheapest, Fastest) are fine when the person has more than one
  goal. Show a priority chip only when the data can change its result.
- A fixed limit (a 10:00 meeting, the last lift) is a risk, not only a yes or no. Give an option
  with little spare time a cost in the score (for example under 60 min before a fixed start), say
  that cost in the weights line, and show the spare time for every option, on a phone too.
- Measure spare time against the real cut-off, not the departure: a flight with a bag to drop closes
  about 40 min before departure (the airline's own rule; read it), and the person needs time to get
  from the train to the desk. A start the data warns about ("sleep near the airport the night
  before") follows the warning, with its hotel night in the bill, unless a source says otherwise.
- A best-option label counts what the main view shows: "2nd of 3 places", never "option 5 of 19"
  when the 19 are combinations the person never sees.
- Every word the person used for what matters ("least stressful", "a drive in snow", "not crazy
  expensive") is in the score or next to the answer. Say what it costs in one line.
- A pick label that rests on an estimate names it: "Least stress with a ≈ 1 h queue". When the
  winner wins only because a rival's price was not read, call it "cheapest read", not "best".

## 3. Say what is known

The person acts on the page. A number that looks more certain than it is will cost them money.

- **One bill per option.** Before any view, list every part the option needs from the door to the
  door with `bill.js` (kit.md): each fare; each bag the person named, in every mode (suitcases and
  skis on a flight, a bus and a train); the trains or the drive to the airport at both ends; fuel,
  tolls, the vignette, parking; hotel nights the timing forces; the transfer at the far end. A part
  you did not read is a part with no amount, never a missing line. The row, the postcard, the book
  band, the checkout and the prompt all read this one bill.

- **Estimates.** When you add a value you did not read (a train fare, parking, a hotel night, the
  time to the airport), put it in `context.estimates` with its basis (see `trip-schema.md`) and mark
  it on the page with ≈. An estimate stays an estimate in every sum: a total with an estimate in it
  is ≈ too, and so is a duration with an estimated walk or airport time in it. Count an estimate in
  the unit its basis gives: a fee per flight is charged twice on a journey of two flights.
- **Limits travel with the price.** A "from" price, a fare with the cabin not read, a price read for
  another day: the limit shows wherever the price shows, on the row, the postcard, the band, the
  checkout and the prompt (the part's `limit`).
- **Unknowns next to the figure.** A total lists what it leaves out, beside the total: "+ bag fee
  not read", "+ 3 train fares not read", "transfers at the resort not counted". A fee that is not
  read is never 0, and a deal does not hide the bag fees of its fares.
- **A mode with no prices.** Do not rank on a missing price, and do not call an unpriced option
  "Best" without saying what it may cost. Rank by a stated measure that is known (time lost, changes)
  and show the price question as a number the person can test: the break-even fare ("the night train
  wins if both tickets cost under CHF 410"). Name what the break-even leaves out, and its scope:
  tickets only, or tickets plus the hotel night they add. Use the same scope in the row, the tip and
  the booking stop rule. A break-even is ≈ when its inputs are. When the pick's total is mostly
  unread, also show the cheapest option that is fully read, with its total and a button that picks it
  ("All buses and the ferry: EUR 294, every fare read").
  An unpriced fare is never 0 in a score. In a list ranked by score, put an unpriced way at its
  break-even (the fare at which it ties the best priced way), or after the priced ways; never above
  them on a fare of 0. Say the break-even once in its row and once on the postcard, not again in the
  eyebrow and the band. When the break-even counts time as money, the stop rule says so ("with the
  time on the way counted, flying is then the better trip"). A night fare includes its seat or berth:
  name the unread class once ("couchette or bed?"), not as a second unread price.
- **Assumptions.** Do not assume a fact that the ranking depends on. A night train is a bed only
  when the berth is known (`berth`); otherwise it is unknown, and the page says "couchette or seat?".
  Offer a bed only on a night segment that is a train or a ferry; a night bus is a seat. Say which
  driver: "one adult drives" is an assumption. So is "the car has a vignette"; say it beside the
  total. A `warning` in the data is a fact you were given: never replace it with a rule of your own.
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
- Pass as `others` only the options the main view shows. A route the person must pick a chip to see
  (the via-Paris train) is drawn only when picked.
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
- **Six text sizes at most** in the HUD, the title included: the kit uses 10 px capitals, 12 px
  text, 15 px names, 21 px headings and the hand, 34 px for the price and 42 px for the title (30 px
  on a phone). The probe fails a HUD with more than six. No lowercase text under 10 px. Fraunces for
  names and prices, Inter for the rest, Caveat once for the hand on the postcard.
- The pick has one red mark per place: its bar and its price are red; its row gets a pale tint, not
  also a red side rule and red text. No side borders on cards or rows.
- Show state by position, colour and shape, not by sentences. A fact appears once: the postcard does
  not repeat the row, and the subtitle does not repeat the title.
- Numbers right-aligned in tabular digits (the kit sets them). A missing value is a dash; a real zero
  is 0. A column of numbers has a grey header in sentence case.
- The weights line and the "not checked" line are one line each. Explanations of a value are on its
  hover and its tap, not in a paragraph.
- When you add something, remove something.
- **No generated tells** (after github.com/leonxlnx/taste-skill, `tells.md`). Each one makes a page
  read as made by default, without a reason: a soft grey shadow under every card; a gradient or glow
  on text or buttons; glass blur panels; emoji as icons; a tiny tracked capital label above every
  block (the kit's leg labels and one eyebrow on the postcard are the exceptions, and they carry
  information); index numbering (01, 02, 03); a pill badge ("New", "Best"); a pulsing dot; every
  section in the same card layout; more than nine text sizes; generic words ("seamless", "unlock",
  "effortless"). Removing a tell is not enough: the space it leaves goes to the subject, the map or a
  bigger answer, not to another ornament.
- **The idea comes from the trip, not the category.** Before you build, name the one thing that is
  specific to this trip (the night train that saves a hotel, the queue that decides the car, the
  week the sea is warm) and make the first screen about it. Cover the title: if the page would fit
  any trip of its kind, it has no idea yet.

## 7. Still

Nothing moves when you hover, pick or switch a view, except what that action changes.

- A card anchored to the bottom keeps one height across picks, views and phone tabs: give lines
  that come and go (a red fact, a "times as on Tue" note) a fixed height, size a list for its longest
  case, and clamp long lines to one line with `text-overflow: ellipsis` and the whole text in a
  `title` (the probe allows that, and lists them as `truncated`). Clamp only a detail: a fact that
  answers the question (the driving hours, what was not read, the stress the person named) is never
  cut. Shorten its words, or give it two lines.
- A price that was not read is not a price: set "Fares not read" at body size in ink, never in the
  big price style. Everything in the card fits it at 1280 x 720 too.
- A tooltip only adds a fact the page does not show. A row whose facts are in its detail line or on
  the postcard gets none, and the route hover has only the kit's route card. A tip sits beside what it
  describes, outside the card (`tip.beside`), and never covers the next row's figures. A tap that picks
  opens no tip.
- A control that redraws keeps keyboard focus (update it in place, or focus the new node).
- Esc backs out one level: it closes a tip or a sheet. It never resets the person's picks. Offer a
  reset as a quiet text button that shows only when the picks differ from the top picks.
- A row that cannot make a valid option is not a button (`disabled` in the timeline).

- A redraw of a control row (chips, steppers) keeps focus on the control that was used. A control
  that comes and goes (Reset, "Top pick") keeps its space with `visibility: hidden`, so its row never
  shifts. The book band keeps one height for every pick.
- Scope page CSS to the page's own views (`#v-ways .seg`). Never style a kit class such as `.seg`,
  `.lead` or `.pc-lbl` globally.

## 8. The postcard and the book band

Every page has a postcard for the current pick: where, when, the price, the journeys in two or
three lines, and the one fact that matters most for this question (the January high, the work hours
lost, the nights). The red band at the bottom books exactly what the postcard shows.

- Show one price scope and name it. When the trip costs more than what the agent can book (trains
  to the airport, a hotel night, the resort bus), show both: "Trip ≈ CHF 249 · book now CHF 202".
  The band shows `bill.book`, with what it leaves out ("CHF 1,012 + ≈ 720 skis", "+ bag?").
- When the pick has nothing to book (your own car), the band books what there is (parking), or says
  "Nothing to book: fuel and tolls on the way".
- The checkout lists one line per ticket: its seller, its segments, its price, and its bag terms.
  A mixed journey is several tickets. See `booking.md`.

## 9. Phone

At 390 px wide, the map keeps the top third and shows both ends of the route. The card takes the
rest, and the postcard and the book band stay visible.

- The main view shows every option without a sideways scroll: make each option one compact row
  (name, one thin bar, the price). Three to six options fit without scrolling inside the card.
- On a touch screen a tap picks, so a tip never shows. Every fact a tip holds (the source, the fare
  basis, the transfers, a warning) is on the postcard of the pick or behind a small "i" button on the
  row.
- The limits beside a total (a "from" price, fees not read, hotels not counted) stay beside it on a
  phone, on the postcard and on the band. Shorten them; never hide them.
- In rows with a bar, give the figure column a fixed width, so every bar has the same width and
  the rows share one time axis. A phone list that opens one section at a time keeps one card height
  for every section.
- Keep on a phone what the answer needs: the measure's name and unit ("stress hours"), the top-pick
  mark, the weights line (one line, or behind an "i"), and the figure the question turns on for every
  row (the spare time before a meeting). Hide decoration first.
- The title is one line; shorten it on a phone. The map gets the band above the card and frames
  only the chosen route.
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
