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
var BNX_FINAL_BUILD = 'GS-2026.11.26-v46';

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
    LOCATION_DEPT_CFG: function (s, p) { return bnxLocDeptCfgAction_(s, p || {}); },
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
    /* ERP Control Centre (super admin only): every company's KPIs, and one company's dashboard */
    ADMIN_CONTROL_OVERVIEW: function (s, p) { return bnxAdm_(s, function () { return bnxAdmOverview_(s, p || {}); }); },
    ADMIN_CLIENT_DASH: function (s, p) { return bnxAdm_(s, function () { return bnxAdmClientDash_(s, p || {}); }); },
    ADMIN_SHEET_VIEW: function (s, p) { return bnxAdm_(s, function () { return bnxAdmSheetView_(s, p || {}); }); },
    ADMIN_SUBS_LIST: function (s, p) { return bnxAdm_(s, function () { return bnxSubsList_(s); }); },
    ADMIN_SUBS_SAVE: function (s, p) { return bnxAdm_(s, function () { return bnxSubsSave_(s, p || {}); }); },
    ADMIN_SUBS_EXTEND: function (s, p) { return bnxAdm_(s, function () { return bnxSubsExtend_(s, p || {}); }); },
    ADMIN_SUBS_PAYMENTS: function (s, p) { return bnxAdm_(s, function () { return bnxSubsPayments_(s, p || {}); }); },
    ADMIN_ACT_AS: function (s, p) { return bnxAdm_(s, function () { return bnxAdmActAs_(s, p || {}); }); },
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
    /* GST page: GSTIN / address / state of Tally and 2B parties filled into SUPPLIER_MASTER / CUSTOMER_MASTER (empty cells only) */
    GST_MASTER_SYNC: function (s, p) { return bnxGstMasterSync_(s, p); },
    /* Purchase › Payment Advice: bill links + supplier ledgers from the client's Google sheet (CL00010 Siliguri / CL00011 Kolkata) */
    SHEET_LINKS_SYNC: function (s, p) { return bnxSheetLinksSync_(s, p); },
    /* GST page: HSN + GST rate of ERP items (Hashfreezer 40 %, liquor non-GST, HSN by rate) — preview / apply */
    GST_ITEM_TAX_FIX: function (s, p) { return bnxGstItemTaxFix_(s, p); },
    /* GST page: Excel / PDF report → Drive (mapped folder › GST Reports › FY › report) */
    GST_FILE_SAVE: function (s, p) { return bnxGstFileSave_(s, p); },
    /* GST page › Data source "Live from ERP": sales (BILL_MASTER) + purchases (PURCHASE_INVOICE) of one month — gst-live.gs */
    GST_LIVE_DATA: function (s, p) { return bnxGstLive_(s, p); },
    GST_TEAM_LIST: function (s, p) { return bnxGstTeam_(s, p, 'LIST'); },
    GST_TEAM_ADD: function (s, p) { return bnxGstTeam_(s, p, 'ADD'); },
    GST_TEAM_REMOVE: function (s, p) { return bnxGstTeam_(s, p, 'REMOVE'); },
    GST_TRIAL_ADMIN: function (s, p) { return bnxAdm_(s, function () { return bnxGstTrialAdmin_(s, p); }); },
    GG_WA_MANUAL_LIST: function (s, p) { return bnxWaManualList_(s, p); },
    GG_WA_MANUAL_LOG: function (s, p) { return bnxWaManualLog_(s, p); },
    QZ_TRUST_GET: function (s, p) { return bnxQzTrustGet_(s, p); },
    SVC_INV_LIST: function (s, p) { return bnxSvcList_(s, p); },      /* v40: service invoices B2B (service-invoice.gs) */
    SVC_INV_SAVE: function (s, p) { return bnxSvcSave_(s, p); },
    SVC_INV_CANCEL: function (s, p) { return bnxSvcCancel_(s, p); },
    AGG_PAYOUT_UPLOAD: function (s, p) { return bnxAggUpload_(s, p); },     /* v43: online payout reco (agg-reco.gs) */
    AGG_RECO: function (s, p) { return bnxAggReco_(s, p); },
    AGG_PAYOUT_FILES: function (s, p) { return bnxAggFiles_(s, p); },
    /* v46: bank sheets + Sweep sync → TRANSACTION DB, collection reco 6 am → 6 am, bill links */
    GET_COLL_RECO: function (s, p) { return bnxCollReco_(s, p); },
    COLL_LINK_SAVE: function (s, p) { return bnxCollLinkSave_(s, p); },
    RECO_CFG_GET: function (s, p) { return bnxRecoCfgGet_(s, p || {}); },
    RECO_CFG_SAVE: function (s, p) { return bnxRecoCfgSave_(s, p || {}); },
    RECO_BANK_TYPE_SAVE: function (s, p) { return bnxRecoMarkSave_(s, p || {}, 'type'); },
    RECO_EXC_SAVE: function (s, p) { return bnxRecoMarkSave_(s, p || {}, 'exc'); },
    RECO_DAY_SET: function (s, p) { return bnxRecoDaySet_(s, p || {}); },
    RECO_LOCK: function (s, p) { return bnxRecoLock_(s, p || {}); },
    RECO_DUE_CUSTOMERS: function (s, p) { return bnxRecoDueCust_(s, p || {}); },
    RECO_DUE_RECEIVE: function (s, p) { return bnxRecoDueReceive_(s, p || {}); },
    RECO_ADVANCE: function (s, p) { return bnxRecoAdvance_(s, p || {}); },
    SWIFT_UPLOAD_SAVE: function (s, p) { return bnxSwiftUploadSave_(s, p || {}); },
    BANK_UPLOAD_SAVE: function (s, p) { return bnxBankUploadSave_(s, p || {}); },
    RECO_DATA_STATUS: function (s, p) { return bnxRecoDataStatus_(s, p || {}); },
    LANDING_EXTRA_GET: function (s, p) { return bnxLandingExtraAction_(s, p || {}, false); },
    LANDING_EXTRA_SAVE: function (s, p) { return bnxLandingExtraAction_(s, p || {}, true); },
    CRM_DATA: function (s, p) { return bnxCrmData_(s, p || {}); },
    MENU_AR_PLATE_SAVE: function (s, p) { return bnxArPlateSave_(s, p || {}); },
    WA_AUTO_GET: function (s, p) { return bnxWaAutoAction_(s, p || {}, 'GET'); },
    WA_AUTO_SAVE: function (s, p) { return bnxWaAutoAction_(s, p || {}, 'SAVE'); },
    WA_AUTO_TEMPLATES: function (s, p) { return bnxWaAutoAction_(s, p || {}, 'TEMPLATES'); },
    WA_AUTO_TEST: function (s, p) { return bnxWaAutoAction_(s, p || {}, 'TEST'); },
    GET_CRM_CUSTOMERS: function (s, p) { return bnxCrmRows_(s, p || {}, 'GUEST_CRM', ['MASTER', 'CRM', 'TRANSACTION'], ['LAST_VISIT', 'UPDATED_AT', 'CREATED_AT']); },
    GET_CRM_TRANSACTIONS: function (s, p) { return bnxCrmRows_(s, p || {}, 'GUEST_TRANSACTIONS', ['TRANSACTION', 'CRM', 'MASTER'], ['DATE_TIME', 'CREATED_AT']); },
    BANK_SYNC_CFG: function (s, p) { return bnxBsCfgAction_(s, p); },
    BANK_SYNC_RUN: function (s, p) { return bnxBsRunAction_(s, p); }
  };
  var FN = { RECIPE_COSTING_LIST: 'bnxRecipeCostingList_', RECIPE_SAVE: 'bnxRecipeSave_', RECIPE_DELETE: 'bnxRecipeDelete_', FOOD_COST_REPORT: 'bnxFoodCostReport_',
    WASTAGE_SAVE: 'bnxWastageSave_', RECIPE_COSTING_REFRESH: 'bnxRecipeCostingRefresh_', RECIPE_AUTO_DRAFT: 'bnxRecipeAutoDraft_', PURCHASE_BILLS_SETTLE: 'bnxPurchaseBillsSettle_',
    GET_PURCHASE_PAYMENTS: 'bnxGetPurchasePayments_' };
  FN.LOCATION_STOCK = 'bnxLocationStock_'; FN.LOCATION_DEPT_CFG = 'bnxLocDeptCfgAction_'; FN.LEDGER_LINK_SAVE = 'bnxLedgerLinkSave_'; FN.LEDGER_LINK_LIST = 'bnxLedgerLinkList_'; FN.TALLY_MARK_STATUS = 'bnxTallyStatusSet_'; FN.TALLY_ENQUEUE = 'bnxTallyStatusSet_'; FN.TALLY_PULL_PENDING = 'bnxTallyPullPending_'; FN.TALLY_STATUS_LIST = 'bnxTallyStatusList_'; FN.TALLY_LEDGER_MAP = 'bnxTallyLedgerMap_'; FN.PURCHASE_BILLNO_SET = 'bnxPurchaseBillNoSet_'; FN.TALLY_PR_IMPORT = 'bnxTallyPrImport_'; FN.TALLY_PR_LIST = 'bnxTallyPrList_'; FN.GSTIN_LOOKUP = 'bnxGstinLookup_'; FN.BILL_LINK_REMOVE = 'bnxBillLinkRemove_'; FN.CREATE_CLIENT = 'bnxCreateClientWizard_';
  FN.INDUSTRY_LIST = 'bnxIndustryList_'; FN.INDUSTRY_SEED = 'bnxIndustryAction_'; FN.QPOS_CONFIG = 'bnxQposConfig_'; FN.QPOS_SAVE = 'bnxQposSave_'; FN.WA_CRM_SAVE = 'bnxWaCrmSave_'; FN.GG_WA_MANUAL_LIST = 'bnxWaManualList_'; FN.GG_WA_MANUAL_LOG = 'bnxWaManualLog_'; FN.GST_CLOUD_SAVE = 'bnxGstCloud_'; FN.GST_CLOUD_LOAD = 'bnxGstCloud_'; FN.GST_CLOUD_LIST = 'bnxGstCloud_'; FN.GST_SHEET_SYNC = 'bnxGstSheetSync_'; FN.GST_MASTER_SYNC = 'bnxGstMasterSync_'; FN.SHEET_LINKS_SYNC = 'bnxSheetLinksSync_'; FN.GST_ITEM_TAX_FIX = 'bnxGstItemTaxFix_'; FN.GST_FILE_SAVE = 'bnxGstFileSave_'; FN.GST_LIVE_DATA = 'bnxGstLive_'; FN.GST_TEAM_LIST = 'bnxGstTeam_'; FN.GST_TEAM_ADD = 'bnxGstTeam_'; FN.GST_TEAM_REMOVE = 'bnxGstTeam_'; FN.GST_TRIAL_ADMIN = 'bnxAdm_';
  ['ADMIN_ACT_AS','ADMIN_CONTROL_OVERVIEW','ADMIN_CLIENT_DASH','ADMIN_SHEET_VIEW','ADMIN_SUBS_LIST','ADMIN_SUBS_SAVE','ADMIN_SUBS_EXTEND','ADMIN_SUBS_PAYMENTS','GET_ALL_CLIENTS','DELETE_CLIENT','CHECK_DB_HEALTH','MIGRATE_CLIENT_DB','UPGRADE_ALL_CLIENTS','GET_ALL_USERS','UPDATE_USER','DELETE_USER','BULK_USER_OP','CREATE_USER','GET_SESSIONS','KILL_SESSION','KILL_ALL_SESSIONS','DB_TOOL'].forEach(function (a) { FN[a] = 'bnxAdm_'; });
  FN.GET_ROLE_ACCESS = 'bnxRoleAccessGet_'; FN.SAVE_ROLE_ACCESS = 'bnxRoleAccessSave_'; FN.MENU_AR_ADMIN_LIST = 'bnxMenuArAdminList_'; FN.MENU_AR_PHOTO_UPLOAD = 'bnxMenuArPhotoUpload_'; FN.MENU_BOOK_ADMIN = 'bnxMenuBookAdmin_'; FN.MENU_BOOK_PAGE_SAVE = 'bnxMenuBookPageSave_'; FN.MENU_BOOK_PAGE_DELETE = 'bnxMenuBookPageDelete_'; FN.MENU_BOOK_ORDER = 'bnxMenuBookOrder_'; FN.MENU_BOOK_META_SAVE = 'bnxMenuBookMetaSave_'; FN.MENU_AR_SAVE = 'bnxMenuArSave_'; FN.MENU_AR_IMPORT = 'bnxMenuArImport_'; FN.MENU_AR_SHEET_IMPORT = 'bnxMenuArSheetImport_';   /* menu-ar.gs */
  FN.QZ_TRUST_GET = 'bnxQzTrustGet_'; FN.SVC_INV_LIST = 'bnxSvcList_'; FN.SVC_INV_SAVE = 'bnxSvcSave_'; FN.SVC_INV_CANCEL = 'bnxSvcCancel_'; FN.AGG_PAYOUT_UPLOAD = 'bnxAggUpload_'; FN.AGG_RECO = 'bnxAggReco_'; FN.AGG_PAYOUT_FILES = 'bnxAggFiles_'; FN.GET_COLL_RECO = 'bnxCollReco_'; FN.CRM_DATA = 'bnxCrmData_'; FN.MENU_AR_PLATE_SAVE = 'bnxArPlateSave_'; FN.LANDING_EXTRA_GET = 'bnxLandingExtraAction_'; FN.LANDING_EXTRA_SAVE = 'bnxLandingExtraAction_'; FN.WA_AUTO_GET = 'bnxWaAutoAction_'; FN.WA_AUTO_SAVE = 'bnxWaAutoAction_'; FN.WA_AUTO_TEMPLATES = 'bnxWaAutoAction_'; FN.WA_AUTO_TEST = 'bnxWaAutoAction_'; FN.RECO_CFG_GET = 'bnxRecoCfgGet_'; FN.RECO_CFG_SAVE = 'bnxRecoCfgSave_'; FN.RECO_BANK_TYPE_SAVE = 'bnxRecoMarkSave_'; FN.RECO_EXC_SAVE = 'bnxRecoMarkSave_'; FN.RECO_DAY_SET = 'bnxRecoDaySet_'; FN.RECO_LOCK = 'bnxRecoLock_'; FN.RECO_DUE_CUSTOMERS = 'bnxRecoDueCust_'; FN.RECO_DUE_RECEIVE = 'bnxRecoDueReceive_'; FN.RECO_ADVANCE = 'bnxRecoAdvance_'; FN.SWIFT_UPLOAD_SAVE = 'bnxSwiftUploadSave_'; FN.COLL_LINK_SAVE = 'bnxCollLinkSave_'; FN.BANK_SYNC_CFG = 'bnxBsCfgAction_'; FN.BANK_SYNC_RUN = 'bnxBsRunAction_';
  ['REQUEST_WAITER_CALL', 'VALIDATE_COUPON', 'GET_LOYALTY', 'FIRE_COURSE', 'GET_HAPPY_HOUR'].forEach(function (action) {
    ACT[action] = function (s, p) { return bnxStewardAddon_(s, p); };
    FN[action] = 'bnxStewardAddon_';
  });
  ACT.QZ_SIGN = function (s, p) { return bnxQzSignRequest_(s, p); };
  FN.QZ_SIGN = 'bnxQzSignRequest_';
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
      try { return out(action === 'MENU_AR_PHOTO' ? bnxMenuArPhoto_(payload) : bnxArWithPlates_(bnxMenuArPublic_(payload), payload)); } catch (err) { return out({ success: false, error: String(err && err.message || err) }); }
    }

    /* v42 (2026-11-25): POS cloud backup (PosCloudSync.gs) — POS_PING / POS_PULL / POS_PUSH carry their own client id + sync key
       (no ERP login); before this they reached the ERP router and came back "Unknown action". */
    /* v43: online platform payouts from the restaurant's Gmail reader (agg-mail-reader.gs) — own sync key, no ERP login */
    if (action === 'AGG_MAIL_PUSH') {
      if (typeof bnxAggMailPush_ !== 'function') return out({ success: false, error: 'agg-reco.gs not in this project' });
      try { return out(bnxAggMailPush_(payload)); } catch (err) { return out({ success: false, error: String(err && err.message || err) }); }
    }
    if (/^POS_/.test(action)) {
      if (typeof bnxPosHandle_ !== 'function') return out({ success: false, error: 'PosCloudSync.gs not in this project' });
      try { return out(bnxPosHandle_(payload)); } catch (err) { return out({ success: false, error: String(err && err.message || err) }); }
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

    /* v44: deleting an invoice = SUPER_ADMIN / DEVELOPER only (ADMIN and others can only Cancel = VOID_BILL) */
    if (action === 'DELETE_INVOICE') {
      try {
        var dSes = bnxVerifySession(String(payload.sessionToken || ''), String(payload.clientId || ''));
        if (dSes && dSes.__transient) return out({ success: false, error: 'SERVER_BUSY', message: 'Server busy - please retry', retryable: true, statusCode: 503 });
        if (!dSes) return out({ success: false, statusCode: 401, error: 'Invalid or expired session', message: 'Invalid or expired session' });
        var dRole = String(dSes.ROLE || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
        if (dRole !== 'SUPER_ADMIN' && dRole !== 'DEVELOPER') return out({ success: false, statusCode: 403, error: 'SUPER_ADMIN_ONLY', message: 'Only Super Admin can delete an invoice. Use Cancel instead.' });
      } catch (err) { return out({ success: false, error: String(err && err.message || err) }); }
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
    if (action === 'GG_CFG_GET' || action === 'WA_ES_CONFIG' || action === 'GG_CFG_SAVE') {
      var g = core(e);
      try {
        var gj = JSON.parse(g.getContent()), cfg = gj && gj.data && (gj.data.cfg || (action === 'GG_CFG_SAVE' ? gj.data : null));
        if (action === 'GG_CFG_GET' && gj && gj.success && cfg && !String(cfg.upiId || '').trim()) {
          var upi = bnxRestaurantUpi_(String(payload.clientId || ''));
          if (upi.vpa) {
            var sv = core({ postData: { contents: JSON.stringify(Object.assign({}, payload, { action: 'GG_CFG_SAVE', cfg: { upiId: upi.vpa, upiName: cfg.upiName || upi.pn } })) } });
            try { var sj = JSON.parse(sv.getContent()); if (sj && sj.success && sj.data) gj.data.cfg = sj.data; else { cfg.upiId = upi.vpa; cfg.upiName = cfg.upiName || upi.pn; } } catch (x) { cfg.upiId = upi.vpa; }
            gj.data.upiFromRestaurant = true;
          }
        }
        /* 2026-11-26 CHECK ALL: the Growth Hub page received the saved WhatsApp access token (data.wa.token) in clear text.
           The page only needs to know whether one is saved → every token / secret / password / key value leaves as true. */
        return out(bnxMaskSecrets_(gj));
      } catch (x) {}
      return g;
    }

    /* the ERP */
    var r = core(e);
    if (action === 'SAVE_BILL' || action === 'SAVE_ORDER') { try { bnxWaAutoHook_(action, payload, r); } catch (x) {} }   /* 2026-11-26 auto WhatsApp: invoice / order confirmation (queued) */
    /* v46: after any import (bills + items, bank, Sweep / Swift, transactions) every DB / report follow-up runs by itself */
    if (BNX_AFTERIMP_RE.test(action)) { try { var ij = JSON.parse(r.getContent()); if (ij && ij.success !== false && !(ij.data && ij.data.dryRun) && !ij.dryRun) { var icid = String(payload.clientId || ''); if (!icid) { var iss = bnxVerifySession(String(payload.sessionToken || ''), ''); icid = String(iss && !iss.__transient && iss.CLIENT_ID || ''); } bnxAfterImportSchedule_(icid, action); } } catch (x) {} }
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
      if (a === 'MENU_AR' && typeof bnxMenuArPublic_ === 'function') return out(bnxArWithPlates_(bnxMenuArPublic_(e.parameter), e.parameter));
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

function bnxCl11Bills_(apply) {   /* same engine as CL00010 (new + changed links, late matches) — 2026-11-20 */
  return bnxSheetBills_({ CID: BNX_CL11.CID, PROP: 'CL11_BILL_SHEET_ID', NAME: BNX_CL11.BILL_NAME, TAB: BNX_CL11.BILL_TAB, TAB_PROP: 'CL11_BILL_TAB' }, apply);
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
    var t = bnxAdmTable_(bnxAdmSheet_('USER_MASTER')), rows = bnxAdmFindUser_(t, uid, String(p.CLIENT_ID || '').trim());   /* 2026-11-20: only that client's user when CLIENT_ID is given (USER_IDs can repeat across clients) */
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
  /* 2026-11-20: a GST client that belongs to ANOTHER ERP company (left open on a shared browser) is never saved into this
     login's cloud folder — "client 11 login but shows client 10 data" */
  if (mode === 'SAVE') { var raw = typeof p.data === 'string' ? p.data.slice(0, 4000) : JSON.stringify((p.data && p.data.client) || {}), mm = raw.match(/"client"\s*:\s*\{[^{}]*?"clientId"\s*:\s*"([^"]+)"/), own = String(session && session.CLIENT_ID || '');
    if (mm && /^CL\d{5,}$/.test(mm[1]) && mm[1] !== own) return { success: false, error: 'This GST client belongs to ' + mm[1] + ' — not saved in ' + own + '. Open your own company in Client Manager.' }; }
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
  /* report tabs (gst.html › Reports): "BNX …" tabs rewritten on every sync — the client's own tabs are never touched */
  var tabsDone = [];
  try { var T = S.tabs || {}; Object.keys(T).slice(0, 16).forEach(function (tn) {
    if (!/^BNX [A-Za-z0-9 .\-]{2,40}$/.test(tn)) return; var rows = T[tn]; if (!Array.isArray(rows) || !rows.length) return; rows = rows.slice(0, 20000);
    var w = rows.reduce(function (a, r) { return Math.max(a, Array.isArray(r) ? r.length : 0); }, 1), vals = rows.map(function (r) { r = Array.isArray(r) ? r.slice(0, 40) : []; while (r.length < w) r.push(''); return r.map(function (v) { return v == null ? '' : (typeof v === 'number' ? v : String(v).slice(0, 500)); }); });
    var sh2 = ss.getSheetByName(tn) || ss.insertSheet(tn); sh2.clear(); if (sh2.getMaxRows() < vals.length + 2) sh2.insertRowsAfter(sh2.getMaxRows(), vals.length + 2 - sh2.getMaxRows()); if (sh2.getMaxColumns() < w) sh2.insertColumnsAfter(sh2.getMaxColumns(), w - sh2.getMaxColumns());
    sh2.getRange(1, 1, vals.length, w).setValues(vals); sh2.getRange(1, 1, 1, w).setBackground(CORAL).setFontColor('#ffffff').setFontWeight('bold').setWrap(true); sh2.setFrozenRows(1);
    try { sh2.getRange(2, 1, Math.max(1, vals.length - 1), w).setNumberFormat('#,##0.00;(#,##0.00)'); } catch (e) {}
    try { if (sh2.getFilter()) sh2.getFilter().remove(); sh2.getRange(1, 1, vals.length, w).createFilter(); } catch (e) {}
    tabsDone.push(tn); }); } catch (e) {}
  /* old report tabs from an earlier layout (e.g. "BNX In 2B only") are removed so the sheet shows only the current set */
  try { if (tabsDone.length) ss.getSheets().forEach(function (x) { var n = x.getName(); if (/^BNX /.test(n) && n !== name && tabsDone.indexOf(n) < 0 && ss.getSheets().length > 1) ss.deleteSheet(x); }); } catch (e) {}
  if (created) { try { var s1 = ss.getSheetByName('Sheet1'); if (s1 && ss.getSheets().length > 1) ss.deleteSheet(s1); } catch (e) {} }
  return { success: true, data: { tab: name, url: url, tabs: tabsDone, sheetUrl: 'https://docs.google.com/spreadsheets/d/' + m[1] + '/edit', created: created } };
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

/* ═══ GST → ERP MASTER DB (2026-11-20 "erp master db auto update gst no and address") ═══════════════════════════════
   gst.html sends the parties it knows (Tally party ledgers: GSTIN, address, state, pincode, PAN; GSTR-2B / books
   suppliers: GSTIN + name). Each one is matched to SUPPLIER_MASTER (suppliers) / CUSTOMER_MASTER (customers) by GSTIN,
   else by name / Tally alias, and only EMPTY cells are filled (GSTIN, ADDRESS, STATE, STATE_CODE, PINCODE, PAN) — typed
   values are never overwritten, except a GSTIN that is not a valid GSTIN. Rows are never added or deleted. When the
   address is still empty and Script property GST_API_URL is set, up to 25 GSTINs per run are looked up (bnxGstinLookup_). */
function bnxGstMasterSync_(session, p) {
  var role = String(session && session.ROLE || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (!/^(SUPER_ADMIN|ADMIN|OWNER|ACCOUNTANT|ACCOUNTS|MANAGER|CA|PURCHASE_MANAGER|STORE_MANAGER)$/.test(role)) return { success: false, error: 'Only admin / accounts logins can update the masters' };
  var cid = String(session.CLIENT_ID || ''), list = Array.isArray(p.parties) ? p.parties.slice(0, 5000) : [];
  if (!cid || !list.length) return { success: true, data: { updated: 0, note: 'No parties sent' } };
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { success: false, error: 'SERVER_BUSY — try again in a minute' };
  var GRE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, norm = function (s) { return String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\b(m\/s|messrs|pvt|private|ltd|limited|llp|co|company|and|&)\b/g, ' ').replace(/[^a-z0-9]/g, ''); };
  var out = { updated: 0, gstinFilled: 0, addressFilled: 0, otherFilled: 0, lookups: 0, matched: 0, sheets: [], notMatched: 0 };
  try {
    [['SUPPLIER_MASTER', 'S'], ['CUSTOMER_MASTER', 'C']].forEach(function (pair) {
      var sh; try { sh = bnxClientSheet(cid, pair[0]); } catch (e) { return; } if (!sh) return;
      var v = sh.getDataRange().getValues(); if (!v.length) return; var h = v[0].map(function (x) { return String(x || '').trim().toUpperCase(); });
      var col = function (names) { for (var i = 0; i < names.length; i++) { var k = h.indexOf(names[i]); if (k >= 0) return k; } return -1; };
      var need = function (name) { var k = h.indexOf(name); if (k >= 0) return k; h.push(name); sh.getRange(1, h.length).setValue(name); v.forEach(function (r) { r.push(''); }); return h.length - 1; };
      var cCid = col(['CLIENT_ID']), cName = col(pair[1] === 'S' ? ['SUPPLIER_NAME', 'VENDOR_NAME', 'NAME', 'PARTY_NAME'] : ['CUSTOMER_NAME', 'NAME', 'PARTY_NAME', 'COMPANY_NAME']);
      if (cName < 0) return;
      var cAlias = col(['ALIAS_NAME', 'TALLY_NAME', 'TALLY_LEDGER', 'LEDGER_NAME']), cG = col(['GSTIN', 'GST_NUMBER', 'GST_NO', 'GSTN']); if (cG < 0) cG = need('GSTIN');
      var cA = col(['ADDRESS', 'ADDRESS_LINE1', 'BILLING_ADDRESS']); if (cA < 0) cA = need('ADDRESS');
      var cSt = col(['STATE', 'STATE_NAME']); if (cSt < 0) cSt = need('STATE');
      var cSc = col(['STATE_CODE']), cPin = col(['PINCODE', 'PIN', 'PIN_CODE']), cPan = col(['PAN', 'PAN_NO']), cCity = col(['CITY']), cUpd = col(['UPDATED_AT', 'LAST_UPDATED', 'MODIFIED_AT']);
      var byG = {}, byN = {};
      for (var r = 1; r < v.length; r++) { if (cCid >= 0 && v[r][cCid] && String(v[r][cCid]) !== cid) continue;
        var g = String(v[r][cG] || '').toUpperCase().trim(); if (GRE.test(g)) byG[g] = byG[g] || r;
        [v[r][cName], cAlias >= 0 ? v[r][cAlias] : ''].forEach(function (n) { var k = norm(n); if (k && !byN[k]) byN[k] = r; }); }
      var changed = {}, touch = function (r, c, val) { if (c < 0 || val == null || String(val).trim() === '') return false; var cur = String(v[r][c] == null ? '' : v[r][c]).trim(); if (cur) return false; v[r][c] = String(val).trim().slice(0, 300); (changed[c] = changed[c] || {})[r] = 1; return true; };
      list.forEach(function (q) {
        if (!q || (q.side && q.side !== pair[1])) return;
        var g = String(q.gstin || '').toUpperCase().trim(), r = GRE.test(g) && byG[g] ? byG[g] : byN[norm(q.name)] || (q.alias ? byN[norm(q.alias)] : 0);
        if (!r) { out.notMatched++; return; } out.matched++; var any = false;
        if (GRE.test(g)) { var cur = String(v[r][cG] || '').toUpperCase().trim(); if (!cur || !GRE.test(cur)) { if (cur !== g) { v[r][cG] = g; (changed[cG] = changed[cG] || {})[r] = 1; out.gstinFilled++; any = true; byG[g] = r; } } }
        if (touch(r, cA, q.address)) { out.addressFilled++; any = true; }
        var gg = GRE.test(String(v[r][cG] || '').toUpperCase()) ? String(v[r][cG]).toUpperCase() : '';
        [[cSt, q.state || (gg && BNX_GST_STATES[gg.slice(0, 2)])], [cSc, gg ? gg.slice(0, 2) : q.stateCode], [cPin, q.pincode], [cPan, q.pan || (gg ? gg.slice(2, 12) : '')], [cCity, q.city]].forEach(function (x) { if (touch(r, x[0], x[1])) { out.otherFilled++; any = true; } });
        if (any && cUpd >= 0) { v[r][cUpd] = new Date(); (changed[cUpd] = changed[cUpd] || {})[r] = 1; }
      });
      /* GST portal search for rows that still have a GSTIN but no address */
      if (PropertiesService.getScriptProperties().getProperty('GST_API_URL')) {
        for (var r2 = 1; r2 < v.length && out.lookups < 25; r2++) { if (cCid >= 0 && v[r2][cCid] && String(v[r2][cCid]) !== cid) continue;
          var g2 = String(v[r2][cG] || '').toUpperCase().trim(); if (!GRE.test(g2) || String(v[r2][cA] || '').trim()) continue;
          var L = null; try { L = bnxGstinLookup_(session, { gstin: g2 }); } catch (e) {} out.lookups++;
          if (L && L.source === 'gst' && touch(r2, cA, L.address)) { out.addressFilled++; touch(r2, cPin, L.pincode); touch(r2, cCity, L.city); if (cUpd >= 0) { v[r2][cUpd] = new Date(); (changed[cUpd] = changed[cUpd] || {})[r2] = 1; } }
        } }
      var rowsTouched = {}; Object.keys(changed).forEach(function (c) { c = +c; var vals = v.slice(1).map(function (row) { return [row[c] == null ? '' : row[c]]; }); if (vals.length) sh.getRange(2, c + 1, vals.length, 1).setValues(vals); Object.keys(changed[c]).forEach(function (r) { rowsTouched[r] = 1; }); });
      var n = Object.keys(rowsTouched).length; out.updated += n; out.sheets.push(pair[0] + ': ' + n + ' row(s) updated');
    });
  } finally { lock.releaseLock(); }
  return { success: true, data: out };
}

/* ═══ BILL LINKS FROM A GOOGLE PURCHASE SHEET — generic, new + changed links (2026-11-20 "syn new update bill link purchase
   to transaction db client 10") ═══════════════════════════════════════════════════════════════════════════════════════
   Sheet rows (Suppliers Name · Bill No · Bill Amount · Items Head · Purchase Date · Attached link) → TRANSACTION_DB ›
   PURCHASE_BILL_LINKS, and the matched PURCHASE_INVOICE gets PURCHASE_HEAD / BILL_NO / BILL_FILE_URL (empty cells, or the
   old link when the bill file was replaced). A row already in PURCHASE_BILL_LINKS (same link, or same supplier + bill no +
   amount) is UPDATED, not added again: new link, purchase found later ("Not matched yet" → matched), head / bill no.
   A link removed in the ERP (MATCH_TYPE = REMOVED) is never brought back. Nothing is deleted. */
function bnxSheetBills_(cfg, apply) {
  var cid = cfg.CID, out = { success: true, apply: apply };
  try {
    var sh = bnxSheetByNameOrProp_(cfg.PROP, cfg.NAME, cfg.TAB, cfg.TAB_PROP);
    var rg = sh.getDataRange(), v = rg.getValues(), dv = rg.getDisplayValues(), rt = rg.getRichTextValues(), fm = rg.getFormulas();
    var K = function (x) { return String(x || '').toLowerCase().replace(/[^a-z]/g, ''); };
    var hr = dv.findIndex(function (r) { return r.some(function (x) { return /^suppliers?name/.test(K(x)); }); }); if (hr < 0) throw new Error('header "Suppliers Name" not found in ' + sh.getName());
    var H = dv[hr].map(K), col = function (re) { return H.findIndex(function (x) { return re.test(x); }); };
    var cS = col(/^suppliers?name/), cB = col(/^billno/), cA = col(/^billamou?n?t|^amount/), cH = col(/itemshead|purchasehead|^head/), cD = col(/purcha?s?e?date|^billdate|^date$/), cL = col(/^attach/);
    if (cL < 0) cL = col(/link|billfile/); if (cL < 0) throw new Error('"Attached" (link) column not found');
    var num = function (raw, disp) { if (typeof raw === 'number') return raw; var t = String(disp || raw || '').trim(), n = Number(t.replace(/[^0-9.]/g, '')) || 0; return /^\(|^-|-\s*₹/.test(t) ? -n : n; };
    var sup = bnxSupNameMap_(cid), rows = [];
    for (var r = hr + 1; r < v.length; r++) {
      var s = String(dv[r][cS] || '').trim(); if (!s) continue;
      var url = bnxCellLink_(rt, fm, r, cL); if (!/^https?:\/\//.test(url)) continue;
      var sp = sup[bnxLpNorm_(s)] || { name: s, id: '' };
      rows.push({ supplier: sp.name, supId: sp.id, billNo: cB >= 0 ? String(dv[r][cB] || '').trim() : '', amount: cA >= 0 ? num(v[r][cA], dv[r][cA]) : 0, head: cH >= 0 ? String(dv[r][cH] || '').trim() : '', date: cD >= 0 ? bnxD_(v[r][cD]) : '', url: url, sheetRow: r + 1 });
    }
    out.linksInSheet = rows.length;
    var tx = SpreadsheetApp.openById(bnxGetClientDbIds_(cid).TRANSACTION);
    /* existing links */
    var BH = ['BILL_LINK_ID', 'CLIENT_ID', 'PURCHASE_INVOICE_ID', 'INVOICE_NO', 'SUPPLIER_NAME', 'BILL_NO', 'BILL_DATE', 'BILL_AMOUNT', 'PURCHASE_HEAD', 'BILL_FILE_URL', 'MATCH_TYPE', 'SOURCE', 'CREATED_AT', 'UPDATED_AT'];
    var bl = tx.getSheetByName('PURCHASE_BILL_LINKS'), bv = bl && bl.getLastRow() > 0 ? bl.getDataRange().getValues() : [BH.slice()], bh = bv[0].map(String);
    BH.forEach(function (k) { if (bh.indexOf(k) < 0) { bh.push(k); bv.forEach(function (r0, i) { r0.push(i ? '' : k); }); } });
    var B = function (k) { return bh.indexOf(k); }, keyOf = function (s, b, a) { return bnxLpNorm_(s) + '|' + bnxLpNorm_(b) + '|' + Math.round(Number(a) || 0); };
    var byUrl = {}, byKey = {}, removed = {}, usedId = {}, maxN = 0;
    for (var j = 1; j < bv.length; j++) { var u0 = String(bv[j][B('BILL_FILE_URL')] || ''), mt = String(bv[j][B('MATCH_TYPE')] || ''), n0 = Number(String(bv[j][B('BILL_LINK_ID')]).replace(/\D/g, '')) || 0; if (n0 > maxN && n0 < 1e7) maxN = n0;
      if (/REMOVED/i.test(mt)) { removed[u0] = 1; continue; } if (u0) byUrl[u0] = j; byKey[keyOf(bv[j][B('SUPPLIER_NAME')], bv[j][B('BILL_NO')], bv[j][B('BILL_AMOUNT')])] = j;
      var pid = String(bv[j][B('PURCHASE_INVOICE_ID')] || ''); if (pid) usedId[pid] = 1; }
    /* purchases */
    var pi = tx.getSheetByName('PURCHASE_INVOICE'), pv = pi && pi.getLastRow() > 1 ? pi.getDataRange().getValues() : [[]], ph = pv[0].map(String), P = function (k) { return ph.indexOf(k); }, inv = [], invById = {};
    for (var i = 1; i < pv.length; i++) { var o = { i: i, id: String(pv[i][P('PURCHASE_INVOICE_ID')] || ''), no: String(pv[i][P('INVOICE_NO')] || ''), sup: bnxLpNorm_(pv[i][P('SUPPLIER_NAME')]), supId: String(pv[i][P('SUPPLIER_ID')] || ''),
        amt: Number(pv[i][P('TOTAL_AMOUNT')]) || 0, date: bnxD_(pv[i][P('INVOICE_DATE')]), billNo: P('BILL_NO') >= 0 ? String(pv[i][P('BILL_NO')] || '') : '' }; if (!o.id) continue; inv.push(o); invById[o.id] = o; }
    var dd = function (a, b) { return a && b ? Math.abs((new Date(a) - new Date(b)) / 864e5) : 99; };
    var findInv = function (x) { var nk = bnxLpNorm_(x.supplier), bn = bnxLpNorm_(x.billNo), hit = null, same = function (p) { return p.sup === nk || (x.supId && p.supId === x.supId); };
      if (bn) hit = inv.filter(function (p) { return !usedId[p.id] && p.billNo && bnxLpNorm_(p.billNo) === bn && same(p); })[0];
      if (hit) return { inv: hit, how: 'Same bill no.' };
      hit = inv.filter(function (p) { return !usedId[p.id] && same(p) && Math.abs(p.amt - x.amount) <= 1 && dd(p.date, x.date) <= 7; }).sort(function (a, b) { return dd(a.date, x.date) - dd(b.date, x.date); })[0];
      return hit ? { inv: hit, how: 'Supplier + amount + date' } : null; };
    var now = new Date().toISOString(), add = [], upd = 0, newMatch = 0, relinked = 0, skippedRemoved = 0, piSet = [];
    rows.forEach(function (x) {
      if (removed[x.url]) { skippedRemoved++; return; }
      var j = byUrl[x.url] !== undefined ? byUrl[x.url] : byKey[keyOf(x.supplier, x.billNo, x.amount)];
      if (j !== undefined) {
        var row = bv[j], ch = false, oldUrl = String(row[B('BILL_FILE_URL')] || ''), pid = String(row[B('PURCHASE_INVOICE_ID')] || '');
        if (oldUrl !== x.url) { row[B('BILL_FILE_URL')] = x.url; ch = true; relinked++; byUrl[x.url] = j; }
        if (!pid) { var m = findInv(x); if (m) { usedId[m.inv.id] = 1; row[B('PURCHASE_INVOICE_ID')] = m.inv.id; row[B('INVOICE_NO')] = m.inv.no; row[B('MATCH_TYPE')] = m.how; pid = m.inv.id; ch = true; newMatch++; } }
        if (!row[B('PURCHASE_HEAD')] && x.head) { row[B('PURCHASE_HEAD')] = x.head; ch = true; } if (!row[B('BILL_NO')] && x.billNo) { row[B('BILL_NO')] = x.billNo; ch = true; }
        if (ch) { row[B('UPDATED_AT')] = now; upd++; }
        if (pid && invById[pid]) piSet.push({ inv: invById[pid], x: x, oldUrl: oldUrl });
        return;
      }
      var m2 = findInv(x); if (m2) { usedId[m2.inv.id] = 1; newMatch++; piSet.push({ inv: m2.inv, x: x, oldUrl: '' }); }
      var o2 = { BILL_LINK_ID: 'BL' + ('0000' + (++maxN)).slice(-5), CLIENT_ID: cid, PURCHASE_INVOICE_ID: m2 ? m2.inv.id : '', INVOICE_NO: m2 ? m2.inv.no : '', SUPPLIER_NAME: x.supplier, BILL_NO: x.billNo, BILL_DATE: x.date,
        BILL_AMOUNT: x.amount, PURCHASE_HEAD: x.head, BILL_FILE_URL: x.url, MATCH_TYPE: m2 ? m2.how : 'Not matched yet', SOURCE: cfg.NAME + ' › ' + sh.getName(), CREATED_AT: now, UPDATED_AT: now };
      add.push(bh.map(function (k) { return o2[k] === undefined ? '' : o2[k]; })); byUrl[x.url] = -1; byKey[keyOf(x.supplier, x.billNo, x.amount)] = -1;
    });
    out.newLinks = add.length; out.updatedLinks = upd; out.linkReplaced = relinked; out.newlyMatched = newMatch; out.removedInErpSkipped = skippedRemoved;
    out.stillNotMatched = bv.slice(1).filter(function (r0) { return !r0[B('PURCHASE_INVOICE_ID')] && !/REMOVED/i.test(String(r0[B('MATCH_TYPE')])); }).length + add.filter(function (r0) { return !r0[B('PURCHASE_INVOICE_ID')]; }).length;
    if (!apply || (!add.length && !upd && !piSet.length)) return out;
    var lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      if (!bl) { bl = tx.insertSheet('PURCHASE_BILL_LINKS'); bl.setFrozenRows(1); }
      var w = bh.length; bv = bv.map(function (r0) { r0 = r0.slice(0, w); while (r0.length < w) r0.push(''); return r0; });
      if (upd || bl.getLastColumn() < w || bl.getLastRow() === 0) bl.getRange(1, 1, bv.length, w).setValues(bv); bl.getRange(1, 1, 1, w).setFontWeight('bold');
      if (add.length) bl.getRange(bv.length + 1, 1, add.length, w).setValues(add);
      /* PURCHASE_INVOICE: head / bill no / bill file (empty, or the old link of a replaced file) */
      if (pi && piSet.length) {
        ['PURCHASE_HEAD', 'BILL_NO', 'BILL_FILE_URL'].forEach(function (k) { if (ph.indexOf(k) < 0) { pi.getRange(1, ph.length + 1).setValue(k).setFontWeight('bold'); ph.push(k); pv.forEach(function (r0, ri) { if (ri) r0.push(''); }); } });
        var c1 = P('PURCHASE_HEAD'), c2 = P('BILL_NO'), c3 = P('BILL_FILE_URL'), dirty = {}, pu = 0;
        piSet.forEach(function (s) { var r0 = pv[s.inv.i], ch = false;
          if (!r0[c1] && s.x.head) { r0[c1] = s.x.head; dirty[c1] = ch = true; } if (!r0[c2] && s.x.billNo) { r0[c2] = s.x.billNo; dirty[c2] = ch = true; }
          if (!r0[c3] || (s.oldUrl && String(r0[c3]) === s.oldUrl && s.oldUrl !== s.x.url)) { if (String(r0[c3]) !== s.x.url) { r0[c3] = s.x.url; dirty[c3] = ch = true; } }
          if (ch) pu++; });
        [c1, c2, c3].forEach(function (c) { if (dirty[c]) pi.getRange(2, c + 1, pv.length - 1, 1).setValues(pv.slice(1).map(function (r0) { return [r0[c] === undefined ? '' : r0[c]]; })); });
        out.purchasesUpdated = pu;
      }
    } finally { lock.releaseLock(); }
  } catch (e) { out = { success: false, error: String(e && e.message || e) }; }
  return out;
}

/* ═══ CL00010 (HASHTAG SILIGURI) — "FY 25-27 Hashtag Siliguri": tab Purchase (bill links) + tab Print (supplier ledgers,
   e.g. "Attach bills & Ledger Oct26") → CL00010 TRANSACTION_DB, kept in sync automatically.
   Run once: RUN_CL10_1_Check (reads only) → RUN_CL10_2_SyncNow → RUN_CL10_3_AutoOn.
   Auto: an edit in the Purchase / Print tab is synced within ~10 minutes; a full check runs every 6 hours anyway.
   ERP: Purchase › Payment Advice › "🔄 Sync bills & ledgers" (action SHEET_LINKS_SYNC) runs it at once.
   Other file / tab: Script properties CL10_SHEET_ID / CL10_BILL_TAB (ledgers: LEDGER_PRINT_SHEET_ID / LEDGER_PRINT_TAB). ═══ */
var BNX_CL10 = { CID: 'CL00010', PROP: 'CL10_SHEET_ID', NAME: 'FY 25-27 Hashtag Siliguri', TAB: 'Purchase', TAB_PROP: 'CL10_BILL_TAB' };
function RUN_CL10_1_Check() { Logger.log(JSON.stringify({ bills: bnxSheetBills_(BNX_CL10, false), ledgers: bnxLpBrief_(bnxLedgerFromPrint_(BNX_CL10.CID, false)) }, null, 1)); }
function RUN_CL10_2_SyncNow() { Logger.log(JSON.stringify(bnxCl10Sync_('manual'), null, 1)); }
function RUN_CL10_3_AutoOn() {
  RUN_CL10_4_AutoOff();
  ScriptApp.newTrigger('bnxCl10Auto_').timeBased().everyMinutes(10).create();
  var msg = 'Auto sync ON: every 10 min (only when the sheet was edited) + full check every 6 h.';
  try { var id = PropertiesService.getScriptProperties().getProperty(BNX_CL10.PROP) || bnxSheetByNameOrProp_(BNX_CL10.PROP, BNX_CL10.NAME, BNX_CL10.TAB, BNX_CL10.TAB_PROP).getParent().getId();
    ScriptApp.newTrigger('bnxCl10OnEdit_').forSpreadsheet(id).onEdit().create(); ScriptApp.newTrigger('bnxCl10OnEdit_').forSpreadsheet(id).onChange().create(); msg += ' Edit watch on the sheet: ON.'; }
  catch (e) { msg += ' Edit watch not set (' + e.message + ') — the 6-hour check still runs.'; }
  Logger.log(msg);
}
function RUN_CL10_4_AutoOff() { ScriptApp.getProjectTriggers().forEach(function (t) { if (/^bnxCl10(Auto|OnEdit)_$/.test(t.getHandlerFunction())) ScriptApp.deleteTrigger(t); }); }
function bnxCl10OnEdit_(e) {
  try { var n = e && e.range ? e.range.getSheet().getName() : (e && e.source ? 'any' : ''); var bt = PropertiesService.getScriptProperties().getProperty(BNX_CL10.TAB_PROP) || BNX_CL10.TAB, lt = PropertiesService.getScriptProperties().getProperty('LEDGER_PRINT_TAB') || BNX_LP.TAB;
    if (n === 'any' || n === bt || n === lt) PropertiesService.getScriptProperties().setProperty('CL10_DIRTY', String(Date.now())); } catch (x) {}
}
function bnxCl10Auto_() {
  var P = PropertiesService.getScriptProperties(), dirty = P.getProperty('CL10_DIRTY'), last = Number(P.getProperty('CL10_LAST') || 0);
  if (!dirty && Date.now() - last < 6 * 3600e3) return;
  bnxCl10Sync_(dirty ? 'sheet edited' : 'every 6 h');
}
function bnxLpBrief_(r) { if (!r || !r.success) return r; var o = {}; ['success', 'apply', 'rows', 'withLink', 'added', 'updated'].forEach(function (k) { if (r[k] !== undefined) o[k] = r[k]; }); o.months = (r.blocks || []).map(function (b) { return b.month; }).filter(String); o.unmatchedNames = (r.unmatchedNames || []).slice(0, 30); return o; }
function bnxCl10Sync_(why) {
  var P = PropertiesService.getScriptProperties(); P.deleteProperty('CL10_DIRTY');
  var res = { at: new Date().toISOString(), why: why, bills: bnxSheetBills_(BNX_CL10, true), ledgers: bnxLpBrief_(bnxLedgerFromPrint_(BNX_CL10.CID, true)) };
  P.setProperty('CL10_LAST', String(Date.now())); try { P.setProperty('CL10_LAST_RESULT', JSON.stringify(res).slice(0, 8000)); } catch (e) {}
  return res;
}
/* ERP button (Purchase › Payment Advice): sync this client's sheet now — CL00010 Siliguri, CL00011 Kolkata */
function bnxSheetLinksSync_(session, p) {
  var role = String(session && session.ROLE || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (!/^(SUPER_ADMIN|DEVELOPER|ADMIN|OWNER|ACCOUNTANT|ACCOUNTS|MANAGER|PURCHASE_MANAGER|MD|CEO)$/.test(role)) return { success: false, error: 'Only owner / admin / accounts can sync the sheet' };
  var cid = String(session.CLIENT_ID || '');
  if (cid === BNX_CL10.CID) { if (p && p.status) { var s = PropertiesService.getScriptProperties().getProperty('CL10_LAST_RESULT'); return { success: true, data: s ? JSON.parse(s) : null }; } return { success: true, data: bnxCl10Sync_('ERP button') }; }
  if (cid === BNX_CL11.CID) return { success: true, data: { at: new Date().toISOString(), bills: bnxCl11Bills_(true), ledgers: bnxLpBrief_(bnxCl11Ledgers_(true)) } };
  return { success: false, error: 'No Google sheet is set up for ' + cid + ' (bills / ledgers come from uploads in the ERP)' };
}

/* ═══ GST_ITEM_TAX_FIX (2026-11-20 "Hashfreezer sales 40 % GST rate update and liquor sale update, HSN codes fix all") ═══
   Checks ITEM_MASTER, MENU_CARD_ITEMS, BAR_MENU_CARD, BAR_ITEM_MASTER, LIQUOR_MASTER of the client:
   · Hashfreezer / hookah / shisha / tobacco items → GST 40 %, HSN 24031110;
   · liquor (whisky, rum, vodka, gin, beer, wine, brandy, cocktails…; not mocktails / soft drinks) → GST 0 (non-GST, VAT
     item), HSN filled when empty (beer 22030000, wine 22042190, others = the GST page's liquor HSN, default 22087011);
   · other menu items with no HSN → the GST page's HSN for their GST rate (5 % → 996331 …).
   p.apply = false → list only. Only the HSN and GST-rate cells are written; nothing else changes. */
function bnxGstItemTaxFix_(session, p) {
  var role = String(session && session.ROLE || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (!/^(SUPER_ADMIN|DEVELOPER|ADMIN|OWNER|ACCOUNTANT|ACCOUNTS|MANAGER|CA)$/.test(role)) return { success: false, error: 'Only owner / admin / accounts can change item tax set-up' };
  var cid = String(session.CLIENT_ID || ''), apply = !!(p && p.apply), RM = (p && p.rateMap) || {}, out = { changes: [], updated: 0, tables: [] };
  var HASH = /hash\s*freez|hookah|hukka|shisha|sheesha|tobacco|\bhash\b/i, LIQ = /whisk|vodka|\brum\b|\bgin\b|beer|lager|\bale\b|wine|brandy|tequila|scotch|liqueur|breezer|spirit|champagne|cocktail|\bpeg\b|bourbon|single malt|\bipa\b|cider/i, NOTLIQ = /mocktail|virgin|soft drink|juice|water|soda|coke|pepsi|red ?bull|energy drink|lemonade|shake|tea|coffee/i;
  var lock = LockService.getScriptLock(); if (apply && !lock.tryLock(20000)) return { success: false, error: 'SERVER_BUSY — try again' };
  try {
    ['ITEM_MASTER', 'MENU_CARD_ITEMS', 'BAR_MENU_CARD', 'BAR_ITEM_MASTER', 'LIQUOR_MASTER'].forEach(function (tn) {
      var sh; try { sh = bnxClientSheet(cid, tn); } catch (e) { return; } if (!sh || sh.getLastRow() < 2) return;
      var v = sh.getDataRange().getValues(), h = v[0].map(function (x) { return String(x || '').trim().toUpperCase(); }), col = function (a) { for (var i = 0; i < a.length; i++) { var k = h.indexOf(a[i]); if (k >= 0) return k; } return -1; };
      var cN = col(['ITEM_NAME', 'MENU_ITEM_NAME', 'NAME', 'LIQUOR_NAME', 'BRAND_NAME', 'PRODUCT_NAME']), cC = col(['CATEGORY', 'CATEGORY_NAME', 'ITEM_GROUP_NAME', 'GROUP_NAME', 'ITEM_TYPE', 'TYPE', 'SUB_CATEGORY']);
      var cH = col(['HSN_CODE', 'HSN', 'HSN_SAC', 'HSN_SAC_CODE']), cR = col(['GST_RATE', 'TAX_RATE', 'GST_PERCENT', 'TAX_PERCENT', 'GST_PCT', 'GST']), cCid = col(['CLIENT_ID']);
      if (cN < 0) return; out.tables.push(tn);
      var barTable = /BAR|LIQUOR/.test(tn), dirty = {};
      for (var r = 1; r < v.length; r++) {
        if (cCid >= 0 && v[r][cCid] && String(v[r][cCid]) !== cid) continue;
        var nm = String(v[r][cN] || '').trim(); if (!nm) continue; var cat = cC >= 0 ? String(v[r][cC] || '') : '', txt = nm + ' ' + cat;
        var hOld = cH >= 0 ? String(v[r][cH] || '').trim() : '', rRaw = cR >= 0 ? v[r][cR] : '', rOld = rRaw === '' || rRaw == null ? null : Number(String(rRaw).replace('%', '')), frac = rOld != null && rOld > 0 && rOld < 1, rPct = rOld == null ? null : frac ? Math.round(rOld * 10000) / 100 : rOld;
        var hNew = hOld, rNew = rPct, why = [];
        if (HASH.test(txt)) { if (rPct !== 40) { rNew = 40; why.push('Hashfreezer / hookah → 40 %'); } if (!/^2403/.test(hOld)) { hNew = '24031110'; why.push('HSN 24031110'); } }
        else if ((barTable || LIQ.test(cat)) && LIQ.test(txt) && !NOTLIQ.test(txt)) {
          if (rPct) { rNew = 0; why.push('liquor is non-GST'); }
          if (!hOld) { hNew = /beer|lager|\bale\b|\bipa\b/i.test(txt) ? '22030000' : /wine|champagne/i.test(txt) ? '22042190' : String((RM.L && RM.L.hsn) || '22087011'); why.push('liquor HSN'); } }
        else if (!hOld && cH >= 0 && rPct != null) { var m = RM[String(rPct)] || (rPct === 0 ? RM.X : null); if (m && m.hsn) { hNew = m.hsn; why.push('HSN for ' + rPct + ' %'); } }
        if (!why.length) continue;
        out.changes.push({ table: tn, name: nm, cat: cat, hsnOld: hOld, hsnNew: hNew !== hOld ? hNew : '', rateOld: rPct, rateNew: rNew !== rPct ? rNew : null, why: why.join(' · ') });
        if (apply) { if (cH >= 0 && hNew !== hOld) { v[r][cH] = hNew; dirty[cH] = 1; } if (cR >= 0 && rNew !== rPct) { v[r][cR] = frac ? rNew / 100 : rNew; dirty[cR] = 1; } out.updated++; }
      }
      if (apply) Object.keys(dirty).forEach(function (c) { c = +c; sh.getRange(2, c + 1, v.length - 1, 1).setValues(v.slice(1).map(function (row) { return [row[c]]; })); });
    });
    if (apply) { try { CacheService.getScriptCache().removeAll(['menu_' + cid, 'items_' + cid]); } catch (e) {} out.note = 'New bills use the new rates; bills already made keep their tax.'; }
  } finally { try { lock.releaseLock(); } catch (e) {} }
  return { success: true, data: out };
}

/* ═══ GST_FILE_SAVE (2026-11-20 "PDF and Excel both download and folder save mapping") ═════════════════════════════════
   The GST page sends the report file it just made (Excel / PDF, base64). Saved in Drive under
     <mapped folder>  ›  GST Reports › FY 2026-27 › <report>     (mapped folder = the folder link set on the GST page),
   else the folder of the client's GST Google Sheet, else BNX_GST_CLOUD › <CLIENT_ID>. A file with the same name in that
   folder goes to the Drive bin (recoverable) so the folder holds the latest copy. */
function bnxGstFileSave_(session, p) {
  var role = String(session && session.ROLE || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (!/^(SUPER_ADMIN|DEVELOPER|ADMIN|OWNER|ACCOUNTANT|ACCOUNTS|MANAGER|CA|AUDITOR)$/.test(role)) return { success: false, error: 'Only admin / accounts logins can save GST files to Drive' };
  var cid = String(session.CLIENT_ID || ''), b64 = String(p && p.b64 || '');
  if (!cid || !b64) return { success: false, error: 'No file' }; if (b64.length > 36e6) return { success: false, error: 'File too large (over ~25 MB)' };
  var clean = function (s, n) { return String(s || '').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '-').trim().slice(0, n || 80); };
  var name = clean(p.name, 140) || 'GST report', mime = /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|text\/csv|application\/json)$/.test(String(p.mime)) ? String(p.mime) : 'application/octet-stream';
  var base = null, how = '';
  var fm = String(p.folderUrl || p.folderId || '').match(/folders\/([A-Za-z0-9_-]{20,})|^([A-Za-z0-9_-]{20,})$/);
  if (fm) { try { base = DriveApp.getFolderById(fm[1] || fm[2]); how = 'Mapped folder (' + base.getName() + ')'; } catch (e) { return { success: false, error: 'The mapped Drive folder cannot be opened by the server account — share it with the script owner or clear the mapping' }; } }
  if (!base) { var sm = String(p.sheetUrl || '').match(/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/); if (sm) { try { var it = DriveApp.getFileById(sm[1]).getParents(); if (it.hasNext()) { base = it.next(); how = 'Folder of the GST Google Sheet (' + base.getName() + ')'; } } catch (e) {} } }
  if (!base) { base = bnxGstCloudFolder_(cid, true); how = 'BNX_GST_CLOUD › ' + cid; }
  var path = ['GST Reports'].concat(String(p.sub || '').split('/').map(function (x) { return clean(x, 60); }).filter(String)).slice(0, 5), f = base;
  path.forEach(function (n) { var it2 = f.getFoldersByName(n); f = it2.hasNext() ? it2.next() : f.createFolder(n); });
  var old = f.getFilesByName(name); while (old.hasNext()) { try { old.next().setTrashed(true); } catch (e) {} }
  var file = f.createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime, name));
  return { success: true, data: { name: name, url: file.getUrl(), folderUrl: f.getUrl(), where: how + ' › ' + path.join(' › ') } };
}

/* ═══ ERP CONTROL CENTRE (Dashboard/admin/erp-control.html) — SUPER ADMIN ONLY (2026-11-20) ═════════════════════════════
   ADMIN_CONTROL_OVERVIEW: every company with today / month sales, bills, GST collected, purchases, last bill (cached 15 min).
   ADMIN_CLIENT_DASH {clientId, month}: one company's dashboard — day-wise sales, payment modes, top items, purchases, GST.
   Both go through bnxAdm_ (ROLE SUPER_ADMIN / DEVELOPER, or USER_ID in Script property BNX_SUPER_ADMINS). Client admins
   get "Super Admin only". Read only — nothing is written to any client database. */
function bnxAdmYmd_(v) { if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Kolkata', 'yyyy-MM-dd'); var s = String(v || '').trim(), m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0]; m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : ''; }
function bnxAdmNum_(v) { var n = Number(String(v == null ? '' : v).replace(/[,₹\s]/g, '')); return isFinite(n) ? n : 0; }
function bnxAdmBills_(cid, months) {
  var ids = bnxGetClientDbIds_(cid); if (!ids || !ids.TRANSACTION) throw new Error('TRANSACTION_DB not set');
  var tx = SpreadsheetApp.openById(ids.TRANSACTION), t = bnxGlTableFor_(tx, 'BILL_MASTER', 'BILL_DATE', months, bnxAdmYmd_), I = t.I, c = function (r, k) { return I[k] == null ? '' : r[I[k]]; }, out = [];
  t.rows.forEach(function (r) { var d = bnxAdmYmd_(c(r, 'BILL_DATE')); if (months.indexOf(d.slice(0, 7)) < 0) return; var st = String(c(r, 'BILL_STATUS') || '').toUpperCase();
    if (/DRAFT|OPEN|HOLD/.test(st)) return; var cancel = /CANCEL|VOID|DELETE/.test(st) || !!c(r, 'CANCELLED_AT');
    out.push({ id: String(c(r, 'BILL_ID')), d: d, t: bnxAdmNum_(c(r, 'GRAND_TOTAL')), tax: bnxAdmNum_(c(r, 'TAX_AMOUNT')), cancel: cancel, mode: String(c(r, 'PAYMENT_MODE') || c(r, 'PAY_MODE') || '').toUpperCase() || 'OTHER', at: c(r, 'CREATED_AT') || c(r, 'BILL_DATE') }); });
  return { tx: tx, bills: out };
}
function bnxAdmPurch_(tx, months) { var t = bnxGlTableFor_(tx, 'PURCHASE_INVOICE', 'INVOICE_DATE', months, bnxAdmYmd_), I = t.I, s = 0, n = 0, g = 0;
  t.rows.forEach(function (r) { var d = bnxAdmYmd_(I.INVOICE_DATE == null ? '' : r[I.INVOICE_DATE]); if (months.indexOf(d.slice(0, 7)) < 0) return; n++; s += bnxAdmNum_(r[I.TOTAL_AMOUNT]); g += bnxAdmNum_(I.TAX_AMOUNT == null ? 0 : r[I.TAX_AMOUNT]); }); return { n: n, total: Math.round(s), tax: Math.round(g) }; }
function bnxAdmKpi_(cid, fresh) {
  var cache = CacheService.getScriptCache(), ck = 'admkpi2_' + cid; if (!fresh) { var hit = cache.get(ck); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  var now = new Date(), today = Utilities.formatDate(now, 'Asia/Kolkata', 'yyyy-MM-dd'), mo = today.slice(0, 7), k = { at: now.toISOString() };
  try { var B = bnxAdmBills_(cid, [mo]), live = B.bills.filter(function (b) { return !b.cancel; });
    k.monthSales = Math.round(live.reduce(function (a, b) { return a + b.t; }, 0)); k.monthBills = live.length; k.monthTax = Math.round(live.reduce(function (a, b) { return a + b.tax; }, 0));
    var td = live.filter(function (b) { return b.d === today; }); k.todaySales = Math.round(td.reduce(function (a, b) { return a + b.t; }, 0)); k.todayBills = td.length; k.cancelled = B.bills.length - live.length;
    k.lastBill = live.length ? live.map(function (b) { return b.d; }).sort().pop() : ''; var P = bnxAdmPurch_(B.tx, [mo]); k.purchases = P.total; k.purchaseCount = P.n; k.ok = true; }
  catch (e) { k.ok = false; k.error = String(e.message || e).slice(0, 160); }
  try { cache.put(ck, JSON.stringify(k), 900); } catch (e) {}
  return k;
}
function bnxAdmOverview_(session, p) {
  var L = bnxAdmClients_(session, p), t0 = Date.now(), list = (L.clients || []).map(function (c) {
    var k = null; if (c.DB_READY && c.STATUS !== 'INACTIVE' && Date.now() - t0 < 240000) k = bnxAdmKpi_(c.CLIENT_ID, !!(p && p.fresh) && (!p.only || p.only === c.CLIENT_ID));
    return { clientId: c.CLIENT_ID, name: c.COMPANY_NAME, contact: c.CONTACT_NAME, phone: c.PHONE, city: c.CITY, industry: c.INDUSTRY, plan: c.PLAN, status: c.STATUS, gstin: c.GST_NO, ready: c.DB_READY, registered: c.REGISTERED_AT, email: c.EMAIL, erpUrl: c.ERP_URL, dbs: { master: c.MASTER_DB_ID, tx: c.TRANSACTION_DB_ID, report: c.REPORT_DB_ID }, kpi: k }; });
  var T = { clients: list.length, active: list.filter(function (x) { return x.status !== 'INACTIVE'; }).length, todaySales: 0, monthSales: 0, monthBills: 0, purchases: 0 };
  list.forEach(function (x) { if (x.kpi && x.kpi.ok) { T.todaySales += x.kpi.todaySales; T.monthSales += x.kpi.monthSales; T.monthBills += x.kpi.monthBills; T.purchases += x.kpi.purchases; } });
  return { success: true, data: { at: new Date().toISOString(), totals: T, clients: list, me: { userId: session.USER_ID, home: session.AUTH_CLIENT_ID || session.CLIENT_ID, role: session.ROLE } } };
}
function bnxAdmClientDash_(session, p) {
  var cid = String(p && p.clientId || '').trim(); if (!/^CL\d{5,}$/.test(cid)) return { success: false, error: 'clientId required' };
  var mo = /^\d{4}-\d{2}$/.test(String(p.month || '')) ? String(p.month) : Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM'), pm = (function () { var y = +mo.slice(0, 4), m = +mo.slice(5) - 1; if (!m) { m = 12; y--; } return y + '-' + ('0' + m).slice(-2); })();
  var B = bnxAdmBills_(cid, [pm, mo]), cur = B.bills.filter(function (b) { return b.d.slice(0, 7) === mo; }), live = cur.filter(function (b) { return !b.cancel; }), prev = B.bills.filter(function (b) { return b.d.slice(0, 7) === pm && !b.cancel; });
  var day = {}, mode = {}; live.forEach(function (b) { var o = day[b.d] || (day[b.d] = { d: b.d, sales: 0, bills: 0, tax: 0 }); o.sales += b.t; o.bills++; o.tax += b.tax; var mk = b.mode.split(/[\s,+\/]+/)[0] || 'OTHER'; mode[mk] = (mode[mk] || 0) + b.t; });
  var top = []; try { var bi = B.tx.getSheetByName('BILL_ITEMS'); if (bi && bi.getLastRow() > 1) { var h = bi.getRange(1, 1, 1, bi.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim().toUpperCase(); }), n = bi.getLastRow() - 1, g = function (k) { var i = h.indexOf(k); return i < 0 ? null : bi.getRange(2, i + 1, n, 1).getValues(); };
      var cB = g('BILL_ID'), cN = g('ITEM_NAME'), cQ = g('QUANTITY'), cT = g('LINE_TOTAL'), want = {}, agg = {}; live.forEach(function (b) { want[b.id] = 1; });
      if (cB && cN && cT) for (var i = 0; i < n; i++) { if (!want[String(cB[i][0])]) continue; var nm = String(cN[i][0] || '').trim(); if (!nm) continue; var o2 = agg[nm] || (agg[nm] = { name: nm, qty: 0, value: 0 }); o2.qty += cQ ? bnxAdmNum_(cQ[i][0]) : 0; o2.value += bnxAdmNum_(cT[i][0]); }
      top = Object.keys(agg).map(function (k) { return agg[k]; }).sort(function (a, b2) { return b2.value - a.value; }).slice(0, 15); } } catch (e) {}
  var P = bnxAdmPurch_(B.tx, [mo]), gst = null;
  try { var gl = bnxGstLive_({ CLIENT_ID: cid, ROLE: 'SUPER_ADMIN' }, { period: mo, sides: 'sales,books' }); if (gl && gl.success) { var o = 0, ex = 0, itc = 0; gl.data.sales.forEach(function (s) { s.items.forEach(function (it) { var t = (it.cgst || 0) + (it.sgst || 0) + (it.igst || 0); o += t; if (!t) ex += it.taxable; }); }); gl.data.purchases.forEach(function (x) { x.items.forEach(function (it) { itc += (it.cgst || 0) + (it.sgst || 0) + (it.igst || 0); }); }); gst = { gstin: gl.data.gstin, company: gl.data.company, output: Math.round(o), itc: Math.round(itc), nonGst: Math.round(ex), issues: (gl.data.issues || []).length }; } } catch (e) { gst = { error: String(e.message || e) }; }
  var sum = function (a) { return Math.round(a.reduce(function (x, b) { return x + b.t; }, 0)); };
  return { success: true, data: { clientId: cid, month: mo, sales: sum(live), bills: live.length, avg: live.length ? Math.round(sum(live) / live.length) : 0, tax: Math.round(live.reduce(function (a, b) { return a + b.tax; }, 0)), cancelled: cur.length - live.length,
    prevSales: sum(prev), prevBills: prev.length, days: Object.keys(day).sort().map(function (k) { var o = day[k]; return { d: o.d, sales: Math.round(o.sales), bills: o.bills, tax: Math.round(o.tax) }; }),
    modes: Object.keys(mode).map(function (k) { return { mode: k, value: Math.round(mode[k]) }; }).sort(function (a, b) { return b.value - a.value; }), top: top, purchases: P, gst: gst } };
}

/* ADMIN_SHEET_VIEW — read-only view of the control sheets for the ERP Control Centre (login history, audit log, client
   master, GST trial users, WealthPilot users, OTP / SMS log, CLIENT_DATABASE_REGISTRY …). Newest rows first. Columns whose
   name looks secret (password, PIN, hash, salt, session, token, OTP, secret, API key) are never sent. */
function bnxAdmSheetView_(session, p) {
  var ss = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID), tab = String(p && p.tab || ''), REG = '⚙ ' + CLIENT_DB_REGISTRY_TAB;
  var tabs = ss.getSheets().map(function (sh) { return { name: sh.getName(), rows: Math.max(0, sh.getLastRow() - 1) }; });
  var reg = null; try { reg = bnxControlSheet_(CLIENT_DB_REGISTRY_TAB); tabs.push({ name: REG, rows: Math.max(0, reg.getLastRow() - 1), control: true }); } catch (e) {}
  if (!tab) return { success: true, data: { tabs: tabs, url: ss.getUrl(), controlUrl: reg ? reg.getParent().getUrl() : '' } };
  var sh = tab === REG ? reg : ss.getSheetByName(tab); if (!sh) return { success: false, error: 'No tab ' + tab };
  var lr = sh.getLastRow(), lc = sh.getLastColumn(); if (lr < 1 || lc < 1) return { success: true, data: { tab: tab, head: [], rows: [], total: 0 } };
  var h = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (x) { return String(x || '').trim(); }), lim = Math.min(Math.max(Number(p.limit) || 500, 50), 3000), start = Math.max(2, lr - lim + 1);
  var keep = []; h.forEach(function (k, i) { if (k && !BNX_ADM_SECRET.test(k)) keep.push(i); });
  var rows = lr >= 2 ? sh.getRange(start, 1, lr - start + 1, lc).getValues() : [];
  rows = rows.filter(function (r) { return r.some(function (x) { return x !== '' && x != null; }); }).reverse().map(function (r) { return keep.map(function (i) { var x = r[i]; return x instanceof Date ? Utilities.formatDate(x, 'Asia/Kolkata', 'yyyy-MM-dd HH:mm') : String(x == null ? '' : x).slice(0, 300); }); });
  return { success: true, data: { tab: tab, head: keep.map(function (i) { return h[i]; }), rows: rows, total: lr - 1, shown: rows.length, url: sh.getParent().getUrl() + '#gid=' + sh.getSheetId() } };
}

/* ═══ SUBSCRIPTIONS & PAYMENTS — ERP Control Centre (super admin only) — 2026-11-20 ═══════════════════════════════════
   USER_SECURITY_MASTER_DB › CLIENT_SUBSCRIPTION (one row per company) and › SUBSCRIPTION_PAYMENTS (one row per payment) —
   both tabs are created on first use. Extending access moves EXPIRY_DATE on from today or the old expiry (whichever is
   later), records the payment and re-activates a company that was stopped for non-payment. RUN_SUBS_AutoOn adds a daily
   check: AUTO_SUSPEND = YES and expired more than GRACE_DAYS → company set INACTIVE (data kept; extend to re-open). */
var BNX_SUB_H = ['CLIENT_ID', 'COMPANY_NAME', 'PLAN', 'AMOUNT', 'BILLING_CYCLE', 'START_DATE', 'EXPIRY_DATE', 'STATUS', 'AUTO_SUSPEND', 'GRACE_DAYS', 'NOTES', 'UPDATED_AT', 'UPDATED_BY'];
var BNX_PAY_H = ['PAYMENT_ID', 'CLIENT_ID', 'COMPANY_NAME', 'PAYMENT_DATE', 'AMOUNT', 'MODE', 'REFERENCE', 'DAYS_ADDED', 'NEW_EXPIRY', 'NOTE', 'RECORDED_BY', 'RECORDED_AT'];
function bnxSubSheet_(name, H) { var ss = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, H.length).setValues([H]).setFontWeight('bold').setBackground('#1f1a14').setFontColor('#ffffff'); sh.setFrozenRows(1); }
  var h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (x) { return String(x || '').trim().toUpperCase(); });
  H.forEach(function (k) { if (h.indexOf(k) < 0) { h.push(k); sh.getRange(1, h.length).setValue(k).setFontWeight('bold'); } }); return { sh: sh, h: h }; }
function bnxSubD_(v) { if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Kolkata', 'yyyy-MM-dd'); var s = String(v || '').trim(); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : bnxAdmYmd_(s); }
function bnxSubAll_() { var S = bnxSubSheet_('CLIENT_SUBSCRIPTION', BNX_SUB_H), v = S.sh.getDataRange().getValues(), by = {};
  for (var r = 1; r < v.length; r++) { var o = { _row: r + 1 }; S.h.forEach(function (k, i) { o[k] = v[r][i]; }); var id = String(o.CLIENT_ID || '').trim(); if (id) by[id] = o; } return { S: S, by: by }; }
function bnxSubState_(o, today) { var ex = bnxSubD_(o && o.EXPIRY_DATE), st = String(o && o.STATUS || '').toUpperCase(); if (st === 'SUSPENDED') return { state: 'SUSPENDED', days: null, expiry: ex };
  if (!ex) return { state: o && o.PLAN ? 'NO EXPIRY' : 'NOT SET', days: null, expiry: '' }; var days = Math.round((new Date(ex + 'T00:00:00') - new Date(today + 'T00:00:00')) / 864e5), g = Number(o.GRACE_DAYS || 3);
  return { state: days < -g ? 'EXPIRED' : days < 0 ? 'GRACE' : days <= 7 ? 'EXPIRING' : 'ACTIVE', days: days, expiry: ex }; }
function bnxSubsList_(session) {
  var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'), A = bnxSubAll_(), C = bnxAdmClients_(session, {}).clients || [], P = bnxSubSheet_('SUBSCRIPTION_PAYMENTS', BNX_PAY_H), pv = P.sh.getDataRange().getValues(), pay = {};
  for (var r = 1; r < pv.length; r++) { var id = String(pv[r][P.h.indexOf('CLIENT_ID')] || ''); if (!id) continue; var o = pay[id] || (pay[id] = { total: 0, n: 0, last: '', lastAmt: 0 }), d = bnxSubD_(pv[r][P.h.indexOf('PAYMENT_DATE')]), a = bnxAdmNum_(pv[r][P.h.indexOf('AMOUNT')]); o.total += a; o.n++; if (d >= o.last) { o.last = d; o.lastAmt = a; } }
  var list = C.map(function (c) { var s = A.by[c.CLIENT_ID] || {}, st = bnxSubState_(s, today);
    return { clientId: c.CLIENT_ID, name: c.COMPANY_NAME, status: c.STATUS, plan: String(s.PLAN || c.PLAN || ''), amount: bnxAdmNum_(s.AMOUNT), cycle: String(s.BILLING_CYCLE || ''), start: bnxSubD_(s.START_DATE), expiry: st.expiry, days: st.days, state: st.state,
      autoSuspend: String(s.AUTO_SUSPEND || 'NO').toUpperCase() === 'YES', grace: Number(s.GRACE_DAYS || 3), notes: String(s.NOTES || ''), paid: pay[c.CLIENT_ID] || { total: 0, n: 0, last: '', lastAmt: 0 }, phone: c.PHONE, contact: c.CONTACT_NAME }; });
  return { success: true, data: { today: today, list: list } };
}
function bnxSubsSave_(session, p) {
  var cid = String(p.clientId || '').trim(); if (!/^CL\d{5,}$/.test(cid)) return { success: false, error: 'clientId required' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { var A = bnxSubAll_(), S = A.S, o = A.by[cid], row = o ? o._row : S.sh.getLastRow() + 1, cur = o ? S.h.map(function (k) { return o[k] === undefined ? '' : o[k]; }) : S.h.map(function () { return ''; }), set = function (k, v) { var i = S.h.indexOf(k); if (i >= 0 && v !== undefined) cur[i] = v; };
    var c = (bnxAdmClients_(session, {}).clients || []).filter(function (x) { return x.CLIENT_ID === cid; })[0] || {};
    set('CLIENT_ID', cid); set('COMPANY_NAME', c.COMPANY_NAME || (o && o.COMPANY_NAME) || cid);
    if (p.plan !== undefined) set('PLAN', String(p.plan).toUpperCase().slice(0, 30)); if (p.amount !== undefined) set('AMOUNT', bnxAdmNum_(p.amount)); if (p.cycle !== undefined) set('BILLING_CYCLE', String(p.cycle).toUpperCase().slice(0, 20));
    if (p.expiry !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(p.expiry))) set('EXPIRY_DATE', String(p.expiry)); if (p.start !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(p.start))) set('START_DATE', String(p.start));
    if (p.autoSuspend !== undefined) set('AUTO_SUSPEND', p.autoSuspend ? 'YES' : 'NO'); if (p.grace !== undefined) set('GRACE_DAYS', Math.max(0, Math.min(60, Number(p.grace) || 0))); if (p.notes !== undefined) set('NOTES', String(p.notes).slice(0, 500));
    if (p.status !== undefined) set('STATUS', String(p.status).toUpperCase()); if (!cur[S.h.indexOf('STATUS')]) set('STATUS', 'ACTIVE');
    set('UPDATED_AT', new Date()); set('UPDATED_BY', String(session.FULL_NAME || session.USER_ID || ''));
    S.sh.getRange(row, 1, 1, cur.length).setValues([cur]);
    if (p.status && String(p.status).toUpperCase() === 'SUSPENDED') bnxAdmClientStatus_(session, { clientId: cid, status: 'INACTIVE' });
    if (p.status && String(p.status).toUpperCase() === 'ACTIVE') bnxAdmClientStatus_(session, { clientId: cid, status: 'ACTIVE' });
  } finally { lock.releaseLock(); }
  return { success: true, data: { saved: cid } };
}
function bnxSubsExtend_(session, p) {
  var cid = String(p.clientId || '').trim(), days = Math.round(Number(p.days) || 0), amt = bnxAdmNum_(p.amount); if (!/^CL\d{5,}$/.test(cid)) return { success: false, error: 'clientId required' };
  if (days < 1 || days > 3700) return { success: false, error: 'Days must be 1 – 3700' };
  var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'), A = bnxSubAll_(), o = A.by[cid] || {}, ex = bnxSubD_(o.EXPIRY_DATE), base = ex && ex > today ? ex : today, nd = new Date(base + 'T00:00:00'); nd.setDate(nd.getDate() + days);
  var newEx = Utilities.formatDate(nd, 'Asia/Kolkata', 'yyyy-MM-dd'), c = (bnxAdmClients_(session, {}).clients || []).filter(function (x) { return x.CLIENT_ID === cid; })[0] || {};
  var r = bnxSubsSave_(session, { clientId: cid, expiry: newEx, status: 'ACTIVE', start: bnxSubD_(o.START_DATE) || today, plan: p.plan !== undefined ? p.plan : undefined }); if (!r.success) return r;
  var pid = '';
  if (amt || p.reference) { var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try { var P = bnxSubSheet_('SUBSCRIPTION_PAYMENTS', BNX_PAY_H); pid = 'PAY' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMddHHmmss') + Math.floor(100 + Math.random() * 900);
      var rec = { PAYMENT_ID: pid, CLIENT_ID: cid, COMPANY_NAME: c.COMPANY_NAME || cid, PAYMENT_DATE: /^\d{4}-\d{2}-\d{2}$/.test(String(p.date || '')) ? String(p.date) : today, AMOUNT: amt, MODE: String(p.mode || '').toUpperCase().slice(0, 20), REFERENCE: String(p.reference || '').slice(0, 80), DAYS_ADDED: days, NEW_EXPIRY: newEx, NOTE: String(p.note || '').slice(0, 300), RECORDED_BY: String(session.FULL_NAME || session.USER_ID || ''), RECORDED_AT: new Date() };
      P.sh.appendRow(P.h.map(function (k) { return rec[k] === undefined ? '' : rec[k]; })); } finally { lock.releaseLock(); } }
  if (String(c.STATUS || '').toUpperCase() === 'INACTIVE') bnxAdmClientStatus_(session, { clientId: cid, status: 'ACTIVE' });
  return { success: true, data: { clientId: cid, expiry: newEx, paymentId: pid, reactivated: String(c.STATUS || '').toUpperCase() === 'INACTIVE' } };
}
function bnxSubsPayments_(session, p) { var cid = String(p.clientId || '').trim(), P = bnxSubSheet_('SUBSCRIPTION_PAYMENTS', BNX_PAY_H), v = P.sh.getDataRange().getValues(), out = [];
  for (var r = v.length - 1; r >= 1; r--) { if (cid && String(v[r][P.h.indexOf('CLIENT_ID')]) !== cid) continue; var o = {}; P.h.forEach(function (k, i) { var x = v[r][i]; o[k] = x instanceof Date ? Utilities.formatDate(x, 'Asia/Kolkata', 'yyyy-MM-dd HH:mm') : x; }); out.push(o); if (out.length >= 500) break; }
  return { success: true, data: { payments: out } }; }
function RUN_SUBS_AutoOn() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bnxSubsDaily_') ScriptApp.deleteTrigger(t); }); ScriptApp.newTrigger('bnxSubsDaily_').timeBased().everyDays(1).atHour(6).create(); Logger.log('Daily subscription check ON (06:00).'); }
function bnxSubsDaily_() {
  var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'), A = bnxSubAll_(), sys = { ROLE: 'SUPER_ADMIN', USER_ID: 'SYSTEM', FULL_NAME: 'Subscription check', AUTH_CLIENT_ID: '' }, done = [];
  Object.keys(A.by).forEach(function (id) { var o = A.by[id], st = bnxSubState_(o, today); if (st.state === 'EXPIRED' && String(o.AUTO_SUSPEND || '').toUpperCase() === 'YES') { try { bnxAdmClientStatus_(sys, { clientId: id, status: 'INACTIVE' }); bnxSubsSave_(sys, { clientId: id, status: 'EXPIRED' }); done.push(id); } catch (e) {} } });
  Logger.log('Expired and stopped: ' + (done.join(', ') || 'none'));
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   v45 (2026-11-26): the four repair add-ons are INSIDE this file — do NOT add them as separate files.
   (If you already added zz_item_map_fix / zz_fix_no_item_bills / zz_pos_import_aggregators / zz_fix_customer_dues or
   'Untitled' copies of them: DELETE those files, otherwise the same functions exist twice.)
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

/* ──────────── v45 add-on: ITEM MAP (bill lines <-> ITEM_MASTER, ITEM_CODE / CATEGORY fill) (zz_item_map_fix.gs) ──────────── */
/* zz_item_map_fix.gs (2026-11-25) — NEW file. Item names on bills ↔ ITEM_MASTER, so every bill line has the right
   item and group (Liquor / Liquor MRP / Food / Beverage / Hukka) in the DSR, stock and reports.
   ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
   Found in CL00010 (Master DB 25-11):
     • HERB CRUSHED PRAWN is sold (₹595) but is not in ITEM_MASTER                    → added (FOOD, like BUTTER GARLIC PRAWN)
     • RED BULL twice active (ITM00315 + ITM00581, same name, same ₹295)              → ITM00315 made inactive (ITM00581 is the BAR item)
     • aliases that point to a DIFFERENT item than their own name, e.g. "RED BULL MRP" → ITM00315 RED BULL ₹295 (should be
       ITM01161 RED BULL MRP ₹125), "OLD FASHIONED" → Old Fashioned (Black Label), "SEX ON THE BEACH" → "SEX ON THE BEACH." …
                                                                                       → pointed to the item with exactly that name
     • 325+ bill lines with no ITEM_ID; lines pointing to an inactive copy (ITM011xx)   → set to the active item (same name + rate)
     • BIYARA (₹595 / ₹945) and SANTORI TOKI (₹595 / ₹1,190) are two real sizes with the same name — only LISTED; rename them
       with the size (e.g. "BIYARA 330ML", "BIYARA 650ML") in ITEM_MASTER yourself. Bill lines are matched by name + rate.
   Nothing is deleted. Old values are not lost: every changed bill line gets "ITEM_ID was …" in NOTES.

   RUN (Apps Script editor, ERP project) — set CLIENT_ID below first:
     1. RUN_ITEMMAP_Check        read only — log shows everything it would change
     2. RUN_ITEMMAP_FixMaster    ITEM_MASTER + ITEM_ALIAS_MASTER
     3. RUN_ITEMMAP_FixBills     BILL_ITEMS (ITEM_ID / ITEM_GROUP_ID / ITEM_GROUP_NAME)   → then DSR › Refresh        */

var BNX_IMAP_CFG = { CLIENT_ID: 'CL00010',
  /* sold on bills but missing in ITEM_MASTER — rate = the billed rate; group / tax / menu section copied from likeName */
  ADD_ITEMS: [ { name: 'HERB CRUSHED PRAWN',     rate: 595,   likeName: 'BUTTER GARLIC PRAWN' },
               { name: 'GHEE ROST GALOUTI',      rate: 495,   likeName: 'MUTTON GALOUTI KEBAB' },
               { name: 'MARATHA KEBAB',          rate: 745,   likeName: 'MUTTON GALOUTI KEBAB' },
               { name: 'TANQUERY 10 BTL',        rate: 11000, likeName: 'TANQUERY 10 BTL MRP' },
               { name: 'GLENLIVET 15YR BTL MRP', rate: 6700,  likeName: 'GLENLIVET 12YR BTL MRP' } ] };

function RUN_ITEMMAP_Check()     { bnxImapMaster_(false); bnxImapBills_(false); }
function RUN_ITEMMAP_FixMaster() { bnxImapMaster_(true); }
function RUN_ITEMMAP_FixBills()  { bnxImapBills_(true); }

function bnxImapN_(s) { return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim(); }
function bnxImapAct_(v) { return v === true || /^(TRUE|1|YES|Y|ACTIVE)$/i.test(String(v == null ? '' : v).trim()); }
function bnxImapRead_(cid, name) {
  var sh = bnxClientSheet(cid, name), v = sh.getDataRange().getValues(), h = (v[0] || []).map(function (x) { return String(x).trim(); });
  var ix = {}; h.forEach(function (k, i) { if (k) ix[k] = i; });
  return { sh: sh, v: v, h: h, ix: ix, col: function (k) { return ix[k] === undefined ? -1 : ix[k]; } };
}

/* item index: by id, and by name → [items] (active first) */
function bnxImapIndex_(cid) {
  var IM = bnxImapRead_(cid, SHEETS.ITEM_MASTER), c = IM.col.bind(IM), byId = {}, byName = {};
  var G = {}; try { var GM = bnxImapRead_(cid, SHEETS.ITEM_GROUP_MASTER); for (var g = 1; g < GM.v.length; g++) G[String(GM.v[g][GM.col('ITEM_GROUP_ID')])] = String(GM.v[g][GM.col('ITEM_GROUP_NAME')] || ''); } catch (e) {}
  var CAT = {}; try { var CM = bnxImapRead_(cid, SHEETS.CATEGORY_MASTER || 'CATEGORY_MASTER'); for (var q = 1; q < CM.v.length; q++) CAT[String(CM.v[q][CM.col('CATEGORY_ID')])] = String(CM.v[q][CM.col('CATEGORY_NAME')] || ''); } catch (e) {}
  var bar = {}; try { var BM = bnxImapRead_(cid, SHEETS.BAR_ITEM_MASTER); for (var b = 1; b < BM.v.length; b++) bar[String(BM.v[b][BM.col('ITEM_ID')])] = 1; } catch (e) {}
  for (var r = 1; r < IM.v.length; r++) {
    var row = IM.v[r], cl = c('CLIENT_ID') >= 0 ? String(row[c('CLIENT_ID')] || '') : ''; if (cl && cl !== cid) continue;
    var it = { r: r, id: String(row[c('ITEM_ID')] || ''), name: String(row[c('ITEM_NAME')] || ''), rate: Number(row[c('SELLING_RATE')]) || 0,
      active: bnxImapAct_(row[c('IS_ACTIVE')]), gid: String(row[c('ITEM_GROUP_ID')] || ''), bar: !!bar[String(row[c('ITEM_ID')] || '')] };
    it.gname = G[it.gid] || ''; if (!it.id) continue;
    it.cat = (c('MENU_CATEGORY_ID') >= 0 && CAT[String(row[c('MENU_CATEGORY_ID')] || '')]) || (c('MENU_SECTION') >= 0 ? String(row[c('MENU_SECTION')] || '') : '') || (it.gname ? it.gname + ' SALES' : '');
    byId[it.id] = it; var k = bnxImapN_(it.name); (byName[k] = byName[k] || []).push(it);
  }
  Object.keys(byName).forEach(function (k) { byName[k].sort(function (a, b) { return (b.active - a.active) || (b.bar - a.bar) || (a.id < b.id ? -1 : 1); }); });
  return { IM: IM, byId: byId, byName: byName, G: G };
}
/* best ACTIVE item for a bill line: same name (+ same rate when the name has several sizes), else via alias */
function bnxImapPick_(X, name, rate, alias) {
  var list = (X.byName[bnxImapN_(name)] || []).filter(function (i) { return i.active; });
  if (!list.length && alias) { var a = alias[bnxImapN_(name)]; if (a && X.byId[a] && X.byId[a].active) list = [X.byId[a]]; }
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  var same = list.filter(function (i) { return rate && Math.abs(i.rate - rate) < 0.01; });
  if (same.length) return same[0];
  var rates = {}; list.forEach(function (i) { rates[i.rate] = 1; });
  return Object.keys(rates).length === 1 ? list[0] : null;            /* sizes with different prices and no rate match → leave */
}

function bnxImapMaster_(write) {
  var cid = BNX_IMAP_CFG.CLIENT_ID, X = bnxImapIndex_(cid), IM = X.IM, c = IM.col.bind(IM), now = new Date().toISOString(), out = [];
  /* 1. duplicate ACTIVE items: same name AND same rate → keep one (BAR item / lowest id), make the others inactive */
  var deact = [], sizes = [];
  Object.keys(X.byName).forEach(function (k) {
    var act = X.byName[k].filter(function (i) { return i.active; }); if (act.length < 2) return;
    var byRate = {}; act.forEach(function (i) { (byRate[i.rate] = byRate[i.rate] || []).push(i); });
    if (Object.keys(byRate).length > 1) sizes.push(act[0].name + ' — ' + act.map(function (i) { return i.id + ' ₹' + i.rate; }).join(', '));
    Object.keys(byRate).forEach(function (rt) { byRate[rt].slice(1).forEach(function (d) { deact.push([d, byRate[rt][0]]); }); });
  });
  deact.forEach(function (p) { p[0].active = false; });                          /* aliases below see the result */
  deact.forEach(function (p) { out.push('Make inactive ' + p[0].id + ' ' + p[0].name + ' ₹' + p[0].rate + ' (same as ' + p[1].id + ')'); });
  sizes.forEach(function (s) { out.push('Same name, different price (rename with size yourself): ' + s); });
  /* 2. items sold but missing */
  var adds = BNX_IMAP_CFG.ADD_ITEMS.filter(function (a) { return !(X.byName[bnxImapN_(a.name)] || []).some(function (i) { return i.active; }); });
  adds.forEach(function (a) { out.push('Add item ' + a.name + ' ₹' + a.rate + ' (copy of ' + a.likeName + ')'); });
  /* 3. aliases pointing to another item than the item with exactly that name */
  var AL = bnxImapRead_(cid, SHEETS.ITEM_ALIAS_MASTER), ca = AL.col.bind(AL), fixA = [];
  for (var r = 1; r < AL.v.length; r++) {
    var row = AL.v[r]; if (ca('IS_ACTIVE') >= 0 && !bnxImapAct_(row[ca('IS_ACTIVE')]) && String(row[ca('IS_ACTIVE')]) !== '') continue;
    var nm = String(row[ca('ALIAS_NAME')] || ''), cur = String(row[ca('ITEM_ID')] || ''), exact = (X.byName[bnxImapN_(nm)] || []).filter(function (i) { return i.active; });
    if (exact.length !== 1 || exact[0].id === cur) continue;                         /* none or several (sizes) → leave */
    var curIt = X.byId[cur]; if (curIt && curIt.active && bnxImapN_(curIt.name) === bnxImapN_(nm)) continue;
    /* safe re-point only: old target inactive / missing, or same price, or the alias says BTL / MRP / CAN and the old target does not */
    var tok = function (x) { return (bnxImapN_(x).match(/\b(BTL|BOTTLE|MRP|CAN)\b/g) || []).sort().join(' '); };
    if (curIt && curIt.active && Math.abs(curIt.rate - exact[0].rate) > 0.01 && !(tok(nm) && tok(nm) !== tok(curIt.name))) {
      out.push('CHECK alias "' + nm + '" → ' + cur + ' ' + curIt.name + ' ₹' + curIt.rate + ' (an item named exactly "' + nm + '" is ' + exact[0].id + ' ₹' + exact[0].rate + ') — left as it is'); continue; }
    fixA.push([r, nm, cur, exact[0]]); out.push('Alias "' + nm + '": ' + cur + (curIt ? ' (' + curIt.name + ' ₹' + curIt.rate + ')' : '') + ' → ' + exact[0].id + ' ₹' + exact[0].rate);
  }
  Logger.log('ITEM_MASTER / ALIAS — ' + out.length + ' change(s)' + (write ? '' : ' (read only)')); out.forEach(function (s) { Logger.log('  ' + s); });
  if (!write) return;

  /* master edits are single cells + appended rows: no project lock needed (the POS holds that lock while billing) */
  var lock = { releaseLock: function () {} };
  try {
    deact.forEach(function (p) { var rr = p[0].r + 1;
      IM.sh.getRange(rr, c('IS_ACTIVE') + 1).setValue(false);
      if (c('MENU_ACTIVE') >= 0) IM.sh.getRange(rr, c('MENU_ACTIVE') + 1).setValue(false);
      if (c('UPDATED_AT') >= 0) IM.sh.getRange(rr, c('UPDATED_AT') + 1).setValue(now); });
    adds.forEach(function (a) {
      var like = (X.byName[bnxImapN_(a.likeName)] || [])[0], src = like ? IM.v[like.r] : [];
      var obj = {}; IM.h.forEach(function (k, i) { obj[k] = src[i] === undefined ? '' : src[i]; });
      var id = ''; try { id = generateShortId_(cid, 'ITEM_ID'); } catch (e) {}
      if (!id || X.byId[id]) { var mx = 0; Object.keys(X.byId).forEach(function (k) { var m = k.match(/^ITM0*(\d+)$/); if (m && +m[1] < 9000) mx = Math.max(mx, +m[1]); }); id = 'ITM' + ('0000' + (mx + 1)).slice(-5); }
      X.byId[id] = { id: id, name: a.name, rate: a.rate, active: true };
      ['RECIPE_ID', 'IMAGE_URL', 'ICON_PATH', 'ICON_URL', 'DRIVE_FILE_ID', 'IMAGE_SOURCE', 'IMAGE_UPDATED_AT', 'IMAGE_SEARCH_QUERY', 'MENU_SORT_ORDER'].forEach(function (k) { if (k in obj) obj[k] = ''; });
      obj.ITEM_ID = id; obj.CLIENT_ID = cid; obj.ITEM_NAME = a.name; obj.SELLING_RATE = a.rate; obj.IS_ACTIVE = true; obj.CREATED_AT = now; obj.UPDATED_AT = now;
      IM.sh.appendRow(IM.h.map(function (k) { return k ? obj[k] : ''; }));
      Logger.log('  added ' + id + ' ' + a.name);
    });
    fixA.forEach(function (f) { AL.sh.getRange(f[0] + 1, ca('ITEM_ID') + 1).setValue(f[3].id); if (ca('UPDATED_AT') >= 0) AL.sh.getRange(f[0] + 1, ca('UPDATED_AT') + 1).setValue(now); });
    try { CacheService.getScriptCache().removeAll(['itemnamemap_' + cid, 'itemcostmap_' + cid]); } catch (e) {}
    Logger.log('✅ Master fixed. Now run RUN_ITEMMAP_FixBills.');
  } finally { lock.releaseLock(); }
}

function bnxImapBills_(write) {
  var cid = BNX_IMAP_CFG.CLIENT_ID, X = bnxImapIndex_(cid);
  var alias = {}; try { var AL = bnxImapRead_(cid, SHEETS.ITEM_ALIAS_MASTER); for (var a = 1; a < AL.v.length; a++) alias[bnxImapN_(AL.v[a][AL.col('ALIAS_NAME')])] = String(AL.v[a][AL.col('ITEM_ID')] || ''); } catch (e) {}
  var lock = null; if (write) { lock = bnxImapLock_(); }
  try {
  var sh = bnxClientSheet(cid, SHEETS.BILL_ITEMS);
  if (write) bnxEnsureHeaderCols_(sh, ['ITEM_GROUP_ID', 'ITEM_GROUP_NAME', 'NOTES']);
  var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), n = sh.getLastRow() - 1; if (n < 1) return;
  var get = function (k) { var i = h.indexOf(k); return i < 0 ? null : { i: i, v: sh.getRange(2, i + 1, n, 1).getValues() }; };
  var NM = get('ITEM_NAME'), ID = get('ITEM_ID'), RT = get('RATE'), GI = get('ITEM_GROUP_ID'), GN = get('ITEM_GROUP_NAME'), NO = get('NOTES'), CL = get('CLIENT_ID'), CO = get('ITEM_CODE'), CA = get('CATEGORY');
  var chId = 0, chG = 0, chC = 0, miss = {}, why = { blank: 0, unknown: 0, inactive: 0 };
  for (var r = 0; r < n; r++) {
    if (CL && CL.v[r][0] && String(CL.v[r][0]) !== cid) continue;
    var name = String(NM.v[r][0] || ''); if (!name) continue;
    var cur = String(ID ? ID.v[r][0] || '' : ''), curIt = X.byId[cur], it = curIt && curIt.active ? curIt : null;
    if (!it) {
      var p = bnxImapPick_(X, name, Number(RT ? RT.v[r][0] : 0) || 0, alias);
      if (curIt && p && bnxImapN_(p.name) !== bnxImapN_(curIt.name)) p = null;    /* inactive copy → only its active twin */
      if (p) { why[!cur ? 'blank' : !curIt ? 'unknown' : 'inactive']++; if (ID) ID.v[r][0] = p.id; if (NO && cur) NO.v[r][0] = (String(NO.v[r][0] || '') + ' ITEM_ID was ' + cur).trim(); it = p; chId++; }
      else if (!curIt) { var k = bnxImapN_(name); miss[k] = (miss[k] || 0) + 1; }
    }
    var useIt = it || curIt;
    if (useIt && GI && GN && !String(GN.v[r][0] || '').trim() && useIt.gname) { GI.v[r][0] = useIt.gid; GN.v[r][0] = useIt.gname; chG++; }
    if (useIt) {                                                        /* blank ITEM_CODE / CATEGORY (live POS lines) */
      var cc = false;
      if (CO && !String(CO.v[r][0] || '').trim()) { CO.v[r][0] = useIt.id; cc = true; }
      if (CA && !String(CA.v[r][0] || '').trim() && useIt.cat) { CA.v[r][0] = useIt.cat; cc = true; }
      if (cc) chC++;
    }
  }
  Logger.log('BILL_ITEMS — ' + n + ' lines · ITEM_ID set: ' + chId + ' (blank ' + why.blank + ', unknown ' + why.unknown + ', inactive copy ' + why.inactive + ') · group filled: ' + chG + ' · item code / category filled: ' + chC + ' lines' + (write ? '' : ' (read only)'));
  var mk = Object.keys(miss).sort(function (a, b) { return miss[b] - miss[a]; });
  if (mk.length) { Logger.log('  Names not in ITEM_MASTER (add them, or add an alias, then run again):'); mk.slice(0, 60).forEach(function (k) { Logger.log('    ' + k + ' × ' + miss[k]); }); }
  if (!write || (!chId && !chG && !chC)) return;
    if (chId && ID) sh.getRange(2, ID.i + 1, n, 1).setValues(ID.v);
    if (chId && NO) sh.getRange(2, NO.i + 1, n, 1).setValues(NO.v);
    if (chG) { sh.getRange(2, GI.i + 1, n, 1).setValues(GI.v); sh.getRange(2, GN.i + 1, n, 1).setValues(GN.v); }
    if (chC) { if (CO) sh.getRange(2, CO.i + 1, n, 1).setValues(CO.v); if (CA) sh.getRange(2, CA.i + 1, n, 1).setValues(CA.v); }
    if (typeof bnxBillGenBump_ === 'function') bnxBillGenBump_(cid);
    Logger.log('✅ BILL_ITEMS updated. DSR › Refresh.');
  } finally { if (lock) lock.releaseLock(); }
}

/* keep new POS lines filled: every night 04:30 (after closing) the same fill runs by itself. Run once to switch on. */
function RUN_ITEMMAP_NightlyOn() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'RUN_ITEMMAP_FixBills') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('RUN_ITEMMAP_FixBills').timeBased().atHour(4).nearMinute(30).everyDays(1).inTimezone('Asia/Kolkata').create();
  Logger.log('✅ Nightly item fill on (04:30). RUN_ITEMMAP_NightlyOff to stop.');
}
function RUN_ITEMMAP_NightlyOff() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'RUN_ITEMMAP_FixBills') ScriptApp.deleteTrigger(t); });
  Logger.log('Nightly item fill off.');
}

/* BILL_ITEMS columns are rewritten in one go, so wait for the project lock (POS / import hold it for a few seconds at a time) */
function bnxImapLock_() {
  var lock = LockService.getScriptLock();
  for (var t = 0; t < 8; t++) { if (lock.tryLock(30000)) return lock; Utilities.sleep(2000); }
  throw new Error('The ERP was busy for 4 minutes (billing / import running). Run again after closing time.');
}

/* ──────────── v45 add-on: DSR "No Item Detail" repair (zz_fix_no_item_bills.gs) ──────────── */
/* zz_fix_no_item_bills.gs (2026-11-25) — NEW file. Fixes the DSR line "No Item Detail".
   ─────────────────────────────────────────────────────────────────────────────────────────────────────────
   WHY: the DSR splits every bill's sale into Liquor / Liquor MRP / Food / Beverage / Hukka using the bill's
   BILL_ITEMS rows. A bill with NO item rows (or item rows whose LINE_TOTAL is 0 / blank) cannot be split, so its
   whole sale goes to "No Item Detail" (Nov'26 MTD ₹1,18,083 — mostly liquor, which is why MTD Liquor is low).

   HOW IT IS REPAIRED — nothing is guessed:
     A) item rows exist but LINE_TOTAL is 0/blank  → LINE_TOTAL = QUANTITY × RATE, only when those add up to the
        bill SUBTOTAL (±₹2).
     B) no item rows at all                         → rebuilt from the bill's own order (ORDER_ITEMS of
        BILL_MASTER.ORDER_ID, cancelled lines left out), only when that order adds up to the bill SUBTOTAL (±₹2).
     Anything that does not add up is only LISTED (bill no, date, amount) for a manual check — never written.

   USE (Apps Script editor, ERP project):
     1. RUN_NOITEM_Check   — read only. Execution log lists every bill of the month and what can be repaired.
     2. RUN_NOITEM_Repair  — writes the repairs (A + B). Then DSR › Refresh.
     Month / client are set in BNX_NOITEM_CFG below. Safe to run again (repaired bills are skipped).            */

var BNX_NOITEM_CFG = { CLIENT_ID: 'CL00010', MONTH: '' /* '' = this month, or '2026-11' */, TOLERANCE: 2, MAX_BILLS: 400 };

function RUN_NOITEM_Check()  { return bnxNoItemRun_(false); }
function RUN_NOITEM_Repair() { return bnxNoItemRun_(true); }

function bnxNoItemRun_(write) {
  var cid = BNX_NOITEM_CFG.CLIENT_ID, tol = BNX_NOITEM_CFG.TOLERANCE;
  var month = BNX_NOITEM_CFG.MONTH || Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM');
  var num = function (v) { var n = Number(v); return isFinite(n) ? n : 0; };
  var r2 = function (v) { return Math.round(v * 100) / 100; };
  var cols = function (sh, names) {                       /* read only the columns needed (BILL_ITEMS / ORDER_ITEMS are big) */
    var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), n = sh.getLastRow() - 1, out = { h: h, n: Math.max(0, n) };
    names.forEach(function (k) { var i = h.indexOf(k); out[k] = (i < 0 || n < 1) ? null : sh.getRange(2, i + 1, n, 1).getValues(); });
    return out;
  };

  /* 1. bills of the month (business date), not cancelled, with a sale */
  var bm = bnxClientSheet(cid, SHEETS.BILL_MASTER), B = cols(bm, ['BILL_ID', 'CLIENT_ID', 'BILL_NUMBER', 'BILL_DATE', 'BUSINESS_DATE', 'ORDER_ID', 'SUBTOTAL', 'SUBTOTAL_AFTER_ITEM_DISCOUNT', 'GRAND_TOTAL', 'TAX_AMOUNT', 'SERVICE_CHARGE_GST_AMOUNT', 'ROUND_OFF', 'SERVICE_CHARGE_AMOUNT', 'BILL_STATUS', 'PAYMENT_STATUS']);
  var bills = {}, allIds = {};
  for (var i = 0; i < B.n; i++) {
    allIds[String(B.BILL_ID[i][0])] = 1;
    var c0 = B.CLIENT_ID ? String(B.CLIENT_ID[i][0] || '') : '';
    if (c0 !== cid) continue;                              /* DSR counts only rows with this CLIENT_ID */
    var day = bnxNormalizeDateKey_((B.BUSINESS_DATE && B.BUSINESS_DATE[i][0]) || B.BILL_DATE[i][0]);
    if (!day || day.slice(0, 7) !== month) continue;
    if (/^(CANCELLED|VOID|DELETED)$/i.test(String(B.BILL_STATUS[i][0] || ''))) continue;
    if (/^(CANCELLED|VOID)$/i.test(String(B.PAYMENT_STATUS ? B.PAYMENT_STATUS[i][0] : ''))) continue;
    /* same rule as the DSR: sale of goods = GRAND_TOTAL − tax − round off − service charge */
    var g0 = function (k) { return B[k] ? num(B[k][i][0]) : 0; };
    var goods = g0('GRAND_TOTAL') - g0('TAX_AMOUNT') - g0('SERVICE_CHARGE_GST_AMOUNT') - g0('ROUND_OFF') - g0('SERVICE_CHARGE_AMOUNT');
    if (!(goods > 0.004)) continue;
    var sub = num(B.SUBTOTAL[i][0]) > 0 ? num(B.SUBTOTAL[i][0]) : r2(goods);
    bills[String(B.BILL_ID[i][0])] = { id: String(B.BILL_ID[i][0]), no: String(B.BILL_NUMBER[i][0] || ''), day: day, order: String(B.ORDER_ID ? B.ORDER_ID[i][0] || '' : ''), sub: sub, aft: B.SUBTOTAL_AFTER_ITEM_DISCOUNT ? num(B.SUBTOTAL_AFTER_ITEM_DISCOUNT[i][0]) : 0, total: num(B.GRAND_TOTAL[i][0]), goods: r2(goods), subZero: !(num(B.SUBTOTAL[i][0]) > 0), lines: [], sum: 0, calc: 0, txs: 0 };
  }

  /* 2. their item rows */
  var bi = bnxClientSheet(cid, SHEETS.BILL_ITEMS), I = cols(bi, ['BILL_ID', 'QUANTITY', 'RATE', 'LINE_TOTAL', 'TAXABLE_PER_ITEM', 'ITEM_NAME']);
  var orphans = {};                                    /* item rows whose BILL_ID is not any bill in BILL_MASTER */
  for (var j = 0; j < I.n; j++) {
    var bidj = String(I.BILL_ID[j][0] || ''), b = bills[bidj];
    var q = num(I.QUANTITY[j][0]), rt = num(I.RATE[j][0]), lt = num(I.LINE_TOTAL[j][0]), tx = I.TAXABLE_PER_ITEM ? num(I.TAXABLE_PER_ITEM[j][0]) : 0;
    if (!b) { if (bidj && !allIds[bidj]) { var o = orphans[bidj] || (orphans[bidj] = { rows: [], sum: 0 }); o.rows.push(j + 2); o.sum += lt; } continue; }
    b.lines.push({ row: j + 2, q: q, rate: rt, lt: lt, tx: tx, name: I.ITEM_NAME ? String(I.ITEM_NAME[j][0] || '') : '' }); b.sum += lt; b.calc += q * rt; b.txs += tx;
  }
  var bad = Object.keys(bills).map(function (k) { return bills[k]; }).filter(function (b) { return !b.lines.length || b.sum <= 0; });

  /* 3. orders of the bills that have no rows at all */
  var needOrder = {}; bad.forEach(function (b) { if (!b.lines.length && b.order) needOrder[b.order] = []; });
  if (Object.keys(needOrder).length) {
    var oi = bnxClientSheet(cid, SHEETS.ORDER_ITEMS), O = cols(oi, ['ORDER_ITEM_ID', 'ORDER_ID', 'ITEM_ID', 'ITEM_NAME', 'QUANTITY', 'RATE', 'LINE_DISCOUNT', 'ITEM_TAX_RATE', 'ITEM_STATUS', 'ITEM_GROUP_ID', 'ITEM_GROUP_NAME']);
    for (var k = 0; k < O.n; k++) {
      var L = needOrder[String(O.ORDER_ID[k][0])]; if (!L) continue;
      if (/^(CANCELLED|VOID|DELETED|REMOVED)$/i.test(String(O.ITEM_STATUS ? O.ITEM_STATUS[k][0] : ''))) continue;
      var g = function (c) { return O[c] ? O[c][k][0] : ''; };
      L.push({ oid: g('ORDER_ITEM_ID'), itemId: g('ITEM_ID'), name: g('ITEM_NAME'), q: num(g('QUANTITY')), rate: num(g('RATE')), disc: num(g('LINE_DISCOUNT')), tax: num(g('ITEM_TAX_RATE')), gid: g('ITEM_GROUP_ID'), gname: g('ITEM_GROUP_NAME') });
    }
  }

  /* 4. decide */
  var fixA = [], fixB = [], fixC = [], manual = [];
  bad.forEach(function (b) {
    if (b.lines.length) {
      if (b.calc > 0 && Math.abs(b.calc - b.sub) <= tol) fixA.push(b);
      else if (b.txs > 0) { b.useTx = true; fixA.push(b); }                         /* D: LINE_TOTAL blank, taxable value present */
      else if ((function () {                                                         /* E (v46): every item row imported twice */
        var seen = {}, ds = 0, dups = [];
        b.lines.forEach(function (l) { var k = [String(l.name).trim().toUpperCase(), l.q, l.rate].join('|'); if (seen[k]) dups.push(l); else { seen[k] = 1; ds += l.q * l.rate; } });
        if (dups.length && Math.abs(ds - b.sub) <= tol) { b.dups = dups; return true; } return false; })()) fixA.push(b);
      else manual.push([b, b.lines.length + ' item rows, all with value 0 (qty × rate ' + r2(b.calc) + ' ≠ subtotal ' + b.sub + ')']);
    } else {
      var L = b.order ? needOrder[b.order] || [] : [], s = L.reduce(function (a, x) { return a + x.q * x.rate; }, 0);
      var orf = bnxNoItemOrphan_(b, orphans);
      if (orf) { b.relink = orf; fixC.push(b); }                                      /* C: rows exist under another BILL_ID */
      else if (L.length && Math.abs(s - b.sub) <= tol) { b.rebuild = L; fixB.push(b); }
      else manual.push([b, !b.order ? 'no ORDER_ID on the bill' : !L.length ? 'order has no items' : 'order items ' + r2(s) + ' ≠ subtotal']);
    }
  });
  var amt = function (a) { return r2(a.reduce(function (x, b) { return x + b.goods; }, 0)); };
  var perDay = {}; bad.forEach(function (b) { perDay[b.day] = r2((perDay[b.day] || 0) + b.goods); });
  Logger.log('Month ' + month + ' · ' + Object.keys(bills).length + ' bills · without item detail: ' + bad.length + ' (₹' + amt(bad) + ')');
  Logger.log('  per day: ' + Object.keys(perDay).sort().map(function (d) { return d.slice(8) + ' ₹' + perDay[d]; }).join(' · '));
  Logger.log('  A · rows with no value, fixable from qty × rate: ' + fixA.length + ' (₹' + amt(fixA) + ')' + (fixA.some(function (b) { return b.dups; }) ? ' — of which ' + fixA.filter(function (b) { return b.dups; }).length + ' bills had every item row twice (second copy set to qty 0)' : ''));
  fixA.filter(function (b) { return b.dups; }).slice(0, 40).forEach(function (b) { Logger.log('    ' + b.day + '  ' + b.no + '  ' + b.lines.length + ' rows → ' + (b.lines.length - b.dups.length) + ' kept, ' + b.dups.length + ' duplicates'); });
  Logger.log('  B · no rows, rebuildable from the order: ' + fixB.length + ' (₹' + amt(fixB) + ')');
  Logger.log('  C · item rows saved under another BILL_ID, re-linked to the bill: ' + fixC.length + ' (₹' + amt(fixC) + ')');
  fixC.slice(0, 40).forEach(function (b) { Logger.log('    ' + b.no + ' ← ' + b.relink.id + ' (' + b.relink.rows.length + ' rows)'); });
  Logger.log('  Manual check: ' + manual.length + ' (₹' + amt(manual.map(function (m) { return m[0]; })) + ')');
  manual.slice(0, 120).forEach(function (m) { Logger.log('    ' + m[0].day + '  ' + m[0].no + '  [' + m[0].id + ']  sale ₹' + m[0].goods + (m[0].subZero ? ' (SUBTOTAL blank)' : '') + '  — ' + m[1]); });
  if (!write) { Logger.log('Read only. Run RUN_NOITEM_Repair to write A + B + C.'); return { bad: bad.length, fixA: fixA.length, fixB: fixB.length, fixC: fixC.length, manual: manual.length }; }

  var lock = LockService.getScriptLock(), got = false; for (var t = 0; t < 8 && !got; t++) { got = lock.tryLock(30000); if (!got) Utilities.sleep(2000); }
  if (!got) throw new Error('The ERP was busy for 4 minutes (billing / import running). Run again after closing time.');
  try {
    /* A: fill LINE_TOTAL / TAXABLE_PER_ITEM where blank */
    var hI = I.h, cLT = hI.indexOf('LINE_TOTAL') + 1, cTX = hI.indexOf('TAXABLE_PER_ITEM') + 1, cQ = hI.indexOf('QUANTITY') + 1, cN = hI.indexOf('NOTES') + 1, cDR = hI.indexOf('DISCOUNTED_RATE') + 1, cLD = hI.indexOf('LINE_DISCOUNT') + 1, nA = 0, nDup = 0;
    fixA.slice(0, BNX_NOITEM_CFG.MAX_BILLS).forEach(function (b) { var dupRow = {}; (b.dups || []).forEach(function (l) { dupRow[l.row] = 1; }); b.lines.forEach(function (l) {
      if (dupRow[l.row]) {                                                           /* E: the second copy stops counting (kept, not deleted) */
        if (cQ) bi.getRange(l.row, cQ).setValue(0); if (cLT) bi.getRange(l.row, cLT).setValue(0); if (cTX) bi.getRange(l.row, cTX).setValue(0); if (cLD) bi.getRange(l.row, cLD).setValue(0);
        if (cN) bi.getRange(l.row, cN).setValue('DUPLICATE IMPORT ROW — not counted (was qty ' + l.q + ') ' + new Date().toISOString().slice(0, 10)); nDup++; return; }
      if (b.dups) { var v0 = r2(l.q * l.rate); if (cLT) bi.getRange(l.row, cLT).setValue(v0); if (cTX) bi.getRange(l.row, cTX).setValue(v0); if (cDR) bi.getRange(l.row, cDR).setValue(l.rate); if (cLD) bi.getRange(l.row, cLD).setValue(0); nA++; return; }
      if (b.useTx) { if (cLT && l.tx > 0) { bi.getRange(l.row, cLT).setValue(r2(l.tx)); nA++; } return; }
      var v = r2(l.q * l.rate); if (cLT) bi.getRange(l.row, cLT).setValue(v); if (cTX && !(l.tx > 0)) bi.getRange(l.row, cTX).setValue(v); nA++; }); });
    /* C: re-link rows to the bill */
    var cBID = hI.indexOf('BILL_ID') + 1, nC = 0;
    fixC.slice(0, BNX_NOITEM_CFG.MAX_BILLS).forEach(function (b) { b.relink.rows.forEach(function (row) { bi.getRange(row, cBID).setValue(b.id); nC++; }); });
    /* B: add the missing rows (same columns the POS writes) */
    bnxEnsureHeaderCols_(bi, ['CLIENT_ID', 'ITEM_GROUP_ID', 'ITEM_GROUP_NAME', 'NOTES']);
    var rows = [], now = new Date().toISOString();
    fixB.slice(0, BNX_NOITEM_CFG.MAX_BILLS).forEach(function (b) { b.rebuild.forEach(function (x, n) { var line = r2(x.q * x.rate), tr = x.tax > 1 ? x.tax / 100 : x.tax;
      rows.push({ BILL_ITEM_ID: generateShortId_(cid, 'BILL_ITEM_ID'), CLIENT_ID: cid, BILL_ID: b.id, ORDER_ITEM_ID: x.oid, ITEM_ID: x.itemId, SEQUENCE: n + 1,
        ITEM_NAME: x.name, QUANTITY: x.q, UNIT_ID: 'PIECE', RATE: x.rate, LINE_DISCOUNT: x.disc, DISCOUNTED_RATE: x.rate, TAXABLE_PER_ITEM: line,
        TAX_RATE: tr, TAX_PER_ITEM: r2(line * tr), LINE_TOTAL: line, ITEM_GROUP_ID: x.gid, ITEM_GROUP_NAME: x.gname,
        NOTES: 'Rebuilt from order ' + b.order + ' (no item rows) ' + now.slice(0, 10), CREATED_AT: now }); }); });
    if (rows.length) bnxAppendRowsBatch_(cid, SHEETS.BILL_ITEMS, rows);
    if (typeof bnxBillGenBump_ === 'function') bnxBillGenBump_(cid);
    Logger.log('✅ Written: A ' + nA + ' item rows valued · ' + nDup + ' duplicate rows set to qty 0 · C ' + nC + ' rows re-linked · B ' + rows.length + ' item rows added for ' + Math.min(fixB.length, BNX_NOITEM_CFG.MAX_BILLS) + ' bills. Open DSR › Refresh.');
    return { valued: nA, relinked: nC, added: rows.length, manual: manual.length };
  } finally { lock.releaseLock(); }
}

/* C: item rows of this bill saved under a BILL_ID that is not in BILL_MASTER — the id must carry the bill number
   (e.g. HT-2627-00009184) and the rows must add up to the bill (subtotal / after discount / grand total, ±2 %). */
function bnxNoItemOrphan_(b, orphans) {
  var no = String(b.no || '').toUpperCase(), full = no.replace(/[^A-Z0-9]+/g, '-'), last = (no.match(/(\d{4,})\s*$/) || [])[1], ser = (no.match(/^([A-Z]+)/) || [])[1] || '';
  if (!last) return null;
  var best = null;
  Object.keys(orphans).forEach(function (id) {
    var U = id.toUpperCase(), o = orphans[id];
    if (!(U.indexOf(full) >= 0 || (ser && U.indexOf(ser) >= 0 && new RegExp('(^|[^0-9])' + last + '([^0-9]|$)').test(U)))) return;
    var ok = [b.sub, b.aft, b.total].some(function (t) { return t > 0 && Math.abs(o.sum - t) <= Math.max(2, t * 0.02); });
    if (ok && (!best || o.rows.length > best.rows.length)) best = { id: id, rows: o.rows, sum: o.sum };
  });
  return best;
}

/* ──────────── v45 add-on: Zomato / Swiggy (ZM/ SW/) in the POS-sales import (zz_pos_import_aggregators.gs) ──────────── */
/* zz_pos_import_aggregators.gs (2026-11-25) — NEW file. Must load AFTER the core file (put it just above zz_FINAL_ROUTER.gs).
   ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
   WHY Zomato / Swiggy sale was ₹0: in the old POS, delivery orders have their own series ZM/2627/… (Zomato) and
   SW/2627/… (Swiggy) and are paid as "online" (onlinetotal). The POS-sales importer (Import Center → POS sales,
   bnxi24_ in core) booked onlinetotal as UPI, so the DSR showed them in ICICI GPAY, and 23-11 ZM/2627/00000028
   ₹1,375 never reached the ERP (the 18 HT bills of 23-11 were loaded by another route).

   This file:
     1. Import Center POS-sales import — ZM/… and SW/… bills: the whole payment is booked as ZOMATO / SWIGGY
        (PAYMENT_MODE_MASTER PMD00004 / PMD00005), SALES_CHANNEL / AGGREGATOR = ZOMATO / SWIGGY.
     2. The same import now SKIPS bills already in the ERP (any bill number already in BILL_MASTER, not cancelled)
        instead of stopping the whole file with "LIVE_BILL_CONFLICT" — so a day file can be imported again safely
        and only the missing bills (e.g. the ZM / SW orders) are added. Re-import mode is unchanged.
     3. RUN_AGGPAY_Check / RUN_AGGPAY_Fix — bills ALREADY in the ERP with number ZM/… or SW/… whose payment is
        UPI / ONLINE / CASH-like: PAYMENT_MASTER + SALES_LEDGER mode → ZOMATO / SWIGGY. (CREDIT / ZOMATO LIGHT dine-in
        credit bills are NOT touched — those stay guest dues as in your DSR sheet.)                                */

var BNX_AGGIMP = { CLIENT_ID: 'CL00010',
  SERIES: [ { re: /^ZM\//i, mode: 'ZOMATO', id: 'PMD00004' }, { re: /^SW\//i, mode: 'SWIGGY', id: 'PMD00005' } ] };

function bnxAggImpSeries_(no) { no = String(no || '').trim(); for (var i = 0; i < BNX_AGGIMP.SERIES.length; i++) if (BNX_AGGIMP.SERIES[i].re.test(no)) return BNX_AGGIMP.SERIES[i]; return null; }

/* 1 + 2: wrap the core importer (works only when this file loads after the core file) */
(function () {
  if (typeof bnxi24_bnxPosImportRun_ !== 'function' || bnxi24_bnxPosImportRun_.__bnxAgg || typeof BNXI24 === 'undefined') return;
  BNX_AGGIMP.SERIES.forEach(function (s) {
    var col = s.mode.toLowerCase() + 'total';
    if (!BNXI24.MODES.some(function (m) { return m[0] === col; })) BNXI24.MODES.push([col, s.mode, s.id, s.mode]);
  });
  var orig = bnxi24_bnxPosImportRun_;
  var wrapped = function (payload) {
    payload = payload || {};
    var bills = payload.bills || [], lines = payload.lines || [], skippedLive = [];
    if (payload.mode !== 'reimport') {                                           /* already in the ERP → leave out */
      var have = {};
      try { var bm = bnxi24_readSheet_(bnxi24_tdb_(), 'BILL_MASTER', 'BILL_ID', ['BILL_ID', 'BILL_NUMBER', 'BILL_STATUS']);
        bm.rows.forEach(function (r) { if (r.BILL_NUMBER && !/CANCEL|VOID|DELETED/i.test(String(r.BILL_STATUS || ''))) have[String(r.BILL_NUMBER).trim()] = 1; }); } catch (e) {}
      bills = bills.filter(function (b) { var no = String(b && b.invoiceNumber || '').trim(); if (have[no]) { skippedLive.push(no); return false; } return true; });
      var keep = {}; bills.forEach(function (b) { keep[String(b.invoiceNumber).trim()] = 1; });
      lines = lines.filter(function (l) { return keep[String(l && l.invoiceNumber || '').trim()]; });
    }
    bills.forEach(function (b) {                                                  /* ZM / SW: whole payment = platform */
      var s = bnxAggImpSeries_(b.invoiceNumber); if (!s) return;
      var col = s.mode.toLowerCase() + 'total', tot = 0;
      ['cashtotal', 'cardtotal', 'onlinetotal', 'smartcardtotal', 'banktransfertotal', 'walletadjustmenttotal', 'credittotal'].forEach(function (k) { tot += Number(b[k]) || 0; b[k] = 0; });
      b[col] = tot || Number(b.net_Amount) || 0;
    });
    if (!bills.length) return { success: true, bills: 0, imported: [], skipped: skippedLive, conflicts: [], warnings: ['All ' + skippedLive.length + ' bills are already in the ERP — nothing to add.'] };
    var res = orig(Object.assign({}, payload, { bills: bills, lines: lines }));
    try {                                                                         /* channel on the new ZM / SW bills */
      if (res && !res.dryRun && res.imported && res.imported.length) bnxAggPayFix_(true, res.imported, true);
    } catch (e) { (res.warnings = res.warnings || []).push('Channel tag: ' + e.message); }
    if (res && skippedLive.length) { res.skipped = (res.skipped || []).concat(skippedLive); (res.warnings = res.warnings || []).push(skippedLive.length + ' bill(s) already in the ERP were left as they are.'); }
    return res;
  };
  wrapped.__bnxAgg = true;
  bnxi24_bnxPosImportRun_ = wrapped;
})();

/* 3: bills already in the ERP */
function RUN_AGGPAY_Check() { return bnxAggPayFix_(false); }
function RUN_AGGPAY_Fix()   { return bnxAggPayFix_(true); }

function bnxAggPayFix_(write, onlyNos, quiet) {
  var cid = BNX_AGGIMP.CLIENT_ID, only = null;
  if (onlyNos) { only = {}; onlyNos.forEach(function (n) { only[String(n).trim()] = 1; }); }
  var read = function (name) { var sh = bnxClientSheet(cid, name), v = sh.getDataRange().getValues(), h = (v[0] || []).map(String); return { sh: sh, v: v, c: function (k) { return h.indexOf(k); } }; };
  var BM = read(SHEETS.BILL_MASTER), b = BM.c, bills = {};
  for (var r = 1; r < BM.v.length; r++) {
    var no = String(BM.v[r][b('BILL_NUMBER')] || '').trim(), s = bnxAggImpSeries_(no); if (!s || (only && !only[no])) continue;
    if (/CANCEL|VOID|DELETED/i.test(String(BM.v[r][b('BILL_STATUS')] || ''))) continue;
    bills[String(BM.v[r][b('BILL_ID')])] = { r: r, no: no, s: s };
  }
  var fixes = [], tagRows = [];
  Object.keys(bills).forEach(function (id) { var x = bills[id], row = BM.v[x.r];
    if (b('SALES_CHANNEL') >= 0 && String(row[b('SALES_CHANNEL')] || '') !== x.s.mode) tagRows.push(x); });
  [SHEETS.PAYMENT_MASTER, SHEETS.SALES_LEDGER].forEach(function (name) {
    var T; try { T = read(name); } catch (e) { return; }
    var cb = T.c('BILL_ID'), cm = T.c('PAYMENT_MODE'), ci = T.c('PAYMENT_MODE_ID'); if (cb < 0 || cm < 0) return;
    for (var i = 1; i < T.v.length; i++) {
      var x = bills[String(T.v[i][cb])]; if (!x) continue;
      var m = String(T.v[i][cm] || '').toUpperCase();
      if (m === x.s.mode || /^(CREDIT|DUE|NC)$/.test(m)) continue;                /* already right / dues stay dues */
      fixes.push({ T: T, i: i, cm: cm, ci: ci, x: x, from: m, name: name });
    }
  });
  if (!quiet) {
    Logger.log('ZM/SW bills: ' + Object.keys(bills).length + ' · payment rows to set ZOMATO/SWIGGY: ' + fixes.length + ' · channel tags: ' + tagRows.length + (write ? '' : ' (read only)'));
    fixes.slice(0, 60).forEach(function (f) { Logger.log('  ' + f.name + ' ' + f.x.no + ': ' + f.from + ' → ' + f.x.s.mode); });
  }
  if (!write) return { bills: Object.keys(bills).length, fixes: fixes.length };
  fixes.forEach(function (f) { f.T.sh.getRange(f.i + 1, f.cm + 1).setValue(f.x.s.mode); if (f.ci >= 0) f.T.sh.getRange(f.i + 1, f.ci + 1).setValue(f.x.s.id); });
  tagRows.forEach(function (x) { BM.sh.getRange(x.r + 1, b('SALES_CHANNEL') + 1).setValue(x.s.mode); if (b('AGGREGATOR') >= 0) BM.sh.getRange(x.r + 1, b('AGGREGATOR') + 1).setValue(x.s.mode); });
  if (typeof bnxBillGenBump_ === 'function') bnxBillGenBump_(cid);
  if (!quiet) Logger.log('✅ Done. DSR › Refresh.');
  return { fixes: fixes.length, tagged: tagRows.length };
}

/* ──────────── v45 add-on: CUSTOMER_DUES clean-up + Customer Credit names (zz_fix_customer_dues.gs) ──────────── */
/* zz_fix_customer_dues.gs (2026-11-26) — NEW file. CUSTOMER_DUES clean-up (Transaction DB) + the same customers on bills.
   ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
   Found in CUSTOMER_DUES (CL00010):
     • 53 rows whose CUSTOMER_ID is not a customer but a typed name — "N:AMAN GUPTA", "NEW:ABANTIKA MAM", "NEW:NITIN SIR" …
       These dues are not linked to any customer, so Customer Credit / Due Collection / receipts / WhatsApp cannot find
       them. The same "N:…" ids are also on some bills (BILL_MASTER) and due receipts (DUES_RECEIPT).
     • 17 amounts saved as TEXT ("2,43,350.00") — totals skip or mis-read them.
     • rows with blank LOCATION_ID.
   FIX (nothing deleted):
     1. each "N:" / "NEW:" name → the CUSTOMER_MASTER customer with that name (same name, letters/spaces only);
        not in the master → a new customer is created (SOURCE = DUES_FIX). Two customers with that name → the first
        (lowest id) is used and the log says CHECK.
        The id is replaced in CUSTOMER_DUES, BILL_MASTER, DUES_RECEIPT, PAYMENT_MASTER, SALES_LEDGER, ORDER_MASTER.
     2. text amounts → numbers  3. blank LOCATION_ID → LOC00001  4. blank CUSTOMER_NAME → name from the master.
     A customer that then has TWO dues rows is only LISTED (merge them yourself: keep one row, set the other to 0).
   RUN: RUN_DUES_Check (read only) → RUN_DUES_Fix → Dashboard › Customer Credit / DSR › Refresh                     */

var BNX_DUESFIX = { CLIENT_ID: 'CL00010', LOCATION_ID: 'LOC00001' };

function RUN_DUES_Check() { return bnxDuesFix_(false); }
function RUN_DUES_Fix()   { return bnxDuesFix_(true); }

function bnxDuesN_(s) { return String(s == null ? '' : s).toUpperCase().replace(/^\s*(N|NEW)\s*:\s*/, '').replace(/[^A-Z0-9]+/g, ' ').trim(); }
function bnxDuesMoney_(v) { if (typeof v === 'number') return v; var t = String(v == null ? '' : v).trim(); if (!t) return v; var neg = /^\(.*\)$/.test(t) || /^-/.test(t); var n = Number(t.replace(/[₹,\s()\-]/g, '')); return isFinite(n) ? (neg ? -n : n) : v; }

function bnxDuesFix_(write) {
  var cid = BNX_DUESFIX.CLIENT_ID, now = new Date().toISOString(), out = [];
  var read = function (name) { var sh = bnxClientSheet(cid, name), v = sh.getDataRange().getValues(), h = (v[0] || []).map(function (x) { return String(x).trim(); }); return { sh: sh, v: v, h: h, c: function (k) { return h.indexOf(k); } }; };

  /* customers */
  var CM = read(SHEETS.CUSTOMER_MASTER), cc = CM.c, byId = {}, byName = {}, maxN = 0;
  for (var r = 1; r < CM.v.length; r++) {
    var id = String(CM.v[r][cc('CUSTOMER_ID')] || '').trim(); if (!id) continue;
    var nm = String(CM.v[r][cc('CUSTOMER_NAME')] || ''); byId[id] = nm;
    var k = bnxDuesN_(nm); if (k) (byName[k] = byName[k] || []).push(id);
    var m = id.match(/^CUS(\d+)$/); if (m) maxN = Math.max(maxN, +m[1]);
  }
  Object.keys(byName).forEach(function (k) { byName[k].sort(); });

  /* 1. placeholder ids → customer */
  var D = read(SHEETS.CUSTOMER_DUES || 'CUSTOMER_DUES'), dc = D.c, map = {}, creates = [];
  var placeholder = function (v) { return /^\s*(N|NEW)\s*:/i.test(String(v || '')); };
  var resolve = function (raw) {
    if (map[raw]) return map[raw];
    var k = bnxDuesN_(raw), hit = byName[k];
    if (hit && hit.length) { map[raw] = hit[0]; if (hit.length > 1) out.push('CHECK ' + raw + ' → ' + hit[0] + ' (also ' + hit.slice(1).join(', ') + ' have this name)'); return hit[0]; }
    var nid = ''; try { nid = generateShortId_(cid, 'CUSTOMER_ID'); } catch (e) {}
    if (!nid || byId[nid]) { maxN++; nid = 'CUS' + ('0000' + maxN).slice(-5); }
    byId[nid] = k; byName[k] = [nid]; map[raw] = nid; creates.push({ id: nid, name: String(raw).replace(/^\s*(N|NEW)\s*:\s*/i, '').trim() });
    return nid;
  };
  var duesFix = [];
  for (var i = 1; i < D.v.length; i++) {
    var row = D.v[i], ch = {};
    var cu = row[dc('CUSTOMER_ID')];
    if (placeholder(cu)) { ch.CUSTOMER_ID = resolve(String(cu).trim()); if (dc('CUSTOMER_NAME') >= 0 && !String(row[dc('CUSTOMER_NAME')] || '').trim()) ch.CUSTOMER_NAME = String(cu).replace(/^\s*(N|NEW)\s*:\s*/i, '').trim(); }
    ['OPENING_BALANCE', 'CURRENT_BALANCE'].forEach(function (k) { var x = dc(k); if (x >= 0 && typeof row[x] === 'string' && row[x].trim()) { var n = bnxDuesMoney_(row[x]); if (typeof n === 'number') ch[k] = n; } });
    if (dc('LOCATION_ID') >= 0 && !String(row[dc('LOCATION_ID')] || '').trim()) ch.LOCATION_ID = BNX_DUESFIX.LOCATION_ID;
    var finalId = ch.CUSTOMER_ID || String(cu || '').trim();
    if (dc('CUSTOMER_NAME') >= 0 && !ch.CUSTOMER_NAME && !String(row[dc('CUSTOMER_NAME')] || '').trim() && byId[finalId] && !/^[—-]?$/.test(byId[finalId])) ch.CUSTOMER_NAME = byId[finalId];
    if (Object.keys(ch).length) duesFix.push({ i: i, ch: ch, id: String(row[dc('CUSTOMER_DUES_ID')] || ''), from: String(cu || '') });
  }
  /* customers with two dues rows after the fix */
  var seen = {}, dup = [];
  for (var j = 1; j < D.v.length; j++) {
    var f = duesFix.filter(function (x) { return x.i === j; })[0], idj = f && f.ch.CUSTOMER_ID ? f.ch.CUSTOMER_ID : String(D.v[j][dc('CUSTOMER_ID')] || '').trim();
    if (!idj) continue; if (seen[idj]) dup.push(idj + ': ' + seen[idj] + ' + ' + D.v[j][dc('CUSTOMER_DUES_ID')]); else seen[idj] = String(D.v[j][dc('CUSTOMER_DUES_ID')]);
  }
  var unknown = []; for (var u = 1; u < D.v.length; u++) { var x0 = String(D.v[u][dc('CUSTOMER_ID')] || '').trim(); if (x0 && !placeholder(x0) && !byId[x0]) unknown.push(D.v[u][dc('CUSTOMER_DUES_ID')] + ' → ' + x0); }

  /* same placeholder ids on bills / receipts / payments */
  var other = [];
  [SHEETS.BILL_MASTER, SHEETS.DUES_RECEIPT || 'DUES_RECEIPT', SHEETS.PAYMENT_MASTER, SHEETS.SALES_LEDGER, SHEETS.ORDER_MASTER].forEach(function (name) {
    var T; try { T = read(name); } catch (e) { return; } var ci = T.c('CUSTOMER_ID'); if (ci < 0) return;
    var hits = []; for (var q = 1; q < T.v.length; q++) if (placeholder(T.v[q][ci])) hits.push(q);
    if (hits.length) other.push({ T: T, ci: ci, rows: hits, name: name });
  });
  other.forEach(function (o) { o.rows.forEach(function (q) { resolve(String(o.T.v[q][o.ci]).trim()); }); });

  Logger.log('CUSTOMER_DUES: ' + (D.v.length - 1) + ' rows · rows to fix: ' + duesFix.length + (write ? '' : ' (read only)'));
  Logger.log('  name ids → customers: ' + Object.keys(map).length + ' (new customers: ' + creates.length + ')');
  Object.keys(map).slice(0, 80).forEach(function (raw) { Logger.log('    ' + raw + ' → ' + map[raw] + (creates.some(function (c) { return c.id === map[raw]; }) ? ' (new)' : ' ' + byId[map[raw]])); });
  Logger.log('  text amounts → numbers: ' + duesFix.filter(function (x) { return 'CURRENT_BALANCE' in x.ch || 'OPENING_BALANCE' in x.ch; }).length + ' rows · blank location: ' + duesFix.filter(function (x) { return x.ch.LOCATION_ID; }).length);
  other.forEach(function (o) { Logger.log('  ' + o.name + ': ' + o.rows.length + ' row(s) with a name instead of a customer id'); });
  out.forEach(function (s) { Logger.log('  ' + s); });
  if (dup.length) { Logger.log('  CHECK — customer with TWO dues rows (keep one, make the other 0):'); dup.forEach(function (s) { Logger.log('    ' + s); }); }
  if (unknown.length) { Logger.log('  CHECK — customer id not in CUSTOMER_MASTER:'); unknown.slice(0, 30).forEach(function (s) { Logger.log('    ' + s); }); }
  if (!write) return { fix: duesFix.length, map: Object.keys(map).length, creates: creates.length, dup: dup.length };

  var lock = LockService.getScriptLock(), got = false; for (var t = 0; t < 8 && !got; t++) { got = lock.tryLock(30000); if (!got) Utilities.sleep(2000); }
  if (!got) throw new Error('The ERP was busy for 4 minutes — run again after closing time.');
  try {
    if (creates.length) creates.forEach(function (c) {
      var obj = { CUSTOMER_ID: c.id, CLIENT_ID: cid, LOCATION_ID: BNX_DUESFIX.LOCATION_ID, CUSTOMER_NAME: c.name, CUSTOMER_TYPE: 'Individual', IS_ACTIVE: true, CREATED_AT: now, UPDATED_AT: now, SOURCE: 'DUES_FIX' };
      CM.sh.appendRow(CM.h.map(function (k) { return obj[k] === undefined ? '' : obj[k]; }));
    });
    duesFix.forEach(function (x) { Object.keys(x.ch).forEach(function (k) { if (dc(k) >= 0) D.sh.getRange(x.i + 1, dc(k) + 1).setValue(x.ch[k]); });
      if (dc('UPDATED_AT') >= 0) D.sh.getRange(x.i + 1, dc('UPDATED_AT') + 1).setValue(now); });
    other.forEach(function (o) { o.rows.forEach(function (q) { o.T.sh.getRange(q + 1, o.ci + 1).setValue(map[String(o.T.v[q][o.ci]).trim()]); }); });
    try { CacheService.getScriptCache().removeAll(['custmap_' + cid, 'customermap_' + cid]); } catch (e) {}
    if (typeof bnxBillGenBump_ === 'function') bnxBillGenBump_(cid);
    Logger.log('✅ Dues fixed. Customer Credit / DSR › Refresh.');
  } finally { lock.releaseLock(); }
  return { fixed: duesFix.length, created: creates.length };
}

/* Customer Credit / Due Collection showed "UNKNOWN": the dues list takes the name ONLY from CUSTOMER_MASTER. A dues row whose
   customer is not in the master (typed "N:NAME" ids, or a customer missing / named "—" there) came back as "Unknown".
   Now the name falls back to CUSTOMER_DUES.CUSTOMER_NAME, then to the typed name in the id. Works for cached answers too.
   (Load order: this file must load after the core file — keep it above zz_FINAL_ROUTER.gs.) */
(function () {
  if (typeof bnxGetDueCollection !== 'function' || bnxGetDueCollection.__bnxDuesName) return;
  var inner = bnxGetDueCollection;
  var f = function (session, payload) {
    var r = inner.apply(this, arguments);
    try {
      var list = r && r.data && r.data.customers; if (!Array.isArray(list)) return r;
      var bad = list.filter(function (c) { return !c.customer || /^(unknown|—|-)$/i.test(String(c.customer).trim()); }); if (!bad.length) return r;
      var names = {}, cid = String(session && session.CLIENT_ID || '');
      try { var v = bnxClientSheet(cid, SHEETS.CUSTOMER_DUES).getDataRange().getValues(), h = v[0] || [], ci = h.indexOf('CUSTOMER_ID'), cn = h.indexOf('CUSTOMER_NAME');
        if (ci >= 0 && cn >= 0) for (var i = 1; i < v.length; i++) { var nm = String(v[i][cn] || '').trim(); if (nm && !/^(unknown|—|-)$/i.test(nm)) names[String(v[i][ci]).trim()] = nm; } } catch (e) {}
      bad.forEach(function (c) { var id = String(c.customerId || '').trim();
        c.customer = names[id] || id.replace(/^\s*(N|NEW)\s*:\s*/i, '').trim() || 'Unknown';
        if (/^\s*(N|NEW)\s*:/i.test(id)) c.unlinked = true; });                /* run RUN_DUES_Fix to link them */
    } catch (e) {}
    return r;
  };
  Object.keys(inner).forEach(function (k) { try { f[k] = inner[k]; } catch (e) {} });
  f.__bnxDuesName = true; bnxGetDueCollection = f;
})();

/* ──────────── v45 add-on: ONE-BUTTON DATABASE CLEAN-UP (Transaction DB + Master DB) ────────────
   RUN_DB_CheckAll  — read only: runs every check, writes nothing. Read the Execution log.
   RUN_DB_FixAll    — runs every repair in order. Each step is a separate run (Apps Script stops a run after 6 min):
                      the first press does step 1 and sets a 1-minute timer for the next step, until all are done.
                      Progress / results: sheet "DB_FIX_LOG" in the Transaction DB + RUN_DB_Status.
   Steps: 1 text amounts → numbers (all money columns) · 2 blank CLIENT_ID on item / payment / ledger / dues rows
          3 ITEM_MASTER + aliases · 4 bill lines ITEM_ID / CODE / CATEGORY / GROUP · 5 bills without item detail
          6 Zomato / Swiggy bills → ZOMATO / SWIGGY · 7 customer dues ids / names / amounts · 8 nightly item fill on
   Nothing is deleted. Run it after closing time. */
var BNX_DBFIX = { CLIENT_ID: 'CL00010', KEY: 'BNX_DBFIX_STEP' };
var BNX_DBFIX_STEPS = [
  ['Text amounts → numbers', function () { var h = bnxTextMoneyScan_(BNX_DBFIX.CLIENT_ID, true); return h.length + ' cell(s) fixed'; }],
  ['Blank CLIENT_ID', function () { return bnxDbFixClientId_(true); }],
  ['Item master + aliases', function () { bnxImapMaster_(true); return 'done'; }],
  ['Bill lines item / code / category', function () { bnxImapBills_(true); return 'done'; }],
  ['Bills without item detail', function () { var r = bnxNoItemRun_(true); return JSON.stringify(r); }],
  ['Zomato / Swiggy bills', function () { return JSON.stringify(bnxAggPayFix_(true)); }],
  ['Customer dues', function () { return JSON.stringify(bnxDuesFix_(true)); }],
  ['Guest dues = FY sheet (Dues tab)', function () { return JSON.stringify(bnxDueSync_(true)); }],
  ['Nightly item fill on', function () { RUN_ITEMMAP_NightlyOn(); return 'on (04:30)'; }]
];
function bnxDbFixClientId_(write) {
  var cid = BNX_DBFIX.CLIENT_ID, out = [];
  [SHEETS.BILL_ITEMS, SHEETS.PAYMENT_MASTER, SHEETS.SALES_LEDGER, SHEETS.DUES_RECEIPT || 'DUES_RECEIPT', SHEETS.CUSTOMER_DUES || 'CUSTOMER_DUES'].forEach(function (name) {
    var sh; try { sh = bnxClientSheet(cid, name); } catch (e) { return; } var n = sh.getLastRow() - 1; if (n < 1) return;
    var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), c = h.indexOf('CLIENT_ID'); if (c < 0) return;
    var rg = sh.getRange(2, c + 1, n, 1), v = rg.getValues(), hit = 0;
    for (var i = 0; i < n; i++) if (!String(v[i][0] || '').trim()) { v[i][0] = cid; hit++; }
    if (hit && write) rg.setValues(v); if (hit) out.push(name + ' ' + hit);
  });
  /* BILL_MASTER rows without CLIENT_ID are left out of the DSR on purpose until checked — listed only */
  try { var bm = bnxClientSheet(cid, SHEETS.BILL_MASTER), bh = bm.getRange(1, 1, 1, bm.getLastColumn()).getValues()[0].map(String), bc = bh.indexOf('CLIENT_ID'), bn = bh.indexOf('BILL_NUMBER');
    if (bc >= 0 && bm.getLastRow() > 1) { var bv = bm.getRange(2, 1, bm.getLastRow() - 1, Math.max(bc, bn) + 1).getValues(), miss = [];
      bv.forEach(function (r) { if (!String(r[bc] || '').trim() && r[bn]) miss.push(r[bn]); });
      if (miss.length) out.push('BILL_MASTER without CLIENT_ID (check, not changed): ' + miss.length + ' e.g. ' + miss.slice(0, 8).join(', ')); } } catch (e) {}
  return out.join(' · ') || 'none';
}
function bnxDbFixLog_(step, name, result) {
  try { var ss = bnxClientSheet(BNX_DBFIX.CLIENT_ID, SHEETS.BILL_MASTER).getParent(), sh = ss.getSheetByName('DB_FIX_LOG') || ss.insertSheet('DB_FIX_LOG');
    if (sh.getLastRow() < 1) sh.appendRow(['AT', 'STEP', 'NAME', 'RESULT']);
    sh.appendRow([new Date(), step, name, String(result).slice(0, 45000)]); } catch (e) {}
}
function RUN_DB_CheckAll() {
  Logger.log('══ 1 text amounts'); try { var t = bnxTextMoneyScan_(BNX_DBFIX.CLIENT_ID, false); Logger.log(t.length + ' cell(s)\n' + t.slice(0, 30).join('\n')); } catch (e) { Logger.log('  ' + e.message); }
  Logger.log('══ 2 blank CLIENT_ID: ' + bnxDbFixClientId_(false));
  Logger.log('══ 3+4 items'); try { RUN_ITEMMAP_Check(); } catch (e) { Logger.log('  ' + e.message); }
  Logger.log('══ 5 no item detail'); try { RUN_NOITEM_Check(); } catch (e) { Logger.log('  ' + e.message); }
  Logger.log('══ 6 Zomato / Swiggy'); try { RUN_AGGPAY_Check(); } catch (e) { Logger.log('  ' + e.message); }
  Logger.log('══ 7 customer dues'); try { RUN_DUES_Check(); } catch (e) { Logger.log('  ' + e.message); }
}
function RUN_DB_FixAll() { PropertiesService.getScriptProperties().setProperty(BNX_DBFIX.KEY, '0'); bnxDbFixNext_(); }
function bnxDbFixNext_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bnxDbFixNext_') ScriptApp.deleteTrigger(t); });
  var P = PropertiesService.getScriptProperties(), i = Number(P.getProperty(BNX_DBFIX.KEY) || 0);
  if (i >= BNX_DBFIX_STEPS.length) { Logger.log('✅ All steps done. DSR › Refresh · Customer Credit › Refresh.'); return; }
  var s = BNX_DBFIX_STEPS[i], res;
  try { res = s[1](); } catch (e) { res = '❌ ' + e.message; }
  Logger.log('Step ' + (i + 1) + '/' + BNX_DBFIX_STEPS.length + ' ' + s[0] + ': ' + res); bnxDbFixLog_(i + 1, s[0], res);
  var tries = Number(P.getProperty(BNX_DBFIX.KEY + '_TRY') || 0);
  if (/^❌ .*busy/i.test(String(res)) && tries < 6) { P.setProperty(BNX_DBFIX.KEY + '_TRY', String(tries + 1)); ScriptApp.newTrigger('bnxDbFixNext_').timeBased().after(5 * 60 * 1000).create(); Logger.log('ERP busy — this step is tried again in 5 minutes.'); return; }
  P.setProperty(BNX_DBFIX.KEY, String(i + 1)); P.setProperty(BNX_DBFIX.KEY + '_TRY', '0');
  if (i + 1 < BNX_DBFIX_STEPS.length) { ScriptApp.newTrigger('bnxDbFixNext_').timeBased().after(60 * 1000).create(); Logger.log('Next step starts by itself in ~1 minute (see DB_FIX_LOG).'); }
  else Logger.log('✅ All steps done. DSR › Refresh · Customer Credit › Refresh.');
}
function RUN_DB_Status() { Logger.log('Next step: ' + (Number(PropertiesService.getScriptProperties().getProperty(BNX_DBFIX.KEY) || 0) + 1) + ' of ' + BNX_DBFIX_STEPS.length); }
function RUN_DB_StopFix() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bnxDbFixNext_') ScriptApp.deleteTrigger(t); }); Logger.log('Stopped.'); }

/* ──────────── v45 add-on: GUEST DUES = the FY sheet (FY 25-27 Hashtag Siliguri › Dues) ────────────
   WHY Customer Credit showed ₹39,32,624 / ₹34,98,827 instead of ₹41,37,696: CUSTOMER_DUES.CURRENT_BALANCE is a stored
   number that drifted from your Dues sheet (e.g. UMANG SARAF sheet ₹1,43,651 / ERP ₹5,518 · MR BIKASH BANSAL ₹1,39,798 /
   ₹2,230 · PRATHAM MITTA ₹1,31,438 / ₹0 · NARAYAN SIR sheet ₹0 / ERP ₹1,42,887 · AVIK AGARWAL, SANDEEP, CHETAN missing),
   and CUSTOMER_DUES_BILLWISE is an old copy (470 rows, ₹44,56,812).
   RUN_DUESYNC_Check  — read only: sheet total, ERP total, every party that differs.
   RUN_DUESYNC_Fix    — 1. backup tabs CUSTOMER_DUES_BAK_<date> and CUSTOMER_DUES_BILLWISE_BAK_<date>
                         2. CUSTOMER_DUES: one row per party = sum of its open bills in the sheet; other rows → 0 (CLEARED);
                            party not in CUSTOMER_MASTER → new customer (SOURCE DUES_SHEET)
                         3. CUSTOMER_DUES_BILLWISE = the sheet's open bills (with CUSTOMER_ID)
   Run again any time the sheet changes. Sheet: Script property BNX_DUES_SHEET_ID (optional, else found by name). */
var BNX_DUESYNC = { CLIENT_ID: 'CL00010', NAME: 'FY 25-27 Hashtag Siliguri', TAB: 'Dues', FIRST_ROW: 4, LOCATION_ID: 'LOC00001' };
function RUN_DUESYNC_Check() { return bnxDueSync_(false); }
function RUN_DUESYNC_Fix()   { return bnxDueSync_(true); }
function bnxDueSyncN_(s) { return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]+/g, ''); }
function bnxDueSync_(write) {
  var C = BNX_DUESYNC, cid = C.CLIENT_ID, now = new Date(), iso = now.toISOString(), r2 = function (v) { return Math.round(v * 100) / 100; };
  var num = function (v) { if (typeof v === 'number') return v; var n = Number(String(v == null ? '' : v).replace(/[₹,\s]/g, '')); return isFinite(n) ? n : 0; };
  /* 1. the sheet: open bills (Dues column K ≠ 0) */
  var sh = bnxSheetByNameOrProp_('BNX_DUES_SHEET_ID', C.NAME, C.TAB, 'BNX_DUES_SHEET_TAB');
  var last = sh.getLastRow(), v = last >= C.FIRST_ROW ? sh.getRange(C.FIRST_ROW, 1, last - C.FIRST_ROW + 1, 13).getValues() : [];
  var bills = v.filter(function (r) { return String(r[2] || '').trim() && String(r[4] || '').trim() && Math.abs(num(r[10])) > 0.5; });
  var sheetTotal = r2(bills.reduce(function (a, r) { return a + num(r[10]); }, 0));
  /* 2. customers */
  var read = function (name) { var s = bnxClientSheet(cid, name), vv = s.getDataRange().getValues(), h = (vv[0] || []).map(function (x) { return String(x).trim(); }); return { sh: s, v: vv, h: h, c: function (k) { return h.indexOf(k); } }; };
  var CM = read(SHEETS.CUSTOMER_MASTER), cc = CM.c, byN = {}, nameOf = {}, maxN = 0;
  for (var i = 1; i < CM.v.length; i++) { var id = String(CM.v[i][cc('CUSTOMER_ID')] || '').trim(); if (!id) continue; nameOf[id] = String(CM.v[i][cc('CUSTOMER_NAME')] || '');
    var k = bnxDueSyncN_(nameOf[id]); if (k) (byN[k] = byN[k] || []).push(id); var m = id.match(/^CUS(\d+)$/); if (m) maxN = Math.max(maxN, +m[1]); }
  var D = read(SHEETS.CUSTOMER_DUES || 'CUSTOMER_DUES'), dc = D.c, rowsOf = {}, erpTotal = 0;
  for (var j = 1; j < D.v.length; j++) { var cu = String(D.v[j][dc('CUSTOMER_ID')] || '').trim(), bal = num(D.v[j][dc('CURRENT_BALANCE')]); erpTotal += bal; (rowsOf[cu] = rowsOf[cu] || []).push({ r: j, bal: bal }); }
  /* CUSTOMER_DUES_BILLWISE is not in the core routing map → open it in the same Transaction DB file as CUSTOMER_DUES */
  var bwSh = D.sh.getParent().getSheetByName('CUSTOMER_DUES_BILLWISE');
  if (!bwSh) { bwSh = D.sh.getParent().insertSheet('CUSTOMER_DUES_BILLWISE'); bwSh.getRange(1, 1, 1, 14).setValues([['Month', 'DATE', 'BILL', 'AMOUNT', 'PARTY', 'CASH', 'UPI', 'BANK', 'DISC', 'RDATE', 'DUES', 'STATUS', 'GROUP', 'CUSTOMER_ID']]); }
  var BW = (function () { var vv = bwSh.getDataRange().getValues(), h = (vv[0] || []).map(function (x) { return String(x).trim(); }); return { sh: bwSh, v: vv, h: h, c: function (k) { return h.indexOf(k); } }; })(), bc = BW.c, bwMap = {};
  for (var q = 1; q < BW.v.length; q++) { var pid = String(BW.v[q][bc('CUSTOMER_ID')] || '').trim(); if (pid) bwMap[bnxDueSyncN_(BW.v[q][bc('PARTY')])] = pid; }
  var creates = [], pick = {}, notes = [];
  var custFor = function (party) {
    var k = bnxDueSyncN_(party); if (pick[k]) return pick[k];
    var c = byN[k] || [], id = '';
    if (c.length === 1) id = c[0];
    else if (c.length > 1) { id = (bwMap[k] && c.indexOf(bwMap[k]) >= 0) ? bwMap[k] : (c.filter(function (x) { return (rowsOf[x] || []).some(function (y) { return y.bal > 0; }); })[0] || c[0]); notes.push('CHECK ' + party + ' → ' + id + ' (same name: ' + c.join(', ') + ')'); }
    else if (bwMap[k]) { id = bwMap[k]; if (!nameOf[id]) { nameOf[id] = String(party).trim(); creates.push({ id: id, name: String(party).trim() }); } }
    else { maxN++; id = 'CUS' + ('0000' + maxN).slice(-5); while (nameOf[id]) { maxN++; id = 'CUS' + ('0000' + maxN).slice(-5); } nameOf[id] = party; creates.push({ id: id, name: String(party).trim() }); }
    pick[k] = id; return id;
  };
  var want = {}, lastDate = {}, billRows = [];
  bills.forEach(function (r) { var id = custFor(r[4]), d = num(r[10]); want[id] = r2((want[id] || 0) + d);
    var dt = r[1] instanceof Date ? r[1] : null; if (dt && (!lastDate[id] || dt > lastDate[id])) lastDate[id] = dt;
    billRows.push([r[0], r[1], r[2], num(r[3]), String(r[4]).trim(), num(r[5]), num(r[6]), num(r[7]), num(r[8]), r[9] || '', d, r[11] || 'Dues', r[12] || '', id]); });
  /* 3. compare */
  var diffs = [], ids = {}; Object.keys(want).forEach(function (x) { ids[x] = 1; }); Object.keys(rowsOf).forEach(function (x) { ids[x] = 1; });
  Object.keys(ids).forEach(function (id) { var a = want[id] || 0, b = (rowsOf[id] || []).reduce(function (s, y) { return s + y.bal; }, 0); if (Math.abs(a - b) > 1) diffs.push([r2(a - b), id, nameOf[id] || '', r2(a), r2(b)]); });
  diffs.sort(function (x, y) { return Math.abs(y[0]) - Math.abs(x[0]); });
  Logger.log('Dues sheet: ' + bills.length + ' open bills · ₹' + sheetTotal + '  |  ERP CUSTOMER_DUES: ₹' + r2(erpTotal) + '  |  difference ₹' + r2(sheetTotal - erpTotal));
  Logger.log('Parties that differ: ' + diffs.length + ' · new customers needed: ' + creates.length + (write ? '' : ' (read only)'));
  diffs.slice(0, 120).forEach(function (d) { Logger.log('  ' + d[2] + ' [' + d[1] + ']  sheet ₹' + d[3] + '  ERP ₹' + d[4] + '  (' + (d[0] > 0 ? '+' : '') + d[0] + ')'); });
  creates.forEach(function (c) { Logger.log('  new customer ' + c.id + ' ' + c.name); }); notes.forEach(function (s) { Logger.log('  ' + s); });
  if (!write) return { sheet: sheetTotal, erp: r2(erpTotal), diffs: diffs.length };

  var lock = LockService.getScriptLock(), got = false; for (var t = 0; t < 8 && !got; t++) { got = lock.tryLock(30000); if (!got) Utilities.sleep(2000); }
  if (!got) throw new Error('The ERP was busy for 4 minutes — run again after closing time.');
  try {
    var tag = Utilities.formatDate(now, 'Asia/Kolkata', 'yyyyMMdd_HHmm');
    if (!BNX_DUESYNC.NO_BAK) { D.sh.copyTo(D.sh.getParent()).setName('CUSTOMER_DUES_BAK_' + tag); BW.sh.copyTo(BW.sh.getParent()).setName('CUSTOMER_DUES_BILLWISE_BAK_' + tag); }
    creates.forEach(function (c) { var o = { CUSTOMER_ID: c.id, CLIENT_ID: cid, LOCATION_ID: C.LOCATION_ID, CUSTOMER_NAME: c.name, CUSTOMER_TYPE: 'Individual', IS_ACTIVE: true, CREATED_AT: iso, UPDATED_AT: iso, SOURCE: 'DUES_SHEET' };
      CM.sh.appendRow(CM.h.map(function (h) { return o[h] === undefined ? '' : o[h]; })); });
    /* CUSTOMER_DUES: first row of each customer = sheet total, any other row of that customer = 0 */
    var set = function (r, k, val) { if (dc(k) >= 0) D.v[r][dc(k)] = val; };
    Object.keys(rowsOf).forEach(function (id) { rowsOf[id].forEach(function (y, n) { var bal = n === 0 ? (want[id] || 0) : 0;
      if (Math.abs(bal - y.bal) > 0.004 || n > 0) { set(y.r, 'CURRENT_BALANCE', bal); set(y.r, 'STATUS', bal > 0.5 ? 'OPEN' : 'CLEARED'); set(y.r, 'UPDATED_AT', iso);
        if (lastDate[id] && n === 0) set(y.r, 'LAST_TRANSACTION_DATE', lastDate[id]); } }); });
    var add = [];
    Object.keys(want).forEach(function (id) { if (rowsOf[id]) return; var o = { CUSTOMER_DUES_ID: 'CDU-SYNC-' + id, CLIENT_ID: cid, LOCATION_ID: C.LOCATION_ID, CUSTOMER_ID: id, OPENING_BALANCE: 0, CURRENT_BALANCE: want[id],
      LAST_TRANSACTION_DATE: lastDate[id] || '', LAST_TRANSACTION_TYPE: 'DUES_SHEET', STATUS: want[id] > 0.5 ? 'OPEN' : 'CLEARED', UPDATED_AT: iso, CUSTOMER_NAME: nameOf[id] || '' };
      add.push(D.h.map(function (h) { return o[h] === undefined ? '' : o[h]; })); });
    if (D.v.length > 1) D.sh.getRange(2, 1, D.v.length - 1, D.h.length).setValues(D.v.slice(1).map(function (r) { return r.slice(0, D.h.length); }));
    if (add.length) D.sh.getRange(D.sh.getLastRow() + 1, 1, add.length, D.h.length).setValues(add);
    /* CUSTOMER_DUES_BILLWISE = the sheet's open bills */
    var H = ['Month', 'DATE', 'BILL', 'AMOUNT', 'PARTY', 'CASH', 'UPI', 'BANK', 'DISC', 'RDATE', 'DUES', 'STATUS', 'GROUP', 'CUSTOMER_ID'];
    var out = billRows.map(function (b) { var o = {}; H.forEach(function (h, x) { o[h] = b[x]; }); return BW.h.map(function (h) { return o[h] === undefined ? '' : o[h]; }); });
    if (BW.sh.getLastRow() > 1) BW.sh.getRange(2, 1, BW.sh.getLastRow() - 1, BW.sh.getLastColumn()).clearContent();
    if (out.length) BW.sh.getRange(2, 1, out.length, BW.h.length).setValues(out);
    try { if (typeof bnxBillGenBump_ === 'function') bnxBillGenBump_(cid); CacheService.getScriptCache().removeAll(['custmap_' + cid, 'customermap_' + cid]); } catch (e) {}
    try { bnxDuesDedupe_(cid, true); } catch (e) { Logger.log('dedupe: ' + e.message); }
    Logger.log('✅ CUSTOMER_DUES = sheet ₹' + sheetTotal + ' (' + Object.keys(want).length + ' parties, ' + add.length + ' new dues rows) · CUSTOMER_DUES_BILLWISE = ' + out.length + ' open bills. Backups: *_BAK_' + tag);
  } finally { lock.releaseLock(); }
  return { sheet: sheetTotal };
}

/* =====================================================================================================
 * v46 2026-11-26 — BANK SHEETS + SWEEP (Swift) SYNC → TRANSACTION DB, and COLLECTION RECO 6 am → 6 am
 *
 *  1. Bank sheets (each client keeps its own Google bank sheet, one tab per account):
 *       CL00010 → Vanns34, Vanns31      CL00011 → SNPA, SNPA IC
 *     Every row of each tab goes into TRANSACTION DB › BANK_TXN_REGISTER (one register, ACCOUNT = tab).
 *     Key = account + bank Tran Id + date + amount, so a row is never added twice. A row that was already
 *     imported earlier from an Excel file (other key, same date / amount / narration) is skipped too.
 *     Extra columns after the 16 core ones: TXN_TIME, TRAN_ID, BALANCE, BIZ_DATE, SETTLE_DATE.
 *     ICICI Sweep / POS settlement credits (EZY/…POS_SET_…_ddmmyy, MID … CCARD PMT ddmmyy) → MODE SWEEP,
 *     SETTLE_DATE from the narration. Direct UPI credits → MODE UPI, mapped to the 6 am business day.
 *  2. Sweep (Swift) transactions: FY sheet › TransSweep → TRANSACTION DB › Swift_Transaction Report
 *     (new Transaction IDs added; the Collection Date typed in the FY sheet is copied over every time),
 *     settlement block of TransSweep → Swift_Settlement Report.
 *  3. GET_COLL_RECO {from,to}: per business day (6 am → 6 am): ERP Card / UPI (payments of the bills)
 *     vs Sweep Card / UPI (by Collection Date, else transaction time − 6 h) vs direct UPI bank credits;
 *     per settlement date: Sweep net vs bank Sweep credit. Every Sweep transaction / UPI credit is
 *     auto-linked to an ERP bill (same day, same amount, same mode, nearest time); a manual link wins.
 *     COLL_LINK_SAVE {links:[{key,src,billId,billNo,amount,mode,unlink}]} → TRANSACTION DB › COLLECTION_LINK.
 *  4. BANK_SYNC_CFG {op:'GET'|'SAVE',cfg}, BANK_SYNC_RUN {what:'bank'|'sweep'|'all'}.
 *     RUN_BSYNC_All, RUN_BSYNC_TriggerOn (hourly) / RUN_BSYNC_TriggerOff, RUN_BSYNC_Dedupe (duplicates in the
 *     register → MAP_STATUS DUPLICATE, never deleted; duplicate Sweep rows removed after a backup tab).
 * ===================================================================================================== */
var BNX_BSYNC_DEFAULTS = {
  CL00010: { since: '2026-04-01',
    bank: [{ id: '1vzVx0RykYcrylyZNJnxxV5FkaalPF9gyR2tSNBhyz9g', tab: 'Vanns34', account: 'Vanns34', mirror: 'ICICBank' },
           { id: '1vzVx0RykYcrylyZNJnxxV5FkaalPF9gyR2tSNBhyz9g', tab: 'Vanns31', account: 'Vanns31' }],
    sweep: { id: '', name: 'FY 25-27 Hashtag Siliguri', prop: 'BNX_DUES_SHEET_ID', tab: 'TransSweep' } },
  CL00011: { since: '2026-04-01',
    bank: [{ id: '1vzVx0RykYcrylyZNJnxxV5FkaalPF9gyR2tSNBhyz9g', tab: 'SNPA', account: 'SNPA' },
           { id: '1vzVx0RykYcrylyZNJnxxV5FkaalPF9gyR2tSNBhyz9g', tab: 'SNPA IC', account: 'SNPA IC' }],
    sweep: null }
};
var BNX_BS_EXTRA_ = ['TXN_TIME', 'TRAN_ID', 'BALANCE', 'BIZ_DATE', 'SETTLE_DATE'];
var BNX_COLL_LINK_HDR_ = ['TXN_KEY', 'SOURCE', 'BILL_ID', 'BILL_NUMBER', 'AMOUNT', 'MODE', 'LINK_TYPE', 'UPDATED_AT', 'UPDATED_BY'];

function bnxBsRole_(s) { return ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'MANAGER', 'ACCOUNTANT', 'ACCOUNTS', 'DEVELOPER', 'CASHIER'].indexOf(String(s && s.ROLE || '').toUpperCase()) >= 0; }
function bnxBsAdmin_(s) { return ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'ACCOUNTANT', 'ACCOUNTS', 'DEVELOPER'].indexOf(String(s && s.ROLE || '').toUpperCase()) >= 0; }
function bnxBsTz_() { try { return bnxTz_(); } catch (e) { return 'Asia/Kolkata'; } }
function bnxBsNum_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v == null ? '' : v).trim(); if (!s || /^-+$/.test(s)) return 0;
  var neg = /^\(.*\)$/.test(s) || /DR$/i.test(s); s = s.replace(/[(),₹\s]|CR$|DR$/gi, '');
  var n = Number(s); return isFinite(n) ? (neg ? -Math.abs(n) : n) : 0;
}
var BNX_BS_MON_ = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
/* any date cell → {d:'yyyy-MM-dd', t:'HH:mm:ss'|''} */
function bnxBsDt_(v, tz) {
  tz = tz || bnxBsTz_();
  if (v instanceof Date && !isNaN(v.getTime())) {
    var t = Utilities.formatDate(v, tz, 'HH:mm:ss');
    return { d: Utilities.formatDate(v, tz, 'yyyy-MM-dd'), t: t === '00:00:00' ? '' : t };
  }
  if (typeof v === 'number' && v > 20000 && v < 100000) return bnxBsDt_(new Date(Math.round((v - 25569) * 864e5)), 'UTC');
  var s = String(v == null ? '' : v).trim(); if (!s || s === '-') return { d: '', t: '' };
  var tm = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i), t2 = '';
  if (tm) { var h = +tm[1]; if (tm[4]) { if (/PM/i.test(tm[4]) && h < 12) h += 12; if (/AM/i.test(tm[4]) && h === 12) h = 0; }
    t2 = ('0' + h).slice(-2) + ':' + tm[2] + ':' + (tm[3] || '00'); }
  var m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) return { d: m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2), t: t2 };
  m = s.match(/^(\d{1,2})[\/\-. ]([A-Za-z]{3,9}|\d{1,2})[\/\-. ,]+(\d{2,4})/);
  if (m) {
    var mo = /\d/.test(m[2]) ? +m[2] : BNX_BS_MON_[m[2].slice(0, 3).toUpperCase()], y = m[3].length === 2 ? '20' + m[3] : m[3];
    if (!mo) return { d: '', t: '' };
    return { d: y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + m[1]).slice(-2), t: t2 };
  }
  return { d: '', t: t2 };
}
function bnxBsShift_(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
/* 6 am → 6 am business day */
function bnxBsBiz_(d, t) { return d && t && t < '06:00:00' ? bnxBsShift_(d, -1) : d; }
function bnxBsNorm_(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function bnxBsSheetId_(v) { var s = String(v || '').trim(), m = s.match(/\/d\/([A-Za-z0-9_-]{20,})/); if (m) return m[1]; return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : ''; }

/* ---------- config (Script property per client; defaults above) ---------- */
function bnxBsCfg_(cid) {
  var raw = null; try { raw = JSON.parse(PropertiesService.getScriptProperties().getProperty('BNX_BSYNC_' + cid) || 'null'); } catch (e) {}
  var c = raw || JSON.parse(JSON.stringify(BNX_BSYNC_DEFAULTS[cid] || { since: '2026-04-01', bank: [], sweep: null }));
  c.bank = Array.isArray(c.bank) ? c.bank : [];
  var def = (BNX_BSYNC_DEFAULTS[cid] || {}).bank || [];
  c.bank.forEach(function (b) { if (b.mirror == null) { var d = def.filter(function (x) { return x.tab === b.tab; })[0]; if (d && d.mirror) b.mirror = d.mirror; } }); c.since = /^\d{4}-\d{2}-\d{2}$/.test(c.since || '') ? c.since : '2026-04-01';
  return c;
}
function bnxBsCids_() {
  var set = {}; Object.keys(BNX_BSYNC_DEFAULTS).forEach(function (k) { set[k] = 1; });
  try { var p = PropertiesService.getScriptProperties().getProperties(); Object.keys(p).forEach(function (k) { var m = k.match(/^BNX_BSYNC_(CL\d+)$/); if (m) set[m[1]] = 1; }); } catch (e) {}
  return Object.keys(set);
}
function bnxBsCfgAction_(s, p) {
  var cid = String(s.CLIENT_ID || ''); if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
  p = p || {};
  if (String(p.op || 'GET').toUpperCase() !== 'SAVE') {
    var st = {}; try { st = JSON.parse(PropertiesService.getScriptProperties().getProperty('BNX_BSYNC_LAST_' + cid) || '{}'); } catch (e) {}
    return { success: true, data: { cfg: bnxBsCfg_(cid), last: st } };
  }
  if (!bnxBsAdmin_(s)) return { success: false, statusCode: 403, error: 'Only Owner / Admin / Accounts can change bank sheets' };
  var c = p.cfg || {}, out = { since: /^\d{4}-\d{2}-\d{2}$/.test(c.since || '') ? c.since : '2026-04-01', bank: [], sweep: null };
  (Array.isArray(c.bank) ? c.bank : []).slice(0, 12).forEach(function (b) {
    var id = bnxBsSheetId_(b.id || b.link), tab = String(b.tab || '').trim().slice(0, 80);
    if (!id || !tab) return; out.bank.push({ id: id, tab: tab, account: String(b.account || tab).trim().slice(0, 40), mirror: String(b.mirror || '').trim().replace(/^(BILL_|ORDER_|KOT_|PAYMENT_|CUSTOMER_|BANK_TXN_REGISTER|SALES_LEDGER|LEDGER_)\w*$/i, '').slice(0, 60) });
  });
  if (c.sweep && (c.sweep.id || c.sweep.link || c.sweep.name)) out.sweep = { id: bnxBsSheetId_(c.sweep.id || c.sweep.link), name: String(c.sweep.name || '').slice(0, 120), prop: c.sweep.prop || '', tab: String(c.sweep.tab || 'TransSweep').slice(0, 80) };
  /* test every tab before saving */
  var errs = [];
  out.bank.forEach(function (b) { try { if (!SpreadsheetApp.openById(b.id).getSheetByName(b.tab)) errs.push(b.tab + ': tab not found'); } catch (e) { errs.push(b.tab + ': no access — share the sheet with the ERP Apps Script account'); } });
  if (out.sweep) { try { bnxBsSweepSheet_(out.sweep); } catch (e) { errs.push('Sweep: ' + e.message); } }
  if (errs.length) return { success: false, error: errs.join(' · ') };
  PropertiesService.getScriptProperties().setProperty('BNX_BSYNC_' + cid, JSON.stringify(out));
  return { success: true, data: { cfg: out } };
}

/* ---------- 1. bank sheets → BANK_TXN_REGISTER ---------- */
function bnxBsMode_(n) {
  var u = String(n || '').toUpperCase();
  if (/POS_SET|EZY\/|CCARD PMT|MERCHANT SETTL|SWEEP/.test(u)) return 'SWEEP';
  if (/ZOMATO/.test(u)) return 'ZOMATO';
  if (/SWIGGY|BUNDL/.test(u)) return 'SWIGGY';
  if (/^UPI\/|\/UPI\/|UPI\/|GOOGLEINDI|PHONEPE|PAYTM/.test(u)) return 'UPI';
  if (/CASH ?DEP|BY CASH|CSH ?DEP|CASH DEPOSIT|CAM\//.test(u)) return 'CASH';
  if (/NEFT|RTGS|IMPS|INF\/|INFT|MMT\//.test(u)) return 'BANK';
  return 'OTHER';
}
function bnxBsSettleDate_(n) {
  var u = String(n || '').toUpperCase(), m = u.match(/POS_SET\w*?_(\d{2})(\d{2})(\d{2})\b/) || u.match(/CCARD PMT (\d{2})(\d{2})(\d{2})\b/) || u.match(/_(\d{2})(\d{2})(\d{2})\s*$/);
  if (!m) return '';
  var d = '20' + m[3] + '-' + m[2] + '-' + m[1]; return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d) ? d : '';
}
function bnxBsSig_(d, cr, dr, n) { return [d, Math.round(cr * 100), Math.round(dr * 100), bnxBsNorm_(n).slice(0, 40)].join('|'); }
function bnxBsRegister_(cid) {
  var sh = bnxBankTxnSheet_(cid), w = BNX_BANK_TXN_HEADERS_.length, last = sh.getLastColumn();
  var h = sh.getRange(1, 1, 1, Math.max(last, w + BNX_BS_EXTRA_.length)).getValues()[0].map(String);
  BNX_BS_EXTRA_.forEach(function (x, i) { if (h[w + i] !== x) sh.getRange(1, w + i + 1).setValue(x); });
  return sh;
}
function bnxBsIdx_(v) {
  for (var r = 0; r < Math.min(40, v.length); r++) {
    var c = v[r].map(bnxBsNorm_), f = function (re) { for (var i = 0; i < c.length; i++) if (re.test(c[i])) return i; return -1; };
    var x = { tran: f(/^(tranid|transactionid|tranidno|txnid|chequeno)$/), vdate: f(/^valuedate$/), tdate: f(/^(transactiondate|txndate|trandate|date)$/),
      posted: f(/^(transactionposteddate|posteddate|transactionpostdate|postdate|transactiondatetime)$/), narr: f(/^(transactionremarks|remarks|narration|description|particulars|details)$/),
      dr: f(/^(withdrawal|withdrawalamt|withdrawalamtinr|withdrawalamount|debit|debitamount|dr)/), cr: f(/^(deposit|depositamt|depositamtinr|depositamount|credit|creditamount|cr)/), bal: f(/^(balance|balanceinr|closingbalance)/) };
    if ((x.tdate >= 0 || x.vdate >= 0) && x.narr >= 0 && (x.cr >= 0 || x.dr >= 0)) return { hr: r, ix: x };
  }
  return { hr: -1, ix: null };
}
function bnxBsRows_(v, hr, ix, tz, since) {
  var out = [];
  for (var i = hr + 1; i < v.length; i++) {
    var row = v[i], dd = bnxBsDt_(row[ix.tdate >= 0 ? ix.tdate : ix.vdate], tz);
    if (!dd.d && ix.vdate >= 0) dd = bnxBsDt_(row[ix.vdate], tz);
    if (!dd.d || dd.d < since) continue;
    var narr = String(row[ix.narr] || '').trim(); if (/OPENING BALANCE|CLOSING BALANCE|^TOTAL/i.test(narr)) continue;
    var cr = ix.cr >= 0 ? Math.abs(bnxBsNum_(row[ix.cr])) : 0, dr = ix.dr >= 0 ? Math.abs(bnxBsNum_(row[ix.dr])) : 0;
    if (!(cr > 0) && !(dr > 0)) continue;
    var ps = ix.posted >= 0 ? bnxBsDt_(row[ix.posted], tz) : { d: '', t: '' };
    out.push({ d: dd.d, t: ps.t || dd.t || '', pd: ps.d || dd.d, tran: ix.tran >= 0 ? String(row[ix.tran] || '').trim() : '', narr: narr, cr: Math.round(cr * 100) / 100, dr: Math.round(dr * 100) / 100,
      bal: ix.bal >= 0 ? bnxBsNum_(row[ix.bal]) : '', raw: row });
  }
  return out;
}
function bnxBsReadTab_(src, since) {
  var ss = SpreadsheetApp.openById(src.id), sh = ss.getSheetByName(src.tab);
  if (!sh) throw new Error('tab "' + src.tab + '" not found');
  var tz = ss.getSpreadsheetTimeZone() || bnxBsTz_(), v = sh.getDataRange().getValues(), h = bnxBsIdx_(v);
  if (h.hr < 0) throw new Error(src.tab + ': heading row with Date, Remarks, Withdrawal and Deposit not found');
  var out = bnxBsRows_(v, h.hr, h.ix, tz, since); out.header = v[h.hr]; return out;
}
/* "ICICI 34 copy sync next in this sheet": the bank tab's rows are also copied, column for column, into a tab of the
   Transaction DB (CL00010 Vanns34 → ICICBank) after its last row. A row already there (Tran Id + date + amount) is skipped. */
function bnxBsMirror_(cid, tab, rows) {
  var ss = bnxPqDb_(cid, 'TRANSACTION'), sh = ss.getSheetByName(tab), head = (rows.header || []).map(function (x) { return x == null ? '' : x; });
  if (!sh) { sh = ss.insertSheet(tab); sh.getRange(1, 1, 1, head.length).setValues([head]); sh.setFrozenRows(1); }
  if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, head.length).setValues([head]);
  var tv = sh.getDataRange().getValues(), tz = ss.getSpreadsheetTimeZone() || bnxBsTz_(), h = bnxBsIdx_(tv);
  if (h.hr < 0) throw new Error(tab + ': heading row not found — not changed');
  var key = function (r) { return [String(r.tran).toUpperCase(), r.d, r.cr ? 'C' : 'D', Math.round((r.cr || r.dr) * 100)].join('|'); };
  var have = {}; bnxBsRows_(tv, h.hr, h.ix, tz, '0000').forEach(function (r) { var k = key(r); have[k] = (have[k] || 0) + 1; });
  var tH = tv[h.hr].map(bnxBsNorm_), W = tH.length, map = head.map(function (x) { return tH.indexOf(bnxBsNorm_(x)); }), occ = {}, add = [];
  rows.forEach(function (r) {
    var k = key(r); occ[k] = (occ[k] || 0) + 1; if (occ[k] <= (have[k] || 0)) return;
    var line = []; for (var q = 0; q < W; q++) line.push('');
    head.forEach(function (x, i) { var j = map[i]; if (j >= 0) line[j] = r.raw[i] == null ? '' : r.raw[i]; });
    add.push(line);
  });
  for (var i = 0; i < add.length; i += 2000) { var part = add.slice(i, i + 2000); sh.getRange(sh.getLastRow() + 1, 1, part.length, W).setValues(part); }
  return add.length;
}
function bnxBsSyncBank_(cid, userId) {
  var cfg = bnxBsCfg_(cid), res = { accounts: [], added: 0, duplicates: 0, errors: [] };
  if (!cfg.bank.length) { res.errors.push('No bank sheet linked'); return res; }
  var lock = bnxTenantLock_(); if (!lock.tryLock(60000)) { res.errors.push('Busy — retry'); return res; }
  try {
    var sh = bnxBsRegister_(cid), W = BNX_BANK_TXN_HEADERS_.length + BNX_BS_EXTRA_.length, n = sh.getLastRow();
    var ex = n >= 2 ? sh.getRange(2, 1, n - 1, W).getValues() : [], keys = {}, sigFree = {};
    ex.forEach(function (r) {
      keys[String(r[0])] = 1; if (String(r[9]).toUpperCase() === 'DUPLICATE') return;
      if (/^BS-/.test(String(r[0]))) return;   /* rows of a sheet sync are matched by key */
      var sg = bnxBsSig_(bnxNormalizeDateKey_(r[2]), +r[4] || 0, +r[5] || 0, r[3]); sigFree[sg] = (sigFree[sg] || 0) + 1;
    });
    var now = new Date().toISOString(), add = [];
    cfg.bank.forEach(function (src) {
      var a = { account: src.account || src.tab, read: 0, added: 0, duplicates: 0, error: '' };
      try {
        /* 26-11: the bank sheet not shared / not reachable → read its copy inside the Transaction DB (CL00010: ICICBank, 1,632 rows)
           so the bank side is never empty; the same key → nothing is counted twice when the sheet becomes reachable */
        var rows, fromMirror = false;
        try { rows = bnxBsReadTab_(src, cfg.since); }
        catch (re) { if (!src.mirror) throw re; rows = bnxBsReadTab_({ id: bnxPqDb_(cid, 'TRANSACTION').getId(), tab: src.mirror }, cfg.since); fromMirror = true; a.note = 'bank sheet not reachable (' + String(re.message || re).slice(0, 80) + ') — read from ' + src.mirror; res.errors.push(a.account + ': ' + a.note); }
        var occ = {}; a.read = rows.length;
        if (src.mirror && !fromMirror) { try { a.copied = bnxBsMirror_(cid, src.mirror, rows); a.copiedTo = src.mirror; } catch (me) { res.errors.push(a.account + ' → ' + src.mirror + ': ' + me.message); } }
        rows.forEach(function (x) {
          var amt = Math.round((x.cr || x.dr) * 100), base = x.tran || ('H' + bnxBsNorm_(x.narr).slice(0, 24));
          var k0 = 'BS-' + a.account + '-' + base + '-' + x.d + '-' + (x.cr ? 'C' : 'D') + amt; occ[k0] = (occ[k0] || 0) + 1;
          var key = (k0 + (occ[k0] > 1 ? '-' + occ[k0] : '')).slice(0, 120);
          if (keys[key]) { a.duplicates++; return; }
          var sg = bnxBsSig_(x.d, x.cr, x.dr, x.narr);
          if (sigFree[sg] > 0) { sigFree[sg]--; keys[key] = 1; a.duplicates++; return; }   /* same entry imported earlier from a file */
          keys[key] = 1;
          var mode = x.cr ? bnxBsMode_(x.narr) : 'PAYMENT', biz = bnxBsBiz_(x.pd, x.t), sd = mode === 'SWEEP' ? bnxBsSettleDate_(x.narr) : '';
          var md = mode === 'UPI' ? biz : '';
          add.push([key, a.account, x.d, x.narr.slice(0, 300), x.cr, x.dr, mode, md, md ? 'UPI' : '', md ? 'AUTO' : '', x.tran.slice(0, 100), 'SHEET:' + a.account, now, String(userId || 'SYNC'), now, String(userId || 'SYNC'),
            x.t, x.tran, x.bal, biz, sd]);
          a.added++;
        });
      } catch (e) { a.error = String(e.message || e); res.errors.push(a.account + ': ' + a.error); }
      res.accounts.push(a); res.added += a.added; res.duplicates += a.duplicates;
    });
    for (var i = 0; i < add.length; i += 2000) { var part = add.slice(i, i + 2000); sh.getRange(sh.getLastRow() + 1, 1, part.length, W).setValues(part); }
    if (add.length) { try { sh.getRange(2, 3, sh.getLastRow() - 1, 1).setNumberFormat('@'); } catch (e) {} }
    try { CacheService.getScriptCache().put('banktxn_gen_' + cid, String(Date.now()), 21600); } catch (e) {}
  } finally { lock.releaseLock(); }
  return res;
}

/* ---------- 2. FY sheet TransSweep → Swift_Transaction Report / Swift_Settlement Report ---------- */
function bnxBsSweepSheet_(sw) {
  if (sw.id) { var ss = SpreadsheetApp.openById(sw.id), sh = ss.getSheetByName(sw.tab || 'TransSweep'); if (!sh) throw new Error('tab "' + (sw.tab || 'TransSweep') + '" not found'); return sh; }
  return bnxSheetByNameOrProp_(sw.prop || 'BNX_DUES_SHEET_ID', sw.name, sw.tab || 'TransSweep', 'BNX_SWEEP_TAB_X');
}
function bnxBsSwiftTab_(ss, kind, create, header) {
  var re = kind === 'transactions' ? /^(swift)?(?:transaction|transactions|txn)(?:report)?$/ : /^(swift)?settlements?(?:report)?$/;
  var hit = ss.getSheets().filter(function (s) { var n = s.getName().toLowerCase().replace(/[^a-z]/g, ''); return /^swift/.test(n) && re.test(n); });
  if (hit.length) return hit[0];
  if (!create) return null;
  var sh = ss.insertSheet(kind === 'transactions' ? 'Swift_Transaction Report' : 'Swift_Settlement Report');
  sh.getRange(1, 1, 1, header.length).setValues([header]); sh.setFrozenRows(1); return sh;
}
function bnxBsSyncSweep_(cid) {
  var cfg = bnxBsCfg_(cid), res = { txnAdded: 0, txnCollectionDates: 0, settleAdded: 0, read: 0, errors: [] };
  if (!cfg.sweep) { res.errors.push('No Sweep sheet linked'); return res; }
  var src = bnxBsSweepSheet_(cfg.sweep), tz = src.getParent().getSpreadsheetTimeZone() || bnxBsTz_(), v = src.getDataRange().getValues();
  var hr = -1; for (var r = 0; r < Math.min(10, v.length); r++) { var nn = v[r].map(bnxBsNorm_); if (nn.indexOf('transactionid') >= 0 && nn.indexOf('amount') >= 0) { hr = r; break; } }
  if (hr < 0) throw new Error('TransSweep: heading row (Transaction ID, Amount) not found');
  var H = v[hr].map(function (x) { return String(x == null ? '' : x).trim(); }), N = H.map(bnxBsNorm_);
  var split = -1; for (var i = 1; i < N.length; i++) if (N[i] === 'mid') { split = i; break; }
  var endA = split > 0 ? split : N.length;
  var colA = {}; for (var a = 0; a < endA; a++) if (N[a] && colA[N[a]] == null) colA[N[a]] = a;
  var colB = {}; if (split > 0) for (var b = split; b < N.length; b++) if (N[b] && colB[N[b]] == null) colB[N[b]] = b;
  var since = cfg.since, ss = bnxPqDb_(cid, 'TRANSACTION');
  var lock = bnxTenantLock_(); if (!lock.tryLock(60000)) { res.errors.push('Busy — retry'); return res; }
  try {
    /* -- transactions -- */
    var hdrA = H.slice(0, endA).filter(function (x, k) { return x && !/^status$/i.test(x) && colA[N[k]] === k; });
    if (hdrA.map(bnxBsNorm_).indexOf('collectiondate') < 0) hdrA.push('Collection Date');
    hdrA.push('Collection Note');
    var tSh = bnxBsSwiftTab_(ss, 'transactions', true, hdrA), tv = tSh.getDataRange().getValues(), tH = (tv[0] || []).map(bnxBsNorm_);
    ['collectiondate', 'collectionnote'].forEach(function (k, j) { if (tH.indexOf(k) < 0) { tSh.getRange(1, tH.length + 1).setValue(j ? 'Collection Note' : 'Collection Date'); tH.push(k); } });
    var tId = tH.indexOf('transactionid'), tCd = tH.indexOf('collectiondate'), tCn = tH.indexOf('collectionnote'), tRr = tH.indexOf('rrn'), have = {};
    var tTz = ss.getSpreadsheetTimeZone() || bnxBsTz_(), dOf = function (d) { return Utilities.parseDate(d + ' 12:00', tTz, 'yyyy-MM-dd HH:mm'); };   /* the date the DB shows = d */
    var rrnS = function (x) { if (x == null || x === '' || x === '-') return ''; if (typeof x === 'number') return isFinite(x) ? x.toFixed(0) : ''; return String(x).trim().replace(/^'/, ''); };
    var sRr = colA['rrn'], rrCol = tRr >= 0 ? tv.map(function (r) { return r[tRr]; }) : null, rrChanged = 0;
    for (var q = 1; q < tv.length; q++) { var id0 = String(tv[q][tId] || '').trim(); if (id0 && have[id0] == null) have[id0] = q; }
    var cdCol = tv.map(function (r) { return r[tCd]; }), cnCol = tv.map(function (r) { return r[tCn]; }), changed = false, addT = [];
    var sId = colA['transactionid'], sCd = colA['collectiondate'], sTs = colA['transactiondatetime'], sSd = colA['settlementdate'];
    for (var x = hr + 1; x < v.length; x++) {
      var row = v[x], id = String(row[sId] || '').trim(); if (!id || /^transaction ?id$/i.test(id)) continue;
      var cd = sCd != null ? bnxBsDt_(row[sCd], tz).d : '', ts = sTs != null ? bnxBsDt_(row[sTs], tz).d : '', sd = sSd != null ? bnxBsDt_(row[sSd], tz).d : '';
      if ((cd || ts || sd || '9999') < since) continue;
      res.read++;
      if (have[id] != null) {
        var at = have[id], cur = bnxBsCd_(cdCol[at], tTz);   /* 26-11: read the DB value in the DB's own time zone — rows written at IST midnight (old sync) showed one day early and were never rewritten */
        if (cd && cd !== cur) { cdCol[at] = dOf(cd); cnCol[at] = 'From FY TransSweep'; changed = true; res.txnCollectionDates++; }
        if (rrCol && sRr != null) { var nr = rrnS(row[sRr]), or = rrnS(rrCol[at]); if (nr && /^\d{6,}$/.test(nr) && nr !== or) { rrCol[at] = nr; rrChanged++; } }   /* RRN rounded by an Excel import (513000000000) → the full one */
        continue;
      }
      have[id] = -1;
      var line = tH.map(function (k) { if (k === 'collectionnote') return cd ? 'From FY TransSweep' : ''; var c = colA[k]; return c == null ? '' : row[c]; });
      if (cd) line[tCd] = dOf(cd);
      if (tRr >= 0 && sRr != null) line[tRr] = rrnS(row[sRr]);
      addT.push(line);
    }
    if (changed && tv.length > 1) { tSh.getRange(2, tCd + 1, tv.length - 1, 1).setValues(cdCol.slice(1).map(function (z) { return [z]; })); tSh.getRange(2, tCn + 1, tv.length - 1, 1).setValues(cnCol.slice(1).map(function (z) { return [z]; })); }
    if (tRr >= 0) { try { tSh.getRange(1, tRr + 1, Math.max(tSh.getMaxRows(), 2), 1).setNumberFormat('@'); } catch (e) {} }
    if (rrChanged && tv.length > 1) tSh.getRange(2, tRr + 1, tv.length - 1, 1).setValues(rrCol.slice(1).map(function (z) { return [z == null ? '' : String(z)]; }));
    res.rrnFixed = rrChanged;
    for (var p = 0; p < addT.length; p += 2000) { var part = addT.slice(p, p + 2000); tSh.getRange(tSh.getLastRow() + 1, 1, part.length, tH.length).setValues(part); }
    res.txnAdded = addT.length;
    /* -- settlement block (MID … Status) -- */
    if (split > 0 && colB['transactionid'] != null) {
      var hdrB = H.slice(split).filter(function (z, k) { return z && colB[N[split + k]] === split + k; });
      var sSh = bnxBsSwiftTab_(ss, 'settlements', true, hdrB), sv = sSh.getDataRange().getValues(), sH = (sv[0] || []).map(bnxBsNorm_);
      var kOf = function (idv, ty, am) { return [String(idv || '').trim(), String(ty || '').trim().toUpperCase(), Math.round(bnxBsNum_(am) * 100)].join('|'); };
      var si = sH.indexOf('transactionid'), st = sH.indexOf('transactiontype'), sa = sH.indexOf('transactionamount'), sk = {};
      for (var y = 1; y < sv.length; y++) sk[kOf(sv[y][si], sv[y][st], sv[y][sa])] = 1;
      var bId = colB['transactionid'], bTy = colB['transactiontype'], bAm = colB['transactionamount'], bSd = colB['settlementdate'], bTd = colB['transactiondate'], addS = [];
      for (var z = hr + 1; z < v.length; z++) {
        var rw = v[z]; if (!String(rw[bId] || '').trim()) continue;
        var dd = (bSd != null ? bnxBsDt_(rw[bSd], tz).d : '') || (bTd != null ? bnxBsDt_(rw[bTd], tz).d : '');
        if (!dd || dd < since) continue;
        var kk = kOf(rw[bId], bTy != null ? rw[bTy] : '', bAm != null ? rw[bAm] : 0); if (sk[kk]) continue; sk[kk] = 1;
        addS.push(sH.map(function (k) { var c = colB[k]; return c == null ? '' : rw[c]; }));
      }
      for (var w = 0; w < addS.length; w += 2000) { var pt = addS.slice(w, w + 2000); sSh.getRange(sSh.getLastRow() + 1, 1, pt.length, sH.length).setValues(pt); }
      res.settleAdded = addS.length;
    }
  } finally { lock.releaseLock(); }
  return res;
}
function bnxBsRunAction_(s, p) {
  var cid = String(s.CLIENT_ID || ''); if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
  var what = String(p && p.what || 'all').toLowerCase(), out = {};
  try { if (what !== 'sweep') out.bank = bnxBsSyncBank_(cid, s.USER_ID); } catch (e) { out.bank = { errors: [String(e.message || e)] }; }
  try { if (what !== 'bank' && bnxBsCfg_(cid).sweep) out.sweep = bnxBsSyncSweep_(cid); } catch (e) { out.sweep = { errors: [String(e.message || e)] }; }
  out.at = new Date().toISOString();
  try { PropertiesService.getScriptProperties().setProperty('BNX_BSYNC_LAST_' + cid, JSON.stringify(out).slice(0, 8000)); } catch (e) {}
  return { success: true, data: out };
}

/* ---------- 3. collection reco 6 am → 6 am + bill links ---------- */
function bnxBsLinkSheet_(cid) {
  var ss = bnxPqDb_(cid, 'TRANSACTION'), sh = ss.getSheetByName('COLLECTION_LINK');
  if (!sh) { sh = ss.insertSheet('COLLECTION_LINK'); sh.getRange(1, 1, 1, BNX_COLL_LINK_HDR_.length).setValues([BNX_COLL_LINK_HDR_]); sh.setFrozenRows(1); }
  return sh;
}
function bnxBsPayMode_(m) {
  var u = String(m || '').toUpperCase();
  if (/CASH/.test(u)) return 'CASH';
  if (/UPI|GPAY|PHONEPE|PAYTM|QR/.test(u)) return 'UPI';
  if (/CARD|DEBIT|CREDIT CARD|VISA|MASTER|RUPAY|SWIPE/.test(u)) return 'CARD';
  if (/ZOMATO/.test(u)) return 'ZOMATO'; if (/SWIGGY/.test(u)) return 'SWIGGY';
  if (/BANK|NEFT|IMPS|RTGS|TRANSFER/.test(u)) return 'BANK';
  return u ? 'OTHER' : '';
}
function bnxBsMin_(d, t) { if (!d) return null; var x = Date.parse(d + 'T' + (t || '12:00:00') + 'Z'); return isNaN(x) ? null : x / 6e4; }
function bnxCollReco_(s, p) {
  if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
  var cid = String(s.CLIENT_ID || ''), loc = String(s.LOCATION_ID || ''), from = bnxNormalizeDateKey_(p && p.from), to = bnxNormalizeDateKey_(p && p.to) || from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from || (Date.parse(to) - Date.parse(from)) > 31 * 864e5) return { success: false, error: 'Choose a period of up to 31 days' };
  var lo = bnxBsShift_(from, -1), hi = bnxBsShift_(to, 1), tz = bnxBsTz_(), r2 = function (x) { return Math.round(x * 100) / 100; };
  var ss = bnxPqDb_(cid, 'TRANSACTION');
  var RC = bnxRecoCfg_(cid), TOL = Math.max(0.01, +RC.rules.tol || 0.6), WIN = Math.max(0, Math.min(3, +RC.rules.dayWindow || 0)), GAP = Math.max(15, +RC.rules.gapMin || 180);
  /* ERP bills + payments */
  /* 26-11 speed: only the columns used are read (BILL_MASTER / PAYMENT_MASTER have 40+ columns) */
  var bm = bnxBsCols_(bnxClientSheet(cid, SHEETS.BILL_MASTER), ['BILL_ID', 'CLIENT_ID', 'LOCATION_ID', 'BILL_NUMBER', 'BILL_DATE', 'BILL_TIME', 'BILL_STATUS', 'GRAND_TOTAL', 'TABLE_ID', 'CUSTOMER_NAME']), bh = (bm.shift() || []).map(String), bc = function (k) { return bh.indexOf(k); };
  var B = {}, bId = bc('BILL_ID'), bCid = bc('CLIENT_ID'), bLoc = bc('LOCATION_ID'), bNo = bc('BILL_NUMBER'), bD = bc('BILL_DATE'), bT = bc('BILL_TIME'), bSt = bc('BILL_STATUS'), bTot = bc('GRAND_TOTAL'), bTab = bc('TABLE_ID'), bCu = bc('CUSTOMER_NAME');
  bm.forEach(function (r) {
    if (bCid >= 0 && String(r[bCid]) !== cid) return; if (loc && bLoc >= 0 && r[bLoc] && String(r[bLoc]) !== loc) return;
    if (/CANCEL|VOID|DELETED|DRAFT/i.test(String(r[bSt] || ''))) return;
    var d = bnxNormalizeDateKey_(r[bD]); if (!d || d < lo || d > hi) return;
    var t = bnxBsDt_(r[bT], tz).t || String(r[bT] || '').slice(0, 8);
    B[String(r[bId])] = { id: String(r[bId]), no: String(r[bNo] || ''), d: d, t: /^\d{2}:\d{2}/.test(t) ? t : '', tot: +r[bTot] || 0, tab: String(r[bTab] || ''), cu: String(r[bCu] || '') };
  });
  var pm = bnxBsCols_(bnxClientSheet(cid, SHEETS.PAYMENT_MASTER), ['BILL_ID', 'CLIENT_ID', 'PAYMENT_MODE', 'AMOUNT', 'PAYMENT_TIME', 'PAYMENT_STATUS', 'PAYMENT_ID']), ph = (pm.shift() || []).map(String), pc = function (k) { return ph.indexOf(k); };
  var pB = pc('BILL_ID'), pCid = pc('CLIENT_ID'), pMo = pc('PAYMENT_MODE'), pAm = pc('AMOUNT'), pT = pc('PAYMENT_TIME'), pSt = pc('PAYMENT_STATUS'), pId = pc('PAYMENT_ID');
  var pays = [];
  pm.forEach(function (r) {
    var b = B[String(r[pB] || '')]; if (!b) return; if (pCid >= 0 && String(r[pCid]) !== cid) return;
    if (/FAIL|REFUND|CANCEL|VOID|REVERS/i.test(String(r[pSt] || ''))) return;
    var amt = bnxBsNum_(r[pAm]); if (!(amt > 0)) return;
    var t = bnxBsDt_(r[pT], tz).t || (/^\d{1,2}:\d{2}/.test(String(r[pT] || '')) ? ('0' + String(r[pT])).slice(-8) : '') || b.t;
    pays.push({ pid: String(r[pId] || ''), bill: b.id, no: b.no, d: b.d, t: t, mode: bnxBsPayMode_(r[pMo]), amt: r2(amt), tab: b.tab, cu: b.cu, key: '', how: '' });
  });
  /* due collections received by UPI / card / bank (DUES_RECEIPT) — a Sweep swipe can be a customer paying old dues */
  try {
    var dSh = null; try { dSh = bnxClientSheet(cid, SHEETS.DUES_RECEIPT || 'DUES_RECEIPT'); } catch (e) { dSh = ss.getSheetByName('DUES_RECEIPT'); }
    if (dSh && dSh.getLastRow() > 1) {
      var dv = dSh.getDataRange().getValues(), dh = (dv.shift() || []).map(String), dc = function (k) { return dh.indexOf(k); };
      var dId = dc('DUES_RECEIPT_ID'), dCid = dc('CLIENT_ID'), dAm = dc('AMOUNT'), dMo = dc('PAYMENT_MODE'), dD = dc('RECEIPT_DATE'), dT = dc('RECEIPT_TIME'), dV = dc('VOUCHER_NO'), dN = dc('CUSTOMER_NAME'), dS = dc('STATUS'), dR = dc('REFERENCE');
      dv.forEach(function (r) {
        if (dCid >= 0 && r[dCid] && String(r[dCid]) !== cid) return;
        if (dS >= 0 && /CANCEL|VOID|DELETED|REVERS/i.test(String(r[dS] || ''))) return;
        var m = String(r[dMo] || '').toUpperCase(), mode = /UPI|GPAY|PHONEPE|PAYTM/.test(m) ? 'UPI' : /CARD|SWIPE/.test(m) ? 'CARD' : /BANK|NEFT|IMPS|RTGS|TRANSFER|CHEQUE/.test(m) ? 'BANK' : '';
        if (!mode) return;                                                               /* cash / discount: not a Sweep or bank credit */
        var d = bnxNormalizeDateKey_(r[dD]); if (!d || d < lo || d > hi) return;
        var amt = bnxBsNum_(r[dAm]); if (!(amt > 0)) return;
        var id = String(r[dId] || ''), t = dT >= 0 ? (bnxBsDt_(r[dT], tz).t || '') : '';
        pays.push({ pid: id, bill: 'DR:' + id, no: String((dV >= 0 && r[dV]) || id), d: d, t: t, mode: mode, amt: r2(amt), tab: 'Due', cu: String(dN >= 0 ? r[dN] || '' : ''), key: '', how: '', due: true,
          ref: dR >= 0 ? String(r[dR] || '').slice(0, 60) : '' });
      });
    }
  } catch (e) {}
  /* guest advances received by UPI / card / bank (GUEST_ADVANCE) — a Sweep swipe can be an advance for a party / booking */
  try { var gA = ss.getSheetByName('GUEST_ADVANCE');
    if (gA && gA.getLastRow() > 1) gA.getRange(2, 1, gA.getLastRow() - 1, BNX_ADV_HDR.length).getValues().forEach(function (r) {
      var o = {}; BNX_ADV_HDR.forEach(function (k, i) { o[k] = r[i]; }); if (/CANCEL/i.test(String(o.STATUS))) return;
      var m = String(o.MODE || '').toUpperCase(), mode = /UPI/.test(m) ? 'UPI' : /CARD/.test(m) ? 'CARD' : /BANK|NEFT|IMPS|RTGS|CHEQUE/.test(m) ? 'BANK' : ''; if (!mode) return;
      var d = bnxNormalizeDateKey_(o.DATE); if (!d || d < lo || d > hi) return; var amt = +o.AMOUNT || 0; if (!(amt > 0)) return;
      pays.push({ pid: String(o.ADV_ID), bill: 'ADV:' + o.ADV_ID, no: String(o.ADV_ID), d: d, t: '', mode: mode, amt: r2(amt), tab: 'Advance', cu: String(o.GUEST_NAME || ''), key: '', how: '', due: true, adv: true, ref: String(o.PURPOSE || o.REFERENCE || '').slice(0, 60) });
    }); } catch (e) {}
  /* Sweep transactions */
  var sw = [], tSh = bnxBsSwiftTab_(ss, 'transactions', false);
  if (tSh) {
    var tv = tSh.getDataRange().getValues(), th = (tv.shift() || []).map(bnxBsNorm_), tc = function (re) { for (var i = 0; i < th.length; i++) if (re.test(th[i])) return i; return -1; };
    var c = { id: tc(/^transactionid$/), rrn: tc(/^rrn$/), ts: tc(/^transactiondate(time|andtime)?$/), amt: tc(/^amount$/), ch: tc(/^charges$/), tx: tc(/^taxes$/), st: tc(/^transactionstatus$/), sd: tc(/^settlementdate$/),
      mo: tc(/^paymentmode$/), py: tc(/^payername$/), ty: tc(/^transactiontype$/), cd: tc(/^collectiondate$/), tid: tc(/^tid$/) };
    var seen = {}, tzT = tSh.getParent().getSpreadsheetTimeZone() || tz;
    tv.forEach(function (r) {
      var id = String(r[c.id] || '').trim(); if (!id || seen[id]) return; seen[id] = 1;
      if (!/^SUCCESS/i.test(String(r[c.st] || '').trim())) return;
      if (c.ty >= 0 && /REFUND|VOID|REVERS/i.test(String(r[c.ty] || ''))) return;
      var ts = bnxBsDt_(r[c.ts], tzT), cd = c.cd >= 0 ? bnxBsCd_(r[c.cd], tzT) : '', biz = cd || bnxBsBiz_(ts.d, ts.t);
      var sd = c.sd >= 0 ? bnxBsDt_(r[c.sd], tzT).d : '';
      if (!((biz >= lo && biz <= hi) || (sd >= from && sd <= bnxBsShift_(to, 3)))) return;
      var mo = String(r[c.mo] || '').toUpperCase(), mode = /UPI/.test(mo) ? 'UPI' : /CARD/.test(mo) ? 'CARD' : /BANK|NET/.test(mo) ? 'BANK' : 'OTHER';
      var amt = bnxBsNum_(r[c.amt]), fee = -(bnxBsNum_(r[c.ch]) + bnxBsNum_(r[c.tx]));
      sw.push({ key: 'SW:' + id, id: id, rrn: String(r[c.rrn] || ''), biz: biz, d: ts.d, t: ts.t, cd: cd, sd: sd, mode: mode, amt: r2(amt), fee: r2(Math.abs(fee)), net: r2(amt - Math.abs(fee)), py: String(r[c.py] || '').slice(0, 60), tid: String(r[c.tid] || ''), bill: '', no: '', how: '' });
    });
  }
  /* Swift settlement report: which transactions are really settled (like the FY TransSweep STATUS column) */
  var setRep = {}, sSh = bnxBsSwiftTab_(ss, 'settlements', false);
  if (sSh && sw.length) {
    var sv = sSh.getDataRange().getValues(), sh0 = (sv.shift() || []).map(bnxBsNorm_), si = function (re) { for (var i = 0; i < sh0.length; i++) if (re.test(sh0[i])) return i; return -1; };
    var q = { id: si(/^transactionid$/), rrn: si(/^rrn$/), sd: si(/^settlementdate$/), st: si(/^status$/), net: si(/^netsettlementamount$/), utr: si(/^utr/) }, tzS = sSh.getParent().getSpreadsheetTimeZone() || tz;
    var rk = function (x) { return typeof x === 'number' ? x.toFixed(0) : String(x == null ? '' : x).trim(); };
    sv.forEach(function (r) {
      if (q.st >= 0 && /FAIL|REVERS|REFUND/i.test(String(r[q.st] || ''))) return;
      var o = { sd: q.sd >= 0 ? bnxBsDt_(r[q.sd], tzS).d : '', utr: q.utr >= 0 ? String(r[q.utr] || '') : '' };
      if (q.id >= 0 && r[q.id]) setRep['I:' + String(r[q.id]).trim()] = o;
      if (q.rrn >= 0 && rk(r[q.rrn]).length >= 6) setRep['R:' + rk(r[q.rrn])] = o;
    });
  }
  sw.forEach(function (l) { var o = setRep['I:' + l.id] || setRep['R:' + l.rrn]; l.sst = o ? 'SETTLED' : (sSh ? 'PENDING' : ''); l.srd = o ? o.sd : ''; l.utr = o ? o.utr : ''; });
  /* bank register (no duplicates) */
  var bank = [], rg = ss.getSheetByName('BANK_TXN_REGISTER');
  if (rg && rg.getLastRow() > 1) {
    var W = Math.min(rg.getLastColumn(), BNX_BANK_TXN_HEADERS_.length + BNX_BS_EXTRA_.length), rv = rg.getRange(2, 1, rg.getLastRow() - 1, W).getValues(), bhi = bnxBsShift_(to, 4);
    rv.forEach(function (r) {
      if (String(r[9]).toUpperCase() === 'DUPLICATE') return;
      var d = bnxNormalizeDateKey_(r[2]); if (!d || d < lo || d > bhi) return;
      var narr = String(r[3] || ''), cr = +r[4] || 0, dr = +r[5] || 0, mode = String(r[6] || '').toUpperCase();
      if (cr > 0 && (!mode || mode === 'OTHER' || mode === 'CARD')) { var m2 = bnxBsMode_(narr); if (m2 === 'SWEEP') mode = m2; }
      var t = W > 16 ? String(r[16] || '') : '', biz = (W > 19 && r[19]) ? bnxNormalizeDateKey_(r[19]) : (String(r[7] || '') ? bnxNormalizeDateKey_(r[7]) : d);
      var sd = (W > 20 && r[20]) ? bnxNormalizeDateKey_(r[20]) : (mode === 'SWEEP' ? bnxBsSettleDate_(narr) : '');
      bank.push({ key: 'BK:' + String(r[0]), acct: String(r[1] || ''), d: d, t: t, biz: biz, narr: narr.slice(0, 160), cr: r2(cr), dr: r2(dr), mode: mode, sd: sd, bill: '', no: '', how: '' });
    });
  }
  /* v46 26-11: every bank credit gets a type — only sales / due types count in the Diff, the rest is listed apart */
  var MK = bnxRecoMarks_(ss), dueBank = pays.filter(function (q) { return q.due; });
  bank.forEach(function (b) {
    if (!(b.cr > 0)) { b.type = ''; b.tsrc = ''; return; }
    var m = MK.type[b.key]; if (m && m.v) { b.type = m.v; b.tsrc = 'manual'; b.tnote = m.note; return; }
    var u = b.narr.toUpperCase(), rule = (RC.creditRules || []).filter(function (r) { return r.kw && u.indexOf(String(r.kw).toUpperCase()) >= 0; })[0];
    if (rule) { b.type = rule.type; b.tsrc = 'rule'; return; }
    b.tsrc = 'auto';
    if (b.mode === 'SWEEP') b.type = 'SALES_SETTLEMENT';
    else if (b.mode === 'ZOMATO' || b.mode === 'SWIGGY') b.type = 'AGGREGATOR';
    else if (b.mode === 'CASH') b.type = 'CASH_DEPOSIT';
    else if (b.mode === 'UPI') b.type = 'SALES_UPI';
    else b.type = dueBank.some(function (q) { return Math.abs(q.amt - b.cr) < TOL && Math.abs(Date.parse(q.d) - Date.parse(b.biz)) <= 3 * 864e5; }) ? 'DUE_RECEIPT' : 'SUSPENSE';
  });
  var counts = function (b) { return b.cr > 0 && BNX_RECO_COUNT[b.type] && b.mode !== 'SWEEP'; };
  /* manual links */
  var man = {}, ls = ss.getSheetByName('COLLECTION_LINK');
  if (ls && ls.getLastRow() > 1) ls.getRange(2, 1, ls.getLastRow() - 1, BNX_COLL_LINK_HDR_.length).getValues().forEach(function (r) { man[String(r[0])] = { bill: String(r[2] || ''), no: String(r[3] || ''), type: String(r[6] || '') }; });
  var used = {}, takeBill = function (line, billId, no, how) {
    line.bill = billId; line.no = no; line.how = how;
    for (var i = 0; i < pays.length; i++) { var q = pays[i]; if (!used[i] && q.bill === billId && Math.abs(q.amt - (line.amt || line.cr)) < 0.6) { used[i] = 1; q.key = line.key; q.how = how; return; } }
    for (var j = 0; j < pays.length; j++) if (!used[j] && pays[j].bill === billId && (pays[j].mode === 'CARD' || pays[j].mode === 'UPI')) { used[j] = 1; pays[j].key = line.key; pays[j].how = how; return; }
  };
  var lines = sw.concat(bank.filter(function (b) { return counts(b) && (b.mode === 'UPI' || b.mode === 'CARD'); }));
  lines.forEach(function (l) { var m = man[l.key]; if (!m) return; if (m.type === 'UNLINK' || !m.bill) { l.how = 'UNLINKED'; return; } takeBill(l, m.bill, m.no || (B[m.bill] && B[m.bill].no) || '', 'MANUAL'); });
  /* auto: same business day, same amount; same mode first, nearest time (≤ 3 h when both times known) */
  var pairs = [];
  lines.forEach(function (l, li) {
    if (l.how) return; var amt = l.amt || l.cr, lm = bnxBsMin_(l.d || l.biz, l.t), own = l.d ? bnxBsBiz_(l.d, l.t) : l.biz;
    var near1 = function (a, b) { return WIN > 0 && Math.abs(Date.parse(a) - Date.parse(b)) <= WIN * 864e5; };
    pays.forEach(function (q, qi) {
      if (used[qi] || (q.mode !== 'CARD' && q.mode !== 'UPI' && !q.due) || Math.abs(q.amt - amt) >= TOL) return;
      /* same business day; else the day of the swipe itself (6 am rule) or the day next to it — a Collection Date typed one day off */
      var dayPen = q.d === l.biz ? 0 : (q.d === own ? 200 : (near1(q.d, l.biz) ? 500 : -1)); if (dayPen < 0) return;
      var qd = q.t && q.t < '06:00:00' ? bnxBsShift_(q.d, 1) : q.d, qm = bnxBsMin_(qd, q.t), gap = (lm != null && qm != null && l.t && q.t && !l.cd) ? Math.abs(lm - qm) : 400;   /* a Collection Date typed by hand = the day is decided, time is not compared */
      if (gap > GAP && gap !== 400) return;
      pairs.push([(q.mode === l.mode || (q.due && q.mode === 'BANK') ? 0 : 1000) + dayPen + gap + (l.key.charAt(0) === 'B' ? 50 : 0) + (q.due ? 30 : 0), li, qi]);
    });
  });
  pairs.sort(function (a, b) { return a[0] - b[0]; });
  pairs.forEach(function (pr) { var l = lines[pr[1]], q = pays[pr[2]]; if (l.how || used[pr[2]]) return; used[pr[2]] = 1; l.bill = q.bill; l.no = q.no; l.how = pr[0] >= 1000 ? 'AUTO (mode differs)' : (q.d !== l.biz ? 'AUTO (other day)' : 'AUTO'); q.key = l.key; q.how = l.how; });
  /* split payment: one bill paid with two swipes (two cards / card + UPI) on the same business day */
  pays.forEach(function (q, qi) {
    if (RC.rules.allowSplit === false || used[qi] || q.due || (q.mode !== 'CARD' && q.mode !== 'UPI')) return;
    var open = lines.filter(function (l) { return !l.how && l.biz === q.d && l.key.slice(0, 3) === 'SW:'; });
    for (var a = 0; a < open.length; a++) for (var b = a + 1; b < open.length; b++) {
      if (Math.abs(open[a].amt + open[b].amt - q.amt) >= TOL) continue;
      used[qi] = 1; [open[a], open[b]].forEach(function (l) { l.bill = q.bill; l.no = q.no; l.how = 'AUTO (split)'; }); q.key = open[a].key; q.how = 'AUTO (split)'; return;
    }
  });
  /* 26-11 more automatic links ("automapping also"):
     (a) rounded / tip — the guest paid a little more (₹2,400 for a ₹2,396 bill) or a few rupees less: up to ₹rules.round
         (default 50) and 5 % of the bill over, ₹5 under; same business day first, same mode first, nearest time;
     (b) one swipe for two bills of the same business day (₹24,601 = ₹10,000 + ₹14,601), nearest times. */
  var RND = Math.max(0, RC.rules.round == null ? 50 : +RC.rules.round), cand = [];
  lines.forEach(function (l, li) {
    if (l.how) return; var amt = l.amt || l.cr, lm = bnxBsMin_(l.d || l.biz, l.t);
    pays.forEach(function (q, qi) {
      if (used[qi] || q.due || (q.mode !== 'CARD' && q.mode !== 'UPI')) return;
      var df = Math.round((amt - q.amt) * 100) / 100; if (Math.abs(df) < TOL || df < -5 || df > Math.min(RND, q.amt * 0.05)) return;
      var dayPen = q.d === l.biz ? 0 : (WIN > 0 && Math.abs(Date.parse(q.d) - Date.parse(l.biz)) <= WIN * 864e5 ? 300 : -1); if (dayPen < 0) return;
      var qm = bnxBsMin_(q.t && q.t < '06:00:00' ? bnxBsShift_(q.d, 1) : q.d, q.t), gap = (lm != null && qm != null && l.t && q.t && !l.cd) ? Math.abs(lm - qm) : 200;
      if (gap > GAP && gap !== 200) return;
      cand.push([Math.abs(df) * 10 + dayPen + gap + (q.mode === l.mode ? 0 : 1000), li, qi, df]);
    });
  });
  cand.sort(function (a, b) { return a[0] - b[0]; });
  cand.forEach(function (c) { var l = lines[c[1]], q = pays[c[2]]; if (l.how || used[c[2]]) return; used[c[2]] = 1;
    l.bill = q.bill; l.no = q.no; l.how = 'AUTO (rounded ' + (c[3] > 0 ? '+' : '') + c[3] + ')'; q.key = l.key; q.how = l.how; });
  if (RC.rules.allowSplit !== false) lines.forEach(function (l) {
    if (l.how || l.key.slice(0, 3) !== 'SW:') return;
    var lm = bnxBsMin_(l.d || l.biz, l.t), best = null, Q = [];
    pays.forEach(function (q, qi) { if (!used[qi] && !q.due && (q.mode === 'CARD' || q.mode === 'UPI') && q.d === l.biz && q.amt < l.amt) Q.push(qi); });
    for (var a = 0; a < Q.length; a++) for (var b = a + 1; b < Q.length; b++) {
      var qa = pays[Q[a]], qb = pays[Q[b]]; if (Math.abs(qa.amt + qb.amt - l.amt) >= TOL) continue;
      var g = function (q) { var m = bnxBsMin_(q.t && q.t < '06:00:00' ? bnxBsShift_(q.d, 1) : q.d, q.t); return lm != null && m != null && l.t && q.t ? Math.abs(lm - m) : 300; };
      var sc = g(qa) + g(qb) + (qa.mode === l.mode ? 0 : 500) + (qb.mode === l.mode ? 0 : 500); if (!best || sc < best[0]) best = [sc, Q[a], Q[b]];
    }
    if (!best) return; var q1 = pays[best[1]], q2 = pays[best[2]]; used[best[1]] = used[best[2]] = 1;
    l.bill = q1.bill; l.no = q1.no + ' + ' + q2.no; l.how = 'AUTO (2 bills)'; q1.key = q2.key = l.key; q1.how = q2.how = l.how;
  });
  /* day rows */
  var days = [], dayMap = {};
  for (var d = from; d <= to; d = bnxBsShift_(d, 1)) { var o = { d: d, erp: { CASH: 0, CARD: 0, UPI: 0, OTHER: 0, DUE: 0, total: 0, bills: {} }, sw: { CARD: 0, UPI: 0, BANK: 0, OTHER: 0, cnt: 0, fee: 0 }, bankUpi: 0, bankNeft: 0, advIn: 0, swLinked: 0, swOpen: 0, erpOpen: 0 }; days.push(o); dayMap[d] = o; }
  pays.forEach(function (q) { var o = dayMap[q.d]; if (!o) return; if (q.adv) { o.advIn += q.amt; return; } if (q.due) { o.erp.DUE += q.amt; if (!q.key) o.dueOpen = (o.dueOpen || 0) + 1; return; } var k = q.mode === 'CASH' || q.mode === 'CARD' || q.mode === 'UPI' ? q.mode : 'OTHER'; o.erp[k] += q.amt; o.erp.total += q.amt; o.erp.bills[q.bill] = 1; if ((q.mode === 'CARD' || q.mode === 'UPI') && !q.key) o.erpOpen++; });
  sw.forEach(function (l) { var o = dayMap[l.biz]; if (!o) return; o.sw[l.mode] = (o.sw[l.mode] || 0) + l.amt; o.sw.cnt++; o.sw.fee += l.fee; if (l.bill) o.swLinked++; else o.swOpen++; });
  bank.forEach(function (b) { if (!counts(b) || !dayMap[b.biz]) return; if (b.mode === 'UPI') dayMap[b.biz].bankUpi += b.cr; else dayMap[b.biz].bankNeft += b.cr; });
  days.forEach(function (o) {
    o.erp.bills = Object.keys(o.erp.bills).length;
    ['CASH', 'CARD', 'UPI', 'OTHER', 'DUE', 'total'].forEach(function (k) { o.erp[k] = r2(o.erp[k]); }); ['CARD', 'UPI', 'BANK', 'OTHER', 'fee'].forEach(function (k) { o.sw[k] = r2(o.sw[k]); });
    o.bankUpi = r2(o.bankUpi); o.bankNeft = r2(o.bankNeft); o.diffCard = r2(o.erp.CARD - o.sw.CARD); o.diffUpi = r2(o.erp.UPI - o.sw.UPI - o.bankUpi);
    /* v46 26-11: ONE difference — total collection (ERP card + UPI + dues received by UPI / card / bank) vs total received
       (Sweep card + UPI + bank / other + bank UPI credits + bank NEFT / RTGS / IMPS credits) */
    o.advIn = r2(o.advIn); o.coll = r2(o.erp.CARD + o.erp.UPI + o.erp.DUE + o.advIn); o.recv = r2(o.sw.CARD + o.sw.UPI + o.sw.BANK + o.sw.OTHER + o.bankUpi + o.bankNeft); o.diff = r2(o.coll - o.recv);   /* like the FY "Sweep" sheet: UPI + Card + Due bank − Sweep UPI + Cards + Bank */
  });
  /* settlement rows: Sweep net by settlement date vs bank Sweep credits of that date */
  var setl = {}, sHi = bnxBsShift_(to, 3);
  sw.forEach(function (l) { if (!l.sd || l.sd < from || l.sd > sHi) return; var o = setl[l.sd] || (setl[l.sd] = { s: l.sd, gross: 0, fee: 0, net: 0, cnt: 0, bank: 0, refs: [] }); o.gross += l.amt; o.fee += l.fee; o.net += l.net; o.cnt++; });
  bank.forEach(function (b) { if (b.mode !== 'SWEEP' || !(b.cr > 0)) return; var sd = b.sd || b.d; if (sd < from || sd > sHi) return; var o = setl[sd] || (setl[sd] = { s: sd, gross: 0, fee: 0, net: 0, cnt: 0, bank: 0, refs: [] }); o.bank += b.cr; o.refs.push(b.acct + ' ' + b.d + ' ₹' + b.cr); });
  var settle = Object.keys(setl).sort().map(function (k) { var o = setl[k]; ['gross', 'fee', 'net', 'bank'].forEach(function (f) { o[f] = r2(o[f]); }); o.diff = r2(o.bank - o.net); return o; });
  var inR = function (x) { return x >= from && x <= to; };
  return { success: true, data: {
    from: from, to: to, days: days, settle: settle,
    sweep: sw.filter(function (l) { return inR(l.biz) || (l.sd && l.sd >= from && l.sd <= sHi); }).map(function (l) { return [l.key, l.biz, l.d + (l.t ? ' ' + l.t.slice(0, 5) : ''), l.mode, l.amt, l.fee, l.py, l.rrn, l.sd, l.bill, l.no, l.how, l.cd ? 'Collection date' : '6 am rule', l.tid, l.sst, l.utr]; }),
    bank: bank.filter(function (b) { return b.d >= from && b.d <= sHi; }).map(function (b) { return [b.key, b.acct, b.d + (b.t ? ' ' + b.t.slice(0, 5) : ''), b.biz, b.mode, b.cr, b.dr, b.narr, b.sd, b.bill, b.no, b.how, b.type || '', b.tsrc || '', b.tnote || '']; }),
    pays: pays.filter(function (q) { return inR(q.d) && (q.mode === 'CARD' || q.mode === 'UPI' || q.due); }).map(function (q) { return [q.bill, q.no, q.d, q.t.slice(0, 5), q.mode, q.amt, q.tab, q.cu, q.key, q.how, q.due ? 1 : 0, q.ref || '', q.adv ? 1 : 0]; }),
    accounts: bnxBsCfg_(cid).bank.map(function (b) { return b.account || b.tab; }), hasSweep: !!tSh, loadedAt: new Date().toISOString(),
    cfg: RC, exc: MK.exc, dayStatus: MK.day, types: BNX_RECO_TYPES, canApprove: bnxRecoCanApprove_(s), isAdmin: bnxBsAdmin_(s) } };
}
function bnxCollLinkSave_(s, p) {
  if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
  var cid = String(s.CLIENT_ID || ''), links = Array.isArray(p && p.links) ? p.links.slice(0, 500) : [];
  if (!links.length) return { success: false, error: 'Nothing to save' };
  var lk = bnxRecoLocked_(cid, links.map(function (l) { return l.d; })); if (lk) return { success: false, error: lk };
  var lock = bnxTenantLock_(); if (!lock.tryLock(20000)) return { success: false, retryable: true, error: 'Busy — retry' };
  try {
    var sh = bnxBsLinkSheet_(cid), n = sh.getLastRow(), at = {}, now = new Date().toISOString(), add = [];
    if (n > 1) sh.getRange(2, 1, n - 1, 1).getValues().forEach(function (r, i) { at[String(r[0])] = i + 2; });
    links.forEach(function (l) {
      var key = String(l.key || '').slice(0, 140); if (!/^(SW|BK):/.test(key)) return;
      var row = [key, key.slice(0, 2) === 'SW' ? 'SWEEP' : 'BANK', l.unlink ? '' : String(l.billId || ''), l.unlink ? '' : String(l.billNo || ''), +l.amount || 0, String(l.mode || ''), l.unlink ? 'UNLINK' : (l.auto ? 'AUTO_OK' : 'MANUAL'), now, String(s.USER_ID || '')];
      if (at[key]) sh.getRange(at[key], 1, 1, row.length).setValues([row]); else { add.push(row); at[key] = -1; }
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, BNX_COLL_LINK_HDR_.length).setValues(add);
    return { success: true, data: { saved: links.length } };
  } finally { lock.releaseLock(); }
}

/* ---------- 4. duplicates, triggers ---------- */
/* BANK_TXN_LIST never shows rows marked DUPLICATE */
(function () {
  if (typeof bnxBankTxnList_ !== 'function') return;
  var o = bnxBankTxnList_;
  bnxBankTxnList_ = function (session, payload) {
    var r = o.apply(this, arguments);
    try {
      if (r && r.success && r.data && Array.isArray(r.data.rows)) r.data.rows = r.data.rows.filter(function (x) { return String(x.status || '').toUpperCase() !== 'DUPLICATE'; });
    } catch (e) {}
    return r;
  };
})();
function bnxBsDedupe_(cid) {
  var out = { cid: cid, bankMarked: 0, sweepRemoved: 0 };
  var sh = bnxBsRegister_(cid), n = sh.getLastRow();
  if (n > 2) {
    var v = sh.getRange(2, 1, n - 1, 16).getValues(), grp = {};
    v.forEach(function (r, i) { if (String(r[9]).toUpperCase() === 'DUPLICATE') return; var sg = bnxBsSig_(bnxNormalizeDateKey_(r[2]), +r[4] || 0, +r[5] || 0, r[3]); (grp[sg] = grp[sg] || []).push(i); });
    var mark = [];
    Object.keys(grp).forEach(function (k) {
      var ix = grp[k]; if (ix.length < 2) return;
      var per = {}; ix.forEach(function (i) { var src = String(v[i][11] || '') || 'FILE'; per[src] = (per[src] || 0) + 1; });
      var keep = Math.max.apply(null, Object.keys(per).map(function (q) { return per[q]; }));
      ix.sort(function (a, b) { var sa = /^SHEET:/.test(v[a][11]) ? 0 : 1, sb = /^SHEET:/.test(v[b][11]) ? 0 : 1, ma = v[a][7] ? 0 : 1, mb = v[b][7] ? 0 : 1; return ma - mb || sa - sb || a - b; });
      ix.slice(keep).forEach(function (i) { mark.push(i); });
    });
    mark.forEach(function (i) { sh.getRange(i + 2, 10, 1, 2).setValues([['DUPLICATE', String(v[i][10] || '') + ' (duplicate entry)']]); });
    out.bankMarked = mark.length;
  }
  var ss = bnxPqDb_(cid, 'TRANSACTION'), t = bnxBsSwiftTab_(ss, 'transactions', false);
  if (t && t.getLastRow() > 2) {
    var tv = t.getDataRange().getValues(), h = tv[0].map(bnxBsNorm_), id = h.indexOf('transactionid'), cd = h.indexOf('collectiondate');
    if (id >= 0) {
      var first = {}, keepRows = [tv[0]];
      for (var q = 1; q < tv.length; q++) {
        var k = String(tv[q][id] || '').trim();
        if (!k) { keepRows.push(tv[q]); continue; }
        if (first[k] == null) { first[k] = keepRows.length; keepRows.push(tv[q]); continue; }
        if (cd >= 0 && !keepRows[first[k]][cd] && tv[q][cd]) keepRows[first[k]][cd] = tv[q][cd];
        out.sweepRemoved++;
      }
      if (out.sweepRemoved) {
        t.copyTo(ss).setName(t.getName().slice(0, 60) + ' BAK ' + Utilities.formatDate(new Date(), bnxBsTz_(), 'yyMMdd-HHmm'));
        t.getRange(1, 1, tv.length, tv[0].length).clearContent();
        t.getRange(1, 1, keepRows.length, tv[0].length).setValues(keepRows);
      }
    }
  }
  return out;
}
function RUN_BSYNC_Dedupe() { var r = bnxBsCids_().map(function (cid) { try { __bnxReqCid_ = cid; return bnxBsDedupe_(cid); } catch (e) { return { cid: cid, error: String(e.message || e) }; } finally { __bnxReqCid_ = ''; } }); Logger.log(JSON.stringify(r, null, 1)); return r; }
function RUN_BSYNC_All() {
  var t0 = Date.now(), log = [];
  bnxBsCids_().forEach(function (cid) {
    if (Date.now() - t0 > 4 * 6e4) { log.push({ cid: cid, skipped: 'time' }); return; }
    try { __bnxReqCid_ = cid; var r = bnxBsRunAction_({ CLIENT_ID: cid, ROLE: 'ADMIN', USER_ID: 'AUTO_SYNC' }, { what: 'all' }); log.push({ cid: cid, r: r.data }); }
    catch (e) { log.push({ cid: cid, error: String(e.message || e) }); } finally { __bnxReqCid_ = ''; }
  });
  Logger.log(JSON.stringify(log, null, 1)); return log;
}
function bnxBsyncTick_() { RUN_BSYNC_All(); }
function RUN_BSYNC_TriggerOn() {
  RUN_BSYNC_TriggerOff();
  ScriptApp.newTrigger('bnxBsyncTick_').timeBased().everyHours(1).create();
  Logger.log('Bank / Sweep sync: every hour ON'); return 'ON';
}
function RUN_BSYNC_TriggerOff() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bnxBsyncTick_') ScriptApp.deleteTrigger(t); }); return 'OFF'; }

/* =====================================================================================================
 * v46 2026-11-26 — LOCATION-WISE STOCK: "all location wise show bar stores".
 * LOCATION_STOCK gets one more location, "Bar Store (bar register)", built from the bar module:
 *   opening   = bar physical count (BAR_B5_PHYSICAL_STOCK, ml) of the last count day on / before "from"
 *   + inward  = BAR_B2_STOCK_INWARD after that day (ml = QTY_ML, else bottles × bottle ml)
 *   − sold    = bills after that day: bottles / pegs through BAR_CODE_MASTER (sell ml), else BAR_STORE_MAPPING pour,
 *               cocktails BAR_B10 / mocktails BAR_B11 by ingredient ml
 *   = stock in ml and bottles, value at cost per ml.
 * Side by side: issueBal = the issue-based BAR department stock of the same item in ml, diff = register − issue-based.
 * The whole answer is cached 10 min per client + period (force:true re-reads) — the page no longer waits minutes.
 * ===================================================================================================== */
/* v46.2 26-11 ("Main Store OK, other not correct, Bar Store") — what was wrong and what it does now:
 *  1. Departments (MAIN KITCHEN, BAR, …) were "issued in the period − sold in the period" with NO opening, and store issues
 *     are entered only up to the last issue date (now 30-10) → for 01-11…30-11 every item was negative.
 *     Now: department stock = everything issued to it since 1 April − everything its sales used since 1 April
 *     (recipes / bar pours) − wastage, counted only UP TO THE LAST STORE-ISSUE DATE; the period columns show
 *     opening (as on From) + issued + used + wastage = closing. Sales after the last issue date are not deducted
 *     until those issues are entered (the screen says so).
 *  2. Bar Store (bar register): one store code can hold several bar items (RM0518 = Glenfiddich 12 / 15 / 18) — only the
 *     last count row of a code was kept. Now every count row of that day is added. Inward = store issues to the BAR
 *     department (DEPARTMENT_ISSUE, store units → ml) + direct bar purchases of BAR_B2 (the "ISS-ERP" copies of store
 *     issues in BAR_B2 are not counted twice). Bar sales are deducted only up to the last issue date as well.
 */
function bnxLocIssueUpto_(cid, db) {
  var o = { all: '' }; try {
    var rows = bnxBsCols_(db.TRANSACTION.getSheetByName('DEPARTMENT_ISSUE'), ['DATE', 'DEPARTMENT']); rows.shift();
    rows.forEach(function (r) { var d = bnxSrDate_(r[0]); if (!d) return; var k = String(r[1] || '').toUpperCase().trim(); if (d > (o[k] || '')) o[k] = d; if (d > o.all) o.all = d; });
  } catch (e) {}
  return o;
}
function bnxLocBarRegister_(cid, data, upto) {
  var db = bnxBcDbs_(cid), N = function (v) { var x = Number(String(v == null ? '' : v).replace(/[,₹\s]/g, '')); return isFinite(x) ? x : 0; };
  var r2 = function (n) { return Math.round(N(n) * 100) / 100; }, r3 = function (n) { return Math.round(N(n) * 1000) / 1000; };
  var nm = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  var tab = function (ss, name) { try { return bnxBcTable_(ss, name).rows; } catch (e) { return []; } };
  var from = data.from, to = upto && upto < data.to ? upto : data.to, store = bnxRcStore_(cid, db, false);
  var B5 = tab(db.TRANSACTION, 'BAR_B5_PHYSICAL_STOCK'), B2 = tab(db.TRANSACTION, 'BAR_B2_STOCK_INWARD');
  if (!B5.length && !B2.length) return;
  /* 1. count day = last count on / before "from"; opening = every count row of that day (several bar items can share one store code) */
  var D = ''; B5.forEach(function (r) { var d = bnxSrDate_(r.PHY_DATE); if (d && d <= from && d > D) D = d; });
  var I = {}, item = function (code, name) { code = String(code || '').trim(); if (!code) return null;
    return I[code] = I[code] || { code: code, name: name || '', cat: '', open: 0, openV: 0, recv: 0, used: 0, cpm: 0, btlMl: 0, usedBy: {}, unit: 'ML', cnt: '', names: {} }; };
  var lastDay = {};
  B5.forEach(function (r) { var d = bnxSrDate_(r.PHY_DATE), c = String(r.ITEM_CODE || '').trim(); if (!d || d > D || !c) return; if (!lastDay[c] || d > lastDay[c]) lastDay[c] = d; });
  B5.forEach(function (r) {
    var d = bnxSrDate_(r.PHY_DATE), c = String(r.ITEM_CODE || '').trim(); if (!c || d !== lastDay[c]) return;
    var x = item(c, r.STORE_ITEM_NAME || r.ITEM_NAME); var pq = N(r.PHYSICAL_QTY_ML), bm0 = N(r.BOTTLE_ML), cpm = N(r.COST_PER_ML);
    if (pq > 0 && bm0 > 0 && pq < bm0 && /BEER|BREEZER|ALCOPOP|PINT|CAN/i.test(String(r.GROUP || '') + ' ' + String(r.STORE_ITEM_NAME || r.ITEM_NAME || ''))) pq = pq * bm0;
    x.open += pq; x.openV += pq * cpm; x.btlMl = x.btlMl || bm0; x.cat = x.cat || String(r.GROUP || ''); x.cnt = d; x.names[String(r.ITEM_NAME || r.STORE_ITEM_NAME || '')] = 1;
  });
  Object.keys(I).forEach(function (c) { var x = I[c]; if (x.open > 0 && x.openV > 0) x.cpm = x.openV / x.open; });
  var start = D || '', inP = function (d) { return d && d <= to && (start ? d > start : d >= from); };
  /* 2. inward: store issues to the bar department (store units → ml) */
  var barDeptRe = new RegExp('^(' + String(data.bar || 'BAR').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '|BAR)$');
  tab(db.TRANSACTION, 'DEPARTMENT_ISSUE').forEach(function (r) {
    var d = bnxSrDate_(r.DATE); if (!inP(d) || !barDeptRe.test(String(r.DEPARTMENT || '').toUpperCase().trim())) return;
    var code = String(r.ITEM_ID || '').trim(), q = N(r.ISSUED_QTY); if (!code || !(q > 0)) return;
    var s = store.items[code] || {}; if (!(s.V > 0) && !I[code]) return;                 /* not a bottle item (sugar, ice…) → BAR department stock */
    var x = item(code, s.name || r.ITEM_NAME), ml = s.V > 0 ? q * s.V : (x.btlMl > 0 ? q * x.btlMl : 0);
    if (ml > 0) x.recv += ml; else { x.recv += q; x.unit = String(r.UNIT || s.uom || 'UNIT').toUpperCase(); }
  });
  /* … + direct bar purchases (BAR_B2 rows that are not copies of store issues) */
  B2.forEach(function (r) {
    if (/^ISS-ERP/i.test(String(r.STOCK_IN_ID || '')) || /internal issue/i.test(String(r.VENDOR || ''))) return;
    var d = bnxSrDate_(r.DATE); if (!inP(d)) return; var x = item(r.ITEM_CODE, r.BAR_NAME); if (!x) return;
    var ml = N(r.QTY_ML), bm = N(r.BOTTLE_ML), q = N(r.QTY_BTL); if (!(ml > 0) && bm > 0) ml = q * bm;
    if (ml > 0) { x.recv += ml; x.btlMl = x.btlMl || bm; } else { x.recv += q; x.unit = String(r.UOM || 'UNIT').toUpperCase(); }
    if (!x.cpm && N(r.RATE) > 0 && bm > 0) x.cpm = N(r.RATE) / bm;
  });
  /* 3. sold (bills after the count day, up to the last issue date) */
  var CM = tab(db.MASTER, 'BAR_CODE_MASTER'), byName = {}, byId = {}, byRep = {};
  CM.forEach(function (r) { var sc = String(r.STORE_ITEM_CODE || ''), ml = N(r.SELL_ML); if (!sc || !(ml > 0)) return;
    var o = { code: sc, ml: ml, iml: N(r.ISSUE_ML), name: r.STORE_ITEM_NAME };
    var k = nm(r.POS_ITEM_NAME); if (k && !byName[k]) byName[k] = o; if (r.POS_ITEM_ID && !byId[r.POS_ITEM_ID]) byId[r.POS_ITEM_ID] = o; var rk = nm(r.REPORT_NAME); if (rk && !byRep[rk]) byRep[rk] = o; });
  var pour = {}; tab(db.MASTER, 'BAR_STORE_MAPPING').forEach(function (r) { var k = String(r.ITEM_ID || ''), sv = N(r.SERVING_ML); if (k && r.STORE_ITEM_CODE && sv > 0 && !pour[k]) pour[k] = { code: String(r.STORE_ITEM_CODE), ml: sv, iml: N(r.ML_PER_UNIT) }; });
  var rec = {};
  tab(db.TRANSACTION, 'BAR_B10_COCKTAIL_RECIPE').forEach(function (r) { if (r.ACTIVE === false || /FALSE/i.test(String(r.ACTIVE))) return; var ml = N(r.ML); if (!(ml > 0)) return;
    var ing = byRep[nm(r.INGREDIENT)] || byName[nm(r.INGREDIENT)], code = ing ? ing.code : (store.items[String(r.ITEM_CODE || '')] ? String(r.ITEM_CODE) : ''); if (!code) return;
    [String(r.ITEM_CODE || ''), nm(r.RECIPE_NAME)].forEach(function (k) { if (k) (rec[k] = rec[k] || []).push({ code: code, ml: ml }); }); });
  tab(db.TRANSACTION, 'BAR_B11_MOCKTAIL_RECIPE').forEach(function (r) { if (r.ACTIVE === false || /FALSE/i.test(String(r.ACTIVE))) return; var ml = N(r.ML), c = String(r.ITEM_CODE || ''); if (!(ml > 0) || !c) return;
    (rec[nm(r.RECIPE_NAME)] = rec[nm(r.RECIPE_NAME)] || []).push({ code: c, ml: ml }); });
  var notMapped = 0, sFrom = start ? (function () { var x = new Date(start + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); })() : from;
  if (sFrom <= to) {
    var sold = bnxRcSold_(cid, db, sFrom, to, 'BAR'), seen = {};
    Object.keys(sold.items).forEach(function (k) {
      var x = sold.items[k]; if (seen[x.name + '|' + x.qty]) return; seen[x.name + '|' + x.qty] = 1;
      var m = byName[nm(x.name)] || byId[k] || pour[k], it;
      if (m) { it = item(m.code, m.name); it.used += x.qty * m.ml; it.usedBy[x.name] = 1; if (!it.btlMl && m.iml > 0 && m.iml < 5000) it.btlMl = m.iml; return; }
      var rc = rec[k] || rec[nm(x.name)];
      if (rc) { rc.forEach(function (l) { if (!I[l.code] && !((store.items[l.code] || {}).V > 0)) return;   /* sugar / ice / milk (kg, no ml size) stay in the BAR department stock */
        var y = item(l.code); y.used += x.qty * l.ml; y.usedBy[x.name] = 1; }); return; }
      notMapped += x.net;
    });
  }
  /* 4. issue-based BAR department of the same items (store units → ml) */
  var barDept = (data.locations || []).filter(function (l) { return l.id === data.bar; })[0], issue = {};
  if (barDept) barDept.rows.forEach(function (r) { var s = store.items[r.code]; if (s && s.V > 0) issue[r.code] = r.bal * s.V; });
  /* 5. location */
  var rows = Object.keys(I).map(function (c) {
    var x = I[c], s = store.items[c] || {}, bal = x.open + x.recv - x.used, ml = x.unit === 'ML';
    /* cost per ml: store rate ÷ ml per store unit first (the bar count sheet has case rates typed as per-ml on some beers) */
    var sc = s.V > 0 && s.rate > 0 ? s.rate / s.V : 0, cpm = sc || x.cpm, btl = x.btlMl || (s.V > 0 ? s.V : 0), ib = issue[c];
    return { code: c, name: s.name || x.name || c, cat: x.cat || s.cat || '', uom: x.unit, rate: r2(ml ? cpm * (btl || 1) : (s.rate || 0)), rateMl: r3(cpm), countDate: x.cnt || D,
      open: r2(x.open), recv: r2(x.recv), used: r2(x.used), waste: 0, bal: r2(bal), btlMl: btl, btl: ml && btl ? r2(bal / btl) : '',
      issueBal: ib == null ? '' : r2(ib), diff: ib == null ? '' : r2(bal - ib), value: r2(ml ? bal * cpm : bal * (s.rate || 0)),
      usedBy: Object.keys(x.usedBy).slice(0, 4).join(', '), items: Object.keys(x.names).join(' / ') };
  }).filter(function (r) { return (r.open || r.recv || r.used) && (r.uom === 'ML' || r.open); }).sort(function (a, b) { return Math.abs(b.value) - Math.abs(a.value); });
  if (!rows.length) return;
  var val = 0; rows.forEach(function (r) { val += r.value; });
  var L = { id: 'BAR_REGISTER', name: 'Bar Store (bar register)', type: 'BARREG', countDate: D, asOf: to, items: rows.length, value: r2(val), neg: rows.filter(function (r) { return r.bal < -0.5; }).length, rows: rows };
  var at = 0; (data.locations || []).forEach(function (l, i) { if (l.type === 'STORE') at = i + 1; });
  data.locations.splice(at, 0, L);
  data.barRegister = { countDate: D, asOf: to, notMapped: r2(notMapped), salesFrom: sFrom };
}
/* department rows = cumulative since 1 April up to the last issue date; period columns derived */
function bnxLocDeptMerge_(A, B, C, upto) {
  var r2 = function (n) { return Math.round((+n || 0) * 100) / 100; }, r3 = function (n) { return Math.round((+n || 0) * 1000) / 1000; };
  var map = function (X) { var o = {}; ((X && X.data && X.data.locations) || []).forEach(function (l) { if (l.type === 'DEPT') o[l.id] = l; }); return o; };
  var Bm = map(B), Cm = C ? map(C) : {}, out = [];
  Object.keys(Bm).forEach(function (id) {
    var Lb = Bm[id], Lc = Cm[id], cr = {}; if (Lc) Lc.rows.forEach(function (r) { cr[r.code] = r; });
    var val = 0, rows = Lb.rows.map(function (r) { var c = cr[r.code] || { recv: 0, used: 0, waste: 0, usedBy: '' };
      var mv = (+c.recv || 0) - (+c.used || 0) - (+c.waste || 0), v = r.value; val += v;
      return { code: r.code, name: r.name, cat: r.cat, uom: r.uom, rate: r.rate, open: r3(r.bal - mv), recv: r3(c.recv), used: r3(c.used), waste: r3(c.waste), bal: r3(r.bal), value: r2(v), usedBy: c.usedBy || r.usedBy || '' }; })
      .filter(function (r) { return r.bal || r.recv || r.used || r.open; }).sort(function (a, b) { return Math.abs(b.value) - Math.abs(a.value); });
    out.push({ id: Lb.id, name: Lb.name, type: 'DEPT', asOf: upto, items: rows.length, value: r2(val), neg: rows.filter(function (r) { return r.bal < -0.0005; }).length, rows: rows });
  });
  return out.sort(function (a, b) { return b.value - a.value; });
}
(function () {
  if (typeof bnxLocationStock_ !== 'function') return;
  var base = bnxLocationStock_;
  bnxLocationStock_ = function (session, payload) {
    var p = payload || {}, t0 = Date.now(), gen = '0', cid = session.CLIENT_ID; try { gen = bnxFcGen2_(cid, bnxSrDate_(p.to) || ''); } catch (e) {}
    var DM = bnxLocDeptCfg_(cid), ck = 'locstk463_' + cid + '_' + gen + '_' + (p.from || '') + '_' + (p.to || '') + '_' + JSON.stringify(DM).length + (DM.at || '');
    if (!p.__warm) bnxWarmNote_(cid, 'LOCATION_STOCK', { from: p.from || '', to: p.to || '' });
    if (!p.force) { try { var h = bnxBigCacheGet_(ck) || (p.__warm ? null : bnxBigCacheGet_(ck + '_p')); if (h) { var o = JSON.parse(h); o.cached = true; return o; } } catch (e) {} }
    var A = base(session, p); if (!A || !A.success || !A.data) return A;
    var d = A.data, from = d.from, to = d.to, fy = (to.slice(5) >= '04-01' ? to.slice(0, 4) : String(+to.slice(0, 4) - 1)) + '-04-01';
    try {
      var db = bnxBcDbs_(cid), li = bnxLocIssueUpto_(cid, db), upto = li.all && li.all < to ? li.all : to;
      var B = (from === fy && upto === to) ? A : base(session, { from: fy, to: upto });
      var C = from > upto ? null : (from === fy ? B : (upto === to ? A : base(session, { from: from, to: upto })));
      if (B && B.success) {
        var depts = bnxLocDeptApply_(bnxLocDeptMerge_(A, B, C, upto), C, d, DM);
        d.locations = d.locations.filter(function (l) { return l.type !== 'DEPT'; }).concat(depts);
        d.deptAsOf = upto; d.issuesUpto = li.all || '';
        if (upto < to) d.note = 'Store issues are entered up to ' + upto.split('-').reverse().join('-') + ' — department and bar stock are shown as on that date (sales after it are not deducted until the issues are entered).';
      }
      if (p.__warm || Date.now() - t0 < 60000) { try { bnxLocBarRegister_(cid, d, upto); } catch (e) { d.barRegisterError = String(e && e.message || e); } }
      else { d.barRegisterPending = true; try { bnxWarmSoon_(cid); } catch (e) {} }
    } catch (e) { d.deptError = String(e && e.message || e); }
    try { bnxBigCachePut_(d.barRegisterPending ? ck + '_p' : ck, JSON.stringify(A), d.barRegisterPending ? 600 : 21600); } catch (e) {}
    return A;
  };
})();

/* =====================================================================================================
 * v46 2026-11-26 — TRANSACTION DB CLEAN-UP: tabs that no ERP screen / server code uses
 * (checked against every page of the site + all Apps Script files, 26-11-2026). Nothing is lost:
 * RUN_UNUSED_Remove first copies each tab into a new file "<DB name> ARCHIVE yyMMdd" in the same Drive folder,
 * checks the copy has the same number of rows, and only then deletes the tab from the Transaction DB.
 *   RUN_UNUSED_Check   — read only: lists the tabs it would remove (name, rows).
 *   RUN_UNUSED_Remove  — archive + remove.
 * ===================================================================================================== */
var BNX_UNUSED_TABS = {
  CLIENTS: ['CL00010', 'CL00011'],
  EXACT: ['SUPPLIER_PURCHASE_HEAD', 'PURCHASE_HEAD_REVIEW', 'Sheet108', 'REQ_REGISTER', 'BAR_CONSUMPTION'],
  PREFIX: ['OLD_RAW_MATERIAL_MASTER', 'CUSTOMER_DUES_BAK_', 'CUSTOMER_DUES_BILLWISE_BAK_', 'Swift_Transaction Report BAK', 'Swift_Settlement Report BAK'],
  RE: [/^Sheet\d+$/, /^Copy of /i]
};
function bnxUnusedTabs_(ss) {
  var C = BNX_UNUSED_TABS;
  return ss.getSheets().filter(function (sh) {
    var n = sh.getName();
    return C.EXACT.indexOf(n) >= 0 || C.PREFIX.some(function (p) { return n.indexOf(p) === 0; }) || C.RE.some(function (re) { return re.test(n); });
  });
}
function RUN_UNUSED_Check() { return bnxUnusedRun_(false); }
function RUN_UNUSED_Remove() { return bnxUnusedRun_(true); }
function bnxUnusedRun_(write) {
  var out = [];
  BNX_UNUSED_TABS.CLIENTS.forEach(function (cid) {
    var ss; try { ss = bnxPqDb_(cid, 'TRANSACTION'); } catch (e) { Logger.log(cid + ': Transaction DB not found'); return; }
    var tabs = bnxUnusedTabs_(ss);
    Logger.log(cid + ' · ' + ss.getName() + ' · ' + ss.getSheets().length + ' tabs · unused: ' + tabs.length);
    tabs.forEach(function (sh) { Logger.log('   ' + sh.getName() + '  (' + sh.getLastRow() + ' rows)'); });
    if (!write || !tabs.length) { out.push({ cid: cid, unused: tabs.map(function (s) { return s.getName(); }) }); return; }
    if (tabs.length >= ss.getSheets().length) { Logger.log('   refused: would remove every tab'); return; }
    var name = ss.getName() + ' ARCHIVE ' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMdd-HHmm');
    var arc = SpreadsheetApp.create(name), file = DriveApp.getFileById(arc.getId());
    try { var par = DriveApp.getFileById(ss.getId()).getParents(); if (par.hasNext()) { var f = par.next(); f.addFile(file); DriveApp.getRootFolder().removeFile(file); } } catch (e) {}
    var removed = [];
    tabs.forEach(function (sh) {
      var n = sh.getName(), rows = sh.getLastRow(), c = sh.copyTo(arc);
      c.setName(n.slice(0, 99));
      SpreadsheetApp.flush();
      if (c.getLastRow() !== rows) { Logger.log('   ✗ ' + n + ' copy has ' + c.getLastRow() + ' rows, original ' + rows + ' — NOT removed'); return; }
      ss.deleteSheet(sh); removed.push(n + ' (' + rows + ')');
    });
    try { var first = arc.getSheets()[0]; if (arc.getSheets().length > 1 && first.getLastRow() === 0 && /^(Sheet1|Feuille 1|Sheet 1)$/.test(first.getName())) arc.deleteSheet(first); } catch (e) {}
    Logger.log('   ✅ removed ' + removed.length + ' tabs · archive: ' + arc.getUrl());
    out.push({ cid: cid, removed: removed, archive: arc.getUrl() });
  });
  return out;
}

/* =====================================================================================================
 * v46 2026-11-26 — CASH BOOK (GET_CASHBOOK_REPORT) = the owner's cash book
 * ROOT CAUSE of "Cash balance check: 18 of 18 dated rows differ" (01-11: server 2,90,674 · DSR 1,96,657) and of the
 * Dashboard closing cash 1,86,471 vs DSR 6,77,919: the server added the POS cash payments (PAYMENT_MASTER / DUES_RECEIPT)
 * AND the owner-cash-book rows synced into CASH_MOVEMENT (CASH_SALE IN 48,017 on 01-11) — the same money twice — and
 * started from a balance worked out over all history.
 * Now every day that has a CASH_CONTROL row (owner cash book sync / day close) uses that row: opening, cash in, cash out,
 * closing. Days after the last such row roll forward from its closing with the live POS / manual movements.
 * ===================================================================================================== */
(function () {
  if (typeof bnxGetCashbookReport_impl_ !== 'function') return;
  var base = bnxGetCashbookReport_impl_;
  bnxGetCashbookReport_impl_ = function (session, payload) {
    var res = base.apply(this, arguments);
    try {
      if (!res || !res.success || !res.data) return res;
      var cid = String(session.CLIENT_ID || ''), from = res.data.from, to = res.data.to, r2 = function (x) { return Math.round((Number(x) || 0) * 100) / 100; };
      var cc = bnxClientSheet(cid, SHEETS.CASH_CONTROL), vv = cc.getDataRange().getValues(), hh = (vv.shift() || []).map(String), c = function (k) { return hh.indexOf(k); };
      var ci = c('CLIENT_ID'), di = c('BUSINESS_DATE'), oi = c('OPENING_CASH'), ii = c('CASH_IN'), xi = c('CASH_OUT'), li = c('CLOSING_CASH');
      if (di < 0 || li < 0) return res;
      var ctl = {}, lastBefore = '';
      vv.forEach(function (r) {
        if (ci >= 0 && r[ci] && String(r[ci]) !== cid) return;
        var d = bnxNormalizeDateKey_(r[di]); if (!d || r[li] === '' || r[li] == null || !isFinite(Number(r[li]))) return;
        ctl[d] = { open: Number(r[oi]) || 0, inn: Number(r[ii]) || 0, out: Number(r[xi]) || 0, close: Number(r[li]) || 0 };
        if (d < from && d > lastBefore) lastBefore = d;
      });
      if (!Object.keys(ctl).length) return res;
      /* live movements of days without a control row (from the original report) */
      var live = {}; (res.data.rows || []).forEach(function (x) { live[x.date] = x; });
      var gapFrom = lastBefore ? (function () { var x = new Date(lastBefore + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); })() : from;
      if (lastBefore && gapFrom < from) {                     /* days between the last control row and "from" */
        var g = base.call(this, session, Object.assign({}, payload, { range: 'custom', from: gapFrom, to: from }));
        if (g && g.success && g.data) (g.data.rows || []).forEach(function (x) { if (x.date < from && !live[x.date]) live[x.date] = x; });
      }
      var opening = lastBefore ? ctl[lastBefore].close : (ctl[from] ? ctl[from].open : Number(res.data.openingBalance) || 0);
      var days = {}; Object.keys(live).forEach(function (d) { if (d >= gapFrom && d <= to) days[d] = 1; }); Object.keys(ctl).forEach(function (d) { if (d >= gapFrom && d <= to) days[d] = 1; });
      var rows = [], openingAtFrom = null;
      Object.keys(days).sort().forEach(function (d) {
        var k = ctl[d], x = live[d] || { cashIn: 0, cashOut: 0, adjustments: 0 }, op, inn, out, cl;
        if (k) { op = k.open; inn = k.inn; out = k.out; cl = k.close; }
        else { op = opening; inn = Number(x.cashIn) || 0; out = Number(x.cashOut) || 0; cl = op + inn - out + (Number(x.adjustments) || 0); }
        opening = cl;
        if (d < from) return;
        if (openingAtFrom === null) openingAtFrom = op;
        rows.push({ CLIENT_ID: cid, LOCATION_ID: (rows[0] || {}).LOCATION_ID || '', FROM_DATE: d, TO_DATE: d, date: d, mode: 'Cash', PAYMENT_MODE: 'CASH', OPENING_BALANCE: r2(op),
          cashIn: r2(inn), cashOut: r2(out), RECEIPTS: r2(inn), PAYMENTS: r2(out), ADJUSTMENTS: 0, closingBalance: r2(cl), CLOSING_BALANCE: r2(cl), source: k ? 'CASH_CONTROL' : 'LIVE' });
      });
      res.data.rows = rows;
      res.data.openingBalance = r2(openingAtFrom === null ? opening : openingAtFrom);
      res.data.closingBalance = r2(opening);
      res.data.cashBookSource = 'CASH_CONTROL + live';
    } catch (e) { try { res.data.cashBookNote = 'owner cash book not applied: ' + e.message; } catch (x) {} }
    return res;
  };
})();

/* =====================================================================================================
 * v46 2026-11-26 — OWNER CASH BOOK SYNC: FY sheet › CASH  →  CASH_CONTROL + DAILY_COLLECTION + CASH_MOVEMENT
 * The cash book was synced once (14-Nov, up to 13-11). After that the ERP had no deposits / petty / main-cash rows, so
 * the DSR cash book ran up to 6,77,919 while your sheet says otherwise. Every bank / Sweep sync (hourly) now also copies
 * the CASH tab rows (date, sale cash, due received, main cash, petty cash, bank deposit, balance) — same IDs as before
 * (CBCSH- / DCCSH- / CBMSH-yyyymmdd), so a row is updated, never doubled. Other money in / out = whatever makes the
 * sheet's own BALANCE column come out exactly.   RUN_CASHSYNC_Check (read only) · RUN_CASHSYNC_Fix
 * ===================================================================================================== */
var BNX_CASHSYNC = { CLIENT_ID: 'CL00010', LOCATION_ID: 'LOC00001', NAME: 'FY 25-27 Hashtag Siliguri', PROP: 'BNX_DUES_SHEET_ID', TAB: 'CASH', SINCE: '2026-04-01' };
function RUN_CASHSYNC_Check() { var r = bnxCashSync_(BNX_CASHSYNC.CLIENT_ID, false); Logger.log(JSON.stringify(r, null, 1)); return r; }
function RUN_CASHSYNC_Fix() { __bnxReqCid_ = BNX_CASHSYNC.CLIENT_ID; try { var r = bnxCashSync_(BNX_CASHSYNC.CLIENT_ID, true); Logger.log(JSON.stringify(r, null, 1)); return r; } finally { __bnxReqCid_ = ''; } }
function bnxCashSync_(cid, write) {
  var C = BNX_CASHSYNC; if (cid !== C.CLIENT_ID) return { skipped: 'no cash book sheet for ' + cid };
  var src = bnxSheetByNameOrProp_(C.PROP, C.NAME, C.TAB, 'BNX_CASH_TAB_X'), tz = src.getParent().getSpreadsheetTimeZone() || bnxBsTz_();
  var v = src.getDataRange().getValues(), N = function (x) { return bnxBsNum_(x); }, r2 = function (x) { return Math.round(x * 100) / 100; };
  var hr = -1; for (var i = 0; i < Math.min(15, v.length); i++) { var n = v[i].map(bnxBsNorm_); if (n.indexOf('date') >= 0 && n.indexOf('salecash') >= 0) { hr = i; break; } }
  if (hr < 0) throw new Error('CASH tab: heading row (DATE, SALE CASH) not found');
  var H = v[hr].map(bnxBsNorm_), col = function (re) { for (var k = 0; k < H.length; k++) if (re.test(H[k])) return k; return -1; };
  var cD = col(/^date$/), cS = col(/^salecash$/), cDu = col(/^duereceived$/), cM = col(/^maincash$/), cP = col(/^pettycash$/), cB = col(/^bankdeposit$/), cK = col(/^balance$/);
  if ([cD, cS, cK].some(function (x) { return x < 0; })) throw new Error('CASH tab: DATE / SALE CASH / BALANCE columns not found');
  var today = bnxBusinessDateKey_(), days = [], prev = null;
  for (var r = hr + 1; r < v.length; r++) {
    var row = v[r], bal = row[cK];
    if (/OPENING/i.test(String(row[cD] || ''))) { prev = N(bal); continue; }
    var d = bnxBsDt_(row[cD], tz).d; if (!d || bal === '' || bal == null || !isFinite(N(bal))) continue;
    var blank = [cS, cDu, cM, cP, cB].every(function (c) { return c < 0 || row[c] === '' || row[c] == null; });
    if (blank) { prev = N(bal); continue; }                          /* a month's opening line (sometimes typed as a date) */
    var sale = N(row[cS]), due = cDu >= 0 ? N(row[cDu]) : 0, main = cM >= 0 ? N(row[cM]) : 0, petty = cP >= 0 ? N(row[cP]) : 0, bank = cB >= 0 ? N(row[cB]) : 0, k = N(bal);
    if (prev !== null && d >= C.SINCE && d <= today) {
      var other = r2(k - (prev + sale + due - main - petty - bank));
      days.push({ d: d, row: r + 1, open: prev, sale: sale, due: due, main: main, petty: petty, bank: bank, other: other, close: k });
    }
    prev = k;
  }
  var seen = {}; days = days.filter(function (x, i) { return true; }).reverse().filter(function (x) { if (seen[x.d]) return false; seen[x.d] = 1; return true; }).reverse();
  while (days.length && !(days[days.length - 1].sale || days[days.length - 1].due || days[days.length - 1].main || days[days.length - 1].petty || days[days.length - 1].bank || days[days.length - 1].other)) days.pop();   /* days not entered yet */
  if (!write) return { days: days.length, from: days.length ? days[0].d : '', to: days.length ? days[days.length - 1].d : '', last: days.slice(-3) };
  var ss = bnxPqDb_(cid, 'TRANSACTION'), tTz = ss.getSpreadsheetTimeZone() || bnxBsTz_(), now = new Date();
  var dOf = function (d) { return Utilities.parseDate(d + ' 00:00', tTz, 'yyyy-MM-dd HH:mm'); };
  var upsert = function (name, rows) {                               /* rows: [{ID_COL:..., ...}] keyed on the first column */
    var sh = ss.getSheetByName(name); if (!sh) return 0;
    var vv = sh.getDataRange().getValues(), hh = (vv[0] || []).map(String), at = {}, add = [], upd = 0;
    for (var q = 1; q < vv.length; q++) if (vv[q][0]) at[String(vv[q][0])] = q;
    rows.forEach(function (o) {
      var id = String(o[hh[0]]), line = hh.map(function (h, j) { return Object.prototype.hasOwnProperty.call(o, h) ? o[h] : (at[id] >= 0 ? vv[at[id]][j] : ''); });
      if (at[id] === -1) return;
      if (at[id] != null) {
        var same = line.every(function (x, j) { var y = vv[at[id]][j]; return x instanceof Date || y instanceof Date || /(_AT|_BY|^NOTES)$/.test(hh[j]) ? true : String(x) === String(y); });
        if (!same) { vv[at[id]] = line; upd++; sh.getRange(at[id] + 1, 1, 1, hh.length).setValues([line]); }
      } else { add.push(line); at[id] = -1; }
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, hh.length).setValues(add);
    return { added: add.length, updated: upd };
  };
  var lock = bnxTenantLock_(); if (!lock.tryLock(60000)) return { error: 'Busy — retry' };
  try {
    var ctl = [], dc = [], mv = [];
    days.forEach(function (x) {
      var y = x.d.replace(/-/g, ''), note = 'Hashtag CASH row ' + x.row, dt = dOf(x.d);
      var ins = x.sale + x.due + (x.main < 0 ? -x.main : 0) + (x.other > 0 ? x.other : 0), outs = (x.main > 0 ? x.main : 0) + x.petty + x.bank + (x.other < 0 ? -x.other : 0);
      ctl.push({ CONTROL_ID: 'CBCSH-' + y, CLIENT_ID: cid, BUSINESS_DATE: dt, OPENING_CASH: x.open, CASH_IN: r2(ins), CASH_OUT: r2(outs), CLOSING_CASH: x.close, VARIANCE: 0, STATUS: 'MATCHED',
        OPENED_BY: 'CASHBOOK_SYNC', CLOSED_BY: 'CASHBOOK_SYNC', OPENED_AT: now, CLOSED_AT: now, NOTES: note + '; source cash balance, not physical count; sync ' + Utilities.formatDate(now, 'Asia/Kolkata', 'dd-MMM-yyyy') });
      dc.push({ DAILY_COLLECTION_ID: 'DCCSH-' + y, CLIENT_ID: cid, LOCATION_ID: C.LOCATION_ID, COLLECTION_DATE: dt, SHIFT: 'CASHBOOK', OPENING_CASH: x.open, CASH_SALES: x.sale, CARD_SALES: 0,
        OTHER_RECEIPTS: r2(ins - x.sale), TOTAL_COLLECTED: r2(ins), PAYMENTS_MADE: r2(outs), SHORTAGE_SURPLUS: 0, CLOSING_CASH: x.close,
        NOTES: note + '; due cash ' + x.due + '; main cash ' + x.main + '; petty ' + x.petty + '; bank deposit ' + x.bank + '; other ' + x.other + '; source balance', CREATED_BY: 'CASHBOOK_SYNC', CREATED_AT: now, VERIFIED_BY: 'HASHTAG_CASH', VERIFIED_AT: now });
      [['CASH_SALE', 'IN', x.sale, 'Cash sale'], ['DUE_COLLECTION_CASH', 'IN', x.due, 'Due received in cash'], ['MAIN_CASH_TRANSFER', x.main < 0 ? 'IN' : 'OUT', Math.abs(x.main), 'Cash paid to main cash / owner (negative = cash received from main)'],
       ['PETTY_CASH_TRANSFER', 'OUT', x.petty, 'Cash to petty cash'], ['BANK_CASH_DEPOSIT', 'OUT', x.bank, 'Cash deposited in bank'], ['OTHER_CASH', x.other < 0 ? 'OUT' : 'IN', Math.abs(x.other), 'Other cash in / out (balance difference in the sheet)']].forEach(function (m) {
        mv.push({ MOVEMENT_ID: 'CBMSH-' + y + '-' + m[0], CLIENT_ID: cid, DATE: dt, SOURCE_TYPE: 'OWNER_CASH_BOOK', SOURCE_ID: 'CB-' + y, DIRECTION: m[1], CATEGORY: m[0], DESCRIPTION: m[3] + '; ' + note,
          AMOUNT: r2(m[2]), PAYMENT_MODE: 'CASH', REFERENCE: 'CASH-' + x.d + '-' + m[0], USER_ID: 'CASHBOOK_SYNC', STATUS: m[2] ? 'VERIFIED' : 'VOID', CREATED_AT: now });
      });
    });
    var mvKeep = mv.filter(function (m) { return m.AMOUNT; }), mvVoid = mv.filter(function (m) { return !m.AMOUNT; });
    var out = { days: days.length, to: days.length ? days[days.length - 1].d : '', CASH_CONTROL: upsert('CASH_CONTROL', ctl), DAILY_COLLECTION: upsert('DAILY_COLLECTION', dc), CASH_MOVEMENT: upsert('CASH_MOVEMENT', mvKeep) };
    /* a category that is now 0 in the sheet: an earlier synced row of it is voided (only rows that exist) */
    var ms = ss.getSheetByName('CASH_MOVEMENT');
    if (ms && mvVoid.length) { var ids = {}; ms.getRange(2, 1, Math.max(1, ms.getLastRow() - 1), 1).getValues().forEach(function (z) { ids[String(z[0])] = 1; });
      var vo = mvVoid.filter(function (m) { return ids[m.MOVEMENT_ID]; }); if (vo.length) out.voided = upsert('CASH_MOVEMENT', vo); }
    try { if (typeof bnxBillGenBump_ === 'function') bnxBillGenBump_(cid); CacheService.getScriptCache().put('livegen_' + cid, String(Date.now()), 21600); } catch (e) {}
    return out;
  } finally { lock.releaseLock(); }
}
/* the hourly bank / Sweep sync (and "⟳ Sync bank & Sweep") also brings the cash book */
(function () {
  var base = bnxBsRunAction_;
  bnxBsRunAction_ = function (s, p) {
    var r = base.apply(this, arguments);
    try { if (r && r.success && String(p && p.what || 'all') === 'all' && String(s.CLIENT_ID) === BNX_CASHSYNC.CLIENT_ID) r.data.cash = bnxCashSync_(String(s.CLIENT_ID), true); }
    catch (e) { if (r && r.data) r.data.cash = { error: String(e.message || e) }; }
    return r;
  };
})();

/* =====================================================================================================
 * v46 2026-11-26 — "Customer Credit first shows 37,36,738, then 41,31,454":
 * DUES_LIST keeps its answer in the script cache ('dues_<client>'). RUN_DUESYNC_Fix / RUN_DUES_Fix / the cash sync write
 * the sheets directly, so the page kept showing the OLD cached total until that cache ran out. Every direct dues /
 * cash fix now clears the dues caches and moves the live generation on, so the next open shows the new figure at once.
 * RUN_DUES_ClearCache — run it once now (clears the old cached 37,36,738).
 * ===================================================================================================== */
function bnxBustDueCaches_(cid) {
  try {
    var c = CacheService.getScriptCache();
    c.removeAll(['dues_' + cid, 'duecoll_' + cid, 'duecollection_' + cid]);
    c.put('livegen_' + cid, String(Date.now()), 21600);
    if (typeof bnxBillGenBump_ === 'function') bnxBillGenBump_(cid);
  } catch (e) {}
}
function RUN_DUES_ClearCache() { ['CL00010', 'CL00011'].forEach(bnxBustDueCaches_); Logger.log('Dues caches cleared — open Customer Credit again.'); }
(function () {
  if (typeof bnxDueSync_ === 'function') { var a1 = bnxDueSync_; bnxDueSync_ = function (write) { var r = a1.apply(this, arguments); if (write === true) bnxBustDueCaches_(BNX_DUESYNC.CLIENT_ID); return r; }; }
  if (typeof bnxDuesFix_ === 'function') { var a2 = bnxDuesFix_; bnxDuesFix_ = function (write) { var r = a2.apply(this, arguments); if (write === true) bnxBustDueCaches_('CL00010'); return r; }; }
  if (typeof bnxCashSync_ === 'function') { var a3 = bnxCashSync_; bnxCashSync_ = function (cid, write) { var r = a3.apply(this, arguments); if (write === true) bnxBustDueCaches_(cid); return r; }; }
})();


/* =====================================================================================================
 * v46 2026-11-26 — AFTER EVERY IMPORT, EVERYTHING IS UPDATED BY ITSELF
 * ("bill and bill items upload → transaction DB and master DB update and all reports ready; same for bank / Sweep import")
 * An import (Import Center POS sales, IMPORT_TRANSACTIONS, DSR bills, bank file, Swift / Sweep) answers at once and
 * 30 s later a follow-up run does, for that client:
 *   sales imports: blank CLIENT_ID on lines / payments → item master link + ITEM_CODE / CATEGORY / group on every bill line →
 *                  bills without item detail repaired → Zomato / Swiggy payment modes → guest dues = FY Dues sheet (CL00010, only
 *                  when they differ, no backup tab) → cash book = FY CASH tab (CL00010)
 *   bank / Sweep:  bank sheets + Sweep (Collection Date, RRN) + settlement copied (BANK_SYNC_RUN)
 *   always:        DSR / dues / cash / reco caches cleared, so every report shows the new data on the next open.
 * Result lines go to the Transaction DB tab DB_FIX_LOG ("After import"). RUN_AFTERIMPORT_Now runs it by hand.
 * ===================================================================================================== */
var BNX_AFTERIMP_RE = /^(IMPORT_[A-Z_]+|SAVE_DSR_IMPORTED_BILLS|BANK_TXN_IMPORT|SWIFT_[A-Z_]*(IMPORT|UPLOAD|SAVE)[A-Z_]*|AGG_PAYOUT_UPLOAD)$/;
function bnxAfterImportSchedule_(cid, action) {
  if (!cid) return;
  try { bnxBustDueCaches_(cid); } catch (e) {}   /* reports read the new rows at once */
  var P = PropertiesService.getScriptProperties(), q = {};
  try { q = JSON.parse(P.getProperty('BNX_AFTERIMP') || '{}') || {}; } catch (e) {}
  var kind = /BANK|SWIFT|SWEEP/.test(action) ? 'bank' : /AGG_/.test(action) ? 'agg' : 'sales';
  q[cid] = q[cid] || {}; q[cid][kind] = Date.now(); P.setProperty('BNX_AFTERIMP', JSON.stringify(q));
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'bnxAfterImportRun_'; });
  if (!has) ScriptApp.newTrigger('bnxAfterImportRun_').timeBased().after(30 * 1000).create();
}
function RUN_AFTERIMPORT_Now() { var P = PropertiesService.getScriptProperties(), q = {}; ['CL00010', 'CL00011'].forEach(function (c) { q[c] = { sales: 1, bank: 1 }; }); P.setProperty('BNX_AFTERIMP', JSON.stringify(q)); bnxAfterImportRun_(); }
function bnxAfterImportRun_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bnxAfterImportRun_') ScriptApp.deleteTrigger(t); });
  var P = PropertiesService.getScriptProperties(), q = {}, t0 = Date.now();
  try { q = JSON.parse(P.getProperty('BNX_AFTERIMP') || '{}') || {}; } catch (e) {}
  P.deleteProperty('BNX_AFTERIMP');
  Object.keys(q).forEach(function (cid) {
    var k = q[cid], log = [];
    var step = function (name, fn) {
      if (Date.now() - t0 > 4.5 * 60000) { log.push(name + ': next run'); var r = {}; try { r = JSON.parse(P.getProperty('BNX_AFTERIMP') || '{}') || {}; } catch (e) {} r[cid] = k; P.setProperty('BNX_AFTERIMP', JSON.stringify(r)); return; }
      try { var x = fn(); log.push(name + ': ' + (x == null ? 'done' : String(typeof x === 'object' ? JSON.stringify(x) : x).slice(0, 300))); } catch (e) { log.push(name + ': ⚠ ' + String(e.message || e).slice(0, 200)); }
    };
    var withCid = function (cfg, fn) { return function () { var old = cfg.CLIENT_ID; cfg.CLIENT_ID = cid; try { return fn(); } finally { cfg.CLIENT_ID = old; } }; };
    __bnxReqCid_ = cid;
    try {
      if (k.sales) {
        if (typeof bnxDbFixClientId_ === 'function') step('Blank CLIENT_ID', withCid(BNX_DBFIX, function () { return bnxDbFixClientId_(true); }));
        if (typeof bnxImapBills_ === 'function') step('Bill lines item / code / category / group', withCid(BNX_IMAP_CFG, function () { bnxImapBills_(true); }));
        if (typeof bnxNoItemRun_ === 'function') step('Bills without item detail', withCid(BNX_NOITEM_CFG, function () { return bnxNoItemRun_(true); }));
        if (typeof bnxAggPayFix_ === 'function' && cid === BNX_AGGIMP.CLIENT_ID) step('Zomato / Swiggy payment modes', function () { return bnxAggPayFix_(true); });
        if (cid === BNX_DUESYNC.CLIENT_ID) step('Guest dues = FY Dues sheet', function () {
          var c = bnxDueSync_(false); if (!c || !c.diffs) return 'already equal';
          BNX_DUESYNC.NO_BAK = true; try { return bnxDueSync_(true); } finally { BNX_DUESYNC.NO_BAK = false; } });
        step('Guest dues: one row per customer', function () { return bnxDuesDedupe_(cid, true); });
        if (cid === BNX_CASHSYNC.CLIENT_ID) step('Cash book = FY CASH tab', function () { return bnxCashSync_(cid, true); });
      }
      if (k.bank) step('Bank sheets + Sweep', function () { var r = bnxBsRunAction_({ CLIENT_ID: cid, ROLE: 'ADMIN', USER_ID: 'AFTER_IMPORT' }, { what: 'all' }); return r && r.data ? { bank: r.data.bank && r.data.bank.added, sweep: r.data.sweep && r.data.sweep.txnAdded } : r; });
      if (k.sales || k.bank || k.agg) step('Caches cleared', function () { bnxBustDueCaches_(cid); try { CacheService.getScriptCache().put('banktxn_gen_' + cid, String(Date.now()), 21600); } catch (e) {} return 'DSR / dues / cash / reco'; });
      step('Reports prepared', function () { return bnxWarmReports_(cid, Math.max(30000, 5 * 60000 - (Date.now() - t0) - 20000)); });
    } finally { __bnxReqCid_ = ''; }
    if (k.sales || k.bank || k.agg) try { if (typeof bnxDbFixLog_ === 'function') { var o = BNX_DBFIX.CLIENT_ID; BNX_DBFIX.CLIENT_ID = cid; try { bnxDbFixLog_('AFTER', 'After import', log.join(' · ')); } finally { BNX_DBFIX.CLIENT_ID = o; } } } catch (e) {}
    Logger.log(cid + ' — ' + log.join('\n   '));
  });
  try { if (P.getProperty('BNX_AFTERIMP')) ScriptApp.newTrigger('bnxAfterImportRun_').timeBased().after(60 * 1000).create(); } catch (e) {}
}


/* =====================================================================================================
 * v46 2026-11-26 — SUPER ADMIN: ONE DASHBOARD (Dashboard/admin/super-admin.html)
 * • Open any company's ERP (CL00010, CL00011 …) and come back: works for ROLE SUPER_ADMIN / DEVELOPER and for the
 *   USER_IDs in Script property BNX_SUPER_ADMINS (their own row can stay ADMIN of their home company). The company must
 *   be in CLIENT_DATABASE_REGISTRY and not INACTIVE. Every open / back is written to USER_SECURITY_MASTER_DB › AUDIT_LOG.
 * • Users & access from the same page: role, status, web / app / OTP login, access level, branch, start screen,
 *   department, designation, access expiry, unlock after wrong passwords, new password (the value is never logged
 *   or sent back). New users get their access in the same step.
 * ===================================================================================================== */
function bnxAdmIsSuper_(s) {
  var role = String(s && s.ROLE || '').toUpperCase(); if (role === 'SUPER_ADMIN' || role === 'DEVELOPER') return true;
  try { var L = String(PropertiesService.getScriptProperties().getProperty('BNX_SUPER_ADMINS') || '').split(/[\s,]+/).filter(String);
    return L.indexOf(String(s.USER_ID || '')) >= 0 || L.indexOf(String(s.AUTH_CLIENT_ID || s.CLIENT_ID || '') + ':' + String(s.USER_ID || '')) >= 0; } catch (e) { return false; }
}
function bnxAdmAudit_(s, action, rec, detail) {
  try { var sh = SpreadsheetApp.openById(CLIENT_MASTER_DB_ID).getSheetByName('AUDIT_LOG'); if (!sh) return;
    var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x || '').trim().toUpperCase(); });
    var o = { LOG_ID: 'SA' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10), ACTION: action, TABLE: 'SUPER_ADMIN', RECORD_ID: rec, TIMESTAMP: new Date(),
      USER_ID: String(s.AUTH_CLIENT_ID || s.CLIENT_ID || '') + ':' + String(s.USER_ID || '') + ' ' + String(s.FULL_NAME || ''), CHANGE_DETAIL: String(detail || '').slice(0, 2000), STATUS: 'OK' };
    sh.appendRow(h.map(function (k) { return o[k] === undefined ? '' : o[k]; })); } catch (e) {}
}
function bnxAdmActAs_(s, p) {
  var cid = String(p.clientId || '').trim(), mode = String(p.mode || 'START').toUpperCase();
  if (mode === 'BACK') { bnxAdmAudit_(s, 'ACT_AS_BACK', cid, 'Back to ' + (s.AUTH_CLIENT_ID || s.CLIENT_ID)); return { success: true, data: { back: true } }; }
  if (!/^CL\d{5,}$/.test(cid)) return { success: false, error: 'clientId required' };
  var c = (bnxAdmClients_(s, {}).clients || []).filter(function (x) { return x.CLIENT_ID === cid; })[0];
  if (!c) return { success: false, error: cid + ' is not a registered company' };
  if (!c.DB_READY) return { success: false, error: cid + ' has no databases yet (CLIENT_DATABASE_REGISTRY)' };
  if (c.STATUS === 'INACTIVE') return { success: false, error: cid + ' is INACTIVE — activate it first' };
  bnxAdmAudit_(s, 'ACT_AS_START', cid, 'Opened ERP of ' + c.COMPANY_NAME);
  return { success: true, data: { clientId: cid, name: c.COMPANY_NAME, industry: c.INDUSTRY, city: c.CITY, gstin: c.GST_NO } };
}
/* the session check: a platform owner listed in BNX_SUPER_ADMINS may also open another company */
(function () {
  if (typeof bnxVerifySession !== 'function' || bnxVerifySession.__bnxSa) return;
  var base = bnxVerifySession;
  bnxVerifySession = function (token, clientId) {
    var r = base(token, clientId), want = String(clientId || '').trim();
    if (r || !want) return r;
    var ck = 'sesssa_' + token + '_' + want, cache = CacheService.getScriptCache();
    try { var hit = cache.get(ck); if (hit) { var o = JSON.parse(hit); o.timestamp = Date.now(); return o; } } catch (e) {}
    var own = base(token, ''); if (!own || own.__transient) return own && own.__transient ? own : null;
    if (own.CLIENT_ID === want || !bnxAdmIsSuper_(own)) return null;
    try {
      var reg = typeof bnxGetClientRegistryRow_ === 'function' ? bnxGetClientRegistryRow_(want) : null; if (!reg) return null;
      var st = String(reg.STATUS || 'ACTIVE').toUpperCase(); if (st === 'INACTIVE' || st === 'DELETED') return null;
      var sess = { CLIENT_ID: want, AUTH_CLIENT_ID: own.AUTH_CLIENT_ID || own.CLIENT_ID, USER_ID: own.USER_ID, ROLE: own.ROLE, FULL_NAME: own.FULL_NAME, IS_GLOBAL_ADMIN: true, ACTING_AS: true, DB_IDS: bnxSessionDbIds_(want), timestamp: Date.now() };
      try { cache.put(ck, JSON.stringify(sess), 300); } catch (e) {}
      return sess;
    } catch (e) { return { __transient: true, error: String(e.message || e) }; }
  };
  bnxVerifySession.__bnxSa = true;
})();
/* users: access fields + unlock, audited; new users get their access in the same step */
var BNX_ADM_ACCESS_F = ['WEB_ACCESS', 'APP_ACCESS', 'OTP_ACCESS', 'ACCESS_LEVEL', 'BRANCH', 'DEFAULT_DASHBOARD', 'DEPARTMENT', 'DESIGNATION', 'EXPIRY_DATE', 'LOGIN_TYPE', 'INDUSTRY'];
(function () {
  if (typeof bnxAdmUserUpdate_ !== 'function' || bnxAdmUserUpdate_.__bnxSa) return;
  var base = bnxAdmUserUpdate_;
  bnxAdmUserUpdate_ = function (session, p) {
    p = p || {}; var r = base(session, p); if (!r || r.success === false) return r;
    var uid = String(p.USER_ID || p.userId || '').trim(), cid = String(p.CLIENT_ID || '').trim(), extra = {}, n = 0;
    BNX_ADM_ACCESS_F.forEach(function (k) { if (p[k] !== undefined && p[k] !== null) extra[k] = String(p[k]).trim(); });
    if (p.UNLOCK) { extra.ACCOUNT_LOCKED = 'NO'; extra.FAILED_ATTEMPTS = 0; }
    if (Object.keys(extra).length) {
      var lock = LockService.getScriptLock(); lock.waitLock(20000);
      try { var t = bnxAdmTable_(bnxAdmSheet_('USER_MASTER')), rows = bnxAdmFindUser_(t, uid, cid);
        rows.forEach(function (row) { Object.keys(extra).forEach(function (k) { var c = t.c(k); if (c < 0) return; var v = extra[k];
          if (/ACCESS$|ACCOUNT_LOCKED/.test(k)) v = /^(YES|Y|TRUE|1|ON)$/i.test(String(v)) ? 'YES' : 'NO';
          else if (k !== 'EXPIRY_DATE' && k !== 'DEPARTMENT' && k !== 'DESIGNATION') v = String(v).toUpperCase();
          t.sh.getRange(row + 1, c + 1).setValue(v); n++; }); });
        if (extra.WEB_ACCESS === 'NO' && extra.APP_ACCESS === 'NO') rows.forEach(function (row) { bnxAdmCloseLogin_(t, row); });
      } finally { lock.releaseLock(); }
    }
    var shown = {}; Object.keys(p).forEach(function (k) { if (!BNX_ADM_SECRET.test(k) && !/^(action|sessionToken|clientId)$/.test(k)) shown[k] = p[k]; });
    bnxAdmAudit_(session, 'USER_UPDATE', cid + ':' + uid, JSON.stringify(shown) + (p.PASSWORD ? ' · password changed' : ''));
    if (r.data) r.data.accessFields = n;
    return r;
  };
  bnxAdmUserUpdate_.__bnxSa = true;
  if (typeof bnxAdmUserCreate_ === 'function') {
    var cr = bnxAdmUserCreate_;
    bnxAdmUserCreate_ = function (session, p) {
      p = p || {}; var r = cr(session, p); if (!r || r.success === false) return r;
      var uid = r.data && r.data.userId, acc = { USER_ID: uid, CLIENT_ID: p.CLIENT_ID };
      BNX_ADM_ACCESS_F.forEach(function (k) { if (p[k] !== undefined && p[k] !== '') acc[k] = p[k]; });
      if (uid && Object.keys(acc).length > 2) { try { bnxAdmUserUpdate_(session, acc); } catch (e) {} }
      bnxAdmAudit_(session, 'USER_CREATE', String(p.CLIENT_ID || '') + ':' + uid, (p.FULL_NAME || '') + ' · ' + (p.ROLE || '') + ' · code ' + (p.USER_CODE || ''));
      return r;
    };
  }
})();


/* =====================================================================================================
 * v46 2026-11-26 — FOOD COST / LOCATION STOCK OPEN AT ONCE ("delay … check")
 * Why it was slow: every Food Cost / Location-wise stock open after a new bill or an import rebuilt the whole year
 * (BILL_MASTER + BILL_ITEMS read 2–3 times: food, bar, bar register) → 1–2 min, Location-wise over 120 s.
 *  1. One read per request: BILL_MASTER / BILL_ITEMS columns are read once per server run and shared by food, bar and
 *     bar register (bnxFcCols_ memo, 2 min) — a cold build is ~40 % faster.
 *  2. Warm-up: the server remembers the last periods each client opened (Food cost incl. its months, Location-wise
 *     stock) and builds them again in the background — after every import (After import → "Reports prepared") and
 *     every 30 min (RUN_WARM_TriggerOn). Opening the page then reads the ready copy (1–3 s).
 *  RUN_WARM_Now builds them by hand · RUN_WARM_TriggerOn / Off.
 * ===================================================================================================== */
var __bnxColsMemo = {};
(function () {
  if (typeof bnxFcCols_ !== 'function' || bnxFcCols_.__memo) return;
  var base = bnxFcCols_;
  bnxFcCols_ = function (sheet, names) {
    var nm = ''; try { nm = sheet ? sheet.getName() : ''; } catch (e) {}
    if (!/^(BILL_MASTER|BILL_ITEMS|STOCK_MOVEMENT)$/.test(nm)) return base(sheet, names);
    var k = ''; try { k = sheet.getParent().getId() + '|' + nm + '|' + names.join(','); } catch (e) { return base(sheet, names); }
    var m = __bnxColsMemo[k]; if (m && Date.now() - m.t < 120000) return m.v;
    var v = base(sheet, names); __bnxColsMemo[k] = { t: Date.now(), v: v }; return v;
  };
  bnxFcCols_.__memo = true;
})();
function bnxWarmNote_(cid, action, p) {
  try { var P = PropertiesService.getScriptProperties(), k = 'BNX_WARM_' + cid, q = []; try { q = JSON.parse(P.getProperty(k) || '[]') || []; } catch (e) {}
    var sig = action + '|' + JSON.stringify(p); q = q.filter(function (x) { return x.a + '|' + JSON.stringify(x.p) !== sig; });
    q.unshift({ a: action, p: p, t: Date.now() }); q = q.filter(function (x) { return Date.now() - x.t < 7 * 864e5; }).slice(0, 6);
    P.setProperty(k, JSON.stringify(q)); } catch (e) {}
}
function bnxWarmSoon_(cid) {
  var P = PropertiesService.getScriptProperties(), q = {}; try { q = JSON.parse(P.getProperty('BNX_AFTERIMP') || '{}') || {}; } catch (e) {}
  q[cid] = q[cid] || {}; q[cid].warm = Date.now(); P.setProperty('BNX_AFTERIMP', JSON.stringify(q));
  if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'bnxAfterImportRun_'; })) ScriptApp.newTrigger('bnxAfterImportRun_').timeBased().after(20 * 1000).create();
}
/* build the remembered reports of one client; budget in ms */
function bnxWarmReports_(cid, budget) {
  var t0 = Date.now(), done = [], q = []; budget = budget || 240000;
  try { q = JSON.parse(PropertiesService.getScriptProperties().getProperty('BNX_WARM_' + cid) || '[]') || []; } catch (e) {}
  var sess = { CLIENT_ID: cid, ROLE: 'ADMIN', USER_ID: 'WARM', DB_IDS: (typeof bnxSessionDbIds_ === 'function' ? bnxSessionDbIds_(cid) : null) };
  var today = Utilities.formatDate(new Date(Date.now() - 6 * 3600 * 1000), 'Asia/Kolkata', 'yyyy-MM-dd');
  var left = function () { return budget - (Date.now() - t0); };
  var prev = __bnxReqCid_; __bnxReqCid_ = cid;
  try {
    var jobs = [];
    q.forEach(function (x) {
      if (x.a === 'FOOD_COST') {
        jobs.push({ a: 'FOOD_COST', p: x.p });
        /* the months of that period (month drill) — the running month first */
        var f = bnxSrDate_(x.p.from) || '', t = bnxSrDate_(x.p.to) || today; if (!f) return;
        var ms = []; for (var d = new Date(t.slice(0, 7) + '-01T12:00:00Z'); d.toISOString().slice(0, 7) >= f.slice(0, 7); d.setUTCMonth(d.getUTCMonth() - 1)) {
          var m = d.toISOString().slice(0, 7), last = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate(), mf = m + '-01', mt = m + '-' + ('0' + last).slice(-2);
          if (mf < f) mf = f; if (mt > t) mt = t; ms.push({ from: mf, to: mt, departments: x.p.departments || [] }); if (ms.length >= 12) break; }
        ms.forEach(function (p) { jobs.push({ a: 'FOOD_COST', p: p, month: true }); });
      } else if (x.a === 'LOCATION_STOCK') jobs.push({ a: 'LOCATION_STOCK', p: x.p });
    });
    /* periods first (what the page opens on), months after */
    jobs.sort(function (a, b) { return (a.month ? 1 : 0) - (b.month ? 1 : 0); });
    var seen = {};
    jobs.forEach(function (j) {
      var sig = j.a + JSON.stringify(j.p); if (seen[sig]) return; seen[sig] = 1;
      if (left() < 70000) { done.push(j.a + ' ' + (j.p.from || '') + '…' + (j.p.to || '') + ': next run'); return; }
      var a = Date.now(), r;
      try {
        if (j.a === 'FOOD_COST') r = bnxFoodCostReport_(sess, { from: j.p.from, to: j.p.to, departments: j.p.departments || [], __warm: true });
        else r = bnxLocationStock_(sess, { from: j.p.from, to: j.p.to, __warm: true });
        done.push((j.a === 'FOOD_COST' ? (j.month ? 'Food cost ' + j.p.from.slice(0, 7) : 'Food cost') : 'Location stock') + (j.month ? '' : ' ' + (j.p.from || '') + '…' + (j.p.to || '')) + ': ' + (r && r.success ? (r.cached ? 'ready' : 'built ' + Math.round((Date.now() - a) / 1000) + ' s') : '⚠ ' + (r && (r.error || r.message))));
      } catch (e) { done.push(j.a + ': ⚠ ' + (e.message || e)); }
    });
  } finally { __bnxReqCid_ = prev; }
  return done.length ? done.join(' · ') : 'nothing opened yet';
}
/* Food cost: remember what is opened (not the item / month drills of a period — those are warmed from the period) */
(function () {
  if (typeof bnxFoodCostReport_ !== 'function' || bnxFoodCostReport_.__warm) return;
  var base = bnxFoodCostReport_;
  bnxFoodCostReport_ = function (session, payload) {
    var p = payload || {};
    if (!p.__warm && !p.item && !p.settings && p.from && p.to) {
      var whole = (function () { var f = bnxSrDate_(p.from) || '', t = bnxSrDate_(p.to) || ''; return !(f.slice(0, 7) === t.slice(0, 7) && f.slice(8) === '01'); })();
      if (whole) bnxWarmNote_(session.CLIENT_ID, 'FOOD_COST', { from: p.from, to: p.to, departments: p.departments || [] });
    }
    return base(session, p);
  };
  bnxFoodCostReport_.__warm = true;
})();
function bnxWarmTick_() {
  var P = PropertiesService.getScriptProperties(), t0 = Date.now(), log = [];
  P.getKeys().filter(function (k) { return /^BNX_WARM_CL\d+$/.test(k); }).forEach(function (k) {
    var cid = k.slice(9), left = 5 * 60000 - (Date.now() - t0) - 20000; if (left < 70000) return;
    try { log.push(cid + ': ' + bnxWarmReports_(cid, left)); } catch (e) { log.push(cid + ': ⚠ ' + (e.message || e)); }
  });
  Logger.log(log.join('\n'));
}
function RUN_WARM_Now() { bnxWarmTick_(); }
function RUN_WARM_TriggerOn() { RUN_WARM_TriggerOff(); ScriptApp.newTrigger('bnxWarmTick_').timeBased().everyMinutes(30).create(); Logger.log('Food cost / location stock warm-up every 30 min — ON'); }
function RUN_WARM_TriggerOff() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bnxWarmTick_') ScriptApp.deleteTrigger(t); }); }


/* =====================================================================================================
 * v46 2026-11-26 — RECONCILIATION FOR EVERY CLIENT (professional set-up)
 *  • Set-up per client (Script property BNX_RECO_CFG_<cid>): payment channels (mode → provider, settles to account,
 *    T+ days, agreed fee %), matching rules (₹ tolerance, ± days, minutes, split payments), bank keyword rules.
 *  • Every bank credit has a TYPE: sales settlement / sales UPI / sales bank / due receipt / Zomato-Swiggy payout /
 *    cash deposit / capital-loan / refund / own transfer / other income / suspense. Only SALES_UPI, SALES_BANK and
 *    DUE_RECEIPT count in the Diff; Sweep settlements are checked in Settlement ↔ Bank; the rest is listed apart.
 *    NEFT that matches a due receipt (same amount, ±3 days) is typed DUE_RECEIPT by itself, other NEFT = SUSPENSE.
 *  • Exceptions per transaction (reason + note + open / resolved), day status RECONCILED → APPROVED (manager / admin),
 *    LOCK up to a date (admin): links, types, exceptions of locked days cannot change; unlock is logged.
 *  Sheets (Transaction DB): RECO_MARK (types + exceptions), RECO_DAY_STATUS. Audit → USER_SECURITY_MASTER_DB › AUDIT_LOG.
 * ===================================================================================================== */
var BNX_RECO_TYPES = { SALES_SETTLEMENT: 'Sales settlement (Sweep / card)', SALES_UPI: 'Sales UPI', SALES_BANK: 'Sales by bank transfer', DUE_RECEIPT: 'Due receipt',
  AGGREGATOR: 'Zomato / Swiggy payout', CASH_DEPOSIT: 'Cash deposit', CAPITAL_LOAN: 'Capital / loan', REFUND: 'Refund / reversal', INTERNAL_TRANSFER: 'Own account transfer',
  OTHER_INCOME: 'Other income', SUSPENSE: 'Suspense — to identify' };
var BNX_RECO_COUNT = { SALES_UPI: 1, SALES_BANK: 1, DUE_RECEIPT: 1 };
var BNX_RECO_EXC = ['Refund', 'Chargeback', 'Tip / service charge', 'Split bill', 'Bill cancelled', 'Duplicate swipe', 'Settlement not received', 'Wrong amount in ERP', 'Wrong mode in ERP', 'Other'];
var BNX_RECO_DEF = { channels: [{ mode: 'CARD', provider: 'ICICI Sweep', account: '', lag: 1, fee: 1.75 }, { mode: 'UPI', provider: 'ICICI Sweep', account: '', lag: 1, fee: 0 }],
  rules: { tol: 1, dayWindow: 1, gapMin: 180, allowSplit: true, round: 50 }, creditRules: [{ kw: 'ZOMATO', type: 'AGGREGATOR' }, { kw: 'SWIGGY', type: 'AGGREGATOR' }, { kw: 'BUNDL', type: 'AGGREGATOR' }],
  feeGst: 18, lockedUpto: '' };
function bnxRecoCfg_(cid) {
  var c = {}; try { c = JSON.parse(PropertiesService.getScriptProperties().getProperty('BNX_RECO_CFG_' + cid) || '{}') || {}; } catch (e) {}
  var d = JSON.parse(JSON.stringify(BNX_RECO_DEF));
  return { channels: Array.isArray(c.channels) && c.channels.length ? c.channels : d.channels, rules: Object.assign(d.rules, c.rules || {}),
    creditRules: Array.isArray(c.creditRules) ? c.creditRules : d.creditRules, feeGst: c.feeGst == null ? d.feeGst : +c.feeGst, lockedUpto: String(c.lockedUpto || ''), lockLog: (c.lockLog || []).slice(-10) };
}
function bnxRecoCfgPut_(cid, c) { PropertiesService.getScriptProperties().setProperty('BNX_RECO_CFG_' + cid, JSON.stringify(c)); }
function bnxRecoCanApprove_(s) { return ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'MANAGER', 'DEVELOPER'].indexOf(String(s && s.ROLE || '').toUpperCase()) >= 0; }
function bnxRecoLocked_(cid, dates) {
  var L = bnxRecoCfg_(cid).lockedUpto; if (!L) return '';
  var bad = (dates || []).filter(function (d) { d = bnxNormalizeDateKey_(d); return d && d <= L; });
  return bad.length ? 'Reconciliation is locked up to ' + L.split('-').reverse().join('-') + ' — an admin must unlock it first' : '';
}
function bnxRecoCfgGet_(s) { if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
  return { success: true, data: { cfg: bnxRecoCfg_(String(s.CLIENT_ID)), types: BNX_RECO_TYPES, exc: BNX_RECO_EXC, isAdmin: bnxBsAdmin_(s) } }; }
function bnxRecoCfgSave_(s, p) {
  if (!bnxBsAdmin_(s)) return { success: false, statusCode: 403, error: 'Admin / Accounts login needed' };
  var cid = String(s.CLIENT_ID), c = bnxRecoCfg_(cid), N = function (v, d) { var x = Number(v); return isFinite(x) ? x : d; };
  if (Array.isArray(p.channels)) c.channels = p.channels.slice(0, 20).map(function (x) { return { mode: String(x.mode || '').toUpperCase().slice(0, 10), provider: String(x.provider || '').slice(0, 60), account: String(x.account || '').slice(0, 40), lag: Math.max(0, Math.min(10, N(x.lag, 1))), fee: Math.max(0, Math.min(10, N(x.fee, 0))) }; }).filter(function (x) { return x.mode; });
  if (p.rules) c.rules = { tol: Math.max(0.01, Math.min(100, N(p.rules.tol, 1))), dayWindow: Math.max(0, Math.min(3, N(p.rules.dayWindow, 1))), gapMin: Math.max(15, Math.min(1440, N(p.rules.gapMin, 180))), allowSplit: p.rules.allowSplit !== false, round: Math.max(0, Math.min(500, N(p.rules.round, 50))) };
  if (Array.isArray(p.creditRules)) c.creditRules = p.creditRules.slice(0, 60).map(function (x) { return { kw: String(x.kw || '').trim().slice(0, 40), type: BNX_RECO_TYPES[x.type] ? x.type : 'SUSPENSE' }; }).filter(function (x) { return x.kw; });
  if (p.feeGst != null) c.feeGst = Math.max(0, Math.min(28, N(p.feeGst, 18)));
  bnxRecoCfgPut_(cid, c); try { bnxAdmAudit_(s, 'RECO_SETUP', cid, JSON.stringify({ channels: c.channels, rules: c.rules, creditRules: c.creditRules.length })); } catch (e) {}
  return { success: true, data: { cfg: c } };
}
function bnxRecoSheet_(ss, name, hdr) {
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, hdr.length).setValues([hdr]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
var BNX_RECO_MARK_HDR = ['TXN_KEY', 'KIND', 'VALUE', 'NOTE', 'STATUS', 'BIZ_DATE', 'AMOUNT', 'UPDATED_AT', 'UPDATED_BY'];
var BNX_RECO_DAY_HDR = ['BIZ_DATE', 'STATUS', 'DIFF', 'NOTE', 'UPDATED_AT', 'UPDATED_BY'];
function bnxRecoMarks_(ss) {
  var o = { type: {}, exc: {}, day: {} };
  try { var sh = ss.getSheetByName('RECO_MARK'); if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, BNX_RECO_MARK_HDR.length).getValues().forEach(function (r) {
      var k = String(r[0]), kind = String(r[1]); if (!k) return;
      if (kind === 'TYPE') o.type[k] = { v: String(r[2] || ''), note: String(r[3] || '') };
      else if (kind === 'EXC' && String(r[2] || '')) o.exc[k] = { reason: String(r[2]), note: String(r[3] || ''), status: String(r[4] || 'OPEN'), d: bnxNormalizeDateKey_(r[5]), amt: +r[6] || 0, at: String(r[7] || ''), by: String(r[8] || '') }; }); } catch (e) {}
  try { var sd = ss.getSheetByName('RECO_DAY_STATUS'); if (sd && sd.getLastRow() > 1) sd.getRange(2, 1, sd.getLastRow() - 1, BNX_RECO_DAY_HDR.length).getValues().forEach(function (r) {
      var d = bnxNormalizeDateKey_(r[0]); if (d) o.day[d] = { status: String(r[1] || ''), diff: +r[2] || 0, note: String(r[3] || ''), at: String(r[4] || ''), by: String(r[5] || '') }; }); } catch (e) {}
  return o;
}
/* types (kind 'type') or exceptions (kind 'exc'): items [{key, d, amount, type | reason, note, status}] */
function bnxRecoMarkSave_(s, p, kind) {
  if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
  var cid = String(s.CLIENT_ID || ''), items = Array.isArray(p.items) ? p.items.slice(0, 500) : [];
  if (!items.length) return { success: false, error: 'Nothing to save' };
  var lk = bnxRecoLocked_(cid, items.map(function (x) { return x.d; })); if (lk) return { success: false, error: lk };
  var lock = bnxTenantLock_(); if (!lock.tryLock(20000)) return { success: false, retryable: true, error: 'Busy — retry' };
  try {
    var ss = bnxPqDb_(cid, 'TRANSACTION'), sh = bnxRecoSheet_(ss, 'RECO_MARK', BNX_RECO_MARK_HDR), K = kind === 'type' ? 'TYPE' : 'EXC', at = {}, n = sh.getLastRow(), now = new Date().toISOString(), add = [];
    if (n > 1) sh.getRange(2, 1, n - 1, 2).getValues().forEach(function (r, i) { at[String(r[0]) + '|' + String(r[1])] = i + 2; });
    items.forEach(function (x) {
      var key = String(x.key || '').slice(0, 140); if (!/^(SW|BK|PY|DR):/.test(key)) return;
      var v = kind === 'type' ? (BNX_RECO_TYPES[x.type] ? x.type : '') : (x.reason ? String(x.reason).slice(0, 60) : '');
      var row = [key, K, v, String(x.note || '').slice(0, 300), kind === 'exc' ? (/RESOLVED/i.test(String(x.status)) ? 'RESOLVED' : 'OPEN') : '', String(x.d || ''), +x.amount || 0, now, String(s.USER_ID || '')];
      var k2 = key + '|' + K; if (at[k2] > 0) sh.getRange(at[k2], 1, 1, row.length).setValues([row]); else { add.push(row); at[k2] = -1; }
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, BNX_RECO_MARK_HDR.length).setValues(add);
    return { success: true, data: { saved: items.length } };
  } finally { lock.releaseLock(); }
}
/* day status: RECONCILED (anyone with reco access) · APPROVED (manager / admin) · OPEN (re-open: approver) */
function bnxRecoDaySet_(s, p) {
  if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
  var cid = String(s.CLIENT_ID || ''), st = String(p.status || '').toUpperCase(), dates = (p.dates || []).map(bnxNormalizeDateKey_).filter(String).slice(0, 62);
  if (!/^(RECONCILED|APPROVED|OPEN)$/.test(st) || !dates.length) return { success: false, error: 'status and dates needed' };
  if ((st === 'APPROVED' || st === 'OPEN') && !bnxRecoCanApprove_(s)) return { success: false, statusCode: 403, error: 'Only a manager / admin can approve or re-open a day' };
  var lk = bnxRecoLocked_(cid, dates); if (lk) return { success: false, error: lk };
  var lock = bnxTenantLock_(); if (!lock.tryLock(20000)) return { success: false, retryable: true, error: 'Busy — retry' };
  try {
    var ss = bnxPqDb_(cid, 'TRANSACTION'), sh = bnxRecoSheet_(ss, 'RECO_DAY_STATUS', BNX_RECO_DAY_HDR), at = {}, n = sh.getLastRow(), now = new Date().toISOString(), diffs = p.diffs || {};
    if (n > 1) sh.getRange(2, 1, n - 1, 1).getValues().forEach(function (r, i) { var d = bnxNormalizeDateKey_(r[0]); if (d) at[d] = i + 2; });
    dates.forEach(function (d) { var row = [d, st, +diffs[d] || 0, String(p.note || '').slice(0, 300), now, String(s.USER_ID || '') + ' ' + String(s.FULL_NAME || '')];
      if (at[d]) sh.getRange(at[d], 1, 1, row.length).setValues([row]); else { sh.appendRow(row); at[d] = sh.getLastRow(); } });
    try { bnxAdmAudit_(s, 'RECO_DAY_' + st, cid, dates.join(', ') + (p.note ? ' · ' + p.note : '')); } catch (e) {}
    return { success: true, data: { saved: dates.length } };
  } finally { lock.releaseLock(); }
}
/* lock up to a date (admin); upto '' = unlock everything. Every change is logged. */
function bnxRecoLock_(s, p) {
  if (!bnxBsAdmin_(s)) return { success: false, statusCode: 403, error: 'Only an admin can lock / unlock' };
  var cid = String(s.CLIENT_ID), c = bnxRecoCfg_(cid), up = p.upto ? bnxNormalizeDateKey_(p.upto) : '';
  if (p.upto && !up) return { success: false, error: 'date?' };
  var was = c.lockedUpto; c.lockedUpto = up; c.lockLog = (c.lockLog || []).concat([{ from: was, to: up, by: String(s.USER_ID || '') + ' ' + String(s.FULL_NAME || ''), at: new Date().toISOString(), note: String(p.note || '').slice(0, 200) }]).slice(-10);
  bnxRecoCfgPut_(cid, c); try { bnxAdmAudit_(s, up && (!was || up > was) ? 'RECO_LOCK' : 'RECO_UNLOCK', cid, (was || '—') + ' → ' + (up || 'unlocked') + (p.note ? ' · ' + p.note : '')); } catch (e) {}
  return { success: true, data: { lockedUpto: up } };
}


/* =====================================================================================================
 * v46 2026-11-26 — SWEEP / COLLECTION RECO OPENS FAST ("page not move, slow")
 *  • BILL_MASTER / PAYMENT_MASTER: only the 7–10 columns used are read (was the whole sheet).
 *  • The answer of a period is kept 10 min (a closed period 6 h); any link / type / exception / day-status save,
 *    bank / Sweep sync or import changes the key, so nothing stale is shown. Refresh (force) always reads fresh.
 * ===================================================================================================== */
function bnxBsCols_(sh, names) {
  if (!sh) return [names.slice()];
  var last = sh.getLastRow(), w = sh.getLastColumn(); if (last < 1 || !w) return [names.slice()];
  var h = sh.getRange(1, 1, 1, w).getValues()[0].map(function (x) { return String(x || '').trim(); });
  var cols = names.map(function (n) { var i = h.indexOf(n); return i < 0 || last < 2 ? null : sh.getRange(2, i + 1, last - 1, 1).getValues(); });
  var out = [names.slice()];
  for (var r = 0; r < last - 1; r++) { var row = new Array(names.length); for (var c = 0; c < names.length; c++) row[c] = cols[c] ? cols[c][r][0] : ''; out.push(row); }
  /* columns missing in the sheet keep their name so indexOf works; values are '' */
  return out;
}
function bnxRecoBump_(cid) { try { CacheService.getScriptCache().put('recogen_' + cid, String(Date.now()), 21600); } catch (e) {} }
(function () {
  if (typeof bnxCollReco_ !== 'function' || bnxCollReco_.__cache) return;
  var base = bnxCollReco_;
  bnxCollReco_ = function (s, p) {
    p = p || {}; if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
    var cid = String(s && s.CLIENT_ID || ''), c = CacheService.getScriptCache();
    var g = function (k) { try { return c.get(k + cid) || '0'; } catch (e) { return '0'; } };
    var today = Utilities.formatDate(new Date(Date.now() - 6 * 3600 * 1000), 'Asia/Kolkata', 'yyyy-MM-dd'), to = bnxNormalizeDateKey_(p.to) || '';
    var ck = 'collreco46_' + cid + '_' + String(s.LOCATION_ID || '') + '_' + (bnxNormalizeDateKey_(p.from) || '') + '_' + to + '_' + [g('recogen_'), g('banktxn_gen_'), g('livegen_').slice(0, 13), to >= today ? g('billgen_').slice(0, 13) : ''].join('.');
    if (!p.force && !p.refresh) { try { var h = bnxBigCacheGet_(ck); if (h) { var o = JSON.parse(h); o.data.cached = true; return o; } } catch (e) {} }
    var r = base(s, p);
    if (r && r.success && r.data) { try { bnxBigCachePut_(ck, JSON.stringify(r), to && to < today ? 21600 : 600); } catch (e) {} }
    return r;
  };
  bnxCollReco_.__cache = true;
  var bump = function (f) { if (typeof f !== 'function' || f.__bump) return f; var w = function (s) { var r = f.apply(this, arguments); try { if (r && r.success !== false) bnxRecoBump_(String(s && s.CLIENT_ID || '')); } catch (e) {} return r; }; w.__bump = true; return w; };
  bnxCollLinkSave_ = bump(bnxCollLinkSave_); bnxRecoMarkSave_ = bump(bnxRecoMarkSave_); bnxRecoDaySet_ = bump(bnxRecoDaySet_); bnxRecoLock_ = bump(bnxRecoLock_); bnxRecoCfgSave_ = bump(bnxRecoCfgSave_); bnxBsRunAction_ = bump(bnxBsRunAction_);
})();

/* 26-11: a Collection Date cell → yyyy-MM-dd. Written by the old sync as IST midnight (shows one day early in a
   Los Angeles DB) or by the new sync as noon in the DB time zone — both read as the date that was meant. */
function bnxBsCd_(v, dbTz) {
  if (v instanceof Date && !isNaN(v)) {
    if (Utilities.formatDate(v, 'Asia/Kolkata', 'HH:mm') === '00:00') return Utilities.formatDate(v, 'Asia/Kolkata', 'yyyy-MM-dd');
    return Utilities.formatDate(v, dbTz || 'Asia/Kolkata', 'yyyy-MM-dd');
  }
  return bnxBsDt_(v, dbTz || 'Asia/Kolkata').d;
}


/* =====================================================================================================
 * v46 2026-11-26 — FROM THE RECONCILIATION: RECORD A DUE RECEIVED / A GUEST ADVANCE FOR A SWIPE WITH NO BILL
 *  RECO_DUE_CUSTOMERS            → customers with an outstanding (id, name, phone, outstanding), kept 10 min
 *  RECO_DUE_RECEIVE {key, d, customerId, amount, mode, reference, note}
 *       → core SAVE_DUES_RECEIPT (DUES_RECEIPT row + CUSTOMER_DUES balance) and the Sweep / bank line is linked to it.
 *  RECO_ADVANCE {op: ADD | LIST | ADJUST | REFUND | CANCEL}
 *       ADD {key, d, guest, phone, amount, mode, purpose, reference} → Transaction DB › GUEST_ADVANCE (+ link)
 *       ADJUST {id, billNo, amount} / REFUND {id, amount, note} / CANCEL {id} — open balance is tracked per advance.
 *  Note (CL00010): guest dues follow the FY "Dues" sheet (sync) — a due received here must also be in that sheet,
 *  otherwise the next sync puts the old outstanding back (the receipt itself stays).
 * ===================================================================================================== */
var BNX_ADV_HDR = ['ADV_ID', 'CLIENT_ID', 'DATE', 'GUEST_NAME', 'PHONE', 'AMOUNT', 'MODE', 'REFERENCE', 'PURPOSE', 'TXN_KEY', 'STATUS', 'ADJUSTED', 'REFUNDED', 'BALANCE', 'ADJUST_LOG', 'NOTE', 'CREATED_AT', 'CREATED_BY', 'UPDATED_AT'];
function bnxRecoDueCust_(s) {
  if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
  var cid = String(s.CLIENT_ID), ck = 'recodc_' + cid + '_' + ((CacheService.getScriptCache().get('livegen_' + cid) || '0').slice(0, 13));
  try { var h = bnxBigCacheGet_(ck); if (h) return JSON.parse(h); } catch (e) {}
  var r = bnxGetDueCollection(s, {}); if (!r || !r.success) return r || { success: false, error: 'dues not available' };
  var L = ((r.data && (r.data.customers || r.data.rows)) || []).map(function (c) { return { id: c.customerId, name: c.customer, phone: c.phone || '', out: Math.round((+c.outstanding || 0) * 100) / 100 }; })
    .filter(function (c) { return c.id; }).sort(function (a, b) { return b.out - a.out; });
  var o = { success: true, data: { customers: L } }; try { bnxBigCachePut_(ck, JSON.stringify(o), 600); } catch (e) {}
  return o;
}
function bnxRecoDueReceive_(s, p) {
  if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
  var cid = String(s.CLIENT_ID), d = bnxNormalizeDateKey_(p.d), amt = Math.round((+p.amount || 0) * 100) / 100;
  if (!p.customerId || !(amt > 0) || !d) return { success: false, error: 'Customer, amount and date are needed' };
  var lk = bnxRecoLocked_(cid, [d]); if (lk) return { success: false, error: lk };
  var mode = String(p.mode || 'UPI').toUpperCase();
  var r = bnxSaveDuesReceipt(s, { customerId: p.customerId, amount: amt, paymentMode: mode, reference: String(p.reference || '').slice(0, 80), receiptDate: d, note: p.note || '' });
  if (!r || !r.success) return r || { success: false, error: 'not saved' };
  if (p.key) bnxCollLinkSave_(s, { links: [{ key: p.key, billId: 'DR:' + r.receiptId, billNo: r.receiptId, amount: amt, mode: mode, d: d }] });
  try { bnxBustDueCaches_(cid); } catch (e) {} try { bnxRecoBump_(cid); } catch (e) {}
  try { bnxAdmAudit_(s, 'DUE_RECEIVED_FROM_RECO', cid + ':' + p.customerId, '₹' + amt + ' ' + mode + ' ' + d + ' ' + (p.key || '')); } catch (e) {}
  return { success: true, data: { receiptId: r.receiptId } };
}
function bnxRecoAdvance_(s, p) {
  if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
  var cid = String(s.CLIENT_ID), op = String(p.op || 'LIST').toUpperCase(), ss = bnxPqDb_(cid, 'TRANSACTION'), sh = bnxRecoSheet_(ss, 'GUEST_ADVANCE', BNX_ADV_HDR);
  var r2 = function (x) { return Math.round((+x || 0) * 100) / 100; }, now = new Date().toISOString(), who = String(s.USER_ID || '') + ' ' + String(s.FULL_NAME || '');
  var read = function () { var n = sh.getLastRow(); return n < 2 ? [] : sh.getRange(2, 1, n - 1, BNX_ADV_HDR.length).getValues().map(function (r, i) { var o = { _row: i + 2 }; BNX_ADV_HDR.forEach(function (k, j) { o[k] = r[j]; }); o.DATE = bnxNormalizeDateKey_(o.DATE); return o; }); };
  var out = function (o) { return { id: o.ADV_ID, date: o.DATE, guest: o.GUEST_NAME, phone: o.PHONE, amount: r2(o.AMOUNT), mode: o.MODE, reference: o.REFERENCE, purpose: o.PURPOSE, key: o.TXN_KEY, status: o.STATUS, adjusted: r2(o.ADJUSTED), refunded: r2(o.REFUNDED), balance: r2(o.BALANCE), log: String(o.ADJUST_LOG || ''), note: o.NOTE, by: o.CREATED_BY }; };
  if (op === 'LIST') return { success: true, data: { advances: read().filter(function (o) { return o.ADV_ID && (p.all || !/CANCEL/i.test(String(o.STATUS))); }).map(out).reverse() } };
  var lock = bnxTenantLock_(); if (!lock.tryLock(20000)) return { success: false, retryable: true, error: 'Busy — retry' };
  try {
    if (op === 'ADD') {
      var d = bnxNormalizeDateKey_(p.d), amt = r2(p.amount); if (!d || !(amt > 0) || !String(p.guest || '').trim()) return { success: false, error: 'Guest, amount and date are needed' };
      var lk = bnxRecoLocked_(cid, [d]); if (lk) return { success: false, error: lk };
      var id = 'ADV' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMddHHmmss');
      var o = { ADV_ID: id, CLIENT_ID: cid, DATE: d, GUEST_NAME: String(p.guest).trim().slice(0, 80), PHONE: String(p.phone || '').slice(0, 20), AMOUNT: amt, MODE: String(p.mode || 'UPI').toUpperCase(), REFERENCE: String(p.reference || '').slice(0, 80),
        PURPOSE: String(p.purpose || '').slice(0, 120), TXN_KEY: String(p.key || ''), STATUS: 'OPEN', ADJUSTED: 0, REFUNDED: 0, BALANCE: amt, ADJUST_LOG: '', NOTE: String(p.note || '').slice(0, 200), CREATED_AT: now, CREATED_BY: who, UPDATED_AT: now };
      sh.appendRow(BNX_ADV_HDR.map(function (k) { return o[k]; }));
      if (p.key) { lock.releaseLock(); lock = null; bnxCollLinkSave_(s, { links: [{ key: p.key, billId: 'ADV:' + id, billNo: id, amount: amt, mode: o.MODE, d: d }] }); }
      try { bnxRecoBump_(cid); } catch (e) {}
      return { success: true, data: { advance: out(o) } };
    }
    var A = read().filter(function (x) { return x.ADV_ID === p.id; })[0]; if (!A) return { success: false, error: 'Advance not found' };
    var bal = r2(A.BALANCE), set = function (k, v) { sh.getRange(A._row, BNX_ADV_HDR.indexOf(k) + 1).setValue(v); A[k] = v; };
    if (op === 'ADJUST' || op === 'REFUND') {
      var a2 = r2(p.amount); if (!(a2 > 0) || a2 > bal + 0.01) return { success: false, error: 'Amount must be between 0 and the open balance ₹' + bal };
      if (op === 'ADJUST' && !String(p.billNo || '').trim()) return { success: false, error: 'Bill number needed' };
      set(op === 'ADJUST' ? 'ADJUSTED' : 'REFUNDED', r2((+A[op === 'ADJUST' ? 'ADJUSTED' : 'REFUNDED'] || 0) + a2)); set('BALANCE', r2(bal - a2));
      set('ADJUST_LOG', String(A.ADJUST_LOG || '') + (A.ADJUST_LOG ? ' | ' : '') + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MM-yyyy') + ' ' + (op === 'ADJUST' ? 'bill ' + p.billNo : 'refund') + ' ₹' + a2 + (p.note ? ' (' + String(p.note).slice(0, 60) + ')' : ''));
      set('STATUS', r2(bal - a2) <= 0.01 ? (op === 'ADJUST' ? 'ADJUSTED' : 'REFUNDED') : 'PART'); set('UPDATED_AT', now);
    } else if (op === 'CANCEL') { if (r2(A.ADJUSTED) || r2(A.REFUNDED)) return { success: false, error: 'Already adjusted / refunded — cannot cancel' }; set('STATUS', 'CANCELLED'); set('BALANCE', 0); set('UPDATED_AT', now); }
    else return { success: false, error: 'op?' };
    try { bnxRecoBump_(cid); } catch (e) {}
    try { bnxAdmAudit_(s, 'GUEST_ADVANCE_' + op, cid + ':' + A.ADV_ID, JSON.stringify({ amount: p.amount, bill: p.billNo || '', note: p.note || '' })); } catch (e) {}
    return { success: true, data: { advance: out(A) } };
  } finally { if (lock) lock.releaseLock(); }
}


/* =====================================================================================================
 * v46.3 2026-11-26 — DEPARTMENTS WHOSE ISSUE IS CONSUMPTION ("some department issue is consumption")
 *  HASHTAG, STAFF KITCHEN, F&B PRODUCTION, BREWPUB, HOUSE KEEPING, BAKERY, HOOKAH, SERVICE, OFFICE … sell nothing through a
 *  recipe, so "issued − used by sales" only piled up (₹20 lakh "stock" in HASHTAG). Each department now has a type:
 *    STOCK    = issued − used by sales (recipes / bar pours) − wastage  (default: the main kitchen and the bar)
 *    CONSUMED = what is issued is consumed (expense) → no stock; the period's issues show as consumption
 *  Set per client from Location-wise stock › ⚙ Department types (LOCATION_DEPT_CFG); kept in Script property BNX_LOCDEPT_<cid>.
 * ===================================================================================================== */
function bnxLocDeptCfg_(cid) { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('BNX_LOCDEPT_' + cid) || '{}') || {}; } catch (e) { return {}; } }
function bnxLocDeptMode_(DM, id, d) { var m = (DM.modes || {})[id]; if (m === 'STOCK' || m === 'CONSUMED' || /^MAP:/.test(m || '')) return m; return id === d.kitchen || id === d.bar ? 'STOCK' : 'CONSUMED'; }
/* "MAP:<dept>": this department is part of another one (HASHTAG → BAR, F&B PRODUCTION → MAIN KITCHEN …) — its issues,
   use and stock are added to that department, item by item; the merged department is not shown on its own. */
function bnxLocDeptMergeInto_(list, DM, d) {
  var byId = {}; list.forEach(function (L) { byId[L.id] = L; });
  var r3 = function (n) { return Math.round((+n || 0) * 1000) / 1000; }, r2 = function (n) { return Math.round((+n || 0) * 100) / 100; };
  list.forEach(function (L) {
    var m = bnxLocDeptMode_(DM, L.id, d); if (!/^MAP:/.test(m)) return; var T = byId[m.slice(4)]; if (!T || T === L || /^MAP:/.test(bnxLocDeptMode_(DM, T.id, d))) return;
    var rows = {}; T.rows.forEach(function (r) { rows[r.code] = r; });
    L.rows.forEach(function (r) { var x = rows[r.code];
      if (!x) { x = rows[r.code] = Object.assign({}, r); T.rows.push(x); } else ['open', 'recv', 'used', 'waste', 'bal'].forEach(function (k) { x[k] = r3((+x[k] || 0) + (+r[k] || 0)); });
      x.value = r2((+x.bal || 0) * (+x.rate || 0)); x.usedBy = [x.usedBy, r.usedBy].filter(String).join(', ').slice(0, 120); });
    T.merged = (T.merged || []).concat([L.name]); L.__gone = true;
  });
  return list.filter(function (L) { return !L.__gone; }).map(function (L) { if (L.merged) { var v = 0; L.rows.forEach(function (r) { v += +r.value || 0; }); L.value = r2(v); L.items = L.rows.length; L.neg = L.rows.filter(function (r) { return r.bal < -0.0005; }).length; } return L; });
}
function bnxLocDeptApply_(depts, C, d, DM) {
  var r2 = function (n) { return Math.round((+n || 0) * 100) / 100; }, per = {};
  d.deptAll = depts.map(function (L) { return { id: L.id, name: L.name, mode: bnxLocDeptMode_(DM, L.id, d) }; });
  depts = bnxLocDeptMergeInto_(depts, DM, d);
  if (C && C.data) C = { data: { locations: bnxLocDeptMergeInto_(JSON.parse(JSON.stringify((C.data.locations || []).filter(function (l) { return l.type === 'DEPT'; }))), DM, d) } };
  ((C && C.data && C.data.locations) || []).forEach(function (l) { if (l.type === 'DEPT') per[l.id] = l; });
  return depts.map(function (L) {
    var mode = bnxLocDeptMode_(DM, L.id, d); L.mode = mode; if (mode === 'STOCK') return L;
    var P = per[L.id], cons = 0, rows = ((P && P.rows) || []).filter(function (r) { return r.recv; }).map(function (r) { var v = r2(r.recv * (r.rate || 0)); cons += v;
      return { code: r.code, name: r.name, cat: r.cat, uom: r.uom, rate: r.rate, open: 0, recv: r.recv, used: r.recv, waste: 0, bal: 0, value: 0, consumed: v, usedBy: 'consumed on issue' }; });
    return { id: L.id, name: L.name, type: 'DEPT', mode: 'CONSUMED', asOf: L.asOf, items: rows.length, value: 0, consumed: r2(cons), neg: 0, rows: rows, merged: L.merged };
  }).sort(function (a, b) { return (a.mode === b.mode ? 0 : a.mode === 'STOCK' ? -1 : 1) || b.value - a.value || (b.consumed || 0) - (a.consumed || 0); });
}
function bnxLocDeptCfgAction_(s, p) {
  var cid = String(s.CLIENT_ID), DM = bnxLocDeptCfg_(cid);
  if (String(p.op || 'GET').toUpperCase() === 'GET') return { success: true, data: { modes: DM.modes || {} } };
  if (!bnxBsAdmin_(s) && String(s.ROLE || '').toUpperCase() !== 'MANAGER' && String(s.ROLE || '').toUpperCase() !== 'STORE_MANAGER') return { success: false, statusCode: 403, error: 'Admin / store manager login needed' };
  var m = {}; Object.keys(p.modes || {}).forEach(function (k) { var v = String(p.modes[k]).toUpperCase(); if (v === 'STOCK' || v === 'CONSUMED' || /^MAP:.{1,60}$/.test(v)) m[String(k).toUpperCase().slice(0, 60)] = v; });
  PropertiesService.getScriptProperties().setProperty('BNX_LOCDEPT_' + cid, JSON.stringify({ modes: m, at: Date.now() }));
  try { bnxAdmAudit_(s, 'LOCATION_DEPT_TYPES', cid, JSON.stringify(m)); } catch (e) {}
  return { success: true, data: { modes: m } };
}


/* =====================================================================================================
 * v46 2026-11-26 — SWIFT TRANSACTION / SETTLEMENT FILE UPLOAD IS SAVED TO THE TRANSACTION DB ("already uploaded … save next")
 *  SWIFT_UPLOAD_SAVE {kind: 'transactions' | 'settlements', header:[…], rows:[[…]]}
 *   • transactions: key = Transaction ID → new IDs are added; an ID already there gets its Transaction Status / Settlement
 *     Date / Settlement Status refreshed (Pending → Settled) — nothing else is touched (Collection Date stays).
 *   • settlements : key = Transaction ID + Settlement Date (RRN when no ID) → new rows added, status refreshed.
 *   • columns are matched by name; a column the tab does not have yet is added at the end. Values are written as text
 *     (no date / RRN conversion by Sheets: 01-11-2026 never becomes 11-Jan, RRNs keep every digit).
 * ===================================================================================================== */
function bnxSwiftUploadSave_(s, p) {
  if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
  var cid = String(s.CLIENT_ID), kind = p.kind === 'settlements' ? 'settlements' : 'transactions';
  if (!p.kind || p.kind === 'auto') kind = (p.header || []).map(bnxBsNorm_).some(function (x) { return x === 'netsettlementamount' || x === 'utrtransactionreferenceno'; }) ? 'settlements' : 'transactions';
  var H = (p.header || []).map(function (h) { return String(h == null ? '' : h).trim(); }), R = Array.isArray(p.rows) ? p.rows : [];
  var hn = H.map(bnxBsNorm_), iId = hn.indexOf('transactionid'); if (iId < 0) return { success: false, error: 'No "Transaction ID" column in this file' };
  var iSd = hn.indexOf('settlementdate'), iRr = hn.indexOf('rrn');
  var lock = bnxTenantLock_(); if (!lock.tryLock(25000)) return { success: false, retryable: true, error: 'Busy — retry' };
  try {
    var ss = bnxPqDb_(cid, 'TRANSACTION'), sh = bnxBsSwiftTab_(ss, kind, true, H);
    var w = sh.getLastColumn(), th = sh.getRange(1, 1, 1, w).getValues()[0].map(function (x) { return String(x || '').trim(); }), tn = th.map(bnxBsNorm_);
    H.forEach(function (h, i) { if (h && tn.indexOf(hn[i]) < 0) { th.push(h); tn.push(hn[i]); sh.getRange(1, th.length).setValue(h); } });
    w = th.length;
    var n = sh.getLastRow(), cur = n > 1 ? sh.getRange(2, 1, n - 1, w).getValues() : [];
    var tId = tn.indexOf('transactionid'), tSd = tn.indexOf('settlementdate'), tRr = tn.indexOf('rrn');
    var keyOf = function (id, sd, rr) { id = String(id || '').trim(); var d = sd ? bnxBsDt_(sd, 'Asia/Kolkata').d : '';
      return kind === 'transactions' ? id : (id ? id : 'R' + String(rr || '').trim()) + '|' + d; };
    var at = {}; cur.forEach(function (r, i) { var k = keyOf(r[tId], tSd >= 0 ? r[tSd] : '', tRr >= 0 ? r[tRr] : ''); if (k && k !== '|') at[k] = i; });
    var upd = kind === 'transactions' ? ['transactionstatus', 'settlementdate', 'settlementstatus'] : ['status', 'utrtransactionreferenceno', 'netsettlementamount'];
    var add = [], updated = 0, same = 0, skipped = 0, touched = {};
    var txt = function (v) { if (v == null) return ''; if (typeof v === 'number') return Math.abs(v) >= 1e9 ? v.toFixed(0) : String(v); return String(v).trim(); };
    R.forEach(function (row) {
      var id = txt(row[iId]); if (!id || id === '-' || /^transaction ?id$/i.test(id)) { skipped++; return; }
      var k = keyOf(id, iSd >= 0 ? row[iSd] : '', iRr >= 0 ? row[iRr] : '');
      if (at[k] != null) {
        var ci = at[k], ch = false;
        upd.forEach(function (u) { var a = hn.indexOf(u), b = tn.indexOf(u); if (a < 0 || b < 0) return; var nv = txt(row[a]), ov = cur[ci][b]; if (!nv || nv === '-') return;
          var same = /date/.test(u) ? (bnxBsDt_(ov, 'Asia/Kolkata').d === bnxBsDt_(nv, 'Asia/Kolkata').d || (ov instanceof Date && bnxBsCd_(ov, ss.getSpreadsheetTimeZone()) === bnxBsDt_(nv, 'Asia/Kolkata').d))
            : /amount/.test(u) ? Math.abs((bnxBsNum_(ov) || 0) - (bnxBsNum_(nv) || 0)) < 0.01 : bnxBsNorm_(ov) === bnxBsNorm_(nv);
          if (!same) { cur[ci][b] = nv; ch = true; } });
        if (ch) { updated++; touched[ci] = 1; } else same++; return;
      }
      var line = tn.map(function (t) { var a = hn.indexOf(t); return a < 0 ? '' : txt(row[a]); });
      at[k] = -1; add.push(line);
    });
    Object.keys(touched).forEach(function (ci) { var r = +ci + 2; upd.forEach(function (u) { var b = tn.indexOf(u); if (b >= 0) sh.getRange(r, b + 1).setNumberFormat('@').setValue(cur[ci][b]); }); });
    if (add.length) { var r0 = sh.getLastRow() + 1, rg = sh.getRange(r0, 1, add.length, w); rg.setNumberFormat('@'); rg.setValues(add); }
    try { bnxRecoBump_(cid); } catch (e) {}
    return { success: true, data: { kind: kind, tab: sh.getName(), added: add.length, updated: updated, alreadyThere: same, skipped: skipped, total: sh.getLastRow() - 1 } };
  } finally { lock.releaseLock(); }
}


/* =====================================================================================================
 * v46 2026-11-26 — OUTSTANDING ₹37,36,738 vs ₹41,31,454 — ROOT CAUSE FOUND IN THE DB
 * CUSTOMER_DUES had 2 rows for 39 customers (an OPEN row with the balance + a CLEARED ₹0 row added 25-11). The dashboard
 * adds every row (₹41,31,454 = FY Dues sheet = CUSTOMER_DUES_BILLWISE), the Customer Credit list keeps ONE row per
 * customer — the last, ₹0 — so ₹3,94,716 (PM SIR MAYFAIR ₹68,220, TARUN BATRA EVENT ₹85,646, ABANTIKA MAM ₹77,134 …)
 * disappeared there. Now every customer has exactly one CUSTOMER_DUES row: balances of the extra rows are added to the
 * kept row (the one with the balance), the extra rows are deleted (a backup tab is made first when run by hand).
 * Runs after every dues sync / import; RUN_DUES_Dedupe does it now (RUN_DUES_DedupeCheck = read only).
 * ===================================================================================================== */
function bnxDuesDedupe_(cid, write, backup) {
  /* Lock: the script lock is shared by every POS save, so a hand run waits in turns (up to ~4 min) instead of failing
     after 30 s. If the caller (dues sync) already holds it, reuse it and do NOT release it here. Data is read INSIDE the lock. */
  var lock = null, mine = false;
  if (write) {
    lock = LockService.getScriptLock();
    if (!lock.hasLock()) { for (var t = 0; t < 8 && !mine; t++) { mine = lock.tryLock(30000); if (!mine) Utilities.sleep(1500); }
      if (!mine) return 'Busy — POS is saving continuously; run again in a minute (nothing changed)'; }
  }
  try {
    var sh = bnxClientSheet(cid, SHEETS.CUSTOMER_DUES || 'CUSTOMER_DUES'), v = sh.getDataRange().getValues(), h = (v[0] || []).map(function (x) { return String(x).trim(); });
    var cI = h.indexOf('CUSTOMER_ID'), bI = h.indexOf('CURRENT_BALANCE'), sI = h.indexOf('STATUS'), uI = h.indexOf('UPDATED_AT'), clI = h.indexOf('CLIENT_ID');
    if (cI < 0 || bI < 0) return 'CUSTOMER_DUES columns missing';
    var g = {}; for (var r = 1; r < v.length; r++) { var id = String(v[r][cI] || '').trim(); if (!id) continue; if (clI >= 0 && v[r][clI] && String(v[r][clI]) !== cid) continue; (g[id] = g[id] || []).push(r); }
    var del = {}, nDel = 0, nFix = 0, moved = 0, now = new Date().toISOString();
    Object.keys(g).forEach(function (id) { var R = g[id]; if (R.length < 2) return;
      var keep = R.slice().sort(function (a, b) { return Math.abs(+v[b][bI] || 0) - Math.abs(+v[a][bI] || 0) || a - b; })[0], tot = 0;
      R.forEach(function (r) { tot += +v[r][bI] || 0; if (r !== keep) { del[r] = 1; nDel++; moved += +v[r][bI] || 0; } });
      tot = Math.round(tot * 100) / 100; nFix++;
      if (write) { v[keep][bI] = tot; if (sI >= 0) v[keep][sI] = tot > 0.5 ? 'OPEN' : 'CLEARED'; if (uI >= 0) v[keep][uI] = now; } });
    if (!nDel) return 'one row per customer ✓';
    var msg = nDel + ' duplicate rows of ' + nFix + ' customers' + (moved ? ' (₹' + Math.round(moved) + ' moved to the kept row)' : '');
    if (!write) return msg + ' — read only';
    if (backup) sh.copyTo(sh.getParent()).setName('CUSTOMER_DUES_BAK_' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMdd_HHmm'));
    /* one batch write: kept rows go back in order, then the now-empty tail rows are removed in one call */
    var out = v.slice(1).filter(function (row, i) { return !del[i + 1]; }), W = v[0].length;
    if (out.length) sh.getRange(2, 1, out.length, W).setValues(out);
    var first = out.length + 2, cnt = v.length - out.length - 1;
    if (cnt > 0) { if (first + cnt - 1 < sh.getMaxRows()) sh.deleteRows(first, cnt); else sh.getRange(first, 1, cnt, W).clearContent(); }
    SpreadsheetApp.flush();
    try { bnxBustDueCaches_(cid); } catch (e) {}
    return msg + ' — fixed';
  } finally { if (mine) lock.releaseLock(); }
}
function RUN_DUES_DedupeCheck() { Logger.log(bnxDuesDedupe_(BNX_DUESYNC.CLIENT_ID, false)); }
function RUN_DUES_Dedupe() { Logger.log(bnxDuesDedupe_(BNX_DUESYNC.CLIENT_ID, true, true)); }

/* =====================================================================================================
 *  2026-11-26 GROUP-WISE COST — "hukka and tobacco cost not shown, all costing check"
 *  Root cause: group cost came only from recipes (RECIPE_MASTER) and the bar store mapping. Hukka / tobacco have no
 *  recipes — their material (hukka masala / flavours, cigarettes …) is issued from the store to the HOOKAH department —
 *  so the group showed cost 0 / coverage 0 %. Now:
 *   1. Store-issue costing: for HUKKA / HOOKAH / SHISHA / TOBACCO groups the cost = value of store issues in the period to
 *      a hookah-type department (HOOKAH, HUKKA, SHISHA, TOBACCO) + any TOBACCO / CIGARETTE category item issued to another
 *      department. The value is shared between these groups (and their menu categories) by sales. costSource = 'store issues'.
 *   2. Every group also gets estCost / estPct: costed cost + the uncosted (lump "POS CATEGORY", packages, items without a
 *      recipe) sales at the group's own cost %, so the total line shows a full-sales cost estimate.
 *   3. uncosted: top 15 uncosted items per group (name, sales) — the to-do list for recipes / store mapping.
 * ===================================================================================================== */
var BNX_GRP_ISSUE_RE = /HUKKA|HOOKAH|HUKA|SHISHA|SHEESHA|TOBACCO|CIGAR/i, BNX_GRP_DEPT_RE = /HOOKAH|HUKKA|HUKA|SHISHA|SHEESHA|TOBACCO/i;
(function () {
  if (typeof bnxFcGroups_ !== 'function' || bnxFcGroups_.__iss) return;
  var base = bnxFcGroups_;
  bnxFcGroups_ = function (cid, db, from, to) {
    var res = base(cid, db, from, to);
    if (!res || res.error || !res.groups) return res;
    var ck = 'fcg5_' + cid + '_' + from + '_' + to + '_' + (typeof bnxFcGen2_ === 'function' ? bnxFcGen2_(cid, to) : ''), cache = CacheService.getScriptCache();
    var big = typeof bnxBigCacheGet_ === 'function';
    try { var hit = big ? bnxBigCacheGet_(ck) : cache.get(ck); if (hit) return JSON.parse(hit); } catch (e) {}
    try { res = bnxFcGroupsPlus_(cid, db, from, to, JSON.parse(JSON.stringify(res))); } catch (e) { res.issueError = String(e && e.message || e); }
    try { var tx = JSON.stringify(res); if (big) bnxBigCachePut_(ck, tx, 600); else if (tx.length < 95000) cache.put(ck, tx, 600); } catch (e) {}
    return res;
  };
  bnxFcGroups_.__iss = true;
})();
var BNX_BREW_CAT_RE = /CRAFT ?BEER|BREW|DRAUGHT|DRAFT ?BEER|MICRO ?BREW/i, BNX_BREW_DEPT_RE = /BREW|MICRO ?BREW/i;
function bnxBrewLitres_(name, size) {
  var t = String(size || '') + ' ' + String(name || ''), m = t.match(/(\d+(?:\.\d+)?)\s*(ML|LTR|LITRE|LITER|L)\b/i);
  if (!m) return 0; var v = Number(m[1]); return /ML/i.test(m[2]) ? v / 1000 : v;
}
function bnxFcGroupsPlus_(cid, db, from, to, res) {
  var N = function (v) { var x = Number(v); return isFinite(x) ? x : 0; }, r2 = function (n) { return Math.round(N(n) * 100) / 100; };
  var rm = {};
  bnxBcTable_(db.MASTER, 'RAW_MATERIAL_MASTER').rows.forEach(function (r) { var k = String(r.ITEM_CODE || r.ITEM_ID || ''); if (k) rm[k] = { cat: String(r.CATEGORY || ''), name: String(r.ITEM_NAME || ''), rate: N(r.COST_PRICE) }; });
  var dept = {};
  try { bnxBcTable_(db.TRANSACTION, 'DEPARTMENT_ISSUE').rows.forEach(function (r) { var v = String(r.DEPARTMENT || '').toUpperCase().trim(); if (r.ISSUE_ID) dept[String(r.ISSUE_ID)] = v; if (r.INDENT_ID && !dept[String(r.INDENT_ID)]) dept[String(r.INDENT_ID)] = v; }); } catch (e) {}
  /* recipe / mapping unit costs (same rules as the base report) */
  var cost = {}, costN = {}, man = {};
  bnxBcTable_(db.MASTER, 'RECIPE_MASTER').rows.forEach(function (r) { if (!r.RECIPE_ID || /INACTIVE/i.test(String(r.STATUS || ''))) return; if (String(r.COST_STATUS || '') === 'MANUAL') { if (r.ITEM_ID) man[String(r.ITEM_ID)] = 1; return; }
    var c = N(r.COST_PER_YIELD); if (c > 0) { if (r.ITEM_ID) cost[String(r.ITEM_ID)] = c; if (r.RECIPE_NAME) costN[bnxBcNorm_(r.RECIPE_NAME)] = c; } });
  try { bnxBcTable_(db.MASTER, 'BAR_STORE_MAPPING').rows.forEach(function (r) { var c = N(r.COST_PER_SERVING), k = String(r.ITEM_ID || ''); if (k && c > 0 && !cost[k]) cost[k] = c; }); } catch (e) {}
  var unitCost = function (iid, nm) { return cost[iid] || costN[bnxBcNorm_(nm)] || 0; };
  /* bill lines of the period (read once) */
  var bm = db.TRANSACTION.getSheetByName('BILL_MASTER'), bi = db.TRANSACTION.getSheetByName('BILL_ITEMS'), bills = {}, lines = [];
  var day = function (sh, v) { return typeof bnxTlDay_ === 'function' ? bnxTlDay_(sh, v) : bnxSrDate_(v); };
  bnxFcCols_(bm, ['BILL_ID', 'BILL_DATE', 'BILL_STATUS']).forEach(function (r) { if (/CANCEL|VOID|DELETE/i.test(String(r.BILL_STATUS || ''))) return; var d = day(bm, r.BILL_DATE); if (d && d >= from && d <= to) bills[String(r.BILL_ID)] = d; });
  bnxFcCols_(bi, ['BILL_ID', 'ITEM_GROUP_NAME', 'ITEM_NAME', 'QUANTITY', 'TAXABLE_PER_ITEM', 'ITEM_ID']).forEach(function (r) { var d = bills[String(r.BILL_ID)]; if (d) { r._d = d; lines.push(r); } });
  /* store issues: hookah / tobacco pool and brewery pool */
  var pool = 0, byDept = {}, byItem = {}, bPool = 0, bMonth = {}, bItem = {}, bDept = {};
  bnxFcCols_(db.TRANSACTION.getSheetByName('STOCK_MOVEMENT'), ['SOURCE_TYPE', 'QUANTITY_OUT', 'QUANTITY_IN', 'MOVEMENT_DATE', 'SOURCE_ID', 'NOTES', 'ITEM_ID', 'RATE', 'REFERENCE_NUMBER']).forEach(function (m) {
    if (!/^DEPARTMENT_ISSUE$/i.test(String(m.SOURCE_TYPE || '')) || !(N(m.QUANTITY_OUT) > 0)) return;
    var d = bnxSrDate_(m.MOVEMENT_DATE); if (!d || d < from || d > to) return;
    var dp = dept[String(m.SOURCE_ID || '')] || dept[String(m.REFERENCE_NUMBER || '')] || ((String(m.NOTES || '').match(/issued to\s+([^·]+)/i) || [])[1] || '').trim().toUpperCase() || 'UNKNOWN';
    var s = rm[String(m.ITEM_ID || '')] || { cat: '', name: String(m.ITEM_ID || ''), rate: 0 };
    var v = N(m.QUANTITY_OUT) * (m.RATE === '' || m.RATE === null ? s.rate : N(m.RATE)); if (!(v > 0)) return;
    if (BNX_BREW_DEPT_RE.test(dp)) { bPool += v; bDept[dp] = (bDept[dp] || 0) + v; var mo = d.slice(0, 7); bMonth[mo] = bMonth[mo] || { month: mo, sales: 0, cost: 0, litres: 0 }; bMonth[mo].cost += v;
      var it = bItem[s.name] = bItem[s.name] || { item: s.name, cat: s.cat, qty: 0, value: 0 }; it.qty += N(m.QUANTITY_OUT); it.value += v; return; }
    if (!BNX_GRP_DEPT_RE.test(dp) && !/TOBACCO|CIGAR/i.test(s.cat + ' ' + s.name)) return;
    pool += v; byDept[dp] = (byDept[dp] || 0) + v; byItem[s.name] = (byItem[s.name] || 0) + v;
  });
  /* BREWERY: craft-beer lines move out of their group (LIQUOR) into their own group, cost = store issues to the brew department */
  var bCat = {}, bSize = {};
  try { bnxBcTable_(db.MASTER, 'BAR_ITEM_MASTER').rows.forEach(function (r) { if (r.ITEM_ID && r.BAR_CATEGORY && !bCat[r.ITEM_ID]) { bCat[String(r.ITEM_ID)] = String(r.BAR_CATEGORY); bSize[String(r.ITEM_ID)] = String(r.SERVING_SIZE || ''); } }); } catch (e) {}
  var isBrew = function (r) { var g = String(r.ITEM_GROUP_NAME || '').toUpperCase(); return !/FOOD|BAKERY/.test(g) && BNX_BREW_CAT_RE.test(bCat[String(r.ITEM_ID || '')] || ''); };
  var brew = { group: 'BREWERY', sales: 0, qty: 0, costed: 0, cost: 0, cats: {}, litres: 0, litSales: 0 }, gIdx = {};
  res.groups.forEach(function (g) { gIdx[g.group] = g; });
  lines.forEach(function (r) {
    if (!isBrew(r)) return; r._brew = 1;
    var iid = String(r.ITEM_ID || ''), nm = String(r.ITEM_NAME || ''), q = N(r.QUANTITY), net = N(r.TAXABLE_PER_ITEM), u = unitCost(iid, nm);
    var g = gIdx[String(r.ITEM_GROUP_NAME || 'OTHERS').toUpperCase().trim() || 'OTHERS'];
    if (g) { g.sales = N(g.sales) - net; g.qty = N(g.qty) - q; if (u > 0) { g.costedSales = N(g.costedSales) - net; g.cost = N(g.cost) - u * q; }
      var cn = bCat[iid]; (g.cats || []).forEach(function (c) { if (c.cat === cn) { c.sales = N(c.sales) - net; c.qty = N(c.qty) - q; if (u > 0) { c.costedSales = N(c.costedSales) - net; c.cost = N(c.cost) - u * q; } c._brewItems = (c._brewItems || {}); c._brewItems[nm] = 1; } }); }
    var brand = nm.replace(/\(?\s*\d+(\.\d+)?\s*(ML|LTR|LITRE|L)\b\)?/ig, '').replace(/[.,]+$/, '').trim().toUpperCase() || nm;
    var c = brew.cats[brand] = brew.cats[brand] || { cat: brand, sales: 0, qty: 0, items: 0, seen: {}, litres: 0 };
    brew.sales += net; brew.qty += q; c.sales += net; c.qty += q; if (!c.seen[nm]) { c.seen[nm] = 1; c.items++; }
    var L = bnxBrewLitres_(nm, bSize[iid]) * q; c.litres += L; brew.litres += L; if (L > 0) brew.litSales += net;
    var mo = r._d.slice(0, 7); bMonth[mo] = bMonth[mo] || { month: mo, sales: 0, cost: 0, litres: 0 }; bMonth[mo].sales += net; bMonth[mo].litres += L;
  });
  if (brew.sales > 0 || bPool > 0) {
    res.groups.forEach(function (g) { g.cats = (g.cats || []).filter(function (c) { return !(c._brewItems && Math.abs(N(c.sales)) < 0.01); }).map(function (c) {
      if (c._brewItems) { c.items = Math.max(0, N(c.items) - Object.keys(c._brewItems).length); delete c._brewItems; }
      c.sales = r2(c.sales); c.qty = r2(c.qty); c.costedSales = r2(c.costedSales); c.cost = r2(c.cost); c.costPct = c.costedSales ? r2(c.cost / c.costedSales * 100) : 0; c.coveragePct = c.sales ? r2(c.costedSales / c.sales * 100) : 0; return c; });
      g.sales = r2(g.sales); g.qty = r2(g.qty); g.costedSales = r2(g.costedSales); g.cost = r2(g.cost); g.costPct = g.costedSales ? r2(g.cost / g.costedSales * 100) : 0; g.coveragePct = g.sales ? r2(g.costedSales / g.sales * 100) : 0; });
    var bg = { group: 'BREWERY', sales: r2(brew.sales), qty: r2(brew.qty), costedSales: bPool > 0 ? r2(brew.sales) : 0, cost: r2(bPool), costPct: bPool > 0 && brew.sales ? r2(bPool / brew.sales * 100) : 0,
      coveragePct: bPool > 0 && brew.sales ? 100 : 0, manualSales: 0, costSource: bPool > 0 ? 'store issues' : 'no brew issues',
      cats: Object.keys(brew.cats).map(function (k) { var c = brew.cats[k], cc = brew.sales ? bPool * c.sales / brew.sales : 0;
        return { cat: c.cat, sales: r2(c.sales), qty: r2(c.qty), items: c.items, litres: r2(c.litres), costedSales: bPool > 0 ? r2(c.sales) : 0, cost: r2(cc), costPct: c.sales && bPool > 0 ? r2(cc / c.sales * 100) : 0, coveragePct: bPool > 0 ? 100 : 0, manualSales: 0, costSource: 'store issues' }; })
        .sort(function (a, b) { return b.sales - a.sales; }) };
    res.groups.push(bg); res.groups.sort(function (a, b) { return b.sales - a.sales; });
    var months = Object.keys(bMonth).sort().map(function (k) { var x = bMonth[k]; return { month: k, sales: r2(x.sales), cost: r2(x.cost), litres: r2(x.litres), costPct: x.sales ? r2(x.cost / x.sales * 100) : 0, gp: r2(x.sales - x.cost) }; });
    res.brewery = { sales: r2(brew.sales), cost: r2(bPool), costPct: brew.sales ? r2(bPool / brew.sales * 100) : 0, gp: r2(brew.sales - bPool), litres: r2(brew.litres), litSales: r2(brew.litSales),
      costPerLitre: brew.litres && brew.litSales ? r2(bPool * (brew.litSales / (brew.sales || 1)) / brew.litres) : 0, salesPerLitre: brew.litres ? r2(brew.litSales / brew.litres) : 0,
      months: months, departments: Object.keys(bDept).map(function (k) { return { dept: k, value: r2(bDept[k]) }; }),
      items: Object.keys(bItem).map(function (k) { var x = bItem[k]; return { item: x.item, cat: x.cat, qty: r2(x.qty), value: r2(x.value) }; }).sort(function (a, b) { return b.value - a.value; }).slice(0, 15) };
  }
  /* HUKKA / TOBACCO: store issues to hookah-type departments + tobacco items, shared by sales */
  var tg = res.groups.filter(function (g) { return BNX_GRP_ISSUE_RE.test(g.group) && g.coveragePct < 50; }), tSales = tg.reduce(function (a, g) { return a + N(g.sales); }, 0);
  if (pool > 0 && tSales > 0) tg.forEach(function (g) {
    var c = pool * N(g.sales) / tSales;
    g.cost = r2(c); g.costedSales = g.sales; g.costPct = g.sales ? r2(c / g.sales * 100) : 0; g.coveragePct = 100; g.costSource = 'store issues';
    (g.cats || []).forEach(function (x) { var cc = N(g.sales) ? c * N(x.sales) / N(g.sales) : 0; x.cost = r2(cc); x.costedSales = x.sales; x.costPct = x.sales ? r2(cc / x.sales * 100) : 0; x.coveragePct = 100; x.costSource = 'store issues'; });
  });
  res.issueCost = { value: r2(pool), departments: Object.keys(byDept).map(function (k) { return { dept: k, value: r2(byDept[k]) }; }).sort(function (a, b) { return b.value - a.value; }),
    items: Object.keys(byItem).map(function (k) { return { item: k, value: r2(byItem[k]) }; }).sort(function (a, b) { return b.value - a.value; }).slice(0, 10), groups: tg.map(function (g) { return g.group; }) };
  /* estimated cost of the whole sales (uncosted part at the group's own cost %) */
  var estT = 0, costT = 0, costedT = 0;
  res.groups.forEach(function (g) {
    var pct = N(g.costedSales) ? N(g.cost) / N(g.costedSales) : 0, unc = Math.max(0, N(g.sales) - N(g.costedSales));
    g.uncostedSales = r2(unc); g.estCost = r2(N(g.cost) + unc * pct); g.estPct = g.sales ? r2(g.estCost / g.sales * 100) : 0; g.costSource = g.costSource || 'recipes / bar mapping';
    (g.cats || []).forEach(function (x) { var p2 = N(x.costedSales) ? N(x.cost) / N(x.costedSales) : pct, u2 = Math.max(0, N(x.sales) - N(x.costedSales)); x.estCost = r2(N(x.cost) + u2 * p2); x.estPct = x.sales ? r2(x.estCost / x.sales * 100) : 0; });
    estT += g.estCost; costT += N(g.cost); costedT += N(g.costedSales);
  });
  res.totals = { sales: r2(res.total), costedSales: r2(costedT), cost: r2(costT), costPct: costedT ? r2(costT / costedT * 100) : 0, coveragePct: res.total ? r2(costedT / res.total * 100) : 0, estCost: r2(estT), estPct: res.total ? r2(estT / res.total * 100) : 0 };
  /* top uncosted items per group */
  var issueG = {}; (res.issueCost.groups || []).forEach(function (g) { issueG[g] = pool > 0; }), U = {};
  lines.forEach(function (r) {
    if (r._brew) return; var iid = String(r.ITEM_ID || ''), nm = String(r.ITEM_NAME || ''), g = String(r.ITEM_GROUP_NAME || 'OTHERS').toUpperCase().trim() || 'OTHERS';
    if (issueG[g] || unitCost(iid, nm) > 0) return;
    var u = (U[g] = U[g] || {}), k = nm.toUpperCase().trim(); u[k] = u[k] || { item: nm, sales: 0, qty: 0, manual: !!man[iid], lump: /POS CATEGORY|^OPEN /i.test(nm) }; u[k].sales += N(r.TAXABLE_PER_ITEM); u[k].qty += N(r.QUANTITY);
  });
  res.groups.forEach(function (g) { var u = U[g.group] || {}; g.uncosted = Object.keys(u).map(function (k) { var x = u[k]; x.sales = r2(x.sales); x.qty = r2(x.qty); return x; }).sort(function (a, b) { return b.sales - a.sales; }).slice(0, 15); });
  /* click a menu category → its items: [name, qty, sales, cost, how] (how: R recipe/mapping · S store issues · M manual · L lump · N no cost) */
  try {
    var gName = {}, cName = {}, im = {}, GI = {};
    bnxBcTable_(db.MASTER, 'ITEM_GROUP_MASTER').rows.forEach(function (r) { gName[r.ITEM_GROUP_ID] = String(r.ITEM_GROUP_NAME || ''); });
    bnxBcTable_(db.MASTER, 'CATEGORY_MASTER').rows.forEach(function (r) { cName[r.CATEGORY_ID] = String(r.CATEGORY_NAME || ''); });
    bnxBcTable_(db.MASTER, 'ITEM_MASTER').rows.forEach(function (r) { if (r.ITEM_ID) im[String(r.ITEM_ID)] = r; });
    res.groups.forEach(function (g) { GI[g.group] = g; });
    var acc = {};
    lines.forEach(function (r) {
      var iid = String(r.ITEM_ID || ''), it = im[iid] || {}, nm = String(r.ITEM_NAME || ''), g, c;
      if (r._brew) { g = 'BREWERY'; c = nm.replace(/\(?\s*\d+(\.\d+)?\s*(ML|LTR|LITRE|L)\b\)?/ig, '').replace(/[.,]+$/, '').trim().toUpperCase() || nm; }
      else { g = String(r.ITEM_GROUP_NAME || gName[it.ITEM_GROUP_ID] || 'OTHERS').toUpperCase().trim() || 'OTHERS';
        c = bCat[iid] || cName[it.MENU_CATEGORY_ID] || String(it.MENU_SECTION || '') || (/POS CATEGORY|OPEN /i.test(nm) ? 'Open / lump sales' : 'Other'); }
      var G = GI[g]; if (!G) return;
      var k = g + '\u0001' + c, a = acc[k] = acc[k] || {}, key = nm.toUpperCase().trim(), x = a[key] = a[key] || { n: nm, q: 0, s: 0, c: 0, h: '' };
      var q = N(r.QUANTITY), net = N(r.TAXABLE_PER_ITEM); x.q += q; x.s += net;
      if (G.costSource === 'store issues') { x.c += G.sales ? net * N(G.cost) / N(G.sales) : 0; x.h = 'S'; }
      else { var u = unitCost(iid, nm); if (u > 0) { x.c += u * q; x.h = 'R'; } else if (!x.h) x.h = man[iid] ? 'M' : /POS CATEGORY|^OPEN /i.test(nm) ? 'L' : 'N'; }
    });
    res.groups.forEach(function (g) { (g.cats || []).forEach(function (c) { var a = acc[g.group + '\u0001' + c.cat] || {};
      var L = Object.keys(a).map(function (k) { var x = a[k]; return [x.n, r2(x.q), r2(x.s), r2(x.c), x.h]; }).sort(function (p, q) { return q[2] - p[2]; });
      c.list = L.slice(0, 80); if (L.length > 80) c.more = L.length - 80; }); });
  } catch (e) { res.listError = String(e && e.message || e); }
  return res;
}
/* one-time: drop cached food-cost reports built before the group-wise store-issue costing */
(function () { try { var P = PropertiesService.getScriptProperties(); if (P.getProperty('BNX_FCG_VER') !== '5') { P.setProperty('BNX_FCG_VER', '5');
  var c = CacheService.getScriptCache(), cids = []; try { cids = Object.keys(P.getProperties()).filter(function (k) { return /^BNX_LOCDEPT_/.test(k); }).map(function (k) { return k.slice(12); }); } catch (e) {}
  ['CL00010', 'CL00011'].concat(cids).forEach(function (id) { try { c.put('rcgen_' + id, String(Date.now()), 21600); } catch (e) {} }); } } catch (e) {} })();


/* =====================================================================================================
 *  2026-11-26 "SWIFT AND SETTLEMENT UPLOAD BUT NOT SHOWN FROM NEXT · BANK SYNC ALSO NOT SHOWN FROM NEXT" — COMPLETE CHECK
 *  Root causes:
 *   1. Swift: the big "Drop Swift Transaction CSV / Excel here" box of the DSR page only loaded the file into the browser
 *      — it never called SWIFT_UPLOAD_SAVE, so nothing after the last FY TransSweep sync (24-11) reached the DB and the
 *      reconciliation (which reads the DB) showed nothing from 25-11. Fixed in dsr-client.html: every Swift file, from
 *      any box, is saved to the DB; transaction / settlement is detected from the columns.
 *   2. Bank: the bank side only comes from the linked bank sheet (Vanns34) / its copy ICICBank — both end 24-09. There was
 *      no way to give the bank statement itself. BANK_UPLOAD_SAVE takes the ICICI statement (xls / xlsx / csv) of any
 *      account: rows go into BANK_TXN_REGISTER with the SAME keys as the sheet sync (Tran Id + date + Cr/Dr + amount —
 *      nothing twice, also not when the sheet later has the same rows) and are copied into the account's mirror tab.
 *   3. RECO_DATA_STATUS: up to which date every source has data (Swift txn, Swift settlement, bank per account, ERP bills)
 *      — shown on the reconciliation page, so a gap is visible at once instead of a silent "no data".
 * ===================================================================================================== */
function bnxBankUploadSave_(s, p) {
  if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
  var cid = String(s.CLIENT_ID), cfg = bnxBsCfg_(cid), A = Array.isArray(p.rows) ? p.rows : [];
  if (!A.length) return { success: false, error: 'Empty file' };
  var h = bnxBsIdx_(A); if (h.hr < 0) return { success: false, error: 'Heading row with Date, Remarks, Withdrawal and Deposit not found in this file' };
  var acc = String(p.account || '').trim(), src = cfg.bank.filter(function (b) { return (b.account || b.tab) === acc; })[0] || cfg.bank.filter(function (b) { return b.mirror; })[0] || cfg.bank[0] || { account: acc || 'BANK', tab: acc || 'BANK' };
  var account = src.account || src.tab, rows = bnxBsRows_(A, h.hr, h.ix, bnxBsTz_(), '0000'); rows.header = A[h.hr];
  if (!rows.length) return { success: false, error: 'No transactions found under the heading row' };
  var lock = bnxTenantLock_(); if (!lock.tryLock(30000)) return { success: false, retryable: true, error: 'Busy — retry' };
  var res = { account: account, read: rows.length, added: 0, already: 0, copied: 0, from: '', to: '' };
  try {
    var sh = bnxBsRegister_(cid), W = BNX_BANK_TXN_HEADERS_.length + BNX_BS_EXTRA_.length, n = sh.getLastRow();
    var ex = n >= 2 ? sh.getRange(2, 1, n - 1, W).getValues() : [], keys = {}, sigFree = {};
    ex.forEach(function (r) { keys[String(r[0])] = 1; if (String(r[9]).toUpperCase() === 'DUPLICATE' || /^BS-/.test(String(r[0]))) return;
      var sg = bnxBsSig_(bnxNormalizeDateKey_(r[2]), +r[4] || 0, +r[5] || 0, r[3]); sigFree[sg] = (sigFree[sg] || 0) + 1; });
    var now = new Date().toISOString(), uid = String(s.USER_ID || 'UPLOAD'), add = [], occ = {};
    rows.forEach(function (x) {
      if (!res.from || x.d < res.from) res.from = x.d; if (x.d > res.to) res.to = x.d;
      var amt = Math.round((x.cr || x.dr) * 100), base = x.tran || ('H' + bnxBsNorm_(x.narr).slice(0, 24));
      var k0 = 'BS-' + account + '-' + base + '-' + x.d + '-' + (x.cr ? 'C' : 'D') + amt; occ[k0] = (occ[k0] || 0) + 1;
      var key = (k0 + (occ[k0] > 1 ? '-' + occ[k0] : '')).slice(0, 120);
      if (keys[key]) { res.already++; return; }
      var sg = bnxBsSig_(x.d, x.cr, x.dr, x.narr); if (sigFree[sg] > 0) { sigFree[sg]--; keys[key] = 1; res.already++; return; }
      keys[key] = 1;
      var mode = x.cr ? bnxBsMode_(x.narr) : 'PAYMENT', biz = bnxBsBiz_(x.pd, x.t), sd = mode === 'SWEEP' ? bnxBsSettleDate_(x.narr) : '', md = mode === 'UPI' ? biz : '';
      add.push([key, account, x.d, x.narr.slice(0, 300), x.cr, x.dr, mode, md, md ? 'UPI' : '', md ? 'AUTO' : '', String(x.tran || '').slice(0, 100), 'UPLOAD:' + account, now, uid, now, uid, x.t, x.tran, x.bal, biz, sd]);
    });
    for (var i = 0; i < add.length; i += 2000) { var part = add.slice(i, i + 2000); sh.getRange(sh.getLastRow() + 1, 1, part.length, W).setValues(part); }
    if (add.length) { try { sh.getRange(2, 3, sh.getLastRow() - 1, 1).setNumberFormat('@'); } catch (e) {} }
    res.added = add.length;
    if (src.mirror) { try { res.copied = bnxBsMirror_(cid, src.mirror, rows); res.copiedTo = src.mirror; } catch (me) { res.mirrorError = String(me.message || me); } }
    try { CacheService.getScriptCache().put('banktxn_gen_' + cid, String(Date.now()), 21600); } catch (e) {}
  } finally { lock.releaseLock(); }
  try { bnxRecoBump_(cid); } catch (e) {}
  return { success: true, data: res };
}
function bnxRecoDataStatus_(s, p) {
  if (!bnxBsRole_(s)) return { success: false, statusCode: 403, error: 'Accounts / Manager login needed' };
  var cid = String(s.CLIENT_ID), ck = 'recostat_' + cid + '_' + (function () { try { return CacheService.getScriptCache().get('recogen_' + cid) || '0'; } catch (e) { return '0'; } })(), c = CacheService.getScriptCache();
  if (!p.force) { try { var hit = c.get(ck); if (hit) return { success: true, data: JSON.parse(hit) }; } catch (e) {} }
  var ss = bnxPqDb_(cid, 'TRANSACTION'), tz = ss.getSpreadsheetTimeZone() || bnxBsTz_(), out = { swiftTxn: null, swiftSet: null, bank: [], bills: '', at: new Date().toISOString() };
  var lastOf = function (sh, re, okRe, stRe) { if (!sh || sh.getLastRow() < 2) return { rows: 0, last: '' };
    var w = sh.getLastColumn(), hd = sh.getRange(1, 1, 1, w).getValues()[0].map(bnxBsNorm_), ci = -1, si = -1; for (var i = 0; i < hd.length; i++) { if (ci < 0 && re.test(hd[i])) ci = i; if (si < 0 && stRe && stRe.test(hd[i])) si = i; }
    if (ci < 0) return { rows: sh.getLastRow() - 1, last: '' };
    var v = sh.getRange(2, ci + 1, sh.getLastRow() - 1, 1).getValues(), st = si >= 0 ? sh.getRange(2, si + 1, sh.getLastRow() - 1, 1).getValues() : null, last = '', days = {};
    v.forEach(function (r, k) { if (st && okRe && !okRe.test(String(st[k][0] || ''))) return; var d = r[0] instanceof Date ? bnxBsCd_(r[0], tz) : bnxBsDt_(r[0], tz).d; if (d && d > last) last = d; if (d) days[d] = (days[d] || 0) + 1; });
    var recent = Object.keys(days).sort().slice(-7).map(function (d) { return { d: d, n: days[d] }; });
    return { rows: v.length, last: last, recent: recent }; };
  try { out.swiftTxn = lastOf(bnxBsSwiftTab_(ss, 'transactions', false), /^transactiondate(time|andtime)?$/, /^SUCCESS/i, /^transactionstatus$/); } catch (e) { out.swiftTxn = { error: String(e.message || e) }; }
  try { out.swiftSet = lastOf(bnxBsSwiftTab_(ss, 'settlements', false), /^settlementdate$/, null, null); } catch (e) { out.swiftSet = { error: String(e.message || e) }; }
  try { var rg = ss.getSheetByName('BANK_TXN_REGISTER');
    if (rg && rg.getLastRow() > 1) { var rv = rg.getRange(2, 1, rg.getLastRow() - 1, 12).getValues(), A = {};
      rv.forEach(function (r) { if (String(r[9]).toUpperCase() === 'DUPLICATE') return; var a = String(r[1] || 'BANK'), d = bnxNormalizeDateKey_(r[2]); if (!d) return; var o = A[a] = A[a] || { account: a, rows: 0, last: '', lastCredit: '' }; o.rows++; if (d > o.last) o.last = d; if (+r[4] > 0 && d > o.lastCredit) o.lastCredit = d; });
      out.bank = Object.keys(A).map(function (k) { return A[k]; }); } } catch (e) { out.bankError = String(e.message || e); }
  try { var cfg = bnxBsCfg_(cid); out.accounts = cfg.bank.map(function (b) { return { account: b.account || b.tab, mirror: b.mirror || '' }; });
    var st = JSON.parse(PropertiesService.getScriptProperties().getProperty('BNX_BSYNC_LAST_' + cid) || '{}'); out.lastSync = st && st.at || ''; out.syncErrors = ((st && st.bank && st.bank.errors) || []).concat((st && st.sweep && st.sweep.errors) || []).slice(0, 4); } catch (e) {}
  try { var bm = ss.getSheetByName('BILL_MASTER'); if (bm && bm.getLastRow() > 1) { var hd = bm.getRange(1, 1, 1, bm.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim(); }), bi = hd.indexOf('BILL_DATE');
      if (bi >= 0) { var n = bm.getLastRow() - 1, k0 = Math.max(0, n - 3000), bv = bm.getRange(2 + k0, bi + 1, n - k0, 1).getValues(); var bd = {}; bv.forEach(function (r) { var d = typeof bnxTlDay_ === 'function' ? bnxTlDay_(bm, r[0]) : bnxSrDate_(r[0]); if (d && d > out.bills) out.bills = d; if (d) bd[d] = (bd[d] || 0) + 1; });
        out.billDays = Object.keys(bd).sort().slice(-10).map(function (d) { return { d: d, n: bd[d] }; }); out.billRows = n; } } } catch (e) {}
  /* 2026-11-26 "day-wise shows ERP 0": are orders reaching the server while bills are not? (POS outbox / day not closed) */
  try { var om = ss.getSheetByName('ORDER_MASTER'); if (om && om.getLastRow() > 1) { var oh = om.getRange(1, 1, 1, om.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim().toUpperCase(); });
      var oi = ['ORDER_DATE', 'CREATED_AT', 'ORDER_TIME'].map(function (k) { return oh.indexOf(k); }).filter(function (i) { return i >= 0; })[0];
      if (oi !== undefined) { var on = om.getLastRow() - 1, o0 = Math.max(0, on - 1500), od = {}; om.getRange(2 + o0, oi + 1, on - o0, 1).getValues().forEach(function (r) { var d = r[0] instanceof Date ? bnxBsCd_(r[0], tz) : String(bnxNormalizeDateKey_(r[0]) || '').slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { if (d > (out.orders || '')) out.orders = d; od[d] = (od[d] || 0) + 1; } });
        out.orderDays = Object.keys(od).sort().slice(-10).map(function (d) { return { d: d, n: od[d] }; }); } } } catch (e) {}
  try { c.put(ck, JSON.stringify(out), 300); } catch (e) {}
  return { success: true, data: out };
}

/* 2026-11-26: secrets never go to a browser — token / secret / password / api key values become true (saved) or false */
function bnxMaskSecrets_(o, depth) {
  depth = depth || 0; if (!o || typeof o !== 'object' || depth > 6) return o;
  if (Array.isArray(o)) return o.map(function (x) { return bnxMaskSecrets_(x, depth + 1); });
  Object.keys(o).forEach(function (k) {
    var v = o[k];
    if (/(token|secret|password|passwd|pin_?hash|salt|api_?key|apikey|private_?key|access_?key)$/i.test(k) && !/^(has|is|show)/i.test(k) && (typeof v === 'string' || typeof v === 'number')) o[k] = !!String(v).trim();
    else if (v && typeof v === 'object') o[k] = bnxMaskSecrets_(v, depth + 1);
  });
  return o;
}

/* 2026-11-26: "Cloud-API number (?) — Meta refused the token / phone id: Meta HTTP 200" was misleading — HTTP 200 means
   Meta ACCEPTED the token; the phone id just belongs to Meta's TEST number (+1 555 …), which is not an Indian number and
   can only message 5 allowed numbers (#131030). Say that plainly. */
(function () {
  if (typeof bnxWaApiInfo_ !== 'function' || bnxWaApiInfo_.__msg) return;
  var base = bnxWaApiInfo_;
  bnxWaApiInfo_ = function (cid) {
    var r = base.apply(this, arguments);
    try { if (r && !r.ok && /Meta HTTP 200/.test(String(r.error || ''))) { r.testNumber = true;
      r.error = 'token OK, but the connected number is Meta\'s TEST number (+1 555 …), not your WhatsApp number — it can only message 5 allowed numbers. Connect your own number: Growth Hub → Connect WhatsApp'; } } catch (e) {}
    return r;
  };
  bnxWaApiInfo_.__msg = true;
})();


/* =====================================================================================================
 *  2026-11-26 "how to connect" — Growth Hub said "WhatsApp connected · +1 555-672-1509 (Test Number)" after the restaurant
 *  connected its own number: when Facebook's browser message did not carry the phone id, WA_ES_FINISH took the FIRST
 *  number of the shared WhatsApp accounts — the developer test account. Replaced here (this file loads last): test numbers
 *  are never saved, the restaurant's +91 number wins. Everything else is as in wa-webhook-connect.gs.
 * ===================================================================================================== */
if (typeof bnxWaEsFinish_ === 'function') {
bnxWaEsFinish_ = function (cid, p) {
  p = p || {};
  var P = PropertiesService.getScriptProperties(), steps = [];
  var appId = P.getProperty('META_APP_ID'), secret = P.getProperty('META_APP_SECRET');
  var code = String(p.code || ''), waba = String(p.wabaId || '').replace(/\D/g, ''), phone = String(p.phoneId || '').replace(/\D/g, '');
  var coex = /APP_ONBOARDING|COEX/i.test(String(p.event || ''));
  if (!appId || !secret) return { success: false, error: 'Balaji NextGen setup: META_APP_ID / META_APP_SECRET not set in Script properties' };
  if (!code) return { success: false, error: 'Facebook did not return a login code — press Connect WhatsApp again' };
  /* 2026-11-15: WhatsApp account / number may be missing from the browser message — found from the token below */
  try {
    /* 1. code → this client's business token */
    var tr = UrlFetchApp.fetch(BNX_WA_GRAPH + 'oauth/access_token?client_id=' + encodeURIComponent(appId) + '&client_secret=' + encodeURIComponent(secret) + '&code=' + encodeURIComponent(code), { muteHttpExceptions: true });
    var tj = {}; try { tj = JSON.parse(tr.getContentText()); } catch (e) {}
    if (!tj.access_token) return { success: false, error: 'Meta refused the login code: ' + ((tj.error && tj.error.message) || tr.getContentText().slice(0, 160)), steps: steps };
    var token = tj.access_token; steps.push('Business token received ✓');
    var H = { Authorization: 'Bearer ' + token };
    if (!waba || !phone) {
      /* which WhatsApp accounts did the client share? (token's granular scopes) */
      try {
        var dj = JSON.parse(UrlFetchApp.fetch(BNX_WA_GRAPH + 'debug_token?input_token=' + encodeURIComponent(token) + '&access_token=' + encodeURIComponent(appId + '|' + secret), { muteHttpExceptions: true }).getContentText());
        var gs = (dj.data && dj.data.granular_scopes) || [], ids = [];
        gs.forEach(function (g) { if (/whatsapp_business_(management|messaging)/.test(g.scope)) (g.target_ids || []).forEach(function (t) { if (ids.indexOf(String(t)) < 0) ids.push(String(t)); }); });
        steps.push('Shared WhatsApp accounts: ' + (ids.length ? ids.join(', ') : 'none') + ' · scopes: ' + gs.map(function (g) { return g.scope; }).join(', '));
        /* 2026-11-26: the token also covers the developer's TEST account → list[0] was Meta's test number (+1 555 …) and
           that was saved instead of the restaurant's own number. Now every shared number is listed, test numbers are
           skipped, an Indian number wins, and a number the hub sent as a hint (wantNumber) wins over all. */
        var cands = [], want = String(p.wantNumber || '').replace(/\D/g, '').slice(-10);
        for (var i = 0; i < ids.length; i++) {
          var pj = JSON.parse(UrlFetchApp.fetch(BNX_WA_GRAPH + ids[i] + '/phone_numbers?fields=id,display_phone_number,verified_name', { headers: H, muteHttpExceptions: true }).getContentText());
          ((pj && pj.data) || []).forEach(function (x) { var d = String(x.display_phone_number || '').replace(/\D/g, ''); cands.push({ waba: ids[i], id: String(x.id), num: x.display_phone_number || '', name: x.verified_name || '',
            test: /^1555/.test(d) || /test number/i.test(String(x.verified_name || '')), india: /^91[6-9]\d{9}$/.test(d), want: !!want && d.slice(-10) === want }); });
          if (!waba && !((pj && pj.data) || []).length) waba = ids[i];
        }
        cands.sort(function (a, b) { return (b.want - a.want) || (a.test - b.test) || (b.india - a.india); });
        if (cands.length) steps.push('Numbers shared: ' + cands.map(function (c) { return c.num + (c.test ? ' (test)' : ''); }).join(', '));
        var pick = cands[0];
        if (pick && pick.test) return { success: false, steps: steps, error: 'Facebook shared only Meta\'s TEST number (' + pick.num + '). Press the button again and in the Facebook window choose your business portfolio + your own number (+91 …), not the test account.' };
        if (pick) { waba = pick.waba; phone = pick.id; steps.push('Number found: ' + (pick.num || phone) + ' ✓'); }
      } catch (e) { steps.push('Lookup: ' + String(e && e.message || e).slice(0, 120)); }
      if (!waba || !phone) return { success: false, steps: steps,
        error: 'Facebook did not share a WhatsApp account / number. In Meta → Facebook Login for Business → Configurations, the configuration in use (' + (P.getProperty('META_ES_CONFIG_ID') || '?') + ') must be "WhatsApp Embedded Signup" with asset "WhatsApp accounts". Then connect again.' };
    }
    try { var chk = JSON.parse(UrlFetchApp.fetch(BNX_WA_GRAPH + phone + '?fields=display_phone_number,verified_name', { headers: H, muteHttpExceptions: true }).getContentText()); var dd = String(chk.display_phone_number || '').replace(/\D/g, '');
      if (/^1555/.test(dd) || /test number/i.test(String(chk.verified_name || ''))) return { success: false, steps: steps, error: 'This is Meta\'s TEST number (' + chk.display_phone_number + ') — nothing was changed. Press the button again and pick your own number (+91 …) in the Facebook window.' }; } catch (e) {}
    /* 2. subscribe our app to this client's WhatsApp account (messages reach the shared relay / webhook) */
    var sr = UrlFetchApp.fetch(BNX_WA_GRAPH + waba + '/subscribed_apps', { method: 'post', headers: H, muteHttpExceptions: true });
    steps.push(sr.getResponseCode() === 200 ? 'Messages subscribed ✓' : 'Subscribe: ' + sr.getContentText().slice(0, 120));
    /* 3. a NEW number must be registered for Cloud API; a Business-app number (Coexistence) stays on the phone app */
    if (!coex) {
      var pin = String(100000 + Math.floor(Math.random() * 899999));
      var rr = UrlFetchApp.fetch(BNX_WA_GRAPH + phone + '/register', { method: 'post', headers: H, contentType: 'application/json',
        payload: JSON.stringify({ messaging_product: 'whatsapp', pin: pin }), muteHttpExceptions: true });
      if (rr.getResponseCode() === 200) { steps.push('Number registered for Cloud API ✓'); P.setProperty('META_WA_PIN_' + cid, pin); }
      else steps.push('Register: ' + rr.getContentText().slice(0, 160));
    } else steps.push('Business-app number kept on the phone (Coexistence) ✓');
    /* 4. read the number + name, save everything for THIS client */
    var num = '', name = '';
    try { var nr = JSON.parse(UrlFetchApp.fetch(BNX_WA_GRAPH + phone + '?fields=display_phone_number,verified_name', { headers: H, muteHttpExceptions: true }).getContentText());
      num = nr.display_phone_number || ''; name = nr.verified_name || ''; } catch (e) {}
    var put = function (k, v) { P.setProperty(k + '_' + cid, String(v)); };
    put('META_WA_TOKEN', token); put('META_WA_PHONE_ID', phone); put('META_WA_WABA_ID', waba); put('WA_PROVIDER', 'META');
    put('META_WA_NUMBER', num); put('META_WA_NAME', name); put('META_WA_CONNECTED_AT', new Date().toISOString()); put('META_WA_COEX', coex ? 'YES' : 'NO');
    try { CacheService.getScriptCache().removeAll(['waapi_' + cid, 'wahealth_' + cid]); } catch (e) {}
    steps.push('Saved for ' + cid + (num ? ' · ' + num : '') + (name ? ' (' + name + ')' : '') + ' ✓');
    /* 5. point the webhook at the shared relay when it is live (optional — sending works without it) */
    try { var wh = bnxWaWebhookConnect_(cid, {}); steps.push(wh.success ? 'Webhook connected ✓' : 'Webhook (optional, later): ' + String(wh.error || '').slice(0, 120)); } catch (e) {}
    return { success: true, steps: steps, data: { number: num, name: name, phoneId: phone, wabaId: waba, coexistence: coex } };
  } catch (e) { return { success: false, error: String(e && e.message || e), steps: steps }; }
};
}


/* =====================================================================================================
 *  2026-11-26 CRM › Guest CRM (QR): "Could not load everything. Unknown action: GET_CRM_CUSTOMERS" — no file answered
 *  GET_CRM_CUSTOMERS / GET_CRM_TRANSACTIONS. The guests ARE saved (QR / WhatsApp check-in → GUEST_CRM in the MASTER DB,
 *  every visit / order / bill → GUEST_TRANSACTIONS in the TRANSACTION DB). These return them for this restaurant:
 *  data = ARRAY of row objects (all sheet columns; the CRM page needs an array), newest first.
 *  Optional: mobile (one guest), from / to (yyyy-mm-dd), q (search), max / limit (default 5000, up to 20000).
 * ===================================================================================================== */
function bnxCrmRows_(s, p, tab, kinds, dateCols) {
  var cid = String(s.CLIENT_ID || ''), sh = null, src = '';
  kinds.some(function (k) { try { var ss = bnxPqDb_(cid, k); var t = ss && ss.getSheetByName(tab); if (t) { sh = t; src = k; return true; } } catch (e) {} return false; });
  if (!sh || sh.getLastRow() < 2) return { success: true, data: [], total: 0, source: src || 'none', sheet: tab };
  var v = sh.getDataRange().getValues(), h = v[0].map(function (x) { return String(x || '').trim(); }), H = h.map(function (x) { return x.toUpperCase(); });
  var ci = H.indexOf('CLIENT_ID'), mi = ['MOBILE', 'MOBILE_NO', 'PHONE'].map(function (k) { return H.indexOf(k); }).filter(function (i) { return i >= 0; })[0];
  var di = dateCols.map(function (k) { return H.indexOf(k); }).filter(function (i) { return i >= 0; })[0];
  var tz = bnxSheetTz_(sh);   /* 2026-11-26 times were +13:30: see bnxSheetTz_ */
  var from = String(p.from || p.FROM_DATE || ''), to = String(p.to || p.TO_DATE || ''), q = String(p.q || p.search || '').toLowerCase().trim();
  var want = String(p.mobile || p.mobileNo || '').replace(/\D/g, '').slice(-10), lim = Math.min(Number(p.max || p.limit) || 5000, 20000), out = [];
  for (var r = 1; r < v.length; r++) {
    var row = v[r]; if (!row.join('').trim()) continue;
    if (ci >= 0 && row[ci] && String(row[ci]).trim() !== cid) continue;
    if (want && mi !== undefined && String(row[mi]).replace(/\D/g, '').slice(-10) !== want) continue;
    var o = {}; for (var c = 0; c < h.length; c++) { if (!h[c]) continue; var x = row[c]; o[h[c]] = x instanceof Date ? Utilities.formatDate(x, tz, 'yyyy-MM-dd HH:mm:ss') : x; }
    if ((from || to) && di !== undefined) { var d = String(o[h[di]] || '').slice(0, 10); if (from && d && d < from) continue; if (to && d && d > to) continue; }
    if (q && JSON.stringify(o).toLowerCase().indexOf(q) < 0) continue;
    out.push(o);
  }
  if (di !== undefined) out.sort(function (a, b) { return String(b[h[di]] || '').localeCompare(String(a[h[di]] || '')); });
  return { success: true, data: out.slice(0, lim), total: out.length, source: src, sheet: tab };
}

/* =====================================================================================================
 *  2026-11-26 "same style and design as the reference videos" — website extras for the new landing page
 *  (restaurant-landing.html) and the new dark menu (restaurant-menu.html):
 *   • LANDING_EXTRA_GET / _SAVE (owner/admin/manager): e-mail, GSTIN, FSSAI, registered name, place name, Swiggy /
 *     Zomato links, ambience gallery photos, day-wise timings, menu tagline. Stored in Script property
 *     LANDING_EXTRA_<client>. Empty fields fall back to COMPANY_SETTINGS / CLIENT_SETTINGS.
 *   • The public LANDING answer carries them in info.* (gallery, hoursTable, swiggyUrl, zomatoUrl, email, gstin …).
 *   • PUBLIC_MENU items carry desc (MENU_CARD_ITEMS / BAR_MENU_CARD description column) for "Know more".
 * ===================================================================================================== */
var BNX_LX_KEYS = ['email', 'gstin', 'fssai', 'legalName', 'placeName', 'swiggyUrl', 'zomatoUrl', 'gallery', 'hoursTable', 'menuTagline', 'menuIntro'];
var BNX_PRIVATE_EMAILS = /balajieducationhub12@gmail\.com/i;   /* never on a public page */
function bnxLandingExtra_(cid) {
  var o = {}; try { o = JSON.parse(PropertiesService.getScriptProperties().getProperty('LANDING_EXTRA_' + cid) || '{}') || {}; } catch (e) {}
  return o;
}
function bnxLandingExtraAction_(s, p, save) {
  var cid = String(s.CLIENT_ID || '');
  if (save) {
    if (!/OWNER|ADMIN|SUPER|DEVELOPER|MANAGER/i.test(String(s.ROLE || ''))) return { success: false, error: 'Only owner / admin / manager can change the website' };
    var x = p.extra || {}, o = {};
    BNX_LX_KEYS.forEach(function (k) { var v = String(x[k] == null ? '' : x[k]).trim().slice(0, k === 'gallery' || k === 'hoursTable' || k === 'menuIntro' ? 4000 : 300);
      if (/Url$/.test(k) && v && !/^https:\/\//i.test(v)) v = ''; if (k === 'email' && BNX_PRIVATE_EMAILS.test(v)) v = ''; o[k] = v; });
    o.gallery = o.gallery.split(/[\s,]+/).filter(function (u) { return /^https:\/\//i.test(u); }).slice(0, 24).join('\n');
    PropertiesService.getScriptProperties().setProperty('LANDING_EXTRA_' + cid, JSON.stringify(o));
    try { CacheService.getScriptCache().removeAll(['gglanding_' + cid, 'lxinfo_' + cid]); } catch (e) {}
    return { success: true, data: o };
  }
  return { success: true, data: bnxLandingExtra_(cid) };
}
/* settings-sheet fallbacks for the public page (10 min cache) */
function bnxLandingInfoX_(cid) {
  var c = CacheService.getScriptCache(), ck = 'lxinfo_' + cid, hit = c.get(ck); if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var x = bnxLandingExtra_(cid), co = {}, cs = {};
  try { var ss = bnxCrmSpreadsheet_(cid, 'MASTER'), mine = function (r) { return !r.CLIENT_ID || String(r.CLIENT_ID) === cid; };
    cs = bnxPubRows_(ss, 'CLIENT_SETTINGS').filter(mine)[0] || {}; co = bnxPubRows_(ss, 'COMPANY_SETTINGS').filter(mine).filter(function (r) { return r.COMPANY_NAME; })[0] || {}; } catch (e) {}
  var pick = function () { for (var i = 0; i < arguments.length; i++) { var v = arguments[i]; if (v !== undefined && v !== null && String(v).trim()) return String(v).trim(); } return ''; };
  var email = pick(x.email, co.EMAIL, co.COMPANY_EMAIL, cs.RESTAURANT_EMAIL, cs.EMAIL); if (BNX_PRIVATE_EMAILS.test(email)) email = '';
  var out = { email: email, gstin: pick(x.gstin, co.GSTIN, co.GST_NO, co.GST_NUMBER, cs.GSTIN, cs.GST_NO), fssai: pick(x.fssai, co.FSSAI_NO, co.FSSAI, cs.FSSAI_NO, cs.FSSAI),
    legalName: pick(x.legalName, co.LEGAL_NAME, co.REGISTERED_NAME, co.COMPANY_LEGAL_NAME), placeName: pick(x.placeName, co.COMPANY_NAME, cs.RESTAURANT_NAME),
    swiggyUrl: pick(x.swiggyUrl, cs.SWIGGY_URL), zomatoUrl: pick(x.zomatoUrl, cs.ZOMATO_URL),
    gallery: String(x.gallery || '').split(/\s+/).filter(function (u) { return /^https:\/\//i.test(u); }), hoursTable: String(x.hoursTable || ''),
    menuTagline: x.menuTagline || '', menuIntro: x.menuIntro || '' };
  if (!/^https:\/\//i.test(out.swiggyUrl)) out.swiggyUrl = ''; if (!/^https:\/\//i.test(out.zomatoUrl)) out.zomatoUrl = '';
  try { c.put(ck, JSON.stringify(out), 600); } catch (e) {}
  return out;
}
(function () {
  if (typeof bnxGgLanding_ !== 'function' || bnxGgLanding_.__lx) return;
  var base = bnxGgLanding_;
  bnxGgLanding_ = function (cid) {
    var r = base.apply(this, arguments);
    try { if (r && r.info) { r = JSON.parse(JSON.stringify(r)); var x = bnxLandingInfoX_(cid); Object.keys(x).forEach(function (k) { if (r.info[k] === undefined || r.info[k] === '') r.info[k] = x[k]; }); } } catch (e) {}
    return r;
  };
  bnxGgLanding_.__lx = true;
})();
/* item descriptions for "Know more" (only when the public menu is rebuilt — it is cached 10 min) */
(function () {
  if (typeof bnxPublicMenu_ !== 'function' || bnxPublicMenu_.__desc) return;
  var base = bnxPublicMenu_;
  bnxPublicMenu_ = function (cid) {
    var d = base.apply(this, arguments);
    try {
      var ss = bnxCrmSpreadsheet_(cid, 'MASTER'), D = {}, add = function (rows, nameK) { rows.forEach(function (r) { var nm = String(r[nameK] || '').trim().toUpperCase(),
        ds = String(r.DESCRIPTION || r.ITEM_DESCRIPTION || r.MENU_DESCRIPTION || r.DESC || r.SHORT_DESCRIPTION || '').trim(); if (nm && ds && !D[nm]) D[nm] = ds.slice(0, 300); }); };
      add(bnxPubRows_(ss, 'MENU_CARD_ITEMS'), 'MENU_ITEM_NAME'); add(bnxPubRows_(ss, 'BAR_MENU_CARD'), 'ITEM_NAME');
      [].concat(d.food || [], d.bar || []).forEach(function (i) { var k = String(i.name || '').toUpperCase(); if (D[k] && !i.desc) i.desc = D[k]; });
      if (d.info) { var x = bnxLandingInfoX_(cid); d.info.menuTagline = x.menuTagline; d.info.menuIntro = x.menuIntro; }
    } catch (e) {}
    return d;
  };
  bnxPublicMenu_.__desc = true;
})();


/* =====================================================================================================
 *  2026-11-26 CRM dashboard on the ERP login ("Offline · this browser" while logged in).
 *  Root cause: crm-dashboard.html talked to an old stand-alone CRM script that needs a separate API key, so with the
 *  ERP login only it fell back to browser storage (data lost on another PC / after clearing). Now:
 *  CRM_DATA {op: load | save | delete | ping} with the ERP session → client's own databases:
 *    MASTER       CRM_CUSTOMER_MASTER
 *    TRANSACTION  CRM_LEADS · CRM_ENQUIRIES · CRM_QUOTATIONS · CRM_SALES_ORDERS · CRM_SERVICE_TICKETS · CRM_FOLLOWUPS
 *  Sheets / columns are created on first save. "Delete" only marks IS_DELETED = Y (never removes the row).
 * ===================================================================================================== */
var BNX_CRMD_T = {
  customers: { db: 'MASTER', tab: 'CRM_CUSTOMER_MASTER', key: 'CUSTOMER_CODE', pre: 'CX-' },
  leads: { db: 'TRANSACTION', tab: 'CRM_LEADS', key: 'LEAD_CODE', pre: 'LD-' },
  enq: { db: 'TRANSACTION', tab: 'CRM_ENQUIRIES', key: 'ENQ_NO', pre: 'ENQ-' },
  quotes: { db: 'TRANSACTION', tab: 'CRM_QUOTATIONS', key: 'QT_NO', pre: 'QT-' },
  orders: { db: 'TRANSACTION', tab: 'CRM_SALES_ORDERS', key: 'SO_NO', pre: 'SO-' },
  tickets: { db: 'TRANSACTION', tab: 'CRM_SERVICE_TICKETS', key: 'TICKET_NO', pre: 'TKT-' },
  followups: { db: 'TRANSACTION', tab: 'CRM_FOLLOWUPS', key: 'REFERENCE_NO', pre: 'FU-' }
};
var BNX_CRMD_SYS = ['CLIENT_ID', 'CREATED_AT', 'CREATED_BY', 'UPDATED_AT', 'UPDATED_BY', 'IS_DELETED', 'DELETED_AT', 'DELETED_BY'];
var BNX_CRMD_BLOCK = /PASSWORD|PIN|HASH|SALT|SESSION|TOKEN|OTP|SECRET|API_KEY/i;
function bnxCrmdSheet_(cid, T, create) {
  var ss = bnxPqDb_(cid, T.db), sh = ss.getSheetByName(T.tab);
  if (!sh && create) { sh = ss.insertSheet(T.tab); var hd = [T.key].concat(BNX_CRMD_SYS); sh.getRange(1, 1, 1, hd.length).setValues([hd]); sh.setFrozenRows(1); }
  return sh;
}
function bnxCrmdRead_(sh) {
  if (!sh || sh.getLastRow() < 1) return { h: [], v: [] };
  var v = sh.getDataRange().getValues(); return { h: v[0].map(function (x) { return String(x || '').trim(); }), v: v };
}
function bnxCrmData_(s, p) {
  var cid = String(s.CLIENT_ID || ''), op = String(p.op || 'load').toLowerCase(), who = String(s.USER_ID || s.FULL_NAME || s.LOGIN_ID || '');
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(cid)) return { success: false, error: 'No client on this login' };
  var tz = Session.getScriptTimeZone() || 'Asia/Kolkata', now = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
  var fmt = function (x, z) { z = z || tz; if (!(x instanceof Date)) return x; var t = Utilities.formatDate(x, z, 'HH:mm'); return Utilities.formatDate(x, z, t === '00:00' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm'); };
  if (op === 'ping') {
    var nm = {}; ['MASTER', 'TRANSACTION'].forEach(function (k) { try { nm[k] = bnxPqDb_(cid, k).getName(); } catch (e) { nm[k] = 'not reachable: ' + e.message; } });
    return { success: true, ok: true, master: nm.MASTER, txn: nm.TRANSACTION };
  }
  if (op === 'load') {
    var data = {}, errs = [];
    Object.keys(BNX_CRMD_T).forEach(function (m) {
      var T = BNX_CRMD_T[m], out = [];
      try {
        var shL = bnxCrmdSheet_(cid, T, false), R = bnxCrmdRead_(shL), H = R.h.map(function (x) { return x.toUpperCase(); }), stz = shL ? bnxSheetTz_(shL) : tz;
        var ci = H.indexOf('CLIENT_ID'), di = H.indexOf('IS_DELETED');
        for (var r = 1; r < R.v.length; r++) { var row = R.v[r]; if (!row.join('').trim()) continue;
          if (ci >= 0 && row[ci] && String(row[ci]) !== cid) continue; if (di >= 0 && /^(Y|YES|TRUE|1)$/i.test(String(row[di]))) continue;
          var o = {}; R.h.forEach(function (k, c) { if (k && BNX_CRMD_SYS.indexOf(k.toUpperCase()) < 0 && !BNX_CRMD_BLOCK.test(k)) o[k] = fmt(row[c], stz); }); out.push(o); }
      } catch (e) { errs.push(T.tab + ': ' + e.message); }
      data[m] = out;
    });
    return { success: true, ok: true, data: data, warnings: errs };
  }
  var T = BNX_CRMD_T[String(p.table || '')]; if (!T) return { success: false, error: 'Unknown CRM table' };
  var lock = LockService.getScriptLock(), got = false;
  for (var t = 0; t < 6 && !got; t++) got = lock.tryLock(10000);
  if (!got) return { success: false, error: 'Server busy — try again in a moment' };
  try {
    var sh = bnxCrmdSheet_(cid, T, op === 'save'); if (!sh) return { success: false, error: 'Nothing saved yet' };
    var R = bnxCrmdRead_(sh), h = R.h.slice(), H = h.map(function (x) { return x.toUpperCase(); });
    var ki = H.indexOf(T.key), ci = H.indexOf('CLIENT_ID');
    var findRow = function (key) { for (var r = 1; r < R.v.length; r++) if (String(R.v[r][ki]) === String(key) && (ci < 0 || !R.v[r][ci] || String(R.v[r][ci]) === cid)) return r; return -1; };
    if (op === 'delete') {
      var dr = findRow(p.key); if (dr < 0) return { success: true, ok: true, missing: true };
      ['IS_DELETED', 'DELETED_AT', 'DELETED_BY'].forEach(function (k) { if (H.indexOf(k) < 0) { h.push(k); H.push(k); sh.getRange(1, h.length).setValue(k); } });
      sh.getRange(dr + 1, H.indexOf('IS_DELETED') + 1).setValue('Y'); sh.getRange(dr + 1, H.indexOf('DELETED_AT') + 1).setValue(now); sh.getRange(dr + 1, H.indexOf('DELETED_BY') + 1).setValue(who);
      return { success: true, ok: true };
    }
    if (op !== 'save') return { success: false, error: 'Unknown CRM operation' };
    var row = p.row || {}, rec = {};
    Object.keys(row).forEach(function (k) { var K = String(k).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 60);
      if (!K || BNX_CRMD_SYS.indexOf(K) >= 0 || BNX_CRMD_BLOCK.test(K)) return; var v = row[k]; rec[K] = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v).slice(0, 2000)); });
    var key = String(rec[T.key] || '').trim(), r0 = key ? findRow(key) : -1;
    if (!key || (p.isNew && r0 >= 0)) {   /* server numbers new records: LD-001 … (no clash between two PCs) */
      var mx = 0; for (var r = 1; r < R.v.length; r++) { var n = parseInt(String(R.v[r][ki]).replace(/\D/g, ''), 10) || 0; if (n > mx) mx = n; }
      key = T.pre + ('00' + (mx + 1)).slice(-Math.max(3, String(mx + 1).length)); rec[T.key] = key; r0 = -1;
    }
    rec.CLIENT_ID = cid; rec.UPDATED_AT = now; rec.UPDATED_BY = who;
    if (r0 < 0) { rec.CREATED_AT = now; rec.CREATED_BY = who; }
    Object.keys(rec).forEach(function (k) { if (H.indexOf(k) < 0) { h.push(k); H.push(k); sh.getRange(1, h.length).setValue(k); } });
    if (r0 < 0) { sh.appendRow(H.map(function (k) { return rec[k] !== undefined ? rec[k] : ''; })); }
    else { var cur = R.v[r0].slice(); while (cur.length < H.length) cur.push(''); H.forEach(function (k, c) { if (rec[k] !== undefined) cur[c] = rec[k]; }); sh.getRange(r0 + 1, 1, 1, H.length).setValues([cur]); }
    var back = {}; H.forEach(function (k) { if (BNX_CRMD_SYS.indexOf(k) < 0 && rec[k] !== undefined) back[k] = rec[k]; });
    if (r0 >= 0) { var cur2 = R.v[r0]; H.forEach(function (k, c) { if (back[k] === undefined && BNX_CRMD_SYS.indexOf(k) < 0 && c < cur2.length) back[k] = fmt(cur2[c], bnxSheetTz_(sh)); }); }
    return { success: true, ok: true, row: back };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* =====================================================================================================
 *  2026-11-26 NEW FOOD MENU (FOOD_MENU_NEW.pdf, 4 pages) → Hashtag CL00010
 *  RUN_MENU_NEW_2026_11_26  (run once from the editor):
 *    · ITEM_AR_MASTER (3D / AR product pages, menu book): name, section, description, single price
 *    · MENU_CARD_ITEMS: DESCRIPTION column (new digital menu "Know more" + item cards) — prices are NOT changed here;
 *      the log lists every price that differs from the printed menu so the owner can change it in the dashboard.
 *    · clears the AR + public-menu caches.  Rows: [itemId, name, section, price, description, multi-prices, page]
 * ===================================================================================================== */
function RUN_MENU_NEW_2026_11_26() {
  var cid = 'CL00010', rows = BNX_MENU_NEW_20261126_, log = [];
  if (typeof bnxArUpsert_ === 'function' && typeof bnxArRowsToItems_ === 'function') {
    var r = bnxArUpsert_(cid, bnxArRowsToItems_(rows.map(function (x) { return [x[0], x[1], x[2], x[3], x[4], '', '', '']; })), 'SYNC', 'FOOD_MENU_NEW_2026_11_26');
    log.push('ITEM_AR_MASTER: ' + JSON.stringify({ added: r && r.added, updated: r && r.updated }));
  } else log.push('menu-ar.gs not in this project — ITEM_AR_MASTER skipped');
  var ss = bnxPqDb_(cid, 'MASTER'), sh = ss.getSheetByName('MENU_CARD_ITEMS');
  if (sh) {
    var v = sh.getDataRange().getValues(), h = v[0].map(function (x) { return String(x || '').trim().toUpperCase(); });
    var ci = h.indexOf('ITEM_ID'), di = h.indexOf('DESCRIPTION'), pi = h.indexOf('PRICE'), ni = h.indexOf('MENU_ITEM_NAME'), cc = h.indexOf('CLIENT_ID');
    if (di < 0) { di = h.length; sh.getRange(1, di + 1).setValue('DESCRIPTION'); }
    var want = {}; rows.forEach(function (x) { want[x[0]] = x; });
    var col = [], n = 0, diffs = [];
    for (var r2 = 1; r2 < v.length; r2++) {
      var id = String(v[r2][ci] || '').trim().toUpperCase(), cur = di < v[r2].length ? v[r2][di] : '', x = want[id];
      if (x && (cc < 0 || !v[r2][cc] || String(v[r2][cc]) === cid)) {
        if (x[4] && String(cur || '').trim() !== x[4]) { cur = x[4]; n++; }
        if (x[3] && pi >= 0 && Number(v[r2][pi]) !== Number(x[3])) diffs.push(id + ' ' + (ni >= 0 ? v[r2][ni] : '') + ': sheet ' + v[r2][pi] + ' · menu ' + x[3]);
      }
      col.push([cur === undefined ? '' : cur]);
    }
    if (col.length) sh.getRange(2, di + 1, col.length, 1).setValues(col);
    log.push('MENU_CARD_ITEMS descriptions updated: ' + n);
    log.push(diffs.length ? 'PRICE DIFFERENCES (not changed — fix in dashboard if the new menu is right):\n  ' + diffs.join('\n  ') : 'Prices: all match the new menu');
  } else log.push('MENU_CARD_ITEMS tab not found in MASTER DB');
  try { if (typeof bnxArCacheClear_ === 'function') bnxArCacheClear_(cid); CacheService.getScriptCache().removeAll(['pubmenu_' + cid, 'gglanding_' + cid]); } catch (e) {}
  Logger.log(log.join('\n')); return log;
}
var BNX_MENU_NEW_20261126_ = [["ITM00433", "Greens Medley Filo Crunch", "The Hashtag Opener", 495, "Filo Roll Stuffed with Melting Veggies", "", 1],
["ITM00434", "Spanakopita Parcel", "The Hashtag Opener", 495, "Cheesy Spinach Parcel in Filo Pastry", "", 1],
["ITM00229", "Kulcha Bomb", "The Hashtag Opener", 535, "Cheese Mixture Stuffed in Mini Kulcha", "", 1],
["ITM00435", "Hash Cheese Melt from 2016", "The Hashtag Opener", 535, "Cheese Mixture, Chilli and Bell Pepper.", "", 1],
["ITM00436", "Creamy Tibetani Al Forno", "The Hashtag Opener", 445, "Classy Momo Baked with Alfredo & Bubbly Cheese Crust", "", 1],
["ITM00437", "Panecitos Enchilada", "The Hashtag Opener", 525, "Fusion Tortilla Wrap Filled with Pav Bhaji and Baked", "", 1],
["ITM00438", "Loaded Paddu Bites", "The Hashtag Opener", 475, "Bite Sized Crispy Golden Ball Served with South Indian Dip", "", 1],
["ITM00439", "Tortilla Dorado", "The Hashtag Opener", 525, "Crispy Tortilla Taco with Avocado Salsa, Green Apple & Lettuce", "", 1],
["ITM00440", "Thecha Tortilla Tartine", "The Hashtag Opener", 545, "Grilled Tortilla Pockets with Melty Farmer Cheese and Thecha", "", 1],
["ITM00442", "Togarashi Silken Edamame Hummus", "The Hashtag Opener", 545, "Peri-Peri Marinated Edamame, Marinated Green Olives, Crunchy Lotus Roots, Okra, Crispy Pita", "", 1],
["ITM00443", "Firinda Tavuk Kanat", "The Hashtag Opener", 625, "Oven Roasted Chicken Drums with BBQ Glaze", "", 1],
["ITM00444", "Murgh Rozali Kabab", "The Hashtag Opener", 625, "Cheese Chicken Mince Wrapped with Chicken Fillet & Clay Cook", "", 1],
["ITM00445", "Chicken Ghotala", "The Hashtag Opener", 595, "Mince Chicken with Western Herbs, Tossed with Thai Sauce", "", 1],
["ITM00446", "Creamy Pesto Char-chicken", "The Hashtag Opener", 625, "Chicken Supreme Wrapped with Jalapeno & Olive Tossed with Creamy Pesto", "", 1],
["ITM00447", "Velvet-spice Chilli Fillets", "The Hashtag Opener", 675, "Pan Seared Fish Tossed with Five-Spice", "", 1],
["ITM00448", "Spice Crusted Mamsam", "The Hashtag Opener", 745, "Spicy Andhra Spice Crusted Mutton", "", 1],
["ITM00449", "Gambas Al Ajillo", "The Hashtag Opener", 745, "Butter Garlic Prawn with Sriracha Aioli", "", 1],
["ITM00430", "Leafy Affaire", "Clean & Greens", 445, "Leafy Greens with Fruits Chunks and Dressing", "", 1],
["ITM00431", "Signature Greens", "Clean & Greens", "", "(Avocado / Grilled Chicken) Hashtag Special Caesar Salad", "495 / 555", 1],
["ITM01270", "Nutri-boost Tabula Salad", "Clean & Greens", 445, "High Boost Mediterranean Bulgur Salad", "", 1],
["ITM01134", "Greenpea Falafel Pockets", "Clean & Greens", 425, "Green Pea Falafel and Fresh Greens Stuffed in Warm Pita", "", 1],
["ITM01156", "Moroccan Couscous with Zesty Dressing", "Clean & Greens", 495, "Fluffy Couscous, Warm Spices and Sweet Dried Fruit Tossed in a Zesty Lemon-Olive Oil", "", 1],
["ITM01130", "Quinoa Chickpeas Veggie Bowl", "Clean & Greens", 495, "Combines Two Complete Plant-Based Proteins to Keep You Full", "", 1],
["ITM00450", "Wai Wai Bhel", "Bites & Picks", 275, "", "", 1],
["ITM00451", "Seasonal Fruit Board", "Bites & Picks", 345, "", "", 1],
["ITM00452", "Peri Peri Potato Wedges", "Bites & Picks", 295, "", "", 1],
["ITM00132", "French Fries", "Bites & Picks", "", "Classic Salted / Peri Peri / Truffle Parmesan", "295 / 295 / 345", 1],
["ITM00456", "Kurkuri Lotus Chips", "Bites & Picks", 425, "Crunchy Lotus Tossed with Peri Peri Spice", "", 1],
["ITM00457", "Chana Dry Fry", "Bites & Picks", 375, "Golden Chickpeas Tossed with Garlic Cloves, Red Chilli, Curry Leaves & Chef's Special Spice", "", 1],
["ITM00458", "Hashtag Adda Board", "Bites & Picks", 425, "Bar Mix, Sprout Salad, Flattened Chickpeas and Masala Soya Stick", "", 1],
["ITM00459", "Chicken Pops Out", "Bites & Picks", 555, "Crunchy Chicken Chunks with Spicy Aioli", "", 1],
["ITM00460", "Egg Drop Hakka", "Bites & Picks", 425, "Spicy Hakka Style Jullion Omelette & Veggies", "", 1],
["ITM00461", "Eggs your Way", "Bites & Picks", 445, "Eggs As Your Choice", "", 1],
["ITM00462", "Mexican Veggie Frank", "Filled & Folded", 515, "Multigrain Hot Dog with Homemade Mexican Greens Sausage", "", 2],
["ITM00463", "Crunch Teriyaki Glaze Panini", "Filled & Folded", 565, "Panini with Crunchy Teriyaki Glaze Chicken", "", 2],
["ITM00464", "Mediterranean Avocado Sourdough", "Filled & Folded", 535, "Sourdough Topped with Avocado, Sun-Dried Roma Tomato and Feta", "", 2],
["ITM00465", "Hashtag Special Plain / Cheese Garlic Bread", "Filled & Folded", "", "Cheese / Plain", "415 / 475", 2],
["ITM00467", "Lebanese Falafel Frankie", "Filled & Folded", 425, "Hummus, Garlic Aioli Marinated Falafel Wrapped with Tortilla", "", 2],
["ITM00468", "Zen Garden Burrito", "Filled & Folded", 495, "Wok Tossed Cheesy Greens with Grilled Tortilla", "", 2],
["ITM00469", "Kolkata Style Frankie", "Filled & Folded", "", "(Paneer / Egg / Chicken) Paneer / Chicken Bell Pepper, Onion, Mustard Sauce, Mint Chutney", "395 / 425 / 475", 2],
["ITM00486", "Truffle Avocado Crunch", "Chopstick Chasers", 575, "Creamy Avocado, Crunchy Pickled Veggies, Truffle Glaze Japanese Roll", "", 2],
["ITM00487", "Blue Pea Asparagus Roll", "Chopstick Chasers", 595, "Charred Asparagus, Cream Cheese, Blue Pea Rice Roll", "", 2],
["ITM00488", "Vegetable Tempura California", "Chopstick Chasers", 515, "Crunchy Tempura Veggies, Cheese, Japanese Roll", "", 2],
["ITM00489", "Teriyaki Tori Katsu Roll", "Chopstick Chasers", 595, "Teriyaki Chicken, Crunchy Tanuki, Japanese Roll", "", 2],
["ITM00490", "Satay Tori Peanut Glaze Roll", "Chopstick Chasers", 595, "Peanut Glaze Chicken, Japanese Rice Roll", "", 2],
["ITM00491", "Wasabi Ebi Tempura", "Chopstick Chasers", 635, "Crispy Prawn, Wasabi, Japanese Roll", "", 2],
["ITM00472", "Bbq Corn Ribs", "The Unforgettables", 495, "Chef's Special Oven-Roasted Corn Ribs Served with Garlic Aioli", "", 2],
["ITM00473", "Herb Crusted Cottage Cheese", "The Unforgettables", 535, "Thyme Infused Tandoori Charred Cottage Cheese", "", 2],
["ITM00474", "Hand-cut Masa Crisps", "The Unforgettables", 535, "Homemade Nachos Loaded with Cheese, Refried Beans & Avocado Emulsion", "", 2],
["ITM00475", "Himalayan Momo", "The Unforgettables", "", "Veg / Chicken / Jhol", "325 / 395 / 375", 2],
["ITM00478", "Cheese Firewire", "The Unforgettables", 535, "Mouth Melting Cheese Cubes Spicy Oriental Sauce", "", 2],
["ITM00479", "Hunan Glaze Silken Tofu", "The Unforgettables", 545, "Hunan Crisp Glaze Silken Tofu & Pepper", "", 2],
["ITM00480", "Tandoori Afgani Soya Chaap", "The Unforgettables", 575, "Hashtag Secret Masala, Soya Chaap Cooked in Clay Oven", "", 2],
["ITM00481", "Tangra Pepper Crust Chicken", "The Unforgettables", 595, "Pepper Crusted Crispy Chicken Glaze with Dalle, Pepper & Dark Soya Reduction", "", 2],
["ITM00482", "Artisanal Crunch Chicken Strips", "The Unforgettables", 595, "Tender Chicken Supreme with Spicy Crispy Aromatic Bites", "", 2],
["ITM00034", "Bbq Style Chicken Wings", "The Unforgettables", 595, "BBQ Marinated Chicken Wings, Tossed with BBQ Sauce, Served with Spicy Onion", "", 2],
["ITM00483", "Chicken Kalmi Kabab", "The Unforgettables", 655, "Chicken Tangri Stuffed with Lemongrass Chicken Mince", "", 2],
["ITM00484", "Kali Mire Macchi", "The Unforgettables", 655, "Tandoori Roasted Peppercorn Fish Tikka", "", 2],
["ITM00485", "Flame-grilled Fish Skewers", "The Unforgettables", 655, "Herb-Infused Fish Sticks Served with Creamy Mushy Peas", "", 2],
["ITM00492", "Broccoli Cheese Peking Jiaozi", "The Steaming Basket", 425, "Thyme, Broccoli, Cream Cheese Dumpling in Spicy Broth", "", 2],
["ITM00420", "Cream Cheese & Water Chestnut Jiaozi", "The Steaming Basket", 455, "Cream Cheese, Water Chestnut, Bell pepper", "", 2],
["ITM00494", "Spicy Edamame Jiaozi", "The Steaming Basket", 495, "Edamame, Thai Chilli, Cheese", "", 2],
["ITM00495", "Green Pocket Chicken", "The Steaming Basket", 475, "Chicken, Onion, Scallion, Bok Choy, Chilli Oil", "", 2],
["ITM00496", "Cilantro Polo Dumpling", "The Steaming Basket", 475, "Cilantro, Chicken, Scallion, Chilli Oil", "", 2],
["ITM00497", "Prawn Har Gao", "The Steaming Basket", 515, "Shrimps, Water Chestnut, Chilli Oil", "", 2],
["ITM00311", "Queen Margherita", "Dough & Fire", 595, "Tomato Sauce, Cherry Tomato, Basil, Mozzarella", "", 3],
["ITM00498", "Farmer's Delight", "Dough & Fire", 595, "Veggie, Black Olives, Red Onions, Sweet Corn, Mozzarella", "", 3],
["ITM00499", "Pesto Burrata Sourdough", "Dough & Fire", 635, "Basil Pesto, Burrata, Mozzarella, Sourdough", "", 3],
["ITM00500", "Maharaja Makhani Crust", "Dough & Fire", 595, "Makhani Gravy, Bhatti Paneer, Bell Pepper, Onion, Slice Chilli, Mozzarella", "", 3],
["ITM00501", "Tandoori Flame Classico", "Dough & Fire", 655, "Spicy Chicken Tikka, Onion, Chilli Flakes, Mozzarella", "", 3],
["ITM00502", "Tuscan Teriyaki Chicken", "Dough & Fire", 655, "Grilled Teriyaki Chicken, Cherry Tomato, Olives, Red Onion, Feta", "", 3],
["ITM00352", "Spaghetti Aglio Olio", "Wheat & Arborio", 535, "Lots of Garlic, Chilli Flakes, Parmesan, Parsley", "", 3],
["ITM00362", "Spinach & Ricotta Ravioli", "Wheat & Arborio", 595, "Homemade Ravioli with Creamy Spinach & Ricotta Tossed in Creamy Harissa Sauce", "", 3],
["ITM00503", "Smoked Ham Linguine Carbonara", "Wheat & Arborio", 625, "Creamy Carbonara with Grilled Chicken Ham and Parmesan", "", 3],
["ITM00079", "Penne / Spaghetti", "Wheat & Arborio", 535, "Arrabbiata Sauce / Alfredo Sauce / Mix Sauce / Pesto Sauce", "", 3],
["ITM00512", "Charred Broccoli & Toasted Almond Risotto", "Wheat & Arborio", 635, "Charred Broccoli, Parmesan Cheese, Toasted Almond, Arborio Rice, Fresh Herbs", "", 3],
["ITM00513", "Grilled Cottage Cheese Steak Sizzler", "Smoke & Boards", 595, "Grilled Cottage Cheese Steak Served with Creamy Pesto Sauce and Herb Rice", "", 3],
["ITM00514", "Grilled Chicken Polpette Sizzler", "Smoke & Boards", 625, "Pan Grilled Chicken Ball Cooked in Tomato Pepper Ragu Served with Pepper Rice", "", 3],
["ITM00515", "Chimichurri Chicken Steak", "Smoke & Boards", 695, "Grilled Chicken Steak Served with Veggies, Potato Beet Root Puree & Spicy Chimichurri Sauce", "", 3],
["ITM00516", "Pan Grilled Black Fillet", "Smoke & Boards", 745, "Pan Grilled Fish Fillet with Pepper Crust, Veggies, Creamy Mushy Peas & Caper Butter Sauce.", "", 3],
["ITM00517", "Hashtag Special Platter", "Smoke & Boards", 1345, "Murgh Rozali, Chicken Sausage, Chicken Salami, Grilled Fish, Tandoori Prawn & Andhra Mutton", "", 3],
["ITM00518", "Vegetable Coin", "Asian Staple", 455, "Fried Vegetable Coin In Manchurian Sauce", "", 3],
["ITM00962", "Slice Fish with Choice of your Sauce", "Asian Staple", 655, "Black Bean / Chilli Basil / Szechuan Chilli", "", 3],
["ITM00392", "Thai Curry (veg/ Chicken/ Prawn)", "Asian Staple", "", "Choose Your Curry- Green Curry / Red Curry", "625 / 655 / 775", 3],
["ITM00523", "Hakka Noodles", "Noodles & Rice", 395, "Traditional Oriental Style Noodles", "", 3],
["ITM00359", "Spicy Green Noodles", "Noodles & Rice", 455, "Noodles Tossed with Coriander & Green Chilli Paste, Exotic Veggies", "", 3],
["ITM00289", "Pad Thai Noodles", "Noodles & Rice", 455, "Seasonal Veggies Tossed with Pad Thai", "", 3],
["ITM00524", "Wok Fried Exotic Vegetable Rice", "Noodles & Rice", 395, "Rice Tossed with Exotic Vegetables", "", 3],
["ITM00525", "Nasi Goreng", "Noodles & Rice", 525, "Indonesian-Style Shrimp Aromatic Rice with Fried Egg & Satay Tori Add On:- Egg-115/- | Chicken -125/- | Prawn -145/-", "", 3],
["ITM00526", "Yellow Dal Tadka", "The Desi Soul", 465, "Traditional Yellow Dal Onion Chilli Garlic Tadka", "", 4],
["ITM00527", "Corn Palak", "The Desi Soul", 525, "Garlic Flavour Rich Spinach with Corn", "", 4],
["ITM00171", "Hashtag Special Dal Makhani", "The Desi Soul", 545, "Black Lentil, Butter, Cream, Cooked Overnight", "", 4],
["ITM00528", "Dhaba Style Tadka", "The Desi Soul", 525, "Mix Lentil Tadka Combination with Dhaba Flavour", "", 4],
["ITM00291", "Paneer", "The Desi Soul", 595, "Choose Your Gravy:- Butter Masala / Kadhai / Do-Pyaza / Lababdar", "", 4],
["ITM00532", "Chicken", "The Desi Soul", 655, "Choose Your Gravy:- Kasa / Do-Pyaza / Bharta /Butter Chicken", "", 4],
["ITM00536", "Mutton Rogan Josh", "The Desi Soul", 745, "Mutton, Indian Spice, Rich Gravy", "", 4],
["ITM00116", "Dil Bahar Subz Dum Biryani", "The Desi Soul", 495, "Exotics Veg Dum Biryani Served with Raita", "", 4],
["ITM00537", "Hyderabadi Murgh Dum Biryani", "The Desi Soul", 595, "Flavoured Basmati Rice, Indian Spice Roasted Chicken, Served with Raita", "", 4],
["ITM00538", "Gosht Dum Biryani", "The Desi Soul", 655, "Flavoured Basmati Rice, Indian Spice Slow Cooked Lamb, Served with Raita", "", 4],
["ITM00385", "Tandoori Roti", "Clay & Grain", 95, "", "", 4],
["ITM00539", "Butter Naan / Garlic Naan / Cheese Garlic Naan", "Clay & Grain", "", "", "115 / 115 / 125", 4],
["ITM09044", "Masala Kulcha / Onion Kulcha", "Clay & Grain", 145, "", "", 4],
["ITM00544", "Laccha Paratha", "Clay & Grain", 145, "", "", 4],
["ITM00545", "Steamed Rice", "Clay & Grain", 275, "", "", 4],
["ITM00205", "Jeera Rice", "Clay & Grain", 295, "", "", 4],
["ITM00546", "Melting Chocolate Sphere", "Sweet Indulgence", 795, "Melting Ball with Surprising Choco Caramel Fantasy", "", 4],
["ITM00547", "Nutty Caramel Mille Feuill Melt", "Sweet Indulgence", 475, "Crispy French Dessert with Melting Nutty Caramel", "", 4],
["ITM00548", "Sizzling Choco Kunafa Fudge Brownie", "Sweet Indulgence", 495, "Crunchy Kunafa Brownie Served with Vanilla Ice Cream", "", 4],
["ITM00549", "Entremet Trio", "Sweet Indulgence", 475, "Trio of Chocolate Layered Silky Pastries", "", 4],
["ITM00550", "Mascarpone & Cocoa Cloud", "Sweet Indulgence", 515, "Mascarpone Cheese, Espresso, Ladyfinger Biscuits", "", 4],
["ITM00551", "Biscoff Silk Cheesecake", "Sweet Indulgence", 545, "Delicate Cheesecake Made with Philadelphia Cheese Topped with Lotus Biscoff Glaze", "", 4]];


/* =====================================================================================================
 *  2026-11-26 "TIMING SHOWN WRONG" (Guest CRM visits log showed 27-11 08:08 for a visit at 26-11 18:38 — +13:30)
 *  Cause: the apps write times as IST text ("2026-11-26 18:38:35"); Google Sheets turns that text into a date in the
 *  SPREADSHEET's own time zone. Client databases created with the default zone (America/Los_Angeles, UTC−8) hold
 *  18:38 LA; reading it back in the script zone (IST) gave 08:08 next day. Fix for every client: read dates in the
 *  zone of the spreadsheet they live in — the same wall-clock time that was written and that the sheet shows.
 *  RUN_TZ_REPORT_ALL_CLIENTS: lists each client database and its zone (read-only, changes nothing).
 * ===================================================================================================== */
function bnxSheetTz_(sh) {
  try { var ss = sh && sh.getParent ? sh.getParent() : null, z = ss && ss.getSpreadsheetTimeZone ? ss.getSpreadsheetTimeZone() : ''; if (z) return z; } catch (e) {}
  return Session.getScriptTimeZone() || 'Asia/Kolkata';
}
function RUN_TZ_REPORT_ALL_CLIENTS() {
  var out = [], ids = [];
  try { var reg = bnxControlSheet_(CLIENT_DB_REGISTRY_TAB).getDataRange().getValues(), h = reg[0].map(function (x) { return String(x).trim().toUpperCase(); }), ci = h.indexOf('CLIENT_ID');
    for (var r = 1; r < reg.length; r++) { var c = String(reg[r][ci] || '').trim(); if (c && ids.indexOf(c) < 0) ids.push(c); } } catch (e) { out.push('registry: ' + e.message); }
  ids.forEach(function (cid) { ['MASTER', 'TRANSACTION'].forEach(function (k) {
    try { var ss = bnxPqDb_(cid, k), z = ss.getSpreadsheetTimeZone(); out.push(cid + ' ' + k + ': ' + z + (z === 'Asia/Kolkata' ? '' : '   ← not IST (times still show right after this fix)')); }
    catch (e) { out.push(cid + ' ' + k + ': ' + e.message); } }); });
  Logger.log(out.join('\n')); return out;
}

/* =====================================================================================================
 *  2026-11-26 AUTO WHATSAPP — invoice after the bill · order confirmation · menu button (all clients)
 *  · SAVE_BILL (POS / dashboard) with a guest mobile  → invoice PDF on WhatsApp (same lines as the printed bill)
 *  · SAVE_ORDER from the guest QR page (or every order with a mobile, if switched on) → "Order confirmed" + items
 *  · every message carries a "View menu" button (restaurant-menu.html of that outlet)
 *  How it sends (Meta rules): inside the 24-h chat window (guest checked in on WhatsApp) → free message + PDF;
 *  outside it → the approved UTILITY templates bnx_bill_receipt / bnx_order_confirmed (one tap in Growth Hub ›
 *  Settings › Auto WhatsApp › "Create templates"). Nothing slows the bill: the job is queued (Script properties
 *  WAQ_*) and sent by bnxWaAutoTick (every minute, RUN_WA_AUTO_SETUP or the Growth Hub button).
 *  Log: TRANSACTION DB › WA_AUTO_LOG.   Settings: Script property WA_AUTO_<client> (JSON).
 * ===================================================================================================== */
var BNX_WAA_DEF = { bill: true, order: true, orderAll: false, pdf: true, billTpl: 'bnx_bill_receipt', orderTpl: 'bnx_order_confirmed', lang: 'en' };
var BNX_WAA_LOGH = ['AT', 'KIND', 'REF', 'MOBILE', 'NAME', 'AMOUNT', 'VIA', 'STATUS', 'ERROR', 'MSG_ID'];
function bnxWaaCfg_(cid) { var o = {}; try { o = JSON.parse(PropertiesService.getScriptProperties().getProperty('WA_AUTO_' + cid) || '{}') || {}; } catch (e) {} return Object.assign({}, BNX_WAA_DEF, o); }
function bnxWaaMob_(v) { var d = String(v || '').replace(/\D/g, ''); if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2); d = d.slice(-10); return /^[6-9]\d{9}$/.test(d) ? d : ''; }
function bnxWaaRs_(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function bnxWaaEsc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* called by the router right after the ERP answered SAVE_BILL / SAVE_ORDER — only queues (≈30 ms) */
function bnxWaAutoHook_(action, p, resp) {
  var j = null; try { j = JSON.parse(resp.getContent()); } catch (e) { return; }
  if (!j || j.success === false) return;
  var cid = String(p.clientId || '').trim(); if (!/^[A-Za-z0-9_-]{3,30}$/.test(cid)) return;
  var cfg = bnxWaaCfg_(cid), d = j.data || {}, job = null;
  if (action === 'SAVE_BILL') {
    var b = p.bill || {}, mob = bnxWaaMob_(b.mob || b.mobile || b.customerMobile); if (!cfg.bill || !mob) return;
    if (/^(NC|Complimentary)$/i.test(String(b.pay || '')) || !(Number(b.total) > 0)) return;
    var no = String(d.BILL_NUMBER || j.billNo || j.serverId || d.BILL_ID || p.requestId || '').slice(0, 40); if (!no) return;
    job = { k: 'BILL', cid: cid, mob: mob, name: String(b.customer || '').replace(/GENERAL CUSTOMER/i, '').slice(0, 60), ref: no, total: Number(b.total) || 0,
      table: String(b.table || ''), dt: String(b.dt || ''), tm: String(b.tm || ''), pay: String(b.pay || ''), sub: +b.sub || 0, disc: +b.disc || 0, cgst: +b.cgst || 0, sgst: +b.sgst || 0,
      sc: +b.sc || 0, ro: +b.roundOff || 0, waiter: String(b.waiter || '').slice(0, 40),
      items: (b.itemsDetail || []).slice(0, 60).map(function (i) { return [String(i.name || '').slice(0, 60), +i.qty || 0, +(i.rate || i.price) || 0, +(i.line || i.amount) || 0]; }) };
  } else if (action === 'SAVE_ORDER') {
    var mob2 = bnxWaaMob_(p.mobileNo || p.customerMobile || p.CUSTOMER_MOBILE); if (!cfg.order || !mob2) return;
    if (!cfg.orderAll && String(p.orderSource || '').toUpperCase() !== 'CUSTOMER') return;
    var on = String(j.orderNo || d.ORDER_NO || d.ORDER_ID || p.requestId || '').slice(0, 40); if (!on) return;
    job = { k: 'ORDER', cid: cid, mob: mob2, name: String(p.customerName || '').replace(/^Guest$/i, '').slice(0, 60), ref: on, total: Number(p.billAmount || j.grandTotal || d.GRAND_TOTAL) || 0,
      table: String(p.tableId || ''), items: (p.items || []).slice(0, 40).map(function (i) { var q = +(i.qty || i.QUANTITY) || 0, r = +(i.rate || i.price || i.RATE) || 0; return [String(i.name || i.ITEM_NAME || '').slice(0, 60), q, r, q * r]; }) };
  }
  if (!job) return;
  var key = 'WAQ_' + cid + '_' + job.k.charAt(0) + '_' + job.ref.replace(/[^A-Za-z0-9_-]/g, '');
  try { if (CacheService.getScriptCache().get('wasent_' + key)) return; } catch (e) {}
  job.at = Date.now(); job.tries = 0;
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(job).slice(0, 8500));
}

function bnxWaaLog_(cid, o) {
  try { var ss = bnxPqDb_(cid, 'TRANSACTION'), sh = ss.getSheetByName('WA_AUTO_LOG');
    if (!sh) { sh = ss.insertSheet('WA_AUTO_LOG'); sh.getRange(1, 1, 1, BNX_WAA_LOGH.length).setValues([BNX_WAA_LOGH]); sh.setFrozenRows(1); }
    sh.appendRow(BNX_WAA_LOGH.map(function (k) { return o[k] === undefined ? '' : String(o[k]).slice(0, 300); })); } catch (e) {}
}
function bnxWaaProp_(cid, k) { return typeof bnxGgProp_ === 'function' ? bnxGgProp_(k, cid) : PropertiesService.getScriptProperties().getProperty(k + '_' + cid) || PropertiesService.getScriptProperties().getProperty(k); }
function bnxWaaInfo_(cid) {
  var i = {}; try { i = bnxGgLanding_(cid).info || {}; } catch (e) {}
  var x = {}; try { x = bnxLandingInfoX_(cid); } catch (e) {}
  var site = ''; try { site = typeof bnxGgSite_ === 'function' ? bnxGgSite_(cid) : ''; } catch (e) {}
  return { name: String(i.name || bnxWaaProp_(cid, 'RESTAURANT_NAME') || ''), address: String(i.address || ''), phone: String(i.phone || ''), gstin: x.gstin || '', fssai: x.fssai || '',
    legal: x.legalName || '', menu: site ? site + 'restaurant-menu.html?client=' + encodeURIComponent(cid) : '' };
}
/* the invoice — same lines as the printed bill (A5-like, black & white, prints well) */
function bnxWaaInvoiceHtml_(job, inf) {
  var e = bnxWaaEsc_, rows = job.items.map(function (r, n) { return '<tr><td>' + (n + 1) + '</td><td>' + e(r[0]) + '</td><td class="r">' + r[1] + '</td><td class="r">' + r[2].toFixed(2) + '</td><td class="r">' + r[3].toFixed(2) + '</td></tr>'; }).join('');
  var line = function (l, v, b) { return v ? '<tr' + (b ? ' class="t"' : '') + '><td colspan="4" class="r">' + l + '</td><td class="r">' + (typeof v === 'number' ? v.toFixed(2) : e(v)) + '</td></tr>' : ''; };
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;margin:22px}h1{font-size:18px;margin:0;text-align:center;letter-spacing:.5px}'
    + '.c{text-align:center;color:#333;margin:2px 0}.box{border-top:1px dashed #555;border-bottom:1px dashed #555;margin:10px 0}'
    + 'table{width:100%;border-collapse:collapse}th{border-bottom:1px solid #111;text-align:left;padding:4px 3px;font-size:10.5px}td{padding:3px;font-size:11px}td.r,th.r{text-align:right}tr.t td{font-weight:bold;font-size:13px;border-top:1px solid #111}'
    + '.f{text-align:center;margin-top:14px;color:#333}.tag{display:inline-block;border:1px solid #111;padding:2px 8px;font-weight:bold;margin-top:6px}</style></head><body>'
    + '<h1>' + e(inf.name || 'Tax Invoice') + '</h1>' + (inf.legal && inf.legal !== inf.name ? '<div class="c">' + e(inf.legal) + '</div>' : '') + (inf.address ? '<div class="c">' + e(inf.address) + '</div>' : '')
    + '<div class="c">' + [inf.phone ? 'Ph ' + e(inf.phone) : '', inf.gstin ? 'GSTIN ' + e(inf.gstin) : '', inf.fssai ? 'FSSAI ' + e(inf.fssai) : ''].filter(String).join(' · ') + '</div>'
    + '<div class="c"><span class="tag">TAX INVOICE</span></div>'
    + '<table class="box"><tr><td>Bill No: <b>' + e(job.ref) + '</b><br>Date: ' + e(job.dt) + ' ' + e(job.tm) + '</td><td class="r">' + (job.table ? 'Table: <b>' + e(job.table) + '</b><br>' : '') + (job.name ? 'Guest: ' + e(job.name) + '<br>' : '') + (job.waiter ? 'Steward: ' + e(job.waiter) : '') + '</td></tr></table>'
    + '<table><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>' + rows
    + line('Sub total', job.sub) + line('Discount', job.disc ? -job.disc : 0) + line('Service charge', job.sc) + line('CGST', job.cgst) + line('SGST', job.sgst) + line('Round off', job.ro) + line('GRAND TOTAL ₹', job.total, true) + '</table>'
    + '<div class="f">Paid by ' + e(job.pay || '—') + '<br><br>Thank you for dining with us!' + (inf.menu ? '<br>Menu: ' + e(inf.menu) : '') + '<br><span style="font-size:9px;color:#777">Computer generated invoice · Balaji NextGen ERP</span></div></body></html>';
}
function bnxWaaSendDoc_(cid, mob, blob, caption) {
  var token = bnxWaaProp_(cid, 'META_WA_TOKEN'), pid = String(bnxWaaProp_(cid, 'META_WA_PHONE_ID') || '').trim(), ver = bnxWaaProp_(cid, 'META_WA_VERSION') || 'v20.0';
  if (!token || !/^\d{8,25}$/.test(pid)) return { sent: false, error: 'WhatsApp Cloud API not configured' };
  var base = 'https://graph.facebook.com/' + ver + '/' + pid, H = { Authorization: 'Bearer ' + token };
  var up = {}; try { up = JSON.parse(UrlFetchApp.fetch(base + '/media', { method: 'post', headers: H, muteHttpExceptions: true, payload: { messaging_product: 'whatsapp', type: 'application/pdf', file: blob } }).getContentText()); } catch (e) {}
  if (!up.id) return { sent: false, error: (up.error && up.error.message) || 'PDF upload failed' };
  var r = UrlFetchApp.fetch(base + '/messages', { method: 'post', headers: H, contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ messaging_product: 'whatsapp', to: '91' + mob, type: 'document', document: { id: up.id, filename: blob.getName(), caption: String(caption).slice(0, 1000) } }) });
  var j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
  if (j.messages && j.messages.length) return { sent: true, id: j.messages[0].id };
  return { sent: false, error: String((j.error && (j.error.error_data && j.error.error_data.details || j.error.message)) || 'Meta HTTP ' + r.getResponseCode()).slice(0, 300), code: j.error && j.error.code };
}
function bnxWaaWindowClosed_(r) { return !r.sent && (r.code == 131047 || /24 ?h|re-?engage|outside.*window/i.test(r.error || '')); }

function bnxWaaSend_(job) {
  var cid = job.cid, cfg = bnxWaaCfg_(cid), inf = bnxWaaInfo_(cid), first = String(job.name || '').trim().split(/\s+/)[0] || '', r = { sent: false }, via = 'SESSION';
  if (typeof bnxGgWaSend_ !== 'function') return { sent: false, error: 'Guest growth suite.gs not in this project' };
  var list = job.items.slice(0, 25).map(function (i) { return i[1] + ' × ' + i[0] + ' — ' + bnxWaaRs_(i[3]); }).join('\n') + (job.items.length > 25 ? '\n+ ' + (job.items.length - 25) + ' more' : '');
  var cta = function (body) {
    if (!inf.menu) return bnxGgWaSend_(cid, job.mob, { type: 'text', text: { body: body.slice(0, 4000) } });
    return bnxGgWaSend_(cid, job.mob, { type: 'interactive', interactive: { type: 'cta_url', body: { text: body.slice(0, 1024) }, footer: { text: 'Powered by Balaji NextGen' }, action: { name: 'cta_url', parameters: { display_text: 'View menu', url: inf.menu } } } });
  };
  if (job.k === 'ORDER') {
    var body = '✅ *Order confirmed*' + (inf.name ? ' · ' + inf.name : '') + '\n\n' + (first ? 'Hi ' + first + ', t' : 'T') + 'hank you! The kitchen has your order.\nOrder *' + job.ref + '*' + (job.table ? ' · Table ' + job.table : '') + '\n\n' + list + '\n\n*Total ' + bnxWaaRs_(job.total) + '*\nWe will serve it shortly.';
    r = cta(body);
    if (bnxWaaWindowClosed_(r) && cfg.orderTpl) { via = 'TEMPLATE'; try { var t = bnxGgSendTemplate_(cid, job.mob, cfg.orderTpl, cfg.lang, [first || 'Guest', job.ref, inf.name || 'our restaurant', job.items.map(function (i) { return i[1] + ' x ' + i[0]; }).join(', ').slice(0, 500), Number(job.total).toFixed(2)]); r = { sent: true, id: t.slice(3) }; } catch (e) { r = { sent: false, error: String(e.message || e) }; } }
  } else {
    var cap = '🧾 *Invoice ' + job.ref + '*' + (inf.name ? ' · ' + inf.name : '') + '\nTotal *' + bnxWaaRs_(job.total) + '*' + (job.pay ? ' · ' + job.pay : '') + '\n\n' + (first ? 'Thank you, ' + first + '! ' : 'Thank you! ') + 'We hope you enjoyed your meal.' + (inf.menu ? '\nMenu: ' + inf.menu : '');
    if (cfg.pdf) { try { var blob = Utilities.newBlob(bnxWaaInvoiceHtml_(job, inf), 'text/html', 'inv.html').getAs('application/pdf').setName('Invoice-' + String(job.ref).replace(/[^A-Za-z0-9-]/g, '_') + '.pdf'); r = bnxWaaSendDoc_(cid, job.mob, blob, cap); } catch (e) { r = { sent: false, error: 'PDF: ' + e.message }; } }
    if (!r.sent && !bnxWaaWindowClosed_(r)) r = cta(cap.replace(/\nMenu: .*$/, '') + '\n\n' + list);
    if (bnxWaaWindowClosed_(r) && cfg.billTpl) { via = 'TEMPLATE'; try { var t2 = bnxGgSendTemplate_(cid, job.mob, cfg.billTpl, cfg.lang, [first || 'Guest', inf.name || 'our restaurant', job.ref, Number(job.total).toFixed(2), job.dt || '-']); r = { sent: true, id: t2.slice(3) }; } catch (e2) { r = { sent: false, error: String(e2.message || e2) }; } }
  }
  r.via = via; return r;
}

function bnxWaAutoTick() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  var t0 = Date.now(), P = PropertiesService.getScriptProperties(), all, n = 0;
  try {
    all = P.getProperties();
    Object.keys(all).filter(function (k) { return k.indexOf('WAQ_') === 0; }).sort(function (a, b) { return String(all[a]).length - String(all[b]).length; }).forEach(function (k) {
      if (Date.now() - t0 > 240000 || n >= 40) return; n++;
      var job = null; try { job = JSON.parse(all[k]); } catch (e) { P.deleteProperty(k); return; }
      if (Date.now() - (job.at || 0) > 12 * 3600e3) { P.deleteProperty(k); bnxWaaLog_(job.cid, { AT: new Date(), KIND: job.k, REF: job.ref, MOBILE: job.mob, STATUS: 'DROPPED', ERROR: 'older than 12 h' }); return; }
      var r; try { r = bnxWaaSend_(job); } catch (e) { r = { sent: false, error: String(e.message || e) }; }
      if (r.sent || ++job.tries >= 3 || /not configured|not in this project|Template name missing/i.test(r.error || '')) {
        P.deleteProperty(k); try { CacheService.getScriptCache().put('wasent_' + k, '1', 21600); } catch (e) {}
        bnxWaaLog_(job.cid, { AT: new Date(), KIND: job.k, REF: job.ref, MOBILE: job.mob, NAME: job.name, AMOUNT: job.total, VIA: r.via || '', STATUS: r.sent ? 'SENT' : 'FAILED', ERROR: r.error || '', MSG_ID: r.id || '' });
      } else P.setProperty(k, JSON.stringify(job));
    });
  } finally { lock.releaseLock(); }
}
function RUN_WA_AUTO_SETUP() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'bnxWaAutoTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('bnxWaAutoTick').timeBased().everyMinutes(1).create();
  Logger.log('✅ bnxWaAutoTick runs every minute — invoices and order confirmations go out within ~1 minute.');
}

/* Growth Hub › Settings › Auto WhatsApp */
function bnxWaAutoAction_(s, p, op) {
  var cid = String(s.CLIENT_ID || ''), P = PropertiesService.getScriptProperties(), cfg = bnxWaaCfg_(cid);
  var boss = /OWNER|ADMIN|SUPER|DEVELOPER|MANAGER/i.test(String(s.ROLE || ''));
  if (op === 'GET') {
    var out = { cfg: cfg, trigger: false, templates: [], log: [], queued: 0, menu: bnxWaaInfo_(cid).menu, api: !!(bnxWaaProp_(cid, 'META_WA_TOKEN') && bnxWaaProp_(cid, 'META_WA_PHONE_ID')) };
    try { out.trigger = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'bnxWaAutoTick'; }); } catch (e) {}
    try { if (typeof bnxGgTemplatesAll_ === 'function') { var tl = bnxGgTemplatesAll_(cid); if (tl.success) out.templates = tl.data.filter(function (t) { return t.name === cfg.billTpl || t.name === cfg.orderTpl; }).map(function (t) { return { name: t.name, status: t.status, reason: t.reason }; }); else out.tplError = tl.error; } } catch (e) {}
    try { out.queued = Object.keys(P.getProperties()).filter(function (k) { return k.indexOf('WAQ_' + cid + '_') === 0; }).length; } catch (e) {}
    /* 2026-11-26 "test sent but nothing on the phone": Meta accepting a message ≠ delivered. Delivery ticks come back on the
       webhook (WA_WEBHOOK_LOG, status:sent/delivered/read/failed + error) → shown per message; plus the last guest message
       received (if "hi" never arrives here, the webhook is not connected — so no auto reply either). */
    var st = {}; out.inbound = null;
    try { var wl = bnxPqDb_(cid, 'TRANSACTION').getSheetByName('WA_WEBHOOK_LOG');
      if (wl && wl.getLastRow() > 1) { var wn = Math.min(400, wl.getLastRow() - 1), wv = wl.getRange(wl.getLastRow() - wn + 1, 1, wn, 6).getValues();
        wv.forEach(function (r) { var ty = String(r[3] || '');
          if (/^status:/.test(ty)) { try { var js = JSON.parse(r[5]); var er = js.errors && js.errors[0]; st[js.id] = { s: ty.slice(7), e: er ? (er.code + ' ' + (er.title || er.message || '') + (er.error_data && er.error_data.details ? ' — ' + er.error_data.details : '')) : '' }; } catch (e) {} }
          else if (ty) out.inbound = { at: r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Kolkata', 'dd-MM HH:mm') : String(r[0]).slice(5, 16), from: String(r[2]).replace(/^(\d{4})\d{5}/, '$1xxxxx'), text: String(r[4]).slice(0, 40) }; });
      }
      out.hookLast = bnxWaaProp_(cid, 'WA_WEBHOOK_LAST_AT') || '';
    } catch (e) {}
    try { var sh = bnxPqDb_(cid, 'TRANSACTION').getSheetByName('WA_AUTO_LOG'); if (sh && sh.getLastRow() > 1) { var n = Math.min(30, sh.getLastRow() - 1), v = sh.getRange(sh.getLastRow() - n + 1, 1, n, BNX_WAA_LOGH.length).getValues();
      out.log = v.reverse().map(function (r) { var o = {}; BNX_WAA_LOGH.forEach(function (k, i) { o[k] = r[i] instanceof Date ? Utilities.formatDate(r[i], 'Asia/Kolkata', 'dd-MM HH:mm') : r[i]; }); o.MOBILE = String(o.MOBILE).replace(/^(\d{2})\d{5}/, '$1xxxxx'); var d0 = st[String(o.MSG_ID || '')]; if (d0) { o.DELIVERY = d0.s; if (d0.e) o.ERROR = d0.e; } else if (o.STATUS === 'SENT') o.DELIVERY = 'no tick yet'; return o; }); } } catch (e) {}
    return { success: true, data: out };
  }
  if (!boss) return { success: false, error: 'Only owner / admin / manager can change this' };
  if (op === 'SAVE') {
    var x = p.cfg || {}, o = {};
    ['bill', 'order', 'orderAll', 'pdf'].forEach(function (k) { o[k] = x[k] === true || x[k] === 'true'; });
    ['billTpl', 'orderTpl'].forEach(function (k) { var v = String(x[k] || BNX_WAA_DEF[k]).trim().toLowerCase(); o[k] = /^[a-z0-9_]{1,100}$/.test(v) ? v : BNX_WAA_DEF[k]; });
    o.lang = /^[a-z]{2}(_[A-Z]{2})?$/.test(String(x.lang || '')) ? x.lang : 'en';
    P.setProperty('WA_AUTO_' + cid, JSON.stringify(o));
    if (p.trigger) { try { RUN_WA_AUTO_SETUP(); } catch (e) { return { success: true, data: o, warning: 'Saved, but the 1-minute sender could not be switched on here — run RUN_WA_AUTO_SETUP once in Apps Script (' + e.message + ')' }; } }
    return { success: true, data: o };
  }
  if (op === 'TEMPLATES') {
    if (typeof bnxGgTemplateCreate_ !== 'function') return { success: false, error: 'Guest growth suite.gs not in this project' };
    var menu = bnxWaaInfo_(cid).menu, res = [];
    var mk = function (b) { if (menu) { b.buttonUrl = menu; b.buttonText = 'View menu'; } var r = bnxGgTemplateCreate_(cid, b); res.push(b.name + ': ' + (r.success ? (r.data.status || 'PENDING') : r.error)); };
    mk({ name: cfg.billTpl, category: 'UTILITY', lang: cfg.lang, header: 'Your invoice',
      body: 'Hi {{1}}, thank you for dining at {{2}}. Your bill {{3}} for Rs {{4}} dated {{5}} has been generated. Reply to this message to get the invoice PDF.',
      examples: ['Rahul', 'Hashtag Siliguri', 'INV-1024', '1,245.00', '26-11-2026'], footer: 'Thank you · see you again' });
    mk({ name: cfg.orderTpl, category: 'UTILITY', lang: cfg.lang, header: 'Order confirmed',
      body: 'Hi {{1}}, your order {{2}} at {{3}} is confirmed. Items: {{4}}. Total Rs {{5}}. Our kitchen is preparing it now.',
      examples: ['Rahul', 'ORD-512', 'Hashtag Siliguri', '2 x Paneer Tikka, 1 x Fresh Lime Soda', '845.00'], footer: 'We will serve it shortly' });
    return { success: true, data: res };
  }
  if (op === 'TEST') {
    var m = bnxWaaMob_(p.mobile); if (!m) return { success: false, error: 'Enter a valid 10-digit mobile' };
    var job = { k: String(p.kind || 'BILL').toUpperCase() === 'ORDER' ? 'ORDER' : 'BILL', cid: cid, mob: m, name: String(s.FULL_NAME || 'Guest'), ref: 'TEST-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'HHmmss'),
      total: 845, table: '5', dt: Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy'), tm: Utilities.formatDate(new Date(), 'Asia/Kolkata', 'hh:mm a'), pay: 'UPI',
      sub: 760, disc: 0, cgst: 19, sgst: 19, sc: 47, ro: 0, waiter: '', items: [['Paneer Tikka', 2, 280, 560], ['Fresh Lime Soda', 2, 100, 200]] };
    var r = bnxWaaSend_(job);
    bnxWaaLog_(cid, { AT: new Date(), KIND: job.k + ' TEST', REF: job.ref, MOBILE: m, NAME: job.name, AMOUNT: job.total, VIA: r.via, STATUS: r.sent ? 'SENT' : 'FAILED', ERROR: r.error || '', MSG_ID: r.id || '' });
    return r.sent ? { success: true, data: { via: r.via, id: r.id } } : { success: false, error: r.error || 'Not sent', via: r.via };
  }
  return { success: false, error: 'Unknown operation' };
}

/* =====================================================================================================
 *  2026-11-27 "DSR not shown" (25-11 = 0 but MTD has 41.9 lakh) — RUN_DIAG_BILLS (read-only, changes nothing)
 *  For each of the last 12 days: bills by BILL_DATE · by BUSINESS_DATE · by the real clock time they were saved
 *  (CREATED_AT / BILL_TIME), with ₹ totals; plus ORDER_MASTER and the business-day register. If bills of 24–26 Nov
 *  sit under 23 Nov, the day was never closed / started, and the POS kept stamping the old business day.
 *  Change CID below for another client. Run → View › Logs → send the screenshot.
 * ===================================================================================================== */
function RUN_DIAG_BILLS() {
  var CID = 'CL00010', out = [], ss = bnxPqDb_(CID, 'TRANSACTION'), tz = ss.getSpreadsheetTimeZone();
  var day = function (v) { if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd'); var s = String(v || '').trim(), m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0]; m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : ''; };
  var lim = Utilities.formatDate(new Date(Date.now() - 12 * 864e5), tz, 'yyyy-MM-dd');
  out.push('Client ' + CID + ' · TRANSACTION DB "' + ss.getName() + '" · sheet time zone ' + tz);
  [['BILL_MASTER', ['BILL_DATE', 'BUSINESS_DATE', 'CREATED_AT', 'BILL_TIME', 'UPDATED_AT'], 'GRAND_TOTAL'], ['ORDER_MASTER', ['ORDER_DATE', 'BUSINESS_DATE', 'CREATED_AT'], 'GRAND_TOTAL']].forEach(function (cfg) {
    var sh = ss.getSheetByName(cfg[0]); if (!sh) { out.push(cfg[0] + ': sheet not found'); return; }
    var last = sh.getLastRow(), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim().toUpperCase(); });
    out.push('\n' + cfg[0] + ': ' + (last - 1) + ' rows · columns used: ' + cfg[1].filter(function (k) { return h.indexOf(k) >= 0; }).join(', '));
    var n = Math.min(6000, last - 1); if (n < 1) return;
    var v = sh.getRange(last - n + 1, 1, n, h.length).getValues(), ti = h.indexOf(cfg[2]), ci = h.indexOf('CLIENT_ID'), cnt = {};
    v.forEach(function (r) { if (ci >= 0 && r[ci] && String(r[ci]) !== CID) return;
      cfg[1].forEach(function (k) { var i = h.indexOf(k); if (i < 0) return; var d = day(r[i]); if (!d || d < lim) return; var key = d + '|' + k; cnt[key] = cnt[key] || [0, 0]; cnt[key][0]++; cnt[key][1] += Number(r[ti]) || 0; }); });
    var days = {}; Object.keys(cnt).forEach(function (k) { days[k.split('|')[0]] = 1; });
    Object.keys(days).sort().forEach(function (d) { out.push('  ' + d + '  ' + cfg[1].filter(function (k) { return h.indexOf(k) >= 0; }).map(function (k) { var c = cnt[d + '|' + k]; return k + ': ' + (c ? c[0] + ' (₹' + Math.round(c[1]) + ')' : '0'); }).join('  ·  ')); });
    out.push('  last row: ' + JSON.stringify(cfg[1].reduce(function (o, k) { var i = h.indexOf(k); if (i >= 0) o[k] = String(v[v.length - 1][i]); return o; }, {})));
  });
  ['BUSINESS_DAY', 'DAY_MASTER', 'DAY_STATUS', 'BUSINESS_DAYS'].forEach(function (t) { var sh = ss.getSheetByName(t); if (sh && sh.getLastRow() > 1) { var n = Math.min(5, sh.getLastRow() - 1); out.push('\n' + t + ' (last ' + n + '): ' + JSON.stringify(sh.getRange(1, 1, 1, Math.min(8, sh.getLastColumn())).getValues()[0]));
    sh.getRange(sh.getLastRow() - n + 1, 1, n, Math.min(8, sh.getLastColumn())).getValues().forEach(function (r) { out.push('  ' + r.map(function (x) { return x instanceof Date ? Utilities.formatDate(x, tz, 'yyyy-MM-dd HH:mm') : x; }).join(' | ')); }); } });
  Logger.log(out.join('\n')); return out;
}


/* =====================================================================================================
 *  2026-11-27 AR PLATES — owner sets the vessel per dish (item-ar.html, while logged in)
 *  Script property ARPLATE_<client> = { ITEMID: { k: plate|bowl|glass|board|dessert|thali, s: white|black|wood|steel,
 *  cm: 12–40, z: photo zoom 1–2, x / y: photo offset -0.3…0.3 } }. MENU_AR (one item / catalogue) answers with
 *  item.plate = that object, so every phone shows the dish the way the owner set it.
 * ===================================================================================================== */
var BNX_ARP_K = ['plate', 'bowl', 'glass', 'board', 'dessert', 'thali'], BNX_ARP_S = ['white', 'black', 'wood', 'steel'];
function bnxArPlates_(cid) {
  var ck = 'arplate_' + cid, c = CacheService.getScriptCache(), v = c.get(ck);
  if (v == null) { v = PropertiesService.getScriptProperties().getProperty('ARPLATE_' + cid) || '{}'; try { c.put(ck, v, 600); } catch (e) {} }
  try { return JSON.parse(v) || {}; } catch (e) { return {}; }
}
function bnxArPlateSave_(s, p) {
  if (!/OWNER|ADMIN|SUPER|DEVELOPER|MANAGER/i.test(String(s.ROLE || ''))) return { success: false, error: 'Only owner / admin / manager can set the plate' };
  var cid = String(s.CLIENT_ID || ''), id = String(p.itemId || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,40}$/.test(id)) return { success: false, error: 'Item id missing' };
  var lock = LockService.getScriptLock(); if (!lock.tryLock(15000)) return { success: false, error: 'Server busy — try again' };
  try {
    var P = PropertiesService.getScriptProperties(), all = {}; try { all = JSON.parse(P.getProperty('ARPLATE_' + cid) || '{}') || {}; } catch (e) {}
    if (p.clear) delete all[id];
    else {
      var x = p.plate || {}, cl = function (n, a, b, d) { n = Number(n); return isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
      all[id] = { k: BNX_ARP_K.indexOf(x.k) >= 0 ? x.k : 'plate', s: BNX_ARP_S.indexOf(x.s) >= 0 ? x.s : 'white', cm: Math.round(cl(x.cm, 5, 40, 26)),
        z: Math.round(cl(x.z, 1, 2, 1.15) * 100) / 100, x: Math.round(cl(x.x, -0.3, 0.3, 0) * 100) / 100, y: Math.round(cl(x.y, -0.3, 0.3, 0) * 100) / 100, by: String(s.USER_ID || ''), at: new Date().toISOString() };
    }
    var js = JSON.stringify(all); if (js.length > 8500) return { success: false, error: 'Too many dish plate settings saved (limit reached)' };
    P.setProperty('ARPLATE_' + cid, js); try { CacheService.getScriptCache().remove('arplate_' + cid); } catch (e) {}
    return { success: true, data: all[id] || null };
  } finally { lock.releaseLock(); }
}
/* adds the owner's plate setting (it.plate) to MENU_AR answers — called at both MENU_AR entry points
   (not a wrapper: bnxMenuArPublic_ lives in another file and file load order is not guaranteed) */
function bnxArWithPlates_(r, p) {
  try { if (r && r.success && r.data) { var cid = String(r.data.clientId || (p && (p.clientId || p.c)) || '').toUpperCase(), pl = bnxArPlates_(cid);
    if (r.data.item) { var q = pl[String(r.data.item.id).toUpperCase()]; if (q) r.data.item.plate = q; }
    if (Array.isArray(r.data.items)) r.data.items.forEach(function (it) { var q2 = pl[String(it.id).toUpperCase()]; if (q2) it.plate = q2; }); } } catch (e) {}
  return r;
}
