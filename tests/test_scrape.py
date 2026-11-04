#!/usr/bin/env python3
"""Offline tests for the scrape helpers and the scenario data. Run: python3 tests/test_scrape.py

The helpers read the network through common.http_json and common.http_text. The tests replace
those with a reader of saved responses in tests/fixtures/scrape, so no test touches the network.
"""
import datetime as dt
import glob
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRAPE = os.path.join(ROOT, "plugins", "postcard", "skills", "postcard", "scripts", "scrape")
FIX = os.path.join(ROOT, "tests", "fixtures", "scrape")
SCENARIOS = os.path.join(ROOT, "tests", "scenarios")
sys.path.insert(0, SCRAPE)
os.environ["POSTCARD_CACHE"] = tempfile.mkdtemp(prefix="postcard-test-cache-")

import climate  # noqa: E402
import common  # noqa: E402
import flixbus  # noqa: E402
import geometry  # noqa: E402
import gflights  # noqa: E402
import ratings  # noqa: E402
import transitous  # noqa: E402
import merge  # noqa: E402
import chain  # noqa: E402


def fixture(name):
    with open(os.path.join(FIX, name), encoding="utf-8") as f:
        return f.read()


def fake_http(routes):
    """Return a stand-in for http_json/http_text: the first route whose key is in the URL wins."""
    def get(url, **kw):
        for key, name in routes.items():
            if key in url:
                return json.loads(fixture(name))
        raise RuntimeError(f"no fixture for {url}")
    return get


class Common(unittest.TestCase):
    def test_unwrap_axi_and_plain(self):
        v = common.unwrap(fixture("gflights_list_zrh_ams.txt"))
        self.assertEqual(v["currency"], "CHF")
        self.assertEqual(common.unwrap('{"a": 1}'), {"a": 1})
        self.assertEqual(common.unwrap(json.dumps(json.dumps({"a": 2}))), {"a": 2})

    def test_polyline(self):
        pts = common.decode_polyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@", 5)
        self.assertEqual([[round(x, 3) for x in p] for p in pts], [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]])

    def test_simplify_keeps_ends(self):
        line = [[0, 0], [0.5, 0.0001], [1, 0], [1, 1]]
        out = common.simplify(line, 0.01)
        self.assertEqual(out[0], [0, 0])
        self.assertEqual(out[-1], [1, 1])
        self.assertNotIn([0.5, 0.0001], out)

    def test_times(self):
        self.assertEqual(common.local_time("2026-12-03T06:59:00Z", "Europe/Zurich"), "2026-12-03T07:59")
        self.assertEqual(common.to_utc("2027-05-14T16:30", "Europe/Oslo"), "2027-05-14T14:30:00Z")


