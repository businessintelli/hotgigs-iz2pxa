import { createClient } from '@supabase/supabase-js'; // ^2.0.0
import { Job } from '../../types/jobs';
import { AppError } from '../../utils/error-handler';
import { authenticateRequest, requireRole } from '../../middleware/auth';
import { Logger } from '../../utils/logger';
import { ErrorCode } from '../../types/common';
import { UserRole } from '../../types/auth';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Initialize logger
const logger = new Logger({
  name: 'job-deletion-service'
});

/**
 * Validates if a user has permission to delete a specific job
 * @param userId - ID of the user attempting deletion
 * @param jobId - ID of the job to be deleted
 * @returns Promise<boolean> indicating if user has permission
 */
async function validateJobAccess(userId: string, jobId: string): Promise<boolean> {
  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select('creator_id')
      .eq('id', jobId)
      .single();

    if (error) {
      throw new AppError('Failed to validate job access', ErrorCode.INTERNAL_ERROR);
    }

    if (!job) {
      throw new AppError('Job not found', ErrorCode.NOT_FOUND);
    }

    return job.creator_id === userId;
  } catch (error) {
    logger.error('Job access validation failed', { userId, jobId, error });
    throw error;
  }
}

/**
 * Edge function handler for job deletion with comprehensive security controls
 * Implements soft delete pattern with audit trail
 */
export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  const correlationId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const trx = await supabase.auth.admin.createClient();

  try {
    // Authenticate and authorize request
    await authenticateRequest(req, res, () => {});
    await requireRole([UserRole.ADMIN, UserRole.RECRUITER])(req, res, () => {});

    const jobId = req.params.id;
    const userId = (req as any).user.id;

    // Validate UUID format
    if (!jobId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      throw new AppError('Invalid job ID format', ErrorCode.BAD_REQUEST);
    }

    // Start transaction
    const { error: trxError } = await trx.rpc('begin_transaction');
    if (trxError) throw trxError;

    try {
      // Check if job exists and user has permission
      const hasAccess = await validateJobAccess(userId, jobId);
      if (!hasAccess && (req as any).user.role !== UserRole.ADMIN) {
        throw new AppError('Unauthorized to delete this job', ErrorCode.FORBIDDEN);
      }

      // Check if job is already deleted
      const { data: existingJob } = await trx
        .from('jobs')
        .select('deleted_at')
        .eq('id', jobId)
        .single();

      if (existingJob?.deleted_at) {
        throw new AppError('Job already deleted', ErrorCode.BAD_REQUEST);
      }

      // Perform soft delete
      const { error: updateError } = await trx
        .from('jobs')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) throw updateError;

      // Create audit log entry
      const { error: auditError } = await trx
        .from('audit_logs')
        .insert({
          action: 'JOB_DELETED',
          entity_type: 'job',
          entity_id: jobId,
          user_id: userId,
          metadata: {
            correlationId,
            userRole: (req as any).user.role,
            timestamp: new Date().toISOString()
          }
        });

      if (auditError) throw auditError;

      // Commit transaction
      await trx.rpc('commit_transaction');

      // Log successful deletion
      logger.info('Job deleted successfully', {
        jobId,
        userId,
        correlationId
      });

      res.status(200).json({
        success: true,
        data: {
          id: jobId,
          deleted_at: new Date().toISOString()
        }
      });
    } catch (error) {
      // Rollback transaction on error
      await trx.rpc('rollback_transaction');
      throw error;
    }
  } catch (error) {
    logger.error('Job deletion failed', {
      error,
      correlationId,
      userId: (req as any).user?.id,
      jobId: req.params.id
    });

    if (error instanceof AppError) {
      res.status(error.code === ErrorCode.NOT_FOUND ? 404 : 400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          correlationId
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
          correlationId
        }
      });
    }
  } finally {
    // Clean up transaction client
    trx.end();
  }
};