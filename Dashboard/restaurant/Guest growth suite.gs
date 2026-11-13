/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * BALAJI NEXTGEN ERP · GUEST GROWTH SUITE  v1.0  (2026-11-09)
 * Digital QR menu check-in · Feedback · WhatsApp marketing · Reservations · Event tickets · Branded landing page
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * THIS ONE FILE REPLACES FIVE PATCH FILES — DELETE THEM FROM THE APPS SCRIPT PROJECT:
 *     Guest route.gs                 (CUSTOMER_CHECKIN / GUEST_VERIFY / WA_READY)
 *     WhatsApp check-in fix.gs       (v1 2026-10-12, bnxWaInbound_, WA_STATUS)
 *     WhatsApp webhook routing.gs    (BNX_WA_DIAGNOSTICS, 2026-10-12)
 *     WhatsApp auto reply.gs         (bnxArReply_, 2026-10-16)  — would double-send, never needed
 *     Welcome / reply / SMS fix.gs   (2026-10-28) — its functions now live in customer-crm.gs (updated file)
 *   Keep: customer-crm.gs (UPDATED copy delivered with this file), Menu card qr promo.gs, WhatsApp setup check.gs.
 *
 * ROOT CAUSES FIXED
 *  1. THREE files each said "put me LAST" and each wrapped doGet/doPost. Only the outermost wrapper ran first, and the
 *     two that ran via bnxWaRoutePost_ never set WA_HOOK_SEEN / WA_HOOK_VERIFIED, so bnxWaCheckinReady_() stayed false
 *     → the green "WhatsApp — no typing" button never appeared even with Meta fully set up, and WA_HOOK_LOG stayed empty.
 *     Now ONE doGet wrapper + ONE doPost wrapper (flag __bnxGg). Meta verification and every incoming message set the flags.
 *  2. bnxGuestCfg_ was defined THREE times (customer-crm, WA fix, welcome fix) with different meaning: the newest one
 *     showed the one-tap button for TWILIO and for a webhook that was never verified (guest taps Send → nothing saved).
 *     One definition now (here): button only when Meta token + phone id + verified webhook + API number are real.
 *     The config also carries waApiNumber, and the QR page now sends the check-in to THAT number (it used the
 *     restaurant's normal WhatsApp number → message never reached the webhook).
 *  3. WA_SEND (dashboard "Server" mode, bill PDF / feedback / reservation messages) had no route → "server has no
 *     WA_SEND handler yet" on every send. Routed here (session-checked).
 *  4. The welcome-fix's one-line patches were never applied to customer-crm.gs (free_mode welcome result, WhatsApp
 *     reply with SMS fallback). Applied in the delivered customer-crm.gs.
 *  5. Duplicate bnxWaHandle_ / bnxCrmDeviceGuest_ definitions removed from customer-crm.gs — the fixed ones live here.
 *
 * NEW
 *  • FEEDBACK  — public form (QR page after order + landing page) and WhatsApp reply "1-5" to a feedback request.
 *               GUEST_FEEDBACK tab (TRANSACTION DB). Low rating → e-mail alert to the owner. 4–5★ → Google review link.
 *  • RESERVATIONS — public booking form with slot capacity (covers per slot), lead time, max party, opening hours.
 *               RESERVATION_REQUESTS tab (TRANSACTION DB). Growth Hub confirms / declines / seats; "Push to table plan"
 *               calls the dashboard's own SAVE_RESERVATION so the booking appears on the floor map + Reservations page.
 *  • EVENT TICKETS — ticket types per QR_EVENTS event (TICKET_TYPES, MASTER DB), bookings with entry code + UPI pay
 *               link (TICKET_BOOKINGS, TRANSACTION DB), sold-out check under a lock, door check-in by code.
 *  • WHATSAPP MARKETING — approved-template campaigns to guests who opted in (MARKETING_OPT_IN = YES, STOP honoured),
 *               audience filters, batch sending (hub + 5-minute trigger), per-day cap, delivery / read receipts.
 *  • LANDING PAGE data — one public call (mode LANDING): name, logo, contact, hours, events + tickets left, menu PDF,
 *               popular dishes, booking rules.
 *
 * PUBLIC (no login) — GET <exec>?action=GUEST_CHECKIN&mode=<MODE>&clientId=…   (rides the existing public route)
 *     WA_STATUS · LANDING · RESV_SLOTS · RESERVE · RESV_STATUS · RESV_CANCEL · TICKET_BOOK · TICKET_STATUS · FEEDBACK
 * STAFF (POST, clientId + sessionToken, same rule as the rest of the guest suite = bnxMpAuth_)
 *     CUSTOMER_CHECKIN · GUEST_VERIFY · WA_READY · WA_SEND · GG_* (see bnxGgHub_)
 *
 * INSTALL
 *  1. Delete the five files listed above. Replace customer-crm.gs with the delivered copy.
 *  2. Add THIS file and move it to the VERY BOTTOM of the file list (⋮ → Move file down).
 *  3. Run RUN_GG_1_CheckSetup  (authorise; every line ✅ or a plain-words fix).
 *  4. Run RUN_GG_2_InstallCampaignTrigger once (sends queued campaigns every 5 min, even with the hub closed).
 *  5. Deploy › Manage deployments › ✎ › Version: NEW VERSION › Deploy.   Open <exec>?action=BNX_WHOAMI to confirm.
 *  Optional Script properties (each may be suffixed _<clientId>):
 *     META_WA_WABA_ID            WhatsApp Business Account id (template list in the hub)
 *     META_WA_RESV_TEMPLATE      approved template, body {{1}} name {{2}} date {{3}} time {{4}} guests   (booking confirm)
 *     META_WA_TICKET_TEMPLATE    approved template, body {{1}} name {{2}} event {{3}} code {{4}} qty     (ticket confirm)
 *     WA_CAMPAIGN_DAILY_CAP      max marketing messages per client per day (default 1000)
 *     WA_HOOK_SECRET             add ?k=<secret> to the Meta callback URL (blocks fake webhook posts)
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════
 */
/* v1.1 (2026-11-13) WHATSAPP-FIRST QR · ORDER · PAY (like the Zillout "Scan for menu" card)
 *   Table QR → wa.me/91<API number>?text=Hi, Send me the menu of <REST>, I am Seated on Table Number B5 #CI-<client>-TB5
 *   → webhook saves mobile + WhatsApp name (existing #CI check-in) → reply card: logo + "You have checked in…" + [Explore our menu]
 *   → customer-order.html?client=…&table=B5&order=1&wt=<token>  (GUEST_CHECKIN&mode=WA_TOKEN → name + number, ordering on, UPI ID)
 *   → ADD → Place order (SAVE_ORDER) → "Pay ₹X · UPI" → "I have paid" (mode PAY_CLAIM → TRANSACTION DB › GUEST_PAYMENTS)
 *   → Growth Hub › Payments: Received → WhatsApp "Payment received" + thank-you queued
 *   → bill settled (CUSTOMER_CHECKIN with billNo / CRM_BILL_CAPTURE) or payment received → after N min (5-minute campaign
 *     trigger) "Thank you for visiting!" + [Rate Now!] → restaurant-landing.html?…&wt=<token>#feedback (name + number filled).
 *   Settings (Growth Hub › Settings): siteUrl (website folder), waOrder, waCheckinText, waMenuBtn, waThanksText, waRateBtn,
 *   waThanksDelayMin, upiId, upiName. Optional Script property META_WA_THANKS_TEMPLATE (24-h window closed): body {{1}} = first
 *   name, one URL button whose dynamic suffix {{1}} = token (button URL in Meta = <site>/restaurant-landing.html?wt={{1}}).
 */
var BNX_GG_BUILD = '2026-11-13-v1.1';

/* ─────────────────────────── tab layouts ─────────────────────────── */
var GG_FB_TAB = 'GUEST_FEEDBACK';
var GG_FB_HEAD = ['FEEDBACK_ID', 'CREATED_AT', 'BUSINESS_DAY', 'CLIENT_ID', 'MOBILE', 'NAME', 'CRN', 'TABLE', 'ORDER_NO', 'RATING',
  'FOOD', 'SERVICE', 'AMBIENCE', 'VALUE', 'COMMENT', 'SOURCE', 'STATUS', 'ACTION_NOTE', 'RESOLVED_BY', 'RESOLVED_AT', 'DEVICE_ID', 'EVENT'];
var GG_RV_TAB = 'RESERVATION_REQUESTS';
var GG_RV_HEAD = ['REQ_ID', 'CREATED_AT', 'CLIENT_ID', 'DATE', 'TIME', 'PAX', 'NAME', 'MOBILE', 'OCCASION', 'AREA', 'NOTE', 'STATUS',
  'TABLE', 'TABLE_NAME', 'RESV_ID', 'HANDLED_BY', 'HANDLED_AT', 'SOURCE', 'EVENT_ID', 'NOTIFY_RESULT', 'DEVICE_ID'];
var GG_TT_TAB = 'TICKET_TYPES';
var GG_TT_HEAD = ['TYPE_ID', 'CLIENT_ID', 'EVENT_ID', 'NAME', 'PRICE', 'QTY', 'MAX_PER_BOOKING', 'ACTIVE', 'SORT', 'UPDATED_AT', 'NOTE'];
var GG_TB_TAB = 'TICKET_BOOKINGS';
var GG_TB_HEAD = ['BOOKING_ID', 'CREATED_AT', 'CLIENT_ID', 'EVENT_ID', 'EVENT_TITLE', 'EVENT_DATE', 'TYPE_ID', 'TYPE_NAME', 'QTY', 'PRICE',
  'AMOUNT', 'NAME', 'MOBILE', 'CODE', 'STATUS', 'PAY_MODE', 'PAY_REF', 'PAID_AT', 'CHECKED_IN', 'CHECKED_IN_AT', 'HANDLED_BY', 'SOURCE', 'NOTIFY_RESULT'];
var GG_CP_TAB = 'WA_CAMPAIGNS';
var GG_CP_HEAD = ['CAMPAIGN_ID', 'CREATED_AT', 'CLIENT_ID', 'NAME', 'TEMPLATE', 'LANG', 'PARAMS', 'HEADER_IMAGE', 'FILTER', 'AUDIENCE',
  'QUEUED', 'SENT', 'FAILED', 'DELIVERED', 'READ', 'STATUS', 'CREATED_BY', 'STARTED_AT', 'FINISHED_AT', 'LAST_ERROR'];
var GG_CL_TAB = 'WA_CAMPAIGN_LOG';
var GG_CL_HEAD = ['CAMPAIGN_ID', 'MOBILE', 'NAME', 'CRN', 'STATUS', 'MSG_ID', 'ERROR', 'SENT_AT', 'CLIENT_ID', 'UPDATED_AT', 'META'];
var GG_PY_TAB = 'GUEST_PAYMENTS';
var GG_PY_HEAD = ['CLAIM_ID', 'CREATED_AT', 'BUSINESS_DAY', 'CLIENT_ID', 'MOBILE', 'NAME', 'TABLE', 'ORDER_NOS', 'AMOUNT', 'UTR', 'UPI_ID', 'STATUS',
  'HANDLED_BY', 'HANDLED_AT', 'REQUEST_ID', 'DEVICE_ID', 'NOTIFY_RESULT'];
var GG_TQ_TAB = 'WA_THANKS_QUEUE';
var GG_TQ_HEAD = ['KEY', 'CREATED_AT', 'CLIENT_ID', 'MOBILE', 'NAME', 'TABLE', 'BILL_NO', 'DUE_MS', 'STATUS', 'RESULT', 'SENT_AT', 'SOURCE'];
var GG_TEXT_COLS = ['CREATED_AT', 'BUSINESS_DAY', 'DATE', 'TIME', 'EVENT_DATE', 'MOBILE', 'HANDLED_AT', 'RESOLVED_AT', 'PAID_AT',
  'CHECKED_IN_AT', 'UPDATED_AT', 'STARTED_AT', 'FINISHED_AT', 'SENT_AT', 'CODE', 'ORDER_NO', 'TABLE', 'UTR', 'ORDER_NOS', 'BILL_NO', 'DUE_MS', 'KEY'];

/* ─────────────────────────── small helpers ─────────────────────────── */
function bnxGgJson_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function bnxGgIst_(fmt, d) { return Utilities.formatDate(d || new Date(), 'Asia/Kolkata', fmt || 'yyyy-MM-dd HH:mm:ss'); }
function bnxGgBizDay_(ms) { return Utilities.formatDate(new Date((ms || Date.now()) - 6 * 3600 * 1000), 'Asia/Kolkata', 'yyyy-MM-dd'); }
function bnxGgMobile_(v) { var d = String(v || '').replace(/\D/g, ''); if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2); d = d.slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : ''; }
function bnxGgName_(v) { return typeof bnxCrmClean_ === 'function' ? bnxCrmClean_(v) : String(v || '').replace(/[<>{}\[\]\\\/=|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60); }
function bnxGgTxt_(v, n) { return String(v == null ? '' : v).replace(/[<>]/g, '').replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim().slice(0, n || 200); }
function bnxGgNum_(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }
function bnxGgBool_(v, d) { if (v === undefined || v === null || v === '') return d; if (v === true || v === false) return v; return !/^(0|false|no|off|n)$/i.test(String(v).trim()); }
function bnxGgCid_(v) { var c = String(v || '').trim(); if (!/^[A-Za-z0-9_-]{3,30}$/.test(c)) throw new Error('Invalid client'); return c; }
function bnxGgId_(p) { return p + bnxGgIst_('yyMMddHHmmss') + Math.floor(Math.random() * 9000 + 1000); }
function bnxGgCode_() { var a = 'ABCDFGHJKLMNPQRSTUVWXYZ'  /* no E (Sheets reads 2E5… as a number), no I/O/0/1 */ + '23456789', s = ''; for (var i = 0; i < 6; i++) s += a.charAt(Math.floor(Math.random() * a.length)); return s; }
function bnxGgDate_(v) { var s = String(v || '').trim(); var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return s; m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : ''; }
function bnxGgTime_(v) { var m = String(v || '').trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp])[Mm])?$/); if (!m) return ''; var h = Number(m[1]), mi = Number(m[2]);
  if (m[3]) { h = h % 12 + (/p/i.test(m[3]) ? 12 : 0); } if (h > 23 || mi > 59) return ''; return ('0' + h).slice(-2) + ':' + ('0' + mi).slice(-2); }
