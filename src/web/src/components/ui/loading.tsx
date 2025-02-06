import React from "react"; // ^18.0.0
import { cn } from "../../lib/utils";

interface LoadingProps {
  /**
   * Size variant of the loading spinner
   * @default "md"
   */
  size?: "sm" | "md" | "lg";
  
  /**
   * Whether to show the spinner with a backdrop overlay
   * @default false
   */
  overlay?: boolean;
  
  /**
   * Additional CSS classes to apply to the component
   */
  className?: string;
  
  /**
   * Accessible label for screen readers
   * @default "Loading content"
   */
  ariaLabel?: string;
  
  /**
   * Animation duration in milliseconds
   * @default 750
   */
  duration?: number;
}

const LOADING_SIZES = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-3",
  lg: "h-12 w-12 border-4"
} as const;

const DEFAULT_ANIMATION_DURATION = 750;

/**
 * A loading spinner component that provides visual feedback during async operations.
 * Implements WCAG 2.1 AA accessibility guidelines and shadcn/ui design system.
 */
const Loading: React.FC<LoadingProps> = ({
  size = "md",
  overlay = false,
  className,
  ariaLabel = "Loading content",
  duration = DEFAULT_ANIMATION_DURATION
}) => {
  // Base spinner styles
  const spinnerStyles = cn(
    "inline-block rounded-full border-primary/30 border-r-primary animate-spin",
    LOADING_SIZES[size],
    className
  );

  // Animation style with customizable duration
  const animationStyle = {
    animationDuration: `${duration}ms`
  };

  const spinner = (
    <div
      role="status"
      aria-label={ariaLabel}
      className={spinnerStyles}
      style={animationStyle}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );

  // If overlay is true, wrap spinner in a backdrop
  if (overlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="relative">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
};

export default Loading;
```

This implementation:

1. Follows the shadcn/ui design system with Tailwind CSS styling
2. Provides multiple size variants with appropriate scaling
3. Supports optional overlay backdrop with blur effect
4. Implements WCAG 2.1 AA accessibility guidelines with:
   - Proper ARIA attributes
   - Screen reader support
   - Sufficient color contrast
   - Status role for assistive technologies
5. Uses the cn utility for type-safe class merging
6. Includes customizable animation duration
7. Provides TypeScript type safety with detailed interfaces
8. Includes comprehensive JSDoc documentation
9. Supports additional className customization
10. Uses constants for consistent sizing and defaults

The component can be used in various contexts:

```typescript
// Basic usage
<Loading />

// Small size with overlay
<Loading size="sm" overlay />

// Large size with custom duration
<Loading size="lg" duration={1000} />

// Custom aria label
<Loading ariaLabel="Submitting form" />