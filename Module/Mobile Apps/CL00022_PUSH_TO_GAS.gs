/**
 * CL00022 FRESH & MORE — PUSH NORMALIZED DATA TO MASTER_DB
 * 
 * This script pushes the normalized SUPPLIERS, ITEMS, PURCHASES, and PURCHASE_LINE_ITEMS
 * from the purchase register into the existing Google Sheets database.
 * 
 * BEFORE RUNNING:
 * 1. Ensure CL00022_NORMALIZED_MASTERS_COMPLETE.xlsx is ready
 * 2. Update MASTER_DB_ID and TRANSACTION_DB_ID below
 * 3. Test with a small batch first
 */

const CL00022_MASTER_DB_ID = '1FuNJ_XejE2ekYTnk71wXVZ79hRJgu7pmIA6fuE-Iu7I'; // Update with CL00022 MASTER_DB
const CL00022_TRANSACTION_DB_ID = 'YOUR_TRANSACTION_DB_ID'; // Update as needed

/**
 * PUSH ALL DATA - Main function
 * Orchestrates the push of all normalized data to Google Sheets
 */
function CL00022_PushAllNormalizedData() {
  console.log('🔄 Starting CL00022 data push...');
  
  try {
    // Step 1: Push Suppliers
    console.log('📦 Pushing SUPPLIERS...');
    const suppliersData = [
      ['SUP0001', 'GL Roja & Brothers', null, 0],
      ['SUP0002', 'AKRAM MALLICK CHICKEN & FISH COUNTER', null, 0],
      ['SUP0003', 'DILIP SINGH', null, 0],
      ['SUP0004', 'NEIL ASSOCIATED', null, 0],
      ['SUP0005', 'ANUNDA CHUNDRY DEY', null, 0],
      ['SUP0006', 'LOCAL SUPPLIER', null, 0],
      ['SUP0007', 'NEW RAZA STORE', null, 0],
      ['SUP0008', 'CHANDAN FISH', null, 0],
      ['SUP0009', 'SARALA STORE', null, 0],
      ['SUP0010', 'M/S SANJAY PATODIYA', null, 0],
      ['SUP0011', 'M/S ANSHU MARINE', null, 0],
      ['SUP0012', 'BIMAL CH.OJHA', null, 0],
      ['SUP0013', 'SUPPLIER NOT LEGIBLE - review', null, 0],
      ['SUP0014', 'NOT IN MASTER LIST - please confirm', null, 0],
      ['SUP0015', 'METRO FOOD PVT.LTD.', null, 0]
    ];
    
    const suppliersSheet = SpreadsheetApp.openById(CL00022_MASTER_DB_ID).getSheetByName('SUPPLIERS');
    suppliersSheet.getRange(2, 1, suppliersData.length, 4).setValues(suppliersData);
    console.log(`✓ Pushed ${suppliersData.length} suppliers`);
    
    // Step 2: Push Items
    console.log('🍗 Pushing ITEMS...');
    const itemsData = [
      ['ITEM0001', 'Bhetki Fresh Nett Size 1000-1200 Grm', 'kg', null, 1150, 1380, 5],
      ['ITEM0002', 'Fresh Basa 500-600g', 'kg', null, 350, 420, 5],
      ['ITEM0003', 'Squid 10*20 pkt', 'kg', null, 570, 684, 5],
      ['ITEM0004', 'PRAWAN 13*15', 'kg', null, 650, 780, 5],
      ['ITEM0005', 'White Basa IFB', 'kg', null, 350, 420, 5],
      ['ITEM0006', 'Bhetki Fresh Fillet Size 1000-1200 Grm', 'kg', null, 860, 1032, 5],
      ['ITEM0007', 'Ruhe Curry Cut', 'kg', null, 170, 204, 5],
      ['ITEM0008', 'Prawn 51*60', 'kg', null, 980, 1176, 5],
      ['ITEM0009', 'PRAWAN 1*12', 'kg', null, 830, 996, 5],
      ['ITEM0010', 'Prawn 16*20', 'kg', null, 830, 996, 5],
      ['ITEM0011', 'Pomfret 6*8', 'kg', null, 170, 204, 5],
      ['ITEM0012', 'Prawn 26*30', 'kg', null, 170, 204, 5],
      ['ITEM0013', 'NOT IN MASTER LIST - please confirm', 'kg', null, 0, 0, 5],
      ['ITEM0014', 'Squid 20*40 pkt', 'kg', null, 1230, 1476, 5],
      ['ITEM0015', 'MUTTON CURRY CUT', 'kg', null, 790, 948, 5],
      ['ITEM0016', 'TIGER PRAWAN', 'kg', null, 1400, 1680, 5],
      ['ITEM0017', 'PRAWAN HEAD', 'kg', null, 100, 120, 5]
    ];
    
    const itemsSheet = SpreadsheetApp.openById(CL00022_MASTER_DB_ID).getSheetByName('ITEMS');
    itemsSheet.getRange(2, 1, itemsData.length, 7).setValues(itemsData);
    console.log(`✓ Pushed ${itemsData.length} items`);
    
    // Step 3: Alert for PURCHASES & LINE ITEMS
    console.log('💳 PURCHASES & PURCHASE_LINE_ITEMS:');
    console.log('   Use CL00022_PushPurchases() and CL00022_PushLineItems()');
    console.log('   Or upload the Excel file and use importPurchasesFromSheet()');
    
    console.log('\n✅ Masters (SUPPLIERS & ITEMS) pushed successfully!');
    
  } catch(err) {
    console.error('❌ Error:', err.message);
  }
}

/**
 * IMPORT FROM SHEET
 * If you copy PURCHASES data to a temporary sheet first
 */
function CL00022_ImportPurchasesFromSheet() {
  const sourceSheet = SpreadsheetApp.getActiveSheet(); // Temp sheet with purchase data
  const targetDb = SpreadsheetApp.openById(CL00022_MASTER_DB_ID);
  const targetSheet = targetDb.getSheetByName('PURCHASES');
  
  const data = sourceSheet.getDataRange().getValues();
  targetSheet.getRange(2, 1, data.length - 1, data[0].length).setValues(data.slice(1));
  
  console.log('✓ Purchases imported');
}

/**
 * MANUAL ENTRY - For smaller updates
 * Run this after updating specific rows in the Excel
 */
function CL00022_UpdateSpecificSupplier(supplierId, supplierName, mobile) {
  const sheet = SpreadsheetApp.openById(CL00022_MASTER_DB_ID).getSheetByName('SUPPLIERS');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === supplierId) {
      sheet.getRange(i + 1, 1, 1, 3).setValues([[supplierId, supplierName, mobile]]);
      console.log(`✓ Updated ${supplierId}`);
      return;
    }
  }
  console.log(`⚠️ ${supplierId} not found`);
}

/**
 * VERIFY PUSH
 * Check that data was pushed correctly
 */
function CL00022_VerifyData() {
  const sheet = SpreadsheetApp.openById(CL00022_MASTER_DB_ID).getSheetByName('SUPPLIERS');
  const count = sheet.getLastRow() - 1;
  console.log(`SUPPLIERS: ${count} rows`);
  
  const itemSheet = SpreadsheetApp.openById(CL00022_MASTER_DB_ID).getSheetByName('ITEMS');
  const itemCount = itemSheet.getLastRow() - 1;
  console.log(`ITEMS: ${itemCount} rows`);
}

