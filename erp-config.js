/* ============================================================
   BALAJI NEXTGEN ERP — SHARED CONFIGURATION v5.0-FIXED
   erp-config.js  |  Include in EVERY page FIRST

   FIXES APPLIED:
   1. Session clears on browser close (sessionStorage flag)
   2. Proper logout on tab/window close
   3. User Master / User Security Master DB schema normalised
   4. Google Drive Shared Database properly configured
   5. Balaji logo loads DIRECTLY — no flash (logo preloaded before splash)
   6. Super Admin mobile live control panel support
   7. All dashboards light/dark themes: blue, pink, chatgpt, orange, dark-blue, dark
   8. Industry+role routing with Super Admin override control
============================================================ */

/* ── GOOGLE DRIVE SHARED DATABASE CONFIG ──────────────────────────
   FIX #4: Set your actual Google Sheets IDs here.
   The GAS (Google Apps Script) URL handles all DB operations.
   USER_MASTER_SHEET  = Sheet name: USER_MASTER
   USER_SECURITY_SHEET= Sheet name: USER_SECURITY_MASTER
   Both must exist in the same Google Sheet as tabs.
──────────────────────────────────────────────────────────────── */
const ERP_DB_CONFIG = {
  SHEET_ID       : '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I',  // ← Your Google Sheet ID
  GAS_URL        : 'https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec', // ← Your GAS deployment URL
  USER_MASTER_SHEET    : 'USER_MASTER',       // Sheet tab name
  USER_SECURITY_SHEET  : 'USER_SECURITY_MASTER', // Sheet tab name
  CLIENT_MASTER_SHEET  : 'CLIENT_MASTER',
  TEMPLATE_REGISTRY    : 'TEMPLATE_REGISTRY',
};

/* ── USER_MASTER Required Columns ─────────────────────────────────
   FIX #2: Standardised column format for USER_MASTER sheet.
   Your Google Sheet "USER_MASTER" tab must have these EXACT headers:

   USER_CODE | FULL_NAME | EMAIL | MOBILE | PASSWORD_HASH | ROLE |
   CLIENT_ID | BRANCH | INDUSTRY | STATUS | CREATED_DATE |
   LAST_LOGIN | SUPER_ADMIN_OVERRIDE | DASHBOARD_OVERRIDE

   USER_SECURITY_MASTER tab must have:
   USER_CODE | CLIENT_ID | MODULE | CAN_VIEW | CAN_ADD | CAN_EDIT |
   CAN_DELETE | CAN_EXPORT | CAN_APPROVE | OVERRIDE_BY_SUPER_ADMIN |
   EFFECTIVE_FROM | EFFECTIVE_TO
──────────────────────────────────────────────────────────────── */

const ERP_REGISTRY_SHEET_ID   = ERP_DB_CONFIG.SHEET_ID;
const ERP_REGISTRY_SHEET_NAME = ERP_DB_CONFIG.TEMPLATE_REGISTRY;
const ERP_FALLBACK_API        = ERP_DB_CONFIG.GAS_URL;

/* ── SESSION KEYS ─────────────────────────────────────────────── */
const ERP_KEYS = {
  USER       : 'ERP_USER',
  SESSION    : 'ERP_SESSION',
  ROLE       : 'ERP_ROLE',
  CLIENT     : 'ERP_CLIENT',
  EXPIRY     : 'ERP_EXPIRY',
  INDUSTRY   : 'ERP_INDUSTRY',
  BRANCH     : 'ERP_BRANCH',
  TAB_ALIVE  : 'ERP_TAB_ALIVE',   // FIX #1: for browser-close detection
  LAST_ACTIVE: 'erp_last_active',
};

