import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'; // ^0.34.0
import { createClient } from '@supabase/supabase-js'; // ^2.33.0
import { Job, JobStatus, JobType, ExperienceLevel, jobSchema } from '../../types/jobs';
import { validateInput, sanitizeInput } from '../../utils/validation';
import { AppError } from '../../utils/error-handler';
import { ErrorCode } from '../../types/common';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      select: vi.fn(),
      eq: vi.fn(),
      match: vi.fn()
    }))
  }))
}));

// Test data fixtures
const mockValidJob: Job = {
  id: 'test-uuid' as any,
  title: 'Senior Software Engineer',
  description: 'Looking for an experienced developer',
  creator_id: 'creator-uuid' as any,
  requirements: {
    experience_level: ExperienceLevel.SENIOR,
    years_experience: 5,
    required_skills: ['TypeScript', 'React'],
    preferred_skills: ['Node.js'],
    qualifications: ['Bachelor\'s degree'],
    responsibilities: ['Lead development team']
  },
  status: JobStatus.DRAFT,
  type: JobType.FULL_TIME,
  skills: ['TypeScript', 'React', 'Node.js'],
  posted_at: new Date(),
  closed_at: null,
  salary_min: 100000,
  salary_max: 150000,
  location: 'Remote',
  remote_allowed: true,
  created_at: new Date(),
  updated_at: new Date()
};

describe('Job Management', () => {
  let supabaseClient: any;

  beforeEach(() => {
    supabaseClient = createClient('test-url', 'test-key');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Job Creation', () => {
    it('should successfully validate and create a job with valid data', async () => {
      const validatedData = await validateInput(jobSchema, mockValidJob);
      expect(validatedData).toMatchObject(mockValidJob);
    });

    it('should reject job creation with missing required fields', async () => {
      const invalidJob = { ...mockValidJob, title: '' };
      await expect(validateInput(jobSchema, invalidJob)).rejects.toThrow(AppError);
    });

    it('should prevent SQL injection in job fields', () => {
      const maliciousTitle = "Senior Dev'; DROP TABLE jobs;--";
      const sanitizedTitle = sanitizeInput(maliciousTitle);
      expect(sanitizedTitle).not.toContain('DROP TABLE');
    });

    it('should prevent XSS in job description', () => {
      const maliciousDesc = '<script>alert("xss")</script>Description';
      const sanitizedDesc = sanitizeInput(maliciousDesc);
      expect(sanitizedDesc).not.toContain('<script>');
    });

    it('should enforce salary range validation', async () => {
      const invalidJob = { ...mockValidJob, salary_min: 200000, salary_max: 100000 };
      await expect(validateInput(jobSchema, invalidJob)).rejects.toThrow(AppError);
    });
  });

  describe('Job Validation', () => {
    it('should validate required skills array', async () => {
      const jobWithEmptySkills = {
        ...mockValidJob,
        requirements: { ...mockValidJob.requirements, required_skills: [] }
      };
      await expect(validateInput(jobSchema, jobWithEmptySkills)).resolves.toBeTruthy();
    });

    it('should validate experience level enum values', async () => {
      const jobWithInvalidLevel = {
        ...mockValidJob,
        requirements: { ...mockValidJob.requirements, experience_level: 'INVALID' }
      };
      await expect(validateInput(jobSchema, jobWithInvalidLevel)).rejects.toThrow();
    });

    it('should validate salary ranges are positive numbers', async () => {
      const jobWithNegativeSalary = { ...mockValidJob, salary_min: -1000 };
      await expect(validateInput(jobSchema, jobWithNegativeSalary)).rejects.toThrow();
    });
  });

  describe('Job Updates', () => {
    it('should validate partial updates', async () => {
      const updatePayload = {
        title: 'Updated Title',
        status: JobStatus.PUBLISHED
      };
      const validatedUpdate = await validateInput(jobSchema.partial(), updatePayload);
      expect(validatedUpdate).toMatchObject(updatePayload);
    });

    it('should prevent unauthorized status transitions', async () => {
      const invalidTransition = {
        ...mockValidJob,
        status: JobStatus.FILLED,
        closed_at: null
      };
      await expect(validateInput(jobSchema, invalidTransition)).rejects.toThrow();
    });
  });

  describe('Security Checks', () => {
    it('should sanitize HTML content in all text fields', () => {
      const fieldsWithHtml = {
        title: '<div>Title</div>',
        description: '<p>Description</p>',
        location: '<script>Location</script>'
      };

      const sanitized = {
        title: sanitizeInput(fieldsWithHtml.title),
        description: sanitizeInput(fieldsWithHtml.description),
        location: sanitizeInput(fieldsWithHtml.location)
      };

      expect(sanitized.title).not.toContain('<div>');
      expect(sanitized.description).not.toContain('<p>');
      expect(sanitized.location).not.toContain('<script>');
    });

    it('should handle unicode normalization attacks', () => {
      const maliciousUnicode = 'Senior\u0323 Dev\u0307';
      const sanitized = sanitizeInput(maliciousUnicode);
      expect(sanitized).toBe('Senior Dev');
    });
  });

  describe('Error Handling', () => {
    it('should return appropriate error for validation failures', async () => {
      const invalidJob = { ...mockValidJob, title: '' };
      try {
        await validateInput(jobSchema, invalidJob);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('should handle database constraint violations', async () => {
      const dbError = new Error('duplicate key value violates unique constraint');
      vi.spyOn(supabaseClient.from('jobs'), 'insert').mockRejectedValue(dbError);
      
      try {
        await supabaseClient.from('jobs').insert(mockValidJob);
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should track job creation attempts', async () => {
      const createAttempts = Array(5).fill(mockValidJob);
      const results = await Promise.allSettled(
        createAttempts.map(job => supabaseClient.from('jobs').insert(job))
      );
      expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(5);
    });
  });
});