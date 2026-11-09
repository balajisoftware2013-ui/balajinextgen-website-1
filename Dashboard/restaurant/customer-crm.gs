/**
 * BALAJI NEXTGEN ERP · HAPPYSERVE — CUSTOMER CRM + AUTO WELCOME (SMS / WhatsApp)   v3.7 — 2026-11-09
 *
 * v3.7 (2026-11-09) — install together with "Guest growth suite.gs" (LAST file). Delete: Guest route.gs, WhatsApp check-in fix.gs,
 *   WhatsApp webhook routing.gs, WhatsApp auto reply.gs, Welcome / reply / SMS fix.gs.
 *   • bnxGuestCfg_, bnxCrmDeviceGuest_, bnxWaHandle_ now live ONLY in Guest growth suite.gs (they were defined 2-3× → whichever
 *     file loaded last won, the QR page got a different config depending on file order).
 *   • Welcome fix applied here: bnxWaEffective_, bnxSendWelcome_ (OK-only success, SMS_ALSO, free mode), out.welcome='free_mode',
 *     WhatsApp check-in reply with SMS fallback (bnxWaReplyOrSms_).
 *   • A #CI code for another restaurant is ignored when this WhatsApp number is mapped to one client (WA_CLIENT_<phone id>).
 *
 * v3.6 (2026-10-09) ROOT FIXES:
 *   • "Lock timeout" / mobile + name lost on a busy night: check-in held the ONE script-wide lock for 10-40 s (3 sheets,
 *     WhatsApp call, 3-database copy). Now a short per-client lock covers only the guest card; the rest runs after it.
 *     Scan logs take no lock at all.
 *   • Visits: one business day (06:00→05:59) = one visit; a different party / event the same night = its own visit;
 *     choosing the party later puts it on that visit. "!customerName" no longer blocks counting (VISIT_COUNT stuck at 1).
 *   • Returning phone (recognised device) scanning a party QR now counts the visit + party (was only in GUEST_SCANS).
 *   • Counter bills carry tonight's party; BILL_MASTER bills are linked to guests by mobile or table + night
 *     (RUN_13_AutoLinkBills once → every 15 min; CRM dashboard "Link bills").
 * v3.5 PROFESSIONAL CHECK-IN: every scan logged (GUEST_SCANS) · returning phone recognised · Truecaller one-tap ·
 *      WhatsApp one-tap · OTP (WhatsApp/SMS) · VERIFIED column · counter bill → CRM + e-bill. See the v3.5 block below.
 * v3.4 ONE SCAN → ALL THREE DATABASES: GUEST_CRM + CUSTOMER_MASTER (MASTER DB), GUEST_TRANSACTIONS (TRANSACTION DB),
 *      and a copy of both guest tabs in <clientId>_CRM_DB. Run RUN_5_CopyAllGuestsToMasterAndCrmDb once for old rows.
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
                 'WELCOME_SENT','OPT_IN','LAST_TABLE','SOURCE','LAST_SCAN_KEY','CLIENT_ID','CRN','WELCOME_CHANNEL','CUSTOMER_ID','LAST_EVENT','EVENTS',
                 'VERIFIED','VERIFIED_BY','EMAIL','CITY','LAST_DEVICE','MARKETING_OPT_IN','CONSENT_AT','CONSENT_VER'];
var CRM_SCAN = 'GUEST_SCANS';             // in  <clientId>_TRANSACTION_DB (+ copy in CRM DB)
var CRM_SCAN_HEAD = ['SCAN_ID','DATE_TIME','CLIENT_ID','DEVICE_ID','PLATFORM','TABLE','EVENT','PARTY','SCAN_KEY','STATUS','MOBILE','NAME','CRN','IDENTIFIED_AT','IDENTIFIED_BY'];
var CRM_LOG_HEAD = ['TIME','MOBILE','CHANNEL','RESULT','TEXT','CLIENT_ID'];

/* ───────────── router: lives in "Router bnxcrmroute.gs" (never define bnxCrmRoute_ twice) ───────────── */

/* per-client override: KEY_<clientId> wins over KEY */
function bnxCrmProp_(P, key, clientId) {
  return (clientId && P.getProperty(key + '_' + clientId)) || P.getProperty(key) || '';
}

/* ───────────── which spreadsheet holds which tab ───────────── */
function bnxCrmKind_(tabName) { return (tabName === CRM_TXN || tabName === CRM_SCAN) ? 'TRANSACTIONS' : 'MASTER'; }

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
/* TIME FIX 2026-10-09 ("timing are show wrong"): the client's MASTER / TRANSACTION sheets are set to a US time zone
   (File › Settings › Time zone), so a real "now" written by this script showed 12½ h early (a 02:49 IST scan showed
   14:19 of the day before). The ERP's own bills are stored as Indian wall-clock time, so guest rows now are too:
   every fresh timestamp (bnxNow_) is written as IST wall-clock in whatever zone the sheet uses. Values copied from
   another sheet are left as they are (no double shift). RUN_11_FixOldGuestTimes corrects the rows written before. */
function bnxNow_() { var d = new Date(); d.__bnxReal = true; return d; }
var BNX_TZ_MEMO = {};
function bnxCrmSheetTz_(sh) {
  try { var ss = sh.getParent ? sh.getParent() : sh, id = ss.getId(); if (!BNX_TZ_MEMO[id]) BNX_TZ_MEMO[id] = ss.getSpreadsheetTimeZone() || 'Asia/Kolkata'; return BNX_TZ_MEMO[id]; }
  catch (e) { return 'Asia/Kolkata'; }
}
function bnxCrmIstWall_(d, tz) {   /* real instant → the Date that shows the same Indian clock time in zone tz */
  if (!tz || /^Asia\/(Kolkata|Calcutta)$/.test(tz)) return new Date(d.getTime());
  return Utilities.parseDate(Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss'), tz, 'yyyy-MM-dd HH:mm:ss');
}
var BNX_TIME_MARKED = false;
function bnxCrmW_(sh, v) {
  if (!(v && v.__bnxReal)) return v;
  if (!BNX_TIME_MARKED) { BNX_TIME_MARKED = true;   /* first IST write: remember when, so RUN_11 only shifts the rows written before */
    try { var P = PropertiesService.getScriptProperties(); if (!P.getProperty('GUEST_TIME_NEWCODE_AT')) P.setProperty('GUEST_TIME_NEWCODE_AT', String(Date.now())); } catch (e) {} }
  try { return bnxCrmIstWall_(v, bnxCrmSheetTz_(sh)); } catch (e) { return v; }
}
/* a cell written as IST wall-clock → "yyyy-MM-dd HH:mm" Indian time */
function bnxCrmCellIst_(sh, v, fmt) { return Object.prototype.toString.call(v) === '[object Date]' ? Utilities.formatDate(v, bnxCrmSheetTz_(sh), fmt || 'yyyy-MM-dd HH:mm') : String(v || ''); }
function bnxCrmAppend_(sh, obj) {
  var C = bnxCrmCols_(sh), row = [], w = Math.max(sh.getLastColumn(), 1);
  for (var i = 0; i < w; i++) row.push('');
  Object.keys(obj).forEach(function (k) { if (C[k]) row[C[k] - 1] = bnxCrmW_(sh, obj[k]); });
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
  var tz = bnxCrmSheetTz_(sh), lc = sh.getLastColumn();   /* cells hold IST wall-clock in the sheet's zone */
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
    if (p.mode) return bnxGuestMode_(p);                                   /* v3.5: SCAN · CONFIG · OTP · TRUECALLER */
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
      deviceId: bnxDev_(p.deviceId),
      marketingOptIn: (p.marketingOptIn === undefined || p.marketingOptIn === '') ? undefined : bool(p.marketingOptIn, false),
      consentVer: String(p.consentVer || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 30),
      _noCreate: true
    };
    /* OTP-verified number (token from OTP_VERIFY, bound to this client + mobile) */
    if (p.otpToken && cache.get('otpok_' + cid + '_' + mobile) === String(p.otpToken)) req.verified = 'OTP';
    return bnxCustomerCheckin_(req);
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
}

/* ───────────── CUSTOMER_CHECKIN ─────────────
   2026-10-09 ROOT FIX ("QR → mobile + name not saved", "Lock timeout"): the whole check-in — opening 3 spreadsheets,
   the WhatsApp HTTP call, the copy to CRM DB + CUSTOMER_MASTER, linking 2,000 scan rows — ran INSIDE the one
   script-wide lock. One check-in held it 10-40 s, so on a busy night the next guests (and the dashboard's event /
   video saves) hit "Lock timeout" and their number + name were lost. Now:
     • a short PER-CLIENT lock (bnxSoftLock_) covers only the guest-card row (find / create / CRN / counters);
     • visit log, scan linking, welcome WhatsApp and the 3-database copy run after the lock is released.
   VISIT RULE (same business day 06:00→05:59 = one visit): a second scan the same night is not a new visit; choosing an
   event later puts the event on that visit; a different event the same night is its own visit; a new day = new visit.
   Before, "!req.customerName" stopped every scan that carried the saved name from counting (VISIT_COUNT stayed 1). */
