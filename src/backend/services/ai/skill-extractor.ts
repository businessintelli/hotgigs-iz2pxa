import { z } from 'zod'; // ^3.22.0
import { aiConfig, SkillExtractionConfig } from '../../config/ai';
import { OpenAIService } from './openai';
import { AppError } from '../../utils/error-handler';
import { ErrorCode } from '../../types/common';

// Interfaces
export interface ExtractedSkill {
  name: string;
  category: string;
  confidence: number;
  level?: string;
  aliases?: string[];
  description?: string;
  lastVerified?: Date;
}

export interface SkillExtractionResult {
  skills: ExtractedSkill[];
  totalConfidence: number;
  categoryDistribution: Record<string, number>;
  extractionTime: number;
  modelVersion: string;
  warnings?: string[];
}

interface ExtractSkillOptions {
  minConfidence?: number;
  maxSkillsPerCategory?: number;
  validateResults?: boolean;
  includeLevels?: boolean;
  includeAliases?: boolean;
}

// Validation Schemas
const extractedSkillSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  confidence: z.number().min(0).max(1),
  level: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  description: z.string().optional(),
  lastVerified: z.date().optional()
});

const skillExtractionResultSchema = z.object({
  skills: z.array(extractedSkillSchema),
  totalConfidence: z.number().min(0).max(1),
  categoryDistribution: z.record(z.number()),
  extractionTime: z.number(),
  modelVersion: z.string(),
  warnings: z.array(z.string()).optional()
});

export class SkillExtractor {
  private readonly openAIService: OpenAIService;
  private readonly config: SkillExtractionConfig;
  private readonly skillCache: Map<string, { skills: ExtractedSkill[]; timestamp: number }>;
  private readonly validationSchema: z.ZodSchema;

  constructor(openAIService: OpenAIService, config = aiConfig.skillExtraction) {
    this.openAIService = openAIService;
    this.config = config;
    this.skillCache = new Map();
    this.validationSchema = skillExtractionResultSchema;
  }

  public async extractSkills(
    text: string,
    options: ExtractSkillOptions = {}
  ): Promise<SkillExtractionResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    // Input validation
    if (!text || text.trim().length === 0) {
      throw new AppError('Empty text provided', ErrorCode.VALIDATION_ERROR);
    }

    // Check cache
    const cacheKey = this.generateCacheKey(text);
    const cached = this.skillCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      return this.formatResult(cached.skills, startTime, warnings);
    }

    try {
      // Prepare analysis options
      const analysisOptions = {
        type: 'skills' as const,
        parameters: {
          categories: this.config.categories,
          minConfidence: options.minConfidence || this.config.minConfidence,
          maxSkillsPerCategory: options.maxSkillsPerCategory || this.config.maxSkillsPerCategory
        },
        validateOutput: true
      };

      // Extract skills using OpenAI
      const analysisResult = await this.openAIService.analyzeText(text, analysisOptions);

      // Parse and validate extracted skills
      const extractedSkills = await this.parseSkills(analysisResult.data, options);

      // Validate results
      if (options.validateResults !== false) {
        const validationResults = this.validateExtractedSkills(extractedSkills);
        warnings.push(...validationResults.warnings);
      }

      // Cache results
      this.skillCache.set(cacheKey, {
        skills: extractedSkills,
        timestamp: Date.now()
      });

      // Format and return final result
      return this.formatResult(extractedSkills, startTime, warnings);

    } catch (error) {
      throw new AppError(
        'Skill extraction failed',
        ErrorCode.INTERNAL_ERROR,
        { originalError: error.message }
      );
    }
  }

  private async parseSkills(
    rawData: any,
    options: ExtractSkillOptions
  ): Promise<ExtractedSkill[]> {
    const skills: ExtractedSkill[] = [];
    const processedNames = new Set<string>();

    for (const category of this.config.categories) {
      if (!Array.isArray(rawData[category.toLowerCase()])) continue;

      const categorySkills = rawData[category.toLowerCase()]
        .filter((skill: any) => typeof skill === 'string' || (typeof skill === 'object' && skill.name))
        .map((skill: any): ExtractedSkill => {
          const skillName = typeof skill === 'string' ? skill : skill.name;
          const normalizedName = this.normalizeSkillName(skillName);

          if (processedNames.has(normalizedName)) {
            return null;
          }
          processedNames.add(normalizedName);

          return {
            name: normalizedName,
            category,
            confidence: typeof skill === 'object' ? skill.confidence || 0.8 : 0.8,
            level: options.includeLevels ? this.determineSkillLevel(skill) : undefined,
            aliases: options.includeAliases ? this.findSkillAliases(normalizedName) : undefined,
            lastVerified: new Date()
          };
        })
        .filter((skill: ExtractedSkill | null): skill is ExtractedSkill => skill !== null);

      skills.push(...categorySkills);
    }

    return skills;
  }

  private validateExtractedSkills(
    skills: ExtractedSkill[]
  ): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let isValid = true;

    // Check category distribution
    const categoryCount = new Map<string, number>();
    skills.forEach(skill => {
      categoryCount.set(skill.category, (categoryCount.get(skill.category) || 0) + 1);
    });

    // Validate category limits
    for (const [category, count] of categoryCount.entries()) {
      if (count > this.config.maxSkillsPerCategory) {
        warnings.push(`Category ${category} exceeds maximum skill limit`);
        isValid = false;
      }
    }

    // Validate confidence scores
    const lowConfidenceSkills = skills.filter(skill => skill.confidence < this.config.minConfidence);
    if (lowConfidenceSkills.length > 0) {
      warnings.push(`${lowConfidenceSkills.length} skills below minimum confidence threshold`);
      isValid = false;
    }

    return { isValid, warnings };
  }

  private formatResult(
    skills: ExtractedSkill[],
    startTime: number,
    warnings: string[]
  ): SkillExtractionResult {
    const categoryDistribution = skills.reduce((acc, skill) => {
      acc[skill.category] = (acc[skill.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalConfidence = skills.reduce((sum, skill) => sum + skill.confidence, 0) / skills.length;

    return {
      skills,
      totalConfidence,
      categoryDistribution,
      extractionTime: Date.now() - startTime,
      modelVersion: this.config.prompt.includes('GPT-4') ? 'GPT-4' : 'GPT-3.5',
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private generateCacheKey(text: string): string {
    return `skills_${Buffer.from(text).toString('base64').slice(0, 32)}`;
  }

  private normalizeSkillName(name: string): string {
    return name.trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ');
  }

  private determineSkillLevel(skill: any): string {
    if (typeof skill !== 'object' || !skill.experience) {
      return 'intermediate';
    }
    const exp = skill.experience.toLowerCase();
    if (exp.includes('expert') || exp.includes('advanced')) return 'expert';
    if (exp.includes('beginner') || exp.includes('basic')) return 'beginner';
    return 'intermediate';
  }

  private findSkillAliases(skillName: string): string[] {
    // Implementation would typically involve a skill aliases database
    // For now, return empty array
    return [];
  }
}