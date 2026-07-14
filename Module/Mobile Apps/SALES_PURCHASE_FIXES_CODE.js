// ═══════════════════════════════════════════════════════════════════════════
// BALAJI BUSINESS OS — SALES & PURCHASE COMPLETE FIXES
// Apply to: balaji-business-os.html
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────
// FIX #1: Remove toggle logic from openReport() — Line 6506-6530
// ─────────────────────────────────────────────────────────────────────────

function openReport(type, el){
  // v50 FIX: Removed toggle logic that was hiding reports
  // When user clicks same report button twice:
  //   BEFORE: Report would hide (toggle)
  //   AFTER: Report stays open/refreshes (expected behavior)
  
  // Set current report
  _lastReportType = type;
  _currentReportOpen = type;
  
  // Mark button as active
  if(el){ 
    document.querySelectorAll('.rpt-type').forEach(t=>t.classList.remove('active')); 
    el.classList.add('active'); 
  }
  
  // Get filter label
  const filterLabel={today:'Day',month:'Month',qtr:'Qtr',year:'Year',custom:'Custom'}[_rptFilter]||'';
  
  // Comprehensive titles for ALL report types
  const titles={
    sales:'Sales Register', purchase:'Purchase Register', profit:'Profit', stock:'Stock Summary',
    stockledger:'Stock Ledger', itemwise:'Item-wise Sales/Purchase', partywise:'Party-wise Monthly',
    returns:'Returns (CN/DN)', gst:'GST Summary', pl:'P&L', bs:'Balance Sheet', cashflow:'Cash Flow',
    cashbook:'Cash Book', bankbook:'Bank Book', ledger:'Ledger', journal:'Day Book / Journal',
    trialbalance:'Trial Balance', brs:'Bank Reconciliation', ageing:'Ageing — Who Owes / Who To Pay',
    suspense:'Suspense Register',
    salessummary:'Sales Summary', salesmonthwise:'Month-wise Sales', salescustomerwise:'Customer-wise Sales',
    salesitemwise:'Item-wise Sales', salescategorywise:'Category-wise Sales', salesmanwise:'Salesman-wise Sales',
    salescompare:'Sales Comparison', salesorders:'Pending Sales Orders', salesreturn:'Sales Return Report',
    salesmatrix:'Sales Matrix — Month Columns',  // ← NEW
    purchsummary:'Purchase Summary', purchmonthwise:'Month-wise Purchase',
    purchsupplierwise:'Supplier-wise Purchase', purchsuppmonthwise:'Supplier Month-wise Purchase',
    purchitemwise:'Item-wise Purchase', purchcategorywise:'Category-wise Purchase',
    purchorders:'Pending Purchase Orders', purchreturn:'Purchase Return Report',
    purchasematrix:'Purchase Matrix — Month Columns',  // ← NEW
    custledgerlist:'Customer Ledger', custoutstanding:'Customer Outstanding', custstatement:'Customer Statement',
    custmonthwise:'Customer Month-wise History', custpayhist:'Customer Payment History', custtop:'Top Customers',
    suppledgerlist:'Supplier Ledger', suppoutstanding:'Supplier Outstanding', suppstatement:'Supplier Statement',
    suppmonthwise:'Supplier Month-wise History', supppayhist:'Supplier Payment History', supptop:'Top Suppliers',
    stockmovement:'Stock Movement', lowstockrpt:'Low Stock Report', negstock:'Negative Stock Report',
    deadstock:'Dead Stock Report', fastslow:'Fast / Slow Moving Stock',
    gstr1:'GSTR-1', gstr3b:'GSTR-3B', hsnsummary:'HSN Summary', taxliability:'Tax Liability Report',
    bizsummary:'Monthly Business Summary', profitanalysis:'Profit Analysis', expenseanalysis:'Expense Analysis',
    salesvspurchase:'Sales vs Purchase', custgrowth:'Customer Growth', suppanalysis:'Supplier Analysis',
    topitems:'Top Selling Items', ledgerpick:'Ledger — Pick a Party'
  };
  
  document.getElementById('reportTitle').textContent = (titles[type]||type) + ' — ' + filterLabel;
  if(!document.getElementById('page-reports').classList.contains('active')) goPage('reports');
  
  const reportPanel = document.getElementById('reportPanel');
  if(reportPanel) reportPanel.style.display = 'block';
  
  // Continue with rest of openReport() code from line 6551 onwards
  // (Everything after this point remains the same)
}


