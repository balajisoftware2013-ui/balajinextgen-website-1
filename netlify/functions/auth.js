// Balaji NextGen ERP — V2_AUTH Netlify proxy
// Preserve POST across Google Apps Script 302 redirects.

const TARGET = 'https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec';

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
      body: JSON.stringify({ success: false, error: 'V2_AUTH proxy failed: ' + String(err?.message || err) })
    };
  }
};
