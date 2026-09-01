// NAMATLS Staff Dashboard v3.0 — Real-time election monitoring for Lecturers & HOD
// New in v3.0: settings panel (refresh interval, sound, density, photos),
// donut chart view, live vote trend graph, CSV export, sort selector,
// turnout ring, sound alert on new votes, keyboard shortcuts.
// Keyboard: R = refresh · F = fullscreen · P = print · / = search · S = settings
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

// ---- v3.0: CSV export helpers (client-side, no backend needed) ----
const csvCell = (v) => {
  const s = String(v === undefined || v === null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const downloadCSV = (filename, rows) => {
  if (!rows || rows.length === 0) return;
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};

// ---- v3.0: sound alert (Web Audio, no assets needed) ----
const playBeep = (freq = 880) => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => { try { ctx.close(); } catch (e) { /* ignore */ } }, 600);
  } catch (e) { /* ignore */ }
};

// ---- v3.0: mini SVG sparkline (no dependencies) ----
function Sparkline({ data, width = 600, height = 56, color = '#16a34a', fill = 'rgba(22,163,74,0.10)' }) {
  if (!data || data.length < 2) {
    return <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>Collecting data… (one point per refresh)</span>;
  }
  const min = Math.min(...data), max = Math.max(...data);
  const range = (max - min) || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - 4 - ((v - min) / range) * (height - 8)).toFixed(1)}`);
  return (
    <svg width={width} height={height} style={{ display: 'block', maxWidth: '100%' }}>
      <polygon points={`0,${height} ${pts.join(' ')} ${width},${height}`} fill={fill} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ---- v3.0: SVG donut chart for a position (no dependencies) ----
function Donut({ list, size = 180 }) {
  const total = list.reduce((s, c) => s + (c.votes || 0), 0);
  const colors = ['#003366', '#FFD700', '#16a34a', '#2563eb', '#9333ea', '#f59e0b', '#dc2626', '#0d9488', '#6366f1', '#be185d'];
  const r = size / 2 - 14;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  if (total <= 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <svg width={size} height={size}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="#e8ecf0" strokeWidth="26" />
        </svg>
        <div style={{ color: '#999', fontSize: '12px', marginTop: '6px' }}>No votes yet</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {list.map((cnd, i) => {
          const share = (cnd.votes || 0) / total;
          const dash = share * circumference;
          const el = (
            <circle key={cnd.id || i} cx={c} cy={c} r={r} fill="none"
              stroke={i === 0 && (cnd.votes || 0) > 0 ? '#b8860b' : colors[i % colors.length]}
              strokeWidth="26"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${c} ${c})`}
            />
          );
          const dash = dashOf(i, list);
          function dashOf(idx, l) { return ((l[idx].votes || 0) / total) * circumference; }
          offset += dash;
          return el;
        })}
        <text x={c} y={c - 4} textAnchor="middle" fontSize="22" fontWeight="bold" fill="#0a2b52">{total.toLocaleString()}</text>
        <text x={c} y={c + 16} textAnchor="middle" fontSize="10" fill="#8894a6">total votes</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
        {list.map((cnd, i) => (
          <div key={cnd.id || i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', flexShrink: 0, background: i === 0 && (cnd.votes || 0) > 0 ? '#b8860b' : colors[i % colors.length] }}></span>
            <span style={{ color: '#1a1a2e', fontWeight: '600', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cnd.name}</span>
            <span style={{ color: '#003366', fontWeight: 'bold' }}>{cnd.votes || 0}</span>
            <span style={{ color: '#888', fontSize: '11px', minWidth: '44px', textAlign: 'right' }}>{total > 0 ? (((cnd.votes || 0) / total) * 100).toFixed(1) : '0.0'}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- v3.0: persisted dashboard settings ----
const SETTINGS_KEY = 'staffDashSettings';
const DEFAULT_SETTINGS = { interval: 12, sound: false, compact: false, showPhotos: true };
const loadSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch (e) { return { ...DEFAULT_SETTINGS }; }
};

export default function StaffDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [search, setSearch] = useState('');            // Search / filter candidates
  const [view, setView] = useState('bar');             // 'bar' | 'donut' | 'table'
  const [isFullscreen, setIsFullscreen] = useState(false); // Projector mode for HOD
  const [settings, setSettings] = useState({});        // Election settings (status, dates)
  const navigate = useNavigate();
  const intervalRef = useRef(null);

  // ---- v3.0 dashboard settings (persisted) ----
  const [prefs, setPrefs] = useState(loadSettings);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const [showSettings, setShowSettings] = useState(false);
  const savePrefs = (next) => {
    setPrefs(next);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
  };
  const [sortMode, setSortMode] = useState('votes');   // 'votes' | 'name'

  // ---- v3.0 live vote trend + sound alert tracking ----
  const [voteHistory, setVoteHistory] = useState([]);
  const lastTotalVotesRef = useRef(null);
  const [sessionStart] = useState(() => new Date().toLocaleTimeString());

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
      const cands = candRes.items || [];
      setCandidates(cands);
      setStudents(studRes.items || []);
      setSettings(setRes.settings || {});
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);

      // v3.0: track vote trend (last 120 samples) + sound on new votes
      const total = cands.reduce((sum, c) => sum + (c.votes || 0), 0);
      setVoteHistory(h => [...h.slice(-119), total]);
      if (prefsRef.current.sound && lastTotalVotesRef.current !== null && total > lastTotalVotesRef.current) {
        playBeep(880);
      }
      lastTotalVotesRef.current = total;
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

  // Auto-refresh — interval configurable in Settings (default 12s)
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(() => loadData(false), (prefs.interval || 12) * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, prefs.interval]);

  // ---- v3.0 keyboard shortcuts: R refresh · F fullscreen · P print · / search · S settings ----
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'r' || e.key === 'R') loadData(false);
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); window.print(); }
      else if (e.key === 's' || e.key === 'S') setShowSettings(v => !v);
      else if (e.key === '/') {
        e.preventDefault();
        const el = document.getElementById('staff-search');
        if (el) el.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
  const yetToVote = Math.max(0, totalStudents - votedStudents);

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

  // ---- v3.0 CSV export of full results ----
  const exportResults = () => downloadCSV(`namatl-election-results-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['Position', 'Rank', 'Candidate', 'Votes', 'Share %', 'Status'],
    ...candidates.reduce((rows, c) => {
      const pos = c.position || 'Unknown';
      const list = candidates.filter(x => (x.position || 'Unknown') === pos);
      const posTotal = list.reduce((s, x) => s + (x.votes || 0), 0);
      const posMax = Math.max(...list.map(x => x.votes || 0), 0);
      const share = posTotal > 0 ? ((c.votes || 0) / posTotal * 100).toFixed(1) : '0.0';
      const status = list.length === 1 ? 'Auto-Winner' : ((c.votes || 0) === posMax && (c.votes || 0) > 0 ? 'Leading' : '');
      rows.push([pos, '', c.name, c.votes || 0, share, status]);
      return rows;
    }, []),
    [],
    ['Turnout', `${votedStudents}/${totalStudents}`, `${turnoutPct}%`],
    ['Exported', new Date().toLocaleString()],
  ]);

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
    width: