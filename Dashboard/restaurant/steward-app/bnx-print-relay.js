#!/usr/bin/env node
'use strict';

/*
 * Balaji NextGen — RAW ESC/POS Print Relay  (v3.2)
 *
 * A phone browser can never open a raw TCP socket to a thermal printer.
 * This relay runs on any always-on PC / Raspberry Pi on the same Wi-Fi/LAN.
 * The steward app sends it a small HTTPS request, the relay forwards ONLY the
 * decoded ESC/POS bytes to  <printer-ip>:9100.  HTTP never reaches the printer.
 *
 * Node.js 18+, built-in modules only.
 *
 * REQUIRED
 *   BNX_PRINT_KEY=choose-a-long-random-secret        (16+ characters)
 *
 * OPTIONAL
 *   PORT=9191                       HTTPS port (HTTP-only if no certificate)
 *   BNX_HTTP_PORT=9192              extra plain-HTTP port (used when HTTPS is on)
 *   BNX_TLS_CERT / BNX_TLS_KEY      your own certificate (PEM files)
 *   BNX_TLS_AUTO=1                  (default) no certificate given -> create a
 *                                   self-signed one with `openssl` for this PC's
 *                                   LAN IPs. Set 0 to disable.
 *   BNX_PRINTER_SUBNETS=192.168.0.  comma list of allowed printer prefixes
 *   BNX_ALLOWED_ORIGINS=https://x   extra browser origins (comma list, or *)
 *
 * START
 *   BNX_PRINT_KEY=my-long-secret node bnx-print-relay.js
 *
 * ENDPOINTS
 *   GET  /health     public   relay info + whether your key is accepted
 *   GET  /probe      key      ?host=IP  -> can the relay reach IP:9100 ?
 *   GET  /discover   key      scan the LAN for printers listening on 9100
 *   POST /print      key      {host, port:9100, job, data:<base64 ESC/POS>}
 */

const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PORT = Number(process.env.PORT || 9191);
const HTTP_PORT = Number(process.env.BNX_HTTP_PORT || 9192);
const PRINT_KEY = String(process.env.BNX_PRINT_KEY || '').trim();
let CERT_PATH = process.env.BNX_TLS_CERT || '';
let KEY_PATH = process.env.BNX_TLS_KEY || '';
const TLS_AUTO = String(process.env.BNX_TLS_AUTO || '1') !== '0';
const MAX_BODY = 512 * 1024;
const PRINTER_PORT = 9100;

/* Allowed printer prefixes. Default = every /24 this PC is on (so 192.168.1.x, 10.0.0.x ... just work)
   plus 192.168.0.  Override with BNX_PRINTER_SUBNETS=192.168.1.,10.0.0.  */
