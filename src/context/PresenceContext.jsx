// NAMTLS Presence — the heartbeat that tells the Super Admin Dashboard who is
// on which page, right now. Renders NOTHING. Mounted exactly ONCE in App.jsx,
// so it automatically covers every page of the app.
// How it works: every page change + every 45 seconds it quietly tells the
// server "I'm still here, on this page". The server counts anyone seen in the
// last 2 minutes as ONLINE. If the pings ever fail, the site is unaffected.
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

function detectRole() {
  try {
    if (localStorage.getItem('adminToken')) return 'admin';
    if (localStorage.getItem('staffToken')) return 'staff';
    if (localStorage.getItem('studentSession')) return 'student';
  } catch (e) { /* private browsing — treat as visitor */ }
  return 'visitor';
}

function getAnonId() {
  try {
    let id = localStorage.getItem('namatls_presence_id');
    if (!id) {
      id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('namatls_presence_id', id);
    }
    return id;
  } catch (e) {
    return 'p_temp_' + Math.random().toString(36).slice(2, 10);
  }
}

async function ping(page, anonId) {
  try {
    await fetch('/api/student?action=presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId, page, role: detectRole() }),
    });
  } catch (e) { /* offline — ignore. Monitoring must NEVER break the site */ }
}

export function PresenceProvider() {
  const location = useLocation();
  const anonRef = useRef(null);
  if (!anonRef.current) anonRef.current = getAnonId();

  useEffect(() => {
    const page = location.pathname || '/';
    ping(page, anonRef.current);
    const timer = setInterval(() => ping(page, anonRef.current), 45000);
    return () => clearInterval(timer);
  }, [location]);

  return null;
}

export default PresenceProvider;
