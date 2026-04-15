// cookie-consent.js — Drop-in GDPR/CCPA cookie consent
(function() {
  if (localStorage.getItem('vtv_cookie_consent')) return; // Already consented

  var banner = document.createElement('div');
  banner.id = 'cookie-consent';
  banner.innerHTML = '<div style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#1a1a1a;border-top:1px solid #333;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-family:sans-serif;font-size:13px;color:#ccc;">' +
    '<span>We use cookies for analytics and to improve your experience. <a href="/privacy" style="color:#D4A847;">Privacy Policy</a></span>' +
    '<div style="display:flex;gap:8px;">' +
    '<button onclick="window.__vtv_consent(true)" style="padding:8px 20px;background:#D4A847;color:#000;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;">Accept</button>' +
    '<button onclick="window.__vtv_consent(false)" style="padding:8px 20px;background:transparent;color:#888;border:1px solid #444;border-radius:6px;cursor:pointer;font-size:13px;">Decline</button>' +
    '</div></div>';
  document.body.appendChild(banner);

  window.__vtv_consent = function(accepted) {
    localStorage.setItem('vtv_cookie_consent', accepted ? 'accepted' : 'declined');
    localStorage.setItem('vtv_cookie_consent_at', new Date().toISOString());
    document.getElementById('cookie-consent').remove();
    if (!accepted) {
      // Remove GA cookies
      document.cookie.split(';').forEach(function(c) {
        if (c.trim().startsWith('_ga')) {
          document.cookie = c.split('=')[0].trim() + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.' + location.hostname;
        }
      });
    }
  };
})();
