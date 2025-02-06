import { z } from 'zod'; // ^3.22.0
import { createClient } from '@supabase/supabase-js'; // ^2.33.0
import { 
  MetricsData, 
  MetricDimension, 
  AnalyticsFilters,
  metricsDataSchema,
  analyticsFiltersSchema 
} from '../../types/analytics';
import { databaseConfig } from '../../config/database';
import { handleError } from '../../utils/error-handler';

// Redis cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'metrics:';

// Request validation schema
const metricsRequestSchema = z.object({
  filters: analyticsFiltersSchema,
  refresh_cache: z.boolean().optional().default(false)
});

// Metric calculation queries
const METRIC_QUERIES = {
  time_to_hire: `
    WITH hire_times AS (
      SELECT 
        j.department,
        j.job_type,
        j.location,
        EXTRACT(EPOCH FROM (h.hired_at - a.applied_at))/86400 as days_to_hire
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      JOIN hires h ON a.id = h.application_id
      WHERE a.applied_at BETWEEN $1 AND $2
    )
    SELECT 
      $3::text as metric_name,
      AVG(days_to_hire) as value,
      $4::text as dimension,
      NOW() as timestamp
    FROM hire_times
    GROUP BY 
      CASE 
        WHEN $4 = 'DEPARTMENT' THEN department
        WHEN $4 = 'JOB_TYPE' THEN job_type
        WHEN $4 = 'LOCATION' THEN location
      END
  `,
  
  conversion_rate: `
    WITH conversion_stats AS (
      SELECT 
        j.department,
        j.job_type,
        j.location,
        COUNT(h.id)::float / COUNT(a.id)::float as conversion
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      LEFT JOIN hires h ON a.id = h.application_id
      WHERE a.applied_at BETWEEN $1 AND $2
      GROUP BY j.department, j.job_type, j.location
    )
    SELECT 
      $3::text as metric_name,
      AVG(conversion) * 100 as value,
      $4::text as dimension,
      NOW() as timestamp
    FROM conversion_stats
    GROUP BY 
      CASE 
        WHEN $4 = 'DEPARTMENT' THEN department
        WHEN $4 = 'JOB_TYPE' THEN job_type
        WHEN $4 = 'LOCATION' THEN location
      END
  `
};

/**
 * Validates analytics filter parameters
 */
async function validateFilters(filters: unknown): Promise<AnalyticsFilters> {
  try {
    const validated = await analyticsFiltersSchema.parseAsync(filters);
    
    // Additional business rule validations
    if (validated.end_date < validated.start_date) {
      throw new Error('End date must be after start date');
    }
    
    // Limit date range to 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (validated.start_date < oneYearAgo) {
      throw new Error('Date range cannot exceed 1 year');
    }
    
    return validated;
  } catch (error) {
    throw handleError(error, { context: 'validateFilters' });
  }
}

/**
 * Calculates recruitment metrics using optimized queries
 */
async function calculateMetrics(filters: AnalyticsFilters): Promise<MetricsData[]> {
  try {
    const pool = await databaseConfig.getPool();
    const metrics: MetricsData[] = [];
    
    // Execute metric calculations in parallel
    const metricPromises = filters.dimensions.flatMap(dimension => 
      Object.entries(METRIC_QUERIES).map(async ([metricName, query]) => {
        const result = await pool.query(query, [
          filters.start_date,
          filters.end_date,
          metricName,
          dimension
        ]);
        
        return result.rows.map(row => ({
          metric_name: row.metric_name,
          value: Number(row.value),
          dimension: row.dimension as MetricDimension,
          timestamp: row.timestamp
        }));
      })
    );
    
    const results = await Promise.all(metricPromises);
    return results.flat().filter(metric => metric.value != null);
    
  } catch (error) {
    throw handleError(error, { context: 'calculateMetrics' });
  }
}

/**
 * Edge function handler for retrieving analytics metrics
 */
export async function getMetrics(req: Request): Promise<Response> {
  try {
    const startTime = Date.now();
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    
    // Validate request body
    const { data, error } = await supabase
      .from('requests')
      .select('body')
      .single();
      
    if (error) throw error;
    
    const { filters, refresh_cache } = await metricsRequestSchema.parseAsync(data.body);
    
    // Check cache if refresh not requested
    if (!refresh_cache) {
      const cacheKey = `${CACHE_PREFIX}${JSON.stringify(filters)}`;
      const { data: cachedData } = await supabase
        .from('cache')
        .select('value')
        .eq('key', cacheKey)
        .single();
        
      if (cachedData) {
        return new Response(JSON.stringify({
          success: true,
          data: cachedData.value,
          metadata: {
            cached: true,
            executionTime: Date.now() - startTime
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Calculate metrics
    const validatedFilters = await validateFilters(filters);
    const metrics = await calculateMetrics(validatedFilters);
    
    // Validate metrics data
    const validatedMetrics = await Promise.all(
      metrics.map(metric => metricsDataSchema.parseAsync(metric))
    );
    
    // Cache results
    const cacheKey = `${CACHE_PREFIX}${JSON.stringify(filters)}`;
    await supabase
      .from('cache')
      .upsert({
        key: cacheKey,
        value: validatedMetrics,
        expires_at: new Date(Date.now() + CACHE_TTL * 1000)
      });
    
    return new Response(JSON.stringify({
      success: true,
      data: validatedMetrics,
      metadata: {
        cached: false,
        executionTime: Date.now() - startTime
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    const errorResponse = handleError(error, { context: 'getMetrics' });
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}