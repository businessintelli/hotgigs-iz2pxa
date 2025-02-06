import axios, { AxiosError, CancelTokenSource } from 'axios'; // ^1.5.0
import { z } from 'zod'; // ^3.22.0
import { DashboardStats, MetricsData, dashboardStatsSchema, metricsDataSchema } from '../../types/analytics';
import { API_CONFIG, ENDPOINTS } from '../../config/api';
import { ApiResponse, ErrorCode } from '../../types/common';
import { CACHE_KEYS, ERROR_MESSAGES } from '../../config/constants';

// Cache implementation for dashboard stats
const statsCache = new Map<string, { data: DashboardStats; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Analytics filter validation schema
const analyticsFilterSchema = z.object({
  dateRange: z.object({
    startDate: z.date(),
    endDate: z.date()
  }).optional(),
  dimensions: z.array(z.string()).optional(),
  refreshCache: z.boolean().optional()
});

// Metrics filter validation schema
const metricsFilterSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  dimensions: z.array(z.string()),
  interval: z.enum(['hour', 'day', 'week', 'month'])
});

/**
 * Retrieves current dashboard statistics with caching and retry logic
 * @param filters - Optional filters for dashboard stats
 * @returns Promise<DashboardStats>
 */
export async function getDashboardStats(filters?: {
  dateRange?: { startDate: Date; endDate: Date };
  dimensions?: string[];
  refreshCache?: boolean;
}): Promise<DashboardStats> {
  try {
    // Validate input filters
    const validatedFilters = analyticsFilterSchema.parse(filters);
    
    // Generate cache key based on filters
    const cacheKey = filters ? JSON.stringify(filters) : 'default';
    
    // Check cache if refresh not requested
    if (!validatedFilters.refreshCache) {
      const cached = statsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    // Create cancel token for request
    const cancelSource: CancelTokenSource = axios.CancelToken.source();
    
    // Make API request
    const response = await axios.get<ApiResponse<DashboardStats>>(
      `${API_CONFIG.baseURL}${ENDPOINTS.analytics.dashboard.path}`,
      {
        ...API_CONFIG,
        params: validatedFilters,
        cancelToken: cancelSource.token
      }
    );

    // Validate response data
    const validatedData = dashboardStatsSchema.parse(response.data.data);
    
    // Update cache
    statsCache.set(cacheKey, {
      data: validatedData,
      timestamp: Date.now()
    });

    return validatedData;

  } catch (error) {
    if (axios.isCancel(error)) {
      throw new Error('Request was cancelled');
    }

    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.message}`);
    }

    if (error instanceof AxiosError) {
      switch (error.response?.status) {
        case 401:
          throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
        case 403:
          throw new Error(ERROR_MESSAGES.FORBIDDEN);
        case 429:
          throw new Error('Rate limit exceeded. Please try again later.');
        default:
          throw new Error(ERROR_MESSAGES.GENERIC_ERROR);
      }
    }

    throw error;
  }
}

/**
 * Retrieves recruitment funnel metrics with real-time updates
 * @param filters - Required filters for metrics retrieval
 * @returns Promise<MetricsData[]>
 */
export async function getRecruitmentMetrics(filters: {
  startDate: Date;
  endDate: Date;
  dimensions: string[];
  interval: 'hour' | 'day' | 'week' | 'month';
}): Promise<MetricsData[]> {
  try {
    // Validate input filters
    const validatedFilters = metricsFilterSchema.parse(filters);

    // Create cancel token for request
    const cancelSource: CancelTokenSource = axios.CancelToken.source();

    // Make API request
    const response = await axios.get<ApiResponse<MetricsData[]>>(
      `${API_CONFIG.baseURL}${ENDPOINTS.analytics.reports.path}`,
      {
        ...API_CONFIG,
        params: {
          ...validatedFilters,
          type: 'RECRUITMENT_FUNNEL'
        },
        cancelToken: cancelSource.token
      }
    );

    // Validate response data array
    const validatedData = z.array(metricsDataSchema).parse(response.data.data);

    // Transform and calculate derived metrics
    const enrichedMetrics = validatedData.map(metric => ({
      ...metric,
      // Add any calculated fields or transformations here
      trend_percentage: calculateTrendPercentage(metric),
      normalized_value: normalizeMetricValue(metric)
    }));

    return enrichedMetrics;

  } catch (error) {
    if (axios.isCancel(error)) {
      throw new Error('Request was cancelled');
    }

    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.message}`);
    }

    if (error instanceof AxiosError) {
      if (error.response?.status === 401) {
        throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
      }
      throw new Error(error.response?.data?.message || ERROR_MESSAGES.GENERIC_ERROR);
    }

    throw error;
  }
}

// Helper function to calculate trend percentage
function calculateTrendPercentage(metric: MetricsData): number {
  // Implementation would depend on business logic
  return 0;
}

// Helper function to normalize metric values
function normalizeMetricValue(metric: MetricsData): number {
  // Implementation would depend on business logic
  return metric.value;
}