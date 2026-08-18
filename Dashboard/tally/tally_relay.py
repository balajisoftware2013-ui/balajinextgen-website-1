#!/usr/bin/env python3
"""
tally_relay.py — local bridge between the Tally Direct Posting Engine
(browser, https://www.balajinextgen.in/...) and Tally's HTTP/XML server
(http://localhost:9000).

Same job as tally-proxy.js, but this one PARSES Tally's XML reply
server-side and answers the browser with clean JSON:
    {"ok": true/false, "created": [...], "altered": [...],
     "errors": [...], "exceptions": [...], "lineErrors": [...]}
which the app recognises (via the response Content-Type: application/json)
and shows as readable per-line errors instead of raw Tally XML.

WHY A PROXY IS NEEDED AT ALL
  1. Tally's built-in server sends no CORS headers -> browser blocks reading
     the reply even if Tally answers correctly.
  2. Since Chrome 142, a page loaded from a public https:// domain (like
     balajinextgen.in) additionally needs one-time "Local Network Access"
     permission before it may contact ANY localhost/LAN address. This
     script answers that preflight correctly (Access-Control-Allow-
     Private-Network: true) so Chrome's permission prompt can appear and
     the request can go through once you click Allow.

RUN
    python tally_relay.py
  (standard library only — no pip install needed)

Leave this running whenever you use the posting engine. Tally itself must
be open with: Gateway of Tally -> F11 (Features) -> Enable ODBC/XML Server
-> Yes (default port 9000), with the correct company loaded.
"""

import http.server
import http.client
import os
import re
import socketserver
import sys
import xml.etree.ElementTree as ET
import json

LISTEN_PORT = int(os.environ.get('TALLY_PROXY_PORT', 9001))
TALLY_HOST = os.environ.get('TALLY_HOST', '127.0.0.1')
TALLY_PORT = int(os.environ.get('TALLY_PORT', 9000))


def parse_tally_reply(raw_text):
    """Turn Tally's raw XML response into the {ok, created, altered, errors,
    exceptions, lineErrors} shape the app expects. Tally's XML server reply
    format varies by version/report, so this is deliberately tolerant —
    regex fallback if the XML doesn't parse cleanly (Tally sometimes
    returns near-XML with stray characters)."""
    result = {
        'ok': True,
        'created': [],
        'altered': [],
        'errors': [],
        'exceptions': [],
        'lineErrors': []
    }
    if not raw_text or not raw_text.strip():
        result['ok'] = False
        result['lineErrors'].append('Empty reply from Tally')
        return result

    try:
        root = ET.fromstring(raw_text)
        created = root.findall('.//CREATED')
        altered = root.findall('.//ALTERED')
        errors = root.findall('.//ERRORS')
        exceptions = root.findall('.//EXCEPTIONS')
        line_errors = root.findall('.//LINEERROR')
        result['created'] = [e.text for e in created if e.text]
        result['altered'] = [e.text for e in altered if e.text]
        result['errors'] = [e.text for e in errors if e.text]
        result['exceptions'] = [e.text for e in exceptions if e.text]
        result['lineErrors'] = [e.text for e in line_errors if e.text]
    except ET.ParseError:
        # Fall back to regex scraping if Tally's reply isn't well-formed XML.
        result['lineErrors'] = re.findall(r'<LINEERROR>(.*?)</LINEERROR>', raw_text)
        result['errors'] = re.findall(r'<ERRORS>(.*?)</ERRORS>', raw_text)

    status_match = re.search(r'<STATUS>(\d+)</STATUS>', raw_text)
    has_error_text = bool(re.search(r'LINEERROR|Could not|error', raw_text, re.I))
    if result['lineErrors'] or result['errors']:
        result['ok'] = False
    elif status_match and status_match.group(1) == '0':
        result['ok'] = False
        if not result['lineErrors']:
            result['lineErrors'].append('Tally rejected the request (STATUS 0) with no further detail')
    elif has_error_text and not (result['created'] or result['altered']):
        result['ok'] = False
    return result


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stdout.write('%s - %s\n' % (self.address_string(), fmt % args))

    def _set_cors_headers(self):
        origin = self.headers.get('Origin', '*')
        self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '600')
        # Chrome 142+ Local Network Access preflight header — required or the
        # browser blocks the request before it reaches this script at all,
        # even with Tally open and this relay running correctly.
        self.send_header('Access-Control-Allow-Private-Network', 'true')

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self._set_cors_headers()
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(
            ('tally_relay.py is running. Forwarding to Tally at http://%s:%d\n' % (TALLY_HOST, TALLY_PORT)).encode('utf-8')
        )

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length else b''

        conn = http.client.HTTPConnection(TALLY_HOST, TALLY_PORT, timeout=30)
        try:
            conn.request('POST', '/', body=body, headers={
                'Content-Type': 'text/xml',
                'Content-Length': str(len(body))
            })
            tally_res = conn.getresponse()
            raw = tally_res.read().decode('utf-8', errors='replace')
        except Exception as e:
            self.send_response(502)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            payload = {
                'ok': False,
                'lineErrors': [
                    'Could not reach Tally at http://%s:%d — %s. '
                    'Check: Tally is open, Gateway of Tally -> F11 -> Enable '
                    'ODBC/XML Server -> Yes, port 9000, correct company loaded.'
                    % (TALLY_HOST, TALLY_PORT, str(e))
                ]
            }
            self.wfile.write(json.dumps(payload).encode('utf-8'))
            return
        finally:
            conn.close()

        parsed = parse_tally_reply(raw)
        self.send_response(200)
        self._set_cors_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(parsed).encode('utf-8'))


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def main():
    server = ThreadingHTTPServer(('0.0.0.0', LISTEN_PORT), Handler)
    print('tally_relay.py listening on http://localhost:%d' % LISTEN_PORT)
    print('Forwarding every request to Tally at http://%s:%d' % (TALLY_HOST, TALLY_PORT))
    print('Leave this window open while using the Tally Direct Posting Engine.')
    print('Set the app\'s "Tally HTTP/XML Gateway URL" (Settings) to: http://localhost:%d' % LISTEN_PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopping tally_relay.py')
        server.shutdown()


if __name__ == '__main__':
    main()
