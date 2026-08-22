import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataCharge } from '../context/DataChargeContext';
import { adminApi } from '../utils/adminApi';
import UniqueKeyFinder from '../components/UniqueKeyFinder';

const MAX_PER_POSITION = 5;
const MAX_PHOTO_KB = 500; // Max candidate photo size in KB (passport-photo size)
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg'];

// Helper to generate random candidate ID
const generateCandidateId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 7; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'NAMATL-' + id;
};

// ===================== HIGH-PRECISION AUTO-COMPRESS (TARGET: ~499 KB) =====================
// Uses binary-search quality optimization to retain maximum sharpness right up to 499 KB without cutting/cropping
const compressImage = (file, maxKB = 499) => {
  const maxBytes = maxKB * 1024;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Keep maximum native resolution up to 2400px preserving full aspect ratio (no cutting)
      const maxDim = 2400;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const getBlob = (q) => new Promise(res => canvas.toBlob(res, 'image/jpeg', q));

      let minQ = 0.10;
      let maxQ = 0.99;
      let bestBlob = null;

      // 1. If 99% full quality is already under 499 KB, keep full quality
      const fullBlob = await getBlob(0.99);
      if (fullBlob && fullBlob.size <= maxBytes) {
        bestBlob = fullBlob;
      } else {
        // 2. Binary search to find highest quality that stays right at ~480KB–499KB
        for (let i = 0; i < 8; i++) {
          const midQ = (minQ + maxQ) / 2;
          const currentBlob = await getBlob(midQ);
          if (currentBlob && currentBlob.size <= maxBytes) {
            bestBlob = currentBlob;
            minQ = midQ;
          } else {
            maxQ = midQ;
          }
        }
        if (!bestBlob) {
          bestBlob = await getBlob(0.75);
        }
      }

      if (!bestBlob) {
        reject(new Error('Compression failed'));
        return;
      }

      const compressedFile = new File(
        [bestBlob],
        (file.name || 'candidate').replace(/\.[^/.]+$/, '') + '.jpg',
        { type: 'image/jpeg', lastModified: Date.now() }
      );
      resolve(compressedFile);
    };
    img.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
};