function bnxCrmKeyDay_(k) { var m = String(k || '').split('|')[0].match(/(\d{8})$/); return m ? m[1] : ''; }
function bnxCrmKeyEv_(k) { var m = String(k || '').match(/\|ev:([a-z0-9]*)/); return m ? m[1] : ''; }
function bnxCrmEvSlug_(e) { return String(e || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24); }
function bnxCrmLockGuests_(clientId) {
  return (typeof bnxSoftLock_ === 'function') ? bnxSoftLock_('crm_' + String(clientId || ''), 15000)
    : (function () { var l = LockService.getScriptLock(); l.waitLock(20000); return { release: function () { l.releaseLock(); } }; })();
}
function bnxCustomerCheckin_(req) {
  var mobile = String(req.mobileNo || '').replace(/\D/g, '').slice(-10);
  if (mobile.length !== 10) return { success: false, error: 'Invalid mobile number' };

  var cache = CacheService.getScriptCache(), rk = 'crm_' + (req.clientId || '') + '_' + (req.requestId || '');
  if (req.requestId && cache.get(rk)) return JSON.parse(cache.get(rk));

  var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, req.clientId, !!req._noCreate);
  var name = bnxCrmClean_(req.customerName), now = bnxNow_();
  var out, isNewRow = false, newVisit = false, upgradeVisit = false, nameChanged = false, warn = [], row = 0, sendWelcome = false;
  var vkey = bnxCrmVisitKey_(req);

  /* ── 1. guest card: short per-client lock ── */
  var lock = bnxCrmLockGuests_(req.clientId);
  try {
    row = bnxCrmFind_(sh, mobile, req.clientId);
    if (!row) {
      var newCrn = bnxCrmNextCrn_(sh);
      row = bnxCrmAppend_(sh, { MOBILE: mobile, NAME: name, FIRST_VISIT: now, LAST_VISIT: now, VISIT_COUNT: 1, POINTS: 0,
        TOTAL_ORDERS: 0, TOTAL_SPEND: 0, WELCOME_SENT: '', OPT_IN: req.notifyOptIn === false ? 'NO' : 'YES',
        LAST_TABLE: req.tableId || '', SOURCE: req.source || 'QR_SCAN', CLIENT_ID: req.clientId || '',
        CRN: newCrn, CUSTOMER_ID: newCrn, LAST_EVENT: req.eventName || '', EVENTS: req.eventName || '',
        LAST_SCAN_KEY: vkey });
      try { var Cm = bnxCrmCols_(sh); if (Cm.MOBILE) sh.getRange(row, Cm.MOBILE).setNumberFormat('@').setValue(mobile); } catch (e) {}
      isNewRow = true; newVisit = true;
      out = { success: true, isNewCustomer: !name, customerName: name, points: 0, visitCount: 1, crn: newCrn, customerId: newCrn };
    } else {
      var C = bnxCrmCols_(sh), lc = Math.max(sh.getLastColumn(), 1);
      var cur = sh.getRange(row, 1, 1, lc).getValues()[0], before = cur.slice();
      var g = function (h) { return C[h] ? cur[C[h] - 1] : ''; };
      var set = function (h, v) { if (C[h]) cur[C[h] - 1] = bnxCrmW_(sh, v); };
      var savedName = String(g('NAME') || '').trim(), visits = Number(g('VISIT_COUNT') || 0);
      var prevKey = String(g('LAST_SCAN_KEY') || ''), d0 = bnxCrmKeyDay_(prevKey), d1 = bnxCrmKeyDay_(req.scanKey);
      var ev1 = bnxCrmEvSlug_(req.eventName), ev0 = bnxCrmKeyEv_(prevKey);
      if (req.scanKey) {
        if (d0 && d1 && d0 === d1) {                                  /* same business day = same visit … */
          if (ev1 && !ev0) upgradeVisit = true;                       /* … event chosen now → on that visit */
          else if (ev1 && ev0 && ev1 !== ev0) newVisit = true;        /* … a second, different event → own visit */
        } else if (!d0 || !d1) {
          if (ev1 && prevKey === req.scanKey) upgradeVisit = true;
          else if (vkey !== prevKey) newVisit = true;
        } else newVisit = true;                                       /* another day */
      }
      if (req.eventName) {
        set('LAST_EVENT', req.eventName);
        var evs = String(g('EVENTS') || '').split('|').map(function (x) { return x.trim(); }).filter(String);
        if (evs.indexOf(req.eventName) < 0) { evs.push(req.eventName); set('EVENTS', evs.join(' | ')); }
      }
      if (name && name !== savedName) { set('NAME', name); nameChanged = true; }
      if (newVisit) { visits++; set('VISIT_COUNT', visits); }
      set('LAST_VISIT', now);
      if (req.tableId) set('LAST_TABLE', req.tableId);
      if (req.scanKey && (newVisit || upgradeVisit || !prevKey)) set('LAST_SCAN_KEY', vkey);
      if (req.notifyOptIn === false) set('OPT_IN', 'NO');
      else if (req.notifyOptIn === true && String(g('OPT_IN')).toUpperCase() === 'NO' && req.customerName) set('OPT_IN', 'YES');
      var crn = String(g('CRN') || '');
      if (!crn && C.CRN) { crn = bnxCrmNextCrn_(sh); set('CRN', crn); }
      if (crn && String(g('CUSTOMER_ID') || '') !== crn) set('CUSTOMER_ID', crn);
      var changed = cur.some(function (v, i) { var a = before[i]; return (a instanceof Date ? a.getTime() : String(a)) !== (v instanceof Date ? v.getTime() : String(v)); });
      if (changed) sh.getRange(row, 1, 1, lc).setValues([cur]);
      out = { success: true, isNewCustomer: !(name || savedName), customerName: name || savedName, points: Number(g('POINTS') || 0), visitCount: visits || 1, crn: crn, customerId: crn };
    }

    /* verification, email/city, device, consent, bill totals — same row, still inside the short lock */
    try {
      var C3 = bnxCrmCols_(sh), lc3 = Math.max(sh.getLastColumn(), 1), r3 = sh.getRange(row, 1, 1, lc3).getValues()[0], ch3 = false;
      var put3 = function (h, v) { if (C3[h] && v !== '' && v != null) { r3[C3[h] - 1] = bnxCrmW_(sh, v); ch3 = true; } };
      var get3 = function (h) { return C3[h] ? r3[C3[h] - 1] : ''; };
      if (req.verified) { put3('VERIFIED', 'YES'); put3('VERIFIED_BY', req.verified); }
      if (req.email) put3('EMAIL', String(req.email).slice(0, 80));
      if (req.city) put3('CITY', String(req.city).slice(0, 40));
      if (req.deviceId && String(get3('LAST_DEVICE')) !== req.deviceId) put3('LAST_DEVICE', req.deviceId);
      if (req.consentVer && C3.CONSENT_VER && String(get3('CONSENT_VER')) !== req.consentVer) { put3('CONSENT_VER', req.consentVer); put3('CONSENT_AT', bnxNow_()); }
      if (req.marketingOptIn === true && String(get3('MARKETING_OPT_IN')) !== 'YES') put3('MARKETING_OPT_IN', 'YES');
      else if (req.marketingOptIn === false && C3.MARKETING_OPT_IN && !String(get3('MARKETING_OPT_IN'))) put3('MARKETING_OPT_IN', 'NO');
      if (Number(req.billAmount) > 0 && !(req.billNo && cache.get('crmbill_' + req.clientId + '_' + req.billNo))) {
        put3('TOTAL_ORDERS', Number(get3('TOTAL_ORDERS') || 0) + 1); put3('TOTAL_SPEND', Number(get3('TOTAL_SPEND') || 0) + Number(req.billAmount));
        if (req.billNo) cache.put('crmbill_' + req.clientId + '_' + req.billNo, '1', 21600);
        out.billAdded = true;
        /* the bill belongs to the party / event the guest checked in for tonight (party-wise spend) */
        var bday = Utilities.formatDate(new Date(Date.now() - 6 * 3600 * 1000), 'Asia/Kolkata', 'yyyyMMdd');
        out._billEv = req.eventName || (bnxCrmKeyDay_(get3('LAST_SCAN_KEY')) === bday ? String(get3('LAST_EVENT') || '') : '');
      }
      if (ch3) sh.getRange(row, 1, 1, lc3).setValues([r3]);
      out.verified = !!req.verified || String(get3('VERIFIED')).toUpperCase() === 'YES';
      /* welcome decision (once per guest) — marked in cache before the lock is released, so two saves never send twice */
      var sent = String(get3('WELCOME_SENT') || '').trim();
      var optIn = String(get3('OPT_IN') || 'YES').toUpperCase() !== 'NO';
      var wantWelcome = req.welcomeSms === true || !req.deferWelcome;
      var hasName = !!out.customerName || req.welcomeSms === true;    /* left on the name screen → "Hi Guest" */
      var wk = 'wel_' + (req.clientId || '') + '_' + mobile;
      out.welcomeSent = !!sent;
      var ctlG = bnxGuestCtl_(req.clientId);
      if (!ctlG.waAuto && !sent) out.welcome = 'off';
      if (!sent && optIn && hasName && wantWelcome && ctlG.waAuto) { if (cache.get(wk)) out.welcome = 'recent'; else { cache.put(wk, '1', 300); sendWelcome = true; } }
    } catch (e) { warn.push('card: ' + e.message); }
  } finally { lock.release(); }

  /* ── 2. everything slow: outside the lock ── */
  if (nameChanged) { try { bnxCrmFillTxn_(req.clientId, mobile, name, out.crn, !!req._noCreate); } catch (e) { warn.push('txn name: ' + e.message); } }
  if (upgradeVisit) { try { bnxCrmSetLastVisitEvent_(req.clientId, mobile, req.eventName, !!req._noCreate); } catch (e) { warn.push('txn event: ' + e.message); } }
  if (newVisit) {
    try {
      bnxCrmLogTxn_({ mobile: mobile, name: out.customerName, customerId: out.crn, event: req.eventName || '', type: 'VISIT', table: req.tableId, source: req.source || 'QR_SCAN',
        balance: out.points, clientId: req.clientId, key: 'visit-' + (req.clientId || '') + '-' + (vkey || req.requestId || mobile + now.getTime()) + '-' + mobile,
        noCreate: !!req._noCreate });
    } catch (e) { warn.push('txn: ' + e.message); Logger.log('VISIT log failed: ' + e.message); }
  }
  if (out.billAdded) {
    try {
      bnxCrmLogTxn_({ mobile: mobile, name: out.customerName, customerId: out.crn, type: 'BILL', orderNo: req.billNo || '', table: req.tableId, amount: Number(req.billAmount),
        source: 'BILL', clientId: req.clientId, key: 'bill-' + (req.clientId || '') + '-' + (req.billNo || req.requestId || ''), event: out._billEv || '', noCreate: !!req._noCreate });
    } catch (e) { warn.push('bill: ' + e.message); }
  }
  delete out._billEv;
  if (req.deviceId) { try { bnxCrmLinkScans_(req.clientId, req.deviceId, mobile, out.customerName, out.crn, req.verified || req.source || 'CHECKIN', !!req._noCreate); } catch (e) { warn.push('scan link: ' + e.message); } }

  if (sendWelcome) {
    var r = bnxSendWelcome_(mobile, out.customerName, req.clientId, out.crn);
    if (r.ok) {
      try {
        var rw = bnxCrmFind_(sh, mobile, req.clientId), C2 = bnxCrmCols_(sh);
        if (rw && C2.WELCOME_SENT) sh.getRange(rw, C2.WELCOME_SENT).setValue(Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm'));
        if (rw && C2.WELCOME_CHANNEL) sh.getRange(rw, C2.WELCOME_CHANNEL).setValue(r.channel);
      } catch (e) { warn.push('welcome mark: ' + e.message); }
    }
    out.welcome = r.ok ? 'sent' : (r.free ? 'free_mode' : (r.configured ? 'failed' : 'not_configured'));
    out.welcomeChannel = r.channel || '';
    out.welcomeSent = !!r.ok;
  }
  out.newVisit = newVisit;
  try { out.saved = bnxCrmSyncGuest_(req.clientId, mobile, !!req._noCreate); } catch (e) { warn.push('sync: ' + e.message); }   /* v3.4 */
  if (warn.length) out.warn = warn.join(' | ');
  if (req.requestId) cache.put(rk, JSON.stringify(out), 600);
  return out;
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

/* 2026-11-09 (from the 2026-10-28 welcome fix — now IN this file, the separate fix file is deleted):
   • WA_PROVIDER alone no longer counts as "configured": token + 12-20 digit phone id (META) or Twilio WhatsApp sender must exist.
   • Only an 'OK …' result counts as sent (before, any non-'ERR' text did).  • SMS_ALSO=YES sends SMS even when WhatsApp worked.
   • MSG91 key: MSG91_AUTHKEY or MSG91_AUTH_KEY.  • no provider at all → free mode (the QR page shows the one-tap WhatsApp button). */
function bnxWaEffective_(cid) {
  var p = PropertiesService.getScriptProperties(), pr = function (k) { return bnxCrmProp_(p, k, cid); };
  var provider = String(pr('WA_PROVIDER') || 'NONE').trim().toUpperCase();
  if (provider === 'META') return pr('META_WA_TOKEN') && /^\d{8,25}$/.test(String(pr('META_WA_PHONE_ID') || '').trim()) ? 'META' : 'NONE';
  if (provider === 'TWILIO') return pr('TWILIO_SID') && pr('TWILIO_TOKEN') && /^(whatsapp:)?\+\d{8,15}$/i.test(String(pr('TWILIO_FROM_WA') || '')) ? 'TWILIO' : 'NONE';
  return 'NONE';
}
/* returns { ok, channel, configured, free } */
function bnxSendWelcome_(mobile, name, clientId, crn) {
  var p = PropertiesService.getScriptProperties(), pr0 = function (k) { return bnxCrmProp_(p, k, clientId); };
  var pr = function (k) { return k === 'MSG91_AUTHKEY' ? (pr0('MSG91_AUTHKEY') || pr0('MSG91_AUTH_KEY')) : pr0(k); };
  var restaurant = pr('RESTAURANT_NAME') || bnxCrmRestaurantName_(clientId), first = String(name || '').trim().split(/\s+/)[0] || 'Guest';
  var tpl = pr('WELCOME_TEXT') || (crn ? 'Hi {name}, welcome to {restaurant}! Your customer number is {crn}. Enjoy your meal.' : 'Hi {name}, welcome to {restaurant}! Thank you for visiting us. Enjoy your meal.');
  var message = tpl.split('{name}').join(first).split('{restaurant}').join(restaurant).split('{crn}').join(crn || '');
  var wa = bnxWaEffective_(clientId), sms = String(pr('SMS_PROVIDER') || 'NONE').toUpperCase(), results = [];
  try {
    if (wa === 'META') results.push(['WHATSAPP', metaWa_(pr, mobile, [first, restaurant, crn || '-'])]);
    else if (wa === 'TWILIO') results.push(['WHATSAPP', twilioWa_(p, pr, mobile, message, [first, restaurant, crn || '-'])]);
  } catch (e) { results.push(['WHATSAPP', 'ERR ' + e.message]); }
  var waOk = results.some(function (x) { return /^OK\b/i.test(String(x[1])); });
  var smsAlso = /^(YES|1|TRUE)$/i.test(String(pr('SMS_ALSO') || ''));
  if (!waOk || smsAlso) try {
    if (sms === 'FAST2SMS' && pr('FAST2SMS_KEY')) results.push(['SMS', fast2sms_(pr, mobile, message)]);
    else if (sms === 'MSG91' && pr('MSG91_AUTHKEY')) results.push(['SMS', msg91_(pr, mobile, first, restaurant)]);
    else if (sms === 'TWILIO' && pr('TWILIO_SID') && pr('TWILIO_TOKEN') && pr('TWILIO_FROM_SMS')) results.push(['SMS', twilio_(pr, '+91' + mobile, pr('TWILIO_FROM_SMS'), message)]);
  } catch (e) { results.push(['SMS', 'ERR ' + e.message]); }
  var ok = results.filter(function (x) { return /^OK\b/i.test(String(x[1])); })[0], free = wa === 'NONE' && results.length === 0;
  if (free) Logger.log('Welcome not sent: no WhatsApp API / SMS provider configured (free mode)');
  try {
    bnxCrmAppend_(bnxCrmSheet_(CRM_LOG, CRM_LOG_HEAD, clientId), { TIME: bnxNow_(), MOBILE: mobile,
      CHANNEL: results.map(function (x) { return x[0]; }).join('+') || (free ? 'FREE_WA' : 'NONE'),
      RESULT: free ? 'FREE MODE: manual WhatsApp tap required' : JSON.stringify(results).slice(0, 300), TEXT: message, CLIENT_ID: clientId || '' });
  } catch (e) { Logger.log('WELCOME_LOG: ' + e.message); }
  return { ok: !!ok, channel: ok ? ok[0] : (free ? 'FREE_WA' : ''), configured: wa !== 'NONE' || sms !== 'NONE', free: free };
}
/* reply inside the 24 h window after the guest's own message: WhatsApp free text, SMS fallback. 'OK …' or 'ERR …' */
function bnxWaReplyOrSms_(pr, mobile, text, cid) {
  var first;
  try { return metaWaText_(pr, mobile, text); } catch (e) { first = e.message; }
  var sms = String(pr('SMS_PROVIDER') || 'NONE').toUpperCase();
  try {
    if (sms === 'FAST2SMS' && pr('FAST2SMS_KEY')) return 'OK SMS ' + fast2sms_(pr, mobile, text);
    if (sms === 'TWILIO' && pr('TWILIO_SID') && pr('TWILIO_TOKEN') && pr('TWILIO_FROM_SMS')) return 'OK SMS ' + twilio_(pr, '+91' + mobile, pr('TWILIO_FROM_SMS'), text);
  } catch (e2) { return 'ERR ' + first + ' / SMS ' + e2.message; }
  return 'ERR ' + first;
}
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
  var tobj = {
    TXN_ID: 'TX' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10),
    DATE_TIME: bnxNow_(), MOBILE: t.mobile, NAME: t.name || '', TYPE: t.type, ORDER_NO: t.orderNo || '', TABLE: t.table || '',
    ITEMS: t.items || '', AMOUNT: Number(t.amount || 0), DISCOUNT: Number(t.discount || 0), POINTS_EARNED: Number(t.earned || 0),
    POINTS_REDEEMED: Number(t.redeemed || 0), POINTS_BALANCE: t.balance == null ? '' : t.balance, SOURCE: t.source || '', CLIENT_ID: t.clientId || '',
    CUSTOMER_ID: t.customerId || '', EVENT: t.event || '' };
  bnxCrmAppend_(sh, tobj);
  bnxCrmTxnToCrm_(t.clientId, tobj);                                   /* v3.4: same row into CRM DB */
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
  bnxCrmTxnSheets_(clientId, noCreate).forEach(function (sh) { bnxCrmSetLastVisitEventIn_(sh, mobile, ev); });
}
function bnxCrmSetLastVisitEventIn_(sh, mobile, ev) {
  var last = sh.getLastRow(), C = bnxCrmCols_(sh);
  if (last < 2 || !C.EVENT || !C.MOBILE) return;
  for (var r = last; r >= 2 && r > last - 400; r--) {
    if (String(sh.getRange(r, C.MOBILE).getDisplayValue()).replace(/\D/g, '').slice(-10) !== mobile) continue;
    if (C.TYPE && String(sh.getRange(r, C.TYPE).getValue()) !== 'VISIT') continue;
    if (!String(sh.getRange(r, C.EVENT).getValue() || '').trim()) sh.getRange(r, C.EVENT).setValue(ev);
    return;
  }
}
function bnxCrmFillTxn_(clientId, mobile, name, crn, noCreate) {
  var n = 0; bnxCrmTxnSheets_(clientId, noCreate).forEach(function (sh) { n += bnxCrmFillTxnIn_(sh, clientId, mobile, name, crn); }); return n;
}
function bnxCrmFillTxnIn_(sh, clientId, mobile, name, crn) {
  var last = sh.getLastRow();
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

    var lock = bnxCrmLockGuests_(req.clientId), logT = null;   /* 2026-10-09: per-client short lock, slow work after it */
    try {
      var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, req.clientId), row = bnxCrmFind_(sh, mobile, req.clientId);
      var amount = Number(req.billAmount || 0), earned = Number((result && result.earned) || 0), redeemed = Number(req.redeemedPoints || 0);
      var name = bnxCrmClean_(req.customerName);
      if (!row) {
        row = bnxCrmAppend_(sh, { MOBILE: mobile, NAME: name === 'Guest' ? '' : name, FIRST_VISIT: bnxNow_(), LAST_VISIT: bnxNow_(), VISIT_COUNT: 1,
          POINTS: 0, TOTAL_ORDERS: 0, TOTAL_SPEND: 0, OPT_IN: 'YES', LAST_TABLE: req.tableId || '', SOURCE: req.orderSource || 'ORDER',
          LAST_SCAN_KEY: req.scanKey || '', CLIENT_ID: req.clientId || '', CRN: bnxCrmNextCrn_(sh) });
      }
      var C = bnxCrmCols_(sh);
      var ocrn = C.CRN ? String(sh.getRange(row, C.CRN).getValue() || '') : '';
      if (!ocrn && C.CRN) { ocrn = bnxCrmNextCrn_(sh); sh.getRange(row, C.CRN).setValue(ocrn); }
      if (ocrn && C.CUSTOMER_ID && !String(sh.getRange(row, C.CUSTOMER_ID).getValue() || '')) sh.getRange(row, C.CUSTOMER_ID).setValue(ocrn);
      var add = function (h, v) { if (!C[h]) return; var c = sh.getRange(row, C[h]); c.setValue(Number(c.getValue() || 0) + Number(v || 0)); };
      add('TOTAL_ORDERS', 1); add('TOTAL_SPEND', amount); add('POINTS', earned - redeemed);
      if (C.LAST_VISIT) sh.getRange(row, C.LAST_VISIT).setValue(bnxCrmW_(sh, bnxNow_()));
      if (name && name !== 'Guest' && C.NAME && !sh.getRange(row, C.NAME).getValue()) sh.getRange(row, C.NAME).setValue(name);
      var items = (req.items || []).map(function (i) { return (i.qty || 1) + 'x ' + (i.itemName || ''); }).join(', ').slice(0, 400);
      /* the order belongs to the event the guest checked in for today (event-wise sales report) */
      var oev = '';
      try {
        if (C.LAST_EVENT && C.LAST_VISIT) {
          var lv = sh.getRange(row, C.LAST_VISIT).getValue(), bd = function (d, tz) { return Utilities.formatDate(new Date(new Date(d).getTime() - 6 * 3600 * 1000), tz, 'yyyyMMdd'); };
          if (lv && bd(lv, bnxCrmSheetTz_(sh)) === bd(new Date(), 'Asia/Kolkata')) oev = String(sh.getRange(row, C.LAST_EVENT).getValue() || '');
        }
      } catch (e) {}
      logT = { mobile: mobile, name: C.NAME ? sh.getRange(row, C.NAME).getValue() : name, customerId: ocrn, event: oev, type: 'ORDER', orderNo: orderNo,
        table: req.tableId, items: items, amount: amount, discount: req.redeemedDiscount, earned: earned, redeemed: redeemed,
        balance: C.POINTS ? sh.getRange(row, C.POINTS).getValue() : '', source: req.orderSource || 'CUSTOMER', clientId: req.clientId, key: key };
    } finally { lock.release(); }
    if (logT) bnxCrmLogTxn_(logT);
    try { bnxCrmSyncGuest_(req.clientId, mobile, false); } catch (e) { Logger.log('sync after order: ' + e.message); }
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



