/* BNX INSTALL-ON-OPEN \u2014 shared helper for every app page.
   The Mobile Apps gallery opens an app with ?install=1. This shows a bottom
   "Install" bar on that app (Android: real install prompt when the page is
   installable; iPhone: Share \u2192 Add to Home Screen steps). Uses the page's own
   window.installApp() if it has one. Safe to include on any page. */
(function(){
  'use strict';
  try{
    var q=new URLSearchParams(location.search);
    if(q.get('install')!=='1') return;
    var D=document, ua=navigator.userAgent||'';
    var isIOS=/iPad|iPhone|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
    function standalone(){try{return navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;}catch(e){return false;}}
    if(standalone()) return;
    /* drop ?install=1 so a later "Add to Home Screen" / reload does not keep it */
    try{ q.delete('install'); history.replaceState(null,'',location.pathname+(q.toString()?'?'+q:'')+location.hash); }catch(e){}
    var deferred=null;
    window.addEventListener('beforeinstallprompt',function(e){ if(!window.__bnxDeferredInstall){ e.preventDefault(); deferred=e; } });
    window.addEventListener('appinstalled',function(){ var b=D.getElementById('bnx-iob'); if(b) b.remove(); });
    function name(){ var m=D.querySelector('meta[name="apple-mobile-web-app-title"],meta[name="application-name"]'); return (m&&m.content)||D.title.split(/[\u2014|\u00b7-]/)[0].trim()||'this app'; }
    function guide(){
      var g=D.getElementById('bnx-iob-g'); if(g){g.remove();return;}
      g=D.createElement('div'); g.id='bnx-iob-g';
      g.style.cssText='margin-top:10px;font-size:13px;line-height:1.6;background:rgba(255,255,255,.12);border-radius:10px;padding:8px 10px';
      g.innerHTML=isIOS
        ? '1. Tap <b>Share</b> \u2b06 (iOS 26: <b>\u22ef</b> \u2192 <b>Share</b>)<br>2. Tap <b>Add to Home Screen</b><br>3. Tap <b>Add</b>'
        : '1. Tap Chrome menu <b>\u22ee</b><br>2. Tap <b>Install app</b> / <b>Add to Home screen</b><br>3. Tap <b>Install</b>';
      D.getElementById('bnx-iob').appendChild(g);
    }
    function install(){
      var p=window.__bnxDeferredInstall||deferred;
      if(!isIOS&&p){ p.prompt(); p.userChoice.then(function(c){ if(c&&c.outcome==='accepted'){var b=D.getElementById('bnx-iob'); if(b) b.remove();} }).catch(function(){}); window.__bnxDeferredInstall=null; deferred=null; return; }
      if(isIOS&&typeof window.bnxShowAddToHome==='function'){ window.bnxShowAddToHome(); return; }
      guide();
    }
    function show(){
      if(D.getElementById('bnx-iob')) return;
      var b=D.createElement('div'); b.id='bnx-iob';
      b.style.cssText='position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:2147483000;background:#0f172a;color:#fff;border-radius:16px;padding:12px 12px 12px 14px;box-shadow:0 12px 36px rgba(0,0,0,.35);font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto';
      b.innerHTML='<div style="display:flex;align-items:center;gap:10px"><div style="font-size:24px">\ud83d\udcf2</div><div style="flex:1;min-width:0"><b>Install '+name().replace(/</g,'&lt;')+'</b><div style="font-size:12px;opacity:.8">'+(isIOS?'Add to your Home Screen':'Full-screen app on your phone')+'</div></div>'
        +'<button type="button" id="bnx-iob-go" style="border:0;border-radius:10px;padding:10px 14px;background:#2563eb;color:#fff;font-weight:800;font-size:14px">'+(isIOS?'How?':'Install')+'</button>'
        +'<button type="button" id="bnx-iob-x" aria-label="Close" style="border:0;background:transparent;color:#fff;font-size:18px;padding:4px 6px;opacity:.7">\u2715</button></div>';
      D.body.appendChild(b);
      D.getElementById('bnx-iob-go').onclick=install;
      D.getElementById('bnx-iob-x').onclick=function(){b.remove();};
    }
    if(D.readyState==='loading') D.addEventListener('DOMContentLoaded',function(){setTimeout(show,600);}); else setTimeout(show,600);
  }catch(e){}
})();
