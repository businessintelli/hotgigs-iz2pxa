import supertest from 'supertest'; // ^6.3.3
import { jest } from 'jest'; // ^29.0.0
import { mockUsers, mockJobs } from '../mocks/data';
import { MockOpenAIService, MockEmailSender, MockGoogleCalendarService } from '../mocks/services';
import { ErrorCode } from '../../types/common';
import { UserRole } from '../../types/auth';
import { JobStatus } from '../../types/jobs';
import { InterviewType, InterviewStatus } from '../../types/interviews';
import { app } from '../../app';

// Initialize test app and mock services
const testApp = supertest(app);
const mockOpenAI = new MockOpenAIService();
const mockEmail = new MockEmailSender();
const mockCalendar = new MockGoogleCalendarService();

// Test setup and utilities
async function setupTestDatabase(): Promise<void> {
  // Clear existing test data
  await testApp.post('/api/test/reset-db');
  
  // Initialize test data
  await testApp.post('/api/test/seed-data').send({
    users: [mockUsers.adminUser, mockUsers.recruiterUser],
    jobs: [mockJobs.publishedJob, mockJobs.draftJob]
  });
}

async function getAuthToken(user: typeof mockUsers.adminUser): Promise<string> {
  const response = await testApp
    .post('/api/auth/login')
    .send({
      email: user.email,
      password: 'test_password',
      device_id: 'test_device'
    });

  return response.body.data.access_token;
}

describe('API Integration Tests', () => {
  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    await setupTestDatabase();
  });

  describe('Authentication API', () => {
    describe('POST /api/auth/login', () => {
      it('should successfully login with valid credentials', async () => {
        const response = await testApp
          .post('/api/auth/login')
          .send({
            email: mockUsers.recruiterUser.email,
            password: 'test_password',
            device_id: 'test_device'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('access_token');
        expect(response.body.data).toHaveProperty('refresh_token');
      });

      it('should fail with invalid credentials', async () => {
        const response = await testApp
          .post('/api/auth/login')
          .send({
            email: mockUsers.recruiterUser.email,
            password: 'wrong_password',
            device_id: 'test_device'
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
      });

      it('should enforce rate limiting', async () => {
        const attempts = Array(6).fill(null).map(() => 
          testApp
            .post('/api/auth/login')
            .send({
              email: mockUsers.recruiterUser.email,
              password: 'test_password',
              device_id: 'test_device'
            })
        );

        const responses = await Promise.all(attempts);
        const lastResponse = responses[responses.length - 1];

        expect(lastResponse.status).toBe(429);
        expect(lastResponse.body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      });
    });

    describe('POST /api/auth/refresh', () => {
      it('should refresh access token with valid refresh token', async () => {
        // First login to get tokens
        const loginResponse = await testApp
          .post('/api/auth/login')
          .send({
            email: mockUsers.recruiterUser.email,
            password: 'test_password',
            device_id: 'test_device'
          });

        const refreshToken = loginResponse.body.data.refresh_token;

        const response = await testApp
          .post('/api/auth/refresh')
          .send({ refresh_token: refreshToken });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('access_token');
      });
    });
  });

  describe('Jobs API', () => {
    let authToken: string;

    beforeEach(async () => {
      authToken = await getAuthToken(mockUsers.recruiterUser);
    });

    describe('POST /api/jobs', () => {
      it('should create a new job posting', async () => {
        const jobData = {
          title: 'Senior Software Engineer',
          description: 'Looking for an experienced engineer...',
          requirements: {
            experience_level: 'SENIOR',
            years_experience: 5,
            required_skills: ['TypeScript', 'React', 'Node.js'],
            preferred_skills: ['AWS', 'Docker'],
            qualifications: ['Bachelor\'s in Computer Science'],
            responsibilities: ['Lead development of core features']
          },
          type: 'FULL_TIME',
          location: 'New York, NY',
          remote_allowed: true,
          salary_min: 120000,
          salary_max: 180000
        };

        const response = await testApp
          .post('/api/jobs')
          .set('Authorization', `Bearer ${authToken}`)
          .send(jobData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          title: jobData.title,
          status: JobStatus.DRAFT
        });
      });

      it('should validate required job fields', async () => {
        const response = await testApp
          .post('/api/jobs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      });
    });

    describe('GET /api/jobs', () => {
      it('should return paginated job listings', async () => {
        const response = await testApp
          .get('/api/jobs')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            page: 1,
            limit: 10,
            status: [JobStatus.PUBLISHED]
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.jobs)).toBe(true);
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('total_pages');
      });

      it('should filter jobs by search criteria', async () => {
        const response = await testApp
          .get('/api/jobs')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            page: 1,
            limit: 10,
            query: 'TypeScript',
            location: 'New York'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.jobs)).toBe(true);
      });
    });
  });

  describe('Interviews API', () => {
    let authToken: string;

    beforeEach(async () => {
      authToken = await getAuthToken(mockUsers.recruiterUser);
    });

    describe('POST /api/interviews', () => {
      it('should schedule a new interview', async () => {
        const interviewData = {
          candidate_id: 'test-candidate-id',
          job_id: mockJobs.publishedJob.id,
          type: InterviewType.TECHNICAL,
          mode: 'VIDEO',
          scheduled_at: new Date(Date.now() + 86400000).toISOString(),
          duration_minutes: 60,
          interviewer_ids: ['test-interviewer-id'],
          calendar_preferences: {
            send_calendar_invites: true,
            reminder_times: [15, 60],
            include_meeting_link: true
          }
        };

        const response = await testApp
          .post('/api/interviews')
          .set('Authorization', `Bearer ${authToken}`)
          .send(interviewData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          status: InterviewStatus.SCHEDULED,
          type: InterviewType.TECHNICAL
        });
      });

      it('should handle calendar integration errors gracefully', async () => {
        mockCalendar.setErrorScenario('createEvent');

        const response = await testApp
          .post('/api/interviews')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            // ... interview data
          });

        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      });
    });

    describe('GET /api/interviews/{id}/feedback', () => {
      it('should retrieve interview feedback', async () => {
        const response = await testApp
          .get('/api/interviews/test-interview-id/feedback')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.feedback)).toBe(true);
      });
    });
  });

  describe('Analytics API', () => {
    let adminToken: string;

    beforeEach(async () => {
      adminToken = await getAuthToken(mockUsers.adminUser);
    });

    describe('GET /api/analytics/recruitment', () => {
      it('should return recruitment analytics for authorized users', async () => {
        const response = await testApp
          .get('/api/analytics/recruitment')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({
            start_date: '2023-01-01',
            end_date: '2023-12-31'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('metrics');
        expect(response.body.data).toHaveProperty('trends');
      });

      it('should enforce role-based access control', async () => {
        const recruiterToken = await getAuthToken(mockUsers.recruiterUser);
        
        const response = await testApp
          .get('/api/analytics/recruitment')
          .set('Authorization', `Bearer ${recruiterToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe(ErrorCode.FORBIDDEN);
      });
    });
  });
});