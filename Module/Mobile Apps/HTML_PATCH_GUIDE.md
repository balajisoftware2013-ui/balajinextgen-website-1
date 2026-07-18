# Balaji Business OS v17 — HTML Implementation Guide

## 1. ADD SYNC FUNCTIONS (FIX I — Real-Time Sheet Sync)

Add these functions to your app's JavaScript (around where `recordPurchase()` and `recordSale()` are defined):

```javascript
// ═════════════════════════════════════════════════════════════════
// REAL-TIME SYNC FUNCTIONS (v17 FIX I) — Call on every transaction
// ═════════════════════════════════════════════════════════════════

async function syncPurchaseRow(purchase) {
  // Call immediately after logPurchaseRow to keep PURCHASES sheet in sync
  const payload = {
    action: 'SYNC_PURCHASE_ROW',
    sheetId: DB_SHEET_ID,
    id: purchase.id,
    supp: purchase.supp,
    date: purchase.date,
    total: Number(purchase.total) || 0,
    mode: purchase.mode,
    lineItems: purchase.lineItems || []
  };
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!response.ok) logError('syncPurchaseRow failed', await response.text());
  } catch (err) {
    logError('syncPurchaseRow error', err.message);
  }
}

async function syncSaleRow(sale) {
  // Call immediately after logSaleRow to keep SALES sheet in sync
  const payload = {
    action: 'SYNC_SALE_ROW',
    sheetId: DB_SHEET_ID,
    id: sale.id,
    cust: sale.cust,
    date: sale.date,
    total: Number(sale.total) || 0,
    mode: sale.mode,
    lineItems: sale.lineItems || []
  };
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!response.ok) logError('syncSaleRow failed', await response.text());
  } catch (err) {
    logError('syncSaleRow error', err.message);
  }
}

async function syncCustomerRow(customer) {
  // Call after adding/editing a customer
  const payload = {
    action: 'SYNC_CUSTOMER_ROW',
    sheetId: DB_SHEET_ID,
    id: customer.id,
    name: customer.name,
    mobile: customer.mobile || '',
    due: Number(customer.due) || 0,
    limit: Number(customer.limit) || 0,
    lastDate: customer.lastDate || ''
  };
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!response.ok) logError('syncCustomerRow failed', await response.text());
  } catch (err) {
    logError('syncCustomerRow error', err.message);
  }
}

async function syncSupplierRow(supplier) {
  // Call after adding/editing a supplier
  const payload = {
    action: 'SYNC_SUPPLIER_ROW',
    sheetId: DB_SHEET_ID,
    id: supplier.id,
    name: supplier.name,
    mobile: supplier.mobile || '',
    due: Number(supplier.due) || 0
  };
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!response.ok) logError('syncSupplierRow failed', await response.text());
  } catch (err) {
    logError('syncSupplierRow error', err.message);
  }
}

async function syncItemRow(item) {
  // Call after adding/editing an item
  const payload = {
    action: 'SYNC_ITEM_ROW',
    sheetId: DB_SHEET_ID,
    id: item.id,
    name: item.name,
    unit: item.unit || '',
    hsn: item.hsn || '',
    pRate: Number(item.pRate) || 0,
    sRate: Number(item.sRate) || 0,
    gst: Number(item.gst) || 0,
    stock: Number(item.stock) || 0,
    min: Number(item.min) || 0
  };
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!response.ok) logError('syncItemRow failed', await response.text());
  } catch (err) {
    logError('syncItemRow error', err.message);
  }
}
```

### Where to Call Sync Functions:

In your `recordPurchase()` function, after calling `logPurchaseRow()`:
```javascript
async function recordPurchase(purchase) {
  // ... existing code ...
  const logResult = await logPurchaseRow(purchase);
  if (logResult.success) {
    // NEW: Sync to sheet immediately
    await syncPurchaseRow(purchase);
    // ... rest of code ...
  }
}
```

In your `recordSale()` function, after calling `logSaleRow()`:
```javascript
async function recordSale(sale) {
  // ... existing code ...
  const logResult = await logSaleRow(sale);
  if (logResult.success) {
    // NEW: Sync to sheet immediately
    await syncSaleRow(sale);
    // ... rest of code ...
  }
}
```

In your customer add/edit function:
```javascript
async function saveCustomer(customer) {
  // ... validate & save to local DB ...
  
  // NEW: Sync to sheet
  await syncCustomerRow(customer);
  
  // ... rest of code ...
}
```

Same pattern for suppliers and items.

---

## 2. ADD REPORT FUNCTIONS (FIX K — Purchase/Sales Ledgers)

