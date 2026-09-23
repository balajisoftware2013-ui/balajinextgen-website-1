/* ============================================================================
 * BALAJI NEXTGEN ERP — PASS #71 + #72 APPEND BLOCK
 * Paste at the VERY BOTTOM of Code.gs, REPLACING any earlier PASS #71 block.
 * ========================================================================== */

/* ============================================================================
 * PASS #71 — LIVE SPEED + REPORTS + DSR (Sep 2026)
 * ----------------------------------------------------------------------------
 * PASTE THIS BLOCK AT THE VERY BOTTOM OF Code.gs (after the last line).
 * Every function below with an existing name deliberately REPLACES the older
 * declaration above it (same file ⇒ last declaration wins, and it is hoisted,
 * so every caller above automatically uses the fixed version).
 * No top-level const/let is redeclared; all new globals use the BNX71_ prefix.
 *
 * ROOT CAUSES FIXED (confirmed against CL00010 TRANSACTION_DB / ERROR_LOG):
 *  1. SAVE_BILL failed on every discounted bill: "Bill ledger is not balanced
 *     DR 2361.75 / CR 2022.00". Sales was credited at TAXABLE (already net of
 *     discount) while the discount was debited again. BILL_MASTER/ITEMS/PAYMENT
 *     rows were already written, so the client retried and created duplicate
 *     bills (BIL03855 / BIL03856). Sales is now credited GROSS (taxable +
 *     discount), the journal is validated BEFORE anything is written, and a
 *     late ledger failure can no longer cause a duplicate bill.
 *  2. LEDGER_ENTRIES has no ACCOUNT/CLIENT_ID/ENTRY_DATE columns in the real
 *     template, so every ledger line lost its account (LEDGER_ID blank) and
 *     SALES_VS_LEDGER reconciliation always read 0. LEDGER_ID is now written.
 *  3. GET_SALES_DAY_BOOK_REPORT (and every report snapshot) failed with
 *     "not possible to delete all non-frozen rows" / "rows are out of bounds":
 *     snapshots were rewritten with one deleteRow() per row. Snapshots are now
 *     rewritten as one block (setValues + clearContent), never fatal, and
 *     skipped when nothing changed.
 *  4. 4490 of 4493 PAYMENT_MASTER rows are PAYMENT_STATUS='PAID', but
 *     reconciliation / payment balance / void reversal only accepted
 *     'SUCCESS'. Both are now treated as a live payment.
 *  5. 49% of BILL_ITEMS rows have no ITEM_ID but DO carry ITEM_GROUP_NAME
 *     (FOOD/LIQUOR/BEVERAGE/TOBACCO). Item/category/DSR splits ignored it and
 *     dumped those lines into "Uncategorized"/food. BILL_ITEMS' own group and
 *     category are now authoritative; new bills also write them.
 *  6. DSR: cancelled bills counted, Zomato/Swiggy payments dropped (mapped to
 *     ONLINE which DSR never read), gross used TAXABLE (excludes non-GST liquor),
 *     ROUND_OFF absorbed thousands of rupees on imported rows, and a FY view
 *     made one sequential server call per month. New GET_DSR_RANGE computes
 *     the whole range in one pass.
 *  7. {from,to} without range:'custom' silently returned TODAY (DSR cash book).
 *  8. Speed: every request re-read the central USER_MASTER to verify the
 *     session; each report re-read the same sheets many times; per-row
 *     Session.getScriptTimeZone()/formatDate; report cache TTL 15–30 s and
 *     values >100 KB were never cached. Now: session cache (120 s), per-request
 *     sheet read memo, fast row conversion, versioned+chunked report cache
 *     (any successful write invalidates instantly), closed-day check only on
 *     writes and cached.
 *  9. Missing actions the dashboard already calls: GET_KOTS, GET_REPRINT_REPORT,
 *     REPRINT_BILL, GET_ROLE_ACCESS, SAVE_ROLE_ACCESS, SETTLE_DUE_BILL.
 * 10. VOID_BILL helpers were declared INSIDE doPost's switch; now top-level.
 * 11. CLIENT_SETTINGS (exists in MASTER_DB) and PURCHASE_INVOICE_ITEMS /
 *     DEPARTMENT_ISSUE were not routable ⇒ branding + purchase invoice items
 *     always failed. Registered.
 * ========================================================================== */

/* ---------- routing registrations (mutating existing consts is safe) ---------- */
BNX_SHEET_DB_MAP_.CLIENT_SETTINGS = 'MASTER';
BNX_SHEET_DB_MAP_.DEPARTMENT_ISSUE = 'TRANSACTION';
BNX_SHEET_DB_MAP_.PURCHASE_INVOICE_ITEMS = 'TRANSACTION';
SHEETS.PURCHASE_INVOICE_ITEMS = 'PURCHASE_INVOICE_ITEMS';
SHEETS.CLIENT_SETTINGS = 'CLIENT_SETTINGS';
SHEETS.ITEM_GROUP_MASTER = SHEETS.ITEM_GROUP_MASTER || 'ITEM_GROUP_MASTER';
SHEETS.LOCATION_MASTER = SHEETS.LOCATION_MASTER || 'LOCATION_MASTER';

/* ---------- per-request context ---------- */
var BNX71_REQ_ = { clientId: '', readOnly: false, memo: {}, memoOk: true, ver: {} };
var BNX71_TZ_ = null;
var BNX71_DK_ = {};      // Date.getTime() -> 'yyyy-MM-dd'
var BNX71_TK_ = {};      // Date.getTime() -> 'HH:mm:ss'
var BNX71_HDR_ = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
var BNX71_OPEN_IDX_ = {};
var BNX71_INV_IDX_ = {};

function bnx71ResetReq_(clientId, readOnly) {
  BNX71_REQ_ = { clientId: String(clientId || ''), readOnly: !!readOnly, memo: {}, memoOk: true, ver: {} };
  BNX71_OPEN_IDX_ = {};
  BNX71_INV_IDX_ = {};
}
function bnx71Tz_() { return BNX71_TZ_ || (BNX71_TZ_ = (Session.getScriptTimeZone() || 'Asia/Kolkata')); }
function bnx71Num_(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function bnx71R2_(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function bnx71Hash_(s) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(s), Utilities.Charset.UTF_8);
  let out = '';
  for (let i = 0; i < b.length; i++) { const x = (b[i] + 256) % 256; out += (x < 16 ? '0' : '') + x.toString(16); }
  return out;
}
function bnx71Idx_(headers) {
  const m = {};
  for (let i = 0; i < headers.length; i++) { const k = String(headers[i] == null ? '' : headers[i]).trim(); if (k && m[k] === undefined) m[k] = i; }
  return m;
}
function bnx71IsReadAction_(a) {
  a = String(a || '');
  if (/^(GET_|LIST_)/.test(a)) return a !== 'GET_KOT_NUMBER_BATCH';
  return ['RD_FETCH_SHEET', 'HEARTBEAT', 'REFRESH_ALL_REPORTS', 'CHECK_CLIENT_DATABASE', 'RECALC_INVENTORY_TOTALS'].indexOf(a) >= 0;
}
function bnx71PaymentActive_(status) {
  const s = String(status == null ? '' : status).trim().toUpperCase();
  return s === '' || s === 'SUCCESS' || s === 'PAID' || s === 'COMPLETED' || s === 'SETTLED' || s === 'POSTED';
}

/* ---------- fast date / row conversion (replaces per-row Session calls) ---------- */
function bnx71DateKeyOf_(d) {
  const t = d.getTime();
  if (isNaN(t)) return '';
  let k = BNX71_DK_[t];
  if (k === undefined) { k = Utilities.formatDate(d, bnx71Tz_(), 'yyyy-MM-dd'); BNX71_DK_[t] = k; }
  return k;
}
function bnx71TimeKeyOf_(d) {
  const t = d.getTime();
  if (isNaN(t)) return '';
  let k = BNX71_TK_[t];
  if (k === undefined) { k = Utilities.formatDate(d, bnx71Tz_(), 'HH:mm:ss'); BNX71_TK_[t] = k; }
  return k;
}
function bnxNormalizeDateKey_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return bnx71DateKeyOf_(value);
  const s = String(value).trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[ T].*)?$/);
  if (m) return m[1] + '-' + ('0' + Number(m[2])).slice(-2) + '-' + ('0' + Number(m[3])).slice(-2);
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:[ T].*)?$/);
  if (m) return m[3] + '-' + ('0' + Number(m[2])).slice(-2) + '-' + ('0' + Number(m[1])).slice(-2);
  return s;
}
function bnxDateKeySafe_(value) {
  if (value instanceof Date) return bnx71DateKeyOf_(value);
  const s = String(value == null ? '' : value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(s)) { const p = s.split(/[-/]/); return p[2] + '-' + p[1] + '-' + p[0]; }
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : bnx71DateKeyOf_(d);
}
function bnxDayKey_(value) {
  if (value instanceof Date) return bnx71DateKeyOf_(value);
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return bnx71DateKeyOf_(d);
  return raw.slice(0, 10);
}
function bnx71HeaderMeta_(headers) {
  let m = BNX71_HDR_ ? BNX71_HDR_.get(headers) : null;
  if (m && m.length === headers.length) return m;
  m = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i], s = String(h);
    m.push({ k: h, d: (s === 'DATE' || /DATE$/.test(s)), t: (s === 'TIME' || /_TIME$/.test(s)) });
  }
  if (BNX71_HDR_) { try { BNX71_HDR_.set(headers, m); } catch (e) {} }
  return m;
}
function bnxRowToObject(row, headers) {
  const meta = bnx71HeaderMeta_(headers);
  const obj = {};
  for (let i = 0; i < meta.length; i++) {
    const mm = meta[i];
    let val = row[i];
    if (mm.d) val = bnxNormalizeDateKey_(val);
    else if (val instanceof Date) val = mm.t ? bnx71TimeKeyOf_(val) : val.toISOString();
    obj[mm.k] = (val === null || val === undefined) ? '' : val;
  }
  return obj;
}

/* ---------- per-request sheet read memo (write-coherent via Proxy) ---------- */
var BNX71_MEMO_SHEETS_ = {
  BILL_MASTER: 1, BILL_ITEMS: 1, PAYMENT_MASTER: 1, ORDER_MASTER: 1, ORDER_ITEMS: 1, KOT_MASTER: 1, KOT_ITEMS: 1,
  ITEM_MASTER: 1, CATEGORY_MASTER: 1, ITEM_GROUP_MASTER: 1, TAX_MASTER: 1, UNIT_MASTER: 1, UNIT_CONVERSION_MASTER: 1,
  STOCK_MOVEMENT: 1, STOCK_BALANCE: 1, DUES_RECEIPT: 1, CUSTOMER_DUES: 1, CUSTOMER_MASTER: 1, SUPPLIER_MASTER: 1,
  SUPPLIER_DUES: 1, PURCHASE_MASTER: 1, PURCHASE_PAYMENT: 1, PURCHASE_RETURN: 1, PURCHASE_ORDER: 1,
  GOODS_RECEIPT_NOTE: 1, JOURNAL: 1, LEDGER_ENTRIES: 1, USER_MASTER: 1, TABLE_MASTER: 1, RAW_MATERIAL_MASTER: 1,
  WASTAGE_MASTER: 1, ONLINE_ORDER_MASTER: 1, AGGREGATOR_SETTLEMENT: 1, PETTY_CASH_MASTER: 1, PETTY_CASH: 1,
  CASH_MOVEMENT: 1, CASH_CONTROL: 1, BAR_ITEM_MASTER: 1, MENU_CARD_ITEMS: 1, BAR_MENU_CARD: 1, LOCATION_MASTER: 1,
  AUDIT_LOG: 1, KITCHEN_INDENT: 1, KITCHEN_CONSUMPTION: 1, RECIPE_MASTER: 1, RECIPE_ITEMS: 1
};
function bnx71MemoKey_(clientId, sheetName) { return String(clientId) + '|' + String(sheetName); }
function bnx71MemoDrop_(clientId, sheetName) { try { delete BNX71_REQ_.memo[bnx71MemoKey_(clientId, sheetName)]; } catch (e) {} }
function bnx71WrapRange_(range, onWrite) {
  return new Proxy(range, {
    get: function (t, p) {
      const v = t[p];
      if (typeof v !== 'function') return v;
      const name = String(p);
      if (/^(set|clear|delete|insert|sort|copyTo|moveTo|merge|remove|trim|randomize|autoFill)/.test(name)) {
        return function () { onWrite(); return v.apply(t, arguments); };
      }
      return v.bind(t);
    }
  });
}
function bnx71WrapSheet_(sheet, clientId, sheetName) {
  const key = bnx71MemoKey_(clientId, sheetName);
  const drop = function () { delete BNX71_REQ_.memo[key]; };
  const p = new Proxy(sheet, {
    get: function (t, prop) {
      if (prop === '__bnxReal') return t;
      if (prop === 'getDataRange') {
        return function () {
          const real = t.getDataRange();
          return new Proxy(real, {
            get: function (rt, rp) {
              if (rp === 'getValues') {
                return function () {
                  const hit = BNX71_REQ_.memo[key];
                  if (hit) return hit;
                  const vals = rt.getValues();
                  BNX71_REQ_.memo[key] = vals;
                  return vals;
                };
              }
              const v = rt[rp];
              if (typeof v !== 'function') return v;
              if (/^(set|clear|delete|insert|sort|copyTo|moveTo|merge|remove|trim|randomize)/.test(String(rp))) {
                return function () { drop(); return v.apply(rt, arguments); };
              }
              return v.bind(rt);
            }
          });
        };
      }
      const v = t[prop];
      if (typeof v !== 'function') return v;
      const name = String(prop);
      if (name === 'getRange' || name === 'getRangeList') {
        return function () { return bnx71WrapRange_(v.apply(t, arguments), drop); };
      }
      if (/^(append|delete|insert|clear|sort|setFrozen|hide|show|copyTo|autoResize|setName)/.test(name)) {
        return function () { drop(); return v.apply(t, arguments); };
      }
      return v.bind(t);
    }
  });
  return p;
}
function bnx71MaybeMemo_(sheet, clientId, sheetName) {
  if (!BNX71_REQ_.memoOk || !BNX71_MEMO_SHEETS_[sheetName] || typeof Proxy === 'undefined') return sheet;
  if (String(BNX71_REQ_.clientId || '') !== String(clientId || '')) return sheet;
  try {
    const w = bnx71WrapSheet_(sheet, clientId, sheetName);
    if (!BNX71_REQ_.memoTested) {
      BNX71_REQ_.memoTested = true;
      if (w.getName() !== sheet.getName()) throw new Error('memo self-test mismatch');
    }
    return w;
  } catch (e) {
    BNX71_REQ_.memoOk = false;
    console.warn('[BNX71] read memo disabled: ' + e.message);
    return sheet;
  }
}

/* REPLACES bnxClientSheet: identical routing, plus the write-coherent memo. */
function bnxClientSheet(clientId, sheetName) {
  if (!clientId) throw new Error('bnxClientSheet: clientId required');
  if (!sheetName) throw new Error('bnxClientSheet: sheetName required');
  const canonicalName = String(sheetName) === 'VENDOR_MASTER' ? 'SUPPLIER_MASTER' : String(sheetName);
  const dbKey = BNX_SHEET_DB_MAP_[canonicalName];
  if (!dbKey) throw new Error('bnxClientSheet: sheet "' + canonicalName + '" is not registered in the MASTER/TRANSACTION/REPORT routing map.');
  const dbIds = bnxGetClientDbIds_(clientId);
  const dbId = dbIds[dbKey];
  if (!dbId) throw new Error('bnxClientSheet: client ' + clientId + ' has no ' + dbKey + '_DB_ID in ' + CLIENT_DB_REGISTRY_TAB + '.');
  let ss;
  try { ss = bnxOpenSpreadsheetCached_(dbId); }
  catch (openErr) {
    try { CacheService.getScriptCache().remove('clientdbids_v5_' + clientId); } catch (ignore) {}
    throw new Error('Client database connection failed for ' + clientId + ' (' + dbKey + '_DB_ID=' + dbId + '): ' + openErr.message);
  }
  let sheet = ss.getSheetByName(canonicalName);
  if (!sheet) sheet = bnxEnsureMissingSheetFromTemplate_(clientId, dbKey, canonicalName);
  if (dbKey === 'REPORT') return sheet;
  return bnx71MaybeMemo_(sheet, clientId, canonicalName);
}

/* ---------- chunked, versioned report cache ---------- */
function bnx71CachePutBig_(key, str, ttl) {
  const cache = CacheService.getScriptCache();
  const CH = 80000;
  try {
    if (str.length <= CH) { cache.put(key, 'S' + str, ttl); return true; }
    const n = Math.ceil(str.length / CH);
    if (n > 20) return false;
    const obj = {};
    for (let i = 0; i < n; i++) obj[key + '_' + i] = str.substr(i * CH, CH);
    obj[key] = 'C' + n;
    cache.putAll(obj, ttl);
    return true;
  } catch (e) { return false; }
}
function bnx71CacheGetBig_(key) {
  const cache = CacheService.getScriptCache();
  try {
    const head = cache.get(key);
    if (!head) return null;
    if (head.charAt(0) === 'S') return head.slice(1);
    if (head.charAt(0) !== 'C') return null;
    const n = Number(head.slice(1)) || 0, keys = [];
    for (let i = 0; i < n; i++) keys.push(key + '_' + i);
    const parts = cache.getAll(keys);
    let out = '';
    for (let i = 0; i < n; i++) { const p = parts[key + '_' + i]; if (p == null) return null; out += p; }
    return out;
  } catch (e) { return null; }
}
function bnx71ReportVersion_(clientId) {
  const cid = String(clientId || BNX71_REQ_.clientId || '');
  if (!cid) return '0';
  if (BNX71_REQ_.ver[cid]) return BNX71_REQ_.ver[cid];
  let v = null;
  try { v = CacheService.getScriptCache().get('rptver71_' + cid); } catch (e) {}
  if (!v) {
    v = String(Date.now());
    try { CacheService.getScriptCache().put('rptver71_' + cid, v, 21600); } catch (e) {}
  }
  BNX71_REQ_.ver[cid] = v;
  return v;
}
function bnx71BumpReportVersion_(clientId) {
  const cid = String(clientId || BNX71_REQ_.clientId || '');
  if (!cid) return;
  const v = String(Date.now()) + Math.floor(Math.random() * 1000);
  try { CacheService.getScriptCache().put('rptver71_' + cid, v, 21600); } catch (e) {}
  BNX71_REQ_.ver[cid] = v;
}
/* REPLACES bnxCachedReport_: version-keyed (any write invalidates), >100 KB safe. */
function bnxCachedReport_(cacheKey, ttlSeconds, computeFn) {
  const key = 'rc71_' + bnx71Hash_(String(cacheKey) + '|v' + bnx71ReportVersion_(BNX71_REQ_.clientId));
  const hit = bnx71CacheGetBig_(key);
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  const result = computeFn();
  if (result && result.success) { try { bnx71CachePutBig_(key, JSON.stringify(result), Math.max(Number(ttlSeconds) || 0, 120)); } catch (e) {} }
  return result;
}
function bnxInvalidateTodayReportCaches_(clientId) { bnx71BumpReportVersion_(clientId); }
function bnxInvalidateMasterCache_(clientId) {
  try {
    CacheService.getScriptCache().removeAll(['catmap_' + clientId, 'taxmap_' + clientId, 'unitmap_' + clientId, 'itemnamemap_' + clientId,
      'itemcostmap_' + clientId, 'itemgroupmap_' + clientId, 'posmenu_' + clientId, 'posmenu_v2_' + clientId, 'bootstrap_v2_' + clientId, 'itemmeta71_' + clientId]);
  } catch (e) {}
  bnx71BumpReportVersion_(clientId);
}

/* ---------- append helpers: memo coherence + LEDGER_ENTRIES schema fix ---------- */
function bnx71FixLedgerRow_(sheetName, o) {
  if (String(sheetName) !== 'LEDGER_ENTRIES' || !o) return o;
  if (!o.LEDGER_ID && o.ACCOUNT) o.LEDGER_ID = o.ACCOUNT;
  if (!o.DESCRIPTION) o.DESCRIPTION = [o.REFERENCE_TYPE || '', o.REFERENCE_ID || ''].join(' ').trim();
  return o;
}
function bnxAppendRowIndexed_(clientId, sheetName, rowObject) {
  const sheet = bnxClientSheet(clientId, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const o = bnx71FixLedgerRow_(sheetName, rowObject || {});
  const row = headers.map(function (h) { const v = o[h]; return (v === undefined || v === null) ? '' : v; });
  sheet.appendRow(row);
  bnx71MemoDrop_(clientId, sheetName);
  return sheet.getLastRow() - 1;
}
function bnxAppendRowsBatch_(clientId, sheetName, rowObjects) {
  if (!rowObjects || !rowObjects.length) return;
  const sheet = bnxClientSheet(clientId, sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows = rowObjects.map(function (ro) {
    const o = bnx71FixLedgerRow_(sheetName, ro || {});
    return headers.map(function (h) { const v = o[h]; return (v === undefined || v === null) ? '' : v; });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  bnx71MemoDrop_(clientId, sheetName);
}

/* ---------- report snapshot writes: block rewrite, never deleteRow, never fatal ---------- */
function bnx71RewriteReport_(clientId, sheetName, keepFn, rows) {
  try {
    const snapKey = 'snap71_' + bnx71Hash_(clientId + '|' + sheetName + '|' + JSON.stringify(rows || []).length + '|' + bnx71Hash_(JSON.stringify(rows || [])));
    try { if (CacheService.getScriptCache().get(snapKey)) return true; } catch (e) {}
    const sheet = bnxClientSheet(clientId, sheetName);
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    if (!headers.length) return false;
    const keep = [];
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (!row.some(function (v) { return v !== '' && v !== null; })) continue;
      if (keepFn(row, headers)) keep.push(row);
    }
    const out = keep.concat((rows || []).map(function (o) { return headers.map(function (h) { return o[h] === undefined || o[h] === null ? '' : o[h]; }); }));
    const oldN = Math.max(0, values.length - 1);
    if (out.length) sheet.getRange(2, 1, out.length, headers.length).setValues(out);
    if (oldN > out.length) sheet.getRange(2 + out.length, 1, oldN - out.length, headers.length).clearContent();
    try { CacheService.getScriptCache().put(snapKey, '1', 300); } catch (e) {}
    return true;
  } catch (e) {
    console.warn('[BNX71 snapshot] ' + sheetName + ': ' + e.message);
    return false;
  }
}
function bnxReplaceReportByFields_(clientId, sheetName, matchObj, rows) {
  const keys = Object.keys(matchObj || {});
  bnx71RewriteReport_(clientId, sheetName, function (row, headers) {
    const ci = headers.indexOf('CLIENT_ID');
    if (ci !== -1 && String(row[ci]) !== String(clientId)) return true;
    for (let i = 0; i < keys.length; i++) {
      const c = headers.indexOf(keys[i]);
      if (c === -1) continue;
      let v = row[c];
      if (v instanceof Date) v = bnx71DateKeyOf_(v);
      if (String(v) !== String(matchObj[keys[i]])) return true;
    }
    return false;
  }, rows);
}
function bnxReplaceReportRange_(clientId, sheetName, dateField, from, to, rows) {
  bnx71RewriteReport_(clientId, sheetName, function (row, headers) {
    const ci = headers.indexOf('CLIENT_ID'), dc = headers.indexOf(dateField);
    if (ci !== -1 && String(row[ci]) !== String(clientId)) return true;
    let d = dc === -1 ? '' : row[dc];
    d = d instanceof Date ? bnx71DateKeyOf_(d) : bnxNormalizeDateKey_(d);
    return !(d >= from && d <= to);
  }, rows);
}
function bnxUpsertReportRegistry_(clientId, reportName, category, sourceDb, sourceTables) {
  try {
    const k = 'rreg71_' + clientId + '_' + reportName;
    if (CacheService.getScriptCache().get(k)) return;
    const sheet = bnxClientSheet(clientId, 'REPORT_REGISTRY');
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const ciCol = headers.indexOf('CLIENT_ID'), nameCol = headers.indexOf('REPORT_NAME'), lastCol = headers.indexOf('LAST_REFRESHED_AT');
    const nowIso = new Date().toISOString();
    let done = false;
    for (let r = 1; r < values.length; r++) {
      if (values[r][ciCol] === clientId && values[r][nameCol] === reportName) {
        if (lastCol !== -1) sheet.getRange(r + 1, lastCol + 1).setValue(nowIso);
        done = true; break;
      }
    }
    if (!done) bnxAppendRow(clientId, 'REPORT_REGISTRY', { REPORT_ID: generateShortId_(clientId, 'REPORT_ID'), CLIENT_ID: clientId, REPORT_NAME: reportName, REPORT_CATEGORY: category, SOURCE_DB: sourceDb, SOURCE_TABLES: sourceTables, REFRESH_FREQUENCY: 'ON_DEMAND', IS_ACTIVE: true, LAST_REFRESHED_AT: nowIso });
    CacheService.getScriptCache().put(k, '1', 600);
  } catch (e) { console.warn('[bnxUpsertReportRegistry_] ' + e.message); }
}

/* ---------- date range: {from,to} without range now means custom ---------- */
function bnxResolveDateRange_(payload) {
  payload = payload || {};
  const tz = bnx71Tz_();
  const toISO = function (d) { return Utilities.formatDate(d, tz, 'yyyy-MM-dd'); };
  const businessToday = bnxBusinessDateKey_(new Date());
  const clamp = function (k) { return k > businessToday ? businessToday : k; };
  const range = payload.range || '';
  const f = String(payload.from || payload.FROM_DATE || payload.fromDate || '').slice(0, 10);
  const t = String(payload.to || payload.TO_DATE || payload.toDate || '').slice(0, 10);
  const isD = function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x); };
  if ((range === '' || range === 'custom') && isD(f) && isD(t)) return f <= t ? { from: f, to: t } : { from: t, to: f };
  if (range === 'yesterday') { const y = bnxBusinessDateOffset_(businessToday, -1); return { from: y, to: y }; }
  if (range === 'week') {
    let monday;
    if (payload.weekStart && /^\d{4}-W\d{2}$/.test(payload.weekStart)) {
      const mm = payload.weekStart.match(/^(\d{4})-W(\d{2})$/);
      const jan4 = new Date(Number(mm[1]), 0, 4), jan4Dow = (jan4.getDay() + 6) % 7;
      monday = new Date(jan4); monday.setDate(jan4.getDate() - jan4Dow + (Number(mm[2]) - 1) * 7);
    } else {
      const p = businessToday.split('-').map(Number), bd = new Date(p[0], p[1] - 1, p[2]);
      monday = new Date(bd); monday.setDate(bd.getDate() - ((bd.getDay() + 6) % 7));
    }
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return { from: toISO(monday), to: clamp(toISO(sunday)) };
  }
  if (range === 'month') {
    const p = businessToday.split('-').map(Number);
    let y = p[0], m = p[1] - 1;
    if (payload.month && /^\d{4}-\d{2}$/.test(payload.month)) { y = Number(payload.month.slice(0, 4)); m = Number(payload.month.slice(5, 7)) - 1; }
    return { from: toISO(new Date(y, m, 1)), to: clamp(toISO(new Date(y, m + 1, 0))) };
  }
  if (range === 'quarter') {
    let fyStartYear, qIndex;
    if (payload.quarter && payload.fyYear) { qIndex = Math.max(0, Math.min(3, Number(payload.quarter) - 1)); fyStartYear = Number(payload.fyYear); }
    else { const p = businessToday.split('-').map(Number), m = p[1] - 1; fyStartYear = m >= 3 ? p[0] : p[0] - 1; qIndex = Math.floor(((m - 3 + 12) % 12) / 3); }
    const startMonth = 3 + qIndex * 3;
    const start = new Date(startMonth >= 12 ? fyStartYear + 1 : fyStartYear, startMonth % 12, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
    return { from: toISO(start), to: clamp(toISO(end)) };
  }
  if (range === 'year') {
    const p = businessToday.split('-').map(Number);
    const fy = payload.fyYear ? Number(payload.fyYear) : (p[1] >= 4 ? p[0] : p[0] - 1);
    return { from: toISO(new Date(fy, 3, 1)), to: clamp(toISO(new Date(fy + 1, 2, 31))) };
  }
  return { from: businessToday, to: businessToday };
}

/* ---------- session: cached 120 s (was: full central USER_MASTER read per request) ---------- */
function bnxVerifySession(sessionToken, clientId) {
  const token = String(sessionToken || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return null;
  const key = 'sess71_' + bnx71Hash_(token + '|' + String(clientId || '').trim());
  try {
    const hit = CacheService.getScriptCache().get(key);
    if (hit) { const s = JSON.parse(hit); s.timestamp = Date.now(); s.cachedSession = true; return s; }
  } catch (e) {}
  const s = bnx71VerifySessionUncached_(token, clientId);
  if (s) { try { CacheService.getScriptCache().put(key, JSON.stringify(s), 120); } catch (e) {} }
  return s;
}
function bnx71VerifySessionUncached_(token, clientId) {
  const requestedClient = String(clientId || '').trim();
  try {
    const ss = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID);
    const sh = ss.getSheetByName('USER_MASTER');
    if (!sh) return null;
    const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow < 1 || lastCol < 1) return null;
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim().toUpperCase(); });
    const idx = function () { for (let i = 0; i < arguments.length; i++) { const p = headers.indexOf(String(arguments[i]).toUpperCase()); if (p >= 0) return p; } return -1; };
    const sessionCol = idx('SESSION', 'SESSION_TOKEN', 'ERP_SESSION'), clientCol = idx('CLIENT_ID'), userCol = idx('USER_ID', 'EMP_ID'),
      roleCol = idx('ROLE', 'USER_ROLE'), nameCol = idx('FULL_NAME', 'NAME'), statusCol = idx('STATUS'), webCol = idx('WEB_ACCESS');
    if (clientCol < 0) return null;
    if (sessionCol >= 0) {
      /* TextFinder on the session column + read only the matching row(s):
         the old code pulled the whole central USER_MASTER on every request. */
      const rows = [];
      if (lastRow >= 2) {
        const hits = sh.getRange(2, sessionCol + 1, lastRow - 1, 1).createTextFinder(token).matchEntireCell(true).findAll();
        for (let i = 0; i < hits.length && i < 5; i++) rows.push(sh.getRange(hits[i].getRow(), 1, 1, lastCol).getValues()[0]);
      }
      for (let k = 0; k < rows.length; k++) {
        const row = rows[k];
        if (String(row[sessionCol] || '').trim() !== token) continue;
        const rowClient = String(row[clientCol] || '').trim();
        if (!rowClient) return null;
        const status = statusCol >= 0 ? String(row[statusCol] || 'ACTIVE').trim().toUpperCase() : 'ACTIVE';
        if (status && ['ACTIVE', 'YES', 'ENABLED'].indexOf(status) < 0) return null;
        const web = webCol >= 0 ? String(row[webCol] || 'YES').trim().toUpperCase() : 'YES';
        if (['NO', 'FALSE', 'BLOCKED', 'DISABLED'].indexOf(web) >= 0) return null;
        const role = roleCol >= 0 ? String(row[roleCol] || 'STAFF').trim().toUpperCase() : 'STAFF';
        const isGlobalAdmin = role === 'SUPER_ADMIN' || role === 'DEVELOPER';
        if (requestedClient && requestedClient !== rowClient && !isGlobalAdmin) return null;
        let effectiveClient = rowClient;
        if (isGlobalAdmin && requestedClient && requestedClient !== rowClient) {
          if (!bnxGetClientRegistryRow_(requestedClient)) throw new Error('Target client ' + requestedClient + ' is not registered');
          effectiveClient = requestedClient;
        }
        let dbIds;
        try { dbIds = bnxGetClientDbIds_(effectiveClient); }
        catch (routeErr) { dbIds = bnxEnsureClientDatabasesProvisioned_(effectiveClient).databases; }
        try { bnxEnsureClientSchema_(effectiveClient); } catch (schemaErr) { console.error('[TENANT AUTO-REPAIR] ' + effectiveClient + ': ' + schemaErr.message); }
        return { CLIENT_ID: effectiveClient, AUTH_CLIENT_ID: rowClient, USER_ID: userCol >= 0 ? String(row[userCol] || '').trim() : '',
          ROLE: role, FULL_NAME: nameCol >= 0 ? String(row[nameCol] || '').trim() : '', IS_GLOBAL_ADMIN: isGlobalAdmin, DB_IDS: dbIds, timestamp: Date.now() };
      }
      return null;
    }
    if (!requestedClient) return null;
    let dbIds;
    try { dbIds = bnxGetClientDbIds_(requestedClient); } catch (routeErr) { dbIds = bnxEnsureClientDatabasesProvisioned_(requestedClient).databases; }
    try { bnxEnsureClientSchema_(requestedClient); } catch (schemaErr) { console.error('[TENANT AUTO-REPAIR] ' + requestedClient + ': ' + schemaErr.message); }
    return { CLIENT_ID: requestedClient, USER_ID: token, ROLE: 'STAFF', IS_GLOBAL_ADMIN: false, DB_IDS: dbIds, timestamp: Date.now() };
  } catch (error) {
    console.error('[AUTH] Session validation failed:', error.message);
    return null;
  }
}

