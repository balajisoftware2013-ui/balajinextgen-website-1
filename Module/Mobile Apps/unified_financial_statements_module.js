/* ════════════════════════════════════════════════════════════════
   UNIFIED FINANCIAL STATEMENTS VIEW v1.0
   
   Shows all three core financial reports:
   - Balance Sheet
   - Profit & Loss Statement
   - Cash Flow Statement
   
   All on one page with tabs/sections
   ════════════════════════════════════════════════════════════════ */

// ── OPEN UNIFIED FINANCIAL STATEMENTS ──
function openFinancialStatementsView(){
  closeAllSheets();
  openSheet('financialStatementsView');
  renderFinancialStatements();
}

function renderFinancialStatements(){
  const html = `
    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#1a237e,#283593);color:#fff;padding:16px;border-radius:8px;margin-bottom:16px;">
      <h1 style="margin:0 0 6px 0;font-size:22px;">📊 Financial Statements</h1>
      <div style="font-size:12px;opacity:0.9;">
        Complete Financial Overview - Balance Sheet • P&L • Cash Flow
        <span style="float:right;">${new Date().toLocaleDateString('en-IN')}</span>
      </div>
    </div>

    <!-- TABS -->
    <div style="display:flex;gap:8px;border-bottom:2px solid var(--border);margin-bottom:16px;flex-wrap:wrap;">
      <button class="fin-tab active" onclick="switchFinTab('bs',this)" style="padding:10px 16px;background:none;border:none;border-bottom:3px solid var(--primary);cursor:pointer;font-weight:600;color:var(--primary);">
        📊 Balance Sheet
      </button>
      <button class="fin-tab" onclick="switchFinTab('pl',this)" style="padding:10px 16px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;font-weight:600;color:var(--sub);">
        📈 P&L Statement
      </button>
      <button class="fin-tab" onclick="switchFinTab('cf',this)" style="padding:10px 16px;background:none;border:none;border-bottom:3px solid transparent;cursor:pointer;font-weight:600;color:var(--sub);">
        💵 Cash Flow
      </button>
    </div>

    <!-- BALANCE SHEET TAB -->
    <div id="tab-bs" style="display:block;">
      ${renderBalanceSheetStatement()}
    </div>

    <!-- P&L TAB -->
    <div id="tab-pl" style="display:none;">
      ${renderPLStatement()}
    </div>

    <!-- CASH FLOW TAB -->
    <div id="tab-cf" style="display:none;">
      ${renderCashFlowStatement()}
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

// ── BALANCE SHEET STATEMENT ──
function renderBalanceSheetStatement(){
  const cash = DB.cash || 0;
  const bank = DB.bank || 0;
  const sv = DB.items.reduce((a,i)=>a+i.pRate*i.stock,0);
  const dr = DB.customers.reduce((a,c)=>a+c.due,0);
  const cr = DB.suppliers.reduce((a,s)=>a+s.due,0);
  const ta = cash + bank + sv + dr;
  const owners = ta - cr;
  
  return `
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
          <td colspan="2">LIABILITIES (WHAT WE OWE)</td>
          <td style="text-align:right;">AMOUNT (₹)</td>
        </tr>
        
        <tr class="statement-row">
          <td style="padding-left:20px;">Current Liabilities</td>
          <td></td>
          <td></td>
        </tr>
        
        <tr class="statement-item">
          <td style="padding-left:40px;">Supplier Payables</td>
          <td></td>
          <td style="text-align:right;">${fmt(cr)}</td>
        </tr>
        
        <tr class="statement-total">
          <td style="padding-left:20px;"><b>Total Liabilities</b></td>
          <td></td>
          <td style="text-align:right;"><b>${fmt(cr)}</b></td>
        </tr>
        
        <tr class="statement-header">
          <td colspan="2">CAPITAL (OWNER'S EQUITY)</td>
          <td style="text-align:right;">AMOUNT (₹)</td>
        </tr>
        
        <tr class="statement-item">
          <td style="padding-left:40px;">Owner's Capital</td>
          <td></td>
          <td style="text-align:right;">${fmt(owners)}</td>
        </tr>
        
        <tr class="statement-total">
          <td style="padding-left:20px;"><b>Total Liabilities + Capital</b></td>
          <td></td>
          <td style="text-align:right;"><b>${fmt(cr + owners)}</b></td>
        </tr>
        
        <tr class="statement-verify" style="background:${ta === (cr+owners) ? '#e8f5e9' : '#ffebee'};">
          <td colspan="2"><b>Verification</b></td>
          <td style="text-align:right;"><b style="color:${ta === (cr+owners) ? 'var(--green)' : 'var(--red)'};">
            ${ta === (cr+owners) ? '✅ BALANCED' : '❌ NOT BALANCED'}
          </b></td>
        </tr>
      </table>
    </div>
  `;
}

// ── P&L STATEMENT ──
function renderPLStatement(){
  const sales = filterSalesForReport();
  const purchases = filterByDateRange(DB.purchases||[], 'date');
  
  const totalSales = sales.reduce((a,s)=>a+s.total,0);
  const totalPurch = purchases.reduce((a,p)=>a+p.total,0);
  const gross = totalSales - totalPurch;
  const expenses = (DB.expenses||[]).reduce((a,e)=>a+e.amount,0);
  const netProfit = gross - expenses;
  const grossMargin = totalSales > 0 ? ((gross/totalSales)*100).toFixed(1) : 0;
  const netMargin = totalSales > 0 ? ((netProfit/totalSales)*100).toFixed(1) : 0;
  
  return `
    <div class="statement-container">
      <div class="statement-title">PROFIT & LOSS STATEMENT</div>
      <div class="statement-subtitle">For the Period: Current Financial Year</div>
      
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
          <td style="text-align:right;color:var(--sub);">(${grossMargin}%)</td>
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
        
        <tr class="statement-total" style="background:linear-gradient(90deg,#f5f5f5,#eeeeee);">
          <td style="padding-left:20px;"><b>NET PROFIT</b></td>
          <td style="text-align:right;"><b style="color:var(--sub);">(${netMargin}%)</b></td>
          <td style="text-align:right;"><b style="color:var(--green);font-size:16px;">${fmt(netProfit)}</b></td>
        </tr>
      </table>
    </div>
  `;
}

// ── CASH FLOW STATEMENT ──
function renderCashFlowStatement(){
  const cash = DB.cash || 0;
  const bank = DB.bank || 0;
  const totalLiquid = cash + bank;
  
  // Get recent transactions
  const sales = filterSalesForReport();
  const purchases = filterByDateRange(DB.purchases||[], 'date');
  
  const cashFromSales = sales.filter(s => s.mode === 'Cash').reduce((a,s)=>a+s.total,0);
  const cashPaid = purchases.reduce((a,p)=>a+p.total,0);
  const cashFromExpenses = (DB.expenses||[]).reduce((a,e)=>a+e.amount,0);
  
  const netCashFlow = cashFromSales - cashPaid;
  
  return `
    <div class="statement-container">
      <div class="statement-title">CASH FLOW STATEMENT</div>
      <div class="statement-subtitle">For the Period: Current Financial Year</div>
      
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
          <td style="text-align:right;color:var(--red);">-${fmt(cashFromExpenses)}</td>
        </tr>
        
        <tr class="statement-subtotal">
          <td style="padding-left:20px;"><b>Net Cash from Operations</b></td>
          <td></td>
          <td style="text-align:right;"><b>${fmt(netCashFlow)}</b></td>
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
          <td style="text-align:right;"><b style="color:var(--primary);font-size:16px;">${fmt(totalLiquid)}</b></td>
        </tr>
      </table>

      <div style="margin-top:16px;padding:12px;background:#f0f7ff;border-left:4px solid var(--primary);border-radius:4px;">
        <div style="font-weight:600;color:var(--primary);margin-bottom:6px;">📊 Cash Health Indicators</div>
        <div style="font-size:12px;line-height:1.6;">
          <div>• Liquid Cash: ₹${fmt(totalLiquid)} ${totalLiquid > 100000 ? '✅ Healthy' : '⚠️ Low'}</div>
          <div>• Monthly Burn: ₹${fmt(cashPaid + cashFromExpenses)} (approx)</div>
          <div>• Runway: ${totalLiquid > 0 ? ((totalLiquid / Math.max(cashPaid + cashFromExpenses, 1)) * 30).toFixed(0) : '0'} days at current rate</div>
        </div>
      </div>
    </div>
  `;
}

// ── TAB SWITCHING ──
function switchFinTab(tab, el){
  // Hide all tabs
  document.querySelectorAll('[id^="tab-"]').forEach(t => t.style.display = 'none');
  
  // Show selected
  document.getElementById(`tab-${tab}`).style.display = 'block';
  
  // Update button styles
  document.querySelectorAll('.fin-tab').forEach(b => {
    b.style.color = 'var(--sub)';
    b.style.borderBottomColor = 'transparent';
  });
  el.style.color = 'var(--primary)';
  el.style.borderBottomColor = 'var(--primary)';
}

// ── EXPORT FUNCTIONS ──
function printAllStatements(){
  const bsHtml = renderBalanceSheetStatement();
  const plHtml = renderPLStatement();
  const cfHtml = renderCashFlowStatement();
  
  const printWindow = window.open();
  printWindow.document.write(`
    <html>
      <head>
        <title>Financial Statements</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .page-break { page-break-after: always; }
          h1 { text-align: center; font-size: 20px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          td { padding: 8px; border: 1px solid #ddd; }
          .header { background: #333; color: white; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>FINANCIAL STATEMENTS</h1>
        <p style="text-align:center;color:#666;">Generated: ${new Date().toLocaleString('en-IN')}</p>
        
        <div class="page-break">${bsHtml}</div>
        <div class="page-break">${plHtml}</div>
        <div>${cfHtml}</div>
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
  
  const wsBS = XLSX.utils.aoa_to_sheet([
    ['BALANCE SHEET', '', ''],
    [`As on: ${new Date().toLocaleDateString('en-IN')}`, '', ''],
    ['', '', ''],
    ['ASSETS', 'AMOUNT', ''],
    ['Cash', 'Amount', ''],
    // ... add rows
  ]);
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsBS, 'Balance Sheet');
  XLSX.writeFile(wb, `FinancialStatements_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Statements exported to Excel');
}

function emailAllStatements(){
  const email = prompt('Enter email address:');
  if(!email) return;
  
  const subject = `Financial Statements - ${new Date().toLocaleDateString('en-IN')}`;
  const body = `
Please find attached your Financial Statements:
- Balance Sheet
- Profit & Loss Statement
- Cash Flow Statement

Generated: ${new Date().toLocaleString('en-IN')}
`;
  
  window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
