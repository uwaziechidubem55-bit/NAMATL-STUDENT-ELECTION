import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useDataCharge } from '../context/DataChargeContext';

const MAX_PER_POSITION = 5;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { withdrawalBalance, withdraw, checkActivationCost, processActivationPayment, ADMIN_ID, WITHDRAWAL_PIN, OPAY_ACCOUNT, formPurchaseSettings, saveFormPurchaseSettings, formPurchases, loadFormPurchases } = useDataCharge();

  // ─── Sidebar ───
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');

  // ─── Loading / Error ───
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ─── Candidates ───
  const [candidates, setCandidates] = useState([]);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [dept, setDept] = useState('');
  const [manifesto, setManifesto] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [editingCandidate, setEditingCandidate] = useState(null);

  // ─── Election Settings (Activation) ───
  const [settings, setSettings] = useState({
    year: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    isActive: false
  });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState({ type: '', text: '' });

  // ─── Withdrawal ───
  const [withdrawAdminId, setWithdrawAdminId] = useState('');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMsg, setWithdrawMsg] = useState({ type: '', text: '' });

  // ─── General Settings ───
  const [generalSettings, setGeneralSettings] = useState({
    siteName: 'NAMATL Student E-Voting',
    electionTitle: 'NAMATL STUDENT E-VOTING',
    institutionName: 'Federal University of Petroleum Resources',
    departmentName: 'Maritime Transport and Logistics',
    contactEmail: 'admin@namtls.edu.ng',
    academicYear: '',
    maxCandidatesPerPosition: 5,
    votingType: 'single', // single or points
    pointsPerVoter: 1,
    requireMatricVerification: true,
    allowResultsPublic: false,
    maintenanceMode: false,
    customFooter: ''
  });
  const [generalSaved, setGeneralSaved] = useState(false);
  const [generalMsg, setGeneralMsg] = useState({ type: '', text: '' });

  // ─── Support Messages ───
  const [supportMessages, setSupportMessages] = useState([]);

  // ─── Activation ───
  const [activationYear, setActivationYear] = useState('');
  const [activationInfo, setActivationInfo] = useState(null);
  const [activating, setActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState({ type: '', text: '' });

  // ─── Load Data ───
  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      // Load candidates
      try {
        const snap = await getDocs(collection(db, 'candidates'));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setCandidates(list);
      } catch (e) { console.error('Candidates load error:', e); }

      // Load election settings
      try {
        const snap = await getDoc(doc(db, 'settings', 'main'));
        if (snap.exists()) {
          setSettings(prev => ({ ...prev, ...snap.data() }));
        }
      } catch (e) { console.error('Settings load error:', e); }

      // Load general settings
      try {
        const snap = await getDoc(doc(db, 'settings', 'general'));
        if (snap.exists()) {
          setGeneralSettings(prev => ({ ...prev, ...snap.data() }));
        }
      } catch (e) { console.error('General settings load error:', e); }

      // Load support messages
      try {
        const snap = await getDocs(collection(db, 'supportMessages'));
        const msgs = [];
        snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
        setSupportMessages(msgs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
      } catch (e) { console.error('Support load error:', e); }

      // Load form purchase settings
      try {
        const snap = await getDoc(doc(db, 'settings', 'formPurchase'));
        if (snap.exists()) {
          setFormPurchaseCfg(prev => ({ ...prev, ...snap.data() }));
        }
      } catch (e) { console.error('Form purchase load error:', e); }
  };

  // ─── Computed ───
  const totalVotes = candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
  const sortedByVotes = [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));

  const getPhase = () => {
    if (!settings.isActive || !settings.startDate) return { label: 'Not Configured', color: '#6b7280' };
    const now = new Date();
    const start = new Date(settings.startDate + 'T' + (settings.startTime || '00:00'));
    const end = new Date(settings.endDate + 'T' + (settings.endTime || '23:59'));
    if (now < start) return { label: 'Coming Soon', color: '#f59e0b' };
    if (now > end) return { label: 'Ended', color: '#dc2626' };
    return { label: 'Live', color: '#16a34a' };
  };
  const phase = getPhase();

  const unreadCount = supportMessages.filter(m => m.status === 'unread').length;

  // ─── Save Election Settings ───
  const saveSettings = async () => {
    setSettingsMsg({ type: '', text: '' });
    try {
      await setDoc(doc(db, 'settings', 'main'), settings, { merge: true });
      setSettingsSaved(true);
      setSettingsMsg({ type: 'success', text: 'Election settings saved!' });
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (e) {
      setSettingsMsg({ type: 'error', text: 'Save failed: ' + e.message });
    }
  };

  // ─── Save General Settings ───
  const saveGeneralSettings = async () => {
    setGeneralMsg({ type: '', text: '' });
    try {
      await setDoc(doc(db, 'settings', 'general'), generalSettings, { merge: true });
      setGeneralSaved(true);
      setGeneralMsg({ type: 'success', text: 'General settings saved!' });
      setTimeout(() => setGeneralSaved(false), 3000);
    } catch (e) {
      setGeneralMsg({ type: 'error', text: 'Save failed: ' + e.message });
    }
  };

  // ─── Activation ───
  const handleCheckActivation = async () => {
    setActivationMsg({ type: '', text: '' });
    if (!activationYear) { setActivationMsg({ type: 'error', text: 'Select academic year' }); return; }
    const result = await checkActivationCost(activationYear);
    setActivationInfo(result);
  };

  const handleActivate = async () => {
    setActivating(true);
    const result = await processActivationPayment(activationYear);
    setActivationMsg({ type: result.success ? 'success' : 'error', text: result.message });
    if (result.success) {
      setSettings(prev => ({ ...prev, year: activationYear, isActive: true }));
    }
    setActivating(false);
  };

  // ─── Candidate CRUD ───
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const resetCandidateForm = () => {
    setName(''); setPosition(''); setDept('');
    setManifesto(''); setPhoto(null); setPhotoPreview('');
    setEditingCandidate(null);
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    if (!name || !position || !dept) { alert('Name, Position, and Department are required.'); return; }

    const posCount = candidates.filter(c => c.position === position && (!editingCandidate || c.id !== editingCandidate.id)).length;
    if (posCount >= MAX_PER_POSITION) { alert(`Maximum ${MAX_PER_POSITION} candidates for "${position}".`); return; }

    try {
      let photoURL = editingCandidate?.photoURL || '';
      if (photo) {
        const storageRef = ref(storage, `candidates/${Date.now()}_${photo.name}`);
        const snap = await uploadBytes(storageRef, photo);
        photoURL = await getDownloadURL(snap.ref);
      }

      const data = { name, position, dept, manifesto: manifesto || '', photoURL, votes: editingCandidate?.votes || 0 };

      if (editingCandidate) {
        await updateDoc(doc(db, 'candidates', editingCandidate.id), data);
        if (photo && editingCandidate.photoURL) {
          try { await deleteObject(ref(storage, editingCandidate.photoURL)); } catch (e) {}
        }
      } else {
        await addDoc(collection(db, 'candidates'), data);
      }

      resetCandidateForm();
      loadAll();
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleEdit = (c) => {
    setEditingCandidate(c);
    setName(c.name); setPosition(c.position); setDept(c.dept);
    setManifesto(c.manifesto || '');
    setPhotoPreview(c.photoURL || '');
    setActiveView('candidates');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this candidate?')) return;
    try {
      const c = candidates.find(c => c.id === id);
      await deleteDoc(doc(db, 'candidates', id));
      if (c?.photoURL) { try { await deleteObject(ref(storage, c.photoURL)); } catch (e) {} }
      loadAll();
    } catch (e) { alert('Error: ' + e.message); }
  };

  // ─── Mark Support as Read ───
  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, 'supportMessages', id), { status: 'read' });
      setSupportMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'read' } : m));
    } catch (e) { console.error(e); }
  };
