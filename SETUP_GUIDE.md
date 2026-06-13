# Balaji NextGen ERP v10 — Setup Guide
**Quick Deployment Steps**

---

## STEP 1: Configure Master Settings
Edit `/js/master-config.js`:
1. Paste your GAS Web App URL into `gasUrl: ''`
2. Paste your Master Google Sheet ID into `masterSheetId: ''`
3. Fill in your 20 company names, sheetIds, and types in the `companies: []` array

## STEP 2: Deploy GAS Backend Additions
1. Open your Google Apps Script project
2. Create a new file → paste contents of `GAS_V10_ADDITIONS.gs`
3. Run `setupMasterSheetId()` once (paste your Master Sheet ID first)
4. Add the 2 new cases to your existing `doPost()` function (see comments in file)
5. Add the `getLiveUsers` case to your `doGet()` function
6. Re-deploy as Web App (New deployment or update existing)

## STEP 3: Upload to Website
Upload the entire folder to your web host (Netlify, GitHub Pages, cPanel, etc.)
- Entry point: `welcome.html` (this is now v10)
- Login page: `login.html` or `login_V2.html`

## STEP 4: Fix Cashier Dark Theme
The cashier dashboard (`Dashboard/cashier-dashboard.html`) has a hardcoded dark sidebar.
To make it light:
- Open `Dashboard/cashier-dashboard.html`
- Find: `background: linear-gradient(175deg,#1C1917`
- Change `#1C1917` to `#0f172a` (navy — still dark but matches the professional look)
- The main content area will now be light (white cards, light background)

## STEP 5: Test Login Flow
1. Open `welcome.html` → splash screen → welcome banner
2. Click "🚀 Dashboard" → should route by role
3. CASHIER → cashier dashboard (NOT restaurant dashboard)
4. SUPER ADMIN → `Dashboard/super_admin_v4_UPGRADED.html`
5. Go to Login Monitor → should show live users (demo data until GAS connected)

---

## KEY FILES CHANGED IN v10
| File | Change |
|------|--------|
| `welcome.html` | Now v10 (industry auto-theme, proper role routing) |
| `balaji_erp_package/welcome_v10_UPGRADED.html` | Same as above (backup copy) |
| `Dashboard/super-admin-dashboard.html` | Now v4 (live user monitor) |
| `Dashboard/super_admin_v4_UPGRADED.html` | Named backup copy |
| `Dashboard/sales/style.css` | **FIXED** — now LIGHT theme (was black) |
| `Dashboard/cashier_style_LIGHT.css` | Light CSS for cashier pages |
| `js/master-config.js` | NEW — single config for all pages |
| `GAS_V10_ADDITIONS.gs` | NEW — add to your GAS backend |
| `BALAJI_ERP_STRATEGY_GUIDE.md` | Full analysis & roadmap |

---

## SUPPORT
Contact: 9832014403 | balajieducationhub12@gmail.com
