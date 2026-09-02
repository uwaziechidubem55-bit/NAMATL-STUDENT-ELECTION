// NAMTLS Super Admin Dashboard — the control room.
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
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminApi } from '../utils/superAdminApi';
import { adminApi } from '../utils/adminApi';

const SUPER_VIEWS = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'activity', label: 'Live Monitor', icon: '👀' },
  { key: 'election', label: 'Election', icon: '🗳️' },
  { key: 'finance', label: 'Finance', icon: '💰' },
  { key: 'system', label: 'System', icon: '🛠️' },
  { key: 'audit', label: 'Audit Log', icon: '📖' },
];

const COLORS = {
  bg: '#f4f7fb',
  panel: '#ffffff',
  navy: '#0f2d52',
  navySoft: '#183d6b',
  gold: '#f5c84c',
  goldSoft: '#fff4cc',
  text: '#10233d',
  muted: '#64748b',
  border: '#e5edf5',
  success: '#16a34a',
  successSoft: '#dcfce7',
  warning: '#d97706',
  warningSoft: '#fef3c7',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  info: '#2563eb',
  infoSoft: '#dbeafe',
  slateSoft: '#eef2f7',
};

const REFRESH_OPTIONS = [5000, 10000, 15000, 30000, 60000];

const cardShadow = '0 10px 28px rgba(15,45,82,0.08)';
const baseRadius = 18;

const naira = (value) => `₦${(Number(value) || 0).toLocaleString()}`;

const safeDate = (value) => {
  try {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
};

const clock = (value) => {
  const d = safeDate(value);
  return d ? d.toLocaleTimeString() : '—';
};

const dateTime = (value) => {
  const d = safeDate(value);
  return d ? d.toLocaleString() : '—';
};

const relativeTime = (value) => {
  const d = safeDate(value);
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
};

const pct = (value, total) => {
  if (!total) return 0;
  return Math.round((Number(value || 0) / Number(total || 1)) * 100);
};

const clamp = (num, min, max) => Math.max(min, Math.min(max, num));

const detailsText = (details) => {
  try {
    if (!details) return '—';
    if (typeof details === 'string') return details;
    return JSON.stringify(details);
  } catch {
    return '—';
  }
};

const csvEscape = (value) => {
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
};

const downloadTextFile = (filename, content, contentType = 'text/plain;charset=utf-8;') => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const exportRowsToCsv = (filename, rows) => {
  if (!rows || !rows.length) return;
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(',')),
  ];
  downloadTextFile(filename, lines.join('\n'), 'text/csv;charset=utf-8;');
};

const getTone = (tone) => {
  switch (tone) {
    case 'success':
      return { bg: COLORS.successSoft, fg: COLORS.success, bd: '#bbf7d0' };
    case 'warning':
      return { bg: COLORS.warningSoft, fg: COLORS.warning, bd: '#fde68a' };
    case 'danger':
      return { bg: COLORS.dangerSoft, fg: COLORS.danger, bd: '#fecaca' };
    case 'info':
      return { bg: COLORS.infoSoft, fg: COLORS.info, bd: '#bfdbfe' };
    case 'gold':
      return { bg: COLORS.goldSoft, fg: '#9a6700', bd: '#fde68a' };
    default:
      return { bg: COLORS.slateSoft, fg: COLORS.navy, bd: '#dbe4ef' };
  }
};