/* ---------- closed business day: cached set, checked only for writes ---------- */
function bnx71ClosedDates_(clientId) {
  const key = 'dayclosed71_' + clientId;
  try { const hit = CacheService.getScriptCache().get(key); if (hit) return JSON.parse(hit); } catch (e) {}
  const out = {};
  try {
    const sh = bnxClientSheet(clientId, SHEETS.DAY_STATUS);
    const v = sh.getDataRange().getValues(), h = v[0] || [];
    const ci = h.indexOf('CLIENT_ID'), di = h.indexOf('BUSINESS_DATE'), si = h.indexOf('STATUS');
    for (let r = 1; r < v.length; r++) {
      if (ci >= 0 && v[r][ci] && String(v[r][ci]) !== String(clientId)) continue;
      if (String(v[r][si] || '').toUpperCase() === 'CLOSED') out[bnxDayKey_(v[r][di])] = 1;
    }
  } catch (e) { return {}; }
  try { CacheService.getScriptCache().put(key, JSON.stringify(out), 120); } catch (e) {}
  return out;
}
function bnxIsBusinessDateClosed_(clientId, businessDate) {
  const k = bnxDayKey_(businessDate);
  if (!k) return false;
  return !!bnx71ClosedDates_(clientId)[k];
}
function bnx71ClearDayCache_(clientId) { try { CacheService.getScriptCache().remove('dayclosed71_' + clientId); } catch (e) {} }

/* ---------- ROUTER (replaces doPost; VOID helpers are now top-level) ---------- */
var BNX71_DAYLOCK_EXEMPT_ = ['DAY_OPEN', 'DAY_CLOSE', 'CLOSE_BUSINESS_DAY', 'REOPEN_BUSINESS_DAY', 'REPRINT_BILL'];
var BNX71_DAY_ACTIONS_ = ['DAY_OPEN', 'DAY_CLOSE', 'CLOSE_BUSINESS_DAY', 'REOPEN_BUSINESS_DAY', 'CLEAR_TEST_DATA'];
var BNX71_ROUTES_ = {
  SAVE_ORDER: (typeof bnxSaveOrder==='function' ? bnxSaveOrder : 'bnxSaveOrder'),
  SAVE_KOT: (typeof bnxSaveKOT==='function' ? bnxSaveKOT : 'bnxSaveKOT'),
  REPAIR_ORDER_KOT_METADATA: (typeof bnxRepairOrderKotItemMetadata==='function' ? bnxRepairOrderKotItemMetadata : 'bnxRepairOrderKotItemMetadata'),
  SAVE_BILL: (typeof bnxSaveBill==='function' ? bnxSaveBill : 'bnxSaveBill'),
  NEXT_BILL_NO: (typeof bnxGetNextBillNumber==='function' ? bnxGetNextBillNumber : 'bnxGetNextBillNumber'),
  SET_BILL_NUMBERING: (typeof bnxSetBillNumbering==='function' ? bnxSetBillNumbering : 'bnxSetBillNumbering'),
  SAVE_PAYMENT: (typeof bnxSavePayment==='function' ? bnxSavePayment : 'bnxSavePayment'),
  VOID_BILL: (typeof bnxVoidBill==='function' ? bnxVoidBill : 'bnxVoidBill'),
  GET_ORDERS: (typeof bnxGetOrders==='function' ? bnxGetOrders : 'bnxGetOrders'),
  GET_ACTIVE_ORDERS: (typeof bnxGetActiveOrders==='function' ? bnxGetActiveOrders : 'bnxGetActiveOrders'),
  GET_BILLS: (typeof bnxGetBills==='function' ? bnxGetBills : 'bnxGetBills'),
  GET_KOT: (typeof bnxGetKOT==='function' ? bnxGetKOT : 'bnxGetKOT'),
  GET_SYNC_STATUS: (typeof bnxGetSyncStatus==='function' ? bnxGetSyncStatus : 'bnxGetSyncStatus'),
  GET_MASTER: (typeof bnxGetMaster==='function' ? bnxGetMaster : 'bnxGetMaster'),
  SAVE_MASTER: (typeof bnxSaveMaster==='function' ? bnxSaveMaster : 'bnxSaveMaster'),
  DELETE_MASTER: (typeof bnxDeleteMaster==='function' ? bnxDeleteMaster : 'bnxDeleteMaster'),
  BATCH_EXECUTE: (typeof bnxBatchExecute==='function' ? bnxBatchExecute : 'bnxBatchExecute'),
  GET_DASHBOARD_SUMMARY: (typeof bnxGetDashboardSummary==='function' ? bnxGetDashboardSummary : 'bnxGetDashboardSummary'),
  GET_ACCOUNTING_OVERVIEW: (typeof bnxGetAccountingOverview==='function' ? bnxGetAccountingOverview : 'bnxGetAccountingOverview'),
  GET_CASHBOOK_REPORT: (typeof bnxGetCashbookReport==='function' ? bnxGetCashbookReport : 'bnxGetCashbookReport'),
  SAVE_CASH_MOVEMENT: (typeof bnxSaveCashMovement==='function' ? bnxSaveCashMovement : 'bnxSaveCashMovement'),
  GET_DAY_STATUS: (typeof bnxGetDayStatus==='function' ? bnxGetDayStatus : 'bnxGetDayStatus'),
  GET_DSR_MATRIX: (typeof bnxGetDsrMatrix==='function' ? bnxGetDsrMatrix : 'bnxGetDsrMatrix'),
  GET_DSR_YTD: (typeof bnxGetDsrYtd==='function' ? bnxGetDsrYtd : 'bnxGetDsrYtd'),
  GET_DSR_RANGE: (typeof bnx71GetDsrRange==='function' ? bnx71GetDsrRange : 'bnx71GetDsrRange'),
  GET_STAFF_LIST: (typeof bnxGetStaffList==='function' ? bnxGetStaffList : 'bnxGetStaffList'),
  GET_ATTENDANCE_EMPLOYEES: (typeof bnxGetAttendanceEmployees==='function' ? bnxGetAttendanceEmployees : 'bnxGetAttendanceEmployees'),
  MARK_ATTENDANCE: (typeof bnxMarkAttendance==='function' ? bnxMarkAttendance : 'bnxMarkAttendance'),
  GET_MY_ATTENDANCE: (typeof bnxGetMyAttendance==='function' ? bnxGetMyAttendance : 'bnxGetMyAttendance'),
  GET_MY_INCENTIVE: (typeof bnxGetMyIncentive==='function' ? bnxGetMyIncentive : 'bnxGetMyIncentive'),
  CLEAR_TEST_DATA: (typeof bnxClearTestData==='function' ? bnxClearTestData : 'bnxClearTestData'),
  DAY_OPEN: (typeof bnxDayOpen==='function' ? bnxDayOpen : 'bnxDayOpen'),
  REOPEN_BUSINESS_DAY: (typeof bnxReopenBusinessDay==='function' ? bnxReopenBusinessDay : 'bnxReopenBusinessDay'),
  DAY_CLOSE: (typeof bnxDayClose==='function' ? bnxDayClose : 'bnxDayClose'),
  GET_BOOTSTRAP: (typeof bnxGetBootstrap==='function' ? bnxGetBootstrap : 'bnxGetBootstrap'),
  GET_CLIENT_INFO: (typeof bnxGetClientInfo==='function' ? bnxGetClientInfo : 'bnxGetClientInfo'),
  GET_MENU_ITEMS: (typeof bnxGetMenuItems==='function' ? bnxGetMenuItems : 'bnxGetMenuItems'),
  GET_BAR_MENU: (typeof bnxGetBarMenu==='function' ? bnxGetBarMenu : 'bnxGetBarMenu'),
  GET_POS_MENU: (typeof bnxGetPosMenu==='function' ? bnxGetPosMenu : 'bnxGetPosMenu'),
  GET_ITEMS: (typeof bnxGetIndentItemCatalog==='function' ? bnxGetIndentItemCatalog : 'bnxGetIndentItemCatalog'),
  SAVE_KITCHEN_INDENT: (typeof bnxSaveKitchenIndent==='function' ? bnxSaveKitchenIndent : 'bnxSaveKitchenIndent'),
  GET_PENDING_INDENTS: (typeof bnxGetPendingIndents==='function' ? bnxGetPendingIndents : 'bnxGetPendingIndents'),
  GET_KITCHEN_INDENT_ITEMS: (typeof bnxGetKitchenIndentItems==='function' ? bnxGetKitchenIndentItems : 'bnxGetKitchenIndentItems'),
  GET_KITCHEN_INDENT_FLOW: (typeof bnxGetKitchenIndentFlow==='function' ? bnxGetKitchenIndentFlow : 'bnxGetKitchenIndentFlow'),
  APPROVE_ISSUE_INDENT: (typeof bnxApproveIssueIndent==='function' ? bnxApproveIssueIndent : 'bnxApproveIssueIndent'),
  SAVE_KITCHEN_CONSUMPTION: (typeof bnxSaveKitchenConsumption==='function' ? bnxSaveKitchenConsumption : 'bnxSaveKitchenConsumption'),
  GET_CONSUMPTION_HISTORY: (typeof bnxGetConsumptionHistory==='function' ? bnxGetConsumptionHistory : 'bnxGetConsumptionHistory'),
  SAVE_WASTAGE: (typeof bnxSaveWastage==='function' ? bnxSaveWastage : 'bnxSaveWastage'),
  GET_WASTAGE_LOG: (typeof bnxGetWastageLog==='function' ? bnxGetWastageLog : 'bnxGetWastageLog'),
  SAVE_BAR_INDENT: (typeof bnxSaveBarIndent==='function' ? bnxSaveBarIndent : 'bnxSaveBarIndent'),
  GET_BAR_INDENT: (typeof bnxGetBarIndent==='function' ? bnxGetBarIndent : 'bnxGetBarIndent'),
  GET_BAR_INDENT_CATALOG: (typeof bnxGetBarIndentCatalog==='function' ? bnxGetBarIndentCatalog : 'bnxGetBarIndentCatalog'),
  GET_BAR_INDENT_STOCK: (typeof bnxGetBarIndentStock_==='function' ? bnxGetBarIndentStock_ : 'bnxGetBarIndentStock_'),
  GET_PAYMENT_MODES: (typeof bnxGetPaymentModes==='function' ? bnxGetPaymentModes : 'bnxGetPaymentModes'),
  GET_TAX_CONFIG: (typeof bnxGetTaxConfig==='function' ? bnxGetTaxConfig : 'bnxGetTaxConfig'),
  LIST_BILLS: (typeof bnxListBills==='function' ? bnxListBills : 'bnxListBills'),
  LIST_RESERVATIONS: (typeof bnxListReservations==='function' ? bnxListReservations : 'bnxListReservations'),
  SAVE_RESERVATION: (typeof bnxSaveReservation==='function' ? bnxSaveReservation : 'bnxSaveReservation'),
  GET_TABLE_AVAILABILITY: (typeof bnxGetTableAvailability==='function' ? bnxGetTableAvailability : 'bnxGetTableAvailability'),
  CANCEL_RESERVATION: (typeof bnxCancelReservation==='function' ? bnxCancelReservation : 'bnxCancelReservation'),
  SEAT_RESERVATION: (typeof bnxSeatReservationHandler==='function' ? bnxSeatReservationHandler : 'bnxSeatReservationHandler'),
  RD_FETCH_SHEET: (typeof bnxRdFetchSheet==='function' ? bnxRdFetchSheet : 'bnxRdFetchSheet'),
  SAVE_TABLE_STATUS: (typeof bnxSaveTableStatusHandler==='function' ? bnxSaveTableStatusHandler : 'bnxSaveTableStatusHandler'),
  ADD_STAFF: (typeof bnxAddStaff==='function' ? bnxAddStaff : 'bnxAddStaff'),
  SAVE_MENU_AVAILABILITY: (typeof bnxSaveMenuAvailability==='function' ? bnxSaveMenuAvailability : 'bnxSaveMenuAvailability'),
  SAVE_CATEGORY_MASTER: (typeof bnxSaveCategoryMaster_==='function' ? bnxSaveCategoryMaster_ : 'bnxSaveCategoryMaster_'),
  SAVE_MENU_ITEM: (typeof bnxSaveMenuItem==='function' ? bnxSaveMenuItem : 'bnxSaveMenuItem'),
  SAVE_MENU_ITEM_IMAGE: (typeof bnxSaveMenuItemImage_==='function' ? bnxSaveMenuItemImage_ : 'bnxSaveMenuItemImage_'),
  GET_RECIPE_COST: (typeof bnxGetRecipeCost==='function' ? bnxGetRecipeCost : 'bnxGetRecipeCost'),
  GET_RECIPE_DATA: (typeof bnxGetRecipeData==='function' ? bnxGetRecipeData : 'bnxGetRecipeData'),
  GET_PRODUCTION_LOG: (typeof bnxGetProductionLog==='function' ? bnxGetProductionLog : 'bnxGetProductionLog'),
  SAVE_RECIPE: (typeof bnxSaveRecipe==='function' ? bnxSaveRecipe : 'bnxSaveRecipe'),
  SAVE_UNIT_CONVERSION: (typeof bnxSaveUnitConversion==='function' ? bnxSaveUnitConversion : 'bnxSaveUnitConversion'),
  SAVE_ITEM_ALIAS: (typeof bnxSaveItemAlias==='function' ? bnxSaveItemAlias : 'bnxSaveItemAlias'),
  RECALCULATE_RECIPE_COST: (typeof bnxRecalculateRecipeCost==='function' ? bnxRecalculateRecipeCost : 'bnxRecalculateRecipeCost'),
  IMPORT_MENU_ITEMS: (typeof bnxImportMenuItems==='function' ? bnxImportMenuItems : 'bnxImportMenuItems'),
  BULK_IMPORT_MASTER: (typeof bnxBulkImportMaster==='function' ? bnxBulkImportMaster : 'bnxBulkImportMaster'),
  GET_PERMISSIONS: (typeof bnxGetPermissions==='function' ? bnxGetPermissions : 'bnxGetPermissions'),
  SAVE_PERMISSION: (typeof bnxSavePermission==='function' ? bnxSavePermission : 'bnxSavePermission'),
  GET_KOT_NUMBER_BATCH: (typeof bnxGetKotNumberBatch==='function' ? bnxGetKotNumberBatch : 'bnxGetKotNumberBatch'),
  UPDATE_KOT_STATUS: (typeof bnxUpdateKotStatus==='function' ? bnxUpdateKotStatus : 'bnxUpdateKotStatus'),
  UPDATE_ORDER_STATUS: (typeof bnxUpdateOrderStatus==='function' ? bnxUpdateOrderStatus : 'bnxUpdateOrderStatus'),
  UPDATE_ORDER_ITEMS: (typeof bnxUpdateOrderItems==='function' ? bnxUpdateOrderItems : 'bnxUpdateOrderItems'),
  GET_DUE_COLLECTION: (typeof bnx72GetDueCollection==='function' ? bnx72GetDueCollection : 'bnx72GetDueCollection'),
  SAVE_DUES_RECEIPT: (typeof bnx72SaveDuesReceipt==='function' ? bnx72SaveDuesReceipt : 'bnx72SaveDuesReceipt'),
  GET_DEBTORS_REPORT: (typeof bnx72GetDebtorsReport==='function' ? bnx72GetDebtorsReport : 'bnx72GetDebtorsReport'),
  GET_DISCOUNT_REPORT: (typeof bnxGetDiscountReport==='function' ? bnxGetDiscountReport : 'bnxGetDiscountReport'),
  GET_DAILY_SALES: (typeof bnxGetDailySales==='function' ? bnxGetDailySales : 'bnxGetDailySales'),
  GET_DSR: (typeof bnxGetDsr==='function' ? bnxGetDsr : 'bnxGetDsr'),
  GET_ONLINE_ORDER_REPORT: (typeof bnxGetOnlineOrderReport==='function' ? bnxGetOnlineOrderReport : 'bnxGetOnlineOrderReport'),
  GET_CLIENT_INVOICE_BRANDING: (typeof bnxGetClientInvoiceBranding==='function' ? bnxGetClientInvoiceBranding : 'bnxGetClientInvoiceBranding'),
  SAVE_CLIENT_INVOICE_BRANDING: (typeof bnxSaveClientInvoiceBranding==='function' ? bnxSaveClientInvoiceBranding : 'bnxSaveClientInvoiceBranding'),
  GET_SALES_CHANNEL_REPORT: (typeof bnxGetSalesChannelReport==='function' ? bnxGetSalesChannelReport : 'bnxGetSalesChannelReport'),
  SAVE_ONLINE_ORDER: (typeof bnxSaveOnlineOrder==='function' ? bnxSaveOnlineOrder : 'bnxSaveOnlineOrder'),
  IMPORT_BATCH: (typeof bnxImportBatch==='function' ? bnxImportBatch : 'bnxImportBatch'),
  GET_KDS_REPORT: (typeof bnxGetKdsReport==='function' ? bnxGetKdsReport : 'bnxGetKdsReport'),
  CANCEL_ORDER_ITEM: (typeof bnxCancelOrderItem==='function' ? bnxCancelOrderItem : 'bnxCancelOrderItem'),
  GET_CANCELLED_ITEMS_REPORT: (typeof bnxGetCancelledItemsReport==='function' ? bnxGetCancelledItemsReport : 'bnxGetCancelledItemsReport'),
  GET_TIPS_REPORT: (typeof bnxGetTipsReport==='function' ? bnxGetTipsReport : 'bnxGetTipsReport'),
  GET_NC_REPORT: (typeof bnxGetNcReport==='function' ? bnxGetNcReport : 'bnxGetNcReport'),
  GET_CONSUMPTION_REPORT: (typeof bnxGetConsumptionReport==='function' ? bnxGetConsumptionReport : 'bnxGetConsumptionReport'),
  GET_BLIND_TILL_REPORT: (typeof bnxGetBlindTillReport==='function' ? bnxGetBlindTillReport : 'bnxGetBlindTillReport'),
  GET_BILL_FOR_REPRINT: (typeof bnxGetBillForReprint==='function' ? bnxGetBillForReprint : 'bnxGetBillForReprint'),
  GET_INSTRUCTIONS_REPORT: (typeof bnxGetInstructionsReport==='function' ? bnxGetInstructionsReport : 'bnxGetInstructionsReport'),
  GET_GSTR_SUMMARY: (typeof bnxGetGstrSummary==='function' ? bnxGetGstrSummary : 'bnxGetGstrSummary'),
  GET_DAY_BOOK_REPORT: (typeof bnxGetDayBookReport==='function' ? bnxGetDayBookReport : 'bnxGetDayBookReport'),
  GET_SMARTCARD_REPORT: (typeof bnxGetSmartcardReport==='function' ? bnxGetSmartcardReport : 'bnxGetSmartcardReport'),
  SAVE_PRODUCTION: (typeof bnxSaveProduction==='function' ? bnxSaveProduction : 'bnxSaveProduction'),
  SAVE_MENU_CARD_UPLOAD: (typeof bnxSaveMenuCardUpload==='function' ? bnxSaveMenuCardUpload : 'bnxSaveMenuCardUpload'),
  UPLOAD_LOGO: (typeof bnxUploadLogo==='function' ? bnxUploadLogo : 'bnxUploadLogo'),
  UPLOAD_TO_CLIENT_DRIVE: (typeof bnxUploadToClientDrive_==='function' ? bnxUploadToClientDrive_ : 'bnxUploadToClientDrive_'),
  GET_CLIENT_DRIVE_STATUS: (typeof bnxGetClientDriveStatus_==='function' ? bnxGetClientDriveStatus_ : 'bnxGetClientDriveStatus_'),
  GET_CLIENT_DRIVE_FOLDER: (typeof bnxGetClientDriveFolder_==='function' ? bnxGetClientDriveFolder_ : 'bnxGetClientDriveFolder_'),
  VERSION_OLD_FILES: (typeof bnxVersionOldFiles_==='function' ? bnxVersionOldFiles_ : 'bnxVersionOldFiles_'),
  AI_QUERY: (typeof bnxAIQuery_==='function' ? bnxAIQuery_ : 'bnxAIQuery_'),
  GET_AI_PURCHASE_SUGGESTIONS: (typeof bnxGetAIPurchaseSuggestions_==='function' ? bnxGetAIPurchaseSuggestions_ : 'bnxGetAIPurchaseSuggestions_'),
  REBUILD_STOCK_BALANCE: (typeof bnxRebuildStockBalance==='function' ? bnxRebuildStockBalance : 'bnxRebuildStockBalance'),
  GET_ITEM_UNIT_CONVERSIONS: (typeof bnxGetItemUnitConversions==='function' ? bnxGetItemUnitConversions : 'bnxGetItemUnitConversions'),
  GET_SALES_DAY_BOOK_REPORT: (typeof bnxGetSalesDayBookReport==='function' ? bnxGetSalesDayBookReport : 'bnxGetSalesDayBookReport'),
  GET_PAYMENT_REPORT_V2: (typeof bnxGetPaymentReportV2==='function' ? bnxGetPaymentReportV2 : 'bnxGetPaymentReportV2'),
  GET_CASH_BANK_REPORT: (typeof bnxGetCashBankReport==='function' ? bnxGetCashBankReport : 'bnxGetCashBankReport'),
  GET_CUSTOMER_DUES_REPORT_V2: (typeof bnx72GetCustomerDuesReportV2==='function' ? bnx72GetCustomerDuesReportV2 : 'bnx72GetCustomerDuesReportV2'),
  GET_SUPPLIER_DUES_REPORT_V2: (typeof bnxGetSupplierDuesReportV2==='function' ? bnxGetSupplierDuesReportV2 : 'bnxGetSupplierDuesReportV2'),
  GET_PROFIT_LOSS_REPORT: (typeof bnxGetProfitLossReport==='function' ? bnxGetProfitLossReport : 'bnxGetProfitLossReport'),
  GET_RECONCILIATION_REPORT: (typeof bnxGetReconciliationReport==='function' ? bnxGetReconciliationReport : 'bnxGetReconciliationReport'),
  GET_DASHBOARD_KPI_REPORT: (typeof bnxGetDashboardKpiReport==='function' ? bnxGetDashboardKpiReport : 'bnxGetDashboardKpiReport'),
  REFRESH_ALL_REPORTS: (typeof bnxRefreshAllReports==='function' ? bnxRefreshAllReports : 'bnxRefreshAllReports'),
  GET_REPORT_HUB_ALL: (typeof bnxRefreshAllReports==='function' ? bnxRefreshAllReports : 'bnxRefreshAllReports'),
  GET_ITEM_SALES_REPORT: (typeof bnxGetItemSalesReport==='function' ? bnxGetItemSalesReport : 'bnxGetItemSalesReport'),
  GET_CATEGORY_SALES_REPORT: (typeof bnxGetCategorySalesReport==='function' ? bnxGetCategorySalesReport : 'bnxGetCategorySalesReport'),
  GET_SALES_SUMMARY_REPORT: (typeof bnxGetSalesSummaryReport==='function' ? bnxGetSalesSummaryReport : 'bnxGetSalesSummaryReport'),
  GET_STOCK_REPORT: (typeof bnxGetStockReport==='function' ? bnxGetStockReport : 'bnxGetStockReport'),
  GET_CENTRAL_INVENTORY: (typeof bnxGetCentralInventory==='function' ? bnxGetCentralInventory : 'bnxGetCentralInventory'),
  GET_PURCHASE_REPORT: (typeof bnxGetPurchaseReport==='function' ? bnxGetPurchaseReport : 'bnxGetPurchaseReport'),
  GET_SUPPLIER_REPORT: (typeof bnxGetSupplierReport==='function' ? bnxGetSupplierReport : 'bnxGetSupplierReport'),
  GET_GST_REPORT: (typeof bnxGetGstReport==='function' ? bnxGetGstReport : 'bnxGetGstReport'),
  GET_FOOD_COST_REPORT: (typeof bnxGetFoodCostReport==='function' ? bnxGetFoodCostReport : 'bnxGetFoodCostReport'),
  GET_BAR_COST_REPORT: (typeof bnxGetBarCostReport==='function' ? bnxGetBarCostReport : 'bnxGetBarCostReport'),
  GET_WASTAGE_REPORT: (typeof bnxGetWastageReport==='function' ? bnxGetWastageReport : 'bnxGetWastageReport'),
  GET_KITCHEN_PERFORMANCE_REPORT: (typeof bnxGetKitchenPerformanceReport==='function' ? bnxGetKitchenPerformanceReport : 'bnxGetKitchenPerformanceReport'),
  GET_STEWARD_PERFORMANCE_REPORT: (typeof bnxGetStewardPerformanceReport==='function' ? bnxGetStewardPerformanceReport : 'bnxGetStewardPerformanceReport'),
  GET_BAR_PERFORMANCE_REPORT: (typeof bnxGetBarPerformanceReport==='function' ? bnxGetBarPerformanceReport : 'bnxGetBarPerformanceReport'),
  GET_TABLE_PERFORMANCE_REPORT: (typeof bnxGetTablePerformanceReport==='function' ? bnxGetTablePerformanceReport : 'bnxGetTablePerformanceReport'),
  SAVE_PETTY_CASH: (typeof bnxSavePettyCash==='function' ? bnxSavePettyCash : 'bnxSavePettyCash'),
  GET_PETTY_CASH_LEDGER: (typeof bnxGetPettyCashLedger==='function' ? bnxGetPettyCashLedger : 'bnxGetPettyCashLedger'),
  GET_ONLINE_ORDERS_LIST: (typeof bnxGetOnlineOrdersList==='function' ? bnxGetOnlineOrdersList : 'bnxGetOnlineOrdersList'),
  CHECK_CLIENT_DATABASE: (typeof bnxCheckClientDatabase_==='function' ? bnxCheckClientDatabase_ : 'bnxCheckClientDatabase_'),
  GET_CLIENT_DATABASE_STATUS: (typeof bnxGetClientDatabaseStatus==='function' ? bnxGetClientDatabaseStatus : 'bnxGetClientDatabaseStatus'),
  GET_ALL_CLIENTS: (typeof bnxGetAllClients==='function' ? bnxGetAllClients : 'bnxGetAllClients'),
  CREATE_CLIENT: (typeof bnxCreateClient==='function' ? bnxCreateClient : 'bnxCreateClient'),
  PROVISION_CLIENT_DATABASES: (typeof bnxProvisionClientForAdmin_==='function' ? bnxProvisionClientForAdmin_ : 'bnxProvisionClientForAdmin_'),
  GET_CLIENT_POS_PROFILE: (typeof bnxGetClientPosProfile_==='function' ? bnxGetClientPosProfile_ : 'bnxGetClientPosProfile_'),
  AUTO_REPAIR_CLIENT: (typeof bnxAutoRepairClient_==='function' ? bnxAutoRepairClient_ : 'bnxAutoRepairClient_'),
  GET_CLIENT_SCALE_STATUS: (typeof bnxGetClientScaleStatus_==='function' ? bnxGetClientScaleStatus_ : 'bnxGetClientScaleStatus_'),
  SAVE_PURCHASE_INVOICE: (typeof bnxSavePurchaseInvoiceRow==='function' ? bnxSavePurchaseInvoiceRow : 'bnxSavePurchaseInvoiceRow'),
  UPDATE_PURCHASE_INVOICE: (typeof bnxSavePurchaseInvoiceRow==='function' ? bnxSavePurchaseInvoiceRow : 'bnxSavePurchaseInvoiceRow'),
  RECALC_INVENTORY_TOTALS: (typeof bnxGetStockReport==='function' ? bnxGetStockReport : 'bnxGetStockReport'),
  SYNC_PURCHASE_INVOICE_ROW: (typeof bnxSavePurchaseInvoiceRow==='function' ? bnxSavePurchaseInvoiceRow : 'bnxSavePurchaseInvoiceRow'),
  GET_PURCHASE_INVOICES: (typeof bnxGetPurchaseInvoices==='function' ? bnxGetPurchaseInvoices : 'bnxGetPurchaseInvoices'),
  SAVE_PURCHASE: (typeof bnxSavePurchaseInvoiceRow==='function' ? bnxSavePurchaseInvoiceRow : 'bnxSavePurchaseInvoiceRow'),
  DELETE_PURCHASE_INVOICE_ROW: (typeof bnxDeletePurchaseInvoiceRow==='function' ? bnxDeletePurchaseInvoiceRow : 'bnxDeletePurchaseInvoiceRow'),
  ISSUE_STOCK_TO_DEPT: (typeof bnxIssueStockToDept==='function' ? bnxIssueStockToDept : 'bnxIssueStockToDept'),
  SAVE_DEPT_ISSUE: (typeof bnxSaveDeptIssue==='function' ? bnxSaveDeptIssue : 'bnxSaveDeptIssue'),
  GET_DEPT_ISSUES: (typeof bnxGetDeptIssues==='function' ? bnxGetDeptIssues : 'bnxGetDeptIssues'),
  ACK_DEPT_ISSUE: (typeof bnxAckDeptIssue==='function' ? bnxAckDeptIssue : 'bnxAckDeptIssue'),
  SAVE_GRN: (typeof bnxSaveGRNLive==='function' ? bnxSaveGRNLive : 'bnxSaveGRNLive'),
  SAVE_STOCK_TRANSFER: (typeof bnxSaveTransferLive==='function' ? bnxSaveTransferLive : 'bnxSaveTransferLive'),
  SAVE_PHYSICAL_ADJUSTMENT: (typeof bnxSavePhysicalAdjustment==='function' ? bnxSavePhysicalAdjustment : 'bnxSavePhysicalAdjustment'),
  SAVE_PURCHASE_RETURN: (typeof bnxSavePurchaseReturnLive==='function' ? bnxSavePurchaseReturnLive : 'bnxSavePurchaseReturnLive'),
  SAVE_PURCHASE_PAYMENT: (typeof bnxSavePurchasePaymentLive==='function' ? bnxSavePurchasePaymentLive : 'bnxSavePurchasePaymentLive'),
  CLOSE_BUSINESS_DAY: (typeof bnxCloseBusinessDayLive==='function' ? bnxCloseBusinessDayLive : 'bnxCloseBusinessDayLive'),
  GET_KOTS: (typeof bnx71GetKots==='function' ? bnx71GetKots : 'bnx71GetKots'),
  GET_REPRINT_REPORT: (typeof bnx71GetReprintReport==='function' ? bnx71GetReprintReport : 'bnx71GetReprintReport'),
  REPRINT_BILL: (typeof bnx71ReprintBill==='function' ? bnx71ReprintBill : 'bnx71ReprintBill'),
  GET_ROLE_ACCESS: (typeof bnx71GetRoleAccess==='function' ? bnx71GetRoleAccess : 'bnx71GetRoleAccess'),
  SAVE_ROLE_ACCESS: (typeof bnx71SaveRoleAccess==='function' ? bnx71SaveRoleAccess : 'bnx71SaveRoleAccess'),
  SETTLE_DUE_BILL: (typeof bnx71SettleDueBill==='function' ? bnx71SettleDueBill : 'bnx71SettleDueBill'),
  GET_CUSTOMER_LEDGER: (typeof bnx72GetCustomerLedger==='function' ? bnx72GetCustomerLedger : 'bnx72GetCustomerLedger'),
  SAVE_CREDIT_CUSTOMER: (typeof bnx72SaveCreditCustomer==='function' ? bnx72SaveCreditCustomer : 'bnx72SaveCreditCustomer'),
  SAVE_CUSTOMER_OPENING_BALANCES: (typeof bnx72SaveOpeningBalances==='function' ? bnx72SaveOpeningBalances : 'bnx72SaveOpeningBalances'),
  GET_ACCOUNTS_DAY: (typeof bnx72GetAccountsDay==='function' ? bnx72GetAccountsDay : 'bnx72GetAccountsDay'),
  GET_TABLE_FLOOR: (typeof bnx72GetTableFloor==='function' ? bnx72GetTableFloor : 'bnx72GetTableFloor'),
  TRANSFER_TABLE: (typeof bnx72TransferTable==='function' ? bnx72TransferTable : 'bnx72TransferTable'),
  MERGE_TABLES: (typeof bnx72MergeTables==='function' ? bnx72MergeTables : 'bnx72MergeTables'),
  RESTORE_MISSING_BILLS: (typeof bnx72RestoreMissingBills==='function' ? bnx72RestoreMissingBills : 'bnx72RestoreMissingBills'),

  HEARTBEAT: function () { return { success: true, timestamp: new Date().toISOString() }; },
  UPDATE_ACCOUNT_SECURITY: function () { return { success: false, error: 'AUTH_ENGINE_REQUIRED', message: 'Account security is handled by V2_AUTH.' }; },
  ENSURE_CLIENT_SCHEMA: function (session) { return bnxEnsureClientSchema_(session.CLIENT_ID); },
  SYNC_PURCHASE_TO_INVENTORY: function (session, payload) { return respondError(409, 'Physical stock is posted only by GRN; purchase invoice does not post inventory.', payload.requestId || ''); }
};

