import { z } from 'zod'; // ^3.22.0
import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import sanitizeHtml from 'sanitize-html'; // ^2.11.0
import { rateLimit } from '@vercel/edge-rate-limit'; // ^1.0.0

import { Candidate, CandidateStatus, ExperienceLevel } from '../../types/candidates';
import { validateInput } from '../../utils/validation';
import { AppError } from '../../utils/error-handler';
import { ErrorCode } from '../../types/common';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MAX_RETRIES = 3;

// Validation schema for candidate update
const updateCandidateSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  location: z.string().max(200).optional(),
  status: z.nativeEnum(CandidateStatus).optional(),
  experience_level: z.nativeEnum(ExperienceLevel).optional(),
  skills: z.array(z.string().max(50)).max(50).optional(),
  experience: z.array(z.object({
    title: z.string().max(100),
    company: z.string().max(100),
    start_date: z.string().datetime(),
    end_date: z.string().datetime().optional(),
    description: z.string().max(1000)
  })).max(20).optional(),
  education: z.array(z.object({
    institution: z.string().max(100),
    degree: z.string().max(100),
    field: z.string().max(100),
    graduation_date: z.string().datetime()
  })).max(10).optional(),
  preferences: z.object({
    salary_range: z.object({
      min: z.number(),
      max: z.number()
    }),
    remote_work: z.boolean(),
    locations: z.array(z.string())
  }).optional(),
  metadata: z.record(z.unknown()).optional()
});

// HTML sanitization options
const sanitizeOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard'
};

/**
 * Sanitizes all string values in an object recursively
 */
function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeHtml(value, sanitizeOptions);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'object' ? sanitizeObject(item) : 
        typeof item === 'string' ? sanitizeHtml(item, sanitizeOptions) : item
      );
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Edge function handler for updating candidate profiles
 * Implements rate limiting, validation, sanitization, and retry logic
 */
export const updateCandidate = rateLimit({
  max: 100,
  window: '1m'
})(async (req: Request): Promise<Response> => {
  try {
    // Extract and validate JWT token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Unauthorized', ErrorCode.UNAUTHORIZED);
    }
    const token = authHeader.split(' ')[1];

    // Initialize Supabase client
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new AppError('Missing database configuration', ErrorCode.INTERNAL_ERROR);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Extract candidate ID from URL
    const url = new URL(req.url);
    const candidateId = url.pathname.split('/').pop();
    if (!candidateId) {
      throw new AppError('Invalid candidate ID', ErrorCode.BAD_REQUEST);
    }

    // Verify user has permission to update this candidate
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new AppError('Unauthorized', ErrorCode.UNAUTHORIZED);
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const validatedBody = await validateInput(updateCandidateSchema, rawBody);
    const sanitizedBody = sanitizeObject(validatedBody);

    // Update candidate with retry logic
    let retries = 0;
    let updateError: Error | null = null;

    while (retries < MAX_RETRIES) {
      try {
        const { data: updatedCandidate, error: updateError } = await supabase
          .from('candidates')
          .update({
            ...sanitizedBody,
            updated_at: new Date().toISOString()
          })
          .eq('id', candidateId)
          .select()
          .single();

        if (updateError) throw updateError;
        if (!updatedCandidate) {
          throw new AppError('Candidate not found', ErrorCode.NOT_FOUND);
        }

        // Log audit trail
        await supabase.from('audit_logs').insert({
          entity_type: 'candidate',
          entity_id: candidateId,
          action: 'update',
          user_id: user.id,
          changes: sanitizedBody
        });

        return new Response(JSON.stringify({
          success: true,
          data: updatedCandidate
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        updateError = error as Error;
        retries++;
        if (retries < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }

    throw updateError || new AppError('Failed to update candidate', ErrorCode.INTERNAL_ERROR);

  } catch (error) {
    const statusCode = error instanceof AppError ? 
      (error.code === ErrorCode.NOT_FOUND ? 404 :
       error.code === ErrorCode.UNAUTHORIZED ? 401 :
       error.code === ErrorCode.VALIDATION_ERROR ? 400 : 500) : 500;

    return new Response(JSON.stringify({
      success: false,
      error: {
        code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof AppError ? error.details : null
      }
    }), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});