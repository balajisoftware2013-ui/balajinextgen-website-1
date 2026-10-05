/* ═══════════════════════════════════════════════════════════════════════
   GUEST QR ACCESS — Balaji NextGen ERP (V2_CORE) · 2026-10-05
   Why: customer-order.html (table QR) has no staff login. It sends
        guest:true, source:'CUSTOMER_QR' and a random guest token. The live
        router rejects every such call with "Invalid or expired session", so
        the guest page could not load the live menu, restaurant name/logo,
        check-in (CUSTOMER_CHECKIN) or place an order.
   What: a small, strict allow-list. Only these actions, only with
        guest:true + source CUSTOMER_QR, only for a client id that really
        exists, rate-limited per guest token. Everything else still needs
        a real staff session exactly as today.

   INSTALL (single live doPost router):
     1. Where the session is checked today, e.g.
            if (!bnxVerifySession(req)) return jsonOut_({success:false,error:'Invalid or expired session'});
        change it to
            var isGuest = bnxGuestAllowed_(action, req);
            if (isGuest && isGuest.error) return jsonOut_({success:false,error:isGuest.error});
            if (!isGuest && !bnxVerifySession(req)) return jsonOut_({success:false,error:'Invalid or expired session'});
     2. For a guest GET_CLIENT_INFO, return only public fields:
            if (isGuest && action === 'GET_CLIENT_INFO') res = bnxGuestPublicInfo_(res);
        (res = the normal GET_CLIENT_INFO result object, before jsonOut_)
     3. The CRM file (bnxCrmRoute_ / CUSTOMER_CHECKIN) needs no change — it
        runs after this check, so guests now reach it.
     4. Deploy > Manage deployments > Edit > New version.
═══════════════════════════════════════════════════════════════════════ */

var BNX_GUEST_ACTIONS = {
  GET_CLIENT_INFO: 1, GET_POS_MENU: 1, GET_MENU_ITEMS: 1, GET_BAR_MENU: 1, GET_ACTIVE_MENU_CARD: 1,
  CUSTOMER_CHECKIN: 1, SAVE_ORDER: 1, CALL_STEWARD: 1, REDEEM_POINTS: 1
};
var BNX_GUEST_LIMIT_PER_10MIN = 150;          // calls per guest token (a normal visit uses ~10–20)
var BNX_GUEST_ORDER_LIMIT_PER_10MIN = 8;      // SAVE_ORDER per guest token

/* Returns false (not a guest call → normal session rule), {ok:true} (allowed),
   or {error:'…'} (a guest call that must be refused). */
function bnxGuestAllowed_(action, req) {
  req = req || {};
  if (req.guest !== true || String(req.source || '') !== 'CUSTOMER_QR') return false;
  if (!BNX_GUEST_ACTIONS[action]) return { error: 'Not available from the table QR' };

  var cid = String(req.clientId || '').trim().toUpperCase();
  if (!/^[A-Z]{2}\d{4,6}$/.test(cid)) return { error: 'Invalid restaurant code' };
  if (!bnxGuestClientExists_(cid)) return { error: 'Restaurant not found' };
  req.clientId = cid;

  var tok = String(req.sessionToken || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tok)) return { error: 'Invalid guest token' };

  var cache = CacheService.getScriptCache();
  var k = 'gq_' + cid + '_' + tok, n = Number(cache.get(k) || 0) + 1;
  if (n > BNX_GUEST_LIMIT_PER_10MIN) return { error: 'Too many requests — please ask a staff member' };
  cache.put(k, String(n), 600);

  if (action === 'SAVE_ORDER') {
    var ko = 'gqo_' + cid + '_' + tok, no = Number(cache.get(ko) || 0) + 1;
    if (no > BNX_GUEST_ORDER_LIMIT_PER_10MIN) return { error: 'Too many orders from this phone — please ask a staff member' };
    if (!Array.isArray(req.items) || !req.items.length || req.items.length > 60) return { error: 'Order has no items' };
    for (var i = 0; i < req.items.length; i++) {
      var it = req.items[i] || {};
      var q = Number(it.qty);
      if (!String(it.itemName || '').trim() || !(q > 0) || q > 50 || !(Number(it.rate) >= 0)) return { error: 'Invalid item in order' };
    }
    cache.put(ko, String(no), 600);
    req.orderSource = 'CUSTOMER';                     // a guest can never post as POS/steward
    req.orderType = req.orderType === 'TAKEAWAY' ? 'TAKEAWAY' : 'DINEIN';
    // NOTE: SAVE_ORDER should take item rates from the live menu, not from req.items[].rate.
  }
  if (action === 'REDEEM_POINTS' || action === 'CUSTOMER_CHECKIN' || action === 'CALL_STEWARD') {
    if (req.mobileNo != null && String(req.mobileNo).replace(/\D/g, '').slice(-10).length !== 10 && action !== 'CALL_STEWARD') {
      return { error: 'Invalid mobile number' };
    }
  }
  return { ok: true };
}

/* Client exists = the canonical resolver can find its database. Cached 6 h. */
function bnxGuestClientExists_(cid) {
  var cache = CacheService.getScriptCache(), k = 'gqc_' + cid, c = cache.get(k);
  if (c) return c === '1';
  var ok = false;
  try {
    if (typeof getClientDbId_ === 'function') ok = !!getClientDbId_(cid);
    else if (typeof rbClientSpreadsheetId_ === 'function') ok = !!rbClientSpreadsheetId_(cid);
  } catch (e) { ok = false; }
  cache.put(k, ok ? '1' : '0', ok ? 21600 : 300);
  return ok;
}

/* Guests get branding / contact / ordering switches only — never GSTIN details,
   bank info, users, settings or anything else GET_CLIENT_INFO may carry for staff. */
function bnxGuestPublicInfo_(res) {
  if (!res || res.success === false || !res.data || typeof res.data !== 'object') return res;
  var d = res.data, out = {};
  ['name', 'RESTAURANT_NAME', 'clientName', 'logoUrl', 'LOGO_URL', 'address', 'ADDRESS', 'phone', 'PHONE',
   'mapUrl', 'MAP_URL', 'googleMapsUrl', 'reviewUrl', 'REVIEW_URL', 'googleReviewUrl', 'latitude', 'longitude',
   'customerOrderEnabled', 'CUSTOMER_ORDER_ENABLED', 'customerCallEnabled', 'CUSTOMER_CALL_ENABLED',
   'restaurantType', 'RESTAURANT_TYPE', 'businessType'].forEach(function (f) {
    if (d[f] !== undefined && d[f] !== null && d[f] !== '') out[f] = d[f];
  });
  return { success: true, data: out };
}