function bnxGgMin_(t) { var p = String(t || '').split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }
function bnxGgHm_(m) { m = ((m % 1440) + 1440) % 1440; return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
function bnxGgProp_(k, cid) { var P = PropertiesService.getScriptProperties(); return typeof bnxCrmProp_ === 'function' ? bnxCrmProp_(P, k, cid) : (P.getProperty(k + '_' + cid) || P.getProperty(k) || ''); }
function bnxGgMask_(m) { m = String(m || ''); return m.length === 10 ? m.slice(0, 2) + 'xxxxx' + m.slice(7) : m; }
/* cache counter: true when the limit is reached */
function bnxGgOver_(key, max, sec) {
  var c = CacheService.getScriptCache(), n = Number(c.get(key) || 0);
  if (n >= max) return true;
  c.put(key, String(n + 1), sec); return false;
}
function bnxGgLock_(key) {
  if (typeof bnxSoftLock_ === 'function') return bnxSoftLock_('gg_' + key, 15000);
  var l = LockService.getScriptLock(); l.waitLock(20000); return { got: true, release: function () { l.releaseLock(); } };
}

/* ─────────────────────────── tabs (header-name based, never moves existing columns) ─────────────────────────── */
function bnxGgTab_(cid, kind, name, head) {
  var ss = bnxCrmSpreadsheet_(cid, kind, true), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#e7f0e9');
    sh.setFrozenRows(1);
  } else {
    var lc = Math.max(sh.getLastColumn(), 1), cur = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (x) { return String(x).trim().toUpperCase(); });
    var used = cur.length; while (used > 0 && !cur[used - 1]) used--;
    var miss = head.filter(function (h) { return cur.indexOf(h) < 0; });
    if (miss.length) sh.getRange(1, used + 1, 1, miss.length).setValues([miss]).setFontWeight('bold').setBackground('#e7f0e9');
  }
  var cache = CacheService.getScriptCache(), fk = 'ggfmt_' + ss.getId() + '_' + name;
  if (!cache.get(fk)) {                                     /* dates, times, mobiles, codes stay as typed text */
    var C = bnxCrmCols_(sh), rows = Math.max(sh.getMaxRows() - 1, 1);
    GG_TEXT_COLS.forEach(function (h) { if (C[h]) sh.getRange(2, C[h], rows, 1).setNumberFormat('@'); });
    cache.put(fk, '1', 21600);
  }
  return sh;
}
function bnxGgRows_(sh) {
  var last = sh.getLastRow(); if (last < 2) return [];
  var lc = sh.getLastColumn(), tz = (typeof bnxCrmSheetTz_ === 'function') ? bnxCrmSheetTz_(sh) : 'Asia/Kolkata';
  var v = sh.getRange(1, 1, last, lc).getValues(), H = v[0].map(function (h) { return String(h).trim().toUpperCase(); });
  var out = [];
  for (var i = 1; i < v.length; i++) {
    var o = { _row: i + 1 }, any = false;
    for (var j = 0; j < H.length; j++) { if (!H[j]) continue; var x = v[i][j];
      if (x instanceof Date) x = Utilities.formatDate(x, tz, /TIME$/.test(H[j]) && H[j] !== 'DATE_TIME' ? 'HH:mm' : (/(_AT|DATE_TIME)$/.test(H[j]) ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd'));
      if (x !== '' && x != null) any = true; o[H[j]] = x; }
    if (any) out.push(o);
  }
  return out;
}
function bnxGgAppend_(sh, obj) {
  var C = bnxCrmCols_(sh), w = Math.max(sh.getLastColumn(), 1), row = [];
  for (var i = 0; i < w; i++) row.push('');
  Object.keys(obj).forEach(function (k) { if (C[k]) row[C[k] - 1] = obj[k]; });
  sh.appendRow(row);
  return sh.getLastRow();
}
function bnxGgSet_(sh, r, obj) {
  var C = bnxCrmCols_(sh), w = Math.max(sh.getLastColumn(), 1), cur = sh.getRange(r, 1, 1, w).getValues()[0];
  Object.keys(obj).forEach(function (k) { if (C[k]) cur[C[k] - 1] = obj[k]; });
  sh.getRange(r, 1, 1, w).setValues([cur]);
}
function bnxGgFeedbackSh_(cid) { return bnxGgTab_(cid, 'TRANSACTIONS', GG_FB_TAB, GG_FB_HEAD); }
function bnxGgResvSh_(cid) { return bnxGgTab_(cid, 'TRANSACTIONS', GG_RV_TAB, GG_RV_HEAD); }
function bnxGgTypesSh_(cid) { return bnxGgTab_(cid, 'MASTER', GG_TT_TAB, GG_TT_HEAD); }
function bnxGgBookSh_(cid) { return bnxGgTab_(cid, 'TRANSACTIONS', GG_TB_TAB, GG_TB_HEAD); }
function bnxGgCampSh_(cid) { return bnxGgTab_(cid, 'TRANSACTIONS', GG_CP_TAB, GG_CP_HEAD); }
function bnxGgCampLogSh_(cid) { return bnxGgTab_(cid, 'TRANSACTIONS', GG_CL_TAB, GG_CL_HEAD); }
function bnxGgPaySh_(cid) { return bnxGgTab_(cid, 'TRANSACTIONS', GG_PY_TAB, GG_PY_HEAD); }
function bnxGgThanksSh_(cid) { return bnxGgTab_(cid, 'TRANSACTIONS', GG_TQ_TAB, GG_TQ_HEAD); }

/* ─────────────────────────── per-client settings (Script property GG_CFG_<clientId>) ─────────────────────────── */
var GG_CFG_DEFAULT = {
  resvOn: true, resvAuto: false, resvOpen: '12:00', resvClose: '23:00', slotMin: 30, slotCap: 40, dayCap: 0, maxPax: 20,
  maxDays: 60, leadMin: 60, closedDays: '', areas: 'Indoor, Outdoor, Bar, Private dining', occasions: 'Birthday, Anniversary, Date night, Business, Party',
  ticketsOn: true, ticketHoldMin: 0, upiId: '', upiName: '', fbOn: true, fbLowAlert: 3, alertEmail: '', reviewUrl: '',
  tagline: '', about: '', hours: '', instagram: '', facebook: '', mapUrl: '', coverUrl: '', brandColor: '', menuOrderOn: false,
  siteUrl: '', waOrder: true, waCheckinText: '', waMenuBtn: '', waThanksText: '', waRateBtn: '', waThanksDelayMin: 30
};
function bnxGgCfg_(cid) {
  var o = {}; try { o = JSON.parse(PropertiesService.getScriptProperties().getProperty('GG_CFG_' + cid) || '{}') || {}; } catch (e) { o = {}; }
  var out = {}; Object.keys(GG_CFG_DEFAULT).forEach(function (k) { out[k] = (o[k] === undefined || o[k] === null) ? GG_CFG_DEFAULT[k] : o[k]; });
  return out;
}
function bnxGgCfgSave_(cid, inp) {
  var cur = bnxGgCfg_(cid), num = { slotMin: [15, 240], slotCap: [1, 2000], dayCap: [0, 20000], maxPax: [1, 500], maxDays: [1, 365], leadMin: [0, 2880], ticketHoldMin: [0, 2880], fbLowAlert: [1, 5], waThanksDelayMin: [0, 240] };
  Object.keys(GG_CFG_DEFAULT).forEach(function (k) {
    if (inp[k] === undefined) return;
    var d = GG_CFG_DEFAULT[k];
    if (typeof d === 'boolean') cur[k] = bnxGgBool_(inp[k], d);
    else if (typeof d === 'number') { var n = Math.round(bnxGgNum_(inp[k], d)), r = num[k] || [0, 1e6]; cur[k] = Math.min(r[1], Math.max(r[0], n)); }
    else if (k === 'resvOpen' || k === 'resvClose') cur[k] = bnxGgTime_(inp[k]) || d;
    else if (/Url$|instagram|facebook/.test(k)) { var u = String(inp[k] || '').trim(); if (k === 'siteUrl' && u && !/\/$/.test(u)) u += '/'; cur[k] = (!u || /^https:\/\/\S+$/i.test(u)) ? u.slice(0, 400) : cur[k]; }
    else if (k === 'upiId') { var up = String(inp[k] || '').trim(); cur[k] = (!up || /^[A-Za-z0-9._-]{2,64}@[A-Za-z0-9.-]{2,64}$/.test(up)) ? up : cur[k]; }
    else if (k === 'alertEmail') { var em = String(inp[k] || '').trim(); cur[k] = (!em || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) ? em.slice(0, 120) : cur[k]; }
    else if (k === 'brandColor') { var bc = String(inp[k] || '').trim(); cur[k] = (!bc || /^#[0-9a-f]{6}$/i.test(bc)) ? bc : cur[k]; }
    else if (k === 'waMenuBtn' || k === 'waRateBtn') cur[k] = bnxGgTxt_(inp[k], 20);
    else cur[k] = bnxGgTxt_(inp[k], k === 'about' ? 1200 : /^wa.*Text$/.test(k) ? 600 : 300);
  });
  PropertiesService.getScriptProperties().setProperty('GG_CFG_' + cid, JSON.stringify(cur));
  return cur;
}

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   WHATSAPP CHECK-IN READINESS (from the 2026-10-12 fix — one definition)
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
function bnxWaJson_(o) { return bnxGgJson_(o); }
function bnxWaTen_(s) { return String(s || '').replace(/\D/g, '').slice(-10); }
function bnxWaHookAllowed_(e) {
  var want = PropertiesService.getScriptProperties().getProperty('WA_HOOK_SECRET') || '';
  return !want || String((e && e.parameter && e.parameter.k) || '') === want;
}
/* the Cloud-API number = the ONLY number whose incoming messages reach the webhook */
function bnxWaApiInfo_(cid) {
  var pr = function (k) { return bnxGgProp_(k, cid); };
  var cache = CacheService.getScriptCache(), ck = 'waapi_' + cid, hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var out = { ok: false, number: '', name: '', error: '' };
  try {
    var token = pr('META_WA_TOKEN'), pid = pr('META_WA_PHONE_ID');
    if (!token || !pid) throw new Error('META_WA_TOKEN / META_WA_PHONE_ID not set');
    var res = UrlFetchApp.fetch('https://graph.facebook.com/' + (pr('META_WA_VERSION') || 'v20.0') + '/' + encodeURIComponent(pid) + '?fields=display_phone_number,verified_name',
      { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } });
    var j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) {}
    var n = bnxWaTen_(j.display_phone_number);
    if (/^[6-9]\d{9}$/.test(n)) { out.ok = true; out.number = n; out.name = String(j.verified_name || ''); }
    else out.error = (j.error && j.error.message) || ('Meta HTTP ' + res.getResponseCode());
  } catch (e) { out.error = String(e.message || e); }
  try { cache.put(ck, JSON.stringify(out), out.ok ? 21600 : 300); } catch (e) {}
  return out;
}
function bnxWaHookSeen_() {
  var P = PropertiesService.getScriptProperties();
  return !!(P.getProperty('WA_HOOK_SEEN') || P.getProperty('WA_HOOK_VERIFIED') || String(P.getProperty('WA_CHECKIN_FORCE') || '').toUpperCase() === 'YES');
}
function bnxWaCheckinReady_(cid) {
  var pr = function (k) { return bnxGgProp_(k, cid); };
  if (String(pr('WA_PROVIDER')).toUpperCase() !== 'META' || !pr('META_WA_TOKEN') || !/^\d{8,25}$/.test(String(pr('META_WA_PHONE_ID') || '').trim())) return false;
  if (!bnxWaHookSeen_()) return false;
  return bnxWaApiInfo_(cid).ok;
}
/* THE ONLY bnxGuestCfg_ — what the QR page receives in CONFIG / SCAN */
function bnxGuestCfg_(cid) {
  var pr = function (k) { return bnxGgProp_(k, cid); };
  var key = pr('TRUECALLER_PARTNER_KEY'), ready = false, api = { number: '' };
  try { ready = bnxWaCheckinReady_(cid); if (ready) api = bnxWaApiInfo_(cid); } catch (e) {}
  var eff = 'NONE'; try { eff = typeof bnxWaEffective_ === 'function' ? bnxWaEffective_(cid) : 'NONE'; } catch (e) {}
  var gg = bnxGgCfg_(cid);
  return {
    otp: typeof bnxOtpChannel_ === 'function' ? bnxOtpChannel_(cid) !== '' : false,
    whatsapp: ready, waApi: ready, waApiNumber: ready ? api.number : '', freeMode: eff === 'NONE',
    privacyUrl: pr('PRIVACY_URL') || '',
    ctl: bnxGuestCtl_(cid), waNumber: String(pr('WA_GUEST_NUMBER') || '').replace(/\D/g, '').slice(-10),
    feedback: gg.fbOn, reservations: gg.resvOn, tickets: gg.ticketsOn, reviewUrl: gg.reviewUrl || pr('GOOGLE_REVIEW_URL') || '',
    truecaller: key ? { partnerKey: key, partnerName: pr('TRUECALLER_PARTNER_NAME') || pr('RESTAURANT_NAME') || 'Restaurant',
      privacyUrl: pr('TRUECALLER_PRIVACY_URL') || '', termsUrl: pr('TRUECALLER_TERMS_URL') || '' } : null
  };
}
/* device match by the 12-letter prefix the WhatsApp code carries (returns row + full object) */
function bnxCrmDeviceGuest_(cid, dev) {
  var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true), C = bnxCrmCols_(sh), last = sh.getLastRow();
  if (!C.LAST_DEVICE || last < 2) return null;
  var an = function (x) { return String(x || '').replace(/[^A-Za-z0-9]/g, ''); }, dn = an(dev), dp = dn.slice(0, 12);
  var d = sh.getRange(2, C.LAST_DEVICE, last - 1, 1).getValues();
  for (var i = d.length - 1; i >= 0; i--) {
    var x = an(d[i][0]); if (!x) continue;
    if (x === dn || (dp.length >= 8 && (x === dp || x.indexOf(dp) === 0 || (dn.indexOf(x) === 0 && x.length >= 8)))) {
      var o = bnxCrmRowObj_(sh, i + 2); return { mobile: String(o.MOBILE || ''), name: String(o.NAME || ''), crn: String(o.CRN || ''), row: i + 2, obj: o };
    }
  }
  return null;
}
/* WA_STATUS: did this phone's WhatsApp check-in arrive? (QR page polls ~25 s after the guest taps Send) */
function bnxWaStatus_(p) {
  var cid = String(p.clientId || '').trim(), dev = bnxDev_(p.deviceId);
  if (!dev) return { success: true, mode: 'WA_STATUS', known: false };
  var g = bnxCrmDeviceGuest_(cid, dev);
  if (!g || !g.obj) return { success: true, mode: 'WA_STATUS', known: false };
  var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true), lv = bnxCrmCellIst_(sh, g.obj.LAST_VISIT, 'yyyy-MM-dd HH:mm:ss');
  var nowMs = bnxCrmWallMs_(bnxGgIst_()), age = nowMs - bnxCrmWallMs_(lv);
  if (!(age >= -60000 && age < 20 * 60000)) return { success: true, mode: 'WA_STATUS', known: false, stale: true };
  return { success: true, mode: 'WA_STATUS', known: true, mobile: bnxWaTen_(g.obj.MOBILE), customerName: String(g.obj.NAME || ''), crn: String(g.obj.CRN || ''),
    points: Number(g.obj.POINTS || 0), visitCount: Number(g.obj.VISIT_COUNT || 1), welcomeSent: !!String(g.obj.WELCOME_SENT || '').trim() };
}

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   INCOMING WHATSAPP (webhook) — check-in, STOP/START/DELETE, feedback rating replies, delivery receipts. LOGGED.
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
function bnxWaHookLog_(entries) {
  if (!entries || !entries.length) return;
  try {
    var P = PropertiesService.getScriptProperties(), cur = []; try { cur = JSON.parse(P.getProperty('WA_HOOK_LOG') || '[]'); } catch (e) {}
    cur = entries.concat(cur).slice(0, 14);
    var txt = JSON.stringify(cur); while (txt.length > 8000 && cur.length > 1) { cur.pop(); txt = JSON.stringify(cur); }
    P.setProperty('WA_HOOK_LOG', txt);
  } catch (e) {}
}
/* "5", "4 stars", "⭐⭐⭐⭐", "5 - great food" → 1..5, else 0 */
function bnxGgRatingFromText_(t) {
  t = String(t || '').trim(); if (!t || t.length > 300) return 0;
  var m = t.match(/^([1-5])(?:\s*(?:\/\s*5|stars?|⭐+|\*+))?(?:[\s,.!:;-]+([\s\S]*))?$/i);
  if (m) return Number(m[1]);
  var s = (t.match(/⭐/g) || []).length; if (s >= 1 && s <= 5 && t.replace(/⭐|\s/g, '').length < 3) return s;
  return 0;
}
function bnxWaHandle_(body, log) {
  var n = 0, cache = CacheService.getScriptCache(), P = PropertiesService.getScriptProperties(); log = log || [];
  var ist = function () { return bnxGgIst_('MM-dd HH:mm:ss'); };
  (body.entry || []).forEach(function (en) {
    (en.changes || []).forEach(function (ch) {
      var v = ch.value || {}, phoneId = (v.metadata && v.metadata.phone_number_id) || '';
      var names = {}; (v.contacts || []).forEach(function (c) { names[c.wa_id] = c.profile && c.profile.name || ''; });
      (v.messages || []).forEach(function (m) {
        if (!m || !m.id) return;
        var text = (m.text && m.text.body) || (m.button && m.button.text) || (m.interactive && m.interactive.button_reply && m.interactive.button_reply.title) || '';
        var ent = { t: ist(), from: String(m.from || '').replace(/\d(?=\d{3})/g, 'x'), type: m.type || '', text: String(text).replace(/\s+/g, ' ').slice(0, 90), phoneId: phoneId };
        if (cache.get('wam_' + m.id)) { ent.result = 'duplicate (already handled)'; log.push(ent); return; }
        cache.put('wam_' + m.id, '1', 21600);
        try {
          var fb = bnxGgFeedbackFromWa_(m.from, names[m.from] || '', text, phoneId);
          if (fb) { n++; ent.result = 'FEEDBACK ' + fb.rating + '★ saved (' + fb.clientId + ')'; log.push(ent); return; }
          var r = bnxWaCheckinFromMessage_({ from: m.from, name: names[m.from] || '', text: text, msgId: m.id, phoneId: phoneId }, P);
          if (!r) ent.result = 'IGNORED — no valid #CI-<client>-<table> code, or sender is not an Indian mobile';
          else if (r.success === false) { ent.result = 'FAILED — ' + String(r.error || ''); cache.remove('wam_' + m.id); }
          else { n++; ent.result = r.command ? ('command ' + r.command) : ('SAVED crn=' + (r.crn || '') + ' name=' + (r.customerName || '(none)') + ' visits=' + (r.visitCount || 1) + (r.reply ? ' reply=' + String(r.reply).slice(0, 40) : ''));
            /* 2026-11-13 WhatsApp-first table QR ("Send me the menu … #CI-…") → menu card with the one-visit link */
            var qf = !r.command && bnxGgQrFirst_(text);
            if (qf) { try { var mr = bnxGgMenuReply_(qf.clientId, bnxGgMobile_(m.from), r.customerName || names[m.from] || '', qf); ent.result += ' · MENU CARD ' + (mr.sent ? 'sent' : 'FAILED ' + String(mr.error || '').slice(0, 60)); }
              catch (e) { ent.result += ' · MENU CARD ERROR ' + String(e.message || e).slice(0, 60); } } }
        } catch (e) { ent.result = 'ERROR — ' + String(e.message || e).slice(0, 160); cache.remove('wam_' + m.id); }
        log.push(ent);
      });
      (v.statuses || []).forEach(function (s) { try { bnxGgReceipt_(s); } catch (e) {} });
      if (!(v.messages || []).length && (v.statuses || []).length) log.push({ t: ist(), type: 'status', result: (v.statuses[0].status || '') + ' (delivery receipt)' });
    });
  });
  return n;
}
function bnxWaInbound_(raw) {
  var res = { ok: true, handled: 0 }, log = [], P = PropertiesService.getScriptProperties();
  try { P.setProperty('WA_HOOK_SEEN', String(Date.now())); } catch (e) {}
  try { res.handled = bnxWaHandle_(JSON.parse(raw), log); } catch (err) { res.ok = false; res.error = String(err.message || err); log.push({ t: bnxGgIst_('MM-dd HH:mm:ss'), result: 'ERROR — ' + res.error }); }
  bnxWaHookLog_(log.filter(function (x) { return x.type !== 'status'; }));
  return bnxGgJson_(res);
}
/* a guest answers a feedback request with 1–5 (request marked by WA_SEND kind=feedback, or by the hub) */
function bnxGgFeedbackFromWa_(from, waName, text, phoneId) {
  var rating = bnxGgRatingFromText_(text); if (!rating) return null;
  var mobile = bnxGgMobile_(from); if (!mobile) return null;
  var cache = CacheService.getScriptCache(), cid = cache.get('ggfb_' + mobile);
  var mapped = PropertiesService.getScriptProperties().getProperty('WA_CLIENT_' + phoneId);
  if (cid && mapped && mapped !== cid) return null;
  if (!cid && mapped && String(text).trim().length <= 40) {          /* a bare "5" to a restaurant's own number after a visit in the last 36 h */
    try { var gs = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, mapped, true), gr = bnxCrmFind_(gs, mobile, mapped);
      if (gr) { var lv = bnxCrmCellIst_(gs, bnxCrmRowObj_(gs, gr).LAST_VISIT, 'yyyy-MM-dd HH:mm:ss');
        if (lv && bnxCrmWallMs_(bnxGgIst_()) - bnxCrmWallMs_(lv) < 36 * 3600000) cid = mapped; } } catch (e) {}
  }
  if (!cid) return null;                                             /* only when we asked this number, or right after a visit */
  cache.remove('ggfb_' + mobile);
  var comment = String(text).replace(/^\s*[1-5]\s*(?:\/\s*5|stars?|⭐+|\*+)?[\s,.!:;-]*/i, '').slice(0, 500);
  var r = bnxGgFeedbackSave_(cid, { rating: rating, comment: comment, mobile: mobile, name: waName, source: 'WHATSAPP' });
  try {
    var cfg = bnxGgCfg_(cid), review = cfg.reviewUrl || bnxGgProp_('GOOGLE_REVIEW_URL', cid);
    var txt = rating >= 4 ? ('🙏 Thank you for the ' + rating + '★!' + (review ? '\nWould you share it on Google? It helps us a lot: ' + review : ''))
      : '🙏 Thank you for telling us. Our manager will look into it personally' + (comment ? '' : ' — reply with what went wrong if you like') + '.';
    if (typeof metaWaText_ === 'function' && String(bnxGgProp_('WA_PROVIDER', cid)).toUpperCase() === 'META') metaWaText_(function (k) { return bnxGgProp_(k, cid); }, mobile, txt);
  } catch (e) {}
  r.clientId = cid;
  return r;
}
/* delivery / read receipts for campaign messages */
function bnxGgReceipt_(s) {
  if (!s || !s.id || !/^(delivered|read|failed)$/.test(String(s.status))) return;
  var cache = CacheService.getScriptCache(), k = cache.get('ggmsg_' + s.id); if (!k) return;
  var p = k.split('|'), cid = p[0], camp = p[1], row = Number(p[2]); if (!cid || !row) return;
  var st = String(s.status).toUpperCase(), sh = bnxGgCampLogSh_(cid), C = bnxCrmCols_(sh);
  var cur = String(sh.getRange(row, C.STATUS).getValue()).toUpperCase();
  var rank = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 1 };
  if ((rank[st] || 0) <= (rank[cur] || 0) && st !== 'FAILED') return;
  var upd = { STATUS: st, UPDATED_AT: bnxGgIst_() };
  if (st === 'FAILED') upd.ERROR = String((s.errors && s.errors[0] && (s.errors[0].title || s.errors[0].message)) || 'failed').slice(0, 200);
  bnxGgSet_(sh, row, upd);
  if (st === 'READ') cache.remove('ggmsg_' + s.id);
  var ck = 'ggcnt_' + cid + '_' + camp + '_' + st; cache.put(ck, String(Number(cache.get(ck) || 0) + 1), 21600);
}

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   OUTGOING WHATSAPP
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
/* approved template with body variables (+ optional image header). Returns 'OK <id>' or throws. */
function bnxGgSendTemplate_(cid, mobile, tpl, lang, params, headerImage) {
  var pr = function (k) { return bnxGgProp_(k, cid); };
  var token = pr('META_WA_TOKEN'), pid = String(pr('META_WA_PHONE_ID') || '').trim();
  if (String(pr('WA_PROVIDER')).toUpperCase() !== 'META' || !token || !/^\d{8,25}$/.test(pid)) throw new Error('WhatsApp Cloud API not configured (WA_PROVIDER=META, META_WA_TOKEN, META_WA_PHONE_ID)');
  if (!/^[a-z0-9_]{1,512}$/.test(String(tpl || ''))) throw new Error('Template name missing / invalid');
  var comps = [];
  if (headerImage && /^https:\/\//i.test(headerImage)) comps.push({ type: 'header', parameters: [{ type: 'image', image: { link: headerImage } }] });
  if (params && params.length) comps.push({ type: 'body', parameters: params.map(function (v) { return { type: 'text', text: String(v == null || v === '' ? '-' : v).replace(/[\n\t]+/g, ' ').replace(/ {4,}/g, '   ').slice(0, 1000) }; }) });
  var body = { messaging_product: 'whatsapp', to: '91' + mobile, type: 'template', template: { name: tpl, language: { code: lang || pr('META_WA_LANG') || 'en' }, components: comps } };
  var res = UrlFetchApp.fetch('https://graph.facebook.com/' + (pr('META_WA_VERSION') || 'v20.0') + '/' + pid + '/messages',
    { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify(body) });
  var j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (!(j.messages && j.messages.length)) { var er = new Error((j.error && (j.error.error_user_msg || j.error.message)) || ('Meta HTTP ' + res.getResponseCode())); er.code = j.error && j.error.code; throw er; }
  return 'OK ' + j.messages[0].id;
}
/* confirmation to a guest who booked on the web (no 24 h window → needs an approved template). Never throws. */
function bnxGgNotify_(cid, mobile, tplKey, params, fallbackText) {
  var tpl = bnxGgProp_(tplKey, cid), res = { sent: false, via: '', error: '', waLink: '' };
  if (tpl) { try { var r = bnxGgSendTemplate_(cid, mobile, tpl, bnxGgProp_('META_WA_LANG', cid) || 'en', params); res.sent = true; res.via = 'TEMPLATE'; res.id = r.slice(3); } catch (e) { res.error = String(e.message || e); } }
  else res.error = tplKey + ' not set — staff can send it with one tap';
  if (!res.sent && fallbackText) res.waLink = 'https://wa.me/91' + mobile + '?text=' + encodeURIComponent(fallbackText);
  return res;
}
/* WA_SEND — dashboard "Server" mode (bill PDF / text). Token stays on the server. Session-checked by the router. */
function waSend_(p) {
  p = p || {};
  var bad = bnxMpAuth_(p); if (bad) return bad;
  var cid = String(p.clientId || '').trim(), pr = function (k) { return bnxGgProp_(k, cid); };
  var token = pr('META_WA_TOKEN') || pr('WA_TOKEN'), pid = String(pr('META_WA_PHONE_ID') || pr('WA_PHONE_ID') || '').trim();
  var ver = pr('META_WA_VERSION') || 'v20.0';
  if (!token || !/^\d{8,25}$/.test(pid)) return { success: false, error: 'WhatsApp API not configured on the server (META_WA_TOKEN / META_WA_PHONE_ID)' };
  var to = String(p.to || '').replace(/\D/g, ''); if (to.length === 10) to = '91' + to;
  if (!/^91[6-9]\d{9}$/.test(to)) return { success: false, error: 'Invalid mobile number' };
  if (bnxGgOver_('wasend_' + cid + '_' + Math.floor(Date.now() / 3600000), 600, 3700)) return { success: false, error: 'Hourly send limit reached' };
  var base = 'https://graph.facebook.com/' + ver + '/' + pid, H = { Authorization: 'Bearer ' + token }, body;
  try {
    if (p.fileBase64) {
      var bytes = Utilities.base64Decode(String(p.fileBase64));
      if (bytes.length > 8 * 1024 * 1024) return { success: false, error: 'PDF larger than 8 MB' };
      var blob = Utilities.newBlob(bytes, 'application/pdf', String(p.fileName || 'bill.pdf').replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 80));
      var up = JSON.parse(UrlFetchApp.fetch(base + '/media', { method: 'post', headers: H, muteHttpExceptions: true,
        payload: { messaging_product: 'whatsapp', type: 'application/pdf', file: blob } }).getContentText());
      if (!up.id) return { success: false, error: (up.error && up.error.message) || 'upload failed' };
      body = { messaging_product: 'whatsapp', to: to, type: 'document', document: { id: up.id, filename: blob.getName(), caption: String(p.text || '').slice(0, 900) } };
    } else body = { messaging_product: 'whatsapp', to: to, type: 'text', text: { body: String(p.text || '').slice(0, 1000) } };
    var r = UrlFetchApp.fetch(base + '/messages', { method: 'post', headers: H, contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(body) });
    var j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
    if (j.messages && j.messages.length) {
      if (/feedback/i.test(String(p.kind || ''))) CacheService.getScriptCache().put('ggfb_' + to.slice(-10), cid, 21600);   /* the guest's "1-5" reply is saved */
      return { success: true, id: j.messages[0].id };
    }
    return { success: false, error: (j.error && j.error.message) || ('Meta HTTP ' + r.getResponseCode()), code: j.error && j.error.code };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   FEEDBACK
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
function bnxGgFeedbackSave_(cid, f) {
  var rating = Math.round(bnxGgNum_(f.rating, 0));
  if (rating < 1 || rating > 5) return { success: false, error: 'Please choose 1 to 5 stars' };
  var sub = function (v) { var n = Math.round(bnxGgNum_(v, 0)); return n >= 1 && n <= 5 ? n : ''; };
  var mobile = bnxGgMobile_(f.mobile), name = bnxGgName_(f.name), crn = '';
  if (mobile) { try { var gs = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true), gr = bnxCrmFind_(gs, mobile, cid);
      if (gr) { var go = bnxCrmRowObj_(gs, gr); crn = String(go.CRN || ''); if (!name) name = String(go.NAME || ''); } } catch (e) {} }
  var id = bnxGgId_('FB'), sh = bnxGgFeedbackSh_(cid), low = rating <= bnxGgCfg_(cid).fbLowAlert;
  bnxGgAppend_(sh, { FEEDBACK_ID: id, CREATED_AT: bnxGgIst_(), BUSINESS_DAY: bnxGgBizDay_(), CLIENT_ID: cid, MOBILE: mobile, NAME: name, CRN: crn,
    TABLE: bnxGgTxt_(f.table, 20), ORDER_NO: bnxGgTxt_(f.orderNo, 40), RATING: rating, FOOD: sub(f.food), SERVICE: sub(f.service),
    AMBIENCE: sub(f.ambience), VALUE: sub(f.value), COMMENT: bnxGgTxt_(f.comment, 500), SOURCE: bnxGgTxt_(f.source || 'QR', 30),
    STATUS: low ? 'NEW' : 'OK', DEVICE_ID: bnxGgTxt_(f.deviceId, 64), EVENT: bnxGgTxt_(f.event, 60) });
  if (low) { try { bnxGgLowAlert_(cid, rating, name, mobile, f); } catch (e) { Logger.log('feedback alert: ' + e.message); } }
  var cfg = bnxGgCfg_(cid);
  return { success: true, feedbackId: id, rating: rating, reviewUrl: rating >= 4 ? (cfg.reviewUrl || bnxGgProp_('GOOGLE_REVIEW_URL', cid) || '') : '' };
}
function bnxGgLowAlert_(cid, rating, name, mobile, f) {
  var to = bnxGgCfg_(cid).alertEmail; if (!to) return;
  if (bnxGgOver_('ggalert_' + cid + '_' + bnxGgIst_('yyyyMMddHH'), 20, 3700)) return;
  var rn = bnxGgProp_('RESTAURANT_NAME', cid) || cid;
  MailApp.sendEmail(to, '⚠️ ' + rating + '★ feedback at ' + rn + (f.table ? ' · Table ' + f.table : ''),
    'Rating: ' + rating + '/5\nGuest: ' + (name || 'not given') + (mobile ? ' · ' + mobile : '') + '\nTable: ' + (f.table || '-') + '  Order: ' + (f.orderNo || '-') +
    '\nFood ' + (f.food || '-') + ' · Service ' + (f.service || '-') + ' · Ambience ' + (f.ambience || '-') + ' · Value ' + (f.value || '-') +
    '\n\n"' + String(f.comment || '').slice(0, 500) + '"\n\nResolve it in Growth Hub → Feedback.');
}

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   RESERVATIONS (online requests)
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var GG_RV_LIVE = { PENDING: 1, CONFIRMED: 1, SEATED: 1 };
function bnxGgSlotOf_(t, slotMin) { var m = bnxGgMin_(t); return bnxGgHm_(m - (m % slotMin)); }
/* slot list for a date (business hours may run past midnight, e.g. 18:00 → 02:00) */
function bnxGgSlots_(cid, date, cfg, rows) {
  cfg = cfg || bnxGgCfg_(cid);
  var open = bnxGgMin_(cfg.resvOpen), close = bnxGgMin_(cfg.resvClose); if (close <= open) close += 1440;
  rows = rows || bnxGgRows_(bnxGgResvSh_(cid));
  var used = {}, dayUsed = 0;
  rows.forEach(function (r) { if (String(r.DATE) !== date || !GG_RV_LIVE[String(r.STATUS).toUpperCase()]) return;
    var s = bnxGgSlotOf_(r.TIME, cfg.slotMin); used[s] = (used[s] || 0) + Number(r.PAX || 0); dayUsed += Number(r.PAX || 0); });
  var today = bnxGgIst_('yyyy-MM-dd'), nowMin = bnxGgMin_(bnxGgIst_('HH:mm')), out = [];
  for (var m = open; m + cfg.slotMin <= close + 0.1; m += cfg.slotMin) {
    var t = bnxGgHm_(m), late = m >= 1440;                           /* after midnight = still this business night */
    var past = date === today && !late && m < nowMin + cfg.leadMin;
    var left = Math.max(0, cfg.slotCap - (used[t] || 0));
    if (cfg.dayCap) left = Math.min(left, Math.max(0, cfg.dayCap - dayUsed));
    out.push({ time: t, left: past ? 0 : left, past: past });
  }
  return out;
}
function bnxGgResvCheck_(cid, cfg, date, time) {
  if (!cfg.resvOn) return 'Online booking is switched off — please call us';
  var today = bnxGgIst_('yyyy-MM-dd');
  if (!date || date < today) return 'Choose a date from today onward';
  var max = bnxGgIst_('yyyy-MM-dd', new Date(Date.now() + cfg.maxDays * 86400000)); if (date > max) return 'Bookings open ' + cfg.maxDays + ' days ahead';
  var dow = Utilities.formatDate(Utilities.parseDate(date + ' 12:00', 'Asia/Kolkata', 'yyyy-MM-dd HH:mm'), 'Asia/Kolkata', 'EEE').toLowerCase();
  if (String(cfg.closedDays || '').toLowerCase().split(/[\s,]+/).filter(String).some(function (d) { return d.slice(0, 3) === dow || d === date; })) return 'We are closed on that day';
  if (!time) return 'Choose a time';
  return '';
}
function bnxGgReserve_(p) {
  var cid = bnxGgCid_(p.clientId), cfg = bnxGgCfg_(cid);
  var date = bnxGgDate_(p.date), time = bnxGgTime_(p.time), pax = Math.round(bnxGgNum_(p.pax || p.covers, 0));
  var mobile = bnxGgMobile_(p.mobileNo || p.mobile), name = bnxGgName_(p.customerName || p.name);
  var bad = bnxGgResvCheck_(cid, cfg, date, time);
  if (bad) return { success: false, error: bad };
  if (pax < 1 || pax > cfg.maxPax) return { success: false, error: 'Party size must be 1 to ' + cfg.maxPax + ' — for bigger groups please call us' };
  if (!mobile) return { success: false, error: 'Enter a valid 10-digit mobile number' };
  if (!name) return { success: false, error: 'Enter your name' };
  if (bnxGgOver_('ggrv_m_' + cid + '_' + mobile + '_' + bnxGgIst_('yyyyMMdd'), 5, 90000)) return { success: false, error: 'Too many booking requests from this number today — please call us' };
  if (p.requestId) { var hit = CacheService.getScriptCache().get('ggrv_req_' + cid + '_' + String(p.requestId).slice(0, 80)); if (hit) return JSON.parse(hit); }
  var lock = bnxGgLock_('resv_' + cid);
  try {
    var sh = bnxGgResvSh_(cid), rows = bnxGgRows_(sh);
    var dup = rows.filter(function (r) { return String(r.MOBILE) === mobile && String(r.DATE) === date && GG_RV_LIVE[String(r.STATUS).toUpperCase()]; })[0];
    if (dup) return { success: true, duplicate: true, reqId: dup.REQ_ID, status: dup.STATUS, date: date, time: dup.TIME, pax: Number(dup.PAX) };
    var slot = bnxGgSlotOf_(time, cfg.slotMin), sl = bnxGgSlots_(cid, date, cfg, rows).filter(function (s) { return s.time === slot; })[0];
    if (!sl) return { success: false, error: 'That time is outside our booking hours (' + cfg.resvOpen + ' – ' + cfg.resvClose + ')' };
    if (sl.past) return { success: false, error: 'Please book at least ' + cfg.leadMin + ' minutes ahead' };
    if (sl.left < pax) return { success: false, soldOut: true, error: sl.left ? 'Only ' + sl.left + ' seats left at ' + slot + ' — try fewer guests or another time' : 'Fully booked at ' + slot + ' — please pick another time' };
    var id = bnxGgId_('RQ'), status = cfg.resvAuto ? 'CONFIRMED' : 'PENDING';
    bnxGgAppend_(sh, { REQ_ID: id, CREATED_AT: bnxGgIst_(), CLIENT_ID: cid, DATE: date, TIME: time, PAX: pax, NAME: name, MOBILE: mobile,
      OCCASION: bnxGgTxt_(p.occasion, 40), AREA: bnxGgTxt_(p.area, 40), NOTE: bnxGgTxt_(p.note, 300), STATUS: status,
      SOURCE: bnxGgTxt_(p.source || 'LANDING', 30), EVENT_ID: bnxGgTxt_(p.eventId, 40), DEVICE_ID: bnxGgTxt_(p.deviceId, 64),
      HANDLED_BY: cfg.resvAuto ? 'AUTO' : '', HANDLED_AT: cfg.resvAuto ? bnxGgIst_() : '' });
    var out = { success: true, reqId: id, status: status, date: date, time: time, pax: pax };
    if (p.requestId) CacheService.getScriptCache().put('ggrv_req_' + cid + '_' + String(p.requestId).slice(0, 80), JSON.stringify(out), 900);
    return out;
  } finally { lock.release(); }
  /* marketing consent is a separate, optional tick on the form */
}
function bnxGgResvFind_(cid, reqId) {
  var sh = bnxGgResvSh_(cid), r = bnxGgRows_(sh).filter(function (x) { return String(x.REQ_ID) === String(reqId || ''); })[0];
  return r ? { sh: sh, r: r } : null;
}
function bnxGgResvStatus_(p) {
  var cid = bnxGgCid_(p.clientId), mobile = bnxGgMobile_(p.mobileNo || p.mobile), f = bnxGgResvFind_(cid, p.reqId);
  if (!f || String(f.r.MOBILE) !== mobile) return { success: false, error: 'Booking not found' };
  return { success: true, reqId: f.r.REQ_ID, status: f.r.STATUS, date: f.r.DATE, time: f.r.TIME, pax: Number(f.r.PAX), table: f.r.TABLE_NAME || '' };
}
function bnxGgResvCancel_(p) {
  var cid = bnxGgCid_(p.clientId), mobile = bnxGgMobile_(p.mobileNo || p.mobile), lock = bnxGgLock_('resv_' + cid);
  try {
    var f = bnxGgResvFind_(cid, p.reqId);
    if (!f || String(f.r.MOBILE) !== mobile) return { success: false, error: 'Booking not found' };
    if (!/^(PENDING|CONFIRMED)$/.test(String(f.r.STATUS).toUpperCase())) return { success: false, error: 'This booking is ' + String(f.r.STATUS).toLowerCase() };
    bnxGgSet_(f.sh, f.r._row, { STATUS: 'CANCELLED', HANDLED_BY: 'GUEST', HANDLED_AT: bnxGgIst_() });
    return { success: true, reqId: f.r.REQ_ID, status: 'CANCELLED' };
  } finally { lock.release(); }
}

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   EVENT TICKETS  (events = QR_EVENTS from Menu card qr promo.gs)
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var GG_TB_LIVE = { RESERVED: 1, PAID: 1, CONFIRMED: 1, CHECKED_IN: 1 };
function bnxGgTypes_(cid, eventId) {
  return bnxGgRows_(bnxGgTypesSh_(cid)).filter(function (t) { return String(t.CLIENT_ID || cid) === cid && (!eventId || String(t.EVENT_ID) === String(eventId)); })
    .map(function (t) { return { typeId: String(t.TYPE_ID), eventId: String(t.EVENT_ID), name: String(t.NAME), price: Number(t.PRICE || 0), qty: Number(t.QTY || 0),
      maxPer: Number(t.MAX_PER_BOOKING || 10) || 10, active: bnxGgBool_(t.ACTIVE, true), sort: Number(t.SORT || 0), note: String(t.NOTE || ''), _row: t._row }; })
    .sort(function (a, b) { return a.sort - b.sort || a.price - b.price; });
}
/* expire unpaid holds (ticketHoldMin > 0) and count sold per type */
function bnxGgSold_(cid, rows, cfg) {
  var sold = {}, now = bnxGgIst_(), hold = cfg.ticketHoldMin;
  rows.forEach(function (b) {
    var st = String(b.STATUS).toUpperCase();
    if (st === 'RESERVED' && hold > 0 && Number(b.AMOUNT) > 0) {
      var age = (bnxCrmWallMs_(now) - bnxCrmWallMs_(String(b.CREATED_AT))) / 60000;
      if (age > hold) { b.STATUS = st = 'EXPIRED'; b._expire = true; }
    }
    if (GG_TB_LIVE[st]) sold[b.TYPE_ID] = (sold[b.TYPE_ID] || 0) + Number(b.QTY || 0);
  });
  return sold;
}
function bnxGgExpireWrite_(sh, rows) { rows.forEach(function (b) { if (b._expire) bnxGgSet_(sh, b._row, { STATUS: 'EXPIRED', UPDATED_AT: bnxGgIst_() }); }); }
function bnxGgEventsWithTickets_(cid, publicOnly) {
  var evs = []; try { evs = bnxQrpEvents_(cid, publicOnly).filter(function (e) { return !(typeof bnxQrpIsCfg_ === 'function' && bnxQrpIsCfg_(e)); }); } catch (e) { Logger.log('events: ' + e.message); }
  var cfg = bnxGgCfg_(cid), types = bnxGgTypes_(cid), bsh = bnxGgBookSh_(cid), rows = bnxGgRows_(bsh), sold = bnxGgSold_(cid, rows, cfg);
  return evs.map(function (e) {
    var t = types.filter(function (x) { return x.eventId === e.id && (!publicOnly || x.active); }).map(function (x) {
      var o = { typeId: x.typeId, name: x.name, price: x.price, qty: x.qty, maxPer: x.maxPer, left: Math.max(0, x.qty - (sold[x.typeId] || 0)), active: x.active, note: x.note };
      if (!publicOnly) o.sold = sold[x.typeId] || 0;
      return o; });
    var o = { id: e.id, title: e.title, date: e.date, time: e.time, venue: e.venue, description: e.description, posterImg: e.posterImg, posterThumb: e.posterThumb, videoUrl: e.videoUrl, tickets: t };
    if (!publicOnly) { o.active = e.active; o.past = e.past; }
    return o;
  });
}
function bnxGgTicketBook_(p) {
  var cid = bnxGgCid_(p.clientId), cfg = bnxGgCfg_(cid);
  if (!cfg.ticketsOn) return { success: false, error: 'Online tickets are switched off — please contact us' };
  var mobile = bnxGgMobile_(p.mobileNo || p.mobile), name = bnxGgName_(p.customerName || p.name), qty = Math.round(bnxGgNum_(p.qty, 0));
  if (!mobile) return { success: false, error: 'Enter a valid 10-digit mobile number' };
  if (!name) return { success: false, error: 'Enter your name' };
  if (bnxGgOver_('ggtb_m_' + cid + '_' + mobile + '_' + bnxGgIst_('yyyyMMdd'), 8, 90000)) return { success: false, error: 'Too many bookings from this number today — please contact us' };
  if (p.requestId) { var hit = CacheService.getScriptCache().get('ggtb_req_' + cid + '_' + String(p.requestId).slice(0, 80)); if (hit) return JSON.parse(hit); }
  var ev = bnxQrpEvents_(cid, true).filter(function (e) { return e.id === String(p.eventId || '') && !(typeof bnxQrpIsCfg_ === 'function' && bnxQrpIsCfg_(e)); })[0];
  if (!ev) return { success: false, error: 'This event is no longer open for booking' };
  var type = bnxGgTypes_(cid, ev.id).filter(function (t) { return t.typeId === String(p.typeId || '') && t.active; })[0];
  if (!type) return { success: false, error: 'Ticket type not available' };
  if (qty < 1 || qty > type.maxPer) return { success: false, error: 'Choose 1 to ' + type.maxPer + ' tickets' };
  var lock = bnxGgLock_('tix_' + cid);
  try {
    var sh = bnxGgBookSh_(cid), rows = bnxGgRows_(sh), sold = bnxGgSold_(cid, rows, cfg); bnxGgExpireWrite_(sh, rows);
    var left = Math.max(0, type.qty - (sold[type.typeId] || 0));
    if (left < qty) return { success: false, soldOut: true, left: left, error: left ? 'Only ' + left + ' left' : 'Sold out' };
    var code, used = {}; rows.forEach(function (b) { used[b.CODE] = 1; }); do { code = bnxGgCode_(); } while (used[code]);
    var amount = Math.round(type.price * qty * 100) / 100, free = amount <= 0;
    var id = bnxGgId_('TB');
    bnxGgAppend_(sh, { BOOKING_ID: id, CREATED_AT: bnxGgIst_(), CLIENT_ID: cid, EVENT_ID: ev.id, EVENT_TITLE: ev.title, EVENT_DATE: ev.date,
      TYPE_ID: type.typeId, TYPE_NAME: type.name, QTY: qty, PRICE: type.price, AMOUNT: amount, NAME: name, MOBILE: mobile, CODE: code,
      STATUS: free ? 'CONFIRMED' : 'RESERVED', PAY_MODE: free ? 'FREE' : '', SOURCE: bnxGgTxt_(p.source || 'LANDING', 30) });
    var out = { success: true, bookingId: id, code: code, status: free ? 'CONFIRMED' : 'RESERVED', amount: amount, qty: qty, event: ev.title, date: ev.date, time: ev.time, type: type.name,
      holdMin: free ? 0 : cfg.ticketHoldMin };
    if (!free && cfg.upiId) out.upiLink = 'upi://pay?pa=' + encodeURIComponent(cfg.upiId) + '&pn=' + encodeURIComponent(cfg.upiName || bnxGgProp_('RESTAURANT_NAME', cid) || 'Restaurant') +
      '&am=' + amount.toFixed(2) + '&cu=INR&tn=' + encodeURIComponent('Ticket ' + code);
    if (p.requestId) CacheService.getScriptCache().put('ggtb_req_' + cid + '_' + String(p.requestId).slice(0, 80), JSON.stringify(out), 900);
    return out;
  } finally { lock.release(); }
}
function bnxGgTicketStatus_(p) {
  var cid = bnxGgCid_(p.clientId), mobile = bnxGgMobile_(p.mobileNo || p.mobile), code = String(p.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  var b = bnxGgRows_(bnxGgBookSh_(cid)).filter(function (x) { return String(x.CODE) === code && String(x.MOBILE) === mobile; })[0];
  if (!b) return { success: false, error: 'Ticket not found' };
  return { success: true, code: b.CODE, status: b.STATUS, event: b.EVENT_TITLE, date: b.EVENT_DATE, type: b.TYPE_NAME, qty: Number(b.QTY), amount: Number(b.AMOUNT), checkedIn: !!String(b.CHECKED_IN_AT || '') };
}

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   WHATSAPP-FIRST QR · MENU CARD · ORDER + PAY · THANK-YOU  (2026-11-13)
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
/* "Hi, Send me the menu of X, I am Seated on Table Number B5 \n #CI-CL00010-TB5" → {clientId, tableId, eventName} or null.
   The menu page's own "Please check me in … -D<device>" message keeps the WA_STATUS flow (no card). */
function bnxGgQrFirst_(text) {
  text = String(text || '');
  if (!/send me the menu/i.test(text)) return null;
  /* also the menu page's own code: #CI-<client>-T5[-P<party>][-E<event>][-D<device>] (2026-11-13 direct WhatsApp, no form) */
  var m = text.match(/#CI-([A-Za-z0-9_]+?)-(T([A-Za-z0-9]{1,12})|C)(?:-P[A-Za-z0-9_]{1,30})?(?:-E([A-Za-z0-9_]{1,30}))?(?:-D[A-Za-z0-9]{4,20})?(?:\s|$)/);
  if (!m) return null;
  try { return { clientId: bnxGgCid_(m[1]), tableId: m[3] || '', eventName: m[4] ? m[4].replace(/_/g, ' ') : '' }; } catch (e) { return null; }
}
function bnxGgSite_(cid) { var u = bnxGgCfg_(cid).siteUrl || bnxGgProp_('BNX_MENU_BASE_URL', cid) || ''; if (!/^https:\/\//i.test(u)) return ''; return /\/$/.test(u) ? u : u + '/'; }
function bnxGgBrand_(cid) {
  var i = {}; try { i = bnxGgLanding_(cid).info || {}; } catch (e) {}
  var u = String(i.logoUrl || ''), m = u.match(/(?:\/d\/|[?&]id=)([\w-]{10,})/);
  if (m && /drive\.google|docs\.google/.test(u)) u = 'https://lh3.googleusercontent.com/d/' + m[1] + '=w800';
  return { name: String(i.name || bnxGgProp_('RESTAURANT_NAME', cid) || ''), logo: /^https:\/\//i.test(u) ? u : '' };
}
function bnxGgFirst_(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
function bnxGgRs_(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
/* one-visit token: menu link / rate link. Bound to the FIRST phone that opens it (a forwarded link shows nothing). */
function bnxGgTokNew_(cid, mobile, name, table, purpose) {
  var tok = 'W' + Utilities.getUuid().replace(/-/g, '').slice(0, 22);
  CacheService.getScriptCache().put('ggtok_' + tok, JSON.stringify({ c: cid, m: mobile, n: bnxGgName_(name), t: String(table || ''), p: purpose || 'MENU', dev: '' }), 21600);
  return tok;
}
function bnxGgTokGet_(p) {
  var cid = bnxGgCid_(p.clientId), tok = String(p.token || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64), out = { success: true, known: false };
  if (!tok) return { success: false, error: 'No token' };
  var lock = bnxGgLock_('tok_' + cid);
  try {
    var cache = CacheService.getScriptCache(), raw = cache.get('ggtok_' + tok);
    if (!raw) { out.expired = true; return out; }
    var rec = JSON.parse(raw), dev = bnxDev_(p.deviceId);
    if (rec.c !== cid) return out;
    if (rec.dev && dev && rec.dev !== dev) return out;
    if (!rec.dev && dev) { rec.dev = dev; cache.put('ggtok_' + tok, JSON.stringify(rec), 21600); }
    var cfg = bnxGgCfg_(cid);
    out.known = true; out.mobile = rec.m; out.customerName = rec.n; out.tableId = rec.t;
    out.canOrder = !!cfg.waOrder; out.upiId = cfg.upiId || ''; out.upiName = cfg.upiName || bnxGgProp_('RESTAURANT_NAME', cid) || '';
    try { var gs = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true), gr = bnxCrmFind_(gs, rec.m, cid);
      if (gr) { var go = bnxCrmRowObj_(gs, gr); out.crn = String(go.CRN || ''); out.points = Number(go.POINTS || 0); out.visitCount = Number(go.VISIT_COUNT || 1); if (!out.customerName) out.customerName = String(go.NAME || ''); } } catch (e) {}
    return out;
  } finally { lock.release(); }
}
/* Cloud-API send (any message object). Free-form = only inside the 24-h window the guest opened by messaging. */
function bnxGgWaSend_(cid, mobile, msg) {
  var pr = function (k) { return bnxGgProp_(k, cid); }, token = pr('META_WA_TOKEN'), pid = String(pr('META_WA_PHONE_ID') || '').trim();
  if (String(pr('WA_PROVIDER')).toUpperCase() !== 'META' || !token || !/^\d{8,25}$/.test(pid)) return { sent: false, error: 'WhatsApp Cloud API not configured' };
  msg.messaging_product = 'whatsapp'; msg.recipient_type = 'individual'; msg.to = '91' + mobile;
  var res = UrlFetchApp.fetch('https://graph.facebook.com/' + (pr('META_WA_VERSION') || 'v20.0') + '/' + pid + '/messages',
    { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify(msg) });
  var j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (j.messages && j.messages.length) return { sent: true, id: j.messages[0].id };
  return { sent: false, error: String((j.error && (j.error.error_data && j.error.error_data.details || j.error.error_user_msg || j.error.message)) || ('Meta HTTP ' + res.getResponseCode())).slice(0, 300), code: j.error && j.error.code };
}
/* text + one link button (+ logo header). A logo WhatsApp cannot fetch → sent again without it. */
function bnxGgCta_(cid, mobile, img, body, footer, btn, url) {
  var it = { type: 'cta_url', body: { text: String(body).slice(0, 1024) }, action: { name: 'cta_url', parameters: { display_text: String(btn).slice(0, 20), url: url } } };
  if (footer) it.footer = { text: String(footer).slice(0, 60) };
  if (img) it.header = { type: 'image', image: { link: img } };
  var r = bnxGgWaSend_(cid, mobile, { type: 'interactive', interactive: it });
  if (!r.sent && it.header && /media|image|header|download|url/i.test(r.error || '')) { delete it.header; r = bnxGgWaSend_(cid, mobile, { type: 'interactive', interactive: it }); }
  return r;
}
function bnxGgMenuReply_(cid, mobile, name, q) {
  if (!mobile) return { sent: false, error: 'no mobile' };
  var site = bnxGgSite_(cid); if (!site) return { sent: false, error: 'Growth Hub › Settings › Website folder (siteUrl) not set' };
  var cfg = bnxGgCfg_(cid), br = bnxGgBrand_(cid), tok = bnxGgTokNew_(cid, mobile, name, q.tableId, 'MENU');
  var url = site + 'customer-order.html?client=' + encodeURIComponent(cid) + (q.tableId ? '&table=' + encodeURIComponent(q.tableId) : '')
    + (q.eventName ? '&event=' + encodeURIComponent(q.eventName) : '') + (cfg.waOrder ? '&order=1' : '') + '&wt=' + tok;
  var first = bnxGgFirst_(name);
  var body = (first ? 'Hi ' + first + '! ' : '') + (cfg.waCheckinText || 'You have checked in, and we are glad to have you here.')
    + (q.tableId ? '\n\nTable ' + q.tableId : '') + (cfg.waOrder ? '\nOrder from your phone and pay by UPI — no waiting.' : '') + (br.name ? '\n\n' + br.name.toUpperCase() : '');
  return bnxGgCta_(cid, mobile, br.logo, body, 'Powered by Balaji NextGen', cfg.waMenuBtn || 'Explore our menu', url);
}
/* "I have paid" from the QR menu → GUEST_PAYMENTS (CLAIMED). Staff confirm against the bank app in Growth Hub › Payments. */
function bnxGgPayClaim_(p) {
  var cid = bnxGgCid_(p.clientId), amt = Math.round(bnxGgNum_(p.amount, 0) * 100) / 100, req = bnxGgTxt_(p.requestId, 100);
  if (!(amt > 0 && amt < 500000)) return { success: false, error: 'Amount looks wrong' };
  if (req) { var hit = CacheService.getScriptCache().get('ggpy_req_' + cid + '_' + req); if (hit) return JSON.parse(hit); }
  var lock = bnxGgLock_('pay_' + cid);
  try {
    var sh = bnxGgPaySh_(cid);
    if (req) { var dup = bnxGgRows_(sh).filter(function (r) { return String(r.REQUEST_ID) === req; })[0]; if (dup) return { success: true, claimId: dup.CLAIM_ID, duplicate: true }; }
    var id = bnxGgId_('PY');
    bnxGgAppend_(sh, { CLAIM_ID: id, CREATED_AT: bnxGgIst_(), BUSINESS_DAY: bnxGgBizDay_(), CLIENT_ID: cid, MOBILE: bnxGgMobile_(p.mobileNo || p.mobile), NAME: bnxGgName_(p.customerName || p.name),
      TABLE: bnxGgTxt_(p.tableId, 20), ORDER_NOS: bnxGgTxt_(p.orderNos, 300), AMOUNT: amt, UTR: String(p.utr || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 22),
      UPI_ID: bnxGgTxt_(p.upiId, 80), STATUS: 'CLAIMED', REQUEST_ID: req, DEVICE_ID: bnxDev_(p.deviceId) });
    var out = { success: true, claimId: id };
    if (req) CacheService.getScriptCache().put('ggpy_req_' + cid + '_' + req, JSON.stringify(out), 900);
    return out;
  } finally { lock.release(); }
}
function bnxGgPaySet_(cid, b, who) {
  var st = String(b.status || '').toUpperCase(); if (!/^(RECEIVED|NOT_RECEIVED|CLAIMED)$/.test(st)) return { success: false, error: 'Bad status' };
  var lock = bnxGgLock_('pay_' + cid), r, sh;
  try {
    sh = bnxGgPaySh_(cid); r = bnxGgRows_(sh).filter(function (x) { return String(x.CLAIM_ID) === String(b.claimId || ''); })[0];
    if (!r) return { success: false, error: 'Payment not found' };
    bnxGgSet_(sh, r._row, { STATUS: st, HANDLED_BY: who, HANDLED_AT: bnxGgIst_() });
  } finally { lock.release(); }
  var m = bnxGgMobile_(r.MOBILE), first = bnxGgFirst_(r.NAME) || 'Guest', n = { sent: false };
  if (m && st === 'RECEIVED') {
    n = bnxGgWaSend_(cid, m, { type: 'text', text: { body: '✅ Payment of ' + bnxGgRs_(r.AMOUNT) + ' received' + (r.TABLE ? ' for Table ' + r.TABLE : '') + '. Thank you, ' + first + '!' } });
    try { bnxGgThanksQueue_(cid, m, r.NAME, r.ORDER_NOS, r.TABLE, 'PAYMENT'); } catch (e) {}
  } else if (m && st === 'NOT_RECEIVED') {
    n = bnxGgWaSend_(cid, m, { type: 'text', text: { body: 'Hi ' + first + ', we could not find your payment of ' + bnxGgRs_(r.AMOUNT) + ' yet. Please show the payment screen to our staff.' } });
  }
  if (st !== 'CLAIMED') try { bnxGgSet_(sh, r._row, { NOTIFY_RESULT: n.sent ? 'SENT' : ('NOT SENT ' + (n.error || '')).slice(0, 200) }); } catch (e) {}
  return { success: true, notify: n };
}
/* thank-you queue: one per guest per business day, sent by bnxGgCampaignTick after cfg.waThanksDelayMin */
function bnxGgThanksQueue_(cid, mobile, name, billNo, table, source) {
  mobile = bnxGgMobile_(mobile); if (!mobile) return { queued: false };
  var key = cid + '|' + mobile + '|' + bnxGgBizDay_(), cache = CacheService.getScriptCache();
  if (cache.get('ggtq_' + key)) return { queued: false, duplicate: true };
  var lock = bnxGgLock_('tq_' + cid);
  try {
    var sh = bnxGgThanksSh_(cid), C = bnxCrmCols_(sh), last = sh.getLastRow();
    if (last >= 2 && C.KEY) { var from = Math.max(2, last - 400); if (sh.getRange(from, C.KEY, last - from + 1, 1).getValues().some(function (x) { return x[0] === key; })) { cache.put('ggtq_' + key, '1', 90000); return { queued: false, duplicate: true }; } }
    bnxGgAppend_(sh, { KEY: key, CREATED_AT: bnxGgIst_(), CLIENT_ID: cid, MOBILE: mobile, NAME: bnxGgName_(name), TABLE: bnxGgTxt_(table, 20), BILL_NO: bnxGgTxt_(billNo, 120),
      DUE_MS: String(Date.now() + bnxGgCfg_(cid).waThanksDelayMin * 60000), STATUS: 'QUEUED', SOURCE: bnxGgTxt_(source, 30) });
    cache.put('ggtq_' + key, '1', 90000);
  } finally { lock.release(); }
  var P = PropertiesService.getScriptProperties(), a = []; try { a = JSON.parse(P.getProperty('GG_TQ_CLIENTS') || '[]'); } catch (e) {}
  if (a.indexOf(cid) < 0) { a.push(cid); P.setProperty('GG_TQ_CLIENTS', JSON.stringify(a.slice(-100))); }
  return { queued: true };
}
function bnxGgThanksRun_(budgetMs) {
  var a = []; try { a = JSON.parse(PropertiesService.getScriptProperties().getProperty('GG_TQ_CLIENTS') || '[]'); } catch (e) {}
  var t0 = Date.now();
  a.forEach(function (cid) {
    if (Date.now() - t0 > (budgetMs || 60000)) return;
    try {
      var sh = bnxGgThanksSh_(cid), rows = bnxGgRows_(sh), now = Date.now(), cfg = bnxGgCfg_(cid), br = null, site = bnxGgSite_(cid);
      rows.forEach(function (x) {
        if (String(x.STATUS) !== 'QUEUED' || Number(x.DUE_MS) > now || Date.now() - t0 > (budgetMs || 60000)) return;
        if (now - Number(x.DUE_MS) > 20 * 3600000) { bnxGgSet_(sh, x._row, { STATUS: 'SKIPPED', RESULT: 'too old' }); return; }
        br = br || bnxGgBrand_(cid);
        var r = bnxGgThanksSend_(cid, cfg, br, site, String(x.MOBILE), String(x.NAME || ''), String(x.TABLE || ''));
        bnxGgSet_(sh, x._row, { STATUS: r.sent ? 'SENT' : 'FAILED', RESULT: r.sent ? (r.id || '') : String(r.error || '').slice(0, 200), SENT_AT: bnxGgIst_() });
      });
    } catch (e) { Logger.log('thank-you ' + cid + ': ' + e.message); }
  });
}
function bnxGgThanksSend_(cid, cfg, br, site, mobile, name, table) {
  if (!site) return { sent: false, error: 'siteUrl not set' };
  var tok = bnxGgTokNew_(cid, mobile, name, table, 'FEEDBACK'), first = bnxGgFirst_(name);
  var url = site + 'restaurant-landing.html?client=' + encodeURIComponent(cid) + (table ? '&table=' + encodeURIComponent(table) : '') + '&wt=' + tok + '#feedback';
  var body = (first ? 'Hi ' + first + '!\n\n' : '') + (cfg.waThanksText || 'Thank you for visiting!\n\nWe appreciate your time with us and hope you had a great experience.') + (br.name ? '\n\n' + br.name.toUpperCase() : '');
  var r = bnxGgCta_(cid, mobile, br.logo, body, 'Your feedback means the world to us!', cfg.waRateBtn || 'Rate Now!', url);
  if (!r.sent && (r.code == 131047 || /24|re-?engage/i.test(r.error || ''))) {          /* 24-h window closed → approved template, if set */
    var tpl = bnxGgProp_('META_WA_THANKS_TEMPLATE', cid);
    if (tpl) r = bnxGgWaSend_(cid, mobile, { type: 'template', template: { name: tpl, language: { code: bnxGgProp_('META_WA_LANG', cid) || 'en' }, components: [
      { type: 'body', parameters: [{ type: 'text', text: first || 'Guest' }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: tok + '&client=' + cid }] }] } });
  }
  return r;
}

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   LANDING PAGE (one public call)
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
function bnxGgLanding_(cid) {
  var cache = CacheService.getScriptCache(), ck = 'gglanding_' + cid, hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var pub = {}; try { pub = bnxPublicMenu_(cid); } catch (e) { pub = {}; }
  var cfg = bnxGgCfg_(cid), info = pub.info || {};
  var popular = [].concat(pub.food || [], pub.bar || []).filter(function (i) { return i.popular; }).slice(0, 10)
    .map(function (i) { return { name: i.name, price: i.price, veg: i.veg, imageUrl: i.imageUrl, category: i.category }; });
  var cats = {}; (pub.food || []).forEach(function (i) { cats[i.category] = (cats[i.category] || 0) + 1; });
  var out = { success: true, mode: 'LANDING', clientId: cid,
    info: { name: info.name || bnxGgProp_('RESTAURANT_NAME', cid) || '', logoUrl: info.logoUrl || '', phone: info.phone || '', whatsapp: info.whatsapp || '', address: info.address || '',
      tagline: cfg.tagline, about: cfg.about, hours: cfg.hours, instagram: cfg.instagram, facebook: cfg.facebook, mapUrl: cfg.mapUrl, coverUrl: cfg.coverUrl,
      brandColor: cfg.brandColor, reviewUrl: cfg.reviewUrl || bnxGgProp_('GOOGLE_REVIEW_URL', cid) || '' },
    menu: { cards: (pub.cards || []).map(function (c) { return { type: c.cardType, name: c.name, url: c.fileUrl }; }), popular: popular,
      categories: Object.keys(cats).slice(0, 16), itemCount: (pub.food || []).length + (pub.bar || []).length, orderOn: !!cfg.menuOrderOn },
    video: (pub.promo && pub.promo.video && pub.promo.video.active) ? pub.promo.video.videoUrl : '',
    events: cfg.ticketsOn ? bnxGgEventsWithTickets_(cid, true) : (pub.promo && pub.promo.events || []).filter(function (e) { return !/^BNXCFG:/.test(String(e.description || '')) && !/GUEST SCREEN SETTINGS/.test(String(e.title || '')); }).map(function (e) { return { id: e.id, title: e.title, date: e.date, time: e.time, venue: e.venue, description: e.description, posterImg: e.posterImg, tickets: [] }; }),
    resv: { on: cfg.resvOn, open: cfg.resvOpen, close: cfg.resvClose, slotMin: cfg.slotMin, maxPax: cfg.maxPax, maxDays: cfg.maxDays, leadMin: cfg.leadMin,
      areas: String(cfg.areas || '').split(',').map(function (s) { return s.trim(); }).filter(String), occasions: String(cfg.occasions || '').split(',').map(function (s) { return s.trim(); }).filter(String),
      closedDays: cfg.closedDays, today: bnxGgIst_('yyyy-MM-dd') },
    feedback: { on: cfg.fbOn }, tickets: { on: cfg.ticketsOn, upi: !!cfg.upiId } };
  try { cache.put(ck, JSON.stringify(out), 60); } catch (e) {}
  return out;
}
function bnxGgClearLanding_(cid) { try { CacheService.getScriptCache().remove('gglanding_' + cid); if (typeof bnxMcClearPublicCache_ === 'function') bnxMcClearPublicCache_(cid); } catch (e) {} }

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   PUBLIC DISPATCH  (GET ?action=GUEST_CHECKIN&mode=…)  — returns null when the mode is not ours
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var GG_PUBLIC_MODES = /^(WA_STATUS|LANDING|RESV_SLOTS|RESERVE|RESV_STATUS|RESV_CANCEL|TICKET_BOOK|TICKET_STATUS|FEEDBACK|WA_TOKEN|PAY_INFO|PAY_CLAIM)$/;
function bnxGgPublic_(p) {
  p = p || {};
  var mode = String(p.mode || '').toUpperCase();
  if (!GG_PUBLIC_MODES.test(mode)) return null;
  var out;
  try {
    var cid = bnxGgCid_(p.clientId);
    bnxCrmSpreadsheet_(cid, 'MASTER', true);                             /* unknown client → error, nothing is created */
    var dev = bnxDev_(p.deviceId), slot = Math.floor(Date.now() / 600000);
    var limits = { RESERVE: 40, TICKET_BOOK: 60, FEEDBACK: 40, RESV_CANCEL: 20, PAY_CLAIM: 20, WA_TOKEN: 40 };
    if (bnxGgOver_('ggp_' + cid + '_' + mode + '_' + slot, mode === 'LANDING' || mode === 'RESV_SLOTS' || mode === 'WA_STATUS' || mode === 'WA_TOKEN' || mode === 'PAY_INFO' ? 3000 : 600, 900)) throw new Error('Busy — please try again in a few minutes');
    if (limits[mode] && bnxGgOver_('ggpd_' + cid + '_' + mode + '_' + (dev || p.mobileNo || 'x') + '_' + slot, limits[mode] / 4, 900)) throw new Error('Too many attempts — please wait a few minutes');
    switch (mode) {
      case 'WA_STATUS': return bnxWaStatus_(p);
      case 'LANDING': out = bnxGgLanding_(cid); break;
      case 'RESV_SLOTS': var d = bnxGgDate_(p.date); var cfg = bnxGgCfg_(cid); var why = bnxGgResvCheck_(cid, cfg, d, '00:00');
        out = { success: true, date: d, closed: why || '', slots: why ? [] : bnxGgSlots_(cid, d, cfg) }; break;
      case 'RESERVE': out = bnxGgReserve_(p); break;
      case 'RESV_STATUS': out = bnxGgResvStatus_(p); break;
      case 'RESV_CANCEL': out = bnxGgResvCancel_(p); break;
      case 'TICKET_BOOK': out = bnxGgTicketBook_(p); break;
      case 'TICKET_STATUS': out = bnxGgTicketStatus_(p); break;
      case 'WA_TOKEN': out = bnxGgTokGet_(p); break;
      case 'PAY_INFO': { var pc = bnxGgCfg_(cid); out = { success: true, upiId: pc.upiId || '', upiName: pc.upiName || bnxGgProp_('RESTAURANT_NAME', cid) || '' }; break; }
      case 'PAY_CLAIM': out = bnxGgPayClaim_(p); break;
      case 'FEEDBACK':
        if (!bnxGgCfg_(cid).fbOn) { out = { success: false, error: 'Feedback is switched off' }; break; }
        var fk = 'ggfbreq_' + cid + '_' + String(p.requestId || '').slice(0, 80);
        if (p.requestId && CacheService.getScriptCache().get(fk)) { out = JSON.parse(CacheService.getScriptCache().get(fk)); break; }
        out = bnxGgFeedbackSave_(cid, { rating: p.rating, food: p.food, service: p.service, ambience: p.ambience, value: p.value, comment: p.comment,
          name: p.customerName || p.name, mobile: p.mobileNo || p.mobile, table: p.tableId || p.table, orderNo: p.orderNo, source: p.source || 'QR', deviceId: dev, event: p.eventName });
        if (p.requestId && out.success) CacheService.getScriptCache().put(fk, JSON.stringify(out), 900);
        break;
    }
    /* AUTO DATA COLLECTION: a booking / ticket / feedback with a mobile becomes a guest card (CRN), without counting a visit.
       Marketing consent is a separate, unticked-by-default choice on the forms (DPDP). */
    if (out && out.success && !out.duplicate && /^(RESERVE|TICKET_BOOK|FEEDBACK)$/.test(mode)) {
      var mob = bnxGgMobile_(p.mobileNo || p.mobile);
      if (mob) {
        try { out.crn = bnxGgGuestUpsert_(cid, mob, p.customerName || p.name, mode === 'RESERVE' ? 'RESERVATION' : mode === 'TICKET_BOOK' ? 'TICKET' : 'FEEDBACK'); } catch (e) { Logger.log('guest upsert: ' + e.message); }
        if (bnxGgBool_(p.marketingOptIn, false)) { try { out.consent = bnxCrmSetConsent_(cid, mob, true); } catch (e) {} }
      }
    }
  } catch (e) { out = { success: false, error: String(e && e.message || e) }; }
  out = out || { success: false, error: 'Not handled' };
  out.mode = mode;
  return out;
}

/* guest card for someone who booked / bought / rated but never scanned a QR: CRN, no visit counted. Returns the CRN. */
function bnxGgGuestUpsert_(cid, mobile, name, source) {
  name = bnxGgName_(name);
  var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true), lock = bnxCrmLockGuests_(cid), crn = '';
  try {
    var row = bnxCrmFind_(sh, mobile, cid), C = bnxCrmCols_(sh);
    if (row) {
      var o = bnxCrmRowObj_(sh, row); crn = String(o.CRN || '');
      if (!crn && C.CRN) { crn = bnxCrmNextCrn_(sh); sh.getRange(row, C.CRN).setValue(crn); if (C.CUSTOMER_ID) sh.getRange(row, C.CUSTOMER_ID).setValue(crn); }
      if (name && !String(o.NAME || '').trim() && C.NAME) sh.getRange(row, C.NAME).setValue(name);
    } else {
      crn = bnxCrmNextCrn_(sh);
      row = bnxCrmAppend_(sh, { MOBILE: mobile, NAME: name, VISIT_COUNT: 0, POINTS: 0, TOTAL_ORDERS: 0, TOTAL_SPEND: 0, OPT_IN: 'YES',
        SOURCE: source, CLIENT_ID: cid, CRN: crn, CUSTOMER_ID: crn });
      try { if (C.MOBILE) sh.getRange(row, C.MOBILE).setNumberFormat('@').setValue(mobile); } catch (e) {}
    }
  } finally { lock.release(); }
  try { bnxCrmSyncGuest_(cid, mobile, true); } catch (e) {}                /* CUSTOMER_MASTER + CRM DB copy, like a QR check-in */
  return crn;
}

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   WHATSAPP MARKETING CAMPAIGNS
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
/* audience = GUEST_CRM rows with MARKETING_OPT_IN = YES and OPT_IN ≠ NO (never anyone who said STOP) */
function bnxGgAudience_(cid, f) {
  f = f || {};
  var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true), rows = bnxGgRows_(sh), now = bnxCrmWallMs_(bnxGgIst_()), seen = {};
  var minV = Math.max(0, bnxGgNum_(f.minVisits, 0)), within = bnxGgNum_(f.lastVisitWithinDays, 0), away = bnxGgNum_(f.notVisitedDays, 0);
  var minSpend = bnxGgNum_(f.minSpend, 0), ev = String(f.event || '').trim().toLowerCase(), onlyV = bnxGgBool_(f.verifiedOnly, false);
  var list = [];
  rows.forEach(function (r) {
    if (r.CLIENT_ID && String(r.CLIENT_ID) !== cid) return;
    var m = bnxGgMobile_(r.MOBILE); if (!m || seen[m]) return;
    if (String(r.MARKETING_OPT_IN || '').toUpperCase() !== 'YES' || String(r.OPT_IN || '').toUpperCase() === 'NO') return;
    if (Number(r.VISIT_COUNT || 0) < minV) return;
    if (minSpend && Number(r.TOTAL_SPEND || 0) < minSpend) return;
    if (onlyV && String(r.VERIFIED || '').toUpperCase() !== 'YES') return;
    var lv = String(r.LAST_VISIT || ''), days = lv ? (now - bnxCrmWallMs_(lv.length === 16 ? lv + ':00' : lv)) / 86400000 : 9999;
    if (within && days > within) return;
    if (away && days < away) return;
    if (ev && String(r.EVENTS || r.LAST_EVENT || '').toLowerCase().split('|').map(function (x) { return x.trim(); }).indexOf(ev) < 0) return;
    seen[m] = 1;
    list.push({ mobile: m, name: String(r.NAME || ''), crn: String(r.CRN || ''), visits: Number(r.VISIT_COUNT || 0), points: Number(r.POINTS || 0) });
  });
  var total = rows.length, optIn = rows.filter(function (r) { return String(r.MARKETING_OPT_IN || '').toUpperCase() === 'YES' && String(r.OPT_IN || '').toUpperCase() !== 'NO'; }).length;
  return { list: list, totalGuests: total, optedIn: optIn };
}
function bnxGgFill_(tpl, g, cid) {
  var first = String(g.name || '').trim().split(/\s+/)[0] || 'Guest';
  return String(tpl == null ? '' : tpl).replace(/\{first\}|\{name\}/gi, first).replace(/\{fullname\}/gi, g.name || 'Guest').replace(/\{crn\}/gi, g.crn || '-')
    .replace(/\{points\}/gi, String(g.points || 0)).replace(/\{visits\}/gi, String(g.visits || 0)).replace(/\{restaurant\}/gi, bnxGgProp_('RESTAURANT_NAME', cid) || '');
}
function bnxGgTemplates_(cid) {
  var pr = function (k) { return bnxGgProp_(k, cid); }, waba = pr('META_WA_WABA_ID'), token = pr('META_WA_TOKEN');
  if (!waba || !token) return { success: false, error: 'Set Script property META_WA_WABA_ID (WhatsApp Business Account id) to list templates — you can still type the template name.' };
  var res = UrlFetchApp.fetch('https://graph.facebook.com/' + (pr('META_WA_VERSION') || 'v20.0') + '/' + encodeURIComponent(waba) + '/message_templates?fields=name,language,status,category,components&limit=200',
    { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } });
  var j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (j.error) return { success: false, error: j.error.message };
  return { success: true, data: (j.data || []).filter(function (t) { return t.status === 'APPROVED'; }).map(function (t) {
    var body = (t.components || []).filter(function (c) { return c.type === 'BODY'; })[0] || {}, head = (t.components || []).filter(function (c) { return c.type === 'HEADER'; })[0] || {};
    return { name: t.name, lang: t.language, category: t.category, body: body.text || '', vars: ((body.text || '').match(/\{\{\d+\}\}/g) || []).length, header: head.format || '' }; }) };
}
function bnxGgCampaignCreate_(cid, b) {
  var name = bnxGgTxt_(b.name, 80) || 'Campaign', tpl = String(b.template || '').trim(), lang = String(b.lang || 'en').replace(/[^A-Za-z_]/g, '').slice(0, 10) || 'en';
  if (!/^[a-z0-9_]{1,512}$/.test(tpl)) return { success: false, error: 'Pick an approved template (lower-case name, e.g. weekend_offer)' };
  var params = (Array.isArray(b.params) ? b.params : []).slice(0, 10).map(function (x) { return bnxGgTxt_(x, 300); });
  var img = String(b.headerImage || '').trim(); if (img && !/^https:\/\/\S+$/i.test(img)) return { success: false, error: 'Header image must be an https:// link' };
  var aud = bnxGgAudience_(cid, b.filter || {}).list;
  if (b.testMobile) { var tm = bnxGgMobile_(b.testMobile); if (!tm) return { success: false, error: 'Test number invalid' }; aud = [{ mobile: tm, name: 'Test', crn: 'TEST', visits: 1, points: 0 }]; }
  if (!aud.length) return { success: false, error: 'No opted-in guests match this audience' };
  if (b.expectCount !== undefined && Number(b.expectCount) !== aud.length && !b.testMobile) return { success: false, error: 'Audience changed (' + aud.length + ' now) — preview again and confirm' };
  var id = bnxGgId_('CP'), now = bnxGgIst_();
  var lock = bnxGgLock_('camp_' + cid);
  try {
    bnxGgAppend_(bnxGgCampSh_(cid), { CAMPAIGN_ID: id, CREATED_AT: now, CLIENT_ID: cid, NAME: (b.testMobile ? '[TEST] ' : '') + name, TEMPLATE: tpl, LANG: lang,
      PARAMS: JSON.stringify(params), HEADER_IMAGE: img, FILTER: JSON.stringify(b.filter || {}).slice(0, 1000), AUDIENCE: aud.length, QUEUED: aud.length,
      SENT: 0, FAILED: 0, DELIVERED: 0, READ: 0, STATUS: 'RUNNING', CREATED_BY: bnxGgTxt_(b.userName || b.user || '', 60) });
    var lsh = bnxGgCampLogSh_(cid), C = bnxCrmCols_(lsh), w = Math.max(lsh.getLastColumn(), 1);
    var block = aud.map(function (g) { var r = []; for (var i = 0; i < w; i++) r.push('');
      r[C.CAMPAIGN_ID - 1] = id; r[C.MOBILE - 1] = g.mobile; r[C.NAME - 1] = g.name; r[C.CRN - 1] = g.crn; r[C.STATUS - 1] = 'QUEUED'; r[C.CLIENT_ID - 1] = cid;
      r[C.META - 1] = JSON.stringify({ v: g.visits, p: g.points }); return r; });
    var start = lsh.getLastRow() + 1;
    if (C.MOBILE) lsh.getRange(start, C.MOBILE, block.length, 1).setNumberFormat('@');
    lsh.getRange(start, 1, block.length, w).setValues(block);
  } finally { lock.release(); }
  bnxGgRunningAdd_(cid, id);
  return { success: true, campaignId: id, audience: aud.length };
}
function bnxGgRunningAdd_(cid, id) {
  var P = PropertiesService.getScriptProperties(), a = []; try { a = JSON.parse(P.getProperty('GG_RUNNING') || '[]'); } catch (e) {}
  if (!a.some(function (x) { return x.c === cid && x.i === id; })) a.push({ c: cid, i: id });
  P.setProperty('GG_RUNNING', JSON.stringify(a.slice(-50)));
}
function bnxGgRunningDel_(cid, id) {
  var P = PropertiesService.getScriptProperties(), a = []; try { a = JSON.parse(P.getProperty('GG_RUNNING') || '[]'); } catch (e) {}
  P.setProperty('GG_RUNNING', JSON.stringify(a.filter(function (x) { return !(x.c === cid && x.i === id); })));
}
/* send the next batch of one campaign (time-boxed). Safe to call from the hub and the trigger at the same time. */
function bnxGgCampaignRun_(cid, id, budgetMs) {
  var lock = bnxGgLock_('camprun_' + cid + '_' + id);
  if (lock.got === false) return { success: true, busy: true };
  var t0 = Date.now(), sent = 0, failed = 0, skipped = 0, lastErr = '';
  try {
    var csh = bnxGgCampSh_(cid), camp = bnxGgRows_(csh).filter(function (c) { return String(c.CAMPAIGN_ID) === id; })[0];
    if (!camp) return { success: false, error: 'Campaign not found' };
    if (String(camp.STATUS).toUpperCase() !== 'RUNNING') { bnxGgRunningDel_(cid, id); return { success: true, status: camp.STATUS }; }
    var cap = Number(bnxGgProp_('WA_CAMPAIGN_DAILY_CAP', cid) || 1000), dk = 'ggday_' + cid + '_' + bnxGgIst_('yyyyMMdd'), cache = CacheService.getScriptCache();
    var lsh = bnxGgCampLogSh_(cid), C = bnxCrmCols_(lsh), last = lsh.getLastRow();
    if (last < 2) return { success: false, error: 'Log empty' };
    var ids = lsh.getRange(2, C.CAMPAIGN_ID, last - 1, 1).getValues(), sts = lsh.getRange(2, C.STATUS, last - 1, 1).getValues();
    var params = []; try { params = JSON.parse(camp.PARAMS || '[]'); } catch (e) {}
    /* consent is checked again at send time — a guest who replied STOP after the campaign was created is skipped */
    var optOut = {}; try { bnxGgRows_(bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true)).forEach(function (g) {
      if (String(g.MARKETING_OPT_IN || '').toUpperCase() !== 'YES' || String(g.OPT_IN || '').toUpperCase() === 'NO') optOut[bnxGgMobile_(g.MOBILE)] = 1; }); } catch (e) {}
    var isTest = /^\[TEST\]/.test(String(camp.NAME));
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) !== id || String(sts[i][0]).toUpperCase() !== 'QUEUED') continue;
      if (Date.now() - t0 > (budgetMs || 25000)) break;
      var dayN = Number(cache.get(dk) || 0); if (dayN >= cap) { lastErr = 'Daily cap ' + cap + ' reached — continues tomorrow'; break; }
      var row = i + 2, w = Math.max(lsh.getLastColumn(), 1), r = lsh.getRange(row, 1, 1, w).getValues()[0];
      var m = bnxGgMobile_(r[C.MOBILE - 1]), extra = {}; try { extra = JSON.parse((C.META && r[C.META - 1]) || '{}'); } catch (e) {}
      var g = { mobile: m, name: r[C.NAME - 1], crn: r[C.CRN - 1], visits: extra.v, points: extra.p };
      if (!m || (!isTest && optOut[m])) { bnxGgSet_(lsh, row, { STATUS: 'SKIPPED', ERROR: m ? 'opted out' : 'bad number', UPDATED_AT: bnxGgIst_() }); skipped++; continue; }
      try {
        var res = bnxGgSendTemplate_(cid, m, camp.TEMPLATE, camp.LANG, params.map(function (x) { return bnxGgFill_(x, g, cid); }), camp.HEADER_IMAGE);
        var msgId = res.slice(3);
        bnxGgSet_(lsh, row, { STATUS: 'SENT', MSG_ID: msgId, ERROR: '', SENT_AT: bnxGgIst_(), UPDATED_AT: bnxGgIst_() });
        cache.put('ggmsg_' + msgId, cid + '|' + id + '|' + row, 21600 * 4);
        cache.put(dk, String(dayN + 1), 90000); sent++;
      } catch (e) {
        lastErr = String(e.message || e).slice(0, 200);
        bnxGgSet_(lsh, row, { STATUS: 'FAILED', ERROR: lastErr, UPDATED_AT: bnxGgIst_() }); failed++;
        if (e.code === 190 || /token|OAuth/i.test(lastErr)) { bnxGgCampFinish_(cid, id, 'PAUSED', lastErr); break; }   /* expired token: stop, don't burn the list */
        if (e.code === 132001 || /template.*(not exist|does not exist|name)/i.test(lastErr)) { bnxGgCampFinish_(cid, id, 'PAUSED', lastErr); break; }
      }
    }
    return bnxGgCampaignTotals_(cid, id, lastErr, { sent: sent, failed: failed, skipped: skipped });
  } finally { lock.release(); }
}
function bnxGgCampFinish_(cid, id, status, err) {
  var csh = bnxGgCampSh_(cid), c = bnxGgRows_(csh).filter(function (x) { return String(x.CAMPAIGN_ID) === id; })[0];
  if (!c) return;
  var upd = { STATUS: status }; if (err) upd.LAST_ERROR = err; if (status !== 'RUNNING') upd.FINISHED_AT = bnxGgIst_();
  bnxGgSet_(csh, c._row, upd);
  if (status !== 'RUNNING') bnxGgRunningDel_(cid, id);
}
function bnxGgCampaignTotals_(cid, id, lastErr, batch) {
  var lsh = bnxGgCampLogSh_(cid), C = bnxCrmCols_(lsh), last = lsh.getLastRow(), n = { QUEUED: 0, SENT: 0, DELIVERED: 0, READ: 0, FAILED: 0, SKIPPED: 0 };
  if (last >= 2) { var ids = lsh.getRange(2, C.CAMPAIGN_ID, last - 1, 1).getValues(), st = lsh.getRange(2, C.STATUS, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) { var s = String(st[i][0]).toUpperCase(); n[s] = (n[s] || 0) + 1; } }
  var csh = bnxGgCampSh_(cid), c = bnxGgRows_(csh).filter(function (x) { return String(x.CAMPAIGN_ID) === id; })[0];
  if (c) {
    var upd = { QUEUED: n.QUEUED, SENT: n.SENT + n.DELIVERED + n.READ, DELIVERED: n.DELIVERED + n.READ, READ: n.READ, FAILED: n.FAILED };
    if (!c.STARTED_AT) upd.STARTED_AT = bnxGgIst_();
    if (lastErr) upd.LAST_ERROR = lastErr;
    if (!n.QUEUED && String(c.STATUS).toUpperCase() === 'RUNNING') { upd.STATUS = 'DONE'; upd.FINISHED_AT = bnxGgIst_(); bnxGgRunningDel_(cid, id); }
    bnxGgSet_(csh, c._row, upd);
  }
  return { success: true, campaignId: id, counts: n, batch: batch || {}, lastError: lastErr || '' };
}
/* time-driven trigger (RUN_GG_2_InstallCampaignTrigger) */
function bnxGgCampaignTick() {
  var a = []; try { a = JSON.parse(PropertiesService.getScriptProperties().getProperty('GG_RUNNING') || '[]'); } catch (e) {}
  var t0 = Date.now();
  a.forEach(function (x) { if (Date.now() - t0 > 240000) return; try { bnxGgCampaignRun_(x.c, x.i, 60000); } catch (e) { Logger.log('campaign ' + x.i + ': ' + e.message); } });
  try { bnxGgThanksRun_(Math.max(20000, 280000 - (Date.now() - t0))); } catch (e) { Logger.log('thank-you queue: ' + e.message); }   /* 2026-11-13 */
}

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   STAFF / GROWTH HUB ACTIONS
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var GG_STAFF_ACTIONS = /^(CUSTOMER_CHECKIN|GUEST_VERIFY|WA_READY|WA_SEND|GG_[A-Z_]+)$/;
/* Session rule = bnxMpAuth_ (same as every guest-suite action). Stronger check: if this project defines
   bnxValidateSession_(sessionToken, clientId) → true / false, it is used and a throw counts as "not valid" (fail closed). */
