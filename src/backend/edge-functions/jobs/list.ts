import { createClient } from '@supabase/supabase-js'; // ^2.33.0
import { z } from 'zod'; // ^3.22.0
import Redis from 'ioredis'; // ^5.3.0
import { Job, JobSearchParams, jobSchema, jobSearchParamsSchema } from '../../types/jobs';
import { databaseConfig } from '../../config/database';
import { createPaginatedResponse, ErrorCode, PaginatedResponse } from '../../types/common';

// Initialize Redis client for caching
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
});

// Cache configuration
const CACHE_TTL = 900; // 15 minutes in seconds
const CACHE_PREFIX = 'jobs:list:';

// Request parameters validation schema
const requestParamsSchema = z.object({
  searchTerm: z.string().optional(),
  status: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  location: z.string().optional(),
  remote_only: z.boolean().optional(),
  salary_min: z.number().min(0).optional(),
  salary_max: z.number().min(0).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
});

/**
 * Builds a secure parameterized SQL query for job listings
 */
function buildJobsQuery(params: z.infer<typeof requestParamsSchema>): {
  query: string;
  values: any[];
} {
  let paramIndex = 1;
  const values: any[] = [];
  let query = `
    SELECT j.*,
           COUNT(*) OVER() as total_count
    FROM jobs j
    WHERE j.status != 'ARCHIVED'
  `;

  // Add search term filter with full-text search
  if (params.searchTerm) {
    query += ` AND (
      to_tsvector('english', j.title || ' ' || j.description) @@ plainto_tsquery($${paramIndex})
      OR j.skills @> ARRAY[$${paramIndex}]::text[]
    )`;
    values.push(params.searchTerm);
    paramIndex++;
  }

  // Add status filter
  if (params.status?.length) {
    query += ` AND j.status = ANY($${paramIndex}::job_status[])`;
    values.push(params.status);
    paramIndex++;
  }

  // Add type filter
  if (params.type?.length) {
    query += ` AND j.type = ANY($${paramIndex}::job_type[])`;
    values.push(params.type);
    paramIndex++;
  }

  // Add skills filter
  if (params.skills?.length) {
    query += ` AND j.skills && $${paramIndex}::text[]`;
    values.push(params.skills);
    paramIndex++;
  }

  // Add location filter
  if (params.location) {
    query += ` AND (
      j.location ILIKE $${paramIndex}
      OR (j.remote_allowed = true AND $${paramIndex + 1}::boolean = true)
    )`;
    values.push(`%${params.location}%`, params.remote_only || false);
    paramIndex += 2;
  }

  // Add salary range filter
  if (params.salary_min !== undefined) {
    query += ` AND j.salary_max >= $${paramIndex}`;
    values.push(params.salary_min);
    paramIndex++;
  }
  if (params.salary_max !== undefined) {
    query += ` AND j.salary_min <= $${paramIndex}`;
    values.push(params.salary_max);
    paramIndex++;
  }

  // Add pagination
  query += `
    ORDER BY j.posted_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  values.push(params.limit, (params.page - 1) * params.limit);

  return { query, values };
}

/**
 * Edge function handler for retrieving paginated job listings
 */
export async function handleJobsList(req: Request): Promise<Response> {
  try {
    // Validate authentication
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
    const { user, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      return new Response(JSON.stringify({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Authentication required',
        details: null
      }), { status: 401 });
    }

    // Parse and validate request parameters
    const params = requestParamsSchema.parse(await req.json());
    
    // Generate cache key
    const cacheKey = `${CACHE_PREFIX}${JSON.stringify(params)}`;

    // Check cache first
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
      return new Response(cachedResult, {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get database connection
    const pool = await databaseConfig.getPool();
    
    // Build and execute query
    const { query, values } = buildJobsQuery(params);
    
    const queryResult = await pool.query({
      text: query,
      values,
      timeout: 5000 // 5 second timeout
    });

    // Transform and validate results
    const jobs = queryResult.rows.map(row => {
      const { total_count, ...jobData } = row;
      return jobSchema.parse(jobData);
    });

    const totalCount = queryResult.rows[0]?.total_count || 0;
    
    // Create paginated response
    const response: PaginatedResponse<Job> = createPaginatedResponse(
      jobs,
      parseInt(totalCount),
      { page: params.page, limit: params.limit }
    );

    // Cache successful response
    const responseJson = JSON.stringify(response);
    await redis.setex(cacheKey, CACHE_TTL, responseJson);

    return new Response(responseJson, {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in handleJobsList:', error);

    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid request parameters',
        details: error.errors
      }), { status: 400 });
    }

    return new Response(JSON.stringify({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
      details: null
    }), { status: 500 });
  }
}