/**
 * BALAJI NEXTGEN ERP · HAPPYSERVE — CUSTOMER CRM + AUTO WELCOME MESSAGE
 * Add this file to your Apps Script project (File > New > Script, paste).
 *
 * WHAT IT DOES
 *  1. CUSTOMER_CHECKIN  — called by customer-order.html when a guest scans the table QR.
 *     - Looks the mobile number up in sheet CUSTOMER_MASTER (created automatically).
 *     - New number  -> {isNewCustomer:true}; the page then asks for the name.
 *     - Name arrives -> saved in the record, and the welcome SMS/WhatsApp is sent ONCE.
 *     - Returning   -> returns saved name, points, visit count (+1 per scan).
 *  2. Welcome message is sent automatically (SMS and/or WhatsApp) and logged in WELCOME_LOG.
 *  3. TRANSACTIONS (optional, default ON): every visit and every order is also written to
 *     CUSTOMER_TRANSACTIONS, linked to the customer by mobile. Turn off with CRM_TXN_LOG = NO.
 *     Master (CUSTOMER_MASTER) = one row per customer; Transactions = one row per visit/order.
 *
 * INSTALL (3 steps)
 *  A) In your existing doPost(e), AFTER the sessionToken/clientId check and BEFORE the
 *     big switch(action), add:
 *         var crm = bnxCrmRoute_(action, req);   // req = the parsed JSON body
 *         if (crm) return ContentService.createTextOutput(JSON.stringify(crm))
 *                          .setMimeType(ContentService.MimeType.JSON);
 *  B) Project Settings > Script properties — add (see CONFIG below).
 *  B2) To log orders: in your SAVE_ORDER case, after a successful save, add
 *         bnxCrmAfterOrder_(req, result);   // req = request body, result = your SAVE_ORDER response
 *  C) Deploy > Manage deployments > Edit > New version > Deploy.
 *
 * CONFIG (Script properties)
 *  SMS_PROVIDER      FAST2SMS | MSG91 | TWILIO | NONE      (default NONE)
 *  WA_PROVIDER       TWILIO | NONE                          (default NONE)
 *  FAST2SMS_KEY      Fast2SMS authorization key
 *  MSG91_AUTHKEY     MSG91 auth key
 *  MSG91_TEMPLATE_ID MSG91 DLT-approved flow/template id (variables: name, restaurant)
 *  MSG91_SENDER      6-letter DLT sender id
 *  TWILIO_SID / TWILIO_TOKEN / TWILIO_FROM_SMS / TWILIO_FROM_WA  (e.g. whatsapp:+14155238886)
 *  RESTAURANT_NAME   shown in the message (falls back to the spreadsheet name)
 *  CRM_TXN_LOG       YES (default) | NO — write the CUSTOMER_TRANSACTIONS log
 *  CRM_SHEET_ID      optional — spreadsheet id of the client DB (default: this script's spreadsheet)
 *  WELCOME_TEXT      optional template, e.g. "Hi {name}, welcome to {restaurant}! Enjoy your meal."
 *
 *  INDIA NOTE: promotional/transactional SMS must use a DLT-registered template. The text
 *  you register must match WELCOME_TEXT exactly (with {name} and {restaurant} as variables).
 */

var CRM_SHEET = 'CUSTOMER_MASTER';
var CRM_LOG   = 'WELCOME_LOG';
var CRM_TXN   = 'CUSTOMER_TRANSACTIONS';
var CRM_TXN_HEAD = ['TXN_ID','DATE_TIME','MOBILE','NAME','TYPE','ORDER_NO','TABLE','ITEMS','AMOUNT','DISCOUNT',
                    'POINTS_EARNED','POINTS_REDEEMED','POINTS_BALANCE','SOURCE','CLIENT_ID'];
var CRM_HEAD  = ['MOBILE','NAME','FIRST_VISIT','LAST_VISIT','VISIT_COUNT','POINTS','TOTAL_ORDERS','TOTAL_SPEND',
                 'WELCOME_SENT','OPT_IN','LAST_TABLE','SOURCE','LAST_SCAN_KEY','CLIENT_ID'];

