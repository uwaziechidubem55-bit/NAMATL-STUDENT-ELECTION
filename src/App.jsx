// NAMTLS v2.0.1 - FORCE UPDATE - DO NOT REMOVE THIS LINE
import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { DataChargeProvider } from './context/DataChargeContext';
import ProtectedRoute from './components/ProtectedRoute';
import SuperAdminRoute from './components/SuperAdminRoute';
import { PresenceProvider } from './context/PresenceContext';

// 👇 ONLY ADDITION — Import the install popup
import InstallPrompt from './components/InstallPrompt';

// ===== ADD THIS IMPORT =====
import ErrorBoundary from './components/ErrorBoundary';

// Loading skeleton shown while a dashboard route chunk downloads
import { PageSkeleton } from './components/Skeleton';

// ⚡ Dynamic/Lazy Imports for Page Components
const Landing = lazy(() => import('./pages/Landing'));
const StudentLogin = lazy(() => import('./pages/StudentLogin'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Support = lazy(() => import('./pages/Support'));
const PurchaseForm = lazy(() => import('./pages/PurchaseForm'));
const StaffLogin = lazy(() => import('./pages/StaffLogin'));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));
const SuperAdminLogin = lazy(() => import('./pages/SuperAdminLogin'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));

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
      <svg
        width="65"
        height="65"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          animation: 'spin 1s linear infinite',
          marginBottom: '20px',
          transformOrigin: 'center'
        }}
      >
        {/* Outer rim */}
        <circle cx="50" cy="50" r="44" fill="none" stroke="#3E2723" strokeWidth="5" />
        {/* Inner ring */}
        <circle cx="50" cy="50" r="32" fill="none" stroke="#3E2723" strokeWidth="2" />
        {/* 8 spokes from hub to rim */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            x1="50" y1="50"
            x2={50 + 44 * Math.cos((deg * Math.PI) / 180)}
            y2={50 + 44 * Math.sin((deg * Math.PI) / 180)}
            stroke="#3E2723"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ))}
        {/* 8 outer handles (knobs) */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <rect
            key={`h${deg}`}
            x={50 + 48 * Math.cos((deg * Math.PI) / 180) - 3}
            y={50 + 48 * Math.sin((deg * Math.PI) / 180) - 3}
            width="6"
            height="6"
            rx="1.5"
            fill="#3E2723"
            transform={`rotate(${deg} ${50 + 48 * Math.cos((deg * Math.PI) / 180)} ${50 + 48 * Math.sin((deg * Math.PI) / 180)})`}
          />
        ))}
        {/* Central hub */}
        <circle cx="50" cy="50" r="7" fill="#3E2723" />
        <circle cx="50" cy="50" r="2.5" fill="#5D4037" />
      </svg>
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
      <h1 style={{fontSize: '4rem',color: '#FFD700',margin: '0'}}>⚠️</h1>
      <h1 style={{color: '#FFD700'}}>ERROR 404</h1>
      <p>Page not found</p>
      {/*
        FIXED: Changed from <a href="/#/"> to <Link to="/">
        Prevents full-page reload, keeps React state
      */}
      <Link to="/" style={{color: '#FFD700',marginTop: '16px'}}>Go Home</Link>
    </div>
  );
}

// Routes whose chunks are heavy (they fetch live election data) get the
// page skeleton while downloading; everything else keeps the brand splash.
const SKELETON_ROUTES = ['/student', '/admin-dashboard', '/staff-dashboard', '/super-admin-dashboard'];

function RouteFallback() {
  const location = useLocation();
  if (SKELETON_ROUTES.includes(location.pathname)) return <PageSkeleton />;
  return <LoadingScreen />;
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

      {/* Super Admin live monitoring — heartbeat for every page. Renders nothing. */}
      <PresenceProvider />

      {/*
        ===== FIX: Wrap Routes in ErrorBoundary =====
        Without this, ANY runtime error in any lazy-loaded page
        silently kills the entire React tree → blank white page.
      */}
      <ErrorBoundary>
        {/* 📦 Suspense intercepts the loading gap when a user switches between pages */}
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/student-login" element={<StudentLogin />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/admin-dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/support" element={<Support />} />
            <Route path="/purchase-form" element={<PurchaseForm />} />
            <Route path="/staff-login" element={<StaffLogin />} />
            {/* Secret staff shortcut → always resolves to Staff Login (works despite service-worker caching) */}
            <Route path="/staff-monitor" element={<Navigate to="/staff-login" replace />} />
            <Route path="/staff-dashboard" element={<StaffDashboard />} />
            {/* Super Admin control room — only reachable via the Admin Dashboard link */}
            <Route path="/super-admin-login" element={<SuperAdminLogin />} />
            <Route path="/super-admin-dashboard" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </DataChargeProvider>
  );
}

export default App