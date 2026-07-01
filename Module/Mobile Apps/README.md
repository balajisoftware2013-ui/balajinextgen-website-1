# Balaji NextGen — WealthPilot360 + Business OS Fix Package (v2)

## 🎯 THE ACTUAL ROOT CAUSE — read this first
Every "LOAD_USERS undefined" / "REGISTER_CLIENT undefined" error, every broken/blank client record (CL00019, CL00020, CL00021), every "folder not created" report across this whole session — all one bug:

**WealthPilot360's `GAS_URL` was pointing at Business OS's Apps Script deployment, not its own.** The two constants were identical:
- WealthPilot360 HTML: `const GAS_URL = '...AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec'`
- Business OS `Code.gs`: `const BACKEND_API_URL = '...AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec'`

WealthPilot360 was never talking to a broken/undeployed backend — it was talking to a *different app's* backend the whole time, one that doesn't recognize its action names (`LOAD_USERS`) or understand its field names (sends `name`/`mobile`, Business OS expects `bizName`/`owner`). That mismatch is exactly what produced the blank CL0001x-style records in your Business OS sheets — those were WealthPilot360 registration attempts landing in the wrong place.

I've disabled `GAS_URL` in the HTML (set to `''`) so it stops sending mismatched data into Business OS's sheets while you set up WealthPilot360's own deployment. Explore Free / local-only mode still works fine with it disabled.

## What's in this ZIP
- `Balaji_WealthPilot360.html` — v16: GAS_URL disabled pending its own deployment; all prior fixes (security, duplicate-guard, splash speed, mobile logout, etc.) intact
- `sw.js` — service worker, unchanged
- `WealthPilot360_GAS_Backend_v14_Unified.gs` — WealthPilot360's own backend code, ready to deploy as a **separate** Apps Script project
- `Balaji_BusinessOS_Code_v6.gs` — Business OS backend, with a critical bug fixed (see below) plus all prior fixes

## ⚠️ Also fixed: a bug I introduced
My previous edit accidentally left `const bizName = (bizName || '').trim();` in Business OS's `registerClient()` — a self-referencing declaration that throws a ReferenceError on every call. Caught and fixed in v6 before you deployed it. If you already pasted v4 or v5 into Apps Script, replace it with v6 from this ZIP.

---

## STEP 1 — Create WealthPilot360's OWN Apps Script project
This is the actual fix. WealthPilot360 needs its own deployment, separate from Business OS.

1. Go to script.google.com → **New project**.
2. Delete the default `Code.gs` content, paste in the entire contents of `WealthPilot360_GAS_Backend_v14_Unified.gs`. Save.
3. In the function dropdown, select `WP360_setSuperAdminCredentials`, click **Run**, approve permissions. Confirm the ✅ in the execution log.
4. **Deploy → New deployment** → gear icon → **Web app** → Execute as: **Me** → Who has access: **Anyone** → **Deploy**.
5. Copy the `/exec` URL it gives you. It will look similar to but NOT be identical to Business OS's URL.
6. Test it: open `<that new URL>?action=diag` in a browser tab. Confirm `"ok": true` and every step green.

## STEP 2 — Wire that URL into the HTML
Open `Balaji_WealthPilot360.html`, find this line near the top of the script section:
```js
const GAS_URL = ''; // ← paste your WealthPilot360-ONLY /exec URL here once created
```
Replace `''` with your new URL from Step 1, in quotes, e.g.:
```js
const GAS_URL = 'https://script.google.com/macros/s/YOUR_NEW_ID/exec';
```
Upload this updated HTML to Netlify, replacing the old one.

## STEP 3 — Deploy the fixed Business OS backend
1. Open your **existing** Business OS Apps Script project (the one whose URL Business OS's frontend already uses — leave that URL alone, it's correct for Business OS).
2. Replace all code with `Balaji_BusinessOS_Code_v6.gs`. Save.
3. Deploy → Manage deployments → edit the existing deployment (pencil icon) → Version: New version → Deploy. (Do NOT create a new deployment here — Business OS's frontend already has the right URL, editing in place keeps it working.)
4. Visit `<business-os-exec-url>?action=diag` and confirm all green.

## STEP 4 — Clean up broken test records
Delete these IDs from every tab where they appear — they were created by the URL mix-up and have no real data behind them:
- `CL00019`, `CL00020`, `CL00021`

**In `USER_SECURITY_MASTER_DB`:** `CLIENT_MASTER`, `USER_MASTER`, `CLIENT_REGISTRY`
**In `BALAJI_ERP_MASTER_CONTROL_SYSTEM`:** `CLIENT_REGISTRY`, `CLIENT_DATABASE_REGISTRY`, `CLIENT_DEPLOYMENT_REGISTRY`, `SAAS_SUBSCRIPTION_MASTER`

Also check your Business OS Drive folder for `CL00019_...` / `CL00020_...` / `CL00021_...` folders and delete if present.

## STEP 5 — Test for real
Use the live HTTPS URL (never `file:///...`), hard-refresh (Ctrl+Shift+R), and try registering a WealthPilot360 account. It should now create a proper `<uid>_<Name>` folder under WealthPilot360's own Drive location — not under Business OS's.

---

## Version summary
| File | Version | Key change this round |
|---|---|---|
| WealthPilot360 frontend | v16 | GAS_URL disabled — was pointing at Business OS's deployment |
| WealthPilot360 backend | v14 | (unchanged this round — needs its own deployment, see Step 1) |
| Business OS backend | v6 | Fixed ReferenceError bug in registerClient() introduced in v5 |
