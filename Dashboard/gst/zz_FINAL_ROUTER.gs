/* ═══ zz_FINAL_ROUTER (2026-11-18) — ONE file that decides who answers every web request. Keep it the LAST file. ═══
   ROOT CAUSE of "Unknown action: GET_DASHBOARD_SUMMARY / GET_ITEM_SALES_REPORT", "DASH_FIN not loaded",
   "no build", dues / receivables / DCR empty, tables only via fallback:
     another file further down the list (an old API file) also declares  function doPost / doGet. In Apps Script the
     LAST declaration wins, so that file's router answered every request ({status:'error', message:'Unknown action'})
     and the /exec URL shows  {"status":"Balaji NextGen Script Active"}  instead of the ERP. The pages then retried on
     other deployments → queue of 36 requests, 13 s average, "Server busy".
   FIX: Code live …gs now names its router  bnxCoreDoPost_  (see that file) and THIS file — last in the list — owns
     doPost and doGet, so the order of the other files no longer matters:
       doPost: approval gate + menu/QR promo (menu-card-qr-promo.gs) → store / recipe fast actions (below)
               → bnxCoreDoPost_ (the ERP: billing, KOT, orders, reports …)
               → only if the ERP says "Unknown action": the older doPost chain (leads / public forms / CRM hooks)
       doGet : BNX_WHOAMI · PUBLIC_MENU · GUEST_CHECKIN here, everything else to the older doGet.
   Replaces the old zz_store-router.gs AND Store voucher fast.gs (both merged below — delete those two files).
   Check after deploy: open  <exec URL>?action=BNX_WHOAMI  → must show build GS-2026.11.19-v22 and coreRouter:true.  */
var BNX_FINAL_BUILD = 'GS-2026.11.20-v32';

function bnxGetGrnRegisterFast_(session) {
  var cid = session.CLIENT_ID, items = {}, sup = {}, hdr = {};
  bnxSrRows_(cid, 'RAW_MATERIAL_MASTER').forEach(function (r) { var c = String(r.ITEM_CODE || '').trim(); if (c) items[c] = { n: String(r.ITEM_NAME || ''), u: String(r.UOM || '') }; });
  try { bnxSrRows_(cid, 'PURCHASE_INVOICE').forEach(function (r) { if (r.INVOICE_NO) sup[String(r.INVOICE_NO)] = { id: String(r.SUPPLIER_ID || ''), name: String(r.SUPPLIER_NAME || '') }; }); } catch (e) {}
  bnxSrRows_(cid, 'GOODS_RECEIPT_NOTE').forEach(function (r) { hdr[String(r.GRN_ID || '')] = r; });
  var out = [];
  bnxSrRows_(cid, 'GRN_ITEMS').forEach(function (r, i) {
    var h = hdr[String(r.GRN_ID || '')]; if (!h) return;
    var no = String(h.GRN_NUMBER || h.GRN_ID), s = sup[no] || {}, it = items[String(r.ITEM_ID || '').trim()] || {}, q = Number(r.QUANTITY_RECEIVED) || 0, rate = Number(r.RATE) || 0;
    out.push({ id: String(r.GRN_ITEM_ID || (h.GRN_ID + '-' + i)), no: no, date: bnxSrDate_(h.GRN_DATE), poRef: '', vendorId: String(h.SUPPLIER_ID || s.id || ''), vendorName: String(s.name || h.NOTES || h.SUPPLIER_ID || '—'),
      item: it.n || String(r.ITEM_ID || ''), itemId: String(r.ITEM_ID || ''), unit: String(r.UNIT_ID || it.u || ''), rate: rate, gst: 0, received: q, accepted: q, rejected: 0, amount: Math.round(q * rate * 100) / 100,
      godown: 'Main Store', godownId: 'STORE', status: 'Received', remarks: '', purchaseNo: no, fromServer: true, createdAt: String(h.CREATED_AT || '') });
  });
  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.no < b.no ? 1 : -1); });
  return { success: true, data: out, count: out.length };
}
function bnxGetPurchaseInvoicesFast_(session) {
  var cid = session.CLIENT_ID, by = {};
  bnxSrRows_(cid, 'PURCHASE_INVOICE_ITEMS').forEach(function (r) { var k = String(r.PURCHASE_INVOICE_ID || ''); if (k) (by[k] = by[k] || []).push(r); });
  var out = bnxSrRows_(cid, 'PURCHASE_INVOICE').filter(function (r) { return r.PURCHASE_INVOICE_ID && !/CANCEL|VOID|DELET/i.test(String(r.STATUS || '')); }).map(function (r) {
    var id = String(r.PURCHASE_INVOICE_ID);
    return { _id: id, inv_no: String(r.INVOICE_NO || ''), inv_date: bnxSrDate_(r.INVOICE_DATE), party_id: String(r.SUPPLIER_ID || ''), party_name: String(r.SUPPLIER_NAME || ''), wh_id: String(r.LOCATION_ID || 'STORE'),
      taxable: Number(r.TAXABLE_AMOUNT) || 0, cgst: Number(r.CGST) || 0, sgst: Number(r.SGST) || 0, igst: Number(r.IGST) || 0, total: Number(r.TOTAL_AMOUNT) || 0,
      due_date: bnxSrDate_(r.DUE_DATE), approval_status: String(r.APPROVAL_STATUS || ''), status: String(r.STATUS || ''), created_at: String(r.CREATED_AT || ''),
      tcs_amount: Number(r.TCS_AMOUNT) || 0, tds_amount: Number(r.TDS_AMOUNT) || 0,
      payment_status: String(r.PAYMENT_STATUS || '').toLowerCase(), purchase_head: String(r.PURCHASE_HEAD || ''), bill_no: String(r.BILL_NO || ''),
      bill_file_url: String(r.BILL_FILE_URL || ''), billFileUrl: String(r.BILL_FILE_URL || ''), notes: String(r.NOTES || ''), items: (by[id] || []).map(function (x) { var o = {}; Object.keys(x).forEach(function (k) { o[k] = x[k]; }); return o; }) };
  });
  /* 2026-11-19: supplier bill no / bill date / head / bill links from PURCHASE_BILL_LINKS, Tally status from PURCHASE_TALLY_STATUS */
  try { bnxPiEnrich_(cid, out); } catch (e) {}
  return { success: true, data: out, count: out.length };
}
function bnxPiEnrich_(cid, out) {
  var by = {}; out.forEach(function (o) { by[o._id] = o; });
  var bl = []; try { bl = bnxSrRows_(cid, 'PURCHASE_BILL_LINKS'); } catch (e) {}
  bl.forEach(function (r) {
    var o = by[String(r.PURCHASE_INVOICE_ID || '')]; if (!o) return;
    if (/REMOVED/i.test(String(r.MATCH_TYPE || ''))) { var o2 = by[String(r.PURCHASE_INVOICE_ID || '')]; if (o2 && o2.bill_file_url === String(r.BILL_FILE_URL || '')) { o2.bill_file_url = ''; o2.billFileUrl = ''; } return; }
    var bn = String(r.BILL_NO || '').trim(), u = String(r.BILL_FILE_URL || '').trim(), hd = String(r.PURCHASE_HEAD || '').trim();
    if (bn && !o.bill_no) o.bill_no = bn;
    if (r.BILL_DATE && !o.bill_date) o.bill_date = bnxSrDate_(r.BILL_DATE);
    if (hd && !o.purchase_head) o.purchase_head = hd;
    if (u) { o.bill_links = o.bill_links || []; if (o.bill_links.indexOf(u) < 0) o.bill_links.push(u); if (!o.bill_file_url) { o.bill_file_url = u; o.billFileUrl = u; } }
  });
  var ts = []; try { ts = bnxSrRows_(cid, 'PURCHASE_TALLY_STATUS'); } catch (e) {}
  ts.forEach(function (r) {
    var o = by[String(r.INVOICE_ID || '')]; if (!o) return;
    o.tally_status = String(r.STATUS || ''); o.tally_error = String(r.ERROR || ''); o.tally_at = String(r.UPDATED_AT || ''); o.tally_ledger = String(r.LEDGER || '');
  });
}

/* ═══ TALLY POSTING STATUS + LEDGER MAP (2026-11-19) ═════════════════════════════════════════════════════════════
   The purchase page called TALLY_ENQUEUE / TALLY_PULL_PENDING / TALLY_MARK_STATUS but no server handler existed, so a post
   was never remembered (after a reload every invoice showed "Post to Tally" again) and "Post to Tally" (all) posted nothing.
   PURCHASE_TALLY_STATUS keeps one row per invoice; TALLY_LEDGER_MAP keeps "head / supplier → Tally ledger" choices so every
   PC posts to the same Tally ledgers. Both sheets are made automatically in the client TRANSACTION DB. */
var BNX_TS_HEAD = ['INVOICE_ID', 'CLIENT_ID', 'INVOICE_NO', 'BILL_NO', 'STATUS', 'ERROR', 'LEDGER', 'PARTY', 'VOUCHER_TYPE', 'UPDATED_AT', 'UPDATED_BY'];
var BNX_TLM_HEAD = ['KIND', 'CLIENT_ID', 'APP_NAME', 'TALLY_LEDGER', 'UPDATED_AT', 'UPDATED_BY'];
function bnxTxSheet_(cid, name, head) {
  var ss = SpreadsheetApp.openById(bnxGetClientDbIds_(cid).TRANSACTION), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  else if (sh.getLastColumn() < head.length) sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  return sh;
}
function bnxTallyStatusSet_(session, p, onlyIfNotPosted) {
  var cid = session.CLIENT_ID, ids = Array.isArray(p.items) ? p.items : [p];
  ids = ids.filter(function (x) { return x && x.invoiceId; });
  if (!ids.length) return { success: false, error: 'invoiceId needed' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = bnxTxSheet_(cid, 'PURCHASE_TALLY_STATUS', BNX_TS_HEAD), v = sh.getDataRange().getValues(), row = {}, now = new Date().toISOString(), who = String(session.USER_NAME || session.USER_ID || '');
    for (var i = 1; i < v.length; i++) row[String(v[i][0])] = i;
    var add = [], n = 0;
    ids.forEach(function (x) {
      var st = String(x.status || 'QUEUED').toUpperCase(), r = row[String(x.invoiceId)];
      if (onlyIfNotPosted && r !== undefined && String(v[r][4]).toUpperCase() === 'POSTED') return;
      var rec = [String(x.invoiceId), cid, String(x.invoiceNo || ''), String(x.billNo || ''), st, String(x.error || '').slice(0, 480), String(x.ledger || ''), String(x.party || ''), String(x.voucherType || ''), now, who];
      if (r !== undefined) { if (!rec[2]) rec[2] = v[r][2]; if (!rec[3]) rec[3] = v[r][3]; if (!rec[6]) rec[6] = v[r][6]; if (!rec[7]) rec[7] = v[r][7]; sh.getRange(r + 1, 1, 1, rec.length).setValues([rec]); }
      else { add.push(rec); row[rec[0]] = -1; }
      n++;
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
    return { success: true, updated: n };
  } finally { lock.releaseLock(); }
}
function bnxTallyPullPending_(session) {
  var out = []; try { bnxSrRows_(session.CLIENT_ID, 'PURCHASE_TALLY_STATUS').forEach(function (r) { if (String(r.STATUS).toUpperCase() === 'QUEUED') out.push({ invoiceId: String(r.INVOICE_ID), invoiceNo: String(r.INVOICE_NO || ''), voucherType: String(r.VOUCHER_TYPE || '') }); }); } catch (e) {}
  return { success: true, data: { pending: out } };
}
function bnxTallyStatusList_(session) {
  var out = []; try { out = bnxSrRows_(session.CLIENT_ID, 'PURCHASE_TALLY_STATUS').map(function (r) { return { invoiceId: String(r.INVOICE_ID), status: String(r.STATUS || ''), error: String(r.ERROR || ''), ledger: String(r.LEDGER || ''), party: String(r.PARTY || ''), at: String(r.UPDATED_AT || '') }; }); } catch (e) {}
  return { success: true, data: out };
}
function bnxTallyLedgerMap_(session, p) {
  var cid = session.CLIENT_ID, sh = bnxTxSheet_(cid, 'TALLY_LEDGER_MAP', BNX_TLM_HEAD);
  if (p && Array.isArray(p.set) && p.set.length) {
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var v = sh.getDataRange().getValues(), at = {}, now = new Date().toISOString(), who = String(session.USER_NAME || session.USER_ID || ''), add = [];
      for (var i = 1; i < v.length; i++) at[String(v[i][0]) + '|' + String(v[i][2]).toUpperCase()] = i;
      p.set.forEach(function (x) {
        var kind = String(x.kind || 'head'), app = String(x.app || '').trim(), tl = String(x.tally || '').trim(); if (!app) return;
        var rec = [kind, cid, app, tl, now, who], r = at[kind + '|' + app.toUpperCase()];
        if (r !== undefined && r > 0) sh.getRange(r + 1, 1, 1, rec.length).setValues([rec]); else { add.push(rec); at[kind + '|' + app.toUpperCase()] = -1; }
      });
      if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
    } finally { lock.releaseLock(); }
  }
  var out = []; var d = sh.getDataRange().getValues();
  for (var j = 1; j < d.length; j++) if (d[j][2]) out.push({ kind: String(d[j][0] || 'head'), app: String(d[j][2]), tally: String(d[j][3] || '') });
  return { success: true, data: out };
}
/* supplier bill no / bill date / purchase head / bill link of one purchase → PURCHASE_INVOICE (columns added when missing).
   Called after every save (a new row from SYNC_PURCHASE_INVOICE_ROW has no head / bill no) and from "＋ Bill no". */
function bnxPurchaseBillNoSet_(session, p) {
  var cid = session.CLIENT_ID, id = String(p.invoiceId || '');
  if (!id) return { success: false, error: 'invoiceId needed' };
  var want = {};
  if (p.billNo != null && String(p.billNo).trim() !== '') want.BILL_NO = String(p.billNo).trim().slice(0, 60);
  if (p.billDate) want.BILL_DATE = String(p.billDate).slice(0, 10);
  if (p.head) want.PURCHASE_HEAD = String(p.head).trim().slice(0, 120);
  if (p.url && /^https:\/\/(drive|docs)\.google\.com\//.test(String(p.url))) want.BILL_FILE_URL = String(p.url);
  if (p.billNo === '') want.BILL_NO = '';
  if (!Object.keys(want).length) return { success: true, nothing: true };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = bnxClientSheet(cid, 'PURCHASE_INVOICE'), v = sh.getDataRange().getValues(), h = v[0].map(function (x) { return String(x).trim(); });
    var ci = h.indexOf('PURCHASE_INVOICE_ID'); if (ci < 0) return { success: false, error: 'PURCHASE_INVOICE_ID column missing' };
    Object.keys(want).forEach(function (k) { if (h.indexOf(k) < 0) { sh.getRange(1, h.length + 1).setValue(k).setFontWeight('bold'); h.push(k); } });
    for (var i = 1; i < v.length; i++) if (String(v[i][ci]) === id) {
      Object.keys(want).forEach(function (k) { sh.getRange(i + 1, h.indexOf(k) + 1).setValue(want[k]); });
      return { success: true, set: Object.keys(want) };
    }
    return { success: false, error: 'invoice ' + id + ' not found (save it first)' };
  } finally { lock.releaseLock(); }
}

/* ═══ TALLY PURCHASE REGISTER (actual books) — 2026-11-19 ════════════════════════════════════════════════════════
   The Purchase Register exported from Tally (Date · Particulars · Vch Type · Vch No · Amount) is the real list of bills.
   TALLY_PR_IMPORT stores it in TALLY_PURCHASE_REGISTER (rows of the same period are replaced) together with the ERP
   invoice(s) each Tally bill was matched to; matched ERP invoices get the Tally Vch No as supplier bill no (when they
   have none) and are marked POSTED in PURCHASE_TALLY_STATUS. Payment Advice and Party Ledger read TALLY_PR_LIST. */
var BNX_TPR_HEAD = ['TPR_ID', 'CLIENT_ID', 'VCH_DATE', 'PARTY', 'VCH_TYPE', 'VCH_NO', 'AMOUNT', 'MATCH_IDS', 'MATCH_TYPE', 'ERP_AMOUNT', 'IMPORTED_AT', 'IMPORTED_BY', 'SOURCE_FILE'];
function bnxTallyPrImport_(session, p) {
  var cid = session.CLIENT_ID, rows = Array.isArray(p.rows) ? p.rows : [], from = String(p.from || '').slice(0, 10), to = String(p.to || '').slice(0, 10);
  if (!rows.length || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { success: false, error: 'rows, from and to (yyyy-mm-dd) are needed' };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = bnxTxSheet_(cid, 'TALLY_PURCHASE_REGISTER', BNX_TPR_HEAD), v = sh.getDataRange().getValues(), keep = [v[0].slice(0, BNX_TPR_HEAD.length)];
    var dk = function (x) { return x instanceof Date ? Utilities.formatDate(x, 'Asia/Kolkata', 'yyyy-MM-dd') : String(x || '').slice(0, 10); };
    for (var i = 1; i < v.length; i++) { var d = dk(v[i][2]); if (d >= from && d <= to) continue; keep.push(v[i].slice(0, BNX_TPR_HEAD.length)); }
    var now = new Date().toISOString(), who = String(session.USER_NAME || session.USER_ID || ''), src = String(p.file || '').slice(0, 120);
    rows.forEach(function (r, k) {
      keep.push(['TPR-' + String(r.date).replace(/-/g, '') + '-' + ('000' + k).slice(-4), cid, String(r.date).slice(0, 10), String(r.party || ''), String(r.type || ''), String(r.no || ''), Number(r.amount) || 0,
        (r.matchIds || []).join(','), String(r.matchType || ''), Number(r.erpAmount) || '', now, who, src]);
    });
    sh.clearContents(); sh.getRange(1, 1, keep.length, BNX_TPR_HEAD.length).setValues(keep.map(function (x) { while (x.length < BNX_TPR_HEAD.length) x.push(''); return x; }));
    sh.getRange(1, 3, keep.length, 1).setNumberFormat('@'); sh.getRange(1, 6, keep.length, 1).setNumberFormat('@');
  } finally { lock.releaseLock(); }
  /* matched ERP invoices: bill no (only when empty) + Tally status POSTED */
  var setNo = 0, posted = [];
  try {
    var want = p.billNos && typeof p.billNos === 'object' ? p.billNos : {}, seenP = {}; rows.forEach(function (r) { (r.matchIds || []).forEach(function (id) { if (!p.billNos && r.no && (r.matchIds || []).length === 1) want[id] = String(r.no); if (seenP[id]) return; seenP[id] = 1; posted.push({ invoiceId: id, billNo: r.no || '', status: 'POSTED', party: r.party, ledger: '', error: '' }); }); });
    var lock2 = LockService.getScriptLock(); lock2.waitLock(30000);
    try {
      var ps = bnxClientSheet(cid, 'PURCHASE_INVOICE'), pv = ps.getDataRange().getValues(), h = pv[0].map(function (x) { return String(x).trim(); });
      var ci = h.indexOf('PURCHASE_INVOICE_ID'), cb = h.indexOf('BILL_NO');
      if (cb < 0) { cb = h.length; ps.getRange(1, cb + 1).setValue('BILL_NO').setFontWeight('bold'); for (var a = 1; a < pv.length; a++) pv[a].push(''); }
      var col = []; for (var j = 1; j < pv.length; j++) { var cur = String(pv[j][cb] || ''), id = String(pv[j][ci]); if (!cur && want[id]) { cur = want[id]; setNo++; } col.push([cur]); }
      if (col.length && setNo) ps.getRange(2, cb + 1, col.length, 1).setNumberFormat('@').setValues(col);
    } finally { lock2.releaseLock(); }
  } catch (e) { return { success: true, stored: rows.length, billNoSet: setNo, warning: 'bill no not written: ' + e.message }; }
  if (posted.length) { for (var q = 0; q < posted.length; q += 400) bnxTallyStatusSet_(session, { items: posted.slice(q, q + 400) }, false); }
  return { success: true, stored: rows.length, billNoSet: setNo, postedMarked: posted.length };
}
function bnxTallyPrList_(session) {
  var out = [];
  try { bnxSrRows_(session.CLIENT_ID, 'TALLY_PURCHASE_REGISTER').forEach(function (r) { out.push({ id: String(r.TPR_ID), date: bnxSrDate_(r.VCH_DATE), party: String(r.PARTY || ''), type: String(r.VCH_TYPE || ''), no: String(r.VCH_NO || ''), amount: Number(r.AMOUNT) || 0, matchIds: String(r.MATCH_IDS || '').split(',').filter(Boolean), matchType: String(r.MATCH_TYPE || '') }); }); } catch (e) {}
  out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return { success: true, data: out, from: out.length ? out[0].date : '', to: out.length ? out[out.length - 1].date : '' };
}

/* ═══ GSTIN → supplier details (2026-11-19) ════════════════════════════════════════════════════════════════════
   1. your own supplier masters (VENDOR_MASTER / SUPPLIER_MASTER with that GSTIN);
   2. the GST taxpayer search of your GST API provider, when Script property GST_API_URL is set, e.g.
        https://appyflow.in/api/verifyGST?gstNo={gstin}&key_secret=YOUR_KEY      ({gstin} is replaced)
      (any provider that answers with the GST portal fields lgnm / tradeNam / pradr.addr … works);
   3. always: state, state code and PAN from the GSTIN itself, and a check-digit test. */
function bnxGstinValid_(g) {
  var cs = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; if (!/^[0-9]{2}[A-Z0-9]{13}$/.test(g)) return false;
  var sum = 0; for (var i = 0; i < 14; i++) { var v = cs.indexOf(g.charAt(i)) * (i % 2 ? 2 : 1); sum += Math.floor(v / 36) + (v % 36); }
  return cs.charAt((36 - (sum % 36)) % 36) === g.charAt(14);
}
var BNX_GST_STATES = {'01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','26':'Dadra & Nagar Haveli and Daman & Diu','27':'Maharashtra','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar','36':'Telangana','37':'Andhra Pradesh','38':'Ladakh'};
function bnxGstinLookup_(session, p) {
  var g = String(p.gstin || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  var out = { success: true, gstin: g, valid: bnxGstinValid_(g), stateCode: g.slice(0, 2), state: BNX_GST_STATES[g.slice(0, 2)] || '', pan: g.length === 15 ? g.slice(2, 12) : '', source: 'gstin' };
  if (g.length !== 15) return { success: false, error: 'GSTIN must have 15 characters' };
  /* 1 — own masters */
  ['VENDOR_MASTER', 'SUPPLIER_MASTER'].forEach(function (sh) {
    if (out.source !== 'gstin') return;
    try { bnxSrRows_(session.CLIENT_ID, sh).some(function (r) { if (String(r.GSTIN || r.GST_NUMBER || '').toUpperCase().trim() !== g) return false;
      out.source = 'master'; out.id = String(r.VENDOR_ID || r.SUPPLIER_ID || ''); out.tradeName = String(r.VENDOR_NAME || r.SUPPLIER_NAME || r.NAME || ''); out.legalName = out.tradeName;
      out.address = String(r.ADDRESS || ''); out.city = String(r.CITY || ''); out.pincode = String(r.PINCODE || r.PIN || ''); out.mobile = String(r.MOBILE || r.PHONE || ''); out.email = String(r.EMAIL || ''); return true; }); } catch (e) {}
  });
  /* 2 — GST taxpayer search */
  var url = PropertiesService.getScriptProperties().getProperty('GST_API_URL') || '';
  if (url && p.api !== false) {
    var ck = 'gstin_' + g, cache = CacheService.getScriptCache(), hit = cache.get(ck), j = null;
    try { j = hit ? JSON.parse(hit) : null; } catch (e) {}
    if (!j) { try { var res = UrlFetchApp.fetch(url.replace('{gstin}', encodeURIComponent(g)), { muteHttpExceptions: true, followRedirects: true }); if (res.getResponseCode() === 200) { j = JSON.parse(res.getContentText()); cache.put(ck, JSON.stringify(j).slice(0, 90000), 21600); } else out.apiError = 'GST API HTTP ' + res.getResponseCode(); } catch (e) { out.apiError = String(e.message || e); } }
    var t = (function find(o, d) { if (!o || typeof o !== 'object' || d > 4) return null; if (o.lgnm || o.tradeNam || o.legal_name || o.trade_name) return o; for (var k in o) { var r = find(o[k], d + 1); if (r) return r; } return null; })(j, 0);
    if (t) {
      var a = (t.pradr && (t.pradr.addr || t.pradr)) || t.principal_address || {};
      if (typeof a === 'string') a = { full: a };
      var parts = [a.bno, a.flno, a.bnm, a.st, a.loc, a.city || a.dst].filter(function (x) { return x && String(x).trim(); });
      out.source = 'gst'; out.legalName = String(t.lgnm || t.legal_name || ''); out.tradeName = String(t.tradeNam || t.trade_name || out.legalName);
      out.address = a.full || parts.join(', '); out.city = String(a.dst || a.city || a.loc || ''); out.pincode = String(a.pncd || a.pincode || ''); if (a.stcd) out.state = String(a.stcd);
      out.status = String(t.sts || t.status || ''); out.regDate = String(t.rgdt || t.registration_date || ''); out.type = String(t.dty || t.ctb || t.constitution || '');
      out.natureOfBusiness = Array.isArray(t.nba) ? t.nba.join(', ') : '';
    } else if (j && !out.apiError) out.apiError = 'GST API answered without taxpayer details';
  } else if (!url) out.apiNote = 'Set Script property GST_API_URL (GST taxpayer search API) to fetch name and address from the GST portal';
  return out;
}

/* ═══ BILL LINKS: remove a wrong bill / make one the main bill (2026-11-19) ═══════════════════════════════════════
   Nothing is deleted: the PURCHASE_BILL_LINKS row is marked MATCH_TYPE = REMOVED (hidden everywhere); the Drive file stays. */
function bnxBillLinkRemove_(session, p) {
  var cid = session.CLIENT_ID, id = String(p.invoiceId || ''), url = String(p.url || '');
  if (!id || !url) return { success: false, error: 'invoiceId and url are needed' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.openById(bnxGetClientDbIds_(cid).TRANSACTION), bl = ss.getSheetByName('PURCHASE_BILL_LINKS'), n = 0, keep = [];
    if (bl && bl.getLastRow() > 1) {
      var v = bl.getDataRange().getValues(), h = v[0].map(String), ci = h.indexOf('PURCHASE_INVOICE_ID'), cu = h.indexOf('BILL_FILE_URL'), cm = h.indexOf('MATCH_TYPE'), cs = h.indexOf('SOURCE');
      for (var i = 1; i < v.length; i++) if (String(v[i][ci]) === id) {
        if (String(v[i][cu]) === url) { if (cm >= 0) bl.getRange(i + 1, cm + 1).setValue('REMOVED'); if (cs >= 0) bl.getRange(i + 1, cs + 1).setValue('removed by ' + (session.USER_NAME || session.USER_ID || 'user') + ' ' + new Date().toISOString().slice(0, 10)); n++; }
        else if (!/REMOVED/i.test(String(v[i][cm] || ''))) keep.push(String(v[i][cu]));
      }
    }
    var pi = ss.getSheetByName('PURCHASE_INVOICE'), pv = pi.getDataRange().getValues(), ph = pv[0].map(String), pc = ph.indexOf('PURCHASE_INVOICE_ID'), pu = ph.indexOf('BILL_FILE_URL');
    if (pu >= 0) for (var j = 1; j < pv.length; j++) if (String(pv[j][pc]) === id && String(pv[j][pu]) === url) { pi.getRange(j + 1, pu + 1).setValue(keep[0] || ''); n++; break; }
    return { success: true, removed: n, remaining: keep };
  } finally { lock.releaseLock(); }
}
(function (G) {   /* GET_PURCHASE_EXTRAS: hide removed links */
  if (typeof G.BNXDRV_getExtras_ !== 'function' || G.BNXDRV_getExtras_.__bnxRm) return;
  var orig = G.BNXDRV_getExtras_;
  var w = function (d) {
    var r = orig(d);
    try {
      var bl = BNXDRV_txDb_(BNXDRV_clientId_(d.clientId)).getSheetByName('PURCHASE_BILL_LINKS'); if (!bl || !r || !r.items) return r;
      var v = bl.getDataRange().getValues(), h = v[0].map(String), ci = h.indexOf('PURCHASE_INVOICE_ID'), cu = h.indexOf('BILL_FILE_URL'), cm = h.indexOf('MATCH_TYPE'), cb = h.indexOf('BILL_NO'), gone = {}, bno = {};
      for (var i = 1; i < v.length; i++) { var k = String(v[i][ci]); if (cm >= 0 && /REMOVED/i.test(String(v[i][cm]))) gone[k + '|' + v[i][cu]] = 1; else if (cb >= 0 && v[i][cb] && !bno[k]) bno[k] = String(v[i][cb]); }
      r.items.forEach(function (it) { it.links = (it.links || []).filter(function (u) { return !gone[it.id + '|' + u]; }); if (!it.billNo && bno[it.id]) it.billNo = bno[it.id]; });
    } catch (e) {}
    return r;
  };
  w.__bnxRm = true; G.BNXDRV_getExtras_ = w; try { BNXDRV_getExtras_ = w; } catch (e) {}
})(this);

/* ═══ CLIENT ID + LOGIN TRACKING IN BOTH MASTER SHEETS (2026-11-19) ═══════════════════════════════════════════
   USER_SECURITY_MASTER_DB : CLIENT_MASTER · CLIENT_REGISTRY · AUDIT_LOG   (+ USER_MASTER for wizard admins)
   BALAJI_ERP_MASTER_CONTROL_SYSTEM : CLIENT_DEPLOYMENT_REGISTRY · SAAS_SUBSCRIPTION_MASTER
   A row is only added when the CLIENT_ID is not there yet; existing rows get empty cells filled. Passwords are never
   copied into these registers (only USER_MASTER / GST_TRIAL_USERS hold the login). */
function bnxTrackUpsert_(ss, tab, keyCol, keyVal, obj) {
  var sh = ss.getSheetByName(tab); if (!sh) return 'no tab ' + tab;
  var v = sh.getDataRange().getValues(), h = (v[0] || []).map(function (x) { return String(x || '').trim().toUpperCase(); }), k = h.indexOf(keyCol);
  if (k < 0) return 'no ' + keyCol + ' in ' + tab;
  for (var i = 1; i < v.length; i++) if (String(v[i][k]).trim().toUpperCase() === String(keyVal).toUpperCase()) {
    Object.keys(obj).forEach(function (c) { var j = h.indexOf(c); if (j >= 0 && (v[i][j] === '' || v[i][j] == null) && obj[c] !== '' && obj[c] != null) sh.getRange(i + 1, j + 1).setValue(obj[c]); });
    return 'updated ' + tab;
  }
  var lastData = 1; for (var r = v.length - 1; r >= 1; r--) if (String(v[r][k] || '').trim()) { lastData = r + 1; break; }
  var row = h.map(function (c) { return obj[c] !== undefined ? obj[c] : ''; });
  sh.getRange(lastData + 1, 1, 1, row.length).setValues([row]);
  return 'added ' + tab;
}
function bnxTrackClient_(c) {
  var out = [], now = new Date(), exp = c.expiry || '';
  try {
    var usm = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID);
    out.push(bnxTrackUpsert_(usm, 'CLIENT_MASTER', 'CLIENT_ID', c.clientId, { CLIENT_ID: c.clientId, CONTACT_NAME: c.owner, PHONE: c.mobile, EMAIL: c.email, COMPANY_NAME: c.company, GST_NO: c.gstin || '', PAN: c.gstin ? String(c.gstin).slice(2, 12) : (c.pan || ''), ADDRESS: c.address || '', CITY: c.city || '', STATE: c.state || '', INDUSTRY: c.industry, PLAN: c.plan, ADMIN_NAME: c.owner, ADMIN_EMAIL: c.email, ADMIN_USERNAME: c.loginId, ADMIN_MOBILE: c.mobile, ADMIN_ROLE: c.role || 'ADMIN', STATUS: 'ACTIVE', LICENSE_STATUS: 'ACTIVE', REGISTERED_BY: c.by }));
    out.push(bnxTrackUpsert_(usm, 'CLIENT_REGISTRY', 'CLIENT_ID', c.clientId, { CLIENT_ID: c.clientId, COMPANY_NAME: c.company, INDUSTRY: c.industry, OWNER_NAME: c.owner, EMAIL: c.email, MOBILE_NO: c.mobile, PLAN_NAME: c.plan, LICENSE_STATUS: 'ACTIVE', START_DATE: c.start || now, EXPIRY_DATE: exp, ACTIVE_MODULES: c.modules || '', CITY: c.city || '', STATE: c.state || '', COUNTRY: 'INDIA', GST_NO: c.gstin || '', CREATED_ON: now, LAST_UPDATED: now }));
    var al = usm.getSheetByName('AUDIT_LOG'); if (al && /^added/.test(out[0])) al.appendRow([Utilities.getUuid(), 'REGISTER_CLIENT', 'CLIENT_MASTER', c.clientId, now.toISOString(), c.by, 'New client: ' + c.company + ' | ' + c.mobile + ' | login ' + c.loginId, 'SUCCESS']);
  } catch (e) { out.push('USER_SECURITY_MASTER_DB: ' + e.message); }
  try {
    var mc = SpreadsheetApp.openById(CLIENT_DB_REGISTRY_SS_ID);
    out.push(bnxTrackUpsert_(mc, 'CLIENT_DEPLOYMENT_REGISTRY', 'CLIENT_ID', c.clientId, { CLIENT_ID: c.clientId, CLIENT_CODE: c.clientId, CLIENT_NAME: c.company, INDUSTRY: c.industry, ADMIN_NAME: c.owner, ADMIN_EMAIL: c.email, MOBILE_NO: c.mobile, PLAN_TYPE: c.plan, LICENSE_KEY: 'AUTO-' + c.clientId, TOTAL_BRANCH: 1, LIVE_STATUS: 'LIVE', CREATED_AT: Utilities.formatDate(now, 'Asia/Kolkata', 'M-d-yyyy HH:mm:ss'), UPDATED_AT: Utilities.formatDate(now, 'Asia/Kolkata', 'M-d-yyyy HH:mm:ss'), STATUS: 'ACTIVE' }));
    out.push(bnxTrackUpsert_(mc, 'SAAS_SUBSCRIPTION_MASTER', 'CLIENT_ID', c.clientId, { SUBSCRIPTION_ID: 'SUB-' + c.clientId + '-001', CLIENT_ID: c.clientId, PLAN_NAME: String(c.plan || '').toLowerCase(), START_DATE: c.start || now, END_DATE: exp, LICENSE_STATUS: 'ACTIVE', PAYMENT_STATUS: /TRIAL/i.test(c.plan) ? 'FREE_TRIAL' : 'PENDING' }));
  } catch (e) { out.push('MASTER_CONTROL: ' + e.message); }
  return out;
}
/* wizard admin login → USER_MASTER (central, used by the login page) + the client's own USER_MASTER */
function bnxWizardUsm_() { var ss = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID), sh = ss.getSheetByName('USER_MASTER'); var v = sh.getDataRange().getValues(); return { ss: ss, sh: sh, v: v, h: v[0].map(function (x) { return String(x || '').trim().toUpperCase(); }) }; }
function bnxWizardCodeTaken_(code, clientId) {
  var U = bnxWizardUsm_(), cc = U.h.indexOf('USER_CODE'), ci = U.h.indexOf('CLIENT_ID');
  for (var i = 1; i < U.v.length; i++) if (String(U.v[i][cc]).trim().toLowerCase() === String(code).trim().toLowerCase() && String(U.v[i][ci]).trim() !== String(clientId || '')) return true;
  return false;
}
function bnxWizardAdmin_(clientId, p, company, businessType) {
  var code = String(p.adminUsername || '').trim(), pass = String(p.adminPassword || ''), role = String(p.adminRole || 'ADMIN').toUpperCase();
  if (role === 'SUPER_ADMIN' || role === 'DEVELOPER') role = 'ADMIN';   /* a client's admin must never get platform rights */
  if (!code || !pass) return { created: false, note: 'no username / password given' };
  var U = bnxWizardUsm_(), H = U.h, col = function (n) { return H.indexOf(n); };
  var now = new Date(), idc = col('USER_ID'), maxId = 0;
  for (var i = 1; i < U.v.length; i++) { var n = Number(U.v[i][idc]); if (n > maxId) maxId = n; }
  var row = { USER_ID: maxId + 1, CLIENT_ID: clientId, USER_CODE: code, USERNAME: code, FULL_NAME: p.adminName || p.ownerName || 'Administrator', NAME: p.adminName || '', EMAIL: p.adminEmail || p.email || '', MOBILE_NO: String(p.adminMobile || p.mobile || ''), PHONE: String(p.adminMobile || p.mobile || ''), PASSWORD: pass, ROLE: role, INDUSTRY: businessType, BRANCH: 'HEAD_OFFICE', ACCESS_LEVEL: 'FULL', STATUS: 'ACTIVE', WEB_ACCESS: 'YES', APP_ACCESS: 'YES', OTP_ACCESS: 'NO', LOGIN_TYPE: 'PASSWORD', COMPANY_NAME: company, DEPARTMENT: 'MANAGEMENT', DESIGNATION: 'OWNER', DEFAULT_DASHBOARD: '', CREATED_BY: 'WIZARD_V2', CREATED_DATE: Utilities.formatDate(now, 'Asia/Kolkata', 'dd-MM-yyyy'), FAILED_ATTEMPTS: 0, ACCOUNT_LOCKED: 'NO', IS_ACTIVE: true };
  /* same code already for this client → update password / role instead of a second row */
  var cc = col('USER_CODE'), ci = col('CLIENT_ID');
  for (var r = 1; r < U.v.length; r++) if (String(U.v[r][cc]).trim().toLowerCase() === code.toLowerCase() && String(U.v[r][ci]).trim() === clientId) {
    ['PASSWORD', 'ROLE', 'STATUS', 'FULL_NAME', 'EMAIL', 'MOBILE_NO'].forEach(function (k) { var j = col(k); if (j >= 0) U.sh.getRange(r + 1, j + 1).setValue(row[k]); });
    return { created: true, updated: true, userCode: code, role: role };
  }
  U.sh.appendRow(H.map(function (k) { return row[k] !== undefined ? row[k] : ''; }));
  try { bnxAppendRow(clientId, 'USER_MASTER', { USER_ID: 'U' + (maxId + 1), EMP_ID: 'U' + (maxId + 1), CLIENT_ID: clientId, USERNAME: code, USER_CODE: code, EMAIL: row.EMAIL, PHONE: row.MOBILE_NO, PASSWORD_HASH: pass, FULL_NAME: row.FULL_NAME, ROLE: role, DESIGNATION: 'OWNER', IS_ACTIVE: true, CREATED_AT: now.toISOString() }); } catch (e) {}
  /* a mobile number that also belongs to another login cannot be used to sign in (the first match wins) */
  var mc = col('MOBILE_NO'), shared = false; for (var q = 1; q < U.v.length; q++) if (row.MOBILE_NO && String(U.v[q][mc]).replace(/\D/g, '').slice(-10) === row.MOBILE_NO.replace(/\D/g, '').slice(-10)) shared = true;
  return { created: true, userCode: code, role: role, mobileShared: shared };
}
/* run once from the editor: puts every GST trial account already made (GT000001 …) into both master sheets */
function TRACK_GST_TRIALS() {
  var T = bnxGtRows_(), n = 0;
  T.rows.filter(function (o) { return String(o.ROLE) === 'OWNER'; }).forEach(function (o) {
    var r = bnxTrackClient_({ clientId: String(o.CLIENT_ID), company: String(o.COMPANY), owner: String(o.NAME), email: String(o.LOGIN_ID), mobile: String(o.MOBILE), gstin: String(o.GSTIN || ''), industry: 'GST', plan: String(o.PLAN || 'TRIAL'), start: o.START, expiry: o.EXPIRY, modules: 'GST', loginId: String(o.LOGIN_ID), by: 'GST_SIGNUP', role: 'OWNER' });
    Logger.log(o.CLIENT_ID + ' — ' + r.join(' · ')); n++;
  });
  Logger.log(n + ' GST trial account(s) tracked');
}
function bnxCreateClientWizard_(session, p) {
  p = p || {};
  var code = String(p.adminUsername || '').trim();
  if (code && /\s/.test(code)) return { success: false, error: 'Username must not contain spaces' };
  if (code && bnxWizardCodeTaken_(code, '')) return { success: false, error: 'USERNAME_ALREADY_EXISTS', message: 'Username "' + code + '" is already used — choose another' };
  var r = bnxCreateClient(session, p);
  if (!r || !r.success || !r.clientId) return r;
  try { r.admin = bnxWizardAdmin_(r.clientId, p, r.companyName, r.businessType); } catch (e) { r.admin = { created: false, error: e.message }; }
  try {
    var D = { TRIAL: 14, STARTER: 365, STANDARD: 365, PROFESSIONAL: 365, ENTERPRISE: 3650 }, exp = new Date(Date.now() + (D[String(r.plan).toUpperCase()] || 365) * 864e5);
    r.tracked = bnxTrackClient_({ clientId: r.clientId, company: r.companyName, owner: p.ownerName || p.adminName || '', email: p.email || p.adminEmail || '', mobile: String(p.mobile || p.adminMobile || ''), gstin: p.gstin || '', pan: p.panNo || '', address: p.address || '', city: p.city || '', state: p.state || '', industry: r.businessType, plan: r.plan, start: new Date(), expiry: exp, modules: String(p.modules || (p.clientData && p.clientData.MODULES) || ''), loginId: code, by: 'WIZARD_V2', role: r.admin && r.admin.role || 'ADMIN' });
  } catch (e) { r.tracked = ['track: ' + e.message]; }
  return r;
}

