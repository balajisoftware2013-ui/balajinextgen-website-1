# 🎯 BALAJI BUSINESS OS — QUICK REFERENCE CARD

## All Features at a Glance

---

## 📋 1. PURCHASE ENTRY (🛒 Purchase Button)

### Create New Purchase Invoice

```
STEP 1: Select/Create Supplier
└─ Tap "Select Supplier" dropdown
└─ Search: "AKRAM MALLICK..." 
└─ Shows: Mobile number, total due
└─ Or create new supplier on the fly

STEP 2: Add Items
└─ Tap "+ Add Item"
└─ Search: Type "BHETKI" → Shows all fish items
└─ Select: "Bhetki Fresh 500-600g"
└─ Enter Qty: 10
└─ Rate auto-fills: ₹1,150 (from last purchase)
└─ Amount calc: 10 × 1,150 = ₹11,500

STEP 3: Add More Items (Optional)
└─ Tap "+ Add Item" again
└─ Repeat for each product
└─ GST auto-added (5% per item)

STEP 4: Payment Mode
└─ Cash: Money paid today
└─ Cheque: Post-dated, pending clearance
└─ Credit: Supplier due created

STEP 5: Save
└─ Tap "Save Bill" button
└─ Bill ID: PR00X generated
└─ ✓ Stock increased
└─ ✓ Supplier dues updated (if Credit)
└─ ✓ Can print or share
```

**Example:**
```
Supplier: GL Roja & Brothers
Item 1: Bhetki Fresh 1000g | Qty: 10 | Rate: ₹1,150 | Amount: ₹11,500
Item 2: Fresh Basa 500g | Qty: 15 | Rate: ₹350 | Amount: ₹5,250
─────────────────────────────────────────────
Total: ₹16,750 (incl. GST)
Payment: Cash
Bill No: PR00234 | Date: 2026-07-20
```

---

## 🧾 2. SALES ENTRY (🧾 Sales Button)

### Create New Sales Invoice

```
STEP 1: Select/Create Customer
└─ Tap "Select Customer" dropdown
└─ Search: "Hotel Restaurant A"
└─ Shows: Mobile, total due, credit limit
└─ Or create new customer

STEP 2: Add Items to Sell
└─ Tap "+ Add Item"
└─ Search & Select from 30 items
└─ Auto-fills Sale Rate (₹1.5× Purchase Rate)
└─ Auto-check stock (prevents over-selling)
└─ Example: BHETKI WHOLE
  ├─ Available Stock: 125 KG
  ├─ Enter Qty: 5
  ├─ Sale Rate: ₹825 (auto)
  └─ Amount: ₹4,125

STEP 3: GST Auto-Applied
└─ Each item has own GST%
└─ System calculates total GST
└─ Example: Item GST=5%, Amount ₹4,125
  └─ GST: ₹206.25
  └─ Total: ₹4,331.25

STEP 4: Validate Credit
└─ If payment="Credit"
└─ Check: Customer Due < Credit Limit
└─ Alert if exceeds
└─ Can still save with warning

STEP 5: Payment Mode
└─ Cash: Received today
└─ Card: Digital payment
└─ Cheque: Pending bank clear
└─ Credit: Invoice due (customer owes)

STEP 6: Save & Print
└─ Tap "Save Bill"
└─ Invoice ID: SAL0001
└─ Can print, email, or WhatsApp
└─ ✓ Stock reduced
└─ ✓ Customer dues updated (if Credit)
└─ ✓ Profit calculated
```

**Example:**
```
Customer: Hotel Restaurant B
Item 1: Bhetki Whole | 5 KG @ ₹825 = ₹4,125 (GST 5% = ₹206.25)
Item 2: Fresh Basa | 3 KG @ ₹525 = ₹1,575 (GST 5% = ₹78.75)
─────────────────────────────────────────────────────────
Subtotal: ₹5,700
Total GST: ₹285
TOTAL: ₹5,985
Payment: Cash
Invoice: SAL00001 | Date: 2026-07-20
```

---

## 📦 3. INVENTORY / STOCK (📦 Stock Button)

### View Current Stock (Tally-Style)

