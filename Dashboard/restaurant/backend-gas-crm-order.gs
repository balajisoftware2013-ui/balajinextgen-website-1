/* ═══════════════════════════════════════════════════════════════
   ADD-ON FOR THE EXISTING V2_CORE APPS SCRIPT PROJECT
   (the same project that already serves 'getMenuItems',
   'GET_ACTIVE_ORDERS', 'SAVE_ORDER', 'UPDATE_ORDER_STATUS' etc.
   to restaurant-dashboard.html and steward-mobile-App.html)

   This file adds the customer-facing CRM + self-order flow:
     1. CUSTOMER_CHECKIN  → looks up / creates the guest in a
        "CRM_CUSTOMERS" sheet (this IS the "Google database"),
        sends a one-time welcome WhatsApp message to first-time guests.
     2. LOYALTY POINTS    → earn on every order (default: 1 point per
        ₹10 spent), redeemable at checkout for a rupee-for-point
        discount. GET_LOYALTY_BALANCE + REDEEM_POINTS actions below.
     3. SAVE_ORDER        → confirms/extends the existing action so
        it also accepts orders where orderSource = 'CUSTOMER'
        (paste the small merge shown at the bottom into your
        current SAVE_ORDER handler if it doesn't already store
        these fields), and now also awards/deducts points.

   HOW TO INSTALL
   1. Open the Apps Script project behind your V2_CORE exec URL
      (Extensions → Apps Script, from the same Google Sheet the
      dashboard already reads/writes).
   2. Add a new script file, paste this in.
   3. In your main doPost(e) action router, add the case lines
      shown in "WIRE INTO YOUR ROUTER" below.
   4. Fill in WHATSAPP_CONFIG below (see the WhatsApp section further
      down for how to get these values and why a template is required).
   5. Create a sheet tab named exactly  CRM_CUSTOMERS  with header
      row:  CLIENT_ID | MOBILE_NO | CUSTOMER_NAME | FIRST_VISIT | LAST_VISIT | VISIT_COUNT | LAST_TABLE_ID | POINTS
      (note the new POINTS column at the end — if you already created
      this sheet from the earlier version of this file, just add a
      POINTS header to column H; existing rows default to 0/blank).
   6. Adjust LOYALTY_CONFIG below to your own earn/redeem rates.
   7. Re-deploy the web app (Deploy → Manage deployments → Edit →
      New version) so the exec URL picks up the new code.
═══════════════════════════════════════════════════════════════ */

const CRM_SHEET_NAME = 'CRM_CUSTOMERS';

/* ── Loyalty earn/redeem rates — tune to your margins ── */
const LOYALTY_CONFIG = {
  EARN_PER_RUPEE: 1/10,     // 1 point per ₹10 spent (10% "cash-back" in points)
  POINT_VALUE_RUPEES: 1,    // each point is worth ₹1 when redeemed
  MIN_REDEEM_POINTS: 20,    // don't let a customer redeem a tiny handful of points
  MAX_REDEEM_PCT_OF_BILL: 0.5, // can't wipe out the whole bill with points
};

/* ── WhatsApp (Meta Cloud API) — see full setup notes near
   sendWelcomeWhatsApp() below before filling these in ── */
const WHATSAPP_CONFIG = {
  PHONE_NUMBER_ID: 'YOUR_WHATSAPP_PHONE_NUMBER_ID',   // from Meta Business -> WhatsApp -> API Setup
  ACCESS_TOKEN: 'YOUR_PERMANENT_ACCESS_TOKEN',        // system-user token from Meta Business Settings
  TEMPLATE_NAME: 'welcome_customer',                  // must be pre-approved in Meta Business Manager
  LANGUAGE_CODE: 'en',
  API_VERSION: 'v19.0',
};

