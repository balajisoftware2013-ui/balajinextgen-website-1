/**
 * BALAJI NEXTGEN — WhatsApp webhook ONE-CLICK CONNECT   (2026-11-14)
 * "Webhook not verified" → run  bnxWaConnectWebhook()  once from the Apps Script editor
 * (or call action WA_WEBHOOK_CONNECT from the dashboard — Code.gs routes it here).
 *
 * What it does, with the WhatsApp token already saved in Growth Hub → Settings (no Meta screen needed):
 *   1. makes sure WA_VERIFY_TOKEN exists (creates a random one if not)
 *   2. checks the relay URL answers Meta's handshake (GET hub.challenge) — the Cloudflare Worker bnx-wa-relay-worker.js (the website is GitHub Pages and cannot run it)
 *      on https://www.balajinextgen.in/wa-webhook  (Apps Script /exec cannot: it always redirects)
 *   3. POST graph.facebook.com/<WABA_ID>/subscribed_apps  with override_callback_uri + verify_token
 *      → Meta verifies the URL and sends this WhatsApp account's messages / delivery status there
 *   4. stores WA_WEBHOOK_URL / WA_WEBHOOK_VERIFIED_AT so Growth Hub can show it as connected
 *
 * Script properties used (client-specific first, e.g. META_WA_TOKEN_CL00010, then the plain name):
 *   META_WA_TOKEN · META_WA_WABA_ID · WA_VERIFY_TOKEN · WA_WEBHOOK_URL (default https://www.balajinextgen.in/wa-webhook)
 */
var BNX_WA_GRAPH = 'https://graph.facebook.com/v21.0/';
var BNX_WA_WEBHOOK_DEFAULT = 'https://bnx-wa.balajisoftware2013.workers.dev/wa-webhook';   /* 2026-11-14: www is GitHub Pages (cannot run code) → Cloudflare Worker bnx-wa on wa.balajinextgen.in */   /* relay inside the website (wrangler.jsonc + _worker.js); fallback below */
var BNX_WA_WEBHOOK_FALLBACKS = ['https://bnx-wa.balajisoftware2013.workers.dev/wa-webhook'];   /* 2026-11-14: Cloudflare Worker bnx-wa with custom domain wa.balajinextgen.in (balajinextgen.in is in the same Cloudflare account) */

function bnxWaProp_(cid, k) {
  var P = PropertiesService.getScriptProperties();
  return String((cid && P.getProperty(k + '_' + cid)) || P.getProperty(k) || '').trim();
}

