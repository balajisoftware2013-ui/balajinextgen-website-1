// ════════════════════════════════════════════════════════════════
//  Balaji WealthPilot360 - STABLE BACKEND v25 FINAL
//  WITH PROFESSIONAL CATEGORY LIST
//  Powered by: Balaji NextGen Solutions
// ════════════════════════════════════════════════════════════════

const WP360_CONFIG = {
  MASTER_CONTROL_SHEET_ID: '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I',
  USER_SECURITY_SHEET_ID:  '1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg',
  TEMPLATE_SHEET_ID_FALLBACK: '1OpSQYEDBMw2Pawbwu80UcoIofj-yqJzNGhxx-9XeWwk',
  CLIENTS_ROOT_FOLDER_ID:   '1lY4wLnjtA0wkoKhYb6Q-JTSeyo0haRJm',
  CLIENT_DB_SUBFOLDER_NAME: 'CLIENT_DATABASES',
  INDUSTRY: 'WEALTH360',
  PLAN_DAYS: { trial: 90, starter: 365, professional: 365, enterprise: 3650 }
};

const WP360_MASTER_TABS = {
  DASHBOARD:     '📊 Dashboard',
  USERS:         '👤 Users',
  TRANSACTION:   '💰 Transactions',
  CATEGORY:      '📂 Categories',
  ACCOUNT:       '🏦 Accounts',
  PERSON:        '👥 Persons',
  RECEIVABLE:    '📥 Receivables',
  PAYABLE:       '📤 Payables',
  CASH_BOOK:     '📖 CashBook',
  BANK_BOOK:     '📕 BankBook',
  REPORTS:       '📊 Reports',
  SETTINGS:      '⚙️ Settings',
  APP_META:      'App_Meta',
  BACKUP_LOG:    'BackupLog'
};

// ════════════════════════════════════════════════════════════════
// PROFESSIONAL CATEGORY LIST
// ════════════════════════════════════════════════════════════════

const WP360_CATEGORIES = {
  Business: {
    Administrative: [
      "Office Expenses", "Office Stationery", "Printing & Photocopy", "Courier & Postage",
      "Documentation Charges", "Membership Fees", "Subscription Charges", "Software Subscription",
      "Office Supplies", "Miscellaneous Expenses"
    ],
    Employee: [
      "Salaries & Wages", "Bonus", "Incentives", "Overtime", "Staff Welfare", "Staff Uniform",
      "Recruitment Expenses", "Training Expenses", "Employee Insurance", "Leave Encashment",
      "Gratuity", "PF Contribution", "ESI Contribution", "Professional Tax", "Labour Charges"
    ],
    "Travel & Conveyance": [
      "Local Conveyance", "Fuel Expenses", "Diesel Expenses", "Petrol Expenses",
      "Vehicle Maintenance", "Vehicle Insurance", "Parking Charges", "Toll Charges",
      "Taxi Expenses", "Air Travel", "Train Travel", "Hotel Accommodation", "Daily Allowance"
    ],
    Utilities: [
      "Electricity", "Water Charges", "Internet Charges", "Telephone Bills", "Mobile Expenses",
      "Gas Charges", "Generator Expenses", "Security Charges", "Housekeeping Charges"
    ],
    "Rent & Property": [
      "Office Rent", "Warehouse Rent", "Factory Rent", "Shop Rent", "Building Maintenance",
      "Property Tax", "Municipal Tax", "Society Maintenance"
    ],
    Finance: [
      "Bank Charges", "Interest on Loan", "Interest on OD/CC", "Loan Processing Fees",
      "Credit Card Charges", "Finance Charges", "EMI Interest", "Penalty Charges"
    ],
    "Marketing & Sales": [
      "Advertisement", "Digital Marketing", "Facebook Ads", "Google Ads", "Banner & Hoarding",
      "Printing & Promotion", "Commission Paid", "Sales Promotion", "Exhibition Expenses",
      "Sponsorship", "Gift Expenses"
    ],
    Professional: [
      "CA Fees", "Advocate Fees", "Consultancy Charges", "Audit Fees", "ROC Filing Fees",
      "GST Filing Charges", "TDS Filing Charges", "Company Secretary Fees"
    ],
    Manufacturing: [
      "Raw Material", "Packing Material", "Consumables", "Factory Expenses", "Machine Repair",
      "Factory Maintenance", "Power & Fuel", "Production Labour", "Quality Control Expenses"
    ],
    Inventory: [
      "Freight Inward", "Loading Charges", "Unloading Charges", "Warehousing Charges",
      "Inventory Loss", "Damage Expenses", "Packaging Expenses"
    ],
    IT: [
      "Computer Repair", "Laptop Purchase", "Printer Maintenance", "Server Charges",
      "Cloud Hosting", "Website Expenses", "Domain Renewal", "Software License",
      "Antivirus", "Data Backup"
    ],
    "Legal & Compliance": [
      "GST Payment", "TDS Interest", "GST Interest", "Late Fees", "Penalty",
      "Legal Expenses", "Registration Fees", "License Renewal"
    ],
    Insurance: [
      "Fire Insurance", "Vehicle Insurance", "Employee Insurance", "Medical Insurance", "Asset Insurance"
    ],
    "Repairs & Maintenance": [
      "Building Repairs", "Furniture Repairs", "Machinery Repairs", "Computer Repairs",
      "Electrical Repairs", "Plumbing Repairs", "AMC Charges"
    ],
    "Entertainment & Hospitality": [
      "Business Meeting Expenses", "Client Entertainment", "Tea & Coffee", "Refreshments",
      "Business Lunch", "Guest Hospitality"
    ],
    Miscellaneous: [
      "Donation", "CSR Expenses", "Bad Debts", "Charity", "Miscellaneous Expenses"
    ]
  },
  Personal: {
    Household: [
      "House Rent", "Home Maintenance", "Electricity Bill", "Water Bill", "Gas Bill",
      "Internet Bill", "Mobile Recharge", "DTH/Cable TV", "Maid Salary", "Security Charges"
    ],
    Food: [
      "Groceries", "Vegetables", "Fruits", "Milk", "Bakery", "Restaurant", "Fast Food",
      "Tea & Snacks", "Online Food Delivery"
    ],
    Transportation: [
      "Fuel", "Taxi", "Auto", "Bus", "Metro", "Train", "Flight", "Vehicle Service",
      "Vehicle Insurance", "Parking", "Toll"
    ],
    Family: [
      "Family Support", "Parents Expenses", "Children's Expenses", "Pocket Money",
      "Birthday Expenses", "Anniversary Expenses"
    ],
    Education: [
      "School Fees", "College Fees", "Tuition Fees", "Books", "Stationery",
      "Online Courses", "Coaching Fees"
    ],
    Healthcare: [
      "Doctor Consultation", "Medicines", "Hospital Bills", "Medical Tests",
      "Health Insurance", "Dental", "Eye Care", "Fitness"
    ],
    Shopping: [
      "Clothing", "Shoes", "Bags", "Cosmetics", "Electronics", "Furniture", "Home Appliances"
    ],
    "Personal Care": [
      "Haircut", "Beauty Salon", "Spa", "Gym Membership", "Personal Hygiene"
    ],
    Entertainment: [
      "Movies", "OTT Subscription", "Games", "Vacation", "Picnic", "Club Membership"
    ],
    Financial: [
      "Loan EMI", "Home Loan EMI", "Personal Loan EMI", "Credit Card Payment",
      "SIP Investment", "Mutual Funds", "Fixed Deposit", "Insurance Premium",
      "Income Tax", "Property Tax"
    ],
    "Gifts & Donations": [
      "Gifts", "Charity", "Religious Donation", "Festival Expenses"
    ],
    Miscellaneous: [
      "Bank Charges", "ATM Charges", "Penalties", "Miscellaneous Expenses"
    ]
  }
};

