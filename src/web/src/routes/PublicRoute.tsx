import React, { useCallback } from 'react'; // ^18.0.0
import { Navigate } from 'react-router-dom'; // ^6.0.0
import { CircularProgress } from '@mui/material'; // ^5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import { useAuth } from '../lib/hooks/useAuth';
import { AuthStatus } from '../types/auth';
import { ERROR_MESSAGES } from '../config/constants';

/**
 * Props interface for the PublicRoute component with type-safe properties
 */
interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo: string;
  LoadingComponent?: React.ComponentType;
  ErrorComponent?: React.ComponentType<{ error: string }>;
}

/**
 * Default loading component for public routes
 */
const DefaultLoadingComponent: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <CircularProgress size={40} thickness={4} />
  </div>
);

/**
 * Default error component for public routes
 */
const DefaultErrorComponent: React.FC<{ error: string }> = ({ error }) => (
  <div className="flex flex-col items-center justify-center min-h-screen text-red-600">
    <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
    <p>{error || ERROR_MESSAGES.GENERIC_ERROR}</p>
  </div>
);

/**
 * Error fallback component for the ErrorBoundary
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="flex flex-col items-center justify-center min-h-screen text-red-600">
    <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
    <p>{error.message || ERROR_MESSAGES.GENERIC_ERROR}</p>
  </div>
);

/**
 * PublicRoute component that implements secure route protection for public routes
 * Redirects authenticated users and handles loading/error states
 */
export const PublicRoute: React.FC<PublicRouteProps> = React.memo(({
  children,
  redirectTo,
  LoadingComponent = DefaultLoadingComponent,
  ErrorComponent = DefaultErrorComponent
}) => {
  const { state } = useAuth();

  // Validate redirect path
  const validateRedirectPath = useCallback((path: string): string => {
    // Ensure path starts with forward slash
    if (!path.startsWith('/')) {
      return `/${path}`;
    }
    // Remove any potential query parameters or hashes for security
    return path.split('?')[0].split('#')[0];
  }, []);

  // Handle loading state
  if (state.status === AuthStatus.LOADING) {
    return <LoadingComponent />;
  }

  // Handle error state
  if (state.status === AuthStatus.ERROR) {
    return <ErrorComponent error={state.error || ERROR_MESSAGES.GENERIC_ERROR} />;
  }

  // Redirect authenticated users
  if (state.status === AuthStatus.AUTHENTICATED && state.user) {
    // Log navigation attempt in development
    if (process.env.NODE_ENV === 'development') {
      console.debug('PublicRoute: Redirecting authenticated user', {
        from: window.location.pathname,
        to: redirectTo,
        userId: state.user.id
      });
    }

    return <Navigate to={validateRedirectPath(redirectTo)} replace />;
  }

  // Render children wrapped in ErrorBoundary for unauthenticated users
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ErrorBoundary>
  );
});

// Display name for debugging
PublicRoute.displayName = 'PublicRoute';

// Default export
export default PublicRoute;