/* Run this from the editor (select it → ▶ Run). Log shows each step. */
function bnxWaConnectWebhook() {
  var r = bnxWaWebhookConnect_('CL00010', {});
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

function bnxWaWebhookConnect_(cid, p) {
  p = p || {};
  var P = PropertiesService.getScriptProperties(), steps = [];
  try {
    var token = bnxWaProp_(cid, 'META_WA_TOKEN'), waba = bnxWaProp_(cid, 'META_WA_WABA_ID');
    if (!token) return { success: false, error: 'WhatsApp token missing — Growth Hub → Settings → WhatsApp API token', steps: steps };
    if (!waba) return { success: false, error: 'WhatsApp Business Account ID missing — set META_WA_WABA_ID (Meta → WhatsApp → API Setup)', steps: steps };

    /* 1. verify token */
    var vt = bnxWaProp_(cid, 'WA_VERIFY_TOKEN');
    /* 2026-11-14: the first token was published in a website file — replace it once (the relay no longer holds any token) */
    if (vt && !P.getProperty('WA_VERIFY_TOKEN_ROTATED_20261114')) { vt = ''; P.deleteProperty('WA_VERIFY_TOKEN'); if (cid) P.deleteProperty('WA_VERIFY_TOKEN_' + cid); P.setProperty('WA_VERIFY_TOKEN_ROTATED_20261114', new Date().toISOString()); steps.push('Old verify token replaced (it had been published)'); }
    if (!vt) { vt = 'bnx' + Utilities.getUuid().replace(/-/g, '').slice(0, 20); P.setProperty('WA_VERIFY_TOKEN', vt); steps.push('Created WA_VERIFY_TOKEN'); }
    else steps.push('WA_VERIFY_TOKEN present');

    /* 2. relay answers the handshake? */
    var cands = p.callbackUrl ? [String(p.callbackUrl).trim()] : [bnxWaProp_(cid, 'WA_WEBHOOK_URL')].concat(BNX_WA_WEBHOOK_FALLBACKS).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    if (cands.length > 1) {
      for (var ci = 0; ci < cands.length; ci++) {
        try { var c0 = 'bnx' + Date.now(), pr0 = UrlFetchApp.fetch(cands[ci] + '?hub.mode=subscribe&hub.verify_token=' + encodeURIComponent(vt) + '&hub.challenge=' + c0 + '&clientId=' + encodeURIComponent(cid), { muteHttpExceptions: true, followRedirects: false });
          if (pr0.getResponseCode() === 200 && String(pr0.getContentText()).trim() === c0) { cands = [cands[ci]]; break; } } catch (e0) {}
      }
    }
    var url = String(cands[0] || '').trim();
    if (!url) return { success: false, steps: steps, error: 'No relay address yet. Create the Cloudflare Worker (bnx-wa-relay-worker.js) and paste its address in Growth Hub → Webhook → connect.' };
    if (!/^https:\/\//i.test(url)) return { success: false, error: 'Webhook URL must start with https://', steps: steps };
    if (/script\.google\.com/i.test(url)) return { success: false, error: 'Meta cannot verify an Apps Script /exec URL (it redirects). Deploy whatsapp-webhook-worker.js on Cloudflare and use its URL.', steps: steps };
    var ch = 'bnx' + Date.now();
    var probe;
    if (/yourname|<|>/i.test(url)) return { success: false, steps: steps, error: 'That is the EXAMPLE address (it contains "yourname"). Create your own Cloudflare Worker first and paste the address Cloudflare shows.' };
    try {
      probe = UrlFetchApp.fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 'hub.mode=subscribe&hub.verify_token=' + encodeURIComponent(vt) + '&hub.challenge=' + ch + '&clientId=' + encodeURIComponent(cid),
        { muteHttpExceptions: true, followRedirects: false });
    } catch (fe) {
      /* 2026-11-14: "DNS error" = the relay address does not exist yet (Worker not deployed / custom domain not added) */
      return { success: false, steps: steps, error: 'Relay address ' + url.replace(/\/webhook.*$/, '') + ' does not exist yet (' + String(fe.message || fe).split(':')[0] + '). ' +
        'Create the Cloudflare Worker (Workers & Pages → Create Worker → Edit code → paste bnx-wa-relay-worker.js → Deploy) and paste the address Cloudflare shows, ending in /wa-webhook.' };
    }
    var pc = probe.getResponseCode(), pt = String(probe.getContentText() || '').trim();
    if (pc !== 200 || pt !== ch) {
      return { success: false, steps: steps, error: 'Relay ' + url + ' did not answer the handshake (HTTP ' + pc + ': ' + pt.slice(0, 80) + '). ' +
        (pc === 403 ? 'The token inside the Cloudflare Worker does not match WA_VERIFY_TOKEN — paste bnx-wa-relay-worker.js again and Deploy.'
                    : (/yourname|<|>/i.test(url) ? 'That is the EXAMPLE address. Create your Worker first (Cloudflare → Workers & Pages → Create Worker → paste bnx-wa-relay-worker.js → Deploy) and paste the address Cloudflare shows.'
                    : 'No Cloudflare Worker answers at this address (error 1042 = Worker not found). Create it: Cloudflare → Workers & Pages → Create Worker → Edit code → paste bnx-wa-relay-worker.js → Deploy, then paste its own address.')) };
    }
    steps.push('Relay answers the handshake ✓');

    /* 3. point this WhatsApp account's webhook at the relay (Meta verifies it now) */
    var res = UrlFetchApp.fetch(BNX_WA_GRAPH + encodeURIComponent(waba) + '/subscribed_apps', {
      method: 'post', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token },
      payload: { override_callback_uri: url, verify_token: vt }
    });
    var code = res.getResponseCode(), body = res.getContentText();
    var j = {}; try { j = JSON.parse(body); } catch (e) {}
    if (code !== 200 || j.success !== true) {
      var msg = (j.error && (j.error.error_user_msg || j.error.message)) || body.slice(0, 200);
      return { success: false, steps: steps, error: 'Meta refused (' + code + '): ' + msg +
        (/permission|scope/i.test(msg) ? ' — the token needs whatsapp_business_management permission (System User token).' : '') };
    }
    steps.push('Meta verified and subscribed the webhook ✓');

    /* 4. read back + remember */
    var chk = UrlFetchApp.fetch(BNX_WA_GRAPH + encodeURIComponent(waba) + '/subscribed_apps', { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } });
    var now = new Date().toISOString();
    P.setProperty('WA_WEBHOOK_URL' + (cid ? '_' + cid : ''), url);
    P.setProperty('WA_WEBHOOK_VERIFIED_AT' + (cid ? '_' + cid : ''), now);
    P.setProperty('WA_WEBHOOK_VERIFIED' + (cid ? '_' + cid : ''), 'YES');
    return { success: true, steps: steps, data: { callbackUrl: url, verifiedAt: now, subscribedApps: (function () { try { return JSON.parse(chk.getContentText()).data; } catch (e) { return null; } })() } };
  } catch (e) {
    return { success: false, error: String(e && e.message || e), steps: steps };
  }
}

