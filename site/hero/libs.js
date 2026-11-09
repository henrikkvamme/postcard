// The map libraries as classic scripts: maplibre, and one bundle of the deck.gl, d3 and topojson parts in use
// (site/vendor, built into the image). type.js calls libs() after it has drawn the hero, so they never delay it;
// libs() runs them and resolves when the globals (maplibregl, deck, d3, topojson) exist.
const URLS = ['/vendor/maplibre-gl.js', '/vendor/map.js'];
const load = (src) => new Promise((ok, fail) => {
  const s = document.createElement('script'); s.src = src; s.async = false;
  s.onload = ok; s.onerror = () => fail(new Error('Could not load ' + src)); document.head.append(s);
});
let p = null;
// The chart's base map downloads at the same time; its fetch() picks up this preload.
const preload = (href) => document.head.append(Object.assign(document.createElement('link'), { rel: 'preload', as: 'fetch', href, crossOrigin: 'anonymous' }));
export const libs = () => p ??= (preload('/kit/data/world.json'), Promise.all(URLS.map(load)));
