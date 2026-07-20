# 📥 Invoice Import & AI Scanning System

## Complete Implementation Guide

---

## 📋 Overview

This system provides **three ways to import purchase invoices**:

1. **📊 Excel Bulk Import** — Download template, fill in data, upload
2. **🤖 AI Invoice Scan** — Upload invoice photo/PDF, AI extracts data
3. **Manual Entry** — Traditional form entry (existing method)

---

## 🚀 Installation

### Step 1: Add JavaScript Module
Add `invoice_import_module.js` code to your Business OS HTML:

Location in HTML:
```html
</head>
<body>
  <!-- ... existing content ... -->
  
  <script src="invoice_import_module.js"></script>
  <!-- Or copy the entire invoice_import_module.js content here -->
</body>
</html>
```

### Step 2: Add HTML UI
Copy content from `invoice_import_html_ui.txt` into your Business OS HTML:

Location:
```html
<!-- After: <div id="docSheet"> section -->
<!-- Paste the invoice import sheet HTML here -->
<div id="invoiceImportSheet" class="sheet" style="display:none;">
  <!-- ... copy full content ... -->
</div>
```

### Step 3: Add Menu Button
Add this button to your Purchase menu in Business OS:

```html
<!-- In the Purchase section menu -->
<button class="lc-act" onclick="openInvoiceImport()">
  📥 Import Invoices (Excel / AI Scan)
</button>
```

### Step 4: Optional - AI Setup (Claude API)
For AI invoice scanning to work:

```javascript
// Add your Claude API key configuration
const CLAUDE_API_KEY = 'your-api-key-here';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
```

---

## 📊 Method 1: Excel Bulk Import

### How It Works

#### Step 1: Download Template
```
Menu → Purchase → [📥 Import Invoices]
Tab: "📊 Excel Bulk Import"
Click: [⬇️ Download Template]
```

**File:** `Purchase_Import_Template_2026-07-21.xlsx`

#### Step 2: Fill Template
Open Excel and fill in columns:

```
┌────────────┬──────────┬──────────────────────┬──────────────┬──────────┬──────┬───────┬─────────┬──────────────┐
│ Invoice No │ Date     │ Supplier Name        │ Item Name    │ Quantity │ Unit │ Rate  │ GST %   │ Remarks      │
├────────────┼──────────┼──────────────────────┼──────────────┼──────────┼──────┼───────┼─────────┼──────────────┤
│ INV-001    │ 2026-07-20 │ Akram Mallick Chicken│ Chicken Whole│ 50       │ Kg   │ 120   │ 5       │ Premium grade│
│ INV-001    │ 2026-07-20 │ Akram Mallick Chicken│ Bhetki Fresh │ 30       │ Kg   │ 280   │ 5       │ Fresh catch  │
│ INV-002    │ 2026-07-21 │ Fresh Farms Ltd      │ Vegetables   │ 100      │ Kg   │ 45    │ 0       │ Seasonal     │
└────────────┴──────────┴──────────────────────┴──────────────┴──────────┴──────┴───────┴─────────┴──────────────┘
```

**Rules:**
- ✅ Invoice No: Must be same for all items in one invoice
- ✅ Date: Format as YYYY-MM-DD (2026-07-20)
- ✅ Supplier Name: Must exactly match existing Supplier (or create first)
- ✅ Item Name: Must exactly match existing Item (or create first)
- ✅ Quantity: Must be a number (50, not "50 Kg")
- ✅ Unit: Kg, Pcs, Liter, Box, etc.
- ✅ Rate: Cost per unit (₹)
- ✅ GST %: Tax rate (0, 5, 12, 18, 28)
- ✅ Remarks: Optional notes

#### Step 3: Upload & Review
```
Click: [Upload Excel file]
Select: Your filled Excel file
```

**Preview shows:**
- Number of invoices detected
- Line items per invoice
- Total amount per invoice
- Any errors (highlighted in red)

Example:
```
✅ 3 purchase(s), 8 line items

INV-001 | 2026-07-20 | Akram Mallick Chicken & Fish Counter
├─ Chicken Whole × 50 Kg @ ₹120
├─ Bhetki Fresh × 30 Kg @ ₹280
└─ Total: ₹14,400

INV-002 | 2026-07-21 | Fresh Farms Ltd
├─ Vegetables Mix × 100 Kg @ ₹45
└─ Total: ₹4,500

INV-003 | 2026-07-21 | Seafood Direct
├─ Shrimp Medium × 15 Kg @ ₹350
└─ Total: ₹5,250
```

