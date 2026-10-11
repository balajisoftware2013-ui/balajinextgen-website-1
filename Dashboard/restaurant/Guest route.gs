/**
 * GUEST ROUTE — adds the two actions the dashboard's "Save guest & WhatsApp control" panel needs.   2026-10-11
 *
 *   CUSTOMER_CHECKIN  { clientId, sessionToken, mobileNo, customerName, tableId?, eventName?, ... }
 *       → same saver the QR page uses (bnxCustomerCheckin_): GUEST_CRM + CUSTOMER_MASTER (MASTER DB),
 *         GUEST_TRANSACTIONS (TRANSACTION DB), CRM DB copy, welcome WhatsApp/SMS.
 *         Fixes: "No deployment has CUSTOMER_CHECKIN yet".
 *   GUEST_VERIFY      { clientId, sessionToken, mobileNo }
 *       → reads the guest's rows straight from the real tabs and says which place has them.
 *         Replaces the generic tab reader that answers "Tab GUEST_CRM is not wired to a real v3 source yet".
 *
 * INSTALL
 *  1. Add this as a NEW file and move it to the VERY BOTTOM of the file list (below "Menu card qr promo.gs").
 *  2. Run bnxMenuPromoCheck()  (all lines must stay ✅), then RUN_14_VerifyGuestSave().
 *  3. Deploy > Manage deployments > pencil > Version: NEW VERSION > Deploy.
 *  4. Open  <your /exec URL>?action=BNX_WHOAMI  to confirm the live build.
 *
 * Needs (already in your project): bnxMpAuth_, bnxCustomerCheckin_, bnxCrmSheet_, bnxCrmFind_, bnxCrmRowObj_,
 * bnxCrmCols_, bnxCrmSpreadsheet_, bnxCrmCrmSs_, bnxGuestCtl_, CRM_* constants.
 */

var BNX_GR_ACTIONS = /^(CUSTOMER_CHECKIN|GUEST_VERIFY|WA_READY)$/;

function bnxGrJson_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function bnxGrBool_(v, d) { if (v === undefined || v === null || v === '') return d; return !/^(0|false|no|off)$/i.test(String(v)); }

function bnxGrHandle_(e) {
  /* Meta WhatsApp webhook (guest tapped Send) → bnxWaRoutePost_ saves the REAL mobile + WhatsApp name to the sheets */
  try {
    var raw = e && e.postData && e.postData.contents;
    if (raw && raw.indexOf('whatsapp_business_account') >= 0 && typeof bnxWaRoutePost_ === 'function') { var w = bnxWaRoutePost_(e); if (w) return w; }
  } catch (x) { Logger.log('WA webhook: ' + x.message); }
  var body;
  try { body = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : null; } catch (x) { return null; }
  if (!body || typeof body !== 'object') return null;
  var action = String(body.action || '');
  if (!BNX_GR_ACTIONS.test(action)) return null;
  var bad = bnxMpAuth_(body);                                  /* same client + session rule as the rest of the ERP */
  if (bad) return bnxGrJson_(bad);
  try {
    if (action === 'WA_READY') return bnxGrJson_({ success: true, data: { clientId: String(body.clientId || ''), checks: bnxGrReadyChecks_(String(body.clientId || '').trim()) } });
    return bnxGrJson_(action === 'CUSTOMER_CHECKIN' ? bnxGrCheckin_(body) : bnxGrVerify_(body));
  }
  catch (err) { return bnxGrJson_({ success: false, error: String(err && err.message || err) }); }
}

