/* ============================================================
   BALAJI NEXTGEN ERP — dashboard-summary-loader.js  (FIXED)
   ------------------------------------------------------------
   CHANGE FROM OLD VERSION:
   Old version fetched a hardcoded Google Sheet (which happened to
   be USER_SECURITY_MASTER_DB — the WRONG sheet for every client)
   via public CSV export. That sheet never had a DASHBOARD_SUMMARY
   tab, so every KPI silently stayed at 0.

   This version instead POSTs to your existing GAS backend
   (window.GAS_URL) with action: 'GET_DASHBOARD_SUMMARY' and
   clientId: window.CLIENT_ID. The backend resolves the correct
   per-client sheet itself (same rbClientSpreadsheetId_() pattern
   already used by SAVE_PURCHASE_INVOICE etc.), so there's no
   sheet ID to hardcode or get wrong on the client side.

   REQUIRES: a new backend action GET_DASHBOARD_SUMMARY — see
   dashboard-summary-backend.gs (companion file). Until that
   action exists server-side, this will show "Sheet Error" same
   as before — that's expected, not a new bug.

   Include AFTER erp-config.js on inventory.html / purchase-module.html
   (erp-config.js must define window.GAS_URL and window.CLIENT_ID
   before this file loads).
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
    if (!window.GAS_URL) {
      console.warn('[DashboardLoader] window.GAS_URL not set — cannot fetch summary.');
      return null;
    }
    if (!window.CLIENT_ID) {
      console.warn('[DashboardLoader] window.CLIENT_ID not set — cannot fetch summary.');
      return null;
    }
    try {
      const res = await fetch(window.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // avoids CORS preflight, matches rest of app
        body: JSON.stringify({
          action: 'GET_DASHBOARD_SUMMARY',
          clientId: window.CLIENT_ID
        })
      });
      const json = await res.json();
      if (!json.success) {
        console.warn('[DashboardLoader] Backend returned failure:', json.message);
        return null;
      }
      return json.data || json.summary || null;
    } catch (e) {
      console.error('[DashboardLoader] Fetch failed:', e);
      return null;
    }
  }

  async function load() {
    showLoading();

    const data = await fetchSummaryFromBackend();
    if (!data) {
      hideLoading();
      const syncEl = document.getElementById('syncTxt');
      if (syncEl) syncEl.textContent = 'Sheet Error — Check GAS_URL / CLIENT_ID';
      return;
    }

    console.log('[DashboardLoader] Loaded:', data);

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

    console.log('[DashboardLoader] ✅ Dashboard updated from backend');
  }

  function startAutoRefresh(intervalMinutes) {
    const ms = (intervalMinutes || 5) * 60 * 1000;
    setInterval(load, ms);
    console.log(`[DashboardLoader] Auto-refresh every ${intervalMinutes || 5} min`);
  }

  return { load, startAutoRefresh, KPI_MAP };

})();

document.addEventListener('DOMContentLoaded', function () {
  DashboardLoader.load();
  DashboardLoader.startAutoRefresh(5);
});
