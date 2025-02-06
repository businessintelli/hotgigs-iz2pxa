"use client"

import * as React from "react" // ^18.0.0
import { useRouter } from "next/router" // ^13.0.0
import { useVirtualizer } from "@tanstack/react-virtual" // ^3.0.0
import { Job, JobSearchParams } from "../../types/jobs"
import JobCard from "./JobCard"
import Pagination from "../common/Pagination"
import { useJobs } from "../../lib/hooks/useJobs"
import EmptyState from "../common/EmptyState"
import { Skeleton } from "@shadcn/ui" // ^0.1.0
import { cn } from "../../lib/utils"

// ViewMode type for list display options
type ViewMode = "grid" | "list"

// Props interface with enhanced search parameters
interface JobListProps {
  searchParams: JobSearchParams
  onSearchParamsChange: (params: JobSearchParams) => void
  className?: string
  enableRealtime?: boolean
  viewMode?: ViewMode
}

const JobList: React.FC<JobListProps> = ({
  searchParams,
  onSearchParamsChange,
  className,
  enableRealtime = true,
  viewMode = "grid",
}) => {
  const router = useRouter()
  const parentRef = React.useRef<HTMLDivElement>(null)
  const { useJobSearch, initializeRealTimeUpdates } = useJobs()
  
  // Query jobs with infinite loading
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isError,
    refetch
  } = useJobSearch(searchParams)

  // Initialize real-time updates if enabled
  React.useEffect(() => {
    if (enableRealtime) {
      const cleanup = initializeRealTimeUpdates()
      return () => cleanup()
    }
  }, [enableRealtime, initializeRealTimeUpdates])

  // Setup virtual list for performance
  const allJobs = React.useMemo(() => {
    return data?.pages.flatMap(page => page.data) ?? []
  }, [data])

  const virtualizer = useVirtualizer({
    count: allJobs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => viewMode === "grid" ? 300 : 200,
    overscan: 5
  })

  // Handle job card click with analytics
  const handleJobClick = React.useCallback((jobId: string) => {
    router.push(`/jobs/${jobId}`)
  }, [router])

  // Handle pagination with scroll restoration
  const handlePageChange = React.useCallback((page: number) => {
    const scrollPos = parentRef.current?.scrollTop
    onSearchParamsChange({ ...searchParams, page })
    if (scrollPos) {
      requestAnimationFrame(() => {
        parentRef.current?.scrollTo(0, scrollPos)
      })
    }
  }, [searchParams, onSearchParamsChange])

  // Loading state
  if (isFetching && !data) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              "h-[300px] w-full rounded-lg",
              viewMode === "list" && "h-[200px]"
            )}
          />
        ))}
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <EmptyState
        title="Error Loading Jobs"
        description="There was a problem loading the job listings. Please try again."
        actionLabel="Retry"
        onAction={() => refetch()}
        icon={
          <svg
            className="h-12 w-12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 48 48"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M24 8v4m0 4v4m0 4v4m0 4v4m-4-28h8M12 20h24M12 28h24"
            />
          </svg>
        }
      />
    )
  }

  // Empty state
  if (allJobs.length === 0) {
    return (
      <EmptyState
        title="No Jobs Found"
        description={
          searchParams.query
            ? "Try adjusting your search terms or filters"
            : "No job postings are currently available"
        }
        icon={
          <svg
            className="h-12 w-12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 48 48"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M24 32h.01M24 16v8"
            />
          </svg>
        }
      />
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Virtual list container */}
      <div
        ref={parentRef}
        className={cn(
          "relative",
          viewMode === "grid"
            ? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
            : "space-y-4"
        )}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          overflowY: "auto"
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const job = allJobs[virtualItem.index]
          return (
            <div
              key={job.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className={cn(
                "transition-all duration-200",
                isFetching && "opacity-60"
              )}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`
              }}
            >
              <JobCard
                job={job}
                onClick={() => handleJobClick(job.id)}
                className="h-full"
                testId={`job-card-${job.id}`}
              />
            </div>
          )
        })}
      </div>

      {/* Pagination controls */}
      {data && data.pages[0].total_pages > 1 && (
        <Pagination
          currentPage={searchParams.page}
          totalPages={data.pages[0].total_pages}
          limit={searchParams.limit}
          onPageChange={handlePageChange}
          className="mt-8"
        />
      )}

      {/* Loading indicator for next page */}
      {isFetching && data && (
        <div className="flex justify-center py-4">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      )}
    </div>
  )
}

export default JobList