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
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0A2342',
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden',
        padding: '20px',
        boxSizing: 'border-box'
      }}
    >
      {/* ===== LOGO AT TOP ===== */}
      <img
        src="https://raw.githubusercontent.com/logo.png?v=2"
        alt="NAMTLS Logo"
        onError={e => { e.target.style.display = 'none'; }}
        style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          border: '3px solid #FFC107',
          objectFit: 'cover',
          marginBottom: '16px',
          boxShadow: '0 0 25px rgba(255,193,7,0.25)',
          display: 'block'
        }}
      />

      {/* ===== TITLE ===== */}
      <h2
        style={{
          color: '#FFC107',
          margin: '0 0 4px 0',
          fontSize: '24px',
          fontWeight: '800',
          textAlign: 'center',
          letterSpacing: '1px'
        }}
      >
        Admin Login
      </h2>
      <p
        style={{
          color: 'rgba(255,255,255,0.5)',
          margin: '0 0 28px 0',
          fontSize: '13px',
          textAlign: 'center'
        }}
      >
        Authorized personnel only
      </p>

      {/* ===== ERROR MESSAGE ===== */}
      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.15)',
            color: '#ef4444',
            padding: '12px 18px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px',
            fontWeight: '500',
            textAlign: 'center',
            width: '100%',
            maxWidth: '340px',
            border: '1px solid rgba(239,68,68,0.3)',
            boxSizing: 'border-box'
          }}
        >
          {error}
        </div>
      )}

      {/* ===== LOGIN FORM ===== */}
      <form
        onSubmit={handleLogin}
        style={{
          width: '100%',
          maxWidth: '340px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
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
            outline: 'none'
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
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
            outline: 'none'
          }}
        />
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '14px',
            background: '#FFC107',
            color: '#0A2342',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.target.style.background = '#e6a800'}
          onMouseLeave={e => e.target.style.background = '#FFC107'}
        >
          Sign In
        </button>
      </form>

      {/* ===== BACK LINK ===== */}
      <Link
        to="/"
        style={{
          color: '#FFC107',
          fontSize: '13px',
          marginTop: '24px',
          textDecoration: 'none',
          opacity: 0.7
        }}
        onMouseEnter={e => e.target.style.opacity = '1'}
        onMouseLeave={e => e.target.style.opacity = '0.7'}
      >
        ← Back to Home
      </Link>
    </div>
  );
}