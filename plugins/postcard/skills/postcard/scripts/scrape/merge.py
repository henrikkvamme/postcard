#!/usr/bin/env python3
"""Join the outputs of the scrape helpers into one trip.json.

Every helper writes {"places", "journeys"} in the trip.json v2 shape. This script takes a base
file with the trip fields (id, title, currency, passengers, clock, window, context) and adds the
journeys you pick from each part.

  python3 merge.py base.json \
      out-trains.json@out:t5,t13,t47 \
      out-flights.json@out \
      back-trains.json@back:r6,r9 \
      --unpriced "bahn.de blocked automated access on 2026-11-04. Read the price on bahn.de." \
      --out trip/trip.json

PART@GROUP:IDS takes the journeys IDS (all when left out) from PART and sets their group.
A part may also carry "deals"; deals that name a journey you did not take are dropped.
Places that no journey uses are dropped, except the places in the base file.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import dump, haversine_km  # noqa: E402


def _load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def parse_spec(spec):
    path, _, rest = spec.partition("@")
    group, _, ids = rest.partition(":")
    return path, group or None, [i for i in ids.split(",") if i] or None


def merge(base, parts, unpriced=None):
    """parts: [(data, group, ids)]. Returns the trip and a list of warnings."""
    trip = dict(base)
    places = dict(base.get("places", {}))
    keep = set(places)
    journeys = list(base.get("journeys", []))
    deals = list(base.get("deals", []))
    notes = []
    for data, group, ids in parts:
        by_id = {j["id"]: j for j in data.get("journeys", [])}
        missing = [i for i in (ids or []) if i not in by_id]
        if missing:
            raise SystemExit(f"journeys not found: {', '.join(missing)}")
        rename = {}
        for k, p in data.get("places", {}).items():
            if k not in places:
                places[k] = p
            elif p.get("coord") and places[k].get("coord") and haversine_km(p["coord"], places[k]["coord"]) > 1:
                n = 2
                while f"{k}-{n}" in places and places[f"{k}-{n}"].get("coord") != p.get("coord"):
                    n += 1
                rename[k] = f"{k}-{n}"
                places[rename[k]] = p
                notes.append(f"place {k} from another source is more than 1 km away; renamed it {rename[k]}")
        for j in [by_id[i] for i in ids] if ids else data.get("journeys", []):
            j = json.loads(json.dumps(j))
            if group:
                j["group"] = group
            for x in [j] + j.get("segments", []):
                for f in ("from", "to"):
                    x[f] = rename.get(x[f], x[f])
            journeys.append(j)
        deals += data.get("deals", [])
    seen = set()
    for j in journeys:
        if j["id"] in seen:
            raise SystemExit(f"journey id {j['id']} is used twice; give the parts other --prefix values")
        seen.add(j["id"])
        j.setdefault("group", "out")
        if unpriced and not j.get("offers"):
            w = j.get("warning")
            if not w:
                j["warning"] = {"short": "No price", "text": unpriced}
            elif unpriced not in w["text"]:
                j["warning"] = {"short": w["short"] + ", no price", "text": w["text"] + " " + unpriced}
    used = set(keep)
    for j in journeys:
        used |= {j["from"], j["to"]}
        for s in j.get("segments", []):
            used |= {s["from"], s["to"]}
    lost = sorted(k for k in used if k not in places)
    if lost:
        raise SystemExit(f"places missing: {', '.join(lost)}")
    trip["places"] = {k: v for k, v in places.items() if k in used}
    order = []
    for j in journeys:
        if j["group"] not in order:
            order.append(j["group"])
    journeys.sort(key=lambda j: (order.index(j["group"]), j["dep"]))
    trip["journeys"] = journeys
    trip["deals"] = [d for d in deals if all(i in seen for i in d["journeys"])]
    return trip, notes


def prune(trip, folder):
    """Remove route files in folder/paths that the trip does not name. Returns the count."""
    used = {os.path.normpath(os.path.join(folder, p)) for j in trip["journeys"]
            for p in [j.get("path")] + [s.get("path") for s in j.get("segments", [])] if isinstance(p, str)}
    d = os.path.join(folder, "paths")
    n = 0
    for f in os.listdir(d) if os.path.isdir(d) else []:
        full = os.path.normpath(os.path.join(d, f))
        if f.endswith(".geojson") and full not in used:
            os.remove(full)
            n += 1
    print(f"removed {n} unused route files", file=sys.stderr)
    return n


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("base")
    ap.add_argument("parts", nargs="+", help="PART.json[@GROUP[:ID,ID]]")
    ap.add_argument("--unpriced", help="warning text for each journey that has no offer")
    ap.add_argument("--prune-paths", action="store_true",
                    help="delete .geojson files in <out folder>/paths that no segment uses")
    ap.add_argument("--out")
    a = ap.parse_args(argv)
    parts = []
    for spec in a.parts:
        path, group, ids = parse_spec(spec)
        parts.append((_load(path), group, ids))
    trip, notes = merge(_load(a.base), parts, a.unpriced)
    for n in notes:
        print(n, file=sys.stderr)
    dump(trip, a.out)
    if a.out and a.prune_paths:
        prune(trip, os.path.dirname(os.path.abspath(a.out)))
    if a.out:
        print(f"{len(trip['journeys'])} journeys, {len(trip['places'])} places -> {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
