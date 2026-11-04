#!/usr/bin/env python3
"""Climate for a place and a span of days, from Open-Meteo (keyless).

It averages the same calendar days over past years (ERA5 archive), so it works for dates months
ahead, where no forecast exists. It adds the sea surface temperature when the place is on a coast.

  python3 climate.py "28.05,-16.71" --from 01-10 --to 01-24 --name "Tenerife south"
  python3 climate.py Hurghada Tenerife Madeira --from 01-10 --to 01-24       # several, one row each
  python3 climate.py "27.26,33.81" --from 01-10 --to 01-24 --years 2016-2025

Prints one JSON row per place: day_max_c, night_min_c, sun_h (sunshine hours a day), rain_days
(days with 1 mm or more), wind_kmh (mean daily max), sea_c, and the years used. Write it into
trip.json under context.weather. A forecast (16 days ahead at most) is a different thing; use
`--forecast` for trips that start within 14 days.
"""
import argparse
import datetime as dt
import json
import os
import statistics
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import http_json  # noqa: E402
from geometry import point  # noqa: E402

ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
MARINE = "https://marine-api.open-meteo.com/v1/marine"
FORECAST = "https://api.open-meteo.com/v1/forecast"
DAILY = "temperature_2m_max,temperature_2m_min,sunshine_duration,precipitation_sum,wind_speed_10m_max"


def _days(md_from, md_to, year):
    a = dt.date.fromisoformat(f"{year}-{md_from}")
    b = dt.date.fromisoformat(f"{year}-{md_to}")
    if b < a:  # span over new year, such as 12-20 to 01-05
        b = dt.date.fromisoformat(f"{year + 1}-{md_to}")
    return a, b


def climate(lnglat, md_from, md_to, years):
    lng, lat = lnglat
    rows = {"tmax": [], "tmin": [], "sun": [], "rain": [], "wind": [], "sea": []}
    used = []
    for y in years:
        a, b = _days(md_from, md_to, y)
        q = urllib.parse.urlencode({"latitude": lat, "longitude": lng, "start_date": a, "end_date": b,
                                    "daily": DAILY, "timezone": "auto"})
        d = http_json(f"{ARCHIVE}?{q}", ttl=None)["daily"]
        ok = [i for i, v in enumerate(d["temperature_2m_max"]) if v is not None]
        if not ok:
            continue
        used.append(y)
        rows["tmax"] += [d["temperature_2m_max"][i] for i in ok]
        rows["tmin"] += [d["temperature_2m_min"][i] for i in ok]
        rows["sun"] += [(d["sunshine_duration"][i] or 0) / 3600 for i in ok]
        rows["rain"] += [1 if (d["precipitation_sum"][i] or 0) >= 1 else 0 for i in ok]
        rows["wind"] += [d["wind_speed_10m_max"][i] for i in ok if d["wind_speed_10m_max"][i] is not None]
        try:
            q = urllib.parse.urlencode({"latitude": lat, "longitude": lng, "start_date": a, "end_date": b,
                                        "daily": "sea_surface_temperature_mean", "timezone": "auto"})
            m = http_json(f"{MARINE}?{q}", ttl=None).get("daily", {})
            rows["sea"] += [v for v in m.get("sea_surface_temperature_mean", []) if v is not None]
        except RuntimeError:
            pass  # inland, or marine data missing for that year
    if not used:
        raise SystemExit("no archive data for that place")
    r = lambda xs, n=1: round(statistics.mean(xs), n) if xs else None  # noqa: E731
    days = len(rows["tmax"]) / len(used)
    return {"coord": [lng, lat], "days": f"{md_from} to {md_to}", "years": f"{used[0]}-{used[-1]}",
            "day_max_c": r(rows["tmax"]), "night_min_c": r(rows["tmin"]), "sun_h": r(rows["sun"]),
            "rain_days": round(sum(rows["rain"]) / len(used), 1), "of_days": round(days),
            "wind_kmh": r(rows["wind"], 0), "sea_c": r(rows["sea"]),
            "source": "Open-Meteo ERA5 archive" + (" + marine" if rows["sea"] else "")}


def forecast(lnglat, start, end):
    lng, lat = lnglat
    q = urllib.parse.urlencode({"latitude": lat, "longitude": lng, "start_date": start, "end_date": end,
                                "daily": DAILY, "timezone": "auto"})
    d = http_json(f"{FORECAST}?{q}", ttl=3 * 3600)["daily"]
    return [{"date": t, "max_c": a, "min_c": b, "sun_h": round((s or 0) / 3600, 1), "rain_mm": p}
            for t, a, b, s, p in zip(d["time"], d["temperature_2m_max"], d["temperature_2m_min"],
                                     d["sunshine_duration"], d["precipitation_sum"])]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("places", nargs="+", help='"lat,lng" or a name')
    ap.add_argument("--from", dest="md_from", help="MM-DD")
    ap.add_argument("--to", dest="md_to", help="MM-DD")
    ap.add_argument("--years", default=None, help="such as 2016-2025 (default: the last 10 full years)")
    ap.add_argument("--forecast", nargs=2, metavar=("START", "END"), help="YYYY-MM-DD YYYY-MM-DD, within 16 days")
    ap.add_argument("--name", action="append", default=[], help="label for each place, in order")
    a = ap.parse_args(argv)
    last = dt.date.today().year - 1
    y0, y1 = (map(int, a.years.split("-")) if a.years else (last - 9, last))
    for i, p in enumerate(a.places):
        pt = point(p)
        if a.forecast:
            row = {"days": forecast(pt, *a.forecast), "source": "Open-Meteo forecast"}
        else:
            if not (a.md_from and a.md_to):
                raise SystemExit("give --from and --to as MM-DD")
            row = climate(pt, a.md_from, a.md_to, range(y0, y1 + 1))
        row = {"name": a.name[i] if i < len(a.name) else p, **row}
        print(json.dumps(row, ensure_ascii=False))


if __name__ == "__main__":
    main()
