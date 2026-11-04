#!/usr/bin/env python3
"""FlixBus and FlixTrain timetables with prices, from the public search API that flixbus.com uses.

No key and no login. Prices are for the whole group, in the currency you ask for.

  python3 flixbus.py search Hamburg Berlin --date 2027-05-19 --adults 2 --currency EUR \
      --paths trip/paths --prefix f --out trip/flix-ham-ber.json
  python3 flixbus.py cities Copenhagen

Each bus leg gets a road line from OSRM (geometry.py), each FlixTrain leg a rail line from
Transitous. Leave out --paths to skip the lines.
"""
import argparse
import datetime as dt
import json
import os
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import dump, http_json, slug, today, town, write_path  # noqa: E402

API = "https://global.api.flixbus.com"


def cities(q, lang="en"):
    url = f"{API}/search/autocomplete/cities?{urllib.parse.urlencode({'q': q, 'lang': lang, 'flixbus_cities_only': 'false'})}"
    return [{"id": c["id"], "name": c["name"], "country": c["country"],
             "coord": [c["location"]["lon"], c["location"]["lat"]]} for c in http_json(url, ttl=30 * 86400)]


def search_raw(frm_id, to_id, date, adults=1, children=0, currency="EUR", bikes=0):
    products = {"adult": adults}
    if children:
        products["children_0_14"] = children
    if bikes:
        products["bike_slot"] = bikes
    q = {"from_city_id": frm_id, "to_city_id": to_id,
         "departure_date": dt.date.fromisoformat(date).strftime("%d.%m.%Y"),
         "products": json.dumps(products, separators=(",", ":")), "currency": currency, "locale": "en",
         "search_by": "cities", "include_after_midnight_rides": 1}
    return http_json(f"{API}/search/service/v4/search?{urllib.parse.urlencode(q)}", ttl=6 * 3600)


def _local(iso):
    # '2027-05-19T04:10:00+02:00' -> '2027-05-19T04:10' (the API gives local time with its offset)
    return iso[:16]


def stations(q, lang="en"):
    url = f"{API}/search/autocomplete/stations?{urllib.parse.urlencode({'q': q, 'lang': lang})}"
    return http_json(url, ttl=90 * 86400)


def _station_coord(sid, name, city_name):
    """Exact stop position from the FlixBus station search, matched by station id.
    Returns ([lng, lat], tz or None)."""
    for q in (name, f"{city_name} {name}" if city_name and city_name not in name else None):
        if not q:
            continue
        try:
            for h in stations(q):
                if h.get("id") == sid and h.get("location"):
                    return [round(h["location"]["lon"], 5), round(h["location"]["lat"], 5)], None
        except RuntimeError:
            pass
    try:
        c = cities(city_name or name)[0]
        return c["coord"], None
    except (RuntimeError, IndexError):
        return None, None


def _tz(coord):
    """Time zone of the nearest Transitous stop, or None."""
    if not coord:
        return None
    try:
        import transitous
        r = transitous.reverse(coord)
        return r and r.get("tz")
    except (RuntimeError, OSError, KeyError):
        return None


def to_journeys(data, frm, to, prefix="f", paths_dir=None, rel="paths", start=1, tz=None):
    stations_ = data.get("stations", {})
    trip = (data.get("trips") or [{}])[0]
    places, journeys, n, lines = {}, [], start, {}
    city = {c["id"]: c for c in (frm, to)}

    names = {k: v.get("name") for k, v in data.get("cities", {}).items()}

    def place(sid, cid):
        st = stations_.get(sid, {"name": sid})
        key = slug(st["name"], 16)
        if key not in places:
            cname = city.get(cid, {}).get("name") or names.get(cid) or town(st["name"])
            coord, ptz = _station_coord(sid, st["name"], cname)
            if not coord:
                print(f"no position for stop {st['name']}; set it by hand", file=sys.stderr)
            places[key] = {"name": st["name"], "city": cname,
                           "kind": "station" if st.get("is_train") else "stop", "coord": coord,
                           "tz": ptz or _tz(coord) or tz}
        return key

    for uid, r in sorted(trip.get("results", {}).items(), key=lambda kv: kv[1]["departure"]["date"]):
        if r.get("status") != "available":
            continue
        segs = []
        for leg in r.get("legs", []):
            mode = "train" if leg.get("means_of_transport") == "train" else "bus"
            f = place(leg["departure"]["station_id"], leg["departure"]["city_id"])
            t = place(leg["arrival"]["station_id"], leg["arrival"]["city_id"])
            seg = {"mode": mode, "from": f, "to": t, "dep": _local(leg["departure"]["date"]),
                   "arr": _local(leg["arrival"]["date"]), "carrier": "FlixTrain" if mode == "train" else "FlixBus",
                   "number": leg.get("line_direction") or ""}
            if paths_dir:
                key = (f, t, mode)
                if key not in lines:
                    lines[key] = _line(places[f]["coord"], places[t]["coord"], mode, seg["dep"][:10], paths_dir, rel, f, t)
                if lines[key]:
                    seg["path"] = lines[key]
            segs.append(seg)
        if not segs:
            continue
        price = r["price"].get("total_with_platform_fee") or r["price"]["total"]
        modes = {s["mode"] for s in segs}
        j = {"id": f"{prefix}{n}", "mode": modes.pop() if len(modes) == 1 else "mixed",
             "from": segs[0]["from"], "to": segs[-1]["to"], "dep": segs[0]["dep"], "arr": segs[-1]["arr"],
             "carrier": " + ".join(sorted({s["carrier"] for s in segs})), "numbers": "",
             "transfers": len(segs) - 1, "segments": segs, "self_transfer": False,
             "offers": [{"seller": "FlixBus", "kind": "operator", "price": round(price, 2),
                         "fare": "Standard", "bags": {"cabin": "included", "checked": "included"},
                         "bags_note": "1 hand luggage up to 7 kg and 1 hold bag up to 20 kg are included",
                         "seats_left": r.get("available", {}).get("seats"), "source": "flixbus.com search API",
                         "seen": today(), "url": "https://www.flixbus.com/"}]}
        journeys.append(j)
        n += 1
    return places, journeys


