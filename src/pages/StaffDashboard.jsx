// NAMATLS Staff Dashboard v2.0 — Real-time election monitoring for Lecturers & HOD
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Staff API helper — uses staffToken instead of adminToken
async function staffApi(action, payload = {}) {
  const res = await fetch('/api/staff-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (localStorage.getItem('staffToken') || ''),
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

export default function StaffDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [search, setSearch] = useState('');            // Search / filter candidates
  const [view, setView] = useState('bar');             // 'bar' | 'table'
  const [isFullscreen, setIsFullscreen] = useState(false); // Projector mode for HOD
  const navigate = useNavigate();
  const intervalRef = useRef(null);

  // 🔒 Auth guard — redirect to login if no valid staff token
  useEffect(() => {
    const token = localStorage.getItem('staffToken');
    if (!token) {
      navigate('/staff-login', { replace: true });
    }
  }, []);

  // Real-time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${h}:${m}:${s}`);
    };
    updateTime();
    const t = setInterval(updateTime, 1000);
    return () => clearInterval(t);
  }, []);

  // Load all data via staff API
  const loadData = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const [candRes, studRes] = await Promise.all([
        staffApi('listCandidates'),
        staffApi('listStudents'),
      ]);
      setCandidates(candRes.items || []);
      setStudents(studRes.items || []);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch (e) {
      setError(e.message);
      // If unauthorized, redirect to login
      if (e.message === 'Unauthorized' || e.message.includes('401')) {
        localStorage.removeItem('staffToken');
        navigate('/staff-login', { replace: true });
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadData(true);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Auto-refresh every 12 seconds
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(() => loadData(false), 12000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh]);

  // Fullscreen toggle for projector / big-screen display (HOD presentations)
  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch (e) {
      /* fullscreen API unsupported — ignore silently */
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Logout — clears staff token and returns to staff login
  const handleLogout = () => {
    localStorage.removeItem('staffToken');
    navigate('/staff-login', { replace: true });
  };

  // ---- Derived data ----

  // Filter candidates by search (name or position)
  const q = search.trim().toLowerCase();
  const filtered = q
    ? candidates.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.position || '').toLowerCase().includes(q)
      )
    : candidates;

  // Group (filtered) candidates by position
  const grouped = {};
  filtered.forEach(c => {
    const pos = c.position || 'Unknown';
    if (!grouped[pos]) grouped[pos] = [];
    grouped[pos].push(c);
  });
  const positions = Object.keys(grouped);

  // Stats (based on ALL candidates, unaffected by search filter)
  const totalVotes = candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
  const votedStudents = students.filter(s => s.hasVoted).length;
  const totalStudents = students.length;
  const turnoutPct = totalStudents > 0 ? ((votedStudents / totalStudents) * 100).toFixed(1) : 0;
  const totalCandidates = candidates.length;

  // Current leader per position (for the summary strip) + unopposed detection
  const leaderByPosition = {};
  Object.keys(grouped).forEach(pos => {
    const list = grouped[pos].map(c => ({ ...c, votes: c.votes || 0 }));
    list.sort((a, b) => b.votes - a.votes);
    const top = list[0];
    leaderByPosition[pos] = top && top.votes > 0 ? top : null;
  });

  const positionOrder = ['President', 'Vice President', 'VP', 'Secretary', 'Treasurer', 'PRO', 'Financial Secretary', 'Welfare Director', 'Sports Director', 'Social Director'];

  const sortedPositions = [...positions].sort((a, b) => {
    const ia = positionOrder.indexOf(a);
    const ib = positionOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  // ====== STYLES ======
  const pageStyle = {
    minHeight: '100vh',
    background: '#f0f2f5',
    fontFamily: "'Segoe UI', Arial, sans-serif",
  };

  const headerStyle = {
    background: 'linear-gradient(135deg, #002b54 0%, #003d6b 55%, #004a80 100%)',
    padding: '18px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '3px solid #FFD700',
    flexWrap: 'wrap',
    gap: '12px',
    boxShadow: '0 4px 18px rgba(0,43,84,0.35)',
  };

  const headerTitleStyle = {
    color: '#FFD700',
    fontSize: 'clamp(16px, 3vw, 22px)',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  };

  const crestStyle = {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'rgba(255,215,0,0.15)',
    border: '2px solid #FFD700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  };

  const headerRightStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  };

  const timeStyle = {
    color: 'rgba(255,255,255,0.85)',
    fontSize: '14px',
    fontFamily: 'monospace',
    background: 'rgba(255,255,255,0.08)',
    padding: '6px 12px',
    borderRadius: '8px',
  };

  const iconBtnStyle = {
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.22)',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'all 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  };

  const refreshBtnStyle = {
    padding: '8px 16px',
    background: autoRefresh ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.08)',
    border: `2px solid ${autoRefresh ? '#22c55e' : 'rgba(255,255,255,0.25)'}`,
    borderRadius: '8px',
    color: autoRefresh ? '#4ade80' : '#ccc',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  };

  const statsBarStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '14px',
    marginBottom: '16px',
  };

  const statCardStyle = {
    background: 'white',
    borderRadius: '12px',
    padding: '16px 18px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
    borderLeft: '4px solid #003366',
    textAlign: 'center',
  };

  const statValueStyle = {
    fontSize: '26px',
    fontWeight: 'bold',
    color: '#003366',
    margin: '4px 0',
  };

  const statLabelStyle = {
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '600',
  };

  const containerStyle = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
  };

  const toolbarStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    background: 'white',
    border: '1px solid #e8ecf0',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '18px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  };

  const searchInputStyle = {
    flex: '1 1 220px',
    maxWidth: '420px',
    padding: '10px 14px',
    border: '1px solid #d5dae0',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    color: '#1a1a2e',
  };

  const segBtnStyle = (active) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: active ? '2px solid #003366' : '1px solid #d5dae0',
    background: active ? '#eef4fb' : 'white',
    color: active ? '#003366' : '#666',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
  });

  const positionSectionStyle = {
    background: 'white',
    borderRadius: '14px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
    border: '1px solid #e8ecf0',
  };

  const positionTitleStyle = {
    color: '#003366',
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '2px solid #FFD700',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  };

  const candidateRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 0',
    borderBottom: '1px solid #f0f2f5',
  };

  const rankCircleStyle = {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: '#eef4fb',
    color: '#003366',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 'bold',
    flexShrink: 0,
    border: '1px solid #d8e4f0',
  };

  const photoCircleStyle = {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #003366',
    flexShrink: 0,
    background: '#e8ecf0',
  };

  const photoPlaceholderStyle = {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #003366, #004080)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFD700',
    fontSize: '20px',
    fontWeight: 'bold',
    flexShrink: 0,
  };

  const barContainerStyle = {
    flex: 1,
    minWidth: '0',
  };

  const barLabelRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
    gap: '10px',
  };

  const candidateNameStyle = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a2e',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const voteCountStyle = {
    fontSize: '13px',
    color: '#003366',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  };

  const barOuterStyle = {
    width: '100%',
    height: '28px',
    background: '#e8ecf0',
    borderRadius: '14px',
    overflow: 'hidden',
    position: 'relative',
  };

  const barFillStyle = (pct) => ({
    height: '100%',
    width: `${Math.max(pct, 1)}%`,
    background: 'linear-gradient(90deg, #003366, #0055a5)',
    borderRadius: '14px',
    transition: 'width 0.6s ease-out',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: '10px',
    minWidth: pct > 0 ? '40px' : '0',
  });

  const barPctStyle = {
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold',
    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
  };

  const loadingStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    flexDirection: 'column',
    gap: '16px',
    background: '#002b54',
    color: '#FFD700',
    fontFamily: "'Segoe UI', Arial, sans-serif",
  };

  const spinnerStyle = {
    width: '48px',
    height: '48px',
    border: '4px solid rgba(255,215,0,0.2)',
    borderTop: '4px solid #FFD700',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  const errorContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f0f2f5',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    padding: '20px',
  };

  const errorCardStyle = {
    background: 'white',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '480px',
    textAlign: 'center',
    boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
  };

  const leaderBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    background: 'rgba(34,197,94,0.12)',
    color: '#16a34a',
    border: '1px solid rgba(34,197,94,0.3)',
    whiteSpace: 'nowrap',
  };

  const autoWinBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    background: 'rgba(217,119,6,0.12)',
    color: '#b45309',
    border: '1px solid rgba(217,119,6,0.35)',
    whiteSpace: 'nowrap',
  };

  const badgeWrapStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
    flex: 1,
    overflow: 'hidden',
  };

  const bottomBarStyle = {
    position: 'sticky',
    bottom: 0,
    zIndex: 20,
    background: 'white',
    borderTop: '2px solid #FFD700',
    boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  };

  const primaryBtnStyle = {
    padding: '12px 26px',
    background: 'linear-gradient(135deg, #003366, #004a80)',
    color: '#FFD700',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 3px 12px rgba(0,51,102,0.3)',
    transition: 'all 0.2s',
  };

  const ghostBtnStyle = {
    padding: '10px 18px',
    background: 'white',
    color: '#003366',
    border: '1.5px solid #003366',
    borderRadius: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    transition: 'all 0.2s',
  };

  const dangerBtnStyle = {
    padding: '10px 18px',
    background: 'white',
    color: '#dc2626',
    border: '1.5px solid #dc2626',
    borderRadius: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    transition: 'all 0.2s',
  };

  if (loading) {
    return (
      <div style={loadingStyle}>
        <div style={spinnerStyle}></div>
        <div style={{ fontSize: '18px' }}>Loading Staff Dashboard...</div>
      </div>
    );
  }

  if (error && candidates.length === 0) {
    return (
      <div style={errorContainerStyle}>
        <div style={errorCardStyle}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ color: '#003366', margin: '0 0 8px 0' }}>Connection Error</h2>
          <p style={{ color: '#666', margin: '0 0 20px 0', fontSize: '14px' }}>{error}</p>
          <button onClick={() => loadData(true)} style={{
            padding: '12px 32px',
            background: '#003366',
            color: '#FFD700',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '14px',
          }}>Retry</button>
          <br />
          <button onClick={() => navigate('/')} style={{
            marginTop: '12px',
            padding: '8px 20px',
            background: 'transparent',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
          }}>Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Print stylesheet — hides interactive chrome when printing/saving PDF */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-block { display: block !important; }
          body { background: #fff !important; }
          ${pageStyle.background}  {}
        }
      `}</style>

      {/* HEADER */}
      <div style={headerStyle} className="no-print">
        <div style={headerTitleStyle}>
          <div style={crestStyle}>⚖️</div>
          <div>
            <div style={{ fontSize: 'clamp(15px, 2.6vw, 20px)' }}>NAMATL Election Monitor</div>
            <div style={{ fontSize: '11px', fontWeight: 'normal', color: 'rgba(255,215,0,0.7)' }}>
              National Association of Maritime Transport &amp; Logistics Students, FUPRE
            </div>
          </div>
        </div>
        <div style={headerRightStyle}>
          <span style={timeStyle}>🕐 {currentTime}</span>
          <button onClick={() => { setAutoRefresh(!autoRefresh); }} style={refreshBtnStyle} title={autoRefresh ? 'Auto-refresh ON (every 12s)' : 'Auto-refresh OFF'}>
            {autoRefresh ? '🔵 Live' : '⏸ Paused'}
          </button>
          <button onClick={() => loadData(false)} style={iconBtnStyle} title="Refresh now">🔄</button>
          <button onClick={toggleFullscreen} style={iconBtnStyle} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen (projector)'}>
            {isFullscreen ? '🗗 Exit' : '⛶ Screen'}
          </button>
        </div>
      </div>

      <div style={containerStyle}>

        {/* TOOLBAR: search + view toggle */}
        <div style={toolbarStyle} className="no-print">
          <div style={{ flex: '1 1 220px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🔍</span>
            <input
              style={searchInputStyle}
              placeholder="Search by candidate name or position…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button style={segBtnStyle(view === 'bar')} onClick={() => setView('bar')}>📊 Bars</button>
            <button style={segBtnStyle(view === 'table')} onClick={() => setView('table')}>📋 Table</button>
          </div>
        </div>

        {/* STATS BANNER */}
        <div style={statsBarStyle}>
          <div style={{ ...statCardStyle, borderLeftColor: '#FFD700' }}>
            <div style={statValueStyle}>{totalCandidates}</div>
            <div style={statLabelStyle}>Total Candidates</div>
          </div>
          <div style={{ ...statCardStyle, borderLeftColor: '#2563eb' }}>
            <div style={statValueStyle}>{totalVotes.toLocaleString()}</div>
            <div style={statLabelStyle}>Total Votes Cast</div>
          </div>
          <div style={{ ...statCardStyle, borderLeftColor: '#16a34a' }}>
            <div style={statValueStyle}>{votedStudents.toLocaleString()}</div>
            <div style={statLabelStyle}>Voters Participated</div>
          </div>
          <div style={{ ...statCardStyle, borderLeftColor: '#9333ea' }}>
            <div style={statValueStyle}>{totalStudents.toLocaleString()}</div>
            <div style={statLabelStyle}>Registered Voters</div>
          </div>
          <div style={{ ...statCardStyle, borderLeftColor: '#f59e0b' }}>
            <div style={{ ...statValueStyle, color: turnoutPct > 50 ? '#16a34a' : '#f59e0b' }}>
              {turnoutPct}%
            </div>
            <div style={statLabelStyle}>Voter Turnout</div>
          </div>
        </div>

        {/* TURNOUT PROGRESS BAR */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '14px 18px',
          border: '1px solid #e8ecf0',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
            <span style={{ fontWeight: 'bold', color: '#003366' }}>📈 Voter Turnout</span>
            <span style={{ color: '#666' }}>{votedStudents} / {totalStudents} voted</span>
          </div>
          <div style={{ height: '16px', background: '#e8ecf0', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(Number(turnoutPct) || 0, 100)}%`,
              background: 'linear-gradient(90deg, #16a34a, #4ade80)',
              borderRadius: '8px',
              transition: 'width 0.6s ease-out',
            }}></div>
          </div>
        </div>

        {/* POSITION LEADERS STRIP */}
        {sortedPositions.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '14px 18px',
            border: '1px solid #e8ecf0',
            marginBottom: '18px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <div style={{ fontWeight: 'bold', color: '#003366', fontSize: '13px', marginBottom: '10px' }}>
              🏁 Current Leaders by Position
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {sortedPositions.map(pos => {
                const list = [...grouped[pos]].sort((a, b) => (b.votes || 0) - (a.votes || 0));
                const totalInPos = grouped[pos].reduce((s, c) => s + (c.votes || 0), 0);
                const top = list[0];
                const leadPct = top && totalInPos > 0 ? (((top.votes || 0) / totalInPos) * 100).toFixed(0) : 0;
                const unopposed = grouped[pos].length === 1;
                return (
                  <div key={pos} style={{
                    background: '#f7fafc',
                    border: '1px solid #e8ecf0',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    flex: '1 1 180px',
                  }}>
                    <div style={{ color: '#888', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px', fontWeight: '600' }}>{pos}</div>
                    <div style={{ color: '#003366', fontWeight: 'bold', fontSize: '13px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {top && top.votes > 0 ? top.name : (unopposed ? (top ? top.name : '—') : '—')}
                    </div>
                    <div style={{ color: '#16a34a', fontWeight: 'bold' }}>
                      {top && (top.votes > 0 || unopposed) ? `${leadPct}%` : 'No votes yet'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Last updated */}
        <div style={{
          textAlign: 'right',
          fontSize: '12px',
          color: '#999',
          marginBottom: '16px',
        }}>
          Last updated: {lastUpdated}
          {autoRefresh && <span style={{ color: '#22c55e', marginLeft: '8px' }}>● Auto-refresh active</span>}
        </div>

        {/* CANDIDATE SECTIONS */}
        {sortedPositions.length === 0 ? (
          <div style={{ ...positionSectionStyle, textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
            <h3 style={{ color: '#666', margin: '0' }}>
              {q ? 'No candidates match your search' : 'No candidates available yet'}
            </h3>
            <p style={{ color: '#999', fontSize: '14px', marginTop: '8px' }}>
              Candidates will appear here once added by the admin.
            </p>
          </div>
        ) : (
          sortedPositions.map(pos => {
            const posCandidates = [...grouped[pos]].sort((a, b) => (b.votes || 0) - (a.votes || 0));
            const posMaxVotes = Math.max(...posCandidates.map(c => c.votes || 0), 1);
            const posTotalVotes = posCandidates.reduce((s, c) => s + (c.votes || 0), 0);
            const isUnopposed = posCandidates.length === 1;

            return (
              <div key={pos} style={positionSectionStyle}>
                <div style={positionTitleStyle}>
                  <span>{pos}</span>
                  <span style={{ fontSize: '13px', fontWeight: 'normal', color: '#888' }}>
                    ({posCandidates.length} candidate{posCandidates.length > 1 ? 's' : ''} · {posTotalVotes} total votes)
                  </span>
                  {isUnopposed && (
                    <span style={autoWinBadgeStyle}>🏆 Auto-Winner (unopposed)</span>
                  )}
                </div>

                {/* BAR VIEW */}
                {view === 'bar' && posCandidates.map((c, idx) => {
                  const voteCount = c.votes || 0;
                  const pct = posTotalVotes > 0 ? ((voteCount / posTotalVotes) * 100) : 0;
                  const isLeader = voteCount === posMaxVotes && voteCount > 0;
                  return (
                    <div key={c.id} style={candidateRowStyle}>
                      <div style={rankCircleStyle}>{idx + 1}</div>
                      {c.photoURL ? (
                        <img src={c.photoURL} alt={c.name} style={photoCircleStyle} onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div style={photoPlaceholderStyle}>{c.name ? c.name.charAt(0).toUpperCase() : '?'}</div>
                      )}

                      <div style={barContainerStyle}>
                        <div style={barLabelRowStyle}>
                          <div style={badgeWrapStyle}>
                            <span style={candidateNameStyle}>{c.name}</span>
                            {isLeader && <span style={leaderBadgeStyle}>🏆 Leading</span>}
                            {isUnopposed && <span style={autoWinBadgeStyle}>WINNER</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <span style={voteCountStyle}>🗳️ {voteCount.toLocaleString()} vote{voteCount !== 1 ? 's' : ''}</span>
                            <span style={{ fontSize: '12px', color: '#888', fontWeight: '600', minWidth: '40px', textAlign: 'right' }}>
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div style={barOuterStyle}>
                          <div style={barFillStyle(pct)}>
                            {pct > 12 && <span style={barPctStyle}>{pct.toFixed(1)}%</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* TABLE VIEW */}
                {view === 'table' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ background: '#f7fafc', color: '#003366' }}>
                        <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e8ecf0' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e8ecf0' }}>Candidate</th>
                        <th style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '2px solid #e8ecf0' }}>Votes</th>
                        <th style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '2px solid #e8ecf0' }}>Share</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e8ecf0' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posCandidates.map((c, idx) => {
                        const voteCount = c.votes || 0;
                        const pct = posTotalVotes > 0 ? ((voteCount / posTotalVotes) * 100) : 0;
                        const isLeader = voteCount === posMaxVotes && voteCount > 0;
                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                            <td style={{ padding: '10px 12px', color: '#888', fontWeight: 'bold' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1a1a2e' }}>
                              {c.name}
                              {isLeader && <span style={{ ...leaderBadgeStyle, marginLeft: '8px' }}>🏆 Leading</span>}
                              {isUnopposed && <span style={{ ...autoWinBadgeStyle, marginLeft: '8px' }}>WINNER</span>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: '#003366' }}>{voteCount.toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: '#16a34a' }}>{pct.toFixed(1)}%</td>
                            <td style={{ padding: '10px 12px', color: '#888', fontSize: '13px' }}>
                              {isUnopposed ? 'Auto-Winner' : isLeader ? 'Currently leading' : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* BOTTOM ACTION BAR — Back button at the bottom */}
      <div style={bottomBarStyle} className="no-print">
        <button
          onClick={() => navigate('/')}
          style={primaryBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg,#004a80,#00609f)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg,#003366,#004a80)'; }}
        >
          ← Back to Home
        </button>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => window.print()} style={ghostBtnStyle} title="Print or save results as PDF">
            🖨️ Print / PDF
          </button>
          <button onClick={toggleFullscreen} style={ghostBtnStyle} title="Projector / fullscreen mode">
            {isFullscreen ? '🗗 Exit Screen' : '⛶ Projector Mode'}
          </button>
          <button onClick={handleLogout} style={dangerBtnStyle}>⏻ Logout</button>
        </div>
      </div>

      {/* FOOTER (prints with the document) */}
      <div style={{
        textAlign: 'center',
        padding: '20px 24px',
        color: '#aaa',
        fontSize: '12px',
      }}>
        <div style={{ marginBottom: '4px' }}>
          NAMATL Staff Monitoring Dashboard — Official Election Portal
        </div>
        <div>
          National Association of Maritime Transport and Logistics Students, FUPRE
           &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}