/* ───────────── CUSTOMER_CHECKIN ───────────── */
function bnxGrCheckin_(b) {
  var cid = String(b.clientId || '').trim();
  var mobile = String(b.mobileNo || b.mobile || b.phone || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(mobile)) return { success: false, error: 'Enter a valid 10-digit mobile number' };
  bnxCrmSpreadsheet_(cid, 'MASTER', true);                     /* unknown client → error, nothing is created */
  return bnxCustomerCheckin_({
    clientId: cid, mobileNo: mobile,
    customerName: String(b.customerName || b.name || '').slice(0, 60),
    tableId: String(b.tableId || '').slice(0, 20),
    scanKey: String(b.scanKey || '').slice(0, 60),
    requestId: String(b.requestId || '').slice(0, 80),
    notifyOptIn: bnxGrBool_(b.notifyOptIn, true),
    welcomeSms: bnxGrBool_(b.welcomeSms, false),
    deferWelcome: bnxGrBool_(b.deferWelcome, false),
    source: String(b.source || 'DASHBOARD').slice(0, 60),
    eventName: String(b.eventName || b.partyName || '').replace(/[|<>=]/g, '').trim().slice(0, 60),
    deviceId: (typeof bnxDev_ === 'function') ? bnxDev_(b.deviceId) : '',
    billAmount: Number(b.billAmount || 0) || 0,
    billNo: String(b.billNo || '').slice(0, 40),
    _noCreate: true
  });
}

/* ───────────── GUEST_VERIFY ───────────── */
function bnxGrCount_(sh, mobile) {
  var C = bnxCrmCols_(sh), last = sh.getLastRow();
  if (last < 2 || !C.MOBILE) return 0;
  var from = Math.max(2, last - 5000), n = 0;
  sh.getRange(from, C.MOBILE, last - from + 1, 1).getDisplayValues().forEach(function (r) {
    if (String(r[0]).replace(/\D/g, '').slice(-10) === mobile) n++;
  });
  return n;
}
function bnxGrVerify_(b) {
  var cid = String(b.clientId || '').trim();
  var mobile = String(b.mobileNo || b.mobile || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(mobile)) return { success: false, error: 'Valid 10-digit mobile required' };
  var ctl = bnxGuestCtl_(cid), checks = [];
  function add(place, fn) {
    try { var r = fn(); checks.push({ place: place, ok: !!r.ok, detail: r.detail || '' }); }
    catch (e) { checks.push({ place: place, ok: false, detail: String(e && e.message || e) }); }
  }

  add('MASTER DB · GUEST_CRM', function () {
    var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true), r = bnxCrmFind_(sh, mobile, cid);
    if (!r) return { ok: false, detail: 'mobile not found in GUEST_CRM' };
    var o = bnxCrmRowObj_(sh, r);
    return { ok: true, detail: (o.NAME || '(no name yet)') + ' · ' + (o.CRN || 'no CRN') + ' · visits ' + (o.VISIT_COUNT || 0) };
  });

  add('MASTER DB · CUSTOMER_MASTER', function () {
    if (!ctl.cm) return { ok: true, detail: 'copy switched OFF in Guest control — skipped' };
    var sh = bnxCrmSpreadsheet_(cid, 'MASTER', true).getSheetByName(CRM_CUST_MASTER);
    if (!sh) return { ok: false, detail: 'tab CUSTOMER_MASTER missing' };
    var C = bnxCrmCols_(sh), pc = C.PHONE || C.MOBILE || C.MOBILE_NO, n = sh.getLastRow() - 1;
    if (!pc) return { ok: false, detail: 'no PHONE column' };
    if (n < 1) return { ok: false, detail: 'mobile not found' };
    var v = sh.getRange(2, pc, n, 1).getDisplayValues();
    for (var i = 0; i < v.length; i++) if (String(v[i][0]).replace(/\D/g, '').slice(-10) === mobile) {
      var nm = C.CUSTOMER_NAME ? sh.getRange(i + 2, C.CUSTOMER_NAME).getValue() : '';
      return { ok: true, detail: 'row ' + (i + 2) + (nm ? ' · ' + nm : '') };
    }
    return { ok: false, detail: 'mobile not found in CUSTOMER_MASTER' };
  });

  add('TRANSACTION DB · GUEST_TRANSACTIONS', function () {
    var n = bnxGrCount_(bnxCrmSheet_(CRM_TXN, CRM_TXN_HEAD, cid, true), mobile);
    return { ok: n > 0, detail: n ? n + ' row(s)' : 'no VISIT / BILL / ORDER row for this mobile' };
  });

  add('TRANSACTION DB · GUEST_SCANS', function () {
    var n = bnxGrCount_(bnxCrmSheet_(CRM_SCAN, CRM_SCAN_HEAD, cid, true), mobile);
    /* informational: a scan row exists only when the check-in carried a phone/device id, so none is not an error */
    return { ok: true, detail: n ? n + ' scan(s) linked' : 'none linked (normal when the check-in had no device id)' };
  });

  add('CRM DB · GUEST_CRM', function () {
    if (!ctl.crm) return { ok: true, detail: 'copy switched OFF in Guest control — skipped' };
    var css = bnxCrmCrmSs_(cid);
    if (!css) return { ok: true, detail: 'no ' + cid + '_CRM_DB file found — copy skipped' };
    var sh = css.getSheetByName(CRM_SHEET);
    if (!sh) return { ok: false, detail: 'tab GUEST_CRM missing in CRM DB' };
    return { ok: bnxCrmFind_(sh, mobile, cid) > 0, detail: bnxCrmFind_(sh, mobile, cid) ? 'found' : 'mobile not found in CRM DB' };
  });

  var bad = checks.filter(function (c) { return !c.ok; });
  return { success: true, data: { clientId: cid, mobile: mobile, allOk: !bad.length, checks: checks } };
}

