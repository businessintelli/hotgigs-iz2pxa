-- Migration: Interview Tables
-- Version: 1.0.0
-- Description: Creates and configures comprehensive interview management tables with scheduling, feedback, and skill assessment capabilities

-- Create interview type enum
CREATE TYPE interview_type AS ENUM (
  'TECHNICAL',
  'HR',
  'BEHAVIORAL',
  'SYSTEM_DESIGN',
  'FINAL'
);

-- Create interview status enum
CREATE TYPE interview_status AS ENUM (
  'SCHEDULED',
  'RESCHEDULED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW'
);

-- Create interview mode enum
CREATE TYPE interview_mode AS ENUM (
  'VIDEO',
  'PHONE',
  'IN_PERSON'
);

-- Create feedback rating enum
CREATE TYPE feedback_rating AS ENUM (
  'STRONG_YES',
  'YES',
  'MAYBE',
  'NO',
  'STRONG_NO'
);

-- Create interviews table with partitioning support
CREATE TABLE public.interviews (
  -- Base fields
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Core interview details
  candidate_id UUID NOT NULL REFERENCES public.candidates(id),
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  type interview_type NOT NULL,
  status interview_status NOT NULL DEFAULT 'SCHEDULED',
  mode interview_mode NOT NULL,

  -- Scheduling information
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  interviewer_ids UUID[] NOT NULL,
  meeting_link TEXT,
  calendar_event_id TEXT,
  location TEXT,
  notes TEXT,

  -- Constraints
  CONSTRAINT valid_duration CHECK (duration_minutes BETWEEN 15 AND 480),
  CONSTRAINT valid_schedule CHECK (scheduled_at > created_at),
  CONSTRAINT min_interviewers CHECK (array_length(interviewer_ids, 1) > 0)
) PARTITION BY RANGE (scheduled_at);

-- Create interview feedback table
CREATE TABLE public.interview_feedback (
  -- Base fields
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES auth.users(id),

  -- Feedback details
  interview_id UUID NOT NULL REFERENCES public.interviews(id),
  interviewer_id UUID NOT NULL REFERENCES auth.users(id),
  overall_rating feedback_rating NOT NULL,
  strengths TEXT,
  weaknesses TEXT,
  notes TEXT,
  hire_recommendation BOOLEAN NOT NULL,
  additional_feedback JSONB,

  -- Constraints
  CONSTRAINT unique_interviewer_feedback UNIQUE (interview_id, interviewer_id)
);

-- Create skill assessments table
CREATE TABLE public.skill_assessments (
  -- Base fields
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Assessment details
  feedback_id UUID NOT NULL REFERENCES public.interview_feedback(id),
  skill_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comments TEXT,
  assessment_metadata JSONB,

  -- Constraints
  CONSTRAINT unique_skill_assessment UNIQUE (feedback_id, skill_name)
);

-- Create partitions for interviews table
CREATE TABLE interviews_2024_01 PARTITION OF interviews
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE interviews_2024_02 PARTITION OF interviews
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Create indexes for optimized queries
CREATE INDEX idx_interviews_candidate_id ON interviews(candidate_id);
CREATE INDEX idx_interviews_job_id ON interviews(job_id);
CREATE INDEX idx_interviews_scheduled_at ON interviews(scheduled_at);
CREATE INDEX idx_interviews_status ON interviews(status);
CREATE INDEX idx_interviews_type ON interviews(type);
CREATE INDEX idx_interviews_interviewers ON interviews USING GIN (interviewer_ids);

CREATE INDEX idx_interview_feedback_interview_id ON interview_feedback(interview_id);
CREATE INDEX idx_interview_feedback_interviewer_id ON interview_feedback(interviewer_id);
CREATE INDEX idx_interview_feedback_rating ON interview_feedback(overall_rating);
CREATE INDEX idx_interview_feedback_recommendation ON interview_feedback(hire_recommendation);

CREATE INDEX idx_skill_assessments_feedback_id ON skill_assessments(feedback_id);
CREATE INDEX idx_skill_assessments_skill_name ON skill_assessments(skill_name);
CREATE INDEX idx_skill_assessments_rating ON skill_assessments(rating);

-- Add update triggers
CREATE TRIGGER update_interviews_timestamp
  BEFORE UPDATE ON interviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_feedback_timestamp
  BEFORE UPDATE ON interview_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skill_assessments_timestamp
  BEFORE UPDATE ON skill_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_assessments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY interviews_select ON interviews
  FOR SELECT USING (
    auth.jwt() ->> 'role' IN ('ADMIN', 'RECRUITER')
    OR created_by::text = auth.jwt() ->> 'sub'
    OR auth.jwt() ->> 'sub' = ANY(interviewer_ids)
  );

CREATE POLICY interviews_insert ON interviews
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' IN ('ADMIN', 'RECRUITER')
  );

CREATE POLICY interviews_update ON interviews
  FOR UPDATE USING (
    auth.jwt() ->> 'role' IN ('ADMIN', 'RECRUITER')
    OR created_by::text = auth.jwt() ->> 'sub'
  );

CREATE POLICY feedback_select ON interview_feedback
  FOR SELECT USING (
    auth.jwt() ->> 'role' IN ('ADMIN', 'RECRUITER')
    OR interviewer_id::text = auth.jwt() ->> 'sub'
  );

CREATE POLICY feedback_insert ON interview_feedback
  FOR INSERT WITH CHECK (
    interviewer_id::text = auth.jwt() ->> 'sub'
  );

-- Add audit logging
CREATE TRIGGER audit_interviews_changes
  AFTER INSERT OR UPDATE OR DELETE ON interviews
  FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER audit_interview_feedback_changes
  AFTER INSERT OR UPDATE OR DELETE ON interview_feedback
  FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER audit_skill_assessments_changes
  AFTER INSERT OR UPDATE OR DELETE ON skill_assessments
  FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

-- Add table comments
COMMENT ON TABLE interviews IS 'Stores interview scheduling and management data';
COMMENT ON TABLE interview_feedback IS 'Stores comprehensive interview feedback from interviewers';
COMMENT ON TABLE skill_assessments IS 'Stores detailed skill-wise assessments from interviews';