class GoogleFlights(unittest.TestCase):
    def test_url(self):
        u = gflights.search_url("ZRH", "AMS", "2026-12-04", curr="CHF")
        self.assertIn("one%20way", u)
        self.assertIn("hl=en", u)
        u = gflights.search_url("ZRH", "GVA", "2027-02-13", back="2027-02-20", adults=2, children=2, curr="CHF")
        self.assertIn("through%202027-02-20", u)
        self.assertIn("2%20adults%20and%202%20children", u)

    def test_money(self):
        self.assertEqual(gflights.money("CHF 1,234"), 1234)
        self.assertEqual(gflights.money("CHF 1'234"), 1234)
        self.assertEqual(gflights.money("€99"), 99)
        self.assertEqual(gflights.money("€99.50"), 99)
        self.assertIsNone(gflights.money("Price unavailable"))

    def test_parse_list(self):
        data = common.unwrap(fixture("gflights_list_zrh_ams.txt"))
        out = gflights.parse_list(data, "out", "o", with_places=False)
        js = out["journeys"]
        self.assertEqual(len(js), 6)  # the seventh row has no price
        ba = js[0]
        self.assertEqual((ba["from"], ba["to"], ba["dep"], ba["arr"]), ("ZRH", "AMS", "2026-12-03T06:15", "2026-12-03T11:00"))
        self.assertEqual(ba["numbers"], "BA 725 + BA 432")
        self.assertEqual([s["to"] for s in ba["segments"]], ["LHR", "AMS"])
        self.assertEqual(ba["layovers_min"], [85])
        self.assertEqual(ba["offers"][0]["price"], 139)
        self.assertEqual(ba["offers"][0]["basis"], "list")
        self.assertEqual(ba["offers"][0]["seen"], "2026-11-04")
        nonstop = js[1]
        self.assertEqual(nonstop["stops"], 0)
        self.assertEqual(nonstop["segments"], [])

    def test_next_day_marker(self):
        data = common.unwrap(fixture("gflights_list_zrh_ams.txt"))
        out = gflights.parse_list(data, "out", "o", keep_unpriced=True, with_places=False)
        last = out["journeys"][-1]
        self.assertEqual(last["segments"][1]["dep"], "2026-12-04T08:10")
        self.assertEqual(last["arr"], "2026-12-04T09:45")
        self.assertEqual(last["offers"], [])
        self.assertEqual(last["warning"]["short"], "long layover")

    def test_pareto(self):
        data = common.unwrap(fixture("gflights_list_zrh_ams.txt"))
        js = gflights.pareto(gflights.parse_list(data, with_places=False)["journeys"])
        ids = {j["numbers"] for j in js}
        self.assertIn("LX 728", ids)
        self.assertIn("BA 725 + BA 432", ids)

    def test_booking_fare_families_and_bags(self):
        b = gflights.parse_booking(json.loads(fixture("gflights_booking_ba.json")), "o1")
        offers = b["offers"]
        self.assertEqual([(o["seller"], o.get("fare"), o["price"]) for o in offers][:3],
                         [("British Airways", "Basic Economy", 139), ("British Airways", "Economy Plus", 152),
                          ("British Airways", "Club Business Plus", 351)])
        self.assertEqual(offers[0]["kind"], "operator")
        self.assertEqual(offers[0]["bags"], {"cabin": "included", "checked": 72})
        self.assertEqual(offers[1]["bags"]["checked"], "included")
        self.assertEqual((offers[3]["seller"], offers[3]["kind"], offers[3]["price"]), ("Bravofly", "agency", 159))
        self.assertIn("whole trip", b["note"])

    def test_booking_single_fares(self):
        b = gflights.parse_booking(json.loads(fixture("gflights_booking_ju.json")))
        self.assertEqual([(o["seller"], o["kind"], o["price"]) for o in b["offers"]],
                         [("Air Serbia", "operator", 179), ("Bravofly", "agency", 188),
                          ("Gotogate", "agency", 216), ("Tripado", "agency", 247)])

    def test_booking_low_cost_bags(self):
        b = gflights.parse_booking(json.loads(fixture("gflights_booking_u2_summary_bags.json")), "h1")
        self.assertEqual([(o["seller"], o["price"]) for o in b["offers"]], [("easyJet", 41)])
        self.assertEqual(b["offers"][0]["bags"], {"cabin": "fee", "checked": "fee"})

    def test_no_overhead_bin(self):
        data = json.loads(fixture("gflights_list_bsl_hrg_easyjet.json"))
        with mock.patch.dict(sys.modules, {"places": None}):
            j = gflights.parse_list(data, with_places=False)["journeys"]
        self.assertEqual((j[0]["numbers"], j[0]["offers"][0]["price"]), ("U2 1267", 41))
        self.assertIn("No overhead bin", j[0]["flags"])
        self.assertEqual(j[0]["offers"][0]["bags"], {"cabin": "fee"})
        self.assertEqual(j[1]["offers"][0]["bags"], {"cabin": "fee"})  # AJet too

    def test_booking_summary_bags(self):
        data = common.unwrap(fixture("gflights_booking_lx_summary_bags.txt"))
        b = gflights.parse_booking(data, "a1")
        self.assertEqual(b["offers"][0]["seller"], "SWISS")
        self.assertEqual(b["offers"][0]["price"], 493)
        for o in b["offers"]:
            self.assertEqual(o["bags"], {"cabin": "included", "checked": "fee"})
            self.assertIn("itinerary summary", o["bags_note"])

    def test_date_grid(self):
        data = common.unwrap(fixture("gflights_dates_bsl_hrg.txt"))
        rows = gflights.parse_dates(data)
        self.assertGreaterEqual(len(rows), 40)
        self.assertEqual(rows, sorted(rows, key=lambda r: (r["price"], r["dep"])))
        self.assertTrue(all(r["dep"].startswith("2027-01") for r in rows))
        seven = gflights.parse_dates(data, nights={7})
        self.assertEqual(seven[0], {"dep": "2027-01-11", "ret": "2027-01-18", "nights": 7, "price": 109})
        self.assertTrue(all(r["nights"] == 7 for r in seven))


