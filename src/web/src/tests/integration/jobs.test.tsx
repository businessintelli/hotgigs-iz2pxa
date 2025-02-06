import { render, screen } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { describe, it, expect, beforeEach, afterEach } from 'vitest'; // ^0.34.0
import { createJob, updateJob, deleteJob, searchJobs, matchCandidates } from '../../lib/api/jobs';
import { mockJobs, generateMockJob } from '../mocks/data';
import { JobStatus, JobType, ExperienceLevel } from '../../types/jobs';
import { ErrorCode } from '../../types/common';

// MSW handlers for API mocking
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  // Mock job creation endpoint
  rest.post('/api/jobs', async (req, res, ctx) => {
    const jobData = await req.json();
    if (!jobData.title) {
      return res(
        ctx.status(400),
        ctx.json({
          error: 'Validation Error',
          code: ErrorCode.VALIDATION_ERROR,
          details: { title: ['Title is required'] }
        })
      );
    }
    return res(ctx.json({ data: { ...jobData, id: crypto.randomUUID() } }));
  }),

  // Mock job search endpoint
  rest.get('/api/jobs/search', (req, res, ctx) => {
    const query = req.url.searchParams.get('query') || '';
    const filteredJobs = mockJobs.filter(job => 
      job.title.toLowerCase().includes(query.toLowerCase())
    );
    return res(ctx.json({
      data: filteredJobs,
      total: filteredJobs.length,
      page: 1,
      limit: 20
    }));
  }),

  // Mock AI matching endpoint
  rest.post('/api/jobs/:jobId/match', (req, res, ctx) => {
    const { jobId } = req.params;
    return res(ctx.json({
      data: {
        candidates: [
          { id: crypto.randomUUID(), score: 0.85 },
          { id: crypto.randomUUID(), score: 0.75 }
        ]
      }
    }));
  })
);

describe('Job Management Integration Tests', () => {
  beforeEach(() => {
    server.listen();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    server.close();
    server.resetHandlers();
  });

  describe('Job Creation', () => {
    it('should successfully create a new job posting', async () => {
      const jobData = generateMockJob({
        title: 'Senior React Developer',
        type: JobType.FULL_TIME,
        experience_level: ExperienceLevel.SENIOR
      });

      const { data, error } = await createJob(jobData);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.title).toBe('Senior React Developer');
      expect(data?.type).toBe(JobType.FULL_TIME);
    });

    it('should handle validation errors during job creation', async () => {
      const invalidJobData = generateMockJob({ title: '' });

      const { data, error } = await createJob(invalidJobData);

      expect(data).toBeNull();
      expect(error).toBeDefined();
      expect(error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should enforce required fields validation', async () => {
      const incompleteJobData = generateMockJob();
      delete (incompleteJobData as any).requirements;

      const { data, error } = await createJob(incompleteJobData);

      expect(data).toBeNull();
      expect(error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('Job Search', () => {
    it('should return filtered results based on search criteria', async () => {
      const searchParams = {
        query: 'React',
        status: [JobStatus.PUBLISHED],
        type: [JobType.FULL_TIME],
        page: 1,
        limit: 20
      };

      const { data, error } = await searchJobs(searchParams);

      expect(error).toBeNull();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.total).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty search results gracefully', async () => {
      const searchParams = {
        query: 'NonexistentJobTitle123',
        page: 1,
        limit: 20
      };

      const { data, error } = await searchJobs(searchParams);

      expect(error).toBeNull();
      expect(data.data).toHaveLength(0);
      expect(data.total).toBe(0);
    });

    it('should properly handle pagination parameters', async () => {
      const searchParams = {
        page: 2,
        limit: 5
      };

      const { data, error } = await searchJobs(searchParams);

      expect(error).toBeNull();
      expect(data.page).toBe(2);
      expect(data.limit).toBe(5);
    });
  });

  describe('AI-Powered Candidate Matching', () => {
    it('should return matched candidates with scores', async () => {
      const jobId = mockJobs[0].id;

      const { data, error } = await matchCandidates(jobId);

      expect(error).toBeNull();
      expect(data?.candidates).toBeDefined();
      expect(data?.candidates.length).toBeGreaterThan(0);
      expect(data?.candidates[0]).toHaveProperty('score');
    });

    it('should handle invalid job IDs', async () => {
      const invalidJobId = 'invalid-uuid';

      const { data, error } = await matchCandidates(invalidJobId);

      expect(data).toBeNull();
      expect(error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should respect rate limiting', async () => {
      server.use(
        rest.post('/api/jobs/:jobId/match', (req, res, ctx) => {
          return res(
            ctx.status(429),
            ctx.json({
              error: 'Rate limit exceeded',
              code: ErrorCode.RATE_LIMITED
            })
          );
        })
      );

      const jobId = mockJobs[0].id;
      const { data, error } = await matchCandidates(jobId);

      expect(data).toBeNull();
      expect(error?.code).toBe(ErrorCode.RATE_LIMITED);
    });
  });

  describe('Job Updates and Deletion', () => {
    it('should successfully update an existing job', async () => {
      const jobId = mockJobs[0].id;
      const updates = {
        title: 'Updated Job Title',
        status: JobStatus.CLOSED
      };

      server.use(
        rest.patch(`/api/jobs/${jobId}`, (req, res, ctx) => {
          return res(ctx.json({ data: { ...mockJobs[0], ...updates } }));
        })
      );

      const { data, error } = await updateJob(jobId, updates);

      expect(error).toBeNull();
      expect(data?.title).toBe('Updated Job Title');
      expect(data?.status).toBe(JobStatus.CLOSED);
    });

    it('should successfully delete a job', async () => {
      const jobId = mockJobs[0].id;

      server.use(
        rest.delete(`/api/jobs/${jobId}`, (req, res, ctx) => {
          return res(ctx.json({ success: true }));
        })
      );

      const { error } = await deleteJob(jobId);

      expect(error).toBeNull();
    });

    it('should handle unauthorized deletion attempts', async () => {
      const jobId = mockJobs[0].id;

      server.use(
        rest.delete(`/api/jobs/${jobId}`, (req, res, ctx) => {
          return res(
            ctx.status(403),
            ctx.json({
              error: 'Unauthorized',
              code: ErrorCode.FORBIDDEN
            })
          );
        })
      );

      const { error } = await deleteJob(jobId);

      expect(error?.code).toBe(ErrorCode.FORBIDDEN);
    });
  });
});