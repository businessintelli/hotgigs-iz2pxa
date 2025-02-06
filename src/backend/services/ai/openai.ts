import OpenAI from 'openai'; // ^4.0.0
import Redis from 'ioredis'; // ^5.0.0
import { aiConfig } from '../../config/ai';
import { AppError } from '../../utils/error-handler';
import { ErrorCode } from '../../types/common';
import { logger } from '../../utils/logger';

// Interfaces for service options
interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  model?: string;
  timeout?: number;
  retries?: number;
  stream?: boolean;
}

interface EmbeddingOptions {
  model?: string;
  timeout?: number;
  retries?: number;
  cacheTTL?: number;
}

interface AnalysisOptions {
  type: 'skills' | 'experience' | 'education' | 'general';
  parameters?: Record<string, any>;
  model?: string;
  minConfidence?: number;
  validateOutput?: boolean;
}

interface AnalysisResult {
  category: string;
  data: Record<string, any>;
  confidence: number;
  metadata: Record<string, any>;
  validationResults?: Array<{
    check: string;
    passed: boolean;
    details?: string;
  }>;
}

// Circuit breaker states
enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailure: number = 0;
  private readonly threshold: number = 5;
  private readonly resetTimeout: number = 30000;

  public isAvailable(): boolean {
    if (this.state === CircuitState.CLOSED) return true;
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailure >= this.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        return true;
      }
      return false;
    }
    return this.state === CircuitState.HALF_OPEN;
  }

  public recordSuccess(): void {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
  }

  public recordFailure(): boolean {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = CircuitState.OPEN;
      return true;
    }
    return false;
  }
}

export class OpenAIService {
  private client: OpenAI;
  private cache: Redis;
  private circuitBreaker: CircuitBreaker;
  private readonly config: typeof aiConfig.openai;

