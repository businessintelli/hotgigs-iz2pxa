import * as React from "react" // ^18.0.0
import { useCallback } from "react" // ^18.0.0
import { useDebounce } from "use-debounce" // ^9.0.0
import { FilterPanel, type FilterConfig } from "../common/FilterPanel"
import { JobStatus, JobType, ExperienceLevel, type JobSearchParams } from "../../types/jobs"
import { cn } from "../../lib/utils"

// Props interface for the JobFilters component
interface JobFiltersProps {
  values: JobSearchParams
  onChange: (params: JobSearchParams) => void
  availableSkills?: string[]
  className?: string
  isLoading?: boolean
  defaultLocation?: string
  minSalary?: number
  maxSalary?: number
}

// Constants for filter options
const FILTER_OPTIONS = {
  status: [
    { value: JobStatus.PUBLISHED, label: "Published" },
    { value: JobStatus.DRAFT, label: "Draft" },
    { value: JobStatus.CLOSED, label: "Closed" },
    { value: JobStatus.FILLED, label: "Filled" },
    { value: JobStatus.ARCHIVED, label: "Archived" }
  ],
  type: [
    { value: JobType.FULL_TIME, label: "Full Time" },
    { value: JobType.PART_TIME, label: "Part Time" },
    { value: JobType.CONTRACT, label: "Contract" },
    { value: JobType.INTERNSHIP, label: "Internship" },
    { value: JobType.REMOTE, label: "Remote" }
  ],
  experience: [
    { value: ExperienceLevel.ENTRY, label: "Entry Level" },
    { value: ExperienceLevel.JUNIOR, label: "Junior" },
    { value: ExperienceLevel.MID, label: "Mid Level" },
    { value: ExperienceLevel.SENIOR, label: "Senior" },
    { value: ExperienceLevel.LEAD, label: "Lead" },
    { value: ExperienceLevel.EXECUTIVE, label: "Executive" }
  ]
} as const

const JobFilters: React.FC<JobFiltersProps> = ({
  values,
  onChange,
  availableSkills = [],
  className,
  isLoading = false,
  defaultLocation = "",
  minSalary = 0,
  maxSalary = 1000000
}) => {
  // Debounce text input changes
  const [debouncedOnChange] = useDebounce(onChange, 300)

  // Generate filter configurations
  const getFilterConfigs = useCallback(
    (currentValues: JobSearchParams): FilterConfig[] => [
      {
        id: "query",
        label: "Search",
        type: "search",
        placeholder: "Search jobs...",
        "aria-label": "Search jobs by keyword"
      },
      {
        id: "status",
        label: "Status",
        type: "select",
        options: FILTER_OPTIONS.status,
        multiple: true,
        placeholder: "Select status",
        "aria-label": "Filter by job status"
      },
      {
        id: "type",
        label: "Job Type",
        type: "select",
        options: FILTER_OPTIONS.type,
        multiple: true,
        placeholder: "Select job type",
        "aria-label": "Filter by job type"
      },
      {
        id: "experience_level",
        label: "Experience Level",
        type: "select",
        options: FILTER_OPTIONS.experience,
        multiple: true,
        placeholder: "Select experience level",
        "aria-label": "Filter by experience level"
      },
      {
        id: "skills",
        label: "Skills",
        type: "select",
        options: availableSkills.map(skill => ({
          value: skill,
          label: skill
        })),
        multiple: true,
        placeholder: "Select required skills",
        "aria-label": "Filter by required skills"
      },
      {
        id: "location",
        label: "Location",
        type: "search",
        placeholder: defaultLocation || "Enter location",
        "aria-label": "Filter by location"
      },
      {
        id: "remote_only",
        label: "Remote Only",
        type: "checkbox",
        "aria-label": "Show remote jobs only"
      },
      {
        id: "salary_min",
        label: "Minimum Salary",
        type: "select",
        options: Array.from({ length: 10 }, (_, i) => ({
          value: String(minSalary + (i * (maxSalary - minSalary)) / 10),
          label: `$${(minSalary + (i * (maxSalary - minSalary)) / 10).toLocaleString()}`
        })),
        placeholder: "Select minimum salary",
        "aria-label": "Filter by minimum salary"
      },
      {
        id: "salary_max",
        label: "Maximum Salary",
        type: "select",
        options: Array.from({ length: 10 }, (_, i) => ({
          value: String(minSalary + ((i + 1) * (maxSalary - minSalary)) / 10),
          label: `$${(minSalary + ((i + 1) * (maxSalary - minSalary)) / 10).toLocaleString()}`
        })),
        placeholder: "Select maximum salary",
        "aria-label": "Filter by maximum salary"
      }
    ],
    [availableSkills, defaultLocation, minSalary, maxSalary]
  )

  // Handle filter changes
  const handleFilterChange = useCallback(
    (filterKey: string, value: any) => {
      const newValues = { ...values }

      // Handle special cases for certain filters
      switch (filterKey) {
        case "query":
          debouncedOnChange({ ...newValues, query: value })
          break
        case "salary_min":
        case "salary_max":
          newValues[filterKey] = parseInt(value, 10)
          onChange(newValues)
          break
        case "remote_only":
          newValues.remote_only = value
          onChange(newValues)
          break
        default:
          // Handle arrays for multi-select filters
          if (Array.isArray(value)) {
            newValues[filterKey] = value
          } else {
            newValues[filterKey] = value
          }
          onChange(newValues)
      }
    },
    [values, onChange, debouncedOnChange]
  )

  return (
    <div
      className={cn(
        "flex flex-col gap-4 p-4 bg-card rounded-lg shadow-sm",
        "md:p-6",
        className
      )}
      role="search"
      aria-label="Job filters"
    >
      <FilterPanel
        filters={getFilterConfigs(values)}
        values={values}
        onChange={handleFilterChange}
        isLoading={isLoading}
        className="space-y-4"
      />
    </div>
  )
}

export default JobFilters