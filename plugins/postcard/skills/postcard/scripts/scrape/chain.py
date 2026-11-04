#!/usr/bin/env python3
"""Join journeys end to end into one mixed journey, such as a train to an alternate airport and
the flight from there.

  python3 chain.py trains.json:zb4 flights.json:o3 --id b1 --min-connect 60 --out part.json
  python3 chain.py flights.json:r2 trains.json:bz1 --id b2 --out part2.json --append

Each PART:ID names one journey in a helper output. The result is a part for merge.py, with the
places of all the pieces. Offers are copied from each piece, and the prices are added up when
every piece has a priced offer. When a piece has no price (most transfers), the result keeps the
priced pieces' offers and gets a warning that the transfer is not in the price.

The script stops when the next piece leaves before the earlier one arrives plus --min-connect
minutes (60 by default; use 90 or more for a flight after a train).
"""
import argparse
import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import dump, haversine_km  # noqa: E402


def _load(spec):
    path, _, jid = spec.rpartition(":")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for j in data.get("journeys", []):
        if j["id"] == jid:
            return data, j
    raise SystemExit(f"{jid} not found in {path}")


def _segments(j):
    if j.get("segments"):
        return [dict(s) for s in j["segments"]]
    s = {k: j[k] for k in ("mode", "from", "to", "dep", "arr") if k in j}
    s["carrier"] = j.get("carrier", "")
    s["number"] = j.get("numbers", "")
    if j.get("path"):
        s["path"] = j["path"]
    return [s]


def chain(pieces, jid, min_connect=60):
    """pieces: [(data, journey)]. Returns a part {"places", "journeys"}."""
    places, segs, notes = {}, [], []
    for i, (data, j) in enumerate(pieces):
        places.update({k: v for k, v in data.get("places", {}).items()})
        if i:
            prev = pieces[i - 1][1]
            gap = (dt.datetime.fromisoformat(j["dep"]) - dt.datetime.fromisoformat(prev["arr"])).total_seconds() / 60
            if gap < min_connect:
                raise SystemExit(f"{j['id']} leaves {gap:.0f} min after {prev['id']} arrives; need {min_connect}")
            a, b = places.get(prev["to"], {}).get("coord"), places.get(j["from"], {}).get("coord")
            if prev["to"] != j["from"] and not (a and b and haversine_km(a, b) < 1):
                notes.append(f"Change from {places.get(prev['to'], {}).get('name', prev['to'])} to "
                             f"{places.get(j['from'], {}).get('name', j['from'])}.")
        segs += _segments(j)
    first, last = pieces[0][1], pieces[-1][1]
    modes = {s["mode"] for s in segs}
    out = {"id": jid, "mode": modes.pop() if len(modes) == 1 else "mixed",
           "from": first["from"], "to": last["to"], "dep": first["dep"], "arr": last["arr"],
           "carrier": " + ".join(dict.fromkeys(p[1].get("carrier", "") for p in pieces if p[1].get("carrier"))),
           "numbers": " + ".join(p[1].get("numbers", "") for p in pieces if p[1].get("numbers")),
           "segments": segs, "transfers": len(segs) - 1,
           "self_transfer": any(p[1].get("self_transfer") for p in pieces) or len(pieces) > 1,
           "flags": sorted({f for p in pieces for f in p[1].get("flags", [])})}
    priced = [p[1] for p in pieces if p[1].get("offers")]
    unpriced = [p[1] for p in pieces if not p[1].get("offers")]
    if len(priced) == len(pieces) and all(len(p["offers"]) == 1 for p in priced):
        o = dict(priced[0]["offers"][0])
        o["price"] = round(sum(p["offers"][0]["price"] for p in priced), 2)
        o["price_note"] = " + ".join(f"{p['offers'][0]['seller']} {p['offers'][0]['price']}" for p in priced)
        o["kind"] = "self"
        out["offers"] = [o]
    else:
        out["offers"] = [dict(o) for p in priced for o in p.get("offers", [])]
    warn = list(notes)
    if unpriced and priced:
        names = ", ".join(f"{p.get('carrier') or p['mode']} {p['dep'][11:16]}-{p['arr'][11:16]}" for p in unpriced)
        warn.append(f"The price does not include {names}.")
    if len(pieces) > 1:
        warn.append("Separate tickets: a late first part does not protect the next one.")
    for p in pieces:
        if p[1].get("warning"):
            warn.append(p[1]["warning"]["text"])
    out["warning"] = {"short": "Separate tickets" if not unpriced else "Transfer not priced", "text": " ".join(warn)}
    used = {s[k] for s in segs for k in ("from", "to")}
    return {"places": {k: v for k, v in places.items() if k in used}, "journeys": [out]}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pieces", nargs="+", help="PART.json:ID, in travel order")
    ap.add_argument("--id", required=True, help="id of the joined journey")
    ap.add_argument("--min-connect", type=int, default=60, help="minutes needed between pieces")
    ap.add_argument("--append", action="store_true", help="add to --out instead of replacing it")
    ap.add_argument("--out")
    a = ap.parse_args(argv)
    part = chain([_load(s) for s in a.pieces], a.id, a.min_connect)
    if a.append and a.out and os.path.exists(a.out):
        with open(a.out, encoding="utf-8") as f:
            old = json.load(f)
        old["places"].update(part["places"])
        old["journeys"] = [j for j in old["journeys"] if j["id"] != a.id] + part["journeys"]
        part = old
    dump(part, a.out)


if __name__ == "__main__":
    main()
