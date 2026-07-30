import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// ===== 💥 UPGRADED: Bulletproof global error handler =====
// Catches ANY uncaught JS error and forces a visible error screen.
// This prevents the blank white page from ever appearing.
window.onerror = function(msg, url, line, col, err) {
  console.error('[Global Error]', msg, err);
  showFatalError(msg, err);
  return true;
};

// ===== 💥 ADDED: Catch unhandled Promise rejections =====
// These are NOT caught by window.onerror, so they need a separate handler.
// Without this, an async Firebase/Flutterwave failure silently kills the app.
window.addEventListener('unhandledrejection', function(event) {
  console.error('[Unhandled Promise Rejection]', event.reason);
  const reason = event.reason?.message || event.reason || 'Unknown Promise rejection';
  showFatalError('Unhandled Promise: ' + reason, event.reason);
  event.preventDefault();
});

// ===== 💥 ADDED: Catch runtime errors after React mounts =====
// This catches errors thrown in event handlers, setTimeout, etc.
// that React's ErrorBoundary cannot catch.
window.addEventListener('error', function(event) {
  // Skip if already handled by window.onerror (same event fires both)
  if (event.error && event.error._handled) return;
  if (event.error) event.error._handled = true;
  console.error('[Runtime Error]', event.error || event.message);
  if (event.error || event.message) {
    showFatalError(event.message || event.error?.message, event.error);
  }
});

// ===== 💥 Shared: Force error onto screen in an unignorable way =====
function showFatalError(msg, err) {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    document.body.innerHTML = getErrorHTML(msg, err);
    return;
  }
  // Always overwrite — even if another error handler already wrote something
  rootEl.innerHTML = getErrorHTML(msg, err);
  // Also write to document title so the tab itself shows the error
  document.title = '⚠️ ERROR - ' + (msg || 'Unknown').substring(0, 60);
  // Force the body background to dark blue so white is NEVER shown
  document.body.style.backgroundColor = '#003366';
  document.body.style.margin = '0';
}

function getErrorHTML(msg, err) {
  const stack = err?.stack || '';
  const errorMessage = String(msg || err?.message || 'Unknown error');
  // Sanitize against XSS (just in case the error message contains HTML)
  const safeMsg = errorMessage.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const safeStack = stack.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `
    <div style="min-height:100vh;background:#003366;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:Arial,sans-serif;padding:20px;box-sizing:border-box">
      <div style="background:#8B0000;color:#FFD700;padding:8px 24px;border-radius:4px;font-weight:bold;font-size:14px;margin-bottom:16px">⚠️ FATAL APPLICATION ERROR</div>
      <h1 style="color:#FFD700;margin:0 0 12px 0;font-size:24px;text-align:center">Something Went Wrong</h1>
      <div style="background:rgba(255,255,255,0.1);border:1px solid #FFD700;border-radius:8px;padding:16px;max-width:700px;width:100%;margin-bottom:20px;text-align:left;overflow-wrap:break-word">
        <p style="color:#FF6B6B;font-weight:bold;margin:0 0 8px 0">Error Message:</p>
        <pre style="color:#e0e0e0;margin:0 0 12px 0;white-space:pre-wrap;word-break:break-word;font-size:13px;background:rgba(0,0,0,0.3);padding:10px;border-radius:4px">${safeMsg}</pre>
        ${safeStack ? `<p style="color:#FF6B6B;font-weight:bold;margin:0 0 8px 0">Stack Trace:</p><pre style="color:#b0b0b0;margin:0;white-space:pre-wrap;word-break:break-word;font-size:11px;max-height:200px;overflow-y:auto;background:rgba(0,0,0,0.3);padding:10px;border-radius:4px">${safeStack}</pre>` : ''}
      </div>
      <button onclick="localStorage.clear();sessionStorage.clear();caches.keys().then(function(k){return Promise.all(k.map(function(c){return caches.delete(c)}))}).then(function(){navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(s){s.unregister()})}).then(function(){location.reload(true)})})" style="padding:14px 40px;background:#FFD700;color:#003366;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:16px;margin-top:8px">🧹 Clear Cache & Reload</button>
      <p style="color:#888;font-size:12px;margin-top:20px">If this persists, contact the development team with the error message above.</p>
    </div>
  `;
}

// ===== 🧹 ADDED: Clear stale service worker caches on first load =====
// Prevents "blank white page" caused by SW serving stale/cached error pages
// from previous deployments. Runs BEFORE the new SW registers.
(async function clearStaleSWCaches() {
  if ('caches' in window) {
    const cacheKeys = await caches.keys();
    const staleCaches = cacheKeys.filter(k => k !== 'namatl-vote-v2');
    await Promise.all(staleCaches.map(k => caches.delete(k)));
    console.log('[Cache Cleanup] Removed', staleCaches.length, 'stale cache(s)');
  }
  // Unregister any orphaned service workers from old deployments
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (reg.active && reg.active.scriptURL.includes('sw.js')) {
        await reg.unregister();
        console.log('[SW Cleanup] Unregistered existing service worker');
      }
    }
  }
})();

// ===== RESTORED: Service worker registration =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(() => {
      console.log('NAMTLS SW registered');
    }).catch((err) => {
      console.warn('NAMTLS SW registration failed:', err.message);
    });
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>
  );
  console.log('NAMTLS E-Voting System v2.0 mounted');
} else {
  document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:100px">FATAL: root element missing</h1>';
}