class Transitous(unittest.TestCase):
    def test_journeys_and_paths(self):
        its = json.loads(fixture("transitous_plan_zrh_ams.json"))["itineraries"]
        with tempfile.TemporaryDirectory() as d:
            places = {}
            js = transitous.to_journeys(its, places, "t", os.path.join(d, "paths"))
            places = transitous.rekey(places, js)
            self.assertEqual(len(js), 2)
            ice = js[1]
            self.assertEqual(ice["dep"], "2026-12-03T07:59")  # 06:59Z in Zürich
            self.assertEqual(ice["numbers"], "ICE 200 + ICE 124")
            self.assertEqual(ice["mode"], "train")
            self.assertEqual(places[ice["from"]]["name"], "Zürich HB")
            self.assertEqual(places[ice["to"]]["tz"], "Europe/Brussels")
            for s in ice["segments"]:
                self.assertIn(s["from"], places)
                with open(os.path.join(d, s["path"])) as f:
                    gj = json.load(f)
                self.assertEqual(gj["geometry"]["type"], "LineString")
                self.assertGreater(len(gj["geometry"]["coordinates"]), 2)

    def test_pareto_drops_slower(self):
        a = {"dep": "2026-12-03T08:00", "arr": "2026-12-03T16:00", "transfers": 1}
        b = {"dep": "2026-12-03T08:30", "arr": "2026-12-03T15:30", "transfers": 1}
        c = {"dep": "2026-12-03T22:00", "arr": "2026-12-04T09:00", "transfers": 0, "overnight": True}
        self.assertEqual(transitous.pareto([a, b, c]), [b, c])


class FlixBus(unittest.TestCase):
    def test_search(self):
        data = json.loads(fixture("flixbus_search_ham_ber.json"))
        frm = {"id": "40d91e53-8646-11e6-9066-549f350fcb0c", "name": "Hamburg", "coord": [10.0, 53.55]}
        to = {"id": "40d8f682-8646-11e6-9066-549f350fcb0c", "name": "Berlin", "coord": [13.4, 52.52]}
        with mock.patch.object(transitous, "geocode", side_effect=RuntimeError("offline")):
            places, js = flixbus.to_journeys(data, frm, to, tz="Europe/Berlin")
        self.assertTrue(js)
        j = js[0]
        self.assertEqual(j["dep"], "2027-05-19T04:10")
        self.assertEqual(j["mode"], "bus")
        self.assertEqual(j["offers"][0]["price"], 26.97)
        self.assertEqual(j["offers"][0]["source"], "flixbus.com search API")
        kept = flixbus.one_per_ride(js)
        self.assertLessEqual(len(kept), len(js))
        self.assertEqual(len({k["dep"] for k in kept}), len(kept))


    def test_station_match_by_id(self):
        hits = [{"id": "other", "name": "Hamburg Airport", "location": {"lat": 53.63, "lon": 10.0}},
                {"id": "zob", "name": "Hamburg ZOB", "location": {"lat": 53.552081, "lon": 10.012347}}]
        with mock.patch.object(flixbus, "stations", return_value=hits):
            self.assertEqual(flixbus._station_coord("zob", "Hamburg ZOB", "Hamburg")[0], [10.01235, 53.55208])
        with mock.patch.object(flixbus, "stations", return_value=hits[:1]), \
                mock.patch.object(flixbus, "cities", return_value=[{"coord": [10.0, 53.55]}]):
            self.assertEqual(flixbus._station_coord("zob", "Hamburg ZOB", "Hamburg")[0], [10.0, 53.55])


