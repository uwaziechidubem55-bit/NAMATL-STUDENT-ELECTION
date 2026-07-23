import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    if (username === 'Brouse' && password === 'Officialelectoralcommission123') {
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
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: '20px',
    }}>
      <div style={{
        background: 'rgba(15,23,42,0.9)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        padding: '40px 32px',
        width: '100%',
        maxWidth: '400px',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        textAlign: 'center',
      }}>
        {/* ===== YOUR LOGO — correct path to public/logo.png ===== */}
        <img src="/logo.png" alt="NAMTLS Logo"
          onError={(e) => { e.target.style.display = 'none'; }}
          style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            objectFit: 'cover',
            marginBottom: '16px',
            border: '3px solid rgba(255,215,0,0.3)',
            boxShadow: '0 0 30px rgba(255,215,0,0.15)',
          }} />

        {/* ===== TITLE ===== */}
        <h2 style={{ margin: '0 0 4px', color: '#FFD700', fontSize: '22px', fontWeight: 700 }}>
          Admin Login
        </h2>
        <p style={{ margin: '0 0 28px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
          Authorized personnel only
        </p>

        {/* ===== ERROR MESSAGE ===== */}
        {error && (
          <div style={{
            background: 'rgba(220,38,38,0.15)',
            border: '1px solid rgba(220,38,38,0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#ef4444',
            fontSize: '13px',
            marginBottom: '20px',
          }}>
            {error}
          </div>
        )}

        {/* ===== LOGIN FORM ===== */}
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
          <button type="submit"
            style={{
              width: '100%',
              padding: '14px 0',
              background: '#FFC107',
              color: '#061D3A',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.target.style.background = '#e6a800')}
            onMouseLeave={(e) => (e.target.style.background = '#FFC107')}
          >
            Sign In
          </button>
        </form>

        {/* ===== BACK LINK — REPLACED WITH SHARP BLOCK ===== */}
        <div onClick={() => navigate('/')}
          style={{
            color: '#FFD700',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'inline-block',
            padding: '8px 16px',
            border: '1px solid rgba(255,215,0,0.2)',
            borderRadius: '0px',
            transition: 'all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
            background: 'transparent',
            marginTop: '20px',
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255,215,0,0.1)';
            e.target.style.borderColor = '#FFD700';
            e.target.style.transform = 'translateX(4px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.borderColor = 'rgba(255,215,0,0.2)';
            e.target.style.transform = 'translateX(0)';
          }}>
          ← Back to Home
        </div>
      </div>
    </div>
  );
}