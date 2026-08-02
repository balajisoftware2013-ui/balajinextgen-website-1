// ════════════════════════════════════════════════════════════════════════════════
// FIXED TALLY IMPORT HANDLER - Properly sends sheetId
// Add this to your HTML <script> section or call these functions from your code
// ════════════════════════════════════════════════════════════════════════════════

// UPDATE THIS WITH YOUR GAS DEPLOYMENT URL
const GAS_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/usercontent';

// ════════════════════════════════════════════════════════════════════════════════
// TALLY IMPORT FUNCTION - FIXED VERSION
// ════════════════════════════════════════════════════════════════════════════════

async function importTallyXml(sheetId, masterFile, txnFile){
  // Validate inputs
  if(!sheetId || sheetId.trim() === ''){
    alert('❌ Error: Sheet ID is required. Please enter your client database ID.');
    return false;
  }

  if(!masterFile || !txnFile){
    alert('❌ Error: Both Master.xml and Transactions.xml files are required.');
    return false;
  }

  // Check file names
  if(!masterFile.name.includes('Master')){
    alert('❌ Error: First file must be Master.xml');
    return false;
  }

  if(!txnFile.name.includes('Transactions') && !txnFile.name.includes('Txn')){
    alert('❌ Error: Second file must be Transactions.xml');
    return false;
  }

  try {
    console.log('Starting Tally import...');
    console.log('Sheet ID:', sheetId);
    console.log('Files:', masterFile.name, txnFile.name);

    // Show loading
    showTallyLoadingUI();

    // Read files as base64
    const masterBase64 = await readFileAsBase64(masterFile);
    const txnBase64 = await readFileAsBase64(txnFile);

    console.log('Files converted to base64');
    console.log('Master XML base64 length:', masterBase64.length);
    console.log('Txn XML base64 length:', txnBase64.length);

    // Call backend
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'IMPORT_TALLY_XML_BLOB',
        sheetId: sheetId.trim(),           // FIX: Include sheetId
        masterXmlBase64: masterBase64,     // FIX: Include base64 data
        txnXmlBase64: txnBase64            // FIX: Include base64 data
      })
    });

    console.log('Backend response received');

    const result = await response.json();

    console.log('Result:', result);

    // Hide loading
    hideTallyLoadingUI();

    if(result.success){
      showTallySuccessUI(result);
      return true;
    } else {
      showTallyErrorUI(result.message || result.error || 'Import failed');
      return false;
    }

  } catch(err) {
    console.error('Tally import error:', err);
    hideTallyLoadingUI();
    showTallyErrorUI('Network error: ' + err.message + '. Check GAS_URL is correct.');
    return false;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════════

function readFileAsBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file: ' + file.name));
    };
    reader.readAsDataURL(file);
  });
}

function showTallyLoadingUI(){
  // Show loading message in console or UI
  console.log('⏳ Importing Tally data...');
  // Replace with your UI loading state if needed
  // document.getElementById('tallyLoading').style.display = 'block';
}

function hideTallyLoadingUI(){
  console.log('✅ Import complete');
  // Replace with your UI state if needed
  // document.getElementById('tallyLoading').style.display = 'none';
}

function showTallySuccessUI(result){
  const summary = result.summary || {};
  const message = `
✅ Tally Import Successful!

Customers Imported: ${summary.customersCreated || 0}
Suppliers Imported: ${summary.suppliersCreated || 0}
Items Imported: ${summary.itemsCreated || 0}
────────────────────────
Total Records: ${summary.totalRecords || 0}
  `;
  alert(message);
  console.log('Import summary:', result);
}

function showTallyErrorUI(message){
  alert('❌ Import Failed:\n\n' + message);
  console.error('Import error:', message);
}

// ════════════════════════════════════════════════════════════════════════════════
// USAGE EXAMPLES
// ════════════════════════════════════════════════════════════════════════════════

/*

EXAMPLE 1: Direct function call in HTML form
───────────────────────────────────────────────

<form onsubmit="handleTallyImport(event)">
  <input type="text" id="sheetIdInput" placeholder="Sheet ID (e.g., 1FuNJ_Xej...)" required>
  <input type="file" id="masterFileInput" accept=".xml" required>
  <input type="file" id="txnFileInput" accept=".xml" required>
  <button type="submit">Import Tally</button>
</form>

<script>
async function handleTallyImport(event){
  event.preventDefault();
  
  const sheetId = document.getElementById('sheetIdInput').value;
  const masterFile = document.getElementById('masterFileInput').files[0];
  const txnFile = document.getElementById('txnFileInput').files[0];
  
  await importTallyXml(sheetId, masterFile, txnFile);
}
</script>


EXAMPLE 2: Using with existing client data
───────────────────────────────────────────

// After user registers/logs in, you have their sheetId
const clientId = 'CL00024';
const sheetId = 'SHEET_ID_FROM_DATABASE'; // Look up from CLIENT_REGISTRY

async function importClientTallyData(){
  const masterFile = document.getElementById('tally-master-file').files[0];
  const txnFile = document.getElementById('tally-txn-file').files[0];
  
  const success = await importTallyXml(sheetId, masterFile, txnFile);
  if(success){
    console.log('Client ' + clientId + ' data imported successfully');
  }
}


EXAMPLE 3: Using with file inputs
──────────────────────────────────

function importTallyFromFileInputs(){
  const sheetId = document.getElementById('clientDatabaseId').value;
  const masterFileInput = document.getElementById('tallyMasterFileInput');
  const txnFileInput = document.getElementById('tallyTxnFileInput');
  
  const masterFile = masterFileInput.files[0];
  const txnFile = txnFileInput.files[0];
  
  if(!masterFile || !txnFile){
    alert('Please select both XML files');
    return;
  }
  
  importTallyXml(sheetId, masterFile, txnFile);
}

*/

// ════════════════════════════════════════════════════════════════════════════════
// END OF FIXED TALLY IMPORT HANDLER
// ════════════════════════════════════════════════════════════════════════════════
