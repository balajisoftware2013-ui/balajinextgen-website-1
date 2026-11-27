/* 2026-11-27 QR ORDERS → steward confirms → KOT. Guests' QR orders wait here (🔔 bell). The steward sees the orders of his own
   tables (and tables nobody has yet; "All tables" shows every one) → ✅ Accept loads the dishes into that table's order →
   check and tap Send KOT as usual (normal KOT print). When that KOT is saved the guest's page shows "Confirmed". ✕ Reject tells the guest. */
(function(W,D){
  if(W.__bnxQrOrders) return; W.__bnxQrOrders=1;
  var V='', LIST=[], ALL=false, busy=false;
  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function nk(t){ return String(t||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/^(TABLE|TBL|T)(?=\d)/,''); }
  function tbl(id){ try{ var k=nk(id); return (typeof TABLES!=='undefined'?TABLES:[]).find(function(t){ return nk(t.id||t.TABLE_ID||t.TABLE_NO)===k; })||null; }catch(e){ return null; } }
  function mine(o){ if(ALL) return true; var t=tbl(o.table); if(!t) return true; try{ if(typeof liveTableOwner==='function'&&liveTableOwner(t)) return true; }catch(e){}
    var busyT=/OCCUPIED|RUNNING|BILLED/i.test(String(t.status||'')), owner=t.steward||t.captain||t.waiter||t.STEWARD||''; return !busyT||!owner; }
  function api(a,p){ return gasApi(a,Object.assign({requestId:'qr-'+a+'-'+Date.now()},p||{}),'V2_CORE'); }
  function ui(){
    var b=D.getElementById('bnxQrBell'); if(!b){ b=D.createElement('button'); b.id='bnxQrBell'; b.type='button';
      b.style.cssText='position:fixed;right:14px;bottom:86px;z-index:9998;border:0;border-radius:999px;padding:12px 16px;font-weight:900;font-size:14px;color:#fff;background:#dc2626;box-shadow:0 8px 24px rgba(0,0,0,.25);display:none';
      b.onclick=function(){ TAB=LIST.filter(mine).length?'qr':TAB; panel(); }; D.body.appendChild(b); }
    var n=LIST.filter(mine).length; b.style.display='block'; b.style.background=n?'#dc2626':'#334155'; b.style.padding=n?'12px 16px':'10px 13px'; b.textContent=n?'🔔 '+n+' QR order'+(n>1?'s':''):'🛎 Guest desk';
    var p=D.getElementById('bnxQrPanel'); if(p&&TAB==='qr') draw(p);
  }
  function poll(){
    if(busy||D.visibilityState!=='visible') return; busy=true;
    api('QR_ORDER_LIST',{since:V}).then(function(r){ if(r&&r.success&&r.data){ if(!r.data.unchanged){ var before=LIST.filter(mine).length; LIST=r.data.orders||[]; V=r.data.v||''; ui();
        if(LIST.filter(mine).length>before){ try{ navigator.vibrate&&navigator.vibrate([200,100,200]); }catch(e){} try{ var ac=new (W.AudioContext||W.webkitAudioContext)(), o=ac.createOscillator(); o.connect(ac.destination); o.frequency.value=880; o.start(); o.stop(ac.currentTime+.3); }catch(e){} } } } })
      .catch(function(){}).then(function(){ busy=false; });
  }
  /* ── Guest desk: one place on the steward phone — QR orders · online bookings · event door entry · UPI payments ── */
  var TAB='qr';
  function panel(){
    var p=D.getElementById('bnxQrPanel'); if(p){ p.remove(); return; }
    p=D.createElement('div'); p.id='bnxQrPanel';
    p.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center';
    p.onclick=function(e){ if(e.target===p) p.remove(); };
    D.body.appendChild(p); draw(p); V=''; poll();
  }
  W.bnxGuestDesk=function(t){ if(t) TAB=t; var p=D.getElementById('bnxQrPanel'); if(p) draw(p); else panel(); };
  function shell(p,inner){
    var tb=[['qr','🔔 QR orders'],['bk','📅 Bookings'],['door','🎟 Door entry'],['pay','💳 UPI paid']];
    p.innerHTML='<div style="background:var(--surface,#fff);color:var(--text,#111);width:100%;max-width:560px;height:85vh;display:flex;flex-direction:column;border-radius:18px 18px 0 0">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px 6px"><b style="font-size:16px">Guest desk</b><button type="button" id="qrX" style="border:0;background:none;font-size:22px">✕</button></div>'
      +'<div style="display:flex;gap:6px;padding:0 10px 8px;overflow:auto">'+tb.map(function(t){ return '<button type="button" data-tab="'+t[0]+'" style="white-space:nowrap;border:1px solid var(--border,#e5e7eb);border-radius:999px;padding:8px 12px;font-weight:800;font-size:13px;'+(TAB===t[0]?'background:#111;color:#fff':'background:transparent;color:inherit')+'">'+t[1]+'</button>'; }).join('')+'</div>'
      +'<div id="gdBody" style="flex:1;overflow:auto;padding:0 14px 22px">'+inner+'</div></div>';
    p.querySelector('#qrX').onclick=function(){ p.remove(); };
    p.querySelectorAll('[data-tab]').forEach(function(b){ b.onclick=function(){ TAB=b.getAttribute('data-tab'); draw(p); }; });
    return p.querySelector('#gdBody');
  }
  function draw(p){
    if(TAB==='bk') return drawBk(p); if(TAB==='door') return drawDoor(p); if(TAB==='pay') return drawPay(p);
    var L=LIST.filter(mine);
    var body=shell(p,'<div style="display:flex;justify-content:flex-end;margin-bottom:4px"><label style="font-size:12px"><input type="checkbox" id="qrAll" '+(ALL?'checked':'')+'> All tables</label></div>'
      +(L.length?L.map(function(o){ var t=Date.parse(o.at), m=isNaN(t)?'':Math.max(0,Math.round((Date.now()-t)/60000))+' min ago';
        return '<div style="border:1px solid var(--border,#e5e7eb);border-radius:14px;padding:12px;margin:8px 0"><div style="display:flex;justify-content:space-between"><b style="font-size:16px">'+(o.table?'Table '+esc(o.table):'Takeaway')+'</b><span style="font-size:12px;color:#888">'+esc(m)+'</span></div>'
          +'<div style="font-size:12px;color:#666;margin:2px 0 6px">'+esc(o.name||'Guest')+(o.mobile?' · '+esc(o.mobile):'')+' · ₹'+Number(o.total||0).toLocaleString('en-IN')+'</div>'
          +(o.items||[]).map(function(i){ return '<div style="font-size:14px">'+esc(i.qty)+' × '+esc(i.name)+'</div>'; }).join('')
          +(o.notes?'<div style="margin-top:6px;font-size:13px;font-weight:700;color:#b45309">📝 '+esc(o.notes)+'</div>':'')
          +(o.status==='ACCEPTED'?'<div style="font-size:12px;color:#1d4ed8;margin-top:6px">Accepted by '+esc(o.steward||'')+' — waiting for KOT</div>':'')
          +'<div style="display:flex;gap:8px;margin-top:10px"><button type="button" data-acc="'+esc(o.reqId)+'" style="flex:2;border:0;border-radius:10px;padding:11px;background:#16a34a;color:#fff;font-weight:900">✅ Accept → load to order</button><button type="button" data-rej="'+esc(o.reqId)+'" style="flex:1;border:1px solid #fca5a5;border-radius:10px;padding:11px;background:#fff;color:#dc2626;font-weight:800">✕ Reject</button></div></div>'; }).join('')
        :'<div style="padding:18px;text-align:center;color:#888">No QR orders waiting'+(ALL?'':' for your tables')+'.</div>'));
    p.querySelector('#qrAll').onchange=function(){ ALL=this.checked; ui(); };
    p.querySelectorAll('[data-acc]').forEach(function(b){ b.onclick=function(){ accept(b.getAttribute('data-acc'),b); }; });
    p.querySelectorAll('[data-rej]').forEach(function(b){ b.onclick=function(){ var why=prompt('Reason for the guest (optional):','Item not available')||''; b.disabled=true;
      api('QR_ORDER_SET',{reqId:b.getAttribute('data-rej'),status:'REJECTED',reason:why}).then(function(r){ if(r&&r.success){ LIST=LIST.filter(function(o){ return o.reqId!==b.getAttribute('data-rej'); }); ui(); toast('Rejected — guest informed','info'); } else { b.disabled=false; toast((r&&r.error)||'Could not reject','error'); } }); }; });
  }

  function today(){ var d=new Date(Date.now()-6*3600e3); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function err(r){ var e=String(r&&(r.error||r.message)||'Server busy — try again'); return '<div style="padding:14px;color:#dc2626;font-weight:700">⚠ '+esc(e)+(/role|allow|permission/i.test(e)?' — owner: Settings › Role Access':'')+'</div>'; }
  /* 📅 online table bookings for today (and tomorrow early) */
  function drawBk(p){
    var body=shell(p,'<div style="padding:14px;color:#888">Loading today\'s bookings…</div>');
    api('GG_RESV_LIST',{fromDate:today(),toDate:today(),status:''}).then(function(r){ if(!D.contains(body)) return;
      if(!r||!r.success){ body.innerHTML=err(r); return; }
      var L=(r.data||[]).filter(function(x){ return !/CANCEL|REJECT/i.test(String(x.STATUS)); });
      body.innerHTML=L.length?L.map(function(x,i){ var st=String(x.STATUS||'').toUpperCase();
        return '<div style="border:1px solid var(--border,#e5e7eb);border-radius:14px;padding:12px;margin:8px 0"><div style="display:flex;justify-content:space-between"><b>'+esc(x.TIME||'')+' · '+esc(x.NAME||x.CUSTOMER_NAME||'Guest')+'</b><span style="font-size:12px;font-weight:800">'+esc(st)+'</span></div>'
          +'<div style="font-size:13px;color:#555">'+esc(x.PAX||x.GUESTS||'')+' guests'+(x.TABLE_ID||x.TABLE?' · Table '+esc(x.TABLE_ID||x.TABLE):'')+(x.OCCASION?' · '+esc(x.OCCASION):'')+(x.NOTES?' · '+esc(x.NOTES):'')+'</div>'
          +(st==='SEATED'||st==='DONE'?'':'<div style="display:flex;gap:8px;margin-top:8px">'+(st==='PENDING'||st==='REQUESTED'||st==='NEW'?'<button type="button" data-bk="'+i+'" data-st="CONFIRMED" style="flex:1;border:0;border-radius:10px;padding:10px;background:#2563eb;color:#fff;font-weight:800">✓ Confirm</button>':'')
          +'<button type="button" data-bk="'+i+'" data-st="SEATED" style="flex:1;border:0;border-radius:10px;padding:10px;background:#16a34a;color:#fff;font-weight:800">🪑 Arrived / seated</button></div>')+'</div>'; }).join('')
        :'<div style="padding:18px;text-align:center;color:#888">No online bookings for today.</div>';
      body.querySelectorAll('[data-bk]').forEach(function(b){ b.onclick=function(){ var x=L[+b.getAttribute('data-bk')]; b.disabled=true;
        api('GG_RESV_SET',{id:x.REQ_ID,status:b.getAttribute('data-st'),notify:b.getAttribute('data-st')==='CONFIRMED'}).then(function(r){ toast(r&&r.success?'Saved':(r&&r.error)||'Not saved',r&&r.success?'success':'error'); drawBk(p); }); }; });
    });
  }
  /* 🎟 event door entry — type or scan the ticket code (camera on phones that support it); unpaid → collect cash + let in */
  function drawDoor(p){
    var body=shell(p,'<div style="margin-top:6px;display:flex;gap:8px"><input id="gdCode" placeholder="TICKET CODE" autocapitalize="characters" autocomplete="off" style="flex:1;font-size:22px;font-weight:900;letter-spacing:.15em;padding:12px;border:2px solid var(--border,#e5e7eb);border-radius:12px;text-transform:uppercase"><button type="button" id="gdGo" style="border:0;border-radius:12px;padding:0 18px;background:#16a34a;color:#fff;font-weight:900">Let in</button></div>'
      +('BarcodeDetector' in W?'<button type="button" id="gdCam" style="width:100%;margin-top:10px;border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:12px;font-weight:800;background:transparent;color:inherit">📷 Scan ticket QR</button><video id="gdVid" playsinline style="display:none;width:100%;border-radius:12px;margin-top:8px"></video>':'')
      +'<div id="gdMsg" style="margin-top:12px;font-size:15px"></div><div style="font-size:12px;color:#888;margin-top:10px">Paid tickets: let in at once. Unpaid: collect the money (cash / UPI) → it is marked paid + checked in. Each code works once.</div>');
    var inp=body.querySelector('#gdCode'), msg=body.querySelector('#gdMsg'), go=body.querySelector('#gdGo'), stream=null, scanning=false;
    function stop(){ scanning=false; try{ stream&&stream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){} var v=body.querySelector('#gdVid'); if(v) v.style.display='none'; }
    function check(code,collect){ code=String(code||'').toUpperCase(); code=(code.match(/BNXTK:[^:]*:([A-Z0-9]+)/)||[])[1]||code.replace(/[^A-Z0-9]/g,''); if(code.length<4){ msg.innerHTML='<b style="color:#dc2626">Enter the ticket code</b>'; return; }
      go.disabled=true; msg.textContent='Checking '+code+'…';
      api('GG_TICKET_SET',Object.assign({code:code,status:'CHECKED_IN'},collect?{collect:true,payMode:collect}:{})).then(function(r){ go.disabled=false;
        if(r&&r.success){ var x=r.data||{}; msg.innerHTML='<div style="background:#e8f7ee;color:#146c2e;border-radius:12px;padding:12px;font-weight:800">✅ LET IN — '+esc(x.NAME||'')+' · '+esc(x.QTY||1)+' × '+esc(x.TYPE_NAME||'')+'<br><span style="font-weight:600">'+esc(x.EVENT_TITLE||'')+'</span></div>'; inp.value=''; try{ navigator.vibrate&&navigator.vibrate(60); }catch(e){} }
        else if(r&&r.unpaid){ msg.innerHTML='<div style="background:#fff7e6;color:#8a5a00;border-radius:12px;padding:12px;font-weight:800">💰 NOT PAID — '+esc(r.error||'')+'</div><div style="display:flex;gap:8px;margin-top:8px"><button type="button" data-col="CASH" style="flex:1;border:0;border-radius:10px;padding:12px;background:#16a34a;color:#fff;font-weight:900">Cash taken → let in</button><button type="button" data-col="UPI" style="flex:1;border:0;border-radius:10px;padding:12px;background:#2563eb;color:#fff;font-weight:900">UPI taken → let in</button></div>';
          msg.querySelectorAll('[data-col]').forEach(function(b){ b.onclick=function(){ check(code,b.getAttribute('data-col')); }; }); }
        else { msg.innerHTML='<div style="background:#fdecec;color:#a12020;border-radius:12px;padding:12px;font-weight:800">⛔ '+esc(r&&r.error||'Not valid')+(r&&r.data?' — '+esc(r.data.NAME||'')+', '+esc(r.data.QTY||'')+' × '+esc(r.data.TYPE_NAME||''):'')+'</div>'; try{ navigator.vibrate&&navigator.vibrate([80,60,80]); }catch(e){} }
        inp.focus(); }); }
    go.onclick=function(){ check(inp.value); }; inp.onkeydown=function(e){ if(e.key==='Enter') check(inp.value); }; setTimeout(function(){ inp.focus(); },100);
    var cam=body.querySelector('#gdCam'); if(cam) cam.onclick=function(){ if(scanning){ stop(); return; }
      navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(function(st){ stream=st; var v=body.querySelector('#gdVid'); v.srcObject=st; v.style.display='block'; v.play(); scanning=true;
        var det=new W.BarcodeDetector({formats:['qr_code']}), last='';
        (function loop(){ if(!scanning||!D.contains(v)){ stop(); return; } det.detect(v).then(function(c){ var t=c&&c[0]&&c[0].rawValue; if(t&&t!==last){ last=t; check(t); setTimeout(function(){ last=''; },4000); } }).catch(function(){}).then(function(){ setTimeout(loop,350); }); })();
      }).catch(function(){ msg.textContent='Camera not allowed — type the code.'; }); };
  }
  /* 💳 guests who tapped "I have paid" (UPI) — confirm what reached the bank */
  function drawPay(p){
    var body=shell(p,'<div style="padding:14px;color:#888">Loading…</div>');
    api('GG_PAY_CLAIMS',{fromDate:today(),status:'CLAIMED'}).then(function(r){ if(!D.contains(body)) return;
      if(!r||!r.success){ body.innerHTML=err(r); return; }
      var L=r.data||[];
      body.innerHTML=L.length?L.map(function(x,i){ return '<div style="border:1px solid var(--border,#e5e7eb);border-radius:14px;padding:12px;margin:8px 0"><b>₹'+Number(x.AMOUNT||0).toLocaleString('en-IN')+' · '+esc(x.NAME||x.CUSTOMER_NAME||'Guest')+'</b><div style="font-size:13px;color:#555">'+esc(x.TABLE_ID?'Table '+x.TABLE_ID:'')+' '+esc(x.REF||x.UTR||'')+' '+esc(x.CREATED_AT||'')+'</div>'
        +'<div style="display:flex;gap:8px;margin-top:8px"><button type="button" data-ok="'+i+'" style="flex:1;border:0;border-radius:10px;padding:10px;background:#16a34a;color:#fff;font-weight:800">✓ Received</button><button type="button" data-no="'+i+'" style="flex:1;border:1px solid #fca5a5;border-radius:10px;padding:10px;background:#fff;color:#dc2626;font-weight:800">Not received</button></div></div>'; }).join('')
        :'<div style="padding:18px;text-align:center;color:#888">No UPI payments waiting for a check.</div>';
      body.querySelectorAll('[data-ok],[data-no]').forEach(function(b){ b.onclick=function(){ var ok=b.hasAttribute('data-ok'), x=L[+(b.getAttribute('data-ok')||b.getAttribute('data-no'))]; b.disabled=true;
        api('GG_PAY_CLAIM_SET',{claimId:x.CLAIM_ID,status:ok?'RECEIVED':'NOT_RECEIVED'}).then(function(r){ toast(r&&r.success?'Saved':(r&&r.error)||'Not saved',r&&r.success?'success':'error'); drawPay(p); }); }; });
    });
  }
  function accept(id,btn){
    var o=LIST.filter(function(x){ return x.reqId===id; })[0]; if(!o) return; btn.disabled=true; btn.textContent='Accepting…';
    api('QR_ORDER_SET',{reqId:id,status:'ACCEPTED'}).then(function(r){
      if(!r||!r.success){ btn.disabled=false; btn.textContent='✅ Accept → load to order'; toast((r&&r.error)||'Could not accept','error'); if(r&&r.status){ V=''; poll(); } return; }
      var t=tbl(o.table); if(o.table&&!t){ toast('Table '+o.table+' not found — open the table and add the dishes','error'); }
      try{ if(t){ selTable=t; if(typeof openOrderForTable==='function') openOrderForTable(); } }catch(e){}
      var miss=[];
      (o.items||[]).forEach(function(i){ var m=(MENU||[]).find(function(x){ return String(x.id)===String(i.id); })||(MENU||[]).find(function(x){ return String(x.name||'').trim().toUpperCase()===String(i.name||'').trim().toUpperCase(); });
        if(!m){ miss.push(i.name); return; } order[m.id]=(Number(order[m.id])||0)+(Number(i.qty)||1); try{ updateMenuQtyUI_(m.id); }catch(e){} });
      try{ if(o.notes&&typeof orderItemRemarks==='object'){ var first=Object.keys(order)[0]; if(first) orderItemRemarks[first]=String(o.notes).slice(0,120); } }catch(e){}
      try{ updateOrderBadge(); }catch(e){}
      try{ sessionStorage.setItem('bnx_qr_wait_'+nk(o.table),id); }catch(e){}
      LIST=LIST.filter(function(x){ return x.reqId!==id; }); ui(); var p=D.getElementById('bnxQrPanel'); if(p) p.remove();
      toast(miss.length?('Loaded — not on POS menu: '+miss.join(', ')):'Loaded — check and tap Send KOT', miss.length?'error':'success');
      if(o.notes) setTimeout(function(){ toast('📝 Guest note: '+o.notes,'info'); },2600);
    });
  }
  /* when the KOT of that table is saved → tell the guest "Confirmed" */
  function hook(){ var g=W.gasApi; if(typeof g!=='function'||g.__qrHook) return; var w=function(a,p){ var r=g.apply(this,arguments);
      try{ if(a==='SAVE_ORDER'||a==='ADD_ORDER_ITEMS'||a==='ADD_ITEMS_TO_ORDER'||a==='UPDATE_ORDER_ITEMS'){ var k='bnx_qr_wait_'+nk(p&&(p.tableId||p.TABLE_ID||p.table)), id=sessionStorage.getItem(k);
        if(id) Promise.resolve(r).then(function(x){ if(x&&x.success!==false){ sessionStorage.removeItem(k); api('QR_ORDER_SET',{reqId:id,status:'CONFIRMED',orderNo:String(x.orderNo||x.data&&(x.data.ORDER_NO||x.data.orderNo)||x.kotNo||'')}); } }); } }catch(e){}
      return r; };
    w.__qrHook=1; Object.keys(g).forEach(function(k){ try{ w[k]=g[k]; }catch(e){} }); W.gasApi=w; try{ gasApi=w; }catch(e){} }
  function start(){ hook(); poll(); }
  if(D.readyState==='loading') D.addEventListener('DOMContentLoaded',function(){ setTimeout(start,3000); }); else setTimeout(start,3000);
  setInterval(function(){ hook(); poll(); },15000);
  D.addEventListener('visibilitychange',function(){ if(D.visibilityState==='visible'){ V=''; poll(); } });
})(window,document);
