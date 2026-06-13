/**
 * BALAJI NEXTGEN ERP — Google Apps Script Backend (code.gs)
 * FIX #4: Google Drive Shared Database
 * FIX #6: Super Admin live control panel sync
 * FIX #2: USER_MASTER + USER_SECURITY_MASTER proper column handling
 *
 * DEPLOY:
 * 1. Open Google Apps Script (script.google.com)
 * 2. Paste this code
 * 3. Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the deployment URL → paste in erp-config.js as ERP_DB_CONFIG.GAS_URL
 */

/* ─── CONFIG ────────────────────────────────────────────────── */
const SHEET_ID     = '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I'; // ← YOUR SHEET ID
const SECRET_KEY   = 'BALAJI_ERP_SECRET_2025';  // Change this!
const SESSION_HOURS_DEFAULT    = 8;
const SESSION_HOURS_SUPER_ADMIN = 2;

/* ─── SHEET NAMES ────────────────────────────────────────────── */
const SHEETS = {
  USER_MASTER          : 'USER_MASTER',
  USER_SECURITY_MASTER : 'USER_SECURITY_MASTER',
  CLIENT_MASTER        : 'CLIENT_MASTER',
  TEMPLATE_REGISTRY    : 'TEMPLATE_REGISTRY',
  SESSION_LOG          : 'SESSION_LOG',
  CONTROL_CONFIG       : 'CONTROL_CONFIG',
};

/* ─── CORS HEADERS ───────────────────────────────────────────── */
function _cors(output) {
  return output
    .addHeader('Access-Control-Allow-Origin', '*')
    .addHeader('Access-Control-Allow-Methods', 'GET, POST')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/* ─── ENTRY POINTS ────────────────────────────────────────────── */
function doGet(e) {
  const action = (e.parameter && e.parameter.action) || 'PING';
  if (action === 'PING') {
    return _cors(ContentService.createTextOutput(
      JSON.stringify({ status:'ok', message:'Balaji ERP GAS v5.0 running', ts: Date.now() })
    ).setMimeType(ContentService.MimeType.JSON));
  }
  return _cors(ContentService.createTextOutput(
    JSON.stringify({ status:'error', message:'Use POST for API calls' })
  ).setMimeType(ContentService.MimeType.JSON));
}

function doPost(e) {
  let body, response;
  try {
    body     = JSON.parse(e.postData.contents);
    response = _route(body);
  } catch(err) {
    response = { status:'error', message:'Server error: ' + err.message };
  }
  return _cors(ContentService.createTextOutput(
    JSON.stringify(response)
  ).setMimeType(ContentService.MimeType.JSON));
}

/* ─── ROUTER ─────────────────────────────────────────────────── */
function _route(body) {
  const action = (body.action || '').toUpperCase();
  switch(action) {
    case 'LOGIN':             return _login(body);
    case 'OTP_LOGIN':         return _otpLogin(body);
    case 'SEND_OTP':          return _sendOTP(body);
    case 'LOGOUT':            return _logout(body);
    case 'VERIFY_SESSION':    return _verifySession(body);
    case 'GET_USER':          return _getUser(body);
    case 'LIST_USERS':        return _listUsers(body);
    case 'CREATE_USER':       return _createUser(body);
    case 'UPDATE_USER':       return _updateUser(body);
    case 'DEACTIVATE_USER':   return _deactivateUser(body);
    case 'GET_USER_SECURITY': return _getUserSecurity(body);
    case 'SET_USER_SECURITY': return _setUserSecurity(body);
    case 'GET_CONTROL_CONFIG':return _getControlConfig(body);
    case 'SET_CONTROL_CONFIG':return _setControlConfig(body);
    case 'GET_CLIENT':        return _getClient(body);
    default:                  return { status:'error', message:'Unknown action: ' + action };
  }
}

/* ─── HELPERS ────────────────────────────────────────────────── */
function _getSheet(name) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

function _sheetToObjects(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim().toUpperCase());
  return data.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] !== undefined ? row[i] : '']))
  ).filter(row => Object.values(row).some(v => v !== ''));
}

function _hashPassword(pw) {
  // Simple hash — use proper bcrypt in production via external API
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    pw + SECRET_KEY, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('').toUpperCase();
}

function _generateToken() {
  return Utilities.getUuid().replace(/-/g, '').toUpperCase();
}

function _sessionExpiry(role) {
  const hrs = role === 'SUPER_ADMIN' ? SESSION_HOURS_SUPER_ADMIN : SESSION_HOURS_DEFAULT;
  return new Date(Date.now() + hrs * 3600000).toISOString();
}

function _logSession(action, user, token) {
  try {
    let s = _getSheet(SHEETS.SESSION_LOG);
    if (!s) {
      SpreadsheetApp.openById(SHEET_ID).insertSheet(SHEETS.SESSION_LOG);
      s = _getSheet(SHEETS.SESSION_LOG);
      s.appendRow(['TIMESTAMP','USER_CODE','FULL_NAME','ROLE','ACTION','TOKEN','IP']);
    }
    s.appendRow([new Date().toISOString(), user.USER_CODE||'', user.FULL_NAME||'',
                 user.ROLE||'', action, token||'', '']);
  } catch(e) {}
}

