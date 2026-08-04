import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateFormCharges } from '../utils/flutterwaveCostCalculator';

export default function PurchaseForm({
  position: propPosition,
  adminPrice: propAdminPrice,
  candidateData: propCandidateData,
  onSuccess: propOnSuccess
} = {}) {
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
        setError('Form purchase not configured yet. Contact your Electoralcommission.');
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

  // Admin-set price for the currently selected position (prop overrides Firestore amount)
  const adminSetPrice = Number(propAdminPrice?? selectedPosition?.amount?? 0);
  // Single source of truth for what the candidate is charged
  const charges = selectedPosition? calculateFormCharges(adminSetPrice) : null;

  const handlePay = async () => {
    if (!formData.fullName.trim() ||!formData.department.trim() ||!formData.level.trim()) {
      alert('Fill all required fields'); return;
    }
    setSubmitting(true);
    try {
      const priceToCharge = calculateFormCharges(adminSetPrice);
      const txRef = 'FORM-' + selectedPosition.position.replace(/\s+/g, '-') + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
      const FLW = (await import('flutterwave-react-v3')).default;
      const checkout = new FLW({
        public_key: import.meta.env.VITE_FLW_PUBLIC_KEY,
        tx_ref: txRef,
        amount: priceToCharge.displayPrice, // ← candidate pays displayPrice
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
                amount: adminSetPrice, // admin price (unchanged contract)
                totalPaid: priceToCharge.displayPrice, // additive, safe
                candidateData: formData
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setSuccessMsg(verifyData.message);
              // ✅ Success callback — admin receives EXACTLY the admin-set price
              if (typeof propOnSuccess === 'function') {
                propOnSuccess({
                  adminReceives: adminSetPrice,
                  position: propPosition || selectedPosition.position,
                  candidateData: propCandidateData || formData,
                  totalCustomerPays: priceToCharge.displayPrice,
                  transaction_id: response.transaction_id
                });
              }
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
  const breakdownBox = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px' };
  const breakdownTitle = { fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' };
  const breakdownRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: '14px', color: '#334155' };

  // ═══ CHANGED: logo style for the page header (top center) ═══
  const logoStyle = {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '4px solid #FFD700',
    boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)',
    marginBottom: '12px',
    display: 'block',
    margin: '0 auto',
  };

  // ═══ CHANGED: Loading screen — NO logo, text centered only ═══
  const loadingScreen = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f7fa',
    textAlign: 'center',
    padding: '20px',
    boxSizing: 'border-box',
  };
  const loadingTitle = {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 8px 0',
  };
  const loadingText = {
    fontSize: '14px',
    color: '#64748b',
    margin: '0',
  };

  if (loading) return (
    <div style={loadingScreen}>
      <h2 style={loadingTitle}>⏳ Loading...</h2>
      <p style={loadingText}>Connecting to server...</p>
    </div>
  );

  return (
    <div style={page}>
      {/* ═══ CHANGED: Logo now lives here — top center, above the title ═══ */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <img
          src="/logo.png"
          alt="NAMTL Logo"
          style={logoStyle}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px', textAlign: 'center' }}>🏛️ NAMATL STUDENTS E-VOTING</h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0, textAlign: 'center' }}>Form Purchase Portal</p>
      </div>

      {/* ═══ CHANGED: top "← Back to Home" link REMOVED (only one at the bottom now) ═══ */}

      {error && (
        <div style={{...card, border: '1px solid #fecaca', background: '#fef2f2' }}>
          <div style={{ color: '#dc2626', fontSize: '15px' }}>
            ⛔ {error}
          </div>
          <button onClick={loadData} style={{ marginTop: '10px', padding: '8px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>🔄 Retry</button>
          {/* ═══ CHANGED: "← Back to Home" link inside the error box REMOVED ═══ */}
        </div>
      )}

      {successMsg && (
        <div style={{...card, border: '1px solid #bbf7d0', background: '#f0fdf4' }}>
          <div style={{ color: '#15803d', fontSize: '15px' }}>✅ {successMsg}</div>
        </div>
      )}

      {!error && settings &&!selectedPosition && (
        <>
          <div style={{...card, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            📅 {settings.openingDate} - {settings.closingDate}
            {settings.positions?.length > 0 && (
              <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                {settings.positions.length} position(s) | Max 5 per position
              </div>
            )}
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px' }}>📋 Select a Position</h2>
          {settings.positions?.map((pos, i) => {
            const count = getCount(pos.position);
            const full = count >= 5;
            return (
              <div
                key={i}
                onClick={() => handleSelect(pos)}
                style={{
                 ...card,
                  cursor: full? 'not-allowed' : 'pointer',
                  border: full? '1px solid #fecaca' : '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: full? 0.6 : 1
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{pos.position}</h3>
                  <div style={{ color: '#94a3b8', fontSize: '13px' }}>{count}/5 taken</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '700', fontSize: '16px' }}>₦{Number(pos.amount).toLocaleString()}</div>
                  {full && <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: '700' }}>FULL</span>}
                </div>
              </div>
            );
          })}
        </>
      )}

      {!error && settings && selectedPosition && charges && (
        <div>
          <button
            onClick={() => setSelectedPosition(null)}
            style={{ background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}
          >← Back</button>

          <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>✍️ Fill Your Details for {selectedPosition.position}</h2>

          {/* 💳 Payment breakdown — shown BEFORE payment */}
          <div style={breakdownBox}>
            <div style={breakdownTitle}>💳 Payment Breakdown</div>
            <div style={breakdownRow}>
              <span>Form Price</span>
              <span>₦{charges.breakdown['Form Price'].toLocaleString()}</span>
            </div>
            <div style={breakdownRow}>
              <span>VAT</span>
              <span>₦{charges.breakdown.VAT.toLocaleString()}</span>
            </div>
            <div style={breakdownRow}>
              <span>Service Charge</span>
              <span>₦{charges.breakdown['Service Charge'].toLocaleString()}</span>
            </div>
            <div style={{...breakdownRow, borderTop: '1px solid #cbd5e1', paddingTop: '10px', fontWeight: '700', fontSize: '16px' }}>
              <span>Total Amount</span>
              <span>₦{charges.totalCustomerPays.toLocaleString()}</span>
            </div>
          </div>

          <input placeholder="Full Name" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value })} style={input} disabled={submitting} />
          <input placeholder="Department" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value })} style={input} disabled={submitting} />
          <input placeholder="Level" value={formData.level} onChange={(e) => setFormData({...formData, level: e.target.value })} style={input} disabled={submitting} />
          <input placeholder="Email (optional)" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value })} style={input} disabled={submitting} />

          <button
            onClick={handlePay}
            disabled={submitting}
            style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '16px', cursor: submitting? 'not-allowed' : 'pointer', opacity: submitting? 0.6 : 1 }}
          >
            {submitting? '⏳ Processing...' : `💳 Pay ₦${charges.totalCustomerPays.toLocaleString()}`}
          </button>
        </div>
      )}

      {/* ═══ CHANGED: single "← Back to Home" link — at the bottom, above the footer ═══ */}
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <Link to="/" style={{ color: '#2563eb', fontSize: '14px', textDecoration: 'none' }}>← Back to Home</Link>
      </div>

      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '12px' }}>
        NAMATL Students E-voting © {new Date().getFullYear()}
      </div>
    </div>
  );
}