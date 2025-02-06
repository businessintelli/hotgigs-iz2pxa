import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import { z } from 'zod'; // ^3.22.0
import { Interview, InterviewType, InterviewStatus } from '../../types/interviews';
import { PaginationParams } from '../../types/common';
import { handleError } from '../../utils/error-handler';
import { authenticateRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { UserRole } from '../../types/auth';
import { SECURITY_HEADERS, getRateLimitConfig } from '../../config/security';

// Cache duration in seconds
const CACHE_TTL = 300; // 5 minutes

// Rate limit configuration for interview endpoints
const RATE_LIMIT = getRateLimitConfig('jobs').max;

// Validation schema for list interviews query parameters
const ListInterviewsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  status: z.nativeEnum(InterviewStatus).optional(),
  type: z.nativeEnum(InterviewType).optional(),
  candidate_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  sort_by: z.enum(['scheduled_at', 'created_at', 'status']).default('scheduled_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

type ListInterviewsQuery = z.infer<typeof ListInterviewsSchema>;

/**
 * Edge function handler for listing interviews with comprehensive filtering and pagination
 * Implements role-based access control and security measures
 */
export const listInterviews = async (req: Request, context: any): Promise<Response> => {
  const requestId = crypto.randomUUID();
  
  try {
    // Authenticate request
    const user = await authenticateRequest(req, context);
    
    // Parse and validate query parameters
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams);
    const validatedParams = ListInterviewsSchema.parse({
      ...queryParams,
      page: Number(queryParams.page),
      limit: Number(queryParams.limit)
    });

    // Initialize Supabase client with context credentials
    const supabase = createClient(
      context.env.SUPABASE_URL,
      context.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Build base query with security filters
    let query = supabase
      .from('interviews')
      .select(`
        *,
        candidate:candidates(id, full_name, email),
        job:jobs(id, title),
        interviewers:users!interview_interviewers(id, full_name, email)
      `, { count: 'exact' });

    // Apply role-based access control
    switch (user.role) {
      case UserRole.ADMIN:
        // Admins can see all interviews
        break;
      case UserRole.RECRUITER:
        query = query.or(`creator_id.eq.${user.id},interviewers.cs.{${user.id}}`);
        break;
      case UserRole.HIRING_MANAGER:
        query = query.or(`job.department_id.eq.${user.departmentId},interviewers.cs.{${user.id}}`);
        break;
      case UserRole.CANDIDATE:
        query = query.eq('candidate_id', user.id);
        break;
      default:
        throw new Error('Insufficient permissions');
    }

    // Apply filters
    if (validatedParams.status) {
      query = query.eq('status', validatedParams.status);
    }
    if (validatedParams.type) {
      query = query.eq('type', validatedParams.type);
    }
    if (validatedParams.candidate_id) {
      query = query.eq('candidate_id', validatedParams.candidate_id);
    }
    if (validatedParams.job_id) {
      query = query.eq('job_id', validatedParams.job_id);
    }
    if (validatedParams.start_date) {
      query = query.gte('scheduled_at', validatedParams.start_date);
    }
    if (validatedParams.end_date) {
      query = query.lte('scheduled_at', validatedParams.end_date);
    }

    // Apply sorting
    query = query.order(validatedParams.sort_by, {
      ascending: validatedParams.sort_order === 'asc'
    });

    // Apply pagination
    const from = (validatedParams.page - 1) * validatedParams.limit;
    const to = from + validatedParams.limit - 1;
    query = query.range(from, to);

    // Execute query
    const { data: interviews, count, error } = await query;

    if (error) {
      throw error;
    }

    // Format response
    const response = {
      data: interviews,
      pagination: {
        page: validatedParams.page,
        limit: validatedParams.limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / validatedParams.limit)
      }
    };

    // Log successful request
    logger.info('Interviews listed successfully', {
      requestId,
      userId: user.id,
      role: user.role,
      filters: validatedParams
    });

    // Return response with security headers and caching
    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_TTL}`,
        ...SECURITY_HEADERS
      }
    });

  } catch (error) {
    // Handle and log error
    const errorResponse = handleError(error, {
      requestId,
      context: 'listInterviews',
      params: req.url
    });

    return new Response(JSON.stringify(errorResponse), {
      status: errorResponse.error.code === 'UNAUTHORIZED' ? 401 : 500,
      headers: {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS
      }
    });
  }
};