/* ═══════════════ v3.5 — PROFESSIONAL CHECK-IN (like Dineout / Zomato) ═══════════════
   1. Every scan is logged at once in GUEST_SCANS (time, table, event, party, phone type, device) — no typing.
   2. Returning phone → recognised (device id) → visit saved with no taps.
   3. One-tap identity:  Truecaller (Android, verified number + name)  ·  WhatsApp (tap + Send)  ·  OTP on WhatsApp / SMS.
   4. Anonymous scans of a phone are linked to the guest as soon as the guest is known (same device).
   5. Counter bill with a mobile number → guest record + spend + BILL row (+ e-bill template if set).
   Script properties (optional, per client with _<clientId>):
     TRUECALLER_PARTNER_KEY, TRUECALLER_PARTNER_NAME, TRUECALLER_PRIVACY_URL, TRUECALLER_TERMS_URL
     META_WA_OTP_TEMPLATE (approved AUTHENTICATION template, default guest_otp), OTP_SMS=FAST2SMS
     META_WA_BILL_TEMPLATE (vars: {{1}} name {{2}} restaurant {{3}} amount {{4}} bill no)
   Truecaller callback URL (Truecaller developer portal) = this web app /exec URL (handled by bnxWaRoutePost_). */
function bnxDev_(v) { v = String(v || '').trim(); return /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : ''; }
/* bnxGuestCfg_ → "Guest growth suite.gs" (ONE definition; it was defined 3× across files with different meaning) */
function bnxOtpChannel_(cid) {
  var P = PropertiesService.getScriptProperties(), pr = function (k) { return bnxCrmProp_(P, k, cid); };
  if (String(pr('WA_PROVIDER')).toUpperCase() === 'META' && pr('META_WA_TOKEN') && pr('META_WA_PHONE_ID') && pr('META_WA_OTP_TEMPLATE')) return 'WHATSAPP';
  if (String(pr('OTP_SMS') || pr('SMS_PROVIDER')).toUpperCase() === 'FAST2SMS' && pr('FAST2SMS_KEY')) return 'SMS';
  return '';
}
function bnxGuestMode_(p) {
  var cid = String(p.clientId || '').trim(), mode = String(p.mode || '').toUpperCase(), cache = CacheService.getScriptCache();
  try {
    bnxCrmSpreadsheet_(cid, 'MASTER', true);                                  /* unknown client → error, nothing created */
    var slot = Math.floor(Date.now() / 600000), ck = 'gm_' + cid + '_' + mode + '_' + slot, nc = Number(cache.get(ck) || 0);
    if (nc >= 900) return { success: false, mode: mode, error: 'Busy — please try again in a few minutes' };
    cache.put(ck, String(nc + 1), 900);
    var dev = bnxDev_(p.deviceId);

    if (mode === 'CONFIG') return { success: true, mode: mode, config: bnxGuestCfg_(cid) };

    if (mode === 'SCAN') {
      var out = { success: true, mode: mode, config: bnxGuestCfg_(cid), logged: false };
      var sk = String(p.scanKey || '').slice(0, 60), dk = 'scan_' + cid + '_' + (dev || 'x') + '_' + sk;
      if (!dev || cache.get(dk)) return out;                                  /* one row per phone per visit */
      cache.put(dk, '1', 21600);
      /* 2026-10-09: no script-wide lock here any more (appendRow is atomic) — scan logs never block other saves */
      var known = bnxCrmDeviceGuest_(cid, dev);
      var evName = String(p.eventName || p.partyName || '').replace(/[|<>=]/g, '').trim().slice(0, 60);
      var row = { SCAN_ID: 'SC' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10),
        DATE_TIME: bnxNow_(), CLIENT_ID: cid, DEVICE_ID: dev, PLATFORM: String(p.platform || '').slice(0, 20), TABLE: String(p.tableId || '').slice(0, 20),
        EVENT: evName, PARTY: String(p.partyName || '').slice(0, 60), SCAN_KEY: sk,
        STATUS: known ? 'RETURNING' : 'ANONYMOUS', MOBILE: known ? known.mobile : '', NAME: known ? known.name : '', CRN: known ? known.crn : '',
        IDENTIFIED_AT: known ? bnxNow_() : '', IDENTIFIED_BY: known ? 'DEVICE' : '' };
      bnxCrmAppend_(bnxCrmSheet_(CRM_SCAN, CRM_SCAN_HEAD, cid, true), row);
      try { var css = bnxCrmCrmSs_(cid); if (css) bnxCrmAppend_(bnxCrmTab_(css, CRM_SCAN, CRM_SCAN_HEAD), row); } catch (e) {}
      out.logged = true;
      if (known) {
        out.known = { crn: known.crn, name: known.name };
        /* ROOT FIX 2026-10-09 ("how many times visit / which party"): a returning phone was only written to GUEST_SCANS —
           GUEST_CRM.VISIT_COUNT / LAST_EVENT / EVENTS and the VISIT row never moved (Suman at NIRVAAN stayed "1 visit,
           BIKASH BANSAL PARTY"). Now the recognised guest is checked in for THIS scan + THIS party (same-night rule applies). */
        if (/^[6-9]\d{9}$/.test(String(known.mobile || '').replace(/\D/g, '').slice(-10))) {
          try {
            var ci = bnxCustomerCheckin_({ clientId: cid, mobileNo: known.mobile, tableId: String(p.tableId || '').slice(0, 20), scanKey: sk, eventName: evName,
              requestId: 'scan-' + dk, source: 'QR_RETURNING' + (p.partyName ? '|PARTY:' + String(p.partyName).slice(0, 60) : ''), deviceId: dev,
              deferWelcome: true, _noCreate: true });
            out.known.visitCount = ci && ci.visitCount; out.known.points = ci && ci.points; out.known.newVisit = !!(ci && ci.newVisit);
          } catch (e) { out.warn = 'returning visit: ' + e.message; }
        }
      }
      return out;
    }

    var mobile = String(p.mobileNo || '').replace(/\D/g, '').slice(-10);
    if (mode === 'OTP_SEND') {
      if (!/^[6-9]\d{9}$/.test(mobile)) return { success: false, mode: mode, error: 'Enter a valid 10-digit mobile number' };
      var ch = bnxOtpChannel_(cid); if (!ch) return { success: false, mode: mode, otpUnavailable: true, error: 'OTP not set up' };
      var sk2 = 'otps_' + cid + '_' + mobile + '_' + slot, ns = Number(cache.get(sk2) || 0);
      if (ns >= 3) return { success: false, mode: mode, error: 'Too many OTP requests — please wait 10 minutes' };
      cache.put(sk2, String(ns + 1), 900);
      var otp = String(Math.floor(1000 + Math.random() * 9000));
      cache.put('otp_' + cid + '_' + mobile, JSON.stringify({ h: bnxHash_(otp + '|' + cid + '|' + mobile), n: 0 }), 300);
      var P = PropertiesService.getScriptProperties(), pr = function (k) { return bnxCrmProp_(P, k, cid); }, res;
      try {
        if (ch === 'WHATSAPP') res = metaWaOtp_(pr, mobile, otp);
        else res = fast2smsOtp_(pr, mobile, otp);
      } catch (e) {
        if (ch === 'WHATSAPP' && pr('FAST2SMS_KEY')) { try { res = fast2smsOtp_(pr, mobile, otp); ch = 'SMS'; } catch (e2) { return { success: false, mode: mode, error: 'Could not send OTP: ' + e2.message }; } }
        else return { success: false, mode: mode, error: 'Could not send OTP: ' + e.message };
      }
      return { success: true, mode: mode, sent: true, channel: ch, expiresIn: 300 };
    }
    if (mode === 'OTP_VERIFY') {
      var raw = cache.get('otp_' + cid + '_' + mobile); if (!raw) return { success: false, mode: mode, error: 'OTP expired — tap Resend' };
      var o = JSON.parse(raw);
      if (o.n >= 5) { cache.remove('otp_' + cid + '_' + mobile); return { success: false, mode: mode, error: 'Too many wrong tries — tap Resend' }; }
      if (bnxHash_(String(p.otp || '').replace(/\D/g, '') + '|' + cid + '|' + mobile) !== o.h) { o.n++; cache.put('otp_' + cid + '_' + mobile, JSON.stringify(o), 300); return { success: false, mode: mode, error: 'Wrong OTP — ' + (5 - o.n) + ' tries left' }; }
      cache.remove('otp_' + cid + '_' + mobile);
      var tok = Utilities.getUuid(); cache.put('otpok_' + cid + '_' + mobile, tok, 1800);
      return { success: true, mode: mode, verified: true, otpToken: tok };
    }
    var nonce = String(p.nonce || ''); if (!/^[A-Za-z0-9_-]{8,64}$/.test(nonce) && /^TC_/.test(mode)) return { success: false, mode: mode, error: 'Bad request' };
    if (mode === 'TC_START') {
      cache.put('tcx_' + nonce, JSON.stringify({ cid: cid, tableId: String(p.tableId || '').slice(0, 20), scanKey: String(p.scanKey || '').slice(0, 60),
        eventName: String(p.eventName || '').slice(0, 60), partyName: String(p.partyName || '').slice(0, 60), deviceId: dev,
        notifyOptIn: !/^(0|false|no)$/i.test(String(p.notifyOptIn || 'true')),
        marketingOptIn: /^(1|true|yes)$/i.test(String(p.marketingOptIn || '')), consentVer: String(p.consentVer || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 30) }), 900);
      return { success: true, mode: mode };
    }
    if (mode === 'TC_POLL') {
      var r = cache.get('tcr_' + nonce);
      return r ? Object.assign({ mode: mode, done: true }, JSON.parse(r)) : { success: true, mode: mode, pending: true };
    }
    return { success: false, mode: mode, error: 'Unknown mode' };
  } catch (e) { return { success: false, mode: mode, error: String(e && e.message || e) }; }
}
function bnxHash_(s) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s + '|' + (PropertiesService.getScriptProperties().getProperty('OTP_SALT') || 'bnx-otp'))); }
/* which guest last used this phone (GUEST_CRM.LAST_DEVICE) */
/* bnxCrmDeviceGuest_ → "Guest growth suite.gs" (12-letter WhatsApp device-code match, returns row + obj) */
function bnxCrmLinkScans_(cid, dev, mobile, name, crn, by, noCreate) {
  var sheets = [];
  try { sheets.push(bnxCrmSheet_(CRM_SCAN, CRM_SCAN_HEAD, cid, noCreate)); } catch (e) {}
  try { var css = bnxCrmCrmSs_(cid); if (css && css.getSheetByName(CRM_SCAN)) sheets.push(css.getSheetByName(CRM_SCAN)); } catch (e) {}
  var an = function (x) { return String(x || '').replace(/[^A-Za-z0-9]/g, ''); }, dn0 = an(dev), dp = dn0.slice(0, 12), n = 0;
  sheets.forEach(function (sh) {
    var C = bnxCrmCols_(sh), last = sh.getLastRow(); if (last < 2 || !C.DEVICE_ID) return;
    var from = Math.max(2, last - 2000), cnt = last - from + 1, lc = sh.getLastColumn(), v = sh.getRange(from, 1, cnt, lc).getValues(), ch = false;
    for (var i = 0; i < v.length; i++) {
      var d = an(v[i][C.DEVICE_ID - 1]); if (!d || !(d === dn0 || (dp.length >= 8 && d.indexOf(dp) === 0))) continue;
      var had = String(v[i][C.MOBILE - 1] || '').replace(/\D/g, '');
      if (had && had !== mobile) continue;                                   /* scan already belongs to someone else on this phone */
      if (had === mobile && (!name || v[i][C.NAME - 1])) continue;
      v[i][C.MOBILE - 1] = mobile; if (name) v[i][C.NAME - 1] = name; if (crn) v[i][C.CRN - 1] = crn;
      if (String(v[i][C.STATUS - 1]) === 'ANONYMOUS') v[i][C.STATUS - 1] = 'IDENTIFIED';
      if (!v[i][C.IDENTIFIED_AT - 1]) v[i][C.IDENTIFIED_AT - 1] = bnxCrmW_(sh, bnxNow_());
      v[i][C.IDENTIFIED_BY - 1] = by; ch = true; n++;
    }
    if (ch) sh.getRange(from, 1, cnt, lc).setValues(v);
  });
  return n;
}
/* Meta AUTHENTICATION template: OTP in the body + the "Copy code" button */
function metaWaOtp_(pr, mobile, otp) {
  var token = pr('META_WA_TOKEN'), phoneId = pr('META_WA_PHONE_ID');
  var body = { messaging_product: 'whatsapp', to: '91' + mobile, type: 'template',
    template: { name: pr('META_WA_OTP_TEMPLATE') || 'guest_otp', language: { code: pr('META_WA_LANG') || 'en' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: otp }] },
                   { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] }] } };
  var res = UrlFetchApp.fetch('https://graph.facebook.com/' + (pr('META_WA_VERSION') || 'v20.0') + '/' + phoneId + '/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify(body) });
  var j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (!(j.messages && j.messages.length)) throw new Error((j.error && j.error.message) || ('Meta HTTP ' + res.getResponseCode()));
  return 'OK';
}
function fast2smsOtp_(pr, mobile, otp) {
  var res = UrlFetchApp.fetch('https://www.fast2sms.com/dev/bulkV2', { method: 'post', muteHttpExceptions: true,
    headers: { authorization: pr('FAST2SMS_KEY') }, payload: { route: 'otp', variables_values: otp, numbers: mobile } });
  var j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) {}
  if (!j.return) throw new Error(j.message || 'Fast2SMS OTP failed');
  return 'OK';
}
/* Truecaller server → this script (callback URL). Body: { requestId, accessToken, endpoint } or { requestId, status } */
function bnxTruecallerCallback_(j) {
  var cache = CacheService.getScriptCache(), nonce = String(j.requestId || '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(nonce)) return { ok: false };
  var ctx = cache.get('tcx_' + nonce); if (!ctx) return { ok: false, error: 'unknown request' };
  ctx = JSON.parse(ctx);
  if (!j.accessToken) { cache.put('tcr_' + nonce, JSON.stringify({ success: false, rejected: true, status: String(j.status || 'rejected') }), 900); return { ok: true }; }
  var ep = String(j.endpoint || '');
  if (!/^https:\/\/([a-z0-9-]+\.)*truecaller\.com\//i.test(ep)) return { ok: false, error: 'bad endpoint' };     /* only Truecaller's own server */
  var res = UrlFetchApp.fetch(ep, { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + j.accessToken, 'Cache-Control': 'no-cache' } });
  var pf = {}; try { pf = JSON.parse(res.getContentText()); } catch (e) {}
  var num = String(((pf.phoneNumbers || [])[0]) || '').replace(/\D/g, ''); if (num.length === 12 && num.indexOf('91') === 0) num = num.slice(2);
  if (!/^[6-9]\d{9}$/.test(num)) { cache.put('tcr_' + nonce, JSON.stringify({ success: false, error: 'Truecaller did not return an Indian mobile' }), 900); return { ok: false }; }
  var nm = [pf.name && pf.name.first, pf.name && pf.name.last].filter(Boolean).join(' ');
  var out = bnxCustomerCheckin_({ clientId: ctx.cid, mobileNo: num, customerName: nm, tableId: ctx.tableId, scanKey: ctx.scanKey, eventName: ctx.eventName,
    requestId: 'tc-' + nonce, notifyOptIn: ctx.notifyOptIn, source: 'TRUECALLER' + (ctx.partyName ? '|PARTY:' + ctx.partyName : ''), deviceId: ctx.deviceId,
    verified: 'TRUECALLER',   /* data minimisation: only number + name are kept from the Truecaller profile */
    marketingOptIn: ctx.marketingOptIn, consentVer: ctx.consentVer,
    welcomeSms: true, deferWelcome: false, _noCreate: true });
  out.mobile = num;
  cache.put('tcr_' + nonce, JSON.stringify(out), 900);
  return { ok: true };
}
/* counter bill with a mobile (dashboard → doPost hook). Same session check the rest of the ERP applies. */
function bnxCrmBillCapture_(p) {
  var cid = String(p.clientId || '').trim(), mobile = String(p.mobileNo || '').replace(/\D/g, '').slice(-10);
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(cid)) return { success: false, error: 'Invalid client' };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(p.sessionToken || ''))) return { success: false, error: 'Invalid or expired session' };
  if (!/^[6-9]\d{9}$/.test(mobile)) return { success: false, error: 'No valid mobile on the bill' };
  var nm = String(p.customerName || '').trim(); if (/^(general customer|guest|walk.?in|cash)$/i.test(nm)) nm = '';
  var out = bnxCustomerCheckin_({ clientId: cid, mobileNo: mobile, customerName: nm, tableId: String(p.tableId || '').slice(0, 20), requestId: 'bill-' + (p.billNo || p.requestId || Date.now()),
    notifyOptIn: true, source: 'BILL', billAmount: Number(p.amount || 0), billNo: String(p.billNo || '').slice(0, 40), welcomeSms: true, deferWelcome: !nm });
  try {   /* e-bill on WhatsApp (approved template) */
    var P = PropertiesService.getScriptProperties(), pr = function (k) { return bnxCrmProp_(P, k, cid); };
    if (out && out.success !== false && String(pr('WA_PROVIDER')).toUpperCase() === 'META' && pr('META_WA_BILL_TEMPLATE')) {
      var restaurant = pr('RESTAURANT_NAME') || bnxCrmRestaurantName_(cid);
      var r = metaWa_(function (k) { return k === 'META_WA_TEMPLATE' ? pr('META_WA_BILL_TEMPLATE') : pr(k); }, mobile,
        [String(out.customerName || 'Guest').split(' ')[0], restaurant, '₹' + Number(p.amount || 0).toFixed(2), String(p.billNo || '-')]);
      out.ebill = r;
      bnxCrmAppend_(bnxCrmSheet_(CRM_LOG, CRM_LOG_HEAD, cid), { TIME: bnxNow_(), MOBILE: mobile, CHANNEL: 'EBILL', RESULT: String(r).slice(0, 300), TEXT: 'Bill ' + (p.billNo || '') + ' ₹' + p.amount, CLIENT_ID: cid });
    }
  } catch (e) { out.ebill = 'ERR ' + e.message; }
  return out;
}
/* scans for the reports (dashboard → doPost hook) */
function bnxCrmScansList_(p) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(p.sessionToken || ''))) return { success: false, error: 'Invalid or expired session' };
  return bnxCrmList_(CRM_SCAN, CRM_SCAN_HEAD, { clientId: p.clientId, fromDate: p.fromDate, toDate: p.toDate, event: p.event }, Number(p.max || 5000));
}


