#!/usr/bin/env python3
"""Tests for the postcard scripts. Run: python3 tests/test_scripts.py"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILL = os.path.join(ROOT, "plugins", "postcard", "skills", "postcard")
CHECK = os.path.join(SKILL, "scripts", "check_trip.py")
SERVE = os.path.join(SKILL, "scripts", "serve.py")
WAIT = os.path.join(SKILL, "scripts", "wait_checkout.py")
EXAMPLE = os.path.join(SKILL, "examples", "junction-2026")
MINIMAL = os.path.join(ROOT, "tests", "fixtures", "minimal")


def check(path):
    return subprocess.run([sys.executable, CHECK, path], capture_output=True, text=True)


EXAMPLES = [os.path.join(SKILL, "examples", d) for d in sorted(os.listdir(os.path.join(SKILL, "examples")))]


class CheckTrip(unittest.TestCase):
    def test_examples_and_fixture_pass(self):
        for p in EXAMPLES + [MINIMAL]:
            r = check(p)
            self.assertEqual(r.returncode, 0, p + "\n" + r.stdout)

    def test_examples_have_a_page(self):
        for p in EXAMPLES:
            for f in ("trip.json", "index.html", "app.js"):
                self.assertTrue(os.path.isfile(os.path.join(p, f)), f"{p} has no {f}")

    def run_broken(self, change, today="2027-03-02"):
        t = json.load(open(os.path.join(MINIMAL, "trip.json")))
        change(t)
        with tempfile.TemporaryDirectory() as d:
            json.dump(t, open(os.path.join(d, "trip.json"), "w"))
            return subprocess.run([sys.executable, CHECK, d, "--today", today], capture_output=True, text=True)

    def test_errors_are_found(self):
        def change(t):
            j = {x["id"]: x for x in t["journeys"]}
            j["o1"]["arr"] = "2027-03-04T08:00"                       # lands before take-off
            j["o2"]["segments"][1]["from"] = "XXX"                    # unknown stop
            j["r2"]["segments"][1]["to"] = "AMS"                      # chain ends at the wrong place
            j["t1"]["segments"][0]["path"] = "rail/missing.geojson"   # path file not there
            j["r1"]["offers"][0]["bags"] = {"checked": "maybe"}       # bad bag value
            t["deals"].append({"journeys": ["o1", "o2"], "price": 1, "seller": "x", "kind": "operator"})  # same group twice
            t["places"]["BAD"] = {"name": "Bad", "coord": [0, 0], "tz": "Mars/Olympus"}  # bad zone
        r = self.run_broken(change)
        self.assertEqual(r.returncode, 1)
        for want in ("arrives before it departs", "'XXX' is not a usable place", "ends at AMS", "rail/missing.geojson",
                     "bags.checked", "same group", "Mars/Olympus"):
            self.assertIn(want, r.stdout)

    def test_warnings_are_found(self):
        def change(t):
            j = {x["id"]: x for x in t["journeys"]}
            j["o1"]["offers"][0]["kind"] = "airline"                  # v1 name
            del j["o1"]["offers"][0]["seen"]                          # no date
            j["o1"]["colour"] = "red"                                 # typo field
            del j["t1"]["segments"][0]["path"]                        # ground leg without a line
            j["r1"]["to"] = "AMS"; j["r1"]["arr"] = "2027-03-08T18:20"  # returns somewhere else
        r = self.run_broken(change, today="2027-03-20")
        self.assertEqual(r.returncode, 0, r.stdout)
        for want in ("'airline' is the v1 name", "no seen date", "unknown field 'colour'", "faint straight line",
                     "back returns to", "more than a week ago"):
            self.assertIn(want, r.stdout)

    def test_segment_bounds_and_clock_changes(self):
        def change(t):
            j = {x["id"]: x for x in t["journeys"]}
            j["o2"]["segments"][0]["dep"] = "2027-03-04T07:40"         # starts after the journey starts
            j["r1"]["from"], j["r1"]["to"] = "OSL", "LIS"              # 02:30 does not exist in Oslo on 28 Mar 2027
            j["r1"]["dep"], j["r1"]["arr"] = "2027-03-28T02:30", "2027-03-28T05:20"
        r = self.run_broken(change)
        self.assertEqual(r.returncode, 1)
        self.assertIn("but the journey departs", r.stdout)
        self.assertIn("does not exist in Europe/Oslo", r.stdout)

    def test_v1_is_named(self):
        with tempfile.TemporaryDirectory() as d:
            json.dump({"title": "x", "flights": []}, open(os.path.join(d, "trip.json"), "w"))
            r = check(d)
        self.assertEqual(r.returncode, 1)
        self.assertIn("v1 trip", r.stdout)


class Serve(unittest.TestCase):
    def setUp(self):
        self.queue = tempfile.mkdtemp()
        self.trip = tempfile.mkdtemp()
        shutil.copy(os.path.join(MINIMAL, "trip.json"), self.trip)
        os.makedirs(os.path.join(self.trip, "art"))
        open(os.path.join(self.trip, "art", "mine.png"), "wb").write(b"PNG")
        open(os.path.join(self.trip, "index.html"), "w").write("<!doctype html><title>t</title>")
        s = socket.socket(); s.bind(("127.0.0.1", 0)); self.port = s.getsockname()[1]; s.close()
        env = dict(os.environ, POSTCARD_QUEUE=self.queue)
        self.p = subprocess.Popen([sys.executable, SERVE, self.trip, "--port", str(self.port), "--host", "127.0.0.1"],
                                  env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                urllib.request.urlopen(self.url("/trip.json")); break
            except OSError:
                time.sleep(.1)

    def tearDown(self):
        self.p.terminate(); self.p.wait()
        shutil.rmtree(self.queue); shutil.rmtree(self.trip)

    def url(self, path):
        return f"http://127.0.0.1:{self.port}{path}"

    def get(self, path):
        try:
            r = urllib.request.urlopen(self.url(path)); return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def post(self, path, obj):
        req = urllib.request.Request(self.url(path), data=json.dumps(obj).encode(), headers={"content-type": "application/json"})
        try:
            r = urllib.request.urlopen(req); return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_files_trip_folder_first(self):
        self.assertEqual(self.get("/")[0], 200)
        self.assertIn(b"Oslo", self.get("/trip.json")[1])
        self.assertEqual(self.get("/art/mine.png"), (200, b"PNG"))       # from the trip folder
        self.assertEqual(self.get("/kit/art/helsinki.png")[0], 200)       # from the kit
        self.assertEqual(self.get("/kit/trip.js")[0], 200)
        self.assertEqual(self.get("/favicon.ico")[0], 200)
        self.assertEqual(self.get("/api/checkout/latest")[0], 204)        # no job yet, and no 404 in the console
        self.assertEqual(self.get("/../scripts/serve.py")[0], 404)
        self.assertEqual(self.get("/kit/../scripts/serve.py")[0], 404)

    def test_links_out_of_the_trip_are_refused(self):
        outside = tempfile.mkdtemp()
        sibling = self.trip + "-x"
        os.makedirs(sibling)
        try:
            open(os.path.join(outside, "secret.txt"), "w").write("secret")
            open(os.path.join(sibling, "s.txt"), "w").write("sibling")
            os.symlink(os.path.join(outside, "secret.txt"), os.path.join(self.trip, "link.txt"))
            self.assertEqual(self.get("/link.txt")[0], 404)
            open(os.path.join(outside, "index.html"), "w").write("outside")
            os.makedirs(os.path.join(self.trip, "sub"))
            os.symlink(os.path.join(outside, "index.html"), os.path.join(self.trip, "sub", "index.html"))
            self.assertEqual(self.get("/sub/")[0], 404)                          # a directory index that links out
            os.makedirs(os.path.join(self.trip, "ok"))
            open(os.path.join(self.trip, "ok", "index.html"), "w").write("ok")
            req = urllib.request.Request(self.url("/ok"))
            opener = urllib.request.build_opener(type("NoRedirect", (urllib.request.HTTPRedirectHandler,), {"redirect_request": lambda *a: None}))
            try:
                code = opener.open(req).status
            except urllib.error.HTTPError as e:
                code = e.code
            self.assertEqual(code, 301)                                          # /ok redirects to /ok/
            self.assertEqual(self.get("/ok/"), (200, b"ok"))
            self.assertEqual(self.get("/../" + os.path.basename(sibling) + "/s.txt")[0], 404)
        finally:
            shutil.rmtree(outside); shutil.rmtree(sibling)

    def test_busy_port_moves_on(self):
        p = subprocess.Popen([sys.executable, SERVE, self.trip, "--port", str(self.port), "--host", "127.0.0.1"],
                             env=dict(os.environ, POSTCARD_QUEUE=self.queue), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        try:
            line = next(l for l in p.stdout if "http://" in l)
            port = int(line.split("http://")[1].split("/")[0].rsplit(":", 1)[1])
            self.assertGreater(port, self.port)
        finally:
            p.terminate(); p.wait()

    def test_checkout_round_trip(self):
        code, r = self.post("/api/checkout", {"prompt": "Book it", "trip": {"price": 1}})
        self.assertEqual(code, 200)
        rid = r["id"]
        env = dict(os.environ, POSTCARD_QUEUE=self.queue)
        w = subprocess.run([sys.executable, WAIT, "5"], env=env, capture_output=True, text=True)
        self.assertEqual(w.returncode, 0)
        self.assertEqual(json.loads(w.stdout)["wake"], "book")
        self.assertEqual(self.post(f"/api/checkout/{rid}/booked", {})[0], 409)   # not at the payment page yet
        self.assertEqual(self.post(f"/api/checkout/{rid}/status", {"status": "at-payment", "note": "CHF 1"})[0], 200)
        self.assertEqual(self.post(f"/api/checkout/{rid}/booked", {})[0], 200)
        w = subprocess.run([sys.executable, WAIT, "5"], env=env, capture_output=True, text=True)
        self.assertEqual(json.loads(w.stdout)["wake"], "after-booking")
        self.assertEqual(json.loads(self.get("/api/checkout/latest")[1])["status"], "working")


class Kit(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "node is not installed")
    def test_kit_modules(self):
        r = subprocess.run(["node", "--test", os.path.join(ROOT, "tests", "test_kit.mjs")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout[-2000:] + r.stderr[-2000:])


if __name__ == "__main__":
    unittest.main(verbosity=2)
