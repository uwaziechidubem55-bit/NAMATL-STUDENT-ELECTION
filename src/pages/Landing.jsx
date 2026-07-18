import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #003366 0%, #001a33 100%)', color: 'white', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px', position: 'relative' }}>
      {/* Hamburger Menu */}
      <div onClick={() => setMenuOpen(!menuOpen)} style={{ position: 'absolute', top: '15px', left: '15px', width: '42px', height: '42px', background: menuOpen ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 215, 0, 0.15)', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px solid #FFD700', cursor: 'pointer', zIndex: 20, gap: '4px', padding: '10px', transition: 'background 0.3s ease' }}>
        <span style={{ width: '20px', height: '2px', background: '#FFD700', borderRadius: '2px', display: 'block' }}></span>
        <span style={{ width: '20px', height: '2px', background: '#FFD700', borderRadius: '2px', display: 'block' }}></span>
        <span style={{ width: '20px', height: '2px', background: '#FFD700', borderRadius: '2px', display: 'block' }}></span>
      </div>

      {menuOpen && (
        <div style={{ position: 'absolute', top: '65px', left: '15px', background: 'white', borderRadius: '8px', boxShadow: '0 8px 25px rgba(0,0,0,0.2)', zIndex: 20, minWidth: '220px', overflow: 'hidden' }}>
          <Link to="/admin" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', color: '#333', textDecoration: 'none', fontSize: '14px', fontWeight: '500', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }} onMouseEnter={(e) => e.target.style.background = '#f5f5f5'} onMouseLeave={(e) => e.target.style.background = 'white'}>
            ⚙️ Access Admin Dashboard
          </Link>
          <Link to="/support" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', color: '#333', textDecoration: 'none', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onMouseEnter={(e) => e.target.style.background = '#f5f5f5'} onMouseLeave={(e) => e.target.style.background = 'white'}>
            💬 Chat / Support
          </Link>
        </div>
      )}

      <div style={{ maxWidth: '600px' }}>
        {/* Logo Image */}
        <img src="/LOGO.jpg" alt="NAMTLS Logo" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', marginBottom: '16px', border: '3px solid #FFD700' }} onError={(e) => { e.target.style.display = 'none'; }} />

        <h1 style={{ fontSize: '36px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#ffd700' }}>NAMTLS STUDENT E-VOTING</h1>
        <p style={{ fontSize: '14px', margin: '0 0 24px 0', opacity: '0.8' }}>National Association of Maritime Transport and Logistics Students</p>

        <Link to="/student-login" style={{ display: 'inline-block', padding: '14px 40px', background: 'linear-gradient(135deg, #FFD700 0%, #F0C000 100%)', color: '#003366', textDecoration: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)', transition: 'transform 0.2s, box-shadow 0.2s', marginBottom: '40px' }} onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.5)'; }} onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.3)'; }}>
          Student Login
        </Link>

        <p style={{ fontSize: '12px', opacity: '0.5', marginTop: '40px' }}>2026 NAMATLS FUPRE. All rights reserved.</p>
      </div>
    </div>
  );
}