#!/usr/bin/env python3
"""Timetables and route lines for trains, buses and ferries from Transitous (MOTIS 2).

Transitous (api.transitous.org) is a free, keyless journey planner over open GTFS feeds for most
of Europe and many other countries. It has no prices. Use it for the schedule and the map line,
then read prices on the operator's site.

  python3 transitous.py geocode "Zürich HB"
  python3 transitous.py plan "Zürich HB" "Amsterdam Centraal" --date 2026-12-04 \
      --after 05:00 --until 23:59 --out trip/transitous-zrh-ams.json --paths trip/paths --prefix t

plan prints (or writes) {"places", "journeys", "source", "seen"} in the trip.json v2 shape.
Each ride gets one shared line file, "path": "paths/<number>-<from>-<to>.geojson".

The feeds cover only the published timetable. The European timetable changes in mid-December;
before the new one is published, a later date gives few or very slow journeys. Then search the
same weekday in the published timetable and move the times:

  python3 transitous.py plan "Hamburg Hbf" "Berlin Hbf" --date 2027-05-21 --proxy-date 2026-12-11

Each moved journey gets "schedule_source": "transitous, proxy date ..." and a warning. FROM and TO are a stop name, a stop
id from geocode, or "lat,lng".
"""
import argparse
import datetime as dt
import os
import sys
import urllib.parse
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import decode_polyline, dump, haversine_km, http_json, local_time, slug, to_utc, today, write_path  # noqa: E402

API = os.environ.get("TRANSITOUS_API", "https://api.transitous.org/api")

MODES = {
    "WALK": "walk", "BIKE": "walk", "CAR": "car", "AIRPLANE": "plane", "FERRY": "ferry",
    "BUS": "bus", "COACH": "bus", "TRAM": "train", "SUBWAY": "train", "RAIL": "train",
    "HIGHSPEED_RAIL": "train", "LONG_DISTANCE": "train", "NIGHT_RAIL": "train",
    "REGIONAL_FAST_RAIL": "train", "REGIONAL_RAIL": "train", "SUBURBAN": "train",
    "FUNICULAR": "train", "AERIAL_LIFT": "train", "ODM": "taxi", "OTHER": "train",
}


def geocode(text, kind="STOP"):
    q = urllib.parse.urlencode({"text": text})
    rows = http_json(f"{API}/v1/geocode?{q}", ttl=30 * 86400)
    out = []
    for r in rows:
        if kind and r.get("type") != kind:
            continue
        out.append({"name": r["name"], "id": r.get("id"), "coord": [round(r["lon"], 5), round(r["lat"], 5)],
                    "tz": r.get("tz"), "country": r.get("country"), "type": r.get("type")})
    return out


def reverse(coord):
    """Nearest stop to [lng, lat]: {"name", "id", "coord", "tz"} or None."""
    q = urllib.parse.urlencode({"place": f"{coord[1]},{coord[0]}", "type": "STOP"})
    rows = http_json(f"{API}/v1/reverse-geocode?{q}", ttl=90 * 86400)
    for r in rows:
        return {"name": r["name"], "id": r.get("id"), "coord": [round(r["lon"], 5), round(r["lat"], 5)],
                "tz": r.get("tz")}
    return None


def resolve(place):
    """Return (fromPlace/toPlace value, zone or None). The value is a stop id or 'lat,lng'."""
    p = place.strip()
    if "," in p and all(_isnum(x) for x in p.split(",")):
        return p, None
    if "_" in p and " " not in p:  # looks like a stop id such as de-DELFI_ch:1:sloid:3000
        return p, None
    hits = geocode(p)
    if not hits:
        raise SystemExit(f"no stop found for '{place}'")
    return hits[0]["id"], hits[0]["tz"]


def _isnum(x):
    try:
        float(x)
        return True
    except ValueError:
        return False


