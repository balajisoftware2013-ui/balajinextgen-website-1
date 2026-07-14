// ═══════════════════════════════════════════════════════════════════════════
// BALAJI BUSINESS OS — REPORT EXPORT/PRINT & SALES REGISTER FIXES
// Copy-paste these fixes into your balaji-business-os.html
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────
// FIX #1: IMPROVED downloadReportPDF() — Better error handling
// ─────────────────────────────────────────────────────────────────────────
// Replace line 6370-6378 with this:

async function downloadReportPDF(){
  const hint = document.getElementById('rptShareHint');
  if(hint) hint.style.display='block';
  
  // Verify libraries are loaded before attempting to build
  if(!window.html2canvas){ 
    toast('❌ PDF library not loaded — please refresh and try again');
    if(hint) hint.style.display='none';
    return; 
  }
  if(!window.jspdf){ 
    toast('❌ PDF export library not available');
    if(hint) hint.style.display='none';
    return; 
  }
  
  const doc = await buildReportPDF();
  if(hint) hint.style.display='none';
  
  if(!doc){ 
    toast('❌ Could not build PDF — try again'); 
    return; 
  }
  
  doc.save(reportShareFileName());
  toast('✓ PDF downloaded successfully');
}


// ─────────────────────────────────────────────────────────────────────────
// FIX #2: IMPROVED shareReportWhatsApp() — Better URL encoding
// ─────────────────────────────────────────────────────────────────────────
// Replace line 6379-6404 with this:

async function shareReportWhatsApp(){
  const sales=filterSalesForReport();
  const total=sales.reduce((a,s)=>a+s.total,0);
  const titleEl = document.getElementById('reportTitle');
  const msg=`📊 *${bizName()} — ${titleEl?titleEl.textContent:'Report'}*\nTotal Sales: ₹${total.toLocaleString('en-IN')}\nTransactions: ${sales.length}\nDate: ${todayStr()}`;
  const hint = document.getElementById('rptShareHint');
  if(hint) hint.style.display='block';
  
  const doc = await buildReportPDF();
  if(hint) hint.style.display='none';
  
  const fileName = reportShareFileName();
  
  if(doc){
    const blob = doc.output('blob');
    const file = new File([blob], fileName, {type:'application/pdf'});
    
    // Try navigator.share first (best on mobile)
    if(navigator.canShare && navigator.canShare({files:[file]})){
      try{ 
        await navigator.share({files:[file], text: msg, title: fileName}); 
        return; 
      }
      catch(e){ 
        // User cancelled — fall through to text-only path 
      }
    } else {
      // Fallback: download + open WhatsApp web
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = fileName; 
      a.click();
      URL.revokeObjectURL(url);
      
      // Properly encode message for WhatsApp
      const encodedMsg = encodeURIComponent(
        `${msg}\n\n📎 PDF file has been downloaded — please attach it in WhatsApp`
      );
      window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
      return;
    }
  }
  
  // If PDF build failed, share message only
  const encodedMsg = encodeURIComponent(msg);
  window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
}


// ─────────────────────────────────────────────────────────────────────────
// FIX #3: PROPER CSV EXPORT — Handle commas and quotes
// ─────────────────────────────────────────────────────────────────────────
// Replace line 5832-5889 with this:

