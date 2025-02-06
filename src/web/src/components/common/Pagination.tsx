"use client"

import * as React from "react" // ^18.0.0
import { ChevronLeft, ChevronRight } from "lucide-react" // ^0.284.0
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"
import { PaginationParams } from "../../types/common"

interface PaginationProps {
  currentPage: number
  totalPages: number
  limit: number
  onPageChange: (page: number) => void
  className?: string
}

/**
 * Generates an array of page numbers with ellipsis for large page counts
 * Optimized with useMemo to prevent unnecessary recalculations
 */
const generatePageNumbers = (
  currentPage: number,
  totalPages: number
): number[] => {
  const pageNumbers = React.useMemo(() => {
    // Handle edge cases
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: number[] = []
    const visibleRange = 2 // Number of pages to show around current page

    // Always show first page
    pages.push(1)

    // Add ellipsis if needed before current page range
    if (currentPage - visibleRange > 2) {
      pages.push(-1)
    }

    // Add pages around current page
    for (
      let i = Math.max(2, currentPage - visibleRange);
      i <= Math.min(totalPages - 1, currentPage + visibleRange);
      i++
    ) {
      pages.push(i)
    }

    // Add ellipsis if needed after current page range
    if (currentPage + visibleRange < totalPages - 1) {
      pages.push(-1)
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages)
    }

    return pages
  }, [currentPage, totalPages])

  return pageNumbers
}

/**
 * Pagination component with accessibility support and mobile optimization
 * Implements shadcn/ui design system with Tailwind CSS
 */
const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  limit,
  onPageChange,
  className,
}) => {
  // Validate current page boundaries
  const validatedPage = Math.max(1, Math.min(currentPage, totalPages))
  const pageNumbers = generatePageNumbers(validatedPage, totalPages)

  // Handle page change with validation
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      onPageChange(newPage)
    }
  }

  // Early return for single page
  if (totalPages <= 1) return null

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className={cn(
        "flex items-center justify-center space-x-2",
        "py-4 sm:py-6",
        className
      )}
    >
      {/* Previous page button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Go to previous page"
        className="hidden sm:inline-flex"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Page numbers */}
      <div className="flex items-center space-x-2">
        {pageNumbers.map((pageNum, idx) => {
          // Render ellipsis
          if (pageNum === -1) {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 text-muted-foreground"
                aria-hidden="true"
              >
                ...
              </span>
            )
          }

          // Render page number button
          return (
            <Button
              key={pageNum}
              variant={pageNum === currentPage ? "default" : "outline"}
              size="icon"
              onClick={() => handlePageChange(pageNum)}
              aria-label={`Go to page ${pageNum}`}
              aria-current={pageNum === currentPage ? "page" : undefined}
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              {pageNum}
            </Button>
          )
        })}
      </div>

      {/* Next page button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Go to next page"
        className="hidden sm:inline-flex"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Mobile-optimized navigation */}
      <div className="flex sm:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="mr-2"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </nav>
  )
}

export default Pagination