/* suppliers for the pickers: VENDOR_MASTER, else SUPPLIER_MASTER, plus every supplier name that already appears on an invoice (so the list is never empty) */
function bnxGetVendorsFast_(session) {
  var cid = session.CLIENT_ID, out = [], seen = {}, nk = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim(); };
  var add = function (r, idK, nmK) {
    var nm = ''; nmK.forEach(function (k) { if (!nm && r[k]) nm = String(r[k]).trim(); }); if (!nm || seen[nk(nm)]) return; seen[nk(nm)] = 1;
    var id = ''; idK.forEach(function (k) { if (!id && r[k]) id = String(r[k]).trim(); });
    var st = String(r.STATUS || 'ACTIVE'); if (/INACTIVE|DELETED|BLOCK/i.test(st)) return;
    out.push({ _id: id || ('SUP-' + nk(nm).replace(/ /g, '-').slice(0, 40)), name: nm, code: String(r.VENDOR_CODE || r.SUPPLIER_CODE || id || ''), gstin: String(r.GSTIN || r.GST_NUMBER || '').toUpperCase(), pan: String(r.PAN || ''),
      phone: String(r.MOBILE || r.PHONE || ''), email: String(r.EMAIL || ''), contact: String(r.CONTACT_PERSON || ''), address: String(r.ADDRESS || ''), city: String(r.CITY || ''), state: String(r.STATE || 'West Bengal'),
      credit_days: parseInt(String(r.PAYMENT_TERMS || r.CREDIT_DAYS || '30').replace(/\D/g, ''), 10) || 30, status: 'Active', _synced: true });
  };
  ['VENDOR_MASTER', 'SUPPLIER_MASTER'].forEach(function (sh) { try { bnxSrRows_(cid, sh).forEach(function (r) { add(r, ['VENDOR_ID', 'SUPPLIER_ID'], ['VENDOR_NAME', 'SUPPLIER_NAME', 'NAME']); }); } catch (e) {} });
  try { bnxSrRows_(cid, 'PURCHASE_INVOICE').forEach(function (r) { add({ SUPPLIER_ID: r.SUPPLIER_ID, SUPPLIER_NAME: r.SUPPLIER_NAME }, ['SUPPLIER_ID'], ['SUPPLIER_NAME']); }); } catch (e) {}
  out.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  return { success: true, data: { vendors: out }, vendors: out, count: out.length };
}

/* GET_TABLE_FLOOR fallback: used ONLY when the normal handler returns no tables. Reads TABLE_MASTER + TABLE_LIVE_STATE. */
function bnxTableFloorFallback_(session) {
  var cid = session.CLIENT_ID, live = {};
  try { bnxSrRows_(cid, 'TABLE_LIVE_STATE').forEach(function (r) { var k = String(r.TABLE_NO || '').trim(); if (k) live[k] = r; }); } catch (e) {}
  var tables = [];
  bnxSrRows_(cid, 'TABLE_MASTER').forEach(function (r) {
    var no = String(r.TABLE_NUMBER || r.TABLE_ID || '').trim(); if (!no) return;
    if (String(r.IS_ACTIVE).toLowerCase() === 'false') return;
    var l = live[no] || live[String(r.TABLE_ID || '')] || {}, st = String(l.STATUS || '').trim() || 'available', cap = Number(r.CAPACITY) || 0;
    tables.push({ id: String(r.TABLE_ID || no), _id: String(r.TABLE_ID || no), tableId: String(r.TABLE_ID || no), tableNo: no, table_no: no, number: no, name: no, TABLE_NUMBER: no,
      capacity: cap, pax: cap, seats: cap, section: String(r.SECTION || ''), area: String(r.SECTION || ''), locationId: String(r.LOCATION_ID || ''), minSpend: Number(r.MIN_SPEND) || 0,
      status: st, covers: Number(l.COVERS) || 0, billAmount: Number(l.BILL_AMOUNT) || 0, startTime: String(l.START_TIME || ''), orderId: String(l.ORDER_ID || ''),
      steward: String(l.STEWARD_NAME || ''), stewardId: String(l.STEWARD_ID || ''), active: true });
  });
  return { success: true, tables: tables, data: { tables: tables }, count: tables.length, source: 'fallback TABLE_MASTER' };
}

/* ═══ FAST STORE VOUCHER SAVE (was Store voucher fast.gs) ═══ */
/* read several columns of a sheet with ONE getValues call (smallest column span); rows start at sheet row 2 */
function bnxVfCols_(t, names) {
  var out = {}; names.forEach(function (n) { out[n] = []; });
  var cols = names.filter(function (n) { return t.h[n]; }).map(function (n) { return t.h[n]; });
  if (!cols.length || t.last < 2) return out;
  var lo = Math.min.apply(null, cols), hi = Math.max.apply(null, cols);
  var v = t.sh.getRange(2, lo, t.last - 1, hi - lo + 1).getValues();
  names.forEach(function (n) { if (!t.h[n]) return; var c = t.h[n] - lo; out[n] = v.map(function (r) { return r[c]; }); });
  return out;
}
/* write back only the changed stretch of one column: arr = whole column (as read), idx = array indexes that changed */
function bnxVfPatch_(t, name, arr, idx) {
  if (!idx.length || !t.h[name]) return;
  var lo = Math.min.apply(null, idx), hi = Math.max.apply(null, idx);
  t.sh.getRange(lo + 2, t.h[name], hi - lo + 1, 1).setValues(arr.slice(lo, hi + 1).map(function (x) { return [x]; }));
}

