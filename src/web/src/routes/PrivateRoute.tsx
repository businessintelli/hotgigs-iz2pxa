import React from 'react'; // ^18.0.0
import { Navigate, useLocation } from 'react-router-dom'; // ^6.0.0
import { useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { UserRole } from '../../types/auth';

/**
 * Props interface for PrivateRoute component with enhanced access control options
 */
interface PrivateRouteProps {
  children: React.ReactNode;
  requireRole?: UserRole;
  fallbackPath?: string;
}

/**
 * Higher-order component that provides secure route protection with role-based access control
 * and enhanced error handling.
 * 
 * @param props PrivateRouteProps containing children, optional role requirement, and fallback path
 * @returns Protected route component, loading indicator, error message, or redirect
 */
const PrivateRoute: React.FC<PrivateRouteProps> = ({
  children,
  requireRole,
  fallbackPath = '/login'
}) => {
  const { state } = useContext(AuthContext);
  const location = useLocation();

  // Handle loading state
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Handle error state
  if (state.error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500 text-center">
          <p className="text-lg font-semibold">Authentication Error</p>
          <p className="mt-2">{state.error}</p>
        </div>
      </div>
    );
  }

  // Check authentication
  if (!state.user) {
    // Preserve the attempted URL for redirect after login
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${fallbackPath}?returnUrl=${returnUrl}`} replace />;
  }

  // Check role-based access if required
  if (requireRole && state.user.role !== requireRole) {
    // Log unauthorized access attempt in production
    if (process.env.NODE_ENV === 'production') {
      console.warn('Unauthorized role access attempt:', {
        requiredRole: requireRole,
        userRole: state.user.role,
        path: location.pathname,
        userId: state.user.id
      });
    }

    // Redirect to fallback path or home page for unauthorized role
    return <Navigate to={fallbackPath || '/'} replace />;
  }

  // All checks passed, render the protected content
  return <>{children}</>;
};

export default PrivateRoute;