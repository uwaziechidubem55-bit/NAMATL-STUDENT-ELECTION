import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    requestAnimationFrame(() => {});
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1628 0%, #061D3A 50%, #003366 100%)',
      color: 'white',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: '20px',
      boxSizing: 'border-box',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-10%',
        width: '500px', height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,215,0,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', left: '-10%',
        width: '400px', height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,215,0,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ===== 3 DOTS MENU ===== */}
      <button onClick={() => setMenuOpen(!menuOpen)}
        style={{
          position: 'absolute', top: '24px', left: '24px',
          width: '44px', height: '44px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: menuOpen ? '0px' : '12px',
          zIndex: 20, transition: 'all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
          background: menuOpen ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.06)',
          border: menuOpen ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.08)',
          fontSize: '22px', fontWeight: 'bold',
          color: '#FFD700',
        }}
        onMouseEnter={(e) => { if (!menuOpen) e.target.style.background = 'rgba(255,255,255,0.12)'; }}
        onMouseLeave={(e) => { if (!menuOpen) e.target.style.background = 'rgba(255,255,255,0.06)'; }}>
        <span style={{ transform: menuOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)' }}>⋮</span>
      </button>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 19 }} />
          <div style={{
            position: 'fixed', top: '80px', left: '24px', zIndex: 20,
            background: 'rgba(15,23,42,0.98)',
            backdropFilter: 'blur(20px)',
            borderRadius: '0px',
            border: '2px solid #FFD700',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            minWidth: '220px', overflow: 'hidden',
          }}>
            <div onClick={() => { setMenuOpen(false); navigate('/admin-login'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', color: 'rgba(255,255,255,0.85)', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid rgba(255,215,0,0.15)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.12)'; e.target.style.paddingLeft = '28px'; }}
              onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.paddingLeft = '20px'; }}>
              <span style={{ fontSize: '16px' }}>🔒</span> Admin Login
            </div>
            <div onClick={() => { setMenuOpen(false); navigate('/purchase-form'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', color: 'rgba(255,255,255,0.85)', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid rgba(255,215,0,0.15)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.12)'; e.target.style.paddingLeft = '28px'; }}
              onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.paddingLeft = '20px'; }}>
              <span style={{ fontSize: '16px' }}>📋</span> Purchase Form
            </div>
            <div onClick={() => { setMenuOpen(false); navigate('/support'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', color: 'rgba(255,255,255,0.85)', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid rgba(255,215,0,0.15)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.12)'; e.target.style.paddingLeft = '28px'; }}
              onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.paddingLeft = '20px'; }}>
              <span style={{ fontSize: '16px' }}>💬</span> Support
            </div>
            <div onClick={() => setMenuOpen(false)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 20px', color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', borderTop: '1px solid rgba(255,215,0,0.1)' }}
              onMouseEnter={(e) => { e.target.style.color = 'rgba(255,255,255,0.7)'; e.target.style.background = 'rgba(255,215,0,0.05)'; }}
              onMouseLeave={(e) => { e.target.style.color = 'rgba(255,255,255,0.4)'; e.target.style.background = 'transparent'; }}>
              ✕ Close
            </div>
          </div>
        </>
      )}

      {/* ===== CENTRAL CONTENT ===== */}
      <div style={{
        textAlign: 'center',
        zIndex: 1,
        padding: '20px',
        width: '100%',
        maxWidth: '500px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* ROUND LOGO WITH GOLD BORDER RING */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '24px',
        }}>
          <div style={{
            width: '130px',
            height: '130px',
            borderRadius: '50%',
            padding: '5px',
            background: 'linear-gradient(135deg, #FFD700 0%, #e6a800 50%, #FFD700 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 30px rgba(255,215,0,0.25), 0 0 60px rgba(255,215,0,0.1)',
          }}>
            <img src="/logo.png" alt="NAMATL Official Logo"
              onError={(e) => { e.target.style.display = 'none'; }}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                objectFit: 'cover',
                background: '#0a1628',
              }} />
          </div>
        </div>

        {/* ===== TITLE — SINGLE LINE, ALL GOLD, NO BREAK ===== */}
        <h1 style={{
          fontSize: 'clamp(26px, 7vw, 48px)',
          fontWeight: 800,
          margin: '0 0 6px',
          letterSpacing: '-0.5px',
          color: '#FFD700',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',          /* ← FORCES ONE LINE */
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '90vw',
        }}>
          NAMATL STUDENT E-VOTING
        </h1>

        {/* SUBTITLE */}
        <p style={{
          fontSize: 'clamp(12px, 2.5vw, 15px)',
          fontWeight: 300,
          color: 'rgba(255,255,255,0.55)',
          margin: '0 0 32px',
          lineHeight: 1.6,
          maxWidth: '400px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          National Association of Maritime Transport<br />and Logistics Students, FUPRE
        </p>

        {/* STUDENT LOGIN BUTTON */}
        <button onClick={() => navigate('/student-login')}
          style={{
            width: '100%',
            maxWidth: '280px',
            padding: '16px 0',
            background: 'linear-gradient(135deg, #FFD700 0%, #e6a800 100%)',
            color: '#061D3A',
            border: 'none',
            borderRadius: '0px',
            fontWeight: 700,
            fontSize: '16px',
            cursor: 'pointer',
            boxShadow: '0 8px 30px rgba(255,215,0,0.2)',
            transition: 'all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
            letterSpacing: '0.5px',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-3px)';
            e.target.style.boxShadow = '0 14px 40px rgba(255,215,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 8px 30px rgba(255,215,0,0.2)';
          }}>
          🗳️ Student Login
        </button>

        {/* ALL RIGHTS RESERVED */}
        <p style={{
          marginTop: '32px',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: '0.3px',
        }}>
          &copy; {year} NAMATL FUPRE. All rights reserved.
        </p>
      </div>
    </div>
  );
}