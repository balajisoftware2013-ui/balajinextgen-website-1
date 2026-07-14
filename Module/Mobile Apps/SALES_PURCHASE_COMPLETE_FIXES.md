# Balaji Business OS — SALES & PURCHASE Reports Complete Fix

**Column-Wise Reports + Filter Fixes for BOTH Sales & Purchase**

---

## Overview

This document extends all fixes to **BOTH Sales AND Purchase** reports:
- ✅ Day/Month/Year/Custom filtering for both
- ✅ Column-wise matrix views for both
- ✅ Toggle bug fix for both
- ✅ Same professional month-over-month comparison

---

## 🔴 ISSUE #1: Toggle Bug (Sales + Purchase)

### Current Problem
Both Sales and Purchase registers have the same toggle bug:
```
Click "Sales Register" → Opens ✓
Click "Month" filter → Refreshes ✓
Click "Sales Register" AGAIN → HIDES ✗ (BUG)

Same for "Purchase Register" button
```

### Fix (Line 6506-6530)
**Replace the entire toggle block in openReport():**

```javascript
function openReport(type, el){
  // v50: Removed toggle logic that was hiding reports
  // Now: Always OPEN/SHOW report when clicked
  // Close via: Filter chips or navigation (intentional)
  
  _lastReportType = type;
  _currentReportOpen = type;
  
  if(el){ 
    document.querySelectorAll('.rpt-type').forEach(t=>t.classList.remove('active')); 
    el.classList.add('active'); 
  }
  
  // ... continue with rest of function ...
}
```

**This fixes both:**
- ✅ Sales Register no longer hides
- ✅ Purchase Register no longer hides
- ✅ All report types work the same way

---

## 🔴 ISSUE #2: Filter Not Applied to Sales Reports

### Sales Register (Line 6575)
**Current (WRONG):**
```javascript
} else if(type==='sales'){
    tbl = _renderRegisterTable(sales, {...});  // sales is already filtered ✓
```
✅ This one is CORRECT (uses `filterSalesForReport()` defined at line 6551)

### Sales Month-Wise (Line 6834) — WRONG
**Current:**
```javascript
} else if(type==='salesmonthwise'){
    tbl = renderGroupedRegister(DB.sales||[], 'month', {...});  // ❌ Uses ALL sales
```

**Fixed:**
```javascript
} else if(type==='salesmonthwise'){
    const filtered = filterSalesForReport();  // ✅ Apply filter
    tbl = renderGroupedRegister(filtered, 'month', {...});
```

### Sales Customer-Wise (Line 6838-6844) — PARTIALLY WRONG
**Current:**
```javascript
} else if(type==='salescustomerwise'){
    const byC = {};
    sales.forEach(s=>{...});  // ✅ 'sales' already filtered from line 6551
```
✅ This is CORRECT (uses filtered sales)

### Sales Item-Wise (Line 6863-6867) — CORRECT
```javascript
} else if(type==='salesitemwise'){
    const itemSales = {};
    sales.forEach(s=>(s.lineItems||[]).forEach(li=>{...}));  // ✅ filtered
```
✅ This is CORRECT

### Sales Category-Wise (Line 6874-6878) — CORRECT
```javascript
} else if(type==='salescategorywise'){
    const catSales = {};
    sales.forEach(s=>(s.lineItems||[]).forEach(li=>{...}));  // ✅ filtered
```
✅ This is CORRECT

---

## 🔴 ISSUE #3: Filter Not Applied to Purchase Reports

### Purchase Register (Line 6560)
**Current (CORRECT):**
```javascript
} else if(type==='purchase'){
    const rows = type==='sales' ? sales : filterByDateRange(DB.purchases||[], 'date');
```
✅ Applies filter correctly

### Purchase Month-Wise (Line 6836) — WRONG
**Current:**
```javascript
} else if(type==='purchmonthwise'){
    tbl = renderGroupedRegister(DB.purchases||[], 'month', {...});  // ❌ Uses ALL
```

**Fixed:**
```javascript
} else if(type==='purchmonthwise'){
    const filtered = filterByDateRange(DB.purchases||[], 'date');  // ✅ Apply filter
    tbl = renderGroupedRegister(filtered, 'month', {...});
```

### Purchase Supplier-Wise (Line 6845-6852) — CORRECT
```javascript
} else if(type==='purchsupplierwise'){
    const periodPurch = filterByDateRange(DB.purchases||[], 'date');  // ✅ Filtered
```
✅ Correctly applies filter

### Purchase Supplier Month-Wise (Line 6853-6857) — WRONG
**Current:**
```javascript
} else if(type==='purchsuppmonthwise'){
    const bySM = {};
    (DB.purchases||[]).forEach(p=>{...});  // ❌ Uses ALL purchases
```

