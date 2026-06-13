/* ============================================================
   BALAJI NEXTGEN ERP — API ROUTER v2.0-CORRECTED
   api/api-router.js
   
   CORRECTIONS:
   ✅ FIX: Was 3 lines reading localStorage — completely rewritten
   ✅ NEW: Real endpoint registry with all 3 GAS deployments
   ✅ NEW: routeRequest() dispatches to correct endpoint by action
   ✅ NEW: Health check for all endpoints
   ✅ NEW: Action → endpoint mapping table
============================================================ */

const ERP_API_ROUTER = {

  // ── Endpoint Registry ────────────────────────────────────────
  ENDPOINTS: {
    V2_AUTH:
      'https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec',
    V2_FRONTEND:
      'https://script.google.com/macros/s/AKfycbyiaO9zpZAQ1pTlDjz7B2yEUfjv1vrlXTYjTkIY-YwKr6ahOCV6lU_AiB4dpmnBySG1/exec',
    V2_CORE:
      'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec',
  },

  // ── Action → Endpoint Routing Table ──────────────────────────
  ACTION_MAP: {
    // V2_AUTH — login, session, user management
    LOGIN                       : 'V2_AUTH',
    LOGOUT                      : 'V2_AUTH',
    PING                        : 'V2_AUTH',
    VALIDATE_SESSION            : 'V2_AUTH',
    CHANGE_PASSWORD             : 'V2_AUTH',
    CREATE_USER                 : 'V2_AUTH',
    GET_USERS                   : 'V2_AUTH',
    UPDATE_USER                 : 'V2_AUTH',
    DELETE_USER                 : 'V2_AUTH',

    // V2_FRONTEND — read/display data
    GET_DASHBOARD_SUMMARY       : 'V2_FRONTEND',
    GET_CLIENTS                 : 'V2_FRONTEND',
    GET_SALES_REPORT            : 'V2_FRONTEND',
    GET_PURCHASE_REPORT         : 'V2_FRONTEND',
    GET_INVENTORY_SUMMARY       : 'V2_FRONTEND',
    GET_STOCK                   : 'V2_FRONTEND',
    GET_ITEMS                   : 'V2_FRONTEND',
    GET_CUSTOMERS               : 'V2_FRONTEND',
    GET_VENDORS                 : 'V2_FRONTEND',
    GET_LEDGER                  : 'V2_FRONTEND',
    GET_OUTSTANDING             : 'V2_FRONTEND',
    GET_GSTR1_DATA              : 'V2_FRONTEND',
    GET_GSTR3B_DATA             : 'V2_FRONTEND',
    GET_PARTTIME_APPLICATIONS   : 'V2_FRONTEND',
    GET_ACTIVITY_LOG            : 'V2_FRONTEND',
    GET_TABLES                  : 'V2_FRONTEND',
    GET_KOT_QUEUE               : 'V2_FRONTEND',
    GET_EMPLOYEES               : 'V2_FRONTEND',
    GET_GRN_LIST                : 'V2_FRONTEND',

    // V2_CORE — write/transact data
    SA_CREATE_CLIENT            : 'V2_CORE',
    SA_UPDATE_CLIENT            : 'V2_CORE',
    SA_DELETE_CLIENT            : 'V2_CORE',
    SA_RECORD_PAYMENT           : 'V2_CORE',
    SA_PROVISION_DATABASE       : 'V2_CORE',
    SAVE_SALE                   : 'V2_CORE',
    SAVE_PURCHASE               : 'V2_CORE',
    SAVE_GRN                    : 'V2_CORE',
    SAVE_INVENTORY              : 'V2_CORE',
    UPDATE_STOCK                : 'V2_CORE',
    SAVE_KOT                    : 'V2_CORE',
    CONFIRM_KOT                 : 'V2_CORE',
    SAVE_TABLE_STATUS           : 'V2_CORE',
    SAVE_RESERVATION            : 'V2_CORE',
    SAVE_SETTLEMENT             : 'V2_CORE',
    SAVE_EMPLOYEE               : 'V2_CORE',
    UPDATE_EMPLOYEE             : 'V2_CORE',
    SAVE_ATTENDANCE             : 'V2_CORE',
    SAVE_PAYROLL                : 'V2_CORE',
    SAVE_INVOICE                : 'V2_CORE',
    SAVE_COLLECTION             : 'V2_CORE',
    SAVE_TO_DRIVE               : 'V2_CORE',
    SAVE_PARTTIME_APPLICATION   : 'V2_CORE',
    SAVE_PERM_MATRIX            : 'V2_CORE',
    EXPORT_TALLY_XML            : 'V2_CORE',
    SEND_WHATSAPP               : 'V2_CORE',
    SAVE_INVENTORY_CONSUMPTION  : 'V2_CORE',
  },

  // ── Route a request to the correct endpoint ──────────────────
  resolve(action) {
    return this.ACTION_MAP[action] || 'V2_CORE';
  },

  getUrl(action) {
    const ep = this.resolve(action);
    return this.ENDPOINTS[ep];
  },

  // ── Send request via correct endpoint ────────────────────────
  async send(payload) {
    const action = payload.action || '';
    const url    = this.getUrl(action);
    const body   = Object.assign({
      sessionToken : localStorage.getItem('ERP_SESSION') || '',
      clientId     : localStorage.getItem('ERP_CLIENT')  || '',
      branch       : localStorage.getItem('ERP_BRANCH')  || 'HEAD_OFFICE',
    }, payload);

    const resp = await fetch(url, {
      method  : 'POST',
      headers : { 'Content-Type': 'text/plain' },
      body    : JSON.stringify(body),
      redirect: 'follow',
    });
    return JSON.parse(await resp.text());
  },

  // ── Health check all endpoints ────────────────────────────────
  async healthCheck() {
    const results = {};
    for (const [name, url] of Object.entries(this.ENDPOINTS)) {
      try {
        const r = await fetch(url + '?action=PING', { method: 'GET', redirect: 'follow' });
        const d = JSON.parse(await r.text());
        results[name] = { ok: true, status: d.status || 'ok' };
      } catch(e) {
        results[name] = { ok: false, error: e.message };
      }
    }
    return results;
  },
};

console.log('✅ ERP API Router v2.0 loaded — endpoints:', Object.keys(ERP_API_ROUTER.ENDPOINTS));
