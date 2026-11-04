#!/usr/bin/env python3
"""Capture a built trip page for judging: screenshots, the probe and the console, at desktop and phone size.

    python3 evals/capture.py <trip-folder> <out-folder> [--port 4600] [--keep]

It serves the folder with the skill's serve.py, drives an isolated browser with chrome-devtools-axi
(session "eval-capture"), and writes desktop.png, phone.png, probe-desktop.json, probe-phone.json,
console.txt and check.txt into the out folder. With --keep the server stays up and its URL is in
url.txt; stop it with the pid in server.pid.
"""
import argparse
import threading
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
    a = ap.parse_args()
    trip, out, port, keep = os.path.abspath(a.trip), os.path.abspath(a.out), a.port, a.keep
    os.makedirs(out, exist_ok=True)

    check = subprocess.run([sys.executable, os.path.join(SKILL, "scripts", "check_trip.py"), trip], capture_output=True, text=True)
    open(os.path.join(out, "check.txt"), "w").write(check.stdout)

    srv = subprocess.Popen([sys.executable, os.path.join(SKILL, "scripts", "serve.py"), trip, "--port", str(port)],
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    url = None
    for line in srv.stdout:
        m = re.search(r"(http://\S+/)", line)
        if m:
            url = m.group(1)
            break
    # Keep reading the server's log, so a full pipe never blocks it.
    threading.Thread(target=lambda: [None for _ in srv.stdout], daemon=True).start()
    if not url:
        print("serve.py did not start")
        srv.kill()
        return 1
    try:
        shots, cons = {}, ""
        for name, vp in (("desktop", "1440x900x1"), ("phone", "390x844x2,mobile,touch")):
            axi("open", "about:blank")
            axi("emulate", "--viewport", vp)
            for attempt in range(2):
                axi("open", url)
                time.sleep(8)
                shots[name] = result(axi("eval", PROBE))
                if "window.__chart is missing" not in json.dumps(shots[name]):
                    break
            axi("screenshot", os.path.join(out, f"{name}.png"))
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
    return 0


if __name__ == "__main__":
    sys.exit(main())