**Fixed:**
```javascript
} else if(type==='purchsuppmonthwise'){
    const filtered = filterByDateRange(DB.purchases||[], 'date');  // ✅ Filter first
    const bySM = {};
    filtered.forEach(p=>{...});
```

### Purchase Item-Wise (Line 6868-6873) — WRONG
**Current:**
```javascript
} else if(type==='purchitemwise'){
    const periodPurch = filterByDateRange(DB.purchases||[], 'date');  // ✓ filtered
    const itemPurch = {};
    periodPurch.forEach(p=>(p.lineItems||[]).forEach(li=>{...}));  // ✓ uses filtered
```
✅ This is CORRECT

### Purchase Category-Wise (Line 6879-6884) — CORRECT
```javascript
} else if(type==='purchcategorywise'){
    const periodPurch = filterByDateRange(DB.purchases||[], 'date');  // ✓ filtered
```
✅ This is CORRECT

---

## ✨ NEW FEATURE: Column-Wise Purchase Matrix

### Create `_renderPurchaseColumnWiseHTML()`

```javascript
function _renderPurchaseColumnWiseHTML(){
  // Matrix: Months as columns, totals/counts as rows
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
  
  // Row 1: Total Purchase Amount
  html += `<tr style="border-bottom:1px solid var(--border);background:var(--primary-light);">
    <td style="text-align:left;padding:8px 6px;font-weight:700;">Total Purchases</td>`;
  
  let grandTotal = 0;
  months.forEach(m => {
    const total = byMonth[m].reduce((a,p)=>a+p.total,0);
    grandTotal += total;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;font-weight:700;">${fmt(total)}</td>`;
  });
  
  html += `<td class="mono" style="text-align:right;padding:8px 6px;font-weight:900;border-left:2px solid var(--border);">${fmt(grandTotal)}</td></tr>`;
  
  // Row 2: Bill/GRN Count
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
  
  // Row 4: Suppliers Count (unique suppliers per month)
  html += `<tr style="border-bottom:1px solid var(--border);">
    <td style="text-align:left;padding:8px 6px;font-size:11px;color:#B45309;">🏢 Suppliers</td>`;
  
  months.forEach(m => {
    const suppliers = new Set(byMonth[m].map(p=>(DB.suppliers.find(s=>s.id===p.supp)||{}).name));
    html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#B45309;font-size:11px;">${suppliers.size}</td>`;
  });
  
  const allSuppliers = new Set(purchases.map(p=>(DB.suppliers.find(s=>s.id===p.supp)||{}).name));
  html += `<td class="mono" style="text-align:right;padding:8px 6px;color:#B45309;font-weight:700;border-left:2px solid var(--border);">${allSuppliers.size}</td></tr>`;
  
  // Row 5: Items Count (unique items per month)
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
  
  // Row 6: Payment Mode Breakdown (Cash vs Credit)
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
      📊 Click any month in Month-wise view to drill down and see individual GRNs.
    </div>`;
  
  return html;
}
```

### Add to openReport() (line ~6836)

**Add BEFORE purchmonthwise case:**
```javascript
} else if(type==='purchasematrix'){
    tbl = _renderPurchaseColumnWiseHTML();
```

### Add HTML Button (line ~1373)

```html
<!-- Purchase Reports Section -->
<button class="rpt-type" onclick="openReport('purchase',this)">Purchase Register</button>
<button class="rpt-type" onclick="openReport('purchsummary',this)">Purchase Summary</button>
<button class="rpt-type" onclick="openReport('purchmonthwise',this)">Month-wise</button>
<button class="rpt-type" onclick="openReport('purchasematrix',this)">📊 Matrix</button>
<!-- ... rest of purchase buttons ... -->
```

### Add to Titles (line 6537-6538)

```javascript
purchasematrix:'Purchase Matrix — Month Columns',
```

---

## 📊 Comparison: Sales vs Purchase Matrix

### Sales Matrix
```
Metric          │ Apr    │ May    │ Jun    │ Total
─────────────────────────────────────────────
Total Sales     │ ₹150K  │ ₹180K  │ ₹165K  │ ₹495K
Transactions    │ 45     │ 52     │ 48     │ 145
Avg/Transaction │ ₹3.3K  │ ₹3.5K  │ ₹3.4K  │ ₹3.4K
💵 Cash/UPI     │ ₹120K  │ ₹145K  │ ₹140K  │ ₹405K
📋 Credit       │ ₹30K   │ ₹35K   │ ₹25K   │ ₹90K
```