// ===================== CLOUDINARY PHOTO UPLOAD =====================
// The browser uploads DIRECTLY to Cloudinary using a short-lived signature
// issued by /api/upload. CLOUDINARY_API_SECRET never leaves the server.
const uploadPhotoToCloudinary = async (file) => {
  // 1) Ask the server for signed upload params (admin JWT required)
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || ''),
    },
    body: JSON.stringify({ folder: 'namatl-candidates' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Upload authorization failed (${res.status})`);
    err.error = data;
    throw err;
  }

  // 2) POST multipart form directly to Cloudinary's public endpoint
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', data.apiKey);
  form.append('timestamp', String(data.timestamp));
  form.append('signature', data.signature);
  form.append('folder', data.folder);

  const cloudRes = await fetch(
    `https://api.cloudinary.com/v1_1/${data.cloudName}/image/upload`,
    { method: 'POST', body: form }
  );
  const cloudData = await cloudRes.json().catch(() => ({}));
  if (!cloudRes.ok) {
    const err = new Error(cloudData.error?.message || `Cloudinary rejected upload (${cloudRes.status})`);
    err.error = cloudData;
    throw err;
  }
  return cloudData.secure_url;
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
  const footer = `\n\nFor further assistance, you may reach out to the Commission during official hours.\n\nYours in service,\nNAMATL Electoral Commission`;

  // Topic-specific replies
  if (isLoginCode) {
    return `${header}Regarding your unique access code for the voting portal, the Electoral Commission has established a secure verification process. Please note:\n\n• Unique voting codes are issued only to registered and eligible students\n• If you have registered, your code was displayed upon completion of registration\n• If you misplaced your code, you can use the "Find Key" feature on the portal or contact the Commission with your full name, matriculation number, and department for identity verification\n• For security reasons, codes are never sent via unverified channels\n\nPlease ensure your student details match the official university register.${footer}`;
  }

  if (isVoting) {
    return `${header}Thank you for your enquiry regarding the voting process. The NAMATL election is conducted electronically through our secure and transparent e-voting platform.\n\nKey information:\n• Each eligible voter must log in using their unique student credentials\n• Voting is only open during the designated election period as announced\n• Each student is entitled to one vote per position\n• The platform ensures secure, encrypted, and anonymous voting\n• Results are tallied automatically and verified by the Electoral Commission\n\nYour participation in the electoral process is duly noted. If you require any clarification on the voting procedure, please refer to the guidelines available on the portal or contact the Commission directly.${footer}`;
  }

  if (isForm) {
    return `${header}With reference to your message concerning form purchase, the NAMATL Electoral Commission provides the following information:\n\n• Nomination forms are available for purchase through the official e-voting portal\n• Payments are processed securely via Flutterwave (credit/debit cards, bank transfers, USSD)\n• After payment, the Commission reviews your details and registers you as a candidate\n• You will be required to upload your manifesto and passport photograph after payment\n• Each position has a specific fee as listed on the Form Purchase page\n• Maximum of five (5) candidates per position\n\nFor specific pricing and position availability, kindly refer to the Form Purchase section on the portal. The Commission will attend to any further inquiries regarding your transaction.${footer}`;
  }

  if (isCandidate) {
    return `${header}Thank you for your interest in contesting for a position in the NAMATL election. We are pleased to inform you of the nomination process:\n\n1. Purchase the nomination form for your desired position through the official portal\n2. Complete the payment via Flutterwave (secured transaction)\n3. After successful payment, provide your details including:\n   - Full name\n   - Position contested\n   - Department\n   - Manifesto (your vision and plans)\n   - Passport photograph\n4. Your candidacy will be reviewed and approved by the Electoral Commission\n5. You will appear on the ballot paper once approved\n\nWe appreciate your enthusiasm and commitment to student leadership. The Commission encourages all qualified students to participate in the democratic process.${footer}`;
  }

  if (isPayment) {
    return `${header}Regarding your enquiry about payment, the NAMATL Electoral Commission uses Flutterwave as our secure payment gateway for all form purchases and transactions.\n\nImportant information:\n• All payments are processed in real-time\n• A confirmation receipt is generated upon successful payment\n• If you encountered an issue during payment, please provide the transaction reference number\n• The Commission will verify the transaction and resolve any discrepancies\n• Refunds, if applicable, are processed within 5–7 business days\n\nPlease allow the Commission some time to investigate your transaction. We will provide you with a detailed update regarding the status of your payment.${footer}`;
  }

  if (isResult) {
    return `${header}Thank you for your interest in the election results. The NAMATL Electoral Commission conducts a transparent and verifiable election process.\n\nRegarding results:\n• Results are officially released immediately after the conclusion of the election period\n• Final results are displayed on the Admin Dashboard and are accessible to authorised personnel\n• The results include the total votes cast per candidate, vote points, and official candidate IDs\n• All results are certified by the Electoral Commission before publication\n\nIf the election has not yet concluded, please note that results will only be made available after voting has ended. The Commission will communicate the official results through the appropriate channels.${footer}`;
  }

  if (isComplaint) {
    return `${header}The Electoral Commission acknowledges receipt of your complaint. We take all issues raised by students very seriously and are committed to ensuring a fair, transparent, and smooth electoral process.\n\nAction being taken:\n• Your complaint has been logged and assigned to the relevant committee\n• A technical/administrative review is currently underway\n• We aim to resolve all reported issues promptly\n• If additional information is needed, a representative of the Commission will contact you\n\nWe appreciate your patience while we investigate and resolve this matter. Thank you for helping us maintain the integrity of our election.${footer}`;
  }

  if (isHelp) {
    return `${header}We are pleased to assist you. The NAMATL Electoral Commission provides comprehensive support to all students participating in the election.\n\nHere are some helpful pointers:\n• Student Registration/Login: Use your valid matriculation number to access the portal\n• Form Purchase: Visit the Form Purchase section to apply for available positions\n• Voting: Cast your vote during the official voting hours on election day\n• Results: View certified results after the election concludes\n\nIf you need specific assistance beyond these guidelines, please provide additional details about your request, and the Commission will be glad to assist you further.${footer}`;
  }

  if (isGeneral) {
    return `${header}Thank you for reaching out to the NAMATL Electoral Commission. We have received your inquiry and wish to provide the following information:\n\n• The Commission is dedicated to conducting free, fair, and credible elections for all NAMATL students\n• All official announcements, timelines, and guidelines are published on this portal\n• For specific inquiries regarding candidates, positions, voting schedules, or results, please refer to the relevant sections of the portal\n\nShould you require further clarification, do not hesitate to send another message with specific details. We will respond at the earliest opportunity.${footer}`;
  }

  // Default professional response
  return `${header}Thank you for reaching out to the NAMATL Electoral Commission. We have received your message and it is currently being reviewed by the Commission.\n\n• Your message reference: #${(msg.id || '').substring(0, 8)}\n• Submitted: ${msg.timestamp ? new Date(msg.timestamp).toLocaleString() : 'Recently'}\n\nA representative of the Electoral Commission will review your inquiry and take appropriate action. If this is an urgent matter regarding the election, please also reach out through our official channels.\n\nWe appreciate your engagement in the NAMATL electoral process.${footer}`;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const {
    withdrawalBalance,
    loadBalance,
    withdraw,
    checkActivationCost,
    processActivationPayment,
    ADMIN_ID,
    OPAY_ACCOUNT
  } = useDataCharge();

  const [activeView, setActiveView] = useState('dashboard');
  const [candidates, setCandidates] = useState([]);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [dept, setDept] = useState('');
  const [manifesto, setManifesto] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [oversizedFile, setOversizedFile] = useState(null);
  const [compressing, setCompressing] = useState(false);

  const [settings, setSettings] = useState({
    year: '', startDate: '', startTime: '', endDate: '', endTime: '', isActive: false
  });

  const [withdrawAdminId, setWithdrawAdminId] = useState('');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMsg, setWithdrawMsg] = useState({ type: '', text: '' });
  const [withdrawBusy, setWithdrawBusy] = useState(false);

  const [supportMessages, setSupportMessages] = useState([]);
  const [activeVoters, setActiveVoters] = useState(0);

  const [activeMode, setActiveMode] = useState('none');
  const [activationMsg, setActivationMsg] = useState({ type: '', text: '' });
  const [activationLoading, setActivationLoading] = useState(false);

  const [printMsg, setPrintMsg] = useState('');
  const [printLoading, setPrintLoading] = useState(false);
  const [electionResults, setElectionResults] = useState([]);
  const [resultsGenerated, setResultsGenerated] = useState(false);

  const [formPurchases, setFormPurchases] = useState([]);
  const [fpOpeningDate, setFpOpeningDate] = useState('');
  const [fpClosingDate, setFpClosingDate] = useState('');
  const [fpOpeningTime, setFpOpeningTime] = useState('');
  const [fpClosingTime, setFpClosingTime] = useState('');
  const [fpPositions, setFpPositions] = useState([]);
  const [newPositionName, setNewPositionName] = useState('');
  const [newPositionAmount, setNewPositionAmount] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpMsg, setFpMsg] = useState({ type: '', text: '' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [checkRef, setCheckRef] = useState('');
  const [checkMsg, setCheckMsg] = useState({ type: '', text: '' });
  const [checkBusy, setCheckBusy] = useState(false);

  const loadActivationSettings = async () => {
    try {
      const mainRes = await adminApi('getMainSettings');
      if (mainRes.data) {
        let currentMode = mainRes.data.activeMode || 'none';

        const now = new Date();

        if (currentMode === 'election' || currentMode === 'both') {
          const electionRes = await adminApi('getElectionSettings');
          if (electionRes.data) {
            const electionData = electionRes.data;
            if (electionData.endDate && electionData.endTime) {
              const endDateTime = new Date(electionData.endDate + 'T' + electionData.endTime);
              if (now >= endDateTime) {
                console.log('[Auto-Stop] Election end time passed. Auto-stopping election.');
                const newMode = currentMode === 'both' ? 'formPurchase' : 'none';
                await adminApi('saveMainSettings', { data: { activeMode: newMode, isActive: false } });
                currentMode = newMode;
              }
            }
          }
        }

        if (currentMode === 'formPurchase' || currentMode === 'both') {
          const fpRes = await adminApi('getFormPurchaseSettings');
          if (fpRes.data) {
            const fpData = fpRes.data;
            if (fpData.closingDate && fpData.closingTime) {
              const closeDateTime = new Date(fpData.closingDate + 'T' + fpData.closingTime);
              if (now >= closeDateTime) {
                console.log('[Auto-Stop] Form purchase end time passed. Auto-stopping form purchase.');
                const newMode = currentMode === 'both' ? 'election' : 'none';
                await adminApi('saveMainSettings', { data: { activeMode: newMode } });
                await adminApi('saveFormPurchaseSettings', { data: { isActive: false } });
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
      await adminApi('saveMainSettings', { data: { activeMode: newMode } });

      if (type === 'election') {
        // Copy election settings into settings/main so StudentDashboard reads them
        const electionRes = await adminApi('getElectionSettings');
        if (electionRes.data) {
          const data = electionRes.data;
          await adminApi('saveMainSettings', {
            data: {
              isActive: true,
              startDate: data.startDate || '',
              startTime: data.startTime || '',
              endDate: data.endDate || '',
              endTime: data.endTime || '',
              year: data.year || ''
            }
          });
        }
      }

      if (type === 'formPurchase') {
        // Activate the formPurchase settings so PurchaseForm.jsx sees isActive: true
        await adminApi('saveFormPurchaseSettings', { data: { isActive: true } });
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

      await adminApi('saveMainSettings', { data: { activeMode: newMode } });

      if (type === 'election') {
        await adminApi('saveMainSettings', { data: { isActive: false } });
      }

      if (type === 'formPurchase') {
        await adminApi('saveFormPurchaseSettings', { data: { isActive: false } });
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
      const [candidatesRes, settingsRes, votersRes, supportRes] = await Promise.all([
        adminApi('listCandidates'),
        adminApi('getElectionSettings').catch(() => ({ data: null })),
        adminApi('listStudents').catch(() => ({ items: [] })),
        adminApi('listSupport').catch(() => ({ items: [] })),
      ]);

      setCandidates(candidatesRes.items || []);
      if (settingsRes.data) {
        setSettings(settingsRes.data);
      }

      const votersList = votersRes.items || [];
      const votedCount = votersList.filter(v => v.hasVoted).length;
      setActiveVoters(votedCount);

      setSupportMessages(supportRes.items || []);

      // Load form purchase settings
      try {
        const fpRes = await adminApi('getFormPurchaseSettings');
        if (fpRes.data) {
          setFpOpeningDate(fpRes.data.openingDate || '');
          setFpClosingDate(fpRes.data.closingDate || '');
          setFpOpeningTime(fpRes.data.openingTime || '');
          setFpClosingTime(fpRes.data.closingTime || '');
          setFpPositions(fpRes.data.positions || []);
        }
      } catch (e) {
        console.log('Form purchase settings load error:', e.message);
      }

      // Load form purchases list
      try {
        const purchasesRes = await adminApi('listFormPurchases');
        setFormPurchases(purchasesRes.items || []);
      } catch (e) {
        console.log('Form purchases load error:', e.message);
      }

      // Load activation status (with auto-stop checks)
      await loadActivationSettings();
      await loadBalance();

    } catch (e) {
      console.error(e);
      setError('Error loading data: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin-login');
  };

  const sortedByVotes = [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));

  // ===================== FORM PURCHASE HANDLERS =====================
  const handleAddFpPosition = () => {
    if (!newPositionName.trim() || !newPositionAmount) {
      setFpMsg({ type: 'error', text: 'Enter both position name and amount' });
      return;
    }
    const exists = fpPositions.some(p => p.position.toLowerCase() === newPositionName.trim().toLowerCase());
    if (exists) {
      setFpMsg({ type: 'error', text: 'This position already exists' });
      return;
    }
    setFpPositions([...fpPositions, { position: newPositionName.trim(), amount: Number(newPositionAmount) }]);
    setNewPositionName('');
    setNewPositionAmount('');
    setFpMsg({ type: '', text: '' });
  };

  const handleRemoveFpPosition = (index) => {
    setFpPositions(fpPositions.filter((_, i) => i !== index));
  };

  const handleSaveFpSettings = async () => {
    if (!fpOpeningDate || !fpClosingDate) {
      setFpMsg({ type: 'error', text: 'Please set opening and closing dates' });
      return;
    }
    if (fpPositions.length === 0) {
      setFpMsg({ type: 'error', text: 'Add at least one position with amount' });
      return;
    }
    setFpLoading(true);
    setFpMsg({ type: '', text: '' });
    try {
      await adminApi('saveFormPurchaseSettings', {
        data: {
          openingDate: fpOpeningDate,
          closingDate: fpClosingDate,
          openingTime: fpOpeningTime,
          closingTime: fpClosingTime,
          positions: fpPositions,
          maxPerPosition: 5,
          isActive: activeMode === 'formPurchase' || activeMode === 'both'
        }
      });
      setFpMsg({ type: 'success', text: '✅ Form purchase settings saved!' });
      setTimeout(() => setFpMsg({ type: '', text: '' }), 4000);
    } catch (e) {
      setFpMsg({ type: 'error', text: 'Error: ' + e.message });
    }
    setFpLoading(false);
  };

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
    try { await adminApi('saveElectionSettings', { data: settings }); alert('✅ Saved!'); }
    catch (e) { alert('Error: ' + e.message); }
  };

 // ===================== PHOTO SELECT (JPG/JPEG only, passport size) =====================
  const handlePhotoSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!ALLOWED_PHOTO_TYPES.includes(f.type)) {
      alert('Only JPG or JPEG files are allowed. Please select a passport photo in JPG format.');
      e.target.value = '';
      setPhoto(null); setPhotoPreview(''); setOversizedFile(null);
      return;
    }
    if (f.size > MAX_PHOTO_KB * 1024) {
      setOversizedFile(f);
      setPhoto(null);
      setPhotoPreview('');
      return;
    }
    setOversizedFile(null);
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const handleAutoCompress = async () => {
    if (!oversizedFile) return;
    setCompressing(true);
    try {
      const compressed = await compressImage(oversizedFile, 499);
      setPhoto(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
      setOversizedFile(null);
    } catch (err) {
      alert('Could not auto-compress photo: ' + err.message);
    } finally {
      setCompressing(false);
    }
  };

  const handleSaveCandidate = async () => {
    if (!name || !position || !dept) { alert('Name, position and dept required'); return; }
    if (photo && (!ALLOWED_PHOTO_TYPES.includes(photo.type) || photo.size > MAX_PHOTO_KB * 1024)) {
      alert(`Photo must be JPG/JPEG and under ${MAX_PHOTO_KB}KB (passport photo size).`);
      return;
    }
    try {
      if (editingCandidate) {
        await adminApi('saveCandidate', { id: editingCandidate.id, data: { name, position, dept, manifesto } });
        // Upload photo if a new one was selected (Cloudinary — signature from /api/upload)
        if (photo) {
          const photoURL = await uploadPhotoToCloudinary(photo);
          await adminApi('saveCandidate', { id: editingCandidate.id, data: { photo: photoURL, photoURL } });
        }
      } else {
        const posCount = candidates.filter(c => c.position === position).length;
        if (posCount >= MAX_PER_POSITION) { alert(`Max ${MAX_PER_POSITION} for ${position}`); return; }
        let photoURL = '';
        if (photo) {
          photoURL = await uploadPhotoToCloudinary(photo);
        }
        await adminApi('saveCandidate', {
          data: { name, position, dept, level: '', email: '', votes: 0, photo: photoURL, photoURL, manifesto, paidForm: false }
        });
      }
      setName(''); setPosition(''); setDept(''); setManifesto('');
      setPhoto(null); setPhotoPreview(''); setOversizedFile(null); setEditingCandidate(null);
      loadAllData();
    } catch (e) { alert('Error: ' + e.message); }
  };

  const handleEditCandidate = (c) => {
    setEditingCandidate(c);
    setName(c.name); setPosition(c.position); setDept(c.dept);
    setManifesto(c.manifesto || '');
    setPhotoPreview(c.photo || '');
    setPhoto(null);
    setOversizedFile(null);
  };

  const handleDeleteCandidate = async (id) => {
    if (!window.confirm('Delete?')) return;
    try { await adminApi('deleteCandidate', { id }); loadAllData(); }
    catch (e) { alert('Error: ' + e.message); }
  };

  // ===================== WITHDRAW (v2: auto-confirm via /api/check-transfer) =====================
  const handleWithdraw = async () => {
    if (!withdrawAdminId || !withdrawPin || !withdrawAmount) {
      setWithdrawMsg({ type: 'error', text: 'Fill all fields' }); return;
    }
    if (withdrawBusy) return;
    setWithdrawBusy(true);
    setWithdrawMsg({ type: '', text: '' });
    try {
      const amt = Number(withdrawAmount);
      const result = await withdraw(withdrawAdminId, withdrawPin, amt);

      if (!result.success && !result.reference) {
        // Plain failure (bad PIN, insufficient balance, Flutterwave rejected)
        setWithdrawMsg({ type: 'error', text: result.message });
        setWithdrawBusy(false);
        return;
      }

      if (result.success) {
        // ✅ Fully confirmed by Flutterwave already
        setWithdrawMsg({ type: 'success', text: result.message });
        setWithdrawAmount('');
        setWithdrawPin('');
        await loadBalance();
        setWithdrawBusy(false);
        return;
      }

      // ⏳ Unverified / pending — Flutterwave accepted the transfer but hasn't
      // confirmed it yet. Poll /api/check-transfer (which asks Flutterwave
      // directly) up to 3 times every 3 seconds to auto-confirm it in real-time.
      const ref = result.reference;
      setWithdrawMsg({ type: 'info', text: '⏳ ' + (result.message || 'Transfer accepted. Confirming with Flutterwave...') });

      let confirmed = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const checkRes = await fetch(`/api/check-transfer?ref=${encodeURIComponent(ref)}`);
          const checkData = await checkRes.json();
          if (checkData.verified) {
            setWithdrawMsg({
              type: 'success',
              text: `✅ CONFIRMED: ₦${amt.toLocaleString()} sent to Opay ${OPAY_ACCOUNT}! Ref: ${ref}`
            });
            setWithdrawAmount('');
            setWithdrawPin('');
            await loadBalance();
            confirmed = true;
            break;
          }
        } catch (e) {
          // Keep trying
        }
      }

      if (!confirmed) {
        // Not confirmed within 9 seconds — the daily cron / webhook will catch it
        setWithdrawMsg({
          type: 'info',
          text: `⏳ Transfer is processing on Flutterwave (Ref: ${ref}). Once confirmed, your balance updates automatically. You can also click "Check Transfer Now" below.`
        });
        setCheckRef(ref); // prefill the manual check box for convenience
        await loadBalance();
      }
    } catch (e) {
      setWithdrawMsg({ type: 'error', text: 'Error: ' + e.message });
    }
    setWithdrawBusy(false);
  };

  // Manual fallback button to ask Flutterwave directly for transfer status
  const handleCheckTransfer = async () => {
    if (!checkRef.trim()) {
      setCheckMsg({ type: 'error', text: 'Enter a transfer reference (e.g. WDR-1234567890-ABC)' });
      return;
    }
    if (checkBusy) return;
    setCheckBusy(true);
    setCheckMsg({ type: '', text: 'Checking with Flutterwave...' });
    try {
      const res = await fetch(`/api/check-transfer?ref=${encodeURIComponent(checkRef.trim())}`);
      const data = await res.json();
      if (data.verified) {
        setCheckMsg({ type: 'success', text: '✅ ' + (data.message || 'Transfer confirmed! Balance updated.') });
        await loadBalance();
      } else {
        setCheckMsg({ type: 'info', text: 'ℹ️ ' + (data.message || 'Transfer still processing on Flutterwave.') });
      }
    } catch (e) {
      setCheckMsg({ type: 'error', text: 'Error checking transfer: ' + e.message });
    }
    setCheckBusy(false);
  };

  // ===================== GENERATE & SAVE ELECTION RESULTS =====================
  const handleGenerateResults = async () => {
    setPrintLoading(true);
    setPrintMsg('');
    try {
      const positionsObj = {};
      candidates.forEach(c => {
        if (!positionsObj[c.position]) positionsObj[c.position] = [];
        positionsObj[c.position].push(c);
      });

      const positionTitles = Object.keys(positionsObj);
      if (positionTitles.length === 0) {
        setPrintMsg('❌ No candidates found to generate results.');
        setPrintLoading(false);
        return;
      }

      let totalOverallVotes = 0;
      candidates.forEach(c => { totalOverallVotes += (c.votes || 0); });

      const generated = [];

      for (const posTitle of positionTitles) {
        const candList = positionsObj[posTitle];
        const sorted = [...candList].sort((a, b) => (b.votes || 0) - (a.votes || 0));

        let posTotalVotes = 0;
        sorted.forEach(c => { posTotalVotes += (c.votes || 0); });

        const processed = sorted.map((cand, idx) => {
          const votes = cand.votes || 0;
          const candidateId = cand.candidateId || generateCandidateId();
          const votePoints = posTotalVotes > 0 ? ((votes / posTotalVotes) * 100).toFixed(1) : '0.0';
          const isWinner = idx === 0 && votes > 0;

          return {
            candidateId,
            name: cand.name,
            position: posTitle,
            department: cand.dept || cand.department || 'N/A',
            votes,
            votePoints: `${votePoints}%`,
            rank: idx + 1,
            isWinner,
            photo: cand.photo || cand.photoURL || ''
          };
        });

        generated.push({
          position: posTitle,
          totalVotes: posTotalVotes,
          candidates: processed
        });
      }

      // Check if results already exist (electionData is denied client-side — read via server)
      const existingResultsRes = await adminApi('getResults').catch(() => ({ data: null }));
      if (existingResultsRes.data && existingResultsRes.data.results) {
        const overwrite = window.confirm('Results already exist for this election. Do you want to overwrite with updated counts?');
        if (!overwrite) {
          setElectionResults(existingResultsRes.data.results);
          setResultsGenerated(true);
          setPrintLoading(false);
          return;
        }
      }

      for (const group of generated) {
        for (const cand of group.candidates) {
          const match = candidates.find(c => c.name === cand.name && c.position === cand.position);
          if (match && !match.candidateId) {
            try {
              await adminApi('saveCandidate', {
                id: match.id,
                data: { candidateId: cand.candidateId }
              });
            } catch (e) {
              console.log('Error saving candidate ID:', e);
            }
          }
        }
      }

      const resultsPayload = {
        year: settings.year || '2026/2027',
        totalVoters: activeVoters,
        totalVotesCast: totalOverallVotes,
        totalCandidates: candidates.length,
        totalPositions: positionTitles.length,
        generatedAt: new Date().toISOString(),
        results: generated
      };

      await adminApi('saveResults', { data: resultsPayload });

      setElectionResults(generated);
      setResultsGenerated(true);
      setPrintMsg('✅ Election results generated and saved securely!');
      setTimeout(() => setPrintMsg(''), 5000);

    } catch (e) {
      console.error(e);
      setPrintMsg('❌ Error generating results: ' + e.message);
    }
    setPrintLoading(false);
  };

  const loadSavedResults = async () => {
    try {
      const resultsRes = await adminApi('getResults');
      if (resultsRes.data && resultsRes.data.results) {
        setElectionResults(resultsRes.data.results);
        setResultsGenerated(true);
      }
    } catch (e) {
      console.log('Could not load saved results:', e);
    }
  };

  useEffect(() => {
    if (activeView === 'print-results') {
      loadSavedResults();
    }
  }, [activeView]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#003366', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <h2>Loading...</h2>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Arial, sans-serif', background: '#f5f7fa' }}>

      {/* Sidebar */}
      <div style={{ width: '260px', background: '#003366', color: 'white', padding: '24px 16px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <h2 style={{ color: '#FFD700', margin: '0 0 4px 0', fontSize: '20px' }}>🏛️ NAMATL ADMIN</h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 24px 0' }}>Election Control Panel</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <button onClick={() => setActiveView('dashboard')} style={{ ...btnPrimary, background: activeView === 'dashboard' ? '#FFD700' : 'transparent', color: activeView === 'dashboard' ? '#003366' : 'white', textAlign: 'left' }}>📊 Dashboard</button>
          <button onClick={() => setActiveView('candidates')} style={{ ...btnPrimary, background: activeView === 'candidates' ? '#FFD700' : 'transparent', color: activeView === 'candidates' ? '#003366' : 'white', textAlign: 'left' }}>👥 Candidates ({candidates.length})</button>
          <button onClick={() => setActiveView('settings')} style={{ ...btnPrimary, background: activeView === 'settings' ? '#FFD700' : 'transparent', color: activeView === 'settings' ? '#003366' : 'white', textAlign: 'left' }}>⚙️ Settings</button>
          <button onClick={() => setActiveView('activation')} style={{ ...btnPrimary, background: activeView === 'activation' ? '#FFD700' : 'transparent', color: activeView === 'activation' ? '#003366' : 'white', textAlign: 'left' }}>🔘 Activation</button>
          <button onClick={() => setActiveView('form-purchase')} style={{ ...btnPrimary, background: activeView === 'form-purchase' ? '#FFD700' : 'transparent', color: activeView === 'form-purchase' ? '#003366' : 'white', textAlign: 'left' }}>📋 Form Purchase</button>
          <button onClick={() => setActiveView('find-key')} style={{ ...btnPrimary, background: activeView === 'find-key' ? '#FFD700' : 'transparent', color: activeView === 'find-key' ? '#003366' : 'white', textAlign: 'left' }}>🔑 Unique Key Finder</button>
          <button onClick={() => setActiveView('results')} style={{ ...btnPrimary, background: activeView === 'results' ? '#FFD700' : 'transparent', color: activeView === 'results' ? '#003366' : 'white', textAlign: 'left' }}>📈 Results</button>
          <button onClick={() => setActiveView('print-results')} style={{ ...btnPrimary, background: activeView === 'print-results' ? '#FFD700' : 'transparent', color: activeView === 'print-results' ? '#003366' : 'white', textAlign: 'left' }}>🖨️ Print Results</button>
          <button onClick={() => setActiveView('withdrawal')} style={{ ...btnPrimary, background: activeView === 'withdrawal' ? '#FFD700' : 'transparent', color: activeView === 'withdrawal' ? '#003366' : 'white', textAlign: 'left' }}>💰 Withdrawal</button>
          <button onClick={() => setActiveView('support')} style={{ ...btnPrimary, background: activeView === 'support' ? '#FFD700' : 'transparent', color: activeView === 'support' ? '#003366' : 'white', textAlign: 'left' }}>💬 Support ({supportMessages.filter(m => m.status === 'unread').length})</button>
        </div>
        <button onClick={handleLogout} style={{ ...btnDanger, marginTop: 'auto' }}>🚪 Logout</button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>⚠️ {error}</div>}

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ color: '#003366', margin: 0, textTransform: 'capitalize' }}>{activeView.replace('-', ' ')}</h1>
            <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0 0' }}>Year: {settings.year || '2026/2027'} | Status: {activeMode !== 'none' ? '🟢 Active' : '🔴 Inactive'}</p>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Academic Year</label>
                <input placeholder="e.g. 2026/2027" value={settings.year} onChange={e => setSettings({...settings, year: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Status</label>
                <select value={settings.isActive ? 'true' : 'false'} onChange={e => setSettings({...settings, isActive: e.target.value === 'true'})} style={inputStyle}>
                  <option value="false">Inactive</option>
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

              {/* Current Mode Banner */}
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
                  width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'
                }}>🗳️</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 4px 0', color: '#003366' }}>Election Voting Mode</h3>
                  <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>
                    Controls whether students can see candidates and vote on the StudentDashboard.
                  </p>
                </div>
                <span style={{
                  padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold',
                  background: (activeMode === 'election' || activeMode === 'both') ? '#d1fae5' : '#fee2e2',
                  color: (activeMode === 'election' || activeMode === 'both') ? '#16a34a' : '#dc2626'
                }}>
                  {(activeMode === 'election' || activeMode === 'both') ? '● Active' : '○ Stopped'}
                </span>
              </div>

              <div style={{
                background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
                fontSize: '13px', color: '#555'
              }}>
                <strong>Current Settings:</strong>
                <span style={{ marginLeft: '8px' }}>
                  {settings.startDate ? `${settings.startDate} (${settings.startTime || '00:00'})` : 'No start date'}
                  {' → '}
                  {settings.endDate ? `${settings.endDate} (${settings.endTime || '23:59'})` : 'No end date'}
                </span>
                <span style={{ marginLeft: '12px', color: '#2563eb' }}>
                  Year: {settings.year || '2026/2027'}
                </span>
              </div>

              {/* Prerequisites check */}
              <div style={{
                background: '#fff', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px',
                marginBottom: '16px', fontSize: '13px'
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
                  {activationLoading ? '⏳...' : '🔴 Stop'}
                </button>
              </div>
            </div>

            {/* Form Purchase Card */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', background: '#f5f3ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'
                }}>📋</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 4px 0', color: '#003366' }}>Form Purchase Mode</h3>
                  <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>
                    Controls whether candidates can purchase forms on the Form Purchase page.
                  </p>
                </div>
                <span style={{
                  padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold',
                  background: (activeMode === 'formPurchase' || activeMode === 'both') ? '#d1fae5' : '#fee2e2',
                  color: (activeMode === 'formPurchase' || activeMode === 'both') ? '#16a34a' : '#dc2626'
                }}>
                  {(activeMode === 'formPurchase' || activeMode === 'both') ? '● Active' : '○ Stopped'}
                </span>
              </div>

              <div style={{
                background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
                fontSize: '13px', color: '#555'
              }}>
                <strong>Current Settings:</strong>
                <span style={{ marginLeft: '8px' }}>
                  {fpOpeningDate ? `${fpOpeningDate} (${fpOpeningTime || '00:00'})` : 'No opening date'}
                  {' → '}
                  {fpClosingDate ? `${fpClosingDate} (${fpClosingTime || '23:59'})` : 'No closing date'}
                </span>
                <span style={{ marginLeft: '12px', color: '#2563eb' }}>
                  {fpPositions.length} position(s) configured
                </span>
              </div>

              {/* Prerequisites check */}
              <div style={{
                background: '#fff', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px',
                marginBottom: '16px', fontSize: '13px'
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
                  {activationLoading ? '⏳...' : '🔴 Stop'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Candidates View */}
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
          <label style={labelStyle}>Candidate Photo (JPG/JPEG, max 500KB):</label>
              <input
                type="file"
                accept=".jpg,.jpeg,image/jpeg"
                onChange={handlePhotoSelect}
                style={{ marginBottom: '8px', display: 'block' }}
              />

              {/* ⚠️ Oversized Notice + ⚡ High-Precision Auto-Size Button */}
              {oversizedFile && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  margin: '10px 0',
                  fontSize: '13px'
                }}>
                  <div style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '4px' }}>
                    ⚠️ Photo is too large: {(oversizedFile.size / 1024).toFixed(0)} KB (Maximum allowed is {MAX_PHOTO_KB} KB)
                  </div>
                  <p style={{ color: '#64748b', margin: '0 0 8px 0', fontSize: '12px' }}>
                    Click below to automatically optimize this photo to ~499 KB while preserving 100% full aspect ratio and image clarity without any cutting:
                  </p>
                  <button
                    type="button"
                    onClick={handleAutoCompress}
                    disabled={compressing}
                    style={{
                      ...btnPrimary,
                      background: '#2563eb',
                      padding: '8px 16px',
                      fontSize: '13px',
                      cursor: compressing ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {compressing ? '⏳ Auto-sizing photo...' : '⚡ Click to Auto-Size Photo (<500 KB)'}
                  </button>
                </div>
              )}

              {photo && photoPreview && (
                <div style={{ margin: '10px 0' }}>
                  <div style={{ fontSize: '13px', color: '#15803d', background: '#dcfce7', padding: '6px 12px', borderRadius: '6px', marginBottom: '8px', display: 'inline-block' }}>
                    ✅ Ready: {photo.name} ({(photo.size / 1024).toFixed(0)} KB)
                  </div>
                  <div>
                    <img src={photoPreview} alt="" style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #cbd5e1', display: 'block' }} />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={handleSaveCandidate} style={btnSuccess}>{editingCandidate ? '✏️ Update' : '➕ Add'}</button>
                {editingCandidate && <button onClick={() => { setEditingCandidate(null); setName(''); setPosition(''); setDept(''); setManifesto(''); setPhoto(null); setPhotoPreview(''); setOversizedFile(null); }} style={btnDanger}>Cancel</button>}
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
              <div id="printable-results" style={{
                background: 'white', padding: '32px', borderRadius: '12px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)', color: '#000'
              }}>
                <div style={{ textAlign: 'center', borderBottom: '3px solid #003366', paddingBottom: '16px', marginBottom: '24px' }}>
                  <h1 style={{ color: '#003366', margin: '0 0 6px 0', fontSize: '24px', letterSpacing: '1px' }}>
                    NATIONAL ASSOCIATION OF MARITIME TRANSPORT AND LOGISTICS STUDENTS
                  </h1>
                  <h2 style={{ color: '#888', margin: '0 0 6px 0', fontSize: '16px', fontWeight: 'normal' }}>
                    FEDERAL UNIVERSITY OF PETROLEUM RESOURCES, EFFURUN
                  </h2>
                  <h3 style={{ color: '#003366', margin: '8px 0 0 0', fontSize: '18px' }}>
                    OFFICIAL ELECTION RESULTS — {settings.year || '2026/2027'} ACADEMIC SESSION
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px', fontSize: '13px', color: '#555' }}>
                    <span>Total Voters: <strong>{activeVoters}</strong></span>
                    <span>Total Candidates: <strong>{candidates.length}</strong></span>
                    <span>Generated: {new Date().toLocaleDateString('en-GB')}</span>
                  </div>
                </div>

                {electionResults.map((group, gIdx) => (
                  <div key={gIdx} style={{ marginBottom: '32px' }}>
                    <div style={{
                      background: '#003366', color: 'white', padding: '10px 16px',
                      borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: '12px'
                    }}>
                      <h3 style={{ margin: 0, fontSize: '16px' }}>🏆 {group.position}</h3>
                      <span style={{ fontSize: '13px', opacity: 0.9 }}>Total Votes Cast: {group.totalVotes}</span>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Rank</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Candidate ID</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Full Name</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Department</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Votes</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Vote Points</th>
                          <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.candidates.map((c) => (
                          <tr key={c.candidateId} style={{
                            borderBottom: '1px solid #e2e8f0',
                            background: c.isWinner ? '#f0fdf4' : 'transparent'
                          }}>
                            <td style={{ padding: '10px', fontWeight: 'bold' }}>
                              {c.rank === 1 ? '🥇 1st' : c.rank === 2 ? '🥈 2nd' : c.rank === 3 ? '🥉 3rd' : `${c.rank}th`}
                            </td>
                            <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                              {c.candidateId}
                            </td>
                            <td style={{ padding: '10px', fontWeight: c.isWinner ? 'bold' : 'normal' }}>
                              {c.name}
                            </td>
                            <td style={{ padding: '10px', color: '#666' }}>{c.department}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '15px' }}>
                              {c.votes}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#2563eb' }}>
                              {c.votePoints}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              {c.isWinner ? (
                                <span style={{
                                  background: '#16a34a', color: 'white', padding: '3px 10px',
                                  borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px'
                                }}>
                                  ELECTED
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                <div style={{
                  marginTop: '40px', paddingTop: '24px', borderTop: '2px solid #003366',
                  display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#555'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '180px', borderBottom: '1px solid #999', marginBottom: '6px', height: '30px' }}></div>
                    <div>Electoral Chairman</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '180px', borderBottom: '1px solid #999', marginBottom: '6px', height: '30px' }}></div>
                    <div>Staff Adviser</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '180px', borderBottom: '1px solid #999', marginBottom: '6px', height: '30px' }}></div>
                    <div>Head of Department</div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '11px', color: '#94a3b8' }}>
                  Certified by NAMATL Electoral Commission • Official Electronic Result Certificate
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== FORM PURCHASE MANAGEMENT ===================== */}
        {activeView === 'form-purchase' && (
          <div>
            <div style={cardStyle}>
              <h2 style={{ color: '#003366', marginBottom: '8px' }}>📋 Form Purchase Configuration</h2>
              <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>
                Set opening/closing dates, times, and amounts for nomination forms. Maximum of 5 candidates per position.
              </p>

              {fpMsg.text && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold',
                  background: fpMsg.type === 'error' ? '#fee2e2' : '#d1fae5',
                  color: fpMsg.type === 'error' ? '#dc2626' : '#16a34a'
                }}>
                  {fpMsg.text}
                </div>
              )}

              {/* Date & Time Settings */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Opening Date</label>
                  <input type="date" value={fpOpeningDate} onChange={e => setFpOpeningDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Opening Time</label>
                  <input type="time" value={fpOpeningTime} onChange={e => setFpOpeningTime(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Closing Date</label>
                  <input type="date" value={fpClosingDate} onChange={e => setFpClosingDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Closing Time</label>
                  <input type="time" value={fpClosingTime} onChange={e => setFpClosingTime(e.target.value)} style={inputStyle} />
                </div>
              </div>

              {/* Position and Amount Configuration */}
              <h3 style={{ color: '#003366', fontSize: '15px', marginBottom: '12px' }}>Positions & Pricing (Max 5 Candidates Each)</h3>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <input
                  placeholder="Position Name (e.g. President)"
                  value={newPositionName}
                  onChange={e => setNewPositionName(e.target.value)}
                  style={{ ...inputStyle, flex: 2, minWidth: '200px', marginBottom: 0 }}
                />
                <input
                  type="number"
                  placeholder="Amount (₦)"
                  value={newPositionAmount}
                  onChange={e => setNewPositionAmount(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: '140px', marginBottom: 0 }}
                />
                <button onClick={handleAddFpPosition} style={{ ...btnPrimary, background: '#16a34a', padding: '12px 20px' }}>
                  ➕ Add
                </button>
              </div>

              {/* Positions List */}
              {fpPositions.length === 0 ? (
                <p style={{ color: '#888', fontSize: '13px', padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
                  No positions configured yet. Add positions above.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {fpPositions.map((pos, idx) => (
                    <div key={idx} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'
                    }}>
                      <div>
                        <strong>{pos.position}</strong>
                        <span style={{ marginLeft: '12px', color: '#16a34a', fontWeight: 'bold' }}>₦{Number(pos.amount).toLocaleString()}</span>
                      </div>
                      <button onClick={() => handleRemoveFpPosition(idx)} style={{ ...btnDanger, padding: '4px 10px', fontSize: '12px' }}>
                        ✕ Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleSaveFpSettings}
                disabled={fpLoading}
                style={{ ...btnPrimary, opacity: fpLoading ? 0.6 : 1 }}
              >
                {fpLoading ? '💾 Saving...' : '💾 Save Form Purchase Settings'}
              </button>
            </div>

            {/* Purchased Forms List */}
            <div style={cardStyle}>
              <h2 style={{ color: '#003366', marginBottom: '16px' }}>📥 Candidates Who Purchased Forms ({formPurchases.length})</h2>
              {formPurchases.length === 0 ? (
                <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>No form purchases recorded yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ background: '#003366', color: 'white' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Candidate Name</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Position</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Department</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Level</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Amount Paid</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formPurchases.map((p, idx) => (
                        <tr key={p.id || idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px' }}>{idx + 1}</td>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.candidateName}</td>
                          <td style={{ padding: '10px', color: '#2563eb', fontWeight: 'bold' }}>{p.position}</td>
                          <td style={{ padding: '10px' }}>{p.department || '—'}</td>
                          <td style={{ padding: '10px' }}>{p.level || '—'}</td>
                          <td style={{ padding: '10px', textAlign: 'center', color: '#16a34a', fontWeight: 'bold' }}>
                            ₦{Number(p.amount || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center', fontSize: '13px', color: '#888' }}>
                            {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'N/A'}
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

        {/* Unique Key Finder */}
        {activeView === 'find-key' && (
          <UniqueKeyFinder />
        )}

        {/* Withdrawal */}
        {activeView === 'withdrawal' && (
          <div style={cardStyle}>
            <h2 style={{ color: '#003366', marginBottom: '8px' }}>💰 Withdrawal to Opay</h2>
            <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>
              Withdraw election funds to your registered Opay account.
            </p>

            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px',
              padding: '20px', marginBottom: '24px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '13px', color: '#15803d', marginBottom: '4px' }}>Available Balance</div>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#15803d' }}>
                ₦{withdrawalBalance.toLocaleString()}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
                Registered Opay Account: <strong>{OPAY_ACCOUNT}</strong>
              </div>
            </div>

            {withdrawMsg.text && (
              <div style={{
                padding: '12px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold',
                background: withdrawMsg.type === 'error' ? '#fee2e2' : withdrawMsg.type === 'info' ? '#eff6ff' : '#d1fae5',
                color: withdrawMsg.type === 'error' ? '#dc2626' : withdrawMsg.type === 'info' ? '#1d4ed8' : '#16a34a'
              }}>
                {withdrawMsg.text}
              </div>
            )}

            <div style={{ maxWidth: '480px' }}>
              <label style={labelStyle}>Admin ID:</label>
              <input
                placeholder="Enter Admin ID"
                value={withdrawAdminId}
                onChange={e => setWithdrawAdminId(e.target.value)}
                style={inputStyle}
                disabled={withdrawBusy}
              />
              <label style={labelStyle}>Admin 4-Digit PIN:</label>
              <input
                type="password"
                placeholder="••••"
                maxLength={4}
                value={withdrawPin}
                onChange={e => setWithdrawPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={inputStyle}
                disabled={withdrawBusy}
              />
              <label style={labelStyle}>Amount (₦):</label>
              <input
                type="number"
                placeholder="Amount to withdraw"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                style={inputStyle}
                disabled={withdrawBusy}
              />

              <button
                onClick={handleWithdraw}
                disabled={withdrawBusy || withdrawalBalance <= 0}
                style={{
                  ...btnSuccess, width: '100%', padding: '14px', fontSize: '16px',
                  opacity: (withdrawBusy || withdrawalBalance <= 0) ? 0.6 : 1,
                  cursor: (withdrawBusy || withdrawalBalance <= 0) ? 'not-allowed' : 'pointer'
                }}
              >
                {withdrawBusy ? '⏳ Processing Withdrawal...' : '💸 Process Withdrawal'}
              </button>

              <div style={{
                marginTop: '16px', padding: '12px', background: '#f8fafc',
                borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#64748b'
              }}>
                🔒 <strong>Secure Transfer:</strong> Withdrawals require Admin credentials and are sent directly to your registered Opay account via Flutterwave.
              </div>
            </div>

            {/* Manual Check Transfer Section */}
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e2e8f0', maxWidth: '480px' }}>
              <h3 style={{ color: '#003366', fontSize: '15px', marginBottom: '6px' }}>🔎 Check Pending Transfer Status</h3>
              <p style={{ color: '#666', fontSize: '12px', margin: '0 0 12px 0' }}>
                If a withdrawal was accepted but didn't confirm immediately, enter its Reference number here to ask Flutterwave directly.
              </p>
              <input
                placeholder="e.g. WDR-1234567890-ABC"
                value={checkRef}
                onChange={e => setCheckRef(e.target.value)}
                style={inputStyle}
                disabled={checkBusy}
              />
              <button
                onClick={handleCheckTransfer}
                disabled={checkBusy}
                style={{ ...btnPrimary, background: '#2563eb', padding: '10px 20px', fontSize: '13px' }}
              >
                {checkBusy ? '⏳ Checking Flutterwave...' : '🔎 Check Transfer Now'}
              </button>
              {checkMsg.text && (
                <div style={{
                  marginTop: '12px', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
                  background: checkMsg.type === 'error' ? '#fee2e2' : checkMsg.type === 'info' ? '#eff6ff' : '#d1fae5',
                  color: checkMsg.type === 'error' ? '#dc2626' : checkMsg.type === 'info' ? '#1d4ed8' : '#16a34a'
                }}>
                  {checkMsg.text}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Support */}
        {activeView === 'support' && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: '#003366', margin: 0 }}>💬 Support Messages ({supportMessages.length})</h2>
              <span style={{ fontSize: '12px', color: '#888' }}>
                {supportMessages.filter(m => m.status === 'unread').length} unread
              </span>
            </div>
            {supportMessages.length === 0 ? <p style={{ color: '#999', textAlign: 'center' }}>No messages yet</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {supportMessages.map(msg => (
                  <div key={msg.id} style={{
                    padding: '16px', borderRadius: '8px', border: '1px solid #eee',
                    background: msg.status === 'unread' ? '#f0f7ff' : '#fafafa'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong>{msg.name} ({msg.matric || 'No matric'})</strong>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#888' }}>
                          {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
                        </span>
                        {msg.status === 'unread' && (
                          <span style={{ background: '#2563eb', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>New</span>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: '0 0 12px 0', color: '#333', fontSize: '14px', lineHeight: '1.5' }}>{msg.message}</p>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', fontSize: '13px' }}>
                      <div style={{ fontWeight: 'bold', color: '#003366', marginBottom: '4px' }}>🤖 Suggested Response:</div>
                      <div style={{ whiteSpace: 'pre-wrap', color: '#475569', lineHeight: '1.5' }}>{generateAutoReply(msg)}</div>
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                      <button
                        onClick={async () => {
                          try {
                            await adminApi('markSupportRead', { id: msg.id });
                            loadAllData();
                          } catch (e) {}
                        }}
                        style={{ ...btnPrimary, background: '#2563eb', padding: '6px 12px', fontSize: '12px' }}
                      >
                        ✓ Mark as Read
                      </button>
                      <button
                        onClick={async () => {
                          if (!window.confirm('Delete message?')) return;
                          try {
                            await adminApi('deleteSupport', { id: msg.id });
                            loadAllData();
                          } catch (e) {}
                        }}
                        style={{ ...btnDanger, padding: '6px 12px', fontSize: '12px' }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
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