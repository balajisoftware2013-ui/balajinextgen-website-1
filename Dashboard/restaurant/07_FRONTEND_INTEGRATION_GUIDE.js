/**
 * BALAJI NEXTGEN ERP v3.0 — FRONTEND INTEGRATION GUIDE
 * 
 * How to integrate unified transaction engine into:
 *   - Steward Mobile (steward-mobile.html)
 *   - Restaurant Dashboard (restaurant-dashboard.html)
 *   - POS (if separate)
 * 
 * This guide shows before/after code for each major operation.
 */

// ═════════════════════════════════════════════════════════════════════════
// STEP 1: LOAD UNIFIED ENGINE
// ═════════════════════════════════════════════════════════════════════════

/**
 * In <head> of HTML file, add:
 * 
 * <script src="https://path/to/unified-transaction-engine.js"></script>
 * 
 * Ensures BNX_TX object available globally before using it.
 */

// ═════════════════════════════════════════════════════════════════════════
// STEP 2: REPLACE SAVE_ORDER
// ═════════════════════════════════════════════════════════════════════════

/**
 * OLD CODE (in Steward Mobile):
 * 
 * function saveOrder() {
 *   const order = {
 *     items: ORDER.items,
 *     total: ORDER.total,
 *     table: currentTableNo
 *   };
 *   
 *   gasApi('SAVE_ORDER', order).then(res => {
 *     if (res.success) {
 *       toast('Order saved');
 *       localStorage.removeItem('currentOrder');
 *       loadOrders(); // refresh list
 *     } else {
 *       toast('Error: ' + res.error);
 *     }
 *   }).catch(err => {
 *     toast('Failed to save order');
 *   });
 * }
 */

/**
 * NEW CODE (using unified engine):
 */
async function saveOrder() {
  const order = {
    CLIENT_ID: localStorage.getItem('bnx_client_id') || '',
    LOCATION_ID: localStorage.getItem('bnx_location_id') || '',
    ORDER_SOURCE: 'STEWARD', // or 'POS' for dashboard
    ORDER_TYPE: currentOrderType || 'DINEIN', // DINEIN, TAKEAWAY, DELIVERY
    TABLE_ID: getTableId(currentTableNo),
    CUSTOMER_ID: currentCustomerId || '',
    CUSTOMER_NAME: currentCustomerName || '',
    PAX: currentPax || 1,
    SPECIAL_INSTRUCTIONS: ORDER.specialInstructions || '',
    items: ORDER.items.map(item => ({
      ITEM_ID: item.ITEM_ID,
      ITEM_NAME: item.name,
      qty: item.qty,
      rate: item.price,
      TAX_RATE: item.tax_rate || 0.18,
      UNIT_ID: item.unit || 'PIECE',
      SPECIAL_INSTRUCTIONS: item.special || ''
    }))
  };
  
  // Call unified engine
  const result = await BNX_TX.saveTransaction('ORDER', order, {
    onStatusChange: (requestId, status) => {
      // Update UI with status
      console.log(`Order ${requestId} is now ${status}`);
      updateOrderStatusBadge(requestId, status);
    },
    showNotification: (msg, type) => {
      // Show toast notification
      toast(msg, type);
    }
  });
  
  if (result.success) {
    // Server confirmed — order has permanent ORDER_ID
    order.ORDER_ID = result.transactionId;
    localStorage.setItem('currentOrderId', result.transactionId);
    toast(`Order ${result.transactionId} saved`, 'success');
    
    // Clear form
    ORDER = { items: [] };
    loadOrders(); // refresh order list
  } else if (result.queued) {
    // Offline — order queued for sync
    toast(`Order queued for sync (${result.status})`, 'warning');
    // Order is preserved in outbox, will auto-sync when online
  } else {
    // Error
    toast(`Error: ${result.error}`, 'error');
  }
}

// ═════════════════════════════════════════════════════════════════════════
// STEP 3: REPLACE SAVE_KOT
// ═════════════════════════════════════════════════════════════════════════

/**
 * OLD CODE:
 * 
 * function sendOrderToKitchen(orderId) {
 *   const kot = {
 *     ORDER_ID: orderId,
 *     items: ORDER.items,
 *     table: currentTableNo
 *   };
 *   
 *   gasApi('SAVE_KOT', kot).then(res => {
 *     if (res.success) {
 *       KOT[orderId] = res.data;
 *       toast('KOT sent');
 *     }
 *   }).catch(() => toast('Failed'));
 * }
 */

/**
 * NEW CODE:
 */
