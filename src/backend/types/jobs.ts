import { z } from 'zod'; // ^3.22.0
import { BaseEntity, PaginationParams } from '../types/common';

/**
 * Enum representing possible states of a job posting throughout its lifecycle
 */
export enum JobStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
  FILLED = 'FILLED',
  ARCHIVED = 'ARCHIVED'
}

/**
 * Enum for different types of job positions and employment arrangements
 */
export enum JobType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
  REMOTE = 'REMOTE'
}

/**
 * Enum for job experience level requirements and seniority
 */
export enum ExperienceLevel {
  ENTRY = 'ENTRY',
  JUNIOR = 'JUNIOR',
  MID = 'MID',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
  EXECUTIVE = 'EXECUTIVE'
}

/**
 * Detailed interface for job requirements specification
 */
export interface JobRequirements {
  experience_level: ExperienceLevel;
  years_experience: number;
  required_skills: string[];
  preferred_skills: string[];
  qualifications: string[];
  responsibilities: string[];
}

/**
 * Comprehensive interface representing a job posting with all required fields
 */
export interface Job extends BaseEntity {
  title: string;
  description: string;
  creator_id: UUID;
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
}

/**
 * Type alias for job identifier using UUID
 */
export type JobId = UUID;

/**
 * Extended type for job with candidate matching information
 */
export type JobWithMatches = Job & {
  match_score: number;
  matched_candidates: number;
};

/**
 * Type for job update operations with strict partial fields
 */
export type JobUpdatePayload = Partial<Omit<Job, 'id' | 'creator_id' | 'created_at' | 'updated_at'>>;

/**
 * Comprehensive interface for job search query parameters with filtering options
 */
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
}

// Zod schema for job requirements validation
export const jobRequirementsSchema = z.object({
  experience_level: z.nativeEnum(ExperienceLevel),
  years_experience: z.number().min(0),
  required_skills: z.array(z.string()),
  preferred_skills: z.array(z.string()),
  qualifications: z.array(z.string()),
  responsibilities: z.array(z.string())
});

// Zod schema for job validation
export const jobSchema = z.object({
  title: z.string().min(1).max(255),
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
  remote_allowed: z.boolean()
});

// Zod schema for job search parameters validation
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
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100)
});

// Zod schema for job update payload validation
export const jobUpdatePayloadSchema = jobSchema.partial().omit({
  id: true,
  creator_id: true,
  created_at: true,
  updated_at: true
});