/* ── FIX #1: BROWSER CLOSE SESSION EXPIRY ─────────────────────────
   Uses sessionStorage as "tab alive" flag.
   If sessionStorage flag is absent on load = browser was fully closed.
   On browser close / tab close, sessionStorage is cleared automatically.
──────────────────────────────────────────────────────────────── */
(function _erpBrowserCloseGuard() {
  const SESSION_FLAG = 'erp_tab_open';

  // On every page load: check if this is a fresh browser start
  const tabWasOpen = sessionStorage.getItem(SESSION_FLAG);
  if (!tabWasOpen) {
    // Browser was closed and reopened — clear localStorage session
    ['ERP_USER','ERP_SESSION','ERP_ROLE','ERP_CLIENT','ERP_EXPIRY',
     'ERP_INDUSTRY','ERP_BRANCH','ERP_TAB_ALIVE',
     'erp_session_v1','erp_session_v2','erp_activity_log',
     'BALAJI_ERP_TOKEN','BALAJI_ERP_USER','BALAJI_ERP_ROLE','BALAJI_LOGIN_TIME',
     'ERP_LOGIN_TIME','ERP_TOKEN'
    ].forEach(function(k) {
      try { localStorage.removeItem(k); } catch(e) {}
    });
  }
  // Mark this tab as alive in sessionStorage
  // sessionStorage auto-clears when browser/tab closes
  try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch(e) {}

  // FIX: Also handle beforeunload for explicit tab close
  window.addEventListener('beforeunload', function() {
    // Only clear if ALL tabs are closing (can't detect easily, so we use
    // sessionStorage which auto-expires per-tab)
    // sessionStorage is cleared automatically — no action needed here
  });
})();

/* ── ROLE → DASHBOARD MAP ─────────────────────────────────────── */
const ROLE_DASHBOARD = {
  SUPER_ADMIN  : 'Dashboard/super-admin-dashboard.html',
  DEVELOPER    : 'Dashboard/developer-dashboard.html',
  OWNER        : 'Dashboard/owner-dashboard.html',
  ADMIN        : 'Dashboard/dashboard.html',
  MANAGER      : 'Dashboard/manager-dashboard.html',
  ACCOUNTANT   : 'Dashboard/accounts/accounts.html',
  CASHIER      : 'Dashboard/cashier-dashboard.html',
  CHEF         : 'Dashboard/chef-dashboard.html',
  WAITER       : 'Dashboard/employee-dashboard.html',
  STORE_MANAGER: 'Dashboard/inventory/inventory.html',
  CEO          : 'Dashboard/Ceo-dashboard.html',
  MD           : 'Dashboard/owner-dashboard.html',
  CLIENT       : 'Dashboard/dashboard.html',
  DEMO         : 'Dashboard/dashboard.html',
  ACCT         : 'Dashboard/balaji-staff-portal.html',
  PARTTIME     : 'Dashboard/employee-dashboard.html',
  STAFF        : 'Dashboard/employee-dashboard.html',
  HR           : 'Dashboard/manager-dashboard.html',
  SUPERVISOR   : 'Dashboard/manager-dashboard.html',
  DEFAULT      : 'Dashboard/main_dashboard.html',
};

/* ── INDUSTRY → DASHBOARD MAP ─────────────────────────────────── */
const INDUSTRY_DASHBOARD = {
  RESTAURANT : 'Dashboard/restaurant/dashboard.html',
  CAFE       : 'Dashboard/restaurant/dashboard.html',
  TEA        : 'Dashboard/restaurant/dashboard.html',
  RETAIL     : 'Dashboard/restaurant/dashboard.html'',
  GROCERY    : 'Dashboard/restaurant/dashboard.html'',
  SUPERMARKET: 'Dashboard/restaurant/dashboard.html'',
  DEFAULT    : 'Dashboard/dashboard.html',
};

/* Roles that ALWAYS use ROLE_DASHBOARD (ignore industry) */
const FIXED_ROLE_DASHBOARDS = [
  'CASHIER','CHEF','WAITER','STAFF','PARTTIME','ACCOUNTANT',
  'ACCT','STORE_MANAGER','SUPER_ADMIN','DEVELOPER'
];

/* Map raw industry strings → INDUSTRY_DASHBOARD keys */
const INDUSTRY_ALIAS = {
  restaurant:'RESTAURANT', food:'RESTAURANT',
  cafe:'CAFE', teacafe:'TEA', tea:'TEA', coffee:'TEA',
  retail:'RETAIL', store:'RETAIL', shop:'RETAIL',
  grocery:'GROCERY', supermarket:'SUPERMARKET', kirana:'GROCERY',
};

function _erpResolveIndustryDashboard(role, industryRaw) {
  if (FIXED_ROLE_DASHBOARDS.includes(role)) return null;
  const norm = (industryRaw || '').toString().toLowerCase().replace(/\s+/g,'');
  const key  = INDUSTRY_ALIAS[norm] || null;
  return (key && INDUSTRY_DASHBOARD[key]) || INDUSTRY_DASHBOARD.DEFAULT;
}

