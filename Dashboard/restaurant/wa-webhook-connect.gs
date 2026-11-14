/**
 * BALAJI NEXTGEN — WhatsApp webhook ONE-CLICK CONNECT   (2026-11-14)
 * "Webhook not verified" → run  bnxWaConnectWebhook()  once from the Apps Script editor
 * (or call action WA_WEBHOOK_CONNECT from the dashboard — Code.gs routes it here).
 *
 * What it does, with the WhatsApp token already saved in Growth Hub → Settings (no Meta screen needed):
 *   1. makes sure WA_VERIFY_TOKEN exists (creates a random one if not)
 *   2. checks the relay URL answers Meta's handshake (GET hub.challenge) — the Cloudflare Worker bnx-wa-worker.js (the website is GitHub Pages and cannot run it)
 *      on https://www.balajinextgen.in/wa-webhook  (Apps Script /exec cannot: it always redirects)
 *   3. POST graph.facebook.com/<WABA_ID>/subscribed_apps  with override_callback_uri + verify_token
 *      → Meta verifies the URL and sends this WhatsApp account's messages / delivery status there
 *   4. stores WA_WEBHOOK_URL / WA_WEBHOOK_VERIFIED_AT so Growth Hub can show it as connected
 *
 * Script properties used (client-specific first, e.g. META_WA_TOKEN_CL00010, then the plain name):
 *   META_WA_TOKEN · META_WA_WABA_ID · WA_VERIFY_TOKEN · WA_WEBHOOK_URL (default https://www.balajinextgen.in/wa-webhook)
 */
var BNX_WA_GRAPH = 'https://graph.facebook.com/v21.0/';
var BNX_WA_WEBHOOK_DEFAULT = 'https://wa.balajinextgen.in/wa-webhook';   /* 2026-11-14: Cloudflare Worker bnx-wa with custom domain wa.balajinextgen.in (balajinextgen.in is in the same Cloudflare account) */

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
    if (!vt) { vt = 'bnx' + Utilities.getUuid().replace(/-/g, '').slice(0, 20); P.setProperty('WA_VERIFY_TOKEN', vt); steps.push('Created WA_VERIFY_TOKEN'); }
    else steps.push('WA_VERIFY_TOKEN present');

    /* 2. relay answers the handshake? */
    var url = String(p.callbackUrl || bnxWaProp_(cid, 'WA_WEBHOOK_URL') || BNX_WA_WEBHOOK_DEFAULT).trim();
    if (!url) return { success: false, steps: steps, error: 'No relay address yet. Create the Cloudflare Worker (bnx-wa-worker.js) and paste its address in Growth Hub → Webhook → connect.' };
    if (!/^https:\/\//i.test(url)) return { success: false, error: 'Webhook URL must start with https://', steps: steps };
    if (/script\.google\.com/i.test(url)) return { success: false, error: 'Meta cannot verify an Apps Script /exec URL (it redirects). Deploy whatsapp-webhook-worker.js on Cloudflare and use its URL.', steps: steps };
    var ch = 'bnx' + Date.now();
    var probe;
    if (/yourname|<|>/i.test(url)) return { success: false, steps: steps, error: 'That is the EXAMPLE address (it contains "yourname"). Create your own Cloudflare Worker first and paste the address Cloudflare shows.' };
    try {
      probe = UrlFetchApp.fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 'hub.mode=subscribe&hub.verify_token=' + encodeURIComponent(vt) + '&hub.challenge=' + ch,
        { muteHttpExceptions: true, followRedirects: false });
    } catch (fe) {
      /* 2026-11-14: "DNS error" = the relay address does not exist yet (Worker not deployed / custom domain not added) */
      return { success: false, steps: steps, error: 'Relay address ' + url.replace(/\/webhook.*$/, '') + ' does not exist yet (' + String(fe.message || fe).split(':')[0] + '). ' +
        'Create the Cloudflare Worker (Workers & Pages → Create Worker → Edit code → paste bnx-wa-worker.js → Deploy) and paste the address Cloudflare shows, ending in /wa-webhook.' };
    }
    var pc = probe.getResponseCode(), pt = String(probe.getContentText() || '').trim();
    if (pc !== 200 || pt !== ch) {
      return { success: false, steps: steps, error: 'Relay ' + url + ' did not answer the handshake (HTTP ' + pc + ': ' + pt.slice(0, 80) + '). ' +
        (pc === 403 ? 'The token inside the Cloudflare Worker does not match WA_VERIFY_TOKEN — paste bnx-wa-worker.js again and Deploy.'
                    : (/yourname|<|>/i.test(url) ? 'That is the EXAMPLE address. Create your Worker first (Cloudflare → Workers & Pages → Create Worker → paste bnx-wa-worker.js → Deploy) and paste the address Cloudflare shows.'
                    : 'No Cloudflare Worker answers at this address (error 1042 = Worker not found). Create it: Cloudflare → Workers & Pages → Create Worker → Edit code → paste bnx-wa-worker.js → Deploy, then paste its own address.')) };
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
