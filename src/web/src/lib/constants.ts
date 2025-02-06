import { SortOrder } from '../types/common';

/**
 * UI breakpoints for responsive design
 * Based on Technical Specifications 6.3 Responsive Behavior
 */
export const UI_BREAKPOINTS = {
  MOBILE: 320,   // 320px-639px
  TABLET: 640,   // 640px-1023px
  DESKTOP: 1024  // 1024px+
} as const;

/**
 * Animation durations in milliseconds for consistent motion design
 */
export const ANIMATION_DURATIONS = {
  FAST: 150,    // Quick transitions
  MEDIUM: 300,  // Standard transitions
  SLOW: 500     // Complex animations
} as const;

/**
 * Local storage keys for client-side data persistence
 */
export const LOCAL_STORAGE_KEYS = {
  AUTH_TOKEN: 'hotgigs_auth_token',
  USER_PREFERENCES: 'hotgigs_preferences',
  THEME: 'hotgigs_theme'
} as const;

/**
 * Session management configuration
 * Based on Security Specifications 7.3.5 Access Control Implementation
 */
export const SESSION_CONFIG = {
  TIMEOUT: 1800000,        // 30 minutes in milliseconds
  REFRESH_THRESHOLD: 300000 // 5 minutes before session expiry
} as const;

/**
 * Query configuration for Tanstack Query
 * Based on Technical Specifications 3.2.2 Data Management Strategy
 */
export const QUERY_CONFIG = {
  STALE_TIME: 300000,  // 5 minutes
  CACHE_TIME: 900000,  // 15 minutes
  RETRY_COUNT: 3       // Number of retry attempts
} as const;

/**
 * Toast notification durations in milliseconds
 */
export const TOAST_DURATION = {
  SUCCESS: 3000,
  ERROR: 5000,
  INFO: 4000
} as const;

/**
 * Default sort order for data queries
 */
export const DEFAULT_SORT_ORDER: SortOrder = SortOrder.DESC;

/**
 * Maximum file size for uploads (10MB)
 * Based on Technical Specifications A.1.1 Resume Processing Specifications
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Allowed file types for document uploads
 * Based on Technical Specifications A.1.1 Resume Processing Specifications
 */
export const ALLOWED_FILE_TYPES = ['.pdf', '.doc', '.docx', '.rtf', '.txt'] as const;

/**
 * Date and time format constants
 * Used for consistent date/time display across the application
 */
export const DATE_FORMAT = 'MMMM DD, YYYY';
export const TIME_FORMAT = 'HH:mm';

/**
 * API request timeout in milliseconds
 */
export const API_TIMEOUT = 30000; // 30 seconds

/**
 * Pagination defaults
 */
export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100
} as const;

/**
 * Cache keys for consistent cache management
 */
export const CACHE_KEYS = {
  JOBS: 'jobs',
  CANDIDATES: 'candidates',
  INTERVIEWS: 'interviews',
  USER_PROFILE: 'user-profile',
  ANALYTICS: 'analytics'
} as const;

/**
 * Rate limiting constants
 * Based on Technical Specifications 7.3.1 Network Security
 */
export const RATE_LIMITS = {
  MAX_REQUESTS_PER_MINUTE: 1000,
  COOLDOWN_PERIOD: 60000 // 1 minute in milliseconds
} as const;

/**
 * Data retention periods in days
 * Based on Technical Specifications A.1.1 Resume Processing Specifications
 */
export const RETENTION_PERIODS = {
  RESUMES: 1825,        // 5 years
  APPLICATIONS: 365,    // 1 year
  AUDIT_LOGS: 730      // 2 years
} as const;