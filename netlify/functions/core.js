// Balaji NextGen ERP — V2_CORE proxy
// IMPORTANT: never reject the browser request with 405 here.
// Netlify may expose either the legacy httpMethod field or the newer
// requestContext.http.method. Regardless of how Netlify represents it,
// this function always forwards the dashboard payload as POST to Apps Script.
exports.handler = async (event) => {
  const target = 'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec';

  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
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

    // Always POST to V2_CORE. This removes the proxy-side 405 failure mode.
    const response = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow'
    });

    const text = await response.text();
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
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
