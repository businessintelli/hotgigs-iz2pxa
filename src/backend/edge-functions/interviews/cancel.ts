import { createClient } from '@supabase/supabase-js'; // ^2.33.1
import { Interview, InterviewStatus } from '../../../types/interviews';
import { handleError } from '../../../utils/error-handler';
import { GoogleCalendarService } from '../../../services/calendar/google-calendar';
import { EmailSender } from '../../../services/email/sender';
import { Logger } from '../../../utils/logger';
import { ApiResponse, ErrorCode } from '../../../types/common';
import { InterviewEmailTemplate } from '../../../services/email/templates/interview';

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const calendarService = new GoogleCalendarService(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI!,
  {
    maxRetries: 3,
    quotaLimit: 100,
    timeoutMs: 10000
  }
);

const emailSender = new EmailSender();
const logger = new Logger({ name: 'interview-cancellation' });

interface CancellationRequest {
  interview_id: string;
  reason: string;
  notify_participants: boolean;
}

/**
 * Edge function handler for canceling scheduled interviews
 * Manages the complete cancellation workflow including calendar events and notifications
 */
export async function cancelInterview(
  req: { body: CancellationRequest; user: { id: string; role: string } }
): Promise<ApiResponse<{ interview_id: string; status: string }>> {
  const { interview_id, reason, notify_participants } = req.body;
  const correlationId = `cancel_${interview_id}_${Date.now()}`;

  try {
    // Validate request
    if (!interview_id || !reason) {
      throw new Error('Missing required fields: interview_id and reason');
    }

    // Start transaction
    const { data: interview, error: fetchError } = await supabase
      .from('interviews')
      .select('*, candidate:candidates(*), interviewers:users(*)')
      .eq('id', interview_id)
      .single();

    if (fetchError || !interview) {
      logger.error('Failed to fetch interview', { correlationId, interview_id });
      return {
        success: false,
        data: null,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Interview not found',
          details: null
        }
      };
    }

    // Validate interview status
    if (interview.status !== InterviewStatus.SCHEDULED) {
      return {
        success: false,
        data: null,
        error: {
          code: ErrorCode.CONFLICT,
          message: 'Interview cannot be cancelled - invalid status',
          details: { current_status: interview.status }
        }
      };
    }

    // Begin cancellation process
    const { error: updateError } = await supabase
      .from('interviews')
      .update({
        status: InterviewStatus.CANCELLED,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        cancelled_by: req.user.id
      })
      .eq('id', interview_id);

    if (updateError) {
      throw updateError;
    }

    // Delete calendar event if exists
    if (interview.calendar_event_id) {
      const calendarResult = await calendarService.deleteEvent(
        interview.calendar_event_id,
        notify_participants
      );

      if (!calendarResult.success) {
        logger.error('Failed to delete calendar event', {
          correlationId,
          calendar_event_id: interview.calendar_event_id
        });
      }
    }

    // Send cancellation notifications if requested
    if (notify_participants) {
      const emailTemplate = new InterviewEmailTemplate({
        locale: 'en',
        timezone: interview.timezone || 'UTC',
        templatePaths: {
          schedule: { html: '', text: '' },
          update: { html: '', text: '' },
          reminder: { html: '', text: '' },
          cancellation: {
            html: '/templates/email/interview-cancellation.html',
            text: '/templates/email/interview-cancellation.txt'
          }
        }
      });

      const participantData = {
        candidate: {
          name: interview.candidate.full_name,
          email: interview.candidate.email
        },
        interviewers: interview.interviewers.map((interviewer: any) => ({
          name: interviewer.full_name,
          email: interviewer.email
        }))
      };

      const emailContent = await emailTemplate.generateCancellationEmail(
        interview as Interview,
        participantData,
        reason
      );

      // Send emails in parallel to all participants
      const emailPromises = [
        participantData.candidate,
        ...participantData.interviewers
      ].map(participant =>
        emailSender.sendEmail({
          to: participant.email,
          subject: `Interview Cancelled: ${interview.type}`,
          html: emailContent.html,
          text: emailContent.text,
          calendarEvent: emailContent.calendarEvent
        })
      );

      await Promise.all(emailPromises).catch(error => {
        logger.error('Failed to send cancellation emails', {
          correlationId,
          error
        });
      });
    }

    // Log audit trail
    logger.info('Interview cancelled successfully', {
      correlationId,
      interview_id,
      cancelled_by: req.user.id,
      reason
    });

    return {
      success: true,
      data: {
        interview_id,
        status: InterviewStatus.CANCELLED
      },
      error: null
    };

  } catch (error) {
    logger.error('Interview cancellation failed', {
      correlationId,
      error
    });

    return handleError(error, {
      context: 'interview-cancellation',
      interview_id,
      correlationId
    });
  }
}