function bnxGgAuth_(b) {
  var bad = bnxMpAuth_(b); if (bad) return bad;
  var G = (typeof globalThis !== 'undefined') ? globalThis : this, fn = G.bnxValidateSession_;
  if (typeof fn === 'function') {
    var ok = false; try { ok = fn(String(b.sessionToken || ''), String(b.clientId || '')); } catch (e) { ok = false; }
    if (!ok || ok.success === false) return { success: false, error: 'Invalid or expired session — please log in again' };
  }
  return null;
}
function bnxGgHub_(action, b) {
  var cid = bnxGgCid_(b.clientId), who = bnxGgTxt_(b.userName || b.user || b.staffName || '', 60) || 'STAFF';
  switch (action) {
    case 'CUSTOMER_CHECKIN': return bnxGrCheckin_(b);
    case 'GUEST_VERIFY': return bnxGrVerify_(b);
    case 'WA_READY': return { success: true, data: { clientId: cid, checks: bnxGrReadyChecks_(cid) } };
    case 'WA_SEND': return waSend_(b);

    case 'GG_CFG_GET': return { success: true, data: { cfg: bnxGgCfg_(cid), wa: bnxGgWaState_(cid), build: BNX_GG_BUILD, name: bnxGgBrand_(cid).name } };
    case 'GG_CFG_SAVE': { var c = bnxGgCfgSave_(cid, b.cfg || {}); bnxGgClearLanding_(cid); return { success: true, data: c }; }
    case 'GG_OVERVIEW': return { success: true, data: bnxGgOverview_(cid) };

    case 'GG_FEEDBACK_LIST': {
      var f = bnxGgRows_(bnxGgFeedbackSh_(cid)), from = String(b.fromDate || ''), to = String(b.toDate || '9999');
      f = f.filter(function (x) { var d = String(x.BUSINESS_DAY || x.CREATED_AT || '').slice(0, 10); return (!from || d >= from) && d <= to; });
      if (b.status) f = f.filter(function (x) { return String(x.STATUS).toUpperCase() === String(b.status).toUpperCase(); });
      if (b.maxRating) f = f.filter(function (x) { return Number(x.RATING) <= Number(b.maxRating); });
      return { success: true, data: f.reverse().slice(0, Number(b.max || 1000)).map(bnxGgStrip_) };
    }
    case 'GG_FEEDBACK_SET': {
      var fs = bnxGgFeedbackSh_(cid), fr = bnxGgRows_(fs).filter(function (x) { return String(x.FEEDBACK_ID) === String(b.id || ''); })[0];
      if (!fr) return { success: false, error: 'Feedback not found' };
      var st = String(b.status || 'RESOLVED').toUpperCase(); if (!/^(NEW|OK|IN_PROGRESS|RESOLVED)$/.test(st)) return { success: false, error: 'Bad status' };
      bnxGgSet_(fs, fr._row, { STATUS: st, ACTION_NOTE: bnxGgTxt_(b.note, 400), RESOLVED_BY: who, RESOLVED_AT: bnxGgIst_() });
      return { success: true };
    }
    case 'GG_FEEDBACK_ASK': {                                       /* send a feedback request now (24 h window or template) */
      var am = bnxGgMobile_(b.mobile); if (!am) return { success: false, error: 'Invalid mobile' };
      CacheService.getScriptCache().put('ggfb_' + am, cid, 86400);
      var at = bnxGgProp_('META_WA_FEEDBACK_TEMPLATE', cid), txt = bnxGgTxt_(b.text, 900) || ('How was your visit? Reply 1 to 5 (5 = excellent).');
      if (at) { try { return { success: true, via: 'TEMPLATE', result: bnxGgSendTemplate_(cid, am, at, bnxGgProp_('META_WA_LANG', cid) || 'en', [String(b.name || 'Guest').split(' ')[0]]) }; } catch (e) { return { success: false, error: String(e.message || e) }; } }
      var r = waSend_({ clientId: cid, sessionToken: b.sessionToken, to: am, text: txt, kind: 'feedback' });
      if (!r.success) r.waLink = 'https://wa.me/91' + am + '?text=' + encodeURIComponent(txt);
      return r;
    }

    case 'GG_RESV_LIST': {
      var rv = bnxGgRows_(bnxGgResvSh_(cid)), rf = String(b.fromDate || ''), rt = String(b.toDate || '9999');
      rv = rv.filter(function (x) { return (!rf || String(x.DATE) >= rf) && String(x.DATE) <= rt; });
      if (b.status) rv = rv.filter(function (x) { return String(x.STATUS).toUpperCase() === String(b.status).toUpperCase(); });
      rv.sort(function (a, c) { return (String(a.DATE) + String(a.TIME)).localeCompare(String(c.DATE) + String(c.TIME)); });
      return { success: true, data: rv.map(bnxGgStrip_) };
    }
    case 'GG_RESV_SLOTS': { var sd = bnxGgDate_(b.date); return { success: true, data: bnxGgSlots_(cid, sd) }; }
    case 'GG_RESV_SET': return bnxGgResvSet_(cid, b, who);

    case 'GG_EVENTS': return { success: true, data: bnxGgEventsWithTickets_(cid, false) };
    case 'GG_TICKET_TYPES_SAVE': return bnxGgTypesSave_(cid, b);
    case 'GG_TICKETS_LIST': {
      var bs = bnxGgBookSh_(cid), br = bnxGgRows_(bs); bnxGgSold_(cid, br, bnxGgCfg_(cid)); bnxGgExpireWrite_(bs, br);
      if (b.eventId) br = br.filter(function (x) { return String(x.EVENT_ID) === String(b.eventId); });
      return { success: true, data: br.reverse().slice(0, 3000).map(bnxGgStrip_) };
    }
    case 'GG_TICKET_SET': return bnxGgTicketSet_(cid, b, who);

    case 'GG_AUDIENCE': {
      var au = bnxGgAudience_(cid, b.filter || {});
      return { success: true, data: { count: au.list.length, totalGuests: au.totalGuests, optedIn: au.optedIn,
        sample: au.list.slice(0, 8).map(function (g) { return { name: g.name, mobile: bnxGgMask_(g.mobile), visits: g.visits }; }) } };
    }
    case 'GG_TEMPLATES': return bnxGgTemplates_(cid);
    case 'GG_CAMPAIGN_CREATE': return bnxGgCampaignCreate_(cid, b);
    case 'GG_CAMPAIGN_RUN': return bnxGgCampaignRun_(cid, String(b.campaignId || ''), 20000);
    case 'GG_CAMPAIGN_CANCEL': bnxGgCampFinish_(cid, String(b.campaignId || ''), 'CANCELLED', 'cancelled by ' + who); return { success: true };
    case 'GG_CAMPAIGN_RESUME': bnxGgCampFinish_(cid, String(b.campaignId || ''), 'RUNNING', ''); bnxGgRunningAdd_(cid, String(b.campaignId || '')); return { success: true };
    case 'GG_CAMPAIGN_LIST': {
      var cs = bnxGgRows_(bnxGgCampSh_(cid)), cache = CacheService.getScriptCache();
      return { success: true, data: cs.reverse().slice(0, 100).map(function (c) { var o = bnxGgStrip_(c);
        o.DELIVERED_LIVE = Number(cache.get('ggcnt_' + cid + '_' + c.CAMPAIGN_ID + '_DELIVERED') || 0); o.READ_LIVE = Number(cache.get('ggcnt_' + cid + '_' + c.CAMPAIGN_ID + '_READ') || 0); return o; }) };
    }
    case 'GG_CAMPAIGN_REFRESH': return bnxGgCampaignTotals_(cid, String(b.campaignId || ''), '');

    case 'GG_PAY_CLAIMS': {
      var py = bnxGgRows_(bnxGgPaySh_(cid)), pf = String(b.fromDate || '');
      py = py.filter(function (x) { return !pf || String(x.BUSINESS_DAY || x.CREATED_AT || '').slice(0, 10) >= pf; });
      if (b.status) py = py.filter(function (x) { return String(x.STATUS).toUpperCase() === String(b.status).toUpperCase(); });
      return { success: true, data: py.reverse().slice(0, 1000).map(function (x) { var o = bnxGgStrip_(x); delete o.DEVICE_ID; delete o.REQUEST_ID; return o; }) };
    }
    case 'GG_PAY_CLAIM_SET': return bnxGgPaySet_(cid, b, who);
  }
  return { success: false, error: 'Unknown Growth Hub action: ' + action };
}
function bnxGgStrip_(o) { var x = {}; Object.keys(o).forEach(function (k) { if (k.charAt(0) !== '_') x[k] = o[k]; }); return x; }
function bnxGgWaState_(cid) {
  var pr = function (k) { return bnxGgProp_(k, cid); }, P = PropertiesService.getScriptProperties();
  return { provider: String(pr('WA_PROVIDER') || 'NONE').toUpperCase(), token: !!pr('META_WA_TOKEN'), phoneId: !!pr('META_WA_PHONE_ID'), waba: !!pr('META_WA_WABA_ID'),
    webhookVerified: !!P.getProperty('WA_HOOK_VERIFIED'), webhookSeen: !!P.getProperty('WA_HOOK_SEEN'), checkinReady: (function () { try { return bnxWaCheckinReady_(cid); } catch (e) { return false; } })(),
    apiNumber: (function () { try { var ai = bnxWaApiInfo_(cid); return ai.ok ? ai.number : ''; } catch (e) { return ''; } })(),
    resvTemplate: pr('META_WA_RESV_TEMPLATE') || '', ticketTemplate: pr('META_WA_TICKET_TEMPLATE') || '', feedbackTemplate: pr('META_WA_FEEDBACK_TEMPLATE') || '',
    dailyCap: Number(pr('WA_CAMPAIGN_DAILY_CAP') || 1000), triggerOn: (function () { try { return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'bnxGgCampaignTick'; }); } catch (e) { return false; } })() };
}
function bnxGgResvSet_(cid, b, who) {
  var st = String(b.status || '').toUpperCase();
  if (!/^(PENDING|CONFIRMED|DECLINED|CANCELLED|SEATED|NO_SHOW|COMPLETED)$/.test(st) && !b.resvId) return { success: false, error: 'Bad status' };
  var lock = bnxGgLock_('resv_' + cid);
  var f, upd = {};
  try {
    f = bnxGgResvFind_(cid, b.id || b.reqId); if (!f) return { success: false, error: 'Booking not found' };
    if (st) { upd.STATUS = st; upd.HANDLED_BY = who; upd.HANDLED_AT = bnxGgIst_(); }
    if (b.table !== undefined) upd.TABLE = bnxGgTxt_(b.table, 60);
    if (b.tableName !== undefined) upd.TABLE_NAME = bnxGgTxt_(b.tableName, 60);
    if (b.resvId !== undefined) upd.RESV_ID = bnxGgTxt_(b.resvId, 80);
    if (b.note) upd.NOTE = (String(f.r.NOTE || '') + ' | ' + bnxGgTxt_(b.note, 200)).replace(/^ \| /, '').slice(0, 500);
    bnxGgSet_(f.sh, f.r._row, upd);
  } finally { lock.release(); }
  var out = { success: true, reqId: f.r.REQ_ID, status: st || f.r.STATUS };
  if (bnxGgBool_(b.notify, false) && /^(CONFIRMED|DECLINED)$/.test(st)) {
    var rn = bnxGgProp_('RESTAURANT_NAME', cid) || '', first = String(f.r.NAME || 'Guest').split(' ')[0];
    var nice = Utilities.formatDate(Utilities.parseDate(String(f.r.DATE) + ' 12:00', 'Asia/Kolkata', 'yyyy-MM-dd HH:mm'), 'Asia/Kolkata', 'EEE d MMM');
    var text = st === 'CONFIRMED' ? ('✅ Hi ' + first + ', your table at ' + rn + ' is confirmed for ' + nice + ' at ' + f.r.TIME + ' · ' + f.r.PAX + ' guest(s).' + (upd.TABLE_NAME ? ' Table: ' + upd.TABLE_NAME + '.' : '') + ' See you soon!')
      : ('Hi ' + first + ', sorry — we cannot take your booking for ' + nice + ' at ' + f.r.TIME + '. Please call us and we will find another time.');
    var n = st === 'CONFIRMED' ? bnxGgNotify_(cid, String(f.r.MOBILE), 'META_WA_RESV_TEMPLATE', [first, nice, f.r.TIME, String(f.r.PAX)], text) : { sent: false, waLink: 'https://wa.me/91' + f.r.MOBILE + '?text=' + encodeURIComponent(text) };
    out.notify = n;
    try { bnxGgSet_(f.sh, f.r._row, { NOTIFY_RESULT: n.sent ? 'SENT ' + (n.via || '') : ('MANUAL ' + (n.error || '')).slice(0, 200) }); } catch (e) {}
  }
  return out;
}
function bnxGgTypesSave_(cid, b) {
  var evId = String(b.eventId || '').trim(); if (!evId) return { success: false, error: 'Event id missing' };
  var ev = bnxQrpEvents_(cid, false).filter(function (e) { return e.id === evId; })[0]; if (!ev) return { success: false, error: 'Event not found — save the event first (Customer QR Promotion → Events)' };
  var types = Array.isArray(b.types) ? b.types.slice(0, 12) : [];
  var lock = bnxGgLock_('tix_' + cid);
  try {
    var sh = bnxGgTypesSh_(cid), cur = bnxGgTypes_(cid, evId), keep = {};
    var sold = bnxGgSold_(cid, bnxGgRows_(bnxGgBookSh_(cid)), bnxGgCfg_(cid));
    for (var i = 0; i < types.length; i++) {
      var t = types[i], name = bnxGgTxt_(t.name, 60); if (!name) continue;
      var price = Math.max(0, Math.round(bnxGgNum_(t.price, 0) * 100) / 100), qty = Math.max(0, Math.round(bnxGgNum_(t.qty, 0))), maxPer = Math.min(50, Math.max(1, Math.round(bnxGgNum_(t.maxPer, 10))));
      var ex = cur.filter(function (x) { return t.typeId && x.typeId === String(t.typeId); })[0];
      if (ex && qty < (sold[ex.typeId] || 0)) return { success: false, error: name + ': ' + (sold[ex.typeId] || 0) + ' already sold — quantity cannot go below that' };
      var row = { TYPE_ID: ex ? ex.typeId : bnxGgId_('TT'), CLIENT_ID: cid, EVENT_ID: evId, NAME: name, PRICE: price, QTY: qty, MAX_PER_BOOKING: maxPer,
        ACTIVE: bnxGgBool_(t.active, true) ? 'YES' : 'NO', SORT: i, UPDATED_AT: bnxGgIst_(), NOTE: bnxGgTxt_(t.note, 120) };
      if (ex) bnxGgSet_(sh, ex._row, row); else bnxGgAppend_(sh, row);
      keep[row.TYPE_ID] = 1;
    }
    cur.forEach(function (x) { if (!keep[x.typeId]) bnxGgSet_(sh, x._row, { ACTIVE: 'NO', UPDATED_AT: bnxGgIst_() }); });   /* never delete — bookings point at it */
  } finally { lock.release(); }
  bnxGgClearLanding_(cid);
  return { success: true, data: bnxGgEventsWithTickets_(cid, false).filter(function (e) { return e.id === evId; })[0] };
}
function bnxGgTicketSet_(cid, b, who) {
  var code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), bid = String(b.bookingId || '');
  var st = String(b.status || '').toUpperCase(); if (!/^(PAID|CHECKED_IN|CANCELLED|RESERVED|CONFIRMED)$/.test(st)) return { success: false, error: 'Bad status' };
  var lock = bnxGgLock_('tix_' + cid), out;
  try {
    var sh = bnxGgBookSh_(cid), r = bnxGgRows_(sh).filter(function (x) { return (bid && String(x.BOOKING_ID) === bid) || (code && String(x.CODE) === code); })[0];
    if (!r) return { success: false, error: 'Ticket ' + (code || bid) + ' not found' };
    var cur = String(r.STATUS).toUpperCase();
    if (st === 'CHECKED_IN') {
      if (cur === 'CANCELLED' || cur === 'EXPIRED') return { success: false, error: 'Ticket is ' + cur.toLowerCase() };
      if (String(r.CHECKED_IN_AT || '')) return { success: false, already: true, error: 'Already checked in at ' + r.CHECKED_IN_AT, data: bnxGgStrip_(r) };
      if (cur === 'RESERVED' && Number(r.AMOUNT) > 0 && !bnxGgBool_(b.collect, false)) return { success: false, unpaid: true, error: 'Not paid yet — ₹' + r.AMOUNT + ' to collect', data: bnxGgStrip_(r) };
    }
    var upd = { STATUS: st, HANDLED_BY: who, UPDATED_AT: bnxGgIst_() };
    if (st === 'PAID' || (st === 'CHECKED_IN' && cur === 'RESERVED')) { upd.PAID_AT = bnxGgIst_(); upd.PAY_MODE = bnxGgTxt_(b.payMode || 'UPI', 20); if (b.payRef) upd.PAY_REF = bnxGgTxt_(b.payRef, 60); }
    if (st === 'CHECKED_IN') { upd.CHECKED_IN = Number(r.QTY); upd.CHECKED_IN_AT = bnxGgIst_(); }
    bnxGgSet_(sh, r._row, upd);
    Object.keys(upd).forEach(function (k) { r[k] = upd[k]; });
    out = { success: true, data: bnxGgStrip_(r) };
  } finally { lock.release(); }
  if (bnxGgBool_(b.notify, false) && /^(PAID|CONFIRMED)$/.test(st)) {
    var first = String(out.data.NAME || 'Guest').split(' ')[0];
    out.notify = bnxGgNotify_(cid, String(out.data.MOBILE), 'META_WA_TICKET_TEMPLATE', [first, out.data.EVENT_TITLE, out.data.CODE, String(out.data.QTY)],
      '🎟️ Hi ' + first + ', your ' + out.data.QTY + ' ticket(s) for ' + out.data.EVENT_TITLE + ' (' + out.data.EVENT_DATE + ') are confirmed. Entry code: ' + out.data.CODE);
  }
  bnxGgClearLanding_(cid);
  return out;
}
function bnxGgOverview_(cid) {
  var today = bnxGgBizDay_(), d30 = bnxGgIst_('yyyy-MM-dd', new Date(Date.now() - 30 * 86400000)), out = { today: today };
  try { var g = bnxGgRows_(bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true));
    out.guests = g.length; out.optedIn = g.filter(function (r) { return String(r.MARKETING_OPT_IN || '').toUpperCase() === 'YES' && String(r.OPT_IN || '').toUpperCase() !== 'NO'; }).length;
    out.repeat = g.filter(function (r) { return Number(r.VISIT_COUNT || 0) > 1; }).length;
    out.new30 = g.filter(function (r) { return String(r.FIRST_VISIT || '').slice(0, 10) >= d30; }).length;
    out.visitsToday = g.filter(function (r) { return String(r.LAST_VISIT || '').slice(0, 10) >= today; }).length;
  } catch (e) { out.guestError = e.message; }
  try { var f = bnxGgRows_(bnxGgFeedbackSh_(cid)).filter(function (r) { return String(r.BUSINESS_DAY || r.CREATED_AT || '').slice(0, 10) >= d30; });
    var sum = 0; f.forEach(function (r) { sum += Number(r.RATING || 0); });
    out.fb30 = f.length; out.fbAvg = f.length ? Math.round(sum / f.length * 10) / 10 : 0; out.fbOpen = f.filter(function (r) { return String(r.STATUS).toUpperCase() === 'NEW'; }).length;
    var pro = f.filter(function (r) { return Number(r.RATING) === 5; }).length, det = f.filter(function (r) { return Number(r.RATING) <= 3; }).length;
    out.fbScore = f.length ? Math.round((pro - det) / f.length * 100) : 0;
    out.fbDist = [1, 2, 3, 4, 5].map(function (s) { return f.filter(function (r) { return Number(r.RATING) === s; }).length; });
  } catch (e) { out.fbError = e.message; }
  try { var rv = bnxGgRows_(bnxGgResvSh_(cid)), td = bnxGgIst_('yyyy-MM-dd');
    out.resvPending = rv.filter(function (r) { return String(r.STATUS).toUpperCase() === 'PENDING'; }).length;
    out.resvToday = rv.filter(function (r) { return String(r.DATE) === td && GG_RV_LIVE[String(r.STATUS).toUpperCase()]; }).length;
    out.resvCoversToday = rv.filter(function (r) { return String(r.DATE) === td && GG_RV_LIVE[String(r.STATUS).toUpperCase()]; }).reduce(function (a, r) { return a + Number(r.PAX || 0); }, 0);
    out.resvUpcoming = rv.filter(function (r) { return String(r.DATE) >= td && GG_RV_LIVE[String(r.STATUS).toUpperCase()]; }).length;
  } catch (e) { out.resvError = e.message; }
  try { var tb = bnxGgRows_(bnxGgBookSh_(cid)).filter(function (r) { return String(r.EVENT_DATE) >= bnxGgIst_('yyyy-MM-dd') && GG_TB_LIVE[String(r.STATUS).toUpperCase()]; });
    out.ticketsUpcoming = tb.reduce(function (a, r) { return a + Number(r.QTY || 0); }, 0);
    out.ticketRevenue = tb.filter(function (r) { return /^(PAID|CHECKED_IN)$/.test(String(r.STATUS).toUpperCase()); }).reduce(function (a, r) { return a + Number(r.AMOUNT || 0); }, 0);
    out.ticketsUnpaid = tb.filter(function (r) { return String(r.STATUS).toUpperCase() === 'RESERVED' && Number(r.AMOUNT) > 0; }).length;
  } catch (e) { out.ticketError = e.message; }
  try { var cp = bnxGgRows_(bnxGgCampSh_(cid)).filter(function (r) { return String(r.CREATED_AT).slice(0, 10) >= d30; });
    out.campaigns30 = cp.length; out.campaignSent30 = cp.reduce(function (a, r) { return a + Number(r.SENT || 0); }, 0);
  } catch (e) { out.campError = e.message; }
  return out;
}

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   FROM "Guest route.gs" — CUSTOMER_CHECKIN / GUEST_VERIFY / WA_READY (unchanged logic, one copy)
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
function bnxGrJson_(o) { return bnxGgJson_(o); }
function bnxGrBool_(v, d) { return bnxGgBool_(v, d); }
function bnxGrCheckin_(b) {
  var out = bnxGrCheckin0_(b);
  try { if (out && out.success !== false && String(b.billNo || '').trim() && Number(b.billAmount || 0) > 0)    /* bill settled → thank-you + Rate now */
    bnxGgThanksQueue_(String(b.clientId || '').trim(), b.mobileNo || b.mobile || b.phone, out.customerName || b.customerName || b.name, b.billNo, b.tableId, 'BILL'); } catch (e) {}
  return out;
}
function bnxGrCheckin0_(b) {
  var cid = String(b.clientId || '').trim();
  var mobile = String(b.mobileNo || b.mobile || b.phone || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(mobile)) return { success: false, error: 'Enter a valid 10-digit mobile number' };
  bnxCrmSpreadsheet_(cid, 'MASTER', true);
  return bnxCustomerCheckin_({
    clientId: cid, mobileNo: mobile, customerName: String(b.customerName || b.name || '').slice(0, 60), tableId: String(b.tableId || '').slice(0, 20),
    scanKey: String(b.scanKey || '').slice(0, 60), requestId: String(b.requestId || '').slice(0, 80), notifyOptIn: bnxGgBool_(b.notifyOptIn, true),
    welcomeSms: bnxGgBool_(b.welcomeSms, false), deferWelcome: bnxGgBool_(b.deferWelcome, false), source: String(b.source || 'DASHBOARD').slice(0, 60),
    eventName: String(b.eventName || b.partyName || '').replace(/[|<>=]/g, '').trim().slice(0, 60), deviceId: bnxDev_(b.deviceId),
    billAmount: Number(b.billAmount || 0) || 0, billNo: String(b.billNo || '').slice(0, 40), _noCreate: true
  });
}
function bnxGrCount_(sh, mobile) {
  var C = bnxCrmCols_(sh), last = sh.getLastRow(); if (last < 2 || !C.MOBILE) return 0;
  var from = Math.max(2, last - 5000), n = 0;
  sh.getRange(from, C.MOBILE, last - from + 1, 1).getDisplayValues().forEach(function (r) { if (String(r[0]).replace(/\D/g, '').slice(-10) === mobile) n++; });
  return n;
}
function bnxGrVerify_(b) {
  var cid = String(b.clientId || '').trim(), mobile = String(b.mobileNo || b.mobile || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(mobile)) return { success: false, error: 'Valid 10-digit mobile required' };
  var ctl = bnxGuestCtl_(cid), checks = [];
  function add(place, fn) { try { var r = fn(); checks.push({ place: place, ok: !!r.ok, detail: r.detail || '' }); } catch (e) { checks.push({ place: place, ok: false, detail: String(e && e.message || e) }); } }
  add('MASTER DB · GUEST_CRM', function () { var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true), r = bnxCrmFind_(sh, mobile, cid);
    if (!r) return { ok: false, detail: 'mobile not found in GUEST_CRM' }; var o = bnxCrmRowObj_(sh, r);
    return { ok: true, detail: (o.NAME || '(no name yet)') + ' · ' + (o.CRN || 'no CRN') + ' · visits ' + (o.VISIT_COUNT || 0) }; });
  add('MASTER DB · CUSTOMER_MASTER', function () { if (!ctl.cm) return { ok: true, detail: 'copy switched OFF in Guest control — skipped' };
    var sh = bnxCrmSpreadsheet_(cid, 'MASTER', true).getSheetByName(CRM_CUST_MASTER); if (!sh) return { ok: false, detail: 'tab CUSTOMER_MASTER missing' };
    var C = bnxCrmCols_(sh), pc = C.PHONE || C.MOBILE || C.MOBILE_NO, n = sh.getLastRow() - 1; if (!pc) return { ok: false, detail: 'no PHONE column' }; if (n < 1) return { ok: false, detail: 'mobile not found' };
    var v = sh.getRange(2, pc, n, 1).getDisplayValues();
    for (var i = 0; i < v.length; i++) if (String(v[i][0]).replace(/\D/g, '').slice(-10) === mobile) { var nm = C.CUSTOMER_NAME ? sh.getRange(i + 2, C.CUSTOMER_NAME).getValue() : ''; return { ok: true, detail: 'row ' + (i + 2) + (nm ? ' · ' + nm : '') }; }
    return { ok: false, detail: 'mobile not found in CUSTOMER_MASTER' }; });
  add('TRANSACTION DB · GUEST_TRANSACTIONS', function () { var n = bnxGrCount_(bnxCrmSheet_(CRM_TXN, CRM_TXN_HEAD, cid, true), mobile); return { ok: n > 0, detail: n ? n + ' row(s)' : 'no VISIT / BILL / ORDER row for this mobile' }; });
  add('TRANSACTION DB · GUEST_SCANS', function () { var n = bnxGrCount_(bnxCrmSheet_(CRM_SCAN, CRM_SCAN_HEAD, cid, true), mobile); return { ok: true, detail: n ? n + ' scan(s) linked' : 'none linked (normal when the check-in had no device id)' }; });
  add('CRM DB · GUEST_CRM', function () { if (!ctl.crm) return { ok: true, detail: 'copy switched OFF in Guest control — skipped' };
    var css = bnxCrmCrmSs_(cid); if (!css) return { ok: true, detail: 'no ' + cid + '_CRM_DB file found — copy skipped' };
    var sh = css.getSheetByName(CRM_SHEET); if (!sh) return { ok: false, detail: 'tab GUEST_CRM missing in CRM DB' };
    var f = bnxCrmFind_(sh, mobile, cid); return { ok: f > 0, detail: f ? 'found' : 'mobile not found in CRM DB' }; });
  var bad = checks.filter(function (c) { return !c.ok; });
  return { success: true, data: { clientId: cid, mobile: mobile, allOk: !bad.length, checks: checks } };
}
function bnxGrReadyChecks_(cid) {
  var P = PropertiesService.getScriptProperties(), pr = function (k) { return bnxGgProp_(k, cid); }, rows = [];
  function chk(label, ok, fix) { rows.push({ label: label, ok: !!ok, fix: ok ? '' : fix }); }
  chk('WhatsApp provider = META', String(pr('WA_PROVIDER') || '').toUpperCase() === 'META', 'Guest capture & WhatsApp control → WhatsApp setup → Provider = META');
  chk('Meta token saved', !!pr('META_WA_TOKEN'), 'WhatsApp setup → paste the permanent token from Meta (System user)');
  chk('Meta phone number ID saved', !!pr('META_WA_PHONE_ID'), 'WhatsApp setup → Phone number ID (Meta → WhatsApp → API setup)');
  chk('Webhook secret (WA_VERIFY_TOKEN) set', !!P.getProperty('WA_VERIFY_TOKEN'), 'Apps Script → Project settings → Script properties → WA_VERIFY_TOKEN = any secret word; same word in Meta → Webhook → Verify token');
  chk('Meta verified the webhook', !!P.getProperty('WA_HOOK_VERIFIED') || !!P.getProperty('WA_HOOK_SEEN'), 'Meta → WhatsApp → Configuration → Callback URL = ' + (ScriptApp.getService().getUrl() || '<exec URL>') + ' → Verify and save, subscribe "messages"');
  var api = { ok: false, number: '' }; try { api = bnxWaApiInfo_(cid); } catch (e) {}
  chk('Cloud-API number (' + (api.number || '?') + ')', api.ok, 'Meta refused the token / phone id: ' + (api.error || 'unknown') + ' — run RUN_17_CheckWhatsApp');
  chk('"Open WhatsApp button for guest" = Yes', bnxGuestCtl_(cid).waGuest, 'Guest capture control → Open WhatsApp button for guest = Yes, then Save');
  var G = (typeof globalThis !== 'undefined') ? globalThis : this;
  chk('Server answers Meta webhook verification', !!(G.doGet && G.doGet.__bnxGg), '"Guest growth suite.gs" must be the LAST file, then deploy a NEW VERSION');
  chk('Server receives WhatsApp messages', !!(G.doPost && G.doPost.__bnxGg), '"Guest growth suite.gs" must be the LAST file, then deploy a NEW VERSION');
  return rows;
}

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   THE ONLY doGet / doPost WRAPPERS (this file must be LAST)
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  var G = (typeof globalThis !== 'undefined') ? globalThis : this;
  var prevGet = G.doGet, prevPost = G.doPost;
  if (typeof prevGet === 'function' && !prevGet.__bnxGg) {
    var g = function (e) {
      try {
        var p = (e && e.parameter) || {};
        if (p['hub.mode'] === 'subscribe') {                                    /* Meta webhook verification */
          var P = PropertiesService.getScriptProperties(), want = P.getProperty('WA_VERIFY_TOKEN') || '';
          var ok = !!want && p['hub.verify_token'] === want && bnxWaHookAllowed_(e);
          if (ok) P.setProperty('WA_HOOK_VERIFIED', String(Date.now()));
          return ContentService.createTextOutput(ok ? String(p['hub.challenge'] || '') : 'forbidden');
        }
        if (p.action === 'GUEST_CHECKIN' && p.mode) { var r = bnxGgPublic_(p); if (r) return bnxGgJson_(r); }
        if (p.action === 'GG_WHOAMI') return bnxGgJson_({ success: true, build: BNX_GG_BUILD, doGet: true, doPost: !!(G.doPost && G.doPost.__bnxGg), scriptId: ScriptApp.getScriptId() });
      } catch (x) { return bnxGgJson_({ success: false, error: String(x && x.message || x) }); }
      return prevGet.apply(this, arguments);
    };
    for (var k in prevGet) { try { g[k] = prevGet[k]; } catch (x) {} }
    g.__bnxGg = true; g.__bnxWa = true; g.__bnxWaRouteFix = true;
    try { G.doGet = g; } catch (x) {} try { doGet = g; } catch (x) {}
  }
  if (typeof prevPost === 'function' && !prevPost.__bnxGg) {
    var pw = function (e) {
      var raw = ''; try { raw = (e && e.postData && e.postData.contents) || ''; } catch (x) {}
      if (raw && raw.indexOf('whatsapp_business_account') >= 0) {               /* Meta → message / receipt */
        if (!bnxWaHookAllowed_(e)) return bnxGgJson_({ ok: false, error: 'forbidden' });
        return bnxWaInbound_(raw);
      }
      var body = null; try { body = raw ? JSON.parse(raw) : null; } catch (x) { body = null; }
      if (body && typeof body === 'object' && GG_STAFF_ACTIONS.test(String(body.action || ''))) {
        var bad = bnxGgAuth_(body); if (bad) return bnxGgJson_(bad);
        try { return bnxGgJson_(bnxGgHub_(String(body.action), body)); } catch (err) { return bnxGgJson_({ success: false, error: String(err && err.message || err) }); }
      }
      try { var w = bnxWaRoutePost_(e); if (w) {
        if (body && body.action === 'CRM_BILL_CAPTURE') { try { var wr = JSON.parse(w.getContent()); var bm = bnxGgMobile_(body.mobileNo || body.mobile || body.customerMobile || body.phone);
          if (wr && wr.success !== false && bm) bnxGgThanksQueue_(String(body.clientId || '').trim(), bm, wr.customerName || body.customerName || body.name, body.billNo || body.billNumber, body.tableId || body.table, 'BILL'); } catch (x2) {} }
        return w; } } catch (x) {}   /* CRM_BILL_CAPTURE, GET_CRM_SCANS, Truecaller callback … */
      return prevPost.apply(this, arguments);
    };
    for (var k2 in prevPost) { try { pw[k2] = prevPost[k2]; } catch (x) {} }
    pw.__bnxGg = true; pw.__bnxWa = true; pw.__bnxGr = true; pw.__bnxWaRouteFix = true; pw.__bnxMp = !!prevPost.__bnxMp;
    try { G.doPost = pw; } catch (x) {} try { doPost = pw; } catch (x) {}
  }
  /* other entry points into the public route (bnxWaRouteGet_ → bnxGuestCheckinPublic_ → bnxGuestMode_) get the new modes too */
  var prevMode = G.bnxGuestMode_;
  if (typeof prevMode === 'function' && !prevMode.__bnxGg) {
    var w = function (p) { var r = bnxGgPublic_(p); return r || prevMode.apply(this, arguments); };
    w.__bnxGg = true; w.__bnxWa = true; try { G.bnxGuestMode_ = w; } catch (x) {} try { bnxGuestMode_ = w; } catch (x) {}
  }
})();

