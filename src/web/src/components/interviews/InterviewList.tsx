import React, { useCallback, useMemo, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { ErrorBoundary } from "react-error-boundary";
import { Interview, InterviewStatus, InterviewType } from "../../types/interviews";
import { useInterviews } from "../../lib/hooks/useInterviews";
import Loading from "../ui/loading";
import { cn, debounce } from "../../lib/utils";

// Constants for component configuration
const ITEMS_PER_PAGE = 20;
const SORT_OPTIONS = [
  { label: "Date", value: "scheduled_at" },
  { label: "Status", value: "status" },
  { label: "Type", value: "type" },
  { label: "Candidate", value: "candidate_name" }
] as const;

const STATUS_COLORS = {
  SCHEDULED: "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100",
  NO_SHOW: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
} as const;

const VIRTUAL_LIST_CONFIG = {
  overscan: 5,
  estimateSize: 80,
  scrollMargin: 200
} as const;

// Component interfaces
interface DateRange {
  start: Date;
  end: Date;
}

interface InterviewListProps {
  className?: string;
  filters: {
    status?: InterviewStatus[];
    type?: InterviewType[];
    dateRange?: DateRange;
    search?: string;
  };
  pagination: {
    page: number;
    pageSize: number;
    sortBy: string;
    sortDirection: "asc" | "desc";
  };
  onInterviewSelect: (interview: Interview) => void;
  onStatusChange: (id: string, status: InterviewStatus) => Promise<void>;
}

// Helper function for date formatting
const formatInterviewDate = (date: Date, locale: string = "en-US"): string => {
  try {
    return format(date, "PPp", { locale });
  } catch (error) {
    console.error("Date formatting error:", error);
    return "";
  }
};

// Error fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/10">
    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
      Error loading interviews
    </h3>
    <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="mt-3 text-sm font-medium text-red-800 dark:text-red-200 hover:text-red-900 dark:hover:text-red-100"
    >
      Try again
    </button>
  </div>
);

const InterviewList: React.FC<InterviewListProps> = ({
  className,
  filters,
  pagination,
  onInterviewSelect,
  onStatusChange
}) => {
  // Local state for optimistic updates
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Map<string, InterviewStatus>
  >(new Map());

  // Fetch interviews using custom hook
  const { data: interviews, isLoading, error, totalCount } = useInterviews(
    {
      status: filters.status?.[0],
      type: filters.type?.[0],
    },
    {
      page: pagination.page,
      limit: pagination.pageSize
    }
  );

  // Virtual list setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: interviews.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => VIRTUAL_LIST_CONFIG.estimateSize,
    overscan: VIRTUAL_LIST_CONFIG.overscan
  });

  // Debounced search handler
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        console.log("Searching:", value);
      }, 300),
    []
  );

  // Status change handler with optimistic update
  const handleStatusChange = async (id: string, newStatus: InterviewStatus) => {
    try {
      setOptimisticUpdates(new Map(optimisticUpdates.set(id, newStatus)));
      await onStatusChange(id, newStatus);
    } catch (error) {
      setOptimisticUpdates(new Map(optimisticUpdates.delete(id)));
      console.error("Failed to update interview status:", error);
    }
  };

  // Render interview item
  const renderInterviewItem = useCallback((interview: Interview) => {
    const status = optimisticUpdates.get(interview.id) || interview.status;
    
    return (
      <div
        role="row"
        className="p-4 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => onInterviewSelect(interview)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            onInterviewSelect(interview);
          }
        }}
        tabIndex={0}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {interview.type} Interview
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {formatInterviewDate(interview.scheduled_at)}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <span
              className={cn(
                "px-2 py-1 text-xs font-medium rounded-full",
                STATUS_COLORS[status]
              )}
            >
              {status}
            </span>
            <select
              value={status}
              onChange={(e) =>
                handleStatusChange(interview.id, e.target.value as InterviewStatus)
              }
              onClick={(e) => e.stopPropagation()}
              className="text-sm border border-gray-300 rounded-md dark:border-gray-700 dark:bg-gray-800"
              aria-label="Change interview status"
            >
              {Object.values(InterviewStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }, [onInterviewSelect, handleStatusChange, optimisticUpdates]);

  if (isLoading) {
    return <Loading size="lg" className="mx-auto" />;
  }

  if (error) {
    throw error;
  }

  return (
    <div className={cn("relative", className)}>
      <div
        ref={parentRef}
        className="overflow-auto border rounded-lg border-gray-200 dark:border-gray-800"
        style={{ height: "calc(100vh - 200px)" }}
      >
        <div
          role="table"
          aria-label="Interview list"
          style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%" }}
          className="relative"
        >
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {renderInterviewItem(interviews[virtualRow.index])}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        Showing {interviews.length} of {totalCount} interviews
      </div>
    </div>
  );
};

// Wrap component with error boundary
const InterviewListWithErrorBoundary: React.FC<InterviewListProps> = (props) => (
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <InterviewList {...props} />
  </ErrorBoundary>
);

export default InterviewListWithErrorBoundary;