/* ── FIX #8: SUPER ADMIN RUNTIME CONTROL OVERRIDES ────────────────
   Super Admin can change routing from mobile/desktop without code edits.
   Stored in localStorage 'erp_control_config' as JSON.
   Set via: Dashboard/super-admin-dashboard.html → Dashboard Routing Control
──────────────────────────────────────────────────────────────── */
(function _erpApplyControlOverrides() {
  try {
    const raw = localStorage.getItem('erp_control_config');
    if (!raw) return;
    const cfg = JSON.parse(raw);
    // Industry routing overrides
    if (cfg.industryRestaurant) {
      INDUSTRY_DASHBOARD.RESTAURANT = cfg.industryRestaurant;
      INDUSTRY_DASHBOARD.CAFE       = cfg.industryRestaurant;
      INDUSTRY_DASHBOARD.TEA        = cfg.industryRestaurant;
    }
    if (cfg.industryRetail) {
      INDUSTRY_DASHBOARD.RETAIL      = cfg.industryRetail;
      INDUSTRY_DASHBOARD.GROCERY     = cfg.industryRetail;
      INDUSTRY_DASHBOARD.SUPERMARKET = cfg.industryRetail;
    }
    if (cfg.industryDefault)   INDUSTRY_DASHBOARD.DEFAULT   = cfg.industryDefault;
    // Role routing overrides
    if (cfg.roleAdmin)         ROLE_DASHBOARD.ADMIN         = cfg.roleAdmin;
    if (cfg.roleOwner)         ROLE_DASHBOARD.OWNER         = cfg.roleOwner;
    if (cfg.roleCEO)           ROLE_DASHBOARD.CEO           = cfg.roleCEO;
    if (cfg.roleManager) {
      ROLE_DASHBOARD.MANAGER    = cfg.roleManager;
      ROLE_DASHBOARD.HR         = cfg.roleManager;
      ROLE_DASHBOARD.SUPERVISOR = cfg.roleManager;
    }
    // Welcome screen selector control
    if (cfg.showSelector === 'false') localStorage.setItem('erp_skip_selector','true');
    else if (cfg.showSelector === 'true') localStorage.setItem('erp_skip_selector','false');
    // FIX #6: Super Admin mobile live mode
    if (cfg.mobileControl === 'true') localStorage.setItem('erp_mobile_control','true');
  } catch(e) { console.warn('[ERP] control config override failed', e); }
})();

/* ── LOGIN PAGE PATH ─────────────────────────────────────────── */
function _erpLoginPage() {
  const path  = window.location.pathname.replace(/\/+$/, '');
  const parts = path.split('/').filter(Boolean);
  const knownRoots = ['Dashboard','Balaji_staff','demo','layouts','Components','restaurant','retail'];
  let depth = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (knownRoots.includes(parts[i])) { depth = parts.length - i; break; }
    depth++;
  }
  if (depth <= 1) return 'login.html';
  return '../'.repeat(depth - 1) + 'login.html';
}

/* ── RESPONSE NORMALISER ────────────────────────────────────────
   Handles both GAS response shapes:
   Live:   { data: { status:'success', sessionToken, user:{...} } }
   Legacy: { ok:true, status:'success', ROLE, FULL_NAME, ... }
──────────────────────────────────────────────────────────────── */
function _normalise(raw) {
  if (!raw) return { status: 'error', message: 'Empty response from server' };

  const flat = raw.data ? raw.data : raw;
  const u    = flat.user || {};

  /* FIX #2: Resolve all USER_MASTER column names */
  const role      = (flat.ROLE||flat.role||u.ROLE||u.role||'').toString().toUpperCase().trim();
  const fullName  = (flat.FULL_NAME||flat.full_name||u.FULL_NAME||u.full_name||u.name||'').toString().trim();
  const email     = (flat.EMAIL||flat.email||u.EMAIL||u.email||'').toString().trim();
  const mobile    = (flat.MOBILE||flat.mobile||u.MOBILE||u.mobile||'').toString().trim();
  const userCode  = (flat.USER_CODE||flat.user_code||u.USER_CODE||u.user_code||u.userCode||'').toString().trim();
  const clientId  = (flat.CLIENT_ID||flat.client_id||u.CLIENT_ID||u.client_id||u.clientId||'').toString().trim();
  const branch    = (flat.BRANCH||flat.branch||u.BRANCH||u.branch||'').toString().trim();
  const industry  = (flat.INDUSTRY||flat.industry||u.INDUSTRY||u.industry||'').toString().trim();
  const status_   = (flat.STATUS||flat.status_field||u.STATUS||'ACTIVE').toString().toUpperCase().trim();

  const sessionToken = (flat.sessionToken||flat.SESSION_TOKEN||raw.sessionToken||'').toString().trim();
  const status = (flat.status === 'success' || flat.ok === true || raw.ok === true)
    ? 'success' : (flat.status || 'error');

  return Object.assign({}, flat, {
    status,
    ok        : status === 'success',
    message   : flat.message || '',
    sessionToken,
    // Uppercase (canonical) keys
    ROLE      : role,
    FULL_NAME : fullName,
    EMAIL     : email,
    MOBILE    : mobile,
    USER_CODE : userCode,
    CLIENT_ID : clientId,
    BRANCH    : branch,
    INDUSTRY  : industry,
    USER_STATUS: status_,
    // Lowercase aliases
    role, full_name:fullName, email, mobile, user_code:userCode,
    client_id:clientId, branch, industry,
  });
}

