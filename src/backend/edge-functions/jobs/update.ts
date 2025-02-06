import { z } from 'zod'; // ^3.22.0
import { rateLimit } from '@upstash/ratelimit'; // ^1.0.0
import sanitizeHtml from 'sanitize-html'; // ^2.11.0

import { Job, JobUpdatePayload, jobUpdatePayloadSchema } from '../../types/jobs';
import { validateInput } from '../../utils/validation';
import { AppError } from '../../utils/error-handler';
import { databaseConfig } from '../../config/database';
import { logger } from '../../utils/logger';
import { ErrorCode, UUID } from '../../types/common';

// Rate limiting configuration
const rateLimiter = rateLimit({
  requests: 100,
  duration: '1m'
});

// HTML sanitization options
const sanitizeOptions = {
  allowedTags: ['p', 'b', 'i', 'em', 'strong', 'ul', 'li', 'br'],
  allowedAttributes: {},
  disallowedTagsMode: 'discard'
};

// Request schema for job update
const updateJobRequestSchema = z.object({
  jobId: z.string().uuid(),
  payload: jobUpdatePayloadSchema
});

/**
 * Validates and sanitizes job update payload
 */
async function validateJobUpdate(data: unknown): Promise<{
  jobId: UUID;
  payload: JobUpdatePayload;
}> {
  const validated = await validateInput(updateJobRequestSchema, data);

  // Sanitize text content
  if (validated.payload.description) {
    validated.payload.description = sanitizeHtml(
      validated.payload.description,
      sanitizeOptions
    );
  }

  if (validated.payload.requirements?.responsibilities) {
    validated.payload.requirements.responsibilities = 
      validated.payload.requirements.responsibilities.map(r => 
        sanitizeHtml(r, sanitizeOptions)
      );
  }

  return validated;
}

/**
 * Edge function handler for updating job postings
 */
export async function updateJob(req: Request): Promise<Response> {
  const correlationId = crypto.randomUUID();
  
  try {
    // Rate limiting check
    const { success } = await rateLimiter.limit(req.headers.get('x-forwarded-for') || 'anonymous');
    if (!success) {
      throw new AppError('Rate limit exceeded', ErrorCode.FORBIDDEN, {
        retryAfter: '60 seconds'
      });
    }

    // Extract and validate JWT token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Missing or invalid authorization', ErrorCode.UNAUTHORIZED);
    }

    // Parse request body
    const requestData = await req.json();
    const { jobId, payload } = await validateJobUpdate(requestData);

    logger.info('Processing job update request', {
      correlationId,
      jobId,
      userId: req.headers.get('x-user-id')
    });

    // Get database connection
    const pool = await databaseConfig.getPool();

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if job exists and user has permission
      const { rows: [job] } = await client.query(
        `SELECT * FROM jobs WHERE id = $1 AND creator_id = $2`,
        [jobId, req.headers.get('x-user-id')]
      );

      if (!job) {
        throw new AppError('Job not found or access denied', ErrorCode.NOT_FOUND);
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [jobId];
      let paramCount = 2;

      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined) {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      });

      // Add updated_at timestamp
      updates.push('updated_at = NOW()');

      // Execute update
      const { rows: [updatedJob] } = await client.query<Job>(
        `UPDATE jobs 
         SET ${updates.join(', ')} 
         WHERE id = $1 
         RETURNING *`,
        values
      );

      // Record audit log
      await client.query(
        `INSERT INTO audit_logs (
          entity_type,
          entity_id,
          action,
          user_id,
          changes,
          correlation_id
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'job',
          jobId,
          'update',
          req.headers.get('x-user-id'),
          JSON.stringify(payload),
          correlationId
        ]
      );

      await client.query('COMMIT');

      logger.info('Job updated successfully', {
        correlationId,
        jobId,
        userId: req.headers.get('x-user-id')
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: updatedJob,
          error: null
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId
          }
        }
      );

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error(error as Error, {
      correlationId,
      context: 'updateJob'
    });

    const statusCode = error instanceof AppError ? 
      (error.code === ErrorCode.NOT_FOUND ? 404 :
       error.code === ErrorCode.UNAUTHORIZED ? 401 :
       error.code === ErrorCode.FORBIDDEN ? 403 : 400) : 500;

    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: error instanceof AppError ? {
          code: error.code,
          message: error.message,
          details: error.details
        } : {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
          details: null
        }
      }),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': correlationId
        }
      }
    );
  }
}