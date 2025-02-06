import React from "react"; // ^18.0.0
import { useRouteError } from "react-router-dom"; // ^6.0.0
import Error from "../components/ui/error";
import { ErrorCode } from "../types/common";
import { cn } from "../lib/utils";

/**
 * Maps HTTP status codes to internal error codes
 */
const mapHttpStatusToErrorCode = (status: number): ErrorCode => {
  switch (status) {
    case 400:
      return ErrorCode.BAD_REQUEST;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    case 429:
      return ErrorCode.RATE_LIMITED;
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
};

/**
 * Extracts and normalizes error details from various error types
 */
const getErrorDetails = (error: unknown): { code: ErrorCode; message: string } => {
  // Handle Response objects from fetch API
  if (error instanceof Response) {
    return {
      code: mapHttpStatusToErrorCode(error.status),
      message: error.statusText || "An error occurred while processing your request."
    };
  }

  // Handle network errors
  if (error instanceof Error && "cause" in error && error.cause === "network") {
    return {
      code: ErrorCode.SERVICE_UNAVAILABLE,
      message: "Unable to connect to the server. Please check your internet connection."
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Sanitize error message for security
    const safeMessage = error.message.replace(/[<>]/g, "");
    return {
      code: ErrorCode.INTERNAL_ERROR,
      message: safeMessage
    };
  }

  // Handle unknown error types
  return {
    code: ErrorCode.INTERNAL_ERROR,
    message: "An unexpected error occurred. Please try again."
  };
};

/**
 * ErrorPage component that serves as a fallback UI for application-wide errors
 */
const ErrorPage: React.FC = () => {
  const error = useRouteError();
  const [retryCount, setRetryCount] = React.useState(0);
  const { code, message } = getErrorDetails(error);

  // Log error for monitoring but exclude sensitive data
  React.useEffect(() => {
    console.error("Application error:", {
      code,
      timestamp: new Date().toISOString(),
      retryCount
    });
  }, [code, retryCount]);

  const handleRetry = React.useCallback(() => {
    setRetryCount((prev) => prev + 1);
    if (window.location.pathname === "/") {
      window.location.reload();
    } else {
      window.location.href = "/";
    }
  }, []);

  const isRetryable = React.useMemo(() => {
    return ![
      ErrorCode.UNAUTHORIZED,
      ErrorCode.FORBIDDEN,
      ErrorCode.NOT_FOUND
    ].includes(code);
  }, [code]);

  return (
    <div
      className={cn(
        "flex min-h-[400px] w-full items-center justify-center px-4",
        "md:min-h-[600px]"
      )}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm",
          "dark:border-gray-800 dark:bg-gray-900"
        )}
      >
        <Error
          code={code}
          message={message}
          onRetry={isRetryable ? handleRetry : undefined}
          className="mb-4"
        />
        <div
          className={cn(
            "mt-4 text-center text-sm text-gray-500",
            "dark:text-gray-400"
          )}
        >
          <a
            href="/"
            className={cn(
              "text-blue-600 hover:text-blue-500",
              "dark:text-blue-400 dark:hover:text-blue-300",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              "dark:focus:ring-offset-gray-900"
            )}
          >
            Return to Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;