### Purchase Matrix
```
Metric          │ Apr    │ May    │ Jun    │ Total
─────────────────────────────────────────────
Total Purchases │ ₹200K  │ ₹250K  │ ₹220K  │ ₹670K
Bills/GRNs      │ 32     │ 38     │ 35     │ 105
Avg/Bill        │ ₹6.2K  │ ₹6.6K  │ ₹6.3K  │ ₹6.4K
🏢 Suppliers    │ 8      │ 9      │ 8      │ 12
📦 Items        │ 28     │ 31     │ 27     │ 45
💰 Cash         │ ₹150K  │ ₹180K  │ ₹160K  │ ₹490K
📋 Credit       │ ₹50K   │ ₹70K   │ ₹60K   │ ₹180K
```

---

## 📋 Complete Filter Fix Checklist

### Line 6834 — Sales Month-Wise
```javascript
// BEFORE:
tbl = renderGroupedRegister(DB.sales||[], 'month', {...});

// AFTER:
const filtered = filterSalesForReport();
tbl = renderGroupedRegister(filtered, 'month', {...});
```

### Line 6836 — Purchase Month-Wise
```javascript
// BEFORE:
tbl = renderGroupedRegister(DB.purchases||[], 'month', {...});

// AFTER:
const filtered = filterByDateRange(DB.purchases||[], 'date');
tbl = renderGroupedRegister(filtered, 'month', {...});
```

### Line 6853-6857 — Purchase Supplier Month-Wise
```javascript
// BEFORE:
const bySM = {};
(DB.purchases||[]).forEach(p=>{...});

// AFTER:
const filtered = filterByDateRange(DB.purchases||[], 'date');
const bySM = {};
filtered.forEach(p=>{...});
```

---

## 🎯 Summary of All Changes

### CRITICAL FIXES (4 minutes)
| Line(s) | Report Type | Change | Status |
|---------|-------------|--------|--------|
| 6506-6530 | All | Remove toggle logic | Essential |
| 6834-6835 | Sales Month-Wise | Add filterSalesForReport() | Essential |
| 6836-6837 | Purchase Month-Wise | Add filterByDateRange() | Essential |
| 6853-6857 | Purchase Supplier Month-Wise | Add filterByDateRange() | Essential |

### RECOMMENDED ENHANCEMENTS (20 minutes)
| Line(s) | Report Type | Change | Status |
|---------|-------------|--------|--------|
| NEW | Sales Matrix | Add _renderSalesColumnWiseHTML() | Enhancement |
| NEW | Purchase Matrix | Add _renderPurchaseColumnWiseHTML() | Enhancement |
| 1366 | HTML Buttons | Add Matrix buttons for both | Enhancement |
| 6537-6538 | Titles | Add matrix titles for both | Enhancement |

---

## ✅ Final Testing Checklist

### Sales Reports
```
[ ] Click "Sales Register" → "Month" filter → "Sales Register" again (no hide)
[ ] Click "Sales Month-wise" → shows all months of current FY
[ ] Click "Day" filter → shows only TODAY's sales
[ ] Click "Sales Matrix" (if added) → see months as columns
[ ] Click "Year" filter → Matrix updates to current FY
```

### Purchase Reports
```
[ ] Click "Purchase Register" → "Month" filter → "Purchase Register" again (no hide)
[ ] Click "Purchase Month-wise" → shows all months of current FY
[ ] Click "Day" filter → shows only TODAY's purchases
[ ] Click "Purchase Matrix" (if added) → see months as columns
[ ] Click "Year" filter → Matrix updates to current FY
```

### Cross-Report Consistency
```
[ ] All reports respect Day/Month/Year/Custom filters uniformly
[ ] Matrix views show same period for both Sales and Purchase
[ ] Toggle logic removed from ALL report types
[ ] Export/Print works for both old and new reports
```

---

## 🚀 Complete Implementation Order

**Session 1 (5 minutes — CRITICAL):**
1. Line 6506-6530: Remove toggle logic
2. Line 6834-6835: Add filter to salesmonthwise
3. Line 6836-6837: Add filter to purchmonthwise
4. Line 6853-6857: Add filter to purchsuppmonthwise

**Session 2 (10 minutes — RECOMMENDED):**
5. Add _renderSalesColumnWiseHTML() function
6. Add _renderPurchaseColumnWiseHTML() function
7. Add salesmatrix case to openReport()
8. Add purchasematrix case to openReport()

**Session 3 (5 minutes — OPTIONAL UI):**
9. Add Matrix buttons to HTML (line 1366)
10. Add matrix titles to titles object (line 6537)

---

**Total Time: ~20 minutes for full implementation**
**Difficulty: Easy (mostly copy-paste)**
**Impact: HUGE (fixes + new features for both Sales & Purchase)**