/* WA_WEBHOOK_STATUS — Growth Hub badge: connected? when? last guest message? (no Meta call, fast) */
function bnxWaWebhookStatus_(cid) {
  var g = function (k) { return bnxWaProp_(cid, k); };
  return { success: true, data: { verified: g('WA_WEBHOOK_VERIFIED') === 'YES', verifiedAt: g('WA_WEBHOOK_VERIFIED_AT'), url: g('WA_WEBHOOK_URL'),
    lastEventAt: g('WA_WEBHOOK_LAST_AT'), tokenSet: !!g('META_WA_TOKEN'), wabaSet: !!g('META_WA_WABA_ID') } };
}

/* ============================================================================
 * ONE-CLICK "CONNECT WHATSAPP" FOR EVERY CLIENT — Meta Embedded Signup (2026-11-15)
 * Growth Hub → 🔗 Connect WhatsApp → Facebook login → pick / add the number (or "Connect your existing WhatsApp Business
 * app" = keep the phone app, Coexistence) → done. The client never sees a token, ID or Meta screen again.
 *
 * SET ONCE (Balaji NextGen, Apps Script → Project settings → Script properties):
 *   META_APP_ID            your Meta app's App ID            (developers.facebook.com → App settings → Basic)
 *   META_APP_SECRET        your Meta app's App secret        (same page — keep it ONLY here)
 *   META_ES_CONFIG_ID      Embedded Signup configuration ID (Facebook Login for Business → Configurations)
 * Saved per client after Connect: META_WA_TOKEN_<cid>, META_WA_PHONE_ID_<cid>, META_WA_WABA_ID_<cid>, WA_PROVIDER_<cid>=META
 * ========================================================================== */
