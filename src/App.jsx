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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <h1>NAMTLS STUDENT E-VOTING</h1>
      <p style={{ opacity: 0.7 }}>Loading...</p>
    </div>
  );
}

function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1e293b',
        color: 'white',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <h1 style={{ fontSize: '64px', margin: '0', color: '#ef4444' }}>ERROR 404</h1>
      <p style={{ opacity: 0.5 }}>Page not found</p>
      <a href="/" style={{ color: '#3b82f6', marginTop: '16px' }}>Go Home</a>
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