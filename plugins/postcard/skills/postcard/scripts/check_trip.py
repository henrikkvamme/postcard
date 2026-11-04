#!/usr/bin/env python3
"""Check a trip folder before you show it.

    python3 check_trip.py <trip-folder or trip.json> [--today YYYY-MM-DD]

It prints one line per problem and exits 1 when it finds an error. Warnings do not fail the check,
but read each one: most of them are something the page will show wrong or not at all.

It checks trip.json v2 (references/trip-schema.md): the shape, unknown field names, places and
zones, journey and segment times, segment chains, path files, offers and their source and date,
bag fields, deals, map art, and that the folder has a page (index.html and app.js).
"""
import json
import math
import os
import re
import sys
from datetime import date, datetime
from zoneinfo import ZoneInfo

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(SKILL, "kit")

ISO = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$")
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}")
MODES = {"plane", "train", "bus", "coach", "ferry", "car", "taxi", "walk", "mixed"}
GROUND = MODES - {"plane"}
PLACE_KINDS = {"airport", "station", "stop", "port", "city", "venue", "home"}
OFFER_KINDS = {"operator", "agency", "self"}
BAG_KEYS = {"cabin", "checked", "small"}

TOP = {"version", "id", "title", "subtitle", "currency", "passengers", "clock", "clock_label", "window", "places",
       "journeys", "deals", "carriers", "map", "sources", "context"}
PLACE = {"name", "city", "kind", "coord", "tz", "code", "country", "note"}
JOURNEY = {"id", "mode", "group", "from", "to", "dep", "arr", "carrier", "numbers", "segments", "self_transfer",
           "warning", "offers", "bags", "notes", "path", "tags", "co2_kg",
           "seen", "schedule_source", "stops", "transfers", "layovers_min", "flags", "km", "drive_minutes"}
SEGMENT = {"mode", "from", "to", "dep", "arr", "carrier", "number", "path", "self_transfer", "note",
           "operated_by", "aircraft", "headsign"}
OFFER = {"seller", "kind", "price", "fare", "bags", "source", "seen", "url", "stars", "reviews", "rating_source",
         "note", "refundable", "changeable", "per", "basis", "currency", "original", "price_note", "rules", "bags_note"}
DEAL = {"journeys", "price", "seller", "kind", "what", "source", "seen", "url", "bags", "fare", "stars", "reviews",
        "rating_source", "note", "basis", "currency", "original", "price_note", "bags_note"}
MAP = {"view", "labels", "seas", "art", "far"}
ART = {"img", "lng", "lat", "km", "place", "rot", "note"}

errors, warnings = [], []
err, warn = errors.append, warnings.append


def unknown(obj, known, where):
    if isinstance(obj, dict):
        for k in obj:
            if k not in known:
                warn(f"{where}: unknown field '{k}'; the kit ignores it (put free-form data in context)")


def zone_ok(tz):
    try:
        ZoneInfo(tz or "")
        return True
    except Exception:
        return False


def when(s, tz, where):
    if not isinstance(s, str) or not ISO.match(s):
        err(f"{where}: '{s}' is not a local wall time like 2026-11-12T19:05")
        return None
    try:
        dt = datetime.fromisoformat(s).replace(tzinfo=ZoneInfo(tz))
    except Exception as e:
        err(f"{where}: {e}")
        return None
    # The kit reads a time like Python with fold=0 (kit/time.js wallMs). Say when that choice matters.
    if dt.utcoffset() != dt.replace(fold=1).utcoffset():
        a, b = dt.astimezone(ZoneInfo("UTC")), dt.replace(fold=1).astimezone(ZoneInfo("UTC"))
        if a.astimezone(ZoneInfo(tz)).replace(tzinfo=None) != dt.replace(tzinfo=None):
            warn(f"{where}: {s} does not exist in {tz} (the clocks go forward); the page reads it as {a.astimezone(ZoneInfo(tz)):%H:%M}")
        else:
            warn(f"{where}: {s} happens twice in {tz} (the clocks go back); the page reads it as the first one")
    return dt


def km(p, q):
    r = math.radians
    a = math.sin(r(q[1] - p[1]) / 2) ** 2 + math.cos(r(p[1])) * math.cos(r(q[1])) * math.sin(r(q[0] - p[0]) / 2) ** 2
    return 12742 * math.asin(min(1, math.sqrt(a)))


def coords_ok(c):
    return isinstance(c, list) and len(c) >= 2 and all(isinstance(v, (int, float)) for v in c[:2]) \
        and -180 <= c[0] <= 180 and -90 <= c[1] <= 90


