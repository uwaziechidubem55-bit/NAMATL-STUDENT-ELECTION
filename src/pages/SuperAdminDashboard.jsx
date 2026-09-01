// NAMTLS Super Admin Dashboard v3.0 — the control room.
// Structure is a twin of AdminDashboard.jsx (same sidebar, topbar, cards,
// buttons, colors) so it feels native to the app.
// Powers:
//   📊 Overview   — the whole system at a glance, live + session trend graphs
//   👀 Live       — who is online, on which page, right now + event feed (pausable)
//   👥 People     — students, logins, failed attempts (searchable, CSV export)
//   🗳️ Election   — live votes per position + live trend graph + CSV export
//   💰 Money      — THE PRICE BOOK + payments + balance + searchable transactions + CSV
//   🛠️ System     — database health, latency history, presence cleanup, session countdown
//   📖 Diary      — the audit trail (searchable, filterable, paginated, CSV export)
//   ⚙️ Settings   — sync interval, sound alerts, density, rows per page, resets
// Data refreshes automatically (default 10s, configurable in Settings).
// Keyboard: 1-8 = switch views · R = force refresh · / = focus search
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminApi } from '../utils/superAdminApi';
import { adminApi } from '../utils/adminApi';

const SUPER_VIEWS = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'live', label: 'Live Monitor', icon: '👀' },
  { key: 'people', label: 'People', icon: '👥' },
  { key: 'election', label: 'Election', icon: '🗳️' },
  { key: 'money', label: 'Money & Pricing', icon: '💰' },
  { key: 'system', label: 'System', icon: '🛠️' },
  { key: 'diary', label: 'Audit Diary', icon: '📖' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

const naira = (n) => '₦' + (Number(n) || 0).toLocaleString();
const clock = (iso) => {
  try { return new Date(iso).toLocaleTimeString(); } catch (e) { return '—'; }
};
const dayMonth = (iso) => {
  try { return new Date(iso).toLocaleDateString() + ' ' + new Date(iso).toLocaleTimeString(); } catch (e) { return '—'; }
};
const relTime = (iso) => {
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  } catch (e) { return '—'; }
};

// ---- CSV export helpers ----
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

// ---- Sound alert (Web Audio, no assets needed) ----
const playBeep = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => { try { ctx.close(); } catch (e) { /* ignore */ } }, 600);
  } catch (e) { /* ignore */ }
};