```
TAB 1: CURRENT STOCK
┌─ Item # | Name | Unit | Qty | Min | Status
├─ I0001 | BHETKI WHOLE | KG | 125.35 | 10 | ✓ OK
├─ I0002 | BASA 500g | KG | 45.20 | 10 | ✓ OK  
├─ I0003 | SQUID | KG | 2.5 | 10 | ⚠ LOW
├─ I0004 | PRAWN | KG | 0 | 10 | ❌ OUT
└─ ... (30 items total)

STATUS MEANINGS:
✓ OK    = Stock > Min (good to sell)
⚠ LOW   = Stock between 0-Min (reorder needed)
❌ OUT  = Stock = 0 (immediate purchase required)

ACTIONS:
- Tap item → See sale/purchase history
- Tap "Reorder" → Create purchase order instantly
- Tap "Filter" → Show: All / Low / Dead / Zero
```

### View Stock Movement

```
TAB 2: MOVEMENT (Purchase/Sale Ledger)
┌─ Date | Type | Bill No | Party | Item | Qty | Running Stock
├─ 2026-07-20 | Purchase | PR00234 | GL Roja | Bhetki | +10 | 125
├─ 2026-07-20 | Sale | SAL00001 | Hotel A | Bhetki | -5 | 120
├─ 2026-07-19 | Purchase | PR00233 | Dilip | Basa | +15 | 45
├─ 2026-07-19 | Sale | SAL00000 | Customer | Basa | -3 | 48
└─ ... (all 306 purchases + 30+ sales)

RUNNING STOCK = Opens + Purchases - Sales
(Updated in real-time as you add transactions)

FILTERS:
- Date Range: Today / Week / Month / Custom
- Type: All / Purchase / Sale
- Item: Single item or All
- Party: Specific supplier/customer
```

### Filters & Alerts

```
LOW STOCK ITEMS (Auto-Alert)
┌─ Item | Current | Min | Need | Action
├─ Squid 10*20 | 2.5 KG | 10 | 7.5 | [Create PO]
├─ Prawn | 0 | 10 | 10 | [URGENT]
└─ Dead Fish | 0.5 | 5 | 4.5 | [Create PO]

DEAD STOCK (90+ days no sale)
┌─ Item | Current Qty | Last Sold | Days | Cost
├─ Salted Fish | 50 KG | 2026-04-01 | 110 | ₹25,000
└─ ... (identify for discount/donation)

ZERO STOCK
└─ Items with Qty = 0 (can't sell)
└─ Click [Create PO] to reorder
```

---

## 📊 4. REPORTS (All 8 Categories)

### Category 1: SALES REPORTS 🧾

**Today's Sales**
```
Shows: Sales invoices created today
┌─ Time | Invoice | Customer | Amount | Items | Mode
├─ 10:30 AM | SAL00001 | Hotel A | ₹5,985 | 2 | Cash
├─ 02:15 PM | SAL00002 | Customer B | ₹3,250 | 1 | Card
└─ 04:00 PM | SAL00003 | Walk-in | ₹1,500 | 1 | Cash

SUMMARY:
Total Bills: 3
Total Sales: ₹10,735
Avg per Bill: ₹3,578
Items Sold: 4 items
```

**Sales Ledger (Weekly/Monthly)**
```
Date Range: This Week
┌─ Date | Invoice | Customer | Total | Tax | Net
├─ Jul 18 | SAL00001 | Hotel A | ₹5,985 | ₹285 | ₹5,700
├─ Jul 19 | SAL00002 | Customer | ₹3,250 | ₹155 | ₹3,095
├─ Jul 20 | SAL00003 | Walk-in | ₹1,500 | ₹71 | ₹1,429
└─ TOTAL | | | ₹10,735 | ₹511 | ₹10,224

Can expand each invoice to see items
```

**Item-Wise Sales Analysis**
```
Shows: Which items sold most this month
┌─ Item | Qty Sold | Value | Avg Rate | Profit
├─ Bhetki Whole | 125 KG | ₹103,125 | ₹825 | ₹48,600
├─ Fresh Basa | 85 KG | ₹44,625 | ₹525 | ₹17,850
├─ Squid | 30 KG | ₹15,150 | ₹505 | ₹6,060
└─ TOTAL | | ₹162,900 | | ₹72,510

Best for identifying bestsellers
```