function exportReportCSV(){
  const type = _lastReportType;
  let rows;
  
  if(type==='purchase'){
    rows=[['Purchase ID','Supplier','Date','Amount','Mode','Invoice No']].concat(
      DB.purchases.map(p=>[p.id,(DB.suppliers.find(s=>s.id===p.supp)||{}).name||'—',p.date,p.total,p.mode||'—',p.invNo||''])
    );
  } else if(type==='stock' || type==='stockledger'){
    rows=[['Item','Unit','Stock','Purchase Rate','Sale Rate','Stock Value']].concat(
      DB.items.map(i=>[i.name,i.unit,i.stock,i.pRate,i.sRate,i.pRate*i.stock])
    );
  } else if(type==='gst'){
    const s = filterSalesForReport();
    const gstSales=s.reduce((a,x)=>a+x.total*0.18/1.18,0);
    const gstPurch=DB.purchases.reduce((a,p)=>a+p.total*0.18/1.18,0);
    rows=[['Metric','Amount'],['Output GST (Sales)',gstSales.toFixed(2)],['Input GST (Purchase)',gstPurch.toFixed(2)],['Net GST Payable',Math.max(0,gstSales-gstPurch).toFixed(2)]];
  } else if(type==='pl'){
    const s = filterSalesForReport();
    const totalSales=s.reduce((a,x)=>a+x.total,0), totalPurch=DB.purchases.reduce((a,p)=>a+p.total,0);
    const gross=totalSales-totalPurch, exp=DB.expensesToday||0;
    rows=[['Metric','Amount'],['Sales Revenue',totalSales],['Cost of Goods',-totalPurch],['Gross Profit',gross],['Expenses',-exp],['Net Profit',gross-exp],['— of which still in Suspense (unclassified)',getSuspenseTotal()]];
  } else if(type==='bs'){
    const sv=DB.items.reduce((a,i)=>a+i.pRate*i.stock,0);
    const dr=DB.customers.reduce((a,c)=>a+c.due,0), cr=DB.suppliers.reduce((a,s)=>a+s.due,0);
    const ta=DB.cash+DB.bank+sv+dr;
    rows=[['Item','Amount'],['Cash in Hand',DB.cash],['Bank Balance',DB.bank],['Stock Value',sv],['Customer Dues',dr],['Total Assets',ta],['Supplier Dues',cr],["Owner's Capital",ta-cr],["— of which still in Suspense (unclassified)",getSuspenseTotal()]];
  } else if(type==='suspense'){
    const all=(DB.expenses||[]).filter(e=>e.category===SUSPENSE_CAT);
    rows=[['Date','Status','Now Classified As','Note','Amount']].concat(
      all.map(e=>[e.date, e.pending?'Pending':'Cleared', e.pending?'—':e.category, e.note||'', e.amount])
    );
  } else if(type==='returns'){
    rows=[['Type','ID','Party','Date','Amount']].concat(
      (DB.creditNotes||[]).map(cn=>['Credit Note',cn.id,(DB.customers.find(c=>c.id===cn.cust)||{}).name||'—',cn.date,cn.amount]),
      (DB.debitNotes||[]).map(dn=>['Debit Note',dn.id,(DB.suppliers.find(s=>s.id===dn.supp)||{}).name||'—',dn.date,dn.amount])
    );
  } else if(type==='cashflow'){
    const s = filterSalesForReport();
    const periodPurch = filterByDateRange(DB.purchases||[], 'date');
    const cashSales = s.filter(x=>x.mode!=='Credit').reduce((a,x)=>a+x.total,0);
    const cashPurch = periodPurch.filter(p=>p.mode!=='Credit').reduce((a,p)=>a+p.total,0);
    const receiptsIn = filterByDateRange(DB.paymentsIn||[], 'date').reduce((a,p)=>a+p.amount,0);
    const paymentsOut = filterByDateRange(DB.paymentsOut||[], 'date').reduce((a,p)=>a+p.amount,0);
    const expensesOut = filterByDateRange(DB.expenses||[], 'date').reduce((a,e)=>a+e.amount,0);
    rows=[['Item','Amount'],['Cash/UPI/Bank Sales',cashSales],['Receipts from Customers',receiptsIn],
      ['Cash/UPI/Bank Purchases',-cashPurch],['Payments to Suppliers',-paymentsOut],['Expenses Paid',-expensesOut],
      ['Net Cash Flow', cashSales+receiptsIn-cashPurch-paymentsOut-expensesOut]];
  } else {
    const s = filterSalesForReport();
    rows=[['Invoice','Customer','Date','Amount','Mode','GST Type']].concat(
      s.map(x=>[x.id,(DB.customers.find(c=>c.id===x.cust)||{}).name||'—',x.date,x.total,x.mode||'—',x.gstType||'gst'])
    );
  }
  
  // PROPER CSV QUOTING: Handle commas, quotes, newlines
  const escapeCSV = (val) => {
    const str = String(val||'');
    if(str.includes(',') || str.includes('"') || str.includes('\n')){
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  
  const csvContent = rows
    .map(r => r.map(escapeCSV).join(','))
    .join('\n');
  
  const blob = new Blob([csvContent], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); 
  a.href = URL.createObjectURL(blob);
  a.download = `${type}_report_${_rptFilter}_${Date.now()}.csv`; 
  a.click();
  toast('✓ Excel CSV downloaded');
}


// ─────────────────────────────────────────────────────────────────────────
// FIX #4: CRITICAL BUG FIX — setRptFilter() clears custom dates
// ─────────────────────────────────────────────────────────────────────────
// Replace line 5603-5610 with this:

function setRptFilter(f, el){
  _rptFilter = f;
  
  // Remove active class from all chips
  document.querySelectorAll('.rpt-chip').forEach(c => c.classList.remove('active'));
  
  // Add active class to clicked chip
  if(el) el.classList.add('active');
  
  const cdRow = document.getElementById('rptCustomDates');
  
  // CLEAR custom date fields when switching AWAY from 'custom' mode
  if(f !== 'custom'){
    const fromEl = document.getElementById('rptFrom');
    const toEl = document.getElementById('rptTo');
    if(fromEl) fromEl.value = '';
    if(toEl) toEl.value = '';
    if(cdRow) cdRow.style.display = 'none';
  } else {
    // Show custom date fields when IN 'custom' mode
    if(cdRow) cdRow.style.display = 'flex';
  }
  
  // Always refresh the report view
  openReport(_lastReportType);
}


// ─────────────────────────────────────────────────────────────────────────
// FIX #5: ADD THIS CSS FOR BETTER FILTER CHIP VISIBILITY
// ─────────────────────────────────────────────────────────────────────────
// Find the <style> section and add these rules:

const cssImprovements = `
/* Report filter chips — clear visual state */
.rpt-chip {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--sub);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  min-height: 36px;
  display: flex;
  align-items: center;
}

.rpt-chip:active {
  transform: scale(0.96);
  opacity: 0.9;
}

/* Active state is VERY visible — no ambiguity */
.rpt-chip.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary-dark);
  box-shadow: 0 4px 12px rgba(245, 132, 31, 0.35);
  font-weight: 700;
}

/* Custom dates input row */
#rptCustomDates {
  display: none;  /* hidden by default */
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  background: var(--primary-light);
  margin-top: 8px;
  width: 100%;
}

#rptCustomDates.show {
  display: flex;
}

#rptCustomDates input {
  flex: 1;
  min-width: 120px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}

#rptCustomDates input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

/* Print preview button — mobile friendly */
#reportPreviewSheet .btn {
  min-height: 44px;
}

/* Export/send menu grid */
.qmenu-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}

.qmenu-item {
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--card);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}

.qmenu-item:active {
  transform: scale(0.95);
  background: var(--primary-light);
}

.qm-ico {
  font-size: 24px;
}

@media print {
  .topbar, .search-wrap, .navbar, .bottom-nav, .icon-btn,
  .sheet, .drawer, .modal, .reportPanel { display: none !important; }
  body { padding: 0; background: white; }
  .page { padding: 0; display: block !important; }
  .reportPrintArea { margin: 0; box-shadow: none; }
  table { page-break-inside: avoid; }
  tr { page-break-inside: avoid; }
  body { color: #000; font-size: 11px; }
  .mono { font-size: 10px; }
}
`;

// ═══════════════════════════════════════════════════════════════════════════
// IMPLEMENTATION NOTES
// ═══════════════════════════════════════════════════════════════════════════
// 
// 1. SEARCH for these line numbers in your HTML and replace:
//    - Line 5603-5610: setRptFilter() function
//    - Line 5832-5889: exportReportCSV() function
//    - Line 6370-6378: downloadReportPDF() function
//    - Line 6379-6404: shareReportWhatsApp() function
//
// 2. ADD the CSS improvements to your <style> section
//
// 3. TEST all three workflows:
//    ✓ Click Month → click a month group → click Day (should show today only)
//    ✓ Click Report → click Export → select PDF → file downloads
//    ✓ Click Report → click Send → select WhatsApp → message opens
//
// 4. If html2canvas/jsPDF are not loading:
//    - Check your CDN links in the <head> (should be after <style>)
//    - Typical URLs:
//      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
//      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
//
// ═══════════════════════════════════════════════════════════════════════════
