# File Deployment Guide — Business OS v13

## 📂 Two Main Files You Need

### File 1: Code.gs (Backend)
- **What:** Google Apps Script backend
- **Where:** Google Apps Script project: BALAJI_NEXTGEN_ERP_V2_CORE
- **How:** Copy entire content → paste into Code.gs file → Deploy

### File 2: HTML (Frontend)
- **What:** Business OS web application
- **Where:** Netlify (deployed at balajinextgen.in)
- **How:** Upload file → Deploy → Live

---

## 📋 Deployment Checklist

```
BACKEND (Code.gs):
┌─────────────────────────────────────────────────────┐
│ 1. Open Google Apps Script project:                │
│    BALAJI_NEXTGEN_ERP_V2_CORE                      │
│                                                     │
│ 2. Replace entire Code.gs with v13 version         │
│    • Select all (Ctrl+A)                           │
│    • Delete                                        │
│    • Paste new Code.gs                             │
│                                                     │
│ 3. Save (Ctrl+S)                                   │
│                                                     │
│ 4. Deploy → New Deployment                         │
│    • Type: Google Apps Script                      │
│    • Description: "v13 - Direct Sync + Healing"   │
│    • Release as HEAD                               │
│                                                     │
│ 5. Test: Run runDiag() → Check all ✓              │
└─────────────────────────────────────────────────────┘

FRONTEND (HTML):
┌─────────────────────────────────────────────────────┐
│ 1. Go to Netlify Dashboard                         │
│    https://app.netlify.com                         │
│                                                     │
│ 2. Select site: balajinextgen.in                   │
│                                                     │
│ 3. Upload balaji-business-os-DIRECT-SYNC.html      │
│    • Drag & drop into deploy area                  │
│    • Or click "Deploy" → Select file               │
│                                                     │
│ 4. Wait for "Published" status                     │
│                                                     │
│ 5. Test: Open balajinextgen.in                     │
│    • Login test                                    │
│    • Check sync indicator                          │
│    • Verify dashboard shows data                   │
└─────────────────────────────────────────────────────┘
```

---

## 🔗 File URLs in This Package

### Individual Files (Also in ZIP):

**1. Code.gs** (Backend)
```
Size: 15 KB
Lines: ~400
Use: Google Apps Script project
Copy: Entire file content
Deploy: BALAJI_NEXTGEN_ERP_V2_CORE → Code.gs tab
```

**2. balaji-business-os-DIRECT-SYNC.html** (Frontend)
```
Size: 19 KB
Type: Single-file web app (HTML + CSS + JS combined)
Use: Web deployment
Deploy: Netlify (balajinextgen.in) or any web server
```

---

## 🌍 For Other Browsers/Clients

### Same Files Work For All Clients

The **Code.gs** and **HTML** files are universal:
- ✅ Works for CL00022 (already deployed)
- ✅ Works for any other client (just change sheetId on login)
- ✅ No changes needed to files
- ✅ All data isolation happens at login time

### To Deploy for New Client

```
1. Backend (Code.gs): 
   → Deploy once (shared for all clients)
   → Same Code.gs for all clients
   
2. Frontend (HTML):
   → Same HTML for all clients
   → Different Google Sheets per client
   → Data isolated by login
   
3. Users:
   → Each client logs in with their credentials
   → App loads their data from their Google Sheet
   → No code changes needed
```

### Example: Deploying for CL00023 (New Client)

```
Step 1: Code.gs
   - Already deployed (shared)
   - No action needed
   
Step 2: HTML
   - Use same balaji-business-os-DIRECT-SYNC.html
   - No changes to file
   - Upload to web server
   
Step 3: User Login
   - CL00023 user logs in
   - App reads sheetId from database
   - Loads CL00023's data
   - All automatic
   
Result: CL00023 has full access with no code changes
```

---

## 📦 What's in the Package

### Files Ready to Deploy

```
├── Code.gs                                    [Backend]
│   └── Deploy to: BALAJI_NEXTGEN_ERP_V2_CORE
│       
├── balaji-business-os-DIRECT-SYNC.html      [Frontend]
│   └── Deploy to: balajinextgen.in (Netlify)
│       
└── Documentation files (for reference)
    ├── README.md
    ├── DEPLOYMENT_CHECKLIST.md
    ├── CL00022_QUICK_FIX.md
    └── etc...
```

