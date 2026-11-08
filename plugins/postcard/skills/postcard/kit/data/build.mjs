// Builds world.json: Natural Earth 1:50m land, land borders and countries (with names) in one TopoJSON,
// quantized to 1e5 (about 400 m), so the chart loads one small file from the kit instead of three from CDNs.
//
//   npm i --no-save topojson-server@3 topojson-client@3 && node build.mjs
import fs from 'node:fs';
import { topology } from 'topojson-server';
import { feature } from 'topojson-client';

const NE = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/';
const get = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
const [landSrc, bordersSrc, wa] = await Promise.all([get(NE + 'ne_50m_land.geojson'), get(NE + 'ne_50m_admin_0_boundary_lines_land.geojson'),
  get('https://unpkg.com/world-atlas@2.0.2/countries-50m.json')]);

// The chart reads only the shapes of land and borders, and the name of each country.
const shapes = (fc) => ({ type: 'FeatureCollection', features: fc.features.filter((f) => f.geometry).map((f) => ({ type: 'Feature', properties: {}, geometry: f.geometry })) });
const countries = feature(wa, wa.objects.countries);
countries.features = countries.features.filter((f) => f.geometry).map((f) => ({ type: 'Feature', properties: { name: f.properties.name }, geometry: f.geometry }));

const out = new URL('world.json', import.meta.url);
fs.writeFileSync(out, JSON.stringify(topology({ land: shapes(landSrc), borders: shapes(bordersSrc), countries }, 1e5)));
console.log('wrote', out.pathname, fs.statSync(out).size, 'bytes');
