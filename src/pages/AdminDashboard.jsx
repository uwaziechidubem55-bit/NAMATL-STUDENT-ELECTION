import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { collection, addDoc, getDocs, getDoc, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useDataCharge } from '../context/DataChargeContext';

const MAX_PER_POSITION = 5;

/** Retry helper: faster with long-polling enabled */
async function firestoreRetry(fn, retries = 2, delayMs = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err.message || '';
      const isOffline = msg.includes('offline') || msg.includes('unavailable') || msg.includes('permission-denied');
      if (attempt < retries && isOffline) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const {
    withdrawalBalance, withdraw, loadBalance, loadFormPurchases, saveFormPurchaseSettings,
    formPurchaseSettings, formPurchases, ADMIN_ID, WITHDRAWAL_PIN, OPAY_ACCOUNT
  } = useDataCharge();

  // ── Sidebar ──
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Candidates ──
  const [candidates, setCandidates] = useState([]);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [dept, setDept] = useState('');
  const [manifesto, setManifesto] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [editingCandidate, setEditingCandidate] = useState(null);

  // ── Settings ──
  const [settings, setSettings] = useState({
    year: '', startDate: '', startTime: '', endDate: '', endTime: '', isActive: false
  });

  // ── Withdrawal ──
  const [withdrawAdminId, setWithdrawAdminId] = useState('');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMsg, setWithdrawMsg] = useState({ type: '', text: '' });

  // ── Voters & Messages ──
  const [voters, setVoters] = useState([]);
  const [supportMessages, setSupportMessages] = useState([]);

  // ── Form Purchase ──
  const [fpPositions, setFpPositions] = useState([]);
  const [fpOpeningDate, setFpOpeningDate] = useState('');
  const [fpClosingDate, setFpClosingDate] = useState('');
  const [fpOpeningTime, setFpOpeningTime] = useState('');
  const [fpClosingTime, setFpClosingTime] = useState('');
  const [fpIsActive, setFpIsActive] = useState(false);
  const [fpNewPosition, setFpNewPosition] = useState('');
  const [fpNewAmount, setFpNewAmount] = useState('');
  const [fpSaving, setFpSaving] = useState(false);
  const [fpMsg, setFpMsg] = useState('');
  const [fpCandidateCounts, setFpCandidateCounts] = useState({});

  // ── Load All Data ──
  const loadAllData = async () => {
    setLoading(true);
    setError('');

    try {
      const [candidatesSnap, settingsSnap, supportSnap] = await Promise.all([
        firestoreRetry(() => getDocs(collection(db, 'candidates'))),
        firestoreRetry(() => getDoc(doc(db, 'settings', 'election'))),
        firestoreRetry(() => getDocs(collection(db, 'supportMessages')))
      ]);

      // Candidates
      const cData = [];
      candidatesSnap.forEach(d => cData.push({ id: d.id, ...d.data() }));
      setCandidates(cData);

      // Candidate counts per position
      const counts = {};
      cData.forEach(c => { counts[c.position] = (counts[c.position] || 0) + 1; });
      setFpCandidateCounts(counts);

      // Settings
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data());
      }

      // Support messages
      const mData = [];
      supportSnap.forEach(d => mData.push({ id: d.id, ...d.data() }));
      setSupportMessages(mData);

      // Background: voters, balance, form purchases
      try {
        const votersSnap = await firestoreRetry(() => getDocs(collection(db, 'students')));
        const vData = [];
        votersSnap.forEach(d => vData.push({ id: d.id, ...d.data() }));
        setVoters(vData);
      } catch (e) { console.log('[Admin] voters load non-fatal:', e.message); }

      try {
        await Promise.all([loadBalance(), loadFormPurchases()]);
      } catch (e) { console.log('[Admin] balance/fp load non-fatal:', e.message); }

      setLoading(false);
    } catch (e) {
      console.error('[Admin] Data loading error:', e);
      const msg = e.message || '';
      if (msg.includes('offline') || msg.includes('unavailable')) {
        setError('Cannot reach Firestore. Please go to Firebase Console > Firestore Database > Create Database, set rules to allow read/write.');
      } else {
        setError('Failed to load data: ' + msg.substring(0, 150));
      }
      setLoading(false);
    }
  };

  useEffect(() => { loadAllData(); }, []);

  useEffect(() => {
    if (formPurchaseSettings) {
      setFpPositions(formPurchaseSettings.positions || []);
      setFpOpeningDate(formPurchaseSettings.openingDate || '');
      setFpClosingDate(formPurchaseSettings.closingDate || '');
      setFpOpeningTime(formPurchaseSettings.openingTime || '');
      setFpClosingTime(formPurchaseSettings.closingTime || '');
      setFpIsActive(formPurchaseSettings.isActive || false);
    }
  }, [formPurchaseSettings]);

  // ── Computed ──
  const totalVotes = candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
  const sortedByVotes = [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const unreadMessages = supportMessages.filter(m => m.status === 'unread').length;
  const activeVoters = voters.filter(v => v.hasVoted).length;

  // ── Sidebar ──
  const sidebarItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'settings', label: 'Election Settings', icon: '⚙️' },
    { key: 'candidates', label: 'Manage Candidates', icon: '👥' },
    { key: 'results', label: 'Election Results', icon: '📈' },
    { key: 'form-purchase', label: 'Form Purchase', icon: '📋' },
    { key: 'withdrawal', label: 'Withdraw Funds', icon: '💰' },
    { key: 'messages', label: `Messages (${unreadMessages})`, icon: '✉️' },
  ];

  // ── Styles ──
  const inputStyle = {
    width: '100%', padding: '12px 14px', border: '1px solid #ddd',
    borderRadius: '8px', marginBottom: '12px', boxSizing: 'border-box',
    fontSize: '14px', outline: 'none'
  };
  const cardStyle = {
    background: 'white', borderRadius: '12px', padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: '20px'
  };
  const statCardStyle = {
    background: 'white', borderRadius: '12px', padding: '20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)', textAlign: 'center',
    flex: '1', minWidth: '200px'
  };
  const btnPrimary = {
    padding: '12px 24px', background: '#003366', color: 'white',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontWeight: 'bold', fontSize: '14px'
  };
  const btnDanger = { ...btnPrimary, background: '#dc2626' };
  const btnSuccess = { ...btnPrimary, background: '#16a34a' };

  // ── Handlers ──
  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'election'), settings, { merge: true });
      alert('✅ Election settings saved!');
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleSaveCandidate = async () => {
    if (!name || !position || !dept) { alert('Name, position and dept required'); return; }
    try {
      if (editingCandidate) {
        await updateDoc(doc(db, 'candidates', editingCandidate.id), { name, position, dept, manifesto });
      } else {
        const posCount = candidates.filter(c => c.position === position).length;
        if (posCount >= MAX_PER_POSITION) {
          alert(`Maximum ${MAX_PER_POSITION} candidates for ${position}`); return;
        }
        let photoURL = '';
        if (photo) {
          const storageRef = ref(storage, `candidates/${Date.now()}_${photo.name}`);
          await uploadBytes(storageRef, photo);
          photoURL = await getDownloadURL(storageRef);
        }
        await addDoc(collection(db, 'candidates'), {
          name, position, dept, level: '', email: '', votes: 0,
          photo: photoURL, manifesto, paidForm: false
        });
      }
      setName(''); setPosition(''); setDept(''); setManifesto('');
      setPhoto(null); setPhotoPreview(''); setEditingCandidate(null);
      loadAllData();
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleEditCandidate = (c) => {
    setEditingCandidate(c);
    setName(c.name); setPosition(c.position); setDept(c.dept);
    setManifesto(c.manifesto || '');
    setPhotoPreview(c.photo || '');
  };

  const handleDeleteCandidate = async (id) => {
    if (!window.confirm('Delete this candidate?')) return;
    try { await deleteDoc(doc(db, 'candidates', id)); loadAllData(); }
    catch (e) { alert('Error: ' + e.message); }
  };

  const handleWithdraw = async () => {
    if (!withdrawAdminId || !withdrawPin || !withdrawAmount) {
      setWithdrawMsg({ type: 'error', text: 'Fill all withdrawal fields' }); return;
    }
    const amount = Number(withdrawAmount);
    setWithdrawMsg({ type: '', text: 'Processing...' });
    const result = await withdraw(withdrawAdminId, withdrawPin, amount);
    if (result.success) {
      setWithdrawMsg({ type: 'success', text: result.message });
      setWithdrawAmount(''); setWithdrawPin(''); loadBalance();
    } else {
      setWithdrawMsg({ type: 'error', text: result.message });
    }
  };

  const handleFpAddPosition = () => {
    if (!fpNewPosition || !fpNewAmount) { alert('Position name and amount required'); return; }
    if (fpPositions.find(p => p.position === fpNewPosition.trim())) { alert('Position already exists'); return; }
    setFpPositions([...fpPositions, { position: fpNewPosition.trim(), amount: Number(fpNewAmount) }]);
    setFpNewPosition(''); setFpNewAmount('');
  };

  const handleFpRemovePosition = (index) => {
    setFpPositions(fpPositions.filter((_, i) => i !== index));
  };

  const handleFpSaveSettings = async () => {
    if (!fpPositions.length) { alert('Add at least one position'); return; }
    setFpSaving(true); setFpMsg('Saving...');
    const result = await saveFormPurchaseSettings({
      isActive: fpIsActive, openingDate: fpOpeningDate, closingDate: fpClosingDate,
      openingTime: fpOpeningTime, closingTime: fpClosingTime, positions: fpPositions
    });
    setFpMsg(result.message);
    if (result.success) { setTimeout(() => setFpMsg(''), 3000); }
    setFpSaving(false);
  };

  // ── Loading / Error ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ color: '#FFD700', fontSize: '20px', fontWeight: 'bold' }}>Loading Admin Panel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: 'Arial, sans-serif' }}>
        <h2 style={{ color: '#ef4444' }}>ERROR</h2>
        <p style={{ color: 'white', textAlign: 'center', maxWidth: '500px', padding: '16px' }}>{error}</p>
        <button onClick={loadAllData} style={{ padding: '10px 24px', background: '#FFD700', color: '#003366', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '16px' }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Arial, sans-serif' }}>

      {/* ── SIDEBAR ── */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
             style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} />
      )}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: '250px',
        background: '#001a33', zIndex: 50, padding: '20px 16px',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-260px)',
        transition: 'transform 0.3s ease', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ color: '#FFD700', margin: 0 }}>NAMATLS Admin</h3>
          <button onClick={() => setSidebarOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#FFD700', fontSize: '24px', cursor: 'pointer', padding: 0 }}>×</button>
        </div>
        {sidebarItems.map(item => (
          <div key={item.key} onClick={() => { setActiveView(item.key); setSidebarOpen(false); }}
               style={{
                 display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                 marginBottom: '4px', borderRadius: '8px', cursor: 'pointer',
                 background: activeView === item.key ? 'rgba(255,215,0,0.15)' : 'transparent',
                 color: activeView === item.key ? '#FFD700' : 'rgba(255,255,255,0.8)',
                 fontWeight: activeView === item.key ? 'bold' : 'normal'
               }}
               onMouseEnter={(e) => { if (activeView !== item.key) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
               onMouseLeave={(e) => { if (activeView !== item.key) e.currentTarget.style.background = 'transparent'; }}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
        <button onClick={() => navigate('/admin-login')}
                style={{
                  width: '100%', padding: '12px', marginTop: '20px',
                  background: 'rgba(255,255,255,0.1)', color: 'white',
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px',
                  cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
                }}
                onMouseEnter={(e) => { e.target.style.background = '#dc2626'; e.target.style.borderColor = '#dc2626'; }}
                onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.borderColor = 'rgba(255,255,255,0.2)'; }}>
          Logout
        </button>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>

        {/* HEADER */}
        <div style={{
          background: '#003366', borderRadius: '12px', padding: '16px 24px',
          marginBottom: '20px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setSidebarOpen(true)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <span style={{ display: 'block', width: '18px', height: '2px', background: '#FFD700' }}></span>
              <span style={{ display: 'block', width: '18px', height: '2px', background: '#FFD700' }}></span>
              <span style={{ display: 'block', width: '18px', height: '2px', background: '#FFD700' }}></span>
            </button>
            <div>
              <h2 style={{ margin: 0, color: '#FFD700' }}>Admin Dashboard</h2>
              <span style={{ fontSize: '12px', opacity: 0.8 }}>BROUTE</span>
            </div>
          </div>
          <span style={{ fontSize: '13px', opacity: 0.7 }}>₦{withdrawalBalance.toLocaleString()}</span>
        </div>

        {/* ===== DASHBOARD VIEW ===== */}
        {activeView === 'dashboard' && (
          <>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>👥</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{candidates.length}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Total Candidates</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗳️</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{activeVoters}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Votes Cast</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📋</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{Object.keys(candidates.reduce((acc, c) => { acc[c.position] = true; return acc; }, {})).length}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Positions</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>💰</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>₦{withdrawalBalance.toLocaleString()}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Balance</div>
              </div>
            </div>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', marginBottom: '16px' }}>Quick Actions</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveView('settings')} style={btnPrimary}>⚙️ Election Settings</button>
                <button onClick={() => setActiveView('candidates')} style={{ ...btnPrimary, background: '#2563eb' }}>👥 Manage Candidates</button>
                <button onClick={() => setActiveView('results')} style={{ ...btnPrimary, background: '#16a34a' }}>📈 View Results</button>
                <button onClick={() => setActiveView('form-purchase')} style={{ ...btnPrimary, background: '#8b5cf6' }}>📋 Form Purchase</button>
                <button onClick={() => setActiveView('withdrawal')} style={{ ...btnPrimary, background: '#f59e0b' }}>💰 Withdraw Funds</button>
              </div>
            </div>
          </>
        )}

        {/* ===== ELECTION SETTINGS VIEW ===== */}
        {activeView === 'settings' && (
          <div style={cardStyle}>
            <h2 style={{ color: '#003366', marginBottom: '16px' }}>⚙️ Election Settings</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Year</label>
                <input value={settings.year} onChange={(e) => setSettings({ ...settings, year: e.target.value })} style={inputStyle} placeholder="e.g. 2026/2027" />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Active</label>
                <select value={settings.isActive ? 'true' : 'false'} onChange={(e) => setSettings({ ...settings, isActive: e.target.value === 'true' })} style={inputStyle}>
                  <option value="false">Disabled</option>
                  <option value="true">Active</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Start Date</label>
                <input type="date" value={settings.startDate} onChange={(e) => setSettings({ ...settings, startDate: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Start Time</label>
                <input type="time" value={settings.startTime} onChange={(e) => setSettings({ ...settings, startTime: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>End Date</label>
                <input type="date" value={settings.endDate} onChange={(e) => setSettings({ ...settings, endDate: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>End Time</label>
                <input type="time" value={settings.endTime} onChange={(e) => setSettings({ ...settings, endTime: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <button onClick={handleSaveSettings} style={{ ...btnPrimary, marginTop: '16px' }}>💾 Save Settings</button>
          </div>
        )}

        {/* ===== CANDIDATES VIEW ===== */}
        {activeView === 'candidates' && (
          <div style={cardStyle}>
            <h2 style={{ color: '#003366', marginBottom: '16px' }}>👥 Edit Candidates</h2>
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>{editingCandidate ? '✏️ Edit Candidate' : '➕ Add New Candidate'}</h3>
              <input placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              <input placeholder="Position" value={position} onChange={(e) => setPosition(e.target.value)} style={inputStyle} />
              <input placeholder="Department" value={dept} onChange={(e) => setDept(e.target.value)} style={inputStyle} />
              <textarea placeholder="Manifesto (optional)" value={manifesto} onChange={(e) => setManifesto(e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files[0]; if (f) { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); }}} />
              {photoPreview && <img src={photoPreview} alt="Preview" style={{ width: '100px', height: '100px', borderRadius: '8px', objectFit: 'cover', display: 'block', margin: '8px 0' }} />}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={handleSaveCandidate} style={btnSuccess}>{editingCandidate ? '✏️ Update' : '➕ Add'}</button>
                {editingCandidate && (
                  <button onClick={() => { setEditingCandidate(null); setName(''); setPosition(''); setDept(''); setManifesto(''); setPhoto(null); setPhotoPreview(''); }} style={btnDanger}>Cancel</button>
                )}
              </div>
            </div>
            {candidates.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center' }}>No candidates added yet</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#003366', color: 'white' }}>
                      <th style={{ padding: '12px', textAlign: 'left' }}>S/N</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Position</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Votes</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px' }}>{i + 1}</td>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{c.name}</td>
                        <td style={{ padding: '12px', color: '#666' }}>{c.position}</td>
                        <td style={{ padding: '12px' }}>{c.votes || 0}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button onClick={() => handleEditCandidate(c)} style={{ padding: '6px 14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginRight: '8px', fontSize: '13px' }}>Edit</button>
                          <button onClick={() => handleDeleteCandidate(c.id)} style={{ padding: '6px 14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===== RESULTS VIEW ===== */}
        {activeView === 'results' && (
          <div style={cardStyle}>
            <h2 style={{ color: '#003366', marginBottom: '16px' }}>📈 Election Results</h2>
            {candidates.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center' }}>No candidates have been added yet.</p>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#003366', color: 'white' }}>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Position</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Rank</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Candidate</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>Votes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedByVotes.map((c, idx) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px', color: '#666', fontSize: '13px' }}>{c.position}</td>
                          <td style={{ padding: '12px', fontWeight: 'bold', fontSize: '18px', color: idx === 0 ? '#FFD700' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7f32' : '#003366' }}>{idx + 1}</td>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>{c.name}</td>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#003366', fontSize: '18px' }}>{c.votes || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => window.print()} style={{ ...btnPrimary, marginTop: '16px' }}>🖨️ Print Results</button>
              </>
            )}
          </div>
        )}

        {/* ===== FORM PURCHASE VIEW ===== */}
        {activeView === 'form-purchase' && (
          <>
            <div style={cardStyle}>
              <h2 style={{ color: '#003366', marginBottom: '4px' }}>📋 Form Purchase Settings</h2>
              <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>Configure positions, prices, and availability for candidate form purchase</p>
              {fpMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                  background: fpMsg.includes('Error') ? '#fee2e2' : '#d1fae5',
                  color: fpMsg.includes('Error') ? '#dc2626' : '#16a34a', fontWeight: 'bold', fontSize: '14px'
                }}>{fpMsg}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Opening Date</label>
                  <input type="date" value={fpOpeningDate} onChange={(e) => setFpOpeningDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Opening Time</label>
                  <input type="time" value={fpOpeningTime} onChange={(e) => setFpOpeningTime(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Closing Date</label>
                  <input type="date" value={fpClosingDate} onChange={(e) => setFpClosingDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>Closing Time</label>
                  <input type="time" value={fpClosingTime} onChange={(e) => setFpClosingTime(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '4px' }}>
                  <input type="checkbox" checked={fpIsActive} onChange={(e) => setFpIsActive(e.target.checked)} style={{ marginRight: '8px' }} />
                  Form Purchase Active
                </label>
              </div>
              <h3 style={{ color: '#003366', marginBottom: '12px' }}>Positions & Pricing</h3>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '2px' }}>Position Name</label>
                  <input value={fpNewPosition} onChange={(e) => setFpNewPosition(e.target.value)} placeholder="e.g. President" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '2px' }}>Amount (₦)</label>
                  <input type="number" value={fpNewAmount} onChange={(e) => setFpNewAmount(e.target.value)} placeholder="e.g. 5000" style={inputStyle} />
                </div>
                <button onClick={handleFpAddPosition} style={{ ...btnPrimary, whiteSpace: 'nowrap', padding: '12px 20px' }}>➕ Add</button>
              </div>
              {fpPositions.length === 0 ? (
                <p style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No positions added yet</p>
              ) : (
                <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#003366', color: 'white' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>S/N</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Position</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Taken</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fpPositions.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px' }}>{i + 1}</td>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.position}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>₦{Number(p.amount).toLocaleString()}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{
                              background: (fpCandidateCounts[p.position] || 0) >= 5 ? '#fee2e2' : '#d1fae5',
                              color: (fpCandidateCounts[p.position] || 0) >= 5 ? '#dc2626' : '#16a34a',
                              padding: '2px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold'
                            }}>{(fpCandidateCounts[p.position] || 0)}/5</span>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button onClick={() => handleFpRemovePosition(i)} style={{ padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button onClick={handleFpSaveSettings} disabled={fpSaving} style={{ ...btnPrimary, background: fpSaving ? '#999' : '#003366' }}>
                {fpSaving ? '⏳ Saving...' : '💾 Save Form Purchase Settings'}
              </button>
            </div>

            {formPurchases.length > 0 && (
              <div style={cardStyle}>
                <h3 style={{ color: '#003366', marginBottom: '12px' }}>📋 Purchase History ({formPurchases.length})</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#003366', color: 'white' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Position</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formPurchases.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.fullName}</td>
                          <td style={{ padding: '10px', color: '#666' }}>{p.position}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#16a34a', fontWeight: 'bold' }}>₦{Number(p.amount).toLocaleString()}</td>
                          <td style={{ padding: '10px', fontSize: '13px', color: '#888' }}>{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'N/A'}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{ background: '#d1fae5', color: '#16a34a', padding: '2px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>Paid</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== WITHDRAWAL VIEW ===== */}
        {activeView === 'withdrawal' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={cardStyle}>
              <h2 style={{ color: '#003366', marginBottom: '16px' }}>💰 Withdraw Funds</h2>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '6px' }}>Available Balance</p>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#16a34a', margin: '0 0 20px 0' }}>₦{withdrawalBalance.toLocaleString()}</p>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: '#888', margin: '0 0 4px 0' }}>Beneficiary</p>
                <p style={{ fontWeight: 'bold', margin: 0 }}>{OPAY_ACCOUNT} (Opay)</p>
              </div>
              <input placeholder="Admin ID" value={withdrawAdminId} onChange={(e) => setWithdrawAdminId(e.target.value)} style={inputStyle} />
              <input type="password" placeholder="Withdrawal PIN" value={withdrawPin} onChange={(e) => setWithdrawPin(e.target.value)} style={inputStyle} />
              <input type="number" placeholder="Amount (₦)" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} style={inputStyle} />
              <button onClick={handleWithdraw} style={{ ...btnPrimary, width: '100%', padding: '14px', background: '#f59e0b', color: '#003366', fontSize: '16px' }}>💸 Withdraw to Opay</button>
              {withdrawMsg.text && (
                <div style={{
                  padding: '12px', borderRadius: '8px', marginTop: '16px', fontSize: '14px', fontWeight: 'bold',
                  background: withdrawMsg.type === 'error' ? '#fee2e2' : '#d1fae5',
                  color: withdrawMsg.type === 'error' ? '#dc2626' : '#16a34a',
                }}>{withdrawMsg.text}</div>
              )}
            </div>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', marginBottom: '12px' }}>Quick Stats</h3>
              <div style={{ padding: '14px', borderBottom: '1px solid #eee' }}>
                <span style={{ color: '#888', fontSize: '13px' }}>Admin ID</span>
                <p style={{ fontWeight: 'bold', margin: '4px 0 0 0', fontSize: '14px', wordBreak: 'break-all' }}>{ADMIN_ID}</p>
              </div>
              <div style={{ padding: '14px', borderBottom: '1px solid #eee' }}>
                <span style={{ color: '#888', fontSize: '13px' }}>Withdrawal PIN</span>
                <p style={{ fontWeight: 'bold', margin: '4px 0 0 0' }}>**** (hidden)</p>
              </div>
              <div style={{ padding: '14px' }}>
                <span style={{ color: '#888', fontSize: '13px' }}>Total Candidates</span>
                <p style={{ fontWeight: 'bold', margin: '4px 0 0 0' }}>{candidates.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* ===== MESSAGES VIEW ===== */}
        {activeView === 'messages' && (
          <div style={cardStyle}>
            <h2 style={{ color: '#003366', marginBottom: '16px' }}>✉️ Support Messages ({supportMessages.length})</h2>
            {supportMessages.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center' }}>No messages yet</p>
            ) : (
              <div>
                {supportMessages.map((msg) => (
                  <div key={msg.id} style={{
                    padding: '16px', borderBottom: '1px solid #eee',
                    background: msg.status === 'unread' ? '#f0f7ff' : 'transparent'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong>{msg.name}</strong>
                      <span style={{ fontSize: '12px', color: '#888' }}>
                        {msg.timestamp?.toDate?.()?.toLocaleString() || 'N/A'}
                        {msg.status === 'unread' && <span style={{ background: '#2563eb', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', marginLeft: '8px' }}>New</span>}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 4px 0', color: '#666' }}>{msg.message}</p>
                    {msg.email !== 'Not provided' && <span style={{ fontSize: '12px', color: '#888' }}>📧 {msg.email}</span>}
                    {msg.status === 'unread' && (
                      <button onClick={async () => { try { await updateDoc(doc(db, 'supportMessages', msg.id), { status: 'read' }); loadAllData(); } catch(e) {} }}
                              style={{ marginLeft: '12px', padding: '4px 10px', background: 'transparent', color: '#2563eb', border: '1px solid #2563eb', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                        Mark Read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}