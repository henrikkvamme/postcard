#!/usr/bin/env python3
"""Serve a trip page, the postcard kit and a small checkout queue.

    python3 serve.py <trip-folder> [--port 4471] [--host 0.0.0.0]

The trip folder holds trip.json and the page (index.html, app.js) that the agent wrote for this trip.
A request for /kit/... comes from the kit in this skill, unless the trip folder has its own file at
that path. When the port is busy, the server takes the next free one and prints its address.

Checkout: the page POSTs a booking request to /api/checkout. The request is saved as one JSON file in
the queue folder. An agent waits on the queue with wait_checkout.py, works the request in the user's
browser, and reports progress with POST /api/checkout/<id>/status. The page polls
GET /api/checkout/<id> and shows that progress. The agent always stops at the payment page.

Only localhost and Tailscale addresses (100.64.0.0/10) may use the API, because a request starts an
agent in the user's browser. Only localhost may report progress.

Environment: POSTCARD_QUEUE sets the queue folder (default ~/.local/state/postcard/checkout).
"""
import argparse
import errno
import ipaddress
import json
import os
import re
import socket
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Server(ThreadingHTTPServer):
    # A page loads a dozen modules and drawings at once; the default backlog of 5 resets some of them.
    request_queue_size = 128
    daemon_threads = True

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(SKILL, "kit")
QUEUE = os.environ.get("POSTCARD_QUEUE") or os.path.expanduser("~/.local/state/postcard/checkout")
TAILNET = ipaddress.ip_network("100.64.0.0/10")
STATUSES = {"pending", "claimed", "working", "at-payment", "booked", "done", "failed"}
MAX_BODY = 64 * 1024
TRIP_DIR = None


def path_of(rid):
    return os.path.join(QUEUE, rid + ".json")


def read(rid):
    with open(path_of(rid)) as f:
        return json.load(f)


def write(job):
    # Write to a temporary file, then rename, so a reader never sees half a file.
    tmp = path_of(job["id"]) + ".tmp"
    with open(tmp, "w") as f:
        json.dump(job, f, indent=2)
    os.replace(tmp, path_of(job["id"]))


