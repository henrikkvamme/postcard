// The parts of deck.gl, d3 and topojson-client that the kit and the home page use, as the same globals the
// CDN builds give (deck, d3, topojson). One file instead of three, with no unused layers.
import { WebMercatorViewport } from '@deck.gl/core';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { PathStyleExtension } from '@deck.gl/extensions';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { min, max, sum, mean, least, greatest, range } from 'd3-array';
import { geoDistance, geoInterpolate, geoContains, geoBounds } from 'd3-geo';
import { scaleLinear } from 'd3-scale';
import { select, pointer } from 'd3-selection';
import { feature } from 'topojson-client';

window.deck = { WebMercatorViewport, PathLayer, ScatterplotLayer, ScenegraphLayer, PathStyleExtension, MapboxOverlay };
window.d3 = { min, max, sum, mean, least, greatest, range, geoDistance, geoInterpolate, geoContains, geoBounds, scaleLinear, select, pointer };
window.topojson = { feature };
