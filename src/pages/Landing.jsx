import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #003366 0%, #004080 50%, #003366 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      position: 'relative',
      padding: '20px'
    }}>
      <div
        onClick={() => setMenuOpen(!menuOpen)}
        style={{
          position: 'absolute', top: '15px', left: '15px',
          width: '42px', height: '42px',
          background: menuOpen ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 215, 0, 0.15)',
          borderRadius: '50%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          border: '2px solid #FFD700', cursor: 'pointer', zIndex: 20, gap: '4px', padding: '10px',
          transition: 'background 0.3s ease'
        }}
      >
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#FFD700', display: 'block' }}></span>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#FFD700', display: 'block' }}></span>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#FFD700', display: 'block' }}></span>
      </div>

      {menuOpen && (
        <div style={{
          position: 'absolute', top: '65px', left: '15px',
          background: 'white', borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 30,
          minWidth: '200px', overflow: 'hidden'
        }}>
          <Link to="/admin" onClick={() => setMenuOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 18px', color: '#333', textDecoration: 'none',
              fontSize: '14px', fontWeight: '500',
              borderBottom: '1px solid #f0f0f0', cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.target.style.background = 'white'}
          >
            Access Admin Dashboard
          </Link>
          <Link to="/support" onClick={() => setMenuOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 18px', color: '#333', textDecoration: 'none',
              fontSize: '14px', fontWeight: '500', cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.target.style.background = 'white'}
          >
            Chat / Support
          </Link>
        </div>
      )}

      <h1 style={{
        fontWeight: 'bold', color: '#FFD700', textAlign: 'center',
        marginBottom: '8px', textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
        letterSpacing: '1px', fontSize: 'clamp(1.5rem, 6vw, 2.5rem)'
      }}>
        NAMTLS STUDENT E-VOTING
      </h1>

      <p style={{
        fontSize: 'clamp(0.8rem, 3vw, 1rem)', color: '#e0e0e0',
        textAlign: 'center', marginBottom: '35px', opacity: 0.9,
        maxWidth: '320px', padding: '0 10px'
      }}>
        National Association of Maritime Transport and Logistics Students
      </p>

      <Link to="/student-login"
        style={{
          padding: '14px 44px', fontSize: 'clamp(1rem, 4vw, 1.2rem)',
          fontWeight: 'bold', color: '#003366',
          background: 'linear-gradient(135deg, #FFD700, #FFC000)',
          border: 'none', borderRadius: '50px', cursor: 'pointer',
          textDecoration: 'none', boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)',
          transition: 'all 0.3s ease', letterSpacing: '0.5px', whiteSpace: 'nowrap'
        }}
        onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.5)'; }}
        onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.3)'; }}
      >
        Student Login
      </Link>

      <p style={{
        position: 'absolute', bottom: '15px',
        color: 'rgba(255,255,255,0.5)',
        fontSize: 'clamp(0.65rem, 2vw, 0.8rem)', textAlign: 'center'
      }}>
        2026 NAMATLS FUPRE. All rights reserved.
      </p>
    </div>
  );
}