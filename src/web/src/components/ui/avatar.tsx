"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar" // ^1.0.0
import { cn } from "../../lib/utils"

// Helper function to extract initials from name
const getInitials = (name: string): string => {
  if (!name?.trim()) return ""
  
  const words = name.trim().split(/\s+/).filter(Boolean)
  
  if (words.length === 0) return ""
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  
  return (words[0][0] + words[words.length - 1][0])
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2)
}

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  src?: string
  alt?: string
  fallback?: string
  size?: "sm" | "md" | "lg"
  delayMs?: number
  className?: string
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({
  src,
  alt,
  fallback,
  size = "md",
  delayMs,
  className,
  ...props
}, ref) => {
  // Size variant classes
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12"
  }

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <AvatarPrimitive.Image
        src={src}
        alt={alt || "User avatar"}
        className="aspect-square h-full w-full object-cover"
        loading="eager"
      />
      <AvatarPrimitive.Fallback
        className="flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground font-medium"
        delayMs={delayMs}
      >
        {fallback ? getInitials(fallback) : null}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
})

Avatar.displayName = "Avatar"

export { Avatar }
export type { AvatarProps }