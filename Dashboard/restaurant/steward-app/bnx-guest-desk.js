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
          +'<div style="display:flex;gap:8px;margin-top:10px"><button type="button" data-cf="'+esc(o.reqId)+'" style="flex:2;border:0;border-radius:10px;padding:12px;background:#16a34a;color:#fff;font-weight:900">✅ Confirm → KOT prints</button><button type="button" data-rej="'+esc(o.reqId)+'" style="flex:1;border:1px solid #fca5a5;border-radius:10px;padding:11px;background:#fff;color:#dc2626;font-weight:800">✕ Reject</button></div>'
          +'<button type="button" data-acc="'+esc(o.reqId)+'" style="width:100%;margin-top:6px;border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:9px;background:transparent;color:inherit;font-weight:700;font-size:13px">✏️ Change dishes first (load into the table)</button></div>'; }).join('')
        :'<div style="padding:18px;text-align:center;color:#888">No QR orders waiting'+(ALL?'':' for your tables')+'.</div>'));
    p.querySelector('#qrAll').onchange=function(){ ALL=this.checked; ui(); };
    p.querySelectorAll('[data-acc]').forEach(function(b){ b.onclick=function(){ accept(b.getAttribute('data-acc'),b); }; });
    /* one tap: order saved on the server (source CUSTOMER) + KOT to every printer (Kitchen / Bar / Hukka) + guest WhatsApp "confirmed" */
    p.querySelectorAll('[data-cf]').forEach(function(b){ b.onclick=function(){ var id=b.getAttribute('data-cf'); b.disabled=true; b.textContent='Sending to kitchen…';
      api('QR_ORDER_SET',{reqId:id,status:'CONFIRMED',create:true}).then(function(r){
        if(r&&r.success){ LIST=LIST.filter(function(x){ return x.reqId!==id; }); ui(); toast('✅ Order '+(r.orderNo||'')+' confirmed · KOT → '+((r.printed&&r.printed.length)?r.printed.join(' + '):'print queue')+' · guest told on WhatsApp','success'); }
        else { b.disabled=false; b.textContent='✅ Confirm → KOT prints'; toast((r&&r.error)||'Could not confirm','error'); V=''; poll(); } }); }; });
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
  /* 🎟 event door entry — type or 📷 scan the ticket code.
     Paid → LET IN. Not paid → 💵 Cash received → let in  |  📱 UPI → QR with the amount on this phone → guest scans & pays →
     ✓ UPI received → let in. Door setting (this phone): let unpaid tickets in and collect later — Yes / No.
     Every check-in sends the guest the auto WhatsApp (welcome + payment received). */
  var DCFGK=function(){ try{ return 'bnx_door_cfg_'+(typeof CLIENT_ID!=='undefined'?CLIENT_ID:''); }catch(e){ return 'bnx_door_cfg_'; } };
  function dcfg(){ try{ return Object.assign({allowLater:false,cash:true,upi:true,card:true},JSON.parse(localStorage.getItem(DCFGK())||'{}')); }catch(e){ return {allowLater:false,cash:true,upi:true,card:true}; } }
  function dsave(c){ try{ localStorage.setItem(DCFGK(),JSON.stringify(c)); }catch(e){} }
  var PAYI=null;
  function payInfo(){ if(PAYI) return Promise.resolve(PAYI); var cid=''; try{ cid=CLIENT_ID; }catch(e){}
    var ep='https://script.google.com/macros/s/'+(W.BNX_CORE_ID||(typeof BNX_BOOTSTRAP_CORE_ID!=='undefined'?BNX_BOOTSTRAP_CORE_ID:'AKfycbwHdqrP4IvuVD2ZkupNybrEkiXu3kmuI6-tQoiHgYxoqr1KgUupeFsi3PIoFEbuv6XA'))+'/exec?action=GUEST_CHECKIN&mode=PAY_INFO&clientId='+encodeURIComponent(cid);
    return fetch(ep).then(function(r){ return r.json(); }).then(function(j){ PAYI=j||{}; return PAYI; },function(){ return {}; }); }
  function upiLink(pi,amt,ref){ var on=pi.upiOnline, pa=on||pi.upiId||pi.upi||''; if(!pa) return '';
    if(!on&&pi.upiTr) return 'upi://pay?pa='+encodeURIComponent(pa).replace(/%40/g,'@')+'&tr='+String(pi.upiTr).replace(/[^A-Za-z0-9]/g,'')+(pi.upiMc?'&mc='+String(pi.upiMc).replace(/\D/g,''):'')+'&am='+Number(amt).toFixed(2)+'&cu=INR';
    return 'upi://pay?pa='+encodeURIComponent(pa).replace(/%40/g,'@')+'&pn='+encodeURIComponent(pi.upiName||'')+'&am='+Number(amt).toFixed(2)+'&cu=INR&tn='+encodeURIComponent('Ticket '+ref); }
  function qrInto(el,text){ var go=function(){ try{ el.innerHTML=''; new W.QRCode(el,{text:text,width:240,height:240,correctLevel:W.QRCode.CorrectLevel.M}); }catch(e){ el.textContent='QR could not be drawn'; } };
    if(W.QRCode) go(); else { var sc=D.createElement('script'); sc.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; sc.onload=go; sc.onerror=function(){ el.textContent='No internet for the QR — use the counter QR'; }; D.head.appendChild(sc); } }
  /* ➕ counter / door sale: event → ticket type → passes → name + mobile → Cash / Card / UPI QR (/ later) → booked + paid +
     checked in in one go; the guest gets one WhatsApp (welcome + payment received + entry code). */
  function coreEp(){ return 'https://script.google.com/macros/s/'+(W.BNX_CORE_ID||(typeof BNX_BOOTSTRAP_CORE_ID!=='undefined'?BNX_BOOTSTRAP_CORE_ID:'AKfycbwHdqrP4IvuVD2ZkupNybrEkiXu3kmuI6-tQoiHgYxoqr1KgUupeFsi3PIoFEbuv6XA'))+'/exec'; }
  function counterBook(p){
    var c=dcfg(), body=shell(p,'<div style="padding:14px;color:#888">Loading events…</div>');
    api('GG_EVENTS',{}).then(function(r){ if(!D.contains(body)) return; if(!r||!r.success){ body.innerHTML=err(r); return; }
      var EV=(r.data||[]).filter(function(e){ return !e.past&&e.active!==false&&(e.tickets||[]).length; });
      if(!EV.length){ body.innerHTML='<div style="padding:18px;text-align:center;color:#888">No upcoming event with tickets.</div>'; return; }
      var ei=0, ti=0, qty=1;
      function types(){ return (EV[ei].tickets||[]).filter(function(t){ return t.active!==false; }); }
      function paint(){ var T=types(), t=T[ti]||T[0]||{}, left=Math.max(0,(Number(t.qty)||0)-(Number(t.sold)||0)), amt=(Number(t.price)||0)*qty;
        body.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:16px">➕ Counter booking</b><button type="button" id="cbBack" style="border:0;background:none;font-weight:800;color:#2563eb">← Door</button></div>'
          +'<label style="display:block;font-size:12px;margin-top:8px">Event</label><select id="cbEv" style="width:100%;padding:11px;border-radius:10px;font-size:15px">'+EV.map(function(e,i){ return '<option value="'+i+'"'+(i===ei?' selected':'')+'>'+esc(e.title)+' · '+esc(e.date||'')+(e.time?' '+esc(e.time):'')+'</option>'; }).join('')+'</select>'
          +'<label style="display:block;font-size:12px;margin-top:8px">Ticket</label><div>'+T.map(function(x,i){ var lf=Math.max(0,(Number(x.qty)||0)-(Number(x.sold)||0)); return '<button type="button" data-t="'+i+'" style="width:100%;text-align:left;margin:4px 0;border:2px solid '+(i===ti?'#111':'var(--border,#e5e7eb)')+';border-radius:10px;padding:10px;background:transparent;color:inherit;'+(lf?'':'opacity:.4')+'"><b>'+esc(x.name)+'</b> · '+(Number(x.price)?'₹'+Number(x.price).toLocaleString('en-IN'):'Free')+'<span style="float:right;font-size:12px">'+lf+' left</span></button>'; }).join('')+'</div>'
          +'<div style="display:flex;align-items:center;gap:12px;margin:8px 0"><span style="font-size:12px">Passes</span><button type="button" id="cbM" style="width:40px;height:40px;border-radius:10px;font-size:20px">−</button><b style="font-size:20px">'+qty+'</b><button type="button" id="cbP" style="width:40px;height:40px;border-radius:10px;font-size:20px">+</button><b style="margin-left:auto;font-size:18px">'+(amt?'₹'+amt.toLocaleString('en-IN'):'Free')+'</b></div>'
          +'<input id="cbName" placeholder="Guest name" style="width:100%;padding:11px;border-radius:10px;font-size:15px;margin:4px 0;border:1px solid var(--border,#e5e7eb)"><input id="cbMob" type="tel" inputmode="numeric" maxlength="10" placeholder="Mobile (WhatsApp)" style="width:100%;padding:11px;border-radius:10px;font-size:15px;margin:4px 0;border:1px solid var(--border,#e5e7eb)">'
          +'<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">'
          +(!amt?'<button type="button" data-pay="FREE" style="border:0;border-radius:12px;padding:14px;background:#16a34a;color:#fff;font-weight:900">✓ Book free pass → let in</button>'
            :(c.cash?'<button type="button" data-pay="CASH" style="border:0;border-radius:12px;padding:14px;background:#16a34a;color:#fff;font-weight:900">💵 Cash ₹'+amt.toLocaleString('en-IN')+' → book & let in</button>':'')
            +(c.card?'<button type="button" data-pay="CARD" style="border:0;border-radius:12px;padding:14px;background:#7c3aed;color:#fff;font-weight:900">💳 Card swiped → book & let in</button>':'')
            +(c.upi?'<button type="button" data-pay="UPI" style="border:0;border-radius:12px;padding:14px;background:#2563eb;color:#fff;font-weight:900">📱 UPI — show QR</button>':'')
            +(c.allowLater?'<button type="button" data-pay="LATER" style="border:1px solid #d97706;border-radius:12px;padding:12px;background:#fff;color:#b45309;font-weight:800">Book & let in — collect later</button>':''))
          +'</div><div id="cbMsg" style="margin-top:10px;text-align:center"></div>';
        body.querySelector('#cbBack').onclick=function(){ drawDoor(p); };
        body.querySelector('#cbEv').onchange=function(){ ei=+this.value; ti=0; qty=1; paint(); };
        body.querySelectorAll('[data-t]').forEach(function(b){ b.onclick=function(){ ti=+b.getAttribute('data-t'); paint(); }; });
        body.querySelector('#cbM').onclick=function(){ qty=Math.max(1,qty-1); paint(); }; body.querySelector('#cbP').onclick=function(){ qty=Math.min(Math.max(1,left),Math.min(20,qty+1)); paint(); };
        var nm=body.querySelector('#cbName'), mb=body.querySelector('#cbMob'), m=body.querySelector('#cbMsg');
        if(paint.nm) nm.value=paint.nm; if(paint.mb) mb.value=paint.mb; nm.oninput=function(){ paint.nm=nm.value; }; mb.oninput=function(){ paint.mb=mb.value; };
        body.querySelectorAll('[data-pay]').forEach(function(b){ b.onclick=function(){
          var mode=b.getAttribute('data-pay'), name=nm.value.trim(), mob=mb.value.replace(/\D/g,'').slice(-10);
          if(!name){ m.innerHTML='<b style="color:#dc2626">Enter the guest name</b>'; return; } if(!/^[6-9]\d{9}$/.test(mob)){ m.innerHTML='<b style="color:#dc2626">Enter a 10-digit mobile</b>'; return; }
          if(!left){ m.innerHTML='<b style="color:#dc2626">Sold out</b>'; return; }
          if(mode==='UPI'&&!b.__ok){ b.disabled=true; payInfo().then(function(pi){ var l=upiLink(pi,amt,'DOOR'); if(!l){ m.innerHTML='<div style="color:#dc2626">UPI not set — use the counter QR</div>'; b.disabled=false; return; }
              m.innerHTML='<div style="font-weight:900">Guest scans & pays ₹'+amt.toLocaleString('en-IN')+'</div><div id="cbQr" style="display:inline-block;margin:8px auto;padding:8px;background:#fff;border-radius:12px"></div><button type="button" id="cbUpiOk" style="width:100%;border:0;border-radius:12px;padding:14px;background:#16a34a;color:#fff;font-weight:900">✓ UPI received → book & let in</button>';
              qrInto(m.querySelector('#cbQr'),l); m.querySelector('#cbUpiOk').onclick=function(){ this.disabled=true; book('UPI'); }; }); return; }
          b.disabled=true; book(mode);
          function book(md){ m.innerHTML='<div style="font-weight:800">Booking & checking in…</div>';
            api('GG_DOOR_SELL',{eventId:EV[ei].id,typeId:t.typeId||t.id||'',qty:qty,customerName:name,mobileNo:mob,payMode:md==='FREE'||!amt?'FREE':md}).then(function(r2){
              var code=r2&&(r2.code||(r2.booking&&r2.booking.code));
              if(r2&&r2.success){ m.innerHTML='<div style="background:#e8f7ee;color:#146c2e;border-radius:12px;padding:14px;font-weight:900;font-size:17px">✅ LET IN — '+esc(name)+' · '+qty+' × '+esc(t.name)+'<br><span style="font-size:22px;letter-spacing:.2em">'+esc(code)+'</span><br><span style="font-weight:600;font-size:13px">'+(md==='FREE'?'free pass':md==='LATER'?'to pay later':md+' ₹'+amt.toLocaleString('en-IN'))+' · auto WhatsApp to the guest</span></div>';
                t.sold=(Number(t.sold)||0)+qty; paint.nm=''; paint.mb=''; nm.value=''; mb.value=''; b.disabled=false; try{ navigator.vibrate&&navigator.vibrate(60); }catch(e){} DOORIX[code]={CODE:code,NAME:name,QTY:qty,TYPE_NAME:t.name,STATUS:'CHECKED_IN',AT:Date.now()}; }
              else { m.innerHTML='<div style="color:#dc2626;font-weight:800">'+esc(r2&&r2.error||'Could not book — try again')+'</div>'; b.disabled=false; }
            }); }
        }; });
      }
      paint();
    });
  }
  /* fast door: today's bookings are kept on this phone (refreshed every 30 s) → a scan answers at once from that list;
     the check-in / payment goes to the server in the background (kept and retried if the network drops). */
  var DOORIX={}, DOORAT=0, DOORQ=[];
  try{ DOORQ=JSON.parse(localStorage.getItem('bnx_door_q')||'[]')||[]; }catch(e){}
  function qsave(){ try{ localStorage.setItem('bnx_door_q',JSON.stringify(DOORQ.slice(-200))); }catch(e){} }
  function qflush(){ if(!DOORQ.length||qflush.busy) return; qflush.busy=1; var j=DOORQ[0];
    api('GG_TICKET_SET',j).then(function(r){ if(r&&(r.success||/already|checked in|cancel/i.test(String(r.error||'')))){ DOORQ.shift(); qsave(); if(!r.success) toast('Server: '+r.error+' ('+j.code+')','error'); } else if(r&&r.unpaid&&!j.collect){ DOORQ.shift(); qsave(); toast('⚠ '+j.code+' is NOT paid on the server — collect','error'); } })
      .catch(function(){}).then(function(){ qflush.busy=0; if(DOORQ.length) setTimeout(qflush,1500); }); }
  setInterval(qflush,8000);
  function doorLoad(force){ if(!force&&Date.now()-DOORAT<30000) return Promise.resolve(); DOORAT=Date.now();
    return api('GG_EVENTS',{}).then(function(r){ var td=new Date(Date.now()-6*3600e3), tday=td.toISOString().slice(0,10), tmr=new Date(td.getTime()+864e5).toISOString().slice(0,10);
      var ev=((r&&r.data)||[]).filter(function(e){ return !e.past&&(String(e.date).slice(0,10)===tday||String(e.date).slice(0,10)===tmr); });
      return Promise.all(ev.map(function(e){ return api('GG_TICKETS_LIST',{eventId:e.id}).then(function(x){ ((x&&x.data)||[]).forEach(function(b){ var k=String(b.CODE||'').toUpperCase(); if(!k) return; var cur=DOORIX[k]; if(cur&&cur.STATUS==='CHECKED_IN'&&cur.AT&&String(b.STATUS).toUpperCase()!=='CHECKED_IN'&&Date.now()-cur.AT<600000) return; b.EVENT_TITLE=b.EVENT_TITLE||e.title; DOORIX[k]=b; }); }); })); }).catch(function(){}); }
  function drawDoor(p){
    var c=dcfg(); doorLoad(true);
    var body=shell(p,'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12px;margin:2px 0 8px;padding:8px;border-radius:10px;background:var(--surface2,#f6f6f6)"><b>Door rules:</b>'
        +'<label><input type="checkbox" id="dcLater" '+(c.allowLater?'checked':'')+'> Let unpaid in (collect later)</label>'
        +'<label><input type="checkbox" id="dcCash" '+(c.cash?'checked':'')+'> 💵 Cash</label><label><input type="checkbox" id="dcUpi" '+(c.upi?'checked':'')+'> 📱 UPI</label><label><input type="checkbox" id="dcCard" '+(c.card?'checked':'')+'> 💳 Card</label></div>'
      +'<button type="button" id="gdNew" style="width:100%;margin-bottom:8px;border:0;border-radius:12px;padding:12px;background:#111;color:#fff;font-weight:900">➕ Counter booking (walk-in guest)</button>'
      +'<div style="display:flex;gap:8px"><input id="gdCode" placeholder="TICKET CODE" autocapitalize="characters" autocomplete="off" style="flex:1;min-width:0;font-size:22px;font-weight:900;letter-spacing:.15em;padding:12px;border:2px solid var(--border,#e5e7eb);border-radius:12px;text-transform:uppercase"><button type="button" id="gdGo" style="border:0;border-radius:12px;padding:0 18px;background:#16a34a;color:#fff;font-weight:900">Check</button></div>'
      +('BarcodeDetector' in W?'<button type="button" id="gdCam" style="width:100%;margin-top:10px;border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:12px;font-weight:800;background:transparent;color:inherit">📷 Scan ticket QR</button><video id="gdVid" playsinline style="display:none;width:100%;border-radius:12px;margin-top:8px"></video>':'')
      +'<div id="gdMsg" style="margin-top:12px;font-size:15px"></div>');
    ['dcLater','dcCash','dcUpi','dcCard'].forEach(function(id){ body.querySelector('#'+id).onchange=function(){ c={allowLater:body.querySelector('#dcLater').checked,cash:body.querySelector('#dcCash').checked,upi:body.querySelector('#dcUpi').checked,card:body.querySelector('#dcCard').checked}; dsave(c); }; });
    body.querySelector('#gdNew').onclick=function(){ counterBook(p); };
    var inp=body.querySelector('#gdCode'), msg=body.querySelector('#gdMsg'), go=body.querySelector('#gdGo'), stream=null, scanning=false;
    function stop(){ scanning=false; try{ stream&&stream.getTracks().forEach(function(t){ t.stop(); }); }catch(e){} var v=body.querySelector('#gdVid'); if(v) v.style.display='none'; }
    function ok(x,how){ msg.innerHTML='<div style="background:#e8f7ee;color:#146c2e;border-radius:12px;padding:14px;font-weight:900;font-size:17px">✅ LET IN — '+esc(x.NAME||'')+' · '+esc(x.QTY||1)+' × '+esc(x.TYPE_NAME||'')+'<br><span style="font-weight:600;font-size:13px">'+esc(x.EVENT_TITLE||'')+(how?' · '+esc(how):'')+' · auto WhatsApp to the guest (business number)</span></div>'; inp.value=''; try{ navigator.vibrate&&navigator.vibrate(60); }catch(e){} }
    function bad(t,x){ msg.innerHTML='<div style="background:#fdecec;color:#a12020;border-radius:12px;padding:12px;font-weight:800">⛔ '+esc(t||'Not valid')+(x?' — '+esc(x.NAME||'')+', '+esc(x.QTY||'')+' × '+esc(x.TYPE_NAME||''):'')+'</div>'; try{ navigator.vibrate&&navigator.vibrate([80,60,80]); }catch(e){} }
    function check(code,mode){ code=String(code||'').toUpperCase(); code=(code.match(/BNXTK:[^:]*:([A-Z0-9]+)/)||[])[1]||code.replace(/[^A-Z0-9]/g,''); if(code.length<4){ msg.innerHTML='<b style="color:#dc2626">Enter the ticket code</b>'; return; }
      var L=DOORIX[code];
      if(L){ var st=String(L.STATUS||'').toUpperCase(), amt0=Number(L.AMOUNT||0);
        if(st==='CHECKED_IN'||L.CHECKED_IN_AT){ if(!mode){ bad('Already checked in'+(L.CHECKED_IN_AT?' at '+String(L.CHECKED_IN_AT).slice(11,16):''),L); return; } }
        else if(/CANCEL/.test(st)){ bad('Cancelled ticket',L); return; }
        else if(mode||st==='PAID'||st==='CONFIRMED'||!amt0){
          L.STATUS='CHECKED_IN'; L.CHECKED_IN_AT=(function(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); })(new Date()); L.AT=Date.now();
          DOORQ.push(Object.assign({code:code,status:'CHECKED_IN',notify:true,requestId:'dq-'+code},mode?{collect:true,payMode:mode}:{})); qsave(); qflush();
          ok(L,mode==='CASH'?'cash taken':mode==='UPI'?'UPI received':mode==='CARD'?'card swiped':mode==='LATER'?'to pay later':'paid'); doorLoad(); return; }
        /* unpaid → payment buttons at once (local amount) */
        unpaidUi(code,L,amt0); return; }
      go.disabled=true; if(!mode) msg.textContent='Checking '+code+'…';
      api('GG_TICKET_SET',Object.assign({code:code,status:'CHECKED_IN',notify:true},mode?{collect:true,payMode:mode}:{})).then(function(r){ go.disabled=false;
        if(r&&r.success){ ok(r.data||{},mode==='CASH'?'cash taken':mode==='UPI'?'UPI received':mode==='CARD'?'card swiped':mode==='LATER'?'to pay later':'paid'); }
        else if(r&&r.unpaid){ var x=r.data||{}; unpaidUi(code,x,Number(x.AMOUNT||x.amount||0)||Number((String(r.error||'').replace(/,/g,'').match(/(\d+(?:\.\d+)?)/)||[])[1]||0)); }
        else bad(r&&r.error,r&&r.data);
        inp.focus(); }); }
    function unpaidUi(code,x,amt){
          msg.innerHTML='<div style="background:#fff7e6;color:#8a5a00;border-radius:12px;padding:12px;font-weight:900;font-size:16px">💰 NOT PAID'+(amt?' — ₹'+amt.toLocaleString('en-IN'):'')+'<br><span style="font-weight:600;font-size:13px">'+esc(x.NAME||'')+(x.QTY?' · '+esc(x.QTY)+' × '+esc(x.TYPE_NAME||''):'')+'</span></div>'
            +'<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">'
            +(c.cash?'<button type="button" data-m="CASH" style="border:0;border-radius:12px;padding:14px;background:#16a34a;color:#fff;font-weight:900;font-size:15px">💵 Cash received → let in</button>':'')
            +(c.card?'<button type="button" data-m="CARD" style="border:0;border-radius:12px;padding:14px;background:#7c3aed;color:#fff;font-weight:900;font-size:15px">💳 Card swiped → let in</button>':'')
            +(c.upi?'<button type="button" data-qr="1" style="border:0;border-radius:12px;padding:14px;background:#2563eb;color:#fff;font-weight:900;font-size:15px">📱 UPI — show QR to scan</button>':'')
            +(c.allowLater?'<button type="button" data-m="LATER" style="border:1px solid #d97706;border-radius:12px;padding:12px;background:#fff;color:#b45309;font-weight:800">Let in — collect later</button>':'')
            +'</div><div id="gdQr" style="text-align:center"></div>';
          msg.querySelectorAll('[data-m]').forEach(function(b){ b.onclick=function(){ b.disabled=true; check(code,b.getAttribute('data-m')); }; });
          var qb=msg.querySelector('[data-qr]'); if(qb) qb.onclick=function(){ qb.disabled=true; qb.textContent='Loading QR…';
            payInfo().then(function(pi){ var l=upiLink(pi,amt,code), box=msg.querySelector('#gdQr'); if(!l){ box.innerHTML='<div style="color:#dc2626;margin-top:8px">UPI not set for this outlet — use the counter QR</div>'; return; }
              box.innerHTML='<div style="margin-top:10px;font-weight:900">Guest scans & pays ₹'+amt.toLocaleString('en-IN')+'</div><div id="gdQrImg" style="display:inline-block;margin:8px auto;padding:8px;background:#fff;border-radius:12px"></div>'
                +'<button type="button" id="gdUpiOk" style="width:100%;border:0;border-radius:12px;padding:14px;background:#16a34a;color:#fff;font-weight:900;font-size:15px">✓ UPI received (seen on guest phone / bank) → let in</button>';
              qrInto(box.querySelector('#gdQrImg'),l); qb.style.display='none';
              box.querySelector('#gdUpiOk').onclick=function(){ this.disabled=true; check(code,'UPI'); }; }); };
        
    }
    go.onclick=function(){ check(inp.value); }; inp.onkeydown=function(e){ if(e.key==='Enter') check(inp.value); }; setTimeout(function(){ inp.focus(); },100);
    var cam=body.querySelector('#gdCam'); if(cam) cam.onclick=function(){ if(scanning){ stop(); return; }
      navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(function(st){ stream=st; var v=body.querySelector('#gdVid'); v.srcObject=st; v.style.display='block'; v.play(); scanning=true;
        var det=new W.BarcodeDetector({formats:['qr_code']}), last='';
        (function loop(){ if(!scanning||!D.contains(v)){ stop(); return; } det.detect(v).then(function(cc){ var t=cc&&cc[0]&&cc[0].rawValue; if(t&&t!==last){ last=t; stop(); check(t); setTimeout(function(){ last=''; },4000); } }).catch(function(){}).then(function(){ setTimeout(loop,350); }); })();
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
  function hook(){ var g=W.gasApi; if(typeof g!=='function'||g.__qrHook) return; var w=function(a,p){
      try{ if(a==='SAVE_ORDER'&&p){ var wid=sessionStorage.getItem('bnx_qr_wait_'+nk(p.tableId||p.TABLE_ID||p.table)); if(wid){ p.orderSource='CUSTOMER'; p.ORDER_SOURCE='CUSTOMER'; p.qrReqId=wid; } } }catch(e){}   /* shows under Order Register › CUSTOMER */
      var r=g.apply(this,arguments);
      try{ if(a==='SAVE_ORDER'||a==='ADD_ORDER_ITEMS'||a==='ADD_ITEMS_TO_ORDER'||a==='UPDATE_ORDER_ITEMS'){ var k='bnx_qr_wait_'+nk(p&&(p.tableId||p.TABLE_ID||p.table)), id=sessionStorage.getItem(k);
        if(id) Promise.resolve(r).then(function(x){ if(x&&x.success!==false){ sessionStorage.removeItem(k); api('QR_ORDER_SET',{reqId:id,status:'CONFIRMED',orderNo:String(x.orderNo||x.data&&(x.data.ORDER_NO||x.data.orderNo)||x.kotNo||'')}); } }); } }catch(e){}
      return r; };
    w.__qrHook=1; Object.keys(g).forEach(function(k){ try{ w[k]=g[k]; }catch(e){} }); W.gasApi=w; try{ gasApi=w; }catch(e){} }
  function start(){ hook(); poll(); }
  if(D.readyState==='loading') D.addEventListener('DOMContentLoaded',function(){ setTimeout(start,3000); }); else setTimeout(start,3000);
  setInterval(function(){ hook(); poll(); },15000);
  D.addEventListener('visibilitychange',function(){ if(D.visibilityState==='visible'){ V=''; poll(); } });
})(window,document);
