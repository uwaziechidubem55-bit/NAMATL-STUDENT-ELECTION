import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #003366 0%, #001a33 100%)',
      color: 'white', fontFamily: 'Arial, sans-serif',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '32px', position: 'relative',
      opacity: visible ? 1 : 0, transition: 'opacity 0.8s ease-in-out'
    }}>
      {/* 3 Dots Menu (⋮) */}
      <div
        onClick={() => setMenuOpen(!menuOpen)}
        style={{
          position: 'absolute', top: '20px', right: '20px',
          width: '42px', height: '42px', cursor: 'pointer',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', zIndex: 20,
          background: menuOpen ? 'rgba(255,215,0,0.3)' : 'transparent',
          transition: 'background 0.3s ease', gap: '6px',
          fontSize: '24px', fontWeight: 'bold', color: '#FFD700',
          lineHeight: '1', letterSpacing: '2px'
        }}
      >
        ⋮
      </div>

      {menuOpen && (
        <div style={{
          position: 'absolute', top: '70px', right: '20px',
          background: 'white', borderRadius: '8px',
          boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
          zIndex: 20, minWidth: '220px', overflow: 'hidden'
        }}>
          <Link to="/admin" onClick={() => setMenuOpen(false)} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 18px', color: '#333', textDecoration: 'none',
            fontSize: '14px', fontWeight: '500',
            borderBottom: '1px solid #f0f0f0', cursor: 'pointer'
          }} onMouseEnter={e => e.target.style.background = '#f5f5f5'}
             onMouseLeave={e => e.target.style.background = 'white'}>
            🔒 Admin Dashboard
          </Link>
          <Link to="/support" onClick={() => setMenuOpen(false)} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 18px', color: '#333', textDecoration: 'none',
            fontSize: '14px', fontWeight: '500', cursor: 'pointer'
          }} onMouseEnter={e => e.target.style.background = '#f5f5f5'}
             onMouseLeave={e => e.target.style.background = 'white'}>
            💬 Chat / Support
          </Link>
          <div onClick={() => setMenuOpen(false)} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 18px', color: '#333', textDecoration: 'none',
            fontSize: '14px', fontWeight: '500', cursor: 'pointer'
          }} onMouseEnter={e => e.target.style.background = '#f5f5f5'}
             onMouseLeave={e => e.target.style.background = 'white'}>
            ✖️ Close
          </div>
        </div>
      )}

      <div style={{ maxWidth: '600px' }}>
        {/* Logo */}
        <img
          src="/LOGO.jpg"
          alt="NAMTLS Logo"
          style={{
            width: '120px', height: '120px', borderRadius: '50%',
            objectFit: 'cover', marginBottom: '16px',
            border: '3px solid #FFD700', display: 'block',
            marginLeft: 'auto', marginRight: 'auto'
          }}
          onError={e => { e.target.style.display = 'none'; }}
        />

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(24px, 5vw, 40px)', fontWeight: 'bold',
          margin: '0 0 8px 0', color: '#ffd700', lineHeight: '1.2'
        }}>
          NAMTLS STUDENT E-VOTING
        </h1>

        {/* Welcome Tagline */}
        <p style={{
          fontSize: '16px', margin: '0 0 8px 0', opacity: '0.9',
          fontWeight: '500'
        }}>
          Secure. Fast. Transparent Student Voting
        </p>

        {/* Subtext */}
        <p style={{
          fontSize: '13px', margin: '0 0 32px 0', opacity: '0.6'
        }}>
          National Association of Maritime Transport and Logistics Students
        </p>

        {/* Student Login Button */}
        <Link to="/student-login" style={{
          display: 'inline-block', padding: '14px 40px',
          background: 'linear-gradient(135deg, #FFD700 0%, #F0C000 100%)',
          color: '#003366', textDecoration: 'none',
          borderRadius: '50px', fontWeight: 'bold', fontSize: '16px',
          boxShadow: '0 4px 15px rgba(255,215,0,0.3)',
          transition: 'transform 0.2s, box-shadow 0.2s'
        }} onMouseEnter={e => {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 6px 20px rgba(255,215,0,0.5)';
        }} onMouseLeave={e => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 4px 15px rgba(255,215,0,0.3)';
        }}>
          Student Login
        </Link>

        {/* Footer */}
        <p style={{ fontSize: '12px', opacity: '0.4', marginTop: '60px' }}>
          © NAMTLS {new Date().getFullYear()}. All rights reserved.
        </p>
      </div>
    </div>
  );
}