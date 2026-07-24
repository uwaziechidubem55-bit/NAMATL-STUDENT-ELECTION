import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function PurchaseForm() {
  const [settings, setSettings] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [formData, setFormData] = useState({ fullName: '', department: '', level: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [positionCounts, setPositionCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    const timeout = setTimeout(() => {
      setError('⚠️ Taking too long to connect. Check your internet or refresh the page.');
      setLoading(false);
    }, 8000); // 8 second timeout

    try {
      // Load both at same time to make it faster
      const [settingsDoc, candidatesSnap] = await Promise.all([
        getDoc(doc(db, 'settings', 'formPurchase')),
        getDocs(collection(db, 'candidates'))
      ]);

      clearTimeout(timeout);

      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setSettings(data);
        const now = new Date();
        const openDt = new Date(data.openingDate + 'T' + (data.openingTime || '00:00'));
        const closeDt = new Date(data.closingDate + 'T' + (data.closingTime || '23:59'));
        if (data.openingDate && now < openDt) setError('📅 Purchase opens ' + data.openingDate + ' at ' + (data.openingTime || '00:00'));
        else if (data.closingDate && now > closeDt) setError('Purchase is closed, come back next year.');
        else if (!data.isActive) setError('Form purchase is currently disabled.');
      } else {
        setError('Form purchase not configured yet. Contact admin.');
      }

      const counts = {};
      candidatesSnap.forEach(d => { const pos = d.data().position; counts[pos] = (counts[pos] || 0) + 1; });
      setPositionCounts(counts);

    } catch (e) {
      clearTimeout(timeout);
      console.error(e);

      // Better error messages
      if (e.message.includes('offline') || e.message.includes('Failed to get')) {
        setError('🌐 No internet connection. Please check your data/WiFi and tap refresh.');
      } else if (e.message.includes('permission')) {
        setError('🔒 Permission denied. Admin needs to update Firebase rules.');
      } else {
        setError('Error loading: ' + e.message);
      }
    }
    setLoading(false);
  };

  const getCount = (pos) => positionCounts[pos] || 0;

  const handleSelect = (pos) => {
    if (getCount(pos.position) >= 5) { alert('Maximum 5 candidates for ' + pos.position); return; }
    setSelectedPosition(pos);
    setError('');
    setSuccessMsg('');
  };

  const handlePay = async () => {
    if (!formData.fullName.trim() ||!formData.department.trim() ||!formData.level.trim()) {
      alert('Fill all required fields'); return;
    }
    setSubmitting(true);
    try {
      const txRef = 'FORM-' + selectedPosition.position.replace(/\s+/g, '-') + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
      const FLW = (await import('flutterwave-react-v3')).default;
      const checkout = new FLW({
        public_key: process.env.VITE_FLW_PUBLIC_KEY,
        tx_ref: txRef,
        amount: selectedPosition.amount,
        currency: 'NGN',
        payment_options: 'card,ussd,transfer,banktransfer',
        customer: { email: formData.email || 'candidate@namtls.edu.ng', name: formData.fullName },
        customizations: { title: 'NAMATL Form Purchase', description: selectedPosition.position + ' candidacy form' },
        callback: async (response) => {
          if (response.status === 'successful' || response.status === 'completed') {
            const verifyRes = await fetch('/api/verify-form-payment', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transaction_id: response.transaction_id,
                position: selectedPosition.position,
                amount: selectedPosition.amount,
                candidateData: formData
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setSuccessMsg(verifyData.message);
              setSelectedPosition(null);
              setFormData({ fullName: '', department: '', level: '', email: '' });
              loadData();
            } else { alert('❌ ' + verifyData.message); }
          } else { alert('Payment not completed.'); }
          setSubmitting(false);
        },
        onClose: () => { setSubmitting(false); alert('Payment cancelled.'); }
      });
      checkout.open();
    } catch (e) { setSubmitting(false); alert('Error: ' + e.message); }
  };

  const page = { minHeight: '100vh', background: '#f5f7fa', color: '#1e293b', fontFamily: 'system-ui, sans-serif', padding: '20px', maxWidth: '600px', margin: '0 auto' };
  const card = { background: '#ffffff', borderRadius: '12px', padding: '20px', marginBottom: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
  const input = { width: '100%', padding: '12px 16px', marginBottom: '12px', background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' };

  if (loading) return <div style={page}><div style={{ textAlign: 'center', paddingTop: '100px' }}><h2>⏳ Loading...</h2><p style={{ opacity: 0.6 }}>Connecting to server...</p></div></div>;

  return (
    <div style={page}>
      <div style={{ textAlign: 'center', marginBottom: '32px', paddingTop: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 4px 0', color: '#1e40af' }}>🏛️ NAMTLS STUDENT E-VOTING</h1>
        <p style={{ fontSize: '14px', opacity: 0.7, margin: '0 0 16px 0' }}>Form Purchase Portal</p>
        <Link to="/" style={{ color: '#1e40af', fontSize: '14px', padding: '8px 20px', border: '1px solid #1e40af', borderRadius: '8px', textDecoration: 'none', fontWeight: '500' }}>← Back to Home</Link>
      </div>

      {error && (
        <div style={{...card, textAlign: 'center', borderColor: '#fecaca', background: '#fef2f2' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px', color: '#dc2626' }}>⛔</div>
          <p style={{ fontSize: '15px', color: '#dc2626', fontWeight: '500', margin: '0 0 12px 0' }}>{error}</p>
          <button onClick={loadData} style={{ background: '#1e40af', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginRight: '8px' }}>🔄 Retry</button>
          <Link to="/" style={{ color: '#1e40af', fontSize: '13px', display: 'inline-block' }}>← Back to Home</Link>
        </div>
      )}

      {successMsg && (
        <div style={{...card, textAlign: 'center', borderColor: '#bbf7d0', background: '#f0fdf4' }}>
          <p style={{ color: '#16a34a', margin: 0 }}>✅ {successMsg}</p>
        </div>
      )}

      {!error && settings &&!selectedPosition && (
        <>
          <div style={{...card, textAlign: 'center', borderColor: '#bfdbfe' }}>
            <p style={{ fontSize: '13px', opacity: 0.7, margin: '0 0 4px 0' }}>📅 {settings.openingDate} - {settings.closingDate}</p>
            {settings.positions?.length > 0 && <p style={{ fontSize: '12px', opacity: 0.5, margin: 0 }}>{settings.positions.length} position(s) | Max 5 per position</p>}
          </div>
          <h2 style={{ fontSize: '18px', marginBottom: '16px', fontWeight: '600' }}>📋 Select a Position</h2>
          {settings.positions?.map((pos, i) => {
            const count = getCount(pos.position);
            const full = count >= 5;
            return (
              <div key={i} onClick={() => handleSelect(pos)}
                style={{...card, cursor: full? 'not-allowed' : 'pointer', border: full? '1px solid #fecaca' : '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: full? 0.6 : 1 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#1e40af', fontWeight: '600' }}>{pos.position}</h3>
                  <p style={{ margin: 0, fontSize: '13px', opacity: 0.6 }}>{count}/5 taken</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold', color: '#16a34a' }}>₦{Number(pos.amount).toLocaleString()}</p>
                  {full && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600' }}>FULL</span>}
                </div>
              </div>
            );
          })}
        </>
      )}

      {!error && settings && selectedPosition && (
        <div>
          <button onClick={() => setSelectedPosition(null)} style={{ background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>← Back</button>
          <div style={card}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600' }}>✍️ Fill Your Details for <span style={{ color: '#1e40af' }}>{selectedPosition.position}</span></h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', opacity: 0.6 }}>Amount: <strong style={{ color: '#16a34a' }}>₦{Number(selectedPosition.amount).toLocaleString()}</strong></p>
            <input placeholder="Full Name *" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} style={input} disabled={submitting} />
            <input placeholder="Department *" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} style={input} disabled={submitting} />
            <input placeholder="Level (e.g. 200) *" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} style={input} disabled={submitting} />
            <input placeholder="Email (optional)" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={input} disabled={submitting} />
            <button onClick={handlePay} disabled={submitting} style={{ padding: '14px 24px', background: '#1e40af', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: submitting? 'not-allowed' : 'pointer', width: '100%', opacity: submitting? 0.5 : 1 }}>
              {submitting? '⏳ Processing...' : `💳 Pay ₦${Number(selectedPosition.amount).toLocaleString()}`}
            </button>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '40px' }}>
        <p style={{ opacity: 0.4, fontSize: '12px' }}>NAMTLS Student E-voting © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}