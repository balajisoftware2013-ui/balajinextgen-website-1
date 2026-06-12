/* ============================================================
   BALAJI NEXTGEN ERP — dashboard-summary-loader.js
   Reads DASHBOARD_SUMMARY Google Sheet → fills KPI cards
   Include AFTER erp-config.js on inventory.html
   ============================================================

   HOW TO USE:
   1. Create DASHBOARD_SUMMARY tab in your Google Sheet
   2. Publish it as CSV (File → Share → Publish to web)
   3. Paste the Sheet ID below
   4. Add this script to inventory.html:
      <script src="../dashboard-summary-loader.js"></script>
   5. Call: DashboardLoader.load()  on DOMContentLoaded
   ============================================================ */

const DashboardLoader = (function () {

  // ── PASTE YOUR SHEET ID HERE ──────────────────────────────
  // This is the Google Sheet that contains DASHBOARD_SUMMARY tab
  // Sheet ID is in the URL: /spreadsheets/d/[THIS_PART]/edit
  const SUMMARY_SHEET_ID  = '1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg'; // ← your sheet ID
  const SUMMARY_TAB_NAME  = 'DASHBOARD_SUMMARY';

  // ── KPI KEY → HTML Element ID map ────────────────────────
  // KEY must match Column A values in your DASHBOARD_SUMMARY sheet
  const KPI_MAP = {
    STOCK_VALUE  : { id: 'kpi-stock-value',  prefix: '₹', format: 'currency' },
    TOTAL_SKUS   : { id: 'kpi-total-skus',   prefix: '',  format: 'number'   },
    LOW_STOCK    : { id: 'kpi-low-stock',    prefix: '',  format: 'number'   },
    OUT_OF_STOCK : { id: 'kpi-out-of-stock', prefix: '',  format: 'number'   },
    PURCHASE_MTD : { id: 'kpi-purchase-mtd', prefix: '₹', format: 'currency' },
    ISSUES_MTD   : { id: 'kpi-issues-mtd',   prefix: '₹', format: 'currency' },
    KITCHEN_TODAY: { id: 'kpi-kitchen-today',prefix: '₹', format: 'currency' },
    BAR_TODAY    : { id: 'kpi-bar-today',    prefix: '₹', format: 'currency' },
    LAST_SYNC    : { id: 'sync-time',        prefix: '',  format: 'text'     },
  };

  // ── FORMAT helpers ────────────────────────────────────────
  function formatCurrency(val) {
    const n = parseFloat(val) || 0;
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000)   return '₹' + (n / 100000).toFixed(2) + ' L';
    if (n >= 1000)     return '₹' + (n / 1000).toFixed(1) + 'K';
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0 });
  }

  function formatNumber(val) {
    const n = parseInt(val) || 0;
    return n.toLocaleString('en-IN');
  }

  // ── SET element text safely ───────────────────────────────
  function setEl(id, text) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      // Animate — flash green briefly
      el.style.transition = 'color 0.4s';
      el.style.color = 'var(--green, #059669)';
      setTimeout(() => { el.style.color = ''; }, 1200);
    }
  }

  // ── FETCH CSV from published Google Sheet ─────────────────
  async function fetchSummaryCSV() {
    const url = `https://docs.google.com/spreadsheets/d/${SUMMARY_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SUMMARY_TAB_NAME)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } catch (e) {
      console.error('[DashboardLoader] Fetch failed:', e);
      return null;
    }
  }

  // ── PARSE CSV → key/value object ─────────────────────────
  function parseCSV(text) {
    const result = {};
    const lines = text.trim().split('\n');
    // Skip header row (row 1 = KEY,VALUE,LABEL,UNIT)
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
      const key  = (cols[0] || '').toUpperCase();
      const val  = cols[1] || '';
      if (key) result[key] = val;
    }
    return result;
  }

  // ── SHOW loading state ────────────────────────────────────
  function showLoading() {
    Object.values(KPI_MAP).forEach(cfg => {
      const el = document.getElementById(cfg.id);
      if (el) { el.textContent = '...'; el.style.opacity = '0.5'; }
    });
  }

  // ── HIDE loading state ────────────────────────────────────
  function hideLoading() {
    Object.values(KPI_MAP).forEach(cfg => {
      const el = document.getElementById(cfg.id);
      if (el) el.style.opacity = '1';
    });
  }

  // ── MAIN LOAD function — call this on page load ───────────
  async function load() {
    showLoading();

    const csv = await fetchSummaryCSV();
    if (!csv) {
      hideLoading();
      // Show error badge
      const syncEl = document.getElementById('syncTxt');
      if (syncEl) syncEl.textContent = 'Sheet Error — Check ID';
      console.warn('[DashboardLoader] Could not load summary sheet.');
      return;
    }

    const data = parseCSV(csv);
    console.log('[DashboardLoader] Loaded:', data);

    // Fill each KPI card
    Object.entries(KPI_MAP).forEach(([key, cfg]) => {
      const raw = data[key];
      if (raw === undefined) return;

      let display = raw;
      if (cfg.format === 'currency') display = formatCurrency(raw);
      else if (cfg.format === 'number') display = formatNumber(raw);
      else display = raw; // text / datetime

      setEl(cfg.id, display);
    });

    hideLoading();

    // Update sync badge
    const syncEl = document.getElementById('syncTxt');
    if (syncEl) syncEl.textContent = 'Connected · Google Sheet';

    const dbBadge = document.getElementById('db-count-badge');
    if (dbBadge) dbBadge.textContent = '📊 Live Data';

    // Update low stock badge in sidebar
    const lowBadge = document.getElementById('nb-low');
    if (lowBadge && data['LOW_STOCK']) lowBadge.textContent = data['LOW_STOCK'];

    console.log('[DashboardLoader] ✅ Dashboard updated from Google Sheet');
  }

  // ── AUTO REFRESH every 5 minutes ─────────────────────────
  function startAutoRefresh(intervalMinutes) {
    const ms = (intervalMinutes || 5) * 60 * 1000;
    setInterval(load, ms);
    console.log(`[DashboardLoader] Auto-refresh every ${intervalMinutes || 5} min`);
  }

  return { load, startAutoRefresh, KPI_MAP };

})();

// ── AUTO-RUN when DOM is ready ────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  DashboardLoader.load();
  DashboardLoader.startAutoRefresh(5); // refresh every 5 minutes
});
