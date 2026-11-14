/**
 * BALAJI NEXTGEN — website worker (2026-11-14)
 * Runs ONLY for https://www.balajinextgen.in/wa-webhook (wrangler.jsonc → assets.run_worker_first). Every other address
 * is your normal website files, served exactly as before.
 *
 * /wa-webhook = WhatsApp (Meta) webhook relay. Meta needs an instant "200 + hub.challenge"; an Apps Script /exec URL
 * always answers with a redirect, so Meta cannot use it directly. This relay:
 *   GET  (Meta verification) → asks Apps Script (redirect followed here), returns the challenge only if Apps Script
 *        confirmed the verify token. NO token is stored in this file — it stays in Apps Script (WA_VERIFY_TOKEN).
 *   POST (guest messages / delivery ticks) → answers Meta 200 at once, forwards the exact JSON to Apps Script.
 * Same file also works as a stand-alone Cloudflare Worker (no ASSETS binding → every path is the relay).
 */
const BNX_GAS_EXEC = 'https://script.google.com/macros/s/AKfycbwHdqrP4IvuVD2ZkupNybrEkiXu3kmuI6-tQoiHgYxoqr1KgUupeFsi3PIoFEbuv6XA/exec';
const BNX_CLIENT = 'CL00010';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isHook = url.pathname.replace(/\/+$/, '') === '/wa-webhook';
    if (env && env.ASSETS && !isHook) return env.ASSETS.fetch(request);

    const target = new URL(String((env && env.GAS_EXEC_URL) || BNX_GAS_EXEC));
    url.searchParams.forEach((v, k) => target.searchParams.set(k, v));
    if (!target.searchParams.get('clientId')) target.searchParams.set('clientId', String((env && env.CLIENT_ID) || BNX_CLIENT));

    if (request.method === 'GET') {
      const mode = url.searchParams.get('hub.mode'), token = url.searchParams.get('hub.verify_token'), challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && challenge) {
        /* optional Cloudflare secret VERIFY_TOKEN: answer without asking Apps Script */
        if (env && env.VERIFY_TOKEN) {
          if (token !== env.VERIFY_TOKEN) return new Response('Verify token mismatch', { status: 403 });
          ctx.waitUntil(fetch(target.toString(), { redirect: 'follow' }).catch(() => {}));
          return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }
        try {
          const r = await fetch(target.toString(), { redirect: 'follow' });
          const t = (await r.text()).trim();
          if (t === challenge) return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
          return new Response('Verify token mismatch', { status: 403 });
        } catch (e) {
          return new Response('Apps Script not reachable', { status: 502 });
        }
      }
      return new Response('Balaji NextGen WhatsApp webhook relay — OK', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    if (request.method === 'POST') {
      const body = await request.text();
      ctx.waitUntil(fetch(target.toString(), { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, redirect: 'follow' }).catch(() => {}));
      return new Response('EVENT_RECEIVED', { status: 200 });
    }
    return new Response('Method not allowed', { status: 405 });
  }
};
