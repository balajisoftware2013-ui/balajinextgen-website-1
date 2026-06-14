# BALAJI NEXTGEN ERP — FILE MAP & COMPLETE SETUP GUIDE
## Version 7.0 | Contact: 9832014403 | balajisoftware2013@gmail.com
## Website: www.balajinextgen.in

---

## WHAT IS IN THIS ZIP

This zip contains **8 final files** that replace specific files in your existing project.  
Everything else in your project (Dashboard pages, demo pages, assets) stays as-is.

```
BALAJI_ERP_FINAL/
│
├── login.html                          ← REPLACE root login.html
├── 01_new_company_wizard.html          ← REPLACE demo/01_new_company_wizard.html
├── erp-config.js                       ← REPLACE root erp-config.js
├── session_guard.js                    ← REPLACE root session_guard.js
├── manifest.json                       ← REPLACE root manifest.json
├── service-worker.js                   ← REPLACE root service-worker.js
├── START_SERVER.bat                    ← REPLACE root START_SERVER.bat
├── _redirects                          ← ALREADY CORRECT — keep as-is
│
├── config/
│   └── app-config.js                   ← REPLACE config/app-config.js
│
├── js/core/
│   └── erp-config.js                   ← REPLACE js/core/erp-config.js (same as root)
│
└── balaji_erp_package/
    ├── welcome_v9_dashboard_selector.html  ← KEEP — this is your main hub dashboard
    └── dashboard_v6_final.html             ← ARCHIVE — do not route anyone here
```

---

## STEP 1 — COPY FILES INTO YOUR PROJECT

Replace these files in your project root (`balajinextgen-website-1/`):

| File in this ZIP | Put it at (from project root) |
|---|---|
| `login.html` | `login.html` |
| `01_new_company_wizard.html` | `01_new_company_wizard.html` |
| `erp-config.js` | `erp-config.js` |
| `erp-config.js` | `js/core/erp-config.js` (same file, copy twice) |
| `session_guard.js` | `session_guard.js` |
| `manifest.json` | `manifest.json` |
| `service-worker.js` | `service-worker.js` |
| `START_SERVER.bat` | `START_SERVER.bat` |
| `config/app-config.js` | `config/app-config.js` |

---

## STEP 2 — TEST LOCALLY

1. Double-click `START_SERVER.bat` (Windows)  
   OR run: `python -m http.server 8000` in the project folder

2. Open: `http://localhost:8000/login.html`

3. Login with:
   - `balajisoftware2013@gmail.com` / `Radha@325` → Super Admin
   - `vannskitchen2023@gmail.com` / `Abcd@1234` → Restaurant Admin (Vanns Kitchen)
   - `cashier@vanns.com` / `abcd1234` → Cashier (direct to POS)
   - `nilanjan@gmail.com` / `Hashtag@1234` → Chef (direct to kitchen)

4. Verify API health badge shows ✅ Connected

---

## STEP 3 — DEPLOY TO PRODUCTION (Netlify)

```bash
git add .
git commit -m "v7.0 — final login, wizard, config, manifest fixes"
git push origin main
```

Netlify auto-deploys. Your CNAME (`www.balajinextgen.in`) is already configured.  
SSL certificate is automatic via Netlify.

---

## HOW THE SYSTEM FLOWS (Full Login → Dashboard Journey)

```
User opens login.html
        │
        ▼
Enters email/password OR OTP
        │
        ▼
erp-config.js → erpApiRequest({ action:'LOGIN' })
        │
        ▼
GAS API (Google Apps Script)
  URL: https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec
        │
        ▼
Returns: { status:'success', ROLE, FULL_NAME, CLIENT_ID, INDUSTRY, BRANCH }
        │
        ▼
ERP.saveSession(result)  →  Saved to localStorage
        │
        ▼
ERP.goToDashboard()  →  Reads ROLE + INDUSTRY → finds correct URL

ROUTING LOGIC:
  SUPER_ADMIN   → Dashboard/super_admin_v4_UPGRADED.html
  DEVELOPER     → Dashboard/developer-dashboard.html
  CASHIER       → Dashboard/restaurant/cashier-dashboard.html
  CHEF          → Dashboard/restaurant/chef-orders.html
  BAR           → Dashboard/restaurant/bar_management_system.html
  WAITER        → Dashboard/employee-dashboard.html
  ACCOUNTANT    → Dashboard/accounts/accounts.html
  CEO           → Dashboard/Ceo-dashboard.html
  HR/STAFF      → Dashboard/employee-dashboard.html
  OWNER/ADMIN + RESTAURANT → balaji_erp_package/welcome_v9_dashboard_selector.html
  OWNER/ADMIN + RETAIL     → balaji_erp_package/welcome_v9_dashboard_selector.html
  OWNER/ADMIN + any other  → balaji_erp_package/welcome_v9_dashboard_selector.html
        │
        ▼
welcome_v9_dashboard_selector.html
  - Animated splash screen with Balaji branding
  - Auto-detects industry → sets theme + hero banner
  - KPI strip (Today Revenue, Orders, Monthly, Profit)
  - Quick launch to POS, KOT, Inventory, GST, HR, Reports
  - Business type switcher (11 industries)
  - Banner editor (client uploads own logo/title)
  - 9 colour themes (Amber, Gold, Green, Blue, Purple, Pink, Orange, Sky, Dark)
  - Sidebar with full module navigation
  - "+ New Client" → 01_new_company_wizard.html
```

