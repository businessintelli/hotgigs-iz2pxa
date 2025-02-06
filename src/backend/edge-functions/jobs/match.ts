import { createClient } from '@supabase/supabase-js'; // ^2.0.0
import { OpenAI } from 'openai'; // ^4.0.0
import Redis from 'ioredis'; // ^5.0.0
import pino from 'pino'; // ^8.0.0

import { Job, JobRequirements } from '../../types/jobs';
import { MatchingService } from '../../services/ai/matching';
import { aiConfig } from '../../config/ai';
import { ErrorCode, ApiResponse } from '../../types/common';
import { CandidateMatch } from '../../types/candidates';

// Constants for configuration
const CACHE_PREFIX = 'job_matches';
const CACHE_TTL = 3600; // 1 hour
const MAX_RETRIES = 3;

// Request validation schema
interface MatchJobRequest {
  jobId: string;
  options?: {
    threshold?: number;
    maxResults?: number;
    requiredSkills?: string[];
    weightings?: {
      skills: number;
      experience: number;
      education: number;
      description: number;
    };
  };
}

/**
 * Edge function handler for job-candidate matching operations
 * Uses AI-powered algorithms to find the best candidate matches for a job posting
 */
export async function matchJobCandidates(req: Request): Promise<Response> {
  const logger = pino({ name: 'job-matching' });
  let supabase, redis, openai, matchingService;

  try {
    // Initialize required clients
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    redis = new Redis(process.env.REDIS_URL!);

    openai = new OpenAI({
      apiKey: aiConfig.openai.apiKey,
      organization: aiConfig.openai.organization,
    });

    matchingService = new MatchingService(openai, redis, logger, aiConfig.matching);

    // Validate request
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: 'Method not allowed',
            details: null,
          },
        }),
        { status: 405 }
      );
    }

    // Parse and validate request body
    const body: MatchJobRequest = await req.json();
    if (!body.jobId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Job ID is required',
            details: null,
          },
        }),
        { status: 400 }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Authentication required',
            details: null,
          },
        }),
        { status: 401 }
      );
    }

    // Check cache first
    const cacheKey = `${CACHE_PREFIX}:${body.jobId}:${JSON.stringify(body.options)}`;
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
      return new Response(cachedResult, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', body.jobId)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: 'Job not found',
            details: null,
          },
        }),
        { status: 404 }
      );
    }

    // Execute matching operation with retries
    let matches: CandidateMatch[] = [];
    let retryCount = 0;
    while (retryCount < MAX_RETRIES) {
      try {
        matches = await matchingService.findMatchingCandidates(job, {
          threshold: body.options?.threshold || aiConfig.matching.similarityThreshold,
          maxResults: body.options?.maxResults || aiConfig.matching.maxResults,
          requiredSkills: body.options?.requiredSkills,
          weightings: body.options?.weightings || aiConfig.matching.weightings,
        });
        break;
      } catch (error) {
        retryCount++;
        if (retryCount === MAX_RETRIES) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    // Prepare response with match results and metadata
    const response: ApiResponse<{
      matches: CandidateMatch[];
      metadata: {
        jobId: string;
        totalMatches: number;
        averageScore: number;
        timestamp: string;
        algorithmVersion: string;
      };
    }> = {
      success: true,
      data: {
        matches,
        metadata: {
          jobId: body.jobId,
          totalMatches: matches.length,
          averageScore: matches.reduce((sum, m) => sum + m.score, 0) / matches.length,
          timestamp: new Date().toISOString(),
          algorithmVersion: aiConfig.version,
        },
      },
      error: null,
    };

    // Cache the results
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));

    // Return the response
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logger.error({ error }, 'Job matching operation failed');

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to process matching request',
          details: process.env.NODE_ENV === 'development' ? error.message : null,
        },
      }),
      { status: 500 }
    );

  } finally {
    // Cleanup connections
    if (redis) {
      await redis.quit();
    }
  }
}

export default matchJobCandidates;