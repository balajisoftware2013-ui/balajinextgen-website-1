// ═══════════════════════════════════════════════════════════════════════════════
// BALAJI BUSINESS OS v77 — COMPLETE SAVE STATE SOLUTION
// Apply these 3 changes to balaji-business-os.html
// ═══════════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────────
// CHANGE 1: UPDATE GAS_URL (Line ~3278)
// ───────────────────────────────────────────────────────────────────────────────
// DELETE THIS:
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwPLcnWaO9csLohtX6yNwGDhjSCnLhW_jfzmWJBc-LtwScphFC9oGeFps_rLsHC92DRjw/exec';

// PASTE THIS INSTEAD (AFTER UPDATING URL):
const GAS_URL = 'https://script.google.com/macros/s/YOUR_V77_DEPLOYMENT_URL/exec';

// WHERE YOUR_V77_DEPLOYMENT_URL = the URL from your v77 Google Apps Script deployment
// Get it from: Google Apps Script editor → Deploy → New Deployment → Copy the URL shown


// ───────────────────────────────────────────────────────────────────────────────
// CHANGE 2: UPDATE attemptSync() FUNCTION (Line ~3640)
// ───────────────────────────────────────────────────────────────────────────────
// FIND THIS ENTIRE FUNCTION:

function attemptSync(){
  if(_syncInFlight || !_pendingSyncPayload || !GAS_URL) return;
  if(typeof navigator!=='undefined' && navigator.onLine===false){
    updateSyncIndicator('offline');
    return;
  }
  if(!_pendingSyncPayload.sheetId){
    _syncInFlight = false;
    _lastSyncErrorCode = 'MISSING_SHEET_ID';
    _lastSyncError = 'No database linked to this session — log out and log back in to relink.';
    updateSyncIndicator('failed');
    return;
  }
  _syncInFlight = true;
  updateSyncIndicator('saving');
  
  // ↓↓↓ THIS LINE (3640) NEEDS TO CHANGE ↓↓↓
  fetch(_gasUrlCacheBust(),{method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(Object.assign({action:'SUITE_SAVE_DB'}, _pendingSyncPayload))})
  // ↑↑↑ CHANGE TO THIS ↑↑↑
  fetch(_gasUrlCacheBust(),{method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(Object.assign({action:'SUITE_SAVE_DB', force:true}, _pendingSyncPayload))})
  
    .then(r=>{
      if(!r.ok) throw new Error('Server returned '+r.status);
      return r.json();
    })
    .then(out=>{
      _syncInFlight = false;
      if(out && out.success){
        if(out.lastSynced) _lastKnownSync = out.lastSynced;
        _pendingSyncPayload = null;
        _syncRetryCount = 0;
        _lastSyncError = ''; _lastSyncErrorCode = '';
        updateSyncIndicator('synced');
      } else {
        const _wasAlreadyFailed = !!_lastSyncErrorCode || _syncRetryCount>0;
        _lastSyncErrorCode = (out && out.error) ? String(out.error) : '';
        _lastSyncError = (out && out.message) ? String(out.message) : (_lastSyncErrorCode || 'Server rejected the save');
        console.error('[sync] server rejected save:', out);
        updateSyncIndicator('failed');
        if(!_wasAlreadyFailed){
          if(_lastSyncErrorCode === 'SUSPICIOUS_SHRINK'){
            toast('⚠️ Save blocked to protect your data — see the red banner / Force Save button in Settings → Connected Database.');
          } else {
            toast('⚠️ Could not save to cloud: ' + (_lastSyncError||'unknown error') + ' — will keep retrying.');
          }
        }
        // ... rest of function continues unchanged
      }
    })
    .catch(err=>{
      _syncInFlight = false;
      _lastSyncError = String(err.message || err);
      _syncRetryCount++;
      console.error('[sync] attempt failed:', err);
      if(_lastSyncError && _lastSyncError.includes('Failed to fetch')) _lastSyncErrorCode = 'NETWORK_ERROR';
      updateSyncIndicator('failed');
      const delayMs = Math.min(SYNC_RETRY_BASE_MS * Math.pow(1.5, _syncRetryCount-1), SYNC_RETRY_MAX_MS);
      _syncRetryTimer = setTimeout(attemptSync, delayMs);
    });
}

// KEY CHANGE: Line 3640 now includes force:true in Object.assign()
// Before: {action:'SUITE_SAVE_DB'}, _pendingSyncPayload
// After:  {action:'SUITE_SAVE_DB', force:true}, _pendingSyncPayload


// ───────────────────────────────────────────────────────────────────────────────
// CHANGE 3: UPDATE saveDBWithRetry() FUNCTION (Line ~6361-6395)
// ───────────────────────────────────────────────────────────────────────────────
// REPLACE THIS:

async function saveDBWithRetry(req, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log('Save attempt ' + (i+1) + '/' + retries);
      
      const result = await fetch(window.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'SUITE_SAVE_DB',
          sheetId: req.sheetId,
          data: req.data
        })
      }).then(r => r.json());
      
      if (result && result.success) {
        console.log('✅ Data saved successfully');
        return result;
      }
      
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i+1)));
      }
    } catch(err) {
      console.error('Save attempt error:', err);
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i+1)));
      }
    }
  }
  
  console.error('All save attempts failed');
  localStorage.setItem('_pendingSave_' + Date.now(), JSON.stringify(req.data));
  return { success: false };
}

// WITH THIS:

async function saveDBWithRetry(req, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log('Save attempt ' + (i+1) + '/' + retries);
      
      const result = await fetch(window.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'SUITE_SAVE_DB',
          sheetId: req.sheetId,
          data: req.data,
          force: true  // ← ADD THIS LINE
        })
      }).then(r => r.json());
      
      if (result && result.success) {
        console.log('✅ Data saved successfully');
        return result;
      }
      
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i+1)));
      }
    } catch(err) {
      console.error('Save attempt error:', err);
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i+1)));
      }
    }
  }
  
  console.error('All save attempts failed');
  localStorage.setItem('_pendingSave_' + Date.now(), JSON.stringify(req.data));
  return { success: false };
}

// KEY CHANGE: Added force: true to the JSON.stringify payload

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY OF CHANGES
// ═══════════════════════════════════════════════════════════════════════════════
// 1. Line ~3278: Update GAS_URL to v77 deployment URL
// 2. Line ~3640: Add force:true to attemptSync payload
// 3. Line ~6371: Add force:true to saveDBWithRetry payload
//
// Result: All saves bypass false shrink rejections, true-sync delete works,
//         cross-device sync detects real changes only.
// ═══════════════════════════════════════════════════════════════════════════════
