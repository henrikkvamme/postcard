#!/usr/bin/env python3
"""Capture a built trip page for judging: screenshots, the probe and the console, at desktop, laptop and phone size.

    python3 evals/capture.py <trip-folder> <out-folder> [--port 4600] [--keep] [--saved]

It serves the folder with the skill's serve.py, drives an isolated browser with chrome-devtools-axi
(session "eval-capture", or CAPTURE_SESSION), and writes <size>.png and probe-<size>.json for desktop
(1440x900), laptop (1280x720) and phone (390x844), console.txt, check.txt and server.log into the
out folder. It clears the page's saved picks first, so it shows the defaults; --saved keeps them.
It stops the browser session when done. With --keep the server and the browser stay up,
the URL is in url.txt, and the server's pid is in server.pid.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILL = os.path.join(ROOT, "plugins", "postcard", "skills", "postcard")
ENV = dict(os.environ, CHROME_DEVTOOLS_AXI_ISOLATED_SESSION=os.environ.get("CAPTURE_SESSION", "eval-capture"))
PROBE = "import('/kit/probe.js?' + Date.now()).then((m) => JSON.stringify(m.probe()))"


def axi(*args, timeout=90):
    r = subprocess.run(["chrome-devtools-axi", *args], env=ENV, capture_output=True, text=True, timeout=timeout)
    return r.stdout + r.stderr


def result(out):
    """The value of an eval: the line 'result: "..."' holds a JSON string of a JSON string."""
    m = re.search(r'^result: (.*)$', out, re.M)
    if not m:
        return {"error": out[-600:]}
    v = json.loads(m.group(1))
    while isinstance(v, str):
        try:
            v = json.loads(v)
        except ValueError:
            break
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("trip"); ap.add_argument("out")
    ap.add_argument("--port", type=int, default=4600); ap.add_argument("--keep", action="store_true")
    ap.add_argument("--saved", action="store_true", help="keep the picks saved in the browser")
    a = ap.parse_args()
    trip, out, port, keep = os.path.abspath(a.trip), os.path.abspath(a.out), a.port, a.keep
    saved = a.saved
    os.makedirs(out, exist_ok=True)

    check = subprocess.run([sys.executable, os.path.join(SKILL, "scripts", "check_trip.py"), trip], capture_output=True, text=True)
    open(os.path.join(out, "check.txt"), "w").write(check.stdout)

    # The server writes to a log file, not a pipe, so it keeps running after this script exits (--keep).
    log = open(os.path.join(out, "server.log"), "w")
    srv = subprocess.Popen([sys.executable, os.path.join(SKILL, "scripts", "serve.py"), trip, "--port", str(port)],
                           stdout=log, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    url = None
    for _ in range(100):
        m = re.search(r"(http://\S+/)", open(os.path.join(out, "server.log")).read())
        if m:
            url = m.group(1)
            break
        if srv.poll() is not None:
            break
        time.sleep(0.1)
    if not url:
        print("serve.py did not start")
        srv.kill()
        return 1
    try:
        shots, cons = {}, ""
        for name, vp in (("desktop", "1440x900x1"), ("laptop", "1280x720x1"), ("phone", "390x844x2,mobile,touch")):
            axi("open", "about:blank")
            axi("emulate", "--viewport", vp)
            # Saved picks from a manual test would change what the capture shows: start from the defaults.
            if not saved:
                axi("open", url)
                axi("eval", "localStorage.clear(), sessionStorage.clear(), 'cleared'")
            for attempt in range(2):
                axi("open", url)
                time.sleep(8)
                shots[name] = result(axi("eval", PROBE))
                if "window.__chart is missing" not in json.dumps(shots[name]):
                    break
            axi("screenshot", os.path.join(out, f"{name}.png"))
            # Other picks and views: a page that sets window.__states = { 'Fly on the day': () => ..., }
            # gets a probe after each one, so a spill on a pick that is not the default is found too.
            names = result(axi("eval", "JSON.stringify(Object.keys(window.__states || {}))"))
            if isinstance(shots[name], dict) and isinstance(names, list) and names:
                states = {}
                for k in names:
                    axi("eval", f"(window.__states[{json.dumps(k)}](), 'set')")
                    # Wait for the map to settle: a pick reframes it, and ends off screen mid-flight are not faults.
                    for _ in range(12):
                        time.sleep(1)
                        if result(axi("eval", "JSON.stringify(!!window.__chart?.map?.isMoving?.())")) is False:
                            break
                    time.sleep(0.5)
                    states[k] = result(axi("eval", PROBE))
                shots[name]["states"] = states
                bad = [k for k, v in states.items() if not (isinstance(v, dict) and v.get("ok"))]
                if bad:
                    shots[name]["ok"] = False
                    shots[name]["statesFailed"] = bad
            cons += f"\n--- {name} ---\n" + axi("console")
        axi("open", "about:blank")
        axi("emulate", "--viewport", "1440x900x1")
        for k, v in shots.items():
            json.dump(v, open(os.path.join(out, f"probe-{k}.json"), "w"), indent=1)
        lines = [l for l in cons.splitlines() if re.search(r"\[(error|warn)\]", l) and not re.search(r"luma|fog|READ-usage|WebGL|GPU stall", l, re.I)]
        open(os.path.join(out, "console.txt"), "w").write("\n".join(lines) + "\n")
        summary = {"url": url, "check": check.stdout.strip().splitlines()[-1] if check.stdout.strip() else "",
                   "console": len(lines), **{f"probe_{k}": v.get("ok") if isinstance(v, dict) else v for k, v in shots.items()}}
        print(json.dumps(summary))
    finally:
        axi("closepage", "1")
        if keep:
            open(os.path.join(out, "url.txt"), "w").write(url + "\n")
            open(os.path.join(out, "server.pid"), "w").write(str(srv.pid) + "\n")
        else:
            srv.terminate()
            srv.wait()
            axi("stop")
    return 0


if __name__ == "__main__":
    sys.exit(main())
