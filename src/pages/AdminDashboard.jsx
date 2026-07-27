import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { collection, addDoc, getDocs, getDoc, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useDataCharge } from '../context/DataChargeContext';

const MAX_PER_POSITION = 5;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const {
    withdrawalBalance, withdraw, loadBalance, loadFormPurchases, saveFormPurchaseSettings,
    formPurchaseSettings, formPurchases, ADMIN_ID, WITHDRAWAL_PIN, OPAY_ACCOUNT
  } = useDataCharge();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [candidates, setCandidates] = useState([]);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [dept, setDept] = useState('');
  const [manifesto, setManifesto] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [editingCandidate, setEditingCandidate] = useState(null);

  const [settings, setSettings] = useState({
    year: '', startDate: '', startTime: '', endDate: '', endTime: '', isActive: false
  });

  const [withdrawAdminId, setWithdrawAdminId] = useState('');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMsg, setWithdrawMsg] = useState({ type: '', text: '' });

  const [voters, setVoters] = useState([]);
  const [supportMessages, setSupportMessages] = useState([]);

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

  // ===================== ACTIVATION STATE =====================
  const [activeMode, setActiveMode] = useState('none');
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationMsg, setActivationMsg] = useState({ type: '', text: '' });

  // ===================== LOAD ACTIVATION FROM FIRESTORE =====================
  const loadActivation = async () => {
    try {
      const activationSnap = await getDoc(doc(db, 'settings', 'main'));
      if (activationSnap.exists()) {
        const data = activationSnap.data();
        let currentMode = data.activeMode || 'none';
        const now = new Date();

        // ===== AUTO-STOP ELECTION IF END DATE/TIME HAS PASSED =====
        if (currentMode === 'election' || currentMode === 'both') {
          const electionSnap = await getDoc(doc(db, 'settings', 'election'));
          if (electionSnap.exists()) {
            const electionData = electionSnap.data();
            if (electionData.endDate && electionData.endTime) {
              const endDateTime = new Date(electionData.endDate + 'T' + electionData.endTime);
              if (now >= endDateTime) {
                console.log('[Auto-Stop] Election end time passed. Auto-stopping election.');
                const newMode = currentMode === 'both' ? 'formPurchase' : 'none';
                await setDoc(doc(db, 'settings', 'main'), {
                  activeMode: newMode,
                  isActive: false
                }, { merge: true });
                currentMode = newMode;
              }
            }
          }
        }

        // ===== AUTO-STOP FORM PURCHASE IF END DATE/TIME HAS PASSED =====
        if (currentMode === 'formPurchase' || currentMode === 'both') {
          const fpSnap = await getDoc(doc(db, 'settings', 'formPurchase'));
          if (fpSnap.exists()) {
            const fpData = fpSnap.data();
            if (fpData.closingDate && fpData.closingTime) {
              const closeDateTime = new Date(fpData.closingDate + 'T' + fpData.closingTime);
              if (now >= closeDateTime) {
                console.log('[Auto-Stop] Form purchase end time passed. Auto-stopping form purchase.');
                const newMode = currentMode === 'both' ? 'election' : 'none';
                await setDoc(doc(db, 'settings', 'main'), {
                  activeMode: newMode,
                }, { merge: true });
                await setDoc(doc(db, 'settings', 'formPurchase'), {
                  isActive: false
                }, { merge: true });
                currentMode = newMode;
              }
            }
          }
        }

        setActiveMode(currentMode);
      }
    } catch (e) {
      console.error('Load activation error:', e);
    }
  };

  // ===================== ACTIVATION HANDLERS =====================
  const handleActivate = async (type) => {
    setActivationLoading(true);
    setActivationMsg({ type: '', text: '' });
    try {
      let newMode;
      if (type === 'election') {
        newMode = activeMode === 'formPurchase' ? 'both' : 'election';
      } else if (type === 'formPurchase') {
        newMode = activeMode === 'election' ? 'both' : 'formPurchase';
      }

      await setDoc(doc(db, 'settings', 'main'), { activeMode: newMode }, { merge: true });

      if (type === 'election') {
        const electionSettings = await getDoc(doc(db, 'settings', 'election'));
        if (electionSettings.exists()) {
          const data = electionSettings.data();
          await setDoc(doc(db, 'settings', 'main'), {
            isActive: true,
            startDate: data.startDate || '',
            startTime: data.startTime || '',
            endDate: data.endDate || '',
            endTime: data.endTime || '',
            year: data.year || ''
          }, { merge: true });
        }
      }

      if (type === 'formPurchase') {
        await setDoc(doc(db, 'settings', 'formPurchase'), {
          isActive: true
        }, { merge: true });
      }

      setActiveMode(newMode);
      setActivationMsg({ type: 'success', text: `✅ ${type === 'election' ? 'Election' : 'Form Purchase'} activated!` });
      setTimeout(() => setActivationMsg({ type: '', text: '' }), 4000);
    } catch (e) {
      setActivationMsg({ type: 'error', text: '❌ Error: ' + e.message });
    }
    setActivationLoading(false);
  };

  const handleToggleStop = async (type) => {
    setActivationLoading(true);
    setActivationMsg({ type: '', text: '' });
    try {
      let newMode;
      if (type === 'election') {
        newMode = activeMode === 'both' ? 'formPurchase' : 'none';
      } else if (type === 'formPurchase') {
        newMode = activeMode === 'both' ? 'election' : 'none';
      }

      await setDoc(doc(db, 'settings', 'main'), { activeMode: newMode }, { merge: true });

      if (type === 'election') {
        await setDoc(doc(db, 'settings', 'main'), { isActive: false }, { merge: true });
      }

      if (type === 'formPurchase') {
        await setDoc(doc(db, 'settings', 'formPurchase'), { isActive: false }, { merge: true });
      }

      setActiveMode(newMode);
      setActivationMsg({ type: 'success', text: `✅ ${type === 'election' ? 'Election' : 'Form Purchase'} stopped. ${type === 'election' ? 'Results now available.' : ''}` });
      setTimeout(() => setActivationMsg({ type: '', text: '' }), 4000);
    } catch (e) {
      setActivationMsg({ type: 'error', text: '❌ Error: ' + e.message });
    }
    setActivationLoading(false);
  };

  // ===================== LOAD ALL DATA =====================
  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      // Load candidates
      const candidateSnap = await getDocs(collection(db, 'candidates'));
      const candidateList = candidateSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCandidates(candidateList);

      // Load voters
      const voterSnap = await getDocs(collection(db, 'voters'));
      setVoters(voterSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Load support messages
      const msgSnap = await getDocs(collection(db, 'supportMessages'));
      const msgs = msgSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      msgs.sort((a, b) => {
        const tA = a.timestamp?.toDate?.() || new Date(0);
        const tB = b.timestamp?.toDate?.() || new Date(0);
        return tB - tA;
      });
      setSupportMessages(msgs);

      // Load election settings
      const electionSnap = await getDoc(doc(db, 'settings', 'election'));
      if (electionSnap.exists()) {
        const d = electionSnap.data();
        setSettings({
          year: d.year || '',
          startDate: d.startDate || '',
          startTime: d.startTime || '',
          endDate: d.endDate || '',
          endTime: d.endTime || '',
          isActive: d.isActive || false
        });
      }

      // Load form purchase settings
      await loadFormPurchases();
      await loadBalance();
      await loadActivation();

      // Load form purchase positions
      const fpSnap = await getDoc(doc(db, 'settings', 'formPurchase'));
      if (fpSnap.exists()) {
        const fpData = fpSnap.data();
        setFpPositions(fpData.positions || []);
        setFpOpeningDate(fpData.openingDate || '');
        setFpClosingDate(fpData.closingDate || '');
        setFpOpeningTime(fpData.openingTime || '');
        setFpClosingTime(fpData.closingTime || '');
        setFpIsActive(fpData.isActive || false);

        // Count how many candidates per position from form purchases
        const counts = {};
        (fpData.positions || []).forEach(p => { counts[p.position] = 0; });
        candidateList.forEach(c => {
          if (c.paidForm && counts[c.position] !== undefined) {
            counts[c.position] = (counts[c.position] || 0) + 1;
          }
        });
        setFpCandidateCounts(counts);
      }
    } catch (e) {
      console.error('Load error:', e);
      setError('Failed to load data: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadAllData(); }, []);

  // ===================== CANDIDATE CRUD =====================
  const handleSaveCandidate = async () => {
    if (!name.trim() || !position.trim() || !dept.trim()) {
      setError('Name, position, and department are required');
      return;
    }
    if (editingCandidate && editingCandidate.paidForm && !manifesto.trim()) {
      setError('Manifesto is required for form purchase candidates');
      return;
    }
    try {
      let photoUrl = editingCandidate?.photo || '';
      if (photo) {
        const photoRef = ref(storage, `candidates/${Date.now()}_${photo.name}`);
        await uploadBytes(photoRef, photo);
        photoUrl = await getDownloadURL(photoRef);
      }

      if (editingCandidate) {
        const updateData = { name: name.trim(), position: position.trim(), dept: dept.trim() };
        if (manifesto.trim()) updateData.manifesto = manifesto.trim();
        if (photoUrl) updateData.photo = photoUrl;
        await updateDoc(doc(db, 'candidates', editingCandidate.id), updateData);
      } else {
        await addDoc(collection(db, 'candidates'), {
          name: name.trim(),
          position: position.trim(),
          dept: dept.trim(),
          manifesto: manifesto.trim(),
          photo: photoUrl,
          votes: 0,
          paidForm: false,
          createdAt: new Date()
        });
      }

      setEditingCandidate(null);
      setName(''); setPosition(''); setDept(''); setManifesto(''); setPhoto(null); setPhotoPreview('');
      loadAllData();
    } catch (e) {
      setError('Error saving candidate: ' + e.message);
    }
  };

  const handleEditCandidate = (candidate) => {
    setEditingCandidate(candidate);
    setName(candidate.name);
    setPosition(candidate.position);
    setDept(candidate.dept);
    setManifesto(candidate.manifesto || '');
    setPhotoPreview(candidate.photo || '');
  };

  const handleDeleteCandidate = async (id) => {
    if (!window.confirm('Delete this candidate?')) return;
    try {
      await deleteDoc(doc(db, 'candidates', id));
      loadAllData();
    } catch (e) {
      setError('Delete error: ' + e.message);
    }
  };

  // ===================== ELECTION SETTINGS =====================
  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'election'), {
        year: settings.year,
        startDate: settings.startDate,
        startTime: settings.startTime,
        endDate: settings.endDate,
        endTime: settings.endTime,
        isActive: settings.isActive
      });
      alert('✅ Election settings saved!');
    } catch (e) {
      setError('Error saving settings: ' + e.message);
    }
  };

  // ===================== FORM PURCHASE =====================
  const handleFpAddPosition = () => {
    if (!fpNewPosition.trim() || !fpNewAmount) {
      setFpMsg('Error: Enter position and amount');
      setTimeout(() => setFpMsg(''), 3000);
      return;
    }
    if (fpPositions.some(p => p.position.toLowerCase() === fpNewPosition.trim().toLowerCase())) {
      setFpMsg('Error: Position already exists');
      setTimeout(() => setFpMsg(''), 3000);
      return;
    }
    setFpPositions([...fpPositions, { position: fpNewPosition.trim(), amount: Number(fpNewAmount) }]);
    setFpNewPosition('');
    setFpNewAmount('');
  };

  const handleFpRemovePosition = (index) => {
    setFpPositions(fpPositions.filter((_, i) => i !== index));
  };

  const handleFpSaveSettings = async () => {
    setFpSaving(true);
    setFpMsg('');
    try {
      await saveFormPurchaseSettings({
        positions: fpPositions,
        openingDate: fpOpeningDate,
        closingDate: fpClosingDate,
        openingTime: fpOpeningTime,
        closingTime: fpClosingTime,
        isActive: fpIsActive
      });
      setFpMsg('✅ Settings saved successfully!');
      setTimeout(() => setFpMsg(''), 3000);
    } catch (e) {
      setFpMsg('Error: ' + e.message);
    }
    setFpSaving(false);
  };

  // ===================== WITHDRAWAL =====================
  const handleWithdraw = async () => {
    setWithdrawMsg({ type: '', text: '' });
    if (!withdrawAdminId.trim()) { setWithdrawMsg({ type: 'error', text: '❌ Admin ID is required' }); return; }
    if (!withdrawPin.trim()) { setWithdrawMsg({ type: 'error', text: '❌ Withdrawal PIN is required' }); return; }
    if (!withdrawAmount || Number(withdrawAmount) < 100) { setWithdrawMsg({ type: 'error', text: '❌ Minimum withdrawal is ₦100' }); return; }

    if (withdrawAdminId !== ADMIN_ID) { setWithdrawMsg({ type: 'error', text: '❌ Invalid Admin ID' }); return; }
    if (withdrawPin !== WITHDRAWAL_PIN) { setWithdrawMsg({ type: 'error', text: '❌ Invalid Withdrawal PIN' }); return; }
    if (Number(withdrawAmount) > withdrawalBalance) { setWithdrawMsg({ type: 'error', text: '❌ Insufficient balance' }); return; }

    try {
      const result = await withdraw(Number(withdrawAmount));
      if (result.success) {
        setWithdrawMsg({ type: 'success', text: `✅ ₦${Number(withdrawAmount).toLocaleString()} withdrawal initiated to ${OPAY_ACCOUNT}!` });
        loadBalance();
      } else {
        setWithdrawMsg({ type: 'error', text: '❌ ' + (result.error || 'Withdrawal failed') });
      }
    } catch (e) {
      setWithdrawMsg({ type: 'error', text: '❌ Error: ' + e.message });
    }
  };

  // ===================== COMPUTED VALUES =====================
  const sortedByVotes = [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));

  // ===================== STYLES =====================
  const inputStyle = {
    width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: '8px',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px',
    transition: 'border-color 0.2s',
  };

  const cardStyle = {
    background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    marginBottom: '20px',
  };

  const btnPrimary = {
    padding: '10px 20px', background: '#003366', color: 'white', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
  };

  const btnSuccess = {
    padding: '10px 20px', background: '#16a34a', color: 'white', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
  };

  const btnDanger = {
    padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
  };

  const navLinkStyle = (isActive) => ({
    display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px',
    borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', fontSize: '14px',
    background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
    color: 'white', fontWeight: isActive ? 'bold' : 'normal',
    transition: 'all 0.2s',
  });

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8' }}>
        <div>
          <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '16px' }}>⏳</div>
          <p style={{ color: '#003366', fontWeight: 'bold', fontSize: '18px' }}>Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f4f8' }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? '240px' : '60px',
        background: 'linear-gradient(180deg, #001a33 0%, #003366 100%)',
        color: 'white', padding: '16px 8px', transition: 'width 0.3s',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100,
      }}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
          background: 'transparent', border: 'none', color: 'white', fontSize: '20px',
          cursor: 'pointer', padding: '8px', marginBottom: '20px', textAlign: 'center',
        }}>
          {sidebarOpen ? '✕' : '☰'}
        </button>
        {sidebarOpen && <h3 style={{ margin: '0 0 20px 8px', fontSize: '16px' }}>NAMATL Admin</h3>}
        <div style={{ flex: 1 }}>
          {[
            { key: 'dashboard', label: 'Dashboard', icon: '📊' },
            { key: 'election', label: 'Election', icon: '🗳️' },
            { key: 'candidates', label: 'Candidates', icon: '👥' },
            { key: 'results', label: 'Results', icon: '📈' },
            { key: 'form-purchase', label: 'Form Purchase', icon: '📋' },
            { key: 'withdrawal', label: 'Withdrawal', icon: '💰' },
            { key: 'messages', label: 'Messages', icon: '✉️' },
          ].map(item => (
            <div key={item.key} onClick={() => { setActiveView(item.key); setSidebarOpen(true); }}
                 style={navLinkStyle(activeView === item.key)}>
              <span>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/')} style={{
          background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '12px',
          borderRadius: '8px', cursor: 'pointer', width: '100%', fontSize: '13px',
        }}>
          {sidebarOpen ? '🏠 Exit to Home' : '🏠'}
        </button>
      </div>

      {/* Main Content */}
      <div style={{ marginLeft: sidebarOpen ? '240px' : '60px', flex: 1, padding: '24px', transition: 'margin-left 0.3s' }}>
        {error && (
          <div style={{ padding: '12px 16px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold' }}>
            ⚠️ {error}
            <button onClick={() => setError('')} style={{ float: 'right', background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Dashboard */}
        {activeView === 'dashboard' && (
          <div>
            <h1 style={{ color: '#003366', marginBottom: '20px' }}>🏛️ Admin Dashboard</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#888' }}>Candidates</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#003366', margin: '8px 0' }}>{candidates.length}</p>
              </div>
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#888' }}>Voters</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#003366', margin: '8px 0' }}>{voters.length}</p>
              </div>
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#888' }}>Messages</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#003366', margin: '8px 0' }}>{supportMessages.filter(m => m.status === 'unread').length}</p>
              </div>
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#888' }}>Balance</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#16a34a', margin: '8px 0' }}>₦{withdrawalBalance.toLocaleString()}</p>
              </div>
            </div>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', marginBottom: '12px' }}>Quick Actions</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveView('election')} style={btnPrimary}>⚙️ Manage Election</button>
                <button onClick={() => setActiveView('candidates')} style={btnSuccess}>👥 Manage Candidates</button>
                <button onClick={() => setActiveView('withdrawal')} style={{ ...btnPrimary, background: '#f59e0b', color: '#003366' }}>💰 Withdraw Funds</button>
                <button onClick={() => setActiveView('messages')} style={btnPrimary}>✉️ View Messages</button>
              </div>
            </div>
          </div>
        )}

        {/* Election Settings */}
        {activeView === 'election' && (
          <div style={cardStyle}>
            <h2 style={{ color: '#003366', marginBottom: '16px' }}>⚙️ Election Settings</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Year</label>
                <input type="text" value={settings.year} onChange={e => setSettings({...settings, year: e.target.value})} placeholder="e.g. 2026" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Active</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <input type="checkbox" checked={settings.isActive} onChange={e => setSettings({...settings, isActive: e.target.checked})} />
                  Election is active
                </label>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Start Date</label>
                <input type="date" value={settings.startDate} onChange={e => setSettings({...settings, startDate: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Start Time</label>
                <input type="time" value={settings.startTime} onChange={e => setSettings({...settings, startTime: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>End Date</label>
                <input type="date" value={settings.endDate} onChange={e => setSettings({...settings, endDate: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>End Time</label>
                <input type="time" value={settings.endTime} onChange={e => setSettings({...settings, endTime: e.target.value})} style={inputStyle} />
              </div>
            </div>
            <button onClick={handleSaveSettings} style={btnPrimary}>💾 Save Election Settings</button>

            {/* ACTIVATION SECTION */}
            <div style={{ marginTop: '24px', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
              <h3 style={{ color: '#003366', marginBottom: '16px' }}>🗳️ Election Activation</h3>

              {activationMsg.text && (
                <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold', background: activationMsg.type === 'error' ? '#fee2e2' : '#d1fae5', color: activationMsg.type === 'error' ? '#dc2626' : '#16a34a' }}>
                  {activationMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px',
                  background: (activeMode === 'election' || activeMode === 'both') ? '#d1fae5' : '#fee2e2',
                  color: (activeMode === 'election' || activeMode === 'both') ? '#16a34a' : '#dc2626'
                }}>
                  {(activeMode === 'election' || activeMode === 'both') ? '● LIVE' : '○ OFF'}
                </div>
              </div>

              <div style={{
                padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', marginBottom: '20px',
                fontSize: '13px', color: '#666'
              }}>
                <strong>Prerequisites:</strong>
                <span style={{ marginLeft: '8px' }}>
                  {candidates.length === 0 ? (
                    <span style={{ color: '#dc2626' }}>❌ No candidates</span>
                  ) : (
                    <span style={{ color: '#16a34a' }}>✅ {candidates.length} candidates</span>
                  )}
                </span>
                <span style={{ margin: '0 12px' }}>|</span>
                <span>
                  {!settings.startDate || !settings.endDate ? (
                    <span style={{ color: '#dc2626' }}>❌ Dates not set</span>
                  ) : (
                    <span style={{ color: '#16a34a' }}>✅ Dates configured</span>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleActivate('election')}
                  disabled={activationLoading || (activeMode === 'election' || activeMode === 'both') || candidates.length === 0}
                  style={{
                    ...btnSuccess,
                    opacity: (activationLoading || (activeMode === 'election' || activeMode === 'both') || candidates.length === 0) ? 0.5 : 1,
                    cursor: (activationLoading || (activeMode === 'election' || activeMode === 'both') || candidates.length === 0) ? 'not-allowed' : 'pointer',
                    padding: '14px 32px', fontSize: '15px'
                  }}
                >
                  {activationLoading ? '⏳...' : '🔘 Activate'}
                </button>
                <button
                  onClick={() => handleToggleStop('election')}
                  disabled={activationLoading || !(activeMode === 'election' || activeMode === 'both')}
                  style={{
                    ...btnDanger,
                    opacity: (activationLoading || !(activeMode === 'election' || activeMode === 'both')) ? 0.5 : 1,
                    cursor: (activationLoading || !(activeMode === 'election' || activeMode === 'both')) ? 'not-allowed' : 'pointer',
                    padding: '14px 32px', fontSize: '15px'
                  }}
                >
                  {activationLoading ? '⏳...' : '⏹️ Stop Election'}
                </button>
              </div>
            </div>

            {/* FORM PURCHASE ACTIVATION */}
            <div style={{ marginTop: '24px', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
              <h3 style={{ color: '#003366', marginBottom: '16px' }}>📋 Form Purchase Activation</h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px',
                  background: (activeMode === 'formPurchase' || activeMode === 'both') ? '#d1fae5' : '#fee2e2',
                  color: (activeMode === 'formPurchase' || activeMode === 'both') ? '#16a34a' : '#dc2626'
                }}>
                  {(activeMode === 'formPurchase' || activeMode === 'both') ? '● LIVE' : '○ OFF'}
                </div>
              </div>

              <div style={{
                padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', marginBottom: '20px',
                fontSize: '13px', color: '#666'
              }}>
                <strong>Prerequisites:</strong>
                <span style={{ marginLeft: '8px' }}>
                  {fpPositions.length === 0 ? (
                    <span style={{ color: '#dc2626' }}>❌ No positions set</span>
                  ) : (
                    <span style={{ color: '#16a34a' }}>✅ {fpPositions.length} positions</span>
                  )}
                </span>
                <span style={{ margin: '0 12px' }}>|</span>
                <span>
                  {!fpOpeningDate || !fpClosingDate ? (
                    <span style={{ color: '#dc2626' }}>❌ Dates not set</span>
                  ) : (
                    <span style={{ color: '#16a34a' }}>✅ Dates configured</span>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleActivate('formPurchase')}
                  disabled={activationLoading || (activeMode === 'formPurchase' || activeMode === 'both') || fpPositions.length === 0}
                  style={{
                    ...btnSuccess,
                    opacity: (activationLoading || (activeMode === 'formPurchase' || activeMode === 'both') || fpPositions.length === 0) ? 0.5 : 1,
                    cursor: (activationLoading || (activeMode === 'formPurchase' || activeMode === 'both') || fpPositions.length === 0) ? 'not-allowed' : 'pointer',
                    padding: '14px 32px', fontSize: '15px'
                  }}
                >
                  {activationLoading ? '⏳...' : '🔘 Activate'}
                </button>
                <button
                  onClick={() => handleToggleStop('formPurchase')}
                  disabled={activationLoading || !(activeMode === 'formPurchase' || activeMode === 'both')}
                  style={{
                    ...btnDanger,
                    opacity: (activationLoading || !(activeMode === 'formPurchase' || activeMode === 'both')) ? 0.5 : 1,
                    cursor: (activationLoading || !(activeMode === 'formPurchase' || activeMode === 'both')) ? 'not-allowed' : 'pointer',
                    padding: '14px 32px', fontSize: '15px'
                  }}
                >
                  {activationLoading ? '⏳...' : '⏹️ Stop Form Purchase'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Candidates */}
        {activeView === 'candidates' && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: '#003366', margin: 0 }}>👥 Manage Candidates</h2>
              <span style={{ fontSize: '12px', color: '#888' }}>
                {candidates.filter(c => c.paidForm).length} from form purchases | {candidates.length} total
              </span>
            </div>
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#003366' }}>{editingCandidate ? '✏️ Edit Candidate (Add photo & manifesto)' : '➕ Add Candidate Manually'}</h3>
              {editingCandidate && editingCandidate.paidForm && (
                <p style={{ fontSize: '13px', color: '#16a34a', marginBottom: '12px', background: '#d1fae5', padding: '8px 12px', borderRadius: '6px' }}>
                  ✅ This candidate purchased a form. Name, position, and department are already filled. Just add a manifesto and photo below.
                </p>
              )}
              <input placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
              <input placeholder="Position" value={position} onChange={e => setPosition(e.target.value)} style={inputStyle} />
              <input placeholder="Department" value={dept} onChange={e => setDept(e.target.value)} style={inputStyle} />
              <textarea placeholder="Manifesto (required for form purchasers)" value={manifesto} onChange={e => setManifesto(e.target.value)} style={{...inputStyle, minHeight: '80px'}} />
              <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if(f) { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); }}} />
              {photoPreview && <img src={photoPreview} alt="" style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', margin: '8px 0' }} />}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={handleSaveCandidate} style={btnSuccess}>{editingCandidate ? '✏️ Update' : '➕ Add'}</button>
                {editingCandidate && <button onClick={() => { setEditingCandidate(null); setName(''); setPosition(''); setDept(''); setManifesto(''); setPhoto(null); setPhotoPreview(''); }} style={btnDanger}>Cancel</button>}
              </div>
            </div>
            {candidates.length === 0 ? <p style={{ color: '#999', textAlign: 'center' }}>No candidates yet</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#003366', color: 'white' }}>
                      <th style={{ padding: '12px', textAlign: 'left' }}>#</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Position</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Votes</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Source</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Photo</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px' }}>{i+1}</td>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{c.name}</td>
                        <td style={{ padding: '12px', color: '#666' }}>{c.position}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{c.votes || 0}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {c.paidForm ? (
                            <span style={{ background: '#d1fae5', color: '#16a34a', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>Form Purchase</span>
                          ) : (
                            <span style={{ background: '#f0f7ff', color: '#2563eb', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>Manual</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {c.photo ? (
                            <img src={c.photo} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ color: '#dc2626', fontSize: '12px' }}>❌ No photo</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button onClick={() => handleEditCandidate(c)} style={{ padding: '6px 14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginRight: '8px', fontSize: '13px' }}>Edit</button>
                          <button onClick={() => handleDeleteCandidate(c.id)} style={{ padding: '6px 14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Del</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {activeView === 'results' && (
          <div style={cardStyle}>
            <h2 style={{ color: '#003366', marginBottom: '16px' }}>📈 Election Results</h2>
            {activeMode === 'election' || activeMode === 'both' ? (
              <p style={{ color: '#f59e0b', background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold' }}>
                ⏳ Election is still active. Results will auto-appear once election ends.
              </p>
            ) : (
              candidates.length > 0 && (
                <p style={{ color: '#16a34a', background: '#d1fae5', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold' }}>
                  ✅ Election ended — final results displayed below.
                </p>
              )
            )}
            {candidates.length === 0 ? <p style={{ color: '#999', textAlign: 'center' }}>No candidates yet</p> : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#003366', color: 'white' }}>
                      <th style={{ padding: '12px' }}>Position</th>
                      <th style={{ padding: '12px' }}>Rank</th>
                      <th style={{ padding: '12px' }}>Candidate</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Votes</th>
                    </tr></thead>
                    <tbody>
                      {sortedByVotes.map((c, idx) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '12px', color: '#666', fontSize: '13px' }}>{c.position}</td>
                          <td style={{ padding: '12px', fontSize: '18px', fontWeight: 'bold', color: idx === 0 ? '#FFD700' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7f32' : '#003366' }}>{idx+1}</td>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>{c.name}</td>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>{c.votes || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => window.print()} style={{ ...btnPrimary, marginTop: '16px' }}>🖨️ Print</button>
              </>
            )}
          </div>
        )}

        {/* Form Purchase */}
        {activeView === 'form-purchase' && (
          <>
            <div style={cardStyle}>
              <h2 style={{ color: '#003366', marginBottom: '4px' }}>📋 Form Purchase Settings</h2>
              <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>Configure positions, prices, availability</p>
              {fpMsg && <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', background: fpMsg.includes('Error') ? '#fee2e2' : '#d1fae5', color: fpMsg.includes('Error') ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>{fpMsg}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div><label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Opening Date</label><input type="date" value={fpOpeningDate} onChange={e => setFpOpeningDate(e.target.value)} style={inputStyle} /></div>
                <div><label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Opening Time</label><input type="time" value={fpOpeningTime} onChange={e => setFpOpeningTime(e.target.value)} style={inputStyle} /></div>
                <div><label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Closing Date</label><input type="date" value={fpClosingDate} onChange={e => setFpClosingDate(e.target.value)} style={inputStyle} /></div>
                <div><label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Closing Time</label><input type="time" value={fpClosingTime} onChange={e => setFpClosingTime(e.target.value)} style={inputStyle} /></div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  <input type="checkbox" checked={fpIsActive} onChange={e => setFpIsActive(e.target.checked)} style={{ marginRight: '8px' }} />
                  Form Purchase Active
                </label>
              </div>
              <h3 style={{ color: '#003366', marginBottom: '12px' }}>Positions & Pricing</h3>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '2px' }}>Position</label>
                  <input value={fpNewPosition} onChange={e => setFpNewPosition(e.target.value)} placeholder="President" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '2px' }}>Amount (₦)</label>
                  <input type="number" value={fpNewAmount} onChange={e => setFpNewAmount(e.target.value)} placeholder="5000" style={inputStyle} />
                </div>
                <button onClick={handleFpAddPosition} style={{ ...btnPrimary, whiteSpace: 'nowrap', padding: '12px 20px' }}>➕ Add</button>
              </div>
              {fpPositions.length === 0 ? <p style={{ color: '#999', textAlign: 'center' }}>No positions added</p> : (
                <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#003366', color: 'white' }}>
                      <th style={{ padding: '10px' }}>#</th>
                      <th style={{ padding: '10px' }}>Position</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Taken</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Action</th>
                    </tr></thead>
                    <tbody>
                      {fpPositions.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px' }}>{i+1}</td>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.position}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>₦{Number(p.amount).toLocaleString()}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{ background: (fpCandidateCounts[p.position] || 0) >= 5 ? '#fee2e2' : '#d1fae5', color: (fpCandidateCounts[p.position] || 0) >= 5 ? '#dc2626' : '#16a34a', padding: '2px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>{(fpCandidateCounts[p.position] || 0)}/5</span>
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
                {fpSaving ? '⏳ Saving...' : '💾 Save Settings'}
              </button>
            </div>
            {formPurchases.length > 0 && (
              <div style={cardStyle}>
                <h3 style={{ color: '#003366', marginBottom: '12px' }}>Purchase History ({formPurchases.length})</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#003366', color: 'white' }}>
                      <th style={{ padding: '10px' }}>Name</th>
                      <th style={{ padding: '10px' }}>Position</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '10px' }}>Date</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                    </tr></thead>
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

        {/* Withdrawal */}
        {activeView === 'withdrawal' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={cardStyle}>
              <h2 style={{ color: '#003366', marginBottom: '16px' }}>💰 Withdraw Funds</h2>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '6px' }}>Balance</p>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#16a34a', margin: '0 0 20px 0' }}>₦{withdrawalBalance.toLocaleString()}</p>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: '#888', margin: '0 0 4px 0' }}>Beneficiary</p>
                <p style={{ fontWeight: 'bold', margin: 0 }}>{OPAY_ACCOUNT} (Opay)</p>
              </div>
              <input placeholder="Admin ID" value={withdrawAdminId} onChange={e => setWithdrawAdminId(e.target.value)} style={inputStyle} />
              <input type="password" placeholder="Withdrawal PIN" value={withdrawPin} onChange={e => setWithdrawPin(e.target.value)} style={inputStyle} />
              <input type="number" placeholder="Amount (₦)" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} style={inputStyle} />
              <button onClick={handleWithdraw} style={{ ...btnPrimary, width: '100%', padding: '14px', background: '#f59e0b', color: '#003366', fontSize: '16px' }}>💸 Withdraw</button>
              {withdrawMsg.text && (
                <div style={{ padding: '12px', borderRadius: '8px', marginTop: '16px', fontWeight: 'bold', background: withdrawMsg.type === 'error' ? '#fee2e2' : '#d1fae5', color: withdrawMsg.type === 'error' ? '#dc2626' : '#16a34a' }}>{withdrawMsg.text}</div>
              )}
            </div>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', marginBottom: '12px' }}>Quick Info</h3>
              <div style={{ padding: '14px', borderBottom: '1px solid #eee' }}>
                <span style={{ color: '#888', fontSize: '13px' }}>Admin ID</span>
                <p style={{ fontWeight: 'bold', margin: '4px 0 0', wordBreak: 'break-all' }}>{ADMIN_ID}</p>
              </div>
              <div style={{ padding: '14px', borderBottom: '1px solid #eee' }}>
                <span style={{ color: '#888', fontSize: '13px' }}>PIN</span>
                <p style={{ fontWeight: 'bold', margin: '4px 0 0' }}>****</p>
              </div>
              <div style={{ padding: '14px' }}>
                <span style={{ color: '#888', fontSize: '13px' }}>Candidates</span>
                <p style={{ fontWeight: 'bold', margin: '4px 0 0' }}>{candidates.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* =================== MESSAGES (MODIFIED: Gmail reply added) =================== */}
        {activeView === 'messages' && (
          <div style={cardStyle}>
            <h2 style={{ color: '#003366', marginBottom: '16px' }}>✉️ Messages ({supportMessages.length})</h2>
            {supportMessages.length === 0 ? <p style={{ color: '#999', textAlign: 'center' }}>No messages</p> : (
              supportMessages.map(msg => (
                <div key={msg.id} style={{
                  padding: '16px', borderBottom: '1px solid #eee',
                  background: msg.status === 'unread' ? '#f0f7ff' : 'transparent'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div>
                      <strong>{msg.name}</strong>
                      {msg.email && (
                        <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
                          &lt;{msg.email}&gt;
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      {msg.timestamp?.toDate?.()?.toLocaleString() || ''}
                      {msg.status === 'unread' && (
                        <span style={{ background: '#2563eb', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', marginLeft: '8px' }}>New</span>
                      )}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', color: '#666' }}>{msg.message}</p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {msg.status === 'unread' && (
                      <button
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'supportMessages', msg.id), { status: 'read' });
                            loadAllData();
                          } catch (e) {}
                        }}
                        style={{
                          padding: '4px 10px', background: 'transparent', color: '#2563eb',
                          border: '1px solid #2563eb', borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                        }}
                      >
                        Mark Read
                      </button>
                    )}
                    {msg.email && (
                      <a
                        href={`https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(msg.email)}&su=${encodeURIComponent('Re: NAMATL Student E-Voting Support')}&body=${encodeURIComponent(`Dear ${msg.name},\n\nThank you for reaching out to the NAMATL Electoral Commission.\n\nRegarding your message:\n"${msg.message}"\n\n`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '4px 10px', background: '#ea4335', color: 'white',
                          border: 'none', borderRadius: '6px', cursor: 'pointer',
                          fontSize: '12px', fontWeight: 'bold', textDecoration: 'none'
                        }}
                      >
                        📧 Reply via Gmail
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}