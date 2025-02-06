import { OpenAI } from 'openai'; // ^4.0.0
import Redis from 'ioredis'; // ^5.0.0
import { z } from 'zod'; // ^3.22.0

import { MatchingService } from '../../../services/ai/matching';
import { handleError } from '../../../utils/error-handler';
import { Candidate } from '../../../types/candidates';
import { aiConfig } from '../../../config/ai';
import { logger } from '../../../utils/logger';
import { ErrorCode } from '../../../types/common';

// Request validation schemas
const matchCandidateToJobsRequestSchema = z.object({
  candidateId: z.string().uuid(),
  filters: z.object({
    threshold: z.number().min(0).max(1).optional(),
    maxResults: z.number().positive().optional(),
    requiredSkills: z.array(z.string()).optional(),
    weightings: z.object({
      skills: z.number(),
      experience: z.number(),
      education: z.number(),
      description: z.number()
    }).optional()
  }).optional()
});

const matchJobToCandidatesRequestSchema = z.object({
  jobId: z.string().uuid(),
  filters: z.object({
    threshold: z.number().min(0).max(1).optional(),
    maxResults: z.number().positive().optional(),
    requiredSkills: z.array(z.string()).optional(),
    weightings: z.object({
      skills: z.number(),
      experience: z.number(),
      education: z.number(),
      description: z.number()
    }).optional()
  }).optional()
});

// Initialize services
const openai = new OpenAI({
  apiKey: aiConfig.openai.apiKey,
  organization: aiConfig.openai.organization
});

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

const matchingService = new MatchingService(
  openai,
  redis,
  logger,
  aiConfig.matching
);

/**
 * Edge function to match a candidate with suitable job openings
 */
export async function matchCandidateToJobs(req: Request): Promise<Response> {
  const correlationId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Parse and validate request
    const { candidateId, filters } = matchCandidateToJobsRequestSchema.parse(
      await req.json()
    );

    // Check cache first
    const cacheKey = `candidate_matches:${candidateId}:${JSON.stringify(filters)}`;
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
      logger.info('Returning cached match results', { correlationId, candidateId });
      return new Response(cachedResult, {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find matching jobs
    const matches = await matchingService.findMatchingJobs(candidateId, {
      threshold: filters?.threshold || aiConfig.matching.similarityThreshold,
      maxResults: filters?.maxResults || aiConfig.matching.maxResults,
      requiredSkills: filters?.requiredSkills,
      weightings: filters?.weightings || aiConfig.matching.weightings
    });

    // Calculate match quality metrics
    const matchQualityMetrics = {
      averageScore: matches.reduce((sum, m) => sum + m.score, 0) / matches.length,
      skillMatchRate: matches.reduce((sum, m) => sum + m.skillMatch, 0) / matches.length,
      confidenceScore: matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length
    };

    const response = {
      success: true,
      data: {
        matches,
        metrics: matchQualityMetrics,
        timestamp: new Date().toISOString()
      }
    };

    // Cache results
    await redis.setex(
      cacheKey,
      aiConfig.matching.cacheTimeout,
      JSON.stringify(response)
    );

    // Log match quality metrics
    logger.info('Match operation completed', {
      correlationId,
      candidateId,
      matchCount: matches.length,
      metrics: matchQualityMetrics
    });

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(
      JSON.stringify(handleError(error, { correlationId })),
      {
        status: error.code === ErrorCode.VALIDATION_ERROR ? 400 : 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Edge function to find matching candidates for a job posting
 */
export async function matchJobToCandidates(req: Request): Promise<Response> {
  const correlationId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Parse and validate request
    const { jobId, filters } = matchJobToCandidatesRequestSchema.parse(
      await req.json()
    );

    // Check cache first
    const cacheKey = `job_matches:${jobId}:${JSON.stringify(filters)}`;
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
      logger.info('Returning cached match results', { correlationId, jobId });
      return new Response(cachedResult, {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find matching candidates
    const matches = await matchingService.findMatchingCandidates(jobId, {
      threshold: filters?.threshold || aiConfig.matching.similarityThreshold,
      maxResults: filters?.maxResults || aiConfig.matching.maxResults,
      requiredSkills: filters?.requiredSkills,
      weightings: filters?.weightings || aiConfig.matching.weightings
    });

    // Calculate match quality metrics
    const matchQualityMetrics = {
      averageScore: matches.reduce((sum, m) => sum + m.score, 0) / matches.length,
      skillMatchRate: matches.reduce((sum, m) => sum + m.skillMatch, 0) / matches.length,
      confidenceScore: matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length
    };

    const response = {
      success: true,
      data: {
        matches,
        metrics: matchQualityMetrics,
        timestamp: new Date().toISOString()
      }
    };

    // Cache results
    await redis.setex(
      cacheKey,
      aiConfig.matching.cacheTimeout,
      JSON.stringify(response)
    );

    // Log match quality metrics
    logger.info('Match operation completed', {
      correlationId,
      jobId,
      matchCount: matches.length,
      metrics: matchQualityMetrics
    });

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(
      JSON.stringify(handleError(error, { correlationId })),
      {
        status: error.code === ErrorCode.VALIDATION_ERROR ? 400 : 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}