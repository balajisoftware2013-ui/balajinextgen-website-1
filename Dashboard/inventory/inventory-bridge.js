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
   * InventoryBridge.adjustStock(itemIdOrName, qtyDelta, reason, opts)
   * qtyDelta: positive for goods received (GRN), negative for goods sold.
   * opts (optional): { refId, rate, party, ref }
   *   - refId: links this movement back to its source record (a GRN line, a
   *     sales invoice line, etc.) so reverseByRef() can undo exactly this
   *     movement later without guessing or double-reversing.
   *   - rate: the real per-unit cost for this movement. Previously dropped
   *     entirely — every GRN-driven adjustment recorded rate 0, which is
   *     why Stock Ledger / Stock Value always showed ₹0.00 regardless of
   *     the actual purchase price. Now stored on the record AND written
   *     back onto the item master's own `rate` field (last-known cost),
   *     so Item Master, Stock Ledger and Stock Value all agree.
   *   - party: vendor/customer name, for display in Stock Ledger.
   * Returns: the adjustment record on success, or false if the item
   * isn't in the shared item master (caller should warn the user).
   */
  function adjustStock(itemIdOrName, qtyDelta, reason, opts){
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

    // Keep the item master's cost current — last GRN rate wins, same as
    // the Purchase module's own "lastRate" tracking on its item cache.
    if(rate > 0){
      const idx = shared.items.findIndex(i => i.id === item.id);
      if(idx >= 0){ shared.items[idx].rate = rate; writeJSON(SHARED_KEY, shared); }
    }

    refreshCachedCopies(shared, db);

    return rec;
  }

  /**
   * InventoryBridge.reverseByRef(refId)
   * Undoes the stock effect of every unreversed adjustment tagged with this
   * refId (e.g. all movements from one GRN), by pushing an equal-and-opposite
   * adjustment for each and marking the originals reversed so a second
   * delete/edit on the same GRN can't reverse it twice.
   * Returns true if anything was found and reversed, false otherwise (caller
   * should fall back to a manual adjustStock() reversal in that case).
   */
  function reverseByRef(refId){
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
    return true;
  }

  /** Read-only helper other pages can use to show live stock without duplicating the formula. */
  function getStock(itemIdOrName){
    const shared = loadShared();
    const item = findItem(shared, itemIdOrName);
    if(!item) return null;
    const db = loadInvDB();
    return calcStock(shared, db, item.id);
  }

  window.InventoryBridge = { adjustStock, reverseByRef, getStock };
})(window);
