// NAMATLS Super Admin Dashboard — the control room.
// Structure is a twin of AdminDashboard.jsx (same sidebar, topbar, cards,
// buttons, colors) so it feels native to the app.
// Powers:
//   📊 Overview   — the whole system at a glance, live
//   👀 Live       — who is online, on which page, right now + event feed
//   👥 People     — students, logins, failed attempts
//   🗳️ Election   — live votes per position
//   💰 Money      — THE PRICE BOOK (Database Maintenance, Site Update,
//                   Database Upgrading) + payments + balance
//   🛠️ System     — database health, presence cleanup, session
//   📖 Diary      — the audit trail (every recorded action)
// Data refreshes by itself every 10 seconds.
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
];

const naira = (n) => '₦' + (Number(n) || 0).toLocaleString();
const clock = (iso) => {
  try { return new Date(iso).toLocaleTimeString(); } catch (e) { return '—'; }
};
const dayMonth = (iso) => {
  try { return new Date(iso).toLocaleDateString() + ' ' + new Date(iso).toLocaleTimeString(); } catch (e) { return '—'; }
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

  // ---- price book state (Money & Pricing) ----
  const [price, setPrice] = useState({ maintenance: '', siteUpdate: '', databaseUpgrading: '', freeYears: '' });
  const [priceLoaded, setPriceLoaded] = useState(false);
  const [priceMsg, setPriceMsg] = useState({ type: '', text: '' });
  const [priceBusy, setPriceBusy] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState('');

  const loadStats = useCallback(async () => {
    const t0 = Date.now();
    try {
      const res = await superAdminApi('superStats');
      setStats(res.stats);
      setError('');
      setLatencyMs(Date.now() - t0);
      setLastSync(new Date().toISOString());
    } catch (e) {
      setError(e.message || 'Failed to load stats');
    }
  }, []);

  useEffect(() => {
    loadStats();
    pollRef.current = setInterval(loadStats, 10000);
    return () => clearInterval(pollRef.current);
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
    navigate('/admin-dashboard');
  };

  // ===================== STYLES (twins of AdminDashboard) =====================
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
  const btnSuccess = { ...btnPrimary, background: '#16a34a' };
  const thStyle = { padding: '10px', textAlign: 'left', borderBottom: '2px solid #e8ecf0', fontSize: '13px', color: '#003366' };
  const tdStyle = { padding: '10px', borderBottom: '1px solid #eee', fontSize: '13px', color: '#334155' };

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
        <button onClick={() => navigate('/admin-dashboard')}
                style={{ width: '100%', padding: '12px', marginTop: '20px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
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
        <div style={{ background: '#003366', borderRadius: '12px', padding: '16px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setSidebarOpen(true)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <span style={{ display: 'block', width: '18px', height: '2px', background: '#FFD700' }}></span>
              <span style={{ display: 'block', width: '18px', height: '2px', background: '#FFD700' }}></span>
              <span style={{ display: 'block', width: '18px', height: '2px', background: '#FFD700' }}></span>
            </button>
            <div>
              <h2 style={{ margin: 0, color: '#FFD700' }}>Super Admin Dashboard</h2>
              <span style={{ fontSize: '12px', opacity: 0.8 }}>NAMTLS Control Room</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="animate-pulse-slow" style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a', marginRight: '8px' }}></span>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>LIVE · {s ? s.online.count : '…'} online</span>
            {lastSync && <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>Synced {clock(lastSync)}</div>}
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
                      <td style={tdStyle}>{clock(u.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>📡 Live Event Feed</h3>
              {audit.slice(0, 20).map(a => (
                <div key={a.id} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: '1px solid #eee', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8', minWidth: '70px' }}>{clock(a.at)}</span>
                  <span style={{ color: a.action && a.action.includes('FAILED') ? '#dc2626' : a.action && a.action.includes('VOTE') ? '#16a34a' : '#003366', fontWeight: 'bold', minWidth: '170px' }}>{a.action}</span>
                  <span style={{ color: '#666' }}>{a.actor}</span>
                </div>
              ))}
              {audit.length === 0 && <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No events recorded yet.</p>}
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
              {loginEvents.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={thStyle}>When</th><th style={thStyle}>Action</th><th style={thStyle}>Who</th></tr></thead>
                  <tbody>
                    {loginEvents.map(a => (
                      <tr key={a.id}>
                        <td style={tdStyle}>{dayMonth(a.at)}</td>
                        <td style={{ ...tdStyle, color: a.action.includes('FAILED') ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>{a.action}</td>
                        <td style={tdStyle}>{a.actor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No login activity recorded yet today.</p>}
            </div>
          </>
        )}

        {/* ====================== ELECTION ====================== */}
        {activeView === 'election' && s && (
          <>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 8px 0' }}>🗳️ Election Watch</h3>
              <p style={{ color: '#666', fontSize: '14px' }}>Mode: <strong>{s.election.activeMode}</strong> · Votes today: <strong>{s.election.votesToday}</strong></p>
            </div>
            {Object.keys(s.election.byPosition).length === 0 && (
              <div style={cardStyle}><p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No candidates yet.</p></div>
            )}
            {Object.entries(s.election.byPosition).map(([position, list]) => {
              const top = list[0] ? list[0].votes : 0;
              return (
                <div style={cardStyle} key={position}>
                  <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>{position}</h3>
                  {list.map(c => (
                    <div key={c.id} style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#334155', marginBottom: '4px' }}>
                        <span>{c.votes === top && top > 0 ? '👑 ' : ''}{c.name}</span>
                        <span style={{ fontWeight: 'bold' }}>{c.votes}</span>
                      </div>
                      <div style={{ background: '#e8ecf0', borderRadius: '4px', height: '8px' }}>
                        <div style={{ background: top > 0 ? '#FFD700' : '#94a3b8', borderRadius: '4px', height: '8px', width: (top > 0 ? (c.votes / top) * 100 : 0) + '%' }}></div>
                      </div>
                    </div>
                  ))}
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
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📅</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#003366' }}>{s.money.paymentsToday} ({naira(s.money.paymentsTodaySum)})</div>
                <div style={{ fontSize: '13px', color: '#666' }}>Payments Today</div>
              </div>
            </div>

            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>🧾 Recent Payments</h3>
              {s.money.receipts.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={thStyle}>When</th><th style={thStyle}>Reference</th><th style={thStyle}>Type</th><th style={{ ...thStyle, textAlign: 'right' }}>Amount</th></tr></thead>
                  <tbody>
                    {s.money.receipts.map(r => (
                      <tr key={r.id}>
                        <td style={tdStyle}>{dayMonth(r.creditedAt)}</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{r.txRef}</td>
                        <td style={tdStyle}>{r.kind === 'activation' ? '🔘 Activation' : '📋 Form'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{naira(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No payments recorded yet.</p>}
            </div>

            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>🔘 Activated Academic Years</h3>
              {Object.keys(s.money.activations).length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={thStyle}>Year</th><th style={thStyle}>Paid</th><th style={{ ...thStyle, textAlign: 'right' }}>Amount</th><th style={thStyle}>Paid At</th></tr></thead>
                  <tbody>
                    {Object.entries(s.money.activations).map(([year, info]) => (
                      <tr key={year}>
                        <td style={{ ...tdStyle, fontWeight: 'bold' }}>{year}</td>
                        <td style={{ ...tdStyle, color: info.paid ? '#16a34a' : '#dc2626' }}>{info.paid ? '✅ Paid' : '❌ Not paid'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{info.paid ? naira(info.amount) : '—'}</td>
                        <td style={tdStyle}>{info.paidAt ? dayMonth(info.paidAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>No years activated yet.</p>}
            </div>
          </>
        )}

        {/* ====================== SYSTEM ====================== */}
        {activeView === 'system' && s && (
          <>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>🛠️ Database Health</h3>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ background: latencyMs !== null && latencyMs < 2000 ? '#d1fae5' : '#fee2e2', color: latencyMs !== null && latencyMs < 2000 ? '#166534' : '#991b1b', borderRadius: '8px', padding: '14px 20px', fontWeight: 'bold', fontSize: '14px' }}>
                  {latencyMs !== null && latencyMs < 2000 ? '🟢 Healthy' : '🔴 Slow / Error'} — responded in {latencyMs !== null ? latencyMs + 'ms' : '…'}
                </div>
                <div style={{ background: '#e8ecf0', color: '#334155', borderRadius: '8px', padding: '14px 20px', fontWeight: 'bold', fontSize: '14px' }}>
                  Server time: {clock(s.serverTime)}
                </div>
              </div>
            </div>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>🧹 Presence Housekeeping</h3>
              <p style={{ color: '#666', fontSize: '13px', margin: '0 0 12px 0' }}>Removes presence records of people who left more than 10 minutes ago (this also happens automatically).</p>
              <button onClick={cleanupPresence} style={btnPrimary}>🧹 Clean Up Now</button>
              {cleanupMsg && <p style={{ color: '#334155', fontSize: '13px', margin: '12px 0 0 0', fontWeight: 'bold' }}>{cleanupMsg}</p>}
            </div>
            <div style={cardStyle}>
              <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>🔒 Session</h3>
              <p style={{ color: '#666', fontSize: '13px', margin: '0 0 12px 0' }}>Your super admin session expires automatically after 2 hours, or end it now.</p>
              <button onClick={endSuperSession} style={{ ...btnPrimary, background: '#dc2626' }}>🔒 End Super Session</button>
            </div>
          </>
        )}

        {/* ====================== AUDIT DIARY ====================== */}
        {activeView === 'diary' && s && (
          <div style={cardStyle}>
            <h3 style={{ color: '#003366', margin: '0 0 12px 0' }}>📖 Audit Diary — every recorded action</h3>
            {audit.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={thStyle}>When</th><th style={thStyle}>Action</th><th style={thStyle}>Who</th><th style={thStyle}>Details</th></tr></thead>
                <tbody>
                  {audit.map(a => (
                    <tr key={a.id}>
                      <td style={tdStyle}>{dayMonth(a.at)}</td>
                      <td style={{ ...tdStyle, fontWeight: 'bold', color: String(a.action).includes('FAILED') ? '#dc2626' : '#003366' }}>{a.action}</td>
                      <td style={tdStyle}>{a.actor}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '11px', color: '#888' }}>{JSON.stringify(a.details).slice(0, 80)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>The diary is empty — actions will appear here as they happen.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