def read_path(p, base, where):
    """The line of a segment path, or None. Inline [[lng, lat], ...] or a GeoJSON file in the trip folder."""
    if isinstance(p, list):
        if len(p) < 2 or not all(coords_ok(c) for c in p):
            err(f"{where}: an inline path is a list of at least two [lng, lat] pairs")
            return None
        return p
    if not isinstance(p, str):
        err(f"{where}: path is an inline [[lng, lat], ...] list or a GeoJSON file name")
        return None
    f = os.path.join(base, p)
    if not os.path.isfile(f):
        err(f"{where}: path file {p} is not in the trip folder")
        return None
    try:
        g = json.load(open(f))
    except Exception as e:
        err(f"{where}: path file {p} is not JSON: {e}")
        return None
    lines = []

    def walk(g):
        t = (g or {}).get("type")
        if t == "FeatureCollection":
            for x in g.get("features", []):
                walk(x.get("geometry"))
        elif t == "Feature":
            walk(g.get("geometry"))
        elif t == "LineString":
            lines.append(g.get("coordinates", []))
        elif t == "MultiLineString":
            lines.extend(g.get("coordinates", []))
    walk(g)
    pts = [c for l in lines for c in l]
    if len(pts) < 2:
        err(f"{where}: path file {p} has no LineString")
        return None
    return pts


def check_offer(o, where, today, kinds=OFFER_KINDS):
    unknown(o, OFFER | DEAL, where)
    k = o.get("kind")
    if k == "airline":
        warn(f"{where}: kind 'airline' is the v1 name; use 'operator'")
    elif k not in kinds:
        err(f"{where}: kind must be one of {sorted(kinds)}")
    if not isinstance(o.get("price"), (int, float)) or o.get("price") < 0:
        err(f"{where}: price must be a number of {currency} for all passengers")
    if not o.get("seller"):
        err(f"{where}: seller is missing")
    if not o.get("source"):
        warn(f"{where}: no source; say where you saw this price")
    seen = o.get("seen")
    if not seen:
        warn(f"{where}: no seen date; the page cannot say how fresh the price is")
    elif not DAY.match(str(seen)):
        err(f"{where}: seen '{seen}' is not a date like 2026-11-03")
    elif today and (today - date.fromisoformat(str(seen)[:10])).days > 7:
        warn(f"{where}: price seen {seen}, more than a week ago; check it again before booking")
    b = o.get("bags")
    if b is not None:
        if not isinstance(b, dict):
            err(f"{where}: bags is an object like {{\"cabin\": \"included\", \"checked\": 35}}")
        else:
            for bk, bv in b.items():
                if bk not in BAG_KEYS:
                    warn(f"{where}: bags.{bk} is not one of {sorted(BAG_KEYS)}")
                if not (bv in ("included", "none", "fee") or isinstance(bv, (int, float))):
                    err(f"{where}: bags.{bk} must be \"included\", \"fee\", \"none\" or a price, not {bv!r}")
    if o.get("stars") is not None:
        if not isinstance(o["stars"], (int, float)) or not 0 <= o["stars"] <= 5:
            err(f"{where}: stars is a number from 0 to 5")
        if not o.get("rating_source"):
            warn(f"{where}: stars without rating_source; say where the rating comes from")
    if o.get("kind") == "agency" and o.get("stars") is None:
        warn(f"{where}: agency without a rating; the 'good agencies' filter drops it")


currency = "EUR"