def plan_raw(frm, to, time_utc, arrive_by=False, window_s=7200, n=10, modes=None, cursor=None,
             max_transfers=None):
    q = {"fromPlace": frm, "toPlace": to, "time": time_utc, "numItineraries": n,
         "searchWindow": window_s, "arriveBy": str(arrive_by).lower(), "detailedTransfers": "false"}
    if modes:
        q["transitModes"] = modes
    if cursor:
        q["pageCursor"] = cursor
    if max_transfers is not None:
        q["maxTransfers"] = max_transfers
    return http_json(f"{API}/v5/plan?{urllib.parse.urlencode(q)}", ttl=6 * 3600, timeout=90)


def _place(stop, places, merge_km=0.6):
    """Return the place key for a stop. Stops within merge_km of a known place share its key,
    so "Frankfurt (Main) Hbf" from two feeds becomes one place."""
    coord = [round(stop["lon"], 5), round(stop["lat"], 5)]
    imp = stop.get("importance") or 0
    for k, p in places.items():
        if p.get("kind") == "station" and haversine_km(coord, p["coord"]) <= merge_km:
            if imp > p.get("_importance", 0):  # name the place after its most important stop
                p.update(name=stop["name"], city=stop["name"].split(" (")[0].split(",")[0], _importance=imp)
            return k
    name = stop["name"]
    key, n = slug(name, 16), 2
    while key in places:
        key, n = f"{slug(name, 14)}-{n}", n + 1
    places[key] = {"name": name, "city": name.split(" (")[0].split(",")[0], "kind": "station",
                   "coord": coord, "tz": stop["tz"], "_importance": imp}
    return key


def rekey(places, journeys):
    """Give each place the key of its final (most important) name, and update the journeys."""
    new, ren = {}, {}
    for k, p in places.items():
        p.pop("_importance", None)
        key, n = slug(p["name"], 16), 2
        while key in new:
            key, n = f"{slug(p['name'], 14)}-{n}", n + 1
        new[key], ren[k] = p, key
    for j in journeys:
        for obj in [j] + j.get("segments", []):
            for f in ("from", "to"):
                if obj.get(f) in ren:
                    obj[f] = ren[obj[f]]
    return new


def _number(leg):
    n = leg.get("displayName") or leg.get("tripShortName") or leg.get("routeShortName") or ""
    return n.strip()


def to_journeys(its, places, prefix="t", paths_dir=None, rel_dir="paths", start=1, tol=0.003):
    journeys, i, _written = [], start, {}
    for it in its:
        legs = [l for l in it["legs"]
                if not (l["mode"] == "WALK" and (l["from"]["name"] == "START" or l["to"]["name"] == "END"))]
        ride = [l for l in legs if l["mode"] != "WALK"]
        if not ride:
            continue
        jid = f"{prefix}{i}"
        segs = []
        for n, l in enumerate(legs):
            if l["mode"] == "WALK" and l["from"]["name"] == l["to"]["name"]:
                continue  # a platform change inside one station
            f, t = _place(l["from"], places), _place(l["to"], places)
            seg = {"mode": MODES.get(l["mode"], "train"), "from": f, "to": t,
                   "dep": local_time(l["startTime"], l["from"]["tz"]),
                   "arr": local_time(l["endTime"], l["to"]["tz"])}
            if l["mode"] != "WALK":
                seg["carrier"] = l.get("agencyName", "")
                seg["number"] = _number(l)
                if l.get("headsign"):
                    seg["headsign"] = l["headsign"]
            g = l.get("legGeometry") or {}
            if g.get("points") and paths_dir and seg["mode"] != "walk":
                # One file per ride. A ride that two journeys share (same train, same stops) shares the file.
                ride_key = (seg["from"], seg["to"], seg.get("number"), l["mode"])
                if ride_key not in _written:
                    name = f"{slug(seg.get('number') or seg['mode'], 12).lower()}-{seg['from'].lower()}-{seg['to'].lower()}.geojson"
                    coords = decode_polyline(g["points"], g.get("precision", 6))
                    write_path(coords, os.path.join(paths_dir, name), {"source": "transitous", "mode": seg["mode"]}, tol)
                    _written[ride_key] = f"{rel_dir}/{name}"
                seg["path"] = _written[ride_key]
            segs.append(seg)
        first, last = segs[0], segs[-1]
        rides = [s for s in segs if s["mode"] != "walk"]
        modes = {s["mode"] for s in rides}
        carriers = []
        for s in rides:
            if s.get("carrier") and s["carrier"] not in carriers:
                carriers.append(s["carrier"])
        j = {"id": jid, "mode": modes.pop() if len(modes) == 1 else "mixed", "from": first["from"], "to": last["to"],
             "dep": first["dep"], "arr": last["arr"], "carrier": " + ".join(carriers),
             "numbers": " + ".join(s["number"] for s in rides if s.get("number")),
             "transfers": it.get("transfers", len(rides) - 1), "segments": segs, "offers": [],
             "schedule_source": "transitous", "seen": today()}
        if j["dep"][:10] != j["arr"][:10] and (j["dep"][11:] >= "18:00" or j["dep"][11:] < "03:00"):
            j["overnight"] = True
        journeys.append(j)
        i += 1
    return journeys


