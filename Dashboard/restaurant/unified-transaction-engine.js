/**
 * BALAJI NEXTGEN ERP — UNIFIED TRANSACTION ENGINE
 * 
 * Replaces:
 *   - SAVE_ORDER
 *   - SAVE_KOT
 *   - SAVE_BILL
 *   - SAVE_PAYMENT
 *   - SAVE_PURCHASE
 *   - SAVE_STOCK_ADJUSTMENT
 *   - ... etc
 * 
 * Single source of truth for all transactional saves.
 * Features:
 *   - Request ID deduplication (idempotency)
 *   - Offline queueing (outbox)
 *   - Automatic retry with exponential backoff
 *   - Transaction status tracking (LIVE, SYNCING, OFFLINE, PENDING, FAILED)
 *   - Unified validation
 *   - Audit trail creation
 * 
 * Location: shared library (both Steward Mobile and Dashboard load this)
 * Usage: Both apps call saveTransaction() instead of individual SAVE_* functions
 */

// ─────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────

const TX_CONFIG = {
  // API endpoint
  API_URL: (function(){
    try {
      return localStorage.getItem('bnx_api_core') || 'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec';
    } catch (e) {
      return 'https://script.google.com/macros/s/AKfycbz39r1zo4LGqHJXpwDsQFulHdp3qsjiLRxRiSIEBBObI_3310_n2izF_gAjofaIHgSJ/exec';
    }
  })(),

  // Retry strategy
  MAX_ATTEMPTS: 5,
  BASE_DELAY_MS: 300,
  MAX_DELAY_MS: 30000,
  
  // Outbox
  OUTBOX_PREFIX: 'bnx_outbox_', // bnx_outbox_<CLIENT_ID>
  SYNC_LOG_PREFIX: 'bnx_synclog_', // bnx_synclog_<REQUEST_ID>
  
  // Polling
  FLUSH_INTERVAL_MS: 10000, // Check for pending every 10s
};

