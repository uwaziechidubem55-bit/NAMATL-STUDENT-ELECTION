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
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'formPurchase'));
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
        setError('Form purchase not configured yet.');
      }
      const candidatesSnap = await getDocs(collection(db, 'candidates'));
      const counts = {};
      candidatesSnap.forEach(d => { const pos = d.data().position; counts[pos] = (counts[pos] || 0) + 1; });
      setPositionCounts(counts);
    } catch (e) { setError('Error loading: ' + e.message); }
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
    if (!formData.fullName.trim() || !formData.department.trim() || !formData.level.trim()) {
      alert('Fill all required fields'); return;
    }
    setSubmitting(true);
    try {
      const txRef = 'FORM-' + selectedPosition.position.replace(/\s+/g, '-') + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
      const FLW = (await import('flutterwave-react-v3')).default;
      const checkout = new FLW({
        public_key: process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY,
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

  const page = { minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: 'system-ui, sans-serif', padding: '20px', maxWidth: '600px', margin: '0 auto' };
  const card = { background: '#1e293b', borderRadius: '12px', padding: '20px', marginBottom: '16px', border: '1px solid #334155' };
  const input = { width: '100%', padding: '12px 16px', marginBottom: '12px', background: '#0f172a', color: 'white', border: '1px solid #475569', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' };

  if (loading) return <div style={page}><div style={{ textAlign: 'center', paddingTop: '100px' }}><h2>Loading...</h2></div></div>;

  return (
    <div style={page}>
      <div style={{ textAlign: 'center', marginBottom: '32px', paddingTop: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 8px 0' }}>🏛️ <span style={{ color: '#FFD700' }}>NAMATL</span> CANDIDATES FORM PURCHASE</h1>
        <Link to="/" style={{ color: '#FFD700', fontSize: '13px', marginTop: '12px', display: 'inline-block' }}>← Back to Home</Link>
      </div>

      {error && (
        <div style={{ ...card, textAlign: 'center', borderColor: '#f59e0b' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>⛔</div>
          <p style={{ fontSize: '16px', color: '#fbbf24', fontWeight: '500' }}>{error}</p>
          <Link to="/" style={{ color: '#FFD700', fontSize: '13px', marginTop: '12px', display: 'inline-block' }}>← Back to Home</Link>
        </div>
      )}

      {successMsg && (
        <div style={{ ...card, textAlign: 'center', borderColor: '#22c55e' }}>
          <p style={{ color: '#22c55e' }}>✅ {successMsg}</p>
        </div>
      )}

      {!error && settings && !selectedPosition && (
        <>
          <div style={{ ...card, textAlign: 'center', borderColor: '#2563eb' }}>
            <p style={{ fontSize: '13px', opacity: 0.7, margin: '0 0 4px 0' }}>📅 {settings.openingDate} - {settings.closingDate}</p>
            {settings.positions?.length > 0 && <p style={{ fontSize: '12px', opacity: 0.5 }}>{settings.positions.length} position(s) | Max 5 per position</p>}
          </div>
          <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>📋 Select a Position</h2>
          {settings.positions?.map((pos, i) => {
            const count = getCount(pos.position);
            const full = count >= 5;
            return (
              <div key={i} onClick={() => handleSelect(pos)}
                style={{ ...card, cursor: full ? 'not-allowed' : 'pointer', border: full ? '1px solid #dc2626' : '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: full ? 0.6 : 1 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#FFD700' }}>{pos.position}</h3>
                  <p style={{ margin: 0, fontSize: '13px', opacity: 0.6 }}>{count}/5 taken</p>
                </div>
                <div>
                  <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold', color: '#22c55e' }}>₦{Number(pos.amount).toLocaleString()}</p>
                  {full && <span style={{ fontSize: '11px', color: '#ef4444' }}>FULL</span>}
                </div>
              </div>
            );
          })}
        </>
      )}

      {!error && settings && selectedPosition && (
        <div>
          <button onClick={() => setSelectedPosition(null)} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>← Back</button>
          <div style={card}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>✍️ Fill Your Details for <span style={{ color: '#FFD700' }}>{selectedPosition.position}</span></h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', opacity: 0.6 }}>Amount: <strong style={{ color: '#22c55e' }}>₦{Number(selectedPosition.amount).toLocaleString()}</strong></p>
            <input placeholder="Full Name *" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} style={input} disabled={submitting} />
            <input placeholder="Department *" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} style={input} disabled={submitting} />
            <input placeholder="Level (e.g. 200) *" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} style={input} disabled={submitting} />
            <input placeholder="Email (optional)" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={input} disabled={submitting} />
            <button onClick={handlePay} disabled={submitting} style={{ padding: '14px 24px', background: '#FFD700', color: '#1e293b', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: submitting ? 'not-allowed' : 'pointer', width: '100%', opacity: submitting ? 0.5 : 1 }}>
              {submitting ? '⏳ Processing...' : `💳 Pay ₦${Number(selectedPosition.amount).toLocaleString()}`}
            </button>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '40px' }}>
        <p style={{ opacity: 0.4, fontSize: '12px' }}>NAMATL E-Voting © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}