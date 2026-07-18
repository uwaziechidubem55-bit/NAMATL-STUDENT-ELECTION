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
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Arial, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', width: '100%', maxWidth: '500px' }}>
        <div style={{ fontSize: '48px', marginBottom: '8px', textAlign: 'center' }}>💬</div>
        <h1 style={{ color: '#003366', textAlign: 'center', marginBottom: '4px' }}>Chat / Support</h1>
        <p style={{ color: '#666', textAlign: 'center', marginBottom: '24px', fontSize: '14px' }}>Submit your complaints or request help</p>

        {submitted ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>✓</div>
            <h2 style={{ color: '#16a34a' }}>Message Sent!</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>Your message has been received. We'll get back to you.</p>
            <Link to="/" style={{ color: '#2563eb' }}>Back to Home</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ padding: '10px', background: '#fee2e2', color: '#dc2626', borderRadius: '4px', marginBottom: '12px', fontSize: '14px', fontWeight: 'bold', border: '1px solid #fecaca' }}>{error}</div>
            )}
            <input placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '14px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '12px', fontSize: '14px', boxSizing: 'border-box' }} required />
            <input placeholder="Your Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '14px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '12px', fontSize: '14px', boxSizing: 'border-box' }} />
            <textarea placeholder="Your Message" value={message} rows={5} onChange={(e) => setMessage(e.target.value)}
              style={{ width: '100%', padding: '14px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '12px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'Arial, sans-serif' }} required />
            <button type="submit"
              style={{ width: '100%', padding: '14px', background: '#003366', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
              Send Message
            </button>
          </form>
        )}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/" style={{ color: '#2563eb', fontSize: '13px' }}>Back to Home</Link>
        </div>
      </div>
    </div>
  );
}