/* ─── LOGIN ──────────────────────────────────────────────────── */
function _login(body) {
  const loginId  = String(body.loginId  || body.login_id  || '').trim().toLowerCase();
  const password = String(body.password || '').trim();

  if (!loginId || !password) return { status:'error', message:'Login ID and password required' };

  const users = _sheetToObjects(_getSheet(SHEETS.USER_MASTER));
  const user  = users.find(u => {
    const em = String(u.EMAIL  || '').toLowerCase().trim();
    const mo = String(u.MOBILE || '').trim();
    return (em === loginId || mo === loginId) && String(u.STATUS||'').toUpperCase() === 'ACTIVE';
  });

  if (!user) return { status:'error', message:'Invalid credentials or account not active' };

  // Password check
  const storedHash = String(user.PASSWORD_HASH || '').toUpperCase();
  const inputHash  = _hashPassword(password);
  const isDemo     = (password === 'admin' && loginId === 'admin'); // remove in production

  if (storedHash !== inputHash && !isDemo) {
    return { status:'error', message:'Invalid credentials' };
  }

  const token   = _generateToken();
  const expiry  = _sessionExpiry(user.ROLE);

  // Update LAST_LOGIN in sheet
  try {
    const sheet = _getSheet(SHEETS.USER_MASTER);
    const data  = sheet.getDataRange().getValues();
    const hdrs  = data[0].map(h => String(h).toUpperCase());
    const llCol = hdrs.indexOf('LAST_LOGIN');
    if (llCol >= 0) {
      for (let r = 1; r < data.length; r++) {
        if (String(data[r][hdrs.indexOf('USER_CODE')]).trim() === String(user.USER_CODE).trim()) {
          sheet.getRange(r + 1, llCol + 1).setValue(new Date().toISOString());
          break;
        }
      }
    }
  } catch(e) {}

  _logSession('LOGIN', user, token);

  return {
    status: 'success',
    ok: true,
    sessionToken: token,
    sessionExpiry: expiry,
    ROLE          : user.ROLE,
    FULL_NAME     : user.FULL_NAME,
    EMAIL         : user.EMAIL,
    MOBILE        : user.MOBILE,
    USER_CODE     : user.USER_CODE,
    CLIENT_ID     : user.CLIENT_ID,
    BRANCH        : user.BRANCH,
    INDUSTRY      : user.INDUSTRY,
    DASHBOARD_OVERRIDE: user.DASHBOARD_OVERRIDE || '',
    message       : 'Login successful',
  };
}

/* ─── LOGOUT ─────────────────────────────────────────────────── */
function _logout(body) {
  _logSession('LOGOUT', { USER_CODE: body.userCode||'', FULL_NAME:'', ROLE:'' }, body.sessionToken||'');
  return { status:'ok', message:'Logged out' };
}

/* ─── VERIFY SESSION ─────────────────────────────────────────── */
function _verifySession(body) {
  // Token-based verification (full implementation needs a session sheet)
  if (!body.sessionToken) return { status:'error', message:'No token' };
  // For now: return success (enhance with session store in production)
  return { status:'success', message:'Session valid' };
}

/* ─── GET USER ────────────────────────────────────────────────── */
function _getUser(body) {
  const users = _sheetToObjects(_getSheet(SHEETS.USER_MASTER));
  const user = users.find(u => u.USER_CODE === body.userCode || u.EMAIL === body.email);
  if (!user) return { status:'error', message:'User not found' };
  delete user.PASSWORD_HASH;
  return { status:'success', user };
}

/* ─── LIST USERS (Super Admin) ────────────────────────────────── */
function _listUsers(body) {
  const users = _sheetToObjects(_getSheet(SHEETS.USER_MASTER)).map(u => {
    const safe = Object.assign({}, u);
    delete safe.PASSWORD_HASH;
    return safe;
  });
  return { status:'success', users, count: users.length };
}

/* ─── CREATE USER ─────────────────────────────────────────────── */
function _createUser(body) {
  const sheet = _getSheet(SHEETS.USER_MASTER);
  const u = body.user || body;
  const userCode = 'USR' + String(Date.now()).slice(-6);
  const hash     = _hashPassword(u.password || 'Welcome@123');
  sheet.appendRow([
    userCode, u.FULL_NAME||'', u.EMAIL||'', u.MOBILE||'',
    hash, u.ROLE||'STAFF', u.CLIENT_ID||'', u.BRANCH||'',
    u.INDUSTRY||'', 'ACTIVE', new Date().toISOString(), '', 'FALSE', u.DASHBOARD_OVERRIDE||'', u.NOTES||''
  ]);
  return { status:'success', message:'User created', USER_CODE: userCode };
}

