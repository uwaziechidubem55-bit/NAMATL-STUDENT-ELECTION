import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>
      {/* 3 Dots Menu */}
      <div onClick={() => setMenuOpen(!menuOpen)} style={{ position: 'absolute', top: '20px', left: '20px', width: '44px', height: '44px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', zIndex: 20, background: menuOpen ? 'rgba(255,215,0,0.3)' : 'transparent', transition: 'background 0.3s ease', fontSize: '28px', fontWeight: '900', color: '#FFD700', lineHeight: '1', letterSpacing: '3px', userSelect: 'none' }}>
        ⋮
      </div>

      {menuOpen && (
        <div style={{ position: 'absolute', top: '70px', left: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', zIndex: 100, minWidth: '220px', overflow: 'hidden' }}>
          <Link to="/admin-dashboard" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', color: '#333', textDecoration: 'none', fontSize: '14px', fontWeight: '500', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
            onMouseEnter={e => e.target.style.background = '#f5f5f5'} onMouseLeave={e => e.target.style.background = 'white'}>
            🔒 Admin Dashboard
          </Link>
          <Link to="/purchase-form" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', color: '#333', textDecoration: 'none', fontSize: '14px', fontWeight: '500', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
            onMouseEnter={e => e.target.style.background = '#f5f5f5'} onMouseLeave={e => e.target.style.background = 'white'}>
            📋 Purchase Form (Candidates)
          </Link>
          <Link to="/support" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', color: '#333', textDecoration: 'none', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
            onMouseEnter={e => e.target.style.background = '#f5f5f5'} onMouseLeave={e => e.target.style.background = 'white'}>
            💬 Chat / Support
          </Link>
          <div onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', color: '#333', textDecoration: 'none', fontSize: '14px', fontWeight: '500', cursor: 'pointer', borderTop: '1px solid #f0f0f0' }}
            onMouseEnter={e => e.target.style.background = '#f5f5f5'} onMouseLeave={e => e.target.style.background = 'white'}>
            ✖️ Close
          </div>
        </div>
      )}

      <h1 style={{ fontSize: '32px', fontWeight: '800', margin: '8px 0', color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.3)', letterSpacing: '1px' }}>
        NAMATL STUDENT E-VOTING
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: '0 0 32px 0' }}>
        National Association of Maritime Transport and Logistics Students
      </p>
      <Link to="/student-login" style={{ display: 'inline-block', padding: '16px 48px', background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#1e293b', textDecoration: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '18px', boxShadow: '0 4px 15px rgba(255,215,0,0.3)', transition: 'all 0.3s ease' }}
        onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 20px rgba(255,215,0,0.5)'; }}
        onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 15px rgba(255,215,0,0.3)'; }}>
        🗳️ Student Login
      </Link>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', position: 'absolute', bottom: '20px' }}>
        © NAMATL {new Date().getFullYear()}. All rights reserved.
      </p>
    </div>
  );
}