/* ═════════════════════════════════════════════════════════════════════════════════════════════════════════
   RUN FROM THE EDITOR
   ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
function RUN_GG_1_CheckSetup() {
  var cid = (typeof CRM_TEST_CLIENT !== 'undefined') ? CRM_TEST_CLIENT : 'CL00010', L = [], G = (typeof globalThis !== 'undefined') ? globalThis : this;
  var ok = function (b, t, fix) { L.push((b ? '✅ ' : '❌ ') + t + (b ? '' : '\n      → ' + fix)); };
  ok(!!(G.doGet && G.doGet.__bnxGg), 'doGet wrapped by Guest growth suite', 'move "Guest growth suite.gs" to the bottom of the file list');
  ok(!!(G.doPost && G.doPost.__bnxGg), 'doPost wrapped by Guest growth suite', 'move "Guest growth suite.gs" to the bottom of the file list');
  ok(!!(G.doPost && G.doPost.__bnxMp), 'menu-card / QR-promo router still in the chain', 'Menu card qr promo.gs must be ABOVE this file');
  ok(typeof bnxWaEffective_ === 'function' && typeof bnxWaReplyOrSms_ === 'function', 'customer-crm.gs is the 2026-11-09 copy', 'replace customer-crm.gs with the delivered file');
  ok(typeof bnxArReply_ !== 'function', 'old "WhatsApp auto reply.gs" removed', 'delete it — bnxWaCheckinFromMessage_ already replies (double message)');
  ok(typeof bnxGrHandle_ !== 'function', 'old "Guest route.gs" removed', 'delete it — its actions live in this file');
  ['bnxCrmSpreadsheet_', 'bnxQrpEvents_', 'bnxPublicMenu_', 'bnxSoftLock_', 'bnxCrmWallMs_'].forEach(function (f) { ok(typeof G[f] === 'function', f + ' available', 'missing — the CRM / menu-card files are not in this project'); });
  [['TRANSACTIONS', GG_FB_TAB, GG_FB_HEAD], ['TRANSACTIONS', GG_RV_TAB, GG_RV_HEAD], ['MASTER', GG_TT_TAB, GG_TT_HEAD], ['TRANSACTIONS', GG_TB_TAB, GG_TB_HEAD],
   ['TRANSACTIONS', GG_CP_TAB, GG_CP_HEAD], ['TRANSACTIONS', GG_CL_TAB, GG_CL_HEAD]].forEach(function (t) {
    try { var sh = bnxGgTab_(cid, t[0], t[1], t[2]); ok(true, t[0] + ' DB › ' + t[1] + ' ready (' + Math.max(0, sh.getLastRow() - 1) + ' rows) — ' + sh.getParent().getName(), ''); }
    catch (e) { ok(false, t[0] + ' DB › ' + t[1], e.message); } });
  var w = bnxGgWaState_(cid);
  ok(w.provider === 'META' && w.token && w.phoneId, 'WhatsApp Cloud API configured', 'WA_PROVIDER=META, META_WA_TOKEN, META_WA_PHONE_ID (campaigns + server send need it)');
  ok(w.webhookVerified || w.webhookSeen, 'Meta webhook verified / messages arriving', 'Meta › WhatsApp › Configuration › Callback URL ' + (ScriptApp.getService().getUrl() || '<exec>') + ', verify token = WA_VERIFY_TOKEN, subscribe "messages"');
  ok(w.waba, 'META_WA_WABA_ID set (template list in the hub)', 'optional — Script property META_WA_WABA_ID = your WhatsApp Business Account id');
  ok(w.triggerOn, 'campaign trigger installed (also sends the thank-you + Rate now)', 'run RUN_GG_2_InstallCampaignTrigger once');
  ok(!!bnxGgSite_(cid), 'Website folder set (menu / rate links in WhatsApp)', 'Growth Hub › Settings › Website folder = https://…/ where customer-order.html lives');
  ok(!!bnxGgCfg_(cid).upiId, 'UPI ID set (guests pay from the QR menu)', 'Growth Hub › Settings › UPI ID');
  [['TRANSACTIONS', GG_PY_TAB, GG_PY_HEAD], ['TRANSACTIONS', GG_TQ_TAB, GG_TQ_HEAD]].forEach(function (t) {
    try { var sh = bnxGgTab_(cid, t[0], t[1], t[2]); ok(true, t[0] + ' DB › ' + t[1] + ' ready (' + Math.max(0, sh.getLastRow() - 1) + ' rows)', ''); } catch (e) { ok(false, t[0] + ' DB › ' + t[1], e.message); } });
  L.push('ℹ️ one-tap WhatsApp check-in on the QR page is ' + (w.checkinReady ? 'ON' : 'OFF (guests type number + name — still saved)'));
  L.push('ℹ️ landing page:  https://balajinextgen.in/…/restaurant-landing.html?client=' + cid + '   (any host works; set the API id once with ?api=<deployment id>)');
  try { var lp = bnxGgLanding_(cid); L.push('ℹ️ LANDING test: ' + (lp.info.name || '(no name)') + ' · ' + lp.events.length + ' event(s) · menu items ' + lp.menu.itemCount); } catch (e) { L.push('❌ LANDING test: ' + e.message); }
  Logger.log('\n' + L.join('\n'));
}
function RUN_GG_2_InstallCampaignTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bnxGgCampaignTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('bnxGgCampaignTick').timeBased().everyMinutes(5).create();
  Logger.log('✅ bnxGgCampaignTick runs every 5 minutes (queued WhatsApp campaigns keep sending with the hub closed).');
}
/* preview only — prints the slots and the audience size; writes nothing, sends nothing */
function RUN_GG_3_Preview() {
  var cid = (typeof CRM_TEST_CLIENT !== 'undefined') ? CRM_TEST_CLIENT : 'CL00010', d = bnxGgIst_('yyyy-MM-dd', new Date(Date.now() + 86400000));
  Logger.log('Settings: ' + JSON.stringify(bnxGgCfg_(cid)));
  Logger.log('Slots ' + d + ': ' + bnxGgSlots_(cid, d).map(function (s) { return s.time + '(' + s.left + ')'; }).join(' '));
  var a = bnxGgAudience_(cid, {}); Logger.log('Guests ' + a.totalGuests + ' · opted in to WhatsApp offers ' + a.optedIn + ' · campaign audience ' + a.list.length);
  Logger.log('QR-first parser: ' + JSON.stringify(bnxGgQrFirst_('Hi, Send me the menu of HASHTAG SILIGURI, I am Seated on Table Number B5\n#CI-' + cid + '-TB5')));
  Logger.log('Rating parser: "5"→' + bnxGgRatingFromText_('5') + '  "4 stars nice"→' + bnxGgRatingFromText_('4 stars nice') + '  "⭐⭐⭐"→' + bnxGgRatingFromText_('⭐⭐⭐') + '  "table 5"→' + bnxGgRatingFromText_('table 5'));
}

