"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox" // ^1.0.0
import { CheckIcon } from "@radix-ui/react-icons" // ^1.3.0
import { cn } from "../../lib/utils"

// Define props interface with comprehensive type safety
export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  /**
   * Optional label text for the checkbox
   */
  label?: string
  /**
   * Additional class names to be merged with default styles
   */
  className?: string
  /**
   * Error state for form validation
   */
  error?: boolean
}

/**
 * A fully accessible checkbox component built with Radix UI primitives.
 * Supports keyboard navigation, ARIA attributes, and custom styling.
 * 
 * @example
 * <Checkbox
 *   checked={isChecked}
 *   onCheckedChange={setIsChecked}
 *   label="Accept terms"
 * />
 */
const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex items-center space-x-2">
        <CheckboxPrimitive.Root
          ref={ref}
          className={cn(
            // Base styles
            "peer h-4 w-4 shrink-0 rounded-sm border border-primary",
            // Focus styles with keyboard navigation support
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            // Interactive states
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Hover effects
            "hover:bg-primary/5 data-[state=checked]:hover:bg-primary/90",
            // Checked state
            "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
            // Error state
            error && "border-destructive",
            className
          )}
          {...props}
        >
          <CheckboxPrimitive.Indicator
            className={cn(
              "flex items-center justify-center text-current",
              // Animation for smooth transitions
              "transition-transform duration-200",
              // Scale animation for check mark
              "data-[state=checked]:scale-100 data-[state=unchecked]:scale-0"
            )}
          >
            <CheckIcon className="h-3.5 w-3.5" />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        {label && (
          <label
            htmlFor={props.id}
            className={cn(
              "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
              error && "text-destructive"
            )}
          >
            {label}
          </label>
        )}
      </div>
    )
  }
)

// Set display name for better debugging experience
Checkbox.displayName = "Checkbox"

export default Checkbox