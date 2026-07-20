/* ════════════════════════════════════════════════════════════════
   FAST PURCHASE ENTRY MODULE v1.0
   
   Features:
   - Quick item selection (autocomplete + dropdown)
   - Tab-based navigation (Tab to next field)
   - Enter to add line item (no click needed)
   - Bulk paste from Excel
   - Smart auto-fill (rates, GST)
   - Real-time total calculation
   - One-click remove items
   - Keyboard shortcuts
   ════════════════════════════════════════════════════════════════ */

// ── PURCHASE ENTRY OPTIMIZED ──
function openFastPurchaseEntry(){
  closeAllSheets();
  openSheet('fastPurchaseSheet');
  initFastPurchaseEntry();
}

function initFastPurchaseEntry(){
  const suppliers = DB.suppliers || [];
  
  // Generate supplier dropdown
  let supplierHtml = suppliers.map(s => 
    `<option value="${s.id}">${s.name}</option>`
  ).join('');
  
  document.getElementById('supplierSelect').innerHTML = 
    `<option value="">-- Select Supplier --</option>${supplierHtml}`;
  
  // Clear form
  document.getElementById('invoiceNo').value = '';
  document.getElementById('invDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('lineItemsTable').innerHTML = '';
  document.getElementById('totalAmount').textContent = '₹0';
  
  // Focus on supplier
  document.getElementById('supplierSelect').focus();
  
  // Setup shortcuts
  setupKeyboardShortcuts();
}

// ── SMART ITEM AUTOCOMPLETE ──
function setupItemAutocomplete(rowId){
  const input = document.getElementById(`itemInput_${rowId}`);
  const dropdown = document.getElementById(`itemDropdown_${rowId}`);
  const items = DB.items || [];
  
  if(!input) return;
  
  input.addEventListener('input', function(){
    const query = this.value.toLowerCase().trim();
    
    if(!query){
      dropdown.style.display = 'none';
      return;
    }
    
    // Filter items (name, code)
    const filtered = items.filter(item => 
      item.name.toLowerCase().includes(query) ||
      (item.code && item.code.toLowerCase().includes(query))
    ).slice(0, 10); // Show top 10
    
    if(filtered.length === 0){
      dropdown.innerHTML = '<div class="ac-item" style="color:var(--red);">No items found</div>';
      dropdown.style.display = 'block';
      return;
    }
    
    dropdown.innerHTML = filtered.map(item => `
      <div class="ac-item" onclick="selectItemFast('${rowId}','${item.id}','${item.name.replace(/'/g,"\\'")}')">
        <div class="ac-name">${item.name}</div>
        <div class="ac-meta">${item.code||''} • ${item.unit} • ₹${fmt(item.pRate)}</div>
      </div>
    `).join('');
    
    dropdown.style.display = 'block';
  });
  
  // Hide on blur
  input.addEventListener('blur', function(){
    setTimeout(() => { dropdown.style.display = 'none'; }, 200);
  });
}

function selectItemFast(rowId, itemId, itemName){
  const item = (DB.items || []).find(i => i.id === itemId);
  if(!item) return;
  
  // Fill item name and details
  document.getElementById(`itemInput_${rowId}`).value = itemName;
  document.getElementById(`itemId_${rowId}`).value = itemId;
  document.getElementById(`unit_${rowId}`).value = item.unit;
  document.getElementById(`rate_${rowId}`).value = item.pRate;
  document.getElementById(`gst_${rowId}`).value = item.gst || 5;
  
  // Auto-calculate amount
  updateLineAmount(rowId);
  
  // Move to quantity field
  document.getElementById(`qty_${rowId}`).focus();
  document.getElementById(`qty_${rowId}`).select();
}

// ── QUICK LINE ADDITION ──
function addLineItemFast(){
  const supplier = document.getElementById('supplierSelect').value;
  if(!supplier){
    toast('Select supplier first!');
    document.getElementById('supplierSelect').focus();
    return;
  }
  
  const rowId = `row_${Date.now()}`;
  
  const html = `
    <div class="line-row" id="${rowId}">
      <div class="line-col" style="flex:2;min-width:200px;">
        <div style="position:relative;">
          <input type="text" 
            id="itemInput_${rowId}" 
            placeholder="Item name or code (type to search)"
            class="line-input"
            onkeydown="handleLineKeydown(event,'${rowId}')">
          <div class="ac-dropdown" id="itemDropdown_${rowId}" style="display:none;"></div>
        </div>
      </div>
      
      <div class="line-col" style="flex:0.6;min-width:60px;">
        <input type="number" 
          id="qty_${rowId}" 
          placeholder="Qty"
          class="line-input"
          step="0.01"
          onchange="updateLineAmount('${rowId}')"
          onkeydown="handleLineKeydown(event,'${rowId}')">
      </div>
      
      <div class="line-col" style="flex:0.5;min-width:50px;text-align:center;font-size:11px;">
        <input type="text" 
          id="unit_${rowId}" 
          class="line-input"
          style="text-align:center;"
          readonly>
      </div>
      
      <div class="line-col" style="flex:0.7;min-width:70px;">
        <input type="number" 
          id="rate_${rowId}" 
          placeholder="Rate"
          class="line-input"
          step="0.01"
          onchange="updateLineAmount('${rowId}')"
          onkeydown="handleLineKeydown(event,'${rowId}')">
      </div>
      
      <div class="line-col" style="flex:0.5;min-width:50px;text-align:center;">
        <input type="number" 
          id="gst_${rowId}" 
          value="5"
          class="line-input"
          style="text-align:center;"
          onkeydown="handleLineKeydown(event,'${rowId}')">
      </div>
      
      <div class="line-col" style="flex:0.9;min-width:80px;text-align:right;padding:8px;">
        <span id="amount_${rowId}" class="mono" style="font-weight:600;">₹0</span>
      </div>
      
      <div class="line-col" style="flex:0.3;min-width:35px;">
        <button class="line-remove" onclick="removeLine('${rowId}')" title="Remove">✕</button>
      </div>
      
      <input type="hidden" id="itemId_${rowId}">
    </div>
  `;
  
  document.getElementById('lineItemsTable').insertAdjacentHTML('beforeend', html);
  
  // Setup autocomplete for new row
  setupItemAutocomplete(rowId);
  
  // Focus on item input
  const itemInput = document.getElementById(`itemInput_${rowId}`);
  itemInput.focus();
  itemInput.select();
}

// ── KEYBOARD NAVIGATION ──
function handleLineKeydown(event, rowId){
  const key = event.key;
  const qty = document.getElementById(`qty_${rowId}`);
  const rate = document.getElementById(`rate_${rowId}`);
  const gst = document.getElementById(`gst_${rowId}`);
  
  // Tab navigation
  if(key === 'Tab'){
    event.preventDefault();
    
    const current = document.activeElement.id;
    
    if(current === `itemInput_${rowId}`){
      qty.focus();
    } else if(current === `qty_${rowId}`){
      rate.focus();
    } else if(current === `rate_${rowId}`){
      gst.focus();
    } else if(current === `gst_${rowId}`){
      // Last field - add new line
      updateLineAmount(rowId);
      addLineItemFast();
    }
  }
  
  // Enter = add new line OR calculate
  if(key === 'Enter'){
    event.preventDefault();
    
    const itemId = document.getElementById(`itemId_${rowId}`).value;
    if(!itemId){
      document.getElementById(`itemInput_${rowId}`).focus();
      return;
    }
    
    updateLineAmount(rowId);
    
    // If in last line, add new
    const isLastRow = (document.getElementById('lineItemsTable').lastChild.id === rowId);
    if(isLastRow){
      addLineItemFast();
    }
  }
  
  // Escape = clear current line
  if(key === 'Escape'){
    document.getElementById(`itemInput_${rowId}`).value = '';
    document.getElementById(`qty_${rowId}`).value = '';
    document.getElementById(`rate_${rowId}`).value = '';
    document.getElementById(`itemInput_${rowId}`).focus();
  }
}

function setupKeyboardShortcuts(){
  document.addEventListener('keydown', function(e){
    // Alt+A = Add new line
    if(e.altKey && e.key === 'a'){
      e.preventDefault();
      addLineItemFast();
    }
    
    // Alt+S = Save purchase
    if(e.altKey && e.key === 's'){
      e.preventDefault();
      saveFastPurchase();
    }
  });
}

// ── UPDATE CALCULATIONS ──
function updateLineAmount(rowId){
  const qty = parseFloat(document.getElementById(`qty_${rowId}`)?.value || 0);
  const rate = parseFloat(document.getElementById(`rate_${rowId}`)?.value || 0);
  const amount = qty * rate;
  
  document.getElementById(`amount_${rowId}`).textContent = `₹${fmt(amount)}`;
  
  // Update total
  updateTotalAmount();
}

function updateTotalAmount(){
  let total = 0;
  
  document.querySelectorAll('[id^="amount_"]').forEach(el => {
    const text = el.textContent.replace('₹', '').replace(/,/g, '');
    total += parseFloat(text) || 0;
  });
  
  document.getElementById('totalAmount').textContent = `₹${fmt(total)}`;
}

function removeLine(rowId){
  document.getElementById(rowId).remove();
  updateTotalAmount();
}

// ── BULK PASTE FROM EXCEL ──
function pasteFromExcel(){
  const text = prompt('Paste Excel data (Item Name | Qty | Rate | GST):\n\nExample:\nChicken Whole|50|120|5\nBhetki Fresh|30|280|5');
  
  if(!text) return;
  
  const lines = text.trim().split('\n');
  
  lines.forEach(line => {
    if(!line.trim()) return;
    
    const parts = line.split('|').map(p => p.trim());
    if(parts.length < 2) return;
    
    const itemName = parts[0];
    const qty = parseFloat(parts[1]) || 0;
    const rate = parseFloat(parts[2]) || 0;
    const gst = parseFloat(parts[3]) || 5;
    
    // Find matching item
    const item = (DB.items || []).find(i => 
      i.name.toLowerCase() === itemName.toLowerCase()
    );
    
    if(!item){
      toast(`Item "${itemName}" not found, skipping`);
      return;
    }
    
    // Add row
    addLineItemFast();
    
    // Fill data
    const lastRow = document.getElementById('lineItemsTable').lastChild.id;
    document.getElementById(`itemInput_${lastRow}`).value = item.name;
    document.getElementById(`itemId_${lastRow}`).value = item.id;
    document.getElementById(`unit_${lastRow}`).value = item.unit;
    document.getElementById(`qty_${lastRow}`).value = qty;
    document.getElementById(`rate_${lastRow}`).value = rate || item.pRate;
    document.getElementById(`gst_${lastRow}`).value = gst;
    
    updateLineAmount(lastRow);
  });
  
  toast('✓ Pasted from Excel');
}

// ── SAVE PURCHASE ──
function saveFastPurchase(){
  const invoiceNo = document.getElementById('invoiceNo').value.trim();
  const invoiceDate = document.getElementById('invDate').value;
  const supplier = document.getElementById('supplierSelect').value;
  
  // Validate
  if(!invoiceNo){
    toast('Enter Invoice No');
    document.getElementById('invoiceNo').focus();
    return;
  }
  
  if(!invoiceDate){
    toast('Select Date');
    document.getElementById('invDate').focus();
    return;
  }
  
  if(!supplier){
    toast('Select Supplier');
    document.getElementById('supplierSelect').focus();
    return;
  }
  
  // Get line items
  const lineItems = [];
  let total = 0;
  
  document.querySelectorAll('[id^="row_"]').forEach(row => {
    const rowId = row.id;
    const itemId = document.getElementById(`itemId_${rowId}`).value;
    const qty = parseFloat(document.getElementById(`qty_${rowId}`).value) || 0;
    const rate = parseFloat(document.getElementById(`rate_${rowId}`).value) || 0;
    const gst = parseFloat(document.getElementById(`gst_${rowId}`).value) || 0;
    
    if(!itemId || !qty || !rate){
      toast('Fill all fields in each line');
      return;
    }
    
    const item = (DB.items || []).find(i => i.id === itemId);
    const amount = qty * rate;
    
    lineItems.push({
      id: itemId,
      name: item.name,
      qty: qty,
      unit: item.unit,
      rate: rate,
      gst: gst,
      amount: amount
    });
    
    total += amount;
  });
  
  if(lineItems.length === 0){
    toast('Add at least one line item');
    return;
  }
  
  // Check if exists
  if(DB.purchases.find(p => p.id === invoiceNo && p.date === invoiceDate)){
    toast(`Invoice ${invoiceNo} already exists`);
    return;
  }
  
  // Save
  DB.purchases.push({
    id: invoiceNo,
    date: invoiceDate,
    supp: supplier,
    mode: 'Credit',
    total: total,
    lineItems: lineItems,
    gstType: 'gst',
    invNo: invoiceNo,
    createdAt: new Date().toISOString()
  });
  
  // Update supplier due
  const supp = DB.suppliers.find(s => s.id === supplier);
  if(supp) supp.due = (supp.due || 0) + total;
  
  // Update inventory
  lineItems.forEach(li => {
    const item = DB.items.find(i => i.id === li.id);
    if(item){
      item.stock = (item.stock || 0) + li.qty;
      item.pRate = li.rate;
    }
  });
  
  persistDB();
  toast(`✅ Invoice ${invoiceNo} saved! ₹${fmt(total)} from ${supp.name}`);
  
  setTimeout(() => {
    closeAllSheets();
    goPage('dashboard');
    renderDashboard();
  }, 1000);
}

// ── CSS STYLES ──
const fastPurchaseStyles = `
.line-row {
  display: flex;
  gap: 6px;
  padding: 8px;
  background: #fff;
  border-bottom: 1px solid var(--border);
  align-items: center;
  transition: background 0.2s;
}

.line-row:hover {
  background: var(--body-bg);
}

.line-col {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.line-input {
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
}

.line-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
}

.line-input::placeholder {
  color: var(--sub);
  font-size: 11px;
}

.line-remove {
  background: none;
  border: none;
  color: var(--red);
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  width: 30px;
  height: 30px;
  transition: all 0.2s;
}

.line-remove:hover {
  background: rgba(255,0,0,0.1);
  border-radius: 4px;
}

.ac-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 4px 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.ac-item {
  padding: 6px 8px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}

.ac-item:hover {
  background: var(--body-bg);
}

.ac-name {
  font-weight: 500;
  color: var(--text);
}

.ac-meta {
  font-size: 10px;
  color: var(--sub);
  margin-top: 2px;
}

.total-row {
  padding: 12px;
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  background: var(--body-bg);
  border-top: 2px solid #333;
}

.button-row {
  display: flex;
  gap: 6px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.quick-btn {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.quick-btn:hover {
  background: var(--body-bg);
  border-color: var(--primary);
}

.quick-btn.primary {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.quick-btn.primary:hover {
  background: var(--primary-dark);
}
`;

// Add styles
if(!document.getElementById('fast-purchase-styles')){
  const style = document.createElement('style');
  style.id = 'fast-purchase-styles';
  style.textContent = fastPurchaseStyles;
  document.head.appendChild(style);
}
