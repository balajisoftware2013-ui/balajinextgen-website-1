# BALAJI NEXTGEN ERP v5 — FIX PACKAGE
## All 8 Issues Fixed

---

## FILES DELIVERED

| File | Purpose |
|------|---------|
| `erp-config.js` | Core ERP config — replace existing (all pages include this first) |
| `welcome.html` | New professional welcome dashboard — replace existing |
| `code.gs` | Google Apps Script backend — paste in Apps Script editor |
| `DATABASE_SCHEMA.txt` | Google Sheets column format for USER_MASTER & USER_SECURITY_MASTER |

---

## FIX #1 — DASHBOARD LOGOUT & SESSION EXPIRY ON BROWSER CLOSE ✅

**Problem:** Session persisted in `localStorage` after browser close, allowing re-entry.

**Fix applied in `erp-config.js`:**
- Added `sessionStorage` flag `erp_tab_open` — this clears automatically when browser closes
- On every page load, if `erp_tab_open` is missing = fresh browser = clear all localStorage session data
- Logout button now wired via `data-erp-logout` attribute or class `erp-logout-btn`
- 15-minute inactivity auto-logout with 60-second countdown warning (unchanged)
- SUPER_ADMIN session = 2 hours, all others = 8 hours

**How to add logout button to any page:**
```html
<button data-erp-logout class="erp-logout-btn">Logout</button>
<!-- OR -->
<button onclick="ERP.logout()">Logout</button>
```

---

## FIX #2 — USER_MASTER & USER_SECURITY_MASTER COLUMN FORMAT ✅

**Problem:** Column names inconsistent between Google Sheet and frontend code.

**Fix applied in `erp-config.js` `_normalise()` and `DATABASE_SCHEMA.txt`:**

### USER_MASTER Sheet — Required Columns:
```
USER_CODE | FULL_NAME | EMAIL | MOBILE | PASSWORD_HASH | ROLE |
CLIENT_ID | BRANCH | INDUSTRY | STATUS | CREATED_DATE |
LAST_LOGIN | SUPER_ADMIN_OVERRIDE | DASHBOARD_OVERRIDE | NOTES
```

### USER_SECURITY_MASTER Sheet — Required Columns:
```
USER_CODE | CLIENT_ID | MODULE | CAN_VIEW | CAN_ADD | CAN_EDIT |
CAN_DELETE | CAN_EXPORT | CAN_APPROVE | OVERRIDE_BY_SUPER_ADMIN |
EFFECTIVE_FROM | EFFECTIVE_TO | LAST_UPDATED_BY | NOTES
```

### Allowed ROLE values:
`SUPER_ADMIN | DEVELOPER | OWNER | MANAGER | ACCOUNTANT | CASHIER |
CHEF | WAITER | STORE_MANAGER | CEO | MD | CLIENT | HR |
SUPERVISOR | STAFF | PARTTIME | ACCT`

### Allowed INDUSTRY values (column I of USER_MASTER):
`restaurant | cafe | tea | retail | grocery | supermarket | kirana |
hotel | medical | school | pharmacy | construction | general | blank`

---

## FIX #3 — PROFESSIONAL WELCOME DASHBOARD ✅

**Problem:** Welcome screen lacked professional look; no industry/role routing control.

**Fix in `welcome.html` (complete rewrite):**
- **Two dashboard types:**
  1. **General ERP** — for all industries (Finance, HR, CRM, Inventory, Assets, Projects)
  2. **Restaurant Dashboard** — for restaurant/cafe/tea sectors
  3. **Retail Dashboard** — for retail/grocery/supermarket sectors

- **Role-based display:**
  - `SUPER_ADMIN`, `OWNER`, `ADMIN`, `MANAGER`, `CEO` → See all industry cards + can select
  - `CASHIER`, `CHEF`, `WAITER`, `STAFF` → See only their role dashboard, no industry selector
  - Industry auto-detected from USER_MASTER INDUSTRY column

- **Super Admin control panel:**
  - Change which dashboard any industry opens (live, no code edit)
  - Override role routing
  - Toggle welcome selector screen on/off
  - Changes push to Google Sheet (live for all devices)

---

## FIX #4 — GOOGLE DRIVE DATABASE (SHARED) ✅

**Problem:** Database config not properly connected to shared Google Sheet.

**Fix in `erp-config.js` `ERP_DB_CONFIG`:**
```javascript
const ERP_DB_CONFIG = {
  SHEET_ID   : 'YOUR_GOOGLE_SHEET_ID_HERE',  // ← Update this
  GAS_URL    : 'YOUR_GAS_DEPLOYMENT_URL',    // ← Update this
  USER_MASTER_SHEET    : 'USER_MASTER',
  USER_SECURITY_SHEET  : 'USER_SECURITY_MASTER',
  CLIENT_MASTER_SHEET  : 'CLIENT_MASTER',
};
```

