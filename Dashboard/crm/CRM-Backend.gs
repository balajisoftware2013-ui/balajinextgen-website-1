/**
 * Balaji NextGen CRM - Google Apps Script backend
 *
 * Master database      : CRM_CUSTOMERS
 * Transaction database : CRM_LEADS, CRM_ENQUIRIES, CRM_QUOTATIONS,
 *                        CRM_SALES_ORDERS, CRM_FOLLOWUPS, CRM_TICKETS
 *
 * SETUP
 * 1. Create two Google Sheets (master and transaction). Copy each sheet ID from its URL.
 * 2. Open script.google.com, create a project, paste this file as Code.gs.
 * 3. Project settings > Script properties > add:
 *      CRM_API_KEY     a long random secret (required)
 *      MASTER_DB_ID    master sheet ID
 *      TXN_DB_ID       transaction sheet ID
 *      DRIVE_FOLDER_ID client documents folder ID (optional)
 * 4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 * 5. Copy the /exec URL and the API key into the CRM page, Databases and Drive tab.
 * Tabs and header rows are created automatically on first load.
 */
const TABLES = {
  customers: {db: 'master', tab: 'CRM_CUSTOMERS',    key: 'CUSTOMER_CODE', prefix: 'CX-'},
  leads:     {db: 'txn',    tab: 'CRM_LEADS',        key: 'LEAD_CODE',     prefix: 'LD-'},
  enq:       {db: 'txn',    tab: 'CRM_ENQUIRIES',    key: 'ENQ_NO',        prefix: 'ENQ-'},
  quotes:    {db: 'txn',    tab: 'CRM_QUOTATIONS',   key: 'QT_NO',         prefix: 'QT-'},
  orders:    {db: 'txn',    tab: 'CRM_SALES_ORDERS', key: 'SO_NO',         prefix: 'SO-'},
  followups: {db: 'txn',    tab: 'CRM_FOLLOWUPS',    key: 'REFERENCE_NO',  prefix: 'FU-'},
  tickets:   {db: 'txn',    tab: 'CRM_TICKETS',      key: 'TICKET_NO',     prefix: 'TKT-'}
};

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return out_({ok: true, service: 'Balaji NextGen CRM API'}); }

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    const key = prop_('CRM_API_KEY');
    if (!key) return out_({ok: false, error: 'Set CRM_API_KEY in Script properties first'});
    if (p.apiKey !== key) return out_({ok: false, error: 'Invalid API key'});
    const ids = {master: prop_('MASTER_DB_ID') || p.masterId, txn: prop_('TXN_DB_ID') || p.txnId};
    switch (p.action) {
      case 'ping':   return out_(ping_(ids));
      case 'load':   return out_(load_(ids));
      case 'save':   return out_(save_(ids, p));
      case 'delete': return out_(delete_(ids, p));
      case 'files':  return out_(files_(p));
      default:       return out_({ok: false, error: 'Unknown action'});
    }
  } catch (err) {
    return out_({ok: false, error: String(err.message || err)});
  }
}

function book_(ids, db) {
  const id = ids[db];
  if (!id) throw new Error((db === 'master' ? 'Master' : 'Transaction') + ' database sheet ID is missing');
  return SpreadsheetApp.openById(id);
}
function sheet_(ids, t) {
  const ss = book_(ids, t.db);
  return ss.getSheetByName(t.tab) || ss.insertSheet(t.tab);
}
function headers_(sh) {
  const c = sh.getLastColumn();
  return c ? sh.getRange(1, 1, 1, c).getValues()[0].map(String).filter(String) : [];
}
function read_(sh) {
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2 || !lastCol) return [];
  const v = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const head = v[0].map(String), tz = Session.getScriptTimeZone();
  return v.slice(1).filter(function (r) { return r.some(function (c) { return c !== ''; }); }).map(function (r) {
    const o = {};
    head.forEach(function (h, i) {
      if (!h) return;
      let c = r[i];
      if (c instanceof Date) c = Utilities.formatDate(c, tz, 'yyyy-MM-dd');
      o[h] = c;
    });
    return o;
  });
}

function ping_(ids) {
  const r = {ok: true};
  ['master', 'txn'].forEach(function (db) {
    try { book_(ids, db); r[db] = 'OK'; } catch (e) { r[db] = String(e.message || e); }
  });
  return r;
}

function load_(ids) {
  const data = {};
  Object.keys(TABLES).forEach(function (k) { data[k] = read_(sheet_(ids, TABLES[k])); });
  return {ok: true, data: data};
}

function save_(ids, p) {
  const t = TABLES[p.table];
  if (!t) throw new Error('Unknown table');
  const row = p.row || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_(ids, t);
    let head = headers_(sh);
    if (!head.length) { head = Object.keys(row).filter(function (k) { return k !== t.key; }); head.unshift(t.key); }
    Object.keys(row).forEach(function (k) { if (head.indexOf(k) < 0) head.push(k); });
    if (head.indexOf(t.key) < 0) head.push(t.key);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);

    const keyIdx = head.indexOf(t.key), last = sh.getLastRow();
    const keys = last > 1 ? sh.getRange(2, keyIdx + 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    let rowNo;
    if (p.isNew) {
      let max = 0;
      keys.forEach(function (k) { const n = parseInt(String(k).replace(/\D/g, ''), 10); if (n > max) max = n; });
      row[t.key] = t.prefix + ('000' + (max + 1)).slice(-3);
      rowNo = last + 1;
    } else {
      const i = keys.indexOf(String(row[t.key]));
      if (i < 0) throw new Error('Record ' + row[t.key] + ' was not found');
      rowNo = i + 2;
    }
    const vals = head.map(function (h) {
      let v = row[h];
      if (v === undefined || v === null) v = '';
      if (typeof v === 'string' && /^[=+\-@]/.test(v)) v = "'" + v;
      return v;
    });
    sh.getRange(rowNo, 1, 1, head.length).setValues([vals]);
    SpreadsheetApp.flush();
    return {ok: true, row: row};
  } finally {
    lock.releaseLock();
  }
}

function delete_(ids, p) {
  const t = TABLES[p.table];
  if (!t) throw new Error('Unknown table');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_(ids, t), head = headers_(sh), keyIdx = head.indexOf(t.key), last = sh.getLastRow();
    if (keyIdx < 0 || last < 2) throw new Error('Record not found');
    const keys = sh.getRange(2, keyIdx + 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); });
    const i = keys.indexOf(String(p.key));
    if (i < 0) throw new Error('Record ' + p.key + ' was not found');
    sh.deleteRow(i + 2);
    return {ok: true};
  } finally {
    lock.releaseLock();
  }
}

function files_(p) {
  const id = prop_('DRIVE_FOLDER_ID') || p.folderId;
  if (!id) return {ok: true, files: []};
  const it = DriveApp.getFolderById(id).getFiles(), res = [], tz = Session.getScriptTimeZone();
  while (it.hasNext() && res.length < 300) {
    const f = it.next();
    res.push({name: f.getName(), url: f.getUrl(), mime: f.getMimeType(), updated: Utilities.formatDate(f.getLastUpdated(), tz, 'yyyy-MM-dd'), size: f.getSize()});
  }
  res.sort(function (a, b) { return b.updated.localeCompare(a.updated); });
  return {ok: true, files: res};
}
