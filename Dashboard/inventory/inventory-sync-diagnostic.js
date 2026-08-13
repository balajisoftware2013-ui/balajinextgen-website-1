/* ════════════════════════════════════════════════════════════════
   INVENTORY SYNC DIAGNOSTIC TOOL
   ------------------------------------------------------------------
   Shows:
   1. Storage backend being used (localStorage vs sessionStorage)
   2. All inventory data cached locally
   3. Last cloud sync status
   4. Tracking Prevention detection
   5. Data consistency across Purchase/Sales/Inventory modules
   
   Usage:
   - Call this from browser console: InventorySyncDiag.report()
   - Or embed in page: <script src="inventory-sync-diagnostic.js"></script>
   ════════════════════════════════════════════════════════════════ */

(function(window) {
  'use strict';

  const SHARED_KEY = 'BALAJI_SHARED_DB';
  const INV_KEY    = 'BALAJI_INVENTORY_DB';
  const PURCH_KEY  = 'BALAJI_PROCUREMENT';
  const SALES_KEY  = 'BALAJI_SMARTBILL_V2';

  /**
   * Check if localStorage is blocked by Tracking Prevention
   */
  function checkTrackingPrevention() {
    try {
      const test = '__tracking_test_' + Date.now();
      localStorage.setItem(test, '1');
      localStorage.removeItem(test);
      return { blocked: false, message: '✓ localStorage accessible' };
    } catch (e) {
      return {
        blocked: true,
        message: '✗ localStorage BLOCKED by Tracking Prevention: ' + e.message,
        error: e.name
      };
    }
  }

  /**
   * Get which storage backend is being used
   */
  function getActiveStorage() {
    try {
      localStorage.setItem('__test', '1');
      localStorage.removeItem('__test');
      return 'localStorage (persistent)';
    } catch (e) {
      return 'sessionStorage (session-only - lost on close!)';
    }
  }

  /**
   * Load and analyze inventory data from storage
   */
  function getInventoryData() {
    let shared = null, inv = null, purch = null, sales = null;

    try {
      shared = JSON.parse(localStorage.getItem(SHARED_KEY) || sessionStorage.getItem(SHARED_KEY));
    } catch (e) {}

    try {
      inv = JSON.parse(localStorage.getItem(INV_KEY) || sessionStorage.getItem(INV_KEY));
    } catch (e) {}

    try {
      purch = JSON.parse(localStorage.getItem(PURCH_KEY) || sessionStorage.getItem(PURCH_KEY));
    } catch (e) {}

    try {
      sales = JSON.parse(localStorage.getItem(SALES_KEY) || sessionStorage.getItem(SALES_KEY));
    } catch (e) {}

    return { shared, inv, purch, sales };
  }

  /**
   * Calculate stock for an item (same formula as InventoryBridge)
   */
  function calcStock(shared, inv, itemId) {
    if (!shared || !shared.items) return null;
    const item = shared.items.find(i => i.id === itemId);
    if (!item) return null;

    const opening = +(item.opening || 0);
    const inQty = inv?.stockIn?.flatMap(si => si.items || []).filter(it => it.itemId === itemId).reduce((s, it) => s + (+it.qty || 0), 0) || 0;
    const outQty = inv?.stockOut?.flatMap(so => so.items || []).filter(it => it.itemId === itemId).reduce((s, it) => s + (+it.qty || 0), 0) || 0;
    const adjTotal = inv?.adjustments?.filter(a => a.itemId === itemId).reduce((s, a) => s + (+a.diff || 0), 0) || 0;

    return opening + inQty - outQty + adjTotal;
  }

  /**
   * Check data consistency between Purchase/Sales/Inventory caches
   */
  function checkConsistency() {
    const { shared, inv, purch, sales } = getInventoryData();
    const issues = [];
    const stats = { totalItems: 0, itemsWithIssues: 0 };

    if (!shared || !shared.items) {
      issues.push('⚠ SHARED_DB not found - item master not loaded');
      return { issues, stats };
    }

    stats.totalItems = shared.items.length;

    // Check each item's stock is same across all modules
    shared.items.forEach(item => {
      const invStock = calcStock(shared, inv, item.id);
      const purchStock = purch?.items?.find(i => i.id === item.id)?.currentStock;
      const salesStock = sales?.items?.find(i => i.id === item.id)?.stock;

      const mismatch = [
        { name: 'Inventory Module', value: invStock },
        { name: 'Purchase Module', value: purchStock },
        { name: 'Sales Module', value: salesStock }
      ].filter(x => x.value !== undefined && x.value !== null);

      // Check if all defined values match
      const values = mismatch.map(x => x.value);
      const allSame = values.every(v => v === values[0]);

      if (!allSame && mismatch.length > 1) {
        stats.itemsWithIssues++;
        issues.push(
          `⚠ Item "${item.name}" stock mismatch: ` +
          mismatch.map(x => `${x.name}=${x.value}`).join(' vs ')
        );
      }
    });

    return { issues, stats };
  }

  /**
   * Main diagnostic report
   */
  function generateReport() {
    console.clear();
    console.log('%c════ INVENTORY SYNC DIAGNOSTIC REPORT ════', 'background:#333;color:#0f0;font-weight:bold;padding:10px');

    // 1. Storage & Tracking Prevention
    console.log('\n%c1. STORAGE STATUS', 'background:#1a5f7a;color:#fff;font-weight:bold;padding:5px');
    const tracking = checkTrackingPrevention();
    const storage = getActiveStorage();
    console.log(tracking.message);
    console.log('Active Storage:', storage);

    if (tracking.blocked) {
      console.log('%c⚠ WARNING: Tracking Prevention is blocking localStorage!', 'color:#ff9900;font-weight:bold');
      console.log('Solution: Use inventory-bridge-cloud.js which syncs to Google Sheets instead');
    }

    // 2. Client ID
    console.log('\n%c2. CLIENT CONTEXT', 'background:#1a5f7a;color:#fff;font-weight:bold;padding:5px');
    console.log('Client ID:', window.CLIENT_ID || 'Not set');
    console.log('GAS URL:', window.GAS_URL ? '✓ Set (but see note in section 4)' : '⚠ Not configured');

    // 3. Inventory Data
    console.log('\n%c3. CACHED DATA', 'background:#1a5f7a;color:#fff;font-weight:bold;padding:5px');
    const { shared, inv, purch, sales } = getInventoryData();

    console.log('SHARED_DB (Item Master):', shared ? `✓ ${shared.items?.length || 0} items` : '✗ Not found');
    console.log('INVENTORY_DB:', inv ? `✓ ${inv.adjustments?.length || 0} adjustments` : '✗ Not found');
    console.log('PROCUREMENT:', purch ? `✓ ${purch.items?.length || 0} items cached` : '✗ Not found');
    console.log('SMARTBILL_V2:', sales ? `✓ ${sales.items?.length || 0} items cached` : '✗ Not found');

    // 4. InventoryBridge status
    console.log('\n%c4. INVENTORYBRIDGE STATUS', 'background:#1a5f7a;color:#fff;font-weight:bold;padding:5px');
    if (window.InventoryBridge) {
      console.log('✓ InventoryBridge loaded (local stock bookkeeping only)');
      console.log('Storage Backend:', window.InventoryBridge.getStorageBackend?.());
      // NOTE (07-Aug-2026): InventoryBridge's CLOUD sync (syncToGas/pullFromGas)
      // is intentionally disabled — confirmed its actions (SYNC_INVENTORY_DATA /
      // PULL_INVENTORY_DATA) were never implemented in the real backend, which
      // actually uses rbClientSpreadsheetId_() + erpApi()-style granular actions
      // instead (SAVE_GRN, SAVE_PURCHASE_INVOICE, SYNC_PULL_ALL, etc. — see
      // dbSyncBadge / liveSyncBadge on this page for the REAL sync status).
      // "Last Cloud Sync: Never" below is expected and NOT a problem to fix.
      console.log('Last Cloud Sync: Never (expected — cloud portion disabled by design, see note above)');
      console.log('→ For real sync status, check the sync badge in the top bar / sidebar, not this tool');
    } else {
      console.log('✗ InventoryBridge NOT loaded (local stock adjustment tracking unavailable on this page)');
    }

    // 5. Data Consistency
    console.log('\n%c5. DATA CONSISTENCY CHECK', 'background:#1a5f7a;color:#fff;font-weight:bold;padding:5px');
    const { issues, stats } = checkConsistency();
    console.log(`Items found: ${stats.totalItems}, Issues: ${stats.itemsWithIssues}`);

    if (issues.length === 0) {
      console.log('%c✓ All data consistent across modules', 'color:#00ff00;font-weight:bold');
    } else {
      console.log('%c⚠ Data inconsistencies detected:', 'color:#ff9900;font-weight:bold');
      issues.forEach(issue => console.log('  ' + issue));
    }

    // 6. Recommendations
    console.log('\n%c6. RECOMMENDATIONS', 'background:#1a5f7a;color:#fff;font-weight:bold;padding:5px');
    const recs = [];

    if (tracking.blocked) {
      recs.push('→ Use inventory-bridge-cloud.js instead of inventory-bridge.js');
    }

    // REMOVED: the old "Set window.GAS_URL before loading InventoryBridge"
    // recommendation — GAS_URL being set no longer means cloud sync will
    // work, since InventoryBridge's cloud actions are disabled by design.
    // Recommending the person "fix" GAS_URL here would send them chasing a
    // non-problem. Real sync issues now surface via dbSyncBadge/erpApi
    // failures on-page, not this tool.

    if (stats.itemsWithIssues > 0) {
      recs.push('→ Click "Sync" button on Inventory module to resync all modules');
    }

    if (!window.CLIENT_ID) {
      recs.push('→ Set window.CLIENT_ID in page initialization');
    }

    if (recs.length === 0) {
      console.log('%c✓ No issues detected - system is healthy', 'color:#00ff00;font-weight:bold');
    } else {
      recs.forEach(rec => console.log(rec));
    }

    console.log('\n%c════ END REPORT ════', 'background:#333;color:#0f0;font-weight:bold;padding:10px');
  }

  /**
   * Export detailed data as JSON (for sharing with support)
   */
  function exportDataForSupport() {
    const { shared, inv, purch, sales } = getInventoryData();
    const tracking = checkTrackingPrevention();
    const consistency = checkConsistency();

    const exportData = {
      timestamp: new Date().toISOString(),
      clientId: window.CLIENT_ID,
      environment: {
        storageBackend: getActiveStorage(),
        trackingBlocked: tracking.blocked,
        gasUrlConfigured: !!window.GAS_URL && !window.GAS_URL.includes('YOUR_GAS_ID'),
        inventoryBridgeCloudSync: 'disabled by design — see erpApi/dbSyncBadge for real sync status'
      },
      dataSnapshot: {
        shared: shared ? { itemCount: shared.items?.length } : null,
        inv: inv ? { adjustmentCount: inv.adjustments?.length } : null,
        purch: purch ? { itemCount: purch.items?.length } : null,
        sales: sales ? { itemCount: sales.items?.length } : null
      },
      consistency,
      issues: consistency.issues
    };

    console.log('Export Data:', JSON.stringify(exportData, null, 2));
    return exportData;
  }

  // Expose to window
  window.InventorySyncDiag = {
    report: generateReport,
    exportData: exportDataForSupport,
    checkTracking: checkTrackingPrevention,
    checkConsistency: checkConsistency,
    getData: getInventoryData
  };

  console.log('[InventorySyncDiag] ✓ Loaded - Use InventorySyncDiag.report() to diagnose');
})
(window);