**Customer-Wise Sales**
```
Shows: Top customers
┌─ Customer | Total Purchases | No. of Bills | Avg Bill | Last Purchase
├─ Hotel A | ₹45,000 | 12 | ₹3,750 | Jul 20
├─ Hotel B | ₹32,500 | 8 | ₹4,063 | Jul 19
├─ Walk-in | ₹22,300 | 15 | ₹1,487 | Jul 20
└─ TOTAL | ₹99,800 | 35 | | 

Helps identify loyal customers
```

---

### Category 2: PURCHASE REPORTS 🛒

**Today's Purchase**
```
Shows: All purchases created today
┌─ Time | Bill No | Supplier | Amount | Items | Mode
├─ 09:00 AM | PR00230 | GL Roja | ₹12,562 | 1 | Cash
├─ 01:30 PM | PR00231 | Dilip Singh | ₹2,340 | 2 | Cheque
└─ 03:45 PM | PR00232 | Neil Assoc | ₹8,900 | 3 | Credit

SUMMARY:
Total Bills: 3
Total Purchase: ₹23,802
Avg per Bill: ₹7,934
Items Purchased: 6 items
```

**Item-Wise Purchase Cost**
```
Shows: Cost trends by item
┌─ Item | Qty Bought | Total Cost | Avg Rate | Last Rate
├─ Bhetki Whole | 500 KG | ₹275,000 | ₹550 | ₹614
├─ Fresh Basa | 300 KG | ₹105,000 | ₹350 | ₹375
├─ Squid | 150 KG | ₹85,500 | ₹570 | ₹600
└─ TOTAL | | ₹465,500 | | 

Shows if supplier raised prices
```

---

### Category 3: CUSTOMER REPORTS 👥

**Customer List**
```
┌─ ID | Customer | Mobile | Total Purchased | Dues | Status
├─ C001 | Hotel A | 9876543210 | ₹45,000 | ₹5,000 | Good
├─ C002 | Hotel B | 9876543211 | ₹32,500 | ₹0 | Settled
├─ C003 | Walk-in | - | ₹22,300 | ₹0 | Good
├─ C004 | Customer D | 9876543212 | ₹18,500 | ₹8,500 | OVERDUE
└─ TOTAL | | | ₹118,300 | ₹13,500 |

Status:
✓ Good = Due within 30 days
⚠ OVERDUE = Due more than 30 days
```

**Collection Status (Ageing)**
```
Shows: How old are customer dues
┌─ Days Overdue | Count | Amount | Customers
├─ 0-30 days (Current) | 5 | ₹8,500 | Hotel A, B...
├─ 31-60 days | 2 | ₹3,200 | Customer D, E...
├─ 61-90 days | 1 | ₹1,500 | Customer F...
└─ 90+ days (Stuck) | 0 | ₹0 | -

TOTAL OUTSTANDING: ₹13,200

Helps prioritize collection calls
```

---

### Category 4: SUPPLIER REPORTS 🚚

**Supplier List**
```
┌─ ID | Supplier | Mobile | Total Purchases | Due | Days
├─ SUP01 | GL Roja | 9876543220 | ₹75,000 | ₹0 | -
├─ SUP02 | Dilip Singh | 9876543221 | ₹45,500 | ₹8,900 | 5 (due soon)
├─ SUP03 | Neil Assoc | 9876543222 | ₹32,000 | ₹5,200 | 12 (overdue)
├─ SUP04 | Local Supplier | 9876543223 | ₹18,500 | ₹0 | -
└─ TOTAL | | | ₹171,000 | ₹14,100 |
```

**Payment Status**
```
Shows: When to pay suppliers
┌─ Supplier | Amount Due | Due Date | Days Status
├─ Dilip Singh | ₹8,900 | 2026-07-25 | 5 days (DUE SOON)
├─ Neil Assoc | ₹5,200 | 2026-07-20 | TODAY (OVERDUE)
├─ GL Roja | ₹4,500 | 2026-08-01 | 12 days
└─ TOTAL | ₹18,600 | | 

Help manage cash flow and supplier relations
```

---

### Category 5: INVENTORY REPORTS 📦

