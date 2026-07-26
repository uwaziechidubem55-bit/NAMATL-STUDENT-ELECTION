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
      background: '#0b1a3a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Segoe UI', Tahoma, sans-serif"
    }}>
      <div style={{
        maxWidth: '560px',
        width: '100%',
        margin: '0 auto'
      }}>

        {/* Header with Logo Centered */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/logo.png"
            alt="NAMATL Logo"
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '3px solid #FFD700',
              marginBottom: '12px',
              display: 'block',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h1 style={{
            fontSize: '24px',
            fontWeight: '800',
            color: '#FFD700',
            margin: '0 0 6px 0'
          }}>
            NAMATL STUDENT E-VOTING
          </h1>
          <p style={{
            color: '#94a3b8',
            fontSize: '14px',
            margin: '0'
          }}>
            💬 Chat / Support — Submit your complaints or request help
          </p>
        </div>

        {submitted ? (
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '40px 24px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#16a34a',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              margin: '0 auto 16px auto'
            }}>✓</div>
            <h2 style={{
              fontSize: '22px',
              fontWeight: '700',
              color: '#0b1a3a',
              margin: '0 0 8px 0'
            }}>Message Sent!</h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' }}>
              Your message has been received. We'll get back to you as soon as possible.
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
                fontWeight: '700',
                fontSize: '15px',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.3s'
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
              background: '#ffffff',
              borderRadius: '12px',
              padding: '32px 28px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}
          >
            {error && (
              <div style={{
                background: '#fef2f2',
                color: '#dc2626',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '20px',
                border: '1px solid #fecaca'
              }}>
                ⚠️ {error}
              </div>
            )}

            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#0b1a3a',
              marginBottom: '6px'
            }}>
              Your Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
                background: '#ffffff',
                color: '#0b1a3a',
                outline: 'none',
                transition: 'border-color 0.2s',
                marginBottom: '20px'
              }}
              onFocus={(e) => { e.target.style.borderColor = '#FFD700'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
            />

            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#0b1a3a',
              marginBottom: '6px'
            }}>
              Email <span style={{ color: '#94a3b8' }}>(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
                background: '#ffffff',
                color: '#0b1a3a',
                outline: 'none',
                transition: 'border-color 0.2s',
                marginBottom: '20px'
              }}
              onFocus={(e) => { e.target.style.borderColor = '#FFD700'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
            />

            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#0b1a3a',
              marginBottom: '6px'
            }}>
              Your Message <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows="5"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
                background: '#ffffff',
                color: '#0b1a3a',
                outline: 'none',
                transition: 'border-color 0.2s',
                resize: 'vertical',
                fontFamily: "'Segoe UI', Tahoma, sans-serif",
                marginBottom: '24px'
              }}
              onFocus={(e) => { e.target.style.borderColor = '#FFD700'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
            />

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px',
                background: '#FFD700',
                color: '#061D3A',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#e6a800';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#FFD700';
                e.target.style.transform = 'translateY(0)';
              }}
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
                  transition: 'all 0.3s'
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
          color: '#64748b',
          fontSize: '11px',
          marginTop: '32px'
        }}>
          NAMATL STUDENT E-VOTING © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}