function bnxVoucherSaveFast_(session, payload) {
  var cid = session.CLIENT_ID, p = payload || {}, t0 = Date.now();
  var kind = String(p.kind || '').toLowerCase() === 'iss' ? 'iss' : 'grn', mode = String(p.mode || 'new').toLowerCase();
  var N = function (v) { var x = Number(v); return isFinite(x) ? x : 0; }, r2 = function (x) { return Math.round(N(x) * 100) / 100; };
  var lock = null;
  try {
    var db = bnxSvDbs_(cid), TR = db.TRANSACTION, now = new Date().toISOString(), user = String(session.USER_NAME || session.USER_ID || 'Store');
    var date = bnxSrDate_(p.date) || Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
    if (mode !== 'new' && mode !== 'edit' && mode !== 'delete') return { success: false, error: 'Unknown mode ' + mode };

    /* item master: one read */
    var rmT = bnxSvT_(db.MASTER, 'RAW_MATERIAL_MASTER');
    var rmc = bnxVfCols_(rmT, ['ITEM_CODE', 'ITEM_NAME', 'UOM', 'COST_PRICE', 'CURRENT_STOCK']), rm = {};
    rmc.ITEM_CODE.forEach(function (c, i) { c = String(c || '').trim(); if (c && !rm[c]) rm[c] = { i: i, name: String(rmc.ITEM_NAME[i] || ''), uom: String(rmc.UOM[i] || ''), cost: N(rmc.COST_PRICE[i]) }; });
    var lines = (p.lines || []).map(function (l) { var code = String(l.code || '').trim(), it = rm[code]; return it ? { code: code, name: it.name, uom: it.uom, qty: N(l.qty), rate: N(l.rate) || it.cost } : null; })
      .filter(function (l) { return l && l.qty > 0; });
    if (mode !== 'delete' && !lines.length) return { success: false, error: 'Add at least one item with a quantity' };
    if (mode !== 'new' && !p.no) return { success: false, error: 'Voucher number missing' };
    if (mode !== 'delete' && !p.force) {   /* typing-slip guard (per line) */
      var bad = lines.filter(function (l) { return l.qty > 100000 || l.rate > 1000000 || l.qty * l.rate > 10000000; })[0];
      if (bad) return { success: false, error: 'Check the entry: ' + bad.name + ' qty ' + bad.qty + ' × rate ' + bad.rate + ' = ₹' + r2(bad.qty * bad.rate).toLocaleString('en-IN') + ' looks too large (limit: qty 1,00,000 · amount ₹1 crore per line). Nothing was saved.' };
      var dup = {}, twice = lines.filter(function (l) { if (dup[l.code]) return true; dup[l.code] = 1; return false; })[0];
      if (twice) return { success: false, error: twice.name + ' is entered twice — combine it into one line. Nothing was saved.' };
    }

    lock = LockService.getScriptLock(); lock.waitLock(30000);
    var no = String(p.no || ''), fy = (date.slice(5) >= '04-01' ? date.slice(0, 4) : String(+date.slice(0, 4) - 1)), fyTxt = fy + '-' + (+fy + 1);
    var one = function (v) { var o = {}; o[v] = 1; return o; };
    var touched = {}; lines.forEach(function (l) { touched[l.code] = 1; });

    /* stock movements: ONE read; row i of these arrays = sheet row i + 2 */
    var sm = bnxSvT_(TR, 'STOCK_MOVEMENT');
    var mc = bnxVfCols_(sm, ['ITEM_ID', 'LOCATION_ID', 'MOVEMENT_TYPE', 'QUANTITY_IN', 'QUANTITY_OUT', 'SOURCE_TYPE', 'SOURCE_ID', 'REFERENCE_NUMBER']);
    var removed = {};
    var findMv = function (srcRe, ids) {   /* movement rows of this voucher (by voucher no or source id) */
      var rows = []; for (var i = 0; i < mc.ITEM_ID.length; i++) {
        if (srcRe.test(String(mc.SOURCE_TYPE[i] || '')) && (String(mc.REFERENCE_NUMBER[i]) === no || ids[String(mc.SOURCE_ID[i])])) { rows.push(i + 2); removed[i] = 1; touched[String(mc.ITEM_ID[i])] = 1; }
      } return rows;
    };
    var delRows = function (t, col, vals) { var c = bnxSvCol_(t, col), out = []; for (var i = 0; i < c.length; i++) { if (vals[String(c[i])]) out.push(i + 2); } bnxSvDel_(t, out); };
    var newMv = [];

    if (kind === 'grn') {
      var pi = bnxSvT_(TR, 'PURCHASE_INVOICE'), invNos = bnxSvCol_(pi, 'INVOICE_NO');
      if (mode === 'new') { var mx = 0; invNos.forEach(function (v) { var m = String(v || '').match(/^GRN\/(\d+)\//); if (m) mx = Math.max(mx, +m[1]); }); no = 'GRN/' + ('0000' + (mx + 1)).slice(-5) + '/' + fyTxt; }
      var oi = invNos.indexOf(no), old = oi >= 0 ? bnxSvRowObj_(pi, oi + 2) : null;
      if (mode !== 'new' && !old) return { success: false, error: 'Voucher ' + no + ' not found' };
      var key = no.replace(/^GRN\/0*(\d+)\/(\d{2})(\d{2})-(\d{2})(\d{2})$/, function (a, n, a1, a2, b1, b2) { return 'GRN' + ('0000' + n).slice(-5) + '-' + a2 + b2; }).replace(/[^A-Za-z0-9-]/g, '');
      var piId = old ? String(old.PURCHASE_INVOICE_ID) : 'PI-' + key, grnId = piId.replace(/^PI-/, ''), pmId = 'PUR-' + grnId;
      var pii = bnxSvT_(TR, 'PURCHASE_INVOICE_ITEMS'), gn = bnxSvT_(TR, 'GOODS_RECEIPT_NOTE'), gi = bnxSvT_(TR, 'GRN_ITEMS'), pm = bnxSvT_(TR, 'PURCHASE_MASTER'), pmi = bnxSvT_(TR, 'PURCHASE_ITEMS');
      if (mode !== 'new') {   /* alter / delete: remove the old rows of this voucher from every sheet */
        var gx = bnxSvCol_(gn, 'GRN_NUMBER').indexOf(no); if (gx >= 0) grnId = String(bnxSvRowObj_(gn, gx + 2).GRN_ID);
        var px = bnxSvCol_(pm, 'PURCHASE_NUMBER').indexOf(no); if (px >= 0) pmId = String(bnxSvRowObj_(pm, px + 2).PURCHASE_ID);
        bnxSvDel_(sm, findMv(/^GRN$/i, one(grnId)));
        delRows(pi, 'PURCHASE_INVOICE_ID', one(piId)); delRows(pii, 'PURCHASE_INVOICE_ID', one(piId));
        delRows(gn, 'GRN_ID', one(grnId)); delRows(gi, 'GRN_ID', one(grnId));
        delRows(pm, 'PURCHASE_ID', one(pmId)); delRows(pmi, 'PURCHASE_ID', one(pmId));
      }
      if (mode !== 'delete') {
        var sup = String(p.supplier || (old && old.SUPPLIER_NAME) || ''), supId = String(p.supplierId || (old && old.SUPPLIER_ID) || '');
        var sub = 0, other = r2(p.other), A = { pii: [], gi: [], pmi: [] };
        lines.forEach(function (l, i) {
          var amt = r2(l.qty * l.rate), sq = ('0' + (i + 1)).slice(-2); sub += amt;
          A.pii.push({ PURCHASE_INVOICE_ITEM_ID: piId + '-' + sq, PURCHASE_INVOICE_ID: piId, CLIENT_ID: cid, LOCATION_ID: 'STORE', ITEM_ID: l.code, ITEM_NAME: l.name, QUANTITY: l.qty, UNIT_ID: l.uom, RATE: l.rate,
            DISCOUNT_PCT: 0, GST_RATE: 0, TAXABLE_AMOUNT: amt, CGST: 0, SGST: 0, IGST: 0, TAX_AMOUNT: 0, EXTRA_CHARGES: 0, LINE_TOTAL: amt, CREATED_AT: now, UPDATED_AT: now, NOTES: '' });
          A.gi.push({ GRN_ITEM_ID: grnId + '-' + sq, GRN_ID: grnId, ITEM_ID: l.code, QUANTITY_RECEIVED: l.qty, UNIT_ID: l.uom, RATE: l.rate, CREATED_AT: now });
          A.pmi.push({ PURCHASE_ITEM_ID: pmId + '-' + sq, PURCHASE_ID: pmId, ITEM_ID: l.code, SEQUENCE: i + 1, ITEM_NAME: l.name, QUANTITY: l.qty, UNIT_ID: l.uom, RATE: l.rate, LINE_DISCOUNT: 0, TAXABLE: amt, TAX: 0,
            LINE_TOTAL: amt, RECEIVED_QUANTITY: l.qty, RECEIVED_AT: date, NOTES: 'GRN entry' });
          newMv.push({ STOCK_MOVEMENT_ID: 'SM-' + grnId + '-' + sq, CLIENT_ID: cid, LOCATION_ID: 'STORE', ITEM_ID: l.code, MOVEMENT_TYPE: 'PURCHASE', MOVEMENT_DATE: date, QUANTITY_IN: l.qty, QUANTITY_OUT: 0,
            RATE: l.rate, SOURCE_TYPE: 'GRN', SOURCE_ID: grnId, REFERENCE_NUMBER: no, NOTES: sup, CREATED_BY: user, CREATED_AT: now });
        });
        var tot = r2(sub + other);
        bnxSvAdd_(pi, [{ PURCHASE_INVOICE_ID: piId, CLIENT_ID: cid, INVOICE_NO: no, INVOICE_DATE: date, SUPPLIER_ID: supId, SUPPLIER_NAME: sup, LOCATION_ID: 'STORE', TAXABLE_AMOUNT: r2(sub), CGST: 0, SGST: 0, IGST: 0,
          OTHER_CHARGES: other, TOTAL_AMOUNT: tot, STATUS: 'posted', APPROVAL_STATUS: 'APPROVED', PAYMENT_STATUS: (old && old.PAYMENT_STATUS) || 'unpaid', ITEMS_JSON: '[]',
          CREATED_AT: (old && old.CREATED_AT) || now, UPDATED_AT: now, NOTES: mode === 'edit' ? 'altered by ' + user + ' ' + now.slice(0, 16) : 'entered by ' + user }]);
        bnxSvAdd_(pii, A.pii);
        bnxSvAdd_(gn, [{ GRN_ID: grnId, CLIENT_ID: cid, LOCATION_ID: 'STORE', SUPPLIER_ID: supId, GRN_NUMBER: no, GRN_DATE: date, RECEIVED_BY: user, STATUS: 'RECEIVED', NOTES: sup, CREATED_AT: now }]);
        bnxSvAdd_(gi, A.gi);
        bnxSvAdd_(pm, [{ PURCHASE_ID: pmId, CLIENT_ID: cid, LOCATION_ID: 'STORE', SUPPLIER_ID: supId, PURCHASE_NUMBER: no, PURCHASE_DATE: date, DELIVERY_DATE: date, SUBTOTAL: r2(sub), DISCOUNT: 0,
          TAXABLE_AMOUNT: r2(sub), TAX_AMOUNT: other, GRAND_TOTAL: tot, PURCHASE_STATUS: 'RECEIVED', PAYMENT_STATUS: 'unpaid', NOTES: sup, CREATED_BY: user, CREATED_AT: now, RECEIVED_BY: user, RECEIVED_AT: date }]);
        bnxSvAdd_(pmi, A.pmi);
      }
    } else {
      var di = bnxSvT_(TR, 'DEPARTMENT_ISSUE'), indents = bnxSvCol_(di, 'INDENT_ID');
      if (mode === 'new') { var mi = 0; indents.forEach(function (v) { var m = String(v || '').match(/^ISS\/(\d+)\//); if (m) mi = Math.max(mi, +m[1]); }); no = 'ISS/' + ('0000' + (mi + 1)).slice(-5) + '/' + fyTxt; }
      var oldIdx = []; indents.forEach(function (v, i) { if (String(v) === no) oldIdx.push(i + 2); });
      if (mode !== 'new' && !oldIdx.length) return { success: false, error: 'Issue slip ' + no + ' not found' };
      var oldFirst = oldIdx.length ? bnxSvRowObj_(di, oldIdx[0]) : null;
      var dept = String(p.dept || (oldFirst && oldFirst.DEPARTMENT) || '').toUpperCase(); if (mode !== 'delete' && !dept) return { success: false, error: 'Choose the department' };
      var base = 'ISS' + no.replace(/^ISS\/0*(\d+)\/(\d{2})(\d{2})-(\d{2})(\d{2})$/, function (a, n, a1, a2, b1, b2) { return ('0000' + n).slice(-5) + '-' + a2 + b2; }).replace(/[^A-Za-z0-9-]/g, '');
      if (mode !== 'new') {
        var ids = {}, issIds = bnxSvCol_(di, 'ISSUE_ID'); oldIdx.forEach(function (r) { ids[String(issIds[r - 2])] = 1; });
        bnxSvDel_(sm, findMv(/^DEPARTMENT_ISSUE$/i, ids));
        bnxSvDel_(di, oldIdx);
      }
      if (mode !== 'delete') {
        var DI = [];
        lines.forEach(function (l, i) {
          var id = base + '-' + ('0' + (i + 1)).slice(-2), amt = r2(l.qty * l.rate);
          DI.push({ CLIENT_ID: cid, CREATED_AT: now, ISSUE_ID: id, DATE: date, INDENT_ID: no, ITEM_ID: l.code, ITEM_NAME: l.name, UNIT: l.uom, ISSUED_QTY: l.qty, DEPARTMENT: dept, ISSUED_BY: user,
            REMARKS: (mode === 'edit' ? 'altered' : 'entered') + ' in store · rate ' + l.rate + ' · amount ' + amt });
          newMv.push({ STOCK_MOVEMENT_ID: 'SM-' + id, CLIENT_ID: cid, LOCATION_ID: 'STORE', ITEM_ID: l.code, MOVEMENT_TYPE: 'ISSUE', MOVEMENT_DATE: date, QUANTITY_IN: 0, QUANTITY_OUT: l.qty, RATE: l.rate,
            SOURCE_TYPE: 'DEPARTMENT_ISSUE', SOURCE_ID: id, REFERENCE_NUMBER: no, NOTES: 'Issued to ' + dept, CREATED_BY: user, CREATED_AT: now });
        });
        bnxSvAdd_(di, DI);
      }
    }
    sm.last = sm.sh.getLastRow(); bnxSvAdd_(sm, newMv);

    /* new store balance of every touched item — in memory: the movements already read, minus the removed rows, plus the new ones */
    var bal = {}, skip = function (mt, st) { return /^SALE$/i.test(mt) || (/^TRANSFER_IN$/i.test(mt) && /^DEPARTMENT_ISSUE$/i.test(st)); };
    for (var k = 0; k < mc.ITEM_ID.length; k++) {
      var it = String(mc.ITEM_ID[k]); if (!touched[it] || removed[k] || String(mc.LOCATION_ID[k] || 'STORE') !== 'STORE' || skip(String(mc.MOVEMENT_TYPE[k] || ''), String(mc.SOURCE_TYPE[k] || ''))) continue;
      bal[it] = (bal[it] || 0) + N(mc.QUANTITY_IN[k]) - N(mc.QUANTITY_OUT[k]);
    }
    newMv.forEach(function (m) { bal[m.ITEM_ID] = (bal[m.ITEM_ID] || 0) + N(m.QUANTITY_IN) - N(m.QUANTITY_OUT); });
    var val = function (c) { return Math.round((bal[c] || 0) * 1000) / 1000; };

    var neg = [];
    if (rmT.h.CURRENT_STOCK) {
      var cs = rmc.CURRENT_STOCK.slice(), ch = [];
      Object.keys(touched).forEach(function (c) { var it = rm[c]; if (!it) return; var v = val(c); cs[it.i] = v; ch.push(it.i); if (v < -1e-6) neg.push(it.name + ' ' + v); });
      bnxVfPatch_(rmT, 'CURRENT_STOCK', cs, ch);
    }
    try {   /* STOCK_BALANCE: patch existing rows, append missing ones */
      var sb = bnxSvT_(TR, 'STOCK_BALANCE'), sc = bnxVfCols_(sb, ['ITEM_ID', 'LOCATION_ID', 'CURRENT_QUANTITY', 'AVAILABLE_QUANTITY', 'UPDATED_AT']), have = {}, cq = sc.CURRENT_QUANTITY.slice(), aq = sc.AVAILABLE_QUANTITY.slice(), up = sc.UPDATED_AT.slice(), ci = [];
      sc.ITEM_ID.forEach(function (c, i) { c = String(c); if (touched[c] && String(sc.LOCATION_ID[i] || 'STORE') === 'STORE') { have[c] = 1; cq[i] = val(c); aq[i] = val(c); up[i] = now; ci.push(i); } });
      bnxVfPatch_(sb, 'CURRENT_QUANTITY', cq, ci); bnxVfPatch_(sb, 'AVAILABLE_QUANTITY', aq, ci); bnxVfPatch_(sb, 'UPDATED_AT', up, ci);
      var newSb = []; Object.keys(touched).forEach(function (c) { if (!have[c] && rm[c]) newSb.push({ STOCK_BALANCE_ID: 'SB-' + c + '-STORE', CLIENT_ID: cid, LOCATION_ID: 'STORE', ITEM_ID: c, CURRENT_QUANTITY: val(c), RESERVED_QUANTITY: 0, AVAILABLE_QUANTITY: val(c), UPDATED_AT: now }); });
      bnxSvAdd_(sb, newSb);
    } catch (e) {}
    try { lock.releaseLock(); lock = null; } catch (e) {}
    try { if (typeof bnxInvalidateTodayReportCaches_ === 'function') bnxInvalidateTodayReportCaches_(cid); } catch (e) {}
    return { success: true, data: { no: no, kind: kind, mode: mode, date: date, lines: lines.length, negative: neg, ms: Date.now() - t0 } };
  } catch (e) { return { success: false, error: String(e && e.message || e) }; }
  finally { try { if (lock) lock.releaseLock(); } catch (x) {} }
}

/* Self-test: writes a tiny GRN and a tiny issue, alters each, deletes each, and checks the stock and row counts came back.
   Run bnxVoucherFastSelfTest from the editor, then read the Execution log. */
function bnxVoucherFastSelfTest() {
  var session = { CLIENT_ID: 'CL00010', USER_NAME: 'selftest' }, cid = session.CLIENT_ID, log = [], db = bnxSvDbs_(cid);
  var rmT = bnxSvT_(db.MASTER, 'RAW_MATERIAL_MASTER'), rc = bnxVfCols_(rmT, ['ITEM_CODE', 'COST_PRICE', 'ITEM_NAME', 'CURRENT_STOCK']);
  var ix = -1; for (var i = 0; i < rc.ITEM_CODE.length; i++) { if (rc.ITEM_CODE[i] && Number(rc.COST_PRICE[i]) > 0) { ix = i; break; } }
  if (ix < 0) { Logger.log('No item with a cost price'); return; }
  var code = String(rc.ITEM_CODE[ix]), rate = Number(rc.COST_PRICE[ix]);
  var stock = function () { var t = bnxSvT_(db.MASTER, 'RAW_MATERIAL_MASTER'), c = bnxVfCols_(t, ['ITEM_CODE', 'CURRENT_STOCK']); return Number(c.CURRENT_STOCK[c.ITEM_CODE.map(String).indexOf(code)]) || 0; };
  var rows = function () { return ['STOCK_MOVEMENT', 'PURCHASE_INVOICE', 'PURCHASE_INVOICE_ITEMS', 'GOODS_RECEIPT_NOTE', 'GRN_ITEMS', 'PURCHASE_MASTER', 'PURCHASE_ITEMS', 'DEPARTMENT_ISSUE'].map(function (n) { return bnxSvT_(db.TRANSACTION, n).sh.getLastRow(); }).join(','); };
  var before = stock(), rows0 = rows(), t = Date.now(), L = function (q) { return [{ code: code, qty: q, rate: rate }]; }, ok = true;
  var chk = function (what, got, want) { var pass = Math.abs(got - want) < 1e-6; if (!pass) ok = false; log.push((pass ? 'OK   ' : 'FAIL ') + what + ': stock ' + got + ' (expect ' + want + ')'); };
  var a = bnxVoucherSaveFast_(session, { kind: 'grn', mode: 'new', supplier: 'SELF TEST', lines: L(2) }); log.push('GRN new ' + JSON.stringify(a)); if (!a.success) { Logger.log(log.join('\n')); return; }
  chk('GRN new', stock(), before + 2);
  var b = bnxVoucherSaveFast_(session, { kind: 'grn', mode: 'edit', no: a.data.no, date: a.data.date, supplier: 'SELF TEST', lines: L(5) }); log.push('GRN edit ' + JSON.stringify(b));
  chk('GRN edit 2→5', stock(), before + 5);
  var c = bnxVoucherSaveFast_(session, { kind: 'grn', mode: 'delete', no: a.data.no }); log.push('GRN delete ' + JSON.stringify(c));
  chk('GRN delete', stock(), before);
  var d = bnxVoucherSaveFast_(session, { kind: 'iss', mode: 'new', dept: 'SELF TEST', lines: L(1) }); log.push('ISS new ' + JSON.stringify(d)); if (!d.success) { Logger.log(log.join('\n')); return; }
  chk('ISS new', stock(), before - 1);
  var e = bnxVoucherSaveFast_(session, { kind: 'iss', mode: 'edit', no: d.data.no, date: d.data.date, dept: 'SELF TEST', lines: L(3) }); log.push('ISS edit ' + JSON.stringify(e));
  chk('ISS edit 1→3', stock(), before - 3);
  var f = bnxVoucherSaveFast_(session, { kind: 'iss', mode: 'delete', no: d.data.no }); log.push('ISS delete ' + JSON.stringify(f));
  chk('ISS delete', stock(), before);
  var rows1 = rows(); if (rows1 !== rows0) { ok = false; log.push('FAIL sheet row counts changed: ' + rows0 + ' → ' + rows1); } else log.push('OK   sheet row counts back to ' + rows0);
  log.push((ok ? 'ALL PASSED' : 'SOME FAILED') + ' · item ' + code + ' · total ' + (Date.now() - t) + ' ms');
  Logger.log(log.join('\n'));
}
/* ───────────── the router ───────────── */
(function (G) {
  var prevPost = (typeof G.doPost === 'function' && !G.doPost.__bnxFinal) ? G.doPost : null;
  var prevGet = (typeof G.doGet === 'function' && !G.doGet.__bnxFinal) ? G.doGet : null;
  function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
  function unknown(res) {
    try { var t = res && typeof res.getContent === 'function' ? res.getContent() : ''; return /Unknown action|INVALID ACTION|Not handled:/i.test(t.slice(0, 400)); } catch (e) { return false; }
  }
  var ACT = {
    STORE_REGISTERS: function (s, p) { return bnxStoreRegisters_(s, p); },
    GET_COMPANY_PROFILE: function (s, p) { return bnxGetCompanyProfile_(s, p); },
    INV_LIVE_DATA: function (s, p) { return bnxInvLiveData_(s, p); },
    STORE_ITEM_LEDGER: function (s, p) { return bnxStoreItemLedger_(s, p); },
    STORE_VOUCHER_SAVE: function (s, p) { return bnxVoucherSaveFast_(s, p); },
    GET_VENDORS: function (s, p) { return bnxGetVendorsFast_(s, p); },
    GET_GRN_REGISTER: function (s, p) { return bnxGetGrnRegisterFast_(s, p); },
    GET_PURCHASE_INVOICES: function (s, p) { return bnxGetPurchaseInvoicesFast_(s, p); },
    GET_DEPT_ISSUES: function (s, p) { return bnxGetDeptIssuesV2_(s, p); },
    ACK_DEPT_ISSUE: function (s, p) { return bnxAckDeptIssueV2_(s, p); },
    RECIPE_COSTING_LIST: function (s, p) { return bnxRecipeCostingList_(s, p); },
    RECIPE_SAVE: function (s, p) { return bnxRecipeSave_(s, p); },
    RECIPE_DELETE: function (s, p) { return bnxRecipeDelete_(s, p); },
    FOOD_COST_REPORT: function (s, p) { return bnxFoodCostReport_(s, p); },
    LOCATION_STOCK: function (s, p) { return bnxLocationStock_(s, p); },
    WASTAGE_SAVE: function (s, p) { return bnxWastageSave_(s, p); },
    RECIPE_COSTING_REFRESH: function (s, p) { return bnxRecipeCostingRefresh_(s, p); },
    RECIPE_AUTO_DRAFT: function (s, p) { return String(p && p.scope || '').toUpperCase() === 'BAR' && typeof bnxBarAutoDraft_ === 'function' ? bnxBarAutoDraft_(s, p) : bnxRecipeAutoDraft_(s, p); },
    PURCHASE_BILLS_SETTLE: function (s, p) { return bnxPurchaseBillsSettle_(s, p); },
    GET_PURCHASE_PAYMENTS: function (s, p) { return bnxGetPurchasePayments_(s, p); },
    LEDGER_LINK_SAVE: function (s, p) { return bnxLedgerLinkSave_(s, p); },
    LEDGER_LINK_LIST: function (s, p) { return bnxLedgerLinkList_(s, p); },
    TALLY_MARK_STATUS: function (s, p) { return bnxTallyStatusSet_(s, p, false); },
    TALLY_ENQUEUE: function (s, p) { return bnxTallyStatusSet_(s, Object.assign({}, p, { status: 'QUEUED' }), true); },
    TALLY_PULL_PENDING: function (s, p) { return bnxTallyPullPending_(s, p); },
    TALLY_STATUS_LIST: function (s, p) { return bnxTallyStatusList_(s, p); },
    TALLY_LEDGER_MAP: function (s, p) { return bnxTallyLedgerMap_(s, p); },
    PURCHASE_BILLNO_SET: function (s, p) { return bnxPurchaseBillNoSet_(s, p); },
    TALLY_PR_IMPORT: function (s, p) { return bnxTallyPrImport_(s, p); },
    TALLY_PR_LIST: function (s, p) { return bnxTallyPrList_(s, p); },
    GSTIN_LOOKUP: function (s, p) { return bnxGstinLookup_(s, p); },
    BILL_LINK_REMOVE: function (s, p) { return bnxBillLinkRemove_(s, p); },
    GET_ROLE_ACCESS: function (s, p) { return bnxRoleAccessGet_(s, p); },
    SAVE_ROLE_ACCESS: function (s, p) { return bnxRoleAccessSave_(s, p); },
    MENU_AR_ADMIN_LIST: function (s, p) { return bnxMenuArAdminList_(s, p); },
    MENU_AR_PHOTO_UPLOAD: function (s, p) { return bnxMenuArPhotoUpload_(s, p); },
    MENU_BOOK_ADMIN: function (s, p) { return bnxMenuBookAdmin_(s, p); },
    MENU_BOOK_PAGE_SAVE: function (s, p) { return bnxMenuBookPageSave_(s, p); },
    MENU_BOOK_PAGE_DELETE: function (s, p) { return bnxMenuBookPageDelete_(s, p); },
    MENU_BOOK_ORDER: function (s, p) { return bnxMenuBookOrder_(s, p); },
    MENU_BOOK_META_SAVE: function (s, p) { return bnxMenuBookMetaSave_(s, p); },
    MENU_AR_SAVE: function (s, p) { return bnxMenuArSave_(s, p); },
    MENU_AR_IMPORT: function (s, p) { return bnxMenuArImport_(s, p); },
    MENU_AR_SHEET_IMPORT: function (s, p) { return bnxMenuArSheetImport_(s, p); },
    CREATE_CLIENT: function (s, p) { return bnxCreateClientWizard_(s, p); },
    /* super-admin tools (Client Master · New Client · User Control) */
    GET_ALL_CLIENTS: function (s, p) { return bnxAdm_(s, function () { return bnxAdmClients_(s, p); }); },
    DELETE_CLIENT: function (s, p) { return bnxAdm_(s, function () { return bnxAdmClientStatus_(s, p); }); },
    CHECK_DB_HEALTH: function (s, p) { return bnxAdm_(s, function () { return bnxAdmDbHealth_(p, false); }); },
    MIGRATE_CLIENT_DB: function (s, p) { return bnxAdm_(s, function () { return bnxAdmDbHealth_(p, true); }); },
    UPGRADE_ALL_CLIENTS: function (s, p) { return bnxAdm_(s, function () { return bnxAdmUpgradeAll_(p); }); },
    GET_ALL_USERS: function (s, p) { return bnxAdm_(s, function () { return bnxAdmUsers_(p); }); },
    UPDATE_USER: function (s, p) { return bnxAdm_(s, function () { return bnxAdmUserUpdate_(s, p); }); },
    DELETE_USER: function (s, p) { return bnxAdm_(s, function () { return bnxAdmUserUpdate_(s, Object.assign({}, p, { STATUS: 'DELETED' })); }); },
    BULK_USER_OP: function (s, p) { return bnxAdm_(s, function () { return bnxAdmBulk_(s, p); }); },
    CREATE_USER: function (s, p) { return bnxAdm_(s, function () { return bnxAdmUserCreate_(s, p); }); },
    GET_SESSIONS: function (s, p) { return bnxAdm_(s, function () { return bnxAdmSessions_(s); }); },
    KILL_SESSION: function (s, p) { return bnxAdm_(s, function () { return bnxAdmKill_(s, p, false); }); },
    KILL_ALL_SESSIONS: function (s, p) { return bnxAdm_(s, function () { return bnxAdmKill_(s, p, true); }); },
    DB_TOOL: function (s, p) { return bnxAdm_(s, function () { return bnxAdmDbTool_(s, p); }); },
    /* industry starter data + quick touch-and-pay POS */
    INDUSTRY_LIST: function (s, p) { return bnxIndustryList_(); },
    INDUSTRY_SEED: function (s, p) { return bnxIndustryAction_(s, p, true); },
    QPOS_CONFIG: function (s, p) { return bnxQposConfig_(s); },
    QPOS_SAVE: function (s, p) { return bnxQposSave_(s, p); },
    /* WhatsApp: normal WhatsApp (tap-to-send) list + log, and save any WhatsApp contact into the guest CRM */
    WA_CRM_SAVE: function (s, p) { return bnxWaCrmSave_(s, p); },
    /* GST workspace (Dashboard/gst/gst.html): cloud copy of each GSTIN's working data, per ERP client */
    GST_CLOUD_SAVE: function (s, p) { return bnxGstCloud_(s, p, 'SAVE'); },
    GST_CLOUD_LOAD: function (s, p) { return bnxGstCloud_(s, p, 'LOAD'); },
    GST_CLOUD_LIST: function (s, p) { return bnxGstCloud_(s, p, 'LIST'); },
    GST_SHEET_SYNC: function (s, p) { return bnxGstSheetSync_(s, p); },
    /* GST page › Data source "Live from ERP": sales (BILL_MASTER) + purchases (PURCHASE_INVOICE) of one month — gst-live.gs */
    GST_LIVE_DATA: function (s, p) { return bnxGstLive_(s, p); },
    GST_TEAM_LIST: function (s, p) { return bnxGstTeam_(s, p, 'LIST'); },
    GST_TEAM_ADD: function (s, p) { return bnxGstTeam_(s, p, 'ADD'); },
    GST_TEAM_REMOVE: function (s, p) { return bnxGstTeam_(s, p, 'REMOVE'); },
    GST_TRIAL_ADMIN: function (s, p) { return bnxAdm_(s, function () { return bnxGstTrialAdmin_(s, p); }); },
    GG_WA_MANUAL_LIST: function (s, p) { return bnxWaManualList_(s, p); },
    GG_WA_MANUAL_LOG: function (s, p) { return bnxWaManualLog_(s, p); }
  };
  var FN = { RECIPE_COSTING_LIST: 'bnxRecipeCostingList_', RECIPE_SAVE: 'bnxRecipeSave_', RECIPE_DELETE: 'bnxRecipeDelete_', FOOD_COST_REPORT: 'bnxFoodCostReport_',
    WASTAGE_SAVE: 'bnxWastageSave_', RECIPE_COSTING_REFRESH: 'bnxRecipeCostingRefresh_', RECIPE_AUTO_DRAFT: 'bnxRecipeAutoDraft_', PURCHASE_BILLS_SETTLE: 'bnxPurchaseBillsSettle_',
    GET_PURCHASE_PAYMENTS: 'bnxGetPurchasePayments_' };
  FN.LOCATION_STOCK = 'bnxLocationStock_'; FN.LEDGER_LINK_SAVE = 'bnxLedgerLinkSave_'; FN.LEDGER_LINK_LIST = 'bnxLedgerLinkList_'; FN.TALLY_MARK_STATUS = 'bnxTallyStatusSet_'; FN.TALLY_ENQUEUE = 'bnxTallyStatusSet_'; FN.TALLY_PULL_PENDING = 'bnxTallyPullPending_'; FN.TALLY_STATUS_LIST = 'bnxTallyStatusList_'; FN.TALLY_LEDGER_MAP = 'bnxTallyLedgerMap_'; FN.PURCHASE_BILLNO_SET = 'bnxPurchaseBillNoSet_'; FN.TALLY_PR_IMPORT = 'bnxTallyPrImport_'; FN.TALLY_PR_LIST = 'bnxTallyPrList_'; FN.GSTIN_LOOKUP = 'bnxGstinLookup_'; FN.BILL_LINK_REMOVE = 'bnxBillLinkRemove_'; FN.CREATE_CLIENT = 'bnxCreateClientWizard_';
  FN.INDUSTRY_LIST = 'bnxIndustryList_'; FN.INDUSTRY_SEED = 'bnxIndustryAction_'; FN.QPOS_CONFIG = 'bnxQposConfig_'; FN.QPOS_SAVE = 'bnxQposSave_'; FN.WA_CRM_SAVE = 'bnxWaCrmSave_'; FN.GG_WA_MANUAL_LIST = 'bnxWaManualList_'; FN.GG_WA_MANUAL_LOG = 'bnxWaManualLog_'; FN.GST_CLOUD_SAVE = 'bnxGstCloud_'; FN.GST_CLOUD_LOAD = 'bnxGstCloud_'; FN.GST_CLOUD_LIST = 'bnxGstCloud_'; FN.GST_SHEET_SYNC = 'bnxGstSheetSync_'; FN.GST_LIVE_DATA = 'bnxGstLive_'; FN.GST_TEAM_LIST = 'bnxGstTeam_'; FN.GST_TEAM_ADD = 'bnxGstTeam_'; FN.GST_TEAM_REMOVE = 'bnxGstTeam_'; FN.GST_TRIAL_ADMIN = 'bnxAdm_';
  ['GET_ALL_CLIENTS','DELETE_CLIENT','CHECK_DB_HEALTH','MIGRATE_CLIENT_DB','UPGRADE_ALL_CLIENTS','GET_ALL_USERS','UPDATE_USER','DELETE_USER','BULK_USER_OP','CREATE_USER','GET_SESSIONS','KILL_SESSION','KILL_ALL_SESSIONS','DB_TOOL'].forEach(function (a) { FN[a] = 'bnxAdm_'; });
  FN.GET_ROLE_ACCESS = 'bnxRoleAccessGet_'; FN.SAVE_ROLE_ACCESS = 'bnxRoleAccessSave_'; FN.MENU_AR_ADMIN_LIST = 'bnxMenuArAdminList_'; FN.MENU_AR_PHOTO_UPLOAD = 'bnxMenuArPhotoUpload_'; FN.MENU_BOOK_ADMIN = 'bnxMenuBookAdmin_'; FN.MENU_BOOK_PAGE_SAVE = 'bnxMenuBookPageSave_'; FN.MENU_BOOK_PAGE_DELETE = 'bnxMenuBookPageDelete_'; FN.MENU_BOOK_ORDER = 'bnxMenuBookOrder_'; FN.MENU_BOOK_META_SAVE = 'bnxMenuBookMetaSave_'; FN.MENU_AR_SAVE = 'bnxMenuArSave_'; FN.MENU_AR_IMPORT = 'bnxMenuArImport_'; FN.MENU_AR_SHEET_IMPORT = 'bnxMenuArSheetImport_';   /* menu-ar.gs */
  function have(action) { var f = FN[action] || 'bnxStoreRegisters_'; return typeof G[f] === 'function'; }

  function core(e) {
    if (typeof bnxCoreDoPost_ === 'function') return bnxCoreDoPost_(e);
    return prevPost ? prevPost(e) : out({ success: false, error: 'ERP router missing — paste the new Code live …gs (it has bnxCoreDoPost_)' });
  }

  /* 2026-11-19 guest UPI payment: Growth Hub's UPI ID was empty while the bill-QR UPI (Print Settings › UPI QR on Invoice,
     MASTER › CLIENT_ASSETS KEY=UPI) was set — so the customer page never showed "💳 Pay now · UPI". Growth Hub's own setting
     still wins; when it is empty the bill-QR UPI is used (PAY_INFO, WA_TOKEN, tickets). Wrapped at the first request,
     when every file is loaded. */
  function upiPatch() {
    try {
      var o = G.bnxGgCfg_; if (typeof o !== 'function' || o.__bnxUpi) return;
      var w = function (cid) {
        var c = o.apply(this, arguments);
        try { if (c && !c.upiId) { var u = bnxRestaurantUpi_(String(cid || '')); if (u && u.vpa) c = Object.assign({}, c, { upiId: u.vpa, upiName: c.upiName || u.pn || '' }); } } catch (x) {}
        return c;
      };
      w.__bnxUpi = true; G.bnxGgCfg_ = w; try { bnxGgCfg_ = w; } catch (x) {}
    } catch (x) {}
  }
  var finalPost = function (e) {
    upiPatch();
    var payload = null, action = '';
    try { payload = JSON.parse(e && e.postData && e.postData.contents); action = String((payload && payload.action) || ''); } catch (x) { payload = null; }
    if (!payload) return prevPost ? prevPost(e) : core(e);                       /* form posts / non-JSON (public forms) */

    /* GST free trial: public sign-up / sign-in, and GST_* actions with a trial token (GT.…) */
    if (action === 'GST_SIGNUP' || action === 'GST_TRIAL_LOGIN' || action === 'GST_TRIAL_LOGOUT') { try { return out(bnxGstTrialPublic_(action, payload)); } catch (err) { return out({ success: false, error: String(err && err.message || err) }); } }
    if (/^GST_(CLOUD_|SHEET_|TEAM_)/.test(action) && /^GT\./.test(String(payload.sessionToken || '')) && ACT[action]) {
      try { var ts = bnxGstTrialSession_(String(payload.sessionToken)); if (!ts.ok) return out({ success: false, statusCode: ts.code || 401, error: ts.error, message: ts.error });
        return out(ACT[action](ts.session, payload) || { success: false, message: 'No result' }); } catch (err) { return out({ success: false, error: String(err && err.message || err) }); }
    }

    /* AR / product view (menu-ar.gs): public, read-only menu data */
    if (action === 'MENU_BOOK') { try { return out(typeof bnxMenuBookPublic_ === 'function' ? bnxMenuBookPublic_(payload) : { success: false, error: 'menu-book.gs not deployed' }); } catch (err) { return out({ success: false, error: String(err && err.message || err) }); } }
    if (action === 'MENU_AR_LIST' || action === 'MENU_AR_ITEM' || action === 'MENU_AR_PHOTO') {
      if (typeof bnxMenuArPublic_ !== 'function') return out({ success: false, error: 'menu-ar.gs not deployed' });
      try { return out(action === 'MENU_AR_PHOTO' ? bnxMenuArPhoto_(payload) : bnxMenuArPublic_(payload)); } catch (err) { return out({ success: false, error: String(err && err.message || err) }); }
    }

    /* approval gate + menu-card / QR promo / print queue / cash book … (menu-card-qr-promo.gs) */
    if (typeof bnxMpHandle_ === 'function') { try { var mp = bnxMpHandle_(e); if (mp) return mp; } catch (x) {} }

    /* GET_TABLE_FLOOR: ERP first; only an empty answer is rebuilt from TABLE_MASTER */
    if (action === 'GET_TABLE_FLOOR') {
      var first = core(e);
      try { var j = JSON.parse(first.getContent()), t = j && (j.tables || (j.data && (j.data.tables || j.data.floor))); if (j && j.success !== false && Array.isArray(t) && t.length) return first; } catch (x) {}
      try { var ss = bnxVerifySession(String(payload.sessionToken || ''), String(payload.clientId || '')); if (ss && !ss.__transient && typeof bnxSrRows_ === 'function') return out(bnxTableFloorFallback_(ss)); } catch (x) {}
      return first;
    }

    /* store / recipe / payments actions — answered here after the normal login check */
    if (ACT[action] && have(action)) {
      try {
        var token = String(payload.sessionToken || ''), clientId = String(payload.clientId || '');
        /* super-admin tools name ANOTHER client in clientId (the one to check / deactivate): the login is checked on its own client */
        if (FN[action] === 'bnxAdm_') clientId = '';
        var session = bnxVerifySession(token, clientId);
        if (session && session.__transient) return out({ success: false, error: 'SERVER_BUSY', message: 'Server busy - please retry', retryable: true, statusCode: 503 });
        if (!session) return out({ success: false, statusCode: 401, error: 'Invalid or expired session', message: 'Invalid or expired session' });
        if (clientId && session.CLIENT_ID !== clientId) return out({ success: false, statusCode: 403, error: 'Unauthorized access', message: 'Unauthorized access' });
        if (action === 'STORE_VOUCHER_SAVE' && typeof bnxIsBusinessDateClosed_ === 'function') {
          var d = bnxSrDate_(payload.date);
          if (d && bnxIsBusinessDateClosed_(session.CLIENT_ID, d)) return out({ success: false, error: 'BUSINESS_DAY_CLOSED', message: 'Business date ' + d + ' is closed. Posting, editing or deleting transactions for a closed date is blocked.' });
        }
        var res = ACT[action](session, payload);
        return out(res && typeof res === 'object' ? res : { success: false, message: 'No result' });
      } catch (err) { return out({ success: false, message: String(err && err.message || err), error: String(err && err.message || err) }); }
    }

    /* Growth Hub: no UPI ID set → take the restaurant's own UPI (Dashboard › Settings › UPI QR) and save it once */
    if (action === 'GG_CFG_GET') {
      var g = core(e);
      try {
        var gj = JSON.parse(g.getContent()), cfg = gj && gj.data && gj.data.cfg;
        if (gj && gj.success && cfg && !String(cfg.upiId || '').trim()) {
          var upi = bnxRestaurantUpi_(String(payload.clientId || ''));
          if (upi.vpa) {
            var sv = core({ postData: { contents: JSON.stringify(Object.assign({}, payload, { action: 'GG_CFG_SAVE', cfg: { upiId: upi.vpa, upiName: cfg.upiName || upi.pn } })) } });
            try { var sj = JSON.parse(sv.getContent()); if (sj && sj.success && sj.data) gj.data.cfg = sj.data; else { cfg.upiId = upi.vpa; cfg.upiName = cfg.upiName || upi.pn; } } catch (x) { cfg.upiId = upi.vpa; }
            gj.data.upiFromRestaurant = true;
            return out(gj);
          }
        }
      } catch (x) {}
      return g;
    }

    /* the ERP */
    var r = core(e);
    if (prevPost && unknown(r)) { try { var r2 = prevPost(e); if (r2 && !unknown(r2)) return r2; } catch (x) {} }
    try { if (typeof bnxMpAfter_ === 'function') { var a2 = bnxMpAfter_(e, r); if (a2) return a2; } } catch (x) {}   /* SAVE_MENU_ITEM guaranteed write */
    return r;
  };
  finalPost.__bnxFinal = true; finalPost.__bnxMp = true;

  var finalGet = function (e) {
    upiPatch();
    var a = String(e && e.parameter && e.parameter.action || '');
    try {
      if (a === 'BNX_WHOAMI') return out({ success: true, data: { scriptId: ScriptApp.getScriptId(), build: BNX_FINAL_BUILD, coreRouter: typeof bnxCoreDoPost_ === 'function',
        doPostWired: true, menuCardQrPromo: typeof bnxMenuPromoRoute_ === 'function' ? '2026-10-09' : '', approvals: typeof bnxApprovalRoute_ === 'function',
        recipeCosting: typeof bnxFoodCostReport_ === 'function', storeRegisters: typeof bnxStoreRegisters_ === 'function', payments: typeof bnxPurchaseBillsSettle_ === 'function',
        duesList: true, posImport: true, barTdb: true, kitchenTdb: true, cashBookDaywise: true, dsrItemGroup: true, pettyMeta: true, softLock: true, eventVideo: true,
        menuAr: typeof bnxMenuArPublic_ === 'function', menuBook: typeof bnxMenuBookPublic_ === 'function', fastMenu: typeof bnxPublicMenuFastOut_ === 'function', olderDoGet: !!prevGet, olderDoPost: !!prevPost } });
      if (a === 'MENU_AR' && typeof bnxMenuArPublic_ === 'function') return out(bnxMenuArPublic_(e.parameter));
      if (a === 'MENU_AR_PHOTO' && typeof bnxMenuArPhoto_ === 'function') return out(bnxMenuArPhoto_(e.parameter));
      if (a === 'MENU_BOOK' && typeof bnxMenuBookPublic_ === 'function') return out(bnxMenuBookPublic_(e.parameter));
      if (a === 'PUBLIC_MENU' && typeof bnxPublicMenuFastOut_ === 'function') return bnxPublicMenuFastOut_(e.parameter.clientId);   /* public-menu-speed.gs: compressed 10-min cache */
      if (a === 'PUBLIC_MENU' && typeof bnxPublicMenuOut_ === 'function') return bnxPublicMenuOut_(e.parameter.clientId);
      /* 2026-11-19 "feedback unknown": the Growth Hub modes (FEEDBACK, PAY_INFO, PAY_CLAIM, WA_TOKEN, RESERVE, TICKET_…) live in
         Guest growth suite.gs. They reached it only when that file happened to load after the check-in file (it wraps
         bnxGuestMode_ at load). Now they are asked first here, whatever the file order; other modes go on as before. */
      if (a === 'GUEST_CHECKIN' && e.parameter.mode && typeof bnxGgPublic_ === 'function') {
        try { var gg = bnxGgPublic_(e.parameter); if (gg) return out(gg); } catch (x) { return out({ success: false, error: String(x && x.message || x) }); }
      }
      if (a === 'GUEST_CHECKIN' && typeof bnxGuestCheckinPublic_ === 'function') return out(bnxGuestCheckinPublic_(e.parameter));
    } catch (err) { return out({ success: false, error: String(err && err.message || err) }); }
    if (prevGet) return prevGet(e);
    return out({ success: true, message: 'Balaji NextGen ERP API', build: BNX_FINAL_BUILD });
  };
  finalGet.__bnxFinal = true;

  /* assigned (not declared) on purpose: runs after every file is loaded, so it wins over any earlier doPost / doGet */
  try { G.doPost = finalPost; } catch (x) {}
  try { doPost = finalPost; } catch (x) {}
  try { G.doGet = finalGet; } catch (x) {}
  try { doGet = finalGet; } catch (x) {}
})(this);

/* Run from the editor after saving: tells you if the router is wired and which older doPost/doGet were found. */
function RUN_FINAL_RouterCheck() {
  var G = globalThis;
  Logger.log('doPost final: ' + !!(G.doPost && G.doPost.__bnxFinal) + ' · doGet final: ' + !!(G.doGet && G.doGet.__bnxFinal) +
    ' · ERP router bnxCoreDoPost_: ' + (typeof bnxCoreDoPost_ === 'function') + ' · store: ' + (typeof bnxStoreRegisters_ === 'function') +
    ' · recipes: ' + (typeof bnxFoodCostReport_ === 'function') + ' · payments: ' + (typeof bnxPurchaseBillsSettle_ === 'function') + ' · build ' + BNX_FINAL_BUILD);
  var r = G.doGet({ parameter: { action: 'BNX_WHOAMI' } }); Logger.log(r.getContent());
}


/* ═══ BILLS · LEDGERS · MENU PHOTOS (2026-11-18) ═══════════════════════════════════════════════════════════════════
   1. Purchase bill links: BNX_DriveAutoFolders.gs looked for "<client>_TRANSACTION_DB" by NAME inside the Drive folder —
      when the file sits elsewhere / was renamed, GET_PURCHASE_EXTRAS and SET_PURCHASE_BILL failed ("not found") and every
      purchase showed "No file" although PURCHASE_BILL_LINKS has 674 links. Now the DB comes from CLIENT_DATABASE_REGISTRY
      (same as the ERP). SET_PURCHASE_BILL also writes the link into PURCHASE_INVOICE.BILL_FILE_URL when it is empty.
   2. Supplier ledgers were uploaded to Drive but the link was kept ONLY in that browser (localStorage) → not shown on any
      other PC / after clearing. Now: VENDOR_LEDGER_LINKS (TRANSACTION DB, made automatically) + LEDGER_LINK_SAVE / LIST.
      LIST also finds ledgers uploaded earlier in Drive › <client> › Ledger › <month> (Ledger_<vendor>_<month>.*).
   3. RUN_IMG_SyncMenuSheet: photos from the "Hashtag Menu" sheet (Google Drive Link + Master Item ID) → ITEM_MASTER
      (every IMAGE_URL / ICON_URL / DRIVE_FILE_ID copy), MENU_CARD_ITEMS.PRODUCT_IMAGE_URL, ITEM_IMAGE_MANIFEST,
      ASSET_MANIFEST; each photo is shared "anyone with the link – view" (a private Drive photo never shows in the app). */
function BNXDRV_txDb_(clientId) {
  var ids = bnxGetClientDbIds_(clientId);
  if (!ids || !ids.TRANSACTION) throw new Error(clientId + ': TRANSACTION_DB id missing in CLIENT_DATABASE_REGISTRY');
  return SpreadsheetApp.openById(ids.TRANSACTION);
}
(function (G) {
  if (typeof G.BNXDRV_setBill_ !== 'function' || G.BNXDRV_setBill_.__bnxFix) return;
  var orig = G.BNXDRV_setBill_;
  var w = function (d) {
    var r = orig(d);
    try {
      if (r && r.success && d && d.invoiceId && d.url) {
        var sh = BNXDRV_txDb_(BNXDRV_clientId_(d.clientId)).getSheetByName('PURCHASE_INVOICE'), v = sh.getDataRange().getValues(), h = v[0].map(String);
        var ci = h.indexOf('PURCHASE_INVOICE_ID'), cu = h.indexOf('BILL_FILE_URL'), ch = h.indexOf('PURCHASE_HEAD');
        for (var i = 1; i < v.length; i++) if (String(v[i][ci]) === String(d.invoiceId)) {
          if (cu >= 0 && !v[i][cu]) sh.getRange(i + 1, cu + 1).setValue(String(d.url));
          if (ch >= 0 && d.head && !v[i][ch]) sh.getRange(i + 1, ch + 1).setValue(String(d.head));
          break;
        }
      }
    } catch (e) {}
    return r;
  };
  w.__bnxFix = true; G.BNXDRV_setBill_ = w; try { BNXDRV_setBill_ = w; } catch (e) {}
})(this);

var BNX_LL_HEAD = ['LEDGER_LINK_ID', 'CLIENT_ID', 'VENDOR_NAME', 'MONTH', 'FILE_NAME', 'DRIVE_URL', 'FILE_ID', 'UPLOADED_BY', 'UPLOADED_AT', 'REMARKS', 'SOURCE'];
function bnxLedgerSheet_(cid) {
  var ss = SpreadsheetApp.openById(bnxGetClientDbIds_(cid).TRANSACTION), sh = ss.getSheetByName('VENDOR_LEDGER_LINKS');
  if (!sh) { sh = ss.insertSheet('VENDOR_LEDGER_LINKS'); sh.getRange(1, 1, 1, BNX_LL_HEAD.length).setValues([BNX_LL_HEAD]).setFontWeight('bold'); sh.setFrozenRows(1); }
  else if (sh.getLastColumn() < BNX_LL_HEAD.length) sh.getRange(1, 1, 1, BNX_LL_HEAD.length).setValues([BNX_LL_HEAD]).setFontWeight('bold');
  return sh;
}
function bnxLedgerLinkSave_(session, p) {
  var cid = session.CLIENT_ID, vn = String(p.vendorName || '').trim(), mo = String(p.month || '').slice(0, 7), url = String(p.url || p.driveLink || '');
  if (!vn || !/^\d{4}-\d{2}$/.test(mo) || !/^https:\/\/(drive|docs)\.google\.com\//.test(url)) return { success: false, error: 'vendorName, month (yyyy-mm) and a Drive link are needed' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = bnxLedgerSheet_(cid), v = sh.getDataRange().getValues(), h = v[0].map(String), now = new Date().toISOString();
    var fid = (url.match(/\/d\/([\w-]{20,})/) || [])[1] || '';
    var row = [ 'LL' + Date.now(), cid, vn, mo, String(p.fileName || ''), url, fid, String(session.USER_NAME || session.USER_ID || ''), now ];
    for (var i = 1; i < v.length; i++) if (String(v[i][h.indexOf('VENDOR_NAME')]).toUpperCase() === vn.toUpperCase() && String(v[i][h.indexOf('MONTH')]) === mo) {
      row[0] = v[i][0] || row[0]; sh.getRange(i + 1, 1, 1, row.length).setValues([row]); return { success: true, updated: true };
    }
    sh.appendRow(row); return { success: true };
  } finally { lock.releaseLock(); }
}
function bnxLedgerLinkList_(session, p) {
  var cid = session.CLIENT_ID, out = [], seen = {};
  var sh = bnxLedgerSheet_(cid), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) { if (!v[i][2]) continue; var k = String(v[i][2]).toUpperCase() + '|' + v[i][3]; seen[k] = 1;
    out.push({ vendorName: String(v[i][2]), month: String(v[i][3]), fileName: String(v[i][4]), driveLink: String(v[i][5]), uploadedAt: String(v[i][8]), remark: String(v[i][9] || '') }); }
  /* ledgers uploaded before this sheet existed: Drive › <client> › Ledger › <month> › Ledger_<vendor>_<month>.ext */
  if (p && p.scanDrive !== false && typeof BNXDRV_resolve_ === 'function') {
    try {
      var root = BNXDRV_resolve_(cid, ['Ledger']), mons = root.getFolders(), add = [];
      while (mons.hasNext()) { var mf = mons.next(), mo = mf.getName(); if (!/^\d{4}-\d{2}$/.test(mo)) continue;
        var fs = mf.getFiles(); while (fs.hasNext()) { var f = fs.next(), m = f.getName().match(/^Ledger_(.+)_(\d{4}-\d{2})\.[A-Za-z0-9]+$/); if (!m) continue;
          var k2 = m[1].toUpperCase() + '|' + m[2]; if (seen[k2]) continue; seen[k2] = 1;
          var it = { vendorName: m[1], month: m[2], fileName: f.getName(), driveLink: f.getUrl(), uploadedAt: f.getLastUpdated().toISOString() }; out.push(it); add.push(it); } }
      if (add.length) { var rows = add.map(function (a) { return ['LL' + Date.now() + Math.floor(Math.random() * 1000), cid, a.vendorName, a.month, a.fileName, a.driveLink, (a.driveLink.match(/\/d\/([\w-]{20,})/) || [])[1] || '', 'drive scan', a.uploadedAt]; });
        rows = rows.map(function (r) { return r.concat(['', 'drive scan']); });
        sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows); }
    } catch (e) {}
  }
  return { success: true, data: out, count: out.length };
}

/* ── menu photos from the "Hashtag Menu" sheet ── */
var BNX_IMG = { CID: 'CL00010', SHEET_NAME: 'Hashtag Menu' };
function RUN_IMG_SyncMenuSheet() { Logger.log(JSON.stringify(bnxImgSyncMenuSheet_(BNX_IMG.CID, true), null, 1)); }
function RUN_IMG_Check() { Logger.log(JSON.stringify(bnxImgSyncMenuSheet_(BNX_IMG.CID, false), null, 1)); }
function bnxImgSyncMenuSheet_(cid, apply) {
  var t0 = Date.now(), id = PropertiesService.getScriptProperties().getProperty('HASHTAG_MENU_SHEET_ID') || '';
  if (!id) { var it = DriveApp.getFilesByName(BNX_IMG.SHEET_NAME); while (it.hasNext()) { var f = it.next(); if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { id = f.getId(); break; } } }
  if (!id) return { success: false, error: 'Sheet "' + BNX_IMG.SHEET_NAME + '" not found — set Script property HASHTAG_MENU_SHEET_ID' };
  var ms = SpreadsheetApp.openById(id).getSheets()[0], rng = ms.getDataRange(), v = rng.getValues(), rt = rng.getRichTextValues();
  var hr = v.findIndex(function (r) { return r.some(function (c) { return /^item name$/i.test(String(c).trim()); }); }); if (hr < 0) hr = 0;
  var h = v[hr].map(function (x) { return String(x).trim(); });
  var cL = h.findIndex(function (x) { return /drive/i.test(x); }), cI = h.findIndex(function (x) { return /^master item/i.test(x); }), cN = h.findIndex(function (x) { return /^item name$/i.test(x); });
  if (cL < 0 || cI < 0) return { success: false, error: 'columns "Google Drive Link" / "Master Item ID" not found', headers: h };
  var pic = {}, bad = [];
  for (var r = hr + 1; r < v.length; r++) {
    var iid = String(v[r][cI] || '').trim().toUpperCase(); if (!/^ITM\d+$/.test(iid)) continue;
    var link = String(v[r][cL] || '').trim(); try { link = link || String(rt[r][cL].getLinkUrl() || ''); } catch (e) {}
    var fid = (link.match(/(?:\/d\/|[?&]id=)([\w-]{20,})/) || [])[1]; if (!fid) continue;
    pic[iid] = { fid: fid, url: 'https://lh3.googleusercontent.com/d/' + fid + '=w800', name: cN >= 0 ? String(v[r][cN]) : '' };
  }
  var out = { success: true, apply: apply, photos: Object.keys(pic).length, shared: 0, shareFailed: [], itemMaster: 0, menuCard: 0, manifest: 0, notInItemMaster: [] };
  /* share each photo: a private Drive file never loads in the app */
  Object.keys(pic).forEach(function (k) {
    if (Date.now() - t0 > 240000) return;
    try { var f = DriveApp.getFileById(pic[k].fid);
      if (f.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) { if (apply) f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); out.shared++; } }
    catch (e) { out.shareFailed.push(k + ' ' + pic[k].name); }
  });
  var M = SpreadsheetApp.openById(bnxGetClientDbIds_(cid).MASTER), now = new Date();
  function patch(name, idCol, set) {
    var sh = M.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return 0;
    var d = sh.getDataRange().getValues(), hh = d[0].map(function (x) { return String(x).trim(); }), ci = hh.indexOf(idCol), n = 0, found = {};
    if (ci < 0) return 0;
    for (var i = 1; i < d.length; i++) { var k = String(d[i][ci] || '').trim().toUpperCase(), p = pic[k]; if (!p) continue; found[k] = 1;
      if (set(d[i], hh, p)) n++; }
    if (apply && n) sh.getRange(1, 1, d.length, hh.length).setValues(d);
    return { n: n, found: found };
  }
  function put(row, hh, col, val) { var ch = false; hh.forEach(function (k, j) { if (k === col && row[j] !== val) { row[j] = val; ch = true; } }); return ch; }   /* every copy of a duplicated header */
  var im = patch('ITEM_MASTER', 'ITEM_ID', function (row, hh, p) {
    var c = false; c = put(row, hh, 'IMAGE_URL', p.url) || c; c = put(row, hh, 'ICON_URL', p.url) || c; c = put(row, hh, 'DRIVE_FILE_ID', p.fid) || c;
    if (c) { put(row, hh, 'IMAGE_SOURCE', 'MENU_SHEET'); put(row, hh, 'IMAGE_STATUS', 'READY_DRIVE'); put(row, hh, 'IMAGE_UPDATED_AT', now); } return c; });
  out.itemMaster = im.n || 0; out.notInItemMaster = Object.keys(pic).filter(function (k) { return !(im.found || {})[k]; }).slice(0, 50);
  var mc = patch('MENU_CARD_ITEMS', 'ITEM_ID', function (row, hh, p) { return put(row, hh, 'PRODUCT_IMAGE_URL', p.url); }); out.menuCard = mc.n || 0;
  var mf = patch('ITEM_IMAGE_MANIFEST', 'ITEM_ID', function (row, hh, p) { var c = put(row, hh, 'IMAGE_PATH', p.url); if (c) { put(row, hh, 'IMAGE_SOURCE', 'MENU_SHEET'); put(row, hh, 'IMAGE_STATUS', 'READY_DRIVE'); } return c; });
  var am = patch('ASSET_MANIFEST', 'ASSET_ID', function (row, hh, p) { return String(row[hh.indexOf('ASSET_TYPE')]) === 'ITEM_IMAGE' && put(row, hh, 'ASSET_PATH', p.url); });
  out.manifest = (mf.n || 0) + (am.n || 0);
  if (apply) { try { if (typeof bnxMasterGenBump1109_ === 'function') bnxMasterGenBump1109_(cid); } catch (e) {} try { bnxInvalidateMasterCache_(cid); } catch (e) {} }
  out.ms = Date.now() - t0;
  return out;
}


/* ═══ LEDGER LINKS FROM THE "PRINT" PAYMENT-ADVICE SHEET (2026-11-18) ═══════════════════════════════════════════════
   Copies the "Attach bills & Ledger Oct26" links and the Remarks (Ok Ledger, QUIERY, Single Bill …) of every party in
   the Google sheet "FY 25-27 Hashtag Siliguri" › tab "Print" into CL00010 TRANSACTION_DB › VENDOR_LEDGER_LINKS
   (month 2026-10). Purchase › Payment Advice then shows the ledger + remark for each supplier on every device.
   Party names are matched to SUPPLIER_MASTER (supplier name, or its Tally ALIAS_NAME); "(Bar)" / "(Staff …)" ledgers
   of one supplier go to the same supplier. Several month blocks in the tab are all read (month from the header).
   Run RUN_LEDGER_PrintCheck (reads only), then RUN_LEDGER_PrintImport. Re-running updates, never doubles.
   Other file / tab: Script properties  LEDGER_PRINT_SHEET_ID  /  LEDGER_PRINT_TAB.                                */
var BNX_LP = { CID: 'CL00010', NAME: 'FY 25-27 Hashtag Siliguri', TAB: 'Print' };
function RUN_LEDGER_PrintCheck() { Logger.log(JSON.stringify(bnxLedgerFromPrint_(BNX_LP.CID, false), null, 1)); }
function RUN_LEDGER_PrintImport() { Logger.log(JSON.stringify(bnxLedgerFromPrint_(BNX_LP.CID, true), null, 1)); }
function bnxLpNorm_(x) { return String(x || '').toUpperCase().replace(/\((BAR|STAFF[^)]*|KITCHEN[^)]*)\)/g, '').replace(/\bPRIVATE\b/g, 'PVT').replace(/\bLIMITED\b/g, 'LTD').replace(/[^A-Z0-9]+/g, ''); }
function bnxLpMonth_(txt) {
  var M = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  var m = String(txt || '').toUpperCase().match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s'’.-]*(\d{2,4})\b/);
  if (!m) return ''; var y = +m[2]; if (y < 100) y += 2000; return y + '-' + ('0' + M[m[1]]).slice(-2);
}
function bnxLedgerFromPrint_(cid, apply) {
  var P = PropertiesService.getScriptProperties(), id = P.getProperty('LEDGER_PRINT_SHEET_ID') || '', tab = P.getProperty('LEDGER_PRINT_TAB') || BNX_LP.TAB;
  if (!id) { var it = DriveApp.getFilesByName(BNX_LP.NAME); while (it.hasNext()) { var f = it.next(); if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { id = f.getId(); break; } } }
  if (!id) return { success: false, error: 'Sheet "' + BNX_LP.NAME + '" not found / not shared with this account — set Script property LEDGER_PRINT_SHEET_ID' };
  var sh = SpreadsheetApp.openById(id).getSheetByName(tab); if (!sh) return { success: false, error: 'tab "' + tab + '" not found' };
  var rg = sh.getDataRange(), v = rg.getDisplayValues(), rt = rg.getRichTextValues(), fm = rg.getFormulas();
  /* supplier names: DB name + Tally alias */
  var sup = {};
  try { var sm = SpreadsheetApp.openById(bnxGetClientDbIds_(cid).MASTER).getSheetByName('SUPPLIER_MASTER').getDataRange().getValues(), h = sm[0].map(String);
    var cN = h.indexOf('SUPPLIER_NAME'), cA = h.indexOf('ALIAS_NAME');
    for (var i = 1; i < sm.length; i++) { var nm = String(sm[i][cN] || '').trim(); if (!nm) continue; sup[bnxLpNorm_(nm)] = nm; if (cA >= 0 && sm[i][cA]) sup[bnxLpNorm_(sm[i][cA])] = nm; } } catch (e) {}
  var linkOf = function (r, c) {
    try { var x = rt[r][c]; if (x) { var u = x.getLinkUrl(); if (u) return u; var runs = x.getRuns(); for (var k = 0; k < runs.length; k++) if (runs[k].getLinkUrl()) return runs[k].getLinkUrl(); } } catch (e) {}
    var m = String(fm[r][c] || '').match(/HYPERLINK\(\s*"([^"]+)"/i); return m ? m[1] : '';
  };
  var rows = [], unmatched = [], noLink = [], blocks = [];
  for (var r = 0; r < v.length; r++) {
    var pc = v[r].findIndex(function (x) { return /^party name$/i.test(String(x).trim()); }); if (pc < 0) continue;
    var ac = v[r].findIndex(function (x) { return /attach/i.test(String(x)); }), rc = v[r].findIndex(function (x) { return /^remarks?$/i.test(String(x).trim()); });
    var mo = bnxLpMonth_(ac >= 0 ? v[r][ac] : '') || bnxLpMonth_(v[r].join(' ')); blocks.push({ row: r + 1, month: mo });
    if (!mo || ac < 0) continue;
    for (var q = r + 1; q < v.length; q++) {
      var party = String(v[q][pc] || '').trim(); if (!party) { if (String(v[q].join('')).trim() === '') break; continue; }
      if (/^party name$/i.test(party) || /^total/i.test(party)) break;
      var url = linkOf(q, ac), rem = rc >= 0 ? String(v[q][rc] || '').trim() : '', db = sup[bnxLpNorm_(party)] || '';
      if (!db) unmatched.push(party);
      if (!url) noLink.push(party);
      if (!url && !rem) continue;
      rows.push({ party: party, vendor: db || party, month: mo, url: url, remark: rem, label: String(v[q][ac] || '') });
    }
  }
  var out = { success: true, apply: apply, sheet: id, blocks: blocks, rows: rows.length, withLink: rows.filter(function (x) { return x.url; }).length,
    unmatchedNames: unmatched, withoutLink: noLink, sample: rows.slice(0, 5) };
  if (!apply || !rows.length) return out;
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var ls = bnxLedgerSheet_(cid), lv = ls.getDataRange().getValues(), idx = {}, now = new Date().toISOString(), add = 0, upd = 0;
    for (var a = 1; a < lv.length; a++) idx[bnxLpNorm_(lv[a][2]) + '|' + lv[a][3]] = a;
    rows.forEach(function (x) {
      var k = bnxLpNorm_(x.vendor) + '|' + x.month, fid = (x.url.match(/\/d\/([\w-]{20,})|[?&]id=([\w-]{20,})/) || []).slice(1).filter(String)[0] || '';
      var row = ['LL' + Date.now() + Math.floor(Math.random() * 1000), cid, x.vendor, x.month, x.label || 'Ledger', x.url, fid, 'Print sheet', now, x.remark, 'Print sheet ' + BNX_LP.NAME];
      if (idx[k] !== undefined) { var o = lv[idx[k]]; row[0] = o[0] || row[0]; if (!x.url) { row[5] = o[5]; row[6] = o[6]; row[4] = o[4]; } lv[idx[k]] = row; upd++; }
      else { idx[k] = lv.length; lv.push(row); add++; }
    });
    var w = BNX_LL_HEAD.length; lv = lv.map(function (r0) { r0 = r0.slice(0, w); while (r0.length < w) r0.push(''); return r0; });
    ls.getRange(1, 1, lv.length, w).setValues(lv);
    out.added = add; out.updated = upd;
  } finally { lock.releaseLock(); }
  return out;
}


/* ═══ ROLE ACCESS (Settings › Role Access) — saved for the whole client (2026-11-19, "not update") ═══════════════════════
   The dashboard saved the page list on that PC and sent SAVE_ROLE_ACCESS / read GET_ROLE_ACCESS, but neither existed on the
   server → "server save failed" and every other PC / phone kept the old access. Now: MASTER DB › ROLE_ACCESS
   (ROLE · PAGES_JSON · UPDATED_AT · UPDATED_BY), one row per restricted role; a role without a row = full access.
   Save: SUPER_ADMIN · DEVELOPER · OWNER · ADMIN · MD · CEO. Read: every logged-in user of the client (it decides their menu). */
var BNX_RA_HEAD = ['ROLE', 'PAGES_JSON', 'UPDATED_AT', 'UPDATED_BY'];
function bnxRoleAccessSheet_(cid, create) {
  var ss = SpreadsheetApp.openById(bnxGetClientDbIds_(cid).MASTER), sh = ss.getSheetByName('ROLE_ACCESS');
  if (!sh && create) { sh = ss.insertSheet('ROLE_ACCESS'); sh.getRange(1, 1, 1, BNX_RA_HEAD.length).setValues([BNX_RA_HEAD]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function bnxRoleAccessGet_(session, p) {
  var cid = String(session && session.CLIENT_ID || '').trim(); if (!cid) return { success: false, error: 'No client' };
  var c = CacheService.getScriptCache(), k = 'roleacc_' + cid, hit = c.get(k);
  if (hit) { try { return { success: true, data: JSON.parse(hit) }; } catch (e) {} }
  var map = {}, at = '', sh = bnxRoleAccessSheet_(cid, false);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().forEach(function (r) {
      var role = String(r[0] || '').trim(); if (!role) return;
      try { var v = JSON.parse(String(r[1] || '[]')); if (Array.isArray(v)) map[role] = v.map(String); } catch (e) {}
      var u = r[2] instanceof Date ? r[2].toISOString() : String(r[2] || ''); if (u > at) at = u;
    });
  }
  var data = { map: sh ? map : null, updatedAt: at };   /* map null = never saved → the dashboard keeps its built-in defaults */
  try { c.put(k, JSON.stringify(data), 600); } catch (e) {}
  return { success: true, data: data };
}
function bnxRoleAccessSave_(session, p) {
  var role = String(session && (session.ROLE || session.role) || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (['SUPER_ADMIN', 'DEVELOPER', 'OWNER', 'ADMIN', 'MD', 'CEO'].indexOf(role) < 0) return { success: false, error: 'Only owner / admin can change role access' };
  var cid = String(session.CLIENT_ID || '').trim(), map = p && p.map;
  if (!cid || !map || typeof map !== 'object' || Array.isArray(map)) return { success: false, error: 'map required' };
  var rows = [], now = new Date(), by = String(session.USER_ID || session.LOGIN_ID || session.NAME || '');
  Object.keys(map).slice(0, 80).forEach(function (r) {
    var v = map[r]; if (!Array.isArray(v)) return;
    var pages = v.map(function (x) { return String(x).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40); }).filter(String).slice(0, 200);
    rows.push([String(r).toUpperCase().slice(0, 40), JSON.stringify(pages), now, by]);
  });
  var lock = LockService.getScriptLock(); try { lock.waitLock(15000); } catch (e) {}
  try {
    var sh = bnxRoleAccessSheet_(cid, true);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, BNX_RA_HEAD.length).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, BNX_RA_HEAD.length).setValues(rows);
  } finally { try { lock.releaseLock(); } catch (e) {} }
  try { CacheService.getScriptCache().remove('roleacc_' + cid); } catch (e) {}
  return { success: true, message: 'Role access saved for ' + cid + ' (' + rows.length + ' restricted roles)', data: { roles: rows.length } };
}

/* restaurant UPI (the one on the bill QR): MASTER › CLIENT_ASSETS row KEY=UPI, META {"vpa","pn"} */
function bnxRestaurantUpi_(cid) {
  try {
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(cid)) return {};
    var sh = SpreadsheetApp.openById(bnxGetClientDbIds_(cid).MASTER).getSheetByName('CLIENT_ASSETS'); if (!sh) return {};
    var v = sh.getDataRange().getValues(), h = v[0].map(String), ck = h.indexOf('KEY'), cm = h.indexOf('META'), cc = h.indexOf('CLIENT_ID');
    for (var i = v.length - 1; i > 0; i--) {
      if (String(v[i][ck]) !== 'UPI' || (cc >= 0 && v[i][cc] && String(v[i][cc]) !== cid)) continue;
      var m = JSON.parse(String(v[i][cm] || '{}')); if (m && m.vpa && m.enabled !== false) return { vpa: String(m.vpa), pn: String(m.pn || '') };
    }
  } catch (e) {}
  return {};
}

/* ═══ CL00011 (HASHTAG KOLKATA): BILL LINKS + ALL MONTH LEDGERS FROM ITS GOOGLE SHEETS (2026-11-18) ═══════════════════
   1. Bills: "Data Entry Purchase-Kolkata" › Purchase_FY2627 (Suppliers Name · Bill No · Bill Amount · Items Head ·
      Purchase Date · Attached link) → CL00011 TRANSACTION_DB › PURCHASE_BILL_LINKS (same layout as CL00010) and, when a
      purchase of the same supplier + amount (±₹1) + date (±7 days) — or the same bill no. — exists in PURCHASE_INVOICE,
      its PURCHASE_HEAD / BILL_NO / BILL_FILE_URL. Rows with no matching purchase are still kept ("Not matched yet").
   2. Ledgers: "FY 25-27 Hashtag Kolkata" › Cr FY26-27 (one row per supplier; "Ledger May / June / … / Oct" blocks with
      "Ledger Attached" + "Remarks") → CL00011 TRANSACTION_DB › VENDOR_LEDGER_LINKS, every month (FY 2026-27).
   Purchase › Payment Advice / purchase list of CL00011 then show the bills and ledgers.
   Run RUN_CL11_1_Check (reads only) → RUN_CL11_2_Import. Re-running updates, never doubles.
   Other file / tab names: Script properties CL11_BILL_SHEET_ID / CL11_BILL_TAB / CL11_LEDGER_SHEET_ID / CL11_LEDGER_TAB. */
var BNX_CL11 = { CID: 'CL00011', BILL_NAME: 'Data Entry Purchase-Kolkata', BILL_TAB: 'Purchase_FY2627', LED_NAME: 'FY 25-27 Hashtag Kolkata', LED_TAB: 'Cr FY26-27' };
function RUN_CL11_1_Check() { Logger.log(JSON.stringify({ bills: bnxCl11Bills_(false), ledgers: bnxCl11Ledgers_(false) }, null, 1)); }
function RUN_CL11_2_Import() { Logger.log(JSON.stringify({ bills: bnxCl11Bills_(true), ledgers: bnxCl11Ledgers_(true) }, null, 1)); }

function bnxSheetByNameOrProp_(prop, name, tab, tabProp) {
  var P = PropertiesService.getScriptProperties(), id = P.getProperty(prop) || '';
  if (!id) { var it = DriveApp.getFilesByName(name); while (it.hasNext()) { var f = it.next(); if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { id = f.getId(); break; } } }
  if (!id) throw new Error('Sheet "' + name + '" not found / not shared with this account — set Script property ' + prop);
  var t = P.getProperty(tabProp) || tab, sh = SpreadsheetApp.openById(id).getSheetByName(t);
  if (!sh) throw new Error('tab "' + t + '" not found in "' + name + '"');
  return sh;
}
function bnxCellLink_(rt, fm, r, c) {
  try { var x = rt[r][c]; if (x) { var u = x.getLinkUrl(); if (u) return u; var runs = x.getRuns(); for (var k = 0; k < runs.length; k++) if (runs[k].getLinkUrl()) return runs[k].getLinkUrl(); } } catch (e) {}
  var m = String((fm[r] || [])[c] || '').match(/HYPERLINK\(\s*"([^"]+)"/i); return m ? m[1] : '';
}
function bnxSupNameMap_(cid) {
  var sup = {};
  try { var sm = SpreadsheetApp.openById(bnxGetClientDbIds_(cid).MASTER).getSheetByName('SUPPLIER_MASTER').getDataRange().getValues(), h = sm[0].map(String);
    var cN = h.indexOf('SUPPLIER_NAME'), cA = h.indexOf('ALIAS_NAME'), cI = h.indexOf('SUPPLIER_ID');
    for (var i = 1; i < sm.length; i++) { var nm = String(sm[i][cN] || '').trim(); if (!nm) continue; var o = { name: nm, id: String(sm[i][cI] || '') };
      sup[bnxLpNorm_(nm)] = o; if (cA >= 0 && sm[i][cA]) sup[bnxLpNorm_(sm[i][cA])] = o; } } catch (e) {}
  return sup;
}
function bnxD_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, 'Asia/Kolkata', 'yyyy-MM-dd');
  var t = String(v || '').trim(), m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  var n = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); return n ? n[3] + '-' + ('0' + n[2]).slice(-2) + '-' + ('0' + n[1]).slice(-2) : '';
}

