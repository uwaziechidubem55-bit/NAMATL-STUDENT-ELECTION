import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#003366',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, sans-serif',
      position: 'relative',
    }}>
      {/* ===== 3 DOTS - TOP LEFT WITH CIRCLE ===== */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '2px solid rgba(255,215,0,0.5)',
          background: menuOpen ? 'rgba(255,215,0,0.15)' : 'transparent',
          cursor: 'pointer',
          color: '#FFD700',
          fontSize: '22px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
          transition: 'all 0.3s',
        }}
        onMouseEnter={(e) => { if (!menuOpen) e.target.style.background = 'rgba(255,215,0,0.08)'; }}
        onMouseLeave={(e) => { if (!menuOpen) e.target.style.background = 'transparent'; }}
      >
        ⋮
      </button>

      {/* ===== DROPDOWN - NO BOX/CONTAINER, ITEMS DROP DIRECTLY ===== */}
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 19 }}
          />
          <div style={{
            position: 'absolute',
            top: '76px',
            right: '24px',
            zIndex: 20,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '10px',
            minWidth: '180px',
            overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}>
            <button
              onClick={() => { setMenuOpen(false); navigate('/admin-login'); }}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                color: '#f1f5f9',
                fontSize: '14px',
                fontWeight: 500,
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.1)'; e.target.style.paddingLeft = '26px'; }}
              onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.paddingLeft = '20px'; }}
            >
              🔒 Admin Login
            </button>
            <button
              onClick={() => { setMenuOpen(false); navigate('/support'); }}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                color: '#f1f5f9',
                fontSize: '14px',
                fontWeight: 500,
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.1)'; e.target.style.paddingLeft = '26px'; }}
              onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.paddingLeft = '20px'; }}
            >
              💬 Support
            </button>
            <button
              onClick={() => { setMenuOpen(false); navigate('/purchase-form'); }}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                color: '#f1f5f9',
                fontSize: '14px',
                fontWeight: 500,
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.1)'; e.target.style.paddingLeft = '26px'; }}
              onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.paddingLeft = '20px'; }}
            >
              📋 Form Purchase
            </button>
            <button
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 20px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: '13px',
                fontWeight: 500,
                textAlign: 'center',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.target.style.color = '#f1f5f9'; e.target.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { e.target.style.color = '#94a3b8'; e.target.style.background = 'transparent'; }}
            >
              ✕ Cancel
            </button>
          </div>
        </>
      )}

      {/* ===== CENTRAL CONTENT ===== */}
      <div style={{ textAlign: 'center' }}>
        {/* Logo with gold border */}
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          border: '3px solid #FFD700',
          margin: '0 auto 20px',
          overflow: 'hidden',
          background: '#0a1628',
          boxShadow: '0 0 25px rgba(255,215,0,0.15)',
        }}>
          <img
            src="/logo.png"
            alt="NAMATL Logo"
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>

        {/* NAMATL STUDENT E-VOTING in YELLOW (FIRST) */}
        <h1 style={{
          color: '#FFD700',
          fontSize: '30px',
          fontWeight: 700,
          margin: '0 0 4px',
          letterSpacing: '2px',
          lineHeight: 1.1,
        }}>
          NAMATL STUDENT
        </h1>
        <h1 style={{
          color: '#FFD700',
          fontSize: '30px',
          fontWeight: 700,
          margin: '0 0 12px',
          letterSpacing: '2px',
        }}>
          E-VOTING
        </h1>

        {/* Association name in WHITE (SECOND - BELOW) */}
        <h2 style={{
          color: '#ffffff',
          fontSize: '13px',
          fontWeight: 500,
          margin: '0 0 32px',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>
          NATIONAL ASSOCIATION OF MARITIME TRANSPORT
          <br />
          AND LOGISTIC STUDENTS
        </h2>

        {/* Student Login Button */}
        <button
          onClick={() => navigate('/student-login')}
          style={{
            width: '100%',
            maxWidth: '260px',
            padding: '14px 0',
            background: 'linear-gradient(135deg, #FFD700 0%, #e6a800 100%)',
            color: '#061D3A',
            border: 'none',
            fontWeight: 700,
            fontSize: '16px',
            cursor: 'pointer',
            boxShadow: '0 6px 25px rgba(255,215,0,0.2)',
            transition: 'all 0.3s',
            letterSpacing: '0.5px',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 10px 35px rgba(255,215,0,0.35)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 6px 25px rgba(255,215,0,0.2)';
          }}
        >
           Student Login
        </button>

        {/* Footer */}
        <p style={{ color: '#475569', fontSize: '11px', marginTop: '40px' }}>
          © {year} NAMATL FUPRE. All rights reserved.
        </p>
      </div>
    </div>
  );
}