/* ───────────── router ───────────── */
function bnxCrmRoute_(action, req) {
  if (action === 'CUSTOMER_CHECKIN') return bnxCustomerCheckin_(req);
  var isGuest = req && (req.guest === true || req.source === 'CUSTOMER_QR');
  if (isGuest && (action === 'GET_CRM_CUSTOMERS' || action === 'GET_CRM_TRANSACTIONS'))
    return { success: false, error: 'Not allowed' };   // guest QR page can never read customer phone numbers
  if (action === 'GET_CRM_CUSTOMERS') return bnxCrmList_(CRM_SHEET, CRM_HEAD, req, 2000);
  if (action === 'GET_CRM_TRANSACTIONS') return bnxCrmList_(CRM_TXN, CRM_TXN_HEAD, req, 3000);
  return null; // not ours — let the existing switch handle it
}

/* Read-only lists for the dashboard (Settings > Customer Records). Optional req.mobile filters rows. */
function bnxCrmList_(name, head, req, max) {
  var sh = bnxCrmSheet_(name, head), last = sh.getLastRow();
  if (last < 2) return { success: true, data: [] };
  var tz = Session.getScriptTimeZone();
  var rows = sh.getRange(2, 1, last - 1, head.length).getValues().map(function (r) {
    var o = {};
    head.forEach(function (h, i) { o[h] = r[i] instanceof Date ? Utilities.formatDate(r[i], tz, 'yyyy-MM-dd HH:mm') : r[i]; });
    return o;
  });
  if (req.clientId) rows = rows.filter(function (o) { return !o.CLIENT_ID || o.CLIENT_ID === req.clientId; });
  if (req.mobile) { var m = String(req.mobile).replace(/\D/g, '').slice(-10); rows = rows.filter(function (o) { return String(o.MOBILE).slice(-10) === m; }); }
  return { success: true, data: rows.reverse().slice(0, max) };   // newest first
}

/* ───────────── sheet helpers ───────────── */
function bnxCrmSheet_(name, head) {
  var id = PropertiesService.getScriptProperties().getProperty('CRM_SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#f3e6d8');
    sh.setFrozenRows(1);
  }
  return sh;
}
function bnxCrmCol_(i) { return CRM_HEAD.indexOf(i) + 1; }
function bnxCrmFind_(sh, mobile) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var vals = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).replace(/\D/g, '').slice(-10) === mobile) return i + 2;
  return 0;
}
function bnxCrmClean_(n) {
  return String(n || '').replace(/[^\p{L}\s.'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
    .split(' ').map(function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''; }).join(' ');
}

/* ───────────── CUSTOMER_CHECKIN ───────────── */
function bnxCustomerCheckin_(req) {
  var mobile = String(req.mobileNo || '').replace(/\D/g, '').slice(-10);
  if (mobile.length !== 10) return { success: false, error: 'Invalid mobile number' };

  // idempotency: same requestId twice (retry / double tap) returns the first result
  var cache = CacheService.getScriptCache(), rk = 'crm_' + (req.requestId || '');
  if (req.requestId && cache.get(rk)) return JSON.parse(cache.get(rk));

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD);
    var name = bnxCrmClean_(req.customerName);
    var now = new Date();
    var row = bnxCrmFind_(sh, mobile);
    var out, newScanFlag_ = false;

    if (!row) {                                   // ── brand-new guest
      var rec = [mobile, name, now, now, 1, 0, 0, 0, '', req.notifyOptIn === false ? 'NO' : 'YES',
                 req.tableId || '', req.source || 'QR_SCAN', req.scanKey || '', req.clientId || ''];
      sh.appendRow(rec);
      row = sh.getLastRow();
      out = { success: true, isNewCustomer: !name, customerName: name, points: 0, visitCount: 1 };
    } else {                                      // ── existing guest
      var cur = sh.getRange(row, 1, 1, CRM_HEAD.length).getValues()[0];
      var savedName = cur[bnxCrmCol_('NAME') - 1];
      var visits = Number(cur[bnxCrmCol_('VISIT_COUNT') - 1] || 0);
      var newScan = req.scanKey && req.scanKey !== cur[bnxCrmCol_('LAST_SCAN_KEY') - 1] && !req.customerName;
      if (name && name !== savedName) sh.getRange(row, bnxCrmCol_('NAME')).setValue(name);   // name saved in record
      if (newScan) { newScanFlag_ = true; visits++; sh.getRange(row, bnxCrmCol_('VISIT_COUNT')).setValue(visits); }
      sh.getRange(row, bnxCrmCol_('LAST_VISIT')).setValue(now);
      if (req.tableId) sh.getRange(row, bnxCrmCol_('LAST_TABLE')).setValue(req.tableId);
      if (req.scanKey) sh.getRange(row, bnxCrmCol_('LAST_SCAN_KEY')).setValue(req.scanKey);
      if (req.notifyOptIn === false) sh.getRange(row, bnxCrmCol_('OPT_IN')).setValue('NO');
      var finalName = name || savedName;
      out = { success: true, isNewCustomer: !finalName, customerName: finalName,
              points: Number(cur[bnxCrmCol_('POINTS') - 1] || 0), visitCount: visits };
    }

    // ── visit transaction (new guest, or a fresh scan by a returning guest)
    if (!req.customerName && (out.visitCount === 1 && !sh.getRange(row, bnxCrmCol_('WELCOME_SENT')).getValue() || newScanFlag_)) {
      bnxCrmLogTxn_({ mobile: mobile, name: out.customerName, type: 'VISIT', table: req.tableId, source: req.source || 'QR_SCAN',
                      balance: out.points, clientId: req.clientId, key: 'visit-' + (req.scanKey || req.requestId) });
    }

    // ── AUTOMATIC WELCOME: once per customer, as soon as we know the name
    var finalNm = out.customerName;
    var sent = sh.getRange(row, bnxCrmCol_('WELCOME_SENT')).getValue();
    var optIn = sh.getRange(row, bnxCrmCol_('OPT_IN')).getValue() !== 'NO';
    var wantWelcome = req.welcomeSms === true || !req.deferWelcome;
    if (!sent && optIn && finalNm && wantWelcome) {
      var r = bnxSendWelcome_(mobile, finalNm);
      sh.getRange(row, bnxCrmCol_('WELCOME_SENT')).setValue(r.ok ? Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : '');
      out.welcome = r.ok ? 'sent' : 'failed';
    }
    if (req.requestId) cache.put(rk, JSON.stringify(out), 600);
    return out;
  } finally { lock.releaseLock(); }
}

