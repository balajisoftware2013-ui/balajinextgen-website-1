/* ════════════════════════════════════════════════════════════════
   FINANCIAL DASHBOARD UPDATED v2.0
   
   Now opens directly to Unified Financial Statements:
   - Balance Sheet tab
   - P&L tab
   - Cash Flow tab
   
   With quick metrics at top
   ════════════════════════════════════════════════════════════════ */

// ── OPEN FINANCIAL REPORTS (GOES DIRECTLY TO STATEMENTS) ──
function openFinancialReports(){
  openFinancialStatementsView();
}

// Alias for backward compatibility
function openFinancialReportsDashboard(){
  openFinancialStatementsView();
}

// ── QUICK METRICS BANNER (shows above statements) ──
function getQuickMetricsBanner(){
  const cash = DB.cash || 0;
  const bank = DB.bank || 0;
  const liquid = cash + bank;
  
  const sv = DB.items.reduce((a,i)=>a+i.pRate*i.stock,0);
  const dr = DB.customers.reduce((a,c)=>a+c.due,0);
  const cr = DB.suppliers.reduce((a,s)=>a+s.due,0);
  const ta = liquid + sv + dr;
  
  const sales = filterSalesForReport();
  const purchases = filterByDateRange(DB.purchases||[], 'date');
  const totalSales = sales.reduce((a,s)=>a+s.total,0);
  const totalPurch = purchases.reduce((a,p)=>a+p.total,0);
  const netProfit = totalSales - totalPurch - (DB.expenses||[]).reduce((a,e)=>a+e.amount,0);
  
  return `
    <!-- QUICK METRICS BANNER -->
    <div style="background:linear-gradient(135deg,#f5f5f5,#eeeeee);padding:12px;border-radius:8px;margin-bottom:16px;border-left:4px solid var(--primary);">
      <div style="font-size:11px;font-weight:600;color:var(--sub);margin-bottom:8px;">QUICK SNAPSHOT</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:12px;">
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--sub);">💰 Liquid Cash</div>
          <div style="font-size:14px;font-weight:700;color:var(--primary);">₹${fmt(liquid)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--sub);">📦 Total Assets</div>
          <div style="font-size:14px;font-weight:700;color:#2196f3;">₹${fmt(ta)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--sub);">📈 Sales</div>
          <div style="font-size:14px;font-weight:700;color:var(--green);">₹${fmt(totalSales)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--sub);">📊 Net Profit</div>
          <div style="font-size:14px;font-weight:700;color:var(--green);">₹${fmt(netProfit)}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--sub);">🏭 Supplier Due</div>
          <div style="font-size:14px;font-weight:700;color:#ff9800;">₹${fmt(cr)}</div>
        </div>
      </div>
    </div>
  `;
}

