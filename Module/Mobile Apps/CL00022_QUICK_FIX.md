# CL00022 Quick Fix — Exact Steps

## The Problem (in 10 seconds)

**Sheet has:** 146 purchases + 2 sales  
**App shows:** 94 purchases + 0 sales  
**Missing:** 52 purchases + 2 sales = ₹344,620.57

**Why:** App loads from old localStorage cache, not from Google Sheet.

---

## The Fix (3 steps, 5 minutes)

### Step 1: Deploy v13 Code.gs

**In BALAJI_NEXTGEN_ERP_V2_CORE Google Apps Script:**

1. Open the project
2. Replace entire `Code.gs` with v13 version (provided document)
3. Click "Deploy" → "New deployment"
4. Deploy as "new version"

### Step 2: Run Heal Function (One Time Only)

**In Apps Script Console:**

```javascript
fixCL00022Now()
```

**Expected output (in Logger):**
```
{
  "success": true,
  "before": { "purchases": 94, "sales": 0 },
  "after": { "purchases": 146, "sales": 2 },
  "healedCount": 54
}
```

✓ **Done.** CL00022's data is now healed.

### Step 3: Replace Frontend HTML (Prevents Future Issues)

**Replace `balaji-business-os.html` with `balaji-business-os-DIRECT-SYNC.html`**

1. Download: `balaji-business-os-DIRECT-SYNC.html`
2. Upload to Netlify (replace current)
3. Deploy to balajinextgen.in

✓ **Done.** Future entries will sync correctly across all browsers.

---

## Verify It Worked

**In CL00022's Google Sheet:**

1. Open sheet: https://docs.google.com/spreadsheets/d/1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc
2. Go to tab: `APP_DATA`
3. Cell B1 contains JSON with purchases/sales
4. Check cell C1 has recent timestamp ← means heal ran

**In Business OS App:**

1. Login as CL00022
2. Go to Reports → Purchases
3. Should show **146 purchases** (was 94)
4. Total should be **₹1,008,304.47** (was ₹674,583.90)
5. ✓ Verify supplier dues are correct

---

## Data Recovered

### Purchases
- **Records recovered:** 52 purchase bills
- **Amount recovered:** ₹333,720.57
- **Before:** 94 purchases × ₹674,583.90
- **After:** 146 purchases × ₹1,008,304.47

### Sales
- **Records recovered:** 2 sale invoices
- **Amount recovered:** ₹10,900.00
- **Before:** 0 sales × ₹0.00
- **After:** 2 sales × ₹10,900.00

### Suppliers Affected (Credit Dues Restored)
- S391 (AKRAM MALLICK): ₹659,095.50
- S556 (GL Roja & Brothers): ₹24,331.00
- S428 (DILIP SINGH): ₹19,780.00
- Plus 18 other suppliers

---

## After Deploy — What Changes

### Old Behavior (Broken)
```
Browser A: enters purchase → localStorage cache updated
Browser B: sees old cache (doesn't see Browser A's purchase)
Sheet: has the purchase ✓
App: doesn't read it back from sheet ✗
Result: Data mismatch across browsers
```

### New Behavior (Fixed)
```
Browser A: enters purchase → calls SUITE_SAVE_DB → Sheet updated ✓
         → immediately calls SUITE_LOAD_DB → pulls latest data
Browser B: auto-pull every 5 seconds → sees purchase from Browser A ✓
Sheet: is the only source of truth
App: always synced to latest
Result: Cross-browser consistency ✓
```

---

## If Something Goes Wrong

**Error in Logger when running `fixCL00022Now()`?**
- Check sheet ID is correct: `1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc`
- Run diagnostic: `runDiag()` → should show all sheets accessible

**Data looks wrong after fix?**
- Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Logout and login again
- Clear localStorage: `localStorage.clear()` in console

**Still have gaps?**
- Check PURCHASES tab has entries
- Check APP_DATA tab has valid JSON in B1
- Contact: 9832014403 or balajisoftware2013@gmail.com

---

## File Locations

**v13 Code.gs** (provided earlier)
```
Project: BALAJI_NEXTGEN_ERP_V2_CORE
File: Code.gs
Action: Replace entire file content
```

**Direct-Sync HTML** (provided earlier)
```
File: balaji-business-os-DIRECT-SYNC.html
Deploy: balajinextgen.in
Replaces: old balaji-business-os.html
```

**CL00022 Sheet**
```
URL: https://docs.google.com/spreadsheets/d/1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc/edit
Tabs to check: PURCHASES, SALES, APP_DATA
```

---

## Timeline

| Action | Time | Result |
|--------|------|--------|
| Deploy v13 Code.gs | 1 min | Backend ready |
| Run `fixCL00022Now()` | 30 sec | Data healed |
| Replace HTML | 2 min | Upload to Netlify |
| Test in app | 1 min | Verify 146 purchases |
| **Total** | **~5 min** | ✓ Fixed |

---

**Status After Fix:** ✓ All data recovered, all browsers synced, future issues prevented.
