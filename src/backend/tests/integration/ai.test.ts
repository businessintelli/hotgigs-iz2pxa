import { describe, it, expect, beforeEach, afterEach } from 'jest'; // ^29.0.0
import Redis from 'ioredis'; // ^5.0.0
import { OpenAIService } from '../../services/ai/openai';
import { SkillExtractor } from '../../services/ai/skill-extractor';
import { MatchingService } from '../../services/ai/matching';
import { ResumeParser } from '../../services/ai/resume-parser';
import { aiConfig } from '../../config/ai';
import { Job, JobType, ExperienceLevel } from '../../types/jobs';
import { Candidate, CandidateStatus } from '../../types/candidates';
import { ErrorCode } from '../../types/common';

// Test data fixtures
const mockJob: Job = {
  id: 'job-123',
  title: 'Senior Software Engineer',
  description: 'Looking for an experienced software engineer with strong TypeScript and React skills.',
  creator_id: 'recruiter-123',
  requirements: {
    experience_level: ExperienceLevel.SENIOR,
    years_experience: 5,
    required_skills: ['TypeScript', 'React', 'Node.js'],
    preferred_skills: ['GraphQL', 'AWS'],
    qualifications: ['Bachelor\'s in Computer Science'],
    responsibilities: ['Lead development team', 'Architect solutions']
  },
  status: 'PUBLISHED',
  type: JobType.FULL_TIME,
  skills: ['TypeScript', 'React', 'Node.js', 'GraphQL', 'AWS'],
  posted_at: new Date(),
  closed_at: null,
  salary_min: 120000,
  salary_max: 180000,
  location: 'Remote',
  remote_allowed: true,
  created_at: new Date(),
  updated_at: new Date()
};

const mockResume = `
John Doe
Software Engineer
john@example.com
+1 (555) 123-4567

Experience:
Senior Software Engineer at Tech Corp (2018-Present)
- Led development of React/TypeScript applications
- Managed team of 5 engineers
- Implemented GraphQL APIs

Education:
BS Computer Science, University of Technology (2014-2018)
`;

describe('AI Services Integration Tests', () => {
  let openAIService: OpenAIService;
  let skillExtractor: SkillExtractor;
  let matchingService: MatchingService;
  let resumeParser: ResumeParser;
  let redisClient: Redis;

  beforeEach(async () => {
    // Initialize Redis client with test database
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 15 // Use separate database for testing
    });

    // Initialize services
    openAIService = new OpenAIService(aiConfig.openai);
    skillExtractor = new SkillExtractor(openAIService);
    matchingService = new MatchingService(openAIService, redisClient);
    resumeParser = new ResumeParser(openAIService);

    // Clear test cache
    await redisClient.flushdb();
  });

  afterEach(async () => {
    await redisClient.quit();
  });

  describe('OpenAI Service', () => {
    it('should generate embeddings with caching', async () => {
      const text = 'TypeScript developer with React experience';
      
      // First call should generate new embeddings
      const embeddings1 = await openAIService.generateEmbeddings(text);
      expect(embeddings1).toBeInstanceOf(Array);
      expect(embeddings1.length).toBe(1536); // Ada-002 embedding size

      // Second call should return cached embeddings
      const embeddings2 = await openAIService.generateEmbeddings(text);
      expect(embeddings2).toEqual(embeddings1);
    });

    it('should handle rate limits correctly', async () => {
      const promises = Array(50).fill(null).map(() => 
        openAIService.generateEmbeddings('Test text')
      );

      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      expect(fulfilled.length).toBeGreaterThan(0);
    });

    it('should generate completions with error handling', async () => {
      const prompt = 'Analyze the following skills: TypeScript, React';
      const completion = await openAIService.generateCompletion(prompt);
      
      expect(completion).toBeTruthy();
      expect(typeof completion).toBe('string');
    });
  });

  describe('Skill Extractor', () => {
    it('should extract skills with confidence scores', async () => {
      const result = await skillExtractor.extractSkills(mockResume);

      expect(result.skills).toContainEqual(expect.objectContaining({
        name: 'TypeScript',
        category: expect.any(String),
        confidence: expect.any(Number)
      }));

      expect(result.totalConfidence).toBeGreaterThanOrEqual(0.8);
      expect(result.categoryDistribution).toHaveProperty('Technical');
    });

    it('should validate skill extraction results', async () => {
      const result = await skillExtractor.extractSkills(mockResume, {
        minConfidence: 0.8,
        validateResults: true
      });

      expect(result.skills.every(s => s.confidence >= 0.8)).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it('should handle empty or invalid input', async () => {
      await expect(skillExtractor.extractSkills('')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
      );
    });
  });

  describe('Matching Service', () => {
    it('should find matching candidates with high accuracy', async () => {
      const matches = await matchingService.findMatchingCandidates(mockJob, {
        threshold: 0.85,
        maxResults: 10
      });

      expect(matches).toBeInstanceOf(Array);
      matches.forEach(match => {
        expect(match.score).toBeGreaterThanOrEqual(0.85);
        expect(match).toHaveProperty('skillMatch');
        expect(match).toHaveProperty('experienceMatch');
        expect(match).toHaveProperty('educationMatch');
      });
    });

    it('should respect matching weightings', async () => {
      const matches = await matchingService.findMatchingCandidates(mockJob, {
        weightings: {
          skills: 0.6,
          experience: 0.2,
          education: 0.1,
          description: 0.1
        }
      });

      expect(matches[0].skillMatch).toBeGreaterThanOrEqual(0.6);
    });

    it('should cache matching results', async () => {
      const key = `job-matches:${mockJob.id}`;
      
      // First call should cache results
      await matchingService.findMatchingCandidates(mockJob);
      const cached = await redisClient.get(key);
      expect(cached).toBeTruthy();
    });
  });

  describe('Resume Parser', () => {
    it('should parse resume text with high accuracy', async () => {
      const result = await resumeParser.parseResume('resumes', 'test-resume.pdf');

      expect(result).toMatchObject({
        full_name: expect.any(String),
        email: expect.any(String),
        phone: expect.any(String),
        experience: expect.arrayContaining([
          expect.objectContaining({
            company: expect.any(String),
            title: expect.any(String)
          })
        ])
      });
    });

    it('should extract structured information within SLA', async () => {
      const startTime = Date.now();
      await resumeParser.parseResume('resumes', 'test-resume.pdf');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // 5-second SLA
    });

    it('should handle multiple document formats', async () => {
      const formats = ['pdf', 'docx', 'txt'].map(format => 
        resumeParser.parseResume('resumes', `test-resume.${format}`)
      );

      const results = await Promise.all(formats);
      results.forEach(result => {
        expect(result).toHaveProperty('skills');
        expect(result).toHaveProperty('experience');
      });
    });
  });
});