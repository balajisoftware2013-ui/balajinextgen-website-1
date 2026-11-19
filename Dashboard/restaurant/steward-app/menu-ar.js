/* menu-ar.js — Balaji NextGen ERP · AR / product view for every app (customer · steward · restaurant POS · dashboard)
   build 2026-11-19 · needs item-ar.html in the same folder (or set data-page)

   Add once, before </body>:
     <script src="menu-ar.js" data-client="CL00010"></script>      (data-client optional — read from the app when missing)

   Use:
     bnxAr.open('ITM00433')                         → product sheet: photo, price, 3D / AR, QR, link
     bnxAr.open('ITM00433', {add:true, onAdd:fn})   → shows "Add to order"; fn(itemId) is called
     bnxAr.url('ITM00433')                          → shareable product link     bnxAr.menuUrl() → whole menu
     <button data-ar-item="ITM00433">View</button>  → any element with data-ar-item opens the sheet
     bnxAr.decorate('.mi-row', el => el.id.replace('mi-',''), '.mi-icon', el => ({name, price, photo}))  → badge on rows (+ instant preview)
     bnxAr.ready  → Promise of {ar:[ids with a 3D model], real:[ids with a real photo]}
     window.bnxArClientId = () => 'CL00010'          → tell the include the client when the app keeps it elsewhere
     window.bnxArOpenOpts = id => ({add:true,onAdd})  → options used by the badges
     window.BNX_AR_PAGE = 'https://site/item-ar.html' → when item-ar.html is in another folder                                      */
