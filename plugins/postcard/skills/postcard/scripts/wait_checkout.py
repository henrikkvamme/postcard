#!/usr/bin/env python3
"""Wait for the next checkout request, claim it, print it and exit.

    python3 wait_checkout.py [timeout-seconds]

Run it as a background command. When it exits, the agent harness wakes the agent, which then works
the printed request. The printed job has "wake": "book" (a new booking) or "after-booking" (the user
paid). Exit codes: 0 = a request was claimed, 3 = timed out.

Environment: POSTCARD_QUEUE sets the queue folder (default ~/.local/state/postcard/checkout).
"""
import glob
import json
import os
import sys
import time

QUEUE = os.environ.get("POSTCARD_QUEUE") or os.path.expanduser("~/.local/state/postcard/checkout")
timeout = float(sys.argv[1]) if len(sys.argv) > 1 else 7000
end = time.time() + timeout

while time.time() < end:
    for p in sorted(glob.glob(os.path.join(QUEUE, "*.json"))):
        try:
            with open(p) as f:
                job = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        # pending = a new booking request; booked = the user paid and wants the after-booking work.
        st = job.get("status")
        if st not in ("pending", "booked"):
            continue
        job["wake"] = "book" if st == "pending" else "after-booking"
        job["status"] = "claimed" if st == "pending" else "working"
        job["log"].append({"at": time.time(), "status": job["status"],
                           "note": "Your agent picked up the request." if st == "pending" else "Your agent is doing the after-booking work."})
        tmp = p + ".tmp"
        with open(tmp, "w") as f:
            json.dump(job, f, indent=2)
        os.replace(tmp, p)
        print(json.dumps(job, indent=2))
        sys.exit(0)
    time.sleep(2)
print("no checkout request before the timeout")
sys.exit(3)
