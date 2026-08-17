/**
 * tally-proxy.js
 * ---------------------------------------------------------------
 * A tiny local CORS proxy that sits between your browser (running
 * tally-posting-engine.html) and Tally's built-in XML/ODBC server.
 *
 * Why you need this:
 * Tally's server (default http://localhost:9000) never sends CORS
 * headers, so browsers block fetch() calls to it. This proxy
 * forwards your requests to Tally and adds the missing headers.
 *
 * Requirements: Node.js (no npm install needed — uses only built-ins)
 *
 * Usage:
 *   1. Save this file anywhere, e.g. next to tally-posting-engine.html
 *   2. In a terminal:  node tally-proxy.js
 *   3. Leave it running. It listens on http://localhost:9001
 *   4. In tally-posting-engine.html, set the Tally URL field to:
 *        http://localhost:9001
 *      (instead of http://localhost:9000)
 *   5. Also serve the HTML over http:// instead of opening it via
 *      file://, e.g.:  python -m http.server 8080
 *      then open http://localhost:8080/tally-posting-engine.html
 *
 * Config: change PROXY_PORT / TALLY_HOST / TALLY_PORT below if needed.
 * ---------------------------------------------------------------
 */

const http = require('http');

const PROXY_PORT = 9001;      // the port this proxy listens on
const TALLY_HOST = 'localhost';
const TALLY_PORT = 9000;      // Tally's ODBC/XML server port (Gateway of Tally -> F11 -> Enable ODBC/XML server)

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  let body = [];
  req.on('data', (chunk) => body.push(chunk));
  req.on('end', () => {
    const requestBody = Buffer.concat(body);

    const tallyReq = http.request(
      {
        host: TALLY_HOST,
        port: TALLY_PORT,
        method: req.method,
        path: '/',
        headers: {
          'Content-Type': 'text/xml',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      },
      (tallyRes) => {
        let responseBody = [];
        tallyRes.on('data', (chunk) => responseBody.push(chunk));
        tallyRes.on('end', () => {
          res.writeHead(tallyRes.statusCode || 200, {
            'Content-Type': 'text/xml',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(Buffer.concat(responseBody));
        });
      }
    );

    tallyReq.on('error', (err) => {
      console.error('Could not reach Tally:', err.message);
      res.writeHead(502, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        'Proxy could not reach Tally at ' +
          TALLY_HOST +
          ':' +
          TALLY_PORT +
          '. Is Tally open, on this port, with ODBC/XML server enabled (F11)?'
      );
    });

    tallyReq.end(requestBody);
  });
});

server.listen(PROXY_PORT, () => {
  console.log('Tally CORS proxy running:');
  console.log('  Listening on : http://localhost:' + PROXY_PORT);
  console.log('  Forwarding to: http://' + TALLY_HOST + ':' + TALLY_PORT);
  console.log('');
  console.log('Set the Tally URL field in tally-posting-engine.html to:');
  console.log('  http://localhost:' + PROXY_PORT);
});
