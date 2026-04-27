// error-reporter.js — Global client-side error reporter
window.addEventListener('error', function(e) {
  try {
    fetch('/api/error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: e.message,
        stack: e.error ? e.error.stack : '',
        url: window.location.href,
        page: window.location.pathname
      })
    }).catch(function() {});
  } catch(ex) {}
});
window.addEventListener('unhandledrejection', function(e) {
  try {
    fetch('/api/error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Unhandled Promise: ' + (e.reason ? e.reason.message || String(e.reason) : 'unknown'),
        stack: e.reason ? e.reason.stack || '' : '',
        url: window.location.href,
        page: window.location.pathname
      })
    }).catch(function() {});
  } catch(ex) {}
});
