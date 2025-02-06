import { createContext, useContext, useState, useEffect } from 'react'; // ^18.0.0
import { getThemeVariables, getSystemTheme } from '../config/theme';
import useMediaQuery from '../lib/hooks/useMediaQuery';
import { ThemeMode } from '../types/common';

// Theme storage key for persistence
const THEME_STORAGE_KEY = 'hotgigs-theme-mode';

// Theme context interface with strict typing
interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  isDark: boolean;
  isHighContrast: boolean;
}

// Create context with null check
const ThemeContext = createContext<ThemeContextType | null>(null);

// Theme provider props interface
interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Theme provider component that manages application-wide theme state
 * Handles system theme detection, persistence, and WCAG compliance
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  // Initialize theme state with persisted or system preference
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return ThemeMode.LIGHT;
    
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return stored ? (stored as ThemeMode) : ThemeMode.SYSTEM;
    } catch (error) {
      console.error('Failed to read theme preference:', error);
      return ThemeMode.SYSTEM;
    }
  });

  // System theme detection hooks
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersHighContrast = useMediaQuery('(prefers-contrast: more)');

  // Derived theme states
  const isDark = theme === ThemeMode.DARK || (theme === ThemeMode.SYSTEM && prefersDark);

  // Update theme with persistence and transition handling
  const setTheme = (mode: ThemeMode) => {
    try {
      // Validate theme mode
      if (!Object.values(ThemeMode).includes(mode)) {
        throw new Error(`Invalid theme mode: ${mode}`);
      }

      // Update state
      setThemeState(mode);

      // Persist preference
      localStorage.setItem(THEME_STORAGE_KEY, mode);

      // Apply theme variables
      const variables = getThemeVariables(
        mode === ThemeMode.SYSTEM ? (prefersDark ? ThemeMode.DARK : ThemeMode.LIGHT) : mode
      );

      // Apply CSS variables with transition
      document.documentElement.classList.add('theme-transition');
      Object.entries(variables).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });

      // Update theme class
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

      // Remove transition class after animation
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transition');
      }, 300);

      // Analytics event
      const analyticsEvent = new CustomEvent('theme-change', { 
        detail: { mode, isDark, isHighContrast: prefersHighContrast } 
      });
      window.dispatchEvent(analyticsEvent);

    } catch (error) {
      console.error('Failed to update theme:', error);
    }
  };

  // Handle system theme changes
  useEffect(() => {
    if (theme === ThemeMode.SYSTEM) {
      setTheme(ThemeMode.SYSTEM);
    }
  }, [prefersDark]);

  // Handle high contrast preference
  useEffect(() => {
    document.documentElement.setAttribute('data-high-contrast', prefersHighContrast.toString());
  }, [prefersHighContrast]);

  // Initial theme setup
  useEffect(() => {
    setTheme(theme);
  }, []);

  // Context value with memoization
  const contextValue: ThemeContextType = {
    theme,
    setTheme,
    isDark,
    isHighContrast: prefersHighContrast
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Custom hook to access theme context with error boundaries
 * @returns ThemeContextType Theme context value with null safety
 * @throws Error if used outside ThemeProvider
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  
  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}