**Stock Summary**
```
Shows: All 30 items with current status
┌─ Item | Stock | Min | Max | Value | Status
├─ Bhetki Whole | 125 KG | 10 | 500 | ₹68,750 | ✓ OK
├─ Fresh Basa | 45 KG | 10 | 200 | ₹15,750 | ✓ OK
├─ Squid | 2.5 KG | 10 | 50 | ₹1,425 | ⚠ LOW
├─ Prawn | 0 | 10 | 100 | ₹0 | ❌ OUT
└─ TOTAL STOCK VALUE: ₹125,680

Also calculated:
- Total items: 30
- Items OK: 28
- Items Low: 1  
- Items Out: 1
```

**Stock Movement Ledger**
```
Complete history showing:
┌─ Date | Type | Bill No | Party | Item | Qty | Running
├─ Jul 20 | Purchase | PR00234 | GL Roja | Bhetki | +10 | 125
├─ Jul 20 | Sale | SAL00001 | Hotel A | Bhetki | -5 | 120
├─ Jul 19 | Purchase | PR00233 | Dilip | Basa | +15 | 45
├─ Jul 19 | Sale | SAL00000 | Hotel B | Basa | -3 | 48
└─ ... (All 306+30 transactions)

Can filter by:
- Date range
- Item
- Supplier/Customer
- Transaction type
```

**Low Stock Alert**
```
Items below minimum (Auto-trigger)
┌─ Item | Current | Min | Need | Last Supplier | Action
├─ Squid | 2.5 | 10 | 7.5 | Dilip Singh | [Create PO]
├─ Prawn | 0 | 10 | 10 | Neil Assoc | [URGENT]
├─ Dead Fish | 0.5 | 5 | 4.5 | Local Supp | [Create PO]
└─ ... 

One-click "Create PO" generates purchase order
```

**Dead Stock Report**
```
Items not sold in 90+ days
┌─ Item | Current Stock | Last Sold | Days | Cost Value
├─ Salted Fish | 50 KG | 2026-04-01 | 110 | ₹25,000
├─ Dried Fish | 12 KG | 2026-04-15 | 96 | ₹6,000
├─ Pickled Item | 5 KG | 2026-05-01 | 80 | ₹3,500
└─ TOTAL DEAD STOCK: ₹34,500

Action: Discount/Donation/Clearance
```

---

### Category 6: ACCOUNTS / GST 💰

**Cash Book**
```
Date-wise cash movements
┌─ Date | Description | In | Out | Balance
├─ Jul 20 | Opening | - | - | ₹50,000
├─ Jul 20 | Sale Billed 10:30 AM (SAL00001) | ₹5,985 | - | ₹55,985
├─ Jul 20 | Purchase Bill PM (PR00234) | - | ₹12,562 | ₹43,423
├─ Jul 20 | Sale Billed 4:00 PM (SAL00002) | ₹3,250 | - | ₹46,673
└─ Jul 20 | Closing | - | - | ₹46,673

Can verify with physical cash count
```

**Bank Book**
```
Date-wise bank movements  
┌─ Date | Cheque # | Description | In | Out | Balance
├─ Jul 20 | - | Opening | - | - | ₹100,000
├─ Jul 20 | - | Sale Card Payment | ₹5,200 | - | ₹105,200
├─ Jul 20 | 12345 | Purchase Cheque | - | ₹8,900 | ₹96,300
└─ Jul 20 | - | Closing | - | - | ₹96,300

Matches with bank statement
```

**GST Summary (For Tax Filing)**
```
Period: Jul 2026 (Monthly)

PURCHASES (Inward Supply):
├─ 0% Tax | ₹0 | Input GST: ₹0
├─ 5% Tax | ₹400,000 | Input GST: ₹20,000
├─ 12% Tax | ₹60,000 | Input GST: ₹7,200
├─ 18% Tax | ₹15,000 | Input GST: ₹2,700
└─ Total | ₹475,000 | Total Input: ₹29,900

SALES (Outward Supply):
├─ 0% Tax | ₹0 | Output GST: ₹0
├─ 5% Tax | ₹200,000 | Output GST: ₹10,000
├─ 12% Tax | ₹35,000 | Output GST: ₹4,200
├─ 18% Tax | ₹8,500 | Output GST: ₹1,530
└─ Total | ₹243,500 | Total Output: ₹15,730

GST LIABILITY:
Output GST: ₹15,730
Less: Input GST: ₹29,900
GST Credit: ₹14,170 (Refundable)

Ready for GST Return filing
```

