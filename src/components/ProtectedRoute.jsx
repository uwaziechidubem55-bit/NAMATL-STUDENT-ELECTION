// NAMATLS ProtectedRoute — guards /admin-dashboard
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('checking'); // checking | ok | denied

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('adminToken');
    if (!token) {
      setStatus('denied');
      return;
    }
    fetch('/api/verify-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({})
    })
      .then(async (r) => {
        if (cancelled) return;
        if (r.ok) {
          setStatus('ok');
        } else {
          localStorage.removeItem('adminToken');
          setStatus('denied');
        }
      })
      .catch(() => { if (!cancelled) setStatus('denied'); });

    return () => { cancelled = true; };
  }, []);

  if (status === 'checking') {
    return (
      <div style={{ minHeight: '100vh', background: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ color: '#FFD700', fontSize: '20px', fontWeight: 'bold' }}>Checking session...</div>
      </div>
    );
  }
  if (status === 'denied') return <Navigate to="/admin-login" replace />;
  return children;
}