const PRINTER_PREFIXES = (function () {
  const fromEnv = String(process.env.BNX_PRINTER_SUBNETS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const set = new Set(['192.168.0.']);
  Object.values(os.networkInterfaces()).forEach(list => (list || []).forEach(n => {
    if (n.family === 'IPv4' && !n.internal) set.add(n.address.split('.').slice(0, 3).join('.') + '.');
  }));
  return Array.from(set);
})();

const ALLOWED_ORIGINS = new Set(['https://balajinextgen.in', 'https://www.balajinextgen.in']);
/* v3.2: accept the app from ANY web address (Apps Script, custom domain, PWA...). Printing is still protected by the secret key.
   Set BNX_ALLOWED_ORIGINS=https://yoursite to restrict it again. */
let ALLOW_ANY_ORIGIN = !String(process.env.BNX_ALLOWED_ORIGINS || '').trim();
String(process.env.BNX_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  .forEach(o => { if (o === '*') ALLOW_ANY_ORIGIN = true; else ALLOWED_ORIGINS.add(o.replace(/\/+$/, '')); });

/* The app is also served from the restaurant's own LAN server
   (e.g. http://192.168.0.110:801). Private-network origins are accepted;
   every state-changing call still needs the secret key. */
const LAN_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d{1,5})?$/;

function originAllowed(origin) {
  if (!origin) return true;                    // curl / server-to-server
  if (ALLOW_ANY_ORIGIN) return true;
  return ALLOWED_ORIGINS.has(origin) || LAN_ORIGIN.test(origin);
}

if (!PRINT_KEY || PRINT_KEY.length < 16) {
  console.error('ERROR: Set BNX_PRINT_KEY to a secret of at least 16 characters.');
  process.exit(1);
}
/* v3.1: the relay must never listen on a raw printer port — a browser pointed at it
   would then be "talking HTTPS" exactly where printers expect ESC/POS. */
if ([PORT, HTTP_PORT].some(p => p === PRINTER_PORT || p === 9101 || p === 9102 || p === 515)) {
  console.error('ERROR: PORT / BNX_HTTP_PORT must not be a printer port (9100/9101/9102/515). Use the defaults 9191 / 9192.');
  process.exit(1);
}
if (Boolean(CERT_PATH) !== Boolean(KEY_PATH)) {
  console.error('ERROR: Set both BNX_TLS_CERT and BNX_TLS_KEY, or neither.');
  process.exit(1);
}

/* ───────────────────────── helpers ───────────────────────── */

function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach(name => (nets[name] || []).forEach(n => {
    if (n.family === 'IPv4' && !n.internal) out.push(n.address);
  }));
  return out;
}

function corsHeaders(req, origin) {
  const h = {};
  if (origin && originAllowed(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Vary'] = 'Origin';
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type, X-BNX-Key';
    h['Access-Control-Max-Age'] = '600';
    /* Chrome "Private Network Access": an internet-hosted page calling a LAN
       address sends a preflight asking for this header. Without it every
       print request from https://balajinextgen.in is blocked. */
    if (String(req.headers['access-control-request-private-network'] || '') === 'true') {
      h['Access-Control-Allow-Private-Network'] = 'true';
    }
  }
  return h;
}

function sendJson(req, res, status, obj, origin) {
  const headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }, corsHeaders(req, origin));
  res.writeHead(status, headers);
  res.end(JSON.stringify(obj));
}

function keyOk(req) {
  const given = String(req.headers['x-bnx-key'] || '');
  if (given.length !== PRINT_KEY.length) return false;
  let diff = 0;                                   // constant-time compare
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ PRINT_KEY.charCodeAt(i);
  return diff === 0;
}

function readBody(req, res, origin) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        sendJson(req, res, 413, { ok: false, error: 'Print request too large' }, origin);
        req.destroy();
        reject(new Error('request too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (_) {
        sendJson(req, res, 400, { ok: false, error: 'Invalid JSON body' }, origin);
        reject(new Error('invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function allowedPrinterIp(ip) {
  const s = String(ip || '').trim();
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(s)) return false;
  const parts = s.split('.').map(Number);
  if (parts.some(n => n > 255)) return false;
  if (parts[3] === 0 || parts[3] === 255) return false;
  if (lanAddresses().indexOf(s) >= 0) return false;   // never "print" to the relay PC itself
  return PRINTER_PREFIXES.some(p => s.startsWith(p));
}

function friendlyNetError(err, host) {
  const code = err && err.code;
  if (code === 'ECONNREFUSED') return 'Printer ' + host + ' refused the connection (port 9100 closed / printer busy)';
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return 'Printer ' + host + ' is not reachable (powered off or wrong IP)';
  if (code === 'ETIMEDOUT') return 'Printer ' + host + ' did not answer (timeout)';
  if (code === 'ECONNRESET') return 'Printer ' + host + ' reset the connection';
  return (err && err.message) || 'Printer error';
}

/* One physical printer takes ONE job at a time, even when several phones print
   at the same moment. Tickets can never interleave on the paper. */
const printerQueues = new Map();
function enqueue(host, task) {
  const prev = printerQueues.get(host) || Promise.resolve();
  const run = prev.catch(() => {}).then(task);
  const tail = run.catch(() => {});
  printerQueues.set(host, tail);
  tail.then(() => { if (printerQueues.get(host) === tail) printerQueues.delete(host); });
  return run;
}

function writeRawToPrinter(host, port, bytes) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    socket.setNoDelay(true);
    let settled = false;
    let wrote = false;
    const hard = setTimeout(() => finish(new Error('Printer TCP job timed out')), 20000);
    function finish(err) {
      if (settled) return;
      settled = true;
      clearTimeout(hard);
      try { socket.destroy(); } catch (_) {}
      err ? reject(err) : resolve();
    }
    socket.setTimeout(10000, () => finish(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    socket.once('error', finish);
    socket.once('connect', () => {
      socket.write(bytes, err => {
        if (err) return finish(err);
        wrote = true;
        socket.end();                               // send FIN, keep reading
        setTimeout(() => finish(), 600);            // short grace so the last bytes drain
      });
    });
    socket.once('close', () => {
      if (wrote) finish();
      else finish(new Error('Printer socket closed before the job was sent'));
    });
  });
}

function probePrinter(host, timeoutMs) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port: PRINTER_PORT });
    let done = false;
    const end = (ok, error) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch (_) {}
      resolve({ ok, error });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => end(true));
    socket.once('error', e => end(false, friendlyNetError(e, host)));
    socket.once('timeout', () => end(false, 'Printer ' + host + ' did not answer (timeout)'));
  });
}

