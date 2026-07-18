# Deployment Checklist — Balaji Business OS v13

## 🔴 Pre-Deployment

### Backup Current System

- [ ] **Google Apps Script Backup**
  ```
  1. Open BALAJI_NEXTGEN_ERP_V2_CORE
  2. Select all Code.gs content (Ctrl+A)
  3. Copy and save to text file as "Code.gs_BACKUP_BEFORE_v13.txt"
  4. Store in version control or drive
  ```

- [ ] **Frontend Backup**
  ```
  1. Download current balaji-business-os.html from Netlify
  2. Save as "balaji-business-os_BACKUP_OLD.html"
  3. Store in version control
  ```

- [ ] **Client Data Backup**
  ```
  1. For CL00022, export sheet as backup
  2. File → Download → Excel
  3. Name: "CL00022_BACKUP_$(date).xlsx"
  ```

### Verification Checklist

- [ ] All team members notified of upcoming deployment
- [ ] No critical operations scheduled
- [ ] Support team on standby
- [ ] Rollback plan documented
- [ ] Backup locations verified

---

## 🟡 Phase 1: Backend Deployment

### Step 1.1: Prepare Code.gs

1. **Open Google Apps Script Project**
   ```
   Project: BALAJI_NEXTGEN_ERP_V2_CORE
   File: Code.gs
   ```

2. **View Current Version**
   - Click "Project Settings"
   - Note current version number
   - Screenshot for records

3. **Clear Existing Code**
   - Select all (Ctrl+A)
   - Delete (Backspace)
   - ✓ Confirm sheet is empty

### Step 1.2: Copy v13 Code

1. **Open Code.gs from package**
   - Copy entire content
   - Make sure all functions included:
     - `doGet()` / `doPost()`
     - `registerClient()`
     - `login()`
     - `reconcileDB()`
     - `reconcileAndSave()` ← NEW v13
     - `fixCL00022Now()` ← NEW v13
     - All helper functions

2. **Paste into Apps Script**
   ```
   1. Click in Code.gs editor
   2. Paste entire content (Ctrl+V)
   3. Verify no truncation
   4. Press Ctrl+S to save
   ```

3. **Verify Syntax**
   ```
   - No red squiggly lines (errors)
   - All functions recognized
   - No warnings in editor
   ```

### Step 1.3: Deploy v13

1. **Create New Deployment**
   ```
   Click: "Deploy" → "New Deployment"
   Type: "Google Apps Script"
   Description: "Balaji Business OS v13 - Direct Sync + Data Healing"
   ```

2. **Release as Head**
   ```
   - Set as "Head" deployment (production)
   - Copy deployment URL
   - Save for testing
   ```

3. **Verify Deployment**
   - Note new version number (e.g., v123)
   - Check deployment status is "Live"
   - ✓ Backend ready

### Step 1.4: Test Backend

1. **Run Diagnostic**
   ```javascript
   // In Apps Script Console, run:
   runDiag()
   
   // Expected output:
   {
     "ok": true,
     "steps": [
       {"step": "open USER_SECURITY_MASTER_DB", "ok": true},
       {"step": "open CLIENT_MASTER tab", "ok": true},
       {"step": "open BALAJI_ERP_MASTER_CONTROL_SYSTEM", "ok": true},
       ...all "ok": true
     ]
   }
   ```

2. **Check Connections**
   - [ ] USER_SECURITY_MASTER_DB accessible ✓
   - [ ] CLIENT_MASTER sheet accessible ✓
   - [ ] BALAJI_ERP_MASTER_CONTROL_SYSTEM accessible ✓
   - [ ] Template files accessible ✓
   - [ ] Client folders accessible ✓

3. **Record Results**
   ```
   Deployment ID: [___________________________]
   Version: [_____]
   Timestamp: [_____________________________]
   Status: [ ] PASS [ ] FAIL
   ```

**⏱️ Time: ~5 minutes**  
**✓ Phase 1 Complete**

---

## 🟡 Phase 2: Data Healing (CL00022 Only)

### Step 2.1: Prepare for Healing

1. **Verify Sheet Exists**
   ```
   Sheet ID: 1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc
   Name: CL00022_RR_FRESH_AND_MORE
   Status: [ ] Accessible [ ] Not found
   ```

2. **Check Current Data**
   ```
   In Google Sheet:
   - PURCHASES tab: 146 rows (should show data)
   - SALES tab: 4 rows (should show data)
   - APP_DATA tab: Cell B1 has JSON blob
   
   Note current values:
   Purchases in DB: [_____] (expect ~94)
   Sales in DB: [_____] (expect 0)
   ```

