import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function StudentLogin() {
  const [authMode, setAuthMode] = useState('signup');
  const [form, setForm] = useState({ name: '', matric: '', level: '' });
  const [loginForm, setLoginForm] = useState({ matric: '' });
  const [message, setMessage] = useState({ type: '', text: '' });
  const navigate = useNavigate();

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // STRICT VALIDATION: Must be CAPITAL. Accepts CMOS or CMO/MTL
  const isValidMatric = (matric) => {
    const regex = /^(CMOS|CMO\/MTL)\/\d{5}\/\d{4}$/;
    return regex.test(matric.trim());
  };

  const handleSignup = () => {
    if (!form.name || !form.matric || !form.level) {
      showMessage('error', 'Please fill all fields');
      return;
    }
    
    if (!isValidMatric(form.matric)) {
      showMessage('error', 'Access Denied. Use Correct Format');
      return;
    }
    try {
      const students = JSON.parse(localStorage.getItem('students')) || [];
      if (students.find(s => s.matric === form.matric)) {
        showMessage('error', 'Matric Number already registered. Please Login.');
        setAuthMode('login');
        return;
      }
      const newStudent = { ...form, hasVoted: false };
      localStorage.setItem('students', JSON.stringify([...students, newStudent]));
      localStorage.setItem('studentInfo', JSON.stringify(newStudent));
      localStorage.setItem('voted', 'false');
      navigate('/student');
    } catch (e) {
      showMessage('error', 'ERROR: Could not save to localStorage: ' + e.message);
    }
  };

  const handleLogin = () => {
    if (!loginForm.matric) {
      showMessage('error', 'Please fill Matric Number');
      return;
    }
    
    if (!isValidMatric(loginForm.matric)) {
      showMessage('error', 'Access Denied. Use Correct Format');
      return;
    }
    try {
      const students = JSON.parse(localStorage.getItem('students')) || [];
      const foundStudent = students.find(s => s.matric === loginForm.matric);
      if (!foundStudent) {
        showMessage('error', 'Matric Number not found. Please Register.');
        return;
      }
      localStorage.setItem('studentInfo', JSON.stringify(foundStudent));
      navigate('/student');
    } catch (e) {
      showMessage('error', 'ERROR: Could not read localStorage: ' + e.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#003366', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'white', padding: '32px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <h1 style={{ color: '#003366', marginBottom: '4px', fontSize: '24px' }}>
          {authMode === 'signup' ? 'Student Registration' : 'Student Login'}
        </h1>
        <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
          {authMode === 'signup' ? 'Create account to continue' : 'Login with your Matric Number'}
        </p>

        {message.text && (
          <div style={{ padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '14px', fontWeight: 'bold', textAlign: 'center',
            background: message.type === 'error' ? '#fee2e2' : '#d1fae5',
            color: message.type === 'error' ? '#dc2626' : '#16a34a',
            border: message.type === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0' }}>
            {message.text}
          </div>
        )}

        {authMode === 'signup' ? (
          <>
            <input placeholder="Full Name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '12px', boxSizing: 'border-box', fontSize: '14px' }} />
            <input placeholder="Matric Number" value={form.matric}
              onChange={(e) => setForm({ ...form, matric: e.target.value })}
              style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '12px', boxSizing: 'border-box', fontSize: '14px' }} />
            <input placeholder="Level (e.g. 100,200,300)" value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '12px', boxSizing: 'border-box', fontSize: '14px' }} />
            <button onClick={handleSignup}
              style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
              Register
            </button>
            <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '14px' }}>
              Already have an account?{' '}
              <button onClick={() => { setAuthMode('login'); setMessage({ type: '', text: '' }); }}
                style={{ color: '#2563eb', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '0' }}>
                Login
              </button>
            </p>
          </>
        ) : (
          <>
            <input placeholder="Matric Number" value={loginForm.matric}
              onChange={(e) => setLoginForm({ ...loginForm, matric: e.target.value })}
              style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '16px', boxSizing: 'border-box', fontSize: '14px' }} />
            <button onClick={handleLogin}
              style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
              Login
            </button>
            <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '14px' }}>
              Don't have an account?{' '}
              <button onClick={() => { setAuthMode('signup'); setMessage({ type: '', text: '' }); }}
                style={{ color: '#2563eb', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '0' }}>
                Register
              </button>
            </p>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/" style={{ color: '#2563eb', fontSize: '13px' }}>Back to Home</Link>
        </div>
      </div>
    </div>
  );
}