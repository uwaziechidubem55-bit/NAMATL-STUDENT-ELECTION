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
        if (data.openingDate && data.closingDate) {
          const openDt = new Date(data.openingDate + 'T' + (data.openingTime || '00:00'));
          const closeDt = new Date(data.closingDate + 'T' + (data.closingTime || '23:59'));
          if (now < openDt) setError('📅 Purchase opens ' + data.openingDate + ' at ' + (data.openingTime || '00:00'));
          else if (now > closeDt) setError('Purchase is closed, come back next year.');
          else if (!data.isActive) setError('Form purchase is currently disabled.');
        } else if (!data.isActive) {
          setError('Form purchase is currently disabled.');
        }
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
    // Check max candidates from general settings
    let maxCandidates = 5;
    getDoc(doc(db, 'settings', 'general')).then(snap => {
      if (snap.exists()) maxCandidates = snap.data().maxCandidatesPerPosition || 5;
    }).catch(() => {});

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
        public_key: import.meta.env.VITE_FLW_PUBLIC_KEY || '',
        tx_ref: txRef,
        amount: selectedPosition.amount,
        currency: 'NGN',
        payment_options: 'card,ussd,transfer,banktransfer',
        customer: { email: formData.email || 'candidate@namtel.edu.ng', name: formData.fullName },
        customizations: {
          title: 'NAMTEL Form Purchase',
          description: selectedPosition.position + ' candidacy form',
          logo: '/logo.png',
        },
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

  const styles = {
    page: { minHeight: '100vh', background: 'linear-gradient(135deg, #0a1628 0%, #061D3A 50%, #003366 100%)', color: 'white', fontFamily: 'system-ui, sans-serif', padding: '20px' },
    container: { maxWidth: '600px', margin: '0 auto' },
    card: { background: '#0f172a', borderRadius: '12px', padding: '20px', marginBottom: '16px', border: '1px solid #1e293b' },
    input: { width: '100%', padding: '12px 16px', marginBottom: '12px', background: '#0a1628', color: 'white', border: '1px solid #475569', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' },
    gold: { color: '#FFD700' },
    link: { color: '#FFD700', background: 'transparent', border: '1px solid rgba(255,215,0,0.2)', borderRadius: '0px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, transition: 'all 0.3s', display: 'inline-block', textDecoration: 'none' },
  };

  if (loading) return (
    <div style={styles.page}><div style={{ ...styles.container, textAlign: 'center', paddingTop: '40px' }}>
      <h2 style={styles.gold}>Loading...</h2>
    </div></div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ ...styles.gold, fontSize: '22px', margin: '0 0 8px' }}>
            🏛️ NAMATL STUDENT E-VOTING 
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
            Form Purchase Portal
          </p>
          <Link to="/" style={styles.link}
            onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.1)'; e.target.style.borderColor = '#FFD700'; }}
            onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'rgba(255,215,0,0.2)'; }}>
            ← Back to Home
          </Link>
        </div>

        {error && (
          <div style={{ ...styles.card, borderColor: '#dc2626', background: 'rgba(220,38,38,0.1)' }}>
            <p style={{ color: '#fca5a5', margin: 0, fontSize: '14px' }}>⛔ {error}</p>
            <Link to="/" style={{ ...styles.link, marginTop: '12px', fontSize: '13px' }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(148,163,184,0.08)'; e.target.style.borderColor = '#94a3b8'; }}
              onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'rgba(148,163,184,0.2)'; }}>
              ← Back to Home
            </Link>
          </div>
        )}

        {successMsg && (
          <div style={{ ...styles.card, borderColor: '#22c55e', background: 'rgba(34,197,94,0.1)' }}>
            <p style={{ color: '#22c55e', margin: 0, fontSize: '14px' }}>✅ {successMsg}</p>
          </div>
        )}

        {!error && settings && !selectedPosition && (
          <>
            <div style={{ ...styles.card, textAlign: 'center', border: '1px solid rgba(255,215,0,0.2)' }}>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                📅 {settings.openingDate || 'N/A'} — {settings.closingDate || 'N/A'}
              </p>
              {settings.positions?.length > 0 && (
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0' }}>
                  {settings.positions.length} position(s) | Max 5 per position
                </p>
              )}
            </div>
            <div style={styles.card}>
              <h2 style={{ ...styles.gold, fontSize: '16px', marginBottom: '16px' }}>
                📋 Select a Position
              </h2>
              {settings.positions?.map((pos, i) => {
                const count = getCount(pos.position);
                const full = count >= 5;
                return (
                  <div
                    key={i}
                    onClick={() => !full && handleSelect(pos)}
                    style={{
                      ...styles.card, cursor: full ? 'not-allowed' : 'pointer',
                      border: full ? '1px solid #dc2626' : '1px solid #334155',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      opacity: full ? 0.6 : 1,
                    }}
                  >
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: 'white' }}>{pos.position}</h3>
                      <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                        {count}/5 taken
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '0 0 2px', fontSize: '18px', fontWeight: 700, color: '#FFD700' }}>
                        ₦{Number(pos.amount).toLocaleString()}
                      </p>
                      {full && <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>FULL</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!error && settings && selectedPosition && (
          <div style={styles.card}>
            <button
              onClick={() => setSelectedPosition(null)}
              style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}
            >
              ← Back
            </button>
            <h2 style={{ ...styles.gold, fontSize: '16px', marginBottom: '8px' }}>
              ✍️ Fill Your Details for {selectedPosition.position}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
              Amount: <strong style={{ color: '#FFD700' }}>₦{Number(selectedPosition.amount).toLocaleString()}</strong>
            </p>
            <input placeholder="Full Name" value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              style={styles.input} disabled={submitting} />
            <input placeholder="Department" value={formData.department}
              onChange={(e) => setFormData({...formData, department: e.target.value})}
              style={styles.input} disabled={submitting} />
            <input placeholder="Level" value={formData.level}
              onChange={(e) => setFormData({...formData, level: e.target.value})}
              style={styles.input} disabled={submitting} />
            <input placeholder="Email (optional)" value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              style={styles.input} disabled={submitting} />
            <button
              onClick={handlePay}
              disabled={submitting}
              style={{
                width: '100%', padding: '14px', background: '#FFD700', color: '#061D3A',
                border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '16px',
                cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? '⏳ Processing...' : `💳 Pay ₦${Number(selectedPosition.amount).toLocaleString()}`}
            </button>
          </div>
        )}

        <p style={{ textAlign: 'center', color: '#475569', fontSize: '12px', marginTop: '24px' }}>
          NAMATL Student E-voting © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}