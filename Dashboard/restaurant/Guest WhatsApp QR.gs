/**
 * BALAJI NEXTGEN · WHATSAPP-FIRST TABLE QR  (2026-11-13)
 * ------------------------------------------------------------------------------------------------
 * Flow (same as the Zillout "Scan for menu" card):
 *   1. Table QR = https://wa.me/91<API number>?text=Hi, Send me the menu of HASHTAG SILIGURI, I am Seated on
 *      Table Number B5\n#CI-CL00010-TB5          (Growth Hub → QR & links → "WhatsApp first")
 *   2. Guest taps Send → Meta webhook → your existing #CI check-in saves mobile + WhatsApp profile name in GUEST_CRM
 *      → call BNX_WAQR_onCheckin_() → reply: logo + "You have checked in…" + [Explore our menu] button
 *      → customer-order.html?client=CL00010&table=B5&wt=<token>
 *   3. Menu page calls GET ?action=GUEST_CHECKIN&mode=WA_TOKEN&token=… → BNX_WAQR_tokenGet_() → name + number shown,
 *      no typing.
 *   4. Bill settled → BNX_WAQR_queueThanks_() → after N minutes the trigger sends "Thank you for visiting!" +
 *      [Rate Now!] → restaurant-landing.html?client=…&wt=<token>#feedback (name + number prefilled).
 *
 * WIRING (3 hooks in your existing code — see the notes at each function):
 *   A. Webhook (doPost, inbound text message), AFTER the #CI check-in is saved:
 *        var w = BNX_WAQR_onCheckin_({clientId, mobile, name, text, logoUrl, restaurantName, cfg});
 *        if (w.handled) → do NOT send your normal welcome for this message (this reply replaces it).
 *   B. doGet GUEST_CHECKIN router:  if (mode === 'WA_TOKEN') return json(BNX_WAQR_tokenGet_(e.parameter));
 *   C. Bill settle / SETTLE_BILL success:  BNX_WAQR_queueThanks_({clientId, mobile, name, billNo, tableId, logoUrl, restaurantName, cfg});
 *   Then run RUN_WAQR_1_InstallTrigger once.
 *
 * Script properties used: META_WA_TOKEN, META_WA_PHONE_ID (already set for Growth Hub),
 *   META_WA_API_VERSION (optional, default v21.0),
 *   BNX_MENU_BASE_URL  = https://your-site/folder/   (where customer-order.html + restaurant-landing.html live)
 *   BNX_MENU_BASE_URL_<CLIENTID> (optional per-client override),
 *   META_WA_THANKS_TEMPLATE (optional — approved template used when the 24-hour chat window has closed;
 *     body {{1}} = first name, one URL button whose dynamic part {{1}} = the token).
 */

var WAQR_TOKEN_TTL_S = 21600;          // 6 h (CacheService maximum) — one visit
var WAQR_QUEUE_KEY = 'WAQR_THANKS_Q';
var WAQR_DEF = {
  waCheckinText: 'You have checked in, and we are glad to have you here.',
  waMenuBtn: 'Explore our menu',
  waThanksText: 'Thank you for visiting!\n\nWe appreciate your time with us and hope you had a great experience.',
  waRateBtn: 'Rate Now!',
  waThanksDelayMin: 30
};

