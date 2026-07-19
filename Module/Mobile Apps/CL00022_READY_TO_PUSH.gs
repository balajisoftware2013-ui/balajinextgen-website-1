/**
 * CL00022_RR FRESH AND MORE — READY TO PUSH
 * Sheet ID: 1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc
 * 
 * INSTRUCTIONS:
 * 1. Copy this entire code
 * 2. Paste into your Apps Script project
 * 3. Click Run → select CL00022_SimplePush
 * 4. Check Execution log for results
 */

const SHEET_ID = '1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc';

/**
 * PUSH SUPPLIERS (Ultra Simple)
 */
function CL00022_PushSuppliers() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('SUPPLIERS');
    
    if (!sheet) {
      console.log('❌ SUPPLIERS sheet not found. Creating...');
      ss.insertSheet('SUPPLIERS');
      const newSheet = ss.getSheetByName('SUPPLIERS');
      newSheet.getRange(1, 1, 1, 4).setValues([['ID', 'NAME', 'MOBILE', 'DUE']]);
      return CL00022_PushSuppliers(); // Retry
    }
    
    const data = [
      ['SUP0001', 'GL Roja & Brothers', '', 0],
      ['SUP0002', 'AKRAM MALLICK CHICKEN & FISH COUNTER', '', 0],
      ['SUP0003', 'DILIP SINGH', '', 0],
      ['SUP0004', 'NEIL ASSOCIATED', '', 0],
      ['SUP0005', 'ANUNDA CHUNDRY DEY', '', 0],
      ['SUP0006', 'LOCAL SUPPLIER', '', 0],
      ['SUP0007', 'NEW RAZA STORE', '', 0],
      ['SUP0008', 'CHANDAN FISH', '', 0],
      ['SUP0009', 'SARALA STORE', '', 0],
      ['SUP0010', 'M/S SANJAY PATODIYA', '', 0],
      ['SUP0011', 'M/S ANSHU MARINE', '', 0],
      ['SUP0012', 'BIMAL CH.OJHA', '', 0],
      ['SUP0013', 'SUPPLIER NOT LEGIBLE', '', 0],
      ['SUP0014', 'NOT IN MASTER LIST', '', 0],
      ['SUP0015', 'METRO FOOD PVT.LTD.', '', 0]
    ];
    
    sheet.getRange(2, 1, data.length, 4).setValues(data);
    console.log('✅ Pushed 15 SUPPLIERS');
  } catch(e) {
    console.error('❌ SUPPLIERS error:', e.message);
  }
}

/**
 * PUSH ITEMS (Ultra Simple)
 */
function CL00022_PushItems() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('ITEMS');
    
    if (!sheet) {
      console.log('❌ ITEMS sheet not found. Creating...');
      ss.insertSheet('ITEMS');
      const newSheet = ss.getSheetByName('ITEMS');
      newSheet.getRange(1, 1, 1, 7).setValues([['ID', 'NAME', 'UNIT', 'HSN', 'PURCHASE_RATE', 'SALE_RATE', 'GST_PERCENT']]);
      return CL00022_PushItems(); // Retry
    }
    
    const data = [
      ['ITEM0001', 'Bhetki Fresh Nett Size 1000-1200 Grm', 'kg', '', 1150, 1380, 5],
      ['ITEM0002', 'Fresh Basa 500-600g', 'kg', '', 350, 420, 5],
      ['ITEM0003', 'Squid 10*20 pkt', 'kg', '', 570, 684, 5],
      ['ITEM0004', 'PRAWAN 13*15', 'kg', '', 650, 780, 5],
      ['ITEM0005', 'White Basa IFB', 'kg', '', 350, 420, 5],
      ['ITEM0006', 'Bhetki Fresh Fillet Size 1000-1200 Grm', 'kg', '', 860, 1032, 5],
      ['ITEM0007', 'Ruhe Curry Cut', 'kg', '', 170, 204, 5],
      ['ITEM0008', 'Prawn 51*60', 'kg', '', 980, 1176, 5],
      ['ITEM0009', 'PRAWAN 1*12', 'kg', '', 830, 996, 5],
      ['ITEM0010', 'Prawn 16*20', 'kg', '', 830, 996, 5],
      ['ITEM0011', 'Pomfret 6*8', 'kg', '', 170, 204, 5],
      ['ITEM0012', 'Prawn 26*30', 'kg', '', 170, 204, 5],
      ['ITEM0013', 'NOT IN MASTER LIST', 'kg', '', 0, 0, 5],
      ['ITEM0014', 'Squid 20*40 pkt', 'kg', '', 1230, 1476, 5],
      ['ITEM0015', 'MUTTON CURRY CUT', 'kg', '', 790, 948, 5],
      ['ITEM0016', 'TIGER PRAWAN', 'kg', '', 1400, 1680, 5],
      ['ITEM0017', 'PRAWAN HEAD', 'kg', '', 100, 120, 5]
    ];
    
    sheet.getRange(2, 1, data.length, 7).setValues(data);
    console.log('✅ Pushed 17 ITEMS');
  } catch(e) {
    console.error('❌ ITEMS error:', e.message);
  }
}

