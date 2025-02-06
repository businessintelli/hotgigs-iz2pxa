"use client"

import * as React from "react" // ^18.0.0
import { cn } from "../../lib/utils"
import { useIntersectionObserver } from "@uidotdev/usehooks" // ^2.4.1
import { Skeleton } from "@shadcn/ui" // ^0.1.0
import HotlistCard from "./HotlistCard"
import EmptyState from "../common/EmptyState"
import { useHotlists } from "../../lib/hooks/useHotlists"
import type { Hotlist, HotlistSearchParams } from "../../types/hotlists"

interface HotlistListProps {
  searchParams: HotlistSearchParams & { page: number; limit: number }
  onHotlistSelect: (hotlist: Hotlist) => void
  className?: string
}

const HotlistList = React.memo<HotlistListProps>(({
  searchParams,
  onHotlistSelect,
  className
}) => {
  // Infinite scroll reference
  const [loadMoreRef, isIntersecting] = useIntersectionObserver<HTMLDivElement>({
    threshold: 0.5,
    rootMargin: "100px"
  })

  // Fetch hotlists with real-time updates
  const {
    data: hotlists,
    count,
    hasMore,
    isLoading,
    error,
    createHotlist,
    updateHotlist,
    deleteHotlist
  } = useHotlists({
    searchParams,
    enableRealtime: true
  })

  // Handle hotlist selection with keyboard support
  const handleHotlistClick = React.useCallback((
    hotlist: Hotlist,
    event: React.MouseEvent | React.KeyboardEvent
  ) => {
    if (event.type === "keydown") {
      const keyEvent = event as React.KeyboardEvent
      if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return
      event.preventDefault()
    }

    onHotlistSelect(hotlist)
  }, [onHotlistSelect])

  // Loading state with skeleton grid
  if (isLoading) {
    return (
      <div
        className={cn(
          "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          className
        )}
        role="status"
        aria-busy="true"
        aria-label="Loading hotlists"
      >
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-[250px] w-full rounded-lg"
            data-testid="hotlist-skeleton"
          />
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <EmptyState
        title="Error Loading Hotlists"
        description={error.message}
        actionLabel="Try Again"
        onAction={() => window.location.reload()}
        className={className}
      />
    )
  }

  // Empty state
  if (!hotlists.length) {
    return (
      <EmptyState
        title="No Hotlists Found"
        description="Create your first hotlist to start organizing candidates."
        actionLabel="Create Hotlist"
        onAction={() => createHotlist({
          name: "New Hotlist",
          description: "",
          visibility: "PRIVATE",
          tags: [],
          owner_id: "", // Set from auth context
          member_count: 0,
          collaborator_count: 0,
          last_activity_at: new Date(),
          is_archived: false
        })}
        className={className}
      />
    )
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
      role="grid"
      aria-label="Hotlists grid"
    >
      {hotlists.map((hotlist) => (
        <HotlistCard
          key={hotlist.id}
          hotlist={hotlist}
          interactive
          onClick={(event) => handleHotlistClick(hotlist, event)}
          onDelete={() => deleteHotlist(hotlist.id)}
          onUpdate={(updates) => updateHotlist({ id: hotlist.id, ...updates })}
          className="transition-transform hover:scale-[1.02]"
          data-testid={`hotlist-card-${hotlist.id}`}
        />
      ))}

      {/* Infinite scroll trigger */}
      {hasMore && (
        <div
          ref={loadMoreRef}
          className="col-span-full h-20"
          role="status"
          aria-label="Loading more hotlists"
        >
          {isIntersecting && (
            <div className="flex justify-center">
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          )}
        </div>
      )}
    </div>
  )
})

HotlistList.displayName = "HotlistList"

export default HotlistList