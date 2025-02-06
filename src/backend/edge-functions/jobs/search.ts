import { z } from 'zod'; // ^3.22.0
import Redis from 'ioredis'; // ^5.3.0
import { Job, JobStatus, JobType, ExperienceLevel } from '../../types/jobs';
import { validateInput, sanitizeInput } from '../../utils/validation';
import { databaseConfig } from '../../config/database';
import { PaginatedResponse, createPaginatedResponse } from '../../types/common';
import { AppError } from '../../utils/error-handler';
import { logger } from '../../utils/logger';

// Cache configuration
const CACHE_TTL = 900; // 15 minutes in seconds
const redis = new Redis(process.env.REDIS_URL as string);

// Search parameters schema with comprehensive validation
const searchParamsSchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  status: z.array(z.nativeEnum(JobStatus)).optional(),
  type: z.array(z.nativeEnum(JobType)).optional(),
  skills: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  experience_level: z.array(z.nativeEnum(ExperienceLevel)).optional(),
  location: z.string().trim().min(1).max(100).optional(),
  remote_only: z.boolean().optional(),
  salary_min: z.number().min(0).max(1000000).optional(),
  salary_max: z.number().min(0).max(1000000).optional(),
  page: z.number().min(1).max(1000).default(1),
  limit: z.number().min(1).max(100).default(20)
});

/**
 * Generates a unique cache key for search parameters
 */
function getCacheKey(params: z.infer<typeof searchParamsSchema>): string {
  const normalizedParams = {
    ...params,
    skills: params.skills?.sort(),
    status: params.status?.sort(),
    type: params.type?.sort()
  };
  return `job_search:${JSON.stringify(normalizedParams)}`;
}

/**
 * Builds an optimized SQL query for job search with security measures
 */
function buildSearchQuery(params: z.infer<typeof searchParamsSchema>): {
  text: string;
  values: any[];
} {
  const values: any[] = [];
  const conditions: string[] = ['status = \'PUBLISHED\''];
  let paramIndex = 1;

  // Full-text search with weighted columns
  if (params.query) {
    const sanitizedQuery = sanitizeInput(params.query);
    values.push(sanitizedQuery);
    conditions.push(`
      (to_tsvector('english', title) || 
       to_tsvector('english', description) || 
       to_tsvector('english', array_to_string(skills, ' '))) @@ plainto_tsquery('english', $${paramIndex++})
    `);
  }

  // Status filter
  if (params.status?.length) {
    values.push(params.status);
    conditions.push(`status = ANY($${paramIndex++})`);
  }

  // Job type filter
  if (params.type?.length) {
    values.push(params.type);
    conditions.push(`type = ANY($${paramIndex++})`);
  }

  // Skills filter
  if (params.skills?.length) {
    values.push(params.skills);
    conditions.push(`skills && $${paramIndex++}`);
  }

  // Experience level filter
  if (params.experience_level?.length) {
    values.push(params.experience_level);
    conditions.push(`requirements->>'experience_level' = ANY($${paramIndex++})`);
  }

  // Location filter
  if (params.location) {
    const sanitizedLocation = sanitizeInput(params.location);
    values.push(`%${sanitizedLocation}%`);
    conditions.push(`location ILIKE $${paramIndex++}`);
  }

  // Remote filter
  if (params.remote_only) {
    conditions.push('remote_allowed = true');
  }

  // Salary range filter
  if (params.salary_min !== undefined) {
    values.push(params.salary_min);
    conditions.push(`salary_max >= $${paramIndex++}`);
  }
  if (params.salary_max !== undefined) {
    values.push(params.salary_max);
    conditions.push(`salary_min <= $${paramIndex++}`);
  }

  // Calculate pagination offset
  const offset = (params.page - 1) * params.limit;
  values.push(params.limit, offset);

  const query = `
    WITH job_search AS (
      SELECT *,
        ts_rank(
          setweight(to_tsvector('english', title), 'A') ||
          setweight(to_tsvector('english', description), 'B') ||
          setweight(to_tsvector('english', array_to_string(skills, ' ')), 'C'),
          plainto_tsquery('english', $1)
        ) as rank
      FROM jobs
      WHERE ${conditions.join(' AND ')}
      ORDER BY 
        CASE WHEN $1 IS NOT NULL THEN rank ELSE posted_at END DESC,
        posted_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    )
    SELECT 
      (SELECT COUNT(*) FROM jobs WHERE ${conditions.join(' AND ')}) as total_count,
      (SELECT json_agg(j.*) FROM job_search j) as jobs
  `;

  return { text: query, values };
}

/**
 * Edge function handler for job search with comprehensive security and caching
 */
export async function searchJobs(req: Request): Promise<Response> {
  try {
    // Validate and sanitize input parameters
    const params = await validateInput(searchParamsSchema, await req.json());
    const cacheKey = getCacheKey(params);

    // Check cache first
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for job search', { cacheKey });
      return new Response(cachedResult, {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get database pool with timeout
    const pool = await databaseConfig.getPool();
    const query = buildSearchQuery(params);

    // Execute query with timeout
    const result = await pool.query(query.text, query.values);
    const { total_count, jobs } = result.rows[0];

    // Create paginated response
    const response: PaginatedResponse<Job> = createPaginatedResponse(
      jobs || [],
      Number(total_count),
      params
    );

    // Cache the results
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('Job search error', { error });

    if (error instanceof AppError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}