---
name: postcard
description: Find, compare and book flights for a trip, and show the options as an engraved airmail map with a timeline, a trade-off chart and a booking flow. Use when someone asks to find flights, compare flight options, plan travel to an event or a meeting, or see their trip on a map. The agent reads real prices in a browser, writes one trip.json, and serves a page the person uses to pick and book. The agent stops at the payment page.
---

# Postcard

Postcard turns a travel question into a page. You read real flights and prices in a browser.
You write them into one `trip.json`. The viewer in this skill draws the trip from that file: a
globe with the routes, a postcard with the best pick, a timeline of every flight, a trade-off
chart, the sellers per flight and an itinerary. When the person picks a trip and clicks Book,
the page wakes you, and you fill the booking in their browser up to the payment page.

v1 covers flights. The data model keeps "flights", but the page is built so that trains and buses
can come later.

## Files

| Path | What it is |
| --- | --- |
| `viewer/` | The page: `index.html`, `app.js` and the engraved art in `art/`. Do not edit it for one trip. |
| `scripts/serve.py` | Serves a trip folder with the viewer and the checkout queue. |
| `scripts/check_trip.py` | Checks a `trip.json`. Run it after each edit. |
| `scripts/wait_checkout.py` | Waits for a Book click, claims it and exits, so your harness wakes you. |
| `examples/junction-2026/` | A complete real trip: 22 flights, sellers, an event and work hours. |
| `references/` | Read the one each step names. |

## Workflow

### 1. Brief

Find out what the trip is for before you search. Ask only what you cannot find yourself:

- From where, to where, and the earliest and latest days. Prefer the airports near both ends.
- The reason: an event with a schedule, a meeting, a holiday. Get the event's real schedule from
  its website. The schedule decides which flights are good.
- Work days the person would rather not lose, their hours and time zone, and whether they can work
  remotely on travel days.
- Passengers, bags, and sellers they accept (airlines only, or also travel agencies).
- Hard limits: budget, latest arrival, no overnight layovers.

Make a trip folder outside this skill, for example `~/trips/<name>/`. Everything for the trip lives
there.

### 2. Scrape

Read `references/sources.md`. Use any browser tool you have. Search each direction as one-way
flights over the whole window, then the round-trip deals. For each flight, record every seller and
price you see, with the source and the date. Keep a flight even when it looks bad; the page shows
why it is bad.

Do not solve captchas or work around bot checks. When a site blocks you, use another source and
say which site blocked you in `sources_note`.

### 3. Write trip.json

Read `references/trip-schema.md`. Start from `examples/junction-2026/trip.json` and replace the
values. Times are local wall times at each airport, as the sites show them. Then run:

```sh
python3 <skill>/scripts/check_trip.py ~/trips/<name>
```

Fix every error. Read the warnings.

### 4. Show

```sh
python3 <skill>/scripts/serve.py ~/trips/<name> --port 4471
```

Run it in the background. It serves on all interfaces, so the person can open it from another
machine on their tailnet. Give them a link with the machine's host name, not `localhost`.

Look at the page yourself before you send the link. Check the console for errors. Read
`references/ranking.md` if the best match looks wrong. The ranking comes from the event moments,
the work hours and the presets.

You can make the page your own. Read `references/design.md`. A file in the trip folder replaces the
viewer's file with the same path, so you can add art, change the copy, or copy `app.js` into the
trip folder and change how it draws. Keep the viewer in the skill unchanged.

### 5. Book

Read `references/booking.md` before the person clicks Book. In short: start
`scripts/wait_checkout.py` as a background command. When it exits with a job, fill the booking in
the person's browser and report each step to the page. Stop on the payment page. Never pay, and
never type card details. After the person pays, they click "I've paid" on the page. This wakes you
again for the work after booking: the calendar, the ticket check and the check-in reminders.

## Rules

- Real data only. Every price has a seller, a source and the date you saw it. When you did not
  check something, such as a bag fee, say so in a `warning`.
- One trip, one folder. Keep personal data (names, booking references) out of `trip.json`. The page
  does not need it.
- Stop at the payment page, every time.
- Stop the server and the waiter when the person is done.
