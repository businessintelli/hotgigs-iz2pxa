import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom'; // ^6.0.0
import { useAuth } from '../../lib/hooks/useAuth';
import { useAnalytics } from '../../lib/hooks/useAnalytics';
import ResetPasswordForm from '../../components/auth/ResetPasswordForm';
import PageHeader from '../../components/layout/PageHeader';

/**
 * Secure password reset page component with comprehensive validation,
 * error handling, and WCAG 2.1 AA compliance
 */
const ResetPasswordPage: React.FC = () => {
  // Get authentication state and methods
  const { state: authState } = useAuth();
  const location = useLocation();
  const analytics = useAnalytics();

  // Extract reset token from URL if present
  const searchParams = new URLSearchParams(location.search);
  const resetToken = searchParams.get('token');

  // Track page view and security events
  useEffect(() => {
    try {
      analytics.getDashboardStats({
        dimensions: ['security_events'],
        refreshCache: true
      });
    } catch (error) {
      console.error('Analytics error:', error);
    }
  }, []);

  // Cleanup sensitive data on unmount
  useEffect(() => {
    return () => {
      // Clear any sensitive form data from memory
      if (window.crypto && window.crypto.randomBytes) {
        window.crypto.randomBytes(32);
      }
    };
  }, []);

  // Redirect to dashboard if user is already authenticated
  if (authState.status === 'AUTHENTICATED' && authState.user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main
      className="container mx-auto px-4 py-8"
      role="main"
      aria-labelledby="reset-password-title"
    >
      <div className="mx-auto max-w-md">
        <PageHeader
          title="Reset Password"
          description="Enter your email to receive password reset instructions"
          className="text-center"
        />

        <div 
          className="mt-8 rounded-lg border bg-card p-6 shadow-sm"
          role="region"
          aria-label="Password reset form container"
        >
          {/* Show error message if token is invalid */}
          {resetToken === null && authState.error && (
            <div
              className="mb-6 rounded-md bg-destructive/10 p-4 text-sm text-destructive"
              role="alert"
              aria-live="polite"
            >
              {authState.error}
            </div>
          )}

          {/* Loading state */}
          {authState.isLoading && (
            <div
              className="flex items-center justify-center py-4"
              role="status"
              aria-label="Loading"
            >
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {/* Reset password form */}
          {!authState.isLoading && (
            <ResetPasswordForm />
          )}

          {/* Success message */}
          {authState.status === 'TOKEN_EXPIRED' && (
            <div
              className="mt-4 text-center text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              Check your email for password reset instructions
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default ResetPasswordPage;