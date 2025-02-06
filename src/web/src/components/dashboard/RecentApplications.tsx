import * as React from "react"; // ^18.0.0
import { useQuery } from "@tanstack/react-query"; // ^4.0.0
import { format } from "date-fns"; // ^2.30.0
import { useVirtualizer } from "@tanstack/react-virtual"; // ^3.0.0
import { useMetrics } from "@hotgigs/telemetry"; // ^1.0.0
import { ErrorBoundary } from "react-error-boundary"; // ^4.0.0

import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { ApplicationStatus } from "../../types/candidates";
import { cn } from "../../lib/utils";
import { CACHE_KEYS, ERROR_MESSAGES } from "../../config/constants";

// Types for component props and application data
interface RecentApplicationsProps {
  limit?: number;
  className?: string;
}

interface Application {
  id: string;
  candidate_name: string;
  job_title: string;
  status: ApplicationStatus;
  applied_at: Date;
  last_updated: Date;
}

// Status color mapping with WCAG AA compliance
const statusColorMap: Record<ApplicationStatus, string> = {
  [ApplicationStatus.APPLIED]: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  [ApplicationStatus.SCREENING]: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  [ApplicationStatus.INTERVIEWING]: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  [ApplicationStatus.OFFER_PENDING]: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  [ApplicationStatus.OFFER_ACCEPTED]: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  [ApplicationStatus.OFFER_DECLINED]: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  [ApplicationStatus.REJECTED]: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
};

// Format application date with relative time
const formatApplicationDate = (date: Date): string => {
  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - date.getTime()) / 36e5;

  if (diffInHours < 24) {
    return format(date, "'Today at' h:mm a");
  } else if (diffInHours < 48) {
    return format(date, "'Yesterday at' h:mm a");
  }
  return format(date, "MMM d, yyyy 'at' h:mm a");
};

// Error fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Card className="p-4 text-center">
    <div className="text-red-600 dark:text-red-400 mb-2">
      {ERROR_MESSAGES.GENERIC_ERROR}
    </div>
    <button
      onClick={resetErrorBoundary}
      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
    >
      Try again
    </button>
  </Card>
);

export const RecentApplications: React.FC<RecentApplicationsProps> = ({
  limit = 50,
  className
}) => {
  const metrics = useMetrics();
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  // Query recent applications with real-time updates
  const { data, isLoading, error } = useQuery<Application[]>({
    queryKey: [CACHE_KEYS.INVALIDATION_PATTERNS.ALL_APPLICATIONS, limit],
    queryFn: async () => {
      const response = await fetch(`/api/applications/recent?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch applications');
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    cacheTime: 300000, // 5 minutes
    refetchInterval: 60000, // 1 minute real-time updates
  });

  // Virtual list implementation for performance
  const virtualizer = useVirtualizer({
    count: data?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated row height
    overscan: 5
  });

  // Track component metrics
  React.useEffect(() => {
    metrics.trackEvent('RecentApplications:mounted', {
      limit,
      itemCount: data?.length
    });

    return () => {
      metrics.trackEvent('RecentApplications:unmounted');
    };
  }, [metrics, limit, data?.length]);

  if (error) {
    throw error; // Will be caught by ErrorBoundary
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">
            Recent Applications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-100 dark:bg-gray-800 rounded-md"
                />
              ))}
            </div>
          ) : (
            <div
              ref={parentRef}
              className="h-[400px] overflow-auto"
              data-testid="applications-list"
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative'
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const application = data?.[virtualRow.index];
                  if (!application) return null;

                  return (
                    <div
                      key={application.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className={cn(
                        "absolute top-0 left-0 w-full border-b border-gray-100 dark:border-gray-800",
                        "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      )}
                      style={{
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                    >
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {application.candidate_name}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {application.job_title}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                              statusColorMap[application.status]
                            )}
                          >
                            {application.status}
                          </span>
                          <time
                            dateTime={application.applied_at.toISOString()}
                            className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap"
                          >
                            {formatApplicationDate(application.applied_at)}
                          </time>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
};

export default RecentApplications;