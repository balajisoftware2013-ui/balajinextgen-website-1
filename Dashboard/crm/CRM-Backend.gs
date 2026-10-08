/**
 * BALAJI NEXTGEN ERP · HAPPYSERVE — CUSTOMER CRM + AUTO WELCOME (SMS / WhatsApp)   v3.1 — 2026-10-08
 *
 * v3.1 ROOT FIXES ("QR scan but name not saved, customer id not auto"):
 *  a. GUEST_TRANSACTIONS has a CUSTOMER_ID column but CRM_TXN_HEAD did not list it, so every
 *     transaction row was written with CUSTOMER_ID blank. Now CUSTOMER_ID = the guest's CRN
 *     (CRN-00001 …, created automatically on the first scan), on every VISIT / ORDER row.
 *  b. GUEST_CRM gets a CUSTOMER_ID column too (= CRN), so both tabs join on one id.
 *  c. The VISIT row is logged at the mobile step, before the guest types the name; when the name
 *     arrives later only GUEST_CRM was updated → GUEST_TRANSACTIONS kept NAME blank. Now the
 *     guest's earlier rows with a blank NAME / CUSTOMER_ID are filled in as soon as the name comes.
 *  d. Public route accepts the name as customerName or name (the QR page sends both).
 *  e. Run bnxCrmRepairIds('CL00010') once: fills CRN / CUSTOMER_ID / NAME on rows already saved.
 *  f. ZERO-TYPING WHATSAPP CHECK-IN (v3.2): a web page can never read a phone's number or owner name.
 *     The QR page's green "Check in with WhatsApp" button opens WhatsApp with "… #CI-CL00010-T5"; when
 *     the guest taps Send, Meta calls this script (webhook) with the guest's REAL mobile and WhatsApp
 *     profile NAME → saved to GUEST_CRM / GUEST_TRANSACTIONS (CRN + CUSTOMER_ID) and the welcome is
 *     replied at once. A reply inside 24 h of the guest's own message needs no approved template.
 *     SETUP (Meta WhatsApp Cloud API):
 *       Script properties:  WA_PROVIDER=META  META_WA_TOKEN  META_WA_PHONE_ID  WA_VERIFY_TOKEN=<any secret>
 *       Router (doGet / doPost), first line of each:
 *         doGet:   var w = bnxWaRouteGet_(e);  if (w) return w;
 *         doPost:  var w = bnxWaRoutePost_(e); if (w) return w;
 *       Meta › WhatsApp › Configuration › Webhook:  Callback URL = this web app /exec URL,
 *         Verify token = WA_VERIFY_TOKEN, subscribe to "messages".
 *  g. One welcome per guest per 5 minutes even if the name is saved twice (no double WhatsApp).
 *  h. EVENTS (v3.3): several events can run on one day. Each check-in carries the event the guest came for
 *     (event/party QR, the "I am here for …" button on the poster, or automatic when only one event runs).
 *     GUEST_CRM.LAST_EVENT + EVENTS (every event the guest attended) and GUEST_TRANSACTIONS.EVENT are written;
 *     each event is its own visit; choosing the event after checking in updates that same visit (no double
 *     count). GET_CRM_CUSTOMERS / GET_CRM_TRANSACTIONS accept  event  to filter.
 * Replaces the previous "CUSTOMER CRM + AUTO WELCOME MESSAGE (v2)" file — same function names, same sheets.
 *
 * ROOT CAUSES FIXED (scan → mobile + name → Google Sheet → WhatsApp)
 *  1. The QR guest page has no login. Its CUSTOMER_CHECKIN POST carried a random guest UUID that the live
 *     session check now rejects ("Invalid or expired session"), so NO mobile / name ever reached GUEST_CRM
 *     and no welcome was sent — the phone only queued it forever.
 *     → New public route  GET ?action=GUEST_CHECKIN  (wired in doGet of menu-card-qr-promo.gs), like PUBLIC_MENU.
 *       Guarded: client must already have a MASTER DB (never auto-creates files for unknown ids),
 *       10-digit Indian mobile only, rate limits per client and per number, one welcome per guest.
 *  2. WhatsApp only worked through Twilio free-text. WhatsApp does NOT deliver free text to someone who
 *     has not messaged you first — a scanning guest never has. Business-initiated messages need an
 *     approved TEMPLATE. Now supported:
 *       WA_PROVIDER = META    → Meta WhatsApp Cloud API template   (META_WA_TOKEN, META_WA_PHONE_ID, META_WA_TEMPLATE, META_WA_LANG)
 *       WA_PROVIDER = TWILIO  → Twilio; uses TWILIO_WA_CONTENT_SID (approved template) when set, else free text
 *     SMS fallback unchanged (FAST2SMS / MSG91 / TWILIO). Any property can be set per client by adding
 *     _<clientId>, e.g.  WA_PROVIDER_CL00010 = META,  META_WA_PHONE_ID_CL00010 = 1234…
 *     Template body variables, in order:  {{1}} first name   {{2}} restaurant   {{3}} customer number (CRN)
 *  3. If no provider is configured the guest page now offers "Say hi on WhatsApp" (opens the restaurant's
 *     WhatsApp with name + table + CRN filled in) — the free WhatsApp Business app "Greeting message"
 *     then auto-replies. Number = CLIENT_SETTINGS.WHATSAPP_NUMBER, else RESTAURANT_PHONE.
 *
 * INSTALL
 *  A) Replace the old CRM .gs with this file.  B) menu-card-qr-promo.gs (updated) routes GUEST_CHECKIN in doGet.
 *  C) Script properties for WhatsApp (pick one):
 *       META:   WA_PROVIDER=META  META_WA_TOKEN=<permanent token>  META_WA_PHONE_ID=<phone number id>
 *               META_WA_TEMPLATE=guest_welcome  META_WA_LANG=en
 *       TWILIO: WA_PROVIDER=TWILIO  TWILIO_SID  TWILIO_TOKEN  TWILIO_FROM_WA=whatsapp:+91…  TWILIO_WA_CONTENT_SID=HX…
 *     SMS fallback (optional): SMS_PROVIDER=FAST2SMS + FAST2SMS_KEY   (or MSG91_* / TWILIO_FROM_SMS)
 *  D) Run bnxCrmTest() once (authorises + writes a test guest), then Deploy > Manage deployments > Edit > NEW VERSION.
 */

var CRM_TEST_CLIENT = 'CL00010';
/* CL00010_MASTER_DB already has CUSTOMER_MASTER (credit customers). QR guests use their OWN tabs. */
var CRM_SHEET = 'GUEST_CRM';               // in  <clientId>_MASTER_DB
var CRM_LOG   = 'GUEST_WELCOME_LOG';       // in  <clientId>_MASTER_DB
var CRM_TXN   = 'GUEST_TRANSACTIONS';      // in  <clientId>_TRANSACTION_DB
var CRM_TXN_HEAD = ['TXN_ID','DATE_TIME','MOBILE','NAME','TYPE','ORDER_NO','TABLE','ITEMS','AMOUNT','DISCOUNT',
                    'POINTS_EARNED','POINTS_REDEEMED','POINTS_BALANCE','SOURCE','CLIENT_ID','CUSTOMER_ID','EVENT'];