const WP360_DEFAULT_ACCOUNTS = ['Cash', 'SBI', 'HDFC', 'ICICI', 'Axis', 'UPI', 'Credit Card', 'Wallet'];

const WP360_DEFAULT_PERSONS = ['Self', 'Family', 'Customer', 'Supplier', 'Employee', 'Friend', 'Other'];

// ════════════════════════════════════════════════════════════════
// CACHE & PERFORMANCE LAYER
// ════════════════════════════════════════════════════════════════

const WP360_Cache = {
  TTL_MS: 5 * 60 * 1000,
  
  _key: (uid, type) => `WP360_${uid}_${type}`,
  
  get: function(uid, type) {
    try {
      const props = PropertiesService.getScriptProperties();
      const cached = props.getProperty(this._key(uid, type));
      if (!cached) return null;
      const obj = JSON.parse(cached);
      if (Date.now() - obj.ts > this.TTL_MS) {
        this.clear(uid, type);
        return null;
      }
      return obj.data;
    } catch(e) { return null; }
  },
  
  set: function(uid, type, data) {
    try {
      const props = PropertiesService.getScriptProperties();
      props.setProperty(this._key(uid, type), JSON.stringify({ ts: Date.now(), data: data }));
    } catch(e) { Logger.log('Cache set warning: ' + e); }
  },
  
  clear: function(uid, type) {
    try {
      const props = PropertiesService.getScriptProperties();
      props.deleteProperty(this._key(uid, type));
    } catch(e) {}
  },
  
  clearAll: function(uid) {
    try {
      const props = PropertiesService.getScriptProperties();
      const keys = props.getKeys();
      keys.forEach(k => { if (k.startsWith('WP360_' + uid + '_')) props.deleteProperty(k); });
    } catch(e) {}
  }
};

// ════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════

