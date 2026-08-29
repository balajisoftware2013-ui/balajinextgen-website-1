/* ============================================================
   BALAJI NEXTGEN ERP — SHARED CONFIGURATION v4.2-FINAL
   erp-config.js  |  Include in EVERY page FIRST

   v4.1: Unwraps { data:{...} } response shape from live GS
         Normalises lowercase user fields → uppercase keys
         PING uses GET to avoid preflight CORS issues
   v4.2: Added PARTTIME, HR, STAFF roles
         SUPER_ADMIN session = 2hrs (security)
         All other roles = 8hrs
         requireLogin redirects to login page (not history.back)
============================================================ */

const ERP_REGISTRY_SHEET_ID   = '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I';
const ERP_REGISTRY_SHEET_NAME = 'TEMPLATE_REGISTRY';

const ERP_FALLBACK_API = 'https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec';

const ERP_KEYS = {
  USER:    'ERP_USER',
  SESSION: 'ERP_SESSION',
  ROLE:    'ERP_ROLE',
  CLIENT:  'ERP_CLIENT',
  EXPIRY:  'ERP_EXPIRY',
};

const ROLE_DASHBOARD = {
  SUPER_ADMIN  : 'Dashboard/super-admin-dashboard.html',
  DEVELOPER    : 'Dashboard/developer-dashboard.html',
  OWNER        : 'Dashboard/owner-dashboard.html',
  ADMIN        : 'welcome.html',
  MANAGER      : 'Dashboard/manager-dashboard.html',
  ACCOUNTANT   : 'Dashboard/accounts/accounts.html',
  CASHIER      : 'Dashboard/restaurant/restaurant-dashboard.html',
  /* PASS #28 FIX ("Captain Report Dashboard not show"): CAPTAIN is a
     fully real role everywhere ELSE in this system (ALLOWED_ROLES,
     STAFF_ROLES, GET_STAFF_LIST's role filter, the Steward dropdown
     itself lists "Amit Singh (CAPTAIN)") but had NO entry in this map
     at all -- so a Captain login fell through to DEFAULT ('welcome.html',
     the generic marketing/landing page) instead of any real dashboard.
     That's the actual bug: not a report failing to render, but the
     Captain never reaching a page that has reports on it in the first
     place. No dedicated captain-dashboard.html file exists anywhere in
     this codebase to point to -- building one blind risks guessing what
     a Captain specifically needs to see. Routed to the same real,
     data-rich restaurant-dashboard.html CASHIER/OWNER/ADMIN already use
     (KOT, tables, orders, Steward Performance, reports) so a Captain at
     least lands somewhere real today. If Captains need a DIFFERENT set
     of cards/permissions than Cashier sees, that's a follow-up (the
     dashboard already reads ERP_ROLE and could show/hide sections by
     role, same pattern as SIDEBAR_HIDE_BY_INDUSTRY) -- tell me what a
     Captain should and shouldn't see and I'll wire that distinction in. */
  CAPTAIN      : 'Dashboard/restaurant/restaurant-dashboard.html',
  CHEF         : 'Dashboard/restaurant/chef-dashboard.html',
  WAITER       : 'Dashboard/employee-dashboard.html',
  STORE_MANAGER: 'Dashboard/inventory/inventory.html',
  CEO          : 'Dashboard/Ceo-dashboard.html',
  MD           : 'Dashboard/owner-dashboard.html',
  CLIENT       : 'welcome.html',
  DEMO         : 'welcome.html',
  ACCT         : 'Dashboard/balaji-staff-portal.html',
  PARTTIME     : 'Dashboard/employee-dashboard.html',
  STAFF        : 'Dashboard/employee-dashboard.html',
  HR           : 'Dashboard/manager-dashboard.html',
  SUPERVISOR   : 'Dashboard/manager-dashboard.html',
  DEFAULT      : 'welcome.html',
};

