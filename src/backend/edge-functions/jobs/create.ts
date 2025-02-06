import { z } from 'zod'; // ^3.22.0
import { createClient } from '@supabase/supabase-js'; // ^2.33.0
import { rateLimit } from '@supabase/gotrue-js'; // ^2.33.0
import { Job, JobStatus, jobSchema } from '../../types/jobs';
import { validateInput, sanitizeInput } from '../../utils/validation';
import { AppError } from '../../utils/error-handler';
import { ErrorCode } from '../../types/common';
import { databaseConfig } from '../../config/database';
import { logger } from '../../utils/logger';

// Constants for request validation
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB
const RATE_LIMIT_WINDOW = 3600000; // 1 hour in milliseconds
const RATE_LIMIT_MAX = 1000;

// Enhanced Zod schema for job creation with detailed validation
const createJobSchema = jobSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  closed_at: true
}).extend({
  title: z.string()
    .min(1, 'Title is required')
    .max(MAX_TITLE_LENGTH, `Title must not exceed ${MAX_TITLE_LENGTH} characters`)
    .transform(val => sanitizeInput(val)),
  description: z.string()
    .min(1, 'Description is required')
    .max(MAX_DESCRIPTION_LENGTH, `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`)
    .transform(val => sanitizeInput(val)),
  requirements: z.object({
    experience_level: z.enum(['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']),
    years_experience: z.number().min(0).max(50),
    required_skills: z.array(z.string().transform(val => sanitizeInput(val))).min(1),
    preferred_skills: z.array(z.string().transform(val => sanitizeInput(val))),
    qualifications: z.array(z.string().transform(val => sanitizeInput(val))),
    responsibilities: z.array(z.string().transform(val => sanitizeInput(val))).min(1)
  })
});

/**
 * Validates job input data and performs business logic validation
 */
async function validateJobInput(data: unknown): Promise<z.infer<typeof createJobSchema>> {
  try {
    const validatedData = await validateInput(createJobSchema, data);

    // Additional business logic validation
    if (validatedData.salary_min > validatedData.salary_max) {
      throw new AppError(
        'Minimum salary cannot be greater than maximum salary',
        ErrorCode.VALIDATION_ERROR,
        {
          salary_min: validatedData.salary_min,
          salary_max: validatedData.salary_max
        }
      );
    }

    return validatedData;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      'Invalid job data',
      ErrorCode.VALIDATION_ERROR,
      { originalError: error }
    );
  }
}

/**
 * Edge function handler for creating a new job posting
 */
export const createJob = rateLimit({
  max: RATE_LIMIT_MAX,
  window: RATE_LIMIT_WINDOW,
  handler: async (req: Request): Promise<Response> => {
    try {
      // Validate request size
      const contentLength = parseInt(req.headers.get('content-length') || '0');
      if (contentLength > MAX_REQUEST_SIZE) {
        throw new AppError(
          'Request body too large',
          ErrorCode.BAD_REQUEST,
          { maxSize: MAX_REQUEST_SIZE, receivedSize: contentLength }
        );
      }

      // Parse request body
      const body = await req.json();

      // Validate and sanitize input
      const jobData = await validateJobInput(body);

      // Get database connection
      const pool = await databaseConfig.getPool();

      // Generate UUID for new job
      const jobId = crypto.randomUUID();

      // Set initial job status
      const status = JobStatus.DRAFT;

      try {
        // Begin transaction
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Insert job record with parameterized query
          const query = `
            INSERT INTO jobs (
              id, title, description, creator_id, requirements,
              status, type, skills, posted_at, salary_min,
              salary_max, location, remote_allowed
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            ) RETURNING *
          `;

          const values = [
            jobId,
            jobData.title,
            jobData.description,
            jobData.creator_id,
            jobData.requirements,
            status,
            jobData.type,
            jobData.skills,
            new Date(),
            jobData.salary_min,
            jobData.salary_max,
            jobData.location,
            jobData.remote_allowed
          ];

          const result = await client.query(query, values);
          await client.query('COMMIT');

          // Log successful job creation
          logger.info('Job created successfully', {
            jobId,
            creatorId: jobData.creator_id,
            title: jobData.title
          });

          return new Response(
            JSON.stringify({
              success: true,
              data: result.rows[0]
            }),
            {
              status: 201,
              headers: {
                'Content-Type': 'application/json'
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
        logger.error('Failed to create job', {
          error,
          jobData: { ...jobData, id: jobId }
        });
        throw new AppError(
          'Failed to create job',
          ErrorCode.INTERNAL_ERROR,
          { originalError: error }
        );
      }
    } catch (error) {
      const errorResponse = error instanceof AppError
        ? error
        : new AppError('Internal server error', ErrorCode.INTERNAL_ERROR);

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: errorResponse.code,
            message: errorResponse.message,
            details: errorResponse.details
          }
        }),
        {
          status: errorResponse.code === ErrorCode.VALIDATION_ERROR ? 400 : 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
  }
});