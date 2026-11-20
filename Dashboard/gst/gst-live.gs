/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   gst-live.gs — GST_LIVE_DATA (v2, 2026-11-20)
   Dashboard/gst/gst.html › Data source "⚡ Live from Balaji NextGen ERP": sales and purchases straight from the client's
   own ERP sheets (no Tally, no files). Read only — nothing in the ERP is changed.
     sales     ← TRANSACTION_DB › BILL_MASTER (GST_BREAKUP rate-wise) + BILL_ITEMS (liquor / tax-free split)
                 + MASTER_DB › CUSTOMER_MASTER.GSTIN (B2B)
     purchases ← TRANSACTION_DB › PURCHASE_INVOICE (+ SUPPLIER_MASTER.GST_NUMBER) and PURCHASE_MASTER rows that have
                 no purchase invoice (liquor store receipts) — the PUR-GRN mirrors of PI-GRN are skipped
   payload: { period:'YYYY-MM' } or { from:'YYYY-MM', to:'YYYY-MM' } · sides:'sales,books' · detail:true (one row per bill)
   Default (detail false): B2C bills are summed per day and GST rate (GSTR-1 needs no bill-wise B2C) with every bill
   number kept for Table 13; B2B bills (customer GSTIN) stay bill-wise. detail:true = every bill (ERP ↔ Tally report).
   Past months are cached 6 h, the current month 2 min.  Router: ACT.GST_LIVE_DATA → bnxGstLive_ (router v32+).
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */
function bnxGstLive_(session, p) {
  var cid = String(session && session.CLIENT_ID || '').trim();
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(cid)) return { success: false, error: 'No client on this login' };
  var role = String(session.ROLE || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (/^(STEWARD|WAITER|CAPTAIN|KITCHEN|CHEF|KOT|BARTENDER|DELIVERY)$/.test(role)) return { success: false, error: 'This login has no GST access' };
  var M = /^\d{4}-(0[1-9]|1[0-2])$/, from = String(p.from || p.period || ''), to = String(p.to || p.period || '');
  if (!M.test(from) || !M.test(to) || to < from) return { success: false, error: 'Period must be YYYY-MM (or from / to)' };
  var months = []; for (var y = +from.slice(0, 4), m = +from.slice(5); ; ) { var k = y + '-' + ('0' + m).slice(-2); months.push(k); if (k === to || months.length > 24) break; m++; if (m > 12) { m = 1; y++; } }
  var sides = String(p.sides || 'sales,books'), wantS = /sales/.test(sides), wantB = /books|purch/.test(sides), detail = !!p.detail;
  var ids = bnxGetClientDbIds_(cid); if (!ids || !ids.TRANSACTION) return { success: false, error: cid + ': TRANSACTION_DB not set in CLIENT_DATABASE_REGISTRY' };

  /* company GSTIN check (cached 1 h) */
  var cache = CacheService.getScriptCache(), ck = 'gstlive_co_' + cid, co = null;
  try { co = JSON.parse(cache.get(ck) || 'null'); } catch (e) {}
  if (!co) { co = { gstin: '', name: '' }; try { if (ids.MASTER) { var cs = bnxGlTable_(SpreadsheetApp.openById(ids.MASTER), 'COMPANY_SETTINGS'); cs.rows.forEach(function (r) { if (String(bnxGlCol_(cs, r, 'CLIENT_ID')) === cid && !co.gstin) { co.gstin = String(bnxGlCol_(cs, r, 'GST_NUMBER') || '').toUpperCase().trim(); co.name = String(bnxGlCol_(cs, r, 'COMPANY_NAME') || ''); } }); } } catch (e) {} try { cache.put(ck, JSON.stringify(co), 3600); } catch (e) {} }
  var gstin = String(p.gstin || '').toUpperCase().trim();
  if (co.gstin && gstin && co.gstin !== gstin) return { success: false, error: 'GSTIN ' + gstin + ' is not the ERP company of this login (' + (co.name || cid) + ' is ' + co.gstin + ')' };
  if (!gstin) gstin = co.gstin;
  var st = String(p.stateCode || gstin.slice(0, 2) || '').slice(0, 2); if (!/^\d{2}$/.test(st)) return { success: false, error: 'State code / GSTIN of the company missing' };

  /* per-month cache: past months 6 h, current month 2 min */
  var cur = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM'), out = { sales: [], purchases: [], issues: [] }, need = [];
  months.forEach(function (mo) { var hit = p.fresh ? null : bnxGlCacheGet_(cache, 'gstlive_' + cid + '_' + mo + '_' + (wantS ? 'S' : '') + (wantB ? 'B' : '') + (detail ? 'D' : ''));
    if (hit) { out.sales = out.sales.concat(hit.sales); out.purchases = out.purchases.concat(hit.purchases); out.issues = out.issues.concat(hit.issues); } else need.push(mo); });
  if (need.length) {
    var fresh = bnxGlRead_(ids, cid, need, st, wantS, wantB, detail);
    need.forEach(function (mo) { var part = { sales: fresh.sales.filter(function (x) { return x.sourcePeriod === mo; }), purchases: fresh.purchases.filter(function (x) { return x.sourcePeriod === mo; }), issues: fresh.issues.filter(function (x) { return x.period === mo; }) };
      bnxGlCachePut_(cache, 'gstlive_' + cid + '_' + mo + '_' + (wantS ? 'S' : '') + (wantB ? 'B' : '') + (detail ? 'D' : ''), part, mo < cur ? 21600 : 120);
      out.sales = out.sales.concat(part.sales); out.purchases = out.purchases.concat(part.purchases); out.issues = out.issues.concat(part.issues); });
  }
  var bills = 0; out.sales.forEach(function (s) { bills += (s.billNos || [1]).length; });
  return { success: true, data: { period: from === to ? from : '', from: from, to: to, months: months, gstin: gstin, company: co.name, sides: sides, detail: detail, sales: out.sales, purchases: out.purchases, issues: out.issues, at: new Date().toISOString(),
    counts: { bills: bills, salesRows: out.sales.length, purchases: out.purchases.length } } };
}

