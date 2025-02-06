import * as React from "react"; // ^18.0.0
import { Search } from "lucide-react"; // ^0.284.0
import Input from "../ui/input";
import { cn, debounce } from "../../lib/utils";

interface SearchBarProps {
  placeholder: string;
  className?: string;
  onSearch: (value: string) => Promise<void> | void;
  debounceMs?: number;
  isLoading?: boolean;
  ariaLabel?: string;
}

const useSearchHandler = (
  onSearch: (value: string) => Promise<void> | void,
  debounceMs: number
) => {
  // Create memoized debounced search function
  const debouncedSearch = React.useMemo(
    () => debounce(onSearch, debounceMs),
    [onSearch, debounceMs]
  );

  // Cleanup debounce timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (debouncedSearch.hasOwnProperty("clear")) {
        (debouncedSearch as any).clear();
      }
    };
  }, [debouncedSearch]);

  // Return memoized change handler
  return React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      debouncedSearch(event.target.value);
    },
    [debouncedSearch]
  );
};

const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      placeholder,
      className,
      onSearch,
      debounceMs = 300,
      isLoading = false,
      ariaLabel = "Search",
    },
    ref
  ) => {
    const handleSearch = useSearchHandler(onSearch, debounceMs);

    // Combine default and custom classes
    const containerClassName = cn(
      "relative flex items-center w-full max-w-md",
      className
    );

    const iconClassName = cn(
      "absolute left-3 h-4 w-4 text-muted-foreground",
      isLoading && "animate-spin"
    );

    return (
      <div className={containerClassName}>
        <Search className={iconClassName} aria-hidden="true" />
        <Input
          ref={ref}
          type="search"
          placeholder={placeholder}
          className="pl-9 pr-4 w-full"
          onChange={handleSearch}
          aria-label={ariaLabel}
          disabled={isLoading}
          // Additional accessibility attributes
          role="searchbox"
          aria-busy={isLoading}
          aria-describedby="search-description"
        />
        <span id="search-description" className="sr-only">
          Type to search and press enter to submit
        </span>
      </div>
    );
  }
);

// Set display name for React DevTools
SearchBar.displayName = "SearchBar";

export default SearchBar;