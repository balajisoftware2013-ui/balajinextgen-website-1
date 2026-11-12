#!/usr/bin/env python3
"""
Tally Relay v3 -- run this on the SAME PC as TallyPrime.

Why this exists:
  Browsers cannot read the reply from Tally's HTTP/XML gateway directly
  (Tally can't answer CORS). This script listens on port 9001, forwards the
  dashboard's XML to Tally server-to-server, reads Tally's REAL reply and
  sends a clean summary back.

v2 changes:
  * Uses the port set in the dashboard ("Tally HTTP Port") instead of a
    hard-coded 9000.
  * Tries 127.0.0.1 AND ::1 (Windows "localhost" quirk).
  * If the port refuses, scans common ports (9000, 9999, 9002, 9090, 8000)
    and only accepts one that answers as the TallyPrime XML server.
  * v3: never mistakes the Tally LICENSE SERVER (port 9999, "License server
    is Running") for TallyPrime.
  * Connection failures are reported as "Tally not reachable", never as
    "rejected by Tally".
  * /ping endpoint so the dashboard can test the link before posting.

HOW TO USE:
  1. Open TallyPrime and load the company.
  2. Enable Tally's XML gateway (once):
       F1: Help -> Settings -> Connectivity -> Client/Server configuration
         TallyPrime acts as : Both   (or Server)
         Enable ODBC        : Yes
         Port               : 9000
       Save, then CLOSE and REOPEN TallyPrime (the port only opens on restart).
  3. Run:  python tally_relay.py
     The window prints whether Tally answered. Leave it open.
  4. Use the Direct Post buttons on the dashboard. Ctrl+C to stop.

Standard library only -- nothing to install.
"""

import http.server
import socketserver
import socket
import urllib.request
import urllib.parse
import urllib.error
import re
import json
import sys
import os
import shutil
import subprocess

RELAY_VERSION = 3
RELAY_PORT = 9001
DEFAULT_TALLY_PORT = 9000
SCAN_PORTS = [9000, 9999, 9002, 9090, 8000]
HOSTS = ["127.0.0.1", "::1"]


def port_open(host, port, timeout=1.5):
    fam = socket.AF_INET6 if ":" in host else socket.AF_INET
    try:
        s = socket.socket(fam, socket.SOCK_STREAM)
    except OSError:
        return False  # e.g. IPv6 disabled on this PC
    s.settimeout(timeout)
    try:
        s.connect((host, port))
        return True
    except OSError:
        return False
    finally:
        s.close()


def tally_url(host, port):
    return "http://[%s]:%s" % (host, port) if ":" in host else "http://%s:%s" % (host, port)


def port_kind(host, port):
    """What is answering on this port?
    'tally'   -> TallyPrime / Tally.ERP XML server ("... Server is Running")
    'license' -> Tally License / Gateway Server (default port 9999) -- NOT usable
    'other'   -> some other program
    """
    try:
        with urllib.request.urlopen(tally_url(host, port), timeout=3) as r:
            txt = r.read(4096).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        try:
            txt = e.read(4096).decode("utf-8", errors="replace")
        except Exception:
            txt = ""
    except Exception:
        return "other"
    low = txt.lower()
    if "license server" in low or "gateway version" in low:
        return "license"
    if "server is running" in low or "<response>" in low:
        return "tally"
    return "other"


def find_tally(port):
    """Return (host, port, skipped). Only a port that answers like the
    TallyPrime XML server counts -- an open port alone is not enough
    (Tally's License Server on 9999 is open too, but rejects all data)."""
    skipped = []
    ports = [port] + [p for p in SCAN_PORTS if p not in (port, RELAY_PORT)]
    for p in ports:
        for h in HOSTS:
            if not port_open(h, p, 1.5 if p == port else 0.6):
                continue
            kind = port_kind(h, p)
            if kind == "tally":
                return h, p, skipped
            skipped.append({"port": p, "kind": kind})
            break  # same service on ::1 -- don't test twice
    return None, None, skipped


def parse_tally_response(xml_text):
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
        "ok": ok, "created": created_n, "altered": altered_n,
        "errors": errors_n, "exceptions": exceptions_n,
        "lineErrors": [e.strip() for e in line_errors], "raw": xml_text,
    }


def requested_port(path):
    try:
        q = urllib.parse.parse_qs(urllib.parse.urlparse(path).query)
        p = int(q.get("port", [DEFAULT_TALLY_PORT])[0])
        if 1 <= p <= 65535 and p != RELAY_PORT:
            return p
    except (ValueError, TypeError):
        pass
    return DEFAULT_TALLY_PORT


def decode_reply(data):
    if data[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return data.decode("utf-16", errors="replace")
    return data.decode("utf-8", errors="replace")


# ---------- automatic Tally setup (no manual settings needed) ----------
# TallyPrime only accepts outside data when its XML server is on. That is
# stored in tally.ini next to tally.exe. If Tally is not reachable, the
# relay switches it on there (after taking a backup) -- the user only has
# to restart TallyPrime once.
INI_WANT = [("Client Server", "Both"), ("ODBC Server", "Yes"), ("Port", str(DEFAULT_TALLY_PORT))]


def tally_dirs():
    dirs = []
    if os.name == "nt":
        try:
            out = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "Get-Process -Name tally -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }"],
                capture_output=True, text=True, timeout=15).stdout
            for line in out.splitlines():
                if line.strip():
                    dirs.append(os.path.dirname(line.strip()))
        except Exception:
            pass
        for drive in ("C:", "D:", "E:"):
            for sub in ("Program Files/TallyPrime", "Program Files (x86)/TallyPrime",
                        "TallyPrime", "Tally.ERP9", "Program Files/Tally.ERP9"):
                dirs.append(os.path.normpath(drive + "/" + sub))
    seen, res = set(), []
    for d in dirs:
        k = d.lower()
        if k not in seen and os.path.isfile(os.path.join(d, "tally.ini")):
            seen.add(k)
            res.append(d)
    return res