function doPost(e) {
  const prevReq = BNX71_REQ_;
  let requestId = '';
  const t0 = Date.now();
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = String(payload.action || '');
    const sessionToken = payload.sessionToken || '';
    const clientId = payload.clientId || '';
    requestId = payload.requestId || '';
    if (action === 'GET_CONFIG') return respondJson(bnxGetConfig());

    const session = bnxVerifySession(sessionToken, clientId);
    if (!session) return respondJson(respondError(401, 'Invalid or expired session', requestId));
    if (session.CLIENT_ID !== clientId) {
      bnxLogError(session.CLIENT_ID, 'Unauthorized access attempt: client ' + clientId, { action: action });
      return respondJson(respondError(403, 'Unauthorized access', requestId));
    }

    const readOnly = bnx71IsReadAction_(action);
    bnx71ResetReq_(session.CLIENT_ID, readOnly);

    if (!readOnly && BNX71_DAYLOCK_EXEMPT_.indexOf(action) < 0) {
      const postDate = bnxExtractPostingDate_(payload);
      if (postDate && bnxIsBusinessDateClosed_(session.CLIENT_ID, postDate)) {
        return respondJson({ success: false, error: 'BUSINESS_DAY_CLOSED', message: 'Business date ' + postDate + ' is closed. Posting, editing or deleting transactions for a closed date is blocked.' });
      }
    }

    const route = BNX71_ROUTES_[action];
    if (!route) return respondJson(respondError(400, 'Unknown action: ' + action, requestId));
    if (typeof route !== 'function') return respondJson(respondError(501, 'Handler ' + route + ' is not deployed in this Code.gs', requestId));

    const result = route(session, payload);
    if (!readOnly && result && result.success !== false) {
      bnx71BumpReportVersion_(session.CLIENT_ID);
      if (BNX71_DAY_ACTIONS_.indexOf(action) >= 0) bnx71ClearDayCache_(session.CLIENT_ID);
    }
    if (result && typeof result === 'object' && !Array.isArray(result)) result.serverMs = Date.now() - t0;
    return respondJson(result);
  } catch (error) {
    console.error('[Backend Error]', error);
    return respondJson({ success: false, error: error.message, requestId: requestId });
  } finally {
    BNX71_REQ_ = prevReq;
  }
}


/* ============================================================================
 * PASS #71 — ITEM / GROUP CLASSIFICATION (BILL_ITEMS is authoritative)
 * ========================================================================== */
function bnx71GroupClass_(groupName, groupType) {
  const g = String(groupName || '').trim().toUpperCase();
  const t = String(groupType || '').trim().toUpperCase();
  if (!g && !t) return '';
  if (/TOBACCO|CIGAR|HOOKAH|SHISHA|PAAN/.test(g)) return 'others';
  if (/LIQUOR|ALCOHOL|SPIRIT|WINE|BEER/.test(g)) return 'liquor';
  if (/BEVERAGE|DRINK|MOCKTAIL|JUICE/.test(g)) return 'beverage';
  if (/FOOD|ADD.?ONS?|KITCHEN|SNACK|MAIN/.test(g)) return 'food';
  if (t === 'BAR') return 'liquor';
  if (t === 'BEVERAGE') return 'beverage';
  if (t === 'KITCHEN') return 'food';
  return '';
}
/* Compact item metadata (cached 5 min, cleared by bnxInvalidateMasterCache_). */
function bnx71ItemMeta_(clientId) {
  if (BNX71_REQ_.itemMeta && BNX71_REQ_.itemMetaClient === clientId) return BNX71_REQ_.itemMeta;
  const key = 'itemmeta71_' + clientId;
  let meta = null;
  const hit = bnx71CacheGetBig_(key);
  if (hit) { try { meta = JSON.parse(hit); } catch (e) {} }
  if (!meta) {
    meta = { byId: {}, byName: {}, groups: {} };
    try {
      const v = bnxClientSheet(clientId, SHEETS.ITEM_GROUP_MASTER).getDataRange().getValues(), ix = bnx71Idx_(v[0] || []);
      for (let r = 1; r < v.length; r++) {
        const id = String(v[r][ix.ITEM_GROUP_ID] || '').trim(); if (!id) continue;
        meta.groups[id] = { n: String(v[r][ix.ITEM_GROUP_NAME] || v[r][ix.GROUP_NAME] || '').trim(), t: String(ix.GROUP_TYPE !== undefined ? v[r][ix.GROUP_TYPE] : '').trim() };
      }
    } catch (e) {}
    let catById = {};
    try { catById = bnxCachedCategoryNameMap_(clientId).byId || {}; } catch (e) {}
    try {
      const v = bnxClientSheet(clientId, SHEETS.ITEM_MASTER).getDataRange().getValues(), ix = bnx71Idx_(v[0] || []);
      for (let r = 1; r < v.length; r++) {
        if (ix.CLIENT_ID !== undefined && v[r][ix.CLIENT_ID] && String(v[r][ix.CLIENT_ID]) !== String(clientId)) continue;
        const id = String(v[r][ix.ITEM_ID] || '').trim(); if (!id) continue;
        const gid = String(ix.ITEM_GROUP_ID !== undefined ? v[r][ix.ITEM_GROUP_ID] || '' : '').trim();
        const cid = String(ix.CATEGORY_ID !== undefined ? v[r][ix.CATEGORY_ID] || '' : '').trim();
        const bar = ix.IS_BAR !== undefined && (v[r][ix.IS_BAR] === true || /^(TRUE|1|YES)$/i.test(String(v[r][ix.IS_BAR])));
        meta.byId[id] = { g: gid, gn: gid && meta.groups[gid] ? meta.groups[gid].n : '', gt: gid && meta.groups[gid] ? meta.groups[gid].t : '',
          c: cid, cn: catById[cid] || '', b: bar ? 1 : 0, n: String(v[r][ix.ITEM_NAME] || '').trim() };
        const nk = String(v[r][ix.ITEM_NAME] || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (nk && !meta.byName[nk]) meta.byName[nk] = id;
      }
    } catch (e) {}
    try {
      const v = bnxClientSheet(clientId, SHEETS.BAR_ITEM_MASTER).getDataRange().getValues(), ix = bnx71Idx_(v[0] || []);
      for (let r = 1; r < v.length; r++) {
        const id = String(v[r][ix.ITEM_ID] || '').trim(); if (!id) continue;
        if (!meta.byId[id]) meta.byId[id] = { g: '', gn: '', gt: 'BAR', c: '', cn: String(v[r][ix.BAR_CATEGORY] || ''), b: 1, n: '' };
        else meta.byId[id].b = 1;
      }
    } catch (e) {}
    bnx71CachePutBig_(key, JSON.stringify(meta), 300);
  }
  BNX71_REQ_.itemMeta = meta; BNX71_REQ_.itemMetaClient = clientId;
  return meta;
}
/* One classification for DSR / item / category reports. */
function bnx71ClassifyLine_(meta, itemId, itemName, lineGroupName, lineGroupId, lineCategory) {
  let cls = bnx71GroupClass_(lineGroupName, '');
  if (!cls && lineGroupId && meta.groups[lineGroupId]) cls = bnx71GroupClass_(meta.groups[lineGroupId].n, meta.groups[lineGroupId].t);
  let m = itemId ? meta.byId[itemId] : null;
  if (!m && itemName) { const id2 = meta.byName[String(itemName).trim().toLowerCase().replace(/\s+/g, ' ')]; if (id2) m = meta.byId[id2]; }
  if (!cls && m) cls = bnx71GroupClass_(m.gn, m.gt) || (m.b ? 'liquor' : '');
  if (!cls) {
    const f = bnxClassifyDsrItem_(lineCategory || (m && m.cn) || '', itemName);
    cls = f.isLiquor ? 'liquor' : f.isBeverage ? 'beverage' : f.isOther ? 'others' : 'food';
  }
  return cls;
}

/* ============================================================================
 * SALES DATASET (item / category / GST / cost reports) — uses BILL_ITEMS group
 * ========================================================================== */
function bnxBuildSalesDataset_(clientId, locationId, from, to) {
  const k = 'sds71|' + clientId + '|' + (locationId || '') + '|' + from + '|' + to;
  if (BNX71_REQ_[k]) return BNX71_REQ_[k];
  const cacheKey = 'sds71_' + bnx71Hash_(k + '|v' + bnx71ReportVersion_(clientId));
  const hit = bnx71CacheGetBig_(cacheKey);
  if (hit) { try { const d = JSON.parse(hit); BNX71_REQ_[k] = d; return d; } catch (e) {} }
  const ds = bnxBuildSalesDataset_impl_(clientId, locationId, from, to);
  bnx71CachePutBig_(cacheKey, JSON.stringify(ds), 300);
  BNX71_REQ_[k] = ds;
  return ds;
}
function bnxBuildSalesDataset_impl_(clientId, locationId, from, to) {
  const bv = bnxClientSheet(clientId, SHEETS.BILL_MASTER).getDataRange().getValues(), bx = bnx71Idx_(bv[0] || []);
  const billMeta = {};
  let billCount = 0, totalCovers = 0;
  for (let r = 1; r < bv.length; r++) {
    const row = bv[r];
    if (String(row[bx.CLIENT_ID] || '') !== String(clientId)) continue;
    if (locationId && bx.LOCATION_ID !== undefined && String(row[bx.LOCATION_ID] || '') !== String(locationId)) continue;
    const dk = bnxNormalizeDateKey_(row[bx.BILL_DATE]);
    if (!dk || dk < from || dk > to) continue;
    const st = String(row[bx.BILL_STATUS] || '').toUpperCase();
    if (st === 'CANCELLED' || st === 'VOID') continue;
    const id = String(row[bx.BILL_ID] || ''); if (!id) continue;
    billMeta[id] = { subtotal: bnx71Num_(row[bx.SUBTOTAL]), discount: bnx71Num_(row[bx.BILL_DISCOUNT]) + bnx71Num_(row[bx.ITEM_DISCOUNT]),
      tax: bnx71Num_(row[bx.TAX_AMOUNT]), taxable: bnx71Num_(row[bx.TAXABLE_AMOUNT]), grandTotal: bnx71Num_(row[bx.GRAND_TOTAL]), covers: bnx71Num_(row[bx.COVERS]) };
    billCount++; totalCovers += bnx71Num_(row[bx.COVERS]);
  }
  const meta = bnx71ItemMeta_(clientId);
  const catMap = bnxCachedCategoryNameMap_(clientId);
  const costMap = bnxCachedItemCostMap_(clientId);
  const iv = bnxClientSheet(clientId, SHEETS.BILL_ITEMS).getDataRange().getValues(), ix = bnx71Idx_(iv[0] || []);
  const lineTotalByBill = {}, raw = [];
  for (let r = 1; r < iv.length; r++) {
    const bid = String(iv[r][ix.BILL_ID] || '');
    if (!billMeta[bid]) continue;
    const lt = bnx71Num_(iv[r][ix.LINE_TOTAL]);
    lineTotalByBill[bid] = (lineTotalByBill[bid] || 0) + lt;
    raw.push(iv[r]);
  }
  const g = function (row, name) { return ix[name] === undefined ? '' : row[ix[name]]; };
  const itemRows = [], uncategorized = {};
  raw.forEach(function (row) {
    const bid = String(g(row, 'BILL_ID'));
    const bill = billMeta[bid];
    const gross = bnx71Num_(g(row, 'LINE_TOTAL'));
    const billTotal = lineTotalByBill[bid] || 0;
    const share = billTotal > 0 ? gross / billTotal : 0;
    const itemName = String(g(row, 'ITEM_NAME') || '').trim();
    let itemId = String(g(row, 'ITEM_ID') || '').trim();
    if (!itemId) itemId = meta.byName[itemName.toLowerCase().replace(/\s+/g, ' ')] || '';
    const m = itemId ? (meta.byId[itemId] || {}) : {};
    const lineCat = String(g(row, 'CATEGORY') || '').trim();
    let categoryId = m.c || '';
    let categoryName = categoryId ? (catMap.byId[categoryId] || m.cn || '') : '';
    if (!categoryName && lineCat) { categoryName = lineCat; categoryId = catMap.idByName[lineCat.toLowerCase()] || ''; }
    if (!categoryName) { categoryName = 'Uncategorized'; uncategorized[itemName || itemId || 'unknown'] = true; }
    const groupId = String(g(row, 'ITEM_GROUP_ID') || m.g || '').trim();
    const groupName = String(g(row, 'ITEM_GROUP_NAME') || (groupId && meta.groups[groupId] ? meta.groups[groupId].n : '') || m.gn || 'Unassigned').trim();
    const discount = +(bill.discount * share).toFixed(4);
    const net = +(gross - discount).toFixed(4);
    const hasRate = ix.TAX_RATE !== undefined && String(row[ix.TAX_RATE]).trim() !== '';
    const taxRate = hasRate ? Math.max(0, bnx71Num_(row[ix.TAX_RATE])) : (net > 0 ? +((bill.tax * share) / net).toFixed(6) : 0);
    const tax = hasRate ? +(net * taxRate).toFixed(4) : +(bill.tax * share).toFixed(4);
    const qty = bnx71Num_(g(row, 'QUANTITY'));
    itemRows.push({ billId: bid, itemId: itemId, itemName: itemName || m.n || 'Unknown Item', categoryId: categoryId, categoryName: categoryName,
      groupId: groupId, groupName: groupName, qty: qty, gross: gross, discount: discount, tax: tax, taxRate: taxRate, net: net,
      foodCost: (itemId ? Number(costMap[itemId] || 0) : 0) * qty });
  });
  return { billMeta: billMeta, billCount: billCount, totalCovers: totalCovers, itemRows: itemRows, uncategorizedItems: Object.keys(uncategorized) };
}
/* Category report: group by real id, else by the line's category NAME (was: all → one bucket). */
function bnxGetCategorySalesReport_impl_(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const rng = bnxResolveDateRange_(payload), from = rng.from, to = rng.to;
  try {
    const ds = bnxBuildSalesDataset_(clientId, locationId, from, to);
    const byCat = {};
    let grandNet = 0;
    ds.itemRows.forEach(function (l) {
      const key = l.categoryId || ('NAME|' + String(l.categoryName || 'Uncategorized').toUpperCase());
      if (!byCat[key]) byCat[key] = { categoryId: l.categoryId, categoryName: l.categoryName, qty: 0, gross: 0, discount: 0, tax: 0, net: 0, foodCost: 0, billIds: {} };
      const x = byCat[key];
      x.qty += l.qty; x.gross += l.gross; x.discount += l.discount; x.tax += l.tax; x.net += l.net; x.foodCost += l.foodCost; x.billIds[l.billId] = true;
      grandNet += l.net;
    });
    const sheetRows = [], apiRows = [];
    Object.keys(byCat).forEach(function (k) {
      const x = byCat[k], gp = +(x.net - x.foodCost).toFixed(2);
      const base = { CLIENT_ID: clientId, LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to, CATEGORY_ID: x.categoryId, CATEGORY_NAME: x.categoryName,
        QUANTITY_SOLD: x.qty, GROSS_SALES: +x.gross.toFixed(2), DISCOUNT: +x.discount.toFixed(2), TAX: +x.tax.toFixed(2), NET_SALES: +x.net.toFixed(2),
        FOOD_COST: +x.foodCost.toFixed(2), GROSS_PROFIT: gp, MARGIN_PERCENT: x.net > 0 ? +((gp / x.net) * 100).toFixed(2) : 0 };
      sheetRows.push(base);
      apiRows.push(Object.assign({}, base, { BILL_COUNT: Object.keys(x.billIds).length, SALES_PERCENT: grandNet > 0 ? +((x.net / grandNet) * 100).toFixed(2) : 0 }));
    });
    apiRows.sort(function (a, b) { return b.NET_SALES - a.NET_SALES; });
    bnxReplaceReportByFields_(clientId, 'CATEGORY_SALES_REPORT', { LOCATION_ID: locationId, FROM_DATE: from, TO_DATE: to }, sheetRows);
    bnxUpsertReportRegistry_(clientId, 'CATEGORY_SALES_REPORT', 'SALES', 'REPORT', 'BILL_MASTER,BILL_ITEMS,ITEM_MASTER,CATEGORY_MASTER');
    return { success: true, available: true, isDemo: false, data: { rows: apiRows, from: from, to: to, totalNetSales: +grandNet.toFixed(2) } };
  } catch (error) {
    bnxLogError(clientId, 'bnxGetCategorySalesReport failed: ' + error.message, payload);
    return { success: false, error: error.message };
  }
}

/* ============================================================================
 * INVENTORY SPEED — opening stock was O(items × STOCK_MOVEMENT rows)
 * ========================================================================== */
function bnxStockOpeningForItem_(clientId, locationId, itemId, from) {
  const k = clientId + '|' + (locationId || '') + '|' + from;
  let idx = BNX71_OPEN_IDX_[k];
  if (!idx) {
    idx = { mv: {}, cnt: {}, rpt: {}, rptDate: {} };
    try {
      const v = bnxClientSheet(clientId, SHEETS.STOCK_MOVEMENT).getDataRange().getValues(), x = bnx71Idx_(v[0] || []);
      for (let r = 1; r < v.length; r++) {
        if (String(v[r][x.CLIENT_ID]) !== String(clientId)) continue;
        if (locationId && String(v[r][x.LOCATION_ID] || '') !== String(locationId)) continue;
        const d = bnxNormalizeDateKey_(v[r][x.MOVEMENT_DATE]);
        if (!d || d >= from) continue;
        const it = String(v[r][x.ITEM_ID] || '');
        idx.mv[it] = (idx.mv[it] || 0) + bnx71Num_(v[r][x.QUANTITY_IN]) - bnx71Num_(v[r][x.QUANTITY_OUT]);
        idx.cnt[it] = (idx.cnt[it] || 0) + 1;
      }
    } catch (e) {}
    try {
      const v = bnxClientSheet(clientId, 'STOCK_REPORT').getDataRange().getValues(), h = v[0] || [];
      const ci = h.indexOf('CLIENT_ID'), li = h.indexOf('LOCATION_ID'), ii = h.indexOf('ITEM_ID'), di = h.indexOf('AS_OF_DATE'), qi = h.indexOf('CLOSING_QTY');
      for (let r = 1; r < v.length; r++) {
        if (String(v[r][ci]) !== String(clientId)) continue;
        if (String(v[r][li] || '') !== String(locationId || '')) continue;
        const d = bnxNormalizeDateKey_(v[r][di]), it = String(v[r][ii] || '');
        if (!d || d >= from || d <= (idx.rptDate[it] || '')) continue;
        idx.rptDate[it] = d; idx.rpt[it] = bnx71Num_(v[r][qi]);
      }
    } catch (e) {}
    BNX71_OPEN_IDX_[k] = idx;
  }
  const id = String(itemId);
  if (idx.cnt[id]) return { opening: +idx.mv[id].toFixed(4), found: true, source: 'STOCK_MOVEMENT' };
  if (idx.rptDate[id]) return { opening: idx.rpt[id], found: true, source: 'STOCK_REPORT' };
  return { opening: 0, found: false, source: 'NONE' };
}
/* Resolver used by indent/consumption/wastage/GRN/transfer — built once per request
   (the old version re-read ITEM_MASTER + RAW_MATERIAL_MASTER per line while holding
   the global script lock, which caused the "Lock timeout" errors on SAVE_ORDER). */
function bnxResolveInventoryItem_(clientId, itemId, itemName) {
  let idx = BNX71_INV_IDX_[clientId];
  if (!idx) {
    idx = { ids: {}, names: {} };
    const add = function (sheetName, idCols, nameCols) {
      try {
        const v = bnxClientSheet(clientId, sheetName).getDataRange().getValues(), h = v[0] || [];
        const ic = idCols.map(function (c) { return h.indexOf(c); }).filter(function (c) { return c >= 0; });
        const nc = nameCols.map(function (c) { return h.indexOf(c); }).filter(function (c) { return c >= 0; });
        const ai = h.indexOf('IS_ACTIVE'), st = h.indexOf('STATUS');
        for (let r = 1; r < v.length; r++) {
          if (ai >= 0 && (v[r][ai] === false || String(v[r][ai]).toUpperCase() === 'FALSE')) continue;
          if (st >= 0 && String(v[r][st] || '').trim().toUpperCase() === 'INACTIVE') continue;
          const nm = nc.length ? String(v[r][nc[0]] || '').trim() : '';
          const ids = ic.map(function (c) { return String(v[r][c] || '').trim(); }).filter(Boolean);
          ids.forEach(function (id) { if (!idx.ids[id]) idx.ids[id] = { name: nm, source: sheetName }; });
          const nk = nm.toLowerCase().replace(/\s+/g, ' ');
          if (nk && ids.length) { (idx.names[nk] = idx.names[nk] || {})[ids[0]] = { itemId: ids[0], itemName: nm, source: sheetName }; }
        }
      } catch (e) {}
    };
    add(SHEETS.ITEM_MASTER, ['ITEM_ID', 'ITEM_CODE'], ['ITEM_NAME', 'NAME']);
    add(SHEETS.RAW_MATERIAL_MASTER, ['ITEM_CODE', 'RAW_MATERIAL_ID', 'ITEM_ID'], ['ITEM_NAME', 'MATERIAL_NAME', 'NAME']);
    BNX71_INV_IDX_[clientId] = idx;
  }
  const id = String(itemId || '').trim(), supplied = String(itemName || '').trim();
  if (id && idx.ids[id]) { const nm = supplied || idx.ids[id].name; if (nm) return { itemId: id, itemName: nm, source: idx.ids[id].source }; }
  const nk = supplied.toLowerCase().replace(/\s+/g, ' ');
  if (!nk || !idx.names[nk]) return null;
  const hits = Object.keys(idx.names[nk]);
  return hits.length === 1 ? idx.names[nk][hits[0]] : null;
}

/* ============================================================================
 * DSR ENGINE — one pass over BILL_MASTER / PAYMENT_MASTER / BILL_ITEMS /
 * DUES_RECEIPT for any date range. Contract kept for dsr-client.html.
 * ========================================================================== */
function bnx71DsrMode_(raw) {
  const x = String(raw || '').trim().toUpperCase().replace(/[\s_-]+/g, ' ');
  if (!x) return 'OTHER';
  if (x === 'CASH' || x === 'CASH PAYMENT' || x === 'CASH SALES') return 'CASH';
  if (/^(UPI|GPAY|G PAY|GOOGLE PAY|PHONEPE|PHONE PE|PAYTM|BHIM|QR|ICICI GPAY)$/.test(x)) return 'UPI';
  if (/^(CARD|CREDIT CARD|DEBIT CARD|BANK|BANK TRANSFER|NEFT|RTGS|IMPS|ICICI CARD)$/.test(x)) return 'CARD';
  if (/ZOMATO/.test(x)) return 'ZOMATO';
  if (/SWIGGY/.test(x)) return 'SWIGGY';
  if (/^(ONLINE|ONLINE COLLECTION|EAZY DINE ONLINE|EAZYDINE|EAZY DINE|ONDC|MAGICPIN|AGGREGATOR)$/.test(x)) return 'ONLINE';
  if (x === 'CREDIT' || x === 'DUE' || x === 'CREDIT SALES' || x === 'HOUSE ACCOUNT') return 'CREDIT';
  return 'OTHER';
}
function bnx71DsrBlank_() {
  return { bills: 0, ncBills: 0, covers: 0, liquor: 0, liquorMrp: 0, food: 0, beverage: 0, hashFreezer: 0, others: 0,
    grossSale: 0, tax: 0, roundOff: 0, netSale: 0, discount: 0, cash: 0, iciciCard: 0, iciciGpay: 0, zomato: 0, swiggy: 0,
    online: 0, other: 0, guestDueSales: 0, dueReceivedCash: 0, dueReceivedIcici: 0, totalCashCollection: 0, guestDuesCN: 0,
    unallocatedPaid: 0, pvt: 0 };
}
function bnx71DateList_(from, to) {
  const out = [];
  const p = from.split('-').map(Number), q = to.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]), end = new Date(q[0], q[1] - 1, q[2]);
  let guard = 0;
  while (d <= end && guard++ < 400) {
    out.push(d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
function bnx71DsrBuildRange_(clientId, from, to) {
  const days = {};
  bnx71DateList_(from, to).forEach(function (k) { days[k] = bnx71DsrBlank_(); });
  const DUE_SET = { DUE: 1, PARTIAL: 1, PENDING: 1, CREDIT: 1, UNPAID: 1 };

  /* 1) bills */
  const bv = bnxClientSheet(clientId, SHEETS.BILL_MASTER).getDataRange().getValues(), bx = bnx71Idx_(bv[0] || []);
  const billDate = {}, cancelled = {}, inRange = {};
  for (let r = 1; r < bv.length; r++) {
    const row = bv[r];
    if (String(row[bx.CLIENT_ID] || '') !== String(clientId)) continue;
    const id = String(row[bx.BILL_ID] || ''); if (!id) continue;
    const st = String(row[bx.BILL_STATUS] || '').toUpperCase();
    if (st === 'CANCELLED' || st === 'VOID') { cancelled[id] = 1; continue; }
    const dk = bnxNormalizeDateKey_(row[bx.BILL_DATE]);
    billDate[id] = dk;
    const d = days[dk]; if (!d) continue;
    const grand = bnx71Num_(row[bx.GRAND_TOTAL]), tax = bnx71Num_(row[bx.TAX_AMOUNT]), rnd = bnx71Num_(row[bx.ROUND_OFF]);
    /* A real round-off is never more than ±1 rupee. Imported rows stored the
       whole un-split residual in ROUND_OFF; that belongs in gross, not round. */
    const realRound = Math.abs(rnd) <= 1 ? rnd : 0;
    d.bills++;
    if (st === 'NON_CHARGE' || grand === 0) d.ncBills++;
    d.covers += bnx71Num_(row[bx.COVERS]);
    d.netSale += grand; d.tax += tax; d.roundOff += realRound; d.grossSale += grand - tax - realRound;
    d.discount += bnx71Num_(row[bx.BILL_DISCOUNT]) + bnx71Num_(row[bx.ITEM_DISCOUNT]);
    inRange[id] = { dk: dk, grand: grand, pay: String(row[bx.PAYMENT_STATUS] || '').toUpperCase(),
      due: bx.DUE_AMOUNT !== undefined ? bnx71Num_(row[bx.DUE_AMOUNT]) : 0, sameDay: 0, late: false, any: false };
  }

  /* 2) payments: same-day = sales collection by mode, later = due received */
  try {
    const pv = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER).getDataRange().getValues(), px = bnx71Idx_(pv[0] || []);
    for (let r = 1; r < pv.length; r++) {
      const row = pv[r];
      if (String(row[px.CLIENT_ID] || '') !== String(clientId)) continue;
      if (!bnx71PaymentActive_(row[px.PAYMENT_STATUS])) continue;
      const bid = String(row[px.BILL_ID] || '');
      if (bid && cancelled[bid]) continue;
      const mode = bnx71DsrMode_(row[px.PAYMENT_MODE]);
      if (mode === 'CREDIT') continue;
      const amt = bnx71Num_(row[px.AMOUNT]); if (!amt) continue;
      const pdk = bnxNormalizeDateKey_(row[px.PAYMENT_DATE]);
      const bdk = bid ? billDate[bid] : '';
      const isLate = !!(bdk && pdk && pdk > bdk);
      const b = bid ? inRange[bid] : null;
      if (b) { b.any = true; if (isLate) b.late = true; else b.sameDay += amt; }
      const d = days[pdk]; if (!d) continue;
      if (isLate) { if (mode === 'CASH') d.dueReceivedCash += amt; else d.dueReceivedIcici += amt; continue; }
      if (mode === 'CASH') d.cash += amt;
      else if (mode === 'UPI') d.iciciGpay += amt;
      else if (mode === 'CARD') d.iciciCard += amt;
      else if (mode === 'ZOMATO') d.zomato += amt;
      else if (mode === 'SWIGGY') d.swiggy += amt;
      else if (mode === 'ONLINE') d.online += amt;
      else d.other += amt;
    }
  } catch (e) { console.warn('[DSR] payments: ' + e.message); }

  /* 3) credit (guest due) on the bill date + historic PAID bills with no payment rows */
  Object.keys(inRange).forEach(function (id) {
    const b = inRange[id], d = days[b.dk];
    if (!d || b.grand <= 0) return;
    if (!b.any) {
      if (DUE_SET[b.pay]) d.guestDueSales += (b.due > 0 ? Math.min(b.due, b.grand) : b.grand);
      else if (b.pay === 'PAID') d.unallocatedPaid += b.grand;
      return;
    }
    if (DUE_SET[b.pay] || b.late) d.guestDueSales += Math.max(0, b.grand - b.sameDay);
  });

  /* 4) category split from BILL_ITEMS (group name is authoritative) */
  try {
    const meta = bnx71ItemMeta_(clientId);
    const iv = bnxClientSheet(clientId, SHEETS.BILL_ITEMS).getDataRange().getValues(), ix = bnx71Idx_(iv[0] || []);
    const g = function (row, n) { return ix[n] === undefined ? '' : row[ix[n]]; };
    for (let r = 1; r < iv.length; r++) {
      const row = iv[r];
      const b = inRange[String(g(row, 'BILL_ID'))]; if (!b) continue;
      const d = days[b.dk]; if (!d) continue;
      const amt = bnx71Num_(g(row, 'LINE_TOTAL')); if (!amt) continue;
      const cls = bnx71ClassifyLine_(meta, String(g(row, 'ITEM_ID') || '').trim(), String(g(row, 'ITEM_NAME') || ''),
        String(g(row, 'ITEM_GROUP_NAME') || ''), String(g(row, 'ITEM_GROUP_ID') || ''), String(g(row, 'CATEGORY') || ''));
      d[cls] += amt;
    }
  } catch (e) { console.warn('[DSR] items: ' + e.message); }

  /* 5) customer-level due receipts */
  try {
    const dv = bnxClientSheet(clientId, SHEETS.DUES_RECEIPT).getDataRange().getValues(), dx = bnx71Idx_(dv[0] || []);
    for (let r = 1; r < dv.length; r++) {
      if (String(dv[r][dx.CLIENT_ID] || '') !== String(clientId)) continue;
      const d = days[bnxNormalizeDateKey_(dv[r][dx.RECEIPT_DATE])]; if (!d) continue;
      if (dx.STATUS !== undefined && /^(CANCELLED|VOID)$/i.test(String(dv[r][dx.STATUS] || ''))) continue;
      /* PASS #72: the part allocated to bills is already a PAYMENT_MASTER row (counted
         above as due received) — only the opening/advance remainder is new money here. */
      const amt = bnx71Num_(dv[r][dx.AMOUNT]) - (dx.ALLOCATED_AMOUNT !== undefined ? bnx71Num_(dv[r][dx.ALLOCATED_AMOUNT]) : 0);
      if (amt <= 0.009) continue;
      if (bnx71DsrMode_(dv[r][dx.PAYMENT_MODE]) === 'CASH') d.dueReceivedCash += amt; else d.dueReceivedIcici += amt;
    }
  } catch (e) {}

  Object.keys(days).forEach(function (k) {
    const d = days[k];
    d.totalCashCollection = d.cash + d.dueReceivedCash;
    Object.keys(d).forEach(function (f) { d[f] = bnx71R2_(d[f]); });
  });
  return days;
}
function bnx71DsrRangeCached_(clientId, from, to) {
  return bnxCachedReport_('dsr71|' + clientId + '|' + from + '|' + to, 300, function () {
    return { success: true, data: { byDate: bnx71DsrBuildRange_(clientId, from, to), from: from, to: to } };
  });
}
function bnx71GetDsrRange(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const r = bnxResolveDateRange_({ range: 'custom', from: payload.from || payload.FROM_DATE, to: payload.to || payload.TO_DATE });
    if (bnx71DateList_(r.from, r.to).length > 400) return { success: false, error: 'DSR range is limited to 400 days' };
    const res = bnx71DsrRangeCached_(clientId, r.from, r.to);
    return res;
  } catch (e) {
    bnxLogError(clientId, 'GET_DSR_RANGE failed: ' + e.message, payload || {});
    return { success: false, error: e.message };
  }
}
/* GET_DSR_MATRIX — same response shape ({byDay:{'01':{...}}}), now correct + fast. */
function bnxGetDsrMatrix(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const y = Number(payload.year), m = Number(payload.month);
    if (!(y > 2000) || !(m >= 1 && m <= 12)) return { success: false, error: 'year and month are required' };
    const mm = ('0' + m).slice(-2), last = new Date(y, m, 0).getDate();
    const from = y + '-' + mm + '-01', to = y + '-' + mm + '-' + ('0' + last).slice(-2);
    const res = bnx71DsrRangeCached_(clientId, from, to);
    if (!res.success) return res;
    const byDay = {};
    Object.keys(res.data.byDate).forEach(function (k) { byDay[k.slice(-2)] = res.data.byDate[k]; });
    return { success: true, data: { byDay: byDay, from: from, to: to } };
  } catch (e) {
    bnxLogError(clientId, 'bnxGetDsrMatrix failed: ' + e.message, payload || {});
    return { success: false, error: e.message };
  }
}
/* GET_DSR_YTD — Indian FY (1 Apr → asOfDate) unless payload.from is given. */
function bnxGetDsrYtd(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const asOf = String(payload.asOfDate || bnxBusinessDateKey_(new Date())).slice(0, 10);
    const y = Number(asOf.slice(0, 4)), m = Number(asOf.slice(5, 7));
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.from || '')) ? payload.from : ((m >= 4 ? y : y - 1) + '-04-01');
    const res = bnx71DsrRangeCached_(clientId, from, asOf);
    if (!res.success) return res;
    const totals = bnx71DsrBlank_();
    Object.keys(res.data.byDate).forEach(function (k) { const d = res.data.byDate[k]; Object.keys(totals).forEach(function (f) { totals[f] += Number(d[f]) || 0; }); });
    Object.keys(totals).forEach(function (f) { totals[f] = bnx71R2_(totals[f]); });
    return { success: true, data: totals, from: from, to: asOf };
  } catch (e) {
    bnxLogError(clientId, 'bnxGetDsrYtd failed: ' + e.message, payload || {});
    return { success: false, error: e.message };
  }
}


