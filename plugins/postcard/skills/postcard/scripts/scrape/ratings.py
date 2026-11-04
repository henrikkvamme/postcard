#!/usr/bin/env python3
"""Seller ratings with a cache.

The skill ships ratings.json: Trustpilot scores for common airlines, railways, bus and ferry
companies and travel agencies, with the date they were read. Your own reads go to
~/.cache/postcard/ratings.json and win over the shipped table.

  python3 ratings.py get Bravofly                 # by name, alias, airline code or domain
  python3 ratings.py fetch www.bravofly.com       # read Trustpilot directly; says what to do when blocked
  python3 ratings.py parse page.html --domain www.bravofly.com   # a page you saved with another tool
  python3 ratings.py set www.tripado.com --name Tripado --kind agency --stars 3.8 --reviews 1200
  python3 ratings.py annotate ~/trips/x/trip.json # fill stars, reviews, rating_source on every offer

Trustpilot blocks plain HTTP clients and automated browsers (HTTP 403, a bot message). Do not work
around it. A web fetch or web search tool in your harness can usually read the score: then
store it with `set`. Ratings older than 180 days print a warning.
"""
import argparse
import datetime as dt
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, http_text, today  # noqa: E402

SHIPPED = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ratings.json")
LOCAL = os.path.join(CACHE, "ratings.json")
STALE_DAYS = 180


def _load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f).get("sellers", {})
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def table():
    t = _load(SHIPPED)
    t.update(_load(LOCAL))
    return t


def _norm(s):
    return re.sub(r"[^a-z0-9.]+", " ", (s or "").lower()).strip()


def find(query):
    """Return (domain, entry) for a seller name, alias, code or domain, or (None, None)."""
    q = _norm(query)
    t = table()
    bare = q.replace("www.", "")
    for d, e in t.items():
        if q == _norm(d) or bare == _norm(d).replace("www.", ""):
            return d, e
    for d, e in t.items():
        names = [_norm(e.get("name"))] + [_norm(a) for a in e.get("aliases", [])]
        if q in names:
            return d, e
    for d, e in t.items():  # "Book with Bravofly", "Opodo CH"
        names = [_norm(e.get("name"))] + [_norm(a) for a in e.get("aliases", []) if len(a) > 3]
        if any(n and re.search(r"\b" + re.escape(n) + r"\b", q) for n in names):
            return d, e
    return None, None


def age_days(entry):
    try:
        return (dt.date.today() - dt.date.fromisoformat(entry["seen"])).days
    except (KeyError, ValueError):
        return None


def parse(text):
    """Read stars and reviews from a Trustpilot page: JSON-LD, __NEXT_DATA__, or the visible text."""
    m = re.search(r'"aggregateRating"\s*:\s*\{[^}]*?"ratingValue"\s*:\s*"?([\d.]+)"?[^}]*?"reviewCount"\s*:\s*"?(\d+)', text)
    if m:
        return float(m.group(1)), int(m.group(2))
    m = re.search(r'"trustScore"\s*:\s*([\d.]+)', text)
    n = re.search(r'"numberOfReviews"\s*:\s*(\d+)', text)
    if m and n:
        return float(m.group(1)), int(n.group(1))
    plain = html.unescape(re.sub(r"<[^>]+>", " ", text))
    # The star image reads "TrustScore 3.5 out of 5" (rounded to half stars). Prefer the plain number.
    m = (re.search(r"TrustScore\s*([1-5](?:\.\d)?)(?![\d.]|\s*out of)", plain)
         or re.search(r"\b(?:Excellent|Great|Average|Poor|Bad)\s+([1-5]\.\d)\b", plain)
         or re.search(r"\b([1-5]\.\d)\s+(?:Excellent|Great|Average|Poor|Bad)\b", plain))
    n = (re.search(r"Reviews\s+(\d[\d,.]*)", plain) or re.search(r"(\d[\d,.]*)\s*(?:total\s+)?reviews", plain, re.I))
    if m and n:
        return float(m.group(1)), int(re.sub(r"[^\d]", "", n.group(1)))
    return None


