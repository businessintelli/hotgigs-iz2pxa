import * as React from "react"; // ^18.0.0
import { Navigate } from "react-router-dom"; // ^6.0.0
import { useAuth } from "../../lib/hooks/useAuth";
import RegisterForm from "../../components/auth/RegisterForm";
import { Button } from "../../components/ui/button";
import { RegisterData } from "../../types/auth";

/**
 * Secure registration page component implementing comprehensive user registration
 * with JWT-based authentication, security controls, and WCAG 2.1 AA compliance.
 */
const Register: React.FC = () => {
  const { state, register } = useAuth();
  const [registrationError, setRegistrationError] = React.useState<string | null>(null);
  const [registrationAttempts, setRegistrationAttempts] = React.useState(0);

  // Redirect if already authenticated
  if (state.status === "AUTHENTICATED" && state.user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Security: Rate limiting for registration attempts
  const isRateLimited = registrationAttempts >= 5;
  const rateLimitReset = React.useRef<NodeJS.Timeout>();

  React.useEffect(() => {
    if (isRateLimited) {
      rateLimitReset.current = setTimeout(() => {
        setRegistrationAttempts(0);
        setRegistrationError(null);
      }, 5 * 60 * 1000); // 5 minutes
    }

    return () => {
      if (rateLimitReset.current) {
        clearTimeout(rateLimitReset.current);
      }
    };
  }, [isRateLimited]);

  // Handle registration form submission
  const handleRegistration = async (data: RegisterData) => {
    try {
      if (isRateLimited) {
        throw new Error("Too many registration attempts. Please try again later.");
      }

      setRegistrationError(null);
      await register(data);

      // Registration analytics in production
      if (process.env.NODE_ENV === "production") {
        console.debug("Registration attempt:", {
          timestamp: new Date(),
          role: data.role,
        });
      }
    } catch (error) {
      setRegistrationAttempts((prev) => prev + 1);
      setRegistrationError(
        error instanceof Error ? error.message : "Registration failed. Please try again."
      );

      // Log registration errors in production
      if (process.env.NODE_ENV === "production") {
        console.error("Registration error:", {
          error,
          attempts: registrationAttempts + 1,
          timestamp: new Date(),
        });
      }
    }
  };

  return (
    <main
      className="container mx-auto px-4 py-8 max-w-md"
      role="main"
      aria-labelledby="registration-title"
    >
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1
            id="registration-title"
            className="text-2xl font-bold tracking-tight"
          >
            Create an Account
          </h1>
          <p className="text-muted-foreground">
            Join HotGigs to find your next opportunity
          </p>
        </div>

        {/* Error Message Display */}
        {registrationError && (
          <div
            className="p-4 rounded-md bg-destructive/10 text-destructive"
            role="alert"
            aria-live="polite"
          >
            {registrationError}
          </div>
        )}

        {/* Rate Limit Warning */}
        {isRateLimited ? (
          <div
            className="p-4 rounded-md bg-warning/10 text-warning"
            role="alert"
            aria-live="polite"
          >
            <p>
              Too many registration attempts. Please try again after 5 minutes.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
          </div>
        ) : (
          <RegisterForm
            onSuccess={() => {
              // Success handling
              setRegistrationAttempts(0);
              setRegistrationError(null);
            }}
            onError={(error) => {
              setRegistrationError(error.message);
              setRegistrationAttempts((prev) => prev + 1);
            }}
          />
        )}

        {/* Login Link */}
        <div className="text-center text-sm">
          <p className="text-muted-foreground">
            Already have an account?{" "}
            <a
              href="/login"
              className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </main>
  );
};

export default Register;