Add these functions to load report data:

```javascript
// ═════════════════════════════════════════════════════════════════
// REPORT LOADER FUNCTIONS (v17 FIX K) — Load ledger data from backend
// ═════════════════════════════════════════════════════════════════

async function loadPurchaseLedger(dateRange = null) {
  // Fetch purchase ledger for current period
  const payload = {
    action: 'GET_PURCHASE_LEDGER',
    sheetId: DB_SHEET_ID,
    data: CURRENT_DB_DATA,
    dateRange: dateRange || 'MONTH'
  };
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    return result.success ? result.ledger : [];
  } catch (err) {
    logError('loadPurchaseLedger error', err.message);
    return [];
  }
}

async function loadSalesLedger(dateRange = null) {
  // Fetch sales ledger for current period
  const payload = {
    action: 'GET_SALES_LEDGER',
    sheetId: DB_SHEET_ID,
    data: CURRENT_DB_DATA,
    dateRange: dateRange || 'MONTH'
  };
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    return result.success ? result.ledger : [];
  } catch (err) {
    logError('loadSalesLedger error', err.message);
    return [];
  }
}

async function loadItemWisePurchase(dateRange = null) {
  // Fetch item-wise purchase report
  const payload = {
    action: 'GET_ITEM_WISE_PURCHASE',
    sheetId: DB_SHEET_ID,
    data: CURRENT_DB_DATA,
    dateRange: dateRange || 'MONTH'
  };
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    return result.success ? result.report : [];
  } catch (err) {
    logError('loadItemWisePurchase error', err.message);
    return [];
  }
}

async function loadItemWiseSales(dateRange = null) {
  // Fetch item-wise sales report
  const payload = {
    action: 'GET_ITEM_WISE_SALES',
    sheetId: DB_SHEET_ID,
    data: CURRENT_DB_DATA,
    dateRange: dateRange || 'MONTH'
  };
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    return result.success ? result.report : [];
  } catch (err) {
    logError('loadItemWiseSales error', err.message);
    return [];
  }
}
```

---

## 3. ADD STOCK LEDGER FUNCTIONS (FIX L — Inventory Movements)

```javascript
// ═════════════════════════════════════════════════════════════════
// STOCK LEDGER FUNCTIONS (v17 FIX L) — Track inventory movements
// ═════════════════════════════════════════════════════════════════

async function loadStockLedger(dateRange = null) {
  // Fetch stock ledger showing all movements for each item
  const payload = {
    action: 'GET_STOCK_LEDGER',
    sheetId: DB_SHEET_ID,
    data: CURRENT_DB_DATA,
    dateRange: dateRange || 'MONTH'
  };
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    return result.success ? result.report : [];
  } catch (err) {
    logError('loadStockLedger error', err.message);
    return [];
  }
}

async function loadStockSummary() {
  // Fetch quick overview of all items (current stock, min level, status)
  const payload = {
    action: 'GET_STOCK_SUMMARY',
    sheetId: DB_SHEET_ID,
    data: CURRENT_DB_DATA
  };
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    return result.success ? result : { summary: [], lowStock: [] };
  } catch (err) {
    logError('loadStockSummary error', err.message);
    return { summary: [], lowStock: [] };
  }
}
```

---

## 4. ADD DATE RANGE SELECTOR (FIX M — Period Filtering)

Add this HTML snippet to Dashboard page:

```html
<!-- DATE RANGE SELECTOR (v17 FIX M) -->
<div class="date-range-selector" style="display:flex; gap:6px; overflow-x:auto; padding:8px 16px; margin-bottom:12px;">
  <button class="date-filter-btn" onclick="filterByDateRange('TODAY')" style="flex-shrink:0; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--body-bg); font-size:12px; font-weight:600;">Today</button>
  <button class="date-filter-btn" onclick="filterByDateRange('MONTH')" style="flex-shrink:0; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--body-bg); font-size:12px; font-weight:600;">Month</button>
  <button class="date-filter-btn" onclick="filterByDateRange('QUARTER')" style="flex-shrink:0; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--body-bg); font-size:12px; font-weight:600;">Quarter</button>
  <button class="date-filter-btn" onclick="filterByDateRange('HALF')" style="flex-shrink:0; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--body-bg); font-size:12px; font-weight:600;">Half</button>
  <button class="date-filter-btn active" onclick="filterByDateRange('FY')" style="flex-shrink:0; padding:8px 12px; border-radius:8px; border:2px solid var(--primary); background:var(--primary-light); font-size:12px; font-weight:600; color:var(--primary-dark);">FY</button>
</div>
<div id="currentDateRangeLabel" style="text-align:center; font-size:11px; color:var(--sub); margin-bottom:10px;">
  FY 2024-25 (Apr 2024 - Mar 2025)
</div>
```

