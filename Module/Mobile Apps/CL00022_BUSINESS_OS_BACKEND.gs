/**
 * CL00022 BUSINESS OS BACKEND
 * Complete Google Apps Script backend for purchase register, reports, and master data
 * 
 * Sheet ID: 1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc
 * Client: CL00022 (RR Fresh & More)
 * 
 * SETUP:
 * 1. Copy this entire code
 * 2. Create new file in BALAJI_NEXTGEN_ERP_V2_CORE project
 * 3. Update SHEET_ID constant
 * 4. Deploy as executable
 */

// ===== CONFIGURATION =====
const SHEET_ID = '1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc';
const CLIENT_ID = 'CL00022';
const CLIENT_NAME = 'RR Fresh & More';

// ===== MAIN HANDLER =====
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    console.log(`📥 Received action: ${action}`);
    
    let result = { success: false, error: '' };
    
    switch(action) {
      case 'GET_ALL_CL00022_DATA':
        result = getAllCL00022Data();
        break;
      case 'GET_PURCHASES':
        result = getPurchasesData();
        break;
      case 'GET_SUPPLIERS':
        result = getSuppliersData();
        break;
      case 'GET_ITEMS':
        result = getItemsData();
        break;
      case 'SYNC_CL00022_DATA':
        result = syncCL00022Data(data);
        break;
      case 'ADD_SUPPLIER':
        result = addSupplier(data.supplier);
        break;
      case 'UPDATE_SUPPLIER':
        result = updateSupplier(data.supplier);
        break;
      case 'DELETE_SUPPLIER':
        result = deleteSupplier(data.supplier_id);
        break;
      case 'ADD_ITEM':
        result = addItem(data.item);
        break;
      case 'UPDATE_ITEM':
        result = updateItem(data.item);
        break;
      case 'DELETE_ITEM':
        result = deleteItem(data.item_id);
        break;
      case 'ADD_PURCHASE':
        result = addPurchase(data.purchase);
        break;
      case 'UPDATE_PURCHASE':
        result = updatePurchase(data.purchase);
        break;
      case 'DELETE_PURCHASE':
        result = deletePurchase(data.purchase_id);
        break;
      case 'VERIFY':
        result = verifyData();
        break;
      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }
    
    const output = ContentService.createTextOutput(JSON.stringify(result));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
    
  } catch(error) {
    console.error('Error:', error);
    const output = ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    }));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  }
}

// ===== DATA LOADING FUNCTIONS =====

/**
 * Get all CL00022 data (Suppliers, Items, Purchases, Line Items)
 */
function getAllCL00022Data() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    const suppliers = getSheetData(ss, 'SUPPLIERS', 2); // Skip header
    const items = getSheetData(ss, 'ITEMS', 2);
    const purchases = getSheetData(ss, 'PURCHASES', 2);
    const lineItems = getSheetData(ss, 'PURCHASE_LINE_ITEMS', 2);
    
    console.log(`✅ Loaded: ${suppliers.length} suppliers, ${items.length} items, ${purchases.length} purchases, ${lineItems.length} line items`);
    
    return {
      success: true,
      data: {
        suppliers: suppliers,
        items: items,
        purchases: purchases,
        purchase_line_items: lineItems
      }
    };
  } catch(e) {
    console.error('Error loading data:', e);
    return { success: false, error: e.toString() };
  }
}

/**
 * Get purchases data
 */
function getPurchasesData() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const purchases = getSheetData(ss, 'PURCHASES', 2);
    const suppliers = getSheetData(ss, 'SUPPLIERS', 2);
    
    return {
      success: true,
      data: { purchases: purchases, suppliers: suppliers }
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Get suppliers data
 */
function getSuppliersData() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const suppliers = getSheetData(ss, 'SUPPLIERS', 2);
    
    return {
      success: true,
      data: { suppliers: suppliers }
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Get items data
 */
function getItemsData() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const items = getSheetData(ss, 'ITEMS', 2);
    
    return {
      success: true,
      data: { items: items }
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Generic function to get sheet data as array of objects
 */
function getSheetData(ss, sheetName, startRow) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    console.error(`Sheet ${sheetName} not found`);
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data[0];
  const result = [];
  
  for (let i = startRow - 1; i < data.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j] || '';
    }
    if (obj[headers[0]]) { // Skip empty rows
      result.push(obj);
    }
  }
  
  return result;
}