/* ── INDUSTRY-SPECIFIC DASHBOARDS ──────────────────────────────
   Used only for roles that get a "business" dashboard
   (ADMIN, OWNER, MD, CLIENT, DEMO, MANAGER). Cashier/Chef/Waiter
   etc. always go to their ROLE_DASHBOARD above regardless of industry.
   Only map to industries that have a REAL working dashboard file —
   everything else falls back to Dashboard/dashboard.html (common ERP).
   PASS #19 ("industry list, ALL rest pub same category"): Balaji
   supplied the full ~55-code industry taxonomy this system needs to
   recognize. GROUPING (RESTAURANT_DASHBOARD = welcome.html /
   restaurant-dashboard.html, everything else this system has no
   dedicated dashboard built for yet stays DEFAULT):
     - RESTAURANT_GROUP: every food-and-hospitality business type —
       RESTAURANT, RESTAURANT_PUB, BAR, HOTEL, BAKERY, CLOUD_KITCHEN,
       SWEET_SHOP, CATERING — all route to the SAME restaurant dashboard,
       per Balaji's explicit instruction. This is the fix that actually
       matters here: RESTAURANT_PUB specifically (Hashtag Siliguri's own
       real industry type, per DEMO_CLIENT_FALLBACK below) was NOT in
       the old alias map at all, so a client whose real INDUSTRY is
       "RESTAURANT_PUB" was being routed to the generic
       Dashboard/dashboard.html instead of the restaurant-specific one
       this whole suite is built around.
     - RETAIL_GROUP: shop-counter businesses that already fit the
       existing RETAIL dashboard's pattern (sell physical items over a
       counter) — RETAIL, ELECTRONICS, CLOTHING, FOOTWEAR, JEWELLERY,
       GIFT_SHOP, OPTICAL, SPORTS, MEDICAL_STORE.
     - GROCERY_GROUP: SUPERMARKET (existing, unchanged).
     - Everything else Balaji listed (CLINIC/DIAGNOSTIC/HOSPITAL/
       FACTORY/FOOD_PROCESSING/GARMENT_MFG/PLASTIC/PRINTING/FURNITURE/
       DISTRIBUTOR/WHOLESALER/TRANSPORT/COLD_CHAIN/TEA_GARDEN/FARM/
       SEEDS_AGRI/CA_FIRM/ADVOCATE/ARCHITECT/CONSULTANT/EVENT/SCHOOL/
       COACHING/DRIVING_SCHOOL/REAL_ESTATE/CONSTRUCTION/PROPERTY_MGMT/
       AUTO_DEALER/SERVICE_CENTRE/PETROL_PUMP/IT_COMPANY/CYBER_CAFE/
       MOBILE_REPAIR/NBFC/CHIT_FUND/INSURANCE/NGO/COOP/PHARMA_DIST) is
       now explicitly mapped to DEFAULT rather than silently falling
       through an unmatched lookup — same end result today, but explicit
       and ready for a real dashboard to be pointed at any of them later
       without hunting for where its alias needs to go. */
const INDUSTRY_DASHBOARD = {
  RESTAURANT : 'welcome.html',
  CAFE       : 'welcome.html',
  TEA        : 'welcome.html',
  RETAIL     : 'welcome.html',
  GROCERY    : 'welcome.html',
  SUPERMARKET: 'welcome.html',
  DEFAULT    : 'Dashboard/dashboard.html',
};

/* Roles that ALWAYS use ROLE_DASHBOARD (ignore industry) */
const FIXED_ROLE_DASHBOARDS = [
  'CASHIER','CHEF','WAITER','STAFF','PARTTIME','ACCOUNTANT',
  'ACCT','STORE_MANAGER','SUPER_ADMIN','DEVELOPER',
  /* PASS #28 FIX ("Captain Report Dashboard not show"): adding CAPTAIN
     to ROLE_DASHBOARD alone was NOT enough -- getTargetDashboard() does
     `industryDash || ROLE_DASHBOARD[role]`, and _erpResolveIndustryDashboard
     only returns null (deferring to ROLE_DASHBOARD) for roles listed
     HERE. Without this, a Captain's industry would still resolve to
     'welcome.html' via INDUSTRY_DASHBOARD and short-circuit the new
     CAPTAIN entry before it was ever consulted -- same silent-fallthrough
     bug, one layer deeper. */
  'CAPTAIN'
];

/* Map raw CLIENT_MASTER / USER.INDUSTRY strings → INDUSTRY_DASHBOARD keys.
   Keys are lowercased with WHITESPACE stripped (see _erpResolveIndustry-
   Dashboard's norm below) — underscores are kept as-is, so 'RESTAURANT_PUB'
   normalises to 'restaurant_pub', not 'restaurantpub'. */
