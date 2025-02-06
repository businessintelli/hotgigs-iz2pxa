-- Initial database migration for HotGigs platform
-- Version: 1.0.0
-- Description: Establishes core schema structure with security measures, optimized indexing, and AI-matching capabilities

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID support
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- Encryption
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query analysis
CREATE EXTENSION IF NOT EXISTS "vector";         -- AI embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Text search
CREATE EXTENSION IF NOT EXISTS "btree_gist";     -- GiST indexes
CREATE EXTENSION IF NOT EXISTS "pg_partman";     -- Table partitioning
CREATE EXTENSION IF NOT EXISTS "pgaudit";        -- Audit logging

-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Audit logging function
CREATE OR REPLACE FUNCTION audit.log_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit.change_log (
        table_name,
        operation,
        old_data,
        new_data,
        changed_by,
        changed_at
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        current_user,
        current_timestamp
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit log table
CREATE TABLE IF NOT EXISTS audit.change_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL
);

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = current_timestamp;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users table with enhanced security
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'CANDIDATE', 'GUEST')),
    email_verified BOOLEAN DEFAULT FALSE,
    failed_attempts INTEGER DEFAULT 0,
    account_locked BOOLEAN DEFAULT FALSE,
    account_locked_until TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    last_password_change TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    password_history JSONB DEFAULT '[]',
    allowed_ip_addresses TEXT[] DEFAULT '{}',
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret TEXT,
    security_settings JSONB NOT NULL DEFAULT '{"require_mfa": false, "password_expiry_days": 90, "max_sessions": 5}',
    profile JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Jobs table with AI matching capabilities
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    creator_id UUID NOT NULL REFERENCES auth.users(id),
    requirements JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    type TEXT NOT NULL,
    skills TEXT[] NOT NULL,
    posted_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    salary_min INTEGER NOT NULL CHECK (salary_min >= 0),
    salary_max INTEGER NOT NULL,
    location TEXT NOT NULL,
    remote_allowed BOOLEAN NOT NULL DEFAULT false,
    ai_match_vector vector(1536), -- OpenAI embedding dimension
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT salary_range_check CHECK (salary_max >= salary_min),
    CONSTRAINT valid_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED', 'FILLED', 'ARCHIVED'))
);

-- Candidates table with advanced matching
CREATE TABLE public.candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    experience_level TEXT NOT NULL,
    skills TEXT[] NOT NULL,
    experience JSONB NOT NULL DEFAULT '[]',
    education JSONB NOT NULL DEFAULT '[]',
    resume_url TEXT,
    preferences JSONB NOT NULL DEFAULT '{}',
    ai_match_vector vector(1536), -- OpenAI embedding dimension
    match_scores JSONB DEFAULT '{}',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (status IN ('ACTIVE', 'PASSIVE', 'NOT_LOOKING', 'HIRED', 'ARCHIVED'))
) PARTITION BY RANGE (created_at);

-- Applications table with status tracking
CREATE TABLE public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.jobs(id),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id),
    status TEXT NOT NULL DEFAULT 'APPLIED',
    match_score NUMERIC CHECK (match_score >= 0 AND match_score <= 100),
    resume_version UUID,
    feedback JSONB DEFAULT '[]',
    stage_history JSONB DEFAULT '[]',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (status IN ('APPLIED', 'SCREENING', 'INTERVIEWING', 'OFFER_PENDING', 'OFFER_ACCEPTED', 'OFFER_DECLINED', 'REJECTED'))
) PARTITION BY RANGE (created_at);

-- Interviews table with scheduling
CREATE TABLE public.interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES public.applications(id),
    type TEXT NOT NULL,
    schedule_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL,
    location TEXT,
    meeting_link TEXT,
    interviewers UUID[] NOT NULL,
    feedback JSONB,
    status TEXT NOT NULL DEFAULT 'SCHEDULED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'))
) PARTITION BY RANGE (schedule_time);

-- Create partitions for candidates table
SELECT partman.create_parent(
    'public.candidates',
    'created_at',
    'native',
    'monthly'
);

-- Create partitions for applications table
SELECT partman.create_parent(
    'public.applications',
    'created_at',
    'native',
    'monthly'
);

-- Create partitions for interviews table
SELECT partman.create_parent(
    'public.interviews',
    'schedule_time',
    'native',
    'monthly'
);

-- Indexes for performance optimization
CREATE INDEX idx_jobs_title_trgm ON public.jobs USING GiST (title gist_trgm_ops);
CREATE INDEX idx_jobs_skills ON public.jobs USING GIN (skills);
CREATE INDEX idx_jobs_status ON public.jobs (status);
CREATE INDEX idx_jobs_location_trgm ON public.jobs USING GiST (location gist_trgm_ops);
CREATE INDEX idx_jobs_salary ON public.jobs (salary_min, salary_max);
CREATE INDEX idx_jobs_ai_match ON public.jobs USING ivfflat (ai_match_vector vector_cosine_ops);

CREATE INDEX idx_candidates_skills ON public.candidates USING GIN (skills);
CREATE INDEX idx_candidates_location_trgm ON public.candidates USING GiST (location gist_trgm_ops);
CREATE INDEX idx_candidates_status ON public.candidates (status);
CREATE INDEX idx_candidates_ai_match ON public.candidates USING ivfflat (ai_match_vector vector_cosine_ops);

CREATE INDEX idx_applications_status ON public.applications (status);
CREATE INDEX idx_applications_match_score ON public.applications (match_score DESC);

CREATE INDEX idx_interviews_schedule ON public.interviews (schedule_time);
CREATE INDEX idx_interviews_status ON public.interviews (status);

-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- Add update triggers for timestamp management
CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_timestamp
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_timestamp
    BEFORE UPDATE ON public.candidates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_timestamp
    BEFORE UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interviews_timestamp
    BEFORE UPDATE ON public.interviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add audit triggers
CREATE TRIGGER audit_users_changes
    AFTER INSERT OR UPDATE OR DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER audit_jobs_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER audit_candidates_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.candidates
    FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER audit_applications_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER audit_interviews_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.interviews
    FOR EACH ROW EXECUTE FUNCTION audit.log_changes();