def plan(frm, to, date, after="00:00", until="23:59", tz=None, modes=None, arrive_by=False, max_pages=6,
         max_transfers=None):
    """All itineraries that leave between date+after and date+until (local time at FROM)."""
    (f, ftz), (t, _) = resolve(frm), resolve(to)
    tz = tz or ftz
    if not tz:
        raise SystemExit("give --tz for a FROM written as lat,lng")
    start = dt.datetime.fromisoformat(f"{date}T{after}")
    end = dt.datetime.fromisoformat(f"{date}T{until}")
    if end <= start:
        end += dt.timedelta(days=1)
    window = int((end - start).total_seconds())
    t0 = to_utc(start.strftime("%Y-%m-%dT%H:%M"), tz)
    its, seen, cursor = [], set(), None
    for _ in range(max_pages):
        d = plan_raw(f, t, t0, arrive_by=arrive_by, window_s=min(window, 86400), n=20, modes=modes, cursor=cursor,
                     max_transfers=max_transfers)
        for it in d.get("itineraries", []):
            key = tuple((l.get("tripId") or l["mode"], l["startTime"]) for l in it["legs"] if l["mode"] != "WALK")
            if key in seen:
                continue
            seen.add(key)
            dep = dt.datetime.fromisoformat(it["startTime"].replace("Z", "+00:00")).astimezone(ZoneInfo(tz)).replace(tzinfo=None)
            if start <= dep <= end:
                its.append(it)
        cursor = d.get("nextPageCursor")
        last = max((it["startTime"] for it in d.get("itineraries", [])), default=None)
        if not cursor or not last:
            break
        if dt.datetime.fromisoformat(last.replace("Z", "+00:00")).astimezone(ZoneInfo(tz)).replace(tzinfo=None) > end:
            break
    its.sort(key=lambda it: it["startTime"])
    return its


def _minutes(j):
    a, b = dt.datetime.fromisoformat(j["dep"]), dt.datetime.fromisoformat(j["arr"])
    return (b - a).total_seconds() / 60  # wall-clock; good enough to compare journeys between the same places


def pareto(journeys, slack=1.6):
    """Keep the journeys a person would choose from.

    Drop a journey when another one leaves at the same time or later, arrives at the same time or
    earlier, and has no more transfers. Then drop journeys that take more than slack times the
    fastest one (night trains and night buses usually survive, because they are the only option
    at that hour; raise slack to keep more)."""
    keep = []
    for a in journeys:
        dominated = any(b is not a and b["dep"] >= a["dep"] and b["arr"] <= a["arr"] and b["transfers"] <= a["transfers"]
                        and (b["dep"], b["arr"], b["transfers"]) != (a["dep"], a["arr"], a["transfers"]) for b in journeys)
        if not dominated:
            keep.append(a)
    if keep and slack:
        fastest = min(_minutes(j) for j in keep)
        keep = [j for j in keep if _minutes(j) <= fastest * slack or j.get("overnight")]
    return keep


