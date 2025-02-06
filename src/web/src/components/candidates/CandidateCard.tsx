import * as React from "react" // ^18.0.0
import { cn } from "../../lib/utils"
import { formatDate } from "../../lib/utils"
import { Candidate, CandidateStatus } from "../../types/candidates"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../ui/card"
import { Badge } from "../ui/badge"

// Status configuration for different candidate states
const STATUS_CONFIG: Record<CandidateStatus, { variant: BadgeVariant; label: string }> = {
  [CandidateStatus.ACTIVE]: { variant: "success", label: "Active" },
  [CandidateStatus.PASSIVE]: { variant: "secondary", label: "Passive" },
  [CandidateStatus.NOT_LOOKING]: { variant: "warning", label: "Not Looking" },
  [CandidateStatus.HIRED]: { variant: "info", label: "Hired" },
  [CandidateStatus.ARCHIVED]: { variant: "destructive", label: "Archived" }
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"

interface CandidateCardProps {
  candidate: Candidate
  className?: string
  onClick?: (id: string) => void
  showMatchScore?: boolean
  matchScore?: number
  isInteractive?: boolean
  isLoading?: boolean
}

// Helper function to format skills with proper truncation
const formatSkills = (skills: string[], maxDisplay: number = 3): { visible: string[]; more: number } => {
  const visible = skills.slice(0, maxDisplay)
  const more = Math.max(0, skills.length - maxDisplay)
  return { visible, more }
}

// Memoized candidate card component for performance
const CandidateCard = React.memo<CandidateCardProps>(({
  candidate,
  className,
  onClick,
  showMatchScore = false,
  matchScore,
  isInteractive = true,
  isLoading = false
}) => {
  // Format candidate skills for display
  const { visible: visibleSkills, more: remainingSkills } = formatSkills(candidate.skills)

  // Get status configuration for the candidate
  const statusConfig = STATUS_CONFIG[candidate.status]

  // Handle card click with proper accessibility
  const handleClick = React.useCallback(() => {
    if (isInteractive && onClick) {
      onClick(candidate.id)
    }
  }, [isInteractive, onClick, candidate.id])

  return (
    <Card
      className={cn(
        "relative transition-shadow duration-200",
        isInteractive && "hover:shadow-md cursor-pointer",
        isLoading && "opacity-70 pointer-events-none",
        className
      )}
      onClick={handleClick}
      role={isInteractive ? "button" : "article"}
      tabIndex={isInteractive ? 0 : undefined}
      aria-busy={isLoading}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {candidate.full_name}
        </CardTitle>
        <Badge 
          variant={statusConfig.variant}
          title={`Status: ${statusConfig.label}`}
        >
          {statusConfig.label}
        </Badge>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Skills section */}
          <div className="flex flex-wrap gap-2">
            {visibleSkills.map((skill) => (
              <Badge 
                key={skill} 
                variant="outline"
                className="text-xs"
              >
                {skill}
              </Badge>
            ))}
            {remainingSkills > 0 && (
              <Badge 
                variant="secondary"
                className="text-xs"
              >
                +{remainingSkills} more
              </Badge>
            )}
          </div>

          {/* Experience level */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">Experience:</span> {candidate.experience_level}
          </div>

          {/* Last activity */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Last active: {formatDate(candidate.last_active, "MMM dd, yyyy")}
          </div>
        </div>
      </CardContent>

      {showMatchScore && typeof matchScore === 'number' && (
        <CardFooter className="border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Match Score:
            </span>
            <Badge 
              variant={matchScore >= 80 ? "success" : matchScore >= 60 ? "warning" : "secondary"}
              className="text-xs"
            >
              {matchScore}%
            </Badge>
          </div>
        </CardFooter>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div 
          className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 rounded-lg"
          aria-hidden="true"
        />
      )}
    </Card>
  )
})

CandidateCard.displayName = "CandidateCard"

export default CandidateCard