  constructor(config = aiConfig.openai) {
    // Initialize OpenAI client
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
    });

    // Initialize Redis cache
    this.cache = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.circuitBreaker = new CircuitBreaker();
    this.config = config;
  }

  /**
   * Generates embeddings for text with caching and reliability features
   */
  public async generateEmbeddings(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    if (!this.circuitBreaker.isAvailable()) {
      throw new AppError(
        'Service temporarily unavailable',
        ErrorCode.SERVICE_UNAVAILABLE
      );
    }

    const cacheKey = `embedding:${Buffer.from(text).toString('base64')}`;
    const cacheTTL = options.cacheTTL || 3600; // 1 hour default

    try {
      // Check cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.client.embeddings.create({
        model: options.model || this.config.models.embedding,
        input: text,
      });

      const embedding = response.data[0].embedding;

      // Cache the result
      await this.cache.setex(cacheKey, cacheTTL, JSON.stringify(embedding));
      
      this.circuitBreaker.recordSuccess();
      return embedding;

    } catch (error) {
      const isCircuitOpen = this.circuitBreaker.recordFailure();
      logger.error('Embedding generation failed', { error, text: text.substring(0, 100) });
      
      throw new AppError(
        'Failed to generate embeddings',
        ErrorCode.INTERNAL_ERROR,
        { originalError: error.message }
      );
    }
  }

  /**
   * Generates text completion using GPT model with reliability features
   */
  public async generateCompletion(
    prompt: string,
    options: CompletionOptions = {}
  ): Promise<string> {
    if (!this.circuitBreaker.isAvailable()) {
      throw new AppError(
        'Service temporarily unavailable',
        ErrorCode.SERVICE_UNAVAILABLE
      );
    }

    try {
      const response = await this.client.chat.completions.create({
        model: options.model || this.config.models.completion,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature || this.config.defaultParams.temperature,
        max_tokens: options.maxTokens || this.config.defaultParams.maxTokens,
        top_p: options.topP || this.config.defaultParams.topP,
      });

      this.circuitBreaker.recordSuccess();
      return response.choices[0].message.content || '';

    } catch (error) {
      const isCircuitOpen = this.circuitBreaker.recordFailure();
      logger.error('Completion generation failed', { error, prompt: prompt.substring(0, 100) });
      
      throw new AppError(
        'Failed to generate completion',
        ErrorCode.INTERNAL_ERROR,
        { originalError: error.message }
      );
    }
  }

  /**
   * Analyzes text content using GPT model with enhanced validation
   */
  public async analyzeText(
    text: string,
    options: AnalysisOptions
  ): Promise<AnalysisResult> {
    if (!this.circuitBreaker.isAvailable()) {
      throw new AppError(
        'Service temporarily unavailable',
        ErrorCode.SERVICE_UNAVAILABLE
      );
    }

    try {
      let prompt = '';
      switch (options.type) {
        case 'skills':
          prompt = `${this.config.skillExtraction.prompt}\n\nText: ${text}`;
          break;
        case 'experience':
          prompt = `Analyze the professional experience from the following text. Extract years of experience, roles, and key achievements.\n\nText: ${text}`;
          break;
        case 'education':
          prompt = `Extract educational qualifications, institutions, and graduation years from the following text.\n\nText: ${text}`;
          break;
        default:
          prompt = `Analyze the following text and provide structured insights.\n\nText: ${text}`;
      }

      const response = await this.client.chat.completions.create({
        model: options.model || this.config.models.analysis,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2048,
      });

      const content = response.choices[0].message.content || '';
      const parsedResult = JSON.parse(content);

      const result: AnalysisResult = {
        category: options.type,
        data: parsedResult,
        confidence: this.calculateConfidence(parsedResult),
        metadata: {
          model: options.model || this.config.models.analysis,
          timestamp: new Date().toISOString(),
        },
      };

      if (options.validateOutput) {
        result.validationResults = this.validateAnalysisResult(result, options);
      }

      if (result.confidence < (options.minConfidence || 0.8)) {
        throw new AppError(
          'Analysis confidence below threshold',
          ErrorCode.VALIDATION_ERROR,
          { confidence: result.confidence }
        );
      }

      this.circuitBreaker.recordSuccess();
      return result;

    } catch (error) {
      const isCircuitOpen = this.circuitBreaker.recordFailure();
      logger.error('Text analysis failed', { error, text: text.substring(0, 100) });
      
      throw new AppError(
        'Failed to analyze text',
        ErrorCode.INTERNAL_ERROR,
        { originalError: error.message }
      );
    }
  }

  private calculateConfidence(result: any): number {
    // Implement confidence calculation based on result completeness and quality
    let confidence = 1.0;
    
    if (!result || typeof result !== 'object') {
      return 0;
    }

    // Reduce confidence for empty or invalid fields
    Object.entries(result).forEach(([key, value]) => {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        confidence *= 0.8;
      }
    });

    return Math.max(0, Math.min(1, confidence));
  }

  private validateAnalysisResult(
    result: AnalysisResult,
    options: AnalysisOptions
  ): Array<{ check: string; passed: boolean; details?: string }> {
    const validations = [];

    // Validate data structure
    validations.push({
      check: 'dataStructure',
      passed: result.data && typeof result.data === 'object',
      details: 'Checking data structure integrity',
    });

    // Validate confidence threshold
    validations.push({
      check: 'confidenceThreshold',
      passed: result.confidence >= (options.minConfidence || 0.8),
      details: `Confidence ${result.confidence} vs threshold ${options.minConfidence || 0.8}`,
    });

    // Type-specific validations
    switch (options.type) {
      case 'skills':
        validations.push({
          check: 'skillsCategories',
          passed: Array.isArray(result.data.technical) && Array.isArray(result.data.soft),
          details: 'Checking skills categorization',
        });
        break;
      case 'experience':
        validations.push({
          check: 'experienceFormat',
          passed: Boolean(result.data.years && result.data.roles),
          details: 'Checking experience format',
        });
        break;
    }

    return validations;
  }
}