/**
 * BALAJI NEXTGEN · WHATSAPP-FIRST TABLE QR + ORDER + PAY  (2026-11-13)
 * ------------------------------------------------------------------------------------------------
 * Flow (same as the Zillout "Scan for menu" card):
 *   1. Table QR = https://wa.me/91<API number>?text=Hi, Send me the menu of HASHTAG SILIGURI, I am Seated on
 *      Table Number B5\n#CI-CL00010-TB5          (Growth Hub → QR & links → "WhatsApp first")
 *   2. Guest taps Send → Meta webhook → your existing #CI check-in saves mobile + WhatsApp profile name in GUEST_CRM
 *      → BNX_WAQR_onCheckin_() replies: logo + "You have checked in…" + [Explore our menu]
 *      → customer-order.html?client=CL00010&table=B5&order=1&wt=<token>
 *   3. Menu page → GUEST_CHECKIN&mode=WA_TOKEN → name + number shown, ordering on, UPI ID for paying.
 *   4. ADD → cart → Place order (your existing SAVE_ORDER) → "Pay ₹X now · UPI" → "I have paid"
 *      → GUEST_CHECKIN&mode=PAY_CLAIM → Growth Hub › Payments (staff tick Received) → WhatsApp "Payment received".
 *   5. Bill settled (or payment marked received) → thank-you + [Rate Now!] after N minutes.
 *
 * WIRING — 5 hooks in your existing code:
 *   A. Webhook (doPost, inbound text), AFTER the #CI check-in is saved:
 *        var w = BNX_WAQR_onCheckin_({clientId, mobile, name, text, logoUrl, restaurantName, cfg});
 *        if (w.handled) → do NOT send your normal welcome for this message (this reply replaces it).
 *   B. doGet GUEST_CHECKIN router (public):
 *        mode 'WA_TOKEN'  → return json(BNX_WAQR_tokenGet_(e.parameter, cfg));
 *        mode 'PAY_INFO'  → return json(BNX_WAQR_payInfo_(e.parameter, cfg));
 *        mode 'PAY_CLAIM' → return json(BNX_WAQR_payClaim_(e.parameter));
 *   C. Bill settle success:  BNX_WAQR_queueThanks_({clientId, mobile, name, billNo, tableId, logoUrl, restaurantName, cfg});
 *   D. Growth Hub POST router (inside your session check, same place as GG_RESV_LIST):
 *        'GG_PAY_CLAIMS'    → return BNX_WAQR_ggPayList_(data.clientId, data);
 *        'GG_PAY_CLAIM_SET' → return BNX_WAQR_ggPaySet_(data.clientId, data, data.userName, cfg, logoUrl, restaurantName);
 *   E. Run RUN_WAQR_1_Setup once (creates the data sheet + the 5-minute thank-you trigger).
 *   (cfg = the Growth Hub settings object of that client: upiId, upiName, reviewUrl, waCheckinText, …)
 *
 * Script properties: META_WA_TOKEN, META_WA_PHONE_ID (already set), META_WA_API_VERSION (optional, v21.0),
 *   BNX_MENU_BASE_URL = https://your-site/folder/  (+ optional BNX_MENU_BASE_URL_<CLIENTID>),
 *   META_WA_THANKS_TEMPLATE (optional: used when the 24-h chat window has closed; body {{1}} = first name,
 *   one URL button with dynamic suffix {{1}} = token), BNX_WAQR_SHEET_ID (created automatically).
 */

var WAQR_TOKEN_TTL_S = 21600;          // 6 h (CacheService maximum) — one visit
var WAQR_DEF = {
  waCheckinText: 'You have checked in, and we are glad to have you here.',
  waMenuBtn: 'Explore our menu',
  waThanksText: 'Thank you for visiting!\n\nWe appreciate your time with us and hope you had a great experience.',
  waRateBtn: 'Rate Now!',
  waThanksDelayMin: 30,
  waOrder: true
};
var WAQR_PAY_HEAD = ['CLAIM_ID', 'CREATED_AT', 'CLIENT_ID', 'MOBILE', 'NAME', 'TABLE', 'ORDER_NOS', 'AMOUNT', 'UTR', 'UPI_ID', 'STATUS', 'HANDLED_BY', 'HANDLED_AT', 'REQUEST_ID', 'DEVICE_ID'];
var WAQR_Q_HEAD = ['KEY', 'CLIENT_ID', 'MOBILE', 'NAME', 'TABLE', 'BILL_NO', 'LOGO', 'RESTAURANT', 'DUE_AT', 'TEXT', 'BTN', 'STATUS', 'RESULT', 'SENT_AT'];

