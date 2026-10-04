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
 *  3. bnxCrmRecordOrder_() — optional hook to keep total orders / spend per customer.
 *
 * INSTALL (3 steps)
 *  A) In your existing doPost(e), AFTER the sessionToken/clientId check and BEFORE the
 *     big switch(action), add:
 *         var crm = bnxCrmRoute_(action, req);   // req = the parsed JSON body
 *         if (crm) return ContentService.createTextOutput(JSON.stringify(crm))
 *                          .setMimeType(ContentService.MimeType.JSON);
 *  B) Project Settings > Script properties — add (see CONFIG below).
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
 *  CRM_SHEET_ID      optional — spreadsheet id of the client DB (default: this script's spreadsheet)
 *  WELCOME_TEXT      optional template, e.g. "Hi {name}, welcome to {restaurant}! Enjoy your meal."
 *
 *  INDIA NOTE: promotional/transactional SMS must use a DLT-registered template. The text
 *  you register must match WELCOME_TEXT exactly (with {name} and {restaurant} as variables).
 */

var CRM_SHEET = 'CUSTOMER_MASTER';
var CRM_LOG   = 'WELCOME_LOG';
var CRM_HEAD  = ['MOBILE','NAME','FIRST_VISIT','LAST_VISIT','VISIT_COUNT','POINTS','TOTAL_ORDERS','TOTAL_SPEND',
                 'WELCOME_SENT','OPT_IN','LAST_TABLE','SOURCE','LAST_SCAN_KEY','CLIENT_ID'];

/* ───────────── router ───────────── */
function bnxCrmRoute_(action, req) {
  if (action === 'CUSTOMER_CHECKIN') return bnxCustomerCheckin_(req);
  return null; // not ours — let the existing switch handle it
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
  return String(n || '').replace(/[^\p{L}\s.'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
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
    var out;

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
      if (newScan) { visits++; sh.getRange(row, bnxCrmCol_('VISIT_COUNT')).setValue(visits); }
      sh.getRange(row, bnxCrmCol_('LAST_VISIT')).setValue(now);
      if (req.tableId) sh.getRange(row, bnxCrmCol_('LAST_TABLE')).setValue(req.tableId);
      if (req.scanKey) sh.getRange(row, bnxCrmCol_('LAST_SCAN_KEY')).setValue(req.scanKey);
      if (req.notifyOptIn === false) sh.getRange(row, bnxCrmCol_('OPT_IN')).setValue('NO');
      var finalName = name || savedName;
      out = { success: true, isNewCustomer: !finalName, customerName: finalName,
              points: Number(cur[bnxCrmCol_('POINTS') - 1] || 0), visitCount: visits };
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
  var text = tpl.replace('{name}', name.split(' ')[0]).replace('{restaurant}', restaurant);
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
      else if (sms === 'MSG91') results.push(['SMS', msg91_(P, mobile, name.split(' ')[0], restaurant)]);
      else if (sms === 'TWILIO') results.push(['SMS', twilio_(P, '+91' + mobile, P.getProperty('TWILIO_FROM_SMS'), text)]);
    } catch (e) { results.push(['SMS', 'ERR ' + e.message]); }
  }
  var ok = results.some(function (x) { return String(x[1]).indexOf('ERR') !== 0; });
  try {
    bnxCrmSheet_(CRM_LOG, ['TIME', 'MOBILE', 'CHANNEL', 'RESULT', 'TEXT'])
      .appendRow([new Date(), mobile, results.map(function (x) { return x[0]; }).join('+') || 'NONE', JSON.stringify(results).slice(0, 300), text]);
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
function msg91_(P, mobile, name, restaurant) {
  var res = UrlFetchApp.fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'post', muteHttpExceptions: true, contentType: 'application/json',
    headers: { authkey: P.getProperty('MSG91_AUTHKEY') },
    payload: JSON.stringify({ template_id: P.getProperty('MSG91_TEMPLATE_ID'), sender: P.getProperty('MSG91_SENDER'),
      short_url: '0', recipients: [{ mobiles: '91' + mobile, name: name, restaurant: restaurant }] })
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

/* ───────────── optional: call from your SAVE_ORDER after a successful save ───────────── */
function bnxCrmRecordOrder_(mobile, billAmount, pointsEarned) {
  mobile = String(mobile || '').replace(/\D/g, '').slice(-10);
  if (mobile.length !== 10) return;
  var sh = bnxCrmSheet_(CRM_SHEET, CRM_HEAD), row = bnxCrmFind_(sh, mobile);
  if (!row) return;
  var add = function (col, v) { var c = sh.getRange(row, bnxCrmCol_(col)); c.setValue(Number(c.getValue() || 0) + Number(v || 0)); };
  add('TOTAL_ORDERS', 1); add('TOTAL_SPEND', billAmount); add('POINTS', pointsEarned);
}

/* ───────────── run once from the editor to authorise + test ───────────── */
function bnxCrmTest() {
  Logger.log(JSON.stringify(bnxCustomerCheckin_({ mobileNo: '9999999999', customerName: 'Test Guest', welcomeSms: true,
    requestId: 'test-' + Date.now(), tableId: '1', scanKey: 'qr-test' })));
}