/* WhatsApp setup report (from the 2026-10-12 routing patch) — logs YES/NO only, never secret values */
function BNX_WA_DIAGNOSTICS() {
  var P = PropertiesService.getScriptProperties(), G = (typeof globalThis !== 'undefined') ? globalThis : this;
  var out = function (label, ok, detail) { Logger.log((ok ? 'PASS' : 'CHECK') + ' | ' + label + ' | ' + (detail || (ok ? 'OK' : 'Missing'))); };
  var pid = String(P.getProperty('META_WA_PHONE_ID') || '').trim();
  out('WA_PROVIDER is META', String(P.getProperty('WA_PROVIDER') || '').toUpperCase() === 'META', P.getProperty('WA_PROVIDER') || 'Not configured');
  out('META_WA_TOKEN saved', !!P.getProperty('META_WA_TOKEN'), P.getProperty('META_WA_TOKEN') ? 'Saved (value hidden)' : 'Missing');
  out('META_WA_PHONE_ID saved', !!pid, pid ? 'Saved (value hidden)' : 'Missing');
  out('WA_VERIFY_TOKEN saved', !!P.getProperty('WA_VERIFY_TOKEN'));
  out('doPost wrapped (Guest growth suite)', !!(G.doPost && G.doPost.__bnxGg));
  out('doGet wrapped (Guest growth suite)', !!(G.doGet && G.doGet.__bnxGg));
  if (pid) out('Phone Number ID → client mapping', !!P.getProperty('WA_CLIENT_' + pid), P.getProperty('WA_CLIENT_' + pid) || 'Not mapped; the QR message must carry #CI-<CLIENT_ID>-T<table>');
  var lg = []; try { lg = JSON.parse(P.getProperty('WA_HOOK_LOG') || '[]'); } catch (e) {}
  Logger.log('Last WhatsApp hooks (' + lg.length + '):'); lg.forEach(function (x) { Logger.log('  ' + x.t + '  ' + (x.from || '') + '  "' + (x.text || '') + '"  →  ' + x.result); });
}
function RUN_14_VerifyGuestSave() {
  var mobile = '9999999999', cid = CRM_TEST_CLIENT;
  var out = bnxGrCheckin_({ clientId: cid, mobileNo: mobile, customerName: 'Verify Test', tableId: '1', scanKey: 'verify-' + bnxGgIst_('yyyyMMdd', new Date(Date.now() - 6 * 3600 * 1000)),
    requestId: 'verify-' + Date.now(), deferWelcome: true, source: 'DASHBOARD_VERIFY', deviceId: 'verifytest0001' });
  Logger.log('check-in: ' + JSON.stringify(out));
  var v = bnxGrVerify_({ clientId: cid, mobileNo: mobile });
  (v.data && v.data.checks || []).forEach(function (c) { Logger.log((c.ok ? '✅ ' : '❌ ') + c.place + ' — ' + c.detail); });
  Logger.log(v.success && v.data.allOk ? 'ALL SAVED' : 'Something did not save — see ❌ lines');
}
function RUN_15_WhatsAppSetupCheck() {
  var rows = bnxGrReadyChecks_(CRM_TEST_CLIENT), bad = rows.filter(function (r) { return !r.ok; }).length;
  Logger.log('\n' + rows.map(function (r) { return (r.ok ? '✅ ' : '❌ ') + r.label + (r.ok ? '' : '\n      → ' + r.fix); }).join('\n') + '\n\n' +
    (bad ? bad + ' thing(s) missing — the guest page keeps showing the form until they are fixed.' : 'ALL READY — scan the QR: green WhatsApp button.'));
}