function bnxGlTable_(ss, name, cols) {
  var sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return { rows: [], I: {} };
  var v = sh.getDataRange().getValues(), h = v.shift(), I = {}; h.forEach(function (x, i) { I[String(x).trim().toUpperCase()] = i; }); return { rows: v, I: I };
}
function bnxGlCol_(t, r, k) { var i = t.I[k]; return i == null ? '' : r[i]; }
/* read only the rows of the wanted months: date column first, then one block from the first to the last hit */
function bnxGlTableFor_(ss, name, dateCol, months, ymd) {
  var sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return { rows: [], I: {} };
  var lc = sh.getLastColumn(), h = sh.getRange(1, 1, 1, lc).getValues()[0], I = {}; h.forEach(function (x, i) { I[String(x).trim().toUpperCase()] = i; });
  if (I[dateCol] == null) return bnxGlTable_(ss, name);
  var n = sh.getLastRow() - 1, dv = sh.getRange(2, I[dateCol] + 1, n, 1).getValues(), want = {}, lo = -1, hi = -1;
  months.forEach(function (m) { want[m] = 1; });
  for (var i = 0; i < n; i++) { if (want[ymd(dv[i][0]).slice(0, 7)]) { if (lo < 0) lo = i; hi = i; } }
  if (lo < 0) return { rows: [], I: I };
  return { rows: sh.getRange(2 + lo, 1, hi - lo + 1, lc).getValues(), I: I };
}
function bnxGlCacheGet_(cache, key) {
  try { var n = Number(cache.get(key + '_n') || 0); if (!n) return null; var parts = cache.getAll(Array.apply(null, Array(n)).map(function (_, i) { return key + '_' + i; })), s = '';
    for (var i = 0; i < n; i++) { if (parts[key + '_' + i] == null) return null; s += parts[key + '_' + i]; }
    return JSON.parse(Utilities.unzip(Utilities.newBlob(Utilities.base64Decode(s), 'application/zip'))[0].getDataAsString('UTF-8')); } catch (e) { return null; }
}
function bnxGlCachePut_(cache, key, obj, ttl) {
  try { var z = Utilities.base64Encode(Utilities.zip([Utilities.newBlob(JSON.stringify(obj), 'application/json', 'd.json')]).getBytes()), size = 90000, put = {}, n = Math.ceil(z.length / size);
    if (n > 20) return; for (var i = 0; i < n; i++) put[key + '_' + i] = z.slice(i * size, (i + 1) * size); put[key + '_n'] = String(n); cache.putAll(put, ttl); } catch (e) {}
}