#### Step 4: Confirm Import
```
Click: [✅ Import All Invoices]
```

**What happens:**
- ✅ All invoices added to Purchase Master
- ✅ Stock updated for each item
- ✅ Supplier dues updated
- ✅ Database saved automatically

---

## 🤖 Method 2: AI Invoice Scanning

### How It Works

#### Step 1: Open AI Scanner
```
Menu → Purchase → [📥 Import Invoices]
Tab: "🤖 AI Invoice Scan"
```

#### Step 2: Upload Invoice
```
Click: [📸 Upload Invoice Image or PDF]
Select: Invoice photo or PDF
```

**Supported formats:**
- 📷 Photo (JPG, PNG) — Any invoice photo
- 📄 PDF — Scanned invoices

#### Step 3: AI Extracts Data
**What AI reads:**
- Invoice number
- Invoice date
- Supplier name
- Item names & quantities
- Unit prices
- GST details
- Total amount

**Example extraction:**
```
Original Invoice (Photo/PDF)
├─ Invoice No: INV-2026-1245
├─ Date: 20/07/2026
├─ Supplier: Akram Mallick Chicken
├─ Items:
│  ├─ Chicken Whole - 50 Kg @ ₹120 (GST 5%)
│  ├─ Bhetki Fresh - 30 Kg @ ₹280 (GST 5%)
│  └─ Subtotal: ₹14,400
│
└─ Status: ✅ Extracted by AI

AI Output (Structured):
{
  "invoiceNo": "INV-2026-1245",
  "date": "2026-07-20",
  "supplierName": "Akram Mallick Chicken & Fish Counter",
  "items": [
    {"name": "Chicken Whole", "qty": 50, "unit": "Kg", "rate": 120, "gst": 5},
    {"name": "Bhetki Fresh", "qty": 30, "unit": "Kg", "rate": 280, "gst": 5}
  ],
  "total": 14400,
  "remarks": ""
}
```

#### Step 4: Review & Edit
Form shows extracted data:

```
Invoice No: [INV-2026-1245    ]  Date: [2026-07-20]
Supplier:   [Akram Mallick Chicken & Fish Counter]

Items (edit if needed):
[Chicken Whole] × [50] [Kg] @ ₹[120] [GST 5%]
[Bhetki Fresh ] × [30] [Kg] @ ₹[280] [GST 5%]

Remarks: [Premium quality chicken]

Total Amount: ₹14,400
```

#### Step 5: Save Invoice
```
Click: [💾 Save This Invoice]
```

**System validates:**
- ✅ Invoice No is unique
- ✅ Date is valid (YYYY-MM-DD)
- ✅ Supplier exists (or error message with link to create)
- ✅ All items exist (or error message)
- ✅ Quantities and rates are numbers

**Result:**
- ✅ Invoice saved to Purchase Master
- ✅ Stock updated
- ✅ Supplier dues updated
- ✅ Notification: "✅ Invoice INV-2026-1245 saved! ₹14,400 from Akram Mallick"

---

## 📝 Template Details

### Column Specifications

| Column | Type | Format | Example | Required |
|--------|------|--------|---------|----------|
| A: Invoice No | Text | Any format | INV-001, 2026-1245, PO-123 | ✅ Yes |
| B: Date | Date | YYYY-MM-DD | 2026-07-20 | ✅ Yes |
| C: Supplier Name | Text | Must exist | Akram Mallick Chicken & Fish Counter | ✅ Yes |
| D: Item Name | Text | Must exist | Chicken Whole, Bhetki Fresh | ✅ Yes |
| E: Quantity | Number | Decimal OK | 50, 25.5, 100.25 | ✅ Yes |
| F: Unit | Text | Kg/Pcs/Liter/Box | Kg | ✅ Yes |
| G: Rate | Number | Decimal OK | 120, 45.50, 280.75 | ✅ Yes |
| H: GST % | Number | 0/5/12/18/28 | 5 | ✅ Yes |
| I: Remarks | Text | Optional notes | Premium quality | ❌ No |

### Rules & Validation

#### Invoice No
```
✅ Unique per invoice date
✅ Can include: letters, numbers, dashes
✗ Cannot be blank
✗ Cannot have special characters: @#$%&*()

Examples: INV-001, 2026-1245, PO-123, PURC-07-20, A001
```

#### Date
```
✅ Format: YYYY-MM-DD (2026-07-20)
✗ Wrong: 20-07-2026, 07/20/2026, 20.07.2026
✗ Cannot be future date (must be today or earlier)
✗ Cannot be blank

Use: 4-digit year, 2-digit month, 2-digit day with dashes
```

