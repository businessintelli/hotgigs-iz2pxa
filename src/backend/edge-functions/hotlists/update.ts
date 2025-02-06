import { z } from 'zod'; // ^3.22.0
import { rateLimit } from '@supabase/supabase-js'; // ^2.33.0
import { Hotlist, HotlistVisibility, hotlistUpdatePayloadSchema } from '../../types/hotlists';
import { validateInput, sanitizeInput } from '../../utils/validation';
import { AppError } from '../../utils/error-handler';
import { ErrorCode } from '../../types/common';
import { databaseConfig } from '../../config/database';
import { logger } from '../../utils/logger';

// Rate limiting configuration for hotlist updates
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per window
};

// Schema for validating hotlist update requests
const updateHotlistSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  visibility: z.nativeEnum(HotlistVisibility).optional(),
  tags: z.array(z.string().trim()).max(10).optional()
});

/**
 * Edge function handler for updating existing hotlists
 * Implements comprehensive validation, security checks, and audit logging
 */
@rateLimit(RATE_LIMIT_CONFIG)
export async function updateHotlist(req: Request): Promise<Response> {
  const startTime = Date.now();
  const correlationId = `upd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Extract and validate authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Missing or invalid authentication', ErrorCode.UNAUTHORIZED);
    }

    // Parse request parameters
    const url = new URL(req.url);
    const hotlistId = url.searchParams.get('id');
    if (!hotlistId) {
      throw new AppError('Missing hotlist ID', ErrorCode.BAD_REQUEST);
    }

    // Parse and validate request body
    const rawData = await req.json();
    const updateData = await validateInput(updateHotlistSchema, rawData);

    // Sanitize text inputs
    if (updateData.name) {
      updateData.name = sanitizeInput(updateData.name);
    }
    if (updateData.description) {
      updateData.description = sanitizeInput(updateData.description);
    }
    if (updateData.tags) {
      updateData.tags = updateData.tags.map(sanitizeInput);
    }

    // Get database connection from pool
    const pool = await databaseConfig.getPool();

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify hotlist existence and ownership
      const existingHotlist = await client.query<Hotlist>(
        'SELECT * FROM hotlists WHERE id = $1 AND NOT is_archived',
        [hotlistId]
      );

      if (existingHotlist.rowCount === 0) {
        throw new AppError('Hotlist not found', ErrorCode.NOT_FOUND);
      }

      // Extract user ID from auth token and verify ownership
      const userId = getUserIdFromToken(authHeader.split(' ')[1]);
      if (existingHotlist.rows[0].owner_id !== userId) {
        throw new AppError('Unauthorized to update this hotlist', ErrorCode.FORBIDDEN);
      }

      // Prepare update query
      const updateFields: string[] = [];
      const queryParams: any[] = [hotlistId];
      let paramCounter = 2;

      if (updateData.name) {
        updateFields.push(`name = $${paramCounter++}`);
        queryParams.push(updateData.name);
      }
      if (updateData.description !== undefined) {
        updateFields.push(`description = $${paramCounter++}`);
        queryParams.push(updateData.description);
      }
      if (updateData.visibility) {
        updateFields.push(`visibility = $${paramCounter++}`);
        queryParams.push(updateData.visibility);
      }
      if (updateData.tags) {
        updateFields.push(`tags = $${paramCounter++}`);
        queryParams.push(updateData.tags);
      }

      // Add updated_at timestamp
      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      // Execute update
      const updateQuery = `
        UPDATE hotlists 
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query<Hotlist>(updateQuery, queryParams);

      // Create audit log entry
      await client.query(
        'INSERT INTO audit_logs (entity_type, entity_id, action, user_id, changes) VALUES ($1, $2, $3, $4, $5)',
        ['hotlist', hotlistId, 'update', userId, JSON.stringify(updateData)]
      );

      await client.query('COMMIT');

      // Log successful update
      logger.info('Hotlist updated successfully', {
        correlationId,
        hotlistId,
        userId,
        duration: Date.now() - startTime
      });

      return new Response(JSON.stringify({
        success: true,
        data: result.rows[0]
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': correlationId
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    // Log error with context
    logger.error(error instanceof Error ? error : new Error(String(error)), {
      correlationId,
      hotlistId,
      duration: Date.now() - startTime
    });

    if (error instanceof AppError) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          correlationId
        }
      }), {
        status: getHttpStatusFromErrorCode(error.code),
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': correlationId
        }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
        correlationId
      }
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId
      }
    });
  }
}

/**
 * Helper function to extract user ID from JWT token
 */
function getUserIdFromToken(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  } catch (error) {
    throw new AppError('Invalid authentication token', ErrorCode.UNAUTHORIZED);
  }
}

/**
 * Maps error codes to HTTP status codes
 */
function getHttpStatusFromErrorCode(code: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    [ErrorCode.BAD_REQUEST]: 400,
    [ErrorCode.UNAUTHORIZED]: 401,
    [ErrorCode.FORBIDDEN]: 403,
    [ErrorCode.NOT_FOUND]: 404,
    [ErrorCode.VALIDATION_ERROR]: 422,
    [ErrorCode.CONFLICT]: 409,
    [ErrorCode.INTERNAL_ERROR]: 500,
    [ErrorCode.SERVICE_UNAVAILABLE]: 503
  };
  return statusMap[code] || 500;
}