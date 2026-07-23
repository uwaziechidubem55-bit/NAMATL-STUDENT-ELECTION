import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleAdminSubmit = (e) => {
    e.preventDefault();
    
    // Replace with your actual validation or API request logic
    if (username === 'admin' && password === 'password123') {
      setErrorMsg('');
      navigate('/admin-dashboard');
    } else {
      setErrorMsg('Invalid username or password');
    }
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0D3A6F',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box'
    }}>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90%', maxWidth: '360px', textAlign: 'center' }}>
        
        <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px 0', color: '#FFC107' }}>
          ADMIN ACCESS
        </h2>
        <p style={{ color: '#FFFFFF', fontSize: '13px', margin: '0 0 32px 0', opacity: 0.8 }}>
          Please enter your management credentials
        </p>

        <form onSubmit={handleAdminSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#FFC107', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px' }}>
              USERNAME
            </label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter username"
              style={{ 
                width: '100%', 
                padding: '14px', 
                borderRadius: '24px', 
                border: '1.5px solid #FFC107', 
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                boxSizing: 'border-box', 
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
          
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#FFC107', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px' }}>
              PASSWORD
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
              style={{ 
                width: '100%', 
                padding: '14px', 
                borderRadius: '24px', 
                border: '1.5px solid #FFC107', 
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                boxSizing: 'border-box', 
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          {errorMsg && (
            <div style={{ color: '#FF8888', fontSize: '13px', fontWeight: '500' }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            <button 
              type="submit"
              style={{ 
                width: '100%', 
                padding: '14px 0', 
                background: '#FFC107', 
                color: '#061D3A', 
                border: 'none', 
                borderRadius: '24px', 
                cursor: 'pointer', 
                fontSize: '16px', 
                fontWeight: '700' 
              }}
            >
              Sign In
            </button>
            
            <button 
              type="button"
              onClick={() => navigate('/')} // Take the user cleanly back to the base landing page route
              style={{ 
                width: '100%', 
                padding: '12px 0', 
                background: 'transparent', 
                color: '#ffffff', 
                border: 'none', 
                borderRadius: '24px', 
                cursor: 'pointer', 
                fontSize: '14px', 
                fontWeight: '500',
                opacity: 0.7
              }}
            >
              Go Back
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}
