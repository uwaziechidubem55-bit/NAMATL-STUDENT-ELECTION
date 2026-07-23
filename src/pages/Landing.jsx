import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [year] = useState(new Date().getFullYear());

  useEffect(() => {
    requestAnimationFrame(() => setLoaded(true));
  }, []);

  // ==================== STYLES ====================
  const styles = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1628 0%, #061D3A 40%, #003366 70%, #001a33 100%)',
      color: 'white',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      position: 'relative',
      overflow: 'hidden',
    },
    overlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'radial-gradient(circle at 20% 50%, rgba(255, 215, 0, 0.06) 0%, transparent 50%), radial-gradient(circle at 80% 30%, rgba(255, 215, 0, 0.04) 0%, transparent 50%)',
      pointerEvents: 'none',
      zIndex: 0,
    },
    floatingOrb: (delay, size, top, right) => ({
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,215,0,0.08) 0%, transparent 70%)',
      top,
      right,
      animation: `float 6s ease-in-out ${delay}s infinite`,
      pointerEvents: 'none',
      zIndex: 0,
    }),
    container: {
      position: 'relative',
      zIndex: 1,
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px 24px',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    },
    // Nav
    nav: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      marginBottom: '20px',
    },
    navLogo: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontWeight: 700,
      fontSize: '18px',
      color: '#FFD700',
    },
    navLogoImg: {
      width: '40px',
      height: '40px',
      borderRadius: '8px',
    },
    navLinks: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    },
    navBtn: {
      padding: '10px 20px',
      background: 'rgba(255,255,255,0.08)',
      color: 'white',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '10px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 500,
      transition: 'all 0.25s',
    },
    navBtnAdmin: {
      padding: '10px 20px',
      background: '#FFD700',
      color: '#061D3A',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 700,
      transition: 'all 0.25s',
    },
    // Hamburger
    hamburger: {
      width: '40px',
      height: '40px',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '5px',
      borderRadius: '10px',
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.1)',
      transition: 'all 0.2s',
    },
    hamburgerLine: {
      width: '20px',
      height: '2px',
      background: '#FFD700',
      borderRadius: '2px',
      transition: 'all 0.3s',
    },
    // Hero
    hero: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '40px 0',
    },
    heroLogo: {
      width: '120px',
      height: '120px',
      borderRadius: '20px',
      boxShadow: '0 20px 60px rgba(255,215,0,0.15)',
      marginBottom: '24px',
      transition: 'transform 0.3s',
      objectFit: 'contain',
      background: 'rgba(255,255,255,0.05)',
      padding: '12px',
    },
    heroBadge: {
      display: 'inline-block',
      padding: '6px 18px',
      background: 'rgba(255,215,0,0.12)',
      color: '#FFD700',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      marginBottom: '16px',
      border: '1px solid rgba(255,215,0,0.2)',
    },
    heroTitle: {
      fontSize: 'clamp(32px, 7vw, 64px)',
      fontWeight: 800,
      margin: '0 0 8px',
      lineHeight: 1.1,
      letterSpacing: '-1px',
    },
    heroTitleAccent: {
      color: '#FFD700',
    },
    heroSubtitle: {
      fontSize: 'clamp(16px, 2.5vw, 24px)',
      fontWeight: 300,
      margin: '0 0 12px',
      color: 'rgba(255,255,255,0.7)',
    },
    heroDesc: {
      fontSize: '14px',
      color: 'rgba(255,255,255,0.5)',
      maxWidth: '500px',
      margin: '0 0 36px',
      lineHeight: 1.6,
    },
    heroButtons: {
      display: 'flex',
      gap: '14px',
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    primaryBtn: {
      padding: '16px 40px',
      background: 'linear-gradient(135deg, #FFD700 0%, #e6a800 100%)',
      color: '#061D3A',
      border: 'none',
      borderRadius: '14px',
      fontWeight: 700,
      fontSize: '16px',
      cursor: 'pointer',
      boxShadow: '0 8px 30px rgba(255,215,0,0.25)',
      transition: 'all 0.25s',
      minWidth: '200px',
    },
    secondaryBtn: {
      padding: '16px 32px',
      background: 'rgba(255,255,255,0.06)',
      color: 'white',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '14px',
      fontWeight: 600,
      fontSize: '15px',
      cursor: 'pointer',
      transition: 'all 0.25s',
    },
    // Features
    features: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginTop: '40px',
      padding: '0 0 40px',
    },
    featureCard: {
      padding: '24px 20px',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.06)',
      textAlign: 'center',
      backdropFilter: 'blur(10px)',
      transition: 'all 0.3s',
    },
    featureIcon: {
      fontSize: '32px',
      marginBottom: '12px',
    },
    featureTitle: {
      fontSize: '14px',
      fontWeight: 600,
      margin: '0 0 6px',
    },
    featureDesc: {
      fontSize: '12px',
      color: 'rgba(255,255,255,0.5)',
      margin: 0,
      lineHeight: 1.5,
    },
    // Footer
    footer: {
      textAlign: 'center',
      padding: '20px 0',
      fontSize: '12px',
      color: 'rgba(255,255,255,0.3)',
      borderTop: '1px solid rgba(255,255,255,0.05)',
    },
    // Menu
    menuOverlay: {
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 19,
      background: 'transparent',
    },
    menuDropdown: {
      position: 'fixed',
      top: '80px',
      right: '24px',
      zIndex: 20,
      background: 'rgba(15, 23, 42, 0.97)',
      backdropFilter: 'blur(20px)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      minWidth: '240px',
      overflow: 'hidden',
      animation: 'fadeIn 0.2s ease-out',
    },
    menuItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      padding: '16px 20px',
      color: 'rgba(255,255,255,0.85)',
      fontSize: '14px',
      fontWeight: 500,
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    menuClose: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '16px 20px',
      color: 'rgba(255,255,255,0.4)',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
  };

  return (
    <div style={styles.page}>
      {/* Animated background orbs */}
      <div style={styles.overlay} />
      <div style={styles.floatingOrb(0, '400px', '-10%', '-10%')} />
      <div style={styles.floatingOrb(2, '300px', '60%', '-5%')} />
      <div style={styles.floatingOrb(4, '350px', '20%', '80%')} />

      {/* Inject keyframes */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
          opacity: 0;
        }
        .fade-in-up-delay-1 { animation-delay: 0.1s; }
        .fade-in-up-delay-2 { animation-delay: 0.3s; }
        .fade-in-up-delay-3 { animation-delay: 0.5s; }
        .fade-in-up-delay-4 { animation-delay: 0.7s; }
        @media (max-width: 640px) {
          .nav-desktop { display: none !important; }
        }
        @media (min-width: 641px) {
          .nav-mobile { display: none !important; }
        }
      `}</style>

      <div style={styles.container}>
        {/* ===== NAVIGATION ===== */}
        <nav style={styles.nav}>
          <div style={styles.navLogo}>
            <img src="/logo.png" alt="NAMATL" style={styles.navLogoImg}
              onError={(e) => { e.target.style.display = 'none'; }} />
            <span>NAMATL</span>
          </div>

          {/* Desktop Nav */}
          <div className="nav-desktop" style={styles.navLinks}>
            <button style={styles.navBtn}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.15)'; }}
              onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.08)'; }}
              onClick={() => navigate('/support')}>
              💬 Support
            </button>
            <button style={styles.navBtn}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.15)'; }}
              onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.08)'; }}
              onClick={() => navigate('/purchase-form')}>
              📋 Purchase Form
            </button>
            <button style={styles.navBtnAdmin}
              onMouseEnter={(e) => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 20px rgba(255,215,0,0.3)'; }}
              onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = 'none'; }}
              onClick={() => navigate('/admin-login')}>
              🔒 Admin
            </button>
          </div>

          {/* Mobile Hamburger */}
          <div className="nav-mobile">
            <button style={styles.hamburger}
              onClick={() => setMenuOpen(!menuOpen)}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.15)'; }}
              onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.08)'; }}>
              <div style={{ ...styles.hamburgerLine, transform: menuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
              <div style={{ ...styles.hamburgerLine, opacity: menuOpen ? 0 : 1 }} />
              <div style={{ ...styles.hamburgerLine, transform: menuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
            </button>
          </div>
        </nav>

        {/* ===== MOBILE MENU DROPDOWN ===== */}
        {menuOpen && (
          <>
            <div style={styles.menuOverlay} onClick={() => setMenuOpen(false)} />
            <div style={styles.menuDropdown}>
              <div style={styles.menuItem}
                onClick={() => { setMenuOpen(false); navigate('/admin-login'); }}
                onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.1)'; }}
                onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}>
                <span>🔒</span> Admin Login
              </div>
              <div style={styles.menuItem}
                onClick={() => { setMenuOpen(false); navigate('/purchase-form'); }}
                onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.1)'; }}
                onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}>
                <span>📋</span> Purchase Form (Candidates)
              </div>
              <div style={styles.menuItem}
                onClick={() => { setMenuOpen(false); navigate('/support'); }}
                onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.1)'; }}
                onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}>
                <span>💬</span> Chat / Support
              </div>
              <div style={styles.menuClose}
                onClick={() => setMenuOpen(false)}
                onMouseEnter={(e) => { e.target.style.color = 'rgba(255,255,255,0.7)'; }}
                onMouseLeave={(e) => { e.target.style.color = 'rgba(255,255,255,0.4)'; }}>
                ✕ Close
              </div>
            </div>
          </>
        )}

        {/* ===== HERO SECTION ===== */}
        <div style={styles.hero}>
          <div className="fade-in-up">
            <img src="/logo.png" alt="NAMATL Official Logo" style={styles.heroLogo}
              onError={(e) => { e.target.src = ''; e.target.style.display = 'none'; }} />
          </div>

          <div className="fade-in-up fade-in-up-delay-1">
            <span style={styles.heroBadge}>
              🗳️ {year}/{year + 1} Election Season
            </span>
          </div>

          <h1 className="fade-in-up fade-in-up-delay-2" style={styles.heroTitle}>
            NAMATL STUDENT <span style={styles.heroTitleAccent}>E-VOTING</span>
          </h1>

          <p className="fade-in-up fade-in-up-delay-2" style={styles.heroSubtitle}>
            National Association of Maritime Transport<br />and Logistics Students, FUPRE
          </p>

          <p className="fade-in-up fade-in-up-delay-3" style={styles.heroDesc}>
            Secure, transparent, and accessible — cast your vote from anywhere. 
            The official digital election platform for NAMATL FUPRE.
          </p>

          <div className="fade-in-up fade-in-up-delay-4" style={styles.heroButtons}>
            <button style={styles.primaryBtn}
              onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 40px rgba(255,215,0,0.35)'; }}
              onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 8px 30px rgba(255,215,0,0.25)'; }}
              onClick={() => navigate('/student-login')}>
              🗳️ Student Login
            </button>
            <button style={styles.secondaryBtn}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.12)'; e.target.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.06)'; e.target.style.transform = 'translateY(0)'; }}
              onClick={() => navigate('/purchase-form')}>
              📋 Purchase Form
            </button>
          </div>
        </div>

        {/* ===== FEATURES GRID ===== */}
        <div style={styles.features}>
          {[
            { icon: '🔒', title: 'Secure Voting', desc: 'End-to-end verified ballots with unique access keys for every student.' },
            { icon: '📱', title: 'Accessible Anywhere', desc: 'Vote from your phone, tablet, or computer — no physical presence needed.' },
            { icon: '⚡', title: 'Real-Time Results', desc: 'Live tallying and instant result generation with printable reports.' },
            { icon: '🎓', title: 'Built for FUPRE', desc: 'Tailored specifically for NAMATL student elections with matric-based authentication.' },
            { icon: '💰', title: 'Flutterwave Payments', desc: 'Secure form purchase and withdrawal processing via Flutterwave.' },
            { icon: '📊', title: 'Tenure System', desc: 'Multi-year support with academic year-based election cycles.' },
          ].map((feat, i) => (
            <div key={i} style={styles.featureCard}
              className="fade-in-up"
              style={{ ...styles.featureCard, animationDelay: `${0.9 + i * 0.1}s` }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(255,215,0,0.2)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
              <div style={styles.featureIcon}>{feat.icon}</div>
              <h3 style={styles.featureTitle}>{feat.title}</h3>
              <p style={styles.featureDesc}>{feat.desc}</p>
            </div>
          ))}
        </div>

        {/* ===== FOOTER ===== */}
        <footer style={styles.footer}>
          &copy; {year} NAMATL FUPRE. All rights reserved. &nbsp;|&nbsp; 
          Built with integrity for the students of Maritime Transport &amp; Logistics.
        </footer>
      </div>
    </div>
  );
}