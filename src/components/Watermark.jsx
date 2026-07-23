import { useEffect } from 'react';

export default function Watermark() {
  useEffect(() => {
    console.log('NAMTLS E-Voting loaded');
  }, []);

  return (
    <img
      src="/logo.png"
      alt="NAMTLS Watermark"
      style={{
        position: 'fixed',
        bottom: '12px',
        right: '12px',
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        objectFit: 'cover',
        opacity: 0.15,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
}