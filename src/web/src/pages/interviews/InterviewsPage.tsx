"use client"

import React, { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@shadcn/ui";
import { ErrorBoundary } from "react-error-boundary";
import { LoadingSpinner } from "@shadcn/ui";
import { InterviewList } from "../../components/interviews/InterviewList";
import { CalendarView } from "../../components/interviews/CalendarView";
import { useInterviews } from "../../lib/hooks/useInterviews";
import { Interview, InterviewStatus, InterviewType } from "../../types/interviews";
import { cn, debounce } from "../../lib/utils";
import { PAGINATION_DEFAULTS, CACHE_KEYS } from "../../config/constants";

// View type enum
enum ViewType {
  LIST = "LIST",
  CALENDAR = "CALENDAR"
}

// Interface for filters
interface InterviewFilters {
  status?: InterviewStatus[];
  type?: InterviewType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

// Error Fallback component
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

const InterviewsPage: React.FC = () => {
  // State management
  const [viewType, setViewType] = useState<ViewType>(ViewType.LIST);
  const [filters, setFilters] = useState<InterviewFilters>({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGINATION_DEFAULTS.PAGE_SIZE
  });

  // Hooks
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch interviews with filters and pagination
  const {
    data: interviews,
    isLoading,
    error,
    totalCount,
    hasNextPage
  } = useInterviews(
    {
      status: filters.status?.[0],
      type: filters.type?.[0]
    },
    pagination
  );

  // Debounced search handler
  const handleSearch = useCallback(
    debounce((query: string) => {
      setFilters(prev => ({ ...prev, searchQuery: query }));
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300),
    []
  );

  // View type change handler
  const handleViewChange = (newViewType: ViewType) => {
    setViewType(newViewType);
    // Reset pagination when switching views
    setPagination({ page: 1, limit: PAGINATION_DEFAULTS.PAGE_SIZE });
  };

  // Filter change handler
  const handleFilterChange = (newFilters: Partial<InterviewFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Interview selection handler
  const handleInterviewSelect = (interview: Interview) => {
    // Prefetch interview details
    queryClient.prefetchQuery(
      [CACHE_KEYS.INVALIDATION_PATTERNS.ALL_INTERVIEWS, interview.id],
      () => interview
    );
  };

  // Status change handler
  const handleStatusChange = async (id: string, status: InterviewStatus) => {
    try {
      // Optimistic update
      queryClient.setQueryData(
        [CACHE_KEYS.INVALIDATION_PATTERNS.ALL_INTERVIEWS],
        (old: Interview[]) =>
          old?.map(interview =>
            interview.id === id ? { ...interview, status } : interview
          )
      );

      // Show success toast
      toast({
        title: "Status updated",
        description: `Interview status changed to ${status}`,
        duration: 3000
      });
    } catch (error) {
      // Revert optimistic update on error
      queryClient.invalidateQueries([CACHE_KEYS.INVALIDATION_PATTERNS.ALL_INTERVIEWS]);
      
      toast({
        title: "Error",
        description: "Failed to update interview status",
        variant: "destructive",
        duration: 5000
      });
    }
  };

  // Error handling
  if (error) {
    throw error;
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Interviews
        </h1>
        
        {/* View toggle */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleViewChange(ViewType.LIST)}
            className={cn(
              "px-3 py-2 rounded-md text-sm font-medium",
              viewType === ViewType.LIST
                ? "bg-primary text-primary-foreground"
                : "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
            aria-pressed={viewType === ViewType.LIST}
          >
            List View
          </button>
          <button
            onClick={() => handleViewChange(ViewType.CALENDAR)}
            className={cn(
              "px-3 py-2 rounded-md text-sm font-medium",
              viewType === ViewType.CALENDAR
                ? "bg-primary text-primary-foreground"
                : "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
            aria-pressed={viewType === ViewType.CALENDAR}
          >
            Calendar View
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Main content */}
      {!isLoading && (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {viewType === ViewType.LIST ? (
            <InterviewList
              interviews={interviews}
              filters={filters}
              pagination={pagination}
              onInterviewSelect={handleInterviewSelect}
              onStatusChange={handleStatusChange}
              onFilterChange={handleFilterChange}
              className="min-h-[500px]"
            />
          ) : (
            <CalendarView
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              isReadOnly={false}
              config={{
                minDate: new Date(),
                disabledDates: []
              }}
            />
          )}
        </ErrorBoundary>
      )}
    </div>
  );
};

export default InterviewsPage;