var CRM_HEAD  = ['MOBILE','NAME','FIRST_VISIT','LAST_VISIT','VISIT_COUNT','POINTS','TOTAL_ORDERS','TOTAL_SPEND',
                 'WELCOME_SENT','OPT_IN','LAST_TABLE','SOURCE','LAST_SCAN_KEY','CLIENT_ID','CRN','WELCOME_CHANNEL','CUSTOMER_ID','LAST_EVENT','EVENTS'];
var CRM_LOG_HEAD = ['TIME','MOBILE','CHANNEL','RESULT','TEXT','CLIENT_ID'];

/* ───────────── router: lives in "Router bnxcrmroute.gs" (never define bnxCrmRoute_ twice) ───────────── */

/* per-client override: KEY_<clientId> wins over KEY */
function bnxCrmProp_(P, key, clientId) {
  return (clientId && P.getProperty(key + '_' + clientId)) || P.getProperty(key) || '';
}

/* ───────────── which spreadsheet holds which tab ───────────── */
function bnxCrmKind_(tabName) { return tabName === CRM_TXN ? 'TRANSACTIONS' : 'MASTER'; }

function bnxCrmFindFile_(cid, kind) {
  var MIME = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
  var want = kind === 'MASTER' ? /MASTER/i : /TRANS/i;
  var skip = /^copy of|backup|old|test/i;
  /* first look inside Drive › CLIENT_DATABASES › <clientId> (the real database folder), then anywhere */
  try {
    if (typeof bnxMcRootFolder_ === 'function') {
      var cf = bnxMcRootFolder_().getFoldersByName(cid);
      if (cf.hasNext()) {
        var own = null, fi = cf.next().searchFiles(MIME);
        while (fi.hasNext()) { var x = fi.next(), xn = x.getName();
          if (xn.toUpperCase().indexOf(cid.toUpperCase()) !== 0 || !want.test(xn) || skip.test(xn)) continue;
          if (!own || xn.length < own.getName().length) own = x; }
        if (own) return own;
      }
    }
  } catch (e) {}
  var best = null, it = DriveApp.searchFiles("title contains '" + cid + "' and " + MIME);
  while (it.hasNext()) {
    var f = it.next(), n = f.getName();
    if (n.toUpperCase().indexOf(cid.toUpperCase()) !== 0) continue;
    if (!want.test(n) || skip.test(n)) continue;
    if (!best || n.length < best.getName().length) best = f;
  }
  return best;
}

/* noCreate=true → throw instead of creating a new spreadsheet (used by the public guest route) */
function bnxCrmSpreadsheet_(clientId, kind, noCreate) {
  kind = kind || 'MASTER';
  var P = PropertiesService.getScriptProperties();
  var cid = String(clientId || '').trim();
  if (!cid) {
    if (noCreate) throw new Error('Client ID required');
    var gid = P.getProperty('CRM_SHEET_ID');
    return gid ? SpreadsheetApp.openById(gid) : SpreadsheetApp.getActiveSpreadsheet();
  }
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(cid)) throw new Error('Invalid client id');
  var key = 'CRM_' + kind + '_ID_' + cid, id = P.getProperty(key);
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { P.deleteProperty(key); } }

  var f = bnxCrmFindFile_(cid, kind);
  if (f) { P.setProperty(key, f.getId()); return SpreadsheetApp.open(f); }

  if (noCreate || (P.getProperty('CRM_AUTO_CREATE') || 'YES').toUpperCase() === 'NO') throw new Error('No ' + kind + ' spreadsheet found for ' + cid);
  var ss = SpreadsheetApp.create(cid + '_' + kind);
  /* keep it in Drive › CLIENT_DATABASES › <clientId>, not in the Drive root */
  try { if (typeof bnxMcRootFolder_ === 'function') { var root = bnxMcRootFolder_(), it2 = root.getFoldersByName(cid);
        DriveApp.getFileById(ss.getId()).moveTo(it2.hasNext() ? it2.next() : root.createFolder(cid)); } } catch (e) { Logger.log('move new sheet: ' + e.message); }
  P.setProperty(key, ss.getId());
  Logger.log('Created new spreadsheet ' + ss.getName() + ' — no existing ' + kind + ' file was found for ' + cid);
  return ss;
}

function bnxCrmSetDb(clientId, kind, spreadsheetId) {
  /* Run-button safe: this helper needs 3 inputs. Pressing Run on it alone used to stop with
     "kind must be 'MASTER' or 'TRANSACTIONS'" — now it shows what is linked and how to use it. */
  if (!clientId || !kind || !spreadsheetId) {
    Logger.log('bnxCrmSetDb needs 3 inputs — e.g. bnxCrmSetDb("CL00010", "MASTER", "<sheet id from its URL>").');
    Logger.log('Nothing to fix here if the guest pages already save. Current links for ' + CRM_TEST_CLIENT + ':');
    try { bnxCrmWhere(CRM_TEST_CLIENT); } catch (e) { Logger.log('  ' + e.message); }
    return;
  }
  kind = String(kind).toUpperCase();
  if (kind !== 'MASTER' && kind !== 'TRANSACTIONS') throw new Error("kind must be 'MASTER' or 'TRANSACTIONS'");
  var ss = SpreadsheetApp.openById(spreadsheetId);
  PropertiesService.getScriptProperties().setProperty('CRM_' + kind + '_ID_' + clientId, spreadsheetId);
  Logger.log('OK  ' + kind + ' for ' + clientId + ' = ' + ss.getName() + '  ' + ss.getUrl());
}
function bnxCrmWhere(clientId) {
  clientId = clientId || CRM_TEST_CLIENT;
  [[CRM_SHEET, CRM_HEAD], [CRM_LOG, CRM_LOG_HEAD], [CRM_TXN, CRM_TXN_HEAD]].forEach(function (t) {
    var sh = bnxCrmSheet_(t[0], t[1], clientId), ss = sh.getParent();
    Logger.log(t[0] + '  ->  ' + ss.getName() + '   rows: ' + Math.max(0, sh.getLastRow() - 1) + '   ' + ss.getUrl());
  });
}

