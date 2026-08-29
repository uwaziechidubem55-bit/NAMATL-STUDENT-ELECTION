// NAMATLS SuperAdminRoute — the two-lock guard for /super-admin-dashboard.
// Lock 1: a valid ADMIN session. Lock 2: a valid SUPER ADMIN session.
// Both are verified SERVER-SIDE on every visit (same pattern as ProtectedRoute).
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export default function SuperAdminRoute({ children }) {
  const [status, setStatus] = useState('checking'); // checking | ok | denied

  useEffect(() => {
    let cancelled = false;
    const adminToken = localStorage.getItem('adminToken');
    const superToken = localStorage.getItem('superToken');
    if (!adminToken || !superToken) {
      setStatus('denied');
      return;
    }
    fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + adminToken,
        'x-super-token': superToken,
      },
      body: JSON.stringify({ action: 'superVerify' }),
    })
      .then(async (r) => {
        if (cancelled) return;
        if (r.ok) {
          setStatus('ok');
        } else {
          localStorage.removeItem('superToken');
          setStatus('denied');
        }
      })
      .catch(() => { if (!cancelled) setStatus('denied'); });

    return () => { cancelled = true; };
  }, []);

  if (status === 'checking') {
    return (
      <div style={{ minHeight: '100vh', background: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ color: '#FFD700', fontSize: '20px', fontWeight: 'bold' }}>Checking super admin session...</div>
      </div>
    );
  }

  if (status === 'denied') return <Navigate to="/super-admin-login" replace />;
  return children;
}