/**
 * BALAJI NEXTGEN — WhatsApp / Meta setup helper (2026-11-15)
 * Your project has 50+ Script properties, so Project Settings shows them read-only.
 * Use these from the editor instead: choose the function in the toolbar → ▶ Run → View → Logs.
 *
 *   RUN_WaShowVerifyToken  → shows the Verify token to paste in Meta → WhatsApp → Configuration → Webhook.
 *   RUN_WaSaveMetaApp      → saves META_APP_ID / META_APP_SECRET / META_ES_CONFIG_ID.
 *                            Fill the 2 empty values below, Run once, then CLEAR them again and save the file.
 *   RUN_WaMetaStatus       → checks what is set (secrets shown masked).
 */

var BNX_SETUP_META_APP_ID = '4462521290725189';   // Balaji NextGen ERP (Meta app)
var BNX_SETUP_ES_CONFIG_ID = '2026462034713762';                   // ← paste Configuration ID (Facebook Login for Business → Configurations)
var BNX_SETUP_APP_SECRET = '';                     // ← paste NEW App secret, Run, then delete it from here again

function RUN_WaShowVerifyToken() {
  var P = PropertiesService.getScriptProperties();
  var vt = String(P.getProperty('WA_VERIFY_TOKEN_CL00010') || P.getProperty('WA_VERIFY_TOKEN') || '').trim();
  if (!vt) {
    vt = 'bnx' + Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    P.setProperty('WA_VERIFY_TOKEN', vt);
    Logger.log('No verify token existed — created a new one.');
  }
  Logger.log('Callback URL : https://bnx-wa.balajisoftware2013.workers.dev/wa-webhook');
  Logger.log('Verify token : ' + vt);
  Logger.log('Copy the Verify token exactly (no spaces) into Meta → WhatsApp → Configuration → Webhook → Edit.');
}

function RUN_WaSaveMetaApp() {
  var P = PropertiesService.getScriptProperties(), done = [];
  var id = String(BNX_SETUP_META_APP_ID || '').trim();
  var cfg = String(BNX_SETUP_ES_CONFIG_ID || '').trim();
  var sec = String(BNX_SETUP_APP_SECRET || '').trim();

  if (!/^\d{6,20}$/.test(id)) throw new Error('META_APP_ID must be digits only.');
  P.setProperty('META_APP_ID', id); done.push('META_APP_ID = ' + id);

  if (cfg) {
    if (!/^\d{6,25}$/.test(cfg)) throw new Error('Configuration ID must be digits only — copy it again from Facebook Login for Business → Configurations.');
    P.setProperty('META_ES_CONFIG_ID', cfg); done.push('META_ES_CONFIG_ID = ' + cfg);
  } else done.push('META_ES_CONFIG_ID not changed (empty above)');

  if (sec) {
    if (!/^[0-9a-f]{32}$/i.test(sec)) throw new Error('App secret should be 32 letters/digits (0-9, a-f). Copy it again from App settings → Basic → Show.');
    P.setProperty('META_APP_SECRET', sec); done.push('META_APP_SECRET = ••••' + sec.slice(-4));
  } else done.push('META_APP_SECRET not changed (empty above)');

  done.forEach(function (s) { Logger.log(s); });
  if (sec) Logger.log('NOW delete the secret from BNX_SETUP_APP_SECRET in this file and press Save (Ctrl+S).');
}

function RUN_WaMetaStatus() {
  var P = PropertiesService.getScriptProperties();
  function m(k) { var v = String(P.getProperty(k) || ''); return v ? (v.length > 8 ? '••••' + v.slice(-4) : v) : '— missing —'; }
  Logger.log('META_APP_ID       : ' + (P.getProperty('META_APP_ID') || '— missing —'));
  Logger.log('META_ES_CONFIG_ID : ' + (P.getProperty('META_ES_CONFIG_ID') || '— missing —'));
  Logger.log('META_APP_SECRET   : ' + m('META_APP_SECRET'));
  Logger.log('WA_VERIFY_TOKEN   : ' + m('WA_VERIFY_TOKEN'));
  Logger.log('Hashtag token     : ' + m('META_WA_TOKEN_CL00010'));
  Logger.log('Hashtag phone ID  : ' + (P.getProperty('META_WA_PHONE_ID_CL00010') || '— missing —'));
  Logger.log('Webhook verified  : ' + (P.getProperty('WA_WEBHOOK_VERIFIED_CL00010') || P.getProperty('WA_HOOK_VERIFIED') || 'no'));
  Logger.log('Total properties  : ' + Object.keys(P.getProperties()).length);
}

/* 2026-11-15 — webhook check: did Meta's messages reach the ERP? */
function RUN_WaWebhookCheck() {
  var P = PropertiesService.getScriptProperties();
  var seen = Number(P.getProperty('WA_HOOK_SEEN') || 0);
  Logger.log('Last webhook event : ' + (seen ? Utilities.formatDate(new Date(seen), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss') : 'never'));
  Logger.log('Last sheet row     : ' + (P.getProperty('WA_WEBHOOK_LAST_AT_CL00010') || 'never'));
  Logger.log('Hook secret (k)    : ' + (P.getProperty('WA_HOOK_SECRET') ? 'SET — relay must send ?k=' : 'not set (ok)'));
  var log = []; try { log = JSON.parse(P.getProperty('WA_HOOK_LOG') || '[]'); } catch (e) {}
  log.slice(0, 5).forEach(function (x) { Logger.log('  ' + JSON.stringify(x).slice(0, 300)); });
}

/* 2026-11-15 — sends a fake guest message through the Cloudflare relay, exactly like Meta does, then checks it arrived */
function RUN_WaRelayTest() {
  var before = Number(PropertiesService.getScriptProperties().getProperty('WA_HOOK_SEEN') || 0);
  var sample = { object: 'whatsapp_business_account', entry: [{ id: 'TEST', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp', metadata: { display_phone_number: '910000000000', phone_number_id: 'TEST' },
    contacts: [{ profile: { name: 'Relay test' }, wa_id: '910000000000' }],
    messages: [{ from: '910000000000', id: 'wamid.TEST' + Date.now(), timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'relay test' } }] } }] }] };
  var r = UrlFetchApp.fetch('https://bnx-wa.balajisoftware2013.workers.dev/wa-webhook', {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(sample), muteHttpExceptions: true });
  Logger.log('Relay answered : HTTP ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 80));
  Utilities.sleep(12000);
  PropertiesService.getScriptProperties();   // re-read
  var after = Number(PropertiesService.getScriptProperties().getProperty('WA_HOOK_SEEN') || 0);
  Logger.log(after > before ? 'ARRIVED ✓ — check TRANSACTION DB → WA_WEBHOOK_LOG (row "relay test")'
    : 'NOT arrived yet — the deployment the relay calls (AKfycbwHdq…) is an old version: Deploy → Manage deployments → Edit → New version');
}
