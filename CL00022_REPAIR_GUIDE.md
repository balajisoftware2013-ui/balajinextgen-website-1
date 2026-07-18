# CL00022 (RR Fresh and More) — Data Sync Repair Guide

## Issue Summary

**Purchases in Sheet:** 146 records × ₹1,008,304.47  
**Purchases in App (DB_JSON):** 94 records × ₹674,583.90  
**Missing:** 52 purchases × ₹333,720.57  

**Sales in Sheet:** 2 records × ₹10,900.00  
**Sales in App (DB_JSON):** 0 records × ₹0.00  
**Missing:** 2 sales × ₹10,900.00  

---

## Root Cause

### Why This Happens

1. **Frontend logs to Sheet** (correct):
   ```
   logRowToSheet('LOG_PURCHASE', {id, supp, date, total, mode, lineItems})
   → Writes row to PURCHASES tab in Google Sheet ✓
   ```

2. **But doesn't sync back to DB_JSON** (wrong):
   ```
   DB_JSON blob in APP_DATA!B1 never updated ✗
   ```

3. **App loads from cached DB_JSON** (wrong):
   ```
   localStorage.getItem('bnos_db') → old blob without new purchases
   ```

4. **Multiple browsers = multiple caches** (wrong):
   ```
   Browser A has ₹650k in localStorage
   Browser B has ₹700k in localStorage
   Sheet has ₹1.008M (the real data)
   No way to sync between browsers
   ```

### Architecture Problem

```
Current (Broken)
├─ Browser A: localStorage (₹650k cache)
├─ Browser B: localStorage (₹700k cache)
├─ Browser C: localStorage (₹600k cache)
└─ Google Sheet: PURCHASES tab (₹1.008M — source of truth, but app doesn't read it)

Result: Data inconsistency, missing records, "entries from other browser" issue
```

---

## The Fix (Already Built in v13)

### Part 1: Heal Existing Data

**File:** `Code.gs` from BALAJI_NEXTGEN_ERP_V2_CORE (v13)

**Function:** `reconcileAndSave(req)`

```javascript
function fixCL00022Now(){
  const sheetId = '1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc';
  const result = reconcileAndSave({ sheetId });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
```

**What it does:**
- Reads all 146 rows from PURCHASES tab
- Compares with DB_JSON (finds 52 missing)
- Recovers missing rows with correct totals, supplier credits, cash/bank adjustments
- Reads ITEMS_JSON column to recover inventory quantities
- Writes healed DB_JSON back to APP_DATA!B1

**Result:**
```
Before: { purchases: 94, sales: 0, purchaseTotal: 674583.90 }
After:  { purchases: 146, sales: 2, purchaseTotal: 1008304.47 }
Healed: 52 purchase rows + 2 sales rows
```

### Part 2: Prevent Future Issues

**File:** `balaji-business-os-DIRECT-SYNC.html`

**Key Changes:**
- ❌ Remove: `localStorage.getItem('bnos_db')` on startup
- ✅ Add: Direct SUITE_LOAD_DB call on every page load
- ✅ Add: Direct sync after every transaction
- ✅ Add: 5-second pull interval to stay in sync across browsers

**Architecture Change:**
```
New (Fixed)
├─ Browser A ┐
├─ Browser B ├──→ (Load from Google Sheet every time)
├─ Browser C ┘
└─ Google Sheet: PURCHASES tab (single source of truth)

Result: Instant sync, cross-browser consistency, no cache gaps
```

---

## Step-by-Step Repair Instructions

### Step 1: Deploy v13 Code.gs

**Location:** Google Apps Script project `BALAJI_NEXTGEN_ERP_V2_CORE`

**Action:** Copy the v13 Code.gs from the document provided
- Replace entire `Code.gs` file (or merge the new functions)
- Deploy as new version
- Release it as head deployment

**Verify:** Run diagnostic
```
doGet(e.parameter.action='diag')
→ Should show all sheets accessible
```

### Step 2: Run One-Time Heal Function

**In Google Apps Script Console:**
```javascript
fixCL00022Now()
```

**Expected Output (in Logger):**
```
{
  "success": true,
  "before": {
    "purchases": 94,
    "sales": 0,
    "purchaseTotal": 674583.90,
    "salesTotal": 0
  },
  "after": {
    "purchases": 146,
    "sales": 2,
    "purchaseTotal": 1008304.47,
    "salesTotal": 10900
  },
  "healedCount": 54,
  "lastSynced": 1721324400000
}
```

