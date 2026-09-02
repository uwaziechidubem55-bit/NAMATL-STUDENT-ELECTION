import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// ===== 💥 UPGRADED: Bulletproof global error handler =====
// Catches ANY uncaught JS error and forces a visible error screen.
window.onerror = function(msg, url, line, col, err) {
  // IGNORE Vercel internal errors — these are harmless infrastructure noise
  if (isVercelInternalError(msg, err)) return true;
  console.error('[Global Error]', msg, err);
  showFatalError(msg, err);
  return true;
};

// ===== 💥 FIXED: Catch unhandled Promise rejections =====
// But IGNORE Vercel's own internal ones that break the page
window.addEventListener('unhandledrejection', function(event) {
  const reason = event.reason?.message || event.reason || '';
  if (isVercelInternalError(reason, event.reason)) {
    console.log('[Vercel Internal] Ignored:', reason);
    event.preventDefault();
    return;
  }
  console.error('[Unhandled Promise Rejection]', event.reason);
  showFatalError('Unhandled Promise: ' + reason, event.reason);
  event.preventDefault();
});

// ===== 💥 FIXED: Catch runtime errors but ignore Vercel internals =====
window.addEventListener('error', function(event) {
  if (event.error && event.error._handled) return;
  if (isVercelInternalError(event.message, event.error)) return;
  if (event.error) event.error._handled = true;
  console.error('[Runtime Error]', event.error || event.message);
  if (event.error || event.message) {
    showFatalError(event.message || event.error?.message, event.error);
  }
});

// ===== 🔑 KEY: Filter function — ignores Vercel's internal noise =====
function isVercelInternalError(msg, err) {
  const text = String(msg || err?.message || err?.stack || '');
  const stack = String(err?.stack || '');
  // Vercel injects these scripts — they fail harmlessly
  if (text.includes('magicRPC')) return true;
  if (stack.includes('magicRPC')) return true;
  if (text.includes('_vercel')) return true;
  if (text.includes('/__vercel/')) return true;
  if (text.includes('Failed to fetch') && stack.includes('<anonymous>')) return true;
  return false;
}

// ===== 💥 Shared: Force error onto screen =====
function showFatalError(msg, err) {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    document.body.innerHTML = getErrorHTML(msg, err);
    return;
  }
  rootEl.innerHTML = getErrorHTML(msg, err);
  document.title = '⚠️ ERROR - ' + (msg || 'Unknown').substring(0, 60);
  document.body.style.backgroundColor = '#003366';
  document.body.style.margin = '0';
}

function getErrorHTML(msg, err) {
  const stack = err?.stack || '';
  const errorMessage = String(msg || err?.message || 'Unknown error');
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

// ===== 🧹 Updated: Clear stale SW caches on load, keeps ALL 'namatl-vote-v*' =====
// (unregister loop REMOVED — it fought the auto-update flow and caused reload loops;
//  whitelist now matches sw.js which uses 'namatl-vote-v' + CACHE_VERSION)
(async function clearStaleSWCaches() {
  if ('caches' in window) {
    const cacheKeys = await caches.keys();
    // Keeps 'namatl-vote-v1', 'namatl-vote-v2', ... active, deletes anything else
    const staleCaches = cacheKeys.filter(k => !k.startsWith('namatl-vote-v'));
    await Promise.all(staleCaches.map(k => caches.delete(k)));
    console.log('[Cache Cleanup] Removed', staleCaches.length, 'stale cache(s)');
  }
})();

// ===== Service worker registration — auto-update on every Vercel push =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('NAMTLS SW registered');
      // Force re-check for a freshly deployed sw.js on every load
      await reg.update();
    } catch (err) {
      console.warn('NAMTLS SW registration failed:', err.message);
    }
  });
  // New SW took control → reload once so the UI matches the new build
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
  console.log('NAMTLS E-Voting System mounted');
} else {
  document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:100px">FATAL: root element missing</h1>';
}