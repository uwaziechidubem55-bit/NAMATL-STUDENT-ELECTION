import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useDataCharge } from '../context/DataChargeContext';

export default function PurchaseForm() {
  const { purchaseForm } = useDataCharge();
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
      candidatesSnap.forEach(d => {
        const pos = d.data().position;
        counts[pos] = (counts[pos] || 0) + 1;
      });
      setPositionCounts(counts);
    } catch (e) {
      setError('Error loading data: ' + e.message);
    }
    setLoading(false);
  };

  const getCount = (position) => positionCounts[position] || 0;

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
      const result = await purchaseForm(selectedPosition.position, selectedPosition.amount, formData);
      if (result.success) {
        setSuccessMsg(result.message);
        setSelectedPosition(null);
        setFormData({ fullName: '', department: '', level: '', email: '' });
        loadData();
      } else {
        alert('❌ ' + result.message);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setSubmitting(false);
  };

  const containerStyle = {
    minHeight: '100vh',
    background: '#f0f2f5',
    fontFamily: 'Arial, sans-serif',
    padding: '20px'
  };

  const cardStyle = {
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    marginBottom: '16px',
    maxWidth: '600px',
    margin: '0 auto 16px auto'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    marginBottom: '12px',
    boxSizing: 'border-box',
    fontSize: '14px',
    outline: 'none'
  };

  const btnStyle = {
    padding: '12px 24px',
    background: '#003366',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '15px',
    transition: 'background 0.2s'
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', paddingTop: '40px', color: '#003366' }}>
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ color: '#003366', margin: '0 0 4px 0' }}>🏛️ NAMTLS STUDENT E-VOTING</h1>
        <p style={{ color: '#666', margin: '0 0 16px 0', fontSize: '14px' }}>Form Purchase Portal</p>
        <Link to="/" style={{ ...btnStyle, background: 'transparent', color: '#003366', border: '1px solid #003366', textDecoration: 'none', display: 'inline-block' }}>← Back to Home</Link>
      </div>

      {error && (
        <div style={{ ...cardStyle, border: '1px solid #fecaca', background: '#fef2f2' }}>
          <p style={{ color: '#dc2626', margin: 0, fontWeight: 'bold' }}>⛔ {error}</p>
          <Link to="/" style={{ color: '#003366', display: 'inline-block', marginTop: '12px' }}>← Back to Home</Link>
        </div>
      )}

      {successMsg && (
        <div style={{ ...cardStyle, border: '1px solid #bbf7d0', background: '#f0fdf4' }}>
          <p style={{ color: '#16a34a', margin: 0, fontWeight: 'bold' }}>✅ {successMsg}</p>
        </div>
      )}

      {!error && settings && !selectedPosition && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, color: '#003366' }}>📋 Select a Position</h2>
            <span style={{ fontSize: '13px', color: '#666' }}>📅 {settings.openingDate || 'N/A'} — {settings.closingDate || 'N/A'}</span>
          </div>
          {settings.positions?.length > 0 && (
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
              {settings.positions.length} position(s) | Max 5 per position
            </p>
          )}

          {settings.positions?.map((pos, i) => {
            const count = getCount(pos.position);
            const full = count >= 5;
            return (
              <div
                key={i}
                onClick={() => !full && handleSelect(pos)}
                style={{
                  padding: '16px',
                  border: full ? '2px solid #dc2626' : '2px solid #e5e7eb',
                  borderRadius: '10px',
                  marginBottom: '12px',
                  cursor: full ? 'not-allowed' : 'pointer',
                  opacity: full ? 0.5 : 1,
                  transition: 'border-color 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onMouseEnter={(e) => { if (!full) e.currentTarget.style.borderColor = '#003366'; }}
                onMouseLeave={(e) => { if (!full) e.currentTarget.style.borderColor = '#e5e7eb'; }}
              >
                <div>
                  <h3 style={{ margin: '0 0 4px 0', color: '#003366' }}>{pos.position}</h3>
                  <span style={{ fontSize: '13px', color: '#888' }}>{count}/5 taken</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#003366' }}>₦{Number(pos.amount).toLocaleString()}</div>
                  {full && <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: 'bold' }}>FULL</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!error && settings && selectedPosition && (
        <div style={cardStyle}>
          <button
            onClick={() => setSelectedPosition(null)}
            style={{ background: 'transparent', color: '#666', border: '1px solid #ddd', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}
          >
            ← Back
          </button>

          <h2 style={{ margin: '0 0 8px 0', color: '#003366' }}>✍️ Fill Your Details for {selectedPosition.position}</h2>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
            Amount: <strong style={{ color: '#003366' }}>₦{Number(selectedPosition.amount).toLocaleString()}</strong>
          </p>

          <input placeholder="Full Name *" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} style={inputStyle} disabled={submitting} />
          <input placeholder="Department *" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} style={inputStyle} disabled={submitting} />
          <input placeholder="Level *" value={formData.level} onChange={(e) => setFormData({...formData, level: e.target.value})} style={inputStyle} disabled={submitting} />
          <input placeholder="Email (optional)" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} style={inputStyle} disabled={submitting} />

          <button
            onClick={handlePay}
            disabled={submitting}
            style={{
              ...btnStyle,
              width: '100%',
              padding: '14px',
              background: submitting ? '#999' : '#003366',
              fontSize: '16px'
            }}
          >
            {submitting ? '⏳ Processing...' : `💳 Pay ₦${Number(selectedPosition.amount).toLocaleString()}`}
          </button>
        </div>
      )}

      <p style={{ textAlign: 'center', color: '#999', fontSize: '13px', paddingTop: '16px' }}>
        NAMTLS Student E-voting © {new Date().getFullYear()}
      </p>

    </div>
  );
}