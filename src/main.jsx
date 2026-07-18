import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

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
  console.log('NAMTLS E-Voting System mounted');
} else {
  document.body.innerHTML = '<div style="background:#dc2626;color:white;padding:40px;text-align:center;font-family:Arial,sans-serif"><h1>FATAL: root element missing</h1></div>';
}