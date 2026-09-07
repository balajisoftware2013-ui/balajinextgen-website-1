// Cloudflare Pages Function -- same-origin proxy for /api/auth.
// File location IS the route: functions/api/auth.js -> https://<site>/api/auth
// Keep this deployment ID in sync with GAS_APIS_DASH.V2_AUTH in
// restaurant-dashboard.html / steward-mobile.html / other frontends.
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec';

export async function onRequestPost(context) {
  try {
    const body = await context.request.text();
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow'
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'V2_AUTH proxy failed: ' + err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return new Response('Method Not Allowed -- this proxy only accepts POST', { status: 405 });
}