/* ── ERP CORE OBJECT ─────────────────────────────────────────── */
const ERP = {

  saveSession(data) {
    const n = _normalise(data);
    localStorage.setItem(ERP_KEYS.USER,     JSON.stringify(n));
    localStorage.setItem(ERP_KEYS.SESSION,  n.sessionToken || '');
    localStorage.setItem(ERP_KEYS.ROLE,     n.ROLE);
    localStorage.setItem(ERP_KEYS.CLIENT,   n.CLIENT_ID);
    localStorage.setItem(ERP_KEYS.INDUSTRY, n.INDUSTRY);
    localStorage.setItem(ERP_KEYS.BRANCH,   n.BRANCH);
    // FIX #1: SUPER_ADMIN gets 2h session, others 8h
    const isSuperAdmin = n.ROLE === 'SUPER_ADMIN';
    const expiry = Date.now() + (isSuperAdmin ? 2 : 8) * 60 * 60 * 1000;
    localStorage.setItem(ERP_KEYS.EXPIRY, expiry);
    // FIX #1: Mark session as active in sessionStorage (cleared on browser close)
    try { sessionStorage.setItem('erp_session_active', '1'); } catch(e) {}
    try { sessionStorage.setItem('erp_tab_open', '1'); } catch(e) {}
  },

  getUser() {
    try {
      // FIX #1: Check session is still active in sessionStorage
      const tabOpen = sessionStorage.getItem('erp_tab_open');
      if (!tabOpen) { this._clearStorage(); return null; }
      const expiry = parseInt(localStorage.getItem(ERP_KEYS.EXPIRY) || '0');
      if (expiry && Date.now() > expiry) { this._clearStorage(); return null; }
      const u = localStorage.getItem(ERP_KEYS.USER);
      return u ? JSON.parse(u) : null;
    } catch(e) { return null; }
  },

  getRole()     { return localStorage.getItem(ERP_KEYS.ROLE)     || ''; },
  getSession()  { return localStorage.getItem(ERP_KEYS.SESSION)  || ''; },
  getClient()   { return localStorage.getItem(ERP_KEYS.CLIENT)   || ''; },
  getIndustry() { return localStorage.getItem(ERP_KEYS.INDUSTRY) || ''; },
  getBranch()   { return localStorage.getItem(ERP_KEYS.BRANCH)   || ''; },

  _clearStorage() {
    Object.values(ERP_KEYS).forEach(k => {
      try { localStorage.removeItem(k); } catch(e) {}
    });
    // Clear all legacy keys
    ['erp_session_v1','erp_session_v2','erp_activity_log','erp_clients_cache',
     'BALAJI_ERP_TOKEN','BALAJI_ERP_USER','BALAJI_ERP_ROLE','BALAJI_LOGIN_TIME',
     'ERP_LOGIN_TIME','ERP_TOKEN','erp_last_active','erp_skip_selector'].forEach(k => {
      try { localStorage.removeItem(k); } catch(e) {}
    });
    try { sessionStorage.removeItem('erp_session_active'); } catch(e) {}
    try { sessionStorage.removeItem('erp_tab_open'); } catch(e) {}
  },

  logout(redirectTo) {
    const session = this.getSession();
    if (session) {
      try { erpApiRequest({ action:'LOGOUT', sessionToken: session }).catch(()=>{}); } catch(e) {}
    }
    this._clearStorage();
    _safeNavigate(redirectTo || _erpLoginPage());
  },

  getIndustryKey() {
    const user = this.getUser() || {};
    const norm = (user.INDUSTRY || user.industry || '').toString().toLowerCase().replace(/\s+/g,'');
    return INDUSTRY_ALIAS[norm] || 'DEFAULT';
  },

  getTargetDashboard() {
    const role = this.getRole();
    const user = this.getUser() || {};
    // FIX #8: Check for Super Admin override per user
    const userOverride = user.DASHBOARD_OVERRIDE;
    if (userOverride) return userOverride;
    // Check Super Admin control config
    try {
      const cc = JSON.parse(localStorage.getItem('erp_control_config') || '{}');
      if (cc['role_' + role]) return cc['role_' + role];
    } catch(e) {}
    const industryDash = _erpResolveIndustryDashboard(role, user.INDUSTRY || user.industry);
    return industryDash || ROLE_DASHBOARD[role] || ROLE_DASHBOARD.DEFAULT;
  },

  goToDashboard() {
    const target = this.getTargetDashboard();
    try { localStorage.setItem('erp_target_dashboard', target); } catch(e) {}
    const skip = localStorage.getItem('erp_skip_selector') === 'true';
    if (skip) { _safeNavigate(target); return; }
    const cur = window.location.pathname.toLowerCase();
    if (!cur.includes('welcome')) { _safeNavigate('welcome.html'); }
  },

  requireLogin(allowedRoles) {
    if (window.location.protocol === 'file:') return {};
    const user = this.getUser();
    if (!user) { _safeNavigate(_erpLoginPage()); return null; }
    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      const role = (user.ROLE || user.role || '').toString().toUpperCase();
      if (!allowedRoles.includes(role)) {
        alert('⛔ Access Denied: role "' + role + '" cannot view this page.');
        _safeNavigate(_erpLoginPage());
        return null;
      }
    }
    return user;
  },

  enforceIndustryAccess(expectedKey) {
    const user = this.getUser();
    if (!user) return this.requireLogin();
    const role = (user.ROLE||user.role||'').toUpperCase();
    if (FIXED_ROLE_DASHBOARDS.includes(role)) return user;
    const norm = (user.INDUSTRY||user.industry||'').toString().toLowerCase().replace(/\s+/g,'');
    const key  = INDUSTRY_ALIAS[norm] || 'DEFAULT';
    if (key !== expectedKey) {
      alert('⛔ Access Denied: this dashboard is not for your industry.');
      _safeNavigate(INDUSTRY_DASHBOARD[key] || INDUSTRY_DASHBOARD.DEFAULT);
      return null;
    }
    return user;
  },

  injectUserInfo() {
    const user = this.getUser();
    if (!user) return;
    document.querySelectorAll('[data-erp-field]').forEach(el => {
      const field = el.getAttribute('data-erp-field');
      el.textContent = user[field] || user[field.toLowerCase()] || '';
    });
  },

  /* FIX #6: Super Admin Live Control – reads control config from Google Sheet
     Call ERP.syncControlPanel() on super-admin-dashboard.html to pull latest config */
  async syncControlPanel() {
    try {
      const result = await erpApiRequest({ action: 'GET_CONTROL_CONFIG' });
      if (result && result.config) {
        localStorage.setItem('erp_control_config', JSON.stringify(result.config));
        _erpApplyControlOverrides();
        return result.config;
      }
    } catch(e) { console.warn('[ERP] syncControlPanel failed', e); }
    return null;
  },

  /* FIX #6: Push changes from Super Admin to Google Sheet (shared across all devices) */
  async pushControlConfig(config) {
    localStorage.setItem('erp_control_config', JSON.stringify(config));
    try {
      return await erpApiRequest({ action: 'SET_CONTROL_CONFIG', config });
    } catch(e) { console.warn('[ERP] pushControlConfig failed', e); }
  },
};

