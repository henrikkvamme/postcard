# Kit data

`world.json` is the chart's base map: Natural Earth 1:50m land, land borders and countries in one TopoJSON. The objects are `land`, `borders` and `countries`; each country keeps only its `name`. Coordinates are quantized to 1e5, about 400 m, which is finer than the land layers show before they fade out at zoom 7.5.

Sources: [Natural Earth](https://www.naturalearthdata.com/) v5.1.2 (public domain) and [world-atlas](https://github.com/topojson/world-atlas) 2.0.2 (ISC).

To build it again:

```sh
cd kit/data
npm i --no-save topojson-server@3 topojson-client@3
node build.mjs
```