function doPost(e) {
  let payload;
  try { payload = JSON.parse(e.postData.contents); }
  catch(err) { return WP360_resp(false, 'Invalid JSON: ' + err); }

  const { action, uid, data } = payload;
  const lock = (action === 'REGISTER_CLIENT' || action === 'SAVE_TX') ? LockService.getScriptLock() : null;

  try {
    if (lock) lock.waitLock(30000);
    
    switch (action) {
      case 'SAVE_USERS':           return WP360_resp(true, WP360_saveUsers(data));
      case 'LOAD_USERS':           return WP360_resp(true, WP360_loadUsers());
      case 'SAVE_DB':              return WP360_resp(true, WP360_saveClientDb(uid, data));
      case 'LOAD_DB':              return WP360_resp(true, WP360_loadClientDb(uid));
      case 'SAVE_TX':              return WP360_resp(true, WP360_saveSingleTransaction(uid, data));
      case 'UPDATE_TX':            return WP360_resp(true, WP360_updateTransaction(uid, data));
      case 'DELETE_TX':            return WP360_resp(true, WP360_deleteTransaction(uid, data));
      case 'GET_TRANSACTIONS':     return WP360_resp(true, WP360_getTransactions(uid, data));
      case 'GET_MASTERS':          return WP360_resp(true, WP360_getMasters(uid));
      case 'UPDATE_MASTERS':       return WP360_resp(true, WP360_updateMasters(uid, data));
      case 'REGISTER_CLIENT':      return WP360_resp(true, WP360_registerClient(data));
      case 'LOGIN_CLIENT':         return WP360_resp(true, WP360_loginClient(data));
      case 'CHECK_CONTACT':        return WP360_resp(true, WP360_checkContact(data));
      case 'GET_CLIENT':           return WP360_resp(true, WP360_getClientInfo(uid));
      case 'UPDATE_PROFILE':       return WP360_resp(true, WP360_updateProfile(uid, data));
      case 'DIAG':                 return WP360_resp(true, WP360_diag());
      case 'DEBUG_CLIENT':         return WP360_resp(true, WP360_debugClientData(uid));
      case 'PING':                 return WP360_resp(true, 'pong');
      default:                     return WP360_resp(false, 'Unknown action: ' + action);
    }
  } catch(err) {
    WP360_logError(action, err.toString());
    return WP360_resp(false, (action||'?') + ' failed: ' + err.toString());
  } finally {
    if (lock) { try { lock.releaseLock(); } catch(e) {} }
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') return WP360_resp(true, 'pong');
  if (action === 'diag') return WP360_resp(true, WP360_diag());
  return ContentService.createTextOutput(JSON.stringify({
    status: 'WealthPilot360 v25 OK',
    poweredBy: 'Balaji NextGen Solutions'
  })).setMimeType(ContentService.MimeType.JSON);
}

function WP360_resp(success, data) {
  return ContentService.createTextOutput(JSON.stringify({
    success, data: data !== undefined ? data : (success ? null : 'Unknown error')
  })).setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════════
// CLIENT REGISTRATION & LOGIN
// ════════════════════════════════════════════════════════════════

function WP360_nextClientId() {
  let maxNum = 0;
  const scanForMax = (spreadsheetId, tabName, col) => {
    try {
      const sh = SpreadsheetApp.openById(spreadsheetId).getSheetByName(tabName);
      if (!sh) return;
      const values = sh.getDataRange().getValues();
      const header = values[0];
      const idx = header.indexOf(col);
      if (idx === -1) return;
      for (let i = 1; i < values.length; i++) {
        const v = String(values[i][idx] || '').trim();
        const m = v.match(/^CL0*([0-9]+)$/i);
        if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
      }
    } catch(e) {}
  };
  scanForMax(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'CLIENT_ID');
  const next = maxNum + 1;
  return 'CL' + String(next).padStart(5, '0');
}

function WP360_registerClient(dataJson) {
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ status: 'parse_error' }); }

  const loginId = d.uid || d.userid;
  if (!loginId) return JSON.stringify({ status: 'no_uid' });

  const existingLogin = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'ADMIN_USERNAME', loginId);
  if (existingLogin) {
    const ex = WP360_getClientSheetId(existingLogin.CLIENT_ID);
    return JSON.stringify({
      status: 'already_exists',
      clientId: existingLogin.CLIENT_ID,
      clientSheetId: ex ? ex.id : '',
      clientSheetUrl: ex ? ex.url : ''
    });
  }

  const dup = WP360_findDuplicateContact(d.mobile, d.email);
  if (dup) {
    const ex = WP360_getClientSheetId(dup.clientId);
    return JSON.stringify({
      status: dup.field === 'mobile' ? 'duplicate_mobile' : 'duplicate_email',
      existingClientId: dup.clientId,
      existingName: dup.name,
      clientSheetUrl: ex ? ex.url : ''
    });
  }

  const uid = WP360_nextClientId();
  const sheetInfo = WP360_createClientSheet(uid, d.name, d.mobile, d.email, WP360_hashPass(d.password || ''), d.plan || 'trial');
  const now = new Date();
  const planDays = WP360_CONFIG.PLAN_DAYS[d.plan] || 90;
  const expiry = new Date(Date.now() + planDays * 86400000);

  WP360_appendRowByHeader(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', {
    CLIENT_ID: uid,
    CONTACT_NAME: d.name || '',
    PHONE: d.mobile || '',
    EMAIL: d.email || '',
    COMPANY_NAME: d.name || '',
    PLAN: d.plan || 'trial',
    STATUS: 'ACTIVE',
    ADMIN_USERNAME: loginId,
    ADMIN_PASSWORD: d.password || '',
    INDUSTRY: WP360_CONFIG.INDUSTRY,
    REGISTERED_AT: now,
    LAST_UPDATED: now
  });

  WP360_appendRowByHeader(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', {
    CLIENT_ID: uid,
    COMPANY_NAME: d.name || '',
    MASTER_DB_ID: sheetInfo.id,
    MASTER_DB_URL: sheetInfo.url,
    CREATED_ON: now,
    STATUS: 'ACTIVE'
  });

  WP360_Cache.clearAll(uid);
  Logger.log('Registered client: ' + uid + ' -> ' + sheetInfo.url);

  return JSON.stringify({
    status: 'registered',
    clientId: uid,
    loginId: loginId,
    clientSheetId: sheetInfo.id,
    clientSheetUrl: sheetInfo.url
  });
}

