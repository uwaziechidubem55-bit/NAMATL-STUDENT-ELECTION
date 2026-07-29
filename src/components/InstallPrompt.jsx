import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <button onClick={() => setVisible(false)} style={styles.close}>×</button>
        <div style={styles.row}>
          <img
            src="/logo.png"
            alt="NAMATL"
            style={styles.logo}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span style={styles.name}>NAMATL</span>
        </div>
        <button style={styles.installBtn}>Install</button>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  card: {
    background: '#ffffff',
    borderRadius: '14px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
    padding: '16px 20px',
    width: '280px',
    marginTop: '80px',
    textAlign: 'center',
    border: '1px solid #e8e8e8',
    pointerEvents: 'auto',
    animation: 'fadeIn 0.3s ease-out',
    position: 'relative',
  },
  close: {
    position: 'absolute',
    top: '4px',
    right: '8px',
    background: 'none',
    border: 'none',
    fontSize: '20px',
    color: '#aaa',
    cursor: 'pointer',
    lineHeight: 1,
    padding: '2px 6px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  logo: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    objectFit: 'cover',
    border: '1px solid #003366',
  },
  name: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#003366',
  },
  installBtn: {
    padding: '8px 28px',
    border: 'none',
    borderRadius: '8px',
    background: '#000000',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    transition: 'transform 0.15s',
  },
};