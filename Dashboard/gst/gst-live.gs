/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   gst-live.gs — GST_LIVE_DATA (2026-11-20)
   Dashboard/gst/gst.html › Data source "⚡ Live from Balaji NextGen ERP": sales and purchases of one month,
   straight from the client's own ERP sheets (no Tally, no files):
     sales     ← TRANSACTION_DB › BILL_MASTER (+ BILL_ITEMS for the tax-free split, CUSTOMER_MASTER.GSTIN for B2B)
     purchases ← TRANSACTION_DB › PURCHASE_INVOICE (+ SUPPLIER_MASTER.GST_NUMBER) and PURCHASE_MASTER (store receipts)
   Every bill keeps its parts: taxable food / beverage, service charge, liquor (non-GST), other tax-free items, so the
   GST page puts them in 3.1(a) / 3.1(e) / 3.1(c), GSTR-1 Table 8 and 3B Table 5.
   Read only — nothing in the ERP is changed. Allowed only when the GSTIN asked for is the ERP company's own GSTIN.
   Router: ACT.GST_LIVE_DATA → bnxGstLive_ (zz_FINAL_ROUTER.gs v32).
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */
function bnxGstLive_(session, p) {
  var cid = String(session && session.CLIENT_ID || '').trim();
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(cid)) return { success: false, error: 'No client on this login' };
  var role = String(session.ROLE || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (/^(STEWARD|WAITER|CAPTAIN|KITCHEN|CHEF|KOT|BARTENDER|DELIVERY)$/.test(role)) return { success: false, error: 'This login has no GST access' };
  var period = String(p.period || ''); if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return { success: false, error: 'Period must be YYYY-MM' };
  var gstin = String(p.gstin || '').toUpperCase().trim();
  var ids = bnxGetClientDbIds_(cid); if (!ids || !ids.TRANSACTION) return { success: false, error: cid + ': TRANSACTION_DB not set in CLIENT_DATABASE_REGISTRY' };
  var TZ = 'Asia/Kolkata', r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; }, num = function (v) { var n = Number(String(v == null ? '' : v).replace(/[,₹\s]/g, '')); return isFinite(n) ? n : 0; };
  var ymd = function (v) { if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd'); var s = String(v || '').trim(), m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3]; m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : ''; };
  var table = function (ss, name) { var sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return { rows: [], I: {} }; var v = sh.getDataRange().getValues(), h = v.shift(), I = {}; h.forEach(function (x, i) { I[String(x).trim().toUpperCase()] = i; }); return { rows: v, I: I }; };
  var col = function (t, r, k) { var i = t.I[k]; return i == null ? '' : r[i]; };
  var GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

  /* the ERP company's own GSTIN must be the GSTIN asked for */
  var own = '', ownName = '';
  try { if (ids.MASTER) { var cs = table(SpreadsheetApp.openById(ids.MASTER), 'COMPANY_SETTINGS'); cs.rows.forEach(function (r) { if (String(col(cs, r, 'CLIENT_ID')) === cid && !own) { own = String(col(cs, r, 'GST_NUMBER') || '').toUpperCase().trim(); ownName = String(col(cs, r, 'COMPANY_NAME') || ''); } }); } } catch (e) {}
  if (own && gstin && own !== gstin) return { success: false, error: 'GSTIN ' + gstin + ' is not the ERP company of this login (' + (ownName || cid) + ' is ' + own + ')' };
  if (!gstin) gstin = own;
  var st = String(p.stateCode || gstin.slice(0, 2) || '').slice(0, 2);
  if (!/^\d{2}$/.test(st)) return { success: false, error: 'State code / GSTIN of the company missing' };

  var tx = SpreadsheetApp.openById(ids.TRANSACTION), issues = [];
  var master = null; try { if (ids.MASTER) master = SpreadsheetApp.openById(ids.MASTER); } catch (e) {}
  var custG = {}, supG = {};
  if (master) {
    var cm = table(master, 'CUSTOMER_MASTER'); cm.rows.forEach(function (r) { var g = String(col(cm, r, 'GSTIN') || '').toUpperCase().trim(); if (GSTIN_RE.test(g)) custG[String(col(cm, r, 'CUSTOMER_ID'))] = g; });
    var sm = table(master, 'SUPPLIER_MASTER'); sm.rows.forEach(function (r) { var g = String(col(sm, r, 'GST_NUMBER') || '').toUpperCase().trim(); supG[String(col(sm, r, 'SUPPLIER_ID'))] = GSTIN_RE.test(g) ? g : ''; });
  }

  /* ── SALES ── */
  var bm = table(tx, 'BILL_MASTER'), bills = {}, sales = [];
  bm.rows.forEach(function (r) {
    var d = ymd(col(bm, r, 'BILL_DATE')); if (d.slice(0, 7) !== period) return;
    var status = String(col(bm, r, 'BILL_STATUS') || '').toUpperCase();
    if (/CANCEL|VOID|DELETE|DRAFT|OPEN/.test(status) || col(bm, r, 'CANCELLED_AT')) return;
    var total = r2(num(col(bm, r, 'GRAND_TOTAL'))); if (!total) return;   /* NC / zero bills are not supplies with value */
    bills[String(col(bm, r, 'BILL_ID'))] = { r: r, d: d, total: total, L: 0, O: {} };
  });
  var bi = table(tx, 'BILL_ITEMS');
  bi.rows.forEach(function (r) { var b = bills[String(col(bi, r, 'BILL_ID'))]; if (!b) return; if (num(col(bi, r, 'TAX_RATE')) > 0) return;
    var amt = num(col(bi, r, 'LINE_TOTAL')), g = String(col(bi, r, 'ITEM_GROUP_NAME') || col(bi, r, 'CATEGORY') || 'OTHER').toUpperCase().trim(); if (!amt) return;
    if (/LIQUOR|BEER|WINE|SPIRIT|BAR\b|WHISK|VODKA|RUM|GIN/.test(g)) b.L += amt; else b.O[g] = (b.O[g] || 0) + amt; });
  Object.keys(bills).forEach(function (id) {
    var b = bills[id], r = b.r, br = {}; try { br = JSON.parse(String(col(bm, r, 'GST_BREAKUP') || '{}')) || {}; } catch (e) { br = {}; }
    var sc = r2(num(col(bm, r, 'SERVICE_CHARGE_AMOUNT'))), scg = /^(Y|YES|TRUE|1)$/i.test(String(col(bm, r, 'SERVICE_CHARGE_GST_APPLICABLE') || '')), scTax = r2(num(col(bm, r, 'SERVICE_CHARGE_GST_AMOUNT')));
    var cg, sg, ig;
    if (br.CGST != null || br.SGST != null || br.IGST != null) { cg = r2(num(br.CGST)); sg = r2(num(br.SGST)); ig = r2(num(br.IGST)); }
    else { var t = r2(num(col(bm, r, 'TAX_AMOUNT')) + (scg ? scTax : 0)); cg = r2(t / 2); sg = r2(t - cg); ig = 0; }
    var taxablePart = r2(num(col(bm, r, 'TAXABLE_AMOUNT'))), scPart = scg ? sc : 0, ro = r2(num(col(bm, r, 'ROUND_OFF')));
    var free = r2(b.total - ro - taxablePart - scPart - cg - sg - ig);
    if (free < 0) { if (free < -1) issues.push({ invoice: String(col(bm, r, 'BILL_NUMBER')), error: 'Taxable + tax is ' + (-free) + ' more than the bill total — check the bill' }); free = 0; }
    var parts = [];
    if (taxablePart) parts.push({ l: 'POS taxable sales (food / beverage)', a: taxablePart });
    if (scPart) parts.push({ l: 'Service charge (with GST)', a: scPart });
    if (free) {
      var oSum = 0; Object.keys(b.O).forEach(function (k) { oSum += b.O[k]; });
      if (b.L + oSum > 0) { var liq = r2(free * b.L / (b.L + oSum)), rest = r2(free - liq); if (liq) parts.push({ l: 'Liquor sales (non-GST)', a: liq }); if (rest) parts.push({ l: 'Tax-free items (exempt)', a: rest }); }
      else parts.push({ l: (!scg && sc && Math.abs(free - sc) < 1) ? 'Service charge (no GST)' : 'Non-GST part of bill (liquor)', a: free });
    }
    var taxable = r2(taxablePart + scPart + free), roundOff = r2(b.total - taxable - cg - sg - ig);
    var no = String(col(bm, r, 'BILL_NUMBER') || id).trim(), cg2 = custG[String(col(bm, r, 'CUSTOMER_ID') || '')] || '';
    if (cg && sg && Math.abs(cg - sg) > 0.05) issues.push({ invoice: no, error: 'CGST ' + cg + ' and SGST ' + sg + ' differ' });
    sales.push({ invoiceNo: no, voucherNo: no, date: b.d, gstin: cg2, name: String(col(bm, r, 'CUSTOMER_NAME') || ''), pos: cg2 ? cg2.slice(0, 2) : st, total: b.total, roundOff: roundOff,
      items: [{ taxable: taxable, cgst: cg, sgst: sg, igst: ig, cess: 0, parts: parts, ledgers: parts.map(function (x) { return x.l; }) }], source: 'ERP_LIVE', sourcePeriod: period, billId: id, channel: String(col(bm, r, 'SALES_CHANNEL') || col(bm, r, 'BILL_TYPE') || '') });
  });

  /* ── PURCHASES ── */
  var purchases = [], seen = {}, pi = table(tx, 'PURCHASE_INVOICE');
  var addP = function (o) { var k = (o.gstin || '') + '|' + String(o.invoiceNo).toUpperCase() + '|' + o.date; if (seen[k]) { issues.push({ invoice: o.invoiceNo, error: 'Same supplier invoice entered twice (' + seen[k] + ' and ' + o.ref + ') — second one left out' }); return; } seen[k] = o.ref; purchases.push(o); };
  pi.rows.forEach(function (r) {
    var d = ymd(col(pi, r, 'INVOICE_DATE')); if (d.slice(0, 7) !== period) return;
    if (/CANCEL|VOID|DELETE|REJECT/i.test(String(col(pi, r, 'STATUS') || '') + ' ' + String(col(pi, r, 'APPROVAL_STATUS') || ''))) return;
    var g = supG[String(col(pi, r, 'SUPPLIER_ID') || '')] || '', tv = r2(num(col(pi, r, 'TAXABLE_AMOUNT'))), oc = r2(num(col(pi, r, 'OTHER_CHARGES')));
    var c = r2(num(col(pi, r, 'CGST'))), s = r2(num(col(pi, r, 'SGST'))), i = r2(num(col(pi, r, 'IGST'))), total = r2(num(col(pi, r, 'TOTAL_AMOUNT')) || (tv + oc + c + s + i));
    if (!total) return;
    var head = String(col(pi, r, 'PURCHASE_HEAD') || col(pi, r, 'NOTES') || 'Purchase').split('\n')[0].slice(0, 60), parts = [];
    if (tv) parts.push({ l: head, a: tv }); if (oc) parts.push({ l: 'Other charges on purchase', a: oc });
    var no = String(col(pi, r, 'BILL_NO') || col(pi, r, 'INVOICE_NO') || col(pi, r, 'PURCHASE_INVOICE_ID')).trim();
    if (i && (c || s)) { issues.push({ invoice: no, error: 'IGST and CGST/SGST on the same purchase — left out, correct it in the purchase module' }); return; }
    addP({ invoiceNo: no, date: d, gstin: g, name: String(col(pi, r, 'SUPPLIER_NAME') || ''), pos: g ? g.slice(0, 2) : st, total: total, roundOff: r2(total - (tv + oc + c + s + i)),
      items: [{ taxable: r2(tv + oc), cgst: c, sgst: s, igst: i, cess: 0, parts: parts, ledgers: parts.map(function (x) { return x.l; }) }], source: 'ERP_LIVE', sourcePeriod: period, ref: String(col(pi, r, 'PURCHASE_INVOICE_ID') || ''), fileUrl: String(col(pi, r, 'BILL_FILE_URL') || '') });
  });
  /* PURCHASE_MASTER also keeps a mirror (PUR-GRNxxxx) of every PURCHASE_INVOICE (PI-GRNxxxx): only rows with no
     purchase invoice (e.g. liquor store receipts PUR-SLG-…) are added, or every purchase would count twice */
  var piIds = {}, piNos = {}; pi.rows.forEach(function (r) { piIds[String(col(pi, r, 'PURCHASE_INVOICE_ID') || '').toUpperCase()] = 1; piNos[String(col(pi, r, 'INVOICE_NO') || '').toUpperCase()] = 1; });
  var pm = table(tx, 'PURCHASE_MASTER');
  pm.rows.forEach(function (r) {
    var d = ymd(col(pm, r, 'PURCHASE_DATE')); if (d.slice(0, 7) !== period) return;
    var pid = String(col(pm, r, 'PURCHASE_ID') || '').toUpperCase(), pno = String(col(pm, r, 'PURCHASE_NUMBER') || '').toUpperCase();
    if (piIds['PI-' + pid.replace(/^PUR-/, '')] || piIds[pid] || (pno && piNos[pno])) return;
    if (/CANCEL|VOID|DELETE/i.test(String(col(pm, r, 'PURCHASE_STATUS') || ''))) return;
    var tv = r2(num(col(pm, r, 'TAXABLE_AMOUNT'))), tax = r2(num(col(pm, r, 'TAX_AMOUNT'))), total = r2(num(col(pm, r, 'GRAND_TOTAL')) || (tv + tax)); if (!total) return;
    var notes = String(col(pm, r, 'NOTES') || ''), g = supG[String(col(pm, r, 'SUPPLIER_ID') || '')] || '', id = String(col(pm, r, 'PURCHASE_ID') || col(pm, r, 'PURCHASE_NUMBER'));
    var liquor = /liquor|beer|wine|bar\b/i.test(notes + ' ' + id), label = liquor ? 'Liquor purchase (store receipts)' : 'Store purchase';
    /* a liquor store receipt has no GST: its "TAX" line (excise / other) is part of the cost, not GST input */
    var parts = [{ l: label, a: r2(liquor ? total : tv) }];
    addP({ invoiceNo: String(col(pm, r, 'PURCHASE_NUMBER') || id).slice(0, 40), date: d, gstin: g, name: liquor ? 'Liquor store receipts' : String(col(pm, r, 'SUPPLIER_ID') || 'Store'), pos: g ? g.slice(0, 2) : st, total: total, roundOff: liquor ? 0 : r2(total - tv - tax),
      items: [{ taxable: r2(liquor ? total : tv), cgst: liquor ? 0 : r2(tax / 2), sgst: liquor ? 0 : r2(tax - r2(tax / 2)), igst: 0, cess: 0, parts: parts, ledgers: [label] }], source: 'ERP_LIVE', sourcePeriod: period, ref: id, storeReceipt: true });
  });

  return { success: true, data: { period: period, gstin: gstin, company: ownName, sales: sales, purchases: purchases, issues: issues, at: new Date().toISOString(),
    counts: { bills: sales.length, purchases: purchases.length } } };
}

/* Run once from the editor: reads the current month for CL00010 and logs the totals (nothing is written) */
function RUN_GST_LIVE_SelfTest() {
  var p = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM');
  var r = bnxGstLive_({ CLIENT_ID: 'CL00010', ROLE: 'OWNER' }, { period: p });
  if (!r.success) { Logger.log('FAILED: ' + r.error); return; }
  var t = { taxable: 0, tax: 0, total: 0 }; r.data.sales.forEach(function (s) { t.total += s.total; t.taxable += s.items[0].taxable; t.tax += s.items[0].cgst + s.items[0].sgst + s.items[0].igst; });
  Logger.log(p + ' · ' + r.data.sales.length + ' bills · total ' + Math.round(t.total) + ' · tax ' + Math.round(t.tax) + ' · ' + r.data.purchases.length + ' purchases · ' + r.data.issues.length + ' issues');
  r.data.issues.slice(0, 10).forEach(function (x) { Logger.log('  ' + x.invoice + ': ' + x.error); });
}
