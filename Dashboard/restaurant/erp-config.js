/* ═══════════════════════════════════════════════════════════
   Balaji NextGen ERP — erp-config.js  v3.1 LIVE
   Generated: 2026-06-28
   
   CLIENT DATABASE REGISTRY — All clients auto-matched
   Place this file in the SAME folder as all HTML modules.
   All modules read this automatically via script tag.
   
   Admin Setup: admin-setup.html
   To regenerate: admin-setup.html → Generate erp-config.js
═══════════════════════════════════════════════════════════ */

(function(global) {
  'use strict';

  /* ── GAS API Endpoints ── */
  const GAS_APIS = {
    V2_CORE:     'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec',
    V2_AUTH:     'https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec',
    V2_FRONTEND: 'https://script.google.com/macros/s/AKfycbyiaO9zpZAQ1pTlDjz7B2yEUfjv1vrlXTYjTkIY-YwKr6ahOCV6lU_AiB4dpmnBySG1/exec',
  };

  /* ═══════════════════════════════════════════════════════════
     CLIENT DATABASE REGISTRY
     Each client has:
       MASTER_DB_ID      → User master, menu, config data
       TRANSACTION_DB_ID → Sales, KOT, orders, payments
       REPORT_DB_ID      → DSR, MTD, YTD, cashbook reports
       FOLDER_ID         → Google Drive folder for this client
     Matched from USER_MASTER by CLIENT_ID
  ═══════════════════════════════════════════════════════════ */
  const CLIENT_DB_REGISTRY = {

    'CL00010': {
      name:               "VANN'S KITCHEN LLP (HASHTAG)",
      master_db_id:       '1gmH3zQqNDO8PIW4ADZPvPU5TN7kpVN3r0jW2Sk_-500',
      master_db_url:      'https://docs.google.com/spreadsheets/d/1gmH3zQqNDO8PIW4ADZPvPU5TN7kpVN3r0jW2Sk_-500/edit',
      transaction_db_id:  '14VgZJirfxIEjCQsZY7X4o6L8qmp62IxVuZd_jsBuYzI',
      transaction_db_url: 'https://docs.google.com/spreadsheets/d/14VgZJirfxIEjCQsZY7X4o6L8qmp62IxVuZd_jsBuYzI/edit',
      report_db_id:       '1xO-A2264FkCQJRh8EWrhAvpkj-HKtRPDd-XmWjngjPM',
      report_db_url:      'https://docs.google.com/spreadsheets/d/1xO-A2264FkCQJRh8EWrhAvpkj-HKtRPDd-XmWjngjPM/edit',
      folder_id:          '1waYhFpMXCX3IHhnXZB7aCCm2_74mz_Xo',
      status:             'ACTIVE',
      created_on:         '22/06/2026',
      type:               'RESTAURANT',
    },

    'CL00011': {
      name:               'SNPA Kitchen LLP (HASHTAG)',
      master_db_id:       '1ow9EDOo8Wf8V2TI9_wE7aYUA3_ZVCe3AoM83FF7CrpA',
      master_db_url:      'https://docs.google.com/spreadsheets/d/1ow9EDOo8Wf8V2TI9_wE7aYUA3_ZVCe3AoM83FF7CrpA/edit',
      transaction_db_id:  '1cW4fyi4bZuBWQuz-9X4AAYrPVN6pkYvdWMTawrvRLgc',
      transaction_db_url: 'https://docs.google.com/spreadsheets/d/1cW4fyi4bZuBWQuz-9X4AAYrPVN6pkYvdWMTawrvRLgc/edit',
      report_db_id:       '1CTcK7D8wB7R0qBT0tU22SGsRSUZhMLPwQSMUR46r8AE',
      report_db_url:      'https://docs.google.com/spreadsheets/d/1CTcK7D8wB7R0qBT0tU22SGsRSUZhMLPwQSMUR46r8AE/edit',
      folder_id:          '1TDqHypC70ii65PE1hEGu9PVVpEN0mtNR',
      status:             'ACTIVE',
      created_on:         '22/06/2026',
      type:               'RESTAURANT',
    },

    'CL00012': {
      name:               'SIP City Light',
      master_db_id:       '1ZoF1LczAQHXQ0vaFVMAtszYVlnZcr-NeMhSW6hY6D2k',
      master_db_url:      'https://docs.google.com/spreadsheets/d/1ZoF1LczAQHXQ0vaFVMAtszYVlnZcr-NeMhSW6hY6D2k/edit',
      transaction_db_id:  '14KzQqKfEpTG44Zxl2OIPOiqG6gPfRuBtelR9Ed8_kIg',
      transaction_db_url: 'https://docs.google.com/spreadsheets/d/14KzQqKfEpTG44Zxl2OIPOiqG6gPfRuBtelR9Ed8_kIg/edit',
      report_db_id:       '13584AhKPaLTVH5LZT8HzXoLBt7RP7hV-JHVxRBDukeE',
      report_db_url:      'https://docs.google.com/spreadsheets/d/13584AhKPaLTVH5LZT8HzXoLBt7RP7hV-JHVxRBDukeE/edit',
      folder_id:          '1GKrTSzkNfy6B8uEhscVC1hqE_PwkckIH',
      status:             'ACTIVE',
      created_on:         '22/06/2026',
      type:               'RESTAURANT',
    },

    'CL00013': {
      name:               'SUMAN ART & CRAFT ACADEMY',
      master_db_id:       '1F8ZX2XUJGXzwgp2DzyEhM-TOV2vYA87FqAjmCG0AJOM',
      master_db_url:      'https://docs.google.com/spreadsheets/d/1F8ZX2XUJGXzwgp2DzyEhM-TOV2vYA87FqAjmCG0AJOM/edit',
      transaction_db_id:  '14W0zopGdZZib5hjiltJdE8kxc4pGcB30EdpbwiErcUk',
      transaction_db_url: 'https://docs.google.com/spreadsheets/d/14W0zopGdZZib5hjiltJdE8kxc4pGcB30EdpbwiErcUk/edit',
      report_db_id:       '1fWiZMrZJ6qdaRFn38oIynHKRJ9GZAJa1AkrHV2gc3Hw',
      report_db_url:      'https://docs.google.com/spreadsheets/d/1fWiZMrZJ6qdaRFn38oIynHKRJ9GZAJa1AkrHV2gc3Hw/edit',
      folder_id:          '1uYSrgW95-mMbNvcbUXzTHsyrKc6n3pct',
      status:             'ACTIVE',
      created_on:         '22/06/2026',
      type:               'ACADEMY',
    },

    'CL00014': {
      name:               'TEST',
      master_db_id:       '1UZaoK6Q842hJgHC2K3oyX5QL-5Rv2zigV1kZxJHutDc',
      master_db_url:      'https://docs.google.com/spreadsheets/d/1UZaoK6Q842hJgHC2K3oyX5QL-5Rv2zigV1kZxJHutDc/edit',
      transaction_db_id:  '10vdxK_IiEErS0U46K89kCufdQE49EE2H5lldQeI9PKc',
      transaction_db_url: 'https://docs.google.com/spreadsheets/d/10vdxK_IiEErS0U46K89kCufdQE49EE2H5lldQeI9PKc/edit',
      report_db_id:       '1PLSZ-I34DbNXUtvi_cC_VQDT3ijompQvG4WNhvAtEfU',
      report_db_url:      'https://docs.google.com/spreadsheets/d/1PLSZ-I34DbNXUtvi_cC_VQDT3ijompQvG4WNhvAtEfU/edit',
      folder_id:          '1ic26J9-bTnUORJE9m19oCxwrf0kZogo9',
      status:             'ACTIVE',
      created_on:         '22/06/2026',
      type:               'TEST',
    },

    /* Legacy clients from USER_MASTER */
    'CL00001': { name: 'Balaji Head Office',    type: 'RESTAURANT', status: 'ACTIVE' },
    'CL00002': { name: 'Vanns Kitchen',          type: 'RESTAURANT', status: 'ACTIVE' },
    'CL00003': { name: 'Hashtag Kol',            type: 'RESTAURANT_BAR', status: 'ACTIVE' },
    'DEMO':    { name: 'Demo Client',            type: 'DEMO',       status: 'DEMO'   },
  };

  /* ── System Config ── */
  const SYS = {
    ERP_MODE:    'LIVE',
    CLIENT_ID:   'CL00010',        // Default active client (Vanns Kitchen / Hashtag)
    TIMEZONE:    'Asia/Kolkata',
    COMPANY:     "VANN'S KITCHEN LLP (HASHTAG)",
    PHONE:       '9832014403',
    DSR_MODE:    'UPLOAD',         // DIRECT_POS | UPLOAD
    POS_SYSTEM:  'RISTA',
    DSR_ACTION:  'GET_DSR_SALES_DATA',
    VERSION:     'v3.1',
    IS_LIVE:     true,
  };

  /* ── Get client DB config for a given client ID ── */
  function getClientDB(clientId) {
    return CLIENT_DB_REGISTRY[clientId || SYS.CLIENT_ID] || null;
  }

  /* ── Build API payload with correct DB IDs for the current client ── */
  function buildPayload(action, extra) {
    const user    = getUser();
    const cid     = (user && user.CLIENT_ID) || SYS.CLIENT_ID;
    const clientDB = getClientDB(cid);
    return Object.assign({
      action,
      clientId:         cid,
      sessionToken:     user && user.SESSION_TOKEN,
      module:           'RESTAURANT',
      master_db_id:     clientDB && clientDB.master_db_id,
      transaction_db_id:clientDB && clientDB.transaction_db_id,
      report_db_id:     clientDB && clientDB.report_db_id,
    }, extra || {});
  }

  /* ── Session Helpers ── */
  /* FIX: welcome.html (the actual login/session-setting page) stores
     the session under 'ERP_USER' (uppercase), never 'erpUser'. This
     function previously only checked 'erpUser', so any page using
     ERP.getUser() (like chef-dashboard.html's login guard) always got
     null even for a genuinely logged-in user — causing an immediate
     redirect back to login, which then bounced back to welcome since
     it saw a valid ERP_USER session there. Now checks ERP_USER first
     (the real key), falling back to erpUser for compatibility. */
  function getUser() {
    try {
      var raw = localStorage.getItem('ERP_USER') || sessionStorage.getItem('ERP_USER')
             || sessionStorage.getItem('erpUser') || localStorage.getItem('erpUser') || 'null';
      return JSON.parse(raw);
    }
    catch(e) { return null; }
  }

  function setUser(u) {
    const s = JSON.stringify(u);
    sessionStorage.setItem('erpUser', s);
    localStorage.setItem('erpUser', s);
    /* FIX: also write ERP_USER — the key welcome.html and other
       pages actually check — so a session set via ERP.setUser()
       is recognized everywhere, not just by pages using erpUser. */
    sessionStorage.setItem('ERP_USER', s);
    localStorage.setItem('ERP_USER', s);
    /* Also cache the client's DB IDs so modules can read them instantly */
    const db = getClientDB(u.CLIENT_ID);
    if (db) {
      localStorage.setItem('bnx_master_db_id',      db.master_db_id      || '');
      localStorage.setItem('bnx_transaction_db_id', db.transaction_db_id || '');
      localStorage.setItem('bnx_report_db_id',      db.report_db_id      || '');
      localStorage.setItem('bnx_folder_id',         db.folder_id         || '');
      localStorage.setItem('bnx_client_name',       db.name              || '');
    }
    localStorage.setItem('bnx_client_id', u.CLIENT_ID || '');
  }

  function clear(redirect) {
    sessionStorage.removeItem('erpUser');
    localStorage.removeItem('erpUser');
    if (redirect) window.location.href = redirect;
  }

  function logout(redirect) {
    if (confirm('Logout from Balaji NextGen ERP?\nPowered by Balaji NextGen Solutions')) {
      clear(redirect || 'admin-setup.html');
    }
  }

  /* ── Unified API call (always sends correct DB IDs for current client) ── */
  async function api(payload, endpoint) {
    const url = GAS_APIS[endpoint || 'V2_CORE'];
    try {
      const r = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(buildPayload(payload.action || '', payload)),
        redirect: 'follow',
      });
      return await r.json();
    } catch(e) { return { success: false, error: e.message }; }
  }

  /* ── DSR auto-fetch for DIRECT_POS mode ── */
  async function fetchDSRForDate(date) {
    if (SYS.DSR_MODE !== 'DIRECT_POS') return null;
    return api({ action: SYS.DSR_ACTION, date: date || new Date().toISOString().slice(0,10) }, 'V2_CORE');
  }

  /* ── Expose global ERP object ── */
  global.ERP = {
    APIS: GAS_APIS,
    SYS,
    CLIENT_DB_REGISTRY,
    getUser, setUser, clear, logout,
    api, buildPayload, fetchDSRForDate,
    getClientDB,
    IS_LIVE: SYS.IS_LIVE,
    CLIENT_ID: SYS.CLIENT_ID,
    DSR_MODE: SYS.DSR_MODE,
  };

  /* ── Sync localStorage so modules that can't import this also benefit ── */
  (function syncLocalStorage() {
    const cid = SYS.CLIENT_ID;
    localStorage.setItem('bnx_api_core',   GAS_APIS.V2_CORE.match(/\/s\/([^/]+)\//)?.[1] || '');
    localStorage.setItem('bnx_api_auth',   GAS_APIS.V2_AUTH.match(/\/s\/([^/]+)\//)?.[1] || '');
    localStorage.setItem('bnx_api_front',  GAS_APIS.V2_FRONTEND.match(/\/s\/([^/]+)\//)?.[1] || '');
    localStorage.setItem('bnx_client_id',  cid);
    localStorage.setItem('bnx_erp_mode',   SYS.ERP_MODE);
    localStorage.setItem('bnx_dsr_config', JSON.stringify({
      dsrMode: SYS.DSR_MODE, posSystem: SYS.POS_SYSTEM, action: SYS.DSR_ACTION,
    }));
    const db = getClientDB(cid);
    if (db) {
      localStorage.setItem('bnx_master_db_id',      db.master_db_id      || '');
      localStorage.setItem('bnx_transaction_db_id', db.transaction_db_id || '');
      localStorage.setItem('bnx_report_db_id',      db.report_db_id      || '');
      localStorage.setItem('bnx_folder_id',         db.folder_id         || '');
      localStorage.setItem('bnx_client_name',       db.name              || '');
    }
  })();

  /* ── Auto-populate name/role in header on page load ── */
  document.addEventListener('DOMContentLoaded', function() {
    const u = getUser();
    if (!u) return;
    ['sfName','sfRole'].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.textContent = id === 'sfName'
        ? (u.full_name || u.user_code || 'User')
        : (u.ROLE || u.role || 'Staff');
    });
  });

})(window);
