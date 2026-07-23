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
   Complete rebuild with all features working end-to-end.
   Theme: Navy Blue (#003366, #0a1628, #061D3A) + Gold (#FFD700)
   =================================================================== */

// ─── Design Tokens ──────────────────────────────────────────
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
    background: `linear-gradient(135deg, ${COLORS.navyDark} 0%, ${COLORS.navyMid} 50%, ${COLORS.navy} 100%)`,
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
    border: `1px solid #334155`,
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    background: COLORS.navyDark,
    color: COLORS.textPrimary,
    border: `1px solid #334155`,
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
    transition: 'all 0.3s',
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
    transition: 'all 0.3s',
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
    transition: 'all 0.3s',
  },
  btnSmall: {
    padding: '6px 14px',
    fontSize: '12px',
    borderRadius: '6px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s',
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

// ─── Menu Config ────────────────────────────────────────────
const MENU_ITEMS = [
  { key: 'dashboard',     label: 'Dashboard',       icon: '📊', color: '#003366' },
  { key: 'election',      label: 'Election Setting', icon: '⚙️', color: '#004080' },
  { key: 'candidate',     label: 'Candidate',        icon: '👤', color: '#00509e' },
  { key: 'result',        label: 'Result',           icon: '📈', color: '#0066b3' },
  { key: 'form-purchase', label: 'Form Purchase',    icon: '📋', color: '#0077cc' },
  { key: 'withdrawal',    label: 'Withdrawal',       icon: '💰', color: '#0088e6' },
  { key: 'activation',    label: 'Activation',       icon: '🔑', color: '#0099ff' },
  { key: 'general',       label: 'General Setting',  icon: '🔧', color: '#1a8cff' },
  { key: 'support',       label: 'Support',          icon: '💬', color: '#3388ff' },
];

/* ===================================================================
   MAIN COMPONENT
   =================================================================== */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const dataCharge = useDataCharge();
  const {
    withdrawalBalance, withdraw, loadBalance,
    ADMIN_ID, WITHDRAWAL_PIN, OPAY_ACCOUNT,
    saveFormPurchaseSettings, formPurchaseSettings,
  } = dataCharge;

  // ─── Navigation ───
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');

  // ─── Data States ───
  const [candidates, setCandidates] = useState([]);
  const [settings, setSettings] = useState({});
  const [supportMessages, setSupportMessages] = useState([]);
  const [voters, setVoters] = useState([]);
  const [loading, setLoading] = useState(true);

  // ─── Election Setting ───
  const [electionForm, setElectionForm] = useState({
    title: '', year: '', description: '',
    startDate: '', startTime: '', endDate: '', endTime: '',
  });
  const [elections, setElections] = useState([]);
  const [editingElectionId, setEditingElectionId] = useState(null);
  const [electionMsg, setElectionMsg] = useState('');

  // ─── Candidate ───
  const [candName, setCandName] = useState('');
  const [candPosition, setCandPosition] = useState('');
  const [candDept, setCandDept] = useState('');
  const [candManifesto, setCandManifesto] = useState('');
  const [candPhoto, setCandPhoto] = useState(null);
  const [candPhotoPreview, setCandPhotoPreview] = useState('');
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [candMsg, setCandMsg] = useState('');

  // ─── Result ───
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateVoters, setCandidateVoters] = useState([]);

  // ─── Form Purchase ───
  const [fpRows, setFpRows] = useState([{ position: '', amount: '' }]);
  const [fpSaved, setFpSaved] = useState(false);
  const [fpMsg, setFpMsg] = useState('');

  // ─── Withdrawal ───
  const [withdrawAdminId, setWithdrawAdminId] = useState('');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState('');

  // ─── General Settings ───
  const [generalSettings, setGeneralSettings] = useState({
    maxCandidatesPerPosition: 5,
    theme: 'navy-gold',
    showResults: true,
    allowStudentRegistration: true,
  });
  const [generalMsg, setGeneralMsg] = useState('');

  // ─── Activation ───
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

  // ─── Support ───
  const [unreadCount, setUnreadCount] = useState(0);

  // =================================================================
  // EFFECTS - Load data on mount
  // =================================================================
  useEffect(() => {
    loadAllData();
    loadBalance?.();
  }, []);

  // Support messages listener
  useEffect(() => {
    const q = query(collection(db, 'supportMessages'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = [];
      let unread = 0;
      snap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        msgs.push(data);
        if (data.status === 'unread') unread++;
      });
      setSupportMessages(msgs);
      setUnreadCount(unread);
    });
    return () => unsub();
  }, []);

  // Load form purchase settings
  useEffect(() => {
    if (formPurchaseSettings) {
      const positions = formPurchaseSettings.positions || [];
      if (positions.length > 0) {
        setFpRows(positions.map(p => ({ position: p.position || '', amount: p.amount || '' })));
      }
      setFormPurchaseToggle(formPurchaseSettings.isActive || false);
    }
  }, [formPurchaseSettings]);

  // Load activation toggle from Firestore
  useEffect(() => {
    const loadActivation = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'activation'));
        if (snap.exists()) {
          const data = snap.data();
          setActivationToggle(data.electionActive || false);
          setFormPurchaseToggle(data.formPurchaseActive || false);
          setActivationYear(data.year || '');
          setActivationStartDate(data.startDate || '');
          setActivationStartTime(data.startTime || '');
          setActivationEndDate(data.endDate || '');
          setActivationEndTime(data.endTime || '');
        }
      } catch (e) { /* ignore */ }
    };
    loadActivation();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load candidates
      const candSnap = await getDocs(collection(db, 'candidates'));
      const candList = [];
      candSnap.forEach((d) => candList.push({ id: d.id, ...d.data() }));
      setCandidates(candList);

      // Load election settings
      const settingsSnap = await getDoc(doc(db, 'settings', 'main'));
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data());
      }

      // Load elections
      const elecSnap = await getDocs(collection(db, 'elections'));
      const elecList = [];
      elecSnap.forEach((d) => elecList.push({ id: d.id, ...d.data() }));
      setElections(elecList);

      // Load voters
      const voterSnap = await getDocs(collection(db, 'voters'));
      const voterList = [];
      voterSnap.forEach((d) => voterList.push({ id: d.id, ...d.data() }));
      setVoters(voterList);

      // Load general settings
      const genSnap = await getDoc(doc(db, 'settings', 'general'));
      if (genSnap.exists()) {
        setGeneralSettings(prev => ({ ...prev, ...genSnap.data() }));
      }
    } catch (e) {
      console.error('Load error:', e);
    }
    setLoading(false);
  };

  // =================================================================
  // HELPER FUNCTIONS
  // =================================================================
  const showMsg = (setter, text, type = 'success') => {
    setter({ text, type });
    setTimeout(() => setter(''), 4000);
  };

  const groupByPosition = (arr) => {
    const grouped = {};
    arr.forEach((item) => {
      const pos = item.position || 'Unassigned';
      if (!grouped[pos]) grouped[pos] = [];
      grouped[pos].push(item);
    });
    return grouped;
  };

  /**
   * ============================================================
   * DYNAMIC MAX CANDIDATES PER POSITION RULE
   * ============================================================
   * Reads from General Settings (Firestore doc: settings/general)
   * Default is 5 if not yet configured.
   * Admin can change this anytime in General Setting view.
   */
  const getMaxCandidates = () => {
    return generalSettings.maxCandidatesPerPosition || 5;
  };

  /**
   * Counts how many candidates are currently in a given position.
   * Excludes the candidate currently being edited (if any).
   */
  const getCountInPosition = (position) => {
    return candidates.filter(
      c => c.position === position && c.id !== editingCandidate?.id
    ).length;
  };

  /**
   * Checks if a position has reached the candidate limit.
   */
  const isPositionFull = (position) => {
    return getCountInPosition(position) >= getMaxCandidates();
  };

  // =================================================================
  // ELECTION SETTING HANDLERS
  // =================================================================
  const handleSaveElection = async () => {
    if (!electionForm.title || !electionForm.year) {
      setElectionMsg('Title and Year are required');
      return;
    }
    try {
      if (editingElectionId) {
        await updateDoc(doc(db, 'elections', editingElectionId), electionForm);
        setElectionMsg('Election updated!');
      } else {
        await addDoc(collection(db, 'elections'), {
          ...electionForm,
          createdAt: new Date().toISOString(),
        });
        setElectionMsg('Election created!');
      }
      // Reload
      const elecSnap = await getDocs(collection(db, 'elections'));
      const elecList = [];
      elecSnap.forEach((d) => elecList.push({ id: d.id, ...d.data() }));
      setElections(elecList);
      setEditingElectionId(null);
      setElectionForm({ title: '', year: '', description: '', startDate: '', startTime: '', endDate: '', endTime: '' });
    } catch (e) {
      setElectionMsg('Error: ' + e.message);
    }
  };

  const handleEditElection = (elec) => {
    setEditingElectionId(elec.id);
    setElectionForm({
      title: elec.title || '',
      year: elec.year || '',
      description: elec.description || '',
      startDate: elec.startDate || '',
      startTime: elec.startTime || '',
      endDate: elec.endDate || '',
      endTime: elec.endTime || '',
    });
  };

  const handleDeleteElection = async (id) => {
    if (!window.confirm('Delete this election permanently?')) return;
    try {
      await deleteDoc(doc(db, 'elections', id));
      setElections(prev => prev.filter(e => e.id !== id));
      setElectionMsg('Election deleted!');
    } catch (e) {
      setElectionMsg('Error: ' + e.message);
    }
  };

  // =================================================================
  // CANDIDATE HANDLERS — MAX PER POSITION ENFORCED HERE
  // =================================================================
  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCandPhoto(file);
      const reader = new FileReader();
      reader.onload = (ev) => setCandPhotoPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAddCandidate = async () => {
    if (!candName || !candPosition) {
      setCandMsg('Name and Position required');
      return;
    }

    // ─── ENFORCE MAX CANDIDATES PER POSITION ───
    const max = getMaxCandidates();
    const countInPosition = getCountInPosition(candPosition);
    if (countInPosition >= max) {
      setCandMsg(`❌ Maximum ${max} candidates per position reached for "${candPosition}". ${countInPosition} already registered.`);
      return;
    }

    try {
      let photoUrl = editingCandidate?.photoUrl || '';

      if (candPhoto) {
        const storageRef = ref(storage, `candidates/${Date.now()}_${candPhoto.name}`);
        const snap = await uploadBytes(storageRef, candPhoto);
        photoUrl = await getDownloadURL(snap.ref);
        // Delete old photo if editing
        if (editingCandidate?.photoUrl && editingCandidate.photoUrl.startsWith('https://firebasestorage')) {
          try {
            const oldRef = ref(storage, editingCandidate.photoUrl);
            await deleteObject(oldRef);
          } catch (e) { /* ignore */ }
        }
      }

      const candidateData = {
        name: candName,
        position: candPosition,
        dept: candDept || 'N/A',
        manifesto: candManifesto || '',
        photoUrl,
        votes: editingCandidate?.votes || 0,
        updatedAt: new Date().toISOString(),
      };

      if (editingCandidate) {
        await updateDoc(doc(db, 'candidates', editingCandidate.id), candidateData);
        setCandMsg('Candidate updated!');
      } else {
        candidateData.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'candidates'), candidateData);
        setCandMsg('Candidate added!');
      }

      // Reset form
      setCandName('');
      setCandPosition('');
      setCandDept('');
      setCandManifesto('');
      setCandPhoto(null);
      setCandPhotoPreview('');
      setEditingCandidate(null);
      loadAllData();
    } catch (e) {
      setCandMsg('Error: ' + e.message);
    }
  };

  const handleEditCandidate = (c) => {
    setEditingCandidate(c);
    setCandName(c.name);
    setCandPosition(c.position);
    setCandDept(c.dept || '');
    setCandManifesto(c.manifesto || '');
    setCandPhotoPreview(c.photoUrl || '');
    setCandPhoto(null);
  };

  const handleDeleteCandidate = async (id) => {
    if (!window.confirm('Delete this candidate?')) return;
    try {
      const c = candidates.find(c => c.id === id);
      if (c?.photoUrl && c.photoUrl.startsWith('https://firebasestorage')) {
        try {
          const oldRef = ref(storage, c.photoUrl);
          await deleteObject(oldRef);
        } catch (e) { /* ignore */ }
      }
      await deleteDoc(doc(db, 'candidates', id));
      setCandidates(prev => prev.filter(c => c.id !== id));
      setCandMsg('Candidate deleted!');
    } catch (e) {
      setCandMsg('Error: ' + e.message);
    }
  };

  // =================================================================
  // RESULT HANDLERS
  // =================================================================
  const viewCandidateVoters = async (c) => {
    setSelectedCandidate(c);
    const allVoters = [];
    const voterSnap = await getDocs(collection(db, 'voters'));
    voterSnap.forEach((d) => {
      const data = d.data();
      if (data.votedFor === c.name || data.votedFor === c.position) {
        allVoters.push({ id: d.id, ...data });
      }
    });
    setCandidateVoters(allVoters);
  };

  const handlePrintResults = () => {
    window.print();
  };

  // =================================================================
  // FORM PURCHASE HANDLERS
  // =================================================================
  const handleAddFpRow = () => {
    setFpRows(prev => [...prev, { position: '', amount: '' }]);
  };

  const handleFpRowChange = (index, field, value) => {
    setFpRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteFpRow = (index) => {
    if (fpRows.length <= 1) return;
    setFpRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveFormPurchase = async () => {
    const validRows = fpRows.filter(r => r.position.trim() && r.amount);
    if (validRows.length === 0) {
      setFpMsg('Add at least one position with amount');
      return;
    }
    try {
      await setDoc(doc(db, 'settings', 'formPurchase'), {
        positions: validRows.map(r => ({
          position: r.position.trim(),
          amount: Number(r.amount),
        })),
        updatedAt: new Date().toISOString(),
        isActive: formPurchaseToggle,
      });
      setFpSaved(true);
      setFpMsg('Form Purchase settings saved!');
      if (saveFormPurchaseSettings) {
        await saveFormPurchaseSettings(validRows);
      }
    } catch (e) {
      setFpMsg('Error: ' + e.message);
    }
  };

  // =================================================================
  // WITHDRAWAL HANDLER
  // =================================================================
  const handleWithdraw = async () => {
    if (!withdrawAdminId || !withdrawPin || !withdrawAmount) {
      setWithdrawMsg('Fill all fields');
      return;
    }

    // Validate against DataChargeContext
    const correctAdminId = ADMIN_ID || 'Admin@Namatls128756BC';
    const correctPin = WITHDRAWAL_PIN || '1966';

    if (withdrawAdminId !== correctAdminId) {
      setWithdrawMsg('Error: wrong admin ID');
      return;
    }
    if (withdrawPin !== correctPin) {
      setWithdrawMsg('Error: wrong admin pin');
      return;
    }

    const amount = Number(withdrawAmount);
    if (isNaN(amount) || amount < 1000) {
      setWithdrawMsg('Minimum withdrawal: ₦1,000');
      return;
    }
    if (amount > (withdrawalBalance || 0)) {
      setWithdrawMsg('Insufficient balance');
      return;
    }

    setWithdrawing(true);
    setWithdrawMsg('');
    try {
      const result = await withdraw(amount, OPAY_ACCOUNT);
      setWithdrawMsg(result.message);
      if (result.success) {
        setWithdrawAmount('');
        setWithdrawPin('');
      }
    } catch (e) {
      setWithdrawMsg('Error: ' + e.message);
    }
    setWithdrawing(false);
  };

  // =================================================================
  // GENERAL SETTINGS HANDLER
  // =================================================================
  const handleSaveGeneral = async () => {
    try {
      await setDoc(doc(db, 'settings', 'general'), generalSettings, { merge: true });
      setGeneralMsg('General settings saved!');
    } catch (e) {
      setGeneralMsg('Error: ' + e.message);
    }
  };

  // =================================================================
  // ACTIVATION HANDLER
  // =================================================================
  const handleActivation = async () => {
    if (!activationYear) {
      setActivationMsg('Enter academic year');
      return;
    }

    setActivating(true);
    try {
      if (activationMode === 'election') {
        // Check candidates exist
        if (candidates.length === 0) {
          setActivationMsg('Add at least one candidate before activating election');
          setActivating(false);
          return;
        }

        // Save activation settings
        await setDoc(doc(db, 'settings', 'activation'), {
          electionActive: activationToggle,
          year: activationYear,
          startDate: activationStartDate,
          startTime: activationStartTime,
          endDate: activationEndDate,
          endTime: activationEndTime,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        // Also update main settings
        await setDoc(doc(db, 'settings', 'main'), {
          isActive: activationToggle,
          year: activationYear,
          startDate: activationStartDate,
          startTime: activationStartTime,
          endDate: activationEndDate,
          endTime: activationEndTime,
        }, { merge: true });

        setActivationMsg(activationToggle
          ? '✅ Election is Active!'
          : '⏸️ Election paused.');
      } else {
        // Form Purchase activation
        await setDoc(doc(db, 'settings', 'formPurchase'), {
          isActive: formPurchaseToggle,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        await setDoc(doc(db, 'settings', 'activation'), {
          formPurchaseActive: formPurchaseToggle,
        }, { merge: true });

        setActivationMsg(formPurchaseToggle
          ? '✅ Form Purchase is Active!'
          : '⏸️ Form Purchase paused.');
      }

      loadAllData();
    } catch (e) {
      setActivationMsg('Error: ' + e.message);
    }
    setActivating(false);
  };

  // =================================================================
  // SUPPORT HANDLER
  // =================================================================
  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, 'supportMessages', id), { status: 'read' });
    } catch (e) { /* ignore */ }
  };

  // =================================================================
  // LOADING SCREEN
  // =================================================================
  if (loading) {
    return (
      <div style={{ ...STYLES.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px', border: '4px solid #334155',
            borderTop: '4px solid #FFD700', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ color: COLORS.gold }}>Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  // =================================================================
  // MAIN RENDER
  // =================================================================
  return (
    <div style={STYLES.page}>
      <div style={STYLES.container}>
        {/* ========== TOP HEADER ========== */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0', borderBottom: '1px solid rgba(255,215,0,0.15)',
          marginBottom: '20px',
        }}>
          {/* Hamburger / Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: sidebarOpen ? COLORS.goldLight : 'transparent',
                border: `1px solid ${sidebarOpen ? COLORS.gold : '#334155'}`,
                borderRadius: '8px',
                width: '40px', height: '40px',
                fontSize: '20px',
                cursor: 'pointer',
                color: COLORS.gold,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s',
              }}
            >
              ☰
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src="/logo.png"
                alt="NAMATL Logo"
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div>
                <h1 style={{ margin: 0, fontSize: '18px', color: COLORS.gold, fontWeight: 700, lineHeight: 1.2 }}>
                  NAMATL STUDENT E-VOTING
                </h1>
                <p style={{ margin: 0, fontSize: '11px', color: COLORS.textSecondary }}>
                  Admin Dashboard
                </p>
              </div>
            </div>
          </div>

          {/* Right side: 3-dots + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: menuOpen ? COLORS.goldLight : 'transparent',
                border: `1px solid ${menuOpen ? COLORS.gold : '#334155'}`,
                borderRadius: '8px',
                width: '40px', height: '40px',
                fontSize: '22px', fontWeight: 'bold',
                cursor: 'pointer',
                color: COLORS.gold,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s',
              }}
            >
              ⋮
            </button>
            <button
              onClick={() => { navigate('/admin-login'); }}
              style={{
                background: 'transparent',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 14px',
                cursor: 'pointer',
                color: COLORS.textSecondary,
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => { e.target.style.color = COLORS.danger; e.target.style.borderColor = COLORS.danger; }}
              onMouseLeave={(e) => { e.target.style.color = COLORS.textSecondary; e.target.style.borderColor = '#334155'; }}
            >
              Logout
            </button>

            {/* 3-dots Dropdown */}
            {menuOpen && (
              <>
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 19 }}
                />
                <div style={{
                  position: 'absolute', top: '48px', right: 0, zIndex: 20,
                  background: COLORS.navyCard, border: '1px solid #334155',
                  borderRadius: '12px', minWidth: '200px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                  overflow: 'hidden',
                }}>
                  {MENU_ITEMS.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => { setActiveView(item.key); setMenuOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        width: '100%', padding: '14px 18px',
                        background: activeView === item.key ? COLORS.goldLight : 'transparent',
                        border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                        cursor: 'pointer', color: activeView === item.key ? COLORS.gold : COLORS.textPrimary,
                        fontSize: '14px', fontWeight: activeView === item.key ? 700 : 500,
                        textAlign: 'left', transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { e.target.style.background = COLORS.goldLight; e.target.style.paddingLeft = '24px'; }}
                      onMouseLeave={(e) => {
                        e.target.style.background = activeView === item.key ? COLORS.goldLight : 'transparent';
                        e.target.style.paddingLeft = '18px';
                      }}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ========== SIDEBAR ========== */}
        {sidebarOpen && (
          <>
            <div
              onClick={() => setSidebarOpen(false)}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, background: 'rgba(0,0,0,0.5)' }}
            />
            <div style={{
              position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 31,
              width: '260px', background: COLORS.navyDark,
              borderRight: '1px solid #1e293b', padding: '20px 0',
              boxShadow: '4px 0 30px rgba(0,0,0,0.3)',
              overflowY: 'auto',
            }}>
              <div style={{ padding: '0 16px 20px', borderBottom: '1px solid rgba(255,215,0,0.15)', marginBottom: '8px', textAlign: 'center' }}>
                <img
                  src="/logo.png"
                  alt="NAMATL Logo"
                  style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginBottom: '8px' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <h2 style={{ margin: 0, fontSize: '16px', color: COLORS.gold, fontWeight: 700 }}>NAMATL STUDENT E-VOTING</h2>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: COLORS.textSecondary }}>Admin Panel</p>
              </div>
              {MENU_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setActiveView(item.key); setSidebarOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    width: '100%', padding: '14px 20px',
                    background: activeView === item.key ? COLORS.goldLight : 'transparent',
                    border: 'none', cursor: 'pointer',
                    color: activeView === item.key ? COLORS.gold : COLORS.textPrimary,
                    fontSize: '14px', fontWeight: activeView === item.key ? 700 : 500,
                    textAlign: 'left', transition: 'all 0.2s',
                    borderLeft: activeView === item.key ? `3px solid ${COLORS.gold}` : '3px solid transparent',
                  }}
                  onMouseEnter={(e) => { if (activeView !== item.key) e.target.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { if (activeView !== item.key) e.target.style.background = 'transparent'; }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ======================================================================== */}
        {/* DASHBOARD VIEW */}
        {/* ======================================================================== */}
        {activeView === 'dashboard' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Welcome Section */}
            <div style={{ ...STYLES.card, textAlign: 'center', padding: '30px 20px', marginBottom: '24px' }}>
              <img
                src="/logo.png"
                alt="NAMATL Logo"
                style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', marginBottom: '12px' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <h2 style={{ margin: '0 0 4px', color: COLORS.gold, fontSize: '24px', fontWeight: 700 }}>
                Welcome BROUTE
              </h2>
              <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: '14px' }}>
                Admin ID: {ADMIN_ID || 'Admin@Namatls128756BC'}
              </p>
            </div>

            {/* 3 Square Stats Cards */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px', marginBottom: '24px',
            }}>
              <div style={{ ...STYLES.card, textAlign: 'center', padding: '24px 16px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>👤</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.gold }}>
                  {candidates.length}
                </div>
                <div style={{ fontSize: '13px', color: COLORS.textSecondary, marginTop: '4px' }}>
                  Total Candidates
                </div>
              </div>
              <div style={{ ...STYLES.card, textAlign: 'center', padding: '24px 16px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🗳️</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.gold }}>
                  {voters.length}
                </div>
                <div style={{ fontSize: '13px', color: COLORS.textSecondary, marginTop: '4px' }}>
                  Votes Cast
                </div>
              </div>
              <div style={{ ...STYLES.card, textAlign: 'center', padding: '24px 16px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.gold }}>
                  {Object.keys(groupByPosition(candidates)).length}
                </div>
                <div style={{ fontSize: '13px', color: COLORS.textSecondary, marginTop: '4px' }}>
                  Positions
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* ELECTION SETTING VIEW */}
        {/* ======================================================================== */}
        {activeView === 'election' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: COLORS.gold, marginBottom: '16px', fontSize: '20px' }}>
              ⚙️ Election Settings
            </h2>

            {electionMsg && (
              <div style={{
                ...STYLES.card, padding: '12px 16px',
                background: typeof electionMsg === 'object' && electionMsg.type === 'error'
                  ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                borderColor: typeof electionMsg === 'object' && electionMsg.type === 'error'
                  ? COLORS.danger : COLORS.success,
              }}>
                {typeof electionMsg === 'object' ? electionMsg.text : electionMsg}
              </div>
            )}

            <div style={STYLES.card}>
              <h3 style={{ color: COLORS.gold, marginBottom: '16px', fontSize: '16px' }}>
                {editingElectionId ? '✏️ Edit Election' : '➕ Create New Election'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={STYLES.label}>Title</label>
                  <input
                    style={STYLES.input}
                    placeholder="e.g. NAMATL Student Council Elections"
                    value={electionForm.title}
                    onChange={(e) => setElectionForm({ ...electionForm, title: e.target.value })}
                  />
                </div>
                <div>
                  <label style={STYLES.label}>Year</label>
                  <input
                    style={STYLES.input}
                    placeholder="e.g. 2026/2027"
                    value={electionForm.year}
                    onChange={(e) => setElectionForm({ ...electionForm, year: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={STYLES.label}>Description</label>
                  <textarea
                    style={{ ...STYLES.input, minHeight: '60px', resize: 'vertical' }}
                    placeholder="Election description..."
                    value={electionForm.description}
                    onChange={(e) => setElectionForm({ ...electionForm, description: e.target.value })}
                  />
                </div>
                <div>
                  <label style={STYLES.label}>Start Date</label>
                  <input
                    type="date"
                    style={STYLES.input}
                    value={electionForm.startDate}
                    onChange={(e) => setElectionForm({ ...electionForm, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label style={STYLES.label}>Start Time</label>
                  <input
                    type="time"
                    style={STYLES.input}
                    value={electionForm.startTime}
                    onChange={(e) => setElectionForm({ ...electionForm, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label style={STYLES.label}>End Date</label>
                  <input
                    type="date"
                    style={STYLES.input}
                    value={electionForm.endDate}
                    onChange={(e) => setElectionForm({ ...electionForm, endDate: e.target.value })}
                  />
                </div>
                <div>
                  <label style={STYLES.label}>End Time</label>
                  <input
                    type="time"
                    style={STYLES.input}
                    value={electionForm.endTime}
                    onChange={(e) => setElectionForm({ ...electionForm, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button style={STYLES.btnPrimary} onClick={handleSaveElection}>
                  {editingElectionId ? '✏️ Update Election' : '💾 Save Election'}
                </button>
                {editingElectionId && (
                  <button
                    style={STYLES.btnSecondary}
                    onClick={() => {
                      setEditingElectionId(null);
                      setElectionForm({ title: '', year: '', description: '', startDate: '', startTime: '', endDate: '', endTime: '' });
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>

            {/* Elections List */}
            <div style={STYLES.card}>
              <h3 style={{ color: COLORS.gold, marginBottom: '12px', fontSize: '16px' }}>
                📋 Saved Elections ({elections.length})
              </h3>
              {elections.length === 0 ? (
                <p style={{ color: COLORS.textSecondary, textAlign: 'center', padding: '20px' }}>
                  No elections created yet.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #334155' }}>
                        <th style={{ padding: '10px 8px', textAlign: 'left', color: COLORS.textSecondary }}>Title</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', color: COLORS.textSecondary }}>Year</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', color: COLORS.textSecondary }}>Start</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', color: COLORS.textSecondary }}>End</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', color: COLORS.textSecondary }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {elections.map((elec) => (
                        <tr key={elec.id} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '10px 8px', color: COLORS.textPrimary }}>{elec.title}</td>
                          <td style={{ padding: '10px 8px', color: COLORS.gold }}>{elec.year}</td>
                          <td style={{ padding: '10px 8px', color: COLORS.textSecondary }}>
                            {elec.startDate || '-'} {elec.startTime || ''}
                          </td>
                          <td style={{ padding: '10px 8px', color: COLORS.textSecondary }}>
                            {elec.endDate || '-'} {elec.endTime || ''}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                style={{ ...STYLES.btnSmall, background: COLORS.gold, color: COLORS.navyDark }}
                                onClick={() => handleEditElection(elec)}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                style={{ ...STYLES.btnSmall, background: COLORS.danger, color: 'white' }}
                                onClick={() => handleDeleteElection(elec.id)}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* CANDIDATE VIEW — MAX PER POSITION ENFORCED IN UI */}
        {/* ======================================================================== */}
        {activeView === 'candidate' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: COLORS.gold, marginBottom: '16px', fontSize: '20px' }}>
              👤 Candidate Management
            </h2>

            {candMsg && (
              <div style={{
                ...STYLES.card, padding: '12px 16px',
                background: typeof candMsg === 'object' && candMsg.type === 'error'
                  ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                borderColor: typeof candMsg === 'object' && candMsg.type === 'error'
                  ? COLORS.danger : COLORS.success,
              }}>
                {typeof candMsg === 'object' ? candMsg.text : candMsg}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Add Candidate Form */}
              <div style={STYLES.card}>
                <h3 style={{ color: COLORS.gold, marginBottom: '12px', fontSize: '16px' }}>
                  {editingCandidate ? '✏️ Edit Candidate' : '➕ Add Candidate'}
                </h3>
                <p style={{
                  color: isPositionFull(candPosition) ? COLORS.danger : COLORS.textSecondary,
                  fontSize: '12px', marginBottom: '12px', fontWeight: isPositionFull(candPosition) ? 700 : 400,
                }}>
                  Max {getMaxCandidates()} candidates per position
                  {candPosition && ` • ${getCountInPosition(candPosition)}/${getMaxCandidates()} used for "${candPosition}"`}
                  {isPositionFull(candPosition) && ' ⚠️ FULL'}
                </p>

                <div>
                  <label style={STYLES.label}>Full Name</label>
                  <input style={STYLES.input} placeholder="Candidate name" value={candName}
                    onChange={(e) => setCandName(e.target.value)} />
                </div>
                <div style={{ marginTop: '10px' }}>
                  <label style={STYLES.label}>Position</label>
                  <input style={STYLES.input} placeholder="e.g. President" value={candPosition}
                    onChange={(e) => setCandPosition(e.target.value)} />
                  {/* Show live count for this position */}
                  {candPosition && (
                    <p style={{
                      fontSize: '11px', marginTop: '4px',
                      color: isPositionFull(candPosition) ? COLORS.danger : COLORS.textSecondary,
                    }}>
                      {getCountInPosition(candPosition)} candidate(s) currently in "{candPosition}"
                      {isPositionFull(candPosition) && ' — LIMIT REACHED'}
                    </p>
                  )}
                </div>
                <div style={{ marginTop: '10px' }}>
                  <label style={STYLES.label}>Department</label>
                  <input style={STYLES.input} placeholder="Department" value={candDept}
                    onChange={(e) => setCandDept(e.target.value)} />
                </div>
                <div style={{ marginTop: '10px' }}>
                  <label style={STYLES.label}>Manifesto</label>
                  <textarea style={{ ...STYLES.input, minHeight: '80px', resize: 'vertical' }}
                    placeholder="Candidate manifesto..." value={candManifesto}
                    onChange={(e) => setCandManifesto(e.target.value)} />
                </div>
                <div style={{ marginTop: '10px' }}>
                  <label style={STYLES.label}>Photo</label>
                  <input type="file" accept="image/*" onChange={handlePhotoSelect}
                    style={{ ...STYLES.input, padding: '8px' }} />
                  {candPhotoPreview && (
                    <img src={candPhotoPreview} alt="Preview"
                      style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginTop: '8px' }} />
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button
                    style={{
                      ...STYLES.btnPrimary,
                      opacity: isPositionFull(candPosition) && !editingCandidate ? 0.5 : 1,
                    }}
                    onClick={handleAddCandidate}
                    disabled={isPositionFull(candPosition) && !editingCandidate}
                  >
                    {editingCandidate ? '✏️ Update Candidate' : '➕ Add Candidate'}
                  </button>
                  {editingCandidate && (
                    <button style={STYLES.btnSecondary} onClick={() => {
                      setEditingCandidate(null);
                      setCandName(''); setCandPosition(''); setCandDept('');
                      setCandManifesto(''); setCandPhoto(null); setCandPhotoPreview('');
                    }}>
                      Cancel
                    </button>
                  )}
                </div>
                {isPositionFull(candPosition) && !editingCandidate && (
                  <p style={{ color: COLORS.danger, fontSize: '12px', marginTop: '8px' }}>
                    This position has reached the maximum of {getMaxCandidates()} candidates.
                    Either edit an existing candidate or increase the limit in General Settings.
                  </p>
                )}
              </div>

              {/* Candidates List */}
              <div style={STYLES.card}>
                <h3 style={{ color: COLORS.gold, marginBottom: '12px', fontSize: '16px' }}>
                  📋 All Candidates ({candidates.length})
                </h3>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {candidates.length === 0 ? (
                    <p style={{ color: COLORS.textSecondary, textAlign: 'center', padding: '20px' }}>
                      No candidates added yet.
                    </p>
                  ) : (
                    Object.entries(groupByPosition(candidates)).map(([pos, cands]) => {
                      const isFull = cands.length >= getMaxCandidates();
                      return (
                        <div key={pos} style={{ marginBottom: '16px' }}>
                          <h4 style={{
                            color: isFull ? COLORS.gold : COLORS.textSecondary,
                            fontSize: '13px', fontWeight: 600,
                            borderBottom: `1px solid ${isFull ? 'rgba(255,215,0,0.3)' : '#334155'}`,
                            paddingBottom: '6px', marginBottom: '8px',
                            display: 'flex', justifyContent: 'space-between',
                          }}>
                            <span>{pos}</span>
                            <span style={{
                              color: isFull ? COLORS.gold : COLORS.textSecondary,
                              fontSize: '11px',
                            }}>
                              {cands.length}/{getMaxCandidates()}
                              {isFull ? ' ✅ MAX' : ''}
                            </span>
                          </h4>
                          {cands.map((c) => (
                            <div key={c.id} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '10px 12px', background: COLORS.navyDark,
                              borderRadius: '8px', marginBottom: '6px',
                              border: '1px solid #1e293b',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {c.photoUrl ? (
                                  <img src={c.photoUrl} alt={c.name}
                                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{
                                    width: '36px', height: '36px', borderRadius: '50%',
                                    background: '#334155', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: '16px', color: COLORS.textSecondary,
                                  }}>👤</div>
                                )}
                                <div>
                                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: COLORS.textPrimary }}>
                                    {c.name}
                                  </p>
                                  <p style={{ margin: 0, fontSize: '11px', color: COLORS.textSecondary }}>
                                    {c.dept || 'N/A'} • {c.votes || 0} votes
                                  </p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  style={{ ...STYLES.btnSmall, background: 'rgba(255,215,0,0.15)', color: COLORS.gold }}
                                  onClick={() => handleEditCandidate(c)}
                                >
                                  ✏️
                                </button>
                                <button
                                  style={{ ...STYLES.btnSmall, background: 'rgba(239,68,68,0.15)', color: COLORS.danger }}
                                  onClick={() => handleDeleteCandidate(c.id)}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* RESULT VIEW */}
        {/* ======================================================================== */}
        {activeView === 'result' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ color: COLORS.gold, margin: 0, fontSize: '20px' }}>
                📈 Election Results
              </h2>
              <button
                style={STYLES.btnPrimary}
                onClick={handlePrintResults}
              >
                🖨️ Print Results
              </button>
            </div>

            {/* PRINT AREA */}
            <div id="result-print-area">
              {/* Logo + Header */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img
                  src="/logo.png"
                  alt="NAMATL Logo"
                  style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <h1 style={{ color: COLORS.gold, margin: '8px 0 4px', fontSize: '22px' }}>
                  NAMATL STUDENT E-VOTING
                </h1>
                <p style={{ color: COLORS.textSecondary, fontSize: '13px', margin: 0 }}>
                  Election Results — {settings.year || 'Current Year'}
                </p>
                <hr style={{ borderColor: 'rgba(255,215,0,0.3)', margin: '16px 0' }} />
              </div>

              {selectedCandidate ? (
                <div style={STYLES.card}>
                  <button
                    style={{ ...STYLES.btnSmall, background: COLORS.goldLight, color: COLORS.gold, marginBottom: '12px' }}
                    onClick={() => setSelectedCandidate(null)}
                  >
                    ← Back to All Results
                  </button>
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    {selectedCandidate.photoUrl && (
                      <img src={selectedCandidate.photoUrl} alt={selectedCandidate.name}
                        style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '8px' }} />
                    )}
                    <h3 style={{ color: COLORS.gold, margin: '0 0 4px' }}>{selectedCandidate.name}</h3>
                    <p style={{ color: COLORS.textSecondary, margin: 0, fontSize: '13px' }}>
                      {selectedCandidate.position} • {selectedCandidate.dept}
                    </p>
                    <p style={{ color: COLORS.gold, fontWeight: 700, fontSize: '18px', margin: '8px 0 0' }}>
                      {candidateVoters.length} vote{candidateVoters.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {candidateVoters.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #334155' }}>
                          <th style={{ padding: '8px', textAlign: 'left', color: COLORS.textSecondary }}>Student</th>
                          <th style={{ padding: '8px', textAlign: 'left', color: COLORS.textSecondary }}>Department</th>
                          <th style={{ padding: '8px', textAlign: 'left', color: COLORS.textSecondary }}>Level</th>
                          <th style={{ padding: '8px', textAlign: 'left', color: COLORS.textSecondary }}>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidateVoters.map((v, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                            <td style={{ padding: '8px', color: COLORS.textPrimary }}>{v.fullName || 'Anonymous'}</td>
                            <td style={{ padding: '8px', color: COLORS.textSecondary }}>{v.department || '-'}</td>
                            <td style={{ padding: '8px', color: COLORS.textSecondary }}>{v.level || '-'}</td>
                            <td style={{ padding: '8px', color: COLORS.textSecondary }}>
                              {v.timestamp?.toDate?.()?.toLocaleString() || 'Just now'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ textAlign: 'center', color: COLORS.textSecondary }}>No votes recorded for this candidate.</p>
                  )}
                </div>
              ) : (
                Object.entries(groupByPosition(candidates)).map(([pos, cands]) => {
                  const totalPosVotes = cands.reduce((sum, c) => sum + (c.votes || 0), 0);
                  return (
                    <div key={pos} style={STYLES.card}>
                      <h3 style={{ color: COLORS.gold, marginBottom: '12px', fontSize: '16px' }}>
                        {pos} — {totalPosVotes} total votes
                      </h3>
                      {cands.map((c) => {
                        const votes = c.votes || 0;
                        const pct = totalPosVotes > 0 ? ((votes / totalPosVotes) * 100) : 0;
                        return (
                          <div
                            key={c.id}
                            onClick={() => viewCandidateVoters(c)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '12px', background: COLORS.navyDark,
                              borderRadius: '8px', marginBottom: '8px',
                              border: '1px solid #334155', cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => { e.target.style.borderColor = 'rgba(255,215,0,0.3)'; e.target.style.background = '#1a2332'; }}
                            onMouseLeave={(e) => { e.target.style.borderColor = '#334155'; e.target.style.background = COLORS.navyDark; }}
                          >
                            {c.photoUrl ? (
                              <img src={c.photoUrl} alt={c.name}
                                style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{
                                width: '44px', height: '44px', borderRadius: '50%',
                                background: '#334155', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: '20px',
                              }}>👤</div>
                            )}
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontWeight: 600, color: COLORS.textPrimary, fontSize: '14px' }}>
                                {c.name}
                              </p>
                              <p style={{ margin: 0, fontSize: '12px', color: COLORS.textSecondary }}>
                                {c.dept || 'N/A'}
                              </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '18px', fontWeight: 700, color: COLORS.gold }}>
                                {votes}
                              </div>
                              <div style={{
                                ...STYLES.badge,
                                background: pct >= 50 ? 'rgba(34,197,94,0.15)' : 'rgba(255,215,0,0.1)',
                                color: pct >= 50 ? COLORS.success : COLORS.gold,
                              }}>
                                {pct.toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* FORM PURCHASE SETTING VIEW */}
        {/* ======================================================================== */}
        {activeView === 'form-purchase' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: COLORS.gold, marginBottom: '16px', fontSize: '20px' }}>
              📋 Form Purchase Settings
            </h2>

            {fpMsg && (
              <div style={{
                ...STYLES.card, padding: '12px 16px',
                background: typeof fpMsg === 'object' && fpMsg.type === 'error'
                  ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                borderColor: typeof fpMsg === 'object' && fpMsg.type === 'error'
                  ? COLORS.danger : COLORS.success,
              }}>
                {typeof fpMsg === 'object' ? fpMsg.text : fpMsg}
              </div>
            )}

            <div style={STYLES.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ color: COLORS.gold, margin: 0, fontSize: '16px' }}>
                  Positions & Pricing
                </h3>
                <button style={{ ...STYLES.btnSmall, background: COLORS.goldLight, color: COLORS.gold }} onClick={handleAddFpRow}>
                  + Add Row
                </button>
              </div>

              {fpRows.map((row, index) => (
                <div key={index} style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr auto',
                  gap: '10px', marginBottom: '10px', alignItems: 'end',
                }}>
                  <div>
                    <label style={STYLES.label}>Position</label>
                    <input
                      style={STYLES.input}
                      placeholder="e.g. President"
                      value={row.position}
                      onChange={(e) => handleFpRowChange(index, 'position', e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={STYLES.label}>Amount (₦)</label>
                    <input
                      type="number"
                      style={STYLES.input}
                      placeholder="e.g. 5000"
                      value={row.amount}
                      onChange={(e) => handleFpRowChange(index, 'amount', e.target.value)}
                    />
                  </div>
                  <button
                    style={{
                      ...STYLES.btnSmall, background: 'rgba(239,68,68,0.15)', color: COLORS.danger,
                      padding: '12px 14px', alignSelf: 'end',
                    }}
                    onClick={() => handleDeleteFpRow(index)}
                    disabled={fpRows.length <= 1}
                  >
                    🗑️
                  </button>
                </div>
              ))}

              <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                <button style={STYLES.btnPrimary} onClick={handleSaveFormPurchase}>
                  💾 Save Settings
                </button>
              </div>
              {fpSaved && (
                <p style={{ color: COLORS.success, fontSize: '13px', marginTop: '8px' }}>
                  ✅ Settings saved! Use Activation to make live.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* WITHDRAWAL VIEW */}
        {/* ======================================================================== */}
        {activeView === 'withdrawal' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: COLORS.gold, marginBottom: '16px', fontSize: '20px' }}>
              💰 Withdraw Funds
            </h2>

            {/* Balance Card */}
            <div style={{
              ...STYLES.card, textAlign: 'center', padding: '24px',
              background: 'linear-gradient(135deg, #0a1628 0%, #003366 100%)',
              border: '2px solid rgba(255,215,0,0.3)',
            }}>
              <p style={{ color: COLORS.textSecondary, fontSize: '13px', margin: '0 0 4px' }}>
                Available Balance
              </p>
              <div style={{ fontSize: '36px', fontWeight: 700, color: COLORS.gold }}>
                ₦{(withdrawalBalance || 0).toLocaleString()}
              </div>
            </div>

            <div style={STYLES.card}>
              {withdrawMsg && (
                <div style={{
                  padding: '12px 16px', marginBottom: '16px', borderRadius: '8px',
                  background: withdrawMsg.includes('CONFIRMED') || withdrawMsg.includes('sent')
                    ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${withdrawMsg.includes('CONFIRMED') || withdrawMsg.includes('sent') ? COLORS.success : COLORS.danger}`,
                  color: withdrawMsg.includes('CONFIRMED') || withdrawMsg.includes('sent') ? COLORS.success : '#fca5a5',
                  fontSize: '14px',
                }}>
                  {withdrawMsg}
                </div>
              )}

              <div>
                <label style={STYLES.label}>Admin ID</label>
                <input
                  style={STYLES.input}
                  placeholder="Enter Admin ID"
                  value={withdrawAdminId}
                  onChange={(e) => setWithdrawAdminId(e.target.value)}
                />
              </div>
              <div style={{ marginTop: '12px' }}>
                <label style={STYLES.label}>Withdrawal PIN</label>
                <input
                  type="password"
                  style={STYLES.input}
                  placeholder="Enter PIN"
                  value={withdrawPin}
                  onChange={(e) => setWithdrawPin(e.target.value)}
                />
              </div>
              <div style={{ marginTop: '12px' }}>
                <label style={STYLES.label}>Amount (₦)</label>
                <input
                  type="number"
                  style={STYLES.input}
                  placeholder="Min: ₦1,000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
              </div>

              <div style={{
                marginTop: '16px', padding: '12px', borderRadius: '8px',
                background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)',
                fontSize: '13px', color: COLORS.textSecondary,
              }}>
                Funds will be sent to Opay <strong style={{ color: COLORS.gold }}>{OPAY_ACCOUNT || '9167557038'}</strong>
              </div>

              <button
                style={{
                  ...STYLES.btnPrimary, marginTop: '16px', width: '100%', padding: '14px',
                  fontSize: '16px', opacity: withdrawing ? 0.7 : 1,
                }}
                onClick={handleWithdraw}
                disabled={withdrawing}
              >
                {withdrawing ? '⏳ Processing...' : '💰 Withdraw Now'}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* GENERAL SETTING VIEW */}
        {/* ======================================================================== */}
        {activeView === 'general' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: COLORS.gold, marginBottom: '16px', fontSize: '20px' }}>
              🔧 General Settings
            </h2>

            {generalMsg && (
              <div style={{
                ...STYLES.card, padding: '12px 16px',
                background: 'rgba(34,197,94,0.1)', borderColor: COLORS.success,
              }}>
                {typeof generalMsg === 'object' ? generalMsg.text : generalMsg}
              </div>
            )}

            <div style={STYLES.card}>
              {/* Site Name - NOT editable */}
              <div style={{ marginBottom: '16px' }}>
                <label style={STYLES.label}>Site Name</label>
                <div style={{
                  ...STYLES.input, opacity: 0.6, cursor: 'not-allowed',
                  background: '#1a1f2e',
                }}>
                  NAMATL STUDENT E-VOTING
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textSecondary, marginTop: '4px' }}>
                  Site name is fixed and cannot be changed.
                </p>
              </div>

              {/* Max Candidates Per Position - EDITABLE */}
              <div style={{ marginBottom: '16px' }}>
                <label style={STYLES.label}>Maximum Candidates Per Position</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  style={STYLES.input}
                  value={generalSettings.maxCandidatesPerPosition}
                  onChange={(e) => setGeneralSettings({
                    ...generalSettings,
                    maxCandidatesPerPosition: Math.max(1, Number(e.target.value)),
                  })}
                />
                <p style={{ fontSize: '11px', color: COLORS.textSecondary, marginTop: '4px' }}>
                  Default: 5. Controls how many candidates can be added per position.
                  Current value: <strong style={{ color: COLORS.gold }}>{generalSettings.maxCandidatesPerPosition}</strong>
                </p>
              </div>

              {/* Theme - Always Navy + Gold */}
              <div style={{ marginBottom: '16px' }}>
                <label style={STYLES.label}>Dashboard Theme</label>
                <div style={{
                  ...STYLES.select, opacity: 0.6, cursor: 'not-allowed',
                  background: '#1a1f2e',
                }}>
                  Navy Blue + Gold
                </div>
                <p style={{ fontSize: '11px', color: COLORS.textSecondary, marginTop: '4px' }}>
                  Theme is fixed to Navy Blue + Gold.
                </p>
              </div>

              {/* Show Results */}
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ ...STYLES.label, margin: 0 }}>Show Results to Students</label>
                <input
                  type="checkbox"
                  checked={generalSettings.showResults}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, showResults: e.target.checked })}
                  style={{ width: '20px', height: '20px', accentColor: COLORS.gold }}
                />
              </div>

              {/* Allow Registration */}
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ ...STYLES.label, margin: 0 }}>Allow Student Registration</label>
                <input
                  type="checkbox"
                  checked={generalSettings.allowStudentRegistration}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, allowStudentRegistration: e.target.checked })}
                  style={{ width: '20px', height: '20px', accentColor: COLORS.gold }}
                />
              </div>

              <button style={STYLES.btnPrimary} onClick={handleSaveGeneral}>
                💾 Save Settings
              </button>
            </div>
          </div>
        )}

        {/* ======================================================================== */}
        {/* ACTIVATION VIEW */}
        {/* ======================================================================== */}
        {activeView === 'activation' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: COLORS.gold, marginBottom: '16px', fontSize: '20px' }}>
              🔑 Activation Control
            </h2>

            {activationMsg && (
              <div style={{
                ...STYLES.card, padding: '12px 16px',
                background: activationMsg.includes('✅')
                  ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                borderColor: activationMsg.includes('✅') ? COLORS.success : COLORS.danger,
                color: activationMsg.includes('✅') ? COLORS.success : '#fca5a5',
              }}>
                {activationMsg}
              </div>
            )}

            {/* Mode Selector */}
            <div style={STYLES.card}>
              <h3 style={{ color: COLORS.gold, marginBottom: '12px', fontSize: '16px' }}>
                Select Activation Mode
              </h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setActivationMode('election')}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '8px', cursor: 'pointer',
                    border: activationMode === 'election'
                      ? `2px solid ${COLORS.gold}` : '2px solid #334155',
                    background: activationMode === 'election' ? COLORS.goldLight : 'transparent',
                    color: activationMode === 'election' ? COLORS.gold : COLORS.textSecondary,
                    fontWeight: 700, fontSize: '14px', transition: 'all 0.2s',
                  }}
                >
                  🗳️ Election
                </button>
                <button
                  onClick={() => setActivationMode('form-purchase')}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '8px', cursor: 'pointer',
                    border: activationMode === 'form-purchase'
                      ? `2px solid ${COLORS.gold}` : '2px solid #334155',
                    background: activationMode === 'form-purchase' ? COLORS.goldLight : 'transparent',
                    color: activationMode === 'form-purchase' ? COLORS.gold : COLORS.textSecondary,
                    fontWeight: 700, fontSize: '14px', transition: 'all 0.2s',
                  }}
                >
                  📋 Form Purchase
                </button>
              </div>
            </div>

            {/* Election Activation */}
            {activationMode === 'election' && (
              <>
                {/* Prerequisites */}
                <div style={STYLES.card}>
                  <h3 style={{ color: COLORS.gold, marginBottom: '12px', fontSize: '16px' }}>
                    Prerequisites Check
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: candidates.length > 0 ? COLORS.success : COLORS.danger, fontSize: '18px' }}>
                        {candidates.length > 0 ? '✅' : '❌'}
                      </span>
                      <span style={{ color: candidates.length > 0 ? COLORS.textPrimary : COLORS.textSecondary }}>
                        {candidates.length > 0 ? `${candidates.length} candidate(s) ready` : 'No candidates added'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: settings.year ? COLORS.success : COLORS.danger, fontSize: '18px' }}>
                        {settings.year ? '✅' : '❌'}
                      </span>
                      <span style={{ color: settings.year ? COLORS.textPrimary : COLORS.textSecondary }}>
                        {settings.year ? `Year: ${settings.year}` : 'No election year set'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>
                        {activationToggle ? '🔓' : '🔒'}
                      </span>
                      <span style={{ color: activationToggle ? COLORS.success : COLORS.textSecondary }}>
                        {activationToggle ? 'Currently active' : 'Currently inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Election Activation Form */}
                <div style={STYLES.card}>
                  <h3 style={{ color: COLORS.gold, marginBottom: '12px', fontSize: '16px' }}>
                    Election Configuration
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={STYLES.label}>Academic Year</label>
                      <input style={STYLES.input} placeholder="e.g. 2026/2027"
                        value={activationYear}
                        onChange={(e) => setActivationYear(e.target.value)} />
                      {activationYear === '2026/2027' && (
                        <p style={{ color: COLORS.success, fontSize: '12px', marginTop: '4px' }}>
                          🎉 FREE activation for 2026/2027!
                        </p>
                      )}
                    </div>
                    <div>
                      <label style={STYLES.label}>Start Date</label>
                      <input type="date" style={STYLES.input}
                        value={activationStartDate}
                        onChange={(e) => setActivationStartDate(e.target.value)} />
                    </div>
                    <div>
                      <label style={STYLES.label}>Start Time</label>
                      <input type="time" style={STYLES.input}
                        value={activationStartTime}
                        onChange={(e) => setActivationStartTime(e.target.value)} />
                    </div>
                    <div>
                      <label style={STYLES.label}>End Date</label>
                      <input type="date" style={STYLES.input}
                        value={activationEndDate}
                        onChange={(e) => setActivationEndDate(e.target.value)} />
                    </div>
                    <div>
                      <label style={STYLES.label}>End Time</label>
                      <input type="time" style={STYLES.input}
                        value={activationEndTime}
                        onChange={(e) => setActivationEndTime(e.target.value)} />
                    </div>
                  </div>

                  {/* Toggle */}
                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ ...STYLES.label, margin: 0, textTransform: 'none' }}>
                      Election Status
                    </label>
                    <div
                      onClick={() => setActivationToggle(!activationToggle)}
                      style={{
                        width: '48px', height: '26px', borderRadius: '13px',
                        background: activationToggle ? COLORS.success : '#475569',
                        cursor: 'pointer', position: 'relative',
                        transition: 'background 0.3s', flexShrink: 0,
                      }}
                    >
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        background: 'white', position: 'absolute', top: '2px',
                        left: activationToggle ? '24px' : '2px',
                        transition: 'left 0.3s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      }} />
                    </div>
                    <span style={{
                      fontSize: '14px', fontWeight: 700,
                      color: activationToggle ? COLORS.success : COLORS.textSecondary,
                    }}>
                      {activationToggle ? 'ACTIVE - Voting Open' : 'INACTIVE - Voting Closed'}
                    </span>
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <button style={STYLES.btnPrimary} onClick={handleActivation} disabled={activating}>
                      {activating ? '⏳ Processing...' : activationToggle ? '🔓 ACTIVATE ELECTION' : '💾 Save Settings'}
                    </button>
                  </div>

                  <div style={{ marginTop: '16px', padding: '12px', background: COLORS.navyDark, borderRadius: '8px', fontSize: '13px', color: COLORS.textSecondary }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 600, color: COLORS.gold }}>How it works:</p>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
                      <li>Enter the academic year, start date/time, and end date/time.</li>
                      <li>If year is <strong style={{ color: COLORS.gold }}>2026/2027</strong> → activation is <strong style={{ color: COLORS.success }}>FREE</strong>.</li>
                      <li>Any other year → you handle the N25,000 payment manually.</li>
                      <li>Toggle the switch <strong>ON</strong> to make voting live.</li>
                      <li>At least <strong>1 candidate</strong> and a saved election year are required.</li>
                    </ul>
                  </div>
                </div>
              </>
            )}

            {/* Form Purchase Activation */}
            {activationMode === 'form-purchase' && (
              <div style={STYLES.card}>
                <h3 style={{ color: COLORS.gold, marginBottom: '12px', fontSize: '16px' }}>
                  Form Purchase Activation
                </h3>

                <p style={{ color: COLORS.textSecondary, fontSize: '14px', marginBottom: '16px' }}>
                  Toggle form purchase on/off for the student dashboard.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <label style={{ ...STYLES.label, margin: 0, textTransform: 'none' }}>
                    Form Purchase Status
                  </label>
                  <div
                    onClick={() => setFormPurchaseToggle(!formPurchaseToggle)}
                    style={{
                      width: '48px', height: '26px', borderRadius: '13px',
                      background: formPurchaseToggle ? COLORS.success : '#475569',
                      cursor: 'pointer', position: 'relative',
                      transition: 'background 0.3s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      background: 'white', position: 'absolute', top: '2px',
                      left: formPurchaseToggle ? '24px' : '2px',
                      transition: 'left 0.3s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }} />
                  </div>
                  <span style={{
                    fontSize: '14px', fontWeight: 700,
                    color: formPurchaseToggle ? COLORS.success : COLORS.textSecondary,
                  }}>
                    {formPurchaseToggle ? 'ACTIVE - Form Purchase Open' : 'INACTIVE - Form Purchase Closed'}
                  </span>
                </div>

                <button style={STYLES.btnPrimary} onClick={handleActivation} disabled={activating}>
                  {activating ? '⏳ Processing...' : formPurchaseToggle ? '✅ Activate Form Purchase' : '⏸️ Pause Form Purchase'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================================== */}
        {/* SUPPORT VIEW */}
        {/* ======================================================================== */}
        {activeView === 'support' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <h2 style={{ color: COLORS.gold, marginBottom: '16px', fontSize: '20px' }}>
              💬 Support Messages
              {unreadCount > 0 && (
                <span style={{
                  ...STYLES.badge, background: COLORS.danger, color: 'white',
                  marginLeft: '8px', fontSize: '11px',
                }}>
                  {unreadCount} new
                </span>
              )}
            </h2>

            {supportMessages.length === 0 ? (
              <div style={{ ...STYLES.card, textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                <h3 style={{ color: COLORS.textSecondary, margin: 0 }}>No messages yet</h3>
              </div>
            ) : (
              <div style={STYLES.card}>
                {supportMessages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => markAsRead(msg.id)}
                    style={{
                      padding: '16px', borderBottom: '1px solid #1e293b',
                      cursor: 'pointer',
                      background: msg.status === 'unread' ? COLORS.goldLight : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ color: COLORS.textPrimary }}>
                        {msg.name || 'Anonymous'}
                      </strong>
                      <span style={{ color: COLORS.textSecondary, fontSize: '12px' }}>
                        {msg.timestamp?.toDate?.()?.toLocaleString() || 'Just now'}
                      </span>
                    </div>
                    {msg.email && msg.email !== 'Not provided' && (
                      <p style={{ margin: '0 0 4px', fontSize: '12px', color: COLORS.gold }}>
                        📧 {msg.email}
                      </p>
                    )}
                    <p style={{ margin: 0, fontSize: '14px', color: COLORS.textSecondary }}>
                      {msg.message}
                    </p>
                    {msg.status === 'unread' && (
                      <span style={{
                        ...STYLES.badge, background: COLORS.success, color: 'white',
                        marginTop: '8px', display: 'inline-block',
                      }}>
                        NEW
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================================== */}
        {/* FOOTER */}
        {/* ======================================================================== */}
        <div style={{
          textAlign: 'center', padding: '20px 0', marginTop: '20px',
          borderTop: '1px solid rgba(255,215,0,0.1)',
          color: COLORS.textSecondary, fontSize: '12px',
        }}>
          NAMATL STUDENT E-VOTING © {new Date().getFullYear()} — Admin Dashboard
        </div>

      </div>
    </div>
  );
}