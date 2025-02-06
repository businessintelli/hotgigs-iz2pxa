import * as React from "react" // ^18.0.0
import { TextareaHTMLAttributes, forwardRef } from "react" // ^18.0.0
import { cn } from "../../lib/utils"

// Interface extending HTML textarea attributes with custom props
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
  error?: boolean
  success?: boolean
}

// Reusable textarea component with forwarded ref support
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, success, ...props }, ref) => {
    // Base styles with Tailwind CSS classes
    const baseStyles = cn(
      "min-h-[80px]",
      "w-full",
      "rounded-md",
      "border",
      "border-input",
      "bg-background",
      "px-3",
      "py-2",
      "text-sm",
      "ring-offset-background",
      "placeholder:text-muted-foreground",
      "focus-visible:outline-none",
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
      "focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed",
      "disabled:opacity-50",
      // Apply error styles if error prop is true
      error && "border-destructive focus-visible:ring-destructive",
      // Apply success styles if success prop is true
      success && "border-success focus-visible:ring-success",
      className
    )

    return (
      <textarea
        ref={ref}
        className={baseStyles}
        // Add ARIA attributes for accessibility
        aria-invalid={error ? "true" : undefined}
        aria-required={props.required ? "true" : undefined}
        // Ensure proper resize behavior
        style={{ resize: props.style?.resize || "vertical" }}
        // Spread remaining props
        {...props}
      />
    )
  }
)

// Set display name for dev tools
Textarea.displayName = "Textarea"

export default Textarea