const INDUSTRY_ALIAS = {
  // -- Food & Hospitality -> RESTAURANT (same dashboard for all of these) --
  restaurant:'RESTAURANT', food:'RESTAURANT',
  restaurant_pub:'RESTAURANT', pub:'RESTAURANT', bar:'RESTAURANT',
  hotel:'RESTAURANT', bakery:'RESTAURANT', cloud_kitchen:'RESTAURANT',
  cloudkitchen:'RESTAURANT', sweet_shop:'RESTAURANT', sweetshop:'RESTAURANT',
  catering:'RESTAURANT',
  cafe:'CAFE', teacafe:'TEA', tea:'TEA', coffee:'TEA',
  // -- Retail-pattern shops -> RETAIL --
  retail:'RETAIL', store:'RETAIL', shop:'RETAIL',
  electronics:'RETAIL', clothing:'RETAIL', footwear:'RETAIL',
  jewellery:'RETAIL', jewelry:'RETAIL', gift_shop:'RETAIL', giftshop:'RETAIL',
  optical:'RETAIL', sports:'RETAIL', medical_store:'RETAIL', medicalstore:'RETAIL',
  // -- Grocery / supermarket --
  grocery:'GROCERY', supermarket:'SUPERMARKET', kirana:'GROCERY',
  // -- Everything else Balaji listed: no dedicated dashboard yet, explicit
  //    DEFAULT so it's a deliberate mapping, not an unmatched fallthrough --
  pharma_dist:'DEFAULT', clinic:'DEFAULT', diagnostic:'DEFAULT', hospital:'DEFAULT',
  factory:'DEFAULT', food_processing:'DEFAULT', garment_mfg:'DEFAULT',
  plastic:'DEFAULT', printing:'DEFAULT', furniture:'DEFAULT',
  distributor:'DEFAULT', wholesaler:'DEFAULT', transport:'DEFAULT',
  cold_chain:'DEFAULT', tea_garden:'DEFAULT', farm:'DEFAULT', seeds_agri:'DEFAULT',
  ca_firm:'DEFAULT', advocate:'DEFAULT', architect:'DEFAULT', consultant:'DEFAULT',
  event:'DEFAULT', school:'DEFAULT', coaching:'DEFAULT', driving_school:'DEFAULT',
  real_estate:'DEFAULT', construction:'DEFAULT', property_mgmt:'DEFAULT',
  auto_dealer:'DEFAULT', service_centre:'DEFAULT', petrol_pump:'DEFAULT',
  it_company:'DEFAULT', cyber_cafe:'DEFAULT', mobile_repair:'DEFAULT',
  nbfc:'DEFAULT', chit_fund:'DEFAULT', insurance:'DEFAULT', ngo:'DEFAULT', coop:'DEFAULT',
};

function _erpResolveIndustryDashboard(role, industryRaw){
  if (FIXED_ROLE_DASHBOARDS.includes(role)) return null; // use ROLE_DASHBOARD
  const norm = (industryRaw || '').toString().toLowerCase().replace(/\s+/g,'');
  const key  = INDUSTRY_ALIAS[norm] || null;
  return (key && INDUSTRY_DASHBOARD[key]) || INDUSTRY_DASHBOARD.DEFAULT;
}

/* ── SUPER ADMIN CONTROL PANEL OVERRIDES ──────────────────────
   Reads 'erp_control_config' (set from Dashboard/super-admin-
   dashboard.html → Settings → Dashboard Routing Control) and
   patches the routing maps at runtime. No code edits needed
   to change where roles/industries land. */
(function _erpApplyControlOverrides(){
  try{
    const raw = localStorage.getItem('erp_control_config');
    if(!raw) return;
    const cfg = JSON.parse(raw);
    if(cfg.industryRestaurant){
      INDUSTRY_DASHBOARD.RESTAURANT = cfg.industryRestaurant;
      INDUSTRY_DASHBOARD.CAFE       = cfg.industryRestaurant;
      INDUSTRY_DASHBOARD.TEA        = cfg.industryRestaurant;
    }
    if(cfg.industryRetail){
      INDUSTRY_DASHBOARD.RETAIL      = cfg.industryRetail;
      INDUSTRY_DASHBOARD.GROCERY     = cfg.industryRetail;
      INDUSTRY_DASHBOARD.SUPERMARKET = cfg.industryRetail;
    }
    if(cfg.industryDefault) INDUSTRY_DASHBOARD.DEFAULT = cfg.industryDefault;
    if(cfg.roleAdmin)   ROLE_DASHBOARD.ADMIN   = cfg.roleAdmin;
    if(cfg.roleManager){
      ROLE_DASHBOARD.MANAGER    = cfg.roleManager;
      ROLE_DASHBOARD.HR         = cfg.roleManager;
      ROLE_DASHBOARD.SUPERVISOR = cfg.roleManager;
    }
    if(cfg.showSelector === 'false') localStorage.setItem('erp_skip_selector','true');
    else if(cfg.showSelector === 'true') localStorage.setItem('erp_skip_selector','false');
  }catch(e){ console.warn('[ERP] control config override failed', e); }
})();

function _erpLoginPage(){
  const path = window.location.pathname.replace(/\/+$/,'');
  const parts = path.split('/').filter(Boolean);
  // Find how many levels deep we are from the root (Webside_Live/)
  // Root pages: login.html, index.html → return 'login.html'
  // Dashboard/ pages → return '../login.html'
  // Dashboard/sub/ pages → return '../../login.html'
  const knownRoots = ['Dashboard','Balaji_staff','demo','layouts','Components'];
  let depth = 0;
  for(let i = parts.length - 1; i >= 0; i--){
    if(knownRoots.includes(parts[i])){ depth = parts.length - i; break; }
    depth++;
  }
  if(depth <= 1) return 'login.html';
  return '../'.repeat(depth - 1) + 'login.html';
}