function bnxWaEsConfig_(cid) {
  var P = PropertiesService.getScriptProperties(), appId = P.getProperty('META_APP_ID') || '', cfg = P.getProperty('META_ES_CONFIG_ID') || '';
  return { success: true, data: { ready: !!(appId && cfg && P.getProperty('META_APP_SECRET')), appId: appId, configId: cfg, graph: 'v21.0',
    connected: !!bnxWaProp_(cid, 'META_WA_PHONE_ID') && !!bnxWaProp_(cid, 'META_WA_TOKEN'), phoneId: bnxWaProp_(cid, 'META_WA_PHONE_ID'),
    wabaId: bnxWaProp_(cid, 'META_WA_WABA_ID'), number: bnxWaProp_(cid, 'META_WA_NUMBER'), connectedAt: bnxWaProp_(cid, 'META_WA_CONNECTED_AT') } };
}
function bnxWaEsFinish_(cid, p) {
  p = p || {};
  var P = PropertiesService.getScriptProperties(), steps = [];
  var appId = P.getProperty('META_APP_ID'), secret = P.getProperty('META_APP_SECRET');
  var code = String(p.code || ''), waba = String(p.wabaId || '').replace(/\D/g, ''), phone = String(p.phoneId || '').replace(/\D/g, '');
  var coex = /APP_ONBOARDING|COEX/i.test(String(p.event || ''));
  if (!appId || !secret) return { success: false, error: 'Balaji NextGen setup: META_APP_ID / META_APP_SECRET not set in Script properties' };
  if (!code) return { success: false, error: 'Facebook did not return a login code — press Connect WhatsApp again' };
  if (!waba || !phone) return { success: false, error: 'Facebook did not return the WhatsApp account / number — finish every step in the Facebook window' };
  try {
    /* 1. code → this client's business token */
    var tr = UrlFetchApp.fetch(BNX_WA_GRAPH + 'oauth/access_token?client_id=' + encodeURIComponent(appId) + '&client_secret=' + encodeURIComponent(secret) + '&code=' + encodeURIComponent(code), { muteHttpExceptions: true });
    var tj = {}; try { tj = JSON.parse(tr.getContentText()); } catch (e) {}
    if (!tj.access_token) return { success: false, error: 'Meta refused the login code: ' + ((tj.error && tj.error.message) || tr.getContentText().slice(0, 160)), steps: steps };
    var token = tj.access_token; steps.push('Business token received ✓');
    var H = { Authorization: 'Bearer ' + token };
    /* 2. subscribe our app to this client's WhatsApp account (messages reach the shared relay / webhook) */
    var sr = UrlFetchApp.fetch(BNX_WA_GRAPH + waba + '/subscribed_apps', { method: 'post', headers: H, muteHttpExceptions: true });
    steps.push(sr.getResponseCode() === 200 ? 'Messages subscribed ✓' : 'Subscribe: ' + sr.getContentText().slice(0, 120));
    /* 3. a NEW number must be registered for Cloud API; a Business-app number (Coexistence) stays on the phone app */
    if (!coex) {
      var pin = String(100000 + Math.floor(Math.random() * 899999));
      var rr = UrlFetchApp.fetch(BNX_WA_GRAPH + phone + '/register', { method: 'post', headers: H, contentType: 'application/json',
        payload: JSON.stringify({ messaging_product: 'whatsapp', pin: pin }), muteHttpExceptions: true });
      if (rr.getResponseCode() === 200) { steps.push('Number registered for Cloud API ✓'); P.setProperty('META_WA_PIN_' + cid, pin); }
      else steps.push('Register: ' + rr.getContentText().slice(0, 160));
    } else steps.push('Business-app number kept on the phone (Coexistence) ✓');
    /* 4. read the number + name, save everything for THIS client */
    var num = '', name = '';
    try { var nr = JSON.parse(UrlFetchApp.fetch(BNX_WA_GRAPH + phone + '?fields=display_phone_number,verified_name', { headers: H, muteHttpExceptions: true }).getContentText());
      num = nr.display_phone_number || ''; name = nr.verified_name || ''; } catch (e) {}
    var put = function (k, v) { P.setProperty(k + '_' + cid, String(v)); };
    put('META_WA_TOKEN', token); put('META_WA_PHONE_ID', phone); put('META_WA_WABA_ID', waba); put('WA_PROVIDER', 'META');
    put('META_WA_NUMBER', num); put('META_WA_NAME', name); put('META_WA_CONNECTED_AT', new Date().toISOString()); put('META_WA_COEX', coex ? 'YES' : 'NO');
    try { CacheService.getScriptCache().remove('waapi_' + cid); } catch (e) {}
    steps.push('Saved for ' + cid + (num ? ' · ' + num : '') + (name ? ' (' + name + ')' : '') + ' ✓');
    /* 5. point the webhook at the shared relay when it is live (optional — sending works without it) */
    try { var wh = bnxWaWebhookConnect_(cid, {}); steps.push(wh.success ? 'Webhook connected ✓' : 'Webhook (optional, later): ' + String(wh.error || '').slice(0, 120)); } catch (e) {}
    return { success: true, steps: steps, data: { number: num, name: name, phoneId: phone, wabaId: waba, coexistence: coex } };
  } catch (e) { return { success: false, error: String(e && e.message || e), steps: steps }; }
}
