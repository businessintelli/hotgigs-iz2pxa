import React, { useState } from "react";
import { z } from "zod";
import { useAuth } from "../../lib/hooks/useAuth";
import Input from "../ui/input";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

// Validation schema for login form
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export interface LoginFormProps {
  className?: string;
  onSuccess?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ className, onSuccess }) => {
  // Form state
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Partial<LoginFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Get auth functionality from hook
  const { login, state } = useAuth();

  // Rate limiting
  const [lastAttempt, setLastAttempt] = useState<number>(0);
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const RATE_LIMIT = { maxAttempts: 5, timeWindow: 5 * 60 * 1000 }; // 5 attempts per 5 minutes

  const checkRateLimit = (): boolean => {
    const now = Date.now();
    if (now - lastAttempt > RATE_LIMIT.timeWindow) {
      setAttemptCount(1);
      setLastAttempt(now);
      return false;
    }
    if (attemptCount >= RATE_LIMIT.maxAttempts) {
      return true;
    }
    setAttemptCount(prev => prev + 1);
    setLastAttempt(now);
    return false;
  };

  // Input change handler with validation
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
    setGeneralError(null);
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check rate limiting
    if (checkRateLimit()) {
      setGeneralError(`Too many login attempts. Please try again after ${RATE_LIMIT.timeWindow / 1000 / 60} minutes.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrors({});
      setGeneralError(null);

      // Validate form data
      const validatedData = loginSchema.parse(formData);

      // Sanitize inputs
      const sanitizedEmail = validatedData.email.trim().toLowerCase();
      const sanitizedPassword = validatedData.password;

      // Attempt login
      await login(sanitizedEmail, sanitizedPassword);

      // Call success callback if provided
      onSuccess?.();

    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        const fieldErrors: Partial<LoginFormData> = {};
        error.errors.forEach(err => {
          if (err.path) {
            fieldErrors[err.path[0] as keyof LoginFormData] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        // Handle authentication errors
        setGeneralError(error instanceof Error ? error.message : "An unexpected error occurred");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-4 w-full max-w-md", className)}
      noValidate
    >
      {/* Email Input */}
      <div className="space-y-2">
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleInputChange}
          disabled={isSubmitting}
          error={errors.email}
          placeholder="Enter your email"
          aria-label="Email address"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          autoComplete="email"
          required
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      {/* Password Input */}
      <div className="space-y-2">
        <Input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleInputChange}
          disabled={isSubmitting}
          error={errors.password}
          placeholder="Enter your password"
          aria-label="Password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          autoComplete="current-password"
          required
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      {/* General Error Message */}
      {generalError && (
        <div
          className="p-3 rounded-md bg-destructive/10 text-destructive text-sm"
          role="alert"
        >
          {generalError}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting}
        isLoading={isSubmitting}
        aria-disabled={isSubmitting}
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
};

export default LoginForm;