/**
 * BALAJI NEXTGEN · WHATSAPP WEBHOOK RELAY — Cloudflare Worker (free plan is enough)   2026-11-09
 * Use ONLY if Meta refuses the Apps Script /exec URL ("callback URL couldn't be validated") — Google answers every
 * web-app call with a 302 redirect, which some Meta checks do not follow. This worker answers Meta directly (200) and
 * forwards the same request to Apps Script.
 *
 * SETUP (5 min)
 *  1. dash.cloudflare.com › Workers & Pages › Create › Worker › name "bnx-wa-relay" › Deploy › Edit code
 *     › paste this whole file › Deploy.
 *  2. Worker › Settings › Variables:  GAS_EXEC = https://script.google.com/macros/s/AKfycbwHdq…/exec
 *     (optional) META_APP_SECRET = your Meta app secret → every POST is signature-checked (fake posts rejected)
 *  3. Apps Script › Script properties:  WA_CALLBACK_URL = https://bnx-wa-relay.<you>.workers.dev
 *     then run RUN_WA_1_AutoSetup (or paste the worker URL as Callback URL in Meta › WhatsApp › Configuration).
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const target = new URL(env.GAS_EXEC);
    url.searchParams.forEach((v, k) => target.searchParams.set(k, v));

    if (request.method === 'GET') {
      /* Meta verification: hub.mode=subscribe&hub.verify_token=…&hub.challenge=… → Apps Script checks the token */
      const r = await fetch(target.toString(), { redirect: 'follow' });
      const text = await r.text();
      const ok = url.searchParams.get('hub.mode') !== 'subscribe' || text === url.searchParams.get('hub.challenge');
      return new Response(text, { status: ok ? 200 : 403, headers: { 'Content-Type': 'text/plain' } });
    }

    if (request.method === 'POST') {
      const body = await request.text();
      if (env.META_APP_SECRET) {
        const sig = request.headers.get('x-hub-signature-256') || '';
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.META_APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
        const hex = 'sha256=' + [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
        if (sig !== hex) return new Response('bad signature', { status: 401 });
      }
      /* answer Meta at once (it retries anything slow); Apps Script gets the message in the background.
         Apps Script runs doPost on the POST itself, before its own redirect. */
      ctx.waitUntil(fetch(target.toString(), { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, redirect: 'follow' }).catch(() => {}));
      return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('ok', { status: 200 });
  }
};