def public(job):
    return {k: job[k] for k in ("id", "status", "log")}


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # The trip folder wins; /kit/... and the icon fall back to the kit in this skill.
        rel = super().translate_path(path)[len(os.getcwd()):].lstrip(os.sep)
        roots = [(TRIP_DIR, rel)]
        if rel.startswith("kit" + os.sep):
            roots.append((KIT, rel[4:]))
        if rel == "favicon.ico":
            roots.append((KIT, "favicon.svg"))
        for root, r in roots:
            base = os.path.realpath(root)
            full = os.path.realpath(os.path.join(base, r))
            # Serve only what lies inside the root after links are resolved.
            if os.path.commonpath([base, full]) != base:
                continue
            if os.path.isdir(full):
                full = os.path.realpath(os.path.join(full, "index.html"))
                if os.path.commonpath([base, full]) != base:
                    continue
            if os.path.isfile(full):
                return full
        return os.path.join(os.path.realpath(TRIP_DIR), "__postcard_missing__")

    def guess_type(self, path):
        if path.endswith(".js") or path.endswith(".mjs"):
            return "text/javascript"
        if path.endswith(".svg"):
            return "image/svg+xml"
        return super().guess_type(path)

    def allowed(self):
        ip = ipaddress.ip_address(self.client_address[0])
        return ip.is_loopback or ip in TAILNET

    def local(self):
        return ipaddress.ip_address(self.client_address[0]).is_loopback

    def send_json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("cache-control", "no-store")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("content-length") or 0)
        if n <= 0 or n > MAX_BODY:
            raise ValueError("body size")
        return json.loads(self.rfile.read(n))

    def do_GET(self):
        if self.path.startswith("/api/"):
            if not self.allowed():
                return self.send_json(403, {"error": "forbidden"})
            if self.path == "/api/checkout/latest":
                # The newest booking, so a page opened later still finds the one that waits on the user.
                files = sorted(f for f in os.listdir(QUEUE) if f.endswith(".json"))
                if not files:
                    # No booking yet is a normal state, not an error.
                    self.send_response(204)
                    self.send_header("cache-control", "no-store")
                    self.end_headers()
                    return
                return self.send_json(200, public(read(files[-1][:-5])))
            m = re.fullmatch(r"/api/checkout/([0-9a-z-]+)", self.path)
            if m:
                try:
                    return self.send_json(200, public(read(m.group(1))))
                except FileNotFoundError:
                    return self.send_json(404, {"error": "not found"})
            return self.send_json(404, {"error": "not found"})
        return super().do_GET()

    def do_POST(self):
        if not self.allowed():
            return self.send_json(403, {"error": "forbidden"})
        try:
            data = self.body()
        except (ValueError, json.JSONDecodeError):
            return self.send_json(400, {"error": "bad request"})
        if self.path == "/api/checkout":
            if not isinstance(data, dict) or not isinstance(data.get("prompt"), str) or not isinstance(data.get("trip"), dict):
                return self.send_json(400, {"error": "need prompt and trip"})
            rid = time.strftime("%Y%m%d-%H%M%S") + "-" + os.urandom(3).hex()
            write({"id": rid, "at": time.time(), "from": self.client_address[0], "status": "pending",
                   "log": [{"at": time.time(), "status": "pending", "note": "Waiting for your agent to pick this up."}],
                   "trip_file": os.path.join(TRIP_DIR, "trip.json"), "trip": data["trip"], "prompt": data["prompt"]})
            return self.send_json(200, {"id": rid})
        m = re.fullmatch(r"/api/checkout/([0-9a-z-]+)/booked", self.path)
        if m:
            # The user says they paid. This wakes the agent for the after-booking work.
            try:
                job = read(m.group(1))
            except FileNotFoundError:
                return self.send_json(404, {"error": "not found"})
            if job["status"] not in ("at-payment", "working", "failed"):
                return self.send_json(409, {"error": "not at the payment page", "status": job["status"]})
            job["status"] = "booked"
            job["log"].append({"at": time.time(), "status": "booked",
                               "note": "You paid. Waiting for your agent to add the calendar, check the tickets and set check-in reminders."})
            write(job)
            return self.send_json(200, {"ok": True})
        m = re.fullmatch(r"/api/checkout/([0-9a-z-]+)/status", self.path)
        if m:
            # Only the agent on this machine reports progress.
            if not self.local():
                return self.send_json(403, {"error": "forbidden"})
            status, note = data.get("status"), str(data.get("note", ""))[:500]
            if status not in STATUSES:
                return self.send_json(400, {"error": "unknown status"})
            try:
                job = read(m.group(1))
            except FileNotFoundError:
                return self.send_json(404, {"error": "not found"})
            job["status"] = status
            job["log"].append({"at": time.time(), "status": status, "note": note})
            write(job)
            return self.send_json(200, {"ok": True})
        return self.send_json(404, {"error": "not found"})

    def end_headers(self):
        # The agent edits trip.json often; make the browser check for a new version every time.
        if not self.path.startswith("/api/"):
            self.send_header("cache-control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.client_address[0], fmt % args))


def main():
    global TRIP_DIR
    ap = argparse.ArgumentParser(description="Serve a trip in the postcard viewer.")
    ap.add_argument("trip", help="folder that holds trip.json")
    ap.add_argument("--port", type=int, default=4471)
    ap.add_argument("--host", default="0.0.0.0", help="0.0.0.0 lets other machines on your tailnet open it")
    a = ap.parse_args()
    TRIP_DIR = os.path.abspath(a.trip)
    if not os.path.isfile(os.path.join(TRIP_DIR, "trip.json")):
        sys.exit(f"no trip.json in {TRIP_DIR}")
    if not os.path.isfile(os.path.join(TRIP_DIR, "index.html")):
        print(f"postcard: warning: no index.html in {TRIP_DIR}. Copy a page from examples/ first.", file=sys.stderr)
    os.makedirs(QUEUE, exist_ok=True)
    server = None
    for port in range(a.port, a.port + 20):
        try:
            server = Server((a.host, port), Handler)
            break
        except OSError as e:
            if e.errno not in (errno.EADDRINUSE, errno.EACCES):
                raise
            print(f"postcard: port {port} is busy, trying {port + 1}", file=sys.stderr)
    if server is None:
        sys.exit(f"postcard: ports {a.port}-{a.port + 19} are all busy")
    host = socket.gethostname().split(".")[0] if a.host in ("0.0.0.0", "::") else a.host
    print(f"postcard: http://{host}:{server.server_address[1]}/  trip {TRIP_DIR}  queue {QUEUE}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
