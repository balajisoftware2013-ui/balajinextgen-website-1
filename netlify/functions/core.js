// Balaji NextGen ERP — V2_CORE Netlify proxy
// FIX: Google Apps Script web-app URLs commonly redirect POST requests
// from script.google.com to script.googleusercontent.com. A normal fetch
// with redirect:'follow' can turn that 302 POST into GET, causing HTTP 405.
// We therefore follow redirects manually and preserve POST + request body.

const TARGET = 'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec';

exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'POST';

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: ''
    };
  }

  try {
    let body = event.body || '{}';
    if (event.isBase64Encoded) body = Buffer.from(body, 'base64').toString('utf8');

    let url = TARGET;
    let response;

    for (let i = 0; i < 6; i++) {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': event.headers?.['content-type'] || event.headers?.['Content-Type'] || 'text/plain;charset=utf-8',
          'Accept': 'application/json, text/plain, */*'
        },
        body,
        redirect: 'manual'
      });

      const location = response.headers.get('location');
      if (![301, 302, 303, 307, 308].includes(response.status) || !location) break;

      url = new URL(location, url).toString();
    }

    const text = await response.text();
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'X-BNX-Upstream-Status': String(response.status)
      },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ success: false, error: 'V2_CORE proxy failed: ' + String(err?.message || err) })
    };
  }
};
