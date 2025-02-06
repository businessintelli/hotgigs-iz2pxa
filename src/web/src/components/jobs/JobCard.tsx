import * as React from "react" // ^18.0.0
import { Job } from "../../types/jobs"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card"
import { Badge } from "../ui/badge"
import { cn } from "../../lib/utils"

interface JobCardProps extends React.HTMLAttributes<HTMLDivElement> {
  job: Job
  className?: string
  onClick?: () => void
  isLoading?: boolean
  testId?: string
}

const JobCard = React.forwardRef<HTMLDivElement, JobCardProps>(
  ({ job, className, onClick, isLoading = false, testId, ...props }, ref) => {
    // Get appropriate badge variant based on job status
    const getStatusBadgeVariant = (status: Job["status"]): { variant: "default" | "success" | "warning" | "destructive"; ariaLabel: string } => {
      switch (status) {
        case "PUBLISHED":
          return { variant: "success", ariaLabel: "Active job posting" }
        case "DRAFT":
          return { variant: "warning", ariaLabel: "Draft job posting" }
        case "CLOSED":
          return { variant: "destructive", ariaLabel: "Closed job posting" }
        case "FILLED":
          return { variant: "success", ariaLabel: "Position filled" }
        case "ARCHIVED":
          return { variant: "default", ariaLabel: "Archived job posting" }
        default:
          return { variant: "default", ariaLabel: "Job status" }
      }
    }

    const { variant, ariaLabel } = getStatusBadgeVariant(job.status)

    return (
      <Card
        ref={ref}
        className={cn(
          "group relative transition-all hover:shadow-md",
          isLoading && "animate-pulse",
          onClick && "cursor-pointer",
          className
        )}
        onClick={onClick}
        data-testid={testId}
        {...props}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-50">
              {job.title}
            </CardTitle>
            <Badge 
              variant={variant}
              aria-label={ariaLabel}
              className="capitalize"
            >
              {job.status.toLowerCase()}
            </Badge>
          </div>
          <CardDescription className="mt-2 line-clamp-2">
            {job.description}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {/* Required Skills */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Required Skills
              </h4>
              <div className="flex flex-wrap gap-2">
                {job.requirements.required_skills.slice(0, 5).map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="text-xs"
                    aria-label={`Required skill: ${skill}`}
                  >
                    {skill}
                  </Badge>
                ))}
                {job.requirements.required_skills.length > 5 && (
                  <Badge
                    variant="outline"
                    className="text-xs"
                    aria-label={`${job.requirements.required_skills.length - 5} more required skills`}
                  >
                    +{job.requirements.required_skills.length - 5} more
                  </Badge>
                )}
              </div>
            </div>

            {/* Experience Level */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Experience:
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {job.requirements.experience_level.replace('_', ' ').toLowerCase()} • {job.requirements.years_experience}+ years
              </span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Location */}
            <div className="flex items-center space-x-1">
              <svg
                className="h-4 w-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {job.location} {job.remote_allowed && "• Remote"}
              </span>
            </div>

            {/* Salary Range */}
            <div className="flex items-center space-x-1">
              <svg
                className="h-4 w-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Applications Count */}
          <Badge
            variant="outline"
            className="text-xs"
            aria-label={`${job.applications_count} applications received`}
          >
            {job.applications_count} applications
          </Badge>
        </CardFooter>
      </Card>
    )
  }
)

JobCard.displayName = "JobCard"

export default JobCard