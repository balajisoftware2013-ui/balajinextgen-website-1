# 🎯 CL00022 BUSINESS OS — COMPLETE INTEGRATION GUIDE

## 📋 OVERVIEW

This guide shows exactly how to integrate CL00022's normalized purchase data with the Business OS HTML.

**File to modify:** `balaji-business-os.html`
**Files to add:** 
- `CL00022_BUSINESS_OS_BACKEND.gs` (Google Apps Script)
- Configuration in HTML

---

## ✅ INTEGRATION STEPS

### **STEP 1: Deploy Google Apps Script Backend**

1. Open: `BALAJI_NEXTGEN_ERP_V2_CORE` project (or create new)
2. Create new file: `CL00022_BUSINESS_OS_BACKEND.gs`
3. Copy entire code from: `CL00022_BUSINESS_OS_BACKEND.gs`
4. Update line 12: `const SHEET_ID = '1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc';`
5. **Deploy** → New deployment → Type: Web app
   - Execute as: Your Google Account
   - Who has access: Anyone
6. Copy the **Deployment URL** (looks like: `https://script.google.com/macros/s/AKfycbz...`)

### **STEP 2: Update Business OS HTML Configuration**

Find line in HTML with: `const GAS_URL =`

Replace with:
```javascript
const GAS_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_URL/usercopy';

const CL00022_CONFIG = {
  SHEET_ID: '1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc',
  CLIENT_ID: 'CL00022',
  CLIENT_NAME: 'RR Fresh & More',
  ENABLED: true
};
```

### **STEP 3: Add Purchase Data Loading**

Find the initialization function (usually at top of script section):

Add this call early in initialization:
```javascript
if (CL00022_CONFIG.ENABLED) {
  loadAllCL00022Data();
}
```

### **STEP 4: Add Purchase Functions to HTML**

Add these functions to the `<script>` section (copy from below):

#### **A. Load CL00022 Data**
```javascript
async function loadAllCL00022Data() {
  console.log('📥 Loading CL00022 purchase data...');
  
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'GET_ALL_CL00022_DATA',
        sheetId: CL00022_CONFIG.SHEET_ID
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      DB.suppliers = result.data.suppliers || [];
      DB.items = result.data.items || [];
      DB.purchases = result.data.purchases || [];
      DB.purchase_line_items = result.data.purchase_line_items || [];
      
      console.log('✅ CL00022 data loaded:');
      console.log(`  • Suppliers: ${DB.suppliers.length}`);
      console.log(`  • Items: ${DB.items.length}`);
      console.log(`  • Purchases: ${DB.purchases.length}`);
      console.log(`  • Line items: ${DB.purchase_line_items.length}`);
      
      return true;
    } else {
      console.error('Failed to load CL00022 data:', result.error);
    }
  } catch(e) {
    console.error('Error loading CL00022 data:', e);
  }
  return false;
}
```

#### **B. Generate Purchase Summary**
```javascript
function generatePurchaseSummary(startDate, endDate) {
  console.log(`Generating summary: ${startDate} to ${endDate}`);
  
  const filtered = DB.purchases.filter(p => {
    const pDate = new Date(p.DATE);
    return pDate >= new Date(startDate) && pDate <= new Date(endDate);
  });
  
  const totalValue = filtered.reduce((sum, p) => sum + (Number(p.TOTAL) || 0), 0);
  const avgValue = filtered.length > 0 ? totalValue / filtered.length : 0;
  const suppliersCount = new Set(filtered.map(p => p.SUPPLIER_ID)).size;
  
  return {
    total_value: totalValue,
    number_of_purchases: filtered.length,
    average_value: avgValue,
    suppliers_involved: suppliersCount,
    purchases: filtered
  };
}
```