function bnxCl11Bills_(apply) {
  var cid = BNX_CL11.CID, out = { success: true, apply: apply };
  try {
    var sh = bnxSheetByNameOrProp_('CL11_BILL_SHEET_ID', BNX_CL11.BILL_NAME, BNX_CL11.BILL_TAB, 'CL11_BILL_TAB');
    var rg = sh.getDataRange(), v = rg.getValues(), dv = rg.getDisplayValues(), rt = rg.getRichTextValues(), fm = rg.getFormulas();
    var hr = dv.findIndex(function (r) { return r.some(function (x) { return /suppliers?\s*name/i.test(x); }); }); if (hr < 0) throw new Error('header "Suppliers Name" not found');
    var H = dv[hr].map(function (x) { return String(x).replace(/\s+/g, ' ').trim(); }), col = function (re) { return H.findIndex(function (x) { return re.test(x); }); };
    var cS = col(/suppliers?\s*name/i), cB = col(/^bill no/i), cA = col(/^bill amou?n?t/i), cH = col(/items? head|head/i), cD = col(/purchase date|^date/i), cL = col(/attach/i);
    if (cL < 0) cL = col(/link|bill file/i);
    var sup = bnxSupNameMap_(cid), rows = [];
    for (var r = hr + 1; r < v.length; r++) {
      var s = String(dv[r][cS] || '').trim(); if (!s) continue;
      var url = bnxCellLink_(rt, fm, r, cL); if (!url) continue;
      var amt = Number(String(v[r][cA]).toString().replace(/[(),₹\s]/g, '')) || 0; if (/^\(/.test(String(dv[r][cA]).trim())) amt = -Math.abs(amt);
      var sp = sup[bnxLpNorm_(s)] || { name: s, id: '' };
      rows.push({ supplier: sp.name, supId: sp.id, sheetName: s, billNo: String(dv[r][cB] || '').trim(), amount: amt, head: cH >= 0 ? String(dv[r][cH] || '').trim() : '', date: bnxD_(v[r][cD]), url: url });
    }
    out.linksInSheet = rows.length;
    /* match to PURCHASE_INVOICE of CL00011 */
    var tx = SpreadsheetApp.openById(bnxGetClientDbIds_(cid).TRANSACTION), pi = tx.getSheetByName('PURCHASE_INVOICE'), inv = [];
    var pv = pi && pi.getLastRow() > 1 ? pi.getDataRange().getValues() : [[]], ph = pv[0].map(String), P = function (k) { return ph.indexOf(k); };
    for (var i = 1; i < pv.length; i++) inv.push({ i: i, id: String(pv[i][P('PURCHASE_INVOICE_ID')] || ''), no: String(pv[i][P('INVOICE_NO')] || ''), sup: bnxLpNorm_(pv[i][P('SUPPLIER_NAME')]),
      supId: String(pv[i][P('SUPPLIER_ID')] || ''), amt: Number(pv[i][P('TOTAL_AMOUNT')]) || 0, date: bnxD_(pv[i][P('INVOICE_DATE')]), billNo: P('BILL_NO') >= 0 ? String(pv[i][P('BILL_NO')] || '') : '' });
    var used = {}, dd = function (a, b) { return a && b ? Math.abs((new Date(a) - new Date(b)) / 864e5) : 99; };
    rows.forEach(function (x) {
      var nk = bnxLpNorm_(x.supplier), bn = bnxLpNorm_(x.billNo), hit = null;
      if (bn) hit = inv.filter(function (p) { return !used[p.i] && p.billNo && bnxLpNorm_(p.billNo) === bn && (p.sup === nk || (x.supId && p.supId === x.supId)); })[0];
      if (!hit) hit = inv.filter(function (p) { return !used[p.i] && (p.sup === nk || (x.supId && p.supId === x.supId)) && Math.abs(p.amt - x.amount) <= 1 && dd(p.date, x.date) <= 7; })
        .sort(function (a, b) { return dd(a.date, x.date) - dd(b.date, x.date); })[0];
      if (hit) { used[hit.i] = 1; x.inv = hit; x.match = hit.billNo && bnxLpNorm_(hit.billNo) === bn ? 'Same bill no.' : 'Supplier + amount + date'; } else x.match = 'Not matched yet';
    });
    out.matched = rows.filter(function (x) { return x.inv; }).length; out.notMatched = rows.length - out.matched;
    out.purchasesInDb = inv.length; out.sample = rows.slice(0, 5).map(function (x) { return [x.date, x.supplier, x.billNo, x.amount, x.match].join(' · '); });
    if (!apply || !rows.length) return out;
    var lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      var BH = ['BILL_LINK_ID', 'CLIENT_ID', 'PURCHASE_INVOICE_ID', 'INVOICE_NO', 'SUPPLIER_NAME', 'BILL_NO', 'BILL_DATE', 'BILL_AMOUNT', 'PURCHASE_HEAD', 'BILL_FILE_URL', 'MATCH_TYPE', 'SOURCE', 'CREATED_AT'];
      var bl = tx.getSheetByName('PURCHASE_BILL_LINKS'); if (!bl) { bl = tx.insertSheet('PURCHASE_BILL_LINKS'); bl.getRange(1, 1, 1, BH.length).setValues([BH]).setFontWeight('bold'); bl.setFrozenRows(1); }
      var bv = bl.getDataRange().getValues(), bh = bv[0].map(String), have = {}, n = bv.length, add = [], now = new Date().toISOString();
      for (var j = 1; j < bv.length; j++) have[String(bv[j][bh.indexOf('BILL_FILE_URL')])] = 1;
      rows.forEach(function (x) { if (have[x.url]) return; have[x.url] = 1;
        var o = { BILL_LINK_ID: 'BL' + ('0000' + (n + add.length)).slice(-5), CLIENT_ID: cid, PURCHASE_INVOICE_ID: x.inv ? x.inv.id : '', INVOICE_NO: x.inv ? x.inv.no : '', SUPPLIER_NAME: x.supplier,
          BILL_NO: x.billNo, BILL_DATE: x.date, BILL_AMOUNT: x.amount, PURCHASE_HEAD: x.head, BILL_FILE_URL: x.url, MATCH_TYPE: x.match, SOURCE: BNX_CL11.BILL_NAME + ' › ' + sh.getName(), CREATED_AT: now };
        add.push(bh.map(function (k) { return o[k] === undefined ? '' : o[k]; })); });
      if (add.length) bl.getRange(bl.getLastRow() + 1, 1, add.length, bh.length).setValues(add);
      out.linksAdded = add.length;
      /* purchase rows: head / bill no / bill file */
      if (pi && inv.length) {
        ['PURCHASE_HEAD', 'BILL_NO', 'BILL_FILE_URL'].forEach(function (k) { if (ph.indexOf(k) < 0) { pi.getRange(1, ph.length + 1).setValue(k).setFontWeight('bold'); ph.push(k); pv.forEach(function (r0, ri) { if (ri) r0.push(''); }); } });
        var upd = 0;
        rows.forEach(function (x) { if (!x.inv) return; var r0 = pv[x.inv.i], c1 = ph.indexOf('PURCHASE_HEAD'), c2 = ph.indexOf('BILL_NO'), c3 = ph.indexOf('BILL_FILE_URL');
          if (!r0[c1] && x.head) { r0[c1] = x.head; upd++; } if (!r0[c2] && x.billNo) r0[c2] = x.billNo; if (!r0[c3]) r0[c3] = x.url; });
        ['PURCHASE_HEAD', 'BILL_NO', 'BILL_FILE_URL'].forEach(function (k) { var c = ph.indexOf(k); pi.getRange(2, c + 1, pv.length - 1, 1).setValues(pv.slice(1).map(function (r0) { return [r0[c] === undefined ? '' : r0[c]]; })); });
        out.purchasesUpdated = upd;
      }
    } finally { lock.releaseLock(); }
  } catch (e) { out = { success: false, error: String(e && e.message || e) }; }
  return out;
}

