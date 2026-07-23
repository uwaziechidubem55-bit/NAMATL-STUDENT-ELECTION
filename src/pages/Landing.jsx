import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setLoaded(true));
  }, []);

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0A2342',
      fontFamily: 'system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      opacity: loaded ? 1 : 0,
      transition: 'opacity 0.5s ease'
    }}>
      {/* ===== 3 DOTS MENU — TOP LEFT ===== */}
      <div
        onClick={() => setMenuOpen(!menuOpen)}
        style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          width: '44px',
          height: '44px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          zIndex: 20,
          background: menuOpen ? 'rgba(255,193,7,0.2)' : 'transparent',
          transition: 'background 0.3s ease',
          fontSize: '28px',
          fontWeight: '900',
          color: '#FFC107',
          lineHeight: '1',
          letterSpacing: '3px',
          userSelect: 'none'
        }}
      >
        ⋮
      </div>

      {/* ===== DROPDOWN MENU ===== */}
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 19,
              background: 'transparent'
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '76px',
              left: '20px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              zIndex: 100,
              minWidth: '230px',
              overflow: 'hidden'
            }}
          >
            <Link to="/admin-dashboard" onClick={() => setMenuOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', color: '#333', textDecoration: 'none', fontSize: '14px', fontWeight: '500', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
              onMouseEnter={e => e.target.style.background = '#f5f5f5'}
              onMouseLeave={e => e.target.style.background = 'white'}>
              🔒 Admin Dashboard
            </Link>
            <Link to="/purchase-form" onClick={() => setMenuOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', color: '#333', textDecoration: 'none', fontSize: '14px', fontWeight: '500', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
              onMouseEnter={e => e.target.style.background = '#f5f5f5'}
              onMouseLeave={e => e.target.style.background = 'white'}>
              📋 Purchase Form (Candidates)
            </Link>
            <Link to="/support" onClick={() => setMenuOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', color: '#333', textDecoration: 'none', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
              onMouseEnter={e => e.target.style.background = '#f5f5f5'}
              onMouseLeave={e => e.target.style.background = 'white'}>
              💬 Chat / Support
            </Link>
            <div onClick={() => setMenuOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', color: '#333', textDecoration: 'none', fontSize: '14px', fontWeight: '500', cursor: 'pointer', borderTop: '1px solid #f0f0f0' }}
              onMouseEnter={e => e.target.style.background = '#f5f5f5'}
              onMouseLeave={e => e.target.style.background = 'white'}>
              ✖️ Close
            </div>
          </div>
        </>
      )}

      {/* ===== LOGO ===== */}
      <img
        src="https://raw.githubusercontent.com/logo.png?v=2"
        alt="NAMTLS Logo"
        onError={e => { e.target.style.display = 'none'; }}
        style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          border: '3px solid #FFC107',
          objectFit: 'cover',
          marginBottom: '16px',
          boxShadow: '0 0 30px rgba(255,193,7,0.3)',
          display: 'block'
        }}
      />

      {/* ===== MAIN TITLE ===== */}
      <h1
        style={{
          fontSize: '32px',
          fontWeight: '900',
          margin: '0',
          color: '#FFC107',
          textAlign: 'center',
          lineHeight: '1.2',
          letterSpacing: '2px',
          textShadow: '0 2px 15px rgba(255,193,7,0.3)'
        }}
      >
        NAMATL STUDENT
        <br />
        E-VOTING
      </h1>

      {/* ===== SUBTITLE ===== */}
      <p
        style={{
          color: '#FFFFFF',
          fontSize: '14px',
          margin: '10px 0 30px 0',
          textAlign: 'center',
          lineHeight: '1.4',
          opacity: 0.85,
          maxWidth: '280px'
        }}
      >
        National Association of Maritime Transport and Logistics Students
      </p>

      {/* ===== STUDENT LOGIN BUTTON ===== */}
      <Link
        to="/student-login"
        style={{
          display: 'inline-block',
          padding: '15px 50px',
          background: '#FFC107',
          color: '#0A2342',
          textDecoration: 'none',
          borderRadius: '50px',
          fontWeight: 'bold',
          fontSize: '18px',
          letterSpacing: '0.5px',
          boxShadow: '0 4px 20px rgba(255,193,7,0.35)',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={e => {
          e.target.style.transform = 'translateY(-3px)';
          e.target.style.boxShadow = '0 8px 30px rgba(255,193,7,0.5)';
        }}
        onMouseLeave={e => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 4px 20px rgba(255,193,7,0.35)';
        }}
      >
        🗳️ Student Login
      </Link>

      {/* ===== FOOTER ===== */}
      <p
        style={{
          color: 'rgba(255,255,255,0.25)',
          fontSize: '11px',
          position: 'absolute',
          bottom: '18px',
          margin: 0,
          letterSpacing: '0.5px'
        }}
      >
        © NAMATL {new Date().getFullYear()}. All rights reserved.
      </p>
    </div>
  );
}