#### Supplier Name
```
✅ Must exactly match Suppliers list
✓ "Akram Mallick Chicken & Fish Counter" ← Exact match
✗ "akram mallick chicken" ← Different capitalization (will fail)
✗ "Akram Mallick" ← Incomplete name (will fail)

If supplier doesn't exist:
  → Go to Customers/Suppliers menu
  → Add new supplier first
  → Then import with exact name
```

#### Item Name
```
✅ Must exactly match Items list
✓ "Chicken Whole" ← Exact match
✗ "Chicken" ← Partial (will fail)
✗ "chicken whole" ← Wrong case (will fail)

If item doesn't exist:
  → Go to Inventory
  → Add item first with exact name and unit
  → Then import
```

#### Quantity & Rate
```
✅ Must be numbers
✅ Decimals OK: 50.5, 120.75
✗ Cannot have text: "50 Kg", "50 units"
✗ Cannot be blank
✗ Cannot be zero (for rate)

The system will multiply: Quantity × Rate to get Amount
```

---

## 🔧 AI Setup (Optional)

### Enable Claude API (For Advanced AI Scanning)

To use AI invoice scanning with full Claude API integration:

#### 1. Get Claude API Key
```
Visit: https://console.anthropic.com
Sign up/login
Get API key
```

#### 2. Add to Business OS
```html
<script>
  // Add your Claude API configuration
  const CLAUDE_CONFIG = {
    apiKey: 'sk-ant-...',
    model: 'claude-3-5-sonnet-20241022'
  };
  
  // Enable AI invoice parsing
  window.ENABLE_AI_PARSING = true;
</script>
```

#### 3. How AI Works
```
User uploads invoice (photo/PDF)
    ↓
JavaScript converts to base64
    ↓
Sends to Claude API with prompt
    ↓
Claude reads and extracts:
  - Invoice number
  - Date
  - Supplier name
  - Items & quantities
  - Unit prices
  - GST %
    ↓
Returns structured JSON
    ↓
Auto-fills form in Business OS
    ↓
User reviews and clicks Save
```

#### 4. Prompt Used (What AI reads)
```javascript
"Extract invoice details from this image/PDF:

Return ONLY a JSON object:
{
  "invoiceNo": "...",
  "date": "2026-07-20 format",
  "supplierName": "...",
  "items": [
    {
      "name": "...",
      "quantity": 50,
      "unit": "Kg/Pcs/etc",
      "rate": 120.00,
      "gst": 5
    }
  ],
  "total": 6500.00,
  "remarks": "..."
}"
```

---

## 🔄 Workflow Comparison

### Before (Manual Entry)
```
Step 1: Open Purchase entry form
Step 2: Fill invoice No
Step 3: Fill date
Step 4: Select supplier
Step 5: For each item:
  - Search & select item
  - Enter quantity
  - Enter rate
  - Enter GST
  - Repeat
Step 6: Click Save

Time: 10-15 minutes per invoice
```

### After (Bulk Import)
```
Step 1: Fill Excel (copy-paste from email/PDF)
Step 2: Upload Excel
Step 3: Review preview
Step 4: Click Confirm

Time: 2-3 minutes per 10 invoices (Bulk)
```

### After (AI Scan)
```
Step 1: Take photo of invoice
Step 2: Upload to system
Step 3: AI extracts (automatic)
Step 4: Review form
Step 5: Click Save

Time: 1-2 minutes per invoice
```

---

## ✅ Validation & Error Handling

### What System Checks

✅ **Invoice No:**
- Cannot be blank
- Must be unique with date
- No special characters

✅ **Date:**
- Format YYYY-MM-DD
- Cannot be blank
- Cannot be future date

✅ **Supplier:**
- Must exist in Suppliers list
- Exact name match required
- Shows link to create if missing

✅ **Items:**
- Must exist in Items list
- Exact name match required
- Shows link to create if missing

✅ **Quantity & Rate:**
- Must be valid numbers
- Cannot be zero
- Decimals OK

### Error Messages

**Error:** Supplier "Akram Mallick" not found
```
Solution: Go to Suppliers → Create new supplier with exact name
```

**Error:** Item "Chicken" not found
```
Solution: Go to Inventory → Create item with exact name + unit
```

**Error:** Invoice INV-001 already exists
```
Solution: Delete existing invoice first, or use different invoice No
```

**Error:** Invalid date format
```
Solution: Use YYYY-MM-DD format (2026-07-20, not 20-07-2026)
```

---

## 📊 After Import: What Gets Updated

