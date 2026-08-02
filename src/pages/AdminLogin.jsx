// NAMATLS Admin Login v2 — stores the session token, then redirects
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setMsg({ type: 'error', text: 'Enter both username and password.' });
      return;
    }
    setBusy(true);
    setMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('adminToken', data.token);
        navigate('/admin-dashboard', { replace: true });
      } else {
        setMsg({ type: 'error', text: data.message || 'Login failed. Check your credentials.' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Network error: ' + err.message });
    }
    setBusy(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: '40px 32px', borderRadius: '12px', width: '100%', maxWidth: '380px', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
        <h2 style={{ margin: '0 0 4px 0', color: '#003366', textAlign: 'center' }}>NAMATLS Admin</h2>
        <p style={{ margin: '0 0 24px 0', color: '#888', textAlign: 'center', fontSize: '13px' }}>Electoral Commission — Restricted Access</p>

        {msg.text && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold', fontSize: '13px',
            background: msg.type === 'error' ? '#fee2e2' : '#d1fae5',
            color: msg.type === 'error' ? '#dc2626' : '#16a34a'
          }}>
            {msg.text}
          </div>
        )}

        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Admin username" autoComplete="username"
          style={{ width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '16px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} />

        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password"
          style={{ width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '20px', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} />

        <button type="submit" disabled={busy}
          style={{ width: '100%', padding: '14px', background: '#003366', color: '#FFD700', border: 'none', borderRadius: '8px', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Signing in...' : 'Sign In'}
        </button>

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <a href="/" style={{ color: '#2563eb', fontSize: '13px', textDecoration: 'none' }}>← Back to home</a>
        </div>
      </form>
    </div>
  );
}