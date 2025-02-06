import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import { z } from 'zod'; // ^3.22.0
import { HotlistSearchParams } from '../../../types/hotlists';
import { handleError } from '../../../utils/error-handler';
import { hotlistSchema } from '../../../db/schemas/hotlists';
import { logger } from '../../../utils/logger';

// Cache TTL in seconds
const CACHE_TTL = 900; // 15 minutes
const MAX_RETRIES = 3;

// Enhanced search parameters schema with strict validation
const searchParamsSchema = z.object({
  query: z.string().optional().transform(x => x?.trim()),
  visibility: z.array(z.enum(['PRIVATE', 'TEAM', 'PUBLIC'])).optional().default(['PUBLIC']),
  tags: z.array(z.string()).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  orderBy: z.enum(['created_at', 'updated_at', 'name']).optional().default('updated_at'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('desc')
});

/**
 * Edge function handler for listing hotlists with advanced filtering and security
 * @param req - Request object containing search parameters and user context
 * @returns Promise<Response> - JSON response with paginated hotlists and metadata
 */
export const listHotlists = async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  let retryCount = 0;

  try {
    // Initialize Supabase client with connection pooling
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        db: {
          schema: 'public'
        }
      }
    );

    // Extract and validate user context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify(handleError(new Error('Unauthorized'), { context: 'listHotlists' })),
        { status: 401 }
      );
    }

    // Parse and validate search parameters
    const url = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams);
    const params = searchParamsSchema.parse({
      ...rawParams,
      page: Number(rawParams.page),
      limit: Number(rawParams.limit)
    });

    // Generate cache key based on parameters and user context
    const cacheKey = `hotlists:${JSON.stringify(params)}:${authHeader}`;

    // Check cache first
    const { data: cachedData } = await supabase
      .from('cache')
      .select('data')
      .eq('key', cacheKey)
      .single();

    if (cachedData) {
      logger.info('Cache hit for hotlists query', { cacheKey });
      return new Response(JSON.stringify({
        ...cachedData.data,
        fromCache: true
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build base query with security filters
    const query = supabase
      .from('hotlists')
      .select('*', { count: 'exact' })
      .eq('is_archived', false);

    // Apply visibility filters
    if (params.visibility) {
      query.in('visibility', params.visibility);
    }

    // Apply text search if query provided
    if (params.query) {
      query.or(`name.ilike.%${params.query}%,description.ilike.%${params.query}%`);
    }

    // Apply tag filtering
    if (params.tags?.length) {
      query.contains('tags', params.tags);
    }

    // Apply pagination and ordering
    const from = (params.page - 1) * params.limit;
    const to = from + params.limit - 1;

    query
      .order(params.orderBy, { ascending: params.orderDirection === 'asc' })
      .range(from, to);

    // Execute query with retry logic
    let result;
    while (retryCount < MAX_RETRIES) {
      try {
        result = await query;
        break;
      } catch (error) {
        retryCount++;
        if (retryCount === MAX_RETRIES) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    if (result.error) {
      throw result.error;
    }

    // Validate response data
    const validatedData = result.data.map(hotlist => hotlistSchema.parse(hotlist));

    // Prepare response with pagination metadata
    const response = {
      data: validatedData,
      pagination: {
        total: result.count || 0,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil((result.count || 0) / params.limit)
      },
      metadata: {
        executionTime: Date.now() - startTime,
        fromCache: false,
        retryCount
      }
    };

    // Cache successful response
    await supabase
      .from('cache')
      .upsert({
        key: cacheKey,
        data: response,
        expires_at: new Date(Date.now() + CACHE_TTL * 1000)
      })
      .select();

    logger.info('Successfully retrieved hotlists', {
      count: validatedData.length,
      executionTime: Date.now() - startTime
    });

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${CACHE_TTL}`
      }
    });

  } catch (error) {
    logger.error('Error in listHotlists', {
      error,
      params: req.url,
      executionTime: Date.now() - startTime
    });

    return new Response(
      JSON.stringify(handleError(error, {
        context: 'listHotlists',
        retryCount,
        executionTime: Date.now() - startTime
      })),
      {
        status: error instanceof z.ZodError ? 400 : 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export default listHotlists;