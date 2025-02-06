-- Migration: Enhanced Candidates Tables
-- Version: 1.0.0
-- Description: Creates and configures comprehensive candidate management tables with AI matching capabilities,
-- enhanced security, and optimized performance

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- For UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- For data encryption
CREATE EXTENSION IF NOT EXISTS "vector";         -- For AI matching vectors
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- For text search

-- Create candidate status enum
CREATE TYPE candidate_status AS ENUM (
  'ACTIVE',
  'PASSIVE',
  'NOT_LOOKING',
  'HIRED',
  'ARCHIVED'
);

-- Create experience level enum
CREATE TYPE experience_level AS ENUM (
  'ENTRY',
  'JUNIOR',
  'MID',
  'SENIOR',
  'LEAD',
  'EXECUTIVE'
);

-- Create function to encrypt sensitive data
CREATE OR REPLACE FUNCTION candidates.encrypt_sensitive_data(data text)
RETURNS bytea AS $$
BEGIN
  RETURN pgp_sym_encrypt(
    data,
    current_setting('app.encryption_key')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to decrypt sensitive data
CREATE OR REPLACE FUNCTION candidates.decrypt_sensitive_data(encrypted_data bytea)
RETURNS text AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    encrypted_data,
    current_setting('app.encryption_key')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create enhanced candidates table
CREATE TABLE public.candidates (
  -- Base fields
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Profile information
  full_name TEXT NOT NULL,
  encrypted_email BYTEA NOT NULL,
  encrypted_phone BYTEA,
  location TEXT NOT NULL,
  status candidate_status NOT NULL DEFAULT 'ACTIVE',
  experience_level experience_level NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  resume_url TEXT,
  
  -- AI matching data
  profile_embedding vector(1536), -- OpenAI embedding dimension
  match_scores JSONB DEFAULT '{}',
  
  -- Additional data
  work_experience JSONB NOT NULL DEFAULT '[]',
  education JSONB NOT NULL DEFAULT '[]',
  preferences JSONB NOT NULL DEFAULT '{}',
  metadata JSONB,
  privacy_settings JSONB NOT NULL DEFAULT '{
    "share_profile": true,
    "share_contact": false,
    "share_education": true,
    "share_experience": true
  }',
  
  -- Constraints
  CONSTRAINT valid_full_name CHECK (length(full_name) BETWEEN 2 AND 200),
  CONSTRAINT valid_location CHECK (length(location) BETWEEN 2 AND 200),
  CONSTRAINT valid_skills CHECK (array_length(skills, 1) <= 50)
);

-- Create work experience table for normalized storage
CREATE TABLE public.candidate_work_experience (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  description TEXT,
  skills_used TEXT[] DEFAULT '{}',
  location TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  achievements TEXT[] DEFAULT '{}',
  industry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_date_range CHECK (
    end_date IS NULL OR start_date <= end_date
  )
);

-- Create education history table
CREATE TABLE public.candidate_education (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT NOT NULL,
  field_of_study TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  gpa NUMERIC(3,2) CHECK (gpa >= 0 AND gpa <= 4.0),
  achievements TEXT[] DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  certifications TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_date_range CHECK (start_date <= end_date)
);

-- Create candidate preferences table
CREATE TABLE public.candidate_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  preferred_job_types TEXT[] DEFAULT '{}',
  preferred_locations TEXT[] DEFAULT '{}',
  remote_only BOOLEAN NOT NULL DEFAULT false,
  salary_expectation_min INTEGER CHECK (salary_expectation_min >= 0),
  salary_expectation_max INTEGER,
  open_to_relocation BOOLEAN NOT NULL DEFAULT false,
  preferred_industries TEXT[] DEFAULT '{}',
  preferred_companies TEXT[] DEFAULT '{}',
  preferred_travel_percentage INTEGER CHECK (
    preferred_travel_percentage BETWEEN 0 AND 100
  ),
  excluded_industries TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_salary_range CHECK (
    salary_expectation_max >= salary_expectation_min
  )
);

-- Create indexes for optimized queries
CREATE INDEX idx_candidates_status ON public.candidates (status);
CREATE INDEX idx_candidates_experience_level ON public.candidates (experience_level);
CREATE INDEX idx_candidates_location ON public.candidates USING GiST (location gist_trgm_ops);
CREATE INDEX idx_candidates_skills ON public.candidates USING GIN (skills);
CREATE INDEX idx_candidates_embedding ON public.candidates USING ivfflat (profile_embedding vector_cosine_ops);

CREATE INDEX idx_work_experience_candidate ON public.candidate_work_experience (candidate_id);
CREATE INDEX idx_work_experience_company ON public.candidate_work_experience USING GiST (company gist_trgm_ops);
CREATE INDEX idx_work_experience_skills ON public.candidate_work_experience USING GIN (skills_used);

CREATE INDEX idx_education_candidate ON public.candidate_education (candidate_id);
CREATE INDEX idx_education_institution ON public.candidate_education USING GiST (institution gist_trgm_ops);

CREATE INDEX idx_preferences_candidate ON public.candidate_preferences (candidate_id);
CREATE INDEX idx_preferences_job_types ON public.candidate_preferences USING GIN (preferred_job_types);
CREATE INDEX idx_preferences_locations ON public.candidate_preferences USING GIN (preferred_locations);

-- Create trigger for updating timestamps
CREATE TRIGGER update_candidates_timestamp
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_experience_timestamp
  BEFORE UPDATE ON public.candidate_work_experience
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_education_timestamp
  BEFORE UPDATE ON public.candidate_education
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_timestamp
  BEFORE UPDATE ON public.candidate_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_work_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY candidates_select ON public.candidates
  FOR SELECT USING (
    auth.jwt() ->> 'role' IN ('ADMIN', 'RECRUITER')
    OR id::text = auth.jwt() ->> 'sub'
  );

CREATE POLICY candidates_insert ON public.candidates
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' IN ('ADMIN', 'RECRUITER')
  );

CREATE POLICY candidates_update ON public.candidates
  FOR UPDATE USING (
    auth.jwt() ->> 'role' IN ('ADMIN', 'RECRUITER')
    OR id::text = auth.jwt() ->> 'sub'
  );

-- Add audit logging triggers
CREATE TRIGGER audit_candidates_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER audit_work_experience_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.candidate_work_experience
  FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER audit_education_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.candidate_education
  FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER audit_preferences_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.candidate_preferences
  FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

-- Add comments for documentation
COMMENT ON TABLE public.candidates IS 'Enhanced candidates table with AI matching capabilities and security features';
COMMENT ON TABLE public.candidate_work_experience IS 'Normalized storage of candidate work history';
COMMENT ON TABLE public.candidate_education IS 'Candidate education history and certifications';
COMMENT ON TABLE public.candidate_preferences IS 'Candidate job preferences and requirements';