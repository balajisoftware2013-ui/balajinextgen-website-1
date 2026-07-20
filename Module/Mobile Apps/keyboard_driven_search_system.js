/* ════════════════════════════════════════════════════════════════
   KEYBOARD-DRIVEN SEARCH & SELECT SYSTEM v1.0
   
   Features:
   - Type to search any list
   - Arrow keys to navigate
   - Enter to select
   - Tab to open/close
   - Escape to cancel
   - Works everywhere
   ════════════════════════════════════════════════════════════════ */

// ── KEYBOARD-DRIVEN SEARCH COMPONENT ──
class KeyboardSearch {
  constructor(dataSource, onSelect, options = {}) {
    this.dataSource = dataSource;
    this.onSelect = onSelect;
    this.options = options;
    this.filteredItems = [];
    this.selectedIndex = 0;
    this.isOpen = false;
    this.searchTerm = '';
    this.container = null;
  }
  
  // Render search box with dropdown
  render(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    
    const html = `
      <div class="kbd-search-wrapper">
        <div class="kbd-search-input-group">
          <input 
            type="text"
            class="kbd-search-input"
            id="kbd-search-${containerId}"
            placeholder="${this.options.placeholder || 'Type to search...'}"
            autocomplete="off"
            onkeydown="handleKbdSearch(event, '${containerId}')"
            oninput="updateKbdSearch('${containerId}')"
            onfocus="openKbdSearch('${containerId}')"
            onblur="closeKbdSearch('${containerId}')"
          >
          <div class="kbd-search-icon">🔍</div>
        </div>
        
        <div class="kbd-search-dropdown" id="kbd-dropdown-${containerId}" style="display:none;">
          <div class="kbd-search-results" id="kbd-results-${containerId}"></div>
          <div class="kbd-search-help">
            <small>↑↓ Navigate • Enter Select • Esc Cancel</small>
          </div>
        </div>
      </div>
    `;
    
    this.container.innerHTML = html;
    this.input = document.getElementById(`kbd-search-${containerId}`);
    this.dropdown = document.getElementById(`kbd-dropdown-${containerId}`);
    this.resultsContainer = document.getElementById(`kbd-results-${containerId}`);
  }
  
  // Filter items based on search
  filter(term) {
    this.searchTerm = term.toLowerCase().trim();
    this.selectedIndex = 0;
    
    if (!this.searchTerm) {
      this.filteredItems = [];
      return;
    }
    
    this.filteredItems = this.dataSource.filter(item => {
      const name = item.name ? item.name.toLowerCase() : '';
      const code = item.code ? item.code.toLowerCase() : '';
      const text = `${name} ${code}`;
      return text.includes(this.searchTerm);
    }).slice(0, 10); // Show max 10 results
  }
  
  // Display filtered results
  displayResults() {
    if (this.filteredItems.length === 0) {
      this.resultsContainer.innerHTML = `
        <div class="kbd-result-item kbd-result-empty">
          No results found for "${this.searchTerm}"
        </div>
      `;
      return;
    }
    
    this.resultsContainer.innerHTML = this.filteredItems.map((item, idx) => `
      <div 
        class="kbd-result-item ${idx === this.selectedIndex ? 'kbd-result-selected' : ''}"
        onclick="selectKbdItem('${this.options.id}', ${idx})"
        id="kbd-item-${this.options.id}-${idx}"
      >
        <div class="kbd-result-name">${item.name}</div>
        <div class="kbd-result-meta">
          ${item.code ? `<span>${item.code}</span>` : ''}
          ${item.unit ? `<span>${item.unit}</span>` : ''}
          ${item.price ? `<span>₹${fmt(item.price)}</span>` : ''}
        </div>
      </div>
    `).join('');
    
    // Scroll to selected
    this.scrollToSelected();
  }
  
  // Scroll selected item into view
  scrollToSelected() {
    const selected = document.getElementById(`kbd-item-${this.options.id}-${this.selectedIndex}`);
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }
  
  // Navigate with arrow keys
  navigateUp() {
    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    this.displayResults();
  }
  
