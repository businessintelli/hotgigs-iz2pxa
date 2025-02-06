import React, { useCallback, useEffect, useRef, memo } from 'react';
import { debounce } from 'lodash'; // ^4.17.21
import Input from '../ui/input';
import { useJobSearch } from '../../lib/hooks/useJobs';
import type { JobSearchParams } from '../../types/jobs';

interface JobSearchProps {
  placeholder?: string;
  onSearch: (params: JobSearchParams) => Promise<void>;
  className?: string;
  autoFocus?: boolean;
  debounceMs?: number;
  showFilters?: boolean;
  onFilterChange?: (filters: Partial<JobSearchParams>) => void;
  suggestions?: string[];
}

const JobSearch = memo(({
  placeholder = 'Search jobs by title, skills, or location...',
  onSearch,
  className = '',
  autoFocus = false,
  debounceMs = 300,
  showFilters = false,
  onFilterChange,
  suggestions = []
}: JobSearchProps) => {
  // Refs for search input and history tracking
  const inputRef = useRef<HTMLInputElement>(null);
  const searchHistoryRef = useRef<Set<string>>(new Set());

  // Initialize search hook with error and loading states
  const { search, loading, error } = useJobSearch({
    retryCount: 3,
    cacheTime: 5 * 60 * 1000, // 5 minutes
    staleTime: 30 * 1000 // 30 seconds
  });

  // Create debounced search handler
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      try {
        const searchParams: JobSearchParams = {
          query,
          page: 1,
          limit: 20,
          status: [],
          type: [],
          skills: [],
          experience_level: [],
          location: '',
          remote_only: false,
          salary_min: 0,
          salary_max: 0,
          departments: [],
          posted_after: '',
          posted_before: '',
          tags: [],
          featured_only: false,
          sort_by: 'relevance',
          sort_direction: 'desc',
          filters: {}
        };

        await onSearch(searchParams);
        
        // Update search history
        if (query.trim()) {
          searchHistoryRef.current.add(query.trim());
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }, debounceMs),
    [onSearch, debounceMs]
  );

  // Handle input changes with debouncing
  const handleSearchChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const query = event.target.value;
    debouncedSearch(query);
  }, [debouncedSearch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Escape') {
      inputRef.current?.blur();
    }
  }, []);

  // Clear search and reset filters
  const handleClearSearch = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '';
      debouncedSearch('');
    }
    onFilterChange?.({});
  }, [debouncedSearch, onFilterChange]);

  // Set up keyboard shortcuts and focus management
  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyboardShortcut);
    return () => document.removeEventListener('keydown', handleKeyboardShortcut);
  }, []);

  // Clean up debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  return (
    <div
      className={`relative w-full ${className}`}
      role="search"
      aria-label="Search jobs"
    >
      <div className="relative flex items-center">
        {/* Search Icon */}
        <svg
          className="absolute left-3 h-5 w-5 text-gray-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clipRule="evenodd"
          />
        </svg>

        {/* Search Input */}
        <Input
          ref={inputRef}
          type="search"
          className="pl-10 pr-12"
          placeholder={placeholder}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          aria-label="Search jobs"
          aria-describedby={error ? "search-error" : undefined}
          aria-invalid={!!error}
          disabled={loading}
        />

        {/* Loading Indicator */}
        {loading && (
          <div
            className="absolute right-3 h-5 w-5 animate-spin"
            role="status"
            aria-label="Loading results"
          >
            <svg
              className="h-full w-full text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        )}

        {/* Clear Button */}
        {!loading && inputRef.current?.value && (
          <button
            type="button"
            className="absolute right-3 text-gray-400 hover:text-gray-600"
            onClick={handleClearSearch}
            aria-label="Clear search"
          >
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div
          id="search-error"
          className="mt-2 text-sm text-red-600"
          role="alert"
        >
          {error.message}
        </div>
      )}

      {/* Search Suggestions */}
      {suggestions.length > 0 && !loading && (
        <div
          className="absolute mt-1 w-full rounded-md bg-white shadow-lg"
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
              role="option"
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.value = suggestion;
                  debouncedSearch(suggestion);
                }
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Keyboard Shortcut Hint */}
      <div
        className="absolute right-3 top-full mt-1 text-xs text-gray-400"
        aria-hidden="true"
      >
        Press <kbd className="rounded bg-gray-100 px-1">⌘</kbd>+
        <kbd className="rounded bg-gray-100 px-1">K</kbd> to search
      </div>
    </div>
  );
});

// Set display name for React DevTools
JobSearch.displayName = 'JobSearch';

export default JobSearch;