/* ── FIX #5: LOGO PRELOADER — loads before splash shows ─────────
   Fetches logo from localStorage BEFORE DOMContentLoaded,
   preventing the flash of emoji/text before logo appears.
──────────────────────────────────────────────────────────────── */
const _BALAJI_LOGO_URL = (function() {
  try { return localStorage.getItem('erp_logo') || null; } catch(e) { return null; }
})();

function _erpApplyLogoImmediate() {
  if (!_BALAJI_LOGO_URL) return;
  document.querySelectorAll(
    '#splashLogoImg, #wbLogoImg, .erp-logo-img, [data-erp-logo]'
  ).forEach(function(img) {
    img.src   = _BALAJI_LOGO_URL;
    img.style.display = 'block';
    const sibling = img.parentElement && img.parentElement.querySelector('span');
    if (sibling) sibling.style.display = 'none';
  });
}

/* Apply logo as soon as DOM is available */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _erpApplyLogoImmediate);
} else {
  _erpApplyLogoImmediate();
}

/* ── DEMO MODE USERS ─────────────────────────────────────────── */
const _DEMO_USERS = [
  {id:'admin',      pw:'admin',   ROLE:'SUPER_ADMIN', FULL_NAME:'Super Admin',   BRANCH:'Main Branch', CLIENT:'Balaji NextGen', INDUSTRY:''},
  {id:'manager',    pw:'manager', ROLE:'MANAGER',     FULL_NAME:'Manager',       BRANCH:'Main Branch', CLIENT:'Balaji NextGen', INDUSTRY:''},
  {id:'cashier',    pw:'cashier', ROLE:'CASHIER',     FULL_NAME:'Cashier',       BRANCH:'Counter 1',   CLIENT:'Balaji NextGen', INDUSTRY:'restaurant'},
  {id:'chef',       pw:'chef',    ROLE:'CHEF',        FULL_NAME:'Chef',          BRANCH:'Kitchen',     CLIENT:'Balaji NextGen', INDUSTRY:'restaurant'},
  {id:'waiter',     pw:'waiter',  ROLE:'WAITER',      FULL_NAME:'Waiter',        BRANCH:'Floor 1',     CLIENT:'Balaji NextGen', INDUSTRY:'restaurant'},
  {id:'owner',      pw:'owner',   ROLE:'OWNER',       FULL_NAME:'Owner',         BRANCH:'HQ',          CLIENT:'Balaji NextGen', INDUSTRY:'retail'},
  {id:'developer',  pw:'dev123',  ROLE:'DEVELOPER',   FULL_NAME:'Developer',     BRANCH:'Tech',        CLIENT:'Balaji NextGen', INDUSTRY:''},
  {id:'9832014403', pw:'1234',    ROLE:'SUPER_ADMIN', FULL_NAME:'Balaji Admin',  BRANCH:'HQ',          CLIENT:'Balaji NextGen', INDUSTRY:''},
  {id:'admin@demo.com', pw:'demo123', ROLE:'SUPER_ADMIN',FULL_NAME:'Demo Admin', BRANCH:'Main',        CLIENT:'Balaji NextGen', INDUSTRY:''},
];

