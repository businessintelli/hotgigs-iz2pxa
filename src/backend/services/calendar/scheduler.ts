import { GoogleCalendarService } from './google-calendar';
import { Interview, InterviewScheduleParams, InterviewStatus, interviewSchema } from '../../types/interviews';
import { ApiResponse } from '../../types/common';
import dayjs from 'dayjs'; // ^1.11.0
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { z } from 'zod'; // ^3.22.0
import { retry } from 'axios-retry'; // ^3.8.0
import { io } from 'socket.io-client'; // ^4.7.0

// Configure dayjs plugins for timezone handling
dayjs.extend(utc);
dayjs.extend(timezone);

// Retry configuration for API calls
interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition: (error: any) => boolean;
}

// Scheduler configuration interface
interface SchedulerConfig {
  defaultDuration: number;
  bufferMinutes: number;
  timezone: string;
  retryConfig: RetryConfig;
}

// Validation schema for scheduler configuration
const schedulerConfigSchema = z.object({
  defaultDuration: z.number().min(15).max(480),
  bufferMinutes: z.number().min(5).max(60),
  timezone: z.string(),
  retryConfig: z.object({
    retries: z.number().min(1).max(5),
    retryDelay: z.number().min(1000).max(10000),
    retryCondition: z.function()
  })
});

/**
 * Advanced interview scheduling service with comprehensive calendar integration,
 * timezone support, and real-time updates.
 */
export class InterviewScheduler {
  private readonly calendarService: GoogleCalendarService;
  private readonly defaultDuration: number;
  private readonly bufferMinutes: number;
  private readonly timezone: string;
  private readonly retryConfig: RetryConfig;
  private readonly socket: any;

  constructor(
    calendarService: GoogleCalendarService,
    config: SchedulerConfig
  ) {
    // Validate configuration
    schedulerConfigSchema.parse(config);

    this.calendarService = calendarService;
    this.defaultDuration = config.defaultDuration;
    this.bufferMinutes = config.bufferMinutes;
    this.timezone = config.timezone;
    this.retryConfig = config.retryConfig;

    // Initialize Socket.IO for real-time updates
    this.socket = io(process.env.REALTIME_SERVICE_URL!, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
  }

  /**
   * Schedules a new interview with comprehensive validation and real-time updates
   */
  async scheduleInterview(params: InterviewScheduleParams): Promise<ApiResponse<Interview>> {
    try {
      // Validate interview parameters
      const validatedParams = interviewSchema.omit({
        id: true,
        created_at: true,
        updated_at: true,
        feedback: true
      }).parse(params);

      // Convert scheduled time to configured timezone
      const scheduledTime = dayjs(params.scheduled_at)
        .tz(this.timezone)
        .toDate();

      // Check for scheduling conflicts with retry mechanism
      const hasConflicts = await retry(
        async () => this.checkSchedulingConflicts(
          scheduledTime,
          params.duration_minutes || this.defaultDuration,
          params.interviewer_ids
        ),
        this.retryConfig
      );

      if (hasConflicts) {
        return {
          success: false,
          data: null,
          error: {
            code: 'CONFLICT',
            message: 'Scheduling conflict detected',
            details: null
          }
        };
      }

      // Create video conference
      const conferenceDetails = await this.calendarService.createVideoConference({
        title: `Interview: ${params.type}`,
        startTime: scheduledTime,
        duration: params.duration_minutes || this.defaultDuration
      });

      // Create calendar event with conference details
      const calendarEvent = await this.calendarService.createEvent({
        ...validatedParams,
        scheduled_at: scheduledTime,
        meeting_link: conferenceDetails.meetingLink,
        calendar_event_id: conferenceDetails.eventId
      });

      if (!calendarEvent.success) {
        throw new Error('Failed to create calendar event');
      }

      // Prepare interview data
      const interview: Interview = {
        ...validatedParams,
        id: crypto.randomUUID(),
        status: InterviewStatus.SCHEDULED,
        created_at: new Date(),
        updated_at: new Date(),
        scheduled_at: scheduledTime,
        meeting_link: conferenceDetails.meetingLink,
        calendar_event_id: calendarEvent.data!.eventId,
        calendar_metadata: {
          event_id: calendarEvent.data!.eventId,
          attendees: calendarEvent.data!.attendees,
          reminders: [
            { type: 'email', minutes_before: 60 },
            { type: 'notification', minutes_before: 15 }
          ]
        },
        feedback: []
      };

      // Emit real-time update
      this.socket.emit('interview:scheduled', {
        interview_id: interview.id,
        status: interview.status,
        scheduled_at: interview.scheduled_at
      });

      return {
        success: true,
        data: interview,
        error: null
      };

    } catch (error) {
      console.error('Interview scheduling failed:', error);
      return {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to schedule interview',
          details: { error: error.message }
        }
      };
    }
  }

  /**
   * Reschedules an existing interview with conflict detection
   */
  async rescheduleInterview(
    interviewId: string,
    params: Partial<InterviewScheduleParams>
  ): Promise<ApiResponse<Interview>> {
    try {
      // Validate update parameters
      const validatedParams = interviewSchema.partial().parse(params);

      // Update calendar event with retry mechanism
      const calendarUpdate = await retry(
        async () => this.calendarService.updateEvent(params.calendar_event_id!, {
          ...validatedParams,
          scheduled_at: params.scheduled_at!
        }),
        this.retryConfig
      );

      if (!calendarUpdate.success) {
        throw new Error('Failed to update calendar event');
      }

      // Update interview data
      const updatedInterview: Partial<Interview> = {
        ...validatedParams,
        updated_at: new Date(),
        status: InterviewStatus.RESCHEDULED,
        calendar_metadata: {
          event_id: calendarUpdate.data!.eventId,
          attendees: calendarUpdate.data!.attendees,
          reminders: [
            { type: 'email', minutes_before: 60 },
            { type: 'notification', minutes_before: 15 }
          ]
        }
      };

      // Emit real-time update
      this.socket.emit('interview:rescheduled', {
        interview_id: interviewId,
        status: updatedInterview.status,
        scheduled_at: updatedInterview.scheduled_at
      });

      return {
        success: true,
        data: updatedInterview as Interview,
        error: null
      };

    } catch (error) {
      console.error('Interview rescheduling failed:', error);
      return {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reschedule interview',
          details: { error: error.message }
        }
      };
    }
  }

  /**
   * Checks for scheduling conflicts among participants
   */
  private async checkSchedulingConflicts(
    startTime: Date,
    duration: number,
    participantIds: string[]
  ): Promise<boolean> {
    const endTime = dayjs(startTime)
      .add(duration + this.bufferMinutes, 'minutes')
      .toDate();

    const availabilityCheck = await this.calendarService.getAvailableSlots(
      startTime,
      endTime,
      participantIds,
      this.timezone
    );

    return !availabilityCheck.success || availabilityCheck.data!.length === 0;
  }
}