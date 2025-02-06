import * as React from "react" // ^18.0.0
import { format } from "date-fns" // ^2.30.0
import { ErrorBoundary } from "react-error-boundary" // ^4.0.0

import { useInterviews, InterviewsError } from "../../lib/hooks/useInterviews"
import { Interview, InterviewType } from "../../types/interviews"
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card"
import { cn } from "../../lib/utils"

interface UpcomingInterviewsProps {
  maxItems?: number
  className?: string
  showLoadingState?: boolean
}

// Format interview time with proper timezone handling
const formatInterviewTime = React.memo((date: Date): string => {
  try {
    return format(date, "MMM d, yyyy h:mm a")
  } catch (error) {
    console.error("Error formatting interview time:", error)
    return "Invalid date"
  }
})

// Get human-readable interview type label
const getInterviewTypeLabel = React.memo((type: InterviewType): string => {
  const labels: Record<InterviewType, string> = {
    [InterviewType.TECHNICAL]: "Technical Interview",
    [InterviewType.HR]: "HR Interview",
    [InterviewType.BEHAVIORAL]: "Behavioral Interview",
    [InterviewType.SYSTEM_DESIGN]: "System Design Interview",
    [InterviewType.FINAL]: "Final Interview"
  }
  return labels[type] || "Interview"
})

// Loading skeleton component
const InterviewSkeleton: React.FC = () => (
  <Card className="animate-pulse">
    <CardHeader>
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
      </div>
    </CardContent>
  </Card>
)

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
    <CardHeader>
      <CardTitle className="text-red-600 dark:text-red-400">
        Error Loading Interviews
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-red-500 dark:text-red-400">
        {error.message || "An error occurred while loading upcoming interviews"}
      </p>
    </CardContent>
  </Card>
)

export const UpcomingInterviews = React.memo<UpcomingInterviewsProps>(({
  maxItems = 5,
  className,
  showLoadingState = false
}) => {
  // Fetch interviews with real-time updates
  const { data: interviews, isLoading, error } = useInterviews(
    { status: "SCHEDULED" },
    { page: 1, limit: maxItems }
  )

  // Filter and sort upcoming interviews
  const upcomingInterviews = React.useMemo(() => {
    if (!interviews) return []
    
    return interviews
      .filter(interview => new Date(interview.scheduled_at) > new Date())
      .sort((a, b) => 
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      )
      .slice(0, maxItems)
  }, [interviews, maxItems])

  // Show loading state
  if (showLoadingState && isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        {Array.from({ length: maxItems }).map((_, index) => (
          <InterviewSkeleton key={index} />
        ))}
      </div>
    )
  }

  // Show empty state
  if (!isLoading && upcomingInterviews.length === 0) {
    return (
      <Card className={cn("bg-gray-50 dark:bg-gray-800/50", className)}>
        <CardHeader>
          <CardTitle>No Upcoming Interviews</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            There are no interviews scheduled at this time.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div
        className={cn("space-y-4", className)}
        role="region"
        aria-label="Upcoming Interviews"
      >
        {upcomingInterviews.map((interview: Interview) => (
          <Card
            key={interview.id}
            className="hover:shadow-md transition-shadow duration-200"
          >
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{getInterviewTypeLabel(interview.type)}</span>
                <time
                  dateTime={interview.scheduled_at.toISOString()}
                  className="text-sm font-normal text-gray-500 dark:text-gray-400"
                >
                  {formatInterviewTime(interview.scheduled_at)}
                </time>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Candidate:{" "}
                  <span className="text-gray-700 dark:text-gray-300">
                    {interview.candidate.full_name}
                  </span>
                </p>
                {interview.meeting_link && (
                  <a
                    href={interview.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    aria-label={`Join meeting for ${interview.candidate.full_name}'s interview`}
                  >
                    Join Meeting
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ErrorBoundary>
  )
})

UpcomingInterviews.displayName = "UpcomingInterviews"

export default UpcomingInterviews