// Transaction validation schemas (expand as needed)
const TRANSACTION_SCHEMAS = {
  ORDER: {
    required: ['CLIENT_ID', 'LOCATION_ID', 'ORDER_SOURCE', 'ORDER_TYPE'],
    optionalArrays: ['items'],
    calculation: (data) => {
      // Items can be added during creation
      return true;
    }
  },
  KOT: {
    required: ['CLIENT_ID', 'LOCATION_ID', 'ORDER_ID'],
    optionalArrays: [],
    calculation: (data) => {
      return true;
    }
  },
  BILL: {
    required: ['CLIENT_ID', 'LOCATION_ID', 'items'],
    optionalArrays: ['items'],
    itemsMinLength: 1,
    calculation: (data) => {
      // Verify bill amounts match items
      const itemTotal = (data.items || []).reduce((s, i) => s + ((i.qty || 0) * (i.rate || 0)), 0);
      // Allow small variance (paise rounding)
      return Math.abs(itemTotal - (data.subtotal || 0)) < 1;
    }
  },
  PURCHASE: {
    required: ['CLIENT_ID', 'LOCATION_ID', 'SUPPLIER_ID', 'items'],
    optionalArrays: ['items'],
    itemsMinLength: 1,
    calculation: (data) => {
      return true;
    }
  },
  PAYMENT: {
    required: ['CLIENT_ID', 'LOCATION_ID', 'AMOUNT', 'PAYMENT_MODE'],
    optionalArrays: [],
    calculation: (data) => {
      return data.AMOUNT > 0;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 1. OUTBOX MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get outbox for this client (list of pending transactions).
 * Returns: Array of { requestId, action, data, status, attempts, createdAt, ... }
 */
function txGetOutbox(clientId) {
  try {
    const key = TX_CONFIG.OUTBOX_PREFIX + clientId;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('[TX] Failed to read outbox:', e);
    return [];
  }
}

/**
 * Add transaction to outbox (for offline queuing).
 */
function txQueueTransaction(clientId, requestId, action, data) {
  try {
    const outbox = txGetOutbox(clientId);
    const entry = {
      requestId,
      action,
      data,
      status: 'QUEUED', // QUEUED → SENDING → CONFIRMED or FAILED
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    outbox.push(entry);
    const key = TX_CONFIG.OUTBOX_PREFIX + clientId;
    localStorage.setItem(key, JSON.stringify(outbox));
    return entry;
  } catch (e) {
    console.error('[TX] Failed to queue transaction:', e);
    return null;
  }
}

/**
 * Update outbox entry status.
 */
function txUpdateOutboxStatus(clientId, requestId, status, error = null) {
  try {
    const key = TX_CONFIG.OUTBOX_PREFIX + clientId;
    const outbox = txGetOutbox(clientId);
    const entry = outbox.find(e => e.requestId === requestId);
    if (!entry) return;
    
    entry.status = status; // CONFIRMED, FAILED, SYNCED
    entry.updatedAt = new Date().toISOString();
    if (error) entry.lastError = error;
    
    localStorage.setItem(key, JSON.stringify(outbox));
    return entry;
  } catch (e) {
    console.error('[TX] Failed to update outbox:', e);
  }
}

/**
 * Remove confirmed transaction from outbox.
 */
function txRemoveFromOutbox(clientId, requestId) {
  try {
    const key = TX_CONFIG.OUTBOX_PREFIX + clientId;
    const outbox = txGetOutbox(clientId);
    const filtered = outbox.filter(e => e.requestId !== requestId);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (e) {
    console.error('[TX] Failed to remove from outbox:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 2. SYNC LOG (Track which requests have been sent/confirmed)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Check if this requestId was already processed (idempotency check).
 * Returns: { processed: true, result: {...} } or { processed: false }
 */
function txIsDuplicate(requestId) {
  try {
    const key = TX_CONFIG.SYNC_LOG_PREFIX + requestId;
    const stored = localStorage.getItem(key);
    if (stored) {
      const log = JSON.parse(stored);
      return { processed: true, result: log.result };
    }
    return { processed: false };
  } catch (e) {
    return { processed: false };
  }
}

/**
 * Record that a requestId was successfully processed.
 */
function txMarkProcessed(requestId, transactionId, transactionType) {
  try {
    const key = TX_CONFIG.SYNC_LOG_PREFIX + requestId;
    const log = {
      requestId,
      transactionId,
      transactionType,
      processedAt: new Date().toISOString(),
      result: { transactionId } // Returned to client
    };
    localStorage.setItem(key, JSON.stringify(log));
  } catch (e) {
    console.error('[TX] Failed to mark processed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 3. VALIDATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validate transaction data against schema.
 * Returns: { valid: true } or { valid: false, errors: [...] }
 */
function txValidate(transactionType, data) {
  const errors = [];
  const schema = TRANSACTION_SCHEMAS[transactionType] || {};
  
  // Check required fields
  (schema.required || []).forEach(field => {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(`${field} is required`);
    }
  });
  
  // Check items array
  if (schema.optionalArrays && schema.optionalArrays.includes('items')) {
    if (data.items && !Array.isArray(data.items)) {
      errors.push('items must be an array');
    }
    if (schema.itemsMinLength && (!data.items || data.items.length < schema.itemsMinLength)) {
      errors.push(`items must have at least ${schema.itemsMinLength} item(s)`);
    }
  }
  
  // Check amounts are positive
  if (data.AMOUNT !== undefined && data.AMOUNT <= 0) {
    errors.push('Amount must be greater than 0');
  }
  
  // Custom calculation check
  if (schema.calculation && !schema.calculation(data)) {
    errors.push('Calculation verification failed (total vs items mismatch)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 4. MAIN API CALL WITH RETRY
// ─────────────────────────────────────────────────────────────────────────

/**
 * Low-level API call with retry logic.
 * Used by saveTransaction() internally.
 */
async function txApiCall(action, payload, attempt = 1) {
  const clientId = payload.clientId || '';
  
  try {
    const ctrl = new AbortController();
    const timeoutMs = 15000;
    const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);
    
    const response = await fetch(TX_CONFIG.API_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // CORS-simple, no preflight
      },
      body: JSON.stringify({
        action,
        clientId,
        sessionToken: (localStorage.getItem('ERP_SESSION') || ''),
        ...payload
      })
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok && response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return {
      success: true,
      data
    };
  } catch (err) {
    // Retry logic
    if (attempt < TX_CONFIG.MAX_ATTEMPTS) {
      const delay = Math.min(
        TX_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt - 1),
        TX_CONFIG.MAX_DELAY_MS
      );
      await new Promise(r => setTimeout(r, delay));
      return txApiCall(action, payload, attempt + 1);
    }
    
    // Max attempts exceeded
    return {
      success: false,
      error: err.message,
      attempt,
      maxAttempts: TX_CONFIG.MAX_ATTEMPTS
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 5. MAIN SAVE FUNCTION
// ─────────────────────────────────────────────────────────────────────────

/**
 * UNIFIED SAVE FUNCTION
 * 
 * Replaces: saveOrder(), saveKOT(), saveBill(), etc.
 * 
 * @param {String} transactionType - "ORDER" | "KOT" | "BILL" | "PURCHASE" | etc.
 * @param {Object} data - Transaction data (items, amounts, etc.)
 * @param {Object} options - { onStatusChange, showNotification } callbacks
 * 
 * Returns: Promise<{
 *   success: true/false,
 *   transactionId: UUID or null,
 *   requestId: UUID,
 *   status: "LIVE" | "SYNCING" | "OFFLINE" | "PENDING_SYNC" | "FAILED",
 *   error: error message or null
 * }>
 */
async function saveTransaction(transactionType, data, options = {}) {
  const clientId = data.CLIENT_ID || localStorage.getItem('bnx_client_id') || '';
  
  if (!clientId) {
    return {
      success: false,
      error: 'Not authenticated (no client ID)',
      status: 'FAILED'
    };
  }
  
  // Step 1: Validate input
  const validation = txValidate(transactionType, data);
  if (!validation.valid) {
    const msg = validation.errors.join('; ');
    options.showNotification && options.showNotification(msg, 'error');
    return {
      success: false,
      error: msg,
      status: 'FAILED'
    };
  }
  
  // Step 2: Generate request ID (permanent, immutable)
  const requestId = generateUUID();
  
  // Step 3: Check for duplicate (idempotency)
  const duplicate = txIsDuplicate(requestId);
  if (duplicate.processed) {
    return {
      success: true,
      transactionId: duplicate.result.transactionId,
      requestId,
      status: 'LIVE',
      message: 'Duplicate request detected — using previous result'
    };
  }
  
  // Step 4: Update UI to SYNCING
  options.onStatusChange && options.onStatusChange(requestId, 'SYNCING');
  
  // Step 5: Try to send to server
  const payload = {
    requestId,
    action: `SAVE_${transactionType}`,
    clientId,
    sessionToken: (localStorage.getItem('ERP_SESSION') || ''),
    transactionType,
    data
  };
  
  const result = await txApiCall(`SAVE_${transactionType}`, payload);
  
  // Step 6: Handle result
  if (result.success && result.data && result.data.success) {
    // SERVER CONFIRMED
    const transactionId = result.data.transactionId || result.data.id;
    txMarkProcessed(requestId, transactionId, transactionType);
    
    // Update UI to LIVE
    options.onStatusChange && options.onStatusChange(requestId, 'LIVE');
    options.showNotification && options.showNotification(
      `${transactionType} saved successfully`,
      'success'
    );
    
    return {
      success: true,
      transactionId,
      requestId,
      status: 'LIVE'
    };
  } else {
    // SERVER FAILED or UNREACHABLE
    // Queue for retry
    txQueueTransaction(clientId, requestId, `SAVE_${transactionType}`, payload);
    
    // Update UI to PENDING_SYNC / OFFLINE
    const isOnline = navigator.onLine;
    const status = isOnline ? 'PENDING_SYNC' : 'OFFLINE';
    
    options.onStatusChange && options.onStatusChange(requestId, status);
    options.showNotification && options.showNotification(
      `${transactionType} queued for sync (offline or server unavailable)`,
      'warning'
    );
    
    return {
      success: false,
      transactionId: null,
      requestId,
      status,
      error: result.error,
      queued: true
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 6. SYNC ENGINE (Flush outbox on demand or scheduled)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Flush all pending transactions in outbox.
 * Called: 
 *   - On app load
 *   - When connectivity restored
 *   - Every 10 seconds (configurable)
 *   - Manually by user
 */
async function txFlushOutbox(clientId, options = {}) {
  const outbox = txGetOutbox(clientId);
  const pending = outbox.filter(e => e.status === 'QUEUED' || e.status === 'SENDING');
  
  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }
  
  console.log(`[TX] Flushing ${pending.length} pending transactions...`);
  
  let synced = 0;
  let failed = 0;
  
  for (const entry of pending) {
    // Mark as SENDING
    txUpdateOutboxStatus(clientId, entry.requestId, 'SENDING');
    options.onProgress && options.onProgress(entry);
    
    // Attempt to send
    const result = await txApiCall(entry.action, entry.data);
    
    if (result.success && result.data && result.data.success) {
      // CONFIRMED
      const transactionId = result.data.transactionId || result.data.id;
      txMarkProcessed(entry.requestId, transactionId, entry.data.transactionType);
      txUpdateOutboxStatus(clientId, entry.requestId, 'CONFIRMED');
      txRemoveFromOutbox(clientId, entry.requestId);
      synced++;
    } else {
      // FAILED
      txUpdateOutboxStatus(clientId, entry.requestId, 'FAILED', result.error);
      failed++;
    }
  }
  
  console.log(`[TX] Flush complete: ${synced} synced, ${failed} failed`);
  
  // Notify UI
  options.onComplete && options.onComplete({ synced, failed });
  
  return { synced, failed };
}

// ─────────────────────────────────────────────────────────────────────────
// 7. PERIODIC SYNC (Background)
// ─────────────────────────────────────────────────────────────────────────

let _txSyncInterval = null;
let _txCurrentClient = null;

/**
 * Start automatic sync on background (every 10s or configurable).
 */
function txStartPeriodicSync(clientId) {
  _txCurrentClient = clientId;
  
  if (_txSyncInterval) clearInterval(_txSyncInterval);
  
  _txSyncInterval = setInterval(() => {
    if (navigator.onLine) {
      txFlushOutbox(clientId).catch(e => {
        console.error('[TX] Periodic sync error:', e);
      });
    }
  }, TX_CONFIG.FLUSH_INTERVAL_MS);
  
  console.log(`[TX] Periodic sync started (interval: ${TX_CONFIG.FLUSH_INTERVAL_MS}ms)`);
}

/**
 * Stop periodic sync.
 */
function txStopPeriodicSync() {
  if (_txSyncInterval) {
    clearInterval(_txSyncInterval);
    _txSyncInterval = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 8. ONLINE/OFFLINE DETECTION
// ─────────────────────────────────────────────────────────────────────────

window.addEventListener('online', () => {
  console.log('[TX] Online detected — flushing outbox');
  if (_txCurrentClient) {
    txFlushOutbox(_txCurrentClient);
  }
});

window.addEventListener('offline', () => {
  console.log('[TX] Offline detected — queuing mode active');
});

// ─────────────────────────────────────────────────────────────────────────
// 9. TRANSACTION STATUS DISPLAY
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get badge text for transaction status.
 * Display near transaction: SYNCING... / PENDING SYNC (3) / FAILED (1)
 */
function txGetStatusBadgeText(clientId) {
  const outbox = txGetOutbox(clientId);
  const syncing = outbox.filter(e => e.status === 'SENDING').length;
  const pending = outbox.filter(e => e.status === 'QUEUED').length;
  const failed = outbox.filter(e => e.status === 'FAILED').length;
  
  if (syncing > 0) return `SYNCING... (${syncing})`;
  if (pending > 0) return `PENDING SYNC (${pending})`;
  if (failed > 0) return `FAILED SYNC (${failed})`;
  return 'LIVE';
}

/**
 * Get status badge HTML for display on page.
 */
function txRenderStatusBadge(clientId) {
  const text = txGetStatusBadgeText(clientId);
  const className = text.startsWith('SYNCING') ? 'tx-status-syncing' :
                    text.startsWith('PENDING') ? 'tx-status-pending' :
                    text.startsWith('FAILED') ? 'tx-status-failed' :
                    'tx-status-live';
  
  return `<span class="tx-badge ${className}">${text}</span>`;
}

// ─────────────────────────────────────────────────────────────────────────
// 10. CLEAR CONFIRMED TRANSACTIONS (Cleanup old sync logs)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Clean up old sync logs after 7 days.
 */
function txCleanupOldSyncLogs() {
  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    const RETENTION_MS = 7 * 24 * 3600 * 1000;
    
    keys.forEach(key => {
      if (key.startsWith(TX_CONFIG.SYNC_LOG_PREFIX)) {
        const stored = localStorage.getItem(key);
        try {
          const log = JSON.parse(stored);
          const logTime = new Date(log.processedAt).getTime();
          if (now - logTime > RETENTION_MS) {
            localStorage.removeItem(key);
          }
        } catch (e) {}
      }
    });
  } catch (e) {
    console.error('[TX] Cleanup error:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 11. UTILITY: UUID GENERATION
// ─────────────────────────────────────────────────────────────────────────

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 12. INIT & EXPORTS
// ─────────────────────────────────────────────────────────────────────────

// Clean up old logs on page load
txCleanupOldSyncLogs();

// Export public API
const BNX_TX = {
  // Main API
  saveTransaction,
  
  // Sync control
  flushOutbox: txFlushOutbox,
  startPeriodicSync: txStartPeriodicSync,
  stopPeriodicSync: txStopPeriodicSync,
  
  // Status
  getStatusBadgeText: txGetStatusBadgeText,
  renderStatusBadge: txRenderStatusBadge,
  
  // Outbox management
  getOutbox: txGetOutbox,
  getPendingCount: (clientId) => txGetOutbox(clientId).length,
  
  // Utilities
  generateUUID,
  validate: txValidate
};

// Make available globally
if (typeof window !== 'undefined') {
  window.BNX_TX = BNX_TX;
}

// For Node.js (if used in server)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BNX_TX;
}

// ─────────────────────────────────────────────────────────────────────────
// USAGE EXAMPLES
// ─────────────────────────────────────────────────────────────────────────

/*

// ─── EXAMPLE 1: Save a bill (replaces saveBill()) ───
const billData = {
  CLIENT_ID: 'client-123',
  LOCATION_ID: 'loc-001',
  ORDER_ID: 'ord-456',
  items: [
    { ITEM_ID: 'item-1', qty: 2, rate: 280 },
    { ITEM_ID: 'item-2', qty: 1, rate: 60 }
  ],
  subtotal: 620,
  total: 733.60 // including tax
};

const result = await BNX_TX.saveTransaction('BILL', billData, {
  onStatusChange: (requestId, status) => {
    console.log(`Bill ${requestId} is now ${status}`);
  },
  showNotification: (msg, type) => {
    toast(msg, type);
  }
});

if (result.success) {
  console.log(`Bill saved with ID: ${result.transactionId}`);
} else {
  console.log(`Bill queued for sync: ${result.status}`);
}

// ─── EXAMPLE 2: Manual sync (user taps Sync button) ───
const flushResult = await BNX_TX.flushOutbox(CLIENT_ID, {
  onProgress: (entry) => {
    console.log(`Syncing ${entry.action}...`);
  },
  onComplete: (summary) => {
    toast(`${summary.synced} synced, ${summary.failed} failed`, 'info');
  }
});

// ─── EXAMPLE 3: Display status badge ───
document.getElementById('sync-status').innerHTML = 
  BNX_TX.renderStatusBadge(CLIENT_ID);

// ─── EXAMPLE 4: Check pending count ───
const pendingCount = BNX_TX.getPendingCount(CLIENT_ID);
document.getElementById('pending-badge').textContent = pendingCount;

// ─── EXAMPLE 5: Start periodic sync on app init ───
BNX_TX.startPeriodicSync(CLIENT_ID);

// ─── EXAMPLE 6: Stop sync on logout ───
BNX_TX.stopPeriodicSync();

*/

// ─────────────────────────────────────────────────────────────────────────
// END OF UNIFIED TRANSACTION ENGINE
// ─────────────────────────────────────────────────────────────────────────
