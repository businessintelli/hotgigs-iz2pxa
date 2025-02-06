import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { useAnalytics } from '@hotgigs/analytics'; // ^1.0.0
import PrivateRoute from './PrivateRoute';
import PublicRoute from './PublicRoute';
import { UserRole } from '../types/auth';

// Lazy-loaded page components with code splitting
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));
const ResetPassword = lazy(() => import('../pages/ResetPassword'));
const VerifyEmail = lazy(() => import('../pages/VerifyEmail'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Jobs = lazy(() => import('../pages/jobs'));
const Candidates = lazy(() => import('../pages/candidates'));
const Interviews = lazy(() => import('../pages/interviews'));
const Pipeline = lazy(() => import('../pages/pipeline'));
const Analytics = lazy(() => import('../pages/analytics'));
const NotFound = lazy(() => import('../pages/NotFound'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
  </div>
);

// Error fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <div className="flex flex-col items-center justify-center min-h-screen text-red-600">
    <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
    <p>{error.message}</p>
  </div>
);

// Route change tracker component
const RouteTracker = () => {
  const location = useLocation();
  const { trackPageView } = useAnalytics();

  useEffect(() => {
    trackPageView({
      path: location.pathname,
      title: document.title,
      timestamp: new Date()
    });
  }, [location, trackPageView]);

  return null;
};

// Public routes configuration
const PUBLIC_ROUTES = [
  {
    path: '/login',
    component: Login,
    redirectTo: '/dashboard',
    meta: { title: 'Login - HotGigs', analytics: 'login_page_view' }
  },
  {
    path: '/register',
    component: Register,
    redirectTo: '/dashboard',
    meta: { title: 'Register - HotGigs', analytics: 'register_page_view' }
  },
  {
    path: '/reset-password',
    component: ResetPassword,
    redirectTo: '/dashboard',
    meta: { title: 'Reset Password - HotGigs', analytics: 'reset_password_page_view' }
  },
  {
    path: '/verify-email',
    component: VerifyEmail,
    redirectTo: '/dashboard',
    meta: { title: 'Verify Email - HotGigs', analytics: 'verify_email_page_view' }
  }
] as const;

// Protected routes configuration
const PROTECTED_ROUTES = [
  {
    path: '/dashboard',
    component: Dashboard,
    roles: [UserRole.ADMIN, UserRole.RECRUITER, UserRole.HIRING_MANAGER],
    meta: { title: 'Dashboard - HotGigs', analytics: 'dashboard_page_view' }
  },
  {
    path: '/jobs/*',
    component: Jobs,
    roles: [UserRole.ADMIN, UserRole.RECRUITER],
    meta: { title: 'Jobs - HotGigs', analytics: 'jobs_page_view' }
  },
  {
    path: '/candidates/*',
    component: Candidates,
    roles: [UserRole.ADMIN, UserRole.RECRUITER],
    meta: { title: 'Candidates - HotGigs', analytics: 'candidates_page_view' }
  },
  {
    path: '/interviews/*',
    component: Interviews,
    roles: [UserRole.ADMIN, UserRole.RECRUITER, UserRole.HIRING_MANAGER],
    meta: { title: 'Interviews - HotGigs', analytics: 'interviews_page_view' }
  },
  {
    path: '/pipeline',
    component: Pipeline,
    roles: [UserRole.ADMIN, UserRole.RECRUITER],
    meta: { title: 'Pipeline - HotGigs', analytics: 'pipeline_page_view' }
  },
  {
    path: '/analytics/*',
    component: Analytics,
    roles: [UserRole.ADMIN],
    meta: { title: 'Analytics - HotGigs', analytics: 'analytics_page_view' }
  }
] as const;

/**
 * Main routing component that defines the application's route structure
 * with security, error handling, and performance optimizations
 */
const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public Routes */}
            {PUBLIC_ROUTES.map(({ path, component: Component, redirectTo, meta }) => (
              <Route
                key={path}
                path={path}
                element={
                  <PublicRoute redirectTo={redirectTo}>
                    <Component />
                  </PublicRoute>
                }
              />
            ))}

            {/* Protected Routes */}
            {PROTECTED_ROUTES.map(({ path, component: Component, roles, meta }) => (
              <Route
                key={path}
                path={path}
                element={
                  <PrivateRoute requireRole={roles[0]}>
                    <Component />
                  </PrivateRoute>
                }
              />
            ))}

            {/* Default Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>

          {/* Analytics Route Tracking */}
          <RouteTracker />
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default AppRoutes;