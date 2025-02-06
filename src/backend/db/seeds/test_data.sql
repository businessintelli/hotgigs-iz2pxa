-- Test Data Generation SQL for HotGigs Platform
-- Schema Version: 1.0
-- Generated for: Development, Testing and Security Validation

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clean up existing test data
TRUNCATE TABLE users, jobs, candidates, applications, interviews, matches CASCADE;

-- Reset sequences
ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1;

-- Function to generate random date within range
CREATE OR REPLACE FUNCTION random_date(start_date timestamp, end_date timestamp) 
RETURNS timestamp AS $$
BEGIN
    RETURN start_date + random() * (end_date - start_date);
END;
$$ LANGUAGE plpgsql;

-- Test Users Data
INSERT INTO users (id, email, password_hash, full_name, role, email_verified, failed_attempts, 
                  account_locked, security_settings, profile, created_at) 
VALUES
  -- Admin Users
  (uuid_generate_v4(), 'admin@hotgigs.com', 
   '$2a$10$k4Qqz.Rqj5zqkz9qZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5',
   'System Administrator', 'ADMIN', true, 0, false,
   '{"require_mfa": true, "password_expiry_days": 30, "max_sessions": 2, "ip_whitelist_enabled": true}',
   '{"timezone": "UTC", "notification_preferences": {"email": true, "sms": true}}',
   NOW()),

  -- Recruiter Users
  (uuid_generate_v4(), 'recruiter1@hotgigs.com',
   '$2a$10$k4Qqz.Rqj5zqkz9qZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5',
   'Jane Smith', 'RECRUITER', true, 0, false,
   '{"require_mfa": true, "password_expiry_days": 60}',
   '{"team": "Engineering", "timezone": "America/New_York"}',
   NOW()),

  -- Hiring Manager Users
  (uuid_generate_v4(), 'manager1@hotgigs.com',
   '$2a$10$k4Qqz.Rqj5zqkz9qZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5',
   'John Doe', 'HIRING_MANAGER', true, 0, false,
   '{"require_mfa": false, "password_expiry_days": 90}',
   '{"department": "Engineering", "timezone": "America/Los_Angeles"}',
   NOW()),

  -- Candidate Users with varying completion levels
  (uuid_generate_v4(), 'candidate1@example.com',
   '$2a$10$k4Qqz.Rqj5zqkz9qZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5',
   'Alice Johnson', 'CANDIDATE', true, 0, false,
   '{"require_mfa": false}',
   '{"profile_completion": 100, "is_searchable": true}',
   NOW());

-- Test Jobs Data with AI Matching Metadata
INSERT INTO jobs (id, title, description, creator_id, requirements, status, type,
                 skills, posted_at, salary_min, salary_max, location, remote_allowed)
SELECT 
  uuid_generate_v4(),
  'Senior Software Engineer',
  'Looking for an experienced software engineer to join our team...',
  (SELECT id FROM users WHERE role = 'RECRUITER' LIMIT 1),
  '{
    "experience_level": "SENIOR",
    "years_experience": 5,
    "required_skills": ["React", "TypeScript", "Node.js"],
    "preferred_skills": ["AWS", "Docker", "Kubernetes"],
    "qualifications": ["Bachelor''s in Computer Science or related field"],
    "responsibilities": ["Lead development team", "Architecture design"]
  }'::jsonb,
  'PUBLISHED',
  'FULL_TIME',
  ARRAY['React', 'TypeScript', 'Node.js', 'AWS'],
  NOW(),
  120000,
  180000,
  'San Francisco, CA',
  true;

-- Test Candidates Data with AI Matching Profiles
INSERT INTO candidates (id, full_name, email, phone, location, status,
                       experience_level, skills, experience, education,
                       preferences, ai_matching_data)
VALUES (
  uuid_generate_v4(),
  'Bob Wilson',
  'bob.wilson@example.com',
  '+1234567890',
  'New York, NY',
  'ACTIVE',
  'SENIOR',
  ARRAY['React', 'TypeScript', 'Node.js', 'AWS', 'Python'],
  '[{
    "company": "Tech Corp",
    "title": "Senior Developer",
    "start_date": "2018-01-01",
    "end_date": null,
    "description": "Led development team...",
    "skills_used": ["React", "TypeScript", "AWS"],
    "location": "New York, NY",
    "is_current": true,
    "achievements": ["Increased deployment efficiency by 50%"],
    "industry": "Technology"
  }]'::jsonb,
  '[{
    "institution": "MIT",
    "degree": "BS",
    "field_of_study": "Computer Science",
    "start_date": "2010-09-01",
    "end_date": "2014-05-30",
    "gpa": 3.8,
    "achievements": ["Dean''s List"],
    "is_verified": true,
    "certifications": ["AWS Certified Developer"]
  }]'::jsonb,
  '{
    "preferred_job_types": ["FULL_TIME"],
    "preferred_locations": ["New York, NY", "Remote"],
    "remote_only": false,
    "salary_expectation_min": 130000,
    "salary_expectation_max": 180000,
    "open_to_relocation": true,
    "preferred_industries": ["Technology", "Finance"],
    "preferred_companies": ["Google", "Amazon", "Microsoft"],
    "preferred_travel_percentage": 20,
    "excluded_industries": []
  }'::jsonb,
  '{
    "match_score": 85,
    "skill_match_percentage": 90,
    "experience_match_score": 85,
    "culture_fit_score": 80,
    "location_match_score": 85,
    "overall_ranking": 1,
    "matching_jobs": [],
    "match_confidence": 0.9
  }'::jsonb
);

