import { z } from 'zod'; // ^3.22.0
import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import { NotificationService } from '@company/notifications'; // ^1.0.0
import { 
  Interview, 
  InterviewStatus, 
  InterviewUpdatePayload 
} from '../../types/interviews';
import { InterviewScheduler } from '../../services/calendar/scheduler';
import { AppError, handleError } from '../../utils/error-handler';
import { ApiResponse } from '../../types/common';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Initialize notification service
const notificationService = new NotificationService({
  apiKey: process.env.NOTIFICATION_API_KEY!
});

// Initialize interview scheduler
const interviewScheduler = new InterviewScheduler(
  process.env.GOOGLE_CALENDAR_CLIENT_ID!,
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
  process.env.GOOGLE_CALENDAR_REDIRECT_URI!,
  {
    defaultDuration: 60,
    bufferMinutes: 15,
    timezone: 'UTC',
    retryConfig: {
      retries: MAX_RETRY_ATTEMPTS,
      retryDelay: RETRY_DELAY_MS,
      retryCondition: (error: any) => error.status >= 500
    }
  }
);

// Constants for retry mechanism
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// Validation schema for interview updates
const updateInterviewSchema = z.object({
  status: z.nativeEnum(InterviewStatus).optional(),
  scheduled_at: z.coerce.date().optional(),
  notes: z.string().min(1).max(1000).optional(),
  location: z.string().min(1).max(200).optional()
});

/**
 * Validates user authorization for interview update operation
 */
async function validateUpdateAuthorization(
  userId: string,
  interviewId: string
): Promise<boolean> {
  try {
    const { data: userRole, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (roleError) throw new AppError('Failed to fetch user role', 'UNAUTHORIZED');

    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select('interviewer_ids')
      .eq('id', interviewId)
      .single();

    if (interviewError) throw new AppError('Failed to fetch interview', 'NOT_FOUND');

    return userRole.role === 'ADMIN' || 
           interview.interviewer_ids.includes(userId);
  } catch (error) {
    console.error('Authorization validation failed:', error);
    return false;
  }
}

/**
 * Edge function handler for updating interview details
 */
export default async function updateInterview(req: Request): Promise<ApiResponse<Interview>> {
  try {
    // Extract interview ID and update payload
    const { id } = await req.json();
    if (!id) throw new AppError('Interview ID is required', 'BAD_REQUEST');

    // Extract user ID from auth context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new AppError('Unauthorized', 'UNAUTHORIZED');
    
    const userId = authHeader.split(' ')[1]; // Extract JWT payload
    
    // Validate authorization
    const isAuthorized = await validateUpdateAuthorization(userId, id);
    if (!isAuthorized) {
      throw new AppError('Unauthorized to update this interview', 'FORBIDDEN');
    }

    // Validate update payload
    const updatePayload: InterviewUpdatePayload = await req.json();
    const validatedPayload = updateInterviewSchema.parse(updatePayload);

    // Begin database transaction
    const { data: interview, error: fetchError } = await supabase
      .from('interviews')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      throw new AppError('Interview not found', 'NOT_FOUND');
    }

    // Handle calendar updates if scheduled_at changed
    if (validatedPayload.scheduled_at && 
        validatedPayload.scheduled_at.getTime() !== interview.scheduled_at.getTime()) {
      let retryCount = 0;
      let calendarUpdateSuccess = false;

      while (retryCount < MAX_RETRY_ATTEMPTS && !calendarUpdateSuccess) {
        try {
          const calendarUpdate = await interviewScheduler.rescheduleInterview(
            interview.calendar_event_id,
            {
              scheduled_at: validatedPayload.scheduled_at,
              duration_minutes: interview.duration_minutes
            }
          );

          if (!calendarUpdate.success) {
            throw new Error('Calendar update failed');
          }

          calendarUpdateSuccess = true;
        } catch (error) {
          retryCount++;
          if (retryCount === MAX_RETRY_ATTEMPTS) {
            throw new AppError('Failed to update calendar after retries', 'SERVICE_UNAVAILABLE');
          }
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    // Update interview record
    const { data: updatedInterview, error: updateError } = await supabase
      .from('interviews')
      .update({
        ...validatedPayload,
        updated_at: new Date(),
        status: validatedPayload.status || interview.status,
        last_modified_by: userId
      })
      .eq('id', id)
      .single();

    if (updateError) {
      throw new AppError('Failed to update interview', 'INTERNAL_ERROR');
    }

    // Send notifications to affected participants
    await notificationService.sendBulk({
      template: 'INTERVIEW_UPDATED',
      recipients: interview.interviewer_ids,
      data: {
        interview_id: id,
        changes: validatedPayload,
        updated_by: userId
      }
    });

    return {
      success: true,
      data: updatedInterview,
      error: null
    };

  } catch (error) {
    return handleError(error, {
      context: 'updateInterview',
      interviewId: req.params?.id
    });
  }
}