---

## YOUR LIVE API DETAILS

| Item | Value |
|---|---|
| GAS Web App URL | `https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec` |
| USER_SECURITY_MASTER_DB | `1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg` |
| MASTER_CONTROL_SYSTEM | `1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I` |

**Test your API is live:**  
Open this URL in a browser:  
`https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec?action=PING`

Expected response:
```json
{"status":"success","message":"Balaji NextGen ERP API Live"}
```

---

## SESSION SECURITY

Handled automatically by `erp-config.js` — no setup needed:

| Feature | Detail |
|---|---|
| Session duration (SUPER_ADMIN) | 2 hours |
| Session duration (all other roles) | 8 hours |
| Inactivity timeout | 15 minutes |
| Warning before logout | 60-second countdown popup |
| Browser close behaviour | Session cleared — must login again |
| Multi-tab | Activity in any tab resets the idle timer |

---

## ADDING SESSION GUARD TO DASHBOARD PAGES

Add this to the `<head>` of every Dashboard HTML page to protect it:

**For pages in `Dashboard/` root:**
```html
<script src="../erp-config.js"></script>
<script>ERP.requireLogin();</script>
```

**For pages in `Dashboard/restaurant/`, `Dashboard/retail/` etc.:**
```html
<script src="../../erp-config.js"></script>
<script>ERP.requireLogin();</script>
```

**Optional — show user name in topbar:**
```html
<script>ERP.injectUserInfo();</script>
<!-- Then in HTML: -->
<span data-erp-field="FULL_NAME"></span>
<span data-erp-field="ROLE"></span>
```

---

## DASHBOARD FILE REFERENCE

| File | Who uses it | Status |
|---|---|---|
| `balaji_erp_package/welcome_v9_dashboard_selector.html` | OWNER, ADMIN (all industries) | ✅ USE — main hub |
| `Dashboard/super_admin_v4_UPGRADED.html` | SUPER_ADMIN, DEVELOPER | ✅ USE — best version |
| `Dashboard/restaurant/dashboard.html` | Can route Restaurant owners directly | ✅ USE |
| `Dashboard/restaurant/cashier-dashboard.html` | CASHIER role | ✅ USE |
| `Dashboard/restaurant/chef-orders.html` | CHEF, BAR role | ✅ USE |
| `Dashboard/retail/Dashboard.html` | RETAIL owners (if direct routing needed) | ✅ USE |
| `Dashboard/manufacturing/manufacturing-dashboard.html` | MANUFACTURING owners | ✅ USE |
| `Dashboard/employee-dashboard.html` | WAITER, STAFF, HR | ✅ USE |
| `Dashboard/accounts/accounts.html` | ACCOUNTANT | ✅ USE |
| `Dashboard/Ceo-dashboard.html` | CEO role | ✅ USE |
| `balaji_erp_package/dashboard_v6_final.html` | Nobody | ⚠️ ARCHIVE — superseded by v9 |
| `Dashboard/super-admin-dashboard.html` | Nobody | ⚠️ ARCHIVE — superseded by v4 |
| `Dashboard/super-admin-dashboardV3.html` | Nobody | ⚠️ ARCHIVE |
| `Dashboard/super-admin-dashboard_Best.html` | Nobody | ⚠️ ARCHIVE |
| `Dashboard/main_dashboard.html` | Nobody | ⚠️ ARCHIVE |
| `login_V1.html`, `login_V2.html` | Nobody | ⚠️ ARCHIVE — use login.html |

