"use client"

import * as React from "react" // ^18.0.0
import { useNavigate } from "react-router-dom" // ^6.0.0
import CandidateList from "../../components/candidates/CandidateList"
import CandidateFilters from "../../components/candidates/CandidateFilters"
import CandidateSearch from "../../components/candidates/CandidateSearch"
import PageHeader from "../../components/layout/PageHeader"
import { useCandidates } from "../../lib/hooks/useCandidates"
import { Button } from "../../components/ui/button"
import { CandidateSearchParams } from "../../types/candidates"
import { PAGINATION_DEFAULTS } from "../../config/constants"

// Enhanced state interface for CandidatesPage component
interface CandidatesPageState {
  currentPage: number
  pageSize: number
  searchParams: CandidateSearchParams
  selectedCandidateId: string | null
  aiMatchScores: Record<string, number>
  sortField: string
  sortDirection: "asc" | "desc"
  lastUpdate: Date
  errorMessage: string | null
}

const CandidatesPage: React.FC = () => {
  const navigate = useNavigate()

  // Initialize state with default values
  const [state, setState] = React.useState<CandidatesPageState>({
    currentPage: PAGINATION_DEFAULTS.DEFAULT_PAGE_NUMBER,
    pageSize: PAGINATION_DEFAULTS.PAGE_SIZE,
    searchParams: {
      query: "",
      status: [],
      skills: [],
      location: "",
      remote_only: false,
      salary_min: 0,
      salary_max: 0,
      industries: [],
      experience_level: "",
      languages: [],
      is_actively_looking: false,
      availability_date: "",
      certifications: [],
      page: 1,
      limit: PAGINATION_DEFAULTS.PAGE_SIZE,
    },
    selectedCandidateId: null,
    aiMatchScores: {},
    sortField: "created_at",
    sortDirection: "desc",
    lastUpdate: new Date(),
    errorMessage: null,
  })

  // Initialize candidates hook with real-time updates
  const {
    candidates,
    isLoading,
    error,
    total,
    currentPage,
    updateSearchParams,
    matchCandidatesToJob,
  } = useCandidates({
    initialSearchParams: state.searchParams,
    queryConfig: {
      enabled: true,
      staleTime: 30000,
      retry: 2,
    },
  })

  // Handle filter changes with AI matching
  const handleFilterChange = React.useCallback(
    async (filters: CandidateSearchParams) => {
      try {
        setState((prev) => ({
          ...prev,
          searchParams: filters,
          currentPage: 1,
        }))

        // Update search parameters
        await updateSearchParams(filters)

        // Announce filter changes to screen readers
        const announcement = `Filters updated. Showing ${candidates.length} candidates.`
        const ariaLive = document.getElementById("aria-live-region")
        if (ariaLive) {
          ariaLive.textContent = announcement
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          errorMessage: "Failed to update filters. Please try again.",
        }))
      }
    },
    [candidates.length, updateSearchParams]
  )

  // Handle page changes with accessibility announcements
  const handlePageChange = React.useCallback(
    (page: number) => {
      setState((prev) => ({
        ...prev,
        currentPage: page,
      }))

      // Update URL parameters
      const searchParams = new URLSearchParams(window.location.search)
      searchParams.set("page", page.toString())
      window.history.replaceState(null, "", `?${searchParams.toString()}`)

      // Announce page change
      const announcement = `Page ${page} of ${Math.ceil(
        total / state.pageSize
      )}. Showing ${candidates.length} candidates.`
      const ariaLive = document.getElementById("aria-live-region")
      if (ariaLive) {
        ariaLive.textContent = announcement
      }
    },
    [candidates.length, state.pageSize, total]
  )

  // Handle candidate selection and navigation
  const handleCandidateSelect = React.useCallback(
    (candidateId: string) => {
      setState((prev) => ({
        ...prev,
        selectedCandidateId: candidateId,
      }))
      navigate(`/candidates/${candidateId}`)
    },
    [navigate]
  )

  // Handle search results with AI matching
  const handleSearchResults = React.useCallback(
    async (results: any[]) => {
      try {
        // Get AI match scores for results
        const matchedResults = await matchCandidatesToJob({
          jobId: "current",
          filters: state.searchParams,
        })

        // Update match scores in state
        setState((prev) => ({
          ...prev,
          aiMatchScores: matchedResults.reduce(
            (acc, curr) => ({
              ...acc,
              [curr.id]: curr.match_score,
            }),
            {}
          ),
        }))
      } catch (err) {
        console.error("AI matching error:", err)
      }
    },
    [matchCandidatesToJob, state.searchParams]
  )

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Accessibility live region */}
      <div
        id="aria-live-region"
        className="sr-only"
        role="status"
        aria-live="polite"
      />

      {/* Page header with actions */}
      <PageHeader
        title="Candidates"
        description="Manage and search through candidate profiles"
        actions={
          <Button
            onClick={() => navigate("/candidates/new")}
            aria-label="Add new candidate"
          >
            Add Candidate
          </Button>
        }
      />

      {/* Search and filters section */}
      <div className="mb-6 space-y-4">
        <CandidateSearch
          onSearchResults={handleSearchResults}
          initialFilters={state.searchParams}
          matchConfig={{
            threshold: 0.6,
            weightings: {
              skills: 0.4,
              experience: 0.3,
              location: 0.2,
              culturalFit: 0.1,
            },
          }}
        />

        <CandidateFilters
          initialFilters={state.searchParams}
          onFilterChange={handleFilterChange}
          enableRealtime={true}
          enableAIMatching={true}
        />
      </div>

      {/* Error message display */}
      {(error || state.errorMessage) && (
        <div
          className="mb-4 rounded-md bg-destructive/10 p-4 text-destructive"
          role="alert"
        >
          {error?.message || state.errorMessage}
        </div>
      )}

      {/* Candidates list with virtualization */}
      <CandidateList
        candidates={candidates}
        isLoading={isLoading}
        error={error}
        currentPage={currentPage}
        totalPages={Math.ceil(total / state.pageSize)}
        onPageChange={handlePageChange}
        onCandidateSelect={handleCandidateSelect}
        showMatchScore={true}
        itemsPerPage={state.pageSize}
        enableVirtualization={true}
      />
    </div>
  )
}

export default CandidatesPage