// ─── Form Purchase Settings ───
const [formPurchaseCfg, setFormPurchaseCfg] = useState({
  isActive: false,
  openingDate: '',
  openingTime: '',
  closingDate: '',
  closingTime: '',
  maxPerPosition: 5,
  positions: []
});
const [newPosName, setNewPosName] = useState('');
const [newPosAmount, setNewPosAmount] = useState('');
const [fpSaved, setFpSaved] = useState(false);
const [fpMsg, setFpMsg] = useState({ type: '', text: '' });

  // ─── Withdrawal ───
  const handleWithdraw = async () => {
    setWithdrawMsg({ type: '', text: '' });
    if (!withdrawAdminId || !withdrawPin || !withdrawAmount) {
      setWithdrawMsg({ type: 'error', text: 'Fill all fields' }); return;
    }
    if (withdrawAdminId !== ADMIN_ID) {
      setWithdrawMsg({ type: 'error', text: 'Invalid Admin ID' }); return;
    }
    if (withdrawPin !== WITHDRAWAL_PIN) {
      setWithdrawMsg({ type: 'error', text: 'Invalid PIN' }); return;
    }
    const amt = parseInt(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      setWithdrawMsg({ type: 'error', text: 'Invalid amount' }); return;
    }
    const result = await withdraw(ADMIN_ID, WITHDRAWAL_PIN, amt);
    setWithdrawMsg({ type: result.success ? 'success' : 'error', text: result.message });
    if (result.success) {
      setWithdrawAdminId(''); setWithdrawPin(''); setWithdrawAmount('');
    }
// ─── Form Purchase Handlers ───
const addPositionToForm = () => {
  if (!newPosName.trim() || !newPosAmount) return;
  setFormPurchaseCfg(prev => ({
    ...prev,
    positions: [...prev.positions, { position: newPosName.trim(), amount: parseInt(newPosAmount) }]
  }));
  setNewPosName('');
  setNewPosAmount('');
};

const removeFormPosition = (index) => {
  setFormPurchaseCfg(prev => ({
    ...prev,
    positions: prev.positions.filter((_, i) => i !== index)
  }));
};

const saveFormPurchaseCfg = async () => {
  setFpMsg({ type: '', text: '' });
  try {
    await setDoc(doc(db, 'settings', 'formPurchase'), formPurchaseCfg, { merge: true });
    setFpSaved(true);
    setFpMsg({ type: 'success', text: 'Form purchase settings saved!' });
    setTimeout(() => setFpSaved(false), 3000);
  } catch (e) {
    setFpMsg({ type: 'error', text: 'Save failed: ' + e.message });
  }
};
  

  // ─── Styles ───
  const layout = {
    minHeight: '100vh',
    background: '#0f172a',
    color: 'white',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    display: 'flex',
  };
  const mainArea = {
    flex: 1,
    marginLeft: '0',
    padding: '24px',
    maxWidth: '1200px',
    width: '100%',
  };
  const card = {
    background: '#1e293b',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
    border: '1px solid #334155',
  };
  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    marginBottom: '12px',
    background: '#0f172a',
    color: 'white',
    border: '1px solid #334155',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
  };
  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '6px',
    color: '#94a3b8',
  };
  const grid4 = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  };
  const statCard = {
    background: '#1e293b',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #334155',
    textAlign: 'center',
  };
  const btnPrimary = {
    padding: '12px 28px',
    background: '#003366',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
  };
  const btnSuccess = {
    ...btnPrimary, background: '#16a34a',
  };
  const btnWarning = {
    ...btnPrimary, background: '#f59e0b', color: '#061D3A',
  };
  const btnDanger = {
    ...btnPrimary, background: '#dc2626',
  };
  const msgStyle = (type) => ({
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '13px',
    fontWeight: 500,
    background: type === 'success' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
    color: type === 'success' ? '#16a34a' : '#dc2626',
    border: `1px solid ${type === 'success' ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`,
  });

  const sidebarItems = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'settings', label: 'Election Settings', icon: '⚙️' },
  { key: 'generalSettings', label: 'General Settings', icon: '🔧' },
  { key: 'formPurchase', label: 'Form Purchase', icon: '📋' },  // ← ADD THIS
  { key: 'candidates', label: 'Manage Candidates', icon: '👥' },
  { key: 'results', label: 'Results', icon: '📈' },
  { key: 'activation', label: 'Activation', icon: '🔑' },
  { key: 'withdrawal', label: 'Withdraw Funds', icon: '💰' },
  { key: 'support', label: 'Support Messages', icon: '💬' },
];

  // ─── LOADING ───
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #334155', borderTopColor: '#FFD700', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading Admin Panel...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ color: '#dc2626' }}>⚠️ ERROR</h2>
        <p style={{ color: '#94a3b8' }}>{error}</p>
        <button onClick={loadAll} style={btnPrimary}>Retry</button>
      </div>
    );
  }

  // ─── RENDER ───
  return (
    <div style={layout}>
      {/* Sidebar Overlay */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10 }} />}

      {/* Sidebar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: '260px',
        background: '#0a1628', borderRight: '1px solid #1e293b',
        zIndex: 20, display: 'flex', flexDirection: 'column',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-260px)',
        transition: 'transform 0.3s ease',
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#FFD700', fontSize: '16px' }}>NAMATLS Admin</h3>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#FFD700', fontSize: '24px', cursor: 'pointer', padding: '0' }}>×</button>
        </div>
        <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
          {sidebarItems.map(item => (
            <div key={item.key} onClick={() => { setActiveView(item.key); setSidebarOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                marginBottom: '2px', borderRadius: '8px', cursor: 'pointer',
                background: activeView === item.key ? 'rgba(255,215,0,0.12)' : 'transparent',
                color: activeView === item.key ? '#FFD700' : 'rgba(255,255,255,0.7)',
                fontWeight: activeView === item.key ? 600 : 400, fontSize: '14px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { if (activeView !== item.key) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { if (activeView !== item.key) e.currentTarget.style.background = 'transparent'; }}>
              <span>{item.icon}</span> {item.label}
            </div>
          ))}
        </div>
        <div style={{ padding: '12px', borderTop: '1px solid #1e293b' }}>
          <button onClick={() => navigate('/admin')}
            style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.target.style.background = '#dc2626'; e.target.style.borderColor = '#dc2626'; }}
            onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '24px', maxWidth: '1200px', width: '100%', marginLeft: sidebarOpen ? '260px' : '0', transition: 'margin-left 0.3s' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setSidebarOpen(true)}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', width: '40px', height: '40px', borderRadius: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'background 0.2s' }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.15)'; }}
              onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.08)'; }}>
              <div style={{ width: '18px', height: '2px', background: '#FFD700', borderRadius: '2px' }} />
              <div style={{ width: '18px', height: '2px', background: '#FFD700', borderRadius: '2px' }} />
              <div style={{ width: '18px', height: '2px', background: '#FFD700', borderRadius: '2px' }} />
            </button>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Admin Dashboard</h2>
          </div>
          <span style={{ fontSize: '13px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: '8px' }}>🔑 {ADMIN_ID}</span>
        </div>

        {/* ==================== DASHBOARD VIEW ==================== */}
        {activeView === 'dashboard' && (
          <>
            <div style={{ ...card, textAlign: 'center', marginBottom: '24px' }}>
              <h1 style={{ margin: '0 0 8px', fontSize: '28px' }}>👋 Welcome Admin</h1>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Admin ID: <strong style={{ color: '#FFD700' }}>{ADMIN_ID}</strong></p>
            </div>

            <div style={grid4}>
              <div style={statCard}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>👥</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#FFD700' }}>{candidates.length}</div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>Total Candidates</div>
              </div>
              <div style={statCard}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗳️</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#FFD700' }}>{totalVotes}</div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>Total Votes Cast</div>
              </div>
              <div style={statCard}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>💰</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFD700' }}>₦{withdrawalBalance.toLocaleString()}</div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>Withdrawal Balance</div>
              </div>
              <div style={statCard}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: phase.color }}>{phase.label}</div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>Election Status</div>
              </div>
            </div>

            <div style={card}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>⚡ Quick Actions</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveView('settings')} style={btnPrimary}>⚙️ Election Settings</button>
                <button onClick={() => setActiveView('candidates')} style={{ ...btnPrimary, background: '#2563eb' }}>👥 Manage Candidates</button>
                <button onClick={() => setActiveView('results')} style={btnSuccess}>📈 View Results</button>
                <button onClick={() => setActiveView('withdrawal')} style={btnWarning}>💰 Withdraw Funds</button>
                <button onClick={() => setActiveView('activation')} style={{ ...btnPrimary, background: '#7c3aed' }}>🔑 Activation</button>
              </div>
            </div>

            <div style={card}>
              <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>📋 Election Info</h3>
              <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.8 }}>
                <div><strong style={{ color: 'white' }}>Academic Year:</strong> {settings.year || 'Not set'}</div>
                <div><strong style={{ color: 'white' }}>Start:</strong> {settings.startDate || 'Not set'} {settings.startTime ? `@ ${settings.startTime}` : ''}</div>
                <div><strong style={{ color: 'white' }}>End:</strong> {settings.endDate || 'Not set'} {settings.endTime ? `@ ${settings.endTime}` : ''}</div>
                <div><strong style={{ color: 'white' }}>Active:</strong> <span style={{ color: settings.isActive ? '#16a34a' : '#dc2626' }}>{settings.isActive ? '✅ Yes' : '❌ No'}</span></div>
              </div>
            </div>
          </>
        )}

        {/* ==================== ELECTION SETTINGS VIEW ==================== */}
        {activeView === 'settings' && (
          <div style={card}>
            <h2 style={{ margin: '0 0 20px', color: '#FFD700', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>⚙️ Election Settings</h2>
            
            {settingsMsg.text && <div style={msgStyle(settingsMsg.type)}>{settingsMsg.text}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Academic Year</label>
                <select value={settings.year} onChange={e => setSettings({...settings, year: e.target.value})} style={inputStyle}>
                  <option value="">Select Year</option>
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                  <option value="2027/2028">2027/2028</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={settings.isActive ? 'true' : 'false'} onChange={e => setSettings({...settings, isActive: e.target.value === 'true'})} style={inputStyle}>
                  <option value="false">🔴 Inactive</option>
                  <option value="true">🟢 Active (Voting Open)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input type="date" value={settings.startDate} onChange={e => setSettings({...settings, startDate: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Start Time</label>
                <input type="time" value={settings.startTime} onChange={e => setSettings({...settings, startTime: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>End Date</label>
                <input type="date" value={settings.endDate} onChange={e => setSettings({...settings, endDate: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>End Time</label>
                <input type="time" value={settings.endTime} onChange={e => setSettings({...settings, endTime: e.target.value})} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button onClick={saveSettings} style={{ ...btnSuccess, padding: '14px 32px', fontSize: '15px' }}>
                {settingsSaved ? '✅ Saved!' : '💾 Save Election Settings'}
              </button>
              <button onClick={loadAll} style={{ ...btnPrimary, background: '#475569' }}>🔄 Reload</button>
            </div>
          </div>
        )}

        {/* ==================== GENERAL SETTINGS VIEW ==================== */}
        {activeView === 'generalSettings' && (
          <div style={card}>
            <h2 style={{ margin: '0 0 20px', color: '#FFD700', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>🔧 General Settings</h2>
            
            {generalMsg.text && <div style={msgStyle(generalMsg.type)}>{generalMsg.text}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Site Name</label>
                <input type="text" value={generalSettings.siteName} onChange={e => setGeneralSettings({...generalSettings, siteName: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Election Title</label>
                <input type="text" value={generalSettings.electionTitle} onChange={e => setGeneralSettings({...generalSettings, electionTitle: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Institution Name</label>
                <input type="text" value={generalSettings.institutionName} onChange={e => setGeneralSettings({...generalSettings, institutionName: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Department Name</label>
                <input type="text" value={generalSettings.departmentName} onChange={e => setGeneralSettings({...generalSettings, departmentName: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Contact Email</label>
                <input type="email" value={generalSettings.contactEmail} onChange={e => setGeneralSettings({...generalSettings, contactEmail: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Default Academic Year</label>
                <input type="text" value={generalSettings.academicYear} onChange={e => setGeneralSettings({...generalSettings, academicYear: e.target.value})} placeholder="e.g. 2026/2027" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Max Candidates Per Position</label>
                <input type="number" value={generalSettings.maxCandidatesPerPosition} onChange={e => setGeneralSettings({...generalSettings, maxCandidatesPerPosition: parseInt(e.target.value) || 5})} min="1" max="20" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Voting Type</label>
                <select value={generalSettings.votingType} onChange={e => setGeneralSettings({...generalSettings, votingType: e.target.value})} style={inputStyle}>
                  <option value="single">Single Vote Per Position</option>
                  <option value="points">Points-Based Voting</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Points Per Voter</label>
                <input type="number" value={generalSettings.pointsPerVoter} onChange={e => setGeneralSettings({...generalSettings, pointsPerVoter: parseInt(e.target.value) || 1})} min="1" style={inputStyle} disabled={generalSettings.votingType !== 'points'} />
              </div>
              <div>
                <label style={labelStyle}>Require Matric Verification</label>
                <select value={generalSettings.requireMatricVerification ? 'true' : 'false'} onChange={e => setGeneralSettings({...generalSettings, requireMatricVerification: e.target.value === 'true'})} style={inputStyle}>
                  <option value="true">✅ Yes</option>
                  <option value="false">❌ No</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Allow Public Results</label>
                <select value={generalSettings.allowResultsPublic ? 'true' : 'false'} onChange={e => setGeneralSettings({...generalSettings, allowResultsPublic: e.target.value === 'true'})} style={inputStyle}>
                  <option value="false">🔒 Admin Only</option>
                  <option value="true">🌍 Public</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Maintenance Mode</label>
                <select value={generalSettings.maintenanceMode ? 'true' : 'false'} onChange={e => setGeneralSettings({...generalSettings, maintenanceMode: e.target.value === 'true'})} style={inputStyle}>
                  <option value="false">🟢 Live</option>
                  <option value="true">🔴 Maintenance</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={labelStyle}>Custom Footer Text</label>
              <textarea value={generalSettings.customFooter} onChange={e => setGeneralSettings({...generalSettings, customFooter: e.target.value})} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} placeholder="Custom footer text for the voting portal..." />
            </div>

            <button onClick={saveGeneralSettings} style={{ ...btnSuccess, padding: '14px 32px', fontSize: '15px', marginTop: '16px' }}>
              {generalSaved ? '✅ Saved!' : '💾 Save General Settings'}
            </button>
          </div>
        )}

        {/* ==================== CANDIDATES VIEW ==================== */}
        {activeView === 'candidates' && (
          <div style={card}>
            <h2 style={{ margin: '0 0 20px', color: '#FFD700', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>👥 Manage Candidates</h2>

            {/* Form */}
            <div style={{ ...card, background: '#0f172a', border: '1px solid #2563eb' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '15px' }}>{editingCandidate ? '✏️ Edit Candidate' : '➕ Add New Candidate'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <input type="text" placeholder="Full Name *" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="Position *" value={position} onChange={e => setPosition(e.target.value)} style={inputStyle} />
                <input type="text" placeholder="Department *" value={dept} onChange={e => setDept(e.target.value)} style={inputStyle} />
                <div>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ ...inputStyle, padding: '10px' }} />
                  {photoPreview && <img src={photoPreview} alt="Preview" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', marginTop: '8px' }} />}
                </div>
              </div>
              <textarea placeholder="Manifesto / Bio (optional)" value={manifesto} onChange={e => setManifesto(e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleAddCandidate} style={btnSuccess}>
                  {editingCandidate ? '✏️ Update Candidate' : '➕ Add Candidate'}
                </button>
                {editingCandidate && <button onClick={resetCandidateForm} style={btnDanger}>Cancel Edit</button>}
              </div>
            </div>

            {/* Candidate List */}
            {candidates.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>📭 No candidates added yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#0a1628' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid #334155' }}>Photo</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid #334155' }}>Name</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid #334155' }}>Position</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid #334155' }}>Dept</th>
                      <th style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', borderBottom: '1px solid #334155' }}>Votes</th>
                      <th style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', borderBottom: '1px solid #334155' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '10px' }}>
                          {c.photoURL ? <img src={c.photoURL} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} /> : '—'}
                        </td>
                        <td style={{ padding: '10px', fontWeight: 500 }}>{c.name}</td>
                        <td style={{ padding: '10px', color: '#94a3b8' }}>{c.position}</td>
                        <td style={{ padding: '10px', color: '#94a3b8' }}>{c.dept}</td>
                        <td style={{ padding: '10px', textAlign: 'center', color: '#FFD700', fontWeight: 700 }}>{c.votes || 0}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <button onClick={() => handleEdit(c)} style={{ ...btnPrimary, padding: '6px 14px', fontSize: '12px', background: '#2563eb', marginRight: '6px' }}>✏️</button>
                          <button onClick={() => handleDelete(c.id)} style={{ ...btnDanger, padding: '6px 14px', fontSize: '12px' }}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== RESULTS VIEW ==================== */}
        {activeView === 'results' && (
          <div style={card}>
            {/* Logo Header */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <img src="/logo.png" alt="NAMATL Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }} />
              <h3 style={{ margin: '8px 0 0', color: '#FFD700', fontSize: '14px', letterSpacing: '1px' }}>FEDERAL UNIVERSITY OF PETROLEUM RESOURCES</h3>
              <h4 style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>NAMATL STUDENT E-VOTING — {settings.year || 'YEAR'} OFFICIAL RESULT</h4>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>📈 Election Results</h2>
              <button onClick={() => window.print()} style={btnSuccess}>🖨️ Print Result</button>
            </div>

            {!settings.isActive ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <span style={{ fontSize: '48px' }}>📊</span>
                <h3 style={{ margin: '12px 0 0' }}>No Result Yet</h3>
                <p>Election has not been configured or activated.</p>
              </div>
            ) : candidates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <span style={{ fontSize: '48px' }}>📭</span>
                <h3 style={{ margin: '12px 0 0' }}>No Candidates</h3>
                <p>No candidates have been added yet.</p>
              </div>
            ) : (
              <div>
                {sortedByVotes.map((c, idx) => (
                  <div key={c.id} style={{ ...card, background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: idx === 0 ? '#FFD700' : '#94a3b8', minWidth: '30px' }}>#{idx + 1}</span>
                      <div>
                        <strong>{c.name}</strong>
                        <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '8px' }}>{c.position}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: '#FFD700' }}>{c.votes || 0}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>votes</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Print CSS */}
            <style>{`
              @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .no-print { display: none !important; }
              }
            `}</style>
          </div>
        )}

        {/* ==================== ACTIVATION VIEW ==================== */}
        {activeView === 'activation' && (
          <div style={card}>
            <h2 style={{ margin: '0 0 20px', color: '#FFD700', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>🔑 Election Activation</h2>
            
            {activationMsg.text && <div style={msgStyle(activationMsg.type)}>{activationMsg.text}</div>}

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Select Academic Year for Activation</label>
              <select value={activationYear} onChange={e => setActivationYear(e.target.value)} style={inputStyle}>
                <option value="">Select Academic Year</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2026/2027">2026/2027 (FREE)</option>
                <option value="2027/2028">2027/2028 (N25,000)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button onClick={handleCheckActivation} style={btnPrimary}>🔍 Check Activation Cost</button>
              {activationInfo && (
                <button onClick={handleActivate} disabled={activating} style={{ ...btnSuccess, opacity: activating ? 0.6 : 1 }}>
                  {activating ? '⏳ Processing...' : activationInfo.free ? '✅ Activate Free' : `💳 Pay ₦${activationInfo.cost.toLocaleString()}`}
                </button>
              )}
            </div>

            {activationInfo && (
              <div style={{ ...card, background: activationInfo.free ? 'rgba(22,163,74,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${activationInfo.free ? 'rgba(22,163,74,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                <p style={{ margin: 0, fontWeight: 600, color: activationInfo.free ? '#16a34a' : '#f59e0b' }}>
                  {activationInfo.free ? '🎉 FREE ACTIVATION' : '💳 PAID ACTIVATION'}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#94a3b8' }}>{activationInfo.message}</p>
              </div>
            )}

            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,215,0,0.05)', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.1)' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                <strong>Note:</strong> Current academic year 2026/2027 is FREE. Other years require a ₦25,000 activation fee via Flutterwave.
              </p>
            </div>
          </div>
        )}

        {/* ==================== WITHDRAWAL VIEW ==================== */}
        {activeView === 'withdrawal' && (
          <div style={card}>
            <h2 style={{ margin: '0 0 20px', color: '#FFD700', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>💰 Withdraw Funds</h2>

            <div style={{ ...card, background: '#0f172a', textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 4px', color: '#94a3b8', fontSize: '13px' }}>Available Balance</p>
              <p style={{ margin: 0, fontSize: '36px', fontWeight: 700, color: '#FFD700' }}>₦{withdrawalBalance.toLocaleString()}</p>
            </div>

            {withdrawMsg.text && <div style={msgStyle(withdrawMsg.type)}>{withdrawMsg.text}</div>}

            <div>
              <label style={labelStyle}>Admin ID</label>
              <input type="text" value={withdrawAdminId} onChange={e => setWithdrawAdminId(e.target.value)} placeholder={ADMIN_ID} style={inputStyle} />
              
              <label style={labelStyle}>Withdrawal PIN</label>
              <input type="password" value={withdrawPin} onChange={e => setWithdrawPin(e.target.value)} placeholder="Enter PIN" style={inputStyle} />
              
              <label style={labelStyle}>Amount (₦)</label>
              <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="Enter amount" min="1" style={inputStyle} />
            </div>

            <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)', fontSize: '12px', color: '#f59e0b' }}>
              💳 Funds sent to Opay account: <strong>{OPAY_ACCOUNT}</strong>
            </div>

            <button onClick={handleWithdraw} style={{ ...btnWarning, marginTop: '16px', padding: '14px 32px', fontSize: '15px' }}>
              💸 Withdraw Funds
            </button>
          </div>
        )}
{/* ==================== FORM PURCHASE SETTINGS VIEW ==================== */}
        {activeView === 'formPurchase' && (
          <div style={card}>
            <h2 style={{ margin: '0 0 20px', color: '#FFD700', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>
              📋 Form Purchase Settings
            </h2>

            {fpMsg.text && (
              <div style={{
                padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: 500,
                background: fpMsg.type === 'success' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
                color: fpMsg.type === 'success' ? '#16a34a' : '#dc2626',
                border: `1px solid ${fpMsg.type === 'success' ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`,
              }}>{fpMsg.text}</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>Status</label>
                <select value={formPurchaseCfg.isActive ? 'true' : 'false'}
                  onChange={e => setFormPurchaseCfg({...formPurchaseCfg, isActive: e.target.value === 'true'})}
                  style={inputStyle}>
                  <option value="false">🔴 Disabled</option>
                  <option value="true">🟢 Active</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>Max Per Position</label>
                <input type="number" value={formPurchaseCfg.maxPerPosition} min="1" max="20"
                  onChange={e => setFormPurchaseCfg({...formPurchaseCfg, maxPerPosition: parseInt(e.target.value) || 5})}
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>Opening Date</label>
                <input type="date" value={formPurchaseCfg.openingDate}
                  onChange={e => setFormPurchaseCfg({...formPurchaseCfg, openingDate: e.target.value})}
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>Opening Time</label>
                <input type="time" value={formPurchaseCfg.openingTime}
                  onChange={e => setFormPurchaseCfg({...formPurchaseCfg, openingTime: e.target.value})}
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>Closing Date</label>
                <input type="date" value={formPurchaseCfg.closingDate}
                  onChange={e => setFormPurchaseCfg({...formPurchaseCfg, closingDate: e.target.value})}
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#94a3b8' }}>Closing Time</label>
                <input type="time" value={formPurchaseCfg.closingTime}
                  onChange={e => setFormPurchaseCfg({...formPurchaseCfg, closingTime: e.target.value})}
                  style={inputStyle} />
              </div>
            </div>

            <h3 style={{ fontSize: '15px', margin: '0 0 12px', color: '#cbd5e1' }}>Positions &amp; Pricing</h3>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Position name (e.g. President)" value={newPosName}
                onChange={e => setNewPosName(e.target.value)}
                style={{ ...inputStyle, maxWidth: '280px', marginBottom: 0 }} />
              <input type="number" placeholder="Amount (₦)" value={newPosAmount}
                onChange={e => setNewPosAmount(e.target.value)}
                style={{ ...inputStyle, maxWidth: '160px', marginBottom: 0 }} />
              <button onClick={addPositionToForm}
                style={{ padding: '12px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ➕ Add Position
              </button>
            </div>

            {formPurchaseCfg.positions.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                No positions added yet.
              </p>
            ) : (
              <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#0a1628' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid #334155' }}>#</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid #334155' }}>Position</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#94a3b8', borderBottom: '1px solid #334155' }}>Amount (₦)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8', borderBottom: '1px solid #334155' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formPurchaseCfg.positions.map((pos, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{pos.position}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#FFD700', fontWeight: 600 }}>
                          ₦{Number(pos.amount).toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button onClick={() => removeFormPosition(i)}
                            style={{ padding: '5px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button onClick={saveFormPurchaseCfg}
              style={{ padding: '14px 32px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>
              {fpSaved ? '✅ Saved!' : '💾 Save Form Purchase Settings'}
            </button>

            <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(255,215,0,0.04)', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.1)', fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
              <strong style={{ color: '#FFD700' }}>📌 How it works:</strong><br />
              Students visit <strong>/purchase-form</strong> → select a position → fill details → pay via Flutterwave.
              Make sure <code style={{ background: '#0a1628', padding: '2px 6px', borderRadius: '4px' }}>VITE_FLW_PUBLIC_KEY</code> is set in Vercel.
            </div>
          </div>
        )}

        {/* ==================== SUPPORT MESSAGES VIEW ==================== */}
        {activeView === 'support' && (
          <div style={card}>
            <h2 style={{ margin: '0 0 20px', color: '#FFD700', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>
              💬 Support Messages {unreadCount > 0 && <span style={{ color: '#f59e0b', fontSize: '14px' }}>({unreadCount} unread)</span>}
            </h2>

            {supportMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <span style={{ fontSize: '48px' }}>📭</span>
                <h3 style={{ margin: '12px 0 0', fontSize: '16px' }}>No messages yet</h3>
              </div>
            ) : (
              supportMessages.map(msg => (
                <div key={msg.id} onClick={() => markAsRead(msg.id)}
                  style={{
                    padding: '16px', borderBottom: '1px solid #1e293b', cursor: 'pointer',
                    background: msg.status === 'unread' ? 'rgba(255,215,0,0.04)' : 'transparent',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = msg.status === 'unread' ? 'rgba(255,215,0,0.04)' : 'transparent'; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ color: '#FFD700', fontSize: '14px' }}>{msg.name || 'Anonymous'}</strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {msg.timestamp?.toDate?.()?.toLocaleString() || msg.timestamp || 'Just now'}
                    </span>
                  </div>
                  {msg.email && msg.email !== 'Not provided' && <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>📧 {msg.email}</div>}
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>{msg.message}</p>
                  {msg.status === 'unread' && (
                    <span style={{ display: 'inline-block', marginTop: '8px', padding: '2px 8px', background: '#f59e0b', color: 'white', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>NEW</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}