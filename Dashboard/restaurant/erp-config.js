/* ============================================================================
 * erp-config.js — DSR Client Configuration
 * This file is loaded by dsr-client.html to configure API endpoints and
 * auth validation. Place this file in the same directory as dsr-client.html
 * or one directory level up (../).
 * ============================================================================ */

// ============ CONFIGURE THESE FOR YOUR DEPLOYMENT ============
// Replace with YOUR actual Google Apps Script deployment URL
const GAS_DEPLOYMENT_URL = 'https://script.google.com/macros/d/YOUR_DEPLOYMENT_ID/usercallable';

// Map logical endpoint names to deployment URLs
// If you have separate deployments for different services, list them here
const GAS_APIS_DSR = {
  'V2_CORE': GAS_DEPLOYMENT_URL,        // Main DSR / Core ERP API
  'RESTAURANT': GAS_DEPLOYMENT_URL,     // Restaurant-specific endpoints
  'WIZARD': GAS_DEPLOYMENT_URL,         // Client wizard / onboarding
  'FALLBACK': GAS_DEPLOYMENT_URL        // Fallback if primary is down
};

// ============ AUTHENTICATION GATE ============
/**
 * initAuthGate_() — Validates session before DSR loads
 * Called by initDSRMode() in dsr-client.html before any data fetch
 * Throws error if session is invalid or missing
 */
function initAuthGate_() {
  // Get auth contexts (token + client pairs) from browser storage
  const contexts = bnxGetAuthContexts_();
  
  if (!contexts || contexts.length === 0) {
    throw new Error('NO_SESSION — No active auth context found. Redirecting to login.');
  }

  const context = contexts[0]; // Primary auth context
  const token = context.token;
  const clientId = context.client;

  // Validate token
  if (!token || token.trim() === '') {
    throw new Error('INVALID_TOKEN — Session token is missing or empty.');
  }

  // Validate client ID (can be empty for single-client deployments)
  // Remove this check if your deployment supports anonymous/default client
  if (!clientId || clientId.trim() === '') {
    console.warn('[AUTH] Warning: No client ID provided. Using default or URL parameter.');
  }

  console.log('[AUTH] Gate passed. Context: ', { 
    client: clientId, 
    tokenLength: token.length,
    source: context.source 
  });

  // Store in session for DSR operations
  try {
    sessionStorage.setItem('_bnx_auth_token', token);
    sessionStorage.setItem('_bnx_auth_client', clientId);
  } catch (e) {
    console.warn('[AUTH] Could not cache auth in sessionStorage:', e.message);
  }
}

// ============ DSR_MODE CONFIGURATION (Optional) ============
// These can also be set via URL params (?dsrMode=UPLOAD_MODE&posSystem=SQUARE)
// Default: DIRECT_POS (auto-fetch from GAS backend)
// Alternative: UPLOAD_MODE (manual upload → process)

if (!window.DSR_CFG) {
  window.DSR_CFG = {
    dsrMode: 'DIRECT_POS',      // 'DIRECT_POS' | 'UPLOAD_MODE'
    posSystem: 'RISTA',          // 'RISTA' | 'SQUARE' | 'CLOVER' | 'MANUAL'
    theme: 'light',              // 'light' | 'dark'
    autoRefresh: true,           // Auto-refresh POS data every 5 min
    refreshInterval: 300000      // 5 minutes in ms
  };
  try {
    localStorage.setItem('bnx_dsr_config', JSON.stringify(window.DSR_CFG));
  } catch (e) {
    console.warn('[CONFIG] Could not save DSR_CFG to localStorage:', e.message);
  }
}

console.log('[CONFIG] erp-config.js loaded. GAS_APIS_DSR configured.');
console.log('[CONFIG] DSR Mode:', window.DSR_CFG.dsrMode, '| POS System:', window.DSR_CFG.posSystem);