/* ───────────── CRN: CRN-00001 per restaurant ───────────── */
function bnxCrmNextCrn_(sh) {
  var C = bnxCrmCols_(sh), last = sh.getLastRow(), max = 0;
  if (C.CRN && last > 1) {
    sh.getRange(2, C.CRN, last - 1, 1).getValues().forEach(function (r) {
      var n = parseInt(String(r[0]).replace(/\D/g, ''), 10); if (n > max) max = n;
    });
  }
  return 'CRN-' + ('00000' + (max + 1)).slice(-5);
}
function bnxCrmBackfillCrn(clientId) {
  clientId = clientId || CRM_TEST_CLIENT;
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, clientId), C = bnxCrmCols_(sh), n = 0;
    for (var r = 2; r <= sh.getLastRow(); r++) {
      if (String(sh.getRange(r, C.CRN).getValue()).trim()) continue;
      sh.getRange(r, C.CRN).setValue(bnxCrmNextCrn_(sh)); n++;
    }
    Logger.log('CRN assigned to ' + n + ' guest(s)');
  } finally { lock.releaseLock(); }
}

/* ───────────── sheet helpers (header-name based) ───────────── */
function bnxCrmSheet_(name, head, clientId, noCreate) {
  var ss = bnxCrmSpreadsheet_(clientId, bnxCrmKind_(name), noCreate);
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#f3e6d8');
    sh.setFrozenRows(1);
    if (name === CRM_SHEET) sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');   /* mobile stays text */
    return sh;
  }
  var lc = Math.max(sh.getLastColumn(), 1);
  var cur = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (x) { return String(x).trim().toUpperCase(); });
  var used = cur.length; while (used > 0 && !cur[used - 1]) used--;
  var miss = head.filter(function (h) { return cur.indexOf(h) < 0; });
  if (miss.length) sh.getRange(1, used + 1, 1, miss.length).setValues([miss]).setFontWeight('bold').setBackground('#f3e6d8');
  return sh;
}
function bnxCrmCols_(sh) {
  var lc = Math.max(sh.getLastColumn(), 1), m = {};
  sh.getRange(1, 1, 1, lc).getValues()[0].forEach(function (h, i) { h = String(h).trim().toUpperCase(); if (h && !m[h]) m[h] = i + 1; });
  return m;
}
function bnxCrmAppend_(sh, obj) {
  var C = bnxCrmCols_(sh), row = [], w = Math.max(sh.getLastColumn(), 1);
  for (var i = 0; i < w; i++) row.push('');
  Object.keys(obj).forEach(function (k) { if (C[k]) row[C[k] - 1] = obj[k]; });
  sh.appendRow(row);
  return sh.getLastRow();
}
function bnxCrmFind_(sh, mobile, clientId) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var C = bnxCrmCols_(sh), mc = C.MOBILE, cc = C.CLIENT_ID;
  var mv = sh.getRange(2, mc, last - 1, 1).getDisplayValues();
  var cv = cc ? sh.getRange(2, cc, last - 1, 1).getDisplayValues() : null;
  for (var i = 0; i < mv.length; i++) {
    if (String(mv[i][0]).replace(/\D/g, '').slice(-10) !== mobile) continue;
    var rc = cv ? String(cv[i][0] || '') : '';
    if (!clientId || !rc || rc === String(clientId)) return i + 2;
  }
  return 0;
}
function bnxCrmClean_(n) {
  return String(n || '').replace(/[0-9<>{}\[\]\\\/=+*^%$#@!~`|;:"?,&()_]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
    .split(' ').map(function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''; }).join(' ');
}

/* ───────────── lists for the dashboard ───────────── */
function bnxCrmList_(name, head, req, max) {
  var sh = bnxCrmSheet_(name, head, req.clientId), last = sh.getLastRow();
  if (last < 2) return { success: true, data: [] };
  var tz = Session.getScriptTimeZone(), lc = sh.getLastColumn();
  var hdr = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h).trim().toUpperCase(); });
  var rows = sh.getRange(2, 1, last - 1, lc).getValues().map(function (r) {
    var o = {};
    hdr.forEach(function (h, i) { if (h) o[h] = r[i] instanceof Date ? Utilities.formatDate(r[i], tz, 'yyyy-MM-dd HH:mm') : r[i]; });
    return o;
  });
  if (req.clientId) rows = rows.filter(function (o) { return !o.CLIENT_ID || String(o.CLIENT_ID) === String(req.clientId); });
  if (req.mobile) { var m = String(req.mobile).replace(/\D/g, '').slice(-10); rows = rows.filter(function (o) { return String(o.MOBILE).slice(-10) === m; }); }
  if (req.event) { var ev = String(req.event).trim().toLowerCase();
    rows = rows.filter(function (o) { return String(o.EVENT || o.EVENTS || o.LAST_EVENT || '').toLowerCase().split('|').map(function (x) { return x.trim(); }).indexOf(ev) >= 0; }); }
  if (req.fromDate || req.toDate) { var f = String(req.fromDate || '0000'), t2 = String(req.toDate || '9999') + '~';
    rows = rows.filter(function (o) { var d = String(o.LAST_VISIT || o.DATE_TIME || ''); return d >= f && d <= t2; }); }
  return { success: true, data: rows.reverse().slice(0, max) };
}

/* ───────────── PUBLIC GUEST CHECK-IN  (GET ?action=GUEST_CHECKIN&clientId=…&mobileNo=…&customerName=…) ─────────────
   For the QR page, which has no login. Writes only to GUEST_CRM / GUEST_WELCOME_LOG / GUEST_TRANSACTIONS of a client
   that already exists. Never creates spreadsheets. Rate-limited. Welcome goes once per guest (WELCOME_SENT). */