class Geometry(unittest.TestCase):
    def test_road(self):
        with mock.patch.object(geometry, "http_json", fake_http({"route/v1": "osrm_moutiers_valthorens.json"})):
            r = geometry.road([[6.5294, 45.4868], [6.58227, 45.29791]])[0]
        self.assertGreater(r["km"], 30)
        self.assertGreater(len(r["coords"]), 50)

    def test_ferry(self):
        raw = json.loads(fixture("overpass_ferry_osl_cph.json"))
        with mock.patch.object(geometry, "overpass", return_value=raw):
            r = geometry.ferry([10.7443, 59.9036], [12.5996, 55.6993])
        self.assertIn("949772", r["source"])
        self.assertLess(common.haversine_km(r["coords"][0], [10.7443, 59.9036]), 15)
        self.assertGreater(r["km"], 400)

    def test_stitch(self):
        line = geometry.stitch([[[0, 0], [1, 0]], [[2, 0], [1, 0]], [[2, 0], [3, 0]]])
        self.assertEqual(line, [[0, 0], [1, 0], [2, 0], [3, 0]])


class Climate(unittest.TestCase):
    def test_mean(self):
        routes = {"archive-api": "openmeteo_archive_hrg.json", "marine-api": "openmeteo_marine_hrg.json"}
        with mock.patch.object(climate, "http_json", fake_http(routes)):
            r = climate.climate([33.8116, 27.2579], "01-10", "01-16", [2025])
        self.assertEqual(r["years"], "2025-2025")
        self.assertTrue(15 < r["day_max_c"] < 30)
        self.assertIsNotNone(r["sea_c"])
        self.assertEqual(r["of_days"], 7)


