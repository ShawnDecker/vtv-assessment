// VTV Auth Helper — injected into every page to handle JWT tokens
// Wraps fetch() so all /api/ calls automatically include the JWT token
(function() {
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    options = options || {};

    // Only add auth to our own API calls
    if (typeof url === 'string' && url.startsWith('/api/')) {
      const token = localStorage.getItem('vtv_token');
      if (token) {
        options.headers = options.headers || {};
        // Handle both plain objects and Headers instances
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
      // If we get a 401, token may be expired — clear it so login screen shows
      if (response.status === 401 && typeof url === 'string' && url.startsWith('/api/')) {
        // Don't clear on verify-pin (that's the login endpoint)
        if (!url.includes('verify-pin') && !url.includes('set-pin') && !url.includes('has-pin')) {
          // Token expired or invalid — redirect to login
          var currentPage = window.location.pathname;
          if (currentPage !== '/member' && currentPage !== '/') {
            localStorage.removeItem('vtv_token');
            window.location.href = '/member';
          }
        }
      }
      return response;
    });
  };

  // Also ensure email is available globally from localStorage
  window.vtvEmail = function() {
    return localStorage.getItem('vtv_member_email') || localStorage.getItem('ve_email') || '';
  };

  window.vtvToken = function() {
    return localStorage.getItem('vtv_token') || '';
  };

  window.vtvIsLoggedIn = function() {
    return !!localStorage.getItem('vtv_token');
  };
})();
