import { jest } from 'jest'; // ^29.0.0
import dayjs from 'dayjs'; // ^1.11.0
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { InterviewScheduler } from '../../services/calendar/scheduler';
import { MockGoogleCalendarService } from '../mocks/services';
import { Interview, InterviewType, InterviewMode, InterviewStatus } from '../../types/interviews';
import { ErrorCode } from '../../types/common';

// Configure dayjs for timezone handling
dayjs.extend(utc);
dayjs.extend(timezone);

describe('InterviewScheduler Integration Tests', () => {
  let calendarService: MockGoogleCalendarService;
  let scheduler: InterviewScheduler;
  let testData: TestData;

  // Test data generator class
  class TestData {
    readonly testDate: Date;
    readonly mockVideoLink: string;
    readonly mockEventId: string;
    readonly mockTimezones: string[];

    constructor() {
      this.testDate = new Date();
      this.mockVideoLink = 'https://meet.google.com/mock-link';
      this.mockEventId = 'mock-event-id';
      this.mockTimezones = ['UTC', 'America/New_York', 'Asia/Tokyo'];
    }

    createMockInterview(overrides: Partial<Interview> = {}): Interview {
      return {
        id: 'test-interview-id',
        candidate_id: 'test-candidate-id',
        job_id: 'test-job-id',
        type: InterviewType.TECHNICAL,
        status: InterviewStatus.SCHEDULED,
        mode: InterviewMode.VIDEO,
        scheduled_at: this.testDate,
        duration_minutes: 60,
        interviewer_ids: ['interviewer-1', 'interviewer-2'],
        meeting_link: this.mockVideoLink,
        calendar_event_id: this.mockEventId,
        candidate_confirmed: true,
        interviewers_confirmed: true,
        created_at: new Date(),
        updated_at: new Date(),
        feedback: [],
        ...overrides
      };
    }
  }

  beforeEach(() => {
    // Initialize test dependencies
    calendarService = new MockGoogleCalendarService();
    scheduler = new InterviewScheduler(calendarService as any, {
      defaultDuration: 60,
      bufferMinutes: 15,
      timezone: 'UTC',
      retryConfig: {
        retries: 3,
        retryDelay: 1000,
        retryCondition: (error: any) => error.code === ErrorCode.SERVICE_UNAVAILABLE
      }
    });
    testData = new TestData();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('scheduleInterview', () => {
    it('should successfully schedule an interview with calendar event creation', async () => {
      const interview = testData.createMockInterview();
      
      const result = await scheduler.scheduleInterview({
        candidate_id: interview.candidate_id,
        job_id: interview.job_id,
        type: interview.type,
        mode: interview.mode,
        scheduled_at: interview.scheduled_at,
        duration_minutes: interview.duration_minutes,
        interviewer_ids: interview.interviewer_ids
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.calendar_event_id).toBe(testData.mockEventId);
      expect(result.data?.meeting_link).toBe(testData.mockVideoLink);
      
      const calendarCalls = calendarService.getCallHistory('createEvent');
      expect(calendarCalls.length).toBe(1);
      expect(calendarCalls[0].args.interview.scheduled_at).toEqual(interview.scheduled_at);
    });

    it('should handle timezone conversions correctly', async () => {
      const tzDate = dayjs().tz('America/New_York').toDate();
      const interview = testData.createMockInterview({ scheduled_at: tzDate });
      
      const result = await scheduler.scheduleInterview({
        ...interview,
        timezone: 'America/New_York'
      });

      expect(result.success).toBe(true);
      const calendarCalls = calendarService.getCallHistory('createEvent');
      expect(calendarCalls[0].args.interview.timezone).toBe('America/New_York');
    });

    it('should handle scheduling conflicts appropriately', async () => {
      calendarService.setErrorScenario('getAvailableSlots');
      
      const interview = testData.createMockInterview();
      const result = await scheduler.scheduleInterview({
        ...interview,
        scheduled_at: new Date()
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONFLICT');
    });

    it('should retry on temporary failures', async () => {
      calendarService.setErrorScenario('createEvent');
      const interview = testData.createMockInterview();
      
      const result = await scheduler.scheduleInterview({
        ...interview,
        scheduled_at: new Date()
      });

      expect(result.success).toBe(false);
      const calendarCalls = calendarService.getCallHistory('createEvent');
      expect(calendarCalls.length).toBeGreaterThan(1);
    });
  });

  describe('rescheduleInterview', () => {
    it('should successfully update existing calendar event', async () => {
      const originalInterview = testData.createMockInterview();
      const newDate = dayjs(originalInterview.scheduled_at).add(1, 'day').toDate();
      
      const result = await scheduler.rescheduleInterview(originalInterview.id, {
        scheduled_at: newDate,
        duration_minutes: 90
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(InterviewStatus.RESCHEDULED);
      
      const calendarCalls = calendarService.getCallHistory('updateEvent');
      expect(calendarCalls.length).toBe(1);
      expect(calendarCalls[0].args.interview.scheduled_at).toEqual(newDate);
    });

    it('should handle update conflicts and validation', async () => {
      calendarService.setErrorScenario('updateEvent');
      const interview = testData.createMockInterview();
      
      const result = await scheduler.rescheduleInterview(interview.id, {
        scheduled_at: new Date()
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('findAvailableSlots', () => {
    it('should return available time slots for all participants', async () => {
      const startDate = new Date();
      const endDate = dayjs(startDate).add(1, 'day').toDate();
      const participants = ['user1@test.com', 'user2@test.com'];

      const result = await scheduler.findAvailableSlots(
        startDate,
        endDate,
        participants
      );

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      
      const calendarCalls = calendarService.getCallHistory('getAvailableSlots');
      expect(calendarCalls[0].args.attendeeEmails).toEqual(participants);
    });

    it('should handle calendar API errors gracefully', async () => {
      calendarService.setErrorScenario('getAvailableSlots');
      
      const result = await scheduler.findAvailableSlots(
        new Date(),
        dayjs().add(1, 'day').toDate(),
        ['user@test.com']
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTERNAL_ERROR');
    });
  });

  afterEach(() => {
    calendarService.clearErrorScenarios();
    calendarService.resetMocks();
  });
});