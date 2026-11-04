#!/usr/bin/env python3
"""Google Flights: search URLs, and parsers for what gflights_list.js and gflights_booking.js return.

  python3 gflights.py url ZRH AMS 2026-12-04                      # one way
  python3 gflights.py url ZRH AMS 2026-12-04 --back 2026-12-06    # round trip
  python3 gflights.py url BSL HRG 2027-01-10 --adults 1 --curr CHF
  python3 gflights.py parse list.txt --group out --prefix o --out out.json [--pareto] [--max-stops 1]
  python3 gflights.py parse back.txt --group back --prefix r --deal-with o3   # round-trip return list
  python3 gflights.py booking booking.txt --journey o3                       # sellers, fares, bags
  python3 gflights.py dates grid1.txt grid2.txt --nights 7 --top 5           # cheapest stays from date grids

`parse` reads the saved output of gflights_list.js (any browser tool; the chrome-devtools-axi
`result:` wrapper is fine) and prints {"places", "journeys", "deals"} in trip.json v2 shape.
List prices are the lowest price Google shows; each offer has "basis": "list". Open the booking
options for the journeys you keep, to get the real sellers and the bag prices ("basis": "booking").
"""
import argparse
import datetime as dt
import os
import re
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import dump, today, unwrap  # noqa: E402

BASE = "https://www.google.com/travel/flights"
# Google writes some airports with another code in the itinerary. Map them to the code that the
# search URL and places.py use. EuroAirport Basel-Mulhouse: MLH (French side) is BSL.
ALIAS = {"MLH": "BSL", "EAP": "BSL"}
TIME = re.compile(r"^(\d{1,2}:\d{2}\s?[AP]M)(\+\d)?\s*(.+?)\s*\(([A-Z]{3})\)\s*$")
CABINS = r"(?:Economy|Premium economy|Premium Economy|Business|First)"
CARRIER = re.compile(r"^(.+?)" + CABINS + r"(.*?)([A-Z0-9]{2}\s?\d{1,4})\s*$")
LAYOVER = re.compile(r"^(?:(\d+) hr)?\s*(?:(\d+) min)?\s*layover(.*)$")


def search_url(frm, to, date, back=None, adults=1, children=0, curr="EUR", gl=None, cabin=None):
    q = f"Flights from {frm} to {to} on {date}"
    q += f" through {back}" if back else " one way"
    pax = []
    if adults != 1 or children:
        pax.append(f"{adults} adult{'s' if adults != 1 else ''}")
    if children:
        pax.append(f"{children} child{'ren' if children != 1 else ''}")
    if pax:
        q += " for " + " and ".join(pax)
    if cabin:
        q += f" {cabin} class"
    params = {"q": q, "curr": curr, "hl": "en"}
    if gl:
        params["gl"] = gl
    return f"{BASE}?{urllib.parse.urlencode(params, quote_via=urllib.parse.quote)}"


def money(text):
    """'CHF 1,234' -> 1234; "CHF 1'234" -> 1234; '€99' -> 99. None when there is no number."""
    m = re.search(r"(\d[\d,.'\s]*)", text or "")
    if not m:
        return None
    raw = re.sub(r"[\s']", "", m.group(1)).rstrip(".,")
    if re.search(r"[.,]\d{2}$", raw) and not re.search(r"[.,]\d{3}$", raw):
        raw = raw[:-3]
    return int(re.sub(r"[.,]", "", raw))


def _clock(t):
    return dt.datetime.strptime(t.replace(" ", " ").strip(), "%I:%M %p").strftime("%H:%M")