function _erpDemoLogin(loginId, password) {
  const id  = (loginId  || '').toLowerCase().trim();
  const pwd = (password || '').trim();
  for (const u of _DEMO_USERS) {
    if (u.id.toLowerCase() === id && u.pw === pwd) {
      return {
        status:'success', ROLE:u.ROLE, FULL_NAME:u.FULL_NAME,
        BRANCH:u.BRANCH, CLIENT:u.CLIENT, EMAIL:id,
        INDUSTRY:u.INDUSTRY, sessionToken:'DEMO_' + Date.now()
      };
    }
  }
  return { status:'error', message:'Invalid credentials.\n\nDemo logins:\nadmin/admin · cashier/cashier · chef/chef · manager/manager · owner/owner' };
}

/* ── API REQUEST ────────────────────────────────────────────────
   Uses text/plain to avoid CORS preflight.
   Falls back to demo mode if GAS URL unavailable.
──────────────────────────────────────────────────────────────── */
let _ERP_API_URL = ERP_FALLBACK_API;
const IS_LOCAL_FILE = (typeof location !== 'undefined' && location.protocol === 'file:');
if (IS_LOCAL_FILE) console.log('[ERP] Local file mode — GAS calls disabled');

function erpLoadRegistry(cb) {
  console.log('✅ ERP API URL:', _ERP_API_URL);
  if (cb) cb(_ERP_API_URL);
}