def store(domain, **fields):
    os.makedirs(os.path.dirname(LOCAL), exist_ok=True)
    data = {"sellers": _load(LOCAL)}
    e = data["sellers"].get(domain) or table().get(domain) or {}
    e = {**e, **{k: v for k, v in fields.items() if v is not None}}
    e.setdefault("rating_source", "trustpilot")
    e.setdefault("url", f"https://www.trustpilot.com/review/{domain}")
    e.setdefault("aliases", [])
    e["seen"] = fields.get("seen") or today()
    data["sellers"][domain] = e
    with open(LOCAL, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    return e


def fetch(domain):
    url = f"https://www.trustpilot.com/review/{domain}"
    try:
        text = http_text(url, headers={"Accept": "text/html"}, ttl=30 * 86400)
    except RuntimeError as e:
        return {"error": str(e), "blocked": "403" in str(e),
                "next": f"Trustpilot refused this client. Do not retry around it. Read {url} with a web fetch or "
                        f"web search tool, then run: ratings.py set {domain} --stars <TrustScore> --reviews <count>"}
    r = parse(text)
    if not r:
        return {"error": "no score in the page", "next": f"read {url} by eye and use `set`"}
    return store(domain, stars=r[0], reviews=r[1])


def annotate(path):
    with open(path, encoding="utf-8") as f:
        trip = json.load(f)
    hit = miss = 0
    missing = set()
    for j in trip.get("journeys", []):
        for o in j.get("offers", []):
            if o.get("stars") is not None:
                continue
            _, e = find(o.get("seller", ""))
            if e and e.get("stars") is not None:
                o.update(stars=e["stars"], reviews=e["reviews"], rating_source=e.get("rating_source", "trustpilot"))
                hit += 1
            else:
                miss += 1
                missing.add(o.get("seller", ""))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(trip, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return {"rated": hit, "unrated": miss, "unknown_sellers": sorted(missing)}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("get")
    g.add_argument("seller")
    f = sub.add_parser("fetch")
    f.add_argument("domain")
    p = sub.add_parser("parse")
    p.add_argument("file")
    p.add_argument("--domain")
    s = sub.add_parser("set")
    s.add_argument("domain")
    s.add_argument("--name")
    s.add_argument("--kind", choices=["operator", "agency"])
    s.add_argument("--stars", type=float)
    s.add_argument("--reviews", type=int)
    s.add_argument("--source", default="trustpilot")
    s.add_argument("--alias", action="append")
    a = sub.add_parser("annotate")
    a.add_argument("trip")
    sub.add_parser("list")
    x = ap.parse_args(argv)
    if x.cmd == "get":
        d, e = find(x.seller)
        if not e:
            print(json.dumps({"seller": x.seller, "found": False,
                              "next": "find its domain, read https://www.trustpilot.com/review/<domain>, then `set`"}))
            return 1
        out = {"domain": d, **e, "age_days": age_days(e)}
        if (out["age_days"] or 0) > STALE_DAYS:
            out["warning"] = f"read {out['age_days']} days ago; read it again"
        print(json.dumps(out, ensure_ascii=False))
    elif x.cmd == "fetch":
        print(json.dumps(fetch(x.domain), ensure_ascii=False))
    elif x.cmd == "parse":
        r = parse(open(x.file, encoding="utf-8").read())
        if not r:
            print(json.dumps({"error": "no score found"}))
            return 1
        out = {"stars": r[0], "reviews": r[1]}
        if x.domain:
            out = store(x.domain, **out)
        print(json.dumps(out, ensure_ascii=False))
    elif x.cmd == "set":
        e = store(x.domain, name=x.name, kind=x.kind, stars=x.stars, reviews=x.reviews, rating_source=x.source,
                  aliases=x.alias)
        print(json.dumps({"domain": x.domain, **e}, ensure_ascii=False))
    elif x.cmd == "annotate":
        print(json.dumps(annotate(x.trip), ensure_ascii=False))
    else:
        for d, e in sorted(table().items(), key=lambda kv: kv[1]["name"].lower()):
            print(f"{e['name']:<16} {e['kind']:<9} {e.get('stars')!s:>4} {e['reviews']:>7}  {e['seen']}  {d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
