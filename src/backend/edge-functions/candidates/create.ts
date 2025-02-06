import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import { z } from 'zod'; // ^3.22.0
import { rateLimit } from '@upstash/ratelimit'; // ^1.0.0
import { cache } from '@vercel/cache'; // ^1.0.0
import { ResumeParser } from '../../services/ai/resume-parser';
import { ResumeStorage } from '../../services/storage/resume-storage';
import { candidateSchema, CandidateStatus, ExperienceLevel } from '../../types/candidates';
import { ErrorCode } from '../../types/common';
import { Logger } from '../../utils/logger';

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const logger = new Logger({ name: 'create-candidate' });
const resumeParser = new ResumeParser();
const resumeStorage = new ResumeStorage();

// Request validation schema
const createCandidateRequestSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string(),
  resume: z.instanceof(File).optional(),
  preferences: z.object({
    preferredJobTypes: z.array(z.string()),
    preferredLocations: z.array(z.string()),
    remoteOnly: z.boolean(),
    salaryExpectationMin: z.number().min(0),
    salaryExpectationMax: z.number().min(0),
    openToRelocation: z.boolean(),
    preferredIndustries: z.array(z.string()),
    preferredCompanies: z.array(z.string()),
    preferredTravelPercentage: z.number().min(0).max(100),
    excludedIndustries: z.array(z.string())
  }).optional()
});

// Rate limiting configuration
const rateLimiter = rateLimit({
  requests: 100,
  duration: '1m'
});

/**
 * Edge function handler for creating new candidate profiles
 */
export async function createCandidate(req: Request): Promise<Response> {
  try {
    // Apply rate limiting
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimiter.limit(ip);
    if (!rateLimitResult.success) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        code: ErrorCode.BAD_REQUEST
      }), { status: 429 });
    }

    // Parse and validate request
    const formData = await req.formData();
    const payload = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      location: formData.get('location'),
      resume: formData.get('resume') as File | null,
      preferences: formData.get('preferences') ? 
        JSON.parse(formData.get('preferences') as string) : undefined
    };

    const validatedData = createCandidateRequestSchema.parse(payload);

    // Process resume if provided
    let resumeData = null;
    let resumeUrl = null;
    if (validatedData.resume) {
      // Upload resume
      const { url, key, metadata } = await resumeStorage.uploadResume(
        validatedData.resume,
        crypto.randomUUID(),
        { source: 'candidate-creation' }
      );
      resumeUrl = url;

      // Parse resume
      resumeData = await resumeParser.parseResume(key, {
        extractEducation: true,
        extractExperience: true,
        extractSkills: true
      });
    }

    // Merge manual input with resume data
    const candidateData = {
      full_name: validatedData.fullName,
      email: validatedData.email,
      phone: validatedData.phone || '',
      location: validatedData.location,
      status: CandidateStatus.ACTIVE,
      experience_level: resumeData?.experience_level || ExperienceLevel.ENTRY,
      skills: resumeData?.skills || [],
      experience: resumeData?.experience || [],
      education: resumeData?.education || [],
      resume_url: resumeUrl,
      preferences: validatedData.preferences || {
        preferred_job_types: [],
        preferred_locations: [validatedData.location],
        remote_only: false,
        salary_expectation_min: 0,
        salary_expectation_max: 0,
        open_to_relocation: false,
        preferred_industries: [],
        preferred_companies: [],
        preferred_travel_percentage: 0,
        excluded_industries: []
      },
      match_score: 0,
      metadata: {
        source: 'web-application',
        created_at: new Date().toISOString(),
        resume_parsed: !!resumeData
      }
    };

    // Validate complete candidate data
    const validatedCandidate = candidateSchema.parse(candidateData);

    // Create candidate in database
    const { data: candidate, error } = await supabase
      .from('candidates')
      .insert(validatedCandidate)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create candidate', { error });
      throw error;
    }

    // Cache candidate data
    await cache.set(`candidate:${candidate.id}`, candidate, 300);

    logger.info('Candidate created successfully', {
      candidateId: candidate.id,
      hasResume: !!resumeUrl
    });

    return new Response(JSON.stringify({
      success: true,
      data: candidate
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    logger.error('Candidate creation failed', { error });

    const errorResponse = {
      success: false,
      error: {
        code: error instanceof z.ZodError ? 
          ErrorCode.VALIDATION_ERROR : 
          ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof z.ZodError ? error.errors : null
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: error instanceof z.ZodError ? 400 : 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}