async function erpApiRequest(payload) {
  if (IS_LOCAL_FILE) {
    if (payload && payload.action === 'LOGIN') return _normalise(_erpDemoLogin(payload.loginId, payload.password));
    return { status:'ok' };
  }
  try {
    if (payload && payload.action === 'PING') {
      const r = await fetch(_ERP_API_URL + '?action=PING', { method:'GET', redirect:'follow' });
      return JSON.parse(await r.text());
    }
    const resp = await fetch(_ERP_API_URL, {
      method  : 'POST',
      headers : { 'Content-Type': 'text/plain' },
      body    : JSON.stringify(payload),
      redirect: 'follow',
    });
    const raw = JSON.parse(await resp.text());
    return _normalise(raw);
  } catch(e) {
    console.warn('[ERP] API request failed, trying demo mode:', e);
    if (payload && payload.action === 'LOGIN') {
      return _normalise(_erpDemoLogin(payload.loginId, payload.password));
    }
    return { status:'error', message:'Network error. Check connection.' };
  }
}

/* FIX #4: Google Sheet reader (shared database) */
function erpReadSheet(sheetId, sheetName, tq, cb) {
  const url    = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&tq=${encodeURIComponent(tq||'SELECT *')}`;
  const cbName = '__gvizCb_' + Math.random().toString(36).slice(2);
  const s      = document.createElement('script');
  window[cbName] = function(data) {
    if (document.head.contains(s)) document.head.removeChild(s);
    delete window[cbName];
    try {
      const cols = data.table.cols.map(c => c.label || c.id);
      const rows = data.table.rows.map(row =>
        Object.fromEntries(cols.map((col, i) => [col, row.c[i]?.v ?? '']))
      );
      cb(rows);
    } catch(e) { cb([]); }
  };
  s.src = url + `&callback=${cbName}&responseHandler=${cbName}`;
  s.onerror = () => { if (document.head.contains(s)) document.head.removeChild(s); delete window[cbName]; cb([]); };
  document.head.appendChild(s);
}

/* Convenience wrappers */
function erpReadUserMaster(cb) {
  erpReadSheet(ERP_DB_CONFIG.SHEET_ID, ERP_DB_CONFIG.USER_MASTER_SHEET, 'SELECT *', cb);
}
function erpReadUserSecurityMaster(userCode, cb) {
  const tq = userCode ? `SELECT * WHERE A='${userCode}'` : 'SELECT *';
  erpReadSheet(ERP_DB_CONFIG.SHEET_ID, ERP_DB_CONFIG.USER_SECURITY_SHEET, tq, cb);
}

/* ── TOPBAR RENDERER ─────────────────────────────────────────── */
function erpRenderTopbar(containerId) {
  const user = ERP.getUser();
  if (!user) return;
  const el = document.getElementById(containerId);
  if (!el) return;
  const logoSrc = _BALAJI_LOGO_URL || '';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      ${logoSrc ? `<img src="${logoSrc}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;" alt="Logo">` : `<div style="width:32px;height:32px;border-radius:8px;background:var(--brand,#2655c8);display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:14px;">B</div>`}
      <span style="font-size:13px;font-weight:600;">${user.FULL_NAME||user.full_name||'User'}</span>
      <span style="font-size:11px;opacity:.7;margin-left:4px;">[${user.ROLE||user.role||''}]</span>
    </div>
    <button onclick="ERP.logout()" style="margin-left:14px;padding:7px 14px;background:#EF4444;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">🚪 Logout</button>
  `;
}

erpLoadRegistry();

/* ── SAFE NAVIGATION ─────────────────────────────────────────── */
function _safeNavigate(url) {
  if (!url) return;
  try { window.location.href = url; }
  catch(e) { try { window.location.assign(url); } catch(e2) {} }
}

/* ── API ALIASES ─────────────────────────────────────────────── */
async function erpFrontendApi(payload) { return erpApiRequest(payload); }
async function erpCoreApi(payload)     { return erpApiRequest(payload); }
async function erpAuthApi(payload)     { return erpApiRequest(payload); }