function bnxCl11Ledgers_(apply) {
  var cid = BNX_CL11.CID, out = { success: true, apply: apply };
  try {
    var sh = bnxSheetByNameOrProp_('CL11_LEDGER_SHEET_ID', BNX_CL11.LED_NAME, BNX_CL11.LED_TAB, 'CL11_LEDGER_TAB');
    var rg = sh.getDataRange(), dv = rg.getDisplayValues(), rt = rg.getRichTextValues(), fm = rg.getFormulas();
    /* FY start year from the sheet ("FY2026-27") or tab name ("FY26-27") */
    var fyTxt = (dv.slice(0, 6).map(function (r) { return r.join(' '); }).join(' ') + ' ' + sh.getName()).match(/FY\s*(?:20)?(\d{2})\s*-\s*(\d{2})/i);
    var fy = fyTxt ? 2000 + Number(fyTxt[1]) : 2026;
    var sr = dv.findIndex(function (r) { return r.some(function (x) { return /ledger attached/i.test(x); }); }); if (sr < 0) throw new Error('"Ledger Attached" header not found');
    var mr = sr - 1, cName = dv.slice(Math.max(0, sr - 2), sr + 1).reduce(function (a, r) { if (a >= 0) return a; return r.findIndex(function (x) { return /suppliers?\s*name/i.test(x); }); }, -1); if (cName < 0) cName = 0;
    var MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 }, blocks = [], lastMon = '';
    for (var c = 0; c < dv[sr].length; c++) {
      var mt = String(dv[mr][c] || '').toUpperCase().match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/); if (mt) lastMon = mt[1];
      if (!/ledger attached/i.test(dv[sr][c]) || !lastMon) continue;
      var m = MON[lastMon], y = m >= 4 ? fy : fy + 1, rc = -1;
      for (var k = c + 1; k < Math.min(c + 4, dv[sr].length); k++) if (/remark/i.test(dv[sr][k])) { rc = k; break; }
      blocks.push({ col: c, rem: rc, month: y + '-' + ('0' + m).slice(-2) });
    }
    var sup = bnxSupNameMap_(cid), rows = [];
    for (var r = sr + 1; r < dv.length; r++) {
      var party = String(dv[r][cName] || '').trim(); if (!party || /^supplier$/i.test(party)) continue;
      var vend = (sup[bnxLpNorm_(party)] || {}).name || party;
      blocks.forEach(function (b) { var url = bnxCellLink_(rt, fm, r, b.col), rem = b.rem >= 0 ? String(dv[r][b.rem] || '').trim() : '', lab = String(dv[r][b.col] || '').trim();
        if (!url && !rem) return; rows.push({ party: party, vendor: vend, month: b.month, url: url, remark: rem, label: lab || 'Ledger' }); });
    }
    out.months = blocks.map(function (b) { return b.month; }); out.rows = rows.length; out.withLink = rows.filter(function (x) { return x.url; }).length;
    out.suppliers = rows.map(function (x) { return x.party; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).length; out.sample = rows.slice(0, 5);
    if (!apply || !rows.length) return out;
    var lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      var ls = bnxLedgerSheet_(cid), lv = ls.getDataRange().getValues(), idx = {}, now = new Date().toISOString(), add = 0, upd = 0;
      for (var a = 1; a < lv.length; a++) idx[bnxLpNorm_(lv[a][2]) + '|' + lv[a][3]] = a;
      rows.forEach(function (x) {
        var key = bnxLpNorm_(x.vendor) + '|' + x.month, fid = (x.url.match(/\/d\/([\w-]{20,})|[?&]id=([\w-]{20,})/) || []).slice(1).filter(String)[0] || '';
        var row = ['LL' + Date.now() + Math.floor(Math.random() * 1000), cid, x.vendor, x.month, x.label, x.url, fid, 'Cr sheet', now, x.remark, BNX_CL11.LED_NAME + ' › ' + sh.getName()];
        if (idx[key] !== undefined) { var o = lv[idx[key]]; row[0] = o[0] || row[0]; if (!x.url) { row[5] = o[5]; row[6] = o[6]; row[4] = o[4]; } lv[idx[key]] = row; upd++; }
        else { idx[key] = lv.length; lv.push(row); add++; }
      });
      var w = BNX_LL_HEAD.length; lv = lv.map(function (r0) { r0 = r0.slice(0, w); while (r0.length < w) r0.push(''); return r0; });
      ls.getRange(1, 1, lv.length, w).setValues(lv); out.added = add; out.updated = upd;
    } finally { lock.releaseLock(); }
  } catch (e) { out = { success: false, error: String(e && e.message || e) }; }
  return out;
}


/* ═══ SUPER-ADMIN TOOLS (2026-11-18) — Client Master, New Client, User Control ════════════════════════════════════
   These pages called actions the server did not have, so they showed demo data / "Offline" / "check response".
   Only SUPER_ADMIN or DEVELOPER may use them. Clients: CLIENT_MASTER + CLIENT_DATABASE_REGISTRY. Users and logins:
   USER_MASTER (USER_SECURITY_MASTER_DB). Passwords, PINs, OTPs and session tokens are NEVER sent to the browser.
   "Delete" never removes data: a client / user is set INACTIVE / DELETED and its logins are closed. */
function bnxAdm_(session, fn) {
  var role = String(session && session.ROLE || '').toUpperCase(), ok = role === 'SUPER_ADMIN' || role === 'DEVELOPER';
  /* platform owners whose ERP role is ADMIN: Script property BNX_SUPER_ADMINS = USER_IDs, comma separated (e.g. CL00010-U3) */
  if (!ok) { try { var L = String(PropertiesService.getScriptProperties().getProperty('BNX_SUPER_ADMINS') || '').split(/[\s,]+/).filter(String);
    ok = L.indexOf(String(session.USER_ID || '')) >= 0 || L.indexOf(String(session.AUTH_CLIENT_ID || session.CLIENT_ID || '') + ':' + String(session.USER_ID || '')) >= 0; } catch (e) {} }
  if (!ok) return { success: false, error: 'Super Admin only — your role is ' + role + '. Set ROLE = SUPER_ADMIN for your user in USER_MASTER, or add your USER_ID to Script property BNX_SUPER_ADMINS.' };
  var r = fn(); if (r && r.success !== false) { r.status = r.status || 'ok'; if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) r.data.status = r.data.status || 'ok'; }
  return r;
}
function bnxAdmSheet_(name) { var sh = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID).getSheetByName(name); if (!sh) throw new Error(name + ' not found in USER_SECURITY_MASTER_DB'); return sh; }
function bnxAdmTable_(sh) { var v = sh.getDataRange().getValues(), h = (v[0] || []).map(function (x) { return String(x || '').trim().toUpperCase(); }); return { sh: sh, v: v, h: h, c: function () { for (var i = 0; i < arguments.length; i++) { var k = h.indexOf(arguments[i]); if (k >= 0) return k; } return -1; } }; }
var BNX_ADM_SECRET = /PASS|PIN|HASH|SALT|SESSION|TOKEN|OTP|SECRET|API_KEY/i;

/* ── clients ── */
function bnxAdmClients_(session, p) {
  var cm = bnxAdmTable_(SpreadsheetApp.openById(CLIENT_MASTER_DB_ID).getSheetByName('CLIENT_MASTER') || bnxAdmSheet_('USER_SECURITY_MASTER_DB')), by = {};
  for (var r = 1; r < cm.v.length; r++) { var id = String(cm.v[r][cm.c('CLIENT_ID')] || '').trim(); if (!id) continue; var o = {}; cm.h.forEach(function (k, i) { if (k && !BNX_ADM_SECRET.test(k)) o[k] = cm.v[r][i]; }); by[id] = o; }
  var rg = bnxAdmTable_(bnxControlSheet_(CLIENT_DB_REGISTRY_TAB)), reg = {};
  for (var q = 1; q < rg.v.length; q++) { var id2 = String(rg.v[q][rg.c('CLIENT_ID')] || '').trim(); if (!id2) continue; var o2 = {}; rg.h.forEach(function (k, i) { if (k) o2[k] = rg.v[q][i]; }); reg[id2] = o2; }
  var ids = Object.keys(by).concat(Object.keys(reg)).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
  var d = function (v) { return v instanceof Date ? v.toISOString() : String(v == null ? '' : v); };
  var clients = ids.map(function (id) { var a = by[id] || {}, g = reg[id] || {};
    return { CLIENT_ID: id, CONTACT_NAME: d(a.CONTACT_NAME || a.OWNER_NAME || a.ADMIN_NAME || a.NAME || ''), COMPANY_NAME: d(a.COMPANY_NAME || g.COMPANY_NAME || a.NAME || id),
      PHONE: d(a.PHONE || a.MOBILE_NO || a.MOBILE || ''), EMAIL: d(a.EMAIL || ''), INDUSTRY: d(g.BUSINESS_TYPE || a.BUSINESS_TYPE || a.INDUSTRY || g.INDUSTRY || ''),
      PLAN: d(g.PLAN || a.PLAN || ''), CITY: d(a.CITY || g.LOCATION || ''), STATE: d(a.STATE || ''), ADDRESS: d(a.ADDRESS || ''), GST_NO: d(a.GSTIN || a.GST_NO || ''),
      ERP_URL: d(a.ERP_URL || ''), STATUS: d(g.STATUS || a.STATUS || 'ACTIVE').toUpperCase(), REGISTERED_AT: d(a.CREATED_AT || a.CREATED_ON || g.CREATED_ON || ''),
      DB_READY: !!(g.MASTER_DB_ID && g.TRANSACTION_DB_ID), MASTER_DB_ID: d(g.MASTER_DB_ID || ''), TRANSACTION_DB_ID: d(g.TRANSACTION_DB_ID || ''), REPORT_DB_ID: d(g.REPORT_DB_ID || '') }; });
  return { success: true, clients: clients, data: clients.map(function (c) { return { clientId: c.CLIENT_ID, name: c.COMPANY_NAME, industry: c.INDUSTRY, plan: c.PLAN, license: c.STATUS, ready: c.DB_READY }; }), count: clients.length };
}
function bnxAdmClientStatus_(session, p) {
  var id = String(p.clientId || p.CLIENT_ID || '').trim(), st = String(p.status || 'INACTIVE').toUpperCase();
  if (!/^CL\d{5,}$/.test(id)) return { success: false, error: 'clientId required' };
  if (id === String(session.AUTH_CLIENT_ID || '')) return { success: false, error: 'You cannot deactivate your own client' };
  var n = 0;
  [SpreadsheetApp.openById(CLIENT_MASTER_DB_ID).getSheetByName('CLIENT_MASTER'), bnxControlSheet_(CLIENT_DB_REGISTRY_TAB)].forEach(function (sh) {
    if (!sh) return; var t = bnxAdmTable_(sh), ci = t.c('CLIENT_ID'), cs = t.c('STATUS'); if (ci < 0 || cs < 0) return;
    for (var r = 1; r < t.v.length; r++) if (String(t.v[r][ci]).trim() === id) { sh.getRange(r + 1, cs + 1).setValue(st); n++; }
  });
  try { CacheService.getScriptCache().remove('clientdbids_v5_' + id); } catch (e) {}
  return { success: n > 0, error: n ? '' : 'client not found', message: id + ' set to ' + st + ' — its databases are kept (nothing deleted).' };
}
function bnxAdmTemplate_(industry) { return /REST|PUB|CAFE|BAR|HOTEL|KITCHEN|FOOD|^$/i.test(String(industry || '')) ? 'CL00010' : ''; }
function bnxAdmDbHealth_(p, apply) {
  var id = String(p.clientId || '').trim(), c = (bnxAdmClients_({}, {}).clients || []).filter(function (x) { return x.CLIENT_ID === id; })[0];
  if (!c) return { success: false, error: 'client ' + id + ' not found' };
  var tpl = bnxAdmTemplate_(c.INDUSTRY); if (!tpl || tpl === id) return { success: true, industry: c.INDUSTRY, templateSheets: 0, clientSheets: 0, missingCount: 0, healthScore: 100, missingSheeets: [], needsMigration: false, addedCount: 0, headersFixed: [], note: tpl === id ? 'this is the template client' : 'no template for this industry yet' };
  if (typeof bnxDbhCloneTo_ !== 'function') return { success: false, error: 'add DB_Health_CL00010_CL00011.gs to the project' };
  var L = [], r = bnxDbhCloneTo_(tpl, id, apply, L);
  if (r.error) return { success: false, error: r.error };
  var miss = apply ? [] : r.missing;
  return { success: true, industry: c.INDUSTRY, template: tpl, templateSheets: r.tabs, clientSheets: r.clientTabs, missingCount: r.missing.length, missingSheeets: miss, missingSheets: miss,
    healthScore: r.tabs ? Math.round((r.tabs - r.missing.length) / r.tabs * 100) : 100, needsMigration: !apply && (r.missing.length > 0 || r.cols > 0),
    addedCount: apply ? r.made : 0, headersFixed: apply && r.cols ? ['+' + r.cols + ' column(s)'] : [], log: L.slice(0, 60) };
}
function bnxAdmUpgradeAll_(p) {
  var dry = p.dryRun !== false, max = Math.min(Number(p.maxClients) || 50, 100), t0 = Date.now(), res = [], S = { total: 0, upgraded: 0, alreadyUpToDate: 0, skipped: 0, errors: 0 };
  bnxAdmClients_({}, {}).clients.filter(function (c) { return /ACTIVE|YES/.test(c.STATUS); }).slice(0, max).forEach(function (c) {
    S.total++;
    if (Date.now() - t0 > 300000) { res.push({ clientId: c.CLIENT_ID, status: 'NOT_REACHED' }); S.skipped++; return; }
    if (!c.DB_READY || !bnxAdmTemplate_(c.INDUSTRY) || c.CLIENT_ID === 'CL00010') { res.push({ clientId: c.CLIENT_ID, status: 'SKIPPED' }); S.skipped++; return; }
    try { var h = bnxAdmDbHealth_({ clientId: c.CLIENT_ID }, !dry);
      if (!h.success) { res.push({ clientId: c.CLIENT_ID, status: 'ERROR', error: h.error }); S.errors++; return; }
      var need = dry ? h.needsMigration : (h.addedCount > 0 || h.headersFixed.length > 0);
      res.push({ clientId: c.CLIENT_ID, status: need ? (dry ? 'WOULD_UPGRADE' : 'UPGRADED') : 'UP_TO_DATE', addedCount: dry ? h.missingCount : h.addedCount });
      if (need) S.upgraded++; else S.alreadyUpToDate++;
    } catch (e) { res.push({ clientId: c.CLIENT_ID, status: 'ERROR', error: e.message }); S.errors++; }
  });
  return { success: true, dryRun: dry, summary: S, results: res, message: (dry ? 'Check only — nothing changed. ' : 'Missing tabs / columns added from the template. ') + S.upgraded + ' client(s) ' + (dry ? 'need an upgrade' : 'upgraded') + '.' };
}

