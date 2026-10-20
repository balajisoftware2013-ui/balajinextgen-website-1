'use strict';
const GST={build:'GST-2026.10.20-v2',client:null,sales:[],books:[],portal2b:[],filings:[],irpPayloads:[],page:'dashboard',period:new Date().toISOString().slice(0,7),posting:false};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=n=>'₹'+Number(n).toLocaleString('en-IN',{maximumFractionDigits:2});
function finite(v){if(v===null||v===undefined||v===''||!Number.isFinite(Number(v)))throw Error('A numeric source amount is missing');return Number(v)}
function validGstin(v){return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v||'')}
function invoice(r){
 if(!r.invoiceNo||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)!==r.date)throw Error('Invoice number and valid ISO date required');
 if(r.gstin&&!validGstin(r.gstin))throw Error('Invalid counterparty GSTIN format');
 if(!/^\d{2}$/.test(r.pos||''))throw Error('Two-digit place of supply required');
 if(!Array.isArray(r.items)||!r.items.length)throw Error('Invoice items required');
 const items=r.items.map(i=>{const o={...i};for(const k of ['taxable','cgst','sgst','igst','cess']){o[k]=finite(i[k]);if(o[k]<0)throw Error('Credit notes require a separate workflow');}if(o.igst&&(o.cgst||o.sgst))throw Error('Mixed IGST and CGST/SGST');return o});
 const total=finite(r.total),roundOff=finite(r.roundOff??0),sum=items.reduce((a,i)=>a+i.taxable+i.cgst+i.sgst+i.igst+i.cess,0)+roundOff;
 if(Math.abs(sum-total)>.011)throw Error(r.invoiceNo+': invoice components do not match the total');
 return {...r,total,roundOff,items};
}
function totals(list){return list.reduce((a,r)=>{a.total+=r.total;r.items.forEach(i=>{for(const k of ['taxable','cgst','sgst','igst','cess'])a[k]+=i[k]});return a},{taxable:0,cgst:0,sgst:0,igst:0,cess:0,total:0})}
function reconcile(books,portal){const key=r=>(r.gstin||'')+'|'+r.invoiceNo.trim().toUpperCase()+'|'+r.date,pm=new Map(portal.map(r=>[key(r),r])),result=[];books.forEach(b=>{const p=pm.get(key(b));pm.delete(key(b));const x=totals([b]),y=p&&totals([p]);result.push({invoice:b.invoiceNo,gstin:b.gstin,status:!p?'Missing in 2B':Object.keys(x).every(k=>Math.abs(x[k]-y[k])<=1)?'Matched':'Amount mismatch',books:x.total,portal:y?.total??null})});pm.forEach(p=>result.push({invoice:p.invoiceNo,gstin:p.gstin,status:'Missing in books',books:null,portal:p.total}));return result}
function validateDataset(d){
 if(!d.client?.clientId||!validGstin(d.client.gstin))throw Error('Client ID and valid GSTIN format required');
 const o={client:d.client};for(const type of ['sales','books','portal2b']){const seen=new Set();o[type]=(d[type]||[]).map(r=>{if(r.clientId&&r.clientId!==d.client.clientId)throw Error('Cross-client row rejected');const n=invoice(r),key=(n.gstin||'')+'|'+n.invoiceNo+'|'+n.date;if(seen.has(key))throw Error('Duplicate '+type+' invoice '+n.invoiceNo);seen.add(key);return n});}
 o.filings=d.filings||[];for(const f of o.filings)if(f.gstin!==d.client.gstin||!/^\d{4}-(0[1-9]|1[0-2])$/.test(f.period))throw Error('Filing evidence GSTIN/period mismatch');
 o.irpPayloads=d.irpPayloads||[];return o;
}
function dataRows(type){return GST[type].filter(r=>(r.sourcePeriod||r.date?.slice(0,7))===GST.period)}
function table(head,rows){return '<div style="overflow:auto"><table><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v??'—')+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+head.length+'">No imported records for this period.</td></tr>')+'</tbody></table></div>'}
function summary(list){const t=totals(list);return table(['Invoices','Taxable','CGST','SGST','IGST','Cess','Invoice total'],[[list.length,...['taxable','cgst','sgst','igst','cess','total'].map(k=>cash(t[k]))]])}
function lines(list){return table(['Date','Invoice','Counterparty GSTIN','Name','Total'],list.map(r=>[r.date,r.invoiceNo,r.gstin,r.name,cash(r.total)]))}
function drawGST(){
 const page=document.getElementById('pg-'+GST.page);if(!page)return;
 const p=GST.period;let h='<div class="notif">'+GST.build+' · '+esc(GST.client?.name||'Import your client and source records')+' · Preparation mode. No live GST portal or IRP connection.</div><div class="gst-tools"><label>Period <input type="month" value="'+esc(p)+'" onchange="GST.period=this.value;drawGST()"></label><button onclick="document.getElementById(\'gstImport\').click()">Import JSON</button><button onclick="exportWorkpaper()">Export workpaper</button><button onclick="window.print()">Print</button><button onclick="gstChecks()">AI / data checks</button></div>';
 if(['dashboard','clients'].includes(GST.page)){
 const [y,m]=p.split('-').map(Number),fy=m>=4?y:y-1,records=[];
 for(let i=0;i<12;i++){const period=new Date(Date.UTC(fy,3+i,1)).toISOString().slice(0,7);for(const type of ['GSTR-1','GSTR-2A','GSTR-2B','GSTR-3B']){const f=GST.filings.find(x=>x.period===period&&x.returnType===type);records.push([period,type,f?.correctionsNeeded??'Unknown',f?.pendingUpload??'Unknown',f?.reconciliationExceptions??'Unknown',f?.arn?'Imported evidence: '+f.arn:'Unknown']);}}
 h+='<h2>GST Return Activities</h2><p>Filing status requires imported portal evidence. A downloaded workpaper is not a filed return.</p>'+table(['Period','Return','Corrections','Pending upload','Reconciliation exceptions','Filing evidence'],records);
 h+='<h3>TallyPrime 7.2 — sales voucher tools</h3><label>Exact company name <input id="tallyCompany" value="'+esc(GST.client?.tallyCompany||'')+'"></label> <select id="tallyMode"><option value="ACCOUNTING">Without items</option><option value="ITEM">With items</option></select> <button onclick="tallyDownload()">Download voucher XML</button><button onclick="tallyTest()">Test local connection</button><button onclick="tallyPost()">Post month sales</button><p id="tallyStatus">Not tested. Required masters must already exist in Tally.</p>';
 h+='<h3>Read purchases from Tally</h3><p>Comma-separated exact ledger names. Ledger mappings are required; unknown charges stop the import.</p><div class="gst-tools">'+['base','cgst','sgst','igst','cess','roundOff'].map(k=>'<label>'+esc(k)+' ledgers <input id="purchase_'+k+'" value="'+esc((GST.client?.purchaseLedgers?.[k]||[]).join(', '))+'"></label>').join('')+'<label>Fallback place-of-supply code (verify)<input id="purchasePos" maxlength="2" value="'+esc(GST.client?.stateCode||'')+'"></label><button onclick="syncTallyPurchases()">Sync purchases from Tally</button></div><p id="purchaseStatus">No purchase sync performed</p><div id="purchaseIssues"></div>';
 h+='<h3>E-invoice and return filing</h3><p>IRN generation, cancellation, portal upload, tax payment and final filing are not connected. Import IRP acknowledgement to retain it with your source records.</p><button onclick="exportIrpDraft()">Export IRP draft payloads</button> <a href="https://www.gst.gov.in/" target="_blank" rel="noopener">Open GST Portal</a>';
 }else if(GST.page==='recon')h+='<h2>2B versus books reconciliation</h2>'+table(['Invoice','GSTIN','Result','Books','Portal'],reconcile(dataRows('books'),dataRows('portal2b')).map(r=>[r.invoice,r.gstin,r.status,r.books,r.portal]));
 else if(['gstr1','uploadsales'].includes(GST.page))h+='<h2>Outward sales workpaper</h2><p>Only imported sales appear here; purchases never populate GSTR-1.</p>'+summary(dataRows('sales'))+lines(dataRows('sales'));
 else if(['gstr2b','upload2b'].includes(GST.page))h+='<h2>Imported 2B source records</h2>'+summary(dataRows('portal2b'))+lines(dataRows('portal2b'));
 else if(GST.page==='uploadbooks')h+='<h2>Purchase register</h2>'+summary(dataRows('books'))+lines(dataRows('books'));
 else if(GST.page==='gstr3b')h+='<h2>GSTR-3B preparation</h2><h3>Recorded outward tax heads</h3>'+summary(dataRows('sales'))+'<h3>Purchase tax heads — eligibility unverified</h3>'+summary(dataRows('books'))+'<p>RCM, ITC eligibility/reversals, adjustments, supply classifications and payment ledgers must be verified separately. No tax-head split is estimated.</p>';
 else h+='<h2>Source workpaper</h2>'+summary(dataRows('sales'))+'<p>Complete annual-return schemas, audited adjustments and statutory GST ledgers are not implemented. The export is a workpaper, not portal-ready return JSON.</p>';
 page.innerHTML=h;for(const id of ['activeClientBar','topSub']){const el=document.getElementById(id);if(el)el.textContent=GST.client?.name||'No client imported';}const gi=document.getElementById('activeGSTIN');if(gi)gi.textContent=GST.client?.gstin||'—';const fy=document.getElementById('activeFY');if(fy){const y=Number(p.slice(0,4))-(Number(p.slice(5))<4?1:0);fy.textContent=y+'-'+String(y+1).slice(-2);}const sync=document.getElementById('lastSync');if(sync)sync.textContent=GST.importedAt||'No source imported';
}
function showPage(id){if(!document.getElementById('pg-'+id))return;GST.page=id;document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='pg-'+id));drawGST();if(innerWidth<900){document.getElementById('sidebar')?.classList.remove('mob-open');document.getElementById('sidebarOverlay')?.classList.remove('show');}}
function toggleSidebar(){document.getElementById('sidebar')?.classList.toggle('collapsed')}
function changeFY(){drawGST()}
function openAddClient(){alert('Use Import JSON with your client profile; no GST portal passwords are stored.')}
function closeModal(id){document.getElementById(id)?.classList.remove('open')}
function download(value,name,type='application/json'){const u=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function requireClient(){if(!GST.client)throw Error('Import client and source data first')}
function exportWorkpaper(){try{requireClient();download({kind:'WORKPAPER_NOT_PORTAL_RETURN_JSON',client:GST.client,period:GST.period,sales:dataRows('sales'),books:dataRows('books'),portal2b:dataRows('portal2b'),filings:GST.filings},'GST_WORKPAPER_'+GST.client.gstin+'_'+GST.period+'.json')}catch(e){alert(e.message)}}
function gstChecks(){const r=reconcile(dataRows('books'),dataRows('portal2b'));alert('Local source checks — '+GST.period+'\nSales invoices: '+dataRows('sales').length+'\nReconciliation exceptions: '+r.filter(x=>x.status!=='Matched').length+'\nNo tax or filing status is invented. GSTIN checksum, ITC eligibility, applicability and portal acceptance remain unverified. This is a rule-based assistant; no external AI receives your data.')}
function exportIrpDraft(){try{requireClient();if(!GST.irpPayloads.length)throw Error('Import IRP draft payloads first');for(const p of GST.irpPayloads)if(p.SellerDtls?.Gstin!==GST.client.gstin||!p.DocDtls?.No||!p.ItemList?.length)throw Error('IRP seller/document/item identity missing');download(GST.irpPayloads,'IRP_DRAFT_'+GST.client.gstin+'.json');alert('Draft only: full current IRP schema and applicability must be validated. No IRN generated.')}catch(e){alert(e.message)}}
function tallyXML(client,records,mode){
 if(!client.tallyCompany)throw Error('Exact Tally company required');const X=v=>esc(v).replace(/&#39;/g,'&apos;');
 const messages=records.map(raw=>{const r=invoice(raw),t=totals([r]),inv=mode==='ITEM',tag=inv?'LEDGERENTRIES.LIST':'ALLLEDGERENTRIES.LIST';if(!r.partyLedger||!r.salesLedger)throw Error('Party and sales ledger names required');const entry=(l,a)=>'<'+tag+'><LEDGERNAME>'+X(l)+'</LEDGERNAME><ISDEEMEDPOSITIVE>'+(a<0?'Yes':'No')+'</ISDEEMEDPOSITIVE><AMOUNT>'+a.toFixed(2)+'</AMOUNT></'+tag+'>';let body=entry(r.partyLedger,-r.total);
 if(inv){r.items.forEach(i=>{if(!i.name||!(Number(i.qty)>0)||!i.unit)throw Error('Stock item name, positive quantity and unit required');body+='<ALLINVENTORYENTRIES.LIST><STOCKITEMNAME>'+X(i.name)+'</STOCKITEMNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><RATE>'+(i.taxable/i.qty).toFixed(6)+'/'+X(i.unit)+'</RATE><AMOUNT>'+i.taxable.toFixed(2)+'</AMOUNT><ACTUALQTY>'+i.qty+' '+X(i.unit)+'</ACTUALQTY><BILLEDQTY>'+i.qty+' '+X(i.unit)+'</BILLEDQTY><ACCOUNTINGALLOCATIONS.LIST><LEDGERNAME>'+X(r.salesLedger)+'</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>'+i.taxable.toFixed(2)+'</AMOUNT></ACCOUNTINGALLOCATIONS.LIST></ALLINVENTORYENTRIES.LIST>'})}else body+=entry(r.salesLedger,t.taxable);
 for(const k of ['cgst','sgst','igst','cess'])if(t[k]){if(!client.ledgers?.[k])throw Error('Missing '+k+' ledger');body+=entry(client.ledgers[k],t[k])}if(r.roundOff){if(!client.ledgers?.roundOff)throw Error('Round off ledger missing');body+=entry(client.ledgers.roundOff,r.roundOff)}const view=inv?'Invoice Voucher View':'Accounting Voucher View';return '<TALLYMESSAGE><VOUCHER ACTION="Create" VCHTYPE="Sales" REMOTEID="'+X('BNX-GST-'+client.clientId+'-'+client.gstin+'-'+r.date+'-'+r.invoiceNo)+'" OBJVIEW="'+view+'"><DATE>'+r.date.replaceAll('-','')+'</DATE><VOUCHERTYPENAME>Sales</VOUCHERTYPENAME><VOUCHERNUMBER>'+X(r.invoiceNo)+'</VOUCHERNUMBER><PARTYLEDGERNAME>'+X(r.partyLedger)+'</PARTYLEDGERNAME><PERSISTEDVIEW>'+view+'</PERSISTEDVIEW><ISINVOICE>'+(inv?'Yes':'No')+'</ISINVOICE>'+body+'</VOUCHER></TALLYMESSAGE>'});return '<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>'+X(client.tallyCompany)+'</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>'+messages.join('')+'</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>';
}
function postingSelection(){requireClient();const client={...GST.client,tallyCompany:document.getElementById('tallyCompany').value.trim()},mode=document.getElementById('tallyMode').value,records=dataRows('sales');if(!records.length)throw Error('No imported sales in selected period');records.forEach(r=>tallyXML(client,[r],mode));return {client,mode,records}}
function tallyDownload(){try{const s=postingSelection();download(tallyXML(s.client,s.records,s.mode),'TALLY_SALES_'+GST.period+'.xml','application/xml')}catch(e){alert(e.message)}}
async function tallyRelay(xml){const r=await fetch('http://127.0.0.1:9001',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:xml}),text=await r.text();if(!r.ok)throw Error(text);const d=new DOMParser().parseFromString(text,'application/xml');if(d.querySelector('parsererror'))throw Error('Invalid XML reply');return d}
async function tallyTest(){try{await tallyRelay('<ENVELOPE><HEADER><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><TDL><TDLMESSAGE><COLLECTION NAME="List of Companies"><TYPE>Company</TYPE><FETCH>NAME</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>');document.getElementById('tallyStatus').textContent='Readable XML received. Confirm correct company before posting.'}catch(e){alert('Connection not confirmed: '+e.message)}}
async function tallyPost(){if(GST.posting)return;try{const s=postingSelection();GST.posting=true;let done=0;for(const row of s.records){const d=await tallyRelay(tallyXML(s.client,[row],s.mode));if(d.querySelector('LINEERROR')||Number(d.querySelector('ERRORS')?.textContent||0)||Number(d.querySelector('CREATED')?.textContent)!==1)throw Error('Creation not confirmed for '+row.invoiceNo+'; check Tally Day Book before retrying');done++}alert(done+' vouchers confirmed. Review GST classification in Tally.')}catch(e){alert('Posting stopped: '+e.message)}finally{GST.posting=false}}
window.GSTCore={invoice,totals,reconcile,validateDataset,tallyXML};
const input=document.createElement('input');input.type='file';input.accept='.json';input.id='gstImport';input.hidden=true;input.onchange=async()=>{try{if(!input.files[0])return;const d=validateDataset(JSON.parse(await input.files[0].text()));Object.assign(GST,d,{importedAt:new Date().toLocaleString('en-IN')});drawGST()}catch(e){alert('Import rejected: '+e.message)}finally{input.value=''}};document.body.appendChild(input);drawGST();

let purchaseSyncBusy=false;
async function syncTallyPurchases(){
 if(purchaseSyncBusy)return;
 const status=document.getElementById('purchaseStatus'),issues=document.getElementById('purchaseIssues');
 try{
  requireClient();const scope=GST.client.clientId+'|'+GST.client.gstin,period=GST.period,company=document.getElementById('tallyCompany').value.trim();
  if(!company)throw Error('Enter the exact Tally company');
  const mapping={};for(const k of ['base','cgst','sgst','igst','cess','roundOff'])mapping[k]=document.getElementById('purchase_'+k).value.split(',').map(x=>x.trim()).filter(Boolean);
  const fallbackPos=document.getElementById('purchasePos').value.trim();
  if(!/^\d{2}$/.test(fallbackPos))throw Error('Enter and verify the two-digit place-of-supply fallback');
  purchaseSyncBusy=true;status.textContent='Reading purchases — Tally data will not be changed';
  const response=await fetch('http://127.0.0.1:9001/purchases',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({company,period,mapping})});
  const text=await response.text();if(!response.ok)throw Error(text);
  const data=JSON.parse(text);
  if(scope!==GST.client.clientId+'|'+GST.client.gstin||period!==GST.period)throw Error('Client or period changed: purchase response discarded');
  if(data.company!==company||data.period!==period||!Array.isArray(data.rows)||!Array.isArray(data.issues))throw Error('Unexpected purchase response');
  issues.innerHTML=table(['Supplier invoice','Review required'],data.issues.map(x=>[x.invoice,x.error]));
  if(!data.complete||data.issues.length)throw Error('Purchase read has exceptions. Existing books retained; review the list below.');
  const imported=data.rows.map(r=>invoice({...r,clientId:GST.client.clientId,sourcePeriod:period,pos:/^\d{2}$/.test(r.pos||'')?r.pos:fallbackPos}));
  const keys=new Set();for(const r of imported){const k=r.gstin+'|'+r.invoiceNo+'|'+r.date;if(keys.has(k))throw Error('Duplicate supplier invoice');keys.add(k);}
  GST.books=GST.books.filter(r=>(r.sourcePeriod||r.date.slice(0,7))!==period).concat(imported);
  GST.client.purchaseLedgers=mapping;GST.client.tallyCompany=company;GST.client.stateCode=fallbackPos;
  status.textContent=imported.length+' purchase invoices read from '+company+' for '+period+'. Books for this period replaced. Open 2B vs Books Reconciliation.';
 }catch(e){status.textContent='Sync not completed: '+e.message;}finally{purchaseSyncBusy=false;}
}
