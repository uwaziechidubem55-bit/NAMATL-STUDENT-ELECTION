import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { collection, addDoc, getDocs, getDoc, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useDataCharge } from '../context/DataChargeContext';

const MAX_PER_POSITION = 5;

// Helper to generate random candidate ID
const generateCandidateId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 7; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'NAMATL-' + id;
};

// ===================== AUTO-REPLY GENERATOR =====================
const generateAutoReply = (msg) => {
  const text = (msg.message || '').toLowerCase();
  const name = msg.name || 'Sir/Madam';

  // Determine the type of inquiry
  const isVoting = /vote|election|ballot|cast|poll/i.test(text);
  const isLoginCode = /code|pin|access|unique|portal|login|password|otp/i.test(text);
  const isForm = /form|purchase|buy|pay|registra|fee|price|cost|amount/i.test(text);
  const isComplaint = /complaint|issue|problem|error|bug|not working|fail|glitch|difficult/i.test(text);
  const isCandidate = /candidate|contest|run|nomina|stand|position/i.test(text);
  const isHelp = /help|assist|support|how do|guide|explain|what is|can you|please/i.test(text);
  const isGeneral = /question|inquiry|info|information|about|regarding/i.test(text);
  const isPayment = /payment|paid|transaction|flutterwave|receipt|confirm|money/i.test(text);
  const isResult = /result|score|winner|win|who|count/i.test(text);

  // Common header
  const header = `Thank you for contacting the NAMATL Electoral Commission.\n\nWe have carefully reviewed your message and provide the following response:\n\n`;

  // Common footer
  const footer = `\n\nThe Electoral Commission is actively working on your request. We will get back to you with a comprehensive update within 24–48 hours.\n\nShould you have any further questions, please do not hesitate to reach out.\n\nSigned and approved by:\n_______________________________\nComr. D. Uwazie\nSecretary, NAMATL Electoral Commission\n\n_______________________________\nComr. P.Ufot\nChairman, NAMATL Electoral Commission\n\n--\nNAMATL Electoral Commission\nFederal University of Petroleum Resources Effurun`;

  // If message is very short or unclear — use a general response
  if (text.length < 10) {
    return `${header}We acknowledge receipt of your message. The NAMATL Electoral Commission appreciates your communication. However, your enquiry appears to require further clarification. Kindly provide more details regarding your issue so that we may assist you appropriately. Alternatively, you may visit the Students' Affairs Division for in-person assistance.${footer}`;
  }

  // Login/access code related
  if (isLoginCode) {
    return `${header}Regarding your request for access to the student voting portal, please be informed that each registered student of the Federal University of Petroleum Resources Effurun is issued unique login credentials linked to their institutional matriculation number.\n\nTo access the portal:\n1. Use your matriculation number as your username\n2. An OTP will be sent to your registered institutional email address\n3. Enter the OTP to complete the login process\n\nIf you are experiencing difficulty logging in, it may be due to an incorrect matriculation number or an unregistered email address. Kindly confirm that your details are correctly entered. For further assistance, the Commission will investigate and provide a resolution promptly.${footer}`;
  }

  // Voting process related
  if (isVoting) {
    return `${header}Thank you for your enquiry regarding the voting process. The NAMATL election is conducted electronically through our secure and transparent e-voting platform.\n\nKey information:\n• Each eligible voter must log in using their unique student credentials\n• Voting is only open during the designated election period as announced\n• Each student is entitled to one vote per position\n• The platform ensures secure, encrypted, and anonymous voting\n• Results are tallied automatically and verified by the Electoral Commission\n\nYour participation in the electoral process is duly noted. If you require any clarification on the voting procedure, please refer to the guidelines available on the portal or contact the Commission directly.${footer}`;
  }

  // Form purchase related
  if (isForm) {
    return `${header}With reference to your message concerning form purchase, the NAMATL Electoral Commission provides the following information:\n\n• Nomination forms are available for purchase through the official e-voting portal\n• Payments are processed securely via Flutterwave (credit/debit cards, bank transfers, USSD)\n• After payment, the Commission reviews your details and registers you as a candidate\n• You will be required to upload your manifesto and passport photograph after payment\n• Each position has a specific fee as listed on the Form Purchase page\n• Maximum of five (5) candidates per position\n\nFor specific pricing and position availability, kindly refer to the Form Purchase section on the portal. The Commission will attend to any further inquiries regarding your transaction.${footer}`;
  }

  // Candidate/nomination related
  if (isCandidate) {
    return `${header}Thank you for your interest in contesting for a position in the NAMATL election. We are pleased to inform you of the nomination process:\n\n1. Purchase the nomination form for your desired position through the official portal\n2. Complete the payment via Flutterwave (secured transaction)\n3. After successful payment, provide your details including:\n   - Full name\n   - Position contested\n   - Department\n   - Manifesto (your vision and plans)\n   - Passport photograph\n4. Your candidacy will be reviewed and approved by the Electoral Commission\n5. You will appear on the ballot paper once approved\n\nWe appreciate your enthusiasm and commitment to student leadership. The Commission encourages all qualified students to participate in the democratic process.${footer}`;
  }

  // Payment related
  if (isPayment) {
    return `${header}Regarding your enquiry about payment, the NAMATL Electoral Commission uses Flutterwave as our secure payment gateway for all form purchases and transactions.\n\nImportant information:\n• All payments are processed in real-time\n• A confirmation receipt is generated upon successful payment\n• If you encountered an issue during payment, please provide the transaction reference number\n• The Commission will verify the transaction and resolve any discrepancies\n• Refunds, if applicable, are processed within 5–7 business days\n\nPlease allow the Commission some time to investigate your transaction. We will provide you with a detailed update regarding the status of your payment.${footer}`;
  }

  // Results related
  if (isResult) {
    return `${header}Thank you for your interest in the election results. The NAMATL Electoral Commission conducts a transparent and verifiable election process.\n\nRegarding results:\n• Results are officially released immediately after the conclusion of the election period\n• Final results are displayed on the Admin Dashboard and are accessible to authorised personnel\n• The results include the total votes cast per candidate, vote points, and official candidate IDs\n• All results are certified by the Electoral Commission before publication\n\nIf the election has not yet concluded, please note that results will only be made available after voting has ended. The Commission will communicate the official results through the appropriate channels.${footer}`;
  }

  // Complaint related
  if (isComplaint) {
    return `${header}We acknowledge receipt of your complaint and sincerely apologise for any inconvenience you may have experienced. The NAMATL Electoral Commission takes all concerns with the utmost seriousness.\n\nYour issue has been logged and escalated to the appropriate technical and administrative team for immediate review. The Commission is committed to:\n• Investigating the matter thoroughly\n• Addressing any technical glitches or administrative errors\n• Ensuring a fair and seamless electoral process for all students\n• Providing you with a detailed resolution within the shortest possible time\n\nWe assure you that the matter will be addressed with the urgency it deserves. Your patience and understanding are highly appreciated.${footer}`;
  }

  // General help/assistance
  if (isHelp || isGeneral) {
    return `${header}We appreciate you reaching out to the NAMATL Electoral Commission for assistance. Below is comprehensive information relevant to your enquiry:\n\nABOUT THE PLATFORM:\nThe NAMATL Student E-Voting system is designed to facilitate a seamless, transparent, and secure voting experience for all students of the Federal University of Petroleum Resources Effurun.\n\nTECHNICAL REQUIREMENTS:\n• Ensure you are using a stable internet connection\n• Use an updated browser (Chrome, Firefox, or Safari recommended)\n• Clear your browser cache if you encounter any display issues\n\nLOGIN ASSISTANCE:\n• Your username is your institutional matriculation number\n• An OTP is sent to your registered institutional email\n• Contact the IT support desk if you do not receive the OTP\n\nFORM PURCHASE:\n• Visit the Purchase Form section on the landing page\n• Follow the payment instructions carefully\n• Contact the Commission if payment is not reflected\n\nShould your question require further clarification, the Commission will follow up with you directly. We are committed to ensuring a smooth electoral experience for all.${footer}`;
  }

  // Default fallback for any other enquiry
  return `${header}Thank you for your message. The NAMATL Electoral Commission has noted your enquiry and will review it accordingly. Our team is committed to providing you with a thorough and satisfactory response.\n\nFor your reference, here are some common resources:\n• Student Login Portal: Available on the landing page\n• Form Purchase: Accessible via the Purchase Form link\n• Admin Support: Available through the support channel\n\nPlease allow us some time to process your request, and we will get back to you as soon as possible. For urgent matters, you may also visit the Electoral Commission office at the Students' Affairs Division, FUPRE.${footer}`;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const {
    withdrawalBalance, withdraw, loadBalance, loadFormPurchases, saveFormPurchaseSettings,
    formPurchaseSettings, formPurchases, ADMIN_ID, OPAY_ACCOUNT
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
  const [withdrawBusy, setWithdrawBusy] = useState(false);

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

  // ===================== PRINT RESULTS STATE =====================
  const [electionResults, setElectionResults] = useState([]);
  const [resultsGenerated, setResultsGenerated] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [printMsg, setPrintMsg] = useState('');

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
                // Auto-stop election
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

      // Write to settings/main
      await setDoc(doc(db, 'settings', 'main'), { activeMode: newMode }, { merge: true });

      if (type === 'election') {
        // Copy election settings into settings/main so StudentDashboard reads them
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
        // Activate the formPurchase settings so PurchaseForm.jsx sees isActive: true
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

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const [candidatesSnap, settingsSnap, votersSnap, supportSnap] = await Promise.all([
        getDocs(collection(db, 'candidates')),
        getDoc(doc(db, 'settings', 'election')).catch(() => ({ exists: () => false, data: () => ({}) })),
        getDocs(collection(db, 'students')).catch(() => ({ forEach: () => {} })),
        getDocs(collection(db, 'supportMessages')).catch(() => ({ forEach: () => {} })),
      ]);

      const cData = [];
      candidatesSnap.forEach(d => cData.push({ id: d.id, ...d.data() }));
      setCandidates(cData);

      const counts = {};
      cData.forEach(c => { counts[c.position] = (counts[c.position] || 0) + 1; });
      setFpCandidateCounts(counts);

      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data());
      }

      const vData = [];
      votersSnap.forEach(d => vData.push({ id: d.id, ...d.data() }));
      setVoters(vData);

      const mData = [];
      supportSnap.forEach(d => mData.push({ id: d.id, ...d.data() }));
      setSupportMessages(mData);

      try { await loadBalance(); } catch (e) {}
      try { await loadFormPurchases(); } catch (e) {}
      try { await loadActivation(); } catch (e) {}

      setLoading(false);
    } catch (e) {
      console.error('Admin load error:', e);
      setError('Failed to load data. Make sure Firestore database is created in Firebase Console.');
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

  const sortedByVotes = [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const unreadMessages = supportMessages.filter(m => m.status === 'unread').length;
  const activeVoters = voters.filter(v => v.hasVoted).length;

  // ===================== PURCHASE LIST (grouped by position, President on top) =====================
  const purchaseGroups = (() => {
    const groups = {};
    (formPurchases || []).forEach(p => {
      const key = p.position || 'Unknown Position';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    const positionKeys = Object.keys(groups);
    if (positionKeys.length === 0) return [];
    const presidentKey = positionKeys.find(k => k.toLowerCase() === 'president');
    const orderedKeys = [];
    if (presidentKey) orderedKeys.push(presidentKey);
    fpPositions.forEach(x => {
      if (groups[x.position] && !orderedKeys.includes(x.position)) orderedKeys.push(x.position);
    });
    positionKeys.filter(k => !orderedKeys.includes(k)).sort((a, b) => a.localeCompare(b)).forEach(k => orderedKeys.push(k));
    return orderedKeys.map(pos => ({ position: pos, purchases: groups[pos] }));
  })();

  const sidebarItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'settings', label: 'Election Settings', icon: '⚙️' },
    { key: 'candidates', label: 'Manage Candidates', icon: '👥' },
    { key: 'activation', label: 'Activation', icon: '🔘' },
    { key: 'results', label: 'Election Results', icon: '📈' },
    { key: 'print-results', label: 'Print Results', icon: '🖨️' },
    { key: 'form-purchase', label: 'Form Purchase', icon: '📋' },
    { key: 'purchase-list', label: 'Purchase List', icon: '🛒' },
    { key: 'withdrawal', label: 'Withdraw Funds', icon: '💰' },
    { key: 'messages', label: `Messages (${unreadMessages})`, icon: '✉️' },
  ];

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
  const btnWarning = { ...btnPrimary, background: '#f59e0b', color: '#003366' };
  const labelStyle = {
    display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px'
  };

  const handleSaveSettings = async () => {
    try { await setDoc(doc(db, 'settings', 'election'), settings, { merge: true }); alert('✅ Saved!'); }
    catch (e) { alert('Error: ' + e.message); }
  };

  const handleSaveCandidate = async () => {
    if (!name || !position || !dept) { alert('Name, position and dept required'); return; }
    try {
      if (editingCandidate) {
        await updateDoc(doc(db, 'candidates', editingCandidate.id), { name, position, dept, manifesto });
        // Upload photo if new one selected
        if (photo) {
          const storageRef = ref(storage, `candidates/${editingCandidate.id}_${Date.now()}`);
          await uploadBytes(storageRef, photo);
          const photoURL = await getDownloadURL(storageRef);
          await updateDoc(doc(db, 'candidates', editingCandidate.id), { photo: photoURL });
        }
      } else {
        const posCount = candidates.filter(c => c.position === position).length;
        if (posCount >= MAX_PER_POSITION) { alert(`Max ${MAX_PER_POSITION} for ${position}`); return; }
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
    setPhoto(null);
  };

  const handleDeleteCandidate = async (id) => {
    if (!window.confirm('Delete?')) return;
    try { await deleteDoc(doc(db, 'candidates', id)); loadAllData(); }
    catch (e) { alert('Error: ' + e.message); }
  };

  // ===================== WITHDRAW (v2: auto-confirm via /api/check-transfer) =====================
  const handleWithdraw = async () => {
    if (!withdrawAdminId || !withdrawPin || !withdrawAmount) {
      setWithdrawMsg({ type: 'error', text: 'Fill all fields' }); return;
    }
    if (withdrawBusy) return;
    setWithdrawBusy(true);
    setWithdrawMsg({ type: '', text: 'Processing...' });
    try {
      const result = await withdraw(withdrawAdminId, withdrawPin, Number(withdrawAmount));

      // Plain failure (bad PIN, insufficient balance, Flutterwave rejected)
      if (!result.success && !result.reference) {
        setWithdrawMsg({ type: 'error', text: result.message || 'Withdrawal failed' });
        setWithdrawBusy(false);
        return;
      }

      // ✅ Fully confirmed by Flutterwave already
      if (result.success && !result.reference) {
        setWithdrawMsg({ type: 'success', text: result.message });
        setWithdrawAmount(''); setWithdrawPin('');
        loadBalance();
        setWithdrawBusy(false);
        return;
      }

      // ⏳ Unverified / pending — Flutterwave accepted the transfer but hasn't
      // confirmed it yet. Poll /api/check-transfer (which asks Flutterwave
      // DIRECTLY using the secret key) until it confirms, then show success.
      const ref = result.reference;
      const id = result.flutterwaveId;
      setWithdrawMsg({ type: 'info', text: '⏳ ' + (result.message || 'Transfer accepted. Confirming with Flutterwave...') });

      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const checkRes = await fetch('/api/check-transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: ref, transferId: id })
          });
          const check = await checkRes.json();
          if (check.verified) {
            clearInterval(poll);
            setWithdrawMsg({ type: 'success', text: '✅ ' + (check.message || 'Withdrawal confirmed!') });
            setWithdrawAmount(''); setWithdrawPin('');
            loadBalance();
            setWithdrawBusy(false);
          } else if (check.status === 'failed') {
            clearInterval(poll);
            setWithdrawMsg({ type: 'error', text: '❌ ' + (check.message || 'Transfer failed') });
            setWithdrawBusy(false);
          } else if (attempts >= 36) { // ~3 minutes of polling
            clearInterval(poll);
            setWithdrawMsg({ type: 'info', text: '⏳ Still processing on Flutterwave. The webhook will confirm it automatically — watch your balance.' });
            setWithdrawBusy(false);
          }
        } catch (e) {
          if (attempts >= 36) {
            clearInterval(poll);
            setWithdrawMsg({ type: 'info', text: '⚠️ Could not reach server. The webhook will still confirm it automatically.' });
            setWithdrawBusy(false);
          }
        }
      }, 5000);
    } catch (e) {
      setWithdrawMsg({ type: 'error', text: '⚠️ Network error: ' + e.message });
      setWithdrawBusy(false);
    }
  };

  const handleFpAddPosition = () => {
    if (!fpNewPosition || !fpNewAmount) { alert('Position and amount required'); return; }
    if (fpPositions.find(p => p.position === fpNewPosition.trim())) { alert('Already exists'); return; }
    setFpPositions([...fpPositions, { position: fpNewPosition.trim(), amount: Number(fpNewAmount) }]);
    setFpNewPosition(''); setFpNewAmount('');
  };

  const handleFpRemovePosition = (i) => setFpPositions(fpPositions.filter((_, idx) => idx !== i));

  const handleFpSaveSettings = async () => {
    if (!fpPositions.length) { alert('Add at least one position'); return; }
    setFpSaving(true); setFpMsg('Saving...');
    const result = await saveFormPurchaseSettings({
      isActive: fpIsActive, openingDate: fpOpeningDate, closingDate: fpClosingDate,
      openingTime: fpOpeningTime, closingTime: fpClosingTime, positions: fpPositions
    });
    setFpMsg(result.message);
    if (result.success) setTimeout(() => setFpMsg(''), 3000);
    setFpSaving(false);
  };

  // ===================== GENERATE & STORE RESULTS =====================
  const handleGenerateResults = async () => {
    if (candidates.length === 0) {
      setPrintMsg('No candidates to generate results for.');
      return;
    }
    setPrintLoading(true);
    setPrintMsg('Generating results...');
    setResultsGenerated(false);

    try {
      // Check if results already exist in Firestore
      const existingResultsSnap = await getDoc(doc(db, 'electionData', 'results'));
      let storedCandidateIds = {};

      if (existingResultsSnap.exists()) {
        storedCandidateIds = existingResultsSnap.data().candidateIds || {};
      }

      // Count candidates per position for vote points
      const positionCounts = {};
      candidates.forEach(c => {
        positionCounts[c.position] = (positionCounts[c.position] || 0) + 1;
      });

      // Build results array
      const results = [];
      const candidateIds = { ...storedCandidateIds };

      candidates.forEach((c, index) => {
        // Generate candidate ID if not already stored
        if (!candidateIds[c.id]) {
          candidateIds[c.id] = generateCandidateId();
        }

        const totalInPosition = positionCounts[c.position] || 1;
        const votes = c.votes || 0;
        const votePoint = totalInPosition > 0 ? (votes / totalInPosition).toFixed(2) : '0.00';

        results.push({
          sNo: index + 1,
          candidateId: candidateIds[c.id],
          name: c.name,
          position: c.position,
          votes: votes,
          votePoint: votePoint,
          dept: c.dept || ''
        });
      });

      // Sort by position then by votes descending
      results.sort((a, b) => {
        if (a.position !== b.position) return a.position.localeCompare(b.position);
        return b.votes - a.votes;
      });

      // Re-assign serial numbers after sorting
      results.forEach((r, i) => { r.sNo = i + 1; });

      // Store in Firestore
      const year = settings.year || '2026/2027';
      await setDoc(doc(db, 'electionData', 'results'), {
        year: year,
        generatedAt: new Date().toISOString(),
        candidateIds: candidateIds,
        results: results,
        totalPositions: Object.keys(positionCounts).length,
        totalCandidates: candidates.length,
        totalVoters: activeVoters
      }, { merge: true });

      setElectionResults(results);
      setResultsGenerated(true);
      setPrintMsg(`✅ Results generated and saved! ${results.length} candidates.`);
      setTimeout(() => setPrintMsg(''), 4000);
    } catch (e) {
      setPrintMsg('❌ Error: ' + e.message);
    }
    setPrintLoading(false);
  };

  // Load existing results when entering print view
  const loadExistingResults = async () => {
    setPrintLoading(true);
    try {
      const resultsSnap = await getDoc(doc(db, 'electionData', 'results'));
      if (resultsSnap.exists()) {
        const data = resultsSnap.data();
        if (data.results && data.results.length > 0) {
          setElectionResults(data.results);
          setResultsGenerated(true);
        }
      }
    } catch (e) {
      console.error('Load results error:', e);
    }
    setPrintLoading(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ color: '#FFD700', fontSize: '20px', fontWeight: 'bold' }}>Loading Admin Panel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#003366', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
        <h2 style={{ color: '#ef4444' }}>ERROR</h2>
        <p style={{ color: 'white', textAlign: 'center', maxWidth: '500px' }}>{error}</p>
        <p style={{ color: '#FFD700', fontSize: '14px' }}>Go to Firebase Console → Firestore Database → Create Database → Test Mode → Publish Rules</p>
        <button onClick={loadAllData} style={{ padding: '10px 24px', background: '#FFD700', color: '#003366', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '16px' }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Arial, sans-serif' }}>
      {/* Sidebar overlay */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} />}

      {/* Sidebar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: '250px',
        background: '#001a33', zIndex: 50, padding: '20px 16px',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-260px)',
        transition: 'transform 0.3s ease', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ color: '#FFD700', margin: 0 }}>NAMATLS Admin</h3>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#FFD700', fontSize: '24px', cursor: 'pointer', padding: 0 }}>×</button>
        </div>
        {sidebarItems.map(item => (
          <div key={item.key} onClick={() => { setActiveView(item.key); setSidebarOpen(false); if (item.key === 'print-results') loadExistingResults(); }}
               style={{
                 display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                 marginBottom: '4px', borderRadius: '8px', cursor: 'pointer',
                 background: activeView === item.key ? 'rgba(255,215,0,0.15)' : 'transparent',
                 color: activeView === item.key ? '#FFD700' : 'rgba(255,255,255,0.8)',
                 fontWeight: activeView === item.key ? 'bold' : 'normal'
               }}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
        {/* FIXED: Logout now clears the session token */}
        <button onClick={() => { localStorage.removeItem('adminToken'); navigate('/admin-login'); }}
                style={{ width: '100%', padding: '12px', marginTop: '20px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          Logout
        </button>
      </div>

      {/* Main */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {/* Header */}
        <div style={{ background: '#003366', borderRadius: '12px', padding: '16px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
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

        {/* Dashboard */}
        {activeView === 'dashboard' && (
          <>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>👥</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{candidates.length}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Candidates</div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: '#003366', margin: 0 }}>Quick Actions</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#666' }}>Mode:</span>
                  <span style={{
                    padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold',
                    background: activeMode === 'none' ? '#fee2e2' : '#d1fae5',
                    color: activeMode === 'none' ? '#dc2626' : '#16a34a'
                  }}>
                    {activeMode === 'none' && '○ Inactive'}
                    {activeMode === 'election' && '● Election'}
                    {activeMode === 'formPurchase' && '● Forms'}
                    {activeMode === 'both' && '● Election + Forms'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveView('settings')} style={btnPrimary}>⚙️ Settings</button>
                <button onClick={() => setActiveView('candidates')} style={{ ...btnPrimary, background: '#2563eb' }}>👥 Candidates</button>
                <button onClick={() => setActiveView('activation')} style={{ ...btnPrimary, background: '#8b5cf6' }}>🔘 Activation</button>
                <button onClick={() => setActiveView('results')} style={{ ...btnPrimary, background: '#16a34a' }}>📈 Results</button>
                <button onClick={() => setActiveView('form-purchase')} style={{ ...btnPrimary, background: '#8b5cf6' }}>📋 Form Purchase</button>
                <button onClick={() => setActiveView('withdrawal')} style={{ ...btnPrimary, background: '#f59e0b' }}>💰 Withdraw</button>
              </div>
            </div>
          </>
        )}

        {/* Settings */}
        {activeView === 'settings' && (
          <div style={cardStyle}>
            <h2 style={{ color: '#003366', marginBottom: '16px' }}>⚙️ Election Settings</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Year</label>
                <input value={settings.year} onChange={e => setSettings({...settings, year: e.target.value})} style={inputStyle} placeholder="2026/2027" />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Active</label>
                <select value={settings.isActive ? 'true' : 'false'} onChange={e => setSettings({...settings, isActive: e.target.value === 'true'})} style={inputStyle}>
                  <option value="false">Disabled</option>
                  <option value="true">Active</option>
                </select>
              </div>
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
            <button onClick={handleSaveSettings} style={{ ...btnPrimary, marginTop: '16px' }}>💾 Save</button>
          </div>
        )}

        {/* ===================== ACTIVATION VIEW ===================== */}
        {activeView === 'activation' && (
          <div>
            <div style={cardStyle}>
              <h2 style={{ color: '#003366', marginBottom: '8px' }}>🔘 Activation Control</h2>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
                Control what appears on the StudentDashboard and Form Purchase page.
                {activeMode !== 'none' && (
                  <span style={{ display: 'block', marginTop: '8px', fontSize: '13px', color: '#2563eb', background: '#f0f7ff', padding: '8px 12px', borderRadius: '6px' }}>
                    ⏰ Auto-stop enabled: When end date/time passes, it stops automatically.
                  </span>
                )}
              </p>

              {activationMsg.text && (
                <div style={{
                  padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold',
                  background: activationMsg.type === 'error' ? '#fee2e2' : '#d1fae5',
                  color: activationMsg.type === 'error' ? '#dc2626' : '#16a34a'
                }}>
                  {activationMsg.text}
                </div>
              )}

              <div style={{
                textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px',
                marginBottom: '24px'
              }}>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>Current Mode</div>
                <div style={{
                  padding: '8px 24px', borderRadius: '20px', fontWeight: 'bold', display: 'inline-block', fontSize: '16px',
                  background: activeMode === 'none' ? '#fee2e2' : '#d1fae5',
                  color: activeMode === 'none' ? '#dc2626' : '#16a34a'
                }}>
                  {activeMode === 'none' && '🔴 Nothing Active'}
                  {activeMode === 'election' && '🟢 Election Voting Active'}
                  {activeMode === 'formPurchase' && '🟢 Form Purchase Active'}
                  {activeMode === 'both' && '🟢 Election + Form Purchase Active'}
                </div>
              </div>
            </div>

            {/* Election Card */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', background: '#003366',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'
                }}>🗳️</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 2px 0', color: '#003366' }}>Election</h3>
                  <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>
                    {activeMode === 'election' || activeMode === 'both'
                      ? 'Voting is LIVE on StudentDashboard'
                      : 'Students cannot vote right now'}
                  </p>
                  {settings.endDate && settings.endTime && (
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#888' }}>
                      Auto-stops: {settings.endDate} at {settings.endTime}
                    </p>
                  )}
                </div>
                <div style={{
                  padding: '6px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px',
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

            {/* Form Purchase Card */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', background: '#8b5cf6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'
                }}>📋</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 2px 0', color: '#003366' }}>Form Purchase</h3>
                  <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>
                    {activeMode === 'formPurchase' || activeMode === 'both'
                      ? 'Forms are available for purchase'
                      : 'Form purchase is closed'}
                  </p>
                  {fpClosingDate && fpClosingTime && (
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#888' }}>
                      Auto-stops: {fpClosingDate} at {fpClosingTime}
                    </p>
                  )}
                </div>
                <div style={{
                  padding: '6px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px',
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
                  ✅ This candidate purchased a form. Enter their name, position, and department, then add a manifesto and photo below.
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

        {/* ===================== PRINT RESULTS VIEW ===================== */}
        {activeView === 'print-results' && (
          <div>
            <div style={cardStyle}>
              <h2 style={{ color: '#003366', marginBottom: '8px' }}>🖨️ Print Election Results</h2>
              <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>
                Generate and print official election results. Results include auto-generated Candidate IDs and Vote Points.
              </p>
              {printMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold',
                  background: printMsg.includes('Error') ? '#fee2e2' : '#d1fae5',
                  color: printMsg.includes('Error') ? '#dc2626' : '#16a34a'
                }}>
                  {printMsg}
                </div>
              )}
              {!resultsGenerated ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <p style={{ color: '#888', marginBottom: '16px' }}>
                    {candidates.length === 0
                      ? 'No candidates available to generate results.'
                      : `Click below to generate official results for ${candidates.length} candidates across ${Object.keys(candidates.reduce((acc, c) => { acc[c.position] = true; return acc; }, {})).length} positions.`}
                  </p>
                  <button
                    onClick={handleGenerateResults}
                    disabled={printLoading || candidates.length === 0}
                    style={{
                      ...btnPrimary, background: printLoading ? '#999' : '#16a34a',
                      padding: '14px 40px', fontSize: '16px',
                      opacity: (printLoading || candidates.length === 0) ? 0.5 : 1,
                      cursor: (printLoading || candidates.length === 0) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {printLoading ? '⏳ Generating...' : '📊 Generate Results'}
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <button
                    onClick={() => window.print()}
                    style={{ ...btnPrimary, background: '#2563eb', padding: '14px 40px', fontSize: '16px' }}
                  >
                    🖨️ Print / Download PDF
                  </button>
                  <button
                    onClick={() => { setResultsGenerated(false); setElectionResults([]); }}
                    style={{ ...btnDanger, marginLeft: '12px', padding: '14px 24px', fontSize: '14px' }}
                  >
                    Regenerate
                  </button>
                </div>
              )}
            </div>

            {/* Printable Results Document */}
            {resultsGenerated && electionResults.length > 0 && (
              <div id="printableResults">
                <style>{`
                  @media print {
                    body * { visibility: hidden; }
                    #printableResults, #printableResults * { visibility: visible; }
                    #printableResults { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
                    @page { margin: 15mm; size: A4 portrait; }
                  }
                `}</style>
                <div style={{
                  background: '#001a33',
                  padding: '40px 20px',
                  borderRadius: '12px',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  <div style={{
                    background: 'white',
                    maxWidth: '900px',
                    margin: '0 auto',
                    padding: '40px 35px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                  }}>
                    {/* Logo */}
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      <img
                        src="/logo.png"
                        alt="NAMATL Logo"
                        style={{ width: '80px', height: '80px', objectFit: 'contain' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>

                    {/* Header */}
                    <h1 style={{
                      textAlign: 'center',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: '#001a33',
                      margin: '0 0 4px 0',
                      lineHeight: '1.4',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>
                      FEDERAL UNIVERSITY OF PETROLEUM RESOURCES EFFURUN
                    </h1>
                    <h2 style={{
                      textAlign: 'center',
                      fontSize: '15px',
                      fontWeight: 'bold',
                      color: '#003366',
                      margin: '0 0 20px 0',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      NAMATL VOTE RESULTS {settings.year ? `(${settings.year})` : ''}
                    </h2>

                    <hr style={{ border: '1px solid #003366', marginBottom: '20px' }} />

                    {/* Results Table */}
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '12px',
                      marginBottom: '20px'
                    }}>
                      <thead>
                        <tr style={{ background: '#003366', color: 'white' }}>
                          <th style={{ padding: '10px 8px', border: '1px solid #003366', textAlign: 'center', fontWeight: 'bold' }}>S/N</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #003366', textAlign: 'left', fontWeight: 'bold' }}>Candidate Name</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #003366', textAlign: 'left', fontWeight: 'bold' }}>Position</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #003366', textAlign: 'center', fontWeight: 'bold' }}>Votes</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #003366', textAlign: 'center', fontWeight: 'bold' }}>Vote Point</th>
                          <th style={{ padding: '10px 8px', border: '1px solid #003366', textAlign: 'center', fontWeight: 'bold' }}>Candidate ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {electionResults.map((r, idx) => (
                          <tr key={idx} style={{
                            background: idx % 2 === 0 ? '#f8f9fa' : 'white',
                            borderBottom: '1px solid #dee2e6'
                          }}>
                            <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold' }}>{r.sNo}</td>
                            <td style={{ padding: '8px', border: '1px solid #dee2e6', fontWeight: 'bold', color: '#003366' }}>{r.name}</td>
                            <td style={{ padding: '8px', border: '1px solid #dee2e6', color: '#555' }}>{r.position}</td>
                            <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', color: '#16a34a' }}>{r.votes}</td>
                            <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', color: '#003366' }}>{r.votePoint}</td>
                            <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'center', fontFamily: 'monospace', fontSize: '11px', color: '#666' }}>{r.candidateId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Footer */}
                    <hr style={{ border: '1px solid #003366', marginBottom: '12px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#666' }}>
                      <span>Generated: {new Date().toLocaleDateString('en-GB')}</span>
                      <span>Total Candidates: {electionResults.length}</span>
                      <span>Academic Year: {settings.year || '2026/2027'}</span>
                    </div>

                    <div style={{ marginTop: '16px', fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
                      <p style={{ margin: '2px 0' }}>Vote Point = Candidate's Votes ÷ Total Number of Candidates in that Position</p>
                    </div>

                    {/* Signature lines */}
                    <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <div style={{ textAlign: 'center', width: '40%' }}>
                        <div style={{ borderTop: '1px solid #003366', paddingTop: '6px', marginTop: '30px' }}>
                          Electoral Commission Chairman
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', width: '40%' }}>
                        <div style={{ borderTop: '1px solid #003366', paddingTop: '6px', marginTop: '30px' }}>
                          Departmental Representative
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== PURCHASE LIST VIEW ===================== */}
        {activeView === 'purchase-list' && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: '#003366', margin: 0 }}>🛒 Purchase List</h2>
              <span style={{ fontSize: '12px', color: '#888' }}>
                {formPurchases.length} total purchase(s) | Max 5 per position
              </span>
            </div>
            <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>
              All students who purchased forms — exactly as they filled it on the Form Purchase page. Use this list to register candidates manually.
            </p>
            {formPurchases.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>No purchases yet</p>
            ) : (
              purchaseGroups.map((group, gi) => (
                <div key={gi} style={{ marginBottom: '28px', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ background: '#003366', color: '#FFD700', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '15px' }}>🏛️ {group.position}</strong>
                    <span style={{ fontSize: '12px', opacity: 0.85 }}>{group.purchases.length} purchaser(s)</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f0f7ff', color: '#003366' }}>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>S/N</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Name</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Department</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Level</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Email</th>
                          <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>Amount</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Date</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.purchases.map((p, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px', textAlign: 'center' }}>{i + 1}</td>
                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.fullName || p.name || '—'}</td>
                            <td style={{ padding: '10px', color: '#666' }}>{p.department || p.dept || '—'}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#666' }}>{p.level || '—'}</td>
                            <td style={{ padding: '10px', color: '#666' }}>{p.email || 'Not provided'}</td>
                            <td style={{ padding: '10px', textAlign: 'right', color: '#16a34a', fontWeight: 'bold' }}>₦{Number(p.amount).toLocaleString()}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontSize: '13px', color: '#888' }}>{p.paidAt ? new Date(p.paidAt).toLocaleString() : '—'}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{ background: '#d1fae5', color: '#16a34a', padding: '2px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>Paid</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
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

        {/* ===================== WITHDRAWAL (fixed — no undefined identifiers) ===================== */}
{activeView === 'withdrawal' && (
  <div>
    {/* Balance hero banner */}
    <div style={{
      background: 'linear-gradient(135deg, #003366 0%, #001a33 100%)',
      borderRadius: '16px', padding: '28px 32px', marginBottom: '20px',
      color: 'white', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: -50, right: -40, width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,215,0,0.07)' }} />
      <div style={{ position: 'absolute', bottom: -70, left: -30, width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,215,0,0.05)' }} />
      <div style={{ fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8, marginBottom: '6px' }}>Available Balance</div>
      <div style={{ fontSize: '40px', fontWeight: 'bold', color: '#FFD700', marginBottom: '14px' }}>₦{withdrawalBalance.toLocaleString()}</div>
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px', opacity: 0.92 }}>
        <span>🏦 Beneficiary: <strong>{OPAY_ACCOUNT}</strong> (Opay)</span>
        <span>Min: ₦100</span>
        <span>Max: ₦1,000,000</span>
        <span>🕐 Processing: 1–5 mins</span>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
      {/* Withdraw form */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h2 style={{ color: '#003366', margin: 0 }}>💸 Withdraw Funds</h2>
        </div>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
          Funds are sent to your registered Opay account after Flutterwave confirmation.
        </p>

        <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: '#334155' }}>🛡️ Admin ID</label>
        <input placeholder="Enter Admin ID" value={withdrawAdminId} onChange={e => setWithdrawAdminId(e.target.value)} style={inputStyle} />

        <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: '#334155' }}>🔒 Withdrawal PIN</label>
        <input type="password" placeholder="Enter withdrawal PIN" value={withdrawPin} onChange={e => setWithdrawPin(e.target.value)} style={inputStyle} />

        <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: '#334155' }}>💵 Amount (₦)</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input type="number" placeholder="0.00" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
          <button
            onClick={() => setWithdrawAmount(String(withdrawalBalance))}
            disabled={withdrawBusy || withdrawalBalance <= 0}
            style={{
              padding: '0 16px', background: '#eef2ff', color: '#4338ca',
              border: '1px solid #c7d2fe', borderRadius: '8px', cursor: 'pointer',
              fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap',
              opacity: (withdrawBusy || withdrawalBalance <= 0) ? 0.5 : 1
            }}
          >
            ⚡ All
          </button>
        </div>
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '-4px 0 14px 0' }}>
          Min ₦100 · Max ₦1,000,000 per transfer
        </p>

        <button
          onClick={handleWithdraw}
          disabled={withdrawBusy}
          style={{
            width: '100%', padding: '15px', background: '#f59e0b', color: '#003366',
            border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '16px',
            opacity: withdrawBusy ? 0.6 : 1,
            cursor: withdrawBusy ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(245,158,11,0.35)'
          }}
        >
          {withdrawBusy ? '⏳ Checking Flutterwave...' : '💸 Process Withdrawal'}
        </button>

        {withdrawMsg.text && (
          <div style={{
            padding: '12px 14px', borderRadius: '8px', marginTop: '16px',
            fontWeight: 'bold', fontSize: '13px',
            background: withdrawMsg.type === 'error' ? '#fee2e2' : withdrawMsg.type === 'info' ? '#fef3c7' : '#d1fae5',
            color: withdrawMsg.type === 'error' ? '#dc2626' : withdrawMsg.type === 'info' ? '#b45309' : '#16a34a'
          }}>
            {withdrawMsg.text}
          </div>
        )}
      </div>

      {/* Sidebar: Account Summary / Security / How it works */}
      <div>
        <div style={cardStyle}>
          <h3 style={{ color: '#003366', margin: '0 0 16px 0' }}>📋 Account Summary</h3>
          <div style={{ padding: '12px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#888', fontSize: '13px' }}>Available Balance</span>
            <strong style={{ color: '#16a34a' }}>₦{withdrawalBalance.toLocaleString()}</strong>
          </div>
          <div style={{ padding: '12px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#888', fontSize: '13px' }}>Beneficiary</span>
            <strong style={{ wordBreak: 'break-all', textAlign: 'right' }}>{OPAY_ACCOUNT}</strong>
          </div>
          <div style={{ padding: '12px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#888', fontSize: '13px' }}>Bank</span>
            <strong>Opay</strong>
          </div>
          <div style={{ padding: '12px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#888', fontSize: '13px' }}>Admin ID</span>
            <strong style={{ wordBreak: 'break-all', textAlign: 'right', fontSize: '13px' }}>{ADMIN_ID}</strong>
          </div>
          <div style={{ padding: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#888', fontSize: '13px' }}>Candidates</span>
            <strong>{candidates.length}</strong>
          </div>
        </div>

        <div style={{ ...cardStyle, background: '#fefce8', border: '1px solid #fde68a' }}>
          <h3 style={{ color: '#92400e', margin: '0 0 8px 0', fontSize: '15px' }}>🛡️ Security Notice</h3>
          <p style={{ fontSize: '13px', color: '#78350f', margin: 0, lineHeight: '1.6' }}>
            Withdrawals require your Admin ID and PIN. Funds are only released after Flutterwave confirms the transfer. Keep your PIN private.
          </p>
        </div>

        <div style={cardStyle}>
          <h3 style={{ color: '#003366', margin: '0 0 14px 0' }}>ℹ️ How It Works</h3>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#003366', color: '#FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>1</div>
            <p style={{ margin: 0, fontSize: '13px', color: '#555', lineHeight: '1.5' }}>Enter your Admin ID and withdrawal PIN.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#003366', color: '#FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>2</div>
            <p style={{ margin: 0, fontSize: '13px', color: '#555', lineHeight: '1.5' }}>Enter the amount (min ₦100, max ₦1,000,000) and submit.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#003366', color: '#FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>3</div>
            <p style={{ margin: 0, fontSize: '13px', color: '#555', lineHeight: '1.5' }}>Your balance updates automatically once Flutterwave confirms the transfer.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

        {/* Messages */}
        {activeView === 'messages' && (
          <div style={cardStyle}>
            <h2 style={{ color: '#003366', marginBottom: '16px' }}>✉️ Messages ({supportMessages.length})</h2>
            {supportMessages.length === 0 ? <p style={{ color: '#999', textAlign: 'center' }}>No messages</p> : (
              supportMessages.map(msg => (
                <div key={msg.id} style={{ padding: '16px', borderBottom: '1px solid #eee', background: msg.status === 'unread' ? '#f0f7ff' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div>
                      <strong>{msg.name}</strong>
                      {msg.email && <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>&lt;{msg.email}&gt;</span>}
                    </div>
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      {msg.timestamp?.toDate?.()?.toLocaleString() || ''}
                      {msg.status === 'unread' && <span style={{ background: '#2563eb', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', marginLeft: '8px' }}>New</span>}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 4px 0', color: '#666' }}>{msg.message}</p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {msg.status === 'unread' && (
                      <button onClick={async () => { try { await updateDoc(doc(db, 'supportMessages', msg.id), { status: 'read' }); loadAllData(); } catch(e) {} }}
                              style={{ padding: '4px 10px', background: 'transparent', color: '#2563eb', border: '1px solid #2563eb', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                        Mark Read
                      </button>
                    )}
                    {msg.email && (
                      <a
                        href={`mailto:${msg.email}?subject=${encodeURIComponent('Re: NAMATL Student E-Voting Support')}&body=${encodeURIComponent(
`${generateAutoReply(msg)}`
)}`}
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