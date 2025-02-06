import { z } from 'zod'; // ^3.22.0
import { Interview, InterviewType, InterviewStatus, InterviewMode, InterviewFeedback, FeedbackRating, ProficiencyLevel } from '../../types/interviews';
import { BaseEntity } from '../../types/common';

// Constants for database configuration
const TABLE_NAME = 'interviews';
const SCHEMA_VERSION = '1.1';
const FEEDBACK_TABLE_NAME = 'interview_feedback';
const CALENDAR_METADATA_VERSION = '1.0';

/**
 * Generates SQL for creating the interviews table with comprehensive field definitions and constraints
 */
export function createInterviewTable(): string {
  return `
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      -- Base entity fields
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

      -- Core interview fields
      candidate_id UUID NOT NULL REFERENCES candidates(id),
      job_id UUID NOT NULL REFERENCES jobs(id),
      type TEXT NOT NULL CHECK (type IN ('TECHNICAL', 'HR', 'BEHAVIORAL', 'SYSTEM_DESIGN', 'FINAL', 'PAIR_PROGRAMMING', 'TAKE_HOME', 'CULTURE_FIT')),
      status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'PENDING_FEEDBACK')),
      mode TEXT NOT NULL CHECK (mode IN ('VIDEO', 'PHONE', 'IN_PERSON', 'HYBRID', 'ASYNC_VIDEO', 'TAKE_HOME_ASSIGNMENT')),
      scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
      duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 480),
      interviewer_ids UUID[] NOT NULL,

      -- Meeting details
      meeting_link TEXT,
      calendar_event_id TEXT,
      video_recording_url TEXT,
      meeting_platform TEXT,
      location JSONB,
      notes TEXT,

      -- Confirmation status
      candidate_confirmed BOOLEAN NOT NULL DEFAULT false,
      interviewers_confirmed BOOLEAN NOT NULL DEFAULT false,

      -- Integration metadata
      calendar_metadata JSONB,
      meeting_platform_metadata JSONB,

      -- Constraints and indexes
      CONSTRAINT valid_duration CHECK (duration_minutes >= 15 AND duration_minutes <= 480),
      CONSTRAINT valid_scheduled_time CHECK (scheduled_at > created_at)
    ) PARTITION BY RANGE (scheduled_at);

    -- Indexes for common query patterns
    CREATE INDEX IF NOT EXISTS idx_interviews_candidate_id ON ${TABLE_NAME}(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_interviews_job_id ON ${TABLE_NAME}(job_id);
    CREATE INDEX IF NOT EXISTS idx_interviews_status ON ${TABLE_NAME}(status);
    CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at ON ${TABLE_NAME}(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_interviews_type ON ${TABLE_NAME}(type);
    CREATE INDEX IF NOT EXISTS idx_interviews_interviewer_ids ON ${TABLE_NAME} USING GIN(interviewer_ids);

    -- Trigger for updating updated_at timestamp
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER update_interviews_updated_at
      BEFORE UPDATE ON ${TABLE_NAME}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- Create feedback table
    CREATE TABLE IF NOT EXISTS ${FEEDBACK_TABLE_NAME} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      interview_id UUID NOT NULL REFERENCES ${TABLE_NAME}(id),
      interviewer_id UUID NOT NULL REFERENCES users(id),
      overall_rating TEXT NOT NULL CHECK (overall_rating IN ('STRONG_YES', 'YES', 'MAYBE', 'NO', 'STRONG_NO')),
      skill_ratings JSONB NOT NULL,
      strengths TEXT[] NOT NULL,
      weaknesses TEXT[] NOT NULL,
      detailed_notes TEXT NOT NULL,
      hire_recommendation BOOLEAN NOT NULL,
      follow_up_questions TEXT[] NOT NULL,
      structured_feedback JSONB,
      behavioral_assessment JSONB,
      technical_assessment JSONB,

      CONSTRAINT unique_interviewer_feedback UNIQUE(interview_id, interviewer_id)
    );
  `;
}

