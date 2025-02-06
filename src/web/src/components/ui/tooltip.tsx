"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip" // ^1.0.0
import { cn } from "../../lib/utils"

// Enhanced tooltip props interface with comprehensive options
interface TooltipProps {
  content: string
  children: React.ReactNode
  className?: string
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  sideOffset?: number
  delayDuration?: number
  role?: string
  skipDelayDuration?: boolean
}

// Enhanced provider component with accessibility configuration
const TooltipProvider = ({ children }: React.PropsWithChildren) => {
  // Configure default delay based on user preferences
  const defaultDelay = React.useMemo(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    return prefersReducedMotion ? 0 : 300
  }, [])

  return (
    <TooltipPrimitive.Provider delayDuration={defaultDelay}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

// Enhanced tooltip component with comprehensive accessibility support
const Tooltip = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipProps
>(({
  className,
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 4,
  delayDuration,
  role = "tooltip",
  skipDelayDuration = false,
  ...props
}, ref) => (
  <TooltipPrimitive.Root
    delayDuration={delayDuration}
    disableHoverableContent={true}
  >
    <TooltipPrimitive.Trigger
      asChild
      aria-describedby={`tooltip-${content.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {children}
    </TooltipPrimitive.Trigger>
    <TooltipPrimitive.Content
      ref={ref}
      side={side}
      align={align}
      sideOffset={sideOffset}
      role={role}
      aria-live="polite"
      className={cn(
        // Base styles
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95",
        // High contrast mode support
        "hocus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        // Reduced motion support
        "motion-safe:duration-200 motion-reduce:duration-0",
        // Side-specific animations
        side === "top" && "slide-in-from-bottom-2",
        side === "bottom" && "slide-in-from-top-2",
        side === "left" && "slide-in-from-right-2",
        side === "right" && "slide-in-from-left-2",
        // Custom styles
        className
      )}
      {...props}
    >
      {content}
      <TooltipPrimitive.Arrow 
        className="fill-primary"
        width={11}
        height={5}
      />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Root>
))

Tooltip.displayName = "Tooltip"

// Export enhanced components
export {
  Tooltip,
  TooltipProvider,
  // Re-export primitives for advanced use cases
  TooltipPrimitive as TooltipPrimitives
}