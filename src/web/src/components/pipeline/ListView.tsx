import * as React from "react" // ^18.0.0
import { format } from "date-fns" // ^2.30.0
import { useVirtualizer } from "@tanstack/react-virtual" // ^3.0.0
import { ErrorBoundary } from "react-error-boundary" // ^4.0.0

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shadcn/ui" // ^0.1.0

import { Badge } from "../ui/badge"
import { cn } from "../../lib/utils"
import { Candidate, CandidateStatus } from "../../types/candidates"

// Interfaces
interface ListViewProps {
  candidates: Candidate[]
  onCandidateClick: (candidate: Candidate) => void
  onStatusChange: (candidate: Candidate, newStatus: CandidateStatus) => void
  isLoading: boolean
  sortConfig: SortConfig
  onSort: (column: string) => void
}

interface SortConfig {
  column: string
  direction: "asc" | "desc"
}

interface Column {
  key: string
  label: string
  sortable: boolean
  render?: (candidate: Candidate) => React.ReactNode
}

// Constants
const COLUMNS: Column[] = [
  {
    key: "full_name",
    label: "Candidate",
    sortable: true,
    render: (candidate) => (
      <div className="flex flex-col">
        <span className="font-medium">{candidate.full_name}</span>
        <span className="text-sm text-muted-foreground">{candidate.email}</span>
      </div>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (candidate) => (
      <Badge
        variant={getStatusVariant(candidate.status)}
        title={`Status: ${candidate.status}`}
      >
        {candidate.status}
      </Badge>
    ),
  },
  {
    key: "experience_level",
    label: "Experience",
    sortable: true,
  },
  {
    key: "skills",
    label: "Skills",
    sortable: false,
    render: (candidate) => (
      <div className="flex flex-wrap gap-1">
        {candidate.skills.slice(0, 3).map((skill) => (
          <Badge key={skill} variant="secondary" className="text-xs">
            {skill}
          </Badge>
        ))}
        {candidate.skills.length > 3 && (
          <Badge variant="outline" className="text-xs">
            +{candidate.skills.length - 3}
          </Badge>
        )}
      </div>
    ),
  },
  {
    key: "last_active",
    label: "Last Active",
    sortable: true,
    render: (candidate) => format(candidate.last_active, "MMM dd, yyyy"),
  },
]

// Helper functions
const getStatusVariant = (status: CandidateStatus): "default" | "success" | "warning" | "secondary" => {
  const variants = {
    [CandidateStatus.ACTIVE]: "success",
    [CandidateStatus.PASSIVE]: "warning",
    [CandidateStatus.NOT_LOOKING]: "secondary",
    [CandidateStatus.HIRED]: "success",
    [CandidateStatus.ARCHIVED]: "secondary",
  }
  return variants[status] || "default"
}

// Main component
const ListView: React.FC<ListViewProps> = React.memo(({
  candidates,
  onCandidateClick,
  onStatusChange,
  isLoading,
  sortConfig,
  onSort,
}) => {
  // Refs
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [parentHeight, setParentHeight] = React.useState(0)

  // Virtual scroll setup
  const rowVirtualizer = useVirtualizer({
    count: candidates.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Estimated row height
    overscan: 5,
  })

  // Effects
  React.useEffect(() => {
    if (parentRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        setParentHeight(entries[0].contentRect.height)
      })
      resizeObserver.observe(parentRef.current)
      return () => resizeObserver.disconnect()
    }
  }, [])

  // Event handlers
  const handleRowClick = React.useCallback(
    (candidate: Candidate, event: React.MouseEvent | React.KeyboardEvent) => {
      // Ignore if clicking on interactive elements
      if ((event.target as HTMLElement).closest('button, a, [role="button"]')) {
        return
      }
      onCandidateClick(candidate)
    },
    [onCandidateClick]
  )

  const handleSort = React.useCallback(
    (column: string) => {
      const column_def = COLUMNS.find((col) => col.key === column)
      if (column_def?.sortable) {
        onSort(column)
      }
    },
    [onSort]
  )

  // Render helpers
  const getSortDirection = (column: string): "asc" | "desc" | undefined => {
    return sortConfig.column === column ? sortConfig.direction : undefined
  }

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div className="p-4 text-destructive" role="alert">
      <p>Error loading candidates list:</p>
      <pre className="text-sm">{error.message}</pre>
    </div>
  )

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div
        ref={parentRef}
        className="relative overflow-auto border rounded-md"
        style={{ height: "calc(100vh - 200px)" }}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.sortable && "cursor-pointer select-none",
                    "whitespace-nowrap"
                  )}
                  onClick={() => column.sortable && handleSort(column.key)}
                  aria-sort={getSortDirection(column.key)}
                >
                  {column.label}
                  {column.sortable && (
                    <span className="ml-2 text-muted-foreground">
                      {getSortDirection(column.key) === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const candidate = candidates[virtualRow.index]
              return (
                <TableRow
                  key={candidate.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50",
                    virtualRow.index % 2 === 0 ? "bg-background" : "bg-muted/20"
                  )}
                  style={{
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={(e) => handleRowClick(candidate, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      handleRowClick(candidate, e)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${candidate.full_name}`}
                >
                  {COLUMNS.map((column) => (
                    <TableCell key={column.key}>
                      {column.render
                        ? column.render(candidate)
                        : candidate[column.key as keyof Candidate]}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-background/80"
            role="status"
            aria-label="Loading candidates"
          >
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
})

ListView.displayName = "ListView"

export default ListView