/**
 * Comprehensive Zod schema class for validating interview data
 */
export class InterviewSchema {
  private schema: z.ZodType<Interview>;

  constructor() {
    // Location schema
    const locationSchema = z.object({
      address: z.string().optional(),
      room: z.string().optional(),
      floor: z.string().optional(),
      building: z.string().optional(),
      instructions: z.string().optional()
    });

    // Calendar metadata schema
    const calendarMetadataSchema = z.object({
      event_id: z.string(),
      attendees: z.array(z.string().email()),
      reminders: z.array(z.object({
        type: z.string(),
        minutes_before: z.number().int().positive()
      }))
    });

    // Meeting platform metadata schema
    const meetingPlatformMetadataSchema = z.object({
      platform_name: z.string(),
      meeting_id: z.string(),
      host_url: z.string().url(),
      participant_url: z.string().url(),
      password: z.string().optional()
    });

    // Skill assessment schema
    const skillAssessmentSchema = z.object({
      skill_name: z.string(),
      proficiency_level: z.nativeEnum(ProficiencyLevel),
      rating: z.number().min(1).max(10),
      detailed_comments: z.string(),
      evidence_examples: z.array(z.string())
    });

    // Interview feedback schema
    const feedbackSchema = z.object({
      interview_id: z.string().uuid(),
      interviewer_id: z.string().uuid(),
      overall_rating: z.nativeEnum(FeedbackRating),
      skill_ratings: z.array(skillAssessmentSchema),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      detailed_notes: z.string(),
      hire_recommendation: z.boolean(),
      follow_up_questions: z.array(z.string())
    });

    // Complete interview schema
    this.schema = z.object({
      id: z.string().uuid(),
      created_at: z.date(),
      updated_at: z.date(),
      candidate_id: z.string().uuid(),
      job_id: z.string().uuid(),
      type: z.nativeEnum(InterviewType),
      status: z.nativeEnum(InterviewStatus),
      mode: z.nativeEnum(InterviewMode),
      scheduled_at: z.date(),
      duration_minutes: z.number().int().min(15).max(480),
      interviewer_ids: z.array(z.string().uuid()),
      meeting_link: z.string().url().optional(),
      calendar_event_id: z.string().optional(),
      video_recording_url: z.string().url().optional(),
      meeting_platform: z.string().optional(),
      location: locationSchema.optional(),
      notes: z.string().optional(),
      candidate_confirmed: z.boolean(),
      interviewers_confirmed: z.boolean(),
      feedback: z.array(feedbackSchema),
      calendar_metadata: calendarMetadataSchema.optional(),
      meeting_platform_metadata: meetingPlatformMetadataSchema.optional()
    });
  }

  /**
   * Validates interview data with comprehensive error handling
   */
  public validate(data: unknown): Interview {
    return this.schema.parse(data);
  }
}

// Export instances for external use
export const interviewSchema = new InterviewSchema();
export const interviewFeedbackSchema = z.object({
  interview_id: z.string().uuid(),
  interviewer_id: z.string().uuid(),
  overall_rating: z.nativeEnum(FeedbackRating),
  skill_ratings: z.array(z.object({
    skill_name: z.string(),
    proficiency_level: z.nativeEnum(ProficiencyLevel),
    rating: z.number().min(1).max(10),
    detailed_comments: z.string(),
    evidence_examples: z.array(z.string())
  })),
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
    leadership: z.number().min(1).max(10)
  }).optional(),
  behavioral_assessment: z.object({
    teamwork: z.number().min(1).max(10),
    initiative: z.number().min(1).max(10),
    adaptability: z.number().min(1).max(10),
    conflict_resolution: z.number().min(1).max(10)
  }).optional(),
  technical_assessment: z.object({
    code_quality: z.number().min(1).max(10),
    system_design: z.number().min(1).max(10),
    problem_solving: z.number().min(1).max(10),
    best_practices: z.number().min(1).max(10)
  }).optional()
});