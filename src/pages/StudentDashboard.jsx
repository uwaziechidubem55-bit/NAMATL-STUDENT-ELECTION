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

  // 🌅 Greeting helper — based on current local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedStudent = JSON.parse(localStorage.getItem('studentSession'));

        if (!savedStudent || !savedStudent.matric) {
          setError('No student data. Please Login.');
          setLoading(false);
          return;
        }
        setStudent(savedStudent);

        try {
          const candidatesSnap = await getDocs(collection(db, 'candidates'));
          const candidatesList = [];
          candidatesSnap.forEach(docSnap => {
            candidatesList.push({ id: docSnap.id, ...docSnap.data() });
          });
          setCandidates(candidatesList);
        } catch (e) {
          console.error('Error loading candidates:', e);
          setCandidates([]);
        }

        try {
          const settingsSnap = await getDoc(doc(db, 'settings', 'main'));
          if (settingsSnap.exists()) {
            const fbSettings = settingsSnap.data();
            setSettings(fbSettings);
            localStorage.setItem('electionSettings', JSON.stringify(fbSettings));
          } else {
            const savedSettings = JSON.parse(localStorage.getItem('electionSettings') || '{}');
            setSettings(savedSettings);
          }
        } catch (e) {
          console.error('Error loading settings:', e);
          const savedSettings = JSON.parse(localStorage.getItem('electionSettings') || '{}');
          setSettings(savedSettings);
        }

        const votedKey = 'voted_' + savedStudent.matric;
        const votedStatus = localStorage.getItem(votedKey) === 'true';
        setHasVoted(votedStatus);

      } catch (e) {
        console.error('Fatal error:', e);
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

  // ── Styles ──
  const sectionStyle = {
    marginBottom: '48px',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    borderRadius: '16px',
    padding: '32px 24px',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  };

  const positionHeadingStyle = {
    fontSize: '36px',
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: '4px',
    color: '#fbbf24',
    marginBottom: '32px',
    paddingBottom: '16px',
    borderBottom: '3px solid #fbbf24',
    textShadow: '0 2px 10px rgba(251,191,36,0.3)',
    fontFamily: "'Segoe UI', Tahoma, sans-serif",
  };

  const cardStyle = {
    background: 'linear-gradient(145deg, #1e293b 0%, #334155 100%)',
    borderRadius: '14px',
    padding: '28px 20px 24px',
    textAlign: 'center',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  const photoStyle = {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '4px solid #fbbf24',
    boxShadow: '0 0 20px rgba(251,191,36,0.25)',
    marginBottom: '18px',
  };

  const nameStyle = {
    fontSize: '22px',
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: '6px',
    fontFamily: "'Segoe UI', Tahoma, sans-serif",
    whiteSpace: 'nowrap',
  };

  const positionLabelStyle = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    marginBottom: '12px',
  };

  // ⬇ UPDATED: Manifesto now fills available space like a login/input bar
  const manifestoStyle = {
    fontSize: '14px',
    color: '#cbd5e1',
    lineHeight: '1.7',
    marginBottom: '20px',
    fontStyle: 'italic',
    padding: '14px 16px',
    maxWidth: '100%',
    width: '100%',
    background: 'rgba(15,23,42,0.5)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.06)',
    textAlign: 'left',
    wordBreak: 'break-word',
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
  };

  const voteBtnStyle = {
    padding: '12px 36px',
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '16px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    boxShadow: '0 4px 15px rgba(22,163,74,0.35)',
    transition: 'transform 0.15s ease',
    width: '100%',
    maxWidth: '200px',
    whiteSpace: 'nowrap',
  };

  // ── Error State ──
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '12px', color: '#ef4444' }}>ERROR</h1>
        <p style={{ color: '#94a3b8', marginBottom: '24px' }}>{error}</p>
        <button onClick={() => navigate('/student-login')} style={{ padding: '10px 24px', background: 'white', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Login</button>
      </div>
    );
  }

  // ── Loading State ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
        <h2 style={{ color: '#94a3b8' }}>Loading...</h2>
      </div>
    );
  }

  // ── Not Logged In ──
  if (!student) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>
        <h2 style={{ color: '#ef4444', marginBottom: '16px' }}>NOT LOGGED IN</h2>
        <button onClick={() => navigate('/student-login')} style={{ padding: '10px 24px', background: 'white', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Login</button>
      </div>
    );
  }

  // ── Election Not Open ──
  if (!isVotingOpen) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: "'Segoe UI', Tahoma, sans-serif" }}>

        {/* 🌅 Greeting — top corner (added only) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', padding: '12px 24px 0' }}>
          <div style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#0f172a', padding: '8px 18px', borderRadius: '999px', fontWeight: '700', fontSize: '15px', boxShadow: '0 2px 10px rgba(251,191,36,0.35)' }}>
            {getGreeting()}, {student.name}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: '#1e293b', borderBottom: '1px solid #334155' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#fbbf24' }}>NAMATL E-VOTING</h2>
          <button onClick={handleLogout} style={{ padding: '8px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Logout</button>
        </div>
        <hr style={{ borderColor: '#334155' }} />
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#fbbf24', marginBottom: '16px' }}>ELECTION IS COMING SOON</h1>
          <hr style={{ width: '80px', borderColor: '#fbbf24', margin: '20px auto' }} />
          <p style={{ fontSize: '18px', color: '#e2e8f0' }}>Welcome, {student.name}</p>
          <p style={{ color: '#94a3b8', marginTop: '8px' }}>{student.matric}</p>
          {settings.startDate && (
            <p style={{ color: '#64748b', marginTop: '16px' }}>Scheduled: {settings.startDate} at {settings.startTime || 'TBA'}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Voting Open ──
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', fontFamily: "'Segoe UI', Tahoma, sans-serif", paddingBottom: '60px' }}>

      {/* 🌅 Greeting — top corner (added only) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', padding: '12px 24px 0' }}>
        <div style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#0f172a', padding: '8px 18px', borderRadius: '999px', fontWeight: '700', fontSize: '15px', boxShadow: '0 2px 10px rgba(251,191,36,0.35)' }}>
          {getGreeting()}, {student.name}
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: '#1e293b', borderBottom: '1px solid #334155', position: 'sticky', top: 0, zIndex: 10 }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#fbbf24' }}>Student Voting Portal</h2>
        <button onClick={handleLogout} style={{ padding: '8px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Logout</button>
      </div>

      {/* Student Info */}
      <div style={{ textAlign: 'center', padding: '20px 16px 8px', color: '#e2e8f0', fontSize: '16px' }}>
        Welcome, <strong>{student.name}</strong> — {student.matric}
      </div>

      {/* Info Bar */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', padding: '8px 16px 24px', color: '#94a3b8', fontSize: '14px', flexWrap: 'wrap' }}>
        <span>Year: <strong style={{ color: '#e2e8f0' }}>{settings.year || 'N/A'}</strong></span>
        <span style={{ padding: '4px 14px', borderRadius: '20px', background: badge.color, color: 'white', fontWeight: '700', fontSize: '12px', letterSpacing: '1px' }}>{badge.text}</span>
        <span>Closes: {settings.endDate || 'N/A'} {settings.endTime || ''}</span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px' }}>
        {hasVoted ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <h2 style={{ fontSize: '26px', fontWeight: 'bold', color: '#16a34a' }}>You have voted. Thank you!</h2>
          </div>
        ) : candidates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <h3 style={{ color: '#94a3b8' }}>No Candidates Available</h3>
          </div>
        ) : (
          positions.map(pos => (
            <div key={pos} style={sectionStyle}>

              {/* Position Heading — Bold, Gold, On Top */}
              <h2 style={positionHeadingStyle}>
                {pos}
              </h2>

              {/* Candidates Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '24px',
                justifyContent: 'center',
              }}>
                {grouped[pos].map(c => (
                  <div
                    key={c.id}
                    style={cardStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)';
                    }}
                  >
                    {/* Photo — top, centered */}
                    {c.photoURL && (
                      <img
                        src={c.photoURL}
                        alt={c.name}
                        style={photoStyle}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}

                    {/* Name — one line: "Chidubem Uwazie" */}
                    <h3 style={nameStyle}>{c.name}</h3>

                    {/* Position — subtle label */}
                    <p style={positionLabelStyle}>{c.position}</p>

                    {/* Manifesto — fills width like a login/input bar */}
                    {c.manifesto && (
                      <p style={manifestoStyle}>"{c.manifesto}"</p>
                    )}

                    {/* Vote Button */}
                    <button
                      onClick={() => handleVote(c.id)}
                      style={voteBtnStyle}
                      onMouseEnter={(e) => { e.target.style.transform = 'scale(1.03)'; }}
                      onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; }}
                    >
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