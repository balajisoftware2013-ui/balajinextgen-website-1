/**
 * BALAJI NEXTGEN — WhatsApp (Meta Cloud API) webhook relay for Cloudflare Workers   (2026-11-14)
 *
 * WHY: Meta calls the webhook URL and needs an instant "200 + hub.challenge" answer. A Google Apps Script
 * /exec URL always answers with a 302 redirect first, and Meta does not follow redirects, so the webhook
 * can never verify ("Webhook not verified" in Growth Hub). This Worker sits on your own domain:
 *   • GET  (Meta verification): checks hub.verify_token = VERIFY_TOKEN and returns hub.challenge at once,
 *          then tells Apps Script it happened (same query string), so the hub can mark the webhook verified.
 *   • POST (incoming messages / delivery status): answers Meta 200 at once and forwards the exact JSON body
 *          to Apps Script in the background (redirect followed server-side).
 *
 * SETUP (Cloudflare dashboard → Workers & Pages → Create → Worker → paste this file → Deploy):
 *   Settings → Variables and Secrets:
 *     GAS_EXEC_URL  = https://script.google.com/macros/s/AKfycbwHdqrP4IvuVD2ZkupNybrEkiXu3kmuI6-tQoiHgYxoqr1KgUupeFsi3PIoFEbuv6XA/exec
 *     VERIFY_TOKEN  = the same text as the Apps Script property WA_VERIFY_TOKEN   (type: Secret)
 *     CLIENT_ID     = CL00010   (optional — added to the forwarded URL as ?clientId=)
 *   Settings → Domains & Routes → Add Custom Domain: wa.balajinextgen.in
 *   Meta → WhatsApp → Configuration → Webhook:
 *     Callback URL  = https://wa.balajinextgen.in/webhook
 *     Verify token  = the same VERIFY_TOKEN  → Verify and save → subscribe to "messages".
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const gas = String(env.GAS_EXEC_URL || '').trim();
    if (!gas) return new Response('GAS_EXEC_URL not set', { status: 500 });
    const target = new URL(gas);
    url.searchParams.forEach((v, k) => target.searchParams.set(k, v));
    if (env.CLIENT_ID && !target.searchParams.get('clientId')) target.searchParams.set('clientId', env.CLIENT_ID);

    if (request.method === 'GET') {
      const mode = url.searchParams.get('hub.mode'), token = url.searchParams.get('hub.verify_token'), challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && challenge) {
        if (!env.VERIFY_TOKEN || token !== env.VERIFY_TOKEN) return new Response('Verify token mismatch', { status: 403 });
        ctx.waitUntil(fetch(target.toString(), { redirect: 'follow' }).catch(() => {}));   /* let Apps Script record "verified" */
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
      return new Response('Balaji NextGen WhatsApp webhook relay — OK', { status: 200 });
    }

    if (request.method === 'POST') {
      const body = await request.text();
      ctx.waitUntil(fetch(target.toString(), { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, redirect: 'follow' }).catch(() => {}));
      return new Response('EVENT_RECEIVED', { status: 200 });
    }
    return new Response('Method not allowed', { status: 405 });
  }
};
