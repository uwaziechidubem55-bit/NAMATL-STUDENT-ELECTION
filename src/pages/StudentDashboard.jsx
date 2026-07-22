import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore';

export default function StudentDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [settings, setSettings] = useState({});
  const [hasVoted, setHasVoted] = useState(false);
  const [student, setStudent] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Read from localStorage using the correct key 'studentSession'
        const savedStudent = JSON.parse(localStorage.getItem('studentSession'));
        console.log('[StudentDashboard] studentSession:', savedStudent);
        
        if (!savedStudent || !savedStudent.matric) {
          setError('No student data. Please Login.');
          setLoading(false);
          return;
        }
        setStudent(savedStudent);
        console.log('[StudentDashboard] Matric:', savedStudent.matric);

        // Load candidates from Firestore
        try {
          const candidatesSnap = await getDocs(collection(db, 'candidates'));
          const candidatesList = [];
          candidatesSnap.forEach(docSnap => {
            candidatesList.push({ id: docSnap.id, ...docSnap.data() });
          });
          console.log('[StudentDashboard] Candidates loaded:', candidatesList.length);
          setCandidates(candidatesList);
        } catch (e) {
          console.error('[StudentDashboard] Error loading candidates:', e);
          setCandidates([]);
        }

        // Load settings from Firestore
        try {
          const settingsSnap = await getDoc(doc(db, 'settings', 'main'));
          if (settingsSnap.exists()) {
            const fbSettings = settingsSnap.data();
            console.log('[StudentDashboard] Settings loaded from Firestore');
            setSettings(fbSettings);
            localStorage.setItem('electionSettings', JSON.stringify(fbSettings));
          } else {
            const savedSettings = JSON.parse(localStorage.getItem('electionSettings') || '{}');
            setSettings(savedSettings);
          }
        } catch (e) {
          console.error('[StudentDashboard] Error loading settings:', e);
          const savedSettings = JSON.parse(localStorage.getItem('electionSettings') || '{}');
          setSettings(savedSettings);
        }

        // Check voted status
        const votedKey = 'voted_' + savedStudent.matric;
        console.log('[StudentDashboard] voted key:', votedKey, 'value:', localStorage.getItem(votedKey));
        const votedStatus = localStorage.getItem(votedKey) === 'true';
        setHasVoted(votedStatus);
        
      } catch (e) {
        console.error('[StudentDashboard] Fatal error:', e);
        setError('Error: ' + e.message);
      }
      setLoading(false);
    };

    loadData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('studentSession');
    navigate('/student-login');
  };

  const startDateTime = settings.startDate && settings.startTime
    ? new Date(settings.startDate + 'T' + settings.startTime) : null;
  const endDateTime = settings.endDate && settings.endTime
    ? new Date(settings.endDate + 'T' + settings.endTime) : null;
  const now = new Date();
  const isElectionStarted = startDateTime ? now >= startDateTime : false;
  const isElectionEnded = endDateTime ? now >= endDateTime : false;
  const isVotingOpen = settings.isActive && startDateTime && isElectionStarted && !isElectionEnded;

  const handleVote = async (id) => {
    if (!isVotingOpen) { alert('Voting is not open.'); return; }
    if (!window.confirm('Vote for this candidate? This action cannot be undone.')) return;

    try {
      const candidateRef = doc(db, 'candidates', id);
      await updateDoc(candidateRef, {
        votes: (candidates.find(c => c.id === id)?.votes || 0) + 1
      });

      const updated = candidates.map(c =>
        c.id === id ? { ...c, votes: (c.votes || 0) + 1 } : c
      );
      setCandidates(updated);

      localStorage.setItem('voted_' + student.matric, 'true');
      setHasVoted(true);
      alert('Vote Submitted! Thank you.');
    } catch (e) {
      alert('Error submitting vote: ' + e.message);
    }
  };

  const getStatusBadge = () => {
    if (!settings.isActive || !settings.startDate) return { text: 'NOT CONFIGURED', color: '#6b7280' };
    if (!isElectionStarted) return { text: 'COMING SOON', color: '#f59e0b' };
    if (isElectionEnded) return { text: 'ENDED', color: '#dc2626' };
    return { text: 'LIVE', color: '#16a34a' };
  };

  const badge = getStatusBadge();
  const grouped = {};
  candidates.forEach(c => {
    if (!grouped[c.position]) grouped[c.position] = [];
    grouped[c.position].push(c);
  });
  const positions = Object.keys(grouped);

  // ── Error State ──
  if (error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#dc2626', color: 'white', fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h1 style={{ margin: '0 0 8px 0' }}>ERROR</h1>
        <p style={{ fontSize: '18px', margin: '0 0 24px 0' }}>{error}</p>
        <button onClick={() => navigate('/student-login')} style={{
          padding: '10px 24px', background: 'white', color: '#dc2626',
          border: 'none', borderRadius: '4px', cursor: 'pointer',
          fontWeight: 'bold', marginTop: '16px',
        }}>
          Login
        </button>
      </div>
    );
  }

  // ── Loading State ──
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#1e293b', color: 'white',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  // ── Not Logged In ──
  if (!student) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#dc2626', color: 'white', fontFamily: 'system-ui, sans-serif',
      }}>
        <h2 style={{ margin: '0 0 16px 0' }}>NOT LOGGED IN</h2>
        <button onClick={() => navigate('/student-login')} style={{
          padding: '10px 24px', background: 'white', color: '#dc2626',
          border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
        }}>
          Login
        </button>
      </div>
    );
  }

  // ── Election Not Open ──
  if (!isVotingOpen) {
    return (
      <div style={{
        minHeight: '100vh', background: '#1e293b', color: 'white',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', background: '#0f172a',
        }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>NAMATL E-VOTING</h2>
          <button onClick={handleLogout} style={{
            padding: '8px 16px', background: 'transparent', color: '#f87171',
            border: '1px solid #f87171', borderRadius: '4px', cursor: 'pointer',
          }}>
            Logout
          </button>
        </div>

        <hr style={{ borderColor: '#334155', margin: 0 }} />

        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <h1 style={{ fontSize: '32px', margin: '0 0 16px 0' }}>ELECTION IS COMING SOON</h1>
          <hr style={{ width: '60px', borderColor: '#3b82f6', margin: '24px auto' }} />
          <p style={{ fontSize: '18px', color: '#94a3b8', margin: '0 0 8px 0' }}>
            Welcome, {student.name}
          </p>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            {student.matric}
          </p>
          {settings.startDate && (
            <p style={{ marginTop: '24px', color: '#fbbf24', fontSize: '14px' }}>
              Scheduled: {settings.startDate} at {settings.startTime || 'TBA'}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Voting Open ──
  return (
    <div style={{
      minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: '#1e293b', color: 'white', padding: '16px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Student Voting Portal</h2>
        <button onClick={handleLogout} style={{
          padding: '8px 16px', background: 'transparent', color: '#f87171',
          border: '1px solid #f87171', borderRadius: '4px', cursor: 'pointer',
        }}>
          Logout
        </button>
      </div>

      {/* Student Info */}
      <div style={{
        background: '#1e293b', color: '#94a3b8', padding: '0 24px 16px',
        fontSize: '14px',
      }}>
        Welcome, {student.name} — {student.matric}
      </div>

      {/* Info Bar */}
      <div style={{
        display: 'flex', gap: '16px', padding: '12px 24px',
        background: 'white', borderBottom: '1px solid #e2e8f0',
        fontSize: '13px', flexWrap: 'wrap', alignItems: 'center',
      }}>
        <span>Year: <strong>{settings.year || 'N/A'}</strong></span>
        <span style={{
          padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold',
          background: badge.color, color: 'white', fontSize: '11px',
        }}>
          {badge.text}
        </span>
        <span>Closes: {settings.endDate || 'N/A'} {settings.endTime || ''}</span>
      </div>

      {/* Content */}
      <div style={{ padding: '24px' }}>
        {hasVoted ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ color: '#16a34a', margin: 0 }}>You have voted. Thank you!</h2>
          </div>
        ) : candidates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <h3 style={{ color: '#64748b' }}>No Candidates Available</h3>
          </div>
        ) : (
          positions.map(pos => (
            <div key={pos} style={{ marginBottom: '32px' }}>
              <h3 style={{
                color: '#334155', borderBottom: '2px solid #3b82f6',
                paddingBottom: '8px', marginBottom: '16px',
              }}>
                {pos}
              </h3>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {grouped[pos].map(c => (
                  <div key={c.id} style={{
                    background: 'white', borderRadius: '8px', padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', minWidth: '240px',
                    flex: '1 1 240px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', textAlign: 'center',
                  }}>
                    {c.photoURL && (
                      <img src={c.photoURL} alt={c.name}
                        onError={e => { e.target.style.display = 'none'; }}
                        style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '12px' }}
                      />
                    )}
                    <h4 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>{c.name}</h4>
                    <p style={{ margin: '0 0 4px 0', color: '#64748b', fontSize: '13px' }}>{c.position}</p>
                    {c.manifesto && (
                      <p style={{ margin: '0 0 12px 0', color: '#94a3b8', fontSize: '12px' }}>{c.manifesto}</p>
                    )}
                    <button onClick={() => handleVote(c.id)} style={{
                      padding: '12px 24px', background: '#16a34a', color: 'white',
                      border: 'none', borderRadius: '6px', fontWeight: 'bold',
                      cursor: 'pointer', fontSize: '16px', whiteSpace: 'nowrap',
                    }}>
                      Vote
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}