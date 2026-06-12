/**
 * Balaji NextGen ERP — Session Guard
 * - Redirects to login if no valid session
 * - Auto-logout after 15 min of inactivity
 * - Logout on browser close (beforeunload)
 * - Visual countdown warning at 2 min remaining
 * Usage: <script src="session_guard.js"><\/script>
 *   Call: SessionGuard.init() after DOM ready
 */
(function(w) {
  'use strict';

  const SESSION_KEY   = 'erp_session';
  const TOKEN_KEY     = 'erp_token';
  const GAS_URL       = 'https://script.google.com/macros/s/AKfycbzhJVH-J3ONgqSwvznhEBJeHviUzajub7hf6q3_vLGIEmaGM9s400dONxqxP0Iczgw/exec';
  const TIMEOUT_MS    = 15 * 60 * 1000;  // 15 minutes
  const WARN_MS       = 2  * 60 * 1000;  // warn at 2 min remaining
  const TICK_MS       = 1000;

  let _timer   = null;
  let _warnBox = null;
  let _lastActivity = Date.now();

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
    catch(e) { return null; }
  }

  function doLogout(reason='manual') {

    sessionStorage.clear();

    localStorage.removeItem('erp_session');
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erpUser');
    localStorage.removeItem('erpToken');

    window.location.href =
      '../login/login.html?t=' + Date.now();
}

  function doLogout(reason) {
    clearSession();
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        navigator.sendBeacon(GAS_URL, new Blob(
          [JSON.stringify({ action: 'LOGOUT', token, reason })],
          { type: 'text/plain' }
        ));
      } catch(e) {}
    }
    window.location.replace('login.html');
  }

  function resetActivity() {
    _lastActivity = Date.now();
    // Extend session expiry
    const s = getSession();
    if (s) {
      s.sessionExpiry = Date.now() + TIMEOUT_MS;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    }
    if (_warnBox) _warnBox.style.display = 'none';
  }

  function buildWarnBox() {
    const box = document.createElement('div');
    box.id = 'sessionWarnBox';
    box.style.cssText = `
      position:fixed;bottom:24px;right:24px;background:#0f172a;color:#fff;
      padding:16px 20px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);
      z-index:99999;font-family:'DM Sans',sans-serif;max-width:280px;
      border:2px solid #f97316;display:none;
    `;
    box.innerHTML = `
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;">⚠️ Session Expiring Soon</div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:10px;">Auto-logout in <span id="sgCountdown" style="color:#f97316;font-weight:700;">2:00</span></div>
      <button onclick="SessionGuard.extend()" style="background:#f97316;color:#fff;border:none;padding:7px 16px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:700;width:100%;">Stay Logged In</button>
    `;
    document.body.appendChild(box);
    return box;
  }

  function startTimer() {
    _timer = setInterval(function() {
      const now   = Date.now();
      const idle  = now - _lastActivity;
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
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        const cd = document.getElementById('sgCountdown');
        if (cd) cd.textContent = m + ':' + String(s).padStart(2, '0');
      }
    }, TICK_MS);
  }

  function attachActivityListeners() {
    ['mousemove','keydown','click','scroll','touchstart','wheel'].forEach(ev => {
      document.addEventListener(ev, resetActivity, { passive: true });
    });
  }

  // Browser close → logout (best-effort)
  function attachCloseListener() {
    window.addEventListener('pagehide', function(e) {
      // pagehide fires on tab close, navigation, refresh
      // Only clear session on actual close (not bfcache)
      if (!e.persisted) {
        clearSession();
      }
    });
    // Fallback for older browsers
    window.addEventListener('beforeunload', function() {
      // sendBeacon fires even on close
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          navigator.sendBeacon(GAS_URL, new Blob(
            [JSON.stringify({ action: 'LOGOUT', token, reason: 'browser_close' })],
            { type: 'text/plain' }
          ));
        } catch(e) {}
      }
    });
  }

  // Inject logout button into any element with id="logoutBtn"
  function wireLogoutButtons() {
    document.querySelectorAll('[id="logoutBtn"], .logout-btn, [data-action="logout"]').forEach(el => {
      el.addEventListener('click', function(e) {
        e.preventDefault();
        doLogout('manual');
      });
    });
  }

  // Public API
  w.SessionGuard = {
    init: function() {
      const s = getSession();
      if (!s || !s.sessionExpiry || Date.now() >= s.sessionExpiry) {
        doLogout('no_session');
        return null;
      }
      _lastActivity = Date.now();
      attachActivityListeners();
      attachCloseListener();
      startTimer();
      wireLogoutButtons();
      // Inject user info into elements with data-session="*"
      document.querySelectorAll('[data-session]').forEach(el => {
        const key = el.getAttribute('data-session');
        if (s[key] !== undefined) el.textContent = s[key];
      });
      return s;
    },
    logout: function() { doLogout('manual'); },
    extend: function() { resetActivity(); },
    getSession: getSession,
    getRoleDashboard: function(role, industry) {
      const map = {
        'super_admin':'dashboard_admin.html',
        'restaurant_manager':'dashboard_restaurant.html',
        'retail_manager':'dashboard_retail.html',
        'staff':'dashboard_general.html',
      };
      const indMap = {
        'food':'dashboard_restaurant.html',
        'retail':'dashboard_retail.html',
        'all':'dashboard_admin.html',
      };
      return map[role] || indMap[industry] || 'dashboard_general.html';
    }
  };

})(window);
