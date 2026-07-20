# ⚡ Fast Purchase Entry — Quick Reference & Setup

## 2-Minute Setup

### Step 1: Add JavaScript
```html
<!-- Before </body>, add: -->
<script src="fast_purchase_entry_module.js"></script>
```

### Step 2: Add HTML UI
```html
<!-- After docSheet, paste content from: -->
<!-- fast_purchase_entry_html_ui.txt -->
```

### Step 3: Add Menu Button
```html
<!-- In Purchase menu, add: -->
<button class="lc-act" onclick="openFastPurchaseEntry()">
  <div style="font-size:20px;margin-right:10px;">⚡</div>
  <span>Fast Purchase Entry</span>
</button>
```

---

## ⚡ Quick Start (30 Seconds)

### Open
```
Menu → Purchase → [⚡ Fast Purchase Entry]
```

### Enter Data
```
1. Select Supplier
2. Enter Invoice No
3. Click [➕ Add Line]
4. Type Item Name (autocomplete shows)
5. Click Item
6. Tab → Qty → Tab → Rate → Tab → GST → Enter
7. Repeat for more items
8. Alt+S → Save
```

### Total Time: 2 minutes per invoice!

---

## ⌨️ Keyboard Master Guide

| Action | Keyboard |
|--------|----------|
| Move to next field | Tab |
| Add new line | Enter (from GST field) |
| Clear current line | Escape |
| Add new line (global) | Alt+A |
| Save purchase | Alt+S |

---

## 🚀 Three Entry Methods

### Method 1: Manual (2 min per invoice)

```
1. Type Item Name
2. Click from dropdown
3. Tab through: Qty → Rate → GST
4. Enter → New line
5. Repeat
```

### Method 2: Excel Paste (1 min for 10 items)

```
Copy from Excel:
Item Name | Qty | Rate | GST
Chicken|50|120|5
Bhetki|30|280|5

Click [📋 Paste]
Paste → Done!
```

### Method 3: Hybrid (Fastest)

```
1. Paste 5 items from Excel
2. Add 2 new items manually
3. Alt+S → Save
Done!
```

---

## 💡 Real Example (2 Minutes)

```
TASK: Enter invoice INV-001 from Akram Mallick
Items: Chicken (50 kg @ ₹120), Bhetki (30 kg @ ₹280)

WORKFLOW:
1. Select "Akram Mallick Chicken"
2. Invoice No: INV-001
3. Click [➕ Add Line]
4. Type: "Chic" → Click "Chicken Whole"
5. Auto-fills Unit (Kg), Rate (₹120), GST (5%)
6. Type Qty: 50
7. Tab → Rate (OK) → Tab → GST (OK)
8. Enter → New line added
9. Type: "Bhek" → Click "Bhetki Fresh"
10. Type Qty: 30
11. Tab → Rate (OK) → Tab → GST (OK)
12. Alt+S → Save!

RESULT: INV-001 with 2 items saved in 2 minutes!
```

---

## 📊 Speed Comparison

```
Manual Entry (Old Way):
1 invoice, 3 items = 10 minutes
Per week (20 items) = 2+ hours

Fast Entry (New Way):
1 invoice, 3 items = 2 minutes
Per week (20 items) = 10 minutes
SAVED: 2 hours per week!
```

---

## ✅ Checklist Before Save

- [ ] Supplier selected
- [ ] Invoice No entered
- [ ] Date filled
- [ ] At least 1 item added
- [ ] All items have: Name, Qty, Rate
- [ ] Total amount shows
- [ ] Numbers look correct

---

## 🎯 Tips for Speed

```
✅ Type just 3 chars for item (autocomplete finds it)
✅ Use Tab instead of clicking (faster)
✅ Use Alt+S instead of clicking Save (faster)
✅ Use Paste for bulk entries (seconds for 10 items)
✅ Don't click, use keyboard only (2x faster)
✅ Verify rate matches before Tab
✅ Paste Excel format: Item|Qty|Rate|GST
```

---

## 🔧 Common Issues

| Problem | Fix |
|---------|-----|
| Can't find item | Check if it exists in Inventory |
| Rate not showing | Add Purchase Rate in Inventory |
| Supplier not found | Create supplier in Suppliers menu |
| Total not calculating | Fill both Qty AND Rate |
| Can't press Enter | Only works from GST field (last) |

---

## 📁 Files

- `fast_purchase_entry_module.js` - Main code
- `fast_purchase_entry_html_ui.txt` - UI
- `FAST_PURCHASE_ENTRY_COMPLETE_GUIDE.md` - Full guide
- This file - Quick reference

---

## Status: ✅ READY TO USE

Copy code → Add to HTML → Start using!

Questions? Email: balajisoftware2013@gmail.com

**Start entering faster! ⚡**

