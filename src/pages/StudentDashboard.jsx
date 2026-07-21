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
        const savedStudent = JSON.parse(localStorage.getItem('studentSession'));
        if (!savedStudent) {
          setError('No student data. Please Login.');
          setLoading(false);
          return;
        }
        setStudent(savedStudent);

        // ✅ Read candidates from Firestore (syncs with Admin additions)
        try {
          const candidatesSnap = await getDocs(collection(db, 'candidates'));
          const candidatesList = [];
          candidatesSnap.forEach(docSnap => {
            candidatesList.push({ id: docSnap.id, ...docSnap.data() });
          });
          setCandidates(candidatesList);
        } catch (e) {
          setCandidates([]);
        }

        // ✅ Read settings from Firestore (already correct)
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

        const votedStatus = localStorage.getItem('voted_' + savedStudent.matric) === 'true';
        setHasVoted(votedStatus);
      } catch (e) {
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

  const startDateTime = settings.startDate && settings.startTime ? new Date(settings.startDate + 'T' + settings.startTime) : null;
  const endDateTime = settings.endDate && settings.endTime ? new Date(settings.endDate + 'T' + settings.endTime) : null;
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

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#dc2626', color: 'white', padding: '20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ margin: '0 0 8px' }}>ERROR</h2>
        <p style={{ margin: '0 0 24px', textAlign: 'center', maxWidth: '400px' }}>{error}</p>
        <button onClick={() => navigate('/student-login')} style={{ padding: '10px 24px', background: 'white', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '16px' }}>Login</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
        <p style={{ fontSize: '18px', color: '#666' }}>Loading...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
        <h2 style={{ color: '#333' }}>NOT LOGGED IN</h2>
        <button onClick={() => navigate('/student-login')} style={{ padding: '10px 24px', background: 'white', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Login</button>
      </div>
    );
  }

  if (!isVotingOpen) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #003366, #001a33)', color: 'white', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#FFD700' }}>NAMATL E-VOTING</h2>
          <button onClick={handleLogout} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Logout</button>
        </div>
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <hr style={{ border: 'none', borderTop: '2px solid #FFD700', width: '60px', margin: '0 auto 20px' }} />
          <h1 style={{ fontSize: '24px', margin: '0 0 8px' }}>ELECTION IS COMING SOON</h1>
          <hr style={{ border: 'none', borderTop: '2px solid #FFD700', width: '60px', margin: '20px auto' }} />
          <p style={{ color: 'rgba(255,255,255,0.8)', margin: '0' }}>Welcome, {student.name}</p>
          <p style={{ color: '#FFD700', fontSize: '14px', margin: '4px 0 0' }}>{student.matric}</p>
          {settings.startDate && (
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: '16px' }}>
              Scheduled: {settings.startDate} at {settings.startTime || 'TBA'}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f0f0', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#003366', color: 'white' }}>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#FFD700' }}>Student Voting Portal</h2>
        <button onClick={handleLogout} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Logout</button>
      </div>

      <div style={{ padding: '16px 20px', background: 'white', borderBottom: '1px solid #ddd' }}>
        <p style={{ margin: '0', fontWeight: 'bold', color: '#333' }}>
          Welcome, <span style={{ color: '#003366' }}>{student.name}</span> — {student.matric}
        </p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px', fontSize: '13px', color: '#666' }}>
          <span>Year: {settings.year || 'N/A'}</span>
          <span style={{ padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', color: 'white', background: badge.color }}>{badge.text}</span>
          <span>Closes: {settings.endDate || 'N/A'} {settings.endTime || ''}</span>
        </div>
      </div>

      <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
        {hasVoted ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <h2 style={{ margin: '0', color: '#16a34a' }}>You have voted. Thank you!</h2>
          </div>
        ) : candidates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <h3 style={{ color: '#666', margin: 0 }}>No Candidates Available</h3>
          </div>
        ) : (
          positions.map(pos => (
            <div key={pos} style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#003366', borderBottom: '2px solid #FFD700', paddingBottom: '8px' }}>{pos}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {grouped[pos].map(c => (
                  <div key={c.id} style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {c.photoURL && (
                      <img src={c.photoURL} alt={c.name} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 4px', color: '#333' }}>{c.name}</h4>
                      <p style={{ margin: '0', fontSize: '13px', color: '#666' }}>{c.position}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{c.manifesto || 'No manifesto'}</p>
                    </div>
                    <button onClick={() => handleVote(c.id)} style={{ padding: '12px 24px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', whiteSpace: 'nowrap' }}>Vote</button>
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