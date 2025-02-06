import React from "react"; // ^18.0.0
import { XCircle, FileQuestion, AlertTriangle, AlertOctagon } from "lucide-react"; // ^0.290.0
import { ErrorCode } from "../../types/common";
import { cn } from "../../lib/utils";

interface ErrorProps {
  code: ErrorCode;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

const getErrorIcon = (code: ErrorCode): JSX.Element => {
  switch (code) {
    case ErrorCode.VALIDATION_ERROR:
      return <XCircle className="h-6 w-6 text-red-500" aria-hidden="true" />;
    case ErrorCode.NOT_FOUND:
      return <FileQuestion className="h-6 w-6 text-gray-500" aria-hidden="true" />;
    case ErrorCode.INTERNAL_ERROR:
      return <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden="true" />;
    default:
      return <AlertOctagon className="h-6 w-6 text-red-500" aria-hidden="true" />;
  }
};

const getErrorMessage = (code: ErrorCode, customMessage?: string): string => {
  if (customMessage) return customMessage;

  switch (code) {
    case ErrorCode.VALIDATION_ERROR:
      return "Please check your input and try again.";
    case ErrorCode.NOT_FOUND:
      return "The requested resource could not be found.";
    case ErrorCode.UNAUTHORIZED:
      return "You must be logged in to perform this action.";
    case ErrorCode.FORBIDDEN:
      return "You do not have permission to perform this action.";
    case ErrorCode.INTERNAL_ERROR:
      return "An internal error occurred. Please try again later.";
    case ErrorCode.RATE_LIMITED:
      return "Too many requests. Please try again later.";
    case ErrorCode.BAD_REQUEST:
      return "Invalid request. Please try again.";
    case ErrorCode.CONFLICT:
      return "A conflict occurred with the requested operation.";
    case ErrorCode.SERVICE_UNAVAILABLE:
      return "Service is temporarily unavailable. Please try again later.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
};

const Error: React.FC<ErrorProps> = React.memo(({ 
  code, 
  message, 
  onRetry, 
  className 
}) => {
  const errorMessage = getErrorMessage(code, message);
  const icon = getErrorIcon(code);

  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-red-200 bg-red-50 p-4",
        "dark:border-red-900 dark:bg-red-950",
        className
      )}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">{icon}</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {errorMessage}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className={cn(
                "mt-2 text-sm font-medium text-red-600 hover:text-red-500",
                "dark:text-red-400 dark:hover:text-red-300",
                "focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
                "dark:focus:ring-offset-red-900"
              )}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

Error.displayName = "Error";

export default Error;