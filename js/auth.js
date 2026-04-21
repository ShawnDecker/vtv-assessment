// VTV Auth Helper v3 — Global JWT token management + silent refresh
// Wraps fetch() to auto-attach tokens, handle auth failures gracefully,
// and silently refresh tokens that are within 48h of expiring.
(function() {
  var originalFetch = window.fetch;

  // Token introspection — parse JWT payload without verifying
  function parseToken(token) {
    if (!token) return null;
    try {
      var parts = token.split('.');
      if (parts.length !== 3) return null;
      var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload;
    } catch (e) { return null; }
  }

  // Check if token is close to expiring (within 48 hours)
  function tokenNeedsRefresh() {
    var token = localStorage.getItem('vtv_token');
    var payload = parseToken(token);
    if (!payload || !payload.exp) return false;
    var now = Math.floor(Date.now() / 1000);
    var secondsLeft = payload.exp - now;
    return secondsLeft > 0 && secondsLeft < 48 * 60 * 60;
  }

  // Check if token is expired (but within 14-day refresh grace period)
  function tokenCanBeRefreshed() {
    var token = localStorage.getItem('vtv_token');
    var payload = parseToken(token);
    if (!payload || !payload.exp) return false;
    var now = Math.floor(Date.now() / 1000);
    var graceWindow = 14 * 24 * 60 * 60;
    return payload.exp < now && payload.exp > now - graceWindow;
  }

  // Silent refresh — returns a promise that resolves to new token or null
  var refreshInFlight = null;
  function silentRefresh() {
    if (refreshInFlight) return refreshInFlight;
    var token = localStorage.getItem('vtv_token');
    if (!token) return Promise.resolve(null);

    refreshInFlight = originalFetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    }).then(function(res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function(data) {
      refreshInFlight = null;
      if (data && data.token) {
        localStorage.setItem('vtv_token', data.token);
        if (data.tier) localStorage.setItem('vtv_tier', data.tier);
        if (data.contactId) localStorage.setItem('vtv_contact_id', String(data.contactId));
        return data.token;
      }
      return null;
    }).catch(function() { refreshInFlight = null; return null; });

    return refreshInFlight;
  }

  // Proactively refresh on page load if needed (non-blocking)
  if (tokenNeedsRefresh() || tokenCanBeRefreshed()) {
    silentRefresh();
  }

  // Endpoints that MUST have auth (write operations, sensitive data)
  var WRITE_ENDPOINTS = ['/member/portal', '/member/delete', '/member/set-pin', '/member/preferences',
    '/teams', '/privacy', '/coaching/reply', '/affiliate', '/agent/email/report-action'];

  window.fetch = function(url, options) {
    options = options || {};

    // Only modify our own API calls
    if (typeof url === 'string' && url.startsWith('/api/')) {
      var token = localStorage.getItem('vtv_token');
      if (token) {
        options.headers = options.headers || {};
        if (options.headers instanceof Headers) {
          if (!options.headers.has('Authorization')) {
            options.headers.set('Authorization', 'Bearer ' + token);
          }
        } else {
          if (!options.headers['Authorization']) {
            options.headers['Authorization'] = 'Bearer ' + token;
          }
        }
      }
    }

    return originalFetch.call(this, url, options).then(function(response) {
      // Handle 401 responses
      if (response.status === 401 && typeof url === 'string' && url.startsWith('/api/')) {
        // Skip auth endpoints themselves
        if (url.includes('verify-pin') || url.includes('set-pin') || url.includes('has-pin') || url.includes('/auth/refresh')) {
          return response;
        }

        // STEP 1: Try silent refresh before giving up
        if (tokenCanBeRefreshed() || tokenNeedsRefresh()) {
          return silentRefresh().then(function(newToken) {
            if (newToken) {
              // Retry the original request with the new token
              options.headers = options.headers || {};
              if (options.headers instanceof Headers) {
                options.headers.set('Authorization', 'Bearer ' + newToken);
              } else {
                options.headers['Authorization'] = 'Bearer ' + newToken;
              }
              return originalFetch.call(this, url, options);
            }
            // Refresh failed — fall through to redirect logic
            return handleAuthFailure(url, options, response);
          });
        }

        return handleAuthFailure(url, options, response);
      }
      return response;
    });

    function handleAuthFailure(url, options, response) {
      var isWrite = WRITE_ENDPOINTS.some(function(ep) { return url.includes(ep); });
      var isPost = options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE';

      if (isWrite || isPost) {
        var currentPage = window.location.pathname;
        if (currentPage !== '/member' && currentPage !== '/') {
          localStorage.setItem('vtv_return_to', currentPage);
          localStorage.removeItem('vtv_token');
          window.location.href = '/member';
        }
      }
      return response;
    }
  };

  // Global auth helpers
  window.vtvEmail = function() {
    return localStorage.getItem('vtv_member_email') || localStorage.getItem('ve_email') || '';
  };
  window.vtvToken = function() {
    return localStorage.getItem('vtv_token') || '';
  };
  window.vtvIsLoggedIn = function() {
    return !!localStorage.getItem('vtv_token');
  };

  // On member page load, check if we should redirect back after login
  if (window.location.pathname === '/member') {
    var returnTo = localStorage.getItem('vtv_return_to');
    if (returnTo && localStorage.getItem('vtv_token')) {
      localStorage.removeItem('vtv_return_to');
      window.location.href = returnTo;
    }
  }
})();