function bnxGlRead_(ids, cid, months, st, wantS, wantB, detail) {
  var TZ = 'Asia/Kolkata', r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; }, num = function (v) { var n = Number(String(v == null ? '' : v).replace(/[,₹\s]/g, '')); return isFinite(n) ? n : 0; };
  var ymd = function (v) { if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd'); var s = String(v || '').trim(), m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3]; m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : ''; };
  var STD = [1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40];
  var col = bnxGlCol_, GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, inM = {}; months.forEach(function (m) { inM[m] = 1; });
  var tx = SpreadsheetApp.openById(ids.TRANSACTION), master = null, issues = [], sales = [], purchases = [];
  try { if (ids.MASTER) master = SpreadsheetApp.openById(ids.MASTER); } catch (e) {}
  var custG = {}, supG = {};
  if (master && wantS) { var cm = bnxGlTable_(master, 'CUSTOMER_MASTER'); cm.rows.forEach(function (r) { var g = String(col(cm, r, 'GSTIN') || '').toUpperCase().trim(); if (GSTIN_RE.test(g)) custG[String(col(cm, r, 'CUSTOMER_ID'))] = g; }); }
  if (master && wantB) { var sm = bnxGlTable_(master, 'SUPPLIER_MASTER'); sm.rows.forEach(function (r) { var g = String(col(sm, r, 'GST_NUMBER') || '').toUpperCase().trim(); supG[String(col(sm, r, 'SUPPLIER_ID'))] = GSTIN_RE.test(g) ? g : ''; }); }

  if (wantS) {
    var bm = bnxGlTableFor_(tx, 'BILL_MASTER', 'BILL_DATE', months, ymd), bills = {}, issued = {};
    bm.rows.forEach(function (r) {
      var d = ymd(col(bm, r, 'BILL_DATE')); if (!inM[d.slice(0, 7)]) return;
      var status = String(col(bm, r, 'BILL_STATUS') || '').toUpperCase(), no = String(col(bm, r, 'BILL_NUMBER') || '').trim();
      if (/DRAFT|OPEN|HOLD/.test(status)) return;
      if (no && !/CANCEL|VOID|DELETE/.test(status) && !col(bm, r, 'CANCELLED_AT')) (issued[d] = issued[d] || []).push(no);   /* Table 13: every issued bill number */
      if (/CANCEL|VOID|DELETE/.test(status) || col(bm, r, 'CANCELLED_AT')) return;
      var total = r2(num(col(bm, r, 'GRAND_TOTAL'))); if (!total) return;   /* NC / zero bills carry no value */
      bills[String(col(bm, r, 'BILL_ID'))] = { r: r, d: d, total: total, L: 0, O: 0, R: {} };
    });
    /* BILL_ITEMS: only 5 columns are read */
    var bish = tx.getSheetByName('BILL_ITEMS');
    if (bish && bish.getLastRow() > 1 && Object.keys(bills).length) {
      var bh = bish.getRange(1, 1, 1, bish.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim().toUpperCase(); }), n = bish.getLastRow() - 1;
      var get = function (name) { var i = bh.indexOf(name); return i < 0 ? null : bish.getRange(2, i + 1, n, 1).getValues(); };
      var cB = get('BILL_ID'), cR = get('TAX_RATE'), cT = get('LINE_TOTAL'), cG = get('ITEM_GROUP_NAME'), cC = get('CATEGORY');
      var snap = function (x) { x = Number(x) || 0; if (x > 0 && x < 1) x = x * 100; var best = 0, d = 99; STD.forEach(function (s) { if (Math.abs(s - x) < d) { d = Math.abs(s - x); best = s; } }); return d <= 1 ? best : 0; };
      if (cB && cR && cT) for (var i = 0; i < n; i++) { var b = bills[String(cB[i][0])]; if (!b) continue; var a = num(cT[i][0]); if (!a) continue; var rt = snap(cR[i][0]);
        if (rt > 0) { b.R[rt] = (b.R[rt] || 0) + a; continue; }
        var g = String((cG && cG[i][0]) || (cC && cC[i][0]) || '').toUpperCase(); if (/LIQUOR|BEER|WINE|SPIRIT|\bBAR\b|WHISK|VODKA|\bRUM\b|\bGIN\b|BREW/.test(g)) b.L += a; else b.O += a; }
    }
    var perBill = [];
    Object.keys(bills).forEach(function (id) {
      var b = bills[id], r = b.r, br = {}; try { br = JSON.parse(String(col(bm, r, 'GST_BREAKUP') || '{}')) || {}; } catch (e) { br = {}; }
      var no = String(col(bm, r, 'BILL_NUMBER') || id).trim(), mo = b.d.slice(0, 7);
      var sc = r2(num(col(bm, r, 'SERVICE_CHARGE_AMOUNT'))), scg = /^(Y|YES|TRUE|1)$/i.test(String(col(bm, r, 'SERVICE_CHARGE_GST_APPLICABLE') || '')), scTax = r2(num(col(bm, r, 'SERVICE_CHARGE_GST_AMOUNT')));
      var cg, sg, ig;
      if (br.CGST != null || br.SGST != null || br.IGST != null) { cg = r2(num(br.CGST)); sg = r2(num(br.SGST)); ig = r2(num(br.IGST)); }
      else { var t = r2(num(col(bm, r, 'TAX_AMOUNT')) + (scg ? scTax : 0)); cg = r2(t / 2); sg = r2(t - cg); ig = 0; }
      var taxed = r2(num(col(bm, r, 'TAXABLE_AMOUNT')) + (scg ? sc : 0)), ro = r2(num(col(bm, r, 'ROUND_OFF')));
      var free = r2(b.total - ro - taxed - cg - sg - ig);
      if (free < 0) { if (free < -1) issues.push({ period: mo, invoice: no, error: 'Taxable + tax is ' + r2(-free) + ' more than the bill total — check the bill' }); free = 0; }
      /* rate-wise taxable from the GST_BREAKUP heads (CGST@2.5% → 5 %, CGST@20% → 40 %) */
      var buckets = {};
      Object.keys(br).forEach(function (k) { var m = k.match(/^(CGST|SGST|IGST)@([\d.]+)%$/i); if (!m) return; var head = m[1].toUpperCase(), rt = head === 'IGST' ? Number(m[2]) : Number(m[2]) * 2, o = buckets[rt] || (buckets[rt] = { rate: rt, c: 0, s: 0, i: 0 }); if (head === 'CGST') o.c += num(br[k]); else if (head === 'SGST') o.s += num(br[k]); else o.i += num(br[k]); });
      var items = [], rates = Object.keys(buckets).map(Number).sort(function (a, c) { return a - c; });
      if (taxed && (cg || sg || ig)) {
        if (!rates.length) {   /* no rate heads in GST_BREAKUP: rate-wise share from the bill's items (TAX_RATE × LINE_TOTAL) */
          var rk = Object.keys(b.R).map(Number), rsum = rk.reduce(function (a, k) { return a + b.R[k]; }, 0), tt = cg + sg + ig;
          if (rk.length && rsum > 0) rk.forEach(function (rt) { var tx0 = taxed * b.R[rt] / rsum, x = tx0 * rt / 100; buckets[rt] = { rate: rt, c: ig ? 0 : x / 2, s: ig ? 0 : x / 2, i: ig ? x : 0 }; });
          else { var rr = Math.round(tt / taxed * 1000) / 10; buckets[rr] = { rate: rr, c: cg, s: sg, i: ig }; }
          rates = Object.keys(buckets).map(Number).sort(function (a, c) { return a - c; });
          var est = rates.reduce(function (a, k) { var o = buckets[k]; return a + o.c + o.s + o.i; }, 0);
          if ((rates.length > 1 && Math.abs(est - tt) > Math.max(1, tt * 0.05)) || (rates.length === 1 && STD.indexOf(rates[0]) < 0)) {
            /* no usable rate detail: split the taxable value between 5 % and the bill's other rate (40 / 18 / 12) so tax and taxable both fit;
               tax below 5 % of the value = part of the value carried no GST (moved to exempt) */
            buckets = {}; var eff = tt / taxed * 100, snapR = STD.filter(function (k) { return Math.abs(k - eff) <= 0.15; })[0], hi = [40, 28, 18, 12].filter(function (k) { return b.R[k]; })[0] || (eff > 18 ? 40 : 18);
            var half = function (x) { return ig ? { c: 0, s: 0, i: x } : { c: x / 2, s: x / 2, i: 0 }; };
            if (snapR) { var h0 = half(tt); buckets[snapR] = { rate: snapR, c: h0.c, s: h0.s, i: h0.i }; }
            else if (eff > 5) { var bt = (tt - 0.05 * taxed) / (hi / 100 - 0.05), at = taxed - bt, h1 = half(at * 0.05), h2 = half(bt * hi / 100); buckets[5] = { rate: 5, c: h1.c, s: h1.s, i: h1.i }; buckets[hi] = { rate: hi, c: h2.c, s: h2.s, i: h2.i }; }
            else { var a5 = tt / 0.05, h3 = half(tt); buckets[5] = { rate: 5, c: h3.c, s: h3.s, i: h3.i }; free = r2(free + taxed - a5); taxed = r2(a5); issues.push({ period: mo, invoice: no, error: 'GST is less than 5 % of the taxable value — ' + r2(free) + ' treated as no-GST value; check the bill' }); }
            rates = Object.keys(buckets).map(Number).sort(function (a, c) { return a - c; });
          }
        }
        var tsum = 0, big = rates[0], cs = 0, ss2 = 0, is = 0;
        rates.forEach(function (rt) { var o = buckets[rt]; o.tx = o.rate ? r2((o.c + o.s + o.i) / (o.rate / 100)) : (o.tx || 0); tsum += o.tx; if (o.tx > (buckets[big].tx || 0)) big = rt; cs += o.c; ss2 += o.s; is += o.i; });
        buckets[big].tx = r2(buckets[big].tx + taxed - tsum); buckets[big].c = r2(buckets[big].c + cg - cs); buckets[big].s = r2(buckets[big].s + sg - ss2); buckets[big].i = r2(buckets[big].i + ig - is);
        rates.forEach(function (rt) { var o = buckets[rt]; if (o.tx < 0) { issues.push({ period: mo, invoice: no, error: 'Rate-wise split did not fit the taxable value — put in one line' }); } items.push({ taxable: r2(Math.max(0, o.tx)), cgst: r2(o.c), sgst: r2(o.s), igst: r2(o.i), cess: 0, rate: o.rate, parts: [{ l: 'POS taxable sales (food / beverage / service charge)', a: r2(Math.max(0, o.tx)) }] }); });
        if (items.some(function (x) { return x.taxable < 0.01 && (x.cgst || x.sgst || x.igst); }) || items.some(function (x) { return x.igst && (x.cgst || x.sgst); })) items = [{ taxable: taxed, cgst: cg, sgst: sg, igst: ig, cess: 0, rate: null, parts: [{ l: 'POS taxable sales (food / beverage / service charge)', a: taxed }] }];
      } else if (taxed) free = r2(free + taxed);   /* "taxable" with no GST charged */
      items.forEach(function (x) { if (x.rate && [5, 12, 18, 28, 40].indexOf(x.rate) < 0) issues.push({ period: mo, invoice: no, error: 'Unusual GST rate ' + x.rate + ' % on ' + x.taxable + ' — check the item tax set-up' }); if (x.rate === null) issues.push({ period: mo, invoice: no, error: 'GST rate could not be found for ' + x.taxable + ' — check the bill' }); });
      if (cg && sg && Math.abs(cg - sg) > 0.05) issues.push({ period: mo, invoice: no, error: 'CGST ' + cg + ' and SGST ' + sg + ' differ' });
      if (free) { var fp = [], tot = b.L + b.O;
        if (tot > 0) { var liq = r2(free * b.L / tot), rest = r2(free - liq); if (liq) fp.push({ l: 'Liquor sales (non-GST)', a: liq }); if (rest) fp.push({ l: 'Tax-free items (exempt)', a: rest }); }
        else fp.push({ l: (!scg && sc && Math.abs(free - sc) < 1) ? 'Service charge (no GST)' : 'Non-GST part of bill (liquor)', a: free });
        items.push({ taxable: free, cgst: 0, sgst: 0, igst: 0, cess: 0, rate: 0, parts: fp }); }
      if (!items.length) return;
      items.forEach(function (x) { x.ledgers = x.parts.map(function (q) { return q.l; }); });
      var sumI = items.reduce(function (a, x) { return a + x.taxable + x.cgst + x.sgst + x.igst; }, 0), cgN = custG[String(col(bm, r, 'CUSTOMER_ID') || '')] || '';
      perBill.push({ invoiceNo: no, voucherNo: no, date: b.d, gstin: cgN, name: String(col(bm, r, 'CUSTOMER_NAME') || ''), pos: cgN ? cgN.slice(0, 2) : st, total: b.total, roundOff: r2(b.total - sumI), items: items, source: 'ERP_LIVE', sourcePeriod: mo, billId: id, billNos: [no], channel: String(col(bm, r, 'SALES_CHANNEL') || col(bm, r, 'BILL_TYPE') || '') });
    });
    if (detail) sales = perBill;
    else {
      /* B2C: one row per day (rate-wise items, free parts by label); B2B stays bill-wise */
      var day = {};
      perBill.forEach(function (x) {
        if (x.gstin) { sales.push(x); return; }
        var o = day[x.date] || (day[x.date] = { invoiceNo: 'B2C-' + x.date.replace(/-/g, ''), voucherNo: '', date: x.date, gstin: '', name: 'B2C sales of the day', pos: st, total: 0, roundOff: 0, items: {}, source: 'ERP_LIVE', sourcePeriod: x.sourcePeriod, billNos: [], bills: 0, summary: true });
        o.total = r2(o.total + x.total); o.bills++;
        x.items.forEach(function (it) { var k = it.rate == null ? 'mix' : String(it.rate), t = o.items[k] || (o.items[k] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, rate: it.rate, P: {} });
          ['taxable', 'cgst', 'sgst', 'igst'].forEach(function (f) { t[f] = r2(t[f] + it[f]); }); it.parts.forEach(function (q) { t.P[q.l] = r2((t.P[q.l] || 0) + q.a); }); });
      });
      Object.keys(day).sort().forEach(function (d) { var o = day[d];
        o.items = Object.keys(o.items).map(function (k) { var t = o.items[k]; t.parts = Object.keys(t.P).map(function (l) { return { l: l, a: t.P[l] }; }); t.ledgers = t.parts.map(function (q) { return q.l; }); delete t.P; return t; });
        o.billNos = (issued[d] || []).slice(); o.name = 'B2C sales — ' + o.bills + ' bills';
        var sumI = o.items.reduce(function (a, x) { return a + x.taxable + x.cgst + x.sgst + x.igst; }, 0); o.roundOff = r2(o.total - sumI); sales.push(o); });
      /* days with only zero-value bills: numbers still issued (Table 13) */
      Object.keys(issued).forEach(function (d) { if (!day[d]) { var b2b = perBill.filter(function (x) { return x.date === d; }).map(function (x) { return x.invoiceNo; }); var rest = issued[d].filter(function (n) { return b2b.indexOf(n) < 0; }); if (rest.length && sales.length) (sales.find(function (x) { return x.date >= d; }) || sales[sales.length - 1]).billNosExtra = ((sales.find(function (x) { return x.date >= d; }) || {}).billNosExtra || []).concat(rest); } });
    }
  }

  if (wantB) {
    var seen = {}, addP = function (o) { var k = (o.gstin || '') + '|' + String(o.invoiceNo).toUpperCase() + '|' + o.date; if (seen[k]) { issues.push({ period: o.sourcePeriod, invoice: o.invoiceNo, error: 'Same supplier invoice entered twice (' + seen[k] + ' and ' + o.ref + ') — second one left out' }); return; } seen[k] = o.ref; purchases.push(o); };
    var pi = bnxGlTable_(tx, 'PURCHASE_INVOICE');
    pi.rows.forEach(function (r) {
      var d = ymd(col(pi, r, 'INVOICE_DATE')), mo = d.slice(0, 7); if (!inM[mo]) return;
      if (/CANCEL|VOID|DELETE|REJECT/i.test(String(col(pi, r, 'STATUS') || '') + ' ' + String(col(pi, r, 'APPROVAL_STATUS') || ''))) return;
      var g = supG[String(col(pi, r, 'SUPPLIER_ID') || '')] || '', tv = r2(num(col(pi, r, 'TAXABLE_AMOUNT'))), oc = r2(num(col(pi, r, 'OTHER_CHARGES')));
      var c = r2(num(col(pi, r, 'CGST'))), s = r2(num(col(pi, r, 'SGST'))), i = r2(num(col(pi, r, 'IGST'))), total = r2(num(col(pi, r, 'TOTAL_AMOUNT')) || (tv + oc + c + s + i));
      if (!total) return;
      var head = String(col(pi, r, 'PURCHASE_HEAD') || col(pi, r, 'NOTES') || 'Purchase').split('\n')[0].slice(0, 60), parts = [];
      if (tv) parts.push({ l: head, a: tv }); if (oc) parts.push({ l: 'Other charges on purchase', a: oc });
      var no = String(col(pi, r, 'BILL_NO') || col(pi, r, 'INVOICE_NO') || col(pi, r, 'PURCHASE_INVOICE_ID')).trim();
      if (i && (c || s)) { issues.push({ period: mo, invoice: no, error: 'IGST and CGST/SGST on the same purchase — left out, correct it in the purchase module' }); return; }
      addP({ invoiceNo: no, date: d, gstin: g, name: String(col(pi, r, 'SUPPLIER_NAME') || ''), pos: g ? g.slice(0, 2) : st, total: total, roundOff: r2(total - (tv + oc + c + s + i)),
        items: [{ taxable: r2(tv + oc), cgst: c, sgst: s, igst: i, cess: 0, parts: parts, ledgers: parts.map(function (x) { return x.l; }) }], source: 'ERP_LIVE', sourcePeriod: mo, ref: String(col(pi, r, 'PURCHASE_INVOICE_ID') || ''), grn: String(col(pi, r, 'INVOICE_NO') || ''), fileUrl: String(col(pi, r, 'BILL_FILE_URL') || '') });
    });
    var piIds = {}, piNos = {}; pi.rows.forEach(function (r) { piIds[String(col(pi, r, 'PURCHASE_INVOICE_ID') || '').toUpperCase()] = 1; piNos[String(col(pi, r, 'INVOICE_NO') || '').toUpperCase()] = 1; });
    var pm = bnxGlTable_(tx, 'PURCHASE_MASTER');
    pm.rows.forEach(function (r) {
      var d = ymd(col(pm, r, 'PURCHASE_DATE')), mo = d.slice(0, 7); if (!inM[mo]) return;
      var pid = String(col(pm, r, 'PURCHASE_ID') || '').toUpperCase(), pno = String(col(pm, r, 'PURCHASE_NUMBER') || '').toUpperCase();
      if (piIds['PI-' + pid.replace(/^PUR-/, '')] || piIds[pid] || (pno && piNos[pno])) return;
      if (/CANCEL|VOID|DELETE/i.test(String(col(pm, r, 'PURCHASE_STATUS') || ''))) return;
      var tv = r2(num(col(pm, r, 'TAXABLE_AMOUNT'))), tax = r2(num(col(pm, r, 'TAX_AMOUNT'))), total = r2(num(col(pm, r, 'GRAND_TOTAL')) || (tv + tax)); if (!total) return;
      var notes = String(col(pm, r, 'NOTES') || ''), g = supG[String(col(pm, r, 'SUPPLIER_ID') || '')] || '', id = String(col(pm, r, 'PURCHASE_ID') || col(pm, r, 'PURCHASE_NUMBER'));
      var liquor = /liquor|beer|wine|bar\b/i.test(notes + ' ' + id), label = liquor ? 'Liquor purchase (store receipts)' : 'Store purchase';
      addP({ invoiceNo: String(col(pm, r, 'PURCHASE_NUMBER') || id).slice(0, 40), date: d, gstin: g, name: liquor ? 'Liquor store receipts' : String(col(pm, r, 'SUPPLIER_ID') || 'Store'), pos: g ? g.slice(0, 2) : st, total: total, roundOff: liquor ? 0 : r2(total - tv - tax),
        items: [{ taxable: r2(liquor ? total : tv), cgst: liquor ? 0 : r2(tax / 2), sgst: liquor ? 0 : r2(tax - r2(tax / 2)), igst: 0, cess: 0, parts: [{ l: label, a: r2(liquor ? total : tv) }], ledgers: [label] }], source: 'ERP_LIVE', sourcePeriod: mo, ref: id, storeReceipt: true });
    });
  }
  return { sales: sales, purchases: purchases, issues: issues };
}