def parse_details(details, base_date):
    """Segments from the expanded 'Flight details' text of one result."""
    lines = [l.strip() for l in details.splitlines() if l.strip()]
    segs, pending, layovers, overnight = [], None, [], False
    cur = None
    for l in lines:
        m = TIME.match(l)
        if m:
            day = base_date + dt.timedelta(days=int((m.group(2) or "+0")[1:]))
            stamp = f"{day.isoformat()}T{_clock(m.group(1))}"
            if pending is None:
                pending = {"from": m.group(4), "dep": stamp, "from_name": m.group(3)}
            else:
                cur = {"mode": "plane", **pending, "to": m.group(4), "arr": stamp, "to_name": m.group(3)}
                segs.append(cur)
                pending = None
            continue
        m = CARRIER.match(l)
        if m and cur is not None and "number" not in cur:
            cur["carrier"] = m.group(1).strip()
            cur["number"] = m.group(3).replace(" ", " ").strip()
            ac = m.group(2).strip()
            if ac:
                cur["aircraft"] = ac
            continue
        if cur is not None and l.startswith("Plane and crew by") or l.startswith("Operated by"):
            if cur is not None:
                cur["operated_by"] = re.sub(r"^(Plane and crew by|Operated by)\s*", "", l)
            continue
        m = LAYOVER.match(l)
        if m and (m.group(1) or m.group(2)):
            layovers.append(int(m.group(1) or 0) * 60 + int(m.group(2) or 0))
            if "Overnight" in l:
                overnight = True
    for s in segs:
        s.pop("from_name", None), s.pop("to_name", None)
    return segs, layovers, overnight


def _names(details):
    out = {}
    for l in details.splitlines():
        m = TIME.match(l.strip())
        if m:
            out.setdefault(m.group(4), m.group(3))
    return out


def _from_itinerary(it):
    """'ZRH-LHR-BA-725-20261203,LHR-AMS-BA-432-20261203' -> list of segments without times."""
    segs = []
    for part in filter(None, it.split(",")):
        p = part.split("-")
        if len(p) >= 5:
            segs.append({"mode": "plane", "from": p[0], "to": p[1], "number": f"{p[2]} {p[3]}",
                         "date": f"{p[4][:4]}-{p[4][4:6]}-{p[4][6:8]}"})
    return segs


LABEL = re.compile(r"Leaves (.+?) at (\d{1,2}:\d{2}\s?[AP]M) on \w+, (\w+ \d+) and arrives at (.+?) at "
                   r"(\d{1,2}:\d{2}\s?[AP]M) on \w+, (\w+ \d+)")


def _label_times(label, year):
    m = LABEL.search(label.replace(" ", " "))
    if not m:
        return None, None
    def stamp(day, t):
        d = dt.datetime.strptime(f"{day} {year}", "%B %d %Y").date()
        return f"{d.isoformat()}T{_clock(t)}"
    return stamp(m.group(3), m.group(2)), stamp(m.group(6), m.group(5))


NO_BIN = re.compile(r"does not include overhead bin|carry-on bag not included|no carry-on", re.I)