/* ============================================================================
 * LEDGER — balanced by construction (root cause of every SAVE_BILL failure)
 * ========================================================================== */
function bnx71BillJournalLines_(clientId, bill, paid) {
  const taxable = bnx71R2_(bill.TAXABLE_AMOUNT);
  const tax = bnx71R2_(bill.TAX_AMOUNT);
  const discount = bnx71R2_(bnx71Num_(bill.BILL_DISCOUNT) + bnx71Num_(bill.ITEM_DISCOUNT));
  const grand = bnx71R2_(bill.GRAND_TOTAL);
  /* TAXABLE_AMOUNT is already AFTER discount. Sales is credited GROSS
     (taxable + discount) and the discount debited once — the old code
     credited the net figure AND debited the discount, double-counting it. */
  const grossSales = bnx71R2_(taxable + discount);
  const roundOff = bnx71R2_(grand - (grossSales - discount + tax)); // balancing figure
  const acct = {
    sales: bnxGetOrCreateLedgerAccount_(clientId, 'SALES', 'Sales', 'INCOME'),
    gst: bnxGetOrCreateLedgerAccount_(clientId, 'GST_OUTPUT', 'GST Output', 'LIABILITY'),
    disc: bnxGetOrCreateLedgerAccount_(clientId, 'DISCOUNT_GIVEN', 'Discount Given', 'EXPENSE'),
    round: bnxGetOrCreateLedgerAccount_(clientId, 'ROUND_OFF', 'Round Off', 'INCOME'),
    cash: bnxGetOrCreateLedgerAccount_(clientId, 'CASH', 'Cash', 'ASSET'),
    dues: bnxGetOrCreateLedgerAccount_(clientId, 'CUSTOMER_DUES', 'Customer Dues', 'ASSET')
  };
  const lines = [];
  if (grossSales) lines.push({ ACCOUNT: acct.sales, DR: 0, CR: grossSales });
  if (tax) lines.push({ ACCOUNT: acct.gst, DR: 0, CR: tax });
  if (discount) lines.push({ ACCOUNT: acct.disc, DR: discount, CR: 0 });
  if (roundOff > 0) lines.push({ ACCOUNT: acct.round, DR: 0, CR: roundOff });
  else if (roundOff < 0) lines.push({ ACCOUNT: acct.round, DR: -roundOff, CR: 0 });
  if (grand) lines.push({ ACCOUNT: paid ? acct.cash : acct.dues, DR: grand, CR: 0 });
  const dr = bnx71R2_(lines.reduce(function (s, l) { return s + l.DR; }, 0));
  const cr = bnx71R2_(lines.reduce(function (s, l) { return s + l.CR; }, 0));
  if (Math.abs(dr - cr) > 0.01) throw new Error('Bill ledger is not balanced: DR ₹' + dr.toFixed(2) + ' / CR ₹' + cr.toFixed(2));
  if (Math.abs(roundOff) > 1) console.warn('[BNX71] large round-off ' + roundOff + ' on bill ' + bill.BILL_NUMBER);
  return { lines: lines, dr: dr, cr: cr };
}
function bnxPostBillToLedger_(clientId, bill, isPaid) {
  const j = bnx71BillJournalLines_(clientId, bill, isPaid);
  const journalId = generateShortId_(clientId, 'JOURNAL_ID');
  const now = new Date().toISOString();
  bnxAppendRow(clientId, SHEETS.JOURNAL, {
    JOURNAL_ID: journalId, CLIENT_ID: clientId, LOCATION_ID: bill.LOCATION_ID || '', JOURNAL_DATE: bill.BILL_DATE, JOURNAL_TYPE: 'SALES',
    SOURCE_TYPE: 'BILL', SOURCE_ID: bill.BILL_ID, REFERENCE_NUMBER: bill.BILL_NUMBER, DESCRIPTION: 'Sale - Bill ' + bill.BILL_NUMBER,
    TOTAL_DEBIT: j.dr, TOTAL_CREDIT: j.cr, CREATED_BY: bill.CREATED_BY || '', CREATED_AT: now,
    ENTRY_DATE: bill.BILL_DATE, REFERENCE_TYPE: 'BILL', REFERENCE_ID: bill.BILL_ID, NARRATION: 'Sale - Bill ' + bill.BILL_NUMBER
  });
  bnxAppendRowsBatch_(clientId, SHEETS.LEDGER_ENTRIES, j.lines.map(function (l) {
    return { LEDGER_ENTRY_ID: generateShortId_(clientId, 'LEDGER_ENTRY_ID'), CLIENT_ID: clientId, JOURNAL_ID: journalId, LOCATION_ID: bill.LOCATION_ID || '',
      ACCOUNT: l.ACCOUNT, LEDGER_ID: l.ACCOUNT, ENTRY_DATE: bill.BILL_DATE, DEBIT: bnx71R2_(l.DR), CREDIT: bnx71R2_(l.CR),
      DESCRIPTION: 'Bill ' + bill.BILL_NUMBER, REFERENCE_TYPE: 'BILL', REFERENCE_ID: bill.BILL_ID, CREATED_AT: now };
  }));
  return journalId;
}

/* ============================================================================
 * SAVE_BILL — validated before any write, split payments, BILL_ITEMS meta,
 * ledger failure can no longer produce a duplicate retry bill.
 * ========================================================================== */
function bnxSaveBill(session, payload) {
  const requestId = payload.requestId;
  const bill = payload.bill || {};
  const clientId = session.CLIENT_ID;
  const userId = session.USER_ID;
  /* PASS #72: the steward dropdown's "+ Add New…" sentinel was being saved as the biller */
  bill.waiter = bnx72CleanUser_(bill.waiter, '');
  const claim = bnxClaimRequest(clientId, requestId, TRANSACTION_TYPES.BILL);
  if (!claim.claimed) {
    const existingId = claim.existing && claim.existing.transactionId;
    const existingBill = existingId ? bnxFindBillById_(clientId, existingId) : null;
    return { success: true, transactionId: existingId || '', data: existingBill || undefined, message: 'Duplicate request detected — existing bill reused', cached: true };
  }
  const validation = bnxValidateBill(bill);
  if (!validation.valid) return respondError(400, validation.errors.join('; '), requestId);
  /* PASS #72: same bill content re-sent within 60 s under a NEW requestId (client
     retry after a timeout) used to mint a second invoice (BIL03855/BIL03856). */
  const fpKey = bnx72BillFingerprint_(clientId, bill);
  if (payload.allowDuplicate !== true) {
    try {
      const prevId = CacheService.getScriptCache().get(fpKey);
      if (prevId) {
        const prev = bnxFindBillById_(clientId, prevId);
        if (prev) { try { bnxMarkSynced(clientId, requestId, prevId, TRANSACTION_TYPES.BILL); } catch (e) {}
          return { success: true, transactionId: prevId, data: prev, cached: true, duplicateContent: true, message: 'Identical bill was saved seconds ago — existing invoice reused.' }; }
      }
    } catch (e) {}
  }
  try {
    const locationId = payload.locationId || payload.LOCATION_ID || '';
    if (!bill.orderId && bill.orderNo) bill.orderId = bnxResolveOrderIdByRef_(clientId, bill.orderNo, locationId);
    if (!bill.orderId && bill.ORDER_ID) bill.orderId = String(bill.ORDER_ID);
    /* PASS #72: dashboard bills never carried ORDER_ID → table stayed "occupied"
       and duplicate-order protection could not work. Link the table's single open order. */
    if (!bill.orderId && bill.table && payload.allowSplitBill !== true && bill.allowSplitBill !== true) {
      try { const oo = bnx72OpenOrderForTable_(clientId, bill.table); if (oo) bill.orderId = oo.orderId; } catch (e) {}
    }
    const allowSplitBill = payload.allowSplitBill === true || bill.allowSplitBill === true || payload.SPLIT_BILL === true;
    if (!allowSplitBill && bill.orderId) {
      const existingOrderBill = bnxFindFinalizedBillByOrder_(clientId, bill.orderId, locationId);
      if (existingOrderBill) {
        try { bnxMarkSynced(clientId, requestId, existingOrderBill.BILL_ID, TRANSACTION_TYPES.BILL); } catch (e) {}
        return { success: true, transactionId: existingOrderBill.BILL_ID, data: existingOrderBill, cached: true, duplicateOrder: true, message: 'Order is already billed — existing confirmed invoice reused.' };
      }
    }
    const clientDt = bnxResolveClientDateTime_(bill.billDate || bill.dt || bill.date || '', bill.billTime || bill.tm || bill.time || '');
    const wallClockNow = bnxNowParts_();
    const now = clientDt || { businessDate: bnxBusinessDateKey_(new Date()), time: wallClockNow.time };
    const subtotal = Number(bill.sub) || 0;
    const tax = Number(bill.gst) || 0;
    const total = Number(bill.total) || (subtotal + tax);
    const billDiscount = Math.max(0, Number(bill.disc) || 0);
    const taxableAfterDiscount = Math.max(0, +(subtotal - billDiscount).toFixed(2));

    /* Split payment lines (frontend bill.payments). Used only when they add up
       to this bill's total — stale lines from a previous bill are ignored. */
    let payLines = [];
    if (Array.isArray(bill.payments) && bill.payments.length) {
      const lines = bill.payments.map(function (x) { return { mode: String(x.mode || x.PAYMENT_MODE || '').trim().toUpperCase(), amount: bnx71R2_(x.amount != null ? x.amount : x.AMOUNT) }; })
        .filter(function (x) { return x.mode && x.amount > 0; });
      const sum = lines.reduce(function (s, x) { return s + x.amount; }, 0);
      if (lines.length && Math.abs(sum - total) <= 1) payLines = lines;
    }
    let isPaid, dueAmount, collect;
    if (payLines.length) {
      collect = payLines.filter(function (x) { return !/^(CREDIT|DUE)$/.test(x.mode); });
      const paidSum = Math.min(total, collect.reduce(function (s, x) { return s + x.amount; }, 0));
      dueAmount = bnx71R2_(Math.max(0, total - paidSum));
      isPaid = dueAmount <= 0.01;
      if (isPaid) dueAmount = 0;
    } else {
      isPaid = !/^pending$/i.test(bill.status || '');
      dueAmount = isPaid ? 0 : total;
      collect = isPaid && total > 0 ? [{ mode: String(bill.pay || 'CASH').toUpperCase(), amount: total }] : [];
    }
    let customerId = '';
    if (!isPaid && (bill.customer || bill.mob)) customerId = bnxResolveCustomerId_(clientId, bill.customer, bill.mob);
    const salesChannel = bnxNormalizeSalesChannel_(bill.salesChannel || bill.orderSource || bill.billType || bill.orderType || bill.ORDER_TYPE || 'DINEIN', bill.billType, bill.orderType);
    const serviceCharge = bnxResolveServiceCharge_(bill);
    const aggregatorOrderId = String(bill.aggregatorOrderId || bill.platformOrderId || bill.externalOrderId || '').trim();
    const billId = generateShortId_(clientId, 'BILL_ID');
    const billMaster = {
      BILL_ID: billId, CLIENT_ID: clientId, LOCATION_ID: locationId, ORDER_ID: bill.orderId || '',
      COUNTER_CODE: bnxNormalizeCounterCode_(bill.counterCode || payload.counterCode || 'C1'),
      BILL_NUMBER: bnxGenerateChannelInvoiceNumber_(clientId, locationId, bill.salesChannel || bill.orderSource || bill.billType || bill.orderType || bill.ORDER_TYPE || 'DINEIN'),
      BILL_DATE: now.businessDate, BILL_TIME: now.time, TABLE_ID: bill.table || '', CUSTOMER_ID: customerId, CUSTOMER_NAME: bill.customer || 'Walk-in',
      BILL_TYPE: String(bill.billType || bill.BILL_TYPE || bill.orderType || bill.ORDER_TYPE || (bill.table ? 'DINEIN' : 'TAKEAWAY')).toUpperCase(),
      SALES_CHANNEL: salesChannel, ORDER_SOURCE: salesChannel, AGGREGATOR: (salesChannel === 'ZOMATO' || salesChannel === 'SWIGGY') ? salesChannel : '',
      AGGREGATOR_ORDER_ID: aggregatorOrderId, SERVICE_CHARGE_PCT: serviceCharge.pct, SERVICE_CHARGE_AMOUNT: serviceCharge.amount,
      SERVICE_CHARGE_GST_APPLICABLE: serviceCharge.gstApplicable ? 'YES' : 'NO', SERVICE_CHARGE_GST_PCT: serviceCharge.gstPct, SERVICE_CHARGE_GST_AMOUNT: serviceCharge.gst,
      COVERS: Number(bill.covers || bill.COVERS || bill.pax || bill.PAX || 1) || 1, SUBTOTAL: subtotal, ITEM_DISCOUNT: 0,
      SUBTOTAL_AFTER_ITEM_DISCOUNT: subtotal, BILL_DISCOUNT: billDiscount, TAXABLE_AMOUNT: taxableAfterDiscount,
      TAX_RATE: taxableAfterDiscount > 0 ? +(tax / taxableAfterDiscount).toFixed(4) : 0, TAX_AMOUNT: +tax.toFixed(2),
      ROUND_OFF: +(total - (taxableAfterDiscount + tax)).toFixed(2), GRAND_TOTAL: total,
      DUE_AMOUNT: dueAmount, BILL_STATUS: 'FINALIZED', PAYMENT_STATUS: isPaid ? 'PAID' : (dueAmount < total ? 'PARTIAL' : 'DUE'),
      GST_BREAKUP: JSON.stringify((bill.gstBreakup && typeof bill.gstBreakup === 'object') ? bill.gstBreakup : { SGST: Number(bill.sgst != null ? bill.sgst : tax / 2) || 0, CGST: Number(bill.cgst != null ? bill.cgst : tax / 2) || 0, IGST: Number(bill.igst || 0) || 0, LINES: Array.isArray(bill.taxRows) ? bill.taxRows : [] }),
      NOTES: bill.mob ? ('Customer mobile: ' + bill.mob) : '', CREATED_BY: bill.waiter || userId, CREATED_AT: wallClockNow.iso,
      FINALIZED_BY: bill.waiter || userId, FINALIZED_AT: wallClockNow.iso, PAID_AT: isPaid ? wallClockNow.iso : '',
      NC_REASON: bill.ncReason || '', NC_APPROVED_BY: bill.ncApprovedBy || ''
    };
    /* Validate the journal BEFORE writing anything (no orphan bill on failure). */
    const partial = !isPaid && collect.length > 0;
    bnx71BillJournalLines_(clientId, billMaster, isPaid);

    bnxAppendRow(clientId, SHEETS.BILL_MASTER, billMaster);
    const itemNameMap = bnxCachedItemNameMap_(clientId);
    const itemCostMap = bnxCachedItemCostMap_(clientId);
    const meta = bnx71ItemMeta_(clientId);
    const billItemRows = [], stockRows = [];
    (bill.itemsDetail || []).forEach(function (item, idx) {
      const qty = item.qty || 0, rate = item.rate || 0;
      const lineTotal = item.amt != null ? item.amt : qty * rate;
      const resolvedItemId = String(item.ITEM_ID || item.itemId || '').trim() || itemNameMap[String(item.name || '').toLowerCase().trim()] || '';
      const m = resolvedItemId ? (meta.byId[resolvedItemId] || {}) : {};
      const lineTaxRate = (item.taxRate != null && item.taxRate !== '') ? Number(item.taxRate) : billMaster.TAX_RATE;
      billItemRows.push({
        BILL_ITEM_ID: generateShortId_(clientId, 'BILL_ITEM_ID'), BILL_ID: billId, ORDER_ITEM_ID: '', ITEM_ID: resolvedItemId,
        SEQUENCE: idx + 1, ITEM_NAME: item.name || '', ITEM_CODE: item.itemCode || item.ITEM_CODE || '',
        CATEGORY: String(item.category || item.CATEGORY || m.cn || '').trim(),
        ITEM_GROUP_ID: String(item.itemGroupId || item.ITEM_GROUP_ID || m.g || '').trim(),
        ITEM_GROUP_NAME: String(item.itemGroupName || item.ITEM_GROUP_NAME || m.gn || (m.b ? 'LIQUOR' : '')).trim(),
        QUANTITY: qty, UNIT_ID: 'PIECE', RATE: rate,
        LINE_DISCOUNT: Number(item.discount || item.LINE_DISCOUNT || 0) || 0, DISCOUNTED_RATE: Number(item.discountedRate || item.DISCOUNTED_RATE || rate) || rate,
        TAXABLE_PER_ITEM: lineTotal, TAX_RATE: lineTaxRate, TAX_PER_ITEM: +(lineTotal * lineTaxRate).toFixed(2), LINE_TOTAL: lineTotal, CREATED_AT: wallClockNow.iso
      });
      stockRows.push({
        STOCK_MOVEMENT_ID: generateShortId_(clientId, 'STOCK_MOVEMENT_ID'), CLIENT_ID: clientId, LOCATION_ID: locationId, ITEM_ID: resolvedItemId,
        MOVEMENT_TYPE: 'SALE', MOVEMENT_DATE: now.businessDate, QUANTITY_IN: 0, QUANTITY_OUT: qty,
        RATE: resolvedItemId ? Number(itemCostMap[resolvedItemId] || 0) : 0, SOURCE_TYPE: 'BILL', SOURCE_ID: billId,
        CREATED_BY: bill.waiter || userId, CREATED_AT: wallClockNow.iso
      });
    });
    bnxAppendRowsBatch_(clientId, SHEETS.BILL_ITEMS, billItemRows);
    const paymentRows = collect.map(function (x, i) {
      return { PAYMENT_ID: generateShortId_(clientId, 'PAYMENT_ID'), CLIENT_ID: clientId, LOCATION_ID: locationId, BILL_ID: billId, CUSTOMER_ID: customerId,
        PAYMENT_MODE_ID: '', PAYMENT_MODE: x.mode, AMOUNT: x.amount, PAYMENT_DATE: now.businessDate, PAYMENT_TIME: now.time, REFERENCE: '',
        PAYMENT_STATUS: 'SUCCESS', CREATED_BY: bill.waiter || userId, CREATED_AT: wallClockNow.iso, TIPS_AMOUNT: i === 0 ? (Number(bill.tips) || 0) : 0 };
    });
    bnxAppendRowsBatch_(clientId, SHEETS.PAYMENT_MASTER, paymentRows);
    if (!isPaid && customerId && dueAmount > 0) bnxUpsertCustomerDue_(clientId, customerId, dueAmount, now.businessDate, 'BILL');
    bnxAppendRowsBatch_(clientId, SHEETS.STOCK_MOVEMENT, stockRows);
    bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, LOCATION_ID: locationId, USER_ID: userId, ACTION: 'CREATE', MODULE: 'POS', RECORD_TYPE: 'BILL', RECORD_ID: billId, OLD_VALUE: '{}', NEW_VALUE: JSON.stringify(billMaster), REQUEST_ID: requestId, TIMESTAMP: wallClockNow.iso });

    /* The invoice now exists. Mark it synced FIRST so a retry can never mint a
       second bill; a ledger problem is logged for repair, not thrown. */
    bnxMarkSynced(clientId, requestId, billId, TRANSACTION_TYPES.BILL);
    let ledgerWarning = '';
    try {
      bnxPostBillToLedger_(clientId, billMaster, isPaid);
      if (partial) paymentRows.forEach(function (p) { bnxPostPaymentToLedger_(clientId, p, billMaster); });
    } catch (le) {
      ledgerWarning = le.message;
      bnxLogError(clientId, 'LEDGER_POST_PENDING bill ' + billMaster.BILL_NUMBER + ': ' + le.message, { billId: billId });
    }
    if (billMaster.ORDER_ID) bnx72MarkOrderBilled_(clientId, billMaster.ORDER_ID, billMaster.BILL_NUMBER);
    try { CacheService.getScriptCache().put(fpKey, billId, 60); } catch (e) {}
    bnxInvalidateTodayReportCaches_(clientId);
    const out = { success: true, transactionId: billId, data: billMaster, payments: paymentRows.length };
    if (ledgerWarning) out.ledgerWarning = ledgerWarning;
    return out;
  } catch (error) {
    bnxLogError(clientId, 'bnxSaveBill failed: ' + error.message, { requestId: requestId, bill: bill });
    return respondError(500, error.message, requestId);
  }
}

