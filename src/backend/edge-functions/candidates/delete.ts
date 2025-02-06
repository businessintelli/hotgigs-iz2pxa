import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import { datadogRum } from '@datadog/browser-rum'; // ^4.0.0
import winston from 'winston'; // ^3.8.0
import { authenticateRequest, requireRole } from '../../middleware/auth';
import { AppError, handleError } from '../../utils/error-handler';
import { CandidateId } from '../../types/candidates';
import { ErrorCode } from '../../types/common';
import { UserRole } from '../../types/auth';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Initialize security audit logger
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'candidate-deletion' },
  transports: [
    new winston.transports.File({ filename: 'security-audit.log' })
  ]
});

// Performance monitoring decorator
function monitorPerformance(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const startTime = performance.now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - startTime;
      
      // Send metrics to Datadog
      datadogRum.addTiming('candidate.deletion.duration', duration);
      return result;
    } catch (error) {
      datadogRum.addError(error as Error);
      throw error;
    }
  };
  return descriptor;
}

/**
 * Edge function handler for secure candidate deletion with cascade operations
 * Implements comprehensive security checks, transaction management, and audit logging
 */
@authenticateRequest
@requireRole([UserRole.ADMIN, UserRole.RECRUITER])
@monitorPerformance
export async function deleteCandidate(req: Request, res: Response): Promise<void> {
  const correlationId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Extract and validate candidate ID
    const candidateId = req.params.id as CandidateId;
    if (!candidateId) {
      throw new AppError('Candidate ID is required', ErrorCode.BAD_REQUEST);
    }

    // Start database transaction
    const { data: candidate, error: fetchError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (fetchError || !candidate) {
      throw new AppError('Candidate not found', ErrorCode.NOT_FOUND);
    }

    // Verify user permissions for the specific candidate
    if (req.user?.role !== UserRole.ADMIN && candidate.recruiter_id !== req.user?.id) {
      throw new AppError('Unauthorized to delete this candidate', ErrorCode.FORBIDDEN);
    }

    // Begin transaction for cascade deletion
    const { error: txError } = await supabase.rpc('begin_transaction');
    if (txError) throw txError;

    try {
      // Delete from hotlists first (many-to-many relationship)
      const { error: hotlistError } = await supabase
        .from('hotlist_candidates')
        .delete()
        .eq('candidate_id', candidateId);
      if (hotlistError) throw hotlistError;

      // Delete related interviews
      const { error: interviewError } = await supabase
        .from('interviews')
        .delete()
        .eq('candidate_id', candidateId);
      if (interviewError) throw interviewError;

      // Delete applications
      const { error: applicationError } = await supabase
        .from('applications')
        .delete()
        .eq('candidate_id', candidateId);
      if (applicationError) throw applicationError;

      // Delete candidate profile
      const { error: deleteError } = await supabase
        .from('candidates')
        .delete()
        .eq('id', candidateId);
      if (deleteError) throw deleteError;

      // Commit transaction
      const { error: commitError } = await supabase.rpc('commit_transaction');
      if (commitError) throw commitError;

      // Log successful deletion to security audit
      auditLogger.info('Candidate deleted successfully', {
        candidateId,
        userId: req.user?.id,
        userRole: req.user?.role,
        correlationId,
        timestamp: new Date().toISOString()
      });

      // Track successful deletion metric
      datadogRum.addAction('candidate_deleted', {
        candidateId,
        correlationId
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Candidate deleted successfully',
          correlationId
        }
      });
    } catch (error) {
      // Rollback transaction on any error
      await supabase.rpc('rollback_transaction');
      throw error;
    }
  } catch (error) {
    // Log deletion failure
    auditLogger.error('Candidate deletion failed', {
      error,
      candidateId: req.params.id,
      userId: req.user?.id,
      correlationId
    });

    const errorResponse = handleError(error as Error, {
      correlationId,
      operation: 'candidate_deletion'
    });

    res.status(errorResponse.error.code === ErrorCode.NOT_FOUND ? 404 : 500)
      .json(errorResponse);
  }
}