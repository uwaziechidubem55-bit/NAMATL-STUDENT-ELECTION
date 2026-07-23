import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import {
  collection, addDoc, getDocs, getDoc, doc, setDoc,
  deleteDoc, updateDoc, serverTimestamp, onSnapshot, query, orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useDataCharge } from '../context/DataChargeContext';

/* ===================================================================
   NAMATL STUDENT E-VOTING - ADMIN DASHBOARD
   Navy Blue background | 3-dots menu only | Clean print
   =================================================================== */

const COLORS = {
  navy: '#003366',
  navyDark: '#0a1628',
  navyMid: '#061D3A',
  navyCard: '#0f172a',
  navyBorder: '#1e293b',
  gold: '#FFD700',
  goldDark: '#e6a800',
  goldLight: 'rgba(255,215,0,0.12)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
};

const STYLES = {
  page: {
    minHeight: '100vh',
    background: '#003366',
    fontFamily: 'system-ui, sans-serif',
    color: COLORS.textPrimary,
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  },
  card: {
    background: COLORS.navyCard,
    borderRadius: '12px',
    padding: '20px',
    border: `1px solid ${COLORS.navyBorder}`,
    marginBottom: '16px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    background: COLORS.navyDark,
    color: COLORS.textPrimary,
    border: '1px solid #334155',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  label: {
    display: 'block',
    color: COLORS.textSecondary,
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  btnPrimary: {
    padding: '10px 20px',
    background: COLORS.gold,
    color: COLORS.navyDark,
    border: 'none',
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
  },
  btnDanger: {
    padding: '10px 20px',
    background: COLORS.danger,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '10px 20px',
    background: '#1e293b',
    color: COLORS.textPrimary,
    border: '1px solid #334155',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  },
  btnSmall: {
    padding: '6px 14px',
    fontSize: '12px',
    borderRadius: '6px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
};

const MENU_ITEMS = [
  { key: 'dashboard',     label: 'Dashboard',       icon: '📊' },
  { key: 'election',      label: 'Election Setting', icon: '⚙️' },
  { key: 'candidate',     label: 'Candidate',        icon: '👤' },
  { key: 'result',        label: 'Result',           icon: '📈' },
  { key: 'form-purchase', label: 'Form Purchase',    icon: '📋' },
  { key: 'withdrawal',    label: 'Withdrawal',       icon: '💰' },
  { key: 'activation',    label: 'Activation',       icon: '🔑' },
  { key: 'general',       label: 'General Setting',  icon: '🔧' },
  { key: 'support',       label: 'Support',          icon: '💬' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const dataCharge = useDataCharge();
  const {
    withdrawalBalance, withdraw, loadBalance,
    ADMIN_ID, WITHDRAWAL_PIN, OPAY_ACCOUNT,
    saveFormPurchaseSettings, formPurchaseSettings,
  } = dataCharge;

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');

  const [candidates, setCandidates] = useState([]);
  const [settings, setSettings] = useState({});
  const [supportMessages, setSupportMessages] = useState([]);
  const [voters, setVoters] = useState([]);
  const [loading, setLoading] = useState(true);

  // Election
  const [electionForm, setElectionForm] = useState({ title: '', year: '', description: '', startDate: '', startTime: '', endDate: '', endTime: '' });
  const [elections, setElections] = useState([]);
  const [editingElectionId, setEditingElectionId] = useState(null);
  const [electionMsg, setElectionMsg] = useState('');

  // Candidate
  const [candName, setCandName] = useState('');
  const [candPosition, setCandPosition] = useState('');
  const [candDept, setCandDept] = useState('');
  const [candManifesto, setCandManifesto] = useState('');
  const [candPhoto, setCandPhoto] = useState(null);
  const [candPhotoPreview, setCandPhotoPreview] = useState('');
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [candMsg, setCandMsg] = useState('');

  // Result
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateVoters, setCandidateVoters] = useState([]);

  // Form Purchase
  const [fpRows, setFpRows] = useState([{ position: '', amount: '' }]);
  const [fpSaved, setFpSaved] = useState(false);
  const [fpMsg, setFpMsg] = useState('');

  // Withdrawal
  const [withdrawPin, setWithdrawPin] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState('');

  // General
  const [generalSettings, setGeneralSettings] = useState({ maxCandidatesPerPosition: 5, theme: 'navy-gold', showResults: true, allowStudentRegistration: true });
  const [generalMsg, setGeneralMsg] = useState('');

  // Activation
  const [activationMode, setActivationMode] = useState('election');
  const [activationYear, setActivationYear] = useState('');
  const [activationStartDate, setActivationStartDate] = useState('');
  const [activationStartTime, setActivationStartTime] = useState('');
  const [activationEndDate, setActivationEndDate] = useState('');
  const [activationEndTime, setActivationEndTime] = useState('');
  const [activationToggle, setActivationToggle] = useState(false);
  const [formPurchaseToggle, setFormPurchaseToggle] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => { loadAllData(); loadBalance?.(); }, []);

  useEffect(() => {
    const q = query(collection(db, 'supportMessages'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = []; let unread = 0;
      snap.forEach((d) => { const data = { id: d.id, ...d.data() }; msgs.push(data); if (data.status === 'unread') unread++; });
      setSupportMessages(msgs); setUnreadCount(unread);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (formPurchaseSettings) {
      const positions = formPurchaseSettings.positions || [];
      if (positions.length > 0) setFpRows(positions.map(p => ({ position: p.position || '', amount: p.amount || '' })));
      setFormPurchaseToggle(formPurchaseSettings.isActive || false);
    }
  }, [formPurchaseSettings]);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'activation'));
        if (snap.exists()) {
          const d = snap.data();
          setActivationToggle(d.electionActive || false);
          setFormPurchaseToggle(d.formPurchaseActive || false);
          setActivationYear(d.year || '');
          setActivationStartDate(d.startDate || '');
          setActivationStartTime(d.startTime || '');
          setActivationEndDate(d.endDate || '');
          setActivationEndTime(d.endTime || '');
        }
      } catch (e) {}
    })();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const candSnap = await getDocs(collection(db, 'candidates'));
      const candList = []; candSnap.forEach((d) => candList.push({ id: d.id, ...d.data() })); setCandidates(candList);
      const settingsSnap = await getDoc(doc(db, 'settings', 'main'));
      if (settingsSnap.exists()) setSettings(settingsSnap.data());
      const elecSnap = await getDocs(collection(db, 'elections'));
      const elecList = []; elecSnap.forEach((d) => elecList.push({ id: d.id, ...d.data() })); setElections(elecList);
      const voterSnap = await getDocs(collection(db, 'voters'));
      const voterList = []; voterSnap.forEach((d) => voterList.push({ id: d.id, ...d.data() })); setVoters(voterList);
      const genSnap = await getDoc(doc(db, 'settings', 'general'));
      if (genSnap.exists()) setGeneralSettings(prev => ({ ...prev, ...genSnap.data() }));
    } catch (e) { console.error('Load error:', e); }
    setLoading(false);
  };

  const getMaxCandidates = () => generalSettings.maxCandidatesPerPosition || 5;
  const getCountInPosition = (position) => candidates.filter(c => c.position === position && c.id !== editingCandidate?.id).length;
  const isPositionFull = (position) => getCountInPosition(position) >= getMaxCandidates();
  const groupByPosition = (arr) => { const g = {}; arr.forEach((item) => { const pos = item.position || 'Unassigned'; if (!g[pos]) g[pos] = []; g[pos].push(item); }); return g; };

  // ─── Election ───
  const handleSaveElection = async () => {
    if (!electionForm.title || !electionForm.year) { setElectionMsg('Title and Year required'); return; }
    try {
      if (editingElectionId) { await updateDoc(doc(db, 'elections', editingElectionId), electionForm); setElectionMsg('Updated!'); }
      else { await addDoc(collection(db, 'elections'), { ...electionForm, createdAt: new Date().toISOString() }); setElectionMsg('Created!'); }
      const snap = await getDocs(collection(db, 'elections')); const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() })); setElections(list);
      setEditingElectionId(null); setElectionForm({ title: '', year: '', description: '', startDate: '', startTime: '', endDate: '', endTime: '' });
    } catch (e) { setElectionMsg('Error: ' + e.message); }
  };
  const handleEditElection = (e) => { setEditingElectionId(e.id); setElectionForm({ title: e.title||'', year: e.year||'', description: e.description||'', startDate: e.startDate||'', startTime: e.startTime||'', endDate: e.endDate||'', endTime: e.endTime||'' }); };
  const handleDeleteElection = async (id) => { if (!window.confirm('Delete permanently?')) return; try { await deleteDoc(doc(db, 'elections', id)); setElections(prev => prev.filter(e => e.id !== id)); setElectionMsg('Deleted!'); } catch (e) { setElectionMsg('Error: ' + e.message); } };

  // ─── Candidate ───
  const handlePhotoSelect = (e) => { const file = e.target.files[0]; if (file) { setCandPhoto(file); const r = new FileReader(); r.onload = (ev) => setCandPhotoPreview(ev.target.result); r.readAsDataURL(file); } };
  const handleAddCandidate = async () => {
    if (!candName || !candPosition) { setCandMsg('Name and Position required'); return; }
    const max = getMaxCandidates(); const count = getCountInPosition(candPosition);
    if (count >= max) { setCandMsg(`Max ${max} per position reached for "${candPosition}"`); return; }
    try {
      let photoUrl = editingCandidate?.photoUrl || '';
      if (candPhoto) { const sr = ref(storage, `candidates/${Date.now()}_${candPhoto.name}`); const snap = await uploadBytes(sr, candPhoto); photoUrl = await getDownloadURL(snap.ref); if (editingCandidate?.photoUrl?.startsWith('https://firebasestorage')) try { await deleteObject(ref(storage, editingCandidate.photoUrl)); } catch(e){} }
      const data = { name: candName, position: candPosition, dept: candDept||'N/A', manifesto: candManifesto||'', photoUrl, votes: editingCandidate?.votes||0, updatedAt: new Date().toISOString() };
      if (editingCandidate) { await updateDoc(doc(db, 'candidates', editingCandidate.id), data); setCandMsg('Updated!'); }
      else { data.createdAt = new Date().toISOString(); await addDoc(collection(db, 'candidates'), data); setCandMsg('Added!'); }
      setCandName(''); setCandPosition(''); setCandDept(''); setCandManifesto(''); setCandPhoto(null); setCandPhotoPreview(''); setEditingCandidate(null); loadAllData();
    } catch (e) { setCandMsg('Error: ' + e.message); }
  };
  const handleEditCandidate = (c) => { setEditingCandidate(c); setCandName(c.name); setCandPosition(c.position); setCandDept(c.dept||''); setCandManifesto(c.manifesto||''); setCandPhotoPreview(c.photoUrl||''); setCandPhoto(null); };
  const handleDeleteCandidate = async (id) => { if (!window.confirm('Delete candidate?')) return; try { const c = candidates.find(c => c.id === id); if (c?.photoUrl?.startsWith('https://firebasestorage')) try { await deleteObject(ref(storage, c.photoUrl)); } catch(e){} await deleteDoc(doc(db, 'candidates', id)); setCandidates(prev => prev.filter(c => c.id !== id)); setCandMsg('Deleted!'); } catch (e) { setCandMsg('Error: ' + e.message); } };

  // ─── Result ───
  const viewCandidateVoters = async (c) => { setSelectedCandidate(c); const all = []; const snap = await getDocs(collection(db, 'voters')); snap.forEach(d => { const data = d.data(); if (data.votedFor === c.name || data.votedFor === c.position) all.push({ id: d.id, ...data }); }); setCandidateVoters(all); };
  const handlePrintResults = () => window.print();

  // ─── Form Purchase ───
  const handleAddFpRow = () => setFpRows(prev => [...prev, { position: '', amount: '' }]);
  const handleFpRowChange = (i, f, v) => setFpRows(prev => { const u = [...prev]; u[i] = { ...u[i], [f]: v }; return u; });
  const handleDeleteFpRow = (i) => { if (fpRows.length <= 1) return; setFpRows(prev => prev.filter((_, idx) => idx !== i)); };
  const handleSaveFormPurchase = async () => { const valid = fpRows.filter(r => r.position.trim() && r.amount); if (!valid.length) { setFpMsg('Add at least one row'); return; } try { await setDoc(doc(db, 'settings', 'formPurchase'), { positions: valid.map(r => ({ position: r.position.trim(), amount: Number(r.amount) })), updatedAt: new Date().toISOString(), isActive: formPurchaseToggle }); setFpSaved(true); setFpMsg('Saved!'); if (saveFormPurchaseSettings) await saveFormPurchaseSettings(valid); } catch (e) { setFpMsg('Error: ' + e.message); } };

  // ─── Withdrawal ───
   const handleWithdraw = async () => {
    if (!withdrawPin || !withdrawAmount) { setWithdrawMsg('Fill all fields'); return; }
    const correctPin = WITHDRAWAL_PIN || '1966';
    if (withdrawPin !== correctPin) { setWithdrawMsg('Error: wrong admin pin'); return; }
    const amount = Number(withdrawAmount);
    if (isNaN(amount) || amount < 1000) { setWithdrawMsg('Min: ₦1,000'); return; }
    if (amount > (withdrawalBalance || 0)) { setWithdrawMsg('Insufficient balance'); return; }
    setWithdrawing(true); setWithdrawMsg('');
    try { const result = await withdraw(ADMIN_ID, withdrawPin.trim(), amount); setWithdrawMsg(result.message); if (result.success) { setWithdrawAmount(''); setWithdrawPin(''); } } catch (e) { setWithdrawMsg('Error: ' + e.message); }
    setWithdrawing(false);
};

  // ─── General ───
  const handleSaveGeneral = async () => { try { await setDoc(doc(db, 'settings', 'general'), generalSettings, { merge: true }); setGeneralMsg('Saved!'); } catch (e) { setGeneralMsg('Error: ' + e.message); } };

  // ─── Activation ───
  const handleActivation = async () => {
    if (!activationYear) { setActivationMsg('Enter academic year'); return; }
    setActivating(true);
    try {
      if (activationMode === 'election') {
        if (!candidates.length) { setActivationMsg('Add at least one candidate'); setActivating(false); return; }
        await setDoc(doc(db, 'settings', 'activation'), { electionActive: activationToggle, year: activationYear, startDate: activationStartDate, startTime: activationStartTime, endDate: activationEndDate, endTime: activationEndTime, updatedAt: new Date().toISOString() }, { merge: true });
        await setDoc(doc(db, 'settings', 'main'), { isActive: activationToggle, year: activationYear, startDate: activationStartDate, startTime: activationStartTime, endDate: activationEndDate, endTime: activationEndTime }, { merge: true });
        setActivationMsg(activationToggle ? '✅ Election is Active!' : '⏸️ Election paused.');
      } else {
        await setDoc(doc(db, 'settings', 'formPurchase'), { isActive: formPurchaseToggle, updatedAt: new Date().toISOString() }, { merge: true });
        await setDoc(doc(db, 'settings', 'activation'), { formPurchaseActive: formPurchaseToggle }, { merge: true });
        setActivationMsg(formPurchaseToggle ? '✅ Form Purchase Active!' : '⏸️ Form Purchase paused.');
      }
      loadAllData();
    } catch (e) { setActivationMsg('Error: ' + e.message); }
    setActivating(false);
  };

  const markAsRead = async (id) => { try { await updateDoc(doc(db, 'supportMessages', id), { status: 'read' }); } catch(e){} };

  if (loading) return (
    <div style={{ ...STYLES.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #334155', borderTop: '4px solid #FFD700', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: COLORS.gold }}>Loading Dashboard...</p>
      </div>
    </div>
  );

  return (
    <div style={STYLES.page}>
      <div style={STYLES.container}>
        {/* ===== TOP BAR: Logo + Title + 3-dots ===== */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 0', borderBottom: '1px solid rgba(255,215,0,0.15)', marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="NAMATL" style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #FFD700' }}
              onError={(e) => { e.target.style.display = 'none'; }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '16px', color: '#FFD700', fontWeight: 700, lineHeight: 1.2 }}>NAMATL STUDENT E-VOTING</h1>
              <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8' }}>Admin Dashboard</p>
            </div>
          </div>

          {/* 3-dots with circle */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(!menuOpen)} style={{
              width: '42px', height: '42px', borderRadius: '50%',
              border: '2px solid rgba(255,215,0,0.4)', background: menuOpen ? 'rgba(255,215,0,0.15)' : 'transparent',
              cursor: 'pointer', color: '#FFD700', fontSize: '22px', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s',
            }}
              onMouseEnter={(e) => { if (!menuOpen) e.target.style.background = 'rgba(255,215,0,0.08)'; }}
              onMouseLeave={(e) => { if (!menuOpen) e.target.style.background = 'transparent'; }}
            >⋮</button>

            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 19 }} />
                <div style={{
                  position: 'absolute', top: '50px', right: 0, zIndex: 20,
                  background: '#0f172a', border: '1px solid #334155',
                  borderRadius: '10px', minWidth: '190px', overflow: 'hidden',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                }}>
                  {MENU_ITEMS.map((item) => (
                    <button key={item.key} onClick={() => { setActiveView(item.key); setMenuOpen(false); }} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '13px 18px',
                      background: activeView === item.key ? 'rgba(255,215,0,0.1)' : 'transparent',
                      border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer', color: activeView === item.key ? '#FFD700' : '#f1f5f9',
                      fontSize: '14px', fontWeight: activeView === item.key ? 700 : 500,
                      textAlign: 'left', transition: 'all 0.2s',
                    }}
                      onMouseEnter={(e) => { e.target.style.background = 'rgba(255,215,0,0.08)'; e.target.style.paddingLeft = '24px'; }}
                      onMouseLeave={(e) => { e.target.style.background = activeView === item.key ? 'rgba(255,215,0,0.1)' : 'transparent'; e.target.style.paddingLeft = '18px'; }}
                    >
                      <span>{item.icon}</span> <span>{item.label}</span>
                    </button>
                  ))}
                  <button onClick={() => { setMenuOpen(false); navigate('/admin-login'); }} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '12px',
                    background: 'transparent', border: 'none', borderTop: '1px solid rgba(239,68,68,0.2)',
                    cursor: 'pointer', color: '#ef4444', fontSize: '13px', fontWeight: 600,
                    transition: 'all 0.2s',
                  }}
                    onMouseEnter={(e) => { e.target.style.background = 'rgba(239,68,68,0.08)'; }}
                    onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
                  >Logout</button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ======================================================================== */}
        {/* DASHBOARD */}
        {/* ======================================================================== */}
        {activeView === 'dashboard' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ ...STYLES.card, textAlign: 'center', padding: '30px 20px', marginBottom: '24px' }}>
              <img src="/logo.png" alt="NAMATL" style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', marginBottom: '12px', border: '3px solid #FFD700' }}
                onError={(e) => { e.target.style.display = 'none'; }} />
              <h2 style={{ margin: '0 0 4px', color: '#FFD700', fontSize: '24px', fontWeight: 700 }}>Welcome BROUTE</h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Admin ID: {ADMIN_ID || 'Admin@Namatls128756BC'}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div style={{ ...STYLES.card, textAlign: 'center', padding: '24px 16px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>👤</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFD700' }}>{candidates.length}</div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Total Candidates</div>
              </div>
              <div style={{ ...STYLES.card, textAlign: 'center', padding: '24px 16px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🗳️</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFD700' }}>{voters.length}</div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Votes Cast</div>
              </div>
              <div style={{ ...STYLES.card, textAlign: 'center', padding: '24px 16px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFD700' }}>{Object.keys(groupByPosition(candidates)).length}</div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Positions</div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* ELECTION SETTING */}
        {/* ======================================================================== */}
        {activeView === 'election' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: '#FFD700', marginBottom: '16px', fontSize: '20px' }}>⚙️ Election Settings</h2>
            {electionMsg && <div style={{ ...STYLES.card, padding: '12px', background: electionMsg.includes('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', borderColor: electionMsg.includes('Error') ? '#ef4444' : '#22c55e' }}>{typeof electionMsg === 'object' ? electionMsg.text : electionMsg}</div>}
            <div style={STYLES.card}>
              <h3 style={{ color: '#FFD700', marginBottom: '12px', fontSize: '16px' }}>{editingElectionId ? '✏️ Edit' : '➕ Create'} Election</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={STYLES.label}>Title</label><input style={STYLES.input} value={electionForm.title} onChange={e => setElectionForm({...electionForm, title: e.target.value})} /></div>
                <div><label style={STYLES.label}>Year</label><input style={STYLES.input} value={electionForm.year} onChange={e => setElectionForm({...electionForm, year: e.target.value})} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={STYLES.label}>Description</label><textarea style={{...STYLES.input, minHeight: '60px'}} value={electionForm.description} onChange={e => setElectionForm({...electionForm, description: e.target.value})} /></div>
                <div><label style={STYLES.label}>Start</label><input type="date" style={STYLES.input} value={electionForm.startDate} onChange={e => setElectionForm({...electionForm, startDate: e.target.value})} /></div>
                <div><label style={STYLES.label}>Time</label><input type="time" style={STYLES.input} value={electionForm.startTime} onChange={e => setElectionForm({...electionForm, startTime: e.target.value})} /></div>
                <div><label style={STYLES.label}>End</label><input type="date" style={STYLES.input} value={electionForm.endDate} onChange={e => setElectionForm({...electionForm, endDate: e.target.value})} /></div>
                <div><label style={STYLES.label}>Time</label><input type="time" style={STYLES.input} value={electionForm.endTime} onChange={e => setElectionForm({...electionForm, endTime: e.target.value})} /></div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button style={STYLES.btnPrimary} onClick={handleSaveElection}>{editingElectionId ? '✏️ Update' : '💾 Save'}</button>
                {editingElectionId && <button style={STYLES.btnSecondary} onClick={() => { setEditingElectionId(null); setElectionForm({title:'',year:'',description:'',startDate:'',startTime:'',endDate:'',endTime:''}); }}>Cancel</button>}
              </div>
            </div>
            <div style={STYLES.card}>
              <h3 style={{ color: '#FFD700', marginBottom: '12px', fontSize: '16px' }}>📋 Saved ({elections.length})</h3>
              {elections.length === 0 ? <p style={{color:'#94a3b8',textAlign:'center',padding:'20px'}}>No elections.</p> : (
                <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:'14px'}}>
                  <thead><tr style={{borderBottom:'2px solid #334155'}}><th style={{padding:'10px 8px',textAlign:'left',color:'#94a3b8'}}>Title</th><th style={{padding:'10px 8px',textAlign:'left',color:'#94a3b8'}}>Year</th><th style={{padding:'10px 8px',textAlign:'center',color:'#94a3b8'}}>Actions</th></tr></thead>
                  <tbody>{elections.map(e => (
                    <tr key={e.id} style={{borderBottom:'1px solid #1e293b'}}>
                      <td style={{padding:'10px 8px'}}>{e.title}</td>
                      <td style={{padding:'10px 8px',color:'#FFD700'}}>{e.year}</td>
                      <td style={{padding:'10px 8px',textAlign:'center'}}>
                        <div style={{display:'flex',gap:'6px',justifyContent:'center'}}>
                          <button style={{...STYLES.btnSmall,background:'#FFD700',color:'#061D3A'}} onClick={() => handleEditElection(e)}>✏️ Edit</button>
                          <button style={{...STYLES.btnSmall,background:'#ef4444',color:'white'}} onClick={() => handleDeleteElection(e.id)}>🗑️ Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* CANDIDATE */}
        {/* ======================================================================== */}
        {activeView === 'candidate' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: '#FFD700', marginBottom: '16px', fontSize: '20px' }}>👤 Candidate Management</h2>
            {candMsg && <div style={{...STYLES.card,padding:'12px',background: candMsg.includes('Error')||candMsg.includes('Max')?'rgba(239,68,68,0.1)':'rgba(34,197,94,0.1)',borderColor:candMsg.includes('Error')||candMsg.includes('Max')?'#ef4444':'#22c55e'}}>{typeof candMsg === 'object' ? candMsg.text : candMsg}</div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
              <div style={STYLES.card}>
                <h3 style={{color:'#FFD700',marginBottom:'8px',fontSize:'16px'}}>{editingCandidate?'✏️ Edit':'➕ Add'} Candidate</h3>
                <p style={{color: isPositionFull(candPosition)?'#ef4444':'#94a3b8',fontSize:'12px',marginBottom:'12px'}}>Max {getMaxCandidates()} per position{candPosition?` • ${getCountInPosition(candPosition)}/${getMaxCandidates()} used`:''}</p>
                <div><label style={STYLES.label}>Name</label><input style={STYLES.input} value={candName} onChange={e=>setCandName(e.target.value)} /></div>
                <div style={{marginTop:'10px'}}><label style={STYLES.label}>Position</label><input style={STYLES.input} value={candPosition} onChange={e=>setCandPosition(e.target.value)} /></div>
                <div style={{marginTop:'10px'}}><label style={STYLES.label}>Dept</label><input style={STYLES.input} value={candDept} onChange={e=>setCandDept(e.target.value)} /></div>
                <div style={{marginTop:'10px'}}><label style={STYLES.label}>Manifesto</label><textarea style={{...STYLES.input,minHeight:'80px'}} value={candManifesto} onChange={e=>setCandManifesto(e.target.value)} /></div>
                <div style={{marginTop:'10px'}}><label style={STYLES.label}>Photo</label><input type="file" accept="image/*" onChange={handlePhotoSelect} style={{...STYLES.input,padding:'8px'}} />{candPhotoPreview&&<img src={candPhotoPreview} alt="" style={{width:'80px',height:'80px',borderRadius:'50%',objectFit:'cover',marginTop:'8px'}} />}</div>
                <div style={{display:'flex',gap:'10px',marginTop:'16px'}}>
                  <button style={{...STYLES.btnPrimary,opacity:isPositionFull(candPosition)&&!editingCandidate?0.5:1}} onClick={handleAddCandidate} disabled={isPositionFull(candPosition)&&!editingCandidate}>{editingCandidate?'✏️ Update':'➕ Add'}</button>
                  {editingCandidate&&<button style={STYLES.btnSecondary} onClick={()=>{setEditingCandidate(null);setCandName('');setCandPosition('');setCandDept('');setCandManifesto('');setCandPhoto(null);setCandPhotoPreview('');}}>Cancel</button>}
                </div>
              </div>
              <div style={STYLES.card}>
                <h3 style={{color:'#FFD700',marginBottom:'12px',fontSize:'16px'}}>📋 All ({candidates.length})</h3>
                <div style={{maxHeight:'500px',overflowY:'auto'}}>{candidates.length===0?<p style={{color:'#94a3b8',textAlign:'center',padding:'20px'}}>No candidates.</p>:Object.entries(groupByPosition(candidates)).map(([pos,cands])=>{const full=cands.length>=getMaxCandidates();return(<div key={pos} style={{marginBottom:'16px'}}><h4 style={{color:full?'#FFD700':'#94a3b8',fontSize:'13px',fontWeight:600,borderBottom:`1px solid ${full?'rgba(255,215,0,0.3)':'#334155'}`,paddingBottom:'6px',marginBottom:'8px',display:'flex',justifyContent:'space-between'}}><span>{pos}</span><span style={{fontSize:'11px'}}>{cands.length}/{getMaxCandidates()}{full?' ✅':''}</span></h4>{cands.map(c=>(<div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'#0a1628',borderRadius:'8px',marginBottom:'6px',border:'1px solid #1e293b'}}><div style={{display:'flex',alignItems:'center',gap:'10px'}}>{c.photoUrl?<img src={c.photoUrl} alt="" style={{width:'36px',height:'36px',borderRadius:'50%',objectFit:'cover'}}/>:<div style={{width:'36px',height:'36px',borderRadius:'50%',background:'#334155',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px'}}>👤</div>}<div><p style={{margin:0,fontSize:'14px',fontWeight:600}}>{c.name}</p><p style={{margin:0,fontSize:'11px',color:'#94a3b8'}}>{c.dept||'N/A'} • {c.votes||0} votes</p></div></div><div style={{display:'flex',gap:'4px'}}><button style={{...STYLES.btnSmall,background:'rgba(255,215,0,0.15)',color:'#FFD700'}} onClick={()=>handleEditCandidate(c)}>✏️</button><button style={{...STYLES.btnSmall,background:'rgba(239,68,68,0.15)',color:'#ef4444'}} onClick={()=>handleDeleteCandidate(c.id)}>🗑️</button></div></div>))}</div>)})}</div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* RESULT - CLEAN PRINT (logo + name centered only) */}
        {/* ======================================================================== */}
        {activeView === 'result' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }} className="no-print">
              <h2 style={{ color: '#FFD700', margin: 0, fontSize: '20px' }}>📈 Election Results</h2>
              <button style={STYLES.btnPrimary} onClick={handlePrintResults}>🖨️ Print Results</button>
            </div>
            <div id="result-print-area">
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img src="/logo.png" alt="NAMATL Logo" style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #FFD700' }}
                  onError={(e) => { e.target.style.display = 'none'; }} />
                <h1 style={{ color: '#FFD700', margin: '10px 0 4px', fontSize: '24px' }}>NAMATL STUDENT E-VOTING</h1>
                <hr style={{ borderColor: 'rgba(255,215,0,0.3)', margin: '16px auto', maxWidth: '300px' }} />
              </div>
              {selectedCandidate?(
                <div style={STYLES.card}>
                  <button className="no-print" style={{...STYLES.btnSmall,background:'rgba(255,215,0,0.15)',color:'#FFD700',marginBottom:'12px'}} onClick={()=>setSelectedCandidate(null)}>← Back</button>
                  <div style={{textAlign:'center',marginBottom:'16px'}}>
                    {selectedCandidate.photoUrl&&<img src={selectedCandidate.photoUrl} alt="" style={{width:'80px',height:'80px',borderRadius:'50%',objectFit:'cover',marginBottom:'8px'}}/>}
                    <h3 style={{color:'#FFD700',margin:'0 0 4px'}}>{selectedCandidate.name}</h3>
                    <p style={{color:'#94a3b8',margin:0,fontSize:'13px'}}>{selectedCandidate.position} • {selectedCandidate.dept}</p>
                    <p style={{color:'#FFD700',fontWeight:700,fontSize:'18px',margin:'8px 0 0'}}>{candidateVoters.length} vote{candidateVoters.length!==1?'s':''}</p>
                  </div>
                  {candidateVoters.length>0?<table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}><thead><tr style={{borderBottom:'2px solid #334155'}}><th style={{padding:'8px',textAlign:'left',color:'#94a3b8'}}>Student</th><th style={{padding:'8px',textAlign:'left',color:'#94a3b8'}}>Dept</th><th style={{padding:'8px',textAlign:'left',color:'#94a3b8'}}>Level</th><th style={{padding:'8px',textAlign:'left',color:'#94a3b8'}}>Time</th></tr></thead><tbody>{candidateVoters.map((v,i)=>(<tr key={i} style={{borderBottom:'1px solid #1e293b'}}><td style={{padding:'8px'}}>{v.fullName||'Anonymous'}</td><td style={{padding:'8px',color:'#94a3b8'}}>{v.department||'-'}</td><td style={{padding:'8px',color:'#94a3b8'}}>{v.level||'-'}</td><td style={{padding:'8px',color:'#94a3b8'}}>{v.timestamp?.toDate?.()?.toLocaleString()||'Just now'}</td></tr>))}</tbody></table>:<p style={{textAlign:'center',color:'#94a3b8'}}>No votes recorded.</p>}
                </div>
              ):Object.entries(groupByPosition(candidates)).map(([pos,cands])=>{const total=cands.reduce((s,c)=>s+(c.votes||0),0);return(
                <div key={pos} style={STYLES.card}>
                  <h3 style={{color:'#FFD700',marginBottom:'12px',fontSize:'16px'}}>{pos} — {total} votes</h3>
                  {cands.map(c=>{const v=c.votes||0;const pct=total>0?(v/total*100):0;return(
                    <div key={c.id} onClick={()=>viewCandidateVoters(c)} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'#0a1628',borderRadius:'8px',marginBottom:'8px',border:'1px solid #334155',cursor:'pointer'}}
                      onMouseEnter={e=>{e.target.style.borderColor='rgba(255,215,0,0.3)';e.target.style.background='#1a2332'}}
                      onMouseLeave={e=>{e.target.style.borderColor='#334155';e.target.style.background='#0a1628'}}>
                      {c.photoUrl?<img src={c.photoUrl} alt="" style={{width:'44px',height:'44px',borderRadius:'50%',objectFit:'cover'}}/>:<div style={{width:'44px',height:'44px',borderRadius:'50%',background:'#334155',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px'}}>👤</div>}
                      <div style={{flex:1}}><p style={{margin:0,fontWeight:600,fontSize:'14px'}}>{c.name}</p><p style={{margin:0,fontSize:'12px',color:'#94a3b8'}}>{c.dept||'N/A'}</p></div>
                      <div style={{textAlign:'right'}}><div style={{fontSize:'18px',fontWeight:700,color:'#FFD700'}}>{v}</div><div style={{...STYLES.badge,background:pct>=50?'rgba(34,197,94,0.15)':'rgba(255,215,0,0.1)',color:pct>=50?'#22c55e':'#FFD700'}}>{pct.toFixed(0)}%</div></div>
                    </div>
                  )})}
                </div>
              )})}
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* FORM PURCHASE */}
        {/* ======================================================================== */}
        {activeView === 'form-purchase' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: '#FFD700', marginBottom: '16px', fontSize: '20px' }}>📋 Form Purchase Settings</h2>
            {fpMsg&&<div style={{...STYLES.card,padding:'12px',background:fpMsg.includes('Error')?'rgba(239,68,68,0.1)':'rgba(34,197,94,0.1)',borderColor:fpMsg.includes('Error')?'#ef4444':'#22c55e'}}>{typeof fpMsg==='object'?fpMsg.text:fpMsg}</div>}
            <div style={STYLES.card}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
                <h3 style={{color:'#FFD700',margin:0,fontSize:'16px'}}>Positions & Pricing</h3>
                <button style={{...STYLES.btnSmall,background:'rgba(255,215,0,0.15)',color:'#FFD700'}} onClick={handleAddFpRow}>+ Add Row</button>
              </div>
              {fpRows.map((row,i)=>(<div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:'10px',marginBottom:'10px',alignItems:'end'}}>
                <div><label style={STYLES.label}>Position</label><input style={STYLES.input} value={row.position} onChange={e=>handleFpRowChange(i,'position',e.target.value)}/></div>
                <div><label style={STYLES.label}>Amount (₦)</label><input type="number" style={STYLES.input} value={row.amount} onChange={e=>handleFpRowChange(i,'amount',e.target.value)}/></div>
                <button style={{...STYLES.btnSmall,background:'rgba(239,68,68,0.15)',color:'#ef4444',padding:'12px 14px',alignSelf:'end'}} onClick={()=>handleDeleteFpRow(i)} disabled={fpRows.length<=1}>🗑️</button>
              </div>))}
              <button style={{...STYLES.btnPrimary,marginTop:'12px'}} onClick={handleSaveFormPurchase}>💾 Save</button>
              {fpSaved&&<p style={{color:'#22c55e',fontSize:'13px',marginTop:'8px'}}>✅ Saved! Use Activation to go live.</p>}
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* WITHDRAWAL */}
        {/* ======================================================================== */}
        {activeView === 'withdrawal' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: '#FFD700', marginBottom: '16px', fontSize: '20px' }}>💰 Withdraw Funds</h2>
            <div style={{...STYLES.card,textAlign:'center',padding:'24px',background:'linear-gradient(135deg,#0a1628 0%,#003366 100%)',border:'2px solid rgba(255,215,0,0.3)'}}>
              <p style={{color:'#94a3b8',fontSize:'13px',margin:'0 0 4px'}}>Available Balance</p>
              <div style={{fontSize:'36px',fontWeight:700,color:'#FFD700'}}>₦{(withdrawalBalance||0).toLocaleString()}</div>
            </div>
            <div style={STYLES.card}>
              {withdrawMsg&&<div style={{padding:'12px',marginBottom:'16px',borderRadius:'8px',background:withdrawMsg.includes('CONFIRMED')||withdrawMsg.includes('sent')?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',border:`1px solid ${withdrawMsg.includes('CONFIRMED')||withdrawMsg.includes('sent')?'#22c55e':'#ef4444'}`,color:withdrawMsg.includes('CONFIRMED')||withdrawMsg.includes('sent')?'#22c55e':'#fca5a5',fontSize:'14px'}}>{withdrawMsg}</div>}
              <div><label style={STYLES.label}>Admin ID</label><input style={STYLES.input} value={withdrawAdminId} onChange={e=>setWithdrawAdminId(e.target.value)}/></div>
              <div style={{marginTop:'12px'}}><label style={STYLES.label}>PIN</label><input type="password" style={STYLES.input} value={withdrawPin} onChange={e=>setWithdrawPin(e.target.value)}/></div>
              <div style={{marginTop:'12px'}}><label style={STYLES.label}>Amount (₦)</label><input type="number" style={STYLES.input} value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)}/></div>
              <div style={{marginTop:'16px',padding:'12px',borderRadius:'8px',background:'rgba(255,215,0,0.06)',border:'1px solid rgba(255,215,0,0.15)',fontSize:'13px',color:'#94a3b8'}}>Sent to Opay <strong style={{color:'#FFD700'}}>{OPAY_ACCOUNT||'9167557038'}</strong></div>
              <button style={{...STYLES.btnPrimary,marginTop:'16px',width:'100%',padding:'14px',fontSize:'16px',opacity:withdrawing?0.7:1}} onClick={handleWithdraw} disabled={withdrawing}>{withdrawing?'⏳ Processing...':'💰 Withdraw Now'}</button>
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* GENERAL SETTING */}
        {/* ======================================================================== */}
        {activeView === 'general' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: '#FFD700', marginBottom: '16px', fontSize: '20px' }}>🔧 General Settings</h2>
            {generalMsg&&<div style={{...STYLES.card,padding:'12px',background:'rgba(34,197,94,0.1)',borderColor:'#22c55e'}}>{typeof generalMsg==='object'?generalMsg.text:generalMsg}</div>}
            <div style={STYLES.card}>
              <div style={{marginBottom:'16px'}}><label style={STYLES.label}>Site Name</label><div style={{...STYLES.input,opacity:0.6,cursor:'not-allowed',background:'#1a1f2e'}}>NAMATL STUDENT E-VOTING</div><p style={{fontSize:'11px',color:'#94a3b8',marginTop:'4px'}}>Fixed — cannot be changed.</p></div>
              <div style={{marginBottom:'16px'}}><label style={STYLES.label}>Max Candidates Per Position</label><input type="number" min="1" max="20" style={STYLES.input} value={generalSettings.maxCandidatesPerPosition} onChange={e=>setGeneralSettings({...generalSettings,maxCandidatesPerPosition:Math.max(1,Number(e.target.value))})}/><p style={{fontSize:'11px',color:'#94a3b8',marginTop:'4px'}}>Default: 5. Currently: <strong style={{color:'#FFD700'}}>{generalSettings.maxCandidatesPerPosition}</strong></p></div>
              <div style={{marginBottom:'16px'}}><label style={STYLES.label}>Theme</label><div style={{...STYLES.select,opacity:0.6,cursor:'not-allowed',background:'#1a1f2e'}}>Navy Blue + Gold</div><p style={{fontSize:'11px',color:'#94a3b8',marginTop:'4px'}}>Fixed.</p></div>
              <div style={{marginBottom:'12px',display:'flex',alignItems:'center',gap:'12px'}}><label style={{...STYLES.label,margin:0}}>Show Results</label><input type="checkbox" checked={generalSettings.showResults} onChange={e=>setGeneralSettings({...generalSettings,showResults:e.target.checked})} style={{width:'20px',height:'20px',accentColor:'#FFD700'}}/></div>
              <button style={STYLES.btnPrimary} onClick={handleSaveGeneral}>💾 Save</button>
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* ACTIVATION */}
        {/* ======================================================================== */}
        {activeView === 'activation' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: '#FFD700', marginBottom: '16px', fontSize: '20px' }}>🔑 Activation Control</h2>
            {activationMsg&&<div style={{...STYLES.card,padding:'12px',background:activationMsg.includes('✅')?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',borderColor:activationMsg.includes('✅')?'#22c55e':'#ef4444',color:activationMsg.includes('✅')?'#22c55e':'#fca5a5'}}>{activationMsg}</div>}
            <div style={STYLES.card}>
              <h3 style={{color:'#FFD700',marginBottom:'12px',fontSize:'16px'}}>Select Mode</h3>
              <div style={{display:'flex',gap:'12px'}}>
                <button onClick={()=>setActivationMode('election')} style={{flex:1,padding:'14px',borderRadius:'8px',cursor:'pointer',border:activationMode==='election'?'2px solid #FFD700':'2px solid #334155',background:activationMode==='election'?'rgba(255,215,0,0.12)':'transparent',color:activationMode==='election'?'#FFD700':'#94a3b8',fontWeight:700,fontSize:'14px'}}>🗳️ Election</button>
                <button onClick={()=>setActivationMode('form-purchase')} style={{flex:1,padding:'14px',borderRadius:'8px',cursor:'pointer',border:activationMode==='form-purchase'?'2px solid #FFD700':'2px solid #334155',background:activationMode==='form-purchase'?'rgba(255,215,0,0.12)':'transparent',color:activationMode==='form-purchase'?'#FFD700':'#94a3b8',fontWeight:700,fontSize:'14px'}}>📋 Form Purchase</button>
              </div>
            </div>
            {activationMode==='election'&&(<>
              <div style={STYLES.card}><h3 style={{color:'#FFD700',marginBottom:'12px',fontSize:'16px'}}>Prerequisites</h3>
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}><span style={{color:candidates.length>0?'#22c55e':'#ef4444',fontSize:'18px'}}>{candidates.length>0?'✅':'❌'}</span><span>{candidates.length>0?`${candidates.length} candidate(s) ready`:'No candidates'}</span></div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}><span style={{color:settings.year?'#22c55e':'#ef4444',fontSize:'18px'}}>{settings.year?'✅':'❌'}</span><span>{settings.year?`Year: ${settings.year}`:'No year set'}</span></div>
                </div>
              </div>
              <div style={STYLES.card}>
                <h3 style={{color:'#FFD700',marginBottom:'12px',fontSize:'16px'}}>Configuration</h3>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                  <div><label style={STYLES.label}>Year</label><input style={STYLES.input} value={activationYear} onChange={e=>setActivationYear(e.target.value)}/>{activationYear==='2026/2027'&&<p style={{color:'#22c55e',fontSize:'12px',marginTop:'4px'}}>🎉 FREE activation!</p>}</div>
                  <div><label style={STYLES.label}>Start Date</label><input type="date" style={STYLES.input} value={activationStartDate} onChange={e=>setActivationStartDate(e.target.value)}/></div>
                  <div><label style={STYLES.label}>Start Time</label><input type="time" style={STYLES.input} value={activationStartTime} onChange={e=>setActivationStartTime(e.target.value)}/></div>
                  <div><label style={STYLES.label}>End Date</label><input type="date" style={STYLES.input} value={activationEndDate} onChange={e=>setActivationEndDate(e.target.value)}/></div>
                  <div><label style={STYLES.label}>End Time</label><input type="time" style={STYLES.input} value={activationEndTime} onChange={e=>setActivationEndTime(e.target.value)}/></div>
                </div>
                <div style={{marginTop:'16px',display:'flex',alignItems:'center',gap:'12px'}}>
                  <label style={{...STYLES.label,margin:0,textTransform:'none'}}>Status</label>
                  <div onClick={()=>setActivationToggle(!activationToggle)} style={{width:'48px',height:'26px',borderRadius:'13px',background:activationToggle?'#22c55e':'#475569',cursor:'pointer',position:'relative',transition:'background 0.3s',flexShrink:0}}><div style={{width:'22px',height:'22px',borderRadius:'50%',background:'white',position:'absolute',top:'2px',left:activationToggle?'24px':'2px',transition:'left 0.3s',boxShadow:'0 2px 4px rgba(0,0,0,0.3)'}}/></div>
                  <span style={{fontSize:'14px',fontWeight:700,color:activationToggle?'#22c55e':'#94a3b8'}}>{activationToggle?'ACTIVE':'INACTIVE'}</span>
                </div>
                <button style={{...STYLES.btnPrimary,marginTop:'16px'}} onClick={handleActivation} disabled={activating}>{activating?'⏳...':activationToggle?'🔓 Activate':'💾 Save'}</button>
              </div>
            </>)}
            {activationMode==='form-purchase'&&(
              <div style={STYLES.card}>
                <h3 style={{color:'#FFD700',marginBottom:'12px',fontSize:'16px'}}>Form Purchase Activation</h3>
                <p style={{color:'#94a3b8',fontSize:'14px',marginBottom:'16px'}}>Toggle form purchase on/off.</p>
                <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px'}}>
                  <label style={{...STYLES.label,margin:0,textTransform:'none'}}>Status</label>
                  <div onClick={()=>setFormPurchaseToggle(!formPurchaseToggle)} style={{width:'48px',height:'26px',borderRadius:'13px',background:formPurchaseToggle?'#22c55e':'#475569',cursor:'pointer',position:'relative',transition:'background 0.3s',flexShrink:0}}><div style={{width:'22px',height:'22px',borderRadius:'50%',background:'white',position:'absolute',top:'2px',left:formPurchaseToggle?'24px':'2px',transition:'left 0.3s',boxShadow:'0 2px 4px rgba(0,0,0,0.3)'}}/></div>
                  <span style={{fontSize:'14px',fontWeight:700,color:formPurchaseToggle?'#22c55e':'#94a3b8'}}>{formPurchaseToggle?'ACTIVE':'INACTIVE'}</span>
                </div>
                <button style={STYLES.btnPrimary} onClick={handleActivation} disabled={activating}>{activating?'⏳...':formPurchaseToggle?'✅ Activate':'⏸️ Pause'}</button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================================== */}
        {/* SUPPORT */}
        {/* ======================================================================== */}
        {activeView === 'support' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: '#FFD700', marginBottom: '16px', fontSize: '20px' }}>💬 Support Messages{unreadCount>0&&<span style={{...STYLES.badge,background:'#ef4444',color:'white',marginLeft:'8px',fontSize:'11px'}}>{unreadCount} new</span>}</h2>
            {supportMessages.length===0?<div style={{...STYLES.card,textAlign:'center',padding:'40px'}}><div style={{fontSize:'48px',marginBottom:'12px'}}>📭</div><h3 style={{color:'#94a3b8',margin:0}}>No messages</h3></div>:<div style={STYLES.card}>{supportMessages.map(msg=>(<div key={msg.id} onClick={()=>markAsRead(msg.id)} style={{padding:'16px',borderBottom:'1px solid #1e293b',cursor:'pointer',background:msg.status==='unread'?'rgba(255,215,0,0.04)':'transparent'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}><strong>{msg.name||'Anonymous'}</strong><span style={{color:'#94a3b8',fontSize:'12px'}}>{msg.timestamp?.toDate?.()?.toLocaleString()||'Just now'}</span></div>{msg.email&&msg.email!=='Not provided'&&<p style={{margin:'0 0 4px',fontSize:'12px',color:'#FFD700'}}>📧 {msg.email}</p>}<p style={{margin:0,fontSize:'14px',color:'#94a3b8'}}>{msg.message}</p>{msg.status==='unread'&&<span style={{...STYLES.badge,background:'#22c55e',color:'white',marginTop:'8px',display:'inline-block'}}>NEW</span>}</div>))}</div>}
          </div>
        )}

        {/* ===== FOOTER ===== */}
        <div style={{ textAlign: 'center', padding: '20px 0', marginTop: '20px', borderTop: '1px solid rgba(255,215,0,0.1)', color: '#94a3b8', fontSize: '12px' }}>
          NAMATL STUDENT E-VOTING © {new Date().getFullYear()} — Admin Dashboard
        </div>
      </div>
    </div>
  );
}