"""Static file server for previewing this repo (diagrams/, prototype/, docs/).

Reads the port from the PORT environment variable (falls back to 8743 for
manual runs) instead of a hardcoded CLI flag, so the Claude Code preview
harness can assign a free port via autoPort without colliding with anything
else already bound to a fixed port.
"""
import functools
import http.server
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("PORT", "8743"))

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
