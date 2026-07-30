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

const DISMISSED_KEY = 'namatl_install_dismissed';

// ===== ADDED: Clear dismiss flag on every page load =====
// Popup shows every visit. Only hidden when app is actually installed.
localStorage.removeItem(DISMISSED_KEY);

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
          'Tap the menu button (three dots) in the top-right corner.',
          'Tap "Install" or "Add to Home screen".',
          'Tap "Install" in the popup.',
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

    if (/Android/.test(navigator.userAgent)) {
      return {
        title: 'Install on Android',
        steps: [
          'Tap the menu button (three dots) in the top-right corner.',
          'Tap "Install app" or "Add to Home screen".',
          'Tap "Install" in the popup.',
          'Find NAMATL on your home screen!'
        ],
        icon: '📱'
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

    // Check if user previously dismissed
    if (localStorage.getItem(DISMISSED_KEY)) {
      return;
    }

    // If the event already fired before React mounted, show immediately
    if (_promptAvailable && _deferredPrompt) {
      setDeferredPrompt(_deferredPrompt);
      setVisible(true);
      return;
    }

    // FALLBACK: Show popup after 3 seconds regardless of browser/event.
    const showTimer = setTimeout(() => {
      setVisible(true);
    }, 3000);

    const handler = (e) => {
      e.preventDefault();
      _deferredPrompt = e;
      _promptAvailable = true;
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setIsInstalled(true);
      setVisible(false);
      setDeferredPrompt(null);
      _deferredPrompt = null;
      _promptAvailable = false;
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      clearTimeout(showTimer);
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPrompt || _deferredPrompt;

    if (prompt && typeof prompt.prompt === 'function') {
      try {
        prompt.prompt();
        const result = await prompt.userChoice;
        if (result.outcome === 'accepted') {
          setIsInstalled(true);
          setVisible(false);
          localStorage.removeItem(DISMISSED_KEY);
          return;
        }
      } catch (err) {
        // Fall through to guide
      }
    }

    setGuideContent(getGuideContent());
    setShowGuide(true);

    _deferredPrompt = null;
    _promptAvailable = false;
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    setShowGuide(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  const closeGuide = () => {
    setShowGuide(false);
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  if (isInstalled) return null;

  if (showGuide && guideContent) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 99999, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(0,0,0,0.3)',
        pointerEvents: 'auto'
      }}>
        <div style={{
          background: '#ffffff', borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          padding: '24px 28px', width: '320px', maxWidth: '90vw',
          textAlign: 'center', position: 'relative'
        }}>
          <button onClick={closeGuide} style={{
            position: 'absolute', top: '8px', right: '12px',
            background: 'none', border: 'none', fontSize: '22px',
            color: '#999', cursor: 'pointer', lineHeight: 1,
            padding: '4px 8px'
          }}>×</button>

          <div style={{fontSize: '40px', marginBottom: '8px'}}>{guideContent.icon}</div>
          <h3 style={{margin: '0 0 16px', color: '#003366'}}>{guideContent.title}</h3>

          <div style={{textAlign: 'left', marginBottom: '16px'}}>
            {guideContent.steps.map((step, i) => (
              <p key={i} style={{fontSize: '14px', color: '#444', margin: '0 0 8px', lineHeight: '1.5'}}>
                <strong>{i + 1}.</strong> {step}
              </p>
            ))}
          </div>

          <button onClick={closeGuide} style={{
            padding: '8px 28px', border: 'none', borderRadius: '8px',
            background: '#003366', color: '#ffffff', fontSize: '14px',
            fontWeight: '600', cursor: 'pointer'
          }}>Got it</button>
        </div>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 99999, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,0,0,0.3)',
      pointerEvents: 'auto'
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        padding: '24px 28px', width: '300px', maxWidth: '90vw',
        textAlign: 'center', position: 'relative'
      }}>
        <button onClick={handleDismiss} style={{
          position: 'absolute', top: '8px', right: '12px',
          background: 'none', border: 'none', fontSize: '22px',
          color: '#999', cursor: 'pointer', lineHeight: 1,
          padding: '4px 8px'
        }}>×</button>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '10px', marginBottom: '12px'
        }}>
          <img
            src="/logo.png"
            alt="NAMATL"
            style={{
              width: '40px', height: '40px', borderRadius: '10px',
              objectFit: 'cover', border: '1px solid #003366'
            }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span style={{fontSize: '16px', fontWeight: '700', color: '#003366'}}>NAMATL Student Election</span>
        </div>

        <p style={{fontSize: '14px', color: '#666', margin: '0 0 16px', lineHeight: '1.4'}}>
          Install this app on your device for the best experience
        </p>

        <button onClick={handleInstall} style={{
          padding: '10px 32px', border: 'none', borderRadius: '10px',
          background: '#003366', color: '#ffffff', fontSize: '15px',
          fontWeight: '700', cursor: 'pointer',
          boxShadow: '0 3px 10px rgba(0,51,102,0.3)',
        }}>Install App</button>
      </div>
    </div>
  );
}