function WP360_loginClient(dataJson) {
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ status: 'parse_error' }); }

  const loginInput = String(d.uid || d.userid || d.mobile || '').trim();
  if (!loginInput) return JSON.stringify({ status: 'no_login_id' });

  let row = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'ADMIN_USERNAME', loginInput);
  if (!row) row = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'PHONE', loginInput);
  if (!row) return JSON.stringify({ status: 'not_found' });

  if (d.password) {
    const hashed = WP360_hashPass(d.password);
    if (String(row.ADMIN_PASSWORD) !== hashed) {
      return JSON.stringify({ status: 'wrong_password' });
    }
  }

  const sheetInfo = WP360_getClientSheetId(row.CLIENT_ID);
  return JSON.stringify({
    status: 'ok',
    clientId: row.CLIENT_ID,
    loginId: row.ADMIN_USERNAME,
    name: row.CONTACT_NAME || row.COMPANY_NAME || '',
    mobile: row.PHONE || '',
    email: row.EMAIL || '',
    clientSheetId: sheetInfo ? sheetInfo.id : '',
    clientSheetUrl: sheetInfo ? sheetInfo.url : ''
  });
}

function WP360_checkContact(dataJson) {
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ duplicate: false }); }

  const dup = WP360_findDuplicateContact(d.mobile, d.email);
  if (!dup) return JSON.stringify({ duplicate: false });

  const ex = WP360_getClientSheetId(dup.clientId);
  return JSON.stringify({
    duplicate: true,
    field: dup.field,
    existingClientId: dup.clientId,
    existingName: dup.name,
    clientSheetUrl: ex ? ex.url : ''
  });
}

function WP360_findDuplicateContact(mobile, email, excludeClientId) {
  try {
    const clients = WP360_findAllRows(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'INDUSTRY', WP360_CONFIG.INDUSTRY);
    const m = mobile ? String(mobile).trim() : '';
    const e = email ? String(email).trim().toLowerCase() : '';
    for (let i = 0; i < clients.length; i++) {
      const c = clients[i];
      if (excludeClientId && String(c.CLIENT_ID).trim() === String(excludeClientId).trim()) continue;
      if (m && String(c.PHONE || '').trim() === m) {
        return { field: 'mobile', clientId: c.CLIENT_ID, name: c.CONTACT_NAME || c.COMPANY_NAME || '' };
      }
      if (e && String(c.EMAIL || '').trim().toLowerCase() === e) {
        return { field: 'email', clientId: c.CLIENT_ID, name: c.CONTACT_NAME || c.COMPANY_NAME || '' };
      }
    }
    return null;
  } catch(err) { return null; }
}

function WP360_updateProfile(uid, dataJson) {
  if (!uid) return JSON.stringify({ status: 'no_uid' });
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ status: 'parse_error' }); }

  const cm = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'CLIENT_ID', uid);
  if (!cm) return JSON.stringify({ status: 'not_found' });

  const name = (d.name !== undefined) ? String(d.name).trim() : cm.CONTACT_NAME;
  const mobile = (d.mobile !== undefined) ? String(d.mobile).trim() : cm.PHONE;
  const email = (d.email !== undefined) ? String(d.email).trim() : cm.EMAIL;

  const ts = new Date();
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'CONTACT_NAME', name);
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'PHONE', mobile);
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'EMAIL', email);
  WP360_updateCell(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', cm._rowIndex, 'LAST_UPDATED', ts);

  WP360_Cache.clearAll(uid);
  Logger.log('Profile updated for ' + uid);
  return JSON.stringify({ status: 'ok', name, mobile, email });
}

function WP360_getClientInfo(uid) {
  if (!uid) return null;
  const cm = WP360_findRow(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'CLIENT_MASTER', 'CLIENT_ID', uid);
  if (!cm) return null;
  const sheetRef = WP360_getClientSheetId(uid);
  return JSON.stringify({
    uid: uid,
    name: cm.CONTACT_NAME,
    mobile: cm.PHONE,
    email: cm.EMAIL,
    plan: cm.PLAN,
    status: cm.STATUS,
    clientSheetId: sheetRef ? sheetRef.id : '',
    clientSheetUrl: sheetRef ? sheetRef.url : ''
  });
}

// ════════════════════════════════════════════════════════════════
// TRANSACTION ENGINE - UNIFIED SINGLE SYSTEM
// ════════════════════════════════════════════════════════════════

