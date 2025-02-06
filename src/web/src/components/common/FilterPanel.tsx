import * as React from "react" // ^18.0.0
import { XIcon } from "lucide-react" // ^0.284.0
import { ErrorBoundary } from "react-error-boundary" // ^4.0.0
import Select from "../ui/select"
import Checkbox from "../ui/checkbox"
import { cn } from "../../lib/utils"

// Filter option interface for consistent option structure
export interface FilterOption {
  value: string
  label: string
  disabled?: boolean
}

// Enum for supported filter types
export enum FilterType {
  SELECT = "select",
  CHECKBOX = "checkbox",
  SEARCH = "search"
}

// Configuration interface for individual filters
export interface FilterConfig {
  id: string
  label: string
  type: FilterType
  options?: FilterOption[]
  placeholder?: string
  multiple?: boolean
  required?: boolean
  errorMessage?: string
}

// Props interface for the FilterPanel component
export interface FilterPanelProps {
  filters: FilterConfig[]
  values: Record<string, any>
  onChange: (values: Record<string, any>) => void
  className?: string
  isLoading?: boolean
  errorMessage?: string
}

// Global styles for filter panel components
const FILTER_CLASSES = {
  panel: "flex flex-col gap-4 p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800 md:p-6",
  group: "flex flex-col gap-2 md:gap-3",
  label: "text-sm font-medium text-gray-700 dark:text-gray-200",
  controls: "flex items-center gap-2 flex-wrap md:flex-nowrap",
  clearButton: "text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500",
  error: "text-xs text-red-500 dark:text-red-400 mt-1"
} as const

// Custom hook for managing filter state
const useFilterState = (
  initialValues: Record<string, any>,
  filters: FilterConfig[]
) => {
  const [values, setValues] = React.useState(initialValues)

  const handleChange = React.useCallback(
    (filterId: string, value: any) => {
      setValues((prev) => ({
        ...prev,
        [filterId]: value
      }))
    },
    []
  )

  const handleClear = React.useCallback(
    (filterId: string) => {
      setValues((prev) => {
        const newValues = { ...prev }
        delete newValues[filterId]
        return newValues
      })
    },
    []
  )

  return {
    values,
    handleChange,
    handleClear
  }
}

// Main FilterPanel component
const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  values,
  onChange,
  className,
  isLoading = false,
  errorMessage
}) => {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const { handleChange, handleClear } = useFilterState(values, filters)

  // Handle filter value changes
  const handleFilterChange = React.useCallback(
    (filterId: string, value: any) => {
      handleChange(filterId, value)
      onChange({
        ...values,
        [filterId]: value
      })
    },
    [values, onChange, handleChange]
  )

  // Render individual filter based on type
  const renderFilter = React.useCallback(
    (filter: FilterConfig) => {
      const currentValue = values[filter.id]

      switch (filter.type) {
        case FilterType.SELECT:
          return (
            <Select
              id={filter.id}
              value={currentValue}
              options={filter.options || []}
              placeholder={filter.placeholder}
              onChange={(value) => handleFilterChange(filter.id, value)}
              disabled={isLoading}
              required={filter.required}
              error={filter.errorMessage}
              aria-label={`Filter by ${filter.label}`}
            />
          )

        case FilterType.CHECKBOX:
          return (
            <Checkbox
              id={filter.id}
              checked={!!currentValue}
              onCheckedChange={(checked) => handleFilterChange(filter.id, checked)}
              label={filter.label}
              disabled={isLoading}
              error={!!filter.errorMessage}
              aria-label={`Toggle ${filter.label} filter`}
            />
          )

        case FilterType.SEARCH:
          return (
            <input
              type="search"
              id={filter.id}
              value={currentValue || ""}
              onChange={(e) => handleFilterChange(filter.id, e.target.value)}
              placeholder={filter.placeholder}
              disabled={isLoading}
              className={cn(
                "w-full rounded-md border border-input px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                filter.errorMessage && "border-destructive"
              )}
              aria-label={`Search by ${filter.label}`}
            />
          )

        default:
          return null
      }
    },
    [values, handleFilterChange, isLoading]
  )

  return (
    <ErrorBoundary
      fallback={
        <div className="text-destructive p-4">
          Error loading filter panel. Please try again.
        </div>
      }
    >
      <div
        ref={panelRef}
        className={cn(FILTER_CLASSES.panel, className)}
        role="region"
        aria-label="Filter controls"
      >
        {filters.map((filter) => (
          <div key={filter.id} className={FILTER_CLASSES.group}>
            <div className="flex items-center justify-between">
              <label htmlFor={filter.id} className={FILTER_CLASSES.label}>
                {filter.label}
                {filter.required && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </label>
              {values[filter.id] && (
                <button
                  type="button"
                  onClick={() => handleClear(filter.id)}
                  className={FILTER_CLASSES.clearButton}
                  aria-label={`Clear ${filter.label} filter`}
                >
                  <XIcon className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className={FILTER_CLASSES.controls}>{renderFilter(filter)}</div>
            {filter.errorMessage && (
              <p className={FILTER_CLASSES.error} role="alert">
                {filter.errorMessage}
              </p>
            )}
          </div>
        ))}
        {errorMessage && (
          <p className={FILTER_CLASSES.error} role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default FilterPanel