/**
 * MAIN PUSH FUNCTION - RUN THIS
 */
function CL00022_SimplePush() {
  console.log('🔄 Starting CL00022 data push to Google Sheets...\n');
  console.log('Sheet ID: 1SNv6DuZelwMeDgsRPdFr7KMLvuQ-pgkd5F4NZeGDkVc\n');
  
  CL00022_PushSuppliers();
  console.log('');
  CL00022_PushItems();
  
  console.log('\n✅ Push complete!');
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Go to your Google Sheet');
  console.log('2. Check SUPPLIERS sheet - should have 15 rows');
  console.log('3. Check ITEMS sheet - should have 17 rows');
  console.log('4. Manually copy PURCHASES sheet from Excel & paste');
  console.log('5. Manually copy PURCHASE_LINE_ITEMS sheet from Excel & paste');
  console.log('\n6. Then run: CL00022_Verify()');
}

/**
 * VERIFY DATA
 */
function CL00022_Verify() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const supSheet = ss.getSheetByName('SUPPLIERS');
    const itemSheet = ss.getSheetByName('ITEMS');
    const purchaseSheet = ss.getSheetByName('PURCHASES');
    const lineSheet = ss.getSheetByName('PURCHASE_LINE_ITEMS');
    
    const supCount = supSheet ? supSheet.getLastRow() - 1 : 0;
    const itemCount = itemSheet ? itemSheet.getLastRow() - 1 : 0;
    const purchaseCount = purchaseSheet ? purchaseSheet.getLastRow() - 1 : 0;
    const lineCount = lineSheet ? lineSheet.getLastRow() - 1 : 0;
    
    console.log('📊 DATA VERIFICATION:\n');
    console.log(`✓ SUPPLIERS: ${supCount} rows`);
    console.log(`✓ ITEMS: ${itemCount} rows`);
    console.log(`✓ PURCHASES: ${purchaseCount} rows`);
    console.log(`✓ PURCHASE_LINE_ITEMS: ${lineCount} rows`);
    
    if (supCount === 15 && itemCount === 17) {
      console.log('\n✅ Masters loaded successfully!');
    } else if (supCount > 0 || itemCount > 0) {
      console.log('\n⚠️ Some data present but counts don\'t match expected');
    } else {
      console.log('\n❌ No data found. Run CL00022_SimplePush() first');
    }
    
    if (purchaseCount > 0 && lineCount > 0) {
      console.log(`✅ Purchase data also present (${purchaseCount} bills, ${lineCount} lines)`);
    }
    
  } catch(e) {
    console.error('❌ Verify error:', e.message);
  }
}

/**
 * DEBUG: Show all sheet names
 */
function CL00022_ShowSheets() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const names = ss.getSheetNames();
    console.log('📄 Available sheets in CL00022:');
    names.forEach((name, i) => {
      console.log(`  ${i+1}. ${name}`);
    });
  } catch(e) {
    console.error('❌ Error:', e.message);
  }
}

