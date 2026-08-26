// NAMATLS Staff Dashboard v1.0 — Real-time election monitoring for Lecturers & HOD
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../utils/adminApi';

export default function StaffDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [currentTime, setCurrentTime] = useState('');
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

  // Load all data
  const loadData = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const [candRes, studRes] = await Promise.all([
        adminApi('listCandidates'),
        adminApi('listStudents'),
      ]);
      setCandidates(candRes.items || []);
      setStudents(studRes.items || []);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch (e) {
      setError(e.message);
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

  // Group candidates by position
  const grouped = {};
  candidates.forEach(c => {
    const pos = c.position || 'Unknown';
    if (!grouped[pos]) grouped[pos] = [];
    grouped[pos].push(c);
  });
  const positions = Object.keys(grouped);

  // Compute stats
  const totalVotes = candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
  const votedStudents = students.filter(s => s.hasVoted).length;
  const totalStudents = students.length;
  const turnoutPct = totalStudents > 0 ? ((votedStudents / totalStudents) * 100).toFixed(1) : 0;
  const totalCandidates = candidates.length;

  // ====== STYLES ======
  const pageStyle = {
    minHeight: '100vh',
    background: '#f0f2f5',
    fontFamily: 'Arial, sans-serif',
  };

  const headerStyle = {
    background: 'linear-gradient(135deg, #003366 0%, #004080 50%, #003366 100%)',
    padding: '18px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '3px solid #FFD700',
    flexWrap: 'wrap',
    gap: '12px',
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

  const headerRightStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  };

  const timeStyle = {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '14px',
    fontFamily: 'monospace',
  };

  const backBtnStyle = {
    padding: '8px 18px',
    background: 'rgba(255,215,0,0.15)',
    border: '1px solid #FFD700',
    borderRadius: '8px',
    color: '#FFD700',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
  };

  const refreshBtnStyle = {
    padding: '8px 18px',
    background: autoRefresh ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)',
    border: `2px solid ${autoRefresh ? '#22c55e' : '#666'}`,
    borderRadius: '8px',
    color: autoRefresh ? '#22c55e' : '#aaa',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
  };

  const statsBarStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '14px',
    padding: '0',
    marginBottom: '16px',
  };

  const statCardStyle = {
    background: 'white',
    borderRadius: '12px',
    padding: '16px 18px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
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
  };

  const candidateRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 0',
    borderBottom: '1px solid #f0f2f5',
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
    background: '#003366',
    color: '#FFD700',
    fontFamily: 'Arial, sans-serif',
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
    fontFamily: 'Arial, sans-serif',
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

  const leaderBadgeStyle = (isLeader) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    background: isLeader ? 'rgba(34,197,94,0.12)' : 'transparent',
    color: isLeader ? '#16a34a' : 'transparent',
    border: isLeader ? '1px solid rgba(34,197,94,0.3)' : 'none',
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
      {/* HEADER */}
      <div style={headerStyle}>
        <div style={headerTitleStyle}>
          <span>📊</span>
          <span>NAMATL Staff Election Monitor</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,215,0,0.6)', fontWeight: 'normal' }}>
            v1.0
          </span>
        </div>
        <div style={headerRightStyle}>
          <span style={timeStyle}>🕐 {currentTime}</span>
          <button
            onClick={() => { setAutoRefresh(!autoRefresh); }}
            style={refreshBtnStyle}
            title={autoRefresh ? 'Auto-refresh ON (every 12s)' : 'Auto-refresh OFF'}
          >
            {autoRefresh ? '🔵 Live' : '⏸ Paused'}
          </button>
          <button
            onClick={() => loadData(false)}
            style={{
              ...backBtnStyle,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
            title="Refresh now"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => navigate('/')}
            style={backBtnStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,215,0,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,215,0,0.15)'; }}
          >
            ← Back
          </button>
        </div>
      </div>

      <div style={containerStyle}>
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
          <div style={{
            ...positionSectionStyle,
            textAlign: 'center',
            padding: '60px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
            <h3 style={{ color: '#666', margin: '0' }}>No candidates available yet</h3>
            <p style={{ color: '#999', fontSize: '14px', marginTop: '8px' }}>
              Candidates will appear here once added by the admin.
            </p>
          </div>
        ) : (
          sortedPositions.map(pos => {
            const posCandidates = grouped[pos];
            const posMaxVotes = Math.max(...posCandidates.map(c => c.votes || 0), 1);
            const posTotalVotes = posCandidates.reduce((s, c) => s + (c.votes || 0), 0);

            return (
              <div key={pos} style={positionSectionStyle}>
                <div style={positionTitleStyle}>
                  <span>{pos}</span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 'normal',
                    color: '#888',
                  }}>
                    ({posCandidates.length} candidate{posCandidates.length > 1 ? 's' : ''} · {posTotalVotes} total votes)
                  </span>
                </div>

                {/* Candidate bars */}
                {posCandidates.map((c) => {
                  const voteCount = c.votes || 0;
                  const pct = posTotalVotes > 0 ? ((voteCount / posTotalVotes) * 100) : 0;
                  const isLeader = voteCount === posMaxVotes && voteCount > 0;
                  return (
                    <div key={c.id} style={candidateRowStyle}>
                      {c.photoURL ? (
                        <img
                          src={c.photoURL}
                          alt={c.name}
                          style={photoCircleStyle}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div style={photoPlaceholderStyle}>
                          {c.name ? c.name.charAt(0).toUpperCase() : '?'}
                        </div>
                      )}

                      <div style={barContainerStyle}>
                        <div style={barLabelRowStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                            <span style={candidateNameStyle}>{c.name}</span>
                            {isLeader && (
                              <span style={leaderBadgeStyle(true)}>🏆 Leading</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={voteCountStyle}>
                              🗳️ {voteCount.toLocaleString()} vote{voteCount !== 1 ? 's' : ''}
                            </span>
                            <span style={{
                              fontSize: '12px',
                              color: '#888',
                              fontWeight: '600',
                              minWidth: '40px',
                              textAlign: 'right',
                            }}>
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
              </div>
            );
          })
        )}

        {/* FOOTER */}
        <div style={{
          textAlign: 'center',
          padding: '24px',
          color: '#aaa',
          fontSize: '12px',
          borderTop: '1px solid #e8ecf0',
          marginTop: '10px',
        }}>
          <div style={{ marginBottom: '4px' }}>
            NAMATL Staff Monitoring Dashboard — Official Election Portal
          </div>
          <div>
            National Association of Maritime Transport and Logistics Students, FUPRE
            &nbsp;·&nbsp; &copy; {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}