/* Scan every /24 this PC is on (only prefixes that are allowed) for open :9100 */
async function discoverPrinters() {
  const bases = new Set();
  lanAddresses().forEach(ip => {
    const base = ip.split('.').slice(0, 3).join('.') + '.';
    if (PRINTER_PREFIXES.some(p => (base).startsWith(p) || p.startsWith(base))) bases.add(base);
  });
  PRINTER_PREFIXES.forEach(p => { if (/^\d+\.\d+\.\d+\.$/.test(p)) bases.add(p); });
  const targets = [];
  bases.forEach(b => { for (let i = 1; i <= 254; i++) targets.push(b + i); });
  const found = [];
  let idx = 0;
  async function worker() {
    while (idx < targets.length) {
      const ip = targets[idx++];
      const r = await probePrinter(ip, 450);
      if (r.ok) found.push(ip);
    }
  }
  await Promise.all(Array.from({ length: 64 }, worker));
  found.sort((a, b) => a.split('.').map(Number).reduce((x, y) => x * 256 + y) -
                       b.split('.').map(Number).reduce((x, y) => x * 256 + y));
  return found;
}

/* ───────────────────────── request handler ───────────────────────── */

async function handler(req, res) {
  try { await handleRequest(req, res); }
  catch (e) {
    console.error(new Date().toISOString(), 'UNEXPECTED', e && e.stack || e);
    try { if (!res.headersSent) sendJson(req, res, 500, { ok: false, error: 'Relay internal error: ' + (e && e.message) }, String(req.headers.origin || '')); else res.end(); } catch (_) {}
  }
}
process.on('unhandledRejection', e => console.error('unhandledRejection', e && e.stack || e));
process.on('uncaughtException', e => console.error('uncaughtException', e && e.stack || e));