### Step 2.2: Run Heal Function

1. **Open Apps Script Console**
   ```
   BALAJI_NEXTGEN_ERP_V2_CORE project
   Menu: View → Logs (or press Ctrl+Enter after running)
   ```

2. **Run Healing Function**
   ```javascript
   fixCL00022Now()
   ```

3. **Monitor Execution**
   - Watch console for output
   - Should complete in <5 seconds
   - Check Logger for result

4. **Verify Result in Logger**
   ```javascript
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
     "lastSynced": [timestamp]
   }
   ```

### Step 2.3: Verify Data in Sheet

1. **Check APP_DATA Tab**
   ```
   1. Open CL00022 sheet
   2. Go to APP_DATA tab
   3. Cell A1: Should be "DB_JSON"
   4. Cell B1: Should have JSON with 146 purchases + 2 sales
   5. Cell C1: Should have current timestamp
   ```

2. **Verify JSON Content**
   ```javascript
   // Copy cell B1 content, paste in JSON validator
   {
     "purchases": [
       // Should have 146 items now (was 94)
     ],
     "sales": [
       // Should have 2 items now (was 0)
     ],
     "cash": [number],
     "bank": [number],
     ...
   }
   ```

3. **Check Supplier Dues**
   ```
   In SUPPLIERS tab:
   - S391: ₹659,095.50 (was ₹0)
   - S556: ₹24,331.00
   - S428: ₹19,780.00
   Status: [ ] Restored [ ] Not updated
   ```

4. **Record Results**
   ```
   Healing Status: [ ] SUCCESS [ ] FAILED
   Purchases before: 94 → after: 146 ✓
   Sales before: 0 → after: 2 ✓
   Amount recovered: ₹344,620.57 ✓
   Timestamp: [_______________________]
   ```

**⏱️ Time: ~2 minutes**  
**✓ Phase 2 Complete**

---

## 🟡 Phase 3: Frontend Deployment

### Step 3.1: Prepare New Frontend

1. **Get New HTML File**
   - [ ] Have `balaji-business-os-DIRECT-SYNC.html` ready
   - [ ] Verify file is complete (not truncated)
   - [ ] File size should be ~700KB

2. **Verify Content**
   ```
   - Contains "DIRECT GOOGLE SHEET SYNC" header ✓
   - Has pullRemoteUpdates() function ✓
   - Has pushTransaction() function ✓
   - Uses callGAS() for all backend calls ✓
   - No localStorage.getItem('bnos_db') at startup ✓
   ```

### Step 3.2: Deploy to Netlify

**Option A: Via Netlify UI**

1. **Login to Netlify**
   ```
   Dashboard: https://app.netlify.com
   Site: balajinextgen.in
   ```

2. **Upload New File**
   ```
   Method 1: Drag & Drop
   - Drag balaji-business-os-DIRECT-SYNC.html onto deploy area
   - Or rename to index.html first
   
   Method 2: Manual Upload
   1. Click "Deploy" button
   2. Select file browser
   3. Choose HTML file
   4. Wait for upload (100% complete)
   ```

3. **Verify Deployment**
   ```
   - Status shows "Published"
   - URL is live
   - Build completed successfully
   - [ ] Deployment successful
   ```

4. **Record Deployment**
   ```
   Deploy ID: [_________________________]
   Timestamp: [_________________________]
   URL: balajinextgen.in
   Status: [ ] LIVE [ ] PENDING
   ```

**Option B: Via Git/CLI**

```bash
# If using Git-based deployment
1. Clone repo locally
2. Replace balaji-business-os.html with new file
3. Rename to index.html (if needed)
4. Commit: git add -A && git commit -m "Deploy v13 Direct-Sync"
5. Push: git push origin main
6. Netlify auto-deploys
7. Check status: https://app.netlify.com/sites/[site-name]/deploys
```

### Step 3.3: Post-Deployment Verification

1. **Check File is Deployed**
   ```
   1. Open balajinextgen.in in browser
   2. Open DevTools (F12)
   3. Go to Sources tab
   4. Should show balaji-business-os-DIRECT-SYNC.html (or index.html)
   5. Search for "callGAS" in source
   6. Should find function definition ✓
   ```

