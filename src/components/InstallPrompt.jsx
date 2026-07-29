import { useState, useEffect } from 'react';

// 🚨 Capture the event GLOBALLY before React mounts
let _deferredPrompt = null;
let _promptAvailable = false;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredPrompt = e;
  _promptAvailable = true;
});

window.addEventListener('appinstalled', () => {
  _deferredPrompt = null;
  _promptAvailable = false;
});

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(_deferredPrompt);
  const [visible, setVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideContent, setGuideContent] = useState(null);

  const getBrowserInfo = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
    const isFirefox = /Firefox/.test(ua);
    const isMac = navigator.platform === 'MacIntel' && !isIOS;
    return { isIOS, isSafari, isFirefox, isMac };
  };

  const getGuideContent = () => {
    const { isIOS, isSafari, isFirefox, isMac } = getBrowserInfo();

    if (isIOS || (isSafari && /iPhone|iPad|iPod/.test(navigator.userAgent))) {
      return {
        title: 'Install on iPhone / iPad',
        steps: [
          'Tap the Share button (square with arrow) at the bottom of the screen.',
          'Scroll down and tap "Add to Home Screen".',
          'Tap "Add" in the top-right corner.',
          'Find NAMATL on your home screen — it opens like a real app!'
        ],
        icon: '📱'
      };
    }

    if (isFirefox && /Android/.test(navigator.userAgent)) {
      return {
        title: 'Install on Firefox (Android)',
        steps: [
          'Tap the three-dot menu (⋮) in the top-right or bottom-right.',
          'Tap "Install" or "Add to Home Screen".',
          'Tap "Install" to confirm.',
          'Firefox will add NAMATL to your home screen.'
        ],
        icon: '🦊'
      };
    }

    if (isSafari && isMac) {
      return {
        title: 'Install on Safari (Mac)',
        steps: [
          'Click the Share button in the toolbar.',
          'Click "Add to Dock".',
          'NAMATL will appear as an app in your Dock.',
          'Click the Dock icon to open it like a native app!'
        ],
        icon: '🧭'
      };
    }

    if (isFirefox && isMac) {
      return {
        title: 'Install on Firefox (Mac)',
        steps: [
          'Firefox does not support full PWA installation on desktop.',
          'Click the menu (☰) → "Save Page As…" or bookmark this page.',
          'For the best experience, use Chrome or Edge to install this app.'
        ],
        icon: '🦊'
      };
    }

    return {
      title: 'Install NAMATL',
      steps: [
        'Click the "Install" button below.',
        'Click "Install" in the browser dialog that appears.',
        'NAMATL will be installed on your device.',
        'Open it anytime from your Start Menu / App Launcher!'
      ],
      icon: '🚀'
    };
  };

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches) {
      setIsInstalled(true);
      return;
    }

    // If the event already fired before React mounted, show immediately
    if (_promptAvailable && _deferredPrompt) {
      setDeferredPrompt(_deferredPrompt);
      setVisible(true);
      return;
    }

    // Fallback listener for late events (Chrome user engagement delay)
    const handler = (e) => {
      e.preventDefault();
      _deferredPrompt = e;
      _promptAvailable = true;
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Also listen for appinstalled after mount
    const installedHandler = () => {
      setIsInstalled(true);
      setVisible(false);
      setDeferredPrompt(null);
      _deferredPrompt = null;
      _promptAvailable = false;
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPrompt || _deferredPrompt;
    if (!prompt) return;

    const isNative = typeof prompt.prompt === 'function';

    try {
      if (isNative) {
        prompt.prompt();
        const result = await prompt.userChoice;
        if (result.outcome === 'accepted') {
          setIsInstalled(true);
          setVisible(false);
        }
      } else {
        setGuideContent(getGuideContent());
        setShowGuide(true);
      }
    } catch (err) {
      setGuideContent(getGuideContent());
      setShowGuide(true);
    }

    _deferredPrompt = null;
    _promptAvailable = false;
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    setShowGuide(false);
  };

  const closeGuide = () => {
    setShowGuide(false);
    setVisible(false);
  };

  if (isInstalled) return null;

  if (showGuide && guideContent) {
    return (
      <div style={styles.overlay}>
        <div style={styles.guideCard}>
          <button onClick={closeGuide} style={styles.closeBtn}>×</button>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>{guideContent.icon}</div>
          <h3 style={{ margin: '0 0 12px', color: '#003366' }}>{guideContent.title}</h3>
          <ol style={{ textAlign: 'left', fontSize: '14px', lineHeight: '1.8', color: '#333', paddingLeft: '20px', margin: '0 0 16px' }}>
            {guideContent.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <button onClick={closeGuide} style={styles.gotItBtn}>Got it</button>
        </div>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <button onClick={handleDismiss} style={styles.closeBtn}>×</button>
        <div style={styles.row}>
          <img src="/logo.png" alt="NAMATL" style={styles.logo} onError={(e) => { e.target.style.display = 'none'; }} />
          <span style={styles.name}>NAMATL Student Election</span>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#666' }}>
          Install this app on your device for the best experience
        </p>
        <button onClick={handleInstall} style={styles.installBtn}>
          Install App
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.3)',
    pointerEvents: 'auto',
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    padding: '24px 28px',
    width: '300px',
    maxWidth: '90vw',
    textAlign: 'center',
    position: 'relative',
    animation: 'fadeIn 0.3s ease-out',
  },
  guideCard: {
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    padding: '24px 28px',
    width: '320px',
    maxWidth: '90vw',
    textAlign: 'center',
    position: 'relative',
    animation: 'fadeIn 0.3s ease-out',
  },
  closeBtn: {
    position: 'absolute',
    top: '8px', right: '12px',
    background: 'none',
    border: 'none',
    fontSize: '22px',
    color: '#999',
    cursor: 'pointer',
    lineHeight: 1,
    padding: '4px 8px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  logo: {
    width: '40px', height: '40px',
    borderRadius: '10px',
    objectFit: 'cover',
    border: '1px solid #003366',
  },
  name: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#003366',
  },
  installBtn: {
    padding: '10px 32px',
    border: 'none',
    borderRadius: '10px',
    background: '#003366',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(0,51,102,0.3)',
    transition: 'transform 0.15s, background 0.15s',
  },
  gotItBtn: {
    padding: '8px 28px',
    border: 'none',
    borderRadius: '8px',
    background: '#003366',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};