(function (W, D) {
  'use strict';
  if (W.bnxAr) return;
  var me = D.currentScript || (function () { var s = D.querySelectorAll('script[src*="menu-ar.js"]'); return s[s.length - 1]; })();
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var qs = new URLSearchParams(location.search);
  function clientId() {
    var c = (typeof W.bnxArClientId === 'function' && W.bnxArClientId()) || (me && me.getAttribute('data-client')) || (W.STATE && W.STATE.clientId) || W.CLIENT_ID || qs.get('clientId') || qs.get('c') || qs.get('cid') ||
      ls('bnx_client_id') || ls('clientId') || ls('bnx_clientId') || '';
    try { if (!c) { var u = JSON.parse(ls('bnx_user') || ls('user') || 'null'); c = u && (u.CLIENT_ID || u.clientId) || ''; } } catch (e) {}
    return String(c || '').toUpperCase().trim();
  }
  function page() { return W.BNX_AR_PAGE || (me && me.getAttribute('data-page')) || ((me && me.src ? me.src.replace(/[^\/]*$/, '') : '') + 'item-ar.html'); }
  var DEP = (ls('bnx_api_core') || 'AKfycbwHdqrP4IvuVD2ZkupNybrEkiXu3kmuI6-tQoiHgYxoqr1KgUupeFsi3PIoFEbuv6XA').replace(/[^\w-]/g, '');
  var API = 'https://script.google.com/macros/s/' + DEP + '/exec';
  var CSS = '#bnxar-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(15,12,10,.55);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .2s}' +
    '#bnxar-ov.on{opacity:1}#bnxar-ov .sh{width:100%;max-width:980px;height:min(92vh,980px);background:#faf7f2;border-radius:20px 20px 0 0;overflow:hidden;transform:translateY(30px);transition:transform .25s;box-shadow:0 -10px 40px rgba(0,0,0,.3)}' +
    '#bnxar-ov.on .sh{transform:none}#bnxar-ov iframe{width:100%;height:100%;border:0;display:block}' +
    '@media(min-width:900px){#bnxar-ov{align-items:center}#bnxar-ov .sh{border-radius:20px;height:min(88vh,900px)}}' +
    '.bnxar-badge{position:absolute;left:4px;top:4px;z-index:2;border:0;border-radius:999px;padding:2px 7px;font:800 10px/1.6 system-ui,sans-serif;color:#fff;background:rgba(28,25,23,.72);cursor:pointer;letter-spacing:.2px}' +
    '.bnxar-badge.ar{background:#15803d}@media (prefers-reduced-motion:reduce){#bnxar-ov,#bnxar-ov .sh{transition:none}}';
  var st = D.createElement('style'); st.textContent = CSS; (D.head || D.documentElement).appendChild(st);

  var ov = null, cur = null;
  function close() { if (!ov) return; var o = ov; ov = null; o.classList.remove('on'); setTimeout(function () { o.remove(); }, 220); D.removeEventListener('keydown', esc); if (cur && cur.onClose) try { cur.onClose(); } catch (e) {} cur = null; }
  function esc(e) { if (e.key === 'Escape') close(); }
  function url(itemId, cid) { cid = cid || clientId(); return page() + '?c=' + encodeURIComponent(cid) + (itemId ? '&i=' + encodeURIComponent(itemId) : ''); }
  function open(itemId, opt) {
    opt = opt || {}; var cid = opt.clientId || clientId();
    if (!cid) { alert('Client not set for the AR view'); return; }
    close(); cur = opt;
    ov = D.createElement('div'); ov.id = 'bnxar-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    var src = url(itemId, cid) + '&embed=1' + (opt.add ? '&add=1' : '') + (qs.get('imgbase') ? '&imgbase=' + encodeURIComponent(qs.get('imgbase')) : '');
    /* what the app already shows goes along after # → the sheet opens at once, the server only adds the extras */
    if (opt.preview && opt.preview.name) { try { src += '#p=' + btoa(unescape(encodeURIComponent(JSON.stringify(Object.assign({ id: itemId }, opt.preview))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); } catch (e) {} }
    ov.innerHTML = '<div class="sh"><iframe allow="xr-spatial-tracking; fullscreen; clipboard-write; web-share" allowfullscreen title="Product view"></iframe></div>';
    ov.querySelector('iframe').src = src;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    D.body.appendChild(ov); requestAnimationFrame(function () { ov && ov.classList.add('on'); });
    D.addEventListener('keydown', esc);
  }
  W.addEventListener('message', function (e) {
    var d = e.data; if (!d || !d.bnxAr || !ov) return;
    if (e.source !== (ov.querySelector('iframe') || {}).contentWindow) return;
    if (d.bnxAr === 'close') close();
    if (d.bnxAr === 'add' && cur) { var f = cur.onAdd; try { if (f) f(String(d.id)); } catch (x) {} if (cur && cur.closeOnAdd !== false) setTimeout(close, 450); }
  });
  D.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[data-ar-item]'); if (!el) return;
    e.preventDefault(); e.stopPropagation(); open(el.getAttribute('data-ar-item'));
  }, true);

  /* which items have a 3D model / real photo (light call, cached 10 min on the phone) */
  /* the whole menu (photos, 3D status, descriptions) is kept on the phone for 10 min — the sheet then opens without asking the server */
  var readyP = null;
  function summary(d) { var o = { ar: [], real: [] }; (d && d.items || []).forEach(function (x) { if (x.glb) o.ar.push(x.id); if (x.photoKind === 'REAL') o.real.push(x.id); }); return o; }
  function ready() {
    if (readyP) return readyP;
    var cid = clientId(); if (!cid) return Promise.resolve({ ar: [], real: [] });   /* not known yet: try again on the next call */
    var key = 'bnx_ar_cat_' + cid, old = null; try { old = JSON.parse(ls(key) || 'null'); } catch (e) {}
    var net = fetch(API + '?action=MENU_AR&clientId=' + encodeURIComponent(cid)).then(function (r) { return r.json(); }).then(function (j) {
      if (!(j && j.success && j.data)) throw new Error('menu');
      try { j.data._t = Date.now(); localStorage.setItem(key, JSON.stringify(j.data)); } catch (e) {}
      return j.data;
    });
    if (old && old.items && Date.now() - (old._t || 0) < 6e5) { readyP = Promise.resolve(summary(old)); return readyP; }
    readyP = old && old.items ? (net.catch(function () {}), Promise.resolve(summary(old))) : net.then(summary).catch(function () { return { ar: [], real: [] }; });
    return readyP;
  }
  function decorate(selector, getId, host, getPreview) {
    ready().then(function (d) {
      var ar = {}; (d.ar || []).forEach(function (i) { ar[i] = 1; });
      D.querySelectorAll(selector).forEach(function (row) {
        var id = String(getId(row) || '').toUpperCase(); if (!id || row.querySelector('.bnxar-badge')) return;
        var box = host ? row.querySelector(host) : row; if (!box) return;
        if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
        var b = D.createElement('button'); b.type = 'button'; b.className = 'bnxar-badge' + (ar[id] ? ' ar' : '');
        b.textContent = ar[id] ? '3D · AR' : '🔍'; b.setAttribute('aria-label', ar[id] ? 'View in 3D / AR' : 'View dish');
        b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); var o = typeof W.bnxArOpenOpts === 'function' ? W.bnxArOpenOpts(id) : {}; if (getPreview) try { o.preview = getPreview(row); } catch (x) {} open(id, o); };
        box.appendChild(b);
      });
    });
  }
  setTimeout(function () { try { ready(); } catch (e) {} }, 3500);
  W.bnxAr = { open: open, close: close, url: url, preview: function (row, nameSel, priceSel) { var im = row.querySelector('img'), n = row.querySelector(nameSel), p = row.querySelector(priceSel); return { name: n ? n.textContent.trim() : '', price: p ? Number(String(p.textContent).replace(/[^\d.]/g, '')) || 0 : 0, photo: im && /^https:/.test(im.currentSrc || im.src) ? (im.currentSrc || im.src) : '' }; }, menuUrl: function (cid) { return url('', cid); }, decorate: decorate, get ready() { return ready(); }, get page() { return page(); } };
})(window, document);
