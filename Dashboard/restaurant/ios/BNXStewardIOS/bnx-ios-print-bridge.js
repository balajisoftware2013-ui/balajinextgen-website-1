(function(){
  if(!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.bnxPrinter) return;
  window.bnxNativeDirectPrint = function(role, ip, port, raw, job){
    function b64(s){ return btoa(unescape(encodeURIComponent(s))); }
    window.webkit.messageHandlers.bnxPrinter.postMessage({role:role,ip:ip,port:port||9100,dataBase64:b64(raw),job:job||''});
    return true;
  };
})();
