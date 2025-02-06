import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import { AuditLogger } from '@company/audit-logger'; // ^1.0.0
import { AppError } from '../../utils/error-handler';
import { ErrorCode } from '../../types/common';
import { Hotlist, HotlistMemberRole } from '../../types/hotlists';
import { logger } from '../../utils/logger';

// Initialize Supabase client with environment variables
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Initialize audit logger
const auditLogger = new AuditLogger({
  service: 'hotgigs-hotlists',
  environment: process.env.NODE_ENV
});

/**
 * Edge function handler for securely deleting hotlists with cascading operations
 * Implements soft delete, transaction management, and comprehensive audit logging
 */
export const deleteHotlist = async (req: Request): Promise<Response> => {
  try {
    // Extract hotlist ID from request URL
    const url = new URL(req.url);
    const hotlistId = url.searchParams.get('id');

    if (!hotlistId) {
      throw new AppError('Hotlist ID is required', ErrorCode.BAD_REQUEST);
    }

    // Get JWT claims from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new AppError('Authentication required', ErrorCode.UNAUTHORIZED);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new AppError('Invalid authentication', ErrorCode.UNAUTHORIZED);
    }

    // Start database transaction
    const { data: hotlist, error: hotlistError } = await supabase
      .from('hotlists')
      .select('*')
      .eq('id', hotlistId)
      .single();

    if (hotlistError || !hotlist) {
      throw new AppError('Hotlist not found', ErrorCode.NOT_FOUND);
    }

    // Check authorization
    const { data: collaborator, error: collaboratorError } = await supabase
      .from('hotlist_collaborators')
      .select('role')
      .eq('hotlist_id', hotlistId)
      .eq('user_id', user.id)
      .single();

    if (hotlist.owner_id !== user.id && 
        (!collaborator || collaborator.role !== HotlistMemberRole.OWNER)) {
      throw new AppError('Unauthorized to delete hotlist', ErrorCode.FORBIDDEN);
    }

    // Begin transaction for cascading soft delete
    const { error: transactionError } = await supabase.rpc('delete_hotlist', {
      p_hotlist_id: hotlistId,
      p_deleted_by: user.id,
      p_deleted_at: new Date().toISOString()
    });

    if (transactionError) {
      throw new AppError(
        'Failed to delete hotlist',
        ErrorCode.INTERNAL_ERROR,
        { originalError: transactionError.message }
      );
    }

    // Create audit log entry
    await auditLogger.log({
      action: 'hotlist.delete',
      actor: user.id,
      target: hotlistId,
      context: {
        hotlistName: hotlist.name,
        memberCount: hotlist.member_count,
        deletedAt: new Date().toISOString()
      },
      metadata: {
        cascadeDeleted: true,
        environment: process.env.NODE_ENV
      }
    });

    // Log successful deletion
    logger.info('Hotlist deleted successfully', {
      hotlistId,
      userId: user.id,
      action: 'delete'
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: { id: hotlistId },
        error: null
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    // Handle known application errors
    if (error instanceof AppError) {
      logger.error(error, {
        context: 'hotlist.delete',
        hotlistId: url.searchParams.get('id')
      });

      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        }),
        {
          status: error.code === ErrorCode.UNAUTHORIZED ? 401 :
                 error.code === ErrorCode.FORBIDDEN ? 403 :
                 error.code === ErrorCode.NOT_FOUND ? 404 : 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Handle unexpected errors
    logger.error('Unexpected error in hotlist deletion', {
      error,
      context: 'hotlist.delete',
      hotlistId: url.searchParams.get('id')
    });

    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
          details: process.env.NODE_ENV === 'development' ? error : null
        }
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
};