/* ───────── helpers ───────── */
function WAQR_prop_(k) { try { return String(PropertiesService.getScriptProperties().getProperty(k) || '').trim(); } catch (e) { return ''; } }
function WAQR_mob_(v) { var d = String(v || '').replace(/\D/g, ''); if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2); d = d.slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : ''; }
function WAQR_cid_(v) { return String(v || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30); }
function WAQR_ist_() { return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss'); }
function WAQR_on_(v) { return !(v === false || /^(0|false|no|off)$/i.test(String(v))); }
function WAQR_cfg_(cfg) {
  var c = {}, k; cfg = cfg || {};
  for (k in WAQR_DEF) c[k] = (cfg[k] !== undefined && cfg[k] !== null && String(cfg[k]).trim() !== '') ? cfg[k] : WAQR_DEF[k];
  c.waMenuBtn = String(c.waMenuBtn).slice(0, 20); c.waRateBtn = String(c.waRateBtn).slice(0, 20);
  c.waThanksDelayMin = Math.max(0, Math.min(240, Number(c.waThanksDelayMin) || 0));
  c.waOrder = WAQR_on_(c.waOrder);
  c.upiId = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.]{1,63}$/.test(String(cfg.upiId || '').trim()) ? String(cfg.upiId).trim() : '';
  c.upiName = String(cfg.upiName || '').trim().slice(0, 50);
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
function WAQR_rs_(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }

/* data sheet (Script properties hold only 9 KB per value — too small for queues / payments) */
function WAQR_ss_() {
  var id = WAQR_prop_('BNX_WAQR_SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  var ss = SpreadsheetApp.create('Balaji NextGen · WhatsApp QR (payments + thank-you queue)');
  PropertiesService.getScriptProperties().setProperty('BNX_WAQR_SHEET_ID', ss.getId());
  return ss;
}
function WAQR_sh_(name, head) {
  var ss = WAQR_ss_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); sh.getRange('A:Z').setNumberFormat('@'); }
  return sh;
}
function WAQR_rows_(sh, head) {
  var n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, head.length).getValues().map(function (r, i) { var o = { _row: i + 2 }; head.forEach(function (h, k) { o[h] = r[k]; }); return o; });
}

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

