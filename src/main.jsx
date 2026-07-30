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

// ===== REMOVED: Broken service worker registration =====
// The old code tried to register /sw.js which doesn't exist.
// It silently failed with .catch(() => {}), but on some browsers
// a stale cached service worker from a previous deploy served
// broken shell content. Removed entirely.

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