// ===== SUPPLIER MANAGEMENT =====

/**
 * Add new supplier
 */
function addSupplier(supplier) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('SUPPLIERS');
    
    // Generate new ID
    const supplierData = getSheetData(ss, 'SUPPLIERS', 2);
    const maxNum = supplierData.length > 0 ? 
      Math.max(...supplierData.map(s => {
        const match = s.ID.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      })) : 0;
    
    const newId = 'SUP' + String(maxNum + 1).padStart(4, '0');
    
    // Add to sheet
    const newRow = [newId, supplier.name, supplier.mobile || '', supplier.due || 0];
    sheet.appendRow(newRow);
    
    console.log(`✅ Added supplier: ${newId}`);
    
    return {
      success: true,
      data: { id: newId, ...supplier }
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Update supplier
 */
function updateSupplier(supplier) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('SUPPLIERS');
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === supplier.ID) {
        sheet.getRange(i + 1, 1, 1, headers.length).setValues([[
          supplier.ID,
          supplier.name,
          supplier.mobile || '',
          supplier.due || 0
        ]]);
        
        console.log(`✅ Updated supplier: ${supplier.ID}`);
        return { success: true, data: supplier };
      }
    }
    
    return { success: false, error: 'Supplier not found' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Delete supplier
 */
function deleteSupplier(supplierId) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('SUPPLIERS');
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === supplierId) {
        sheet.deleteRow(i + 1);
        console.log(`✅ Deleted supplier: ${supplierId}`);
        return { success: true };
      }
    }
    
    return { success: false, error: 'Supplier not found' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ===== ITEM MANAGEMENT =====

/**
 * Add new item
 */
function addItem(item) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('ITEMS');
    
    // Generate new ID
    const itemData = getSheetData(ss, 'ITEMS', 2);
    const maxNum = itemData.length > 0 ? 
      Math.max(...itemData.map(i => {
        const match = i.ID.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      })) : 0;
    
    const newId = 'ITEM' + String(maxNum + 1).padStart(4, '0');
    
    // Add to sheet
    const newRow = [newId, item.name, item.unit || 'kg', item.hsn || '', 
                    item.purchase_rate || 0, item.sale_rate || 0, item.gst_percent || 5];
    sheet.appendRow(newRow);
    
    console.log(`✅ Added item: ${newId}`);
    
    return {
      success: true,
      data: { ID: newId, ...item }
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Update item
 */
function updateItem(item) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('ITEMS');
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === item.ID) {
        sheet.getRange(i + 1, 1, 1, 7).setValues([[
          item.ID,
          item.name,
          item.unit || 'kg',
          item.hsn || '',
          item.purchase_rate || 0,
          item.sale_rate || 0,
          item.gst_percent || 5
        ]]);
        
        console.log(`✅ Updated item: ${item.ID}`);
        return { success: true, data: item };
      }
    }
    
    return { success: false, error: 'Item not found' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Delete item
 */
function deleteItem(itemId) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('ITEMS');
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === itemId) {
        sheet.deleteRow(i + 1);
        console.log(`✅ Deleted item: ${itemId}`);
        return { success: true };
      }
    }
    
    return { success: false, error: 'Item not found' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ===== PURCHASE MANAGEMENT =====

/**
 * Add new purchase
 */
function addPurchase(purchase) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('PURCHASES');
    
    // Generate new ID
    const purchaseData = getSheetData(ss, 'PURCHASES', 2);
    const maxNum = purchaseData.length > 0 ? 
      Math.max(...purchaseData.map(p => {
        const match = p.PURCHASE_ID.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      })) : 0;
    
    const newId = 'PUR' + String(maxNum + 1).padStart(6, '0');
    
    // Add to sheet
    const newRow = [newId, purchase.supplier_id, purchase.supplier_name, 
                    purchase.date, purchase.invoice_no, purchase.total || 0,
                    purchase.taxable || 0, purchase.gst_total || 0];
    sheet.appendRow(newRow);
    
    console.log(`✅ Added purchase: ${newId}`);
    
    return {
      success: true,
      data: { PURCHASE_ID: newId, ...purchase }
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Update purchase
 */
function updatePurchase(purchase) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('PURCHASES');
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === purchase.PURCHASE_ID) {
        sheet.getRange(i + 1, 1, 1, 8).setValues([[
          purchase.PURCHASE_ID,
          purchase.supplier_id,
          purchase.supplier_name,
          purchase.date,
          purchase.invoice_no,
          purchase.total || 0,
          purchase.taxable || 0,
          purchase.gst_total || 0
        ]]);
        
        console.log(`✅ Updated purchase: ${purchase.PURCHASE_ID}`);
        return { success: true, data: purchase };
      }
    }
    
    return { success: false, error: 'Purchase not found' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Delete purchase
 */
function deletePurchase(purchaseId) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('PURCHASES');
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === purchaseId) {
        sheet.deleteRow(i + 1);
        
        // Also delete line items
        const lineSheet = ss.getSheetByName('PURCHASE_LINE_ITEMS');
        const lineData = lineSheet.getDataRange().getValues();
        
        for (let j = lineData.length - 1; j >= 1; j--) {
          if (lineData[j][1] === purchaseId) {
            lineSheet.deleteRow(j + 1);
          }
        }
        
        console.log(`✅ Deleted purchase and line items: ${purchaseId}`);
        return { success: true };
      }
    }
    
    return { success: false, error: 'Purchase not found' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ===== DATA SYNC =====

/**
 * Sync CL00022 data from Business OS back to Google Sheets
 */
function syncCL00022Data(data) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    // This function can sync data received from Business OS
    // Currently it just verifies connection
    
    return {
      success: true,
      message: 'Sync received',
      timestamp: new Date().toISOString()
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ===== REPORTS & ANALYSIS =====

/**
 * Generate purchase summary
 */
function generatePurchaseSummary(startDate, endDate) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const purchases = getSheetData(ss, 'PURCHASES', 2);
    const lineItems = getSheetData(ss, 'PURCHASE_LINE_ITEMS', 2);
    
    const filtered = purchases.filter(p => {
      const pDate = new Date(p.DATE);
      return pDate >= new Date(startDate) && pDate <= new Date(endDate);
    });
    
    const totalValue = filtered.reduce((sum, p) => sum + (Number(p.TOTAL) || 0), 0);
    const avgValue = filtered.length > 0 ? totalValue / filtered.length : 0;
    const suppliersCount = new Set(filtered.map(p => p.SUPPLIER_ID)).size;
    
    return {
      success: true,
      data: {
        total_value: totalValue,
        number_of_purchases: filtered.length,
        average_value: avgValue,
        suppliers_involved: suppliersCount,
        date_range: { start: startDate, end: endDate }
      }
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Verify data integrity
 */
function verifyData() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    const suppliers = getSheetData(ss, 'SUPPLIERS', 2);
    const items = getSheetData(ss, 'ITEMS', 2);
    const purchases = getSheetData(ss, 'PURCHASES', 2);
    const lineItems = getSheetData(ss, 'PURCHASE_LINE_ITEMS', 2);
    
    const totalValue = purchases.reduce((sum, p) => sum + (Number(p.TOTAL) || 0), 0);
    
    return {
      success: true,
      data: {
        suppliers_count: suppliers.length,
        items_count: items.length,
        purchases_count: purchases.length,
        line_items_count: lineItems.length,
        total_purchase_value: totalValue,
        timestamp: new Date().toISOString()
      }
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ===== DEBUG FUNCTIONS =====

/**
 * Show all available sheets
 */
function showSheets() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheets = ss.getSheetNames();
    
    console.log('📄 Available sheets:');
    sheets.forEach((name, i) => {
      console.log(`  ${i + 1}. ${name}`);
    });
    
    return sheets;
  } catch(e) {
    console.error('Error:', e);
    return [];
  }
}

/**
 * Test API
 */
function testAPI() {
  console.log('🧪 Testing CL00022 Backend...\n');
  
  const result = verifyData();
  console.log('Data Verification:');
  console.log(JSON.stringify(result, null, 2));
  
  return result;
}
