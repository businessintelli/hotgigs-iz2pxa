"use client"

import * as React from "react" // ^18.0.0
import { Slot } from "@radix-ui/react-slot" // ^1.0.0
import { cn } from "../../lib/utils"

// Type definitions for button variants and sizes
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "success" | "warning"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
  isLoading?: boolean
}

// Utility function to generate button variant classes
export const buttonVariants = ({
  variant = "default",
  size = "default",
  isLoading = false,
  className,
}: {
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  isLoading?: boolean
  className?: string
} = {}): string => {
  return cn(
    // Base button styles with focus and accessibility
    "inline-flex items-center justify-center rounded-md font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "select-none",
    // ARIA support for loading state
    isLoading && "cursor-wait",
    
    // Variant styles
    {
      default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
      success: "bg-green-600 text-white hover:bg-green-700",
      warning: "bg-yellow-600 text-white hover:bg-yellow-700",
    }[variant],

    // Size styles
    {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10",
    }[size],

    // Custom className override
    className
  )
}

// Main Button component
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  isLoading = false,
  disabled,
  children,
  ...props
}, ref) => {
  // Determine if we should render as a Slot or button
  const Comp = asChild ? Slot : "button"

  // Loading spinner component
  const LoadingSpinner = () => (
    <svg
      className="mr-2 h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )

  return (
    <Comp
      className={buttonVariants({
        variant,
        size,
        isLoading,
        className,
      })}
      ref={ref}
      disabled={isLoading || disabled}
      aria-disabled={isLoading || disabled}
      aria-busy={isLoading}
      role="button"
      {...props}
    >
      {isLoading && <LoadingSpinner />}
      {children}
    </Comp>
  )
})

// Display name for React DevTools
Button.displayName = "Button"

export { Button }