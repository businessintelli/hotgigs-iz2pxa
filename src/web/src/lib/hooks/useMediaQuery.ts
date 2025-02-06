import { useState, useEffect } from 'react'; // ^18.0.0

/**
 * Custom hook that provides reactive media query matching functionality with SSR support.
 * Enables responsive design implementation by detecting viewport/device characteristics.
 * 
 * @param query - CSS media query string (e.g., '(min-width: 768px)')
 * @returns boolean indicating if the media query matches
 * 
 * @example
 * const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 */
const useMediaQuery = (query: string): boolean => {
  // Handle SSR case where window is undefined
  const isClient = typeof window !== 'undefined';

  // Initialize state with SSR-safe default value
  const [matches, setMatches] = useState<boolean>(() => {
    if (!isClient) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    // Return early if not in browser environment
    if (!isClient) return;

    // Create media query list with error handling
    let mediaQuery: MediaQueryList;
    try {
      mediaQuery = window.matchMedia(query);
    } catch (error) {
      console.error('Invalid media query:', query, error);
      return;
    }

    // Set initial value
    setMatches(mediaQuery.matches);

    // Create event listener callback
    // Using named function for better debugging and memory optimization
    const updateMatches = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };

    // Add listener with modern API if available, fallback for older browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateMatches);
    } else {
      // @ts-ignore - support for older browsers
      mediaQuery.addListener(updateMatches);
    }

    // Cleanup function
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', updateMatches);
      } else {
        // @ts-ignore - support for older browsers
        mediaQuery.removeListener(updateMatches);
      }
    };
  }, [query, isClient]); // Re-run effect if query changes or client status changes

  return matches;
};

export default useMediaQuery;