---

## 🚀 Quick Deployment (5 Minutes)

### For Code.gs:

```javascript
// 1. Open: BALAJI_NEXTGEN_ERP_V2_CORE Apps Script project
// 2. Click on Code.gs tab
// 3. Select all: Ctrl+A
// 4. Delete: Backspace
// 5. Paste entire content from provided Code.gs file
// 6. Save: Ctrl+S
// 7. Deploy: Menu → Deploy → New Deployment
// 8. Test: In Console, run: runDiag()
```

### For HTML:

```
// 1. Go to Netlify: https://app.netlify.com
// 2. Select site: balajinextgen.in
// 3. Drag HTML file into deploy area
// 4. Wait for "Published" message
// 5. Open balajinextgen.in in browser
// 6. Test login
```

---

## ✅ Verification After Deploy

### Backend (Code.gs):

```javascript
// Run in Apps Script Console:
runDiag()

// Expected output:
{
  "ok": true,
  "steps": [
    {"step": "USER_SECURITY_MASTER_DB", "ok": true},
    {"step": "MASTER_CONTROL_SYSTEM", "ok": true},
    ...
  ]
}
```

### Frontend (HTML):

```
1. Open balajinextgen.in
2. You should see login form
3. Logo/title visible
4. GAS_URL configured correctly
5. No console errors (F12)
```

### End-to-End Test:

```
1. Login as test user
2. Dashboard should load with data
3. Sync indicator in top-right (✓ or ⟳)
4. Try adding a customer
5. Should show "✓ Synced"
6. Check in Google Sheet → entry should appear
```

---

## 🔐 Security Notes

### GAS_URL Configuration

Both files use this endpoint:
```javascript
const GAS_URL = 'https://script.google.com/macros/s/AKfycbweBrJ9QH9ItEE_5t2hzwASZPblf0m6NHSr6vxr5s4w-dcj2bUdQFANnyUcXuxSK4YK/exec';
```

This is the deployed Code.gs endpoint. If you redeploy Code.gs, copy the new endpoint URL and update in HTML:

```html
// Find in balaji-business-os-DIRECT-SYNC.html:
const GAS_URL = '[NEW_ENDPOINT_FROM_YOUR_DEPLOYMENT]';
```

---

## 📞 Support

If something doesn't work:

**Check Backend:**
```
1. Open Apps Script project
2. Go to Executions tab
3. Look for recent errors
4. Check Logger for messages: View → Logs
```

**Check Frontend:**
```
1. Open browser DevTools: F12
2. Console tab: Look for errors
3. Network tab: Check fetch calls
4. Check GAS_URL is correct
```

**Contact:**
- Phone: 9832014403
- Email: balajisoftware2013@gmail.com

---

## 📂 File Organization

```
Your Project
├── Google Apps Script
│   └── BALAJI_NEXTGEN_ERP_V2_CORE
│       └── Code.gs ← Paste v13 Code.gs here
│
├── Web Server / Netlify
│   └── balajinextgen.in
│       └── index.html ← Upload v13 HTML here
│
└── Google Sheets (per client)
    ├── CL00022_RR_FRESH_AND_MORE
    │   ├── PURCHASES tab
    │   ├── SALES tab
    │   ├── APP_DATA tab
    │   └── etc...
    │
    └── Other clients' sheets
        ├── CL00023_...
        ├── CL00024_...
        └── etc...
```

---

## 💡 Key Points

✅ **Same Code.gs** for all clients (deployed once, used by all)  
✅ **Same HTML** for all clients (can be deployed once or per-client)  
✅ **Data isolation** happens via login (sheetId)  
✅ **No code changes** needed for new clients  
✅ **Multi-browser support** (Chrome, Firefox, Safari, Edge all work)  
✅ **Mobile support** (HTML works on phones, tablets, desktops)  

---

**Ready to deploy?**

1. Extract files from ZIP
2. Follow DEPLOYMENT_CHECKLIST.md for step-by-step
3. Verify with testing checklist above
4. Monitor for first hour
5. Done!

Questions? See CL00022_REPAIR_GUIDE.md or contact support.
