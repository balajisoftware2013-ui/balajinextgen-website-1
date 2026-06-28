// ═══════════════════════════════════════════════════════════════════
//  BALAJI NEXTGEN ERP — WIZARD BACKEND  (GAS_WIZARD_BACKEND.gs)
//  Paste this into your GAS project (the one behind GAS_URL)
//  Deploy → New deployment → Web App
//    Execute as : Me
//    Who has access : Anyone
// ═══════════════════════════════════════════════════════════════════

// ── SHEET IDs ──────────────────────────────────────────────────────
const MASTER_SS_ID   = '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I';  // BALAJI_ERP_MASTER_CONTROL_SYSTEM
const SECURITY_SS_ID = '1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg';  // USER_SECURITY_MASTER_DB

// ── CORS HELPER ────────────────────────────────────────────────────
function _cors(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON)
    .addHeader('Access-Control-Allow-Origin', '*')
    .addHeader('Access-Control-Allow-Methods', 'GET, POST')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function _json(obj) {
  return _cors(ContentService.createTextOutput(JSON.stringify(obj)));
}

// ── doGet — handles ?action=GET_STATS and OPTIONS preflight ────────
function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) ? e.parameter.action : '';

    if (action === 'GET_STATS' || action === '') {
      return _json(getStats());
    }

    if (action === 'GET_CLIENTS') {
      return _json(getAllClients());
    }

    // Unknown action — still return valid JSON
    return _json({ success: false, error: 'Unknown GET action: ' + action });

  } catch (err) {
    logError('doGet', err);
    return _json({ success: false, error: err.message });
  }
}

// ── doPost — handles SAVE_CLIENT, LOGOUT, SYNC_PENDING ────────────
function doPost(e) {
  try {
    if (!e || !e.postData) {
      // Called without body (browser preflight / ping) — return stats
      return _json(getStats());
    }

    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action || 'SAVE_CLIENT';

    if (action === 'SAVE_CLIENT' || action === 'REGISTER_CLIENT') {
      return _json(saveClient(payload.clientData || payload));
    }

    if (action === 'LOGOUT') {
      return _json({ success: true, message: 'Logged out' });
    }

    if (action === 'GET_STATS') {
      return _json(getStats());
    }

    return _json({ success: false, error: 'Unknown action: ' + action });

  } catch (err) {
    logError('doPost', err);
    return _json({ success: false, error: err.message });
  }
}