/* ═══════════════ DPDP Act 2023 — consent, withdrawal, erasure, retention ═══════════════ */
function bnxCrmSetConsent_(cid, mobile, yes) {
  var n = 0;
  [function () { return bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true); }, function () { var c = bnxCrmCrmSs_(cid); return c && c.getSheetByName(CRM_SHEET); }].forEach(function (f) {
    try { var sh = f(); if (!sh) return; var r = bnxCrmFind_(sh, mobile, cid); if (!r) return; var C = bnxCrmCols_(sh);
      if (C.MARKETING_OPT_IN) sh.getRange(r, C.MARKETING_OPT_IN).setValue(yes ? 'YES' : 'NO');
      if (!yes && C.OPT_IN) sh.getRange(r, C.OPT_IN).setValue('NO');
      if (C.CONSENT_AT) sh.getRange(r, C.CONSENT_AT).setValue(bnxCrmW_(sh, bnxNow_())); n++; } catch (e) {}
  });
  try { var ms = bnxCrmSpreadsheet_(cid, 'MASTER', true).getSheetByName(CRM_CUST_MASTER); if (ms) { var C2 = bnxCrmCols_(ms), pc = C2.PHONE || C2.MOBILE;
    if (pc && C2.NOTIFY_OPT_IN) { var ph = ms.getRange(2, pc, Math.max(ms.getLastRow() - 1, 1), 1).getDisplayValues();
      for (var i = 0; i < ph.length; i++) if (String(ph[i][0]).replace(/\D/g, '').slice(-10) === mobile) ms.getRange(i + 2, C2.NOTIFY_OPT_IN).setValue(yes ? 'YES' : 'NO'); } } } catch (e) {}
  bnxCrmAppend_(bnxCrmSheet_(CRM_LOG, CRM_LOG_HEAD, cid, true), { TIME: bnxNow_(), MOBILE: mobile, CHANNEL: 'CONSENT', RESULT: yes ? 'MARKETING YES (START)' : 'MARKETING NO (STOP)', TEXT: '', CLIENT_ID: cid });
  return n ? (yes ? 'subscribed' : 'unsubscribed') : 'not found';
}
/* Right to erasure: guest card removed; mobile/name blanked on scans + visit/order rows (amounts stay for tax);
   CUSTOMER_MASTER row removed if it was created by QR ("QR Guest"), a billing/credit customer is left to the owner. */
