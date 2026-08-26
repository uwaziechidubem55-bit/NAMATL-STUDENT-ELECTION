// NAMATLS Staff Login v1.0 — Password-only access for Lecturers & HOD
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function StaffLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('staffToken');
    if (token) navigate('/staff-dashboard', { replace: true });
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the staff password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('staffToken', data.token);
        localStorage.setItem('staffSession', JSON.stringify({
          loggedInAt: new Date().toISOString(),
          role: 'staff',
        }));
        navigate('/staff-dashboard', { replace: true });
      } else {
        setError(data.message || 'Access Denied. Incorrect password.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #003366 0%, #004080 50%, #003366 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Arial, sans-serif',
    padding: '20px',
  };

  const cardStyle = {
    background: 'white',
    borderRadius: '18px',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
    textAlign: 'center',
  };

  const logoWrapperStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '16px',
  };

  const logoStyle = {
    width: '90px',
    height: '90px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '4px solid #FFD700',
    boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)',
  };

  const titleStyle = {
    color: '#003366',
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '0 0 4px 0',
  };

  const subtitleStyle = {
    color: '#888',
    fontSize: '13px',
    margin: '0 0 28px 0',
  };

  const inputWrapperStyle = {
    position: 'relative',
    marginBottom: '16px',
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    paddingRight: '50px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    fontFamily: 'Arial, sans-serif',
  };

  const toggleBtnStyle = {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    color: '#888',
    padding: '4px',
  };

  const btnStyle = {
    width: '100%',
    padding: '14px',
    background: loading
     ? '#94a3b8'
      : 'linear-gradient(135deg, #003366, #004080)',
    color: loading? '#ccc' : '#FFD700',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 'bold',
    fontSize: '16px',
    cursor: loading? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    letterSpacing: '0.5px',
    boxShadow: loading? 'none' : '0 4px 12px rgba(0,51,102,0.3)',
  };

  const errorStyle = {
    color: '#dc2626',
    fontSize: '13px',
    marginBottom: '12px',
    padding: '10px',
    background: '#fef2f2',
    borderRadius: '8px',
    border: '1px solid #fecaca',
    display: error? 'block' : 'none',
  };

  const backLinkStyle = {
    display: 'inline-block',
    marginTop: '20px',
    color: '#888',
    textDecoration: 'none',
    fontSize: '13px',
    cursor: 'pointer',
  };

  const dividerStyle = {
    height: '1px',
    background: '#e8ecf0',
    margin: '24px 0 16px 0',
  };

  const footerNoteStyle = {
    fontSize: '11px',
    color: '#aaa',
    marginTop: '16px',
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Logo perfectly centered */}
        <div style={logoWrapperStyle}>
          <img
            src="/logo.png"
            alt="NAMATL Logo"
            style={logoStyle}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>

        <h1 style={titleStyle}>Staff Access</h1>
        <p style={subtitleStyle}>Lecturers & HOD — Election Monitoring Portal</p>

        <form onSubmit={handleLogin}>
          <div style={errorStyle}>{error}</div>

          <div style={inputWrapperStyle}>
            <input
              type={showPassword? 'text' : 'password'}
              placeholder="Enter staff password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
               ...inputStyle,
                borderColor: error? '#dc2626' : '#e0e0e0',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#003366'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e0e0e0'; }}
              autoFocus
            />
            <button
              type="button"
              style={toggleBtnStyle}
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword? '🙈' : '👁'}
            </button>
          </div>

          <button
            type="submit"
            style={btnStyle}
            disabled={loading}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,51,102,0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,51,102,0.3)';
              }
            }}
          >
            {loading? 'Verifying...' : '🔐 Enter Dashboard'}
          </button>
        </form>

        <div style={dividerStyle}></div>

        <Link to="/" style={backLinkStyle}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#003366'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; }}
        >
          ← Back to Home
        </Link>

        <div style={footerNoteStyle}>
          Authorized personnel only. All access is monitored.
        </div>
      </div>
    </div>
  );
}