/* ============================================================================
 * PAYMENTS — PAID and SUCCESS are both live; balance from DUE_AMOUNT
 * ========================================================================== */
function bnxGetSuccessfulPaymentsForBill_(clientId, billId) {
  const out = [];
  const sh = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER), vals = sh.getDataRange().getValues(), h = vals[0] || [];
  for (let r = 1; r < vals.length; r++) {
    const p = bnxRowToObject(vals[r], h);
    if (String(p.CLIENT_ID || '') !== String(clientId)) continue;
    if (String(p.BILL_ID || '') !== String(billId)) continue;
    if (bnx71PaymentActive_(p.PAYMENT_STATUS)) out.push(p);
  }
  return out;
}
function bnx71ApplyBillPayments_(session, found, lines, opts) {
  opts = opts || {};
  const clientId = session.CLIENT_ID, userId = session.USER_ID;
  const bill = found.bill;
  const st = String(bill.BILL_STATUS || '').toUpperCase();
  if (st === 'CANCELLED' || st === 'VOID') return { success: false, error: 'Cannot collect payment on a cancelled/void bill' };
  const grand = bnx71R2_(bill.GRAND_TOTAL);
  let outstanding = String(bill.DUE_AMOUNT).trim() !== '' ? bnx71R2_(bill.DUE_AMOUNT) : null;
  if (outstanding === null) {
    const paidBefore = bnxGetSuccessfulPaymentsForBill_(clientId, bill.BILL_ID).reduce(function (s, p) { return s + bnx71Num_(p.AMOUNT); }, 0);
    outstanding = bnx71R2_(Math.max(0, grand - paidBefore));
  }
  const clean = (lines || []).map(function (x) { return { mode: String(x.mode || x.PAYMENT_MODE || 'CASH').trim().toUpperCase(), amount: bnx71R2_(x.amount != null ? x.amount : x.AMOUNT), ref: String(x.reference || x.REFERENCE || '') }; })
    .filter(function (x) { return x.amount > 0 && !/^(CREDIT|DUE)$/.test(x.mode); });
  if (!clean.length) return { success: false, error: 'At least one payment line with amount > 0 is required' };
  if (outstanding <= 0.01) return { success: true, alreadySettled: true, billId: bill.BILL_ID, dueAmount: 0 };
  const total = bnx71R2_(clean.reduce(function (s, x) { return s + x.amount; }, 0));
  if (total > outstanding + 0.01) return { success: false, error: 'Payment ₹' + total.toFixed(2) + ' exceeds bill balance ₹' + outstanding.toFixed(2) };
  const now = bnxNowParts_();
  const rows = clean.map(function (x) {
    return { PAYMENT_ID: generateShortId_(clientId, 'PAYMENT_ID'), CLIENT_ID: clientId, LOCATION_ID: bill.LOCATION_ID || '', BILL_ID: bill.BILL_ID,
      CUSTOMER_ID: bill.CUSTOMER_ID || '', PAYMENT_MODE_ID: '', PAYMENT_MODE: x.mode, AMOUNT: x.amount, PAYMENT_DATE: now.businessDate,
      PAYMENT_TIME: now.time, REFERENCE: x.ref || opts.reference || '', PAYMENT_STATUS: 'SUCCESS', CREATED_BY: userId, CREATED_AT: now.iso, TIPS_AMOUNT: Number(opts.tips) || 0 };
  });
  bnxAppendRowsBatch_(clientId, SHEETS.PAYMENT_MASTER, rows);
  const newDue = bnx71R2_(Math.max(0, outstanding - total));
  const h = found.headers, set = function (n, v) { const c = h.indexOf(n); if (c !== -1) found.sheet.getRange(found.rowNo, c + 1).setValue(v); };
  set('DUE_AMOUNT', newDue);
  set('PAYMENT_STATUS', newDue <= 0.01 ? 'PAID' : 'PARTIAL');
  if (newDue <= 0.01) set('PAID_AT', now.iso);
  if (bill.CUSTOMER_ID) bnxAdjustCustomerDue_(clientId, bill.CUSTOMER_ID, -total, now.businessDate, 'PAYMENT');
  let ledgerWarning = '';
  rows.forEach(function (p) { try { bnxPostPaymentToLedger_(clientId, p, bill); } catch (e) { ledgerWarning = e.message; } });
  bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, LOCATION_ID: bill.LOCATION_ID || '', USER_ID: userId, ACTION: opts.action || 'SETTLE', MODULE: 'PAYMENT',
    RECORD_TYPE: 'BILL', RECORD_ID: bill.BILL_ID, OLD_VALUE: JSON.stringify({ DUE_AMOUNT: outstanding }), NEW_VALUE: JSON.stringify({ DUE_AMOUNT: newDue, payments: clean }),
    REQUEST_ID: opts.requestId || '', TIMESTAMP: now.iso });
  bnxInvalidateTodayReportCaches_(clientId);
  const out = { success: true, billId: bill.BILL_ID, billNumber: bill.BILL_NUMBER, paid: total, dueAmount: newDue, paymentIds: rows.map(function (r) { return r.PAYMENT_ID; }), transactionId: rows[0].PAYMENT_ID };
  if (ledgerWarning) out.ledgerWarning = ledgerWarning;
  return out;
}
function bnxSavePayment(session, payload) {
  const requestId = payload.requestId;
  const data = payload.data || {};
  const clientId = session.CLIENT_ID;
  const claim = bnxClaimRequest(clientId, requestId, TRANSACTION_TYPES.PAYMENT);
  if (!claim.claimed) return { success: true, transactionId: claim.existing.transactionId, cached: true };
  if (!(Number(data.AMOUNT) > 0)) return respondError(400, 'AMOUNT must be > 0', requestId);
  if (!data.BILL_ID) return respondError(400, 'BILL_ID is required for a payment', requestId);
  const lock = bnxAcquireScriptLockWithRetry_(3, 10000);
  try {
    const found = bnxFindBillRowByIdFast_(clientId, data.BILL_ID);
    if (!found) return respondError(404, 'Bill not found for this client', requestId);
    const res = bnx71ApplyBillPayments_(session, found, [{ mode: data.PAYMENT_MODE || 'CASH', amount: data.AMOUNT, reference: data.PAYMENT_REFERENCE || '' }],
      { action: 'CREATE', tips: data.TIPS_AMOUNT, requestId: requestId });
    if (!res.success) return respondError(409, res.error, requestId);
    bnxMarkSynced(clientId, requestId, res.transactionId || '', TRANSACTION_TYPES.PAYMENT);
    res.bill = bnxFindBillById_(clientId, data.BILL_ID);
    return res;
  } catch (error) {
    bnxLogError(clientId, 'bnxSavePayment failed: ' + error.message, { requestId: requestId, data: data });
    return respondError(500, error.message, requestId);
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
/* SETTLE_DUE_BILL {billId|billNumber, payments:[{mode,amount}]} — was missing:
   the dashboard called it and the server answered "Unknown action". */
function bnx71SettleDueBill(session, payload) {
  const clientId = session.CLIENT_ID;
  const lock = bnxAcquireScriptLockWithRetry_(3, 10000);
  try {
    let found = payload.billId ? bnxFindBillRowByIdFast_(clientId, payload.billId) : null;
    if (!found && payload.billNumber) {
      const f2 = bnxFindBillRowByNumber_(clientId, payload.billNumber);
      if (f2) found = { sheet: f2.sheet, headers: f2.headers, rowNo: f2.rowNo, values: f2.values, bill: bnxRowToObject(f2.values, f2.headers) };
    }
    if (!found) return { success: false, error: 'Bill not found for this client' };
    const lines = Array.isArray(payload.payments) && payload.payments.length ? payload.payments
      : [{ mode: payload.paymentMode || payload.mode || 'CASH', amount: payload.amount }];
    return bnx71ApplyBillPayments_(session, found, lines, { action: 'SETTLE', requestId: payload.requestId || '' });
  } catch (e) {
    bnxLogError(clientId, 'SETTLE_DUE_BILL failed: ' + e.message, payload || {});
    return { success: false, error: e.message };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* ============================================================================
 * VOID_BILL helpers — previously declared inside doPost's switch block
 * ========================================================================== */
function bnxFindBillRowByNumber_(clientId, billNumber) {
  const sheet = bnxClientSheet(clientId, SHEETS.BILL_MASTER);
  const lastCol = sheet.getLastColumn(), lastRow = sheet.getLastRow();
  if (lastRow < 2 || lastCol < 1) return null;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const noCol = headers.indexOf('BILL_NUMBER'), ciCol = headers.indexOf('CLIENT_ID');
  if (noCol === -1) return null;
  const matches = sheet.getRange(2, noCol + 1, lastRow - 1, 1).createTextFinder(String(billNumber).trim()).matchEntireCell(true).findAll();
  for (let i = matches.length - 1; i >= 0; i--) {
    const rowNo = matches[i].getRow();
    const vals = sheet.getRange(rowNo, 1, 1, lastCol).getValues()[0];
    if (ciCol !== -1 && String(vals[ciCol]) !== String(clientId)) continue;
    return { sheet: sheet, headers: headers, rowNo: rowNo, values: vals };
  }
  return null;
}
function bnxVoidBill(session, payload) {
  const clientId = session.CLIENT_ID, userId = session.USER_ID;
  const billNumber = String(payload.billNumber || payload.BILL_NUMBER || '').trim();
  const reason = String(payload.reason || '').trim();
  if (!billNumber) return { success: false, error: 'billNumber is required' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const found = bnxFindBillRowByNumber_(clientId, billNumber);
    if (!found) return { success: false, error: 'Bill not found for this client (billNumber: ' + billNumber + ')' };
    const sheet = found.sheet, headers = found.headers, rowNo = found.rowNo;
    const bill = bnxRowToObject(found.values, headers);
    const currentStatus = String(bill.BILL_STATUS || '').toUpperCase();
    if (currentStatus === 'CANCELLED' || currentStatus === 'VOID') return { success: true, billNumber: billNumber, alreadyVoided: true };
    const nowIso = new Date().toISOString();
    const paymentRev = bnxReverseBillPayments_(clientId, bill, userId, nowIso, reason);
    const outstandingBeforeVoid = Math.max(0, Number(bill.DUE_AMOUNT) || 0);
    if (outstandingBeforeVoid > 0 && bill.CUSTOMER_ID) bnxAdjustCustomerDue_(clientId, bill.CUSTOMER_ID, -outstandingBeforeVoid, bill.BILL_DATE || bnxNowParts_().businessDate, 'VOID_BILL');
    bnxReverseBillStock_(clientId, bill, userId, nowIso);
    bnxReverseBillLedger_(clientId, bill, userId, nowIso, reason);
    const set = function (n, v) { const c = headers.indexOf(n); if (c !== -1) sheet.getRange(rowNo, c + 1).setValue(v); };
    set('BILL_STATUS', 'CANCELLED'); set('VOID_REASON', reason); set('CANCELLED_REASON', reason); set('VOIDED_BY', userId); set('CANCELLED_BY', userId);
    set('VOIDED_AT', nowIso); set('CANCELLED_AT', nowIso); set('DUE_AMOUNT', 0); set('PAYMENT_STATUS', 'VOID');
    bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, LOCATION_ID: bill.LOCATION_ID || '', USER_ID: userId, ACTION: 'VOID', MODULE: 'BILLING', RECORD_TYPE: 'BILL', RECORD_ID: bill.BILL_ID || billNumber,
      OLD_VALUE: JSON.stringify({ BILL_STATUS: bill.BILL_STATUS, PAYMENT_STATUS: bill.PAYMENT_STATUS }),
      NEW_VALUE: JSON.stringify({ BILL_STATUS: 'CANCELLED', PAYMENT_STATUS: 'VOID', reversedPayments: paymentRev.count, reversedPaymentAmount: paymentRev.total, reason: reason }), TIMESTAMP: nowIso });
    bnxInvalidateTodayReportCaches_(clientId);
    return { success: true, billNumber: billNumber, billId: bill.BILL_ID || '', reversedPayments: paymentRev.count, reversedPaymentAmount: paymentRev.total };
  } catch (error) {
    bnxLogError(clientId, 'bnxVoidBill failed: ' + error.message, payload);
    return { success: false, error: error.message };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
function bnxReverseBillLedger_(clientId, bill, userId, nowIso, reason) {
  const billId = bill.BILL_ID;
  if (!billId) return;
  const jv = bnxClientSheet(clientId, SHEETS.JOURNAL).getDataRange().getValues(), jh = jv[0] || [];
  let original = null;
  for (let r = 1; r < jv.length; r++) {
    const j = bnxRowToObject(jv[r], jh);
    if (j.CLIENT_ID && String(j.CLIENT_ID) !== String(clientId)) continue;
    if (String(j.SOURCE_ID || '') !== String(billId)) continue;
    if (String(j.SOURCE_TYPE || '') === 'BILL_VOID') return; // idempotent
    if (String(j.SOURCE_TYPE || '') === 'BILL' && !original) original = j;
  }
  if (!original) return;
  const ev = bnxClientSheet(clientId, SHEETS.LEDGER_ENTRIES).getDataRange().getValues(), eh = ev[0] || [];
  const lines = [];
  for (let r = 1; r < ev.length; r++) { const l = bnxRowToObject(ev[r], eh); if (String(l.JOURNAL_ID || '') === String(original.JOURNAL_ID)) lines.push(l); }
  if (!lines.length) return;
  const jid = generateShortId_(clientId, 'JOURNAL_ID'), bd = bnxBusinessDateKey_(new Date());
  const dr = bnx71R2_(lines.reduce(function (s, l) { return s + bnx71Num_(l.CREDIT); }, 0));
  const cr = bnx71R2_(lines.reduce(function (s, l) { return s + bnx71Num_(l.DEBIT); }, 0));
  bnxAppendRow(clientId, SHEETS.JOURNAL, { JOURNAL_ID: jid, CLIENT_ID: clientId, LOCATION_ID: bill.LOCATION_ID || '', JOURNAL_DATE: bd, JOURNAL_TYPE: 'SALES_VOID',
    SOURCE_TYPE: 'BILL_VOID', SOURCE_ID: billId, REFERENCE_NUMBER: bill.BILL_NUMBER, DESCRIPTION: 'Void reversal - Bill ' + bill.BILL_NUMBER + (reason ? ' (' + reason + ')' : ''),
    TOTAL_DEBIT: dr, TOTAL_CREDIT: cr, CREATED_BY: userId, CREATED_AT: nowIso });
  bnxAppendRowsBatch_(clientId, SHEETS.LEDGER_ENTRIES, lines.map(function (l) {
    const acct = l.ACCOUNT || l.LEDGER_ID || '';
    return { LEDGER_ENTRY_ID: generateShortId_(clientId, 'LEDGER_ENTRY_ID'), CLIENT_ID: clientId, JOURNAL_ID: jid, ACCOUNT: acct, LEDGER_ID: acct,
      DEBIT: bnx71R2_(l.CREDIT), CREDIT: bnx71R2_(l.DEBIT), DESCRIPTION: 'Void ' + bill.BILL_NUMBER, REFERENCE_TYPE: 'BILL_VOID', REFERENCE_ID: billId, CREATED_AT: nowIso };
  }));
}

/* ============================================================================
 * RECONCILIATION — PAID status + ledger joined through JOURNAL
 * ========================================================================== */
function bnxGetReconciliationReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const locationId = payload.locationId || payload.LOCATION_ID || '';
  const rng = bnxResolveDateRange_(payload), from = rng.from, to = rng.to;
  try {
    const rows = [];
    const push = function (module, src, tgt, status, exc, remarks) {
      const diff = bnx71R2_(src - tgt);
      rows.push({ CLIENT_ID: clientId, LOCATION_ID: locationId, RECON_DATE: to, MODULE: module, SOURCE_TOTAL: bnx71R2_(src), TARGET_TOTAL: bnx71R2_(tgt),
        DIFFERENCE: diff, STATUS: status || (Math.abs(diff) < 1 ? 'MATCHED' : 'MISMATCH'), EXCEPTION_COUNT: exc || 0, REMARKS: remarks });
    };
    const bv = bnxClientSheet(clientId, SHEETS.BILL_MASTER).getDataRange().getValues(), bx = bnx71Idx_(bv[0] || []);
    const grandByBill = {};
    let billTotal = 0, netSales = 0, noJournalCount = 0;
    for (let r = 1; r < bv.length; r++) {
      const row = bv[r];
      if (String(row[bx.CLIENT_ID] || '') !== String(clientId)) continue;
      if (locationId && String(row[bx.LOCATION_ID] || '') !== String(locationId)) continue;
      const dk = bnxNormalizeDateKey_(row[bx.BILL_DATE]); if (!dk || dk < from || dk > to) continue;
      const st = String(row[bx.BILL_STATUS] || '').toUpperCase(); if (st === 'CANCELLED' || st === 'VOID') continue;
      const grand = bnx71Num_(row[bx.GRAND_TOTAL]), due = bx.DUE_AMOUNT !== undefined ? bnx71Num_(row[bx.DUE_AMOUNT]) : 0;
      billTotal += grand - due; netSales += bnx71Num_(row[bx.TAXABLE_AMOUNT]);
      grandByBill[String(row[bx.BILL_ID])] = grand - due;
    }
    const pv = bnxClientSheet(clientId, SHEETS.PAYMENT_MASTER).getDataRange().getValues(), px = bnx71Idx_(pv[0] || []);
    const paidByBill = {};
    let payTotal = 0;
    for (let r = 1; r < pv.length; r++) {
      const row = pv[r];
      if (String(row[px.CLIENT_ID] || '') !== String(clientId)) continue;
      if (locationId && String(row[px.LOCATION_ID] || '') !== String(locationId)) continue;
      const dk = bnxNormalizeDateKey_(row[px.PAYMENT_DATE]); if (!dk || dk < from || dk > to) continue;
      if (!bnx71PaymentActive_(row[px.PAYMENT_STATUS])) continue;
      if (/^(CREDIT|DUE)$/i.test(String(row[px.PAYMENT_MODE] || ''))) continue;
      const amt = bnx71Num_(row[px.AMOUNT]);
      payTotal += amt;
      const bid = String(row[px.BILL_ID] || '');
      if (bid) paidByBill[bid] = (paidByBill[bid] || 0) + amt;
    }
    let exc = 0;
    Object.keys(grandByBill).forEach(function (id) { if (Math.abs(grandByBill[id] - (paidByBill[id] || 0)) > 0.5) exc++; });
    push('BILL_VS_PAYMENT', billTotal, payTotal, '', exc, 'Collected value of bills (grand − due) vs live payments (PAID/SUCCESS), ' + from + ' to ' + to +
      '. Exceptions include imported bills whose payment mode was never in the source.');

    /* Sales ledger: JOURNAL (dated) → LEDGER_ENTRIES (LEDGER_ID). Net = Sales CR − Discount DR. */
    try {
      const salesAcct = bnxGetOrCreateLedgerAccount_(clientId, 'SALES', 'Sales', 'INCOME');
      const discAcct = bnxGetOrCreateLedgerAccount_(clientId, 'DISCOUNT_GIVEN', 'Discount Given', 'EXPENSE');
      const jv = bnxClientSheet(clientId, SHEETS.JOURNAL).getDataRange().getValues(), jx = bnx71Idx_(jv[0] || []);
      const jIds = {}, journaledBills = {};
      for (let r = 1; r < jv.length; r++) {
        if (jx.CLIENT_ID !== undefined && jv[r][jx.CLIENT_ID] && String(jv[r][jx.CLIENT_ID]) !== String(clientId)) continue;
        const dk = bnxNormalizeDateKey_(jv[r][jx.JOURNAL_DATE]); if (!dk || dk < from || dk > to) continue;
        const stp = String(jv[r][jx.SOURCE_TYPE] || '');
        if (stp !== 'BILL' && stp !== 'BILL_VOID') continue;
        jIds[String(jv[r][jx.JOURNAL_ID])] = 1;
        if (stp === 'BILL') journaledBills[String(jv[r][jx.SOURCE_ID])] = 1;
      }
      const ev = bnxClientSheet(clientId, SHEETS.LEDGER_ENTRIES).getDataRange().getValues(), ex = bnx71Idx_(ev[0] || []);
      let ledgerNet = 0;
      for (let r = 1; r < ev.length; r++) {
        if (!jIds[String(ev[r][ex.JOURNAL_ID])]) continue;
        const acct = String((ex.LEDGER_ID !== undefined ? ev[r][ex.LEDGER_ID] : '') || (ex.ACCOUNT !== undefined ? ev[r][ex.ACCOUNT] : '') || '');
        if (acct === salesAcct) ledgerNet += bnx71Num_(ev[r][ex.CREDIT]) - bnx71Num_(ev[r][ex.DEBIT]);
        else if (acct === discAcct) ledgerNet -= bnx71Num_(ev[r][ex.DEBIT]) - bnx71Num_(ev[r][ex.CREDIT]);
      }
      Object.keys(grandByBill).forEach(function (id) { if (!journaledBills[id]) noJournalCount++; });
      push('SALES_VS_LEDGER', netSales, ledgerNet, '', noJournalCount,
        'BILL_MASTER.TAXABLE_AMOUNT vs (Sales CR − Discount DR) in the ledger, ' + from + ' to ' + to + '. ' + noJournalCount + ' bill(s) have no sales journal (historical imports are not journaled).');
    } catch (e) { push('SALES_VS_LEDGER', netSales, 0, 'ERROR', 1, e.message); }

    try {
      const ds = bnxBuildSalesDataset_(clientId, locationId, from, to);
      const itemNet = ds.itemRows.reduce(function (s, l) { return s + l.net; }, 0);
      push('ITEM_VS_DAYBOOK', netSales, itemNet, '', ds.uncategorizedItems.length, 'BILL_MASTER.TAXABLE_AMOUNT vs item-level net sales. Historical DSR bills carry no item lines.');
      push('CATEGORY_VS_DAYBOOK', netSales, itemNet, '', 0, 'Category totals regroup the same item lines.');
    } catch (e) {}
    try {
      const inv = bnxBuildStockLedgerDataset_(clientId, locationId, from, to);
      let open = 0, pin = 0, tin = 0, tout = 0, cons = 0, wst = 0, brk = 0, adj = 0;
      Object.keys(inv.byItem).forEach(function (it) {
        const x = inv.byItem[it];
        open += bnxStockOpeningForItem_(clientId, locationId, it, from).opening;
        pin += x.purchaseQty; tin += x.transferInQty; tout += x.transferOutQty; cons += x.consumptionQty; wst += x.wastageQty; brk += x.breakageQty; adj += x.adjustmentQty;
      });
      const ledgerClose = open + pin + tin - tout - cons - wst - brk + adj;
      let bal = 0, found = false;
      try {
        const v = bnxClientSheet(clientId, SHEETS.STOCK_BALANCE).getDataRange().getValues(), h = v[0] || [];
        for (let r = 1; r < v.length; r++) {
          const b = bnxRowToObject(v[r], h);
          if (String(b.CLIENT_ID) !== String(clientId)) continue;
          if (locationId && String(b.LOCATION_ID || '') !== String(locationId)) continue;
          bal += bnx71Num_(b.CURRENT_QUANTITY); found = true;
        }
      } catch (e) {}
      push('INVENTORY_LEDGER_VS_BALANCE', ledgerClose, bal, found ? '' : 'NO_BALANCE_SOURCE', Object.keys(inv.unmappedTypes).length,
        'Opening + Purchase + Transfer In − Transfer Out/Issue − Consumption − Wastage − Breakage + Adjustment vs STOCK_BALANCE.');
    } catch (e) { push('INVENTORY_LEDGER_VS_BALANCE', 0, 0, 'ERROR', 1, e.message); }
    try {
      const pl = bnxGetProfitLossReport(session, Object.assign({}, payload || {}, { locationId: locationId }));
      if (pl && pl.success && pl.data && pl.data.row) {
        const x = pl.data.row;
        rows.push({ CLIENT_ID: clientId, LOCATION_ID: locationId, RECON_DATE: to, MODULE: 'PROFIT_LOSS_RECON', SOURCE_TOTAL: bnx71Num_(x.NET_SALES), TARGET_TOTAL: bnx71Num_(x.COST_OF_GOODS),
          DIFFERENCE: bnx71Num_(x.GROSS_PROFIT), STATUS: 'CALCULATED', EXCEPTION_COUNT: 0, REMARKS: 'Net Sales − COGS = Gross Profit.' });
      }
    } catch (e) {}
    bnxReplaceReportByFields_(clientId, 'RECONCILIATION_REPORT', { LOCATION_ID: locationId, RECON_DATE: to }, rows);
    bnxUpsertReportRegistry_(clientId, 'RECONCILIATION_REPORT', 'CONTROL', 'REPORT', 'BILL_MASTER,BILL_ITEMS,PAYMENT_MASTER,JOURNAL,LEDGER_ENTRIES,STOCK_MOVEMENT');
    return { success: true, data: { rows: rows, from: from, to: to }, available: true, isDemo: false };
  } catch (error) {
    bnxLogError(clientId, 'bnxGetReconciliationReport failed: ' + error.message, payload);
    return { success: false, error: error.message };
  }
}

/* ============================================================================
 * ACTIONS THE DASHBOARD ALREADY CALLS (previously "Unknown action")
 * ========================================================================== */
function bnx71GetKots(session, payload) {
  const d = String(payload.date || '').slice(0, 10);
  const r = bnxGetKOT(session, { includeClosed: true, FROM_DATE: payload.from || d, TO_DATE: payload.to || d, LOCATION_ID: payload.locationId || payload.LOCATION_ID || '' });
  if (!r || r.success === false) return { success: false, error: (r && r.error) || 'KOT read failed', data: { rows: [] } };
  const rows = (r.data || []).map(function (k) { return Object.assign({}, k, { STATUS: k.KOT_STATUS || '' }); });
  return { success: true, data: { rows: rows }, rows: rows, count: rows.length };
}
function bnx71ReprintBill(session, payload) {
  const clientId = session.CLIENT_ID;
  const r = bnxGetBillForReprint(session, payload);
  if (!r || !r.success) return r || { success: false, error: 'Bill not found' };
  try {
    bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, LOCATION_ID: r.data.bill.LOCATION_ID || '', USER_ID: session.USER_ID || '', ACTION: 'REPRINT', MODULE: 'BILLING',
      RECORD_TYPE: 'BILL', RECORD_ID: r.data.bill.BILL_NUMBER || r.data.bill.BILL_ID, OLD_VALUE: '{}',
      NEW_VALUE: JSON.stringify({ billId: r.data.bill.BILL_ID, by: session.FULL_NAME || session.USER_ID || '' }), TIMESTAMP: new Date().toISOString() });
  } catch (e) {}
  return r;
}
function bnx71GetReprintReport(session, payload) {
  const clientId = session.CLIENT_ID;
  const rng = bnxResolveDateRange_(payload || {}), from = rng.from, to = rng.to;
  try {
    const v = bnxClientSheet(clientId, SHEETS.AUDIT_LOG).getDataRange().getValues(), x = bnx71Idx_(v[0] || []);
    const by = {};
    for (let r = 1; r < v.length; r++) {
      if (String(v[r][x.CLIENT_ID] || '') !== String(clientId)) continue;
      if (String(v[r][x.ACTION] || '').toUpperCase().indexOf('REPRINT') < 0) continue;
      const ts = v[r][x.TIMESTAMP];
      const dk = bnxNormalizeDateKey_(ts instanceof Date ? ts : String(ts || '').slice(0, 10));
      if (!dk || dk < from || dk > to) continue;
      const no = String(v[r][x.RECORD_ID] || '');
      let who = String(v[r][x.USER_ID] || '');
      try { const nv = JSON.parse(v[r][x.NEW_VALUE] || '{}'); if (nv.by) who = nv.by; } catch (e) {}
      const tsS = ts instanceof Date ? ts.toISOString() : String(ts || '');
      if (!by[no]) by[no] = { billNo: no, original: no, first: tsS, last: tsS, by: who, count: 0 };
      by[no].count++;
      if (tsS > by[no].last) { by[no].last = tsS; by[no].by = who; }
    }
    const summary = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.count - a.count; });
    return { success: true, data: { summary: summary, from: from, to: to } };
  } catch (e) {
    bnxLogError(clientId, 'GET_REPRINT_REPORT failed: ' + e.message, payload || {});
    return { success: false, error: e.message };
  }
}
function bnx71RoleAccessRow_(clientId) {
  const sh = bnxClientSheet(clientId, SHEETS.SETTINGS_TOGGLES);
  bnxEnsureColumns_(sh, ['TOGGLE_ID', 'CLIENT_ID', 'SCOPE', 'TOGGLE_KEY', 'VALUE', 'CREATED_AT', 'UPDATED_AT']);
  const v = sh.getDataRange().getValues(), x = bnx71Idx_(v[0] || []);
  for (let r = 1; r < v.length; r++) {
    if (String(v[r][x.CLIENT_ID] || '') === String(clientId) && String(v[r][x.SCOPE] || '') === 'ROLE_ACCESS' && String(v[r][x.TOGGLE_KEY] || '') === 'MAP')
      return { sheet: sh, idx: x, rowNo: r + 1, value: v[r][x.VALUE] };
  }
  return { sheet: sh, idx: x, rowNo: 0, value: '' };
}
function bnx71GetRoleAccess(session) {
  try {
    const row = bnx71RoleAccessRow_(session.CLIENT_ID);
    let map = null;
    try { map = row.value ? JSON.parse(row.value) : null; } catch (e) {}
    return { success: true, data: { map: map } };
  } catch (e) { return { success: false, error: e.message }; }
}
function bnx71SaveRoleAccess(session, payload) {
  const role = String(session.ROLE || '').toUpperCase().replace(/\s+/g, '_');
  if (['ADMIN', 'SUPER_ADMIN', 'DEVELOPER', 'OWNER'].indexOf(role) < 0) return { success: false, error: 'Admin authorization required' };
  const map = payload.map;
  if (!map || typeof map !== 'object') return { success: false, error: 'map object is required' };
  const json = JSON.stringify(map);
  if (json.length > 45000) return { success: false, error: 'Role access map too large' };
  try {
    const clientId = session.CLIENT_ID, row = bnx71RoleAccessRow_(clientId), now = new Date().toISOString();
    if (row.rowNo) {
      row.sheet.getRange(row.rowNo, row.idx.VALUE + 1).setValue(json);
      if (row.idx.UPDATED_AT !== undefined) row.sheet.getRange(row.rowNo, row.idx.UPDATED_AT + 1).setValue(now);
    } else {
      bnxAppendRow(clientId, SHEETS.SETTINGS_TOGGLES, { TOGGLE_ID: 'ROLEACCESS-' + clientId, CLIENT_ID: clientId, SCOPE: 'ROLE_ACCESS', TOGGLE_KEY: 'MAP', VALUE: json, CREATED_AT: now, UPDATED_AT: now });
    }
    bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: session.USER_ID || '', ACTION: 'UPDATE', MODULE: 'SETTINGS', RECORD_TYPE: 'ROLE_ACCESS', RECORD_ID: clientId, OLD_VALUE: '{}', NEW_VALUE: json.slice(0, 40000), TIMESTAMP: now });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}