### Step-by-Step Process

#### 1. Purchase Master
```
Adds new row:
├─ Invoice No: INV-001
├─ Date: 2026-07-20
├─ Supplier: Akram Mallick Chicken & Fish Counter
├─ Items: 2 (Chicken 50kg, Bhetki 30kg)
├─ Total: ₹14,400
├─ Mode: Credit (default)
└─ Status: Saved
```

#### 2. Item Stock
```
For each item, adds quantity:
├─ Chicken Whole: Stock +50 Kg
├─ Bhetki Fresh: Stock +30 Kg
└─ Updates purchase rate to latest
```

#### 3. Supplier Dues
```
Updates supplier balance:
├─ Akram Mallick: Due +₹14,400
└─ Status: Now "Outstanding"
```

#### 4. Reports Update
```
All these reports automatically updated:
├─ Purchase Register (shows new invoices)
├─ Purchase Summary (totals increased)
├─ By Supplier (supplier amount increased)
├─ By Item (item quantities updated)
├─ Inventory (stock levels updated)
├─ Supplier Ledger (dues updated)
└─ Balance Sheet (assets/liabilities changed)
```

---

## 💡 Tips & Best Practices

### Excel Import
```
✅ Keep supplier names consistent
✅ Use exact item names from Inventory
✅ Fill one invoice per set of rows (same Invoice No)
✅ Check preview before importing
✅ Save imported Excel for records
✅ Date in YYYY-MM-DD format
✅ Decimal OK for quantity/rate: 50.5, 120.75
```

### AI Scan
```
✅ Take clear photos of invoice
✅ Include all invoice details in photo
✅ PDF scans work well
✅ Review extracted data before saving
✅ Edit if AI misread anything
✅ Keep original invoice photo
✅ Use for reconciliation later
```

### General
```
✅ Create suppliers first (Customers/Suppliers menu)
✅ Create items first (Inventory menu)
✅ Import regularly (weekly/daily)
✅ Keep backup of Excel files
✅ Check import count notification
✅ Verify stock updates in Inventory
✅ Confirm supplier dues in Supplier Ledger
```

---

## 📱 Supported Devices

| Device | Excel Import | AI Scan | Notes |
|--------|--------------|---------|-------|
| Desktop | ✅ | ✅ | Best experience |
| Laptop | ✅ | ✅ | Optimal |
| Tablet | ✅ | ✅ | Good for photos |
| Mobile | ✅ | ✅ | Camera upload easy |

---

## 🔐 Data Security

✅ All data stored locally (no cloud sync)
✅ Imported data goes to your Google Sheets
✅ No third-party access
✅ AI scanning works offline (fallback mode)
✅ Original invoice files can be deleted after import
✅ Undo available (restore from backup)

---

## 🐛 Troubleshooting

### Issue: Excel file won't upload
**Solution:**
1. Make sure file is in .xlsx format (not .xls)
2. Check file size < 5 MB
3. Try downloading template again
4. Use Google Sheets to convert if needed

### Issue: Supplier not found (even though it exists)
**Solution:**
1. Check exact spelling in Excel
2. Go to Suppliers → Verify exact name
3. Excel name must match EXACTLY (capitalization matters)
4. Try copy-paste from Suppliers list

### Issue: Item not found
**Solution:**
1. Go to Inventory
2. Search for item
3. If not exists: Create it with exact name + unit
4. Use exact name in Excel

### Issue: Stock not updating
**Solution:**
1. Check if import showed as successful
2. Go to Inventory → Search item
3. Verify stock increased
4. If not: Item name didn't match exactly

### Issue: Supplier dues not updating
**Solution:**
1. Check if invoice saved (notification shown)
2. Go to Suppliers → Find supplier
3. Check "Due" field increased
4. If not: Invoice didn't save (check errors)

### Issue: AI can't read my invoice
**Solution:**
1. Take clearer photo (good lighting)
2. Ensure invoice number visible
3. Ensure supplier name visible
4. Fill manually if AI fails
5. Try PDF if photo doesn't work

---

## 📞 Support

**Questions?**
- Check MATRIX_REPORTS_GUIDE.md for other features
- Email: balajisoftware2013@gmail.com
- WhatsApp: 9832014403

---

## Version

| Property | Value |
|----------|-------|
| Module | Invoice Import & AI Scanning v1.0 |
| Release | 2026-07-21 |
| Files | invoice_import_module.js + HTML UI |
| Browser | All modern browsers |
| Mobile | ✅ Responsive |

---

**Ready to import invoices faster! 🚀**