function bnxCrmEraseGuest_(cid, mobile, by) {
  mobile = String(mobile || '').replace(/\D/g, '').slice(-10); if (!/^\d{10}$/.test(mobile)) return 'bad mobile';
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  var n = { cards: 0, rows: 0, master: '' };
  try {
    var cards = [];
    try { cards.push(bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true)); } catch (e) {}
    try { var c1 = bnxCrmCrmSs_(cid); if (c1 && c1.getSheetByName(CRM_SHEET)) cards.push(c1.getSheetByName(CRM_SHEET)); } catch (e) {}
    cards.forEach(function (sh) { for (var r; (r = bnxCrmFind_(sh, mobile, cid));) { sh.deleteRow(r); n.cards++; } });
    var logs = [];
    [CRM_TXN, CRM_SCAN].forEach(function (t) {
      try { logs.push(bnxCrmSheet_(t, t === CRM_TXN ? CRM_TXN_HEAD : CRM_SCAN_HEAD, cid, true)); } catch (e) {}
      try { var c2 = bnxCrmCrmSs_(cid); if (c2 && c2.getSheetByName(t)) logs.push(c2.getSheetByName(t)); } catch (e) {}
    });
    logs.forEach(function (sh) {
      var C = bnxCrmCols_(sh), last = sh.getLastRow(); if (last < 2 || !C.MOBILE) return;
      var lc = sh.getLastColumn(), v = sh.getRange(2, 1, last - 1, lc).getValues(), ch = false;
      v.forEach(function (row) { if (String(row[C.MOBILE - 1]).replace(/\D/g, '').slice(-10) !== mobile) return;
        row[C.MOBILE - 1] = 'ERASED'; if (C.NAME) row[C.NAME - 1] = ''; if (C.DEVICE_ID) row[C.DEVICE_ID - 1] = ''; if (C.STATUS) row[C.STATUS - 1] = 'ERASED'; ch = true; n.rows++; });
      if (ch) sh.getRange(2, 1, last - 1, lc).setValues(v);
    });
    try { var ms = bnxCrmSpreadsheet_(cid, 'MASTER', true).getSheetByName(CRM_CUST_MASTER); if (ms && ms.getLastRow() > 1) { var C3 = bnxCrmCols_(ms), pc = C3.PHONE || C3.MOBILE;
      var vals = ms.getRange(2, 1, ms.getLastRow() - 1, ms.getLastColumn()).getValues();
      for (var i = vals.length - 1; i >= 0; i--) if (String(vals[i][pc - 1]).replace(/\D/g, '').slice(-10) === mobile) {
        if (C3.CUSTOMER_TYPE && String(vals[i][C3.CUSTOMER_TYPE - 1]) === 'QR Guest') { ms.deleteRow(i + 2); n.master = 'removed'; }
        else { n.master = 'kept (billing customer — owner decides)'; if (C3.CRN) ms.getRange(i + 2, C3.CRN).setValue(''); if (C3.NOTIFY_OPT_IN) ms.getRange(i + 2, C3.NOTIFY_OPT_IN).setValue('NO'); } } } } catch (e) {}
    bnxCrmAppend_(bnxCrmSheet_(CRM_LOG, CRM_LOG_HEAD, cid, true), { TIME: bnxNow_(), MOBILE: 'ERASED-' + bnxHash_(mobile).slice(0, 10), CHANNEL: 'ERASURE',
      RESULT: 'by ' + (by || 'OWNER') + ' · cards ' + n.cards + ' · rows ' + n.rows + ' · master ' + (n.master || 'none'), TEXT: '', CLIENT_ID: cid });
  } finally { lock.releaseLock(); }
  return 'erased: cards ' + n.cards + ', rows ' + n.rows + ', master ' + (n.master || 'none');
}
/* Retention: anonymous scans (never linked to a guest) older than N days are removed (default 365) */
function bnxCrmPurgeScans(clientId, days) {
  clientId = clientId || CRM_TEST_CLIENT; days = Number(days || PropertiesService.getScriptProperties().getProperty('SCAN_RETENTION_DAYS') || 365);
  var cut = Date.now() - days * 86400000, total = 0, sheets = [];
  try { sheets.push(bnxCrmSheet_(CRM_SCAN, CRM_SCAN_HEAD, clientId, true)); } catch (e) {}
  try { var c = bnxCrmCrmSs_(clientId); if (c && c.getSheetByName(CRM_SCAN)) sheets.push(c.getSheetByName(CRM_SCAN)); } catch (e) {}
  sheets.forEach(function (sh) { var C = bnxCrmCols_(sh), last = sh.getLastRow(); if (last < 2) return;
    var v = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
    for (var i = v.length - 1; i >= 0; i--) { var d = new Date(v[i][C.DATE_TIME - 1]).getTime(), st = String(v[i][C.STATUS - 1]);
      if (d && d < cut && (st === 'ANONYMOUS' || st === 'ERASED')) { sh.deleteRow(i + 2); total++; } } });
  Logger.log('Anonymous scans older than ' + days + ' days removed: ' + total);
  return total;
}

/* ═══════════════ v3.4 — ONE SCAN → ALL THREE DATABASES ═══════════════
   MASTER DB      : GUEST_CRM (guest card)  +  CUSTOMER_MASTER (the restaurant's customer list; matched by PHONE,
                    CRN filled in on an existing customer, a new guest added as CUSTOMER_TYPE "QR Guest").
   TRANSACTION DB : GUEST_TRANSACTIONS (every VISIT / ORDER, with EVENT).
   CRM DB         : <clientId>_CRM_DB › GUEST_CRM + GUEST_TRANSACTIONS — same rows, kept in step automatically.
   Switches (Script properties, optional):  CRM_TO_CUSTOMER_MASTER = NO   CRM_TO_CRM_DB = NO                          */
var CRM_CUST_MASTER = 'CUSTOMER_MASTER';
/* GUEST CAPTURE CONTROL (2026-10-09, set from the restaurant dashboard → Table QR): Yes / No per client.
   waAuto = automatic WhatsApp/SMS welcome through the API · waGuest = "Open WhatsApp" button for the guest (free,
   WhatsApp Business greeting replies) · cm = copy guest to CUSTOMER_MASTER · crm = copy to <client>_CRM_DB.
   GUEST_CRM (MASTER DB) + GUEST_SCANS / GUEST_TRANSACTIONS (TRANSACTION DB) are always written — that is the record. */
