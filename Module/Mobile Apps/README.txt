═══════════════════════════════════════════════════════════════════════════════
BALAJI NEXTGEN BUSINESS OS v17 — QUICK START GUIDE
═══════════════════════════════════════════════════════════════════════════════

WHAT'S IN THIS PACKAGE?
─────────────────────────────────────────────────────────────────────────────
1. Code.gs (v17)                    → Improved Google Apps Script backend
2. balaji-business-os-v17-improved.html → HTML frontend (reference version)
3. FIXES_SUMMARY.txt                → Complete list of all v17 fixes
4. HTML_PATCH_GUIDE.md              → Code snippets for HTML updates
5. README.txt                       → This file

KEY IMPROVEMENTS IN v17
─────────────────────────────────────────────────────────────────────────────

✓ FIX I:  Real-Time Sync to Google Sheets
           Every purchase/sale/customer/supplier/item now syncs to its sheet
           tab immediately. If data corrupts, recovery is automatic from sheets.

✓ FIX H:  Purchase/Sale Line Items Persistence
           Item-level details (qty, rate, GST) now attached to recovered bills.
           Stock Ledger and Item-wise reports now work correctly.

✓ FIX K:  Purchase & Sales Ledgers (Tally-Style)
           New endpoints for transaction-by-transaction reporting with item
           details. Can group by supplier/customer or item.

✓ FIX L:  Stock Ledger
           Track every purchase/sale movement per item with running balance.
           Stock Summary shows current stock + min levels.

✓ FIX M:  Date Range Filtering
           All reports support TODAY/MONTH/QUARTER/HALF/FY filtering.
           Dashboard can switch between periods instantly.

✓ FIX J:  Password Security Hardening
           All new passwords hashed with per-user salt.
           Legacy plaintext passwords auto-upgraded on login.

═══════════════════════════════════════════════════════════════════════════════
DEPLOYMENT STEPS (5 minutes)
═══════════════════════════════════════════════════════════════════════════════

STEP 1: DEPLOY BACKEND (Code.gs)
───────────────────────────────────
1. Open your Google Apps Script project for Business OS
   - Go to script.google.com
   - Open the current project (BALAJI_NEXTGEN_ERP_V2_CORE)

2. BACKUP current Code.gs:
   - Select all (Ctrl+A)
   - Copy to a text file for safekeeping

3. REPLACE Code.gs:
   - Delete all current content
   - Paste the new Code.gs v17 from this package
   - Save (Ctrl+S)

4. DEPLOY as NEW VERSION:
   - Click "Deploy" → "New Deployment"
   - Type: "Web app"
   - Execute as: Your account
   - Who has access: Anyone
   - Click "Deploy"
   - Copy the new deployment URL

5. UPDATE FRONTEND:
   - Open balaji-business-os.html
   - Find: const API_URL = 'https://script.google.com/macros/s/...'
   - Replace with new deployment URL from step 4

TEST BACKEND:
   - Visit the deployment URL in browser
   - Should show: "Balaji NextGen Business OS API is live (v17 - ...)"

STEP 2: UPDATE FRONTEND (balaji-business-os.html)
──────────────────────────────────────────────────
1. Read HTML_PATCH_GUIDE.md carefully

2. Add these functions to your HTML:
   - syncPurchaseRow(), syncSaleRow()
   - syncCustomerRow(), syncSupplierRow(), syncItemRow()
   - loadPurchaseLedger(), loadSalesLedger()
   - loadItemWisePurchase(), loadItemWiseSales()
   - loadStockLedger(), loadStockSummary()
   - filterByDateRange()

3. Call sync functions:
   - After recordPurchase() → await syncPurchaseRow(...)
   - After recordSale() → await syncSaleRow(...)
   - After addCustomer() → await syncCustomerRow(...)
   - After addSupplier() → await syncSupplierRow(...)
   - After addItem() → await syncItemRow(...)

4. Add new pages:
   - Purchase Ledger (/purchase-ledger)
   - Sales Ledger (/sales-ledger)
   - Item-wise Purchase (/item-purchase)
   - Item-wise Sales (/item-sales)
   - Stock Ledger (/stock-ledger)
   - Stock Summary (/stock-summary)

5. Add date range selector to Dashboard