/** HOOK B — WA_TOKEN. The token works on the FIRST phone that opens it (bound to its deviceId). */
function BNX_WAQR_tokenGet_(p, cfg) {
  p = p || {};
  var out = { success: true, mode: 'WA_TOKEN', known: false };
  var tok = String(p.token || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64), cid = WAQR_cid_(p.clientId);
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
    var c = WAQR_cfg_(cfg);
    out.known = true; out.mobile = rec.m; out.customerName = rec.n; out.tableId = rec.t;
    out.canOrder = c.waOrder; out.upiId = c.upiId; out.upiName = c.upiName;
    /* optional: out.points / out.crn / out.visitCount from GUEST_CRM for rec.c + rec.m */
    return out;
  } catch (e) { out.success = false; out.error = String(e.message || e); return out; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

/** HOOK B — PAY_INFO: the restaurant's UPI ID for the "Pay now" button. */
function BNX_WAQR_payInfo_(p, cfg) {
  var c = WAQR_cfg_(cfg);
  return { success: true, mode: 'PAY_INFO', upiId: c.upiId, upiName: c.upiName };
}

/** HOOK B — PAY_CLAIM: guest says "I have paid". Saved as CLAIMED; staff confirm in Growth Hub › Payments. */
function BNX_WAQR_payClaim_(p) {
  p = p || {};
  var cid = WAQR_cid_(p.clientId), amt = Math.round(Number(p.amount) * 100) / 100, req = String(p.requestId || '').slice(0, 120);
  var out = { success: false, mode: 'PAY_CLAIM' };
  if (!cid) { out.error = 'No restaurant'; return out; }
  if (!(amt > 0 && amt < 500000)) { out.error = 'Amount looks wrong'; return out; }
  var utr = String(p.utr || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 22);
  var lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (e) { out.error = 'Busy — try again'; return out; }
  try {
    var sh = WAQR_sh_('PAY_CLAIMS', WAQR_PAY_HEAD), rows = WAQR_rows_(sh, WAQR_PAY_HEAD);
    if (req) { var dup = rows.filter(function (r) { return r.REQUEST_ID === req && r.CLIENT_ID === cid; })[0]; if (dup) return { success: true, mode: 'PAY_CLAIM', claimId: dup.CLAIM_ID, duplicate: true }; }
    var dev = String(p.deviceId || '').slice(0, 60), since = Date.now() - 3600e3;
    var recent = rows.filter(function (r) { return r.DEVICE_ID === dev && dev && new Date(String(r.CREATED_AT).replace(' ', 'T') + '+05:30').getTime() > since; }).length;
    if (recent >= 6) { out.error = 'Too many payment notes from this phone — please tell the steward.'; return out; }
    var id = 'PAY-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'MMdd') + '-' + Utilities.getUuid().slice(0, 5).toUpperCase();
    sh.appendRow([id, WAQR_ist_(), cid, WAQR_mob_(p.mobileNo), String(p.customerName || '').slice(0, 60), String(p.tableId || '').slice(0, 12),
      String(p.orderNos || '').slice(0, 300), amt, utr, String(p.upiId || '').slice(0, 80), 'CLAIMED', '', '', req, dev]);
    return { success: true, mode: 'PAY_CLAIM', claimId: id };
  } catch (e) { out.error = String(e.message || e); return out; }
  finally { lock.releaseLock(); }
}

/** HOOK D — Growth Hub › Payments list. data: {fromDate, status} */
function BNX_WAQR_ggPayList_(clientId, data) {
  var cid = WAQR_cid_(clientId), from = String((data && data.fromDate) || '').slice(0, 10), st = String((data && data.status) || '').toUpperCase();
  var sh = WAQR_sh_('PAY_CLAIMS', WAQR_PAY_HEAD);
  var L = WAQR_rows_(sh, WAQR_PAY_HEAD).filter(function (r) { return r.CLIENT_ID === cid && (!from || String(r.CREATED_AT).slice(0, 10) >= from) && (!st || r.STATUS === st); })
    .map(function (r) { var o = {}; WAQR_PAY_HEAD.forEach(function (h) { if (h !== 'DEVICE_ID' && h !== 'REQUEST_ID') o[h] = r[h]; }); return o; }).reverse().slice(0, 500);
  return { success: true, data: L };
}
/** HOOK D — mark RECEIVED / NOT_RECEIVED. RECEIVED → WhatsApp "payment received" + queues the thank-you. */
function BNX_WAQR_ggPaySet_(clientId, data, user, cfg, logoUrl, restaurantName) {
  var cid = WAQR_cid_(clientId), id = String((data && data.claimId) || ''), st = String((data && data.status) || '').toUpperCase();
  if (!/^(RECEIVED|NOT_RECEIVED|CLAIMED)$/.test(st)) return { success: false, error: 'Bad status' };
  var lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (e) { return { success: false, error: 'Busy' }; }
  var r;
  try {
    var sh = WAQR_sh_('PAY_CLAIMS', WAQR_PAY_HEAD);
    r = WAQR_rows_(sh, WAQR_PAY_HEAD).filter(function (x) { return x.CLAIM_ID === id && x.CLIENT_ID === cid; })[0];
    if (!r) return { success: false, error: 'Payment not found' };
    var col = WAQR_PAY_HEAD.indexOf('STATUS') + 1;
    sh.getRange(r._row, col, 1, 3).setValues([[st, String(user || '').slice(0, 60), WAQR_ist_()]]);
  } finally { lock.releaseLock(); }
  var notify = { sent: false };
  var m = WAQR_mob_(r.MOBILE);
  if (m && st === 'RECEIVED') {
    notify = WAQR_send_({ to: '91' + m, type: 'text', text: { body: '✅ Payment of ' + WAQR_rs_(r.AMOUNT) + ' received' + (r.TABLE ? ' for Table ' + r.TABLE : '') + '. Thank you, ' + (WAQR_first_(r.NAME) || 'Guest') + '!' } });
    BNX_WAQR_queueThanks_({ clientId: cid, mobile: m, name: r.NAME, billNo: r.ORDER_NOS, tableId: r.TABLE, logoUrl: logoUrl, restaurantName: restaurantName, cfg: cfg });
  } else if (m && st === 'NOT_RECEIVED') {
    notify = WAQR_send_({ to: '91' + m, type: 'text', text: { body: 'We could not find your payment of ' + WAQR_rs_(r.AMOUNT) + ' yet. Please show the payment screen to our staff.' } });
  }
  return { success: true, notify: notify };
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
/* interactive "cta_url" = text + one link button (+ optional image header). Free-form: only inside the 24-hour
   window that opens when the guest messages you — always true right after the QR message. */
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

/** HOOK A — webhook, after your #CI check-in saved the guest. Returns {handled:true,…} → skip your normal welcome. */
function BNX_WAQR_onCheckin_(o) {
  o = o || {};
  var q = BNX_WAQR_parse_(o.text); if (!q) return { handled: false };
  var cid = WAQR_cid_(o.clientId || q.clientId), m = WAQR_mob_(o.mobile);
  if (!m) return { handled: false, error: 'bad mobile' };
  var base = WAQR_base_(cid);
  if (!base) return { handled: false, error: 'BNX_MENU_BASE_URL not set' };
  var c = WAQR_cfg_(o.cfg), tok = BNX_WAQR_newToken_({ clientId: cid, mobile: m, name: o.name, tableId: q.tableId, purpose: 'MENU' });
  var url = base + 'customer-order.html?client=' + encodeURIComponent(cid) + (q.tableId ? '&table=' + encodeURIComponent(q.tableId) : '')
    + (q.eventName ? '&event=' + encodeURIComponent(q.eventName) : '') + (c.waOrder ? '&order=1' : '') + '&wt=' + tok;
  var first = WAQR_first_(o.name);
  var body = (first ? 'Hi ' + first + '! ' : '') + c.waCheckinText + (q.tableId ? '\n\nTable ' + q.tableId : '')
    + (c.waOrder ? '\nOrder from your phone and pay by UPI — no waiting.' : '') + (o.restaurantName ? '\n\n' + String(o.restaurantName).toUpperCase() : '');
  var r = WAQR_sendCta_(m, WAQR_img_(o.logoUrl), body, 'Powered by Balaji NextGen', c.waMenuBtn, url);
  return { handled: true, sent: r.sent, error: r.error || '', menuUrl: url, tableId: q.tableId };
}

/** HOOK C — bill settled (also called on payment RECEIVED). One thank-you per guest per day. */
function BNX_WAQR_queueThanks_(o) {
  o = o || {}; var m = WAQR_mob_(o.mobile), cid = WAQR_cid_(o.clientId);
  if (!m || !cid) return { queued: false, error: 'no mobile' };
  var c = WAQR_cfg_(o.cfg);
  var lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (e) { return { queued: false, error: 'busy' }; }
  try {
    var sh = WAQR_sh_('THANKS_QUEUE', WAQR_Q_HEAD);
    var key = cid + '|' + m + '|' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
    var n = sh.getLastRow(), from = Math.max(2, n - 800);
    if (n >= 2 && sh.getRange(from, 1, n - from + 1, 1).getValues().some(function (r) { return r[0] === key; })) return { queued: false, duplicate: true };
    sh.appendRow([key, cid, m, String(o.name || '').slice(0, 60), String(o.tableId || ''), String(o.billNo || '').slice(0, 120), WAQR_img_(o.logoUrl),
      String(o.restaurantName || '').slice(0, 60), String(Date.now() + c.waThanksDelayMin * 60000), c.waThanksText, c.waRateBtn, 'QUEUED', '', '']);
    return { queued: true };
  } finally { lock.releaseLock(); }
}

/* trigger (every 5 min): send due thank-you messages */
function BNX_WAQR_runThanksQueue() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    var sh = WAQR_sh_('THANKS_QUEUE', WAQR_Q_HEAD), rows = WAQR_rows_(sh, WAQR_Q_HEAD), now = Date.now(), sent = 0;
    var stCol = WAQR_Q_HEAD.indexOf('STATUS') + 1;
    rows.forEach(function (x) {
      if (x.STATUS !== 'QUEUED' || Number(x.DUE_AT) > now || sent >= 40) return;
      var r = BNX_WAQR_sendThanks_({ c: x.CLIENT_ID, m: String(x.MOBILE), n: x.NAME, t: String(x.TABLE), l: x.LOGO, r: x.RESTAURANT, tx: x.TEXT, bt: x.BTN }); sent++;
      sh.getRange(x._row, stCol, 1, 3).setValues([[r.sent ? 'SENT' : 'FAILED', r.sent ? (r.id || '') : String(r.error || '').slice(0, 200), WAQR_ist_()]]);
    });
    if (sh.getLastRow() > 6000) sh.deleteRows(2, 3000);   // keep the sheet small
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
function RUN_WAQR_1_Setup() {
  WAQR_sh_('PAY_CLAIMS', WAQR_PAY_HEAD); WAQR_sh_('THANKS_QUEUE', WAQR_Q_HEAD);
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'BNX_WAQR_runThanksQueue') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('BNX_WAQR_runThanksQueue').timeBased().everyMinutes(5).create();
  Logger.log('Data sheet: https://docs.google.com/spreadsheets/d/' + WAQR_prop_('BNX_WAQR_SHEET_ID'));
  Logger.log('Thank-you trigger installed (every 5 min). BNX_MENU_BASE_URL = ' + (WAQR_prop_('BNX_MENU_BASE_URL') || '(NOT SET — set it in Project settings → Script properties)'));
}
/* send yourself the check-in reply. You must have messaged the API number in the last 24 h (scan your own QR once). */
function RUN_WAQR_2_TestReply() {
  var TEST_MOBILE = '', TEST_CLIENT = 'CL00010';
  Logger.log(JSON.stringify(BNX_WAQR_onCheckin_({ clientId: TEST_CLIENT, mobile: TEST_MOBILE, name: 'Test Guest',
    text: 'Hi, Send me the menu of TEST, I am Seated on Table Number B5\n#CI-' + TEST_CLIENT + '-TB5', restaurantName: 'Test' })));
}
