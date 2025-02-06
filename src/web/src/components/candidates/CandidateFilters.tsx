import * as React from "react"; // ^18.0.0
import { debounce } from "lodash"; // ^4.17.21
import Select from "../ui/select";
import { CandidateStatus, CandidateSearchParams } from "../../types/candidates";
import { useCandidates } from "../../lib/hooks/useCandidates";
import { cn } from "../../lib/utils";

// Enhanced props interface with AI matching and real-time capabilities
interface CandidateFiltersProps {
  initialFilters?: Partial<CandidateSearchParams>;
  onFilterChange: (filters: CandidateSearchParams) => Promise<void>;
  className?: string;
  enableRealtime?: boolean;
  enableAIMatching?: boolean;
  onError?: (error: Error) => void;
}

const CandidateFilters: React.FC<CandidateFiltersProps> = ({
  initialFilters,
  onFilterChange,
  className,
  enableRealtime = true,
  enableAIMatching = true,
  onError
}) => {
  // Local state for filters
  const [filters, setFilters] = React.useState<CandidateSearchParams>({
    query: "",
    status: [],
    skills: [],
    location: "",
    remote_only: false,
    salary_min: 0,
    salary_max: 0,
    industries: [],
    experience_level: "",
    languages: [],
    is_actively_looking: false,
    availability_date: "",
    certifications: [],
    page: 1,
    limit: 20,
    ...initialFilters
  });

  // Error state
  const [error, setError] = React.useState<Error | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = React.useState(false);

  // Initialize candidates hook with real-time updates
  const {
    updateSearchParams,
    searchCandidates,
  } = useCandidates({
    initialSearchParams: filters,
    queryConfig: {
      enabled: true,
      staleTime: 30000,
      retry: 2
    }
  });

  // Debounced filter change handler
  const debouncedFilterChange = React.useMemo(
    () =>
      debounce(async (newFilters: CandidateSearchParams) => {
        try {
          setIsLoading(true);
          await onFilterChange(newFilters);
          setError(null);
        } catch (err) {
          const error = err instanceof Error ? err : new Error("Filter update failed");
          setError(error);
          onError?.(error);
        } finally {
          setIsLoading(false);
        }
      }, 300),
    [onFilterChange, onError]
  );

  // Update filters and trigger change
  const updateFilters = React.useCallback(
    (updates: Partial<CandidateSearchParams>) => {
      const newFilters = {
        ...filters,
        ...updates,
        // Reset page when changing filters
        page: updates.query !== undefined ? 1 : filters.page
      };
      setFilters(newFilters);
      debouncedFilterChange(newFilters);
      updateSearchParams(newFilters);
    },
    [filters, debouncedFilterChange, updateSearchParams]
  );

  // Status filter options
  const statusOptions = React.useMemo(
    () => [
      { value: CandidateStatus.ACTIVE, label: "Active" },
      { value: CandidateStatus.PASSIVE, label: "Passive" },
      { value: CandidateStatus.NOT_LOOKING, label: "Not Looking" },
      { value: CandidateStatus.HIRED, label: "Hired" },
      { value: CandidateStatus.ARCHIVED, label: "Archived" }
    ],
    []
  );

  // Cleanup debounce on unmount
  React.useEffect(() => {
    return () => {
      debouncedFilterChange.cancel();
    };
  }, [debouncedFilterChange]);

  return (
    <div
      className={cn(
        "grid gap-4 p-4 bg-background rounded-lg border",
        className
      )}
      role="search"
      aria-label="Candidate filters"
    >
      {/* Search Input */}
      <div className="space-y-2">
        <label
          htmlFor="search"
          className="text-sm font-medium text-foreground"
        >
          Search Candidates
        </label>
        <input
          id="search"
          type="search"
          placeholder="Search by name, skills, or location..."
          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
          value={filters.query}
          onChange={(e) => updateFilters({ query: e.target.value })}
          aria-label="Search candidates"
          disabled={isLoading}
        />
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <label
          htmlFor="status"
          className="text-sm font-medium text-foreground"
        >
          Candidate Status
        </label>
        <Select
          id="status"
          placeholder="Select status..."
          options={statusOptions}
          value={filters.status?.[0]}
          onChange={(value) => updateFilters({ status: value ? [value] : [] })}
          disabled={isLoading}
          aria-label="Filter by candidate status"
        />
      </div>

      {/* Skills Filter */}
      <div className="space-y-2">
        <label
          htmlFor="skills"
          className="text-sm font-medium text-foreground"
        >
          Required Skills
        </label>
        <input
          id="skills"
          type="text"
          placeholder="Enter skills (comma separated)"
          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
          value={filters.skills?.join(", ")}
          onChange={(e) =>
            updateFilters({
              skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
            })
          }
          aria-label="Filter by skills"
          disabled={isLoading}
        />
      </div>

      {/* Location Filter */}
      <div className="space-y-2">
        <label
          htmlFor="location"
          className="text-sm font-medium text-foreground"
        >
          Location
        </label>
        <input
          id="location"
          type="text"
          placeholder="Enter location"
          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
          value={filters.location}
          onChange={(e) => updateFilters({ location: e.target.value })}
          aria-label="Filter by location"
          disabled={isLoading}
        />
      </div>

      {/* Remote Only Toggle */}
      <div className="flex items-center space-x-2">
        <input
          id="remote"
          type="checkbox"
          className="rounded border-input"
          checked={filters.remote_only}
          onChange={(e) => updateFilters({ remote_only: e.target.checked })}
          aria-label="Show remote candidates only"
          disabled={isLoading}
        />
        <label
          htmlFor="remote"
          className="text-sm font-medium text-foreground"
        >
          Remote Only
        </label>
      </div>

      {/* Error Display */}
      {error && (
        <div
          className="p-3 text-sm text-destructive bg-destructive/10 rounded-md"
          role="alert"
        >
          {error.message}
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div
          className="text-sm text-muted-foreground"
          aria-live="polite"
        >
          Updating filters...
        </div>
      )}
    </div>
  );
};

CandidateFilters.displayName = "CandidateFilters";

export default CandidateFilters;