def parse_list(data, group="out", prefix="o", start=1, keep_unpriced=False, with_places=True):
    rows = data.get("rows", [])
    seen_on = data.get("seen") or today()
    cur = data.get("currency") or ""
    journeys, names = [], {}
    n = start
    for r in rows:
        itin = _from_itinerary(r.get("itinerary", ""))
        if not itin:
            continue
        base = dt.date.fromisoformat(itin[0]["date"])
        segs, layovers, overnight = parse_details(r.get("details", ""), base)
        if len(segs) != len(itin):  # details not expanded: fall back to the itinerary and the label
            dep, arr = _label_times(r.get("label", ""), base.year)
            segs = [{k: v for k, v in s.items() if k != "date"} for s in itin]
            if segs and dep:
                segs[0]["dep"], segs[-1]["arr"] = dep, arr
        names.update(_names(r.get("details", "")))
        price = None if "unavailable" in (r.get("price_text") or "") else money(r.get("price_text"))
        if price is None and not keep_unpriced:
            continue
        lab = r.get("label", "")
        carriers = []
        for s in segs:
            c = s.get("carrier")
            if c and c not in carriers:
                carriers.append(c)
        if not carriers:
            m = re.search(r"flight with (.+?)\.", lab)
            carriers = [m.group(1)] if m else []
        flags = list(r.get("flags", []))
        no_bin = bool(NO_BIN.search(lab)) or any(NO_BIN.search(f) for f in flags)
        if no_bin and "No overhead bin" not in flags:
            flags.append("No overhead bin")
        self_transfer = any(re.search(r"self transfer|separate tickets", f, re.I) for f in flags)
        j = {"id": f"{prefix}{n}", "mode": "plane", "group": group, "from": segs[0]["from"], "to": segs[-1]["to"],
             "dep": segs[0].get("dep"), "arr": segs[-1].get("arr"), "carrier": " + ".join(carriers),
             "numbers": " + ".join(s["number"] for s in segs if s.get("number")),
             "stops": len(segs) - 1, "segments": segs if len(segs) > 1 else [], "self_transfer": self_transfer,
             "offers": []}
        if layovers:
            j["layovers_min"] = layovers
        for i in range(len(segs) - 1):
            if segs[i]["to"] != segs[i + 1]["from"]:
                j["warning"] = {"short": "airport change",
                                "text": f"Change airports: land at {segs[i]['to']}, leave from {segs[i + 1]['from']}."}
        if overnight or any(m >= 360 for m in layovers):
            j.setdefault("warning", {"short": "long layover",
                                     "text": f"Layover of {max(layovers) // 60} h {max(layovers) % 60} min."})
        if price is not None:
            seller = segs[0].get("carrier") or (carriers[0] if carriers else "?")
            j["offers"].append({"seller": seller, "kind": "self" if self_transfer else "operator", "price": price,
                                "currency": cur, "basis": "list", "source": "Google Flights", "seen": seen_on,
                                "url": data.get("url", "")})
            if no_bin:  # low-cost fare: a small bag under the seat only
                j["offers"][-1]["bags"] = {"cabin": "fee"}
                j["offers"][-1]["bags_note"] = ("Fare includes one small bag under the seat. A cabin bag for the "
                                                "overhead bin and a checked bag cost extra.")
        if flags:
            j["flags"] = flags
        journeys.append(j)
        n += 1
    for j in journeys:  # one code per airport, so the places match other searches
        for x in [j] + j["segments"]:
            for k in ("from", "to"):
                x[k] = ALIAS.get(x[k], x[k])
    places = {}
    if with_places:
        codes = {s[k] for j in journeys for s in (j["segments"] or [j]) for k in ("from", "to")}
        try:
            from places import airport
        except ImportError:
            airport = None
        for c in sorted(codes):  # one unknown code must not cost the others their position
            try:
                if airport is None:
                    raise RuntimeError("places.py not found")
                places[c] = airport(c)
            except (SystemExit, RuntimeError, OSError) as e:  # offline or unknown: name only
                print(f"places: {c}: {e}; fill coord and tz with places.py airport", file=sys.stderr)
                places[c] = {"name": names.get(c, c), "kind": "airport"}
    return {"source": "Google Flights", "seen": seen_on, "currency": cur, "url": data.get("url"),
            "places": places, "journeys": journeys}


def _price(j):
    return min((o["price"] for o in j["offers"]), default=10 ** 9)


def pareto(journeys):
    """Drop a journey when another leaves at the same time or later, arrives at the same time or earlier,
    has no more stops and costs no more."""
    out = []
    for a in journeys:
        if not any(b is not a and b["dep"] >= a["dep"] and b["arr"] <= a["arr"] and b["stops"] <= a["stops"]
                   and _price(b) <= _price(a) and (b["dep"], b["arr"], b["stops"], _price(b)) !=
                   (a["dep"], a["arr"], a["stops"], _price(a)) for b in journeys):
            out.append(a)
    return out


BAG_CABIN_FREE = re.compile(r"(\d+|1) free carry-on|carry-on bag included|cabin bag included", re.I)
BAG_CABIN_NONE = re.compile(r"no carry-on|carry-on bag not (?:allowed|included)|personal item only|"
                            r"carry-on bag for a fee|doesn't include (?:a )?carry-on", re.I)
BAG_CHECKED_FREE = re.compile(r"(?:1st|first|\d+ free) checked bags? (?:free|included)|\d+ free checked bags?", re.I)


def _bags(block):
    cabin = checked = None
    m = re.search(r"carry-on(?: bag)?:?\s*(?:costs\s*)?([A-Z]{3}\s?[\d.,']+|[€$£][\d.,']+)", block, re.I)
    if BAG_CABIN_FREE.search(block):
        cabin = "included"
    elif m:
        cabin = money(m.group(1))
    elif BAG_CABIN_NONE.search(block):
        cabin = "none"
    m = re.search(r"1st checked bag:?\s*([A-Z]{3}\s?[\d.,']+|[€$£][\d.,']+)", block, re.I)
    if BAG_CHECKED_FREE.search(block):
        checked = "included"
    elif m:
        checked = money(m.group(1))
    elif re.search(r"no checked bags?|checked bags? not (?:included|allowed)", block, re.I):
        checked = "none"
    out = {}
    if cabin is not None:
        out["cabin"] = cabin
    if checked is not None:
        out["checked"] = checked
    return out


