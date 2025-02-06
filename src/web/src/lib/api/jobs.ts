import { supabase } from '../supabase';
import { PostgrestError } from '@supabase/supabase-js'; // ^2.38.0
import { z } from 'zod'; // ^3.22.0
import { retry } from 'retry-ts'; // ^0.1.0
import winston from 'winston'; // ^3.10.0
import { 
  Job, 
  JobFormData, 
  JobSearchParams, 
  jobSchema, 
  jobSearchParamsSchema,
  JobStatus 
} from '../../types/jobs';
import { 
  ErrorCode, 
  PaginatedResponse, 
  createPaginatedResponse 
} from '../../types/common';
import { 
  API_RATE_LIMITS, 
  PAGINATION_DEFAULTS, 
  ERROR_MESSAGES 
} from '../../config/constants';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Custom error class for job operations
export class JobError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'JobError';
  }
}

// Retry configuration for API operations
const retryOptions = {
  maxRetries: 3,
  delayMs: 1000,
  backoffFactor: 2,
};

/**
 * Creates a new job posting with validation and error handling
 * @param jobData - The job data to create
 * @returns Promise resolving to created job or error
 */
export async function createJob(
  jobData: JobFormData
): Promise<{ data: Job | null; error: PostgrestError | JobError | null }> {
  try {
    // Validate job data
    const validatedData = jobSchema.parse({
      ...jobData,
      status: jobData.is_draft ? JobStatus.DRAFT : JobStatus.PUBLISHED,
      posted_at: new Date(),
      creator_id: (await supabase.auth.getUser()).data.user?.id
    });

    // Start transaction
    const { data, error } = await supabase
      .from('jobs')
      .insert(validatedData)
      .select()
      .single();

    if (error) throw error;

    logger.info('Job created successfully', { jobId: data.id });
    return { data, error: null };

  } catch (error) {
    logger.error('Error creating job', { error });
    
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: new JobError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid job data',
          error.errors
        )
      };
    }

    return {
      data: null,
      error: error as PostgrestError
    };
  }
}

/**
 * Searches for jobs with pagination, filtering and caching
 * @param params - Search parameters
 * @returns Promise resolving to paginated job results
 */
export async function searchJobs(
  params: JobSearchParams
): Promise<{
  data: PaginatedResponse<Job>;
  error: PostgrestError | JobError | null;
}> {
  try {
    // Validate search parameters
    const validatedParams = jobSearchParamsSchema.parse(params);

    let query = supabase
      .from('jobs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (validatedParams.query) {
      query = query.textSearch('title', validatedParams.query);
    }

    if (validatedParams.status?.length) {
      query = query.in('status', validatedParams.status);
    }

    if (validatedParams.skills?.length) {
      query = query.contains('skills', validatedParams.skills);
    }

    // Apply pagination
    const { from, to } = getPaginationRange(validatedParams);
    query = query.range(from, to);

    // Execute query with retry logic
    const { data, error, count } = await retry(
      async () => await query,
      retryOptions
    );

    if (error) throw error;

    const paginatedResponse = createPaginatedResponse(
      data || [],
      count || 0,
      {
        page: validatedParams.page || PAGINATION_DEFAULTS.DEFAULT_PAGE_NUMBER,
        limit: validatedParams.limit || PAGINATION_DEFAULTS.PAGE_SIZE
      }
    );

    return { data: paginatedResponse, error: null };

  } catch (error) {
    logger.error('Error searching jobs', { error });
    return {
      data: createPaginatedResponse([], 0, {
        page: PAGINATION_DEFAULTS.DEFAULT_PAGE_NUMBER,
        limit: PAGINATION_DEFAULTS.PAGE_SIZE
      }),
      error: error as PostgrestError | JobError
    };
  }
}

/**
 * Finds matching candidates for a job using AI
 * @param jobId - ID of the job to match candidates for
 * @returns Promise resolving to matched candidates with scores
 */
export async function matchCandidates(
  jobId: string
): Promise<{
  data: { candidates: Array<{ id: string; score: number }>; } | null;
  error: PostgrestError | JobError | null;
}> {
  try {
    // Validate job ID
    if (!z.string().uuid().safeParse(jobId).success) {
      throw new JobError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid job ID format'
      );
    }

    // Check rate limits
    const { data: rateLimit } = await supabase
      .rpc('check_rate_limit', {
        key: `job_matching:${jobId}`,
        limit: API_RATE_LIMITS.JOBS.limit,
        window: API_RATE_LIMITS.JOBS.window
      });

    if (!rateLimit?.allowed) {
      throw new JobError(
        ErrorCode.RATE_LIMITED,
        `Rate limit exceeded. Try again in ${API_RATE_LIMITS.JOBS.retryAfter} seconds`
      );
    }

    // Call matching function
    const { data, error } = await retry(
      async () => await supabase
        .rpc('match_candidates', { job_id: jobId }),
      retryOptions
    );

    if (error) throw error;

    logger.info('Candidate matching completed', {
      jobId,
      matchCount: data?.length || 0
    });

    return {
      data: { candidates: data || [] },
      error: null
    };

  } catch (error) {
    logger.error('Error matching candidates', { error, jobId });
    return {
      data: null,
      error: error as PostgrestError | JobError
    };
  }
}

// Helper function to calculate pagination range
function getPaginationRange(params: JobSearchParams): { from: number; to: number } {
  const page = params.page || PAGINATION_DEFAULTS.DEFAULT_PAGE_NUMBER;
  const limit = Math.min(
    params.limit || PAGINATION_DEFAULTS.PAGE_SIZE,
    PAGINATION_DEFAULTS.MAX_PAGE_SIZE
  );
  
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  
  return { from, to };
}