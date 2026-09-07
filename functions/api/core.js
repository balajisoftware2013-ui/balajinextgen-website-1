// Cloudflare Pages Function -- same-origin proxy for /api/core.
// File location IS the route: functions/api/core.js -> https://<site>/api/core
// Keep this deployment ID in sync with GAS_APIS_DASH.V2_CORE in
// restaurant-dashboard.html / steward-mobile.html / other frontends.
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec';

export async function onRequestPost(context) {
  try {
    const body = await context.request.text();
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow' // GAS /exec 302s internally to script.googleusercontent.com
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'V2_CORE proxy failed: ' + err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Any non-POST hitting this path gets a clear message instead of a bare 405.
export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return new Response('Method Not Allowed -- this proxy only accepts POST', { status: 405 });
}
