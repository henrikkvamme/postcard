"""Shared helpers for the scrape scripts. Python 3 stdlib only.

- http_json / http_text: GET or POST with a polite User-Agent and a file cache.
- unwrap: read the output of any browser tool's eval and return the JSON value inside.
- decode_polyline, simplify, write_path: route lines for the map.
- local_time: turn a UTC timestamp into a local wall time for trip.json.
"""
import datetime as dt
import hashlib
import json
import math
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

UA = "postcard-skill/0.2 (travel planner for one person; github.com/henrikkvamme/postcard)"
CACHE = os.environ.get("POSTCARD_CACHE", os.path.expanduser("~/.cache/postcard"))
OFFLINE = os.environ.get("POSTCARD_OFFLINE") == "1"


def today():
    return dt.date.today().isoformat()


def _cache_path(key):
    return os.path.join(CACHE, "http", hashlib.sha1(key.encode()).hexdigest()[:20] + ".json")


def http_text(url, data=None, headers=None, ttl=86400, timeout=60):
    """GET (or POST when data is set) and return the body as text.

    The body is cached for ttl seconds under ~/.cache/postcard. Set POSTCARD_OFFLINE=1 to read
    only the cache. Tests point POSTCARD_CACHE at a fixture folder.
    """
    key = url + "\n" + (data if isinstance(data, str) else json.dumps(data, sort_keys=True) if data else "")
    path = _cache_path(key)
    if os.path.exists(path) and (OFFLINE or ttl is None or time.time() - os.path.getmtime(path) < ttl):
        with open(path, encoding="utf-8") as f:
            return json.load(f)["body"]
    if OFFLINE:
        raise RuntimeError(f"offline and not cached: {url}")
    body = None
    if data is not None:
        body = data.encode() if isinstance(data, str) else urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body, headers={"User-Agent": UA, "Accept": "application/json", **(headers or {})})
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                text = r.read().decode("utf-8")
            break
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 502, 503, 504) and attempt < 2:
                time.sleep(3 * (attempt + 1))
                continue
            raise RuntimeError(f"HTTP {e.code} from {url.split('?')[0]}") from e
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
            if attempt < 2:
                time.sleep(2)
                continue
            raise RuntimeError(f"cannot reach {url.split('?')[0]}: {e}") from e
    else:
        raise RuntimeError(str(last))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"url": url, "fetched": today(), "body": text}, f)
    return text


def http_json(url, **kw):
    return json.loads(http_text(url, **kw))


def unwrap(text):
    """Return the JSON value inside a browser tool's eval output.

    Works with plain JSON, a JSON string that holds JSON (one or more levels), and the
    chrome-devtools-axi form `result: "..."` with help lines after it.
    """
    s = text.strip()
    m = re.search(r"^result:\s*", s, re.M)
    if m:
        s = s[m.end():]
        s = re.split(r"\n(?:help|browser_target|page)\[?\d*\]?:", s)[0].strip()
    v = s
    for _ in range(5):
        if not isinstance(v, str):
            return v
        try:
            v = json.loads(v)
        except json.JSONDecodeError:
            break
    if isinstance(v, str):
        i, j = v.find("{"), v.rfind("}")
        if i >= 0 and j > i:
            return json.loads(v[i:j + 1])
        raise ValueError("no JSON found in browser output")
    return v


def decode_polyline(points, precision=5):
    """Decode a Google encoded polyline. Returns [[lng, lat], ...]."""
    coords, idx, lat, lng, f = [], 0, 0, 0, 10 ** precision
    while idx < len(points):
        for which in (0, 1):
            shift = result = 0
            while True:
                b = ord(points[idx]) - 63
                idx += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            d = ~(result >> 1) if result & 1 else result >> 1
            if which == 0:
                lat += d
            else:
                lng += d
        coords.append([lng / f, lat / f])
    return coords


def _perp(p, a, b):
    # Distance in degrees, scaled by cos(lat) so east-west and north-south count the same.
    k = math.cos(math.radians(a[1]))
    ax, ay, bx, by, px, py = a[0] * k, a[1], b[0] * k, b[1], p[0] * k, p[1]
    dx, dy = bx - ax, by - ay
    if dx == dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def simplify(coords, tol=0.002):
    """Douglas-Peucker. tol is in degrees (0.002 is about 200 m). Keeps first and last point."""
    if len(coords) < 3:
        return coords
    keep = [False] * len(coords)
    keep[0] = keep[-1] = True
    stack = [(0, len(coords) - 1)]
    while stack:
        i, j = stack.pop()
        best, k = 0, None
        for n in range(i + 1, j):
            d = _perp(coords[n], coords[i], coords[j])
            if d > best:
                best, k = d, n
        if k is not None and best > tol:
            keep[k] = True
            stack += [(i, k), (k, j)]
    return [c for c, f in zip(coords, keep) if f]


def round_coords(coords, nd=5):
    return [[round(c[0], nd), round(c[1], nd)] for c in coords]