---

## NEW CLIENT WIZARD — HOW IT WORKS

`01_new_company_wizard.html` has 7 steps:

1. **Client Info** — Name, mobile, email, city, auto-generates Client ID  
2. **Company Details** — Company name, GST, PAN, address  
3. **Industry & Modules** — Pick industry → auto-selects modules → toggle individual modules  
4. **Plan** — Trial / Starter / Growth / Professional / Enterprise  
5. **Database** — Animated progress while GAS creates sheets  
6. **Admin User** — Admin username + auto-generated password  
7. **Save & Send** — Saves to Google Sheets, sends welcome email, shows credentials

**GAS Action called:** `REGISTER_CLIENT`  
**Works offline:** Yes — saves to localStorage, syncs when back online  
**Exports:** CSV, TXT, Print card, WhatsApp, Email  

---

## WHAT EACH FILE DOES

### `login.html`
- Left panel: Balaji logo (`assets/Logos/logo.png`), feature list, live badge
- Right panel: Password login + OTP login tabs, forgot password modal
- 3 quick buttons: Main Website, Demo, New Company
- Calls GAS `LOGIN` action, normalises response, saves session, redirects by role+industry
- OTP: calls `SEND_OTP` → email delivery → `VERIFY_OTP`
- Password reset: OTP-verified reset via `RESET_PASSWORD`

### `erp-config.js`
- Single source of truth for ALL pages
- Contains: GAS URL, Sheet IDs, role routing, industry routing, session save/get/clear
- `ERP.saveSession()` — saves login result to localStorage
- `ERP.getUser()` — reads session, checks expiry
- `ERP.requireLogin()` — redirects to login if not logged in
- `ERP.goToDashboard()` — routes based on role + industry
- `ERP.logout()` — clears storage, notifies GAS, redirects
- `erpApiRequest()` — POST to GAS, auto-normalises response
- `_normalise()` — handles both old and new GAS response shapes
- Inactivity watcher — 15 min timeout, 60 sec countdown popup
- Browser close listener — clears session on tab/window close

### `session_guard.js`
- Extended session management for Dashboard pages
- Reads both localStorage and sessionStorage
- 15 min idle timeout with 2-min visible warning box
- Auto-wires all logout buttons on the page
- Populates `data-session` attributes with user data
- `SessionGuard.init()` — call at top of any dashboard page

### `welcome_v9_dashboard_selector.html`
- Animated splash screen (logo float, progress bar, loading messages)
- Micro status bar (live indicator, clock, logout)
- Topbar with user info and business type badge
- Industry-switching sidebar (11 types, auto-themes)
- Hero banner (background image per industry, KPI strip, action buttons)
- Quick launch grid (role-appropriate modules)
- Clients tab (loads from GAS, shows all registered clients)
- Modules tab (all available ERP modules)
- 6 colour themes switchable in sidebar
- "+ New Client" → wizard

### `manifest.json`
- Fixed: start_url → `/login.html`
- Fixed: icon paths → `/assets/Logos/logo.png`
- Fixed: shortcut URLs → correct pages
- Enables "Install App" on mobile (PWA)

### `service-worker.js`
- Cache V4 with correct file list
- Network-first strategy (always tries live, falls back to cache)
- GAS API calls always go to network (never cached)
- Offline fallback → `/offline.html`
- Auto-deletes old cache versions on activate

---

## QUICK COMMANDS

```bash
# Test locally (Windows — double-click START_SERVER.bat, OR):
python -m http.server 8000

# Deploy to Netlify
git add . && git commit -m "v7.0 final" && git push

# Check GAS API health
curl "https://script.google.com/macros/s/AKfycbxYC6C2ltrcupaEexLJlvoJkISnAtgqE2p_o2KUInn1TaFh4IA2hQeq7cC9Q9ceFrOx/exec?action=PING"

# Check who is in USER_MASTER (Google Sheets)
# Open: https://docs.google.com/spreadsheets/d/1VpsTwdULiaj-YeyllgBcYk4txKXrrAwvETBpR1hO1Pg
```

---

## SUPPORT

- **Phone / WhatsApp:** 9832014403
- **Email:** balajisoftware2013@gmail.com
- **Website:** www.balajinextgen.in
- **Location:** Siliguri, West Bengal

---

*Balaji NextGen ERP v7.0 — Built with Google Apps Script + Vanilla HTML/JS*  
*Hosted on Netlify | Database on Google Sheets | PWA Ready*
