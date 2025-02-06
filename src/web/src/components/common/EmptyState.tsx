"use client"

import * as React from "react" // ^18.0.0
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"

// Props interface with comprehensive type safety
interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ReactNode
  className?: string
  isLoading?: boolean
  disabled?: boolean
}

// EmptyState component with memoization for performance
const EmptyState = React.memo<EmptyStateProps>(({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
  isLoading = false,
  disabled = false,
}) => {
  return (
    <div
      className={cn(
        // Base styles with responsive design
        "flex min-h-[400px] w-full flex-col items-center justify-center rounded-lg",
        "border border-dashed border-border bg-background/50 p-8 text-center",
        "animate-in fade-in-50 duration-300 ease-in-out",
        // Dark mode optimization
        "dark:border-border/50 dark:bg-background/25",
        // Custom className override
        className
      )}
      // Accessibility attributes
      role="region"
      aria-label={title}
    >
      {/* Icon container with proper sizing and dark mode support */}
      {icon && (
        <div className="mb-6 rounded-full bg-muted p-4 dark:bg-muted/25">
          <div className="h-12 w-12 text-muted-foreground dark:text-muted-foreground/75">
            {icon}
          </div>
        </div>
      )}

      {/* Title with semantic heading and proper text styles */}
      <h3 className="mb-2 text-xl font-semibold text-foreground">
        {title}
      </h3>

      {/* Description with appropriate text color and spacing */}
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>

      {/* Conditionally render action button with loading and disabled states */}
      {actionLabel && onAction && (
        <Button
          variant="default"
          size="lg"
          onClick={onAction}
          isLoading={isLoading}
          disabled={disabled}
          className="min-w-[200px]"
          aria-label={actionLabel}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
})

// Display name for React DevTools
EmptyState.displayName = "EmptyState"

// Default export for the component
export default EmptyState