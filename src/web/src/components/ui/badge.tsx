import * as React from "react" // ^18.0.0
import { cva, type VariantProps } from "class-variance-authority" // ^0.7.0
import { cn } from "../../lib/utils"

// Define badge variants with proper accessibility and theme support
const badgeVariants = cva(
  // Base styles with consistent appearance and accessibility
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-transparent bg-success text-success-foreground hover:bg-success/80",
        warning:
          "border-transparent bg-warning text-warning-foreground hover:bg-warning/80",
        info:
          "border-transparent bg-info text-info-foreground hover:bg-info/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Extract variant props type for type safety
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  title?: string
}

// Badge component with accessibility features
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, title, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label={title}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    )
  }
)

// Set display name for dev tools
Badge.displayName = "Badge"

// Export both the component and variants for flexibility
export { Badge, badgeVariants }