function bnxGuestCheckinPublic_(p) {
  p = p || {};
  try {
    var cid = String(p.clientId || '').trim();
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(cid)) return { success: false, error: 'Invalid client' };
    var mobile = String(p.mobileNo || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(mobile)) return { success: false, error: 'Enter a valid 10-digit mobile number' };
    bnxCrmSpreadsheet_(cid, 'MASTER', true);                              /* unknown client → error, nothing created */

    var cache = CacheService.getScriptCache(), slot = Math.floor(Date.now() / 600000);
    var ck = 'gci_c_' + cid + '_' + slot, mk = 'gci_m_' + cid + '_' + mobile + '_' + slot;
    var nc = Number(cache.get(ck) || 0), nm = Number(cache.get(mk) || 0);
    if (nc >= 120) return { success: false, error: 'Busy — please try again in a few minutes' };
    if (nm >= 8) return { success: false, error: 'Too many attempts for this number — please wait a few minutes' };
    cache.put(ck, String(nc + 1), 900); cache.put(mk, String(nm + 1), 900);

    var bool = function (v, d) { if (v === undefined || v === null || v === '') return d; return !/^(0|false|no|off)$/i.test(String(v)); };
    var req = {
      clientId: cid, mobileNo: mobile,
      customerName: String(p.customerName || p.name || '').slice(0, 60),
      tableId: String(p.tableId || '').slice(0, 20),
      scanKey: String(p.scanKey || '').slice(0, 60),
      requestId: String(p.requestId || '').slice(0, 80),
      notifyOptIn: bool(p.notifyOptIn, true),
      welcomeSms: bool(p.welcomeSms, false),
      deferWelcome: bool(p.deferWelcome, false),
      source: String(p.source || 'QR_SCAN').slice(0, 60),
      eventName: String(p.eventName || p.partyName || '').replace(/[|<>=]/g, '').trim().slice(0, 60),
      _noCreate: true
    };
    return bnxCustomerCheckin_(req);
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* ───────────── CUSTOMER_CHECKIN ───────────── */
function bnxCustomerCheckin_(req) {
  var mobile = String(req.mobileNo || '').replace(/\D/g, '').slice(-10);
  if (mobile.length !== 10) return { success: false, error: 'Invalid mobile number' };

  var cache = CacheService.getScriptCache(), rk = 'crm_' + (req.clientId || '') + '_' + (req.requestId || '');
  if (req.requestId && cache.get(rk)) return JSON.parse(cache.get(rk));

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, req.clientId, !!req._noCreate);
    var name = bnxCrmClean_(req.customerName), now = new Date();
    var row = bnxCrmFind_(sh, mobile, req.clientId);
    var out, isNewRow = false, newScanFlag = false, warn = [];

    if (!row) {
      var newCrn = bnxCrmNextCrn_(sh);
      row = bnxCrmAppend_(sh, { MOBILE: mobile, NAME: name, FIRST_VISIT: now, LAST_VISIT: now, VISIT_COUNT: 1, POINTS: 0,
        TOTAL_ORDERS: 0, TOTAL_SPEND: 0, WELCOME_SENT: '', OPT_IN: req.notifyOptIn === false ? 'NO' : 'YES',
        LAST_TABLE: req.tableId || '', SOURCE: req.source || 'QR_SCAN', LAST_SCAN_KEY: req.scanKey || '', CLIENT_ID: req.clientId || '',
        CRN: newCrn, CUSTOMER_ID: newCrn, LAST_EVENT: req.eventName || '', EVENTS: req.eventName || '',
        LAST_SCAN_KEY: bnxCrmVisitKey_(req) });
      isNewRow = true;
      out = { success: true, isNewCustomer: !name, customerName: name, points: 0, visitCount: 1, crn: newCrn, customerId: newCrn };
    } else {
      var C = bnxCrmCols_(sh);
      var cur = sh.getRange(row, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
      var g = function (h) { return C[h] ? cur[C[h] - 1] : ''; };
      var set = function (h, v) { if (C[h]) sh.getRange(row, C[h]).setValue(v); };
      var savedName = g('NAME'), visits = Number(g('VISIT_COUNT') || 0);
      var vkey = bnxCrmVisitKey_(req), prevKey = String(g('LAST_SCAN_KEY') || '');
      var upgradeVisit = !!(req.eventName && req.scanKey && prevKey === req.scanKey);   /* same visit, event chosen now */
      newScanFlag = !!(req.scanKey && vkey !== prevKey && !upgradeVisit && !req.customerName);
      if (req.eventName) {
        set('LAST_EVENT', req.eventName);
        var evs = String(g('EVENTS') || '').split('|').map(function (x) { return x.trim(); }).filter(String);
        if (evs.indexOf(req.eventName) < 0) { evs.push(req.eventName); set('EVENTS', evs.join(' | ')); }
        if (upgradeVisit) { try { bnxCrmSetLastVisitEvent_(req.clientId, mobile, req.eventName, !!req._noCreate); } catch (e) { warn.push('txn event: ' + e.message); } }
      }
      if (name && name !== savedName) set('NAME', name);
      if (newScanFlag) { visits++; set('VISIT_COUNT', visits); }
      set('LAST_VISIT', now);
      if (req.tableId) set('LAST_TABLE', req.tableId);
      if (req.scanKey) set('LAST_SCAN_KEY', vkey);
      if (req.notifyOptIn === false) set('OPT_IN', 'NO');
      else if (req.notifyOptIn === true && String(g('OPT_IN')).toUpperCase() === 'NO' && req.customerName) set('OPT_IN', 'YES');
      var finalName = name || savedName;
      var crn = g('CRN');
      if (!crn && C.CRN) { crn = bnxCrmNextCrn_(sh); set('CRN', crn); }
      if (crn && String(g('CUSTOMER_ID') || '') !== String(crn)) set('CUSTOMER_ID', crn);
      out = { success: true, isNewCustomer: !finalName, customerName: finalName, points: Number(g('POINTS') || 0), visitCount: visits || 1, crn: crn, customerId: crn };
      /* name arrived after the visit was logged → put it (and the id) on the guest's earlier rows */
      if (name && name !== savedName) {
        try { bnxCrmFillTxn_(req.clientId, mobile, name, crn, !!req._noCreate); } catch (e) { warn.push('txn name: ' + e.message); }
      }
    }

    if (isNewRow || newScanFlag) {
      try {
        bnxCrmLogTxn_({ mobile: mobile, name: out.customerName, customerId: out.crn, event: req.eventName || '', type: 'VISIT', table: req.tableId, source: req.source || 'QR_SCAN',
          balance: out.points, clientId: req.clientId, key: 'visit-' + (req.clientId || '') + '-' + (bnxCrmVisitKey_(req) || req.requestId || mobile + now.getTime()) + '-' + mobile,
          noCreate: !!req._noCreate });
      } catch (e) { warn.push('txn: ' + e.message); Logger.log('VISIT log failed: ' + e.message); }
    }

    /* automatic welcome: once per customer, as soon as we know the name */
    var C2 = bnxCrmCols_(sh);
    var sent = C2.WELCOME_SENT ? sh.getRange(row, C2.WELCOME_SENT).getValue() : '';
    var optIn = C2.OPT_IN ? String(sh.getRange(row, C2.OPT_IN).getValue()).toUpperCase() !== 'NO' : true;
    var wantWelcome = req.welcomeSms === true || !req.deferWelcome;
    out.welcomeSent = !!sent;
    var wk = 'wel_' + (req.clientId || '') + '_' + mobile;
    if (!sent && optIn && out.customerName && wantWelcome && cache.get(wk)) { out.welcome = 'recent'; }
    else if (!sent && optIn && out.customerName && wantWelcome) {
      cache.put(wk, '1', 300);
      var r = bnxSendWelcome_(mobile, out.customerName, req.clientId, out.crn);
      if (r.ok) {
        if (C2.WELCOME_SENT) sh.getRange(row, C2.WELCOME_SENT).setValue(Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'));
        if (C2.WELCOME_CHANNEL) sh.getRange(row, C2.WELCOME_CHANNEL).setValue(r.channel);
      }
      out.welcome = r.ok ? 'sent' : (r.configured ? 'failed' : 'not_configured');
      out.welcomeChannel = r.channel || '';
      out.welcomeSent = !!r.ok;
    }
    if (warn.length) out.warn = warn.join(' | ');
    if (req.requestId) cache.put(rk, JSON.stringify(out), 600);
    return out;
  } finally { lock.releaseLock(); }
}

/* ───────────── welcome message ───────────── */
function bnxCrmRestaurantName_(clientId) {
  var ss = bnxCrmSpreadsheet_(clientId, 'MASTER');
  var look = [['COMPANY_SETTINGS', 'COMPANY_NAME'], ['CLIENT_SETTINGS', 'RESTAURANT_NAME']];
  for (var k = 0; k < look.length; k++) {
    try {
      var sh = ss.getSheetByName(look[k][0]); if (!sh || sh.getLastRow() < 2) continue;
      var vals = sh.getDataRange().getValues(), H = vals[0].map(function (h) { return String(h).trim().toUpperCase(); });
      var ci = H.indexOf('CLIENT_ID'), ni = H.indexOf(look[k][1]); if (ni < 0) continue;
      for (var i = 1; i < vals.length; i++) {
        if ((ci < 0 || String(vals[i][ci]) === String(clientId)) && String(vals[i][ni]).trim()) return String(vals[i][ni]).trim();
      }
    } catch (e) {}
  }
  return ss.getName().replace(/_?(V\d+_?)?(MASTER|DATABASE)(_DB)?$/i, '');
}
/* returns { ok, channel, configured } */
function bnxSendWelcome_(mobile, name, clientId, crn) {
  var P = PropertiesService.getScriptProperties();
  var pr = function (k) { return bnxCrmProp_(P, k, clientId); };
  var restaurant = pr('RESTAURANT_NAME') || bnxCrmRestaurantName_(clientId);
  var tpl = pr('WELCOME_TEXT') || (crn ? 'Hi {name}, welcome to {restaurant}! Your customer number is {crn}. Enjoy your meal.' : 'Hi {name}, welcome to {restaurant}! Thank you for visiting us. Enjoy your meal.');
  var first = String(name || '').split(' ')[0] || 'Guest';
  var text = tpl.split('{name}').join(first).split('{restaurant}').join(restaurant).split('{crn}').join(crn || '');
  var results = [];
  var wa  = String(pr('WA_PROVIDER') || 'NONE').toUpperCase();
  var sms = String(pr('SMS_PROVIDER') || 'NONE').toUpperCase();
  var configured = wa !== 'NONE' || sms !== 'NONE';

  try {
    if (wa === 'META') results.push(['WHATSAPP', metaWa_(pr, mobile, [first, restaurant, crn || '-'])]);
    else if (wa === 'TWILIO') results.push(['WHATSAPP', twilioWa_(P, pr, mobile, text, [first, restaurant, crn || '-'])]);
  } catch (e) { results.push(['WHATSAPP', 'ERR ' + e.message]); }
  var waOk = results.length && String(results[0][1]).indexOf('ERR') !== 0;
  if (!waOk) {
    try {
      if (sms === 'FAST2SMS') results.push(['SMS', fast2sms_(pr, mobile, text)]);
      else if (sms === 'MSG91') results.push(['SMS', msg91_(pr, mobile, first, restaurant)]);
      else if (sms === 'TWILIO') results.push(['SMS', twilio_(pr, '+91' + mobile, pr('TWILIO_FROM_SMS'), text)]);
    } catch (e) { results.push(['SMS', 'ERR ' + e.message]); }
  }
  var okRow = results.filter(function (x) { return String(x[1]).indexOf('ERR') !== 0; })[0];
  if (!configured) Logger.log('Welcome not sent: set WA_PROVIDER / SMS_PROVIDER in Script properties');
  try {
    bnxCrmAppend_(bnxCrmSheet_(CRM_LOG, CRM_LOG_HEAD, clientId), { TIME: new Date(), MOBILE: mobile,
      CHANNEL: results.map(function (x) { return x[0]; }).join('+') || 'NONE', RESULT: (configured ? JSON.stringify(results) : 'NOT CONFIGURED').slice(0, 300),
      TEXT: text, CLIENT_ID: clientId || '' });
  } catch (e) { Logger.log('WELCOME_LOG failed: ' + e.message); }
  return { ok: !!okRow, channel: okRow ? okRow[0] : '', configured: configured };
}

/* Meta WhatsApp Cloud API — approved template, body variables {{1}} {{2}} {{3}} */
function metaWa_(pr, mobile, vars) {
  var token = pr('META_WA_TOKEN'), phoneId = pr('META_WA_PHONE_ID');
  if (!token || !phoneId) throw new Error('META_WA_TOKEN / META_WA_PHONE_ID not set');
  var body = { messaging_product: 'whatsapp', to: '91' + mobile, type: 'template',
    template: { name: pr('META_WA_TEMPLATE') || 'guest_welcome', language: { code: pr('META_WA_LANG') || 'en' },
      components: [{ type: 'body', parameters: vars.map(function (v) { return { type: 'text', text: String(v).slice(0, 60) }; }) }] } };
  var res = UrlFetchApp.fetch('https://graph.facebook.com/' + (pr('META_WA_VERSION') || 'v20.0') + '/' + phoneId + '/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify(body) });
  var j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (!(j.messages && j.messages.length)) throw new Error((j.error && (j.error.message || j.error.error_user_msg)) || ('Meta HTTP ' + res.getResponseCode()));
  return 'OK ' + j.messages[0].id;
}
/* Twilio WhatsApp — approved Content template when TWILIO_WA_CONTENT_SID is set (needed for first contact) */
function twilioWa_(P, pr, mobile, text, vars) {
  var from = pr('TWILIO_FROM_WA'); if (from && from.indexOf('whatsapp:') !== 0) from = 'whatsapp:' + from;
  var sid = pr('TWILIO_WA_CONTENT_SID');
  var payload = { To: 'whatsapp:+91' + mobile, From: from };
  if (sid) { payload.ContentSid = sid; payload.ContentVariables = JSON.stringify({ '1': vars[0], '2': vars[1], '3': vars[2] }); }
  else payload.Body = text;
  return twilioSend_(pr, payload);
}
function fast2sms_(pr, mobile, text) {
  var res = UrlFetchApp.fetch('https://www.fast2sms.com/dev/bulkV2', { method: 'post', muteHttpExceptions: true,
    headers: { authorization: pr('FAST2SMS_KEY') }, payload: { route: 'q', message: text, language: 'english', flash: 0, numbers: mobile } });
  var j = JSON.parse(res.getContentText());
  if (!j.return) throw new Error(j.message || 'Fast2SMS failed');
  return 'OK';
}
function msg91_(pr, mobile, name, restaurant) {
  var res = UrlFetchApp.fetch('https://control.msg91.com/api/v5/flow/', { method: 'post', muteHttpExceptions: true, contentType: 'application/json',
    headers: { authkey: pr('MSG91_AUTHKEY') },
    payload: JSON.stringify({ template_id: pr('MSG91_TEMPLATE_ID'), sender: pr('MSG91_SENDER'),
      short_url: '0', recipients: [{ mobiles: '91' + mobile, name: name, restaurant: restaurant }] }) });
  var j = JSON.parse(res.getContentText());
  if (j.type !== 'success') throw new Error(j.message || 'MSG91 failed');
  return 'OK';
}
function twilio_(pr, to, from, text) { return twilioSend_(pr, { To: to, From: from, Body: text }); }
function twilioSend_(pr, payload) {
  var sid = pr('TWILIO_SID');
  var res = UrlFetchApp.fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', { method: 'post', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + pr('TWILIO_TOKEN')) }, payload: payload });
  var j = JSON.parse(res.getContentText());
  if (!j.sid) throw new Error(j.message || 'Twilio failed');
  return 'OK';
}

/* ───────────── transactions → <clientId>_TRANSACTION_DB ───────────── */
function bnxCrmLogTxn_(t) {
  var P = PropertiesService.getScriptProperties();
  if ((P.getProperty('CRM_TXN_LOG') || 'YES').toUpperCase() === 'NO') return;
  var cache = CacheService.getScriptCache(), k = 'txn_' + String(t.key || '').slice(0, 200);
  if (t.key && cache.get(k)) return;
  var sh = bnxCrmSheet_(CRM_TXN, CRM_TXN_HEAD, t.clientId, !!t.noCreate);
  bnxCrmAppend_(sh, {
    TXN_ID: 'TX' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10),
    DATE_TIME: new Date(), MOBILE: t.mobile, NAME: t.name || '', TYPE: t.type, ORDER_NO: t.orderNo || '', TABLE: t.table || '',
    ITEMS: t.items || '', AMOUNT: Number(t.amount || 0), DISCOUNT: Number(t.discount || 0), POINTS_EARNED: Number(t.earned || 0),
    POINTS_REDEEMED: Number(t.redeemed || 0), POINTS_BALANCE: t.balance == null ? '' : t.balance, SOURCE: t.source || '', CLIENT_ID: t.clientId || '',
    CUSTOMER_ID: t.customerId || '', EVENT: t.event || '' });
  if (t.key) cache.put(k, '1', 21600);
}

/* fill NAME / CUSTOMER_ID on this guest's GUEST_TRANSACTIONS rows that were written before we knew them */
/* visit key = scan key + event, so the same guest at two events on one day = two visits */
function bnxCrmVisitKey_(req) {
  var k = String(req.scanKey || '');
  return req.eventName ? (k + '|ev:' + String(req.eventName).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24)) : k;
}
/* guest picked the event after the visit was logged → put it on that latest VISIT row */
function bnxCrmSetLastVisitEvent_(clientId, mobile, ev, noCreate) {
  var sh = bnxCrmSheet_(CRM_TXN, CRM_TXN_HEAD, clientId, noCreate), last = sh.getLastRow(), C = bnxCrmCols_(sh);
  if (last < 2 || !C.EVENT || !C.MOBILE) return;
  for (var r = last; r >= 2 && r > last - 400; r--) {
    if (String(sh.getRange(r, C.MOBILE).getDisplayValue()).replace(/\D/g, '').slice(-10) !== mobile) continue;
    if (C.TYPE && String(sh.getRange(r, C.TYPE).getValue()) !== 'VISIT') continue;
    if (!String(sh.getRange(r, C.EVENT).getValue() || '').trim()) sh.getRange(r, C.EVENT).setValue(ev);
    return;
  }
}
function bnxCrmFillTxn_(clientId, mobile, name, crn, noCreate) {
  var sh = bnxCrmSheet_(CRM_TXN, CRM_TXN_HEAD, clientId, noCreate), last = sh.getLastRow();
  if (last < 2) return 0;
  var C = bnxCrmCols_(sh); if (!C.MOBILE) return 0;
  var n = 0, mob = sh.getRange(2, C.MOBILE, last - 1, 1).getDisplayValues();
  var nm = C.NAME ? sh.getRange(2, C.NAME, last - 1, 1).getValues() : null;
  var id = C.CUSTOMER_ID ? sh.getRange(2, C.CUSTOMER_ID, last - 1, 1).getValues() : null;
  var cl = C.CLIENT_ID ? sh.getRange(2, C.CLIENT_ID, last - 1, 1).getDisplayValues() : null;
  for (var i = 0; i < mob.length; i++) {
    if (String(mob[i][0]).replace(/\D/g, '').slice(-10) !== mobile) continue;
    if (cl && clientId && cl[i][0] && String(cl[i][0]) !== String(clientId)) continue;
    if (nm && name && !String(nm[i][0] || '').trim()) { nm[i][0] = name; n++; }
    if (id && crn && !String(id[i][0] || '').trim()) { id[i][0] = crn; n++; }
  }
  if (n) { if (nm) sh.getRange(2, C.NAME, last - 1, 1).setValues(nm); if (id) sh.getRange(2, C.CUSTOMER_ID, last - 1, 1).setValues(id); }
  return n;
}