**Steps to connect your Google Sheet:**
1. Open your Google Sheet → copy the ID from the URL
2. Go to script.google.com → paste `code.gs` contents
3. Deploy as Web App (Execute as: Me, Access: Anyone)
4. Copy deployment URL → update `GAS_URL` in `erp-config.js`
5. Helper functions available: `erpReadUserMaster(cb)`, `erpReadUserSecurityMaster(userCode, cb)`

---

## FIX #5 — BALAJI LOGO — NO FLASH ✅

**Problem:** Logo flashed as emoji "B" then changed to uploaded logo.

**Fix in both `erp-config.js` and `welcome.html`:**
- Logo read from `localStorage` BEFORE any HTML renders (inline `<script>` in `<head>`)
- `<link rel="preload">` added for logo image
- `window.__ERP_LOGO__` set immediately
- `_erpApplyLogoImmediate()` runs on `DOMContentLoaded` (before splash completes)
- `applyLogoEverywhere()` sets `src` directly on all logo `<img>` tags before splash animation starts

**Result:** Logo appears in splash screen from frame 1, no flash.

---

## FIX #6 — SUPER ADMIN LIVE MOBILE CONTROL ✅

**Problem:** Super Admin couldn't make live changes visible across all devices.

**Fix:**
- `ERP.pushControlConfig(config)` → saves config to localStorage AND Google Sheet
- `ERP.syncControlPanel()` → reads config from Google Sheet (use on mobile)
- `code.gs` handles `GET_CONTROL_CONFIG` and `SET_CONTROL_CONFIG` actions
- Config stored in `CONTROL_CONFIG` sheet tab
- Any device refreshing the page picks up new routing automatically (via `_erpApplyControlOverrides()`)

**For mobile live mode:**
- Super Admin sets "Mobile live control mode" to ON in welcome.html → Settings
- Dashboard pages call `ERP.syncControlPanel()` on load to get latest overrides

---

## FIX #7 — ALL THEMES ✅

**Available themes in `welcome.html` and applied via `localStorage 'erp_theme'`:**

| Theme | Class | Description |
|-------|-------|-------------|
| Light Blue | (default) | Clean blue sidebar, white cards |
| Light Pink | `th-pink` | Pink gradient, soft feminine palette |
| ChatGPT Light | `th-chatgpt` | Teal/mint, similar to ChatGPT interface |
| Light Orange | `th-orange` | Warm orange, food/restaurant feel |
| Dark Blue | `th-darkblue` | Navy dark theme with blue accents |
| Full Dark | `th-dark` | Complete dark mode with amber accents |

**To apply theme from any page:**
```javascript
// Set theme (saves to localStorage)
document.body.className = 'th-pink'; // or th-chatgpt, th-orange, th-darkblue, th-dark
localStorage.setItem('erp_theme', 'pink');
```

---

## FIX #8 — SUPER ADMIN DASHBOARD ROUTING CONTROL ✅

**Problem:** No way for Super Admin to control which dashboard opens for which industry/role.

**Fix:**
- Super Admin welcome screen has "Dashboard Routing Override" control panel
- Can change: Restaurant/Retail/Default industry routing
- Can change: Admin/Manager/Owner/CEO role routing
- Can toggle: Industry selector screen on/off
- All changes push to Google Sheet → live for all users

**Runtime routing logic (in `erp-config.js`):**
1. Check `user.DASHBOARD_OVERRIDE` (per-user override in USER_MASTER)
2. Check `erp_control_config` in localStorage (Super Admin override)
3. Check if role is in FIXED_ROLE_DASHBOARDS → use ROLE_DASHBOARD
4. Otherwise → resolve by INDUSTRY → use INDUSTRY_DASHBOARD
5. Fallback to DEFAULT dashboard

---

## DEPLOYMENT INSTRUCTIONS

### Step 1: Replace files
```
Replace: erp-config.js     → All pages (root + Dashboard/ folders)
Replace: welcome.html      → Root welcome.html
```

### Step 2: Google Sheets setup
1. Open your Google Sheet
2. Create tabs: `USER_MASTER`, `USER_SECURITY_MASTER`, `CLIENT_MASTER`, `TEMPLATE_REGISTRY`
3. Add headers as shown in `DATABASE_SCHEMA.txt`
4. Add at least one SUPER_ADMIN user row

### Step 3: Google Apps Script
1. Go to script.google.com → New Project
2. Paste `code.gs` contents
3. Update `SHEET_ID` in code.gs line 18
4. Deploy → Web App → Anyone
5. Update `GAS_URL` in erp-config.js line 26

### Step 4: Test
- Login as `admin/admin` (demo mode, works offline)
- Upload your Balaji logo in Settings → should show instantly with no flash
- Change theme → should persist
- Log out → close browser → reopen → should require login again

---

## SUPPORT
📞 9832014403 | balajieducationhub12@gmail.com