/* ── CRITICAL FIX: _normalise() ─────────────────────────────────
   Live GS (code_gs_live_file) wraps every response as:
     { data: { status:'success', sessionToken:'...', user:{ role, name, email, ... } } }

   Old/FINAL login.gs returns flat:
     { ok:true, status:'success', ROLE:'...', FULL_NAME:'...', ... }

   This function handles BOTH shapes and always returns a flat
   object with uppercase keys that erp-config and login.html expect.
─────────────────────────────────────────────────────────────── */
function _normalise(raw) {
  if (!raw) return { status: 'error', message: 'Empty response from server' };

  // Unwrap { data: {...} } — live GS shape
  const flat = raw.data ? raw.data : raw;

  // Now flat might be: { status:'success', sessionToken, user:{ role, name, ... } }
  // OR the old shape:  { ok:true, status:'success', ROLE, FULL_NAME, ... }

  const u = flat.user || {};

  // Resolve ROLE from all possible locations
  const role = (
    flat.ROLE      ||
    flat.role      ||
    u.ROLE         ||
    u.role         ||
    ''
  ).toString().toUpperCase().trim();

  // Resolve FULL_NAME
  const fullName = (
    flat.FULL_NAME  ||
    flat.full_name  ||
    u.FULL_NAME     ||
    u.full_name     ||
    u.name          ||
    ''
  ).toString().trim();

  // Resolve EMAIL
  const email = (
    flat.EMAIL  ||
    flat.email  ||
    u.EMAIL     ||
    u.email     ||
    ''
  ).toString().trim();

  // Resolve USER_CODE
  const userCode = (
    flat.USER_CODE  ||
    flat.user_code  ||
    u.USER_CODE     ||
    u.user_code     ||
    u.userCode      ||
    ''
  ).toString().trim();

  // Resolve CLIENT_ID
  const clientId = (
    flat.CLIENT_ID  ||
    flat.client_id  ||
    u.CLIENT_ID     ||
    u.client_id     ||
    u.clientId      ||
    ''
  ).toString().trim();

  // Resolve BRANCH
  const branch = (
    flat.BRANCH  ||
    flat.branch  ||
    u.BRANCH     ||
    u.branch     ||
    ''
  ).toString().trim();

  // Resolve session token
  const sessionToken = (
    flat.sessionToken ||
    flat.SESSION_TOKEN ||
    raw.sessionToken  ||
    ''
  ).toString().trim();

  // Resolve status — accept ok:true as success
  const status = (flat.status === 'success' || flat.ok === true || raw.ok === true)
    ? 'success' : (flat.status || 'error');

  return Object.assign({}, flat, {
    // Normalised status
    status,
    ok: status === 'success',
    message:      flat.message || '',
    sessionToken: sessionToken,

    // Uppercase keys (what login.html & dashboard pages read)
    ROLE:      role,
    FULL_NAME: fullName,
    EMAIL:     email,
    USER_CODE: userCode,
    CLIENT_ID: clientId,
    BRANCH:    branch,

    // Lowercase aliases (backwards compat)
    role:      role,
    full_name: fullName,
    email:     email,
    user_code: userCode,
    client_id: clientId,
    branch:    branch,
  });
}

