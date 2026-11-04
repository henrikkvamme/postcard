# Verify

Look at the page before you send the link. A page that renders is not a page that works. Do each
step and fix what it finds.

## 1. The data

```sh
python3 <skill>/scripts/check_trip.py ~/trips/<name>
```

Fix every error. Read every warning; most are something the page will show wrong. A warning you
accept (an agency with no rating anywhere) is fine; say it on the page when it matters.

## 2. Serve

```sh
python3 <skill>/scripts/serve.py ~/trips/<name> --port 4471
```

Run it in the background. When the port is busy it takes the next free one; read the URL it
prints. It listens on all interfaces; give the person the machine's host name, not `localhost`.

## 3. Load it in a browser

Use any browser tool you have (Chrome DevTools, Playwright). At 1440 x 900:

1. Open the page and wait until the intro ends (about 4 s).
2. Read the console. No errors. Map library debug warnings are fine.
3. Run the probe:

   ```js
   import('/kit/probe.js').then((m) => m.probe())
   ```

   It returns lists that must be empty: `hiddenEnds` (a route end off screen or under the HUD),
   `pageOverflow`, `smallText`, `clipped`, `hudOverlap`, `hudOff` and `unnamed` (buttons without
   a name). `ok` is true when they are all empty.
4. Take a screenshot and look at it as the person would. Does the main view answer the question in
   five seconds? Is the best option obvious? Does the postcard match the pick?

## 4. Use it

- Click every control once. Each must change something you can see: the pick, a price, the map.
  If one changes nothing for this data, remove it (see craft.md, rule 3).
- Pick another option. The map reframes, the postcard and the book band follow.
- Hover the timeline. The vehicle moves along the route and the status line reads well.
- Open the checkout sheet and close it with Esc.
- Reload. Saved choices come back.

## 5. Phone

Emulate a phone of 390 x 844 (a desktop window cannot shrink that far; use the tool's device
emulation, for example `emulate --viewport "390x844x3,mobile,touch"`). Reload, run the probe again,
and take a screenshot. Both ends of the chosen route must be on screen above the card.

## 6. Reduced motion

Emulate `prefers-reduced-motion: reduce` and reload. The map must not fly; the page must still
work.

## 7. Send

Send the link with one or two lines: what the page answers, the best option and its price, and
what you could not check. Stop the server when the person is done.
