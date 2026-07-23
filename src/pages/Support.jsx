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
      fontFamily: 'system-ui, sans-serif',
      color: '#f1f5f9',
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        {/* Header with Logo & Branding */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src="/logo.png"
            alt="NAMATL Logo"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              objectFit: 'cover',
              marginBottom: '12px',
              border: '2px solid #FFD700',
            }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h1 style={{
            color: '#FFD700',
            margin: '0 0 4px',
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '0.5px',
          }}>
            NAMATL STUDENT E-VOTING
          </h1>
          <p style={{
            color: '#94a3b8',
            fontSize: '13px',
            margin: 0,
          }}>
            💬 Chat / Support — Submit your complaints or request help
          </p>
        </div>

        {submitted ? (
          <div style={{
            background: '#0f172a',
            borderRadius: '12px',
            padding: '40px 24px',
            textAlign: 'center',
            border: '1px solid #1e293b',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(34,197,94,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '32px',
            }}>
              ✓
            </div>
            <h2 style={{
              color: '#22c55e',
              margin: '0 0 8px',
              fontSize: '20px',
            }}>
              Message Sent!
            </h2>
            <p style={{
              color: '#94a3b8',
              fontSize: '14px',
              margin: '0 0 24px',
              lineHeight: 1.5,
            }}>
              Your message has been received.<br />
              We'll get back to you as soon as possible.
            </p>
            <Link
              to="/"
              style={{
                display: 'inline-block',
                padding: '12px 28px',
                background: '#FFD700',
                color: '#061D3A',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => { e.target.style.background = '#e6a800'; }}
              onMouseLeave={(e) => { e.target.style.background = '#FFD700'; }}
            >
              ← Back to Home
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              background: '#0f172a',
              borderRadius: '12px',
              padding: '28px 24px',
              border: '1px solid #1e293b',
            }}
          >
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                color: '#94a3b8',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Your Name *
              </label>
              <input
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  background: '#0a1628',
                  color: '#f1f5f9',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#FFD700'; }}
                onBlur={(e) => { e.target.style.borderColor = '#334155'; }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                color: '#94a3b8',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Email (optional)
              </label>
              <input
                placeholder="e.g. you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  background: '#0a1628',
                  color: '#f1f5f9',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#FFD700'; }}
                onBlur={(e) => { e.target.style.borderColor = '#334155'; }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: '#94a3b8',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Your Message *
              </label>
              <textarea
                placeholder="Type your message, complaint, or request here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows="5"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  background: '#0a1628',
                  color: '#f1f5f9',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#FFD700'; }}
                onBlur={(e) => { e.target.style.borderColor = '#334155'; }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px',
                background: '#FFD700',
                color: '#061D3A',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => { e.target.style.background = '#e6a800'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.target.style.background = '#FFD700'; e.target.style.transform = 'translateY(0)'; }}
            >
              Send Message
            </button>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link
                to="/"
                style={{
                  color: '#94a3b8',
                  background: 'transparent',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  display: 'inline-block',
                  transition: 'all 0.3s',
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = '#FFD700';
                  e.target.style.borderColor = '#FFD700';
                  e.target.style.background = 'rgba(255,215,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = '#94a3b8';
                  e.target.style.borderColor = 'rgba(148,163,184,0.2)';
                  e.target.style.background = 'transparent';
                }}
              >
                ← Back to Home
              </Link>
            </div>
          </form>
        )}

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          color: '#475569',
          fontSize: '11px',
          marginTop: '32px',
        }}>
          NAMATL STUDENT E-VOTING © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}