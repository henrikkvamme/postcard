# Postcard

A skill for coding agents. It finds flights, trains, buses and ferries for a trip, shows the
options on an engraved airmail map with a page built for your question, and books the one you
pick, up to the payment page.

You tell your agent where, when and why you travel. The agent reads real journeys and prices in a
browser, writes them into one `trip.json`, and builds a page from a fixed kit (the map, the trip
model, the timeline, the checkout) and the closest example. On the page you compare the options
and click Book. The agent fills the booking in your browser and stops on the payment page. You
pay. The agent then adds the flights to your calendar and reminds you to check in.

![Step 1: the best match on a postcard](docs/step1.jpg)

![Step 2: every flight on a timeline, with the choices](docs/step2.jpg)

The examples are real trips:

- **junction-2026**: Zürich to Helsinki for the Junction hackathon in November 2026, with 22 flights
  ranked against the event schedule and work hours.
- **winter-sun**: a warm week in January 2027 from Zürich or Basel, with Tenerife, Hurghada and
  Dubai by start week, priced with bags and travel time.

## What the page shows

- **A globe** in the style of an engraved sea chart, with terrain and drawings that stand up like
  paper cut-outs. Each mode has its own line: a great-circle arc and a 3D plane for flights, a line
  with ties for rail, a double line for roads, dashes for ferries. A small engraved vehicle rides
  the chosen route when you hover the timeline.
- **A HUD for your question.** The agent designs it: ranked choices against an event, a grid of
  places by week, a door-to-door comparison of train and plane, a loop of legs. It always has a
  postcard of the pick and a red band that books it.

The map uses OpenFreeMap tiles, AWS terrain tiles and Natural Earth. No API key is needed.

## Install

In Claude Code:

```
/plugin marketplace add henrikkvamme/postcard
/plugin install postcard@postcard
```

For another agent, copy `plugins/postcard/skills/postcard/` into its skills folder. The skill is a
`SKILL.md` with references, Python 3 scripts (standard library only) and a static web page.

Then ask, for example: "Find flights from Zürich to Helsinki for Junction, 12 to 16 November. I work
Friday and Monday."

## How it works

| Step | The agent |
| --- | --- |
| Brief | Asks for what it cannot find: dates, the event, work hours, sellers you accept. |
| Scrape | Reads schedules, sellers and deals with any browser tool. It does not solve captchas. |
| Write | Writes `trip.json` and checks it with `scripts/check_trip.py`. |
| Build | Copies the closest example, writes the model, then the HUD (`references/craft.md`). |
| Verify | Serves it with `scripts/serve.py` and checks it with `kit/probe.js` at desktop and phone width. |
| Book | Waits for your Book click with `scripts/wait_checkout.py`, fills the booking, stops at payment. |

Each trip folder holds `trip.json`, `index.html` and `app.js`. The server serves the kit at
`/kit/` from the skill, so a page imports what it needs and keeps only its own design.

The data format is in
[`references/trip-schema.md`](plugins/postcard/skills/postcard/references/trip-schema.md).

## Develop

```sh
python3 tests/test_scripts.py
python3 plugins/postcard/skills/postcard/scripts/serve.py plugins/postcard/skills/postcard/examples/junction-2026
```

## License

MIT
