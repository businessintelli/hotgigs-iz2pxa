import { z } from 'zod'; // ^3.22.0
import { BaseEntity, UUID } from './common';
import { User } from './auth';
import { Candidate } from './candidates';

/**
 * Enum defining comprehensive types of interviews supported by the platform
 */
export enum InterviewType {
  TECHNICAL = 'TECHNICAL',
  HR = 'HR',
  BEHAVIORAL = 'BEHAVIORAL',
  SYSTEM_DESIGN = 'SYSTEM_DESIGN',
  FINAL = 'FINAL',
  PAIR_PROGRAMMING = 'PAIR_PROGRAMMING',
  TAKE_HOME = 'TAKE_HOME',
  CULTURE_FIT = 'CULTURE_FIT'
}

/**
 * Enum representing all possible states of an interview throughout its lifecycle
 */
export enum InterviewStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  RESCHEDULED = 'RESCHEDULED',
  CANCELLED = 'CANCELLED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
  PENDING_FEEDBACK = 'PENDING_FEEDBACK'
}

/**
 * Enum for comprehensive interview conducting modes including hybrid options
 */
export enum InterviewMode {
  VIDEO = 'VIDEO',
  PHONE = 'PHONE',
  IN_PERSON = 'IN_PERSON',
  HYBRID = 'HYBRID',
  ASYNC_VIDEO = 'ASYNC_VIDEO',
  TAKE_HOME_ASSIGNMENT = 'TAKE_HOME_ASSIGNMENT'
}

/**
 * Enum for standardized feedback ratings with numerical mapping
 */
export enum FeedbackRating {
  STRONG_YES = 'STRONG_YES',
  YES = 'YES',
  MAYBE = 'MAYBE',
  NO = 'NO',
  STRONG_NO = 'STRONG_NO'
}

/**
 * Enum for detailed skill proficiency assessment
 */
export enum ProficiencyLevel {
  EXPERT = 'EXPERT',
  ADVANCED = 'ADVANCED',
  INTERMEDIATE = 'INTERMEDIATE',
  BASIC = 'BASIC',
  NOVICE = 'NOVICE'
}

/**
 * Interface representing an interview session with enhanced scheduling and integration capabilities
 */
export interface Interview extends BaseEntity {
  candidate_id: UUID;
  job_id: UUID;
  type: InterviewType;
  status: InterviewStatus;
  mode: InterviewMode;
  scheduled_at: Date;
  duration_minutes: number;
  interviewer_ids: UUID[];
  meeting_link?: string;
  calendar_event_id?: string;
  video_recording_url?: string;
  meeting_platform?: string;
  location?: {
    address?: string;
    room?: string;
    floor?: string;
    building?: string;
    instructions?: string;
  };
  notes?: string;
  candidate_confirmed: boolean;
  interviewers_confirmed: boolean;
  feedback: InterviewFeedback[];
  calendar_metadata?: {
    event_id: string;
    attendees: string[];
    reminders: Array<{ type: string; minutes_before: number }>;
  };
  meeting_platform_metadata?: {
    platform_name: string;
    meeting_id: string;
    host_url: string;
    participant_url: string;
    password?: string;
  };
}

/**
 * Enhanced interface for comprehensive interview feedback collection
 */
export interface InterviewFeedback extends BaseEntity {
  interview_id: UUID;
  interviewer_id: UUID;
  overall_rating: FeedbackRating;
  skill_ratings: SkillAssessment[];
  strengths: string[];
  weaknesses: string[];
  detailed_notes: string;
  hire_recommendation: boolean;
  follow_up_questions: string[];
  structured_feedback?: {
    communication: number;
    technical_skills: number;
    problem_solving: number;
    cultural_fit: number;
    leadership: number;
  };
  behavioral_assessment?: {
    teamwork: number;
    initiative: number;
    adaptability: number;
    conflict_resolution: number;
  };
  technical_assessment?: {
    code_quality: number;
    system_design: number;
    problem_solving: number;
    best_practices: number;
  };
}

/**
 * Detailed interface for individual skill assessment in feedback
 */
export interface SkillAssessment {
  skill_name: string;
  proficiency_level: ProficiencyLevel;
  rating: number;
  detailed_comments: string;
  evidence_examples: string[];
  assessment_criteria?: {
    theoretical_knowledge: number;
    practical_application: number;
    problem_solving: number;
  };
  improvement_suggestions?: {
    areas: string[];
    resources: string[];
    timeline: string;
  };
}

/**
 * Comprehensive interface for interview scheduling parameters
 */
