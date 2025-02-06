import { OpenAI } from 'openai'; // ^4.0.0
import Redis from 'ioredis'; // ^5.0.0
import CircuitBreaker from 'opossum'; // ^6.0.0
import pino from 'pino'; // ^8.0.0

import { aiConfig } from '../../config/ai';
import { Job } from '../../types/jobs';
import { Candidate } from '../../types/candidates';
import { ErrorCode } from '../../types/common';

// Types for matching service
interface MatchOptions {
  threshold?: number;
  maxResults?: number;
  requiredSkills?: string[];
  weightings?: {
    skills: number;
    experience: number;
    education: number;
    description: number;
  };
}

interface CandidateMatch {
  candidateId: string;
  score: number;
  skillMatch: number;
  experienceMatch: number;
  educationMatch: number;
  descriptionMatch: number;
  confidence: number;
}

interface EmbeddingOptions {
  model?: string;
  cacheKey?: string;
  cacheTTL?: number;
}

interface SimilarityResult {
  score: number;
  confidence: number;
  metrics: {
    cosine: number;
    euclidean: number;
  };
}

// Decorators for monitoring and optimization
function cached(prefix: string, ttl: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${prefix}:${JSON.stringify(args)}`;
      const cached = await this.cacheClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
      
      const result = await originalMethod.apply(this, args);
      await this.cacheClient.setex(cacheKey, ttl, JSON.stringify(result));
      return result;
    };
    return descriptor;
  };
}

// Main Matching Service Class
export class MatchingService {
  private readonly openaiClient: OpenAI;
  private readonly cacheClient: Redis;
  private readonly logger: pino.Logger;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly config: typeof aiConfig.matching;

  constructor(
    openaiClient: OpenAI,
    cacheClient: Redis,
    logger: pino.Logger,
    config = aiConfig.matching
  ) {
    this.openaiClient = openaiClient;
    this.cacheClient = cacheClient;
    this.logger = logger;
    this.config = config;

    // Initialize circuit breaker for OpenAI calls
    this.circuitBreaker = new CircuitBreaker(this.generateEmbeddings.bind(this), {
      timeout: 10000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    });
  }

  /**
   * Generates embeddings for text input with error handling and caching
   */
  private async generateEmbeddings(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    try {
      const model = options.model || aiConfig.openai.models.embedding;
      const response = await this.openaiClient.embeddings.create({
        model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error({ error, text }, 'Failed to generate embeddings');
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Calculates similarity between two embedding vectors
   */
  private calculateSimilarity(
    embedding1: number[],
    embedding2: number[]
  ): SimilarityResult {
    // Cosine similarity
    const dotProduct = embedding1.reduce((sum, a, i) => sum + a * embedding2[i], 0);
    const norm1 = Math.sqrt(embedding1.reduce((sum, a) => sum + a * a, 0));
    const norm2 = Math.sqrt(embedding2.reduce((sum, a) => sum + a * a, 0));
    const cosine = dotProduct / (norm1 * norm2);

    // Euclidean distance (normalized)
    const euclidean = 1 / (1 + Math.sqrt(
      embedding1.reduce((sum, a, i) => sum + Math.pow(a - embedding2[i], 2), 0)
    ));

    // Combined score with confidence
    const score = (cosine + euclidean) / 2;
    const confidence = Math.min(cosine, euclidean) / Math.max(cosine, euclidean);

    return {
      score,
      confidence,
      metrics: { cosine, euclidean }
    };
  }

  /**
   * Finds matching candidates for a job with comprehensive scoring
   */
  @cached('job-matches', 3600)
  public async findMatchingCandidates(
    job: Job,
    options: MatchOptions = {}
  ): Promise<CandidateMatch[]> {
    try {
      const {
        threshold = this.config.similarityThreshold,
        maxResults = this.config.maxResults,
        weightings = this.config.weightings,
      } = options;

      // Generate job embeddings
      const jobEmbedding = await this.circuitBreaker.fire(
        JSON.stringify({
          description: job.description,
          requirements: job.requirements,
          skills: job.skills,
        })
      );

      // Prepare candidate matching criteria
      const matches: CandidateMatch[] = [];
      const candidateQuery = await this.prepareCandidateQuery(job);

      // Process candidates in batches for efficiency
      for await (const candidate of candidateQuery) {
        const candidateEmbedding = await this.circuitBreaker.fire(
          JSON.stringify({
            experience: candidate.experience,
            education: candidate.education,
            skills: candidate.skills,
          })
        );

        const similarity = this.calculateSimilarity(jobEmbedding, candidateEmbedding);
        
        if (similarity.score >= threshold) {
          const match = await this.calculateDetailedMatch(job, candidate, similarity, weightings);
          matches.push(match);
        }
      }

      // Sort and limit results
      return matches
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

    } catch (error) {
      this.logger.error({ error, jobId: job.id }, 'Matching operation failed');
      throw new Error(`Matching failed: ${error.message}`);
    }
  }

  /**
   * Calculates detailed match scores between a job and candidate
   */
  private async calculateDetailedMatch(
    job: Job,
    candidate: Candidate,
    similarity: SimilarityResult,
    weightings: MatchOptions['weightings']
  ): Promise<CandidateMatch> {
    const skillMatch = this.calculateSkillMatch(job.skills, candidate.skills);
    const experienceMatch = this.calculateExperienceMatch(job.requirements, candidate.experience);
    const educationMatch = this.calculateEducationMatch(job.requirements, candidate.education);

    const score = (
      skillMatch * weightings.skills +
      experienceMatch * weightings.experience +
      educationMatch * weightings.education +
      similarity.score * weightings.description
    );

    return {
      candidateId: candidate.id,
      score,
      skillMatch,
      experienceMatch,
      educationMatch,
      descriptionMatch: similarity.score,
      confidence: similarity.confidence
    };
  }

  /**
   * Calculates skill match percentage between job and candidate
   */
  private calculateSkillMatch(jobSkills: string[], candidateSkills: string[]): number {
    const requiredSkills = new Set(jobSkills);
    const matchedSkills = candidateSkills.filter(skill => requiredSkills.has(skill));
    return matchedSkills.length / requiredSkills.size;
  }

  /**
   * Calculates experience match based on requirements and candidate experience
   */
  private calculateExperienceMatch(
    requirements: Job['requirements'],
    experience: Candidate['experience']
  ): number {
    const totalYears = experience.reduce((sum, exp) => {
      const endDate = exp.end_date || new Date();
      const duration = endDate.getTime() - exp.start_date.getTime();
      return sum + duration / (1000 * 60 * 60 * 24 * 365);
    }, 0);

    return Math.min(totalYears / requirements.years_experience, 1);
  }

  /**
   * Calculates education match based on requirements and candidate education
   */
  private calculateEducationMatch(
    requirements: Job['requirements'],
    education: Candidate['education']
  ): number {
    const requiredQualifications = new Set(requirements.qualifications);
    const matchedQualifications = education.filter(edu =>
      requiredQualifications.has(edu.degree)
    );
    return matchedQualifications.length / requiredQualifications.size;
  }

  /**
   * Prepares efficient candidate query based on job requirements
   */
  private async prepareCandidateQuery(job: Job): Promise<AsyncIterable<Candidate>> {
    // Implementation would depend on your database access layer
    // This is a placeholder for the actual implementation
    throw new Error('prepareCandidateQuery must be implemented');
  }
}

// Export utility functions
export const generateEmbeddings = async (
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> => {
  const openai = new OpenAI({ apiKey: aiConfig.openai.apiKey });
  return await openai.embeddings.create({
    model: options.model || aiConfig.openai.models.embedding,
    input: text,
  }).then(response => response.data[0].embedding);
};