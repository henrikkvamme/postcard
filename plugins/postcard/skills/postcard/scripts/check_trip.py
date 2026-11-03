#!/usr/bin/env python3
"""Check a trip.json before you show it.

    python3 check_trip.py <trip-folder or trip.json>

It prints one line per problem and exits 1 when it finds an error. Warnings do not fail the check.
It checks the shape, that every code points at a known place, that times parse and arrive after
they depart, that offers and deals name real flights, and that art files exist.
"""
import json
import os
import re
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

errors, warnings = [], []
err = errors.append
warn = warnings.append
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$")
KINDS = {"airline", "agency", "self"}


def valid_zone(tz):
    try:
        ZoneInfo(tz or "")
        return True
    except Exception:
        return False


def when(s, tz, where):
    if not isinstance(s, str) or not ISO.match(s):
        err(f"{where}: '{s}' is not a local time like 2026-11-12T19:05")
        return None
    try:
        return datetime.fromisoformat(s).replace(tzinfo=ZoneInfo(tz))
    except Exception as e:
        err(f"{where}: {e}")
        return None


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "."
    if os.path.isdir(path):
        path = os.path.join(path, "trip.json")
    base = os.path.dirname(os.path.abspath(path))
    viewer = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "viewer")
    try:
        t = json.load(open(path))
    except Exception as e:
        print(f"error: cannot read {path}: {e}")
        return 1

    for k in ("title", "clock", "window", "home", "destination", "places", "flights"):
        if k not in t:
            err(f"missing '{k}'")
    if errors:
        return report()

    places = t["places"]
    for code, p in places.items():
        if not (isinstance(p.get("coord"), list) and len(p["coord"]) == 2):
            err(f"places.{code}: coord must be [lng, lat]")
        elif not (-180 <= p["coord"][0] <= 180 and -90 <= p["coord"][1] <= 90):
            err(f"places.{code}: coord {p['coord']} is out of range; it is [lng, lat]")
        if not valid_zone(p.get("tz")):
            err(f"places.{code}: tz '{p.get('tz')}' is not an IANA zone like Europe/Zurich")
    try:
        ZoneInfo(t["clock"])
    except Exception:
        err(f"clock '{t['clock']}' is not an IANA zone")
        return report()

    bad_zone = {c for c, p in places.items() if not valid_zone(p.get("tz"))}
    for side in ("home", "destination"):
        if t[side].get("place") not in places:
            err(f"{side}.place '{t[side].get('place')}' is not in places")
            return report()

    w0 = when(t["window"].get("start"), t["clock"], "window.start")
    w1 = when(t["window"].get("end"), t["clock"], "window.end")

    ids = set()
    for i, f in enumerate(t["flights"]):
        where = f"flights[{i}] ({f.get('id')})"
        if f.get("id") in ids:
            err(f"{where}: id is used twice")
        ids.add(f.get("id"))
        if f.get("dir") not in ("out", "back"):
            err(f"{where}: dir must be 'out' or 'back'")
            continue
        a = f.get("from") or (t["home"]["place"] if f["dir"] == "out" else t["destination"]["place"])
        b = f.get("to") or (t["destination"]["place"] if f["dir"] == "out" else t["home"]["place"])
        for c in [a, b] + [x for v in f.get("via", []) for x in v.split(">")]:
            if c not in places:
                err(f"{where}: '{c}' is not in places")
        if a not in places or b not in places or a in bad_zone or b in bad_zone:
            continue
        d = when(f.get("dep"), places[a]["tz"], where + ".dep")
        r = when(f.get("arr"), places[b]["tz"], where + ".arr")
        if d and r:
            if r <= d:
                err(f"{where}: arrives before it departs (dep {f['dep']} {a}, arr {f['arr']} {b}, both local)")
            elif (r - d).total_seconds() > 48 * 3600:
                warn(f"{where}: takes more than 48 hours")
            if w0 and w1 and (d < w0 or r > w1):
                warn(f"{where}: is outside the window, so the timeline cuts it")
        if len(f.get("via", [])) != len(f.get("layovers_min", [])):
            err(f"{where}: via and layovers_min need one entry per stop")
        if f.get("carrier") not in t.get("carriers", {}):
            warn(f"{where}: carrier '{f.get('carrier')}' has no name in carriers")
    if not any(f.get("dir") == "out" for f in t["flights"]) or not any(f.get("dir") == "back" for f in t["flights"]):
        err("flights: need at least one 'out' and one 'back' flight")

    offers = t.get("offers", {})
    for fid, ss in offers.items():
        if fid not in ids:
            err(f"offers.{fid}: no flight has this id")
        for j, s in enumerate(ss):
            if s.get("kind") not in KINDS:
                err(f"offers.{fid}[{j}]: kind must be one of {sorted(KINDS)}")
            if not isinstance(s.get("price"), (int, float)):
                err(f"offers.{fid}[{j}]: price must be a number")
            if not s.get("seller"):
                err(f"offers.{fid}[{j}]: seller is missing")
    for fid in ids - set(offers):
        warn(f"flight {fid} has no offers, so the page cannot price it")
    for j, d in enumerate(t.get("deals", [])):
        if d.get("out") not in ids or d.get("back") not in ids:
            err(f"deals[{j}]: out and back must be flight ids")

    ev = t.get("event")
    if ev:
        s = when(ev.get("start"), t["clock"], "event.start")
        e = when(ev.get("end"), t["clock"], "event.end")
        if s and e and e <= s:
            err("event: ends before it starts")
        for j, m in enumerate(ev.get("moments", [])):
            when(m.get("at"), t["clock"], f"event.moments[{j}].at")
    wk = t.get("work")
    if wk:
        for d in wk.get("days", []):
            when(d, wk.get("tz") or places[t["home"]["place"]]["tz"], "work.days")

    for j, a in enumerate(t.get("map", {}).get("art", [])):
        img = a.get("img", "")
        if not any(os.path.isfile(os.path.join(root, img)) for root in (base, viewer)):
            warn(f"map.art[{j}]: {img} is in neither the trip folder nor the viewer")
    stamp = t["destination"].get("stamp")
    if stamp and not any(os.path.isfile(os.path.join(root, stamp)) for root in (base, viewer)):
        warn(f"destination.stamp: {stamp} not found")
    return report()


def report():
    for e in errors:
        print("error:", e)
    for w in warnings:
        print("warning:", w)
    if not errors:
        print(f"ok ({len(warnings)} warning{'s' if len(warnings) != 1 else ''})")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
