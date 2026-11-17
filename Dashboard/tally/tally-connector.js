#!/usr/bin/env node
/* Smart TallySync Pro by BALAJI NEXTGEN: local connector for TallyPrime. Node 16+, no dependencies.
 * Why: a page opened from your disk cannot always read Tally's reply (browser security). This tiny
 * program runs on your own PC, talks to Tally, and hands the full reply back to the page.
 *   Start:  double-click Start_Tally_Connector.bat   (or: node tally-connector.js)
 *   Tally:  F1 Help > Settings > Connectivity > Client/Server configuration > TallyPrime acts as: Both (port 9000),
 *           and keep the company open.
 * Listens on 127.0.0.1 only. Nothing is stored. Env: TALLY_URL (default http://localhost:9000), PORT (default 7070). */
const http = require('http');
const https = require('https');
const TALLY = new URL(process.env.TALLY_URL || 'http://localhost:9000');
const PORT = +process.env.PORT || 7070;
const LIST = '<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="List of Companies" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>Name</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>';

function getHttps(u, n = 0) {   // plain GET with up to 4 redirects (used only to read the tab names of a shared Google Sheet)
  return new Promise((resolve, reject) => {
    https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && n < 4) { res.resume(); return resolve(getHttps(new URL(res.headers.location, u).href, n + 1)); }
      const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve(Buffer.concat(c).toString('utf8')));
    }).on('error', reject);
  });
}
const dec = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function toTally(xml, ms = 30000) {
  return new Promise((resolve, reject) => {
    const r = http.request({ hostname: TALLY.hostname, port: TALLY.port || 9000, method: 'POST', timeout: ms,
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(xml) } }, res => {
      const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve(Buffer.concat(c).toString('utf8')));
    });
    r.on('timeout', () => r.destroy(new Error('Tally did not answer within ' + ms / 1000 + 's')));
    r.on('error', reject); r.end(xml);
  });
}

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  let body = ''; req.on('data', d => { body += d; if (body.length > 2e7) req.destroy(); });
  req.on('end', async () => {
    try {
      if (req.url === '/ping') {
        const t = await toTally(LIST, 8000);
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: /<ENVELOPE|<COLLECTION|<RESPONSE/.test(t), tally: TALLY.href }));
      }
      if (req.url.startsWith('/sheets')) {   // /sheets?id=<google sheet id> -> JSON list of tab names
        const id = (new URL(req.url, 'http://x').searchParams.get('id') || '').replace(/[^\w-]/g, '');
        if (!id) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('No sheet id'); }
        const html = await getHttps('https://docs.google.com/spreadsheets/d/' + id + '/htmlview');
        const names = [...html.matchAll(/<li id="sheet-button-\d+"[^>]*>[\s\S]*?<a [^>]*>([^<]+)<\/a>/g)].map(m => dec(m[1]).trim());
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify([...new Set(names)]));
      }
      if (req.url === '/raw') {            // forwards your XML to Tally and returns Tally's full reply, unchanged
        if (!body) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('No XML supplied'); }
        const t = await toTally(body);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.end(t);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Unknown route');
    } catch (e) { res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('Connector could not reach Tally: ' + e.message); }
  });
}).on('error', e => { if (e.code === 'EADDRINUSE') { console.log('Connector is already running on port ' + PORT + '. Nothing to do.'); process.exit(0); } throw e; }).listen(PORT, '127.0.0.1', () => console.log('Connector running on http://127.0.0.1:' + PORT + '  ->  Tally ' + TALLY.href + '\nKeep this window open.'));
