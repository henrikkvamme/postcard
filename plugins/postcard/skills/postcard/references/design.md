# The page, and how to make it your own

## What the person sees

- **The chart.** A MapLibre globe in the style of an engraved navy sea chart, with terrain, an
  airmail border and drawings that stand up like paper cut-outs. deck.gl draws the routes as arcs,
  the chosen trip in red and the others dashed. A 3D plane sits on the outbound route. Zoom out to
  the globe and the HUD steps aside. A click on the globe flies back to the route.
- **Step 1, the postcard.** The best match: the price, both flights, work lost and event moments as
  small meters, and a stamp with the two departure postmarks. The dots and arrows step through the
  top five. The red band reads "Next: choose your tickets".
- **Step 2, the open card.** The card grows across the bottom. On the left are four views of the
  same choice: Timeline, Trade-off, Where to buy and Itinerary. On the right are the postcard and
  the chips for priority, seller and remote. The red band now books.

The map, tiles, terrain and country shapes come from OpenFreeMap, AWS terrain tiles and Natural
Earth. No API key is needed.

## Keys

`j`/`k` step through the ranking, `Esc` closes step 2 or goes back to the best match, `t` toggles
step 2, `v` cycles the views, `b` opens the checkout, `0` resets the map.

## Making it your own

`serve.py` looks for each file in the trip folder first, then in the viewer. So you can:

- **Add drawings.** Put PNG files in `<trip>/art/` and list them in `map.art`. The style is an
  engraved line drawing in navy ink (`#1d2a4a`) on a transparent background, about 360 px tall,
  standing on its bottom edge. If you can make images, make new ones in this style for the places
  on the route.
- **Change the copy or the look.** Copy `viewer/index.html` into the trip folder and change the CSS
  tokens in `:root` or the markup.
- **Change the model or add a view.** Copy `viewer/app.js` into the trip folder. A view is an
  element in `#panel .views` with `class="view" data-v="<key>"`, an entry in `VIEWS`, and a draw
  function that `renderView()` calls.

Keep the viewer in the skill unchanged, so other trips keep working.

## Drawings in the viewer

`art/` has: `alps`, `amsterdam`, `berlin`, `cartouche`, `compass`, `fjords`, `frankfurt`,
`helsinki`, `lighthouse`, `paris`, `pines`, `riga`, `ship`, `whale`, `zurich`, and the 3D plane
`airplane.glb`. Use a city drawing only for its own city. Use the others (ship, whale, compass,
lighthouse, pines) as decoration on open ground or sea, away from the route.

## Taste

The page is calm on purpose. Keep one accent colour (the stamp red) for the chosen trip and the one
action. Show state with position and colour, not with sentences. When you add something, remove
something.
