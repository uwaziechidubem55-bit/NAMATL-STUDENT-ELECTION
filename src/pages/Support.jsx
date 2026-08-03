import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Support() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !message) {
      setError('Name and message are required');
      return;
    }
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
      setSubmitted(true);
      setError('');
      setName(''); setEmail(''); setMessage('');
    } catch (e) {
      setError('Failed to send message: ' + e.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000F2A', color: 'white', fontFamily: 'Arial, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', color: '#0b1a3a', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
        {/* Header with Logo Centered */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <img
            src="https://raw.githubusercontent.com/logo.png"
            alt="NAMATL Logo"
            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #FFD700', margin: '0 auto 12px', display: 'block' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h1 style={{ margin: 0, fontSize: '22px' }}>NAMATL STUDENT E-VOTING</h1>
          <p style={{ margin: '6px 0 0', color: '#555' }}>💬 Chat / Support — Submit your complaints or request help</p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px' }}>✓</div>
            <h2 style={{ margin: '8px 0' }}>Message Sent!</h2>
            <p>Your message has been received. We'll get back to you as soon as possible.</p>
            <Link to="/" style={{ display: 'inline-block', marginTop: '8px', padding: '10px 24px', background: '#FFD700', color: '#0b1a3a', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}>← Back to Home</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '14px' }}>
                ⚠️ {error}
              </div>
            )}

            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Your Name *</label>
            <input
              type="text"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '20px', outline: 'none' }}
              onFocus={(e) => { e.target.style.borderColor = '#FFD700'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
            />

            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '20px', outline: 'none' }}
              onFocus={(e) => { e.target.style.borderColor = '#FFD700'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
            />

            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Your Message *</label>
            <textarea
              value={message}
              required
              rows={5}
              onChange={(e) => setMessage(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '20px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              onFocus={(e) => { e.target.style.borderColor = '#FFD700'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
            />

            <button type="submit" style={{ width: '100%', padding: '14px', background: '#FFD700', color: '#0b1a3a', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>
              Send Message
            </button>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <Link to="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>← Back to Home</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}