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

  if (loading) return <div style={{ ...page, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><h2>Loading...</h2></div>;

  return (
    <div style={page}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#FFD700', margin: '0 0 4px' }}>🏛️ NAMATL CANDIDATES FORM PURCHASE</h1>

        {/* ===== SHARP BLOCK BACK LINK (TOP) ===== */}
        <Link to="/"
          style={{
            color: '#FFD700',
            textDecoration: 'none',
            display: 'inline-block',
            padding: '6px 14px',
            border: '1px solid rgba(255,215,0,0.2)',
            borderRadius: '0px',
            transition: 'all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
            fontWeight: 500,
            fontSize: '13px',
            marginTop: '8px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255,215,0,0.1)';
            e.target.style.borderColor = '#FFD700';
            e.target.style.transform = 'translateX(4px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.borderColor = 'rgba(255,215,0,0.2)';
            e.target.style.transform = 'translateX(0)';
          }}>
          ← Back to Home
        </Link>
      </div>

      {error && (
        <div style={{
          background: 'rgba(220,38,38,0.15)',
          border: '1px solid rgba(220,38,38,0.3)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          marginBottom: '16px',
        }}>
          <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>⛔</span>
          <p style={{ color: '#ef4444', fontSize: '14px', margin: '0 0 16px' }}>{error}</p>

          {/* ===== SHARP BLOCK BACK LINK (ERROR STATE) ===== */}
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
      )}

      {successMsg && (
        <div style={{ ...card, textAlign: 'center', borderColor: '#22c55e' }}>
          <p style={{ color: '#22c55e', fontSize: '14px', margin: 0 }}>✅ {successMsg}</p>
        </div>
      )}

      {!error && settings && !selectedPosition && (
        <>
          <div style={card}>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
              📅 {settings.openingDate} - {settings.closingDate}
            </p>
            {settings.positions?.length > 0 && (
              <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0' }}>
                {settings.positions.length} position(s) | Max 5 per position
              </p>
            )}
          </div>

          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e2e8f0', margin: '0 0 12px' }}>📋 Select a Position</h2>

          {settings.positions?.map((pos, i) => {
            const count = getCount(pos.position);
            const full = count >= 5;
            return (
              <div key={i} onClick={() => !full && handleSelect(pos)}
                style={{
                  ...card,
                  cursor: full ? 'not-allowed' : 'pointer',
                  border: full ? '1px solid #dc2626' : '1px solid #334155',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: full ? 0.6 : 1,
                }}>
                <div>
                  <h3 style={{ margin: '0 0 2px', fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>{pos.position}</h3>
                  <span style={{ color: full ? '#ef4444' : '#64748b', fontSize: '12px' }}>
                    {count}/5 taken
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#FFD700', fontWeight: 700, fontSize: '15px' }}>
                    ₦{Number(pos.amount).toLocaleString()}
                  </span>
                  {full && <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: 600 }}>FULL</div>}
                </div>
              </div>
            );
          })}
        </>
      )}

      {!error && settings && selectedPosition && (
        <div style={card}>
          <button onClick={() => setSelectedPosition(null)}
            style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
            ← Back
          </button>

          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e2e8f0', margin: '0 0 4px' }}>✍️ Fill Your Details for {selectedPosition.position}</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 20px' }}>
            Amount: <strong style={{ color: '#FFD700' }}>₦{Number(selectedPosition.amount).toLocaleString()}</strong>
          </p>

          <input type="text" placeholder="Full Name" value={formData.fullName}
            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
            style={input} disabled={submitting} />
          <input type="text" placeholder="Department" value={formData.department}
            onChange={(e) => setFormData({...formData, department: e.target.value})}
            style={input} disabled={submitting} />
          <input type="text" placeholder="Level (e.g. 300)" value={formData.level}
            onChange={(e) => setFormData({...formData, level: e.target.value})}
            style={input} disabled={submitting} />
          <input type="email" placeholder="Email (optional)" value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            style={input} disabled={submitting} />

          <button onClick={handlePay} disabled={submitting}
            style={{
              width: '100%',
              padding: '14px 0',
              background: submitting ? '#475569' : '#FFD700',
              color: '#0f172a',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '15px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}>
            {submitting ? '⏳ Processing...' : `💳 Pay ₦${Number(selectedPosition.amount).toLocaleString()}`}
          </button>
        </div>
      )}

      <p style={{ textAlign: 'center', color: '#475569', fontSize: '11px', marginTop: '24px' }}>
        NAMATL E-Voting © {new Date().getFullYear()}
      </p>
    </div>
  );
}