function Badge({ children, tone = 'default' }) {
  const c = getTone(tone);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

function Panel({ title, subtitle, right, children, style = {} }) {
  return (
    <div
      style={{
        background: COLORS.panel,
        borderRadius: baseRadius,
        padding: 20,
        boxShadow: cardShadow,
        border: `1px solid ${COLORS.border}`,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: COLORS.text, fontSize: 18 }}>{title}</h3>
          {subtitle ? (
            <div style={{ marginTop: 6, fontSize: 13, color: COLORS.muted }}>{subtitle}</div>
          ) : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

function MetricCard({ icon, label, value, helper, tone = 'default' }) {
  const c = getTone(tone);
  return (
    <div
      style={{
        background: COLORS.panel,
        borderRadius: baseRadius,
        padding: 18,
        boxShadow: cardShadow,
        border: `1px solid ${COLORS.border}`,
        minWidth: 180,
        flex: '1 1 200px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>{label}</div>
          <div style={{ marginTop: 10, color: COLORS.text, fontSize: 28, fontWeight: 800 }}>{value}</div>
          {helper ? <div style={{ marginTop: 8, color: COLORS.muted, fontSize: 12 }}>{helper}</div> : null}
        </div>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            display: 'grid',
            placeItems: 'center',
            background: c.bg,
            color: c.fg,
            fontSize: 24,
            border: `1px solid ${c.bd}`,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function MiniBar({ label, value, max, rightLabel, color = COLORS.navy }) {
  const width = max > 0 ? `${Math.max(6, (value / max) * 100)}%` : '0%';
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 6,
          fontSize: 13,
          color: COLORS.text,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontWeight: 700, color: COLORS.muted }}>{rightLabel ?? value}</span>
      </div>
      <div style={{ height: 10, background: '#edf2f7', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            width,
            height: '100%',
            borderRadius: 999,
            background: color,
            transition: 'width 0.25s ease',
          }}
        />
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div
      style={{
        padding: '28px 18px',
        textAlign: 'center',
        background: '#fbfdff',
        borderRadius: 16,
        border: `1px dashed ${COLORS.border}`,
      }}
    >
      <div style={{ fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>{title}</div>
      <div style={{ color: COLORS.muted, fontSize: 13 }}>{subtitle}</div>
    </div>
  );
}

const buttonStyle = (variant = 'primary', disabled = false) => {
  const map = {
    primary: { bg: COLORS.navy, color: '#fff', border: COLORS.navy },
    gold: { bg: COLORS.gold, color: COLORS.navy, border: COLORS.gold },
    success: { bg: COLORS.success, color: '#fff', border: COLORS.success },
    danger: { bg: COLORS.danger, color: '#fff', border: COLORS.danger },
    ghost: { bg: '#fff', color: COLORS.text, border: COLORS.border },
    soft: { bg: COLORS.slateSoft, color: COLORS.text, border: '#d7e1ea' },
  };
  const c = map[variant] || map.primary;
  return {
    padding: '10px 14px',
    borderRadius: 12,
    border: `1px solid ${c.border}`,
    background: disabled ? '#e5e7eb' : c.bg,
    color: disabled ? '#94a3b8' : c.color,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700,
    fontSize: 13,
    transition: 'all 0.2s ease',
  };
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: '#fff',
  outline: 'none',
  fontSize: 14,
  color: COLORS.text,
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  marginBottom: 8,
  color: COLORS.text,
  fontSize: 13,
  fontWeight: 700,
};

const tableWrapStyle = {
  overflowX: 'auto',
  border: `1px solid ${COLORS.border}`,
  borderRadius: 14,
};

const thStyle = {
  textAlign: 'left',
  padding: '12px 14px',
  fontSize: 12,
  color: COLORS.muted,
  background: '#f8fbff',
  borderBottom: `1px solid ${COLORS.border}`,
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px 14px',
  fontSize: 13,
  color: COLORS.text,
  borderBottom: `1px solid ${COLORS.border}`,
  verticalAlign: 'top',
};

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const pollRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('overview');

  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState('');
  const [latencyMs, setLatencyMs] = useState(null);
  const [loading, setLoading] = useState(true);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshMs, setRefreshMs] = useState(10000);

  const [presenceFilter, setPresenceFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [txFilter, setTxFilter] = useState('all');

  const [price, setPrice] = useState({
    maintenance: '',
    siteUpdate: '',
    databaseUpgrading: '',
    freeYears: '',
  });
  const [priceMeta, setPriceMeta] = useState({
    total: 0,
    usingFallback: false,
    freeYears: [],
  });
  const [priceLoaded, setPriceLoaded] = useState(false);
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceMsg, setPriceMsg] = useState({ type: '', text: '' });

  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState('');

  const loadStats = useCallback(async (showSpinner = false) => {
    const started = Date.now();
    try {
      if (showSpinner) setLoading(true);
      const res = await superAdminApi('superStats');
      setStats(res.stats || null);
      setError('');
      setLatencyMs(Date.now() - started);
      setLastSync(new Date().toISOString());
    } catch (e) {
      const msg = e?.message || 'Failed to load dashboard';
      setError(msg);
      if (
        msg.toLowerCase().includes('super admin session required') ||
        msg.toLowerCase().includes('unauthorized') ||
        msg.includes('401') ||
        msg.includes('403')
      ) {
        localStorage.removeItem('superToken');
        navigate('/super-admin-login', { replace: true });
      }
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadStats(true);
  }, [loadStats]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (autoRefresh) {
      pollRef.current = setInterval(() => {
        loadStats(false);
      }, refreshMs);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [autoRefresh, refreshMs, loadStats]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await adminApi('getActivationPricing');
        if (!alive) return;
        const p = res.pricing || {};
        setPrice({
          maintenance: p.usingFallback ? '' : String(p.maintenance ?? ''),
          siteUpdate: p.usingFallback ? '' : String(p.siteUpdate ?? ''),
          databaseUpgrading: p.usingFallback ? '' : String(p.databaseUpgrading ?? ''),
          freeYears: Array.isArray(p.freeYears) ? p.freeYears.join(', ') : '',
        });
        setPriceMeta({
          total: Number(p.total) || 0,
          usingFallback: !!p.usingFallback,
          freeYears: Array.isArray(p.freeYears) ? p.freeYears : [],
        });
      } catch {
        // keep silent; dashboard still works
      } finally {
        if (alive) setPriceLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const savePricing = async () => {
    const maintenance = Number(price.maintenance || 0);
    const siteUpdate = Number(price.siteUpdate || 0);
    const databaseUpgrading = Number(price.databaseUpgrading || 0);

    if (![maintenance, siteUpdate, databaseUpgrading].every((n) => Number.isFinite(n) && n >= 0)) {
      setPriceMsg({ type: 'error', text: 'Maintenance, site update and database upgrading must be valid numbers.' });
      return;
    }

    setPriceBusy(true);
    setPriceMsg({ type: '', text: '' });

    try {
      const freeYears = String(price.freeYears || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const res = await superAdminApi('saveActivationPricing', {
        maintenance,
        siteUpdate,
        databaseUpgrading,
        freeYears,
      });

      setPriceMeta({
        total: Number(res?.pricing?.total) || maintenance + siteUpdate + databaseUpgrading,
        usingFallback: false,
        freeYears,
      });

      setPriceMsg({
        type: 'success',
        text: `Pricing saved successfully. New activation total: ${naira(
          Number(res?.pricing?.total) || maintenance + siteUpdate + databaseUpgrading
        )}`,
      });

      loadStats(false);
    } catch (e) {
      setPriceMsg({ type: 'error', text: e?.message || 'Failed to save pricing.' });
    } finally {
      setPriceBusy(false);
    }
  };

  const cleanupPresence = async () => {
    const proceed = window.confirm('Clean up stale presence records now?');
    if (!proceed) return;

    setCleanupBusy(true);
    setCleanupMsg('Cleaning up stale presence records...');
    try {
      const res = await superAdminApi('superCleanupPresence');
      setCleanupMsg(`Cleanup complete. Removed ${res?.removed || 0} stale record(s).`);
      loadStats(false);
    } catch (e) {
      setCleanupMsg(e?.message || 'Cleanup failed.');
    } finally {
      setCleanupBusy(false);
    }
  };

  const endSuperSession = () => {
    localStorage.removeItem('superToken');
    navigate('/admin-dashboard');
  };

  const s = stats || {};
  const online = s.online || { count: 0, byPage: {}, list: [] };
  const people = s.people || {
    totalStudents: 0,
    voted: 0,
    registrationsToday: 0,
    loginsToday: 0,
    failedLogins: 0,
  };
  const election = s.election || { byPosition: {}, votesToday: 0, activeMode: 'none' };
  const money = s.money || {
    balance: 0,
    totalReceived: 0,
    totalWithdrawn: 0,
    paymentsToday: 0,
    paymentsTodaySum: 0,
    activations: {},
    receipts: [],
    withdrawals: [],
    formPurchases: [],
  };
  const support = s.support || { unread: 0, recent: [] };
  const audit = Array.isArray(s.audit) ? s.audit : [];

  const turnout = pct(people.voted, people.totalStudents);
  const pageRows = useMemo(
    () => Object.entries(online.byPage || {}).sort((a, b) => Number(b[1]) - Number(a[1])),
    [online.byPage]
  );

  const positionRows = useMemo(() => {
    return Object.entries(election.byPosition || {}).map(([position, list]) => {
      const topVotes = list?.[0]?.votes || 0;
      const totalVotes = (list || []).reduce((sum, item) => sum + (Number(item.votes) || 0), 0);
      return { position, list: list || [], topVotes, totalVotes };
    });
  }, [election.byPosition]);

  const candidateCount = useMemo(
    () => positionRows.reduce((sum, item) => sum + item.list.length, 0),
    [positionRows]
  );

  const leaders = useMemo(() => {
    return positionRows
      .map((item) => ({
        position: item.position,
        name: item.list?.[0]?.name || '—',
        votes: item.list?.[0]?.votes || 0,
      }))
      .filter((item) => item.name && item.name !== '—');
  }, [positionRows]);

  const transactionRows = useMemo(() => {
    const receipts = (money.receipts || []).map((r) => ({
      when: r.creditedAt || r.createdAt || '',
      direction: 'Incoming',
      type: r.kind === 'activation' ? 'Activation Payment' : 'Form Purchase',
      reference: r.txRef || r.transactionId || r.reference || r.id || '—',
      amount: Number(r.amount) || 0,
      status: r.status || 'successful',
      actor: r.name || r.studentName || r.email || '—',
    }));

    const withdrawals = (money.withdrawals || []).map((w) => ({
      when: w.createdAt || w.verifiedAt || '',
      direction: 'Outgoing',
      type: 'Withdrawal',
      reference: w.reference || w.id || '—',
      amount: Number(w.amount) || 0,
      status: w.status || 'pending',
      actor: w.accountName || w.bankName || w.studentName || '—',
    }));

    return [...receipts, ...withdrawals].sort((a, b) =>
      String(b.when || '').localeCompare(String(a.when || ''))
    );
  }, [money.receipts, money.withdrawals]);

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return transactionRows.filter((row) => {
      const passType =
        txFilter === 'all'
          ? true
          : txFilter === 'incoming'
          ? row.direction === 'Incoming'
          : txFilter === 'outgoing'
          ? row.direction === 'Outgoing'
          : txFilter === 'activation'
          ? row.type === 'Activation Payment'
          : txFilter === 'form'
          ? row.type === 'Form Purchase'
          : txFilter === 'withdrawal'
          ? row.type === 'Withdrawal'
          : true;

      const hay = `${row.type} ${row.reference} ${row.actor} ${row.status}`.toLowerCase();
      return passType && (!q || hay.includes(q));
    });
  }, [transactionRows, txFilter, searchTerm]);

  const filteredOnlineUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (online.list || []).filter((row) => {
      const passRole = presenceFilter === 'all' ? true : row.role === presenceFilter;
      const hay = `${row.id} ${row.role} ${row.page}`.toLowerCase();
      return passRole && (!q || hay.includes(q));
    });
  }, [online.list, presenceFilter, searchTerm]);

  const filteredAudit = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return audit.filter((row) => {
      if (!q) return true;
      const hay = `${row.action || ''} ${row.actor || ''} ${detailsText(row.details)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [audit, auditSearch]);

  const healthScore = useMemo(() => {
    let score = 100;
    score -= clamp(Math.round((Number(latencyMs || 0) - 500) / 50), 0, 20);
    score -= clamp((people.failedLogins || 0) * 4, 0, 24);
    score -= clamp((support.unread || 0) * 2, 0, 12);
    if (!lastSync) score -= 10;
    if ((online.count || 0) === 0) score -= 5;
    return clamp(score, 0, 100);
  }, [latencyMs, people.failedLogins, support.unread, lastSync, online.count]);

  const healthTone =
    healthScore >= 85 ? 'success' : healthScore >= 70 ? 'info' : healthScore >= 50 ? 'warning' : 'danger';

  const healthLabel =
    healthScore >= 85
      ? 'Excellent'
      : healthScore >= 70
      ? 'Stable'
      : healthScore >= 50
      ? 'Watch'
      : 'Critical';

  const alerts = useMemo(() => {
    const items = [];
    if ((people.failedLogins || 0) > 0) {
      items.push({
        tone: 'danger',
        text: `${people.failedLogins} failed login attempt(s) recorded today.`,
      });
    }
    if ((support.unread || 0) > 0) {
      items.push({
        tone: 'warning',
        text: `${support.unread} unread support message(s) need attention.`,
      });
    }
    if ((money.withdrawals || []).some((w) => String(w.status || '').toLowerCase() === 'pending')) {
      items.push({
        tone: 'info',
        text: 'There are pending withdrawal records awaiting review.',
      });
    }
    if ((online.count || 0) === 0) {
      items.push({
        tone: 'warning',
        text: 'No active presence records detected right now.',
      });
    }
    if (!items.length) {
      items.push({
        tone: 'success',
        text: 'No active operational warnings right now.',
      });
    }
    return items;
  }, [people.failedLogins, support.unread, money.withdrawals, online.count]);

  const successfulWithdrawals = useMemo(() => {
    return (money.withdrawals || [])
      .filter((w) => String(w.status || '').toLowerCase() === 'successful')
      .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
  }, [money.withdrawals]);

  const currentInputTotal =
    (Number(price.maintenance) || 0) +
    (Number(price.siteUpdate) || 0) +
    (Number(price.databaseUpgrading) || 0);

  const exportAuditCsv = () => {
    exportRowsToCsv(
      'super-admin-audit-log.csv',
      filteredAudit.map((row) => ({
        when: dateTime(row.at),
        action: row.action,
        actor: row.actor,
        details: detailsText(row.details),
      }))
    );
  };

  const exportTransactionsCsv = () => {
    exportRowsToCsv(
      'super-admin-transactions.csv',
      filteredTransactions.map((row) => ({
        when: dateTime(row.when),
        direction: row.direction,
        type: row.type,
        reference: row.reference,
        amount: row.amount,
        status: row.status,
        actor: row.actor,
      }))
    );
  };

  const exportOnlineCsv = () => {
    exportRowsToCsv(
      'super-admin-online-users.csv',
      filteredOnlineUsers.map((row) => ({
        visitor_id: row.id,
        role: row.role,
        page: row.page,
        last_seen: dateTime(row.lastSeen),
      }))
    );
  };

  const exportDashboardSnapshot = () => {
    downloadTextFile(
      'super-admin-dashboard-snapshot.json',
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          latencyMs,
          lastSync,
          stats,
        },
        null,
        2
      ),
      'application/json;charset=utf-8;'
    );
  };

  const renderOverview = () => (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <MetricCard
          icon="🟢"
          label="Live Users"
          value={online.count || 0}
          helper={`${pageRows.length} active page zone(s)`}
          tone="success"
        />
        <MetricCard
          icon="👥"
          label="Registered Students"
          value={people.totalStudents || 0}
          helper={`${people.registrationsToday || 0} joined today`}
          tone="info"
        />
        <MetricCard
          icon="🗳️"
          label="Turnout"
          value={`${turnout}%`}
          helper={`${people.voted || 0} of ${people.totalStudents || 0} students voted`}
          tone="gold"
        />
        <MetricCard
          icon="⚡"
          label="Votes Today"
          value={election.votesToday || 0}
          helper={`Mode: ${election.activeMode || 'none'}`}
          tone="default"
        />
        <MetricCard
          icon="💰"
          label="Current Balance"
          value={naira(money.balance)}
          helper={`${naira(money.paymentsTodaySum)} received today`}
          tone="success"
        />
        <MetricCard
          icon="📩"
          label="Unread Support"
          value={support.unread || 0}
          helper={`${support.recent?.length || 0} recent support entries`}
          tone={support.unread ? 'warning' : 'success'}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          gap: 20,
          marginBottom: 20,
        }}
      >
        <Panel
          title="Operational Radar"
          subtitle="Fast read of what needs your attention right now."
          right={<Badge tone={healthTone}>Health {healthScore}/100 · {healthLabel}</Badge>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 18 }}>
            <div>
              {alerts.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    marginBottom: 10,
                    border: `1px solid ${getTone(item.tone).bd}`,
                    background: getTone(item.tone).bg,
                    color: getTone(item.tone).fg,
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {item.text}
                </div>
              ))}
            </div>

            <div
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                padding: 16,
                background: '#fbfdff',
              }}
            >
              <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                SYSTEM SNAPSHOT
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: COLORS.muted, fontSize: 13 }}>API latency</span>
                  <strong style={{ color: COLORS.text }}>{latencyMs != null ? `${latencyMs} ms` : '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: COLORS.muted, fontSize: 13 }}>Last sync</span>
                  <strong style={{ color: COLORS.text }}>{lastSync ? relativeTime(lastSync) : '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: COLORS.muted, fontSize: 13 }}>Audit events loaded</span>
                  <strong style={{ color: COLORS.text }}>{audit.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: COLORS.muted, fontSize: 13 }}>Candidates tracked</span>
                  <strong style={{ color: COLORS.text }}>{candidateCount}</strong>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Hot Pages" subtitle="Where users are concentrated right now.">
          {pageRows.length ? (
            pageRows.map(([page, count]) => (
              <MiniBar
                key={page}
                label={page}
                value={Number(count) || 0}
                max={Number(pageRows[0]?.[1]) || 1}
                rightLabel={`${count} user(s)`}
                color={COLORS.navy}
              />
            ))
          ) : (
            <EmptyState title="No page activity" subtitle="Live page traffic will appear here as users browse the system." />
          )}
        </Panel>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
          marginBottom: 20,
        }}
      >
        <Panel title="Election Leaders" subtitle="Top candidate per position.">
          {leaders.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {leaders.map((item) => (
                <div
                  key={item.position}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                    background: '#fbfdff',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: COLORS.text }}>{item.position}</div>
                    <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>{item.name}</div>
                  </div>
                  <Badge tone="gold">👑 {item.votes} vote(s)</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No leaders yet" subtitle="Candidate standings will appear once candidates and votes exist." />
          )}
        </Panel>

        <Panel title="Finance Pulse" subtitle="Quick money and transaction intelligence.">
          <div style={{ display: 'grid', gap: 12 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: COLORS.successSoft,
                  border: `1px solid #bbf7d0`,
                }}
              >
                <div style={{ color: COLORS.success, fontSize: 12, fontWeight: 800 }}>TODAY'S INFLOW</div>
                <div style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, marginTop: 6 }}>
                  {naira(money.paymentsTodaySum)}
                </div>
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: COLORS.infoSoft,
                  border: `1px solid #bfdbfe`,
                }}
              >
                <div style={{ color: COLORS.info, fontSize: 12, fontWeight: 800 }}>SUCCESSFUL WITHDRAWALS</div>
                <div style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, marginTop: 6 }}>
                  {naira(successfulWithdrawals)}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: '#fbfdff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <span style={{ color: COLORS.muted, fontSize: 13 }}>Transactions loaded</span>
                <strong style={{ color: COLORS.text }}>{transactionRows.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <span style={{ color: COLORS.muted, fontSize: 13 }}>Pending withdrawals</span>
                <strong style={{ color: COLORS.text }}>
                  {(money.withdrawals || []).filter((w) => String(w.status || '').toLowerCase() === 'pending').length}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: COLORS.muted, fontSize: 13 }}>Price-book total</span>
                <strong style={{ color: COLORS.text }}>
                  {naira(priceMeta.total || currentInputTotal)}
                </strong>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Support Inbox Snapshot" subtitle="Newest messages from users.">
        {support.recent?.length ? (
          <div style={tableWrapStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>From</th>
                  <th style={thStyle}>Message</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {support.recent.map((msg) => (
                  <tr key={msg.id}>
                    <td style={tdStyle}>{dateTime(msg.timestamp)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{msg.name || '—'}</td>
                    <td style={tdStyle}>
                      <div style={{ maxWidth: 420, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {String(msg.message || '—')}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <Badge tone={msg.status === 'unread' ? 'warning' : 'success'}>
                        {msg.status === 'unread' ? 'Unread' : 'Read'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No support messages" subtitle="Support messages will show here when users contact the system." />
        )}
      </Panel>
    </>
  );

  const renderActivity = () => (
    <>
      <Panel
        title="Live Monitor"
        subtitle="Watch online visitors, their pages, and real-time event flow."
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={exportOnlineCsv} style={buttonStyle('ghost')} type="button">
              Export online CSV
            </button>
            <Badge tone="success">{online.count} online now</Badge>
          </div>
        }
        style={{ marginBottom: 20 }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 180, flex: '1 1 220px' }}>
            <label style={labelStyle}>Search users / pages</label>
            <input
              style={inputStyle}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search id, role, page, reference..."
            />
          </div>
          <div style={{ minWidth: 180, flex: '0 0 220px' }}>
            <label style={labelStyle}>Role filter</label>
            <select
              style={inputStyle}
              value={presenceFilter}
              onChange={(e) => setPresenceFilter(e.target.value)}
            >
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="student">Student</option>
              <option value="visitor">Visitor</option>
            </select>
          </div>
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 20, marginBottom: 20 }}>
        <Panel title="Active Sessions" subtitle="Presence feed for everyone currently online.">
          {filteredOnlineUsers.length ? (
            <div style={tableWrapStyle}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Visitor</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Page</th>
                    <th style={thStyle}>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOnlineUsers.map((row) => (
                    <tr key={row.id}>
                      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{row.id}</td>
                      <td style={tdStyle}>
                        <Badge
                          tone={
                            row.role === 'admin'
                              ? 'gold'
                              : row.role === 'staff'
                              ? 'info'
                              : row.role === 'student'
                              ? 'success'
                              : 'default'
                          }
                        >
                          {row.role || 'visitor'}
                        </Badge>
                      </td>
                      <td style={tdStyle}>{row.page || '—'}</td>
                      <td style={tdStyle}>{dateTime(row.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No matching sessions" subtitle="Try another search or role filter." />
          )}
        </Panel>

        <Panel title="Page Concentration" subtitle="Which screens users are spending time on.">
          {pageRows.length ? (
            pageRows.map(([page, count]) => (
              <MiniBar
                key={page}
                label={page}
                value={Number(count) || 0}
                max={Number(pageRows[0]?.[1]) || 1}
                rightLabel={`${count} active`}
                color={COLORS.navySoft}
              />
            ))
          ) : (
            <EmptyState title="No live page traffic" subtitle="Activity bars appear when active presence records are available." />
          )}
        </Panel>
      </div>

      <Panel
        title="Recent Event Feed"
        subtitle="Newest system actions from the audit stream."
        right={<Badge tone="info">{audit.length} loaded event(s)</Badge>}
      >
        {audit.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {audit.slice(0, 25).map((item) => {
              const tone =
                String(item.action || '').includes('FAILED')
                  ? 'danger'
                  : String(item.action || '').includes('VOTE')
                  ? 'success'
                  : 'default';

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 180px 1fr',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                    background: '#fbfdff',
                    alignItems: 'start',
                  }}
                >
                  <div style={{ color: COLORS.muted, fontSize: 12 }}>{clock(item.at)}</div>
                  <div>
                    <Badge tone={tone}>{item.action || 'UNKNOWN'}</Badge>
                  </div>
                  <div>
                    <div style={{ color: COLORS.text, fontWeight: 700 }}>{item.actor || 'Unknown actor'}</div>
                    <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>
                      {detailsText(item.details)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No recent events" subtitle="Audit activity will appear here automatically." />
        )}
      </Panel>
    </>
  );

  const renderElection = () => (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <MetricCard icon="🏁" label="Election Mode" value={election.activeMode || 'none'} helper="Current operating mode" tone="gold" />
        <MetricCard icon="🧑‍💼" label="Positions" value={positionRows.length} helper="Tracked offices" tone="info" />
        <MetricCard icon="🙋" label="Candidates" value={candidateCount} helper="Across all positions" tone="default" />
        <MetricCard icon="⚡" label="Votes Today" value={election.votesToday || 0} helper="Today's recorded vote actions" tone="success" />
      </div>

      {positionRows.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {positionRows.map((item) => (
            <Panel
              key={item.position}
              title={item.position}
              subtitle={`${item.list.length} candidate(s) · ${item.totalVotes} total vote(s)`}
              right={
                item.list?.[0] ? (
                  <Badge tone="gold">
                    👑 {item.list[0].name} · {item.list[0].votes}
                  </Badge>
                ) : null
              }
            >
              {item.list.length ? (
                item.list.map((candidate) => (
                  <MiniBar
                    key={candidate.id}
                    label={candidate.name}
                    value={Number(candidate.votes) || 0}
                    max={item.topVotes || 1}
                    rightLabel={`${candidate.votes} vote(s)`}
                    color={candidate.votes === item.topVotes && item.topVotes > 0 ? COLORS.gold : COLORS.navy}
                  />
                ))
              ) : (
                <EmptyState title="No candidates" subtitle="Candidate data will appear here when available." />
              )}
            </Panel>
          ))}
        </div>
      ) : (
        <Panel title="Election Standings" subtitle="No candidate data is available yet.">
          <EmptyState title="No election standings" subtitle="Add candidates or wait for data to load." />
        </Panel>
      )}
    </>
  );

  const renderFinance = () => (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <MetricCard icon="💳" label="Payments Today" value={money.paymentsToday || 0} helper={naira(money.paymentsTodaySum)} tone="success" />
        <MetricCard icon="🏦" label="Balance" value={naira(money.balance)} helper="Available withdrawal balance" tone="info" />
        <MetricCard icon="📥" label="Total Received" value={naira(money.totalReceived)} helper="Lifetime received value" tone="default" />
        <MetricCard icon="📤" label="Total Withdrawn" value={naira(money.totalWithdrawn)} helper="Lifetime outgoing value" tone="warning" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 20, marginBottom: 20 }}>
        <Panel
          title="Activation Price Book"
          subtitle="Update the components that determine the activation amount."
          right={
            priceMeta.usingFallback ? (
              <Badge tone="warning">Using fallback defaults</Badge>
            ) : (
              <Badge tone="success">Live pricing active</Badge>
            )
          }
        >
          {!priceLoaded ? (
            <div style={{ color: COLORS.muted, fontSize: 14 }}>Loading pricing...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Database maintenance</label>
                  <input
                    type="number"
                    min="0"
                    style={inputStyle}
                    value={price.maintenance}
                    onChange={(e) => setPrice((prev) => ({ ...prev, maintenance: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Site update</label>
                  <input
                    type="number"
                    min="0"
                    style={inputStyle}
                    value={price.siteUpdate}
                    onChange={(e) => setPrice((prev) => ({ ...prev, siteUpdate: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Database upgrading</label>
                  <input
                    type="number"
                    min="0"
                    style={inputStyle}
                    value={price.databaseUpgrading}
                    onChange={(e) => setPrice((prev) => ({ ...prev, databaseUpgrading: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Free years (comma separated)</label>
                <input
                  style={inputStyle}
                  value={price.freeYears}
                  onChange={(e) => setPrice((prev) => ({ ...prev, freeYears: e.target.value }))}
                  placeholder="e.g. 2026/2027, 2027/2028"
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 14,
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: 16,
                  background: '#fbfdff',
                  border: `1px solid ${COLORS.border}`,
                  marginBottom: 14,
                }}
              >
                <div>
                  <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 800 }}>CALCULATED TOTAL</div>
                  <div style={{ color: COLORS.text, fontSize: 28, fontWeight: 900, marginTop: 4 }}>
                    {naira(currentInputTotal)}
                  </div>
                </div>
                <button type="button" onClick={savePricing} style={buttonStyle('primary', priceBusy)} disabled={priceBusy}>
                  {priceBusy ? 'Saving...' : 'Save pricing'}
                </button>
              </div>

              {priceMsg.text ? (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: getTone(priceMsg.type === 'success' ? 'success' : 'danger').bg,
                    color: getTone(priceMsg.type === 'success' ? 'success' : 'danger').fg,
                    border: `1px solid ${getTone(priceMsg.type === 'success' ? 'success' : 'danger').bd}`,
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {priceMsg.text}
                </div>
              ) : null}
            </>
          )}
        </Panel>

        <Panel title="Finance Utilities" subtitle="Quick finance context and exports.">
          <div style={{ display: 'grid', gap: 12 }}>
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: '#fbfdff',
              }}
            >
              <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 800 }}>ACTIVE PRICE BOOK TOTAL</div>
              <div style={{ color: COLORS.text, fontSize: 24, fontWeight: 800, marginTop: 6 }}>
                {naira(priceMeta.total || currentInputTotal)}
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: '#fbfdff',
              }}
            >
              <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>FREE YEARS</div>
              {priceMeta.freeYears?.length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {priceMeta.freeYears.map((year) => (
                    <Badge key={year} tone="gold">{year}</Badge>
                  ))}
                </div>
              ) : (
                <div style={{ color: COLORS.muted, fontSize: 13 }}>No free years configured.</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={exportTransactionsCsv} style={buttonStyle('ghost')}>
                Export transactions CSV
              </button>
              <button type="button" onClick={exportDashboardSnapshot} style={buttonStyle('soft')}>
                Export JSON snapshot
              </button>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="Transaction Center"
        subtitle="Search and filter payments and withdrawals."
        right={<Badge tone="info">{filteredTransactions.length} visible transaction(s)</Badge>}
        style={{ marginBottom: 20 }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ minWidth: 220, flex: '1 1 320px' }}>
            <label style={labelStyle}>Search reference / actor</label>
            <input
              style={inputStyle}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search transaction reference or actor..."
            />
          </div>
          <div style={{ minWidth: 200, flex: '0 0 240px' }}>
            <label style={labelStyle}>Transaction filter</label>
            <select style={inputStyle} value={txFilter} onChange={(e) => setTxFilter(e.target.value)}>
              <option value="all">All transactions</option>
              <option value="incoming">Incoming only</option>
              <option value="outgoing">Outgoing only</option>
              <option value="activation">Activation payments</option>
              <option value="form">Form purchases</option>
              <option value="withdrawal">Withdrawals</option>
            </select>
          </div>
        </div>

        {filteredTransactions.length ? (
          <div style={tableWrapStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>Direction</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Reference</th>
                  <th style={thStyle}>Actor</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((row, idx) => (
                  <tr key={`${row.reference}-${idx}`}>
                    <td style={tdStyle}>{dateTime(row.when)}</td>
                    <td style={tdStyle}>
                      <Badge tone={row.direction === 'Incoming' ? 'success' : 'warning'}>{row.direction}</Badge>
                    </td>
                    <td style={tdStyle}>{row.type}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{row.reference}</td>
                    <td style={tdStyle}>{row.actor}</td>
                    <td style={{ ...tdStyle, fontWeight: 800 }}>{naira(row.amount)}</td>
                    <td style={tdStyle}>
                      <Badge
                        tone={
                          String(row.status).toLowerCase() === 'successful'
                            ? 'success'
                            : String(row.status).toLowerCase() === 'failed'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No matching transactions" subtitle="Try another search or transaction filter." />
        )}
      </Panel>

      <Panel title="Form Purchase Records" subtitle="Recent form purchase entries tracked by the system.">
        {money.formPurchases?.length ? (
          <div style={tableWrapStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>Student</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {money.formPurchases.slice(0, 40).map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>{dateTime(row.paidAt)}</td>
                    <td style={tdStyle}>{row.name || row.studentName || '—'}</td>
                    <td style={tdStyle}>{row.email || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>
                      {naira(row.amount || row.price || row.paidAmount || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No form purchases" subtitle="Form purchase entries will appear here when available." />
        )}
      </Panel>
    </>
  );

  const renderSystem = () => (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <MetricCard icon="🧠" label="Health Score" value={`${healthScore}/100`} helper={healthLabel} tone={healthTone} />
        <MetricCard icon="📶" label="API Latency" value={latencyMs != null ? `${latencyMs} ms` : '—'} helper="Latest fetch roundtrip" tone="info" />
        <MetricCard icon="⏱️" label="Auto Refresh" value={autoRefresh ? 'On' : 'Off'} helper={`Every ${refreshMs / 1000}s`} tone={autoRefresh ? 'success' : 'warning'} />
        <MetricCard icon="🔐" label="Session State" value={localStorage.getItem('superToken') ? 'Active' : 'Missing'} helper="Super admin token check" tone={localStorage.getItem('superToken') ? 'success' : 'danger'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Panel title="Refresh Controls" subtitle="Tune how the dashboard keeps itself updated.">
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Refresh interval</label>
              <select
                style={inputStyle}
                value={refreshMs}
                onChange={(e) => setRefreshMs(Number(e.target.value))}
              >
                {REFRESH_OPTIONS.map((ms) => (
                  <option key={ms} value={ms}>
                    Every {ms / 1000} second(s)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setAutoRefresh((v) => !v)} style={buttonStyle(autoRefresh ? 'warning' : 'success')}>
                {autoRefresh ? 'Pause auto refresh' : 'Resume auto refresh'}
              </button>
              <button type="button" onClick={() => loadStats(false)} style={buttonStyle('primary')}>
                Refresh now
              </button>
            </div>
          </div>
        </Panel>

        <Panel title="Quick Actions" subtitle="Maintenance and export tools for super admin work.">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <button type="button" onClick={cleanupPresence} style={buttonStyle('danger', cleanupBusy)} disabled={cleanupBusy}>
              {cleanupBusy ? 'Cleaning...' : 'Cleanup stale presence'}
            </button>
            <button type="button" onClick={exportDashboardSnapshot} style={buttonStyle('ghost')}>
              Export JSON snapshot
            </button>
            <button type="button" onClick={exportAuditCsv} style={buttonStyle('soft')}>
              Export audit CSV
            </button>
          </div>
          {cleanupMsg ? (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: '#fbfdff',
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {cleanupMsg}
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel title="Diagnostics Board" subtitle="Server-time and operational state at a glance.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <div style={{ padding: 16, borderRadius: 14, background: '#fbfdff', border: `1px solid ${COLORS.border}` }}>
            <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 800 }}>SERVER TIME</div>
            <div style={{ marginTop: 8, color: COLORS.text, fontWeight: 800 }}>{dateTime(s.serverTime)}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, background: '#fbfdff', border: `1px solid ${COLORS.border}` }}>
            <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 800 }}>LAST CLIENT SYNC</div>
            <div style={{ marginTop: 8, color: COLORS.text, fontWeight: 800 }}>{dateTime(lastSync)}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, background: '#fbfdff', border: `1px solid ${COLORS.border}` }}>
            <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 800 }}>LOGIN RISK</div>
            <div style={{ marginTop: 8, color: COLORS.text, fontWeight: 800 }}>{people.failedLogins || 0} failed login(s)</div>
          </div>
          <div style={{ padding: 16, borderRadius: 14, background: '#fbfdff', border: `1px solid ${COLORS.border}` }}>
            <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 800 }}>SUPPORT LOAD</div>
            <div style={{ marginTop: 8, color: COLORS.text, fontWeight: 800 }}>{support.unread || 0} unread ticket(s)</div>
          </div>
        </div>
      </Panel>
    </>
  );

  const renderAudit = () => (
    <>
      <Panel
        title="Audit Diary"
        subtitle="Search through system actions, actors and details."
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={exportAuditCsv} style={buttonStyle('ghost')}>
              Export CSV
            </button>
            <Badge tone="info">{filteredAudit.length} visible</Badge>
          </div>
        }
        style={{ marginBottom: 20 }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 240, flex: '1 1 360px' }}>
            <label style={labelStyle}>Search action / actor / details</label>
            <input
              style={inputStyle}
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Search audit action, actor or details..."
            />
          </div>
        </div>
      </Panel>

      <Panel title="Audit Records" subtitle="Most recent audit events loaded from the server.">
        {filteredAudit.length ? (
          <div style={tableWrapStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Actor</th>
                  <th style={thStyle}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>{dateTime(row.at)}</td>
                    <td style={tdStyle}>
                      <Badge tone={String(row.action || '').includes('FAILED') ? 'danger' : 'default'}>
                        {row.action || 'UNKNOWN'}
                      </Badge>
                    </td>
                    <td style={tdStyle}>{row.actor || '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>
                      <div style={{ maxWidth: 520, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {detailsText(row.details)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No audit records found" subtitle="Try a different search or wait for new activity." />
        )}
      </Panel>
    </>
  );

  const renderActiveView = () => {
    switch (activeView) {
      case 'activity':
        return renderActivity();
      case 'election':
        return renderElection();
      case 'finance':
        return renderFinance();
      case 'system':
        return renderSystem();
      case 'audit':
        return renderAudit();
      case 'overview':
      default:
        return renderOverview();
    }
  };

  if (loading && !stats && !error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: `linear-gradient(135deg, ${COLORS.navy} 0%, #163b67 100%)`,
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20,
            padding: '26px 30px',
            textAlign: 'center',
            maxWidth: 420,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 10 }}>🛡️</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.gold }}>Loading Super Admin Dashboard</div>
          <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.84)', fontSize: 14 }}>
            Pulling live system stats, audit stream, finance data and presence records...
          </div>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: `linear-gradient(135deg, ${COLORS.navy} 0%, #163b67 100%)`,
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 20,
            padding: 28,
            maxWidth: 520,
            boxShadow: cardShadow,
            border: `1px solid ${COLORS.border}`,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
          <div style={{ color: COLORS.text, fontSize: 24, fontWeight: 800 }}>Unable to load dashboard</div>
          <div style={{ color: COLORS.muted, marginTop: 12, fontSize: 14 }}>{error}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <button type="button" onClick={() => loadStats(true)} style={buttonStyle('primary')}>
              Retry
            </button>
            <button type="button" onClick={() => navigate('/admin-dashboard')} style={buttonStyle('ghost')}>
              Back to Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, fontFamily: 'Arial, sans-serif', color: COLORS.text }}>
      <style>{`
        * { box-sizing: border-box; }
        .sa-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
        .sa-scroll::-webkit-scrollbar-thumb { background: #cdd8e3; border-radius: 999px; }
        .sa-scroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {sidebarOpen ? (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 12, 27, 0.35)',
            zIndex: 40,
          }}
        />
      ) : null}

      <aside
        className="sa-scroll"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          background: `linear-gradient(180deg, ${COLORS.navy} 0%, #0b2443 100%)`,
          padding: 20,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-292px)',
          transition: 'transform 0.25s ease',
          zIndex: 50,
          overflowY: 'auto',
          boxShadow: '20px 0 40px rgba(0,0,0,0.15)',
        }}
      >
        <div
          style={{
            padding: 18,
            borderRadius: 18,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
            CONTROL ROOM
          </div>
          <div style={{ color: COLORS.gold, fontSize: 24, fontWeight: 900 }}>Super Admin</div>
          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 8 }}>
            Live oversight for operations, voting, finance and audit.
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {SUPER_VIEWS.map((item) => {
            const active = activeView === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveView(item.key);
                  setSidebarOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: active ? '1px solid rgba(245,200,76,0.45)' : '1px solid transparent',
                  background: active ? 'rgba(245,200,76,0.12)' : 'transparent',
                  color: active ? COLORS.gold : 'rgba(255,255,255,0.82)',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: 14,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 24, display: 'grid', gap: 10 }}>
          <button type="button" onClick={() => navigate('/admin-dashboard')} style={buttonStyle('ghost')}>
            ← Back to Admin Dashboard
          </button>
          <button type="button" onClick={endSuperSession} style={buttonStyle('danger')}>
            🔒 End super session
          </button>
        </div>
      </aside>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: 20 }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${COLORS.navy} 0%, #163b67 100%)`,
            borderRadius: 26,
            padding: 22,
            color: '#fff',
            boxShadow: cardShadow,
            marginBottom: 22,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 18,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 20,
                  fontWeight: 800,
                }}
              >
                ☰
              </button>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: 800 }}>
                  NAMATL CONTROL CENTER
                </div>
                <h1 style={{ margin: '6px 0 8px', fontSize: 30, color: COLORS.gold }}>
                  Super Admin Dashboard
                </h1>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, maxWidth: 760 }}>
                  Cleaner structure, stronger visibility, and faster access to live election, financial and system intelligence.
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10, minWidth: 260 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Badge tone="success">LIVE · {online.count} online</Badge>
                <Badge tone={healthTone}>Health {healthScore}/100</Badge>
                <Badge tone="gold">{election.activeMode || 'none'}</Badge>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                <select
                  value={refreshMs}
                  onChange={(e) => setRefreshMs(Number(e.target.value))}
                  style={{
                    ...inputStyle,
                    width: 140,
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  {REFRESH_OPTIONS.map((ms) => (
                    <option key={ms} value={ms} style={{ color: COLORS.text }}>
                      {ms / 1000}s refresh
                    </option>
                  ))}
                </select>

                <button type="button" onClick={() => setAutoRefresh((v) => !v)} style={buttonStyle(autoRefresh ? 'warning' : 'success')}>
                  {autoRefresh ? 'Pause' : 'Resume'}
                </button>
                <button type="button" onClick={() => loadStats(false)} style={buttonStyle('gold')}>
                  Refresh now
                </button>
              </div>

              <div style={{ textAlign: 'right', color: 'rgba(255,255,255,0.72)', fontSize: 12 }}>
                Last sync: {lastSync ? `${dateTime(lastSync)} (${relativeTime(lastSync)})` : '—'}
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div
            style={{
              marginBottom: 20,
              padding: '12px 14px',
              borderRadius: 14,
              background: COLORS.dangerSoft,
              color: COLORS.danger,
              border: '1px solid #fecaca',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        {renderActiveView()}
      </main>
    </div>
  );
}
