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

    if (username === 'Brouse' && password === 'Officialelectoralcommission123') {
      navigate('/admin-dashboard');
    } else {
      setError('ACCESS DENIED. Ask admin for password.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #003366 0%, #001a33 100%)',
      color: 'white', fontFamily: 'Arial, sans-serif',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '32px'
    }}>
      <div style={{
        background: 'white', borderRadius: '12px',
        padding: '40px 32px', maxWidth: '400px', width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        textAlign: 'center'
      }}>
        <img
          src="/LOGO.jpg"
          alt=""
          style={{
            width: '80px', height: '80px', borderRadius: '50%',
            objectFit: 'cover', margin: '0 auto 16px', display: 'block',
            border: '2px solid #FFD700'
          }}
          onError={e => e.target.style.display = 'none'}
        />
        <h2 style={{ color: '#003366', margin: '0 0 4px 0', fontSize: '22px' }}>
          Admin Login
        </h2>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 24px 0' }}>
          Authorized personnel only
        </p>
        {error && (
          <p style={{
            background: '#fee2e2', color: '#dc2626', padding: '10px',
            borderRadius: '6px', fontSize: '13px', marginBottom: '16px'
          }}>
            {error}
          </p>
        )}
        <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
          <input
            type="text" placeholder="Username" value={username}
            onChange={e => setUsername(e.target.value)} required
            style={{
              width: '100%', padding: '12px', marginBottom: '12px',
              border: '1px solid #ddd', borderRadius: '6px',
              fontSize: '14px', boxSizing: 'border-box'
            }}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} required
            style={{
              width: '100%', padding: '12px', marginBottom: '20px',
              border: '1px solid #ddd', borderRadius: '6px',
              fontSize: '14px', boxSizing: 'border-box'
            }}
          />
          <button type="submit" style={{
            width: '100%', padding: '12px',
            background: '#003366', color: 'white', border: 'none',
            borderRadius: '6px', fontSize: '16px', fontWeight: 'bold',
            cursor: 'pointer'
          }}>
            Sign In
          </button>
        </form>
        <p style={{ marginTop: '20px', fontSize: '13px' }}>
          <a href="#/" style={{ color: '#003366', textDecoration: 'underline' }}>Back to Home</a>
        </p>
      </div>
    </div>
  );
}