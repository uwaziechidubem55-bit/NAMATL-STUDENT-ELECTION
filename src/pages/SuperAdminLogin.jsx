// NAMATLS Super Admin Login — the ONLY door to the Super Admin Dashboard.
// Reachable only from the Admin Dashboard. Requires TWO things:
//   1) an active ADMIN session (checked on mount + server-side),
//   2) the SUPER ADMIN CODE — verified server-side against Firestore
//      (superAdmin/settings), with a lockout after 5 wrong attempts.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    // Rule: the only way in is through the Admin Dashboard (admin session must exist).
    if (!localStorage.getItem('adminToken')) {
      navigate('/admin-login', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || ''),
        },
        body: JSON.stringify({ action: 'superLogin', code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        localStorage.setItem('superToken', data.superToken);
        navigate('/super-admin-dashboard');
      } else {
        setMsg({ type: 'error', text: data.message || 'Wrong code. Try again.' });
        setCode('');
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Network error. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: '40px 32px', borderRadius: '12px', width: '100%', maxWidth: '380px', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px' }}>🛡️</div>
          <h2 style={{ margin: '8px 0 4px 0', color: '#003366' }}>Super Admin</h2>
          <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>Code verified against Firestore</p>
        </div>

        {msg.text && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold', fontSize: '13px', background: msg.type === 'error' ? '#fee2e2' : '#d1fae5', color: msg.type === 'error' ? '#991b1b' : '#166534' }}>
            {msg.text}
          </div>
        )}

        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter super admin code"
          autoFocus
          style={{ width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '20px', boxSizing: 'border-box', fontSize: '16px', fontFamily: 'monospace', letterSpacing: '2px', outline: 'none' }}
        />

        <button type="submit" disabled={busy}
          style={{ width: '100%', padding: '14px', background: '#003366', color: '#FFD700', border: 'none', borderRadius: '8px', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px', opacity: busy ? 0.6 : 1 }}>
          {busy ? '⏳ Checking Firestore...' : '🔓 Unlock Control Room'}
        </button>

        <button type="button" onClick={() => navigate('/admin-dashboard')}
          style={{ width: '100%', marginTop: '12px', padding: '12px', background: 'transparent', color: '#003366', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
          ← Back to Admin Dashboard
        </button>
      </form>
    </div>
  );
}
