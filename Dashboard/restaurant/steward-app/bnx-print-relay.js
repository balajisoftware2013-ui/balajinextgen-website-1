#!/usr/bin/env node
/* ============================================================================
   BNX PRINT RELAY  —  lets the HAPPYSERVE Steward Mobile app print KOTs to the
   3 station printers (KITCHEN / BAR / HUKKA) over the restaurant LAN.

   WHY: a phone browser cannot open a raw TCP connection to a thermal printer
   (192.168.x.x:9100). This tiny helper runs on ANY always-on PC / Raspberry Pi
   / mini-PC on the same Wi-Fi and forwards each ticket to the printer.

   RUN:   node bnx-print-relay.js            (Node 14+, no npm install needed)
   OPT :  PORT=9191  BNX_KEY=secret  node bnx-print-relay.js
   HTTPS: AUTOMATIC. The steward app runs on https://, and a browser refuses to call a plain
          http:// relay from an https page. So on first start this relay creates its own
          certificate (needs `openssl`, present on Linux/Mac/Raspberry Pi and Git-for-Windows)
          and serves  https://<this-pc-ip>:9191  (plain http stays on 9192 for testing).
          Own certificate instead:  CERT_FILE=cert.pem KEY_FILE=key.pem node bnx-print-relay.js
          ONE TIME per phone: open  https://<this-pc-ip>:9191/health  -> Advanced -> Proceed.

   ENDPOINTS
     GET  /health                  -> {ok:true}
     GET  /probe?host=IP[&port=9100]  -> {ok:true|false}   is the printer reachable?
     GET  /discover[?prefix=192.168.0] -> {ok:true,found:[ips]}  finds printers (port 9100)
     POST /print  {host,port,data(base64),job}  -> {ok:true}
   Only private LAN addresses and port 9100 are accepted.
   ============================================================================ */
'use strict';
const http = require('http'), https = require('https'), net = require('net'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const PORT = parseInt(process.env.PORT || '9191', 10);
const KEY = process.env.BNX_KEY || '';
const PRIVATE = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;

function send(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-BNX-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(obj));
}
function tcpProbe(host, port, ms) {
  return new Promise(resolve => {
    const s = new net.Socket(); let done = false;
    const fin = ok => { if (!done) { done = true; try { s.destroy(); } catch (e) {} resolve(ok); } };
    s.setTimeout(ms); s.once('connect', () => fin(true)); s.once('timeout', () => fin(false)); s.once('error', () => fin(false));
    s.connect(port, host);
  });
}
function tcpPrintOnce(host, port, buf) {
  return new Promise((resolve, reject) => {
    const s = new net.Socket(); let done = false;
    const fin = (err) => { if (done) return; done = true; try { s.destroy(); } catch (e) {} err ? reject(err) : resolve(); };
    s.setTimeout(6000);
    s.once('timeout', () => fin(new Error('Printer ' + host + ' did not respond (timeout)')));
    s.once('error', e => fin(new Error('Printer ' + host + ': ' + (e.code || e.message))));
    s.connect(port, host, () => { s.write(buf, () => { s.end(); setTimeout(() => fin(), 400); }); });
  });
}
/* A thermal printer accepts ONE connection at a time. Jobs for the same printer are queued
   one-by-one (kitchen + bar + hukka tickets can arrive together) and each job is retried. */
