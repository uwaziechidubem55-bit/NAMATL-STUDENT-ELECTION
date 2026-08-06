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
  try { localStorage.setItem('namatl_pwa_installed', '1'); } catch (e) {}
});

const INSTALLED_KEY = 'namatl_pwa_installed';
const DISMISS_COUNT_KEY = 'namatl_install_dismiss_count';
const COOLDOWN_UNTIL_KEY = 'namatl_install_cooldown_until';

// ⏰ Cooldown window: 4 hours after the 3rd dismissal
const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4h

// Are we inside the 4-hour cooldown? (3rd dismissal happened)
const inCooldown = () => {
  try {
    const until = Number(localStorage.getItem(COOLDOWN_UNTIL_KEY) || 0);
    return Date.now() < until;
  } catch (e) { return false; }
};

// ✅ Am I already running inside the installed app?
const isRunningStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  window.matchMedia('(display-mode: minimal-ui)').matches ||
  window.navigator.standalone === true;

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(_deferredPrompt);
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState('popup'); // 'popup' | 'guide' | 'installing' | 'installed'
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [guideContent, setGuideContent] = useState(null);
  const [installClicks, setInstallClicks] = useState(0);

  const getBrowserInfo = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return { isIOS };
  };

  useEffect(() => {
    // ✅ Already running inside the installed app → never show the popup
    if (isRunningStandalone()) {
      setVisible(false);
      return;
    }

    const showPopup = () => setVisible(true);

    const checkInstalled = async () => {
      // ⏰ In cooldown (3rd dismissal < 4h ago) → stay hidden, regardless of reloads
      if (inCooldown()) return;

      try {
        if (navigator.getInstalledRelatedApps) {
          const apps = await navigator.getInstalledRelatedApps();
          if (apps.some((app) => app.platform === 'web' || app.platform === 'play')) {
            setAlreadyInstalled(true);
            showPopup();
            return;
          }
        }
      } catch (e) {}
      try {
        if (localStorage.getItem(INSTALLED_KEY)) {
          setAlreadyInstalled(true);
          showPopup();
          return;
        }
      } catch (e) {}

      if (_promptAvailable && _deferredPrompt) {
        setDeferredPrompt(_deferredPrompt);
        showPopup();
        return;
      }

      const showTimer = setTimeout(showPopup, 3000);

      const handler = (e) => {
        e.preventDefault();
        _deferredPrompt = e;
        _promptAvailable = true;
        setDeferredPrompt(e);
        showPopup();
      };
      window.addEventListener('beforeinstallprompt', handler);

      const installedHandler = () => {
        _deferredPrompt = null;
        _promptAvailable = false;
        setDeferredPrompt(null);
        setAlreadyInstalled(false);
        setStage('installed');
        showPopup();
      };
      window.addEventListener('appinstalled', installedHandler);

      return () => {
        clearTimeout(showTimer);
        window.removeEventListener('beforeinstallprompt', handler);
        window.removeEventListener('appinstalled', installedHandler);
      };
    };

    checkInstalled();
  }, []);

  // ===================== CLICK 1: show instructions =====================
  // ===================== CLICK 2: real install =====================
  const handleInstall = async () => {
    if (installClicks === 0) {
      setInstallClicks(1);
      setGuideContent({
        icon: '📲',
        title: 'Install NAMATL on your device',
        steps: [
          'Tap "Install App" again on the next screen.',
          'When the system prompt slides up from the bottom, tap "Install".',
          'The app will download automatically in the background.',
          'Find the NAMATL icon on your home screen — it opens instantly like a real app!',
        ],
      });
      setStage('guide');
      return;
    }

    const prompt = deferredPrompt || _deferredPrompt;

    if (prompt && typeof prompt.prompt === 'function') {
      setStage('installing');
      try {
        await prompt.prompt();
        const result = await prompt.userChoice;
        if (result.outcome === 'accepted') {
          setTimeout(() => {
            setStage('installed');
            try { localStorage.setItem(INSTALLED_KEY, '1'); } catch (e) {}
          }, 1500);
          return;
        }
        setStage('popup');
        return;
      } catch (err) {
        console.error('Native prompt delivery failed:', err);
        setStage('popup');
        return;
      }
    }

    // No native prompt → platform guidance (iOS uses the Share button)
    const { isIOS } = getBrowserInfo();
    if (isIOS) {
      setGuideContent({
        icon: '🍎',
        title: 'Install on iPhone / iPad',
        steps: [
          'Tap the Share button (square with arrow) at the bottom of the screen.',
          'Scroll down and tap "Add to Home Screen".',
          'Tap "Add" in the top-right corner.',
          'Find the NAMATL icon on your home screen and open it like a real app.',
        ],
      });
    } else {
      setGuideContent({
        icon: '📱',
        title: 'Install NAMATL',
        steps: [
          'Make sure you are using Chrome (Android) or Safari (iPhone).',
          'Tap "Install App" below.',
          'When the system prompt appears, tap "Install".',
          'The NAMATL icon will appear on your home screen.',
        ],
      });
    }
    setStage('guide');
  };

  // "Got it" → guide closes, but the INSTALL POPUP STAYS (unchanged)
  const handleGotIt = () => {
    setStage('popup');
    setInstallClicks(0);
  };

  // ===================== X / Close → dismiss counting + 4h cooldown =====================
  const handleDismiss = () => {
    setVisible(false);
    setStage('popup');
    setInstallClicks(0);

    // Already in cooldown → nothing to count
    if (inCooldown()) return;

    let count = 0;
    try { count = Number(localStorage.getItem(DISMISS_COUNT_KEY) || 0); } catch (e) {}
    count += 1;

    if (count >= 3) {
      // 3rd dismissal → cooldown for 4 hours, then reset the counter for the next cycle
      try {
        localStorage.setItem(COOLDOWN_UNTIL_KEY, String(Date.now() + COOLDOWN_MS));
        localStorage.setItem(DISMISS_COUNT_KEY, '0');
      } catch (e) {}
    } else {
      try { localStorage.setItem(DISMISS_COUNT_KEY, String(count)); } catch (e) {}
    }
  };

  // "Done" on the installed screen → close forever (real install, not a dismiss)
  const handleDone = () => {
    setVisible(false);
    setStage('popup');
    try { localStorage.setItem(INSTALLED_KEY, '1'); } catch (e) {}
  };

  if (!visible) return null;

  // ===================== STAGE: INSTALLED =====================
  if (stage === 'installed') {
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
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>✅</div>
          <h3 style={{ margin: '0 0 10px', color: '#16a34a' }}>NAMATL Installed!</h3>
          <p style={{ fontSize: '14px', color: '#555', margin: '0 0 16px', lineHeight: '1.5' }}>
            Find the <strong>NAMATL</strong> icon on your home screen — it opens instantly like any other app.
          </p>
          <button onClick={handleDone} style={{
            padding: '10px 32px', border: 'none', borderRadius: '10px',
            background: '#16a34a', color: '#ffffff', fontSize: '15px',
            fontWeight: '700', cursor: 'pointer'
          }}>Done</button>
        </div>
      </div>
    );
  }

  // ===================== STAGE: INSTALLING =====================
  if (stage === 'installing') {
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
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>⏳</div>
          <h3 style={{ margin: '0 0 10px', color: '#003366' }}>Installing NAMATL...</h3>
          <p style={{ fontSize: '14px', color: '#555', margin: 0, lineHeight: '1.5' }}>
            Follow the on-screen prompt to complete the installation. This usually takes a few seconds.
          </p>
        </div>
      </div>
    );
  }

  // ===================== STAGE: GUIDE (instructions) =====================
  if (stage === 'guide' && guideContent) {
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
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>{guideContent.icon}</div>
          <h3 style={{ margin: '0 0 16px', color: '#003366' }}>{guideContent.title}</h3>
          <div style={{ textAlign: 'left', marginBottom: '16px' }}>
            {guideContent.steps.map((step, i) => (
              <p key={i} style={{ fontSize: '14px', color: '#444', margin: '0 0 8px', lineHeight: '1.5' }}>
                <strong>{i + 1}.</strong> {step}
              </p>
            ))}
          </div>
          <button onClick={handleGotIt} style={{
            padding: '8px 28px', border: 'none', borderRadius: '8px',
            background: '#003366', color: '#ffffff', fontSize: '14px',
            fontWeight: '600', cursor: 'pointer'
          }}>Got it</button>
          <p style={{ fontSize: '12px', color: '#999', margin: '12px 0 0' }}>
            The install popup will stay open so you can continue.
          </p>
        </div>
      </div>
    );
  }

  // ===================== STAGE: POPUP (main) =====================
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
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#003366' }}>NAMATL Student Election</span>
        </div>

        {alreadyInstalled ? (
          <>
            <p style={{ fontSize: '14px', color: '#16a34a', fontWeight: '700', margin: '0 0 6px' }}>
              ✅ App already installed
            </p>
            <p style={{ fontSize: '13px', color: '#666', margin: '0 0 16px', lineHeight: '1.4' }}>
              Open NAMATL from your home screen to use it as an app.
            </p>
            <button onClick={handleDismiss} style={{
              padding: '10px 32px', border: 'none', borderRadius: '10px',
              background: '#003366', color: '#ffffff', fontSize: '15px',
              fontWeight: '700', cursor: 'pointer'
            }}>Close</button>
          </>
        ) : (
          <>
            <p style={{ fontSize: '14px', color: '#666', margin: '0 0 6px', lineHeight: '1.4' }}>
              Install this app on your device for the best experience
            </p>
            <p style={{ fontSize: '12px', color: '#999', margin: '0 0 16px' }}>
              No browser menus needed — just tap Install.
            </p>
            <button onClick={handleInstall} style={{
              padding: '10px 32px', border: 'none', borderRadius: '10px',
              background: '#003366', color: '#ffffff', fontSize: '15px',
              fontWeight: '700', cursor: 'pointer', boxShadow: '0 3px 10px rgba(0,51,102,0.3)'
            }}>
              Install App
            </button>
          </>
        )}
      </div>
    </div>
  );
}