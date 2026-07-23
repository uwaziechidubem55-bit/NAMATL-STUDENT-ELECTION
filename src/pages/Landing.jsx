import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    requestAnimationFrame(() => setLoaded(true));
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
          borderRadius: '12px', zIndex: 20,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: '22px', fontWeight: 'bold',
          color: '#FFD700', transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.12)'; }}
        onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.06)'; }}>
        ⋮
      </button>

      {/* ===== DROPDOWN ===== */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 19 }} />
          <div style={{
            position: 'fixed', top: '80px', left: '24px', zIndex: 20,
            background: 'rgba(15,23,42,0.98)',
            backdropFilter: 'blur(20px)',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            minWidth: '220px', overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out',
          }}>
            <div onClick={() => { setMenuOpen(false); navigate('/admin-login'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', color: 'rgba(255,255,255,0.85)', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.08)'; }}
              onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}>
              🔒 Admin Login
            </div>
            <div onClick={() => { setMenuOpen(false); navigate('/purchase-form'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', color: 'rgba(255,255,255,0.85)', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.08)'; }}
              onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}>
              📋 Purchase Form
            </div>
            <div onClick={() => { setMenuOpen(false); navigate('/support'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', color: 'rgba(255,255,255,0.85)', fontSize: '14px', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.08)'; }}
              onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}>
              💬 Support
            </div>
            <div onClick={() => setMenuOpen(false)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 20px', color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.target.style.color = 'rgba(255,255,255,0.7)'; }}
              onMouseLeave={(e) => { e.target.style.color = 'rgba(255,255,255,0.4)'; }}>
              ✕ Close
            </div>
          </div>
        </>
      )}

      {/* ===== CENTRAL CONTENT ===== */}
      <div style={{ textAlign: 'center', zIndex: 1, padding: '20px' }}>
        {/* ROUND LOGO */}
        <img src="/logo.png" alt="NAMATL Official Logo"
          onError={(e) => { e.target.style.display = 'none'; }}
          style={{
            width: '110px', height: '110px',
            borderRadius: '50%',  /* ← ROUND */
            objectFit: 'cover',
            boxShadow: '0 12px 40px rgba(255,215,0,0.15)',
            marginBottom: '20px',
            background: 'rgba(255,255,255,0.05)',
            padding: '6px',
          }} />

        {/* BADGE */}
        <div style={{
          display: 'inline-block', padding: '5px 16px',
          background: 'rgba(255,215,0,0.1)',
          color: '#FFD700', borderRadius: '20px',
          fontSize: '11px', fontWeight: 600,
          letterSpacing: '0.5px', textTransform: 'uppercase',
          border: '1px solid rgba(255,215,0,0.15)',
          marginBottom: '14px',
        }}>
          🗳️ {year}/{year + 1} Election
        </div>

        {/* TITLE */}
        <h1 style={{
          fontSize: 'clamp(30px, 6vw, 52px)',
          fontWeight: 800, margin: '0 0 4px',
          letterSpacing: '-0.5px',
        }}>
          NAMATL STUDENT <span style={{ color: '#FFD700' }}>E-VOTING</span>
        </h1>

        {/* SUBTITLE */}
        <p style={{
          fontSize: 'clamp(13px, 2vw, 16px)',
          fontWeight: 300, color: 'rgba(255,255,255,0.6)',
          margin: '0 0 30px', lineHeight: 1.5,
        }}>
          National Association of Maritime Transport<br />and Logistics Students, FUPRE
        </p>

        {/* STUDENT LOGIN BUTTON ONLY */}
        <button onClick={() => navigate('/student-login')}
          style={{
            width: '100%', maxWidth: '260px',
            padding: '15px 0',
            background: 'linear-gradient(135deg, #FFD700 0%, #e6a800 100%)',
            color: '#061D3A',
            border: 'none', borderRadius: '14px',
            fontWeight: 700, fontSize: '16px',
            cursor: 'pointer',
            boxShadow: '0 8px 30px rgba(255,215,0,0.2)',
            transition: 'all 0.25s',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 12px 40px rgba(255,215,0,0.35)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 8px 30px rgba(255,215,0,0.2)';
          }}>
          🗳️ Student Login
        </button>

        {/* ALL RIGHTS RESERVED */}
        <p style={{
          marginTop: '28px',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.3px',
        }}>
          &copy; {year} NAMATL FUPRE. All rights reserved.
        </p>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}