async function handleRequest(req, res) {
  const origin = String(req.headers.origin || '');
  const url = new URL(req.url, 'http://relay.local');

  if (req.method === 'OPTIONS') {
    if (origin && !originAllowed(origin)) {
      console.warn('Blocked origin (add it with BNX_ALLOWED_ORIGINS=' + origin + '):', origin);
      return sendJson(req, res, 403, { ok: false, error: 'Origin not allowed: ' + origin }, '');
    }
    res.writeHead(204, corsHeaders(req, origin));
    return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(req, res, 200, {
      ok: true,
      service: 'BNX RAW ESC/POS Relay',
      version: 3.2,
      protocol: req.socket.encrypted ? 'https' : 'http',
      /* v3.2: the relay tells the dashboard its own LAN links, so nobody has to hunt for the IP */
      hostname: os.hostname(),
      links: (function () {
        const ips = lanAddresses();
        return CERT_PATH
          ? { https: ips.map(ip => 'https://' + ip + ':' + PORT), http: ips.map(ip => 'http://' + ip + ':' + HTTP_PORT) }
          : { https: [], http: ips.map(ip => 'http://' + ip + ':' + PORT) };
      })(),
      tcpPort: PRINTER_PORT,
      tokenRequired: true,
      keyOk: req.headers['x-bnx-key'] ? keyOk(req) : null,
      subnets: PRINTER_PREFIXES,
      note: 'HTTP is used only for relay control; the printer receives raw ESC/POS only.'
    }, origin);
  }

  if (origin && !originAllowed(origin)) {
    console.warn('Blocked origin (add it with BNX_ALLOWED_ORIGINS=' + origin + '):', origin);
    return sendJson(req, res, 403, { ok: false, error: 'Origin not allowed: ' + origin }, '');
  }

  if (req.method === 'GET' && url.pathname === '/probe') {
    if (!keyOk(req)) return sendJson(req, res, 401, { ok: false, error: 'Invalid relay key' }, origin);
    const host = String(url.searchParams.get('host') || '').trim();
    if (!allowedPrinterIp(host)) {
      return sendJson(req, res, 400, { ok: false, error: 'Printer target rejected; allowed: ' + PRINTER_PREFIXES.join(', ') + 'x' }, origin);
    }
    const r = await probePrinter(host, 2500);
    return sendJson(req, res, r.ok ? 200 : 502, r.ok ? { ok: true, host, port: PRINTER_PORT } : { ok: false, error: r.error }, origin);
  }

  if (req.method === 'GET' && url.pathname === '/discover') {
    if (!keyOk(req)) return sendJson(req, res, 401, { ok: false, error: 'Invalid relay key' }, origin);
    try {
      const found = await discoverPrinters();
      return sendJson(req, res, 200, { ok: true, found, port: PRINTER_PORT }, origin);
    } catch (e) {
      return sendJson(req, res, 500, { ok: false, error: 'Scan failed: ' + e.message }, origin);
    }
  }

  if (req.method !== 'POST' || url.pathname !== '/print') {
    return sendJson(req, res, 404, { ok: false, error: 'Use GET /health, /probe, /discover or POST /print' }, origin);
  }
  if (!keyOk(req)) return sendJson(req, res, 401, { ok: false, error: 'Invalid relay key' }, origin);

  let body;
  try { body = await readBody(req, res, origin); }
  catch (_) { return; }

  const host = String(body.host || '').trim();
  const port = Number(body.port || PRINTER_PORT);
  if (!allowedPrinterIp(host) || port !== PRINTER_PORT) {
    return sendJson(req, res, 400, {
      ok: false, error: 'Printer target rejected; allowed: ' + PRINTER_PREFIXES.join(', ') + 'x:' + PRINTER_PORT
    }, origin);
  }

  let bytes;
  try {
    const b64 = String(body.data || '');
    if (!b64 || b64.length > 700000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) throw new Error('bad base64');
    bytes = Buffer.from(b64, 'base64');
  } catch (_) {
    return sendJson(req, res, 400, { ok: false, error: 'Invalid base64 ESC/POS payload' }, origin);
  }

  /* Every ticket the app builds starts with ESC @ (1B 40). Anything else is
     HTML / HTTP / TLS garbage that would print as junk characters. */
  if (bytes.length < 2 || bytes[0] !== 0x1b || bytes[1] !== 0x40) {
    console.error('REJECTED non-ESC/POS job; first bytes (hex):', bytes.subarray(0, 24).toString('hex'));
    return sendJson(req, res, 400, {
      ok: false,
      error: 'Rejected: payload is not raw ESC/POS (expected bytes 1B 40). Check the app/relay route.'
    }, origin);
  }
  if (/HTTP\/[12]\.|<!doctype|<html|content-type:/i.test(bytes.subarray(0, 80).toString('latin1'))) {
    return sendJson(req, res, 400, { ok: false, error: 'Rejected HTTP/HTML data; not a printer ticket' }, origin);
  }

  const job = String(body.job || 'BNX KOT').slice(0, 80);
  try {
    await enqueue(host, () => writeRawToPrinter(host, port, bytes));
    console.log(new Date().toISOString(), 'PRINT SENT', host + ':' + port, 'job=' + job, 'bytes=' + bytes.length);
    return sendJson(req, res, 200, { ok: true, host, port, bytes: bytes.length }, origin);
  } catch (err) {
    const msg = friendlyNetError(err, host);
    console.error(new Date().toISOString(), 'PRINT FAILED', host, job, '-', msg);
    return sendJson(req, res, 502, { ok: false, error: msg }, origin);
  }
}