-- Test Applications Data with Status Tracking
INSERT INTO applications (id, job_id, candidate_id, status, metadata, applied_at)
SELECT
  uuid_generate_v4(),
  j.id,
  c.id,
  'SCREENING',
  '{
    "resume_score": 85,
    "skill_match": 90,
    "initial_screening_result": "Positive",
    "source": "Direct Application",
    "notes": "Strong technical background"
  }'::jsonb,
  NOW() - interval '2 days'
FROM jobs j
CROSS JOIN candidates c
LIMIT 1;

-- Test Interviews Data
INSERT INTO interviews (id, application_id, schedule_time, type, feedback, status)
SELECT
  uuid_generate_v4(),
  a.id,
  NOW() + interval '2 days',
  'TECHNICAL',
  '{
    "technical_skills": 4.5,
    "communication": 4.0,
    "problem_solving": 4.5,
    "culture_fit": 4.0,
    "overall_rating": 4.25,
    "notes": "Strong technical skills and good culture fit",
    "recommendations": "Proceed to next round"
  }'::jsonb,
  'SCHEDULED'
FROM applications a;

-- Test AI Match Data
INSERT INTO matches (id, job_id, candidate_id, match_score, match_details, created_at)
SELECT
  uuid_generate_v4(),
  j.id,
  c.id,
  85.5,
  '{
    "skill_match": 90,
    "experience_match": 85,
    "location_match": 80,
    "salary_match": 95,
    "culture_fit": 80,
    "overall_confidence": 0.9,
    "matching_factors": [
      {"factor": "Technical Skills", "score": 90},
      {"factor": "Experience Level", "score": 85},
      {"factor": "Location Preference", "score": 80}
    ]
  }'::jsonb,
  NOW()
FROM jobs j
CROSS JOIN candidates c
LIMIT 1;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_interviews_schedule ON interviews(schedule_time);
CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(match_score);

-- Add test data for security validation
INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
SELECT
  u.id,
  'VIEW',
  'JOB',
  j.id,
  '{"ip_address": "192.168.1.1", "user_agent": "Mozilla/5.0"}'::jsonb
FROM users u
CROSS JOIN jobs j
WHERE u.role = 'RECRUITER'
LIMIT 1;

-- Generate performance test data
DO $$
DECLARE
    i INTEGER;
    user_id UUID;
BEGIN
    -- Get a recruiter user id
    SELECT id INTO user_id FROM users WHERE role = 'RECRUITER' LIMIT 1;
    
    -- Generate bulk test jobs
    FOR i IN 1..100 LOOP
        INSERT INTO jobs (
            id, title, description, creator_id, requirements, status, type,
            skills, posted_at, salary_min, salary_max, location, remote_allowed
        )
        VALUES (
            uuid_generate_v4(),
            'Software Engineer ' || i,
            'Position description ' || i,
            user_id,
            '{
                "experience_level": "MID",
                "years_experience": 3,
                "required_skills": ["JavaScript", "Python"],
                "preferred_skills": ["React", "AWS"],
                "qualifications": ["Bachelor degree"],
                "responsibilities": ["Development", "Testing"]
            }'::jsonb,
            'PUBLISHED',
            'FULL_TIME',
            ARRAY['JavaScript', 'Python', 'React'],
            NOW() - (random() * interval '90 days'),
            80000,
            120000,
            'Remote',
            true
        );
    END LOOP;
END $$;

-- Add comments for documentation
COMMENT ON TABLE users IS 'Test users across different roles with security settings';
COMMENT ON TABLE jobs IS 'Test job postings with AI matching metadata';
COMMENT ON TABLE candidates IS 'Test candidate profiles with matching scores';
COMMENT ON TABLE applications IS 'Test job applications with status tracking';
COMMENT ON TABLE interviews IS 'Test interview schedules and feedback';
COMMENT ON TABLE matches IS 'Test AI-powered job-candidate matches';