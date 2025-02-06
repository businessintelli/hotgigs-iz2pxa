import { z } from 'zod'; // v3.22.0
import { BaseEntity } from '../types/common';
import { Candidate } from '../types/candidates';
import { Job } from '../types/jobs';

// Enums for interview management
export enum InterviewType {
  TECHNICAL = 'TECHNICAL',
  HR = 'HR',
  BEHAVIORAL = 'BEHAVIORAL',
  SYSTEM_DESIGN = 'SYSTEM_DESIGN',
  FINAL = 'FINAL'
}

export enum InterviewStatus {
  SCHEDULED = 'SCHEDULED',
  RESCHEDULED = 'RESCHEDULED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW'
}

export enum InterviewMode {
  VIDEO = 'VIDEO',
  PHONE = 'PHONE',
  IN_PERSON = 'IN_PERSON'
}

export enum FeedbackRating {
  STRONG_YES = 'STRONG_YES',
  YES = 'YES',
  MAYBE = 'MAYBE',
  NO = 'NO',
  STRONG_NO = 'STRONG_NO'
}

// Core interview interfaces
export interface Interview extends BaseEntity {
  candidate_id: string;
  job_id: string;
  type: InterviewType;
  status: InterviewStatus;
  mode: InterviewMode;
  scheduled_at: Date;
  duration_minutes: number;
  interviewer_ids: string[];
  meeting_link: string | null;
  calendar_event_id: string | null;
  location: string | null;
  notes: string | null;
  feedback: InterviewFeedback[];
}

export interface InterviewFeedback extends BaseEntity {
  interview_id: string;
  interviewer_id: string;
  overall_rating: FeedbackRating;
  skill_ratings: SkillAssessment[];
  strengths: string;
  weaknesses: string;
  notes: string;
  hire_recommendation: boolean;
}

export interface SkillAssessment {
  skill_name: string;
  rating: number; // 1-5 scale
  comments: string;
}

// Parameters for interview scheduling
export interface InterviewScheduleParams {
  candidate_id: string;
  job_id: string;
  type: InterviewType;
  mode: InterviewMode;
  scheduled_at: Date;
  duration_minutes: number;
  interviewer_ids: string[];
  location?: string;
  notes?: string;
}

// Combined type with participant details
export type InterviewWithParticipants = Interview & {
  candidate: Candidate;
  job: Job;
};

// Form data type for interview scheduling
export type InterviewFormData = Omit<InterviewScheduleParams, 'id' | 'created_at' | 'updated_at'>;

// Zod validation schemas
const skillAssessmentSchema = z.object({
  skill_name: z.string().min(1),
  rating: z.number().min(1).max(5),
  comments: z.string()
});

export const interviewFeedbackSchema = z.object({
  interview_id: z.string().uuid(),
  interviewer_id: z.string().uuid(),
  overall_rating: z.nativeEnum(FeedbackRating),
  skill_ratings: z.array(skillAssessmentSchema),
  strengths: z.string(),
  weaknesses: z.string(),
  notes: z.string(),
  hire_recommendation: z.boolean()
});

export const interviewSchema = z.object({
  candidate_id: z.string().uuid(),
  job_id: z.string().uuid(),
  type: z.nativeEnum(InterviewType),
  status: z.nativeEnum(InterviewStatus),
  mode: z.nativeEnum(InterviewMode),
  scheduled_at: z.date(),
  duration_minutes: z.number().min(15).max(240),
  interviewer_ids: z.array(z.string().uuid()),
  meeting_link: z.string().url().nullable(),
  calendar_event_id: z.string().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  feedback: z.array(interviewFeedbackSchema)
});

export const interviewScheduleSchema = z.object({
  candidate_id: z.string().uuid(),
  job_id: z.string().uuid(),
  type: z.nativeEnum(InterviewType),
  mode: z.nativeEnum(InterviewMode),
  scheduled_at: z.date(),
  duration_minutes: z.number().min(15).max(240),
  interviewer_ids: z.array(z.string().uuid()),
  location: z.string().optional(),
  notes: z.string().optional()
});

export type InterviewValidationSchema = typeof interviewScheduleSchema;