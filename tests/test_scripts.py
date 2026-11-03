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


class CheckTrip(unittest.TestCase):
    def test_example_and_fixture_pass(self):
        for p in (EXAMPLE, MINIMAL):
            r = check(p)
            self.assertEqual(r.returncode, 0, r.stdout)

    def test_errors_are_found(self):
        t = json.load(open(os.path.join(MINIMAL, "trip.json")))
        t["flights"][0]["arr"] = "2027-03-04T08:00"           # lands before take-off
        t["flights"][1]["via"] = ["XXX"]                      # unknown stop
        t["offers"]["nope"] = []                              # offer for no flight
        t["places"]["AMS"]["tz"] = "Mars/Olympus"             # bad zone
        with tempfile.TemporaryDirectory() as d:
            json.dump(t, open(os.path.join(d, "trip.json"), "w"))
            r = check(d)
        self.assertEqual(r.returncode, 1)
        for want in ("arrives before it departs", "'XXX' is not in places", "offers.nope", "Mars/Olympus"):
            self.assertIn(want, r.stdout)


class Serve(unittest.TestCase):
    def setUp(self):
        self.queue = tempfile.mkdtemp()
        self.trip = tempfile.mkdtemp()
        shutil.copy(os.path.join(MINIMAL, "trip.json"), self.trip)
        os.makedirs(os.path.join(self.trip, "art"))
        open(os.path.join(self.trip, "art", "mine.png"), "wb").write(b"PNG")
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
        self.assertEqual(self.get("/art/helsinki.png")[0], 200)           # from the viewer
        self.assertEqual(self.get("/../scripts/serve.py")[0], 404)

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


if __name__ == "__main__":
    unittest.main(verbosity=2)
