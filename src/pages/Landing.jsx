import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Fade-in after mount — fixes view transition flash
  useEffect(() => {
    requestAnimationFrame(() => setLoaded(true));
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
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
      {/* ===== MENU ICON (3 DOTS) TOP-LEFT ===== */}
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
          {/* Overlay to close on tap */}
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
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
            <Link
              to="/admin-dashboard"
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                color: '#333',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '500',
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer'
              }}
              onMouseEnter={e => e.target.style.background = '#f5f5f5'}
              onMouseLeave={e => e.target.style.background = 'white'}
            >
              🔒 Admin Dashboard
            </Link>
            <Link
              to="/purchase-form"
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                color: '#333',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '500',
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer'
              }}
              onMouseEnter={e => e.target.style.background = '#f5f5f5'}
              onMouseLeave={e => e.target.style.background = 'white'}
            >
              📋 Purchase Form (Candidates)
            </Link>
            <Link
              to="/support"
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                color: '#333',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
              onMouseEnter={e => e.target.style.background = '#f5f5f5'}
              onMouseLeave={e => e.target.style.background = 'white'}
            >
              💬 Chat / Support
            </Link>
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                color: '#333',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                borderTop: '1px solid #f0f0f0'
              }}
              onMouseEnter={e => e.target.style.background = '#f5f5f5'}
              onMouseLeave={e => e.target.style.background = 'white'}
            >
              ✖️ Close
            </div>
          </div>
        </>
      )}

      {/* ===== SEAL / EMBLEM ===== */}
      <div
        style={{
          width: '130px',
          height: '130px',
          borderRadius: '50%',
          border: '3px solid #FFC107',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          background: '#0A2342',
          boxShadow: '0 0 30px rgba(255,193,7,0.3), 0 0 60px rgba(255,193,7,0.1)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Inner shield design */}
        <div
          style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            border: '2px solid #FFC107',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0D2B52'
          }}
        >
          {/* Crown */}
          <span style={{ fontSize: '22px', lineHeight: '1', marginBottom: '2px' }}>👑</span>
          {/* Anchor */}
          <span style={{ fontSize: '28px', lineHeight: '1', color: '#FFC107' }}>⚓</span>
          {/* Small text inside */}
          <span style={{ fontSize: '6px', color: '#FFC107', marginTop: '2px', lineHeight: '1.2', textAlign: 'center', fontWeight: 'bold' }}>
            NAMTLS
          </span>
        </div>

        {/* Circular border text — using a pseudo approach */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          {/* We use a simple decorative ring */}
          <svg viewBox="0 0 130 130" style={{ position: 'absolute', width: '130px', height: '130px' }}>
            <defs>
              <path id="circlePath" d="M 65 5 A 60 60 0 1 1 64.99 5" fill="none" />
            </defs>
            <text fontSize="5.5" fill="#FFC107" fontWeight="bold" letterSpacing="2">
              <textPath href="#circlePath" startOffset="5%">
                NATIONAL ASSOCIATION OF MARITIME TRANSPORT AND LOGISTICS
              </textPath>
            </text>
          </svg>
        </div>
      </div>

      {/* ===== MAIN TITLE ===== */}
      <h1
        style={{
          fontSize: '34px',
          fontWeight: '900',
          margin: '0',
          color: '#FFC107',
          textAlign: 'center',
          lineHeight: '1.2',
          letterSpacing: '2px',
          textShadow: '0 2px 15px rgba(255,193,7,0.3)'
        }}
      >
        NAMTLS STUDENT
        <br />
        E-VOTING
      </h1>

      {/* ===== SUBTITLE ===== */}
      <p
        style={{
          color: '#FFFFFF',
          fontSize: '14px',
          margin: '12px 0 36px 0',
          textAlign: 'center',
          lineHeight: '1.5',
          opacity: 0.85,
          maxWidth: '280px',
          fontWeight: '400'
        }}
      >
        National Association of Maritime Transport and Logistics Students
      </p>

      {/* ===== STUDENT LOGIN BUTTON ===== */}
      <Link
        to="/student-login"
        style={{
          display: 'inline-block',
          padding: '16px 56px',
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
          color: 'rgba(255,255,255,0.3)',
          fontSize: '11px',
          position: 'absolute',
          bottom: '20px',
          margin: 0,
          letterSpacing: '0.5px'
        }}
      >
        © NAMATL {new Date().getFullYear()}. All rights reserved.
      </p>
    </div>
  );
}