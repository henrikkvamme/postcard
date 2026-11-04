---
name: postcard
description: Find, compare and book travel (flights, trains, buses, ferries, drives), and show the options as a page on an engraved airmail map, with a HUD you design for the person's question. Use when someone asks to find flights or trains, compare ways or dates to travel, plan travel to an event, a holiday or a multi-stop trip, or see a trip on a map. The agent reads real prices in a browser, writes one trip.json, builds the page from the kit and the closest example, and stops at the payment page when booking.
---

# Postcard

Postcard turns a travel question into a page. You read real journeys and prices in a browser and
write them into one `trip.json`. Then you build a page for this person's question: the map is
fixed (an engraved sea chart with the routes, drawn the way each mode travels), and the HUD on top
is yours to design. When the person picks an option and clicks Book, the page wakes you, and you
fill the booking in their browser up to the payment page.

## Files

| Path | What it is |
| --- | --- |
| `kit/` | The fixed parts: the chart, the trip model, time, the timeline, HUD parts, the checkout, the probe, the CSS and the art. API in `references/kit.md`. |
| `examples/junction-2026/` | Flights to an event: ranked choices against the event schedule and work hours, on an hour-scale timeline. |
| `examples/winter-sun/` | A holiday: three places by start week in a grid, the price with bags and travel time, a day-scale timeline. |
| `scripts/check_trip.py` | Checks a trip folder. Run it after each edit of `trip.json`. |
| `scripts/serve.py` | Serves a trip folder, the kit at `/kit/`, and the checkout queue. |
| `scripts/wait_checkout.py` | Waits for a Book click, claims it and exits, so your harness wakes you. |
| `references/` | Read the one each step names. |

## Size the job

- **A quick answer** ("what is the cheapest flight to Lisbon on Friday?"): search and answer in
  text. No page.
- **A choice between a few options**: a page from the closest example with small changes.
- **A real decision** (several dates, places, modes, sellers or people): the full workflow below,
  with a HUD designed for the question.

## Workflow

### 1. Brief

Find out what the trip is for before you search. Ask only what you cannot find yourself:

- From where, to where, and the earliest and latest days. Nearby airports and stations at both ends.
- The reason: an event with a schedule, a meeting, a holiday, a visit. Get an event's real schedule
  from its website.
- What matters: price, time, work hours lost, the event, comfort, the climate, the number of
  changes. Hard limits: budget, latest arrival, no night travel, a child's nap.
- Passengers, bags, and the sellers they accept (operators only, or also travel agencies).

Write the question in one line. It decides the page (`references/craft.md`, rule 1).

Make a trip folder outside this skill, for example `~/trips/<name>/`.

### 2. Search

Read `references/sources.md`. Use any browser tool you have. For each leg, search every mode that
makes sense (a train under about 6 hours often beats a plane door to door), over the whole window.
Record every seller and price you see, with the source, the date, and the bag terms. Keep an option
even when it looks bad; the page shows why it is bad. Get the line a train, bus or ferry follows
when you can (`references/trip-schema.md`, paths).

Do not solve captchas or work around bot checks. When a site blocks you, use another source and say
which one blocked you in `sources.note`.

### 3. Write trip.json

Read `references/trip-schema.md`. Facts only: places, journeys, offers, deals, and in `context` the
other facts the page needs (event, work hours, climate) with their sources. Then:

```sh
python3 <skill>/scripts/check_trip.py ~/trips/<name>
```

Fix every error. Read every warning.

### 4. Build the page

1. Read `references/craft.md` and `references/kit.md`.
2. Copy `index.html` and `app.js` from the closest example into the trip folder.
3. Write the model first: what one option is, what it costs, how options rank. Pure functions at the
   top of `app.js`, on top of `T.best`, `T.price` and `T.combos`.
4. Then the HUD: the one main view that answers the question, the postcard of the pick, the
   controls that change it, the book band. Remove every part of the example that this question does
   not need.

Do not edit `kit/` for one trip. Write what the kit lacks in the page.

### 5. Verify

Follow `references/verify.md`: the check, the console, the probe at desktop and phone width,
every control, reduced motion, and a screenshot you look at as the person would. Then send the
link with the host name, not `localhost`.

### 6. Book

Read `references/booking.md` before the person clicks Book. In short: start
`scripts/wait_checkout.py` as a background command. When it exits with a job, fill the booking in
the person's browser and report each step to the page. Stop on the payment page. Never pay, and
never type card details. After the person pays, they click "I've paid", which wakes you for the
work after booking: the calendar, the ticket check and the check-in reminders.

## Rules

- Real data only. Every price has a seller, a source and the date you saw it. When you did not
  check something, such as a bag fee, the page says so.
- One trip, one folder. Keep personal data (names, booking references) out of `trip.json`.
- Stop at the payment page, every time.
- Stop the server and the waiter when the person is done.