class Ratings(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.patch = mock.patch.object(ratings, "LOCAL", os.path.join(self.tmp, "ratings.json"))
        self.patch.start()

    def tearDown(self):
        self.patch.stop()

    def test_find(self):
        self.assertEqual(ratings.find("Book with Bravofly")[1]["name"], "Bravofly")
        self.assertEqual(ratings.find("U2")[1]["name"], "easyJet")
        self.assertEqual(ratings.find("www.kiwi.com")[1]["kind"], "agency")
        self.assertEqual(ratings.find("Nobody Air"), (None, None))

    def test_parse(self):
        self.assertEqual(ratings.parse('{"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.3","reviewCount":"1200"}}'),
                         (4.3, 1200))
        # The star image says "TrustScore 3.5 out of 5" (rounded); the number next to "Average" is the score.
        self.assertEqual(ratings.parse("Bravofly Reviews 26,987 • Average\n3.3\nTrustScore 3.5 out of 5"), (3.3, 26987))
        self.assertEqual(ratings.parse("TrustScore 4.1 | 157,504 reviews"), (4.1, 157504))

    def test_set_and_annotate(self):
        ratings.store("www.tripado.com", name="Tripado", kind="agency", stars=3.0, reviews=500)
        trip = {"journeys": [{"offers": [{"seller": "Tripado"}, {"seller": "Opodo"}, {"seller": "Unknown"}]}]}
        p = os.path.join(self.tmp, "trip.json")
        with open(p, "w") as f:
            json.dump(trip, f)
        r = ratings.annotate(p)
        self.assertEqual((r["rated"], r["unrated"]), (2, 1))
        with open(p) as f:
            offers = json.load(f)["journeys"][0]["offers"]
        self.assertEqual(offers[0]["stars"], 3.0)
        self.assertEqual(offers[1]["rating_source"], "trustpilot")


MODES = {"plane", "train", "bus", "ferry", "car", "taxi", "walk", "mixed"}


def check_scenario(path):
    """Problems with one scenario data.json against the trip.json v2 contract the scrape writes to."""
    base = os.path.dirname(path)
    with open(path, encoding="utf-8") as f:
        t = json.load(f)
    errs = []
    for k in ("id", "title", "currency", "passengers", "clock", "window", "places", "journeys"):
        if k not in t:
            errs.append(f"missing {k}")
    places = t.get("places", {})
    for c, p in places.items():
        if not (isinstance(p.get("coord"), list) and len(p["coord"]) == 2 and -180 <= p["coord"][0] <= 180
                and -90 <= p["coord"][1] <= 90):
            errs.append(f"place {c}: bad coord")
        if not p.get("tz"):
            errs.append(f"place {c}: no tz")
    ids = set()
    for j in t.get("journeys", []):
        jid = j.get("id")
        if jid in ids:
            errs.append(f"{jid}: duplicate id")
        ids.add(jid)
        if j.get("mode") not in MODES:
            errs.append(f"{jid}: mode {j.get('mode')}")
        for k in ("from", "to"):
            if j.get(k) not in places:
                errs.append(f"{jid}: {k} {j.get(k)} not in places")
        try:
            if dt.datetime.fromisoformat(j["arr"]) < dt.datetime.fromisoformat(j["dep"]) - dt.timedelta(hours=14):
                errs.append(f"{jid}: arrives long before it leaves")
        except (KeyError, ValueError):
            errs.append(f"{jid}: bad dep/arr")
        segs = j.get("segments") or []
        if j.get("mode") not in ("plane",) and not segs and not j.get("path"):
            errs.append(f"{jid}: non-plane journey without segments or path")
        for i, s in enumerate(segs):
            for k in ("from", "to"):
                if s.get(k) not in places:
                    errs.append(f"{jid}.{i}: {k} {s.get(k)} not in places")
            if s.get("mode") not in ("plane", "walk"):
                p = s.get("path")
                if not p:
                    errs.append(f"{jid}.{i}: {s.get('mode')} segment without path")
                elif isinstance(p, str) and not os.path.exists(os.path.join(base, p)):
                    errs.append(f"{jid}.{i}: path file {p} missing")
                elif s.get("from") in places and s.get("to") in places:
                    if isinstance(p, str):
                        with open(os.path.join(base, p), encoding="utf-8") as f:
                            line = json.load(f)["geometry"]["coordinates"]
                    else:
                        line = p
                    for end, k in ((line[0], "from"), (line[-1], "to")):
                        km = common.haversine_km(end, places[s[k]]["coord"])
                        if km > 15:
                            errs.append(f"{jid}.{i}: line ends {km:.0f} km from {k} {s[k]}")
        if not j.get("offers") and not j.get("warning"):
            errs.append(f"{jid}: no offer and no warning that says why")
        for o in j.get("offers", []):
            for k in ("seller", "kind", "price", "source", "seen"):
                if o.get(k) in (None, ""):
                    errs.append(f"{jid}: offer without {k}")
            if o.get("kind") not in ("operator", "agency", "self"):
                errs.append(f"{jid}: offer kind {o.get('kind')}")
    for d in t.get("deals", []):
        for jid in d.get("journeys", []):
            if jid not in ids:
                errs.append(f"deal names unknown journey {jid}")
        for k in ("price", "seller", "source", "seen"):
            if d.get(k) in (None, ""):
                errs.append(f"deal without {k}")
    n = len(t.get("journeys", []))
    if not 6 <= n <= 40:
        errs.append(f"{n} journeys; expected 6 to 40")
    return errs


def _part(prefix, frm, to, dep, arr, coord_from, coord_to, offers=None, mode="train"):
    return {"places": {frm: {"name": frm, "kind": "station", "coord": coord_from, "tz": "Europe/Zurich"},
                       to: {"name": to, "kind": "station", "coord": coord_to, "tz": "Europe/Zurich"}},
            "journeys": [{"id": f"{prefix}1", "mode": mode, "from": frm, "to": to, "dep": dep, "arr": arr,
                          "carrier": "X", "numbers": "X 1",
                          "segments": [{"mode": mode, "from": frm, "to": to, "dep": dep, "arr": arr,
                                        "carrier": "X", "number": "X 1", "path": [coord_from, coord_to]}],
                          "offers": offers or []}]}


class Joining(unittest.TestCase):
    def test_merge_groups_warnings_and_place_clash(self):
        a = _part("t", "ZRH", "BSL", "2026-12-03T10:00", "2026-12-03T11:00", [8.54, 47.38], [7.59, 47.55])
        b = _part("u", "BSL", "AMS", "2026-12-03T13:00", "2026-12-03T14:30", [7.53, 47.60], [4.76, 52.31],
                  offers=[{"seller": "KLM", "kind": "operator", "price": 100, "source": "x", "seen": "2026-11-04"}],
                  mode="plane")
        trip, notes = merge.merge({"id": "x", "places": {}}, [(a, "out", None), (b, "out", ["u1"])], "blocked")
        self.assertEqual([j["id"] for j in trip["journeys"]], ["t1", "u1"])
        self.assertEqual(trip["journeys"][0]["warning"]["short"], "No price")
        self.assertNotIn("warning", trip["journeys"][1])
        self.assertIn("BSL-2", trip["places"])           # 7 km apart: kept apart
        self.assertEqual(trip["journeys"][1]["from"], "BSL-2")
        self.assertTrue(notes)
        with self.assertRaises(SystemExit):
            merge.merge({"places": {}}, [(a, None, ["nope"])])

    def test_chain_adds_transfer_and_checks_connection(self):
        a = _part("t", "ZRH", "BSL", "2026-12-03T10:00", "2026-12-03T11:00", [8.54, 47.38], [7.53, 47.60])
        b = _part("u", "BSL", "AMS", "2026-12-03T13:00", "2026-12-03T14:30", [7.53, 47.60], [4.76, 52.31],
                  offers=[{"seller": "KLM", "kind": "operator", "price": 100, "source": "x", "seen": "2026-11-04"}],
                  mode="plane")
        part = chain.chain([(a, a["journeys"][0]), (b, b["journeys"][0])], "b1", 90)
        j = part["journeys"][0]
        self.assertEqual((j["mode"], j["dep"], j["arr"], j["transfers"]), ("mixed", "2026-12-03T10:00", "2026-12-03T14:30", 1))
        self.assertEqual(j["offers"][0]["price"], 100)
        self.assertIn("does not include", j["warning"]["text"])
        with self.assertRaises(SystemExit):
            chain.chain([(a, a["journeys"][0]), (b, b["journeys"][0])], "b1", 180)

    def test_proxy_shift(self):
        js = [{"dep": "2026-12-11T08:34", "arr": "2026-12-11T10:22",
               "segments": [{"dep": "2026-12-11T08:34", "arr": "2026-12-11T10:22"}]}]
        transitous.shift(js, "2026-12-11", "2027-05-21")
        self.assertEqual(js[0]["dep"], "2027-05-21T08:34")
        self.assertEqual(js[0]["segments"][0]["arr"], "2027-05-21T10:22")
        self.assertIn("proxy date 2026-12-11", js[0]["schedule_source"])
        self.assertEqual(js[0]["warning"]["short"], "Times not final")

    def test_fx(self):
        with mock.patch.object(common, "http_json", lambda url, **kw: {"date": "2026-11-03", "rates": {"EUR": 0.096913}}):
            r = common.fx(823, "NOK", "EUR")
        self.assertEqual(r["price"], 79.76)
        self.assertEqual(r["original"], {"price": 823, "currency": "NOK"})

    def test_mlh_is_bsl(self):
        self.assertEqual(gflights.ALIAS["MLH"], "BSL")


class Scenarios(unittest.TestCase):
    def test_each_scenario_matches_the_contract(self):
        files = sorted(glob.glob(os.path.join(SCENARIOS, "*", "data.json")))
        self.assertTrue(files, "no scenarios")
        for f in files:
            with self.subTest(scenario=os.path.basename(os.path.dirname(f))):
                self.assertEqual(check_scenario(f), [])
                self.assertTrue(os.path.exists(os.path.join(os.path.dirname(f), "notes.md")))


if __name__ == "__main__":
    unittest.main(verbosity=1)
