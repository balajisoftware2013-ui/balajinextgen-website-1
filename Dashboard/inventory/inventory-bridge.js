/* ============================================================
   BALAJI NEXTGEN ERP — inventory-bridge.js  v1.0
   Universal connector for all inventory, sales & purchase modules.

   WHAT THIS FILE DOES:
   ─────────────────────────────────────────────────────────────
   Every module uses its OWN localStorage key and its own DB
   object. They never share data by default. This bridge sits
   in the middle and syncs them all.

   STORAGE KEY MAP (what each module reads/writes):
   ┌─────────────────────────────┬──────────────────────────────┐
   │ Module file                 │ localStorage key             │
   ├─────────────────────────────┼──────────────────────────────┤
   │ inventory-module.html       │ BALAJI_SHARED_DB   ← MASTER  │
   │                             │ BALAJI_INVENTORY_DB          │
   │ sales-module.html           │ BALAJI_SMARTBILL_V2          │
   │ purchase-module.html        │ BALAJI_PROCUREMENT           │
   │ BalajiERP_General_inv.html  │ balaji_erp_v3                │
   │ Restrostock_pro_inventory   │ restrostock_v1               │
   │ inventory.html (v10)        │ BNJERP_* (GAS-synced)        │
   └─────────────────────────────┴──────────────────────────────┘

   SINGLE SOURCE OF TRUTH: BALAJI_SHARED_DB (items master)
   ─────────────────────────────────────────────────────────────
   The item master lives in BALAJI_SHARED_DB.items[].
   All other modules read from it — they never keep their
   own separate product list.

   HOW TO USE:
   ─────────────────────────────────────────────────────────────
   1. Add to EVERY HTML page head, BEFORE any module script:
      <script src="../inventory-bridge.js"></script>

   2. The bridge auto-runs on DOMContentLoaded.

   3. Call manually when needed:
      InventoryBridge.sync()          // full sync all modules
      InventoryBridge.getItems()      // all items from master
      InventoryBridge.getStock(id)    // current qty for one item
      InventoryBridge.stockAlert()    // returns low/out items
      InventoryBridge.gasSync()       // push to GAS backend

   RESTAURANT vs GENERAL INDUSTRY:
   ─────────────────────────────────────────────────────────────
   RestroStock (restrostock_v1) → uses 'ingredients' array
   General Inventory (balaji_erp_v3) → uses 'products' array
   Both are mapped to BALAJI_SHARED_DB.items[]

   The bridge detects which file is open by checking
   window.location.pathname and applies the right adapter.
============================================================ */

