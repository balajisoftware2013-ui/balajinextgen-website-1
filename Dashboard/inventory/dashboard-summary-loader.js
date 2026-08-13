/* ============================================================
   BALAJI NEXTGEN ERP — dashboard-summary-loader.js  (FIXED v2)
   ------------------------------------------------------------
   BUG FIXED: this file called window.GAS_URL / window.CLIENT_ID —
   neither exists on inventory.html or purchase-module.html. The real
   variables are:
     inventory.html:        SCRIPT_URL (const), CID (const)
     purchase-module.html:  PURCHASE_GAS_URL (const), CLIENT_ID (const)
   Both are top-level `const` in a classic (non-module) <script> tag,
   so — since this file loads via <script src> AFTER those consts are
   declared, at the very end of <body> — they're visible here by bare
   name (same global script scope), just not as window.* properties.
   This version tries the real names first, with window.GAS_URL/
   window.CLIENT_ID kept only as a last-resort fallback for any other
   page that might use those.

   ARCHITECTURE NOTE: on inventory.html specifically, loadDashboard()
   already computes every visible KPI (kv-val, kv-skus, kv-low, kv-pur,
   kv-kit, kv-bar, kv-iss, nb-low) itself, from local DB tables kept in
   sync via SYNC_PULL_ALL/SYNC_PUSH_TABLE (see InventorySyncGeneric.gs).
   This loader targets a DIFFERENT set of element IDs (kpi-stock-value,
   kpi-purchase-mtd, etc.) that do not exist in inventory.html at all —
   so even fully fixed, it currently has nothing to write to on that
   page. Recommended: remove the <script src="../dashboard-summary-
   loader.js"> include from inventory.html and purchase-module.html
   entirely, and only include this file on a page that actually has
   elements with these exact IDs. Left working correctly below in case
   there's a page (or a future one) that does.

   REQUIRES backend action GET_DASHBOARD_SUMMARY — see
   DashboardSummary_Live.gs.
   ============================================================ */

const DashboardLoader = (function () {

  const KPI_MAP = {
    STOCK_VALUE  : { id: 'kpi-stock-value',  format: 'currency' },
    TOTAL_SKUS   : { id: 'kpi-total-skus',   format: 'number'   },
    LOW_STOCK    : { id: 'kpi-low-stock',    format: 'number'   },
    OUT_OF_STOCK : { id: 'kpi-out-of-stock', format: 'number'   },
    PURCHASE_MTD : { id: 'kpi-purchase-mtd', format: 'currency' },
    ISSUES_MTD   : { id: 'kpi-issues-mtd',   format: 'currency' },
    KITCHEN_TODAY: { id: 'kpi-kitchen-today',format: 'currency' },
    BAR_TODAY    : { id: 'kpi-bar-today',    format: 'currency' },
    LAST_SYNC    : { id: 'sync-time',        format: 'text'     },
  };

  function resolveGasUrl() {
    if (typeof SCRIPT_URL !== 'undefined' && SCRIPT_URL) return SCRIPT_URL;
    if (typeof PURCHASE_GAS_URL !== 'undefined' && PURCHASE_GAS_URL) return PURCHASE_GAS_URL;
    if (window.GAS_URL) return window.GAS_URL;
    return null;
  }
  function resolveClientId() {
    if (typeof CID !== 'undefined' && CID && CID !== 'C001') return CID;
    if (typeof CLIENT_ID !== 'undefined' && CLIENT_ID) return CLIENT_ID;
    if (window.CLIENT_ID) return window.CLIENT_ID;
    return null;
  }

  function formatCurrency(val) {
    const n = parseFloat(val) || 0;
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000)   return '₹' + (n / 100000).toFixed(2) + ' L';
    if (n >= 1000)     return '₹' + (n / 1000).toFixed(1) + 'K';
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0 });
  }
  function formatNumber(val) {
    return (parseInt(val) || 0).toLocaleString('en-IN');
  }
  function setEl(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.style.transition = 'color 0.4s';
    el.style.color = 'var(--green, #059669)';
    setTimeout(() => { el.style.color = ''; }, 1200);
  }
  function showLoading() {
    Object.values(KPI_MAP).forEach(cfg => {
      const el = document.getElementById(cfg.id);
      if (el) { el.textContent = '...'; el.style.opacity = '0.5'; }
    });
  }
  function hideLoading() {
    Object.values(KPI_MAP).forEach(cfg => {
      const el = document.getElementById(cfg.id);
      if (el) el.style.opacity = '1';
    });
  }

  async function fetchSummaryFromBackend() {
    const gasUrl = resolveGasUrl();
    const clientId = resolveClientId();
    if (!gasUrl) { console.warn('[DashboardLoader] No GAS URL found.'); return null; }
    if (!clientId) { console.warn('[DashboardLoader] No client ID found.'); return null; }
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'GET_DASHBOARD_SUMMARY', clientId })
      });
      const json = await res.json();
      if (json.success === false) {
        console.warn('[DashboardLoader] Backend returned failure:', json.message);
        return null;
      }
      return json; // DS_getDashboardSummary_ returns the KPI object directly
    } catch (e) {
      console.error('[DashboardLoader] Fetch failed:', e);
      return null;
    }
  }

  async function load() {
    const anyTarget = Object.values(KPI_MAP).some(cfg => document.getElementById(cfg.id));
    if (!anyTarget) return; // nothing on this page for us to fill — see note above

    showLoading();
    const data = await fetchSummaryFromBackend();
    if (!data) {
      hideLoading();
      const syncEl = document.getElementById('syncTxt');
      if (syncEl) syncEl.textContent = 'Sheet Error — Check backend';
      return;
    }

    Object.entries(KPI_MAP).forEach(([key, cfg]) => {
      const raw = data[key];
      if (raw === undefined) return;
      let display = raw;
      if (cfg.format === 'currency') display = formatCurrency(raw);
      else if (cfg.format === 'number') display = formatNumber(raw);
      setEl(cfg.id, display);
    });
    hideLoading();

    const syncEl = document.getElementById('syncTxt');
    if (syncEl) syncEl.textContent = 'Connected · Google Sheet';
    const dbBadge = document.getElementById('db-count-badge');
    if (dbBadge) dbBadge.textContent = '📊 Live Data';
    const lowBadge = document.getElementById('nb-low');
    if (lowBadge && data['LOW_STOCK'] !== undefined) lowBadge.textContent = data['LOW_STOCK'];
  }

  function startAutoRefresh(intervalMinutes) {
    setInterval(load, (intervalMinutes || 5) * 60 * 1000);
  }

  return { load, startAutoRefresh, KPI_MAP };
})();

document.addEventListener('DOMContentLoaded', function () {
  DashboardLoader.load();
  DashboardLoader.startAutoRefresh(5);
});
