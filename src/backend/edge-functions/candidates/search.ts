import { createClient } from '@supabase/supabase-js'; // ^2.0.0
import { z } from 'zod'; // ^3.22.0
import { rateLimit } from '../../utils/rate-limit';
import { CandidateSearchParams, CandidateStatus } from '../../types/candidates';
import { PaginatedResponse } from '../../types/common';
import { MatchingService } from '../../services/ai/matching';
import { aiConfig } from '../../config/ai';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// Initialize matching service
const matchingService = new MatchingService(
  supabase,
  aiConfig.matching
);

// Enhanced search parameters validation schema
const searchParamsSchema = z.object({
  query: z.string().optional(),
  status: z.array(z.nativeEnum(CandidateStatus)).optional(),
  skills: z.array(z.string()).optional(),
  experienceLevel: z.array(z.string()).optional(),
  location: z.string().optional(),
  salaryRange: z.object({
    min: z.number().min(0),
    max: z.number().min(0)
  }).optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(100).default(20),
  jobId: z.string().uuid().optional(),
  sortBy: z.enum(['relevance', 'experience', 'lastActive']).default('relevance')
});

/**
 * Builds an optimized SQL query for candidate search with comprehensive filters
 */
function buildSearchQuery(params: CandidateSearchParams): string {
  let query = `
    SELECT 
      c.*,
      ts_rank_cd(to_tsvector('english', 
        coalesce(c.full_name, '') || ' ' || 
        coalesce(c.skills::text, '') || ' ' || 
        coalesce(c.experience::text, '')
      ), plainto_tsquery('english', $1)) as search_rank
    FROM candidates c
    WHERE 1=1
  `;

  const conditions: string[] = [];
  const values: any[] = [params.query || ''];

  // Status filter
  if (params.status?.length) {
    conditions.push(`c.status = ANY($${values.length + 1})`);
    values.push(params.status);
  }

  // Skills filter with array intersection
  if (params.skills?.length) {
    conditions.push(`c.skills && $${values.length + 1}`);
    values.push(params.skills);
  }

  // Experience level filter
  if (params.experienceLevel?.length) {
    conditions.push(`c.experience_level = ANY($${values.length + 1})`);
    values.push(params.experienceLevel);
  }

  // Location filter with geographic consideration
  if (params.location) {
    conditions.push(`
      c.location ILIKE $${values.length + 1} OR 
      c.preferences->>'preferred_locations' ? $${values.length + 1}
    `);
    values.push(`%${params.location}%`);
  }

  // Salary range filter
  if (params.salaryRange) {
    conditions.push(`
      c.preferences->>'salary_expectation_min' <= $${values.length + 1} AND
      c.preferences->>'salary_expectation_max' >= $${values.length + 2}
    `);
    values.push(params.salaryRange.max, params.salaryRange.min);
  }

  // Add conditions to base query
  if (conditions.length) {
    query += ' AND ' + conditions.join(' AND ');
  }

  return { query, values };
}

/**
 * Enhanced edge function handler for searching candidates with AI matching
 */
export async function searchCandidates(request: Request): Promise<Response> {
  try {
    // Parse and validate request parameters
    const { searchParams } = new URL(request.url);
    const params = searchParamsSchema.parse(Object.fromEntries(searchParams));

    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, {
      max: 100,
      windowMs: 60000,
      keyGenerator: (req) => req.headers.get('x-client-id') || req.ip
    });

    if (!rateLimitResult.success) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter
      }), {
        status: 429,
        headers: { 'Retry-After': String(rateLimitResult.retryAfter) }
      });
    }

    // Build and execute search query
    const { query, values } = buildSearchQuery(params);
    const { data: candidates, count } = await supabase
      .from('candidates')
      .select('*', { count: 'exact' })
      .rpc('search_candidates', {
        search_query: query,
        search_values: values,
        page_number: params.page,
        page_size: params.pageSize
      });

    // Apply AI matching if job context is provided
    let matchedCandidates = candidates;
    if (params.jobId) {
      const { data: job } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', params.jobId)
        .single();

      if (job) {
        matchedCandidates = await matchingService.findMatchingCandidates(
          job,
          candidates,
          {
            threshold: aiConfig.matching.similarityThreshold,
            weightings: aiConfig.matching.weightings
          }
        );
      }
    }

    // Prepare paginated response
    const response: PaginatedResponse<typeof matchedCandidates[0]> = {
      data: matchedCandidates,
      total: count,
      page: params.page,
      pageSize: params.pageSize
    };

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300'
      }
    });

  } catch (error) {
    console.error('Candidate search error:', error);

    return new Response(JSON.stringify({
      error: error instanceof z.ZodError 
        ? 'Invalid search parameters'
        : 'Internal server error',
      details: error instanceof z.ZodError ? error.errors : undefined
    }), {
      status: error instanceof z.ZodError ? 400 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}