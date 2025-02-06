import { jest } from 'jest'; // ^29.0.0
import nodemailer from 'nodemailer'; // ^6.9.4
import { EmailSender } from '../../services/email/sender';
import { InterviewEmailTemplate } from '../../services/email/templates/interview';
import { MockEmailService } from '../mocks/services';
import { InterviewType, Interview } from '../../types/interviews';
import { ErrorCode } from '../../types/common';

describe('Email Service Integration Tests', () => {
  let emailService: EmailSender;
  let mockEmailService: MockEmailService;
  let emailTemplate: InterviewEmailTemplate;
  let smtpServer: nodemailer.Transporter;

  // Test data fixtures
  const testData = {
    interview: {
      id: 'test-interview-id',
      type: InterviewType.TECHNICAL,
      scheduled_at: new Date('2024-01-01T10:00:00Z'),
      duration_minutes: 60,
      meeting_link: 'https://meet.google.com/test-link',
      location: {
        building: 'Tech Hub',
        floor: '4',
        room: '401',
        address: '123 Innovation St'
      }
    } as Interview,
    participants: {
      candidate: {
        name: 'John Doe',
        email: 'john.doe@example.com'
      },
      interviewers: [
        {
          name: 'Jane Smith',
          email: 'jane.smith@hotgigs.io'
        }
      ]
    }
  };

  beforeAll(async () => {
    // Initialize email template service with test configuration
    emailTemplate = new InterviewEmailTemplate({
      locale: 'en',
      timezone: 'UTC',
      templatePaths: {
        schedule: {
          html: '<html><body>Interview scheduled for {{date}}</body></html>',
          text: 'Interview scheduled for {{date}}'
        },
        update: {
          html: '<html><body>Interview updated: {{changes}}</body></html>',
          text: 'Interview updated: {{changes}}'
        },
        reminder: {
          html: '<html><body>Reminder: Interview in {{time_until}} hours</body></html>',
          text: 'Reminder: Interview in {{time_until}} hours'
        },
        cancellation: {
          html: '<html><body>Interview cancelled: {{reason}}</body></html>',
          text: 'Interview cancelled: {{reason}}'
        }
      }
    });

    // Initialize mock SMTP server
    smtpServer = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'test@ethereal.email',
        pass: 'testpass'
      }
    });

    // Initialize email services
    emailService = new EmailSender();
    mockEmailService = new MockEmailService();
  });

  afterAll(async () => {
    await smtpServer.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmailService.resetMocks();
  });

  describe('Interview Schedule Email Tests', () => {
    it('should generate and send interview schedule email successfully', async () => {
      // Generate email content
      const emailContent = await emailTemplate.generateScheduleEmail(
        testData.interview,
        testData.participants
      );

      // Verify email content structure
      expect(emailContent).toHaveProperty('html');
      expect(emailContent).toHaveProperty('text');
      expect(emailContent).toHaveProperty('calendarEvent');

      // Send email
      const result = await emailService.sendEmail({
        to: testData.participants.candidate.email,
        subject: 'Interview Scheduled',
        html: emailContent.html,
        text: emailContent.text,
        calendarEvent: emailContent.calendarEvent
      });

      expect(result).toBe(true);
    });

    it('should handle HTML template rendering with responsive design', async () => {
      const emailContent = await emailTemplate.generateScheduleEmail(
        testData.interview,
        testData.participants
      );

      expect(emailContent.html).toContain('<!DOCTYPE html>');
      expect(emailContent.html).toContain('@media');
      expect(emailContent.html).toContain('viewport');
    });

    it('should include all required interview details in email', async () => {
      const emailContent = await emailTemplate.generateScheduleEmail(
        testData.interview,
        testData.participants
      );

      expect(emailContent.text).toContain(testData.interview.meeting_link);
      expect(emailContent.text).toContain(testData.participants.candidate.name);
      expect(emailContent.text).toContain('Technical Interview');
    });
  });

  describe('Interview Update Email Tests', () => {
    it('should generate and send interview update email with changes', async () => {
      const updatedInterview = {
        ...testData.interview,
        scheduled_at: new Date('2024-01-02T11:00:00Z'),
        duration_minutes: 90
      };

      const emailContent = await emailTemplate.generateUpdateEmail(
        updatedInterview,
        testData.interview,
        testData.participants
      );

      expect(emailContent.text).toContain('changed from');
      expect(emailContent.text).toContain('90 minutes');

      const result = await emailService.sendEmail({
        to: testData.participants.candidate.email,
        subject: 'Interview Updated',
        html: emailContent.html,
        text: emailContent.text,
        calendarEvent: emailContent.calendarEvent
      });

      expect(result).toBe(true);
    });

    it('should track multiple changes in update email', async () => {
      const updatedInterview = {
        ...testData.interview,
        scheduled_at: new Date('2024-01-02T11:00:00Z'),
        duration_minutes: 90,
        meeting_link: 'https://meet.google.com/new-link'
      };

      const emailContent = await emailTemplate.generateUpdateEmail(
        updatedInterview,
        testData.interview,
        testData.participants
      );

      expect(emailContent.text).toContain('scheduled_at');
      expect(emailContent.text).toContain('duration_minutes');
      expect(emailContent.text).toContain('meeting_link');
    });
  });

  describe('Bulk Email Delivery Tests', () => {
    it('should send bulk emails with rate limiting', async () => {
      const recipients = Array(5).fill(null).map((_, i) => ({
        to: `test${i}@example.com`,
        subject: 'Test Bulk Email',
        html: '<p>Test content</p>',
        text: 'Test content'
      }));

      const results = await emailService.sendBulkEmails(recipients);

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle partial failures in bulk sending', async () => {
      mockEmailService.setErrorScenario('sendEmail');

      const recipients = Array(3).fill(null).map((_, i) => ({
        to: `test${i}@example.com`,
        subject: 'Test Bulk Email',
        html: '<p>Test content</p>',
        text: 'Test content'
      }));

      const results = await mockEmailService.sendBulkEmails(recipients);

      expect(results.some(r => !r.success)).toBe(true);
      expect(results.some(r => r.error)).toBe(true);
    });
  });

  describe('Email Delivery Retry Tests', () => {
    it('should retry failed email delivery attempts', async () => {
      mockEmailService.setErrorScenario('sendEmail');
      
      const emailContent = await emailTemplate.generateScheduleEmail(
        testData.interview,
        testData.participants
      );

      try {
        await mockEmailService.sendEmail({
          to: testData.participants.candidate.email,
          subject: 'Interview Scheduled',
          html: emailContent.html,
          text: emailContent.text
        });
      } catch (error) {
        expect(error.code).toBe(ErrorCode.EMAIL_DELIVERY_FAILED);
        const callHistory = mockEmailService.getCallHistory('sendEmail');
        expect(callHistory.length).toBeGreaterThan(1); // Verify retries
      }
    });

    it('should handle permanent delivery failures', async () => {
      mockEmailService.setErrorScenario('sendEmail');

      const emailContent = await emailTemplate.generateScheduleEmail(
        testData.interview,
        testData.participants
      );

      try {
        await mockEmailService.sendEmail({
          to: 'invalid@example.com',
          subject: 'Interview Scheduled',
          html: emailContent.html,
          text: emailContent.text
        });
      } catch (error) {
        expect(error.code).toBe(ErrorCode.EMAIL_DELIVERY_FAILED);
      }
    });
  });

  describe('Email Template Rendering Tests', () => {
    it('should render templates with correct localization', async () => {
      const emailContent = await emailTemplate.generateScheduleEmail(
        testData.interview,
        testData.participants
      );

      expect(emailContent.text).toContain('Technical Interview');
      expect(emailContent.html).toContain('Technical Interview');
    });

    it('should handle template variable interpolation', async () => {
      const emailContent = await emailTemplate.generateScheduleEmail(
        testData.interview,
        testData.participants
      );

      expect(emailContent.text).toContain(testData.participants.candidate.name);
      expect(emailContent.text).toContain(testData.interview.meeting_link);
    });

    it('should generate accessible HTML email content', async () => {
      const emailContent = await emailTemplate.generateScheduleEmail(
        testData.interview,
        testData.participants
      );

      expect(emailContent.html).toContain('role="presentation"');
      expect(emailContent.html).toContain('aria-label');
    });
  });
});