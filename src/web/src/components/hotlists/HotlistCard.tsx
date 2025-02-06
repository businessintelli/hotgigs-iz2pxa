import * as React from "react" // ^18.0.0
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card"
import { Badge } from "../ui/badge"
import { cn } from "../../lib/utils"
import type { Hotlist } from "../../types/hotlists"

interface HotlistCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hotlist: Hotlist
  interactive?: boolean
  loading?: boolean
  error?: string
}

const HotlistCard = React.forwardRef<HTMLDivElement, HotlistCardProps>(
  ({ hotlist, className, onClick, interactive = false, loading = false, error, ...props }, ref) => {
    // Handle keyboard and mouse interactions
    const handleInteraction = (event: React.MouseEvent | React.KeyboardEvent) => {
      if (!interactive || !onClick) return

      if (event.type === "keydown") {
        const keyEvent = event as React.KeyboardEvent
        if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return
        event.preventDefault()
      }

      onClick(event)
    }

    // Get visibility badge variant based on hotlist visibility
    const getVisibilityBadgeVariant = () => {
      switch (hotlist.visibility) {
        case "PUBLIC":
          return "success"
        case "TEAM":
          return "info"
        case "PRIVATE":
          return "secondary"
        default:
          return "default"
      }
    }

    // Loading state
    if (loading) {
      return (
        <Card
          ref={ref}
          className={cn(
            "animate-pulse bg-gray-50 dark:bg-gray-800",
            className
          )}
          {...props}
        >
          <CardHeader>
            <div className="h-6 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded mt-2" />
          </CardHeader>
          <CardContent>
            <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
          </CardContent>
        </Card>
      )
    }

    // Error state
    if (error) {
      return (
        <Card
          ref={ref}
          className={cn(
            "border-destructive/50 bg-destructive/5",
            className
          )}
          {...props}
        >
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Hotlist</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )
    }

    return (
      <Card
        ref={ref}
        className={cn(
          "transition-all duration-200",
          interactive && "cursor-pointer hover:shadow-md",
          className
        )}
        onClick={handleInteraction}
        onKeyDown={handleInteraction}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? "button" : "article"}
        aria-label={interactive ? `View hotlist: ${hotlist.name}` : undefined}
        {...props}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="line-clamp-1">{hotlist.name}</CardTitle>
            <Badge 
              variant={getVisibilityBadgeVariant()} 
              title={`Visibility: ${hotlist.visibility.toLowerCase()}`}
            >
              {hotlist.visibility.toLowerCase()}
            </Badge>
          </div>
          <CardDescription 
            className="line-clamp-2"
            title={hotlist.description}
          >
            {hotlist.description}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div 
            className="flex flex-wrap gap-2 max-h-20 overflow-y-auto scrollbar-thin"
            role="list"
            aria-label="Hotlist tags"
          >
            {hotlist.tags.map((tag) => (
              <Badge 
                key={tag}
                variant="outline"
                className="text-xs"
                role="listitem"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
          <span 
            role="status" 
            aria-label={`${hotlist.member_count} members`}
          >
            {hotlist.member_count} {hotlist.member_count === 1 ? 'member' : 'members'}
          </span>
          <span>
            Last updated: {new Date(hotlist.last_activity_at).toLocaleDateString()}
          </span>
        </CardFooter>
      </Card>
    )
  }
)

HotlistCard.displayName = "HotlistCard"

export default HotlistCard