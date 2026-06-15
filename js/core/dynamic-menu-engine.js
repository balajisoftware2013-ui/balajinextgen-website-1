/* ═══════════════════════════════════════════════════════════════════════════
   BALAJI NEXTGEN ERP — DYNAMIC MENU ENGINE v1.0
   ═══════════════════════════════════════════════════════════════════════════
   SAVE LOCATION : /js/core/dynamic-menu-engine.js
   LOAD ORDER    : AFTER feature-loader-engine.js

   PURPOSE:
     • No hardcoded menu — menu is 100% driven by FEATURE_CONTROL_MASTER
     • Renders into #erpSidebar .sidebar-nav or a custom container
     • Works alongside existing SidebarEngine (preserves toggle/collapse)
     • Each menu item is only rendered if its module is enabled
     • Supports icons, badges, role-based visibility, submenu groups

   MENU DEFINITION:
     All menu items live in MENU_REGISTRY at the bottom.
     Adding a new module = add one entry there. No other changes needed.
═══════════════════════════════════════════════════════════════════════════ */

const DynamicMenuEngine = (function () {

  // ── Icons (emoji fallback — swap to Font Awesome classes if installed) ─
  const ICON = {
    dashboard:   '🏠', inventory:   '📦', purchase:    '🛒',
    sales:       '💰', crm:         '👥', hr:          '👤',
    finance:     '📊', warehouse:   '🏭', production:  '⚙️',
    restaurant:  '🍽️', ai:          '🤖', reports:     '📈',
    settings:    '⚙️', profile:     '👤', logout:      '🚪',
  };

  // ── MENU REGISTRY ─────────────────────────────────────────────────────
  // Each entry:
  //   id       : unique key (matches ERP_FEATURES.modules key, or special)
  //   label    : display text
  //   icon     : emoji or class
  //   href     : target page path
  //   module   : which module flag controls visibility (null = always show)
  //   roles    : comma-separated allowed roles (null = all roles)
  //   badge    : optional badge text (dynamic via badgeFn)
  //   badgeFn  : function name on window (called to get live badge count)
  //   children : sub-menu items (same structure, minus children)
  //   group    : display group header label
  // ─────────────────────────────────────────────────────────────────────
  const MENU_REGISTRY = [
    // ── Always-visible ──────────────────────────────────────────────────
    {
      id:'dashboard', label:'Dashboard', icon:ICON.dashboard,
      href:'Dashboard/dashboard.html', module:null, group:'MAIN'
    },

    // ── Inventory ───────────────────────────────────────────────────────
    {
      id:'inventory', label:'Inventory', icon:ICON.inventory,
      href:null, module:'INVENTORY', group:'OPERATIONS',
      children:[
        { id:'inventory-items',    label:'Items / Products',  href:'Module/inventory/items.html',      module:'INVENTORY' },
        { id:'inventory-stock',    label:'Stock Summary',     href:'Module/inventory/stock.html',      module:'INVENTORY' },
        { id:'inventory-alerts',   label:'Low Stock Alerts',  href:'Module/inventory/alerts.html',     module:'INVENTORY' },
        { id:'inventory-adjust',   label:'Stock Adjustment',  href:'Module/inventory/adjust.html',     module:'INVENTORY' },
        { id:'inventory-transfer', label:'Stock Transfer',    href:'Module/inventory/transfer.html',   module:'WAREHOUSE' },
      ]
    },

    // ── Purchase ────────────────────────────────────────────────────────
    {
      id:'purchase', label:'Purchase', icon:ICON.purchase,
      href:null, module:'PURCHASE', group:'OPERATIONS',
      children:[
        { id:'purchase-order',    label:'Purchase Orders',   href:'Module/SmartPurchase_Module.html', module:'PURCHASE' },
        { id:'purchase-receive',  label:'Receive Stock',     href:'Module/purchase/receive.html',     module:'PURCHASE' },
        { id:'purchase-returns',  label:'Purchase Returns',  href:'Module/purchase/returns.html',     module:'PURCHASE' },
        { id:'purchase-vendors',  label:'Vendor List',       href:'Module/purchase/vendors.html',     module:'PURCHASE' },
      ]
    },

    // ── Sales ───────────────────────────────────────────────────────────
    {
      id:'sales', label:'Sales', icon:ICON.sales,
      href:null, module:'SALES', group:'OPERATIONS',
      children:[
        { id:'sales-invoice',  label:'New Invoice',     href:'Module/Smart_Sales_Module.html', module:'SALES' },
        { id:'sales-history',  label:'Sales History',   href:'Module/sales/history.html',      module:'SALES' },
        { id:'sales-returns',  label:'Sales Returns',   href:'Module/sales/returns.html',      module:'SALES' },
        { id:'sales-customers',label:'Customers',       href:'Module/sales/customers.html',    module:'SALES' },
      ]
    },

    // ── Restaurant ──────────────────────────────────────────────────────
    {
      id:'restaurant', label:'Restaurant', icon:ICON.restaurant,
      href:null, module:'RESTAURANT', group:'OPERATIONS',
      children:[
        { id:'restaurant-kot',    label:'KOT / Orders',    href:'Module/restaurant/kot.html',    module:'RESTAURANT' },
        { id:'restaurant-tables', label:'Table Management',href:'Module/restaurant/tables.html', module:'RESTAURANT' },
        { id:'restaurant-menu',   label:'Menu / Items',    href:'Module/restaurant/menu.html',   module:'RESTAURANT' },
        { id:'restaurant-bill',   label:'Quick Billing',   href:'Module/restaurant/billing.html',module:'RESTAURANT' },
      ]
    },

    // ── CRM ─────────────────────────────────────────────────────────────
    {
      id:'crm', label:'CRM', icon:ICON.crm,
      href:null, module:'CRM', group:'BUSINESS',
      children:[
        { id:'crm-leads',    label:'Leads',         href:'Module/crm/leads.html',    module:'CRM' },
        { id:'crm-follow',   label:'Follow Ups',    href:'Module/crm/followups.html',module:'CRM' },
        { id:'crm-contacts', label:'Contacts',      href:'Module/crm/contacts.html', module:'CRM' },
      ]
    },

    // ── HR ──────────────────────────────────────────────────────────────
    {
      id:'hr', label:'HR / Staff', icon:ICON.hr,
      href:null, module:'HR', group:'BUSINESS',
      roles:'ADMIN,OWNER,MANAGER,SUPER ADMIN',
      children:[
        { id:'hr-employees',   label:'Employees',        href:'Module/hr/employees.html',   module:'HR' },
        { id:'hr-attendance',  label:'Attendance',       href:'attendance/attendance.html',  module:'HR' },
        { id:'hr-payroll',     label:'Payroll',          href:'Module/hr/payroll.html',      module:'HR' },
        { id:'hr-leave',       label:'Leave Management', href:'leave/leave-management.html', module:'HR' },
      ]
    },

    // ── Finance / Accounts ──────────────────────────────────────────────
    {
      id:'finance', label:'Finance', icon:ICON.finance,
      href:null, module:'FINANCE', group:'BUSINESS',
      roles:'ADMIN,OWNER,ACCOUNTANT,SUPER ADMIN',
      children:[
        { id:'finance-accounts', label:'Accounts Dashboard', href:'accounts/accounts-dashboard.html', module:'FINANCE' },
        { id:'finance-ledger',   label:'Ledger',             href:'Module/finance/ledger.html',        module:'FINANCE' },
        { id:'finance-expenses', label:'Expenses',           href:'Module/finance/expenses.html',      module:'FINANCE' },
        { id:'finance-reports',  label:'P&L Report',         href:'Module/finance/pl-report.html',     module:'FINANCE' },
      ]
    },

    // ── Warehouse ────────────────────────────────────────────────────────
    {
      id:'warehouse', label:'Warehouse', icon:ICON.warehouse,
      href:null, module:'WAREHOUSE', group:'ADVANCED',
      children:[
        { id:'warehouse-locations', label:'Locations',       href:'Module/warehouse/locations.html',  module:'WAREHOUSE' },
        { id:'warehouse-movements', label:'Stock Movements', href:'Module/warehouse/movements.html',  module:'WAREHOUSE' },
        { id:'warehouse-grn',       label:'GRN',             href:'Module/warehouse/grn.html',        module:'WAREHOUSE' },
      ]
    },

    // ── Production / Manufacturing ────────────────────────────────────────
    {
      id:'production', label:'Production', icon:ICON.production,
      href:null, module:'PRODUCTION', group:'ADVANCED',
      children:[
        { id:'production-orders', label:'Production Orders', href:'manufacturing/manufacturing-dashboard.html', module:'PRODUCTION' },
        { id:'production-bom',    label:'Bill of Materials', href:'Module/production/bom.html',                 module:'PRODUCTION' },
        { id:'production-wip',    label:'Work In Progress',  href:'Module/production/wip.html',                 module:'PRODUCTION' },
      ]
    },

    // ── AI Analytics ─────────────────────────────────────────────────────
    {
      id:'ai_analytics', label:'AI Analytics', icon:ICON.ai,
      href:null, module:'AI_ANALYTICS', group:'INTELLIGENCE',
      children:[
        { id:'ai-insights',   label:'Business Insights', href:'ai/ai-center.html',              module:'AI_ANALYTICS' },
        { id:'ai-forecast',   label:'Sales Forecast',    href:'Module/ai/forecast.html',         module:'AI_ANALYTICS' },
        { id:'ai-anomalies',  label:'Anomaly Detection', href:'Module/ai/anomalies.html',        module:'AI_ANALYTICS' },
      ]
    },

    // ── Reports (always visible) ──────────────────────────────────────────
    {
      id:'reports', label:'Reports', icon:ICON.reports,
      href:'reports/reports-dashboard.html', module:null, group:'REPORTS'
    },

    // ── Settings ──────────────────────────────────────────────────────────
    {
      id:'settings', label:'Settings', icon:ICON.settings,
      href:'settings/settings.html', module:null,
      roles:'ADMIN,OWNER,SUPER ADMIN,DEVELOPER', group:'SYSTEM'
    },
  ];

  // ── Group display labels ──────────────────────────────────────────────
  const GROUP_LABELS = {
    MAIN:        '',
    OPERATIONS:  'Operations',
    BUSINESS:    'Business',
    ADVANCED:    'Advanced',
    INTELLIGENCE:'Intelligence',
    REPORTS:     'Analytics',
    SYSTEM:      'System',
  };

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────
  function build(targetSelector = '.sidebar-nav, #erpSidebarNav') {
    const container = document.querySelector(targetSelector);
    if (!container) {
      console.warn('[DynamicMenu] Container not found:', targetSelector);
      return;
    }

    const features = window.ERP_FEATURES || {};
    const modules  = features.modules    || {};
    const role     = _getRole();
    const basePath = _getBasePath();

    let html         = '';
    let currentGroup = null;

    MENU_REGISTRY.forEach(item => {
      // Module check
      if (item.module && !modules[item.module]) return;
      // Role check
      if (item.roles && !_roleAllowed(item.roles, role)) return;

      // Group header
      if (item.group !== currentGroup) {
        currentGroup = item.group;
        const label  = GROUP_LABELS[currentGroup] || currentGroup;
        if (label) html += `<div class="sidebar-group-label">${label}</div>`;
      }

      if (item.children && item.children.length > 0) {
        // Filter children by module/role
        const visibleChildren = item.children.filter(c => {
          if (c.module && !modules[c.module]) return false;
          if (c.roles && !_roleAllowed(c.roles, role)) return false;
          return true;
        });
        if (visibleChildren.length === 0) return;

        html += _renderParent(item, visibleChildren, basePath);
      } else {
        html += _renderLeaf(item, basePath);
      }
    });

    container.innerHTML = html;
    _bindSubmenus(container);
    _markActive(container);
    console.log('[DynamicMenu] Built for level:', features.erpLevel, '| modules:', Object.keys(modules).filter(m => modules[m]).join(', '));
  }

  function _renderParent(item, children, basePath) {
    const subId = 'sub_' + item.id;
    let html  = `
      <div class="sidebar-item has-children" data-menu-id="${item.id}">
        <a href="#" class="sidebar-link" onclick="DynamicMenuEngine.toggleSub('${subId}'); return false;">
          <span class="sidebar-icon">${item.icon || ''}</span>
          <span class="sidebar-text">${item.label}</span>
          <span class="sidebar-arrow">›</span>
        </a>
        <div class="sidebar-submenu" id="${subId}">`;
    children.forEach(c => { html += _renderLeaf(c, basePath, true); });
    html += `</div></div>`;
    return html;
  }

  function _renderLeaf(item, basePath, isSub = false) {
    const href  = item.href ? (basePath + item.href) : '#';
    const cls   = isSub ? 'sidebar-sub-link' : 'sidebar-link';
    return `
      <div class="sidebar-item ${isSub ? 'sub-item' : ''}" data-menu-id="${item.id}" data-href="${item.href || ''}">
        <a href="${href}" class="${cls}">
          ${!isSub ? `<span class="sidebar-icon">${item.icon || ''}</span>` : ''}
          <span class="sidebar-text">${item.label}</span>
        </a>
      </div>`;
  }

  function _bindSubmenus(container) {
    container.querySelectorAll('.sidebar-submenu').forEach(sub => {
      // Keep closed by default
      sub.style.display = 'none';
    });
  }

  function _markActive(container) {
    const path = window.location.pathname;
    container.querySelectorAll('[data-href]').forEach(el => {
      const href = el.getAttribute('data-href');
      if (href && path.includes(href.replace(/.*\//, '').replace('.html', ''))) {
        el.querySelector('a').classList.add('active');
        const sub = el.closest('.sidebar-submenu');
        if (sub) sub.style.display = 'block';
      }
    });
  }

  function _getRole() {
    try {
      if (window.ERP_SESSION && window.ERP_SESSION.role) return window.ERP_SESSION.role.toUpperCase();
      if (typeof StorageEngine !== 'undefined') {
        const r = StorageEngine.getRole();
        if (r) return r.toUpperCase();
      }
      const raw = sessionStorage.getItem('ERP_SESSION');
      if (raw) { const o = JSON.parse(raw); return (o.role || '').toUpperCase(); }
    } catch(e) {}
    return 'STAFF';
  }

  function _getBasePath() {
    // Resolve relative path to site root from current page depth
    const depth = window.location.pathname.split('/').length - 2;
    return depth > 0 ? '../'.repeat(depth) : './';
  }

  function _roleAllowed(rolesStr, userRole) {
    return rolesStr.split(',').map(r => r.trim().toUpperCase()).includes(userRole);
  }

  function toggleSub(subId) {
    const sub = document.getElementById(subId);
    if (!sub) return;
    const open = sub.style.display === 'block';
    document.querySelectorAll('.sidebar-submenu').forEach(s => { s.style.display = 'none'; });
    const arrow = sub.previousElementSibling && sub.previousElementSibling.querySelector('.sidebar-arrow');
    document.querySelectorAll('.sidebar-arrow').forEach(a => a.style.transform = '');
    if (!open) {
      sub.style.display = 'block';
      if (arrow) arrow.style.transform = 'rotate(90deg)';
    }
  }

  // ── Auto-init on featuresLoaded event ─────────────────────────────────
  document.addEventListener('erp:featuresLoaded', function () {
    build();
  });

  // If FeatureLoader already ran before this script loaded
  if (window.ERP_FEATURES) {
    document.addEventListener('DOMContentLoaded', function () { build(); });
  }

  return { build, toggleSub };

})();

window.DynamicMenuEngine = DynamicMenuEngine;
