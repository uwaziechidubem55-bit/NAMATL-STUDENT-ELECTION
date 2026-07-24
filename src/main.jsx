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
  console.log('NAMTLS E-Voting System v2.0 mounted');
} else {
  document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:40vh">FATAL: root element missing</h1>';
}