const chains = new Map();
function tcpPrint(host, port, buf) {
  const prev = chains.get(host) || Promise.resolve();
  const job = prev.catch(() => {}).then(async () => {
    let last;
    for (let i = 1; i <= 3; i++) {
      try { return await tcpPrintOnce(host, port, buf); }
      catch (e) { last = e; await new Promise(r => setTimeout(r, 800 * i)); }
    }
    throw last;
  });
  chains.set(host, job.catch(() => {}));
  return job;
}
function localPrefix() {
  const nets = os.networkInterfaces();
  for (const k of Object.keys(nets)) for (const n of nets[k] || []) {
    if (n.family === 'IPv4' && !n.internal && PRIVATE.test(n.address)) return n.address.split('.').slice(0, 3).join('.');
  }
  return '192.168.0';
}
async function discover(prefix) {
  const found = []; let next = 1;
  async function worker() {
    while (next <= 254) { const i = next++; const ip = prefix + '.' + i; if (await tcpProbe(ip, 9100, 600)) found.push(ip); }
  }
  await Promise.all(Array.from({ length: 48 }, worker));
  return found.sort((a, b) => parseInt(a.split('.')[3]) - parseInt(b.split('.')[3]));
}
async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') return send(res, 200, { ok: true, tokenRequired: !!KEY, name: 'bnx-print-relay', https: !!tls, prefix: localPrefix() });
  if (KEY && req.headers['x-bnx-key'] !== KEY) return send(res, 401, { ok: false, error: 'Wrong relay key' });
  try {
    if (u.pathname === '/probe') {
      const host = u.searchParams.get('host') || '', port = parseInt(u.searchParams.get('port') || '9100', 10);
      if (!PRIVATE.test(host) || port !== 9100) return send(res, 400, { ok: false, error: 'Only LAN printers on port 9100' });
      return send(res, 200, { ok: await tcpProbe(host, port, 1500), host });
    }
    if (u.pathname === '/discover') {
      const p = (u.searchParams.get('prefix') || localPrefix()).trim();
      if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(p) || !PRIVATE.test(p + '.1')) return send(res, 400, { ok: false, error: 'Bad prefix' });
      return send(res, 200, { ok: true, prefix: p, found: await discover(p) });
    }
    if (u.pathname === '/print' && req.method === 'POST') {
      let body = ''; req.on('data', c => { body += c; if (body.length > 2e6) req.destroy(); });
      req.on('end', async () => {
        try {
          const j = JSON.parse(body || '{}'); const host = String(j.host || ''), port = parseInt(j.port || 9100, 10);
          if (!PRIVATE.test(host) || port !== 9100) return send(res, 400, { ok: false, error: 'Only LAN printers on port 9100' });
          await tcpPrint(host, port, Buffer.from(String(j.data || ''), 'base64'));
          console.log(new Date().toLocaleTimeString(), 'PRINTED', j.job || '', '->', host);
          send(res, 200, { ok: true });
        } catch (e) { console.warn('PRINT FAILED:', e.message); send(res, 502, { ok: false, error: e.message }); }
      });
      return;
    }
    send(res, 404, { ok: false, error: 'Not found' });
  } catch (e) { send(res, 500, { ok: false, error: e.message }); }
}
/* ---------- HTTPS certificate (auto) ---------- */
function lanIps() {
  const out = [];
  Object.values(os.networkInterfaces()).flat().forEach(n => { if (n && n.family === 'IPv4' && !n.internal) out.push(n.address); });
  return out;
}
function loadOrMakeCert() {
  if (process.env.CERT_FILE && process.env.KEY_FILE)
    return { cert: fs.readFileSync(process.env.CERT_FILE), key: fs.readFileSync(process.env.KEY_FILE) };
  const dir = path.join(__dirname, 'bnx-certs'), cf = path.join(dir, 'relay-cert.pem'), kf = path.join(dir, 'relay-key.pem'), ipf = path.join(dir, 'ips.txt');
  const ips = lanIps().sort().join(',');
  try {
    if (fs.existsSync(cf) && fs.existsSync(kf) && fs.existsSync(ipf) && fs.readFileSync(ipf, 'utf8') === ips)
      return { cert: fs.readFileSync(cf), key: fs.readFileSync(kf) };
  } catch (e) {}
  try {
    fs.mkdirSync(dir, { recursive: true });
    const san = 'subjectAltName=' + lanIps().map(i => 'IP:' + i).concat(['IP:127.0.0.1', 'DNS:localhost']).join(',');
    const base = ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', kf, '-out', cf, '-days', '3650', '-subj', '/CN=bnx-print-relay'];
    let r = cp.spawnSync('openssl', base.concat(['-addext', san]), { stdio: 'pipe' });
    if (r.status !== 0) r = cp.spawnSync('openssl', base, { stdio: 'pipe' });
    if (r.status !== 0) throw new Error((r.error && r.error.message) || String(r.stderr || 'openssl failed'));
    fs.writeFileSync(ipf, ips);
    console.log('Created HTTPS certificate in ' + dir);
    return { cert: fs.readFileSync(cf), key: fs.readFileSync(kf) };
  } catch (e) {
    console.warn('!! Could not create an HTTPS certificate (' + e.message + ').');
    console.warn('!! Install OpenSSL (or Git for Windows) and restart. Without https the phone app CANNOT print.');
    return null;
  }
}
const tls = loadOrMakeCert();
const started = [];
function listen(srv, port, proto) {
  srv.on('error', e => console.error(proto + ' port ' + port + ': ' + e.message));
  srv.listen(port, '0.0.0.0', () => {
    lanIps().forEach(ip => console.log('  ' + proto + '  ->  enter in app:  ' + proto + '://' + ip + ':' + port));
  });
}
console.log('BNX Print Relay  (LAN prefix ' + localPrefix() + '.x)');
if (tls) listen(https.createServer(tls, handler), PORT, 'https');
listen(http.createServer(handler), tls ? PORT + 1 : PORT, 'http');
if (tls) console.log('\nPhone app (https) must use the https:// address.  First time: open  https://<ip>:' + PORT + '/health  on the phone -> Advanced -> Proceed.');
