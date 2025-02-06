"use client"

import * as React from "react" // ^18.0.0
import { ErrorBoundary } from "react-error-boundary" // ^4.0.0
import * as Dialog from "@radix-ui/react-dialog" // ^1.0.4
import { useIntersectionObserver } from "@radix-ui/react-use-intersection-observer" // ^1.0.0
import { LoadingSpinner } from "@radix-ui/react-spinner" // ^1.0.0
import { Plus, Filter } from "lucide-react" // ^0.284.0

import HotlistList from "../../components/hotlists/HotlistList"
import SearchBar from "../../components/common/SearchBar"
import FilterPanel from "../../components/common/FilterPanel"
import { Button } from "../../components/ui/button"
import { useHotlists } from "../../lib/hooks/useHotlists"
import { useToast } from "../../lib/hooks/useToast"
import { cn, debounce } from "../../lib/utils"
import type { HotlistVisibility, HotlistSearchParams } from "../../types/hotlists"
import { PAGINATION_DEFAULTS } from "../../config/constants"

// Interface for page state management
interface HotlistPageState {
  isFilterOpen: boolean
  isFormOpen: boolean
  selectedHotlist: Hotlist | null
  searchParams: HotlistSearchParams
  isLoading: boolean
  error: Error | null
}

// Initial search parameters
const initialSearchParams: HotlistSearchParams = {
  query: "",
  visibility: [],
  tags: [],
  page: PAGINATION_DEFAULTS.DEFAULT_PAGE_NUMBER,
  limit: PAGINATION_DEFAULTS.PAGE_SIZE,
  include_archived: false,
  owner_id: "",
  modified_after: new Date(0),
  modified_before: new Date(),
  min_members: 0
}

// Filter configurations
const filterConfigs = [
  {
    id: "visibility",
    label: "Visibility",
    type: "select",
    options: [
      { value: "PUBLIC", label: "Public" },
      { value: "TEAM", label: "Team" },
      { value: "PRIVATE", label: "Private" }
    ]
  },
  {
    id: "tags",
    label: "Tags",
    type: "search",
    placeholder: "Filter by tags..."
  },
  {
    id: "include_archived",
    label: "Include Archived",
    type: "checkbox"
  }
]

const HotlistsPage: React.FC = () => {
  // State management
  const [state, setState] = React.useState<HotlistPageState>({
    isFilterOpen: false,
    isFormOpen: false,
    selectedHotlist: null,
    searchParams: initialSearchParams,
    isLoading: false,
    error: null
  })

  // Hooks
  const toast = useToast()
  const { data: hotlists, count, hasMore, isLoading, error, createHotlist, updateHotlist, deleteHotlist } = useHotlists({
    searchParams: state.searchParams,
    enableRealtime: true
  })

  // Debounced search handler
  const handleSearch = React.useMemo(
    () =>
      debounce((query: string) => {
        setState((prev) => ({
          ...prev,
          searchParams: {
            ...prev.searchParams,
            query,
            page: PAGINATION_DEFAULTS.DEFAULT_PAGE_NUMBER
          }
        }))
      }, 300),
    []
  )

  // Filter change handler
  const handleFilterChange = React.useCallback((values: Record<string, any>) => {
    setState((prev) => ({
      ...prev,
      searchParams: {
        ...prev.searchParams,
        ...values,
        page: PAGINATION_DEFAULTS.DEFAULT_PAGE_NUMBER
      }
    }))
  }, [])

  // Infinite scroll handler
  const loadMore = React.useCallback(() => {
    if (hasMore && !isLoading) {
      setState((prev) => ({
        ...prev,
        searchParams: {
          ...prev.searchParams,
          page: prev.searchParams.page + 1
        }
      }))
    }
  }, [hasMore, isLoading])

  // Error handler
  const handleError = React.useCallback((error: Error) => {
    toast.error({
      title: "Error",
      description: error.message
    })
    setState((prev) => ({ ...prev, error }))
  }, [toast])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      handleSearch.cancel?.()
    }
  }, [handleSearch])

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <div className="p-4 text-destructive" role="alert">
          <h2 className="text-lg font-semibold">Error Loading Hotlists</h2>
          <p>{error.message}</p>
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      )}
    >
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Talent Pools</h1>
          <Button
            onClick={() => setState((prev) => ({ ...prev, isFormOpen: true }))}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Pool
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <SearchBar
            placeholder="Search talent pools..."
            onSearch={handleSearch}
            className="flex-1"
            isLoading={isLoading}
          />
          <Button
            variant="outline"
            onClick={() => setState((prev) => ({ ...prev, isFilterOpen: !prev.isFilterOpen }))}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Filter Panel */}
        {state.isFilterOpen && (
          <div className="mb-6">
            <FilterPanel
              filters={filterConfigs}
              values={state.searchParams}
              onChange={handleFilterChange}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Results Count */}
        <div className="mb-4 text-sm text-muted-foreground">
          {count} {count === 1 ? 'pool' : 'pools'} found
        </div>

        {/* Hotlist Grid */}
        <HotlistList
          searchParams={state.searchParams}
          onHotlistSelect={(hotlist) => setState((prev) => ({ ...prev, selectedHotlist: hotlist }))}
          className="mb-8"
        />

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-4">
            <LoadingSpinner className="h-6 w-6 text-primary" />
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog.Root
          open={state.isFormOpen}
          onOpenChange={(open) => setState((prev) => ({ ...prev, isFormOpen: open, selectedHotlist: open ? prev.selectedHotlist : null }))}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background p-6 shadow-lg">
              <Dialog.Title className="text-lg font-semibold">
                {state.selectedHotlist ? 'Edit' : 'Create'} Talent Pool
              </Dialog.Title>
              {/* Form would be implemented as a separate component */}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </ErrorBoundary>
  )
}

export default HotlistsPage