function WP360_generateTxId() {
  return 'TX' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function WP360_saveSingleTransaction(uid, dataJson) {
  if (!uid) return JSON.stringify({ status: 'no_uid' });
  
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ status: 'parse_error' }); }

  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) return JSON.stringify({ status: 'client_not_registered' });

  try {
    WP360_ensureClientSheetStructure(sheetRef.id);
    const ss = SpreadsheetApp.openById(sheetRef.id);
    const sh = ss.getSheetByName(WP360_MASTER_TABS.TRANSACTION);
    if (!sh) return JSON.stringify({ status: 'transaction_sheet_not_found' });

    const txId = d.txId || WP360_generateTxId();
    const now = new Date().toISOString();
    
    const vals = sh.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]).trim() === txId) {
        return JSON.stringify({ status: 'duplicate_txid', txId: txId });
      }
    }

    const row = [
      txId,
      d.date || new Date().toISOString().slice(0, 10),
      d.type || 'Income',
      d.category || '',
      d.amount || 0,
      d.account || 'Cash',
      d.person || 'Self',
      d.description || '',
      d.status || 'completed',
      uid,
      now,
      now,
      ''
    ];

    sh.appendRow(row);
    WP360_Cache.clearAll(uid);

    Logger.log('Transaction saved: ' + txId + ' for uid: ' + uid);
    return JSON.stringify({ status: 'saved', txId: txId, savedAt: now });

  } catch(err) {
    WP360_logError('WP360_saveSingleTransaction', err.toString());
    return JSON.stringify({ status: 'error', message: err.toString() });
  }
}

function WP360_updateTransaction(uid, dataJson) {
  if (!uid) return JSON.stringify({ status: 'no_uid' });
  
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ status: 'parse_error' }); }

  if (!d.txId) return JSON.stringify({ status: 'no_txid' });

  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) return JSON.stringify({ status: 'client_not_registered' });

  try {
    const ss = SpreadsheetApp.openById(sheetRef.id);
    const sh = ss.getSheetByName(WP360_MASTER_TABS.TRANSACTION);
    if (!sh) return JSON.stringify({ status: 'transaction_sheet_not_found' });

    const vals = sh.getDataRange().getValues();
    let found = false;
    
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]).trim() === d.txId) {
        const now = new Date().toISOString();
        sh.getRange(i + 1, 2).setValue(d.date || vals[i][1]);
        sh.getRange(i + 1, 3).setValue(d.type || vals[i][2]);
        sh.getRange(i + 1, 4).setValue(d.category || vals[i][3]);
        sh.getRange(i + 1, 5).setValue(d.amount || vals[i][4]);
        sh.getRange(i + 1, 6).setValue(d.account || vals[i][5]);
        sh.getRange(i + 1, 7).setValue(d.person || vals[i][6]);
        sh.getRange(i + 1, 8).setValue(d.description || vals[i][7]);
        sh.getRange(i + 1, 9).setValue(d.status || vals[i][8]);
        sh.getRange(i + 1, 12).setValue(now);
        found = true;
        break;
      }
    }

    if (!found) return JSON.stringify({ status: 'txid_not_found' });

    WP360_Cache.clearAll(uid);
    Logger.log('Transaction updated: ' + d.txId);
    return JSON.stringify({ status: 'updated', txId: d.txId });

  } catch(err) {
    WP360_logError('WP360_updateTransaction', err.toString());
    return JSON.stringify({ status: 'error', message: err.toString() });
  }
}

function WP360_deleteTransaction(uid, dataJson) {
  if (!uid) return JSON.stringify({ status: 'no_uid' });
  
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ status: 'parse_error' }); }

  if (!d.txId) return JSON.stringify({ status: 'no_txid' });

  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) return JSON.stringify({ status: 'client_not_registered' });

  try {
    const ss = SpreadsheetApp.openById(sheetRef.id);
    const sh = ss.getSheetByName(WP360_MASTER_TABS.TRANSACTION);
    if (!sh) return JSON.stringify({ status: 'transaction_sheet_not_found' });

    const vals = sh.getDataRange().getValues();
    
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]).trim() === d.txId) {
        sh.deleteRow(i + 1);
        WP360_Cache.clearAll(uid);
        Logger.log('Transaction deleted: ' + d.txId);
        return JSON.stringify({ status: 'deleted', txId: d.txId });
      }
    }

    return JSON.stringify({ status: 'txid_not_found' });

  } catch(err) {
    WP360_logError('WP360_deleteTransaction', err.toString());
    return JSON.stringify({ status: 'error', message: err.toString() });
  }
}

