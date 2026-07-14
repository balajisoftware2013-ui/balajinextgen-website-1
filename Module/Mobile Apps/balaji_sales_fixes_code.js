// ═══════════════════════════════════════════════════════════════════════════
// BALAJI BUSINESS OS — SALES REPORT FIXES & ENHANCEMENTS
// Copy-paste these fixes into your balaji-business-os.html
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────
// FIX #1: CRITICAL — Remove toggle logic to prevent "hide" on same report
// ─────────────────────────────────────────────────────────────────────────
// REPLACE lines 6506-6530 in openReport() with this:

function openReport(type, el){
  // v50 FIX: Removed toggle-on-click logic that was causing reports to hide
  // when user clicked the same report button twice. Now clicking any report
  // button ALWAYS opens/shows it (with current filter applied), never hides.
  // Users close reports via filter chip clicks or navigation.
  
  // Set current report type
  _lastReportType = type;
  _currentReportOpen = type;
  
  // Mark button as active
  if(el){ 
    document.querySelectorAll('.rpt-type').forEach(t=>t.classList.remove('active')); 
    el.classList.add('active'); 
  }
  
  // Get current filter label (Day/Month/Year/Custom)
  const filterLabel={today:'Day',month:'Month',qtr:'Qtr',year:'Year',custom:'Custom'}[_rptFilter]||'';
  
  // Report type titles — comprehensive list
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
    purchsummary:'Purchase Summary', purchmonthwise:'Month-wise Purchase', purchsupplierwise:'Supplier-wise Purchase', 
    purchsuppmonthwise:'Supplier Month-wise Purchase', purchitemwise:'Item-wise Purchase', 
    purchcategorywise:'Category-wise Purchase', purchorders:'Pending Purchase Orders', purchreturn:'Purchase Return Report',
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
  
  // Always show report panel when opening any report
  const reportPanel = document.getElementById('reportPanel');
  if(reportPanel) reportPanel.style.display = 'block';

  // Continue with the existing openReport() logic from line 6551 onwards...
  // (Keep everything else the same — only the toggle logic at the top was changed)
}


// ─────────────────────────────────────────────────────────────────────────
// FIX #2: Month-wise sales report — APPLY DATE FILTER
// ─────────────────────────────────────────────────────────────────────────
// REPLACE line 6834-6835 with this:

} else if(type==='salesmonthwise'){
    // FIX: Apply date filter so month-wise respects Day/Month/Year/Custom selection
    const filtered = filterSalesForReport();
    tbl = renderGroupedRegister(filtered, 'month', {
      amount:s=>s.total, 
      label:'sales', 
      type:'sales', 
      emptyMsg:'No sales in this period'
    });


// ─────────────────────────────────────────────────────────────────────────
// FIX #3: Month-wise purchase report — APPLY DATE FILTER
// ─────────────────────────────────────────────────────────────────────────
// REPLACE line 6836-6837 with this:

} else if(type==='purchmonthwise'){
    // FIX: Apply date filter so month-wise respects Day/Month/Year/Custom selection
    const filtered = filterByDateRange(DB.purchases||[], 'date');
    tbl = renderGroupedRegister(filtered, 'month', {
      amount:p=>p.total, 
      label:'purchases', 
      type:'purchase', 
      emptyMsg:'No purchases in this period'
    });


// ─────────────────────────────────────────────────────────────────────────
// ENHANCEMENT #1: Column-Wise Sales Report (like Tally/Excel export)
// ─────────────────────────────────────────────────────────────────────────
// ADD this new function (can go anywhere, suggest after renderGroupedRegister):

function _renderSalesColumnWiseHTML(){
  // Build a matrix table: months as columns, totals/counts as rows
  const sales = filterSalesForReport();  // Respect current date filter
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
  
  // Month name mapping
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
  
  // Row 1: Total Sales Amount
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
  
  // Row 4: Payment Mode Breakdown (Cash vs Credit)
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
      📊 Click any month in Month-wise view to drill down and see individual transactions.
    </div>`;
  
  return html;
}


// ─────────────────────────────────────────────────────────────────────────
// ENHANCEMENT #2: Add salesmatrix case to openReport() — around line 6834
// ─────────────────────────────────────────────────────────────────────────
// ADD this BEFORE the salesmonthwise case:

} else if(type==='salesmatrix'){
    tbl = _renderSalesColumnWiseHTML();


// ─────────────────────────────────────────────────────────────────────────
// OPTIONAL: HTML BUTTON TO ADD (if you want Matrix view in UI)
// ─────────────────────────────────────────────────────────────────────────
// Find line ~1366 with sales report buttons and ADD:

<!-- In Sales Reports section, after Month-wise: -->
<button class="rpt-type" onclick="openReport('salesmatrix',this)">📊 Matrix</button>


// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY OF CHANGES
// ═══════════════════════════════════════════════════════════════════════════
/*
CRITICAL FIXES (Required):
1. Line 6506-6530: Replace openReport() toggle logic
   - Remove: if(_currentReportOpen === type) toggle block
   - Result: Clicking same report twice no longer hides it
   
2. Line 6834-6835: Add filterSalesForReport() to salesmonthwise
   - Change: renderGroupedRegister(DB.sales||[], ...)
   - To:     renderGroupedRegister(filterSalesForReport(), ...)
   - Result: Month-wise respects Day/Month/Year/Custom filter
   
3. Line 6836-6837: Add filterByDateRange() to purchmonthwise
   - Similar fix for purchase reports

ENHANCEMENTS (Optional but recommended):
4. Add _renderSalesColumnWiseHTML() function
   - Displays sales as matrix: months as columns
   - Shows totals, counts, averages, cash vs credit breakdown
   
5. Add salesmatrix report type
   - HTML button for new Matrix view
   - Case in openReport() to handle it
   - Title mapping for display

TESTING:
✓ Click Sales → Month filter → Sale button again (should NOT hide)
✓ Click salesmonthwise → Custom filter → sees only filtered months
✓ Click salesmatrix → see column-wise table with months
✓ All export/print functions still work with new reports
*/