/* ═══════════════ WIRE INTO YOUR ROUTER ═══════════════
   Inside your existing doPost(e) switch/if-chain on `action`,
   add:

     if (action === 'CUSTOMER_CHECKIN') return jsonOut(handleCustomerCheckin(data));
     if (action === 'GET_RESTAURANT_INFO') return jsonOut(handleGetRestaurantInfo(data));
     if (action === 'GET_LOYALTY_BALANCE') return jsonOut(handleGetLoyaltyBalance(data));
     if (action === 'REDEEM_POINTS') return jsonOut(handleRedeemPoints(data));

   (jsonOut / ContentService wrapping — reuse whatever helper your
   router already uses to return JSON; shown standalone below too.)
═══════════════════════════════════════════════════════════════ */

function handleCustomerCheckin(data){
  const clientId  = data.clientId || '';
  const mobileNo  = String(data.mobileNo || '').trim();
  const tableId   = data.tableId || '';
  const nameInput = (data.customerName || '').trim();

  if (!mobileNo || mobileNo.length < 8){
    return { success:false, error:'Invalid mobile number' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CRM_SHEET_NAME);
  if (!sheet){
    sheet = ss.insertSheet(CRM_SHEET_NAME);
    sheet.appendRow(['CLIENT_ID','MOBILE_NO','CUSTOMER_NAME','FIRST_VISIT','LAST_VISIT','VISIT_COUNT','LAST_TABLE_ID','POINTS']);
  }

  const rows = sheet.getDataRange().getValues();
  const now = new Date();
  let rowIndex = -1;
  for (let i=1;i<rows.length;i++){
    if (String(rows[i][0])===String(clientId) && String(rows[i][1])===mobileNo){ rowIndex = i; break; }
  }

  if (rowIndex === -1){
    // ── First-time guest: create the record and send the welcome WhatsApp message ──
    const name = nameInput || 'Guest';
    sheet.appendRow([clientId, mobileNo, name, now, now, 1, tableId, 0]);
    sendWelcomeWhatsApp(mobileNo, name);
    return { success:true, isNewCustomer:true, customerName:name, visitCount:1, points:0 };
  }

  // ── Returning guest ──
  const existingName = rows[rowIndex][2];
  const visitCount = Number(rows[rowIndex][5]||1);
  const points = Number(rows[rowIndex][7]||0);

  if (nameInput && (!existingName || existingName==='Guest')){
    // Name arrived a moment later (name-entry screen) — save it and send the
    // welcome WhatsApp message now that we can personalise it, since the
    // initial checkin didn't have a name yet.
    sheet.getRange(rowIndex+1, 3).setValue(nameInput);
    sendWelcomeWhatsApp(mobileNo, nameInput);
    return { success:true, isNewCustomer:false, customerName:nameInput, visitCount:visitCount, points:points };
  }

  // Bump visit count + last visit/table on every check-in at a table.
  sheet.getRange(rowIndex+1, 5).setValue(now);
  sheet.getRange(rowIndex+1, 6).setValue(visitCount+1);
  sheet.getRange(rowIndex+1, 7).setValue(tableId);

  return { success:true, isNewCustomer:false, customerName:existingName, visitCount:visitCount+1, points:points };
}

/* ═══════════════ LOYALTY POINTS ═══════════════
   Points live in column H of CRM_CUSTOMERS. Two entry points:
     - findOrCreateCustomerRow() is a shared lookup used by both
       the balance check and the earn/redeem writers below.
     - Call awardPoints() from inside your SAVE_ORDER handler once
       the bill amount for a CUSTOMER-sourced order is known.
       Call redeemPoints() BEFORE computing the final payable amount
       if the customer chose to redeem points on the cart screen. */

function findCustomerRowIndex(sheet, clientId, mobileNo){
  const rows = sheet.getDataRange().getValues();
  for (let i=1;i<rows.length;i++){
    if (String(rows[i][0])===String(clientId) && String(rows[i][1])===mobileNo) return i;
  }
  return -1;
}

function handleGetLoyaltyBalance(data){
  const clientId = data.clientId || '';
  const mobileNo = String(data.mobileNo||'').trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CRM_SHEET_NAME);
  if (!sheet) return { success:true, points:0 };
  const idx = findCustomerRowIndex(sheet, clientId, mobileNo);
  if (idx===-1) return { success:true, points:0 };
  return { success:true, points: Number(sheet.getRange(idx+1,8).getValue()||0) };
}