const ERP = {

  saveSession(data){
    // data here is already _normalise()'d by erpApiRequest
    // but we run it again just in case called directly
    const n = _normalise(data);

    localStorage.setItem(ERP_KEYS.USER,    JSON.stringify(n));
    localStorage.setItem(ERP_KEYS.SESSION, n.sessionToken || '');
    localStorage.setItem(ERP_KEYS.ROLE,    n.ROLE);
    localStorage.setItem(ERP_KEYS.CLIENT,  n.CLIENT_ID);
    const isSuperAdmin = (n.ROLE || "").toUpperCase() === "SUPER_ADMIN";
    const expiry = Date.now() + (isSuperAdmin ? 2 : 8) * 60 * 60 * 1000;
    localStorage.setItem(ERP_KEYS.EXPIRY,  expiry);
  },

  getUser(){
    try{
      const expiry = parseInt(localStorage.getItem(ERP_KEYS.EXPIRY) || '0');
      if(expiry && Date.now() > expiry){
        this._clearStorage();
        return null;
      }
      const u = localStorage.getItem(ERP_KEYS.USER);
      return u ? JSON.parse(u) : null;
    }catch(e){ return null; }
  },

  getRole()    { return localStorage.getItem(ERP_KEYS.ROLE)    || ''; },
  getSession() { return localStorage.getItem(ERP_KEYS.SESSION) || ''; },
  getClient()  { return localStorage.getItem(ERP_KEYS.CLIENT)  || ''; },

  _clearStorage(){
    Object.values(ERP_KEYS).forEach(k => localStorage.removeItem(k));
    /* also clear alternate session keys from other ERP versions */
    ['erp_session_v1','erp_session_v2','erp_activity_log','erp_clients_cache'].forEach(function(k){
      try{ localStorage.removeItem(k); }catch(e){}
    });
  },

  logout(redirectTo){
    // Optionally tell server to clear session token
    const session = this.getSession();
    if(session){
      try{
        erpApiRequest({ action:'LOGOUT', sessionToken: session }).catch(()=>{});
      }catch(e){}
    }
    this._clearStorage();
    const dest = redirectTo || _erpLoginPage();
    _safeNavigate(dest);
  },

  /* Returns industry key (RESTAURANT/RETAIL/DEFAULT) for the logged-in user */
  getIndustryKey(){
    const user = this.getUser() || {};
    const norm = (user.INDUSTRY || user.industry || '').toString().toLowerCase().replace(/\s+/g,'');
    return INDUSTRY_ALIAS[norm] || 'DEFAULT';
  },

  /* Full resolved target URL for this user (role + industry aware) */
  getTargetDashboard(){
    const role = this.getRole();
    const user = this.getUser() || {};
    const industryDash = _erpResolveIndustryDashboard(role, user.INDUSTRY || user.industry);
    return industryDash || ROLE_DASHBOARD[role] || ROLE_DASHBOARD.DEFAULT;
  },

  goToDashboard(){
    const target = this.getTargetDashboard();
    // Always persist so welcome.html can read it without re-computing
    try{ localStorage.setItem('erp_target_dashboard', target); }catch(e){}
    const skip = localStorage.getItem('erp_skip_selector') === 'true';
    if (skip) { _safeNavigate(target); return; }
    // Show welcome screen first — guard against redirect loops
    var _cur = window.location.pathname.toLowerCase();
    if (!_cur.includes('welcome')) { _safeNavigate('welcome.html'); }
  },

  requireLogin(allowedRoles){
    if(window.location.protocol==='file:') return {};
    const user = this.getUser();
    if(!user){
      _safeNavigate(_erpLoginPage());
      return null;
    }
    if(Array.isArray(allowedRoles) && allowedRoles.length > 0){
      const role = (user.ROLE || user.role || '').toString().toUpperCase();
      if(!allowedRoles.includes(role)){
        alert('⛔ Access Denied: role "' + role + '" cannot view this page.');
        _safeNavigate(_erpLoginPage());
        return null;
      }
    }
    return user;
  },

  /* Call this at the top of an industry-specific dashboard page
     (e.g. Dashboard/retail/Dashboard.html) to block users whose
     account industry/role doesn't match. Usage:
       ERP.enforceIndustryAccess('RETAIL');
  */
  enforceIndustryAccess(expectedKey){
    const user = this.getUser();
    if(!user) return this.requireLogin();
    const role = (user.ROLE||user.role||'').toUpperCase();
    if (FIXED_ROLE_DASHBOARDS.includes(role)) return user; // role-based pages skip this check
    const norm = (user.INDUSTRY||user.industry||'').toString().toLowerCase().replace(/\s+/g,'');
    const key  = INDUSTRY_ALIAS[norm] || 'DEFAULT';
    if (key !== expectedKey) {
      alert('⛔ Access Denied: this dashboard is not for your industry.');
      const target = INDUSTRY_DASHBOARD[key] || INDUSTRY_DASHBOARD.DEFAULT;
      _safeNavigate(target.indexOf('/')===0?target:target);
      return null;
    }
    return user;
  },

  injectUserInfo(){
    const user = this.getUser();
    if(!user) return;
    document.querySelectorAll('[data-erp-field]').forEach(el => {
      const field = el.getAttribute('data-erp-field');
      el.textContent = user[field] || user[field.toLowerCase()] || '';
    });
  },
};

let _ERP_API_URL = ERP_FALLBACK_API;

/* ── FIX ("data doesn't sync between devices" — inventory.html): every
   page in this suite (purchase-module.html, bar_module.html, kitchen-
   indent.html, chef-dashboard.html) already talks to the SAME real Apps
   Script backend for inventory data sync (SYNC_PULL_ALL/SYNC_PUSH_TABLE/
   SAVE_*), but each of those files hardcodes the URL locally — only
   inventory.html was written to read it from a SHARED global instead
   (window.BNX_API_URL / window.ERP_API_URL / window.INV_GAS_CORE, see
   inventory.html's SCRIPT_URL line), and NOTHING ever set any of those
   three globals — not here, not anywhere. So on inventory.html,
   SCRIPT_URL silently resolved to '' forever, fetch('') hit the current
   page instead of a real server, JSON parsing failed, and every push/
   pull was swallowed by erpApi()'s catch block — inventory data has been
   local-only, per-device, the entire time, even though the sync code
   itself (DB.save/pullAllFromBackend/live polling) was written correctly.
   Setting the real shared URL here — the ONE file every page already
   loads first — makes inventory.html's existing fallback chain resolve
   it automatically, with no per-page hardcoding needed. Same deployment
   purchase-module.html already uses successfully (PURCHASE_GAS_URL). */
window.INV_GAS_CORE = 'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec';

const IS_LOCAL_FILE = (typeof location !== 'undefined' && location.protocol === 'file:');
if (IS_LOCAL_FILE) { console.log('[ERP] Local file mode - GAS calls disabled'); }