/* ───────────── wrap the live doPost (this file must be LAST in the file list) ───────────── */
(function () {
  var G = (typeof globalThis !== 'undefined') ? globalThis : this;
  var prev = G.doPost;
  if (typeof prev !== 'function' || prev.__bnxGr) return;
  var wrapped = function (e) {
    var r = null;
    try { r = bnxGrHandle_(e); } catch (x) { r = null; }
    if (r) return r;
    return prev.apply(this, arguments);
  };
  wrapped.__bnxGr = true;
  wrapped.__bnxMp = prev.__bnxMp;                              /* keep bnxMenuPromoCheck / BNX_WHOAMI happy */
  try { G.doPost = wrapped; } catch (x) {}
  try { doPost = wrapped; } catch (x) {}
})();

/* ───────────── run from the editor ───────────── */
/* 1) saves a test guest the same way the dashboard does, 2) reads it back from every database */
function RUN_14_VerifyGuestSave() {
  var mobile = '9999999999';                                   /* change to any 10-digit test number */
  var out = bnxGrCheckin_({ clientId: CRM_TEST_CLIENT, mobileNo: mobile, customerName: 'Verify Test', tableId: '1',
    scanKey: 'verify-' + Utilities.formatDate(new Date(Date.now() - 6 * 3600 * 1000), 'Asia/Kolkata', 'yyyyMMdd'),
    requestId: 'verify-' + Date.now(), deferWelcome: true, source: 'DASHBOARD_VERIFY', deviceId: 'verifytest0001' });
  Logger.log('check-in: ' + JSON.stringify(out));
  var v = bnxGrVerify_({ clientId: CRM_TEST_CLIENT, mobileNo: mobile });
  (v.data && v.data.checks || []).forEach(function (c) { Logger.log((c.ok ? '✅ ' : '❌ ') + c.place + ' — ' + c.detail); });
  Logger.log(v.success && v.data.allOk ? 'ALL SAVED' : 'Something did not save — see ❌ lines');
}


/* ───────────── Meta webhook verification (GET ?hub.mode=subscribe…) — wrap doGet ───────────── */
(function () {
  var G = (typeof globalThis !== 'undefined') ? globalThis : this;
  var prev = G.doGet;
  if (typeof prev !== 'function' || prev.__bnxWa) return;
  var wrapped = function (e) {
    try { if (e && e.parameter && e.parameter['hub.mode'] && typeof bnxWaRouteGet_ === 'function') { var r = bnxWaRouteGet_(e); if (r) return r; } } catch (x) {}
    return prev.apply(this, arguments);
  };
  wrapped.__bnxWa = true;
  try { G.doGet = wrapped; } catch (x) {}
  try { doGet = wrapped; } catch (x) {}
})();