/* ───────────────────────── certificate + start ───────────────────────── */

function ensureSelfSignedCert() {
  const dir = path.join(__dirname, 'bnx-relay-cert');
  const crt = path.join(dir, 'relay.crt');
  const key = path.join(dir, 'relay.key');
  const ips = lanAddresses();
  const stamp = path.join(dir, 'ips.txt');
  const want = ips.join(',');
  try {
    if (fs.existsSync(crt) && fs.existsSync(key) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === want) {
      return { crt, key };
    }
    fs.mkdirSync(dir, { recursive: true });
    const san = ['DNS:localhost', 'IP:127.0.0.1'].concat(ips.map(ip => 'IP:' + ip)).join(',');
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '825',
      '-keyout', key, '-out', crt, '-subj', '/CN=BNX Print Relay',
      '-addext', 'subjectAltName=' + san
    ], { stdio: 'ignore' });
    fs.writeFileSync(stamp, want);
    return { crt, key };
  } catch (e) {
    console.warn('Could not create a self-signed certificate (is `openssl` installed?):', e.message);
    return null;
  }
}

if (!CERT_PATH && TLS_AUTO) {
  const made = ensureSelfSignedCert();
  if (made) { CERT_PATH = made.crt; KEY_PATH = made.key; }
}

function tune(server) {
  server.requestTimeout = 60000;     // /discover can take ~15 s
  server.headersTimeout = 10000;
  server.on('clientError', (_e, socket) => { try { socket.destroy(); } catch (_) {} });
  return server;
}

const lan = lanAddresses();
if (CERT_PATH) {
  tune(https.createServer({ cert: fs.readFileSync(CERT_PATH), key: fs.readFileSync(KEY_PATH) }, handler))
    .listen(PORT, '0.0.0.0', () => {
      console.log('BNX Print Relay (HTTPS) listening on port ' + PORT);
      lan.forEach(ip => console.log('  App address (https site):  https://' + ip + ':' + PORT));
    });
  tune(http.createServer(handler)).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log('BNX Print Relay (HTTP)  listening on port ' + HTTP_PORT + '  (for apps served from http://192.168.x.x)');
    lan.forEach(ip => console.log('  App address (LAN http app): http://' + ip + ':' + HTTP_PORT));
    console.log('Open the https address ONCE on every phone → Advanced → Proceed (certificate trust).');
  });
} else {
  tune(http.createServer(handler)).listen(PORT, '0.0.0.0', () => {
    console.log('BNX Print Relay (HTTP only) listening on port ' + PORT);
    lan.forEach(ip => console.log('  App address: http://' + ip + ':' + PORT));
    console.warn('No HTTPS certificate: an https:// website cannot call this relay. Install openssl or set BNX_TLS_CERT/BNX_TLS_KEY.');
  });
}
console.log('Allowed printer targets: ' + PRINTER_PREFIXES.map(p => p + 'x').join(', ') + ' : ' + PRINTER_PORT);
console.log('Health check: /health   |   Printer scan: /discover');
