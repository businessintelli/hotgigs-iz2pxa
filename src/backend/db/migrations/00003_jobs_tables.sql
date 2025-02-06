-- Migration: Jobs Tables
-- Version: 1.0.0
-- Description: Creates and configures jobs-related tables with comprehensive fields, indexing, and security

-- Create job status enum type
CREATE TYPE job_status AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'CLOSED',
  'FILLED',
  'ARCHIVED'
);

-- Create job type enum type
CREATE TYPE job_type AS ENUM (
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERNSHIP',
  'REMOTE'
);

-- Create experience level enum type
CREATE TYPE experience_level AS ENUM (
  'ENTRY',
  'JUNIOR',
  'MID',
  'SENIOR',
  'LEAD',
  'EXECUTIVE'
);

-- Create jobs table with comprehensive fields
CREATE TABLE public.jobs (
  -- Base fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Core job details
  title VARCHAR(255) NOT NULL CHECK (length(title) >= 3),
  description TEXT NOT NULL CHECK (length(description) >= 50),
  creator_id UUID NOT NULL REFERENCES auth.users(id),
  status job_status NOT NULL DEFAULT 'DRAFT',
  type job_type NOT NULL,
  
  -- Skills and requirements
  skills TEXT[] NOT NULL DEFAULT '{}',
  
  -- Compensation and location
  salary_min NUMERIC(10,2) NOT NULL CHECK (salary_min >= 0),
  salary_max NUMERIC(10,2) NOT NULL,
  location VARCHAR(255) NOT NULL,
  remote_allowed BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  posted_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT salary_range_check CHECK (salary_max >= salary_min),
  CONSTRAINT valid_dates_check CHECK (
    (posted_at IS NULL OR posted_at >= created_at) AND
    (closed_at IS NULL OR (closed_at >= posted_at AND closed_at >= created_at))
  )
);

-- Create job requirements table with detailed tracking
CREATE TABLE public.job_requirements (
  -- Base fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Relationship
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  -- Experience requirements
  experience_level experience_level NOT NULL,
  years_experience INTEGER NOT NULL CHECK (years_experience >= 0),
  
  -- Skills and qualifications
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  preferred_skills TEXT[] NOT NULL DEFAULT '{}',
  qualifications TEXT[] NOT NULL DEFAULT '{}',
  responsibilities TEXT[] NOT NULL DEFAULT '{}',
  
  -- Constraint to ensure at least one required skill
  CONSTRAINT min_required_skills CHECK (array_length(required_skills, 1) > 0)
);

-- Create optimized indexes for jobs table
CREATE INDEX idx_jobs_creator_id ON public.jobs(creator_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_posted_at ON public.jobs(posted_at DESC NULLS LAST);
CREATE INDEX idx_jobs_skills ON public.jobs USING GIN (skills);
CREATE INDEX idx_jobs_location ON public.jobs(location);
CREATE INDEX idx_jobs_salary_range ON public.jobs(salary_min, salary_max);
CREATE INDEX idx_jobs_type ON public.jobs(type);
CREATE INDEX idx_jobs_remote ON public.jobs(remote_allowed) WHERE remote_allowed = true;

-- Create indexes for job requirements table
CREATE INDEX idx_job_requirements_job_id ON public.job_requirements(job_id);
CREATE INDEX idx_job_requirements_experience ON public.job_requirements(experience_level, years_experience);
CREATE INDEX idx_job_requirements_required_skills ON public.job_requirements USING GIN (required_skills);
CREATE INDEX idx_job_requirements_preferred_skills ON public.job_requirements USING GIN (preferred_skills);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_jobs_timestamp
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_requirements_timestamp
  BEFORE UPDATE ON public.job_requirements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requirements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for jobs table
CREATE POLICY jobs_select ON public.jobs
  FOR SELECT USING (
    status = 'PUBLISHED' OR
    auth.jwt() ->> 'role' = 'ADMIN' OR
    creator_id::text = auth.jwt() ->> 'sub'
  );

CREATE POLICY jobs_insert ON public.jobs
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' IN ('ADMIN', 'RECRUITER')
  );

CREATE POLICY jobs_update ON public.jobs
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'ADMIN' OR
    creator_id::text = auth.jwt() ->> 'sub'
  );

CREATE POLICY jobs_delete ON public.jobs
  FOR DELETE USING (
    auth.jwt() ->> 'role' = 'ADMIN' OR
    creator_id::text = auth.jwt() ->> 'sub'
  );

-- Create RLS policies for job requirements table
CREATE POLICY job_requirements_select ON public.job_requirements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = job_requirements.job_id
      AND (
        jobs.status = 'PUBLISHED' OR
        auth.jwt() ->> 'role' = 'ADMIN' OR
        jobs.creator_id::text = auth.jwt() ->> 'sub'
      )
    )
  );

CREATE POLICY job_requirements_insert ON public.job_requirements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = job_requirements.job_id
      AND (
        auth.jwt() ->> 'role' = 'ADMIN' OR
        jobs.creator_id::text = auth.jwt() ->> 'sub'
      )
    )
  );

CREATE POLICY job_requirements_update ON public.job_requirements
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = job_requirements.job_id
      AND (
        auth.jwt() ->> 'role' = 'ADMIN' OR
        jobs.creator_id::text = auth.jwt() ->> 'sub'
      )
    )
  );

-- Add table comments
COMMENT ON TABLE public.jobs IS 'Stores job postings with comprehensive details and security controls';
COMMENT ON TABLE public.job_requirements IS 'Stores detailed job requirements and qualifications';

-- Add column comments
COMMENT ON COLUMN public.jobs.creator_id IS 'References the user who created the job posting';
COMMENT ON COLUMN public.jobs.skills IS 'Array of required skills for the position';
COMMENT ON COLUMN public.jobs.salary_min IS 'Minimum salary for the position';
COMMENT ON COLUMN public.jobs.salary_max IS 'Maximum salary for the position';
COMMENT ON COLUMN public.job_requirements.required_skills IS 'Array of mandatory skills for the position';
COMMENT ON COLUMN public.job_requirements.preferred_skills IS 'Array of desired but not mandatory skills';