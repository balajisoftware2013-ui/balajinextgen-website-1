/* ═══════════════════════════════════════════════════════════════════════
   Balaji NextGen ERP — Configuration File
   Deployment IDs for Google Apps Script backends (V2_CORE, V2_AUTH, etc.)
   
   📝 IMPORTANT: Replace YOUR_DEPLOYMENT_ID with actual deployment IDs
   from your Google Apps Script deployments.
   
   TO GET YOUR DEPLOYMENT ID:
   1. Open your Google Apps Script project (script.google.com)
   2. Click "Deploy" → "Manage Deployments"
   3. Copy the Deployment ID (looks like: AKfycbw...)
   4. Replace the placeholder below
═══════════════════════════════════════════════════════════════════════ */

// Google Apps Script deployment IDs — MUST be configured for live reports to work
const GAS_APIS_DSR = {
  // V2_CORE handles: GET_DSR_MATRIX, GET_DSR_YTD, GET_BOOTSTRAP, etc.
  // This is the main backend for live POS/DSR data
  V2_CORE: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID_V2_CORE/exec',
  
  // V2_AUTH handles: session tokens, user auth, access control
  V2_AUTH: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID_V2_AUTH/exec'
};

// OPTIONAL: If you have other deployments (TALLY_SYNC, IMPORT, etc.), add them here
const GAS_APIS_EXTRA = {
  // TALLY_SYNC: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID_TALLY/exec',
  // IMPORT: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID_IMPORT/exec'
};

// ═══════════════════════════════════════════════════════════════════════
// QUICK START — Find your deployment IDs:
// ═══════════════════════════════════════════════════════════════════════
// 
// 1. Google Apps Script Editor
//    → Open your Balaji NextGen GAS project
//    → Click "Deploy" (top right)
//    → Select "Manage Deployments"
//    → Copy the Deployment ID next to your latest release
//
// 2. Browser DevTools (if live reports are working anywhere)
//    → F12 → Console
//    → Type: window.GAS_APIS_DSR
//    → You'll see the actual URLs being used
//
// 3. Balaji Dashboard Settings
//    → Some deployments store these in Admin Settings → DB
//    → Check bnx_api_v2_core, bnx_api_v2_auth in localStorage
//
// ═══════════════════════════════════════════════════════════════════════
// 
// FORMAT: https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
// 
// ❌ WRONG: /macros/d/{...}/usercallable  (Execution API, no CORS)
// ✅ RIGHT: /macros/s/{...}/exec          (Web App, CORS-enabled)
//
// ═══════════════════════════════════════════════════════════════════════
