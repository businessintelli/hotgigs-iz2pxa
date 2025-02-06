import * as React from "react"; // ^18.0.0
import { useDebounce } from "use-debounce"; // ^9.0.0
import SearchBar from "../common/SearchBar";
import { useCandidates } from "../../lib/hooks/useCandidates";
import type { CandidateSearchParams, CandidateWithMatchScore } from "../../types/candidates";
import { cn } from "../../lib/utils";

interface CandidateSearchProps {
  className?: string;
  onSearchResults: (results: CandidateWithMatchScore[]) => void;
  initialFilters?: Partial<CandidateSearchParams>;
  matchConfig?: {
    threshold: number;
    weightings: {
      skills: number;
      experience: number;
      location: number;
      culturalFit: number;
    };
  };
}

const CandidateSearch: React.FC<CandidateSearchProps> = ({
  className,
  onSearchResults,
  initialFilters,
  matchConfig = {
    threshold: 0.6,
    weightings: {
      skills: 0.4,
      experience: 0.3,
      location: 0.2,
      culturalFit: 0.1,
    },
  },
}) => {
  // Initialize search state with hooks
  const {
    searchParams,
    updateSearchParams,
    candidates,
    isLoading,
    error,
    matchCandidatesToJob,
  } = useCandidates({
    initialSearchParams: {
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
      ...initialFilters,
    },
  });

  // Debounce search input to prevent excessive API calls
  const [debouncedSearchTerm] = useDebounce(searchParams.query, 300);

  // Track mounted state for cleanup
  const isMounted = React.useRef(true);
  React.useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Handle search input changes
  const handleSearch = React.useCallback(
    async (searchQuery: string) => {
      try {
        // Update search parameters
        updateSearchParams({
          query: searchQuery,
          page: 1, // Reset to first page on new search
        });

        // Wait for debounced search term to update
        if (debouncedSearchTerm !== searchQuery) return;

        // Process results through AI matching if config provided
        if (matchConfig && candidates.length > 0) {
          const matchedCandidates = await matchCandidatesToJob({
            jobId: "current", // Use current job context
            filters: {
              ...searchParams,
              query: searchQuery,
            },
          });

          // Filter candidates based on match threshold
          const filteredCandidates = matchedCandidates.filter(
            (candidate) => candidate.match_score >= matchConfig.threshold
          );

          // Sort by match score
          const sortedCandidates = filteredCandidates.sort(
            (a, b) => b.match_score - a.match_score
          );

          // Update results if component is still mounted
          if (isMounted.current) {
            onSearchResults(sortedCandidates);
          }
        } else {
          // Return regular search results if no AI matching
          if (isMounted.current) {
            onSearchResults(candidates);
          }
        }
      } catch (err) {
        console.error("Search error:", err);
        // Return empty results on error
        if (isMounted.current) {
          onSearchResults([]);
        }
      }
    },
    [
      candidates,
      debouncedSearchTerm,
      matchConfig,
      matchCandidatesToJob,
      onSearchResults,
      searchParams,
      updateSearchParams,
    ]
  );

  // Container classes
  const containerClasses = cn(
    "flex flex-col w-full gap-4",
    {
      "opacity-50": isLoading,
    },
    className
  );

  return (
    <div className={containerClasses} role="search">
      <SearchBar
        placeholder="Search candidates by name, skills, or location..."
        onSearch={handleSearch}
        debounceMs={300}
        isLoading={isLoading}
        className="w-full"
        ariaLabel="Search candidates"
      />
      
      {error && (
        <div
          role="alert"
          className="text-sm text-destructive"
          aria-live="polite"
        >
          {error.message}
        </div>
      )}

      {/* Screen reader status */}
      <div className="sr-only" aria-live="polite">
        {isLoading
          ? "Searching candidates..."
          : `Found ${candidates.length} candidates`}
      </div>
    </div>
  );
};

// Set display name for React DevTools
CandidateSearch.displayName = "CandidateSearch";

export default CandidateSearch;