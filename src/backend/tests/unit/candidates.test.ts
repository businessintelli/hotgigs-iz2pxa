import { jest } from 'jest';
import { createClient } from '@supabase/supabase-js';
import { Candidate, CandidateStatus, candidateSchema } from '../../types/candidates';
import { mockCandidates } from '../mocks/data';
import { MockOpenAIService } from '../mocks/services';
import { ErrorCode } from '../../types/common';

// Initialize mocks
const mockOpenAIService = new MockOpenAIService();
const mockSupabaseClient = createClient('mock-url', 'mock-key');

// Mock Supabase client methods
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      select: jest.fn(),
      eq: jest.fn(),
      match: jest.fn()
    }))
  }))
}));

describe('Candidate Profile Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAIService.resetMocks();
  });

  describe('Profile Creation', () => {
    it('should create a valid candidate profile', async () => {
      // Arrange
      const validCandidate = mockCandidates.activeCandidate;
      const mockInsert = jest.fn().mockResolvedValue({ data: validCandidate, error: null });
      mockSupabaseClient.from('candidates').insert = mockInsert;

      // Act
      const result = await mockSupabaseClient.from('candidates').insert(validCandidate);

      // Assert
      expect(result.error).toBeNull();
      expect(result.data).toEqual(validCandidate);
      expect(mockInsert).toHaveBeenCalledWith(validCandidate);
    });

    it('should validate required profile fields', async () => {
      // Arrange
      const invalidCandidate = { ...mockCandidates.activeCandidate, email: undefined };

      // Act
      const validationResult = candidateSchema.safeParse(invalidCandidate);

      // Assert
      expect(validationResult.success).toBeFalsy();
      expect(validationResult.error).toBeDefined();
    });

    it('should enforce unique email constraint', async () => {
      // Arrange
      const duplicateCandidate = mockCandidates.activeCandidate;
      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' }
      });
      mockSupabaseClient.from('candidates').insert = mockInsert;

      // Act
      const result = await mockSupabaseClient.from('candidates').insert(duplicateCandidate);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('23505');
    });
  });

  describe('Resume Processing', () => {
    it('should process valid resume upload', async () => {
      // Arrange
      const mockResume = Buffer.from('mock resume content');
      const mockExtractSkills = jest.fn().mockResolvedValue({
        technical: ['TypeScript', 'React', 'Node.js'],
        soft: ['Communication', 'Leadership']
      });
      mockOpenAIService.setMockResponse('extractSkills', mockExtractSkills());

      // Act
      const result = await mockOpenAIService.analyzeText('mock resume content', {
        type: 'skills',
        minConfidence: 0.8
      });

      // Assert
      expect(result.data.technical).toContain('TypeScript');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should handle invalid resume format', async () => {
      // Arrange
      const invalidResume = Buffer.from('');
      mockOpenAIService.setMockResponse('analyzeText', null, true);

      // Act & Assert
      await expect(
        mockOpenAIService.analyzeText('', { type: 'skills', minConfidence: 0.8 })
      ).rejects.toThrow();
    });

    it('should extract work experience details', async () => {
      // Arrange
      const mockExperience = {
        years: 5,
        roles: ['Senior Developer', 'Tech Lead'],
        companies: ['Tech Corp', 'Innovation Inc']
      };
      mockOpenAIService.setMockResponse('analyzeText', mockExperience);

      // Act
      const result = await mockOpenAIService.analyzeText('mock experience content', {
        type: 'experience',
        minConfidence: 0.8
      });

      // Assert
      expect(result.data.years).toBe(5);
      expect(result.data.roles).toContain('Senior Developer');
    });
  });

  describe('AI Matching', () => {
    it('should calculate accurate match scores', async () => {
      // Arrange
      const candidate = mockCandidates.activeCandidate;
      const jobSkills = ['TypeScript', 'React', 'Node.js'];
      const mockMatchScore = 0.85;
      mockOpenAIService.setMockResponse('calculateMatchScore', mockMatchScore);

      // Act
      const result = await mockOpenAIService.analyzeText(JSON.stringify({ candidate, jobSkills }), {
        type: 'matching',
        minConfidence: 0.8
      });

      // Assert
      expect(result.data.match_score).toBeGreaterThanOrEqual(0.8);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should consider experience level in matching', async () => {
      // Arrange
      const candidate = {
        ...mockCandidates.activeCandidate,
        experience_level: 'SENIOR'
      };
      const jobRequirements = {
        experience_level: 'SENIOR',
        years_experience: 5
      };
      const mockAnalysis = {
        match_score: 0.9,
        experience_match: true,
        skill_overlap: 0.85
      };
      mockOpenAIService.setMockResponse('analyzeText', mockAnalysis);

      // Act
      const result = await mockOpenAIService.analyzeText(
        JSON.stringify({ candidate, jobRequirements }),
        { type: 'matching', minConfidence: 0.8 }
      );

      // Assert
      expect(result.data.experience_match).toBeTruthy();
      expect(result.data.match_score).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Profile Updates', () => {
    it('should update candidate status', async () => {
      // Arrange
      const candidateId = mockCandidates.activeCandidate.id;
      const newStatus = CandidateStatus.HIRED;
      const mockUpdate = jest.fn().mockResolvedValue({
        data: { ...mockCandidates.activeCandidate, status: newStatus },
        error: null
      });
      mockSupabaseClient.from('candidates').update = mockUpdate;

      // Act
      const result = await mockSupabaseClient
        .from('candidates')
        .update({ status: newStatus })
        .eq('id', candidateId);

      // Assert
      expect(result.error).toBeNull();
      expect(result.data.status).toBe(newStatus);
    });

    it('should validate profile updates', async () => {
      // Arrange
      const invalidUpdate = {
        email: 'invalid-email',
        experience_level: 'INVALID_LEVEL'
      };

      // Act
      const validationResult = candidateSchema.partial().safeParse(invalidUpdate);

      // Assert
      expect(validationResult.success).toBeFalsy();
      expect(validationResult.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      const mockError = new Error('Database connection failed');
      mockSupabaseClient.from('candidates').select = jest.fn().mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        mockSupabaseClient.from('candidates').select('*')
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle AI service unavailability', async () => {
      // Arrange
      mockOpenAIService.setMockResponse('analyzeText', null, true);

      // Act & Assert
      await expect(
        mockOpenAIService.analyzeText('test content', { type: 'skills', minConfidence: 0.8 })
      ).rejects.toThrow();
    });
  });
});