  navigateDown() {
    this.selectedIndex = Math.min(this.filteredItems.length - 1, this.selectedIndex + 1);
    this.displayResults();
  }
  
  // Select current item
  selectCurrent() {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredItems.length) {
      const item = this.filteredItems[this.selectedIndex];
      this.onSelect(item);
      this.clearSearch();
      this.close();
    }
  }
  
  // Open/close dropdown
  open() {
    this.isOpen = true;
    this.dropdown.style.display = 'block';
    this.input.focus();
  }
  
  close() {
    this.isOpen = false;
    this.dropdown.style.display = 'none';
  }
  
  clearSearch() {
    this.input.value = '';
    this.searchTerm = '';
    this.filteredItems = [];
  }
  
  // Get selected item
  getSelected() {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredItems.length) {
      return this.filteredItems[this.selectedIndex];
    }
    return null;
  }
}

// Global search instances
const kbdSearchInstances = {};

// ── GLOBAL HANDLERS ──
function initKeyboardSearch(id, dataSource, onSelectCallback, options = {}) {
  const opts = {
    id: id,
    ...options
  };
  
  kbdSearchInstances[id] = new KeyboardSearch(dataSource, onSelectCallback, opts);
  kbdSearchInstances[id].render(id);
}

function handleKbdSearch(event, id) {
  const search = kbdSearchInstances[id];
  if (!search) return;
  
  const key = event.key;
  
  if (key === 'ArrowUp') {
    event.preventDefault();
    search.navigateUp();
  } else if (key === 'ArrowDown') {
    event.preventDefault();
    search.navigateDown();
  } else if (key === 'Enter') {
    event.preventDefault();
    search.selectCurrent();
  } else if (key === 'Escape') {
    event.preventDefault();
    search.close();
  } else if (key === 'Tab') {
    if (search.isOpen) {
      event.preventDefault();
      search.selectCurrent();
    }
  }
}

function updateKbdSearch(id) {
  const search = kbdSearchInstances[id];
  if (!search) return;
  
  const term = search.input.value;
  search.filter(term);
  search.displayResults();
}

function openKbdSearch(id) {
  const search = kbdSearchInstances[id];
  if (search && search.filteredItems.length === 0 && search.searchTerm === '') {
    // If empty, show all items on focus
    search.filteredItems = search.dataSource.slice(0, 10);
    search.displayResults();
  }
  search.open();
}

function closeKbdSearch(id) {
  const search = kbdSearchInstances[id];
  if (search) {
    setTimeout(() => search.close(), 200);
  }
}

function selectKbdItem(id, index) {
  const search = kbdSearchInstances[id];
  if (search) {
    search.selectedIndex = index;
    search.selectCurrent();
  }
}

// ── KEYBOARD-DRIVEN PURCHASE ENTRY ──
function openKeyboardPurchaseEntry(){
  closeAllSheets();
  openSheet('keyboardPurchaseSheet');
  initKeyboardPurchaseEntry();
}