/* run once from the editor: CRN + CUSTOMER_ID on every GUEST_CRM row, then NAME / CUSTOMER_ID on GUEST_TRANSACTIONS */
function bnxCrmRepairIds(clientId) {
  clientId = clientId || CRM_TEST_CLIENT;
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, clientId), C = bnxCrmCols_(sh), last = sh.getLastRow(), fixed = 0, txn = 0;
    for (var r = 2; r <= last; r++) {
      var crn = String(sh.getRange(r, C.CRN).getValue() || '').trim();
      if (!crn) { crn = bnxCrmNextCrn_(sh); sh.getRange(r, C.CRN).setValue(crn); fixed++; }
      if (C.CUSTOMER_ID && String(sh.getRange(r, C.CUSTOMER_ID).getValue() || '').trim() !== crn) { sh.getRange(r, C.CUSTOMER_ID).setValue(crn); fixed++; }
      var mobile = String(sh.getRange(r, C.MOBILE).getDisplayValue()).replace(/\D/g, '').slice(-10);
      var name = C.NAME ? String(sh.getRange(r, C.NAME).getValue() || '').trim() : '';
      if (mobile.length === 10) txn += bnxCrmFillTxn_(clientId, mobile, name, crn, false);
    }
    Logger.log('GUEST_CRM ids set: ' + fixed + ' · GUEST_TRANSACTIONS cells filled: ' + txn);
  } finally { lock.releaseLock(); }
}

