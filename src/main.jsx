import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// ===== ADD THIS: Global error handler catches anything that slips through =====
window.onerror = function(msg, url, line, col, err) {
  console.error('[Global Error]', msg, err);
  const rootEl = document.getElementById('root');
  if (rootEl && !rootEl.innerHTML.includes('Fatal Error')) {
    rootEl.innerHTML = `
      <div style="min-height:100vh;background:#003366;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:Arial,sans-serif;padding:20px">
        <h1 style="color:#FFD700">⚠️ Fatal Error</h1>
        <p style="color:#e0e0e0;max-width:500px;text-align:center;word-break:break-word">${String(msg)}</p>
        <button onclick="location.reload()" style="padding:12px 32px;background:#FFD700;color:#003366;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:16px;margin-top:16px">Reload</button>
      </div>`;
  }
  return true;
};

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
// sw.js now exists in /public and gets copied to build output.
// This enables the 'beforeinstallprompt' event in Chrome/Edge/Android
// AND enables offline caching for the PWA.
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