function erpLoadRegistry(cb){
  // Use direct fallback URL — avoids JSONP errors on Netlify
  console.log('✅ ERP API URL:', _ERP_API_URL);
  if(cb) cb(_ERP_API_URL);
}

/* ── CORE API REQUEST (v4.1) ─────────────────────────────────────
   - PING uses GET (avoids CORS preflight)
   - All other actions use POST with text/plain (avoids preflight)
   - _normalise() called on every response so callers always get
     a flat object with uppercase keys regardless of GS version
─────────────────────────────────────────────────────────────── */

/* ── DEMO MODE: works without GAS URL ── */
const _DEMO_USERS = [
  {id:'admin',    pw:'admin',    ROLE:'SUPER_ADMIN',FULL_NAME:'Super Admin',  BRANCH:'Main Branch', CLIENT:'Balaji NextGen'},
  {id:'manager',  pw:'manager',  ROLE:'MANAGER',    FULL_NAME:'Manager',      BRANCH:'Main Branch', CLIENT:'Balaji NextGen'},
  {id:'cashier',  pw:'cashier',  ROLE:'CASHIER',    FULL_NAME:'Cashier',      BRANCH:'Counter 1',   CLIENT:'Balaji NextGen'},
  {id:'chef',     pw:'chef',     ROLE:'CHEF',       FULL_NAME:'Chef',         BRANCH:'Kitchen',     CLIENT:'Balaji NextGen'},
  {id:'waiter',   pw:'waiter',   ROLE:'WAITER',     FULL_NAME:'Waiter',       BRANCH:'Floor 1',     CLIENT:'Balaji NextGen'},
  {id:'owner',    pw:'owner',    ROLE:'OWNER',      FULL_NAME:'Owner',        BRANCH:'HQ',          CLIENT:'Balaji NextGen'},
  {id:'developer',pw:'dev123',   ROLE:'DEVELOPER',  FULL_NAME:'Developer',    BRANCH:'Tech',        CLIENT:'Balaji NextGen'},
  {id:'9832014403',pw:'1234',   ROLE:'SUPER_ADMIN', FULL_NAME:'Balaji Admin', BRANCH:'HQ',          CLIENT:'Balaji NextGen'},
  {id:'admin@demo.com',pw:'demo123',ROLE:'SUPER_ADMIN',FULL_NAME:'Demo Admin',BRANCH:'Main',        CLIENT:'Balaji NextGen'},
];

function _erpDemoLogin(loginId, password) {
  const id  = (loginId  || '').toLowerCase().trim();
  const pwd = (password || '').trim();
  for (const u of _DEMO_USERS) {
    if (u.id.toLowerCase() === id && u.pw === pwd) {
      return { status:'success', ROLE:u.ROLE, FULL_NAME:u.FULL_NAME, BRANCH:u.BRANCH, CLIENT:u.CLIENT, EMAIL:id };
    }
  }
  return { status:'error', message:'Invalid credentials.\n\nDemo: admin/admin · cashier/cashier · chef/chef · manager/manager' };
}

async function erpApiRequest(payload){
  let raw;

  if(payload && payload.action === 'PING'){
    const r = await fetch(_ERP_API_URL + '?action=PING', { method:'GET', redirect:'follow' });
    const t = await r.text();
    raw = JSON.parse(t);
    // PING just checks connectivity — return raw (no need to normalise)
    return raw;
  }

  const resp = await fetch(_ERP_API_URL, {
    method  : 'POST',
    headers : { 'Content-Type': 'text/plain' },
    body    : JSON.stringify(payload),
    redirect: 'follow',
  });
  const text = await resp.text();
  raw = JSON.parse(text);

  // ─── THE FIX: normalise response shape ───
  return _normalise(raw);
}