function WP360_getTransactions(uid, filterJson) {
  if (!uid) return null;

  const cached = WP360_Cache.get(uid, 'transactions');
  if (cached) return JSON.stringify(cached);

  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) return null;

  try {
    const ss = SpreadsheetApp.openById(sheetRef.id);
    const sh = ss.getSheetByName(WP360_MASTER_TABS.TRANSACTION);
    if (!sh || sh.getLastRow() < 2) {
      WP360_Cache.set(uid, 'transactions', []);
      return JSON.stringify([]);
    }

    const vals = sh.getDataRange().getValues();
    const transactions = [];

    for (let i = 1; i < vals.length; i++) {
      const r = vals[i];
      if (!r[0] || String(r[0]).trim() === '') continue;
      
      transactions.push({
        txId: r[0],
        date: r[1],
        type: r[2],
        category: r[3],
        amount: r[4],
        account: r[5],
        person: r[6],
        description: r[7],
        status: r[8],
        createdAt: r[10],
        updatedAt: r[11]
      });
    }

    WP360_Cache.set(uid, 'transactions', transactions);
    return JSON.stringify(transactions);

  } catch(err) {
    WP360_logError('WP360_getTransactions', err.toString());
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// MASTERS MANAGEMENT
// ════════════════════════════════════════════════════════════════

function WP360_getMasters(uid) {
  if (!uid) return null;

  const cached = WP360_Cache.get(uid, 'masters');
  if (cached) return JSON.stringify(cached);

  const masters = {
    categories: WP360_CATEGORIES,
    accounts: WP360_DEFAULT_ACCOUNTS,
    persons: WP360_DEFAULT_PERSONS
  };

  WP360_Cache.set(uid, 'masters', masters);
  return JSON.stringify(masters);
}

function WP360_updateMasters(uid, dataJson) {
  if (!uid) return JSON.stringify({ status: 'no_uid' });
  
  let d;
  try { d = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson; }
  catch(e) { return JSON.stringify({ status: 'parse_error' }); }

  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) return JSON.stringify({ status: 'client_not_registered' });

  try {
    WP360_ensureClientSheetStructure(sheetRef.id);
    WP360_Cache.clearAll(uid);
    Logger.log('Masters updated for ' + uid);
    return JSON.stringify({ status: 'updated' });

  } catch(err) {
    WP360_logError('WP360_updateMasters', err.toString());
    return JSON.stringify({ status: 'error', message: err.toString() });
  }
}

// ════════════════════════════════════════════════════════════════
// CLIENT DATABASE MANAGEMENT
// ════════════════════════════════════════════════════════════════

function WP360_getClientSheetId(uid) {
  const row = WP360_findRow(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'CLIENT_DATABASE_REGISTRY', 'CLIENT_ID', uid);
  if (row && row.MASTER_DB_ID) {
    return { id: String(row.MASTER_DB_ID), url: String(row.MASTER_DB_URL || '') };
  }
  return null;
}

function WP360_createClientSheet(uid, name, mobile, email, passwordHash, plan) {
  try {
    const folder = WP360_getOrCreateClientFolder(uid, name);
    const safeName = (name || uid).replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_').trim();
    const sheetName = 'DB_' + uid + '_' + safeName;

    let existing = folder.getFilesByName(sheetName);
    if (existing.hasNext()) {
      const f = existing.next();
      WP360_ensureClientSheetStructure(f.getId());
      return { id: f.getId(), url: f.getUrl(), name: sheetName, folderId: folder.getId() };
    }

    const tmpl = SpreadsheetApp.openById(WP360_CONFIG.TEMPLATE_SHEET_ID_FALLBACK);
    const copy = tmpl.copy(sheetName);
    const copyId = copy.getId();
    const copyUrl = copy.getUrl();
    copy.moveTo(folder);

    WP360_ensureClientSheetStructure(copyId);
    Logger.log('Client sheet created: ' + sheetName + ' -> ' + copyUrl);

    return { id: copyId, url: copyUrl, name: sheetName, folderId: folder.getId() };

  } catch(err) {
    WP360_logError('WP360_createClientSheet', err.toString());
    throw new Error('Failed to create client sheet: ' + err.toString());
  }
}

function WP360_ensureClientSheetStructure(sheetId) {
  if (!sheetId) return;
  try {
    const ss = SpreadsheetApp.openById(sheetId);

    Object.values(WP360_MASTER_TABS).forEach(tabName => {
      if (!ss.getSheetByName(tabName)) {
        const sh = ss.insertSheet(tabName);
        
        if (tabName === WP360_MASTER_TABS.TRANSACTION) {
          sh.appendRow(['TxID', 'Date', 'Type', 'Category', 'Amount', 'Account', 'Person', 'Description', 'Status', 'User ID', 'Created At', 'Updated At', 'Notes']);
        } else if (tabName === WP360_MASTER_TABS.CATEGORY) {
          sh.appendRow(['Category', 'Type', 'User ID']);
        } else if (tabName === WP360_MASTER_TABS.ACCOUNT) {
          sh.appendRow(['Account Name', 'Type', 'User ID']);
        } else if (tabName === WP360_MASTER_TABS.PERSON) {
          sh.appendRow(['Person Name', 'Type', 'User ID']);
        } else if (tabName === WP360_MASTER_TABS.APP_META) {
          sh.appendRow(['KEY', 'VALUE_JSON', 'UPDATED_AT']);
        }
        
        sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold');
        sh.setFrozenRows(1);
      }
    });

  } catch(e) { Logger.log('ensureClientSheetStructure warning: ' + e); }
}

