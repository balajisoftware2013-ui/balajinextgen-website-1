/* ═══════════════════════════════════════════════════════════
   BALAJI NEXTGEN ERP — MASTER CONFIG v10
   EDIT ONLY THIS FILE — all pages read from here
   Contact: 9832014403 | balajieducationhub12@gmail.com
═══════════════════════════════════════════════════════════ */
window.BALAJI_MASTER = {
  version: 'v10.0',
  buildDate: '2026-06',

  /* ── YOUR GAS BACKEND URL ── */
  // ↓ Go to script.google.com → Deploy → Manage Deployments → copy URL ending in /exec
  gasUrl: 'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec',

  /* ── MASTER SPREADSHEET ID ── */
  // ↓ Open your Google Sheet → copy the ID from the URL
  // URL looks like: docs.google.com/spreadsheets/d/  >>>THIS_PART<<<  /edit
  masterSheetId: '1VpsTwdULiaj-YeyllgBcYk4txKXrr', // ← YOUR LIVE DB ID (already in GAS backend)

  /* ── COMPANY REGISTRY (add all 20 companies here) ── */
  companies: [
    { id: 'C001', name: 'Company 1', sheetId: '', type: 'restaurant', branch: 'Main' },
    { id: 'C002', name: 'Company 2', sheetId: '', type: 'retail',     branch: 'Main' },
    { id: 'C003', name: 'Company 3', sheetId: '', type: 'medical',    branch: 'Main' },
    { id: 'C004', name: 'Company 4', sheetId: '', type: 'manufacturing', branch: 'Main' },
    { id: 'C005', name: 'Company 5', sheetId: '', type: 'service',    branch: 'Main' },
    { id: 'C006', name: 'Company 6', sheetId: '', type: 'hotel',      branch: 'Main' },
    { id: 'C007', name: 'Company 7', sheetId: '', type: 'grocery',    branch: 'Main' },
    { id: 'C008', name: 'Company 8', sheetId: '', type: 'school',     branch: 'Main' },
    { id: 'C009', name: 'Company 9', sheetId: '', type: 'pharmacy',   branch: 'Main' },
    { id: 'C010', name: 'Company 10', sheetId: '', type: 'construction', branch: 'Main' },
    { id: 'C011', name: 'Company 11', sheetId: '', type: 'restaurant', branch: 'Main' },
    { id: 'C012', name: 'Company 12', sheetId: '', type: 'retail',    branch: 'Main' },
    { id: 'C013', name: 'Company 13', sheetId: '', type: 'service',   branch: 'Main' },
    { id: 'C014', name: 'Company 14', sheetId: '', type: 'medical',   branch: 'Main' },
    { id: 'C015', name: 'Company 15', sheetId: '', type: 'restaurant', branch: 'Main' },
    { id: 'C016', name: 'Company 16', sheetId: '', type: 'retail',    branch: 'Main' },
    { id: 'C017', name: 'Company 17', sheetId: '', type: 'manufacturing', branch: 'Main' },
    { id: 'C018', name: 'Company 18', sheetId: '', type: 'hotel',     branch: 'Main' },
    { id: 'C019', name: 'Company 19', sheetId: '', type: 'school',    branch: 'Main' },
    { id: 'C020', name: 'Company 20', sheetId: '', type: 'grocery',   branch: 'Main' },
  ],

  /* ── BUSINESS TYPE → AUTO THEME ── */
  bizTheme: {
    restaurant:    '',         // amber (default)
    retail:        'th-blue',
    grocery:       'th-blue',
    hotel:         'th-lblue',
    medical:       'th-lblue',
    pharmacy:      'th-green',
    school:        'th-orange',
    construction:  'th-gold',
    service:       'th-purple',
    manufacturing: 'th-green',
    distribution:  'th-blue',
    fruit:         '',
    juice:         '',
    tea:           '',
  },

  /* ── ROLE → DEFAULT DASHBOARD PATH ── */
  roleDashboard: {
    'SUPER ADMIN':  'Dashboard/super_admin_v4_UPGRADED.html',
    'DEVELOPER':    'Dashboard/developer-dashboard.html',
    'ADMIN':        'Dashboard/dashboard.html',
    'OWNER':        'Dashboard/owner-dashboard.html',
    'MANAGER':      'Dashboard/manager-dashboard.html',
    'CASHIER':      'Dashboard/cashier-dashboard.html',
    'WAITER':       'Dashboard/restaurant/cashier-dashboard.html',
    'STAFF':        'Dashboard/restaurant/cashier-dashboard.html',
    'CHEF':         'Dashboard/chef-dashboard.html',
    'BAR':          'Dashboard/chef-dashboard.html',
    'EMPLOYEE':     'Dashboard/employee-dashboard.html',
    'ACCOUNTANT':   'Dashboard/accounts/accounts-dashboard.html',
    'SALES':        'Dashboard/sales/sales-dashboard.html',
  },

  /* ── BUSINESS TYPE → DEFAULT DASHBOARD PATH ── */
  bizDashboard: {
    restaurant:    'Dashboard/restaurant/dashboard.html',
    retail:        'Dashboard/retail/Dashboard.html',
    grocery:       'Dashboard/retail/Dashboard.html',
    hotel:         'Dashboard/dashboard.html',
    medical:       'Dashboard/dashboard.html',
    school:        'Dashboard/dashboard.html',
    pharmacy:      'Dashboard/dashboard.html',
    construction:  'Dashboard/dashboard.html',
    manufacturing: 'Dashboard/manufacturing/manufacturing-dashboard.html',
    service:       'Dashboard/service/service-dashboard.html',
    fruit:         'Dashboard/restaurant/dashboard.html',
    juice:         'Dashboard/restaurant/dashboard.html',
    tea:           'Dashboard/restaurant/dashboard.html',
  },

  /* ── DASHBOARD LAYOUT DEFAULT ── */
  defaultDashboardLayout: 'enterprise', // v4 | v5 | v6 | enterprise | auto

  /* ── SESSION SETTINGS ── */
  sessionTimeoutMinutes: 30,

  /* ── FEATURES FLAGS ── */
  features: {
    ai:             true,
    loginTracking:  true,   // logs login/logout to Google Sheet
    liveMonitor:    true,   // super admin live user view
    exportFormats:  ['xlsx', 'csv', 'pdf', 'json'],
    darkModeToggle: true,
    multiCompany:   true,
  },

  /* ── BRANDING ── */
  brand: {
    name:    'Balaji NextGen ERP',
    tagline: 'Next Generation Business Intelligence',
    contact: '9832014403',
    email:   'balajieducationhub12@gmail.com',
  }
};

/* ── AUTO-EXPOSE as ERP_CFG for backward compatibility ── */
if (typeof window !== 'undefined') {
  window.ERP_MASTER = window.BALAJI_MASTER;
  /* Legacy: try to merge with existing ERP config if loaded */
  if (window.ERP && typeof window.ERP.extendConfig === 'function') {
    window.ERP.extendConfig(window.BALAJI_MASTER);
  }
}
