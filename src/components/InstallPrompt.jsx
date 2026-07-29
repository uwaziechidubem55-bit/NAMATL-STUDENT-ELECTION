import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Auto-dismiss after 8 seconds
    const timer = setTimeout(() => {
      setVisible(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div style={styles.bar}>
      <img
        src="/logo.png"
        alt="NAMATL"
        style={styles.logo}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
      <span style={styles.name}>NAMATL</span>
      <button style={styles.installBtn}>Install</button>
    </div>
  );
}

const styles = {
  bar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    background: '#ffffff',
    borderBottom: '1px solid #e0e0e0',
    boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
    animation: 'slideUp 0.35s ease-out',
  },
  logo: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    objectFit: 'cover',
    flexShrink: 0,
    border: '1px solid #003366',
  },
  name: {
    flex: 1,
    fontSize: '15px',
    fontWeight: '700',
    color: '#003366',
    letterSpacing: '0.3px',
  },
  installBtn: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: '8px',
    background: '#000000',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
};