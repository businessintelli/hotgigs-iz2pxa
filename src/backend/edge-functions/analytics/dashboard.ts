import { z } from 'zod'; // ^3.22.0
import { createClient } from '@supabase/supabase-js'; // ^2.33.0
import { Redis } from 'ioredis'; // ^5.3.2
import { monitor } from 'datadog-metrics'; // ^1.0.0
import { compress } from 'compression'; // ^1.7.4

import { 
  DashboardStats, 
  MetricsData,
  analyticsFiltersSchema,
  MetricDimension
} from '../../../types/analytics';
import { handleError } from '../../../utils/error-handler';
import { databaseConfig } from '../../../config/database';
import { logger } from '../../../utils/logger';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const redis = new Redis(process.env.REDIS_URL);

// Monitoring configuration
monitor.init({ 
  host: 'analytics_dashboard',
  prefix: 'hotgigs.analytics.'
});

// Request validation schema
const requestSchema = z.object({
  filters: analyticsFiltersSchema,
  refresh_cache: z.boolean().optional()
});

/**
 * Retrieves cached dashboard data if available
 */
async function getCachedDashboardData(cacheKey: string): Promise<DashboardStats | null> {
  try {
    const cached = await redis.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.warn('Cache retrieval failed', { error });
    return null;
  }
}

/**
 * Generates cache key based on filter parameters
 */
function generateCacheKey(filters: z.infer<typeof analyticsFiltersSchema>): string {
  return `dashboard_stats:${JSON.stringify(filters)}`;
}

/**
 * Retrieves current dashboard statistics with optimized parallel queries
 */
async function getDashboardStats(
  filters: z.infer<typeof analyticsFiltersSchema>
): Promise<DashboardStats> {
  const startTime = Date.now();
  const pool = await databaseConfig.getPool();

  try {
    const [jobsResult, candidatesResult, interviewsResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) as total_jobs
        FROM jobs
        WHERE created_at BETWEEN $1 AND $2
        AND status = 'ACTIVE'
      `, [filters.start_date, filters.end_date]),
      
      pool.query(`
        SELECT COUNT(*) as active_candidates
        FROM candidates
        WHERE status = 'ACTIVE'
        AND last_activity_at > NOW() - INTERVAL '30 days'
      `),
      
      pool.query(`
        SELECT COUNT(*) as scheduled_interviews
        FROM interviews
        WHERE schedule_time BETWEEN $1 AND $2
        AND status = 'SCHEDULED'
      `, [filters.start_date, filters.end_date])
    ]);

    const stats: DashboardStats = {
      total_jobs: parseInt(jobsResult.rows[0].total_jobs),
      active_candidates: parseInt(candidatesResult.rows[0].active_candidates),
      scheduled_interviews: parseInt(interviewsResult.rows[0].scheduled_interviews),
      conversion_rates: await calculateConversionRates(filters),
      time_to_hire: await calculateTimeToHire(filters)
    };

    // Monitor performance
    monitor.increment('dashboard.stats.retrieved');
    monitor.timing('dashboard.stats.duration', Date.now() - startTime);

    return stats;
  } catch (error) {
    logger.error('Failed to retrieve dashboard stats', { error, filters });
    throw error;
  }
}

/**
 * Calculates conversion rates across recruitment funnel
 */
async function calculateConversionRates(
  filters: z.infer<typeof analyticsFiltersSchema>
): Promise<Record<string, number>> {
  const pool = await databaseConfig.getPool();
  
  try {
    const result = await pool.query(`
      WITH funnel AS (
        SELECT
          COUNT(DISTINCT CASE WHEN status = 'APPLIED' THEN id END) as applied,
          COUNT(DISTINCT CASE WHEN status = 'SCREENED' THEN id END) as screened,
          COUNT(DISTINCT CASE WHEN status = 'INTERVIEWED' THEN id END) as interviewed,
          COUNT(DISTINCT CASE WHEN status = 'OFFERED' THEN id END) as offered,
          COUNT(DISTINCT CASE WHEN status = 'HIRED' THEN id END) as hired
        FROM applications
        WHERE created_at BETWEEN $1 AND $2
      )
      SELECT
        ROUND((screened::numeric / NULLIF(applied, 0)) * 100, 2) as screen_rate,
        ROUND((interviewed::numeric / NULLIF(screened, 0)) * 100, 2) as interview_rate,
        ROUND((offered::numeric / NULLIF(interviewed, 0)) * 100, 2) as offer_rate,
        ROUND((hired::numeric / NULLIF(offered, 0)) * 100, 2) as acceptance_rate
      FROM funnel
    `, [filters.start_date, filters.end_date]);

    return result.rows[0];
  } catch (error) {
    logger.error('Failed to calculate conversion rates', { error, filters });
    throw error;
  }
}

/**
 * Calculates average time to hire metrics
 */
async function calculateTimeToHire(
  filters: z.infer<typeof analyticsFiltersSchema>
): Promise<number> {
  const pool = await databaseConfig.getPool();
  
  try {
    const result = await pool.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (hired_at - created_at))/86400)::numeric(10,2) as avg_days
      FROM applications
      WHERE status = 'HIRED'
      AND created_at BETWEEN $1 AND $2
    `, [filters.start_date, filters.end_date]);

    return result.rows[0].avg_days || 0;
  } catch (error) {
    logger.error('Failed to calculate time to hire', { error, filters });
    throw error;
  }
}

/**
 * Edge function handler for dashboard analytics
 */
export async function GET(req: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    const { filters, refresh_cache } = requestSchema.parse(
      await req.json()
    );

    const cacheKey = generateCacheKey(filters);
    
    // Try to get cached data unless refresh is requested
    if (!refresh_cache) {
      const cachedData = await getCachedDashboardData(cacheKey);
      if (cachedData) {
        monitor.increment('dashboard.cache.hit');
        return new Response(JSON.stringify(cachedData), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    monitor.increment('dashboard.cache.miss');
    
    // Get fresh dashboard data
    const dashboardStats = await getDashboardStats(filters);

    // Cache the results
    await redis.setex(
      cacheKey,
      CACHE_TTL,
      JSON.stringify(dashboardStats)
    );

    // Monitor response time
    monitor.timing('dashboard.response.time', Date.now() - startTime);

    return new Response(
      JSON.stringify(dashboardStats),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${CACHE_TTL}`
        }
      }
    );
  } catch (error) {
    const errorResponse = handleError(error, {
      context: 'dashboard_analytics',
      path: '/analytics/dashboard'
    });

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: errorResponse.error?.code === 'VALIDATION_ERROR' ? 400 : 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Export for testing purposes
export { getDashboardStats };