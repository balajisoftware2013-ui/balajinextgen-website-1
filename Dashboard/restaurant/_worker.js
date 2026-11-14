/**
 * BALAJI NEXTGEN — Cloudflare Pages "_worker.js" (2026-11-14)
 * Put this file in the ROOT of the website folder you upload to Cloudflare Pages (next to /Dashboard).
 * It adds ONE address to the site:  https://www.balajinextgen.in/wa-webhook   (WhatsApp / Meta webhook relay)
 * Every other address is served exactly as before (env.ASSETS = your uploaded files).
 *
 * Why: Meta must get "200 + hub.challenge" straight away. An Apps Script /exec URL always answers with a redirect,
 * so Meta can never verify it. This relay answers Meta itself and forwards the messages to Apps Script.
 * Cloudflare never serves _worker.js to visitors, so the token below stays private.
 */
const BNX_GAS_EXEC = 'https://script.google.com/macros/s/AKfycbwHdqrP4IvuVD2ZkupNybrEkiXu3kmuI6-tQoiHgYxoqr1KgUupeFsi3PIoFEbuv6XA/exec';
const BNX_WA_VERIFY = 'bnxdc00f668d87542ce';   /* = Apps Script property WA_VERIFY_TOKEN */
const BNX_CLIENT = 'CL00010';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.replace(/\/+$/, '') !== '/wa-webhook') return env.ASSETS.fetch(request);

    const gas = String((env && env.GAS_EXEC_URL) || BNX_GAS_EXEC);
    const verify = String((env && env.VERIFY_TOKEN) || BNX_WA_VERIFY);
    const target = new URL(gas);
    url.searchParams.forEach((v, k) => target.searchParams.set(k, v));
    if (!target.searchParams.get('clientId')) target.searchParams.set('clientId', String((env && env.CLIENT_ID) || BNX_CLIENT));

    if (request.method === 'GET') {
      const mode = url.searchParams.get('hub.mode'), token = url.searchParams.get('hub.verify_token'), challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && challenge) {
        if (token !== verify) return new Response('Verify token mismatch', { status: 403 });
        ctx.waitUntil(fetch(target.toString(), { redirect: 'follow' }).catch(() => {}));
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
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