/* ============================ END PASS #71 ============================ */


/* ============================================================================
 * PASS #72 — CREDIT & ACCOUNTS · TABLE FLOOR · DATA REPAIR
 * ----------------------------------------------------------------------------
 * Root causes fixed:
 *  - GET_DUE_COLLECTION read CUSTOMER_DUES (empty) while ₹1.5 Cr of real
 *    credit sat in BILL_MASTER (DUE/PARTIAL, DUE_AMOUNT, no CUSTOMER_ID).
 *    One receivables engine now derives every customer balance from bills +
 *    payments + opening balances + receipts. Customers without an ID are
 *    grouped by normalised name ("N:NAME") and merged with CUSTOMER_MASTER.
 *  - SAVE_DUES_RECEIPT needed a customerId and never reduced bill dues.
 *    Receipts are now allocated oldest-first (opening → bills), write a
 *    PAYMENT_MASTER row per bill (DSR "due received"), a numbered voucher,
 *    and a balanced journal (DR Cash/Bank · CR Customer Dues).
 *  - Opening balances / credit customers were saved to localStorage only.
 *  - Accounts overview had no data source → GET_ACCOUNTS_DAY.
 *  - Table status came from TABLE_LIVE_STATE (stale/wiped), not from open
 *    orders → GET_TABLE_FLOOR. Merge/transfer were alert() stubs →
 *    TRANSFER_TABLE / MERGE_TABLES.
 *  - Live bills removed by a sheet re-import → RESTORE_MISSING_BILLS
 *    rebuilds them from AUDIT_LOG.
 * ========================================================================== */

/* ---------- small sheet helpers ---------- */
function bnx72Sh_(clientId, name) { return bnxClientSheet(clientId, (typeof SHEETS !== 'undefined' && SHEETS[name]) || name); }
function bnx72Vals_(clientId, name) {
  try { const v = bnx72Sh_(clientId, name).getDataRange().getValues(); return { v: v, x: bnx71Idx_(v[0] || []) }; }
  catch (e) { return { v: [[]], x: {} }; }
}
function bnx72G_(row, x, n) { return x[n] === undefined ? '' : row[x[n]]; }
function bnx72EnsureCols_(clientId, name, cols) {
  const sh = bnx72Sh_(clientId, name);
  const lc = Math.max(1, sh.getLastColumn());
  const h = sh.getRange(1, 1, 1, lc).getValues()[0].map(String);
  const miss = cols.filter(function (c) { return h.indexOf(c) < 0; });
  if (miss.length) {
    const start = h.filter(function (x) { return x !== ''; }).length ? lc + 1 : 1;
    sh.getRange(1, start, 1, miss.length).setValues([miss]);
    bnx71MemoDrop_(clientId, (typeof SHEETS !== 'undefined' && SHEETS[name]) || name);
  }
  return sh;
}
function bnx72SetRow_(sh, headers, rowNo, obj) {
  Object.keys(obj).forEach(function (k) { const c = headers.indexOf(k); if (c >= 0) sh.getRange(rowNo, c + 1).setValue(obj[k]); });
}
function bnx72Today_() { return bnxBusinessDateKey_(new Date()); }
function bnx72DaysBetween_(a, b) {
  if (!a || !b) return 0;
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}
function bnx72Mode_(m) {
  const s = String(m || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!s || s === 'CASH') return 'CASH';
  if (s.indexOf('UPI') >= 0 || s.indexOf('GPAY') >= 0 || s.indexOf('PHONEPE') >= 0 || s.indexOf('PAYTM') >= 0) return 'UPI';
  if (s.indexOf('CARD') >= 0) return 'CARD';
  if (s.indexOf('CHEQUE') >= 0 || s.indexOf('CHECK') >= 0) return 'CHEQUE';
  if (s.indexOf('BANK') >= 0 || s.indexOf('NEFT') >= 0 || s.indexOf('RTGS') >= 0 || s.indexOf('IMPS') >= 0 || s.indexOf('TRANSFER') >= 0) return 'BANK';
  return s;
}

/* ---------- customer identity ---------- */
var BNX72_WALKIN_ = { '': 1, 'GENERAL CUSTOMER': 1, 'DEFAULT CUSTOMER': 1, 'WALK-IN': 1, 'WALKIN': 1, 'WALK IN': 1, 'GUEST': 1, '—': 1, '-': 1, 'NA': 1, 'N/A': 1 };
var BNX72_AGG_ = { ZOMATO: 1, SWIGGY: 1, DINEOUT: 1, 'EAZY DINE': 1, EAZYDINE: 1, MAGICPIN: 1, ONDC: 1 };
function bnx72NormName_(n) { return String(n || '').toUpperCase().replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim(); }
function bnx72KeyForName_(n) { const k = bnx72NormName_(n); return 'N:' + (BNX72_WALKIN_[k] ? 'GENERAL CUSTOMER' : k); }
function bnx72Customers_(clientId) {
  const cm = bnx72Vals_(clientId, 'CUSTOMER_MASTER');
  const byId = {}, idByName = {};
  for (let r = 1; r < cm.v.length; r++) {
    const row = cm.v[r];
    if (String(bnx72G_(row, cm.x, 'CLIENT_ID') || clientId) !== String(clientId)) continue;
    const id = String(bnx72G_(row, cm.x, 'CUSTOMER_ID') || '').trim(); if (!id) continue;
    const name = String(bnx72G_(row, cm.x, 'CUSTOMER_NAME') || '').trim();
    byId[id] = { id: id, name: name, phone: String(bnx72G_(row, cm.x, 'PHONE') || ''), type: String(bnx72G_(row, cm.x, 'CUSTOMER_TYPE') || ''),
      gstin: String(bnx72G_(row, cm.x, 'GSTIN') || ''), creditLimit: bnx71Num_(bnx72G_(row, cm.x, 'CREDIT_LIMIT')),
      creditDays: bnx71Num_(bnx72G_(row, cm.x, 'CREDIT_DAYS')), email: String(bnx72G_(row, cm.x, 'EMAIL') || ''), rowNo: r + 1 };
    const nk = bnx72NormName_(name);
    if (nk && !BNX72_WALKIN_[nk] && !idByName[nk]) idByName[nk] = id;
  }
  return { byId: byId, idByName: idByName, sheetVals: cm };
}
/* Canonical key: master CUSTOMER_ID when known (by id or unique name), else N:NAME */
function bnx72ResolveKey_(cust, customerId, name) {
  const id = String(customerId || '').trim();
  if (id && cust.byId[id]) return id;
  if (/^N:/.test(id)) { const nk = id.slice(2); return cust.idByName[nk] || id; }
  const nk = bnx72NormName_(name);
  if (nk && cust.idByName[nk]) return cust.idByName[nk];
  return bnx72KeyForName_(name || id);
}