function erpReadSheet(sheetId, sheetName, tq, cb){
  const url    = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&tq=${encodeURIComponent(tq||'SELECT *')}`;
  const cbName = '__gvizCb_' + Math.random().toString(36).slice(2);
  const s      = document.createElement('script');
  window[cbName] = function(data){
    if(document.head.contains(s)) document.head.removeChild(s);
    delete window[cbName];
    const cols = data.table.cols.map(c => c.label || c.id);
    const rows = data.table.rows.map(row =>
      Object.fromEntries(cols.map((col, i) => [col, row.c[i]?.v ?? '']))
    );
    cb(rows);
  };
  s.src     = url + `&callback=${cbName}&responseHandler=${cbName}`;
  s.onerror = () => {
    if(document.head.contains(s)) document.head.removeChild(s);
    delete window[cbName];
    cb([]);
  };
  document.head.appendChild(s);
}

function erpRenderTopbar(containerId){
  const user = ERP.getUser();
  if(!user) return;
  const el = document.getElementById(containerId);
  if(!el) return;
  el.innerHTML = `
    <span style="font-size:13px;font-weight:600;">${user.FULL_NAME||user.full_name||'User'}</span>
    <span style="font-size:11px;opacity:.7;margin-left:4px;">[${user.ROLE||user.role||''}]</span>
    <button onclick="ERP.logout()" style="margin-left:14px;padding:7px 14px;background:#EF4444;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">🚪 Logout</button>
  `;
}

erpLoadRegistry();


// ── SAFE NAVIGATION — suppresses "Unsafe attempt to load URL" on file:// ──
function _safeNavigate(url) {
  if (!url) return;
  try {
    window.location.href = url;
  } catch(e) {
    try { window.location.assign(url); } catch(e2) {}
  }
}

// ── API ENDPOINT ALIASES (required by dashboard pages) ─────────
async function erpFrontendApi(payload) { return erpApiRequest(payload, 'V2_FRONTEND'); }
async function erpCoreApi(payload)     { return erpApiRequest(payload, 'V2_CORE'); }
async function erpAuthApi(payload)     { return erpApiRequest(payload, 'V2_AUTH'); }


/* ═══════════════════════════════════════════════════════════════
   AUTO LOGOUT ON INACTIVITY — 15 minutes
   Tracks: mousemove, keydown, click, scroll, touchstart
   Shows: 60-second countdown warning before logout
   Works on: every page that loads erp-config.js
═══════════════════════════════════════════════════════════════ */
(function _erpInactivityWatcher() {

  var IDLE_MS      = 15 * 60 * 1000;   /* 15 min inactivity → logout      */
  var WARN_MS      = 60 * 1000;         /* show warning 60 sec before logout */
  var CHECK_MS     = 10 * 1000;         /* check every 10 seconds           */
  var STORAGE_KEY  = 'erp_last_active'; /* shared across tabs               */

  var _warnShown   = false;
  var _warnEl      = null;
  var _countdownIv = null;

  /* skip on login page — no session to guard */
  function _isLoginPage() {
    var p = window.location.pathname.toLowerCase();
    return p.endsWith('login.html') || p.endsWith('login_v1.html') || p.endsWith('login_v2.html');
  }

  /* stamp activity time */
  function _touch() {
    try { localStorage.setItem(STORAGE_KEY, Date.now().toString()); } catch(e) {}
    if (_warnShown) _hideWarning();
  }

  /* read last activity across tabs */
  function _lastActive() {
    try { return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10); } catch(e) { return Date.now(); }
  }

  /* perform logout */
  function _doLogout() {
    _hideWarning();
    try {
      if (typeof ERP !== 'undefined' && ERP._clearStorage) ERP._clearStorage();
    } catch(e) {}
    try {
      ['ERP_USER','ERP_SESSION','ERP_ROLE','ERP_CLIENT','ERP_EXPIRY',
       'erp_session_v1','erp_session_v2'].forEach(function(k){ localStorage.removeItem(k); });
    } catch(e) {}
    try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
    /* navigate to login (works from any folder depth) */
    var parts = window.location.pathname.split('/').filter(Boolean);
    var depth = 0;
    ['Dashboard','demo','restaurant','balaji_erp_package','layouts','Components'].forEach(function(root){
      for (var i = parts.length - 1; i >= 0; i--) {
        if (parts[i] === root) { depth = Math.max(depth, parts.length - i); }
      }
    });
    var loginUrl = (depth <= 1) ? 'login.html' : '../'.repeat(depth - 1) + 'login.html';
    window.location.replace(loginUrl);
  }

  /* show warning overlay with countdown */
  function _showWarning(secsLeft) {
    if (_warnShown) return;
    _warnShown = true;

    _warnEl = document.createElement('div');
    _warnEl.id = '_erp_idle_warn';
    _warnEl.style.cssText = [
      'position:fixed','top:0','left:0','right:0','bottom:0',
      'background:rgba(0,0,0,.55)','z-index:2147483647',
      'display:flex','align-items:center','justify-content:center',
      'font-family:system-ui,sans-serif'
    ].join(';');

    _warnEl.innerHTML = [
      '<div style="background:#fff;border-radius:18px;padding:32px 36px;',
        'max-width:380px;width:90%;text-align:center;',
        'box-shadow:0 20px 60px rgba(0,0,0,.3);">',
        '<div style="font-size:42px;margin-bottom:8px">⏰</div>',
        '<h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 8px">',
          'Session Expiring</h2>',
        '<p style="font-size:13px;color:#64748b;margin:0 0 16px">',
          'No activity detected. You will be logged out in</p>',
        '<div id="_erp_countdown" style="font-size:48px;font-weight:800;',
          'color:#ef4444;line-height:1;margin-bottom:16px">', secsLeft, '</div>',
        '<p style="font-size:11px;color:#94a3b8;margin:0 0 20px">seconds</p>',
        '<div style="display:flex;gap:10px;justify-content:center">',
          '<button onclick="window._erpStayLoggedIn()" style="',
            'padding:10px 24px;border-radius:10px;border:none;',
            'background:#3b82f6;color:#fff;font-size:14px;font-weight:700;',
            'cursor:pointer;font-family:inherit">✅ Stay Logged In</button>',
          '<button onclick="window._erpIdleLogout()" style="',
            'padding:10px 20px;border-radius:10px;border:1.5px solid #e2e8f0;',
            'background:#fff;color:#64748b;font-size:14px;font-weight:600;',
            'cursor:pointer;font-family:inherit">Logout Now</button>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(_warnEl);

    /* countdown ticker */
    var secs = secsLeft;
    _countdownIv = setInterval(function() {
      secs--;
      var el = document.getElementById('_erp_countdown');
      if (el) el.textContent = Math.max(0, secs);
      if (secs <= 0) { clearInterval(_countdownIv); _doLogout(); }
    }, 1000);
  }

  function _hideWarning() {
    _warnShown = false;
    if (_countdownIv) { clearInterval(_countdownIv); _countdownIv = null; }
    if (_warnEl && _warnEl.parentNode) { _warnEl.parentNode.removeChild(_warnEl); }
    _warnEl = null;
  }

  /* expose to onclick handlers in the warning box */
  window._erpStayLoggedIn = function() { _touch(); };
  window._erpIdleLogout   = function() { _doLogout(); };

  /* poll check */
  function _check() {
    if (_isLoginPage()) return;
    if (typeof ERP !== 'undefined' && !ERP.getUser()) return; /* not logged in */

    var idle = Date.now() - _lastActive();

    if (idle >= IDLE_MS) {
      _doLogout();
      return;
    }

    var timeLeft = IDLE_MS - idle;  /* ms until logout */
    if (timeLeft <= WARN_MS && !_warnShown) {
      _showWarning(Math.round(timeLeft / 1000));
    } else if (timeLeft > WARN_MS && _warnShown) {
      _hideWarning();
    }
  }

  /* activity events */
  function _init() {
    if (_isLoginPage()) return;

    /* stamp now so idle timer starts from page load */
    _touch();

    ['mousemove','mousedown','keydown','click','scroll','touchstart','touchmove'].forEach(function(ev) {
      document.addEventListener(ev, _touch, { passive: true, capture: true });
    });

    /* ── Browser close/tab close → clear session ── */
    window.addEventListener('pagehide', function(e) {
      /* FIX ("clicking Reports Hub / Master Hub / Import Hub / Bar
         Module silently logs the user out"): restaurant-dashboard.html
         sets window._erpNavigating = true immediately before every one
         of its in-app location.href navigations (openReportTile, Master
         Hub, Import Hub, Bar Module, Daily Sales/DSR links — 9 call
         sites, all doing the same thing) specifically so this handler
         could tell "leaving to another page of this same app" apart
         from "actually closing the tab/browser". This handler never
         checked that flag -- !e.persisted alone can't tell those two
         cases apart (pagehide fires for ordinary same-site navigation
         too), so EVERY one of those navigations was already clearing
         the session and sending a real LOGOUT beacon to the server
         before the destination page even loaded. The person arrived at
         Reports/Master Hub/Import Hub/Bar Module already logged out. */
      if (!e.persisted && !window._erpNavigating) {
        /* Not going into bfcache and not an in-app navigation — actual
           close or navigation to somewhere outside this app. */
        /* FIX ("_clearStorage is not defined" — thrown from here on
           every navigation away from the page): this idle-timeout block
           is its own IIFE, separate from the ERP object defined above —
           there is no local _clearStorage() in this scope, only
           ERP._clearStorage(). _doLogout() a few lines up already calls
           it correctly guarded (`typeof ERP !== 'undefined' &&
           ERP._clearStorage`); this bare call never had that. */
        if (typeof ERP !== 'undefined' && ERP._clearStorage) ERP._clearStorage();
        const token = localStorage.getItem(ERP_KEYS.SESSION) || '';
        if (token) {
          try {
            navigator.sendBeacon(_ERP_API_URL, new Blob(
              [JSON.stringify({ action: 'LOGOUT', token, reason: 'browser_close' })],
              { type: 'text/plain' }
            ));
          } catch(ex) {}
        }
      }
      /* Reset the flag either way so it doesn't leak into a genuine
         close/navigation that happens to follow an in-app one without
         a fresh click (e.g. the destination page itself unloading). */
      window._erpNavigating = false;
    });

    /* Fallback for browsers that don't support pagehide well */
    window.addEventListener('beforeunload', function() {
      /* Same _erpNavigating check and same undefined-function fix as
         the pagehide handler just above. */
      if (window._erpNavigating) return;
      if (typeof ERP !== 'undefined' && ERP._clearStorage) ERP._clearStorage();
    });

    /* also reset on API calls (user is clearly active) */
    var _origErp = window.erpApiRequest;
    if (typeof _origErp === 'function') {
      window.erpApiRequest = function() { _touch(); return _origErp.apply(this, arguments); };
    }

    /* start polling */
    setInterval(_check, CHECK_MS);
  }

  /* run after DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