// ── GET_STATS ──────────────────────────────────────────────────────
function getStats() {
  try {
    const ss     = SpreadsheetApp.openById(MASTER_SS_ID);
    const sheet  = ss.getSheetByName('CLIENT_MASTER');
    if (!sheet) return { success: false, error: 'CLIENT_MASTER sheet not found' };

    const lastRow = sheet.getLastRow();
    // Row 1 = header, data from row 2
    const totalClients = Math.max(0, lastRow - 1);

    // Find highest CLIENT_ID to compute next ID
    let maxNum = 0;
    if (lastRow > 1) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
      ids.forEach(id => {
        if (id && String(id).startsWith('CL')) {
          const n = parseInt(String(id).replace('CL', ''), 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      });
    }

    // Last client ID
    let lastClient = '—';
    if (lastRow > 1) {
      const lastId = sheet.getRange(lastRow, 1).getValue();
      if (lastId) lastClient = String(lastId);
    }

    const nextNum      = maxNum + 1;
    const nextClientId = 'CL' + String(nextNum).padStart(5, '0');

    return {
      success      : true,
      status       : 'success',
      total        : totalClients,
      totalClients : totalClients,
      nextClientId : nextClientId,
      lastClient   : lastClient,
      maxId        : maxNum
    };
  } catch (err) {
    logError('getStats', err);
    return { success: false, error: err.message };
  }
}

// ── SAVE CLIENT ────────────────────────────────────────────────────
// CLIENT_MASTER columns (1-indexed):
// 1  CLIENT_ID         2  CONTACT_NAME      3  PHONE
// 4  ALT_PHONE         5  EMAIL             6  COMPANY_NAME
// 7  COMPANY_TYPE      8  GST_NO            9  PAN
// 10 ADDRESS           11 CITY              12 STATE
// 13 PIN               14 INDUSTRY          15 PLAN
// 16 ERP_URL           17 ADMIN_NAME        18 ADMIN_EMAIL
// 19 ADMIN_USERNAME    20 ADMIN_PASSWORD    21 ADMIN_MOBILE
// 22 ADMIN_ROLE        23 STATUS            24 LICENSE_STATUS
// 25 REGISTERED_BY     26 REGISTERED_AT     27 LAST_UPDATED
function saveClient(d) {
  try {
    const ss    = SpreadsheetApp.openById(MASTER_SS_ID);
    const sheet = ss.getSheetByName('CLIENT_MASTER');
    if (!sheet) return { success: false, error: 'CLIENT_MASTER sheet not found' };

    // Validate required fields
    if (!d.CLIENT_ID)   return { success: false, error: 'CLIENT_ID missing' };
    if (!d.EMAIL)       return { success: false, error: 'EMAIL missing' };
    if (!d.CONTACT_NAME) return { success: false, error: 'CONTACT_NAME missing' };

    // Duplicate check
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
      if (ids.includes(d.CLIENT_ID)) {
        return { success: false, error: 'CLIENT_ID ' + d.CLIENT_ID + ' already exists' };
      }
    }

    const now = new Date().toISOString();
    const row = [
      d.CLIENT_ID        || '',
      d.CONTACT_NAME     || '',
      d.PHONE            || '',
      d.ALT_PHONE        || '',
      d.EMAIL            || '',
      d.COMPANY_NAME     || '',
      d.COMPANY_TYPE     || '',
      d.GST_NO           || '',
      d.PAN              || '',
      d.ADDRESS          || '',
      d.CITY             || '',
      d.STATE            || '',
      d.PIN              || '',
      d.INDUSTRY         || '',
      d.PLAN             || '',
      d.ERP_URL          || '',
      d.ADMIN_NAME       || '',
      d.ADMIN_EMAIL      || '',
      d.ADMIN_USERNAME   || '',
      d.ADMIN_PASSWORD   || '',
      d.ADMIN_MOBILE     || '',
      d.ADMIN_ROLE       || 'ADMIN',
      'ACTIVE',
      'ACTIVE',
      d.REGISTERED_BY    || 'WIZARD_V2',
      now,
      now
    ];
    sheet.appendRow(row);

    // Also write to USER_MASTER in USER_SECURITY_MASTER_DB
    _writeAdminUser(d, now);

    // Also write to FEATURE_CONTROL_MASTER
    _writeFeatureControl(d);

    return {
      success      : true,
      status       : 'success',
      message      : 'Client ' + d.CLIENT_ID + ' registered successfully',
      clientId     : d.CLIENT_ID
    };
  } catch (err) {
    logError('saveClient', err);
    return { success: false, error: err.message };
  }
}

// ── Write admin user to USER_SECURITY_MASTER_DB → USER_MASTER ─────
// USER_MASTER columns match the sheet you shared (35 columns)
function _writeAdminUser(d, now) {
  try {
    const ss    = SpreadsheetApp.openById(SECURITY_SS_ID);
    const sheet = ss.getSheetByName('USER_MASTER');
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    const nextUserId = lastRow; // row 1 = header, so lastRow = next USER_ID

    // Build username from company name if not supplied
    const username = d.ADMIN_USERNAME ||
      (d.COMPANY_NAME || d.CLIENT_ID).toLowerCase()
        .replace(/[^a-z0-9]/g, '_').substring(0, 15) + '_admin';

    sheet.appendRow([
      nextUserId,                      // USER_ID
      d.CLIENT_ID,                     // CLIENT_ID
      username.toUpperCase(),          // USER_CODE
      d.ADMIN_NAME || 'Admin',         // FULL_NAME
      d.ADMIN_EMAIL || d.EMAIL,        // EMAIL
      d.ADMIN_MOBILE || d.PHONE,       // MOBILE_NO
      d.ADMIN_PASSWORD || 'Admin@123', // PASSWORD
      d.ADMIN_ROLE || 'ADMIN',         // ROLE
      d.INDUSTRY || 'ALL',             // INDUSTRY
      'HEAD_OFFICE',                   // BRANCH
      'FULL',                          // ACCESS_LEVEL
      'ACTIVE',                        // STATUS
      'YES',                           // WEB_ACCESS
      'NO',                            // APP_ACCESS
      'YES',                           // OTP_ACCESS
      'PASSWORD+OTP',                  // LOGIN_TYPE
      d.COMPANY_NAME || '',            // COMPANY_NAME
      'MANAGEMENT',                    // DEPARTMENT
      'OWNER',                         // DESIGNATION
      'DASHBOARD',                     // DEFAULT_DASHBOARD
      'WIZARD_V2',                     // CREATED_BY
      now,                             // CREATED_DATE
      '',                              // LAST_LOGIN
      0,                               // FAILED_ATTEMPTS
      'NO',                            // ACCOUNT_LOCKED
      '',                              // SESSION_TOKEN
      '',                              // OTP_EXPIRY
      '',                              // OTP
      'Auto-created by wizard',        // REMARK
      '',                              // PASSWORD_UPDATED
      d.PLAN || 'STARTER',             // PLAN_NAME
      'ACTIVE',                        // LICENSE_STATUS
      'MD',                            // REPORTING_TO
      '',                              // PHOTO_URL
      ''                               // EXPIRY_DATE
    ]);
  } catch (err) {
    logError('_writeAdminUser', err);
  }
}

