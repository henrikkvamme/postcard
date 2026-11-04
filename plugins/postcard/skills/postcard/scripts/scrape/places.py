#!/usr/bin/env python3
"""Place entries for trip.json, and alternate airports near a city.

  python3 places.py airport ZRH BSL HRG          # {"ZRH": {"name", "city", "kind", "coord", "tz"}, ...}
  python3 places.py stop "Zürich HB" "Moûtiers"   # stations and stops, from Transitous
  python3 places.py near ZRH --km 200            # airports with scheduled flights within 200 km
  python3 places.py near "47.37,8.54" --km 200

Airport data: OurAirports (type and scheduled service) and mwgg/Airports (time zones), both
public domain or MIT, downloaded once and cached for 90 days under ~/.cache/postcard.
"""
import argparse
import csv
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import COUNTRY_TZ, dump, haversine_km, http_text, slug, town  # noqa: E402

OURAIRPORTS = "https://davidmegginson.github.io/ourairports-data/airports.csv"
MWGG = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json"
_AIRPORTS = None
# OurAirports names the municipality, not the town a person knows.
CITY = {"BSL": "Basel", "MLH": "Basel", "EAP": "Basel", "ACE": "Lanzarote", "SAW": "Istanbul",
        "TFS": "Tenerife", "TFN": "Tenerife", "ZRH": "Zürich", "GVA": "Geneva", "AMS": "Amsterdam",
        "FRA": "Frankfurt", "CPH": "Copenhagen"}


def airports():
    """IATA code -> {name, city, country, coord, tz, type, scheduled}."""
    global _AIRPORTS
    if _AIRPORTS is not None:
        return _AIRPORTS
    tz = {}
    for v in json.loads(http_text(MWGG, ttl=90 * 86400, timeout=120)).values():
        if v.get("iata"):
            tz[v["iata"]] = v.get("tz")
    out = {}
    for r in csv.DictReader(io.StringIO(http_text(OURAIRPORTS, ttl=90 * 86400, timeout=120))):
        code = r.get("iata_code")
        if not code or r["type"] == "closed":
            continue
        # The tz table gives Geneva Europe/Paris; the country decides. Basel-Mulhouse is in France.
        zone = tz.get(code)
        if (zone or "").startswith("Europe/") and r["iso_country"] in COUNTRY_TZ:
            zone = COUNTRY_TZ[r["iso_country"]]
        out[code] = {"name": r["name"], "city": CITY.get(code) or r["municipality"],
                     "country": r["iso_country"],
                     "coord": [round(float(r["longitude_deg"]), 4), round(float(r["latitude_deg"]), 4)],
                     "tz": zone, "type": r["type"], "scheduled": r["scheduled_service"] == "yes"}
    _AIRPORTS = out
    return out


def airport(code):
    a = airports().get(code.upper())
    if not a:
        raise SystemExit(f"unknown airport code {code}")
    return {"name": a["name"], "city": a["city"], "kind": "airport", "coord": a["coord"], "tz": a["tz"],
            "code": code.upper()}


def near(lnglat, km=150, kinds=("large_airport", "medium_airport")):
    rows = []
    for code, a in airports().items():
        if a["type"] in kinds and a["scheduled"]:
            d = haversine_km(lnglat, a["coord"])
            if d <= km:
                rows.append({"code": code, "name": a["name"], "city": a["city"], "country": a["country"],
                             "km": round(d), "type": a["type"].split("_")[0], "tz": a["tz"]})
    return sorted(rows, key=lambda r: r["km"])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    a1 = sub.add_parser("airport")
    a1.add_argument("codes", nargs="+")
    a2 = sub.add_parser("stop")
    a2.add_argument("names", nargs="+")
    a3 = sub.add_parser("near")
    a3.add_argument("where", help="an airport code or lat,lng")
    a3.add_argument("--km", type=float, default=150)
    a3.add_argument("--small", action="store_true", help="also small airports with scheduled flights")
    a = ap.parse_args(argv)
    if a.cmd == "airport":
        dump({c.upper(): airport(c) for c in a.codes})
    elif a.cmd == "stop":
        import transitous
        out = {}
        for n in a.names:
            hits = transitous.geocode(n)
            if not hits:
                print(f"no stop for {n}", file=sys.stderr)
                continue
            h = hits[0]
            out[slug(h["name"], 16)] = {"name": h["name"], "city": town(h["name"]), "kind": "station",
                                         "coord": h["coord"], "tz": h["tz"], "transitous_id": h["id"]}
        dump(out)
    else:
        w = a.where
        if len(w) == 3 and w.isalpha():
            pt = airports()[w.upper()]["coord"]
        else:
            lat, lng = map(float, w.split(","))
            pt = [lng, lat]
        kinds = ("large_airport", "medium_airport", "small_airport") if a.small else ("large_airport", "medium_airport")
        dump(near(pt, a.km, kinds))


if __name__ == "__main__":
    main()
