#!/usr/bin/env python3
"""Almanca Kelime Kartlari - HTTP Server"""
import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

PORT = int(os.environ.get("PORT", 8000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/words":
            self._serve_json("all_wortliste.json")
        elif path == "/api/stats":
            self._serve_json("stats.json", default={})
        elif path == "/api/wrong-words":
            self._serve_json("wrong_words.json", default={})
        elif path == "/api/profiles":
            self._serve_json("profiles.json", default={})
        elif path == "/api/deleted-words":
            self._serve_json("deleted_words.json", default=[])
        else:
            super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        filemap = {
            "/api/stats": "stats.json",
            "/api/wrong-words": "wrong_words.json",
            "/api/profiles": "profiles.json",
            "/api/deleted-words": "deleted_words.json",
        }
        if path in filemap:
            try:
                length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(length))
                filepath = os.path.join(BASE_DIR, filemap[path])
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                self._json_response(200, {"ok": True})
            except Exception as e:
                self._json_response(500, {"error": str(e)})
        else:
            self.send_error(404)

    def _serve_json(self, filename, default=None):
        filepath = os.path.join(BASE_DIR, filename)
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
        elif default is not None:
            content = json.dumps(default)
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(content.encode("utf-8"))

    def _json_response(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def log_message(self, fmt, *args):
        pass


def main():
    os.chdir(BASE_DIR)
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Server baslatildi! -> http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer durduruldu.")
        server.server_close()


if __name__ == "__main__":
    main()