/* ───────────── welcome message ───────────── */
function bnxSendWelcome_(mobile, name) {
  var P = PropertiesService.getScriptProperties();
  var restaurant = P.getProperty('RESTAURANT_NAME') || SpreadsheetApp.getActiveSpreadsheet().getName();
  var tpl = P.getProperty('WELCOME_TEXT') || 'Hi {name}, welcome to {restaurant}! Thank you for visiting us. Enjoy your meal.';
  var text = tpl.replace(/\{name\}/g, name.split(' ')[0]).replace(/\{restaurant\}/g, restaurant);
  return bnxSendText_(mobile, text, 'WELCOME', P.getProperty('MSG91_TEMPLATE_ID'),
                      { name: name.split(' ')[0], restaurant: restaurant });
}

/* Shared sender: WhatsApp first, SMS fallback, always logged in WELCOME_LOG. */
function bnxSendText_(mobile, text, kind, msg91Template, msg91Vars) {
  var P = PropertiesService.getScriptProperties();
  var results = [];
  var sms = (P.getProperty('SMS_PROVIDER') || 'NONE').toUpperCase();
  var wa  = (P.getProperty('WA_PROVIDER')  || 'NONE').toUpperCase();
  try {
    if (wa === 'TWILIO') results.push(['WHATSAPP', twilio_(P, 'whatsapp:+91' + mobile, P.getProperty('TWILIO_FROM_WA'), text)]);
  } catch (e) { results.push(['WHATSAPP', 'ERR ' + e.message]); }
  var waOk = results.length && String(results[0][1]).indexOf('ERR') !== 0;
  if (!waOk) {                                    // SMS is sent if WhatsApp is off or failed
    try {
      if (sms === 'FAST2SMS') results.push(['SMS', fast2sms_(P, mobile, text)]);
      else if (sms === 'MSG91') { if (msg91Template) results.push(['SMS', msg91_(P, mobile, msg91Template, msg91Vars)]); }
      else if (sms === 'TWILIO') results.push(['SMS', twilio_(P, '+91' + mobile, P.getProperty('TWILIO_FROM_SMS'), text)]);
    } catch (e) { results.push(['SMS', 'ERR ' + e.message]); }
  }
  var ok = results.some(function (x) { return String(x[1]).indexOf('ERR') !== 0; });
  if (!results.length) Logger.log('Welcome not sent: set SMS_PROVIDER / WA_PROVIDER in Script properties');
  try {
    bnxCrmSheet_(CRM_LOG, ['TIME', 'MOBILE', 'CHANNEL', 'RESULT', 'TEXT'])
      .appendRow([new Date(), mobile, kind + ':' + results.map(function (x) { return x[0]; }).join('+') || 'NONE', JSON.stringify(results).slice(0, 300), text]);
  } catch (e) {}
  return { ok: ok };
}