// Called from your SAVE_ORDER handler after the bill total for a
// CUSTOMER-sourced order is known. billAmount should be the amount
// actually charged (after any points redeemed — don't award points on
// the discount itself).
function awardPoints(clientId, mobileNo, billAmount){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CRM_SHEET_NAME);
  if (!sheet) return 0;
  const idx = findCustomerRowIndex(sheet, clientId, mobileNo);
  if (idx===-1) return 0;
  const earned = Math.floor(billAmount * LOYALTY_CONFIG.EARN_PER_RUPEE);
  const current = Number(sheet.getRange(idx+1,8).getValue()||0);
  sheet.getRange(idx+1,8).setValue(current + earned);
  return earned;
}

// Called from your SAVE_ORDER handler (or standalone via REDEEM_POINTS
// below) BEFORE the final bill is charged. Returns the rupee discount
// to apply, after enforcing the min-redeem and max-% guardrails.
function redeemPoints(clientId, mobileNo, pointsRequested, billAmount){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CRM_SHEET_NAME);
  if (!sheet) return { discount:0, pointsUsed:0, error:'No loyalty account found' };
  const idx = findCustomerRowIndex(sheet, clientId, mobileNo);
  if (idx===-1) return { discount:0, pointsUsed:0, error:'No loyalty account found' };

  const available = Number(sheet.getRange(idx+1,8).getValue()||0);
  let pointsUsed = Math.min(pointsRequested, available);
  if (pointsUsed < LOYALTY_CONFIG.MIN_REDEEM_POINTS){
    return { discount:0, pointsUsed:0, error:'Minimum '+LOYALTY_CONFIG.MIN_REDEEM_POINTS+' points required to redeem' };
  }
  let discount = pointsUsed * LOYALTY_CONFIG.POINT_VALUE_RUPEES;
  const maxDiscount = billAmount * LOYALTY_CONFIG.MAX_REDEEM_PCT_OF_BILL;
  if (discount > maxDiscount){
    discount = maxDiscount;
    pointsUsed = Math.floor(discount / LOYALTY_CONFIG.POINT_VALUE_RUPEES);
  }
  sheet.getRange(idx+1,8).setValue(available - pointsUsed);
  return { discount, pointsUsed };
}

// Standalone REDEEM_POINTS action, if you want the customer app to lock
// in a redemption at cart time rather than folding it into SAVE_ORDER.
function handleRedeemPoints(data){
  const clientId = data.clientId || '';
  const mobileNo = String(data.mobileNo||'').trim();
  const pointsRequested = Number(data.points||0);
  const billAmount = Number(data.billAmount||0);
  const result = redeemPoints(clientId, mobileNo, pointsRequested, billAmount);
  if (result.error) return { success:false, error:result.error };
  return { success:true, discount:result.discount, pointsUsed:result.pointsUsed };
}

/* ═══════════════ WHATSAPP WELCOME MESSAGE ═══════════════
   Uses Meta's official WhatsApp Cloud API. Setup, one time:

   1. Create a Meta Business Account + WhatsApp Business app at
      developers.facebook.com → your app → WhatsApp → API Setup.
   2. There you'll see a test PHONE_NUMBER_ID immediately, and can
      later add your own verified business number.
   3. Generate a permanent ACCESS_TOKEN via Business Settings →
      System Users (the temporary token shown on the API Setup page
      expires in 24h — fine for testing, not for production).
   4. IMPORTANT: WhatsApp does NOT allow free-form business-initiated
      messages. The very first message to a customer (like this
      welcome message) must use a pre-approved MESSAGE TEMPLATE.
      Create one at Meta Business Manager → Account Tools →
      Message Templates, e.g. named "welcome_customer", category
      "Marketing" or "Utility", body: "Hi {{1}}! Welcome to
      [Restaurant Name]. Thanks for checking in — enjoy your meal!"
      Approval usually takes minutes to a few hours.
   5. Put the phone number ID, access token and template name into
      WHATSAPP_CONFIG above. The template's one variable ({{1}}) is
      filled with the guest's name below.
   6. Mobile numbers must be in international format for the API —
      this code prefixes '91' (India) if a bare 10-digit number is
      passed in; adjust COUNTRY_CODE if your guests are elsewhere.
═══════════════════════════════════════════════════════════════ */
const COUNTRY_CODE = '91';

