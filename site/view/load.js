// Load a trip.json for the hosted viewer from an untrusted source, and make it safe for the kit.
//
// Sources: a URL (#trip=), a compressed copy in the link (#data=), dropped or picked files, or a message
// from the page that embeds this one. Every source ends in prepare(), which:
//   1. checks the size and the shape, so a small link cannot fill the browser's memory;
//   2. reads each GeoJSON path (relative to the trip URL, or from the dropped files) and puts the line
//      inline, so the kit never fetches a path itself; a path that is missing or bad is left out, and
//      the kit draws its faint straight dash;
//   3. cleans every string: the kit's chart puts place names and map labels into the page as HTML, so
//      no string may carry a tag.
// The original text stays with the trip (prepared.text), so a reload or a share link has the same file.

export const LIMITS = { bytes: 8e6, linkChars: 2.8e6, journeys: 2000, places: 2000, pathFiles: 400, points: 250000, pathBytes: 5e6, pathTotal: 24e6, pathsAtOnce: 6, string: 2000 };

export class TripError extends Error {}

// ---------- Reading bytes with a limit ----------
async function readCapped(stream, max, what) {
  const r = stream.getReader(), parts = []; let n = 0;
  for (;;) { const { done, value } = await r.read(); if (done) break;
    n += value.byteLength; if (n > max) { r.cancel().catch(() => {}); throw new TripError(`${what} is larger than ${Math.round(max / 1e6)} MB.`); }
    parts.push(value); }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.byteLength; }
  return new TextDecoder().decode(out);
}

export async function fetchText(url, max = LIMITS.bytes, what = 'The file') {
  let res;
  try { res = await fetch(url, { cache: 'no-store', credentials: 'omit', redirect: 'follow' }); }
  catch { throw new TripError(`Could not read ${url}. The server must allow this site to read it (CORS), or you can drop the file here instead.`); }
  if (!res.ok) throw new TripError(`${url} answered HTTP ${res.status}.`);
  if (+res.headers.get('content-length') > max) throw new TripError(`${what} is larger than ${Math.round(max / 1e6)} MB.`);
  return readCapped(res.body, max, what);
}

// ---------- The link format: #data=<base64url of gzip(trip.json)> ----------
const b64url = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = (s) => { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const b = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i); return b; };

export async function encodeData(text) {
  const gz = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return b64url(new Uint8Array(gz));
}
export async function decodeData(s) {
  if (s.length > LIMITS.linkChars) throw new TripError('The trip in this link is too large.');
  let bytes; try { bytes = unb64url(s); } catch { throw new TripError('The trip in this link is damaged.'); }
  try { return await readCapped(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')), LIMITS.bytes, 'The trip in this link'); }
  catch (e) { throw e instanceof TripError ? e : new TripError('The trip in this link is damaged.'); }
}

// ---------- Cleaning ----------
// A string loses angle brackets and is cut to a fair length. Keys are cleaned too: a place id can reach a label.
const cleanStr = (s) => s.replace(/[<>]/g, '').slice(0, LIMITS.string);
function clean(v, depth = 0) {
  if (depth > 40) throw new TripError('The trip nests too deep.');
  if (typeof v === 'string') return cleanStr(v);
  if (Array.isArray(v)) return v.map((x) => clean(x, depth + 1));
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) { const ck = cleanStr(k); if (ck !== '__proto__') o[ck] = clean(x, depth + 1); } return o; }
  return v;
}

const isCoord = (c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;

function checkShape(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TripError('This is not a trip.json: the file is not a JSON object.');
  if (raw.flights && !raw.journeys) throw new TripError('This trip.json is version 1 (flights). Ask your agent to move it to version 2 (journeys).');
  if (!Array.isArray(raw.journeys) || !raw.places || typeof raw.places !== 'object') throw new TripError('This is not a trip.json: it has no journeys or no places.');
  if (raw.journeys.length > LIMITS.journeys) throw new TripError(`The trip has more than ${LIMITS.journeys} journeys.`);
  if (Object.keys(raw.places).length > LIMITS.places) throw new TripError(`The trip has more than ${LIMITS.places} places.`);
  for (const [id, p] of Object.entries(raw.places)) {
    if (!p || !isCoord(p.coord)) throw new TripError(`Place ${id} has no valid coord ([lng, lat]).`);
    if (typeof p.tz !== 'string') throw new TripError(`Place ${id} has no time zone (tz).`);
    try { new Intl.DateTimeFormat('en', { timeZone: p.tz }); } catch { throw new TripError(`Place ${id} has an unknown time zone: ${p.tz}.`); }
  }
  for (const j of raw.journeys) {
    if (!j || !raw.places[j.from] || !raw.places[j.to]) throw new TripError(`Journey ${j?.id ?? '?'} goes from or to a place that is not in places.`);
    for (const s of j.segments || []) if (!raw.places[s.from] || !raw.places[s.to]) throw new TripError(`Journey ${j.id} has a segment from or to a place that is not in places.`);
  }
}

// ---------- Paths ----------
function linesOf(gj) {
  const lines = [];
  const walk = (g) => { if (!g || typeof g !== 'object') return;
    if (g.type === 'FeatureCollection' && Array.isArray(g.features)) g.features.forEach((f) => walk(f?.geometry));
    else if (g.type === 'Feature') walk(g.geometry);
    else if (g.type === 'LineString' && Array.isArray(g.coordinates)) lines.push(g.coordinates);
    else if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) lines.push(...g.coordinates); };
  walk(gj);
  return lines.map((l) => l.filter(isCoord).map(([x, y]) => [x, y])).filter((l) => l.length >= 2);
}

