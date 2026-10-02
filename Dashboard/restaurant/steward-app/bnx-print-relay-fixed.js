#!/usr/bin/env node
'use strict';

/*
 * Balaji NextGen — RAW ESC/POS Print Relay (fixed)
 *
 * The printer must receive ONLY decoded ESC/POS bytes over TCP 9100.
 * HTTP requests/responses stay between the phone and this relay and are
 * NEVER forwarded to the printer socket.
 *
 * Node.js 18+; built-in modules only.
 *
 * Required:
 *   BNX_PRINT_KEY=choose-a-long-random-secret
 * Optional HTTPS (recommended for an HTTPS-hosted web app):
 *   BNX_TLS_CERT=/path/to/fullchain.pem
 *   BNX_TLS_KEY=/path/to/privkey.pem
 *   PORT=9191
 *
 * Start:
 *   node bnx-print-relay-fixed.js
 */

const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const fs = require('node:fs');

const PORT = Number(process.env.PORT || 9191);
const PRINT_KEY = String(process.env.BNX_PRINT_KEY || '').trim();
const CERT_PATH = process.env.BNX_TLS_CERT || '';
const KEY_PATH = process.env.BNX_TLS_KEY || '';
const MAX_BODY = 512 * 1024;
const ALLOWED_ORIGINS = new Set([
  'https://balajinextgen.in',
  'https://www.balajinextgen.in'
]);

if (!PRINT_KEY || PRINT_KEY.length < 16) {
  console.error('ERROR: Set BNX_PRINT_KEY to a secret of at least 16 characters.');
  process.exit(1);
}
if (Boolean(CERT_PATH) !== Boolean(KEY_PATH)) {
  console.error('ERROR: Set both BNX_TLS_CERT and BNX_TLS_KEY, or neither.');
  process.exit(1);
}

function sendJson(res, status, obj, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, X-BNX-Key';
    headers['Access-Control-Max-Age'] = '600';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(obj));
}