**P&L Statement**
```
Profit & Loss for July 2026

SALES REVENUE:
Total Sales (30 bills): ₹243,500
Less: Return/Discount: ₹0
─────────────────────
Net Sales: ₹243,500

COST OF GOODS SOLD:
Opening Stock: ₹45,000
+ Purchases: ₹475,000
- Closing Stock: ₹125,680
─────────────────────
COGS: ₹394,320

GROSS PROFIT: ₹243,500 - ₹394,320 = Negative (high purchase)

OPERATING EXPENSES:
Rent/Utilities: ₹0 (not tracked)
Staff: ₹0 (not tracked)
─────────────────────
Total Expenses: ₹0

NET PROFIT: -₹150,820 (before adjustments)

NOTE: 
- Shows actual sales profit without manual expense entry
- Used to track margins on goods
- Full P&L requires expense tracking
```

---

## 🎯 5. QUICK ACTIONS (Bottom FAB Buttons)

| Button | Tap Count | Action |
|--------|-----------|--------|
| 🧾 Sales | 1 | Open sales entry (create invoice) |
| 🛒 Purchase | 1 | Open purchase entry (create PO) |
| 📦 Stock | 1 | View current inventory |
| 📊 Reports | 1 | View 8 report categories |
| ⚙️ Settings | 1 | Configure app, backup, theme |

---

## 🔄 6. DATA AUTO-SYNC (When Enabled)

```
Every action auto-syncs to Google Sheets if connected:

CREATE PURCHASE → Auto-syncs to backend
├─ Updates: PURCHASES table
├─ Updates: Stock levels
├─ Updates: Supplier dues
└─ Updates: Running stock (Stock Ledger)

CREATE SALE → Auto-syncs to backend  
├─ Updates: SALES table
├─ Updates: Stock levels
├─ Updates: Customer dues
├─ Updates: Cash balance
└─ Updates: Running stock (Stock Ledger)

EDIT ITEM → Auto-syncs to backend
├─ Updates: ITEMS master
├─ Updates: Stock levels
└─ Updates: Running rates

RESULT:
✓ Multi-device sync (phone + tablet + web)
✓ Data backup on Google Drive
✓ Never lose data
✓ Offline edits sync when online
```

---

## 💡 7. COMMON WORKFLOWS

### Workflow 1: Morning Stock Check
```
1. Open Business OS
2. Tap "Stock" button
3. See low stock alert (auto-triggered)
4. Tap item with red "❌ OUT" status
5. Tap "[Create PO]" button
6. Select supplier
7. Enter quantity to order
8. Save purchase order
9. Items marked "on order"
10. When received, update quantity
→ Repeat for 5 minutes, done!
```

### Workflow 2: Daily Sales
```
1. Customer arrives
2. Check if walk-in or regular customer
3. Select customer or create new
4. Tap "+Add Item" repeatedly
5. System checks if stock available
6. Calculates bill automatically
7. Select payment mode
8. Tap "Save Bill"
9. Print or email invoice
10. Stock auto-reduced
→ Takes ~2-3 minutes per bill
```

### Workflow 3: Weekly Profit Review
```
1. Tap "Reports" 
2. Tap "Sales" tab
3. Select "This Week" filter
4. See total sales & GST
5. Tap "Accounts" tab
6. View "P&L Statement"
7. Calculate: Sales - Costs = Profit
8. Check "Cash in Hand" status
9. Plan next week purchases
→ 5 minutes for full review
```

### Workflow 4: Month-End Filing
```
1. Tap "Reports"
2. Tap "GST" tab
3. View "GST Summary"
4. Note: Output GST (to pay) vs Input GST (credit)
5. Screenshot or print
6. File GST return online
7. Tap "P&L" for profit confirmation
8. File income tax
→ All data ready, no manual calculation
```

---

## 📞 SUPPORT SHORTCUTS

**Common Issues:**

| Issue | Solution |
|-------|----------|
| Stock showing negative | Tap "System Health" on dashboard |
| Old date showing | Check device Date & Time settings |
| Data not sync | Tap Settings → "Manual Sync" button |
| Report blank | Check date filter (may be filtering out) |
| Print not working | Tap "Export PDF" instead |
| Lost data | Check "Restore from Backup" in Settings |

---

**🎉 You're ready to run your business! All features working, all data loaded, all reports active.**

*Questions? Contact: support@balajinextgen.in or +91-9832014403*
