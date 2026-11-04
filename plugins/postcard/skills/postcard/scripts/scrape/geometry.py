#!/usr/bin/env python3
"""Route lines for the map. Keyless sources only.

Places are "lat,lng" (the order Google Maps shows) or a name. A name is found with Nominatim.

  python3 geometry.py road  "Zürich" "Val Thorens" --out paths/car.geojson     # OSRM driving line, km and minutes
  python3 geometry.py ferry "Oslo" "Copenhagen" --out paths/dfds.geojson       # OSM ferry route relation
  python3 geometry.py rail  "Moûtiers" "Val Thorens" --date 2027-02-13 --out paths/x.geojson  # Transitous line
  python3 geometry.py line  "59.9,10.7" "55.7,12.6" --out paths/x.geojson      # straight line, last resort

Every command prints {"path", "points", "km", "minutes", "source"}. Trains, buses and ferries from
transitous.py already carry their line; use this script for car, taxi, ferries Transitous does not
know, and a line for a bus that only has a timetable.
"""
import argparse
import json
import os
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import decode_polyline, haversine_km, http_json, http_text, write_path  # noqa: E402

OSRM = [os.environ.get("OSRM_URL", "https://router.project-osrm.org/route/v1/driving"),
        "https://routing.openstreetmap.de/routed-car/route/v1/driving"]
OVERPASS = [os.environ.get("OVERPASS_URL", "https://overpass-api.de/api/interpreter"),
            "https://overpass.kumi.systems/api/interpreter"]


def point(text):
    """Return [lng, lat] for 'lat,lng' or a place name."""
    p = text.strip()
    parts = p.split(",")
    if len(parts) == 2:
        try:
            lat, lng = float(parts[0]), float(parts[1])
            return [lng, lat]
        except ValueError:
            pass
    q = urllib.parse.urlencode({"q": p, "format": "json", "limit": 1})
    rows = http_json(f"https://nominatim.openstreetmap.org/search?{q}", ttl=90 * 86400)
    if not rows:
        raise SystemExit(f"no place found for '{text}'")
    return [round(float(rows[0]["lon"]), 5), round(float(rows[0]["lat"]), 5)]


def road(points, alternatives=False):
    """Driving route over OSRM. Returns a list of {coords, km, minutes}."""
    coords = ";".join(f"{p[0]},{p[1]}" for p in points)
    q = "overview=full&geometries=polyline6" + ("&alternatives=true" if alternatives else "")
    last = None
    for base in OSRM:
        try:
            d = http_json(f"{base}/{coords}?{q}", ttl=30 * 86400)
        except RuntimeError as e:
            last = e
            continue
        if d.get("code") != "Ok":
            last = RuntimeError(d.get("message") or d.get("code"))
            continue
        return [{"coords": decode_polyline(r["geometry"], 6), "km": round(r["distance"] / 1000, 1),
                 "minutes": round(r["duration"] / 60), "source": base.split("/")[2]} for r in d["routes"]]
    raise SystemExit(f"OSRM failed: {last}")


def overpass(query):
    last = None
    for base in OVERPASS:
        try:
            return json.loads(http_text(base, data={"data": query}, ttl=90 * 86400, timeout=120))
        except (RuntimeError, json.JSONDecodeError) as e:
            last = e
    raise SystemExit(f"Overpass failed: {last}")


def stitch(ways):
    """Join way geometries (lists of [lng, lat]) into one line, end to end."""
    ways = [w for w in ways if len(w) > 1]
    if not ways:
        return []
    line = list(ways.pop(0))
    while ways:
        best, bi, flip_line, flip_way = None, None, False, False
        for i, w in enumerate(ways):
            for fl, end in ((False, line[-1]), (True, line[0])):
                for fw, start in ((False, w[0]), (True, w[-1])):
                    d = haversine_km(end, start)
                    if best is None or d < best:
                        best, bi, flip_line, flip_way = d, i, fl, fw
        w = ways.pop(bi)
        if flip_way:
            w = w[::-1]
        if flip_line:
            line = line[::-1]
        line += w[1:] if haversine_km(line[-1], w[0]) < 0.05 else w
    return line