/* Call after a successful SAVE_ORDER. */
function bnxCrmAfterOrder_(req, result) {
  try {
    var mobile = String(req.mobileNo || '').replace(/\D/g, '').slice(-10);
    if (mobile.length !== 10 || (result && result.success === false)) return;
    var orderNo = (result && (result.orderNo || (result.data && result.data.ORDER_NO))) || '';
    var key = 'order-' + (orderNo || req.requestId || '');
    if (CacheService.getScriptCache().get('txn_' + key)) return;

    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, req.clientId), row = bnxCrmFind_(sh, mobile, req.clientId);
      var amount = Number(req.billAmount || 0), earned = Number((result && result.earned) || 0), redeemed = Number(req.redeemedPoints || 0);
      var name = bnxCrmClean_(req.customerName);
      if (!row) {
        row = bnxCrmAppend_(sh, { MOBILE: mobile, NAME: name === 'Guest' ? '' : name, FIRST_VISIT: new Date(), LAST_VISIT: new Date(), VISIT_COUNT: 1,
          POINTS: 0, TOTAL_ORDERS: 0, TOTAL_SPEND: 0, OPT_IN: 'YES', LAST_TABLE: req.tableId || '', SOURCE: req.orderSource || 'ORDER',
          LAST_SCAN_KEY: req.scanKey || '', CLIENT_ID: req.clientId || '', CRN: bnxCrmNextCrn_(sh) });
      }
      var C = bnxCrmCols_(sh);
      var ocrn = C.CRN ? String(sh.getRange(row, C.CRN).getValue() || '') : '';
      if (!ocrn && C.CRN) { ocrn = bnxCrmNextCrn_(sh); sh.getRange(row, C.CRN).setValue(ocrn); }
      if (ocrn && C.CUSTOMER_ID && !String(sh.getRange(row, C.CUSTOMER_ID).getValue() || '')) sh.getRange(row, C.CUSTOMER_ID).setValue(ocrn);
      var add = function (h, v) { if (!C[h]) return; var c = sh.getRange(row, C[h]); c.setValue(Number(c.getValue() || 0) + Number(v || 0)); };
      add('TOTAL_ORDERS', 1); add('TOTAL_SPEND', amount); add('POINTS', earned - redeemed);
      if (C.LAST_VISIT) sh.getRange(row, C.LAST_VISIT).setValue(new Date());
      if (name && name !== 'Guest' && C.NAME && !sh.getRange(row, C.NAME).getValue()) sh.getRange(row, C.NAME).setValue(name);
      var items = (req.items || []).map(function (i) { return (i.qty || 1) + 'x ' + (i.itemName || ''); }).join(', ').slice(0, 400);
      /* the order belongs to the event the guest checked in for today (event-wise sales report) */
      var oev = '';
      try {
        if (C.LAST_EVENT && C.LAST_VISIT) {
          var lv = sh.getRange(row, C.LAST_VISIT).getValue(), bd = function (d) { return Utilities.formatDate(new Date(new Date(d).getTime() - 6 * 3600 * 1000), 'Asia/Kolkata', 'yyyyMMdd'); };
          if (lv && bd(lv) === bd(new Date())) oev = String(sh.getRange(row, C.LAST_EVENT).getValue() || '');
        }
      } catch (e) {}
      bnxCrmLogTxn_({ mobile: mobile, name: C.NAME ? sh.getRange(row, C.NAME).getValue() : name, customerId: ocrn, event: oev, type: 'ORDER', orderNo: orderNo,
        table: req.tableId, items: items, amount: amount, discount: req.redeemedDiscount, earned: earned, redeemed: redeemed,
        balance: C.POINTS ? sh.getRange(row, C.POINTS).getValue() : '', source: req.orderSource || 'CUSTOMER', clientId: req.clientId, key: key });
    } finally { lock.releaseLock(); }
  } catch (e) { Logger.log('bnxCrmAfterOrder_ ' + e.message); }
}

