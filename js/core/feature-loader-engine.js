/* ═══════════════════════════════════════════════════════════════════════════
   BALAJI NEXTGEN ERP — FEATURE LOADER ENGINE v1.0
   ═══════════════════════════════════════════════════════════════════════════
   SAVE LOCATION : /js/core/feature-loader-engine.js
   LOAD ORDER    : AFTER master-config.js, BEFORE dashboard-bootstrap.js
   
   PURPOSE:
     • Reads logged-in CLIENT_ID from session / localStorage
     • Calls GAS to fetch FEATURE_CONTROL_MASTER row
     • Caches features in window.ERP_FEATURES (session-scoped)
     • Fires 'erp:featuresLoaded' event so all engines can react
   
   USAGE:
     FeatureLoader.init().then(() => { ... });
     FeatureLoader.isEnabled('CRM');            // → true/false
     FeatureLoader.getLevel();                  // → 'STANDARD'
     FeatureLoader.getEnabledModules();         // → ['INVENTORY','SALES',...]
═══════════════════════════════════════════════════════════════════════════ */

const FeatureLoader = (function () {

  // ── Cache key (session storage — cleared on tab close) ────────────────
  const CACHE_KEY     = 'ERP_FEATURES_CACHE';
  const CACHE_TTL_MS  = 5 * 60 * 1000; // 5 minutes

  let _features = null;
  let _loading  = false;
  let _pending  = [];

  // ── Internal: get CLIENT_ID from existing session ─────────────────────
  function _getClientId() {
    // 1. Try window.ERP_SESSION (set by auth-engine.js on login)
    if (window.ERP_SESSION && window.ERP_SESSION.clientId) return window.ERP_SESSION.clientId;
    // 2. Try StorageEngine (existing engine in your codebase)
    if (typeof StorageEngine !== 'undefined') {
      const s = StorageEngine.get('ERP_SESSION');
      if (s) {
        try {
          const parsed = typeof s === 'string' ? JSON.parse(s) : s;
          if (parsed.clientId) return parsed.clientId;
          if (parsed.CLIENT_ID) return parsed.CLIENT_ID;
          if (parsed.companyId) return parsed.companyId;
        } catch(e) {}
      }
    }
    // 3. Try sessionStorage directly
    try {
      const raw = sessionStorage.getItem('ERP_SESSION') || sessionStorage.getItem('erp_session');
      if (raw) {
        const obj = JSON.parse(raw);
        return obj.clientId || obj.CLIENT_ID || obj.companyId || null;
      }
    } catch(e) {}
    // 4. Try localStorage fallback
    try {
      const raw = localStorage.getItem('BALAJI_SESSION') || localStorage.getItem('ERP_SESSION');
      if (raw) {
        const obj = JSON.parse(raw);
        return obj.clientId || obj.CLIENT_ID || obj.companyId || null;
      }
    } catch(e) {}
    return null;
  }

  // ── Internal: get GAS URL ─────────────────────────────────────────────
  function _getGasUrl() {
    if (window.BALAJI_MASTER && window.BALAJI_MASTER.gasUrl) return window.BALAJI_MASTER.gasUrl;
    if (window.ERP_MASTER    && window.ERP_MASTER.gasUrl)    return window.ERP_MASTER.gasUrl;
    if (window.ERP_CONFIG    && window.ERP_CONFIG.apiUrl)    return window.ERP_CONFIG.apiUrl;
    return null;
  }

  // ── Internal: check cache ─────────────────────────────────────────────
  function _fromCache(clientId) {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj.clientId !== clientId) return null;
      if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
      return obj.features;
    } catch(e) { return null; }
  }

  function _toCache(clientId, features) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ clientId, features, ts: Date.now() }));
    } catch(e) {}
  }

  // ── Internal: fetch features from GAS ────────────────────────────────
  function _fetchFromGAS(clientId) {
    const url = _getGasUrl();
    if (!url) return Promise.reject(new Error('GAS URL not configured in master-config.js'));

    return fetch(url, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ action: 'GET_FEATURE_CONTROL', clientId })
    })
    .then(r => r.json())
    .then(data => {
      if (data.status !== 'success') throw new Error(data.message || 'Feature fetch failed');
      return data.features;
    });
  }

  // ── Internal: build offline fallback based on master-config companies ─
  function _buildOfflineFallback(clientId) {
    const companies = (window.BALAJI_MASTER || window.ERP_MASTER || {}).companies || [];
    const company   = companies.find(c => c.id === clientId);
    const type      = (company && company.type) || 'retail';

    const levelMap = {
      small_trader: { level:'BASIC',    mods:['INVENTORY','PURCHASE','SALES'] },
      retail:       { level:'STANDARD', mods:['INVENTORY','PURCHASE','SALES','CRM','FINANCE'] },
      grocery:      { level:'STANDARD', mods:['INVENTORY','PURCHASE','SALES','CRM','FINANCE'] },
      restaurant:   { level:'STANDARD', mods:['INVENTORY','PURCHASE','SALES','RESTAURANT','FINANCE'] },
      distributor:  { level:'ADVANCED', mods:['INVENTORY','PURCHASE','SALES','CRM','HR','FINANCE','WAREHOUSE'] },
      factory:      { level:'ADVANCED', mods:['INVENTORY','PURCHASE','SALES','HR','FINANCE','WAREHOUSE','PRODUCTION'] },
      manufacturing:{ level:'ADVANCED', mods:['INVENTORY','PURCHASE','SALES','HR','FINANCE','WAREHOUSE','PRODUCTION'] },
      enterprise:   { level:'ENTERPRISE',mods:['INVENTORY','PURCHASE','SALES','CRM','HR','FINANCE','WAREHOUSE','PRODUCTION','AI_ANALYTICS'] },
    };

    const cfg  = levelMap[type] || levelMap['retail'];
    const mods = { INVENTORY:false, PURCHASE:false, SALES:false, CRM:false, HR:false, FINANCE:false, WAREHOUSE:false, PRODUCTION:false, RESTAURANT:false, AI_ANALYTICS:false };
    cfg.mods.forEach(m => { mods[m] = true; });

    return {
      clientId,
      clientName: (company && company.name) || clientId,
      clientType: type,
      erpLevel:   cfg.level,
      modules:    mods,
      _offline:   true
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────

  async function init(forceRefresh = false) {
    if (_features && !forceRefresh) return _features;
    if (_loading) {
      return new Promise(res => _pending.push(res));
    }
    _loading = true;

    const clientId = _getClientId();
    if (!clientId) {
      console.warn('[FeatureLoader] No CLIENT_ID in session — using offline fallback');
      _features = _buildOfflineFallback('UNKNOWN');
      window.ERP_FEATURES = _features;
      _resolvePending();
      _loading = false;
      _dispatch();
      return _features;
    }

    // Try cache first
    if (!forceRefresh) {
      const cached = _fromCache(clientId);
      if (cached) {
        _features = cached;
        window.ERP_FEATURES = _features;
        _resolvePending();
        _loading = false;
        _dispatch();
        return _features;
      }
    }

    // Fetch from GAS
    try {
      _features = await _fetchFromGAS(clientId);
      _toCache(clientId, _features);
    } catch (err) {
      console.warn('[FeatureLoader] GAS fetch failed, using offline fallback:', err.message);
      _features = _buildOfflineFallback(clientId);
    }

    window.ERP_FEATURES = _features;
    _resolvePending();
    _loading = false;
    _dispatch();
    return _features;
  }

  function _dispatch() {
    document.dispatchEvent(new CustomEvent('erp:featuresLoaded', { detail: _features }));
  }

  function _resolvePending() {
    _pending.forEach(res => res(_features));
    _pending = [];
  }

  function isEnabled(moduleName) {
    if (!_features) { console.warn('[FeatureLoader] Features not loaded yet. Call init() first.'); return false; }
    return !!(_features.modules && _features.modules[moduleName.toUpperCase()]);
  }

  function getLevel() {
    return _features ? (_features.erpLevel || 'BASIC') : 'BASIC';
  }

  function getClientType() {
    return _features ? (_features.clientType || 'retail') : 'retail';
  }

  function getEnabledModules() {
    if (!_features || !_features.modules) return [];
    return Object.keys(_features.modules).filter(m => _features.modules[m]);
  }

  function getAll() {
    return _features;
  }

  function clearCache() {
    try { sessionStorage.removeItem(CACHE_KEY); } catch(e) {}
    _features = null;
  }

  return { init, isEnabled, getLevel, getClientType, getEnabledModules, getAll, clearCache };

})();

// ── Auto-expose globally ──────────────────────────────────────────────────
window.FeatureLoader = FeatureLoader;
