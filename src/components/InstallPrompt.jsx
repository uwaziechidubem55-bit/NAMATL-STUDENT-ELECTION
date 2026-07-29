import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Close button */}
        <button
          onClick={handleDismiss}
          style={styles.closeBtn}
          aria-label="Dismiss"
        >
          ×
        </button>

        {/* Content */}
        <div style={styles.contentRow}>
          <img
            src="/logo.png"
            alt="NAMATL"
            style={styles.logo}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div style={styles.textBlock}>
            <h3 style={styles.title}>Install NAMATL Portal</h3>
            <p style={styles.subtitle}>
              Get the app for faster voting, offline access & instant updates.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button onClick={handleDismiss} style={styles.secondaryBtn}>
            Maybe Later
          </button>
          <button style={styles.primaryBtn}>
            Install App
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    animation: 'slideUp 0.4s ease-out',
    width: 'calc(100% - 32px)',
    maxWidth: '420px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18)',
    padding: '20px',
    position: 'relative',
    border: '1px solid rgba(0, 0, 0, 0.06)',
  },
  closeBtn: {
    position: 'absolute',
    top: '8px',
    right: '12px',
    background: 'none',
    border: 'none',
    fontSize: '22px',
    color: '#999',
    cursor: 'pointer',
    lineHeight: 1,
    padding: '4px 8px',
    borderRadius: '50%',
    transition: 'background 0.2s',
  },
  contentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '16px',
    marginTop: '4px',
  },
  logo: {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    objectFit: 'cover',
    flexShrink: 0,
    border: '2px solid #003366',
  },
  textBlock: {
    flex: 1,
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#003366',
    lineHeight: '1.3',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#666',
    lineHeight: '1.4',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
  },
  secondaryBtn: {
    padding: '10px 18px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    background: '#f5f5f5',
    color: '#555',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  primaryBtn: {
    padding: '10px 22px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #003366, #004080)',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 51, 102, 0.3)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
};