function readBody(req, res, origin) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        sendJson(res, 413, { ok: false, error: 'Print request too large' }, origin);
        req.destroy();
        reject(new Error('request too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (_) {
        sendJson(res, 400, { ok: false, error: 'Invalid JSON body' }, origin);
        reject(new Error('invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/* This deployment is intentionally restricted to Client 10's printer subnet. */
function allowedPrinterIp(ip) {
  const m = /^192\.168\.0\.(\d{1,3})$/.exec(String(ip || '').trim());
  if (!m) return false;
  const last = Number(m[1]);
  return last >= 1 && last <= 254 && ![1, 2, 255].includes(last);
}

function writeRawToPrinter(host, port, bytes) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let finished = false;
    const done = (err) => {
      if (finished) return;
      finished = true;
      try { socket.destroy(); } catch (_) {}
      err ? reject(err) : resolve();
    };
    socket.setTimeout(8000);
    socket.once('connect', () => {
      socket.write(bytes, err => {
        if (err) return done(err);
        socket.end();
      });
    });
    socket.once('finish', () => done());
    socket.once('error', done);
    socket.once('timeout', () => done(new Error('Printer TCP connection timed out')));
    socket.once('close', () => {
      if (!finished) done(new Error('Printer socket closed before job completed'));
    });
  });
}

async function handler(req, res) {
  const origin = String(req.headers.origin || '');
  if (req.method === 'OPTIONS') {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return sendJson(res, 403, { ok: false, error: 'Origin not allowed' }, origin);
    }
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-BNX-Key',
      'Access-Control-Max-Age': '600'
    });
    return res.end();
  }

  const url = new URL(req.url, 'http://relay.local');
  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, {
      ok: true, service: 'BNX RAW ESC/POS Relay',
      protocol: CERT_PATH ? 'https' : 'http',
      tcpPort: 9100,
      note: 'HTTP is used only for relay control; printer receives raw ESC/POS only.'
    }, origin);
  }

  if (req.method === 'GET' && url.pathname === '/probe') {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return sendJson(res, 403, { ok: false, error: 'Origin not allowed' }, origin);
    }
    const host = String(url.searchParams.get('host') || '').trim();
    if (!allowedPrinterIp(host)) {
      return sendJson(res, 400, { ok: false, error: 'Printer target rejected; allowed subnet is 192.168.0.x' }, origin);
    }
    const socket = net.createConnection({ host, port: 9100 });
    let finished = false;
    const finish = (ok, error) => {
      if (finished) return;
      finished = true;
      try { socket.destroy(); } catch (_) {}
      sendJson(res, ok ? 200 : 502, ok ? { ok: true, host, port: 9100 } : { ok: false, error }, origin);
    };
    socket.setTimeout(2500);
    socket.once('connect', () => finish(true));
    socket.once('error', e => finish(false, 'Printer unreachable: ' + e.message));
    socket.once('timeout', () => finish(false, 'Printer TCP probe timed out'));
    return;
  }

  if (req.method !== 'POST' || url.pathname !== '/print') {
    return sendJson(res, 404, { ok: false, error: 'Use GET /health or POST /print' }, origin);
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return sendJson(res, 403, { ok: false, error: 'Origin not allowed' }, origin);
  }
  if (String(req.headers['x-bnx-key'] || '') !== PRINT_KEY) {
    return sendJson(res, 401, { ok: false, error: 'Invalid relay key' }, origin);
  }

  let body;
  try { body = await readBody(req, res, origin); }
  catch (_) { return; }

  const host = String(body.host || '').trim();
  const port = Number(body.port || 9100);
  if (!allowedPrinterIp(host) || port !== 9100) {
    return sendJson(res, 400, {
      ok: false, error: 'Printer target rejected; allowed subnet is 192.168.0.x:9100'
    }, origin);
  }

  let bytes;
  try {
    const b64 = String(body.data || '');
    if (!b64 || b64.length > 700000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) {
      throw new Error('Invalid base64 data');
    }
    bytes = Buffer.from(b64, 'base64');
  } catch (_) {
    return sendJson(res, 400, { ok: false, error: 'Invalid base64 ESC/POS payload' }, origin);
  }

  /* ESC @ is the expected first command in the app's KOT/test ticket.
     Reject HTML, HTTP headers, TLS data, and accidental browser responses. */
  if (bytes.length < 2 || bytes[0] !== 0x1b || bytes[1] !== 0x40) {
    const preview = bytes.subarray(0, 24).toString('hex');
    console.error('REJECTED non-ESC/POS job; first bytes (hex):', preview);
    return sendJson(res, 400, {
      ok: false,
      error: 'Rejected: payload is not raw ESC/POS (expected bytes 1B 40). Check the mobile app/relay route.'
    }, origin);
  }
  const asciiStart = bytes.subarray(0, 80).toString('latin1');
  if (/HTTP\/[12]\.|<!doctype|<html|content-type:/i.test(asciiStart)) {
    return sendJson(res, 400, { ok: false, error: 'Rejected HTTP/HTML data; not a printer ticket' }, origin);
  }

  try {
    await writeRawToPrinter(host, port, bytes);
    console.log(new Date().toISOString(), 'PRINT SENT', host + ':' + port,
      'job=' + String(body.job || 'BNX KOT').slice(0, 80), 'bytes=' + bytes.length);
    return sendJson(res, 200, { ok: true, host, port, bytes: bytes.length }, origin);
  } catch (err) {
    console.error('Printer send failed:', host, err.message);
    return sendJson(res, 502, { ok: false, error: 'Printer send failed: ' + err.message }, origin);
  }
}

const server = CERT_PATH
  ? https.createServer({ cert: fs.readFileSync(CERT_PATH), key: fs.readFileSync(KEY_PATH) }, handler)
  : http.createServer(handler);

server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`BNX Print Relay listening on ${CERT_PATH ? 'HTTPS' : 'HTTP'} port ${PORT}`);
  console.log('Allowed printer targets: 192.168.0.x:9100 only');
  console.log('Health check: /health');
  if (!CERT_PATH) console.warn('HTTP mode cannot be called from the HTTPS website in modern browsers; configure TLS certificate/key.');
});
