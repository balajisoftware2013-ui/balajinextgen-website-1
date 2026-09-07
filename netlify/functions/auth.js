// Balaji NextGen ERP — V2_AUTH Netlify proxy
// FINAL FIX:
// Google Apps Script ContentService uses a 302 from script.google.com to a
// one-time script.googleusercontent.com URL. The initial request MUST be POST,
// but the redirected one-time URL is read with GET. Replaying POST to the
// redirected URL causes HTTP 405.

const TARGET = 'https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec';

exports.handler = async (event) => {
  const incomingMethod = event.httpMethod || event.requestContext?.http?.method || 'POST';

  if (incomingMethod === 'OPTIONS') {
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

    const contentType =
      event.headers?.['content-type'] ||
      event.headers?.['Content-Type'] ||
      'text/plain;charset=utf-8';

    let url = TARGET;
    let response;
    let method = 'POST';
    let cookie = '';
    const redirects = [];

    for (let hop = 0; hop < 8; hop++) {
      const headers = {
        'Accept': 'application/json, text/plain, */*'
      };

      if (method === 'POST') headers['Content-Type'] = contentType;
      if (cookie) headers['Cookie'] = cookie;

      response = await fetch(url, {
        method,
        headers,
        ...(method === 'POST' ? { body } : {}),
        redirect: 'manual'
      });

      const location = response.headers.get('location');
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        cookie = setCookie
          .split(/,(?=[^;,]+=[^;,]+)/)
          .map(v => v.split(';')[0].trim())
          .filter(Boolean)
          .join('; ');
      }

      if (![301, 302, 303, 307, 308].includes(response.status) || !location) break;

      redirects.push({
        hop,
        status: response.status,
        from: url,
        to: new URL(location, url).toString(),
        methodBefore: method,
        methodAfter: 'GET'
      });

      url = new URL(location, url).toString();
      method = 'GET';
    }

    const text = await response.text();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'X-BNX-Upstream-Status': String(response.status),
        'X-BNX-Redirect-Hops': String(redirects.length)
      },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'V2_AUTH proxy failed: ' + String(err?.message || err)
      })
    };
  }
};