def ferry(a, b, name=None, radius_km=15):
    """Find the OSM ferry route relation that links a and b ([lng, lat]) and return its line."""
    pad = 0.3
    s, n = min(a[1], b[1]) - pad, max(a[1], b[1]) + pad
    w, e = min(a[0], b[0]) - pad, max(a[0], b[0]) + pad
    q = f"[out:json][timeout:90];(relation[route=ferry]({s},{w},{n},{e});way[route=ferry]({s},{w},{n},{e}););out geom;"
    d = overpass(q)
    cands = []
    for el in d.get("elements", []):
        if el["type"] == "relation":
            ways = [[[p["lon"], p["lat"]] for p in m.get("geometry", [])] for m in el.get("members", [])
                    if m.get("type") == "way"]
            line = stitch(ways)
        else:
            line = [[p["lon"], p["lat"]] for p in el.get("geometry", [])]
        if len(line) < 2:
            continue
        tags = el.get("tags", {})
        label = tags.get("name", "")
        if name and name.lower() not in (label + " " + tags.get("operator", "")).lower():
            continue
        da = min(haversine_km(a, line[0]), haversine_km(a, line[-1]))
        db = min(haversine_km(b, line[0]), haversine_km(b, line[-1]))
        if da <= radius_km and db <= radius_km:
            if haversine_km(a, line[0]) > haversine_km(a, line[-1]):
                line = line[::-1]
            cands.append((da + db, el["type"], el["id"], label, tags.get("operator", ""), line))
    if not cands:
        raise SystemExit("no OSM ferry route links these two ports; try --radius or geometry.py line")
    cands.sort(key=lambda c: (c[0], c[1] != "relation"))
    _, typ, oid, label, op, line = cands[0]
    km = sum(haversine_km(line[i], line[i + 1]) for i in range(len(line) - 1))
    return {"coords": line, "km": round(km, 1), "minutes": None, "source": f"osm {typ}/{oid} {label}".strip(),
            "operator": op}


def rail(a, b, date, modes="RAIL,HIGHSPEED_RAIL,LONG_DISTANCE,NIGHT_RAIL,REGIONAL_FAST_RAIL,REGIONAL_RAIL,SUBURBAN,BUS,COACH,FERRY"):
    """Line of the first public transport journey Transitous finds from a to b on date."""
    import transitous
    d = transitous.plan_raw(f"{a[1]},{a[0]}", f"{b[1]},{b[0]}", f"{date}T08:00:00Z", window_s=6 * 3600, n=3, modes=modes)
    for it in d.get("itineraries", []):
        coords = []
        for l in it["legs"]:
            g = l.get("legGeometry") or {}
            if l["mode"] != "WALK" and g.get("points"):
                coords += decode_polyline(g["points"], g.get("precision", 6))
        if coords:
            km = sum(haversine_km(coords[i], coords[i + 1]) for i in range(len(coords) - 1))
            mins = round((_ts(it["endTime"]) - _ts(it["startTime"])) / 60)
            return {"coords": coords, "km": round(km, 1), "minutes": mins, "source": "transitous"}
    raise SystemExit("Transitous found no journey; try another date or geometry.py road")


def _ts(s):
    import datetime as dt
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()


def line(a, b):
    return {"coords": [a, b], "km": round(haversine_km(a, b), 1), "minutes": None, "source": "straight line"}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("kind", choices=["road", "ferry", "rail", "line"])
    ap.add_argument("frm")
    ap.add_argument("to")
    ap.add_argument("--via", action="append", default=[], help="road: a stop on the way (repeat)")
    ap.add_argument("--name", help="ferry: part of the route or operator name, such as DFDS")
    ap.add_argument("--radius", type=float, default=15, help="ferry: how far a route end may be from a port, km")
    ap.add_argument("--date", help="rail: YYYY-MM-DD")
    ap.add_argument("--tol", type=float, default=0.003, help="simplification in degrees (0.003 is about 300 m)")
    ap.add_argument("--l100", type=float, help="road: fuel use in litres per 100 km, such as 7.5")
    ap.add_argument("--fuel-price", type=float, help="road: price per litre in the trip currency")
    ap.add_argument("--tolls", type=float, default=0, help="road: tolls you read on the operator's calculator")
    ap.add_argument("--fixed", type=float, default=0, help="road: vignette, parking, tunnel or a ferry")
    ap.add_argument("--out", help="GeoJSON file to write")
    a = ap.parse_args(argv)
    A, B = point(a.frm), point(a.to)
    if a.kind == "road":
        r = road([A] + [point(v) for v in a.via] + [B])[0]
    elif a.kind == "ferry":
        r = ferry(A, B, a.name, a.radius)
    elif a.kind == "rail":
        if not a.date:
            raise SystemExit("rail needs --date")
        r = rail(A, B, a.date)
    else:
        r = line(A, B)
    n = None
    if a.out:
        n = write_path(r["coords"], a.out, {"source": r["source"], "mode": a.kind}, a.tol)
    out = {k: v for k, v in r.items() if k != "coords"}
    if a.kind == "road" and a.l100 and a.fuel_price:
        litres = r["km"] * a.l100 / 100
        out["fuel_l"] = round(litres, 1)
        out["fuel_cost"] = round(litres * a.fuel_price, 2)
        out["cost"] = round(litres * a.fuel_price + a.tolls + a.fixed, 2)
        out["cost_note"] = f"{r['km']} km x {a.l100} l/100 km x {a.fuel_price} + tolls {a.tolls} + fixed {a.fixed}"
    out.update(path=a.out, points=n if n is not None else len(r["coords"]), start=A, end=B)
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