function bnxGuestCtl_(clientId) {
  var o = {};
  try { o = JSON.parse(PropertiesService.getScriptProperties().getProperty('GUEST_CTL_' + String(clientId || '')) || '{}') || {}; } catch (e) { o = {}; }
  return { waAuto: o.waAuto !== 0, waGuest: o.waGuest !== 0, cm: o.cm !== 0, crm: o.crm !== 0 };
}
function bnxCrmOn_(key, clientId) { return String(bnxCrmProp_(PropertiesService.getScriptProperties(), key, clientId) || 'YES').toUpperCase() !== 'NO'; }
/* <clientId>_CRM_DB — found, never created (a missing CRM DB just skips the copy) */
function bnxCrmCrmSs_(clientId) {
  var cid = String(clientId || '').trim(); if (!cid || !bnxCrmOn_('CRM_TO_CRM_DB', cid)) return null;
  var P = PropertiesService.getScriptProperties(), key = 'CRM_CRMDB_ID_' + cid, id = P.getProperty(key);
  if (id === 'NONE') { var c = CacheService.getScriptCache(); if (c.get('crmdb_none_' + cid)) return null; P.deleteProperty(key); id = ''; }
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { P.deleteProperty(key); } }
  var MIME = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false", best = null;
  var it = DriveApp.searchFiles("title contains '" + cid + "' and title contains 'CRM' and " + MIME);
  while (it.hasNext()) { var f = it.next(), n = f.getName();
    if (n.toUpperCase().indexOf(cid.toUpperCase()) !== 0 || !/CRM/i.test(n) || /MASTER|TRANS|^copy of|backup|old|test/i.test(n)) continue;
    if (!best || n.length < best.getName().length) best = f; }
  if (!best) { P.setProperty(key, 'NONE'); CacheService.getScriptCache().put('crmdb_none_' + cid, '1', 21600); return null; }
  P.setProperty(key, best.getId()); return SpreadsheetApp.open(best);
}
function bnxCrmTab_(ss, name, head) {
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#f3e6d8'); sh.setFrozenRows(1); return sh; }
  var lc = Math.max(sh.getLastColumn(), 1), cur = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (x) { return String(x).trim().toUpperCase(); });
  var used = cur.length; while (used > 0 && !cur[used - 1]) used--;
  var miss = head.filter(function (h) { return cur.indexOf(h) < 0; });
  if (miss.length) sh.getRange(1, used + 1, 1, miss.length).setValues([miss]).setFontWeight('bold').setBackground('#f3e6d8');
  return sh;
}
function bnxCrmRowObj_(sh, row) {
  var lc = sh.getLastColumn(), h = sh.getRange(1, 1, 1, lc).getValues()[0], v = sh.getRange(row, 1, 1, lc).getValues()[0], o = {};
  h.forEach(function (x, i) { x = String(x).trim().toUpperCase(); if (x && !(x in o)) o[x] = v[i]; }); return o;
}
/* write o's fields into row (only columns the sheet has; blanks in o never wipe a filled cell) */
function bnxCrmPutRow_(sh, row, o) {
  var C = bnxCrmCols_(sh), lc = sh.getLastColumn(), cur = sh.getRange(row, 1, 1, lc).getValues()[0], ch = false;
  Object.keys(o).forEach(function (k) { var c = C[k]; if (!c || o[k] === '' || o[k] == null) return;
    var a = cur[c - 1], b = bnxCrmW_(sh, o[k]); if ((a instanceof Date ? a.getTime() : String(a)) === (b instanceof Date ? b.getTime() : String(b))) return; cur[c - 1] = b; ch = true; });
  if (ch) sh.getRange(row, 1, 1, lc).setValues([cur]);
}
/* copy this guest's GUEST_CRM card (MASTER DB) → CRM DB, and keep CUSTOMER_MASTER in step */
function bnxCrmSyncGuest_(clientId, mobile, noCreate) {
  var res = [];
  var gsh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, clientId, noCreate), gr = bnxCrmFind_(gsh, mobile, clientId);
  if (!gr) return 'no guest';
  var g = bnxCrmRowObj_(gsh, gr);
  var ctl = bnxGuestCtl_(clientId);
  try {
    var css = ctl.crm ? bnxCrmCrmSs_(clientId) : null;
    if (css) { var csh = bnxCrmTab_(css, CRM_SHEET, CRM_HEAD); try { csh.getRange(2, bnxCrmCols_(csh).MOBILE, Math.max(csh.getMaxRows() - 1, 1), 1).setNumberFormat('@'); } catch (e) {}
      var cr = bnxCrmFind_(csh, mobile, clientId), o = {}; Object.keys(g).forEach(function (k) { o[k] = g[k]; }); o.MOBILE = mobile;
      if (cr) bnxCrmPutRow_(csh, cr, o); else bnxCrmAppend_(csh, o); res.push('crm'); }
  } catch (e) { res.push('crm ERR ' + e.message); }
  try { if (ctl.cm && bnxCrmOn_('CRM_TO_CUSTOMER_MASTER', clientId)) res.push('master ' + bnxCrmCustomerMaster_(clientId, mobile, g, noCreate)); } catch (e) { res.push('master ERR ' + e.message); }
  return res.join(', ');
}
function bnxCrmCustomerMaster_(clientId, mobile, g, noCreate) {
  var ss = bnxCrmSpreadsheet_(clientId, 'MASTER', noCreate), sh = ss.getSheetByName(CRM_CUST_MASTER);
  if (!sh) return 'no ' + CRM_CUST_MASTER + ' tab';
  var C = bnxCrmCols_(sh), pc = C.PHONE || C.MOBILE || C.MOBILE_NO; if (!pc) return 'no PHONE column';
  var last = sh.getLastRow(), row = 0, max = 0;
  if (last >= 2) {
    var ph = sh.getRange(2, pc, last - 1, 1).getDisplayValues(), ids = C.CUSTOMER_ID ? sh.getRange(2, C.CUSTOMER_ID, last - 1, 1).getValues() : [];
    var cl = C.CLIENT_ID ? sh.getRange(2, C.CLIENT_ID, last - 1, 1).getDisplayValues() : null;
    for (var i = 0; i < ph.length; i++) {
      var n = parseInt(String((ids[i] || [''])[0]).replace(/^\D+/, ''), 10); if (/^CUS/i.test(String((ids[i] || [''])[0])) && n > max) max = n;
      if (!row && String(ph[i][0]).replace(/\D/g, '').slice(-10) === mobile && (!cl || !cl[i][0] || String(cl[i][0]) === String(clientId))) row = i + 2;
    }
  }
  var now = bnxNow_(), name = String(g.NAME || '').trim();
  var o = { CRN: g.CRN || '', VISIT_COUNT: g.VISIT_COUNT, TOTAL_ORDERS: g.TOTAL_ORDERS, TOTAL_SPEND: g.TOTAL_SPEND, POINTS: g.POINTS,
            LAST_VISIT: g.LAST_VISIT || now, NOTIFY_OPT_IN: String(g.OPT_IN || 'YES').toUpperCase() === 'NO' ? 'NO' : 'YES', UPDATED_AT: now };
  if (row) {
    var curName = C.CUSTOMER_NAME ? String(sh.getRange(row, C.CUSTOMER_NAME).getValue() || '').trim() : '';
    if (name && (!curName || /^Guest (CRN-\d+|\d{4})$/.test(curName))) o.CUSTOMER_NAME = name;   /* never overwrite a name the cashier typed */
    if (C.SOURCE && !String(sh.getRange(row, C.SOURCE).getValue() || '').trim()) o.SOURCE = g.SOURCE || 'QR_SCAN';
    bnxCrmPutRow_(sh, row, o); return 'updated row ' + row;
  }
  var id = 'CUS' + ('00000' + (max + 1)).slice(-5);
  o.CUSTOMER_ID = id; o.CLIENT_ID = clientId; o.CUSTOMER_NAME = name || 'Guest ' + (g.CRN || mobile.slice(-4)); o.PHONE = mobile;
  o.CUSTOMER_TYPE = 'QR Guest'; o.IS_ACTIVE = true; o.CREATED_AT = now; o.SOURCE = g.SOURCE || 'QR_SCAN';
  var r = bnxCrmAppend_(sh, o); try { sh.getRange(r, pc).setNumberFormat('@').setValue(mobile); } catch (e) {}
  return 'added ' + id;
}
/* a transaction row → also into CRM DB › GUEST_TRANSACTIONS */
function bnxCrmTxnToCrm_(clientId, obj) {
  try { var css = bnxCrmCrmSs_(clientId); if (!css) return; bnxCrmAppend_(bnxCrmTab_(css, CRM_TXN, CRM_TXN_HEAD), obj); } catch (e) { Logger.log('CRM DB txn copy: ' + e.message); }
}
/* the guest's transaction sheets: TRANSACTION DB + CRM DB copy */
function bnxCrmTxnSheets_(clientId, noCreate) {
  var out = [bnxCrmSheet_(CRM_TXN, CRM_TXN_HEAD, clientId, noCreate)];
  try { var css = bnxCrmCrmSs_(clientId); if (css && css.getSheetByName(CRM_TXN)) out.push(css.getSheetByName(CRM_TXN)); } catch (e) {}
  return out;
}
/* run once from the editor: every guest + transaction already saved → CRM DB and CUSTOMER_MASTER */
function bnxCrmSyncAll(clientId) {
  clientId = clientId || CRM_TEST_CLIENT;
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var gsh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, clientId), C = bnxCrmCols_(gsh), last = gsh.getLastRow(), n = 0;
    for (var r = 2; r <= last; r++) { var m = String(gsh.getRange(r, C.MOBILE).getDisplayValue()).replace(/\D/g, '').slice(-10);
      if (m.length === 10) { Logger.log(m + ' → ' + bnxCrmSyncGuest_(clientId, m, false)); n++; } }
    var css = bnxCrmCrmSs_(clientId), copied = 0;
    if (css) {
      var src = bnxCrmSheet_(CRM_TXN, CRM_TXN_HEAD, clientId), dst = bnxCrmTab_(css, CRM_TXN, CRM_TXN_HEAD), Cd = bnxCrmCols_(dst), have = {};
      if (dst.getLastRow() > 1 && Cd.TXN_ID) dst.getRange(2, Cd.TXN_ID, dst.getLastRow() - 1, 1).getValues().forEach(function (x) { have[String(x[0])] = 1; });
      for (var t = 2; t <= src.getLastRow(); t++) { var o = bnxCrmRowObj_(src, t); if (!o.TXN_ID || have[String(o.TXN_ID)]) continue; bnxCrmAppend_(dst, o); have[String(o.TXN_ID)] = 1; copied++; }
    }
    Logger.log('Guests synced: ' + n + ' · transactions copied to CRM DB: ' + copied + (css ? ' (' + css.getName() + ')' : ' — no ' + clientId + '_CRM_DB file found, CRM copy skipped'));
  } finally { lock.releaseLock(); }
}

/* ═══════════════ BILL → GUEST (2026-10-09, "bill to order to all record proper save") ═══════════════
   Bills are saved by the POS in TRANSACTION DB › BILL_MASTER (no mobile column). A guest's bills are found by:
     1. mobile — CUSTOMER_MOBILE / MOBILE / PHONE on the bill, or on its ORDER_MASTER row;
     2. table + night — the guest scanned that table's QR on the same business day (06:00→05:59), before the bill
        (latest scan wins when several guests sat at the table).
   Each bill is written ONCE (key = bill number) as a BILL row in GUEST_TRANSACTIONS (+ CRM DB copy) with the party /
   event of that visit, and TOTAL_ORDERS / TOTAL_SPEND on the guest card go up. Historical-import / void / ₹0 bills skipped.
   Runs every 15 min after RUN_13_AutoLinkBills (once), and from the CRM dashboard's "Link bills" button. */
