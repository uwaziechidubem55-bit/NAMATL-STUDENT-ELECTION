import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setLoaded(true));
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #061D3A 0%, #0A2B52 40%, #0F3A6A 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        fontFamily: 'Arial, Helvetica, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* 3 DOTS MENU BUTTON */}
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
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          zIndex: 20,
          background: 'rgba(255, 255, 255, 0.08)',
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#FFC107',
          userSelect: 'none',
        }}
      >
        ⋮
      </div>

      {/* DROPDOWN NAV MENU */}
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 19,
              background: 'transparent',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '72px',
              left: '20px',
              width: '220px',
              background: '#FFFFFF',
              borderRadius: '12px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              zIndex: 20,
              overflow: 'hidden',
            }}
          >
            <div
              onClick={() => {
                setMenuOpen(false);
                navigate('/admin-login');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '18px 20px',
                color: '#1A202C',
                fontSize: '15px',
                fontWeight: '500',
                borderBottom: '1px solid #EDF2F7',
                cursor: 'pointer',
              }}
            >
              🔒 Admin Login
            </div>
            <div
              onClick={() => {
                setMenuOpen(false);
                navigate('/purchase-form');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '18px 20px',
                color: '#1A202C',
                fontSize: '15px',
                fontWeight: '500',
                borderBottom: '1px solid #EDF2F7',
                cursor: 'pointer',
              }}
            >
              📋 Purchase Form (Candidates)
            </div>
            <div
              onClick={() => {
                setMenuOpen(false);
                navigate('/support');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '18px 20px',
                color: '#1A202C',
                fontSize: '15px',
                fontWeight: '500',
                borderBottom: '1px solid #EDF2F7',
                cursor: 'pointer',
              }}
            >
              💬 Chat / Support
            </div>
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '18px 20px',
                color: '#1A202C',
                fontSize: '15px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              ❌ Close
            </div>
          </div>
        </>
      )}

      {/* CENTRAL CONTENT WRAPPER */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '20px',
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.8s ease, transform 0.8s ease',
        }}
      >
        {/* LOGO — uses JSX img tag with correct public path */}
        <img
          src="/logo.png"
          alt="NAMTLS Official Logo"
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            border: '3px solid #FFC107',
            objectFit: 'cover',
            marginBottom: '20px',
            boxShadow: '0 0 25px rgba(255,193,7,0.25)',
          }}
        />

        {/* TITLE */}
        <h1
          style={{
            color: '#FFC107',
            fontSize: '28px',
            fontWeight: 'bold',
            margin: '0 0 4px 0',
            letterSpacing: '1px',
          }}
        >
          NAMTLS STUDENT
        </h1>
        <h2
          style={{
            color: '#FFFFFF',
            fontSize: '22px',
            fontWeight: 'bold',
            margin: '0 0 12px 0',
            letterSpacing: '2px',
          }}
        >
          E-VOTING
        </h2>
        <p
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            lineHeight: '1.6',
            margin: '0 0 32px 0',
            maxWidth: '280px',
          }}
        >
          National Association of Maritime Transport and
          Logistics Students
        </p>

        {/* STUDENT LOGIN BUTTON */}
        <button
          onClick={() => navigate('/student-login')}
          style={{
            width: '100%',
            maxWidth: '260px',
            padding: '14px 0',
            background: '#FFC107',
            color: '#061D3A',
            border: 'none',
            borderRadius: '24px',
            fontWeight: '700',
            fontSize: '16px',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.03)';
            e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.15)';
          }}
        >
          Student Login
        </button>
      </div>
    </div>
  );
}