def shift(journeys, proxy, target):
    """Move journeys found on the proxy date to the target date. Local wall times stay the same.

    Use it when the feeds do not cover the target date yet (the timetable is not published)."""
    import datetime as dt
    days = (dt.date.fromisoformat(target) - dt.date.fromisoformat(proxy)).days

    def mv(t):
        return (dt.datetime.fromisoformat(t) + dt.timedelta(days=days)).isoformat(timespec="minutes") if t else t

    for j in journeys:
        j["dep"], j["arr"] = mv(j["dep"]), mv(j["arr"])
        for sg in j.get("segments", []):
            sg["dep"], sg["arr"] = mv(sg["dep"]), mv(sg["arr"])
        j["schedule_source"] = f"transitous, proxy date {proxy}"
        j.setdefault("warning", {"short": "Times not final",
                                 "text": f"The timetable for {target} is not published yet. These times come from "
                                         f"the same train on {proxy}. Check them before you book."})
    return journeys


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("geocode")
    g.add_argument("text")
    g.add_argument("--any", action="store_true", help="also addresses and places, not only stops")
    p = sub.add_parser("plan")
    p.add_argument("frm")
    p.add_argument("to")
    p.add_argument("--date", required=True, help="YYYY-MM-DD, local at FROM")
    p.add_argument("--after", default="00:00")
    p.add_argument("--until", default="23:59")
    p.add_argument("--tz", help="zone of FROM; found by geocode when left out")
    p.add_argument("--modes", help="transitModes, such as RAIL,COACH,FERRY (default all)")
    p.add_argument("--max-transfers", type=int)
    p.add_argument("--all", action="store_true", help="keep dominated journeys too")
    p.add_argument("--slack", type=float, default=1.6, help="drop journeys slower than this times the fastest")
    p.add_argument("--tol", type=float, default=0.003, help="line simplification in degrees (0.003 is about 300 m)")
    p.add_argument("--prefix", default="t")
    p.add_argument("--start", type=int, default=1, help="first journey number")
    p.add_argument("--paths", help="folder for the GeoJSON route lines (usually <trip>/paths)")
    p.add_argument("--rel", default="paths", help="path prefix written into trip.json")
    p.add_argument("--proxy-date", help="search this date instead and move the times to --date "
                                         "(same weekday in a published timetable)")
    p.add_argument("--out")
    a = ap.parse_args(argv)
    if a.cmd == "geocode":
        dump(geocode(a.text, None if a.any else "STOP"))
        return
    if a.proxy_date:
        import datetime as dt
        if dt.date.fromisoformat(a.proxy_date).weekday() != dt.date.fromisoformat(a.date).weekday():
            print("warning: --proxy-date is another weekday than --date", file=sys.stderr)
    its = plan(a.frm, a.to, a.proxy_date or a.date, a.after, a.until, a.tz, a.modes, max_transfers=a.max_transfers)
    places = {}
    js = to_journeys(its, places, a.prefix, a.paths, a.rel, a.start, a.tol)
    if not a.all:
        js = pareto(js, a.slack)
        used = {s[k] for j in js for s in j["segments"] for k in ("from", "to")}
        places = {k: v for k, v in places.items() if k in used}
    places = rekey(places, js)
    if a.proxy_date:
        shift(js, a.proxy_date, a.date)
    dump({"source": "transitous", "seen": today(), "query": {"from": a.frm, "to": a.to, "date": a.date},
          "places": places, "journeys": js}, a.out)
    if a.out:
        print(f"{len(js)} journeys, {len(places)} places -> {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