/* ── users ── */
function bnxAdmUsers_(p) {
  var t = bnxAdmTable_(bnxAdmSheet_('USER_MASTER')), cs = t.c('SESSION', 'SESSION_TOKEN', 'ERP_SESSION'), users = [];
  for (var r = 1; r < t.v.length; r++) {
    if (!String(t.v[r][t.c('CLIENT_ID')] || '').trim() && !String(t.v[r][t.c('USER_ID', 'EMP_ID')] || '').trim()) continue;
    var o = {}; t.h.forEach(function (k, i) { if (k && !BNX_ADM_SECRET.test(k)) { var x = t.v[r][i]; o[k] = x instanceof Date ? x.toISOString() : x; } });
    o.USER_ID = String(o.USER_ID || o.EMP_ID || ''); o.USER_CODE = String(o.USER_CODE || o.USERNAME || ''); o.FULL_NAME = String(o.FULL_NAME || o.NAME || '');
    o.PHONE = String(o.PHONE || o.MOBILE_NO || ''); o.STATUS = String(o.STATUS || (o.IS_ACTIVE === false ? 'INACTIVE' : 'ACTIVE')).toUpperCase(); o.LOGGED_IN = cs >= 0 && !!String(t.v[r][cs] || '').trim();
    users.push(o);
  }
  return { success: true, data: { users: users }, count: users.length };
}
function bnxAdmFindUser_(t, uid, cid) {
  var cu = t.c('USER_ID', 'EMP_ID'), cc = t.c('CLIENT_ID'), out = [];
  for (var r = 1; r < t.v.length; r++) if (String(t.v[r][cu]).trim() === String(uid).trim() && (!cid || String(t.v[r][cc]).trim() === String(cid).trim())) out.push(r);
  return out;
}
function bnxAdmCloseLogin_(t, r) {
  var cs = t.c('SESSION', 'SESSION_TOKEN', 'ERP_SESSION'); if (cs < 0) return false;
  var tok = String(t.v[r][cs] || '').trim(); if (!tok) return false;
  try { bnxLogoutSession_(tok); } catch (e) {}
  t.sh.getRange(r + 1, cs + 1).setValue(''); t.v[r][cs] = ''; return true;
}
function bnxAdmUserUpdate_(session, p) {
  var uid = String(p.USER_ID || p.userId || '').trim(); if (!uid) return { success: false, error: 'USER_ID required' };
  if (uid === String(session.USER_ID || '') && p.STATUS && p.STATUS !== 'ACTIVE') return { success: false, error: 'You cannot suspend / delete your own login' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var t = bnxAdmTable_(bnxAdmSheet_('USER_MASTER')), rows = bnxAdmFindUser_(t, uid, p.CLIENT_ID && p.STATUS !== 'DELETED' ? '' : p.CLIENT_ID);
    if (!rows.length) return { success: false, error: 'user ' + uid + ' not found' };
    var set = { STATUS: p.STATUS, ROLE: p.ROLE, FULL_NAME: p.FULL_NAME, EMAIL: p.EMAIL, PHONE: p.PHONE, MOBILE_NO: p.PHONE, NAME: p.FULL_NAME };
    rows.forEach(function (r) {
      Object.keys(set).forEach(function (k) { var c = t.c(k), v = set[k]; if (c >= 0 && v !== undefined && v !== '') { if (k === 'STATUS' || k === 'ROLE') v = String(v).toUpperCase(); t.sh.getRange(r + 1, c + 1).setValue(v); } });
      if (p.STATUS) { var ia = t.c('IS_ACTIVE'); if (ia >= 0) t.sh.getRange(r + 1, ia + 1).setValue(String(p.STATUS).toUpperCase() === 'ACTIVE'); }
      if (p.PASSWORD) { ['PASSWORD', 'PASSWORD_HASH'].forEach(function (k) { var c = t.c(k); if (c >= 0) t.sh.getRange(r + 1, c + 1).setValue(String(p.PASSWORD)); }); }   /* same scheme the ERP login reads */
      if (p.STATUS && String(p.STATUS).toUpperCase() !== 'ACTIVE') bnxAdmCloseLogin_(t, r);
    });
    return { success: true, data: { status: 'ok', updated: rows.length } };
  } finally { lock.releaseLock(); }
}
function bnxAdmBulk_(session, p) {
  var op = String(p.operation || '').toUpperCase(), st = op === 'ACTIVATE' ? 'ACTIVE' : op === 'SUSPEND' ? 'SUSPENDED' : op === 'DEACTIVATE' ? 'INACTIVE' : '';
  if (!st && op !== 'LOGOUT') return { success: false, error: 'operation must be ACTIVATE, SUSPEND, DEACTIVATE or LOGOUT' };
  var n = 0; (p.user_ids || []).forEach(function (u) { if (String(u) === String(session.USER_ID)) return;
    if (op === 'LOGOUT') { var r0 = bnxAdmKill_(session, { SESSION_TOKEN: 'U:|' + u }, false); if (r0.success) n += r0.closed || 0; }
    else { var r = bnxAdmUserUpdate_(session, { USER_ID: u, STATUS: st }); if (r.success) n++; } });
  return { success: true, data: { status: 'ok', applied: n, operation: op } };
}
function bnxAdmUserCreate_(session, p) {
  if (typeof bnxAddStaff !== 'function') return { success: false, error: 'staff creation is not available on this server' };
  var cid = String(p.CLIENT_ID || '').trim(); if (!/^CL\d{5,}$/.test(cid)) return { success: false, error: 'CLIENT_ID (CL00010 …) required — users always belong to a client' };
  var s2 = Object.assign({}, session, { CLIENT_ID: cid });
  var r = bnxAddStaff(s2, { name: p.FULL_NAME, loginCode: p.USER_CODE, password: p.PASSWORD, role: p.ROLE, email: p.EMAIL, mobile: p.PHONE, requestId: 'adm-' + cid + '-' + p.USER_CODE });
  if (r && r.success !== false) return { success: true, data: { status: 'ok', userId: r.userId || (r.data && r.data.USER_ID) || '' } };
  return r;
}
function bnxAdmSessions_(session) {
  var t = bnxAdmTable_(bnxAdmSheet_('USER_MASTER')), cs = t.c('SESSION', 'SESSION_TOKEN', 'ERP_SESSION'), out = [];
  if (cs < 0) return { success: true, data: { sessions: [] } };
  var cl = t.c('LAST_LOGIN', 'LAST_LOGIN_AT', 'LOGIN_TIME', 'LAST_LOGIN_TIME'), ce = t.c('SESSION_EXPIRY', 'EXPIRY', 'SESSION_EXPIRES');
  for (var r = 1; r < t.v.length; r++) {
    if (!String(t.v[r][cs] || '').trim()) continue;
    var uid = String(t.v[r][t.c('USER_ID', 'EMP_ID')] || ''), cid = String(t.v[r][t.c('CLIENT_ID')] || '');
    var d = function (x) { return x instanceof Date ? Utilities.formatDate(x, 'Asia/Kolkata', 'dd-MM-yyyy HH:mm') : String(x || '—'); };
    out.push({ user: String(t.v[r][t.c('FULL_NAME', 'NAME')] || uid) + ' (' + cid + ')', USER_ID: uid, role: String(t.v[r][t.c('ROLE')] || ''), CLIENT_ID: cid,
      loginTime: cl >= 0 ? d(t.v[r][cl]) : '—', expiry: ce >= 0 ? d(t.v[r][ce]) : '—', token: 'U:' + cid + '|' + uid });   /* a handle, never the real token */
  }
  return { success: true, data: { sessions: out } };
}
function bnxAdmKill_(session, p, all) {
  var t = bnxAdmTable_(bnxAdmSheet_('USER_MASTER')), cu = t.c('USER_ID', 'EMP_ID'), cc = t.c('CLIENT_ID'), n = 0;
  var h = String(p.SESSION_TOKEN || ''), m = h.match(/^U:([^|]*)\|(.+)$/);
  if (!all && !m) return { success: false, error: 'unknown session' };
  for (var r = 1; r < t.v.length; r++) {
    var uid = String(t.v[r][cu] || ''), cid = String(t.v[r][cc] || '');
    if (uid === String(session.USER_ID) && cid === String(session.AUTH_CLIENT_ID || session.CLIENT_ID)) continue;   /* keep your own login */
    if (!all && !(uid === m[2] && (!m[1] || cid === m[1]))) continue;
    if (bnxAdmCloseLogin_(t, r)) n++;
  }
  return { success: true, closed: n, data: { status: 'ok', closed: n } };
}
function bnxAdmDbTool_(session, p) {
  var tool = String(p.tool || '').toUpperCase(), ss = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID), out = {};
  if (tool === 'COUNT_ALL') { ss.getSheets().forEach(function (sh) { out[sh.getName()] = Math.max(0, sh.getLastRow() - 1); }); try { out.CLIENT_DATABASE_REGISTRY = bnxControlSheet_(CLIENT_DB_REGISTRY_TAB).getLastRow() - 1; } catch (e) {} }
  else if (tool === 'VERIFY_SCHEMA') { var need = { USER_MASTER: ['CLIENT_ID', 'USER_ID', 'ROLE', 'STATUS', 'SESSION'], CLIENT_MASTER: ['CLIENT_ID', 'COMPANY_NAME', 'STATUS'] };
    Object.keys(need).forEach(function (n) { var sh = ss.getSheetByName(n); if (!sh) { out[n] = 'MISSING TAB'; return; } var h = bnxAdmTable_(sh).h; var miss = need[n].filter(function (k) { return h.indexOf(k) < 0 && !(k === 'SESSION' && (h.indexOf('SESSION_TOKEN') >= 0 || h.indexOf('ERP_SESSION') >= 0)) && !(k === 'USER_ID' && h.indexOf('EMP_ID') >= 0); }); out[n] = miss.length ? 'missing: ' + miss.join(', ') : 'OK'; }); }
  else if (tool === 'CLEAN_EXPIRED') { var t = bnxAdmTable_(ss.getSheetByName('USER_MASTER')), cst = t.c('STATUS'), n = 0;
    for (var r = 1; r < t.v.length; r++) { var st = String(t.v[r][cst] || 'ACTIVE').toUpperCase(); if (['ACTIVE', 'YES', 'ENABLED'].indexOf(st) < 0 && bnxAdmCloseLogin_(t, r)) n++; }
    out.closedLoginsOfInactiveUsers = n; }
  else if (tool === 'FLUSH_OTP') { var o = ss.getSheetByName('OTP_LOG') || ss.getSheetByName('OTP_LOGS'); if (!o) out.result = 'no OTP log tab — nothing to flush';
    else { var v = o.getDataRange().getValues(), keep = [v[0]], cut = Date.now() - 864e5, cT = v[0].map(String).findIndex(function (x) { return /TIME|DATE|CREATED/i.test(x); });
      for (var i = 1; i < v.length; i++) { var d = new Date(v[i][cT]); if (cT < 0 || isNaN(d) || d.getTime() >= cut) keep.push(v[i]); }
      out.removed = v.length - keep.length; if (out.removed) { o.clearContents(); o.getRange(1, 1, keep.length, keep[0].length).setValues(keep); } } }
  else return { success: false, error: 'unknown tool' };
  return { success: true, data: out };
}

/* ═══ INDUSTRY STARTER DATA + QUICK POS (2026-11-18) ═════════════════════════════════════════════════════════════
   A new client opens with a ready master DB for its business type — groups, menu / product categories, items with
   prices and GST, units, payment modes, tables (dine-in only) and the POS style:
     RESTAURANT · QSR (pizza / burger / fried chicken counter, Domino's / KFC style) · CAFE · BAKERY · SWEETS ·
     BAR_PUB · GROCERY · RETAIL (apparel / footwear) · PHARMACY · SALON
   Only fills what is EMPTY for that client (items are added by name, never overwritten / duplicated).
   GST follows the 22-Sep-2025 slabs (0 / 5 / 18 / 40 %) — the client's CA should confirm item rates.
   Actions:  INDUSTRY_LIST · INDUSTRY_SEED {industry, targetClientId?, apply:true} · QPOS_CONFIG · QPOS_SAVE
   Editor:   RUN_INDUSTRY_Check() / RUN_INDUSTRY_Apply() — set the two values below first.                    */
var BNX_SEED_CLIENT = 'CL00011', BNX_SEED_INDUSTRY = 'QSR';
function RUN_INDUSTRY_Check() { Logger.log(JSON.stringify(bnxIndustrySeed_(BNX_SEED_CLIENT, BNX_SEED_INDUSTRY, { apply: false }), null, 1)); }
function RUN_INDUSTRY_Apply() { Logger.log(JSON.stringify(bnxIndustrySeed_(BNX_SEED_CLIENT, BNX_SEED_INDUSTRY, { apply: true }), null, 1)); }

/* group: [name, type, gst] · cats: [category, group] · items: [name, price, category, veg(V/NV/''), favourite(1), gstOverride] */
var BNX_INDUSTRY = {
  RESTAURANT: { label: 'Restaurant (dine-in)', pos: 'TABLE', tables: 12, unit: 'PLATE',
    groups: [['FOOD', 'KITCHEN', 0.05], ['BEVERAGE', 'BEVERAGE', 0.05]],
    cats: [['STARTERS', 'FOOD'], ['MAIN COURSE', 'FOOD'], ['BREADS', 'FOOD'], ['RICE & BIRYANI', 'FOOD'], ['CHINESE', 'FOOD'], ['DESSERTS', 'FOOD'], ['BEVERAGES', 'BEVERAGE']],
    items: [['Paneer Tikka', 280, 'STARTERS', 'V', 1], ['Chicken Tikka', 320, 'STARTERS', 'NV', 1], ['Veg Crispy', 220, 'STARTERS', 'V'], ['Chilli Chicken', 300, 'STARTERS', 'NV', 1],
      ['Paneer Butter Masala', 290, 'MAIN COURSE', 'V', 1], ['Dal Makhani', 240, 'MAIN COURSE', 'V', 1], ['Butter Chicken', 360, 'MAIN COURSE', 'NV', 1], ['Mutton Rogan Josh', 420, 'MAIN COURSE', 'NV'],
      ['Kadai Veg', 250, 'MAIN COURSE', 'V'], ['Tandoori Roti', 30, 'BREADS', 'V', 1], ['Butter Naan', 60, 'BREADS', 'V', 1], ['Lachha Paratha', 70, 'BREADS', 'V'],
      ['Jeera Rice', 160, 'RICE & BIRYANI', 'V'], ['Veg Biryani', 260, 'RICE & BIRYANI', 'V'], ['Chicken Biryani', 320, 'RICE & BIRYANI', 'NV', 1], ['Veg Hakka Noodles', 200, 'CHINESE', 'V'],
      ['Chicken Fried Rice', 240, 'CHINESE', 'NV'], ['Gulab Jamun (2 pc)', 90, 'DESSERTS', 'V'], ['Ice Cream', 110, 'DESSERTS', 'V'], ['Fresh Lime Soda', 90, 'BEVERAGES', 'V'],
      ['Masala Chaas', 70, 'BEVERAGES', 'V'], ['Mineral Water', 30, 'BEVERAGES', 'V']] },
  QSR: { label: 'Quick service — pizza / burger / fried chicken (Domino\'s, KFC style)', pos: 'QSR', tables: 0, unit: 'PC',
    groups: [['FOOD', 'KITCHEN', 0.05], ['BEVERAGE', 'BEVERAGE', 0.05]],
    cats: [['PIZZA', 'FOOD'], ['BURGERS', 'FOOD'], ['FRIED CHICKEN', 'FOOD'], ['SIDES', 'FOOD'], ['COMBOS', 'FOOD'], ['DESSERTS', 'FOOD'], ['DRINKS', 'BEVERAGE']],
    items: [['Margherita Pizza (Reg)', 199, 'PIZZA', 'V', 1], ['Farmhouse Pizza (Reg)', 289, 'PIZZA', 'V', 1], ['Pepper Chicken Pizza (Reg)', 329, 'PIZZA', 'NV', 1], ['Paneer Makhani Pizza (Med)', 459, 'PIZZA', 'V'],
      ['Veg Burger', 99, 'BURGERS', 'V', 1], ['Chicken Burger', 149, 'BURGERS', 'NV', 1], ['Zinger Burger', 199, 'BURGERS', 'NV'], ['Fried Chicken (2 pc)', 219, 'FRIED CHICKEN', 'NV', 1],
      ['Hot Wings (6 pc)', 199, 'FRIED CHICKEN', 'NV'], ['Chicken Popcorn (Reg)', 149, 'FRIED CHICKEN', 'NV', 1], ['French Fries (Med)', 99, 'SIDES', 'V', 1], ['Peri Peri Fries', 129, 'SIDES', 'V'],
      ['Garlic Bread', 119, 'SIDES', 'V'], ['Burger + Fries + Drink', 249, 'COMBOS', 'V', 1], ['Chicken Bucket (6 pc) Meal', 599, 'COMBOS', 'NV'], ['Choco Lava Cake', 109, 'DESSERTS', 'V', 1],
      ['Soft Serve Cone', 49, 'DESSERTS', 'V'], ['Pepsi (Reg)', 69, 'DRINKS', 'V', 1], ['Cold Coffee', 129, 'DRINKS', 'V'], ['Mineral Water', 30, 'DRINKS', 'V']] },
  CAFE: { label: 'Café / coffee shop', pos: 'QSR', tables: 6, unit: 'CUP',
    groups: [['FOOD', 'KITCHEN', 0.05], ['BEVERAGE', 'BEVERAGE', 0.05]],
    cats: [['HOT COFFEE', 'BEVERAGE'], ['COLD COFFEE', 'BEVERAGE'], ['TEA', 'BEVERAGE'], ['SHAKES', 'BEVERAGE'], ['SANDWICHES', 'FOOD'], ['SNACKS', 'FOOD'], ['DESSERTS', 'FOOD']],
    items: [['Espresso', 120, 'HOT COFFEE', 'V'], ['Cappuccino', 160, 'HOT COFFEE', 'V', 1], ['Café Latte', 170, 'HOT COFFEE', 'V', 1], ['Americano', 140, 'HOT COFFEE', 'V'],
      ['Cold Coffee', 180, 'COLD COFFEE', 'V', 1], ['Iced Latte', 190, 'COLD COFFEE', 'V'], ['Masala Chai', 60, 'TEA', 'V', 1], ['Green Tea', 90, 'TEA', 'V'], ['Lemon Iced Tea', 130, 'TEA', 'V'],
      ['Chocolate Shake', 190, 'SHAKES', 'V', 1], ['Oreo Shake', 210, 'SHAKES', 'V'], ['Veg Grilled Sandwich', 150, 'SANDWICHES', 'V', 1], ['Chicken Club Sandwich', 210, 'SANDWICHES', 'NV'],
      ['Cheese Garlic Toast', 130, 'SNACKS', 'V'], ['French Fries', 120, 'SNACKS', 'V', 1], ['Brownie', 120, 'DESSERTS', 'V', 1], ['Blueberry Muffin', 110, 'DESSERTS', 'V']] },
  BAKERY: { label: 'Bakery / cake shop', pos: 'QSR', tables: 0, unit: 'PC',
    groups: [['BAKERY', 'GOODS', 0.05], ['BEVERAGE', 'BEVERAGE', 0.05]],
    cats: [['CAKES', 'BAKERY'], ['PASTRIES', 'BAKERY'], ['BREADS', 'BAKERY'], ['COOKIES', 'BAKERY'], ['SAVOURY', 'BAKERY'], ['BEVERAGES', 'BEVERAGE']],
    items: [['Black Forest Cake (500 g)', 450, 'CAKES', 'V', 1], ['Chocolate Truffle Cake (500 g)', 550, 'CAKES', 'V', 1], ['Pineapple Cake (500 g)', 400, 'CAKES', 'V'], ['Red Velvet Cake (500 g)', 650, 'CAKES', 'V'],
      ['Chocolate Pastry', 80, 'PASTRIES', 'V', 1], ['Pineapple Pastry', 70, 'PASTRIES', 'V', 1], ['Blueberry Cheesecake Slice', 150, 'PASTRIES', 'V'], ['Brown Bread', 55, 'BREADS', 'V', 1],
      ['Milk Bread', 45, 'BREADS', 'V'], ['Pav (6 pc)', 40, 'BREADS', 'V'], ['Butter Cookies (250 g)', 160, 'COOKIES', 'V', 1], ['Choco Chip Cookies (250 g)', 190, 'COOKIES', 'V'],
      ['Veg Puff', 35, 'SAVOURY', 'V', 1], ['Chicken Puff', 50, 'SAVOURY', 'NV', 1], ['Paneer Roll', 70, 'SAVOURY', 'V'], ['Cold Coffee', 110, 'BEVERAGES', 'V']] },
  SWEETS: { label: 'Sweet shop / mithai & namkeen', pos: 'QSR', tables: 0, unit: 'KG',
    groups: [['SWEETS', 'GOODS', 0.05], ['SNACKS', 'KITCHEN', 0.05], ['BEVERAGE', 'BEVERAGE', 0.05]],
    cats: [['MITHAI (PER KG)', 'SWEETS'], ['MITHAI (PER PC)', 'SWEETS'], ['NAMKEEN', 'SWEETS'], ['HOT SNACKS', 'SNACKS'], ['BEVERAGES', 'BEVERAGE']],
    items: [['Kaju Katli (1 kg)', 1100, 'MITHAI (PER KG)', 'V', 1], ['Rasgulla (1 kg)', 360, 'MITHAI (PER KG)', 'V', 1], ['Sandesh (1 kg)', 600, 'MITHAI (PER KG)', 'V', 1], ['Motichoor Laddu (1 kg)', 480, 'MITHAI (PER KG)', 'V'],
      ['Soan Papdi (1 kg)', 380, 'MITHAI (PER KG)', 'V'], ['Rasgulla (1 pc)', 20, 'MITHAI (PER PC)', 'V', 1], ['Rajbhog (1 pc)', 30, 'MITHAI (PER PC)', 'V'], ['Mishti Doi (cup)', 40, 'MITHAI (PER PC)', 'V', 1],
      ['Bhujia (500 g)', 140, 'NAMKEEN', 'V', 1], ['Mixture (500 g)', 130, 'NAMKEEN', 'V'], ['Samosa', 15, 'HOT SNACKS', 'V', 1], ['Kachori', 20, 'HOT SNACKS', 'V', 1],
      ['Chole Bhature', 90, 'HOT SNACKS', 'V'], ['Sweet Lassi', 60, 'BEVERAGES', 'V', 1], ['Masala Chai', 20, 'BEVERAGES', 'V']] },
  BAR_PUB: { label: 'Bar / pub (food 5 %, liquor outside GST — state VAT)', pos: 'TABLE', tables: 15, unit: 'PEG',
    groups: [['FOOD', 'KITCHEN', 0.05], ['BEVERAGE', 'BEVERAGE', 0.05], ['LIQUOR', 'BAR', 0]],
    cats: [['BEER', 'LIQUOR'], ['WHISKY (30 ML)', 'LIQUOR'], ['VODKA / GIN / RUM (30 ML)', 'LIQUOR'], ['COCKTAILS', 'LIQUOR'], ['MOCKTAILS', 'BEVERAGE'], ['BAR BITES', 'FOOD']],
    items: [['Kingfisher Premium (650 ml)', 350, 'BEER', '', 1], ['Budweiser (500 ml can)', 320, 'BEER', '', 1], ['Draught Beer (pint)', 300, 'BEER', ''], ['Blenders Pride', 180, 'WHISKY (30 ML)', '', 1],
      ['Black & White', 260, 'WHISKY (30 ML)', ''], ['Johnnie Walker Black Label', 450, 'WHISKY (30 ML)', ''], ['Smirnoff Vodka', 180, 'VODKA / GIN / RUM (30 ML)', '', 1], ['Bombay Sapphire Gin', 300, 'VODKA / GIN / RUM (30 ML)', ''],
      ['Old Monk Rum', 120, 'VODKA / GIN / RUM (30 ML)', ''], ['Mojito', 450, 'COCKTAILS', '', 1], ['Long Island Iced Tea', 650, 'COCKTAILS', '', 1], ['Margarita', 500, 'COCKTAILS', ''],
      ['Virgin Mojito', 220, 'MOCKTAILS', 'V', 1], ['Blue Lagoon (virgin)', 220, 'MOCKTAILS', 'V'], ['Masala Peanuts', 180, 'BAR BITES', 'V', 1], ['Chicken Lollipop', 320, 'BAR BITES', 'NV', 1],
      ['French Fries', 180, 'BAR BITES', 'V'], ['Chilli Paneer Dry', 280, 'BAR BITES', 'V']] },
  GROCERY: { label: 'Grocery / kirana / supermarket', pos: 'RETAIL', tables: 0, unit: 'PC',
    groups: [['STAPLES', 'GOODS', 0.05], ['FMCG', 'GOODS', 0.05], ['HOUSEHOLD', 'GOODS', 0.18]],
    cats: [['RICE & ATTA', 'STAPLES'], ['DAL & PULSES', 'STAPLES'], ['OIL & GHEE', 'STAPLES'], ['SPICES', 'STAPLES'], ['SNACKS & BISCUITS', 'FMCG'], ['DRINKS', 'FMCG'], ['PERSONAL CARE', 'FMCG'], ['CLEANING', 'HOUSEHOLD']],
    items: [['Basmati Rice (1 kg)', 120, 'RICE & ATTA', '', 1], ['Aashirvaad Atta (5 kg)', 260, 'RICE & ATTA', '', 1], ['Loose Rice (1 kg)', 48, 'RICE & ATTA', '', 0, 0], ['Toor Dal (1 kg)', 160, 'DAL & PULSES', '', 1],
      ['Masoor Dal (1 kg)', 110, 'DAL & PULSES', ''], ['Fortune Mustard Oil (1 L)', 170, 'OIL & GHEE', '', 1], ['Amul Ghee (1 L)', 600, 'OIL & GHEE', ''], ['Sugar (1 kg)', 46, 'SPICES', '', 1],
      ['Tata Salt (1 kg)', 28, 'SPICES', '', 1], ['Turmeric Powder (100 g)', 35, 'SPICES', ''], ['Parle-G (250 g)', 25, 'SNACKS & BISCUITS', '', 1], ['Haldiram Bhujia (200 g)', 60, 'SNACKS & BISCUITS', ''],
      ['Maggi Noodles (4 pack)', 56, 'SNACKS & BISCUITS', '', 1], ['Coca-Cola (750 ml)', 40, 'DRINKS', '', 0, 0.40], ['Tata Tea Premium (250 g)', 140, 'DRINKS', ''], ['Lux Soap (3 pack)', 120, 'PERSONAL CARE', '', 1],
      ['Colgate Toothpaste (200 g)', 110, 'PERSONAL CARE', ''], ['Surf Excel (1 kg)', 140, 'CLEANING', '', 1], ['Vim Bar (3 pack)', 60, 'CLEANING', '']] },
  RETAIL: { label: 'Retail — apparel / footwear / general store', pos: 'RETAIL', tables: 0, unit: 'PC',
    groups: [['APPAREL', 'GOODS', 0.05], ['FOOTWEAR', 'GOODS', 0.05], ['ACCESSORIES', 'GOODS', 0.18]],
    cats: [['MEN', 'APPAREL'], ['WOMEN', 'APPAREL'], ['KIDS', 'APPAREL'], ['FOOTWEAR', 'FOOTWEAR'], ['ACCESSORIES', 'ACCESSORIES']],
    items: [['Men T-Shirt', 499, 'MEN', '', 1], ['Men Formal Shirt', 999, 'MEN', '', 1], ['Men Jeans', 1499, 'MEN', '', 1], ['Men Blazer', 3999, 'MEN', '', 0, 0.18],
      ['Women Kurti', 799, 'WOMEN', '', 1], ['Women Saree', 1999, 'WOMEN', '', 1], ['Women Top', 599, 'WOMEN', ''], ['Kids T-Shirt', 349, 'KIDS', '', 1], ['Kids Frock', 699, 'KIDS', ''],
      ['Sports Shoes', 1799, 'FOOTWEAR', '', 1], ['Sandals', 699, 'FOOTWEAR', ''], ['Leather Belt', 599, 'ACCESSORIES', '', 1], ['Wallet', 799, 'ACCESSORIES', ''], ['Socks (3 pair)', 299, 'ACCESSORIES', '', 0, 0.05]] },
  PHARMACY: { label: 'Pharmacy / medical store', pos: 'RETAIL', tables: 0, unit: 'STRIP',
    groups: [['MEDICINES', 'GOODS', 0.05], ['OTC & CARE', 'GOODS', 0.05], ['DEVICES', 'GOODS', 0.05]],
    cats: [['TABLETS', 'MEDICINES'], ['SYRUPS', 'MEDICINES'], ['OTC', 'OTC & CARE'], ['PERSONAL CARE', 'OTC & CARE'], ['DEVICES', 'DEVICES']],
    items: [['Paracetamol 500 mg (strip of 10)', 20, 'TABLETS', '', 1], ['Cetirizine 10 mg (strip of 10)', 25, 'TABLETS', '', 1], ['Pantoprazole 40 mg (strip of 10)', 120, 'TABLETS', '', 1],
      ['Azithromycin 500 mg (strip of 3)', 110, 'TABLETS', ''], ['Cough Syrup (100 ml)', 115, 'SYRUPS', '', 1], ['ORS Sachet', 22, 'OTC', '', 1], ['Vicks VapoRub (25 ml)', 110, 'OTC', ''],
      ['Band-Aid (10 pc)', 40, 'OTC', '', 1], ['Dettol Antiseptic (125 ml)', 80, 'PERSONAL CARE', ''], ['Hand Sanitizer (100 ml)', 50, 'PERSONAL CARE', '', 1], ['Digital Thermometer', 199, 'DEVICES', '', 1],
      ['BP Monitor', 1599, 'DEVICES', ''], ['Glucometer Strips (25)', 650, 'DEVICES', '']] },
  SALON: { label: 'Salon / spa / beauty (services 5 % without ITC)', pos: 'QSR', tables: 0, unit: 'SERVICE',
    groups: [['SERVICES', 'SERVICE', 0.05], ['PRODUCTS', 'GOODS', 0.05]],
    cats: [['HAIR', 'SERVICES'], ['SKIN', 'SERVICES'], ['NAILS', 'SERVICES'], ['SPA', 'SERVICES'], ['PRODUCTS', 'PRODUCTS']],
    items: [['Haircut — Men', 250, 'HAIR', '', 1], ['Haircut — Women', 600, 'HAIR', '', 1], ['Beard Trim', 150, 'HAIR', '', 1], ['Hair Colour (global)', 2500, 'HAIR', ''], ['Hair Spa', 1200, 'HAIR', '', 1],
      ['Clean-up', 700, 'SKIN', '', 1], ['Facial', 1500, 'SKIN', '', 1], ['Threading — Eyebrows', 60, 'SKIN', '', 1], ['Waxing — Full Arms', 400, 'SKIN', ''], ['Manicure', 500, 'NAILS', ''],
      ['Pedicure', 700, 'NAILS', '', 1], ['Head Massage (30 min)', 400, 'SPA', ''], ['Body Massage (60 min)', 2200, 'SPA', ''], ['Shampoo (retail)', 450, 'PRODUCTS', '']] }
};

