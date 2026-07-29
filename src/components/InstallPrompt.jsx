import React, { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevents the browser's default bar layout from popping up out of context
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`NAMATL App installation preference: ${outcome}`);
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#ffffff',
      padding: '16px 20px',
      borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
      zIndex: 99999,
      width: '90%',
      maxWidth: '420px',
      fontFamily: 'Arial, sans-serif',
      border: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <img src="/logo.png" alt="NAMATL Logo" style={{ width: '42px', height: '42px', objectFit: 'contain' }} />
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, color: '#003366', fontSize: '15px', fontWeight: '700' }}>Install Official Portal</h4>
          <p style={{ margin: '4px 0 0 0', color: '#4a5568', fontSize: '13px', lineHeight: '1.4' }}>
            Download the NAMTLS portal directly to your device for a stable voting connection.
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button 
          onClick={() => setIsVisible(false)}
          style={{
            background: 'transparent',
            color: '#718096',
            border: 'none',
            padding: '8px 14px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600'
          }}
        >
          Dismiss
        </button>
        <button 
          onClick={handleInstallClick}
          style={{
            background: '#003366', // Matches portal brand color
            color: '#ffffff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: '0 2px 4px rgba(0,51,102,0.2)'
          }}
        >
          Install App
        </button>
      </div>
    </div>
  );
}
