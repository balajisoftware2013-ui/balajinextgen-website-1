// Cloudflare Pages Function -- same-origin proxy for /api/core.
// File location IS the route: functions/api/core.js -> https://<site>/api/core
// Single onRequest export only (no mixed onRequestPost + onRequest) --
// removes any ambiguity about which handler Cloudflare picks.
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec';

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed -- this proxy only accepts POST (got ' + request.method + ')', { status: 405 });
  }

  try {
    const body = await request.text();
    const gasRes = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow' // GAS /exec 302s internally to script.googleusercontent.com
    });
    const text = await gasRes.text();
    return new Response(text, {
      status: gasRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'V2_CORE proxy failed: ' + err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