(function (global) {
  'use strict';

  /* ══ STORAGE KEYS ══════════════════════════════════════════ */
  const KEYS = {
    SHARED:    'BALAJI_SHARED_DB',       // item master — single source of truth
    INVENTORY: 'BALAJI_INVENTORY_DB',    // stock movements (GRN, issues, transfers)
    PURCHASE:  'BALAJI_PROCUREMENT',     // purchase orders, vendors, GRN
    SALES:     'BALAJI_SMARTBILL_V2',    // invoices, customers
    GENERAL:   'balaji_erp_v3',          // General inventory module
    RESTRO:    'restrostock_v1',         // RestroStock restaurant inventory
    SESSION:   'ERP_USER',              // login session (from erp-config.js)
    CLIENT:    'bnx_client_id',
    MASTER_DB: 'bnx_master_db_id',
    TXN_DB:    'bnx_transaction_db_id',
    REPORT_DB: 'bnx_report_db_id',
  };

  /* ══ GAS ENDPOINTS ═════════════════════════════════════════ */
  const GAS = {
    CORE:    'https://script.google.com/macros/s/' +
             (localStorage.getItem('bnx_api_core') ||
              'AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ') + '/exec',
    AUTH:    'https://script.google.com/macros/s/' +
             (localStorage.getItem('bnx_api_auth') ||
              'AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx') + '/exec',
    FRONTEND:'https://script.google.com/macros/s/' +
             (localStorage.getItem('bnx_api_front') ||
              'AKfycbyiaO9zpZAQ1pTlDjz7B2yEUfjv1vrlXTYjTkIY-YwKr6ahOCV6lU_AiB4dpmnBySG1') + '/exec',
  };

  /* ══ HELPERS ════════════════════════════════════════════════ */
  function _read(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e) { return null; }
  }
  function _write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch(e) { console.error('[Bridge] Write error', key, e); return false; }
  }
  function _uid() {
    return 'ITM-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
  }
  function _user() {
    try { return _read(KEYS.SESSION) || {}; } catch(e) { return {}; }
  }
  function _clientId() { return localStorage.getItem(KEYS.CLIENT) || 'LOCAL'; }
  function _now() { return new Date().toISOString(); }
  function _today() { return _now().slice(0,10); }

  /* ══ SHARED ITEM MASTER ═════════════════════════════════════
     The canonical item list. All modules read from here.
     Shape of each item:
     {
       id, name, sku, category, unit, hsn,
       costPrice, salePrice, mrp,
       stock, minStock, maxStock,
       location, supplier, brand,
       isRestaurant,     // true for food/ingredient items
       isRetail,         // true for retail products
       expiry,           // for medical/food items
       batchNo,
       lastUpdated, createdOn
     }
  ══════════════════════════════════════════════════════════ */

  function getShared() {
    return _read(KEYS.SHARED) || { items: [], categories: [], lastSync: null, version: 2 };
  }
  function saveShared(shared) {
    shared.lastSync = _now();
    _write(KEYS.SHARED, shared);
  }

  function getItems() { return getShared().items || []; }

  function upsertItem(item) {
    const shared = getShared();
    const idx = shared.items.findIndex(i => i.id === item.id || (item.sku && i.sku === item.sku));
    if (idx >= 0) {
      shared.items[idx] = Object.assign(shared.items[idx], item, { lastUpdated: _now() });
    } else {
      shared.items.push(Object.assign({ id: _uid(), createdOn: _now() }, item));
    }
    saveShared(shared);
    return shared.items[idx >= 0 ? idx : shared.items.length - 1];
  }

  function getStock(itemId) {
    const items = getItems();
    const item = items.find(i => i.id === itemId || i.sku === itemId);
    return item ? (Number(item.stock) || 0) : 0;
  }

  function adjustStock(itemId, delta, reason) {
    const shared = getShared();
    const item = shared.items.find(i => i.id === itemId || i.sku === itemId || i.name === itemId);
    if (!item) return false;
    item.stock = Math.max(0, (Number(item.stock) || 0) + delta);
    item.lastUpdated = _now();
    saveShared(shared);
    _logMovement({ itemId, itemName: item.name, delta, reason, date: _today() });
    return item.stock;
  }

  function _logMovement(mov) {
    const inv = _read(KEYS.INVENTORY) || { stockIn:[], stockOut:[], transfers:[], adjustments:[], seq:{si:1,so:1,tr:1,adj:1} };
    mov.id = 'ADJ-' + Date.now();
    mov.by = _user().FULL_NAME || 'System';
    inv.adjustments = inv.adjustments || [];
    inv.adjustments.push(mov);
    _write(KEYS.INVENTORY, inv);
  }

  /* ══ STOCK ALERTS ══════════════════════════════════════════ */
  function stockAlert() {
    const items = getItems();
    return {
      outOfStock: items.filter(i => (Number(i.stock)||0) <= 0),
      lowStock:   items.filter(i => (Number(i.stock)||0) > 0 && (Number(i.stock)||0) <= (Number(i.minStock)||5)),
      overStock:  items.filter(i => i.maxStock && (Number(i.stock)||0) > Number(i.maxStock)),
      nearExpiry: items.filter(i => {
        if (!i.expiry) return false;
        const days = Math.ceil((new Date(i.expiry) - new Date()) / 86400000);
        return days >= 0 && days <= 30;
      }),
    };
  }

  /* ══ MODULE ADAPTERS ═══════════════════════════════════════ */

  const GeneralAdapter = {
    pull() {
      const db = _read(KEYS.GENERAL);
      if (!db || !db.products) return 0;
      let count = 0;
      db.products.forEach(p => {
        upsertItem({
          id: p.id || _uid(), sku: p.sku || p.code || p.id,
          name: p.name, category: p.category || '', unit: p.unit || 'Nos',
          hsn: p.hsn || '', costPrice: Number(p.cost || 0), salePrice: Number(p.price || 0),
          stock: Number(p.stock || p.qty || 0), minStock: Number(p.minQty || 5),
          location: p.location || p.rack || '', brand: p.brand || '',
          supplier: p.supplier || '', isRetail: true, lastUpdated: _now(),
        });
        count++;
      });
      return count;
    },
    push() {
      const db = _read(KEYS.GENERAL);
      if (!db) return;
      db.products = db.products || [];
      db.products.forEach(p => {
        const match = getItems().find(i => i.sku === (p.sku||p.code||p.id) || i.name === p.name);
        if (match) { p.stock = match.stock; p.cost = match.costPrice; p.price = match.salePrice; }
      });
      _write(KEYS.GENERAL, db);
    }
  };

  const RestroAdapter = {
    pull() {
      const db = _read(KEYS.RESTRO);
      if (!db || !db.ingredients) return 0;
      let count = 0;
      db.ingredients.forEach(ing => {
        upsertItem({
          id: ing.code || _uid(), sku: ing.code, name: ing.name,
          category: ing.category || 'Ingredients', unit: ing.unit || 'Kg',
          costPrice: Number(ing.cost || 0), salePrice: 0,
          stock: Number(ing.stock || 0), minStock: Number(ing.minQty || 2),
          location: ing.storage || 'Kitchen', supplier: ing.supplier || '',
          isRestaurant: true, lastUpdated: _now(),
        });
        count++;
      });
      return count;
    },
    push() {
      const db = _read(KEYS.RESTRO);
      if (!db) return;
      db.ingredients = db.ingredients || [];
      db.ingredients.forEach(ing => {
        const match = getItems().find(i => i.sku === ing.code || i.name === ing.name);
        if (match) { ing.stock = match.stock; ing.cost = match.costPrice; }
      });
      _write(KEYS.RESTRO, db);
    }
  };

  const PurchaseAdapter = {
    pull() {
      const db = _read(KEYS.PURCHASE);
      if (!db) return 0;
      let count = 0;
      (db.itemMaster || []).forEach(item => {
        upsertItem({
          id: item.id || _uid(), sku: item.sku || item.code || item.id,
          name: item.name, unit: item.unit || 'Nos', hsn: item.hsn || '',
          category: item.category || '', costPrice: Number(item.rate || item.cost || 0),
          stock: Number(item.stock || 0), supplier: item.supplier || '',
          isRetail: true, lastUpdated: _now(),
        });
        count++;
      });
      return count;
    },
    onGRNSaved(grn) {
      if (!grn || !grn.items) return;
      grn.items.forEach(it => adjustStock(it.id || it.name, Number(it.qty || 0), 'GRN ' + (grn.grnNo || '')));
    }
  };

  const SalesAdapter = {
    pull() {
      const db = _read(KEYS.SALES);
      if (!db) return 0;
      let count = 0;
      (db.items || db.products || []).forEach(item => {
        upsertItem({
          id: item.id || _uid(), sku: item.sku || item.code || item.id,
          name: item.name, unit: item.unit || 'Nos', hsn: item.hsn || '',
          salePrice: Number(item.rate || item.price || 0),
          stock: Number(item.stock || 0), minStock: Number(item.minQty || 5),
          isRetail: true, lastUpdated: _now(),
        });
        count++;
      });
      return count;
    },
    onInvoiceSaved(invoice) {
      if (!invoice || !invoice.items) return;
      invoice.items.forEach(it => adjustStock(it.id || it.name, -(Number(it.qty || 0)), 'Sale: ' + (invoice.invoiceNo || '')));
    }
  };

  const InvModuleAdapter = {
    pull() {
      const shared = _read(KEYS.SHARED);
      return shared ? (shared.items || []).length : 0;
    }
  };

  /* ══ SYNC ENGINE ════════════════════════════════════════════ */
  function sync() {
    const results = { pulled: 0, pushed: 0, errors: [] };
    try {
      results.pulled += GeneralAdapter.pull();
      results.pulled += RestroAdapter.pull();
      results.pulled += PurchaseAdapter.pull();
      results.pulled += SalesAdapter.pull();
      results.pulled += InvModuleAdapter.pull();
      GeneralAdapter.push();
      RestroAdapter.push();
      _updateDashboardSummary();
      _log('Sync complete', results);
    } catch(e) {
      results.errors.push(e.message);
      console.error('[Bridge] Sync error:', e);
    }
    return results;
  }

  /* ══ DASHBOARD SUMMARY UPDATE ═══════════════════════════════ */
  function _updateDashboardSummary() {
    const items = getItems();
    const alert = stockAlert();
    const totalVal = items.reduce((s, i) => s + (Number(i.stock)||0) * (Number(i.costPrice)||0), 0);
    const purchaseDB = _read(KEYS.PURCHASE);
    const monthStr = _today().slice(0,7);
    const purchaseMTD = (purchaseDB?.purchases || [])
      .filter(p => (p.date||'').startsWith(monthStr))
      .reduce((s, p) => s + Number(p.grandTotal || p.total || 0), 0);
    const salesDB = _read(KEYS.SALES);
    const salesMTD = (salesDB?.docs || salesDB?.invoices || [])
      .filter(d => (d.date||'').startsWith(monthStr))
      .reduce((s, d) => s + Number(d.grandTotal || d.total || 0), 0);
    const _set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    _set('kpi-stock-value',  _fmtCurrency(totalVal));
    _set('kpi-total-skus',   items.length.toLocaleString('en-IN'));
    _set('kpi-low-stock',    alert.lowStock.length);
    _set('kpi-out-of-stock', alert.outOfStock.length);
    _set('kpi-purchase-mtd', _fmtCurrency(purchaseMTD));
    _set('kpi-issues-mtd',   _fmtCurrency(salesMTD));
    _set('sync-time', new Date().toLocaleTimeString('en-IN'));
    _set('syncTxt', 'Connected · Local Sync');
    const nb = document.getElementById('nb-low');
    if (nb) nb.textContent = alert.lowStock.length + alert.outOfStock.length;
    const badge = document.getElementById('db-count-badge');
    if (badge) badge.textContent = '📊 ' + items.length + ' items synced';
  }

  function _fmtCurrency(n) {
    n = Number(n) || 0;
    if (n >= 10000000) return '₹' + (n/10000000).toFixed(2) + ' Cr';
    if (n >= 100000)   return '₹' + (n/100000).toFixed(2) + ' L';
    if (n >= 1000)     return '₹' + (n/1000).toFixed(1) + 'K';
    return '₹' + n.toLocaleString('en-IN');
  }

  /* ══ GAS SYNC ════════════════════════════════════════════════ */
  async function gasSync() {
    const user = _user();
    const payload = {
      action: 'SYNC_INVENTORY', clientId: _clientId(),
      sessionToken:      user.SESSION_TOKEN || user.sessionToken || '',
      master_db_id:      localStorage.getItem(KEYS.MASTER_DB) || '',
      transaction_db_id: localStorage.getItem(KEYS.TXN_DB)   || '',
      report_db_id:      localStorage.getItem(KEYS.REPORT_DB) || '',
      data: {
        items:       getItems(),
        purchases:   (_read(KEYS.PURCHASE) || {}).purchases    || [],
        grns:        (_read(KEYS.PURCHASE) || {}).grns         || [],
        vendors:     (_read(KEYS.PURCHASE) || {}).vendors      || [],
        invoices:    (_read(KEYS.SALES)    || {}).docs         || [],
        stockIn:     (_read(KEYS.INVENTORY)|| {}).stockIn      || [],
        stockOut:    (_read(KEYS.INVENTORY)|| {}).stockOut     || [],
        adjustments: (_read(KEYS.INVENTORY)|| {}).adjustments  || [],
        syncTime: _now(),
      }
    };
    try {
      const r   = await fetch(GAS.CORE, { method:'POST', body: JSON.stringify(payload) });
      const res = await r.json();
      if (res.status === 'success' || res.ok) {
        localStorage.setItem('BNJERP_last_sync', _now());
        const el = document.getElementById('syncTxt');
        if (el) el.textContent = 'Google Sheet synced · ' + new Date().toLocaleTimeString();
        return { ok: true, message: res.message };
      }
      return { ok: false, message: res.message || 'GAS error' };
    } catch(e) { return { ok: false, message: e.message }; }
  }

  async function gasPull(action) {
    action = action || 'GET_INVENTORY';
    const user = _user();
    try {
      const r = await fetch(GAS.CORE, { method:'POST', body: JSON.stringify({
        action, clientId: _clientId(),
        sessionToken:      user.SESSION_TOKEN || '',
        master_db_id:      localStorage.getItem(KEYS.MASTER_DB)  || '',
        transaction_db_id: localStorage.getItem(KEYS.TXN_DB)     || '',
        report_db_id:      localStorage.getItem(KEYS.REPORT_DB)  || '',
      })});
      const res = await r.json();
      if ((res.status === 'success' || res.ok) && res.data) {
        const d = res.data;
        if (d.items)    { const sh = getShared(); sh.items = d.items; saveShared(sh); }
        if (d.purchases){ const p = _read(KEYS.PURCHASE)||{}; p.purchases=d.purchases; _write(KEYS.PURCHASE,p); }
        if (d.invoices) { const s = _read(KEYS.SALES)||{};    s.docs=d.invoices;       _write(KEYS.SALES,s); }
        if (d.vendors)  { const p = _read(KEYS.PURCHASE)||{}; p.vendors=d.vendors;     _write(KEYS.PURCHASE,p); }
        _updateDashboardSummary();
        return { ok: true, data: d };
      }
      return { ok: false };
    } catch(e) { return { ok: false, message: e.message }; }
  }

  /* ══ EVENT HOOKS ════════════════════════════════════════════ */
  function onPurchaseSaved(purchase) {
    if (!purchase || !purchase.items) return;
    purchase.items.forEach(it => adjustStock(it.id || it.name, Number(it.qty || 0), 'Purchase: ' + (purchase.invoiceNo || '')));
    _log('Purchase saved hook', purchase.invoiceNo);
  }
  function onGRNSaved(grn)          { PurchaseAdapter.onGRNSaved(grn); }
  function onSaleSaved(invoice)     { SalesAdapter.onInvoiceSaved(invoice); }
  function onKitchenIssueSaved(issue) {
    if (!issue || !issue.items) return;
    issue.items.forEach(it => adjustStock(it.id || it.name, -(Number(it.qty||0)), 'Kitchen Issue: '+(issue.indentNo||'')));
  }
  function onBarIssueSaved(issue) {
    if (!issue || !issue.items) return;
    issue.items.forEach(it => adjustStock(it.id || it.name, -(Number(it.qty||0)), 'Bar Issue: '+(issue.orderId||'')));
  }

  function getModuleLinks() {
    const base = window.location.pathname.replace(/[^/]*$/, '');
    return {
      inventory:       base + 'inventory.html',
      inventoryModule: base + 'inventory-module.html',
      sales:           base + 'sales-module.html',
      purchase:        base + 'purchase-module.html',
      restrostock:     base + 'Restrostock_pro_inventory.html',
      generalInv:      base + 'BalajiERP_General_inventory_AI_Module.html',
      dashboard:       '../restaurant-dashboard.html',
      dsr:             '../dsr-client.html',
      adminSetup:      '../admin-setup.html',
    };
  }

  function getRecommendedModule() {
    const industry = ((_user().INDUSTRY)||'').toUpperCase();
    const RESTRO = ['RESTAURANT','RESTAURANT_PUB','BAR','HOTEL','BAKERY','CLOUD_KITCHEN','SWEET_SHOP','CATERING'];
    const RETAIL = ['RETAIL','SUPERMARKET','ELECTRONICS','CLOTHING','FOOTWEAR','JEWELLERY','GIFT_SHOP','OPTICAL','SPORTS'];
    if (RESTRO.includes(industry)) return { module:'restrostock',     label:'RestroStock Pro',          file:'Restrostock_pro_inventory.html' };
    if (RETAIL.includes(industry)) return { module:'inventoryModule', label:'Inventory Management v2',  file:'inventory-module.html' };
    return { module:'inventory', label:'Inventory Dashboard v10', file:'inventory.html' };
  }

  /* ══ STATUS TOOLBAR ═════════════════════════════════════════ */
  function _injectToolbar() {
    if (document.getElementById('_bridge_toolbar')) return;
    const bar = document.createElement('div');
    bar.id = '_bridge_toolbar';
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#0f172a;color:#94a3b8;font-family:system-ui,sans-serif;font-size:11px;padding:4px 14px;display:flex;align-items:center;gap:12px;border-top:1px solid #1e293b;height:26px;';
    const items = getItems(), alert = stockAlert();
    bar.innerHTML = `
      <span style="color:#58a6ff;font-weight:700">🔗 Bridge v1</span>
      <span id="_br_items">📦 ${items.length} items</span>
      <span id="_br_low" style="color:${alert.lowStock.length?'#f59e0b':'#94a3b8'}">⚠️ ${alert.lowStock.length} low</span>
      <span id="_br_out" style="color:${alert.outOfStock.length?'#ef4444':'#94a3b8'}">❌ ${alert.outOfStock.length} out</span>
      <button onclick="InventoryBridge.sync();InventoryBridge._refresh()" style="background:#1e40af;color:#fff;border:none;border-radius:4px;padding:1px 8px;font-size:10px;cursor:pointer">⟳ Sync</button>
      <button onclick="InventoryBridge.gasSync().then(r=>alert(r.ok?'✅ GAS Synced!':'❌ '+r.message))" style="background:#16a34a;color:#fff;border:none;border-radius:4px;padding:1px 8px;font-size:10px;cursor:pointer">☁ GAS Push</button>
      <button onclick="InventoryBridge.gasPull().then(r=>InventoryBridge._refresh())" style="background:#7c3aed;color:#fff;border:none;border-radius:4px;padding:1px 8px;font-size:10px;cursor:pointer">☁ GAS Pull</button>
      <span style="margin-left:auto;font-size:10px" id="_br_time">—</span>
    `;
    document.body.appendChild(bar);
    // add bottom padding so page content isn't hidden behind toolbar
    document.body.style.paddingBottom = (document.body.style.paddingBottom || '0').replace(/\d+/,'') || '0';
    const curr = parseInt(document.body.style.paddingBottom)||0;
    document.body.style.paddingBottom = (curr + 26) + 'px';
  }

  function _refresh() {
    const items = getItems(), alert = stockAlert();
    const _s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    _s('_br_items', '📦 ' + items.length + ' items');
    const lowEl = document.getElementById('_br_low');
    if(lowEl){lowEl.textContent='⚠️ '+alert.lowStock.length+' low';lowEl.style.color=alert.lowStock.length?'#f59e0b':'#94a3b8';}
    const outEl = document.getElementById('_br_out');
    if(outEl){outEl.textContent='❌ '+alert.outOfStock.length+' out';outEl.style.color=alert.outOfStock.length?'#ef4444':'#94a3b8';}
    _s('_br_time', 'Synced: '+new Date().toLocaleTimeString('en-IN'));
    _updateDashboardSummary();
  }

  /* ══ LOG ══════════════════════════════════════════════════ */
  const _logHistory = [];
  function _log(msg, data) {
    _logHistory.push({ t: _now(), msg, data });
    if (_logHistory.length > 50) _logHistory.shift();
    console.log('[Bridge]', msg, data || '');
  }

  /* ══ AUTO-INIT ══════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    const result = sync();
    _log('Auto-sync on load', result);
    _injectToolbar();
    _refresh();
    // Expose hooks on window so other modules can call them
    window.onPurchaseSaved     = onPurchaseSaved;
    window.onGRNSaved          = onGRNSaved;
    window.onSaleSaved         = onSaleSaved;
    window.onKitchenIssueSaved = onKitchenIssueSaved;
    window.onBarIssueSaved     = onBarIssueSaved;
    // Auto-refresh every 2 minutes
    setInterval(() => { sync(); _refresh(); }, 2 * 60 * 1000);
    console.log('[Bridge] ✅ Ready. Keys connected:', {
      SHARED: !!localStorage.getItem(KEYS.SHARED), PURCHASE: !!localStorage.getItem(KEYS.PURCHASE),
      SALES:  !!localStorage.getItem(KEYS.SALES),  GENERAL:  !!localStorage.getItem(KEYS.GENERAL),
      RESTRO: !!localStorage.getItem(KEYS.RESTRO),  INVENTORY:!!localStorage.getItem(KEYS.INVENTORY),
    });
  });

  /* ══ PUBLIC API ═════════════════════════════════════════════ */
  global.InventoryBridge = {
    sync, gasSync, gasPull,
    getItems, getShared, getStock, adjustStock, upsertItem, stockAlert,
    getModuleLinks, getRecommendedModule,
    onPurchaseSaved, onGRNSaved, onSaleSaved, onKitchenIssueSaved, onBarIssueSaved,
    KEYS, GAS, _refresh, _log, _logHistory,
  };

})(window);
