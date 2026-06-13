/**
 * Balaji NextGen ERP — Session Guard v2
 * FIXES:
 *  1. Reads BOTH localStorage (ERP_KEYS) AND sessionStorage to find valid session
 *  2. Browser close → clears localStorage so dashboard can't reopen
 *  3. Duplicate doLogout removed
 *  4. clearSession() defined and called correctly
 *  5. Login redirect path fixed → login.html (root, not ../login/login.html)
 *  6. Auto-logout after 15 min inactivity with 2-min visual warning
 *  7. Logout button wiring
 */
(function(w) {
  'use strict';

  /* ── Keys used by erp-config.js saveSession() ── */
  const ERP_KEYS = {
    USER:    'ERP_USER',
    SESSION: 'ERP_SESSION',
    ROLE:    'ERP_ROLE',
    CLIENT:  'ERP_CLIENT',
    EXPIRY:  'ERP_EXPIRY',
  };

  /* ── Legacy keys from older versions ── */
  const LEGACY_KEYS = [
    'erp_session', 'erp_session_v1', 'erp_session_v2',
    'erp_token', 'erpUser', 'erpToken',
    'erp_activity_log', 'erp_clients_cache',
    'BALAJI_ERP_TOKEN', 'BALAJI_ERP_USER', 'BALAJI_ERP_ROLE', 'BALAJI_LOGIN_TIME',
    'ERP_LOGIN_TIME',
  ];

  const GAS_URL    = 'https://script.google.com/macros/s/AKfycbzhJVH-J3ONgqSwvznhEBJeHviUzajub7hf6q3_vLGIEmaGM9s400dONxqxP0Iczgw/exec';
  const TIMEOUT_MS = 15 * 60 * 1000;   // 15 min inactivity
  const WARN_MS    = 2  * 60 * 1000;   // warn 2 min before logout
  const TICK_MS    = 1000;

  /* ── Determine login page path ── */
  function _loginPath() {
    const p = window.location.pathname.toLowerCase();
    // If inside a subfolder (e.g. /balaji_erp_package/ or /Dashboard/)
    if (p.split('/').length > 3) return '../login.html';
    return 'login.html';
  }

  let _timer        = null;
  let _warnBox      = null;
  let _lastActivity = Date.now();

  /* ══════════════════════════════════════════
     SESSION READ — checks both storages
  ══════════════════════════════════════════ */
  function getSession() {
    // Primary: check ERP_KEYS in localStorage (set by erp-config.js)
    try {
      const expiry = parseInt(localStorage.getItem(ERP_KEYS.EXPIRY) || '0');
      const userRaw = localStorage.getItem(ERP_KEYS.USER);
      if (expiry && userRaw && Date.now() < expiry) {
        const user = JSON.parse(userRaw);
        return {
          name:          user.FULL_NAME || user.NAME || user.USERNAME || 'User',
          role:          user.ROLE || localStorage.getItem(ERP_KEYS.ROLE) || '',
          client:        user.CLIENT_ID || localStorage.getItem(ERP_KEYS.CLIENT) || '',
          token:         localStorage.getItem(ERP_KEYS.SESSION) || '',
          sessionExpiry: expiry,
          _source:       'localStorage',
        };
      }
    } catch(e) {}

    // Fallback: check sessionStorage 'erp_session'
    try {
      const raw = sessionStorage.getItem('erp_session');
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.sessionExpiry && Date.now() < s.sessionExpiry) {
          return { ...s, _source: 'sessionStorage' };
        }
      }
    } catch(e) {}

    return null;
  }

  /* ══════════════════════════════════════════
     CLEAR SESSION — wipes ALL storage
  ══════════════════════════════════════════ */
  function clearSession() {
    // Clear ERP_KEYS from localStorage
    Object.values(ERP_KEYS).forEach(k => {
      try { localStorage.removeItem(k); } catch(e) {}
    });
    // Clear legacy keys
    LEGACY_KEYS.forEach(k => {
      try { localStorage.removeItem(k); } catch(e) {}
      try { sessionStorage.removeItem(k); } catch(e) {}
    });
    // Clear full sessionStorage
    try { sessionStorage.clear(); } catch(e) {}
  }

  /* ══════════════════════════════════════════
     LOGOUT — clear + notify GAS + redirect
  ══════════════════════════════════════════ */
  function doLogout(reason) {
    reason = reason || 'manual';

    // Notify GAS (fire-and-forget)
    try {
      const token = localStorage.getItem(ERP_KEYS.SESSION) || sessionStorage.getItem('erp_token') || '';
      if (token) {
        navigator.sendBeacon(GAS_URL, new Blob(
          [JSON.stringify({ action: 'LOGOUT', token, reason })],
          { type: 'text/plain' }
        ));
      }
    } catch(e) {}

    clearSession();

    // Stop the idle timer
    if (_timer) { clearInterval(_timer); _timer = null; }
    if (_warnBox) { _warnBox.style.display = 'none'; }

    window.location.replace(_loginPath());
  }

  /* ══════════════════════════════════════════
     ACTIVITY TRACKING
  ══════════════════════════════════════════ */
  function resetActivity() {
    _lastActivity = Date.now();
    // Extend expiry in localStorage
    try {
      const newExpiry = Date.now() + TIMEOUT_MS;
      const existing  = parseInt(localStorage.getItem(ERP_KEYS.EXPIRY) || '0');
      if (existing) localStorage.setItem(ERP_KEYS.EXPIRY, newExpiry);
    } catch(e) {}
    if (_warnBox) _warnBox.style.display = 'none';
  }

  /* ══════════════════════════════════════════
     WARNING BOX
  ══════════════════════════════════════════ */
  function buildWarnBox() {
    const box = document.createElement('div');
    box.id = 'sessionWarnBox';
    box.style.cssText = [
      'position:fixed;bottom:24px;right:24px;background:#0f172a;color:#fff;',
      'padding:16px 20px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);',
      'z-index:99999;font-family:"DM Sans",sans-serif;max-width:280px;',
      'border:2px solid #f97316;display:none;'
    ].join('');
    box.innerHTML =
      '<div style="font-weight:700;font-size:13px;margin-bottom:6px;">⚠️ Session Expiring Soon</div>' +
      '<div style="font-size:12px;color:#94a3b8;margin-bottom:10px;">Auto-logout in ' +
        '<span id="sgCountdown" style="color:#f97316;font-weight:700;">2:00</span></div>' +
      '<button onclick="SessionGuard.extend()" style="background:#f97316;color:#fff;border:none;' +
        'padding:7px 16px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:700;width:100%;">' +
        'Stay Logged In</button>';
    document.body.appendChild(box);
    return box;
  }

  /* ══════════════════════════════════════════
     IDLE TIMER
  ══════════════════════════════════════════ */
  function startTimer() {
    if (_timer) clearInterval(_timer);
    _timer = setInterval(function() {
      const idle      = Date.now() - _lastActivity;
      const remaining = TIMEOUT_MS - idle;

      if (remaining <= 0) {
        clearInterval(_timer);
        doLogout('timeout');
        return;
      }

      if (remaining <= WARN_MS) {
        if (!_warnBox) _warnBox = buildWarnBox();
        _warnBox.style.display = 'block';
        const secs = Math.floor(remaining / 1000);
        const m    = Math.floor(secs / 60);
        const s    = secs % 60;
        const cd   = document.getElementById('sgCountdown');
        if (cd) cd.textContent = m + ':' + String(s).padStart(2, '0');
      } else {
        if (_warnBox) _warnBox.style.display = 'none';
      }
    }, TICK_MS);
  }

  /* ══════════════════════════════════════════
     BROWSER CLOSE → LOGOUT
     Uses pagehide (modern) + beforeunload (fallback)
     BOTH clear localStorage so session doesn't persist
  ══════════════════════════════════════════ */
  function attachCloseListener() {
    // pagehide: fires on tab close, window close, navigation
    window.addEventListener('pagehide', function(e) {
      // e.persisted = true means page went into bfcache (back/forward), NOT closed
      // e.persisted = false means actual close/navigation
      if (!e.persisted) {
        clearSession();           // ← wipes localStorage so browser re-open = logged out
        const token = localStorage.getItem(ERP_KEYS.SESSION) || '';
        if (token) {
          try {
            navigator.sendBeacon(GAS_URL, new Blob(
              [JSON.stringify({ action: 'LOGOUT', token, reason: 'browser_close' })],
              { type: 'text/plain' }
            ));
          } catch(ex) {}
        }
      }
    });

    // beforeunload fallback (older Edge/Chrome)
    window.addEventListener('beforeunload', function() {
      clearSession();
    });
  }

  /* ══════════════════════════════════════════
     WIRE LOGOUT BUTTONS
  ══════════════════════════════════════════ */
  function wireLogoutButtons() {
    document.querySelectorAll(
      '#logoutBtn, .logout-btn, [data-action="logout"], [onclick*="logout"], [onclick*="Logout"]'
    ).forEach(function(el) {
      // Remove existing inline onclick to avoid double-firing
      el.removeAttribute('onclick');
      el.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        doLogout('manual');
      });
    });
  }

  /* ══════════════════════════════════════════
     POPULATE DATA ATTRIBUTES
  ══════════════════════════════════════════ */
  function populateSessionData(s) {
    document.querySelectorAll('[data-session]').forEach(function(el) {
      const key = el.getAttribute('data-session');
      if (s[key] !== undefined) el.textContent = s[key];
    });
    // Also fill common display elements
    ['userName', 'userRole', 'userNameDisplay', 'userRoleDisplay'].forEach(function(id) {
      const el = document.getElementById(id);
      if (!el) return;
      if (id.toLowerCase().includes('role')) el.textContent = s.role || '';
      else el.textContent = s.name || '';
    });
  }

  /* ══════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════ */
  w.SessionGuard = {

    init: function() {
      // Skip on file:// for local testing
      if (window.location.protocol === 'file:') {
        console.log('[SessionGuard] Local file mode — session check skipped');
        return { name: 'Demo User', role: 'SUPER_ADMIN', token: 'demo' };
      }

      const s = getSession();
      if (!s) {
        doLogout('no_session');
        return null;
      }

      _lastActivity = Date.now();
      populateSessionData(s);
      attachCloseListener();
      startTimer();
      wireLogoutButtons();

      ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'wheel'].forEach(function(ev) {
        document.addEventListener(ev, resetActivity, { passive: true });
      });

      console.log('[SessionGuard] ✅ Session valid for:', s.name, '| Role:', s.role);
      return s;
    },

    logout:     function()  { doLogout('manual'); },
    extend:     function()  { resetActivity(); },
    getSession: getSession,
    clearSession: clearSession,
  };

})(window);
