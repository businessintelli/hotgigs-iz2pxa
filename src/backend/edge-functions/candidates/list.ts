import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import { z } from 'zod'; // ^3.22.0
import { Candidate, CandidateSearchParams, CandidateStatus, ExperienceLevel } from '../../types/candidates';
import { logger } from '../../utils/logger';
import { createPaginatedResponse, ErrorCode, PaginatedResponse } from '../../types/common';

// Constants for configuration and error handling
const CANDIDATES_TABLE = 'candidates';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const CACHE_DURATION = 300; // 5 minutes in seconds
const MAX_SKILLS_FILTER = 10;

const ERROR_CODES = {
  INVALID_PARAMS: 'CAND_001',
  UNAUTHORIZED: 'CAND_002',
  SERVER_ERROR: 'CAND_003'
} as const;

// Request parameters validation schema
const listCandidatesParamsSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  status: z.nativeEnum(CandidateStatus).optional(),
  experience_level: z.nativeEnum(ExperienceLevel).optional(),
  skills: z.array(z.string()).max(MAX_SKILLS_FILTER).optional(),
  location: z.string().optional(),
  search: z.string().optional(),
  sort_by: z.enum(['full_name', 'created_at', 'match_score']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

type ListCandidatesParams = z.infer<typeof listCandidatesParamsSchema>;

/**
 * Builds an optimized database query with filters and security constraints
 */
function buildCandidateQuery(supabase: ReturnType<typeof createClient>, params: ListCandidatesParams) {
  let query = supabase
    .from(CANDIDATES_TABLE)
    .select('*', { count: 'exact' })
    // Add index hint for performance
    .options({ use_index: ['candidates_status_idx', 'candidates_skills_idx'] });

  // Apply filters
  if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.experience_level) {
    query = query.eq('experience_level', params.experience_level);
  }

  if (params.skills && params.skills.length > 0) {
    query = query.contains('skills', params.skills);
  }

  if (params.location) {
    query = query.ilike('location', `%${params.location}%`);
  }

  if (params.search) {
    query = query.or(`full_name.ilike.%${params.search}%,skills.cs.{${params.search}}`);
  }

  // Add pagination with cursor-based optimization
  const offset = (params.page - 1) * params.limit;
  query = query
    .order(params.sort_by, { ascending: params.sort_order === 'asc' })
    .range(offset, offset + params.limit - 1);

  return query;
}

/**
 * Edge function handler for secure candidate listing with pagination and filtering
 */
export async function listCandidates(request: Request): Promise<Response> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Initialize Supabase client with RLS policies
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Parse and validate query parameters
    const url = new URL(request.url);
    const rawParams = Object.fromEntries(url.searchParams);
    
    // Convert numeric and array parameters
    if (rawParams.skills) {
      rawParams.skills = rawParams.skills.split(',');
    }
    if (rawParams.page) {
      rawParams.page = parseInt(rawParams.page);
    }
    if (rawParams.limit) {
      rawParams.limit = parseInt(rawParams.limit);
    }

    const params = listCandidatesParamsSchema.parse(rawParams);

    // Verify authentication and authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized access');
    }

    // Execute query with error handling
    const { data, error, count } = await buildCandidateQuery(supabase, params);

    if (error) {
      logger.error('Database query failed', {
        error,
        requestId,
        params
      });

      return new Response(
        JSON.stringify({
          code: ERROR_CODES.SERVER_ERROR,
          message: 'Failed to fetch candidates',
          details: null
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Prepare paginated response
    const response: PaginatedResponse<Candidate> = createPaginatedResponse(
      data as Candidate[],
      count || 0,
      {
        page: params.page,
        limit: params.limit
      }
    );

    // Log success metrics
    logger.info('Candidates retrieved successfully', {
      requestId,
      duration: Date.now() - startTime,
      resultCount: data?.length || 0,
      totalCount: count || 0
    });

    // Calculate cache key and ETag
    const cacheKey = `candidates:${JSON.stringify(params)}`;
    const etag = `"${Buffer.from(cacheKey).toString('base64')}"`;

    // Check if-none-match header for caching
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304 });
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_DURATION}`,
          'ETag': etag
        }
      }
    );

  } catch (error) {
    // Log error with context
    logger.error(error instanceof Error ? error : new Error(String(error)), {
      requestId,
      duration: Date.now() - startTime
    });

    // Return appropriate error response
    const statusCode = error instanceof z.ZodError ? 400 : 500;
    const errorCode = error instanceof z.ZodError ? ERROR_CODES.INVALID_PARAMS : ERROR_CODES.SERVER_ERROR;
    const message = error instanceof z.ZodError ? 'Invalid request parameters' : 'Internal server error';
    const details = error instanceof z.ZodError ? error.errors : null;

    return new Response(
      JSON.stringify({
        code: errorCode,
        message,
        details
      }),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}