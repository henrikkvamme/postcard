# Verify

Look at the page before you send the link. A page that renders is not a page that works, and a page
that works can still tell the person something false. Do each step and fix what it finds.

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

Use any browser tool you have (Chrome DevTools, Playwright). Set the size with the tool's device
emulation, not by resizing the window: a headless window does not resize. With
`chrome-devtools-axi`, run `emulate --viewport "1440x900x1"` before you open the page.

1. Open the page and wait until the intro ends (about 4 s).
2. Read the console. No errors. Map library debug warnings are fine.
3. Run the probe:

   ```js
   import('/kit/probe.js').then((m) => m.probe())
   ```

   It returns lists that must be empty: `hiddenEnds` (a route end off screen or under the HUD),
   `pageOverflow`, `smallText`, `clipped`, `hudOverlap`, `hudOff`, `unnamed` (buttons without
   a name), `manySizes` (more than six text sizes in the HUD), `spill` (content out of its card),
   `cutOff` (content cut by a box that hides overflow) and `sideScroll` (a box that scrolls
   sideways). `ok` is true when they are all empty. Run it again after you change the pick and
   after each tab or view: a card can fit the default and spill on another pick. Also read `redText`: every red text outside the book band must be the pick or the one
   failing fact on the postcard (craft.md, rule 6).
4. Take a screenshot and look at it as the person would. Does the main view answer the question in
   five seconds? Is the best option obvious? Does the postcard match the pick?

## 4. Read it as the person

For the default pick and one other pick, read every number and claim on the postcard, the book
band and the checkout against `trip.json`:

- Each price is a sum you can repeat from the offers, deals, bag fees and estimates.
- What the total leaves out is written next to it (craft.md, rule 3).
- Each estimate has ≈ and a basis. No assumption is shown as a fact.
- Times are the times on the ticket, with +1 for the next day. The postcard and the checkout show
  the same times.
- "Door to door", "nights", "best" mean what they say.

## 5. Use it

- Click every control once. Each must change something you can see: the pick, a price, the map.
  If one changes nothing for this data, remove it (craft.md, rule 4).
- Pick another option. The map reframes, the postcard and the book band follow, and nothing else
  moves (craft.md, rule 7).
- Hover the timeline or a row. The vehicle moves along the route and the status line reads well.
- Tab through the HUD. Each control and each option is reachable, Enter picks, and focus stays on
  what you used.
- Open the checkout sheet, Tab through it (focus stays inside), and close it with Esc.
- Reload. Saved choices come back.

## 6. Laptop and phone

Emulate a laptop of 1280 x 720, reload and run the probe: everything in the card still fits.

Emulate a phone of 390 x 844 (`emulate --viewport "390x844x2,mobile,touch"`). Reload, run the probe
again, and take a screenshot. Both ends of the chosen route must be on screen above the card, and
every option of the main view must be visible without a sideways scroll (craft.md, rule 9).

## 7. Reduced motion

Open the page with `?reduced=1` (or emulate `prefers-reduced-motion: reduce` when your tool can).
The map must not fly; the page must still work.

## 8. Send

Send the link with one or two lines: what the page answers, the best option and its price, and
what you could not check. Stop the server when the person is done.
