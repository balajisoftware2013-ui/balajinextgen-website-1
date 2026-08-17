#!/usr/bin/env python3
"""
Tally Relay -- run this on the SAME PC as Tally Prime.

Why this exists:
  The HR dashboard runs in a browser. Browsers will not let JavaScript
  read the response from a plain request to Tally's HTTP/XML gateway
  (that request has to use no-cors mode, which hides the reply). So the
  dashboard used to just say "sent" without knowing if Tally actually
  accepted the entry.

  This script fixes that. It listens on port 9001 (which the browser CAN
  talk to normally), forwards whatever XML it receives to Tally on port
  9000 as a normal server-to-server request (no browser CORS limits
  apply there), reads Tally's real reply, and sends a clean summary
  back to the dashboard.

HOW TO USE:
  1. Make sure Tally Prime is open, the company is loaded, and its
     HTTP/XML gateway is enabled:
       Gateway of Tally -> F1: Help -> Settings -> Connectivity
       (or confirm tally.ini has Port=9000)
  2. Run this file:  python tally_relay.py
  3. Leave this window open while you use the "Direct Post to Tally"
     buttons on the dashboard.
  4. Stop it any time with Ctrl+C.

Requires only the Python standard library -- nothing to install.
"""

import http.server
import socketserver
import urllib.request
import re
import json
import sys

RELAY_PORT = 9001
TALLY_HOST = "localhost"
TALLY_PORT = 9000


def parse_tally_response(xml_text):
    """Turn Tally's raw XML reply into a simple ok/created/errors summary."""
    created = re.search(r"<CREATED>(\d+)</CREATED>", xml_text)
    altered = re.search(r"<ALTERED>(\d+)</ALTERED>", xml_text)
    errors = re.search(r"<ERRORS>(\d+)</ERRORS>", xml_text)
    exceptions = re.search(r"<EXCEPTIONS>(\d+)</EXCEPTIONS>", xml_text)
    line_errors = re.findall(r"<LINEERROR>(.*?)</LINEERROR>", xml_text, re.S)

    created_n = int(created.group(1)) if created else 0
    altered_n = int(altered.group(1)) if altered else 0
    errors_n = int(errors.group(1)) if errors else 0
    exceptions_n = int(exceptions.group(1)) if exceptions else 0

    ok = errors_n == 0 and exceptions_n == 0 and not line_errors

    return {
        "ok": ok,
        "created": created_n,
        "altered": altered_n,
        "errors": errors_n,
        "exceptions": exceptions_n,
        "lineErrors": [e.strip() for e in line_errors],
    }


class RelayHandler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            req = urllib.request.Request(
                "http://%s:%s" % (TALLY_HOST, TALLY_PORT),
                data=body,
                headers={"Content-Type": "text/xml"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
            summary = parse_tally_response(raw)
            status = 200
        except Exception as e:
            summary = {
                "ok": False,
                "created": 0, "altered": 0, "errors": 0, "exceptions": 0,
                "lineErrors": ["Could not reach Tally on port %s: %s" % (TALLY_PORT, e)],
            }
            status = 502

        payload = json.dumps(summary).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        print("[relay]", fmt % args)


def main():
    with socketserver.TCPServer(("127.0.0.1", RELAY_PORT), RelayHandler) as httpd:
        print("Tally Relay running -> http://localhost:%s" % RELAY_PORT)
        print("Forwarding to Tally -> http://%s:%s" % (TALLY_HOST, TALLY_PORT))
        print("Leave this window open. Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
            sys.exit(0)


if __name__ == "__main__":
    main()
