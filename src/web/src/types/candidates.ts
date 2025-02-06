import { z } from 'zod'; // v3.22.0
import { BaseEntity, PaginationParams } from '../types/common';
import { JobRequirements } from '../types/jobs';

// Enums
export enum CandidateStatus {
  ACTIVE = 'ACTIVE',
  PASSIVE = 'PASSIVE',
  NOT_LOOKING = 'NOT_LOOKING',
  HIRED = 'HIRED',
  ARCHIVED = 'ARCHIVED'
}

export enum ApplicationStatus {
  APPLIED = 'APPLIED',
  SCREENING = 'SCREENING',
  INTERVIEWING = 'INTERVIEWING',
  OFFER_PENDING = 'OFFER_PENDING',
  OFFER_ACCEPTED = 'OFFER_ACCEPTED',
  OFFER_DECLINED = 'OFFER_DECLINED',
  REJECTED = 'REJECTED'
}

// Interfaces
export interface WorkExperience {
  company: string;
  title: string;
  start_date: Date;
  end_date: Date | null;
  description: string;
  skills_used: string[];
  location: string;
  is_current: boolean;
  industry: string;
  company_size: string;
  achievements: string[];
  employment_type: string;
}

export interface Education {
  institution: string;
  degree: string;
  field_of_study: string;
  start_date: Date;
  end_date: Date;
  gpa: number | null;
  achievements: string[];
  courses: string[];
  thesis_title: string;
  is_verified: boolean;
}

export interface CandidatePreferences {
  preferred_job_types: string[];
  preferred_locations: string[];
  remote_only: boolean;
  salary_expectation_min: number;
  salary_expectation_max: number;
  open_to_relocation: boolean;
  preferred_industries: string[];
  industry_experience: string[];
  notice_period_days: number;
  travel_willingness: string;
  work_authorization: string;
  preferred_company_sizes: string[];
  preferred_work_schedule: string;
  willing_to_travel: boolean;
}

export interface Candidate extends BaseEntity {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  status: CandidateStatus;
  experience_level: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  resume_url: string;
  preferences: CandidatePreferences;
  certifications: string[];
  languages: string[];
  social_profiles: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
    twitter?: string;
  };
  summary: string;
  last_active: Date;
  profile_complete: boolean;
}

export interface CandidateSearchParams extends PaginationParams {
  query: string;
  status: CandidateStatus[];
  skills: string[];
  location: string;
  remote_only: boolean;
  salary_min: number;
  salary_max: number;
  industries: string[];
  experience_level: string;
  languages: string[];
  is_actively_looking: boolean;
  availability_date: string;
  certifications: string[];
}

// Types
export type CandidateFormData = Omit<Candidate, 'id' | 'created_at' | 'updated_at'>;

export type CandidateWithMatchScore = Candidate & {
  match_score: number;
  matched_jobs: number;
  skill_match_percentage: number;
  experience_match_percentage: number;
  location_match_score: number;
  cultural_fit_score: number;
  last_match_calculation: Date;
};

export type CandidateSearchResponse = {
  candidates: CandidateWithMatchScore[];
  total: number;
  page_count: number;
};

// Zod Validation Schemas
const workExperienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  start_date: z.date(),
  end_date: z.date().nullable(),
  description: z.string(),
  skills_used: z.array(z.string()),
  location: z.string(),
  is_current: z.boolean(),
  industry: z.string(),
  company_size: z.string(),
  achievements: z.array(z.string()),
  employment_type: z.string()
});

const educationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  field_of_study: z.string(),
  start_date: z.date(),
  end_date: z.date(),
  gpa: z.number().min(0).max(4).nullable(),
  achievements: z.array(z.string()),
  courses: z.array(z.string()),
  thesis_title: z.string(),
  is_verified: z.boolean()
});

const candidatePreferencesSchema = z.object({
  preferred_job_types: z.array(z.string()),
  preferred_locations: z.array(z.string()),
  remote_only: z.boolean(),
  salary_expectation_min: z.number().min(0),
  salary_expectation_max: z.number().min(0),
  open_to_relocation: z.boolean(),
  preferred_industries: z.array(z.string()),
  industry_experience: z.array(z.string()),
  notice_period_days: z.number().min(0),
  travel_willingness: z.string(),
  work_authorization: z.string(),
  preferred_company_sizes: z.array(z.string()),
  preferred_work_schedule: z.string(),
  willing_to_travel: z.boolean()
});

export const candidateSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string(),
  location: z.string(),
  status: z.nativeEnum(CandidateStatus),
  experience_level: z.string(),
  skills: z.array(z.string()),
  experience: z.array(workExperienceSchema),
  education: z.array(educationSchema),
  resume_url: z.string().url(),
  preferences: candidatePreferencesSchema,
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
  social_profiles: z.object({
    linkedin: z.string().url().optional(),
    github: z.string().url().optional(),
    portfolio: z.string().url().optional(),
    twitter: z.string().url().optional()
  }),
  summary: z.string(),
  last_active: z.date(),
  profile_complete: z.boolean()
});

export const candidateSearchParamsSchema = z.object({
  query: z.string(),
  status: z.array(z.nativeEnum(CandidateStatus)),
  skills: z.array(z.string()),
  location: z.string(),
  remote_only: z.boolean(),
  salary_min: z.number().min(0),
  salary_max: z.number().min(0),
  industries: z.array(z.string()),
  experience_level: z.string(),
  languages: z.array(z.string()),
  is_actively_looking: z.boolean(),
  availability_date: z.string(),
  certifications: z.array(z.string())
}).extend({
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100)
});