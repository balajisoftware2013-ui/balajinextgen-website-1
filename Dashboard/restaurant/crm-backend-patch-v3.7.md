# CRM backend patch v3.7 — name + mobile must save

Apply these 6 edits **inside your existing CRM `.gs` file** (do not add new copies of functions — Apps Script keeps only one of two same-named functions). Then **Deploy → Manage deployments → Edit → New version**.

## What the data showed
- Guests saved up to 19:17 on 10-10; every scan after that is `ANONYMOUS` (no check-in reached the script).
- `GUEST_CRM` in `CL00010_CRM_DB` shows times **12h30m ahead** of `GUEST_TRANSACTIONS` (cause: Edit 1–3 below).
- No WhatsApp check-in ever reached `GUEST_CRM` (all `SOURCE` = `QR_SCAN`) → Meta's webhook is not reaching this script (Edit 6 proves it).

---

## Edit 1 — add this helper right after the `bnxCrmW_` function
```js
/* v3.7: copy a time cell between spreadsheets that have different time zones WITHOUT shifting the clock */
function bnxCrmRetz_(d, fromSh, toSh) {
  if (Object.prototype.toString.call(d) !== '[object Date]') return d;
  try {
    var a = bnxCrmSheetTz_(fromSh), b = bnxCrmSheetTz_(toSh);
    if (a === b) return d;
    return Utilities.parseDate(Utilities.formatDate(d, a, 'yyyy-MM-dd HH:mm:ss'), b, 'yyyy-MM-dd HH:mm:ss');
  } catch (e) { return d; }
}
```

## Edit 2 — in `bnxCrmSyncGuest_` (fixes the 12h30m CRM DB time)
FIND:
```js
Object.keys(g).forEach(function (k) { o[k] = g[k]; }); o.MOBILE = mobile;
```
REPLACE WITH:
```js
Object.keys(g).forEach(function (k) { o[k] = bnxCrmRetz_(g[k], gsh, csh); }); o.MOBILE = mobile;
```

## Edit 3 — in `bnxCrmSyncAll`
FIND:
```js
if (!o.TXN_ID || have[String(o.TXN_ID)]) continue; bnxCrmAppend_(dst, o);
```
REPLACE WITH:
```js
if (!o.TXN_ID || have[String(o.TXN_ID)]) continue; Object.keys(o).forEach(function (k) { o[k] = bnxCrmRetz_(o[k], src, dst); }); bnxCrmAppend_(dst, o);
```
After saving: run **RUN_5_CopyAllGuestsToMasterAndCrmDb** once. It rewrites the wrong GUEST_CRM times in the CRM DB and copies the 3 missing 10-08 `GUEST_TRANSACTIONS` rows.

## Edit 4 — in `bnxCustomerCheckin_`: a welcome-message error must never turn a saved guest into a failure
FIND:
```js
  if (sendWelcome) {
    var r = bnxSendWelcome_(mobile, out.customerName, req.clientId, out.crn);
```
REPLACE WITH:
```js
  if (sendWelcome) {
    var r = { ok: false, configured: false, channel: '' };
    try { r = bnxSendWelcome_(mobile, out.customerName, req.clientId, out.crn); } catch (e) { warn.push('welcome: ' + e.message); }
```

## Edit 5 — in `bnxCustomerCheckin_`: a lock timeout must show "Busy — tap again", not be lost
FIND:
```js
  var lock = bnxCrmLockGuests_(req.clientId);
  try {
    row = bnxCrmFind_(sh, mobile, req.clientId);
```
REPLACE WITH:
```js
  var lock = null;
  try { lock = bnxCrmLockGuests_(req.clientId); } catch (e) { lock = null; }
  if (!lock) return { success: false, error: 'Busy — please tap Continue again in a few seconds' };
  try {
    row = bnxCrmFind_(sh, mobile, req.clientId);
```

## Edit 6 — in `bnxWaRoutePost_`: log every WhatsApp message Meta delivers (proves the webhook works)
FIND:
```js
  try { res.handled = bnxWaHandle_(JSON.parse(raw)); } catch (err) { res.ok = false; res.error = String(err.message || err); Logger.log('WA webhook: ' + res.error); }
```
ADD DIRECTLY AFTER IT:
```js
  try {   /* v3.7: one row per incoming guest message (not delivery receipts) in GUEST_WELCOME_LOG */
    if (/"messages"\s*:\s*\[/.test(raw)) {
      var wcid = String(PropertiesService.getScriptProperties().getProperty('WA_CLIENTS') || CRM_TEST_CLIENT).split(/[\s,]+/)[0];
      bnxCrmAppend_(bnxCrmSheet_(CRM_LOG, CRM_LOG_HEAD, wcid, true), { TIME: bnxNow_(), MOBILE: '', CHANNEL: 'WA_WEBHOOK_IN',
        RESULT: ('handled ' + res.handled + (res.error ? ' · ERR ' + res.error : '')).slice(0, 300), TEXT: '', CLIENT_ID: wcid });
    }
  } catch (x) {}
```

## Optional — one-click check for the WhatsApp setup (add anywhere)
```js
function RUN_14_CheckWhatsAppWebhook() {
  var P = PropertiesService.getScriptProperties(), pr = function (k) { return bnxCrmProp_(P, k, CRM_TEST_CLIENT); };
  Logger.log('WA_PROVIDER = ' + (pr('WA_PROVIDER') || 'NOT SET (must be META)'));
  Logger.log('META_WA_TOKEN = ' + (pr('META_WA_TOKEN') ? 'set' : 'MISSING'));
  Logger.log('META_WA_PHONE_ID = ' + (pr('META_WA_PHONE_ID') || 'MISSING'));
  Logger.log('WA_VERIFY_TOKEN = ' + (P.getProperty('WA_VERIFY_TOKEN') ? 'set' : 'MISSING'));
  Logger.log('WA_CLIENTS = ' + (P.getProperty('WA_CLIENTS') || '(not set — defaults to ' + CRM_TEST_CLIENT + ')'));
  Logger.log('Now send "#CI-' + CRM_TEST_CLIENT + '-C" from a phone to the business number, wait 20 s, and look in MASTER DB > GUEST_WELCOME_LOG for a WA_WEBHOOK_IN row.');
  Logger.log('No row = Meta is not calling this script: check Meta > WhatsApp > Configuration > Webhook (Callback URL = this /exec URL, subscribed to "messages") and that doPost starts with:  var w = bnxWaRoutePost_(e); if (w) return w;');
}
```

## Check in your router file (`Router bnxcrmroute.gs`, not uploaded)
- `doGet` first line:  `var w = bnxWaRouteGet_(e);  if (w) return w;`
- `doPost` first line: `var w = bnxWaRoutePost_(e); if (w) return w;`
- Meta number must be on the **Cloud API**. A number that still runs in the WhatsApp Business **app** never sends webhooks and the app greeting message is the only auto-reply.
