/**
 * BALAJI BUSINESS OS — SYNC CONFLICT RESOLUTION FIX
 * 
 * Problem: When device has fewer records than cloud, backend blocks save with
 * SUSPICIOUS_SHRINK error. User sees error but has no clear way to resolve.
 * 
 * Solution: 
 * 1. Enhance sync error display to detect shrink conflicts
 * 2. Add "Resolve" button that takes user to Settings → Reconcile
 * 3. Add optional force-save mechanism with safety confirmation
 * 4. Improve error messaging
 * 
 * Changes to add to the Business OS HTML:
 */

// ═══════════════════════════════════════════════════════════════════════════
// PART 1: Enhance updateSyncIndicator to detect and handle shrink conflicts
// ═══════════════════════════════════════════════════════════════════════════

// REPLACE the existing updateSyncIndicator function (around line 2994) with:

function updateSyncIndicator(state){
  const el = document.getElementById('syncIndicator');
  if(!el) return;
  clearTimeout(el._hideTimer);
  el.onclick = null; el.style.cursor = 'default'; el.title = '';
  
  if(state==='saving'){
    el.textContent='☁️ Saving…'; 
    el.style.color='#999'; 
    el.style.display='inline';
  }
  else if(state==='synced'){
    el.textContent='✅ Synced'; 
    el.style.color='#0a7d34'; 
    el.style.display='inline';
    el._hideTimer = setTimeout(()=>{ el.style.display='none'; }, 2500);
  } 
  else if(state==='offline'){
    el.textContent='📴 Offline — will sync when back online'; 
    el.style.color='#999'; 
    el.style.display='inline';
  } 
  else if(state==='failed'){
    const isShrinkConflict = _lastSyncError && _lastSyncError.includes('would erase');
    const reason = _lastSyncError ? ` — ${_lastSyncError}` : '';
    
    // For shrink conflicts, show a more specific message with resolve option
    if(isShrinkConflict){
      el.innerHTML = `<span style="cursor:pointer;">⚠️ Sync conflict — device has fewer records than cloud. Tap to resolve</span>`;
      el.style.color='#c00'; 
      el.style.display='inline'; 
      el.style.cursor='pointer';
      el.title = 'Tap to open Settings → Reconcile to resolve this conflict';
      el.onclick = ()=>{ openSyncConflictResolver(); };
    } else {
      // Standard error display
      el.textContent = _syncRetryCount>2
        ? `⚠️ Not synced (${_syncRetryCount} tries)${reason} — tap to retry`
        : `⚠️ Not synced yet${reason} — retrying…`;
      el.title = 'Last error: ' + (_lastSyncError || 'unknown');
      el.style.color='#c00'; 
      el.style.display='inline'; 
      el.style.cursor='pointer';
      el.onclick = ()=>{ clearTimeout(_syncRetryTimer); attemptSync(); };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 2: New function to open conflict resolver (Settings → Reconcile)
// ═══════════════════════════════════════════════════════════════════════════

function openSyncConflictResolver(){
  // Navigate to Settings page
  switchPage('settings');
  
  // After a brief moment, switch to Reconcile tab
  setTimeout(()=>{
    if(document.getElementById('stgTabReconcile')){
      document.getElementById('stgTabReconcile').click();
    }
    toast('👇 Run the Reconcile Check below to find missing data, then Apply Fix to sync it all.');
  }, 300);
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 3: Add force-save option to reconcile UI
// ═══════════════════════════════════════════════════════════════════════════

// In the Settings → 🧮 Reconcile panel, ADD this new button below the 
// existing "Apply Fix" button (around line 2577):

/*
<button class="btn btn-secondary" id="forceSaveBtn" style="width:100%;margin-top:10px;display:none;" onclick="showForceSaveWarning()">
  ⚡ Force Save (Override Protection)
</button>
*/

// Add these functions to handle force-save:

function showForceSaveWarning(){
  const msg = `⚠️  FORCE SAVE OVERRIDE
  
This will bypass the shrink protection and save your local data to the cloud, even though it has fewer records than what's already saved. 

Use this ONLY if:
✓ You intentionally deleted old purchases/sales
✓ You're sure the cloud has stale/duplicate data
✓ You've already backed up important data

If you're unsure, tap "Cancel" and use "Apply Fix (Reconcile & Save)" instead — it's safer and adds missing data without removing anything.

Continue?`;

  if(confirm(msg)){
    attemptForceSave();
  }
}

function attemptForceSave(){
  if(!(SESSION && !SESSION.isDemo && SESSION.sheetId && GAS_URL)){
    toast('Force Save needs a connected account.');
    return;
  }
  
  const btn = document.getElementById('forceSaveBtn');
  const resultEl = document.getElementById('reconcileResult');
  
  if(btn){ btn.disabled = true; btn.textContent = '⚡ Forcing save…'; }
  if(resultEl){ resultEl.style.display = 'block'; resultEl.innerHTML = '⏳ Sending override…'; }
  
  _syncInFlight = true;
  updateSyncIndicator('saving');
  
  fetch(GAS_URL,{
    method:'POST',
    headers:{'Content-Type':'text/plain'},
    body:JSON.stringify(Object.assign({action:'SUITE_SAVE_DB', forceSave:true}, {
      clientId:SESSION.clientId, 
      sheetId:SESSION.sheetId, 
      data:DB
    }))
  })
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
        _lastSyncError = '';
        localStorage.removeItem('bnos_pending_sync');
        updateSyncIndicator('synced');
        if(resultEl){
          resultEl.innerHTML = '✅ Force save completed. Your data has been saved to the cloud (shrink protection bypassed). Reloading…';
        }
        setTimeout(()=>{ location.reload(); }, 1500);
      } else {
        throw new Error(out && (out.error || out.message) ? out.error || out.message : 'Force save failed');
      }
    })
    .catch(err=>{
      _syncInFlight = false;
      _lastSyncError = err && err.message ? err.message : 'Network error';
      updateSyncIndicator('failed');
      if(resultEl){
        resultEl.innerHTML = '❌ Force save failed: '+(err.message||err);
      }
    })
    .finally(()=>{
      if(btn){ btn.disabled = false; btn.textContent = '⚡ Force Save (Override Protection)'; }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 4: Make reconcile tab show force-save button when appropriate
// ═══════════════════════════════════════════════════════════════════════════

// Modify the runReconcileCheck function to also show Force Save option
// APPEND this to the existing runReconcileCheck (around line 3126):

/*
    if(fixBtn) fixBtn.style.display = gaps > 0 ? 'block' : 'none';
    
    // Also show force-save option if there were gaps or if last sync error was shrink
    const forceSaveBtn = document.getElementById('forceSaveBtn');
    if(forceSaveBtn){
      const hasShrinkError = _lastSyncError && _lastSyncError.includes('would erase');
      forceSaveBtn.style.display = (gaps > 0 || hasShrinkError) ? 'block' : 'none';
    }
*/
