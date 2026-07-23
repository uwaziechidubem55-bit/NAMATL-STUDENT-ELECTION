import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    if (username === 'BROUTE' && password === 'Officialelectoralcommission123') {
      navigate('/admin-dashboard');
    } else {
      setError('ACCESS DENIED. Ask admin for password.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1628 0%, #061D3A 50%, #003366 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255, 215, 0, 0.2)',
        borderRadius: '16px',
        padding: '40px 32px',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          border: '3px solid #FFD700',
          margin: '0 auto 16px',
          overflow: 'hidden',
          background: '#0a1628',
        }}>
          <img
            src="/logo.png"
            alt="NAMTEL Logo"
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>

        <h2 style={{ color: '#FFD700', margin: '0 0 4px', fontSize: '22px', fontWeight: 700 }}>
          Admin Login
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 24px' }}>
          Authorized personnel only
        </p>

        {error && (
          <div style={{
            background: 'rgba(220, 38, 38, 0.15)',
            border: '1px solid #dc2626',
            color: '#fca5a5',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '14px 16px',
              marginBottom: '12px',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '14px',
              boxSizing: 'border-box',
              color: '#fff',
              background: '#1e293b',
              outline: 'none',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '14px 16px',
              marginBottom: '24px',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '14px',
              boxSizing: 'border-box',
              color: '#fff',
              background: '#1e293b',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '14px',
              background: '#FFD700',
              color: '#061D3A',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => (e.target.style.background = '#e6a800')}
            onMouseLeave={(e) => (e.target.style.background = '#FFD700')}
          >
            Sign In
          </button>
        </form>

        <button
          onClick={() => navigate('/')}
          style={{
            color: '#FFD700',
            background: 'transparent',
            border: '1px solid rgba(255,215,0,0.2)',
            borderRadius: '0px',
            padding: '8px 16px',
            marginTop: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'all 0.3s',
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255,215,0,0.1)';
            e.target.style.borderColor = '#FFD700';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.borderColor = 'rgba(255,215,0,0.2)';
          }}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}