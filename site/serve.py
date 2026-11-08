#!/usr/bin/env python3
"""Serve the postcard site for development, laid out as the deployed image lays it out.

    python3 site/serve.py [--port 4390] [--host 0.0.0.0]

/            site/
/kit/...     the skill's kit (not copied into site/)
/skill/...   the skill's SKILL.md, references/ and scripts/, to read
/postcard-skill.tar.gz   the whole skill folder, built on each request
/api/...     204 for /api/checkout/latest, else 404, as on the static host
"""
import argparse
import io
import os
import tarfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

SITE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.join(os.path.dirname(SITE), "plugins", "postcard", "skills", "postcard")
SKIP = {"__pycache__", ".DS_Store"}


def skill_tar():
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(SKILL, arcname="postcard", filter=lambda t: None if os.path.basename(t.name) in SKIP else t)
    return buf.getvalue()


class Server(ThreadingHTTPServer):
    request_queue_size = 128  # a page loads dozens of modules and models at once
    daemon_threads = True


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".mjs": "text/javascript",
                      ".glb": "model/gltf-binary", ".geojson": "application/geo+json", ".md": "text/markdown; charset=utf-8",
                      ".txt": "text/plain; charset=utf-8", ".py": "text/plain; charset=utf-8"}

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        if p.startswith("/kit/"):
            return super().translate_path(p[len("/kit"):]).replace(SITE, os.path.join(SKILL, "kit"), 1)
        if p.startswith("/skill/"):
            rest = p[len("/skill"):]
            if not (rest == "/SKILL.md" or rest.startswith("/references/") or rest.startswith("/scripts/")):
                return os.path.join(SITE, "__missing__")
            return super().translate_path(rest).replace(SITE, SKILL, 1)
        return super().translate_path(p)

    def do_GET(self):
        p = self.path.split("?", 1)[0]
        if p == "/api/checkout/latest":  # "no booking": kit pages ask for a local checkout server every 5 s
            self.send_response(204)
            return self.end_headers()
        if p.startswith("/api/"):
            return self.send_error(404)
        if p == "/postcard-skill.tar.gz":
            body = skill_tar()
            self.send_response(200)
            self.send_header("Content-Type", "application/gzip")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return self.wfile.write(body)
        if p == "/view":
            self.path = "/view/" + self.path[len("/view"):]
        return super().do_GET()

    do_POST = lambda self: self.send_error(404)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=4390)
    ap.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args()
    os.chdir(SITE)
    srv = Server((a.host, a.port), Handler)
    print(f"http://{a.host}:{a.port}/", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
