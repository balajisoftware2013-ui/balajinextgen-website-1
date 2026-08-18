#!/usr/bin/env node
/**
 * tally-proxy.js — local bridge between the Tally Direct Posting Engine
 * (running in your browser, at https://www.balajinextgen.in/...) and
 * Tally's own HTTP/XML server on http://localhost:9000.
 *
 * WHY THIS EXISTS
 * Browsers cannot call Tally's port 9000 directly:
 *   1. Tally's built-in server sends no CORS headers, so the browser
 *      refuses to hand the reply back to the page.
 *   2. Since Chrome 142, any page loaded from a public https:// domain
 *      (like balajinextgen.in) additionally needs "Local Network Access"
 *      permission before it's even allowed to try a localhost/LAN request —
 *      this proxy must answer that preflight correctly or the browser
 *      blocks the call before it ever reaches this script.
 * This script sits in between: browser -> :9001 (this proxy, CORS/LNA-aware)
 * -> :9000 (real Tally) -> reply forwarded back to the browser unchanged.
 *
 * RUN
 *   node tally-proxy.js
 *   (needs Node 18+ for built-in fetch; falls back to http module otherwise)
 *
 * Leave this running in a terminal window whenever you use the posting
 * engine. Tally itself must be open with ODBC/XML Server enabled:
 *   Gateway of Tally -> F11 (Features) -> Enable ODBC/XML Server -> Yes
 *   (default port 9000, same company loaded that you're posting into)
 */

const http = require('http');

const LISTEN_PORT = process.env.TALLY_PROXY_PORT || 9001;
const TALLY_HOST = process.env.TALLY_HOST || '127.0.0.1';
const TALLY_PORT = process.env.TALLY_PORT || 9000;

function setCorsHeaders(req, res) {
  // Reflect the calling origin (rather than hardcoding one) so this works
  // whether you're testing from http://localhost, a LAN IP, or the live
  // https://www.balajinextgen.in domain, without editing this file.
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  // Chrome 142+ Local Network Access: a preflight from a public https:// page
  // to this loopback server carries Access-Control-Request-Private-Network
  // (legacy PNA name still used on the wire) — without this response header
  // Chrome silently fails the whole request with no proxy code ever running.
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

const server = http.createServer((req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('tally-proxy.js is running. Forwarding to Tally at http://' + TALLY_HOST + ':' + TALLY_PORT + '\n');
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed');
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('error', (err) => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy error reading request: ' + err.message);
  });
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const options = {
      hostname: TALLY_HOST,
      port: TALLY_PORT,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const tallyReq = http.request(options, (tallyRes) => {
      const outChunks = [];
      tallyRes.on('data', (c) => outChunks.push(c));
      tallyRes.on('end', () => {
        setCorsHeaders(req, res); // headers can be dropped by writeHead below on some Node versions — set again just before writing
        res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' });
        res.end(Buffer.concat(outChunks));
      });
    });
    tallyReq.on('error', (err) => {
      setCorsHeaders(req, res);
      // This is the "Tally itself isn't reachable" case — proxy is up, but
      // Tally is closed, XML server is off, or it's on a different port.
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Could not reach Tally at http://' + TALLY_HOST + ':' + TALLY_PORT +
        ' — ' + err.message +
        '. Check: Tally is open, Gateway of Tally -> F11 -> Enable ODBC/XML Server -> Yes, port 9000, correct company loaded.');
    });
    tallyReq.write(body);
    tallyReq.end();
  });
});

server.listen(LISTEN_PORT, () => {
  console.log('tally-proxy.js listening on http://localhost:' + LISTEN_PORT);
  console.log('Forwarding every request to Tally at http://' + TALLY_HOST + ':' + TALLY_PORT);
  console.log('Leave this window open while using the Tally Direct Posting Engine.');
  console.log('Set the app\'s "Tally HTTP/XML Gateway URL" (Settings) to: http://localhost:' + LISTEN_PORT);
});