def write_path(coords, path, props=None, tol=0.002):
    """Write a GeoJSON LineString file and return the point count."""
    line = round_coords(simplify(coords, tol))
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"type": "Feature", "properties": props or {},
                   "geometry": {"type": "LineString", "coordinates": line}}, f, separators=(",", ":"))
    return len(line)


def haversine_km(a, b):
    """a and b are [lng, lat]."""
    r = 6371.0
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    dla, dlo = la2 - la1, math.radians(b[0] - a[0])
    h = math.sin(dla / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlo / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def local_time(utc_iso, tz):
    """'2026-12-03T06:59:00Z' + 'Europe/Zurich' -> '2026-12-03T07:59'."""
    t = dt.datetime.fromisoformat(utc_iso.replace("Z", "+00:00"))
    return t.astimezone(ZoneInfo(tz)).strftime("%Y-%m-%dT%H:%M")


def to_utc(local_iso, tz):
    """'2026-12-03T07:59' + 'Europe/Zurich' -> '2026-12-03T06:59:00Z'."""
    t = dt.datetime.fromisoformat(local_iso).replace(tzinfo=ZoneInfo(tz))
    return t.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def slug(name, n=12):
    s = name.upper()
    for a, b in (("Ä", "AE"), ("Ö", "OE"), ("Ü", "UE"), ("Å", "AA"), ("Ø", "OE"), ("Æ", "AE"), ("ß", "SS")):
        s = s.replace(a, b)
    import unicodedata
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Z0-9]+", "-", s).strip("-")[:n].strip("-")


def dump(obj, out=None):
    text = json.dumps(obj, ensure_ascii=False, indent=1)
    if out:
        with open(out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    else:
        print(text)


FX = "https://api.frankfurter.dev/v1/latest"


def fx(amount, frm, to):
    """Convert with the European Central Bank reference rate (Frankfurter, keyless).

    Returns {"price", "rate", "rate_date", "original": {"price", "currency"}}. Use it when a site sells in
    another currency than the trip: keep the original price in the offer, so the person sees both."""
    if frm == to:
        return {"price": amount, "rate": 1.0, "rate_date": today(), "original": None}
    d = http_json(f"{FX}?{urllib.parse.urlencode({'from': frm, 'to': to})}", ttl=86400)
    rate = d["rates"][to]
    return {"price": round(amount * rate, 2), "rate": rate, "rate_date": d["date"],
            "original": {"price": amount, "currency": frm}}


if __name__ == "__main__":
    import sys
    if len(sys.argv) == 5 and sys.argv[1] == "fx":
        dump(fx(float(sys.argv[2]), sys.argv[3].upper(), sys.argv[4].upper()))
    else:
        print("usage: python3 common.py fx AMOUNT FROM TO   # such as: fx 823 NOK EUR")


# --- town names and zones -------------------------------------------------------------------

_STATION_WORDS = {"hbf", "hauptbahnhof", "hb", "centraal", "centralstation", "central", "station",
                  "bahnhof", "sbb", "gare", "aéroport", "aeroport", "flughafen", "airport", "zob",
                  "place", "hall", "bus", "busstation", "flixbus", "terminal", "ferry", "stop"}
_LAST_ONLY = {"h", "s"}
_LEAD = {"s+u", "s", "u", "s-bahn", "bahnhof"}
TOWN_ALIAS = {"københavn": "Copenhagen", "köpenhamn": "Copenhagen", "koebenhavn": "Copenhagen",
              "kopenhagen": "Copenhagen", "genève": "Geneva", "genf": "Geneva"}


def town(name):
    """The town a person knows, from a station or stop name: "Zürich HB" -> "Zürich",
    "S+U Berlin Hauptbahnhof" -> "Berlin", "Paris Gare de Lyon Hall 1 - 2" -> "Paris".
    A name that is only a station word ("Hauptbahnhof") comes back unchanged: the caller must
    name the town."""
    s = re.split(r"\s+\(|,|\s+[-–]\s+", name.strip())[0].strip()
    toks = [(m.group(0), m.start()) for m in re.finditer(r"[^\s\-–/]+", s)]
    while toks and toks[0][0].lower() in _LEAD and len(toks) > 1:
        s, toks = s[toks[1][1]:], [(t, p - toks[1][1]) for t, p in toks[1:]]
    for i, (t, pos) in enumerate(toks):
        low = t.lower()
        if i and (low in _STATION_WORDS or (low in _LAST_ONLY and i == len(toks) - 1)):
            s = s[:pos].rstrip(" -–/")
            break
    if s.isupper():
        s = s.title()
    return TOWN_ALIAS.get(s.lower(), s) or name


# One zone for the whole country, for the countries where the feed or airport table can be wrong.
COUNTRY_TZ = {"CH": "Europe/Zurich", "NL": "Europe/Amsterdam", "BE": "Europe/Brussels",
              "DE": "Europe/Berlin", "AT": "Europe/Vienna", "DK": "Europe/Copenhagen",
              "NO": "Europe/Oslo", "SE": "Europe/Stockholm", "FR": "Europe/Paris",
              "IT": "Europe/Rome", "CZ": "Europe/Prague", "PL": "Europe/Warsaw"}