Add this JavaScript:

```javascript
let CURRENT_DATE_RANGE = 'FY';

function filterByDateRange(range) {
  CURRENT_DATE_RANGE = range;
  
  // Update button states
  document.querySelectorAll('.date-filter-btn').forEach(btn => {
    btn.style.border = '1px solid var(--border)';
    btn.style.background = 'var(--body-bg)';
    btn.style.color = 'var(--text)';
  });
  event.target.style.border = '2px solid var(--primary)';
  event.target.style.background = 'var(--primary-light)';
  event.target.style.color = 'var(--primary-dark)';
  
  // Update date range label
  const label = getDateRangeLabel(range);
  document.getElementById('currentDateRangeLabel').innerText = label;
  
  // Refresh dashboard with new date range
  refreshDashboard();
}

function getDateRangeLabel(range) {
  const now = new Date();
  if (range === 'TODAY') {
    return `Today: ${now.toLocaleDateString()}`;
  } else if (range === 'MONTH') {
    return `${now.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}`;
  } else if (range === 'QUARTER') {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `Q${q} ${now.getFullYear()}`;
  } else if (range === 'HALF') {
    const h = now.getMonth() < 6 ? 'H1' : 'H2';
    return `${h} ${now.getFullYear()}`;
  } else if (range === 'FY') {
    const fy = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
    return `FY ${fy}-${String(fy+1).slice(2)}  (Apr ${fy} - Mar ${fy+1})`;
  }
  return range;
}
```

---

## 5. CREATE NEW REPORT PAGES

### Page: Purchase Ledger (`/purchase-ledger`)

```html
<div id="purchaseLedgerPage" class="page">
  <div class="topbar">
    <span onclick="openPage('dashboard')" style="cursor:pointer;">← Back</span>
    <div class="biz"><div class="biz-name">Purchase Ledger</div></div>
    <div class="icon-btn"></div>
  </div>

  <div class="search-wrap">
    <div class="date-range-selector" style="display:flex; gap:6px; overflow-x:auto; padding:8px 0;">
      <button onclick="loadPurchaseLedgerWithRange('MONTH')" class="date-btn" style="flex-shrink:0; padding:8px 12px; border-radius:8px; background:var(--body-bg); border:1px solid var(--border); font-size:11px; font-weight:600;">Month</button>
      <button onclick="loadPurchaseLedgerWithRange('QUARTER')" class="date-btn" style="flex-shrink:0; padding:8px 12px; border-radius:8px; background:var(--body-bg); border:1px solid var(--border); font-size:11px; font-weight:600;">Quarter</button>
      <button onclick="loadPurchaseLedgerWithRange('FY')" class="date-btn active" style="flex-shrink:0; padding:8px 12px; border-radius:8px; background:var(--primary-light); border:2px solid var(--primary); font-size:11px; font-weight:600;">FY</button>
    </div>
  </div>

  <div class="page" style="padding:14px 16px 8px;">
    <div id="purchaseLedgerContainer"></div>
  </div>
</div>

<script>
async function loadPurchaseLedgerWithRange(range) {
  const ledger = await loadPurchaseLedger(range);
  renderPurchaseLedger(ledger);
}

function renderPurchaseLedger(ledger) {
  const container = document.getElementById('purchaseLedgerContainer');
  if (!ledger || ledger.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="e-ico">📝</div><div class="e-title">No Purchases</div></div>';
    return;
  }

  let html = '';
  let total = 0;
  ledger.forEach(p => {
    total += p.total;
    html += `
      <div class="list-card" onclick="togglePurchaseDetail(this)">
        <div class="lc-top">
          <div>
            <div class="lc-name">${p.billNo}</div>
            <div class="lc-meta">${p.supplier} • ${p.date}</div>
          </div>
          <div class="lc-amt">${formatCurrency(p.total)}</div>
        </div>
        <div class="purchase-detail" style="display:none; margin-top:10px; padding-top:10px; border-top:1px solid var(--border);">
          <table style="width:100%; font-size:11px;">
            <thead>
              <tr style="background:var(--body-bg);">
                <th style="text-align:left; padding:5px;">Item</th>
                <th style="text-align:right; padding:5px;">Qty</th>
                <th style="text-align:right; padding:5px;">Rate</th>
                <th style="text-align:right; padding:5px;">GST%</th>
                <th style="text-align:right; padding:5px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${(p.lineItems || []).map(li => `
                <tr>
                  <td style="padding:5px;">${li.itemName}</td>
                  <td style="text-align:right; padding:5px;">${li.qty}</td>
                  <td style="text-align:right; padding:5px;">${formatCurrency(li.rate)}</td>
                  <td style="text-align:right; padding:5px;">${li.gst}%</td>
                  <td style="text-align:right; padding:5px;">${formatCurrency(li.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });

  html += `<div class="stat-card" style="margin-top:10px; text-align:right;"><div class="st-val">Total: ${formatCurrency(total)}</div></div>`;
  container.innerHTML = html;
}

