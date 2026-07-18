import { useEffect } from 'react';

export default function Watermark() {
  useEffect(() => {
    console.log('NAMTLS E-Voting loaded');
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      opacity: 0.15,
      zIndex: 9999,
      pointerEvents: 'none'
    }}>
      <img
        src="https://raw.githubusercontent.com/logo.png"
        alt="NAMATLS Watermark"
        style={{ width: '80px', height: '80px', borderRadius: '50%' }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    </div>
  );
}