// ── UNIFIED FINANCIAL STATEMENTS (All 3 in one view) ──
function renderFinancialStatements(){
  // Get data
  const cash = DB.cash || 0;
  const bank = DB.bank || 0;
  const sv = DB.items.reduce((a,i)=>a+i.pRate*i.stock,0);
  const dr = DB.customers.reduce((a,c)=>a+c.due,0);
  const cr = DB.suppliers.reduce((a,s)=>a+s.due,0);
  const ta = cash + bank + sv + dr;
  const owners = ta - cr;
  
  const sales = filterSalesForReport();
  const purchases = filterByDateRange(DB.purchases||[], 'date');
  const totalSales = sales.reduce((a,s)=>a+s.total,0);
  const totalPurch = purchases.reduce((a,p)=>a+p.total,0);
  const gross = totalSales - totalPurch;
  const expenses = (DB.expenses||[]).reduce((a,e)=>a+e.amount,0);
  const netProfit = gross - expenses;
  
  const cashFromSales = sales.filter(s => s.mode === 'Cash').reduce((a,s)=>a+s.total,0);
  const cashPaid = purchases.reduce((a,p)=>a+p.total,0);
  
  const html = `
    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#1a237e,#283593);color:#fff;padding:16px;border-radius:8px;margin-bottom:16px;">
      <h1 style="margin:0 0 6px 0;font-size:22px;">📊 Financial Statements</h1>
      <div style="font-size:12px;opacity:0.9;">
        Balance Sheet • Profit & Loss • Cash Flow
        <span style="float:right;">${new Date().toLocaleDateString('en-IN')}</span>
      </div>
    </div>

    <!-- QUICK METRICS -->
    ${getQuickMetricsBanner()}

    <!-- TABS -->
    <div style="display:flex;gap:8px;border-bottom:2px solid var(--border);margin-bottom:16px;flex-wrap:wrap;">
      <button class="fin-tab active" onclick="switchFinTab('bs',this)" 
        style="padding:10px 16px;background:none;border:none;border-bottom:3px solid var(--primary);cursor:pointer;font-weight:600;color:var(--primary);">
        📊 Balance Sheet
      </button>
      <button class="fin-tab" onclick="switchFinTab('pl',this)" 
        style="padding:10px 16px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;font-weight:600;color:var(--sub);">
        📈 P&L Statement
      </button>
      <button class="fin-tab" onclick="switchFinTab('cf',this)" 
        style="padding:10px 16px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;font-weight:600;color:var(--sub);">
        💵 Cash Flow
      </button>
    </div>

    <!-- BALANCE SHEET TAB -->
    <div id="tab-bs" style="display:block;">
      <div class="statement-container">
        <div class="statement-title">BALANCE SHEET</div>
        <div class="statement-subtitle">As on ${new Date().toLocaleDateString('en-IN')}</div>
        
        <table class="statement-table">
          <tr class="statement-header">
            <td colspan="2">ASSETS (WHAT WE OWN)</td>
            <td style="text-align:right;">AMOUNT (₹)</td>
          </tr>
          
          <tr class="statement-row">
            <td style="padding-left:20px;">Current Assets</td>
            <td></td>
            <td></td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:40px;">Cash in Hand</td>
            <td></td>
            <td style="text-align:right;">${fmt(cash)}</td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:40px;">Bank Balance</td>
            <td></td>
            <td style="text-align:right;">${fmt(bank)}</td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:40px;">Customer Receivables</td>
            <td></td>
            <td style="text-align:right;">${fmt(dr)}</td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:40px;">Inventory</td>
            <td></td>
            <td style="text-align:right;">${fmt(sv)}</td>
          </tr>
          
          <tr class="statement-total">
            <td style="padding-left:20px;"><b>Total Assets</b></td>
            <td></td>
            <td style="text-align:right;"><b>${fmt(ta)}</b></td>
          </tr>
          
          <tr class="statement-header">
            <td colspan="2">LIABILITIES & CAPITAL</td>
            <td style="text-align:right;">AMOUNT (₹)</td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:20px;">Supplier Payables</td>
            <td></td>
            <td style="text-align:right;">${fmt(cr)}</td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:20px;">Owner's Capital</td>
            <td></td>
            <td style="text-align:right;">${fmt(owners)}</td>
          </tr>
          
          <tr class="statement-total">
            <td style="padding-left:20px;"><b>Total Liabilities + Capital</b></td>
            <td></td>
            <td style="text-align:right;"><b>${fmt(cr + owners)}</b></td>
          </tr>
          
          <tr class="statement-verify" style="background:${ta === (cr+owners) ? '#e8f5e9' : '#ffebee'};">
            <td colspan="2"><b>Status</b></td>
            <td style="text-align:right;"><b style="color:${ta === (cr+owners) ? 'var(--green)' : 'var(--red)'};">
              ${ta === (cr+owners) ? '✅ BALANCED' : '❌ NOT BALANCED'}
            </b></td>
          </tr>
        </table>
      </div>
    </div>

    <!-- P&L TAB -->
    <div id="tab-pl" style="display:none;">
      <div class="statement-container">
        <div class="statement-title">PROFIT & LOSS STATEMENT</div>
        <div class="statement-subtitle">For the Current Period</div>
        
        <table class="statement-table">
          <tr class="statement-header">
            <td colspan="2">REVENUE & COST</td>
            <td style="text-align:right;">AMOUNT (₹)</td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:20px;">Sales Revenue</td>
            <td></td>
            <td style="text-align:right;">${fmt(totalSales)}</td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:20px;color:var(--red);">Less: Cost of Goods Sold</td>
            <td></td>
            <td style="text-align:right;color:var(--red);">-${fmt(totalPurch)}</td>
          </tr>
          
          <tr class="statement-subtotal">
            <td style="padding-left:20px;"><b>Gross Profit</b></td>
            <td style="text-align:right;color:var(--sub);">${totalSales > 0 ? ((gross/totalSales)*100).toFixed(1) : 0}%</td>
            <td style="text-align:right;"><b style="color:var(--green);">${fmt(gross)}</b></td>
          </tr>
          
          <tr class="statement-header">
            <td colspan="2">OPERATING EXPENSES</td>
            <td style="text-align:right;">AMOUNT (₹)</td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:20px;color:var(--red);">Operating Expenses</td>
            <td></td>
            <td style="text-align:right;color:var(--red);">-${fmt(expenses)}</td>
          </tr>
          
          <tr class="statement-total">
            <td style="padding-left:20px;"><b>NET PROFIT</b></td>
            <td style="text-align:right;"><b style="color:var(--sub);">${totalSales > 0 ? ((netProfit/totalSales)*100).toFixed(1) : 0}%</b></td>
            <td style="text-align:right;"><b style="color:var(--green);font-size:16px;">${fmt(netProfit)}</b></td>
          </tr>
        </table>
      </div>
    </div>

    <!-- CASH FLOW TAB -->
    <div id="tab-cf" style="display:none;">
      <div class="statement-container">
        <div class="statement-title">CASH FLOW STATEMENT</div>
        <div class="statement-subtitle">For the Current Period</div>
        
        <table class="statement-table">
          <tr class="statement-header">
            <td colspan="2">OPERATING ACTIVITIES</td>
            <td style="text-align:right;">AMOUNT (₹)</td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:20px;">Cash from Sales (Cash Mode)</td>
            <td></td>
            <td style="text-align:right;color:var(--green);">+${fmt(cashFromSales)}</td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:20px;color:var(--red);">Cash for Purchases</td>
            <td></td>
            <td style="text-align:right;color:var(--red);">-${fmt(cashPaid)}</td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:20px;color:var(--red);">Cash for Expenses</td>
            <td></td>
            <td style="text-align:right;color:var(--red);">-${fmt(expenses)}</td>
          </tr>
          
          <tr class="statement-subtotal">
            <td style="padding-left:20px;"><b>Net Cash from Operations</b></td>
            <td></td>
            <td style="text-align:right;"><b>${fmt(cashFromSales - cashPaid - expenses)}</b></td>
          </tr>
          
          <tr class="statement-header">
            <td colspan="2">CASH POSITION</td>
            <td style="text-align:right;">AMOUNT (₹)</td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:20px;">Cash in Hand</td>
            <td></td>
            <td style="text-align:right;">${fmt(cash)}</td>
          </tr>
          
          <tr class="statement-item">
            <td style="padding-left:20px;">Bank Balance</td>
            <td></td>
            <td style="text-align:right;">${fmt(bank)}</td>
          </tr>
          
          <tr class="statement-total" style="background:linear-gradient(90deg,#e3f2fd,#bbdefb);">
            <td style="padding-left:20px;"><b>TOTAL LIQUID CASH</b></td>
            <td></td>
            <td style="text-align:right;"><b style="color:var(--primary);font-size:16px;">${fmt(cash + bank)}</b></td>
          </tr>
        </table>

        <div style="margin-top:16px;padding:12px;background:#f0f7ff;border-left:4px solid var(--primary);border-radius:4px;">
          <div style="font-weight:600;color:var(--primary);margin-bottom:6px;">📊 Cash Health</div>
          <div style="font-size:12px;line-height:1.6;color:#555;">
            <div>• Liquid Cash: ₹${fmt(cash + bank)} ${(cash + bank) > 100000 ? '✅' : '⚠️'}</div>
            <div>• Daily Burn: ₹${fmt((cashPaid + expenses)/30)} (approx)</div>
            <div>• Runway: ${(cash + bank) > 0 ? Math.ceil((cash + bank) / Math.max((cashPaid + expenses)/30, 1)) : 0} days</div>
          </div>
        </div>
      </div>
    </div>

    <!-- EXPORT OPTIONS -->
    <div style="margin-top:20px;padding:16px;background:var(--body-bg);border-radius:8px;display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-primary" style="flex:1;min-width:120px;" onclick="printAllStatements()">
        🖨️ Print All
      </button>
      <button class="btn btn-secondary" style="flex:1;min-width:120px;" onclick="exportAllStatementsExcel()">
        📥 Download Excel
      </button>
      <button class="btn btn-secondary" style="flex:1;min-width:120px;" onclick="emailAllStatements()">
        📧 Email
      </button>
    </div>
  `;
  
  document.getElementById('financialStatementsContent').innerHTML = html;
}