/* ---------- the receivables engine (one source for every credit screen) ---------- */
var BNX72_DUE_SET_ = { DUE: 1, PARTIAL: 1, PENDING: 1, CREDIT: 1, UNPAID: 1 };
function bnx72Receivables_(clientId) {
  return bnxCachedReport_('rcv72|' + clientId, 120, function () { return bnx72ReceivablesBuild_(clientId); });
}
function bnx72ReceivablesBuild_(clientId) {
  const cust = bnx72Customers_(clientId);
  const today = bnx72Today_();
  const acc = {};
  const A = function (key, nameHint) {
    if (!acc[key]) {
      const m = cust.byId[key] || null;
      acc[key] = { key: key, name: m ? m.name : (nameHint || key.replace(/^N:/, '')), master: m, entries: [], openBills: [],
        opening: 0, openingRemaining: 0, openingDate: '', lastBillDate: '', lastPaymentDate: '', lastPaymentAmount: 0, names: {} };
    }
    if (nameHint) acc[key].names[nameHint] = (acc[key].names[nameHint] || 0) + 1;
    return acc[key];
  };

  /* payments grouped by bill */
  const pm = bnx72Vals_(clientId, 'PAYMENT_MASTER');
  const payByBill = {};
  for (let r = 1; r < pm.v.length; r++) {
    const row = pm.v[r];
    if (String(bnx72G_(row, pm.x, 'CLIENT_ID')) !== String(clientId)) continue;
    if (!bnx71PaymentActive_(bnx72G_(row, pm.x, 'PAYMENT_STATUS'))) continue;
    const bid = String(bnx72G_(row, pm.x, 'BILL_ID') || ''); if (!bid) continue;
    const mode = String(bnx72G_(row, pm.x, 'PAYMENT_MODE') || '').toUpperCase();
    if (/^(CREDIT|DUE)$/.test(mode)) continue;
    (payByBill[bid] = payByBill[bid] || []).push({ date: bnxNormalizeDateKey_(bnx72G_(row, pm.x, 'PAYMENT_DATE')), amount: bnx71Num_(bnx72G_(row, pm.x, 'AMOUNT')),
      mode: mode, ref: String(bnx72G_(row, pm.x, 'REFERENCE') || ''), id: String(bnx72G_(row, pm.x, 'PAYMENT_ID') || '') });
  }

  /* bills */
  const bm = bnx72Vals_(clientId, 'BILL_MASTER');
  for (let r = 1; r < bm.v.length; r++) {
    const row = bm.v[r];
    if (String(bnx72G_(row, bm.x, 'CLIENT_ID')) !== String(clientId)) continue;
    const st = String(bnx72G_(row, bm.x, 'BILL_STATUS') || '').toUpperCase();
    if (st === 'CANCELLED' || st === 'VOID') continue;
    const bid = String(bnx72G_(row, bm.x, 'BILL_ID') || ''); if (!bid) continue;
    const grand = bnx71R2_(bnx72G_(row, bm.x, 'GRAND_TOTAL'));
    if (grand <= 0) continue;
    const pst = String(bnx72G_(row, bm.x, 'PAYMENT_STATUS') || '').toUpperCase();
    const bd = bnxNormalizeDateKey_(bnx72G_(row, bm.x, 'BILL_DATE'));
    const pays = payByBill[bid] || [];
    let sameDay = 0; const later = [];
    pays.forEach(function (p) { if (p.date && bd && p.date > bd) later.push(p); else sameDay += p.amount; });
    if (!BNX72_DUE_SET_[pst] && !later.length) continue;          // never a credit bill
    const credit = bnx71R2_(grand - sameDay);
    if (credit <= 0.01 && !later.length) continue;
    const dueRaw = bnx72G_(row, bm.x, 'DUE_AMOUNT');
    const laterSum = bnx71R2_(later.reduce(function (s, p) { return s + p.amount; }, 0));
    const due = String(dueRaw).trim() === '' ? (BNX72_DUE_SET_[pst] ? bnx71R2_(Math.max(0, credit - laterSum)) : 0) : bnx71R2_(dueRaw);
    const name = String(bnx72G_(row, bm.x, 'CUSTOMER_NAME') || '').trim();
    const key = bnx72ResolveKey_(cust, bnx72G_(row, bm.x, 'CUSTOMER_ID'), name);
    const a = A(key, name);
    const billNo = String(bnx72G_(row, bm.x, 'BILL_NUMBER') || bid);
    a.entries.push({ date: bd, type: 'BILL', ref: billNo, billId: bid, dr: credit, cr: 0, note: 'Credit sale' + (bnx72G_(row, bm.x, 'TABLE_ID') ? ' · ' + bnx72G_(row, bm.x, 'TABLE_ID') : '') });
    later.forEach(function (p) {
      a.entries.push({ date: p.date, type: 'RECEIPT', ref: p.ref || p.id, billId: bid, dr: 0, cr: p.amount, note: p.mode + ' against ' + billNo });
      if (p.date >= a.lastPaymentDate) { a.lastPaymentDate = p.date; a.lastPaymentAmount = p.amount; }
    });
    const adj = bnx71R2_(credit - laterSum - due);
    if (Math.abs(adj) > 0.01) a.entries.push({ date: bd, type: 'ADJUST', ref: billNo, billId: bid, dr: adj < 0 ? -adj : 0, cr: adj > 0 ? adj : 0,
      note: adj > 0 ? 'Settled / adjusted outside POS (no receipt recorded)' : 'Due higher than bill balance' });
    if (bd > a.lastBillDate) a.lastBillDate = bd;
    if (due > 0.01) a.openBills.push({ billId: bid, billNo: billNo, date: bd, amount: grand, due: due, age: bnx72DaysBetween_(bd, today),
      table: String(bnx72G_(row, bm.x, 'TABLE_ID') || ''), rowNo: r + 1 });
  }

  /* opening balances */
  const cd = bnx72Vals_(clientId, 'CUSTOMER_DUES');
  for (let r = 1; r < cd.v.length; r++) {
    const row = cd.v[r];
    if (String(bnx72G_(row, cd.x, 'CLIENT_ID') || clientId) !== String(clientId)) continue;
    const cid = String(bnx72G_(row, cd.x, 'CUSTOMER_ID') || ''); if (!cid) continue;
    const ob = bnx71R2_(bnx72G_(row, cd.x, 'OPENING_BALANCE'));
    const cur = bnx71R2_(bnx72G_(row, cd.x, 'CURRENT_BALANCE'));
    if (!ob && !cur) continue;
    const key = bnx72ResolveKey_(cust, cid, cid.replace(/^N:/, ''));
    const a = A(key, '');
    const od = bnxNormalizeDateKey_(bnx72G_(row, cd.x, 'OPENING_DATE')) || '2000-01-01';
    a.opening = bnx71R2_(a.opening + ob); a.openingRemaining = bnx71R2_(a.openingRemaining + cur); a.openingDate = od;
    if (ob) a.entries.push({ date: od, type: 'OPENING', ref: 'Opening', billId: '', dr: ob > 0 ? ob : 0, cr: ob < 0 ? -ob : 0, note: 'Opening balance' });
  }

  /* receipts: the part not already represented by bill payment rows */
  const dr = bnx72Vals_(clientId, 'DUES_RECEIPT');
  const rcptToday = [];
  for (let r = 1; r < dr.v.length; r++) {
    const row = dr.v[r];
    if (String(bnx72G_(row, dr.x, 'CLIENT_ID')) !== String(clientId)) continue;
    if (/^(CANCELLED|VOID)$/i.test(String(bnx72G_(row, dr.x, 'STATUS') || ''))) continue;
    const amt = bnx71R2_(bnx72G_(row, dr.x, 'AMOUNT'));
    const allocated = bnx71R2_(bnx72G_(row, dr.x, 'ALLOCATED_AMOUNT'));
    const cid = String(bnx72G_(row, dr.x, 'CUSTOMER_KEY') || bnx72G_(row, dr.x, 'CUSTOMER_ID') || '');
    const nm = String(bnx72G_(row, dr.x, 'CUSTOMER_NAME') || '');
    const key = bnx72ResolveKey_(cust, cid, nm || cid.replace(/^N:/, ''));
    const a = A(key, nm);
    const d = bnxNormalizeDateKey_(bnx72G_(row, dr.x, 'RECEIPT_DATE'));
    const vno = String(bnx72G_(row, dr.x, 'VOUCHER_NO') || bnx72G_(row, dr.x, 'DUES_RECEIPT_ID') || '');
    const rest = bnx71R2_(amt - allocated);
    if (rest > 0.01) a.entries.push({ date: d, type: 'RECEIPT', ref: vno, billId: '', dr: 0, cr: rest, note: String(bnx72G_(row, dr.x, 'PAYMENT_MODE') || '') + ' · opening/advance' });
    if (d >= a.lastPaymentDate) { a.lastPaymentDate = d; a.lastPaymentAmount = amt; }
    if (d === today) rcptToday.push({ voucherNo: vno, customer: a.name, customerId: key, amount: amt, mode: String(bnx72G_(row, dr.x, 'PAYMENT_MODE') || ''),
      time: String(bnx72G_(row, dr.x, 'RECEIPT_TIME') || ''), by: String(bnx72G_(row, dr.x, 'CREATED_BY') || ''), allocated: allocated });
  }

  /* roll up */
  const customers = [];
  let total = 0, overdue30 = 0, receivedToday = 0, paymentsToday = 0;
  const aging = { d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
  Object.keys(acc).forEach(function (k) {
    const a = acc[k];
    a.entries.sort(function (p, q) { return p.date < q.date ? -1 : p.date > q.date ? 1 : (p.type === 'BILL' ? -1 : 1); });
    const bal = bnx71R2_(a.entries.reduce(function (s, e) { return s + e.dr - e.cr; }, 0));
    const ag = { d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
    const put = function (age, amt) { if (age <= 30) ag.d0_30 += amt; else if (age <= 60) ag.d31_60 += amt; else if (age <= 90) ag.d61_90 += amt; else ag.d90p += amt; };
    a.openBills.forEach(function (b) { put(b.age, b.due); });
    if (a.openingRemaining > 0) put(bnx72DaysBetween_(a.openingDate || today, today), a.openingRemaining); else if (a.openingRemaining < 0) ag.d0_30 += a.openingRemaining;
    const itemsSum = a.openBills.reduce(function (s, b) { return s + b.due; }, 0) + a.openingRemaining;  /* negative remaining already in d0_30 */
    const advance = bnx71R2_(itemsSum - bal); if (advance > 0.01) ag.d0_30 -= advance;
    Object.keys(ag).forEach(function (x) { ag[x] = bnx71R2_(ag[x]); aging[x] += ag[x]; });
    const oldest = a.openBills.reduce(function (m, b) { return Math.max(m, b.age); }, a.openingRemaining > 0.01 ? bnx72DaysBetween_(a.openingDate || today, today) : 0);
    const m = a.master;
    let display = a.name;
    if (!m) { let best = 0; Object.keys(a.names).forEach(function (n) { if (n && a.names[n] > best) { best = a.names[n]; display = n; } }); }
    if (k === 'N:GENERAL CUSTOMER') display = 'General / Unnamed guest';
    const nk = bnx72NormName_(display);
    const type = BNX72_AGG_[nk] ? 'Aggregator' : ((m && m.type) ? m.type : (k === 'N:GENERAL CUSTOMER' ? 'Walk-in' : 'Individual'));
    const todayRcpt = a.entries.filter(function (e) { return e.type === 'RECEIPT' && e.date === today; });
    receivedToday += todayRcpt.reduce(function (s, e) { return s + e.cr; }, 0);
    paymentsToday += todayRcpt.length;
    total += bal;
    overdue30 += ag.d31_60 + ag.d61_90 + ag.d90p;
    customers.push({ customerId: k, customer: display, type: type, phone: m ? m.phone : '', gstin: m ? m.gstin : '', creditLimit: m ? m.creditLimit : 0,
      creditDays: m ? m.creditDays : 0, outstanding: bal, lastBillDate: a.lastBillDate, lastPaymentDate: a.lastPaymentDate, lastPaymentAmount: a.lastPaymentAmount,
      overdueDays: oldest, openBills: a.openBills.length, aging: ag, opening: a.opening, isMaster: !!m,
      overLimit: !!(m && m.creditLimit > 0 && bal > m.creditLimit) });
  });
  customers.sort(function (p, q) { return q.outstanding - p.outstanding; });
  Object.keys(aging).forEach(function (x) { aging[x] = bnx71R2_(aging[x]); });
  return { acc: acc, customers: customers, totals: { totalOutstanding: bnx71R2_(total), overdue30Plus: bnx71R2_(overdue30), receivedToday: bnx71R2_(receivedToday),
    paymentsToday: paymentsToday, aging: aging }, receiptsToday: rcptToday, asOf: today };
}

/* GET_DUE_COLLECTION — same contract the dashboard already renders, plus more fields */
function bnx72GetDueCollection(session) {
  try {
    const R = bnx72Receivables_(session.CLIENT_ID);
    const t = R.totals;
    const customers = R.customers.filter(function (c) { return Math.abs(c.outstanding) > 0.01 || c.isMaster; });
    return { success: true, data: { totalOutstanding: t.totalOutstanding, receivedToday: t.receivedToday, netOutstanding: bnx71R2_(t.totalOutstanding),
      paymentsToday: t.paymentsToday, overdue30Plus: t.overdue30Plus, aging: t.aging, customers: customers,
      activeCustomers: customers.filter(function (c) { return c.outstanding > 0.01; }).length, receiptsToday: R.receiptsToday, asOf: R.asOf } };
  } catch (e) { bnxLogError(session.CLIENT_ID, 'GET_DUE_COLLECTION failed: ' + e.message, {}); return { success: false, error: e.message }; }
}
/* GET_DEBTORS_REPORT — aging rows */
function bnx72GetDebtorsReport(session) {
  try {
    const R = bnx72Receivables_(session.CLIENT_ID);
    const rows = R.customers.filter(function (c) { return c.outstanding > 0.01; }).map(function (c) {
      return { customer: c.customer, customerId: c.customerId, type: c.type, b0_30: c.aging.d0_30, b30_60: c.aging.d31_60, b60_90: c.aging.d61_90, b90plus: c.aging.d90p,
        b60plus: bnx71R2_(c.aging.d61_90 + c.aging.d90p), total: c.outstanding, openBills: c.openBills, lastBillDate: c.lastBillDate, lastPaymentDate: c.lastPaymentDate };
    });
    return { success: true, data: { rows: rows, grandTotal: R.totals.totalOutstanding, aging: R.totals.aging, asOf: R.asOf } };
  } catch (e) { return { success: false, error: e.message }; }
}
/* GET_CUSTOMER_DUES_REPORT_V2 — opening / credit sales / receipts / adjustments / closing for a period */
function bnx72GetCustomerDuesReportV2(session, payload) {
  try {
    const R = bnx72Receivables_(session.CLIENT_ID);
    const asOf = String(payload.asOfDate || payload.to || '').slice(0, 10) || R.asOf;
    const from = String(payload.from || '').slice(0, 10) || '0000-00-00';
    const rows = [];
    Object.keys(R.acc).forEach(function (k) {
      const a = R.acc[k];
      let open = 0, sales = 0, rec = 0, adj = 0;
      a.entries.forEach(function (e) {
        if (e.date > asOf) return;
        if (e.date < from || e.type === 'OPENING') { open += e.dr - e.cr; return; }
        if (e.type === 'BILL') sales += e.dr; else if (e.type === 'RECEIPT') rec += e.cr; else adj += e.cr - e.dr;
      });
      const close = bnx71R2_(open + sales - rec - adj);
      if (Math.abs(open) < 0.01 && !sales && !rec && !adj && Math.abs(close) < 0.01) return;
      const c = R.customers.find(function (x) { return x.customerId === k; }) || {};
      rows.push({ CUSTOMER_ID: k, CUSTOMER_NAME: c.customer || a.name, OPENING_DUE: bnx71R2_(open), SALES_ON_CREDIT: bnx71R2_(sales), RECEIPTS: bnx71R2_(rec),
        ADJUSTMENTS: bnx71R2_(adj), CLOSING_DUE: close, STATUS: close > 0.01 ? ((c.overdueDays || 0) > 30 ? 'OVERDUE' : 'OPEN') : (close < -0.01 ? 'ADVANCE' : 'CLEAR') });
    });
    rows.sort(function (p, q) { return q.CLOSING_DUE - p.CLOSING_DUE; });
    return { success: true, data: { rows: rows, asOf: asOf, from: from === '0000-00-00' ? '' : from } };
  } catch (e) { return { success: false, error: e.message }; }
}
/* GET_CUSTOMER_LEDGER {customerId, from?, to?} — statement with running balance */
function bnx72GetCustomerLedger(session, payload) {
  try {
    const clientId = session.CLIENT_ID;
    const R = bnx72Receivables_(clientId);
    const cust = bnx72Customers_(clientId);
    const key = bnx72ResolveKey_(cust, payload.customerId, payload.customerName);
    const a = R.acc[key];
    const c = R.customers.find(function (x) { return x.customerId === key; });
    if (!a) return { success: true, data: { customerId: key, customer: payload.customerName || key.replace(/^N:/, ''), rows: [], openBills: [], closing: 0 } };
    const from = String(payload.from || '').slice(0, 10), to = String(payload.to || '').slice(0, 10) || '9999-12-31';
    let bal = 0, opening = 0; const rows = [];
    a.entries.forEach(function (e) {
      if (e.date > to) return;
      if (from && e.date < from) { opening += e.dr - e.cr; return; }
      if (!rows.length && from) { bal = opening; rows.push({ date: from, type: 'OPENING', ref: 'Brought forward', dr: opening > 0 ? bnx71R2_(opening) : 0, cr: opening < 0 ? bnx71R2_(-opening) : 0, balance: bnx71R2_(bal), note: '' }); }
      bal += e.dr - e.cr;
      rows.push({ date: e.date, type: e.type, ref: e.ref, billId: e.billId, dr: bnx71R2_(e.dr), cr: bnx71R2_(e.cr), balance: bnx71R2_(bal), note: e.note });
    });
    return { success: true, data: { customerId: key, customer: c ? c.customer : a.name, phone: c ? c.phone : '', gstin: c ? c.gstin : '', type: c ? c.type : '',
      creditLimit: c ? c.creditLimit : 0, rows: rows, closing: bnx71R2_(bal), aging: c ? c.aging : null,
      openBills: a.openBills.slice().sort(function (p, q) { return p.date < q.date ? -1 : 1; }) } };
  } catch (e) { return { success: false, error: e.message }; }
}

/* CUSTOMER_DUES row: OPENING_BALANCE = carried opening, CURRENT_BALANCE = opening still unpaid
   (negative = advance). Bill credit is NEVER accumulated here any more — bills are the truth. */
function bnx72DueRow_(clientId, key) {
  const sh = bnx72EnsureCols_(clientId, 'CUSTOMER_DUES', ['OPENING_DATE', 'CUSTOMER_NAME']);
  const v = sh.getDataRange().getValues(), h = v[0].map(String), x = bnx71Idx_(h);
  for (let r = 1; r < v.length; r++) if (String(v[r][x.CUSTOMER_ID]) === String(key) && String(v[r][x.CLIENT_ID] || clientId) === String(clientId))
    return { sh: sh, h: h, rowNo: r + 1, row: bnxRowToObject(v[r], h) };
  return { sh: sh, h: h, rowNo: 0, row: null };
}
function bnx72TouchCustomerDue_(clientId, customerId, amount, date, type) { /* kept for callers; balances derive from bills */ }
function bnxUpsertCustomerDue_(clientId, customerId, amount, date, type) { return bnx72TouchCustomerDue_(clientId, customerId, amount, date, type); }
function bnxAdjustCustomerDue_(clientId, customerId, delta, date, type) { return bnx72TouchCustomerDue_(clientId, customerId, delta, date, type); }

/* SAVE_DUES_RECEIPT {customerId|customerName, amount, paymentMode, date?, reference?, narration?, requestId?} */
function bnx72SaveDuesReceipt(session, payload) {
  const clientId = session.CLIENT_ID, userId = session.USER_ID || '';
  const amount = bnx71R2_(payload.amount != null ? payload.amount : payload.AMOUNT);
  if (!(amount > 0)) return { success: false, error: 'Amount must be greater than zero' };
  const lock = bnxAcquireScriptLockWithRetry_(3, 15000);
  try {
    const reqKey = payload.requestId ? 'rcpt72_' + clientId + '_' + payload.requestId : '';
    if (reqKey) { const hit = CacheService.getScriptCache().get(reqKey); if (hit) return JSON.parse(hit); }
    const cust = bnx72Customers_(clientId);
    const key = bnx72ResolveKey_(cust, payload.customerId || payload.CUSTOMER_ID, payload.customerName || payload.customer);
    const R = bnx72ReceivablesBuild_(clientId);
    const a = R.acc[key];
    const mode = bnx72Mode_(payload.paymentMode || payload.PAYMENT_MODE || payload.mode);
    const now = bnxNowParts_();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.date || '')) ? String(payload.date) : now.businessDate;
    const rid = generateShortId_(clientId, 'DUES_RECEIPT_ID');
    const fyY = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 4 ? 1 : 0);
    const vno = 'RV/' + String(fyY).slice(2) + '-' + String(fyY + 1).slice(2) + '/' + String(rid).replace(/\D/g, '').replace(/^0+/, '').padStart(5, '0');
    let left = amount, openingApplied = 0;
    /* 1) opening first */
    const dueRow = bnx72DueRow_(clientId, key);
    const openRem = dueRow.row ? bnx71R2_(dueRow.row.CURRENT_BALANCE) : 0;
    if (openRem > 0.01) { openingApplied = bnx71R2_(Math.min(left, openRem)); left = bnx71R2_(left - openingApplied); }
    /* 2) bills oldest first — one read, three column writes */
    const allocations = [];
    if (a && a.openBills.length && left > 0.01) {
      const sh = bnx72Sh_(clientId, 'BILL_MASTER');
      const v = sh.getDataRange().getValues(), h = v[0].map(String), x = bnx71Idx_(h);
      const bills = a.openBills.slice().sort(function (p, q) { return p.date < q.date ? -1 : p.date > q.date ? 1 : p.rowNo - q.rowNo; });
      const n = v.length - 1;
      const dueCol = v.slice(1).map(function (r) { return [r[x.DUE_AMOUNT]]; });
      const stCol = v.slice(1).map(function (r) { return [r[x.PAYMENT_STATUS]]; });
      const paidCol = x.PAID_AT !== undefined ? v.slice(1).map(function (r) { return [r[x.PAID_AT]]; }) : null;
      bills.forEach(function (b) {
        if (left <= 0.01) return;
        const i = b.rowNo - 2;
        if (i < 0 || i >= n || String(v[b.rowNo - 1][x.BILL_ID]) !== b.billId) return;
        const pay = bnx71R2_(Math.min(left, b.due));
        const nd = bnx71R2_(b.due - pay);
        dueCol[i][0] = nd; stCol[i][0] = nd <= 0.01 ? 'PAID' : 'PARTIAL';
        if (paidCol && nd <= 0.01) paidCol[i][0] = now.iso;
        left = bnx71R2_(left - pay);
        allocations.push({ billId: b.billId, billNo: b.billNo, billDate: b.date, paid: pay, balance: nd });
      });
      if (allocations.length) {
        sh.getRange(2, x.DUE_AMOUNT + 1, n, 1).setValues(dueCol);
        sh.getRange(2, x.PAYMENT_STATUS + 1, n, 1).setValues(stCol);
        if (paidCol) sh.getRange(2, x.PAID_AT + 1, n, 1).setValues(paidCol);
        bnx71MemoDrop_(clientId, (typeof SHEETS !== 'undefined' && SHEETS.BILL_MASTER) || 'BILL_MASTER');
        bnxAppendRowsBatch_(clientId, SHEETS.PAYMENT_MASTER, allocations.map(function (al) {
          return { PAYMENT_ID: generateShortId_(clientId, 'PAYMENT_ID'), CLIENT_ID: clientId, LOCATION_ID: '', BILL_ID: al.billId,
            CUSTOMER_ID: /^N:/.test(key) ? '' : key, PAYMENT_MODE_ID: '', PAYMENT_MODE: mode, AMOUNT: al.paid, PAYMENT_DATE: date, PAYMENT_TIME: now.time,
            REFERENCE: vno, PAYMENT_STATUS: 'SUCCESS', CREATED_BY: userId, CREATED_AT: now.iso, TIPS_AMOUNT: 0 };
        }));
      }
    }
    const allocated = bnx71R2_(allocations.reduce(function (s, x) { return s + x.paid; }, 0));
    const advance = bnx71R2_(left);
    /* 3) opening / advance bookkeeping */
    if (openingApplied > 0 || advance > 0) {
      const newCur = bnx71R2_(openRem - openingApplied - advance);
      if (dueRow.rowNo) bnx72SetRow_(dueRow.sh, dueRow.h, dueRow.rowNo, { CURRENT_BALANCE: newCur, LAST_TRANSACTION_DATE: date, LAST_TRANSACTION_TYPE: 'RECEIPT', UPDATED_AT: now.iso });
      else bnxAppendRowIndexed_(clientId, SHEETS.CUSTOMER_DUES || 'CUSTOMER_DUES', { CUSTOMER_DUES_ID: generateShortId_(clientId, 'CUSTOMER_DUES_ID'), CLIENT_ID: clientId,
        CUSTOMER_ID: key, CUSTOMER_NAME: a ? a.name : (payload.customerName || ''), OPENING_BALANCE: 0, CURRENT_BALANCE: newCur, LAST_TRANSACTION_DATE: date,
        LAST_TRANSACTION_TYPE: 'ADVANCE', STATUS: 'ACTIVE', UPDATED_AT: now.iso });
    }
    /* 4) receipt voucher */
    bnx72EnsureCols_(clientId, 'DUES_RECEIPT', ['VOUCHER_NO', 'CUSTOMER_KEY', 'CUSTOMER_NAME', 'ALLOCATED_AMOUNT', 'OPENING_APPLIED', 'ADVANCE_AMOUNT', 'NARRATION', 'STATUS']);
    const rcpt = { DUES_RECEIPT_ID: rid, CLIENT_ID: clientId, CUSTOMER_ID: /^N:/.test(key) ? '' : key, CUSTOMER_KEY: key,
      CUSTOMER_NAME: (R.customers.find(function (c) { return c.customerId === key; }) || {}).customer || payload.customerName || '',
      AMOUNT: amount, PAYMENT_MODE: mode, REFERENCE: String(payload.reference || ''), RECEIPT_DATE: date, RECEIPT_TIME: now.time, CREATED_BY: userId, CREATED_AT: now.iso,
      VOUCHER_NO: vno, ALLOCATED_AMOUNT: allocated, OPENING_APPLIED: openingApplied, ADVANCE_AMOUNT: advance, NARRATION: String(payload.narration || ''), STATUS: 'POSTED' };
    bnxAppendRowIndexed_(clientId, SHEETS.DUES_RECEIPT || 'DUES_RECEIPT', rcpt);
    /* 5) balanced journal: DR Cash/Bank · CR Customer Dues */
    let ledgerWarning = '';
    try {
      const drAcct = mode === 'CASH' ? bnxGetOrCreateLedgerAccount_(clientId, 'CASH', 'Cash', 'ASSET') : bnxGetOrCreateLedgerAccount_(clientId, 'BANK', 'Bank', 'ASSET');
      const crAcct = bnxGetOrCreateLedgerAccount_(clientId, 'CUSTOMER_DUES', 'Customer Dues', 'ASSET');
      const jid = generateShortId_(clientId, 'JOURNAL_ID');
      bnxAppendRow(clientId, SHEETS.JOURNAL, { JOURNAL_ID: jid, CLIENT_ID: clientId, LOCATION_ID: '', JOURNAL_DATE: date, JOURNAL_TYPE: 'RECEIPT', SOURCE_TYPE: 'DUES_RECEIPT',
        SOURCE_ID: rid, REFERENCE_NUMBER: vno, DESCRIPTION: 'Receipt ' + vno + ' · ' + rcpt.CUSTOMER_NAME, TOTAL_DEBIT: amount, TOTAL_CREDIT: amount, CREATED_BY: userId, CREATED_AT: now.iso });
      bnxAppendRowsBatch_(clientId, SHEETS.LEDGER_ENTRIES, [
        { LEDGER_ENTRY_ID: generateShortId_(clientId, 'LEDGER_ENTRY_ID'), JOURNAL_ID: jid, LEDGER_ID: drAcct, ACCOUNT: drAcct, DEBIT: amount, CREDIT: 0, DESCRIPTION: 'Receipt ' + vno, CREATED_AT: now.iso },
        { LEDGER_ENTRY_ID: generateShortId_(clientId, 'LEDGER_ENTRY_ID'), JOURNAL_ID: jid, LEDGER_ID: crAcct, ACCOUNT: crAcct, DEBIT: 0, CREDIT: amount, DESCRIPTION: 'Receipt ' + vno, CREATED_AT: now.iso }]);
    } catch (le) { ledgerWarning = le.message; bnxLogError(clientId, 'LEDGER_POST_PENDING receipt ' + vno + ': ' + le.message, {}); }
    bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: userId, ACTION: 'CREATE', MODULE: 'CREDIT', RECORD_TYPE: 'DUES_RECEIPT', RECORD_ID: rid,
      OLD_VALUE: '{}', NEW_VALUE: JSON.stringify({ rcpt: rcpt, allocations: allocations }), REQUEST_ID: payload.requestId || '', TIMESTAMP: now.iso });
    bnx71BumpReportVersion_(clientId);
    const out = { success: true, transactionId: rid, data: { receiptId: rid, voucherNo: vno, customerId: key, customer: rcpt.CUSTOMER_NAME, amount: amount, mode: mode, date: date,
      time: now.time, allocations: allocations, allocated: allocated, openingApplied: openingApplied, advance: advance } };
    if (ledgerWarning) out.ledgerWarning = ledgerWarning;
    if (reqKey) try { CacheService.getScriptCache().put(reqKey, JSON.stringify(out), 3600); } catch (e) {}
    return out;
  } catch (e) {
    bnxLogError(clientId, 'SAVE_DUES_RECEIPT failed: ' + e.message, payload || {});
    return { success: false, error: e.message };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* SAVE_CREDIT_CUSTOMER {customerId?, name, phone, type, gstin, creditLimit, creditDays, email, openingBalance?, openingDate?} */
function bnx72UpsertCreditCustomer_(clientId, userId, c) {
  const name = String(c.name || c.customerName || c.CUSTOMER_NAME || '').trim();
  if (!name) throw new Error('Customer name is required');
  const sh = bnx72EnsureCols_(clientId, 'CUSTOMER_MASTER', ['GSTIN', 'CREDIT_LIMIT', 'CREDIT_DAYS']);
  const cust = bnx72Customers_(clientId);
  let id = String(c.customerId || '').trim();
  if (/^N:/.test(id)) id = '';
  if (!id || !cust.byId[id]) id = cust.idByName[bnx72NormName_(name)] || '';
  const nowIso = new Date().toISOString();
  const fields = { CUSTOMER_NAME: name, PHONE: String(c.phone || c.mobile || ''), EMAIL: String(c.email || ''), CUSTOMER_TYPE: String(c.type || 'Individual'),
    GSTIN: String(c.gstin || '').toUpperCase(), CREDIT_LIMIT: bnx71Num_(c.creditLimit), CREDIT_DAYS: bnx71Num_(c.creditDays), IS_ACTIVE: true, UPDATED_AT: nowIso };
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  if (id && cust.byId[id]) {
    const keep = {}; Object.keys(fields).forEach(function (k) { if (fields[k] !== '' || k === 'GSTIN') keep[k] = fields[k]; });
    bnx72SetRow_(sh, h, cust.byId[id].rowNo, keep);
  } else {
    id = generateShortId_(clientId, 'CUSTOMER_ID');
    bnxAppendRowIndexed_(clientId, SHEETS.CUSTOMER_MASTER || 'CUSTOMER_MASTER', Object.assign({ CUSTOMER_ID: id, CLIENT_ID: clientId, LOCATION_ID: '', CREATED_AT: nowIso }, fields));
  }
  bnx71MemoDrop_(clientId, SHEETS.CUSTOMER_MASTER || 'CUSTOMER_MASTER');
  if (c.openingBalance !== undefined && c.openingBalance !== '' && c.openingBalance !== null) {
    const ob = bnx71R2_(c.openingBalance);
    const od = /^\d{4}-\d{2}-\d{2}$/.test(String(c.openingDate || '')) ? String(c.openingDate) : bnx72Today_();
    let dr = bnx72DueRow_(clientId, id);
    if (!dr.rowNo) { const nk = 'N:' + bnx72NormName_(name); const d2 = bnx72DueRow_(clientId, nk); if (d2.rowNo) { bnx72SetRow_(d2.sh, d2.h, d2.rowNo, { CUSTOMER_ID: id }); dr = bnx72DueRow_(clientId, id); } }
    if (dr.rowNo) {
      const old = dr.row || {};
      const paidAgainst = bnx71R2_(bnx71Num_(old.OPENING_BALANCE) - bnx71Num_(old.CURRENT_BALANCE));
      bnx72SetRow_(dr.sh, dr.h, dr.rowNo, { OPENING_BALANCE: ob, CURRENT_BALANCE: bnx71R2_(ob - paidAgainst), OPENING_DATE: od, CUSTOMER_NAME: name, UPDATED_AT: nowIso });
    } else {
      bnxAppendRowIndexed_(clientId, SHEETS.CUSTOMER_DUES || 'CUSTOMER_DUES', { CUSTOMER_DUES_ID: generateShortId_(clientId, 'CUSTOMER_DUES_ID'), CLIENT_ID: clientId,
        LOCATION_ID: '', CUSTOMER_ID: id, CUSTOMER_NAME: name, OPENING_BALANCE: ob, CURRENT_BALANCE: ob, OPENING_DATE: od, LAST_TRANSACTION_DATE: od,
        LAST_TRANSACTION_TYPE: 'OPENING', STATUS: 'ACTIVE', UPDATED_AT: nowIso });
    }
  }
  return id;
}
function bnx72SaveCreditCustomer(session, payload) {
  const lock = bnxAcquireScriptLockWithRetry_(3, 10000);
  try {
    const id = bnx72UpsertCreditCustomer_(session.CLIENT_ID, session.USER_ID, payload.customer || payload);
    bnxInvalidateMasterCache_(session.CLIENT_ID);
    return { success: true, transactionId: id, data: { customerId: id } };
  } catch (e) { return { success: false, error: e.message }; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}
/* SAVE_CUSTOMER_OPENING_BALANCES {rows:[{name,phone,type,gstin,creditLimit,creditDays,openingBalance,openingDate}]} */
function bnx72SaveOpeningBalances(session, payload) {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!rows.length) return { success: false, error: 'No rows to import' };
  if (rows.length > 500) return { success: false, error: 'Maximum 500 customers per upload' };
  const lock = bnxAcquireScriptLockWithRetry_(3, 20000);
  const done = [], failed = [];
  try {
    rows.forEach(function (r, i) {
      try { done.push({ row: i + 2, customerId: bnx72UpsertCreditCustomer_(session.CLIENT_ID, session.USER_ID, r), name: r.name || r.customerName }); }
      catch (e) { failed.push({ row: i + 2, name: r.name || '', error: e.message }); }
    });
    bnxInvalidateMasterCache_(session.CLIENT_ID);
    return { success: failed.length === 0 || done.length > 0, data: { imported: done.length, failed: failed }, error: failed.length && !done.length ? failed[0].error : undefined };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* ---------- GET_ACCOUNTS_DAY {date} — overview tiles + day book vouchers ---------- */
function bnx72GetAccountsDay(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.date || '')) ? String(payload.date) : bnx72Today_();
    return bnxCachedReport_('acctday72|' + clientId + '|' + d, 120, function () {
      const dsr = bnx71DsrBuildRange_(clientId, d, d)[d] || bnx71DsrBlank_();
      const vouchers = [];
      /* sales vouchers */
      const bm = bnx72Vals_(clientId, 'BILL_MASTER');
      const payByBill = {};
      const pm = bnx72Vals_(clientId, 'PAYMENT_MASTER');
      for (let r = 1; r < pm.v.length; r++) {
        const row = pm.v[r];
        if (String(bnx72G_(row, pm.x, 'CLIENT_ID')) !== String(clientId) || !bnx71PaymentActive_(bnx72G_(row, pm.x, 'PAYMENT_STATUS'))) continue;
        if (bnxNormalizeDateKey_(bnx72G_(row, pm.x, 'PAYMENT_DATE')) !== d) continue;
        const bid = String(bnx72G_(row, pm.x, 'BILL_ID') || '');
        (payByBill[bid] = payByBill[bid] || []).push({ mode: String(bnx72G_(row, pm.x, 'PAYMENT_MODE') || ''), amount: bnx71Num_(bnx72G_(row, pm.x, 'AMOUNT')),
          ref: String(bnx72G_(row, pm.x, 'REFERENCE') || ''), time: String(bnx72G_(row, pm.x, 'PAYMENT_TIME') || '') });
      }
      const billDay = {};
      for (let r = 1; r < bm.v.length; r++) {
        const row = bm.v[r];
        if (String(bnx72G_(row, bm.x, 'CLIENT_ID')) !== String(clientId)) continue;
        const bid = String(bnx72G_(row, bm.x, 'BILL_ID') || '');
        const bd = bnxNormalizeDateKey_(bnx72G_(row, bm.x, 'BILL_DATE'));
        billDay[bid] = { d: bd, no: String(bnx72G_(row, bm.x, 'BILL_NUMBER') || bid), cust: String(bnx72G_(row, bm.x, 'CUSTOMER_NAME') || '') };
        if (bd !== d) continue;
        const st = String(bnx72G_(row, bm.x, 'BILL_STATUS') || '').toUpperCase();
        if (st === 'CANCELLED' || st === 'VOID') continue;
        const grand = bnx71R2_(bnx72G_(row, bm.x, 'GRAND_TOTAL'));
        const pays = (payByBill[bid] || []).filter(function (p) { return !/^(CREDIT|DUE)$/i.test(p.mode); });
        const paid = pays.reduce(function (s, p) { return s + p.amount; }, 0);
        const modes = pays.map(function (p) { return p.mode; }).filter(function (m, i, a) { return a.indexOf(m) === i; }).join('+');
        const credit = bnx71R2_(Math.max(0, grand - paid));
        const pst = String(bnx72G_(row, bm.x, 'PAYMENT_STATUS') || '').toUpperCase();
        vouchers.push({ time: String(bnx72G_(row, bm.x, 'BILL_TIME') || ''), voucherNo: billDay[bid].no, type: 'Sales',
          account: (paid > 0.01 ? (modes || 'Paid') : '') + (credit > 0.01 && BNX72_DUE_SET_[pst] ? (paid > 0.01 ? ' + ' : '') + 'Credit: ' + (billDay[bid].cust || 'Guest') : '') || (modes || 'Sales'),
          debit: grand, credit: grand, narration: 'Sale ' + (bnx72G_(row, bm.x, 'TABLE_ID') ? 'Table ' + bnx72G_(row, bm.x, 'TABLE_ID') : '') + (st === 'NON_CHARGE' ? ' (NC)' : ''), source: 'BILL' });
      }
      /* receipts against earlier bills */
      Object.keys(payByBill).forEach(function (bid) {
        const b = billDay[bid]; if (!b || b.d === d || !b.d) return;
        payByBill[bid].forEach(function (p) {
          if (/^(CREDIT|DUE)$/i.test(p.mode)) return;
          vouchers.push({ time: p.time, voucherNo: p.ref || b.no, type: 'Receipt', account: p.mode + ' ← ' + (b.cust || 'Customer'), debit: p.amount, credit: p.amount,
            narration: 'Due received against ' + b.no + ' (' + b.d + ')', source: 'PAYMENT' });
        });
      });
      /* opening/advance receipts */
      const dr = bnx72Vals_(clientId, 'DUES_RECEIPT');
      for (let r = 1; r < dr.v.length; r++) {
        const row = dr.v[r];
        if (String(bnx72G_(row, dr.x, 'CLIENT_ID')) !== String(clientId) || bnxNormalizeDateKey_(bnx72G_(row, dr.x, 'RECEIPT_DATE')) !== d) continue;
        const rest = bnx71R2_(bnx71Num_(bnx72G_(row, dr.x, 'AMOUNT')) - bnx71Num_(bnx72G_(row, dr.x, 'ALLOCATED_AMOUNT')));
        if (rest <= 0.01) continue;
        vouchers.push({ time: String(bnx72G_(row, dr.x, 'RECEIPT_TIME') || ''), voucherNo: String(bnx72G_(row, dr.x, 'VOUCHER_NO') || bnx72G_(row, dr.x, 'DUES_RECEIPT_ID')),
          type: 'Receipt', account: String(bnx72G_(row, dr.x, 'PAYMENT_MODE') || '') + ' ← ' + String(bnx72G_(row, dr.x, 'CUSTOMER_NAME') || ''), debit: rest, credit: rest,
          narration: 'Opening balance / advance received', source: 'DUES_RECEIPT' });
      }
      /* cash movements & petty cash */
      let cashIn = 0, cashOut = 0, pettyOut = 0, pettyIn = 0;
      const cm = bnx72Vals_(clientId, 'CASH_MOVEMENT');
      for (let r = 1; r < cm.v.length; r++) {
        const row = cm.v[r];
        if (String(bnx72G_(row, cm.x, 'CLIENT_ID')) !== String(clientId) || bnxNormalizeDateKey_(bnx72G_(row, cm.x, 'DATE')) !== d) continue;
        if (/^(CANCELLED|VOID)$/i.test(String(bnx72G_(row, cm.x, 'STATUS') || ''))) continue;
        const amt = bnx71Num_(bnx72G_(row, cm.x, 'AMOUNT')), dir = String(bnx72G_(row, cm.x, 'DIRECTION') || '').toUpperCase();
        const isIn = dir === 'IN' || dir === 'RECEIPT' || dir === 'CREDIT';
        const isCash = bnx72Mode_(bnx72G_(row, cm.x, 'PAYMENT_MODE')) === 'CASH';
        if (isCash) { if (isIn) cashIn += amt; else cashOut += amt; }
        vouchers.push({ time: String(bnx72G_(row, cm.x, 'TIME') || ''), voucherNo: String(bnx72G_(row, cm.x, 'MOVEMENT_ID') || ''), type: isIn ? 'Receipt' : 'Payment',
          account: String(bnx72G_(row, cm.x, 'CATEGORY') || 'Cash'), debit: amt, credit: amt, narration: String(bnx72G_(row, cm.x, 'DESCRIPTION') || ''), source: 'CASH_BOOK' });
      }
      const pc = bnx72Vals_(clientId, 'PETTY_CASH');
      for (let r = 1; r < pc.v.length; r++) {
        const row = pc.v[r];
        if (String(bnx72G_(row, pc.x, 'CLIENT_ID')) !== String(clientId) || bnxNormalizeDateKey_(bnx72G_(row, pc.x, 'DATE')) !== d) continue;
        if (/^(CANCELLED|VOID|DELETED)$/i.test(String(bnx72G_(row, pc.x, 'STATUS') || ''))) continue;
        const amt = bnx71Num_(bnx72G_(row, pc.x, 'AMOUNT')), isIn = /RECEIPT|IN|IMPREST/i.test(String(bnx72G_(row, pc.x, 'TYPE') || ''));
        if (isIn) pettyIn += amt; else pettyOut += amt;
        vouchers.push({ time: String(bnx72G_(row, pc.x, 'TIME') || ''), voucherNo: String(bnx72G_(row, pc.x, 'VOUCHER_ID') || ''), type: isIn ? 'Receipt' : 'Payment',
          account: 'Petty: ' + String(bnx72G_(row, pc.x, 'CATEGORY') || ''), debit: amt, credit: amt, narration: String(bnx72G_(row, pc.x, 'DESCRIPTION') || ''), source: 'PETTY_CASH' });
      }
      /* opening cash = last counted/closing cash before this date */
      let openingCash = 0, openingNote = 'No closing cash recorded before ' + d;
      const dc = bnx72Vals_(clientId, 'DAILY_COLLECTION');
      let best = '';
      for (let r = 1; r < dc.v.length; r++) {
        const row = dc.v[r], k = bnxNormalizeDateKey_(bnx72G_(row, dc.x, 'COLLECTION_DATE'));
        if (String(bnx72G_(row, dc.x, 'CLIENT_ID')) !== String(clientId) || !k || k >= d || k < best) continue;
        const cc = bnx72G_(row, dc.x, 'CLOSING_CASH'); if (cc === '' || cc === null) continue;
        best = k; openingCash = bnx71Num_(cc); openingNote = 'Closing cash of ' + k;
      }
      const ds = bnx72Vals_(clientId, 'DAY_STATUS');
      for (let r = 1; r < ds.v.length; r++) {
        const row = ds.v[r], k = bnxNormalizeDateKey_(bnx72G_(row, ds.x, 'BUSINESS_DATE'));
        if (String(bnx72G_(row, ds.x, 'CLIENT_ID')) !== String(clientId) || !k || k >= d || k < best) continue;
        const cc = bnx72G_(row, ds.x, 'CASH_COUNTED'); if (cc === '' || cc === null) continue;
        best = k; openingCash = bnx71Num_(cc); openingNote = 'Cash counted at day close ' + k;
      }
      vouchers.sort(function (p, q) { return String(p.time) < String(q.time) ? -1 : 1; });
      const cashSales = dsr.cash, dueCash = dsr.dueReceivedCash;
      const closing = bnx71R2_(openingCash + cashSales + dueCash + cashIn + pettyIn - cashOut - pettyOut);
      return { success: true, data: { date: d, bills: dsr.bills, sales: dsr.netSale, grossSale: dsr.grossSale, tax: dsr.tax, discount: dsr.discount,
        collection: bnx71R2_(dsr.cash + dsr.iciciCard + dsr.iciciGpay + dsr.zomato + dsr.swiggy + dsr.online + dsr.other + dsr.unallocatedPaid),
        creditSales: dsr.guestDueSales, dueReceived: bnx71R2_(dsr.dueReceivedCash + dsr.dueReceivedIcici), dueReceivedCash: dueCash, dueReceivedBank: dsr.dueReceivedIcici,
        modes: { cash: dsr.cash, upi: bnx71R2_(dsr.iciciGpay + dsr.online), card: dsr.iciciCard, zomato: dsr.zomato, swiggy: dsr.swiggy, other: bnx71R2_(dsr.other + dsr.unallocatedPaid) },
        cash: { opening: openingCash, openingNote: openingNote, sales: cashSales, dueReceived: dueCash, otherIn: bnx71R2_(cashIn + pettyIn), expenses: bnx71R2_(cashOut + pettyOut), closing: closing },
        vouchers: vouchers } };
    });
  } catch (e) { bnxLogError(clientId, 'GET_ACCOUNTS_DAY failed: ' + e.message, payload || {}); return { success: false, error: e.message }; }
}