/* Run once from the editor: reads this FY for CL00010 and logs the totals (nothing is written) */
function RUN_GST_LIVE_SelfTest() {
  var now = new Date(), cur = Utilities.formatDate(now, 'Asia/Kolkata', 'yyyy-MM'), fy = +cur.slice(5) >= 4 ? +cur.slice(0, 4) : +cur.slice(0, 4) - 1, t0 = Date.now();
  var r = bnxGstLive_({ CLIENT_ID: 'CL00010', ROLE: 'OWNER' }, { from: fy + '-04', to: cur, fresh: true });
  if (!r.success) { Logger.log('FAILED: ' + r.error); return; }
  var t = {}; r.data.sales.forEach(function (s) { var m = s.sourcePeriod, o = t[m] || (t[m] = { bills: 0, total: 0, tax: 0 }); o.bills += (s.billNos || []).length; o.total += s.total; s.items.forEach(function (i) { o.tax += i.cgst + i.sgst + i.igst; }); });
  Object.keys(t).sort().forEach(function (m) { Logger.log(m + ' · ' + t[m].bills + ' bills · total ' + Math.round(t[m].total) + ' · GST ' + Math.round(t[m].tax)); });
  Logger.log(r.data.purchases.length + ' purchases · ' + r.data.issues.length + ' notes · ' + Math.round((Date.now() - t0) / 1000) + ' s');
  r.data.issues.slice(0, 10).forEach(function (x) { Logger.log('  ' + x.invoice + ': ' + x.error); });
}
