import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSessionRefresh } from '@/hooks/useSessionRefresh';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AuthGuard } from '@/components/common/AuthGuard';
import LandingPage from '@/pages/LandingPage';
import DashboardPage from '@/pages/DashboardPage';
import WorkspacePage from '@/pages/WorkspacePage';
import JoinPage from '@/pages/JoinPage';
import AuthCallback from '@/pages/AuthCallback';
import AuthErrorPage from '@/pages/AuthError';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import BlogRoutes from '@/blog-routes';

function SessionRefreshController() {
  const { session, isAuthenticated } = useAuth();
  useSessionRefresh(session, isAuthenticated);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SessionRefreshController />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <DashboardPage />
              </AuthGuard>
            }
          />
          <Route
            path="/workspace/:id"
            element={
              <AuthGuard>
                <WorkspacePage />
              </AuthGuard>
            }
          />
          <Route path="/join/:token" element={<JoinPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/error" element={<AuthErrorPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/blog/*" element={<BlogRoutes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
