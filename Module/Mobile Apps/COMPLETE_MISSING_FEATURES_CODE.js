// ════════════════════════════════════════════════════════════════════════════════
// BALAJI BUSINESS OS v36 - COMPLETE MISSING FEATURES
// All solutions for: Invoice Send, Expenses, Payments, Reports, Banking
// ════════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════════
// FIX #8: INVOICE SEND (WhatsApp/PDF) - PROPER FORMAT
// ════════════════════════════════════════════════════════════════════════════════

function generateInvoicePDF(billId, customer, total, items, mode, gstType) {
  // Create clean HTML for WhatsApp/PDF send (not for print)
  const bizName = document.getElementById('settingsBizName')?.value || 'Business';
  const gstin = document.getElementById('setGst')?.value || '—';
  const today = new Date().toLocaleDateString('en-IN');
  
  let itemsHTML = '';
  let totalTax = 0;
  let totalGST = 0;
  
  (items || []).forEach(item => {
    const gst = Number(item.gst) || 0;
    const itemTotal = (item.qty * item.rate);
    const gstAmt = (itemTotal * gst) / 100;
    totalTax += gstAmt;
    totalGST += gstAmt;
    
    itemsHTML += `
    <tr style="border-bottom:1px solid #ddd;">
      <td style="padding:8px; text-align:left;">${item.name || 'Item'}</td>
      <td style="padding:8px; text-align:center;">${item.hsn || '—'}</td>
      <td style="padding:8px; text-align:center;">${item.qty}</td>
      <td style="padding:8px; text-align:right;">₹${Number(item.rate).toFixed(2)}</td>
      ${gstType === 'gst' ? `<td style="padding:8px; text-align:center;">${gst}%</td>` : ''}
      <td style="padding:8px; text-align:right;">₹${itemTotal.toFixed(2)}</td>
    </tr>`;
  });
  
  const subtotal = total - totalGST;
  
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${billId}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; background: #f5f5f5; }
      .invoice { 
        max-width: 800px; 
        margin: 20px auto; 
        background: white; 
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ff7a1a; padding-bottom: 15px; }
      .title { font-size: 24px; font-weight: bold; color: #333; }
      .subtitle { font-size: 12px; color: #666; margin-top: 5px; }
      .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; font-size: 13px; }
      .detail-box { padding: 10px; background: #f9f9f9; border-radius: 4px; }
      .detail-box strong { color: #ff7a1a; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { 
        background: #ff7a1a; 
        color: white; 
        padding: 10px; 
        text-align: left; 
        font-size: 12px;
        font-weight: bold;
      }
      td { padding: 8px; font-size: 13px; }
      .summary { 
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-bottom: 20px;
        font-size: 13px;
      }
      .summary-row { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #eee; }
      .summary-row.total { background: #ff7a1a; color: white; font-weight: bold; font-size: 16px; }
      .footer { font-size: 11px; color: #999; text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; }
      @media print {
        body { background: white; }
        .invoice { box-shadow: none; margin: 0; }
      }
    </style>
  </head>
  <body>
    <div class="invoice">
      <div class="header">
        <div class="title">${bizName}</div>
        <div class="subtitle">GSTIN: ${gstin}</div>
        <div class="subtitle" style="margin-top: 5px; font-weight: bold; color: #ff7a1a;">
          ${gstType === 'gst' ? 'TAX INVOICE' : 'BILL OF SUPPLY'}
        </div>
      </div>
      
      <div class="details">
        <div class="detail-box">
          <div><strong>Invoice No:</strong> ${billId}</div>
          <div><strong>Date:</strong> ${today}</div>
          <div><strong>Mode:</strong> ${mode}</div>
        </div>
        <div class="detail-box">
          <div><strong>Bill To:</strong></div>
          <div>${customer.name || 'Walk-in Customer'}</div>
          <div>${customer.mobile || 'No mobile'}</div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>HSN</th>
            <th>Qty</th>
            <th>Rate</th>
            ${gstType === 'gst' ? '<th>GST%</th>' : ''}
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
      
      <div class="summary">
        <div class="summary-row">
          <span>Subtotal:</span>
          <strong>₹${subtotal.toFixed(2)}</strong>
        </div>
        ${gstType === 'gst' ? `
        <div class="summary-row">
          <span>GST (${(totalTax > 0 ? ((totalTax/subtotal)*100).toFixed(0) : 0)}%):</span>
          <strong>₹${totalTax.toFixed(2)}</strong>
        </div>
        ` : ''}
        <div class="summary-row total" style="grid-column: 1 / -1;">
          <span>TOTAL:</span>
          <strong>₹${total.toFixed(2)}</strong>
        </div>
      </div>
      
      <div class="footer">
        Powered by Balaji NextGen Business OS | ${today} | This is a computer generated invoice
      </div>
    </div>
  </body>
  </html>`;
  
  return html;
}

async function sendInvoiceWhatsApp(billId) {
  const sale = DB.sales.find(s => s.id === billId);
  if (!sale) { toast('Sale not found'); return; }
  
  const customer = DB.customers.find(c => c.id === sale.cust);
  if (!customer || !customer.mobile) { toast('Customer mobile required'); return; }
  
  const invoiceHTML = generateInvoicePDF(billId, customer, sale.total, sale.lineItems, sale.mode, 'gst');
  
  // Convert HTML to PDF using html2pdf
  try {
    const element = document.createElement('div');
    element.innerHTML = invoiceHTML;
    
    const opt = {
      margin: 5,
      filename: 'invoice_' + billId + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };
    
    html2pdf().set(opt).from(element).toPdf().get('pdf').then(pdf => {
      const pdfDataUrl = pdf.output('dataurlstring');
      
      // Open WhatsApp with link
      const message = `Invoice ${billId} for ₹${sale.total.toFixed(2)} - Tap below to view\n\n`;
      const phone = customer.mobile.replace(/\D/g, '');
      const whatsappURL = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      
      window.open(whatsappURL, '_blank');
      toast('✅ WhatsApp opened - share the PDF manually or paste the link');
    });
  } catch(err) {
    toast('❌ PDF generation failed: ' + err.message);
  }
}

function sendInvoiceEmail(billId) {
  const sale = DB.sales.find(s => s.id === billId);
  if (!sale) { toast('Sale not found'); return; }
  
  const customer = DB.customers.find(c => c.id === sale.cust);
  if (!customer || !customer.email) { 
    toast('Customer email required');
    return;
  }
  
  // Call backend to send email via GAS
  callGAS('SEND_INVOICE_EMAIL', {
    sheetId: SESSION.sheetId,
    billId: billId,
    customerEmail: customer.email,
    customerName: customer.name,
    total: sale.total,
    items: sale.lineItems
  }).then(result => {
    if (result.success) {
      toast('✅ Email sent to ' + customer.email);
    } else {
      toast('❌ Email failed: ' + result.message);
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// FIX #9: EXPENSES MODULE - Complete
// ════════════════════════════════════════════════════════════════════════════════

let currentExpense = null;

function openExpensesModule() {
  goPage('expenses');
  renderExpensesList();
}

function renderExpensesList() {
  const list = document.getElementById('expensesList');
  if (!list) return;
  
  if (!DB.expenses) DB.expenses = [];
  
  const expenses = DB.expenses.sort((a,b) => new Date(b.date) - new Date(a.date));
  const total = expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  
  list.innerHTML = `
  <div style="padding:10px; background:#f0f0f0; border-radius:8px; margin-bottom:10px; display:flex; justify-content:space-between;">
    <span style="font-weight:700;">Total Expenses</span>
    <span style="font-weight:700; color:#d32f2f;">₹${total.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
  </div>
  ${expenses.length === 0 ? `
    <div style="text-align:center; padding:20px; color:#999;">
      No expenses yet. Add one to get started!
    </div>
  ` : `
    <div style="max-height:400px; overflow-y:auto;">
      ${expenses.map((exp, idx) => `
        <div style="padding:12px; border:1px solid #eee; border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600;">${exp.category || 'Expense'}</div>
            <div style="font-size:12px; color:#666;">
              ${exp.date} · ${exp.description || '(No description)'}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; font-size:16px; color:#d32f2f;">₹${Number(exp.amount).toFixed(2)}</div>
            <button class="btn btn-sm btn-outline" style="margin-top:5px; padding:4px 8px; font-size:11px;" onclick="editExpense(${idx})">Edit</button>
          </div>
        </div>
      `).join('')}
    </div>
  `}`;
}

function openAddExpenseSheet() {
  currentExpense = null;
  document.getElementById('expenseCat').value = '';
  document.getElementById('expenseDesc').value = '';
  document.getElementById('expenseAmt').value = '';
  document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('expenseSheetTitle').textContent = 'Add Expense';
  openSheet('expenseSheet');
}

function editExpense(idx) {
  currentExpense = idx;
  const exp = DB.expenses[idx];
  document.getElementById('expenseCat').value = exp.category || '';
  document.getElementById('expenseDesc').value = exp.description || '';
  document.getElementById('expenseAmt').value = exp.amount || '';
  document.getElementById('expenseDate').value = exp.date || '';
  document.getElementById('expenseSheetTitle').textContent = 'Edit Expense';
  openSheet('expenseSheet');
}

function saveExpense() {
  const category = document.getElementById('expenseCat')?.value || '';
  const description = document.getElementById('expenseDesc')?.value || '';
  const amount = Number(document.getElementById('expenseAmt')?.value) || 0;
  const date = document.getElementById('expenseDate')?.value || '';
  
  if (!category) { toast('Select category'); return; }
  if (amount <= 0) { toast('Enter valid amount'); return; }
  if (!date) { toast('Select date'); return; }
  
  if (!DB.expenses) DB.expenses = [];
  
  const expense = { id: 'EXP-' + Date.now(), category, description, amount, date };
  
  if (currentExpense !== null) {
    DB.expenses[currentExpense] = expense;
    toast('✅ Expense updated');
  } else {
    DB.expenses.push(expense);
    toast('✅ Expense added');
  }
  
  saveToDB();
  closeSheet('expenseSheet');
  renderExpensesList();
}

function deleteExpense(idx) {
  if (confirm('Delete this expense?')) {
    DB.expenses.splice(idx, 1);
    saveToDB();
    renderExpensesList();
    toast('✅ Expense deleted');
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// FIX #10: RECEIVE PAYMENT - Complete
// ════════════════════════════════════════════════════════════════════════════════

function openReceivePaymentSheet() {
  const customerSelect = document.getElementById('paymentCustomerSelect');
  if (customerSelect) {
    customerSelect.innerHTML = `
      <option value="">-- Select Customer --</option>
      ${(DB.customers || []).filter(c => c.due > 0).map(c => `
        <option value="${c.id}" data-due="${c.due}">
          ${c.name} (Due: ₹${c.due.toLocaleString('en-IN', {maximumFractionDigits: 2})})
        </option>
      `).join('')}
    `;
  }
  
  document.getElementById('paymentAmt').value = '';
  document.getElementById('paymentMode').value = 'Cash';
  document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('paymentRef').value = '';
  
  openSheet('receivePaymentSheet');
}

function savePaymentReceived() {
  const custId = document.getElementById('paymentCustomerSelect')?.value;
  const amount = Number(document.getElementById('paymentAmt')?.value) || 0;
  const mode = document.getElementById('paymentMode')?.value || 'Cash';
  const date = document.getElementById('paymentDate')?.value || '';
  const ref = document.getElementById('paymentRef')?.value || '';
  
  if (!custId) { toast('Select customer'); return; }
  if (amount <= 0) { toast('Enter valid amount'); return; }
  if (!date) { toast('Select date'); return; }
  
  const customer = DB.customers.find(c => c.id === custId);
  if (!customer) { toast('Customer not found'); return; }
  
  // Reduce due
  customer.due = Math.max(0, customer.due - amount);
  
  // Add to payment log
  if (!DB.payments) DB.payments = [];
  DB.payments.push({
    id: 'PAY-' + Date.now(),
    custId: custId,
    custName: customer.name,
    amount: amount,
    mode: mode,
    date: date,
    ref: ref,
    type: 'RECEIVED'
  });
  
  // Update cash/bank
  if (mode === 'Cash') {
    DB.cash = (DB.cash || 0) + amount;
  } else if (mode === 'Bank') {
    DB.bank = (DB.bank || 0) + amount;
  }
  
  saveToDB();
  closeSheet('receivePaymentSheet');
  toast('✅ Payment of ₹' + amount.toLocaleString('en-IN', {maximumFractionDigits: 2}) + ' received from ' + customer.name);
  renderDashboard();
}

// ════════════════════════════════════════════════════════════════════════════════
// FIX #11: BANK UPLOAD & RECONCILIATION
// ════════════════════════════════════════════════════════════════════════════════

function openBankReconciliation() {
  goPage('banking');
  renderBankTransactions();
}

function renderBankTransactions() {
  const list = document.getElementById('bankTxnsList');
  if (!list) return;
  
  if (!DB.bankTxns) DB.bankTxns = [];
  
  const txns = DB.bankTxns.sort((a,b) => new Date(b.date) - new Date(a.date));
  const total = txns.reduce((a, t) => a + (Number(t.amount) || 0), 0);
  
  list.innerHTML = `
  <div style="padding:10px; background:#f0f0f0; border-radius:8px; margin-bottom:10px; display:flex; justify-content:space-between;">
    <span style="font-weight:700;">Bank Balance</span>
    <span style="font-weight:700; color:#0066cc;">₹${(DB.bank || 0).toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
  </div>
  
  <div style="margin-bottom:15px;">
    <button class="btn btn-primary" style="width:100%;" onclick="openAddBankTxnSheet()">+ Add Bank Transaction</button>
  </div>
  
  ${txns.length === 0 ? `
    <div style="text-align:center; padding:20px; color:#999;">
      No bank transactions yet
    </div>
  ` : `
    <div style="max-height:500px; overflow-y:auto;">
      ${txns.map((txn, idx) => `
        <div style="padding:12px; border:1px solid #eee; border-radius:6px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:600;">${txn.type === 'IN' ? '✓' : '✗'} ${txn.description || 'Transaction'}</div>
              <div style="font-size:12px; color:#666;">${txn.date} · Ref: ${txn.ref || '—'}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:700; font-size:16px; color:${txn.type === 'IN' ? '#0fa968' : '#d32f2f'};">
                ${txn.type === 'IN' ? '+' : '-'}₹${Number(txn.amount).toFixed(2)}
              </div>
              ${!txn.reconciled ? `
                <button class="btn btn-sm btn-outline" style="margin-top:5px; padding:4px 8px; font-size:11px;" onclick="reconcileBankTxn(${idx})">Reconcile</button>
              ` : `<span style="color:#0fa968; font-size:11px; margin-top:5px;">✓ Reconciled</span>`}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `}`;
}

function openAddBankTxnSheet() {
  document.getElementById('bankTxnType').value = 'IN';
  document.getElementById('bankTxnDesc').value = '';
  document.getElementById('bankTxnAmt').value = '';
  document.getElementById('bankTxnDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('bankTxnRef').value = '';
  openSheet('bankTxnSheet');
}

function saveBankTransaction() {
  const type = document.getElementById('bankTxnType')?.value || 'IN';
  const description = document.getElementById('bankTxnDesc')?.value || '';
  const amount = Number(document.getElementById('bankTxnAmt')?.value) || 0;
  const date = document.getElementById('bankTxnDate')?.value || '';
  const ref = document.getElementById('bankTxnRef')?.value || '';
  
  if (amount <= 0) { toast('Enter valid amount'); return; }
  if (!date) { toast('Select date'); return; }
  
  if (!DB.bankTxns) DB.bankTxns = [];
  
  DB.bankTxns.push({
    id: 'TXN-' + Date.now(),
    type: type,
    description: description,
    amount: amount,
    date: date,
    ref: ref,
    reconciled: false
  });
  
  // Update bank balance
  DB.bank = (DB.bank || 0) + (type === 'IN' ? amount : -amount);
  
  saveToDB();
  closeSheet('bankTxnSheet');
  toast('✅ Bank transaction recorded');
  renderBankTransactions();
}

function reconcileBankTxn(idx) {
  DB.bankTxns[idx].reconciled = true;
  saveToDB();
  renderBankTransactions();
  toast('✅ Transaction reconciled');
}

// ════════════════════════════════════════════════════════════════════════════════
// FIX #12: BALANCE SHEET REPORT - Complete
// ════════════════════════════════════════════════════════════════════════════════

function generateBalanceSheetReport() {
  goPage('reports');
  
  const cash = DB.cash || 0;
  const bank = DB.bank || 0;
  const inventory = (DB.items || []).reduce((a, it) => a + (it.stock * (it.pRate || 0)), 0);
  const receivables = (DB.customers || []).reduce((a, c) => a + (c.due || 0), 0);
  
  const totalAssets = cash + bank + inventory + receivables;
  const totalLiabilities = (DB.suppliers || []).reduce((a, s) => a + (s.due || 0), 0);
  const equity = totalAssets - totalLiabilities;
  
  const html = `
  <div style="padding:20px; background:white; border-radius:8px;">
    <h2 style="text-align:center; margin-bottom:20px;">BALANCE SHEET</h2>
    <p style="text-align:center; color:#666; margin-bottom:30px;">As of ${new Date().toLocaleDateString('en-IN')}</p>
    
    <table style="width:100%; border-collapse:collapse; margin-bottom:30px;">
      <tr style="background:#f0f0f0; font-weight:bold;">
        <td colspan="2" style="padding:10px; border:1px solid #ddd;">ASSETS</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;"></td>
      </tr>
      <tr>
        <td style="padding:10px; border:1px solid #ddd;">Current Assets:</td>
        <td></td>
        <td style="padding:10px; border:1px solid #ddd;"></td>
      </tr>
      <tr>
        <td style="padding:10px 30px; border:1px solid #ddd;">Cash in Hand</td>
        <td></td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">₹${cash.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      <tr>
        <td style="padding:10px 30px; border:1px solid #ddd;">Bank Balance</td>
        <td></td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">₹${bank.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      <tr>
        <td style="padding:10px 30px; border:1px solid #ddd;">Receivables</td>
        <td></td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">₹${receivables.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      <tr>
        <td style="padding:10px 30px; border:1px solid #ddd;">Inventory</td>
        <td></td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">₹${inventory.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      <tr style="background:#ffffcc; font-weight:bold;">
        <td style="padding:10px;">TOTAL ASSETS</td>
        <td></td>
        <td style="padding:10px; text-align:right;">₹${totalAssets.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      
      <tr style="background:#f0f0f0; font-weight:bold;">
        <td colspan="2" style="padding:10px; border:1px solid #ddd;">LIABILITIES & EQUITY</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;"></td>
      </tr>
      <tr>
        <td style="padding:10px; border:1px solid #ddd;">Current Liabilities:</td>
        <td></td>
        <td style="padding:10px; border:1px solid #ddd;"></td>
      </tr>
      <tr>
        <td style="padding:10px 30px; border:1px solid #ddd;">Payables to Suppliers</td>
        <td></td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">₹${totalLiabilities.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      <tr style="background:#ffffcc; font-weight:bold;">
        <td style="padding:10px;">TOTAL LIABILITIES</td>
        <td></td>
        <td style="padding:10px; text-align:right;">₹${totalLiabilities.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      <tr style="background:#e8f5e9; font-weight:bold;">
        <td style="padding:10px;">EQUITY</td>
        <td></td>
        <td style="padding:10px; text-align:right;">₹${equity.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      <tr style="background:#ccffcc; font-weight:bold; font-size:16px;">
        <td style="padding:10px;">TOTAL LIAB. + EQUITY</td>
        <td></td>
        <td style="padding:10px; text-align:right;">₹${(totalLiabilities + equity).toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
    </table>
    
    <button class="btn btn-primary" onclick="printReport('balanceSheet')">Print</button>
    <button class="btn btn-outline" onclick="exportReportPDF('balanceSheet')">Export PDF</button>
  </div>`;
  
  const el = document.getElementById('reportContent');
  if (el) el.innerHTML = html;
}

// ════════════════════════════════════════════════════════════════════════════════
// FIX #13: P&L STATEMENT - Complete
// ════════════════════════════════════════════════════════════════════════════════

function generatePLStatement() {
  goPage('reports');
  
  const sales = (DB.sales || []).reduce((a, s) => a + (s.total || 0), 0);
  const purchases = (DB.purchases || []).reduce((a, p) => a + (p.total || 0), 0);
  const expenses = (DB.expenses || []).reduce((a, e) => a + (e.amount || 0), 0);
  
  const grossProfit = sales - purchases;
  const netProfit = grossProfit - expenses;
  const profitMargin = sales > 0 ? ((netProfit / sales) * 100).toFixed(2) : 0;
  
  const html = `
  <div style="padding:20px; background:white; border-radius:8px;">
    <h2 style="text-align:center; margin-bottom:20px;">PROFIT & LOSS STATEMENT</h2>
    <p style="text-align:center; color:#666; margin-bottom:30px;">For the period: ${new Date().toLocaleDateString('en-IN')}</p>
    
    <table style="width:100%; border-collapse:collapse; max-width:600px; margin:0 auto;">
      <tr style="background:#f0f0f0; font-weight:bold;">
        <td style="padding:10px; border:1px solid #ddd;">Particulars</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">Amount (₹)</td>
      </tr>
      
      <tr style="background:#ffffcc;">
        <td style="padding:10px; border:1px solid #ddd; font-weight:bold;">REVENUE</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right; font-weight:bold;">₹${sales.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      
      <tr>
        <td style="padding:10px; border:1px solid #ddd;">Cost of Goods Sold</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">-₹${purchases.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      
      <tr style="background:#e8f5e9;">
        <td style="padding:10px; border:1px solid #ddd; font-weight:bold;">GROSS PROFIT</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right; font-weight:bold;">₹${grossProfit.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      
      <tr>
        <td style="padding:10px; border:1px solid #ddd;">Operating Expenses</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">-₹${expenses.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      
      <tr style="background:#ccffcc; font-weight:bold; font-size:16px;">
        <td style="padding:10px; border:1px solid #ddd;">NET PROFIT</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">₹${netProfit.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      
      <tr>
        <td style="padding:10px; border:1px solid #ddd;">Profit Margin (%)</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">${profitMargin}%</td>
      </tr>
    </table>
    
    <button class="btn btn-primary" style="margin-top:20px;" onclick="printReport('pl')">Print</button>
    <button class="btn btn-outline" onclick="exportReportPDF('pl')">Export PDF</button>
  </div>`;
  
  const el = document.getElementById('reportContent');
  if (el) el.innerHTML = html;
}

// ════════════════════════════════════════════════════════════════════════════════
// FIX #14: CASH FLOW REPORT - Complete
// ════════════════════════════════════════════════════════════════════════════════

function generateCashFlowReport() {
  goPage('reports');
  
  const cashInFromSales = (DB.sales || []).filter(s => s.mode === 'Cash').reduce((a, s) => a + (s.total || 0), 0);
  const cashOutFromPurchases = (DB.purchases || []).filter(p => p.mode === 'Cash').reduce((a, p) => a + (p.total || 0), 0);
  const cashOutFromExpenses = (DB.expenses || []).reduce((a, e) => a + (e.amount || 0), 0);
  const netCashFlow = cashInFromSales - cashOutFromPurchases - cashOutFromExpenses;
  
  const bankInflow = (DB.payments || []).filter(p => p.type === 'RECEIVED' && p.mode === 'Bank').reduce((a, p) => a + (p.amount || 0), 0);
  const totalInflow = cashInFromSales + bankInflow;
  const totalOutflow = cashOutFromPurchases + cashOutFromExpenses;
  
  const html = `
  <div style="padding:20px; background:white; border-radius:8px;">
    <h2 style="text-align:center; margin-bottom:20px;">CASH FLOW STATEMENT</h2>
    <p style="text-align:center; color:#666; margin-bottom:30px;">As of ${new Date().toLocaleDateString('en-IN')}</p>
    
    <table style="width:100%; border-collapse:collapse; max-width:600px; margin:0 auto;">
      <tr style="background:#f0f0f0; font-weight:bold;">
        <td style="padding:10px; border:1px solid #ddd;">Particulars</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">Amount (₹)</td>
      </tr>
      
      <tr style="background:#ffffcc;">
        <td colspan="2" style="padding:10px; border:1px solid #ddd; font-weight:bold;">OPERATING ACTIVITIES</td>
      </tr>
      
      <tr>
        <td style="padding:10px 30px; border:1px solid #ddd;">Cash from Sales</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">₹${cashInFromSales.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      
      <tr>
        <td style="padding:10px 30px; border:1px solid #ddd;">Cash from Receivables</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">₹${bankInflow.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      
      <tr>
        <td style="padding:10px 30px; border:1px solid #ddd;">Cash for Purchases</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">-₹${cashOutFromPurchases.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      
      <tr>
        <td style="padding:10px 30px; border:1px solid #ddd;">Cash for Expenses</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">-₹${cashOutFromExpenses.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      
      <tr style="background:#e8f5e9; font-weight:bold;">
        <td style="padding:10px; border:1px solid #ddd;">NET CASH FLOW</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">₹${netCashFlow.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
      
      <tr style="background:#ccffcc; font-weight:bold;">
        <td style="padding:10px; border:1px solid #ddd;">Closing Cash Balance</td>
        <td style="padding:10px; border:1px solid #ddd; text-align:right;">₹${(DB.cash || 0).toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      </tr>
    </table>
    
    <button class="btn btn-primary" style="margin-top:20px;" onclick="printReport('cashflow')">Print</button>
    <button class="btn btn-outline" onclick="exportReportPDF('cashflow')">Export PDF</button>
  </div>`;
  
  const el = document.getElementById('reportContent');
  if (el) el.innerHTML = html;
}

// ════════════════════════════════════════════════════════════════════════════════
// FIX #15: STOCK MANAGEMENT - Complete
// ════════════════════════════════════════════════════════════════════════════════

function openStockManagement() {
  goPage('inventory');
  renderStockList();
}

function renderStockList() {
  const list = document.getElementById('stockList');
  if (!list) return;
  
  const items = DB.items || [];
  const lowStock = items.filter(i => i.stock <= i.min);
  const outOfStock = items.filter(i => i.stock === 0);
  const totalValue = items.reduce((a, i) => a + (i.stock * (i.pRate || 0)), 0);
  
  list.innerHTML = `
  <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:20px;">
    <div style="padding:15px; background:#e8f5e9; border-radius:8px; text-align:center;">
      <div style="font-weight:700; font-size:20px; color:#0fa968;">${items.length}</div>
      <div style="font-size:12px; color:#666;">Total Items</div>
    </div>
    <div style="padding:15px; background:#fff3e0; border-radius:8px; text-align:center;">
      <div style="font-weight:700; font-size:20px; color:#ff9800;">${lowStock.length}</div>
      <div style="font-size:12px; color:#666;">Low Stock</div>
    </div>
    <div style="padding:15px; background:#ffebee; border-radius:8px; text-align:center;">
      <div style="font-weight:700; font-size:20px; color:#d32f2f;">${outOfStock.length}</div>
      <div style="font-size:12px; color:#666;">Out of Stock</div>
    </div>
  </div>
  
  <div style="padding:10px; background:#f0f0f0; border-radius:8px; margin-bottom:15px; display:flex; justify-content:space-between;">
    <span style="font-weight:700;">Total Inventory Value</span>
    <span style="font-weight:700; color:#0066cc;">₹${totalValue.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
  </div>
  
  <div style="margin-bottom:15px;">
    <input type="text" id="stockSearch" placeholder="Search items..." oninput="filterStockList(this.value)" 
           style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; font-size:14px;">
  </div>
  
  <div style="max-height:500px; overflow-y:auto;">
    ${items.map(item => `
      <div style="padding:12px; border:1px solid #eee; border-radius:6px; margin-bottom:8px; background:${item.stock === 0 ? '#ffebee' : item.stock <= item.min ? '#fff3e0' : '#fff'};">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600;">${item.name}</div>
            <div style="font-size:12px; color:#666;">${item.hsn || '—'} · ${item.unit} · Min: ${item.min}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; font-size:16px; color:${item.stock === 0 ? '#d32f2f' : item.stock <= item.min ? '#ff9800' : '#0fa968'};">
              Stock: ${item.stock}
            </div>
            <button class="btn btn-sm btn-outline" style="margin-top:5px; padding:4px 8px; font-size:11px;" onclick="editStockItem('${item.id}')">Edit</button>
          </div>
        </div>
      </div>
    `).join('')}
  </div>`;
}

function filterStockList(term) {
  const items = DB.items || [];
  const filtered = items.filter(i => 
    i.name.toLowerCase().includes(term.toLowerCase()) ||
    (i.hsn || '').toLowerCase().includes(term.toLowerCase())
  );
  
  const list = document.getElementById('stockList');
  if (list) {
    list.innerHTML = filtered.map(item => `
      <div style="padding:12px; border:1px solid #eee; border-radius:6px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600;">${item.name}</div>
            <div style="font-size:12px; color:#666;">${item.hsn || '—'} · ${item.unit}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; color:${item.stock === 0 ? '#d32f2f' : item.stock <= item.min ? '#ff9800' : '#0fa968'};">
              Stock: ${item.stock}
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }
}

function editStockItem(itemId) {
  const item = DB.items.find(i => i.id === itemId);
  if (!item) return;
  
  const newStock = prompt('Update stock for ' + item.name + ':\nCurrent: ' + item.stock, item.stock);
  if (newStock !== null && !isNaN(newStock)) {
    item.stock = Number(newStock);
    saveToDB();
    renderStockList();
    toast('✅ Stock updated');
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════════

function printReport(type) {
  window.print();
}

function exportReportPDF(type) {
  const content = document.getElementById('reportContent').innerHTML;
  const element = document.createElement('div');
  element.innerHTML = content;
  
  html2pdf().set({
    margin: 10,
    filename: type + '_' + new Date().getTime() + '.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
  }).from(element).save();
  
  toast('✅ PDF exported');
}

function openSheet(sheetId) {
  const sheet = document.getElementById(sheetId);
  if (sheet) {
    sheet.style.display = 'flex';
    sheet.scrollIntoView({ behavior: 'smooth' });
  }
}

function closeSheet(sheetId) {
  const sheet = document.getElementById(sheetId);
  if (sheet) {
    sheet.style.display = 'none';
  }
}

function goPage(pageName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageName);
  if (page) page.classList.add('active');
}

function toast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${message.includes('❌') ? '#d32f2f' : '#0fa968'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 9999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease-out;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