def parse_booking(data, journey=None):
    """Offers from the 'Booking options' text: one per seller and fare."""
    text = data.get("text", "")
    seen_on = data.get("seen") or today()
    cur = data.get("currency") or ""
    price_re = re.compile(r"^(?:" + (re.escape(cur) if cur else "[A-Z]{3}") + r"\s?[\d.,']+|[€$£]\s?[\d.,']+)$")
    offers = []
    for chunk in re.split(r"\n(?=Book with )", "\n" + text)[1:]:
        lines = [l.strip() for l in chunk.splitlines() if l.strip()]
        head = lines[0][len("Book with "):]
        kind = "agency"
        for tag, k in (("Airline", "operator"), ("Official site", "operator")):
            if head.endswith(tag):
                head, kind = head[: -len(tag)].strip(), k
        fares, i = [], 1
        while i < len(lines):
            if price_re.match(lines[i]):
                name = lines[i - 1] if i > 1 and not price_re.match(lines[i - 1]) and lines[i - 1] not in (
                    "Hide options", "View options", "Continue") else ""
                j = i + 1
                while j < len(lines) and lines[j] != "Continue" and not price_re.match(lines[j]):
                    j += 1
                block = "\n".join(lines[i + 1:j])
                fares.append({"fare": name, "price": money(lines[i]), "bags": _bags(block),
                              "rules": [l for l in lines[i + 1:j] if re.search(r"refund|change|seat", l, re.I)]})
                i = j
            i += 1
        for f in fares:
            o = {"seller": head, "kind": kind, "price": f["price"], "currency": cur, "basis": "booking",
                 "source": "Google Flights booking options", "seen": seen_on, "url": data.get("url", "")}
            if f["fare"]:
                o["fare"] = f["fare"]
            if f["bags"]:
                o["bags"] = f["bags"]
            if f["rules"]:
                o["rules"] = f["rules"]
            offers.append(o)
    # Without fare families, the bag rules sit in the itinerary summary, for the airline's own fare.
    summary = data.get("summary", "")
    sbags = _bags(summary)
    if re.search(r"1st checked bag[^\n]*available for a fee", summary, re.I) and "checked" not in sbags:
        sbags["checked"] = "fee"
    if re.search(r"\d carry-on bags?[^\n]*available for a fee", summary, re.I) and "cabin" not in sbags:
        sbags["cabin"] = "fee"
    if sbags:
        for o in offers:
            if "bags" not in o:
                o["bags"] = dict(sbags)
                o["bags_note"] = "From the itinerary summary. Agencies can add their own bag fees."
    trip = "round trip" if re.search(r"\bRound trip\b|\bReturn\b", summary) else "one way"
    return {"journey": journey, "trip": trip, "offers": offers,
            "note": "Bag fees apply to the whole trip" if "apply to your entire trip" in text else ""}


