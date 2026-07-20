import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from './firebase'; // <-- make sure you have this
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

export default function StudentLogin() {
  const [authMode, setAuthMode] = useState('signup');
  const [form, setForm] = useState({ name: '', matric: '', level: '' });
  const [loginForm, setLoginForm] = useState({ matric: '' });
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // NEW STATES FOR VERIFICATION
  const [showVerifyPopup, setShowVerifyPopup] = useState(false);
  const [showKeyPopup, setShowKeyPopup] = useState(false);
  const [tempStudent, setTempStudent] = useState(null);
  const [fiveDigitCode, setFiveDigitCode] = useState('');
  const [uniqueKeyInput, setUniqueKeyInput] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  
  const navigate = useNavigate();

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // 1. Get first 5 digits from matric
  const getFirst5Digits = (matric) => {
    const numbers = matric.match(/\d+/g).join(''); 
    return numbers.substring(0, 5);
  }

  // 2. Generate unique key once
  const generateUniqueKey = () => {
    const random = Math.random().toString(36).substring(2, 12).toUpperCase();
    return `${random}-NAMATLEC-uniquekey`;
  }

  // STRICT VALIDATION: Must be CAPITAL. Accepts CMOS or CMO/MTL
  const isValidMatric = (matric) => {
    const regex = /^(CMOS|CMO\/MTL)\/\d{5}\/\d{4}$/;
    return regex.test(matric.trim());
  };

  const handleSignup = async () => {
    if (!form.name || !form.matric || !form.level) {
      showMessage('error', 'Please fill all fields');
      return;
    }

    if (!isValidMatric(form.matric)) {
      showMessage('error', 'Access Denied. Use Correct Format');
      return;
    }
    try {
      // CHECK FIREBASE IF MATRIC EXISTS
      const studentRef = doc(db, "students", form.matric);
      const studentSnap = await getDoc(studentRef);
      
      if (studentSnap.exists()) {
        showMessage('error', 'Matric Number already registered. Please Login.');
        setAuthMode('login');
        return;
      }
      
      // Save temp and show 5 digit verification popup
      setTempStudent({ ...form });
      setShowVerifyPopup(true);
      
    } catch (e) {
      showMessage('error', 'ERROR: ' + e.message);
    }
  };

  // NEW: Handle 5 digit verification after signup
  const handleVerifyCode = async () => {
    const correctCode = getFirst5Digits(tempStudent.matric);
    if(fiveDigitCode === correctCode){
      const key = generateUniqueKey();
      const newStudent = { ...tempStudent, uniqueKey: key, hasVoted: false };
      
      // SAVE TO FIREBASE
      await setDoc(doc(db, "students", tempStudent.matric), newStudent);
      localStorage.setItem('studentInfo', JSON.stringify(newStudent)); // keep for session
      
      setGeneratedKey(key);
      setShowVerifyPopup(false);
      setShowKeyPopup(true); // Show them their key once
      setFiveDigitCode('');
    } else {
      showMessage('error', 'Incorrect 5 digit code');
    }
  }

  const handleLogin = async () => {
    if (!loginForm.matric) {
      showMessage('error', 'Please fill Matric Number');
      return;
    }

    if (!isValidMatric(loginForm.matric)) {
      showMessage('error', 'Access Denied. Use Correct Format');
      return;
    }
    try {
      // CHECK FIREBASE
      const studentRef = doc(db, "students", loginForm.matric);
      const studentSnap = await getDoc(studentRef);
      
      if (!studentSnap.exists()) {
        showMessage('error', 'Matric Number not found. Please Register.');
        return;
      }
      
      const foundStudent = studentSnap.data();
      // NEW: Don't go straight to portal. Ask for unique key first
      setTempStudent(foundStudent);
      setShowKeyPopup(true);
      
    } catch (e) {
      showMessage('error', 'ERROR: ' + e.message);
    }
  };

  // NEW: Verify unique key before voting portal
  const handleKeyAccess = () => {
    if(uniqueKeyInput === tempStudent.uniqueKey){
      localStorage.setItem('studentInfo', JSON.stringify(tempStudent));
      setShowKeyPopup(false);
      setUniqueKeyInput('');
      navigate('/student'); // Only now go to voting portal
    } else {
      showMessage('error', 'Incorrect Unique Code. Access Denied');
    }
  }

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

      {/* POPUP 1: 5 DIGIT CODE AFTER REGISTRATION */}
      {showVerifyPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '350px' }}>
            <h2 style={{ color: '#003366', marginBottom: '12px' }}>Verification</h2>
            <p style={{ marginBottom: '16px', fontSize: '14px' }}>Enter your 5 digit code</p>
            <input 
              value={fiveDigitCode}
              onChange={(e) => setFiveDigitCode(e.target.value)}
              placeholder="Enter your 5 digit code"
              maxLength={5}
              style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '16px', boxSizing: 'border-box' }}
            />
            <button onClick={handleVerifyCode} style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
              Verify
            </button>
          </div>
        </div>
      )}

      {/* POPUP 2: UNIQUE KEY FOR VOTING PORTAL */}
      {showKeyPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '350px' }}>
            <h2 style={{ color: '#003366', marginBottom: '12px' }}>
              {generatedKey ? 'Your Unique Code - Save This' : 'Access Voting Portal'}
            </h2>
            {generatedKey ? (
              <>
                <p style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 'bold', background: '#f3f4f6', padding: '10px', borderRadius: '4px', wordBreak: 'break-all' }}>
                  {generatedKey}
                </p>
                <button onClick={() => { setShowKeyPopup(false); navigate('/student'); }} style={{ width: '100%', padding: '12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                  Continue to Portal
                </button>
              </>
            ) : (
              <>
                <p style={{ marginBottom: '16px', fontSize: '14px' }}>Paste your unique code</p>
                <input 
                  value={uniqueKeyInput}
                  onChange={(e) => setUniqueKeyInput(e.target.value)}
                  placeholder="Paste your unique code"
                  style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '16px', boxSizing: 'border-box' }}
                />
                <button onClick={handleKeyAccess} style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                  Access Voting Portal
                </button>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}