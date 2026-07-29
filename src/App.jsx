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

// ... (LoadingScreen and NotFound remain unchanged) ...

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <DataChargeProvider>
      {/* 👇 ADD THIS LINE — renders install popup on every page */}
      <InstallPrompt />

      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<StudentLogin />} />
          <Route path="/dashboard" element={<StudentDashboard />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/support" element={<Support />} />
          <Route path="/purchase" element={<PurchaseForm />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </DataChargeProvider>
  );
}

export default App;