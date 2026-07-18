import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    if (username === 'admin' && password === 'Officialelectoralcommission123') {
      navigate('/admin-dashboard');
    } else {
      setError('Invalid Credentials. Ask admin for password.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ color: '#003366', marginBottom: '4px' }}>Admin Login</h2>
        <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>Authorized personnel only</p>
        <form onSubmit={handleLogin}>
          {error && (
            <div style={{ padding: '10px', background: '#fee2e2', color: '#dc2626', borderRadius: '4px', marginBottom: '12px', fontSize: '14px', fontWeight: 'bold', textAlign: 'center', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}
          <input placeholder="Username" value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '16px', boxSizing: 'border-box', fontSize: '14px' }} required />
          <input type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '16px', boxSizing: 'border-box', fontSize: '14px' }} required />
          <button type="submit"
            style={{ width: '100%', padding: '12px', background: '#FFD700', color: '#003366', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
            Login
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/" style={{ color: '#2563eb', fontSize: '13px' }}>Back to Home</Link>
        </div>
      </div>
    </div>
  );
}