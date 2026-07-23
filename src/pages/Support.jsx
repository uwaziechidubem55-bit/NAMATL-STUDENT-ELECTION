import { useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

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
      await addDoc(collection(db, 'supportMessages'), {
        name, email: email || 'Not provided', message,
        timestamp: serverTimestamp(), status: 'unread'
      });
      setSubmitted(true);
      setError('');
      setName(''); setEmail(''); setMessage('');
    } catch (e) {
      setError('Failed to send message: ' + e.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1628 0%, #061D3A 50%, #003366 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: '20px',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.98)',
        borderRadius: '16px',
        padding: '40px 32px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '40px' }}>💬</span>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0a1628', margin: '8px 0 4px' }}>Chat / Support</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Submit your complaints or request help</p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>✓</span>
            <h2 style={{ color: '#0a1628', fontSize: '20px', fontWeight: 600 }}>Message Sent!</h2>
            <p style={{ color: '#64748b', fontSize: '14px' }}>Your message has been received. We'll get back to you.</p>

            {/* ===== SHARP BLOCK BACK LINK ===== */}
            <Link to="/"
              style={{
                color: '#2563eb',
                textDecoration: 'none',
                display: 'inline-block',
                padding: '8px 16px',
                border: '1px solid rgba(37,99,235,0.3)',
                borderRadius: '0px',
                transition: 'all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
                fontWeight: 500,
                fontSize: '13px',
                marginTop: '12px',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(37,99,235,0.1)';
                e.target.style.borderColor = '#2563eb';
                e.target.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(37,99,235,0.3)';
                e.target.style.transform = 'translateX(0)';
              }}>
              ← Back to Home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                background: '#fef2f2', color: '#dc2626',
                padding: '12px 16px', borderRadius: '8px',
                marginBottom: '16px', fontSize: '13px',
                border: '1px solid #fecaca'
              }}>
                {error}
              </div>
            )}

            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '14px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '12px', fontSize: '14px', boxSizing: 'border-box' }}
              required
            />
            <input
              type="email"
              placeholder="Your Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '14px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
            <textarea
              placeholder="Your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ width: '100%', padding: '14px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', minHeight: '120px', boxSizing: 'border-box', fontFamily: 'inherit' }}
              required
            />
            <button type="submit"
              style={{
                width: '100%',
                padding: '14px 0',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.target.style.background = '#1d4ed8')}
              onMouseLeave={(e) => (e.target.style.background = '#2563eb')}>
              Send Message
            </button>

            {/* ===== ERROR STATE BACK LINK — SHARP BLOCK ===== */}
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <Link to="/"
                style={{
                  color: '#94a3b8',
                  textDecoration: 'none',
                  display: 'inline-block',
                  padding: '6px 14px',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: '0px',
                  transition: 'all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
                  fontWeight: 500,
                  fontSize: '13px',
                  marginTop: '8px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(148,163,184,0.08)';
                  e.target.style.borderColor = '#94a3b8';
                  e.target.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.borderColor = 'rgba(148,163,184,0.2)';
                  e.target.style.transform = 'translateX(0)';
                }}>
                ← Back to Home
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}