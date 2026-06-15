/* ═══════════════════════════════════════════════════════════════════════════
   BALAJI NEXTGEN ERP — AI UPGRADE ENGINE v1.0
   ═══════════════════════════════════════════════════════════════════════════
   SAVE LOCATION : /js/core/ai-upgrade-engine.js
   LOAD ORDER    : AFTER feature-loader-engine.js

   PURPOSE:
     • Runs AI upgrade check against GAS backend
     • Shows upgrade notification banners / modals in dashboard
     • Handles auto-refresh of features after upgrade applied
     • Schedules background checks (daily on dashboard load)

   UPGRADE RULES (evaluated on GAS side):
     ┌─────────────────────────────────────────────────────────────┐
     │ Item Count > 500       → Enable Advanced Inventory          │
     │ Monthly Sales > 5 Lakh → Recommend Standard ERP             │
     │ Branch Count > 1       → Enable Multi Location              │
     │ Users > 5              → Enable Role Management             │
     │ Inventory Value > 10L  → Enable Approval Workflow           │
     └─────────────────────────────────────────────────────────────┘
═══════════════════════════════════════════════════════════════════════════ */

const AIUpgradeEngine = (function () {

  const CHECK_INTERVAL_MS  = 24 * 60 * 60 * 1000; // 24 hours
  const LAST_CHECK_KEY     = 'ERP_AI_LAST_CHECK';
  const SUPPRESSED_KEY     = 'ERP_UPGRADE_SUPPRESSED';

  // ── Public: run check ─────────────────────────────────────────────────
  async function runCheck(options = {}) {
    const { force = false, silent = false } = options;

    const clientId = _getClientId();
    if (!clientId) return null;

    if (!force && _checkSuppressed()) {
      console.log('[AIUpgrade] Check suppressed until tomorrow');
      return null;
    }
    if (!force && !_isDue()) {
      console.log('[AIUpgrade] AI check not due yet');
      return null;
    }

    const gasUrl = _getGasUrl();
    if (!gasUrl) {
      console.warn('[AIUpgrade] GAS URL not configured');
      return null;
    }

    try {
      const res = await fetch(gasUrl, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ action: 'RUN_AI_UPGRADE_CHECK', clientId })
      });
      const data = await res.json();
      if (data.status !== 'success') throw new Error(data.message);

      _recordCheck();
      const result = data;

      if (!silent && result.triggers && result.triggers.length > 0) {
        _showUpgradeNotification(result);
      }
      if (result.autoApplied) {
        // Refresh features from GAS
        await FeatureLoader.init(true);
        DynamicMenuEngine.build();
        if (!silent) _showUpgradeSuccessToast(result);
      }
      return result;
    } catch (err) {
      console.warn('[AIUpgrade] Check failed:', err.message);
      return null;
    }
  }

  // ── Show notification banner ──────────────────────────────────────────
  function _showUpgradeNotification(result) {
    // Remove any existing banner
    const old = document.getElementById('erp-upgrade-banner');
    if (old) old.remove();

    const triggers = (result.triggers || []).map(t => `<li>${t.detail}</li>`).join('');
    const newMods  = (result.modulesUpgraded || []).map(m =>
      `<span class="erp-upgrade-badge">${m}</span>`).join(' ');

    const banner = document.createElement('div');
    banner.id    = 'erp-upgrade-banner';
    banner.innerHTML = `
      <div class="erp-upgrade-inner">
        <div class="erp-upgrade-icon">🤖</div>
        <div class="erp-upgrade-body">
          <strong>AI Upgrade Recommendation</strong>
          <p>Based on your business activity, these improvements are available:</p>
          <ul class="erp-upgrade-triggers">${triggers}</ul>
          ${newMods ? `<div class="erp-upgrade-mods">New Modules: ${newMods}</div>` : ''}
          ${result.upgradeRequired && !result.autoApplied
            ? `<div class="erp-upgrade-level">Recommended Level: <strong>${result.recommendedLevel}</strong></div>`
            : '' }
          ${result.autoApplied
            ? `<div class="erp-upgrade-applied">✅ Auto-applied! Your ERP has been upgraded.</div>`
            : '' }
        </div>
        <div class="erp-upgrade-actions">
          ${!result.autoApplied ? `<button class="erp-btn-primary" onclick="AIUpgradeEngine.applyUpgrade()">Apply Now</button>` : ''}
          <button class="erp-btn-ghost" onclick="AIUpgradeEngine.dismissBanner()">Later</button>
          <button class="erp-btn-ghost" onclick="AIUpgradeEngine.suppressForDay()">Don't remind today</button>
        </div>
      </div>`;

    _applyBannerStyles(banner);
    document.body.insertBefore(banner, document.body.firstChild);

    // Store result for applyUpgrade()
    window._pendingUpgradeResult = result;
  }

  function _showUpgradeSuccessToast(result) {
    const toast = document.createElement('div');
    toast.id    = 'erp-upgrade-toast';
    toast.innerHTML = `🚀 ERP upgraded to <strong>${result.recommendedLevel}</strong>! New modules unlocked.`;
    _applyToastStyles(toast);
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 5000);
  }

  // ── Public: manually trigger apply ───────────────────────────────────
  async function applyUpgrade() {
    const r = window._pendingUpgradeResult;
    if (!r) return;
    const gasUrl  = _getGasUrl();
    const clientId = _getClientId();
    if (!gasUrl || !clientId) return;
    try {
      await fetch(gasUrl, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'RUN_AI_UPGRADE_CHECK', clientId, forceApply:true })
      });
      await FeatureLoader.init(true);
      DynamicMenuEngine.build();
      dismissBanner();
      _showUpgradeSuccessToast(r);
    } catch(e) { console.error('[AIUpgrade] Apply failed:', e); }
  }

  function dismissBanner() {
    const b = document.getElementById('erp-upgrade-banner');
    if (b) b.remove();
  }

  function suppressForDay() {
    try { localStorage.setItem(SUPPRESSED_KEY, String(Date.now() + 24 * 3600 * 1000)); } catch(e) {}
    dismissBanner();
  }

  // ── Scheduling helpers ────────────────────────────────────────────────
  function _isDue() {
    try {
      const last = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0');
      return Date.now() - last > CHECK_INTERVAL_MS;
    } catch(e) { return true; }
  }

  function _recordCheck() {
    try { localStorage.setItem(LAST_CHECK_KEY, String(Date.now())); } catch(e) {}
  }

  function _checkSuppressed() {
    try {
      const until = parseInt(localStorage.getItem(SUPPRESSED_KEY) || '0');
      return Date.now() < until;
    } catch(e) { return false; }
  }

  function _getClientId() {
    if (window.ERP_SESSION && window.ERP_SESSION.clientId) return window.ERP_SESSION.clientId;
    try {
      const raw = sessionStorage.getItem('ERP_SESSION');
      if (raw) { const o = JSON.parse(raw); return o.clientId || o.CLIENT_ID || null; }
    } catch(e) {}
    return null;
  }

  function _getGasUrl() {
    return (window.BALAJI_MASTER || window.ERP_MASTER || {}).gasUrl || null;
  }

  // ── Inline styles (no external CSS dependency) ────────────────────────
  function _applyBannerStyles(el) {
    Object.assign(el.style, {
      position:'fixed', top:'0', left:'0', right:'0', zIndex:'99999',
      background:'linear-gradient(135deg,#1a237e,#283593)',
      color:'#fff', padding:'0', fontFamily:'inherit'
    });
    const style = document.createElement('style');
    style.textContent = `
      #erp-upgrade-banner .erp-upgrade-inner { display:flex; align-items:flex-start; gap:16px; padding:14px 20px; flex-wrap:wrap; }
      #erp-upgrade-banner .erp-upgrade-icon  { font-size:32px; flex-shrink:0; }
      #erp-upgrade-banner .erp-upgrade-body  { flex:1; min-width:200px; }
      #erp-upgrade-banner .erp-upgrade-body strong { font-size:1rem; }
      #erp-upgrade-banner .erp-upgrade-body p { margin:4px 0; font-size:.85rem; opacity:.9; }
      #erp-upgrade-banner .erp-upgrade-triggers { margin:4px 0 4px 16px; font-size:.82rem; opacity:.85; }
      #erp-upgrade-banner .erp-upgrade-badge  { background:rgba(255,255,255,.2); border-radius:4px; padding:2px 6px; font-size:.78rem; }
      #erp-upgrade-banner .erp-upgrade-level  { font-size:.85rem; margin-top:4px; }
      #erp-upgrade-banner .erp-upgrade-applied{ color:#a5d6a7; font-weight:600; margin-top:4px; }
      #erp-upgrade-banner .erp-upgrade-actions{ display:flex; flex-direction:column; gap:6px; flex-shrink:0; }
      .erp-btn-primary { background:#fff; color:#1a237e; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-weight:600; font-size:.83rem; }
      .erp-btn-ghost   { background:rgba(255,255,255,.15); color:#fff; border:1px solid rgba(255,255,255,.4); padding:5px 12px; border-radius:6px; cursor:pointer; font-size:.8rem; }
    `;
    document.head.appendChild(style);
  }

  function _applyToastStyles(el) {
    Object.assign(el.style, {
      position:'fixed', bottom:'24px', right:'24px', zIndex:'99999',
      background:'#1b5e20', color:'#fff', padding:'12px 20px',
      borderRadius:'10px', boxShadow:'0 4px 16px rgba(0,0,0,.3)',
      fontFamily:'inherit', fontSize:'.9rem', transition:'opacity .5s'
    });
  }

  // ── Auto-schedule on dashboard load ──────────────────────────────────
  document.addEventListener('erp:featuresLoaded', function () {
    // Delay 3 s after features load so dashboard paints first
    setTimeout(() => runCheck({ silent:false }), 3000);
  });

  return { runCheck, applyUpgrade, dismissBanner, suppressForDay };

})();

window.AIUpgradeEngine = AIUpgradeEngine;