async function sendOrderToKitchen(orderId) {
  const orderData = getOrderById(orderId);
  
  const kot = {
    CLIENT_ID: localStorage.getItem('bnx_client_id') || '',
    LOCATION_ID: localStorage.getItem('bnx_location_id') || '',
    ORDER_ID: orderId,
    TABLE_ID: orderData.TABLE_ID,
    CUSTOMER_NAME: orderData.CUSTOMER_NAME || '',
    COVERS: orderData.PAX || 1,
    items: orderData.items.map((item, idx) => ({
      ITEM_ID: item.ITEM_ID,
      ITEM_NAME: item.ITEM_NAME,
      ORDER_ITEM_ID: item.ORDER_ITEM_ID, // link back to order item
      qty: item.qty,
      UNIT_ID: item.UNIT_ID || 'PIECE',
      SPECIAL_INSTRUCTIONS: item.SPECIAL_INSTRUCTIONS || ''
    }))
  };
  
  const result = await BNX_TX.saveTransaction('KOT', kot, {
    onStatusChange: (requestId, status) => {
      updateKOTStatusBadge(requestId, status);
    },
    showNotification: toast
  });
  
  if (result.success) {
    const kotId = result.transactionId;
    console.log(`KOT ${kotId} sent to kitchen`);
    
    // Update local cache
    KOT[kotId] = {
      KOT_ID: kotId,
      ORDER_ID: orderId,
      status: 'PRINTED'
    };
    
    toast('KOT sent to kitchen', 'success');
    refreshKOTDisplay();
  } else if (result.queued) {
    toast('KOT queued for sync', 'warning');
  } else {
    toast(`Error: ${result.error}`, 'error');
  }
}

// ═════════════════════════════════════════════════════════════════════════
// STEP 4: REPLACE SAVE_BILL
// ═════════════════════════════════════════════════════════════════════════

/**
 * OLD CODE (Dashboard):
 * 
 * function saveBill() {
 *   const bill = {
 *     items: billItems,
 *     total: billTotal,
 *     customer: currentCustomer
 *   };
 *   
 *   gasApi('SAVE_BILL', bill).then(res => {
 *     if (res.success) {
 *       BILLS.push(res.data);
 *       toast('Bill saved');
 *     }
 *   });
 * }
 */

/**
 * NEW CODE:
 */
async function saveBill() {
  // Validate bill
  if (!billItems || billItems.length === 0) {
    toast('Bill must have at least 1 item', 'error');
    return;
  }
  
  // Calculate bill amount (using unified calculation engine)
  const billCalc = calculateBillAmount(billItems);
  
  const bill = {
    CLIENT_ID: localStorage.getItem('bnx_client_id') || '',
    LOCATION_ID: localStorage.getItem('bnx_location_id') || '',
    ORDER_ID: currentOrderId || '',
    TABLE_ID: currentTableId || '',
    CUSTOMER_ID: currentCustomerId || '',
    CUSTOMER_NAME: currentCustomerName || 'Walk-in',
    BILL_TYPE: currentBillType || 'DINEIN',
    COVERS: currentCovers || 1,
    items: billItems.map((item, idx) => ({
      ITEM_ID: item.ITEM_ID,
      ORDER_ITEM_ID: item.ORDER_ITEM_ID || '',
      ITEM_NAME: item.name,
      qty: item.qty,
      rate: item.rate,
      COST_PRICE: item.cost_price || item.rate * 0.5,
      LINE_DISCOUNT: item.discount || 0,
      TAX_RATE: item.tax_rate || 0.18,
      UNIT_ID: item.unit || 'PIECE'
    })),
    subtotal: billCalc.subtotal,
    itemDiscount: billCalc.itemDiscount,
    billDiscount: billCalc.billDiscount,
    tax: billCalc.tax,
    total: billCalc.total,
    AMOUNT_PAID: amountReceived || 0,
    PAYMENT_MODE: paymentMode || 'CASH',
    PAYMENT_REFERENCE: paymentReference || '',
    NOTES: billNotes || ''
  };
  
  const result = await BNX_TX.saveTransaction('BILL', bill, {
    onStatusChange: (requestId, status) => {
      updateBillStatusBadge(requestId, status);
    },
    showNotification: toast
  });
  
  if (result.success) {
    const billId = result.transactionId;
    console.log(`Bill ${billId} saved successfully`);
    
    // Show bill confirmation
    displayBillConfirmation({
      BILL_ID: billId,
      ...bill
    });
    
    // Clear form
    billItems = [];
    currentOrderId = null;
    
    // Refresh bill register
    loadBillRegister();
    
    toast(`Bill #${billId} saved`, 'success');
  } else if (result.queued) {
    toast('Bill queued for sync', 'warning');
    displayBillConfirmation({ ...bill, BILL_ID: '(pending)' });
  } else {
    toast(`Error: ${result.error}`, 'error');
  }
}