2. **Verify GAS URL**
   ```javascript
   // In browser console (F12 → Console):
   console.log(GAS_URL)
   
   // Should output:
   // "https://script.google.com/macros/s/AKfycbweBrJ9QH9ItEE_5t2hzwASZPblf0m6NHSr6vxr5s4w-dcj2bUdQFANnyUcXuxSK4YK/exec"
   ```

3. **Check Version String**
   ```javascript
   // In browser console:
   document.documentElement.innerHTML.includes("DIRECT")
   
   // Should output: true
   ```

**⏱️ Time: ~3 minutes**  
**✓ Phase 3 Complete**

---

## 🟢 Phase 4: Testing & Verification

### Step 4.1: Smoke Test (Basic Functionality)

1. **Login Test**
   ```
   1. Open balajinextgen.in
   2. Enter CL00022 login credentials
   3. Should see login form
   4. Enter mobile & password
   5. Should log in successfully
   6. [ ] Dashboard loads ✓
   ```

2. **Dashboard Verification**
   ```
   1. After login, check dashboard
   2. Should show:
      - 985 Customers ✓
      - 21 Suppliers ✓
      - 36 Items ✓
      - 146 Purchases ✓ (was 94)
      - 2 Sales ✓ (was 0)
   3. Sync indicator should show green checkmark ✓
   ```

3. **Record Results**
   ```
   Login: [ ] SUCCESS [ ] FAILED
   Dashboard Load: [ ] SUCCESS [ ] FAILED
   Data Counts: [ ] CORRECT [ ] INCORRECT
   ```

### Step 4.2: Sync Test (5-Second Auto-Sync)

1. **Single Browser Test**
   ```
   1. Logged in as CL00022
   2. Go to Customers section
   3. Add new customer: "Test Sync Customer"
   4. Click Save
   5. Watch sync indicator → should show "⟳ Syncing..."
   6. Wait 2 seconds → should show "✓ Synced"
   7. [ ] Customer saved ✓
   ```

2. **Verify in Sheet**
   ```
   1. Open CL00022 Google Sheet
   2. Go to CUSTOMERS tab
   3. Last row should have "Test Sync Customer"
   4. [ ] Entry in sheet ✓
   ```

3. **Refresh & Verify**
   ```
   1. Hard refresh browser (Ctrl+Shift+R)
   2. Customer should still be there
   3. [ ] Data persisted ✓
   ```

### Step 4.3: Cross-Browser Sync Test

1. **Setup Two Browsers**
   ```
   Browser A: balajinextgen.in (logged in as CL00022)
   Browser B: balajinextgen.in (logged in as CL00022)
   Position side-by-side for easy observation
   ```

2. **Create Sync Scenario**
   ```
   Browser A:
   1. Add customer: "Browser A Customer"
   2. Click Save
   3. Watch sync indicator
   
   Browser B:
   1. Watch for new customer to appear
   2. Should see within 5 seconds
   3. Time how long: [___] seconds
   ```

3. **Verify Bidirectional**
   ```
   Browser B:
   1. Add customer: "Browser B Customer"
   2. Click Save
   
   Browser A:
   1. Should see new customer appear
   2. Within 5 seconds [ ] SUCCESS [ ] FAILED
   ```

4. **Record Results**
   ```
   Cross-browser sync: [ ] WORKING [ ] FAILED
   Average sync time: [___] seconds (should be <5)
   Data consistency: [ ] VERIFIED [ ] ISSUES
   ```

### Step 4.4: Data Integrity Test

1. **Check CL00022 Purchase Count**
   ```
   1. Go to Reports → Purchases
   2. Count should be 146 (not 94)
   3. Total should be ₹1,008,304.47
   4. [ ] Numbers correct ✓
   ```

2. **Verify Supplier Dues**
   ```
   1. Go to Parties → Suppliers
   2. Check top 3 suppliers:
      - S391: ₹659,095.50
      - S556: ₹24,331.00
      - S428: ₹19,780.00
   3. [ ] All correct ✓
   ```

3. **Check Sales Records**
   ```
   1. Go to Reports → Sales
   2. Should show 2 sales invoices
   3. Total: ₹10,900.00
   4. [ ] Correct ✓
   ```

### Step 4.5: Error Handling Test

1. **Network Offline**
   ```
   1. Open DevTools (F12)
   2. Network tab → Offline
   3. Try to save something
   4. Should show error message
   5. Message should be user-friendly
   6. [ ] Error handling works ✓
   ```

2. **Invalid Login**
   ```
   1. Clear cookies (Ctrl+Shift+Delete)
   2. Reload page
   3. Enter wrong password
   4. Should show error
   5. [ ] Error clear ✓
   ```