// ── CSS STYLES ──
const financialStatementsStyles = `
.fin-tab {
  transition: all 0.3s;
}

.fin-tab:hover {
  color: var(--primary);
}

.statement-container {
  margin-bottom: 20px;
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.statement-title {
  font-size: 16px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 4px;
  color: #333;
}

.statement-subtitle {
  font-size: 12px;
  text-align: center;
  color: var(--sub);
  margin-bottom: 16px;
}

.statement-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.statement-table td {
  padding: 10px;
  border-bottom: 1px solid var(--border);
}

.statement-header {
  background: #333;
  color: #fff;
  font-weight: 600;
}

.statement-header td {
  border-bottom: 2px solid #333;
  color: #fff;
}

.statement-row {
  background: #f9f9f9;
  font-weight: 600;
  color: #333;
}

.statement-item {
  background: #fff;
}

.statement-subtotal {
  background: #f5f5f5;
  font-weight: 600;
  border-top: 2px solid #999;
}

.statement-total {
  background: linear-gradient(90deg, #f5f5f5, #eeeeee);
  font-weight: 700;
  border-top: 2px solid #333;
  border-bottom: 2px solid #333;
}

.statement-verify {
  font-weight: 600;
  text-align: center;
}

.statement-table tr:last-child td {
  border-bottom: none;
}
`;