def fix_tally_ini(path):
    """Returns 'changed', 'ok' (already right) or an error string."""
    with open(path, "r", encoding="latin-1", newline="") as f:
        lines = f.read().splitlines()
    done = set()
    changed = False
    for i, line in enumerate(lines):
        if "=" not in line or line.lstrip().startswith(";"):
            continue
        key = line.split("=", 1)[0].strip()
        for want_k, want_v in INI_WANT:
            if key.lower() == want_k.lower():
                done.add(want_k)
                if line.split("=", 1)[1].strip().lower() != want_v.lower():
                    lines[i] = "%s=%s" % (want_k, want_v)
                    changed = True
    missing = ["%s=%s" % kv for kv in INI_WANT if kv[0] not in done]
    if missing:
        at = next((i + 1 for i, l in enumerate(lines) if l.strip().lower() == "[tally]"), len(lines))
        lines[at:at] = missing
        changed = True
    if not changed:
        return "ok"
    bak = path + ".bak_relay"
    if not os.path.exists(bak):
        shutil.copy2(path, bak)
    try:
        with open(path, "w", encoding="latin-1", newline="") as f:
            f.write("\r\n".join(lines) + "\r\n")
    except PermissionError:
        return "no-permission"
    return "changed"


def auto_setup_tally():
    dirs = tally_dirs()
    if not dirs:
        print("!! Could not find tally.ini automatically. Open TallyPrime once and run this relay again,")
        print("   or set it inside Tally: F1 > Settings > Connectivity > acts as Both, ODBC Yes, Port 9000.")
        return
    for d in dirs:
        ini = os.path.join(d, "tally.ini")
        r = fix_tally_ini(ini)
        if r == "changed":
            print("OK  Turned on TallyPrime's XML server in %s (backup: tally.ini.bak_relay)." % ini)
            print(">>  CLOSE and REOPEN TallyPrime once. Direct Post will then work -- no other settings needed.")
        elif r == "ok":
            print("..  %s already has the XML server on. If Tally is open, CLOSE and REOPEN it once." % ini)
        elif r == "no-permission":
            print("!! Windows blocked editing %s." % ini)
            print("   Close this window, right-click Command Prompt > 'Run as administrator',")
            print("   and run  python tally_relay.py  again (needed only this one time).")


class RelayHandler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, status, obj):
        obj["relayVersion"] = RELAY_VERSION
        payload = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        port = requested_port(self.path)
        host, found, skipped = find_tally(port)
        self._json(200, {
            "ok": True, "tallyReachable": host is not None,
            "requestedPort": port, "foundPort": found, "host": host,
            "skipped": skipped,
        })

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        port = requested_port(self.path)
        host, found, skipped = find_tally(port)
        if host is None:
            return self._json(502, {
                "skipped": skipped,
                "ok": False, "connectError": True,
                "created": 0, "altered": 0, "errors": 0, "exceptions": 0,
                "lineErrors": ["Tally is not listening on port %s (also scanned %s). "
                               "Open TallyPrime, enable F1 > Settings > Connectivity "
                               "(acts as Both, port %s) and restart TallyPrime." %
                               (port, ", ".join(str(p) for p in SCAN_PORTS if p != port), port)],
                "raw": "", "requestedPort": port, "foundPort": None,
            })
        try:
            req = urllib.request.Request(
                tally_url(host, found), data=body,
                headers={"Content-Type": "text/xml"}, method="POST")
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = decode_reply(resp.read())
            summary = parse_tally_response(raw)
            summary["requestedPort"] = port
            summary["foundPort"] = found
            self._json(200, summary)
        except Exception as e:
            self._json(502, {
                "ok": False, "connectError": True,
                "created": 0, "altered": 0, "errors": 0, "exceptions": 0,
                "lineErrors": ["Tally on port %s stopped responding: %s" % (found, e)],
                "raw": "", "requestedPort": port, "foundPort": found,
            })

    def log_message(self, fmt, *args):
        print("[relay]", fmt % args)


class Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    print("Tally Relay v%s" % RELAY_VERSION)
    host, found, skipped = find_tally(DEFAULT_TALLY_PORT)
    for sk in skipped:
        if sk["kind"] == "license":
            print("..  Port %s is the Tally LICENSE SERVER -- not usable for data, ignored." % sk["port"])
        else:
            print("..  Port %s is open but is not TallyPrime -- ignored." % sk["port"])
    if host is None:
        print("!! TallyPrime's XML server is NOT running on ports %s." % ", ".join(map(str, SCAN_PORTS)))
        auto_setup_tally()
        print("   1. Open TallyPrime and load the company.")
        print("   2. F1: Help > Settings > Connectivity > Client/Server configuration:")
        print("      TallyPrime acts as = Both, Enable ODBC = Yes, Port = 9000")
        print("   3. Save, CLOSE and REOPEN TallyPrime. The relay keeps running and")
        print("      will pick Tally up automatically once it is listening.")
    else:
        print("OK  Tally found at %s" % tally_url(host, found))
    try:
        httpd = Server(("127.0.0.1", RELAY_PORT), RelayHandler)
    except OSError as e:
        print("!! Cannot open port %s (%s). Is another relay window already open?" % (RELAY_PORT, e))
        sys.exit(1)
    print("Relay listening on http://localhost:%s  -- leave this window open, Ctrl+C to stop." % RELAY_PORT)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        sys.exit(0)


if __name__ == "__main__":
    main()