def one_per_ride(journeys):
    """A bus that stops at three stops in the destination city comes back as three results.
    Keep the one that arrives first for each departure and carrier chain, and renumber."""
    best = {}
    for j in journeys:
        key = (j["dep"], j["from"], tuple(s["dep"] for s in j["segments"]))
        if key not in best or j["arr"] < best[key]["arr"]:
            best[key] = j
    out = sorted(best.values(), key=lambda j: j["dep"])
    prefix = "".join(ch for ch in journeys[0]["id"] if not ch.isdigit()) if journeys else "f"
    first = int("".join(ch for ch in journeys[0]["id"] if ch.isdigit()) or 1) if journeys else 1
    for n, j in enumerate(out, first):
        j["id"] = f"{prefix}{n}"
    return out


def _line(a, b, mode, date, paths_dir, rel, f, t):
    try:
        import geometry
        r = geometry.rail(a, b, date) if mode == "train" else geometry.road([a, b])[0]
    except (SystemExit, RuntimeError, OSError) as e:
        print(f"no line for {f}-{t}: {e}", file=sys.stderr)
        return None
    name = f"{mode}-{f.lower()}-{t.lower()}.geojson"
    write_path(r["coords"], os.path.join(paths_dir, name), {"source": r["source"], "mode": mode})
    return f"{rel}/{name}"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("cities")
    c.add_argument("q")
    s = sub.add_parser("search")
    s.add_argument("frm")
    s.add_argument("to")
    s.add_argument("--date", required=True)
    s.add_argument("--adults", type=int, default=1)
    s.add_argument("--children", type=int, default=0)
    s.add_argument("--currency", default="EUR")
    s.add_argument("--tz", default="Europe/Berlin", help="zone for stops that Transitous cannot place")
    s.add_argument("--prefix", default="f")
    s.add_argument("--start", type=int, default=1)
    s.add_argument("--paths")
    s.add_argument("--rel", default="paths")
    s.add_argument("--direct", action="store_true", help="only rides without a change")
    s.add_argument("--all-stops", action="store_true", help="keep one journey per arrival stop, not one per ride")
    s.add_argument("--out")
    a = ap.parse_args(argv)
    if a.cmd == "cities":
        dump(cities(a.q))
        return
    f, t = cities(a.frm)[0], cities(a.to)[0]
    data = search_raw(f["id"], t["id"], a.date, a.adults, a.children, a.currency)
    places, js = to_journeys(data, f, t, a.prefix, a.paths, a.rel, a.start, a.tz)
    if a.direct:
        js = [j for j in js if j["transfers"] == 0]
    if not a.all_stops:
        js = one_per_ride(js)
        used = {s[k] for j in js for s in j["segments"] for k in ("from", "to")}
        places = {k: v for k, v in places.items() if k in used}
    dump({"source": "flixbus.com", "seen": today(), "currency": a.currency,
          "query": {"from": f["name"], "to": t["name"], "date": a.date, "adults": a.adults, "children": a.children},
          "places": places, "journeys": js}, a.out)
    if a.out:
        print(f"{len(js)} journeys -> {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