/* ───────── helpers ───────── */
function WAQR_prop_(k) { try { return String(PropertiesService.getScriptProperties().getProperty(k) || '').trim(); } catch (e) { return ''; } }
function WAQR_mob_(v) { var d = String(v || '').replace(/\D/g, ''); if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2); d = d.slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : ''; }
function WAQR_cfg_(cfg) {
  var c = {}, k; cfg = cfg || {};
  for (k in WAQR_DEF) c[k] = (cfg[k] !== undefined && cfg[k] !== null && String(cfg[k]).trim() !== '') ? cfg[k] : WAQR_DEF[k];
  c.waMenuBtn = String(c.waMenuBtn).slice(0, 20); c.waRateBtn = String(c.waRateBtn).slice(0, 20);
  c.waThanksDelayMin = Math.max(0, Math.min(240, Number(c.waThanksDelayMin) || 0));
  c.reviewUrl = cfg.reviewUrl || '';
  return c;
}
function WAQR_base_(clientId) {
  var b = WAQR_prop_('BNX_MENU_BASE_URL_' + clientId) || WAQR_prop_('BNX_MENU_BASE_URL');
  if (!/^https:\/\//i.test(b)) return '';
  return /\/$/.test(b) ? b : b + '/';
}
function WAQR_img_(u) {   // Google Drive share link → direct image link (WhatsApp needs a public https image)
  u = String(u || '');
  var m = u.match(/(?:\/d\/|[?&]id=)([\w-]{10,})/);
  if (m && /drive\.google|docs\.google/.test(u)) return 'https://lh3.googleusercontent.com/d/' + m[1] + '=w800';
  return /^https:\/\//i.test(u) ? u : '';
}
function WAQR_first_(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }

/* "Hi, Send me the menu of X, I am Seated on Table Number B5 \n #CI-CL00010-TB5" → {clientId, tableId} or null.
   Only messages from the WhatsApp-first QR ("Send me the menu") are handled here; the menu page's own
   "Please check me in … -D<device>" messages keep their existing WA_STATUS flow. */
function BNX_WAQR_parse_(text) {
  text = String(text || '');
  if (!/send me the menu/i.test(text)) return null;
  var m = text.match(/#CI-([A-Z0-9_]+?)-(T([A-Za-z0-9]{1,12})|C)(?:-E([A-Za-z0-9_]{1,30}))?(?:\s|$)/);
  if (!m) return null;
  return { clientId: m[1], tableId: m[3] || '', eventName: m[4] ? m[4].replace(/_/g, ' ') : '' };
}

/* ───────── token (menu link / rate link) ───────── */
function BNX_WAQR_newToken_(o) {
  var tok = 'W' + Utilities.getUuid().replace(/-/g, '').slice(0, 22);
  var rec = { c: o.clientId, m: o.mobile, n: String(o.name || '').slice(0, 60), t: String(o.tableId || ''), p: o.purpose || 'MENU', at: Date.now(), dev: '' };
  CacheService.getScriptCache().put('WAQR_' + tok, JSON.stringify(rec), WAQR_TOKEN_TTL_S);
  return tok;
}

/**
 * HOOK B — doGet: GUEST_CHECKIN&mode=WA_TOKEN&clientId=…&token=…&deviceId=…
 * The token works on the FIRST phone that opens it (bound to its deviceId) — a forwarded link shows nothing.
 * Add optional extra fields (points, crn, visitCount) from GUEST_CRM where marked if you want them on the menu.
 */
function BNX_WAQR_tokenGet_(p) {
  p = p || {};
  var out = { success: true, mode: 'WA_TOKEN', known: false };
  var tok = String(p.token || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  var cid = String(p.clientId || '').trim().toUpperCase();
  if (!tok) { out.success = false; out.error = 'No token'; return out; }
  var lock = LockService.getScriptLock(); try { lock.waitLock(5000); } catch (e) {}
  try {
    var cache = CacheService.getScriptCache(), raw = cache.get('WAQR_' + tok);
    if (!raw) { out.expired = true; return out; }
    var rec = JSON.parse(raw);
    if (cid && rec.c !== cid) return out;
    var dev = String(p.deviceId || '').slice(0, 60);
    if (rec.dev && dev && rec.dev !== dev) return out;           // opened on another phone
    if (!rec.dev && dev) { rec.dev = dev; cache.put('WAQR_' + tok, JSON.stringify(rec), WAQR_TOKEN_TTL_S); }
    out.known = true; out.mobile = rec.m; out.customerName = rec.n; out.tableId = rec.t;
    /* optional: out.points / out.crn / out.visitCount from GUEST_CRM for rec.c + rec.m */
    return out;
  } catch (e) { out.success = false; out.error = String(e.message || e); return out; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

/* ───────── Meta Cloud API send ───────── */
function WAQR_send_(payload) {
  var tok = WAQR_prop_('META_WA_TOKEN'), pid = WAQR_prop_('META_WA_PHONE_ID'), ver = WAQR_prop_('META_WA_API_VERSION') || 'v21.0';
  if (!tok || !pid) return { sent: false, error: 'META_WA_TOKEN / META_WA_PHONE_ID not set' };
  payload.messaging_product = 'whatsapp';
  var r = UrlFetchApp.fetch('https://graph.facebook.com/' + ver + '/' + pid + '/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + tok }, payload: JSON.stringify(payload)
  });
  var code = r.getResponseCode(), j = {};
  try { j = JSON.parse(r.getContentText()); } catch (e) {}
  if (code >= 200 && code < 300 && j.messages && j.messages[0]) return { sent: true, id: j.messages[0].id };
  var er = (j.error && (j.error.error_data && j.error.error_data.details || j.error.message)) || ('HTTP ' + code);
  return { sent: false, error: String(er).slice(0, 300), code: j.error && j.error.code };
}
/* interactive "cta_url" = text + one link button (+ optional image header). Free-form: allowed only inside the
   24-hour window that opens when the guest messages you — always true right after the QR message. */
function WAQR_sendCta_(mobile, imgUrl, body, footer, btn, url) {
  var inter = {
    type: 'cta_url',
    body: { text: String(body).slice(0, 1024) },
    action: { name: 'cta_url', parameters: { display_text: String(btn).slice(0, 20), url: url } }
  };
  if (imgUrl) inter.header = { type: 'image', image: { link: imgUrl } };
  if (footer) inter.footer = { text: String(footer).slice(0, 60) };
  var r = WAQR_send_({ recipient_type: 'individual', to: '91' + mobile, type: 'interactive', interactive: inter });
  if (!r.sent && imgUrl && /media|image|header|download/i.test(r.error || '')) { delete inter.header; r = WAQR_send_({ recipient_type: 'individual', to: '91' + mobile, type: 'interactive', interactive: inter }); }
  return r;
}

/**
 * HOOK A — webhook, after your #CI check-in saved the guest.
 * o = { clientId, mobile (from msg.from), name (contacts[0].profile.name or GUEST_CRM name), text (msg.text.body),
 *       logoUrl, restaurantName, cfg (Growth Hub settings object) }
 * Returns { handled:true, sent, menuUrl } for WhatsApp-first QR messages → skip your normal welcome for this message.
 */
function BNX_WAQR_onCheckin_(o) {
  o = o || {};
  var q = BNX_WAQR_parse_(o.text); if (!q) return { handled: false };
  var cid = String(o.clientId || q.clientId).trim().toUpperCase(), m = WAQR_mob_(o.mobile);
  if (!m) return { handled: false, error: 'bad mobile' };
  var base = WAQR_base_(cid);
  if (!base) return { handled: false, error: 'BNX_MENU_BASE_URL not set' };
  var c = WAQR_cfg_(o.cfg), tok = BNX_WAQR_newToken_({ clientId: cid, mobile: m, name: o.name, tableId: q.tableId, purpose: 'MENU' });
  var url = base + 'customer-order.html?client=' + encodeURIComponent(cid) + (q.tableId ? '&table=' + encodeURIComponent(q.tableId) : '')
    + (q.eventName ? '&event=' + encodeURIComponent(q.eventName) : '') + '&wt=' + tok;
  var first = WAQR_first_(o.name);
  var body = (first ? 'Hi ' + first + '! ' : '') + c.waCheckinText + (q.tableId ? '\n\nTable ' + q.tableId : '') + (o.restaurantName ? '\n\n' + String(o.restaurantName).toUpperCase() : '');
  var r = WAQR_sendCta_(m, WAQR_img_(o.logoUrl), body, 'Powered by Balaji NextGen', c.waMenuBtn, url);
  return { handled: true, sent: r.sent, error: r.error || '', menuUrl: url, tableId: q.tableId };
}

/**
 * HOOK C — bill settled. Queues the thank-you; the trigger sends it after cfg.waThanksDelayMin minutes.
 * o = { clientId, mobile, name, billNo, tableId, logoUrl, restaurantName, cfg }
 */
function BNX_WAQR_queueThanks_(o) {
  o = o || {}; var m = WAQR_mob_(o.mobile), cid = String(o.clientId || '').trim().toUpperCase();
  if (!m || !cid) return { queued: false, error: 'no mobile' };
  var c = WAQR_cfg_(o.cfg);
  var lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (e) { return { queued: false, error: 'busy' }; }
  try {
    var sp = PropertiesService.getScriptProperties(), q = [];
    try { q = JSON.parse(sp.getProperty(WAQR_QUEUE_KEY) || '[]'); } catch (e) {}
    var key = cid + '|' + m + '|' + new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);   // one thank-you per guest per day
    if (q.some(function (x) { return x.k === key; })) return { queued: false, duplicate: true };
    q.push({ k: key, c: cid, m: m, n: String(o.name || '').slice(0, 60), t: String(o.tableId || ''), b: String(o.billNo || ''),
      l: WAQR_img_(o.logoUrl), r: String(o.restaurantName || '').slice(0, 60), due: Date.now() + c.waThanksDelayMin * 60000,
      tx: c.waThanksText, bt: c.waRateBtn });
    sp.setProperty(WAQR_QUEUE_KEY, JSON.stringify(q.slice(-150)));
    return { queued: true };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* trigger (every 5 min): send due thank-you messages */
function BNX_WAQR_runThanksQueue() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    var sp = PropertiesService.getScriptProperties(), q = [];
    try { q = JSON.parse(sp.getProperty(WAQR_QUEUE_KEY) || '[]'); } catch (e) {}
    var now = Date.now(), keep = [], sent = 0;
    q.forEach(function (x) {
      if (x.done && now - x.done > 36 * 3600e3) return;                  // forget after 36 h (dedupe window)
      if (x.done || x.due > now || sent >= 40) { keep.push(x); return; }
      var r = BNX_WAQR_sendThanks_(x); sent++;
      x.done = now; x.res = r.sent ? 'SENT' : ('FAILED ' + (r.error || '')).slice(0, 120); keep.push(x);
    });
    sp.setProperty(WAQR_QUEUE_KEY, JSON.stringify(keep.slice(-150)));
  } finally { lock.releaseLock(); }
}
function BNX_WAQR_sendThanks_(x) {
  var base = WAQR_base_(x.c); if (!base) return { sent: false, error: 'BNX_MENU_BASE_URL not set' };
  var tok = BNX_WAQR_newToken_({ clientId: x.c, mobile: x.m, name: x.n, tableId: x.t, purpose: 'FEEDBACK' });
  var url = base + 'restaurant-landing.html?client=' + encodeURIComponent(x.c) + (x.t ? '&table=' + encodeURIComponent(x.t) : '') + '&wt=' + tok + '#feedback';
  var first = WAQR_first_(x.n);
  var body = (first ? 'Hi ' + first + '!\n\n' : '') + (x.tx || WAQR_DEF.waThanksText) + (x.r ? '\n\n' + String(x.r).toUpperCase() : '');
  var r = WAQR_sendCta_(x.m, x.l, body, 'Your feedback means the world to us!', x.bt || WAQR_DEF.waRateBtn, url);
  /* 24-hour window closed (Meta error 131047 / "re-engagement") → approved template, if set */
  if (!r.sent && (r.code == 131047 || /24|re-?engage/i.test(r.error || ''))) {
    var tpl = WAQR_prop_('META_WA_THANKS_TEMPLATE');
    if (tpl) r = WAQR_send_({ to: '91' + x.m, type: 'template', template: { name: tpl, language: { code: 'en' }, components: [
      { type: 'body', parameters: [{ type: 'text', text: first || 'Guest' }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: tok }] }] } });
  }
  return r;
}

/* ───────── setup / test (run from the Apps Script editor) ───────── */
function RUN_WAQR_1_InstallTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'BNX_WAQR_runThanksQueue') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('BNX_WAQR_runThanksQueue').timeBased().everyMinutes(5).create();
  Logger.log('Thank-you trigger installed (every 5 min). BNX_MENU_BASE_URL = ' + (WAQR_prop_('BNX_MENU_BASE_URL') || '(NOT SET)'));
}
/* send yourself the check-in reply: set TEST_MOBILE + TEST_CLIENT below. You must have messaged the API number in the
   last 24 h (scan your own QR once), otherwise Meta refuses free-form messages. */
function RUN_WAQR_2_TestReply() {
  var TEST_MOBILE = '', TEST_CLIENT = 'CL00010';
  Logger.log(JSON.stringify(BNX_WAQR_onCheckin_({ clientId: TEST_CLIENT, mobile: TEST_MOBILE, name: 'Test Guest',
    text: 'Hi, Send me the menu of TEST, I am Seated on Table Number B5\n#CI-' + TEST_CLIENT + '-TB5', restaurantName: 'Test' })));
}
