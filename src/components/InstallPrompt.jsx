import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideContent, setGuideContent] = useState(null);

  // Detect the user's browser / OS for tailored instructions
  const getBrowserInfo = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
    const isFirefox = /Firefox/.test(ua);
    const isChrome = /Chrome/.test(ua) && !/Edge/.test(ua) && !/Brave/.test(ua);
    const isEdge = /Edg/.test(ua);
    const isMac = navigator.platform === 'MacIntel' && !isIOS;

    return { isIOS, isSafari, isFirefox, isChrome, isEdge, isMac, ua };
  };

  // Platform-specific install guides
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

    // Default: Chromium-based (Chrome, Edge, Brave, Opera)
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
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for the install prompt (native Chrome + polyfill for others)
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // When app is successfully installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Check if this is a real native prompt or a polyfill
    const isNativePrompt = typeof deferredPrompt.prompt === 'function';

    try {
      if (isNativePrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        if (result.outcome === 'accepted') {
          setIsInstalled(true);
          setVisible(false);
        }
      } else {
        // Polyfill fallback — show the guide
        setGuideContent(getGuideContent());
        setShowGuide(true);
      }
    } catch (err) {
      // If prompt fails (e.g. on iOS or unsupported), show the guide
      setGuideContent(getGuideContent());
      setShowGuide(true);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    setShowGuide(false);
    setDeferredPrompt(null);
  };

  const closeGuide = () => {
    setShowGuide(false);
    setVisible(false);
  };

  // Already installed — show nothing
  if (isInstalled) return null;

  // Show the install guide overlay
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

  // Don't show the prompt button if not ready
  if (!visible) return null;

  // Show the install prompt card
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