function WP360_saveClientDb(uid, dbJson) {
  if (!uid) return JSON.stringify({ status: 'no_uid' });
  
  let db;
  try { db = typeof dbJson === 'string' ? JSON.parse(dbJson) : dbJson; }
  catch(e) { return JSON.stringify({ status: 'parse_error' }); }

  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) return JSON.stringify({ status: 'client_not_registered' });

  try {
    WP360_ensureClientSheetStructure(sheetRef.id);
    const ss = SpreadsheetApp.openById(sheetRef.id);
    const ts = new Date().toISOString();

    if (db.transactions && Array.isArray(db.transactions)) {
      const txRows = db.transactions.map(t => [
        t.txId || WP360_generateTxId(),
        t.date || new Date().toISOString().slice(0, 10),
        t.type || 'Income',
        t.category || '',
        t.amount || 0,
        t.account || 'Cash',
        t.person || 'Self',
        t.description || '',
        t.status || 'completed',
        uid,
        t.createdAt || ts,
        t.updatedAt || ts,
        t.notes || ''
      ]);
      WP360_writeTabData(ss, WP360_MASTER_TABS.TRANSACTION, 
        ['TxID', 'Date', 'Type', 'Category', 'Amount', 'Account', 'Person', 'Description', 'Status', 'User ID', 'Created At', 'Updated At', 'Notes'],
        txRows);
    }

    WP360_Cache.clearAll(uid);
    Logger.log('Database saved for ' + uid);
    return JSON.stringify({ status: 'saved', savedAt: ts });

  } catch(err) {
    WP360_logError('WP360_saveClientDb', err.toString());
    return JSON.stringify({ status: 'error', message: err.toString() });
  }
}

function WP360_loadClientDb(uid) {
  if (!uid) return null;

  const cached = WP360_Cache.get(uid, 'fulldb');
  if (cached) return JSON.stringify(cached);

  const sheetRef = WP360_getClientSheetId(uid);
  if (!sheetRef) return null;

  try {
    WP360_ensureClientSheetStructure(sheetRef.id);
    const ss = SpreadsheetApp.openById(sheetRef.id);

    const db = {
      transactions: [],
      categories: [],
      accounts: [],
      persons: [],
      _loadedAt: Date.now()
    };

    const txSh = ss.getSheetByName(WP360_MASTER_TABS.TRANSACTION);
    if (txSh && txSh.getLastRow() > 1) {
      const vals = txSh.getDataRange().getValues();
      for (let i = 1; i < vals.length; i++) {
        const r = vals[i];
        if (r[0] && String(r[0]).trim() !== '') {
          db.transactions.push({
            txId: r[0],
            date: r[1],
            type: r[2],
            category: r[3],
            amount: r[4],
            account: r[5],
            person: r[6],
            description: r[7],
            status: r[8],
            createdAt: r[10],
            updatedAt: r[11]
          });
        }
      }
    }

    WP360_Cache.set(uid, 'fulldb', db);
    return JSON.stringify(db);

  } catch(err) {
    WP360_logError('WP360_loadClientDb', err.toString());
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════

function WP360_sheet(spreadsheetId, tabName) {
  const sh = SpreadsheetApp.openById(spreadsheetId).getSheetByName(tabName);
  if (!sh) throw new Error('Tab not found: ' + tabName);
  return sh;
}

function WP360_appendRowByHeader(spreadsheetId, tabName, rowObj) {
  const sh = WP360_sheet(spreadsheetId, tabName);
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(header.map(h => rowObj[h] !== undefined ? rowObj[h] : ''));
}

function WP360_findRow(spreadsheetId, tabName, matchCol, matchVal) {
  const sh = WP360_sheet(spreadsheetId, tabName);
  if (sh.getLastRow() < 2) return null;
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const colIdx = hdr.indexOf(matchCol);
  if (colIdx === -1) return null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]).trim() === String(matchVal).trim()) {
      const obj = {}; hdr.forEach((h, j) => obj[h] = data[i][j]);
      obj._rowIndex = i + 1;
      return obj;
    }
  }
  return null;
}

function WP360_findAllRows(spreadsheetId, tabName, matchCol, matchVal) {
  const sh = WP360_sheet(spreadsheetId, tabName);
  if (sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const hdr = data[0];
  const colIdx = matchCol ? hdr.indexOf(matchCol) : -1;
  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (colIdx === -1 || String(data[i][colIdx]).trim() === String(matchVal).trim()) {
      const obj = {}; hdr.forEach((h, j) => obj[h] = data[i][j]);
      obj._rowIndex = i + 1;
      results.push(obj);
    }
  }
  return results;
}

function WP360_updateCell(spreadsheetId, tabName, rowIndex, colName, value) {
  const sh = WP360_sheet(spreadsheetId, tabName);
  const hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const c = hdr.indexOf(colName);
  if (c !== -1) sh.getRange(rowIndex, c + 1).setValue(value);
}

function WP360_readTabRows(ss, tabName, uid) {
  const sh = ss.getSheetByName(tabName);
  if (!sh || sh.getLastRow() < 2) return [];
  const vals = sh.getDataRange().getValues();
  const results = [];
  for (let i = 1; i < vals.length; i++) {
    const r = vals[i];
    if (r[0] && String(r[0]).trim() !== '') {
      results.push(r[0]);
    }
  }
  return results;
}

