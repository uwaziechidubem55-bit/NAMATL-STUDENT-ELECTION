import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import StudentLogin from './pages/StudentLogin';
import StudentDashboard from './pages/StudentDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Support from './pages/Support';
import { DataChargeProvider } from './context/DataChargeContext';

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#003366',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        color: '#FFD700',
        fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: '1px'
      }}>
        NAMATL STUDENT E-VOTING
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#003366',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#FFD700', fontSize: '3rem', marginBottom: '10px' }}>ERROR 404</h1>
      <p style={{ color: 'white' }}>Page not found</p>
      <a href="#/" style={{ color: '#FFD700', marginTop: '20px' }}>Go Home</a>
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <DataChargeProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/support" element={<Support />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </DataChargeProvider>
  );
}

export default App;