function bnxIndustryList_() {
  return { success: true, data: Object.keys(BNX_INDUSTRY).map(function (k) { var x = BNX_INDUSTRY[k]; return { key: k, label: x.label, pos: x.pos, items: x.items.length, categories: x.cats.length, tables: x.tables }; }) };
}

function bnxIndustrySeed_(cid, industry, opt) {
  opt = opt || {}; var t0 = Date.now(), apply = opt.apply === true;
  var P = BNX_INDUSTRY[String(industry || '').toUpperCase()]; if (!P) return { success: false, error: 'Unknown industry ' + industry + ' — use one of ' + Object.keys(BNX_INDUSTRY).join(', ') };
  if (!cid) return { success: false, error: 'client missing' };
  var db = bnxBcDbs_(cid), ss = db.MASTER, now = new Date().toISOString(), rep = { industry: industry, client: cid, apply: apply, added: {}, kept: {} };
  var mine = function (r) { return !r.CLIENT_ID || String(r.CLIENT_ID) === String(cid); };
  var norm = function (v) { return String(v == null ? '' : v).trim().toUpperCase().replace(/\s+/g, ' '); };
  var nextId = function (rows, col, prefix, width) { var m = 0; rows.forEach(function (r) { var x = String(r[col] || '').match(/(\d+)$/); if (x) m = Math.max(m, +x[1]); }); return function () { m++; return prefix + ('00000' + m).slice(-(width || 5)); }; };
  var T = {}, tab = function (name, cols) { return T[name] || (T[name] = bnxBcTable_(ss, name, cols)); };
  var add = function (name, row) { tab(name).rows.push(row); rep.added[name] = (rep.added[name] || 0) + 1; };

  /* 1. GST rates → TAX_ID (reuse an existing row with the same rate) */
  var tx = tab('TAX_MASTER', ['TAX_ID', 'CLIENT_ID', 'TAX_NAME', 'TAX_RATE', 'TAX_TYPE', 'IS_ACTIVE', 'CREATED_AT', 'CESS_RATE', 'CESS_TYPE']), taxId = {}, newTax = nextId(tx.rows, 'TAX_ID', 'TAX');
  var TXN = { 0: 'Nil / exempt 0%', 0.05: 'GST 5%', 0.18: 'GST 18%', 0.4: 'GST 40% (sin / luxury)' };
  tx.rows.filter(mine).forEach(function (r) { var k = Math.round(Number(r.TAX_RATE) * 100) / 100; if (!(k in taxId) && !/TOBACCO|HUKKA|SERVICE CHARGE|CESS/i.test(String(r.TAX_NAME))) taxId[k] = String(r.TAX_ID); });
  var rateOf = function (g) { g = Math.round(Number(g || 0) * 100) / 100; if (!(g in taxId)) { taxId[g] = newTax(); add('TAX_MASTER', { TAX_ID: taxId[g], CLIENT_ID: cid, TAX_NAME: TXN[g] || ('GST ' + g * 100 + '%'), TAX_RATE: g, TAX_TYPE: 'GST', IS_ACTIVE: true, CREATED_AT: now, CESS_TYPE: 'CESS' }); } return taxId[g]; };

  /* a client that already has items keeps its own menu: only taxes / units / payment modes are completed (force:true to add the sample menu too) */
  var fresh = !tab('ITEM_MASTER').rows.filter(mine).length; rep.fresh = fresh;
  if (!fresh && !opt.force) rep.kept.menu = 'client already has items — sample menu, categories and tables not added';
  var doMenu = fresh || opt.force === true;
  /* 2. item groups */
  var gt = tab('ITEM_GROUP_MASTER', ['ITEM_GROUP_ID', 'CLIENT_ID', 'ITEM_GROUP_NAME', 'GROUP_TYPE', 'DESCRIPTION', 'DISPLAY_ORDER', 'IS_ACTIVE', 'TAX_ID', 'GST_RATE']), grp = {}, newG = nextId(gt.rows, 'ITEM_GROUP_ID', 'GRP');
  gt.rows.filter(mine).forEach(function (r) { grp[norm(r.ITEM_GROUP_NAME)] = r; });
  if (doMenu) P.groups.forEach(function (g, i) { if (grp[norm(g[0])]) { rep.kept.groups = (rep.kept.groups || 0) + 1; return; }
    var r = { ITEM_GROUP_ID: newG(), CLIENT_ID: cid, ITEM_GROUP_NAME: g[0], GROUP_TYPE: g[1], DESCRIPTION: P.label, DISPLAY_ORDER: gt.rows.length + 1, IS_ACTIVE: true, TAX_ID: rateOf(g[2]), GST_RATE: g[2] };
    grp[norm(g[0])] = r; add('ITEM_GROUP_MASTER', r); });

  /* 3. categories (CATEGORY_MASTER + MENU_ITEM_CATEGORY_LIST share the id) */
  var ct = tab('CATEGORY_MASTER', ['CATEGORY_ID', 'CLIENT_ID', 'CATEGORY_NAME', 'ICON', 'DISPLAY_ORDER', 'IS_ACTIVE', 'CREATED_AT']), cl = tab('MENU_ITEM_CATEGORY_LIST', ['CATEGORY_ID', 'CLIENT_ID', 'CATEGORY_NAME', 'MENU_SECTION', 'DISPLAY_ORDER', 'ITEM_COUNT', 'IS_ACTIVE', 'ITEM_GROUP_ID']);
  var cat = {}, clHas = {}, newC = nextId(ct.rows.concat(cl.rows), 'CATEGORY_ID', 'CAT');
  ct.rows.filter(mine).forEach(function (r) { cat[norm(r.CATEGORY_NAME)] = String(r.CATEGORY_ID); });
  cl.rows.filter(mine).forEach(function (r) { clHas[norm(r.CATEGORY_NAME)] = 1; if (!cat[norm(r.CATEGORY_NAME)]) cat[norm(r.CATEGORY_NAME)] = String(r.CATEGORY_ID); });
  if (doMenu) P.cats.forEach(function (c, i) {
    var k = norm(c[0]), id = cat[k], g = grp[norm(c[1])];
    if (!id) { id = cat[k] = newC(); add('CATEGORY_MASTER', { CATEGORY_ID: id, CLIENT_ID: cid, CATEGORY_NAME: c[0], DISPLAY_ORDER: i + 1, IS_ACTIVE: true, CREATED_AT: now }); }
    if (!clHas[k]) { clHas[k] = 1; add('MENU_ITEM_CATEGORY_LIST', { CATEGORY_ID: id, CLIENT_ID: cid, CATEGORY_NAME: c[0], MENU_SECTION: c[0], DISPLAY_ORDER: i + 1, ITEM_COUNT: P.items.filter(function (x) { return x[2] === c[0]; }).length, IS_ACTIVE: true, ITEM_GROUP_ID: g ? g.ITEM_GROUP_ID : '' }); }
  });

  /* 4. items → ITEM_MASTER + MENU_CARD_ITEMS (the POS menu); an item that exists by name is kept as it is */
  var it = tab('ITEM_MASTER', ['ITEM_ID', 'CLIENT_ID', 'ITEM_NAME', 'SELLING_RATE', 'TAX_ID', 'HSN_CODE', 'IS_ACTIVE', 'CREATED_AT', 'UPDATED_AT', 'KITCHEN', 'IS_VEG', 'IS_BAR', 'ITEM_GROUP_ID', 'MENU_CATEGORY_ID', 'MENU_SECTION', 'MENU_ACTIVE', 'MENU_SORT_ORDER', 'DIETARY_TYPE', 'MENU_TYPE']);
  var mc = tab('MENU_CARD_ITEMS', ['CLIENT_ID', 'MENU_ITEM_NAME', 'PRICE', 'MENU_SECTION', 'VEG_TYPE', 'SOURCE', 'ITEM_ID', 'ITEM_CODE', 'CATEGORY_ID', 'AVAILABILITY_STATUS', 'FAVOURITE', 'POPULAR', 'MENU_TYPE', 'ITEM_GROUP_ID', 'ITEM_GROUP_NAME']);
  var itm = {}, card = {}, newI = nextId(it.rows, 'ITEM_ID', 'ITM');
  it.rows.filter(mine).forEach(function (r) { itm[norm(r.ITEM_NAME)] = r; });
  mc.rows.filter(mine).forEach(function (r) { card[norm(r.MENU_ITEM_NAME)] = 1; });
  var groupOfCat = {}; P.cats.forEach(function (c) { groupOfCat[c[0]] = grp[norm(c[1])]; });
  if (doMenu) P.items.forEach(function (x, i) {
    var k = norm(x[0]), g = groupOfCat[x[2]] || {}, gst = x.length > 5 ? x[5] : Number(g.GST_RATE || 0), bar = /BAR/.test(String(g.GROUP_TYPE || ''));
    var r = itm[k];
    if (!r) {
      r = itm[k] = { ITEM_ID: newI(), CLIENT_ID: cid, ITEM_NAME: x[0], SELLING_RATE: x[1], TAX_ID: rateOf(gst), IS_ACTIVE: true, CREATED_AT: now, UPDATED_AT: now,
        KITCHEN: bar ? 'BAR' : String(g.GROUP_TYPE || '') === 'KITCHEN' ? 'KITCHEN' : '', IS_VEG: x[3] === 'V' ? 1 : x[3] === 'NV' ? 0 : '', IS_BAR: bar ? 1 : 0, ITEM_GROUP_ID: g.ITEM_GROUP_ID || '',
        MENU_CATEGORY_ID: cat[norm(x[2])] || '', MENU_SECTION: x[2], MENU_ACTIVE: true, MENU_SORT_ORDER: i + 1, DIETARY_TYPE: x[3] === 'V' ? 'VEG' : x[3] === 'NV' ? 'NON-VEG' : '', MENU_TYPE: P.pos === 'RETAIL' ? 'RETAIL' : 'RESTAURANT' };
      add('ITEM_MASTER', r);
    } else rep.kept.items = (rep.kept.items || 0) + 1;
    if (!card[k] && !bar) { card[k] = 1;   /* bar items are published by the Bar Module's own menu card */
      add('MENU_CARD_ITEMS', { CLIENT_ID: cid, MENU_ITEM_NAME: r.ITEM_NAME, PRICE: Number(r.SELLING_RATE) || x[1], MENU_SECTION: x[2], VEG_TYPE: x[3] === 'NV' ? 'NV' : x[3] === 'V' ? 'V' : '', SOURCE: 'Industry starter: ' + industry,
        ITEM_ID: r.ITEM_ID, ITEM_CODE: r.ITEM_ID, CATEGORY_ID: cat[norm(x[2])] || '', AVAILABILITY_STATUS: 'available', FAVOURITE: !!x[4], POPULAR: !!x[4], MENU_TYPE: r.MENU_TYPE || 'RESTAURANT',
        ITEM_GROUP_ID: g.ITEM_GROUP_ID || '', ITEM_GROUP_NAME: g.ITEM_GROUP_NAME || '' }); }
  });

  /* 5. units, payment modes, tables */
  var ut = tab('UNIT_MASTER', ['UNIT_ID', 'CLIENT_ID', 'UNIT_NAME', 'ABBREVIATION', 'CONVERSION_FACTOR', 'CREATED_AT']), uHas = {}, newU = nextId(ut.rows, 'UNIT_ID', 'UNT');
  ut.rows.filter(mine).forEach(function (r) { uHas[norm(r.ABBREVIATION || r.UNIT_NAME)] = 1; });
  [['Piece', 'PC'], ['Plate', 'PLATE'], ['Kilogram', 'KG'], ['Gram', 'GM'], ['Litre', 'LTR'], ['Millilitre', 'ML'], ['Pack', 'PK'], ['Box', 'BOX'], ['Strip', 'STRIP'], ['Service', 'SERVICE'], ['Cup', 'CUP'], ['Peg (30 ml)', 'PEG']].forEach(function (u) {
    if (!uHas[u[1]]) { uHas[u[1]] = 1; add('UNIT_MASTER', { UNIT_ID: newU(), CLIENT_ID: cid, UNIT_NAME: u[0], ABBREVIATION: u[1], CONVERSION_FACTOR: 1, CREATED_AT: now }); } });
  var pm = tab('PAYMENT_MODE_MASTER', ['PAYMENT_MODE_ID', 'CLIENT_ID', 'MODE_NAME', 'REQUIRES_REFERENCE', 'IS_ACTIVE', 'CREATED_AT', 'MODE_CODE', 'UPDATED_AT']), pHas = {}, newP = nextId(pm.rows, 'PAYMENT_MODE_ID', 'PMD');
  pm.rows.filter(mine).forEach(function (r) { pHas[norm(r.MODE_CODE || r.MODE_NAME)] = 1; });
  [['Cash', 'CASH', false], ['UPI', 'UPI', true], ['Card', 'CARD', true], ['Credit', 'CREDIT', false]].concat(P.pos === 'RETAIL' ? [] : [['Zomato', 'ZOMATO', true], ['Swiggy', 'SWIGGY', true]]).forEach(function (m) {
    if (!pHas[m[1]]) { pHas[m[1]] = 1; add('PAYMENT_MODE_MASTER', { PAYMENT_MODE_ID: newP(), CLIENT_ID: cid, MODE_NAME: m[0], REQUIRES_REFERENCE: m[2], IS_ACTIVE: true, CREATED_AT: now, MODE_CODE: m[1], UPDATED_AT: now }); } });
  if (P.tables && doMenu) {
    var tb = tab('TABLE_MASTER', ['TABLE_ID', 'CLIENT_ID', 'LOCATION_ID', 'TABLE_NUMBER', 'CAPACITY', 'SECTION', 'IS_ACTIVE', 'CREATED_AT']);
    if (!tb.rows.filter(mine).length) for (var n = 1; n <= P.tables; n++) add('TABLE_MASTER', { TABLE_ID: 'T' + n, CLIENT_ID: cid, LOCATION_ID: 'LOC00001', TABLE_NUMBER: 'T' + n, CAPACITY: n % 3 ? 4 : 6, SECTION: 'MAIN', IS_ACTIVE: true, CREATED_AT: now });
    else rep.kept.tables = tb.rows.filter(mine).length;
  }

  /* 6. POS style for this client (Script property, read by QPOS_CONFIG and the quick POS page) */
  if (apply) {
    Object.keys(T).forEach(function (k) { if (rep.added[k]) bnxBcWrite_(T[k]); });
    try { SpreadsheetApp.flush(); } catch (e) {}
    var sp = PropertiesService.getScriptProperties();
    sp.setProperty('BNX_INDUSTRY_' + cid, String(industry).toUpperCase());
    if (!sp.getProperty('QPOS_' + cid)) sp.setProperty('QPOS_' + cid, JSON.stringify({ mode: P.pos, orderType: P.pos === 'TABLE' ? 'DINEIN' : 'TAKEAWAY', tiles: 12 }));
    try { CacheService.getScriptCache().removeAll(['posmenu_v2_' + cid, 'itemmetagen_' + cid]); } catch (e) {}
  }
  rep.pos = P.pos; rep.ms = Date.now() - t0;
  rep.note = apply ? 'Starter data written. Prices and GST are typical values — change them in Menu / Item Master.' : 'Check only — nothing written. Run with apply:true to fill.';
  return { success: true, data: rep };
}

/* who may seed: super admin (any client) or the client's own ADMIN / OWNER */
function bnxIndustryAction_(session, p, apply) {
  var target = String(p.targetClientId || p.target || session.CLIENT_ID || '').trim(), role = String(session.ROLE || '').toUpperCase();
  var sup = /SUPER_ADMIN|DEVELOPER/.test(role) || String(PropertiesService.getScriptProperties().getProperty('BNX_SUPER_ADMINS') || '').split(/[\s,]+/).indexOf(String(session.USER_ID)) >= 0;
  if (target !== String(session.CLIENT_ID) && !sup) return { success: false, error: 'Only a super admin can fill another client' };
  if (!sup && !/ADMIN|OWNER/.test(role)) return { success: false, error: 'Only the owner / admin can load starter data' };
  return bnxIndustrySeed_(target, p.industry, { apply: apply && p.apply === true, force: p.force === true });
}

/* ── QUICK POS (touch & pay counter) config: POS style, tiles, UPI for the QR, shop name ── */
function bnxQposConfig_(session) {
  var cid = session.CLIENT_ID, sp = PropertiesService.getScriptProperties(), cfg = {};
  try { cfg = JSON.parse(sp.getProperty('QPOS_' + cid) || '{}') || {}; } catch (e) { cfg = {}; }
  var ind = sp.getProperty('BNX_INDUSTRY_' + cid) || '', upi = {};
  try { upi = bnxRestaurantUpi_(cid) || {}; } catch (e) {}
  var shop = { name: '', address: '', phone: '', gstin: '', footer: '' };
  try {
    var cs = bnxBcTable_(bnxBcDbs_(cid).MASTER, 'CLIENT_SETTINGS').rows.filter(function (r) { return String(r.CLIENT_ID) === String(cid); })[0];
    if (cs) shop = { name: String(cs.CLIENT_DISPLAY_NAME || cs.RESTAURANT_NAME || ''), address: String(cs.RESTAURANT_ADDRESS || ''), phone: String(cs.RESTAURANT_PHONE || ''), gstin: String(cs.GSTIN || ''), footer: String(cs.INVOICE_FOOTER || '') };
  } catch (e) {}
  return { success: true, data: { mode: cfg.mode || (BNX_INDUSTRY[ind] && BNX_INDUSTRY[ind].pos) || 'QSR', orderType: cfg.orderType || 'TAKEAWAY', tiles: cfg.tiles || 12,
    favourites: cfg.favourites || [], industry: ind, upi: { vpa: upi.vpa || '', pn: upi.pn || shop.name }, shop: shop } };
}
function bnxQposSave_(session, p) {
  var role = String(session.ROLE || '').toUpperCase(); if (!/ADMIN|OWNER|MANAGER|DEVELOPER/.test(role)) return { success: false, error: 'Only a manager / owner can change the quick POS' };
  var sp = PropertiesService.getScriptProperties(), k = 'QPOS_' + session.CLIENT_ID, cur = {};
  try { cur = JSON.parse(sp.getProperty(k) || '{}') || {}; } catch (e) {}
  var c = p.cfg || {};
  if (c.mode) cur.mode = /^(QSR|TABLE|RETAIL)$/.test(String(c.mode)) ? String(c.mode) : 'QSR';
  if (c.orderType) cur.orderType = /^(TAKEAWAY|DINEIN|DELIVERY)$/.test(String(c.orderType)) ? String(c.orderType) : 'TAKEAWAY';
  if (c.tiles) cur.tiles = Math.max(4, Math.min(40, Number(c.tiles) || 12));
  if (Array.isArray(c.favourites)) cur.favourites = c.favourites.slice(0, 40).map(String);
  sp.setProperty(k, JSON.stringify(cur));
  return { success: true, data: cur };
}

/* ═══ WHATSAPP · BUSINESS (Cloud API) OR NORMAL WHATSAPP · every contact saved to the guest CRM (2026-11-18) ═════════════
   Business WhatsApp = Growth Hub › 🔗 Connect WhatsApp (Facebook login, wa-webhook-connect.gs) → campaigns send by themselves.
   Normal WhatsApp  = no Meta setup: Growth Hub lists the opted-in guests, the phone / WhatsApp Web opens each chat with the
   message already typed, staff taps Send. Each one is logged in WA_CAMPAIGN_LOG (STATUS SENT_MANUAL) and the guest is kept
   in GUEST_CRM. WA_CRM_SAVE: Quick POS / dashboard "WhatsApp bill" saves the customer's number + name in GUEST_CRM.
   Needs Guest growth suite.gs + customer-crm.gs (bnxGgGuestUpsert_, bnxGgAudience_, bnxGgCampLogSh_).                       */
function bnxWaCrmSave_(session, p) {
  if (typeof bnxGgGuestUpsert_ !== 'function') return { success: false, error: 'Guest CRM not in this project (Guest growth suite.gs)' };
  var m = typeof bnxGgMobile_ === 'function' ? bnxGgMobile_(p.mobile) : String(p.mobile || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(m)) return { success: false, error: 'Enter a 10-digit mobile number' };
  var src = String(p.source || 'WHATSAPP').toUpperCase().replace(/[^A-Z0-9_ -]/g, '').slice(0, 30) || 'WHATSAPP';
  var crn = bnxGgGuestUpsert_(session.CLIENT_ID, m, String(p.name || '').slice(0, 60), src);
  try { bnxGgAppend_(bnxGgCampLogSh_(session.CLIENT_ID), { CAMPAIGN_ID: src === 'POS_BILL' ? 'BILL' : 'CHAT', MOBILE: m, NAME: String(p.name || ''), CRN: crn, STATUS: 'SENT_MANUAL',
    SENT_AT: new Date(), CLIENT_ID: session.CLIENT_ID, UPDATED_AT: new Date(), META: String(p.note || src).slice(0, 200) }); } catch (e) {}
  return { success: true, data: { crn: crn, mobile: m } };
}
function bnxWaManualList_(session, p) {
  if (!/ADMIN|OWNER|MANAGER|DEVELOPER|MARKETING/.test(String(session.ROLE || '').toUpperCase())) return { success: false, error: 'Only the owner / manager can open the guest list' };
  if (typeof bnxGgAudience_ !== 'function') return { success: false, error: 'Guest growth suite.gs missing' };
  var au = bnxGgAudience_(session.CLIENT_ID, p.filter || {}), done = {};
  /* already messaged in this campaign (resume after a break) */
  if (p.campaign) try { bnxGgRows_(bnxGgCampLogSh_(session.CLIENT_ID)).forEach(function (r) { if (String(r.CAMPAIGN_ID) === String(p.campaign)) done[String(r.MOBILE)] = 1; }); } catch (e) {}
  var name = ''; try { name = bnxGgProp_('RESTAURANT_NAME', session.CLIENT_ID) || ''; } catch (e) {}
  return { success: true, data: { restaurant: name, optedIn: au.optedIn, totalGuests: au.totalGuests, count: au.list.length,
    list: au.list.slice(0, 1500).map(function (g) { return { mobile: g.mobile, name: g.name, crn: g.crn, visits: g.visits, points: g.points, done: !!done[g.mobile] }; }) } };
}
function bnxWaManualLog_(session, p) {
  if (typeof bnxGgCampLogSh_ !== 'function') return { success: false, error: 'Guest growth suite.gs missing' };
  var camp = String(p.campaign || '').slice(0, 60) || ('MANUAL-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMdd'));
  var sh = bnxGgCampLogSh_(session.CLIENT_ID), n = 0, now = new Date();
  (Array.isArray(p.entries) ? p.entries : []).slice(0, 200).forEach(function (e) {
    var m = bnxGgMobile_(e.mobile); if (!m) return;
    bnxGgAppend_(sh, { CAMPAIGN_ID: camp, MOBILE: m, NAME: String(e.name || ''), CRN: String(e.crn || ''), STATUS: 'SENT_MANUAL', SENT_AT: now, CLIENT_ID: session.CLIENT_ID,
      UPDATED_AT: now, META: 'normal WhatsApp · ' + String(session.FULL_NAME || session.USER_NAME || session.USER_ID || '') }); n++;
  });
  return { success: true, data: { logged: n, campaign: camp } };
}


/* ═══ GST CLOUD COPY (2026-11-19) ═══════════════════════════════════════════════════════════════════════════
   Drive › BNX_GST_CLOUD › <CLIENT_ID> › <GSTIN>.json (+ <GSTIN>_prev.json, the copy before the last save).
   The ERP client comes from the verified login only — a user can never read or write another client's folder.
   Run RUN_GST_CLOUD_SelfTest once after pasting (it asks for Drive permission). */