/* ---------- TABLE FLOOR (status from real open orders) ---------- */
var BNX72_CLOSED_ORDER_ = { BILLED: 1, COMPLETED: 1, CANCELLED: 1, CANCELED: 1, SETTLED: 1, CLOSED: 1, VOID: 1, MERGED: 1, PAID: 1 };
function bnx72OpenOrders_(clientId) {
  const today = bnx72Today_(), yday = bnxBusinessDateOffset_(today, -1);
  const om = bnx72Vals_(clientId, 'ORDER_MASTER');
  const open = [];
  for (let r = om.v.length - 1; r >= 1; r--) {
    const row = om.v[r];
    if (String(bnx72G_(row, om.x, 'CLIENT_ID')) !== String(clientId)) continue;
    const od = bnxNormalizeDateKey_(bnx72G_(row, om.x, 'ORDER_DATE'));
    if (od && od < yday) { if (r < om.v.length - 3000) break; continue; }
    const st = String(bnx72G_(row, om.x, 'ORDER_STATUS') || '').toUpperCase();
    if (BNX72_CLOSED_ORDER_[st]) continue;
    const src = String(bnx72G_(row, om.x, 'ORDER_SOURCE') || '').toUpperCase();
    if (/^HISTORICAL/.test(src)) continue;
    open.push({ rowNo: r + 1, orderId: String(bnx72G_(row, om.x, 'ORDER_ID') || ''), orderNo: String(bnx72G_(row, om.x, 'ORDER_NUMBER') || ''),
      table: String(bnx72G_(row, om.x, 'TABLE_ID') || '').trim(), date: od, time: bnx72TimeStr_(bnx72G_(row, om.x, 'ORDER_TIME')),
      pax: bnx71Num_(bnx72G_(row, om.x, 'PAX')), status: st,
      captain: String(bnx72G_(row, om.x, 'CAPTAIN_NAME') || bnx72G_(row, om.x, 'STEWARD_NAME') || bnx72G_(row, om.x, 'CREATED_BY_NAME') || ''),
      customer: String(bnx72G_(row, om.x, 'CUSTOMER_NAME') || '') });
  }
  return { list: open, sheetVals: om };
}
function bnx72TimeStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, bnx71Tz_(), 'HH:mm:ss');
  return String(v || '');
}
function bnx72GetTableFloor(session, payload) {
  const clientId = session.CLIENT_ID;
  try {
    const tz = bnx71Tz_(), now = new Date();
    const nowKey = Utilities.formatDate(now, tz, 'yyyy-MM-dd'), nowHm = Utilities.formatDate(now, tz, 'HH:mm:ss').split(':').map(Number), nowMin = nowHm[0] * 60 + nowHm[1];
    const today = bnx72Today_();
    const tm = bnx72Vals_(clientId, 'TABLE_MASTER');
    const tables = [], byNo = {};
    for (let r = 1; r < tm.v.length; r++) {
      const row = tm.v[r];
      if (String(bnx72G_(row, tm.x, 'CLIENT_ID') || clientId) !== String(clientId)) continue;
      const act = bnx72G_(row, tm.x, 'IS_ACTIVE');
      if (act === false || /^(FALSE|NO|0|INACTIVE)$/i.test(String(act))) continue;
      const no = String(bnx72G_(row, tm.x, 'TABLE_NUMBER') || bnx72G_(row, tm.x, 'TABLE_ID') || '').trim(); if (!no) continue;
      const t = { tableNo: no, tableId: String(bnx72G_(row, tm.x, 'TABLE_ID') || no), zone: String(bnx72G_(row, tm.x, 'SECTION') || ''), pax: bnx71Num_(bnx72G_(row, tm.x, 'CAPACITY')) || 4,
        minSpend: bnx71Num_(bnx72G_(row, tm.x, 'MIN_SPEND')), status: 'AVAILABLE', guests: 0, startTime: '', elapsedMin: 0, amount: 0, items: 0, kotCount: 0,
        captain: '', orderId: '', orderNo: '', orders: 0, customer: '', reservation: null };
      tables.push(t); byNo[no.toUpperCase()] = t; byNo[t.tableId.toUpperCase()] = t;
    }
    const OO = bnx72OpenOrders_(clientId);
    const openIds = {};
    OO.list.forEach(function (o) {
      if (!o.table) return;
      let t = byNo[o.table.toUpperCase()];
      if (!t) { t = { tableNo: o.table, tableId: o.table, zone: 'Other', pax: 4, minSpend: 0, status: 'AVAILABLE', guests: 0, startTime: '', elapsedMin: 0, amount: 0, items: 0, kotCount: 0, captain: '', orderId: '', orderNo: '', orders: 0, customer: '', reservation: null, adHoc: true };
        tables.push(t); byNo[o.table.toUpperCase()] = t; }
      t.status = 'OCCUPIED'; t.orders++;
      openIds[o.orderId] = t; if (o.orderNo) openIds[o.orderNo] = t;
      if (!t.orderId || (o.date + o.time) < (t._start || '9')) {
        t._start = o.date + o.time; t.startTime = o.time; t.orderId = o.orderId; t.orderNo = o.orderNo;
        const p = String(o.time).split(':').map(Number);
        const startMin = (p[0] || 0) * 60 + (p[1] || 0);
        t.elapsedMin = Math.max(0, (o.date === nowKey ? 0 : bnx72DaysBetween_(o.date, nowKey) * 1440) + nowMin - startMin);
      }
      t.guests = Math.max(t.guests, o.pax); if (o.captain) t.captain = o.captain; if (o.customer && !/GENERAL/i.test(o.customer)) t.customer = o.customer;
    });
    /* running amount from ORDER_ITEMS of open orders */
    if (Object.keys(openIds).length) {
      const oi = bnx72Vals_(clientId, 'ORDER_ITEMS');
      for (let r = oi.v.length - 1; r >= 1; r--) {
        const row = oi.v[r];
        const t = openIds[String(bnx72G_(row, oi.x, 'ORDER_ID') || '')]; if (!t) continue;
        if (/CANCEL|VOID|DELETED/i.test(String(bnx72G_(row, oi.x, 'ITEM_STATUS') || ''))) continue;
        const qty = bnx71Num_(bnx72G_(row, oi.x, 'QUANTITY'));
        const lt = bnx72G_(row, oi.x, 'LINE_TOTAL');
        t.amount += (lt === '' || lt === null) ? qty * bnx71Num_(bnx72G_(row, oi.x, 'RATE')) : bnx71Num_(lt);
        t.items += qty;
      }
    }
    /* open KOTs */
    const km = bnx72Vals_(clientId, 'KOT_MASTER');
    for (let r = km.v.length - 1; r >= 1; r--) {
      const row = km.v[r];
      if (String(bnx72G_(row, km.x, 'CLIENT_ID')) !== String(clientId)) continue;
      const kd = bnxNormalizeDateKey_(bnx72G_(row, km.x, 'KOT_DATE'));
      if (kd && kd < bnxBusinessDateOffset_(today, -1)) continue;
      if (/SERVED|CANCEL|CLOSED|COMPLETED|BILLED/i.test(String(bnx72G_(row, km.x, 'KOT_STATUS') || ''))) continue;
      const oid = String(bnx72G_(row, km.x, 'ORDER_ID') || '');
      const t = openIds[oid] || byNo[String(bnx72G_(row, km.x, 'TABLE_ID') || '').toUpperCase()];
      if (t && t.status === 'OCCUPIED') { t.kotCount++; if (!t.captain) t.captain = String(bnx72G_(row, km.x, 'CAPTAIN_NAME') || bnx72G_(row, km.x, 'STEWARD_NAME') || ''); }
    }
    /* reservations for today within the next 2 h (or seated late up to 30 min) */
    const rm = bnx72Vals_(clientId, 'RESERVATION_MASTER');
    for (let r = 1; r < rm.v.length; r++) {
      const row = rm.v[r];
      if (String(bnx72G_(row, rm.x, 'CLIENT_ID')) !== String(clientId)) continue;
      if (bnxNormalizeDateKey_(bnx72G_(row, rm.x, 'RES_DATE')) !== today) continue;
      if (/CANCEL|SEATED|NO.?SHOW|COMPLETED|CLOSED/i.test(String(bnx72G_(row, rm.x, 'STATUS') || ''))) continue;
      const t = byNo[String(bnx72G_(row, rm.x, 'TABLE_ID') || '').toUpperCase()]; if (!t) continue;
      const rt = bnx72TimeStr_(bnx72G_(row, rm.x, 'RES_TIME')).split(':').map(Number), rMin = (rt[0] || 0) * 60 + (rt[1] || 0);
      const res = { id: String(bnx72G_(row, rm.x, 'RESERVATION_ID') || ''), guest: String(bnx72G_(row, rm.x, 'GUEST_NAME') || ''), phone: String(bnx72G_(row, rm.x, 'PHONE') || ''),
        time: bnx72TimeStr_(bnx72G_(row, rm.x, 'RES_TIME')).slice(0, 5), covers: bnx71Num_(bnx72G_(row, rm.x, 'COVERS')) };
      if (!t.reservation || rMin < t._resMin) { t.reservation = res; t._resMin = rMin; }
      if (t.status === 'AVAILABLE' && rMin - nowMin <= 120 && nowMin - rMin <= 30) { t.status = 'RESERVED'; t.guests = res.covers; t.customer = res.guest; }
    }
    /* manual CLEANING flag from TABLE_LIVE_STATE (only when no open order) */
    const ls = bnx72Vals_(clientId, 'TABLE_LIVE_STATE');
    for (let r = 1; r < ls.v.length; r++) {
      const row = ls.v[r];
      if (String(bnx72G_(row, ls.x, 'CLIENT_ID')) !== String(clientId)) continue;
      const t = byNo[String(bnx72G_(row, ls.x, 'TABLE_NO') || '').toUpperCase()]; if (!t) continue;
      const st = String(bnx72G_(row, ls.x, 'STATUS') || '').toUpperCase();
      if (st === 'CLEANING' && t.status === 'AVAILABLE') t.status = 'CLEANING';
      if (st === 'RESERVED' && t.status === 'AVAILABLE') t.status = 'RESERVED';
      if (!t.captain) t.captain = String(bnx72G_(row, ls.x, 'CAPTAIN_NAME') || bnx72G_(row, ls.x, 'STEWARD_NAME') || '');
    }
    const kpi = { available: 0, occupied: 0, running: 0, reserved: 0, cleaning: 0, total: tables.length, seats: 0, guests: 0, runningValue: 0 };
    tables.forEach(function (t) {
      delete t._start; delete t._resMin; t.amount = bnx71R2_(t.amount);
      kpi.seats += t.pax;
      if (t.status === 'OCCUPIED') { kpi.guests += t.guests; kpi.runningValue += t.amount; if (t.elapsedMin < 20) kpi.running++; else kpi.occupied++; }
      else if (t.status === 'RESERVED') kpi.reserved++; else if (t.status === 'CLEANING') kpi.cleaning++; else kpi.available++;
    });
    kpi.runningValue = bnx71R2_(kpi.runningValue);
    return { success: true, data: { tables: tables, kpi: kpi, asOf: Utilities.formatDate(now, tz, 'HH:mm:ss') } };
  } catch (e) { bnxLogError(clientId, 'GET_TABLE_FLOOR failed: ' + e.message, {}); return { success: false, error: e.message }; }
}
/* TRANSFER_TABLE {fromTable, toTable} and MERGE_TABLES {fromTable, toTable} */
function bnx72MoveTable_(session, payload, merge) {
  const clientId = session.CLIENT_ID;
  const from = String(payload.fromTable || payload.from || '').trim(), to = String(payload.toTable || payload.to || '').trim();
  if (!from || !to || from.toUpperCase() === to.toUpperCase()) return { success: false, error: 'Choose two different tables' };
  const lock = bnxAcquireScriptLockWithRetry_(3, 15000);
  try {
    const OO = bnx72OpenOrders_(clientId);
    const src = OO.list.filter(function (o) { return o.table.toUpperCase() === from.toUpperCase(); });
    const dst = OO.list.filter(function (o) { return o.table.toUpperCase() === to.toUpperCase(); });
    if (!src.length) return { success: false, error: 'Table ' + from + ' has no running order' };
    if (dst.length && !merge) return { success: false, error: 'Table ' + to + ' is occupied — use Merge instead' };
    const now = bnxNowParts_();
    const oSh = bnx72Sh_(clientId, 'ORDER_MASTER'), oh = OO.sheetVals.v[0].map(String);
    const target = merge && dst.length ? dst[dst.length - 1] : null;
    const idMap = {};
    src.forEach(function (o) {
      if (target) {
        idMap[o.orderId] = target.orderId; if (o.orderNo) idMap[o.orderNo] = target.orderNo || target.orderId;
        bnx72SetRow_(oSh, oh, o.rowNo, { ORDER_STATUS: 'MERGED', TABLE_ID: to, UPDATED_AT: now.iso,
          SPECIAL_INSTRUCTIONS: 'Merged into ' + (target.orderNo || target.orderId) + ' (table ' + to + ')' });
      } else {
        bnx72SetRow_(oSh, oh, o.rowNo, { TABLE_ID: to, UPDATED_AT: now.iso });
      }
    });
    bnx71MemoDrop_(clientId, SHEETS.ORDER_MASTER || 'ORDER_MASTER');
    let movedItems = 0;
    if (target) {
      const iSh = bnx72Sh_(clientId, 'ORDER_ITEMS'), iv = iSh.getDataRange().getValues(), ix = bnx71Idx_(iv[0]);
      const col = iv.slice(1).map(function (r) { return [r[ix.ORDER_ID]]; });
      let seqMax = 0;
      iv.slice(1).forEach(function (r) { if (String(r[ix.ORDER_ID]) === target.orderId) seqMax = Math.max(seqMax, bnx71Num_(r[ix.SEQUENCE])); });
      const seqCol = ix.SEQUENCE !== undefined ? iv.slice(1).map(function (r) { return [r[ix.SEQUENCE]]; }) : null;
      col.forEach(function (c, i) { if (idMap[String(c[0])] && src.some(function (o) { return o.orderId === String(c[0]); })) { c[0] = target.orderId; movedItems++; if (seqCol) seqCol[i][0] = ++seqMax; } });
      if (movedItems) {
        iSh.getRange(2, ix.ORDER_ID + 1, col.length, 1).setValues(col);
        if (seqCol) iSh.getRange(2, ix.SEQUENCE + 1, seqCol.length, 1).setValues(seqCol);
        bnx71MemoDrop_(clientId, SHEETS.ORDER_ITEMS || 'ORDER_ITEMS');
      }
    }
    /* KOTs follow the order/table */
    const kSh = bnx72Sh_(clientId, 'KOT_MASTER'), kv = kSh.getDataRange().getValues(), kx = bnx71Idx_(kv[0] || []);
    let movedKots = 0;
    if (kv.length > 1 && kx.TABLE_ID !== undefined) {
      const srcIds = {}; src.forEach(function (o) { srcIds[o.orderId] = 1; if (o.orderNo) srcIds[o.orderNo] = 1; });
      const tCol = kv.slice(1).map(function (r) { return [r[kx.TABLE_ID]]; });
      const oCol = kx.ORDER_ID !== undefined ? kv.slice(1).map(function (r) { return [r[kx.ORDER_ID]]; }) : null;
      kv.slice(1).forEach(function (r, i) {
        const oid = oCol ? String(r[kx.ORDER_ID] || '') : '';
        if (!(srcIds[oid] || (String(r[kx.TABLE_ID]).toUpperCase() === from.toUpperCase() && !/SERVED|CANCEL|CLOSED|COMPLETED|BILLED/i.test(String(r[kx.KOT_STATUS] || ''))))) return;
        tCol[i][0] = to; if (oCol && target && idMap[oid]) oCol[i][0] = idMap[oid]; movedKots++;
      });
      if (movedKots) { kSh.getRange(2, kx.TABLE_ID + 1, tCol.length, 1).setValues(tCol); if (oCol) kSh.getRange(2, kx.ORDER_ID + 1, oCol.length, 1).setValues(oCol); bnx71MemoDrop_(clientId, SHEETS.KOT_MASTER || 'KOT_MASTER'); }
    }
    /* free the source table's live state */
    try {
      const ls = bnx72Sh_(clientId, 'TABLE_LIVE_STATE'), lv = ls.getDataRange().getValues(), lh = lv[0].map(String), lx = bnx71Idx_(lh);
      for (let r = 1; r < lv.length; r++) if (String(lv[r][lx.TABLE_NO]).toUpperCase() === from.toUpperCase()) bnx72SetRow_(ls, lh, r + 1, { STATUS: 'AVAILABLE', ORDER_ID: '', BILL_AMOUNT: 0, UPDATED_AT: now.iso });
    } catch (e) {}
    bnxCreateAuditLog(clientId, { CLIENT_ID: clientId, USER_ID: session.USER_ID || '', ACTION: merge ? 'MERGE_TABLES' : 'TRANSFER_TABLE', MODULE: 'TABLES', RECORD_TYPE: 'TABLE',
      RECORD_ID: from + '→' + to, OLD_VALUE: JSON.stringify(src.map(function (o) { return o.orderId; })), NEW_VALUE: JSON.stringify({ to: to, target: target ? target.orderId : '', movedItems: movedItems, movedKots: movedKots }),
      REQUEST_ID: payload.requestId || '', TIMESTAMP: now.iso });
    return { success: true, data: { from: from, to: to, merged: !!target, targetOrderId: target ? target.orderId : src[0].orderId, targetOrderNo: target ? target.orderNo : src[0].orderNo,
      orders: src.length, movedItems: movedItems, movedKots: movedKots } };
  } catch (e) { bnxLogError(clientId, (merge ? 'MERGE_TABLES' : 'TRANSFER_TABLE') + ' failed: ' + e.message, payload || {}); return { success: false, error: e.message }; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}
function bnx72TransferTable(session, payload) { return bnx72MoveTable_(session, payload, false); }
function bnx72MergeTables(session, payload) { return bnx72MoveTable_(session, payload, true); }

/* ---------- SAVE_BILL helpers ---------- */
function bnx72CleanUser_(v, fallback) {
  const s = String(v == null ? '' : v).trim();
  if (!s || /^__/.test(s) || /^(UNASSIGNED|NONE|NULL|UNDEFINED|SELECT.*)$/i.test(s)) return fallback || '';
  return s;
}
/* The single open order on a table (so the bill gets ORDER_ID and the table frees) */
function bnx72OpenOrderForTable_(clientId, table) {
  if (!table) return null;
  const list = bnx72OpenOrders_(clientId).list.filter(function (o) { return o.table.toUpperCase() === String(table).toUpperCase(); });
  return list.length === 1 ? list[0] : null;
}
function bnx72MarkOrderBilled_(clientId, orderId, billNo) {
  try {
    const OO = bnx72OpenOrders_(clientId);
    const o = OO.list.find(function (x) { return x.orderId === orderId || x.orderNo === orderId; });
    if (!o) return;
    bnx72SetRow_(bnx72Sh_(clientId, 'ORDER_MASTER'), OO.sheetVals.v[0].map(String), o.rowNo, { ORDER_STATUS: 'BILLED', UPDATED_AT: new Date().toISOString() });
    bnx71MemoDrop_(clientId, SHEETS.ORDER_MASTER || 'ORDER_MASTER');
  } catch (e) { console.warn('[BNX72] mark billed: ' + e.message); }
}
/* Same content saved again within 60 s (retry with a new requestId) → reuse */
function bnx72BillFingerprint_(clientId, bill) {
  const items = (bill.itemsDetail || []).map(function (i) { return String(i.name || '').toUpperCase() + 'x' + (Number(i.qty) || 0) + '@' + (Number(i.rate) || 0); }).sort().join('|');
  return 'billfp72_' + bnx71Hash_(clientId + '|' + (bill.table || '') + '|' + (Number(bill.total) || 0) + '|' + items + '|' + (bill.customer || ''));
}

/* ---------- RESTORE_MISSING_BILLS {dryRun?:true} — rebuild bills wiped by a re-import ---------- */
function bnx72RestoreMissingBills(session, payload) {
  const clientId = session.CLIENT_ID;
  const role = String(session.ROLE || session.ROLE_ID || session.STAFF_TYPE || '').toUpperCase();
  if (!session.IS_GLOBAL_ADMIN && !/ADMIN|OWNER|DEVELOPER|SUPER/.test(role)) return { success: false, error: 'Only ADMIN / OWNER can restore bills' };
  const dry = payload.dryRun !== false;
  const lock = bnxAcquireScriptLockWithRetry_(3, 20000);
  try {
    const bm = bnx72Vals_(clientId, 'BILL_MASTER');
    const have = {}; for (let r = 1; r < bm.v.length; r++) have[String(bnx72G_(bm.v[r], bm.x, 'BILL_ID'))] = 1;
    const al = bnx72Vals_(clientId, 'AUDIT_LOG');
    const voided = {}, found = [];
    for (let r = 1; r < al.v.length; r++) {
      const row = al.v[r];
      if (String(bnx72G_(row, al.x, 'RECORD_TYPE')).toUpperCase() !== 'BILL') continue;
      const act = String(bnx72G_(row, al.x, 'ACTION')).toUpperCase(), id = String(bnx72G_(row, al.x, 'RECORD_ID'));
      if (/VOID|CANCEL|DELETE/.test(act)) { voided[id] = 1; continue; }
      if (act !== 'CREATE' || have[id]) continue;
      try { const b = JSON.parse(String(bnx72G_(row, al.x, 'NEW_VALUE') || '{}')); if (b && b.BILL_ID === id && String(b.CLIENT_ID) === String(clientId)) found.push(b); } catch (e) {}
    }
    const list = found.filter(function (b) { return !voided[b.BILL_ID]; });
    if (dry) return { success: true, data: { dryRun: true, missing: list.map(function (b) { return { BILL_ID: b.BILL_ID, BILL_NUMBER: b.BILL_NUMBER, BILL_DATE: b.BILL_DATE, GRAND_TOTAL: b.GRAND_TOTAL, PAYMENT_STATUS: b.PAYMENT_STATUS }; }) } };
    const now = new Date().toISOString(), pays = [];
    list.forEach(function (b) {
      b.NOTES = ((b.NOTES || '') + ' [Restored from AUDIT_LOG ' + now.slice(0, 10) + ' — items not recoverable]').trim();
      if (String(b.PAYMENT_STATUS).toUpperCase() === 'PAID' && bnx71Num_(b.GRAND_TOTAL) > 0)
        pays.push({ PAYMENT_ID: generateShortId_(clientId, 'PAYMENT_ID'), CLIENT_ID: clientId, LOCATION_ID: b.LOCATION_ID || '', BILL_ID: b.BILL_ID, PAYMENT_MODE: 'CASH',
          AMOUNT: bnx71Num_(b.GRAND_TOTAL), PAYMENT_DATE: b.BILL_DATE, PAYMENT_TIME: b.BILL_TIME || '', REFERENCE: 'RESTORED', PAYMENT_STATUS: 'SUCCESS',
          CREATED_BY: session.USER_ID || '', CREATED_AT: now, TIPS_AMOUNT: 0 });
    });
    bnxAppendRowsBatch_(clientId, SHEETS.BILL_MASTER, list);
    bnxAppendRowsBatch_(clientId, SHEETS.PAYMENT_MASTER, pays);
    bnx71BumpReportVersion_(clientId);
    return { success: true, data: { restored: list.length, payments: pays.length, bills: list.map(function (b) { return b.BILL_NUMBER; }) } };
  } catch (e) { return { success: false, error: e.message }; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

