// NAMTLS v2.0.1 - FORCE UPDATE - DO NOT REMOVE THIS LINE
import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { DataChargeProvider } from './context/DataChargeContext';

// 👇 ADD THIS LINE
import InstallPrompt from './components/InstallPrompt';

// ⚡ Dynamic/Lazy Imports for Page Components
const Landing = lazy(() => import('./pages/Landing'));
const StudentLogin = lazy(() => import('./pages/StudentLogin'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Support = lazy(() => import('./pages/Support'));
const PurchaseForm = lazy(() => import('./pages/PurchaseForm'));

function LoadingScreen() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#003366',
      color: '#FFD700',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid #FFD700',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        marginBottom: '16px'
      }} />
      <span style={{ fontSize: '14px', opacity: 0.9 }}>
        Loading NAMTLS E-Voting Portal v2.0...
      </span>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#003366',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center',
      padding: '20px'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '10px' }}>⚠️</div>
      <h1 style={{ color: '#FFD700', margin: '0 0 4px 0' }}>ERROR 404</h1>
      <p style={{ color: '#ccc', margin: '0 0 20px 0' }}>Page not found</p>
      <a href="/" style={{
        padding: '10px 28px',
        background: '#FFD700',
        color: '#003366',
        textDecoration: 'none',
        borderRadius: '6px',
        fontWeight: 'bold'
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
      <InstallPrompt />

      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<StudentLogin />} />
          <Route path="/dashboard" element={<StudentDashboard />} />
          {/* ★ ALIAS: StudentLogin.jsx navigates to /student after login */}
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          {/* ★ ALIAS: AdminLogin.jsx navigates to /admin-dashboard after login */}
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/support" element={<Support />} />
          <Route path="/purchase" element={<PurchaseForm />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </DataChargeProvider>
  );
}

export default App;