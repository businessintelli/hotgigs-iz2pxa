import { z } from 'zod'; // ^3.22.0
import { createClient } from '@supabase/supabase-js'; // ^2.33.0
import { Hotlist, HotlistVisibility, HotlistMemberRole } from '../../types/hotlists';
import { validateInput, sanitizeInput } from '../../utils/validation';
import { AppError } from '../../utils/error-handler';
import { ErrorCode } from '../../types/common';
import { databaseConfig } from '../../config/database';
import { logger } from '../../utils/logger';

// Schema for hotlist creation validation
const createHotlistSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim(),
  visibility: z.nativeEnum(HotlistVisibility),
  tags: z.array(z.string().max(50).trim()).max(10).optional()
});

/**
 * Edge function handler for creating a new hotlist
 * @param req - Request object containing hotlist creation data
 * @returns Response with created hotlist data or error details
 */
export async function createHotlist(req: Request): Promise<Response> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Extract and validate auth context
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Missing or invalid authorization', ErrorCode.UNAUTHORIZED);
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new AppError('Missing Supabase configuration', ErrorCode.INTERNAL_ERROR);
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and get user context
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.split(' ')[1]);
    if (authError || !user) {
      throw new AppError('Invalid authentication token', ErrorCode.UNAUTHORIZED);
    }

    // Parse and validate request body
    const rawData = await req.json();
    const validatedData = await validateInput(createHotlistSchema, rawData);

    // Sanitize string inputs
    const sanitizedData = {
      ...validatedData,
      name: sanitizeInput(validatedData.name),
      description: sanitizeInput(validatedData.description),
      tags: validatedData.tags?.map(tag => sanitizeInput(tag))
    };

    // Get database connection
    const pool = await databaseConfig.getPool();

    // Execute database operations within a transaction
    const result = await pool.query('BEGIN');
    try {
      // Create hotlist record
      const { rows: [hotlist] } = await pool.query<Hotlist>(
        `INSERT INTO hotlists (
          name, description, owner_id, visibility, tags, 
          metadata, is_archived, member_limit
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          sanitizedData.name,
          sanitizedData.description,
          user.id,
          sanitizedData.visibility,
          sanitizedData.tags || [],
          {},
          false,
          100 // Default member limit
        ]
      );

      // Create owner collaborator record
      await pool.query(
        `INSERT INTO hotlist_collaborators (
          hotlist_id, user_id, role, permissions
        ) VALUES ($1, $2, $3, $4)`,
        [
          hotlist.id,
          user.id,
          HotlistMemberRole.OWNER,
          { can_manage: true, can_edit: true, can_view: true }
        ]
      );

      // Apply RLS policies
      await pool.query(
        `SELECT set_config('app.current_user_id', $1, true)`,
        [user.id]
      );

      await pool.query('COMMIT');

      // Log successful creation
      logger.info('Hotlist created successfully', {
        requestId,
        userId: user.id,
        hotlistId: hotlist.id,
        duration: Date.now() - startTime
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: hotlist,
          error: null
        }),
        {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId
          }
        }
      );

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    // Log error with context
    logger.error(error instanceof Error ? error : new Error(String(error)), {
      requestId,
      duration: Date.now() - startTime,
      component: 'createHotlist'
    });

    const statusCode = error instanceof AppError ? 
      (error.code === ErrorCode.UNAUTHORIZED ? 401 :
       error.code === ErrorCode.VALIDATION_ERROR ? 400 :
       error.code === ErrorCode.FORBIDDEN ? 403 : 500) : 500;

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
          'X-Request-Id': requestId
        }
      }
    );
  }
}