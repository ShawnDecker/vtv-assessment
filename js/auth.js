// VTV Auth Helper v2 — Global JWT token management
// Wraps fetch() to auto-attach tokens and handle auth failures gracefully
(function() {
  var originalFetch = window.fetch;

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
        // Skip auth endpoints
        if (url.includes('verify-pin') || url.includes('set-pin') || url.includes('has-pin')) {
          return response;
        }

        // For write endpoints, redirect to login
        var isWrite = WRITE_ENDPOINTS.some(function(ep) { return url.includes(ep); });
        var isPost = options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE';

        if (isWrite || isPost) {
          var currentPage = window.location.pathname;
          if (currentPage !== '/member' && currentPage !== '/') {
            // Save where they were so we can bring them back after login
            localStorage.setItem('vtv_return_to', currentPage);
            localStorage.removeItem('vtv_token');
            window.location.href = '/member';
            return response;
          }
        }
        // For GET requests on non-write endpoints, just return the response
        // The page should handle the error gracefully
      }
      return response;
    });
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
