import { calendar_v3, google } from '@googleapis/calendar'; // ^7.0.0
import { OAuth2Client } from 'google-auth-library'; // ^9.0.0
import { retry } from 'retry-axios'; // ^3.0.0
import { Interview, InterviewType } from '../../types/interviews';
import { ApiResponse } from '../../types/common';

// Types for calendar service configuration and responses
interface CalendarConfig {
  maxRetries: number;
  quotaLimit: number;
  timeoutMs: number;
}

interface CalendarEventResponse {
  eventId: string;
  meetingLink?: string;
  attendees: string[];
  startTime: Date;
  endTime: Date;
}

interface AvailableSlot {
  startTime: Date;
  endTime: Date;
  attendees: string[];
  timezone: string;
}

/**
 * Service class for managing Google Calendar operations with comprehensive error handling
 * and retry mechanisms for the HotGigs platform interview scheduling system.
 */
export class GoogleCalendarService {
  private auth: OAuth2Client;
  private calendar: calendar_v3.Calendar;
  private readonly maxRetries: number;
  private readonly quotaLimit: number;

  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    config: CalendarConfig
  ) {
    // Initialize OAuth2 client
    this.auth = new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri
    });

    // Configure calendar service with retry mechanism
    this.calendar = google.calendar({
      version: 'v3',
      auth: this.auth,
      retry: {
        retries: config.maxRetries,
        statusCodesToRetry: [[429, 429], [500, 599]],
        onRetryAttempt: (err) => {
          console.warn(`Retrying calendar API request: ${err.message}`);
        }
      }
    });

    this.maxRetries = config.maxRetries;
    this.quotaLimit = config.quotaLimit;
  }

  /**
   * Creates a new calendar event for an interview with video conferencing support
   */
  async createEvent(interview: Interview): Promise<ApiResponse<CalendarEventResponse>> {
    try {
      // Validate interview details
      if (!interview.scheduled_at || !interview.duration_minutes || !interview.attendees) {
        return {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid interview details',
            details: null
          }
        };
      }

      // Calculate end time
      const startTime = new Date(interview.scheduled_at);
      const endTime = new Date(startTime.getTime() + interview.duration_minutes * 60000);

      // Prepare event details
      const event = {
        summary: `Interview: ${InterviewType[interview.type]}`,
        description: `HotGigs Platform Interview`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: interview.timezone
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: interview.timezone
        },
        attendees: interview.attendees.map(email => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `hotgigs-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 15 }
          ]
        }
      };

      // Create calendar event
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        requestBody: event
      });

      if (!response.data) {
        throw new Error('Failed to create calendar event');
      }

      return {
        success: true,
        data: {
          eventId: response.data.id!,
          meetingLink: response.data.conferenceData?.entryPoints?.[0]?.uri,
          attendees: response.data.attendees?.map(a => a.email!) || [],
          startTime,
          endTime
        },
        error: null
      };

    } catch (error) {
      console.error('Calendar event creation failed:', error);
      return {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create calendar event',
          details: { error: error.message }
        }
      };
    }
  }

  /**
   * Updates an existing calendar event with comprehensive error handling
   */
  async updateEvent(eventId: string, interview: Interview): Promise<ApiResponse<CalendarEventResponse>> {
    try {
      const startTime = new Date(interview.scheduled_at);
      const endTime = new Date(startTime.getTime() + interview.duration_minutes * 60000);

      const event = {
        summary: `Interview: ${InterviewType[interview.type]}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: interview.timezone
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: interview.timezone
        },
        attendees: interview.attendees.map(email => ({ email }))
      };

      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: event,
        sendUpdates: 'all'
      });

      if (!response.data) {
        throw new Error('Failed to update calendar event');
      }

      return {
        success: true,
        data: {
          eventId: response.data.id!,
          meetingLink: response.data.conferenceData?.entryPoints?.[0]?.uri,
          attendees: response.data.attendees?.map(a => a.email!) || [],
          startTime,
          endTime
        },
        error: null
      };

    } catch (error) {
      console.error('Calendar event update failed:', error);
      return {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update calendar event',
          details: { error: error.message }
        }
      };
    }
  }

  /**
   * Deletes a calendar event with notification handling
   */
  async deleteEvent(eventId: string, notifyAttendees: boolean = true): Promise<ApiResponse<boolean>> {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId,
        sendUpdates: notifyAttendees ? 'all' : 'none'
      });

      return {
        success: true,
        data: true,
        error: null
      };

    } catch (error) {
      console.error('Calendar event deletion failed:', error);
      return {
        success: false,
        data: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete calendar event',
          details: { error: error.message }
        }
      };
    }
  }

  /**
   * Retrieves available time slots with advanced filtering and timezone support
   */
  async getAvailableSlots(
    startDate: Date,
    endDate: Date,
    attendeeEmails: string[],
    timezone: string
  ): Promise<ApiResponse<AvailableSlot[]>> {
    try {
      const freeBusyRequest = {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        timeZone: timezone,
        items: attendeeEmails.map(email => ({ id: email }))
      };

      const response = await this.calendar.freebusy.query({
        requestBody: freeBusyRequest
      });

      if (!response.data || !response.data.calendars) {
        throw new Error('Failed to retrieve free/busy information');
      }

      const busySlots = Object.values(response.data.calendars)
        .flatMap(calendar => calendar.busy || []);

      // Calculate available slots by finding gaps between busy periods
      const availableSlots: AvailableSlot[] = [];
      let currentTime = new Date(startDate);

      busySlots.sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime());

      for (const busy of busySlots) {
        const busyStart = new Date(busy.start!);
        if (currentTime < busyStart) {
          availableSlots.push({
            startTime: currentTime,
            endTime: busyStart,
            attendees: attendeeEmails,
            timezone
          });
        }
        currentTime = new Date(busy.end!);
      }

      if (currentTime < endDate) {
        availableSlots.push({
          startTime: currentTime,
          endTime: endDate,
          attendees: attendeeEmails,
          timezone
        });
      }

      return {
        success: true,
        data: availableSlots,
        error: null
      };

    } catch (error) {
      console.error('Failed to retrieve available slots:', error);
      return {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve available time slots',
          details: { error: error.message }
        }
      };
    }
  }
}