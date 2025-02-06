import * as React from "react" // ^18.0.0
import { cn } from "../../lib/utils"

// Card variant configuration types
type CardSize = "sm" | "md" | "lg"
type CardVariant = "default" | "bordered" | "shadowed"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: CardSize
  variant?: CardVariant
}

// Card variants configuration with Tailwind classes
const cardVariants = {
  size: {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  },
  variant: {
    default: "bg-white dark:bg-gray-800 rounded-lg",
    bordered: "bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700",
    shadowed: "bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/30",
  },
}

// Main Card component
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          cardVariants.variant[variant],
          cardVariants.size[size],
          "transition-all duration-200",
          className
        )}
        {...props}
      />
    )
  }
)
Card.displayName = "Card"

// Card Header component
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

// Card Title component
const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-50",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

// Card Description component
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-sm text-gray-500 dark:text-gray-400",
      className
    )}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

// Card Content component
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("pt-0", className)}
    {...props}
  />
))
CardContent.displayName = "CardContent"

// Card Footer component
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700",
      className
    )}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
}