// ─────────────────────────────────────────────────────────────────────────
// FIX #2a: Sales Month-Wise — Apply Date Filter (Line 6834-6835)
// ─────────────────────────────────────────────────────────────────────────

} else if(type==='salesmonthwise'){
    // FIX: Apply date filter so month-wise respects Day/Month/Year/Custom
    const filtered = filterSalesForReport();
    tbl = renderGroupedRegister(filtered, 'month', {
      amount:s=>s.total, 
      label:'sales', 
      type:'sales', 
      emptyMsg:'No sales in this period'
    });


// ─────────────────────────────────────────────────────────────────────────
// FIX #2b: Purchase Month-Wise — Apply Date Filter (Line 6836-6837)
// ─────────────────────────────────────────────────────────────────────────

} else if(type==='purchmonthwise'){
    // FIX: Apply date filter so month-wise respects Day/Month/Year/Custom
    const filtered = filterByDateRange(DB.purchases||[], 'date');
    tbl = renderGroupedRegister(filtered, 'month', {
      amount:p=>p.total, 
      label:'purchases', 
      type:'purchase', 
      emptyMsg:'No purchases in this period'
    });


// ─────────────────────────────────────────────────────────────────────────
// FIX #2c: Purchase Supplier Month-Wise — Apply Date Filter (Line 6853-6857)
// ─────────────────────────────────────────────────────────────────────────

} else if(type==='purchsuppmonthwise'){
    // FIX: Apply date filter instead of using all purchases
    const filtered = filterByDateRange(DB.purchases||[], 'date');
    const bySM = {};
    filtered.forEach(p=>{
      const m=p.date.slice(0,7);
      const name=(DB.suppliers.find(s=>s.id===p.supp)||{}).name||'—';
      const key=name+' · '+m;
      bySM[key]=(bySM[key]||0)+p.total;
    });
    const keys = Object.keys(bySM).sort().reverse();
    tbl = keys.length ? keys.map(k=>`<div class="cart-row"><span>${k}</span><span class="mono">${fmt(bySM[k])}</span></div>`).join('') : '<div class="cart-row"><span>No purchases in this period</span><span></span></div>';


// ─────────────────────────────────────────────────────────────────────────
// ENHANCEMENT #1: Sales Matrix Report — Column-Wise View
// Add this new function anywhere, suggest after renderGroupedRegister()
// ─────────────────────────────────────────────────────────────────────────

function _renderSalesColumnWiseHTML(){
  // Matrix table: Months as columns, totals/counts as rows
  const sales = filterSalesForReport();
  if(!sales.length) return '<div class="cart-row"><span>No sales in this period</span><span></span></div>';
  
  const byMonth = {};
  
  // Group sales by month
  sales.forEach(s=>{
    const m = s.date.slice(0,7);  // YYYY-MM
    if(!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(s);
  });
  
  const months = Object.keys(byMonth).sort();
  if(months.length === 0) return '<div class="cart-row"><span>No sales data</span><span></span></div>';
  
  // Month labels
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const getMonthName = (yyyymm) => {
    const [y,m] = yyyymm.split('-');
    return monthLabels[+m-1] + ' ' + y;
  };
  
  // Build HTML table
  let html = `<div style="overflow-x:auto;margin:0 -14px;padding:0 14px;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="border-bottom:2px solid var(--border);">
          <th style="text-align:left;padding:8px 6px;font-weight:700;min-width:120px;">Metric</th>`;
  
  months.forEach(m => {
    html += `<th style="text-align:right;padding:8px 6px;font-weight:700;min-width:100px;">${getMonthName(m)}</th>`;
  });
  
  html += `<th style="text-align:right;padding:8px 6px;font-weight:700;border-left:2px solid var(--border);min-width:100px;">Total</th></tr></thead><tbody>`;
  
  // Row 1: Total Sales
  html += `<tr style="border-bottom:1px solid var(--border);background:var(--primary-light);">
    <td style="text-align:left;padding:8px 6px;font-weight:700;">Total Sales</td>`;
  
  let grandTotal = 0;
  months.forEach(m => {
    const total = byMonth[m].reduce((a,s)=>a+s.total,0);
    grandTotal += total;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;font-weight:700;">${fmt(total)}</td>`;
  });
  
  html += `<td class="mono" style="text-align:right;padding:8px 6px;font-weight:900;border-left:2px solid var(--border);">${fmt(grandTotal)}</td></tr>`;
  
  // Row 2: Transaction Count
  html += `<tr style="border-bottom:1px solid var(--border);">
    <td style="text-align:left;padding:8px 6px;color:var(--sub);font-size:11px;">Transactions</td>`;
  
  let totalTx = 0;
  months.forEach(m => {
    const count = byMonth[m].length;
    totalTx += count;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;color:var(--sub);font-size:11px;">${count}</td>`;
  });
  
  html += `<td class="mono" style="text-align:right;padding:8px 6px;color:var(--sub);font-size:11px;border-left:2px solid var(--border);">${totalTx}</td></tr>`;
  
  // Row 3: Average per Transaction
  html += `<tr style="border-bottom:2px solid var(--border);">
    <td style="text-align:left;padding:8px 6px;color:var(--sub);font-size:11px;">Avg/Transaction</td>`;
  
  months.forEach(m => {
    const total = byMonth[m].reduce((a,s)=>a+s.total,0);
    const count = byMonth[m].length;
    const avg = count > 0 ? total/count : 0;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;color:var(--sub);font-size:11px;">${fmt(avg)}</td>`;
  });
  
  const avgGrand = totalTx > 0 ? grandTotal/totalTx : 0;
  html += `<td class="mono" style="text-align:right;padding:8px 6px;color:var(--sub);font-size:11px;border-left:2px solid var(--border);">${fmt(avgGrand)}</td></tr>`;
  
  // Row 4: Cash vs Credit breakdown
  const getModeBreakdown = (month) => {
    const cash = byMonth[month].filter(s=>s.mode!=='Credit').reduce((a,s)=>a+s.total,0);
    const credit = byMonth[month].filter(s=>s.mode==='Credit').reduce((a,s)=>a+s.total,0);
    return {cash, credit};
  };
  
  let totalCash = 0, totalCredit = 0;
  html += `<tr style="border-bottom:1px solid var(--border);">
    <td style="text-align:left;padding:8px 6px;font-size:11px;color:#0FA968;">💵 Cash/UPI</td>`;
  
  months.forEach(m => {
    const {cash} = getModeBreakdown(m);
    totalCash += cash;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#0FA968;font-size:11px;">${fmt(cash)}</td>`;
  });
  
  html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#0FA968;font-weight:700;border-left:2px solid var(--border);">${fmt(totalCash)}</td></tr>`;
  
  html += `<tr>
    <td style="text-align:left;padding:8px 6px;font-size:11px;color:#E0473E;">📋 Credit</td>`;
  
  months.forEach(m => {
    const {credit} = getModeBreakdown(m);
    totalCredit += credit;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#E0473E;font-size:11px;">${fmt(credit)}</td>`;
  });
  
  html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#E0473E;font-weight:700;border-left:2px solid var(--border);">${fmt(totalCredit)}</td></tr>`;
  
  html += `</tbody></table></div>
    <div style="font-size:11px;color:var(--sub);margin-top:8px;">
      📊 Tip: Click a month in Month-wise view to drill down to individual transactions.
    </div>`;
  
  return html;
}


// ─────────────────────────────────────────────────────────────────────────
// ENHANCEMENT #2: Purchase Matrix Report — Column-Wise View
// Add this new function after _renderSalesColumnWiseHTML()
// ─────────────────────────────────────────────────────────────────────────

function _renderPurchaseColumnWiseHTML(){
  // Matrix table: Months as columns, totals/counts/suppliers/items as rows
  const purchases = filterByDateRange(DB.purchases||[], 'date');
  if(!purchases.length) return '<div class="cart-row"><span>No purchases in this period</span><span></span></div>';
  
  const byMonth = {};
  
  // Group purchases by month
  purchases.forEach(p=>{
    const m = p.date.slice(0,7);  // YYYY-MM
    if(!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(p);
  });
  
  const months = Object.keys(byMonth).sort();
  if(months.length === 0) return '<div class="cart-row"><span>No purchase data</span><span></span></div>';
  
  // Month labels
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const getMonthName = (yyyymm) => {
    const [y,m] = yyyymm.split('-');
    return monthLabels[+m-1] + ' ' + y;
  };
  
  // Build HTML table
  let html = `<div style="overflow-x:auto;margin:0 -14px;padding:0 14px;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="border-bottom:2px solid var(--border);">
          <th style="text-align:left;padding:8px 6px;font-weight:700;min-width:120px;">Metric</th>`;
  
  months.forEach(m => {
    html += `<th style="text-align:right;padding:8px 6px;font-weight:700;min-width:100px;">${getMonthName(m)}</th>`;
  });
  
  html += `<th style="text-align:right;padding:8px 6px;font-weight:700;border-left:2px solid var(--border);min-width:100px;">Total</th></tr></thead><tbody>`;
  
  // Row 1: Total Purchases
  html += `<tr style="border-bottom:1px solid var(--border);background:var(--primary-light);">
    <td style="text-align:left;padding:8px 6px;font-weight:700;">Total Purchases</td>`;
  
  let grandTotal = 0;
  months.forEach(m => {
    const total = byMonth[m].reduce((a,p)=>a+p.total,0);
    grandTotal += total;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;font-weight:700;">${fmt(total)}</td>`;
  });
  
  html += `<td class="mono" style="text-align:right;padding:8px 6px;font-weight:900;border-left:2px solid var(--border);">${fmt(grandTotal)}</td></tr>`;
  
  // Row 2: Bills/GRN Count
  html += `<tr style="border-bottom:1px solid var(--border);">
    <td style="text-align:left;padding:8px 6px;color:var(--sub);font-size:11px;">Bills / GRNs</td>`;
  
  let totalBills = 0;
  months.forEach(m => {
    const count = byMonth[m].length;
    totalBills += count;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;color:var(--sub);font-size:11px;">${count}</td>`;
  });
  
  html += `<td class="mono" style="text-align:right;padding:8px 6px;color:var(--sub);font-size:11px;border-left:2px solid var(--border);">${totalBills}</td></tr>`;
  
  // Row 3: Average per Bill
  html += `<tr style="border-bottom:2px solid var(--border);">
    <td style="text-align:left;padding:8px 6px;color:var(--sub);font-size:11px;">Avg/Bill</td>`;
  
  months.forEach(m => {
    const total = byMonth[m].reduce((a,p)=>a+p.total,0);
    const count = byMonth[m].length;
    const avg = count > 0 ? total/count : 0;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;color:var(--sub);font-size:11px;">${fmt(avg)}</td>`;
  });
  
  const avgGrand = totalBills > 0 ? grandTotal/totalBills : 0;
  html += `<td class="mono" style="text-align:right;padding:8px 6px;color:var(--sub);font-size:11px;border-left:2px solid var(--border);">${fmt(avgGrand)}</td></tr>`;
  
  // Row 4: Unique Suppliers per month
  html += `<tr style="border-bottom:1px solid var(--border);">
    <td style="text-align:left;padding:8px 6px;font-size:11px;color:#B45309;">🏢 Suppliers</td>`;
  
  months.forEach(m => {
    const suppliers = new Set(byMonth[m].map(p=>(DB.suppliers.find(s=>s.id===p.supp)||{}).name));
    html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#B45309;font-size:11px;">${suppliers.size}</td>`;
  });
  
  const allSuppliers = new Set(purchases.map(p=>(DB.suppliers.find(s=>s.id===p.supp)||{}).name));
  html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#B45309;font-weight:700;border-left:2px solid var(--border);">${allSuppliers.size}</td></tr>`;
  
  // Row 5: Unique Items per month
  html += `<tr style="border-bottom:1px solid var(--border);">
    <td style="text-align:left;padding:8px 6px;font-size:11px;color:#0FA968;">📦 Items</td>`;
  
  months.forEach(m => {
    const items = new Set();
    byMonth[m].forEach(p=>(p.lineItems||[]).forEach(li=>items.add(li.name)));
    html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#0FA968;font-size:11px;">${items.size}</td>`;
  });
  
  const allItems = new Set();
  purchases.forEach(p=>(p.lineItems||[]).forEach(li=>allItems.add(li.name)));
  html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#0FA968;font-weight:700;border-left:2px solid var(--border);">${allItems.size}</td></tr>`;
  
  // Row 6: Cash vs Credit breakdown
  const getModeBreakdown = (month) => {
    const cash = byMonth[month].filter(p=>p.mode!=='Credit').reduce((a,p)=>a+p.total,0);
    const credit = byMonth[month].filter(p=>p.mode==='Credit').reduce((a,p)=>a+p.total,0);
    return {cash, credit};
  };
  
  let totalCash = 0, totalCredit = 0;
  html += `<tr style="border-bottom:1px solid var(--border);">
    <td style="text-align:left;padding:8px 6px;font-size:11px;color:#0FA968;">💰 Cash</td>`;
  
  months.forEach(m => {
    const {cash} = getModeBreakdown(m);
    totalCash += cash;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#0FA968;font-size:11px;">${fmt(cash)}</td>`;
  });
  
  html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#0FA968;font-weight:700;border-left:2px solid var(--border);">${fmt(totalCash)}</td></tr>`;
  
  html += `<tr>
    <td style="text-align:left;padding:8px 6px;font-size:11px;color:#E0473E;">📋 Credit</td>`;
  
  months.forEach(m => {
    const {credit} = getModeBreakdown(m);
    totalCredit += credit;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#E0473E;font-size:11px;">${fmt(credit)}</td>`;
  });
  
  html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#E0473E;font-weight:700;border-left:2px solid var(--border);">${fmt(totalCredit)}</td></tr>`;
  
  html += `</tbody></table></div>
    <div style="font-size:11px;color:var(--sub);margin-top:8px;">
      📊 Tip: Click a month in Month-wise view to drill down to individual GRNs.
    </div>`;
  
  return html;
}


// ─────────────────────────────────────────────────────────────────────────
// ADD TO openReport() — Around line 6834, ADD BEFORE salesmonthwise case:
// ─────────────────────────────────────────────────────────────────────────

} else if(type==='salesmatrix'){
    tbl = _renderSalesColumnWiseHTML();


// ─────────────────────────────────────────────────────────────────────────
// ADD TO openReport() — Around line 6836, ADD BEFORE purchmonthwise case:
// ─────────────────────────────────────────────────────────────────────────

} else if(type==='purchasematrix'){
    tbl = _renderPurchaseColumnWiseHTML();


// ─────────────────────────────────────────────────────────────────────────
// OPTIONAL: Add Matrix buttons to HTML (Line 1366 area)
// ─────────────────────────────────────────────────────────────────────────
/*
Find this section:
    <button class="rpt-type" onclick="openReport('sales',this)">Sales Register</button>
    <button class="rpt-type" onclick="openReport('salessummary',this)">Sales Summary</button>
    <button class="rpt-type" onclick="openReport('salesmonthwise',this)">Month-wise</button>
    <button class="rpt-type" onclick="openReport('salescustomerwise',this)">By Customer</button>
    ...

Add after salesmonthwise:
    <button class="rpt-type" onclick="openReport('salesmatrix',this)">📊 Matrix</button>

And in Purchase section:
    <button class="rpt-type" onclick="openReport('purchase',this)">Purchase Register</button>
    <button class="rpt-type" onclick="openReport('purchsummary',this)">Purchase Summary</button>
    <button class="rpt-type" onclick="openReport('purchmonthwise',this)">Month-wise</button>
    <button class="rpt-type" onclick="openReport('purchsupplierwise',this)">By Supplier</button>
    ...

Add after purchmonthwise:
    <button class="rpt-type" onclick="openReport('purchasematrix',this)">📊 Matrix</button>
*/


// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY OF CHANGES
// ═══════════════════════════════════════════════════════════════════════════

/*
CRITICAL FIXES (4 lines total, 5 minutes):
  1. Line 6506-6530: Replace openReport() toggle logic
     Effect: Sales & Purchase buttons no longer hide reports
     
  2. Line 6834-6835: Add filter to salesmonthwise
     Effect: Month-wise respects Day/Month/Year/Custom filter
     
  3. Line 6836-6837: Add filter to purchmonthwise
     Effect: Month-wise respects Day/Month/Year/Custom filter
     
  4. Line 6853-6857: Add filter to purchsuppmonthwise
     Effect: Supplier month-wise respects date filter

NEW FUNCTIONS (40 lines total, 10 minutes):
  5. Add _renderSalesColumnWiseHTML() function
     Shows: Months as columns, totals/count/avg/mode breakdown
     
  6. Add _renderPurchaseColumnWiseHTML() function
     Shows: Months as columns, totals/count/suppliers/items/mode breakdown

INTEGRATION (10 minutes):
  7. Add salesmatrix case to openReport() (line ~6834)
  8. Add purchasematrix case to openReport() (line ~6836)
  9. Add Matrix buttons to HTML (optional, 2 buttons)
  10. Matrix report titles already added in openReport()

TOTAL TIME: ~25 minutes
DIFFICULTY: EASY (mostly copy-paste)
IMPACT: Major improvements for both Sales & Purchase workflows
*/
