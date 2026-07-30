import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Register service worker for PWA install
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(() => {
      console.log('SW registered');
    }).catch(() => {});
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
  document.body.innerHTML = '<h1>FATAL: root element missing</h1>';
}