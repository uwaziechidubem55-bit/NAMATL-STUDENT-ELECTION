import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import StudentLogin from './pages/StudentLogin';
import StudentDashboard from './pages/StudentDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Support from './pages/Support';
import PurchaseForm from './pages/PurchaseForm';
import { DataChargeProvider } from './context/DataChargeContext';

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1628 0%, #061D3A 50%, #003366 100%)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <img src="/logo.png" alt="NAMATL" style={{
        width: '70px', height: '70px',
        borderRadius: '50%',
        objectFit: 'cover',
        boxShadow: '0 8px 30px rgba(255,215,0,0.2)',
      }}
        onError={(e) => { e.target.style.display = 'none'; }} />
      <h1 style={{ color: '#FFD700', fontSize: '20px', margin: 0, fontWeight: 700 }}>
        NAMTLS STUDENT E-VOTING
      </h1>
      <div style={{
        width: '32px', height: '32px',
        border: '3px solid rgba(255,215,0,0.2)',
        borderTopColor: '#FFD700',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
        Loading...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <span style={{ fontSize: '64px' }}>⚠️</span>
      <h1 style={{ margin: 0, color: '#dc2626' }}>ERROR 404</h1>
      <p style={{ color: '#94a3b8', margin: 0 }}>Page not found</p>
      <a href="/" style={{
        padding: '12px 28px',
        background: '#FFD700',
        color: '#061D3A',
        borderRadius: '8px',
        textDecoration: 'none',
        fontWeight: 700,
        fontSize: '14px'
      }}>Go Home</a>
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
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/support" element={<Support />} />
        <Route path="/purchase-form" element={<PurchaseForm />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </DataChargeProvider>
  );
}

export default App;