function fast2sms_(P, mobile, text) {
  var res = UrlFetchApp.fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'post', muteHttpExceptions: true, headers: { authorization: P.getProperty('FAST2SMS_KEY') },
    payload: { route: 'q', message: text, language: 'english', flash: 0, numbers: mobile }
  });
  var j = JSON.parse(res.getContentText());
  if (!j.return) throw new Error(j.message || 'Fast2SMS failed');
  return 'OK';
}
function msg91_(P, mobile, templateId, vars) {
  var res = UrlFetchApp.fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'post', muteHttpExceptions: true, contentType: 'application/json',
    headers: { authkey: P.getProperty('MSG91_AUTHKEY') },
    payload: JSON.stringify({ template_id: templateId, sender: P.getProperty('MSG91_SENDER'),
      short_url: '0', recipients: [Object.assign({ mobiles: '91' + mobile }, vars || {})] })
  });
  var j = JSON.parse(res.getContentText());
  if (j.type !== 'success') throw new Error(j.message || 'MSG91 failed');
  return 'OK';
}
function twilio_(P, to, from, text) {
  var sid = P.getProperty('TWILIO_SID');
  var res = UrlFetchApp.fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
    method: 'post', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + P.getProperty('TWILIO_TOKEN')) },
    payload: { To: to, From: from, Body: text }
  });
  var j = JSON.parse(res.getContentText());
  if (!j.sid) throw new Error(j.message || 'Twilio failed');
  return 'OK';
}

/* ───────────── transactions ───────────── */
function bnxCrmLogTxn_(t) {
  var P = PropertiesService.getScriptProperties();
  if ((P.getProperty('CRM_TXN_LOG') || 'YES').toUpperCase() === 'NO') return;
  var cache = CacheService.getScriptCache(), k = 'txn_' + (t.key || '');
  if (t.key) { if (cache.get(k)) return; cache.put(k, '1', 21600); }            // never log the same event twice
  var sh = bnxCrmSheet_(CRM_TXN, CRM_TXN_HEAD);
  sh.appendRow(['TX' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10),
    new Date(), t.mobile, t.name || '', t.type, t.orderNo || '', t.table || '', t.items || '', Number(t.amount || 0),
    Number(t.discount || 0), Number(t.earned || 0), Number(t.redeemed || 0), t.balance == null ? '' : t.balance,
    t.source || '', t.clientId || '']);
}

/* Call after a successful SAVE_ORDER. Updates the customer master (orders, spend, points)
   and writes one ORDER row in CUSTOMER_TRANSACTIONS. Safe to call twice for the same order. */
