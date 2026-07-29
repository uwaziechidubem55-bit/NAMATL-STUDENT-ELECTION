// NAMTLS v2.0.1 - FORCE UPDATE - DO NOT REMOVE THIS LINE
import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { DataChargeProvider } from './context/DataChargeContext';

// 👇 ONLY ADDITION — Import the install popup
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
      minHeight: '100vh',
      background: '#003366',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        width: '50px',
        height: '50px',
        border: '5px solid rgba(255,215,0,0.3)',
        borderTop: '5px solid #FFD700',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '20px'
      }}></div>
      <div>Loading NAMTLS E-Voting Portal v2.0...</div>
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
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ fontSize: '4rem', color: '#FFD700', margin: '0' }}>⚠️</h1>
      <h1 style={{ color: '#FFD700' }}>ERROR 404</h1>
      <p>Page not found</p>
      <a href="/#/" style={{ color: '#FFD700', marginTop: '16px' }}>Go Home</a>
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
      {/* 👇 ONLY ADDITION — Renders the install popup on every page */}
      <InstallPrompt />

      {/* 📦 Suspense intercepts the loading gap when a user switches between pages */}
      <Suspense fallback={<LoadingScreen />}>
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
      </Suspense>
    </DataChargeProvider>
  );
}

export default App;