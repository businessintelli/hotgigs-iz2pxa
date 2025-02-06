import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { withErrorBoundary } from 'react-error-boundary';
import useAnalytics from '@hotgigs/analytics';
import { useAuth } from '../../lib/hooks/useAuth';
import Button from '../ui/button';
import Input from '../ui/input';
import { ERROR_MESSAGES } from '../../config/constants';

// Validation schema for email verification token
const verifyEmailSchema = z.object({
  token: z.string()
    .min(6, 'Verification token must be at least 6 characters')
    .max(128, 'Verification token is too long')
    .regex(/^[A-Za-z0-9-_]+$/, 'Invalid token format')
});

// Type for form data
type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;

// Interface for verification state management
interface VerificationState {
  attempts: number;
  lastAttempt: Date | null;
  deviceId: string;
}

// Rate limiting constants
const MAX_ATTEMPTS = 5;
const ATTEMPT_COOLDOWN = 5 * 60 * 1000; // 5 minutes

const VerifyEmailForm: React.FC = () => {
  const { verifyEmail, state } = useAuth();
  const analytics = useAnalytics();
  const [verificationState, setVerificationState] = useState<VerificationState>(() => ({
    attempts: 0,
    lastAttempt: null,
    deviceId: crypto.randomUUID()
  }));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors
  } = useForm<VerifyEmailFormData>({
    defaultValues: {
      token: ''
    }
  });

  // Check for rate limiting
  const isRateLimited = () => {
    if (verificationState.attempts >= MAX_ATTEMPTS) {
      const cooldownRemaining = verificationState.lastAttempt
        ? ATTEMPT_COOLDOWN - (Date.now() - verificationState.lastAttempt.getTime())
        : 0;
      return cooldownRemaining > 0;
    }
    return false;
  };

  // Reset rate limiting after cooldown
  useEffect(() => {
    if (isRateLimited()) {
      const timer = setTimeout(() => {
        setVerificationState(prev => ({
          ...prev,
          attempts: 0,
          lastAttempt: null
        }));
      }, ATTEMPT_COOLDOWN);

      return () => clearTimeout(timer);
    }
  }, [verificationState.attempts, verificationState.lastAttempt]);

  // Handle form submission
  const onSubmit = async (data: VerifyEmailFormData) => {
    try {
      // Check rate limiting
      if (isRateLimited()) {
        const minutesRemaining = Math.ceil(
          (ATTEMPT_COOLDOWN - (Date.now() - (verificationState.lastAttempt?.getTime() || 0))) / 60000
        );
        throw new Error(`Too many attempts. Please try again in ${minutesRemaining} minutes.`);
      }

      // Update attempt counter
      setVerificationState(prev => ({
        ...prev,
        attempts: prev.attempts + 1,
        lastAttempt: new Date()
      }));

      // Track verification attempt
      analytics.track('email_verification_attempt', {
        deviceId: verificationState.deviceId,
        attemptNumber: verificationState.attempts + 1
      });

      // Attempt verification
      await verifyEmail(data.token);

      // Track successful verification
      analytics.track('email_verification_success', {
        deviceId: verificationState.deviceId
      });

      // Clear any existing errors
      clearErrors();

    } catch (error) {
      // Track failed verification
      analytics.track('email_verification_failure', {
        deviceId: verificationState.deviceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Handle specific error cases
      if (error instanceof Error) {
        setError('token', {
          type: 'manual',
          message: error.message
        });
      } else {
        setError('token', {
          type: 'manual',
          message: ERROR_MESSAGES.GENERIC_ERROR
        });
      }
    }
  };

  // Get remaining attempts message
  const getRemainingAttemptsMessage = () => {
    const remaining = MAX_ATTEMPTS - verificationState.attempts;
    return remaining > 0
      ? `${remaining} attempts remaining`
      : 'No attempts remaining';
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
      aria-label="Email verification form"
    >
      <div className="space-y-2">
        <Input
          {...register('token')}
          type="text"
          id="verification-token"
          placeholder="Enter verification token"
          autoComplete="one-time-code"
          aria-label="Verification token"
          aria-invalid={!!errors.token}
          aria-describedby={errors.token ? 'token-error' : undefined}
          error={errors.token?.message}
          disabled={isSubmitting || isRateLimited()}
          className="w-full"
        />
        {errors.token && (
          <p
            id="token-error"
            className="text-sm text-destructive"
            role="alert"
          >
            {errors.token.message}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {getRemainingAttemptsMessage()}
        </p>
      </div>

      <Button
        type="submit"
        variant={errors.token ? 'destructive' : 'default'}
        className="w-full"
        disabled={isSubmitting || isRateLimited()}
        isLoading={isSubmitting}
        aria-disabled={isSubmitting || isRateLimited()}
      >
        {isSubmitting ? 'Verifying...' : 'Verify Email'}
      </Button>

      {state.error && (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </p>
      )}
    </form>
  );
};

// Wrap component with error boundary
export default withErrorBoundary(VerifyEmailForm, {
  fallback: (
    <div className="text-destructive" role="alert">
      {ERROR_MESSAGES.GENERIC_ERROR}
    </div>
  )
});