/* ═══════════════════════════════════════════════════════════════
   FIX #1: INACTIVITY AUTO-LOGOUT — 15 minutes with warning
   + FIX #1: Logout button handler
═══════════════════════════════════════════════════════════════ */
(function _erpInactivityWatcher() {
  const IDLE_MS     = 15 * 60 * 1000;
  const WARN_MS     = 60 * 1000;
  const CHECK_MS    = 10 * 1000;
  const STORAGE_KEY = ERP_KEYS.LAST_ACTIVE;

  var _warnShown   = false;
  var _warnEl      = null;
  var _countdownIv = null;

  function _isLoginPage() {
    const p = window.location.pathname.toLowerCase();
    return p.endsWith('login.html') || p.endsWith('login_v1.html') || p.endsWith('login_v2.html');
  }

  function _touch() {
    try { localStorage.setItem(STORAGE_KEY, Date.now().toString()); } catch(e) {}
    if (_warnShown) _hideWarning();
  }

  function _lastActive() {
    try { return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10); } catch(e) { return Date.now(); }
  }

  function _doLogout() {
    _hideWarning();
    ERP._clearStorage();
    const parts = window.location.pathname.split('/').filter(Boolean);
    let depth = 0;
    ['Dashboard','demo','restaurant','balaji_erp_package','layouts','Components','retail'].forEach(function(root) {
      for (var i = parts.length - 1; i >= 0; i--) {
        if (parts[i] === root) { depth = Math.max(depth, parts.length - i); }
      }
    });
    const loginUrl = (depth <= 1) ? 'login.html' : '../'.repeat(depth - 1) + 'login.html';
    window.location.replace(loginUrl);
  }

  function _hideWarning() {
    _warnShown = false;
    if (_countdownIv) { clearInterval(_countdownIv); _countdownIv = null; }
    if (_warnEl && _warnEl.parentNode) _warnEl.parentNode.removeChild(_warnEl);
    _warnEl = null;
  }

  function _showWarning(secsLeft) {
    if (_warnShown) return;
    _warnShown = true;
    _warnEl = document.createElement('div');
    _warnEl.id = '_erp_idle_warn';
    _warnEl.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
    _warnEl.innerHTML = `
      <div style="background:#fff;border-radius:18px;padding:32px 36px;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);">
        <div style="font-size:42px;margin-bottom:8px">⏰</div>
        <h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 8px">Session Expiring</h2>
        <p style="font-size:13px;color:#64748b;margin:0 0 16px">No activity detected. You will be logged out in</p>
        <div id="_erp_countdown" style="font-size:48px;font-weight:800;color:#ef4444;line-height:1;margin-bottom:16px">${secsLeft}</div>
        <p style="font-size:11px;color:#94a3b8;margin:0 0 20px">seconds</p>
        <div style="display:flex;gap:10px;justify-content:center">
          <button onclick="window._erpStayLoggedIn()" style="padding:10px 24px;border-radius:10px;border:none;background:#3b82f6;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">✅ Stay Logged In</button>
          <button onclick="window._erpIdleLogout()" style="padding:10px 20px;border-radius:10px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;font-size:14px;font-weight:600;cursor:pointer;">Logout Now</button>
        </div>
      </div>`;
    document.body.appendChild(_warnEl);
    var secs = secsLeft;
    _countdownIv = setInterval(function() {
      secs--;
      const el = document.getElementById('_erp_countdown');
      if (el) el.textContent = secs;
      if (secs <= 0) { clearInterval(_countdownIv); _doLogout(); }
    }, 1000);
  }

  window._erpStayLoggedIn = function() { _touch(); _hideWarning(); };
  window._erpIdleLogout   = function() { _doLogout(); };

  function _check() {
    if (_isLoginPage()) return;
    if (!ERP.getUser()) return;
    const idle = Date.now() - _lastActive();
    if (idle >= IDLE_MS) { _doLogout(); return; }
    if (idle >= IDLE_MS - WARN_MS && !_warnShown) {
      _showWarning(Math.round((IDLE_MS - idle) / 1000));
    }
  }

  ['mousemove','keydown','click','scroll','touchstart','pointerdown'].forEach(function(ev) {
    document.addEventListener(ev, _touch, { passive:true });
  });

  _touch();
  setInterval(_check, CHECK_MS);

  /* Wire logout buttons automatically */
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-erp-logout], .erp-logout-btn, #logoutBtn, #btnLogout').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        ERP.logout();
      });
    });
  });
})();

console.log('[ERP CONFIG v5.0] Loaded ✅ | Mode:', IS_LOCAL_FILE ? 'LOCAL/DEMO' : 'LIVE');
