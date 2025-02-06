import { z } from 'zod'; // ^3.22.0
import { createClient } from '@supabase/supabase-js'; // ^2.33.0
import { rateLimit } from '@vercel/edge'; // ^0.3.4
import { CircuitBreaker } from 'opossum'; // ^7.1.0
import { AppError } from '@company/error-handling'; // ^1.0.0

import { Interview, InterviewType, InterviewStatus, InterviewMode } from '../../types/interviews';
import { InterviewScheduler } from '../../services/calendar/scheduler';
import { EmailSender } from '../../services/email/sender';
import { ApiResponse } from '../../types/common';
import { logger } from '../../utils/logger';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

// Configure rate limiter
const rateLimiter = rateLimit({
  uniqueTokenPerInterval: 500,
  interval: 60000
});

// Initialize services
const scheduler = new InterviewScheduler({
  defaultDuration: 60,
  bufferMinutes: 15,
  timezone: 'UTC',
  retryConfig: {
    retries: 3,
    retryDelay: 1000,
    retryCondition: (error: any) => error.response?.status >= 500
  }
});

const emailSender = new EmailSender();

// Configure circuit breaker for calendar operations
const calendarCircuitBreaker = new CircuitBreaker(scheduler.scheduleInterview, {
  timeout: 3000,
  resetTimeout: 30000,
  errorThresholdPercentage: 50
});

// Enhanced validation schema for interview scheduling
const scheduleInterviewSchema = z.object({
  candidateId: z.string().uuid(),
  jobId: z.string().uuid(),
  type: z.enum([
    'TECHNICAL',
    'HR',
    'BEHAVIORAL',
    'SYSTEM_DESIGN',
    'FINAL',
    'PAIR_PROGRAMMING',
    'TAKE_HOME',
    'CULTURE_FIT'
  ]),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().min(15).max(180),
  interviewerIds: z.array(z.string().uuid()).min(1),
  mode: z.enum(['VIDEO', 'PHONE', 'IN_PERSON']),
  location: z.string().optional(),
  timezone: z.string(),
  notes: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringConfig: z.object({
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    endDate: z.string().datetime()
  }).optional()
});

/**
 * Edge function handler for scheduling interviews with comprehensive validation,
 * error handling, and monitoring capabilities.
 */
export async function scheduleInterviewHandler(
  req: Request
): Promise<ApiResponse<Interview>> {
  const correlationId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Apply rate limiting
    await rateLimiter.check(5, 'interview_scheduling');

    // Parse and validate request body
    const body = await req.json();
    const validatedData = scheduleInterviewSchema.parse(body);

    // Start telemetry
    logger.info('Interview scheduling started', {
      correlationId,
      type: validatedData.type,
      candidateId: validatedData.candidateId
    });

    // Fetch participant details
    const [candidate, interviewers, job] = await Promise.all([
      supabase
        .from('candidates')
        .select('id, full_name, email')
        .eq('id', validatedData.candidateId)
        .single(),
      supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', validatedData.interviewerIds),
      supabase
        .from('jobs')
        .select('id, title, company_name')
        .eq('id', validatedData.jobId)
        .single()
    ]);

    if (!candidate.data || !job.data || interviewers.data?.length === 0) {
      throw new AppError(
        'Invalid participant data',
        'VALIDATION_ERROR',
        { correlationId }
      );
    }

    // Prepare interview data
    const interviewData: Partial<Interview> = {
      candidate_id: validatedData.candidateId,
      job_id: validatedData.jobId,
      type: validatedData.type as InterviewType,
      status: InterviewStatus.SCHEDULED,
      mode: validatedData.mode as InterviewMode,
      scheduled_at: new Date(validatedData.scheduledAt),
      duration_minutes: validatedData.durationMinutes,
      interviewer_ids: validatedData.interviewerIds,
      location: validatedData.location,
      notes: validatedData.notes,
      candidate_confirmed: false,
      interviewers_confirmed: false
    };

    // Schedule interview using circuit breaker pattern
    const schedulingResult = await calendarCircuitBreaker.fire({
      ...interviewData,
      attendees: [
        candidate.data.email,
        ...interviewers.data.map(i => i.email)
      ]
    });

    if (!schedulingResult.success) {
      throw new AppError(
        'Failed to schedule interview',
        'SCHEDULING_ERROR',
        schedulingResult.error
      );
    }

    // Create interview record in database
    const { data: createdInterview, error: dbError } = await supabase
      .from('interviews')
      .insert([{
        ...interviewData,
        calendar_event_id: schedulingResult.data.calendar_event_id,
        meeting_link: schedulingResult.data.meeting_link
      }])
      .select()
      .single();

    if (dbError || !createdInterview) {
      throw new AppError(
        'Failed to create interview record',
        'DATABASE_ERROR',
        { error: dbError }
      );
    }

    // Send email notifications
    await emailSender.sendBulkEmails([
      {
        to: candidate.data.email,
        subject: `Interview Scheduled: ${job.data.title}`,
        templateName: 'interview_schedule',
        data: {
          interview: createdInterview,
          participant: candidate.data,
          job: job.data
        }
      },
      ...interviewers.data.map(interviewer => ({
        to: interviewer.email,
        subject: `Interview Assignment: ${job.data.title}`,
        templateName: 'interview_schedule',
        data: {
          interview: createdInterview,
          participant: interviewer,
          job: job.data
        }
      }))
    ]);

    // Log success
    logger.info('Interview scheduled successfully', {
      correlationId,
      interviewId: createdInterview.id
    });

    return {
      success: true,
      data: createdInterview,
      error: null
    };

  } catch (error) {
    logger.error('Interview scheduling failed', {
      correlationId,
      error
    });

    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid interview scheduling parameters',
          details: error.errors
        }
      };
    }

    if (error instanceof AppError) {
      return {
        success: false,
        data: null,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    }

    return {
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: { correlationId }
      }
    };
  }
}