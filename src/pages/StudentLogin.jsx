import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useStudentAuth from '../hooks/useStudentAuth';

export default function StudentLogin() {
  const [authMode, setAuthMode] = useState('signup');
  const [form, setForm] = useState({ name: '', matric: '', level: '' });
  const [loginMatric, setLoginMatric] = useState('');

  const [showVerifyPopup, setShowVerifyPopup] = useState(false);
  const [showKeyPopup, setShowKeyPopup] = useState(false);
  const [tempStudent, setTempStudent] = useState(null);
  const [fiveDigitCode, setFiveDigitCode] = useState('');
  const [uniqueKeyInput, setUniqueKeyInput] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');

  const { loading, message, handleSignup, completeSignup, handleLogin, verifyKeyAccess } = useStudentAuth();
  const navigate = useNavigate();

  const onSignup = async () => {
    const result = await handleSignup(form);
    console.log('[StudentLogin] handleSignup result:', result);
    if (result.success && result.phase === 'verify') {
      setTempStudent(result.tempStudent);
      setShowVerifyPopup(true);
      setFiveDigitCode('');
    }
  };

  const onVerifyCode = async () => {
    const result = await completeSignup(tempStudent, fiveDigitCode);
    console.log('[StudentLogin] completeSignup result:', result);
    if (result.success) {
      setGeneratedKey(result.generatedKey);
      setShowVerifyPopup(false);
      setShowKeyPopup(true);
    }
  };

  const onLogin = async () => {
    const result = await handleLogin(loginMatric);
    console.log('[StudentLogin] handleLogin result:', result);
    if (result.success && result.phase === 'key') {
      setTempStudent(result.tempStudent);
      setShowKeyPopup(true);
      setUniqueKeyInput('');
    }
  };

  const onKeyAccess = async () => {
    const result = await verifyKeyAccess(tempStudent, uniqueKeyInput);
    console.log('[StudentLogin] verifyKeyAccess result:', result);
    if (result.success) {
      setShowKeyPopup(false);
      navigate('/student');
    }
  };

  // ── Shared Popup Styles ───────────────────────────────────
  const popupOverlay = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.7)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  };

  const popupBox = {
    background: 'white', padding: '24px', borderRadius: '8px',
    width: '90%', maxWidth: '350px',
  };

  const inputStyle = {
    width: '100%', padding: '12px', border: '1px solid #ccc',
    borderRadius: '4px', marginBottom: '12px', boxSizing: 'border-box',
    fontSize: '14px',
  };

  const btnPrimary = {
    width: '100%', padding: '12px', background: '#2563eb', color: 'white',
    border: 'none', borderRadius: '4px', fontWeight: 'bold',
    cursor: 'pointer', fontSize: '16px',
  };

  const btnSuccess = {
    ...btnPrimary, background: '#16a34a',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: 'white', padding: '32px', borderRadius: '12px',
        width: '90%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#333' }}>
          {authMode === 'signup' ? 'Student Registration' : 'Student Login'}
        </h1>
        <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '14px' }}>
          {authMode === 'signup' ? 'Create account to continue' : 'Login with your Matric Number'}
        </p>

        {message.text && (
          <div style={{
            padding: '10px', borderRadius: '6px', marginBottom: '16px',
            background: message.type === 'error' ? '#fee2e2' : '#d1fae5',
            color: message.type === 'error' ? '#dc2626' : '#16a34a',
            fontSize: '14px', fontWeight: '500',
          }}>
            {message.text}
          </div>
        )}

        {authMode === 'signup' ? (
          <>
            <input placeholder="Full Name" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              style={inputStyle} disabled={loading} />

            <input placeholder="Matric Number" value={form.matric}
              onChange={e => setForm({ ...form, matric: e.target.value })}
              style={inputStyle} disabled={loading} />

            <input placeholder="Level (e.g. 200)" value={form.level}
              onChange={e => setForm({ ...form, level: e.target.value })}
              style={inputStyle} disabled={loading} />

            <button onClick={onSignup} disabled={loading} style={btnPrimary}>
              {loading ? 'Please wait...' : 'Register'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: '#666' }}>
              Already have an account?{' '}
              <button onClick={() => { setAuthMode('login'); setMessage({ type: '', text: '' }); }}
                style={{ color: '#2563eb', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '0' }}>
                Login
              </button>
            </p>
          </>
        ) : (
          <>
            <input placeholder="Matric Number" value={loginMatric}
              onChange={e => setLoginMatric(e.target.value)}
              style={inputStyle} disabled={loading} />

            <button onClick={onLogin} disabled={loading} style={btnPrimary}>
              {loading ? 'Please wait...' : 'Login'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: '#666' }}>
              Don't have an account?{' '}
              <button onClick={() => { setAuthMode('signup'); setMessage({ type: '', text: '' }); }}
                style={{ color: '#2563eb', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '0' }}>
                Register
              </button>
            </p>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/" style={{ color: '#888', fontSize: '13px' }}>Back to Home</Link>
        </div>
      </div>

      {/* ── POPUP 1: 5-Digit Verification ── */}
      {showVerifyPopup && (
        <div style={popupOverlay}>
          <div style={popupBox}>
            <h2 style={{ marginTop: 0, color: '#333' }}>Verification</h2>
            <p style={{ color: '#666', fontSize: '14px' }}>
              Enter the first 5 digits from your matric number
            </p>
            <input
              value={fiveDigitCode}
              onChange={e => setFiveDigitCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="e.g. XXXXX"
              maxLength={5}
              style={inputStyle}
              disabled={loading}
              autoFocus
            />
            <button onClick={onVerifyCode} disabled={loading} style={btnPrimary}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </div>
      )}

      {/* ── POPUP 2: Unique Key ── */}
      {showKeyPopup && (
        <div style={popupOverlay}>
          <div style={popupBox}>
            <h2 style={{ marginTop: 0, color: '#333' }}>
              {generatedKey ? 'Your Unique Code — Save This' : 'Access Voting Portal'}
            </h2>

            {generatedKey ? (
              <>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  This is your one-time access key. Save it now — you will need it to log in later.
                </p>
                <div style={{
                  background: '#f3f4f6', padding: '16px', borderRadius: '6px',
                  fontFamily: 'monospace', fontSize: '18px', fontWeight: 'bold',
                  textAlign: 'center', color: '#7c3aed', marginBottom: '16px',
                  letterSpacing: '1px',
                }}>
                  {generatedKey}
                </div>
                <button onClick={() => { setShowKeyPopup(false); navigate('/student'); }} style={btnSuccess}>
                  Continue to Portal
                </button>
              </>
            ) : (
              <>
                <p style={{ color: '#666', fontSize: '14px' }}>
                  Enter your unique code to access the voting portal
                </p>
                <input
                  value={uniqueKeyInput}
                  onChange={e => setUniqueKeyInput(e.target.value)}
                  placeholder="Paste your unique code"
                  style={inputStyle}
                  disabled={loading}
                  autoFocus
                />
                <button onClick={onKeyAccess} disabled={loading} style={btnPrimary}>
                  {loading ? 'Verifying...' : 'Access Voting Portal'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}