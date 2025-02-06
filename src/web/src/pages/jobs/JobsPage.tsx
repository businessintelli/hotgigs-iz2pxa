"use client"

import * as React from "react"
import { useRouter } from "next/router"
import { useDebounce } from "use-debounce"
import { cn } from "../../lib/utils"
import JobList from "../../components/jobs/JobList"
import JobFilters from "../../components/jobs/JobFilters"
import JobSearch from "../../components/jobs/JobSearch"
import PageHeader from "../../components/layout/PageHeader"
import { Button } from "../../components/ui/button"
import { useJobSearch } from "../../lib/hooks/useJobs"
import type { JobSearchParams } from "../../types/jobs"

interface JobsPageProps {
  className?: string
  initialFilters?: JobSearchParams
}

const JobsPage: React.FC<JobsPageProps> = ({
  className,
  initialFilters = {
    query: "",
    page: 1,
    limit: 20,
    status: [],
    type: [],
    skills: [],
    experience_level: [],
    location: "",
    remote_only: false,
    salary_min: 0,
    salary_max: 0,
    departments: [],
    posted_after: "",
    posted_before: "",
    tags: [],
    featured_only: false,
    sort_by: "relevance",
    sort_direction: "desc",
    filters: {}
  }
}) => {
  // Router for URL management
  const router = useRouter()

  // State for search parameters
  const [searchParams, setSearchParams] = React.useState<JobSearchParams>(initialFilters)
  const [debouncedParams] = useDebounce(searchParams, 300)

  // Initialize job search hook with real-time updates
  const {
    useJobSearch,
    initializeRealTimeUpdates
  } = useJobSearch({
    retryCount: 3,
    cacheTime: 5 * 60 * 1000, // 5 minutes
    staleTime: 60 * 1000 // 1 minute
  })

  // Query jobs with search parameters
  const {
    data,
    isLoading,
    isError,
    refetch
  } = useJobSearch(debouncedParams)

  // Initialize real-time updates
  React.useEffect(() => {
    const cleanup = initializeRealTimeUpdates()
    return () => cleanup()
  }, [initializeRealTimeUpdates])

  // Sync URL with search parameters
  React.useEffect(() => {
    const queryParams = new URLSearchParams()
    Object.entries(debouncedParams).forEach(([key, value]) => {
      if (value && typeof value !== 'object') {
        queryParams.set(key, String(value))
      }
    })
    router.replace({
      pathname: router.pathname,
      query: queryParams.toString()
    }, undefined, { shallow: true })
  }, [debouncedParams, router])

  // Handle search parameter changes
  const handleSearchParamsChange = React.useCallback((params: JobSearchParams) => {
    setSearchParams(current => ({
      ...current,
      ...params,
      page: params.page || 1
    }))
  }, [])

  // Handle job creation navigation
  const handleCreateJob = React.useCallback(() => {
    router.push("/jobs/create")
  }, [router])

  return (
    <div
      className={cn(
        "container mx-auto px-4 py-6 md:px-6 lg:px-8",
        className
      )}
    >
      {/* Page Header */}
      <PageHeader
        title="Jobs"
        description="Browse and manage job listings"
        actions={
          <Button
            onClick={handleCreateJob}
            className="w-full sm:w-auto"
            aria-label="Create new job posting"
          >
            Create Job
          </Button>
        }
      />

      {/* Main Content */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[280px,1fr]">
        {/* Filters Sidebar */}
        <aside
          className="hidden lg:block"
          aria-label="Job filters"
        >
          <JobFilters
            values={searchParams}
            onChange={handleSearchParamsChange}
            className="sticky top-6"
          />
        </aside>

        {/* Jobs List Section */}
        <main>
          {/* Search Bar */}
          <div className="mb-6">
            <JobSearch
              onSearch={(query) => handleSearchParamsChange({ ...searchParams, query })}
              className="w-full"
              autoFocus
            />
          </div>

          {/* Mobile Filters Toggle */}
          <Button
            variant="outline"
            className="mb-4 w-full lg:hidden"
            onClick={() => {
              // Mobile filters implementation would go here
            }}
          >
            Filters
          </Button>

          {/* Job Listings */}
          <JobList
            searchParams={searchParams}
            onSearchParamsChange={handleSearchParamsChange}
            className="min-h-[calc(100vh-300px)]"
            enableRealtime
          />

          {/* Error State */}
          {isError && (
            <div
              className="mt-8 text-center text-destructive"
              role="alert"
              aria-live="polite"
            >
              <p>Failed to load jobs. Please try again.</p>
              <Button
                variant="outline"
                onClick={() => refetch()}
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && !data && (
            <div
              className="mt-8 text-center text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              Loading jobs...
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default JobsPage