// Joins the parts end to end, as the kit does, and gives one inline line, or null.
function joinLines(lines) {
  const d = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2, out = [];
  for (const l of lines) { if (!out.length) { out.push(...l); continue; }
    const last = out[out.length - 1]; out.push(...(d(last, l[l.length - 1]) < d(last, l[0]) ? [...l].reverse() : l)); }
  return out.length >= 2 ? out : null;
}

// files: Map of relative path -> File (dropped). base: the trip URL, or null for dropped files.
async function inlinePaths(raw, { base, files }) {
  const holders = [];
  for (const j of raw.journeys) { holders.push(j); for (const s of j.segments || []) holders.push(s); }
  const wanted = [...new Set(holders.map((h) => h.path).filter((p) => typeof p === 'string'))];
  if (wanted.length > LIMITS.pathFiles) throw new TripError(`The trip names more than ${LIMITS.pathFiles} path files.`);
  // A few files at a time, inside one byte budget for all of them, so a small trip cannot ask for gigabytes.
  const read = new Map(), missing = [], queue = [...wanted];
  let left = LIMITS.pathTotal, pts = 0;
  // held: readers that hold a share now. A release wakes the readers that wait for budget.
  let held = 0, wake = [];
  const one = async (p) => {
    // Reserve this file's share before reading, so readers running at once never pass the budget together.
    // Bytes read stay spent; a file that was not there, or answered an error, gives its share back.
    // When the others hold the whole budget, wait for them to give back what they did not use.
    while (left <= 0 && held) await new Promise((ok) => wake.push(ok));
    const cap = Math.min(LIMITS.pathBytes, left);
    if (cap <= 0) { missing.push(p); return; }
    left -= cap; held++;
    let used = 0;
    try {
      let text = null;
      if (files) { const f = files.get(p.replace(/^\.\//, '')); if (f && f.size <= cap) text = await f.text(); }
      else if (base) { const u = new URL(p, base); if (u.protocol === 'https:' || u.protocol === 'http:') text = await fetchText(u.href, cap, p); }
      used = text ? new TextEncoder().encode(text).length : 0;
      const line = text ? joinLines(linesOf(JSON.parse(text))) : null;
      if (line && (pts += line.length) <= LIMITS.points) read.set(p, line); else missing.push(p);
    } catch (e) { if (/larger than/.test(e?.message)) used = cap; missing.push(p); }
    finally { left += cap - used; held--; const w = wake; wake = []; w.forEach((ok) => ok()); }
  };
  await Promise.all(Array.from({ length: LIMITS.pathsAtOnce }, async () => { while (queue.length) await one(queue.shift()); }));
  let points = 0;
  for (const h of holders) {
    if (h.path == null) continue;
    let line = typeof h.path === 'string' ? read.get(h.path) : Array.isArray(h.path) ? h.path.filter(isCoord).map(([x, y]) => [x, y]) : null;
    if (line && line.length < 2) line = null;
    if (line && (points += line.length) > LIMITS.points) line = null;
    if (line) h.path = line; else delete h.path;
  }
  return missing;
}

// ---------- Prepare ----------
// text: the trip.json text. base: the URL it came from (or null). files: dropped files by relative path.
// Returns { raw (clean, paths inline), text (the original), base, missing (paths not read) }.
export async function prepare(text, { base = null, files = null } = {}) {
  if (text.length > LIMITS.bytes) throw new TripError('The trip is larger than 8 MB.');
  let parsed; try { parsed = JSON.parse(text); } catch (e) { throw new TripError(`This is not valid JSON: ${e.message}`); }
  checkShape(parsed);
  const raw = clean(parsed);
  const missing = await inlinePaths(raw, { base, files });
  return { raw, text, base, missing };
}

// The text to keep in a link: the original with every path inline, so the link needs no other file.
export const selfContained = (prepared) => JSON.stringify({ ...JSON.parse(prepared.text), journeys: prepared.raw.journeys });

// Dropped files and folders, by their path relative to the folder that holds trip.json.
export async function filesFromDrop(dt) {
  const out = [];
  const walk = async (entry, prefix) => {
    if (entry.isFile) { const f = await new Promise((ok, no) => entry.file(ok, no)); out.push([prefix + f.name, f]); }
    else if (entry.isDirectory) { const r = entry.createReader(); let batch;
      do { batch = await new Promise((ok, no) => r.readEntries(ok, no)); for (const e of batch) await walk(e, prefix + entry.name + '/'); } while (batch.length && out.length < 2000); }
  };
  const entries = [...(dt.items || [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length) for (const e of entries) await walk(e, '');
  else for (const f of dt.files || []) out.push([f.name, f]);
  return fromList(out);
}
export const filesFromInput = (list) => fromList([...list].map((f) => [f.webkitRelativePath || f.name, f]));

// Finds trip.json (or the one .json file) and keys the rest relative to its folder.
function fromList(pairs) {
  const jsons = pairs.filter(([p]) => /\.json$/i.test(p) && !/\.geojson$/i.test(p));
  const trip = jsons.find(([p]) => /(^|\/)trip\.json$/i.test(p)) || (jsons.length === 1 ? jsons[0] : null);
  if (!trip) throw new TripError(jsons.length ? 'Drop one trip.json, or its folder.' : 'No trip.json in what you dropped.');
  if (trip[1].size > LIMITS.bytes) throw new TripError('The trip is larger than 8 MB.');
  const dir = trip[0].includes('/') ? trip[0].slice(0, trip[0].lastIndexOf('/') + 1) : '';
  const files = new Map(pairs.filter(([p]) => p.startsWith(dir)).map(([p, f]) => [p.slice(dir.length), f]));
  return { trip: trip[1], files };
}
