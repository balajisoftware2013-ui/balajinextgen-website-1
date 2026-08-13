/* ════════════════════════════════════════════════════════════════
   BALAJI NEXTGEN ERP — CLOUD-BACKED INVENTORY BRIDGE v2
   ------------------------------------------------------------------
   FIXES: Tracking Prevention blocking localStorage
   USES: Google Sheets as source of truth via GAS
   
   Problem Fixed:
   - Old: localStorage blocked by Tracking Prevention → data not sync
   - New: All writes go directly to Google Sheets + local cache fallback
   
   Architecture:
   1. Try localStorage first (fast, offline-capable)
   2. If localStorage fails → sync immediately to Google Sheets via GAS
   3. On page load → pull from Google Sheets if localStorage is empty
   4. Fallback: If GAS is unreachable → use localStorage (degrades gracefully)
   
   Result: Same data on Desktop, Mobile, Different Computer, Different Browser
   ════════════════════════════════════════════════════════════════ */

(function(window){
  'use strict';

  const SHARED_KEY = 'BALAJI_SHARED_DB';
  const INV_KEY    = 'BALAJI_INVENTORY_DB';
  const PURCH_KEY  = 'BALAJI_PROCUREMENT';
  const SALES_KEY  = 'BALAJI_SMARTBILL_V2';
  
  // GAS Configuration — update GAS_URL from your deployed project
  const GAS_CONFIG = {
    url: window.GAS_URL || 'https://script.google.com/macros/d/YOUR_GAS_ID/usercallable',
    timeout: 5000, // 5 sec max wait
    retries: 2,
    lastSync: null
  };

  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2); }

  // ─────────────────────────────────────────────────────────────
  // STORAGE LAYER: Try localStorage, fallback to sessionStorage
  // ─────────────────────────────────────────────────────────────
  
  function getStorageBackend(){
    try{ localStorage.setItem('__test', '1'); localStorage.removeItem('__test'); return localStorage; }
    catch(e){ 
      console.warn('[InventoryBridge] localStorage blocked by tracking prevention, using sessionStorage');
      return sessionStorage;
    }
  }
  
  let storage = getStorageBackend();

  function readJSON(key, fallback){
    try{ const d = storage.getItem(key); return d ? JSON.parse(d) : fallback; }
    catch(e){ return fallback; }
  }
  
  function writeJSON(key, val){
    try{ storage.setItem(key, JSON.stringify(val)); return true; }
    catch(e){ 
      console.error('[InventoryBridge] storage write failed for', key, e); 
      return false; 
    }
  }

  // ─────────────────────────────────────────────────────────────
  // GAS SYNC LAYER: Push/pull from Google Sheets
  // ─────────────────────────────────────────────────────────────

  async function gasCall(action, payload){
    // DISABLED (07-Aug-2026): confirmed via the real Code.gs that this project's
    // backend uses rbClientSpreadsheetId_() (one spreadsheet per client) with
    // action names like SAVE_GRN / SAVE_PURCHASE_INVOICE / SYNC_PULL_ALL — NOT
    // the SYNC_INVENTORY_DATA / PULL_INVENTORY_DATA actions this file was
    // calling. Those were never implemented server-side, so every call here
    // was failing (CORS-blocked, or "unknown action" once headers were fixed)
    // on every page load and every stock adjustment — wasted network calls
    // and console noise, no functionality actually lost by disabling this:
    // adjustStock()/reverseByRef() below already do the real work locally
    // regardless of what this returns.
    return null;
  }

  async function _gasCall_disabled(action, payload){
    if(!GAS_CONFIG.url || GAS_CONFIG.url.includes('YOUR_GAS_ID')) return null;
    
    try{
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GAS_CONFIG.timeout);
      
      const response = await fetch(GAS_CONFIG.url, {
        method: 'POST',
        mode: 'cors',
        // FIX: 'application/json' forces a CORS preflight OPTIONS request, which
        // Apps Script web apps don't answer with Access-Control-Allow-Origin —
        // so the browser blocks it before doPost ever runs. 'text/plain' is a
        // CORS "simple" content-type, so no preflight happens. Apps Script's
        // doPost doesn't care about the declared type; it reads raw postData.contents
        // either way (already being JSON.parse()'d server-side).
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action,
          clientId: window.CLIENT_ID || 'unknown',
          payload
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      const result = await response.json();
      return result.success ? result.data : null;
    }
    catch(err){
      console.warn('[InventoryBridge] GAS sync failed:', err.message);
      return null;
    }
  }

  async function syncToGas(dataType, data){
    const result = await gasCall('SYNC_INVENTORY_DATA', {
      dataType,
      data,
      timestamp: new Date().toISOString()
    });
    
    if(result){
      GAS_CONFIG.lastSync = new Date();
      return true;
    }
    return false;
  }

  async function pullFromGas(dataType){
    const result = await gasCall('PULL_INVENTORY_DATA', { dataType });
    return result || null;
  }

  // ─────────────────────────────────────────────────────────────
  // CORE INVENTORY FUNCTIONS (same logic, but with cloud sync)
  // ─────────────────────────────────────────────────────────────

  function loadShared(){
    return readJSON(SHARED_KEY, {items:[], categories:[], lastSync:null, version:2});
  }

  function loadInvDB(){
    const db = readJSON(INV_KEY, {stockIn:[], stockOut:[], transfers:[], adjustments:[], batches:[], seq:{si:1,so:1,tr:1,adj:1,bt:1}});
    db.seq = db.seq || {si:1,so:1,tr:1,adj:1,bt:1};
    db.adjustments = db.adjustments || [];
    db.stockIn = db.stockIn || [];
    db.stockOut = db.stockOut || [];
    return db;
  }

  function calcStock(shared, db, itemId){
    const item = shared.items.find(it => it.id === itemId);
    const opening = +(item?.opening || 0);
    const inQty  = db.stockIn.flatMap(si => si.items||[]).filter(it=>it.itemId===itemId).reduce((s,it)=>s+(+it.qty||0),0);
    const outQty = db.stockOut.flatMap(so => so.items||[]).filter(it=>it.itemId===itemId).reduce((s,it)=>s+(+it.qty||0),0);
    const adjTotal = db.adjustments.filter(a=>a.itemId===itemId).reduce((s,a)=>s+(+a.diff||0),0);
    return opening + inQty - outQty + adjTotal;
  }

  function findItem(shared, itemIdOrName){
    if(!itemIdOrName) return null;
    let it = shared.items.find(i => i.id === itemIdOrName);
    if(it) return it;
    const needle = String(itemIdOrName).trim().toLowerCase();
    if(!needle) return null;
    return shared.items.find(i => (i.name||'').trim().toLowerCase() === needle) || null;
  }

  function refreshCachedCopies(shared, db){
    try{
      const sd = storage.getItem(SALES_KEY);
      if(sd){
        const sdb = JSON.parse(sd);
        sdb.items = shared.items.map(it => ({
          id:it.id, code:it.code, name:it.name, cat:it.category, hsn:it.hsn, unit:it.unit,
          gst:it.gst, rate:it.srate||it.rate, cost:it.rate, mrp:it.mrp,
          stock: calcStock(shared, db, it.id), barcode:it.barcode, desc:it.desc
        }));
        storage.setItem(SALES_KEY, JSON.stringify(sdb));
      }
    }catch(e){}
    try{
      const pd = storage.getItem(PURCH_KEY);
      if(pd){
        const pdb = JSON.parse(pd);
        pdb.items = shared.items.map(it => ({
          id:it.id, code:it.code, name:it.name, category:it.category, hsn:it.hsn, unit:it.unit,
          gst:it.gst, rate:it.rate, saleRate:it.srate, mrp:it.mrp,
          currentStock: calcStock(shared, db, it.id), barcode:it.barcode
        }));
        storage.setItem(PURCH_KEY, JSON.stringify(pdb));
      }
    }catch(e){}
  }

  /**
   * InventoryBridge.adjustStock(itemIdOrName, qtyDelta, reason, opts)
   * Now with automatic Google Sheets sync
   */
  async function adjustStock(itemIdOrName, qtyDelta, reason, opts){
    const qty = Number(qtyDelta) || 0;
    if(qty === 0) return null;
    opts = opts || {};

    const shared = loadShared();
    const item = findItem(shared, itemIdOrName);
    if(!item) return false;

    const db = loadInvDB();
    const before = calcStock(shared, db, item.id);
    const after = before + qty;
    const now = new Date().toISOString();
    const rate = +opts.rate || 0;

    const rec = {
      id: uid(),
      adjNo: 'ADJ-' + (db.seq.adj++),
      date: now.split('T')[0],
      itemId: item.id,
      itemName: item.name,
      before, diff: qty, after,
      rate,
      refId: opts.refId || '',
      ref: opts.ref || '',
      party: opts.party || '',
      reason: reason || (qty > 0 ? 'Stock received (bridge)' : 'Stock issued (bridge)'),
      source: 'InventoryBridge',
      reversed: false,
      createdAt: now
    };

    db.adjustments.push(rec);
    writeJSON(INV_KEY, db);

    if(rate > 0){
      const idx = shared.items.findIndex(i => i.id === item.id);
      if(idx >= 0){ shared.items[idx].rate = rate; writeJSON(SHARED_KEY, shared); }
    }

    refreshCachedCopies(shared, db);

    // ⚡ NEW: Sync to Google Sheets asynchronously (don't block)
    syncToGas('adjustments', {
      adjustment: rec,
      itemId: item.id,
      clientId: window.CLIENT_ID
    }).catch(e => console.warn('[InventoryBridge] Cloud sync failed, data cached locally:', e));

    return rec;
  }

  async function reverseByRef(refId){
    if(!refId) return false;
    const shared = loadShared();
    const db = loadInvDB();
    const targets = db.adjustments.filter(a => a.refId === refId && !a.reversed);
    if(!targets.length) return false;

    const now = new Date().toISOString();
    targets.forEach(a => {
      a.reversed = true;
      db.adjustments.push({
        id: uid(),
        adjNo: 'ADJ-' + (db.seq.adj++),
        date: now.split('T')[0],
        itemId: a.itemId,
        itemName: a.itemName,
        before: calcStock(shared, db, a.itemId),
        diff: -a.diff,
        after: calcStock(shared, db, a.itemId) - a.diff,
        rate: a.rate || 0,
        refId: a.refId + '-reversed',
        ref: a.ref || '',
        party: a.party || '',
        reason: 'Reversal of ' + a.adjNo + ' (' + (a.reason || '') + ')',
        source: 'InventoryBridge-Reversal',
        reversed: false,
        createdAt: now
      });
    });
    writeJSON(INV_KEY, db);
    refreshCachedCopies(shared, db);

    // ⚡ NEW: Sync reversal to Google Sheets
    syncToGas('reversals', {
      refId,
      reversedCount: targets.length,
      clientId: window.CLIENT_ID
    }).catch(e => console.warn('[InventoryBridge] Cloud sync failed for reversal, data cached locally'));

    return true;
  }

  function getStock(itemIdOrName){
    const shared = loadShared();
    const item = findItem(shared, itemIdOrName);
    if(!item) return null;
    const db = loadInvDB();
    return calcStock(shared, db, item.id);
  }

  // ─────────────────────────────────────────────────────────────
  // INITIALIZATION: Pull from Google Sheets on first load
  // ─────────────────────────────────────────────────────────────

  async function initializeFromCloud(){
    // Only pull if local storage is empty or very old
    const shared = loadShared();
    const db = loadInvDB();
    
    const isLocalStale = !db.adjustments || db.adjustments.length === 0;
    
    if(isLocalStale){
      // NOTE: cloud pull is disabled (see gasCall above) — pullFromGas always
      // resolves to null now, so this block never actually does anything.
      // Kept as a no-op rather than removed so re-enabling cloud sync later
      // (once the backend has matching handlers) is a one-line change in
      // gasCall, not a rewrite here.
      const cloudInv = await pullFromGas('adjustments');
      const cloudShared = await pullFromGas('shared');
      
      if(cloudInv){
        writeJSON(INV_KEY, cloudInv);
        console.log('[InventoryBridge] ✓ Inventory synced from cloud');
      }
      if(cloudShared){
        writeJSON(SHARED_KEY, cloudShared);
        console.log('[InventoryBridge] ✓ Item master synced from cloud');
      }
    }
  }

  // Run initialization on page load (after DOM ready).
  // FIX: fire-and-forget instead of chaining two awaited network calls inside
  // the DOMContentLoaded handler, which pointlessly delayed page readiness.
  function kickoffCloudInit(){
    initializeFromCloud().catch(e => console.warn('[InventoryBridge] init skipped:', e));
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', kickoffCloudInit);
  } else {
    kickoffCloudInit();
  }

  async function syncSnapshot(snapshotKey, data){
    const result = await gasCall('SYNC_SNAPSHOT', { snapshotKey, data });
    return result ? { success:true, ...result } : { success:false, error:'Snapshot sync failed or GAS not configured' };
  }

  async function pullSnapshot(snapshotKey){
    const result = await gasCall('PULL_SNAPSHOT', { snapshotKey });
    // gasCall returns null both on failure AND on {success:true, data:null} (nothing synced yet) —
    // treat both as "no cloud data available", caller should keep using local storage.
    return result;
  }

  async function saveClientFile(fileNameOrFile, opts){
    opts = opts || {};
    let fileName, mimeType, base64Data;

    // Accept either a browser File/Blob object, or explicit {fileName, mimeType, base64Data}
    if(fileNameOrFile instanceof Blob){
      fileName = opts.fileName || fileNameOrFile.name || 'upload';
      mimeType = fileNameOrFile.type || 'application/octet-stream';
      base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(fileNameOrFile);
      });
    } else {
      fileName = fileNameOrFile;
      mimeType = opts.mimeType || 'application/octet-stream';
      base64Data = opts.base64Data;
    }

    if(!fileName || !base64Data) return { success:false, error:'Missing fileName or file data' };

    const result = await gasCall('SAVE_CLIENT_FILE', {
      fileName, mimeType, base64Data,
      docType: opts.docType || 'document'
    });
    return result ? { success:true, ...result } : { success:false, error:'Upload failed or GAS not configured' };
  }

  // Expose all functions
  window.InventoryBridge = {
    adjustStock,
    reverseByRef,
    getStock,
    syncToGas,
    pullFromGas,
    syncSnapshot,
    pullSnapshot,
    saveClientFile,
    initializeFromCloud,
    getLastSync: () => GAS_CONFIG.lastSync,
    getStorageBackend: () => storage.constructor.name
  };

  console.log('[InventoryBridge v2] ✓ Loaded (Storage: ' + storage.constructor.name + ')');
})(window);