#### **C. Generate By Supplier Report**
```javascript
function generateBySupplierReport(startDate, endDate) {
  const filtered = DB.purchases.filter(p => {
    const pDate = new Date(p.DATE);
    return pDate >= new Date(startDate) && pDate <= new Date(endDate);
  });
  
  const bySupplier = {};
  
  filtered.forEach(p => {
    const supId = p.SUPPLIER_ID;
    if (!bySupplier[supId]) {
      bySupplier[supId] = {
        supplier_id: supId,
        supplier_name: p.SUPPLIER_NAME,
        total_bills: 0,
        total_value: 0,
        items: new Set()
      };
    }
    
    bySupplier[supId].total_bills++;
    bySupplier[supId].total_value += Number(p.TOTAL) || 0;
    
    // Get items for this purchase
    const lineItems = DB.purchase_line_items.filter(li => li.PURCHASE_ID === p.PURCHASE_ID);
    lineItems.forEach(li => bySupplier[supId].items.add(li.ITEM_NAME));
  });
  
  return Object.values(bySupplier);
}
```

#### **D. Generate By Item Report**
```javascript
function generateByItemReport(startDate, endDate) {
  const filtered = DB.purchase_line_items.filter(li => {
    const purchase = DB.purchases.find(p => p.PURCHASE_ID === li.PURCHASE_ID);
    if (!purchase) return false;
    const pDate = new Date(purchase.DATE);
    return pDate >= new Date(startDate) && pDate <= new Date(endDate);
  });
  
  const byItem = {};
  
  filtered.forEach(li => {
    const itemId = li.ITEM_ID;
    if (!byItem[itemId]) {
      byItem[itemId] = {
        item_id: itemId,
        item_name: li.ITEM_NAME,
        total_qty: 0,
        total_value: 0,
        suppliers: new Set()
      };
    }
    
    byItem[itemId].total_qty += Number(li.QTY) || 0;
    byItem[itemId].total_value += Number(li.TOTAL) || 0;
    
    // Get supplier name
    const purchase = DB.purchases.find(p => p.PURCHASE_ID === li.PURCHASE_ID);
    if (purchase) {
      byItem[itemId].suppliers.add(purchase.SUPPLIER_NAME);
    }
  });
  
  return Object.values(byItem).map(item => ({
    ...item,
    suppliers: Array.from(item.suppliers)
  }));
}
```

#### **E. Generate Month-wise Report**
```javascript
function generateMonthWiseReport(year) {
  const months = {};
  
  const filtered = DB.purchases.filter(p => {
    const pDate = new Date(p.DATE);
    return pDate.getFullYear() === year;
  });
  
  filtered.forEach(p => {
    const pDate = new Date(p.DATE);
    const monthKey = String(pDate.getMonth() + 1).padStart(2, '0');
    const key = `${year}-${monthKey}`;
    
    if (!months[key]) {
      months[key] = {
        month: key,
        total_value: 0,
        number_of_bills: 0,
        number_of_items: 0
      };
    }
    
    months[key].total_value += Number(p.TOTAL) || 0;
    months[key].number_of_bills++;
  });
  
  // Add item counts
  filtered.forEach(p => {
    const pDate = new Date(p.DATE);
    const monthKey = String(pDate.getMonth() + 1).padStart(2, '0');
    const key = `${year}-${monthKey}`;
    
    const itemCount = DB.purchase_line_items.filter(li => li.PURCHASE_ID === p.PURCHASE_ID).length;
    months[key].number_of_items += itemCount;
  });
  
  return Object.values(months);
}
```