def main():
    global currency
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    today = date.today()
    if "--today" in sys.argv:
        today = date.fromisoformat(sys.argv[sys.argv.index("--today") + 1])
        args = [a for a in args if a != str(today)]
    path = args[0] if args else "."
    if os.path.isdir(path):
        path = os.path.join(path, "trip.json")
    base = os.path.dirname(os.path.abspath(path))
    try:
        t = json.load(open(path))
    except Exception as e:
        print(f"error: cannot read {path}: {e}")
        return 1

    if "flights" in t and "journeys" not in t:
        err("this is a v1 trip (flights); v2 uses journeys. See references/trip-schema.md, 'From v1'")
        return report()
    for k in ("title", "clock", "window", "places", "journeys"):
        if k not in t:
            err(f"missing '{k}'")
    if errors:
        return report()
    unknown(t, TOP, "trip")
    currency = t.get("currency", "EUR")
    if not zone_ok(t["clock"]):
        err(f"clock '{t['clock']}' is not an IANA zone like Europe/Zurich")
        return report()

    places = t["places"]
    for pid, p in places.items():
        w = f"places.{pid}"
        unknown(p, PLACE, w)
        if not coords_ok(p.get("coord")):
            err(f"{w}: coord must be [lng, lat] in range")
        elif abs(p["coord"][0]) <= 90 and abs(p["coord"][1]) > 0 and p.get("tz", "").startswith("Europe/") and p["coord"][1] < 30:
            warn(f"{w}: coord {p['coord']} looks like [lat, lng] for a European place; it is [lng, lat]")
        if not zone_ok(p.get("tz")):
            err(f"{w}: tz '{p.get('tz')}' is not an IANA zone like Europe/Zurich")
        if p.get("kind") and p["kind"] not in PLACE_KINDS:
            warn(f"{w}: kind '{p['kind']}' is not one of {sorted(PLACE_KINDS)}")
    good = {pid for pid, p in places.items() if zone_ok(p.get("tz")) and coords_ok(p.get("coord"))}

    w0 = when(t["window"].get("start"), t["clock"], "window.start")
    w1 = when(t["window"].get("end"), t["clock"], "window.end")
    if w0 and w1 and w1 <= w0:
        err("window: ends before it starts")

    ids, groups, priced = {}, {}, 0
    for i, j in enumerate(t["journeys"]):
        jid = j.get("id")
        w = f"journeys[{i}] ({jid})"
        unknown(j, JOURNEY, w)
        if not jid:
            err(f"{w}: id is missing")
            continue
        if jid in ids:
            err(f"{w}: id is used twice")
        ids[jid] = j
        if j.get("mode") not in MODES:
            err(f"{w}: mode '{j.get('mode')}' is not one of {sorted(MODES)}")
        if not j.get("group"):
            err(f"{w}: group is missing; it names the leg this journey is one choice for, such as out or back")
        groups.setdefault(j.get("group"), []).append(j)
        a, b = j.get("from"), j.get("to")
        for c in (a, b):
            if c not in places:
                err(f"{w}: '{c}' is not in places")
        if a not in good or b not in good:
            continue
        d = when(j.get("dep"), places[a]["tz"], w + ".dep")
        r = when(j.get("arr"), places[b]["tz"], w + ".arr")
        if d and r:
            if r <= d:
                err(f"{w}: arrives before it departs (dep {j['dep']} at {a}, arr {j['arr']} at {b}, both local)")
            elif (r - d).total_seconds() > 48 * 3600:
                warn(f"{w}: takes more than 48 hours; check the dates")
            if w0 and w1 and (d < w0 or r > w1):
                warn(f"{w}: is outside the window, so the timeline cuts it")

        segs = j.get("segments") or []
        if not segs:
            if j.get("mode") == "mixed":
                err(f"{w}: a mixed journey needs segments")
            if j.get("mode") in GROUND and not j.get("path"):
                warn(f"{w}: {j.get('mode')} without a path is drawn as a faint straight line; add a path for a real route")
            elif j.get("path"):
                read_path(j["path"], base, w + ".path")
        prev = None
        for k, s in enumerate(segs):
            sw = f"{w}.segments[{k}]"
            unknown(s, SEGMENT, sw)
            mode = s.get("mode") or j.get("mode")
            if mode not in MODES or mode == "mixed":
                err(f"{sw}: mode '{mode}' must be one of {sorted(MODES - {'mixed'})}")
            sa, sb = s.get("from"), s.get("to")
            if sa not in good or sb not in good:
                err(f"{sw}: '{sa if sa not in good else sb}' is not a usable place")
                prev = None
                continue
            sd = when(s.get("dep"), places[sa]["tz"], sw + ".dep")
            sr = when(s.get("arr"), places[sb]["tz"], sw + ".arr")
            if sd and sr and sr <= sd:
                err(f"{sw}: arrives before it departs")
            if k == 0 and sa != a:
                err(f"{sw}: starts at {sa}, but the journey starts at {a}")
            if k == len(segs) - 1 and sb != b:
                err(f"{sw}: ends at {sb}, but the journey ends at {b}")
            if k == 0 and sd and d and sd != d:
                err(f"{sw}: departs {s.get('dep')}, but the journey departs {j.get('dep')}")
            if k == len(segs) - 1 and sr and r and sr != r:
                err(f"{sw}: arrives {s.get('arr')}, but the journey arrives {j.get('arr')}")
            if prev:
                pto, parr = prev
                if pto != sa:
                    gap = km(places[pto]["coord"], places[sa]["coord"])
                    warn(f"{sw}: the change is from {pto} to {sa} ({gap:.0f} km apart); the page must show this ground transfer")
                if parr and sd and sd < parr:
                    err(f"{sw}: departs before the previous segment arrives")
            prev = (sb, sr)
            if s.get("path") is not None:
                line = read_path(s["path"], base, sw + ".path")
                if line:
                    # The kit flips nothing for a single line, so check both ways and name the worse end.
                    A, B = places[sa]["coord"], places[sb]["coord"]
                    fwd = (km(line[0], A), km(line[-1], B))
                    rev = (km(line[-1], A), km(line[0], B))
                    if sum(rev) < sum(fwd) and max(rev) <= 30:
                        warn(f"{sw}.path: the line runs from {sb} to {sa}; reverse it")
                    elif max(fwd) > 30:
                        warn(f"{sw}.path: its ends are {fwd[0]:.0f} km from {sa} and {fwd[1]:.0f} km from {sb}; is it the right line?")
            elif mode in GROUND:
                warn(f"{sw}: {mode} without a path is drawn as a faint straight line; add a path for a real route")

        offers = j.get("offers") or []
        if offers:
            priced += 1
        elif not j.get("warning"):
            warn(f"{w}: no offers and no warning; say why it has no price")
        for k, o in enumerate(offers):
            check_offer(o, f"{w}.offers[{k}]", today)
        if j.get("carrier") and j["carrier"] not in t.get("carriers", {}):
            warn(f"{w}: carrier '{j['carrier']}' has no name in carriers")

    if not t["journeys"]:
        err("journeys: the list is empty")
    elif not priced:
        err("journeys: no journey has an offer")

    # out and back: say when a person leaves from or returns to a different place.
    if "out" in groups and "back" in groups:
        starts = {j.get("from") for j in groups["out"]}
        ends = {j.get("to") for j in groups["back"]}
        outs = {j.get("to") for j in groups["out"]}
        backs = {j.get("from") for j in groups["back"]}
        if starts != ends:
            warn(f"out leaves from {sorted(starts)} but back returns to {sorted(ends)}; "
                 "a page that pairs them must show a different-airport pair")
        if outs != backs:
            warn(f"out arrives at {sorted(outs)} but back leaves from {sorted(backs)}; "
                 "pair them by destination, not by airport")
        if any(j.get("dep", "") < min((o.get("dep", "") for o in groups["out"]), default="") for j in groups["back"]):
            warn("a back journey departs before the first out journey; are out and back swapped?")

    for k, dl in enumerate(t.get("deals", [])):
        w = f"deals[{k}]"
        unknown(dl, DEAL, w)
        js = dl.get("journeys") or [x for x in (dl.get("out"), dl.get("back")) if x]
        if len(js) < 2:
            err(f"{w}: journeys must list two or more journey ids")
        missing = [x for x in js if x not in ids]
        if missing:
            err(f"{w}: {missing} are not journey ids")
        gs = [ids[x].get("group") for x in js if x in ids]
        if len(gs) != len(set(gs)):
            err(f"{w}: two journeys from the same group {gs}; a deal buys one choice per leg")
        check_offer(dl, w, today)

    m = t.get("map", {})
    unknown(m, MAP, "map")
    for k, a in enumerate(m.get("art", [])):
        unknown(a, ART, f"map.art[{k}]")
        img = a.get("img", "")
        f = os.path.join(KIT, img[4:]) if img.startswith("kit/") else os.path.join(base, img)
        if not os.path.isfile(f):
            warn(f"map.art[{k}]: {img} not found (kit/... is the kit's art, anything else is in the trip folder)")
        if a.get("place") and a["place"] not in places:
            warn(f"map.art[{k}]: place '{a['place']}' is not in places")
    src = t.get("sources")
    if not src or not src.get("seen"):
        warn("sources.seen is missing; the page footer says when prices were read")

    if os.path.basename(path) == "trip.json":
        for f in ("index.html", "app.js"):
            if not os.path.isfile(os.path.join(base, f)):
                warn(f"no {f} in the trip folder; copy it from the closest example and adapt it")
    return report()


def report():
    for e in errors:
        print("error:", e)
    # Many warnings of one kind are one problem: print three, then a count.
    seen = {}
    for w in warnings:
        key = re.sub(r"\[\d+\]|\([^)]*\)|'[^']*'|\d+", "#", w)
        seen.setdefault(key, []).append(w)
    for key, ws in seen.items():
        for w in ws[:3]:
            print("warning:", w)
        if len(ws) > 3:
            print(f"warning: ... and {len(ws) - 3} more like this")
    if not errors:
        print(f"ok ({len(warnings)} warning{'s' if len(warnings) != 1 else ''})")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
