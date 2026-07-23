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
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #061D3A 0%, #0A2B52 40%, #0F3A6A 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      {/* ===== YOUR LOGO — correct path to public/logo.png ===== */}
      <img
        src="/logo.png"
        alt="NAMTLS Logo"
        style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          border: '3px solid #FFC107',
          objectFit: 'cover',
          marginBottom: '16px',
          boxShadow: '0 0 25px rgba(255,193,7,0.25)',
        }}
      />

      {/* ===== TITLE ===== */}
      <h2
        style={{
          color: '#FFC107',
          fontSize: '24px',
          fontWeight: 'bold',
          margin: '0 0 4px 0',
        }}
      >
        Admin Login
      </h2>
      <p
        style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '13px',
          margin: '0 0 24px 0',
        }}
      >
        Authorized personnel only
      </p>

      {/* ===== ERROR MESSAGE ===== */}
      {error && (
        <div
          style={{
            background: 'rgba(220, 38, 38, 0.15)',
            border: '1px solid #dc2626',
            color: '#fca5a5',
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px',
            textAlign: 'center',
            width: '100%',
            maxWidth: '360px',
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
          maxWidth: '360px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
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
            padding: '14px 0',
            background: '#FFC107',
            color: '#061D3A',
            border: 'none',
            borderRadius: '24px',
            fontWeight: '700',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.target.style.background = '#e6a800')}
          onMouseLeave={(e) => (e.target.style.background = '#FFC107')}
        >
          Sign In
        </button>
      </form>

      {/* ===== BACK LINK ===== */}
      <Link
        to="/"
        style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: '13px',
          marginTop: '20px',
          textDecoration: 'none',
          opacity: '0.7',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => (e.target.style.opacity = '1')}
        onMouseLeave={(e) => (e.target.style.opacity = '0.7')}
      >
        ← Back to Home
      </Link>
    </div>
  );
}