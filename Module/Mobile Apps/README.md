# Balaji NextGen — WealthPilot360 + Business OS Fix Package
Everything from this troubleshooting session, in one place.

## What's in this ZIP
- `Balaji_WealthPilot360.html` — v15 frontend (register/login security fixes, no more duplicate-dashboard bug, no more hardcoded admin password, faster logo/splash, mobile logout, Enter/Escape keys)
- `sw.js` — service worker, unchanged, upload next to the HTML file
- `WealthPilot360_GAS_Backend_v14_Unified.gs` — WealthPilot360 backend
- `Balaji_BusinessOS_Code_v5.gs` — Business OS backend

## ⚠️ READ THIS FIRST — why things still aren't working
Across this whole session, every single symptom you've shown me — `GAS error: LOAD_USERS undefined`, `REGISTER_CLIENT undefined`, folders not being created, template sheets not being copied — has the exact same root cause: **both Apps Script backends are still running old code.** I've fixed the code multiple times; none of those fixes take effect until you actually deploy them. This isn't a guess — the frontend HTML on your *live* site (`balajinextgen.in`) is already the fixed v14/v15 version (confirmed identical to what I gave you), and it's still hitting the old backend. Until both backends below are redeployed, "WealthPilot not open" and "folder not created" will keep happening no matter what else changes.

---

## STEP 1 — Deploy WealthPilot360 backend

1. Open your WealthPilot360 Apps Script project (script.google.com, the one bound to your `/exec` URL ending in `...3310_n2izF_gAjofaIHgSJ/exec`).
2. Select ALL existing code and delete it. Paste in the entire contents of `WealthPilot360_GAS_Backend_v14_Unified.gs`.
3. Save (Ctrl+S).
4. In the function dropdown at the top, select `WP360_setSuperAdminCredentials`, click **Run**. Approve any permission prompts. This stores your admin login server-side — check the Execution log for a ✅ confirmation. (If you want a different admin ID/password, edit the two constants inside that function first.)
5. Click **Deploy → Manage deployments**.
6. Click the **pencil/edit icon** on your existing active deployment (do NOT click "New deployment" — that creates a different URL and breaks the site).
7. Under "Version," choose **New version**. Click **Deploy**.
8. Open this URL in a browser tab: `https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec?action=diag`
   You should see JSON with `"ok": true` and every step in `"steps"` also `"ok": true`. If anything says `false`, read that step's `"error"` field — it tells you exactly what's misconfigured (wrong sheet ID, missing tab, no folder access, etc.).

## STEP 2 — Deploy Business OS backend

Same process, on the Business OS Apps Script project:
1. Replace all code with `Balaji_BusinessOS_Code_v5.gs`. Save.
2. Deploy → Manage deployments → edit existing deployment → New version → Deploy.
3. Visit `<your-business-os-exec-url>?action=diag` and confirm all green.

## STEP 3 — Update the live site files
1. Replace the deployed HTML file on Netlify with `Balaji_WealthPilot360.html` from this ZIP (same filename/path as before).
2. Confirm `sw.js` is sitting in the same folder as the HTML file.
3. Hard-refresh the live page (Ctrl+Shift+R) so the browser doesn't serve a cached copy.

## STEP 4 — Clean up broken test records
These were created by the old, unvalidated backend before the fixes above — they have no real business behind them (blank names/mobiles) or corrupted data (phone number in the email field). Delete each of these IDs from every tab where they appear:

**In `USER_SECURITY_MASTER_DB`:** `CLIENT_MASTER`, `USER_MASTER`, `CLIENT_REGISTRY`
**In `BALAJI_ERP_MASTER_CONTROL_SYSTEM`:** `CLIENT_REGISTRY`, `CLIENT_DATABASE_REGISTRY`, `CLIENT_DEPLOYMENT_REGISTRY`, `SAAS_SUBSCRIPTION_MASTER`

IDs to remove: `CL00019`, `CL00020`, `CL00021` (Business OS test records). Also check Drive for any `CL00019_...` / `CL00020_...` / `CL00021_...` folders under your Business OS root and delete if present/empty.

---

## "WealthPilot won't open" — checklist
I don't have a fresh error screenshot for this specific symptom, so work through this in order and send me a screenshot of wherever it stops:

1. **Which URL are you opening?** It must be `https://www.balajinextgen.in/Module/Mobile%20Apps/Balaji_WealthPilot360/Balaji_WealthPilot360.html` (or wherever it's hosted) — not a local `file:///D:/...` path. Every session so far, local file testing has been the source of several of the console errors you've seen (manifest/service-worker warnings especially).
2. **Hard refresh** — Ctrl+Shift+R (or clear the site's cache in DevTools → Application → Clear storage) so you're not looking at a stale cached copy from before the last upload.
3. **Open DevTools → Console** (F12) on the live URL and check for the first red error at the very top — that's usually the real cause of a blank/frozen screen. Screenshot that.
4. **Check Netlify deploy status** — confirm the latest deploy actually succeeded (Netlify dashboard → Deploys → should show "Published", not "Failed").
5. If the screen is blank white with no console errors at all, it's most likely the HTML file didn't fully upload/publish — re-upload `Balaji_WealthPilot360.html` from this ZIP and confirm the file size matches (~430KB).

---

## Version summary (for your records)
| File | Version | Key fixes |
|---|---|---|
| WealthPilot360 backend | v14 | duplicate mobile/email guard, server-side admin login, DIAG self-test |
| WealthPilot360 frontend | v15 | server-authoritative registration, no hardcoded admin password, fast splash/logo, mobile logout, Enter/Escape keys, fixed manifest start_url |
| Business OS backend | v5 | app-scoped login (fixes cross-dashboard leak), duplicate mobile guard, required-field validation, email format validation, dynamic TEM049 template lookup, error logging, DIAG self-test |