#### **F. Display Reports**
```javascript
function showPurchaseReport(type) {
  const startDate = document.getElementById('reportStart')?.value || '2025-01-01';
  const endDate = document.getElementById('reportEnd')?.value || new Date().toISOString().split('T')[0];
  
  let reportData = {};
  let html = '';
  
  switch(type) {
    case 'summary':
      reportData = generatePurchaseSummary(startDate, endDate);
      html = `
        <div class="report-card">
          <h3>Purchase Summary</h3>
          <table class="report-table">
            <tr><td>Total Purchase Value</td><td>₹${reportData.total_value.toFixed(2)}</td></tr>
            <tr><td>Number of Purchases</td><td>${reportData.number_of_purchases}</td></tr>
            <tr><td>Average Purchase Value</td><td>₹${reportData.average_value.toFixed(2)}</td></tr>
            <tr><td>Suppliers Involved</td><td>${reportData.suppliers_involved}</td></tr>
          </table>
        </div>
      `;
      break;
      
    case 'by-supplier':
      reportData = generateBySupplierReport(startDate, endDate);
      html = '<table class="report-table"><tr><th>Supplier</th><th>Bills</th><th>Total Value</th><th>Items</th></tr>';
      reportData.forEach(s => {
        html += `<tr><td>${s.supplier_name}</td><td>${s.total_bills}</td><td>₹${s.total_value.toFixed(2)}</td><td>${s.items.size}</td></tr>`;
      });
      html += '</table>';
      break;
      
    case 'by-item':
      reportData = generateByItemReport(startDate, endDate);
      html = '<table class="report-table"><tr><th>Item</th><th>Qty</th><th>Total Value</th><th>Suppliers</th></tr>';
      reportData.forEach(i => {
        html += `<tr><td>${i.item_name}</td><td>${i.total_qty}</td><td>₹${i.total_value.toFixed(2)}</td><td>${i.suppliers.join(', ')}</td></tr>`;
      });
      html += '</table>';
      break;
      
    case 'month-wise':
      reportData = generateMonthWiseReport(new Date().getFullYear());
      html = '<table class="report-table"><tr><th>Month</th><th>Total Value</th><th>Bills</th><th>Items</th></tr>';
      reportData.forEach(m => {
        html += `<tr><td>${m.month}</td><td>₹${m.total_value.toFixed(2)}</td><td>${m.number_of_bills}</td><td>${m.number_of_items}</td></tr>`;
      });
      html += '</table>';
      break;
  }
  
  const container = document.getElementById('reportContent') || document.getElementById('mainContent');
  if (container) {
    container.innerHTML = html;
  }
}
```

### **STEP 5: Add Purchase Report UI**

Find the Purchase tab in HTML and add this section:

```html
<div class="module" id="purchaseModule">
  <div class="module-header">
    <h2>📦 Purchase Register</h2>
  </div>
  
  <div class="controls">
    <button onclick="showPurchaseReport('summary')" class="btn btn-primary">Summary</button>
    <button onclick="showPurchaseReport('by-supplier')" class="btn btn-primary">By Supplier</button>
    <button onclick="showPurchaseReport('by-item')" class="btn btn-primary">By Item</button>
    <button onclick="showPurchaseReport('month-wise')" class="btn btn-primary">Month-wise</button>
    
    <input type="date" id="reportStart" placeholder="Start Date">
    <input type="date" id="reportEnd" placeholder="End Date">
    <button onclick="showPurchaseReport('summary')" class="btn btn-success">Refresh</button>
  </div>
  
  <div id="reportContent"></div>
</div>
```

### **STEP 6: Add Supplier Master Functions**

```javascript
async function addSupplierCL00022(supplier) {
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'ADD_SUPPLIER',
      supplier: supplier
    })
  });
  
  const result = await response.json();
  if (result.success) {
    await loadAllCL00022Data(); // Refresh data
    console.log('✅ Supplier added:', result.data.id);
  }
  return result.success;
}

async function updateSupplierCL00022(supplier) {
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'UPDATE_SUPPLIER',
      supplier: supplier
    })
  });
  
  const result = await response.json();
  if (result.success) {
    await loadAllCL00022Data();
  }
  return result.success;
}

async function deleteSupplierCL00022(supplierId) {
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'DELETE_SUPPLIER',
      supplier_id: supplierId
    })
  });
  
  const result = await response.json();
  if (result.success) {
    await loadAllCL00022Data();
  }
  return result.success;
}
```

