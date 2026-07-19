# CL00022 FRESH & MORE — DATA IMPORT GUIDE

## 📋 Overview
This package contains normalized purchase register data extracted from 5 JPG pages of manual records. All data is ready to push into Google Sheets MASTER_DB.

---

## 📦 FILES PROVIDED

### 1. **CL00022_NORMALIZED_MASTERS_COMPLETE.xlsx**
   - **Primary file** with all normalized data
   - **Sheets:**
     - `SUPPLIERS` (15 vendors) - Ready to push
     - `ITEMS` (17 products) - Ready to push
     - `PURCHASES` (81 bills)
     - `PURCHASE_LINE_ITEMS` (131 line items)
   - **Status:** ✅ Complete & validated

### 2. **CL00022_NEW_MASTERS.xlsx**
   - **Secondary reference file** with color-coded status
   - **Sheets:**
     - `NEW_SUPPLIERS` (GREEN=new, RED=review needed)
     - `NEW_ITEMS` (GREEN=new, RED=review needed)
     - `PURCHASES` (all 81 bills)
     - `LINE_ITEMS` (all 131 lines)
     - `SUMMARY` (overview stats)
   - **Purpose:** Quick reference, validation check

### 3. **CL00022_PUSH_TO_GAS.gs**
   - Google Apps Script for automation
   - Ready-to-use functions for data push
   - Can be pasted into BALAJI_NEXTGEN_ERP_V2_CORE project

---

## 🚀 QUICK START (3 Steps)

### **STEP 1: Push SUPPLIERS**
```javascript
// In Google Apps Script console, run:
CL00022_PushAllNormalizedData()

// Or manually:
1. Open CL00022 MASTER_DB in Google Sheets
2. Go to SUPPLIERS sheet
3. Copy rows from CL00022_NORMALIZED_MASTERS_COMPLETE.xlsx SUPPLIERS sheet
4. Paste into MASTER_DB starting at row 2
```

**Expected Result:**
- 15 new supplier records added
- IDs: SUP0001 to SUP0015
- Akram Mallick appears ~40+ times in purchase register

### **STEP 2: Push ITEMS**
```javascript
// Same function pushes items automatically
// Or manually copy from CL00022_NORMALIZED_MASTERS_COMPLETE.xlsx ITEMS sheet
```

**Expected Result:**
- 17 new product records added
- IDs: ITEM0001 to ITEM0017
- Fresh Basa, Bhetki, Prawns, Squid main items
- Rates: ₹100 (head) to ₹1400 (tiger prawn)

### **STEP 3: Push PURCHASES & LINE ITEMS**
```
Option A: Copy directly from Excel
1. Go to CL00022_NORMALIZED_MASTERS_COMPLETE.xlsx PURCHASES sheet
2. Select all 81 bills
3. Paste into MASTER_DB PURCHASES sheet (starting row 2)
4. Repeat for PURCHASE_LINE_ITEMS

Option B: Use the provided .gs script
- Add CL00022_PUSH_TO_GAS.gs to your Apps Script project
- Run CL00022_ImportPurchasesFromSheet()
```

---

## ⚠️ ITEMS REQUIRING MANUAL REVIEW

### **Problem Suppliers** (2 records)
| ID | Name | Issue |
|----|------|-------|
| SUP0013 | SUPPLIER NOT LEGIBLE - review | Handwriting unclear |
| SUP0014 | NOT IN MASTER LIST - please confirm | Unidentified vendor |

**Action Required:**
- Check original JPG images
- Cross-reference with existing MASTER_DB SUPPLIERS
- Update names before pushing to production

### **Problem Items** (1 record)
| ID | Name | Issue |
|----|------|-------|
| ITEM0013 | NOT IN MASTER LIST - please confirm | Unidentified product |

**Action Required:**
- Appears in 1 bill only (appears to be an error or scrap code)
- Recommend deleting this item ID or clarifying
- Check original JPGs for context

---

## 📊 DATA SUMMARY

| Entity | Count | Details |
|--------|-------|---------|
| **SUPPLIERS** | 15 | Akram Mallick dominates (40+ bills) |
| **ITEMS** | 17 | Seafood/meat only (Fresh & More) |
| **PURCHASES** | 81 | Nov 2025 - May 2026 |
| **PURCHASE_LINE_ITEMS** | 131 | Multi-item bills grouped |
| **TOTAL VALUE** | ₹548,145.90 | ~6 months of purchases |

---

## 📅 DATE RANGE & COVERAGE
- **From:** 25 November 2025
- **To:** 7 March 2026
- **Duration:** ~3.5 months
- **Source:** Manual Purchase Register (handwritten)