/* ─── UPDATE USER ─────────────────────────────────────────────── */
function _updateUser(body) {
  const sheet = _getSheet(SHEETS.USER_MASTER);
  const data  = sheet.getDataRange().getValues();
  const hdrs  = data[0].map(h => String(h).toUpperCase());
  const ucCol = hdrs.indexOf('USER_CODE');
  const u     = body.user || body;

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][ucCol]).trim() === String(u.USER_CODE||body.userCode).trim()) {
      const fields = {FULL_NAME:1,EMAIL:2,MOBILE:3,ROLE:5,CLIENT_ID:6,BRANCH:7,
                      INDUSTRY:8,STATUS:9,DASHBOARD_OVERRIDE:13,NOTES:14};
      Object.entries(fields).forEach(([key, colIdx]) => {
        if (u[key] !== undefined && hdrs[colIdx] === key) {
          sheet.getRange(r+1, colIdx+1).setValue(u[key]);
        }
      });
      // Update by key name safely
      Object.keys(u).forEach(key => {
        const ci = hdrs.indexOf(key.toUpperCase());
        if (ci >= 0 && key !== 'USER_CODE' && key !== 'PASSWORD_HASH') {
          sheet.getRange(r+1, ci+1).setValue(u[key]);
        }
      });
      return { status:'success', message:'User updated' };
    }
  }
  return { status:'error', message:'User not found' };
}

/* ─── DEACTIVATE USER ─────────────────────────────────────────── */
function _deactivateUser(body) {
  return _updateUser({ user:{ USER_CODE: body.userCode, STATUS: 'INACTIVE' } });
}

/* ─── USER SECURITY ───────────────────────────────────────────── */
function _getUserSecurity(body) {
  const rows = _sheetToObjects(_getSheet(SHEETS.USER_SECURITY_MASTER));
  const perms = rows.filter(r => r.USER_CODE === body.userCode);
  return { status:'success', permissions: perms };
}

function _setUserSecurity(body) {
  const sheet = _getSheet(SHEETS.USER_SECURITY_MASTER);
  const p = body.permission || body;
  sheet.appendRow([
    p.USER_CODE||'', p.CLIENT_ID||'', p.MODULE||'',
    p.CAN_VIEW||'FALSE', p.CAN_ADD||'FALSE', p.CAN_EDIT||'FALSE',
    p.CAN_DELETE||'FALSE', p.CAN_EXPORT||'FALSE', p.CAN_APPROVE||'FALSE',
    'TRUE', // OVERRIDE_BY_SUPER_ADMIN
    new Date().toISOString(), p.EFFECTIVE_TO||'',
    p.UPDATED_BY||'SUPER_ADMIN', p.NOTES||''
  ]);
  return { status:'success', message:'Security permission saved' };
}

/* ─── CONTROL CONFIG (FIX #6: Super Admin live mobile control) ── */
function _getControlConfig(body) {
  try {
    let s = _getSheet(SHEETS.CONTROL_CONFIG);
    if (!s) return { status:'ok', config: {} };
    const data = s.getDataRange().getValues();
    if (data.length < 2) return { status:'ok', config: {} };
    // Store as single row: col A = key, col B = value
    const config = {};
    for (let r = 1; r < data.length; r++) {
      if (data[r][0]) config[data[r][0]] = data[r][1];
    }
    return { status:'success', config };
  } catch(e) { return { status:'error', message: e.message }; }
}

function _setControlConfig(body) {
  try {
    let sheet = _getSheet(SHEETS.CONTROL_CONFIG);
    if (!sheet) {
      SpreadsheetApp.openById(SHEET_ID).insertSheet(SHEETS.CONTROL_CONFIG);
      sheet = _getSheet(SHEETS.CONTROL_CONFIG);
      sheet.appendRow(['KEY','VALUE','UPDATED_AT','UPDATED_BY']);
    }
    const cfg   = body.config || {};
    const data  = sheet.getDataRange().getValues();
    const keys  = data.slice(1).map(r => r[0]);
    const now   = new Date().toISOString();
    const by    = body.updatedBy || 'SUPER_ADMIN';

    Object.entries(cfg).forEach(([key, val]) => {
      const ri = keys.indexOf(key);
      if (ri >= 0) {
        sheet.getRange(ri+2, 2, 1, 3).setValues([[val, now, by]]);
      } else {
        sheet.appendRow([key, val, now, by]);
      }
    });
    return { status:'success', message:'Control config saved to Google Sheet' };
  } catch(e) { return { status:'error', message: e.message }; }
}

/* ─── CLIENT INFO ─────────────────────────────────────────────── */
function _getClient(body) {
  const clients = _sheetToObjects(_getSheet(SHEETS.CLIENT_MASTER));
  const client  = clients.find(c => c.CLIENT_ID === body.clientId);
  if (!client) return { status:'error', message:'Client not found' };
  return { status:'success', client };
}
