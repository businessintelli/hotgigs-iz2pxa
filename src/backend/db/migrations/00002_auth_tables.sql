-- Migration: Enhanced Authentication Tables
-- Version: 2.0.0
-- Description: Creates and configures enhanced authentication-related database tables with comprehensive 
-- row-level security policies, advanced session tracking, and security-focused indexes

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- For password hashing
CREATE EXTENSION IF NOT EXISTS "citext";        -- For case-insensitive text fields
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- For query analysis
CREATE EXTENSION IF NOT EXISTS "pgaudit";       -- For security audit logging

-- Create enhanced user roles enum
CREATE TYPE user_roles AS ENUM (
  'ADMIN',
  'RECRUITER',
  'HIRING_MANAGER', 
  'CANDIDATE',
  'GUEST'
);

-- Create users table with enhanced security features
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_roles NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  failed_login_attempts INTEGER DEFAULT 0,
  account_locked BOOLEAN DEFAULT FALSE,
  account_locked_until TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  last_password_change TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  password_history JSONB DEFAULT '[]',
  allowed_ip_addresses INET[] DEFAULT '{}',
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret TEXT,
  security_settings JSONB NOT NULL DEFAULT '{
    "require_mfa": false,
    "password_expiry_days": 90,
    "max_sessions": 5,
    "ip_whitelist_enabled": false,
    "session_timeout_minutes": 30
  }',
  profile JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT min_password_length CHECK (length(password_hash) >= 60)
);

-- Create enhanced sessions table with device tracking
CREATE TABLE auth.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  device_fingerprint TEXT NOT NULL,
  device_info JSONB NOT NULL DEFAULT '{}',
  ip_address INET NOT NULL,
  ip_location JSONB,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activity_log JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_expires_at CHECK (expires_at > created_at)
);

-- Create security audit log table
CREATE TABLE auth.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION auth.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to log security events
CREATE OR REPLACE FUNCTION auth.log_security_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_data JSONB,
  p_ip_address INET,
  p_user_agent TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO auth.security_audit_log (
    user_id, event_type, event_data, ip_address, user_agent
  ) VALUES (
    p_user_id, p_event_type, p_event_data, p_ip_address, p_user_agent
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance optimization
CREATE INDEX idx_users_email ON auth.users (email);
CREATE INDEX idx_users_role ON auth.users (role);
CREATE INDEX idx_users_email_verified ON auth.users (email_verified);
CREATE INDEX idx_users_account_locked ON auth.users (account_locked) WHERE account_locked = true;
CREATE INDEX idx_users_failed_attempts ON auth.users (failed_login_attempts) WHERE failed_login_attempts > 0;

CREATE INDEX idx_sessions_user_id ON auth.sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON auth.sessions (expires_at);
CREATE INDEX idx_sessions_device ON auth.sessions (device_fingerprint);
CREATE INDEX idx_active_sessions ON auth.sessions (user_id, expires_at) 
  WHERE revoked_at IS NULL AND expires_at > NOW();

CREATE INDEX idx_audit_log_user ON auth.security_audit_log (user_id);
CREATE INDEX idx_audit_log_event_type ON auth.security_audit_log (event_type);
CREATE INDEX idx_audit_log_created_at ON auth.security_audit_log (created_at);

-- Add update triggers
CREATE TRIGGER update_users_timestamp
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.update_updated_at();

CREATE TRIGGER update_sessions_timestamp
  BEFORE UPDATE ON auth.sessions
  FOR EACH ROW
  EXECUTE FUNCTION auth.update_updated_at();

-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Users table policies
CREATE POLICY users_select ON auth.users
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'ADMIN'
    OR id::text = auth.jwt() ->> 'sub'
  );

CREATE POLICY users_insert ON auth.users
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' = 'ADMIN'
  );

CREATE POLICY users_update ON auth.users
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'ADMIN'
    OR id::text = auth.jwt() ->> 'sub'
  ) WITH CHECK (
    CASE 
      WHEN auth.jwt() ->> 'role' = 'ADMIN' THEN true
      WHEN id::text = auth.jwt() ->> 'sub' THEN
        NEW.role = OLD.role -- Non-admins cannot change their role
        AND NEW.email = OLD.email -- Email changes require admin
      ELSE false
    END
  );

-- Sessions table policies
CREATE POLICY sessions_select ON auth.sessions
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'ADMIN'
    OR user_id::text = auth.jwt() ->> 'sub'
  );

CREATE POLICY sessions_insert ON auth.sessions
  FOR INSERT WITH CHECK (
    user_id::text = auth.jwt() ->> 'sub'
  );

CREATE POLICY sessions_update ON auth.sessions
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'ADMIN'
    OR user_id::text = auth.jwt() ->> 'sub'
  );

-- Audit log policies
CREATE POLICY audit_log_select ON auth.security_audit_log
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'ADMIN'
    OR user_id::text = auth.jwt() ->> 'sub'
  );

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION auth.cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.sessions
  WHERE expires_at < NOW()
  OR revoked_at IS NOT NULL;
END;
$$;

-- Schedule cleanup job (requires pg_cron extension)
SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 * * * *', -- Every hour
  $$SELECT auth.cleanup_expired_sessions()$$
);

-- Add comments for documentation
COMMENT ON TABLE auth.users IS 'Enhanced user accounts with comprehensive security features';
COMMENT ON TABLE auth.sessions IS 'User authentication sessions with device tracking and security monitoring';
COMMENT ON TABLE auth.security_audit_log IS 'Security event audit trail for compliance and monitoring';