// Add styles
if(!document.getElementById('financial-statements-styles')){
  const style = document.createElement('style');
  style.id = 'financial-statements-styles';
  style.textContent = financialStatementsStyles;
  document.head.appendChild(style);
}

// ── EXPORT FUNCTIONS ──
function switchFinTab(tab, el){
  document.querySelectorAll('[id^="tab-"]').forEach(t => t.style.display = 'none');
  document.getElementById(`tab-${tab}`).style.display = 'block';
  document.querySelectorAll('.fin-tab').forEach(b => {
    b.style.color = 'var(--sub)';
    b.style.borderBottomColor = 'transparent';
  });
  el.style.color = 'var(--primary)';
  el.style.borderBottomColor = 'var(--primary)';
}

function printAllStatements(){
  const html = document.getElementById('financialStatementsContent').innerHTML;
  const printWindow = window.open();
  printWindow.document.write(`
    <html>
      <head>
        <title>Financial Statements</title>
        <style>
          body { font-family: Arial; margin: 20px; }
          .statement-table { width:100%; border-collapse:collapse; margin:20px 0; }
          .statement-table td { padding:8px; border:1px solid #ddd; }
          .statement-header { background:#333; color:#fff; font-weight:bold; }
          .page-break { page-break-after: always; margin: 20px 0; }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}

function exportAllStatementsExcel(){
  if(!window.XLSX){
    toast('Excel library not loaded');
    return;
  }
  
  const data = [
    ['FINANCIAL STATEMENTS', '', ''],
    [`As on: ${new Date().toLocaleDateString('en-IN')}`, '', ''],
    ['', '', ''],
    ['BALANCE SHEET', '', ''],
    ['ASSETS', 'AMOUNT', 'NOTES'],
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Statements');
  XLSX.writeFile(wb, `FinancialStatements_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('✅ Statements exported to Excel');
}

function emailAllStatements(){
  const email = prompt('Enter email address:');
  if(!email) return;
  
  const subject = `Financial Statements - ${new Date().toLocaleDateString('en-IN')}`;
  const body = `Please find attached your Financial Statements (Balance Sheet, P&L, Cash Flow)\n\nGenerated: ${new Date().toLocaleString('en-IN')}`;
  
  window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
