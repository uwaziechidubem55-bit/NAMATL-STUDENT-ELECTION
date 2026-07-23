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
      background: 'linear-gradient(135deg, #0a1628 0%, #003366 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <img
        src="/logo.png"
        alt="NAMATL Logo"
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          objectFit: 'cover',
          marginBottom: '16px',
          border: '3px solid #FFD700',
        }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
      <h1 style={{ color: '#FFD700', margin: '0 0 8px', fontSize: '22px', fontWeight: 700 }}>
        NAMATL Student E-voting 
      </h1>
      <div style={{
        width: '36px',
        height: '36px',
        border: '3px solid rgba(255,215,0,0.2)',
        borderTop: '3px solid #FFD700',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '12px' }}>
        Loading...
      </p>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a1628',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      color: '#f1f5f9',
    }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
      <h1 style={{ color: '#FFD700', margin: '0 0 8px' }}>ERROR 404</h1>
      <p style={{ color: '#94a3b8', margin: '0 0 24px' }}>Page not found</p>
      <a
        href="/"
        style={{
          padding: '12px 24px',
          background: '#FFD700',
          color: '#061D3A',
          borderRadius: '8px',
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        Go Home
      </a>
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
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/support" element={<Support />} />
        <Route path="/purchase-form" element={<PurchaseForm />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </DataChargeProvider>
  );
}

export default App;