// ═════════════════════════════════════════════════════════════════════════
// STEP 5: DISPLAY SYNC STATUS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Update sync status badge on page (shows LIVE / SYNCING / OFFLINE / PENDING / FAILED).
 */
function updateSyncStatusBadge() {
  const clientId = localStorage.getItem('bnx_client_id') || '';
  const badge = BNX_TX.renderStatusBadge(clientId);
  const element = document.getElementById('sync-status-badge');
  
  if (element) {
    element.innerHTML = badge;
  }
}

/**
 * Update periodically (every 2 seconds).
 */
setInterval(() => {
  updateSyncStatusBadge();
}, 2000);

/**
 * Also update when transaction status changes.
 */
function updateOrderStatusBadge(requestId, status) {
  const badge = document.getElementById(`badge-${requestId}`);
  if (badge) {
    badge.textContent = status;
    badge.className = `tx-badge tx-badge-${status.toLowerCase()}`;
  }
}

// ═════════════════════════════════════════════════════════════════════════
// STEP 6: INITIALIZE ON PAGE LOAD
// ═════════════════════════════════════════════════════════════════════════

/**
 * On page load, start periodic sync.
 */
window.addEventListener('load', () => {
  const clientId = localStorage.getItem('bnx_client_id');
  const isOnline = navigator.onLine;
  
  if (clientId) {
    // Start periodic sync (every 10 seconds)
    BNX_TX.startPeriodicSync(clientId);
    
    // Manual sync button
    const syncButton = document.getElementById('manual-sync-btn');
    if (syncButton) {
      syncButton.addEventListener('click', async () => {
        syncButton.disabled = true;
        const result = await BNX_TX.flushOutbox(clientId, {
          onComplete: (summary) => {
            toast(`Synced: ${summary.synced}, Failed: ${summary.failed}`, 'info');
            syncButton.disabled = false;
          }
        });
      });
    }
    
    // Show initial status
    updateSyncStatusBadge();
  }
});

// ═════════════════════════════════════════════════════════════════════════
// STEP 7: HANDLE ONLINE/OFFLINE
// ═════════════════════════════════════════════════════════════════════════

/**
 * When app goes online, automatically sync pending transactions.
 */
window.addEventListener('online', () => {
  console.log('[App] Online detected');
  toast('Connected — syncing pending transactions', 'info');
  
  const clientId = localStorage.getItem('bnx_client_id');
  if (clientId) {
    BNX_TX.flushOutbox(clientId).then(result => {
      const msg = `Synced: ${result.synced}, Failed: ${result.failed}`;
      toast(msg, result.failed > 0 ? 'warning' : 'success');
    });
  }
});

/**
 * When app goes offline, show warning.
 */
window.addEventListener('offline', () => {
  console.log('[App] Offline detected');
  toast('Connection lost — orders will sync when online', 'warning');
  updateSyncStatusBadge();
});

// ═════════════════════════════════════════════════════════════════════════
// STEP 8: LOGOUT HANDLING
// ═════════════════════════════════════════════════════════════════════════

/**
 * On logout, stop periodic sync but preserve outbox.
 */
function doLogout() {
  const clientId = localStorage.getItem('bnx_client_id');
  
  // Stop periodic sync
  BNX_TX.stopPeriodicSync();
  
  // Clear session
  localStorage.removeItem('ERP_SESSION');
  localStorage.removeItem('ERP_USER');
  
  // NOTE: Do NOT clear bnx_outbox_<CLIENT_ID> — preserve pending transactions
  // User logs back in, outbox will auto-sync
  
  window.location.assign('../../login.html');
}

// ═════════════════════════════════════════════════════════════════════════
// STEP 9: UNIFIED CALCULATION ENGINE
// ═════════════════════════════════════════════════════════════════════════

/**
 * Single bill calculation function (used everywhere).
 * CRITICAL: Same calculation in Frontend + Backend.
 */
