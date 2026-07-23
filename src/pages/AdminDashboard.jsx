import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useDataCharge } from '../context/DataChargeContext'; // KEEP for withdraw + activation

const MAX_PER_POSITION = 5;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { withdrawalBalance, withdraw, checkActivationCost, processActivationPayment, ADMIN_ID, WITHDRAWAL_PIN, OPAY_ACCOUNT, formPurchaseSettings, saveFormPurchaseSettings, formPurchases, loadFormPurchases } = useDataCharge();

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');

  // Loading & error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Candidates
  const [candidates, setCandidates] = useState([]);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [dept, setDept] = useState('');
  const [manifesto, setManifesto] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [editingCandidate, setEditingCandidate] = useState(null);

  // Settings
  const [settings, setSettings] = useState({
    year: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    isActive: false
  });

  // Withdrawal
  const [withdrawAdminId, setWithdrawAdminId] = useState('');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMsg, setWithdrawMsg] = useState({ type: '', text: '' });

  // General settings
  const [siteName, setSiteName] = useState('NAMATL STUDENT E-VOTING');
  const [maxPerPosition, setMaxPerPosition] = useState(MAX_PER_POSITION);

  // Support messages
  const [supportMessages, setSupportMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadData();
    loadSupportMessages();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const candSnap = await getDocs(collection(db, 'candidates'));
      setCandidates(candSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const settingsSnap = await getDocs(collection(db, 'settings'));
      if (settingsSnap.docs.length > 0) setSettings(settingsSnap.docs[0].data());
    } catch (e) {
      setError('FAILED TO LOAD: ' + e.message);
    }
    setLoading(false);
  };

  const loadSupportMessages = async () => {
    try {
      const msgSnap = await getDocs(collection(db, 'supportMessages'));
      const msgs = msgSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSupportMessages(msgs);
      setUnreadCount(msgs.filter(m => m.status === 'unread').length);
    } catch (e) {
      console.log('Could not load support messages:', e.message);
    }
  };

  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, 'supportMessages', id), { status: 'read' });
      loadSupportMessages();
    } catch (e) {
      console.log('Could not mark as read:', e.message);
    }
  };

  // Candidate functions
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const getCountForPosition = (pos) => candidates.filter(c => c.position === pos).length;

  const isPositionFull = (pos) => getCountForPosition(pos) >= MAX_PER_POSITION;

  const positionsList = [...new Set(candidates.map(c => c.position))];

  const saveCandidate = async () => {
    if (!name || !position) { alert('Name and Position required'); return; }
    if (isPositionFull(position) && !editingCandidate) { alert(`"${position}" is full (max ${MAX_PER_POSITION})`); return; }
    try {
      let photoURL = '';
      if (photo) {
        const storageRef = ref(storage, `candidates/${Date.now()}_${photo.name}`);
        await uploadBytes(storageRef, photo);
        photoURL = await getDownloadURL(storageRef);
      }
      if (editingCandidate) {
        await setDoc(doc(db, 'candidates', editingCandidate.id), {
          name, position, dept, manifesto,
          photoURL: photoURL || editingCandidate.photoURL || ''
        });
      } else {
        await addDoc(collection(db, 'candidates'), {
          name, position, dept, manifesto, photoURL, votes: 0
        });
      }
      setName(''); setPosition(''); setDept(''); setManifesto(''); setPhoto(null); setPhotoPreview(''); setEditingCandidate(null);
      loadData();
      alert(editingCandidate ? 'Updated!' : 'Added!');
    } catch (e) { alert('FAILED: ' + e.message); }
  };

  const editCandidate = (c) => {
    setEditingCandidate(c);
    setName(c.name);
    setPosition(c.position);
    setDept(c.dept || '');
    setManifesto(c.manifesto || '');
    setPhotoPreview(c.photoURL || '');
    setActiveView('candidates');
  };

  const deleteCandidate = async (id, photoURL) => {
    if (!window.confirm('Delete this candidate?')) return;
    try {
      if (photoURL) { try { await deleteObject(ref(storage, photoURL)); } catch (_) {} }
      await deleteDoc(doc(db, 'candidates', id));
      loadData();
    } catch (e) { alert('FAILED: ' + e.message); }
  };

  // Election settings
  const handleSaveSettings = async () => {
    if (!settings.year || !settings.startDate || !settings.startTime || !settings.endDate || !settings.endTime) {
      alert('Fill all fields');
      return;
    }

    // Check activation cost
    const costCheck = await checkActivationCost(settings.year);

    if (costCheck.free) {
      // Free activation for 2026/2027
      try {
        await setDoc(doc(db, 'settings', 'main'), { ...settings, isActive: true });
        alert('Election activated for FREE (2026/2027)!');
        loadData();
      } catch (e) { alert('FAILED: ' + e.message); }
    } else if (costCheck.canActivate) {
      if (window.confirm(costCheck.message)) {
        const payment = await processActivationPayment(settings.year);
        if (payment.success) {
          try {
            await setDoc(doc(db, 'settings', 'main'), { ...settings, isActive: true });
            alert(`Election activated! ${payment.message}`);
            loadData();
          } catch (e) { alert('FAILED: ' + e.message); }
        } else {
          alert(payment.message);
        }
      }
    } else {
      alert(costCheck.message);
    }
  };

  const toggleElection = async () => {
    try {
      await setDoc(doc(db, 'settings', 'main'), { ...settings, isActive: !settings.isActive });
      loadData();
    } catch (e) { alert('FAILED: ' + e.message); }
  };

  const deleteAllElectionData = async () => {
    if (!window.confirm('Delete ALL election data?')) return;
    try {
      const candSnap = await getDocs(collection(db, 'candidates'));
      for (const d of candSnap.docs) {
        if (d.data().photoURL) { try { await deleteObject(ref(storage, d.data().photoURL)); } catch (_) {} }
        await deleteDoc(doc(db, 'candidates', d.id));
      }
      await setDoc(doc(db, 'settings', 'main'), { year: '', startDate: '', startTime: '', endDate: '', endTime: '', isActive: false });
      loadData();
      alert('Cleared!');
    } catch (e) { alert('FAILED: ' + e.message); }
  };

  const clearAllVotes = async () => {
    if (!window.confirm('Clear ALL votes?')) return;
    try {
      const candSnap = await getDocs(collection(db, 'candidates'));
      for (const d of candSnap.docs) {
        await updateDoc(doc(db, 'candidates', d.id), { votes: 0 });
      }
      loadData();
      alert('Votes cleared!');
    } catch (e) { alert('FAILED: ' + e.message); }
  };

  // Withdrawal
  const handleWithdraw = async () => {
    const result = await withdraw(withdrawAdminId, withdrawPin, parseInt(withdrawAmount));
    setWithdrawMsg({ type: result.success ? 'success' : 'error', text: result.message });
    if (result.success) {
      setWithdrawAdminId('');
      setWithdrawPin('');
      setWithdrawAmount('');
    }
    setTimeout(() => setWithdrawMsg({ type: '', text: '' }), 5000);
  };

  // Computed values
  const totalVotes = candidates.reduce((s, c) => s + (c.votes || 0), 0);
  const startDateTime = settings.startDate && settings.startTime ? new Date(settings.startDate + 'T' + settings.startTime) : null;
  const endDateTime = settings.endDate && settings.endTime ? new Date(settings.endDate + 'T' + settings.endTime) : null;
  const now = new Date();
  const isElectionStarted = startDateTime ? now >= startDateTime : false;
  const isElectionEnded = endDateTime ? now >= endDateTime : false;

  const getElectionPhase = () => {
    if (!settings.isActive) return { label: 'INACTIVE', color: '#6b7280' };
    if (!settings.startDate) return { label: 'NOT CONFIGURED', color: '#6b7280' };
    if (!isElectionStarted) return { label: 'COMING SOON', color: '#f59e0b' };
    if (isElectionEnded) return { label: 'ENDED', color: '#dc2626' };
    return { label: 'LIVE', color: '#16a34a' };
  };

  const phase = getElectionPhase();
  const sortedByVotes = [...candidates].sort((a, b) => (b.votes || 0) - (a.votes || 0));

  const sidebarItems = [
  { icon: '📊', label: 'Dashboard', key: 'dashboard' },
  { icon: '⚙️', label: 'Settings', key: 'settings' },
  { icon: '👥', label: 'Candidates', key: 'candidates' },
  { icon: '📈', label: 'Results', key: 'results' },
  { icon: '💰', label: 'Withdrawal', key: 'withdrawal' },
  { icon: '🔑', label: 'Activation', key: 'activation' },
  { icon: '📋', label: 'Form Purchase', key: 'formPurchase' },
  { icon: '📩', label: 'Support', key: 'support' },
];

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    marginBottom: '12px',
    boxSizing: 'border-box',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s'
  };

  const cardStyle = {
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    marginBottom: '20px'
  };

  const statCardStyle = {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    textAlign: 'center',
    flex: '1',
    minWidth: '200px'
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px', border: '4px solid #e0e0e0', borderTop: '4px solid #003366',
            borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#666' }}>Loading Admin Panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <h2 style={{ color: '#dc2626', margin: '0 0 8px' }}>ERROR</h2>
          <p style={{ color: '#666' }}>{error}</p>
          <button onClick={loadData} style={{
            marginTop: '16px', padding: '10px 24px', background: '#003366', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
          }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Arial, sans-serif', display: 'flex' }}>
      {/* SIDEBAR OVERLAY */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <div style={{
        width: sidebarOpen ? '280px' : '0px',
        overflow: 'hidden',
        background: '#003366',
        color: 'white',
        transition: 'width 0.3s ease',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
        boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.2)' : 'none'
      }}>
        <div style={{ padding: '20px', minWidth: '280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h3 style={{ margin: 0, color: '#FFD700', fontSize: '16px' }}>NAMATLS Admin</h3>
            <button onClick={() => setSidebarOpen(false)} style={{
              background: 'none', border: 'none', color: '#FFD700', fontSize: '24px', cursor: 'pointer', padding: '0'
            }}>&times;</button>
          </div>

          {sidebarItems.map(item => (
            <div
              key={item.key}
              onClick={() => { setActiveView(item.key); setSidebarOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                marginBottom: '4px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: activeView === item.key ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
                color: activeView === item.key ? '#FFD700' : 'rgba(255,255,255,0.8)',
                transition: 'all 0.2s',
                fontWeight: activeView === item.key ? 'bold' : 'normal'
              }}
              onMouseEnter={(e) => { if (activeView !== item.key) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { if (activeView !== item.key) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '18px', width: '28px' }}>{item.icon}</span>
              <span style={{ fontSize: '14px' }}>{item.label}</span>
            </div>
          ))}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '20px', paddingTop: '20px' }}>
            <button onClick={() => navigate('/admin')} style={{
              width: '100%', padding: '12px', background: 'rgba(255,255,255,0.1)', color: 'white',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer',
              fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s'
            }}
              onMouseEnter={(e) => { e.target.style.background = '#dc2626'; e.target.style.borderColor = '#dc2626'; }}
              onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, marginLeft: '0px', transition: 'margin-left 0.3s ease' }}>
        {/* TOP HEADER */}
        <div style={{
          background: '#003366',
          color: 'white',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 30
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'white',
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.1)'; }}
          >
            <span style={{ display: 'block', width: '18px', height: '2px', background: 'white', borderRadius: '1px' }}></span>
            <span style={{ display: 'block', width: '18px', height: '2px', background: 'white', borderRadius: '1px' }}></span>
            <span style={{ display: 'block', width: '18px', height: '2px', background: 'white', borderRadius: '1px' }}></span>
          </button>
          <h2 style={{ margin: 0, fontSize: '18px', flex: 1 }}>Admin Dashboard</h2>
          <div style={{ fontSize: '13px', opacity: 0.8 }}>BROUTE</div>
        </div>

        <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
          {/* === DASHBOARD VIEW === */}
          {activeView === 'dashboard' && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{
                background: 'linear-gradient(135deg, #003366 0%, #004080 50%, #005599 100%)',
                borderRadius: '16px',
                padding: '40px',
                color: 'white',
                marginBottom: '24px',
                boxShadow: '0 4px 20px rgba(0,51,102,0.3)'
              }}>
                <h1 style={{ margin: '0 0 8px', fontSize: '28px' }}>Welcome Admin</h1>
                <p style={{ margin: '0 0 4px', opacity: 0.9, fontSize: '14px' }}>Admin ID: {ADMIN_ID}</p>
                <p style={{ margin: 0, opacity: 0.7, fontSize: '13px' }}>BROUTE</p>
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
                <div style={statCardStyle}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#003366' }}>{candidates.length}</div>
                  <div style={{ color: '#666', fontSize: '13px' }}>Total Candidates</div>
                </div>
                <div style={statCardStyle}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🗳️</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#003366' }}>{totalVotes}</div>
                  <div style={{ color: '#666', fontSize: '13px' }}>Total Votes</div>
                </div>
                <div style={statCardStyle}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>💰</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>₦{withdrawalBalance.toLocaleString()}</div>
                  <div style={{ color: '#666', fontSize: '13px' }}>Withdrawal Balance</div>
                </div>
                <div style={statCardStyle}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: phase.color }}>{phase.label}</div>
                  <div style={{ color: '#666', fontSize: '13px' }}>Election Status</div>
                </div>
              </div>

              <div style={cardStyle}>
                <h3 style={{ color: '#003366', margin: '0 0 16px' }}>Quick Actions</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button onClick={() => setActiveView('settings')} style={{
                    padding: '12px 24px', background: '#003366', color: 'white', border: 'none',
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
                  }}>⚙️ Election Settings</button>
                  <button onClick={() => setActiveView('candidates')} style={{
                    padding: '12px 24px', background: '#2563eb', color: 'white', border: 'none',
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
                  }}>👥 Manage Candidates</button>
                  <button onClick={() => setActiveView('results')} style={{
                    padding: '12px 24px', background: '#16a34a', color: 'white', border: 'none',
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
                  }}>📈 View Results</button>
                  <button onClick={() => setActiveView('withdrawal')} style={{
                    padding: '12px 24px', background: '#f59e0b', color: 'white', border: 'none',
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
                  }}>💰 Withdraw Funds</button>
                </div>
              </div>
            </div>
          )}

     {/* === RESULTS VIEW === */}
          {activeView === 'results' && (
            <div style={cardStyle} className="results-print-area">
              
              {/* LOGO HEADER - CENTERED */}
              <div className="print-header" style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '8px', 
                marginBottom: '20px', 
                borderBottom: '2px solid #FFD700', 
                paddingBottom: '16px',
                textAlign: 'center'
              }}>
                {/* ONLY YOUR LOGO - CENTER */}
                <img 
                  src="/logo.png" 
                  alt="My Logo"
                  style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '4px' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />

                {/* CENTER TEXT */}
                <div>
                  <h2 style={{ color: '#003366', margin: '0', fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                    FEDERAL UNIVERSITY OF PETROLEUM RESOURCES 
                  </h2>
                  <h3 style={{ color: '#003366', margin: '4px 0', fontSize: '16px', fontWeight: 'bold' }}>NAMATL STUDENT E-VOTING</h3>
                  <p style={{ color: '#666', margin: '0', fontSize: '14px' }}>{settings.year} OFFICIAL RESULT</p>
                </div>
              </div>
              
              {/* TITLE + PRINT BUTTON ROW - HIDES ON PRINT */}
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ color: '#003366', margin: '0' }}>📈 Election Results</h2>
                <button 
                  onClick={() => window.print()}
                  style={{
                    padding: '10px 20px',
                    background: '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  🖨️ Print Result
                </button>
              </div>

              {!settings.isActive ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#f59e0b' }}>
                  <span style={{ fontSize: '48px' }}>📊</span>
                  <h3 style={{ margin: '12px 0' }}>No Result Yet</h3>
                  <p style={{ color: '#666' }}>Election has not been configured or activated.</p>
                </div>
              ) : candidates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <span style={{ fontSize: '48px' }}>📭</span>
                  <h3 style={{ margin: '12px 0' }}>No Candidates</h3>
                  <p>No candidates have been added yet.</p>
                </div>
              ) : (
                <div>
                  {sortedByVotes.map((c, idx) => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px', borderBottom: '1px solid #f0f0f0',
                      background: idx === 0 ? 'rgba(255, 215, 0, 0.05)' : 'transparent'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : '#f0f0f0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 'bold', fontSize: '13px', color: idx < 3 ? 'white' : '#666'
                        }}>{idx + 1}</span>
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#333' }}>{c.name}</div>
                          <div style={{ fontSize: '12px', color: '#888' }}>{c.position}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{c.votes || 0}</div>
                        <div style={{ fontSize: '11px', color: '#888' }}>votes</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* PRINT CSS - ONLY SHOWS HEADER + RESULTS */}
              <style>{`
                @media print {
                  body { background: white !important; }
                  /* HIDE EVERYTHING */
                  .no-print, 
                  div[style*="background: #003366"],
                  nav, header, footer { display: none !important; }
                  
                  /* ONLY SHOW RESULTS AREA */
                  .results-print-area { 
                    box-shadow: none !important; 
                    border: none !important; 
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                  .print-header { border-bottom: 2px solid #FFD700 !important; }
                }
                @keyframes spin { from {transform: rotate(0deg)} to {transform: rotate(360deg)} }
                @keyframes fadeIn { from {opacity: 0; transform: translateY(10px)} to {opacity: 1; transform: translateY(0)} }
              `}</style>
            </div>
          )}

          {/* === CANDIDATES VIEW === */}
          {activeView === 'candidates' && (
            <div style={cardStyle}>
              <h2 style={{ color: '#003366', margin: '0 0 20px', borderBottom: '2px solid #FFD700', paddingBottom: '12px' }}>
                👥 Edit Candidates
              </h2>

              {/* Add/Edit form */}
              <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 16px', color: '#333', fontSize: '16px' }}>
                  {editingCandidate ? 'Edit Candidate' : 'Add New Candidate'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <input placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
                  <input placeholder="Position" value={position} onChange={(e) => setPosition(e.target.value)} style={inputStyle} />
                  <input placeholder="Department" value={dept} onChange={(e) => setDept(e.target.value)} style={inputStyle} />
                  <div>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ ...inputStyle, padding: '8px' }} />
                  </div>
                </div>
                <textarea placeholder="Manifesto" value={manifesto} onChange={(e) => setManifesto(e.target.value)} rows="3"
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Arial, sans-serif' }} />
                {photoPreview && (
                  <img src={photoPreview} alt="Preview" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '12px' }} />
                )}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={saveCandidate} style={{
                    padding: '12px 24px', background: '#003366', color: 'white', border: 'none',
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                  }}>{editingCandidate ? 'Update Candidate' : 'Add Candidate'}</button>
                  {editingCandidate && (
                    <button onClick={() => { setEditingCandidate(null); setName(''); setPosition(''); setDept(''); setManifesto(''); setPhoto(null); setPhotoPreview(''); }} style={{
                      padding: '12px 24px', background: '#6b7280', color: 'white', border: 'none',
                      borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                    }}>Cancel Edit</button>
                  )}
                </div>
              </div>

              {/* Candidates list */}
              <div>
                <p style={{ color: '#666', marginBottom: '12px', fontSize: '13px' }}>
                  Total: {candidates.length} candidates | Votes: {totalVotes}
                </p>
                {candidates.length === 0 ? (
                  <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>No candidates yet.</p>
                ) : (
                  candidates.map(c => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px', borderBottom: '1px solid #f0f0f0'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {c.photoURL ? (
                          <img src={c.photoURL} alt={c.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#999' }}>👤</div>
                        )}
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>{c.name}</div>
                          <div style={{ fontSize: '12px', color: '#888' }}>{c.position} — Votes: {c.votes || 0}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => editCandidate(c)} style={{
                          padding: '6px 12px', background: '#2563eb', color: 'white', border: 'none',
                          borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                        }}>Edit</button>
                        <button onClick={() => deleteCandidate(c.id, c.photoURL)} style={{
                          padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none',
                          borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                        }}>Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* === ELECTION SETTINGS VIEW === */}
          {activeView === 'settings' && (
            <div style={cardStyle}>
              <h2 style={{ color: '#003366', margin: '0 0 20px', borderBottom: '2px solid #FFD700', paddingBottom: '12px' }}>
                ⚙️ Election Settings
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>Academic Year (format: 2026/2027)</label>
                  <input
                    placeholder="e.g. 2026/2027"
                    value={settings.year}
                    onChange={(e) => setSettings({ ...settings, year: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>Election Phase</label>
                  <div style={{
                    padding: '12px 14px', borderRadius: '8px', border: '1px solid #ddd',
                    marginBottom: '12px', fontWeight: 'bold', color: phase.color
                  }}>
                    {phase.label}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>Start Date</label>
                  <input
                    type="date"
                    value={settings.startDate}
                    onChange={(e) => setSettings({ ...settings, startDate: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>Start Time</label>
                  <input
                    type="time"
                    value={settings.startTime}
                    onChange={(e) => setSettings({ ...settings, startTime: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>End Date</label>
                  <input
                    type="date"
                    value={settings.endDate}
                    onChange={(e) => setSettings({ ...settings, endDate: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>End Time</label>
                  <input
                    type="time"
                    value={settings.endTime}
                    onChange={(e) => setSettings({ ...settings, endTime: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Activation cost info */}
              <div style={{
                padding: '16px',
                background: settings.year === '2026/2027' ? '#f0fdf4' : '#fefce8',
                borderRadius: '8px',
                marginBottom: '16px',
                border: `1px solid ${settings.year === '2026/2027' ? '#bbf7d0' : '#fde68a'}`
              }}>
                <div style={{ fontSize: '14px', color: '#333' }}>
                  <strong>Activation Cost:</strong>{' '}
                  {settings.year === '2026/2027' ? (
                    <span style={{ color: '#16a34a', fontWeight: 'bold' }}>FREE — First activation for 2026/2027</span>
                  ) : settings.year ? (
                    <span style={{ color: '#d97706', fontWeight: 'bold' }}>
                      ₦25,000 — Will deduct from withdrawal balance (Balance: ₦{withdrawalBalance.toLocaleString()})
                    </span>
                  ) : (
                    <span style={{ color: '#6b7280' }}>Enter academic year to see cost</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button onClick={handleSaveSettings} style={{
                  padding: '12px 24px', background: '#003366', color: 'white', border: 'none',
                  borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
                }}>Activate Election</button>
                <button onClick={toggleElection} style={{
                  padding: '12px 24px', background: settings.isActive ? '#dc2626' : '#16a34a', color: 'white',
                  border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
                }}>{settings.isActive ? 'Deactivate' : 'Activate (Toggle)'}</button>
                <button onClick={deleteAllElectionData} style={{
                  padding: '12px 24px', background: '#6b7280', color: 'white', border: 'none',
                  borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
                }}>Delete All</button>
                <button onClick={clearAllVotes} style={{
                  padding: '12px 24px', background: '#f59e0b', color: 'white', border: 'none',
                  borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
                }}>Clear Votes</button>
              </div>

              {settings.startDate && (
                <div style={{ marginTop: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', fontSize: '13px', color: '#666' }}>
                  <div>Start: {settings.startDate} at {settings.startTime}</div>
                  <div>End: {settings.endDate} at {settings.endTime}</div>
                  <div>Year: {settings.year}</div>
                  <div>Max candidates per position: {MAX_PER_POSITION}</div>
                </div>
              )}
            </div>
          )}

          {/* === WITHDRAWAL VIEW === */}
          {activeView === 'withdrawal' && (
            <div style={cardStyle}>
              <h2 style={{ color: '#003366', margin: '0 0 20px', borderBottom: '2px solid #FFD700', paddingBottom: '12px' }}>
                💰 Withdrawal
              </h2>

              {/* Balance card */}
              <div style={{
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                borderRadius: '12px',
                padding: '24px',
                color: 'white',
                marginBottom: '24px',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(22,163,74,0.3)'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Available Withdrawal Balance</div>
                <div style={{ fontSize: '36px', fontWeight: 'bold' }}>₦{withdrawalBalance.toLocaleString()}</div>
                <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '8px' }}>Opay Account: {OPAY_ACCOUNT}</div>
              </div>

              {withdrawMsg.text && (
                <div style={{
                  padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px',
                  fontWeight: 'bold', textAlign: 'center',
                  background: withdrawMsg.type === 'success' ? '#f0fdf4' : '#fee2e2',
                  color: withdrawMsg.type === 'success' ? '#16a34a' : '#dc2626',
                  border: `1px solid ${withdrawMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`
                }}>
                  {withdrawMsg.text}
                </div>
              )}

              <div style={{ background: '#f8f9fa', padding: '24px', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 16px', color: '#333', fontSize: '16px' }}>Process Withdrawal</h3>
                <input
                  placeholder="Admin ID"
                  value={withdrawAdminId}
                  onChange={(e) => setWithdrawAdminId(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="password"
                  placeholder="Withdrawal PIN"
                  value={withdrawPin}
                  onChange={(e) => setWithdrawPin(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="number"
                  placeholder="Amount (₦)"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  style={inputStyle}
                />
                <button onClick={handleWithdraw} style={{
                  width: '100%', padding: '14px', background: '#16a34a', color: 'white',
                  border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px'
                }}>
                  Withdraw to {OPAY_ACCOUNT}
                </button>
              </div>
            </div>
          )}

          {/* === GENERAL SETTINGS VIEW === */}
          {activeView === 'general' && (
            <div style={cardStyle}>
              <h2 style={{ color: '#003366', margin: '0 0 20px', borderBottom: '2px solid #FFD700', paddingBottom: '12px' }}>
                🔧 General Settings
              </h2>

              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '6px', fontWeight: 'bold' }}>Site Name</label>
                  <input value={siteName} onChange={(e) => setSiteName(e.target.value)} style={inputStyle} />
                </div>

                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '6px', fontWeight: 'bold' }}>Max Candidates Per Position</label>
                  <input type="number" value={maxPerPosition} onChange={(e) => setMaxPerPosition(parseInt(e.target.value))} style={inputStyle} />
                </div>

                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '6px', fontWeight: 'bold' }}>Admin ID (Read Only)</label>
                  <input value={ADMIN_ID} readOnly style={{ ...inputStyle, background: '#e5e7eb', cursor: 'not-allowed' }} />
                </div>

                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '6px', fontWeight: 'bold' }}>Withdrawal PIN (Read Only)</label>
                  <input value="••••" readOnly style={{ ...inputStyle, background: '#e5e7eb', cursor: 'not-allowed' }} />
                </div>

                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '6px', fontWeight: 'bold' }}>Opay Account (Read Only)</label>
                  <input value={OPAY_ACCOUNT} readOnly style={{ ...inputStyle, background: '#e5e7eb', cursor: 'not-allowed' }} />
                </div>
              </div>

              <button style={{
                marginTop: '20px', padding: '12px 24px', background: '#003366', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
              }}>Save General Settings</button>
            </div>
          )}

         {/* === FORM PURCHASE VIEW === */}
        {activeView === 'formPurchase' && (
  <div style={{ maxWidth: '800px', margin: '0 auto' }}>
    <h2 style={{ color: '#003366', marginBottom: '12px', borderBottom: '2px solid #FFD700', paddingBottom: '8px' }}>
      📋 Candidates Form Purchase Settings
    </h2>
    <div style={cardStyle}>
      <h3 style={{ margin: '0 0 16px 0', color: '#FFD700' }}>📅 Payment Deadline</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div><label style={{ fontSize: '13px', opacity: 0.7, display: 'block', marginBottom: '4px' }}>Opening Date</label>
          <input type="date" value={formPurchaseSettings.openingDate || ''} onChange={e => setFormPurchaseSettings({...formPurchaseSettings, openingDate: e.target.value})} style={inputStyle} /></div>
        <div><label style={{ fontSize: '13px', opacity: 0.7, display: 'block', marginBottom: '4px' }}>Opening Time</label>
          <input type="time" value={formPurchaseSettings.openingTime || ''} onChange={e => setFormPurchaseSettings({...formPurchaseSettings, openingTime: e.target.value})} style={inputStyle} /></div>
        <div><label style={{ fontSize: '13px', opacity: 0.7, display: 'block', marginBottom: '4px' }}>Closing Date</label>
          <input type="date" value={formPurchaseSettings.closingDate || ''} onChange={e => setFormPurchaseSettings({...formPurchaseSettings, closingDate: e.target.value})} style={inputStyle} /></div>
        <div><label style={{ fontSize: '13px', opacity: 0.7, display: 'block', marginBottom: '4px' }}>Closing Time</label>
          <input type="time" value={formPurchaseSettings.closingTime || ''} onChange={e => setFormPurchaseSettings({...formPurchaseSettings, closingTime: e.target.value})} style={inputStyle} /></div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
        <input type="checkbox" checked={formPurchaseSettings.isActive || false} onChange={e => setFormPurchaseSettings({...formPurchaseSettings, isActive: e.target.checked})} /> Enable Form Purchase
      </label>
    </div>
    <div style={cardStyle}>
      <h3 style={{ margin: '0 0 16px 0', color: '#FFD700' }}>🏛️ Positions & Prices</h3>
      {(formPurchaseSettings.positions || []).map((pos, i) => (
        <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'center' }}>
          <input value={pos.position} onChange={e => { const u = [...formPurchaseSettings.positions]; u[i] = {...u[i], position: e.target.value}; setFormPurchaseSettings({...formPurchaseSettings, positions: u}); }} placeholder="Position" style={{...inputStyle, marginBottom: 0, flex: 1}} />
          <input type="number" value={pos.amount} onChange={e => { const u = [...formPurchaseSettings.positions]; u[i] = {...u[i], amount: Number(e.target.value)}; setFormPurchaseSettings({...formPurchaseSettings, positions: u}); }} style={{...inputStyle, marginBottom: 0, width: '120px'}} />
          <button onClick={() => setFormPurchaseSettings({...formPurchaseSettings, positions: formPurchaseSettings.positions.filter((_, idx) => idx !== i)})} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer' }}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
        <input id="npn" placeholder="New position" style={{...inputStyle, marginBottom: 0, flex: 1}} />
        <input id="npa" type="number" placeholder="Amount" style={{...inputStyle, marginBottom: 0, width: '120px'}} />
        <button onClick={() => { const n = document.getElementById('npn').value.trim(); const a = Number(document.getElementById('npa').value); if (!n || a <= 0) { alert('Enter name and amount'); return; } setFormPurchaseSettings({...formPurchaseSettings, positions: [...(formPurchaseSettings.positions || []), { position: n, amount: a }]}); document.getElementById('npn').value = ''; document.getElementById('npa').value = ''; }} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add</button>
      </div>
    </div>
    <button onClick={async () => { const r = await saveFormPurchaseSettings(formPurchaseSettings); if (r.success) { alert('✅ Saved!'); loadFormPurchases(); } else { alert('❌ ' + r.message); } }} style={{ padding: '14px 24px', background: '#003366', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', width: '100%' }}>💾 Save Form Purchase Settings</button>
    <div style={{...cardStyle, marginTop: '24px'}}>
      <h3 style={{ margin: '0 0 12px 0', color: '#FFD700' }}>📊 Purchase History</h3>
      {formPurchases.length === 0 ? <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>No purchases yet.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ borderBottom: '1px solid #475569' }}><th style={{ padding: '8px', textAlign: 'left' }}>Name</th><th style={{ padding: '8px', textAlign: 'left' }}>Position</th><th style={{ padding: '8px', textAlign: 'right' }}>Amount</th><th style={{ padding: '8px', textAlign: 'left' }}>Date</th><th style={{ padding: '8px', textAlign: 'center' }}>Status</th></tr></thead>
            <tbody>{formPurchases.slice().reverse().map((p, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #334155' }}>
                <td style={{ padding: '8px' }}>{p.fullName}</td>
                <td style={{ padding: '8px' }}>{p.position}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: '#22c55e' }}>₦{Number(p.amount).toLocaleString()}</td>
                <td style={{ padding: '8px', fontSize: '12px', opacity: 0.7 }}>{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '-'}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}><span style={{ background: '#16a34a', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>{p.status || 'paid'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  </div>
)}
          {/* === SUPPORT MESSAGES VIEW === */}
          {activeView === 'messages' && (
            <div style={cardStyle}>
              <h2 style={{ color: '#003366', margin: '0 0 20px', borderBottom: '2px solid #FFD700', paddingBottom: '12px' }}>
                ✉️ Support Messages ({unreadCount} unread)
              </h2>

              {supportMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <span style={{ fontSize: '48px' }}>📭</span>
                  <h3 style={{ margin: '12px 0 0' }}>No messages yet</h3>
                </div>
              ) : (
                supportMessages.map(msg => (
                  <div key={msg.id} style={{
                    padding: '16px', borderBottom: '1px solid #f0f0f0',
                    background: msg.status === 'unread' ? '#fefce8' : 'transparent',
                    cursor: 'pointer'
                  }} onClick={() => markAsRead(msg.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ color: '#333' }}>{msg.name}</strong>
                      <span style={{ fontSize: '12px', color: '#888' }}>
                        {msg.timestamp?.toDate?.()?.toLocaleString() || 'Just now'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>
                      {msg.email !== 'Not provided' && <div>Email: {msg.email}</div>}
                    </div>
                    <div style={{ fontSize: '14px', color: '#333' }}>{msg.message}</div>
                    {msg.status === 'unread' && (
                      <span style={{
                        display: 'inline-block', marginTop: '8px', padding: '2px 8px',
                        background: '#f59e0b', color: 'white', borderRadius: '4px', fontSize: '11px'
                      }}>Unread</span>
                    )}
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