function initKeyboardPurchaseEntry(){
  const suppliers = DB.suppliers || [];
  
  // Render supplier search
  document.getElementById('supplierSearchContainer').innerHTML = '';
  initKeyboardSearch(
    'supplier-select',
    suppliers,
    (item) => {
      document.getElementById('supplierSelect').value = item.id;
      document.getElementById('supplierName').textContent = item.name;
      document.getElementById('invoiceNo').focus();
    },
    { placeholder: 'Type supplier name...' }
  );
  
  document.getElementById('invoiceNo').value = '';
  document.getElementById('invDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('lineItemsTable').innerHTML = '';
  
  // Focus on supplier search
  document.getElementById('kbd-search-supplier-select').focus();
}

function addKeyboardLineItem(){
  const supplier = document.getElementById('supplierSelect').value;
  if(!supplier){
    toast('Select supplier first!');
    return;
  }
  
  const rowId = `kbd-row_${Date.now()}`;
  const items = DB.items || [];
  
  const html = `
    <div class="kbd-line-row" id="${rowId}">
      <!-- ITEM SEARCH -->
      <div class="kbd-line-cell" style="flex:2;">
        <div id="item-search-${rowId}"></div>
      </div>
      
      <!-- QTY -->
      <div class="kbd-line-cell" style="flex:0.6;">
        <input type="number" 
          class="kbd-line-input"
          id="qty_${rowId}"
          placeholder="Qty"
          step="0.01"
          onkeydown="handleLineKeydown(event,'${rowId}')"
          onchange="updateLineAmount('${rowId}')">
      </div>
      
      <!-- UNIT -->
      <div class="kbd-line-cell" style="flex:0.5;">
        <input type="text" 
          class="kbd-line-input"
          id="unit_${rowId}"
          readonly
          style="text-align:center;">
      </div>
      
      <!-- RATE -->
      <div class="kbd-line-cell" style="flex:0.7;">
        <input type="number" 
          class="kbd-line-input"
          id="rate_${rowId}"
          placeholder="Rate"
          step="0.01"
          onkeydown="handleLineKeydown(event,'${rowId}')"
          onchange="updateLineAmount('${rowId}')">
      </div>
      
      <!-- GST -->
      <div class="kbd-line-cell" style="flex:0.5;">
        <input type="number" 
          class="kbd-line-input"
          id="gst_${rowId}"
          value="5"
          style="text-align:center;"
          onkeydown="handleLineKeydown(event,'${rowId}')">
      </div>
      
      <!-- AMOUNT -->
      <div class="kbd-line-cell" style="flex:0.9;padding:8px;">
        <span id="amount_${rowId}" style="font-weight:600;">₹0</span>
      </div>
      
      <!-- REMOVE -->
      <div class="kbd-line-cell" style="flex:0.3;">
        <button class="kbd-line-remove" onclick="removeLine('${rowId}')">✕</button>
      </div>
      
      <input type="hidden" id="itemId_${rowId}">
    </div>
  `;
  
  document.getElementById('lineItemsTable').insertAdjacentHTML('beforeend', html);
  
  // Initialize item search for this row
  initKeyboardSearch(
    `item-select-${rowId}`,
    items,
    (item) => {
      document.getElementById(`itemId_${rowId}`).value = item.id;
      document.getElementById(`unit_${rowId}`).value = item.unit;
      document.getElementById(`rate_${rowId}`).value = item.pRate;
      document.getElementById(`gst_${rowId}`).value = item.gst || 5;
      updateLineAmount(rowId);
      document.getElementById(`qty_${rowId}`).focus();
    },
    { placeholder: 'Item name or code' }
  );
  
  // Render it
  kbdSearchInstances[`item-select-${rowId}`].render(`item-search-${rowId}`);
  
  // Focus on item search
  document.getElementById(`kbd-search-item-select-${rowId}`).focus();
}

function handleLineKeydown(event, rowId){
  const key = event.key;
  
  if(key === 'Tab'){
    event.preventDefault();
    const current = document.activeElement.id;
    
    if(current === `qty_${rowId}`){
      document.getElementById(`rate_${rowId}`).focus();
    } else if(current === `rate_${rowId}`){
      document.getElementById(`gst_${rowId}`).focus();
    } else if(current === `gst_${rowId}`){
      updateLineAmount(rowId);
      addKeyboardLineItem();
    }
  }
  
  if(key === 'Enter'){
    event.preventDefault();
    updateLineAmount(rowId);
    const isLast = document.getElementById('lineItemsTable').lastChild.id === rowId;
    if(isLast) addKeyboardLineItem();
  }
}

function updateLineAmount(rowId){
  const qty = parseFloat(document.getElementById(`qty_${rowId}`).value) || 0;
  const rate = parseFloat(document.getElementById(`rate_${rowId}`).value) || 0;
  const amount = qty * rate;
  
  document.getElementById(`amount_${rowId}`).textContent = `₹${fmt(amount)}`;
  updateTotalAmount();
}

function updateTotalAmount(){
  let total = 0;
  document.querySelectorAll('[id^="amount_"]').forEach(el => {
    const text = el.textContent.replace('₹','').replace(/,/g,'');
    total += parseFloat(text) || 0;
  });
  document.getElementById('totalAmount').textContent = `₹${fmt(total)}`;
}

function removeLine(rowId){
  document.getElementById(rowId).remove();
  updateTotalAmount();
}

function saveKeyboardPurchase(){
  const invoiceNo = document.getElementById('invoiceNo').value.trim();
  const invoiceDate = document.getElementById('invDate').value;
  const supplier = document.getElementById('supplierSelect').value;
  
  if(!invoiceNo || !invoiceDate || !supplier){
    toast('Fill all required fields');
    return;
  }
  
  const lineItems = [];
  let total = 0;
  
  document.querySelectorAll('[id^="kbd-row_"]').forEach(row => {
    const rowId = row.id;
    const itemId = document.getElementById(`itemId_${rowId}`).value;
    const qty = parseFloat(document.getElementById(`qty_${rowId}`).value) || 0;
    const rate = parseFloat(document.getElementById(`rate_${rowId}`).value) || 0;
    
    if(itemId && qty && rate){
      const item = DB.items.find(i => i.id === itemId);
      const amount = qty * rate;
      
      lineItems.push({
        id: itemId,
        name: item.name,
        qty: qty,
        unit: item.unit,
        rate: rate,
        gst: parseFloat(document.getElementById(`gst_${rowId}`).value) || 0,
        amount: amount
      });
      
      total += amount;
    }
  });
  
  if(lineItems.length === 0){
    toast('Add at least one item');
    return;
  }
  
  DB.purchases.push({
    id: invoiceNo,
    date: invoiceDate,
    supp: supplier,
    total: total,
    lineItems: lineItems,
    mode: 'Credit',
    invNo: invoiceNo,
    createdAt: new Date().toISOString()
  });
  
  const supp = DB.suppliers.find(s => s.id === supplier);
  if(supp) supp.due = (supp.due || 0) + total;
  
  lineItems.forEach(li => {
    const item = DB.items.find(i => i.id === li.id);
    if(item){
      item.stock = (item.stock || 0) + li.qty;
      item.pRate = li.rate;
    }
  });
  
  persistDB();
  toast(`✅ Invoice saved! ₹${fmt(total)}`);
  
  setTimeout(() => {
    closeAllSheets();
    goPage('dashboard');
  }, 1000);
}

// ── CSS STYLES ──
const keyboardSearchStyles = `
.kbd-search-wrapper {
  margin-bottom: 12px;
}

.kbd-search-input-group {
  position: relative;
  display: flex;
}

.kbd-search-input {
  width: 100%;
  padding: 10px 32px 10px 10px;
  border: 2px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.2s;
}

.kbd-search-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
}

.kbd-search-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  pointer-events: none;
  opacity: 0.5;
}

.kbd-search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 6px 6px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
}

.kbd-search-results {
  max-height: 250px;
  overflow-y: auto;
}

.kbd-result-item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.2s;
}

.kbd-result-item:hover {
  background: var(--body-bg);
}

.kbd-result-selected {
  background: var(--primary);
  color: white;
}

.kbd-result-selected .kbd-result-meta {
  opacity: 0.8;
}

.kbd-result-empty {
  padding: 20px;
  text-align: center;
  color: var(--sub);
  font-size: 12px;
}

.kbd-result-name {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
}

.kbd-result-meta {
  font-size: 11px;
  color: var(--sub);
  display: flex;
  gap: 8px;
}

.kbd-search-help {
  padding: 8px 12px;
  background: var(--body-bg);
  border-top: 1px solid var(--border);
  font-size: 10px;
  color: var(--sub);
  text-align: center;
}

.kbd-line-row {
  display: flex;
  gap: 6px;
  padding: 8px;
  background: white;
  border-bottom: 1px solid var(--border);
  align-items: center;
}

.kbd-line-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.kbd-line-input {
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
}

.kbd-line-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
}

.kbd-line-remove {
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

.kbd-line-remove:hover {
  background: rgba(255,0,0,0.1);
  border-radius: 4px;
}
`;

// Add styles
if(!document.getElementById('keyboard-search-styles')){
  const style = document.createElement('style');
  style.id = 'keyboard-search-styles';
  style.textContent = keyboardSearchStyles;
  document.head.appendChild(style);
}
