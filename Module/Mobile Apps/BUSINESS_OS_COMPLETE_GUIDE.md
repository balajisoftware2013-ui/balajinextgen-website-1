# 🎯 BALAJI NEXTGEN BUSINESS OS — COMPLETE WORKING GUIDE

## v2.0 — CL00022 (Rr Fresh & More)

---

## 📋 TABLE OF CONTENTS

1. [Quick Start](#quick-start)
2. [Features Overview](#features-overview)
3. [Database Structure](#database-structure)
4. [All Working Features](#all-working-features)
5. [Reports & Stock Management](#reports--stock-management)
6. [Backend Integration](#backend-integration)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 QUICK START

### Step 1: Load the Business OS

**Option A: Online (Recommended)**
```
1. Upload balaji-business-os-complete.html to Netlify
2. The app will load from localStorage (persistent data)
3. On first load, manually enter business name and owner
```

**Option B: Local Testing**
```
1. Open balaji-business-os-complete.html in Chrome/Firefox
2. All data persists in browser localStorage
3. Works offline (no internet required)
```

### Step 2: Initialize with Data

**Method 1: Manual Entry (Skip if using Method 2)**
- Register business details on login screen
- Add customers, suppliers, items as needed

**Method 2: Pre-load Complete Data (Recommended)**
```javascript
// Open browser console (F12)
// Paste this code and press Enter:

const appData = {
  "suppliers": [...19 records...],
  "items": [...30 records...],
  "customers": [...20 records...],
  "purchases": [...306 records...],
  "sales": [...30 records...],
  "cash": 50000,
  "bank": 100000
};

localStorage.setItem('boApp', JSON.stringify(appData));
location.reload();
```

OR copy-paste the JSON file content:
```
1. Open business_os_appdata.json
2. Copy all content
3. Paste into browser console: localStorage.setItem('boApp', '<paste here>')
4. Refresh page
```

---

## ✨ FEATURES OVERVIEW

### Dashboard (Home Screen)
- **Today's Sales** — Live total from today's transactions
- **Today's Purchase** — Live total from today's purchases
- **Cash in Hand** — Current cash balance
- **Bank Balance** — Bank account balance
- **Today's Profit** — Estimated profit margin
- **Pending Collection** — Outstanding customer dues
- **Pending Payment** — Outstanding supplier dues
- **Low Stock Alert** — Items below minimum threshold
- **Health Ring** — Visual indicator of business metrics

### 1. 🧾 SALES (Billing)

**Features:**
- Create new sales invoice instantly
- Add multiple items per invoice
- Auto-calculate GST and total
- Multiple payment modes (Cash/Card/Cheque/Credit)
- Customer credit limit validation
- Auto-update customer dues
- Barcode/Item search
- Print invoice
- Email invoice (WhatsApp integration ready)

**How to Use:**
```
1. Click "Sales" button on dashboard
2. Select or create customer
3. Click "+ Add Item"
4. Select item from dropdown
5. Enter quantity
6. App auto-calculates: Amount = Qty × Sale Rate
7. GST auto-applied based on item GST%
8. Select payment mode
9. Click "Save Bill"
10. Print or share via WhatsApp
```

**Data Synced:**
- ✓ Customer dues updated
- ✓ Stock reduced
- ✓ Cash/Bank balance updated
- ✓ Profit calculated

---

### 2. 🛒 PURCHASE (Inventory)

**Features:**
- Create new purchase voucher
- Multiple items per purchase
- Supplier credit management
- Auto-update supplier dues
- Auto-update stock levels
- Auto-track purchase rates
- Print PO
- Email to supplier

**How to Use:**
```
1. Click "Purchase" button
2. Select or create supplier
3. Click "+ Add Item"
4. Select item from dropdown
5. Enter quantity and rate
6. App auto-calculates amount
7. Select payment mode (Cash/Credit/Cheque)
8. Click "Save Purchase"
9. Stock auto-updated
```

**Data Synced:**
- ✓ Supplier dues updated
- ✓ Stock increased
- ✓ Purchase rate tracked
- ✓ Cash/Bank balance updated

---

### 3. 📦 INVENTORY / STOCK

#### Current Stock View (Tally-Style)
```
Shows:
- Item ID | Item Name | Unit | Current Stock | Min Level | Status
- Status: OK (green) | LOW (yellow) | OUT (red)
- Action: Can reorder items with low stock
- Can view stock history per item
```

#### Stock Movement (Purchase/Sale Ledger)
```
Shows:
- Date | Type | Bill No | Party | Item | Qty | Rate | Amount
- Tracks all purchases and sales
- Running stock calculation
- FIFO valuation support
```

#### Filters Available:
- **All Items** — Complete inventory
- **Low Stock** — Items below minimum
- **Dead Stock** — Items with zero movement
- **Zero Stock** — Items with 0 quantity
- **Out of Stock** — Urgent reorder needed

**Actions:**
- Click item to view history
- Click "Reorder" to create purchase
- Click "Mark as Dead" for inactive items

---

### 4. 📊 REPORTS (All Working)

#### A. SALES REPORTS

**Today's Sales**
```
Shows:
- Invoice Number | Customer | Amount | GST | Total
- Total Bills: Count
- Total Amount: ₹X
- Filter by: Today / This Week / This Month / Custom
```

**Sales Ledger**
```
Shows: Date-wise sales with:
- Invoice No | Customer | Mode | Total
- Expandable to show items per invoice
- Can export to PDF
```

**Item-Wise Sales**
```
Shows: Sales broken down by item:
- Item ID | Item Name | Qty Sold | Total Sale Value | Avg Rate
- Helps identify best-selling items
- Compare with purchase price for profit
```

**Customer Ageing**
```
Shows: Customer-wise dues:
- Customer Name | Mobile | Total Due | Days Overdue
- Helps for collection follow-up
- Auto-mark overdue (30+ days)
```

#### B. PURCHASE REPORTS

**Today's Purchase**
```
Shows:
- Invoice No | Supplier | Amount | Items | Mode
- Total Bills Count
- Total Purchase Value
```

**Purchase Ledger**
```
Shows: Date-wise purchases with:
- Date | Bill No | Supplier | Amount | GST
- Expandable to show items
- Export ready
```

**Item-Wise Purchase**
```
Shows: Purchase broken down by item:
- Item | Qty Purchased | Total Cost | Avg Rate
- Helps identify cost trends
- Compare purchase vs sale rates
```

**Supplier Ageing**
```
Shows: Supplier-wise dues:
- Supplier Name | Mobile | Total Due | Days Overdue
- Helps for payment management
```

#### C. CUSTOMER REPORTS

**Customer List**
```
Shows:
- Customer ID | Name | Mobile | Total Due | Credit Limit
- Last Purchase Date
- Can filter by status (Good / Overdue / Blocked)
```

**Collection Status**
```
Groups by age of outstanding invoice:
- 0-30 days (Current) | 31-60 days | 61-90 days | 90+ days
- Helps prioritize collection
```

#### D. SUPPLIER REPORTS

**Supplier List**
```
Shows:
- Supplier ID | Name | Mobile | Total Due
- Last Purchase Date
- Total Purchases (Value)
```

**Payment Status**
```
Groups by due date:
- Due Today | Due in 7 days | Due in 30 days | Overdue
```

#### E. STOCK REPORTS

**Stock Summary**
```
Shows all items:
- Item ID | Name | Unit | Current Stock | Min Level | Status
- Valuation: Stock Value = Stock Qty × Purchase Rate
- Total Inventory Value
```

**Stock Movement Ledger**
```
Date | Type (Purchase/Sale) | Bill No | Item | Qty In | Qty Out | Running Stock
- Shows complete stock flow
- FIFO-based running stock
```

**Low Stock Alert**
```
Items below minimum level with action:
- Item Name | Current | Min | Qty to Order
- One-click "Create PO" (Purchase Order)
```

**Dead Stock**
```
Items with zero sales in 90 days:
- Item Name | Current Stock | Cost | Days Since Sale
- Helps identify slow-moving stock
```

#### F. ACCOUNTS / GST

**Cash Book**
```
Date | Description | In | Out | Balance
- Shows all cash transactions
- Running balance
- Can reconcile with bank
```

**Bank Book**
```
Date | Cheque No | Description | In | Out | Balance
- Shows all bank transactions
- Matches with bank statement
```

**GST Summary**
```
Shows for filing GST Return:
- Total Purchases (with GST %) | Purchase GST Paid
- Total Sales (with GST %) | Sales GST Collected
- GST Liability = Collected - Paid
```

**P&L Statement (Profit & Loss)**
```
Shows:
- Revenue (Sales)
- COGS (Cost of Goods Sold)
- Gross Profit
- Expenses (if any)
- Net Profit
- Profit Margin %
```

---

## 🗂️ DATABASE STRUCTURE

### Master Data (Never Deleted)

**SUPPLIERS (19 records)**
```json
{
  "id": "SUP0001",
  "name": "AKRAM MALLICK CHICKEN & FISH COUNTER",
  "mobile": "+91XXXXXXXXXX",
  "due": 0
}
```

**ITEMS (30 records)**
```json
{
  "id": "I0001",
  "name": "BHETKI WHOLE",
  "unit": "KG",
  "hsn": "0302",
  "pRate": 550.00,
  "sRate": 825.00,
  "gst": 5.0,
  "stock": 125.35,
  "min": 10.0
}
```

**CUSTOMERS (20 records)**
```json
{
  "id": "C0001",
  "name": "Walk-in Customer",
  "mobile": "",
  "due": 0,
  "limit": 50000
}
```

### Transaction Data (Preserved)

**PURCHASES (306 records)**
```json
{
  "id": "PR001",
  "supp": "SUP0001",
  "suppName": "AKRAM MALLICK CHICKEN & FISH COUNTER",
  "date": "2025-11-25",
  "mode": "Cash",
  "total": 12562.50,
  "lineItems": [
    {
      "id": "I0001",
      "name": "BHETKI WHOLE",
      "qty": 10.35,
      "rate": 1213.77,
      "gst": 5.0
    }
  ]
}
```

**SALES (30+ records)**
```json
{
  "id": "SAL0001",
  "cust": "C0001",
  "custName": "Customer Name",
  "date": "2025-11-26",
  "mode": "Cash",
  "total": 5000,
  "lineItems": [
    {
      "id": "I0001",
      "name": "Item Name",
      "qty": 5,
      "rate": 1000,
      "gst": 5.0
    }
  ]
}
```

### Summary Data

```json
{
  "cash": 50000,
  "bank": 100000
}
```

---

## 🎯 ALL WORKING FEATURES CHECKLIST

### ✅ Core Features
- [x] Customer management (Add/Edit/View)
- [x] Supplier management (Add/Edit/View)
- [x] Item master (Product catalog)
- [x] Stock tracking (Real-time updates)
- [x] Purchase order creation
- [x] Sales invoice creation
- [x] Payment modes (Cash/Card/Cheque/Credit)
- [x] Credit limit enforcement
- [x] Auto-GST calculation
- [x] Auto-stock update on sale/purchase

### ✅ Inventory Management
- [x] Current stock view (Tally-style)
- [x] Movement view (Purchase/Sale ledger)
- [x] Low stock alerts
- [x] Dead stock identification
- [x] Stock valuation (FIFO)
- [x] Reorder point management
- [x] Batch tracking ready

### ✅ Financial Management
- [x] Cash book
- [x] Bank book
- [x] Cash in hand tracking
- [x] Bank balance tracking
- [x] Profit calculation
- [x] GST tracking per transaction
- [x] Supplier dues tracking
- [x] Customer dues tracking

### ✅ Reporting (All 8 Report Categories)
- [x] Sales Reports (Today/Weekly/Monthly)
- [x] Purchase Reports (Today/Weekly/Monthly)
- [x] Customer Reports (List/Ageing/Collection)
- [x] Supplier Reports (List/Payment Status)
- [x] Inventory Reports (Stock/Movement/Low Stock/Dead Stock)
- [x] Accounts Reports (Cash Book/Bank Book)
- [x] GST Reports (Summary/Return Ready)
- [x] Analysis Reports (P&L/Profit Margin)

### ✅ Export & Printing
- [x] Invoice print (PDF format)
- [x] PO print
- [x] Report export to PDF
- [x] WhatsApp integration ready
- [x] Email ready (template)

### ✅ User Experience
- [x] Mobile responsive
- [x] Offline support (no internet needed)
- [x] Dark/Light theme
- [x] Multiple color themes
- [x] Fast navigation
- [x] Search functionality
- [x] Date range filters
- [x] Quick actions (FAB buttons)

### ✅ Data Integrity
- [x] Duplicate prevention
- [x] Running stock calculation
- [x] Automatic reconciliation
- [x] Data backup (localStorage)
- [x] Corruption detection
- [x] Auto-recovery on reload

---

## 📈 REPORTS & STOCK MANAGEMENT

### How to Access Reports

**Via Dashboard:**
```
1. Tap "Reports" button (📊 icon)
2. See 8 category tabs:
   - Sales | Purchase | Customers | Suppliers | Stock | Accounts | GST | Analysis
3. Tap category to expand
4. Select specific report
5. View with date filter
6. Export to PDF
```

**Via Drawer Menu:**
```
1. Tap hamburger menu (☰)
2. Tap "All Reports" option
3. Same 8 categories appear
4. Works identical to Dashboard
```

### Stock Management Best Practices

**Daily:**
- Check "Low Stock" alert on dashboard
- Create PO for critical items
- Verify purchases received

**Weekly:**
- Review "Stock Movement" report
- Compare purchase vs sale rates
- Identify slow-moving items

**Monthly:**
- Run "Dead Stock" report
- Identify items to discontinue
- Plan stock purchases based on trends

**Quarterly:**
- Full inventory audit (physical vs system)
- Reconcile stock values
- Adjust prices if needed

---

## 🔗 BACKEND INTEGRATION (GAS / Google Apps Script)

### API Endpoints Available

The app can sync with Google Apps Script backend using these actions:

```javascript
// In localStorage, when backend is connected:
SUITE_SAVE_DB       → Save entire database to Google Sheets
SUITE_LOAD_DB       → Load database from Google Sheets
SYNC_PURCHASE_ROW   → Add/update purchase in backend
SYNC_SALE_ROW       → Add/update sale in backend
SYNC_ITEM_ROW       → Add/update item in backend
SYNC_SUPPLIER_ROW   → Add/update supplier in backend
SYNC_CUSTOMER_ROW   → Add/update customer in backend
```

### Setup Backend Connection

**Step 1: Deploy Code.gs (v20)**
```
1. Go to Google Apps Script console
2. Paste BusinessOS_Backend.gs code
3. Deploy as API
4. Copy deployment URL
```

**Step 2: Update HTML**
```javascript
// Line 11 in balaji-business-os-complete.html:
const GAS_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

**Step 3: Enable Cloud Sync**
```
1. On dashboard, tap "Settings" gear icon
2. Toggle "Cloud Sync" ON
3. Enter Google account email
4. App will auto-sync on every transaction
```

### Auto-Sync Features

Once backend connected:
- ✓ Every purchase auto-syncs
- ✓ Every sale auto-syncs
- ✓ Stock updates replicated
- ✓ Multi-device sync (works on mobile + web)
- ✓ Data backup (Google Sheets)
- ✓ Can revert to any backup

---

## 🛠️ TROUBLESHOOTING

### Issue: Data Not Showing

**Solution:**
```
1. Open browser console (F12)
2. Check localStorage:
   localStorage.getItem('boApp')
3. Should show JSON with data
4. If empty, pre-load data as per Quick Start
5. Refresh page
```

### Issue: Stock Numbers Wrong

**Solution:**
```
1. Tap Dashboard
2. Scroll to bottom
3. Tap "System Health" / "Verify Data"
4. App will auto-reconcile
5. Should recalculate running stock
```

### Issue: Report Not Loading

**Solution:**
```
1. Make sure you have data (purchases/sales)
2. Check date filter (may be filtering out results)
3. Try "All Time" filter
4. Check browser console for errors
5. Clear cache: Ctrl+Shift+Delete, then reload
```

### Issue: Offline Mode Not Working

**Solution:**
```
1. Open app at least once online
2. All data cached in localStorage
3. Works fully offline after first load
4. No internet needed after that
```

### Issue: Dates Show as Wrong Format

**Solution:**
```
1. Open browser console
2. Set timezone:
   Intl.DateTimeFormat().resolvedOptions().timeZone
3. Should match your location
4. Check System → Date & Time in Settings
```

### Issue: Export/Print Not Working

**Solution:**
```
1. Chrome/Firefox should have Print preview
2. Right-click and select "Print"
3. Can save as PDF
4. Make sure pop-ups not blocked
5. Check browser permissions
```

---

## 📱 MOBILE APP MODE

### Install as App (Android/iPhone)

**Android:**
```
1. Open in Chrome
2. Tap menu (⋮)
3. Tap "Install app"
4. App will appear on home screen
5. Tap to open (works offline)
```

**iPhone:**
```
1. Open in Safari
2. Tap Share button
3. Tap "Add to Home Screen"
4. App will appear on home screen
5. Tap to open (works offline)
```

### PWA Features
- Offline support
- Fast loading
- Low data usage
- Feels like native app
- Works on home screen

---

## 💡 TIPS & TRICKS

### Quick Invoice Entry (Speed Mode)
```
1. Open Sales
2. Press Tab instead of clicking buttons
3. Type quantity, press Tab
4. App auto-calculates, moves to next item
5. Press Enter to save invoice
```

### Batch Item Import
```
1. If you have items in Excel:
2. Format as: ID | Name | Unit | P.Rate | S.Rate | GST
3. Open browser console
4. Paste: localStorage.setItem('boApp', JSON.stringify(data))
5. Refresh to see all items
```

### Multi-User Access
```
1. Each user can log in on different devices
2. Sync via cloud (if backend connected)
3. Conflicts resolved by "last write wins"
4. Admin can see all user activity
```

### Tax Compliance
```
- GST Summary report ready for e-filing
- Maintains HSN-wise purchase/sale breakdown
- Can export as JSON for tax software
- Tracks GST input/output separately
```

---

## 📞 SUPPORT

**For Issues:**
- Email: support@balajinextgen.in
- Phone: +91-9832014403
- WhatsApp: +91-9832014403

**For Feature Requests:**
- Submit via app's feedback form
- Or email with screenshots

---

## 📄 VERSION INFORMATION

**Current Version:** v2.0 (Business OS Complete)

**Database:** CL00022 - Rr Fresh & More

**Included Data:**
- 19 Suppliers (Active)
- 30 Items (In Stock)
- 20 Customers (Registered)
- 306 Purchase Records (Historical)
- 30 Sales Records (Sample)
- ₹50,000 Cash + ₹100,000 Bank Balance

**Last Updated:** 2026-07-20

---

**🎉 Enjoy using Balaji NextGen Business OS!**

Make payments on time, track stock daily, and grow your business with confidence.
