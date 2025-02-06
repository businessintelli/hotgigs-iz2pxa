import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../lib/hooks/useAuth';
import Input from '../ui/input';
import { Button } from '../ui/button';

// Password validation regex patterns
const PASSWORD_PATTERNS = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  special: /[!@#$%^&*(),.?":{}|<>]/,
};

interface ResetPasswordFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

const ResetPasswordForm: React.FC = () => {
  const { resetPassword, state } = useAuth();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ResetPasswordFormData>();

  // Watch password field for confirmation validation
  const password = watch('password');

  // Clear form on successful reset
  useEffect(() => {
    if (state.status === 'AUTHENTICATED') {
      reset();
    }
  }, [state.status, reset]);

  // Form cleanup on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      await resetPassword(data.email);
    } catch (error) {
      console.error('Password reset error:', error);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      aria-label="Password reset form"
      noValidate
    >
      {/* Email Input */}
      <div className="space-y-2">
        <Input
          type="email"
          id="email"
          placeholder="Enter your email"
          error={errors.email?.message}
          aria-label="Email address"
          aria-invalid={!!errors.email}
          aria-describedby="email-error"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
            maxLength: {
              value: 255,
              message: 'Email must be less than 255 characters',
            },
          })}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password Input */}
      <div className="space-y-2">
        <Input
          type="password"
          id="password"
          placeholder="Enter new password"
          error={errors.password?.message}
          aria-label="New password"
          aria-invalid={!!errors.password}
          aria-describedby="password-error"
          {...register('password', {
            required: 'Password is required',
            minLength: {
              value: 8,
              message: 'Password must be at least 8 characters',
            },
            validate: {
              uppercase: (value) =>
                PASSWORD_PATTERNS.uppercase.test(value) ||
                'Password must contain at least one uppercase letter',
              lowercase: (value) =>
                PASSWORD_PATTERNS.lowercase.test(value) ||
                'Password must contain at least one lowercase letter',
              number: (value) =>
                PASSWORD_PATTERNS.number.test(value) ||
                'Password must contain at least one number',
              special: (value) =>
                PASSWORD_PATTERNS.special.test(value) ||
                'Password must contain at least one special character',
            },
          })}
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Confirm Password Input */}
      <div className="space-y-2">
        <Input
          type="password"
          id="confirmPassword"
          placeholder="Confirm new password"
          error={errors.confirmPassword?.message}
          aria-label="Confirm new password"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby="confirm-password-error"
          {...register('confirmPassword', {
            required: 'Please confirm your password',
            validate: (value) =>
              value === password || 'Passwords do not match',
          })}
        />
        {errors.confirmPassword && (
          <p id="confirm-password-error" className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {/* Error Message Display */}
      {state.error && (
        <div
          role="alert"
          className="p-4 mb-4 text-sm text-destructive bg-destructive/10 rounded-md"
        >
          {state.error}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full"
        isLoading={isSubmitting}
        disabled={isSubmitting}
        aria-label="Reset password"
      >
        Reset Password
      </Button>
    </form>
  );
};

export default ResetPasswordForm;