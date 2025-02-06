import { SortOrder } from '../types/common';

// Environment validation
if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

// Environment
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Supabase Configuration
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Pagination Settings
export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE_NUMBER: 1,
  DEFAULT_SORT_ORDER: SortOrder.DESC
} as const;

// Date Format Patterns
export const DATE_FORMATS = {
  DISPLAY_DATE: 'MMM dd, yyyy',
  DISPLAY_TIME: 'HH:mm',
  DISPLAY_DATETIME: 'MMM dd, yyyy HH:mm',
  API_DATE: 'yyyy-MM-dd',
  ISO_DATE: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
} as const;

// File Upload Constraints
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES: 5,
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks
  ALLOWED_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf'
  ],
  MAX_FILENAME_LENGTH: 255
} as const;

// Cache Keys for Tanstack Query
export const CACHE_KEYS = {
  USER_PROFILE: 'user-profile',
  JOB_LIST: 'jobs',
  CANDIDATE_LIST: 'candidates',
  INVALIDATION_PATTERNS: {
    ALL_JOBS: 'jobs:*',
    ALL_CANDIDATES: 'candidates:*',
    ALL_APPLICATIONS: 'applications:*',
    ALL_INTERVIEWS: 'interviews:*'
  }
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  GENERIC_ERROR: 'An unexpected error occurred. Please try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
  UNAUTHORIZED: 'You must be logged in to perform this action.',
  FORBIDDEN: 'You do not have permission to perform this action.'
} as const;

// Local Storage Keys
export const LOCAL_STORAGE_KEYS = {
  AUTH_TOKEN: 'hotgigs:auth-token',
  USER_PREFERENCES: 'hotgigs:user-preferences',
  THEME: 'hotgigs:theme',
  LANGUAGE: 'hotgigs:language',
  LAST_VIEWED_JOB: 'hotgigs:last-viewed-job',
  SEARCH_HISTORY: 'hotgigs:search-history'
} as const;

// API Rate Limits
export const API_RATE_LIMITS = {
  JOBS: {
    limit: 1000,
    window: 3600, // 1 hour
    retryAfter: 60 // 1 minute
  },
  APPLICATIONS: {
    limit: 2000,
    window: 3600,
    retryAfter: 30
  },
  CANDIDATES: {
    limit: 1000,
    window: 3600,
    retryAfter: 60
  },
  INTERVIEWS: {
    limit: 500,
    window: 3600,
    retryAfter: 120
  }
} as const;

// WebSocket Configuration
export const WEBSOCKET_CONFIG = {
  reconnectInterval: 1000, // 1 second
  maxRetries: 5,
  eventTypes: [
    'job_update',
    'application_status_change',
    'interview_scheduled',
    'candidate_status_change'
  ],
  heartbeatInterval: 30000 // 30 seconds
} as const;