
import { Navigate, Route, Routes } from 'react-router-dom';

import AppLayout from './layouts/AppLayout';
import LoadingState from './components/LoadingState';
import { useAuth } from './context/AuthContext';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import CategoriesPage from './pages/CategoriesPage';
import SettingsPage from './pages/SettingsPage';
import AiChatPage from './pages/AiChatPage';

// Protect application pages.
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState text="Loading your account…" />;
  }

  return user ? children : <Navigate to="/login" replace />;
}

// Redirect authenticated users away from public pages.
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState text="Loading…" />;
  }

  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      {/* Public welcome and authentication pages */}
      <Route
        path="/"
        element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        }
      />

      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      {/* Protected application */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/ai-chat" element={<AiChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* Unknown URLs */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
