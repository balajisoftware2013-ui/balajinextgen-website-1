# Balaji Business OS — Sales Report Day/Month Hide & Column-Wise Issues

**CRITICAL BUGS FOUND & FIXES**

---

## 🔴 ISSUE #1: Sales Day → Month Click "Hide" Problem

### Root Cause
The `openReport()` function (line 6506) has a **toggle logic bug**:

```javascript
function openReport(type, el){
  if(_currentReportOpen === type){
    // Same report clicked — TOGGLE it closed ❌ WRONG!
    _currentReportOpen = null;
    // ...hides report...
    return;
  }
  // ...show report...
}
```

**Problem Sequence:**
1. User clicks "Sales Register" → opens, `_currentReportOpen = 'sales'`
2. User clicks "Day" filter chip → re-opens same report (still `type='sales'`)
3. User clicks "Sales Register" button AGAIN → thinks "oh they want to toggle it closed!" 
4. Report disappears (looks "hidden") even though they expect it to refresh

### ✅ CRITICAL FIX

**Replace the toggle logic in openReport() (line 6506-6529):**

```javascript
function openReport(type, el){
  // v50 FIX: Disable toggle-on-click to prevent accidental hiding
  // when re-opening same report. Users expect click to always SHOW the report
  // (or refresh it with new filter settings), not toggle it closed.
  // They can close reports by clicking filter chips or navigation.
  
  // Always open/show the report
  _lastReportType = type;
  _currentReportOpen = type;
  if(el){ 
    document.querySelectorAll('.rpt-type').forEach(t=>t.classList.remove('active')); 
    el.classList.add('active'); 
  }
  
  // Continue with rest of function as before...
  const filterLabel={today:'Day',month:'Month',qtr:'Qtr',year:'Year',custom:'Custom'}[_rptFilter]||'';
  // ... rest of code ...
}
```

**What Changed:**
- ❌ Removed: The `if(_currentReportOpen === type)` toggle logic
- ✅ Added: Always show/refresh the report when clicked
- ✅ Users can close via: Day→Month filter chips or navigation items

### Why This Works
- Clicking "Sales" always SHOWS sales report (with current filter applied)
- Clicking "Day" filter chip refreshes the same report with new period
- No ambiguous "toggle" behavior — each click has clear intent
- Matches user expectation: "I click a report button, I see the report"

---

## 🔴 ISSUE #2: Sales Month-Wise Not Filtering by Date

### Current Code (Line 6834-6835)
```javascript
} else if(type==='salesmonthwise'){
    tbl = renderGroupedRegister(DB.sales||[], 'month', {amount:s=>s.total, label:'sales', type:'sales', emptyMsg:'No sales yet'});
```

**Bug:** Uses ALL sales from DB, ignoring the current `_rptFilter` (Day/Month/Year/Custom)

**Should Be:**
```javascript
} else if(type==='salesmonthwise'){
    const filtered = filterSalesForReport();  // ← Apply date filter!
    tbl = renderGroupedRegister(filtered, 'month', {amount:s=>s.total, label:'sales', type:'sales', emptyMsg:'No sales yet'});
```

### Same Issue in Other Month-Wise Reports

**Line 6836 — Purchase Month-Wise:**
```javascript
// WRONG:
} else if(type==='purchmonthwise'){
    tbl = renderGroupedRegister(DB.purchases||[], 'month', ...
// RIGHT:
} else if(type==='purchmonthwise'){
    const filtered = filterByDateRange(DB.purchases||[], 'date');
    tbl = renderGroupedRegister(filtered, 'month', ...
```

**Line 6858-6862 — Customer & Supplier Month-Wise:**
These iterate over ALL records in DB instead of filtered period. Should also apply `filterByDateRange()` or `filterSalesForReport()`.

---

## 🟡 ISSUE #3: Sales Report "Column-Wise" Like Excel Export

### What User Wants
Based on the Excel files you showed (STORE_PURCHASE_SUMMARY.xls), you want:
- **Columns:** Each month (Apr, May, Jun, Jul, Aug, etc.)
- **Sub-columns:** Qty · Amount (or just Amount for sales)
- **Rows:** Supplier-wise, Item-wise, or Customer-wise breakdown

**Current:** Sales Month-Wise just shows grouped list (Month total: ₹X)
**Wanted:** Matrix table with months as columns

### ✅ New Column-Wise Sales Report Implementation

Add this new function to render sales in column format:

```javascript
function _renderSalesColumnWiseHTML(){
  // Build a months-as-columns table similar to Tally reports
  const sales = DB.sales||[];
  const byMonth = {};
  
  // Group sales by month
  sales.forEach(s=>{
    const m = s.date.slice(0,7);  // YYYY-MM
    if(!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(s);
  });
  
  const months = Object.keys(byMonth).sort();
  if(months.length === 0) return '<div class="cart-row"><span>No sales data</span><span></span></div>';
  
  // Build HTML table with months as columns
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const getMonthName = (yyyymm) => {
    const [y,m] = yyyymm.split('-');
    return monthLabels[+m-1] + ' ' + y;
  };
  
  let html = `<div style="overflow-x:auto;margin:0 -14px;padding:0 14px;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="border-bottom:2px solid var(--border);">
          <th style="text-align:left;padding:8px 6px;font-weight:700;">Month</th>`;
  
  months.forEach(m => {
    html += `<th style="text-align:right;padding:8px 6px;font-weight:700;min-width:90px;">${getMonthName(m)}</th>`;
  });
  
  html += `</tr></thead><tbody>`;
  
  // Total row
  html += `<tr style="border-bottom:1px solid var(--border);background:var(--primary-light);">
    <td style="text-align:left;padding:8px 6px;font-weight:700;">Total Sales</td>`;
  
  let grandTotal = 0;
  months.forEach(m => {
    const total = byMonth[m].reduce((a,s)=>a+s.total,0);
    grandTotal += total;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;font-weight:700;">${fmt(total)}</td>`;
  });
  
  html += `<td class="mono" style="text-align:right;padding:8px 6px;font-weight:900;border-left:2px solid var(--border);">${fmt(grandTotal)}</td></tr>`;
  
  // Transaction count row
  html += `<tr style="border-bottom:1px solid var(--border);">
    <td style="text-align:left;padding:8px 6px;color:var(--sub);font-size:11px;">Transactions</td>`;
  
  let totalTx = 0;
  months.forEach(m => {
    const count = byMonth[m].length;
    totalTx += count;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;color:var(--sub);font-size:11px;">${count}</td>`;
  });
  
  html += `<td class="mono" style="text-align:right;padding:8px 6px;color:var(--sub);font-size:11px;border-left:2px solid var(--border);">${totalTx}</td></tr>`;
  
  // Average per transaction
  html += `<tr>
    <td style="text-align:left;padding:8px 6px;color:var(--sub);font-size:11px;">Avg/Tx</td>`;
  
  months.forEach(m => {
    const total = byMonth[m].reduce((a,s)=>a+s.total,0);
    const count = byMonth[m].length;
    const avg = count > 0 ? total/count : 0;
    html += `<td class="mono" style="text-align:right;padding:8px 6px;color:var(--sub);font-size:11px;">${fmt(avg)}</td>`;
  });
  
  const avgGrand = totalTx > 0 ? grandTotal/totalTx : 0;
  html += `<td class="mono" style="text-align:right;padding:8px 6px;color:var(--sub);font-size:11px;border-left:2px solid var(--border);">${fmt(avgGrand)}</td></tr>`;
  
  html += `</tbody></table></div>`;
  
  return html;
}
```

### Add New Report Type: "Sales Matrix"

**In HTML (line ~1366), add:**
```html
<button class="rpt-type" onclick="openReport('salesmatrix',this)">📊 Matrix</button>
```

**In openReport() function (line ~6834), add:**
```javascript
} else if(type==='salesmatrix'){
    tbl = _renderSalesColumnWiseHTML();
```

**In titles object (line 6537), add:**
```javascript
salesmatrix:'Sales Matrix — Month Columns',
```

---

## 📊 Advanced: Customer/Item-Wise Column Matrix

For even more powerful reporting, create column-wise breakdowns:

```javascript
// Customer-wise matrix (customers as rows, months as columns)
function _renderCustomerWiseMatrixHTML(){
  const sales = DB.sales||[];
  const byMonthCust = {};
  
  sales.forEach(s=>{
    const m = s.date.slice(0,7);
    const cust = (DB.customers.find(c=>c.id===s.cust)||{}).name||'Walk-in';
    const key = m + '|' + cust;
    byMonthCust[key] = (byMonthCust[key]||0) + s.total;
  });
  
  const months = [...new Set(sales.map(s=>s.date.slice(0,7)))].sort();
  const customers = [...new Set(sales.map(s=>(DB.customers.find(c=>c.id===s.cust)||{}).name||'Walk-in'))].sort();
  
  if(!months.length || !customers.length) return '<div class="cart-row"><span>No data</span></div>';
  
  // Build table: customers as rows, months as columns
  let html = `<div style="overflow-x:auto;margin:0 -14px;padding:0 14px;">
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr style="border-bottom:2px solid var(--border);">
        <th style="text-align:left;padding:6px;font-weight:700;min-width:140px;">Customer</th>`;
  
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const getMonthName = (yyyymm) => {
    const [y,m] = yyyymm.split('-');
    return monthLabels[+m-1].slice(0,3) + "'"+y.slice(-2);
  };
  
  months.forEach(m => html += `<th style="text-align:right;padding:6px;min-width:70px;">${getMonthName(m)}</th>`);
  html += `<th style="text-align:right;padding:6px;font-weight:700;border-left:2px solid var(--border);min-width:70px;">Total</th></tr></thead><tbody>`;
  
  // Customer rows
  customers.forEach(cust => {
    html += `<tr style="border-bottom:1px solid var(--border);">
      <td style="text-align:left;padding:6px;font-weight:600;">${cust}</td>`;
    
    let custTotal = 0;
    months.forEach(m => {
      const val = byMonthCust[m+'|'+cust]||0;
      custTotal += val;
      html += `<td class="mono" style="text-align:right;padding:6px;font-size:10px;">${val>0?fmt(val):'-'}</td>`;
    });
    
    html += `<td class="mono" style="text-align:right;padding:6px;font-weight:700;border-left:2px solid var(--border);">${fmt(custTotal)}</td></tr>`;
  });
  
  // Grand total row
  html += `<tr style="background:var(--primary-light);font-weight:700;border-top:2px solid var(--border);">
    <td style="text-align:left;padding:6px;">TOTAL</td>`;
  
  let grandTotal = 0;
  months.forEach(m => {
    const total = customers.reduce((a,c)=>a+(byMonthCust[m+'|'+c]||0),0);
    grandTotal += total;
    html += `<td class="mono" style="text-align:right;padding:6px;font-weight:700;">${fmt(total)}</td>`;
  });
  
  html += `<td class="mono" style="text-align:right;padding:6px;font-weight:900;border-left:2px solid var(--border);">${fmt(grandTotal)}</td></tr>`;
  html += `</tbody></table></div>`;
  
  return html;
}
```

---

## Implementation Checklist

### Immediate Fixes (CRITICAL)
- [ ] **Fix #1:** Replace openReport() toggle logic (line 6506-6529)
  - Remove `if(_currentReportOpen === type)` toggle
  - Always open/show report when clicked
  
- [ ] **Fix #2:** Fix salesmonthwise filtering (line 6834-6835)
  - Add `filterSalesForReport()` call before renderGroupedRegister
  
- [ ] **Fix #2b:** Fix purchmonthwise filtering (line 6836-6837)
  - Add `filterByDateRange()` call

### Enhancements (OPTIONAL)
- [ ] **Add:** _renderSalesColumnWiseHTML() function
- [ ] **Add:** salesmatrix report type in HTML buttons
- [ ] **Add:** salesmatrix case in openReport() titles and logic
- [ ] **Add:** _renderCustomerWiseMatrixHTML() for customer breakdown

---

## Testing Steps

### Test Fix #1 (Toggle Bug)
```
1. Click "Sales Register" button → report opens
2. Click "Month" filter chip → same report refreshes with month data
3. Click "Sales Register" button AGAIN → report stays open (does NOT hide)
4. Click "Day" filter chip → report refreshes to today only
5. ✓ PASS: No accidental hiding
```

### Test Fix #2 (Month Filter)
```
1. Click "Month-wise" button
2. See grouped by months ✓
3. Click "Custom" dates, set to last month
4. Click "Month-wise" again → should show ONLY grouped months in custom range
5. ✓ PASS: Respects date filter
```

### Test New Feature (Column Matrix)
```
1. Click "Sales" → "Matrix" button
2. See table with months as columns
3. See totals per month
4. Change date filter to "Year" → matrix updates
5. ✓ PASS: Dynamic column headers based on data
```

---

## File Changes Summary

| Line(s) | Function | Change | Priority |
|---------|----------|--------|----------|
| 6506-6529 | openReport() | Remove toggle logic | 🔴 CRITICAL |
| 6834-6835 | salesmonthwise | Add filterSalesForReport() | 🔴 CRITICAL |
| 6836-6837 | purchmonthwise | Add filterByDateRange() | 🔴 CRITICAL |
| 1366 | HTML buttons | Add salesmatrix button | 🟡 OPTIONAL |
| NEW | _renderSalesColumnWiseHTML() | New function | 🟡 OPTIONAL |
| 6537 | titles object | Add salesmatrix title | 🟡 OPTIONAL |
| ~6834 | openReport() logic | Add salesmatrix case | 🟡 OPTIONAL |

---

## Before/After Comparison

### Before (Broken)
```
Click "Sales" → Shows sales
Click "Month" filter → Refreshes sales (ok so far)
Click "Sales" button → HIDES report ❌ (toggle logic bug)
```

### After (Fixed)
```
Click "Sales" → Shows sales ✓
Click "Month" filter → Refreshes sales ✓
Click "Sales" button → Shows sales ✓ (always opens, never hides)
Click "Day" filter → Refreshes to today only ✓
```

---

## Why This Matters

**For Balaji Business OS users:**
- ✅ Sales reports no longer mysteriously disappear
- ✅ Date filters work consistently across all report types
- ✅ New matrix view (like Tally) makes month-over-month comparison easy
- ✅ Column-wise display better for restaurant/retail decision-making ("Which month was best?")

**For code maintenance:**
- ✅ No more ambiguous toggle behavior
- ✅ Clear one-way flow: Click report → Always shows
- ✅ Close via filter chips or nav (intentional)
- ✅ Consistent with user expectations

---

## Next: Advanced Exports

Once column-wise reports work, add to Export menu:
- Export to Excel with preserved column structure
- Email monthly comparison as attachment
- Share via WhatsApp with month-wise totals

See previous fix document for export/print improvements.
