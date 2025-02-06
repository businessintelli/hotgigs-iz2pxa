"use client"

import * as React from "react" // ^18.0.0
import { useVirtualizer } from "@tanstack/react-virtual" // ^3.0.0
import { ErrorBoundary } from "react-error-boundary" // ^4.0.0
import { cn } from "../../lib/utils"
import CandidateCard from "./CandidateCard"
import EmptyState from "../common/EmptyState"
import Pagination from "../common/Pagination"
import { Candidate } from "../../types/candidates"
import { Users } from "lucide-react" // ^0.284.0

interface CandidateListProps {
  candidates: Candidate[]
  isLoading: boolean
  error: Error | null
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onCandidateSelect: (id: string) => void
  showMatchScore?: boolean
  className?: string
  itemsPerPage?: number
  enableVirtualization?: boolean
}

// Skeleton loader for loading state
const CandidateListSkeleton: React.FC = () => (
  <div className="space-y-4">
    {Array.from({ length: 5 }).map((_, index) => (
      <div
        key={index}
        className="animate-pulse rounded-lg border border-border bg-background p-6"
      >
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="h-6 w-24 rounded bg-muted" />
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-5 w-20 rounded bg-muted" />
            ))}
          </div>
          <div className="h-4 w-36 rounded bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
      </div>
    ))}
  </div>
)

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div
    className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center"
    role="alert"
  >
    <h3 className="mb-2 text-lg font-semibold text-destructive">
      Error Loading Candidates
    </h3>
    <p className="text-sm text-destructive/80">{error.message}</p>
  </div>
)

const CandidateList = React.memo<CandidateListProps>(({
  candidates,
  isLoading,
  error,
  currentPage,
  totalPages,
  onPageChange,
  onCandidateSelect,
  showMatchScore = false,
  className,
  itemsPerPage = 20,
  enableVirtualization = false,
}) => {
  // Container ref for virtualization
  const parentRef = React.useRef<HTMLDivElement>(null)

  // Virtual list configuration
  const virtualizer = enableVirtualization
    ? useVirtualizer({
        count: candidates.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 200, // Estimated height of each candidate card
        overscan: 5, // Number of items to render outside visible area
      })
    : null

  // Handle candidate selection with keyboard support
  const handleCandidateClick = React.useCallback(
    (id: string, event: React.MouseEvent | React.KeyboardEvent) => {
      if (
        event.type === "click" ||
        (event.type === "keydown" && (event as React.KeyboardEvent).key === "Enter")
      ) {
        event.preventDefault()
        onCandidateSelect(id)
      }
    },
    [onCandidateSelect]
  )

  // Loading state
  if (isLoading) {
    return <CandidateListSkeleton />
  }

  // Error state
  if (error) {
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <ErrorFallback error={error} />
      </ErrorBoundary>
    )
  }

  // Empty state
  if (!candidates.length) {
    return (
      <EmptyState
        icon={<Users className="h-12 w-12" />}
        title="No Candidates Found"
        description="There are no candidates matching your criteria. Try adjusting your filters or search terms."
      />
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Candidate list container */}
      <div
        ref={parentRef}
        className="space-y-4"
        style={{
          height: enableVirtualization ? "800px" : "auto",
          overflow: enableVirtualization ? "auto" : "visible",
        }}
      >
        {virtualizer
          ? virtualizer.getVirtualItems().map((virtualItem) => {
              const candidate = candidates[virtualItem.index]
              return (
                <div
                  key={candidate.id}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                  }}
                >
                  <CandidateCard
                    candidate={candidate}
                    onClick={(id) => onCandidateSelect(id)}
                    showMatchScore={showMatchScore}
                    matchScore={candidate.match_score}
                  />
                </div>
              )
            })
          : candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                onClick={(id) => onCandidateSelect(id)}
                showMatchScore={showMatchScore}
                matchScore={candidate.match_score}
              />
            ))}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          limit={itemsPerPage}
          onPageChange={onPageChange}
          className="mt-6"
        />
      )}
    </div>
  )
})

CandidateList.displayName = "CandidateList"

export default CandidateList