function togglePurchaseDetail(el) {
  const detail = el.querySelector('.purchase-detail');
  if (detail) detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
}
</script>
```

### Page: Sales Ledger (`/sales-ledger`)

Same structure as Purchase Ledger, replace:
- `loadPurchaseLedger` → `loadSalesLedger`
- `supplier` → `customer`
- `renderPurchaseLedger` → `renderSalesLedger`

### Page: Stock Ledger (`/stock-ledger`)

```html
<div id="stockLedgerPage" class="page">
  <div class="topbar">
    <span onclick="openPage('inventory')" style="cursor:pointer;">← Back</span>
    <div class="biz"><div class="biz-name">Stock Ledger</div></div>
    <div class="icon-btn"></div>
  </div>

  <div class="page" style="padding:14px 16px 8px;">
    <div id="stockLedgerContainer"></div>
  </div>
</div>

<script>
async function loadAndRenderStockLedger(dateRange = 'MONTH') {
  const ledger = await loadStockLedger(dateRange);
  renderStockLedger(ledger);
}

function renderStockLedger(ledger) {
  const container = document.getElementById('stockLedgerContainer');
  if (!ledger || ledger.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="e-ico">📦</div><div class="e-title">No Stock Movements</div></div>';
    return;
  }

  let html = '';
  ledger.forEach(item => {
    html += `
      <div class="list-card">
        <div class="lc-name">${item.itemName} (${item.unit})</div>
        <div class="lc-meta">Opening: ${item.openingStock} | Closing: ${item.closingStock}</div>
        <table style="width:100%; font-size:10.5px; margin-top:8px;">
          <thead>
            <tr style="background:var(--body-bg);">
              <th style="text-align:left; padding:4px;">Date</th>
              <th style="text-align:left; padding:4px;">Type</th>
              <th style="text-align:left; padding:4px;">Party</th>
              <th style="text-align:right; padding:4px;">Qty</th>
              <th style="text-align:right; padding:4px;">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${(item.movements || []).map(m => `
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:4px;">${m.date}</td>
                <td style="padding:4px;">${m.type}</td>
                <td style="padding:4px;">${m.party}</td>
                <td style="text-align:right; padding:4px; color:${m.qty>0 ? 'var(--green)' : 'var(--red)'}">${m.qty>0 ? '+' : ''}${m.qty}</td>
                <td style="text-align:right; padding:4px; font-weight:600;">${m.balance}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });

  container.innerHTML = html;
}
</script>
```

---

## 6. UPDATE EXISTING FUNCTIONS

### In `submitLogin()`:
Add date range initialization:
```javascript
CURRENT_DATE_RANGE = 'FY';
refreshDashboard();
```

### In Navigation:
Add new menu items:
```javascript
// Add to sidebar/drawer items
{icon: '📊', label: 'Purchase Ledger', action: () => openPage('purchase-ledger')},
{icon: '💰', label: 'Sales Ledger', action: () => openPage('sales-ledger')},
{icon: '📦', label: 'Stock Ledger', action: () => openPage('stock-ledger')},
{icon: '📈', label: 'Stock Summary', action: () => openPage('stock-summary')},
```

---

## 7. TESTING CHECKLIST

- [ ] All sync functions call correctly on add/edit
- [ ] Sheet tabs (PURCHASES, SALES, CUSTOMERS, SUPPLIERS, ITEMS) populated after transactions
- [ ] Purchase Ledger page loads and displays items correctly
- [ ] Sales Ledger page loads and displays items correctly
- [ ] Stock Ledger shows opening/closing stock and running balance
- [ ] Date filters work (TODAY, MONTH, QUARTER, FY)
- [ ] Reports refresh when date range changes
- [ ] Offline mode: app works without sync
- [ ] Online mode: app syncs after reconnect

---

## 8. PERFORMANCE NOTES

- Sync functions are async, do not block UI
- Report generation is fast for <1000 transactions
- Use pagination if reports have >500 items
- Consider debouncing date range changes if loading is slow

