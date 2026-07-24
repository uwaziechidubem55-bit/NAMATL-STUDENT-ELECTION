// NAMTLS Landing v2.0.2 - Sharp blink on return
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    // Trigger a sharp golden flash when the page mounts (e.g. navigating "back")
    setBlink(true);
    const timer = setTimeout(() => setBlink(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const containerStyle = {
    minHeight: '100vh',
    background: blink
      ? 'radial-gradient(circle at center, rgba(255,215,0,0.4) 0%, #003366 60%)'
      : 'linear-gradient(135deg, #003366 0%, #004080 50%, #003366 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Arial, sans-serif',
    position: 'relative',
    padding: '20px',
    transition: 'background 0.15s ease-out'
  };

  const logoStyle = {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '4px solid #FFD700',
    boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)',
    marginBottom: '20px'
  };

  const menuBtnStyle = {
    position: 'absolute',
    top: '15px',
    left: '15px',
    width: '42px',
    height: '42px',
    background: 'rgba(255, 215, 0, 0.15)',
    borderRadius: '50%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #FFD700',
    cursor: 'pointer',
    zIndex: 20,
    gap: '4px',
    padding: '10px',
    transition: 'background 0.3s ease'
  };

  const dotStyle = {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: '#FFD700',
    display: 'block'
  };

  const menuDropdownStyle = {
    position: 'absolute',
    top: '65px',
    left: '15px',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    zIndex: 30,
    minWidth: '220px',
    overflow: 'hidden'
  };

  const menuItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 18px',
    color: '#333',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
    borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer',
    transition: 'background 0.2s'
  };

  const titleStyle = {
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: '8px',
    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
    letterSpacing: '1px',
    lineHeight: '1.2',
    fontSize: 'clamp(1.5rem, 6vw, 2.5rem)'
  };

  const titleLineStyle = {
    display: 'block'
  };

  const titleNoBreakStyle = {
    display: 'block',
    whiteSpace: 'nowrap'
  };

  const subtitleStyle = {
    fontSize: 'clamp(0.8rem, 3vw, 1rem)',
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: '35px',
    opacity: 0.9,
    maxWidth: '320px',
    padding: '0 10px'
  };

  const buttonStyle = {
    padding: '14px 44px',
    fontSize: 'clamp(1rem, 4vw, 1.2rem)',
    fontWeight: 'bold',
    color: '#003366',
    background: 'linear-gradient(135deg, #FFD700, #FFC000)',
    border: 'none',
    borderRadius: '50px',
    cursor: 'pointer',
    textDecoration: 'none',
    boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)',
    transition: 'all 0.3s ease',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap'
  };

  const footerStyle = {
    position: 'absolute',
    bottom: '15px',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 'clamp(0.65rem, 2vw, 0.8rem)',
    textAlign: 'center',
    padding: '0 20px'
  };

  return (
    <div style={containerStyle}>

      {/* 3-dots menu */}
      <div
        style={menuBtnStyle}
        onClick={() => setMenuOpen(!menuOpen)}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 215, 0, 0.3)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)'; }}
        title="Menu"
      >
        <span style={dotStyle}></span>
        <span style={dotStyle}></span>
        <span style={dotStyle}></span>
      </div>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 25 }}
          />

          <div style={menuDropdownStyle}>
            <Link
              to="/admin-login"
              onClick={() => setMenuOpen(false)}
              style={menuItemStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
            >
              🔐 Access Admin Dashboard
            </Link>
            <Link
              to="/support"
              onClick={() => setMenuOpen(false)}
              style={menuItemStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
            >
              💬 Chat / Support
            </Link>
            <Link
              to="/purchase-form"
              onClick={() => setMenuOpen(false)}
              style={menuItemStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
            >
              📋 Form Purchase
            </Link>
          </div>
        </>
      )}

      <img
        src="/logo.png"
        alt="NAMTLS Logo"
        style={logoStyle}
        onError={(e) => { e.target.style.display = 'none'; }}
      />

      <h1 style={titleStyle}>
        <span style={titleLineStyle}>NAMTLS STUDENT</span>
        <span style={titleNoBreakStyle}>E-VOTING</span>
      </h1>

      <p style={subtitleStyle}>
        National Association of Maritime Transport and Logistics Students
      </p>

      <Link
        to="/student-login"
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.3)';
        }}
      >
        Student Login
      </Link>

      <p style={footerStyle}>
        &copy; {new Date().getFullYear()} NAMATLS FUPRE. All rights reserved.
      </p>

    </div>
  );
}