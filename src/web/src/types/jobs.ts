import { z } from 'zod'; // v3.22.0
import { BaseEntity, PaginationParams } from '../types/common';

// Enums
export enum JobStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
  FILLED = 'FILLED',
  ARCHIVED = 'ARCHIVED'
}

export enum JobType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
  REMOTE = 'REMOTE'
}

export enum ExperienceLevel {
  ENTRY = 'ENTRY',
  JUNIOR = 'JUNIOR',
  MID = 'MID',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
  EXECUTIVE = 'EXECUTIVE'
}

// Type Definitions
export type JobId = string & { readonly __brand: unique symbol };

// Interfaces
export interface JobRequirements {
  experience_level: ExperienceLevel;
  years_experience: number;
  required_skills: string[];
  preferred_skills: string[];
  qualifications: string[];
  responsibilities: string[];
  certifications: string[];
  education_requirements: string[];
  languages: string[];
  skill_proficiency: Record<string, number>;
  background_check_required: boolean;
  tools_and_technologies: string[];
}

export interface Job extends BaseEntity {
  title: string;
  description: string;
  creator_id: string;
  requirements: JobRequirements;
  status: JobStatus;
  type: JobType;
  skills: string[];
  posted_at: Date;
  closed_at: Date | null;
  salary_min: number;
  salary_max: number;
  location: string;
  remote_allowed: boolean;
  department: string;
  benefits: string[];
  metadata: Record<string, unknown>;
  views_count: number;
  applications_count: number;
  tags: string[];
  is_featured: boolean;
  expires_at: Date | null;
}

export interface JobFormData {
  title: string;
  description: string;
  requirements: JobRequirements;
  type: JobType;
  skills: string[];
  salary_min: number;
  salary_max: number;
  location: string;
  remote_allowed: boolean;
  department: string;
  benefits: string[];
  is_draft: boolean;
  publish_date: Date | null;
  form_state: FormMetadata;
  validation: ValidationRules;
  attachments: string[];
}

export interface JobSearchParams extends PaginationParams {
  query: string;
  status: JobStatus[];
  type: JobType[];
  skills: string[];
  experience_level: ExperienceLevel[];
  location: string;
  remote_only: boolean;
  salary_min: number;
  salary_max: number;
  departments: string[];
  posted_after: string;
  posted_before: string;
  tags: string[];
  featured_only: boolean;
  sort_by: string;
  sort_direction: string;
  filters: Record<string, unknown>;
}

export type JobWithMatches = Job & {
  match_score: number;
  matched_candidates: number;
  match_criteria: Record<string, number>;
  match_timestamp: Date;
  candidate_profiles: Array<{
    id: string;
    score: number;
    matching_skills: string[];
  }>;
};

export type JobUpdatePayload = Partial<Omit<JobFormData, 'id'>> & {
  status_transition?: {
    from: JobStatus;
    to: JobStatus;
  };
  audit: {
    updated_by: string;
    reason: string;
    timestamp: Date;
  };
};

// Zod Schemas for Runtime Validation
export const jobRequirementsSchema = z.object({
  experience_level: z.nativeEnum(ExperienceLevel),
  years_experience: z.number().min(0),
  required_skills: z.array(z.string()),
  preferred_skills: z.array(z.string()),
  qualifications: z.array(z.string()),
  responsibilities: z.array(z.string()),
  certifications: z.array(z.string()),
  education_requirements: z.array(z.string()),
  languages: z.array(z.string()),
  skill_proficiency: z.record(z.number().min(0).max(100)),
  background_check_required: z.boolean(),
  tools_and_technologies: z.array(z.string())
});

export const jobSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  creator_id: z.string().uuid(),
  requirements: jobRequirementsSchema,
  status: z.nativeEnum(JobStatus),
  type: z.nativeEnum(JobType),
  skills: z.array(z.string()),
  posted_at: z.date(),
  closed_at: z.date().nullable(),
  salary_min: z.number().min(0),
  salary_max: z.number().min(0),
  location: z.string(),
  remote_allowed: z.boolean(),
  department: z.string(),
  benefits: z.array(z.string()),
  metadata: z.record(z.unknown()),
  views_count: z.number().min(0),
  applications_count: z.number().min(0),
  tags: z.array(z.string()),
  is_featured: z.boolean(),
  expires_at: z.date().nullable()
});

export const jobSearchParamsSchema = z.object({
  query: z.string(),
  status: z.array(z.nativeEnum(JobStatus)),
  type: z.array(z.nativeEnum(JobType)),
  skills: z.array(z.string()),
  experience_level: z.array(z.nativeEnum(ExperienceLevel)),
  location: z.string(),
  remote_only: z.boolean(),
  salary_min: z.number().min(0),
  salary_max: z.number().min(0),
  departments: z.array(z.string()),
  posted_after: z.string(),
  posted_before: z.string(),
  tags: z.array(z.string()),
  featured_only: z.boolean(),
  sort_by: z.string(),
  sort_direction: z.string(),
  filters: z.record(z.unknown())
}).extend({
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100)
});

interface FormMetadata {
  is_dirty: boolean;
  touched_fields: string[];
  last_saved: Date | null;
}

interface ValidationRules {
  required_fields: string[];
  custom_validators: Record<string, (value: unknown) => boolean>;
  async_validators: Record<string, (value: unknown) => Promise<boolean>>;
}