// ── Write to FEATURE_CONTROL_MASTER ───────────────────────────────
const MODULE_MAP = {
  RESTAURANT    : 'YES,YES,YES,NO,NO,YES,NO,NO,YES,NO,YES',
  RESTAURANT_PUB: 'YES,YES,YES,YES,NO,YES,NO,NO,YES,NO,YES',
  BAR           : 'YES,YES,YES,NO,NO,YES,NO,NO,YES,NO,YES',
  HOTEL         : 'YES,YES,YES,YES,YES,YES,YES,NO,YES,YES,YES',
  BAKERY        : 'YES,YES,YES,NO,NO,YES,NO,YES,YES,NO,YES',
  CLOUD_KITCHEN : 'YES,YES,YES,NO,NO,YES,NO,YES,NO,NO,YES',
  FACTORY       : 'YES,YES,YES,YES,YES,YES,YES,YES,NO,YES,YES',
  TEA_GARDEN    : 'YES,YES,YES,YES,YES,YES,YES,YES,NO,YES,YES',
  DISTRIBUTOR   : 'YES,YES,YES,YES,NO,YES,YES,NO,NO,NO,YES',
  MEDICAL_STORE : 'YES,YES,YES,YES,NO,YES,YES,NO,NO,NO,YES',
};
// columns: INVENTORY,PURCHASE,SALES,CRM,HR,FINANCE,WAREHOUSE,PRODUCTION,RESTAURANT,AI_ANALYTICS,ACTIVE
function _writeFeatureControl(d) {
  try {
    const ss    = SpreadsheetApp.openById(MASTER_SS_ID);
    const sheet = ss.getSheetByName('FEATURE_CONTROL_MASTER');
    if (!sheet) return;
    const modules = (MODULE_MAP[d.INDUSTRY] || 'YES,YES,YES,NO,NO,YES,NO,NO,NO,NO,YES').split(',');
    sheet.appendRow([d.CLIENT_ID, d.INDUSTRY, d.PLAN || 'STARTER', ...modules]);
  } catch (err) {
    logError('_writeFeatureControl', err);
  }
}

// ── GET ALL CLIENTS (for View All button) ─────────────────────────
function getAllClients() {
  try {
    const ss    = SpreadsheetApp.openById(MASTER_SS_ID);
    const sheet = ss.getSheetByName('CLIENT_MASTER');
    if (!sheet) return { success: false, error: 'CLIENT_MASTER sheet not found' };
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, clients: [], total: 0 };
    const data    = sheet.getRange(2, 1, lastRow - 1, 27).getValues();
    const headers = ['CLIENT_ID','CONTACT_NAME','PHONE','ALT_PHONE','EMAIL','COMPANY_NAME',
                     'COMPANY_TYPE','GST_NO','PAN','ADDRESS','CITY','STATE','PIN','INDUSTRY',
                     'PLAN','ERP_URL','ADMIN_NAME','ADMIN_EMAIL','ADMIN_USERNAME','ADMIN_PASSWORD',
                     'ADMIN_MOBILE','ADMIN_ROLE','STATUS','LICENSE_STATUS','REGISTERED_BY',
                     'REGISTERED_AT','LAST_UPDATED'];
    const clients = data.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    return { success: true, clients, total: clients.length };
  } catch (err) {
    logError('getAllClients', err);
    return { success: false, error: err.message };
  }
}

// ── ERROR LOGGER ───────────────────────────────────────────────────
function logError(fn, err) {
  try {
    const ss    = SpreadsheetApp.openById(MASTER_SS_ID);
    const sheet = ss.getSheetByName('ERROR_LOG');
    if (sheet) sheet.appendRow([new Date().toISOString(), fn + ': ' + err.message, err.stack || '']);
  } catch (e) { /* swallow */ }
}
