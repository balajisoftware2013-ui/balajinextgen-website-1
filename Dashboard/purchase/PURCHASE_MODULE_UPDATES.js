/* ══════════════════════════════════════════════════════════════════════════
   UPDATES FOR purchase-module.html
   
   Replace existing functions and add new ones as shown below.
   ══════════════════════════════════════════════════════════════════════════ */

// ════ UPDATE 1: Delete Function (with inventory rollback + Drive cleanup) ════
// FIND: function deletePurchase(id,mode){
// REPLACE WITH:

function deletePurchase(id,mode){
  const arr=mode==='accounting'?DB.acctInvs:DB.purchases;
  const idx=arr.findIndex(x=>x.id===id);
  if(idx<0){toast('Record not found','err','⚠️');return;}
  const p=arr[idx];
  if(!confirm(`Delete invoice ${p.no} (${p.vendorName}, ${fmt(p.grand)})?\\n\\nThis will:\\n• Remove from all reports\\n• Roll back inventory\\n• Delete Drive files\\n\\nThis cannot be undone.`))return;
  
  // Roll back vendor outstanding balance
  const vi=DB.vendors.findIndex(v=>v.id===p.vendorId);
  if(vi>=0)DB.vendors[vi].outstanding=Math.max(0,(DB.vendors[vi].outstanding||0)-(p.grand||0));
  arr.splice(idx,1);
  if(editingPurchaseId===id){editingPurchaseId=null;editingPurchaseMode=null;}
  save();rendDash();rendRegs();rendPurchaseList();updateApprCount();
  toast(`${p.no} deleted locally. Syncing with server...`,'ok','🗑️');
  
  // Backend delete with inventory rollback + Drive cleanup
  erpApi('DELETE_PURCHASE_INVOICE', {
    id:p.id, 
    no:p.no, 
    mode,
    clientId:currentClient
  }).then(r=>{
    if(r&&r.success===false){
      toast('⚠️ '+p.no+' deleted locally, but server sync failed: '+(r.message||'unknown error'),'warn','☁️');
    }else if(r&&r.success){
      toast(`${p.no} fully deleted. Inventory rolled back.`,'ok','✅');
    }
  }).catch(e=>{
    toast('⚠️ Sync error: '+e.message,'err','⚠️');
  });
}

// ════ UPDATE 2: Save Function (Edit mode - version old files) ════
// FIND: function savePurchase(sendApproval,forceSave){
// Around line ~3000, in the section:
//   if(editingPurchaseId){
//     const arr=editingPurchaseMode==='accounting'?DB.acctInvs:DB.purchases;
//
// ADD THIS CODE after the local DB update and BEFORE the erpApi call:

if(editingPurchaseId){
  // ── EDIT MODE: version old files instead of duplicating ──
  erpApi('VERSION_OLD_FILES', {
    clientId:currentClient, 
    invoiceNo:doc.no
  }).then(r=>{
    if(r&&r.success){
      console.log('Old bill files archived, ready for new upload');
    }else{
      console.warn('Could not archive old files (non-critical):', r&&r.message);
    }
  }).catch(e=>{
    console.warn('File versioning error (non-critical):', e.message);
  });
}

// Then continue with existing code...
// erpApi('UPDATE_PURCHASE_INVOICE', doc).then(r=>{ ...

// ════ UPDATE 3: Add Inventory Sync Listener (on App Load) ════
// ADD THIS NEW FUNCTION anywhere in the file:

function setupInventorySyncListener(){
  // Listen for inventory changes from other tabs/devices
  if(typeof window.BroadcastChannel!=='undefined'){
    try{
      window.inventorySyncChannel=new BroadcastChannel('balaji_inventory_sync');
      window.inventorySyncChannel.onmessage=(event)=>{
        const msg=event.data;
        if(!msg||!msg.action)return;
        
        console.log('Inventory sync message received:', msg.action);
        
        if(msg.action==='PURCHASE_CREATED' || msg.action==='PURCHASE_UPDATED'){
          // Reload purchase list and dashboard
          loadFromCloud();
          rendDash();
          rendPurchaseList();
          toast('Inventory updated from another device','info','☁️');
        }else if(msg.action==='PURCHASE_DELETED'){
          loadFromCloud();
          rendDash();
          rendRegs();
          rendPurchaseList();
          toast('Purchase deleted on another device','warn','⚠️');
        }
      };
      console.log('Inventory sync listener ready');
    }catch(e){
      console.warn('BroadcastChannel not available:', e.message);
    }
  }
}

// ════ UPDATE 4: Call listener on app initialization ════
// FIND: where the app initializes (usually in a startup function)
// Example: function initApp() { ... }
// ADD THIS CALL:

setupInventorySyncListener();

// ════ UPDATE 5: Broadcast inventory changes to other tabs ════
// ADD THIS HELPER FUNCTION:

function broadcastInventoryChange(action, invoiceData){
  if(typeof window.inventorySyncChannel!=='undefined'){
    try{
      window.inventorySyncChannel.postMessage({
        action:action, // 'PURCHASE_CREATED', 'PURCHASE_UPDATED', 'PURCHASE_DELETED'
        invoiceNo:invoiceData.no,
        invoiceId:invoiceData.id,
        timestamp:new Date().toISOString()
      });
      console.log('Broadcasted:', action, invoiceData.no);
    }catch(e){
      console.warn('Broadcast failed:', e.message);
    }
  }
}

// ════ UPDATE 6: Call broadcaster after saving/deleting ════
// In savePurchase(), after the erpApi(...UPDATE_PURCHASE_INVOICE...) completes successfully:

if(r&&r.success){
  broadcastInventoryChange('PURCHASE_UPDATED', doc);
}

// In deletePurchase(), after the erpApi(...DELETE_PURCHASE_INVOICE...) completes successfully:

if(r&&r.success){
  broadcastInventoryChange('PURCHASE_DELETED', {no:p.no, id:p.id});
}

// ════ UPDATE 7: Sync inventory to backend on save ════
// In savePurchase(), after the erpApi(...UPDATE_PURCHASE_INVOICE...) success handler:

// Call inventory sync for inventory-mode purchases
if(doc.mode==='inventory' && typeof erpApi==='function'){
  erpApi('SYNC_PURCHASE_TO_INVENTORY', {
    clientId:currentClient,
    invoiceDoc:doc,
    operation:'ADD' // or 'SUBTRACT' for rollback
  }).then(r=>{
    if(r&&r.success){
      console.log('Inventory synced:', r.synced, 'items updated');
      erpApi('RECALC_INVENTORY_TOTALS', {clientId:currentClient}); // refresh totals
    }
  }).catch(e=>{
    console.warn('Inventory sync failed:', e.message);
  });
}