/* ───────────── one-time migration from the v1 "<clientId>_V3_DATABASE" file ───────────── */
function bnxCrmMigrateOld(clientId) {
  clientId = clientId || CRM_TEST_CLIENT;
  var it = DriveApp.searchFiles("title = '" + clientId + "_V3_DATABASE' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  if (!it.hasNext()) { Logger.log('No old ' + clientId + '_V3_DATABASE file found — nothing to move.'); return; }
  var old = SpreadsheetApp.open(it.next());
  [['CUSTOMER_MASTER', CRM_SHEET, CRM_HEAD, 'MOBILE'], ['CUSTOMER_TRANSACTIONS', CRM_TXN, CRM_TXN_HEAD, 'TXN_ID'], ['WELCOME_LOG', CRM_LOG, CRM_LOG_HEAD, 'TIME']].forEach(function (t) {
    var src = old.getSheetByName(t[0]); if (!src || src.getLastRow() < 2) return;
    var dst = bnxCrmSheet_(t[1], t[2], clientId), Cd = bnxCrmCols_(dst);
    var sh = src.getRange(1, 1, 1, src.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toUpperCase(); });
    var have = {}, key = t[3];
    if (dst.getLastRow() > 1) dst.getRange(2, Cd[key], dst.getLastRow() - 1, 1).getValues().forEach(function (r) { have[String(r[0])] = 1; });
    var rows = src.getRange(2, 1, src.getLastRow() - 1, src.getLastColumn()).getValues(), n = 0;
    rows.forEach(function (r) {
      var o = {}; sh.forEach(function (h, i) { o[h] = r[i]; });
      var id = String(o[key] === undefined ? '' : o[key]);
      if (id && have[id]) return;
      bnxCrmAppend_(dst, o); have[id] = 1; n++;
    });
    Logger.log(t[1] + ': moved ' + n + ' row(s) to ' + dst.getParent().getName());
  });
}

/* ───────────── run once from the editor: authorise + test the PUBLIC route exactly as the QR page calls it ───────────── */
function bnxCrmTest() {
  var r = bnxGuestCheckinPublic_({ clientId: CRM_TEST_CLIENT, mobileNo: '9999999999', customerName: 'Test Guest',
    welcomeSms: 'true', requestId: 'test-' + Date.now(), tableId: '1', scanKey: 'qr-test-' + Date.now() });
  Logger.log(JSON.stringify(r));
  Logger.log(r.welcome === 'not_configured' ? '⚠️ Saved to GUEST_CRM, but no WhatsApp/SMS provider is set (Script properties).' :
             r.welcome === 'failed' ? '⚠️ Saved, provider refused — see GUEST_WELCOME_LOG RESULT column.' : '✅ Saved' + (r.welcome === 'sent' ? ' + welcome sent via ' + r.welcomeChannel : ''));
  bnxCrmWhere(CRM_TEST_CLIENT);
}

/* ═════════════ ZERO-TYPING WHATSAPP CHECK-IN (Meta Cloud API webhook) ═════════════ */
/* doGet: Meta's one-time webhook verification (hub.mode=subscribe) */
function bnxWaRouteGet_(e) {
  var p = (e && e.parameter) || {};
  if (p['hub.mode'] !== 'subscribe') return null;
  var want = PropertiesService.getScriptProperties().getProperty('WA_VERIFY_TOKEN') || '';
  var ok = want && p['hub.verify_token'] === want;
  return ContentService.createTextOutput(ok ? String(p['hub.challenge'] || '') : 'forbidden');
}
/* doPost: incoming WhatsApp messages → check-in */
function bnxWaRoutePost_(e) {
  var raw = e && e.postData && e.postData.contents;
  if (!raw || raw.indexOf('whatsapp_business_account') < 0) return null;
  var res = { ok: true, handled: 0 };
  try { res.handled = bnxWaHandle_(JSON.parse(raw)); } catch (err) { res.ok = false; res.error = String(err.message || err); Logger.log('WA webhook: ' + res.error); }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}
