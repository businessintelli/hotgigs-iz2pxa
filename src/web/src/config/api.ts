import { AxiosRequestConfig } from 'axios'; // ^1.5.0
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants';
import { ApiResponse, ApiEndpoint } from '../types/common';

// API version and global configuration
const API_VERSION = 'v1';
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'X-Client-Version': '1.0.0',
  'X-Api-Version': API_VERSION
};
const REQUEST_TIMEOUT = 30000; // 30 seconds
const RATE_LIMIT_CONFIG = {
  maxRequests: 1000,
  perMinute: true
};

// Interface definitions
interface RateLimitConfig {
  maxRequests: number;
  perMinute: boolean;
}

interface WebSocketConfig {
  channel: string;
  event: string;
  requiresAuth: boolean;
}

// Global API configuration
export const API_CONFIG = {
  baseURL: SUPABASE_URL,
  version: API_VERSION,
  timeout: REQUEST_TIMEOUT,
  headers: DEFAULT_HEADERS,
  rateLimit: RATE_LIMIT_CONFIG
} as const;

// Comprehensive endpoint configurations
export const ENDPOINTS = {
  auth: {
    signIn: {
      path: '/auth/signin',
      method: 'POST',
      requiresAuth: false,
      rateLimit: { maxRequests: 5, perMinute: true }
    },
    signUp: {
      path: '/auth/signup',
      method: 'POST',
      requiresAuth: false,
      rateLimit: { maxRequests: 3, perMinute: true }
    },
    refreshToken: {
      path: '/auth/refresh',
      method: 'POST',
      requiresAuth: true,
      rateLimit: { maxRequests: 10, perMinute: true }
    }
  },
  jobs: {
    list: {
      path: '/jobs',
      method: 'GET',
      requiresAuth: false,
      rateLimit: { maxRequests: 1000, perMinute: true }
    },
    create: {
      path: '/jobs',
      method: 'POST',
      requiresAuth: true,
      rateLimit: { maxRequests: 100, perMinute: true }
    },
    update: {
      path: '/jobs/:id',
      method: 'PUT',
      requiresAuth: true,
      rateLimit: { maxRequests: 100, perMinute: true }
    },
    delete: {
      path: '/jobs/:id',
      method: 'DELETE',
      requiresAuth: true,
      rateLimit: { maxRequests: 50, perMinute: true }
    }
  },
  candidates: {
    list: {
      path: '/candidates',
      method: 'GET',
      requiresAuth: true,
      rateLimit: { maxRequests: 1000, perMinute: true }
    },
    create: {
      path: '/candidates',
      method: 'POST',
      requiresAuth: true,
      rateLimit: { maxRequests: 100, perMinute: true }
    },
    update: {
      path: '/candidates/:id',
      method: 'PUT',
      requiresAuth: true,
      rateLimit: { maxRequests: 100, perMinute: true }
    },
    delete: {
      path: '/candidates/:id',
      method: 'DELETE',
      requiresAuth: true,
      rateLimit: { maxRequests: 50, perMinute: true }
    }
  },
  interviews: {
    list: {
      path: '/interviews',
      method: 'GET',
      requiresAuth: true,
      rateLimit: { maxRequests: 500, perMinute: true }
    },
    schedule: {
      path: '/interviews',
      method: 'POST',
      requiresAuth: true,
      rateLimit: { maxRequests: 100, perMinute: true }
    },
    update: {
      path: '/interviews/:id',
      method: 'PUT',
      requiresAuth: true,
      rateLimit: { maxRequests: 100, perMinute: true }
    },
    cancel: {
      path: '/interviews/:id/cancel',
      method: 'POST',
      requiresAuth: true,
      rateLimit: { maxRequests: 50, perMinute: true }
    }
  },
  analytics: {
    dashboard: {
      path: '/analytics/dashboard',
      method: 'GET',
      requiresAuth: true,
      rateLimit: { maxRequests: 100, perMinute: true }
    },
    reports: {
      path: '/analytics/reports',
      method: 'GET',
      requiresAuth: true,
      rateLimit: { maxRequests: 50, perMinute: true }
    }
  },
  hotlists: {
    list: {
      path: '/hotlists',
      method: 'GET',
      requiresAuth: true,
      rateLimit: { maxRequests: 500, perMinute: true }
    },
    create: {
      path: '/hotlists',
      method: 'POST',
      requiresAuth: true,
      rateLimit: { maxRequests: 100, perMinute: true }
    },
    update: {
      path: '/hotlists/:id',
      method: 'PUT',
      requiresAuth: true,
      rateLimit: { maxRequests: 100, perMinute: true }
    },
    delete: {
      path: '/hotlists/:id',
      method: 'DELETE',
      requiresAuth: true,
      rateLimit: { maxRequests: 50, perMinute: true }
    }
  },
  websocket: {
    jobUpdates: {
      channel: 'job_updates',
      event: 'job_update',
      requiresAuth: true
    },
    applicationStatus: {
      channel: 'application_status',
      event: 'application_status_change',
      requiresAuth: true
    },
    interviewSchedule: {
      channel: 'interview_schedule',
      event: 'interview_scheduled',
      requiresAuth: true
    },
    candidateStatus: {
      channel: 'candidate_status',
      event: 'candidate_status_change',
      requiresAuth: true
    }
  }
} as const;

/**
 * Creates an enhanced axios request configuration with authentication and rate limiting
 * @param token - Optional authentication token
 * @param config - Additional axios request configuration
 * @returns Complete axios request configuration
 */
export function createApiConfig(
  token?: string,
  config: AxiosRequestConfig = {}
): AxiosRequestConfig {
  // Merge default headers with provided config
  const headers = {
    ...DEFAULT_HEADERS,
    ...config.headers,
    'X-Supabase-Key': SUPABASE_ANON_KEY
  };

  // Add authorization header if token is provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Apply rate limiting headers based on configuration
  headers['X-RateLimit-Limit'] = RATE_LIMIT_CONFIG.maxRequests.toString();
  headers['X-RateLimit-Window'] = RATE_LIMIT_CONFIG.perMinute ? '60' : '3600';

  return {
    ...config,
    baseURL: SUPABASE_URL,
    timeout: REQUEST_TIMEOUT,
    headers,
    validateStatus: (status: number) => status >= 200 && status < 500
  };
}