/* What does the guest page need before it hides the number + name form and shows the green WhatsApp button?
   Used by the dashboard button "Check WhatsApp ready" (action WA_READY) and by RUN_15 in the editor. */
function bnxGrReadyChecks_(cid) {
  var P = PropertiesService.getScriptProperties(), pr = function (k) { return bnxCrmProp_(P, k, cid); }, rows = [];
  function chk(label, ok, fix) { rows.push({ label: label, ok: !!ok, fix: ok ? '' : fix }); }
  var prov = String(pr('WA_PROVIDER') || '').toUpperCase();
  chk('WhatsApp provider = META', prov === 'META', 'Guest capture & WhatsApp control → WhatsApp setup → Provider = META');
  chk('Meta token saved', !!pr('META_WA_TOKEN'), 'WhatsApp setup → paste the permanent token from Meta (System user)');
  chk('Meta phone number ID saved', !!pr('META_WA_PHONE_ID'), 'WhatsApp setup → Phone number ID (Meta → WhatsApp → API setup)');
  chk('Webhook secret (WA_VERIFY_TOKEN) set', !!P.getProperty('WA_VERIFY_TOKEN'), 'Apps Script → Project settings → Script properties → add WA_VERIFY_TOKEN = any secret word; type the same word in Meta → Webhook → Verify token');
  var wn = String(pr('WA_GUEST_NUMBER') || '').replace(/\D/g, '').slice(-10), cs = '';
  try { var ss = bnxCrmSpreadsheet_(cid, 'MASTER', true), r0 = bnxPubRows_(ss, 'CLIENT_SETTINGS').filter(function (r) { return !r.CLIENT_ID || String(r.CLIENT_ID) === cid; })[0] || {};
        cs = String(r0.WHATSAPP_NUMBER || r0.RESTAURANT_WHATSAPP || r0.RESTAURANT_PHONE || '').replace(/\.0$/, '').replace(/\D/g, '').slice(-10); } catch (e) {}
  var num = wn || cs;
  chk('Guest WhatsApp number (' + (num || 'none') + ')', /^[6-9]\d{9}$/.test(num), 'WhatsApp setup → Guest WhatsApp number. It must be the SAME number Meta Cloud API runs on, or the guest message never reaches the server');
  chk('"Open WhatsApp button for guest" = Yes', bnxGuestCtl_(cid).waGuest, 'Guest capture control → Open WhatsApp button for guest = Yes, then Save');
  var G = (typeof globalThis !== 'undefined') ? globalThis : this;
  chk('Server answers Meta webhook verification', !!(G.doGet && G.doGet.__bnxWa), 'Apps Script: "Guest route.gs" must be the LAST file, then deploy a NEW VERSION');
  chk('Server receives WhatsApp messages', typeof bnxWaRoutePost_ === 'function' && !!(G.doPost && G.doPost.__bnxGr), 'Apps Script: "Guest route.gs" must be the LAST file, then deploy a NEW VERSION');
  return rows;
}
function RUN_15_WhatsAppSetupCheck() {
  var rows = bnxGrReadyChecks_(CRM_TEST_CLIENT), bad = rows.filter(function (r) { return !r.ok; }).length;
  Logger.log('\n' + rows.map(function (r) { return (r.ok ? '✅ ' : '❌ ') + r.label + (r.ok ? '' : '\n      → ' + r.fix); }).join('\n') + '\n\n' +
    (bad ? bad + ' thing(s) missing — the guest page keeps showing the form until they are fixed.'
         : 'ALL READY — scan the QR: green WhatsApp button, no form. Test the server side with RUN_4_TestWhatsAppCheckin.'));
}