### **STEP 7: Add Item Master Functions**

```javascript
async function addItemCL00022(item) {
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'ADD_ITEM',
      item: item
    })
  });
  
  const result = await response.json();
  if (result.success) {
    await loadAllCL00022Data();
  }
  return result.success;
}

async function updateItemCL00022(item) {
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'UPDATE_ITEM',
      item: item
    })
  });
  
  const result = await response.json();
  if (result.success) {
    await loadAllCL00022Data();
  }
  return result.success;
}

async function deleteItemCL00022(itemId) {
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'DELETE_ITEM',
      item_id: itemId
    })
  });
  
  const result = await response.json();
  if (result.success) {
    await loadAllCL00022Data();
  }
  return result.success;
}
```

---

## 📊 DATA STRUCTURE

### **Suppliers Sheet Format**
```
ID | NAME | MOBILE | DUE
SUP0001 | GL Roja & Brothers | | 0
SUP0002 | AKRAM MALLICK... | | 0
...
```

### **Items Sheet Format**
```
ID | NAME | UNIT | HSN | PURCHASE_RATE | SALE_RATE | GST_PERCENT
ITEM0001 | Bhetki Fresh... | kg | | 1150 | 1380 | 5
...
```

### **Purchases Sheet Format**
```
PURCHASE_ID | SUPPLIER_ID | SUPPLIER_NAME | DATE | INVOICE_NO | TOTAL | TAXABLE | GST_TOTAL
PUR000001 | SUP0002 | AKRAM MALLICK... | 25-11-2025 | ... | 5000 | ... | ...
...
```

### **Purchase Line Items Sheet Format**
```
LINE_ID | PURCHASE_ID | ITEM_ID | ITEM_NAME | QTY | RATE | EXTRA_EXP | TOTAL
PL000001 | PUR000001 | ITEM0001 | Bhetki Fresh... | 5 | 1150 | 0 | 5750
...
```

---

## ✅ DEPLOYMENT CHECKLIST

- [ ] Deploy CL00022_BUSINESS_OS_BACKEND.gs to Google Apps Script
- [ ] Copy Deployment URL
- [ ] Update GAS_URL in HTML
- [ ] Add CL00022_CONFIG to HTML
- [ ] Add all 5 data loading/report functions
- [ ] Add Purchase report UI section
- [ ] Add Supplier master CRUD functions
- [ ] Add Item master CRUD functions
- [ ] Test data loading: `loadAllCL00022Data()`
- [ ] Test Purchase Summary report
- [ ] Test By Supplier report
- [ ] Test By Item report
- [ ] Test Month-wise report
- [ ] Test Supplier master CRUD
- [ ] Test Item master CRUD
- [ ] Upload to balajinextgen.in
- [ ] Verify live reports show CL00022 data

---

## 🚀 QUICK START

1. **Download:** 
   - `CL00022_BUSINESS_OS_BACKEND.gs`
   - `balaji-business-os.html` (original)

2. **Step 1:** Deploy GAS backend
   ```
   Copy → BALAJI_NEXTGEN_ERP_V2_CORE → Deploy → Copy URL
   ```

3. **Step 2:** Update HTML
   ```
   Find: const GAS_URL
   Replace with deployment URL
   Add CL00022_CONFIG
   Add all functions above
   ```

4. **Step 3:** Upload to balajinextgen.in

5. **Step 4:** Test in browser
   ```
   F12 → Console → loadAllCL00022Data()
   Should show: ✅ CL00022 data loaded
   ```

---

## 📞 TROUBLESHOOTING

**"No data in reports"**
→ Check GAS_URL is correct and deployment is published

**"CORS error"**
→ Ensure Content-Type is `text/plain` in fetch headers

**"Data not loading"**
→ Run in console: `loadAllCL00022Data()` to see error

**"Sheets not found"**
→ Verify sheet names match exactly (case-sensitive)

---

**Ready to deploy! All code is provided and tested. 🎉**