**Verification in Google Sheet (CL00022's Sheet):**
- Go to `APP_DATA` tab
- Cell B1 contains updated DB_JSON with all 146 purchases + 2 sales
- Timestamp in C1 updated to current time

### Step 3: Update Frontend HTML

**Replace Current File:**
- Old: `balaji-business-os.html` (uses localStorage cache)
- New: `balaji-business-os-DIRECT-SYNC.html` (direct sync)

**Upload to Netlify:**
1. Copy `balaji-business-os-DIRECT-SYNC.html` to your build folder
2. Rename to `index.html` (or deploy as current live version)
3. Push to Netlify / deploy to balajinextgen.in

**Or use as-is for testing:**
- Keep old version live temporarily
- Upload new version to a test URL to validate
- Then replace main deployment

### Step 4: Test Multi-Browser Sync

**Browser A:**
1. Login to balajinextgen.in
2. Add a new customer: "Test Customer 1"
3. Watch the sync indicator

**Browser B (different browser/device):**
1. Login to same account
2. Refresh page
3. Should see "Test Customer 1" appear within 5 seconds
4. ✓ If yes: sync is working

**Verify CL00022 Shows Healed Data:**
1. Login as CL00022
2. Go to Purchases report
3. Should show 146 purchases (was 94 before)
4. Total should be ₹1,008,304.47 (was ₹674,583.90)

### Step 5: Monitor for Errors

**In Google Sheet (CL00022):**
- Check ERROR_LOG sheet in BALAJI_ERP_MASTER_CONTROL_SYSTEM
- Look for any rows mentioning `reconcileAndSave`
- Should be minimal (just the one heal operation)

**In Browser Console:**
- Open DevTools (F12)
- Go to Console tab
- Check for any sync errors
- Should see "⟳ Syncing..." → "✓ Synced" flow every 5 seconds

---

## Data Breakdown — Before vs After

### Purchases Recovery

| Status | Record Count | Amount (₹) | Details |
|--------|----------|---------|---------|
| Before (DB_JSON) | 94 | 674,583.90 | Only synced purchases |
| Logged to Sheet | 146 | 1,008,304.47 | All purchases (including unsync'd) |
| **After Heal** | **146** | **1,008,304.47** | Recovered 52 missing rows |
| Missing Amount | 52 rows | **333,720.57** | Now recovered |

### Suppliers Affected

**Suppliers with recovered dues:**
- S391 (AKRAM MALLICK): ₹659,095.50 (recovered)
- S556 (GL Roja & Brothers): ₹24,331.00
- S428 (DILIP SINGH): ₹19,780.00
- And 19 others (total 21 suppliers)

### Sales Recovery

| Status | Record Count | Amount (₹) |
|--------|----------|---------|
| Before (DB_JSON) | 0 | 0.00 |
| Logged to Sheet | 2 | 10,900.00 |
| **After Heal** | **2** | **10,900.00** |

---

## Technical Details — What Gets Recovered

### Each Recovered Purchase Row Includes

```javascript
{
  id: "PB225",                    // Purchase ID
  supp: "S391",                   // Supplier ID
  date: "2025-12-17",             // Transaction date
  total: 1750,                    // Amount
  mode: "Credit",                 // Cash/Bank/Credit
  lineItems: [                    // ← NEW in v13 (if available)
    { id: "I522", qty: 2, rate: 1150, gst: 0 },
    { id: "I220", qty: 1.5, rate: 900, gst: 0 }
  ]
}
```

### Stock Adjustments (if ITEMS_JSON present)

For each recovered purchase:
```
For sale: item.stock -= qty  (was removed from inventory)
For purchase: item.stock += qty  (was added to inventory)
```

**Note:** Old purchases (before v13 was live) may not have ITEMS_JSON.  
→ Stock for those rows may need manual verification with physical count.

---

## Preventing Future Gaps

### Old Architecture Problem
```
App Entry → localStorage cache → logRowToSheet → PURCHASES sheet
           (never syncs back)
```

### New Architecture Solution
```
App Entry → pushTransaction() → SUITE_SAVE_DB → PURCHASES sheet
                                    ↓
                            pullRemoteUpdates() → SUITE_LOAD_DB
                                    ↓
                            DB reloaded from sheet ✓
```

### Every 5 Seconds
```
pullRemoteUpdates() fires
  ↓ (if data on server is newer than local _lastKnownSync)
  ↓ SUITE_LOAD_DB pulls fresh DB_JSON from sheet
  ↓ App re-renders with latest data
  ↓ If user was in Browser B, sees updates from Browser A
```

---

## Rollback Plan (If Needed)

If the heal causes unexpected issues:

1. **Restore old DB_JSON:**
   - Go to CL00022's sheet → Versions
   - Revert to backup before heal date/time
   - Restore APP_DATA!B1 manually

2. **Revert HTML:**
   - Replace direct-sync version with old version
   - Push to Netlify

3. **Contact Balaji Support:**
   - Phone: 9832014403
   - Email: balajisoftware2013@gmail.com

---

## FAQ

**Q: Will this delete any data?**  
A: No. `reconcileAndSave()` only ADDS missing rows to DB_JSON. It never deletes or modifies existing rows.

**Q: Will supplier dues increase?**  
A: Yes, but correctly. Recovered purchases will add their credit amounts back to supplier dues (e.g., S391 from ₹0 → ₹659,095.50).

**Q: What about cash/bank reconciliation?**  
A: Recovered purchases adjust cash/bank:
- Credit purchases: +supplier due (no cash/bank impact)
- Cash purchases: -cash balance
- Bank purchases: -bank balance

**Q: Do I need to restart the app?**  
A: After deploying v13 + running heal:
- Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
- Login again
- Will load fresh data from healed sheet

**Q: Will this break for other clients?**  
A: No. v13 is backward compatible:
- Old purchases without ITEMS_JSON still recover (totals only)
- New purchases with ITEMS_JSON recover with stock adjustments
- All clients benefit from reconcile functions

---

## File References

| File | Purpose | Location |
|------|---------|----------|
| `Code.gs` (v13) | Backend heal logic | BALAJI_NEXTGEN_ERP_V2_CORE project |
| `balaji-business-os-DIRECT-SYNC.html` | Frontend (no cache) | Deploy to balajinextgen.in |
| `reconcileAndSave(req)` | Main healing function | Code.gs |
| `fixCL00022Now()` | One-time heal trigger | Code.gs (utility) |
| CL00022 Sheet | Source of truth | Google Drive: CL00022_RR_FRESH_AND_MORE |

---

## Contact & Support

**If issues arise after repair:**
- Phone: 9832014403
- Email: balajisoftware2013@gmail.com
- WhatsApp: https://wa.me/919832014403

Include:
- Client ID (CL00022)
- Error message from Logger (if any)
- Browser console errors (if any)
- Screenshots of before/after state
