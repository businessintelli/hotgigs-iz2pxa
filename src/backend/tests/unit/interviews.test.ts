import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.7.0
import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import { scheduleInterviewHandler } from '../../edge-functions/interviews/schedule';
import { updateInterview } from '../../edge-functions/interviews/update';
import { Interview, InterviewType, InterviewStatus, InterviewMode } from '../../types/interviews';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

// Mock calendar service
jest.mock('../../services/calendar/scheduler', () => ({
  InterviewScheduler: jest.fn().mockImplementation(() => ({
    scheduleInterview: jest.fn(),
    rescheduleInterview: jest.fn(),
    checkSchedulingConflicts: jest.fn()
  }))
}));

// Mock email service
jest.mock('../../services/email/sender', () => ({
  EmailSender: jest.fn().mockImplementation(() => ({
    sendBulkEmails: jest.fn()
  }))
}));

describe('Interview Management', () => {
  let mockSupabaseClient: any;
  let mockRequest: Partial<Request>;
  
  const mockInterviewData = {
    id: 'test-interview-id',
    candidate_id: 'test-candidate-id',
    job_id: 'test-job-id',
    type: InterviewType.TECHNICAL,
    status: InterviewStatus.SCHEDULED,
    mode: InterviewMode.VIDEO,
    scheduled_at: new Date('2024-01-01T10:00:00Z'),
    duration_minutes: 60,
    interviewer_ids: ['interviewer-1', 'interviewer-2'],
    meeting_link: 'https://meet.google.com/test',
    calendar_event_id: 'calendar-event-1',
    candidate_confirmed: false,
    interviewers_confirmed: false,
    feedback: [],
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup Supabase mock
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn()
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

    // Setup mock request
    mockRequest = {
      headers: new Headers({
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }),
      json: jest.fn()
    };
  });

  describe('Interview Scheduling', () => {
    it('should successfully schedule interview with valid data', async () => {
      // Setup mock data
      const scheduleData = {
        candidateId: mockInterviewData.candidate_id,
        jobId: mockInterviewData.job_id,
        type: mockInterviewData.type,
        scheduledAt: mockInterviewData.scheduled_at.toISOString(),
        durationMinutes: mockInterviewData.duration_minutes,
        interviewerIds: mockInterviewData.interviewer_ids,
        mode: mockInterviewData.mode
      };

      mockRequest.json = jest.fn().mockResolvedValue(scheduleData);
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'test-candidate', email: 'candidate@test.com', full_name: 'Test Candidate' },
        error: null
      });

      const response = await scheduleInterviewHandler(mockRequest as Request);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.error).toBeNull();
    });

    it('should validate required fields for scheduling', async () => {
      const invalidData = {
        candidateId: mockInterviewData.candidate_id,
        // Missing required fields
      };

      mockRequest.json = jest.fn().mockResolvedValue(invalidData);

      const response = await scheduleInterviewHandler(mockRequest as Request);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should handle calendar conflicts appropriately', async () => {
      const scheduleData = {
        ...mockInterviewData,
        scheduled_at: new Date('2024-01-01T11:00:00Z')
      };

      mockRequest.json = jest.fn().mockResolvedValue(scheduleData);
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Scheduling conflict' }
      });

      const response = await scheduleInterviewHandler(mockRequest as Request);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('CONFLICT');
    });
  });

  describe('Interview Updates', () => {
    it('should successfully update interview status', async () => {
      const updateData = {
        id: mockInterviewData.id,
        status: InterviewStatus.CONFIRMED
      };

      mockRequest.json = jest.fn().mockResolvedValue(updateData);
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { ...mockInterviewData },
        error: null
      });

      const response = await updateInterview(mockRequest as Request);

      expect(response.success).toBe(true);
      expect(response.data?.status).toBe(InterviewStatus.CONFIRMED);
    });

    it('should handle rescheduling with calendar sync', async () => {
      const newScheduleTime = new Date('2024-01-02T10:00:00Z');
      const updateData = {
        id: mockInterviewData.id,
        scheduled_at: newScheduleTime
      };

      mockRequest.json = jest.fn().mockResolvedValue(updateData);
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { ...mockInterviewData },
        error: null
      });

      const response = await updateInterview(mockRequest as Request);

      expect(response.success).toBe(true);
      expect(response.data?.scheduled_at).toEqual(newScheduleTime);
    });

    it('should validate update permissions', async () => {
      const updateData = {
        id: mockInterviewData.id,
        status: InterviewStatus.CANCELLED
      };

      mockRequest.json = jest.fn().mockResolvedValue(updateData);
      mockRequest.headers = new Headers(); // No auth header

      const response = await updateInterview(mockRequest as Request);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Interview Feedback', () => {
    it('should validate feedback submission structure', async () => {
      const feedbackData = {
        id: mockInterviewData.id,
        feedback: [{
          interviewer_id: 'interviewer-1',
          rating: 4,
          comments: 'Good technical skills'
        }]
      };

      mockRequest.json = jest.fn().mockResolvedValue(feedbackData);
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { ...mockInterviewData },
        error: null
      });

      const response = await updateInterview(mockRequest as Request);

      expect(response.success).toBe(true);
      expect(response.data?.feedback).toBeDefined();
    });

    it('should handle multiple interviewer feedback', async () => {
      const feedbackData = {
        id: mockInterviewData.id,
        feedback: [
          {
            interviewer_id: 'interviewer-1',
            rating: 4,
            comments: 'Good technical skills'
          },
          {
            interviewer_id: 'interviewer-2',
            rating: 5,
            comments: 'Excellent communication'
          }
        ]
      };

      mockRequest.json = jest.fn().mockResolvedValue(feedbackData);
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { ...mockInterviewData },
        error: null
      });

      const response = await updateInterview(mockRequest as Request);

      expect(response.success).toBe(true);
      expect(response.data?.feedback).toHaveLength(2);
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });
});