function calculateBillAmount(items, billDiscount = 0, taxRate = 0.18) {
  let subtotal = 0;
  let itemDiscount = 0;
  
  items.forEach(item => {
    const lineAmount = item.qty * item.rate;
    subtotal += lineAmount;
    itemDiscount += item.discount || 0;
  });
  
  const subtotalAfterDiscount = subtotal - itemDiscount;
  const taxable = subtotalAfterDiscount - billDiscount;
  const tax = Math.round(taxable * taxRate);
  const roundOff = Math.round(tax) - tax; // paise adjustment
  const total = taxable + tax + roundOff;
  
  return {
    subtotal,
    itemDiscount,
    subtotalAfterDiscount,
    billDiscount,
    taxable,
    taxRate,
    tax,
    roundOff,
    total
  };
}

// ═════════════════════════════════════════════════════════════════════════
// STEP 10: REMOVE OLD CODE (CLEANUP)
// ═════════════════════════════════════════════════════════════════════════

/**
 * FIND AND DELETE (search in your HTML files):
 * 
 * ❌ REMOVE:
 * - function saveOrder() { ... gasApi('SAVE_ORDER', ...) ... }
 * - function saveKOT() { ... gasApi('SAVE_KOT', ...) ... }
 * - function saveBill() { ... gasApi('SAVE_BILL', ...) ... }
 * - function savePurchase() { ... }
 * - function sendModifiedOrder() { ... }
 * - const SAVE_ORDER, SAVE_KOT, SAVE_BILL variables
 * - Old outbox logic (bnxGetOutbox, bnxFlushOutbox in Steward)
 * - Old KOT array handling (KOT = [...])
 * - Old BILLS array concatenation (BILLS = [...cached, ...server])
 * - Demo bill samples
 * 
 * ✅ KEEP:
 * - UI rendering functions
 * - Toast/notification functions
 * - Table/list refresh functions
 * - Form validation
 * - Event listeners
 * 
 * Reason: These are UI operations, not transaction logic.
 * The unified engine handles save/sync/offline.
 */

// ═════════════════════════════════════════════════════════════════════════
// STEP 11: TEST EACH OPERATION
// ═════════════════════════════════════════════════════════════════════════

/**
 * QA CHECKLIST:
 * 
 * For Steward Mobile:
 * [ ] Create order → verify LIVE status
 * [ ] Double-click save → verify single order created
 * [ ] Create order offline → verify PENDING_SYNC status
 * [ ] Go online → verify auto-sync
 * [ ] Modify KOT → verify updated in dashboard
 * 
 * For Dashboard:
 * [ ] Create bill → verify LIVE status
 * [ ] See bill in register → verify no duplication
 * [ ] Generate Tally export → verify bill included
 * [ ] View inventory → verify stock deducted
 * [ ] View customer dues → verify correct amount
 * 
 * Cross-app:
 * [ ] Create order in Steward, bill in Dashboard → verify IDs link
 * [ ] Two browsers at once → verify no conflicts
 * [ ] Refresh browser with pending → verify preserved
 */

// ═════════════════════════════════════════════════════════════════════════
// EXAMPLE: COMPLETE SAVE FLOW
// ═════════════════════════════════════════════════════════════════════════

/**
 * User clicks "Save Order" button in Steward Mobile:
 */
document.getElementById('save-order-btn').addEventListener('click', async function() {
  // 1. Gather data
  const orderData = {
    CLIENT_ID: localStorage.getItem('bnx_client_id'),
    LOCATION_ID: localStorage.getItem('bnx_location_id'),
    ORDER_SOURCE: 'STEWARD',
    ORDER_TYPE: 'DINEIN',
    TABLE_ID: currentTableId,
    items: ORDER.items
  };
  
  // 2. Show loading state
  this.disabled = true;
  this.textContent = 'Saving...';
  
  // 3. Call unified engine
  const result = await BNX_TX.saveTransaction('ORDER', orderData, {
    onStatusChange: (requestId, status) => {
      this.textContent = `Order (${status})`;
    },
    showNotification: (msg, type) => {
      console.log(`[Notification] ${type}: ${msg}`);
      // Show toast
      alert(msg);
    }
  });
  
  // 4. Handle response
  if (result.success) {
    console.log(`✓ Order saved: ${result.transactionId}`);
    ORDER.ORDER_ID = result.transactionId;
    this.textContent = 'Save Order';
    this.disabled = false;
    
    // Clear form
    ORDER.items = [];
  } else if (result.queued) {
    console.log(`⏳ Order queued (${result.status})`);
    this.textContent = 'Save Order (Pending)';
    this.disabled = false;
  } else {
    console.log(`✗ Error: ${result.error}`);
    this.textContent = 'Save Order';
    this.disabled = false;
  }
});

// ═════════════════════════════════════════════════════════════════════════
// END OF INTEGRATION GUIDE
// ═════════════════════════════════════════════════════════════════════════
