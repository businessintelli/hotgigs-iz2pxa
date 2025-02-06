import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import LoginForm from "../../components/auth/LoginForm";
import AppShell from "../../components/layout/AppShell";
import { useAuth } from "../../lib/hooks/useAuth";
import { useAnalytics } from "../../lib/hooks/useAnalytics";
import { AuthStatus } from "../../types/auth";

/**
 * Production-ready login page component with comprehensive security measures
 * and analytics tracking following shadcn/ui design system specifications.
 */
const Login: React.FC = () => {
  const navigate = useNavigate();
  const { state, validateSession } = useAuth();
  const { trackEvent } = useAnalytics();

  // Check for existing valid session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const isValid = await validateSession();
        if (isValid && state.status === AuthStatus.AUTHENTICATED) {
          trackEvent({
            category: "Authentication",
            action: "Auto Login",
            label: "Valid Session Found"
          });
          navigate("/dashboard");
        }
      } catch (error) {
        console.error("Session validation error:", error);
      }
    };

    checkSession();
  }, [state.status, validateSession, navigate, trackEvent]);

  // Handle successful login
  const handleLoginSuccess = async () => {
    try {
      trackEvent({
        category: "Authentication",
        action: "Login Success",
        label: "User Login"
      });
      navigate("/dashboard");
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  // Error boundary fallback component
  const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <div className="w-full max-w-md space-y-4 text-center">
        <h2 className="text-2xl font-bold text-destructive">Authentication Error</h2>
        <p className="text-muted-foreground">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AppShell>
        <div className="container mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4">
          <div className="w-full max-w-md space-y-6">
            {/* Login header */}
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold tracking-tight">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your credentials to access your account
              </p>
            </div>

            {/* Login form */}
            <LoginForm
              className="w-full"
              onSuccess={handleLoginSuccess}
            />

            {/* Additional links */}
            <div className="space-y-4 text-center text-sm">
              <p className="text-muted-foreground">
                Don't have an account?{" "}
                <a
                  href="/register"
                  className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  Create one
                </a>
              </p>
              <a
                href="/forgot-password"
                className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                Forgot your password?
              </a>
            </div>
          </div>
        </div>
      </AppShell>
    </ErrorBoundary>
  );
};

export default Login;