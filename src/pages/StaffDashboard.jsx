// NAMATLS Staff Dashboard v2.0 — Real-time election monitoring for Lecturers & HOD
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Reusable row for the retractable header / bottom 3-bars menus
const MenuRow = ({ icon, label, onClick, danger = false }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: '10px',
    width: '100%', padding: '9px 14px',
    background: 'transparent', border: 'none',
    cursor: 'pointer', fontSize: '13px',
    textAlign: 'left', color: danger ? '#dc2626' : '#1a1a2e',
    fontWeight: 500,
  }}>
    <span style={{ fontSize: '15px', width: '18px', textAlign: 'center' }}>{icon}</span>
    <span>{label}</span>
  </button>
);

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
  const [settings, setSettings] = useState({});        // Election settings (status, dates)

  // R1 / R2 — retractable 3-bars menus
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [bottomMenuOpen, setBottomMenuOpen] = useState(false);

  // R4 — Bars & Table extra features (sort, filter chips, table columns, sound, refresh interval)
  const [sortMode, setSortMode] = useState('votes-desc');      // 'votes-desc' | 'name-asc' | 'position'
  const [chipFilter, setChipFilter] = useState('all');         // 'all' | 'leading' | 'trailing' | 'unopposed'
  const [soundAlerts, setSoundAlerts] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(12);  // seconds; 0 = off
  const [tableCols, setTableCols] = useState({ rank: true, candidate: true, votes: true, share: true, status: true });

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
      const [candRes, studRes, setRes] = await Promise.all([
        staffApi('listCandidates'),
        staffApi('listStudents'),
        staffApi('getSettings').catch(() => ({ settings: {} })),
      ]);
      setCandidates(candRes.items || []);
      setStudents(studRes.items || []);
      setSettings(setRes.settings || {});
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

  // Auto-refresh — interval (seconds) is user-configurable via the header 3-bars menu
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(() => loadData(false), refreshInterval * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, refreshInterval]);

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

  // Close retractable menus on outside click / Escape
  useEffect(() => {
    const onDown = (e) => {
      if (!e.target.closest?.('[data-menu-region]')) {
        setHeaderMenuOpen(false);
        setBottomMenuOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') { setHeaderMenuOpen(false); setBottomMenuOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  // CSV export (used by the bottom 3-bars menu)
  const exportCSV = () => {
    const rows = [['Position', 'Candidate', 'Votes', 'Share %']];
    sortedPositions.forEach(pos => {
      [...grouped[pos]].sort((a, b) => (b.votes || 0) - (a.votes || 0)).forEach(c => {
        const posTotal = grouped[pos].reduce((s, x) => s + (x.votes || 0), 0) || 1;
        rows.push([pos, c.name || '', c.votes || 0, (((c.votes || 0) / posTotal) * 100).toFixed(1)]);
      });
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `namatl-results-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  // Share snapshot (used by the bottom 3-bars menu)
  const shareSnapshot = () => {
    const summary = sortedPositions.map(pos => {
      const list = [...grouped[pos]].sort((a, b) => (b.votes || 0) - (a.votes || 0));
      const top = list[0];
      return `${pos}: ${top && top.votes > 0 ? `${top.name} (${top.votes} votes)` : 'No votes yet'}`;
    }).join('\n');
    const text = `📊 NAMATL Election — Live Snapshot (${new Date().toLocaleString()})\n\n${summary}\n\nTotal votes: ${totalVotes.toLocaleString()} • Turnout: ${turnoutPct}%`;
    if (navigator.share) {
      navigator.share({ title: 'NAMATL Election Snapshot', text }).catch(() => {});
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => alert('Snapshot copied to clipboard'), () => alert(text));
    } else {
      alert(text);
    }
  };

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

  // ---- Election live status (from Firestore settings) ----
  const isModeActive = settings.activeMode === 'election' || settings.activeMode === 'both' || settings.isActive === true || settings.isActive === 'true';

  let startDateTime = null;
  if (settings.startDate) {
    startDateTime = new Date(`${settings.startDate}T${settings.startTime || '00:00'}`);
  }
  let endDateTime = null;
  if (settings.endDate) {
    endDateTime = new Date(`${settings.endDate}T${settings.endTime || '23:59'}`);
  }

  const nowDate = new Date();
  const electionStarted = startDateTime ? (nowDate >= startDateTime) : true;
  const electionEnded = endDateTime ? (nowDate >= endDateTime) : false;
  const electionLive = isModeActive && electionStarted && !electionEnded;

  const electionStatus = (() => {
    if (!isModeActive) return { label: 'Election Not Configured', dot: '#f59e0b', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '#fcd34d', strong: '#b45309', sub: '#92400e' };
    if (!electionStarted) return { label: 'Election Not Yet Started', dot: '#f59e0b', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '#fcd34d', strong: '#b45309', sub: '#92400e' };
    if (electionEnded) return { label: 'Election Ended', dot: '#dc2626', bg: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '#fca5a5', strong: '#b91c1c', sub: '#991b1b' };
    return { label: 'Election is LIVE', dot: '#22c55e', bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '#86efac', strong: '#15803d', sub: '#16a34a' };
  })();

  // ====== STYLES ======
  const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #eef2f7 0%, #e7ecf4 100%)',
    fontFamily: "'Segoe UI', Arial, sans-serif",
  };

  const headerStyle = {
    background: 'linear-gradient(135deg, #04152e 0%, #0a2b52 45%, #0f3d6e 100%)',
    padding: '18px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '3px solid #FFD700',
    flexWrap: 'wrap',
    gap: '12px',
    boxShadow: '0 4px 18px rgba(2,12,28,0.45)',
    position: 'relative',
    overflow: 'hidden',
  };

  // Decorative glow in the header background (rendered as a child overlay)
  const headerGlowStyle = {
    position: 'absolute',
    top: '-60px',
    right: '-40px',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,215,0,0.18) 0%, rgba(255,215,0,0) 70%)',
    pointerEvents: 'none',
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
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    borderRadius: '14px',
    padding: '16px 18px',
    boxShadow: '0 4px 14px rgba(2,12,28,0.08)',
    borderLeft: '4px solid #003366',
    textAlign: 'center',
    border: '1px solid rgba(2,12,28,0.05)',
  };

  const statValueStyle = {
    fontSize: '26px',
    fontWeight: 'bold',
    color: '#0a2b52',
    margin: '4px 0',
  };

  const statLabelStyle = {
    fontSize: '12px',
    color: '#8894a6',
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

  const chipBtnStyle = (active) => ({
    padding: '6px 12px',
    borderRadius: '999px',
    border: active ? '1.5px solid #003366' : '1px solid #e8ecf0',
    background: active ? '#eef4fb' : 'white',
    color: active ? '#003366' : '#666',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    fontSize: '12px',
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
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes livePulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70% { box-shadow: 0 0 0 12px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @media print {
          .no-print { display: none !important; }
          .print-block { display: block !important; }
          body { background: #fff !important; }
        }
      `}</style>

      {/* HEADER */}
      <div style={headerStyle} className="no-print">
        <div style={headerGlowStyle}></div>
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
          <button onClick={() => { setAutoRefresh(!autoRefresh); }} style={refreshBtnStyle} title={autoRefresh ? `Auto-refresh ON (every ${refreshInterval}s)` : 'Auto-refresh OFF'}>
            {autoRefresh ? '🔵 Live' : '⏸ Paused'}
          </button>

          {/* R2 — Retractable 3-bars menu: Screen, Refresh + extras (Time & Live stay outside) */}
          <div style={{ position: 'relative' }} data-menu-region>
            <button onClick={() => { setHeaderMenuOpen(v => !v); setBottomMenuOpen(false); }} style={iconBtnStyle} title="More options" aria-label="More options">≡</button>
            {headerMenuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                background: 'white', color: '#1a1a2e',
                borderRadius: '10px', padding: '6px 0', minWidth: '230px',
                boxShadow: '0 8px 24px rgba(2,12,28,0.28)',
                border: '1px solid #e8ecf0', zIndex: 30,
              }}>
                <MenuRow icon="🔄" label="Refresh Now" onClick={() => { loadData(false); setHeaderMenuOpen(false); }} />
                <MenuRow icon={isFullscreen ? '🗗' : '⛶'} label={isFullscreen ? 'Exit Screen' : 'Screen'} onClick={() => { toggleFullscreen(); setHeaderMenuOpen(false); }} />
                <div style={{ padding: '8px 14px 4px', fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Auto-Refresh</div>
                {[5, 10, 30].map(s => (
                  <button key={s} onClick={() => { setRefreshInterval(s); setAutoRefresh(true); if (intervalRef.current) clearInterval(intervalRef.current); intervalRef.current = setInterval(() => loadData(false), s * 1000); setHeaderMenuOpen(false); }} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '8px 14px',
                    background: refreshInterval === s ? '#eef4fb' : 'transparent',
                    border: 'none', cursor: 'pointer', fontSize: '13px',
                    color: refreshInterval === s ? '#003366' : '#1a1a2e',
                    fontWeight: refreshInterval === s ? 700 : 500,
                  }}><span>🟢 Every {s}s</span>{refreshInterval === s && <span>✓</span>}</button>
                ))}
                <button onClick={() => { if (intervalRef.current) clearInterval(intervalRef.current); setRefreshInterval(0); setAutoRefresh(false); setHeaderMenuOpen(false); }} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '8px 14px',
                  background: refreshInterval === 0 ? '#eef4fb' : 'transparent',
                  border: 'none', cursor: 'pointer', fontSize: '13px',
                  color: refreshInterval === 0 ? '#003366' : '#1a1a2e',
                  fontWeight: refreshInterval === 0 ? 700 : 500,
                }}><span>⏸ Off</span>{refreshInterval === 0 && <span>✓</span>}</button>
                <div style={{ height: '1px', background: '#e8ecf0', margin: '4px 0' }} />
                <MenuRow icon="🔁" label="Reset Filters" onClick={() => { setSearch(''); setChipFilter('all'); setSortMode('votes-desc'); setHeaderMenuOpen(false); }} />
                <MenuRow icon={soundAlerts ? '🔔' : '🔕'} label={soundAlerts ? 'Sound Alerts: ON' : 'Sound Alerts: OFF'} onClick={() => { setSoundAlerts(v => !v); setHeaderMenuOpen(false); }} />
                <MenuRow icon="⛶" label="Fullscreen" onClick={() => { toggleFullscreen(); setHeaderMenuOpen(false); }} />
              </div>
            )}
          </div>
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

        {/* R4 — Bars & Table extra features: sort, filter chips, (table-only) column picker */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '10px',
          background: 'white', border: '1px solid #e8ecf0', borderRadius: '12px',
          padding: '10px 14px', marginBottom: '14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#003366', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Sort</span>
            <button onClick={() => setSortMode('votes-desc')} style={chipBtnStyle(sortMode === 'votes-desc')}>📊 Most Votes</button>
            <button onClick={() => setSortMode('name-asc')} style={chipBtnStyle(sortMode === 'name-asc')}>🔤 Name (A–Z)</button>
            <button onClick={() => setSortMode('position')} style={chipBtnStyle(sortMode === 'position')}>🏷️ By Position</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#003366', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Filter</span>
            <button onClick={() => setChipFilter('all')} style={chipBtnStyle(chipFilter === 'all')}>All</button>
            <button onClick={() => setChipFilter('leading')} style={chipBtnStyle(chipFilter === 'leading')}>🏆 Leading</button>
            <button onClick={() => setChipFilter('trailing')} style={chipBtnStyle(chipFilter === 'trailing')}>📉 Trailing</button>
            <button onClick={() => setChipFilter('unopposed')} style={chipBtnStyle(chipFilter === 'unopposed')}>⚡ Unopposed</button>
          </div>
          {view === 'table' && (
            <details style={{ marginLeft: 'auto' }}>
              <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#003366', fontWeight: 700, listStyle: 'none', padding: '4px 0' }}>⚙️ Columns</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', padding: '10px 14px', background: '#f7fafc', borderRadius: '8px', border: '1px solid #e8ecf0', position: 'absolute', zIndex: 5 }}>
                {[['rank', '#'], ['candidate', 'Candidate'], ['votes', 'Votes'], ['share', 'Share'], ['status', 'Status']].map(([k, label]) => (
                  <label key={k} style={{ fontSize: '12px', color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={tableCols[k]} onChange={() => setTableCols(c => ({ ...c, [k]: !c[k] }))} />
                    {label}
                  </label>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* ELECTION STATUS BANNER */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: electionStatus.bg,
          border: `1px solid ${electionStatus.border}`,
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '16px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: electionStatus.dot,
              boxShadow: `0 0 0 0 ${electionStatus.dot}`,
              animation: electionLive ? 'livePulse 1.6s infinite' : 'none',
            }}></div>
            <div>
              <div style={{ fontWeight: 'bold', color: electionStatus.strong, fontSize: '15px' }}>
                {electionStatus.label}
              </div>
              <div style={{ color: electionStatus.sub, fontSize: '12px' }}>
                {electionLive
                  ? 'Results updating automatically every 12 seconds'
                  : (settings.startDate
                      ? `Scheduled: ${settings.startDate} ${settings.startTime || ''}`
                      : 'Set up and activate the election from the Admin Dashboard')}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', color: electionStatus.strong, fontWeight: '600', fontSize: '13px' }}>
            {totalVotes.toLocaleString()} vote{totalVotes !== 1 ? 's' : ''} cast so far
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
          sortedPositions.filter(pos => {
            if (chipFilter === 'unopposed') return grouped[pos].length === 1;
            return true;
          }).map(pos => {
            const allSorted = [...grouped[pos]].sort((a, b) => (b.votes || 0) - (a.votes || 0));
            const posMaxVotes = Math.max(...allSorted.map(c => c.votes || 0), 1);
            const posTotalVotes = allSorted.reduce((s, c) => s + (c.votes || 0), 0);
            const isUnopposed = allSorted.length === 1;
            let posCandidates = allSorted;
            if (chipFilter === 'leading') posCandidates = posCandidates.filter(c => (c.votes || 0) === posMaxVotes && (c.votes || 0) > 0);
            else if (chipFilter === 'trailing') posCandidates = posCandidates.filter(c => (c.votes || 0) < posMaxVotes);
            if (sortMode === 'name-asc') posCandidates = [...posCandidates].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

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
                          <div style={{
                            ...barFillStyle(pct),
                            background: isLeader
                              ? 'linear-gradient(90deg, #b8860b, #FFD700)'
                              : 'linear-gradient(90deg, #003366, #0055a5)',
                            boxShadow: isLeader ? '0 0 12px rgba(255,215,0,0.35)' : 'none',
                          }}>
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
                        {tableCols.rank && <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e8ecf0' }}>#</th>}
                        {tableCols.candidate && <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e8ecf0' }}>Candidate</th>}
                        {tableCols.votes && <th style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '2px solid #e8ecf0' }}>Votes</th>}
                        {tableCols.share && <th style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '2px solid #e8ecf0' }}>Share</th>}
                        {tableCols.status && <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e8ecf0' }}>Status</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {posCandidates.map((c, idx) => {
                        const voteCount = c.votes || 0;
                        const pct = posTotalVotes > 0 ? ((voteCount / posTotalVotes) * 100) : 0;
                        const isLeader = voteCount === posMaxVotes && voteCount > 0;
                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                            {tableCols.rank && <td style={{ padding: '10px 12px', color: '#888', fontWeight: 'bold' }}>{idx + 1}</td>}
                            {tableCols.candidate && (
                              <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1a1a2e' }}>
                                {c.name}
                                {isLeader && <span style={{ ...leaderBadgeStyle, marginLeft: '8px' }}>🏆 Leading</span>}
                                {isUnopposed && <span style={{ ...autoWinBadgeStyle, marginLeft: '8px' }}>WINNER</span>}
                              </td>
                            )}
                            {tableCols.votes && <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: '#003366' }}>{voteCount.toLocaleString()}</td>}
                            {tableCols.share && <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: '#16a34a' }}>{pct.toFixed(1)}%</td>}
                            {tableCols.status && (
                              <td style={{ padding: '10px 12px', color: '#888', fontSize: '13px' }}>
                                {isUnopposed ? 'Auto-Winner' : isLeader ? 'Currently leading' : '—'}
                              </td>
                            )}
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
          onClick={() => navigate('/staff-login', { replace: true })}
          style={primaryBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg,#004a80,#00609f)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg,#003366,#004a80)'; }}
        >
          ← Back to Login
        </button>
        {/* R1 — Logout / Projector / Print collapsed into a retractable 3-bars menu; Back-to-Login stays outside */}
        <div style={{ position: 'relative' }} data-menu-region>
          <button onClick={() => { setBottomMenuOpen(v => !v); setHeaderMenuOpen(false); }} style={ghostBtnStyle} title="More actions" aria-label="More actions">
            ☰ More
          </button>
          {bottomMenuOpen && (
            <div style={{
              position: 'absolute', right: 0, bottom: 'calc(100% + 8px)',
              background: 'white', color: '#1a1a2e',
              borderRadius: '10px', padding: '6px 0', minWidth: '240px',
              boxShadow: '0 -8px 24px rgba(2,12,28,0.28)',
              border: '1px solid #e8ecf0', zIndex: 40,
            }}>
              <MenuRow icon="🖨️" label="Print / PDF" onClick={() => { setBottomMenuOpen(false); window.print(); }} />
              <MenuRow icon={isFullscreen ? '🗗' : '⛶'} label={isFullscreen ? 'Exit Projector' : 'Projector Mode'} onClick={() => { setBottomMenuOpen(false); toggleFullscreen(); }} />
              <MenuRow icon="📤" label="Export Results (CSV)" onClick={() => { setBottomMenuOpen(false); exportCSV(); }} />
              <MenuRow icon="📸" label="Share Snapshot" onClick={() => { setBottomMenuOpen(false); shareSnapshot(); }} />
              <div style={{ height: '1px', background: '#e8ecf0', margin: '4px 0' }} />
              <MenuRow icon="⚙️" label="Settings" onClick={() => { setBottomMenuOpen(false); alert('Settings panel is available in the Admin Dashboard.'); }} />
              <MenuRow icon="❓" label="Help / About" onClick={() => { setBottomMenuOpen(false); alert('NAMATL Staff Dashboard v2.0\nReal-time election monitoring for Lecturers & HOD.'); }} />
              <div style={{ height: '1px', background: '#e8ecf0', margin: '4px 0' }} />
              <MenuRow icon="⏻" label="Logout" danger onClick={() => { setBottomMenuOpen(false); handleLogout(); }} />
            </div>
          )}
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