def parse_dates(data, year=None, nights=None):
    """Date grid cells -> [{"dep", "ret", "nights", "price"}], cheapest first."""
    rows = []
    for c in data.get("cells", []):
        m = re.match(r"^(.*?),\s*(\w{3} \d{1,2}) to (\w{3} \d{1,2})", c)
        if not m:
            continue
        price = money(m.group(1))
        if price is None:
            continue
        y = year or int((data.get("seen") or today())[:4])
        dep = dt.datetime.strptime(f"{m.group(2)} {y}", "%b %d %Y").date()
        if year is None and dep < dt.date.fromisoformat(data.get("seen") or today()):
            dep = dep.replace(year=y + 1)
        ret = dt.datetime.strptime(f"{m.group(3)} {dep.year}", "%b %d %Y").date()
        if ret < dep:
            ret = ret.replace(year=dep.year + 1)
        n = (ret - dep).days
        if nights is None or n in nights:
            rows.append({"dep": dep.isoformat(), "ret": ret.isoformat(), "nights": n, "price": price})
    return sorted(rows, key=lambda r: (r["price"], r["dep"]))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    u = sub.add_parser("url")
    u.add_argument("frm")
    u.add_argument("to")
    u.add_argument("date")
    u.add_argument("--back")
    u.add_argument("--adults", type=int, default=1)
    u.add_argument("--children", type=int, default=0)
    u.add_argument("--curr", default="EUR")
    u.add_argument("--gl", help="country code for the point of sale, such as CH")
    p = sub.add_parser("parse")
    p.add_argument("file")
    p.add_argument("--group", default="out")
    p.add_argument("--prefix", default="o")
    p.add_argument("--start", type=int, default=1)
    p.add_argument("--max-stops", type=int)
    p.add_argument("--max-hours", type=float)
    p.add_argument("--pareto", action="store_true", help="drop journeys that another beats on time, stops and price")
    p.add_argument("--keep-unpriced", action="store_true")
    p.add_argument("--no-places", action="store_true")
    p.add_argument("--deal-with", help="this is the return list of a round trip; its prices are totals with this journey id")
    p.add_argument("--out")
    g = sub.add_parser("dates")
    g.add_argument("files", nargs="+", help="one or more saved gflights_dates.js outputs")
    g.add_argument("--nights", help="keep these stay lengths, such as 7 or 6-8")
    g.add_argument("--top", type=int, default=10)
    b = sub.add_parser("booking")
    b.add_argument("file")
    b.add_argument("--journey")
    a = ap.parse_args(argv)
    if a.cmd == "url":
        print(search_url(a.frm, a.to, a.date, a.back, a.adults, a.children, a.curr, a.gl))
        return
    if a.cmd == "dates":
        nights = None
        if a.nights:
            lo, _, hi = a.nights.partition("-")
            nights = set(range(int(lo), int(hi or lo) + 1))
        rows, seen = [], set()
        for f in a.files:
            data = unwrap(open(f, encoding="utf-8").read())
            for r in parse_dates(data, nights=nights):
                if (r["dep"], r["ret"]) not in seen:
                    seen.add((r["dep"], r["ret"]))
                    rows.append({**r, "currency": data.get("currency"), "seen": data.get("seen"), "url": data.get("url")})
        rows.sort(key=lambda r: (r["price"], r["dep"]))
        dump(rows[: a.top])
        return
    data = unwrap(open(a.file, encoding="utf-8").read())
    if a.cmd == "booking":
        dump(parse_booking(data, a.journey))
        return
    out = parse_list(data, a.group, a.prefix, a.start, a.keep_unpriced, not a.no_places)
    js = out["journeys"]
    if a.max_stops is not None:
        js = [j for j in js if j["stops"] <= a.max_stops]
    if a.max_hours:
        def hours(j):
            from zoneinfo import ZoneInfo
            p = out["places"]
            try:
                d = dt.datetime.fromisoformat(j["dep"]).replace(tzinfo=ZoneInfo(p[j["from"]]["tz"]))
                e = dt.datetime.fromisoformat(j["arr"]).replace(tzinfo=ZoneInfo(p[j["to"]]["tz"]))
                return (e - d).total_seconds() / 3600
            except (KeyError, TypeError, ValueError):
                return 0
        js = [j for j in js if hours(j) <= a.max_hours]
    if a.pareto:
        js = pareto(js)
    for n, j in enumerate(js, a.start):  # number the kept journeys without gaps
        j["id"] = f"{a.prefix}{n}"
    if a.deal_with:
        out["deals"] = [{"journeys": [a.deal_with, j["id"]], "price": o["price"], "seller": o["seller"],
                         "kind": o["kind"], "what": "Round trip", "basis": "list", "source": "Google Flights",
                         "seen": o["seen"], "url": o["url"]} for j in js for o in j["offers"]]
        for j in js:
            j["offers"] = []  # the price belongs to the pair; price this flight alone with a one-way search
    used = {s[k] for j in js for s in (j["segments"] or [j]) for k in ("from", "to")}
    out["places"] = {k: v for k, v in out["places"].items() if k in used}
    out["journeys"] = js
    dump(out, a.out)
    if a.out:
        print(f"{len(js)} journeys -> {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
