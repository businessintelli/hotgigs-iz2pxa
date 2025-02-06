import { z } from 'zod'; // ^3.22.0
import { BaseEntity, PaginationParams, UUID } from '../types/common';
import { JobType, ExperienceLevel } from '../types/jobs';

/**
 * Enum representing possible states of a candidate in the system
 */
export enum CandidateStatus {
  ACTIVE = 'ACTIVE',
  PASSIVE = 'PASSIVE',
  NOT_LOOKING = 'NOT_LOOKING',
  HIRED = 'HIRED',
  ARCHIVED = 'ARCHIVED'
}

/**
 * Enum for different stages of job application process
 */
export enum ApplicationStatus {
  APPLIED = 'APPLIED',
  SCREENING = 'SCREENING',
  INTERVIEWING = 'INTERVIEWING',
  OFFER_PENDING = 'OFFER_PENDING',
  OFFER_ACCEPTED = 'OFFER_ACCEPTED',
  OFFER_DECLINED = 'OFFER_DECLINED',
  REJECTED = 'REJECTED'
}

/**
 * Interface for detailed candidate work experience entries
 */
export interface WorkExperience {
  company: string;
  title: string;
  start_date: Date;
  end_date: Date | null;
  description: string;
  skills_used: string[];
  location: string;
  is_current: boolean;
  achievements: string[];
  industry: string;
}

/**
 * Interface for comprehensive candidate education information
 */
export interface Education {
  institution: string;
  degree: string;
  field_of_study: string;
  start_date: Date;
  end_date: Date;
  gpa: number | null;
  achievements: string[];
  is_verified: boolean;
  certifications: string[];
}

/**
 * Enhanced interface for candidate job preferences and matching criteria
 */
export interface CandidatePreferences {
  preferred_job_types: JobType[];
  preferred_locations: string[];
  remote_only: boolean;
  salary_expectation_min: number;
  salary_expectation_max: number;
  open_to_relocation: boolean;
  preferred_industries: string[];
  preferred_companies: string[];
  preferred_travel_percentage: number;
  excluded_industries: string[];
}

/**
 * Comprehensive interface representing a candidate profile with all relevant information
 */
export interface Candidate extends BaseEntity {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  status: CandidateStatus;
  experience_level: ExperienceLevel;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  resume_url: string;
  preferences: CandidatePreferences;
  match_score: number;
  metadata: JsonValue;
}

/**
 * Type alias for candidate identifier
 */
export type CandidateId = UUID;

/**
 * Extended type for candidate with AI-powered job match information
 */
export type CandidateWithMatches = Candidate & {
  match_score: number;
  matched_jobs: number;
  skill_match_percentage: number;
  culture_fit_score: number;
};

/**
 * Type for candidate profile update operations
 */
export type CandidateUpdatePayload = Partial<Omit<Candidate, 'id' | 'created_at' | 'updated_at' | 'match_score'>>;

/**
 * Comprehensive interface for advanced candidate search parameters
 */
export interface CandidateSearchParams extends PaginationParams {
  query: string;
  status: CandidateStatus[];
  experience_level: ExperienceLevel[];
  skills: string[];
  location: string;
  remote_only: boolean;
  salary_min: number;
  salary_max: number;
  industries: string[];
  relocatable: boolean;
  min_experience_years: number;
  required_skills: string[];
}

// Zod schema for work experience validation
export const workExperienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  start_date: z.date(),
  end_date: z.date().nullable(),
  description: z.string(),
  skills_used: z.array(z.string()),
  location: z.string(),
  is_current: z.boolean(),
  achievements: z.array(z.string()),
  industry: z.string()
});

// Zod schema for education validation
export const educationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  field_of_study: z.string().min(1),
  start_date: z.date(),
  end_date: z.date(),
  gpa: z.number().min(0).max(4).nullable(),
  achievements: z.array(z.string()),
  is_verified: z.boolean(),
  certifications: z.array(z.string())
});

// Zod schema for candidate preferences validation
export const candidatePreferencesSchema = z.object({
  preferred_job_types: z.array(z.nativeEnum(JobType)),
  preferred_locations: z.array(z.string()),
  remote_only: z.boolean(),
  salary_expectation_min: z.number().min(0),
  salary_expectation_max: z.number().min(0),
  open_to_relocation: z.boolean(),
  preferred_industries: z.array(z.string()),
  preferred_companies: z.array(z.string()),
  preferred_travel_percentage: z.number().min(0).max(100),
  excluded_industries: z.array(z.string())
});

// Zod schema for candidate validation
export const candidateSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string(),
  location: z.string(),
  status: z.nativeEnum(CandidateStatus),
  experience_level: z.nativeEnum(ExperienceLevel),
  skills: z.array(z.string()),
  experience: z.array(workExperienceSchema),
  education: z.array(educationSchema),
  resume_url: z.string().url(),
  preferences: candidatePreferencesSchema,
  match_score: z.number().min(0).max(100),
  metadata: z.any()
});

// Zod schema for candidate search parameters validation
export const candidateSearchParamsSchema = z.object({
  query: z.string(),
  status: z.array(z.nativeEnum(CandidateStatus)),
  experience_level: z.array(z.nativeEnum(ExperienceLevel)),
  skills: z.array(z.string()),
  location: z.string(),
  remote_only: z.boolean(),
  salary_min: z.number().min(0),
  salary_max: z.number().min(0),
  industries: z.array(z.string()),
  relocatable: z.boolean(),
  min_experience_years: z.number().min(0),
  required_skills: z.array(z.string()),
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100)
});

// Zod schema for candidate update payload validation
export const candidateUpdatePayloadSchema = candidateSchema.partial().omit({
  id: true,
  created_at: true,
  updated_at: true,
  match_score: true
});