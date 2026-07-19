import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
// REMOVED: import { useDataCharge } from '../context/DataChargeContext';

export default function StudentDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [settings, setSettings] = useState({});
  const [hasVoted, setHasVoted] = useState(false);
  const [student, setStudent] = useState(null);
  const navigate = useNavigate();
  // REMOVED: const { sessionSeconds, sessionCost } = useDataCharge();

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedStudent = JSON.parse(localStorage.getItem('studentInfo'));
        if (!savedStudent) {
          setError('No student data. Please Login.');
          setLoading(false);
          return;
        }
        setStudent(savedStudent);

        const savedCandidates = JSON.parse(localStorage.getItem('candidates')) || [];
        setCandidates(savedCandidates);

        try {
          const settingsSnap = await getDoc(doc(db, 'settings', 'main'));
          if (settingsSnap.exists()) {
            const fbSettings = settingsSnap.data();
            setSettings(fbSettings);
            localStorage.setItem('electionSettings', JSON.stringify(fbSettings));
          } else {
            const savedSettings = JSON.parse(localStorage.getItem('electionSettings')) || {};
            setSettings(savedSettings);
          }
        } catch (e) {
          const savedSettings = JSON.parse(localStorage.getItem('electionSettings')) || {};
          setSettings(savedSettings);
        }

        setHasVoted(localStorage.getItem('voted') === 'true');
      } catch (e) {
        setError('Error: ' + e.message);
      }
      setLoading(false);
    };

    loadData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('studentInfo');
    localStorage.removeItem('voted');
    navigate('/student-login');
  };

  const startDateTime = settings.startDate && settings.startTime? new Date(settings.startDate + 'T' + settings.startTime) : null;
  const endDateTime = settings.endDate && settings.endTime? new Date(settings.endDate + 'T' + settings.endTime) : null;
  const now = new Date();
  const isElectionStarted = startDateTime? now >= startDateTime : false;
  const isElectionEnded = endDateTime? now >= endDateTime : false;
  const isVotingOpen = settings.isActive && startDateTime && isElectionStarted &&!isElectionEnded;

  const handleVote = (id) => {
    if (!isVotingOpen) { alert('Voting is not open.'); return; }
    if (!window.confirm('Vote for this candidate? This action cannot be undone.')) return;

    const updated = candidates.map(c => c.id === id? {...c, votes: (c.votes || 0) + 1 } : c);
    setCandidates(updated);
    localStorage.setItem('candidates', JSON.stringify(updated));
    localStorage.setItem('voted', 'true');
    setHasVoted(true);
    alert('Vote Submitted! Thank you.');
  };

  const getStatusBadge = () => {
    if (!settings.isActive ||!settings.startDate) return { text: 'NOT CONFIGURED', color: '#6b7280' };
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

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ color: '#dc2626' }}>ERROR</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/student-login')} style={{ padding: '10px 24px', background: 'white', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '16px' }}>Login</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
        <p style={{ color: '#FFD700', fontWeight: 'bold' }}>Loading...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2>NOT LOGGED IN</h2>
        <button onClick={() => navigate('/student-login')} style={{ padding: '10px 24px', background: 'white', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Login</button>
      </div>
    );
  }

  if (!isVotingOpen) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ background: '#003366', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 'clamp(1rem, 3vw, 1.4rem)' }}>NAMATL E-VOTING</h2>
          {/* REMOVED: Session: {sessionSeconds}s | N{sessionCost} */}
          <button onClick={handleLogout} style={{ marginLeft: '12px', padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Logout</button>
        </div>
        <div style={{ background: 'white', borderRadius: '8px', padding: '20px', margin: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <hr style={{ border: 'none', borderTop: '3px solid #FFD700', width: '60px', margin: '10px auto' }} />
          <h1 style={{ color: '#003366', fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', margin: '16px 0' }}>ELECTION IS COMING SOON</h1>
          <hr style={{ border: 'none', borderTop: '3px solid #FFD700', width: '60px', margin: '10px auto' }} />
          <p style={{ color: '#666', fontSize: '18px', marginTop: '20px' }}>Welcome, {student.name}</p>
          <p style={{ color: '#999', fontSize: '14px' }}>{student.matric}</p>
          {settings.startDate && (
            <p style={{ color: '#666', marginTop: '10px', fontSize: '14px' }}>Scheduled: {settings.startDate} at {settings.startTime || 'TBA'}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#003366', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 'clamp(1rem, 3vw, 1.4rem)' }}>Student Voting Portal</h2>
        {/* REMOVED: Session: {sessionSeconds}s | N{sessionCost} */}
        <button onClick={handleLogout} style={{ marginLeft: '12px', padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Logout</button>
      </div>
      <div style={{ background: 'white', borderRadius: '8px', padding: '20px', margin: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <p style={{ color: '#333', marginBottom: '8px' }}>Welcome, <strong>{student.name}</strong> &mdash; {student.matric}</p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: '#666' }}>
          <span>Year: {settings.year || 'N/A'}</span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', background: badge.color, color: 'white', fontWeight: 'bold' }}>{badge.text}</span>
          <span>Closes: {settings.endDate || 'N/A'} {settings.endTime || ''}</span>
        </div>
      </div>

      {hasVoted? (
        <div style={{ background: 'white', borderRadius: '8px', padding: '20px', margin: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h2 style={{ color: '#16a34a' }}>You have voted. Thank you!</h2>
        </div>
      ) : candidates.length === 0? (
        <div style={{ background: 'white', borderRadius: '8px', padding: '20px', margin: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <h3>No Candidates Available</h3>
        </div>
      ) : (
        positions.map(pos => (
          <div key={pos} style={{ background: 'white', borderRadius: '8px', padding: '20px', margin: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#003366', borderBottom: '2px solid #FFD700', paddingBottom: '8px', marginBottom: '16px' }}>{pos}</h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {grouped[pos].map(c => (
                <div key={c.id} style={{ background: '#f9f9f9', borderRadius: '8px', padding: '16px', flex: '1', minWidth: '250px', textAlign: 'center' }}>
                  {c.photoURL && (
                    <img src={c.photoURL} alt={c.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '12px' }}
                      onError={(e) => { e.target.style.display = 'none'; }} />
                  )}
                  <h4 style={{ margin: '0 0 4px', color: '#333' }}>{c.name}</h4>
                  <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>{c.position}</p>
                  <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>{c.manifesto || 'No manifesto'}</p>
                  <button onClick={() => handleVote(c.id)}
                    style={{ width: '100%', padding: '12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
                    Vote
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}