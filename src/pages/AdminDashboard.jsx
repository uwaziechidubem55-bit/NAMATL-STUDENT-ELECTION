import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { collection, addDoc, getDocs, getDoc, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useDataCharge } from '../context/DataChargeContext';

const ADMIN_ID = "Admin123@";  
const WITHDRAWAL_PIN = "1966"; 
const OPAY_ACCOUNT = "9167557038"; 

const MAX_PER_POSITION = 5;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { withdrawalBalance, withdraw, ADMIN_ID, WITHDRAWAL_PIN, OPAY_ACCOUNT } = useDataCharge();

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

  // ─── Election Settings ───
  const [settings, setSettings] = useState({
    year: '', startDate: '', startTime: '', endDate: '', endTime: '', isActive: false
  });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState({ type: '', text: '' });

  // ─── General Settings ───
  const [generalSettings, setGeneralSettings] = useState({
    siteName: 'NAMATL E-Voting', electionTitle: 'NAMATL STUDENT E-VOTING',
    institutionName: 'Federal University of Petroleum Resources, FUPRE',
    departmentName: 'Maritime Transport and Logistics',
    contactEmail: 'namtls.fupre@edu.ng', academicYear: '2026/2027',
    maxCandidatesPerPosition: 5, votingType: 'single'
  });
  const [generalSaved, setGeneralSaved] = useState(false);
  const [generalMsg, setGeneralMsg] = useState({ type: '', text: '' });

  // ─── Form Purchase ───
  const [formPurchaseCfg, setFormPurchaseCfg] = useState({
    isActive: false, maxPerPosition: 5,
    openingDate: '', openingTime: '', closingDate: '', closingTime: '',
    positions: []
  });
  const [newPosName, setNewPosName] = useState('');
  const [newPosAmount, setNewPosAmount] = useState('');
  const [fpSaved, setFpSaved] = useState(false);
  const [fpMsg, setFpMsg] = useState({ type: '', text: '' });

  // ─── Withdrawal ───
  const [withdrawAdminId, setWithdrawAdminId] = useState('');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMsg, setWithdrawMsg] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  // ─── Results ───
  const [voters, setVoters] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateVoters, setCandidateVoters] = useState([]);

  // ─── Activation ───
  const [activationYear, setActivationYear] = useState('');
  const [activationStartDate, setActivationStartDate] = useState('');
  const [activationStartTime, setActivationStartTime] = useState('');
  const [activationEndDate, setActivationEndDate] = useState('');
  const [activationEndTime, setActivationEndTime] = useState('');
  const [activationToggle, setActivationToggle] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState('');

  // ─── Support ───
  const [supportMessages, setSupportMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ─── Styles ───
  const inputStyle = {
    width: '100%', padding: '12px 16px', marginBottom: '12px',
    background: '#0f172a', color: 'white', border: '1px solid #334155',
    borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none',
  };
  const btnPrimary = {
    padding: '10px 20px', background: 'linear-gradient(135deg, #FFD700 0%, #e6a800 100%)',
    color: '#061D3A', border: 'none', borderRadius: '8px', fontWeight: 700,
    fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', width: '100%'
  };
  const btnSuccess = {
    ...btnPrimary, background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: 'white'
  };
  const btnDanger = {
    ...btnPrimary, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white'
  };
  const btnOutline = {
    padding: '8px 16px', background: 'transparent', color: '#FFD700',
    border: '1px solid rgba(255,215,0,0.3)', borderRadius: '0px', fontWeight: 600,
    fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s'
  };
  const card = {
    background: '#1e293b', borderRadius: '12px', padding: '20px',
    marginBottom: '16px', border: '1px solid #334155'
  };
  const label = { display: 'block', color: '#94a3b8', fontSize: '12px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' };

  // ─── Load Data ───
  useEffect(() => {
    loadAll();
    // Print CSS injection
    const ps = document.createElement('style');
    ps.textContent = `
      @media print {
        body * { visibility: hidden; }
        .printable-area, .printable-area * { visibility: visible; }
        .printable-area {
          position: absolute; left: 0; top: 0;
          width: 100%; background: white !important;
          padding: 30px !important; margin: 0 !important;
        }
        .no-print, .no-print * { display: none !important; }
      }
    `;
    document.head.appendChild(ps);
    return () => document.head.removeChild(ps);
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      // Load settings
      const sDoc = await getDoc(doc(db, 'settings', 'main'));
      if (sDoc.exists()) {
        const d = sDoc.data();
        setSettings({
          year: d.year || '', startDate: d.startDate || '', startTime: d.startTime || '',
          endDate: d.endDate || '', endTime: d.endTime || '', isActive: d.isActive || false
        });
        setActivationYear(d.year || '');
        setActivationStartDate(d.startDate || '');
        setActivationStartTime(d.startTime || '');
        setActivationEndDate(d.endDate || '');
        setActivationEndTime(d.endTime || '');
        setActivationToggle(d.isActive || false);
      }

      // Load general settings
      const gDoc = await getDoc(doc(db, 'settings', 'general'));
      if (gDoc.exists()) setGeneralSettings(prev => ({ ...prev, ...gDoc.data() }));

      // Load form purchase settings
      const fpDoc = await getDoc(doc(db, 'settings', 'formPurchase'));
      if (fpDoc.exists()) setFormPurchaseCfg(prev => ({ ...prev, ...fpDoc.data() }));

      // Load candidates
      const cSnap = await getDocs(collection(db, 'candidates'));
      const cList = [];
      cSnap.forEach(d => cList.push({ id: d.id, ...d.data() }));
      setCandidates(cList);

      // Load voters
      const vSnap = await getDocs(collection(db, 'voters'));
      const vList = [];
      vSnap.forEach(d => vList.push({ id: d.id, ...d.data() }));
      setVoters(vList);

      // Load support messages
      const supSnap = await getDocs(collection(db, 'supportMessages'));
      const supList = [];
      let uc = 0;
      supSnap.forEach(d => {
        const msg = { id: d.id, ...d.data() };
        supList.push(msg);
        if (msg.status === 'unread') uc++;
      });
      setSupportMessages(supList);
      setUnreadCount(uc);

    } catch (e) { setError('Failed to load: ' + e.message); }
    setLoading(false);
  };

  // ─── Save Election Settings ───
  const handleSaveSettings = async () => {
    setSettingsMsg({ type: '', text: '' });
    try {
      await setDoc(doc(db, 'settings', 'main'), settings, { merge: true });
      setSettingsSaved(true);
      setSettingsMsg({ type: 'success', text: '✅ Election settings saved!' });
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (e) {
      setSettingsMsg({ type: 'error', text: '❌ Error: ' + e.message });
    }
  };

  // ─── Save General Settings ───
  const handleSaveGeneral = async () => {
    setGeneralMsg({ type: '', text: '' });
    try {
      await setDoc(doc(db, 'settings', 'general'), generalSettings, { merge: true });
      setGeneralSaved(true);
      setGeneralMsg({ type: 'success', text: '✅ General settings saved!' });
      setTimeout(() => setGeneralSaved(false), 3000);
    } catch (e) {
      setGeneralMsg({ type: 'error', text: '❌ Error: ' + e.message });
    }
  };

  // ─── Save Form Purchase ───
  const handleSaveFormPurchase = async () => {
    setFpMsg({ type: '', text: '' });
    try {
      await setDoc(doc(db, 'settings', 'formPurchase'), formPurchaseCfg, { merge: true });
      setFpSaved(true);
      setFpMsg({ type: 'success', text: '✅ Form purchase settings saved!' });
      setTimeout(() => setFpSaved(false), 3000);
    } catch (e) {
      setFpMsg({ type: 'error', text: '❌ Error: ' + e.message });
    }
  };

  // ─── Form Purchase Positions ───
  const addFormPosition = () => {
    if (!newPosName.trim() || !newPosAmount) return;
    const amount = parseFloat(newPosAmount);
    if (isNaN(amount) || amount <= 0) { alert('Enter a valid amount'); return; }
    setFormPurchaseCfg(prev => ({
      ...prev,
      positions: [...prev.positions, { position: newPosName.trim(), amount }]
    }));
    setNewPosName('');
    setNewPosAmount('');
  };
  const removeFormPosition = (idx) => {
    setFormPurchaseCfg(prev => ({
      ...prev,
      positions: prev.positions.filter((_, i) => i !== idx)
    }));
  };

  // ─── Candidates ───
  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Photo must be under 2MB'); return; }
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleAddCandidate = async () => {
    if (!name.trim() || !position.trim() || !dept.trim()) { alert('Name, position, and department required'); return; }
    const count = candidates.filter(c => c.position === position).length + (editingCandidate ? 0 : 0);
    if (!editingCandidate && count >= MAX_PER_POSITION) { alert(`Max ${MAX_PER_POSITION} candidates for ${position}`); return; }

    try {
      let photoUrl = editingCandidate?.photoUrl || '';

      if (photo) {
        const storageRef = ref(storage, `candidates/${Date.now()}_${photo.name}`);
        await uploadBytes(storageRef, photo);
        photoUrl = await getDownloadURL(storageRef);

        // Delete old photo if editing
        if (editingCandidate?.photoUrl && editingCandidate.photoUrl.startsWith('https://')) {
          try {
            const oldRef = ref(storage, editingCandidate.photoUrl);
            await deleteObject(oldRef);
          } catch (e) { /* old photo might not exist */ }
        }
      }

      const data = { name: name.trim(), position: position.trim(), dept: dept.trim(), manifesto: manifesto.trim(), photoUrl, updatedAt: new Date().toISOString() };

      if (editingCandidate) {
        await updateDoc(doc(db, 'candidates', editingCandidate.id), data);
      } else {
        data.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'candidates'), data);
      }

      setName(''); setPosition(''); setDept(''); setManifesto('');
      setPhoto(null); setPhotoPreview(''); setEditingCandidate(null);
      loadAll();
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleEditCandidate = (c) => {
    setEditingCandidate(c);
    setName(c.name); setPosition(c.position); setDept(c.dept);
    setManifesto(c.manifesto || '');
    setPhotoPreview(c.photoUrl || '');
  };

  const handleDeleteCandidate = async (id) => {
    if (!window.confirm('Delete this candidate permanently?')) return;
    try {
      const c = candidates.find(c => c.id === id);
      if (c?.photoUrl && c.photoUrl.startsWith('https://')) {
        try { await deleteObject(ref(storage, c.photoUrl)); } catch (e) {}
      }
      await deleteDoc(doc(db, 'candidates', id));
      loadAll();
    } catch (e) { alert('Error: ' + e.message); }
  };

  // ─── Withdrawal ───
  const handleWithdraw = async () => {
    setWithdrawMsg('');
    if (withdrawAdminId !== ADMIN_ID) { setWithdrawMsg('❌ Invalid Admin ID'); return; }
    if (withdrawPin !== WITHDRAWAL_PIN) { setWithdrawMsg('❌ Invalid PIN'); return; }
    const amount = parseInt(withdrawAmount);
    if (!amount || amount < 1000) { setWithdrawMsg('❌ Minimum withdrawal: N1,000'); return; }
    if (amount > withdrawalBalance) { setWithdrawMsg('❌ Insufficient balance'); return; }
    setWithdrawing(true);
    try {
      const result = await withdraw(amount);
      setWithdrawMsg(result.message);
      if (result.success) { setWithdrawAmount(''); setWithdrawAdminId(''); setWithdrawPin(''); }
    } catch (e) { setWithdrawMsg('❌ Error: ' + e.message); }
    setWithdrawing(false);
  };

  // ─── Results ───
  const viewCandidateVoters = (candidate) => {
    setSelectedCandidate(candidate);
    const v = voters.filter(v => v.votedFor === candidate.name || v.votedFor === candidate.position);
    setCandidateVoters(v);
  };

  // ─── Activation ───
  const handleActivate = async () => {
    setActivationMsg('');
    if (!activationYear.trim()) { setActivationMsg('❌ Enter the academic year'); return; }
    if (!activationStartDate.trim() || !activationEndDate.trim()) { setActivationMsg('❌ Set start and end dates'); return; }
    if (!activationStartTime.trim() || !activationEndTime.trim()) { setActivationMsg('❌ Set start and end times'); return; }

    // Check candidates exist
    if (candidates.length === 0) { setActivationMsg('❌ Add at least one candidate first'); return; }
    // Check settings have year
    if (!settings.year) { setActivationMsg('❌ Save election settings (with year) first'); return; }

    setActivating(true);
    try {
      // Save dates and times to settings
      await setDoc(doc(db, 'settings', 'main'), {
        year: activationYear,
        startDate: activationStartDate,
        startTime: activationStartTime,
        endDate: activationEndDate,
        endTime: activationEndTime,
        isActive: activationToggle
      }, { merge: true });

      setSettings(prev => ({
        ...prev,
        year: activationYear,
        startDate: activationStartDate,
        startTime: activationStartTime,
        endDate: activationEndDate,
        endTime: activationEndTime,
        isActive: activationToggle
      }));

      if (activationYear === '2026/2027') {
        setActivationMsg('✅ Election ACTIVATED for 2026/2027 (FREE)! Voting is now ' + (activationToggle ? 'OPEN' : 'CLOSED'));
      } else if (activationToggle) {
        setActivationMsg(`✅ Election ACTIVATED for ${activationYear}! Mark as paid manually. Voting is OPEN.`);
      } else {
        setActivationMsg(`✅ Settings saved. ENABLE activation toggle above to start the election.`);
      }
    } catch (e) {
      setActivationMsg('❌ Error: ' + e.message);
    }
    setActivating(false);
  };

  // ─── Support ───
  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, 'supportMessages', id), { status: 'read' });
      setSupportMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'read' } : m));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {}
  };

  // ─── Phase Status ───
  const getPhase = () => {
    if (!settings.startDate) return { label: 'Not Configured', color: '#64748b' };
    const now = new Date();
    const start = new Date(settings.startDate + 'T' + (settings.startTime || '00:00'));
    const end = new Date(settings.endDate + 'T' + (settings.endTime || '23:59'));
    if (!settings.isActive) return { label: 'Inactive', color: '#ef4444' };
    if (now < start) return { label: 'Upcoming', color: '#eab308' };
    if (now > end) return { label: 'Ended', color: '#64748b' };
    return { label: 'Live Now', color: '#22c55e' };
  };
  const phase = getPhase();
  const totalVotes = voters.length;
  const groupByPosition = (arr) => {
    const groups = {};
    arr.forEach(c => { if (!groups[c.position]) groups[c.position] = []; groups[c.position].push(c); });
    return groups;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '4px solid #FFD700', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading Admin Dashboard...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', padding: '20px' }}>
        <span style={{ fontSize: '48px' }}>⚠️</span>
        <p style={{ color: '#ef4444', fontSize: '14px', maxWidth: '400px', textAlign: 'center' }}>{error}</p>
        <button onClick={loadAll} style={btnPrimary}>🔄 Retry</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a1628', fontFamily: "'Segoe UI', system-ui, sans-serif", color: 'white' }}>
      {/* ─── TOP BAR ─── */}
      <div className="no-print" style={{
        background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,215,0,0.1)',
        padding: '12px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="Logo"
            onError={(e) => { e.target.style.display = 'none'; }}
            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,215,0,0.3)' }} />
          <span style={{ color: '#FFD700', fontWeight: 700, fontSize: '16px', letterSpacing: '-0.3px' }}>NAMATL Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>₦{withdrawalBalance.toLocaleString()}</span>
          <button onClick={() => navigate('/')} style={{
            padding: '8px 16px', background: 'transparent', color: '#FFD700',
            border: '1px solid rgba(255,215,0,0.2)', borderRadius: '0px',
            fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 500
          }}
            onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.1)'; e.target.style.borderColor = '#FFD700'; }}
            onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'rgba(255,215,0,0.2)'; }}>
            ← Back to Home
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
        {/* ─── SIDEBAR ─── */}
        <div className="no-print" style={{
          width: sidebarOpen ? '240px' : '64px',
          background: '#0f172a', borderRight: '1px solid rgba(255,215,0,0.08)',
          transition: 'width 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
          paddingTop: '8px', overflow: 'hidden', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
        }}
          onMouseEnter={() => setSidebarOpen(true)}
          onMouseLeave={() => setSidebarOpen(false)}>
          {[
            { icon: '📊', label: 'Dashboard', key: 'dashboard' },
            { icon: '⚙️', label: 'Election Settings', key: 'settings' },
            { icon: '🔧', label: 'General Settings', key: 'generalSettings' },
            { icon: '👥', label: 'Candidates', key: 'candidates' },
            { icon: '📈', label: 'Results', key: 'results' },
            { icon: '🔑', label: 'Activation', key: 'activation' },
            { icon: '📋', label: 'Form Purchase', key: 'formPurchase' },
            { icon: '💰', label: 'Withdraw', key: 'withdrawal' },
            { icon: '💬', label: `Support${unreadCount > 0 ? ` (${unreadCount})` : ''}`, key: 'support' },
          ].map(item => (
            <div key={item.key} onClick={() => setActiveView(item.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 18px', cursor: 'pointer', whiteSpace: 'nowrap',
                color: activeView === item.key ? '#FFD700' : '#64748b',
                background: activeView === item.key ? 'rgba(255,215,0,0.08)' : 'transparent',
                borderLeft: activeView === item.key ? '3px solid #FFD700' : '3px solid transparent',
                fontSize: '14px', fontWeight: activeView === item.key ? 600 : 400,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { if (activeView !== item.key) { e.target.style.background = 'rgba(255,255,255,0.03)'; e.target.style.color = '#e2e8f0'; } }}
              onMouseLeave={(e) => { if (activeView !== item.key) { e.target.style.background = 'transparent'; e.target.style.color = '#64748b'; } }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </div>
          ))}
        </div>

        {/* ─── MAIN CONTENT ─── */}
        <div style={{ flex: 1, padding: '24px', maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          {/* ==================== DASHBOARD ==================== */}
          {activeView === 'dashboard' && (
            <>
              <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: '#f1f5f9' }}>📊 Dashboard</h1>
              <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 24px' }}>Overview of {generalSettings.siteName}</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {[
                  { icon: '👥', value: candidates.length, label: 'Total Candidates', color: '#FFD700' },
                  { icon: '🗳️', value: totalVotes, label: 'Total Votes Cast', color: '#3b82f6' },
                  { icon: '💰', value: `₦${withdrawalBalance.toLocaleString()}`, label: 'Balance', color: '#22c55e' },
                  { icon: '📊', value: phase.label, label: 'Election Status', color: phase.color },
                ].map((s, i) => (
                  <div key={i} style={{
                    ...card, textAlign: 'center', padding: '20px 16px',
                    borderLeft: `3px solid ${s.color}`,
                  }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>{s.icon}</div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={card}>
                <h2 style={{ color: '#FFD700', fontSize: '15px', fontWeight: 600, margin: '0 0 16px', borderBottom: '1px solid rgba(255,215,0,0.15)', paddingBottom: '10px' }}>⚡ Quick Actions</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                  <button onClick={() => setActiveView('settings')} style={btnPrimary}>⚙️ Election Settings</button>
                  <button onClick={() => setActiveView('generalSettings')} style={{ ...btnPrimary, background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}>🔧 General Settings</button>
                  <button onClick={() => setActiveView('candidates')} style={{ ...btnPrimary, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>👥 Manage Candidates</button>
                  <button onClick={() => setActiveView('results')} style={btnSuccess}>📈 View Results</button>
                  <button onClick={() => setActiveView('withdrawal')} style={{ ...btnPrimary, background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>💰 Withdraw Funds</button>
                  <button onClick={() => setActiveView('activation')} style={{ ...btnPrimary, background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }}>🔑 Activation</button>
                  <button onClick={() => setActiveView('formPurchase')} style={{ ...btnPrimary, background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' }}>📋 Form Purchase</button>
                </div>
              </div>

              <div style={card}>
                <h2 style={{ color: '#FFD700', fontSize: '15px', fontWeight: 600, margin: '0 0 16px', borderBottom: '1px solid rgba(255,215,0,0.15)', paddingBottom: '10px' }}>📋 Election Info</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '13px' }}>
                  <div><span style={{ color: '#64748b' }}>Academic Year:</span> <span style={{ color: '#FFD700' }}>{settings.year || 'Not set'}</span></div>
                  <div><span style={{ color: '#64748b' }}>Start:</span> <span>{settings.startDate || 'Not set'} {settings.startTime ? `@ ${settings.startTime}` : ''}</span></div>
                  <div><span style={{ color: '#64748b' }}>End:</span> <span>{settings.endDate || 'Not set'} {settings.endTime ? `@ ${settings.endTime}` : ''}</span></div>
                  <div><span style={{ color: '#64748b' }}>Active:</span> <span style={{ color: settings.isActive ? '#22c55e' : '#ef4444' }}>{settings.isActive ? '✅ Yes' : '❌ No'}</span></div>
                  <div><span style={{ color: '#64748b' }}>Phase:</span> <span style={{ color: phase.color }}>{phase.label}</span></div>
                </div>
              </div>
            </>
          )}

          {/* ==================== ELECTION SETTINGS ==================== */}
          {activeView === 'settings' && (
            <div style={card}>
              <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700, margin: '0 0 20px', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>⚙️ Election Settings</h2>
              {settingsMsg.text && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', background: settingsMsg.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: settingsMsg.type === 'error' ? '#ef4444' : '#22c55e', border: `1px solid ${settingsMsg.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                  {settingsMsg.text}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={label}>Academic Year</label>
                  <input value={settings.year} onChange={(e) => setSettings({...settings, year: e.target.value})} placeholder="e.g. 2026/2027" style={inputStyle} />
                </div>
                <div>
                  <label style={label}>Status (active = true / inactive = false)</label>
                  <input value={settings.isActive ? 'true' : 'false'} onChange={(e) => setSettings({...settings, isActive: e.target.value === 'true'})} placeholder="true or false" style={inputStyle} />
                </div>
                <div>
                  <label style={label}>Start Date</label>
                  <input type="date" value={settings.startDate} onChange={(e) => setSettings({...settings, startDate: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={label}>Start Time</label>
                  <input type="time" value={settings.startTime} onChange={(e) => setSettings({...settings, startTime: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={label}>End Date</label>
                  <input type="date" value={settings.endDate} onChange={(e) => setSettings({...settings, endDate: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={label}>End Time</label>
                  <input type="time" value={settings.endTime} onChange={(e) => setSettings({...settings, endTime: e.target.value})} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={handleSaveSettings} style={{ ...btnPrimary, maxWidth: '200px' }}>{settingsSaved ? '✅ Saved!' : '💾 Save Election Settings'}</button>
                <button onClick={loadAll} style={{ ...btnOutline, maxWidth: '150px' }}>🔄 Reload</button>
              </div>
            </div>
          )}

          {/* ==================== GENERAL SETTINGS ==================== */}
          {activeView === 'generalSettings' && (
            <div style={card}>
              <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700, margin: '0 0 20px', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>🔧 General Settings</h2>
              {generalMsg.text && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', background: generalMsg.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: generalMsg.type === 'error' ? '#ef4444' : '#22c55e', border: `1px solid ${generalMsg.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                  {generalMsg.text}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <div><label style={label}>Site Name</label><input value={generalSettings.siteName} onChange={(e) => setGeneralSettings({...generalSettings, siteName: e.target.value})} style={inputStyle} /></div>
                <div><label style={label}>Election Title</label><input value={generalSettings.electionTitle} onChange={(e) => setGeneralSettings({...generalSettings, electionTitle: e.target.value})} style={inputStyle} /></div>
                <div><label style={label}>Institution</label><input value={generalSettings.institutionName} onChange={(e) => setGeneralSettings({...generalSettings, institutionName: e.target.value})} style={inputStyle} /></div>
                <div><label style={label}>Department</label><input value={generalSettings.departmentName} onChange={(e) => setGeneralSettings({...generalSettings, departmentName: e.target.value})} style={inputStyle} /></div>
                <div><label style={label}>Contact Email</label><input value={generalSettings.contactEmail} onChange={(e) => setGeneralSettings({...generalSettings, contactEmail: e.target.value})} style={inputStyle} /></div>
                <div><label style={label}>Academic Year</label><input value={generalSettings.academicYear} onChange={(e) => setGeneralSettings({...generalSettings, academicYear: e.target.value})} style={inputStyle} /></div>
                <div><label style={label}>Max Per Position</label><input type="number" value={generalSettings.maxCandidatesPerPosition} onChange={(e) => setGeneralSettings({...generalSettings, maxCandidatesPerPosition: parseInt(e.target.value) || 5})} style={inputStyle} /></div>
                <div><label style={label}>Voting Type (single / points)</label><input value={generalSettings.votingType} onChange={(e) => setGeneralSettings({...generalSettings, votingType: e.target.value})} placeholder="single or points" style={inputStyle} /></div>
              </div>
              <button onClick={handleSaveGeneral} style={{ ...btnPrimary, maxWidth: '200px', marginTop: '8px' }}>{generalSaved ? '✅ Saved!' : '💾 Save General Settings'}</button>
            </div>
          )}

          {/* ==================== FORM PURCHASE ==================== */}
          {activeView === 'formPurchase' && (
            <div style={card}>
              <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700, margin: '0 0 20px', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>📋 Form Purchase Settings</h2>
              {fpMsg.text && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', background: fpMsg.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: fpMsg.type === 'error' ? '#ef4444' : '#22c55e', border: `1px solid ${fpMsg.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                  {fpMsg.text}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <div><label style={label}>Status (active = true / inactive = false)</label><input value={formPurchaseCfg.isActive ? 'true' : 'false'} onChange={(e) => setFormPurchaseCfg({...formPurchaseCfg, isActive: e.target.value === 'true'})} placeholder="true or false" style={inputStyle} /></div>
                <div><label style={label}>Max Per Position</label><input type="number" value={formPurchaseCfg.maxPerPosition} onChange={(e) => setFormPurchaseCfg({...formPurchaseCfg, maxPerPosition: parseInt(e.target.value) || 5})} style={inputStyle} /></div>
                <div><label style={label}>Opening Date</label><input type="date" value={formPurchaseCfg.openingDate} onChange={(e) => setFormPurchaseCfg({...formPurchaseCfg, openingDate: e.target.value})} style={inputStyle} /></div>
                <div><label style={label}>Opening Time</label><input type="time" value={formPurchaseCfg.openingTime} onChange={(e) => setFormPurchaseCfg({...formPurchaseCfg, openingTime: e.target.value})} style={inputStyle} /></div>
                <div><label style={label}>Closing Date</label><input type="date" value={formPurchaseCfg.closingDate} onChange={(e) => setFormPurchaseCfg({...formPurchaseCfg, closingDate: e.target.value})} style={inputStyle} /></div>
                <div><label style={label}>Closing Time</label><input type="time" value={formPurchaseCfg.closingTime} onChange={(e) => setFormPurchaseCfg({...formPurchaseCfg, closingTime: e.target.value})} style={inputStyle} /></div>
              </div>

              <h3 style={{ color: '#e2e8f0', fontSize: '15px', fontWeight: 600, margin: '20px 0 12px' }}>Positions & Pricing</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <input value={newPosName} onChange={(e) => setNewPosName(e.target.value)} placeholder="Position name" style={{ ...inputStyle, maxWidth: '260px', marginBottom: 0 }} />
                <input value={newPosAmount} onChange={(e) => setNewPosAmount(e.target.value)} placeholder="Amount (₦)" type="number" style={{ ...inputStyle, maxWidth: '150px', marginBottom: 0 }} />
                <button onClick={addFormPosition} style={{ ...btnPrimary, maxWidth: '130px' }}>➕ Add Position</button>
              </div>

              {formPurchaseCfg.positions.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px', border: '1px dashed #334155', borderRadius: '8px' }}>No positions added yet.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Position</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Amount (₦)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formPurchaseCfg.positions.map((pos, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{i + 1}</td>
                          <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>{pos.position}</td>
                          <td style={{ padding: '10px 12px', color: '#FFD700', fontWeight: 600 }}>₦{Number(pos.amount).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <button onClick={() => removeFormPosition(i)} style={{ padding: '4px 10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button onClick={handleSaveFormPurchase} style={{ ...btnPrimary, maxWidth: '250px', marginTop: '16px' }}>{fpSaved ? '✅ Saved!' : '💾 Save Form Purchase Settings'}</button>
            </div>
          )}

          {/* ==================== CANDIDATES ==================== */}
          {activeView === 'candidates' && (
            <div style={card}>
              <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700, margin: '0 0 20px', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>👥 Manage Candidates</h2>

              <div style={{ marginBottom: '24px', background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                <h3 style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 600, margin: '0 0 12px' }}>{editingCandidate ? '✏️ Edit Candidate' : '➕ Add New Candidate'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" style={inputStyle} />
                  <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Position" style={inputStyle} />
                  <input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Department" style={inputStyle} />
                  <input value={manifesto} onChange={(e) => setManifesto(e.target.value)} placeholder="Manifesto / Slogan" style={inputStyle} />
                  <div>
                    <input type="file" accept="image/*" onChange={handlePhoto} style={{ ...inputStyle, padding: '10px' }} />
                  </div>
                </div>
                {photoPreview && (
                  <div style={{ marginTop: '12px' }}>
                    <img src={photoPreview} alt="Preview" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,215,0,0.3)' }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button onClick={handleAddCandidate} style={{ ...btnPrimary, maxWidth: '160px' }}>{editingCandidate ? '💾 Update Candidate' : '➕ Add Candidate'}</button>
                  {editingCandidate && <button onClick={() => { setEditingCandidate(null); setName(''); setPosition(''); setDept(''); setManifesto(''); setPhoto(null); setPhotoPreview(''); }} style={{ ...btnOutline, maxWidth: '120px' }}>Cancel</button>}
                </div>
              </div>

              {candidates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}><span style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>👤</span><h3>No candidates yet</h3></div>
              ) : (
                Object.entries(groupByPosition(candidates)).map(([pos, cands]) => (
                  <div key={pos} style={{ marginBottom: '20px' }}>
                    <h3 style={{ color: '#FFD700', fontSize: '14px', fontWeight: 600, margin: '0 0 8px', borderBottom: '1px solid rgba(255,215,0,0.1)', paddingBottom: '6px' }}>
                      {pos} <span style={{ color: '#64748b', fontWeight: 400 }}>({cands.length}/{MAX_PER_POSITION})</span>
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                      {cands.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                          {c.photoUrl ? (
                            <img src={c.photoUrl} alt={c.name} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>👤</div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>{c.name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{c.dept}{c.manifesto ? ` • ${c.manifesto}` : ''}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => handleEditCandidate(c)} style={{ padding: '4px 8px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
                            <button onClick={() => handleDeleteCandidate(c.id)} style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ==================== RESULTS ==================== */}
          {activeView === 'results' && (
            <div style={card}>
              <div className="printable-area">
                {/* Centered Logo for Print */}
                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700, margin: 0 }}>📈 Election Results</h2>
                  <button onClick={() => window.print()} className="no-print" style={{ padding: '8px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>🖨️ Print</button>
                </div>

                {/* PRINT LOGO - visible in print */}
                <div style={{ textAlign: 'center', marginBottom: '20px', display: window?.__printMode ? 'block' : 'none' }} className="print-logo">
                  <div style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ width: '90px', height: '90px', borderRadius: '50%', padding: '4px', background: 'linear-gradient(135deg, #FFD700, #e6a800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src="/logo.png" alt="NAMATL" onError={(e) => { e.target.style.display = 'none'; }}
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    </div>
                  </div>
                  <h1 style={{ color: '#FFD700', fontSize: '20px', margin: '8px 0 2px' }}>{generalSettings.electionTitle}</h1>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>{generalSettings.institutionName} • {generalSettings.departmentName}</p>
                  <p style={{ color: '#94a3b8', fontSize: '11px', margin: '4px 0 0' }}>Academic Year: {settings.year || generalSettings.academicYear}</p>
                </div>

                {candidates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}><span style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>📭</span><h3>No candidates available</h3></div>
                ) : selectedCandidate ? (
                  <div>
                    <button onClick={() => setSelectedCandidate(null)} className="no-print" style={{ ...btnOutline, marginBottom: '16px' }}>← Back to All Results</button>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      {selectedCandidate.photoUrl && <img src={selectedCandidate.photoUrl} alt={selectedCandidate.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #FFD700', marginBottom: '8px' }} />}
                      <h3 style={{ color: '#f1f5f9', margin: '0 0 4px' }}>{selectedCandidate.name}</h3>
                      <p style={{ color: '#94a3b8', margin: '0 0 2px', fontSize: '13px' }}>{selectedCandidate.position} • {selectedCandidate.dept}</p>
                      <p style={{ color: '#FFD700', fontWeight: 700, fontSize: '24px', margin: '8px 0 0' }}>{candidateVoters.length} vote{candidateVoters.length !== 1 ? 's' : ''}</p>
                    </div>
                    {candidateVoters.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead><tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}><th style={{ padding: '8px 12px', textAlign: 'left' }}>Student</th><th style={{ padding: '8px 12px', textAlign: 'left' }}>Department</th><th style={{ padding: '8px 12px', textAlign: 'left' }}>Level</th><th style={{ padding: '8px 12px', textAlign: 'left' }}>Time</th></tr></thead>
                          <tbody>{candidateVoters.map((v, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                              <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>{v.fullName || 'Anonymous'}</td>
                              <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{v.department || '-'}</td>
                              <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{v.level || '-'}</td>
                              <td style={{ padding: '8px 12px', color: '#64748b' }}>{v.timestamp?.toDate?.()?.toLocaleString() || 'Just now'}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    ) : <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', padding: '20px' }}>No votes recorded for this candidate.</p>}
                  </div>
                ) : (
                  Object.entries(groupByPosition(candidates)).map(([pos, cands]) => (
                    <div key={pos} style={{ marginBottom: '24px' }}>
                      <h3 style={{ color: '#FFD700', fontSize: '15px', fontWeight: 600, margin: '0 0 8px', borderBottom: '1px solid rgba(255,215,0,0.15)', paddingBottom: '8px' }}>{pos}</h3>
                      {cands.map(c => {
                        const votes = voters.filter(v => v.votedFor === c.name || v.votedFor === c.position).length;
                        const total = cands.reduce((sum, cc) => sum + voters.filter(v => v.votedFor === cc.name || v.votedFor === cc.position).length, 0);
                        const pct = total > 0 ? (votes / total * 100) : 0;
                        return (
                          <div key={c.id} onClick={() => viewCandidateVoters(c)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0f172a', borderRadius: '8px', marginBottom: '8px', border: '1px solid #334155', transition: 'all 0.2s' }}
                            onMouseEnter={(e) => { e.target.style.borderColor = 'rgba(255,215,0,0.3)'; e.target.style.background = '#1a2332'; }}
                            onMouseLeave={(e) => { e.target.style.borderColor = '#334155'; e.target.style.background = '#0f172a'; }}>
                            {c.photoUrl ? <img src={c.photoUrl} alt={c.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>👤</div>}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>{c.name}</div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>{c.dept}</div>
                            </div>
                            <div style={{ textAlign: 'right', minWidth: '80px' }}>
                              <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFD700' }}>{votes}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{pct.toFixed(0)}%</div>
                            </div>
                            <div style={{ width: '100px', height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #FFD700, #e6a800)', borderRadius: '3px', transition: 'width 0.5s' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ==================== ACTIVATION ==================== */}
          {activeView === 'activation' && (
            <div style={card}>
              <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700, margin: '0 0 20px', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>🔑 Election Activation</h2>

              {activationMsg && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', background: activationMsg.includes('❌') ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: activationMsg.includes('❌') ? '#ef4444' : '#22c55e', border: `1px solid ${activationMsg.includes('❌') ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                  {activationMsg}
                </div>
              )}

              {/* Prerequisites Status */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px', padding: '16px', background: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <span>{candidates.length > 0 ? '✅' : '❌'}</span>
                  <span style={{ color: candidates.length > 0 ? '#22c55e' : '#ef4444' }}>{candidates.length > 0 ? `${candidates.length} candidate(s) ready` : 'No candidates added'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <span>{settings.year ? '✅' : '❌'}</span>
                  <span style={{ color: settings.year ? '#22c55e' : '#ef4444' }}>{settings.year ? `Year: ${settings.year}` : 'No election year set'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <span>{settings.isActive ? '🔓' : '🔒'}</span>
                  <span style={{ color: settings.isActive ? '#22c55e' : '#94a3b8' }}>{settings.isActive ? 'Currently active' : 'Currently inactive'}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                {/* Academic Year */}
                <div>
                  <label style={{ ...label, color: '#FFD700' }}>Academic Year</label>
                  <input value={activationYear} onChange={(e) => setActivationYear(e.target.value)}
                    placeholder="e.g. 2026/2027" style={inputStyle} />
                  {activationYear === '2026/2027' && (
                    <p style={{ fontSize: '11px', color: '#22c55e', margin: '4px 0 0' }}>🎉 FREE activation for 2026/2027!</p>
                  )}
                  {activationYear && activationYear !== '2026/2027' && (
                    <p style={{ fontSize: '11px', color: '#f59e0b', margin: '4px 0 0' }}>💰 N25,000 activation fee required for {activationYear}</p>
                  )}
                </div>

                {/* Start Date */}
                <div>
                  <label style={label}>Election Start Date</label>
                  <input type="date" value={activationStartDate}
                    onChange={(e) => setActivationStartDate(e.target.value)} style={inputStyle} />
                </div>
                {/* Start Time */}
                <div>
                  <label style={label}>Election Start Time</label>
                  <input type="time" value={activationStartTime}
                    onChange={(e) => setActivationStartTime(e.target.value)} style={inputStyle} />
                </div>
                {/* End Date */}
                <div>
                  <label style={label}>Election End Date</label>
                  <input type="date" value={activationEndDate}
                    onChange={(e) => setActivationEndDate(e.target.value)} style={inputStyle} />
                </div>
                {/* End Time */}
                <div>
                  <label style={label}>Election End Time</label>
                  <input type="time" value={activationEndTime}
                    onChange={(e) => setActivationEndTime(e.target.value)} style={inputStyle} />
                </div>

                {/* Activation Toggle */}
                <div>
                  <label style={label}>Activation Toggle</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                    <div onClick={() => setActivationToggle(!activationToggle)}
                      style={{
                        width: '48px', height: '26px', borderRadius: '13px',
                        background: activationToggle ? '#22c55e' : '#475569',
                        cursor: 'pointer', position: 'relative', transition: 'background 0.3s',
                        flexShrink: 0,
                      }}>
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        background: 'white', position: 'absolute', top: '2px',
                        left: activationToggle ? '24px' : '2px',
                        transition: 'left 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                    <span style={{ fontSize: '13px', color: activationToggle ? '#22c55e' : '#94a3b8', fontWeight: 600 }}>
                      {activationToggle ? 'ACTIVE - Voting Open' : 'INACTIVE - Voting Closed'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px', background: 'rgba(255,215,0,0.05)', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.15)', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px', color: '#94a3b8', fontSize: '13px' }}>
                  <strong style={{ color: '#FFD700' }}>How it works:</strong>
                </p>
                <ul style={{ margin: '0', paddingLeft: '20px', color: '#94a3b8', fontSize: '12px', lineHeight: '1.8' }}>
                  <li>Enter the academic year, start date/time, and end date/time.</li>
                  <li>If year is <strong style={{ color: '#22c55e' }}>2026/2027</strong> → activation is <strong style={{ color: '#22c55e' }}>FREE</strong>.</li>
                  <li>Any other year → you handle the N25,000 payment manually.</li>
                  <li>Toggle the switch <strong>ON</strong> to make voting live.</li>
                  <li>At least <strong>1 candidate</strong> and a saved <strong>election year</strong> are required.</li>
                </ul>
              </div>

              <button onClick={handleActivate} disabled={activating}
                style={{
                  ...btnPrimary, maxWidth: '280px',
                  background: activating ? '#475569' : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  color: activating ? '#94a3b8' : 'white',
                  cursor: activating ? 'not-allowed' : 'pointer',
                  padding: '14px 0', fontSize: '15px',
                }}>
                {activating ? '⏳ Processing...' : activationToggle ? '🔓 ACTIVATE ELECTION' : '💾 Save Settings'}
              </button>
            </div>
          )}

          {/* ==================== WITHDRAWAL ==================== */}
          {activeView === 'withdrawal' && (
            <div style={{ ...card, maxWidth: '500px' }}>
              <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700, margin: '0 0 20px', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>💰 Withdraw Funds</h2>

              <div style={{ textAlign: 'center', padding: '20px', background: '#0f172a', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(255,215,0,0.15)' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Available Balance</div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#FFD700' }}>₦{withdrawalBalance.toLocaleString()}</div>
              </div>

              {withdrawMsg && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', background: withdrawMsg.includes('❌') ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: withdrawMsg.includes('❌') ? '#ef4444' : '#22c55e', border: `1px solid ${withdrawMsg.includes('❌') ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                  {withdrawMsg}
                </div>
              )}

              <div style={{ marginBottom: '12px' }}>
                <label style={label}>Admin ID</label>
                <input type="password" value={withdrawAdminId} onChange={(e) => setWithdrawAdminId(e.target.value)} placeholder="Enter Admin ID" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={label}>Withdrawal PIN</label>
                <input type="password" value={withdrawPin} onChange={(e) => setWithdrawPin(e.target.value)} placeholder="Enter PIN" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Amount (₦)</label>
                <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Min: ₦1,000" style={inputStyle} />
              </div>

              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 16px' }}>
                Funds will be sent to Opay <strong style={{ color: '#FFD700' }}>{OPAY_ACCOUNT}</strong>
              </p>

              <button onClick={handleWithdraw} disabled={withdrawing}
                style={{ ...btnPrimary, background: withdrawing ? '#475569' : 'linear-gradient(135deg, #f59e0b, #d97706)', color: withdrawing ? '#94a3b8' : '#0f172a', cursor: withdrawing ? 'not-allowed' : 'pointer', padding: '14px 0' }}>
                {withdrawing ? '⏳ Processing...' : '💰 Withdraw Now'}
              </button>
            </div>
          )}

          {/* ==================== SUPPORT ==================== */}
          {activeView === 'support' && (
            <div style={card}>
              <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700, margin: '0 0 20px', borderBottom: '2px solid rgba(255,215,0,0.2)', paddingBottom: '12px' }}>
                💬 Support Messages {unreadCount > 0 && <span style={{ color: '#f59e0b', fontSize: '14px' }}>({unreadCount} new)</span>}
              </h2>
              {supportMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}><span style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>📭</span><h3>No messages yet</h3></div>
              ) : (
                supportMessages.map(msg => (
                  <div key={msg.id} onClick={() => markAsRead(msg.id)}
                    style={{ padding: '16px', borderBottom: '1px solid #1e293b', cursor: 'pointer', background: msg.status === 'unread' ? 'rgba(255,215,0,0.04)' : 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ color: '#FFD700', fontSize: '14px' }}>{msg.name || 'Anonymous'}</strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{msg.timestamp?.toDate?.()?.toLocaleString() || 'Just now'}</span>
                    </div>
                    {msg.email && msg.email !== 'Not provided' && <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>📧 {msg.email}</div>}
                    <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>{msg.message}</p>
                    {msg.status === 'unread' && <span style={{ display: 'inline-block', marginTop: '8px', padding: '2px 8px', background: '#f59e0b', color: 'white', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>NEW</span>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}