function bnxGstCloudFolder_(cid, create) {
  var name = 'BNX_GST_CLOUD', it = DriveApp.getFoldersByName(name), root = it.hasNext() ? it.next() : (create ? DriveApp.createFolder(name) : null);
  if (!root) return null;
  var sub = root.getFoldersByName(cid); return sub.hasNext() ? sub.next() : (create ? root.createFolder(cid) : null);
}
function bnxGstCloudCore_(session, p, mode) {
  var cid = String(session && session.CLIENT_ID || '').trim(); if (!/^[A-Za-z0-9_-]{3,40}$/.test(cid)) return { success: false, error: 'No client on this login' };
  var role = String(session.ROLE || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (/^(STEWARD|WAITER|CAPTAIN|KITCHEN|CHEF|KOT|BARTENDER|DELIVERY)$/.test(role)) return { success: false, error: 'This login has no GST access' };
  if (mode === 'SAVE' && role === 'VIEWER') return { success: false, error: 'View-only login — ask the owner to save' };
  if (mode === 'LIST') {
    var f = bnxGstCloudFolder_(cid, false), out = []; if (!f) return { success: true, data: { files: [] } };
    var files = f.getFiles(); while (files.hasNext()) { var x = files.next(), n = x.getName(); if (/^\d{2}[A-Z0-9]{13}\.json$/.test(n)) out.push({ gstin: n.slice(0, 15), size: x.getSize(), savedAt: x.getLastUpdated().toISOString(), name: String(x.getDescription() || '') }); }
    return { success: true, data: { files: out } };
  }
  var gstin = String(p.gstin || '').toUpperCase().trim(); if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return { success: false, error: 'Valid GSTIN required' };
  var lock = bnxGstMutex_('gstc_' + cid + '_' + gstin); if (!lock) return { success: false, error: 'SERVER_BUSY', message: 'Another save of this GSTIN is running — retrying', retryable: true };
  try {
    if (mode === 'LOAD') {
      var fl = bnxGstCloudFolder_(cid, false); if (!fl) return { success: true, data: null };
      var it = fl.getFilesByName(gstin + '.json'); if (!it.hasNext()) return { success: true, data: null };
      var file = it.next(); return { success: true, data: { json: file.getBlob().getDataAsString('UTF-8'), savedAt: file.getLastUpdated().toISOString(), by: String(file.getDescription() || '') } };
    }
    var body = typeof p.data === 'string' ? p.data : JSON.stringify(p.data || null);
    if (!body || body === 'null') return { success: false, error: 'Nothing to save' };
    if (body.length > 40 * 1024 * 1024) return { success: false, error: 'Data too large (over 40 MB) — export old years and remove them' };
    try { JSON.parse(body); } catch (e) { return { success: false, error: 'Data is not valid JSON' }; }
    var folder = bnxGstCloudFolder_(cid, true), cur = folder.getFilesByName(gstin + '.json'), who = String(session.USER_NAME || session.FULL_NAME || session.USER_ID || '') + ' · ' + String(p.name || '').slice(0, 60);
    if (cur.hasNext()) { var c = cur.next(), prev = folder.getFilesByName(gstin + '_prev.json');
      if (prev.hasNext()) prev.next().setContent(c.getBlob().getDataAsString('UTF-8')); else folder.createFile(gstin + '_prev.json', c.getBlob().getDataAsString('UTF-8'), MimeType.PLAIN_TEXT);
      c.setContent(body); c.setDescription(who); return { success: true, data: { savedAt: new Date().toISOString(), size: body.length } }; }
    folder.createFile(gstin + '.json', body, MimeType.PLAIN_TEXT).setDescription(who);
    return { success: true, data: { savedAt: new Date().toISOString(), size: body.length } };
  } finally { lock.release(); }
}
/* one save per client + GSTIN at a time (CacheService token), so POS / other clients never make GST wait */
function bnxGstMutex_(key) {
  var c = CacheService.getScriptCache(), me = Utilities.getUuid(), end = Date.now() + 25000;
  while (Date.now() < end) { if (!c.get(key)) { c.put(key, me, 60); Utilities.sleep(60); if (c.get(key) === me) return { release: function () { try { if (c.get(key) === me) c.remove(key); } catch (e) {} } }; } Utilities.sleep(500); }
  return null;
}
function bnxGstCloud_(session, p, mode) {
  var r = bnxGstCloudCore_(session, p, mode);
  if (mode === 'SAVE' && r && r.success && p.summary && (p.sheetUrl || p.autoSheet)) {
    try { var s = bnxGstSheetSync_(session, p); r.data = r.data || {}; if (s && s.success) { r.data.sheetUrl = s.data.sheetUrl; r.data.sheetCreated = !!s.data.created; } else r.data.sheetError = String(s && (s.error || s.message) || 'sheet not updated'); }
    catch (e) { r.data = r.data || {}; r.data.sheetError = String(e && e.message || e); }
  }
  return r;
}
function RUN_GST_CLOUD_SelfTest() {
  var s = { CLIENT_ID: 'SELFTEST', ROLE: 'ADMIN', USER_NAME: 'selftest' };
  Logger.log(JSON.stringify(bnxGstCloud_(s, { gstin: '19AAMFV9733B1ZS', name: 'test', data: { hello: 1 } }, 'SAVE')));
  Logger.log(JSON.stringify(bnxGstCloud_(s, { gstin: '19AAMFV9733B1ZS' }, 'LOAD')));
  Logger.log(JSON.stringify(bnxGstCloud_(s, {}, 'LIST')));
}

/* ═══ GST → GOOGLE SHEET (2026-11-19) ═══════════════════════════════════════════════════════════════════════
   Each cloud save (or "Update Google Sheet now") writes the FY summary into a tab "BNX Auto <GSTIN>" of the client's
   own sheet, in the same colours as the BalajiGST "Summery" tab. Only that tab is cleared and rewritten — the
   workbook's other tabs and formulas are never touched. The sheet must be shared (Editor) with the Google account
   that owns this Apps Script project. */
function bnxGstSheetSync_(session, p) {
  var role = String(session && session.ROLE || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (!/^(SUPER_ADMIN|ADMIN|OWNER|ACCOUNTANT|ACCOUNTS|MANAGER|CA|AUDITOR)$/.test(role)) return { success: false, error: 'Only admin / accounts logins can update the Google Sheet' };
  var url = String(p.sheetUrl || ''), m = url.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/), created = false;
  var gstin = String(p.gstin || '').toUpperCase(); if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return { success: false, error: 'Valid GSTIN required' };
  if (!m) {
    if (!p.autoSheet) return { success: false, error: 'Set the Google Sheet link first' };
    /* new Google Sheet in the same Drive folder as this client's GST data: BNX_GST_CLOUD/<client>/BNX GST <GSTIN> — <name> */
    var cidS = String(session.CLIENT_ID || ''), folder = bnxGstCloudFolder_(cidS, true), title = 'BNX GST ' + gstin + ' — ' + String(p.name || '').slice(0, 60), found = folder.getFilesByName(title), fid;
    if (found.hasNext()) fid = found.next().getId();
    else { var nss = SpreadsheetApp.create(title); fid = nss.getId(); DriveApp.getFileById(fid).moveTo(folder); created = true; }
    m = [null, fid]; url = 'https://docs.google.com/spreadsheets/d/' + fid + '/edit';
  }
  var S = p.summary || {}, R = S.report || {}, grid = S.grid || [], mon = S.monthly || [];
  var ss; try { ss = SpreadsheetApp.openById(m[1]); } catch (e) { return { success: false, error: 'Cannot open the sheet — share it (Editor) with the ERP Google account' }; }
  var name = 'BNX Auto ' + gstin, sh = ss.getSheetByName(name) || ss.insertSheet(name); sh.clear(); sh.clearFormats();
  var BLUE = '#3d85c6', BLUE2 = '#6fa8dc', CORAL = '#fc7d72', PEACH = '#ffe6dd', GREY = '#d9d9d9', CYAN = '#e0f7fa', MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var mlab = function (x) { return MN[Number(String(x).slice(5, 7)) - 1] || x; }, W = 13;
  sh.getRange(1, 1, 2, W).setBackground(BLUE).setFontColor('#ffffff').setFontWeight('bold').setFontSize(13);
  sh.getRange(1, 1).setValue('Name →').setFontColor(PEACH); sh.getRange(1, 2, 1, 5).merge().setValue(String(p.name || '')).setBackground('#ffffff').setFontColor('#000000');
  sh.getRange(1, 7).setValue('GSTIN →').setFontColor(PEACH); sh.getRange(1, 8, 1, 4).merge().setValue(gstin);
  sh.getRange(2, 1).setValue('Year'); sh.getRange(2, 2, 1, 2).merge().setValue('FY ' + (S.fy || '')).setBackground('#ffffff').setFontColor('#000000');
  sh.getRange(2, 8, 1, 6).merge().setValue('Updated ' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MM-yyyy HH:mm') + ' by Balaji NextGen GST').setFontSize(9).setFontWeight('normal');
  sh.getRange(3, 1, 1, W).merge().setValue('Return Summary').setBackground(CORAL).setFontColor('#ffffff').setFontWeight('bold').setFontSize(14);
  sh.getRange(4, 1, 1, W).setValues([['Month'].concat(grid.map(function (g) { return mlab(g.m); })).concat(new Array(Math.max(0, W - 1 - grid.length)).fill(''))]).setBackground(BLUE2).setFontColor('#ffffff').setHorizontalAlignment('center').setFontSize(12);
  var row = function (lab, key) { return [lab].concat(grid.map(function (g) { return g[key]; })).concat(new Array(Math.max(0, W - 1 - grid.length)).fill('')); };
  sh.getRange(5, 1, 2, W).setValues([row('GSTR 3B', 'r3b'), row('GSTR 1', 'r1')]).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(6, 1, 1, W).setBackground(PEACH);
  for (var c = 2; c <= W; c++) for (var r = 5; r <= 6; r++) { var v = sh.getRange(r, c).getValue(); if (v === 'Not Filed' || v === 'Not uploaded') sh.getRange(r, c).setFontColor('#e53935'); else if (/^Due/.test(v)) sh.getRange(r, c).setFontColor('#b8690e'); }
  sh.getRange(8, 1).setValue('REPORT'); sh.getRange(8, 2, 1, 5).merge().setValue('Turnover'); sh.getRange(8, 7, 1, 7).merge().setValue('ITC');
  sh.getRange(8, 1, 1, W).setBackground(CORAL).setFontColor('#ffffff').setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center');
  sh.getRange(9, 1, 1, W).setValues([['Value', 'Taxable Value', 'Non Tax Value', 'Turnover (GSTR1)', 'GSTR3B Sales Value', 'Tax Liability (GSTR3B)', 'ITC Asper GSTR2B', 'ITC Claimed (GSTR3B)', 'ITC Asper Books', 'ITC Not Availed / Reverse', 'Preceding Year ITC Availed In Current Year', 'In 2B Only Invoice Wise', 'In Book Only Invoice Wise']]).setBackground(GREY).setFontWeight('bold').setWrap(true).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(10, 1, 1, W).setValues([['FY ' + (S.fy || ''), R.taxable || 0, R.nonTax || 0, R.r1Turn || 0, R.b3Sales || 0, R.b3Tax || 0, R.itc2b || 0, R.itc3b || 0, R.itcBooks || 0, R.itcNot || 0, R.prevItc || 0, R.in2bOnly || 0, R.inBooksOnly || 0]]).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(10, 2, 1, 10).setNumberFormat('#,##0.00');
  sh.getRange(11, 6).setValue('Difference').setFontColor('#e53935').setFontWeight('bold'); sh.getRange(11, 7, 1, 2).merge().setValue(-(R.itcDiff || 0)).setNumberFormat('#,##0;(#,##0)').setFontColor('#e53935').setFontWeight('bold');
  sh.getRange(13, 1, 1, W).merge().setValue('(A) Monthwise Purchase value vs Sales value & Input tax vs Output tax — as per book & portal').setBackground(CORAL).setFontColor('#ffffff').setFontWeight('bold').setFontSize(13);
  sh.getRange(14, 1, 1, W).setValues([['Month', 'Purchase Value (2B)', 'Sales Value (GSTR1)', 'Purchase Value (Book)', 'Sales Value (Book)', 'Turnover Diff', 'Input Tax (ITC 2B)', 'Output Tax (GSTR3B)', 'Input Tax Book', 'Output Tax Book', 'Net Tax', '', '']]).setBackground(GREY).setFontWeight('bold').setWrap(true).setHorizontalAlignment('center');
  if (mon.length) {
    var vals = mon.map(function (x) { return [mlab(x.m), x.pur2b || 0, x.salesR1 || 0, x.purBk || 0, x.salesBk || 0, x.turnDiff || 0, x.itcPortal || 0, x.outPortal == null ? '' : x.outPortal, x.itcBook || 0, x.outBook || 0, x.net || 0, '', '']; });
    sh.getRange(15, 1, vals.length, W).setValues(vals); sh.getRange(15, 2, vals.length, 10).setNumberFormat('#,##0.00;(#,##0.00)');
    for (var i = 0; i < vals.length; i++) if (i % 2 === 0) sh.getRange(15 + i, 1, 1, 11).setBackground(CYAN);
  }
  sh.getRange(1, 1, 14 + mon.length, W).setBorder(true, true, true, true, true, true, '#c9c9c9', SpreadsheetApp.BorderStyle.SOLID).setFontFamily('Calibri');
  sh.setColumnWidth(1, 120); for (var k = 2; k <= W; k++) sh.setColumnWidth(k, 118); sh.setRowHeight(9, 48); sh.setFrozenRows(2);
  if (created) { try { var s1 = ss.getSheetByName('Sheet1'); if (s1 && ss.getSheets().length > 1) ss.deleteSheet(s1); } catch (e) {} }
  return { success: true, data: { tab: name, url: url, sheetUrl: 'https://docs.google.com/spreadsheets/d/' + m[1] + '/edit', created: created } };
}

/* ═══ GST FREE TRIAL · TEAM USERS (2026-11-19) ═══════════════════════════════════════════════════════════════
   Anyone can start a 7-day free trial of the GST workspace from Dashboard/gst/gst.html (sign up with name, firm,
   mobile, e-mail, password). Each trial gets its own client ID (GT000001 …), its own private cloud folder and can add
   team users. Stored in USER_SECURITY_MASTER_DB › GST_TRIAL_USERS (password + session token kept only as salted
   SHA-256 hashes). Super admin: GST_TRIAL_ADMIN {op: LIST | EXTEND (days) | ACTIVATE (days, default 365) | SUSPEND}.
   You get an e-mail for every new sign-up. These logins only open the GST workspace — not the ERP.            */
var BNX_GST_TRIAL_DAYS = 7, BNX_GST_TRIAL_TAB = 'GST_TRIAL_USERS';
var BNX_GST_TRIAL_COLS = ['CLIENT_ID', 'USER_ID', 'LOGIN_ID', 'NAME', 'MOBILE', 'COMPANY', 'GSTIN', 'ROLE', 'SALT', 'PASS_HASH', 'PLAN', 'START', 'EXPIRY', 'STATUS', 'FAILS', 'LOCK_UNTIL', 'TOKEN_HASH', 'TOKEN_EXP', 'CREATED_BY', 'LAST_LOGIN'];
function bnxGtSheet_() {
  var ss = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID), sh = ss.getSheetByName(BNX_GST_TRIAL_TAB);
  if (!sh) { sh = ss.insertSheet(BNX_GST_TRIAL_TAB); sh.getRange(1, 1, 1, BNX_GST_TRIAL_COLS.length).setValues([BNX_GST_TRIAL_COLS]).setFontWeight('bold').setBackground('#3d85c6').setFontColor('#ffffff'); sh.setFrozenRows(1); }
  return sh;
}
function bnxGtRows_() { var sh = bnxGtSheet_(), v = sh.getDataRange().getValues(), h = v[0].map(String), rows = [];
  for (var r = 1; r < v.length; r++) { var o = { _r: r + 1 }; h.forEach(function (k, i) { o[k] = v[r][i]; }); rows.push(o); } return { sh: sh, h: h, rows: rows }; }
function bnxGtSet_(T, row, obj) { Object.keys(obj).forEach(function (k) { var c = T.h.indexOf(k); if (c >= 0) T.sh.getRange(row._r, c + 1).setValue(obj[k]); row[k] = obj[k]; }); }
function bnxGtHash_(salt, text) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + '|' + String(text), Utilities.Charset.UTF_8)); }
function bnxGtDate_(d) { return d instanceof Date ? d : new Date(d); }
function bnxGtPublicUser_(o) { var exp = bnxGtDate_(o.EXPIRY); return { CLIENT_ID: String(o.CLIENT_ID), USER_ID: String(o.USER_ID), NAME: String(o.NAME), COMPANY: String(o.COMPANY), GSTIN: String(o.GSTIN || ''), ROLE: String(o.ROLE), PLAN: String(o.PLAN), EXPIRY: exp.toISOString(), DAYS_LEFT: Math.max(0, Math.ceil((exp.getTime() - Date.now()) / 864e5)) }; }
function bnxGtIssue_(T, row) {
  var token = 'GT.' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  bnxGtSet_(T, row, { TOKEN_HASH: bnxGtHash_('tok', token), TOKEN_EXP: new Date(Date.now() + 30 * 864e5), LAST_LOGIN: new Date(), FAILS: 0, LOCK_UNTIL: '' });
  return token;
}
function bnxGstTrialPublic_(action, p) {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { success: false, error: 'Server busy — try again', retryable: true };
  try {
    var T = bnxGtRows_();
    if (action === 'GST_TRIAL_LOGOUT') { var th = bnxGtHash_('tok', String(p.sessionToken || '')); T.rows.forEach(function (o) { if (String(o.TOKEN_HASH) === th) bnxGtSet_(T, o, { TOKEN_HASH: '', TOKEN_EXP: '' }); }); return { success: true }; }
    var login = String(p.email || p.loginId || '').trim().toLowerCase(), pass = String(p.password || '');
    var mob = login.replace(/\D/g, '').slice(-10), byMobile = action === 'GST_TRIAL_LOGIN' && /^[6-9]\d{9}$/.test(mob) && !/@/.test(login);
    if (!byMobile && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(login)) return { success: false, error: 'Enter a valid e-mail' + (action === 'GST_TRIAL_LOGIN' ? ' or mobile number' : '') };
    if (action === 'GST_TRIAL_LOGIN') {
      /* 2026-11-19: sign in with the e-mail OR the mobile number given at sign-up */
      var u = T.rows.filter(function (o) { return byMobile ? (String(o.MOBILE).replace(/\D/g, '').slice(-10) === mob && String(o.STATUS).toUpperCase() !== 'REMOVED') : String(o.LOGIN_ID).toLowerCase() === login; })[0];
      if (!u) return { success: false, error: byMobile ? 'No GST trial with this mobile' : 'Wrong e-mail or password', noTrial: byMobile };
      if (u.LOCK_UNTIL && bnxGtDate_(u.LOCK_UNTIL).getTime() > Date.now()) return { success: false, error: 'Too many wrong passwords — try again after 15 minutes' };
      if (bnxGtHash_(u.SALT, pass) !== String(u.PASS_HASH)) { var f = Number(u.FAILS || 0) + 1; bnxGtSet_(T, u, { FAILS: f, LOCK_UNTIL: f >= 5 ? new Date(Date.now() + 15 * 60000) : '' }); return { success: false, error: 'Wrong e-mail or password' }; }
      if (String(u.STATUS).toUpperCase() !== 'ACTIVE') return { success: false, error: 'This login is suspended — contact Balaji NextGen' };
      var token = bnxGtIssue_(T, u), info = bnxGtPublicUser_(u);
      return { success: true, data: { token: token, user: info, expired: info.DAYS_LEFT <= 0 } };
    }
    /* GST_SIGNUP */
    var name = String(p.name || '').trim().slice(0, 60), company = String(p.company || '').trim().slice(0, 80), mobile = String(p.mobile || '').replace(/\D/g, '').slice(-10), gstin = String(p.gstin || '').toUpperCase().trim();
    if (name.length < 2 || company.length < 2) return { success: false, error: 'Enter your name and firm name' };
    if (!/^[6-9]\d{9}$/.test(mobile)) return { success: false, error: 'Enter a valid 10-digit mobile number' };
    if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return { success: false, error: 'GSTIN format is not valid (or leave it empty)' };
    if (pass.length < 8 || !/\d/.test(pass) || !/[A-Za-z]/.test(pass)) return { success: false, error: 'Password: at least 8 characters with letters and numbers' };
    if (T.rows.some(function (o) { return String(o.LOGIN_ID).toLowerCase() === login; })) return { success: false, error: 'This e-mail already has an account — sign in instead' };
    if (T.rows.some(function (o) { return String(o.MOBILE) === mobile && String(o.ROLE) === 'OWNER'; })) return { success: false, error: 'This mobile already has a trial — sign in, or contact us to extend it' };
    var hourAgo = Date.now() - 3600000; if (T.rows.filter(function (o) { return o.START && bnxGtDate_(o.START).getTime() > hourAgo && String(o.ROLE) === 'OWNER'; }).length >= 30) return { success: false, error: 'Too many sign-ups right now — please try again in an hour' };
    var maxN = 0; T.rows.forEach(function (o) { var m = String(o.CLIENT_ID).match(/^GT(\d+)$/); if (m) maxN = Math.max(maxN, Number(m[1])); });
    var cid = 'GT' + String(maxN + 1).padStart(6, '0'), salt = Utilities.getUuid(), now = new Date(), exp = new Date(now.getTime() + BNX_GST_TRIAL_DAYS * 864e5);
    var rowVals = { CLIENT_ID: cid, USER_ID: cid + '-U1', LOGIN_ID: login, NAME: name, MOBILE: mobile, COMPANY: company, GSTIN: gstin, ROLE: 'OWNER', SALT: salt, PASS_HASH: bnxGtHash_(salt, pass), PLAN: 'TRIAL', START: now, EXPIRY: exp, STATUS: 'ACTIVE', FAILS: 0, LOCK_UNTIL: '', TOKEN_HASH: '', TOKEN_EXP: '', CREATED_BY: 'SIGNUP', LAST_LOGIN: '' };
    T.sh.appendRow(T.h.map(function (k) { return rowVals[k] !== undefined ? rowVals[k] : ''; }));
    var T2 = bnxGtRows_(), me = T2.rows.filter(function (o) { return String(o.LOGIN_ID).toLowerCase() === login; })[0], tok = bnxGtIssue_(T2, me);
    try { bnxTrackClient_({ clientId: cid, company: company, owner: name, email: login, mobile: mobile, gstin: gstin, industry: 'GST', plan: 'TRIAL', start: now, expiry: exp, modules: 'GST', loginId: login, by: 'GST_SIGNUP', role: 'OWNER' }); } catch (e) { console.warn('[track] ' + e.message); }
    try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'New GST trial: ' + company + ' (' + cid + ')', name + '\n' + company + '\nMobile: ' + mobile + '\nE-mail: ' + login + '\nGSTIN: ' + (gstin || '—') + '\nTrial till: ' + Utilities.formatDate(exp, 'Asia/Kolkata', 'dd-MM-yyyy')); } catch (e) {}
    return { success: true, data: { token: tok, user: bnxGtPublicUser_(me), created: true } };
  } finally { lock.releaseLock(); }
}
function bnxGstTrialSession_(token) {
  var th = bnxGtHash_('tok', token), T = bnxGtRows_(), u = T.rows.filter(function (o) { return String(o.TOKEN_HASH) === th; })[0];
  if (!u || !u.TOKEN_EXP || bnxGtDate_(u.TOKEN_EXP).getTime() < Date.now()) return { ok: false, code: 401, error: 'Invalid or expired session' };
  if (String(u.STATUS).toUpperCase() !== 'ACTIVE') return { ok: false, code: 403, error: 'This login is suspended' };
  var own = T.rows.filter(function (o) { return String(o.CLIENT_ID) === String(u.CLIENT_ID) && String(o.ROLE) === 'OWNER'; })[0] || u;
  if (bnxGtDate_(own.EXPIRY).getTime() < Date.now()) return { ok: false, code: 402, error: 'TRIAL_ENDED: your free trial has ended — contact Balaji NextGen to activate' };
  return { ok: true, session: { CLIENT_ID: String(u.CLIENT_ID), USER_ID: String(u.USER_ID), USER_NAME: String(u.NAME), ROLE: String(u.ROLE) === 'OWNER' ? 'OWNER' : String(u.ROLE), TRIAL: String(own.PLAN) === 'TRIAL', PLAN: String(own.PLAN), EXPIRY: bnxGtDate_(own.EXPIRY).toISOString() } };
}
function bnxGstTeam_(session, p, mode) {
  if (!/^GT\d+$/.test(String(session.CLIENT_ID))) return { success: false, error: 'ERP logins are managed in ERP › User Control' };
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { success: false, error: 'Server busy', retryable: true };
  try {
    var T = bnxGtRows_(), mine = T.rows.filter(function (o) { return String(o.CLIENT_ID) === String(session.CLIENT_ID); });
    if (mode === 'LIST') return { success: true, data: { users: mine.map(function (o) { return { USER_ID: String(o.USER_ID), NAME: String(o.NAME), LOGIN_ID: String(o.LOGIN_ID), ROLE: String(o.ROLE), STATUS: String(o.STATUS), LAST_LOGIN: o.LAST_LOGIN ? bnxGtDate_(o.LAST_LOGIN).toISOString() : '' }; }) } };
    if (String(session.ROLE) !== 'OWNER') return { success: false, error: 'Only the owner can add or remove users' };
    if (mode === 'REMOVE') { var u = mine.filter(function (o) { return String(o.USER_ID) === String(p.userId) && String(o.ROLE) !== 'OWNER'; })[0]; if (!u) return { success: false, error: 'User not found' }; bnxGtSet_(T, u, { STATUS: 'REMOVED', TOKEN_HASH: '', TOKEN_EXP: '' }); return { success: true }; }
    var login = String(p.email || '').trim().toLowerCase(), pass = String(p.password || ''), name = String(p.name || '').trim().slice(0, 60), role = /^(ACCOUNTANT|VIEWER)$/.test(String(p.role || '').toUpperCase()) ? String(p.role).toUpperCase() : 'ACCOUNTANT';
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(login) || name.length < 2) return { success: false, error: 'Enter name and a valid e-mail' };
    if (pass.length < 8 || !/\d/.test(pass) || !/[A-Za-z]/.test(pass)) return { success: false, error: 'Password: at least 8 characters with letters and numbers' };
    if (T.rows.some(function (o) { return String(o.LOGIN_ID).toLowerCase() === login; })) return { success: false, error: 'This e-mail already has a login' };
    if (mine.filter(function (o) { return String(o.STATUS) === 'ACTIVE'; }).length >= 10) return { success: false, error: 'Up to 10 users per account' };
    var own = mine.filter(function (o) { return String(o.ROLE) === 'OWNER'; })[0], salt = Utilities.getUuid();
    var vals = { CLIENT_ID: session.CLIENT_ID, USER_ID: session.CLIENT_ID + '-U' + (mine.length + 1), LOGIN_ID: login, NAME: name, MOBILE: '', COMPANY: own ? own.COMPANY : '', GSTIN: '', ROLE: role, SALT: salt, PASS_HASH: bnxGtHash_(salt, pass), PLAN: own ? own.PLAN : 'TRIAL', START: new Date(), EXPIRY: own ? own.EXPIRY : '', STATUS: 'ACTIVE', FAILS: 0, CREATED_BY: session.USER_ID };
    T.sh.appendRow(T.h.map(function (k) { return vals[k] !== undefined ? vals[k] : ''; }));
    return { success: true, data: { userId: vals.USER_ID } };
  } finally { lock.releaseLock(); }
}
function bnxGstTrialAdmin_(session, p) {
  var op = String(p.op || 'LIST').toUpperCase(), T = bnxGtRows_();
  if (op === 'LIST') return { success: true, data: { accounts: T.rows.filter(function (o) { return String(o.ROLE) === 'OWNER'; }).map(function (o) { var x = bnxGtPublicUser_(o); x.LOGIN_ID = String(o.LOGIN_ID); x.MOBILE = String(o.MOBILE); x.STATUS = String(o.STATUS); x.START = o.START ? bnxGtDate_(o.START).toISOString() : ''; x.USERS = T.rows.filter(function (r) { return String(r.CLIENT_ID) === String(o.CLIENT_ID) && String(r.STATUS) === 'ACTIVE'; }).length; return x; }) } };
  var own = T.rows.filter(function (o) { return String(o.CLIENT_ID) === String(p.clientId) && String(o.ROLE) === 'OWNER'; })[0]; if (!own) return { success: false, error: 'Account not found' };
  var days = Math.max(1, Math.min(3650, Number(p.days) || (op === 'ACTIVATE' ? 365 : 7))), base = Math.max(Date.now(), bnxGtDate_(own.EXPIRY).getTime());
  if (op === 'EXTEND') bnxGtSet_(T, own, { EXPIRY: new Date(base + days * 864e5) });
  else if (op === 'ACTIVATE') bnxGtSet_(T, own, { PLAN: 'PAID', EXPIRY: new Date(base + days * 864e5), STATUS: 'ACTIVE' });
  else if (op === 'SUSPEND') T.rows.filter(function (o) { return String(o.CLIENT_ID) === String(p.clientId); }).forEach(function (o) { bnxGtSet_(T, o, { STATUS: 'SUSPENDED', TOKEN_HASH: '', TOKEN_EXP: '' }); });
  else if (op === 'RESUME') T.rows.filter(function (o) { return String(o.CLIENT_ID) === String(p.clientId) && String(o.STATUS) === 'SUSPENDED'; }).forEach(function (o) { bnxGtSet_(T, o, { STATUS: 'ACTIVE' }); });
  else return { success: false, error: 'op must be LIST, EXTEND, ACTIVATE, SUSPEND or RESUME' };
  return { success: true, data: bnxGtPublicUser_(own) };
}
