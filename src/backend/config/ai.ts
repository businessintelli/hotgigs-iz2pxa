import { z } from 'zod'; // ^3.22.0

// Model Constants
export const OPENAI_MODELS = {
  EMBEDDING: 'text-embedding-ada-002',
  COMPLETION: 'gpt-4',
  ANALYSIS: 'gpt-4',
} as const;

// Configuration Schema Definitions
const OpenAIConfigSchema = z.object({
  apiKey: z.string().min(1),
  organization: z.string().min(1),
  models: z.object({
    embedding: z.string(),
    completion: z.string(),
    analysis: z.string(),
  }),
  defaultParams: z.object({
    temperature: z.number().min(0).max(1),
    maxTokens: z.number().positive(),
    topP: z.number().min(0).max(1),
    frequencyPenalty: z.number().min(-2).max(2),
    presencePenalty: z.number().min(-2).max(2),
  }),
  monitoring: z.object({
    costTracking: z.boolean(),
    usageAlerts: z.boolean(),
    errorThreshold: z.number().min(0).max(1),
  }),
  rateLimit: z.object({
    requestsPerMinute: z.number().positive(),
    tokensPerMinute: z.number().positive(),
  }),
});

const MatchingConfigSchema = z.object({
  similarityThreshold: z.number().min(0).max(1),
  maxResults: z.number().positive(),
  weightings: z.object({
    skills: z.number(),
    experience: z.number(),
    education: z.number(),
    description: z.number(),
  }),
  cacheTimeout: z.number().positive(),
  adaptiveThresholds: z.object({
    enabled: z.boolean(),
    learningRate: z.number().min(0).max(1),
    minThreshold: z.number().min(0).max(1),
    maxThreshold: z.number().min(0).max(1),
  }),
  performanceMetrics: z.object({
    trackAccuracy: z.boolean(),
    logMismatches: z.boolean(),
    feedbackLoop: z.boolean(),
  }),
});

const SkillExtractionConfigSchema = z.object({
  categories: z.array(z.string()),
  minConfidence: z.number().min(0).max(1),
  maxSkillsPerCategory: z.number().positive(),
  prompt: z.string(),
  validation: z.object({
    requireEvidence: z.boolean(),
    contextualScoring: z.boolean(),
    deduplication: z.boolean(),
  }),
  enhancement: z.object({
    synonymResolution: z.boolean(),
    hierarchicalMapping: z.boolean(),
    versionTracking: z.boolean(),
  }),
});

// Main Configuration Object
export const aiConfig = {
  version: '1.0.0',
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID,
    models: {
      embedding: OPENAI_MODELS.EMBEDDING,
      completion: OPENAI_MODELS.COMPLETION,
      analysis: OPENAI_MODELS.ANALYSIS,
    },
    defaultParams: {
      temperature: 0.3,
      maxTokens: 2048,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
    },
    monitoring: {
      costTracking: true,
      usageAlerts: true,
      errorThreshold: 0.01,
    },
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
    },
  },
  matching: {
    similarityThreshold: 0.85, // Targeting 85% match accuracy
    maxResults: 50,
    weightings: {
      skills: 0.4,
      experience: 0.3,
      education: 0.2,
      description: 0.1,
    },
    cacheTimeout: 3600,
    adaptiveThresholds: {
      enabled: true,
      learningRate: 0.01,
      minThreshold: 0.7,
      maxThreshold: 0.95,
    },
    performanceMetrics: {
      trackAccuracy: true,
      logMismatches: true,
      feedbackLoop: true,
    },
  },
  skillExtraction: {
    categories: [
      'Technical',
      'Soft',
      'Domain',
      'Tools',
      'Certifications',
      'Languages',
      'Methodologies',
      'Industries',
    ],
    minConfidence: 0.8,
    maxSkillsPerCategory: 20,
    prompt: 'Extract and categorize professional skills from the following text. Format as JSON with categories: technical, soft, domain, tools, certifications, languages, methodologies, industries.',
    validation: {
      requireEvidence: true,
      contextualScoring: true,
      deduplication: true,
    },
    enhancement: {
      synonymResolution: true,
      hierarchicalMapping: true,
      versionTracking: true,
    },
  },
} as const;

// Configuration Validation Function
export function validateConfig(config: typeof aiConfig): boolean {
  try {
    OpenAIConfigSchema.parse(config.openai);
    MatchingConfigSchema.parse(config.matching);
    SkillExtractionConfigSchema.parse(config.skillExtraction);
    return true;
  } catch (error) {
    console.error('AI Configuration validation failed:', error);
    return false;
  }
}

// Version Information Function
export function getConfigVersion(): string {
  return aiConfig.version;
}

// Type Exports
export type OpenAIConfig = typeof aiConfig.openai;
export type MatchingConfig = typeof aiConfig.matching;
export type SkillExtractionConfig = typeof aiConfig.skillExtraction;