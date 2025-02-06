import { z } from 'zod'; // ^3.22.0
import { CandidateStatus } from '../types/candidates';
import { BaseEntity } from '../types/common';

// Regular expressions for validation
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;
const URL_REGEX = /^https?:\/\/[\w\-]+(\.[\w\-]+)+[/#?]?.*$/;
const MAX_TEXT_LENGTH = 5000;
const MIN_YEAR = 1950;

/**
 * Base schema for common entity fields
 */
const baseEntitySchema = z.object({
  id: z.string().uuid(),
  created_at: z.date(),
  updated_at: z.date()
});

/**
 * Schema for work experience validation with enhanced rules
 */
export const workExperienceSchema = z.object({
  company: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  start_date: z.date().min(new Date(MIN_YEAR, 0, 1)),
  end_date: z.date().nullable(),
  description: z.string().max(MAX_TEXT_LENGTH),
  skills_used: z.array(z.string().min(1).max(100)),
  location: z.string().min(1).max(200),
  is_current: z.boolean(),
  achievements: z.array(z.string().max(500)),
  industry: z.string().min(1).max(100)
}).refine(data => {
  if (data.end_date && data.start_date > data.end_date) {
    return false;
  }
  return true;
}, { message: "End date must be after start date" });

/**
 * Schema for education history validation
 */
export const educationSchema = z.object({
  institution: z.string().min(1).max(200),
  degree: z.string().min(1).max(200),
  field_of_study: z.string().min(1).max(200),
  start_date: z.date().min(new Date(MIN_YEAR, 0, 1)),
  end_date: z.date(),
  gpa: z.number().min(0).max(4).nullable(),
  achievements: z.array(z.string().max(500)),
  is_verified: z.boolean(),
  certifications: z.array(z.string().max(200))
}).refine(data => data.start_date <= data.end_date, {
  message: "End date must be after start date"
});

/**
 * Schema for candidate preferences with comprehensive validation
 */
export const candidatePreferencesSchema = z.object({
  preferred_job_types: z.array(z.string().min(1)),
  preferred_locations: z.array(z.string().min(1).max(100)),
  remote_only: z.boolean(),
  salary_expectation_min: z.number().min(0).max(1000000000),
  salary_expectation_max: z.number().min(0).max(1000000000),
  open_to_relocation: z.boolean(),
  preferred_industries: z.array(z.string().min(1).max(100)),
  preferred_companies: z.array(z.string().min(1).max(100)),
  preferred_travel_percentage: z.number().min(0).max(100),
  excluded_industries: z.array(z.string().min(1).max(100))
}).refine(data => data.salary_expectation_min <= data.salary_expectation_max, {
  message: "Minimum salary expectation must be less than or equal to maximum"
});

/**
 * Schema for AI matching data validation
 */
export const aiMatchingSchema = z.object({
  match_score: z.number().min(0).max(100),
  skill_match_percentage: z.number().min(0).max(100),
  experience_match_score: z.number().min(0).max(100),
  culture_fit_score: z.number().min(0).max(100),
  location_match_score: z.number().min(0).max(100),
  overall_ranking: z.number().min(1),
  matching_jobs: z.array(z.string().uuid()),
  match_confidence: z.number().min(0).max(1)
});

/**
 * Comprehensive candidate schema with all validations
 */
export const candidateSchema = baseEntitySchema.extend({
  full_name: z.string().min(1).max(200),
  email: z.string().email().regex(EMAIL_REGEX),
  phone: z.string().regex(PHONE_REGEX),
  location: z.string().min(1).max(200),
  status: z.nativeEnum(CandidateStatus),
  experience_level: z.string().min(1),
  skills: z.array(z.string().min(1).max(100)),
  experience: z.array(workExperienceSchema).min(0),
  education: z.array(educationSchema).min(0),
  resume_url: z.string().regex(URL_REGEX),
  preferences: candidatePreferencesSchema,
  ai_matching_data: aiMatchingSchema,
  metadata: z.record(z.unknown()).nullable(),
  last_activity: z.date(),
  profile_completion: z.number().min(0).max(100),
  is_searchable: z.boolean(),
  privacy_settings: z.object({
    share_profile: z.boolean(),
    share_contact: z.boolean(),
    share_education: z.boolean(),
    share_experience: z.boolean()
  })
});

/**
 * Schema for candidate search and filtering
 */
export const candidateSearchSchema = z.object({
  query: z.string().max(500).optional(),
  status: z.array(z.nativeEnum(CandidateStatus)).optional(),
  skills: z.array(z.string()).optional(),
  location: z.string().max(200).optional(),
  experience_level: z.array(z.string()).optional(),
  min_match_score: z.number().min(0).max(100).optional(),
  education_level: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  salary_range: z.object({
    min: z.number().min(0),
    max: z.number().min(0)
  }).optional(),
  availability: z.date().optional(),
  remote_only: z.boolean().optional(),
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100)
});

/**
 * Schema for candidate profile updates
 */
export const candidateUpdateSchema = candidateSchema
  .partial()
  .omit({ 
    id: true, 
    created_at: true, 
    updated_at: true, 
    ai_matching_data: true 
  });

/**
 * Schema for bulk candidate operations
 */
export const bulkCandidateOperationSchema = z.object({
  candidate_ids: z.array(z.string().uuid()),
  operation: z.enum(['archive', 'activate', 'update_status']),
  status: z.nativeEnum(CandidateStatus).optional(),
  metadata: z.record(z.unknown()).optional()
});