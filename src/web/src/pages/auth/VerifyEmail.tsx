import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useToast } from '@shadcn/ui';
import { useAuth } from '../../lib/hooks/useAuth';
import { useAnalytics } from '../../lib/hooks/useAnalytics';
import VerifyEmailForm from '../../components/auth/VerifyEmailForm';
import AppShell from '../../components/layout/AppShell';
import { AuthStatus } from '../../types/auth';

// Interface for verification state management
interface VerificationState {
  isVerifying: boolean;
  isVerified: boolean;
  error: string | null;
  attempts: number;
  lastAttempt: number | null;
}

const VerifyEmail: React.FC = () => {
  // Get auth state and verification function
  const { state, verifyEmail } = useAuth();
  const { toast } = useToast();
  const analytics = useAnalytics();

  // Local verification state
  const [verificationState, setVerificationState] = useState<VerificationState>({
    isVerifying: false,
    isVerified: false,
    error: null,
    attempts: 0,
    lastAttempt: null
  });

  // Check if user is already verified
  useEffect(() => {
    if (state.user?.email_verified) {
      setVerificationState(prev => ({ ...prev, isVerified: true }));
    }
  }, [state.user?.email_verified]);

  // Handle verification process
  const handleVerification = async (token: string): Promise<void> => {
    try {
      // Update verification state
      setVerificationState(prev => ({
        ...prev,
        isVerifying: true,
        error: null,
        attempts: prev.attempts + 1,
        lastAttempt: Date.now()
      }));

      // Track verification attempt
      analytics.track('email_verification_attempt', {
        attemptNumber: verificationState.attempts + 1
      });

      // Attempt verification
      await verifyEmail(token);

      // Handle success
      setVerificationState(prev => ({
        ...prev,
        isVerified: true,
        isVerifying: false
      }));

      // Track successful verification
      analytics.track('email_verification_success');

      // Show success message
      toast({
        title: "Email verified successfully",
        description: "You can now access all features of your account.",
        variant: "success",
        duration: 5000
      });

    } catch (error) {
      // Handle error state
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      
      setVerificationState(prev => ({
        ...prev,
        isVerifying: false,
        error: errorMessage
      }));

      // Track failed verification
      analytics.track('email_verification_failure', {
        error: errorMessage
      });

      // Show error message
      toast({
        title: "Verification failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      });
    }
  };

  // Redirect if already verified
  if (verificationState.isVerified) {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect if not authenticated
  if (state.status === AuthStatus.UNAUTHENTICATED) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-md">
        <div className="space-y-6">
          {/* Page header */}
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Verify your email
            </h1>
            <p className="text-muted-foreground">
              Please enter the verification code sent to your email address
            </p>
          </div>

          {/* Verification form */}
          <div 
            className="border rounded-lg p-6 bg-card"
            role="region"
            aria-label="Email verification form"
          >
            <VerifyEmailForm
              onSubmit={handleVerification}
              isVerifying={verificationState.isVerifying}
              error={verificationState.error}
              attempts={verificationState.attempts}
              lastAttempt={verificationState.lastAttempt}
            />
          </div>

          {/* Help text */}
          <p className="text-sm text-center text-muted-foreground">
            Didn't receive the code?{' '}
            <button
              className="font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              onClick={() => {/* Resend verification email logic */}}
              disabled={verificationState.isVerifying}
            >
              Click here to resend
            </button>
          </p>
        </div>
      </div>
    </AppShell>
  );
};

export default VerifyEmail;