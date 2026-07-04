/* ════════════════════════════════════════════════════════════════
   BALAJI NEXTGEN ERP — INVENTORY BRIDGE
   ------------------------------------------------------------------
   Purchase and Sales already call InventoryBridge.adjustStock(...)
   whenever stock physically moves (GRN accepted qty, POS/Invoice
   sale qty) — but this file did not exist, so `typeof InventoryBridge
   !== 'undefined'` was always false and every one of those calls was
   silently skipped. Stock only ever appeared correct if someone
   happened to open the Inventory module itself and its own one-way
   pull-sync ran.

   This file is the real, always-on fix: it writes directly into the
   SAME localStorage keys the Inventory module reads (BALAJI_SHARED_DB
   for the item master, BALAJI_INVENTORY_DB for stock movements), so
   a purchase GRN or a sales bill updates real stock immediately —
   whether or not the Inventory module tab is even open.

   Must be loaded on every page that needs it (already wired up via
   <script src="../inventory/inventory-bridge.js">).
   ════════════════════════════════════════════════════════════════ */
(function(window){
  'use strict';

  const SHARED_KEY = 'BALAJI_SHARED_DB';
  const INV_KEY    = 'BALAJI_INVENTORY_DB';
  const PURCH_KEY  = 'BALAJI_PROCUREMENT';
  const SALES_KEY  = 'BALAJI_SMARTBILL_V2';

  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2); }

  function readJSON(key, fallback){
    try{ const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; }
    catch(e){ return fallback; }
  }
  function writeJSON(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch(e){ console.error('[InventoryBridge] storage write failed for', key, e); return false; }
  }

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

  // Same formula the Inventory module uses (calcStock) so "before" always matches reality.
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

  /* After changing stock we also refresh the cached item lists that Purchase
     and Sales each keep for their own item-selector dropdowns (the same
     fields the Inventory module's syncNow() pushes) — so the module the
     call originated from sees the correct number right away, without
     needing anyone to open the Inventory module to trigger a refresh. */
  function refreshCachedCopies(shared, db){
    try{
      const sd = localStorage.getItem(SALES_KEY);
      if(sd){
        const sdb = JSON.parse(sd);
        sdb.items = shared.items.map(it => ({
          id:it.id, code:it.code, name:it.name, cat:it.category, hsn:it.hsn, unit:it.unit,
          gst:it.gst, rate:it.srate||it.rate, cost:it.rate, mrp:it.mrp,
          stock: calcStock(shared, db, it.id), barcode:it.barcode, desc:it.desc
        }));
        localStorage.setItem(SALES_KEY, JSON.stringify(sdb));
      }
    }catch(e){}
    try{
      const pd = localStorage.getItem(PURCH_KEY);
      if(pd){
        const pdb = JSON.parse(pd);
        pdb.items = shared.items.map(it => ({
          id:it.id, code:it.code, name:it.name, category:it.category, hsn:it.hsn, unit:it.unit,
          gst:it.gst, rate:it.rate, saleRate:it.srate, mrp:it.mrp,
          currentStock: calcStock(shared, db, it.id), barcode:it.barcode
        }));
        localStorage.setItem(PURCH_KEY, JSON.stringify(pdb));
      }
    }catch(e){}
  }

  /**
   * InventoryBridge.adjustStock(itemIdOrName, qtyDelta, reason)
   * qtyDelta: positive for goods received (GRN), negative for goods sold.
   * Returns: the adjustment record on success, or false if the item
   * isn't in the shared item master (caller should warn the user).
   */
  function adjustStock(itemIdOrName, qtyDelta, reason){
    const qty = Number(qtyDelta) || 0;
    if(qty === 0) return null;

    const shared = loadShared();
    const item = findItem(shared, itemIdOrName);
    if(!item) return false;

    const db = loadInvDB();
    const before = calcStock(shared, db, item.id);
    const after = before + qty;
    const now = new Date().toISOString();

    const rec = {
      id: uid(),
      adjNo: 'ADJ-' + (db.seq.adj++),
      date: now.split('T')[0],
      itemId: item.id,
      itemName: item.name,
      before, diff: qty, after,
      reason: reason || (qty > 0 ? 'Stock received (bridge)' : 'Stock issued (bridge)'),
      source: 'InventoryBridge',
      createdAt: now
    };
    db.adjustments.push(rec);
    writeJSON(INV_KEY, db);

    refreshCachedCopies(shared, db);

    return rec;
  }

  /** Read-only helper other pages can use to show live stock without duplicating the formula. */
  function getStock(itemIdOrName){
    const shared = loadShared();
    const item = findItem(shared, itemIdOrName);
    if(!item) return null;
    const db = loadInvDB();
    return calcStock(shared, db, item.id);
  }

  window.InventoryBridge = { adjustStock, getStock };
})(window);