function bnxCrmAfterOrder_(req, result) {
  try {
    var mobile = String(req.mobileNo || '').replace(/\D/g, '').slice(-10);
    if (mobile.length !== 10 || (result && result.success === false)) return;
    var orderNo = (result && (result.orderNo || (result.data && result.data.ORDER_NO))) || '';
    var key = 'order-' + (orderNo || req.requestId || '');
    var cache = CacheService.getScriptCache();
    if (cache.get('txn_' + key)) return;                                        // already processed

    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD), row = bnxCrmFind_(sh, mobile);
      var amount = Number(req.billAmount || 0), earned = Number((result && result.earned) || 0), redeemed = Number(req.redeemedPoints || 0);
      var name = bnxCrmClean_(req.customerName);
      if (!row) {                                                               // order without check-in: still create the master row
        sh.appendRow([mobile, name === 'Guest' ? '' : name, new Date(), new Date(), 1, 0, 0, 0, '', 'YES', req.tableId || '', req.orderSource || 'ORDER', req.scanKey || '', req.clientId || '']);
        row = sh.getLastRow();
      }
      var add = function (col, v) { var c = sh.getRange(row, bnxCrmCol_(col)); c.setValue(Number(c.getValue() || 0) + Number(v || 0)); };
      add('TOTAL_ORDERS', 1); add('TOTAL_SPEND', amount); add('POINTS', earned - redeemed);
      sh.getRange(row, bnxCrmCol_('LAST_VISIT')).setValue(new Date());
      if (name && name !== 'Guest' && !sh.getRange(row, bnxCrmCol_('NAME')).getValue()) sh.getRange(row, bnxCrmCol_('NAME')).setValue(name);
      var items = (req.items || []).map(function (i) { return (i.qty || 1) + 'x ' + (i.itemName || ''); }).join(', ').slice(0, 400);
      bnxCrmLogTxn_({ mobile: mobile, name: sh.getRange(row, bnxCrmCol_('NAME')).getValue(), type: 'ORDER', orderNo: orderNo,
        table: req.tableId, items: items, amount: amount, discount: req.redeemedDiscount, earned: earned, redeemed: redeemed,
        balance: sh.getRange(row, bnxCrmCol_('POINTS')).getValue(), source: req.orderSource || 'CUSTOMER', clientId: req.clientId, key: key });
      bnxSendOrderMsg_(mobile, sh.getRange(row, bnxCrmCol_('NAME')).getValue(), orderNo, earned,
                       sh.getRange(row, bnxCrmCol_('POINTS')).getValue(), req, sh.getRange(row, bnxCrmCol_('OPT_IN')).getValue());
    } finally { lock.releaseLock(); }
  } catch (e) { Logger.log('bnxCrmAfterOrder_ ' + e.message); }                // CRM problems must never block an order
}

/* Order confirmation + points balance. Only if ORDER_MSG=YES, guest opted in, and not already sent.
   Optional properties: ORDER_TEXT ("Hi {name}, order {order} at {restaurant} is confirmed.{points} Thank you!"),
   MSG91_ORDER_TEMPLATE_ID (DLT template with variables name, restaurant, order, points). */
function bnxSendOrderMsg_(mobile, name, orderNo, earned, balance, req, optInCell) {
  try {
    var P = PropertiesService.getScriptProperties();
    if ((P.getProperty('ORDER_MSG') || 'NO').toUpperCase() !== 'YES') return;
    if (optInCell === 'NO' || req.notifyOptIn === false) return;
    var restaurant = P.getProperty('RESTAURANT_NAME') || SpreadsheetApp.getActiveSpreadsheet().getName();
    var first = String(name || 'there').split(' ')[0] || 'there';
    var pts = Number(earned) > 0 ? ' You earned ' + earned + ' points (balance ' + balance + ').' : '';
    var tpl = P.getProperty('ORDER_TEXT') || 'Hi {name}, your order {order} at {restaurant} is confirmed.{points} Thank you!';
    var text = tpl.replace(/\{name\}/g, first).replace(/\{order\}/g, orderNo || '').replace(/\{restaurant\}/g, restaurant).replace(/\{points\}/g, pts);
    bnxSendText_(mobile, text, 'ORDER', P.getProperty('MSG91_ORDER_TEMPLATE_ID'),
                 { name: first, restaurant: restaurant, order: orderNo || '', points: pts.trim() });
  } catch (e) { Logger.log('bnxSendOrderMsg_ ' + e.message); }
}

/* ───────────── run once from the editor to authorise + test ───────────── */
function bnxCrmTest() {
  Logger.log(JSON.stringify(bnxCustomerCheckin_({ mobileNo: '9999999999', customerName: 'Test Guest', welcomeSms: true,
    requestId: 'test-' + Date.now(), tableId: '1', scanKey: 'qr-test' })));
}