function bnxWaHandle_(body) {
  var n = 0, cache = CacheService.getScriptCache(), P = PropertiesService.getScriptProperties();
  (body.entry || []).forEach(function (en) {
    (en.changes || []).forEach(function (ch) {
      var v = ch.value || {}, phoneId = (v.metadata && v.metadata.phone_number_id) || '';
      var names = {}; (v.contacts || []).forEach(function (c) { names[c.wa_id] = c.profile && c.profile.name || ''; });
      (v.messages || []).forEach(function (m) {
        if (!m || !m.id || cache.get('wam_' + m.id)) return;            /* Meta retries — handle each message once */
        cache.put('wam_' + m.id, '1', 21600);
        var text = (m.text && m.text.body) || (m.button && m.button.text) || (m.interactive && m.interactive.button_reply && m.interactive.button_reply.title) || '';
        var r = bnxWaCheckinFromMessage_({ from: m.from, name: names[m.from] || '', text: text, msgId: m.id, phoneId: phoneId }, P);
        if (r) n++;
      });
    });
  });
  return n;
}
/* one WhatsApp message → GUEST_CRM check-in + instant welcome reply. Exposed for testing. */
function bnxWaCheckinFromMessage_(msg, P) {
  P = P || PropertiesService.getScriptProperties();
  var digits = String(msg.from || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.indexOf('91') === 0) digits = digits.slice(2);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;                       /* Indian mobiles only */
  var code = /#CI-([A-Za-z0-9_]{3,30})-(T[A-Za-z0-9]{1,12}|C)(?:-P([A-Za-z0-9_]{1,30}))?(?:-E([A-Za-z0-9_]{1,30}))?/i.exec(String(msg.text || ''));
  var cid = code ? code[1].toUpperCase() : (P.getProperty('WA_CLIENT_' + msg.phoneId) || '');
  if (!cid) return null;                                                /* not a check-in for a known restaurant */
  var table = code && /^T/i.test(code[2]) ? code[2].slice(1) : '';
  var party = code && code[3] ? code[3].replace(/_/g, ' ') : '';      /* "SUFI_NIGHT" → "SUFI NIGHT" */
  var evName = (code && code[4] ? code[4].replace(/_/g, ' ') : '') || party || '';
  var day = Utilities.formatDate(new Date(Date.now() - 6 * 3600 * 1000), 'Asia/Kolkata', 'yyyyMMdd');   /* business day 06:00 */
  var out = bnxCustomerCheckin_({
    clientId: cid, mobileNo: digits, customerName: String(msg.name || '').slice(0, 60), tableId: table,
    scanKey: (party ? 'party-' + party.toLowerCase() : 'qr-' + (table ? table.toLowerCase() : 'counter')) + '-' + day,
    requestId: 'wa-' + msg.msgId, notifyOptIn: true, source: 'WHATSAPP' + (party ? '|PARTY:' + party : ''),
    welcomeSms: false, deferWelcome: true, eventName: evName, _noCreate: true
  });
  if (!out || out.success === false) return out;
  /* reply in the chat the guest opened — free text is allowed for 24 h after their message */
  var pr = function (k) { return bnxCrmProp_(P, k, cid); };
  if (String(pr('WA_PROVIDER')).toUpperCase() === 'META' && !cache_recent_('wr_' + cid + '_' + digits, 300)) {
    var restaurant = pr('RESTAURANT_NAME') || bnxCrmRestaurantName_(cid), first = String(out.customerName || '').split(' ')[0] || 'there';
    var txt = (pr('WA_CHECKIN_REPLY') || 'Hi {name}! ✅ You are checked in at {restaurant}{table}. Your customer number is {crn}. Enjoy your meal!')
      .split('{name}').join(first).split('{restaurant}').join(restaurant).split('{table}').join(table ? ' · Table ' + table : '').split('{crn}').join(out.crn || '-');
    var res;
    try { res = metaWaText_(pr, digits, txt); } catch (e) { res = 'ERR ' + e.message; }
    try {
      var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true), row = bnxCrmFind_(sh, digits, cid), C = bnxCrmCols_(sh);
      if (row && String(res).indexOf('OK') === 0) {
        if (C.WELCOME_SENT && !sh.getRange(row, C.WELCOME_SENT).getValue()) sh.getRange(row, C.WELCOME_SENT).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'));
        if (C.WELCOME_CHANNEL) sh.getRange(row, C.WELCOME_CHANNEL).setValue('WHATSAPP');
      }
      bnxCrmAppend_(bnxCrmSheet_(CRM_LOG, CRM_LOG_HEAD, cid, true), { TIME: new Date(), MOBILE: digits, CHANNEL: 'WHATSAPP_REPLY', RESULT: String(res).slice(0, 300), TEXT: txt, CLIENT_ID: cid });
    } catch (e) { Logger.log('WA reply log: ' + e.message); }
    out.reply = res;
  }
  return out;
}
function cache_recent_(k, sec) { var c = CacheService.getScriptCache(); if (c.get(k)) return true; c.put(k, '1', sec); return false; }
/* Meta Cloud API free-text message (inside the 24 h customer-service window) */
function metaWaText_(pr, mobile, text) {
  var token = pr('META_WA_TOKEN'), phoneId = pr('META_WA_PHONE_ID');
  if (!token || !phoneId) throw new Error('META_WA_TOKEN / META_WA_PHONE_ID not set');
  var res = UrlFetchApp.fetch('https://graph.facebook.com/' + (pr('META_WA_VERSION') || 'v20.0') + '/' + phoneId + '/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ messaging_product: 'whatsapp', to: '91' + mobile, type: 'text', text: { body: String(text).slice(0, 1000) } }) });
  var j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (!(j.messages && j.messages.length)) throw new Error((j.error && j.error.message) || ('Meta HTTP ' + res.getResponseCode()));
  return 'OK ' + j.messages[0].id;
}
/* run from the editor: simulates the webhook for one guest message (no real WhatsApp needed) */
function bnxWaTest() {
  var r = bnxWaCheckinFromMessage_({ from: '919999999998', name: 'WhatsApp Test', text: 'Hi 👋 Please check me in · Table 5\n#CI-' + CRM_TEST_CLIENT + '-T5', msgId: 'test-' + Date.now(), phoneId: '' });
  Logger.log(JSON.stringify(r));
}


/* ───────────── ONE-CLICK (pick in the Run drop-down, no inputs needed) ───────────── */
function RUN_1_CheckWhereGuestsAreSaved() { bnxCrmWhere(CRM_TEST_CLIENT); }
function RUN_2_RepairCustomerIdsAndNames() { bnxCrmRepairIds(CRM_TEST_CLIENT); }
function RUN_3_TestQrCheckin() { bnxCrmTest(); }
function RUN_4_TestWhatsAppCheckin() { bnxWaTest(); }