3. **Recovery**
   ```
   1. Turn internet back on
   2. App should recover
   3. [ ] Recovers automatically [ ] Needs refresh
   ```

**⏱️ Time: ~10 minutes**  
**✓ Phase 4 Complete**

---

## 🟢 Phase 5: Monitoring & Sign-Off

### Step 5.1: Monitor First Hour

1. **Watch for Errors**
   ```
   - Check browser console every 5 min
   - Check Apps Script logs every 5 min
   - Look for any unexpected behavior
   - [ ] No critical errors ✓
   ```

2. **Monitor Performance**
   ```
   - App should feel snappy
   - Sync should be quick (<5 sec)
   - No noticeable lag
   - [ ] Performance acceptable ✓
   ```

3. **Check User Reports**
   ```
   - Any issues reported by users
   - Monitor support channel
   - Status: [ ] No issues [ ] Minor issues [ ] Major issues
   ```

### Step 5.2: Document Changes

```
Deployment Summary
══════════════════════════════════════════
Date: [_______________________________]
Time: [_______________________________]
Deployed By: [_______________________________]

Changes Made:
✓ Backend: Code.gs v13 deployed
✓ Frontend: Direct-sync HTML deployed
✓ Data: CL00022 healed (52 purchases recovered)

Verification Results:
✓ Diagnostic test: PASS
✓ Heal function: SUCCESS (54 rows recovered)
✓ Frontend deployed: LIVE
✓ Login test: PASS
✓ Sync test: PASS
✓ Cross-browser: PASS
✓ Data integrity: PASS

Status: [ ] APPROVED FOR PRODUCTION [ ] ROLLBACK
```

### Step 5.3: Sign-Off

```
Deployment Manager: [_________________] Date: [______]
QA Lead: [_________________] Date: [______]
Support Lead: [_________________] Date: [______]

All checks passed: [ ] YES [ ] NO
Ready for full production: [ ] YES [ ] NO
```

---

## 🔴 Rollback Plan (If Needed)

### Step R.1: Immediate Rollback

```
If critical issues detected:

1. Revert Backend:
   - Open BALAJI_NEXTGEN_ERP_V2_CORE
   - Click version history
   - Select previous version
   - Click "Release"
   - [ ] Backend reverted

2. Revert Frontend:
   - In Netlify, go to Deploys
   - Select previous successful deploy
   - Click "Restore"
   - [ ] Frontend reverted

3. Notify Users:
   - Post in support channel
   - Explain issue and restoration
   - [ ] Communication sent
```

### Step R.2: Data Verification After Rollback

```
1. Check if data needs recovery:
   - If heal was run, data still exists in sheet
   - Can re-run heal after redeploy
   - [ ] No data loss

2. Clear caches:
   - Users: Ctrl+Shift+Delete (clear cache)
   - Server: Purge cache in Netlify
   - [ ] Cache cleared

3. Test after rollback:
   - [ ] System functional
   - [ ] No errors
   - [ ] Data intact
```

### Step R.3: Investigation & Retry

```
Root Cause: [_________________________________]
Fix Applied: [_________________________________]
Retry Date: [_________________________________]
Retry Approved By: [_________________________________]
```

---

## ✅ Final Checklist

### Go-Live Confirmation

- [ ] Phase 1 (Backend): COMPLETE
- [ ] Phase 2 (Data Heal): COMPLETE
- [ ] Phase 3 (Frontend): COMPLETE
- [ ] Phase 4 (Testing): ALL TESTS PASS
- [ ] Phase 5 (Monitoring): NO CRITICAL ISSUES
- [ ] Rollback Plan: DOCUMENTED & READY

### User Communication

- [ ] Support team briefed
- [ ] Users notified of changes (if applicable)
- [ ] FAQ prepared (see MIGRATION_GUIDE.md)
- [ ] Support hotline active

### Documentation

- [ ] Deployment logged
- [ ] Changes documented
- [ ] Sign-off recorded
- [ ] Runbooks updated

### Success Criteria

✅ CL00022 shows 146 purchases (not 94)  
✅ CL00022 shows 2 sales (not 0)  
✅ Cross-browser sync works (<5 sec)  
✅ All tests pass  
✅ No critical errors  
✅ Users can work normally  

---

**🎉 Deployment Complete!**

**Next Step:** Monitor for 24 hours, then review for stability.

**Questions?** See CL00022_REPAIR_GUIDE.md or contact support.