export interface InterviewScheduleParams {
  candidate_id: UUID;
  job_id: UUID;
  type: InterviewType;
  mode: InterviewMode;
  scheduled_at: Date;
  duration_minutes: number;
  interviewer_ids: UUID[];
  location?: object;
  notes?: string;
  calendar_preferences?: {
    send_calendar_invites: boolean;
    reminder_times: number[];
    include_meeting_link: boolean;
  };
  platform_preferences?: {
    preferred_platform: string;
    require_password: boolean;
    waiting_room_enabled: boolean;
  };
  notification_preferences?: {
    send_email: boolean;
    send_sms: boolean;
    reminder_hours_before: number[];
  };
}

/**
 * Type alias for interview identifier
 */
export type InterviewId = UUID;

/**
 * Type combining interview data with detailed participant information
 */
export type InterviewWithParticipants = Interview & {
  candidate: Candidate;
  interviewers: User[];
  job: Job;
};

/**
 * Type for interview update operations with partial fields
 */
export type InterviewUpdatePayload = Partial<Omit<Interview, 'id' | 'created_at' | 'updated_at' | 'feedback'>>;

// Zod schemas for runtime validation

export const interviewTypeSchema = z.nativeEnum(InterviewType);
export const interviewStatusSchema = z.nativeEnum(InterviewStatus);
export const interviewModeSchema = z.nativeEnum(InterviewMode);
export const feedbackRatingSchema = z.nativeEnum(FeedbackRating);
export const proficiencyLevelSchema = z.nativeEnum(ProficiencyLevel);

export const skillAssessmentSchema = z.object({
  skill_name: z.string(),
  proficiency_level: proficiencyLevelSchema,
  rating: z.number().min(1).max(10),
  detailed_comments: z.string(),
  evidence_examples: z.array(z.string()),
  assessment_criteria: z.object({
    theoretical_knowledge: z.number().min(1).max(10),
    practical_application: z.number().min(1).max(10),
    problem_solving: z.number().min(1).max(10),
  }).optional(),
  improvement_suggestions: z.object({
    areas: z.array(z.string()),
    resources: z.array(z.string()),
    timeline: z.string(),
  }).optional(),
});

export const interviewFeedbackSchema = z.object({
  interview_id: z.string().uuid(),
  interviewer_id: z.string().uuid(),
  overall_rating: feedbackRatingSchema,
  skill_ratings: z.array(skillAssessmentSchema),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  detailed_notes: z.string(),
  hire_recommendation: z.boolean(),
  follow_up_questions: z.array(z.string()),
  structured_feedback: z.object({
    communication: z.number().min(1).max(10),
    technical_skills: z.number().min(1).max(10),
    problem_solving: z.number().min(1).max(10),
    cultural_fit: z.number().min(1).max(10),
    leadership: z.number().min(1).max(10),
  }).optional(),
  behavioral_assessment: z.object({
    teamwork: z.number().min(1).max(10),
    initiative: z.number().min(1).max(10),
    adaptability: z.number().min(1).max(10),
    conflict_resolution: z.number().min(1).max(10),
  }).optional(),
  technical_assessment: z.object({
    code_quality: z.number().min(1).max(10),
    system_design: z.number().min(1).max(10),
    problem_solving: z.number().min(1).max(10),
    best_practices: z.number().min(1).max(10),
  }).optional(),
});

export const interviewSchema = z.object({
  candidate_id: z.string().uuid(),
  job_id: z.string().uuid(),
  type: interviewTypeSchema,
  status: interviewStatusSchema,
  mode: interviewModeSchema,
  scheduled_at: z.date(),
  duration_minutes: z.number().min(15).max(480),
  interviewer_ids: z.array(z.string().uuid()),
  meeting_link: z.string().url().optional(),
  calendar_event_id: z.string().optional(),
  video_recording_url: z.string().url().optional(),
  meeting_platform: z.string().optional(),
  location: z.object({
    address: z.string().optional(),
    room: z.string().optional(),
    floor: z.string().optional(),
    building: z.string().optional(),
    instructions: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
  candidate_confirmed: z.boolean(),
  interviewers_confirmed: z.boolean(),
  feedback: z.array(interviewFeedbackSchema),
  calendar_metadata: z.object({
    event_id: z.string(),
    attendees: z.array(z.string()),
    reminders: z.array(z.object({
      type: z.string(),
      minutes_before: z.number(),
    })),
  }).optional(),
  meeting_platform_metadata: z.object({
    platform_name: z.string(),
    meeting_id: z.string(),
    host_url: z.string(),
    participant_url: z.string(),
    password: z.string().optional(),
  }).optional(),
});