function WP360_writeTabData(ss, tabName, headers, rows) {
  let sh = ss.getSheetByName(tabName);
  if (!sh) {
    sh = ss.insertSheet(tabName);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).clearContent();
  if (rows && rows.length > 0) {
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function WP360_getOrCreateClientFolder(uid, name) {
  const rootFolder = DriveApp.getFolderById(WP360_CONFIG.CLIENTS_ROOT_FOLDER_ID);
  const dbFolder = WP360_getOrCreateSubFolder(rootFolder, WP360_CONFIG.CLIENT_DB_SUBFOLDER_NAME);
  const safeName = (name || uid).replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_').trim();
  const folderName = uid + '_' + safeName;
  const existing = dbFolder.getFoldersByName(folderName);
  if (existing.hasNext()) return existing.next();
  return dbFolder.createFolder(folderName);
}

function WP360_getOrCreateSubFolder(parentFolder, subName) {
  const existing = parentFolder.getFoldersByName(subName);
  if (existing.hasNext()) return existing.next();
  return parentFolder.createFolder(subName);
}

function WP360_saveUsers(usersJson) {
  try {
    const sh = WP360_ensureUtilityTab(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'WEALTHPILOT_USER_CACHE', ['KEY', 'REGISTRY_JSON', 'LAST_UPDATED']);
    const vals = sh.getDataRange().getValues();
    let blobRow = -1;
    for (let i = 1; i < vals.length; i++) {
      if (vals[i][0] === '__REGISTRY__') { blobRow = i + 1; break; }
    }
    const ts = new Date().toISOString();
    if (blobRow === -1) sh.appendRow(['__REGISTRY__', usersJson, ts]);
    else { sh.getRange(blobRow, 2).setValue(usersJson); sh.getRange(blobRow, 3).setValue(ts); }
    return 'saved';
  } catch(err) {
    WP360_logError('WP360_saveUsers', err.toString());
    throw new Error('SAVE_USERS failed: ' + err.toString());
  }
}

function WP360_loadUsers() {
  try {
    const sh = WP360_ensureUtilityTab(WP360_CONFIG.USER_SECURITY_SHEET_ID, 'WEALTHPILOT_USER_CACHE', ['KEY', 'REGISTRY_JSON', 'LAST_UPDATED']);
    const vals = sh.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (vals[i][0] === '__REGISTRY__') return vals[i][1] || '{}';
    }
    return '{}';
  } catch(err) {
    WP360_logError('WP360_loadUsers', err.toString());
    throw new Error('LOAD_USERS failed: ' + err.toString());
  }
}

function WP360_ensureUtilityTab(spreadsheetId, tabName, headers) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  let sh = ss.getSheetByName(tabName);
  if (!sh) {
    sh = ss.insertSheet(tabName);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function WP360_hashPass(pw) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pw)));
}

function WP360_logError(action, msg) {
  try {
    WP360_appendRowByHeader(WP360_CONFIG.MASTER_CONTROL_SHEET_ID, 'ERROR_LOG', {
      TIMESTAMP: new Date().toISOString(),
      ERROR: '[WealthPilot360:' + action + '] ' + msg
    });
  } catch(e) {}
}

function WP360_diag() {
  const out = { ok: true, steps: [] };
  function step(name, fn) {
    try { const r = fn(); out.steps.push({ step: name, ok: true, detail: r }); }
    catch(e) { out.ok = false; out.steps.push({ step: name, ok: false, error: e.toString() }); }
  }
  step('USER_SECURITY_SHEET', () => {
    const ss = SpreadsheetApp.openById(WP360_CONFIG.USER_SECURITY_SHEET_ID);
    return 'Opened: ' + ss.getName();
  });
  step('MASTER_CONTROL_SHEET', () => {
    const ss = SpreadsheetApp.openById(WP360_CONFIG.MASTER_CONTROL_SHEET_ID);
    return 'Opened: ' + ss.getName();
  });
  step('Backend Version', () => 'v25 STABLE - With Professional Categories');
  step('Total Business Categories', () => Object.keys(WP360_CATEGORIES.Business).length + ' groups');
  step('Total Personal Categories', () => Object.keys(WP360_CATEGORIES.Personal).length + ' groups');
  return out;
}

function WP360_debugClientData(uid) {
  if (!uid) return { error: 'no_uid' };
  const out = { uid: uid };

  const sheetRef = WP360_getClientSheetId(uid);
  out.resolvedSheet = sheetRef ? { id: sheetRef.id, url: sheetRef.url } : null;

  if (!sheetRef) { out.error = 'no_sheet_resolved_for_uid'; return out; }

  try {
    const ss = SpreadsheetApp.openById(sheetRef.id);
    out.sheetName = ss.getName();

    const txSh = ss.getSheetByName(WP360_MASTER_TABS.TRANSACTION);
    if (txSh) {
      const lastRow = txSh.getLastRow();
      out.transactionCount = Math.max(0, lastRow - 1);
    }

    out.tabsPresent = Object.keys(WP360_MASTER_TABS).length;
  } catch(e) { out.sheetReadError = e.toString(); }

  return out;
}
