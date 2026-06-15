/* ═══════════════════════════════════════════════════════════════════════════
   BALAJI NEXTGEN ERP — AUTO MODULE LOADER v1.0
   ═══════════════════════════════════════════════════════════════════════════
   SAVE LOCATION : /js/core/auto-module-loader.js
   LOAD ORDER    : AFTER all three engines above

   PURPOSE:
     • Single boot entry point — call AutoModuleLoader.boot() on any page
     • Reads CLIENT_ID → Loads features → Builds menu → Runs AI check
     • Guards page-level module access (redirects if module not enabled)
     • Hides DOM sections tagged [data-module="CRM"] when CRM is disabled
     • Works on EXISTING dashboard pages with zero HTML changes needed
       (just add the 4 script tags + call AutoModuleLoader.boot())

   USAGE — add to bottom of any ERP page's <body>:
     <script>
       AutoModuleLoader.boot({
         requiredModule: 'SALES',   // null if page is always accessible
         redirectTo: 'dashboard.html' // where to go if module disabled
       });
     </script>
═══════════════════════════════════════════════════════════════════════════ */

const AutoModuleLoader = (function () {

  // ─────────────────────────────────────────────────────────────────────
  // BOOT
  // ─────────────────────────────────────────────────────────────────────
  async function boot(options = {}) {
    const {
      requiredModule = null,
      redirectTo     = null,
      skipMenu       = false,
      skipAICheck    = false,
    } = options;

    _showLoading();

    // 1. Load features
    let features;
    try {
      features = await FeatureLoader.init();
    } catch(e) {
      console.error('[AutoLoader] Feature load failed:', e);
      _hideLoading();
      return;
    }

    // 2. Guard page access
    if (requiredModule && !FeatureLoader.isEnabled(requiredModule)) {
      console.warn(`[AutoLoader] Module "${requiredModule}" not enabled — redirecting`);
      const dest = redirectTo || _resolveRoot() + 'Dashboard/dashboard.html';
      window.location.href = dest;
      return;
    }

    // 3. Build dynamic menu
    if (!skipMenu) {
      DynamicMenuEngine.build();
    }

    // 4. Hide disabled sections in current page DOM
    _applyDomGuards(features);

    // 5. Inject level badge in topbar if element exists
    _injectLevelBadge(features);

    _hideLoading();

    // 6. Trigger AI check (non-blocking)
    if (!skipAICheck && typeof AIUpgradeEngine !== 'undefined') {
      AIUpgradeEngine.runCheck({ silent: false });
    }

    // 7. Fire ready event
    document.dispatchEvent(new CustomEvent('erp:moduleLoaderReady', { detail: features }));
    console.log('[AutoLoader] Boot complete. Level:', features.erpLevel, '| Type:', features.clientType);
  }

  // ─────────────────────────────────────────────────────────────────────
  // DOM GUARDS — hide elements tagged [data-module="..."]
  // ─────────────────────────────────────────────────────────────────────
  function _applyDomGuards(features) {
    const modules = features.modules || {};

    // Hide elements with [data-module="CRM"] if CRM is disabled
    document.querySelectorAll('[data-module]').forEach(el => {
      const mod = el.getAttribute('data-module').toUpperCase();
      if (!modules[mod]) {
        el.style.display = 'none';
        el.setAttribute('data-hidden-by-loader', '1');
      }
    });

    // Hide elements with [data-min-level="ADVANCED"] if below that level
    const LEVELS   = ['BASIC','STANDARD','ADVANCED','ENTERPRISE'];
    const userLevel = LEVELS.indexOf(features.erpLevel || 'BASIC');
    document.querySelectorAll('[data-min-level]').forEach(el => {
      const minLevel = LEVELS.indexOf(el.getAttribute('data-min-level').toUpperCase());
      if (userLevel < minLevel) {
        el.style.display = 'none';
        el.setAttribute('data-hidden-by-loader', '1');
      }
    });

    // Show elements with [data-module="NONE"] always (utility tag)
    document.querySelectorAll('[data-module="NONE"]').forEach(el => {
      el.style.display = '';
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // LEVEL BADGE in topbar
  // ─────────────────────────────────────────────────────────────────────
  function _injectLevelBadge(features) {
    const el = document.getElementById('erpLevelBadge') || document.querySelector('.erp-level-badge');
    if (!el) return;
    const colors = { BASIC:'#607d8b', STANDARD:'#1565c0', ADVANCED:'#2e7d32', ENTERPRISE:'#6a1b9a' };
    const level  = features.erpLevel || 'BASIC';
    el.textContent = level;
    el.style.background    = colors[level] || '#607d8b';
    el.style.color         = '#fff';
    el.style.padding       = '2px 8px';
    el.style.borderRadius  = '4px';
    el.style.fontSize      = '.72rem';
    el.style.fontWeight    = '700';
    el.style.letterSpacing = '.05em';
  }

  // ─────────────────────────────────────────────────────────────────────
  // Loading overlay
  // ─────────────────────────────────────────────────────────────────────
  function _showLoading() {
    if (document.getElementById('erp-loader-overlay')) return;
    const el = document.createElement('div');
    el.id    = 'erp-loader-overlay';
    el.innerHTML = `<div class="erp-loader-spinner"></div><div class="erp-loader-text">Loading modules…</div>`;
    const style  = document.createElement('style');
    style.textContent = `
      #erp-loader-overlay { position:fixed; inset:0; background:rgba(10,10,30,.55); z-index:88888; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; backdrop-filter:blur(2px); }
      .erp-loader-spinner { width:40px; height:40px; border:4px solid rgba(255,255,255,.2); border-top-color:#fff; border-radius:50%; animation:erp-spin .8s linear infinite; }
      .erp-loader-text    { color:#fff; font-size:.9rem; letter-spacing:.04em; }
      @keyframes erp-spin { to { transform:rotate(360deg); } }
    `;
    document.head.appendChild(style);
    document.body.appendChild(el);
  }

  function _hideLoading() {
    const el = document.getElementById('erp-loader-overlay');
    if (el) el.remove();
  }

  function _resolveRoot() {
    const depth = window.location.pathname.split('/').length - 2;
    return depth > 0 ? '../'.repeat(depth) : './';
  }

  // ── Utility: check a module from any page ────────────────────────────
  function isEnabled(moduleName) {
    return FeatureLoader.isEnabled(moduleName);
  }

  function getLevel() {
    return FeatureLoader.getLevel();
  }

  return { boot, isEnabled, getLevel };

})();

window.AutoModuleLoader = AutoModuleLoader;
