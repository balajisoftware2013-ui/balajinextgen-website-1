# Balaji NextGen ERP — Wizard Fix Package

## Root Causes Fixed

### 1. ⚠️ GAS Offline badge (PRIMARY — from ERROR_LOG in your sheet)
**Error:** `Cannot read properties of undefined (reading 'postData') at doPost (db:170:31)`

Your GAS `doPost` was crashing when the wizard called `GET_STATS` via GET request — because `doGet` was not handling `?action=GET_STATS`. The GAS was routing GET requests incorrectly OR `doGet` was missing.

**Fix:** `GAS_WIZARD_BACKEND.gs` — complete rewrite with:
- `doGet()` handles `GET_STATS` and `GET_CLIENTS`
- `doPost()` handles `SAVE_CLIENT`, `LOGOUT`, and gracefully handles calls without postData
- `Access-Control-Allow-Origin: *` CORS headers on every response
- HTML-response guard (detects GAS redirect/auth page, throws error instead of JSON parse crash)

### 2. Patched file regressions (fixed in HTML)
- Restored `fetchWithTimeout` (15s) in `gasGet` — no more hanging requests
- Restored `r.ok` check before `.text()` — no more silent 302/403 JSON parse failures  
- Added HTML-response guard — detects GAS cold-start redirect
- Added **↻ Retry** button — appears only when GAS Offline, lets user reconnect without refresh

---

## Deployment Steps

### Step A — Deploy the GAS Backend
1. Open your GAS project (the one at the `GAS_URL` in the wizard)
2. Delete your existing `doGet` and `doPost` functions (or the whole `db.gs` file)
3. Create a new file → paste contents of `GAS_WIZARD_BACKEND.gs`
4. **Deploy → New deployment → Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the new Deployment URL
6. If the URL changed, update `GAS_URL` in `01_new_company_wizard.html` (line ~327)

### Step B — Upload the HTML
1. Upload `01_new_company_wizard.html` to your server at the same path
2. Open it in browser → status bar should show **Connected ✓** (green badge)

### Step C — Verify in browser
Paste this URL directly in browser — you should see JSON, NOT a login page:
```
https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec?action=GET_STATS
```
If you see HTML (login page) → deployment permissions are wrong → re-deploy as "Anyone".

---

## Sheet IDs Used
| Sheet | ID |
|---|---|
| BALAJI_ERP_MASTER_CONTROL_SYSTEM | `1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I` |
| USER_SECURITY_MASTER_DB | `1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg` |

## What GAS Backend Now Does
- `GET_STATS` → reads CLIENT_MASTER, returns `nextClientId`, `total`, `lastClient`
- `SAVE_CLIENT` → writes to CLIENT_MASTER + USER_MASTER + FEATURE_CONTROL_MASTER
- `GET_CLIENTS` → returns all clients (for View All button)
- All errors logged to `ERROR_LOG` sheet
