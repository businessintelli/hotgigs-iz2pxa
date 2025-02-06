import * as React from "react" // ^18.0.0
import { useNavigate } from "react-router-dom" // ^6.0.0
import { Button } from "../components/ui/button"
import { AppShell } from "../components/layout/AppShell"
import { cn } from "../lib/utils"

/**
 * NotFoundPage component that provides a user-friendly 404 error experience
 * with proper accessibility features and error tracking.
 */
const NotFoundPage: React.FC = () => {
  // Navigation hook for programmatic routing
  const navigate = useNavigate()

  // Handle return to dashboard
  const handleReturnHome = React.useCallback(() => {
    navigate("/dashboard")
  }, [navigate])

  return (
    <AppShell>
      <div
        className={cn(
          "flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center",
          "px-4 text-center"
        )}
        role="main"
        aria-labelledby="error-title"
      >
        {/* Error status code */}
        <h1
          id="error-title"
          className={cn(
            "text-8xl font-extrabold tracking-tight",
            "bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent"
          )}
        >
          404
        </h1>

        {/* Error message */}
        <h2 className="mt-8 text-2xl font-semibold tracking-tight">
          Page Not Found
        </h2>

        {/* Error description */}
        <p className="mt-4 max-w-lg text-muted-foreground">
          Sorry, we couldn't find the page you're looking for. The page might have
          been moved, deleted, or never existed.
        </p>

        {/* Navigation options */}
        <div className="mt-8 flex items-center gap-4">
          <Button
            onClick={handleReturnHome}
            className="min-w-[150px]"
            aria-label="Return to dashboard"
          >
            Return to Dashboard
          </Button>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="min-w-[150px]"
            aria-label="Go back to previous page"
          >
            Go Back
          </Button>
        </div>

        {/* Support link */}
        <p className="mt-8 text-sm text-muted-foreground">
          Need help?{" "}
          <a
            href="/contact"
            className="font-medium text-primary underline-offset-4 hover:underline"
            aria-label="Contact support for assistance"
          >
            Contact Support
          </a>
        </p>
      </div>
    </AppShell>
  )
}

// Display name for debugging
NotFoundPage.displayName = "NotFoundPage"

export default NotFoundPage