6. Test in browser (mobile & desktop):
   - Create test purchase → verify PURCHASES sheet updated
   - Create test sale → verify SALES sheet updated
   - Open Purchase Ledger → verify bills + items display
   - Switch date range on dashboard → verify stats update

STEP 3: VERIFY EXISTING CLIENTS
──────────────────────────────────
For each client using Business OS:

1. LOGIN TO CLIENT:
   - Use admin account
   - Verify successful login with v17 backend

2. CHECK DATA INTEGRITY:
   - Open DevTools > Console
   - Run: console.log(CURRENT_DB_DATA.purchases.length)
   - Note the count

3. VERIFY SHEET SYNC:
   - Open client's Google Sheet
   - Check PURCHASES, SALES, CUSTOMERS, SUPPLIERS, ITEMS tabs exist
   - Check they have data (at least row count matches DB)

4. TEST NEW REPORTS:
   - Try Purchase Ledger → should load without error
   - Try Stock Ledger → should show item movements
   - Try date filters → should refresh

5. PASSWORD CLEANUP (if needed):
   - In Google Apps Script Apps Script Editor Console
   - Run: hashAllPlaintextUserPasswords()
   - Should return: "Hashed 0 plaintext password(s)" if clean

═══════════════════════════════════════════════════════════════════════════════
WHAT HAPPENS ON FIRST LOGIN AFTER v17 DEPLOY?
─────────────────────────────────────────────────────────────────────────────
• loadDB() → reconcileDB() runs automatically
• reconcileDB() checks NEW markers in APP_DATA!F1/G1/H1
• If blank (first time), full backfill of customers/suppliers/items from sheets
• Takes ~1-2 seconds for typical client (1000s of transactions)
• All subsequent logins are fast
• One-time, automatic, silent — no user action needed

═══════════════════════════════════════════════════════════════════════════════
TROUBLESHOOTING
─────────────────────────────────────────────────────────────────────────────

ISSUE: "Deployment URL not found" or 404
→ Make sure you've deployed Code.gs and copied the NEW deployment URL
→ Old v16 URL won't work with new endpoints

ISSUE: "syncPurchaseRow is not defined"
→ Make sure sync functions are added to your HTML (Section 1 of patch guide)

ISSUE: "PURCHASES sheet not found"
→ Sheet tabs might not exist yet — run fixCL00022Now() manually
→ Or wait for auto-creation on next client login

ISSUE: Stock numbers are wrong
→ This is normal if client has old purchases without lineItems
→ Stock is calculated from current item.stock, not recovered from old bills
→ Run physical stock count and update via Inventory page

ISSUE: Offline mode not working
→ Sync calls are async and non-blocking
→ App still saves locally if sync fails
→ On reconnect, sync happens on next save

═══════════════════════════════════════════════════════════════════════════════
PERFORMANCE & LIMITS
─────────────────────────────────────────────────────────────────────────────
• Sync calls: ~500ms per transaction (network dependent)
• Report generation: ~1-2s for typical client (500-1000 transactions)
• Google Sheets API: 300 requests/min (should never hit limit in practice)
• DB_JSON blob: 10MB limit (typical client ~2-3MB)

═══════════════════════════════════════════════════════════════════════════════
NEXT STEPS AFTER DEPLOYMENT
─────────────────────────────────────────────────────────────────────────────
1. ✓ Deploy Code.gs v17
2. ✓ Update HTML with sync & report functions
3. ✓ Test with one client
4. ✓ Verify all clients work
5. → Monitor ERROR_LOG sheet for any issues
6. → Collect user feedback on new reports
7. → Plan UI improvements based on feedback

═══════════════════════════════════════════════════════════════════════════════
FILE REFERENCE
─────────────────────────────────────────────────────────────────────────────
For detailed information, see:

FIXES_SUMMARY.txt
  └─ Complete technical details on all 6 fixes (H, I, J, K, L, M)
  └─ Implementation checklist
  └─ Testing guide
  └─ API endpoint reference

HTML_PATCH_GUIDE.md
  └─ Code snippets for all 6 sync functions
  └─ Code snippets for all 6 report loaders
  └─ HTML markup for new pages
  └─ JavaScript for date range filtering

═══════════════════════════════════════════════════════════════════════════════
SUPPORT & QUESTIONS
─────────────────────────────────────────────────────────────────────────────
Contact: balajisoftware2013@gmail.com
Mobile: 9832014403

═══════════════════════════════════════════════════════════════════════════════
