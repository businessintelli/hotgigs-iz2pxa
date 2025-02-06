import * as React from "react"; // ^18.0.0
import { useForm } from "react-hook-form"; // ^7.0.0
import { zodResolver } from "@hookform/resolvers/zod"; // ^3.0.0
import { z } from "zod"; // ^3.0.0
import { useAuth } from "../../lib/hooks/useAuth";
import { Button } from "../ui/button";
import Input from "../ui/input";
import { UserRole } from "../../types/auth";

// Registration form validation schema
const registerSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .min(1, "Email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must not exceed 100 characters"),
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: "Please select a valid role" }),
  }),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms and conditions" }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Type inference from schema
type RegisterFormData = z.infer<typeof registerSchema>;

// Props interface
interface RegisterFormProps {
  onSuccess?: (data: RegisterFormData) => void;
  onError?: (error: Error) => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onError,
}) => {
  const { register: registerUser, state } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: UserRole.CANDIDATE,
      termsAccepted: false,
    },
  });

  // Form submission handler
  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        full_name: data.fullName,
        role: data.role,
        terms_accepted: data.termsAccepted,
      });

      reset();
      onSuccess?.(data);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
      aria-label="Registration form"
    >
      {/* Full Name Field */}
      <div className="space-y-2">
        <label
          htmlFor="fullName"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Full Name
        </label>
        <Input
          id="fullName"
          type="text"
          autoComplete="name"
          {...register("fullName")}
          error={errors.fullName?.message}
          aria-invalid={!!errors.fullName}
          aria-describedby="fullName-error"
          disabled={isSubmitting}
        />
        {errors.fullName && (
          <p id="fullName-error" className="text-sm text-destructive">
            {errors.fullName.message}
          </p>
        )}
      </div>

      {/* Email Field */}
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          error={errors.email?.message}
          aria-invalid={!!errors.email}
          aria-describedby="email-error"
          disabled={isSubmitting}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Password
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            {...register("password")}
            error={errors.password?.message}
            aria-invalid={!!errors.password}
            aria-describedby="password-error password-requirements"
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
        <p id="password-requirements" className="text-sm text-muted-foreground">
          Password must be at least 8 characters and include uppercase, lowercase,
          number, and special character.
        </p>
      </div>

      {/* Confirm Password Field */}
      <div className="space-y-2">
        <label
          htmlFor="confirmPassword"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Confirm Password
        </label>
        <Input
          id="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          {...register("confirmPassword")}
          error={errors.confirmPassword?.message}
          aria-invalid={!!errors.confirmPassword}
          aria-describedby="confirmPassword-error"
          disabled={isSubmitting}
        />
        {errors.confirmPassword && (
          <p id="confirmPassword-error" className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {/* Role Selection */}
      <div className="space-y-2">
        <label
          htmlFor="role"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Role
        </label>
        <select
          id="role"
          {...register("role")}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          aria-invalid={!!errors.role}
          aria-describedby="role-error"
          disabled={isSubmitting}
        >
          <option value={UserRole.CANDIDATE}>Candidate</option>
          <option value={UserRole.RECRUITER}>Recruiter</option>
          <option value={UserRole.HIRING_MANAGER}>Hiring Manager</option>
        </select>
        {errors.role && (
          <p id="role-error" className="text-sm text-destructive">
            {errors.role.message}
          </p>
        )}
      </div>

      {/* Terms and Conditions */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="termsAccepted"
            {...register("termsAccepted")}
            className="h-4 w-4 rounded border-input"
            aria-invalid={!!errors.termsAccepted}
            aria-describedby="terms-error"
            disabled={isSubmitting}
          />
          <label
            htmlFor="termsAccepted"
            className="text-sm text-muted-foreground"
          >
            I accept the terms and conditions
          </label>
        </div>
        {errors.termsAccepted && (
          <p id="terms-error" className="text-sm text-destructive">
            {errors.termsAccepted.message}
          </p>
        )}
      </div>

      {/* Form Error Message */}
      {state.error && (
        <div
          className="p-3 rounded-md bg-destructive/10 text-destructive"
          role="alert"
        >
          {state.error}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting}
        isLoading={isSubmitting}
      >
        Register
      </Button>
    </form>
  );
};

export default RegisterForm;