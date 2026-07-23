import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setLoaded(true));
  }, []);

  // Authentic NAMTLS circular vector insignia badge data
  const namtlsLogoBase64 = "data:image/svg+xml;utf8,<svg xmlns='http://w3.org' viewBox='0 0 160 160'><circle cx='80' cy='80' r='75' fill='%230b2c56' stroke='%23ffc107' stroke-width='4'/><circle cx='80' cy='80' r='64' fill='none' stroke='%23ffc107' stroke-width='1' stroke-dasharray='3,3'/><path d='M80 30 L80 120 M55 55 L105 55 M50 90 Q80 125 110 90' fill='none' stroke='%23ffc107' stroke-width='5' stroke-linecap='round'/><polygon points='80,22 88,38 72,38' fill='%23ffc107'/><circle cx='80' cy='68' r='14' fill='none' stroke='%23ffc107' stroke-width='4'/><path d='M68 68 L92 68' stroke='%23ffc107' stroke-width='4'/><text x='80' y='142' font-family='sans-serif' font-size='8' font-weight='bold' fill='%23ffc107' text-anchor='middle' letter-spacing='1'>ELECTORAL COMMISSION</text></svg>";

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
      position: 'relative',
      overflow: 'hidden',
      opacity: loaded ? 1 : 0,
      transition: 'opacity 0.5s ease',
      boxSizing: 'border-box'
    }}>
      
      {/* ===== 3 DOTS MENU BUTTON ===== */}
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
          userSelect: 'none'
        }}
      >
        ⋮
      </div>

      {/* ===== DROPDOWN NAV MENU ===== */}
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
              top: '74px',
              left: '20px',
              background: '#ffffff',
              borderRadius: '16px', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
              zIndex: 100,
              width: '270px', 
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div 
              onClick={() => { setMenuOpen(false); navigate('/admin-login'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 20px', color: '#1A202C', fontSize: '15px', fontWeight: '500', borderBottom: '1px solid #EDF2F7', cursor: 'pointer' }}
            >
              🔒 Admin Dashboard
            </div>
            
            <div 
              onClick={() => { setMenuOpen(false); navigate('/purchase-form'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 20px', color: '#1A202C', fontSize: '15px', fontWeight: '500', borderBottom: '1px solid #EDF2F7', cursor: 'pointer' }}
            >
              📋 Purchase Form (Candidates)
            </div>

            <div 
              onClick={() => { setMenuOpen(false); navigate('/support'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 20px', color: '#1A202C', fontSize: '15px', fontWeight: '500', borderBottom: '1px solid #EDF2F7', cursor: 'pointer' }}
            >
              💬 Chat / Support
            </div>

            <div 
              onClick={() => setMenuOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 20px', color: '#1A202C', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}
            >
              ❌ Close
            </div>
          </div>
        </>
      )}

      {/* ===== CENTRAL CONTENT WRAPPER ===== */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '90%', maxWidth: '450px' }}>
        
        {/* ===== EMBEDDED LOGO EMBLEM ===== */}
        <div style={{
          width: '135px',
          height: '135px',
          borderRadius: '50%',
          border: '2.5px solid #FFC107',
          padding: '4px',
          boxSizing: 'border-box',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.02)',
          boxShadow: '0 0 20px rgba(255, 193, 7, 0.15)'
        }}>
          <img
            src=“logo.png?v=2”
            alt="NAMTAL Student official Logo"
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'contain' }}
          />
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px 0', color: '#FFC107', letterSpacing: '0.5px', lineHeight: '1.3' }}>
          NAMTLS STUDENT
          <br />
          E-VOTING
        </h1>

        <p style={{ color: '#FFFFFF', fontSize: '13px', margin: '0 0 40px 0', lineHeight: '1.5', opacity: 0.85, fontWeight: '400', padding: '0 10px' }}>
          National Association of Maritime Transport and
          <br />
          Logistics Students
        </p>

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
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)'
          }}
        >
          Student Login
        </button>
      </div>

    </div>
  );
}