// ---- Mini SVG sparkline (no dependencies) ----
function Sparkline({ data, width = 220, height = 44, color = '#003366', fill = 'rgba(0,51,102,0.10)' }) {
  if (!data || data.length < 2) {
    return <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>Collecting data… (one point per sync)</span>;
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

// ---- persisted dashboard settings ----
const SETTINGS_KEY = 'superDashSettings';
const EXPIRY_KEY = 'superExpiresAt';
const DEFAULT_SETTINGS = { interval: 10, sound: false, pageSize: 20, relative: false, compact: false };
const loadSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch (e) { return { ...DEFAULT_SETTINGS }; }
};

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('overview');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [latencyMs, setLatencyMs] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const pollRef = useRef(null);

  // ---- v3.0 dashboard settings ----
  const [settings, setSettings] = useState(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const saveSettings = (next) => {
    setSettings(next);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
  };

  // ---- v3.0 session trend history (tracked client-side across polls) ----
  const [voteHistory, setVoteHistory] = useState([]);
  const [onlineHistory, setOnlineHistory] = useState([]);
  const [latencyHistory, setLatencyHistory] = useState([]);
  const lastAuditIdRef = useRef(null);
  const [sessionStart] = useState(() => new Date().toISOString());

  // ---- v3.0 1-second tick (drives countdowns + relative times) ----
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick; // re-render clock-driven UI every second

  // ---- v3.0 session expiry countdown (2h, matches server rule) ----
  const [expiry, setExpiry] = useState(() => {
    let v = Number(localStorage.getItem(EXPIRY_KEY) || 0);
    if (!v || v < Date.now()) {
      v = Date.now() + 2 * 60 * 60 * 1000;
      try { localStorage.setItem(EXPIRY_KEY, String(v)); } catch (e) { /* ignore */ }
    }
    return v;
  });
  const sessionMsLeft = Math.max(0, expiry - Date.now());
  const sessionCountdown = `${String(Math.floor(sessionMsLeft / 3600000)).padStart(2, '0')}:${String(Math.floor((sessionMsLeft % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor((sessionMsLeft % 60000) / 1000)).padStart(2, '0')}`;

  // ---- price book state (Money & Pricing) ----
  const [price, setPrice] = useState({ maintenance: '', siteUpdate: '', databaseUpgrading: '', freeYears: '' });
  const [priceLoaded, setPriceLoaded] = useState(false);
  const [priceMsg, setPriceMsg] = useState({ type: '', text: '' });
  const [priceBusy, setPriceBusy] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState('');
  const [txTab, setTxTab] = useState('all'); // all | activation | forms | withdrawals

  // ---- v3.0 search / filter / pagination / pause state ----
  const [feedPaused, setFeedPaused] = useState(false);       // Live Monitor event feed
  const [pausedAudit, setPausedAudit] = useState([]);        // frozen snapshot
  const [liveSearch, setLiveSearch] = useState('');
  const [peopleSearch, setPeopleSearch] = useState('');
  const [electionSearch, setElectionSearch] = useState('');
  const [txSearch, setTxSearch] = useState('');
  const [diarySearch, setDiarySearch] = useState('');
  const [diaryFilter, setDiaryFilter] = useState('all');
  const [diaryPage, setDiaryPage] = useState(1);

  const loadStats = useCallback(async () => {
    const t0 = Date.now();
    try {
      const res = await superAdminApi('superStats');
      const st = res.stats;
      setStats(st);
      setError('');
      const lat = Date.now() - t0;
      setLatencyMs(lat);
      setLastSync(new Date().toISOString());

      // v3.0: trend history (last 60 samples)
      setLatencyHistory(h => [...h.slice(-59), lat]);
      const totalVotes = st && st.election
        ? Object.values(st.election.byPosition || {}).reduce(
            (sum, list) => sum + list.reduce((a, c) => a + (Number(c.votes) || 0), 0), 0)
        : 0;
      setVoteHistory(h => [...h.slice(-59), totalVotes]);
      setOnlineHistory(h => [...h.slice(-59), st && st.online ? st.online.count : 0]);

      // v3.0: sound alert on new FAILED / VOTE events
      const newest = (st && st.audit && st.audit[0]) || null;
      if (newest && newest.id) {
        const prev = lastAuditIdRef.current;
        if (prev && newest.id !== prev && settingsRef.current.sound) {
          const act = String(newest.action || '');
          if (act.includes('FAILED') || act.includes('VOTE')) playBeep();
        }
        lastAuditIdRef.current = newest.id;
      }
    } catch (e) {
      setError(e.message || 'Failed to load stats');
    }
  }, []);

  // Poll using the configurable interval
  useEffect(() => {
    loadStats();
    pollRef.current = setInterval(loadStats, settings.interval * 1000);
    return () => clearInterval(pollRef.current);
  }, [loadStats, settings.interval]);

  // ---- v3.0 keyboard shortcuts: 1-8 views · R refresh · / search ----
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const idx = ['1', '2', '3', '4', '5', '6', '7', '8'].indexOf(e.key);
      if (idx >= 0 && SUPER_VIEWS[idx]) setActiveView(SUPER_VIEWS[idx].key);
      else if (e.key === 'r' || e.key === 'R') loadStats();
      else if (e.key === '/') {
        e.preventDefault();
        const el = document.getElementById('super-search');
        if (el) el.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loadStats]);

  // ---- load the price book once (admin-level read is enough) ----
  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi('getActivationPricing');
        const p = res.pricing || {};
        setPrice({
          maintenance: p.usingFallback ? '' : String(p.maintenance),
          siteUpdate: p.usingFallback ? '' : String(p.siteUpdate),
          databaseUpgrading: p.usingFallback ? '' : String(p.databaseUpgrading),
          freeYears: Array.isArray(p.freeYears) ? p.freeYears.join(', ') : '',
        });
        setPriceLoaded(true);
      } catch (e) {
        setPriceLoaded(true);
      }
    })();
  }, []);

  const savePricing = async () => {
    const maintenance = Number(price.maintenance);
    const siteUpdate = Number(price.siteUpdate);
    const databaseUpgrading = Number(price.databaseUpgrading);
    if (![maintenance, siteUpdate, databaseUpgrading].every(n => Number.isFinite(n) && n >= 0)) {
      setPriceMsg({ type: 'error', text: 'All three boxes must be numbers (0 or more).' });
      return;
    }
    setPriceBusy(true);
    setPriceMsg({ type: '', text: '' });
    try {
      const freeYears = price.freeYears.split(',').map(s => s.trim()).filter(Boolean);
      const res = await superAdminApi('saveActivationPricing', { maintenance, siteUpdate, databaseUpgrading, freeYears });
      setPriceMsg({ type: 'success', text: `Saved! Activation fee is now ${naira(res.pricing.total)} (${freeYears.length ? 'free years: ' + freeYears.join(', ') : 'no free years'}).` });
    } catch (e) {
      setPriceMsg({ type: 'error', text: e.message || 'Failed to save.' });
    } finally {
      setPriceBusy(false);
    }
  };

  const cleanupPresence = async () => {
    setCleanupMsg('⏳ Cleaning...');
    try {
      const res = await superAdminApi('superCleanupPresence');
      setCleanupMsg(`✅ Removed ${res.removed} stale presence record(s).`);
    } catch (e) {
      setCleanupMsg('❌ ' + (e.message || 'Failed.'));
    }
  };

  const endSuperSession = () => {
    localStorage.removeItem('superToken');
    try { localStorage.removeItem(EXPIRY_KEY); } catch (e) { /* ignore */ }
    navigate('/admin-dashboard');
  };

  const forceRefresh = () => {
    if (feedPaused) setPausedAudit((stats && stats.audit) || []);
    loadStats();
  };

  const pauseFeed = () => {
    if (!feedPaused) setPausedAudit((stats && stats.audit) || []);
    setFeedPaused(p => !p);
  };

  const copyRef = async (ref) => {
    try { await navigator.clipboard.writeText(String(ref || '')); } catch (e) { /* ignore */ }
  };

  // ===================== STYLES (twins of AdminDashboard) =====================
  const cellPad = settings.compact ? '6px 8px' : '10px';
  const cardStyle = {
    background: 'white', borderRadius: '12px', padding: settings.compact ? '16px' : '24px',
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
  const btnSuccess = { ...btnPrimary, background: '#16a34a' };
  const btnGhost = {
    padding: '8px 14px', background: '#e8ecf0', color: '#334155',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontWeight: 'bold', fontSize: '13px'
  };
  const thStyle = { padding: cellPad, textAlign: 'left', borderBottom: '2px solid #e8ecf0', fontSize: '13px', color: '#003366' };
  const tdStyle = { padding: cellPad, borderBottom: '1px solid #eee', fontSize: '13px', color: '#334155' };
  const searchInputStyle = {
    width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px',
    boxSizing: 'border-box', fontSize: '14px', outline: 'none', marginBottom: '12px'
  };
  const stamp = (iso) => settings.relative ? relTime(iso) : dayMonth(iso);

  if (error && !stats) {
    return (
      <div style={{ minHeight: '100vh', background: '#003366', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
        <h2 style={{ color: '#ef4444' }}>ERROR</h2>
        <p style={{ color: 'white', textAlign: 'center', maxWidth: '500px' }}>{error}</p>
        <button onClick={loadStats} style={{ padding: '10px 24px', background: '#FFD700', color: '#003366', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '16px' }}>Retry</button>
      </div>
    );
  }

  const s = stats;
  const audit = (s && s.audit) || [];
  const loginEvents = audit.filter(a => String(a.action).includes('LOGIN') || a.action === 'LOGIN_FAILED');

  // ---- v3.0 derived election totals ----
  const allCandidates = s ? Object.values(s.election.byPosition || {}).flat() : [];
  const totalVotes = allCandidates.reduce((a, c) => a + (Number(c.votes) || 0), 0);
  const turnoutPct = s && s.people.totalStudents > 0 ? Math.round((s.people.voted / s.people.totalStudents) * 100) : 0;

  // ---- Transactions Center data ----
  const withdrawals = (s && s.money && s.money.withdrawals) || [];
  const formPurchases = (s && s.money && s.money.formPurchases) || [];
  const successfulWithdrawn = withdrawals
    .filter(w => String(w.status || '').toLowerCase() === 'successful')
    .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
  const allTxBase = s ? [
    ...(s.money.receipts || []).map(r => ({ when: r.creditedAt, label: r.kind === 'activation' ? '🔘 Activation Payment' : '📋 Form Purchase', ref: r.txRef || r.transactionId, amount: Number(r.amount) || 0, dir: 'in' })),
    ...withdrawals.map(w => ({ when: w.createdAt || w.verifiedAt, label: '🏧 Withdrawal', ref: w.reference, amount: Number(w.amount) || 0, dir: 'out' })),
  ].sort((a, b) => String(b.when || '').localeCompare(String(a.when || ''))) : [];
  const allTx = allTxBase.slice(0, 50);
  const filteredTx = txSearch.trim()
    ? allTxBase.filter(t =>
        String(t.label).toLowerCase().includes(txSearch.toLowerCase()) ||
        String(t.ref || '').toLowerCase().includes(txSearch.toLowerCase()) ||
        String(t.amount).includes(txSearch))
    : allTx;
  const txBadge = (status) => {
    const st = String(status || 'unknown').toLowerCase();
    if (st === 'successful') return { bg: '#d1fae5', color: '#166534', icon: '🟢', text: 'Successful' };
    if (st === 'failed') return { bg: '#fee2e2', color: '#991b1b', icon: '🔴', text: 'Failed' };
    return { bg: '#fef3c7', color: '#92400e', icon: '🟡', text: st.charAt(0).toUpperCase() + st.slice(1) };
  };

  // ---- v3.0 diary filtering + pagination ----
  const filteredAudit = audit.filter(a => {
    const matchesFilter = diaryFilter === 'all' || String(a.action) === diaryFilter;
    const q = diarySearch.trim().toLowerCase();
    const matchesSearch = !q ||
      String(a.action).toLowerCase().includes(q) ||
      String(a.actor).toLowerCase().includes(q) ||
      JSON.stringify(a.details || {}).toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });
  const totalPages = Math.max(1, Math.ceil(filteredAudit.length / settings.pageSize));
  const safePage = Math.min(diaryPage, totalPages);
  const diaryRows = filteredAudit.slice((safePage - 1) * settings.pageSize, safePage * settings.pageSize);
  const uniqueActions = Array.from(new Set(audit.map(a => String(a.action))));

  // ---- v3.0 event feed (pausable + searchable) ----
  const feedSource = feedPaused ? pausedAudit : audit;
  const feedEvents = liveSearch.trim()
    ? feedSource.filter(a =>
        String(a.action).toLowerCase().includes(liveSearch.toLowerCase()) ||
        String(a.actor).toLowerCase().includes(liveSearch.toLowerCase()))
    : feedSource;

  // ---- v3.0 CSV export builders ----
  const exportDiary = () => downloadCSV(`namtls-audit-diary-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['When', 'Action', 'Who', 'Details'],
    ...filteredAudit.map(a => [dayMonth(a.at), a.action, a.actor, JSON.stringify(a.details)]),
  ]);
  const exportLogins = () => downloadCSV(`namtls-login-activity-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['When', 'Action', 'Who'],
    ...loginEvents.map(a => [dayMonth(a.at), a.action, a.actor]),
  ]);
  const exportElection = () => downloadCSV(`namtls-election-results-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['Position', 'Candidate', 'Votes', 'Share %'],
    ...Object.entries((s && s.election.byPosition) || {}).flatMap(([position, list]) => {
      const posTotal = list.reduce((a, c) => a + (Number(c.votes) || 0), 0);
      return list.map(c => [position, c.name, c.votes || 0, posTotal > 0 ? ((c.votes / posTotal) * 100).toFixed(1) : '0.0']);
    }),
  ]);
  const exportTx = () => downloadCSV(`namtls-transactions-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['When', 'Activity', 'Reference', 'Direction', 'Amount'],
    ...allTxBase.map(t => [dayMonth(t.when), t.label, t.ref, t.dir === 'in' ? 'IN' : 'OUT', t.amount]),
  ]);

  // ---- v3.0 next-sync countdown ----
  const secondsSinceSync = lastSync ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 1000) : settings.interval;
  const nextSyncIn = Math.max(0, settings.interval - secondsSinceSync);

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
          <h3 style={{ color: '#FFD700', margin: 0 }}>🛡️ Super Admin</h3>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#FFD700', fontSize: '24px', cursor: 'pointer', padding: 0 }}>×</button>
        </div>
        {SUPER_VIEWS.map(item => (
          <div key={item.key} onClick={() => { setActiveView(item.key); setSidebarOpen(false); }}
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
        <div style={{ marginTop: '20px', padding: '10px 12px', background: 'rgba(255,215,0,0.08)', borderRadius: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6' }}>
          ⌨️ Shortcuts<br />1-8 switch views<br />R force refresh<br />/ focus search
        </div>
        <button onClick={() => navigate('/admin-dashboard')}
                style={{ width: '100%', padding: '12px', marginTop: '16px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          ← Admin Dashboard
        </button>
        <button onClick={endSuperSession}
                style={{ width: '100%', padding: '12px', marginTop: '8px', background: 'rgba(220,38,38,0.2)', color: '#fecaca', border: '1px solid rgba(220,38,38,0.4)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          🔒 End Super Session
        </button>
      </div>

      {/* Main */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {/* Topbar */}
        <div style={{ background: '#003366', borderRadius: '12px', padding: '16px 24px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setSidebarOpen(true)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <span style={{ display: 'block', width: '18px', height: '2px', background: '#FFD700' }}></span>
              <span style={{ display: 'block', width: '18px', height: '2px', background: '#FFD700' }}></span>
              <span style={{ display: 'block', width: '18px', height: '2px', background: '#FFD700' }}></span>
            </button>
            <div>
              <h2 style={{ margin: 0, color: '#FFD700' }}>Super Admin Dashboard</h2>
              <span style={{ fontSize: '12px', opacity: 0.8 }}>NAMTLS Control Room v3.0</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="animate-pulse-slow" style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a', marginRight: '8px' }}></span>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>LIVE · {s ? s.online.count : '…'} online</span>
            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
              {lastSync ? `Synced ${clock(lastSync)} · next in ${nextSyncIn}s` : 'Syncing…'}
            </div>
          </div>
        </div>

        {/* v3.0 toolbar — print, force refresh, session countdown */}
        <div className="no-print" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
          <button onClick={forceRefresh} style={btnGhost} title="Force refresh now (R)">🔄 Refresh now</button>
          <button onClick={() => window.print()} style={btnGhost} title="Print or save this view as PDF">🖨️ Print / PDF</button>
          <button onClick={pauseFeed} style={{ ...btnGhost, background: feedPaused ? '#003366' : '#e8ecf0', color: feedPaused ? '#FFD700' : '#334155' }} title="Freeze/unfreeze the live event feed">
            {feedPaused ? '▶ Resume Feed' : '⏸ Pause Feed'}
          </button>
          <div style={{ marginLeft: 'auto', background: '#003366', color: 'white', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 'bold' }}>
            ⏳ Session ends in <span style={{ color: '#FFD700', fontFamily: 'monospace' }}>{sessionCountdown}</span>
          </div>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: 'bold' }}>{error} — retrying…</div>}

        {/* ====================== OVERVIEW ====================== */}
        {activeView === 'overview' && (
          <>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🟢</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{s ? s.online.count : '…'}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Online Right Now</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>👥</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{s ? s.people.totalStudents : '…'}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Registered Students</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗳️</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{s ? s.people.voted : '…'}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Votes Cast (Total)</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>💰</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{s ? naira(s.money.paymentsTodaySum) : '…'}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Payments Today</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏦</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{s ? naira(s.money.balance) : '…'}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Withdrawal Balance</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔑</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{s ? s.people.loginsToday : '…'}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Logins Today</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🚨</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: s && s.people.failedLogins > 0 ? '#dc2626' : '#003366' }}>{s ? s.people.failedLogins : '…'}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Failed Logins Today</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔘</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{s ? s.election.activeMode : '…'}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Election Mode</div>
              </div>
            </div>

            {/* v3.0 live session trends */}
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 4px 0' }}>📈 Live Trends (this session)</h3>
              <p style={{ color: '#888', fontSize: '12px', margin: '0 0 16px 0' }}>Tracked since {clock(sessionStart)} · one point per sync</p>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1', minWidth: '240px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>🗳️ Total Votes — latest: {voteHistory.length ? voteHistory[voteHistory.length - 1] : '…'}</div>
                  <Sparkline data={voteHistory} color="#16a34a" fill="rgba(22,163,74,0.10)" />
                </div>
                <div style={{ flex: '1', minWidth: '240px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>🟢 Online Users — latest: {onlineHistory.length ? onlineHistory[onlineHistory.length - 1] : '…'}</div>
                  <Sparkline data={onlineHistory} color="#003366" />
                </div>
                <div style={{ flex: '1', minWidth: '240px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>⚡ API Latency — latest: {latencyHistory.length ? latencyHistory[latencyHistory.length - 1] + 'ms' : '…'}</div>
                  <Sparkline data={latencyHistory} color="#b8860b" fill="rgba(184,134,11,0.10)" />
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>⚡ Right Now</h3>
              {s && Object.keys(s.online.byPage).length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr><th style={thStyle}>Page</th><th style={thStyle}>People</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(s.online.byPage).sort((a, b) => b[1] - a[1]).map(([page, count]) => (
                      <tr key={page}><td style={tdStyle}>{page}</td><td style={{ ...tdStyle, fontWeight: 'bold' }}>{count}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No one else is online right now.</p>}
            </div>

            {/* v3.0 quick navigation */}
            <div style={cardStyle} className="no-print">
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>🚀 Quick Jump</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {SUPER_VIEWS.filter(v => v.key !== 'overview').map(v => (
                  <button key={v.key} onClick={() => setActiveView(v.key)} style={btnGhost}>{v.icon} {v.label}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ====================== LIVE MONITOR ====================== */}
        {activeView === 'live' && s && (
          <>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>👀 People On Each Page (live)</h3>
              {Object.keys(s.online.byPage).length > 0 ? Object.entries(s.online.byPage).sort((a, b) => b[1] - a[1]).map(([page, count]) => (
                <div key={page} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#334155', marginBottom: '4px' }}>
                    <span>{page}</span><span style={{ fontWeight: 'bold' }}>{count}</span>
                  </div>
                  <div style={{ background: '#e8ecf0', borderRadius: '4px', height: '8px' }}>
                    <div style={{ background: '#003366', borderRadius: '4px', height: '8px', width: Math.min(100, (count / Math.max(...Object.values(s.online.byPage))) * 100) + '%' }}></div>
                  </div>
                </div>
              )) : <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No one is online right now.</p>}
            </div>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>🟢 Everyone Online ({s.online.count})</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={thStyle}>Visitor</th><th style={thStyle}>Role</th><th style={thStyle}>Page</th><th style={thStyle}>Last Seen</th></tr></thead>
                <tbody>
                  {s.online.list.map(u => (
                    <tr key={u.id}>
                      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{u.id}</td>
                      <td style={tdStyle}>{u.role === 'admin' ? '👑 Admin' : u.role === 'staff' ? '💼 Staff' : u.role === 'student' ? '🎓 Student' : '👀 Visitor'}</td>
                      <td style={tdStyle}>{u.page}</td>
                      <td style={tdStyle}>{settings.relative ? relTime(u.lastSeen) : clock(u.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>
                📡 Live Event Feed {feedPaused && <span style={{ fontSize: '12px', color: '#b8860b' }}>(⏸ paused)</span>}
              </h3>
              <input
                id="super-search"
                value={liveSearch}
                onChange={(e) => setLiveSearch(e.target.value)}
                placeholder="🔍 Filter events by action or actor…  (press / to focus)"
                style={searchInputStyle}
              />
              {feedEvents.slice(0, 20).map(a => (
                <div key={a.id} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: '1px solid #eee', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8', minWidth: '70px' }}>{settings.relative ? relTime(a.at) : clock(a.at)}</span>
                  <span style={{ color: a.action && a.action.includes('FAILED') ? '#dc2626' : a.action && a.action.includes('VOTE') ? '#16a34a' : '#003366', fontWeight: 'bold', minWidth: '170px' }}>{a.action}</span>
                  <span style={{ color: '#666' }}>{a.actor}</span>
                </div>
              ))}
              {feedEvents.length === 0 && <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No events match.</p>}
            </div>
          </>
        )}

        {/* ====================== PEOPLE ====================== */}
        {activeView === 'people' && s && (
          <>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>👥</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{s.people.totalStudents}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Students</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗳️</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{s.people.voted}{s.people.totalStudents > 0 ? ` (${Math.round((s.people.voted / s.people.totalStudents) * 100)}%)` : ''}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Voted / Turnout</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🆕</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{s.people.registrationsToday}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Registrations Today</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🚨</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: s.people.failedLogins > 0 ? '#dc2626' : '#003366' }}>{s.people.failedLogins}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Failed Logins Today</div>
              </div>
            </div>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>🔑 Login Activity</h3>
              <input
                value={peopleSearch}
                onChange={(e) => setPeopleSearch(e.target.value)}
                placeholder="🔍 Filter logins by action or person…"
                style={searchInputStyle}
              />
              {loginEvents.filter(a =>
                !peopleSearch.trim() ||
                String(a.action).toLowerCase().includes(peopleSearch.toLowerCase()) ||
                String(a.actor).toLowerCase().includes(peopleSearch.toLowerCase())
              ).length > 0 ? (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={thStyle}>When</th><th style={thStyle}>Action</th><th style={thStyle}>Who</th></tr></thead>
                    <tbody>
                      {loginEvents.filter(a =>
                        !peopleSearch.trim() ||
                        String(a.action).toLowerCase().includes(peopleSearch.toLowerCase()) ||
                        String(a.actor).toLowerCase().includes(peopleSearch.toLowerCase())
                      ).map(a => (
                        <tr key={a.id}>
                          <td style={tdStyle}>{stamp(a.at)}</td>
                          <td style={{ ...tdStyle, color: a.action.includes('FAILED') ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>{a.action}</td>
                          <td style={tdStyle}>{a.actor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={exportLogins} style={{ ...btnGhost, marginTop: '12px' }}>📥 Export CSV</button>
                </>
              ) : <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No login activity recorded yet today.</p>}
            </div>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>
                ✉️ Support Messages {s.support && s.support.unread ? `(${s.support.unread} unread)` : ''}
              </h3>
              {(s.support && s.support.recent && s.support.recent.length > 0) ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={thStyle}>When</th><th style={thStyle}>From</th><th style={thStyle}>Message</th><th style={thStyle}>Status</th></tr></thead>
                  <tbody>
                    {s.support.recent.map(m => (
                      <tr key={m.id}>
                        <td style={tdStyle}>{stamp(m.timestamp)}</td>
                        <td style={{ ...tdStyle, fontWeight: 'bold' }}>{m.name || '—'}</td>
                        <td style={{ ...tdStyle, maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(m.message || '').slice(0, 60)}</td>
                        <td style={tdStyle}>{m.status === 'unread' ? '🔵 Unread' : '✅ Read'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No support messages yet.</p>}
            </div>
          </>
        )}

        {/* ====================== ELECTION ====================== */}
        {activeView === 'election' && s && (
          <>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗳️</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{totalVotes.toLocaleString()}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Total Votes (All Positions)</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>👥</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{allCandidates.length}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Candidates</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📈</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{turnoutPct}%</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Student Turnout</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{Object.keys(s.election.byPosition).length}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Positions Contested</div>
              </div>
            </div>

            {/* v3.0 live vote trend */}
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 4px 0' }}>📈 Vote Trend (this session)</h3>
              <p style={{ color: '#888', fontSize: '12px', margin: '0 0 8px 0' }}>Live total across all positions · updates every {settings.interval}s</p>
              <Sparkline data={voteHistory} color="#16a34a" fill="rgba(22,163,74,0.10)" width={640} height={60} />
              <div className="no-print">
                <button onClick={exportElection} style={{ ...btnGhost, marginTop: '12px' }}>📥 Export Results CSV</button>
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 8px 0' }}>🗳️ Election Watch</h3>
              <p style={{ color: '#666', fontSize: '14px' }}>Mode: <strong>{s.election.activeMode}</strong> · Votes today: <strong>{s.election.votesToday}</strong></p>
              <input
                value={electionSearch}
                onChange={(e) => setElectionSearch(e.target.value)}
                placeholder="🔍 Search candidate by name…"
                style={searchInputStyle}
              />
            </div>
            {Object.keys(s.election.byPosition).length === 0 && (
              <div style={cardStyle}><p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No candidates yet.</p></div>
            )}
            {Object.entries(s.election.byPosition).map(([position, list]) => {
              const visible = list.filter(c => !electionSearch.trim() || String(c.name).toLowerCase().includes(electionSearch.toLowerCase()));
              if (visible.length === 0) return null;
              const top = list[0] ? list[0].votes : 0;
              const posTotal = list.reduce((a, c) => a + (Number(c.votes) || 0), 0);
              return (
                <div style={cardStyle} key={position}>
                  <h3 style={{ color: '#003366', margin: '0 0 4px 0' }}>{position}</h3>
                  <p style={{ color: '#888', fontSize: '12px', margin: '0 0 12px 0' }}>{posTotal.toLocaleString()} total votes · {list.length} candidate{list.length !== 1 ? 's' : ''}</p>
                  {visible.map(c => {
                    const share = posTotal > 0 ? ((c.votes / posTotal) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={c.id} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#334155', marginBottom: '4px' }}>
                          <span>{c.votes === top && top > 0 ? '👑 ' : ''}{c.name}</span>
                          <span style={{ fontWeight: 'bold' }}>{c.votes} <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>({share}%)</span></span>
                        </div>
                        <div style={{ background: '#e8ecf0', borderRadius: '4px', height: '8px' }}>
                          <div style={{ background: top > 0 && c.votes === top ? '#FFD700' : '#94a3b8', borderRadius: '4px', height: '8px', width: (top > 0 ? (c.votes / top) * 100 : 0) + '%', transition: 'width 0.4s ease' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        )}

        {/* ====================== MONEY & PRICING ====================== */}
        {activeView === 'money' && s && (
          <>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 8px 0' }}>💰 Activation Price Book</h3>
              <p style={{ color: '#666', fontSize: '13px', margin: '0 0 16px 0' }}>
                The activation fee is the <strong>sum of these three boxes</strong>. Change them to anything you want —
                the payment page, the verifier and the webhook all read THIS, immediately. Setting all boxes to 0 makes activation free.
                Free Years (comma separated, e.g. 2026/2027) skip payment entirely.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <label style={{ fontSize: '13px', color: '#334155', fontWeight: 'bold' }}>🧰 Database Maintenance (₦)</label>
                  <input type="number" min="0" value={price.maintenance} onChange={(e) => setPrice({ ...price, maintenance: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box', fontSize: '14px', outline: 'none', marginTop: '6px' }} />
                </div>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <label style={{ fontSize: '13px', color: '#334155', fontWeight: 'bold' }}>🔄 Site Update (₦)</label>
                  <input type="number" min="0" value={price.siteUpdate} onChange={(e) => setPrice({ ...price, siteUpdate: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box', fontSize: '14px', outline: 'none', marginTop: '6px' }} />
                </div>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <label style={{ fontSize: '13px', color: '#334155', fontWeight: 'bold' }}>⬆️ Database Upgrading (₦)</label>
                  <input type="number" min="0" value={price.databaseUpgrading} onChange={(e) => setPrice({ ...price, databaseUpgrading: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box', fontSize: '14px', outline: 'none', marginTop: '6px' }} />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', color: '#334155', fontWeight: 'bold' }}>🎁 Free Years</label>
                <input value={price.freeYears} onChange={(e) => setPrice({ ...price, freeYears: e.target.value })} placeholder="e.g. 2026/2027"
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box', fontSize: '14px', outline: 'none', marginTop: '6px' }} />
              </div>
              <div style={{ background: '#003366', color: '#FFD700', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 'bold', marginBottom: '12px' }}>
                Total Activation Fee = {naira((Number(price.maintenance) || 0) + (Number(price.siteUpdate) || 0) + (Number(price.databaseUpgrading) || 0))}
              </div>
              {priceLoaded ? (
                <button onClick={savePricing} disabled={priceBusy} style={{ ...btnSuccess, opacity: priceBusy ? 0.6 : 1, cursor: priceBusy ? 'not-allowed' : 'pointer' }}>
                  {priceBusy ? '⏳ Saving...' : '💾 Save Price Book'}
                </button>
              ) : <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>Loading current prices…</p>}
              {priceMsg.text && (
                <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', background: priceMsg.type === 'error' ? '#fee2e2' : '#d1fae5', color: priceMsg.type === 'error' ? '#991b1b' : '#166534' }}>
                  {priceMsg.text}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏦</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{naira(s.money.balance)}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Withdrawal Balance</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📈</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{naira(s.money.totalReceived)}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Total Ever Received</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏧</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{naira(successfulWithdrawn)}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Total Withdrawn</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📋</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{formPurchases.length}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Form Purchases</div>
              </div>
              <div style={statCardStyle}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📅</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{s.money.paymentsToday} ({naira(s.money.paymentsTodaySum)})</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Payments Today</div>
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 16px 0' }}>🧾 Transactions Center — every naira in and out</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {[['all', '🧾 All'], ['activation', '🔘 Activation'], ['forms', '📋 Form Purchases'], ['withdrawals', '🏧 Withdrawals']].map(([k, l]) => (
                  <button key={k} onClick={() => setTxTab(k)}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', background: txTab === k ? '#003366' : '#e8ecf0', color: txTab === k ? '#FFD700' : '#334155' }}>
                    {l}
                  </button>
                ))}
              </div>

              <input
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="🔍 Search transactions by activity, reference or amount…"
                style={searchInputStyle}
              />

              {txTab === 'all' && (
                filteredTx.length > 0 ? (
                  <>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={thStyle}>When</th><th style={thStyle}>Activity</th><th style={thStyle}>Reference</th><th style={{ ...thStyle, textAlign: 'right' }}>Amount</th></tr></thead>
                      <tbody>
                        {filteredTx.map((t, i) => (
                          <tr key={i}>
                            <td style={tdStyle}>{stamp(t.when)}</td>
                            <td style={tdStyle}>{t.label}</td>
                            <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '11px', cursor: 'pointer' }} onClick={() => copyRef(t.ref)} title="Click to copy">{t.ref} 📋</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: t.dir === 'in' ? '#16a34a' : '#dc2626' }}>{t.dir === 'in' ? '+' : '−'}{naira(t.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button onClick={exportTx} style={{ ...btnGhost, marginTop: '12px' }}>📥 Export CSV</button>
                  </>
                ) : <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No transactions match.</p>
              )}

              {txTab === 'activation' && (
                (s.money.receipts || []).filter(r => r.kind === 'activation').length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={thStyle}>When</th><th style={thStyle}>Reference</th><th style={{ ...thStyle, textAlign: 'right' }}>Amount</th></tr></thead>
                    <tbody>
                      {(s.money.receipts || []).filter(r => r.kind === 'activation').map(r => (
                        <tr key={r.id}>
                          <td style={tdStyle}>{stamp(r.creditedAt)}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '11px', cursor: 'pointer' }} onClick={() => copyRef(r.txRef)} title="Click to copy">{r.txRef} 📋</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{naira(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No activation payments