function bnxCrmTblNorm_(t) { return String(t == null ? '' : t).toUpperCase().replace(/^TABLE\s*/, '').replace(/[^A-Z0-9]/g, ''); }
function bnxCrmWallMs_(w) { var m = String(w || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : 0; }
function bnxCrmMsDay_(ms) { return new Date(ms).toISOString().slice(0, 10); }
function bnxCrmBizDay_(w) { var ms = bnxCrmWallMs_(w); return ms ? bnxCrmMsDay_(ms - 6 * 3600000) : ''; }
function bnxCrmPick_(C, names) { for (var i = 0; i < names.length; i++) if (C[names[i]]) return C[names[i]]; return 0; }
function bnxCrmLinkBills_(cid, opt) {
  opt = opt || {};
  var days = Math.min(Number(opt.days || 3), 60), res = { linked: 0, byMobile: 0, byTable: 0, checked: 0, already: 0 };
  var tss = bnxCrmSpreadsheet_(cid, 'TRANSACTIONS', true);
  var txSh = bnxCrmSheet_(CRM_TXN, CRM_TXN_HEAD, cid, true), Ct = bnxCrmCols_(txSh), lastT = txSh.getLastRow(), tzT = bnxCrmSheetTz_(txSh);
  var visits = [], have = {}, nowWall = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss');
  var cutDay = bnxCrmMsDay_(bnxCrmWallMs_(nowWall) - 6 * 3600000 - days * 86400000);
  if (lastT >= 2) {
    var from = Math.max(2, lastT - 8000), tv = txSh.getRange(from, 1, lastT - from + 1, txSh.getLastColumn()).getValues();
    tv.forEach(function (r) {
      var ty = String(r[Ct.TYPE - 1] || '').toUpperCase();
      if ((ty === 'BILL' || ty === 'ORDER') && Ct.ORDER_NO) { var on = String(r[Ct.ORDER_NO - 1] || '').trim().toUpperCase(); if (on) have[on] = 1; }
      if (ty !== 'VISIT') return;
      var dt = r[Ct.DATE_TIME - 1], wall = Object.prototype.toString.call(dt) === '[object Date]' ? Utilities.formatDate(dt, tzT, 'yyyy-MM-dd HH:mm:ss') : String(dt || '');
      var mob = String(r[Ct.MOBILE - 1] || '').replace(/\D/g, '').slice(-10); if (!/^\d{10}$/.test(mob)) return;
      visits.push({ mobile: mob, table: bnxCrmTblNorm_(Ct.TABLE ? r[Ct.TABLE - 1] : ''), t: bnxCrmWallMs_(wall), day: bnxCrmBizDay_(wall),
        name: Ct.NAME ? r[Ct.NAME - 1] : '', crn: Ct.CUSTOMER_ID ? r[Ct.CUSTOMER_ID - 1] : '', event: Ct.EVENT ? String(r[Ct.EVENT - 1] || '') : '' });
    });
  }
  var gsh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true), Cg = bnxCrmCols_(gsh), guests = {};
  if (gsh.getLastRow() >= 2) gsh.getRange(2, 1, gsh.getLastRow() - 1, gsh.getLastColumn()).getValues().forEach(function (r) {
    var m = String(r[Cg.MOBILE - 1] || '').replace(/\D/g, '').slice(-10); if (m) guests[m] = { name: Cg.NAME ? r[Cg.NAME - 1] : '', crn: Cg.CRN ? r[Cg.CRN - 1] : '' }; });
  /* order id → mobile */
  var ordMob = {};
  try { var om = tss.getSheetByName('ORDER_MASTER');
    if (om && om.getLastRow() > 1) { var Co = bnxCrmCols_(om), oid = Co.ORDER_ID, opc = bnxCrmPick_(Co, ['CUSTOMER_MOBILE', 'MOBILE', 'DELIVERY_PHONE', 'CUSTOMER_PHONE']);
      if (oid && opc) { var of = Math.max(2, om.getLastRow() - 5000);
        om.getRange(of, 1, om.getLastRow() - of + 1, om.getLastColumn()).getValues().forEach(function (r) { var m = String(r[opc - 1] || '').replace(/\D/g, '').slice(-10); if (/^[6-9]\d{9}$/.test(m)) ordMob[String(r[oid - 1])] = m; }); } } } catch (e) {}
  var adds = {}, logs = [];
  ['BILL_MASTER', 'POS_BILLING'].forEach(function (tab) {
    var bs = tss.getSheetByName(tab); if (!bs || bs.getLastRow() < 2) return;
    var Cb = bnxCrmCols_(bs), tzB = bnxCrmSheetTz_(bs);
    var cNo = bnxCrmPick_(Cb, ['BILL_NUMBER', 'BILL_NO', 'INVOICE_NO', 'BILL_ID']), cTb = bnxCrmPick_(Cb, ['TABLE_ID', 'TABLE_NO', 'TABLE']);
    var cAmt = bnxCrmPick_(Cb, ['GRAND_TOTAL', 'NET_AMOUNT', 'TOTAL_AMOUNT', 'BILL_AMOUNT', 'TOTAL']), cD = bnxCrmPick_(Cb, ['BILL_DATE', 'DATE']), cT = bnxCrmPick_(Cb, ['BILL_TIME', 'TIME']);
    var cCr = Cb.CREATED_AT, cSt = bnxCrmPick_(Cb, ['BILL_STATUS', 'STATUS']), cTy = Cb.BILL_TYPE, cOid = Cb.ORDER_ID, cMob = bnxCrmPick_(Cb, ['CUSTOMER_MOBILE', 'MOBILE', 'CUSTOMER_PHONE', 'PHONE', 'MOBILE_NO']);
    var cCid = Cb.CLIENT_ID;
    if (!cNo || !cAmt) return;
    var bf = Math.max(2, bs.getLastRow() - Number(opt.maxBills || 2500));
    bs.getRange(bf, 1, bs.getLastRow() - bf + 1, bs.getLastColumn()).getValues().forEach(function (r) {
      var bno = String(r[cNo - 1] || '').trim(); if (!bno) return;
      if (cCid && r[cCid - 1] && String(r[cCid - 1]) !== cid) return;
      if (cTy && /HISTORIC/i.test(String(r[cTy - 1]))) return;
      if (cSt && /VOID|CANCEL|DELETE/i.test(String(r[cSt - 1]))) return;
      var amt = Number(r[cAmt - 1] || 0); if (!(amt > 0)) return;
      var bDay = '', bMs = 0, f = function (v, fm) { return Object.prototype.toString.call(v) === '[object Date]' ? Utilities.formatDate(v, tzB, fm) : String(v == null ? '' : v).trim(); };
      if (cD && r[cD - 1]) {
        var ds = f(r[cD - 1], 'yyyy-MM-dd'), m1 = ds.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})/); if (m1) ds = m1[3] + '-' + m1[2] + '-' + m1[1];
        var ts = cT ? f(r[cT - 1], 'HH:mm:ss') : '', tm = ts.match(/(\d{1,2}):(\d{2})/);
        bDay = ds.slice(0, 10);
        if (tm) { var hh = +tm[1]; bMs = bnxCrmWallMs_(bDay + ' ' + ('0' + hh).slice(-2) + ':' + tm[2] + ':00') + (hh < 6 ? 86400000 : 0); }
      }
      if (!bMs && cCr && r[cCr - 1]) { var cw = f(r[cCr - 1], 'yyyy-MM-dd HH:mm:ss').replace('T', ' '); bMs = bnxCrmWallMs_(cw); if (!bDay) bDay = bnxCrmBizDay_(cw); }
      if (!bDay || bDay < cutDay) return;
      res.checked++;
      if (have[bno.toUpperCase()]) { res.already++; return; }
      var mob = cMob ? String(r[cMob - 1] || '').replace(/\D/g, '').slice(-10) : '';
      if (!/^[6-9]\d{9}$/.test(mob) && cOid) mob = ordMob[String(r[cOid - 1])] || '';
      var hit = null, how = '';
      if (/^[6-9]\d{9}$/.test(mob) && guests[mob]) {
        how = 'MOBILE';
        visits.forEach(function (v) { if (v.mobile === mob && v.day === bDay && (!hit || v.t > hit.t)) hit = v; });
        if (!hit) hit = { mobile: mob, name: guests[mob].name, crn: guests[mob].crn, event: '', table: '' };
      } else {
        var tb = cTb ? bnxCrmTblNorm_(r[cTb - 1]) : '';
        if (tb) visits.forEach(function (v) {
          if (v.table !== tb || v.day !== bDay) return;
          if (bMs && (v.t > bMs + 600000 || bMs - v.t > 10 * 3600000)) return;
          if (!hit || v.t > hit.t) hit = v; });
        if (hit) how = 'TABLE';
      }
      if (!hit) return;
      have[bno.toUpperCase()] = 1;
      var a = adds[hit.mobile] = adds[hit.mobile] || { n: 0, amt: 0 }; a.n++; a.amt += amt;
      logs.push({ mobile: hit.mobile, name: hit.name || (guests[hit.mobile] || {}).name || '', customerId: hit.crn || (guests[hit.mobile] || {}).crn || '', type: 'BILL', orderNo: bno,
        table: cTb ? String(r[cTb - 1] || '') : '', amount: amt, source: 'BILL_' + how, clientId: cid, event: hit.event || '', key: 'bill-' + cid + '-' + bno, noCreate: true });
      res.linked++; if (how === 'MOBILE') res.byMobile++; else res.byTable++;
    });
  });
  if (logs.length) {
    var lock = bnxCrmLockGuests_(cid);
    try {
      Object.keys(adds).forEach(function (m) { var rw = bnxCrmFind_(gsh, m, cid); if (!rw) return; var C = bnxCrmCols_(gsh);
        if (C.TOTAL_ORDERS) gsh.getRange(rw, C.TOTAL_ORDERS).setValue(Number(gsh.getRange(rw, C.TOTAL_ORDERS).getValue() || 0) + adds[m].n);
        if (C.TOTAL_SPEND) gsh.getRange(rw, C.TOTAL_SPEND).setValue(Number(gsh.getRange(rw, C.TOTAL_SPEND).getValue() || 0) + adds[m].amt); });
    } finally { lock.release(); }
    logs.forEach(function (t) { try { bnxCrmLogTxn_(t); } catch (e) { Logger.log('bill txn: ' + e.message); } });
    Object.keys(adds).forEach(function (m) { try { bnxCrmSyncGuest_(cid, m, true); } catch (e) {} });
  }
  return res;
}
function bnxCrmAutoLinkBills() {
  var P = PropertiesService.getScriptProperties();
  String(P.getProperty('CRM_BILL_LINK_CLIENTS') || P.getProperty('WA_CLIENTS') || CRM_TEST_CLIENT).split(/[\s,]+/).filter(String).forEach(function (c) {
    try { Logger.log(c + ' bills → guests: ' + JSON.stringify(bnxCrmLinkBills_(c, { days: 2 }))); } catch (e) { Logger.log(c + ': ' + e.message); }
  });
}
/* run ONCE: links bills to guests every 15 minutes (and links the last 7 days now) */
function RUN_13_AutoLinkBills() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bnxCrmAutoLinkBills') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('bnxCrmAutoLinkBills').timeBased().everyMinutes(15).create();
  Logger.log('Trigger set (every 15 min). Now: ' + JSON.stringify(bnxCrmLinkBills_(CRM_TEST_CLIENT, { days: 7 })));
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
  if (p.action === 'GUEST_CHECKIN' && p.mode) return ContentService.createTextOutput(JSON.stringify(bnxGuestCheckinPublic_(p))).setMimeType(ContentService.MimeType.JSON);
  if (p['hub.mode'] !== 'subscribe') return null;
  var want = PropertiesService.getScriptProperties().getProperty('WA_VERIFY_TOKEN') || '';
  var ok = want && p['hub.verify_token'] === want;
  return ContentService.createTextOutput(ok ? String(p['hub.challenge'] || '') : 'forbidden');
}
/* doPost: incoming WhatsApp messages → check-in */
function bnxWaRoutePost_(e) {
  var raw = e && e.postData && e.postData.contents;
  if (!raw) return null;
  var J = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  if (raw.indexOf('whatsapp_business_account') < 0) {
    var j = null; try { j = JSON.parse(raw); } catch (x) { return null; }
    if (!j || typeof j !== 'object') return null;
    if (j.action === 'CRM_BILL_CAPTURE') return J(bnxCrmBillCapture_(j));
    if (j.action === 'GET_CRM_SCANS') return J(bnxCrmScansList_(j));
    if (j.action === 'CRM_LINK_BILLS') {   /* CRM dashboard "Link bills" — same session rule as the rest of the ERP */
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(j.sessionToken || ''))) return J({ success: false, error: 'Invalid or expired session' });
      try { return J({ success: true, data: bnxCrmLinkBills_(String(j.clientId || '').trim(), { days: Number(j.days || 7) }) }); } catch (x) { return J({ success: false, error: String(x.message || x) }); }
    }
    if (/^SALES_WA_/.test(String(j.action || '')) && typeof bnxSalesWaRoute_ === 'function') return J(bnxSalesWaRoute_(j));   /* sales-wa-report.gs */
    if (/^FLOOR_CLOSE_/.test(String(j.action || '')) && typeof bnxFloorRoute_ === 'function') return J(bnxFloorRoute_(j));       /* table-floor-fix.gs */
    if (!j.action && j.requestId && (j.accessToken || j.status)) { var t; try { t = bnxTruecallerCallback_(j); } catch (x) { t = { ok: false, error: String(x.message || x) }; } return J(t); }
    return null;
  }
  var res = { ok: true, handled: 0 };
  try { res.handled = bnxWaHandle_(JSON.parse(raw)); } catch (err) { res.ok = false; res.error = String(err.message || err); Logger.log('WA webhook: ' + res.error); }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}
/* bnxWaHandle_ → "Guest growth suite.gs" (logged, retry-safe, feedback replies, delivery receipts) */
function bnxWaCheckinFromMessage_(msg, P) {
  P = P || PropertiesService.getScriptProperties();
  var digits = String(msg.from || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.indexOf('91') === 0) digits = digits.slice(2);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;                       /* Indian mobiles only */
  /* DPDP: withdraw consent / erase — the message comes from the guest's own number, which proves who asks */
  var tx = String(msg.text || '').trim(), cmdCid = P.getProperty('WA_CLIENT_' + msg.phoneId) || '';
  var cmd = /^(stop|unsubscribe)\b/i.test(tx) ? 'STOP' : /^start\b/i.test(tx) ? 'START' : /^(delete my data|delete my details|erase my data)\b/i.test(tx) ? 'DELETE' : '';
  if (cmd) {
    var cids = cmdCid ? [cmdCid] : String(P.getProperty('WA_CLIENTS') || CRM_TEST_CLIENT).split(/[\s,]+/).filter(String);
    var done = [];
    cids.forEach(function (c) { try { done.push(c + ':' + (cmd === 'DELETE' ? bnxCrmEraseGuest_(c, digits, 'WHATSAPP') : bnxCrmSetConsent_(c, digits, cmd === 'START'))); } catch (e) { done.push(c + ':ERR ' + e.message); } });
    try {
      var pr0 = function (k) { return bnxCrmProp_(P, k, cids[0]); };
      if (String(pr0('WA_PROVIDER')).toUpperCase() === 'META')
        metaWaText_(pr0, digits, cmd === 'DELETE' ? '✅ Your details have been deleted from our guest records. Bills required by tax law are kept without your name or number.'
          : cmd === 'STOP' ? '✅ Done — you will not get offers or event messages from us. Reply START to join again.' : '✅ You are subscribed to our offers & event updates. Reply STOP any time.');
    } catch (e) {}
    return { success: true, command: cmd, result: done.join(' | ') };
  }
  var code = /#CI-([A-Za-z0-9_]{3,30})-(T[A-Za-z0-9]{1,12}|C)(?:-P([A-Za-z0-9_]{1,30}))?(?:-E([A-Za-z0-9_]{1,30}))?(?:-D([A-Za-z0-9]{8,16}))?/i.exec(String(msg.text || ''));
  var mappedCid = P.getProperty('WA_CLIENT_' + msg.phoneId) || '';
  var cid = code ? code[1].toUpperCase() : mappedCid;
  if (!cid) return null;                                                /* not a check-in for a known restaurant */
  /* 2026-11-09: never derive the tenant from guest-typed text alone — when this WhatsApp number belongs to ONE restaurant
     (WA_CLIENT_<phone id>), a #CI code for another restaurant is ignored (someone pasting codes cannot write into other clients) */
  if (code && mappedCid && mappedCid.toUpperCase() !== cid) return null;
  var table = code && /^T/i.test(code[2]) ? code[2].slice(1) : '';
  var party = code && code[3] ? code[3].replace(/_/g, ' ') : '';      /* "SUFI_NIGHT" → "SUFI NIGHT" */
  var evName = (code && code[4] ? code[4].replace(/_/g, ' ') : '') || party || '';
  var day = Utilities.formatDate(new Date(Date.now() - 6 * 3600 * 1000), 'Asia/Kolkata', 'yyyyMMdd');   /* business day 06:00 */
  var out = bnxCustomerCheckin_({
    clientId: cid, mobileNo: digits, customerName: String(msg.name || '').slice(0, 60), tableId: table,
    scanKey: (party ? 'party-' + party.toLowerCase() : 'qr-' + (table ? table.toLowerCase() : 'counter')) + '-' + day,
    requestId: 'wa-' + msg.msgId, notifyOptIn: true, source: 'WHATSAPP' + (party ? '|PARTY:' + party : ''),
    welcomeSms: false, deferWelcome: true, eventName: evName, deviceId: code && code[5] ? code[5] : '', _noCreate: true
  });
  if (!out || out.success === false) return out;
  /* reply in the chat the guest opened — free text is allowed for 24 h after their message */
  var pr = function (k) { return bnxCrmProp_(P, k, cid); };
  if (String(pr('WA_PROVIDER')).toUpperCase() === 'META' && !cache_recent_('wr_' + cid + '_' + digits, 300)) {
    var restaurant = pr('RESTAURANT_NAME') || bnxCrmRestaurantName_(cid), first = String(out.customerName || '').split(' ')[0] || 'there';
    var txt = (pr('WA_CHECKIN_REPLY') || 'Hi {name}! ✅ You are checked in at {restaurant}{table}. Your customer number is {crn}. Enjoy your meal!')
      .split('{name}').join(first).split('{restaurant}').join(restaurant).split('{table}').join(table ? ' · Table ' + table : '').split('{crn}').join(out.crn || '-');
    var res;
    res = bnxWaReplyOrSms_(pr, digits, txt, cid);
    try {
      var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD, cid, true), row = bnxCrmFind_(sh, digits, cid), C = bnxCrmCols_(sh);
      if (row && String(res).indexOf('OK') === 0) {
        if (C.WELCOME_SENT && !sh.getRange(row, C.WELCOME_SENT).getValue()) sh.getRange(row, C.WELCOME_SENT).setValue(Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm'));
        if (C.WELCOME_CHANNEL) sh.getRange(row, C.WELCOME_CHANNEL).setValue('WHATSAPP');
      }
      bnxCrmAppend_(bnxCrmSheet_(CRM_LOG, CRM_LOG_HEAD, cid, true), { TIME: bnxNow_(), MOBILE: digits, CHANNEL: 'WHATSAPP_REPLY', RESULT: String(res).slice(0, 300), TEXT: txt, CLIENT_ID: cid });
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
function RUN_5_CopyAllGuestsToMasterAndCrmDb() { bnxCrmSyncAll(CRM_TEST_CLIENT); }
/* owner: a guest asked in person / by call — put the number in the quotes, then Run */
function RUN_7_EraseGuestByMobile() { var m = ''; if (!m) { Logger.log('Put the guest mobile number inside RUN_7_EraseGuestByMobile first.'); return; } Logger.log(bnxCrmEraseGuest_(CRM_TEST_CLIENT, m, 'OWNER')); }
/* run monthly (or add a time-driven trigger): removes anonymous scans older than SCAN_RETENTION_DAYS (default 365) */
function RUN_8_PurgeOldAnonymousScans() { bnxCrmPurgeScans(CRM_TEST_CLIENT); }
/* WhatsApp welcome not arriving? Put your own number below, run, then read the log + GUEST_WELCOME_LOG tab. */
function RUN_12_TestWelcomeWhatsApp() {
  var mobile = '';   /* ← your 10-digit mobile */
  var P = PropertiesService.getScriptProperties(), pr = function (k) { return bnxCrmProp_(P, k, CRM_TEST_CLIENT); };
  Logger.log('WA_PROVIDER=' + (pr('WA_PROVIDER') || 'NOT SET') + ' · META_WA_TOKEN ' + (pr('META_WA_TOKEN') ? 'set' : 'MISSING') + ' · META_WA_PHONE_ID ' + (pr('META_WA_PHONE_ID') || 'MISSING') +
    ' · META_WA_TEMPLATE ' + (pr('META_WA_TEMPLATE') || 'guest_welcome (default)') + ' · META_WA_LANG ' + (pr('META_WA_LANG') || 'en') + ' · SMS_PROVIDER ' + (pr('SMS_PROVIDER') || 'NONE'));
  if (!/^\d{10}$/.test(mobile)) { Logger.log('Put your 10-digit mobile inside RUN_12_TestWelcomeWhatsApp and run again.'); return; }
  Logger.log(JSON.stringify(bnxSendWelcome_(mobile, 'Test', CRM_TEST_CLIENT, 'CRN-TEST')));
  Logger.log('Details (Meta error text, if any) → MASTER_DB › GUEST_WELCOME_LOG, last row.');
}
/* guest rows written before 2026-10-09 were saved as US time (12½ h early) → shifted to Indian time. Runs once. */
function RUN_11_FixOldGuestTimes() {
  var P = PropertiesService.getScriptProperties(), flag = 'GUEST_TIME_FIXED_' + CRM_TEST_CLIENT;
  if (P.getProperty(flag)) { Logger.log('Already done on ' + P.getProperty(flag) + ' — not run twice.'); return; }
  var spec = [[CRM_SHEET, CRM_HEAD, ['FIRST_VISIT', 'LAST_VISIT', 'CONSENT_AT']], [CRM_LOG, CRM_LOG_HEAD, ['TIME']],
              [CRM_TXN, CRM_TXN_HEAD, ['DATE_TIME']], [CRM_SCAN, CRM_SCAN_HEAD, ['DATE_TIME', 'IDENTIFIED_AT']]], out = [];
  /* rows written by the new code are already right: only cells older than its first write are shifted */
  var cut = Number(P.getProperty('GUEST_TIME_NEWCODE_AT') || Date.now());
  spec.forEach(function (sp) {
    try {
      var sh = bnxCrmSheet_(sp[0], sp[1], CRM_TEST_CLIENT, true); if (!sh || sh.getLastRow() < 2) return;
      var tz = bnxCrmSheetTz_(sh); if (/^Asia\/(Kolkata|Calcutta)$/.test(tz)) { out.push(sp[0] + ': sheet already Indian time'); return; }
      var C = bnxCrmCols_(sh), n = 0;
      sp[2].forEach(function (h) { if (!C[h]) return; var rg = sh.getRange(2, C[h], sh.getLastRow() - 1, 1), v = rg.getValues(), ch = false;
        v.forEach(function (r) { if (Object.prototype.toString.call(r[0]) === '[object Date]' && r[0].getTime() < cut) { r[0] = bnxCrmIstWall_(r[0], tz); ch = true; n++; } });
        if (ch) rg.setValues(v); });
      out.push(sp[0] + ' (' + tz + '): ' + n + ' time cells → IST');
    } catch (e) { out.push(sp[0] + ': ' + e.message); }
  });
  P.setProperty(flag, new Date().toISOString()); Logger.log(out.join('\n'));
}
function RUN_6_ShowCheckinSetup() { Logger.log(JSON.stringify(bnxGuestCfg_(CRM_TEST_CLIENT))); Logger.log('otp channel: ' + (bnxOtpChannel_(CRM_TEST_CLIENT) || 'NONE — set META_WA_OTP_TEMPLATE or OTP_SMS=FAST2SMS + FAST2SMS_KEY')); }