import { useState } from 'react';
import { adminApi } from '../utils/adminApi';

const cardStyle = {
  background: '#fff', borderRadius: '12px', padding: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0'
};

const input = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid #cbd5e1', fontSize: '14px', marginBottom: '12px',
  boxSizing: 'border-box'
};

const findBtn = {
  width: '100%', padding: '12px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700',
  fontSize: '15px', cursor: 'pointer'
};

const copyBtn = {
  padding: '8px 16px', background: '#003366', color: '#FFD700',
  border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '13px',
  cursor: 'pointer', whiteSpace: 'nowrap'
};

export default function UniqueKeyFinder() {
  const [name, setName] = useState('');
  const [matric, setMatric] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleFind = async () => {
    setError(''); setResult(null); setCopied(false);
    if (!name.trim() || !matric.trim()) {
      setError('Enter both the student full name and matric number.');
      return;
    }
    setLoading(true);
    try {
      const data = await adminApi('findStudentKey', { name: name.trim(), matric: matric.trim() });
      setResult(data);
    } catch (e) {
      setError(e.message || 'Could not find the student.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (key) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = key;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const StudentCard = ({ student }) => (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px', marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <strong style={{ fontSize: '15px' }}>{student.name}</strong>
          <div style={{ fontSize: '12px', color: '#666' }}>{student.matric} · Level {student.level}</div>
        </div>
        {student.hasVoted
          ? <span style={{ fontSize: '12px', background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: '12px', fontWeight: '600' }}>🗳️ Has Voted</span>
          : <span style={{ fontSize: '12px', background: '#e2e8f0', color: '#475569', padding: '3px 10px', borderRadius: '12px', fontWeight: '600' }}>Not Voted</span>}
      </div>
      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <code style={{
          background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px',
          padding: '8px 12px', fontSize: '14px', wordBreak: 'break-all', flex: 1,
          color: '#003366', fontWeight: 'bold'
        }}>{student.uniqueKey}</code>
        <button onClick={() => handleCopy(student.uniqueKey)} style={copyBtn}>
          {copied ? '✅ Copied!' : '📋 Copy'}
        </button>
      </div>
      <p style={{ fontSize: '12px', color: '#777', margin: '10px 0 0 0' }}>
        Share this key privately with the student. They enter it at login right after their matric number.
      </p>
    </div>
  );

  return (
    <div style={cardStyle}>
      <h2 style={{ color: '#003366', marginBottom: '4px' }}>🔑 Unique Key Finder</h2>
      <p style={{ color: '#888', fontSize: '13px', marginTop: 0, marginBottom: '16px' }}>
        Recover a student's lost unique key. Enter their full name and matric number, then click Find.
      </p>

      <input placeholder="Full Name (e.g. John Doe)" value={name} onChange={(e) => setName(e.target.value)} style={input} />
      <input placeholder="Matric Number (e.g. CMOS/XXXXX/2023)" value={matric} onChange={(e) => setMatric(e.target.value)} style={input} />

      <button onClick={handleFind} disabled={loading} style={{ ...findBtn, opacity: loading ? 0.6 : 1 }}>
        {loading ? '⏳ Searching…' : '🔍 Find Key'}
      </button>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', padding: '10px', marginTop: '12px', fontSize: '13px' }}>
          ⚠️ {error}
        </div>
      )}

      {result?.student && <StudentCard student={result.student} />}

      {result?.multiple && result.students.map((student, i) => <StudentCard key={i} student={student} />)}
    </div>
  );
}