function sendWelcomeWhatsApp(mobileNo, name){
  if (!WHATSAPP_CONFIG.ACCESS_TOKEN || WHATSAPP_CONFIG.ACCESS_TOKEN==='YOUR_PERMANENT_ACCESS_TOKEN') return; // not configured yet — skip silently

  const toNumber = mobileNo.length===10 ? (COUNTRY_CODE+mobileNo) : mobileNo.replace(/\D/g,'');
  const url = `https://graph.facebook.com/${WHATSAPP_CONFIG.API_VERSION}/${WHATSAPP_CONFIG.PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: toNumber,
    type: 'template',
    template: {
      name: WHATSAPP_CONFIG.TEMPLATE_NAME,
      language: { code: WHATSAPP_CONFIG.LANGUAGE_CODE },
      components: [
        { type: 'body', parameters: [ { type: 'text', text: name } ] }
      ]
    }
  };

  try{
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + WHATSAPP_CONFIG.ACCESS_TOKEN },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch(e){
    // Never let a WhatsApp send failure block the check-in / order flow.
    Logger.log('WhatsApp send failed: '+e.message);
  }
}

function handleGetRestaurantInfo(data){
  // Reads from wherever your Admin Setup already stores the restaurant's
  // display name/icon — adjust the sheet/cell reference to match your
  // existing "Restaurant Profile" or "Admin Setup" tab.
  try{
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('RESTAURANT_PROFILE');
    if (!sheet) return { success:true, data:{ name:'Our Restaurant', icon:'🍽️' } };
    const name = sheet.getRange('B1').getValue() || 'Our Restaurant';
    return { success:true, data:{ name, icon:'🍽️' } };
  } catch(e){
    return { success:true, data:{ name:'Our Restaurant', icon:'🍽️' } };
  }
}

/* ═══════════════ SAVE_ORDER — CUSTOMER-SOURCED ORDERS ═══════════════
   Your existing SAVE_ORDER handler already writes to
   18_CAPTAIN_ORDER_MASTER for POS/Steward orders. Make sure it accepts
   (or merge in) these fields so customer self-orders land in the exact
   same sheet/schema the Order Register, KOT and Steward app already
   read from — no new UI logic needed on their side:

     ORDER_ID        → generate, e.g. 'ORD-'+Utilities.getUuid().slice(0,8)
     ORDER_NO        → your existing daily sequence generator
     ORDER_DATE      → today, your existing date format
     TABLE_ID        ← data.tableId
     ORDER_SOURCE    ← data.orderSource   ('CUSTOMER')
     ORDER_TYPE      ← data.orderType     ('DINEIN')
     ORDER_STATUS    → 'NEW'
     PAX             → data.pax || 1
     SCAN_KEY        ← data.scanKey
     CUSTOMER_NAME   ← data.customerName
     MOBILE_NO       ← data.mobileNo
     START_TIME      → now
     NOTES           ← data.notes
     CREATED_BY      → 'QR SELF-ORDER'
     items           ← data.items  (array of {itemName, qty, rate, amount})

   Return { success:true, orderNo: <the generated ORDER_NO> } so the
   customer app can show it on the confirmation screen.

   LOYALTY HOOK: once the final bill amount for this order is known
   (after any points discount from data.redeemedPoints/data.redeemedDiscount
   is applied), call:

     const earned = awardPoints(data.clientId, data.mobileNo, finalBillAmount);

   and include `earned` in the response so the confirmation screen can
   show "You earned 34 points on this order".
═══════════════════════════════════════════════════════════════ */