---

## 🔗 LINKING & RELATIONSHIPS

### **PURCHASES links to:**
- `SUPPLIER_ID` → SUPPLIERS.ID
- Date, Invoice No

### **PURCHASE_LINE_ITEMS links to:**
- `PURCHASE_ID` → PURCHASES.ID
- `ITEM_ID` → ITEMS.ID

### **Sales Rate Calculation:**
- Automatically set to +20% of Purchase Rate
- Can be adjusted per item in production

---

## ✅ VALIDATION CHECKLIST

After pushing, verify:

- [ ] SUPPLIERS sheet has 15 records (SUP0001-SUP0015)
- [ ] ITEMS sheet has 17 records (ITEM0001-ITEM0017)
- [ ] PURCHASES sheet has 81 records
- [ ] PURCHASE_LINE_ITEMS sheet has 131 records
- [ ] Total purchase value = ₹548,145.90
- [ ] No duplicate entries
- [ ] All supplier IDs in PURCHASES exist in SUPPLIERS
- [ ] All item IDs in LINE_ITEMS exist in ITEMS
- [ ] Problem items flagged for review (SUP0013, SUP0014, ITEM0013)

---

## 🛠️ TROUBLESHOOTING

### Issue: "Sheet not found" error
**Solution:** Verify sheet names match exactly:
- SUPPLIERS (not Suppliers or suppliers)
- ITEMS (not Items or items)
- PURCHASES (not Purchase or purchase)
- PURCHASE_LINE_ITEMS (not Purchase_Line_Items)

### Issue: Duplicate data after push
**Solution:** Check if running multiple times. Clear rows 2+ before pushing again.

### Issue: #REF! errors after linking
**Solution:** Ensure all IDs match between related sheets:
- SUPPLIER_ID must exist in SUPPLIERS.ID
- ITEM_ID must exist in ITEMS.ID

### Issue: Rates seem off
**Solution:** Sale rates are auto-calculated at +20% markup. Update manually if needed.

---

## 📱 NEXT STEPS

After successful import:

1. **Inventory Reconciliation** → Calculate opening/closing stock from line items
2. **Purchase Register Report** → Build Tally-style pivot (months vs items)
3. **Supplier Analytics** → Akram Mallick analysis (40+ bills, ~₹300K)
4. **GST Compliance** → All items marked 5% - verify for actual GST rate
5. **POS Integration** → Link items to POS menu for sales tracking

---

## 📧 CONTACT & SUPPORT

**Original Data Source:** 5 JPG pages of handwritten purchase register  
**Processed By:** Claude AI  
**Date:** 19 July 2026  
**Client:** CL00022 Fresh & More (restaurant, Kolkata)

For questions, check original JPG images or contact supplier directly.

---

## 📄 SHEET SPECIFICATIONS

### SUPPLIERS Sheet Structure
```
Column A: ID (SUP0001, SUP0002, ...)
Column B: NAME (Supplier name)
Column C: MOBILE (Phone number or NULL)
Column D: DUE (Outstanding amount)
```

### ITEMS Sheet Structure
```
Column A: ID (ITEM0001, ITEM0002, ...)
Column B: NAME (Product name)
Column C: UNIT (kg, pkt, etc.)
Column D: HSN (HSN code or NULL)
Column E: PURCHASE_RATE (Cost price in ₹)
Column F: SALE_RATE (Selling price in ₹, auto 20% markup)
Column G: GST_PERCENT (5%)
```

### PURCHASES Sheet Structure
```
Column A: PURCHASE_ID (PUR000001, PUR000002, ...)
Column B: SUPPLIER_ID (References SUPPLIERS.ID)
Column C: SUPPLIER_NAME (Copy of SUPPLIERS.NAME)
Column D: DATE (Invoice date)
Column E: INVOICE_NO (Supplier's bill number)
Column F: TOTAL (Bill total in ₹)
Column G: TAXABLE (Taxable amount)
Column H: GST_TOTAL (GST amount)
```

### PURCHASE_LINE_ITEMS Sheet Structure
```
Column A: LINE_ID (PL000001, PL000002, ...)
Column B: PURCHASE_ID (References PURCHASES.ID)
Column C: ITEM_ID (References ITEMS.ID)
Column D: ITEM_NAME (Copy of ITEMS.NAME)
Column E: QTY (Quantity ordered)
Column F: RATE (Rate per unit in ₹)
Column G: EXTRA_EXP (Extra expenses/packaging)
Column H: TOTAL (Line item total in ₹)
```

---

**END OF GUIDE**
